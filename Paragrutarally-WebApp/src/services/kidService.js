// src/services/kidService.js - Updated without Vehicle Assignment Logic
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { convertFirestoreToKid, getKidFullName, prepareKidForFirestore, validateKid } from '../schemas/kidSchema';

/**
 * Get the next available participant number
 * @returns {Promise<string>} Next participant number (e.g., "004")
 */
export const getNextParticipantNumber = async () => {
    try {
        const kidsQuery = query(
            collection(db, 'kids'),
            orderBy('participantNumber', 'desc'),
            limit(1)
        );

        const querySnapshot = await getDocs(kidsQuery);

        if (querySnapshot.empty) {
            return '001'; // First participant
        }

        const lastKid = querySnapshot.docs[0].data();
        const lastNumber = parseInt(lastKid.participantNumber) || 0;
        const nextNumber = lastNumber + 1;

        // Pad with zeros to make it 3 digits
        return nextNumber.toString().padStart(3, '0');
    } catch (error) {
        console.error('Error getting next participant number:', error);
        // Return a timestamp-based number as fallback
        const timestamp = Date.now().toString().slice(-3);
        return timestamp.padStart(3, '0');
    }
};

/**
 * Add a new kid to the database
 * @param {Object} kidData - Kid data from the form
 * @param {Function} t - Translation function (optional)
 * @returns {Promise<string>} The ID of the created kid document
 */
export const addKid = async (kidData, t = null) => {
    try {
        // Validate the data first with translation support
        const validation = validateKid(kidData, t);
        if (!validation.isValid) {
            const errorMessages = Object.values(validation.errors).join(', ');
            throw new Error(`Validation failed: ${errorMessages}`);
        }

        // Check if participant number is already taken
        const existingKidQuery = query(
            collection(db, 'kids'),
            where('participantNumber', '==', kidData.participantNumber)
        );
        const existingKidSnapshot = await getDocs(existingKidQuery);

        if (!existingKidSnapshot.empty) {
            // Get next available number
            const nextNumber = await getNextParticipantNumber();
            kidData.participantNumber = nextNumber;
            console.warn(`Participant number was taken, assigned new number: ${nextNumber}`);
        }

        // Prepare data for Firestore (ensure vehicleId is set to null/empty for new kids)
        const preparedData = {
            ...prepareKidForFirestore(kidData, false),
            vehicleId: null // Ensure new kids start with no vehicle assignment
        };

        // Add to Firestore
        const docRef = await addDoc(collection(db, 'kids'), preparedData);

        return docRef.id;

    } catch (error) {
        console.error('Error adding kid:', error);
        throw new Error(`Failed to add kid: ${error.message}`);
    }
};

/**
 * Get a kid by ID
 * @param {string} kidId - The kid's document ID
 * @returns {Promise<Object>} Kid data
 */
export const getKidById = async (kidId) => {
    try {
        const kidDoc = await getDoc(doc(db, 'kids', kidId));

        if (!kidDoc.exists()) {
            throw new Error('Kid not found');
        }

        return convertFirestoreToKid(kidDoc);
    } catch (error) {
        console.error('❌ Error getting kid:', error);
        throw new Error(`Failed to get kid: ${error.message}`);
    }
};

/**
 * Update a kid - UPDATED VERSION without vehicle assignment logic
 * @param {string} kidId - The kid's document ID
 * @param {Object} updates - Updated kid data
 * @param {Function} t - Translation function (optional)
 * @returns {Promise<Object>} Updated kid data
 */
