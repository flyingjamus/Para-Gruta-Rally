import { afterEach, beforeEach, vi } from 'vitest';

function readViteEnv(key: string): string | undefined {
  // In Vitest, `import.meta.env` may exist but not include values unless provided.
  // Fall back to `process.env` so tests can control config via environment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const importMetaEnv = (import.meta as any)?.env as Record<string, string | undefined> | undefined;
  return importMetaEnv?.[key] ?? process.env[key];
}

// Defaults for Firebase SDK initialization in tests.
process.env.VITE_FIREBASE_API_KEY ??= 'test-api-key';
process.env.VITE_FIREBASE_AUTH_DOMAIN ??= 'localhost';
process.env.VITE_FIREBASE_PROJECT_ID ??= 'test-project';
process.env.VITE_FIREBASE_STORAGE_BUCKET ??= 'test-project.appspot.com';
process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ??= 'test-sender';
process.env.VITE_FIREBASE_APP_ID ??= 'test-app-id';

// Prefer explicitly enabling emulators during integration tests.
process.env.VITE_USE_FIREBASE_EMULATORS ??= readViteEnv('VITE_USE_FIREBASE_EMULATORS') ?? 'true';

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(async () => {
  if (typeof window !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  }
});

// Extend `expect` with `jest-dom` matchers for DOM-enabled tests only.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}

