// src/contexts/AuthContext.jsx - FIXED WITH PROPER ROLE LOGIC
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// Create the authentication context
const AuthContext = createContext();

// Custom hook to use the auth context
export function useAuth() {
    return useContext(AuthContext);
}

// Role-based redirect mapping (removed guest and external)
const ROLE_REDIRECTS = {
    admin: '/admin/dashboard',
    instructor: '/instructor/dashboard',
    parent: '/parent/dashboard',
    host: '/host/dashboard'
};

// Helper function to wait for a delay
const delay = (ms) => {
    // Skip delay in test environment
    if (process.env.NODE_ENV === 'test') return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Helper function to retry Firestore reads with exponential backoff
const retryFirestoreRead = async (docRef, maxRetries = 3, baseDelay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        const doc = await getDoc(docRef);

        if (doc.exists()) {
            const data = doc.data();

            // Check if we have meaningful data (not just lastLogin)
            const hasRole = data.role && typeof data.role === 'string';
            const hasEmail = data.email && typeof data.email === 'string';
            const hasDisplayName = data.displayName !== undefined;

            // If we have a role or this is our last attempt, return the data
            if (hasRole || attempt === maxRetries) {

                return { exists: true, data };
            }

            // If we only have partial data, wait longer before next attempt
            if (attempt < maxRetries) {
                const waitTime = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
                await delay(waitTime);
            }
        } else {
            // Document doesn't exist, wait before retry (except on last attempt)
            if (attempt < maxRetries) {
                const waitTime = baseDelay * Math.pow(2, attempt - 1);
                await delay(waitTime);
            }
        }
    }

    return { exists: false, data: null };
};

// Get appropriate dashboard for role
const getDashboardForRole = (role) => {
    return ROLE_REDIRECTS[role] || '/admin/dashboard';
};

