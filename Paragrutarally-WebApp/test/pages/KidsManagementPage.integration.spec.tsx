import { afterAll, beforeAll, beforeEach, describe, expect, vi } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { signOut } from 'firebase/auth';

import { auth } from '@/firebase/config';
import KidsManagementPage from '@/pages/admin/KidsManagementPage';
import { AuthProvider } from '@/contexts/AuthContext';
import LanguageContext from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { runKidsManagementTests, TestData } from './KidsManagementPage.tests';

// Mock LanguageContext
const mockLanguageContext = {
    t: (key: string, fallback: string) => fallback || key,
    language: 'en',
    setLanguage: () => { },
    dir: 'ltr',
    isRTL: false,
};

// Mock kidPhotoService to avoid storage calls
vi.mock('@/services/kidPhotoService', () => ({
    getKidPhotoInfo: () => ({ url: 'http://placeholder', hasPhoto: false }),
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

describeWithFirestoreEmulator('KidsManagementPage (Integration)', () => {
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

    const setupIntegration = async (data?: TestData) => {
        if (!data) return;

        // 1. Authenticate
        const { signInAnonymously } = await import('firebase/auth');
        const userCredential = await signInAnonymously(auth);
        const uid = userCredential.user.uid;

        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();

            // 2. Seed Admin User
            await db.collection('users').doc(uid).set({
                role: 'admin',
                email: 'admin@test.com',
                displayName: 'Admin User',
                createdAt: new Date(),
            });

            // 3. Seed Teams
            for (const team of data.teams) {
                await db.collection('teams').doc(team.id).set(team);
            }

            // 4. Seed Kids
            for (const kid of data.kids) {
                // Ensure kid has necessary fields for Firestore
                await db.collection('kids').doc(kid.id).set({
                    ...kid,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        });

        // Small delay for Firestore
        await new Promise(resolve => setTimeout(resolve, 100));

        render(
            <AuthProvider>
                <ThemeProvider>
                    <LanguageContext.Provider value={mockLanguageContext}>
                        <MemoryRouter>
                            <KidsManagementPage />
                        </MemoryRouter>
                    </LanguageContext.Provider>
                </ThemeProvider>
            </AuthProvider>
        );

        // Wait for Auth
        await waitFor(() => {
            expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
        }, { timeout: 10000 });

        // Wait for Data
        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
            // Verify we see at least one kid or empty state
            // If data.kids is empty, we see "No kids found"
            // If not, we see list
        }, { timeout: 5000 });
    };

    runKidsManagementTests(setupIntegration);
});