export const updateKid = async (kidId, updates, t = null) => {
    try {
        // Validate the updated data with translation support
        const validation = validateKid(updates, t);

        if (!validation.isValid) {
            console.error('❌ Validation failed:', validation.errors);
            const errorMessages = Object.values(validation.errors).join(', ');
            throw new Error(`Validation failed: ${errorMessages}`);
        }

        // Prepare data for Firestore
        const preparedData = prepareKidForFirestore(updates, true);

        // Update in Firestore
        const kidRef = doc(db, 'kids', kidId);
        await updateDoc(kidRef, preparedData);

        // Fetch and return the updated document to verify
        const updatedDoc = await getDoc(kidRef);

        if (!updatedDoc.exists()) {
            throw new Error('Kid document not found after update');
        }

        const updatedKidData = convertFirestoreToKid(updatedDoc);

        return updatedKidData;

    } catch (error) {
        console.error('❌ Error updating kid:', error);

        // Provide more specific error messages
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. You do not have access to update this kid.');
        } else if (error.code === 'not-found') {
            throw new Error('Kid not found. It may have been deleted.');
        } else if (error.code === 'unavailable') {
            throw new Error('Database temporarily unavailable. Please try again.');
        } else if (error.message.includes('Validation failed')) {
            // Re-throw validation errors as-is
            throw error;
        } else {
            throw new Error(`Failed to update kid: ${error.message}`);
        }
    }
};

/**
 * Update a kid's team assignment with team membership management and vehicle reset
 * This function handles BOTH the kid document AND team arrays, plus vehicle cleanup
 * @param {string} kidId - The kid's document ID
 * @param {string|null} newTeamId - The new team ID (null to remove team)
 * @returns {Promise<void>}
 */
export const updateKidTeamAssignment = async (kidId, newTeamId) => {
    try {
        // First, get the current kid data to find the old team
        const kidDoc = await getDoc(doc(db, 'kids', kidId));
        if (!kidDoc.exists()) {
            throw new Error('Kid not found');
        }

        const currentKidData = kidDoc.data();
        const oldTeamId = currentKidData.teamId;

        // Handle vehicle assignment reset when changing teams
        if (oldTeamId !== newTeamId) {
            try {
                // Import and use the vehicle assignment service to handle team change
                const { handleKidTeamChange } = await import('./vehicleAssignmentService');
                await handleKidTeamChange(kidId, newTeamId, oldTeamId);
            } catch (vehicleError) {
                console.warn('⚠️ Failed to handle vehicle assignment during team change:', vehicleError.message);
                // Continue with team assignment even if vehicle reset fails
            }
        }

        // Update the team arrays first
        try {
            const { updateKidTeam } = await import('./teamService');
            await updateKidTeam(kidId, newTeamId, oldTeamId);
        } catch (teamError) {
            console.error('❌ Team array update failed:', teamError);
            throw new Error(`Failed to update team assignments: ${teamError.message}`);
        }

        // Then update the kid document
        const updateData = {
            teamId: newTeamId || null,
            vehicleId: null, // Reset vehicle assignment when changing teams
            updatedAt: Timestamp.now()
        };

        await updateDoc(doc(db, 'kids', kidId), updateData);

    } catch (error) {
        console.error('❌ Error updating kid team:', error);

        // Provide more specific error messages
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. You do not have access to update this kid.');
        } else if (error.code === 'not-found') {
            throw new Error('Kid not found. It may have been deleted.');
        } else if (error.message === 'Kid not found') {
            throw error;
        } else {
            throw new Error(`Failed to update team assignment: ${error.message}`);
        }
    }
};

/**
 * Delete a kid
 * @param {string} kidId - The kid's document ID
 * @returns {Promise<void>}
 */
export const deleteKid = async (kidId) => {
    try {
        // Before deleting, handle vehicle assignment cleanup
        try {
            const { removeKidFromVehicle } = await import('./vehicleAssignmentService');
            await removeKidFromVehicle(kidId);
        } catch (vehicleError) {
            console.warn('⚠️ Failed to clean up vehicle assignment during kid deletion:', vehicleError);
            // Continue with deletion even if vehicle cleanup fails
        }

        await deleteDoc(doc(db, 'kids', kidId));
    } catch (error) {
        console.error('Error deleting kid:', error);
        throw new Error(`Failed to delete kid: ${error.message}`);
    }
};

/**
 * Get all kids
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of kids
 */
