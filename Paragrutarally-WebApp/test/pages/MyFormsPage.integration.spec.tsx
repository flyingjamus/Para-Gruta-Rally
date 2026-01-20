import { afterAll, beforeAll, beforeEach, describe, expect } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { signOut } from 'firebase/auth';

// Use REAL config/hooks
import { auth } from '@/firebase/config';
import MyFormsPage from '@/pages/parent/MyFormsPage';
import { PermissionProvider } from '@/hooks/usePermissions';
import { AuthProvider } from '@/contexts/AuthContext';
import LanguageContext from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { runMyFormsPageTests, TestData } from './MyFormsPage.tests';

// Mock LanguageContext for UI simplicity
const mockLanguageContext = {
    t: (key: string, fallback: string) => fallback || key,
    language: 'en',
    setLanguage: () => { },
    dir: 'ltr',
    isRTL: false,
};

// Mock Modals for integration too, as they might depend on other things not set up
// We want to test the page logic mainly for now
import { vi } from 'vitest';

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

describeWithFirestoreEmulator('MyFormsPage (Integration)', () => {
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
        // Clear data between tests
        await testEnv.clearFirestore();
        if (auth.currentUser) await signOut(auth);
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    const setupIntegration = async (data?: TestData, options?: { simulateError?: boolean }) => {
        if (options?.simulateError) return; // Skip error simulation in integration
        if (!data) return;

        // 1. Authenticate as parent
        // Note: MyFormsPage.jsx checks `getActiveForms('parent')` which requires authentication or specific rules.
        // Assuming standard user for now.

        // Create user in DB first (so it skips 'unknown' user checks if any)
        const userCredential = await import('firebase/auth').then(m => m.signInAnonymously(auth));
        const uid = userCredential.user.uid;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();

            await db.collection('users').doc(uid).set({
                role: 'parent',
                email: 'parent@test.com',
                displayName: 'Parent User'
            });

            // 2. Seed Forms
            for (const form of data.forms) {
                // Ensure dates are Firestore Timestamps or dates if needed, SDK handles JS Date objects usually
                await db.collection('forms').doc(form.id).set({
                    ...form,
                    // Ensure targetUsers includes 'parent' for getActiveForms to find it
                    targetUsers: form.targetUsers || ['parent'],
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }

            // 3. Seed Submissions
            for (const submission of data.submissions) {
                await db.collection('form_submissions').doc(submission.id).set({
                    ...submission,
                    submitterId: uid, // Make sure it belongs to the current user
                    submittedAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });

        // 3. Render
        render(
            <AuthProvider>
                <ThemeProvider>
                    <LanguageContext.Provider value={mockLanguageContext}>
                        <PermissionProvider>
                            <MemoryRouter>
                                <MyFormsPage />
                            </MemoryRouter>
                        </PermissionProvider>
                    </LanguageContext.Provider>
                </ThemeProvider>
            </AuthProvider>
        );
    };

    runMyFormsPageTests(setupIntegration, { skipErrorStateTest: true });
});
