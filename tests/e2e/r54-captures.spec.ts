/**
 * R54 captures (FR-LIVE-7 as amended v1.1.1, FR-DOME-1 as amended, F-51..F-53):
 * the wide live page — at 1920 × 1080, where the rows around the dome fold to
 * one above and two below and the raster sits inside its box, and at
 * 1280 × 800 in both themes, where the stripe keeps a row of its own. Evidence
 * for the PR, not a test: the assertions only make sure the capture shows the
 * thing it is named after. Off the pull-request path (FR-CI-1's budget was
 * 9 min 37 s on #75 before this task added a test): they run with
 * `CAPTURES=1`, like the D-179 set, and on demand:
 *
 *   CAPTURES=1 npx playwright test r54-captures --project=chromium
 *
 * The place, the pass and the instant are `r45-captures.spec.ts`'s: Paris on
 * 2026-09-02, three minutes into the glare pass, with four passes up so the
 * legend has rows beside the drawing. The theme is seeded in `wiys:prefs:v1`
 * (D-70), never clicked, and one capture is one test.
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { openParisLive } from './parisLive';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

test('the live page at 1920 px, dark, en: one row above the dome, two under it', async ({ page }) => {
  await openParisLive(page, 1920, 'dark');
  const box = await page.getByTestId('chart-box').boundingBox();
  const block = await page.getByTestId('stripe-block').boundingBox();
  const playback = await page.getByTestId('playback-row').boundingBox();
  if (!box || !block || !playback) throw new Error('no rows');
  expect(box.height).toBeGreaterThanOrEqual(0.75 * 1080);
  expect(playback.y).toBeGreaterThanOrEqual(block.y - 1);
  await page.screenshot({ path: `${CAPTURE_DIR}/r54-live-1920-dark-en.png` });
});

for (const theme of ['dark', 'night'] as const) {
  test(`the live page at 1280 px, ${theme}, en: the stripe on its own row`, async ({ page }) => {
    await openParisLive(page, 1280, theme);
    const block = await page.getByTestId('stripe-block').boundingBox();
    const playback = await page.getByTestId('playback-row').boundingBox();
    if (!block || !playback) throw new Error('no rows');
    expect(block.y).toBeGreaterThanOrEqual(playback.y + playback.height - 1);
    await page.screenshot({ path: `${CAPTURE_DIR}/r54-live-1280-${theme}-en.png` });
  });
}
