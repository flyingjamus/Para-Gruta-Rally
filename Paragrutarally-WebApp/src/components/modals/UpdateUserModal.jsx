// src/components/modals/UpdateUserModal.jsx - UPDATED WITH CLEAN MODAL STRUCTURE
import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useLanguage } from '../../contexts/LanguageContext';
import { db } from '../../firebase/config';
import {
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
    IconUserEdit as UserEdit
} from '@tabler/icons-react';

const UpdateUserModal = ({ isOpen, onClose, user, onUserUpdated }) => {
    const { t, isRTL } = useLanguage();
    const [formData, setFormData] = useState({
        displayName: '',
        name: '',
        phone: '',
        role: USER_ROLES.PARENT
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    // Populate form with user data when modal opens
    useEffect(() => {
        if (user && isOpen) {

            setFormData({
                displayName: user.displayName || '',
                name: user.name || '',
                phone: user.phone || '',
                role: user.role || USER_ROLES.PARENT
            });
            setErrors({}); // Clear any previous errors
        }
    }, [user, isOpen]);

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
        const fieldError = validateUserField(name, processedValue, { isUpdate: true }, t);
        setErrors(prev => ({
            ...prev,
            [name]: fieldError
        }));
    };

    const handleSubmit = async () => {
        if (!user?.id) {
            setErrors({ general: t('users.noUserSelected', 'No user selected for update') });
            return;
        }

        // Validate entire form using schema (isUpdate = true to skip email validation)
        const validation = validateUser(formData, { isUpdate: true }, t);

        if (!validation.isValid) {
            setErrors(validation.errors);

            // Show alert with first error for better UX
            const firstError = Object.values(validation.errors)[0];
            alert(t('users.pleaseFixErrors', 'Please fix the following errors:') + '\n' + firstError);
            return;
        }

        setIsLoading(true);

        try {


            // Prepare user data for Firestore using schema
            const updateData = prepareUserForFirestore(formData, true);


            // Update user document in Firestore
            const userDocRef = doc(db, 'users', user.id);
            await updateDoc(userDocRef, updateData);



            // Reset errors
            setErrors({});

            // Show success message
            alert(t('users.updateSuccess', 'User "{displayName}" updated successfully!', { displayName: formData.displayName }));

            // Notify parent component
            if (onUserUpdated) {
                onUserUpdated();
            }

            onClose();
        } catch (error) {
            console.error('Error updating user:', error);
            setErrors({
                general: t('users.updateError', 'Failed to update user. Please try again.')
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setErrors({});
            onClose();
        }
    };

    // Check if form has errors
    const hasFormErrors = Object.keys(errors).some(key => errors[key]);

    if (!isOpen || !user) {
        return null;
    }

    return (
        <div className="form-creation-modal-overlay" dir={isRTL ? 'rtl' : 'ltr'}>
            <div 
                className="form-creation-modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="update-user-modal-title"
            >
                <div className="form-creation-modal-header">
                    <h3 id="update-user-modal-title">
                        <UserEdit size={24} />
                        {t('users.updateUser', 'Update User')}
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

                            <div className="form-group full-width">
                                <label htmlFor="email">
                                    <Mail size={16} />
                                    {t('users.emailAddress', 'Email Address')}
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={user.email || ''}
                                    disabled={true}
                                    className="form-input"
                                    style={{
                                        backgroundColor: 'var(--input-disabled-bg)',
                                        cursor: 'not-allowed',
                                        opacity: 0.6
                                    }}
                                    placeholder={t('users.emailCannotChange', 'Email cannot be changed')}
                                />
                                <small className="field-hint">
                                    {t('users.emailLinkedToAuth', 'Email cannot be changed as it\'s linked to authentication')}
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
                                {t('users.updating', 'Updating...')}
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                {t('users.updateUserButton', 'Update User')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateUserModal;