// src/services/userService.js - Updated for Callable Functions
import { doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

// Initialize Firebase Functions
const functions = getFunctions(undefined, 'us-central1');
const deleteUserFunction = httpsCallable(functions, 'deleteUser');


/**
 * Update user profile information in Firestore
 * @param {string} userId - The user's document ID
 * @param {Object} userData - The user data to update
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (userId, userData) => {
    try {
        const { serverTimestamp } = await import('firebase/firestore');

        const userDocRef = doc(db, 'users', userId);
        await updateDoc(userDocRef, {
            displayName: userData.displayName,
            name: userData.name,
            phone: userData.phone,
            updatedAt: serverTimestamp(),
            ...(userData.role && { role: userData.role })
        });

    } catch (error) {
        console.error('❌ Error updating user profile:', error);
        throw new Error('Failed to update user profile. Please try again.');
    }
};

/**
 * Get user data from Firestore
 * @param {string} userId - The user's document ID
 * @returns {Promise<Object>} User data
 */
export const getUserData = async (userId) => {
    try {
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            return { id: userDoc.id, ...userDoc.data() };
        } else {
            throw new Error('User not found');
        }
    } catch (error) {
        console.error('❌ Error fetching user data:', error);
        throw new Error('Failed to fetch user data. Please try again.');
    }
};

/**
 * Delete user completely (Authentication + Firestore) - Admin only
 * Uses Firebase Callable Functions to avoid CORS issues
 * @param {string} userIdToDelete - The user ID to delete
 * @returns {Promise<Object>} Deletion result
 */
export const deleteUserCompletely = async (userIdToDelete) => {
    try {

        // Get current user
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('You must be logged in to perform this action.');
        }


        // Create callable function reference
        const deleteUserFunction = httpsCallable(functions, 'deleteUser');


        // Call the function (Firebase handles authentication automatically)
        const result = await deleteUserFunction({
            userIdToDelete: userIdToDelete
        });


        if (!result.data.success) {
            console.error('❌ Callable function error:', result.data.message);
            throw new Error(result.data.message || 'Failed to delete authentication account.');
        }


        // Delete user document from Firestore
        const userDocRef = doc(db, 'users', userIdToDelete);
        await deleteDoc(userDocRef);


        return {
            success: true,
            message: 'User deleted completely from both authentication and database.',
            deletedUserId: userIdToDelete,
            deletedUserEmail: result.data.deletedUserEmail
        };

    } catch (error) {
        console.error('❌ Error in complete user deletion:', error);

        // Handle Firebase Functions specific errors
        if (error.code === 'functions/unauthenticated') {
            throw new Error('You must be logged in to delete users.');
        } else if (error.code === 'functions/permission-denied') {
            throw new Error('You do not have permission to delete users. Admin access required.');
        } else if (error.code === 'functions/invalid-argument') {
            throw new Error('Invalid request. Please check the user ID and try again.');
        } else if (error.code === 'functions/internal') {
            throw new Error('Server error occurred. Please try again or contact support.');
        } else if (error.code === 'functions/unavailable') {
            throw new Error('User deletion service is temporarily unavailable. Please try again later.');
        }

        // Handle other errors
        if (error.message.includes('Network')) {
            throw new Error('Network error. Please check your internet connection and try again.');
        }

        throw new Error(error.message || 'Failed to delete user. Please try again.');
    }
};

/**
 * Get user information using callable function (Admin only)
 * @param {string} userId - The user ID to get info for
 * @returns {Promise<Object>} User information
 */
export const getUserInfo = async (userId) => {
    try {
        const getUserInfoFunction = httpsCallable(functions, 'getUserInfo');
        const result = await getUserInfoFunction({ userId });

        if (result.data.success) {
            return result.data;
        } else {
            throw new Error('Failed to get user information.');
        }
    } catch (error) {
        console.error('❌ Error getting user info:', error);
        throw new Error(error.message || 'Failed to get user information.');
    }
};

