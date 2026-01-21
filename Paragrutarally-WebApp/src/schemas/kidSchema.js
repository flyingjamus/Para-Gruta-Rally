// src/schemas/kidSchema.js - Updated for Team-based Vehicle Assignment
import { Timestamp } from 'firebase/firestore';

/**
 * Kid Schema Definition
 * Updated to use single vehicle assignment (vehicleId) instead of array (vehicleIds)
 */

// Default/empty kid object
export const createEmptyKid = () => ({
    // Basic identifiers
    participantNumber: '',

    // Personal Information
    personalInfo: {
        firstName: '',
        lastName: '',
        address: '',
        dateOfBirth: '', // ISO date string (YYYY-MM-DD)
        capabilities: '',
        announcersNotes: '',
        photo: '' // URL or base64 string
    },

    // Parent/Guardian Information
    parentInfo: {
        name: '',
        email: '',
        phone: '',
        phone: '',
        parentId: '', // DEPRECATED: Use parentIds instead
        parentIds: [], // Reference to parent user documents (plural)
        grandparentsInfo: {
            names: '',
            phone: ''
        }
    },

    // Comments from different roles
    comments: {
        parent: '',
        organization: '',
        teamLeader: '',
        familyContact: ''
    },

    // Assignments
    instructorId: '', // Reference to instructor document
    teamId: '', // Reference to team document
    vehicleId: '', // Single vehicle assignment from team's available vehicles

    // Status and Forms
    signedDeclaration: false,
    signedFormStatus: 'pending', // 'pending', 'completed', 'needs_review', 'canceled'

    // Additional Information
    additionalComments: '',

    // Instructor Comments (from Firestore structure)
    instructorsComments: [],

    // Timestamps (auto-generated)
    createdAt: null,
    updatedAt: null
});

// Validation rules
export const kidValidationRules = {
    required: [
        'participantNumber',
        'personalInfo.firstName',
        'personalInfo.lastName',
        'personalInfo.dateOfBirth',
        'parentInfo.name',
        'parentInfo.email',
        'parentInfo.phone'
    ],

    email: [
        'parentInfo.email'
    ],

    phone: [
        'parentInfo.phone',
        'parentInfo.grandparentsInfo.phone'
    ],

    date: [
        'personalInfo.dateOfBirth'
    ],

    maxLength: {
        'personalInfo.firstName': 50,
        'personalInfo.lastName': 50,
        'personalInfo.address': 200,
        'personalInfo.capabilities': 500,
        'personalInfo.announcersNotes': 500,
        'parentInfo.name': 100,
        'parentInfo.email': 100,
        'parentInfo.phone': 20,
        'parentInfo.grandparentsInfo.names': 200,
        'parentInfo.grandparentsInfo.phone': 20,
        'additionalComments': 1000
    }
};

export const getFormStatusOptions = (t) => [
    { value: 'pending', label: t('editKid.formStatusOptions.pending', 'pending'), color: '#F59E0B' },
    { value: 'completed', label: t('editKid.formStatusOptions.completed', 'ready'), color: '#10B981' },
    { value: 'needs_review', label: t('editKid.formStatusOptions.needs_review', 'needs review'), color: '#EF4444' },
    { value: 'cancelled', label: t('editKid.formStatusOptions.cancelled', 'cancelled'), color: '#6B7280' }
];

/**
 * Validate a kid object against the schema
 * @param {Object} kidData - The kid data to validate
 * @param {Function} t - Translation function (optional, uses LanguageContext t function)
 * @returns {Object} - { isValid: boolean, errors: {} }
 */
