import { defineConfig, devices } from '@playwright/test';
import base, { DESIGN_SPEC } from './playwright.config';

/**
 * R108 (FR-DS-6; D-706, D-728): the design captures' config. `playwright.config.ts`
 * serves the production build with `vite preview`, where `dev/primitives.html`
 * does not exist (`index.html` is the only build input), so the dev page is shot
 * under a second config whose web server is `vite` itself. Everything else is
 * the committed config's: the timeouts, the reporter, the CI worker count and
 * the F-20 rule that a driver session never adopts a server it did not start.
 *
 *   npm run design:captures
 *
 * The port is the dev server's own (5173, `DESIGN_PORT` to move it), not
 * `E2E_PORT`: a `vite preview` left on 4173 by an e2e run would be adopted
 * locally and has no dev page to serve. On the dev server's port the server
 * that may be adopted is `npm run dev`, which serves the page.
 */
const PORT = Number(process.env['DESIGN_PORT'] ?? 5173);
const HEADLESS_TASK = !!process.env['SDD_HEADLESS'];

export default defineConfig({
  ...base,
  testMatch: DESIGN_SPEC,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  use: { ...base.use, baseURL: `http://localhost:${String(PORT)}` },
  webServer: {
    command: `npx vite --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}/dev/primitives.html`,
    reuseExistingServer: !process.env['CI'] && !HEADLESS_TASK,
    timeout: 60_000,
  },
});
