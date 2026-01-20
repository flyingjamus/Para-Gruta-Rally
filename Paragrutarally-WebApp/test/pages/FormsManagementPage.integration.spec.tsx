import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { signOut } from 'firebase/auth';

// Use REAL config/hooks
import { auth } from '@/firebase/config';
import FormsManagementPage from '@/pages/admin/FormsManagementPage';
import { PermissionProvider } from '@/hooks/usePermissions';
import { AuthProvider } from '@/contexts/AuthContext';
import LanguageContext from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { runFormsManagementPageTests, TestData } from './FormsManagementPage.tests';

// Mock LanguageContext for UI simplicity
const mockLanguageContext = {
    t: (key: string, fallback: string) => fallback || key,
    language: 'en',
    setLanguage: () => { },
    dir: 'ltr',
    isRTL: false,
    currentLanguage: 'en'
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

describeWithFirestoreEmulator('FormsManagementPage (Integration)', () => {
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

            // Seed Admin User (We'll auth as this user later)
            await db.collection('users').doc('admin_user_id').set({
                role: 'admin',
                email: 'admin@test.com',
                displayName: 'Admin User',
                name: 'Admin User'
            });

            // Seed Forms
            for (const form of data.forms) {
                // Ensure dates are Firestore Timestamps if needed, or JS dates work mostly
                const formData = {
                    ...form,
                    // Ensure optional fields are handled or set to null/undefined
                }
                await db.collection('forms').doc(form.id).set(formData);
            }

            // Seed Submissions & Related Users
            for (const sub of data.submissions) {
                // Seed the submitter user if not already
                if (sub.submitterId) {
                    await db.collection('users').doc(sub.submitterId).set({
                        name: sub.submitterName || 'Test User',
                        email: sub.submitterEmail || 'test@user.com',
                        role: 'parent' // default
                    }, { merge: true });
                }

                // Clean submission data for DB (remove expanded helpful props we added in TestData)
                const { submitterName, submitterEmail, formTitle, formType, ...dbSubmission } = sub;
                await db.collection('form_submissions').doc(sub.id).set(dbSubmission);
            }
        });

        // 2. Authenticate as Admin
        // We sign in anonymously to get a UID, then set that UID as admin in Firestore
        const userCredential = await import('firebase/auth').then(m => m.signInAnonymously(auth));
        const uid = userCredential.user.uid;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().collection('users').doc(uid).set({
                role: 'admin',
                email: 'admin@test.com',
                displayName: 'Admin User',
                name: 'Admin User'
            });
        });

        // 3. Render with Providers
        render(
            <AuthProvider>
                <ThemeProvider>
                    <LanguageContext.Provider value={mockLanguageContext}>
                        <PermissionProvider>
                            <MemoryRouter>
                                <FormsManagementPage />
                            </MemoryRouter>
                        </PermissionProvider>
                    </LanguageContext.Provider>
                </ThemeProvider>
            </AuthProvider>
        );

        // Wait for AuthProvider initialization + page data load before tests query the UI.
        await screen.findByRole('heading', { name: /Forms Management/i }, { timeout: 15000 });
        if (data.forms.length === 0) {
            await screen.findByText('No Forms Found', {}, { timeout: 15000 });
        } else {
            await screen.findByRole('heading', { name: data.forms[0].title }, { timeout: 15000 });
        }
    };

    // EXECUTE SHARED TESTS
    runFormsManagementPageTests(setupIntegration, {
        afterDelete: async (formId) => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const snap = await context.firestore().collection('forms').doc(formId).get();
                expect(snap.exists).toBe(false);
            });
        }
    });

    // Additional Integration Tests (Permissions)
    test('denies access for non-admin role', async () => {
        // Authenticate as non-admin
        const userCredential = await import('firebase/auth').then(m => m.signInAnonymously(auth));
        const uid = userCredential.user.uid;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().collection('users').doc(uid).set({
                role: 'parent',
                email: 'parent@test.com',
                displayName: 'Parent User',
            });
        });

        render(
            <AuthProvider>
                <ThemeProvider>
                    <LanguageContext.Provider value={mockLanguageContext}>
                        <PermissionProvider>
                            <MemoryRouter>
                                <FormsManagementPage />
                            </MemoryRouter>
                        </PermissionProvider>
                    </LanguageContext.Provider>
                </ThemeProvider>
            </AuthProvider>
        );

        expect(
            await screen.findByText(/Unable to load forms data/i)
        ).toBeInTheDocument();
    });

});
