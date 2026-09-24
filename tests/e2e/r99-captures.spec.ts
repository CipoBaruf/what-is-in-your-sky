/**
 * R99 captures (FR-TAB-1..3, US-35): the compact column on a tablet — the home, the guide's sheet, the settings
 * page and the live page (watching) at 768 × 1024, both themes, English. What to look at: each page is a
 * `COMPACT_MAX_CELLS` column in the middle of the screen with the page's ground either side, the chart box no
 * wider than the column, and the live page whole in the viewport with nothing to scroll to.
 *
 * Evidence for the PR, not a test; off the pull-request path (FR-CI-1):
 *
 *   CAPTURES=1 npx playwright test r99-captures --project=chromium
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { domeDrawn, listSettled, seedStoredRun, stripFilled } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', viewport: { width: 768, height: 1024 } });

const THEMES = ['dark', 'night'] as const;
const WIDTH = 768;

for (const theme of THEMES) {
  test(`home, the guide, settings and the live page at ${String(WIDTH)} px, ${theme}, en`, async ({ page }) => {
    const shot = (screen: string): Promise<Buffer> => page.screenshot({ path: `${CAPTURE_DIR}/r99-${screen}-${String(WIDTH)}-${theme}-en.png` });
    await seedStoredRun(page, { prefs: { theme }, settled: true });
    await listSettled(page);
    await shot('home');

    // The guide: the first card's pass, its chart drawn (the chunk, the font and the first raster wait on timers the paused clock holds).
    await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await page.clock.runFor(1000);
    await expect(sheet.locator('pre.glyph-output').first()).toBeVisible({ timeout: 30_000 });
    await shot('guide');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // The settings page, as the header link opens it: the chunk is prefetched on hover (`Header.tsx`), so the click does not wait on a timer.
    const link = page.getByTestId('settings-link');
    const chunk = page.waitForResponse((response) => /\/Settings-[^/]*\.js$/.test(response.url()), { timeout: 5_000 }).catch(() => undefined);
    await link.hover();
    await chunk;
    await link.click();
    await expect(page.getByTestId('settings-back')).toBeVisible();
    await shot('settings');
    await page.getByTestId('settings-back').click();
    await expect(page.getByTestId('live-link')).toBeVisible();

    // The live page, watching.
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    await shot('live');
  });
}
