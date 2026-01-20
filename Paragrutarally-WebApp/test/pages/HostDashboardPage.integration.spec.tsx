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
import HostDashboardPage from '@/pages/host/HostDashboardPage';
import { PermissionProvider } from '@/hooks/usePermissions';
import { AuthProvider } from '@/contexts/AuthContext';
import LanguageContext from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { runHostDashboardTests, TestData } from './HostDashboardPage.tests';

// Mock LanguageContext for UI simplicity
const mockLanguageContext = {
  t: (key: string, fallback: string) => fallback || key,
  language: 'en',
  setLanguage: () => {},
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

describeWithFirestoreEmulator('HostDashboardPage (Integration)', () => {
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

      // Create Host User
      await db.collection('users').doc('host_user_id').set({
        role: 'host',
        email: 'host@test.com',
        displayName: 'Host User'
      });

      // Seed Events
      for (const event of data.events) {
        await db.collection('events').doc(event.id).set(event);
      }

      // Seed Participants (Kids)
      for (const kid of data.participants) {
        await db.collection('kids').doc(kid.id).set(kid);
      }
    });

    // 2. Authenticate
    const userCredential = await import('firebase/auth').then(m => m.signInAnonymously(auth));
    const uid = userCredential.user.uid;

    // Ensure the signed-in user has an allowed role (AuthContext validates roles).
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc(uid).set({
            role: 'host',
            email: 'host@test.com',
            displayName: 'Host User'
        });
    });

    // 3. Render with Providers
    render(
      <AuthProvider>
        <ThemeProvider>
          <LanguageContext.Provider value={mockLanguageContext}>
              <PermissionProvider>
                <MemoryRouter>
                  <HostDashboardPage />
                </MemoryRouter>
              </PermissionProvider>
          </LanguageContext.Provider>
        </ThemeProvider>
      </AuthProvider>
    );
  };

  // EXECUTE SHARED TESTS
  runHostDashboardTests(setupIntegration, {
    afterCommentSaved: async ({ kidId, comment }) => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const snap = await context.firestore().collection('kids').doc(kidId).get();
        expect(snap.data()?.comments?.organization).toBe(comment);
      });
    },
  });

  test('denies access for parent role', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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
                <HostDashboardPage />
              </MemoryRouter>
            </PermissionProvider>
          </LanguageContext.Provider>
        </ThemeProvider>
      </AuthProvider>
    );

    expect(
      await screen.findByText('Access denied: Host/Guest credentials required')
    ).toBeInTheDocument();

    // ensure UI is inert in denied state
    expect(screen.queryByLabelText(/search/i)).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
  });
});
