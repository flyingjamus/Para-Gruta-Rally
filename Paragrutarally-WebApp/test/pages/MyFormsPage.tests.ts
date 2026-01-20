import { test, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export interface TestData {
    forms: any[];
    submissions: any[];
}

export const defaultForms = [
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

export const defaultSubmissions = [
    {
        id: 'submission-1',
        formId: 'form-1',
        submitterId: 'user-123',
        confirmationStatus: 'attending',
        attendeesCount: 2,
        kidIds: [],
        submittedAt: new Date('2024-01-15'),
        formTitle: 'Summer Event Registration',
    }
];

export interface SetupOptions {
    simulateError?: boolean;
}

type SetupFunction = (data?: TestData, options?: SetupOptions) => Promise<void>;

export interface RunMyFormsPageTestsOptions {
    afterViewFormClicked?: (formId: string) => Promise<void> | void;
    skipErrorStateTest?: boolean;
}

export function runMyFormsPageTests(setupFn: SetupFunction, options: RunMyFormsPageTestsOptions = {}) {

    const getSectionByHeading = (headingText: string) => {
        const headingEl = screen.getByText(headingText);
        return headingEl.closest('.forms-section') as HTMLElement;
    };

    const getAvailableFormCardByTitle = (title: string) => {
        const section = getSectionByHeading('Available Forms');
        const titleEl = within(section).getByText(title);
        return titleEl.closest('.available-form-card') as HTMLElement;
    };

    test('displays forms after loading completes', async () => {
        await setupFn({ forms: defaultForms, submissions: [] });

        await waitFor(() => {
            expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
        });

        expect(screen.getByText('Winter Training Session')).toBeInTheDocument();

        // Event details
        expect(screen.getByText('City Park')).toBeInTheDocument();
        expect(screen.getByText('June 15, 2025')).toBeInTheDocument();
    });

    test('shows empty state when no forms are available', async () => {
        await setupFn({ forms: [], submissions: [] });

        await waitFor(() => {
            expect(screen.getByText('No Forms Available')).toBeInTheDocument();
        });
        expect(screen.getByText('There are no active forms available at the moment.')).toBeInTheDocument();
    });

    test('shows empty state when no submissions exist', async () => {
        await setupFn({ forms: defaultForms, submissions: [] });

        await waitFor(() => {
            expect(screen.getByText('No Submissions Yet')).toBeInTheDocument();
        });
    });

    test('displays submissions when they exist', async () => {
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await waitFor(() => {
            expect(screen.getByText('My Submissions')).toBeInTheDocument();
        });

        const submissionsSection = getSectionByHeading('My Submissions');
        expect(await within(submissionsSection).findByText('Summer Event Registration')).toBeInTheDocument();
        expect(await within(submissionsSection).findByText('Attending')).toBeInTheDocument();
    });

    test('shows "Edit" for submitted forms in Available Forms', async () => {
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await screen.findByText('Available Forms');
        const availableFormsSection = getSectionByHeading('Available Forms');
        await within(availableFormsSection).findByText('Summer Event Registration');

        const submittedCard = getAvailableFormCardByTitle('Summer Event Registration');
        expect(within(submittedCard).getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(within(submittedCard).queryByRole('button', { name: /fill form/i })).not.toBeInTheDocument();

        const unsubmittedCard = getAvailableFormCardByTitle('Winter Training Session');
        expect(within(unsubmittedCard).getByRole('button', { name: /fill form/i })).toBeInTheDocument();
    });

    test('submission "View" and "Edit" buttons open their modals', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: defaultSubmissions });

        await screen.findByText('My Submissions');
        const submissionsSection = getSectionByHeading('My Submissions');
        const submissionTitle = await within(submissionsSection).findByText('Summer Event Registration');
        const submissionCard = submissionTitle.closest('.submission-card') as HTMLElement;

        const viewButton = within(submissionCard).getByRole('button', { name: /^view$/i });
        await user.click(viewButton);
        await waitFor(() => expect(screen.getByTestId('view-submission-modal')).toBeInTheDocument());

        const editButton = within(submissionCard).getByRole('button', { name: /^edit$/i });
        await user.click(editButton);
        await waitFor(() => expect(screen.getByTestId('edit-submission-modal')).toBeInTheDocument());
    });

    test('"View" button opens the FormViewModal with correct form', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: [] });

        await waitFor(() => {
            expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
        });

        const card = getAvailableFormCardByTitle('Summer Event Registration');
        const viewButton = within(card).getByRole('button', { name: /view/i });
        await user.click(viewButton);

        // FormViewModal should be open
        await waitFor(() => {
            expect(screen.getByTestId('form-view-modal')).toBeInTheDocument();
        });
        expect(screen.getByTestId('view-modal-form-title')).toHaveTextContent('Summer Event Registration');

        await options.afterViewFormClicked?.('form-1');
    });

    test('"Fill Form" button opens FormSubmissionModal with correct form', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ forms: defaultForms, submissions: [] });

        await waitFor(() => {
            expect(screen.getByText('Summer Event Registration')).toBeInTheDocument();
        });

        const card = getAvailableFormCardByTitle('Summer Event Registration');
        const fillButton = within(card).getByRole('button', { name: /fill form/i });
        await user.click(fillButton);

        await waitFor(() => {
            expect(screen.getByTestId('form-submission-modal')).toBeInTheDocument();
        });
        expect(screen.getByTestId('modal-form-title')).toHaveTextContent('Summer Event Registration');
    });

    if (!options.skipErrorStateTest) {
        test('shows error state when form loading fails', async () => {
            // We pass undefined data but with simulateError option
            await setupFn(undefined, { simulateError: true });

            await waitFor(() => {
                expect(screen.getByText('Unable to Load Forms')).toBeInTheDocument();
            });

            // Retry button should be present
            const retryButton = screen.getByRole('button', { name: /try again/i });
            expect(retryButton).toBeInTheDocument();
        });
    }

}
