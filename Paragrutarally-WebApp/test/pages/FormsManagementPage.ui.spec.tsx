import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FormsManagementPage from '@/pages/admin/FormsManagementPage';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock services
vi.mock('@/services/formService.js', () => ({
  getAllForms: vi.fn(),
  getAllSubmissionsWithDetails: vi.fn(),
  deleteForm: vi.fn(),
}));

vi.mock('@/utils/formatUtils.js', () => ({
  exportSubmissionsToCSV: vi.fn(),
}));

// Mock usePermissions hook
vi.mock('@/hooks/usePermissions.jsx', () => ({
  usePermissions: vi.fn(),
}));

// Mock useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string, fallback: string) => fallback,
    currentLanguage: 'en',
    isRTL: false,
  })),
}));

// Mock useTheme hook
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({
    isDarkMode: false,
    appliedTheme: 'light',
  })),
}));

// Mock Dashboard component
vi.mock('@/components/layout/Dashboard', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard">{children}</div>
  ),
}));

// Mock modals
vi.mock('@/components/modals/FormCreationModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="form-creation-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/FormEditModal', () => ({
  default: ({ isOpen, onClose, form }: { isOpen: boolean; onClose: () => void; form: unknown }) =>
    isOpen ? (
      <div data-testid="form-edit-modal">
        <button onClick={onClose}>Close</button>
        <div data-testid="edit-modal-form-title">{(form as { title?: string })?.title}</div>
      </div>
    ) : null,
}));

vi.mock('@/components/modals/FormViewModal', () => ({
  default: ({ isOpen, onClose, form }: { isOpen: boolean; onClose: () => void; form: unknown }) =>
    isOpen ? (
      <div data-testid="form-view-modal">
        <button onClick={onClose}>Close</button>
        <div data-testid="view-modal-form-title">{(form as { title?: string })?.title}</div>
      </div>
    ) : null,
}));

import { usePermissions } from '@/hooks/usePermissions.jsx';
import { getAllForms, getAllSubmissionsWithDetails, deleteForm } from '@/services/formService.js';

const mockedUsePermissions = vi.mocked(usePermissions);
const mockedGetAllForms = vi.mocked(getAllForms);
const mockedGetAllSubmissionsWithDetails = vi.mocked(getAllSubmissionsWithDetails);
const mockedDeleteForm = vi.mocked(deleteForm);

// Test data
const mockFormsData = [
  {
    id: 'form-1',
    title: 'Event Registration Form',
    description: 'Register for the upcoming event',
    status: 'active',
    targetAudience: 'parent',
    viewCount: 25,
    createdAt: new Date('2024-01-01'),
    eventDetails: {
      dayAndDate: 'March 15, 2025',
      location: 'City Arena',
    },
  },
  {
    id: 'form-2',
    title: 'Instructor Survey',
    description: 'Feedback form for instructors',
    status: 'draft',
    targetAudience: 'instructor',
    viewCount: 5,
    createdAt: new Date('2024-02-01'),
  },
];

const mockSubmissionsData = [
  {
    id: 'submission-1',
    formId: 'form-1',
    submitterId: 'user-1',
    confirmationStatus: 'attending',
    submittedAt: new Date('2024-01-20'),
  },
  {
    id: 'submission-2',
    formId: 'form-1',
    submitterId: 'user-2',
    confirmationStatus: 'needs to decide',
    submittedAt: new Date('2024-01-22'),
  },
];

function setupDefaultMocks() {
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

  mockedGetAllForms.mockResolvedValue(mockFormsData);
  mockedGetAllSubmissionsWithDetails.mockResolvedValue(mockSubmissionsData);
  mockedDeleteForm.mockResolvedValue(undefined);
}

function renderFormsManagementPage() {
  return render(
    <MemoryRouter>
      <FormsManagementPage />
    </MemoryRouter>
  );
}

