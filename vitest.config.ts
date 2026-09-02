import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Three projects: jsdom for `src/ui`, Node for everything else, and (R5) a
// Chromium browser project for the worker integration test, which boots the
// real module worker (PLAN §9.1). Node and jsdom start the MSW server so no
// unit test can reach the network (PLAN §9.3); the browser project makes no
// requests at all (fixtures are imported as modules).
export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' }, // D-18, same as vite.config.ts
  optimizeDeps: { include: ['satellite.js', 'astronomy-engine'] }, // browser project: pre-bundle so Vite does not reload mid-test
  test: {
    // TASKS H: `npm run test:coverage:physics` must show every file in src/physics at ≥ 90 % lines.
    // Only applied when `--coverage` is passed; plain `npm test` is unaffected.
    coverage: {
      provider: 'v8',
      include: ['src/physics/**/*.ts'],
      exclude: ['src/physics/**/*.test.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { perFile: true, lines: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: ['src/ui/**', 'src/**/*.integration.test.ts', 'tests/e2e/**', 'node_modules/**'],
          setupFiles: ['tests/setup/vitest.node.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/setup/vitest.jsdom.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.integration.test.ts'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