export const getAllKids = async (options = {}) => {
    try {
        let kidsQuery = collection(db, 'kids');

        // Add ordering
        if (options.orderBy) {
            kidsQuery = query(kidsQuery, orderBy(options.orderBy, options.order || 'asc'));
        } else {
            // Default ordering by participant number
            kidsQuery = query(kidsQuery, orderBy('participantNumber', 'asc'));
        }

        // Add limit if specified
        if (options.limit) {
            kidsQuery = query(kidsQuery, limit(options.limit));
        }

        const querySnapshot = await getDocs(kidsQuery);

        return querySnapshot.docs.map(doc => convertFirestoreToKid(doc));
    } catch (error) {
        console.error('Error getting kids:', error);
        throw new Error(`Failed to get kids: ${error.message}`);
    }
};

/**
 * Get kids by team
 * @param {string} teamId - The team's document ID
 * @returns {Promise<Array>} Array of kids in the team
 */
export const getKidsByTeam = async (teamId) => {
    try {
        const kidsQuery = query(
            collection(db, 'kids'),
            where('teamId', '==', teamId),
            orderBy('participantNumber', 'asc')
        );

        const querySnapshot = await getDocs(kidsQuery);

        return querySnapshot.docs.map(doc => convertFirestoreToKid(doc));
    } catch (error) {
        console.error('Error getting kids by team:', error);
        throw new Error(`Failed to get kids by team: ${error.message}`);
    }
};

/**
 * Get kids by instructor
 * @param {string} instructorId - The instructor's document ID
 * @returns {Promise<Array>} Array of kids with the instructor
 */
export const getKidsByInstructor = async (instructorId) => {
    try {
        const kidsQuery = query(
            collection(db, 'kids'),
            where('instructorId', '==', instructorId),
            orderBy('participantNumber', 'asc')
        );

        const querySnapshot = await getDocs(kidsQuery);

        return querySnapshot.docs.map(doc => convertFirestoreToKid(doc));
    } catch (error) {
        console.error('Error getting kids by instructor:', error);
        throw new Error(`Failed to get kids by instructor: ${error.message}`);
    }
};

/**
 * Search kids by name or participant number
 * @param {string} searchTerm - Search term
 * @param {Function} t - Translation function (optional)
 * @returns {Promise<Array>} Array of matching kids
 */
export const searchKids = async (searchTerm, t = null) => {
    try {
        // Get all kids and filter in memory (Firestore has limited text search)
        const allKids = await getAllKids();

        const searchLower = searchTerm.toLowerCase();

        return allKids.filter(kid => {
            const fullName = getKidFullName(kid, t).toLowerCase();
            const participantNumber = kid.participantNumber?.toLowerCase() || '';

            return fullName.includes(searchLower) ||
                participantNumber.includes(searchLower);
        });
    } catch (error) {
        console.error('Error searching kids:', error);
        throw new Error(`Failed to search kids: ${error.message}`);
    }
};

/**
 * Update a kid's team assignment with team membership management
 * @param {string} kidId - The kid's document ID
 * @param {string|null} newTeamId - The new team ID (null to remove team)
 * @returns {Promise<void>}
 */
