// src/pages/admin/AddKidPage.jsx - Updated without Vehicle Assignment
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from '../../components/layout/Dashboard';
import CreateUserModal from '../../components/modals/CreateUserModal';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermissions } from '../../hooks/usePermissions.jsx';
import { addKid, getNextParticipantNumber } from '../../services/kidService';
import { getAllInstructors } from '../../services/teamService';
import { uploadKidPhoto, validatePhotoFile, resizeImage, getKidPhotoInfo } from '@/services/kidPhotoService.js';
import { createEmptyKid, validateKid, getFormStatusOptions } from '@/schemas/kidSchema.js';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { useLanguage } from '../../contexts/LanguageContext';
import { db } from '@/firebase/config.js';
import {
    IconUserCircle as Baby,
    IconPlus as Plus,
    IconArrowLeft as ArrowLeft,
    IconArrowRight as ArrowRight,
    IconCheck as Check,
    IconAlertTriangle as AlertTriangle,
    IconCar as Car,
    IconUser as User,
    IconUsers as Users,
    IconHeart as Heart,
    IconPhone as Phone,
    IconMail as Mail,
    IconMapPin as MapPin,
    IconCalendar as Calendar,
    IconNotes as FileText,
    IconSparkles as Sparkles,
    IconUserPlus as UserPlus,
    IconLock as Lock,
    IconCamera as Camera,
    IconUpload as Upload,
    IconX as X,
    IconTrash as Trash2
} from '@tabler/icons-react';
import './AddKidPage.css';

