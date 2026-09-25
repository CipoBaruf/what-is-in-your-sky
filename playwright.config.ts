import { defineConfig, devices } from '@playwright/test';
import { DEVICES as PROMO_DEVICES } from './tests/e2e/promoFlows';

// E2E runs against the production build served by `vite preview`
// (`npm run e2e` builds first; CI builds in the step before). PLAN §9.1:
// `page.clock` fixed and every network route mocked to a fixture.
// D-132: the driver runs a wave's tasks at once and gives each session its own
// `E2E_PORT`, so no session's e2e runs against another worktree's preview.
const PORT = Number(process.env['E2E_PORT'] ?? 4173);
const HEADLESS_TASK = !!process.env['SDD_HEADLESS'];

/**
 * P4 (FR-SHOW-6, D-652): the recording run's file. Only the `promo` project
 * runs it, and every other project ignores it by name, so `npm run e2e` and CI
 * never record. `tests/docs/promo.test.ts` holds the config to both halves.
 */
export const PROMO_SPEC = /promo-record\.spec\.ts/;
/**
 * Whether this invocation asked for the recording run. A bare `playwright test`
 * runs every project in the config, so a `promo` project that was always there
 * would record under `npm run e2e` and on CI whatever the other projects
 * ignore; it is in the list only when `--project=promo` (or `--project promo`)
 * is on the command line, which is what `npm run promo:record` passes.
 */
export const promoSelected = (argv: readonly string[]): boolean => argv.some((arg, i) => arg === '--project=promo' || (arg === '--project' && argv[i + 1] === 'promo'));
/**
 * Every worker loads this file again with its own argv, which has no
 * `--project` on it, and a project the runner found must be in the worker's
 * list too ("Project not found in the worker process"). The runner's answer is
 * relayed through the environment the workers inherit.
 */
if (promoSelected(process.argv)) process.env['PLAYWRIGHT_PROMO'] = '1';
const PROMO_RUN = process.env['PLAYWRIGHT_PROMO'] === '1';
/*
 * P4 (FR-SHOW-6, FR-SHOW-7; D-652): the recording run. `npm run promo:record` is the only thing that
 * selects it (`--project=promo`), and it is not a test: every assertion in the file is there so a
 * recording cannot be of a page that had not finished loading. One test per flow, in one worker in
 * order — a recording wants the box to itself, and `afterAll` moves every video the file produced —
 * with no retry, because a second take of a flow is the same file written twice. The frame here is
 * the phone's (`promoFlows.ts`: 1170 × 2532, since Playwright otherwise scales a recording to fit
 * 800 × 800). A `video` option cannot differ per `describe` (Playwright refuses it: it would force a
 * new worker), so the spec opens one context per flow with its device's `recordVideo` — the phone's
 * frame or the desk's 1440 × 900 — and this option is the default for any page the fixture opens.
 */
export const PROMO_PROJECT = {
  name: 'promo',
  testMatch: PROMO_SPEC,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  use: { ...devices['Desktop Chrome'], video: { mode: 'on' as const, size: PROMO_DEVICES.phone.frame } },
};

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
    // An action has no timeout of its own by default, so a click on an element that never becomes
    // actionable burns the whole 90 s test timeout, three times over with CI's retries — which reads
    // as a slow box rather than as the one broken test it is (R88's CI failure). 30 s names the action
    // that hung and still leaves room under `timeout`: the suite's slowest specs take about 13 s each
    // whole when the workers contend, so no honest single action comes near this.
    actionTimeout: 30_000,
  },
  projects: [
    // Desktop Chrome is 1280 × 720: the width the approved mockup fixes (FR-DESK-5).
    { name: 'chromium', testIgnore: [/dome-fit\.spec\.ts/, PROMO_SPEC], use: { ...devices['Desktop Chrome'] } },
    /*
     * R50 (FR-DESK-5 as amended, D-192): the mid width. Between the wide
     * breakpoint and `WIDE_SPLIT_MIN_PX` the right column shows one thing at a
     * time (F-6), and no test at 1280 px can see it. Only `wide.spec.ts` runs
     * here — the rest of the suite has nothing to say twice — and the capture
     * set shoots the home and the guide at this width as well.
     */
    { name: 'desktop-1024', testMatch: /wide\.spec\.ts/, testIgnore: PROMO_SPEC, use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
    /*
     * R57 (FR-DOME-1 as amended v1.2, D-279, F-54): the width R54's ceiling
     * test never pinned. `dome-fit.spec.ts` sets its own viewports and device
     * pixel ratios test by test (2560 × 1440, and 1280 × 800 at a DPR of 2), so
     * this project's own `use.viewport` is only the project's default; it runs
     * nowhere else, so the suite does not pay for it twice.
     */
    { name: 'desktop-2560', testMatch: /dome-fit\.spec\.ts/, testIgnore: PROMO_SPEC, use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1440 } } },
    // P4 (D-652): the recording run, only when this invocation asked for it — see `promoSelected`.
    ...(PROMO_RUN ? [PROMO_PROJECT] : []),
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // A driver session never adopts a server it did not start: with two worktrees it might be another task's build.
    reuseExistingServer: !process.env['CI'] && !HEADLESS_TASK,
    timeout: 60_000,
  },
});
