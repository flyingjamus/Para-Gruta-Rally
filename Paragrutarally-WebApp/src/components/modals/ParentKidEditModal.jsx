// src/components/modals/ParentKidEditModal.jsx - Enhanced with Comprehensive Validation
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

import {
    IconX as X,
    IconDeviceFloppy as Save,
    IconUserCircle as Baby,
    IconHeart as Heart,
    IconCamera as Camera,
    IconTrash as Trash2,
    IconEdit as Edit,
    IconSparkles as Sparkles,
    IconPhone as Phone,
    IconMapPin as MapPin,
    IconUser as User,
    IconUsers as Users,
    IconAlertTriangle as Alert,
    IconCheck as Check,
    IconExclamationCircle as Warning
} from '@tabler/icons-react';
import { updateKid } from '@/services/kidService.js';
import { uploadKidPhoto, deleteKidPhoto, getKidPhotoInfo } from '../../services/kidPhotoService.js';
import { validateKid, getKidFullName } from '@/schemas/kidSchema.js';
import './ParentKidEditModal.css';

const ParentKidEditModal = ({ kid, isOpen, onClose, onSuccess }) => {
    const { t, isRTL } = useLanguage();

    const [formData, setFormData] = useState({
        personalInfo: {
            firstName: '',
            lastName: '',
            announcersNotes: '',
            address: '',
            photo: ''
        },
        parentInfo: {
            name: '',
            phone: '',
            grandparentsInfo: {
                names: '',
                phone: ''
            }
        }
    });

    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationStatus, setValidationStatus] = useState('pending'); // 'pending', 'valid', 'invalid'

    // Photo upload state
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoError, setPhotoError] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    // Real-time validation
    const [hasUserInteracted, setHasUserInteracted] = useState(false);

    // Initialize form data when modal opens or kid changes
    useEffect(() => {
        if (isOpen && kid) {
            setFormData({
                personalInfo: {
                    firstName: kid.personalInfo?.firstName || '',
                    lastName: kid.personalInfo?.lastName || '',
                    announcersNotes: kid.personalInfo?.announcersNotes || '',
                    address: kid.personalInfo?.address || '',
                    photo: kid.personalInfo?.photo || ''
                },
                parentInfo: {
                    name: kid.parentInfo?.name || '',
                    phone: kid.parentInfo?.phone || '',
                    grandparentsInfo: {
                        names: kid.parentInfo?.grandparentsInfo?.names || '',
                        phone: kid.parentInfo?.grandparentsInfo?.phone || ''
                    }
                }
            });

            // Set photo preview if exists
            const photoInfo = getKidPhotoInfo(kid);
            if (photoInfo.hasPhoto) {
                setPhotoPreview(photoInfo.url);
            } else {
                setPhotoPreview(null);
            }

            // Reset state
            setSelectedPhoto(null);
            setPhotoError('');
            setErrors({});
            setWarnings({});
            setValidationStatus('pending');
            setHasUserInteracted(false);
            setIsSubmitting(false);
            setIsUploadingPhoto(false);
        }
    }, [isOpen, kid]);

    // Real-time validation when form data changes
    useEffect(() => {
        if (hasUserInteracted && isOpen && kid) {
            validateFormData();
        }
    }, [formData, hasUserInteracted, isOpen, kid]);

    if (!isOpen || !kid) return null;

    const validateFormData = () => {


        // Create full kid object for validation by merging with existing data
        const fullKidData = {
            ...kid,
            personalInfo: {
                ...kid.personalInfo,
                ...formData.personalInfo
            },
            parentInfo: {
                ...kid.parentInfo,
                ...formData.parentInfo
            }
        };

        const validation = validateKid(fullKidData, t);


        // Only show errors for fields we're editing
        const editableFields = [
            'personalInfo.firstName',
            'personalInfo.lastName',
            'personalInfo.announcersNotes',
            'personalInfo.address',
            'parentInfo.name',
            'parentInfo.phone',
            'parentInfo.grandparentsInfo.names',
            'parentInfo.grandparentsInfo.phone'
        ];

        const relevantErrors = {};
        editableFields.forEach(field => {
            if (validation.errors[field]) {
                relevantErrors[field] = validation.errors[field];
            }
        });

        // Generate warnings for this form
        const formWarnings = {};

        // Check for empty optional fields that are commonly filled
        if (!formData.personalInfo.address?.trim()) {
            formWarnings['personalInfo.address'] = t('parentKidEdit.warning.addressEmpty', 'Address helps with logistics and emergency contact');
        }

        if (!formData.personalInfo.announcersNotes?.trim()) {
            formWarnings['personalInfo.announcersNotes'] = t('parentKidEdit.warning.announcerNotesEmpty', 'Fun facts make the race more exciting for everyone!');
        }

        if (!formData.parentInfo.grandparentsInfo.names?.trim()) {
            formWarnings['parentInfo.grandparentsInfo.names'] = t('parentKidEdit.warning.grandparentsEmpty', 'Grandparents info can be helpful for emergencies');
        }

        // Parent phone validation
        if (formData.parentInfo.phone && !relevantErrors['parentInfo.phone']) {
            const digitsOnly = formData.parentInfo.phone.replace(/\D/g, '');

            if (digitsOnly.length > 0) {
                // Check if it starts with 05
                if (!digitsOnly.startsWith('05')) {
                    formWarnings['parentInfo.phone'] = t('parentKidEdit.phoneValidation.mustStartWith05', 'Phone number must start with 05');
                }
                // Check if first 3 digits match Israeli format
                else {
                    const validPrefixes = ['050', '052', '053', '054', '055', '057', '058', '059'];
                    const firstThreeDigits = digitsOnly.substring(0, 3);

                    if (!validPrefixes.includes(firstThreeDigits)) {
                        formWarnings['parentInfo.phone'] = t('parentKidEdit.phoneValidation.wrongFormat', 'Phone number must start with 050, 052, 053, 054, 055, 057, 058, or 059');
                    }
                    // Only check length if prefix is valid
                    else if (digitsOnly.length !== 10) {
                        formWarnings['parentInfo.phone'] = t('parentKidEdit.phoneValidation.wrongLength', 'Phone number must be exactly 10 digits');
                    }
                }
            }
        }

        // Grandparents phone validation
        if (formData.parentInfo.grandparentsInfo.phone && !relevantErrors['parentInfo.grandparentsInfo.phone']) {
            const digitsOnly = formData.parentInfo.grandparentsInfo.phone.replace(/\D/g, '');

            if (digitsOnly.length > 0) {
                // Check if it starts with 05
                if (!digitsOnly.startsWith('05')) {
                    formWarnings['parentInfo.grandparentsInfo.phone'] = t('parentKidEdit.phoneValidation.mustStartWith05', 'Phone number must start with 05');
                }
                // Check if first 3 digits match Israeli format
                else {
                    const validPrefixes = ['050', '052', '053', '054', '055', '057', '058', '059'];
                    const firstThreeDigits = digitsOnly.substring(0, 3);

                    if (!validPrefixes.includes(firstThreeDigits)) {
                        formWarnings['parentInfo.grandparentsInfo.phone'] = t('parentKidEdit.phoneValidation.wrongFormat', 'Phone number must start with 050, 052, 053, 054, 055, 057, 058, or 059');
                    }
                    // Only check length if prefix is valid
                    else if (digitsOnly.length !== 10) {
                        formWarnings['parentInfo.grandparentsInfo.phone'] = t('parentKidEdit.phoneValidation.wrongLength', 'Phone number must be exactly 10 digits');
                    }
                }
            }
        }

        setErrors(relevantErrors);
        setWarnings(formWarnings);

        // Update validation status
        if (Object.keys(relevantErrors).length === 0) {
            setValidationStatus('valid');
        } else {
            setValidationStatus('invalid');
        }

    };

    const handleInputChange = (path, value) => {
        if (!hasUserInteracted) {
            setHasUserInteracted(true);
        }

        setFormData(prev => {
            const newData = { ...prev };
            const keys = path.split('.');
            let current = newData;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
            return newData;
        });

        // Clear specific error for this field
        if (errors[path]) {
            setErrors(prev => ({
                ...prev,
                [path]: undefined
            }));
        }

        // Clear specific warning for this field if user is actively filling it
        if (warnings[path] && value?.trim()) {
            setWarnings(prev => ({
                ...prev,
                [path]: undefined
            }));
        }
    };

    const handleClose = () => {
        // Reset all validation state when closing
        setErrors({});
        setWarnings({});
        setValidationStatus('pending');
        setHasUserInteracted(false);
        setPhotoError('');
        setSelectedPhoto(null);
        setIsSubmitting(false);
        setIsUploadingPhoto(false);

        // Call the original onClose
        onClose();
    };

    const handlePhotoSelection = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setPhotoError('');

        try {
            // Basic validation
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                setPhotoError(t('parentKidEdit.photoError.invalidType', 'Please upload a JPEG, PNG, or WebP image file.'));
                return;
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                setPhotoError(t('parentKidEdit.photoError.tooLarge', 'Photo file size must be less than 5MB.'));
                return;
            }

            setSelectedPhoto(file);

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setPhotoPreview(e.target.result);
            };
            reader.readAsDataURL(file);

        } catch (error) {
            console.error('Error processing photo:', error);
            setPhotoError(t('parentKidEdit.photoError.processingFailed', 'Failed to process photo. Please try again.'));
        }
    };

    const handleRemovePhoto = async () => {
        try {
            // Delete photo from storage if it exists
            if (formData.personalInfo?.photo) {

                await deleteKidPhoto(kid.id, formData.personalInfo.photo);

            }

            // Update form data
            setFormData(prev => ({
                ...prev,
                personalInfo: {
                    ...prev.personalInfo,
                    photo: ''
                }
            }));

            // Clear local state
            setSelectedPhoto(null);
            setPhotoPreview(null);
            setPhotoError('');

            // Clear file input
            const fileInput = document.getElementById('parent-photo-upload');
            if (fileInput) fileInput.value = '';

        } catch (error) {
            console.error('❌ Error removing photo:', error);
            setPhotoError(t('parentKidEdit.photoError.removeFailed', 'Failed to remove photo. Please try again.'));
        }
    };

    const validateForm = () => {
        setHasUserInteracted(true);
        validateFormData();
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            const errorMessages = Object.values(errors).join('\n');
            alert(t('parentKidEdit.validation.fixErrors', 'Please fix the following errors:') + '\n' + errorMessages);
            return;
        }

        setIsSubmitting(true);
        let finalFormData = { ...formData };

        try {
            // Upload photo if one was selected
            if (selectedPhoto) {
                try {
                    setIsUploadingPhoto(true);

                    // Delete old photo first if it exists
                    if (formData.personalInfo?.photo) {

                        try {
                            await deleteKidPhoto(kid.id, formData.personalInfo.photo);

                        } catch (deleteError) {
                            console.warn('⚠️ Failed to delete old photo:', deleteError.message);
                        }
                    }

                    // Upload new photo
                    const photoUrl = await uploadKidPhoto(kid.id, selectedPhoto);
                    finalFormData = {
                        ...finalFormData,
                        personalInfo: {
                            ...finalFormData.personalInfo,
                            photo: photoUrl
                        }
                    };
                } catch (photoError) {
                    console.error('❌ Photo upload failed:', photoError);
                    alert(t('parentKidEdit.photoUploadError', 'Photo upload failed: {error}. Your other changes will still be saved.', { error: photoError.message }));
                } finally {
                    setIsUploadingPhoto(false);
                }
            }

            // Create the update object with only the changed fields
            const updateData = {
                ...kid,
                personalInfo: {
                    ...kid.personalInfo,
                    ...finalFormData.personalInfo
                },
                parentInfo: {
                    ...kid.parentInfo,
                    ...finalFormData.parentInfo
                }
            };


            // Update the kid using the service (which includes validation)
            await updateKid(kid.id, updateData, t);


            // Success callback
            if (onSuccess) {
                const kidName = getKidFullName(updateData, t);
                const successMessage = kidName !== t('common.unnamedKid', 'Unnamed Kid')
                    ? t('parentKidEdit.updateSuccess', '{firstName}\'s information has been updated successfully! 🎉', { firstName: kidName })
                    : t('parentKidEdit.updateSuccessGeneric', 'Information has been updated successfully! 🎉');

                onSuccess(successMessage);
            }

            onClose();

        } catch (error) {
            console.error('❌ Error updating kid:', error);

            // Provide specific error messages
            let errorMessage = error.message;
            if (error.message.includes('Validation failed')) {
                errorMessage = t('parentKidEdit.validationError', 'The information provided is not valid. Please check all fields and try again.');
            } else if (error.message.includes('Permission denied')) {
                errorMessage = t('parentKidEdit.permissionError', 'You do not have permission to update this information.');
            } else if (error.message.includes('not found')) {
                errorMessage = t('parentKidEdit.notFoundError', 'The child\'s record could not be found. Please refresh and try again.');
            }

            alert(t('parentKidEdit.updateError', 'Failed to update information: {error}', { error: errorMessage }));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get photo display info
    const getPhotoDisplay = () => {
        if (photoPreview) {
            return {
                hasPhoto: true,
                url: photoPreview,
                placeholder: null
            };
        }

        const firstName = formData.personalInfo?.firstName || kid.personalInfo?.firstName || '';
        const lastName = formData.personalInfo?.lastName || kid.personalInfo?.lastName || '';
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || kid.participantNumber?.charAt(0) || '?';

        return {
            hasPhoto: false,
            url: null,
            placeholder: initials
        };
    };

    const getFieldError = (fieldPath) => {
        return errors[fieldPath];
    };

    const getFieldWarning = (fieldPath) => {
        return warnings[fieldPath];
    };

    const renderField = (fieldPath, label, icon, type = 'text', required = false, props = {}) => {
        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], formData) || '';
        const error = getFieldError(fieldPath);
        const warning = getFieldWarning(fieldPath);
        const hasIssue = error || warning;

        return (
            <div className="edit-group">
                <label className="edit-label">
                    {icon}
                    {label} {required && '*'}
                    {error && <Warning size={14} style={{ color: '#EF4444', marginLeft: '5px' }} />}
                    {!error && warning && <Alert size={14} style={{ color: '#F59E0B', marginLeft: '5px' }} />}
                </label>

                {type === 'textarea' ? (
                    <textarea
                        className={`edit-textarea ${error ? 'error' : warning ? 'warning' : ''}`}
                        value={value}
                        onChange={(e) => handleInputChange(fieldPath, e.target.value)}
                        {...props}
                    />
                ) : (
                    <input
                        type={type}
                        className={`edit-input ${error ? 'error' : warning ? 'warning' : ''}`}
                        value={value}
                        onChange={(e) => handleInputChange(fieldPath, e.target.value)}
                        {...props}
                    />
                )}

                {error && (
                    <span className="error-text">
                        <Warning size={12} style={{ marginRight: '4px' }} />
                        {error}
                    </span>
                )}

                {!error && warning && (
                    <span className="warning-text" style={{ color: '#F59E0B', fontSize: '12px', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                        <Alert size={12} style={{ marginRight: '4px' }} />
                        {warning}
                    </span>
                )}
            </div>
        );
    };

    const photoDisplay = getPhotoDisplay();
    const firstName = formData.personalInfo?.firstName || kid.personalInfo?.firstName;
    const hasValidationIssues = Object.keys(errors).length > 0;
    const hasWarnings = Object.keys(warnings).length > 0;

    return (
        <div className="parent-kid-edit-overlay" onClick={handleClose}>
            <div className="parent-kid-edit-modal" data-testid="parent-kid-edit-modal" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>

                {/* Header */}
                <header className="edit-modal-header">
                    <div className="edit-header-content">
                        <div className="edit-title-section">
                            <Edit size={28} className="edit-icon" />
                            <h1 className="edit-title">
                                {firstName
                                    ? t('parentKidEdit.title', 'Edit {firstName}\'s Information', { firstName })
                                    : t('parentKidEdit.titleGeneric', 'Edit Information')
                                }
                            </h1>

                            {/* Validation Status Indicator */}
                            {hasUserInteracted && (
                                <div className="validation-status" style={{ marginLeft: '15px' }}>
                                    {validationStatus === 'valid' && (
                                        <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                                            <Check size={16} style={{ marginRight: '5px' }} />
                                            {t('parentKidEdit.validationValid', 'All fields valid')}
                                        </span>
                                    )}
                                    {validationStatus === 'invalid' && (
                                        <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                                            <Warning size={16} style={{ marginRight: '5px' }} />
                                            {t('parentKidEdit.validationErrors', 'Please fix errors')}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <button className="edit-close-btn" onClick={handleClose}>
                        <X size={24} />
                    </button>
                </header>

                {/* Validation Summary Alert */}
                {hasUserInteracted && (hasValidationIssues || hasWarnings) && (
                    <div className={`validation-summary ${hasValidationIssues ? 'error' : 'warning'}`}
                         style={{
                             margin: '15px 20px',
                             padding: '15px',
                             borderRadius: '8px',
                             backgroundColor: hasValidationIssues ? '#FEF2F2' : '#FFFBEB',
                             border: hasValidationIssues ? '1px solid #FECACA' : '1px solid #FED7AA'
                         }}>
                        {hasValidationIssues ? (
                            <div style={{ color: '#EF4444', display: 'flex', alignItems: 'flex-start' }}>
                                <Warning size={20} style={{ marginRight: '10px', marginTop: '2px', flexShrink: 0 }} />
                                <div>
                                    <strong>{t('parentKidEdit.errorsFound', 'Errors Found')}</strong>
                                    <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
                                        {t('parentKidEdit.errorsDescription', 'Please fix the highlighted fields before saving.')}
                                    </p>
                                </div>
                            </div>
                        ) : hasWarnings ? (
                            <div style={{ color: '#F59E0B', display: 'flex', alignItems: 'flex-start' }}>
                                <Alert size={20} style={{ marginRight: '10px', marginTop: '2px', flexShrink: 0 }} />
                                <div>
                                    <strong>{t('parentKidEdit.suggestionsAvailable', 'Suggestions Available')}</strong>
                                    <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
                                        {t('parentKidEdit.suggestionsDescription', 'Consider filling in the suggested fields for a complete profile.')}
                                    </p>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Form Content */}
                <main className="edit-modal-body">
                    <form onSubmit={handleSubmit} className="edit-form">

                        {/* Photo and Basic Info Section */}
                        <section className="edit-section">
                            <div className="section-header">
                                <Baby size={20} />
                                <h2>{t('parentKidEdit.basicInfo', 'Basic Information')}</h2>
                            </div>

                            <div className="edit-grid">
                                {/* Photo Upload */}
                                <div className="edit-group full-width">
                                    <label className="edit-label">{t('parentKidEdit.photo', 'Photo')}</label>
                                    <div className="photo-section">
                                        <div className="photo-container">
                                            {photoDisplay.hasPhoto ? (
                                                <img
                                                    src={photoDisplay.url}
                                                    alt={t('parentKidEdit.photoAlt', 'Kid preview')}
                                                    className="kid-photo"
                                                />
                                            ) : (
                                                <div className="kid-photo-placeholder">
                                                    {photoDisplay.placeholder}
                                                </div>
                                            )}
                                        </div>

                                        <div className="photo-actions">
                                            <button
                                                type="button"
                                                className="photo-btn upload-btn"
                                                onClick={() => document.getElementById('parent-photo-upload').click()}
                                            >
                                                <Camera size={16} />
                                                {photoDisplay.hasPhoto ? t('parentKidEdit.changePhoto', 'Change') : t('parentKidEdit.uploadPhoto', 'Upload')}
                                            </button>

                                            {photoDisplay.hasPhoto && (
                                                <button
                                                    type="button"
                                                    className="photo-btn remove-btn"
                                                    onClick={handleRemovePhoto}
                                                >
                                                    <Trash2 size={16} />
                                                    {t('parentKidEdit.removePhoto', 'Remove')}
                                                </button>
                                            )}
                                        </div>

                                        <input
                                            id="parent-photo-upload"
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            onChange={handlePhotoSelection}
                                            style={{ display: 'none' }}
                                        />

                                        {photoError && (
                                            <p className="photo-error" style={{ color: '#EF4444', fontSize: '12px', marginTop: '8px', display: 'flex', alignItems: 'center' }}>
                                                <Warning size={14} style={{ marginRight: '5px' }} />
                                                {photoError}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* First Name */}
                                {renderField(
                                    'personalInfo.firstName',
                                    t('parentKidEdit.firstName', 'First Name'),
                                    <User size={16} />,
                                    'text',
                                    true,
                                    { placeholder: t('parentKidEdit.firstNamePlaceholder', 'Enter first name') }
                                )}

                                {/* Last Name */}
                                {renderField(
                                    'personalInfo.lastName',
                                    t('parentKidEdit.lastName', 'Last Name'),
                                    <Users size={16} />,
                                    'text',
                                    true,
                                    { placeholder: t('parentKidEdit.lastNamePlaceholder', 'Enter last name') }
                                )}

                                {/* Address */}
                                <div className="edit-group full-width">
                                    {renderField(
                                        'personalInfo.address',
                                        t('parentKidEdit.address', 'Address'),
                                        <MapPin size={16} />,
                                        'text',
                                        false,
                                        { placeholder: t('parentKidEdit.addressPlaceholder', 'Enter home address') }
                                    )}
                                </div>

                                {/* Announcer Notes */}
                                <div className="edit-group full-width">
                                    {renderField(
                                        'personalInfo.announcersNotes',
                                        t('parentKidEdit.announcerNotes', 'Announcer Notes'),
                                        <Sparkles size={16} />,
                                        'textarea',
                                        false,
                                        {
                                            placeholder: t('parentKidEdit.announcerNotesPlaceholder', 'Fun facts to share during the race!'),
                                            rows: 3
                                        }
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Parent Information Section */}
                        <section className="edit-section">
                            <div className="section-header">
                                <Heart size={20} />
                                <h2>{t('parentKidEdit.parentInfo', 'Parent Information')}</h2>
                            </div>

                            <div className="edit-grid">
                                {/* Parent Name */}
                                {renderField(
                                    'parentInfo.name',
                                    t('parentKidEdit.parentName', 'Parent Name'),
                                    <User size={16} />,
                                    'text',
                                    true,
                                    { placeholder: t('parentKidEdit.parentNamePlaceholder', 'Enter parent name') }
                                )}

                                {/* Parent Phone */}
                                {renderField(
                                    'parentInfo.phone',
                                    t('parentKidEdit.parentPhone', 'Parent Phone'),
                                    <Phone size={16} />,
                                    'tel',
                                    true,
                                    { placeholder: t('parentKidEdit.parentPhonePlaceholder', 'Enter phone number') }
                                )}

                                {/* Grandparents Names */}
                                {renderField(
                                    'parentInfo.grandparentsInfo.names',
                                    t('parentKidEdit.grandparentsNames', 'Grandparents Names'),
                                    <Users size={16} />,
                                    'text',
                                    false,
                                    { placeholder: t('parentKidEdit.grandparentsNamesPlaceholder', 'Enter grandparents names') }
                                )}

                                {/* Grandparents Phone */}
                                {renderField(
                                    'parentInfo.grandparentsInfo.phone',
                                    t('parentKidEdit.grandparentsPhone', 'Grandparents Phone'),
                                    <Phone size={16} />,
                                    'tel',
                                    false,
                                    { placeholder: t('parentKidEdit.grandparentsPhonePlaceholder', 'Enter grandparents phone') }
                                )}
                            </div>
                        </section>

                    </form>
                </main>

                {/* Footer */}
                <footer className="edit-modal-footer">
                    <button type="button" className="edit-btn cancel-btn" onClick={handleClose}>
                        {t('parentKidEdit.cancel', 'Cancel')}
                    </button>

                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting || isUploadingPhoto || hasValidationIssues}
                        className={`edit-btn save-btn ${hasValidationIssues ? 'disabled' : ''}`}
                        title={hasValidationIssues ? t('parentKidEdit.fixErrorsFirst', 'Please fix errors before saving') : ''}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="loading-spinner-mini"></div>
                                {isUploadingPhoto
                                    ? t('parentKidEdit.uploadingPhoto', 'Uploading Photo...')
                                    : t('parentKidEdit.saving', 'Saving...')
                                }
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                {t('parentKidEdit.saveChanges', 'Save Changes')}
                                {hasValidationIssues && (
                                    <Warning size={16} style={{ marginLeft: '8px', color: '#EF4444' }} />
                                )}
                            </>
                        )}
                    </button>
                </footer>

            </div>
        </div>
    );
};

export default ParentKidEditModal;