const AddKidPage = () => {
    const navigate = useNavigate();
    const { isDarkMode, appliedTheme } = useTheme();
    const { permissions, userRole } = usePermissions();
    const { t, isHebrew, isRTL } = useLanguage();
    const formStatusOptions = getFormStatusOptions(t);
    const [isLoading, setIsLoading] = useState(false);
    const [teams, setTeams] = useState([]);
    const [instructors, setInstructors] = useState([]);
    const [parents, setParents] = useState([]);
    const [formData, setFormData] = useState(createEmptyKid());
    const [errors, setErrors] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingError, setLoadingError] = useState(null);
    const [selectedTeamInstructor, setSelectedTeamInstructor] = useState('');
    const [loadingTeamInstructor, setLoadingTeamInstructor] = useState(false);

    // Parent selection state
    const [selectedParentId, setSelectedParentId] = useState('');
    const [selectedParentData, setSelectedParentData] = useState(null);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);

    // Photo upload state
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoError, setPhotoError] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const handleTeamSelection = async (teamId) => {
        // Update the form data
        handleInputChange('teamId', teamId);

        // Clear instructor info if no team selected
        if (!teamId) {
            setSelectedTeamInstructor('');
            setFormData(prev => ({
                ...prev,
                instructorId: ''
            }));
            return;
        }

        // Fetch team details to get instructor
        try {
            setLoadingTeamInstructor(true);

            const { getTeamWithDetails } = await import('../../services/teamService');
            const teamDetails = await getTeamWithDetails(teamId);

            if (teamDetails) {
                // Check if team has a team leader (primary instructor)
                if (teamDetails.teamLeader) {
                    setSelectedTeamInstructor(teamDetails.teamLeader.name || teamDetails.teamLeader.displayName || t('addKid.unknownInstructor', 'Unknown Instructor'));
                    setFormData(prev => ({
                        ...prev,
                        instructorId: teamDetails.teamLeader.id
                    }));
                }
                // If no team leader, check if there are instructors in the array
                else if (teamDetails.instructors && teamDetails.instructors.length > 0) {
                    const primaryInstructor = teamDetails.instructors[0];
                    setSelectedTeamInstructor(primaryInstructor.name || primaryInstructor.displayName || t('addKid.unknownInstructor', 'Unknown Instructor'));
                    setFormData(prev => ({
                        ...prev,
                        instructorId: primaryInstructor.id
                    }));
                }
                // No instructor assigned to team
                else {
                    setSelectedTeamInstructor(t('addKid.noInstructorAssignedToTeam', 'No instructor assigned to this team'));
                    setFormData(prev => ({
                        ...prev,
                        instructorId: ''
                    }));
                }
            }
        } catch (error) {
            console.error('Error fetching team instructor:', error);
            setSelectedTeamInstructor(t('addKid.errorLoadingInstructor', 'Error loading instructor'));
            setFormData(prev => ({
                ...prev,
                instructorId: ''
            }));
        } finally {
            setLoadingTeamInstructor(false);
        }
    };

    const loadInitialData = async () => {
        try {
            setIsLoading(true);
            setLoadingError(null);

            // Load participant number first
            try {
                const nextNumber = await getNextParticipantNumber();
                setFormData(prev => ({
                    ...prev,
                    participantNumber: nextNumber
                }));
            } catch (error) {
                console.error('Error loading participant number:', error);
                setFormData(prev => ({
                    ...prev,
                    participantNumber: '001'
                }));
            }

            // Load teams with better error handling
            try {
                const teamsQuery = collection(db, 'teams');
                const teamsSnapshot = await getDocs(teamsQuery);

                const teamsData = teamsSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .filter(team => team.active !== false);

                setTeams(teamsData);
            } catch (teamsError) {
                console.error('❌ Error loading teams:', teamsError);
                setTeams([]);
            }

            // Load instructors using the new service function
            try {
                const instructorsData = await getAllInstructors();
                setInstructors(instructorsData);
            } catch (instructorsError) {
                console.error('❌ Error loading instructors:', instructorsError);
                setInstructors([]);
            }

            // Load parents (users with parent role)
            try {
                const parentsQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'parent')
                );
                const parentsSnapshot = await getDocs(parentsQuery);
                const parentsData = parentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setParents(parentsData);
            } catch (parentsError) {
                console.error('❌ Error loading parents:', parentsError);
                setParents([]);
            }

        } catch (error) {
            console.error('❌ Error loading initial data:', error);
            setLoadingError(t('addKid.loadError', 'Some form data failed to load, but you can still create a kid. Please check your internet connection.'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (path, value) => {
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

        // Clear specific error when user starts typing
        if (fieldErrors[path]) {
            setFieldErrors(prev => ({
                ...prev,
                [path]: false
            }));
        }
        if (errors[path]) {
            setErrors(prev => ({
                ...prev,
                [path]: undefined
            }));
        }
    };

    // Handle photo upload
    const handlePhotoSelection = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setPhotoError('');

        try {
            // Basic validation
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                setPhotoError(t('addKid.photoError.invalidType', 'Please upload a JPEG, PNG, or WebP image file.'));
                return;
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                setPhotoError(t('addKid.photoError.tooLarge', 'Photo file size must be less than 5MB.'));
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
            setPhotoError(t('addKid.photoError.processingFailed', 'Failed to process photo. Please try again.'));
        }
    };

    // Remove photo function
    const handleRemovePhoto = () => {
        setSelectedPhoto(null);
        setPhotoPreview(null);
        setPhotoError('');
        // Reset file input
        const fileInput = document.getElementById('photo-upload');
        if (fileInput) fileInput.value = '';
    };

    // Handle parent selection
    const handleParentSelection = (parentId) => {
        if (parentId === 'create_new') {
            if (window.confirm(t('addKid.confirmCreateNewParent', 'This will open a form to create a new parent user. Continue?'))) {
                setShowCreateUserModal(true);
            }
            setSelectedParentId('');
            return;
        }

        setSelectedParentId(parentId);

        if (parentId) {
            const parent = parents.find(p => p.id === parentId);
            if (parent) {
                setSelectedParentData(parent);
                setFormData(prev => ({
                    ...prev,
                    parentInfo: {
                        ...prev.parentInfo,
                        name: parent.name || parent.displayName || '',
                        email: parent.email || '',
                        phone: parent.phone || '',
                        parentIds: [parent.id],
                        grandparentsInfo: prev.parentInfo.grandparentsInfo
                    }
                }));
            }
        } else {
            setSelectedParentData(null);
            setFormData(prev => ({
                ...prev,
                parentInfo: {
                    name: '',
                    email: '',
                    phone: '',
                    parentIds: [],
                    grandparentsInfo: prev.parentInfo.grandparentsInfo
                }
            }));
        }
    };

    // Handle new user created
    const handleUserCreated = () => {
        setShowCreateUserModal(false);
        loadInitialData();
    };

    // Helper function to get instructor display name
    const getInstructorDisplayName = (instructor) => {
        return instructor.displayName || instructor.name || instructor.email || t('addKid.unknownInstructor', 'Unknown Instructor');
    };

    const validateForm = () => {
        const validation = validateKid(formData);

        if (!validation.isValid) {
            setErrors(validation.errors);

            // Set field errors for visual indicators
            const newFieldErrors = {};
            Object.keys(validation.errors).forEach(field => {
                newFieldErrors[field] = true;
            });
            setFieldErrors(newFieldErrors);
        }

        return validation.isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            // First, create the kid
            const kidId = await addKid(formData);

            // Upload photo if one was selected
            if (selectedPhoto) {
                try {
                    setIsUploadingPhoto(true);
                    const photoUrl = await uploadKidPhoto(kidId, selectedPhoto);
                } catch (photoError) {
                    console.error('⚠️ Photo upload failed:', photoError);
                    // Don't fail the entire operation, just show a warning
                    alert(t('addKid.photoUploadWarning', 'Kid was created successfully, but photo upload failed: {error}. You can add a photo later by editing the kid.', { error: photoError.message }));
                } finally {
                    setIsUploadingPhoto(false);
                }
            }

            // Navigate to the new kid's view page with success message
            const firstName = formData.personalInfo.firstName || t('addKid.newRacer', 'New racer');
            navigate(`/admin/kids/view/${kidId}`, {
                state: {
                    message: t('addKid.successMessage', '🎉 {firstName} has been added to the race! Welcome to the team! 🏎️', { firstName }),
                    type: 'success'
                }
            });

        } catch (error) {
            console.error('❌ Error adding kid:', error);
            setErrors({ general: error.message || t('addKid.generalError', 'Failed to add kid. Please try again.') });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        navigate('/admin/kids');
    };

    // Get dynamic title for the section
    const getSectionTitle = () => {
        const firstName = formData.personalInfo.firstName;
        if (firstName && firstName.trim()) {
            return t('addKid.racerProfile', '🏎️ {firstName}\'s Profile', { firstName });
        }
        return t('addKid.racerProfileGeneric', '🏎️ Racer Profile');
    };

    // Get error message for a field
    const getErrorMessage = (fieldPath) => {
        return errors[fieldPath];
    };

    // Check if field has error
    const hasFieldError = (fieldPath) => {
        return fieldErrors[fieldPath] || false;
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

        // Generate placeholder initials
        const firstName = formData.personalInfo?.firstName || '';
        const lastName = formData.personalInfo?.lastName || '';
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || formData.participantNumber?.charAt(0) || '?';

        return {
            hasPhoto: false,
            url: null,
            placeholder: initials
        };
    };

    if (!permissions) {
        return (
            <Dashboard requiredRole={userRole}>
                <div className={`admin-page add-kid-page ${appliedTheme}-mode`}>
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>{t('common.loadingPermissions', 'Loading permissions...')}</p>
                    </div>
                </div>
            </Dashboard>
        );
    }

    const photoDisplay = getPhotoDisplay();

    return (
        <Dashboard requiredRole={userRole}>
            <div className={`admin-page add-kid-page ${appliedTheme}-mode`}>
                {/* Page Title - Outside container */}
                <button
                    onClick={handleCancel}
                    className={`back-button ${appliedTheme}-back-button ${isRTL ? 'rtl' : ''}`}>
                    {isHebrew ? (
                        <>
                            {t('addKid.backToKids', 'Back to Kids')}
                            <ArrowRight className="btn-icon" size={20} />
                        </>
                    ) : (
                        <>
                            <ArrowLeft className="btn-icon" size={20} />
                            {t('addKid.backToKids', 'Back to Kids')}
                        </>
                    )}
                </button>
                <div className="page-header">
                    <div className="title-section">
                        <h1>
                            <Baby size={32} className="page-title-icon" />
                            {t('addKid.title', 'Add A New Kid')}
                            <Sparkles size={24} className="sparkle-icon" />
                        </h1>
                    </div>
                </div>
                {/* Main Container */}
                <div className="admin-container add-kid-container">
                    {/* Racing Theme Header */}
                    <div className="racing-header">
                        <div className="header-content">
                            <div className="title-section">
                                <p className="subtitle">{t('addKid.subtitle', 'Let\'s get this future champion on the track! 🏁')}</p>
                            </div>
                        </div>
                    </div>

                    {errors.general && (
                        <div className="alert error-alert">
                            <AlertTriangle size={20} />
                            {errors.general}
                        </div>
                    )}

                    {loadingError && (
                        <div className="alert warning-alert">
                            <AlertTriangle size={20} />
                            {loadingError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="add-kid-form">
                        {/* Basic Info Section with Photo */}
                        <div className="form-section racing-section">
                            <div className="section-header">
                                <Baby className="section-icon" size={24} />
                                <h2>{getSectionTitle()}</h2>
                            </div>
                            <div className="form-grid">
                                {/* Enhanced Photo Upload Section */}
                                <div className="form-group full-width">
                                    <label className="form-label">{t('addKid.racingPhoto', '📸 Racing Photo')}</label>
                                    <div className="photo-upload-section">
                                        <div className="photo-preview-container">
                                            {/* Photo Display */}
                                            <div className="photo-display-wrapper">
                                                {photoDisplay.hasPhoto ? (
                                                    <img
                                                        src={photoDisplay.url}
                                                        alt={t('addKid.photoAlt', 'Kid preview')}
                                                        className="kid-photo"
                                                    />
                                                ) : (
                                                    <div className="kid-photo-placeholder">
                                                        {photoDisplay.placeholder}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons Below Photo */}
                                            <div className="photo-action-buttons">
                                                <button
                                                    type="button"
                                                    className="photo-action-btn upload-btn"
                                                    onClick={() => document.getElementById('photo-upload').click()}
                                                    title={photoDisplay.hasPhoto ? t('addKid.changePhoto', 'Change Photo') : t('addKid.uploadPhoto', 'Upload Photo')}
                                                >
                                                    <Camera size={18} />
                                                    <span className="btn-text">{photoDisplay.hasPhoto ? t('addKid.changePhoto', 'Change') : t('addKid.uploadPhoto', 'Upload')}</span>
                                                </button>

                                                {photoDisplay.hasPhoto && (
                                                    <button
                                                        type="button"
                                                        className="photo-action-btn remove-btn"
                                                        onClick={handleRemovePhoto}
                                                        title={t('addKid.removePhoto', 'Remove Photo')}
                                                    >
                                                        <Trash2 size={18} />
                                                        <span className="btn-text">{t('addKid.removePhoto', 'Remove')}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <input
                                            id="photo-upload"
                                            type="file"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            onChange={handlePhotoSelection}
                                            className="photo-upload-input"
                                            style={{ display: 'none' }}
                                        />

                                        <div className="photo-upload-info">
                                            <p>{t('addKid.photoRequirements', '📸 Upload a racing photo! (Max 5MB, JPEG/PNG)')}</p>
                                            {photoError && (
                                                <p className="photo-error">{photoError}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('addKid.raceNumber', '🏁 Race Number')} *</label>
                                    <input
                                        type="text"
                                        className={`form-input ${hasFieldError('participantNumber') ? 'error' : ''}`}
                                        placeholder={t('addKid.raceNumberPlaceholder', '001')}
                                        value={formData.participantNumber}
                                        onChange={(e) => handleInputChange('participantNumber', e.target.value)}
                                    />
                                    {getErrorMessage('participantNumber') && (
                                        <span className="error-text">{getErrorMessage('participantNumber')}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('addKid.firstName', '👤 First Name')} *</label>
                                    <input
                                        type="text"
                                        className={`form-input ${hasFieldError('personalInfo.firstName') ? 'error' : ''}`}
                                        placeholder={t('addKid.firstNamePlaceholder', 'Future champion\'s first name')}
                                        value={formData.personalInfo.firstName}
                                        onChange={(e) => handleInputChange('personalInfo.firstName', e.target.value)}
                                    />
                                    {getErrorMessage('personalInfo.firstName') && (
                                        <span className="error-text">{getErrorMessage('personalInfo.firstName')}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('addKid.lastName', '👨‍👩‍👧‍👦 Last Name')} *</label>
                                    <input
                                        type="text"
                                        className={`form-input ${hasFieldError('personalInfo.lastName') ? 'error' : ''}`}
                                        placeholder={t('addKid.lastNamePlaceholder', 'Racing family name')}
                                        value={formData.personalInfo.lastName}
                                        onChange={(e) => handleInputChange('personalInfo.lastName', e.target.value)}
                                    />
                                    {getErrorMessage('personalInfo.lastName') && (
                                        <span className="error-text">{getErrorMessage('personalInfo.lastName')}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('addKid.birthday', '🎂 Birthday')} *</label>
                                    <input
                                        type="date"
                                        className={`form-input ${hasFieldError('personalInfo.dateOfBirth') ? 'error' : ''}`}
                                        value={formData.personalInfo.dateOfBirth}
                                        onChange={(e) => handleInputChange('personalInfo.dateOfBirth', e.target.value)}
                                    />
                                    {getErrorMessage('personalInfo.dateOfBirth') && (
                                        <span className="error-text">{getErrorMessage('personalInfo.dateOfBirth')}</span>
                                    )}
                                </div>

                                <div className="form-group full-width">
                                    <label className="form-label">{t('addKid.homeBaseLocation', '🏠 Home Base Location')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={t('addKid.homeBaseLocationPlaceholder', 'Where our racer calls home')}
                                        value={formData.personalInfo.address}
                                        onChange={(e) => handleInputChange('personalInfo.address', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Capabilities Section */}
                        <div className="form-section skills-section">
                            <div className="section-header">
                                <Sparkles className="section-icon" size={24} />
                                <h2>{t('addKid.superPowersSkills', '💪 Super Powers & Skills')}</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label className="form-label">{t('addKid.amazingAbilities', '🌟 Amazing Abilities')}</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={t('addKid.amazingAbilitiesPlaceholder', 'Tell us about this racer\'s awesome skills and abilities!')}
                                        value={formData.personalInfo.capabilities}
                                        onChange={(e) => handleInputChange('personalInfo.capabilities', e.target.value)}
                                        rows="3"
                                    />
                                </div>

                                <div className="form-group full-width">
                                    <label className="form-label">{t('addKid.announcerNotes', '📢 Announcer\'s Special Notes')}</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={t('addKid.announcerNotesPlaceholder', 'Fun facts to share during the race!')}
                                        value={formData.personalInfo.announcersNotes}
                                        onChange={(e) => handleInputChange('personalInfo.announcersNotes', e.target.value)}
                                        rows="3"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Parent Information */}
                        <div className="form-section parent-section">
                            <div className="section-header">
                                <Heart className="section-icon" size={24} />
                                <h2>{t('addKid.racingFamilyInfo', '👨‍👩‍👧‍👦 Racing Family Info')}</h2>
                            </div>
                            <div className="form-grid">
                                {/* Parent Selection Dropdown */}
                                <div className="form-group full-width">
                                    <label className="form-label">{t('addKid.selectParentGuardian', '👤 Select Parent/Guardian')} *</label>
                                    <div className="parent-selection-container">
                                        <select
                                            value={selectedParentId}
                                            onChange={(e) => handleParentSelection(e.target.value)}
                                            className={`form-select ${hasFieldError('parentInfo.parentId') ? 'error' : ''}`}
                                        >
                                            <option value="">{t('addKid.chooseParentAccount', '🔗 Choose Parent Account')}</option>
                                            {parents.map(parent => (
                                                <option key={parent.id} value={parent.id}>
                                                    {parent.displayName || parent.name} ({parent.email})
                                                </option>
                                            ))}
                                            <option value="create_new">{t('addKid.createNewParent', '➕ Create New Parent')}</option>
                                        </select>
                                        <button
                                            type="button"
                                            className="btn-create-parent"
                                            onClick={() => handleParentSelection('create_new')}
                                        >
                                            <UserPlus size={18} />
                                            {t('addKid.createNewParent', 'Create New Parent')}
                                        </button>
                                    </div>
                                    {getErrorMessage('parentInfo.parentId') && (
                                        <span className="error-text">{getErrorMessage('parentInfo.parentId')}</span>
                                    )}
                                </div>

                                {/* Parent Info Fields - Show when parent is selected */}
                                {selectedParentData && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">
                                                {t('addKid.parentGuardianName', '👤 Parent/Guardian Name')} *
                                                <Lock size={14} className="lock-icon" />
                                            </label>
                                            <input
                                                type="text"
                                                className="form-input locked"
                                                value={formData.parentInfo.name}
                                                readOnly
                                                disabled
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">
                                                {t('addKid.emailAddress', '📧 Email Address')} *
                                                <Lock size={14} className="lock-icon" />
                                            </label>
                                            <input
                                                type="email"
                                                className="form-input locked"
                                                value={formData.parentInfo.email}
                                                readOnly
                                                disabled
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">
                                                {t('addKid.phoneNumber', '📱 Phone Number')} *
                                                <Lock size={14} className="lock-icon" />
                                            </label>
                                            <input
                                                type="tel"
                                                className="form-input locked"
                                                value={formData.parentInfo.phone}
                                                readOnly
                                                disabled
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Manual Entry Fields - Show when no parent is selected */}
                                {!selectedParentData && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">{t('addKid.parentGuardianName', '👤 Parent/Guardian Name')} *</label>
                                            <input
                                                type="text"
                                                className={`form-input ${hasFieldError('parentInfo.name') ? 'error' : ''}`}
                                                placeholder={t('addKid.parentNamePlaceholder', 'Racing coach\'s name')}
                                                value={formData.parentInfo.name}
                                                onChange={(e) => handleInputChange('parentInfo.name', e.target.value)}
                                            />
                                            {getErrorMessage('parentInfo.name') && (
                                                <span className="error-text">{getErrorMessage('parentInfo.name')}</span>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">{t('addKid.emailAddress', '📧 Email Address')} *</label>
                                            <input
                                                type="email"
                                                className={`form-input ${hasFieldError('parentInfo.email') ? 'error' : ''}`}
                                                placeholder={t('addKid.emailPlaceholder', 'parent@racingfamily.com')}
                                                value={formData.parentInfo.email}
                                                onChange={(e) => handleInputChange('parentInfo.email', e.target.value)}
                                            />
                                            {getErrorMessage('parentInfo.email') && (
                                                <span className="error-text">{getErrorMessage('parentInfo.email')}</span>
                                            )}
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">{t('addKid.phoneNumber', '📱 Phone Number')} *</label>
                                            <input
                                                type="tel"
                                                className={`form-input ${hasFieldError('parentInfo.phone') ? 'error' : ''}`}
                                                placeholder={t('addKid.phonePlaceholder', 'Racing hotline')}
                                                value={formData.parentInfo.phone}
                                                onChange={(e) => handleInputChange('parentInfo.phone', e.target.value)}
                                            />
                                            {getErrorMessage('parentInfo.phone') && (
                                                <span className="error-text">{getErrorMessage('parentInfo.phone')}</span>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Grandparents Info - Always editable */}
                                <div className="form-group">
                                    <label className="form-label">{t('addKid.grandparentsNames', '👵👴 Grandparents Names')}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={t('addKid.grandparentsNamesPlaceholder', 'Racing legends in the family')}
                                        value={formData.parentInfo.grandparentsInfo.names}
                                        onChange={(e) => handleInputChange('parentInfo.grandparentsInfo.names', e.target.value)}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('addKid.grandparentsPhone', '☎️ Grandparents Phone')}</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        placeholder={t('addKid.grandparentsPhonePlaceholder', 'Backup racing support')}
                                        value={formData.parentInfo.grandparentsInfo.phone}
                                        onChange={(e) => handleInputChange('parentInfo.grandparentsInfo.phone', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Team Assignment - UPDATED: Removed Vehicle Assignment */}
                        <div className="form-section team-section">
                            <div className="section-header">
                                <Car className="section-icon" size={24} />
                                <h2>{t('addKid.teamAssignment', '🏎️ Racing Team Assignment')}</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <div className="field-wrapper">
                                        <label className="form-label">
                                            <Users className="label-icon" size={16} />
                                            {t('addKid.racingTeam', 'Racing Team')}
                                        </label>
                                        <select
                                            value={formData.teamId}
                                            onChange={(e) => handleTeamSelection(e.target.value)}
                                            className="form-select"
                                            dir={isRTL ? 'rtl' : 'ltr'}
                                        >
                                            <option value="">{t('addKid.noTeamAssigned', '🚫 No Team Assigned (Yet!)')}</option>
                                            {teams.map(team => (
                                                <option key={team.id} value={team.id}>
                                                    🏁 {team.name} ({team.kidIds?.length || 0} {t('addKid.racers', 'racers')})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <div className="field-wrapper">
                                        <label className="form-label">
                                            <User className="label-icon" size={16} />
                                            {t('addKid.teamInstructor', 'Team Instructor')}
                                        </label>
                                        <div className="instructor-display" dir={isRTL ? 'rtl' : 'ltr'}>
                                            {loadingTeamInstructor ? (
                                                <div className="loading-instructor">
                                                    <div className="loading-spinner-mini"></div>
                                                    <span>{t('addKid.loadingInstructor', 'Loading instructor...')}</span>
                                                </div>
                                            ) : (
                                                <div className={`instructor-info ${!selectedTeamInstructor ? 'empty' : ''}`}>
                                                    <span>
                                                        {selectedTeamInstructor || t('addKid.selectTeamFirst', 'Select a team to see instructor')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Racing Status */}
                        <div className="form-section status-section">
                            <div className="section-header">
                                <Check className="section-icon" size={24} />
                                <h2>{t('addKid.racingStatusForms', '📋 Racing Status & Forms')}</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <div className="field-wrapper">
                                        <label className="form-label">
                                            <FileText className="label-icon" size={16} />
                                            {t('addKid.formStatus', 'Form Status')}
                                        </label>
                                        <select
                                            value={formData.signedFormStatus}
                                            onChange={(e) => handleInputChange('signedFormStatus', e.target.value)}
                                            className="form-select"
                                        >
                                            {formStatusOptions.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label checkbox-label">
                                        {t('addKid.healthDeclarationSigned', '🛡️ Racing Safety Declaration Signed')}
                                        <input
                                            type="checkbox"
                                            checked={formData.signedDeclaration}
                                            onChange={(e) => handleInputChange('signedDeclaration', e.target.checked)}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Comments Section */}
                        <div className="form-section comments-section">
                            <div className="section-header">
                                <FileText className="section-icon" size={24} />
                                <h2>{t('addKid.racingNotesCommunication', '💬 Racing Notes & Comments')}</h2>
                            </div>
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label className="form-label">{t('addKid.additionalRacingNotes', '🗒️ Additional Racing Notes')}</label>
                                    <textarea
                                        className="form-textarea"
                                        placeholder={t('addKid.additionalRacingNotesPlaceholder', 'Any special notes about our new racing star!')}
                                        value={formData.additionalComments}
                                        onChange={(e) => handleInputChange('additionalComments', e.target.value)}
                                        rows="3"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Racing Action Buttons */}
                        <div className="racing-actions">
                            <button type="button" onClick={handleCancel} className="btn btn-cancel">
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || isUploadingPhoto}
                                className="btn btn-submit racing-submit"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="loading-spinner-mini"></div>
                                        {isUploadingPhoto ? t('addKid.uploadingPhoto', 'Uploading Photo...') : t('addKid.addingRacer', 'Adding Racer...')}
                                    </>
                                ) : (
                                    <>
                                        <Plus className="btn-icon" size={18} />
                                        {t('addKid.addToRacingTeam', 'Add to Racing Team! 🏁')}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Create User Modal */}
                <CreateUserModal
                    isOpen={showCreateUserModal}
                    onClose={() => setShowCreateUserModal(false)}
                    onUserCreated={handleUserCreated}
                />
            </div>
        </Dashboard>
    );
};

export default AddKidPage;