/**
 * FR-LIVE-7 as amended (v1.2.1, D-312..D-315, F-59) and FR-LEG-6 (v1.4, V14-4,
 * D-386): the wide live page is the box with a rail beside it at *every* wide
 * width, and the box is cut to the drawing's own shape. The status strip, the
 * playback row and the share action are a rail beside the box, under the
 * legend; the stripe block is a row of its own under the box, the box's width,
 * at every wide width (V12-12), the playback controls on its clock's row
 * (V12-13); and the box is the largest rectangle of the
 * dome's own shape the frame leaves — as tall as the rows allow
 * or as wide as the space beside the rail, whichever binds first.
 *
 * What this measures is the thing the owner reported and no test could see:
 * how much of its box the drawing covers *across*. `dome-fit.spec.ts` (F-54)
 * holds FR-DOME-1's rule, which is about the box's shorter side — on the wide
 * page that is the height, and the drawing filled it while a third of the
 * width stayed blank. It cannot fill a box the page shapes: the dome is
 * 2.4 : 1.7 at the fit rule (about 1.41 : 1) and the old box was 1.96 : 1 at
 * 1920 x 1080 and wider above it. So the fix is the box's shape, and the
 * assertion is the drawing over the box's *width*.
 *
 * Measured on the old layout, which fails every `covers` case here: 65 % at
 * 1280 x 800, 66 % at 1920 x 1080, 68 % at 2560 x 1440, 69 % at 3840 x 2160.
 * With the cut box every size is held to FR-DOME-1's own 90 % (macOS Chromium;
 * a platform that rounds the glyph advance to a whole device pixel is held to
 * D-293's lower floor, as in `dome-fit.spec.ts`).
 *
 * The sizes are the four reference screens and, because a browser window is
 * never its screen, two real viewports: 1920 x 940 and 2560 x 1235, what a
 * 1080 p and a 1440 p monitor leave under the menu bar and the tabs (V12-10).
 *
 * R71 adds the four widths FR-LEG-6 names — 964 x 700 (the narrowest wide
 * viewport, FR-DESK-1's 100 cells), 1024 x 768, 1280 x 800 and 1660 x 900 —
 * where the page used to be one centred column with no rail at all. Every
 * assertion below runs at all of them, so the first three fail on the old rule:
 * there was no `chart-aside` to find.
 *
 * Every test sets its own viewport, so this file runs in the default project.
 */
import { expect, test, type Page } from '@playwright/test';
import { DOME_BOX_ASPECT } from '../../src/ui/components/guide/skychart/dome/camera';
import { fitFloor, MIN_EXTENT_RATIO, painted } from './domeInk';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

/** The page's bottom padding plus the frame's gap: what may be left under the lowest row when the height binds. */
const UNDER_PX = 24;

async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
  // The box is cut on a `ResizeObserver` and the raster re-fits it on another, so on a loaded machine the
  // rows can still be moving when the dome is first drawn. Two identical reads of the box is the page holding still.
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

