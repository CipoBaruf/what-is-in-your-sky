import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build served by `vite preview`
// (`npm run e2e` builds first; CI builds in the step before). PLAN §9.1:
// `page.clock` fixed and every network route mocked to a fixture.
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  // R24: the window went from 24 h to 72 h (FR-VIS-1 amended), so every test that waits for a
  // finished list waits about three times as long. The default 30 s left no room on a loaded CI box.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
});
