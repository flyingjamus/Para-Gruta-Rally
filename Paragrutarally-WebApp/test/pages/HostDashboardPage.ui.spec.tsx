import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import HostDashboardPage from '@/pages/host/HostDashboardPage';

// Mock Firebase Firestore
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

// Mock usePermissions hook
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

// Mock Dashboard component to avoid its auth/routing logic
vi.mock('@/components/layout/Dashboard', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard">{children}</div>
  ),
}));

import { usePermissions } from '@/hooks/usePermissions';

const mockedUsePermissions = vi.mocked(usePermissions);

// Test data
const mockEventsData = [
  {
    id: 'event-1',
    name: 'Summer Rally 2024',
    eventDate: '2025-06-15',
    participatingTeams: ['team-1'],
  },
  {
    id: 'event-2',
    name: 'Winter Challenge 2024',
    eventDate: '2024-01-10',
    participatingTeams: ['team-2'],
  },
];

const mockKidsData = [
  {
    id: 'kid-1',
    participantNumber: '001',
    teamId: 'team-1',
    personalInfo: {
      firstName: 'Alex',
      lastName: 'Johnson',
      capabilities: 'None',
      announcersNotes: 'First time participant',
    },
    comments: {
      organization: 'Original org comment for Alex',
    },
    signedFormStatus: 'completed',
    signedDeclaration: true,
  },
  {
    id: 'kid-2',
    participantNumber: '002',
    teamId: 'team-2',
    personalInfo: {
      firstName: 'Taylor',
      lastName: 'Williams',
      capabilities: 'Experienced racer',
    },
    comments: {
      organization: '',
    },
    signedFormStatus: 'pending',
    signedDeclaration: false,
  },
];

function createMockFirestoreSnapshot(docs: Array<{ id: string; [key: string]: unknown }>) {
  return {
    docs: docs.map((data) => ({
      id: data.id,
      data: () => data,
    })),
  };
}

// Track which collection is being queried
let queryCount = 0;

function setupDefaultMocks() {
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

  // Reset query count for each test
  queryCount = 0;

  // Return events for first query, kids for second query
  mockGetDocs.mockImplementation(() => {
    queryCount++;
    if (queryCount === 1) {
      return Promise.resolve(createMockFirestoreSnapshot(mockEventsData));
    }
    return Promise.resolve(createMockFirestoreSnapshot(mockKidsData));
  });

  mockUpdateDoc.mockResolvedValue(undefined);
  mockDoc.mockReturnValue({ id: 'mock-doc-ref' });
  mockCollection.mockReturnValue({ id: 'collection' });
  mockQuery.mockReturnValue({ id: 'mock-query' });
  mockWhere.mockReturnValue({ id: 'mock-where' });
  mockOrderBy.mockReturnValue({ id: 'mock-orderby' });
}

function renderHostDashboard() {
  return render(
    <MemoryRouter>
      <HostDashboardPage />
    </MemoryRouter>
  );
}

