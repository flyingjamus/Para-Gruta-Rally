import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import userEvent from '@testing-library/user-event';

// Use REAL config/hooks
import { auth } from '@/firebase/config';
import ParentDashboardPage from '@/pages/parent/ParentDashboardPage';
import { PermissionProvider } from '@/hooks/usePermissions';
import { AuthProvider } from '@/contexts/AuthContext';
import LanguageContext from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { runParentDashboardTests, TestData } from './ParentDashboardPage.tests';

// Mock LanguageContext for UI simplicity
const mockLanguageContext = {
    t: (key: string, fallback: string) => fallback || key,
    language: 'en',
    setLanguage: () => { },
    dir: 'ltr',
    isRTL: false,
};

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

describeWithFirestoreEmulator('ParentDashboardPage (Integration)', () => {
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

    // SETUP FUNCTION FOR INTEGRATION TESTS
    const setupIntegration = async (data?: TestData) => {
        if (!data) return;

        // 1. Seed Database
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();

            // Create Parent User (mock data uses 'parent-123')
            await db.collection('users').doc('parent-123').set({
                role: 'parent',
                email: 'john@example.com',
                displayName: 'John Smith'
            });

            // Seed Kids
            for (const kid of data.kids) {
                await db.collection('kids').doc(kid.id).set(kid);
            }
        });

        // 2. Authenticate
        // We need to sign in as the parent user 'parent-123' ideally, but anonymous auth yields a random UID.
        // For integration tests relying on security rules, strictly speaking we should match the UID.
        // However, `setupIntegration` is called by `runParentDashboardTests` which uses the data's `parentInfo.parentId`.
        // Let's sign in anonymously and then set that user up as rights holder or just rely on the fact 
        // that our app logic mocked in AuthContext (via Provider) or real Auth logic handles it.
        // Wait, we are using REAL AuthProvider. So "currentUser" will be the anon user.
        // For the app to think we are "John Smith", the User document corresponding to the Auth UID must exist.

        const userCredential = await import('firebase/auth').then(m => m.signInAnonymously(auth));
        const uid = userCredential.user.uid;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            // Map the anon uid to the parent role
            await context.firestore().collection('users').doc(uid).set({
                role: 'parent',
                email: 'john@example.com',
                displayName: 'John Smith'
            });

            // IMPORTANT: The kids in `defaultKids` have `parentInfo.parentId: 'parent-123'`. 
            // If the app checks `kid.parentInfo.parentId === user.uid` for access, this mismatch will fail.
            // If the app relies on `user.role === 'parent'`, it might be fine, but let's be safe.
            // We should update the kids to belong to THIS user.
            const db = context.firestore();
            for (const kid of data.kids) {
                await db.collection('kids').doc(kid.id).update({
                    'parentInfo.parentId': uid
                });
            }
        });

        // 3. Render with Providers
        render(
            <AuthProvider>
                <ThemeProvider>
                    <LanguageContext.Provider value={mockLanguageContext}>
                        <PermissionProvider>
                            <MemoryRouter>
                                <ParentDashboardPage />
                            </MemoryRouter>
                        </PermissionProvider>
                    </LanguageContext.Provider>
                </ThemeProvider>
            </AuthProvider>
        );
    };

    // EXECUTE SHARED TESTS
    runParentDashboardTests(setupIntegration, {
        afterCommentSaved: async ({ kidId, comment }) => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const snap = await context.firestore().collection('kids').doc(kidId).get();
                expect(snap.data()?.comments?.parent).toBe(comment);
            });
        },
    });

    test('denies access for instructor role', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        const userCredential = await import('firebase/auth').then(m => m.signInAnonymously(auth));
        const uid = userCredential.user.uid;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().collection('users').doc(uid).set({
                role: 'instructor',
                email: 'instructor@test.com',
                displayName: 'Instructor User',
            });
        });

        render(
            <AuthProvider>
                <ThemeProvider>
                    <LanguageContext.Provider value={mockLanguageContext}>
                        <PermissionProvider>
                            <MemoryRouter>
                                <ParentDashboardPage />
                            </MemoryRouter>
                        </PermissionProvider>
                    </LanguageContext.Provider>
                </ThemeProvider>
            </AuthProvider>
        );

        expect(
            await screen.findByText('Access denied: Parent credentials required')
        ).toBeInTheDocument();
    });
});
