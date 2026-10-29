/**
 * R93 captures (FR-HOME-1..4; F-76, F-79): the home page at desk widths — 1024 × 768 in Spanish, where F-76
 * broke the header and cut the next event; 1280 × 800, where F-79 made Where scroll; and 1920 × 1080, where
 * the page stops growing at 160 cells — both themes.
 *
 * Evidence for the PR, not a test; off the pull-request path (FR-CI-1):
 *
 *   CAPTURES=1 npx playwright test r93-captures --project=chromium
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { seedStoredRun } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const THEMES = ['dark', 'night'] as const;

for (const [width, height, locale] of [
  [1024, 768, 'es'],
  [1280, 800, 'en'],
  [1920, 1080, 'en'],
] as const) {
  for (const theme of THEMES) {
    test(`home at ${String(width)} × ${String(height)} px, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await seedStoredRun(page, { locale, prefs: { theme } });
      // R139 (FR-FLOW-16, D-886): the doors, where this waited for the next event and the Where dome v2.6 took off the home.
      await expect(page.getByTestId('home-doors')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${CAPTURE_DIR}/r93-home-${String(width)}-${theme}-${locale}.png` });
    });
  }
}
