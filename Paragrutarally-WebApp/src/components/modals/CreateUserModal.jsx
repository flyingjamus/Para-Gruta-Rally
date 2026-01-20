// src/components/modals/CreateUserModal.jsx - UPDATED WITH CLEAN MODAL STRUCTURE
import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebase/config.js';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    createEmptyUser,
    validateUser,
    validateUserField,
    prepareUserForFirestore,
    USER_ROLES,
    cleanPhoneNumber
} from '@/schemas/userSchema.js';
import {
    IconX as X,
    IconUser as User,
    IconMail as Mail,
    IconPhone as Phone,
    IconShield as Shield,
    IconDeviceFloppy as Save,
    IconUserPlus as UserPlus,
    IconKey as Key
} from '@tabler/icons-react';

const CreateUserModal = ({ isOpen, onClose, onUserCreated }) => {
    const { t, isRTL } = useLanguage();

    const [formData, setFormData] = useState(createEmptyUser());
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    // Real-time field validation using schema
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let processedValue = value;

        // Special handling for phone number - only allow digits
        if (name === 'phone') {
            processedValue = cleanPhoneNumber(value);
            // Limit to 10 digits
            if (processedValue.length > 10) {
                processedValue = processedValue.slice(0, 10);
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: processedValue
        }));

        // Real-time validation using schema
        const fieldError = validateUserField(name, processedValue, { isUpdate: false }, t);
        setErrors(prev => ({
            ...prev,
            [name]: fieldError
        }));
    };

    const handleSubmit = async () => {
        // Validate entire form using schema
        const validation = validateUser(formData, { isUpdate: false }, t);

        if (!validation.isValid) {
            setErrors(validation.errors);

            // Show alert with first error for better UX
            const firstError = Object.values(validation.errors)[0];
            alert(t('users.pleaseFixErrors', 'Please fix the following errors:') + '\n' + firstError);
            return;
        }

        setIsLoading(true);
        setErrors({}); // Clear any previous errors

        try {

            // Get Firebase config from environment variables
            const firebaseConfig = {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID
            };

            // Create secondary app instance with unique name
            const timestamp = Date.now();
            const secondaryApp = initializeApp(firebaseConfig, `CreateUser_${timestamp}`);
            const secondaryAuth = getAuth(secondaryApp);

            try {
                // Create user with secondary auth instance
                const userCredential = await createUserWithEmailAndPassword(
                    secondaryAuth,
                    formData.email,
                    '123456' // Default password - consider making this configurable
                );

                const uid = userCredential.user.uid;

                // Prepare user data for Firestore using schema
                const userDoc = prepareUserForFirestore(formData, false);

                // Create the document using the UID from Firebase Auth
                await setDoc(doc(db, 'users', uid), userDoc);

                // Verification: Read back the document
                const verificationDoc = await getDoc(doc(db, 'users', uid));
                if (verificationDoc.exists()) {
                    const verificationData = verificationDoc.data();
                } else {
                    console.error('❌ VERIFICATION: Document was not created properly');
                    throw new Error('User document verification failed');
                }

                // Clean up secondary app
                await deleteApp(secondaryApp);

                // Reset form
                setFormData(createEmptyUser());
                setErrors({});

                // Show success message with translations
                alert(
                    `✅ ${t('users.createSuccess', 'SUCCESS!')}\n\n` +
                    `${t('users.userCreated', 'User has been created successfully!')}\n\n` +
                    `📧 ${t('users.email', 'Email')}: ${formData.email}\n` +
                    `👤 ${t('users.role', 'Role')}: ${t(`users.${formData.role}`, formData.role)}\n` +
                    `🆔 ${t('users.userId', 'User ID')}: ${uid}\n\n` +
                    `${t('users.defaultPassword', 'Default password')}: 123456`
                );

                // Notify parent component
                if (onUserCreated) {
                    onUserCreated();
                }
                onClose();

            } catch (userCreationError) {
                // Clean up secondary app on error
                try {
                    await deleteApp(secondaryApp);
                } catch (cleanupError) {
                    console.warn('Error cleaning up secondary app:', cleanupError);
                }
                throw userCreationError;
            }

        } catch (error) {
            console.error('Error creating user:', error);

            // Handle specific Firebase errors with proper translations
            if (error.code === 'auth/email-already-in-use') {
                setErrors({ email: t('users.emailInUse', 'This email is already registered') });
            } else if (error.code === 'auth/invalid-email') {
                setErrors({ email: t('users.emailInvalid', 'Invalid email address') });
            } else if (error.code === 'auth/weak-password') {
                setErrors({ general: t('users.weakPassword', 'Password is too weak') });
            } else if (error.code === 'app/duplicate-app') {
                setErrors({
                    general: t('users.tryAgain', 'Please wait a moment and try again.')
                });
            } else {
                setErrors({
                    general: t('users.createError', 'Failed to create user. Please try again.')
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setFormData(createEmptyUser());
            setErrors({});
            onClose();
        }
    };

    // Check if form has errors
    const hasFormErrors = Object.keys(errors).some(key => errors[key]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="form-creation-modal-overlay" dir={isRTL ? 'rtl' : 'ltr'}>
            <div 
                className="form-creation-modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-user-modal-title"
            >
                <div className="form-creation-modal-header">
                    <h3 id="create-user-modal-title">
                        <UserPlus size={24} />
                        {t('users.createNewUser', 'Create New User')}
                    </h3>
                    <button
                        className="form-creation-modal-close"
                        onClick={handleClose}
                        disabled={isLoading}
                        type="button"
                        aria-label={t('common.close', 'Close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="form-creation-modal-body">
                    {errors.general && (
                        <div className="error-alert" role="alert">
                            {errors.general}
                        </div>
                    )}

                    {/* Basic User Information */}
                    <div className="form-section">
                        <h4>
                            <User size={18} />
                            {t('users.basicInformation', 'Basic Information')}
                        </h4>

                        <div className="form-grid">
                            <div className={`form-group ${errors.displayName ? 'error' : ''}`}>
                                <label htmlFor="displayName">
                                    {t('users.displayName', 'Display Name')} *
                                </label>
                                <input
                                    type="text"
                                    id="displayName"
                                    name="displayName"
                                    value={formData.displayName}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    placeholder={t('users.displayNamePlaceholder', 'Enter display name')}
                                    className="form-input"
                                    aria-describedby={errors.displayName ? 'displayName-error' : undefined}
                                    aria-invalid={!!errors.displayName}
                                />
                                {errors.displayName && (
                                    <div id="displayName-error" className="error-text" role="alert">
                                        {errors.displayName}
                                    </div>
                                )}
                            </div>

                            <div className={`form-group ${errors.name ? 'error' : ''}`}>
                                <label htmlFor="name">
                                    {t('users.fullName', 'Full Name')} *
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    placeholder={t('users.fullNamePlaceholder', 'Enter full name')}
                                    className="form-input"
                                    aria-describedby={errors.name ? 'name-error' : undefined}
                                    aria-invalid={!!errors.name}
                                />
                                {errors.name && (
                                    <div id="name-error" className="error-text" role="alert">
                                        {errors.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Account Information */}
                    <div className="form-section">
                        <h4>
                            <Mail size={18} />
                            {t('users.accountInformation', 'Account Information')}
                        </h4>

                        <div className="form-grid">
                            <div className={`form-group ${errors.email ? 'error' : ''}`}>
                                <label htmlFor="email">
                                    {t('users.emailAddress', 'Email Address')} *
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    placeholder={t('users.emailPlaceholder', 'Enter email address')}
                                    className="form-input"
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    aria-invalid={!!errors.email}
                                />
                                {errors.email && (
                                    <div id="email-error" className="error-text" role="alert">
                                        {errors.email}
                                    </div>
                                )}
                                <small className="field-hint">
                                    {t('users.emailHint', 'This will be used for login and notifications')}
                                </small>
                            </div>

                            <div className="form-group">
                                <label>
                                    <Key size={16} />
                                    {t('users.defaultPassword', 'Default Password')}
                                </label>
                                <input
                                    type="text"
                                    value="123456"
                                    disabled={true}
                                    className="form-input"
                                    style={{
                                        backgroundColor: 'var(--input-disabled-bg)',
                                        cursor: 'not-allowed',
                                        opacity: 0.6
                                    }}
                                />
                                <small className="field-hint">
                                    {t('users.passwordHint', 'User can change this password after first login')}
                                </small>
                            </div>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="form-section">
                        <h4>
                            <Phone size={18} />
                            {t('users.contactInformation', 'Contact Information')}
                        </h4>

                        <div className="form-grid">
                            <div className={`form-group ${errors.phone ? 'error' : ''}`}>
                                <label htmlFor="phone">
                                    {t('users.phoneNumber', 'Phone Number')} *
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    placeholder={t('users.phoneNumberPlaceholder', 'Enter phone number')}
                                    maxLength="10"
                                    className="form-input"
                                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                                    aria-invalid={!!errors.phone}
                                />
                                {errors.phone && (
                                    <div id="phone-error" className="error-text" role="alert">
                                        {errors.phone}
                                    </div>
                                )}
                                <small className="field-hint">
                                    {t('users.phoneHint', 'Israeli phone number (10 digits)')}
                                </small>
                            </div>
                        </div>
                    </div>

                    {/* Role & Permissions */}
                    <div className="form-section">
                        <h4>
                            <Shield size={18} />
                            {t('users.rolePermissions', 'Role & Permissions')}
                        </h4>

                        <div className="form-grid">
                            <div className={`form-group ${errors.role ? 'error' : ''}`}>
                                <label htmlFor="role">
                                    {t('users.role', 'Role')} *
                                </label>
                                <select
                                    id="role"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                    className="form-select"
                                    aria-describedby={errors.role ? 'role-error' : undefined}
                                    aria-invalid={!!errors.role}
                                >
                                    <option value={USER_ROLES.PARENT}>{t('users.parent', 'Parent')}</option>
                                    <option value={USER_ROLES.INSTRUCTOR}>{t('users.instructor', 'Instructor')}</option>
                                    <option value={USER_ROLES.ADMIN}>{t('users.admin', 'Admin')}</option>
                                    <option value={USER_ROLES.HOST}>{t('users.host', 'Host')}</option>
                                </select>
                                {errors.role && (
                                    <div id="role-error" className="error-text" role="alert">
                                        {errors.role}
                                    </div>
                                )}
                                <small className="field-hint">
                                    {t('users.roleHint', 'Select the appropriate role for this user')}
                                </small>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-creation-modal-footer">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        {t('general.cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSubmit}
                        disabled={isLoading || hasFormErrors}
                    >
                        {isLoading ? (
                            <>
                                <div className="loading-spinner-mini" aria-hidden="true"></div>
                                {t('users.creating', 'Creating...')}
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                {t('users.createUser', 'Create User')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateUserModal;