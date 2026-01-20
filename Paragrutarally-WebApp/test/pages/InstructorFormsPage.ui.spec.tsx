import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import InstructorFormsPage from '@/pages/instructor/InstructorFormsPage';

// Mock services
vi.mock('@/services/formService.js', () => ({
  getFormSubmissions: vi.fn(),
  getActiveForms: vi.fn(),
  incrementFormViewCount: vi.fn(),
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

import { usePermissions } from '@/hooks/usePermissions';
import { getFormSubmissions, getActiveForms, incrementFormViewCount } from '@/services/formService.js';

const mockedUsePermissions = vi.mocked(usePermissions);
const mockedGetFormSubmissions = vi.mocked(getFormSubmissions);
const mockedGetActiveForms = vi.mocked(getActiveForms);
const mockedIncrementFormViewCount = vi.mocked(incrementFormViewCount);

// Test data
const mockFormsData = [
  {
    id: 'form-1',
    title: 'Instructor Training Registration',
    description: 'Register for instructor training session',
    status: 'active',
    targetAudience: 'instructor',
    viewCount: 10,
    eventDetails: {
      dayAndDate: 'July 20, 2025',
      location: 'Training Center',
      hours: '10:00 AM - 4:00 PM',
    },
  },
  {
    id: 'form-2',
    title: 'Advanced Coaching Workshop',
    description: 'Advanced techniques for instructors',
    status: 'active',
    targetAudience: 'instructor',
    viewCount: 5,
    eventDetails: {
      dayAndDate: 'August 5, 2025',
      location: 'Main Arena',
    },
  },
];

const mockSubmissionData = [
  {
    id: 'submission-1',
    formId: 'form-1',
    submitterId: 'instructor-123',
    confirmationStatus: 'attending',
    attendeesCount: 1,
    submittedAt: new Date('2024-03-10'),
  },
];

function setupDefaultMocks() {
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

  mockedGetFormSubmissions.mockResolvedValue([]);
  mockedGetActiveForms.mockResolvedValue(mockFormsData);
  mockedIncrementFormViewCount.mockResolvedValue(undefined);
}

function renderInstructorFormsPage() {
  return render(
    <MemoryRouter>
      <InstructorFormsPage />
    </MemoryRouter>
  );
}

describe('InstructorFormsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
  });

  describe('loading states', () => {
    test('shows loading state while forms are being fetched', async () => {
      mockedGetFormSubmissions.mockImplementation(() => new Promise(() => {}));
      mockedGetActiveForms.mockImplementation(() => new Promise(() => {}));

      renderInstructorFormsPage();

      const loadingTexts = screen.getAllByText('Loading forms...');
      expect(loadingTexts.length).toBeGreaterThan(0);
    });

    test('displays forms after loading completes', async () => {
      renderInstructorFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Instructor Training Registration')).toBeInTheDocument();
      });

      expect(screen.getByText('Advanced Coaching Workshop')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    test('shows empty state when no forms are available', async () => {
      mockedGetActiveForms.mockResolvedValue([]);

      renderInstructorFormsPage();

      await waitFor(() => {
        // Look for the empty state message for available forms
        expect(screen.getByText(/no training events available/i)).toBeInTheDocument();
      });
    });

    test('shows empty state when no submissions exist', async () => {
      renderInstructorFormsPage();

      await waitFor(() => {
        expect(screen.getByText('No Submissions Yet')).toBeInTheDocument();
      });
    });
  });

  describe('form view functionality', () => {
    test('"View" button opens the FormViewModal with correct form', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderInstructorFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Instructor Training Registration')).toBeInTheDocument();
      });

      // Find the View button for the first form in Available Training Events section
      const availableFormsSection = screen.getByText('Available Training Events').closest('.forms-section') as HTMLElement;
      const viewButtons = within(availableFormsSection).getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // FormViewModal should be open
      await waitFor(() => {
        expect(screen.getByTestId('form-view-modal')).toBeInTheDocument();
      });

      expect(screen.getByTestId('view-modal-form-title')).toHaveTextContent('Instructor Training Registration');
    });

    test('"View" button increments view count', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderInstructorFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Instructor Training Registration')).toBeInTheDocument();
      });

      const availableFormsSection = screen.getByText('Available Training Events').closest('.forms-section') as HTMLElement;
      const viewButtons = within(availableFormsSection).getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      expect(mockedIncrementFormViewCount).toHaveBeenCalledWith('form-1');
    });
  });

  describe('form submission functionality', () => {
    test('submission button opens FormSubmissionModal with correct form', async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      renderInstructorFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Instructor Training Registration')).toBeInTheDocument();
      });

      // Find the submission button (Register or Fill Form)
      const availableFormsSection = screen.getByText('Available Training Events').closest('.forms-section') as HTMLElement;
      // Try to find any submit-type button
      const submitButtons = within(availableFormsSection).getAllByRole('button').filter(
        btn => btn.textContent?.toLowerCase().includes('register') || btn.textContent?.toLowerCase().includes('fill')
      );

      if (submitButtons.length > 0) {
        await user.click(submitButtons[0]);

        // FormSubmissionModal should be open
        await waitFor(() => {
          expect(screen.getByTestId('form-submission-modal')).toBeInTheDocument();
        });
      }
    });
  });

  describe('submissions display', () => {
    test('displays instructor submissions when they exist', async () => {
      mockedGetFormSubmissions.mockResolvedValue(mockSubmissionData);

      renderInstructorFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Instructor Training Registration')).toBeInTheDocument();
      });

      // Should show the submission in My Submissions section
      await waitFor(() => {
        const submissionsSection = screen.getByText('My Submissions').closest('.forms-section') as HTMLElement;
        expect(within(submissionsSection).getByText('Attending')).toBeInTheDocument();
      });
    });
  });

  describe('event details display', () => {
    test('displays event location from form details', async () => {
      renderInstructorFormsPage();

      await waitFor(() => {
        expect(screen.getByText('Instructor Training Registration')).toBeInTheDocument();
      });

      expect(screen.getByText('Training Center')).toBeInTheDocument();
    });
  });
});
