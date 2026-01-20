import { test, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// We'll define the shape of the data we expect to use in tests
export interface TestData {
  events: any[];
  participants: any[];
}

export const defaultEvents = [
  {
    id: 'event-1',
    name: 'Summer Rally 2024',
    eventDate: '2025-06-15',
    participatingTeams: ['team-1'],
    status: 'active'
  },
  {
    id: 'event-2',
    name: 'Winter Challenge 2024',
    eventDate: '2024-01-10',
    participatingTeams: ['team-2'],
    status: 'active'
  },
];

export const defaultParticipants = [
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
      organization: '', // Empty comment
    },
    signedFormStatus: 'pending',
    signedDeclaration: false,
  },
];

// TYPE DEFINITION FOR THE SETUP FUNCTION
// This function is responsible for putting the data where the app can find it 
// (Mock return value OR Emulator DB write) and then rendering the component.
type SetupFunction = (data?: TestData) => Promise<void>;

export interface RunHostDashboardTestOptions {
  afterCommentSaved?: (params: { kidId: string; comment: string }) => Promise<void> | void;
}

export function runHostDashboardTests(setupFn: SetupFunction, options: RunHostDashboardTestOptions = {}) {
  
  test('displays correct stats for events and participants', async () => {
    await setupFn({ events: defaultEvents, participants: defaultParticipants });

    const totalEventsHeading = await screen.findByRole('heading', { name: 'Total Events' });
    const totalEventsCard = totalEventsHeading.closest('.stat-card') as HTMLElement;
    expect(within(totalEventsCard).getByText(defaultEvents.length.toString())).toBeInTheDocument();

    const participantsHeading = screen.getByRole('heading', { name: 'Participants' });
    const participantsCard = participantsHeading.closest('.stat-card') as HTMLElement;
    expect(within(participantsCard).getByText(defaultParticipants.length.toString())).toBeInTheDocument();
  });

  test('expand/collapse participant details', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await setupFn({ events: defaultEvents, participants: defaultParticipants });

    await screen.findByText('Alex Johnson');
    const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
    
    // 1. Check initially hidden
    expect(within(alexCard).queryByText('Participant Information')).not.toBeInTheDocument();

    // 2. Expand
    const alexHeaderButton = within(alexCard).getByRole('button', { name: /alex johnson/i });
    await user.click(alexHeaderButton);

    await waitFor(() => {
      expect(within(alexCard).getByText('Participant Information')).toBeInTheDocument();
    });

    // 3. Collapse
    await user.click(alexHeaderButton);
    await waitFor(() => {
      expect(within(alexCard).queryByText('Participant Information')).not.toBeInTheDocument();
    });
  });

  test('comment edit/save flow updates the display', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await setupFn({ events: defaultEvents, participants: defaultParticipants });

    await screen.findByText('Alex Johnson');

    // Expand Alex
    const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
    const alexHeaderButton = within(alexCard).getByRole('button', { name: /alex johnson/i });
    await user.click(alexHeaderButton);

    // Find Comments Section
    const commentsHeading = await within(alexCard).findByRole('heading', { name: 'Organization Comments' });
    const commentsSection = commentsHeading.closest('.detail-section') as HTMLElement;
    
    // Verify Initial
    expect(within(commentsSection).getByText('Original org comment for Alex')).toBeInTheDocument();

    // Click Edit
    const editButton = within(commentsSection).getByRole('button', { name: /edit|add comments/i });
    await user.click(editButton);

    // Type New Comment
    const textarea = within(commentsSection).getByRole('textbox');
    await user.clear(textarea);
    const newComment = 'New Updated Comment';
    await user.type(textarea, newComment);

    // Click Save
    const saveButton = within(commentsSection).getByRole('button', { name: /save/i });
    await user.click(saveButton);

    // Verify Saved (In UI)
    await waitFor(() => {
      const updatedHeading = within(alexCard).getByRole('heading', { name: 'Organization Comments' });
      const updatedSection = updatedHeading.closest('.detail-section') as HTMLElement;
      expect(within(updatedSection).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(updatedSection).getByText(newComment)).toBeInTheDocument();
    });

    await options.afterCommentSaved?.({ kidId: defaultParticipants[0].id, comment: newComment });
  });

  test('comment cancel restores previous value', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await setupFn({ events: defaultEvents, participants: defaultParticipants });

    await screen.findByText('Alex Johnson');

    const alexCard = screen.getByText('Alex Johnson').closest('.participant-card') as HTMLElement;
    const alexHeaderButton = within(alexCard).getByRole('button', { name: /alex johnson/i });
    await user.click(alexHeaderButton);

    const commentsHeading = await within(alexCard).findByRole('heading', { name: 'Organization Comments' });
    const commentsSection = commentsHeading.closest('.detail-section') as HTMLElement;

    const editButton = within(commentsSection).getByRole('button', { name: /edit|add comments/i });
    await user.click(editButton);

    const textarea = within(commentsSection).getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'This should not persist');

    const cancelButton = within(commentsSection).getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      const updatedHeading = within(alexCard).getByRole('heading', { name: 'Organization Comments' });
      const updatedSection = updatedHeading.closest('.detail-section') as HTMLElement;
      expect(within(updatedSection).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(updatedSection).getByText('Original org comment for Alex')).toBeInTheDocument();
    });
  });

  test('search and filters narrow the participant list', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await setupFn({ events: defaultEvents, participants: defaultParticipants });

    await screen.findByText('Alex Johnson');
    expect(screen.getByText('Taylor Williams')).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/search/i);
    await user.type(searchInput, 'Alex');

    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Taylor Williams')).not.toBeInTheDocument();

    const clearSearch = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearSearch);

    await waitFor(() => {
      expect(screen.getByText('Taylor Williams')).toBeInTheDocument();
    });

    const eventFilter = screen.getByLabelText(/filter by event/i);
    await user.selectOptions(eventFilter, 'event-1');
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Taylor Williams')).not.toBeInTheDocument();
  });

  test('shows empty state when no participants match search', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await setupFn({ events: defaultEvents, participants: defaultParticipants });

    await screen.findByText('Alex Johnson');
    const searchInput = screen.getByLabelText(/search/i);
    await user.type(searchInput, 'zzzz-not-a-match');

    await waitFor(() => {
      expect(screen.getByText('No Participants Found')).toBeInTheDocument();
    });
  });

  test('does not list kids without a teamId', async () => {
    const unregisteredKid = {
      id: 'kid-no-team',
      participantNumber: '999',
      teamId: '',
      personalInfo: { firstName: 'Unregistered', lastName: 'Kid' },
      comments: { organization: '' },
      signedFormStatus: 'pending',
      signedDeclaration: false,
    };

    await setupFn({
      events: defaultEvents,
      participants: [...defaultParticipants, unregisteredKid],
    });

    await screen.findByText('Alex Johnson');
    expect(screen.queryByText('Unregistered Kid')).not.toBeInTheDocument();
  });
}
