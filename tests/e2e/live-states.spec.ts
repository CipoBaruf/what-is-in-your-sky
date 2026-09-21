/**
 * R77 (FR-WATCH-1, FR-WATCH-2, FR-WATCH-4, FR-WATCH-9 b; US-27 AC1..AC4): the live page's two states in a real
 * browser. The page opens **watching** — the next event as its headline, the indicator saying `live`, the
 * overview as its only timeline, and no stripe, step row or playback row in the document — and `[ scrub ]`
 * holds the instant on screen and brings them out. A pass is stepped to with `pass ▶|`, playback runs at 60×,
 * and `[ back to live ]` puts the block away, returns the page to real time and takes the instant out of the
 * URL, so a link shared after it claims no held moment.
 *
 * R78 (FR-WATCH-5, FR-WATCH-6, FR-WATCH-7; US-27 AC5): at all four shapes — 390 × 844, 844 × 390, 1280 × 800 and
 * 1200 × 450. At the two short ones the drawing's box must not move between the states: on the short wide
 * window the scrub block is a bar inside `chart-box`, whose height is identical in both, and on the landscape
 * phone it is the rail's and the dome's column is identical in both.
 */
import { expect, test, type Page } from '@playwright/test';
import { backToLive, domeDrawn, enterScrubbing, homeAt, stripFilled, T } from './liveHelpers';
import { openParisLive } from './parisLive';

/** A speed button named exactly — the name is a substring match otherwise, and `60×` would name three (F-37). */
const speedButton = (page: Page, factor: number) => page.getByRole('button', { name: new RegExp(`^(\\[[ x]\\] )?\\[?${String(factor)}×\\]?$`) });

/** The shown instant, as the stripe's slider value says it — the stripe is the scrubbing state's. */
const shown = async (page: Page): Promise<number> => Number(await page.getByTestId('time-stripe').getAttribute('aria-valuenow'));

/** The rows only scrubbing renders (FR-WATCH-4): absent while watching, not merely hidden. */
const SCRUB_ROWS = ['time-row', 'time-stripe', 'step-controls', 'playback-row'] as const;

/** FR-WATCH-9 b's four shapes, with where `scrubPlacement` (D-448) puts the scrub block at each. */
const SHAPES = [
  [390, 844, 'under'],
  [844, 390, 'rail'],
  [1280, 800, 'under'],
  [1200, 450, 'overlay'],
] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A box once it has stopped moving: the frame re-fits on a `ResizeObserver`, a frame or two after the state changes. */
async function settledBox(page: Page, testId: string): Promise<Box> {
  let last = '';
  let box: Box | null = null;
  await expect
    .poll(async () => {
      box = await page.getByTestId(testId).boundingBox();
      const now = JSON.stringify(box);
      const same = box !== null && now === last;
      last = now;
      return same;
    })
    .toBe(true);
  if (box === null) throw new Error(`${testId} is not laid out`);
  return box;
}

