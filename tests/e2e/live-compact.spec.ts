/**
 * R59 (FR-LIVE-7 as amended v1.2, F-55, D-281): the compact live page fits its
 * rows.
 *
 * The finding was an overlap — the clock readout above the stripe sitting on
 * top of the facing-and-tilt line under the drawing — and an overlap is a
 * measurement, not a rule about a stylesheet: jsdom resolves no layout, so
 * `Live.test.tsx` cannot see one. This spec reads the boxes of the page's rows
 * at both phone heights the app supports, and asserts that no two of them
 * intersect and that the page does not scroll to make room.
 *
 * R144 (FR-TONIGHT-6, FR-TONIGHT-9; US-42 AC5): the compact page renders one
 * inventory in both states — the shown time, the context line, the view row,
 * the drawing with the readout in its corner, the time track, the three taps
 * and `[ list (n) ] Share` — so the rows measured are the same list before and
 * after the instant leaves real time, the box is one height in both, the page
 * never scrolls, and the box is at least V25-18's 280 px at 390 × 667 and at
 * least 2.6.1's watching box (the bowl's cut, 337 px) at 390 × 844, in both
 * languages, with the list closed. The numbers are the Done note's.
 *
 * `hasTouch`, because the rows were measured on a phone.
 */
import { expect, test } from '@playwright/test';
import { COMPACT_BOX_MIN_SHORT_PX, TAP_PX } from '../../src/lib/layout';
import { compactBowlBoxPx } from '../../src/ui/components/guide/skychart/dome/camera';
import { domeDrawn, enterScrubbing, homeAt, pressTrackAt, shownOnTrack, stripFilled, T, trackBar } from './liveHelpers';

/**
 * R71 (FR-LEG-8, F-62) → R133 (FR-FLOW-9, D-850) → R144 (FR-TONIGHT-9): what the box is held to with the list
 * closed, by phone height. At 844 the dome's box is cut from the bowl — its drawn height at the box's width plus
 * `DOME_COMPACT_SLACK_PX` above and below, 337 at the 390 px phone — which is 2.6.1's watching box. At 667 the
 * rows leave the box less than the bowl's cut, and the box is what they leave (FR-COMP-5: the gaps give, then the
 * box), at least `COMPACT_BOX_MIN_SHORT_PX` (280, V25-18).
 */
const FLOOR: Readonly<Record<667 | 844, number>> = {
  844: compactBowlBoxPx(390) - 1,
  667: COMPACT_BOX_MIN_SHORT_PX,
};

/** FR-TONIGHT-6's rows under and over the box, the same list in both states. */
const ROWS = ['live-top-row', 'live-headline', 'live-context', 'sky-readout-toggle', 'live-track', 'live-taps', 'live-actions'] as const;

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

async function rows(page: import('@playwright/test').Page): Promise<Record<string, Box>> {
  const boxes: Record<string, Box> = {};
  for (const id of ROWS) {
    const locator = page.getByTestId(id);
    await expect(locator, `${id} is on the page`).toBeVisible();
    const box = await locator.boundingBox();
    expect(box, `${id} has a box`).not.toBeNull();
    if (box) boxes[id] = box;
  }
  return boxes;
}

function expectNoOverlap(boxes: Record<string, Box>, extra: readonly Box[] = []): void {
  const names = Object.keys(boxes);
  for (const [i, first] of names.entries()) {
    for (const second of names.slice(i + 1)) {
      const a = boxes[first];
      const b = boxes[second];
      if (!a || !b) continue;
      expect(intersects(a, b), `${first} ${JSON.stringify(a)} overlaps ${second} ${JSON.stringify(b)}`).toBe(false);
    }
    const a = boxes[first];
    for (const b of extra) if (a) expect(intersects(a, b), `${first} ${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`).toBe(false);
  }
}

