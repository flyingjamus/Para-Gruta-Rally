import { defineConfig, defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sharedViteConfig = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
  },
};

export default defineConfig({
  ...sharedViteConfig,
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    projects: [
      defineProject({
        ...sharedViteConfig,
        test: {
          name: 'rules',
          include: ['test/**/*.spec.ts'],
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
        },
      }),
      defineProject({
        ...sharedViteConfig,
        test: {
          name: 'ui',
          include: ['test/**/*.ui.spec.{ts,tsx}', 'test/**/*.unit.spec.{ts,tsx}', 'test/**/*.integration.spec.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
        },
      }),
    ],
  },
});
