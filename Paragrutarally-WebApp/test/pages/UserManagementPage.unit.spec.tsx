import { describe, vi, beforeEach, test, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import { runUserManagementTests, TestData } from './UserManagementPage.tests';
import userEvent from '@testing-library/user-event';

// --- MOCKS ---
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    orderBy: (...args: unknown[]) => mockOrderBy(...args),
}));

vi.mock('@/firebase/config', () => ({
    db: {},
}));

// Mock LanguageContext
const mockT = (key: string, fallback: string) => fallback;
vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: vi.fn(() => ({
        t: mockT,
        isRTL: false,
    })),
}));

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: vi.fn(() => ({
        isDarkMode: false,
        appliedTheme: 'light',
    })),
}));

// Mock Dashboard
vi.mock('@/components/layout/Dashboard', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dashboard">{children}</div>
    ),
}));

// Mock Modals to simplify testing and avoid deep dependency issues
vi.mock('@/components/modals/CreateUserModal', () => ({
    default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        if (!isOpen) return null;
        return (
            <div role="dialog">
                <h1>Create New User</h1>
                <button onClick={onClose}>Close</button>
            </div>
        );
    },
}));

vi.mock('@/components/modals/ExportUsersModal', () => ({
    default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        if (!isOpen) return null;
        return (
            <div role="dialog">
                <h1>Export Users</h1>
                <h4>Filter Options</h4>
                <h4>Export Options</h4>
                <button onClick={onClose}>Export to CSV</button>
            </div>
        );
    },
}));

vi.mock('@/components/modals/UpdateUserModal', () => ({
    default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        if (!isOpen) return null;
        return (
            <div role="dialog">
                <h1>Update User</h1>
                <button onClick={onClose}>Close</button>
            </div>
        );
    },
}));

// Mock userService for Delete functionality (used in UsersTable)
vi.mock('@/services/userService', () => ({
    deleteUserCompletely: vi.fn().mockResolvedValue(true),
}));


// --- HELPER TO CREATE SNAPSHOTS ---
function createMockFirestoreSnapshot(docs: Array<{ id: string;[key: string]: unknown }>) {
    return {
        docs: docs.map((data) => ({
            id: data.id,
            data: () => data,
        })),
        forEach: function (callback: (doc: any) => void) {
            this.docs.forEach(callback);
        }
    };
}

describe('UserManagementPage (Unit)', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Default mocks
        mockCollection.mockReturnValue('users-collection');
        mockOrderBy.mockReturnValue('orderBy-clause');
        mockQuery.mockReturnValue('query-result');
    });

    // SETUP FUNCTION FOR UNIT TESTS
    const setupUnit = async (data?: TestData) => {
        if (!data) return;

        mockGetDocs.mockResolvedValue(createMockFirestoreSnapshot(data.users));

        render(
            <MemoryRouter>
                <UserManagementPage />
            </MemoryRouter>
        );

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText(/loading users.../i)).not.toBeInTheDocument();
        });
    };

    // EXECUTE SHARED TESTS
    runUserManagementTests(setupUnit);

    // You can add specific unit tests here that are not covered by shared tests
    // For example, specific error handling mock scenarios

    test('handles fetch error gracefully', async () => {
        mockGetDocs.mockRejectedValue(new Error('Fetch failed'));
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => { });

        render(
            <MemoryRouter>
                <UserManagementPage />
            </MemoryRouter>
        );

        // Wait for the effect
        await screen.findByText('User Management'); // Title should still render

        // We assume alert is called (based on the component code)
        // alert(t('users.fetchError', 'Failed to load users. Please refresh the page.'));
        expect(alertMock).toHaveBeenCalledWith('Failed to load users. Please refresh the page.');

        alertMock.mockRestore();
    });
});
