import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MyFormsPage from '@/pages/parent/MyFormsPage';

// Mock services
vi.mock('@/services/formService.js', () => ({
  getFormSubmissions: vi.fn(),
  getActiveForms: vi.fn(),
  incrementFormViewCount: vi.fn(),
  getUserFormSubmission: vi.fn(),
}));

// Mock kidService to prevent Firestore connection (both possible import paths)
vi.mock('../../services/kidService', () => ({
  getKidById: vi.fn().mockResolvedValue({
    personalInfo: { firstName: 'Test Kid' },
  }),
}));

vi.mock('@/services/kidService', () => ({
  getKidById: vi.fn().mockResolvedValue({
    personalInfo: { firstName: 'Test Kid' },
  }),
}));

// Mock usePermissions hook
vi.mock('@/hooks/usePermissions', () => ({
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
    appliedTheme: 'light',
  })),
}));

// Mock Dashboard component to avoid its auth/routing logic
vi.mock('@/components/layout/Dashboard', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard">{children}</div>
  ),
}));

// Mock modals to track when they're opened
vi.mock('@/components/modals/FormSubmissionModal', () => ({
  default: ({ isOpen, onClose, form }: { isOpen: boolean; onClose: () => void; form: unknown }) =>
    isOpen ? (
      <div data-testid="form-submission-modal">
        <button onClick={onClose}>Close</button>
        <div data-testid="modal-form-title">{(form as { title?: string })?.title}</div>
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

vi.mock('@/components/modals/ViewSubmissionModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="view-submission-modal" /> : null,
}));

vi.mock('@/components/modals/EditSubmissionModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="edit-submission-modal" /> : null,
}));

import { usePermissions } from '@/hooks/usePermissions';
import { getActiveForms, getUserFormSubmission, incrementFormViewCount } from '@/services/formService.js';

const mockedUsePermissions = vi.mocked(usePermissions);
const mockedGetActiveForms = vi.mocked(getActiveForms);
const mockedGetUserFormSubmission = vi.mocked(getUserFormSubmission);
const mockedIncrementFormViewCount = vi.mocked(incrementFormViewCount);

// Test data
const mockFormsData = [
  {
    id: 'form-1',
    title: 'Summer Event Registration',
    description: 'Register for the summer rally event',
    status: 'active',
    targetAudience: 'parent',
    viewCount: 5,
    eventDetails: {
      dayAndDate: 'June 15, 2025',
      location: 'City Park',
      hours: '9:00 AM - 5:00 PM',
    },
  },
  {
    id: 'form-2',
    title: 'Winter Training Session',
    description: 'Sign up for winter training',
    status: 'active',
    targetAudience: 'parent',
    viewCount: 3,
    eventDetails: {
      dayAndDate: 'December 10, 2024',
      location: 'Indoor Arena',
    },
  },
];

const mockSubmissionData = {
  id: 'submission-1',
  formId: 'form-1',
  submitterId: 'user-123',
  confirmationStatus: 'attending',
  attendeesCount: 2,
  kidIds: [], // Empty to avoid triggering kid name loading
  submittedAt: new Date('2024-01-15'),
  formTitle: 'Summer Event Registration',
};

function setupDefaultMocks() {
  mockedUsePermissions.mockReturnValue({
    permissions: {
      canViewField: () => true,
      canEditField: () => true,
    },
    userRole: 'parent',
    userData: { displayName: 'Parent User' },
    user: { uid: 'user-123', displayName: 'Parent User' },
    loading: false,
    error: null,
  } as unknown as ReturnType<typeof usePermissions>);

  mockedGetActiveForms.mockResolvedValue(mockFormsData);
  mockedGetUserFormSubmission.mockResolvedValue(null);
  mockedIncrementFormViewCount.mockResolvedValue(undefined);
}

function renderMyFormsPage() {
  return render(
    <MemoryRouter>
      <MyFormsPage />
    </MemoryRouter>
  );
}

describe('MyFormsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
  });

  describe('loading states', () => {
    test('shows loading state while forms are being fetched', async () => {
      // Make getActiveForms never resolve during this test
      mockedGetActiveForms.mockImplementation(() => new Promise(() => {}));

      renderMyFormsPage();

      // Component shows loading state in multiple sections
      const loadingTexts = screen.getAllByText('Loading forms...');
      expect(loadingTexts.length).toBeGreaterThan(0);
    });

    test('displays forms after loading completes', async () => {
      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
      });

      expect(screen.getByText('Winter Training Session')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    test('shows empty state when no forms are available', async () => {
      mockedGetActiveForms.mockResolvedValue([]);

      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('No Forms Available')).toBeInTheDocument();
      });

      expect(screen.getByText('There are no active forms available at the moment.')).toBeInTheDocument();
    });

    test('shows empty state when no submissions exist', async () => {
      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('No Submissions Yet')).toBeInTheDocument();
      });

      expect(screen.getByText("You haven't submitted any forms yet. Check the available forms below!")).toBeInTheDocument();
    });
  });

  describe('form view functionality', () => {
    test('"View" button opens the FormViewModal with correct form', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
      });

      // Find the View button for the first form in Available Forms section
      const availableFormsSection = screen.getByText('Available Forms').closest('.forms-section') as HTMLElement;
      const viewButtons = within(availableFormsSection).getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // FormViewModal should be open
      await waitFor(() => {
        expect(screen.getByTestId('form-view-modal')).toBeInTheDocument();
      });

      // Verify the correct form was passed
      expect(screen.getByTestId('view-modal-form-title')).toHaveTextContent('Summer Event Registration');
    });

    test('"View" button increments view count', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
      });

      const availableFormsSection = screen.getByText('Available Forms').closest('.forms-section') as HTMLElement;
      const viewButtons = within(availableFormsSection).getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      expect(mockedIncrementFormViewCount).toHaveBeenCalledWith('form-1');
    });
  });

  describe('form submission functionality', () => {
    test('"Fill Form" button opens FormSubmissionModal with correct form', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
      });

      // Find the Fill Form button
      const fillFormButtons = screen.getAllByRole('button', { name: /fill form/i });
      await user.click(fillFormButtons[0]);

      // FormSubmissionModal should be open
      await waitFor(() => {
        expect(screen.getByTestId('form-submission-modal')).toBeInTheDocument();
      });

      // Verify the correct form was passed
      expect(screen.getByTestId('modal-form-title')).toHaveTextContent('Summer Event Registration');
    });
  });

  describe('submissions display', () => {
    test('shows empty submissions state initially and displays forms', async () => {
      renderMyFormsPage();

      // Wait for forms to load
      await waitFor(() => {
        expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
      });

      // Should show empty submissions message when no submissions
      expect(screen.getByText('No Submissions Yet')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    test('shows error state when form loading fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockedGetActiveForms.mockRejectedValue(new Error('Failed to load forms'));

      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Forms')).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    test('retry button is available when error occurs', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockedGetActiveForms.mockRejectedValue(new Error('Failed to load forms'));

      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Forms')).toBeInTheDocument();
      });

      // Retry button should be present
      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('event details display', () => {
    test('displays event location and date from form details', async () => {
      renderMyFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
      });

      // Should show event details
      expect(screen.getByText('City Park')).toBeInTheDocument();
      expect(screen.getByText('June 15, 2025')).toBeInTheDocument();
    });
  });
});
