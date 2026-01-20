import { afterAll, beforeAll, beforeEach, describe, expect, vi, test } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import userEvent from '@testing-library/user-event';

// Use REAL config/hooks (same pattern as HostDashboardPage.integration.spec.tsx)
import { auth } from '@/firebase/config';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import { AuthProvider } from '@/contexts/AuthContext';
import LanguageContext from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { runUserManagementTests, TestData } from './UserManagementPage.tests';

// Mock LanguageContext for UI simplicity
const mockLanguageContext = {
    t: (key: string, fallback: string) => fallback || key,
    language: 'en',
    setLanguage: () => { },
    dir: 'ltr',
    isRTL: false,
};

// Mock userService to avoid Cloud Functions calls
vi.mock('@/services/userService', () => ({
    deleteUserCompletely: vi.fn().mockResolvedValue(true),
    getUserData: vi.fn(),
    updateUserProfile: vi.fn(),
}));

function parseHostAndPort(hostAndPort: string | undefined): { host: string; port: number } | undefined {
    if (hostAndPort == null) return undefined;
    const [host, portString] = hostAndPort.split(':');
    const port = Number(portString);
    return Number.isFinite(port) ? { host, port } : undefined;
}

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'test-project';
const FIRESTORE_RULES = readFileSync(resolve(process.cwd(), 'firebase/firestore.rules'), 'utf8');

let testEnv: RulesTestEnvironment;

const hasFirestoreEmulator =
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) || Boolean(process.env.FIREBASE_EMULATOR_HUB);
const describeWithFirestoreEmulator = hasFirestoreEmulator ? describe : describe.skip;

describeWithFirestoreEmulator('UserManagementPage (Integration)', () => {
    beforeAll(async () => {
        const emulator =
            parseHostAndPort(process.env.FIRESTORE_EMULATOR_HOST) ?? { host: '127.0.0.1', port: 8080 };

        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                host: emulator.host,
                port: emulator.port,
                rules: FIRESTORE_RULES,
            },
        });
    });

    beforeEach(async () => {
        await testEnv.clearFirestore();
        if (auth.currentUser) await signOut(auth);
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    // SETUP FUNCTION FOR INTEGRATION TESTS (following HostDashboardPage pattern)
    const setupIntegration = async (data?: TestData) => {
        if (!data) return;

        // 1. Authenticate FIRST to get the UID
        const { signInAnonymously } = await import('firebase/auth');
        const userCredential = await signInAnonymously(auth);
        const uid = userCredential.user.uid;

        // 2. Seed the admin user document for THIS UID immediately
        //    AuthContext will do a retry lookup, so this should be ready.
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();

            // Set the authenticated user as admin FIRST (important for isAdmin() check)
            // Use the same displayName as defaultUsers admin to avoid test conflicts
            await db.collection('users').doc(uid).set({
                role: 'admin',
                email: 'admin@test.com',
                displayName: 'Admin User',
                createdAt: new Date(),
                name: 'Admin Full Name',
            });

            // Seed test users from data, but SKIP the admin-user since we're using the authenticated user as admin
            for (const user of data.users) {
                if (user.id === 'admin-user') continue; // Skip - we already created admin with actual UID
                await db.collection('users').doc(user.id).set(user);
            }
        });

        // 3. Small delay to ensure Firestore writes are visible
        await new Promise(resolve => setTimeout(resolve, 100));

        // 4. Render with Providers (REAL AuthProvider like HostDashboardPage)
        render(
            <AuthProvider>
                <ThemeProvider>
                    <LanguageContext.Provider value={mockLanguageContext}>
                        <MemoryRouter>
                            <UserManagementPage />
                        </MemoryRouter>
                    </LanguageContext.Provider>
                </ThemeProvider>
            </AuthProvider>
        );

        // 5. Wait for AuthProvider to finish initializing
        await waitFor(() => {
            expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
        }, { timeout: 15000 });

        // 6. Wait for data to load (the component shows a loading state)
        await waitFor(() => {
            // Look for something that indicates data has loaded
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        }, { timeout: 5000 });
    };

    // EXECUTE SHARED TESTS
    runUserManagementTests(setupIntegration);
});
