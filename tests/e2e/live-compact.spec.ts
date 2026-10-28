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
import { compactBowlBoxPx } from '../../src/ui/components/guide/skychart/dome/camera';
import { domeDrawn, enterScrubbing, homeAt, stripFilled, T } from './liveHelpers';

/**
 * R71 (FR-LEG-8, F-62): what the box is held to with the list closed, by phone height.
 *
 * At 844 it was FR-COMP-5's floor itself — the frame's own measured width (D-187's `--chart-floor`, 374 px at
 * 390 px of viewport, which is the number F-62 quotes). At 667 the floor was out of reach and the number was a
 * measurement (198: FR-COMP-5's escape, "only where the gaps are at their minimum and the rows still do not fit
 * does the box yield below its floor"; the rest of F-62 is in `sdd-run/R71.summary.md` and spec §4.20).
 *
 * R133 (FR-FLOW-9, D-850): the dome's compact box is cut from the bowl — its drawn height at the box's width plus
 * `DOME_COMPACT_SLACK_PX` above and below, 337 at the 390 px phone — and the column scrolls past it (R132), so the
 * box is that at both heights and in both states, and this holds it to the rule rather than to the old numbers.
 */
const FLOOR_TODAY: Readonly<Record<667 | 844, number>> = {
  844: compactBowlBoxPx(390) - 1,
  667: compactBowlBoxPx(390) - 1,
};

/**
 * The rows under the box, in the order the page stacks them (FR-LIVE-7 as amended v1.2) — R77 (FR-WATCH-4):
 * per state. Scrubbing has every row the page had, the clock readout now standing above the box as the held
 * headline; watching has the next-event block above the box and, under it, the facing readout, the conditions
 * line, the overview with its end labels and the actions.
 */
const ROWS = ['dome-readout', 'status-strip', 'time-readout', 'time-stripe', 'step-controls'] as const;
const STATE_ROWS: Readonly<Record<'watching' | 'scrubbing', readonly string[]>> = {
  watching: ['next-event', 'dome-readout', 'status-strip', 'overview-row', 'overview-labels', 'live-actions'],
  scrubbing: [...ROWS, 'overview-row', 'playback-row', 'live-actions'],
};

/**
 * R77 (FR-WATCH-5, V20-13, OQ-27): the box at 390 × 667 in watching with the list closed and the view control's
 * row where FR-LIVE-7 has it. What is held is the measurement: 330 px, against FR-COMP-5's floor of 374.
 *
 * The rows under the box are the 168 px FR-WATCH-5 counts (measured 169: the facing readout, the conditions line,
 * the overview and its labels, the actions). What OQ-27's arithmetic (367 with the view row) does not count is
 * the headline above the box: the next-event block in board 1B's layout (V20-18) is three lines, 68 px — the
 * label, the clock time, the path — over the top row's 24 and the view control's 48. Without the view row the
 * box would be 378. OQ-27 leaves the row where it is and asks for the measurement; the floor at this height is
 * the owner's call on that row (and now on the headline's height), recorded in `sdd-run/R77.summary.md`.
 *
 * R127 (FR-SKY-11, D-838): the landmark line is the headline's fourth text line on compact, and the box pays
 * the 23 px a text row costs (D-814): 306 with a one-line path, 282 with two, so FR-COMP-5's floor while watching
 * is 280 (amended v2.5, V25-18; D-839), which `shapes.spec.ts` asserts. The measurement moves with it.
 */