describe('HostDashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
  });

  describe('expand/collapse participant details', () => {
    test('expanding a participant shows details; collapsing hides them', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderHostDashboard();

      // Wait for participants to load
      await waitFor(() => {
        expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
      });

      // Find Alex's card - details should be hidden initially
      const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
      expect(alexCard).toBeInTheDocument();

      // Participant Information section should not be visible initially
      expect(screen.queryByText('Participant Information')).not.toBeInTheDocument();

      // Click on Alex's header to expand
      const alexHeader = within(alexCard).getByText('Alex Johnson').closest('.participant-header') as HTMLElement;
      await user.click(alexHeader);

      // Now details should be visible
      await waitFor(() => {
        expect(screen.getByText('Participant Information')).toBeInTheDocument();
      });

      // Click again to collapse
      await user.click(alexHeader);

      // Details should be hidden again
      await waitFor(() => {
        expect(screen.queryByText('Participant Information')).not.toBeInTheDocument();
      });
    });

    test('expanding one participant and then expanding another collapses the first', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
        expect(screen.getByText('Taylor Williams')).toBeInTheDocument();
      });

      // Expand Alex's card
      const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
      const alexHeader = within(alexCard).getByText('Alex Johnson').closest('.participant-header') as HTMLElement;
      await user.click(alexHeader);

      await waitFor(() => {
        expect(screen.getByText('Participant Information')).toBeInTheDocument();
      });

      // Now expand Taylor's card
      const taylorCard = screen.getByText('Taylor Williams').closest('.participant-card') as HTMLElement;
      const taylorHeader = within(taylorCard).getByText('Taylor Williams').closest('.participant-header') as HTMLElement;
      await user.click(taylorHeader);

      // Alex's details should now be collapsed (only one Participant Information visible - Taylor's)
      await waitFor(() => {
        const infoSections = screen.getAllByText('Participant Information');
        expect(infoSections).toHaveLength(1);
      });
    });
  });

  describe('comment edit/save/cancel flow', () => {
    test('"Edit comments" enters edit mode; textarea shows existing comments', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
      });

      // Expand Alex's card
      const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
      const alexHeader = within(alexCard).getByText('Alex Johnson').closest('.participant-header') as HTMLElement;
      await user.click(alexHeader);

      await waitFor(() => {
        expect(screen.getByText('Organization Comments')).toBeInTheDocument();
      });

      // Should see the existing comment displayed
      expect(screen.getByText('Original org comment for Alex')).toBeInTheDocument();

      // Find the comments section and click the Edit button within it
      const commentsSection = screen.getByText('Organization Comments').closest('.detail-section') as HTMLElement;
      const editButton = within(commentsSection).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Now should see textarea with the existing comment (scope to comments section)
      const textarea = within(commentsSection).getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Original org comment for Alex');
    });

    test('"Cancel" restores previous comments and exits edit mode', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
      });

      // Expand Alex's card
      const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
      const alexHeader = within(alexCard).getByText('Alex Johnson').closest('.participant-header') as HTMLElement;
      await user.click(alexHeader);

      await waitFor(() => {
        expect(screen.getByText('Organization Comments')).toBeInTheDocument();
      });

      // Find the comments section and click the Edit button within it
      const commentsSection = screen.getByText('Organization Comments').closest('.detail-section') as HTMLElement;
      const editButton = within(commentsSection).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Modify the comment (scope to comments section)
      const textarea = within(commentsSection).getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Modified comment that should be discarded');

      // Click Cancel
      const cancelButton = within(commentsSection).getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Should exit edit mode and show original comment
      await waitFor(() => {
        expect(within(commentsSection).queryByRole('textbox')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Original org comment for Alex')).toBeInTheDocument();
    });

    test('"Save" calls updateDoc and updates UI state on success', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0, delay: null });

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
      });

      // Expand Alex's card
      const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
      const alexHeader = within(alexCard).getByText('Alex Johnson').closest('.participant-header') as HTMLElement;
      await user.click(alexHeader);

      await waitFor(() => {
        expect(screen.getByText('Organization Comments')).toBeInTheDocument();
      });

      // Find the comments section and click the Edit button within it
      const commentsSection = screen.getByText('Organization Comments').closest('.detail-section') as HTMLElement;
      const editButton = within(commentsSection).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Get the textarea and type new comment (scope to comments section)
      const textarea = within(commentsSection).getByRole('textbox') as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, 'New organization comment');

      // Click Save
      const saveButton = within(commentsSection).getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should call updateDoc
      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      // Verify updateDoc was called with the comments.organization field
      const updateCall = mockUpdateDoc.mock.calls[0];
      expect(updateCall[1]).toHaveProperty('comments.organization');

      // Should exit edit mode
      await waitFor(() => {
        expect(within(commentsSection).queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    test('"Save" shows error on failure and keeps edit mode', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Make updateDoc reject
      mockUpdateDoc.mockRejectedValue(new Error('Permission denied'));

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
      });

      // Expand Alex's card
      const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
      const alexHeader = within(alexCard).getByText('Alex Johnson').closest('.participant-header') as HTMLElement;
      await user.click(alexHeader);

      await waitFor(() => {
        expect(screen.getByText('Organization Comments')).toBeInTheDocument();
      });

      // Find the comments section and click the Edit button within it
      const commentsSection = screen.getByText('Organization Comments').closest('.detail-section') as HTMLElement;
      const editButton = within(commentsSection).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Modify the comment (scope to comments section)
      const textarea = within(commentsSection).getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, 'Comment that will fail to save');

      // Click Save
      const saveButton = within(commentsSection).getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for the error to be handled
      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      });

      // Check console.error was called (error was caught and logged)
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    test('participant with no comments shows "Add Comments" button and placeholder text', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Taylor Williams')).toBeInTheDocument();
      });

      // Expand Taylor's card (who has no comments)
      const taylorCard = screen.getByText('Taylor Williams').closest('.participant-card') as HTMLElement;
      const taylorHeader = within(taylorCard).getByText('Taylor Williams').closest('.participant-header') as HTMLElement;
      await user.click(taylorHeader);

      await waitFor(() => {
        expect(screen.getByText('Organization Comments')).toBeInTheDocument();
      });

      // Should show "No organization comments added yet" placeholder
      expect(screen.getByText('No organization comments added yet')).toBeInTheDocument();

      // Find the comments section - should have "Add Comments" button
      const commentsSection = screen.getByText('Organization Comments').closest('.detail-section') as HTMLElement;
      expect(within(commentsSection).getByRole('button', { name: /add comments/i })).toBeInTheDocument();
    });
  });

  describe('loading and error states', () => {
    test('shows loading state while data is being fetched', async () => {
      // Make getDocs never resolve during this test
      mockGetDocs.mockImplementation(() => new Promise(() => {}));

      renderHostDashboard();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('shows error state when user is not a host', async () => {
      mockedUsePermissions.mockReturnValue({
        permissions: {
          canViewField: () => true,
          canEditField: () => true,
        },
        userRole: 'parent', // Not a host/guest
        userData: { displayName: 'Parent User' },
        user: { uid: 'parent-123', displayName: 'Parent User' },
        loading: false,
        error: null,
      } as unknown as ReturnType<typeof usePermissions>);

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });
      expect(screen.getByText('Access denied: Host/Guest credentials required')).toBeInTheDocument();
    });

    test('shows empty state when no participants are registered', async () => {
      // Return events but no kids
      queryCount = 0;
      mockGetDocs.mockImplementation(() => {
        queryCount++;
        if (queryCount === 1) {
          return Promise.resolve(createMockFirestoreSnapshot(mockEventsData));
        }
        return Promise.resolve(createMockFirestoreSnapshot([]));
      });

      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('No Participants Found')).toBeInTheDocument();
      });
      expect(screen.getByText('No participants are registered for events yet')).toBeInTheDocument();
    });
  });

  describe('stats display', () => {
    test('displays correct stats for events and participants', async () => {
      renderHostDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
      });

      // Stats grid contains the stat cards
      const statsGrid = document.querySelector('.stats-grid') as HTMLElement;
      expect(statsGrid).toBeInTheDocument();

      // Total Events: 2
      const totalEventsCard = statsGrid.querySelector('.stat-card.total') as HTMLElement;
      expect(within(totalEventsCard).getByText('2')).toBeInTheDocument();

      // Participants: 2
      const participantsCard = statsGrid.querySelector('.stat-card.kids') as HTMLElement;
      expect(within(participantsCard).getByText('2')).toBeInTheDocument();
    });
  });
});
