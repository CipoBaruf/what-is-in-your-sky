/**
 * FR-LIVE-7 as amended (v1.2.1, D-312..D-315, F-59): the wide live page is two
 * columns, and the box is one of four fixed sizes. The status strip, the
 * playback row and the share action are a rail beside the box, under the
 * legend; the stripe block is in that rail at step 1 of the ladder and in a
 * row of its own under the box, the box's width, from step 2; and the box is
 * its step's size — the largest step the viewport fits on both sides.
 *
 * What this measures is the thing the owner reported and no test could see:
 * how much of its box the drawing covers *across*. `dome-fit.spec.ts` (F-54)
 * holds FR-DOME-1's rule, which is about the box's shorter side — on the wide
 * page that is the height, and the drawing filled it while a third of the
 * width stayed blank. It cannot fill a box the page shapes: the dome is
 * 2.4 : 1.7 at the fit rule (about 1.41 : 1) and the old box was 1.96 : 1 at
 * 1920 x 1080 and wider above it. So the fix is the box's shape — every step
 * is 2.4 : 1.7 — and the assertion is the drawing over the box's *width*.
 *
 * Measured on the old layout, which fails every `covers` case here: 65 % at
 * 1280 x 800, 66 % at 1920 x 1080, 68 % at 2560 x 1440, 69 % at 3840 x 2160.
 * With the ladder every step is held to FR-DOME-1's own 90 % (macOS Chromium;
 * a platform that rounds the glyph advance to a whole device pixel is held to
 * D-293's lower floor, as in `dome-fit.spec.ts`).
 *
 * 1280 x 720 is the short desktop: as wide as step 1 and still tall enough for
 * it, where the fluid box of D-312 would have been 600 px tall.
 *
 * Every test sets its own viewport, so this file runs in the default project.
 */
import { expect, test, type Page } from '@playwright/test';
import { DOME_STEPS, STRIPE_UNDER_BOX_FROM_STEP } from '../../src/lib/layout';
import { fitFloor, MIN_EXTENT_RATIO, painted } from './domeInk';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

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

const stepOf = (n: number) => {
  const entry = DOME_STEPS.find((candidate) => candidate.step === n);
  if (!entry) throw new Error(`no step ${String(n)}`);
  return entry;
};

for (const [width, height, step] of [
  [1280, 800, 1],
  [1280, 720, 1],
  [1920, 1080, 2],
  [2560, 1440, 3],
  [3840, 2160, 4],
] as const) {
  const entry = stepOf(step);
  const stripeUnder = step >= STRIPE_UNDER_BOX_FROM_STEP;

  test.describe(`at ${String(width)} x ${String(height)} (step ${String(step)})`, () => {
    test.use({ viewport: { width, height } });

    test(`gives the box its step's size, the rows beside it, and the stripe ${stripeUnder ? 'under the box' : 'in the rail'}`, async ({ page }) => {
      await openLive(page);
      await expect(page.getByTestId('live-dome')).toHaveAttribute('data-dome-step', String(step));
      const box = await page.getByTestId('live-dome').getByTestId('chart-box').boundingBox();
      const rail = await page.getByTestId('chart-aside').boundingBox();
      const block = await page.getByTestId('stripe-block').boundingBox();
      if (!box || !rail || !block) throw new Error('the page is not laid out');

      // The box is the step's, to the pixel the grid rounds to.
      expect(box.width).toBeCloseTo(entry.box.widthPx, 0);
      expect(box.height).toBeCloseTo(entry.box.heightPx, 0);

      // The rail is a column beside the box, and the three rows are in it, top to bottom.
      expect(rail.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
      let above = 0;
      for (const id of ['status-strip', 'playback-row', 'live-actions']) {
        const row = await page.getByTestId(id).boundingBox();
        if (!row) throw new Error(`${id} is not laid out`);
        expect(row.x, `${id} is in the rail`).toBeGreaterThanOrEqual(rail.x - 1);
        expect(row.y, `${id} is under the row before it`).toBeGreaterThanOrEqual(above - 1);
        above = row.y + row.height;
      }

      if (stripeUnder) {
        // D-315: a row of the frame's own under the box, the box's width, so its labels are every two hours.
        expect(block.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
        expect(block.x).toBeCloseTo(box.x, 0);
        expect(block.width).toBeCloseTo(box.width, 0);
        // Every two hours is twelve slots; the date takes one of them at midnight (FR-TRAJ-4), so eleven or twelve, never the rail's eight.
        const labels = await page.locator('[data-row="labels"] text').count();
        expect(labels).toBeGreaterThanOrEqual(11);
        expect(block.y + block.height).toBeLessThanOrEqual(height);
      } else {
        expect(block.x).toBeGreaterThanOrEqual(rail.x - 1);
        expect(block.y).toBeLessThan(box.y + box.height);
      }

      // The page never scrolls to make room: the step was chosen because it fits.
      expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([width, height]);
    });

    test('covers at least 90 % of the width of its box, not two thirds of it', async ({ page }) => {
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
        .toBeGreaterThanOrEqual(MIN_EXTENT_RATIO);
    });
  });
}
