import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Two projects (TASKS R2): jsdom for `src/ui`, Node for everything else.
// Both start the MSW server so no test can reach the network (PLAN §9.3).
export default defineConfig({
  plugins: [react()],
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
          exclude: ['src/ui/**', 'tests/e2e/**', 'node_modules/**'],
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
    ],
  },
});