export const validateKid = (kidData, t = null) => {
    const errors = {};

    // Helper function to get nested value
    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    // Helper function for translations with fallback - FIXED to match LanguageContext signature
    const translate = (key, fallback, interpolations = {}) => {
        if (!t) return fallback;
        return t(key, fallback, interpolations);
    };

    // Get field display name with translation support
    const getFieldDisplayName = (fieldPath) => {
        const fieldName = fieldPath.split('.').pop();
        // Try to get translated field name, fallback to capitalized field name
        const translationKey = `fields.${fieldName}`;
        const displayName = t ? t(translationKey, fieldName.charAt(0).toUpperCase() + fieldName.slice(1)) : fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        return displayName;
    };

    // Check required fields
    kidValidationRules.required.forEach(field => {
        const value = getNestedValue(kidData, field);
        if (!value || (typeof value === 'string' && !value.trim())) {
            const fieldDisplayName = getFieldDisplayName(field);
            errors[field] = translate(
                'validation.fieldRequired',
                `${fieldDisplayName} is required`,
                { field: fieldDisplayName }
            );
        }
    });

    // Validate email format
    kidValidationRules.email.forEach(field => {
        const value = getNestedValue(kidData, field);
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors[field] = translate('validation.emailInvalid', 'Please enter a valid email address');
        }
    });

    // Validate phone format (Israeli) - FIXED VERSION
    kidValidationRules.phone.forEach(field => {
        const value = getNestedValue(kidData, field);
        if (value && value.trim().length > 0) {
            const digitsOnly = value.replace(/\D/g, '');

            // Check if it starts with 05
            if (!digitsOnly.startsWith('05')) {
                errors[field] = translate('validation.phoneMustStartWith05', 'Phone number must start with 05');
            }
            // Check if first 3 digits match Israeli format
            else {
                const validPrefixes = ['050', '052', '053', '054', '055', '057', '058', '059'];
                const firstThreeDigits = digitsOnly.substring(0, 3);

                if (!validPrefixes.includes(firstThreeDigits)) {
                    errors[field] = translate('validation.phoneWrongPrefix', 'Phone number must start with 050, 052, 053, 054, 055, 057, 058, or 059');
                }
                // Only check length if prefix is valid
                else if (digitsOnly.length !== 10) {
                    errors[field] = translate('validation.phoneWrongLength', 'Phone number must be exactly 10 digits');
                }
            }
        }
    });

    // Validate date of birth
    if (kidData.personalInfo?.dateOfBirth) {
        const birthDate = new Date(kidData.personalInfo.dateOfBirth);
        const today = new Date();

        if (isNaN(birthDate.getTime())) {
            errors['personalInfo.dateOfBirth'] = translate('validation.dateInvalid', 'Please enter a valid date');
        } else if (birthDate >= today) {
            errors['personalInfo.dateOfBirth'] = translate('validation.dateMustBePast', 'Date of birth must be in the past');
        } else {
            // Check if child is not too old (e.g., under 20)
            const age = today.getFullYear() - birthDate.getFullYear();
            if (age > 20) {
                errors['personalInfo.dateOfBirth'] = translate('validation.ageLimit', 'Participants need to be under 20 years old');
            }
        }
    }

    // Validate max lengths - FIXED VERSION
    Object.entries(kidValidationRules.maxLength).forEach(([field, maxLength]) => {
        const value = getNestedValue(kidData, field);
        if (value && value.length > maxLength) {
            const fieldDisplayName = getFieldDisplayName(field);
            errors[field] = translate(
                'validation.maxLength',
                `{field} must be no more than {max} characters`,
                { max: maxLength, field: fieldDisplayName }
            );
        }
    });

    const isValid = Object.keys(errors).length === 0;
    return {
        isValid,
        errors
    };
};

/**
 * Prepare kid data for Firestore (add timestamps, clean up)
 * @param {Object} kidData - The kid data to prepare
 * @param {boolean} isUpdate - Whether this is an update (preserve createdAt)
 * @returns {Object} - Cleaned kid data ready for Firestore
 */
