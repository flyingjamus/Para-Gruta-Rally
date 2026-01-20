import { describe, vi, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ParentDashboardPage from '@/pages/parent/ParentDashboardPage';
import { runParentDashboardTests, TestData } from './ParentDashboardPage.tests';
import { usePermissions } from '@/hooks/usePermissions';
import userEvent from '@testing-library/user-event';

// --- MOCKS ---
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('firebase/firestore', () => ({
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    doc: (...args: unknown[]) => mockDoc(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    where: (...args: unknown[]) => mockWhere(...args),
    orderBy: (...args: unknown[]) => mockOrderBy(...args),
}));

vi.mock('@/firebase/config', () => ({
    db: {},
}));

vi.mock('@/hooks/usePermissions', () => ({
    usePermissions: vi.fn(),
}));

// Mock useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: vi.fn(() => ({
        t: (key: string, fallback: string) => fallback,
        isRTL: false,
    })),
}));

vi.mock('@/components/layout/Dashboard', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dashboard">{children}</div>
    ),
}));

const mockEditModal = vi.fn();
vi.mock('@/components/modals/ParentKidEditModal', () => ({
    default: (props: any) => {
        mockEditModal(props);
        return props.isOpen ? <div data-testid="parent-kid-edit-modal">Edit Modal</div> : null;
    },
}));

// --- HELPER TO CREATE SNAPSHOTS ---
function createMockFirestoreSnapshot(docs: Array<{ id: string;[key: string]: unknown }>) {
    return {
        docs: docs.map((data) => ({
            id: data.id,
            data: () => data,
        })),
    };
}

describe('ParentDashboardPage (Unit)', () => {
    const mockedUsePermissions = vi.mocked(usePermissions);

    beforeEach(() => {
        vi.clearAllMocks();

        mockedUsePermissions.mockReturnValue({
            permissions: {
                canViewField: () => true,
                canEditField: () => true,
            },
            userRole: 'parent',
            userData: { displayName: 'John Smith' },
            user: { uid: 'parent-123', displayName: 'John Smith' },
            loading: false,
            error: null,
        } as unknown as ReturnType<typeof usePermissions>);
    });

    const setupUnit = async (data?: TestData) => {
        if (!data) return;

        mockGetDocs.mockResolvedValue(createMockFirestoreSnapshot(data.kids));

        // Default mocks for firestore calls
        mockUpdateDoc.mockResolvedValue(undefined);
        mockDoc.mockReturnValue({ id: 'mock-doc-ref' });
        mockCollection.mockReturnValue({ id: 'kids' });
        mockQuery.mockReturnValue({ id: 'mock-query' });
        mockWhere.mockReturnValue({ id: 'mock-where' });

        render(
            <MemoryRouter>
                <ParentDashboardPage />
            </MemoryRouter>
        );
    };

    // EXECUTE SHARED TESTS
    runParentDashboardTests(setupUnit, {
        afterCommentSaved: ({ kidId, comment }) => {
            // Verify the update call arguments
            // Note: implementation detail - it updates 'comments.parent'
            const updateCall = mockUpdateDoc.mock.calls.find(call =>
                typeof call[1] === 'object' && 'comments.parent' in call[1]
            );
            expect(updateCall).toBeTruthy();
            expect(updateCall![1]).toEqual(expect.objectContaining({ 'comments.parent': comment }));
        },
        mockEditModal: mockEditModal
    });

    // --- UNIT ONLY TESTS ---

    test('shows loading state while data is being fetched', async () => {
        mockGetDocs.mockImplementation(() => new Promise(() => { }));
        render(
            <MemoryRouter>
                <ParentDashboardPage />
            </MemoryRouter>
        );
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('shows error state when user is not a parent', async () => {
        mockedUsePermissions.mockReturnValue({
            permissions: {
                canViewField: () => true,
                canEditField: () => true,
            },
            userRole: 'instructor',
            userData: { displayName: 'Instructor User' },
            user: { uid: 'instructor-123', displayName: 'Instructor User' },
            loading: false,
            error: null,
        } as unknown as ReturnType<typeof usePermissions>);

        render(
            <MemoryRouter>
                <ParentDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Access denied: Parent credentials required')).toBeInTheDocument();
        });
    });

    test('shows empty state when parent has no kids', async () => {
        await setupUnit({ kids: [] });
        await waitFor(() => {
            expect(screen.getByText('No Kids Found')).toBeInTheDocument();
            expect(screen.getByText("You don't have any kids registered in the system yet")).toBeInTheDocument();
        });
    });

    test('"Save" shows error on failure', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

        // We can simulate an error here easily with mocks
        mockUpdateDoc.mockRejectedValue(new Error('Permission denied'));
        mockGetDocs.mockResolvedValue(createMockFirestoreSnapshot([
            {
                id: 'kid-1',
                participantNumber: '001',
                personalInfo: { firstName: 'Emma', lastName: 'Smith' },
                comments: { parent: 'Original' },
                // ... minimal required fields
            } as any
        ]));
        mockDoc.mockReturnValue({});

        render(
            <MemoryRouter>
                <ParentDashboardPage />
            </MemoryRouter>
        );

        await waitFor(() => expect(screen.getByText('Emma Smith')).toBeInTheDocument());

        // Expand and Edit
        const emmaCard = screen.getByText('Emma Smith').closest('.kid-card') as HTMLElement;
        const emmaHeader = within(emmaCard).getByText('Emma Smith').closest('.kid-header') as HTMLElement;
        await user.click(emmaHeader);

        const commentsSection = screen.getByText('My Comments').closest('.detail-section') as HTMLElement;
        await user.click(within(commentsSection).getByRole('button', { name: /edit/i }));

        const textarea = screen.getByRole('textbox');
        await user.clear(textarea);
        await user.type(textarea, 'Fail comment');

        await user.click(within(commentsSection).getByRole('button', { name: /save/i }));

        await waitFor(() => expect(consoleError).toHaveBeenCalled());

        consoleError.mockRestore();
    });
});
