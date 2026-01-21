import { describe, vi, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KidsManagementPage from '@/pages/admin/KidsManagementPage';
import { runKidsManagementTests, TestData, defaultKids, defaultTeams } from './KidsManagementPage.tests';

// --- MOCKS ---

const { 
    mockGetAllKids,
    mockGetAllTeams,
    mockDeleteKid,
    mockGetKidPhotoInfo,
    mockUsePermissions, 
    mockCanUserAccessKid, 
    mockUseLanguage, 
    mockUseTheme 
} = vi.hoisted(() => {
    const mockT = (key: string, fallback: string) => fallback || key;
    return {
        mockGetAllKids: vi.fn(),
        mockGetAllTeams: vi.fn(),
        mockDeleteKid: vi.fn(),
        mockGetKidPhotoInfo: vi.fn(),
        mockUsePermissions: vi.fn(),
        mockCanUserAccessKid: vi.fn(() => true),
        mockUseLanguage: vi.fn(() => ({
            t: mockT,
        })),
        mockUseTheme: vi.fn(() => ({
            appliedTheme: 'light',
        })),
    };
});

vi.mock('@/services/kidService', () => ({
    getAllKids: (...args: unknown[]) => mockGetAllKids(...args),
    getKidsByInstructor: vi.fn().mockResolvedValue([]),
    getKidsByParent: vi.fn().mockResolvedValue([]),
    deleteKid: (...args: unknown[]) => mockDeleteKid(...args),
}));

vi.mock('@/services/teamService', () => ({
    getAllTeams: (...args: unknown[]) => mockGetAllTeams(...args),
}));

vi.mock('@/services/kidPhotoService', () => ({
    getKidPhotoInfo: (...args: unknown[]) => mockGetKidPhotoInfo(...args),
}));

// Mock Contexts
vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: mockUseLanguage,
}));
vi.mock('@/contexts/LanguageContext.jsx', () => ({
    useLanguage: mockUseLanguage,
}));

vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: mockUseTheme,
}));
vi.mock('@/contexts/ThemeContext.jsx', () => ({
    useTheme: mockUseTheme,
}));

vi.mock('@/hooks/usePermissions', () => ({
    usePermissions: mockUsePermissions,
    canUserAccessKid: mockCanUserAccessKid,
}));

// Mock with .jsx extension just in case
vi.mock('@/hooks/usePermissions.jsx', () => ({
    usePermissions: mockUsePermissions,
    canUserAccessKid: mockCanUserAccessKid,
}));


// Mock Components
vi.mock('@/components/layout/Dashboard', () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dashboard">{children}</div>
    ),
}));

vi.mock('@/components/modals/TeamChangeModal', () => ({
    default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        if (!isOpen) return null;
        return (
            <div role="dialog">
                <h1>Change Team</h1>
                <button onClick={onClose}>Close</button>
            </div>
        );
    },
}));

vi.mock('@/components/modals/ExportKidsModal', () => ({
    default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        if (!isOpen) return null;
        return (
            <div role="dialog">
                <h1>Export Kids</h1>
                <button onClick={onClose}>Close</button>
            </div>
        );
    },
}));

describe('KidsManagementPage (Unit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Default mocks
        mockGetKidPhotoInfo.mockReturnValue({ url: 'http://placeholder', hasPhoto: false });
        // Ensure usePermissions returns default valid state
        mockUsePermissions.mockReturnValue({
            permissions: true,
            userRole: 'admin',
            userData: { id: 'admin-1' },
            user: { uid: 'admin-uid' },
            loading: false,
            error: null,
        });
        mockCanUserAccessKid.mockReturnValue(true);
        // Reset context mocks defaults
        mockUseLanguage.mockReturnValue({ t: (k, f) => f || k });
        mockUseTheme.mockReturnValue({ appliedTheme: 'light' });
    });

    const setupUnit = async (data?: TestData) => {
        if (!data) return;

        mockGetAllKids.mockResolvedValue(data.kids);
        mockGetAllTeams.mockResolvedValue(data.teams);

        render(
            <MemoryRouter>
                <KidsManagementPage />
            </MemoryRouter>
        );

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText(/loading permissions/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/loading kids/i)).not.toBeInTheDocument();
        });
    };

    // Run shared tests
    runKidsManagementTests(setupUnit);

    // Specific Unit Tests
    test('handles data loading error', async () => {
        mockGetAllKids.mockRejectedValue(new Error('Fetch failed'));
        mockGetAllTeams.mockResolvedValue([]);

        render(
            <MemoryRouter>
                <KidsManagementPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/failed to load data/i)).toBeInTheDocument();
        });
    });
});
