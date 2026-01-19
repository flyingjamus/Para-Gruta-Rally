import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { signInAnonymously, signOut } from 'firebase/auth';

import { auth } from '@/firebase/config.js';
import KidNameFromFirestore from './components/KidNameFromFirestore';

function parseHostAndPort(hostAndPort: string | undefined): { host: string; port: number } | undefined {
  if (hostAndPort == null) return undefined;
  const [host, portString] = hostAndPort.split(':');
  const port = Number(portString);
  return Number.isFinite(port) ? { host, port } : undefined;
}

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'test-project';
const FIRESTORE_RULES = readFileSync(resolve(process.cwd(), 'firebase/firestore.rules'), 'utf8');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const emulator = parseHostAndPort(process.env.FIRESTORE_EMULATOR_HOST) ?? { host: '127.0.0.1', port: 8080 };

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

describe('React + Firestore emulator integration', () => {
  test('renders kid name from Firestore (authenticated user)', async ({ expect }) => {
    const kidId = 'kid_ava';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('kids').doc(kidId).set({
        personalInfo: { firstName: 'Ava', lastName: 'Test' },
      });
    });

    await signInAnonymously(auth);

    render(<KidNameFromFirestore kidId={kidId} />);

    await waitForElementToBeRemoved(() => screen.getByRole('status', { name: /loading kid/i }));
    expect(screen.getByRole('heading', { name: /kid: ava test/i })).toBeInTheDocument();
  });
});

