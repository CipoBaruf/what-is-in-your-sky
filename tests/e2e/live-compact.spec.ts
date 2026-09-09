/**
 * R59 (FR-LIVE-7 as amended v1.2, F-55, D-281): the compact live page fits its
 * rows.
 *
 * The finding was an overlap — the clock readout above the stripe sitting on
 * top of the facing-and-tilt line under the drawing — and an overlap is a
 * measurement, not a rule about a stylesheet: jsdom resolves no layout, so
 * `Live.test.tsx` cannot see one. This spec reads the boxes of the five rows
 * the requirement names — the facing readout, the status strip, the clock
 * readout, the stripe and the stepping row — at both phone heights the app
 * supports, and asserts that no two of them intersect and that the page does
 * not scroll to make room.
 *
 * `hasTouch`, because the stepping row (FR-TRAJ-5) is drawn only where a
 * finger can use it, and it is the last row of the stack: the one that goes
 * off the bottom first.
 */
import { expect, test } from '@playwright/test';
import { TAP_PX } from '../../src/lib/layout';
import { domeDrawn, homeAt, stripFilled, T } from './liveHelpers';

/**
 * R71 (FR-LEG-8, F-62): what the box is held to with the list closed, by phone height.
 *
 * At 844 it is FR-COMP-5's floor itself — the frame's own measured width (D-187's `--chart-floor`, 374 px at
 * 390 px of viewport, which is the number F-62 quotes) — and the measurement on this branch is 375. The legend
 * off the page's rows is what gives it back: F-62 measured 259 here, so this fails on the old layout.
 *
 * At 667 the floor is out of reach and this number is a measurement, not a rule. The rows the page must draw
 * under the box — the strip's two lines, the clock, the overview row (FR-SPAN-2), the stripe's three rows, the
 * stepping row and the actions — take more than the 293 px a 667 px phone has left over a 374 px box, so
 * FR-COMP-5's own escape applies ("only where the gaps are at their minimum and the rows still do not fit does
 * the box yield below its floor"). What R71 buys there is 82 px → 198, and that is what is held. The rest of
 * F-62 is open: see `sdd-run/R71.summary.md` and spec §4.20.
 */
const FLOOR_TODAY: Readonly<Record<667 | 844, number>> = { 844: 374, 667: 198 };

/** The rows under the box, in the order the page stacks them (FR-LIVE-7 as amended v1.2). */
const ROWS = ['dome-readout', 'status-strip', 'time-readout', 'time-stripe', 'step-controls'] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The overlap of two boxes in each axis; both positive is an intersection. A hairline is the rounding of a device pixel, not an overlap. */
function intersects(a: Box, b: Box): boolean {
  const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return across > 0.5 && down > 0.5;
}

