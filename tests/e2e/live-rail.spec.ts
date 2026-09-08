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
 * 1280 x 800, 66 % at 1920 x 1080, 68 % at 2560 x 1440. With the rail: 92 % at
 * all three (macOS Chromium; a platform that rounds the glyph advance to a
 * whole device pixel is held to D-293's lower floor, as in `dome-fit.spec.ts`).
 *
 * Every test sets its own viewport, so this file runs in the default project.
 */
import { expect, test, type Page } from '@playwright/test';
import { fitFloor, painted } from './domeInk';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

/** The page's own bottom padding plus a row, which is all that may be left under the box. */
const UNDER_THE_BOX_PX = 32;

async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

for (const [width, height] of [
  [1280, 800],
  [1920, 1080],
  [2560, 1440],
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

    test('covers at least 90 % of the width of its box, not two thirds of it', async ({ page }) => {
      await openLive(page);
      const dome = page.getByTestId('live-dome');
      const box = await dome.getByTestId('chart-box').boundingBox();
      if (!box) throw new Error('no chart box');
      const { extent, layers } = await painted(dome.locator('[data-drawing="dome"]'));
      expect(layers.length).toBeGreaterThan(0);
      expect(extent.width / box.width, `the drawing over the ${box.width.toFixed(0)} px width of its box`).toBeGreaterThanOrEqual(fitFloor(layers, box.width));
    });
  });
}