for (const [width, height] of [
  [964, 700],
  [1024, 768],
  [1280, 800],
  [1280, 720],
  [1660, 900],
  [1920, 1080],
  [1920, 940],
  [2560, 1440],
  [2560, 1235],
  [3840, 2160],
] as const) {
  test.describe(`at ${String(width)} x ${String(height)}`, () => {
    test.use({ viewport: { width, height } });

    test("cuts the box to the dome's shape from what the window leaves, places the rows, and fills the box both ways", async ({ page }) => {
      await openLive(page);
      await expect(page.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'true');
      // R71 (FR-LEG-6, D-386): one wide layout. No page here is a column — the frame has a rail and does not stack.
      await expect(page.getByTestId('live-dome')).not.toHaveAttribute('data-columns', /.*/);
      await expect(page.getByTestId('chart-frame')).toHaveAttribute('data-aside', 'true');
      await expect(page.getByTestId('chart-frame')).toHaveAttribute('data-stacked', 'false');
      const box = await page.getByTestId('live-dome').getByTestId('chart-box').boundingBox();
      const block = await page.getByTestId('stripe-block').boundingBox();
      if (!box || !block) throw new Error('the page is not laid out');

      // The box is the dome's shape, to the pixel the grid rounds to.
      expect(box.width / box.height).toBeCloseTo(DOME_BOX_ASPECT, 2);

      // D-312: the rail is a column beside the box, and its two rows are in it, top to bottom (V12-13: the playback row is the stripe's).
      const rail = await page.getByTestId('chart-aside').boundingBox();
      if (!rail) throw new Error('no rail');
      expect(rail.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
      // FR-LEG-6 / FR-LEG-2 as amended v1.4: the legend shares that column, above the rail.
      const legend = await page.getByTestId('chart-legend-scroll').boundingBox();
      if (!legend) throw new Error('no legend');
      expect(legend.x, 'the legend is beside the box').toBeGreaterThanOrEqual(box.x + box.width - 1);
      expect(rail.y, 'the rail is under the legend').toBeGreaterThanOrEqual(legend.y + legend.height - 1);
      let above = 0;
      for (const id of ['status-strip', 'live-actions']) {
        const row = await page.getByTestId(id).boundingBox();
        if (!row) throw new Error(`${id} is not laid out`);
        expect(row.x, `${id} is in the rail`).toBeGreaterThanOrEqual(rail.x - 1);
        expect(row.y, `${id} is under the row before it`).toBeGreaterThanOrEqual(above - 1);
        above = row.y + row.height;
      }
      const rightEdge: number = rail.x;
      // …and the largest of that shape: either the lowest row reaches the page's bottom, or the rail is hard against the page's right edge.
      const heightBound = height - (block.y + block.height) <= UNDER_PX;
      const widthBound = width - (rail.x + rail.width) <= UNDER_PX;
      expect(heightBound || widthBound, `the box is bound by the height (${String(height - block.y - block.height)} px under it) or by the width (${String(width - rail.x - rail.width)} px past the rail)`).toBe(true);

      // D-315 (V12-12): a row of the frame's own under the box at every wide width, the box's width. Its
      // cadence is the stripe's own (FR-TRAJ-4, `labelEveryHours` on the width it measures): every two hours
      // where twelve labels fit — eleven or twelve, one slot being the date at midnight — and every three
      // hours in a narrower box, eight or nine — six where `keepLabels` drops the ones that would touch, in the
      // short one-column window's 40-cell box. `live.spec.ts` holds that none overlap.
      expect(block.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
      // Centred on the box and never narrower than it: the box's width, or the 60-cell floor over a box a short window cut smaller.
      expect(Math.abs(block.x + block.width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(2);
      expect(block.width).toBeGreaterThanOrEqual(box.width - 1);
      expect(await page.locator('[data-row="labels"] text').count()).toBeGreaterThanOrEqual(6);
      // D-318: the playback controls share the clock's row above the stripe, under the box — not the rail. Beside
      // the clock where the box is wide enough for both, wrapped under it where it is not, and in either case
      // above the stripe's rows and left of the rail.
      const clock = await page.getByTestId('time-readout').boundingBox();
      const playback = await page.getByTestId('playback-row').boundingBox();
      const stripe = await page.getByTestId('time-stripe').boundingBox();
      if (!clock || !playback || !stripe) throw new Error('the time row is not laid out');
      expect(playback.x + playback.width).toBeLessThanOrEqual(rightEdge + 1);
      expect(playback.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
      expect(playback.y + playback.height).toBeLessThanOrEqual(stripe.y + 1);
      const beside = playback.x >= clock.x + clock.width - 1 && playback.y < clock.y + clock.height && playback.y + playback.height > clock.y;
      const wrapped = playback.y >= clock.y + clock.height - 1 && Math.abs(playback.x - clock.x) <= 1;
      expect(beside || wrapped, `the playback row is beside the clock or wrapped under it (clock ${String(clock.x)},${String(clock.y)} ${String(clock.width)}×${String(clock.height)}; playback ${String(playback.x)},${String(playback.y)} ${String(playback.width)}×${String(playback.height)})`).toBe(true);

      // The page never scrolls to make room: the box was cut from what fits.
      expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([width, height]);

      // …and the drawing in it: at least 90 % across and down, centred, not two thirds of it with the top cut off.
      // One load per size (FR-CI-1): the coverage is read off the same page as the layout.
      const dome = page.getByTestId('live-dome');
      await expect
        .poll(async () => {
          const boxNow = await dome.getByTestId('chart-box').boundingBox();
          if (!boxNow) return 0;
          const { extent, layers } = await painted(dome.locator('[data-drawing="dome"]'));
          if (layers.length === 0) return 0;
          return (extent.width / boxNow.width) * (MIN_EXTENT_RATIO / fitFloor(layers, boxNow));
        }, { message: 'the drawing over the width of its box, at FR-DOME-1’s own floor' })
        .toBeGreaterThanOrEqual(MIN_EXTENT_RATIO);
      const { extent, layers } = await painted(dome.locator('[data-drawing="dome"]'));
      const cell = Math.max(...layers.map((layer) => layer.cellWidthPx)) * 2;
      expect(extent.height / box.height).toBeGreaterThanOrEqual(fitFloor(layers, box));
      expect(extent.y).toBeGreaterThanOrEqual(box.y);
      expect(extent.y + extent.height).toBeLessThanOrEqual(box.y + box.height + 1);
      const blankAbove = extent.y - box.y;
      const blankBelow = box.y + box.height - extent.y - extent.height;
      expect(Math.abs(blankAbove - blankBelow), `blank above ${String(blankAbove)} px, below ${String(blankBelow)} px`).toBeLessThanOrEqual(cell);
    });
  });
}