export const prepareKidForFirestore = (kidData, isUpdate = false) => {
    const cleanData = { ...kidData };

    // Add/update timestamps
    if (!isUpdate) {
        cleanData.createdAt = Timestamp.now();
    }
    cleanData.updatedAt = Timestamp.now();

    // Convert date string to proper format if needed
    if (cleanData.personalInfo?.dateOfBirth) {
        // Keep as string for now, but ensure it's in ISO format
        const date = new Date(cleanData.personalInfo.dateOfBirth);
        if (!isNaN(date.getTime())) {
            cleanData.personalInfo.dateOfBirth = date.toISOString().split('T')[0];
        }
    }

    // Clean up empty strings and null values
    const cleanObject = (obj) => {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                continue;
            }
            if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
                const cleanedNested = cleanObject(value);
                if (Object.keys(cleanedNested).length > 0) {
                    cleaned[key] = cleanedNested;
                }
            } else if (value !== '') {
                cleaned[key] = value;
            }
        }
        return cleaned;
    };

    // Sync parentId and parentIds for backward compatibility
    if (cleanData.parentInfo) {
        // If parentId is set but not in parentIds, add it
        if (cleanData.parentInfo.parentId &&
            (!cleanData.parentInfo.parentIds || !cleanData.parentInfo.parentIds.includes(cleanData.parentInfo.parentId))) {
            cleanData.parentInfo.parentIds = cleanData.parentInfo.parentIds || [];
            cleanData.parentInfo.parentIds.push(cleanData.parentInfo.parentId);
        }

    }

    return cleanObject(cleanData);
};

/**
 * Convert Firestore document to kid object
 * @param {Object} doc - Firestore document
 * @returns {Object} - Kid object with proper data types
 */
export const convertFirestoreToKid = (doc) => {
    const data = doc.data();
    const kid = createEmptyKid();

    // Merge with default structure to ensure all fields exist
    const mergedData = {
        ...kid,
        ...data,
        id: doc.id
    };

    // Ensure parentIds exists
    if (mergedData.parentInfo && !mergedData.parentInfo.parentIds) {
        mergedData.parentInfo.parentIds = [];
        // Migration: If parentId exists but parentIds doesn't, allow migration logic here or lazily
        if (mergedData.parentInfo.parentId) {
            mergedData.parentInfo.parentIds.push(mergedData.parentInfo.parentId);
        }
    }

    // Convert Firestore Timestamps to Date objects for display
    if (mergedData.createdAt?.toDate) {
        mergedData.createdAt = mergedData.createdAt.toDate();
    }
    if (mergedData.updatedAt?.toDate) {
        mergedData.updatedAt = mergedData.updatedAt.toDate();
    }

    return mergedData;
};

/**
 * Get kid's full name
 * @param {Object} kid - Kid object
 * @param {Function} t - Translation function (optional)
 * @returns {string} - Full name
 */
export const getKidFullName = (kid, t = null) => {
    const firstName = kid.personalInfo?.firstName || '';
    const lastName = kid.personalInfo?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (fullName) {
        return fullName;
    }

    // Return translated "Unnamed Kid" if translation function is provided
    if (t) {
        return t('common.unnamedKid', 'Unnamed Kid');
    }

    // Fallback to English if no translation function
    return 'Unnamed Kid';
};

/**
 * Get kid's age from date of birth
 * @param {Object} kid - Kid object
 * @returns {number|null} - Age in years
 */
export const getKidAge = (kid) => {
    if (!kid.personalInfo?.dateOfBirth) return null;

    const birthDate = new Date(kid.personalInfo.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
};

/**
 * Get form status info
 * @param {string} status - Status value
 * @param {Function} t - Translation function
 * @returns {Object} - Status info with label and color
 */
export const getFormStatusInfo = (status, t) => {
    const options = getFormStatusOptions(t);
    return options.find(option => option.value === status) || options[0];
};

// Export the schema for use in forms and validation
export default {
    createEmptyKid,
    validateKid,
    prepareKidForFirestore,
    convertFirestoreToKid,
    getKidFullName,
    getKidAge,
    getFormStatusInfo,
    getFormStatusOptions,
    kidValidationRules
};