async function scrolls(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

test.describe('the compact live page: one inventory, the box what the rows leave (FR-TONIGHT-6, FR-TONIGHT-9)', () => {
  test.use({ hasTouch: true });

  for (const height of [667, 844] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`at 390 × ${String(height)} in ${locale}: the same rows in both states, none over another, the box one height and at least ${String(FLOOR[height])} px, no scroll`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height });
        await homeAt(page, T, locale);
        await page.getByTestId('live-link').click();
        await domeDrawn(page);
        await stripFilled(page);
        await expect(page.getByTestId('live-legend-toggle')).toHaveAttribute('aria-expanded', 'false');

        // Watching: the ISS is up at T, so the page stays on real time (FR-TONIGHT-1) and the chip says `now`.
        await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
        const watching = await rows(page);
        expectNoOverlap(watching);
        const box = await page.getByTestId('chart-box').boundingBox();
        const frame = await page.getByTestId('chart-frame').boundingBox();
        if (!box || !frame) throw new Error('the box is not laid out');
        expect(box.height, `${locale} at ${String(height)}: the box is ${String(Math.round(box.height))} px tall, floor ${String(FLOOR[height])}`).toBeGreaterThanOrEqual(FLOOR[height]);
        // …and never more than the bowl's cut: the rows under it hug the bowl (FR-FLOW-9).
        expect(box.height).toBeLessThanOrEqual(compactBowlBoxPx(box.width) + 1);
        // D-281: the drawing gives inside its frame.
        expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height + 0.5);
        // FR-TONIGHT-9, FR-LIVE-1: the page is the viewport and does not scroll.
        const pageBox = await page.getByTestId('live-page').boundingBox();
        expect(Math.round(pageBox?.height ?? 0)).toBe(height);
        expect(await scrolls(page), 'the page scrolls').toBe(false);
        // The last row stands inside the viewport.
        const taps = watching['live-taps'];
        const actions = watching['live-actions'];
        expect((actions?.y ?? 0) + (actions?.height ?? 0)).toBeLessThanOrEqual(height + 0.5);
        expect((taps?.y ?? 0) + (taps?.height ?? 0)).toBeLessThanOrEqual(height + 0.5);
        // The readout in the box's corner (FR-TONIGHT-6, D-904): inside the box, at its top-left, a 44 px target.
        const readout = watching['sky-readout-toggle'];
        if (!readout) throw new Error('no readout');
        expect(readout.y).toBeGreaterThanOrEqual(box.y - 1);
        expect(readout.y).toBeLessThan(box.y + box.height / 4);
        expect(readout.x).toBeLessThan(box.x + box.width / 4);
        expect(readout.height).toBeGreaterThanOrEqual(43.5);
        expect(readout.width).toBeGreaterThanOrEqual(43.5);
        test.info().annotations.push({ type: 'box', description: `${locale} 390×${String(height)} watching: ${String(Math.round(box.height))} px` });

        // Held: the same rows, the same box, no scroll (FR-TONIGHT-6: nothing appears or disappears, FR-WATCH-7).
        await enterScrubbing(page);
        await expect(page.getByTestId('shown-chip')).not.toHaveAttribute('data-kind', 'now');
        const held = await rows(page);
        expectNoOverlap(held);
        expect(Object.keys(held)).toEqual(Object.keys(watching));
        const heldBox = await page.getByTestId('chart-box').boundingBox();
        expect(heldBox?.height ?? 0, 'the box keeps its height when t leaves now').toBeCloseTo(box.height, 0);
        expect(await scrolls(page), 'the page scrolls while held').toBe(false);
        for (const id of ROWS) expect(Math.round(held[id]?.y ?? -1), `${id} stays where it was`).toBe(Math.round(watching[id]?.y ?? -2));
        // A drag to the small hours: still the same box.
        await pressTrackAt(page, T + 9 * 3_600_000);
        await page.clock.runFor(300);
        expect(Math.abs((await shownOnTrack(page)) - (T + 9 * 3_600_000))).toBeLessThan(10 * 60_000);
        const dragged = await page.getByTestId('chart-box').boundingBox();
        expect(dragged?.height ?? 0).toBeCloseTo(box.height, 0);
        // `[ now ]`: back, the same box.
        await page.getByTestId('live-tap-now').click();
        await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
        const again = await page.getByTestId('chart-box').boundingBox();
        expect(again?.height ?? 0).toBeCloseTo(box.height, 0);
      });
    }

    /**
     * R71 (FR-LEG-7, FR-LEG-8, FR-COMP-5 as amended v1.4; V14-5): F-62, closed by measurement — and R144
     * (FR-TONIGHT-9): the page does not scroll, so the open panel is paid for by the box, on the reader's own
     * tap (FR-LEG-8's escape), and the second tap gives it back. The panel itself is exactly two rows of `--tap`
     * whatever it holds, with the hidden-objects toggle in its head (D-905).
     */
    test(`the box has the legend's rows back with the list closed at 390 × ${String(height)}, the open panel is two tap rows with the hidden toggle in its head, and the page does not scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height });
      await homeAt(page, T);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);

      const control = page.getByTestId('live-legend-toggle');
      await expect(control).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      await expect(page.getByTestId('live-list-head')).toHaveCount(0);
      const closed = await page.getByTestId('chart-box').boundingBox();
      if (!closed) throw new Error('the box is not laid out');
      expect(closed.height).toBeGreaterThanOrEqual(FLOOR[height]);

      await control.click();
      await expect(control).toHaveAttribute('aria-expanded', 'true');
      const panel = await page.getByTestId('chart-legend-slot').boundingBox();
      const head = await page.getByTestId('live-list-head').boundingBox();
      if (!panel || !head) throw new Error('the panel is not laid out');
      // Two rows of `--tap` (48 px at the default cell): the panel's height, not its maximum.
      expect(panel.height, 'the open panel is two tap rows').toBeCloseTo(2 * TAP_PX, 0);
      // The head over the panel, with the toggle, and the toggle still the saved pref (FR-LIVE-6).
      expect(head.y + head.height).toBeLessThanOrEqual(panel.y + 0.5);
      await expect(page.getByTestId('live-list-head').getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('live-actions').getByRole('button', { name: 'Hidden objects' })).toHaveCount(0);
      // The panel and its head are inside the viewport, under the actions row, and the page still does not scroll: the box paid.
      const actions = await page.getByTestId('live-actions').boundingBox();
      expect(head.y).toBeGreaterThanOrEqual((actions?.y ?? 0) + (actions?.height ?? 0) - 1);
      expect(panel.y + panel.height).toBeLessThanOrEqual(height + 0.5);
      expect(await scrolls(page), 'the page scrolls with the list open').toBe(false);
      const open = await page.getByTestId('chart-box').boundingBox();
      expect(open?.height ?? 0, 'the box gives the panel its rows').toBeLessThanOrEqual(closed.height + 0.5);
      expect(open?.height ?? 0).toBeGreaterThan(0);
      // …and nothing on the page has moved onto anything else.
      const boxes = await rows(page);
      expectNoOverlap(boxes, [panel, head]);

      // The second tap gives the box its rows back: the height follows the reader and nothing else (V14-5).
      await control.click();
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      await expect(page.getByTestId('live-list-head')).toHaveCount(0);
      const again = await page.getByTestId('chart-box').boundingBox();
      expect(again?.height ?? 0).toBeCloseTo(closed.height, 0);
    });
  }

  /** FR-TONIGHT-6 (D-904): the readout's tap opens the facing picker under the drawing in the window, and a pick closes it. */
  test('at 390 × 844 in the window the readout opens the facing picker under the drawing, a pick closes it, and the box keeps its height', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await homeAt(page, T);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Window' }).click();
    await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'window');
    await expect
      .poll(async () => {
        await page.clock.runFor(200);
        return page.getByTestId('window-readout').count();
      }, { timeout: 30_000 })
      .toBe(1);
    const toggle = page.getByTestId('sky-readout-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('live-layout').locator('[data-slot="picker"]')).toHaveCount(0);
    const before = await page.getByTestId('chart-box').boundingBox();
    const bar = await trackBar(page).boundingBox();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const picker = page.getByTestId('live-layout').locator('[data-slot="picker"]');
    await expect(picker).toBeVisible();
    const pickerBox = await picker.boundingBox();
    const drawing = await page.getByTestId('live-layout').locator('[data-slot="drawing"]').boundingBox();
    expect(pickerBox?.y ?? 0).toBeGreaterThanOrEqual((drawing?.y ?? 0) + (drawing?.height ?? 0) - 1);
    // The row costs the box, on the reader's tap (FR-WATCH-7), and the page still does not scroll.
    expect(await scrolls(page)).toBe(false);
    const barAfter = await trackBar(page).boundingBox();
    expect(barAfter?.y ?? 0).toBeGreaterThanOrEqual(bar?.y ?? 0);
    // A pick closes it.
    await picker.getByRole('button', { name: 'NE', exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const after = await page.getByTestId('chart-box').boundingBox();
    expect(after?.height ?? 0).toBeCloseTo(before?.height ?? 0, 0);
  });
});
