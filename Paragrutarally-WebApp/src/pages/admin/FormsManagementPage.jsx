import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from '../../components/layout/Dashboard';
import FormCreationModal from '../../components/modals/FormCreationModal';
import FormEditModal from '../../components/modals/FormEditModal';
import FormViewModal from '../../components/modals/FormViewModal';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePermissions } from '../../hooks/usePermissions.jsx';
import {
    getAllForms,
    getAllSubmissionsWithDetails,
    deleteForm
} from '@/services/formService.js';
import { exportSubmissionsToCSV } from '@/utils/formatUtils.js';
import {
    IconNotes as FileText,
    IconPlus as Plus,
    IconEye as Eye,
    IconEdit as Edit,
    IconTrash as Trash2,
    IconDownload as Download,
    IconCheck as Check,
    IconClock as Clock,
    IconAlertTriangle as AlertTriangle,
    IconUsers as Users,
    IconChartBar as BarChart3,
    IconTarget as Target,
    IconSparkles as Sparkles,
    IconRefresh as RefreshCw,
    IconSearch as Search,
    IconFilter as Filter,
    IconCopy as Copy
} from '@tabler/icons-react';
import './FormsManagementPage.css';

const FormsManagementPage = () => {
    const navigate = useNavigate();
    const { isDarkMode, appliedTheme } = useTheme();
    const { t } = useLanguage();
    const { permissions, userRole, userData, user } = usePermissions();

    // State management
    const [forms, setForms] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modal states
    const [showFormCreationModal, setShowFormCreationModal] = useState(false);
    const [showFormEditModal, setShowFormEditModal] = useState(false);
    const [showFormViewModal, setShowFormViewModal] = useState(false);
    const [selectedForm, setSelectedForm] = useState(null);
    const [templateType, setTemplateType] = useState(null);

    // Analytics state
    const [analytics, setAnalytics] = useState({
        totalForms: 0,
        totalSubmissions: 0,
        pendingReviews: 0,
        completionRate: 0
    });
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState(null);


    // Load forms data
    useEffect(() => {
        loadFormsData();
    }, []);

    const loadFormsData = async () => {
        setIsLoading(true);
        setError(null); // Clear any previous errors

        try {
            // Load forms and submissions with error handling
            const formsData = await getAllForms();
            const submissionsData = await getAllSubmissionsWithDetails();

            setForms(formsData || []);
            setSubmissions(submissionsData || []);

            // Calculate analytics with safe data
            const pendingSubmissions = (submissionsData || []).filter(s => s.confirmationStatus === 'needs to decide').length;
            setAnalytics({
                totalForms: (formsData || []).length,
                totalSubmissions: (submissionsData || []).length,
                pendingReviews: pendingSubmissions,
                completionRate: (formsData || []).length > 0 ?
                    Math.round(((submissionsData || []).length / (formsData || []).length) * 100) : 0
            });

        } catch (error) {
            console.error('Critical error loading forms data:', error);
            setError('Unable to load forms data. Please check your connection and try again.');

            // Set empty data to prevent crashes
            setForms([]);
            setSubmissions([]);
            setAnalytics({
                totalForms: 0,
                totalSubmissions: 0,
                pendingReviews: 0,
                completionRate: 0
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Handle create new form
    const handleCreateForm = (template = null) => {
        setTemplateType(template);
        setShowFormCreationModal(true);
    };

    // Handle edit form
    const handleEditForm = (form) => {
        setSelectedForm(form);
        setShowFormEditModal(true);
    };

    // Handle view form
    const handleViewForm = (form) => {
        setSelectedForm(form);
        setShowFormViewModal(true);
    };

    // Handle form card click (open in view mode)
    const handleFormCardClick = (form) => {
        handleViewForm(form);
    };

    // Handle view submissions
    const handleViewSubmissions = (formId) => {
        navigate(`/admin/forms/${formId}/submissions`);
    };

    // Delete form
    const handleDeleteForm = async (formId) => {
        if (window.confirm(t('forms.deleteConfirm', 'Are you sure you want to delete this form?'))) {
            try {
                await deleteForm(formId);
                await loadFormsData();
            } catch (error) {
                console.error('Error deleting form:', error);
                alert(t('forms.deleteError', 'Error deleting form. Please try again.'));
            }
        }
    };

    // Get status label
    const getStatusLabel = (status) => {
        switch (status) {
            case 'active':
                return t('forms.status.active', 'Active');
            case 'draft':
                return t('forms.status.draft', 'Draft');
            case 'archived':
                return t('forms.status.archived', 'Archived');
            default:
                return status;
        }
    };

    // Filter forms
    const filteredForms = useMemo(() => {
        return forms.filter(form => {
            const matchesSearch = searchTerm === '' ||
                form.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                form.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || form.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [forms, searchTerm, statusFilter]);

    const handleExportSubmissions = async () => {
        setIsExporting(true);
        try {
            exportSubmissionsToCSV(submissions, 'all_form_submissions');
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setIsExporting(false);
        }
    };

    if (!permissions) {
        return (
            <Dashboard requiredRole={userRole}>
                <div className={`forms-management-page ${appliedTheme}-mode`}>
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>{t('common.loading', 'Loading...')}</p>
                    </div>
                </div>
            </Dashboard>
        );
    }

    return (
        <Dashboard requiredRole={userRole}>
            <div className={`forms-management-page ${appliedTheme}-mode`}>
                {/* Page Title */}
                <h1 className="page-title">
                    <FileText size={32} className="page-title-icon" />
                    {t('forms.title', 'Forms Management')}
                    <Sparkles size={24} className="sparkle-icon" />
                </h1>
                {error && (
                    <div className="error-message">
                        <AlertTriangle size={20} />
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            style={{
                                marginLeft: 'auto',
                                background: 'none',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '4px'
                            }}
                            title="Dismiss error"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* Main Container */}
                <div className="forms-management-container">

                    {/* Quick Actions */}
                    <div className="quick-actions">
                        <div className="quick-actions-title">
                            <Target className="section-icon" size={20} />
                            {t('forms.quickActions', 'Quick Actions')}
                        </div>
                        <div className="quick-actions-grid">
                            <button
                                className="quick-action-btn"
                                onClick={() => handleCreateForm()}
                            >
                                <Plus size={16} />
                                {t('forms.createNewForm', 'Create New Form')}
                            </button>
                            <button
                                className="quick-action-btn"
                                onClick={loadFormsData}
                                disabled={isLoading}
                            >
                                <RefreshCw size={16} />
                                {t('forms.refreshData', 'Refresh Data')}
                            </button>
                            <button
                                className="quick-action-btn"
                                onClick={() => navigate('/admin/forms/submissions')}
                            >
                                <Eye size={16} />
                                {t('forms.viewAllSubmissions', 'View All Submissions')}
                            </button>
                            <button
                                className="quick-action-btn"
                                onClick={handleExportSubmissions}
                                disabled={isExporting || submissions.length === 0}
                            >
                                <Download size={16} />
                                {isExporting ? 'Exporting...' : t('forms.exportSubmissions', 'Export Submissions')}
                            </button>
                        </div>
                    </div>

                    {/* Analytics Cards */}
                    <div className="analytics-grid">
                        <div className="analytics-card">
                            <FileText className="analytics-icon" size={30} />
                            <div className="analytics-number">{analytics.totalForms}</div>
                            <div className="analytics-label">{t('forms.totalForms', 'Total Forms')}</div>
                        </div>

                        <div className="analytics-card">
                            <Users className="analytics-icon" size={30} />
                            <div className="analytics-number">{analytics.totalSubmissions}</div>
                            <div className="analytics-label">{t('forms.submissions', 'Submissions')}</div>
                        </div>

                        <div className="analytics-card">
                            <Clock className="analytics-icon" size={30} />
                            <div className="analytics-number">{analytics.pendingReviews}</div>
                            <div className="analytics-label">{t('forms.pendingReviews', 'Pending Reviews')}</div>
                        </div>

                        <div className="analytics-card">
                            <BarChart3 className="analytics-icon" size={30} />
                            <div className="analytics-number">{analytics.completionRate}%</div>
                            <div className="analytics-label">{t('forms.completionRate', 'Completion Rate')}</div>
                        </div>
                    </div>

                    {/* Forms Overview Section */}
                    <div className="form-section forms-overview-section">
                        <div className="section-header">
                            <FileText className="section-icon form-icon" size={24} />
                            <h3>{t('forms.activeForms', '📋 Active Forms')}</h3>
                        </div>

                        {/* Search and Filters */}
                        <div className="search-filter-section">
                            <div className="search-container">
                                <div className="search-input-wrapper">
                                    <Search className="search-icon" size={18} />
                                    <input
                                        type="text"
                                        placeholder={t('forms.searchForms', 'Search forms...')}
                                        className="search-input"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="filter-container">
                                <label className="filter-label">
                                    <Filter className="filter-icon" size={16} />
                                    {t('forms.status', 'Status')}
                                </label>
                                <select
                                    className="filter-select"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">{t('forms.allForms', 'All Forms')}</option>
                                    <option value="active">{t('forms.status.active', 'Active')}</option>
                                    <option value="draft">{t('forms.status.draft', 'Draft')}</option>
                                    <option value="archived">{t('forms.status.archived', 'Archived')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Forms Grid */}
                        {isLoading ? (
                            <div className="loading-state">
                                <div className="loading-content">
                                    <Clock className="loading-spinner" size={30} />
                                    <p>{t('forms.loadingForms', 'Loading forms...')}</p>
                                </div>
                            </div>
                        ) : filteredForms.length > 0 ? (
                            <div className="forms-grid">
                                {filteredForms.map(form => (
                                    <div
                                        key={form.id}
                                        className="form-card"
                                        onClick={() => handleFormCardClick(form)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className="form-card-header">
                                            <FileText className="form-card-icon" size={20} />
                                            <h4 className="form-card-title">{form.title}</h4>
                                            <span className={`status-badge ${form.status}`}>
                                                {getStatusLabel(form.status)}
                                            </span>
                                        </div>

                                        <div className="form-card-body">
                                            <p>{form.description || t('forms.noDescription', 'No description available')}</p>

                                            <div className="form-meta">
                                                <div className="meta-item">
                                                    <span className="meta-label">{t('forms.type', 'Type')}:</span>
                                                    <span className="meta-value">
                                                        {(() => {
                                                            switch(form.type) {
                                                                case 'event_registration':
                                                                    return t('forms.types.eventRegistration', 'רישום לאירוע');
                                                                case 'training_registration':
                                                                    return t('forms.types.trainingRegistration', 'רישום להכשרה');
                                                                case 'feedback':
                                                                    return t('forms.types.feedback', 'משוב');
                                                                case 'survey':
                                                                    return t('forms.types.survey', 'סקר');
                                                                default:
                                                                    return form.type || t('forms.types.eventRegistration', 'רישום לאירוע');
                                                            }
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">{t('forms.targetUsers', 'Target Users')}:</span>
                                                    <span className="meta-value">
                                                    {form.targetUsers?.map(userType => {
                                                        switch(userType) {
                                                            case 'parent':
                                                                return t('forms.parents', 'Parents');
                                                            case 'instructor':
                                                                return t('forms.instructors', 'Instructors');
                                                            case 'host':
                                                                return t('forms.hosts', 'Hosts');
                                                            default:
                                                                return userType;
                                                        }
                                                    }).join(', ') || t('forms.none', 'None')}
                                                                        </span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">{t('forms.created', 'Created')}:</span>
                                                    <span className="meta-value">
                                                        {form.createdAt?.toLocaleDateString() || 'Unknown'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="form-card-stats">
                                            <div className="form-stat">
                                                <div className="form-stat-number">
                                                    {submissions.filter(s => s.formId === form.id).length}
                                                </div>
                                                <div className="form-stat-label">{t('forms.submissions', 'Submissions')}</div>
                                            </div>
                                            <div className="form-stat">
                                                <div className="form-stat-number">{form.viewCount || 0}</div>
                                                <div className="form-stat-label">{t('forms.views', 'Views')}</div>
                                            </div>
                                        </div>

                                        <div className="card-footer" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className="btn-action view"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewSubmissions(form.id);
                                                }}
                                                title={t('forms.viewSubmissions', 'View Submissions')}
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                className="btn-action edit"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditForm(form);
                                                }}
                                                title={t('forms.editForm', 'Edit Form')}
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                className="btn-action delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteForm(form.id);
                                                }}
                                                title={t('forms.deleteForm', 'Delete Form')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">
                                    <FileText size={80} />
                                </div>
                                <h3>{t('forms.noFormsFound', 'No Forms Found')}</h3>
                                <p>
                                    {searchTerm || statusFilter !== 'all'
                                        ? t('forms.noFormsMatchFilter', 'No forms match your search criteria')
                                        : t('forms.noFormsYet', 'You haven\'t created any forms yet')
                                    }
                                </p>
                                {!searchTerm && statusFilter === 'all' && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleCreateForm()}
                                    >
                                        <Plus size={16} />
                                        {t('forms.createFirstForm', 'Create Your First Form')}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Form Templates Section - Updated without Custom Template */}
                    <div className="form-section form-templates-section">
                        <div className="section-header">
                            <Copy className="section-icon" size={24} />
                            <h3>{t('forms.formTemplates', '📋 Form Templates')}</h3>
                        </div>

                        <div className="template-gallery">
                            <div className="template-card">
                                <div className="template-preview">
                                    <Users className="template-preview-icon" size={40} />
                                </div>
                                <div className="template-name">{t('forms.parentEventTemplate', 'Parent Event Registration')}</div>
                                <div className="template-description">
                                    {t('forms.parentEventDesc', 'Standard template for parent event registrations with kids selection')}
                                </div>
                                <button
                                    className="use-template-btn"
                                    onClick={() => handleCreateForm('parent')}
                                >
                                    {t('forms.useTemplate', 'Use Template')}
                                </button>
                            </div>

                            <div className="template-card">
                                <div className="template-preview">
                                    <FileText className="template-preview-icon" size={40} />
                                </div>
                                <div className="template-name">{t('forms.instructorEventTemplate', 'Instructor Event Registration')}</div>
                                <div className="template-description">
                                    {t('forms.instructorEventDesc', 'Template for instructor event registration and attendance confirmation')}
                                </div>
                                <button
                                    className="use-template-btn"
                                    onClick={() => handleCreateForm('instructor')}
                                >
                                    {t('forms.useTemplate', 'Use Template')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Submissions Section */}
                    <div className="form-section form-submissions-section">
                        <div className="section-header">
                            <BarChart3 className="section-icon" size={24} />
                            <h3>{t('forms.recentSubmissions', '📊 Recent Submissions')}</h3>
                            <button
                                className="btn btn-secondary"
                                onClick={() => navigate('/admin/forms/submissions')}
                            >
                                {t('forms.viewAll', 'View All')}
                            </button>
                        </div>

                        {submissions.length > 0 ? (
                            <div className="submissions-table-container">
                                <table className="submissions-table">
                                    <thead>
                                    <tr>
                                        <th>{t('forms.submittedAt', 'Submitted')}</th>
                                        <th>{t('forms.formTitle', 'Form')}</th>
                                        <th>{t('forms.status', 'Status')}</th>
                                        <th>{t('forms.submitter', 'Submitter')}</th>
                                        <th>{t('forms.actions', 'Actions')}</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {submissions.slice(0, 5).map(submission => {
                                        const form = forms.find(f => f.id === submission.formId);
                                        return (
                                            <tr key={submission.id}>
                                                <td>
                                                    {submission.submittedAt?.toLocaleDateString()}
                                                </td>
                                                <td>
                                                    {form?.title || t('forms.unknownForm', 'Unknown Form')}
                                                </td>
                                                <td>
                                                        <span className={`submission-status ${submission.confirmationStatus?.replace(' ', '-')}`}>
                                                            {submission.confirmationStatus === 'attending' && <Check size={12} />}
                                                            {submission.confirmationStatus === 'not attending' && <AlertTriangle size={12} />}
                                                            {submission.confirmationStatus === 'needs to decide' && <Clock size={12} />}
                                                            {submission.confirmationStatus || t('forms.pending', 'Pending')}
                                                        </span>
                                                </td>
                                                <td>
                                                    {submission.submitterData?.name || submission.submitterName || t('forms.unknownUser', 'Unknown User')}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn-action view"
                                                        onClick={() => handleViewSubmissions(submission.formId)}
                                                        title={t('forms.viewDetails', 'View Details')}
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="empty-submissions">
                                <p>{t('forms.noSubmissionsYet', 'No submissions received yet')}</p>
                            </div>
                        )}
                    </div>

                    {/* Form Creation Modal */}
                    <FormCreationModal
                        isOpen={showFormCreationModal}
                        templateType={templateType}
                        onClose={() => {
                            setShowFormCreationModal(false);
                            setTemplateType(null);
                        }}
                        onSuccess={(formId) => {
                            setShowFormCreationModal(false);
                            setTemplateType(null);
                            loadFormsData(); // Reload data
                        }}
                    />

                    {/* Form Edit Modal */}
                    {showFormEditModal && (
                        <FormEditModal
                            isOpen={showFormEditModal}
                            form={selectedForm}
                            onClose={() => {
                                setShowFormEditModal(false);
                                setSelectedForm(null);
                            }}
                            onSuccess={() => {
                                setShowFormEditModal(false);
                                setSelectedForm(null);
                                loadFormsData(); // Reload data
                            }}
                        />
                    )}

                    {/* Form View Modal */}
                    {showFormViewModal && (
                        <FormViewModal
                            isOpen={showFormViewModal}
                            form={selectedForm}
                            onClose={() => {
                                setShowFormViewModal(false);
                                setSelectedForm(null);
                            }}
                        />
                    )}
                </div>
            </div>
        </Dashboard>
    );
};

export default FormsManagementPage;
