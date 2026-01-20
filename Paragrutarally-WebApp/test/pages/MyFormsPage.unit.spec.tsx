import { describe, vi, beforeEach, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyFormsPage from '@/pages/parent/MyFormsPage';
import { runMyFormsPageTests, TestData, defaultForms, defaultSubmissions } from './MyFormsPage.tests';
import { usePermissions } from '@/hooks/usePermissions';
import { getActiveForms, getUserFormSubmission, incrementFormViewCount } from '@/services/formService.js';

// Mock services
vi.mock('@/services/formService.js', () => ({
    getActiveForms: vi.fn(),
    incrementFormViewCount: vi.fn(),
    getUserFormSubmission: vi.fn(),
}));

// Mock kidService
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

// Mock Dashboard component
vi.mock('@/components/layout/Dashboard', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dashboard">{children}</div>
    ),
}));

// Mock modals
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

describe('MyFormsPage (Unit)', () => {
    const mockedUsePermissions = vi.mocked(usePermissions);
    const mockedGetActiveForms = vi.mocked(getActiveForms);
    const mockedGetUserFormSubmission = vi.mocked(getUserFormSubmission);
    const mockedIncrementFormViewCount = vi.mocked(incrementFormViewCount);

    beforeEach(() => {
        vi.clearAllMocks();

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

        // Default mocks to avoid crashes if setupFn not fully called or for extra calls
        mockedGetActiveForms.mockResolvedValue([]);
        mockedGetUserFormSubmission.mockResolvedValue(null);
        mockedIncrementFormViewCount.mockResolvedValue(undefined);
    });

    const setupUnit = async (data?: TestData, options?: { simulateError?: boolean }) => {
        if (options?.simulateError) {
            mockedGetActiveForms.mockRejectedValue(new Error('Failed to load forms'));
            vi.spyOn(console, 'error').mockImplementation(() => { });
            render(
                <MemoryRouter>
                    <MyFormsPage />
                </MemoryRouter>
            );
            return;
        }

        if (data) {
            mockedGetActiveForms.mockResolvedValue(data.forms);
            mockedGetUserFormSubmission.mockImplementation(async (userId, formId) => {
                return data.submissions.find(s => s.formId === formId) || null;
            });
        }

        render(
            <MemoryRouter>
                <MyFormsPage />
            </MemoryRouter>
        );
    };

    test('shows loading state while forms are being fetched', async () => {
        mockedGetActiveForms.mockImplementation(() => new Promise(() => { }));
        render(
            <MemoryRouter>
                <MyFormsPage />
            </MemoryRouter>
        );
        const loadingTexts = screen.getAllByText('Loading forms...');
        expect(loadingTexts.length).toBeGreaterThan(0);
    });

    runMyFormsPageTests(setupUnit, {
        afterViewFormClicked: async (formId) => {
            expect(mockedIncrementFormViewCount).toHaveBeenCalledWith(formId);
        }
    });
});