describe('FormsManagementPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
    // Reset window.confirm mock
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  describe('loading states', () => {
    test('shows loading state while forms are being fetched', async () => {
      mockedGetAllForms.mockImplementation(() => new Promise(() => { }));
      mockedGetAllSubmissionsWithDetails.mockImplementation(() => new Promise(() => { }));

      renderFormsManagementPage();

      expect(screen.getByText('Loading forms...')).toBeInTheDocument();
    });

    test('displays forms after loading completes', async () => {
      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: 'Instructor Survey' })).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    test('shows empty state when no forms exist', async () => {
      mockedGetAllForms.mockResolvedValue([]);
      mockedGetAllSubmissionsWithDetails.mockResolvedValue([]);

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByText('No Forms Found')).toBeInTheDocument();
      });

      expect(screen.getByText("You haven't created any forms yet")).toBeInTheDocument();
    });
  });

  describe('create form functionality', () => {
    test('"Create Form" button opens FormCreationModal', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
      });

      // Find and click the Create Form button in Quick Actions
      const quickActions = screen.getByText('Quick Actions').closest('.quick-actions') as HTMLElement;
      const createButton = within(quickActions).getByRole('button', { name: /create new form/i });
      await user.click(createButton);

      // FormCreationModal should be open
      await waitFor(() => {
        expect(screen.getByTestId('form-creation-modal')).toBeInTheDocument();
      });
    });
  });

  describe('form view functionality', () => {
    test('"View" button opens FormViewModal with correct form', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
      });

      // Find the first form card and click it (clicking the card opens View Modal)
      const formCard = screen.getByRole('heading', { name: 'Event Registration Form' }).closest('.form-card') as HTMLElement;
      await user.click(formCard);

      // FormViewModal should be open
      await waitFor(() => {
        expect(screen.getByTestId('form-view-modal')).toBeInTheDocument();
      });

      expect(screen.getByTestId('view-modal-form-title')).toHaveTextContent('Event Registration Form');
    });
  });

  describe('form edit functionality', () => {
    test('"Edit" button opens FormEditModal with correct form', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
      });

      // Find the first form card and its Edit button
      const formCard = screen.getByRole('heading', { name: 'Event Registration Form' }).closest('.form-card') as HTMLElement;
      const editButton = within(formCard).getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // FormEditModal should be open
      await waitFor(() => {
        expect(screen.getByTestId('form-edit-modal')).toBeInTheDocument();
      });

      expect(screen.getByTestId('edit-modal-form-title')).toHaveTextContent('Event Registration Form');
    });
  });

  describe('form delete functionality', () => {
    test('"Delete" button shows confirmation dialog', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
      });

      // Find the first form card and its Delete button
      const formCard = screen.getByRole('heading', { name: 'Event Registration Form' }).closest('.form-card') as HTMLElement;
      const deleteButton = within(formCard).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirmation dialog should have been shown
      expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this form?');
    });

    test('"Delete" calls deleteForm when confirmed', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
      });

      const formCard = screen.getByRole('heading', { name: 'Event Registration Form' }).closest('.form-card') as HTMLElement;
      const deleteButton = within(formCard).getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockedDeleteForm).toHaveBeenCalledWith('form-1');
      });
    });
  });

  describe('analytics display', () => {
    test('displays correct analytics counts', async () => {
      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
      });

      // Should show analytics cards
      // Total Forms: 2
      const totalFormsCard = screen.getByText('Total Forms').closest('.analytics-card') as HTMLElement;
      expect(within(totalFormsCard).getByText('2')).toBeInTheDocument();

      // Total Submissions: 2
      const allSubmissionsLabels = screen.getAllByText('Submissions');
      const submissionsCard = allSubmissionsLabels.find(el => el.closest('.analytics-card'))?.closest('.analytics-card') as HTMLElement;
      expect(within(submissionsCard).getByText('2')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    test('search input filters forms by title', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Instructor Survey' })).toBeInTheDocument();
      });

      // Find the search input
      const searchInput = screen.getByPlaceholderText(/search forms/i);
      await user.type(searchInput, 'Event');

      // Only Event Registration Form should be visible
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Instructor Survey' })).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    test('shows error state when loading fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

      mockedGetAllForms.mockRejectedValue(new Error('Failed to load forms'));
      mockedGetAllSubmissionsWithDetails.mockRejectedValue(new Error('Failed to load submissions'));

      renderFormsManagementPage();

      await waitFor(() => {
        expect(screen.getByText('Unable to load forms data. Please check your connection and try again.')).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });
});
