/**
 * FR-LIVE-7 as amended (v1.2, D-312, F-59): the wide live page is two columns.
 * The rows that were under the box — the status strip, the stripe block, the
 * playback row and the share action — are a rail beside it, under the legend,
 * and the box takes every row of the page's height.
 *
 * What this measures is the thing the owner reported and no test could see: how
 * much of its box the drawing covers *across*. `dome-fit.spec.ts` (F-54) holds
 * FR-DOME-1's rule, which is about the box's shorter side — on the wide page
 * that is the height, and the drawing filled it while a third of the width
 * stayed blank. It cannot: the dome is about 1.41 : 1 at the default tilt and
 * the old box was 1.96 : 1 at 1920 x 1080 and wider above it. So the fix is the
 * box's shape, and the assertion is the drawing over the box's *width*.
 *
 * Measured on the old layout, which fails every `covers` case here: 65 % at
 * 1280 x 800, 66 % at 1920 x 1080, 68 % at 2560 x 1440. With the rail: 92 %,
 * 92 % and 88 % (macOS Chromium; a platform that rounds the glyph advance to a
 * whole device pixel is held to D-293's lower floor, as in `dome-fit.spec.ts`,
 * and the floors here are scaled by the same ratio).
 *
 * 2560 is the size that expects less, and on purpose: D-313 caps the rail at
 * 60 cells, so past about 2200 px the box keeps the width the rail stops
 * taking. The drawing does not lose anything by it — by then it is the box's
 * *height* that sizes it — so what the box gains there is margin, and the
 * width coverage settles a few points under the two sizes where the rail is
 * still a share of the page.
 *
 * Every test sets its own viewport, so this file runs in the default project.
 */
import { expect, test, type Page } from '@playwright/test';
import { fitFloor, MIN_EXTENT_RATIO, painted } from './domeInk';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

/** The page's own bottom padding plus a row, which is all that may be left under the box. */
const UNDER_THE_BOX_PX = 32;

async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
  // The raster re-fits its box on a `ResizeObserver`, so on a loaded machine the rows can still be moving
  // when the dome is first drawn. Two identical reads of the box is the page holding still.
  let last = '';
  await expect
    .poll(async () => {
      const rect = await page.getByTestId('chart-box').first().boundingBox();
      const now = rect ? [rect.x, rect.y, rect.width, rect.height].join(':') : '';
      const settled = now !== '' && now === last;
      last = now;
      return settled;
    })
    .toBe(true);
}

for (const [width, height, coverage] of [
  [1280, 800, 0.9],
  [1920, 1080, 0.9],
  // D-313: the rail's 60-cell cap binds here, so the box is wider than the drawing needs to be.
  [2560, 1440, 0.85],
] as const) {
  test.describe(`at ${String(width)} x ${String(height)}`, () => {
    test.use({ viewport: { width, height } });

    test('puts the rows beside the box, not under it, and the box takes the page', async ({ page }) => {
      await openLive(page);
      const box = await page.getByTestId('live-dome').getByTestId('chart-box').boundingBox();
      const rail = await page.getByTestId('chart-aside').boundingBox();
      if (!box || !rail) throw new Error('the page is not laid out');

      // The rail is a column at the right of the box, and the four rows are in it.
      expect(rail.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
      for (const id of ['status-strip', 'stripe-block', 'playback-row', 'live-actions']) {
        const row = await page.getByTestId(id).boundingBox();
        if (!row) throw new Error(`${id} is not laid out`);
        expect(row.x, `${id} is in the rail`).toBeGreaterThanOrEqual(rail.x - 1);
        expect(row.y, `${id} is beside the box, not under it`).toBeLessThan(box.y + box.height);
      }

      // …so nothing but the page's own padding is left under the box.
      expect(height - (box.y + box.height)).toBeLessThanOrEqual(UNDER_THE_BOX_PX);
    });

    test(`covers at least ${String(Math.round(coverage * 100))} % of the width of its box, not two thirds of it`, async ({ page }) => {
      await openLive(page);
      const dome = page.getByTestId('live-dome');
      /*
       * Polled, not read once: the raster re-fits its box on a `ResizeObserver`, and on a loaded machine
       * the first paint after `domeDrawn` can still be the mount's. The value polled is the coverage
       * normalised to FR-DOME-1's own floor, so a platform that rounds the glyph advance to a whole device
       * pixel — where the whole drawing is measurably smaller (D-293) — is compared on the same scale.
       */
      await expect
        .poll(async () => {
          const box = await dome.getByTestId('chart-box').boundingBox();
          if (!box) return 0;
          const { extent, layers } = await painted(dome.locator('[data-drawing="dome"]'));
          if (layers.length === 0) return 0;
          return (extent.width / box.width) * (MIN_EXTENT_RATIO / fitFloor(layers, box.width));
        }, { message: 'the drawing over the width of its box, at FR-DOME-1’s own floor' })
        .toBeGreaterThanOrEqual(coverage);
    });
  });
}
