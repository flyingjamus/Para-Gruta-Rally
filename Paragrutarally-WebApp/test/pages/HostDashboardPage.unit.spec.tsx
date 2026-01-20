import { describe, vi, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HostDashboardPage from '@/pages/host/HostDashboardPage';
import { runHostDashboardTests, TestData } from './HostDashboardPage.tests';
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

// Stable mock for LanguageContext
const mockT = (key: string, fallback: string) => fallback;
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: mockT,
    isRTL: false,
  })),
}));

vi.mock('@/components/layout/Dashboard', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard">{children}</div>
  ),
}));

// --- HELPER TO CREATE SNAPSHOTS ---
function createMockFirestoreSnapshot(docs: Array<{ id: string; [key: string]: unknown }>) {
  return {
    docs: docs.map((data) => ({
      id: data.id,
      data: () => data,
    })),
  };
}

describe('HostDashboardPage (Unit)', () => {
  const mockedUsePermissions = vi.mocked(usePermissions);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUsePermissions.mockReturnValue({
      permissions: {
        canViewField: () => true,
        canEditField: () => true,
      },
      userRole: 'guest',
      userData: { displayName: 'Host User' },
      user: { uid: 'host-123', displayName: 'Host User' },
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof usePermissions>);
  });

  // SETUP FUNCTION FOR UNIT TESTS
  const setupUnit = async (data?: TestData) => {
    if (!data) return;

    mockGetDocs
      .mockResolvedValueOnce(createMockFirestoreSnapshot(data.events))
      .mockResolvedValueOnce(createMockFirestoreSnapshot(data.participants));

    mockUpdateDoc.mockResolvedValue(undefined);
    mockDoc.mockImplementation((_db: unknown, collectionName: string, docId: string) => ({
      collectionName,
      docId,
    }));
    mockCollection.mockReturnValue({ id: 'collection' });
    mockQuery.mockReturnValue({ id: 'mock-query' });

    render(
      <MemoryRouter>
        <HostDashboardPage />
      </MemoryRouter>
    );
  };

  // EXECUTE SHARED TESTS
  runHostDashboardTests(setupUnit, {
    afterCommentSaved: ({ kidId, comment }) => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { collectionName: 'kids', docId: kidId },
        { 'comments.organization': comment }
      );
    },
  });

  test('denies access for non-host/guest roles', async () => {
    mockedUsePermissions.mockReturnValue({
      permissions: {
        canViewField: () => true,
        canEditField: () => true,
      },
      userRole: 'parent',
      userData: { displayName: 'Parent User' },
      user: { uid: 'parent-123', displayName: 'Parent User' },
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof usePermissions>);

    render(
      <MemoryRouter>
        <HostDashboardPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('Access denied: Host/Guest credentials required')
    ).toBeInTheDocument();
  });

  test('allows host role to view the dashboard', async () => {
    mockedUsePermissions.mockReturnValue({
      permissions: {
        canViewField: () => true,
        canEditField: () => true,
      },
      userRole: 'host',
      userData: { displayName: 'Host User' },
      user: { uid: 'host-123', displayName: 'Host User' },
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof usePermissions>);

    await setupUnit({
      events: [{ id: 'event-1', name: 'Event', eventDate: '2025-06-15', participatingTeams: ['team-1'], status: 'active' }],
      participants: [
        {
          id: 'kid-1',
          participantNumber: '001',
          teamId: 'team-1',
          personalInfo: { firstName: 'Alex', lastName: 'Johnson', capabilities: 'None' },
          comments: { organization: '' },
          signedFormStatus: 'completed',
          signedDeclaration: true,
        },
      ],
    });

    expect(await screen.findByText('Host Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
  });

  test('redacts fields when permissions disallow viewing', async () => {
    mockedUsePermissions.mockReturnValue({
      permissions: {
        canViewField: (fieldPath: string) => fieldPath !== 'personalInfo.lastName',
        canEditField: () => true,
      },
      userRole: 'guest',
      userData: { displayName: 'Host User' },
      user: { uid: 'host-123', displayName: 'Host User' },
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof usePermissions>);

    await setupUnit({
      events: [{ id: 'event-1', name: 'Event', eventDate: '2025-06-15', participatingTeams: ['team-1'], status: 'active' }],
      participants: [
        {
          id: 'kid-1',
          participantNumber: '001',
          teamId: 'team-1',
          personalInfo: { firstName: 'Alex', lastName: 'Johnson', capabilities: 'None' },
          comments: { organization: '' },
          signedFormStatus: 'completed',
          signedDeclaration: true,
        },
      ],
    });

    await screen.findByText('Alex');
    expect(screen.queryByText('Johnson')).not.toBeInTheDocument();
  });

  test('hides organization comments when not editable', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    mockedUsePermissions.mockReturnValue({
      permissions: {
        canViewField: () => true,
        canEditField: () => false,
      },
      userRole: 'guest',
      userData: { displayName: 'Host User' },
      user: { uid: 'host-123', displayName: 'Host User' },
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof usePermissions>);

    await setupUnit({
      events: [{ id: 'event-1', name: 'Event', eventDate: '2025-06-15', participatingTeams: ['team-1'], status: 'active' }],
      participants: [
        {
          id: 'kid-1',
          participantNumber: '001',
          teamId: 'team-1',
          personalInfo: { firstName: 'Alex', lastName: 'Johnson', capabilities: 'None' },
          comments: { organization: '' },
          signedFormStatus: 'completed',
          signedDeclaration: true,
        },
      ],
    });

    await screen.findByText('Alex Johnson');
    const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
    const toggle = within(alexCard).getByRole('button', { name: /alex johnson/i });
    await user.click(toggle);
    expect(within(alexCard).queryByText('Organization Comments')).not.toBeInTheDocument();
  });
});
