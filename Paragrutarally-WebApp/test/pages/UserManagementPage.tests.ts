import { test, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Define TestData interface
export interface TestData {
    users: any[];
}

export const defaultUsers = [
    {
        id: 'admin-user',
        displayName: 'Admin User',
        email: 'admin@test.com',
        role: 'admin',
        createdAt: new Date('2024-01-01'),
        lastLogin: new Date('2024-01-02'),
        name: 'Admin Full Name'
    },
    {
        id: 'instructor-user',
        displayName: 'Instructor User',
        email: 'instructor@test.com',
        role: 'instructor',
        createdAt: new Date('2024-01-03'),
        lastLogin: new Date('2024-01-04'),
        name: 'Instructor Full Name'
    },
    {
        id: 'host-user',
        displayName: 'Host User',
        email: 'host@test.com',
        role: 'host',
        createdAt: new Date('2024-01-05'),
        lastLogin: null,
        name: 'Host Full Name'
    },
    {
        id: 'parent-user',
        displayName: 'Parent User',
        email: 'parent@test.com',
        role: 'parent',
        createdAt: new Date('2024-01-06'),
        lastLogin: new Date('2024-01-07'),
        name: 'Parent Full Name'
    }
];

type SetupFunction = (data?: TestData) => Promise<void>;

export interface RunUserManagementTestOptions {
    // Add any specific options here if needed in the future
}

export function runUserManagementTests(setupFn: SetupFunction, options: RunUserManagementTestOptions = {}) {

    test('displays correct stats and renders users list', async () => {
        await setupFn({ users: defaultUsers });

        // Helper to check stat card using accessible role
        const checkStat = async (title: string, value: string) => {
            // Find the card by its accessible name (which is the title)
            const card = screen.getByRole('button', { name: title });
            expect(card).toBeInTheDocument();
            
            // The value is inside this card
            const valueEl = within(card).getByText(value);
            expect(valueEl).toBeInTheDocument();
        };

        await checkStat('Total Users', '4');
        await checkStat('Admins', '1');
        await checkStat('Instructors', '1');
        await checkStat('Hosts', '1');
        await checkStat('Parents', '1');

        // Check table content
        const table = screen.getByRole('table');
        expect(within(table).getByText('Admin User')).toBeInTheDocument();
        expect(within(table).getByText('Instructor User')).toBeInTheDocument();
        expect(within(table).getByText('Host User')).toBeInTheDocument();
        expect(within(table).getByText('Parent User')).toBeInTheDocument();
    });

    test('filters users by role using stat cards', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        // Click on "Admins" card
        const adminsCard = screen.getByRole('button', { name: 'Admins' });
        await user.click(adminsCard);

        // Should only show Admin User
        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row'); 
        // 1 header + 1 data row = 2 rows
        expect(rows).toHaveLength(2);
        
        expect(within(table).getByText('Admin User')).toBeInTheDocument();
        expect(within(table).queryByText('Instructor User')).not.toBeInTheDocument();

        // Click on "Total Users" to reset
        const totalCard = screen.getByRole('button', { name: 'Total Users' });
        await user.click(totalCard);

        expect(within(table).getByText('Admin User')).toBeInTheDocument();
        expect(within(table).getByText('Instructor User')).toBeInTheDocument();
    });

    test('search filters users by name', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        // Use accessible name for search input
        const searchInput = screen.getByRole('textbox', { name: /search/i });
        await user.type(searchInput, 'Host');

        const table = screen.getByRole('table');
        expect(within(table).getByText('Host User')).toBeInTheDocument();
        expect(within(table).queryByText('Admin User')).not.toBeInTheDocument();

        // Clear search
        await user.clear(searchInput);

        // Ensure all users are back
        expect(within(table).getByText('Host User')).toBeInTheDocument();
        expect(within(table).getByText('Admin User')).toBeInTheDocument();
    });

    test('clear filters button resets all filters', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        // 1. Apply Search
        const searchInput = screen.getByRole('textbox', { name: /search/i });
        await user.type(searchInput, 'Host');
        
        // Verify filtered
        const table = screen.getByRole('table');
        expect(within(table).queryByText('Admin User')).not.toBeInTheDocument();

        // 2. Click Clear Filters
        const clearBtn = screen.getByRole('button', { name: /clear filters/i });
        await user.click(clearBtn);

        // Verify Reset
        expect(within(table).getByText('Admin User')).toBeInTheDocument();
        expect(searchInput).toHaveValue('');
        
        // 3. Apply Role Filter via Select
        const roleSelect = screen.getByRole('combobox', { name: /filter by role/i });
        await user.selectOptions(roleSelect, 'admin');

        // Verify filtered
        expect(within(table).queryByText('Host User')).not.toBeInTheDocument();
        expect(within(table).getByText('Admin User')).toBeInTheDocument();

        // 4. Click Clear Filters again
        await user.click(clearBtn);

        // Verify Reset
        expect(within(table).getByText('Host User')).toBeInTheDocument();
    });

    test('sorts users by display name', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        // Default order might be by Creation Date Descending (as per component code)
        // Let's sort by Display Name
        const nameHeader = screen.getByRole('columnheader', { name: /display name/i });
        await user.click(nameHeader); // Ascending

        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');
        // Index 1 is first data row.
        // A: Admin, H: Host, I: Instructor, P: Parent
        // Ascending: Admin, Host, Instructor, Parent
        expect(within(rows[1]).getByText('Admin User')).toBeInTheDocument();
        expect(within(rows[2]).getByText('Host User')).toBeInTheDocument();

        // Click again for Descending
        await user.click(nameHeader);
        
        const rowsDesc = within(table).getAllByRole('row');
        // Descending: Parent, Instructor, Host, Admin
        expect(within(rowsDesc[1]).getByText('Parent User')).toBeInTheDocument();
        expect(within(rowsDesc[2]).getByText('Instructor User')).toBeInTheDocument();
    });

    test('opens create user modal', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        const createButton = screen.getByRole('button', { name: /create new user/i });
        await user.click(createButton);

        // Verify modal opens. Look for dialog role if possible or heading
        const modal = await screen.findByRole('dialog');
        expect(within(modal).getByRole('heading', { name: /create new user/i })).toBeInTheDocument();
    });

    test('opens export users modal', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        const exportButton = screen.getByRole('button', { name: /export users/i });
        await user.click(exportButton);

        // Verify modal opens
        const modal = await screen.findByRole('dialog');
        expect(within(modal).getByRole('heading', { name: /export users/i })).toBeInTheDocument();
    });

    test('opens update user modal', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        const table = screen.getByRole('table');
        // Find the row for Admin User
        const row = within(table).getByText('Admin User').closest('tr');
        expect(row).not.toBeNull();
        if (row) {
            // Find Update button in this row
            // The button has title "Update User" or text "Update"
            const updateBtn = within(row as HTMLElement).getByRole('button', { name: /update user/i });
            await user.click(updateBtn);
        }

        // Verify Update Modal
        const modal = await screen.findByRole('dialog');
        expect(within(modal).getByRole('heading', { name: /update user/i })).toBeInTheDocument();
    });

    test('handles delete user flow', async () => {
        const user = userEvent.setup();
        // Mock window.alert
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
        
        await setupFn({ users: defaultUsers });

        const table = screen.getByRole('table');
        const row = within(table).getByText('Parent User').closest('tr');
        expect(row).not.toBeNull();

        if (row) {
             // Find Delete button
             const deleteBtn = within(row as HTMLElement).getByRole('button', { name: /delete user/i });
             await user.click(deleteBtn);
        }

        // Delete Modal should appear
        const deleteModal = await screen.findByRole('dialog', { name: /delete user/i });
        
        // Verify content
        expect(within(deleteModal).getByText(/this action cannot be undone/i)).toBeInTheDocument();
        expect(within(deleteModal).getByText('parent@test.com')).toBeInTheDocument();

        // Click Cancel
        const cancelBtn = within(deleteModal).getByRole('button', { name: /cancel/i });
        await user.click(cancelBtn);

        expect(deleteModal).not.toBeInTheDocument();

        // Open again and confirm
        const row2 = within(table).getByText('Parent User').closest('tr');
        const deleteBtn2 = within(row2 as HTMLElement).getByRole('button', { name: /delete user/i });
        await user.click(deleteBtn2);

        const deleteModal2 = await screen.findByRole('dialog', { name: /delete user/i });
        const confirmBtn = within(deleteModal2).getByRole('button', { name: /delete user completely/i });
        await user.click(confirmBtn);

        // Verify alert was called (success)
        await waitFor(() => {
            expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('User Deleted Successfully'));
        });

        alertMock.mockRestore();
    });

    test('shows empty state when no users match filters', async () => {
        const user = userEvent.setup();
        await setupFn({ users: defaultUsers });

        // Filter by a name that definitely doesn't exist
        const searchInput = screen.getByRole('textbox', { name: /search/i });
        await user.type(searchInput, 'NonExistentUserXYZ');

        expect(screen.getByText(/no users found/i)).toBeInTheDocument();
        expect(screen.getByText(/start by creating your first user/i)).toBeInTheDocument();
    });
}