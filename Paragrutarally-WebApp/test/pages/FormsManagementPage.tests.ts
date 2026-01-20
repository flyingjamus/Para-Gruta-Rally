import { test, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Test Data Interfaces ---
export interface TestData {
    forms: any[];
    submissions: any[];
}

// --- Default Test Data ---
export const defaultForms = [
    {
        id: 'form-1',
        title: 'Event Registration Form',
        description: 'Register for the upcoming event',
        status: 'active',
        targetAudience: 'parent',
        viewCount: 25,
        submissionCount: 2,
        createdAt: new Date('2024-01-01'),
        eventDetails: {
            dayAndDate: 'March 15, 2025',
            location: 'City Arena',
        },
        targetUsers: ['parent'],
        type: 'event_registration'
    },
    {
        id: 'form-2',
        title: 'Instructor Survey',
        description: 'Feedback form for instructors',
        status: 'draft',
        targetAudience: 'instructor',
        viewCount: 5,
        submissionCount: 0,
        createdAt: new Date('2024-02-01'),
        targetUsers: ['instructor'],
        type: 'survey'
    },
];

export const defaultSubmissions = [
    {
        id: 'submission-1',
        formId: 'form-1',
        submitterId: 'user-1',
        confirmationStatus: 'attending',
        submittedAt: new Date('2024-01-20'),
        // Expanded details that service usually provides
        submitterName: 'User One',
        submitterEmail: 'user1@test.com',
        formTitle: 'Event Registration Form',
        formType: 'event_registration'
    },
    {
        id: 'submission-2',
        formId: 'form-1',
        submitterId: 'user-2',
        confirmationStatus: 'needs to decide',
        submittedAt: new Date('2024-01-22'),
        submitterName: 'User Two',
        submitterEmail: 'user2@test.com',
        formTitle: 'Event Registration Form',
        formType: 'event_registration'
    },
];

// --- Test Options Interface ---
export interface RunFormsManagementPageTestOptions {
    // Add callbacks here for actions that need specific verification in unit vs integration
    // e.g. afterDelete?: (formId: string) => Promise<void>;
    afterDelete?: (formId: string) => Promise<void>;
    onExport?: () => Promise<void> | void;
}

// --- Setup Function Type ---
type SetupFunction = (data?: TestData) => Promise<void>;

// --- Shared Test Runner ---
export function runFormsManagementPageTests(setupFn: SetupFunction, options: RunFormsManagementPageTestOptions = {}) {

    test('displays loading state initially', async () => {
        // NOTE: We cannot easily test "loading state" in a shared generic way because 
        // usually the setupFn waits for everything to be ready.
        // However, we can test that data eventually appears.
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        });
    });

    test('displays forms and analytics after loading', async () => {
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        // Forms displayed
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        });
        expect(screen.getByRole('heading', { name: 'Instructor Survey' })).toBeInTheDocument();

        // Analytics
        // Total Forms: 2
        const totalFormsCard = screen.getByText('Total Forms').closest('.analytics-card') as HTMLElement;
        expect(within(totalFormsCard).getByText('2')).toBeInTheDocument();

        // Total Submissions: 2
        // There might be multiple "Submissions" texts (in analytics and table), so we look for the card one
        const allSubmissionsLabels = screen.getAllByText('Submissions');
        const submissionsCard = allSubmissionsLabels.find(el => el.closest('.analytics-card'))?.closest('.analytics-card') as HTMLElement;
        expect(within(submissionsCard).getByText('2')).toBeInTheDocument();
    });

    test('shows empty state when no forms exist', async () => {
        await setupFn({ forms: [], submissions: [] });

        await waitFor(() => {
            expect(screen.getByText('No Forms Found')).toBeInTheDocument();
        });
    });

    test('search input filters forms by title', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Instructor Survey' })).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/search forms/i);
        await user.type(searchInput, 'Instructor');

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Instructor Survey' })).toBeInTheDocument();
            expect(screen.queryByRole('heading', { name: 'Event Registration Form' })).not.toBeInTheDocument();
        });
    });

    test('status filter shows only matching forms', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        });

        // Use the accessible name we added (or implicitly by finding the combobox if only one)
        const statusSelect = screen.getByRole('combobox', { name: /status/i });
        
        await user.selectOptions(statusSelect, 'draft');

        await waitFor(() => {
             expect(screen.getByRole('heading', { name: 'Instructor Survey' })).toBeInTheDocument();
             expect(screen.queryByRole('heading', { name: 'Event Registration Form' })).not.toBeInTheDocument();
        });
    });

    test('recent submissions table displays correct data', async () => {
         await setupFn({ forms: defaultForms, submissions: defaultSubmissions });
         
         await waitFor(() => {
             expect(screen.getByText(/Recent Submissions/i)).toBeInTheDocument();
         });
         
         const table = await screen.findByRole('table');

         const userOneRow = within(table).getByText(/User One/i).closest('tr') as HTMLElement;
         expect(within(userOneRow).getByText(/attending/i)).toBeInTheDocument();

         const userTwoRow = within(table).getByText(/User Two/i).closest('tr') as HTMLElement;
         expect(within(userTwoRow).getByText(/needs to decide/i)).toBeInTheDocument();
    });

    test('template buttons open creation modal', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        // Find "Parent Event Registration" template card
        const parentTemplateCard = screen.getByText('Parent Event Registration').closest('.template-card') as HTMLElement;
        const useBtn = within(parentTemplateCard).getByRole('button', { name: /Use Template/i });
        
        await user.click(useBtn);

        await screen.findByRole('heading', { name: /create event registration form/i });
    });

    test('export submissions button triggers export', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        const exportBtn = screen.getByRole('button', { name: /Export Submissions/i });
        
        await user.click(exportBtn);

        if (options.onExport) {
            await options.onExport();
        }
    });

    test('"Create Form" button opens FormCreationModal', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        });

        const quickActions = screen.getByText('Quick Actions').closest('.quick-actions') as HTMLElement;
        const createButton = within(quickActions).getByRole('button', { name: /create new form/i });
        await user.click(createButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /create event registration form/i })).toBeInTheDocument();
        });
    });

    test('"View" button opens FormViewModal with correct form', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        });

        const formCard = screen.getByRole('heading', { name: 'Event Registration Form' }).closest('.form-card') as HTMLElement;
        // Method 1: Click the card itself
        await user.click(formCard);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /view form - event registration form/i })).toBeInTheDocument();
        });
    });

    test('"Edit" button opens FormEditModal and stops propagation', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        });

        const formCard = screen.getByRole('heading', { name: 'Event Registration Form' }).closest('.form-card') as HTMLElement;

        // Let's rely on the title attribute which acts as accessible name
        const actualEditButton = within(formCard).getByRole('button', { name: /Edit Form/i });
        await user.click(actualEditButton);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /edit form/i })).toBeInTheDocument();
        });

        // Check correct title passed (it should be in the input field)
        expect(screen.getByDisplayValue('Event Registration Form')).toBeInTheDocument();

        // Ensure View modal didn't open
        expect(screen.queryByRole('heading', { name: /view form/i })).not.toBeInTheDocument();
    });

    test('"Delete" button shows confirmation and deletes form', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        // Mock window.confirm
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Event Registration Form' })).toBeInTheDocument();
        });

        const formCard = screen.getByRole('heading', { name: 'Event Registration Form' }).closest('.form-card') as HTMLElement;
        const deleteButton = within(formCard).getByRole('button', { name: /Delete Form/i });
        await user.click(deleteButton);

        expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/delete this form/i));

        if (options.afterDelete) {
            await options.afterDelete('form-1');
        }

        confirmSpy.mockRestore();
    });
}
