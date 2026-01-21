export class PermissionService {
    constructor(user, userData) {
        this.user = user;
        this.userData = userData;
        this.userRole = userData?.role || 'guest';

        // Add the properties that your components expect
        this.canCreate = this.canCreateContent();
        this.canEdit = this.canEditContent();
        this.canDelete = this.canDeleteContent();
        this.canView = this.canViewContent();

        // FIXED: Add the method aliases that ProtectedField expects
        this.canViewField = this.canViewField.bind(this);
        this.canEditField = this.canEditField.bind(this);
    }

    // High-level permission methods for CRUD operations
    canCreateContent() {
        switch (this.userRole) {
            case 'admin':
                return true;
            case 'instructor':
                return true;
            case 'parent':
                return false;
            case 'guest':
                return false;
            default:
                return false;
        }
    }

    canEditContent() {
        switch (this.userRole) {
            case 'admin':
                return true;
            case 'instructor':
                return true;
            case 'parent':
                return false;
            case 'guest':
                return false;
            default:
                return false;
        }
    }

    canDeleteContent() {
        switch (this.userRole) {
            case 'admin':
                return true;
            case 'instructor':
                return false;
            case 'parent':
                return false;
            case 'guest':
                return false;
            default:
                return false;
        }
    }

    canViewContent() {
        return ['admin', 'instructor', 'parent', 'guest'].includes(this.userRole);
    }

    // Check if user can view specific field (your existing logic)
    canViewField(field, context = {}) {
        const { kidData, vehicleData } = context;

        switch (this.userRole) {
            case 'admin':
                return true;

            case 'parent':
                {
                    const parentInfo = kidData?.parentInfo || {};
                    const isParent = (parentInfo.parentIds && parentInfo.parentIds.includes(this.user.uid)) ||
                        (parentInfo.parentId === this.user.uid);

                    if (!kidData || !isParent) {
                        return false;
                    }

                    const parentCanView = [
                        'participantNumber', 'firstName', 'lastName', 'fullName',
                        'personalInfo.address', 'address', 'personalInfo.dateOfBirth',
                        'dateOfBirth', 'personalInfo.capabilities', 'personalInfo.announcersNotes',
                        'personalInfo.photo', 'parentInfo.name', 'guardianName',
                        'parentInfo.email', 'email', 'parentInfo.phone', 'contactNumber',
                        'parentInfo.grandparentsInfo', 'comments.parent', 'notes',
                        'signedDeclaration', 'signedFormStatus',
                        'vehicle.make', 'vehicle.model', 'vehicle.licensePlate', 'vehicle.photo'
                    ];

                    const parentCannotView = [
                        'comments.organization', 'comments.teamLeader', 'comments.familyContact',
                        'instructorComments', 'medicalNotes', 'emergencyContact', 'emergencyPhone',
                        'vehicle.batteryType', 'vehicle.batteryDate', 'vehicle.driveType',
                        'vehicle.steeringType', 'vehicle.notes', 'vehicle.modifications'
                    ];

                    if (parentCannotView.includes(field)) return false;
                    return parentCanView.some(pattern =>
                        field.startsWith(pattern.replace('.*', '')) || field === pattern
                    );
                }

            case 'instructor':
                if (!kidData || kidData.instructorId !== this.userData.instructorId) {
                    return false;
                }
                return true;

            case 'guest':
                {
                    const guestCanView = [
                        'firstName', 'lastName', 'personalInfo.address', 'address',
                        'personalInfo.capabilities', 'personalInfo.announcersNotes',
                        'parentInfo.name', 'guardianName', 'parentInfo.phone', 'contactNumber',
                        'vehicle.make', 'vehicle.model', 'participantNumber'
                    ];

                    const guestCannotView = [
                        'parentInfo.email', 'email', 'comments.parent', 'comments.familyContact',
                        'parentInfo.grandparentsInfo', 'signedDeclaration', 'emergencyContact',
                        'emergencyPhone'
                    ];

                    if (guestCannotView.includes(field)) return false;
                    return guestCanView.includes(field);
                }

            default:
                return false;
        }
    }

    // Check if user can edit specific field (your existing logic)
    canEditField(field, context = {}) {
        const { kidData, vehicleData } = context;

        switch (this.userRole) {
            case 'admin':
                return true;

            case 'parent':
                const parentInfo = kidData?.parentInfo || {};
                const isParent = (parentInfo.parentIds && parentInfo.parentIds.includes(this.user.uid)) ||
                    (parentInfo.parentId === this.user.uid);

                if (!kidData || !isParent) {
                    return false;
                }
                return [
                    'comments.parent', 'notes', 'personalInfo.photo',
                    'parentInfo.phone', 'contactNumber', 'parentInfo.grandparentsInfo.names',
                    'parentInfo.grandparentsInfo.phone'
                ].includes(field);

            case 'instructor':
                if (!kidData || kidData.instructorId !== this.userData.instructorId) {
                    return false;
                }
                return [
                    'comments.teamLeader', 'instructorComments', 'medicalNotes',
                    'vehicle.batteryType', 'vehicle.batteryDate', 'vehicle.driveType',
                    'vehicle.steeringType', 'vehicle.notes', 'vehicle.modifications'
                ].includes(field);

            case 'guest':
                return ['comments.organization'].includes(field);

            default:
                return false;
        }
    }

    // Check if user can view this specific kid at all
    canViewKid(kidData) {
        switch (this.userRole) {
            case 'admin':
                return true;
            case 'parent':
                const parentInfo = kidData?.parentInfo || {};
                return (parentInfo.parentIds && parentInfo.parentIds.includes(this.user.uid)) ||
                    (parentInfo.parentId === this.user.uid);
            case 'instructor':
                return kidData.instructorId === this.userData.instructorId;
            case 'guest':
                return true;
            default:
                return false;
        }
    }

    // Filter entire data object based on permissions
    filterData(data, type = 'kid') {
        if (this.userRole === 'admin') return data;

        const filtered = { ...data };
        const fieldsToCheck = type === 'kid' ? this.getKidFields() : this.getVehicleFields();

        fieldsToCheck.forEach(field => {
            if (!this.canViewField(field, { kidData: data, vehicleData: data })) {
                this.removeNestedField(filtered, field);
            }
        });

        return filtered;
    }

    getKidFields() {
        return [
            'participantNumber', 'personalInfo.address', 'personalInfo.dateOfBirth',
            'personalInfo.capabilities', 'personalInfo.announcersNotes', 'personalInfo.photo',
            'parentInfo.name', 'parentInfo.email', 'parentInfo.phone',
            'parentInfo.grandparentsInfo', 'comments.parent', 'comments.organization',
            'comments.teamLeader', 'comments.familyContact', 'instructorComments',
            'signedDeclaration', 'signedFormStatus'
        ];
    }

    getVehicleFields() {
        return [
            'make', 'model', 'licensePlate', 'batteryType', 'batteryDate',
            'driveType', 'steeringType', 'photo', 'notes', 'modifications'
        ];
    }

    removeNestedField(obj, path) {
        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) return;
            current = current[keys[i]];
        }

        delete current[keys[keys.length - 1]];
    }
}