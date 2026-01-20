import { describe, vi, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FormsManagementPage from '@/pages/admin/FormsManagementPage';
import { runFormsManagementPageTests, TestData, defaultForms, defaultSubmissions } from './FormsManagementPage.tests';
import { usePermissions } from '@/hooks/usePermissions';
import userEvent from '@testing-library/user-event';

// --- MOCKS ---
// Mock services
const mockGetAllForms = vi.fn();
const mockGetAllSubmissionsWithDetails = vi.fn();
const mockDeleteForm = vi.fn();
const mockExportSubmissionsToCSV = vi.fn();

vi.mock('@/services/formService', () => ({
    getAllForms: (...args: unknown[]) => mockGetAllForms(...args),
    getAllSubmissionsWithDetails: (...args: unknown[]) => mockGetAllSubmissionsWithDetails(...args),
    deleteForm: (...args: unknown[]) => mockDeleteForm(...args),
}));

vi.mock('@/utils/formatUtils', () => ({
    exportSubmissionsToCSV: (...args: unknown[]) => mockExportSubmissionsToCSV(...args),
}));

// Mock usePermissions
vi.mock('@/hooks/usePermissions', () => ({
    usePermissions: vi.fn(),
}));

// Mock Contexts
const mockT = (key: string, fallback: string) => fallback;
vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: vi.fn(() => ({
        t: mockT,
        isRTL: false,
        currentLanguage: 'en',
    })),
}));

vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: vi.fn(() => ({
        isDarkMode: false,
        appliedTheme: 'light',
    })),
}));

// Mock Layout
vi.mock('@/components/layout/Dashboard', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dashboard">{children}</div>
    ),
}));

// Mock Modals (Minimal implementation for testing existence and basic flow)
// Mock Modals (Minimal implementation for testing existence and basic flow)
vi.mock('@/components/modals/FormCreationModal', () => ({
    default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
        isOpen ? (
            <div data-testid="form-creation-modal">
                <h3>Create Event Registration Form</h3>
                <button onClick={onClose}>Close</button>
            </div>
        ) : null,
}));

vi.mock('@/components/modals/FormEditModal', () => ({
    default: ({ isOpen, onClose, form }: { isOpen: boolean; onClose: () => void; form: any }) =>
        isOpen ? (
            <div data-testid="form-edit-modal">
                <h3>Edit Form</h3>
                <button onClick={onClose}>Close</button>
                <input readOnly value={form?.title} />
            </div>
        ) : null,
}));

vi.mock('@/components/modals/FormViewModal', () => ({
    default: ({ isOpen, onClose, form }: { isOpen: boolean; onClose: () => void; form: any }) =>
        isOpen ? (
            <div data-testid="form-view-modal">
                <h3>View Form - {form?.title}</h3>
                <button onClick={onClose}>Close</button>
                <div data-testid="view-modal-form-title">{form?.title}</div>
            </div>
        ) : null,
}));


describe('FormsManagementPage (Unit)', () => {
    const mockedUsePermissions = vi.mocked(usePermissions);

    beforeEach(() => {
        vi.clearAllMocks();

        mockedUsePermissions.mockReturnValue({
            permissions: {
                canViewField: () => true,
                canEditField: () => true,
            },
            userRole: 'admin',
            userData: { displayName: 'Admin User' },
            user: { uid: 'admin-123', displayName: 'Admin User' },
            loading: false,
            error: null,
        } as unknown as ReturnType<typeof usePermissions>);
    });

    // SETUP FUNCTION FOR UNIT TESTS
    const setupUnit = async (data?: TestData) => {

        if (data) {
            mockGetAllForms.mockResolvedValue(data.forms);
            mockGetAllSubmissionsWithDetails.mockResolvedValue(data.submissions);
        } else {
            // Default empty or minimal if no data provided, though shared tests usually provide it
            mockGetAllForms.mockResolvedValue([]);
            mockGetAllSubmissionsWithDetails.mockResolvedValue([]);
        }

        mockDeleteForm.mockResolvedValue(undefined);

        render(
            <MemoryRouter>
                <FormsManagementPage />
            </MemoryRouter>
        );
    };

    // EXECUTE SHARED TESTS
    runFormsManagementPageTests(setupUnit, {
        afterDelete: async (formId) => {
            expect(mockDeleteForm).toHaveBeenCalledWith(formId);
        },
        onExport: async () => {
            expect(mockExportSubmissionsToCSV).toHaveBeenCalled();
        }
    });

    // UNIT-SPECIFIC TESTS (Error handling, etc.)

    test('shows error state when loading fails', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

        mockGetAllForms.mockRejectedValue(new Error('Failed to load forms'));
        mockGetAllSubmissionsWithDetails.mockRejectedValue(new Error('Failed to load submissions'));

        render(
            <MemoryRouter>
                <FormsManagementPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Unable to load forms data/i)).toBeInTheDocument();
        });

        consoleError.mockRestore();
    });

    test('error banner close button clears error state', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
        const user = userEvent.setup({ pointerEventsCheck: 0 });

        mockGetAllForms.mockRejectedValue(new Error('Failed to load forms'));
        mockGetAllSubmissionsWithDetails.mockRejectedValue(new Error('Failed to load submissions'));

        render(
            <MemoryRouter>
                <FormsManagementPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Unable to load forms data/i)).toBeInTheDocument();
        });

        const closeButton = screen.getByTitle('Dismiss error');
        await user.click(closeButton);

        await waitFor(() => {
            expect(screen.queryByText(/Unable to load forms data/i)).not.toBeInTheDocument();
        });

        consoleError.mockRestore();
    });
});
