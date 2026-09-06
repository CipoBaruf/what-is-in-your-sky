import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build served by `vite preview`
// (`npm run e2e` builds first; CI builds in the step before). PLAN §9.1:
// `page.clock` fixed and every network route mocked to a fixture.
// D-132: the driver runs a wave's tasks at once and gives each session its own
// `E2E_PORT`, so no session's e2e runs against another worktree's preview.
const PORT = Number(process.env['E2E_PORT'] ?? 4173);
const HEADLESS_TASK = !!process.env['SDD_HEADLESS'];

export default defineConfig({
  testDir: 'tests/e2e',
  // R24: the window went from 24 h to 72 h (FR-VIS-1 amended), so every test that waits for a
  // finished list waits about three times as long. The default 30 s left no room on a loaded CI box.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  // FR-CI-3: `list` on CI too, because its per-test durations are how a spec over 60 s is found.
  reporter: process.env['CI'] ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  // FR-CI-3 (D-195): one worker per available core on CI. The default is half of them, which on a
  // two-core runner is one worker for the whole suite — half the box idle for the whole e2e stage.
  ...(process.env['CI'] ? { workers: '100%' as const } : {}),
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    // Desktop Chrome is 1280 × 720: the width the approved mockup fixes (FR-DESK-5).
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /*
     * R50 (FR-DESK-5 as amended, D-192): the mid width. Between the wide
     * breakpoint and `WIDE_SPLIT_MIN_PX` the right column shows one thing at a
     * time (F-6), and no test at 1280 px can see it. Only `wide.spec.ts` runs
     * here — the rest of the suite has nothing to say twice — and the capture
     * set shoots the home and the guide at this width as well.
     */
    { name: 'desktop-1024', testMatch: /wide\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // A driver session never adopts a server it did not start: with two worktrees it might be another task's build.
    reuseExistingServer: !process.env['CI'] && !HEADLESS_TASK,
    timeout: 60_000,
  },
});
