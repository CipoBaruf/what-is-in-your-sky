import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Five projects: jsdom for `src/ui`, Node for everything else, (R5) a
// Chromium browser project for the worker integration test, which boots the
// real module worker (PLAN §9.1), (R11) `live`, the `LIVE=1` contract suite in
// `tests/live` with no MSW at all — it is the one place tests reach the
// network, and it skips itself without `LIVE=1` — and (R18) `perf`, the
// §9.1 performance budgets. Node and jsdom start the MSW server so no unit
// test can reach the network (PLAN §9.3); the browser project makes no
// requests at all (fixtures are imported as modules).
//
// The budgets are wall-clock gates, so they must not measure each other: they
// run in their own project at `groupOrder: 1` (after every other project) in a
// single fork (one file at a time). Before that they raced — the 72 h budget
// R18 added pushed the 24 h budget from ~1.0 s to 1.73 s against its 1.5 s
// limit, which is the contention the file's own comment had already warned
// about, not the algorithm (PLAN D-96).
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
          exclude: ['src/ui/**', 'src/**/*.integration.test.ts', 'src/**/*.perf.test.ts', 'tests/e2e/**', 'tests/live/**', 'node_modules/**'],
          setupFiles: ['tests/setup/vitest.node.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'perf',
          environment: 'node',
          include: ['src/**/*.perf.test.ts'],
          setupFiles: ['tests/setup/vitest.node.ts'],
          sequence: { groupOrder: 1 }, // last, once the rest of the suite has released the cores
          poolOptions: { forks: { singleFork: true } }, // and one budget at a time
        },
      },
      {
        extends: true,
        test: {
          name: 'live',
          environment: 'node',
          include: ['tests/live/**/*.test.ts'],
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
