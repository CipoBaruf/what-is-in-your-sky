/**
 * R61 captures (FR-LIVE-7, FR-LEG-2 and FR-TRAJ-4 as amended v1.2.1; F-59):
 * the wide live page with its rail — the status strip, the stripe block, the
 * playback row and the share action beside the box under the legend, and the
 * box with the page's whole height and a width the drawing fills.
 *
 * This file replaces `r54-captures.spec.ts`, whose two assertions were the
 * rows folded *under* the box (D-268) and cannot hold now. R54's own images
 * stay in `docs/screenshots/` as the record of the layout this one replaces.
 *
 * Evidence for the PR, not a test: the assertions only make sure the capture
 * shows the thing it is named after — `live-rail.spec.ts` is where the rule is
 * measured. Off the pull-request path (FR-CI-1's budget), so they run with
 * `CAPTURES=1`, like the D-179 set, and on demand:
 *
 *   CAPTURES=1 npx playwright test r61-captures --project=chromium
 *
 * The place, the pass and the instant are `r45-captures.spec.ts`'s: Paris on
 * 2026-09-02, three minutes into the glare pass, with four passes up so the
 * legend has rows above the rail. The theme is seeded in `wiys:prefs:v1`
 * (D-70), never clicked, and one capture is one test.
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { openParisLive } from './parisLive';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

/** The rail is beside the box and the four rows are in it, top to bottom, with the box taking the page's height. */
const shoot = async (page: import('@playwright/test').Page, width: 1280 | 1920 | 2560, theme: 'dark' | 'night'): Promise<void> => {
  await openParisLive(page, width, theme);
  const box = await page.getByTestId('chart-box').boundingBox();
  const rail = await page.getByTestId('chart-aside').boundingBox();
  const strip = await page.getByTestId('status-strip').boundingBox();
  const actions = await page.getByTestId('live-actions').boundingBox();
  if (!box || !rail || !strip || !actions) throw new Error('the page is not laid out');
  expect(rail.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
  expect(strip.y).toBeLessThan(actions.y);
  expect(box.height).toBeGreaterThanOrEqual(0.85 * (page.viewportSize()?.height ?? 0));
  await page.screenshot({ path: `${CAPTURE_DIR}/r61-live-${String(width)}-${theme}-en.png` });
};

for (const width of [1280, 1920, 2560] as const) {
  test(`the live page at ${String(width)} px, dark, en: the rail beside the box`, async ({ page }) => {
    await shoot(page, width, 'dark');
  });
}

test('the live page at 1280 px, night, en: the rail beside the box', async ({ page }) => {
  await shoot(page, 1280, 'night');
});
