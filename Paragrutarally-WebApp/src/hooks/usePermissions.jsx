// src/hooks/usePermissions.jsx - ENHANCED WITH FIELD-LEVEL PERMISSIONS
import { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

const PermissionContext = createContext();

// FIELD-LEVEL PERMISSIONS CONFIGURATION
const FIELD_PERMISSIONS = {
    admin: {
        // Admins can see and edit most fields
        visible: [
            'participantNumber',
            'personalInfo.firstName',
            'personalInfo.lastName',
            'personalInfo.dateOfBirth',
            'personalInfo.address',
            'personalInfo.capabilities',
            'personalInfo.announcersNotes',
            'personalInfo.photo',
            'parentInfo.name',
            'parentInfo.email',
            'parentInfo.phone',
            'parentInfo.parentId',
            'parentInfo.grandparentsInfo.names',
            'parentInfo.grandparentsInfo.phone',
            'teamId',
            'instructorId',
            'vehicleIds',
            'signedDeclaration',
            'signedFormStatus',
            'additionalComments',
            'comments.organization',
            'comments.teamLeader',
            'comments.parent',
            'comments.familyContact',
            'createdAt',
            'updatedAt'
        ],
        editable: [
            'participantNumber',
            'personalInfo.address',
            'personalInfo.capabilities',
            'personalInfo.announcersNotes',
            'personalInfo.photo',
            'parentInfo.name',
            'parentInfo.phone',
            'parentInfo.parentId',
            'parentInfo.grandparentsInfo.names',
            'parentInfo.grandparentsInfo.phone',
            'teamId',
            'instructorId',
            'vehicleIds',
            'signedDeclaration',
            'signedFormStatus',
            'additionalComments',
            'comments.organization'
        ],
        hidden: [] // Admins can see everything
    },

    instructor: {
        // Team leaders can see kids assigned to them, edit purple fields
        visible: [
            'participantNumber',
            'personalInfo.firstName',
            'personalInfo.lastName',
            'personalInfo.dateOfBirth',
            'personalInfo.capabilities',
            'personalInfo.announcersNotes',
            'parentInfo.name',
            'parentInfo.phone', // Can see parent contact for their kids
            'teamId',
            'instructorId',
            'vehicleIds',
            'signedFormStatus',
            'additionalComments',
            'comments.teamLeader',
            'comments.organization',
            'instructorsComments'
        ],
        editable: [
            'personalInfo.capabilities',
            'personalInfo.announcersNotes',
            'comments.teamLeader',
            'instructorsComments',
            'vehicleIds'
        ],
        hidden: [
            'parentInfo.email', // Red field - hidden from instructors
            'parentInfo.parentId',
            'parentInfo.grandparentsInfo',
            'comments.parent',
            'comments.familyContact',
            'personalInfo.address' // Restricted access
        ]
    },

    parent: {
        // Parents can see ALL details of their own kids only
        visible: [
            'participantNumber',
            'personalInfo.firstName',
            'personalInfo.lastName',
            'personalInfo.dateOfBirth',
            'personalInfo.address',
            'personalInfo.capabilities',
            'personalInfo.announcersNotes',
            'personalInfo.photo',
            'parentInfo.name',
            'parentInfo.email',
            'parentInfo.phone',
            'parentInfo.grandparentsInfo.names',
            'parentInfo.grandparentsInfo.phone',
            'teamId',
            'signedDeclaration',
            'signedFormStatus',
            'additionalComments',
            'comments.parent'
        ],
        editable: [
            'comments.parent' // Parents can only edit their own comments
        ],
        hidden: [
            'parentInfo.parentId', // System field
            'comments.organization', // Red field for parents
            'comments.teamLeader',   // Red field for parents
            'comments.familyContact', // Red field for parents
            'instructorId',
            'instructorsComments'
        ]
    },

    guest: {
        // Temporary guests (kibbutz hosts) - can see only kids registered for events
        visible: [
            'participantNumber',
            'personalInfo.firstName',
            'personalInfo.lastName',
            'personalInfo.capabilities',
            'personalInfo.announcersNotes',
            'teamId',
            'signedFormStatus',
            'additionalComments',
            'comments.organization'
        ],
        editable: [
            'comments.organization' // Guests can edit organization comments
        ],
        hidden: [
            'personalInfo.dateOfBirth', // Red field for guests
            'personalInfo.address',     // Red field for guests
            'personalInfo.photo',       // Red field for guests
            'parentInfo',              // Red field - all parent info hidden
            'instructorId',
            'vehicleIds',
            'signedDeclaration',
            'comments.parent',
            'comments.teamLeader',
            'comments.familyContact',
            'instructorsComments'
        ]
    }
};

// ENHANCED ROLE-BASED PERMISSIONS WITH FIELD-LEVEL SUPPORT
const createRolePermissions = (userRole = 'guest') => {
    const permissions = FIELD_PERMISSIONS[userRole] || FIELD_PERMISSIONS.guest;

    // Helper function to check if user can access kid
    const canViewKid = (kid, userData, user) => {
        switch (userRole) {
            case 'admin':
                return true;
            case 'parent':
                return kid?.parentInfo?.parentId === user?.uid;
            case 'instructor':
                return kid?.instructorId === userData?.instructorId;
            case 'host':
            case 'guest':
                return true;
            default:
                return false;
        }
    };

    // Helper function to check if user can edit kid
    const canEditKid = (kid, userData, user) => {
        switch (userRole) {
            case 'admin':
                return true;
            case 'instructor':
                return kid?.instructorId === userData?.instructorId;
            case 'host':
            case 'guest':
                return true; // Hosts can edit specific fields defined in FIELD_PERMISSIONS
            case 'parent':
                return kid?.parentInfo?.parentId === user?.uid;
            default:
                return false;
        }
    };

    return {
        // Basic permissions
        canCreate: userRole === 'admin',
        canEdit: userRole === 'admin' || userRole === 'instructor',
        canDelete: userRole === 'admin',
        canViewAll: userRole === 'admin',

        // Kid-level permissions
        canViewKid,
        canEditKid,

        // Field-level permissions - THIS IS WHAT PROTECTEDFIELD EXPECTS
        canViewField: (fieldPath, context = {}) => {
            const { kidData, vehicleData } = context;

            // First check if field is explicitly hidden
            if (permissions.hidden.includes(fieldPath)) {
                return false;
            }

            // Check if user can access this kid first
            if (kidData && !canViewKid(kidData, context.userData, context.user)) {
                return false;
            }

            // Check if field is in visible list
            return permissions.visible.includes(fieldPath);
        },

        canEditField: (fieldPath, context = {}) => {
            const { kidData, vehicleData } = context;

            // Must be able to view field first
            if (!permissions.visible.includes(fieldPath)) {
                return false;
            }

            // Must be able to access this kid
            if (kidData && !canEditKid(kidData, context.userData, context.user)) {
                return false;
            }

            // Check if field is in editable list
            return permissions.editable.includes(fieldPath);
        },

        // Utility functions
        getVisibleFields: () => permissions.visible,
        getEditableFields: () => permissions.editable,
        getHiddenFields: () => permissions.hidden,

        role: userRole
    };
};

export const PermissionProvider = ({ children }) => {
    const authContext = useAuth();

    // Extract auth values with fallbacks
    const authUser = authContext?.currentUser || authContext?.user || null;
    const authUserRole = authContext?.userRole || null;
    const authLoading = authContext?.loading || false;

    const [userData, setUserData] = useState(null);
    const [permissions, setPermissions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasInitialized, setHasInitialized] = useState(false);

    const loadUserData = useCallback(async () => {
        if (hasInitialized || authLoading) {
            return;
        }

        try {
            setError(null);

            if (!authUser) {
                setPermissions(createRolePermissions('guest'));
                setUserData(null);
            } else {
                // Use auth role as primary source, Firestore as fallback
                if (authUserRole) {
                    const authBasedData = {
                        role: authUserRole,
                        email: authUser.email,
                        displayName: authUser.displayName || '',
                        source: 'authContext'
                    };
                    setUserData(authBasedData);
                    setPermissions(createRolePermissions(authUserRole));
                } else {
                    // Fallback to Firestore if auth role is missing
                    try {
                        const userDoc = await getDoc(doc(db, 'users', authUser.uid));

                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            const role = data.role || 'admin';

                            setUserData({ ...data, source: 'firestore' });
                            setPermissions(createRolePermissions(role));
                        } else {
                            // No Firestore doc - default to admin for development
                            const defaultData = {
                                role: 'admin',
                                email: authUser.email,
                                displayName: authUser.displayName || '',
                                source: 'default'
                            };
                            setUserData(defaultData);
                            setPermissions(createRolePermissions('admin'));
                        }
                    } catch (firestoreError) {
                        // Firestore error - fall back to admin
                        const fallbackData = {
                            role: 'admin',
                            email: authUser.email,
                            displayName: authUser.displayName || '',
                            source: 'fallback'
                        };
                        setUserData(fallbackData);
                        setPermissions(createRolePermissions('admin'));
                    }
                }
            }
        } catch (error) {
            setError(error.message);
            // Even on error, provide admin permissions for development
            const errorData = {
                role: 'admin',
                email: authUser?.email || '',
                displayName: authUser?.displayName || '',
                source: 'error'
            };
            setUserData(errorData);
            setPermissions(createRolePermissions('admin'));
        } finally {
            setLoading(false);
            setHasInitialized(true);
        }
    }, [authUser, authUserRole, authLoading, hasInitialized]);

    useEffect(() => {
        loadUserData();
    }, [loadUserData]);

    // Priority order for role determination
    const finalUserRole = userData?.role || authUserRole || 'guest';
    const finalPermissions = permissions || createRolePermissions(finalUserRole);

    const contextValue = {
        permissions: finalPermissions,
        userRole: finalUserRole,
        userData,
        user: authUser,
        loading,
        error
    };

    return (
        <PermissionContext.Provider value={contextValue}>
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionContext);

    if (!context) {
        return {
            permissions: createRolePermissions('admin'),
            userRole: 'admin',
            userData: { role: 'admin' },
            user: null,
            loading: false,
            error: 'Used outside provider'
        };
    }

    return context;
};

// UTILITY FUNCTIONS for easy permission checking
export const canUserAccessKid = (userRole, kid, userData, user) => {
    switch (userRole) {
        case 'admin':
            return true;

        case 'parent':
            return kid.parentInfo?.parentId === user?.uid;

        case 'instructor':
            return kid.instructorId === userData?.instructorId;

        case 'guest':
        default:
            return false;
    }
};

export const canUserEditKid = (userRole, kid, userData, user) => {
    switch (userRole) {
        case 'admin':
            return true;

        case 'instructor':
            return kid.instructorId === userData?.instructorId;

        case 'parent':
        case 'guest':
        default:
            return false;
    }
};