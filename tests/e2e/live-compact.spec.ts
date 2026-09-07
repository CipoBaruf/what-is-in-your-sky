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
import { domeDrawn, homeAt, stripFilled, T } from './liveHelpers';

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
  }
});