/**
 * Update user password with improved error handling
 * @param {string} currentPassword - Current password for reauthentication
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
export const updateUserPassword = async (currentPassword, newPassword) => {
    try {

        const user = auth.currentUser;

        if (!user) {
            console.error('❌ No authenticated user found');
            throw new Error('No authenticated user found. Please sign in again.');
        }

        if (!user.email) {
            console.error('❌ User email not found');
            throw new Error('User email not available. Please sign in again.');
        }


        // Create credential for reauthentication
        const credential = EmailAuthProvider.credential(user.email, currentPassword);


        // Reauthenticate user with current password
        await reauthenticateWithCredential(user, credential);


        // Update password
        await updatePassword(user, newPassword);

    } catch (error) {
        console.error('❌ Error updating password:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        // Handle specific Firebase errors with more descriptive messages
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
                throw new Error('Current password is incorrect. Please check your current password and try again.');

            case 'auth/weak-password':
                throw new Error('New password is too weak. Please choose a stronger password with at least 6 characters.');

            case 'auth/requires-recent-login':
                throw new Error('For security reasons, please sign out and sign back in before changing your password.');

            case 'auth/user-not-found':
                throw new Error('User account not found. Please sign in again.');

            case 'auth/invalid-email':
                throw new Error('Invalid email format. Please sign in again.');

            case 'auth/network-request-failed':
                throw new Error('Network error. Please check your internet connection and try again.');

            case 'auth/too-many-requests':
                throw new Error('Too many failed attempts. Please wait a few minutes before trying again.');

            case 'auth/operation-not-allowed':
                throw new Error('Password update is not enabled. Please contact support.');

            default:
                // For any other error, provide a generic message
                throw new Error(`Failed to update password: ${error.message || 'Unknown error occurred'}`);
        }
    }
};

/**
 * Validate password strength with improved criteria
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validatePassword = (password) => {
    if (!password) {
        return {
            isValid: false,
            message: 'Password is required'
        };
    }

    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
        return {
            isValid: false,
            message: `Password must be at least ${minLength} characters long`
        };
    }

    // Basic validation (Firebase minimum requirements)
    if (password.length >= 6) {
        return {
            isValid: true,
            message: 'Password meets minimum requirements'
        };
    }

    // Enhanced validation (recommended)
    if (!hasUpperCase || !hasLowerCase) {
        return {
            isValid: false,
            message: 'Password should contain both uppercase and lowercase letters'
        };
    }

    if (!hasNumbers) {
        return {
            isValid: false,
            message: 'Password should contain at least one number'
        };
    }

    return {
        isValid: true,
        message: 'Password is strong'
    };
};

/**
 * Check if user is properly authenticated
 * @returns {boolean} True if user is authenticated
 */
export const isUserAuthenticated = () => {
    const user = auth.currentUser;
    return user !== null && user.email !== null;
};

/**
 * Get current user's authentication status
 * @returns {Object} User auth status information
 */
export const getCurrentUserStatus = () => {
    const user = auth.currentUser;

    if (!user) {
        return {
            isAuthenticated: false,
            user: null,
            email: null,
            uid: null
        };
    }

    return {
        isAuthenticated: true,
        user: user,
        email: user.email,
        uid: user.uid,
        emailVerified: user.emailVerified,
        providerData: user.providerData
    };
};

/**
 * Test Cloud Function connectivity using callable functions
 * @returns {Promise<boolean>} True if Cloud Functions are accessible
 */
export const testCloudFunctions = async () => {
    try {
        const healthCheckFunction = httpsCallable(functions, 'healthCheck');
        const result = await healthCheckFunction();
        return result.data.success === true;
    } catch (error) {
        console.error('Cloud Functions connectivity test failed:', error);
        return false;
    }
};

/**
 * Get user's kids from the database (FIXED VERSION)
 * @param {string} userId - Parent user ID
 * @returns {Promise<Array>} List of kids belonging to the user
 */
export const getUserKids = async (userId) => {
    try {
        const kidsRef = collection(db, 'kids');
        // Fixed: Query by parentInfo.parentIds instead of parentId
        const q = query(
            kidsRef,
            where('parentInfo.parentIds', 'array-contains', userId),
            orderBy('participantNumber', 'asc')
        );

        const querySnapshot = await getDocs(q);
        const kids = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Helper function to safely convert Firestore timestamps
            const convertTimestamp = (timestamp) => {
                if (!timestamp) return null;

                // If it's already a Date object, return as is
                if (timestamp instanceof Date) return timestamp;

                // If it's a Firestore Timestamp (has seconds/nanoseconds), convert it
                if (timestamp && typeof timestamp.toDate === 'function') {
                    return timestamp.toDate();
                }

                return null;
            };

            kids.push({
                id: doc.id,
                ...data,
                // Convert any Firestore timestamps if they exist
                createdAt: convertTimestamp(data.createdAt),
                updatedAt: convertTimestamp(data.updatedAt),
                // Handle different date fields that might exist
                dateOfBirth: convertTimestamp(data.personalInfo?.dateOfBirth) || convertTimestamp(data.dateOfBirth)
            });
        });

        return kids;
    } catch (error) {
        console.error('❌ Error getting user kids:', error);
        throw error;
    }
};