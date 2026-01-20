// src/pages/host/HostDashboardPage.jsx - Enhanced Host/Guest Dashboard
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import {
    IconHome as Home,
    IconUsers as Users,
    IconCalendar as Calendar,
    IconSearch as Search,
    IconFilter as Filter,
    IconEdit as Edit,
    IconDeviceFloppy as Save,
    IconX as X,
    IconEye as Eye,
    IconMapPin as MapPin,
    IconClock as Clock,
    IconFileText as FileText,
    IconUsersGroup as Team,
    IconPhoto as Photo,
    IconChevronDown as ChevronDown,
    IconChevronUp as ChevronUp
} from '@tabler/icons-react';

const HostDashboardPage = () => {
    const { permissions, userRole, userData, user } = usePermissions();
    const { t } = useLanguage();

    const searchInputId = 'host-dashboard-search';
    const eventFilterSelectId = 'host-dashboard-event-filter';

    const [events, setEvents] = useState([]);
    const [registeredKids, setRegisteredKids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [expandedKid, setExpandedKid] = useState(null);
    const [editingComments, setEditingComments] = useState({});
    const [commentTexts, setCommentTexts] = useState({});
    const [saving, setSaving] = useState({});

    useEffect(() => {
        const loadHostData = async () => {
            if (userRole !== 'host' && userRole !== 'guest') {
                setError(t('instructor.accessDenied', 'Access denied: Host/Guest credentials required'));
                setLoading(false);
                return;
            }

            try {
                setError('');

                // Load upcoming events
                const eventsQuery = query(
                    collection(db, 'events'),
                    orderBy('eventDate', 'desc')
                );
                const eventsSnapshot = await getDocs(eventsQuery);
                const eventsData = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Load kids registered for events (guests can only see kids registered for events)
                const kidsQuery = query(
                    collection(db, 'kids'),
                    orderBy('personalInfo.firstName', 'asc')
                );
                const kidsSnapshot = await getDocs(kidsQuery);
                const allKids = kidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Filter kids that are registered for events (have teams assigned)
                const registeredKids = allKids.filter(kid => kid.teamId);

                setEvents(eventsData);
                setRegisteredKids(registeredKids);

                // Initialize comment texts
                const initialComments = {};
                registeredKids.forEach(kid => {
                    initialComments[kid.id] = kid.comments?.organization || '';
                });
                setCommentTexts(initialComments);

            } catch (err) {
                console.error('Error loading host data:', err);
                setError(t('instructor.failedToLoad', 'Failed to load data. Please try again.'));
            } finally {
                setLoading(false);
            }
        };

        loadHostData();
    }, [userRole, t]);

    // Helper function to safely display field data based on permissions
    const getFieldValue = (kid, fieldPath, defaultValue = '-') => {
        const context = { kidData: kid, userData, user };

        if (!permissions.canViewField(fieldPath, context)) {
            return null; // Don't show restricted fields for guests
        }

        const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], kid);
        return value || defaultValue;
    };

    const canEditField = (kid, fieldPath) => {
        const context = { kidData: kid, userData, user };
        return permissions.canEditField(fieldPath, context);
    };

    // Filter kids based on search and event
    const filteredKids = registeredKids.filter(kid => {
        const firstName = getFieldValue(kid, 'personalInfo.firstName');
        const lastName = getFieldValue(kid, 'personalInfo.lastName');
        const participantNumber = getFieldValue(kid, 'participantNumber');

        const matchesSearch = searchTerm === '' ||
            firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            participantNumber?.toString().includes(searchTerm);

        let matchesEvent = true;

        // Check if a specific event is selected for filtering
        if (eventFilter !== '') {
            const selectedEvent = events.find(e => e.id === eventFilter);

            // Check if the event exists AND if its list of participating teams includes the kid's team ID
            matchesEvent = selectedEvent && selectedEvent.participatingTeams?.includes(kid.teamId);
        }

        return matchesSearch && matchesEvent;
    });

    // Comment editing functions
    const startEditingComments = (kidId) => {
        setEditingComments({ ...editingComments, [kidId]: true });
    };

    const cancelEditingComments = (kidId) => {
        setEditingComments({ ...editingComments, [kidId]: false });
        const kid = registeredKids.find(k => k.id === kidId);
        setCommentTexts({
            ...commentTexts,
            [kidId]: kid.comments?.organization || ''
        });
    };

    const saveComments = async (kidId) => {
        setSaving({ ...saving, [kidId]: true });

        try {
            const kidRef = doc(db, 'kids', kidId);
            await updateDoc(kidRef, {
                'comments.organization': commentTexts[kidId] || ''
            });

            // Update local state
            setRegisteredKids(registeredKids.map(kid =>
                kid.id === kidId
                    ? {
                        ...kid,
                        comments: {
                            ...kid.comments,
                            organization: commentTexts[kidId] || ''
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

    const toggleKidExpansion = (kidId) => {
        setExpandedKid(expandedKid === kidId ? null : kidId);
    };

    // Get upcoming events
    const upcomingEvents = events.filter(event => new Date(event.eventDate) >= new Date());
    const pastEvents = events.filter(event => new Date(event.eventDate) < new Date());

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

    return (
        <Dashboard userRole={userRole}>
            <div className="admin-page">
                <h1>
                    <Home className="page-title-icon" size={48} />
                    {t('host.dashboard', 'Host Dashboard')}
                </h1>

                <div className="admin-container">
                    {/* Welcome Header */}
                    <div className="racing-header">
                        <div className="header-content">
                            <div className="title-section">
                                <h1>
                                    <Home size={40} />
                                    {t('common.welcome', 'Welcome')}, {userData?.displayName || user?.displayName || t('host.host', 'Host')}!
                                </h1>
                                <p className="subtitle">
                                    {t('host.dashboardSubtitle', 'View event participants and manage organization notes')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="stats-grid">
                        <div className="stat-card total">
                            <div className="stat-icon">
                                <Calendar size={40} />
                            </div>
                            <div className="stat-content">
                                <h3>{t('events.totalEvents', 'Total Events')}</h3>
                                <div className="stat-value">{events.length}</div>
                                <div className="stat-subtitle">{t('stats.inSystem', 'In System')}</div>
                            </div>
                        </div>

                        <div className="stat-card instructors">
                            <div className="stat-icon">
                                <Calendar size={40} />
                            </div>
                            <div className="stat-content">
                                <h3>{t('stats.upcoming', 'Upcoming')}</h3>
                                <div className="stat-value">{upcomingEvents.length}</div>
                                <div className="stat-subtitle">{t('stats.futureEvents', 'Future Events')}</div>
                            </div>
                        </div>

                        <div className="stat-card kids">
                            <div className="stat-icon">
                                <Users size={40} />
                            </div>
                            <div className="stat-content">
                                <h3>{t('stats.participants', 'Participants')}</h3>
                                <div className="stat-value">{registeredKids.length}</div>
                                <div className="stat-subtitle">{t('stats.registered', 'Registered')}</div>
                            </div>
                        </div>

                        <div className="stat-card teams">
                            <div className="stat-icon">
                                <Clock size={40} />
                            </div>
                            <div className="stat-content">
                                <h3>{t('stats.pastEvents', 'Past Events')}</h3>
                                <div className="stat-value">{pastEvents.length}</div>
                                <div className="stat-subtitle">{t('status.completed', 'Completed')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Filter Section */}
                    <div className="search-filter-section">
                        <div className="search-container">
                            <label className="search-label" htmlFor={searchInputId}>
                                <Search size={16} />
                                {t('common.search', 'Search')}
                            </label>
                            <div className="search-input-wrapper">
                                <Search className="search-icon" size={18} />
                                <input
                                    id={searchInputId}
                                    type="text"
                                    className="search-input"
                                    aria-label={t('common.search', 'Search')}
                                    placeholder={t('host.searchParticipantsPlaceholder', 'Search participants by name or number...')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        className="clear-search"
                                        aria-label={t('common.clearSearch', 'Clear search')}
                                        onClick={() => setSearchTerm('')}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="filter-container">
                            <label className="filter-label" htmlFor={eventFilterSelectId}>
                                <Filter size={16} />
                                {t('common.filterByEvent', 'Filter by Event')}
                            </label>
                            <select
                                id={eventFilterSelectId}
                                className="filter-select"
                                aria-label={t('common.filterByEvent', 'Filter by Event')}
                                value={eventFilter}
                                onChange={(e) => setEventFilter(e.target.value)}
                            >
                                <option value="">{t('common.allEvents', 'All Events')}</option>
                                {events.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Results Summary */}
                    {(searchTerm || eventFilter) && (
                        <div className="results-summary">
                            <span>{t('common.showing', 'Showing')} {filteredKids.length} {t('common.results', 'results')}</span>
                            {searchTerm && <span className="search-applied">for "{searchTerm}"</span>}
                            {eventFilter && <span className="filter-applied">in event "{events.find(e => e.id === eventFilter)?.name}"</span>}
                        </div>
                    )}

                    {/* Participants List */}
                    {filteredKids.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <Users size={80} />
                            </div>
                            <h3>{t('host.noParticipantsFound', 'No Participants Found')}</h3>
                            <p>
                                {searchTerm || eventFilter
                                    ? t('host.noParticipantsMatchFilter', 'No participants match your current filter')
                                    : t('host.noParticipantsRegistered', 'No participants are registered for events yet')
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="participants-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {filteredKids.map(kid => {
                                const isExpanded = expandedKid === kid.id;
                                const isEditingComment = editingComments[kid.id];
                                const isSavingComment = saving[kid.id];
                                const firstName = getFieldValue(kid, 'personalInfo.firstName');
                                const lastName = getFieldValue(kid, 'personalInfo.lastName');
                                const participantNumber = getFieldValue(kid, 'participantNumber');

                                return (
                                    <div key={kid.id} className="card participant-card" style={{ padding: '20px' }}>
                                        {/* Participant Header */}
                                        <button
                                            type="button"
                                            className="participant-header"
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                width: '100%',
                                                background: 'transparent',
                                                border: 'none',
                                                padding: 0,
                                                textAlign: 'left',
                                                marginBottom: isExpanded ? '20px' : '0'
                                            }}
                                            onClick={() => toggleKidExpansion(kid.id)}
                                            aria-expanded={isExpanded}
                                            aria-controls={`participant-details-${kid.id}`}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <Users size={24} style={{ color: 'var(--racing-purple)' }} />
                                                <div>
                                                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                                                        {firstName} {lastName}
                                                    </h3>
                                                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
                                                        {t('kids.participantNumber', 'Participant #')}: {participantNumber}
                                                    </p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <span className={`status-badge ${getFieldValue(kid, 'signedFormStatus') === 'completed' ? 'ready' : 'pending'}`}>
                                                    {getFieldValue(kid, 'signedFormStatus', 'pending')}
                                                </span>
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </button>

                                        {/* Expanded Participant Details */}
                                        {isExpanded && (
                                            <div
                                                id={`participant-details-${kid.id}`}
                                                className="participant-details"
                                                style={{ paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}
                                            >

                                                {/* Basic Information - Only what guests can see */}
                                                <div className="detail-section" style={{ marginBottom: '25px' }}>
                                                    <h4 style={{
                                                        margin: '0 0 15px 0',
                                                        color: 'var(--text-primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}>
                                                        <Users size={18} />
                                                        {t('host.participantInfo', 'Participant Information')}
                                                    </h4>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('common.fullName', 'Full Name')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                {firstName} {lastName}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('kids.capabilities', 'Capabilities')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                {getFieldValue(kid, 'personalInfo.capabilities') || t('common.none', 'None')}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('kids.team', 'Team')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                <span className="badge secondary">
                                                                    {getFieldValue(kid, 'teamId') || t('common.unassigned', 'Unassigned')}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('kids.status', 'Status')}
                                                            </label>
                                                            <div>
                                                                <span className={`status-badge ${getFieldValue(kid, 'signedFormStatus') === 'completed' ? 'ready' : 'pending'}`}>
                                                                    {getFieldValue(kid, 'signedFormStatus', 'pending')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {getFieldValue(kid, 'personalInfo.announcersNotes') && (
                                                        <div style={{ marginTop: '15px' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('host.announcersNotes', 'Announcer\'s Notes')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
                                                                {getFieldValue(kid, 'personalInfo.announcersNotes')}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {getFieldValue(kid, 'additionalComments') && (
                                                        <div style={{ marginTop: '15px' }}>
                                                            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                                                {t('host.additionalComments', 'Additional Comments')}
                                                            </label>
                                                            <div style={{ color: 'var(--text-primary)' }}>
                                                                {getFieldValue(kid, 'additionalComments')}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Organization Comments - Editable by guests */}
                                                {canEditField(kid, 'comments.organization') && (
                                                    <div className="detail-section">
                                                        <h4 style={{
                                                            margin: '0 0 15px 0',
                                                            color: 'var(--text-primary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px'
                                                        }}>
                                                            <Edit size={18} />
                                                            {t('host.organizationComments', 'Organization Comments')}
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
                                                                    placeholder={t('host.addOrgCommentsPlaceholder', 'Add organization notes for this participant...')}
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
                                                                    {commentTexts[kid.id] || t('host.noOrgCommentsYet', 'No organization comments added yet')}
                                                                </div>
                                                                <button
                                                                    className="btn btn-primary btn-sm"
                                                                    onClick={() => startEditingComments(kid.id)}
                                                                >
                                                                    <Edit size={14} />
                                                                    {commentTexts[kid.id] ? t('general.edit', 'Edit') : t('host.addOrgComments', 'Add Comments')}
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

                    {/* Quick Actions */}
                    <div className="racing-actions" style={{ marginTop: '30px' }}>
                        <Link to="/gallery" className="btn btn-primary">
                            <Photo size={18} />
                            {t('host.viewGallery', 'View Gallery')}
                        </Link>
                        {upcomingEvents.length > 0 && (
                            <div className="btn btn-secondary" style={{ cursor: 'default' }}>
                                <Calendar size={18} />
                                {t('host.upcomingEvents', 'Next Event')}: {upcomingEvents[0]?.name}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Dashboard>
    );
};

export default HostDashboardPage;