const WATCHING_667 = 306;

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
    for (const state of ['watching', 'scrubbing'] as const) {
    test(`no two rows overlap at 390 × ${String(height)} while ${state} and the page does not scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height });
      await homeAt(page, T);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);
      if (state === 'scrubbing') await enterScrubbing(page);
      const ROWS = STATE_ROWS[state];

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

      // R132 (FR-FLOW-4, D-864): the column is at least the screen and scrolls past the box (F-55's rows no longer
      // squeeze it). R133 (FR-FLOW-9, D-850): the box is the bowl's — its drawn height at the box's width plus the
      // slack above and below, 337 at 390 px — so the rows under it are where the scroll is.
      const page_ = await page.getByTestId('live-page').boundingBox();
      expect(page_?.height).toBeGreaterThanOrEqual(height);
      expect(Math.abs((drawing?.height ?? 0) - compactBowlBoxPx(drawing?.width ?? 0))).toBeLessThanOrEqual(1);
    });
    }

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

      // R77 (FR-WATCH-5): with every row present — the scrubbing state — the box is held to what R71 measured.
      await enterScrubbing(page);
      const scrubbing = await page.getByTestId('chart-box').boundingBox();
      expect(scrubbing?.height ?? 0, 'scrubbing, every row present').toBeGreaterThanOrEqual(FLOOR_TODAY[height]);
      // …and the list is opened from the watching row, where `[ list (n) ]` stands (V20-8).
      await page.getByTestId('live-now').click();
      await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');

      const control = page.getByTestId('live-legend-toggle');
      await expect(control).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      const closed = await page.getByTestId('chart-box').boundingBox();
      const frame = await page.getByTestId('chart-frame').boundingBox();
      if (!closed || !frame) throw new Error('the box is not laid out');
      // The box's height, on the box rather than argued from the rows (FR-LEG-8). R133 (FR-FLOW-9): the bowl's rule
      // at the box's full-bleed width (390 here; the frame is the content width the page's padding leaves).
      expect(closed.height, `at ${String(height)} the box is ${String(Math.round(closed.height))} px tall in a frame ${String(Math.round(frame.width))} wide`).toBeGreaterThanOrEqual(FLOOR_TODAY[height]);

      await control.click();
      await expect(control).toHaveAttribute('aria-expanded', 'true');
      const panel = await page.getByTestId('chart-legend-slot').boundingBox();
      if (!panel) throw new Error('the panel is not laid out');
      // Two rows of `--tap` (48 px at the default cell): the panel's height, not its maximum.
      expect(panel.height, 'the open panel is two tap rows').toBeCloseTo(2 * TAP_PX, 0);
      const open = await page.getByTestId('chart-box').boundingBox();
      // R132 (FR-FLOW-4): the column scrolls, so the panel costs the box nothing and lands under it, in the list slot.
      expect(open?.height ?? 0, 'the box keeps its floor').toBeCloseTo(closed.height, 0);
      expect(panel.y).toBeGreaterThanOrEqual(closed.y + closed.height - 1);
      // …and nothing on the page has moved onto anything else.
      const rows = await Promise.all(STATE_ROWS.watching.map((id) => page.getByTestId(id).boundingBox()));
      for (const [i, first] of rows.entries()) {
        for (const second of [...rows.slice(i + 1), panel]) {
          if (!first || !second) continue;
          expect(intersects(first, second), `${String(STATE_ROWS.watching[i])} ${JSON.stringify(first)} overlaps ${JSON.stringify(second)}`).toBe(false);
        }
      }

      // The second tap gives the box its 96 px back: the height follows the reader and nothing else (V14-5).
      await control.click();
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      const again = await page.getByTestId('chart-box').boundingBox();
      expect(again?.height ?? 0).toBeCloseTo(closed.height, 0);
    });
  }

  /**
   * R77 (FR-WATCH-5, FR-WATCH-9 d; V20-13, OQ-27): watching gives the box the rows scrubbing takes — the stripe
   * block and two control rows are not in the document — so at 390 × 667 with the list closed the box is
   * measured here, with the view control's row where FR-LIVE-7 has it. The number is the measurement.
   */
  test('the box at 390 × 667 while watching, the list closed and the view control where it was (FR-WATCH-5)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await homeAt(page, T);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    await expect(page.getByTestId('live-legend-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('group', { name: 'Chart view' })).toBeVisible();
    const box = await page.getByTestId('chart-box').boundingBox();
    if (!box) throw new Error('the box is not laid out');
    expect(box.height, `the watching box at 390 × 667 is ${String(Math.round(box.height))} px`).toBeGreaterThanOrEqual(WATCHING_667);
    // R132 (FR-FLOW-4, D-864): the rows the tap adds go under the box in the column, which scrolls; the box holds its floor in both states (FR-WATCH-7's other reading).
    await enterScrubbing(page);
    const scrubbing = await page.getByTestId('chart-box').boundingBox();
    expect(scrubbing?.height ?? 0).toBeCloseTo(box.height, 0);
    await page.getByTestId('live-now').click();
    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
    const again = await page.getByTestId('chart-box').boundingBox();
    expect(again?.height ?? 0).toBeCloseTo(box.height, 0);
  });
});