test.describe('the compact live page under the box (F-55)', () => {
  test.use({ hasTouch: true });

  for (const height of [667, 844] as const) {
    test(`no two rows overlap at 390 × ${String(height)} and the page does not scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height });
      await homeAt(page, T);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);

      const boxes: Record<string, Box> = {};
      for (const id of ROWS) {
        const locator = page.getByTestId(id);
        await expect(locator, `${id} is on the page`).toBeVisible();
        const box = await locator.boundingBox();
        expect(box, `${id} has a box`).not.toBeNull();
        if (box) boxes[id] = box;
      }

      // FR-LIVE-7 as amended: the invariant is that no element of the page overlaps another.
      for (const [i, first] of ROWS.entries()) {
        for (const second of ROWS.slice(i + 1)) {
          const a = boxes[first];
          const b = boxes[second];
          if (!a || !b) continue;
          expect(intersects(a, b), `${first} ${JSON.stringify(a)} overlaps ${second} ${JSON.stringify(b)}`).toBe(false);
        }
      }

      /*
       * D-281: the box is what gives last, and it gives *inside* its frame. The
       * old floor was a hard minimum on the drawing and on its track, so where
       * the rows left less than the frame's width the frame's grid overflowed
       * its own box and every row under the drawing — the view toggle above it
       * too — landed on the rows of the page beneath: that is what F-55 saw.
       * Applied as a floor that yields, the drawing takes what the page's own
       * `minmax(0, 1fr)` row leaves and the frame stays within its box at
       * every height.
       */
      const frame = await page.getByTestId('chart-frame').boundingBox();
      const drawing = await page.getByTestId('chart-box').boundingBox();
      expect(drawing && frame && drawing.y + drawing.height).toBeLessThanOrEqual((frame?.y ?? 0) + (frame?.height ?? 0) + 0.5);
      expect(drawing?.height ?? 0).toBeGreaterThan(0);

      // …and the page still fits one screen: it does not scroll to make room (F-55).
      const page_ = await page.getByTestId('live-page').boundingBox();
      expect(page_?.height).toBe(height);
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
      // Every row is inside the viewport, which is the same statement read from the other end.
      for (const id of ROWS) {
        const box = boxes[id];
        if (!box) continue;
        expect(box.y + box.height, `${id} is above the fold`).toBeLessThanOrEqual(height + 0.5);
      }
    });

    /**
     * R71 (FR-LEG-7, FR-LEG-8, FR-COMP-5 as amended v1.4; V14-5): F-62, closed by measurement.
     *
     * With the legend off the page's rows the box has them back, so its floor — never shorter than it is
     * wide — is measured here on the box itself, with the list closed, at both phone heights. On the old
     * layout the legend's four rows were always there and the box came out 259 px at 390 × 844 and 82 px at
     * 390 × 667 against a floor of 374, so both cases fail on it.
     *
     * Open, the panel is exactly two rows of `--tap` — 96 px, whatever it holds — the box gives that height
     * and takes it back on the second tap, and the page still does not scroll (FR-LIVE-1) at either height,
     * which is the half of FR-LEG-8 that the reader's own tap is allowed to cost the floor.
     */
    test(`the box has the legend's rows back with the list closed at 390 × ${String(height)} (${height === 844 ? "FR-COMP-5's floor" : '198 px of 374, FR-COMP-5 yielding'}), and the open panel is two tap rows`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height });
      await homeAt(page, T);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);

      const control = page.getByTestId('live-legend-toggle');
      await expect(control).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      const closed = await page.getByTestId('chart-box').boundingBox();
      const frame = await page.getByTestId('chart-frame').boundingBox();
      if (!closed || !frame) throw new Error('the box is not laid out');
      // FR-COMP-5's floor, on the box rather than argued from the rows (FR-LEG-8). The floor is the frame's
      // own measured width (D-187, `--chart-floor`), which is F-62's 374 at this phone: the box is full-bleed
      // and 390 wide, and the floor it is held to is the content width the page's padding leaves.
      expect(closed.height, `at ${String(height)} the box is ${String(Math.round(closed.height))} px tall against a floor of ${String(Math.round(frame.width))}`).toBeGreaterThanOrEqual(FLOOR_TODAY[height]);

      await control.click();
      await expect(control).toHaveAttribute('aria-expanded', 'true');
      const panel = await page.getByTestId('chart-legend-slot').boundingBox();
      if (!panel) throw new Error('the panel is not laid out');
      // Two rows of `--tap` (48 px at the default cell): the panel's height, not its maximum.
      expect(panel.height, 'the open panel is two tap rows').toBeCloseTo(2 * TAP_PX, 0);
      const open = await page.getByTestId('chart-box').boundingBox();
      expect(open?.height ?? 0, 'the box gives the panel its height').toBeLessThanOrEqual(closed.height);
      // …and nothing on the page has moved off it or onto anything else.
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
      const rows = await Promise.all(ROWS.map((id) => page.getByTestId(id).boundingBox()));
      for (const [i, first] of rows.entries()) {
        for (const second of [...rows.slice(i + 1), panel]) {
          if (!first || !second) continue;
          expect(intersects(first, second), `${String(ROWS[i])} ${JSON.stringify(first)} overlaps ${JSON.stringify(second)}`).toBe(false);
        }
      }

      // The second tap gives the box its 96 px back: the height follows the reader and nothing else (V14-5).
      await control.click();
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      const again = await page.getByTestId('chart-box').boundingBox();
      expect(again?.height ?? 0).toBeCloseTo(closed.height, 0);
    });
  }
});
