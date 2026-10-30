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
 * R144 (FR-TONIGHT-6, FR-TONIGHT-9; US-42 AC5) → R148 (FR-FULL-1, FR-FULL-4,
 * FR-FULL-6, FR-TONIGHT-9 as amended v2.8): the compact page renders one
 * inventory in both states — the head and `[ controls ]` over the sky, and in
 * the sheet the context line, the view row, the facing row with the readout,
 * the track, the taps and `[ list (n) ] Share` — so the rows measured are the
 * same list before and after the instant leaves real time, none lies over
 * another inside the sheet, the box is the viewport in both (the floors of
 * v2.7 are `live-full.spec.ts`'s edges now), and the page never scrolls, in
 * both languages. The list panel is two tap rows inside the sheet, with the
 * hidden-objects toggle in its head; the readout's tap opens the facing picker
 * under it in the sheet; none of it moves the box.
 *
 * `hasTouch`, because the rows were measured on a phone.
 */
import { expect, test } from '@playwright/test';
import { TAP_PX } from '../../src/lib/layout';
import { closeSheet, domeDrawn, enterScrubbing, homeAt, openSheet, pressTrackAt, shownOnTrack, stripFilled, T, trackBar } from './liveHelpers';

/** FR-FULL-4's rows in the sheet, and the head and the button over the sky: the same list in both states. */
const ROWS = ['live-head', 'live-controls', 'live-context', 'live-view-row', 'live-facing', 'live-track', 'live-taps', 'live-actions'] as const;
/** The sheet's own rows, which stand clear of one another inside it. */
const SHEET_ROWS = ['live-context', 'live-view-row', 'live-facing', 'live-track', 'live-taps', 'live-actions'] as const;

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

function expectNoOverlap(boxes: Record<string, Box>, names: readonly string[], extra: readonly Box[] = []): void {
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

test.describe('the compact live page: one inventory, the box the viewport (FR-TONIGHT-6, FR-FULL-1, FR-FULL-6)', () => {
  test.use({ hasTouch: true });

  for (const height of [667, 844] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`at 390 × ${String(height)} in ${locale}: the same rows in both states, none over another in the sheet, the box the viewport, no scroll`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height });
        await homeAt(page, T, locale);
        await page.getByTestId('live-link').click();
        await domeDrawn(page);
        await stripFilled(page);
        // Watching: the ISS is up at T, so the page stays on real time with no card (FR-FULL-10) and the chip says `now`.
        await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
        await expect(page.getByTestId('live-card')).toHaveCount(0);
        const box = await page.getByTestId('chart-box').boundingBox();
        if (!box) throw new Error('the box is not laid out');
        // FR-FULL-1: the box is the viewport.
        expect(Math.round(box.width)).toBe(390);
        expect(Math.round(box.height)).toBe(height);
        expect(Math.round(box.x)).toBe(0);
        expect(Math.round(box.y)).toBe(0);
        await openSheet(page);
        await expect(page.getByTestId('live-legend-toggle')).toHaveAttribute('aria-expanded', 'false');
        const watching = await rows(page);
        expectNoOverlap(watching, SHEET_ROWS);
        // FR-TONIGHT-9, FR-LIVE-1: the page is the viewport and does not scroll; the sheet stands inside it.
        const pageBox = await page.getByTestId('live-page').boundingBox();
        expect(Math.round(pageBox?.height ?? 0)).toBe(height);
        expect(await scrolls(page), 'the page scrolls').toBe(false);
        const sheet = await page.getByTestId('live-sheet').boundingBox();
        expect((sheet?.y ?? 0) + (sheet?.height ?? 0)).toBeLessThanOrEqual(height + 0.5);
        // The readout in the sheet's facing row (FR-FULL-4, D-923): on the dome the words alone, a target row tall.
        const facing = watching['live-facing'];
        if (!facing) throw new Error('no facing row');
        expect(facing.height).toBeGreaterThanOrEqual(43.5);
        await expect(page.getByTestId('live-facing').getByTestId('dome-readout')).toBeVisible();
        await expect(page.getByTestId('sky-readout-toggle')).toHaveCount(0);
        test.info().annotations.push({ type: 'box', description: `${locale} 390×${String(height)} watching: ${String(Math.round(box.width))}×${String(Math.round(box.height))} px, the sheet ${String(Math.round(sheet?.height ?? 0))} px` });

        // Held: the same rows, the same box, no scroll (FR-TONIGHT-6: nothing appears or disappears, FR-FULL-6).
        await enterScrubbing(page);
        await expect(page.getByTestId('shown-chip')).not.toHaveAttribute('data-kind', 'now');
        const held = await rows(page);
        expectNoOverlap(held, SHEET_ROWS);
        expect(Object.keys(held)).toEqual(Object.keys(watching));
        const heldBox = await page.getByTestId('chart-box').boundingBox();
        expect(heldBox, 'the box keeps its size when t leaves now').toEqual(box);
        expect(await scrolls(page), 'the page scrolls while held').toBe(false);
        for (const id of ROWS) expect(Math.round(held[id]?.y ?? -1), `${id} stays where it was`).toBe(Math.round(watching[id]?.y ?? -2));
        // A drag to the small hours: still the same box.
        await pressTrackAt(page, T + 9 * 3_600_000);
        await page.clock.runFor(300);
        expect(Math.abs((await shownOnTrack(page)) - (T + 9 * 3_600_000))).toBeLessThan(10 * 60_000);
        expect(await page.getByTestId('chart-box').boundingBox()).toEqual(box);
        // `[ now ]`: back, the same box; the sheet closed, the same box.
        await page.getByTestId('live-tap-now').click();
        await expect(page.getByTestId('shown-chip')).toHaveAttribute('data-kind', 'now');
        expect(await page.getByTestId('chart-box').boundingBox()).toEqual(box);
        await closeSheet(page);
        expect(await page.getByTestId('chart-box').boundingBox()).toEqual(box);
      });
    }

    /**
     * R71 (FR-LEG-7, FR-LEG-8, FR-COMP-5 as amended v1.4; V14-5): F-62, closed by measurement — and R148
     * (FR-FULL-4, FR-FULL-6): the list panel opens under the actions inside the sheet, exactly two rows of `--tap`
     * whatever it holds, with the hidden-objects toggle in its head (D-905); the sheet grows, the box does not, and
     * the page does not scroll.
     */
    test(`the list panel is two tap rows with the hidden toggle in its head, under the actions inside the sheet at 390 × ${String(height)}, and nothing resizes the box`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height });
      await homeAt(page, T);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);
      const closed = await page.getByTestId('chart-box').boundingBox();
      if (!closed) throw new Error('the box is not laid out');
      await openSheet(page);

      const control = page.getByTestId('live-legend-toggle');
      await expect(control).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      await expect(page.getByTestId('live-list-head')).toHaveCount(0);
      expect(await page.getByTestId('chart-box').boundingBox()).toEqual(closed);

      await control.click();
      await expect(control).toHaveAttribute('aria-expanded', 'true');
      // The sheet's body scrolls to the panel where the rows are taller than the sheet (the short phone).
      await page.getByTestId('chart-legend-slot').scrollIntoViewIfNeeded();
      const panel = await page.getByTestId('chart-legend-slot').boundingBox();
      const head = await page.getByTestId('live-list-head').boundingBox();
      if (!panel || !head) throw new Error('the panel is not laid out');
      // Two rows of `--tap` (48 px at the default cell): the panel's height, not its maximum.
      expect(panel.height, 'the open panel is two tap rows').toBeCloseTo(2 * TAP_PX, 0);
      // The head over the panel, with the toggle, and the toggle still the saved pref (FR-LIVE-6).
      expect(head.y + head.height).toBeLessThanOrEqual(panel.y + 0.5);
      await expect(page.getByTestId('live-list-head').getByRole('button', { name: 'Hidden objects' })).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('live-actions').getByRole('button', { name: 'Hidden objects' })).toHaveCount(0);
      // The panel and its head are inside the sheet, under the actions row; the page still does not scroll; the box is the same.
      const actions = await page.getByTestId('live-actions').boundingBox();
      expect(head.y).toBeGreaterThanOrEqual((actions?.y ?? 0) + (actions?.height ?? 0) - 1);
      const sheet = await page.getByTestId('live-sheet').boundingBox();
      expect(panel.y + panel.height).toBeLessThanOrEqual((sheet?.y ?? 0) + (sheet?.height ?? 0) + 0.5);
      expect(panel.y + panel.height).toBeLessThanOrEqual(height + 0.5);
      expect(await scrolls(page), 'the page scrolls with the list open').toBe(false);
      expect(await page.getByTestId('chart-box').boundingBox(), 'the list does not resize the box (FR-FULL-6)').toEqual(closed);
      // …and nothing in the sheet has moved onto anything else.
      const boxes = await rows(page);
      expectNoOverlap(boxes, SHEET_ROWS, [panel, head]);

      // The second tap closes the panel: the box was never involved (V14-5, FR-FULL-6).
      await control.click();
      await expect(page.getByTestId('chart-legend-slot')).toHaveCount(0);
      await expect(page.getByTestId('live-list-head')).toHaveCount(0);
      expect(await page.getByTestId('chart-box').boundingBox()).toEqual(closed);
    });
  }

  /** FR-FULL-4 (D-923): the readout's tap opens the facing picker under it in the sheet on the window, and a pick closes it. */
  test('at 390 × 844 in the window the readout opens the facing picker under it in the sheet, a pick closes it, and the box keeps its size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await homeAt(page, T);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await openSheet(page);
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
    await expect(page.getByTestId('live-facing-picker')).toHaveCount(0);
    const before = await page.getByTestId('chart-box').boundingBox();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const picker = page.getByTestId('live-facing-picker');
    await expect(picker).toBeVisible();
    const pickerBox = await picker.boundingBox();
    const facing = await page.getByTestId('live-facing').boundingBox();
    const readout = await toggle.boundingBox();
    expect(pickerBox?.y ?? 0).toBeGreaterThanOrEqual((readout?.y ?? 0) + (readout?.height ?? 0) - 1);
    expect(pickerBox?.y ?? 0).toBeGreaterThanOrEqual(facing?.y ?? 0);
    // The row costs the sheet, not the box (FR-FULL-6), and the page still does not scroll.
    expect(await scrolls(page)).toBe(false);
    expect(await page.getByTestId('chart-box').boundingBox()).toEqual(before);
    await expect(trackBar(page)).toBeVisible();
    // A pick closes it.
    await picker.getByRole('button', { name: 'NE', exact: true }).click();
    await expect(picker).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await page.getByTestId('chart-box').boundingBox()).toEqual(before);
  });
});