for (const [width, height, placement] of SHAPES) {
  test(`watching, then scrubbing: steps a pass, plays at 60× and returns to live at ${String(width)} × ${String(height)} (FR-WATCH-1, FR-WATCH-9 b)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await homeAt(page, T);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    const watching = { dome: await settledBox(page, 'live-dome'), box: await settledBox(page, 'chart-box') };

    // Watching (US-27 AC1): the next event is the headline, the mark runs beside `live`, the overview is the
    // one timeline, and the scrub block is not in the document at all.
    const indicator = page.getByTestId('live-indicator');
    await expect(indicator).toHaveAttribute('data-state', 'live');
    await expect(indicator).toContainText('live');
    await expect(indicator.getByTestId('mark')).toHaveAttribute('data-mark-running', 'true');
    await expect(page.getByTestId('next-event')).toBeVisible();
    await expect(page.getByTestId('next-event-label')).toHaveText(/^(Next up|Up now) · /);
    await expect(page.getByTestId('overview-row')).toBeVisible();
    for (const id of SCRUB_ROWS) await expect(page.getByTestId(id), `${id} is not rendered while watching`).toHaveCount(0);
    await expect(page.getByTestId('live-now')).toHaveCount(0);
    await expect(page).toHaveURL(/#live$/);

    // `[ scrub ]` (US-27 AC2): the instant on screen is held — the headline is it, `+0 min` from now — and the
    // block comes out. The URL carries the held instant (FR-LIVE-9 unchanged).
    await enterScrubbing(page);
    await expect(indicator).toContainText('held');
    await expect(indicator.getByTestId('mark')).toHaveAttribute('data-mark-running', 'false');
    await expect(page.getByTestId('next-event')).toHaveCount(0);
    for (const id of SCRUB_ROWS) await expect(page.getByTestId(id), `${id} is rendered while scrubbing`).toBeVisible();
    await expect(page.getByTestId('time-readout')).toHaveText(/^\d\d:\d\d · \+0 min$/);

    /*
     * R78 (FR-WATCH-5, FR-WATCH-6, FR-WATCH-7; US-27 AC5): what the state change does to the drawing's box. At
     * the two short shapes, nothing: on the short wide window the block is a bar inside the box, over its bottom
     * edge and at most half of it, and `chart-box` is the height it was; on the landscape phone the block is the
     * rail's and the dome's column is where it was. On the two tall shapes the box yields to the block under it —
     * on the reader's own tap, which is the one thing that may resize it.
     */
    const scrubbing = { dome: await settledBox(page, 'live-dome'), box: await settledBox(page, 'chart-box') };
    if (placement === 'overlay') {
      expect(scrubbing.box.height, 'chart-box is the same height watching and scrubbing').toBe(watching.box.height);
      expect(scrubbing.box).toEqual(watching.box);
      expect(scrubbing.box.height).toBeGreaterThanOrEqual(192);
      const bar = await settledBox(page, 'chart-bottom-overlay');
      expect(bar.y, 'the bar is inside the box').toBeGreaterThanOrEqual(scrubbing.box.y);
      expect(bar.x).toBeGreaterThanOrEqual(scrubbing.box.x - 0.5);
      expect(bar.x + bar.width).toBeLessThanOrEqual(scrubbing.box.x + scrubbing.box.width + 0.5);
      expect(Math.abs(bar.y + bar.height - (scrubbing.box.y + scrubbing.box.height)), 'the bar is on the bottom edge').toBeLessThanOrEqual(0.5);
      expect(bar.height, 'the bar covers at most half the box').toBeLessThanOrEqual(scrubbing.box.height / 2);
      await expect(page.getByTestId('chart-bottom-overlay').getByTestId('stripe-block')).toBeVisible();
      await expect(page.getByTestId('chart-stripe'), 'no row under the box').toHaveCount(0);
      // The overview stays in the rail, and `[ back to live ]` at its head (FR-WATCH-6).
      await expect(page.getByTestId('live-rail-foot').getByTestId('overview-row')).toBeVisible();
      await expect(page.getByTestId('live-rail-head').getByTestId('live-now')).toBeVisible();
    } else if (placement === 'rail') {
      expect(scrubbing.dome, 'the dome column is the same watching and scrubbing').toEqual(watching.dome);
      expect(scrubbing.box).toEqual(watching.box);
      for (const id of SCRUB_ROWS) await expect(page.getByTestId('live-side').getByTestId(id), `${id} is in the rail`).toBeVisible();
      await expect(page.getByTestId('live-rail-head').getByTestId('live-now')).toBeVisible();
    } else {
      expect(scrubbing.box.height, 'the box yields to the block under it on the tap').toBeLessThan(watching.box.height);
      expect(scrubbing.box.height).toBeGreaterThanOrEqual(192);
    }
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-scrub-placement', placement);

    const held = await shown(page);
    expect(held - T).toBeGreaterThanOrEqual(0);
    expect(held - T).toBeLessThan(10_000);
    await page.clock.runFor(600);
    await expect(page).toHaveURL(/#live\?lat=-38\.93&lon=-67\.99&alt=0&t=/);
    // Real time moves on under a held instant; the instant does not (FR-WATCH-1).
    await page.clock.runFor(3000);
    expect(await shown(page)).toBe(held);

    // `pass ▶|`: one tap to the next rise, and the headline says how far ahead of now it is (US-27 AC3).
    await page.getByRole('button', { name: 'Next pass' }).click();
    const rise = await shown(page);
    expect(rise).toBeGreaterThan(held);
    await expect(page.getByTestId('time-readout')).toHaveText(/ · \+(\d+ min|\d+ h \d\d min)$/);

    // 60×: one second of wall time is a minute of shown time, and it is still the held state.
    await speedButton(page, 60).click();
    await expect(speedButton(page, 60)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Play' }).click();
    await page.clock.runFor(1000);
    const played = await shown(page);
    expect(played - rise).toBeGreaterThan(50_000);
    expect(played - rise).toBeLessThan(70_000);
    await expect(indicator).toHaveAttribute('data-state', 'held');
    // FR-WATCH-7: a step onto a pass, a speed change and a minute of playback moved the box nowhere, at any shape.
    expect(await settledBox(page, 'chart-box'), 'nothing the sky does resizes the box').toEqual(scrubbing.box);
    await page.getByRole('button', { name: 'Pause' }).click();

    // `[ back to live ]` (US-27 AC2): the block goes, the instant is real time again and advances on the tick,
    // and the URL is the bare route.
    await backToLive(page);
    await expect(indicator).toContainText('live');
    for (const id of SCRUB_ROWS) await expect(page.getByTestId(id), `${id} is gone with the state`).toHaveCount(0);
    await expect(page.getByTestId('next-event')).toBeVisible();
    await page.clock.runFor(600);
    await expect(page).toHaveURL(/#live$/);
    // …and the watching box is the one the page opened with: the bar, the rail's rows or the block left no trace.
    await expect(page.getByTestId('chart-bottom-overlay')).toHaveCount(0);
    expect(await settledBox(page, 'chart-box')).toEqual(watching.box);
    expect(await settledBox(page, 'live-dome')).toEqual(watching.dome);
  });
}

/**
 * R85 (F-81, FR-CAP-5, D-549): at 1200 × 450 the watching inventory — the legend between the rail's head and
 * foot — ends on a whole row: the list's bottom edge is the bottom edge of the last entry it shows, and a
 * whole number of text rows from its top. The entries under it are counted in the `+n` line, and the header
 * row names the three times. Paris on R45's instant (`parisLive.ts`): four passes up and the Sun, more entries
 * than the rail has rows.
 */
test('the short wide inventory ends on a whole row with a +n line, and names its times (F-81, FR-CAP-5)', async ({ page }) => {
  await openParisLive(page, 'shortWide', 'dark');
  await expect(page.getByTestId('live-page')).toHaveAttribute('data-scrub-placement', 'overlay');
  await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
  const list = page.getByTestId('chart-legend');
  await expect(list).toHaveAttribute('data-clip-rows', /^\d+$/);
  const more = page.getByTestId('legend-more');
  await expect(more).toBeVisible();
  await expect(page.getByTestId('legend-times-header')).toHaveText(/^rise\s*peak\s*end$/);
  const geometry = await list.evaluate((ol) => {
    const box = ol.getBoundingClientRect();
    const items = Array.from(ol.children, (li) => li.getBoundingClientRect());
    const shown = items.filter((item) => item.top < box.bottom - 0.5);
    return {
      top: box.top,
      bottom: box.bottom,
      rowPx: parseFloat(getComputedStyle(ol).lineHeight),
      entries: items.length,
      shown: shown.length,
      lastBottom: shown[shown.length - 1]?.bottom ?? box.top,
    };
  });
  expect(geometry.shown, 'the list shows at least one entry').toBeGreaterThan(0);
  expect(geometry.shown, 'and not all of them').toBeLessThan(geometry.entries);
  expect(Math.abs(geometry.lastBottom - geometry.bottom), 'the last entry shown ends on the list’s bottom edge').toBeLessThanOrEqual(0.5);
  const rows = (geometry.bottom - geometry.top) / geometry.rowPx;
  expect(Math.abs(rows - Math.round(rows)), 'the list is a whole number of rows').toBeLessThanOrEqual(0.02);
  await expect(more).toHaveText(`+${String(geometry.entries - geometry.shown)} more`);
  // The line stays inside the box the rail gives the list: the inventory is what the rail leaves, not more.
  const moreBox = await more.boundingBox();
  const scrollBox = await page.getByTestId('chart-legend-scroll').boundingBox();
  if (!moreBox || !scrollBox) throw new Error('the inventory is not laid out');
  expect(moreBox.y + moreBox.height).toBeLessThanOrEqual(scrollBox.y + scrollBox.height + 0.5);
  // Each row's times are named for a screen reader: rise, peak, end.
  await expect(list.getByRole('button').first()).toHaveAccessibleName(/rise \d\d:\d\d:\d\d \S+ peak \d\d:\d\d:\d\d \S+ end \d\d:\d\d:\d\d/);
});

/**
 * R85 (FR-COMP-7, F-82): at 360 × 640 in Spanish the top row is `[ ← ]`, the indicator and the place, and the
 * place — Neuquén's coordinates, the label the home page gives a typed pair — is drawn whole, not ellipsised.
 */
test('at 360 px in Spanish the compact top row shows a whole coordinate pair (FR-COMP-7, F-82)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await homeAt(page, T, 'es');
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  const back = page.getByTestId('live-top-row').getByRole('button', { name: 'Volver', exact: true });
  await expect(back).toHaveText('←');
  const tap = await back.boundingBox();
  expect(tap?.height, 'the 48 px hit box is unchanged').toBeGreaterThanOrEqual(48);
  const place = page.getByTestId('live-place');
  await expect(place).toHaveText(/^−?\d+\.\d\d, −?\d+\.\d\d$/);
  const fit = await place.evaluate((span) => ({ scroll: span.scrollWidth, client: span.clientWidth }));
  expect(fit.scroll, `the place is drawn whole (${String(fit.scroll)} of ${String(fit.client)} px)`).toBeLessThanOrEqual(fit.client);
  const row = await page.getByTestId('live-top-row').boundingBox();
  expect(row?.height, 'one text row').toBeLessThanOrEqual(24.5);
});

// R78 (FR-WATCH-9 f): the captures of both states at the two short shapes are `r78-captures.spec.ts`, run with CAPTURES=1.

/** FR-WATCH-1 c (D-446): the URL is the state — a link with `t` opens scrubbing, a bare one watching, and a reload keeps it. */
test('a #live link with an instant opens scrubbing, and a reload after back to live opens watching (FR-WATCH-1, FR-LIVE-9)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await homeAt(page, T);
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await enterScrubbing(page);
  await page.getByRole('button', { name: 'Next pass' }).click();
  await page.clock.runFor(600);
  const url = page.url();
  expect(url).toMatch(/#live\?lat=.*&t=/);
  await page.reload();
  await domeDrawn(page);
  await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'held');
  await expect(page.getByTestId('time-stripe')).toBeVisible();
  await backToLive(page);
  await page.clock.runFor(600);
  await expect(page).toHaveURL(/#live$/);
  await page.reload();
  await domeDrawn(page);
  await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
  await expect(page.getByTestId('time-stripe')).toHaveCount(0);
});
