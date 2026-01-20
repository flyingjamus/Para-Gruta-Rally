import { test, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Define the shape of the data
export interface TestData {
    kids: any[];
}

export const defaultKids = [
    {
        id: 'kid-1',
        participantNumber: '001',
        personalInfo: {
            firstName: 'Emma',
            lastName: 'Smith',
            dateOfBirth: '2015-03-15',
            address: '123 Main St',
            capabilities: 'None',
        },
        parentInfo: {
            parentId: 'parent-123',
            name: 'John Smith',
            email: 'john@example.com',
            phone: '555-0101',
        },
        comments: {
            parent: 'Original comment for Emma',
        },
        signedFormStatus: 'completed',
        signedDeclaration: true,
    },
    {
        id: 'kid-2',
        participantNumber: '002',
        personalInfo: {
            firstName: 'Oliver',
            lastName: 'Smith',
            dateOfBirth: '2017-07-20',
            address: '123 Main St',
            capabilities: 'Needs assistance',
        },
        parentInfo: {
            parentId: 'parent-123',
            name: 'John Smith',
            email: 'john@example.com',
            phone: '555-0101',
        },
        comments: {
            parent: '',
        },
        signedFormStatus: 'pending',
        signedDeclaration: false,
    },
];

type SetupFunction = (data?: TestData) => Promise<void>;

export interface RunParentDashboardTestOptions {
    afterCommentSaved?: (params: { kidId: string; comment: string }) => Promise<void> | void;
    mockEditModal?: any; // To pass the spy for integration/unit checks
}

export function runParentDashboardTests(setupFn: SetupFunction, options: RunParentDashboardTestOptions = {}) {

    test('expand/collapse kid details', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ kids: defaultKids });

        // Wait for kids to load
        await waitFor(() => {
            expect(screen.getByText('Emma Smith')).toBeInTheDocument();
        });

        const emmaCard = screen.getByText('Emma Smith').closest('.kid-card') as HTMLElement;

        // Details hidden initially
        expect(screen.queryByText('Personal Information')).not.toBeInTheDocument();

        // Expand
        const emmaHeader = within(emmaCard).getByText('Emma Smith').closest('.kid-header') as HTMLElement;
        await user.click(emmaHeader);

        // Details visible
        await waitFor(() => {
            expect(screen.getByText('Personal Information')).toBeInTheDocument();
        });
        expect(screen.getByText('Contact Information')).toBeInTheDocument();

        // Collapse
        await user.click(emmaHeader);
        await waitFor(() => {
            expect(screen.queryByText('Personal Information')).not.toBeInTheDocument();
        });
    });

    test('expanding one kid and then expanding another collapses the first', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ kids: defaultKids });

        await waitFor(() => {
            expect(screen.getByText('Emma Smith')).toBeInTheDocument();
        });

        // Expand Emma
        const emmaCard = screen.getByText('Emma Smith').closest('.kid-card') as HTMLElement;
        const emmaHeader = within(emmaCard).getByText('Emma Smith').closest('.kid-header') as HTMLElement;
        await user.click(emmaHeader);

        await waitFor(() => expect(screen.getByText('Personal Information')).toBeInTheDocument());

        // Expand Oliver
        const oliverCard = screen.getByText('Oliver Smith').closest('.kid-card') as HTMLElement;
        const oliverHeader = within(oliverCard).getByText('Oliver Smith').closest('.kid-header') as HTMLElement;
        await user.click(oliverHeader);

        // Emma collapsed, Oliver expanded
        await waitFor(() => {
            const personalInfoSections = screen.getAllByText('Personal Information');
            expect(personalInfoSections).toHaveLength(1);
        });
        // Verify it is indeed Oliver's info
        expect(within(oliverCard).getByText('Personal Information')).toBeInTheDocument();
        expect(within(emmaCard).queryByText('Personal Information')).not.toBeInTheDocument();
    });

    test('comment edit/save flow updates the display', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ kids: defaultKids });

        await waitFor(() => expect(screen.getByText('Emma Smith')).toBeInTheDocument());

        // Expand Emma
        const emmaCard = screen.getByText('Emma Smith').closest('.kid-card') as HTMLElement;
        const emmaHeader = within(emmaCard).getByText('Emma Smith').closest('.kid-header') as HTMLElement;
        await user.click(emmaHeader);

        const commentsHeading = await within(emmaCard).findByRole('heading', { name: /My Comments/i });
        const commentsSection = commentsHeading.closest('.detail-section') as HTMLElement;

        expect(within(commentsSection).getByText('Original comment for Emma')).toBeInTheDocument();

        // Edit
        const editButton = within(commentsSection).getByRole('button', { name: /edit/i });
        await user.click(editButton);

        const textarea = screen.getByRole('textbox');
        await user.clear(textarea);
        const newComment = 'New saved comment';
        await user.type(textarea, newComment);

        // Save
        const saveButton = within(commentsSection).getByRole('button', { name: /save/i });
        await user.click(saveButton);

        // Verify UI update
        // We expect the new comment to appear (outside of textbox)
        // Since findByText might match the textbox content, we should wait for the textbox to disappear first
        await waitFor(() => {
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });
        
        expect(await screen.findByText(newComment)).toBeInTheDocument();

        if (options.afterCommentSaved) {
            await options.afterCommentSaved({ kidId: defaultKids[0].id, comment: newComment });
        }
    });

    test('comment cancel restores previous value', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ kids: defaultKids });

        await waitFor(() => expect(screen.getByText('Emma Smith')).toBeInTheDocument());

        const emmaCard = screen.getByText('Emma Smith').closest('.kid-card') as HTMLElement;
        const emmaHeader = within(emmaCard).getByText('Emma Smith').closest('.kid-header') as HTMLElement;
        await user.click(emmaHeader);

        const commentsHeading = await within(emmaCard).findByRole('heading', { name: /My Comments/i });
        const commentsSection = commentsHeading.closest('.detail-section') as HTMLElement;

        // Edit
        const editButton = within(commentsSection).getByRole('button', { name: /edit/i });
        await user.click(editButton);

        const textarea = screen.getByRole('textbox');
        await user.clear(textarea);
        await user.type(textarea, 'Should be discarded');

        // Cancel
        const cancelButton = within(commentsSection).getByRole('button', { name: /cancel/i });
        await user.click(cancelButton);

        await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
        expect(within(commentsSection).getByText('Original comment for Emma')).toBeInTheDocument();
    });

    test('kid with no comments shows "Add Comments" button', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ kids: defaultKids });

        await waitFor(() => expect(screen.getByText('Oliver Smith')).toBeInTheDocument());

        const oliverCard = screen.getByText('Oliver Smith').closest('.kid-card') as HTMLElement;
        const oliverHeader = within(oliverCard).getByText('Oliver Smith').closest('.kid-header') as HTMLElement;
        await user.click(oliverHeader);

        const commentsHeading = await within(oliverCard).findByRole('heading', { name: /My Comments/i });
        const commentsSection = commentsHeading.closest('.detail-section') as HTMLElement;
        
        expect(within(commentsSection).getByText('No comments added yet')).toBeInTheDocument();

        expect(within(commentsSection).getByRole('button', { name: /add comments/i })).toBeInTheDocument();
    });

    test('displays correct stats', async () => {
        await setupFn({ kids: defaultKids });
        await waitFor(() => expect(screen.getByText('Emma Smith')).toBeInTheDocument());

        const statsGrid = document.querySelector('.stats-grid') as HTMLElement;
        const totalCard = statsGrid.querySelector('.stat-card.total') as HTMLElement;
        expect(within(totalCard).getByText(defaultKids.length.toString())).toBeInTheDocument();

        // Emma is completed
        const completeCard = statsGrid.querySelector('.stat-card.parents') as HTMLElement;
        expect(within(completeCard).getByText('1')).toBeInTheDocument();

        // Oliver is pending
        const pendingCard = statsGrid.querySelector('.stat-card.kids') as HTMLElement;
        expect(within(pendingCard).getByText('1')).toBeInTheDocument();
    });

    test('clicking Edit button opens the edit modal with correct kid data', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        await setupFn({ kids: defaultKids });

        await waitFor(() => expect(screen.getByText('Emma Smith')).toBeInTheDocument());

        const emmaCard = screen.getByText('Emma Smith').closest('.kid-card') as HTMLElement;
        const editButton = within(emmaCard).getByRole('button', { name: /edit/i });

        await user.click(editButton);

        await waitFor(() => {
            // We check for the testid that the mock/component renders
            expect(screen.getByTestId('parent-kid-edit-modal')).toBeInTheDocument();
        });

        if (options.mockEditModal) {
            expect(options.mockEditModal).toHaveBeenLastCalledWith(expect.objectContaining({
                isOpen: true,
                kid: expect.objectContaining({
                    id: defaultKids[0].id,
                    personalInfo: expect.objectContaining({
                        firstName: 'Emma'
                    })
                })
            }));
        }
    });
}