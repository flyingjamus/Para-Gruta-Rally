// src/pages/parent/ParentDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { usePermissions } from '../../hooks/usePermissions';
import { useLanguage } from '../../contexts/LanguageContext';
import Dashboard from '../../components/layout/Dashboard';
import ParentKidEditModal from '../../components/modals/ParentKidEditModal';
import {
    IconUser as User,
    IconUsers as Users,
    IconChevronDown as ChevronDown,
    IconChevronUp as ChevronUp,
    IconEdit as Edit,
    IconDeviceFloppy as Save,
    IconX as X,
    IconCalendar as Calendar,
    IconMapPin as MapPin,
    IconPhone as Phone,
    IconMail as Mail,
    IconFileText as FileText,
    IconAlertTriangle as Alert,
    IconCheck as Check
} from '@tabler/icons-react';

const ParentDashboardPage = () => {
    const { permissions, userRole, userData, user } = usePermissions();
    const { t } = useLanguage();

    const [kids, setKids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedKid, setExpandedKid] = useState(null);
    const [editingComments, setEditingComments] = useState({});
    const [commentTexts, setCommentTexts] = useState({});
    const [saving, setSaving] = useState({});

    // Edit modal state
    const [editingKid, setEditingKid] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const loadParentKids = async () => {
        if (!user?.uid || userRole !== 'parent') {
            setError(t('instructor.accessDenied', 'Access denied: Parent credentials required'));
            setLoading(false);
            return;
        }

        try {
            setError('');

            // Load kids where parentInfo.parentIds contains current user
            const kidsQuery = query(
                collection(db, 'kids'),
                where('parentInfo.parentIds', 'array-contains', user.uid),
                orderBy('personalInfo.firstName', 'asc')
            );

            const kidsSnapshot = await getDocs(kidsQuery);
            const kidsData = kidsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setKids(kidsData);

            // Initialize comment texts
            const initialComments = {};
            kidsData.forEach(kid => {
                initialComments[kid.id] = kid.comments?.parent || '';
            });
            setCommentTexts(initialComments);

        } catch (err) {
            console.error('Error loading parent kids:', err);
            setError(t('instructor.failedToLoad', 'Failed to load your kids data. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadParentKids();
    }, [user, userRole, t]);

    // Helper function to safely display field data based on permissions
    const getFieldValue = (kid, fieldPath, defaultValue = '-') => {
        const context = { kidData: kid, userData, user };

        if (!permissions.canViewField(fieldPath, context)) {
            return null; // Don't show restricted fields
        }

        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], kid);
        return value || defaultValue;
    };

    const canEditField = (kid, fieldPath) => {
        const context = { kidData: kid, userData, user };
        return permissions.canEditField(fieldPath, context);
    };

    const toggleKidExpansion = (kidId) => {
        setExpandedKid(expandedKid === kidId ? null : kidId);
    };

    const startEditingComments = (kidId) => {
        setEditingComments({ ...editingComments, [kidId]: true });
    };

    const cancelEditingComments = (kidId) => {
        setEditingComments({ ...editingComments, [kidId]: false });
        // Reset to original value
        const kid = kids.find(k => k.id === kidId);
        setCommentTexts({
            ...commentTexts,
            [kidId]: kid.comments?.parent || ''
        });
    };

    const saveComments = async (kidId) => {
        setSaving({ ...saving, [kidId]: true });

        try {
            const kidRef = doc(db, 'kids', kidId);
            await updateDoc(kidRef, {
                'comments.parent': commentTexts[kidId] || ''
            });

            // Update local state
            setKids(kids.map(kid =>
                kid.id === kidId
                    ? {
                        ...kid,
                        comments: {
                            ...kid.comments,
                            parent: commentTexts[kidId] || ''
                        }
                    }
                    : kid
            ));

            setEditingComments({ ...editingComments, [kidId]: false });
        } catch (err) {
            console.error('Error saving comments:', err);
            setError(t('editKid.commentError', 'Failed to save comments. Please try again.'));
        } finally {
            setSaving({ ...saving, [kidId]: false });
        }
    };

    // Handle edit modal
    const handleEditKid = (kid) => {
        setEditingKid(kid);
        setShowEditModal(true);
    };

    const handleEditModalClose = () => {
        setShowEditModal(false);
        setEditingKid(null);
    };

    const handleEditSuccess = (message) => {
        // Show success message
        alert(message);

        // Refresh kids data
        loadParentKids();

        // Close modal
        handleEditModalClose();
    };

    const getFormStatus = (kid) => {
        if (kid.signedFormStatus === 'completed' && kid.signedDeclaration) {
            return { status: 'complete', label: t('status.completed', 'Complete'), color: 'success' };
        } else if (kid.signedFormStatus === 'pending' || !kid.signedDeclaration) {
            return { status: 'pending', label: t('status.pending', 'Pending'), color: 'warning' };
        }
        return { status: 'incomplete', label: t('common.incomplete', 'Incomplete'), color: 'danger' };
    };

    if (loading) {
        return (
            <Dashboard userRole={userRole}>
                <div className="admin-page">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>{t('common.loading', 'Loading...')}</p>
                    </div>
                </div>
            </Dashboard>
        );
    }

    if (error) {
        return (
            <Dashboard userRole={userRole}>
                <div className="admin-page">
                    <div className="error-container">
                        <h3>{t('common.error', 'Error')}</h3>
                        <p>{error}</p>
                    </div>
                </div>
            </Dashboard>
        );
    }

    // Count kids by form status
    const completeKids = kids.filter(kid => getFormStatus(kid).status === 'complete').length;
    const pendingKids = kids.filter(kid => getFormStatus(kid).status !== 'complete').length;

    return (
        <Dashboard userRole={userRole}>
            <div className="admin-page">
                <h1>
                    <Users className="page-title-icon" size={48} />
                    {t('parent.myKids', 'My Kids')}
                </h1>

                <div className="admin-container">
                    {/* Welcome Header */}
                    <div className="racing-header">
                        <div className="header-content">
                            <div className="title-section">
                                <h1>
                                    <User size={40} />
                                    {t('common.welcome', 'Welcome')}, {userData?.displayName || user?.displayName || t('parent.parent', 'Parent')}!
                                </h1>
                                <p className="subtitle">
                                    {t('parent.dashboardSubtitle', 'View and manage your children\'s information')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="stats-grid">
                        <div className="stat-card total">
                            <div className="stat-icon">
                                <Users size={40} />
                            </div>
                            <div className="stat-content">
                                <h3>{t('kids.totalKids', 'Total Kids')}</h3>
                                <div className="stat-value">{kids.length}</div>
                                <div className="stat-subtitle">{t('stats.registered', 'Registered')}</div>
                            </div>
                        </div>

                        <div className="stat-card parents">
                            <div className="stat-icon">
                                <Check size={40} />
                            </div>
                            <div className="stat-content">
                                <h3>{t('stats.complete', 'Complete')}</h3>
                                <div className="stat-value">{completeKids}</div>
                                <div className="stat-subtitle">{t('stats.formsComplete', 'Forms Complete')}</div>
                            </div>
                        </div>

                        <div className="stat-card kids">
                            <div className="stat-icon">
                                <Alert size={40} />
                            </div>
                            <div className="stat-content">
                                <h3>{t('stats.pending', 'Pending')}</h3>
                                <div className="stat-value">{pendingKids}</div>
                                <div className="stat-subtitle">{t('stats.requiresAttention', 'Requires Attention')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Alerts */}
                    {pendingKids > 0 && (
                        <div className="alert warning-alert">
                            <Alert size={20} />
                            <span>
                                {t('parent.pendingFormsAlert', 'You have {count} kids with pending forms that need completion',
                                    { count: pendingKids })}
                            </span>
                        </div>
                    )}

                    {/* Kids List */}
                    {kids.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <Users size={80} />
                            </div>
                            <h3>{t('parent.noKidsFound', 'No Kids Found')}</h3>
                            <p>{t('parent.noKidsRegistered', 'You don\'t have any kids registered in the system yet')}</p>
                        </div>
                    ) : (
                        <div className="kids-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {kids.map(kid => {
                                const formStatus = getFormStatus(kid);
                                const isExpanded = expandedKid === kid.id;
                                const isEditingComment = editingComments[kid.id];
                                const isSavingComment = saving[kid.id];

                                return (
                                    <div key={kid.id} className="card kid-card" style={{ padding: '20px' }}>
                                        {/* Kid Header */}
                                        <div
                                            className="kid-header"
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                marginBottom: isExpanded ? '20px' : '0'
                                            }}
                                            onClick={() => toggleKidExpansion(kid.id)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <User size={24} style={{ color: 'var(--racing-purple)' }} />
                                                <div>
                                                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                                                        {getFieldValue(kid, 'personalInfo.firstName')} {getFieldValue(kid, 'personalInfo.lastName')}
                                                    </h3>
                                                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                                                        {t('kids.participantNumber', 'Participant #')}: {getFieldValue(kid, 'participantNumber')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                {/* Edit Button */}
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditKid(kid);
                                                    }}
                                                    style={{
                                                        padding: '8px 12px',
                                                        fontSize: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Edit size={14} />
                                                    {t('general.edit', 'Edit')}
                                                </button>

                                                <span className={`status-badge ${formStatus.color === 'success' ? 'ready' : formStatus.color === 'warning' ? 'pending' : 'inactive'}`}>
                                                    {formStatus.label}
                                                </span>
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>

                                        {/* Expanded Kid Details */}
                                        {isExpanded && (
                                            <div className="kid-details" style={{ paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>

                                                {/* Personal Information */}
                                                <div className="detail-section" style={{ marginBottom: '25px' }}>
                                                    <h4 style={{
                                                        margin: '0 0 15px 0',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <User size={18} />
                                                        {t('parent.personalInfo', 'Personal Information')}
                                                    </h4>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('common.dateOfBirth', 'Date of Birth')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                {getFieldValue(kid, 'personalInfo.dateOfBirth')
                                                                    ? new Date(getFieldValue(kid, 'personalInfo.dateOfBirth')).toLocaleDateString()
                                                                    : '-'
                                                                }
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('common.address', 'Address')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                {getFieldValue(kid, 'personalInfo.address')}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('common.capabilities', 'Capabilities')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                {getFieldValue(kid, 'personalInfo.capabilities') || t('common.none', 'None')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Parent Information */}
                                                <div className="detail-section" style={{ marginBottom: '25px' }}>
                                                    <h4 style={{
                                                        margin: '0 0 15px 0',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <Phone size={18} />
                                                        {t('parent.contactInfo', 'Contact Information')}
                                                    </h4>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('common.parentName', 'Parent Name')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                {getFieldValue(kid, 'parentInfo.name')}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('users.email', 'Email')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                                                {getFieldValue(kid, 'parentInfo.email')}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('users.phone', 'Phone')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace', direction: 'ltr' }}>
                                                                {getFieldValue(kid, 'parentInfo.phone')}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Grandparents Info */}
                                                    {getFieldValue(kid, 'parentInfo.grandparentsInfo.names') && (
                                                        <div style={{ marginTop: '15px' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('parent.grandparentsInfo', 'Grandparents Information')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                <div>{getFieldValue(kid, 'parentInfo.grandparentsInfo.names')}</div>
                                                                {getFieldValue(kid, 'parentInfo.grandparentsInfo.phone') && (
                                                                    <div style={{ fontFamily: 'monospace', direction: 'ltr', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                                                        {getFieldValue(kid, 'parentInfo.grandparentsInfo.phone')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Forms Status */}
                                                <div className="detail-section" style={{ marginBottom: '25px' }}>
                                                    <h4 style={{
                                                        margin: '0 0 15px 0',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <FileText size={18} />
                                                        {t('parent.formsStatus', 'Forms & Status')}
                                                    </h4>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('common.signedFormStatus', 'Form Status')}
                                                            </label>
                                                            <div>
                                                                <span className={`status-badge ${getFieldValue(kid, 'signedFormStatus') === 'completed' ? 'ready' : 'pending'}`}>
                                                                    {t(`common.${getFieldValue(kid, 'signedFormStatus', 'pending')}`, getFieldValue(kid, 'signedFormStatus', 'pending'))}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('common.declaration', 'Declaration')}
                                                            </label>
                                                            <div>
                                                                <span className={`status-badge ${getFieldValue(kid, 'signedDeclaration') ? 'ready' : 'pending'}`}>
                                                                    {getFieldValue(kid, 'signedDeclaration') ? t('viewKid.signed', 'Signed') : t('viewKid.pending', 'Pending')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Parent Comments - Editable */}
                                                {canEditField(kid, 'comments.parent') && (
                                                    <div className="detail-section">
                                                        <h4 style={{
                                                            margin: '0 0 15px 0',
                                                            color: 'var(--text-primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}>
                                                            <Edit size={18} />
                                                            {t('parent.myComments', 'My Comments')}
                                                        </h4>

                                                        {isEditingComment ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                <textarea
                                                                    className="form-textarea"
                                                                    value={commentTexts[kid.id] || ''}
                                                                    onChange={(e) => setCommentTexts({
                                                                        ...commentTexts,
                                                                        [kid.id]: e.target.value
                                                                    })}
                                                                    placeholder={t('parent.addCommentsPlaceholder', 'Add your comments about your child...')}
                                                                    rows={4}
                                                                    style={{ minHeight: '100px' }}
                                                                />
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                    <button
                                                                        className="btn btn-success btn-sm"
                                                                        onClick={() => saveComments(kid.id)}
                                                                        disabled={isSavingComment}
                                                                    >
                                                                        {isSavingComment ? (
                                                                            <div className="loading-spinner-mini" />
                                                                        ) : (
                                                                            <Save size={14} />
                                                                        )}
                                                                        {t('general.save', 'Save')}
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={() => cancelEditingComments(kid.id)}
                                                                        disabled={isSavingComment}
                                                                    >
                                                                        <X size={14} />
                                                                        {t('general.cancel', 'Cancel')}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <div style={{
                                                                    minHeight: '60px',
                                                                    padding: '12px',
                                                                    background: 'var(--bg-tertiary)',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid var(--border-color)',
                                                                    marginBottom: '10px',
                                                                    color: 'var(--text-primary)'
                                                                }}>
                                                                    {commentTexts[kid.id] || t('parent.noCommentsYet', 'No comments added yet')}
                                                                </div>
                                                                <button
                                                                    className="btn btn-primary btn-sm"
                                                                    onClick={() => startEditingComments(kid.id)}
                                                                >
                                                                    <Edit size={14} />
                                                                    {commentTexts[kid.id] ? t('general.edit', 'Edit') : t('parent.addComments', 'Add Comments')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Edit Modal */}
                <ParentKidEditModal
                    kid={editingKid}
                    isOpen={showEditModal}
                    onClose={handleEditModalClose}
                    onSuccess={handleEditSuccess}
                />
            </div>
        </Dashboard>
    );
};

export default ParentDashboardPage;