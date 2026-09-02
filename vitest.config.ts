import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Two projects (TASKS R2): jsdom for `src/ui`, Node for everything else.
// Both start the MSW server so no test can reach the network (PLAN §9.3).
export default defineConfig({
  plugins: [react()],
  test: {
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