export const updateKidTeam = async (kidId, newTeamId) => {
    try {
        // First, get the current kid data to find the old team
        const kidDoc = await getDoc(doc(db, 'kids', kidId));
        if (!kidDoc.exists()) {
            throw new Error('Kid not found');
        }

        const currentKidData = kidDoc.data();
        const oldTeamId = currentKidData.teamId;

        // Prepare the kid update data
        const updateData = {
            teamId: newTeamId || null,
            vehicleId: null, // Reset vehicle assignment when changing teams
            updatedAt: Timestamp.now()
        };

        // Update the kid document
        await updateDoc(doc(db, 'kids', kidId), updateData);

        // Handle vehicle assignment cleanup
        if (oldTeamId !== newTeamId) {
            try {
                const { handleKidTeamChange } = await import('./vehicleAssignmentService');
                await handleKidTeamChange(kidId, newTeamId, oldTeamId);
            } catch (vehicleError) {
                console.warn('⚠️ Failed to handle vehicle assignment during team change:', vehicleError);
            }
        }

        // Now handle team membership updates
        try {
            // Import team service functions
            const { addKidToTeam, removeKidFromTeam } = await import('./teamService');

            // Remove from old team if it exists and is different from new team
            if (oldTeamId && oldTeamId !== newTeamId) {
                try {
                    await removeKidFromTeam(oldTeamId, kidId);
                } catch (removeError) {
                    console.warn('⚠️ Failed to remove from old team (continuing anyway):', removeError.message);
                }
            }

            // Add to new team if specified and different from old team
            if (newTeamId && newTeamId !== oldTeamId) {
                try {
                    await addKidToTeam(newTeamId, kidId);
                } catch (addError) {
                    console.warn('⚠️ Failed to add to new team (kid document was updated):', addError.message);
                }
            }

        } catch (teamServiceError) {
            console.warn('⚠️ Team service operations failed, but kid was updated:', teamServiceError.message);
            // Don't throw here - the main kid update succeeded
        }

    } catch (error) {
        console.error('❌ Error updating kid team:', error);

        // Provide more specific error messages
        if (error.code === 'permission-denied') {
            throw new Error('Permission denied. You do not have access to update this kid.');
        } else if (error.code === 'not-found') {
            throw new Error('Kid not found. It may have been deleted.');
        } else if (error.message === 'Kid not found') {
            throw error;
        } else {
            throw new Error(`Failed to update team assignment: ${error.message}`);
        }
    }
};

/**
 * Get kids by parent
 * @param {string} parentId - The parent's user ID
 * @returns {Promise<Array>} Array of kids belonging to the parent
 */
export const getKidsByParent = async (parentId) => {
    try {
        const kidsQuery = query(
            collection(db, 'kids'),
            where('parentInfo.parentIds', 'array-contains', parentId),
            orderBy('participantNumber', 'asc')
        );

        const querySnapshot = await getDocs(kidsQuery);

        return querySnapshot.docs.map(doc => convertFirestoreToKid(doc));
    } catch (error) {
        console.error('Error getting kids by parent:', error);
        throw new Error(`Failed to get kids by parent: ${error.message}`);
    }
};

export const getKidsStats = async () => {
    try {
        const allKids = await getAllKids();

        const stats = {
            total: allKids.length,
            byStatus: {},
            byTeam: {},
            averageAge: 0,
            signedDeclarations: 0
        };

        let totalAge = 0;
        let kidsWithAge = 0;

        allKids.forEach(kid => {
            // Count by status
            const status = kid.signedFormStatus || 'pending';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

            // Count by team
            if (kid.teamId) {
                stats.byTeam[kid.teamId] = (stats.byTeam[kid.teamId] || 0) + 1;
            }

            // Calculate age
            if (kid.personalInfo?.dateOfBirth) {
                const birthDate = new Date(kid.personalInfo.dateOfBirth);
                const age = new Date().getFullYear() - birthDate.getFullYear();
                if (age > 0 && age < 100) { // Sanity check
                    totalAge += age;
                    kidsWithAge++;
                }
            }

            // Count signed declarations
            if (kid.signedDeclaration) {
                stats.signedDeclarations++;
            }
        });

        if (kidsWithAge > 0) {
            stats.averageAge = Math.round(totalAge / kidsWithAge);
        }

        return stats;
    } catch (error) {
        console.error('Error getting kids stats:', error);
        throw new Error(`Failed to get kids statistics: ${error.message}`);
    }
};

// Export all functions
export default {
    getNextParticipantNumber,
    addKid,
    getKidById,
    updateKid,
    updateKidTeam,
    deleteKid,
    getAllKids,
    getKidsByTeam,
    getKidsByInstructor,
    getKidsByParent,
    searchKids,
    getKidsStats
};