// Provider component to wrap the app and provide auth context
export function AuthProvider({ children }) {

    // State management
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);

    // Function to create or update user document in Firestore
    async function createUserDocument(user, additionalData = {}) {
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            const { displayName, email } = user;
            // Default role should be 'host' instead of external
            const defaultRole = additionalData.role || 'host';

            try {
                await setDoc(userRef, {
                    displayName: displayName || '',
                    email,
                    role: defaultRole,
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    ...additionalData
                });

                return { displayName, email, role: defaultRole, ...additionalData };
            } catch (error) {
                throw error;
            }
        }

        // If document exists, return the data
        const existingData = userDoc.data();
        return existingData;
    }

    // Enhanced login function with role detection
    async function signIn(email, password) {
        try {
            setError(null);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Update last login timestamp
            const userRef = doc(db, 'users', userCredential.user.uid);
            await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });

            return userCredential;
        } catch (error) {
            console.error("Login error:", error);
            setError(error.message);
            throw error;
        }
    }

    // Enhanced Google sign-in with role verification
    async function signInWithGoogle() {
        try {
            setError(null);
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;

            // Check if email exists in authorized users
            const usersRef = collection(db, 'users');
            const emailQuery = query(usersRef, where('email', '==', user.email));
            const emailQuerySnapshot = await getDocs(emailQuery);

            if (emailQuerySnapshot.empty) {
                // Email not found in authorized users
                await signOut(auth);
                throw new Error('This email is not authorized to access this application. Please contact an administrator.');
            }

            // Email exists, update user document
            const existingUserDoc = emailQuerySnapshot.docs[0];
            const existingUserId = existingUserDoc.id;

            // Update the existing user document with Google auth info
            const userRef = doc(db, 'users', existingUserId);
            await setDoc(userRef, {
                lastLogin: serverTimestamp(),
                authProvider: 'google',
                ...(user.displayName ? { displayName: user.displayName } : {}),
                ...(user.photoURL ? { photoURL: user.photoURL } : {})
            }, { merge: true });

            return userCredential;
        } catch (error) {
            console.error("Google sign-in error:", error);
            setError(error.message);
            throw error;
        }
    }

    // Function to register a new user (admin only)
    async function registerUser(email, password, displayName, role = 'host') {
        try {
            setError(null);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Create user document in Firestore
            await createUserDocument(userCredential.user, {
                displayName,
                role,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });

            return userCredential;
        } catch (error) {
            console.error("Registration error:", error);
            setError(error.message);
            throw error;
        }
    }

    // Enhanced logout function with complete state reset
    async function logout() {
        try {
            setError(null);
            setLoading(true);

            // Clear all state BEFORE signing out
            setCurrentUser(null);
            setUserRole(null);
            setUserData(null);

            // Sign out from Firebase
            await signOut(auth);

            // Additional cleanup
            if (typeof window !== 'undefined') {
                localStorage.removeItem('userRole');
                localStorage.removeItem('userData');
                sessionStorage.clear();
            }

            // Force a small delay to ensure Firebase state is cleared
            await new Promise(resolve => setTimeout(resolve, 100));

            return true;
        } catch (error) {
            console.error("Logout error:", error);
            setError(error.message);
            throw error;
        } finally {
            // Force page reload to ensure complete state reset
            window.location.reload();
        }
    }

    // Password reset function
    async function resetPassword(email) {
        try {
            setError(null);
            await sendPasswordResetEmail(auth, email);
            return true;
        } catch (error) {
            console.error("Password reset error:", error);
            setError(error.message);
            throw error;
        }
    }

    // FIXED: Proper auth state change handler
    useEffect(() => {

        const unsubscribe = onAuthStateChanged(auth, async (user) => {

            // If no user, clear all state
            if (!user) {
                setCurrentUser(null);
                setUserData(null);
                setUserRole(null);
                setError(null);
                setLoading(false);
                setAuthInitialized(true);
                return;
            }

            // If we have a different user than before, clear previous state first
            if (currentUser && currentUser.uid !== user.uid) {
                setCurrentUser(null);
                setUserData(null);
                setUserRole(null);
                setError(null);
            }

            setLoading(true);

            try {

                // Add initial delay for international users
                await delay(500);

                // FIXED: Try to get user by UID with retry logic
                const userRef = doc(db, 'users', user.uid);
                let userDocResult = await retryFirestoreRead(userRef, 3, 1000);
                let firestoreData = null;
                let actualDocId = user.uid;

                if (userDocResult.exists) {
                    firestoreData = userDocResult.data;
                } else {
                    // If no document by UID, try to find by email

                    // Add delay before email search
                    await delay(1000);

                    const usersRef = collection(db, 'users');
                    const emailQuery = query(usersRef, where('email', '==', user.email));

                    // Retry email query as well
                    let emailFound = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {

                        const emailQuerySnapshot = await getDocs(emailQuery);

                        if (!emailQuerySnapshot.empty) {
                            const existingUserDoc = emailQuerySnapshot.docs[0];
                            actualDocId = existingUserDoc.id;
                            firestoreData = existingUserDoc.data();

                            emailFound = true;
                            break;
                        }

                        if (attempt < 3) {
                            const waitTime = 1000 * Math.pow(2, attempt - 1);
                            await delay(waitTime);
                        }
                    }

                    if (emailFound && firestoreData) {
                        // IMPORTANT: Copy the data to the correct UID document for future lookups

                        try {
                            await setDoc(userRef, {
                                ...firestoreData,
                                lastLogin: serverTimestamp()
                            });

                            // Wait a bit for the write to propagate
                            await delay(500);
                        } catch (copyError) {
                        }
                    }
                }

                // If we found user data, process it
                if (firestoreData) {

                    // FIXED: Get role with proper validation
                    let userRole = firestoreData.role;

                    if (userRole && typeof userRole === 'string') {
                        userRole = userRole.trim();
                    }

                    const allowedRoles = ['admin', 'instructor', 'parent', 'host'];

                    // Enhanced validation
                    const isRoleValid = userRole &&
                        typeof userRole === 'string' &&
                        userRole.trim().length > 0 &&
                        allowedRoles.includes(userRole.trim());


                    if (!isRoleValid) {
                        userRole = 'host';

                        // Update the document we're actually using
                        const updateRef = doc(db, 'users', actualDocId);
                        try {
                            await setDoc(updateRef, {
                                role: userRole,
                                lastLogin: serverTimestamp()
                            }, { merge: true });

                            // Wait for update to propagate
                            await delay(500);
                        } catch (updateError) {
                            console.warn('❌ Could not update role in Firestore:', updateError);
                        }
                    } else {
                        // Role is valid, just update lastLogin
                        const updateRef = doc(db, 'users', actualDocId);
                        try {
                            await setDoc(updateRef, {
                                lastLogin: serverTimestamp()
                            }, { merge: true });
                        } catch (updateError) {
                            console.warn('Could not update lastLogin:', updateError);
                        }
                    }


                    // Create clean user data
                    const cleanUserData = {
                        displayName: firestoreData.displayName || user.displayName || '',
                        email: firestoreData.email || user.email,
                        name: firestoreData.name || '',
                        phone: firestoreData.phone || '',
                        role: userRole,
                        createdAt: firestoreData.createdAt,
                        lastLogin: serverTimestamp()
                    };

                    // Create enhanced user object
                    const enhancedUser = {
                        ...user,
                        ...cleanUserData,
                        uid: user.uid,
                        email: user.email
                    };

                    // Set all state
                    setCurrentUser(enhancedUser);
                    setUserData(cleanUserData);
                    setUserRole(userRole);
                    setError(null);


                    setLoading(false);
                    setAuthInitialized(true);
                } else {
                    // No user found in database after retries - create with default role

                    const defaultUserData = await createUserDocument(user, {
                        role: 'host'
                    });

                    // Wait for document creation to propagate
                    await delay(1000);

                    const userRole = defaultUserData.role;
                    const enhancedUser = {
                        ...user,
                        ...defaultUserData,
                        role: userRole
                    };

                    setCurrentUser(enhancedUser);
                    setUserData(defaultUserData);
                    setUserRole(userRole);
                    setError(null);

                }
            } catch (firestoreError) {
                console.error("Error in auth state change handler:", firestoreError);
                setError("Error loading user data");

                // Clear user state on error
                setCurrentUser(null);
                setUserData(null);
                setUserRole(null);
            }
        });

        return unsubscribe;
    }, []); // Keep dependencies empty to avoid loops

    // Utility function to determine redirect path based on role
    const shouldRedirect = userRole ? getDashboardForRole(userRole) : null;

    // Enhanced role checking functions based on current userRole
    const isAdmin = userRole === 'admin';
    const isInstructor = userRole === 'instructor' || userRole === 'admin';
    const isParent = userRole === 'parent' || userRole === 'admin';
    const isHost = userRole === 'host' || userRole === 'admin';

    // Function to check if user has specific role
    const hasRole = (requiredRole) => {
        if (!userRole) return false;
        if (userRole === 'admin') return true; // Admin can access everything
        return userRole === requiredRole;
    };

    // Function to check if user has any of the specified roles
    const hasAnyRole = (roles) => {
        if (!userRole) return false;
        if (userRole === 'admin') return true; // Admin can access everything
        return roles.includes(userRole);
    };

    // Create value object with auth functions and state
    const value = {
        // User state
        currentUser,
        userRole,
        userData,
        loading,
        error,
        authInitialized,
        shouldRedirect, // Add this for the RoleRedirectHandler

        // Auth functions
        signIn,
        signInWithGoogle,
        registerUser,
        logout,
        signOut: logout,
        resetPassword,

        // Role checking functions
        isAdmin,
        isInstructor,
        isParent,
        isHost,
        hasRole,
        hasAnyRole,

        // Utility functions
        getDashboardForRole,

        // Legacy compatibility
        login: signIn
    };



    // Show loading spinner while initializing
    if (!authInitialized || loading) {
        return (
            <AuthContext.Provider value={value}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    flexDirection: 'column'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #3498db',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}></div>
                    <p style={{ marginTop: '16px', color: '#666' }}>Initializing...</p>
                </div>
            </AuthContext.Provider>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}