// src/pages/admin/UserManagementPage.jsx - OPTIMIZED VERSION with single-row stats
import React, {useState, useEffect, useCallback} from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import Dashboard from '../../components/layout/Dashboard';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import CreateUserModal from '../../components/modals/CreateUserModal';
import ExportUsersModal from '../../components/modals/ExportUsersModal';
import UpdateUserModal from '../../components/modals/UpdateUserModal';
import UsersTable from '../../components/tables/UsersTable';
import { db } from '@/firebase/config.js';
import {
    IconUsers as Users,
    IconUserPlus as UserPlus,
    IconDownload as Download,
    IconCrown as Crown,
    IconCar as Car,
    IconUserCheck as UserCheck,
    IconHome as Home,
    IconSearch as Search,
    IconTag as Tag,
    IconEraser as Eraser,
    IconFile as FileSpreadsheet,
    IconX as X
} from '@tabler/icons-react';
import './UserManagement.css';

const UserManagementPage = () => {
    const { isDarkMode, appliedTheme } = useTheme();
    const { t, isRTL } = useLanguage();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [roleFilter, setRoleFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCardFilter, setActiveCardFilter] = useState('total'); // NEW: Track active card

    // Fetch users from the Firestore
    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const usersQuery = query(
                collection(db, 'users'),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(usersQuery);
            const usersData = [];

            querySnapshot.forEach((doc) => {
                usersData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            setUsers(usersData);
            setFilteredUsers(usersData);
        } catch (error) {
            console.error('Error fetching users:', error);
            alert(t('users.fetchError', 'Failed to load users. Please refresh the page.'));
        } finally {
            setIsLoading(false);
        }
    };

    // Filter users by role and search
    const filterUsers = useCallback(() => {
        let filtered = users;

        // Filter by role
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        // Filter by search term
        if (searchTerm.trim() !== '') {
            filtered = filtered.filter(user =>
                user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredUsers(filtered);
    }, [users, roleFilter, searchTerm]);

    // Handle filter changes
    const handleRoleFilterChange = (e) => {
        setRoleFilter(e.target.value);
        setActiveCardFilter(e.target.value); // NEW: Update active card when filter changes
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleClearFilters = () => {
        setRoleFilter('all');
        setSearchTerm('');
        setActiveCardFilter('total'); // NEW: Reset to total
    };

    // Handle stat card clicks to filter users - UPDATED WITH ACTIVE CARD TRACKING
    const handleStatCardClick = (filterType) => {
        setActiveCardFilter(filterType); // NEW: Set active card

        switch (filterType) {
            case 'total':
                setRoleFilter('all');
                break;
            case 'admin':
                setRoleFilter('admin');
                break;
            case 'instructor':
                setRoleFilter('instructor');
                break;
            case 'host':
                setRoleFilter('host');
                break;
            case 'parent':
                setRoleFilter('parent');
                break;
            default:
                break;
        }
        // Clear search when clicking stat cards
        setSearchTerm('');
    };

    // Modal handlers
    const handleCreateUser = () => {
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        setIsCreateModalOpen(false);
    };

    const handleUserCreated = () => {
        fetchUsers();
    };

    const handleUserUpdated = () => {
        fetchUsers();
        setSelectedUser(null);
        setIsUpdateModalOpen(false);
    };

    const handleUserDeleted = () => {
        fetchUsers();
    };

    const handleCloseUpdateModal = () => {
        setIsUpdateModalOpen(false);
        setSelectedUser(null);
    };

    const handleExportUsers = () => {
        setIsExportModalOpen(true);
    };

    const handleCloseExportModal = () => {
        setIsExportModalOpen(false);
    };

    const handleUpdateUser = (user) => {
        setSelectedUser(user);
        setIsUpdateModalOpen(true);
    };

    // Load users on component mount
    useEffect(() => {
        fetchUsers();
    }, []);

    // Re-filter when filters change
    useEffect(() => {
        filterUsers();
    }, [filterUsers]);

    // Calculate stats - FIXED: Removed +1 since all users should be showing
    const stats = {
        totalUsers: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        instructors: users.filter(u => u.role === 'instructor').length,
        hosts: users.filter(u => u.role === 'host').length,
        parents: users.filter(u => u.role === 'parent').length
    };


    // Get translated role names
    const getRoleName = (role) => {
        switch (role) {
            case 'admin':
                return t('users.admin', 'Admin');
            case 'instructor':
                return t('users.instructor', 'Instructor');
            case 'host':
                return t('users.host', 'Host');
            case 'parent':
                return t('users.parent', 'Parent');
            default:
                return role;
        }
    };

    return (
        <Dashboard requiredRole="admin">
            <div className={`user-management-page ${appliedTheme}-mode`} dir={isRTL ? 'rtl' : 'ltr'}>
                <h1 className="page-title">
                    <Users size={32} className="page-title-icon" /> {t('users.title', 'User Management')}
                </h1>

                <div className="user-management-container">
                    {/* Header with Export in top-right */}
                    <div className="page-header">
                        <button
                            className="btn-primary"
                            onClick={handleCreateUser}
                        >
                            <UserPlus className="btn-icon" size={18} />
                            {t('users.createNewUser', 'Create New User')}
                        </button>

                        <button
                            className="btn-export"
                            onClick={handleExportUsers}
                        >
                            <Download className="btn-icon" size={18} />
                            {t('users.exportUsers', 'Export Users')}
                        </button>
                    </div>

                    {/* OPTIMIZED Stats Cards - Single Row Layout */}
                    <div className="stats-grid-optimized">
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={t('users.totalUsers', 'Total Users')}
                            className={`stat-card total ${activeCardFilter === 'total' ? 'active' : ''}`}
                            onClick={() => handleStatCardClick('total')}
                            onKeyDown={(e) => e.key === 'Enter' && handleStatCardClick('total')}
                            style={{ cursor: 'pointer' }}
                        >
                            <Users className="stat-icon" size={40} />
                            <div className="stat-content">
                                <h3>{t('users.totalUsers', 'Total Users')}</h3>
                                <div className="stat-value">{stats.totalUsers}</div>
                            </div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={t('users.admins', 'Admins')}
                            className={`stat-card admins ${activeCardFilter === 'admin' ? 'active' : ''}`}
                            onClick={() => handleStatCardClick('admin')}
                            onKeyDown={(e) => e.key === 'Enter' && handleStatCardClick('admin')}
                            style={{ cursor: 'pointer' }}
                        >
                            <Crown className="stat-icon" size={40} />
                            <div className="stat-content">
                                <h3>{t('users.admins', 'Admins')}</h3>
                                <div className="stat-value">{stats.admins}</div>
                            </div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={t('users.instructors', 'Instructors')}
                            className={`stat-card instructors ${activeCardFilter === 'instructor' ? 'active' : ''}`}
                            onClick={() => handleStatCardClick('instructor')}
                            onKeyDown={(e) => e.key === 'Enter' && handleStatCardClick('instructor')}
                            style={{ cursor: 'pointer' }}
                        >
                            <Car className="stat-icon" size={40} />
                            <div className="stat-content">
                                <h3>{t('users.instructors', 'Instructors')}</h3>
                                <div className="stat-value">{stats.instructors}</div>
                            </div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={t('users.hosts', 'Hosts')}
                            className={`stat-card hosts ${activeCardFilter === 'host' ? 'active' : ''}`}
                            onClick={() => handleStatCardClick('host')}
                            onKeyDown={(e) => e.key === 'Enter' && handleStatCardClick('host')}
                            style={{ cursor: 'pointer' }}
                        >
                            <Home className="stat-icon" size={40} />
                            <div className="stat-content">
                                <h3>{t('users.hosts', 'Hosts')}</h3>
                                <div className="stat-value">{stats.hosts}</div>
                            </div>
                        </div>

                        <div
                            role="button"
                            tabIndex={0}
                            aria-label={t('users.parents', 'Parents')}
                            className={`stat-card parents ${activeCardFilter === 'parent' ? 'active' : ''}`}
                            onClick={() => handleStatCardClick('parent')}
                            onKeyDown={(e) => e.key === 'Enter' && handleStatCardClick('parent')}
                            style={{ cursor: 'pointer' }}
                        >
                            <UserCheck className="stat-icon" size={40} />
                            <div className="stat-content">
                                <h3>{t('users.parents', 'Parents')}</h3>
                                <div className="stat-value">{stats.parents}</div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Filters - Side by Side */}
                    <div className="search-filter-section">
                        <div className="search-container">
                            <div className="search-input-wrapper">
                                <Search className="search-icon" size={18} />
                                <input
                                    type="text"
                                    aria-label={t('users.searchPlaceholder', 'Search users by name or email...')}
                                    placeholder={t('users.searchPlaceholder', 'Search users by name or email...')}
                                    className="search-input"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                />
                                {searchTerm && (
                                    <button className="clear-search" onClick={() => setSearchTerm('')}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="filter-container">
                            <label className="filter-label" htmlFor="role-filter">
                                <Tag className="filter-icon" size={16} />
                                {t('users.filterByRole', 'Filter by Role')}
                            </label>
                            <select
                                id="role-filter"
                                className="filter-select"
                                value={roleFilter}
                                onChange={handleRoleFilterChange}
                            >
                                <option value="all">⭐ {t('users.allRoles', 'All Roles')}</option>
                                <option value="admin">👑 {t('users.admin', 'Admin')}</option>
                                <option value="instructor">🏎️ {t('users.instructor', 'Instructor')}</option>
                                <option value="host">🏠 {t('users.host', 'Host')}</option>
                                <option value="parent">👨‍👩‍👧‍👦 {t('users.parent', 'Parent')}</option>
                            </select>
                        </div>

                        <button className="btn-clear" onClick={handleClearFilters}>
                            <Eraser className="btn-icon" size={18} />
                            {t('users.clearFilters', 'Clear Filters')}
                        </button>
                    </div>

                    {/* Results Info */}
                    <div className="results-info">
                        <FileSpreadsheet className="results-icon" size={18} />
                        {t('users.showing', 'Showing')} {filteredUsers.length} {t('teams.of', 'of')} {users.length} {t('users.usersLowercase', 'users')}
                        {roleFilter !== 'all' && <span className="filter-applied"> • {t('users.filteredBy', 'Filtered by')}: {getRoleName(roleFilter)}</span>}
                        {searchTerm && <span className="search-applied"> • {t('users.searching', 'Searching')}: "{searchTerm}"</span>}
                    </div>

                    <UsersTable
                        users={filteredUsers}
                        isLoading={isLoading}
                        onUpdateUser={handleUpdateUser}
                        onUserDeleted={handleUserDeleted}
                    />
                </div>
            </div>

            {/* Modals */}
            <CreateUserModal
                isOpen={isCreateModalOpen}
                onClose={handleCloseCreateModal}
                onUserCreated={handleUserCreated}
            />

            <ExportUsersModal
                isOpen={isExportModalOpen}
                onClose={handleCloseExportModal}
            />

            <UpdateUserModal
                isOpen={isUpdateModalOpen}
                onClose={handleCloseUpdateModal}
                user={selectedUser}
                onUserUpdated={handleUserUpdated}
            />
        </Dashboard>
    );
};

export default UserManagementPage;