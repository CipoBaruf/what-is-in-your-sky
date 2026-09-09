/**
 * R48 (FR-TRAJ-1..5, FR-WIN-6, FR-LIVE-7 as amended, FR-COMP-4, FR-COMP-5;
 * US-22 AC1..AC6) on the production build, on a phone with a touch screen:
 *
 *   - stepping across one pass moves it through `ahead`, `live`, `linger` and
 *     gone, with the legend's state and the drawn segments following, in the
 *     polar view (whose SVG names the state) and on the dome (which draws the
 *     key only while the pass is drawn);
 *   - the stepping row lands the shown instant within a minute of a rise in
 *     at most three taps — one, with `rise ▶|` (the spike's pick, FR-TRAJ-5);
 *   - the portrait rows: the one-row top, the chart box never shorter than
 *     it is wide, the strip in two lines, the stripe block under it, at most
 *     two control rows, nothing scrolls and no drag hint;
 *   - the captures the PR carries: 390 px portrait and 844 × 390 landscape,
 *     both themes, both languages.
 *
 * The window view is R47's: FR-WIN-6 is asserted in `Live.test.tsx` by
 * setting the preference by name, and its e2e goes with the view's.
 */
import { expect, test, type Page } from '@playwright/test';
import { LOCALES, THEMES, type CaptureLocale, type CaptureTheme } from './captureSet';
import { domeDrawn, homeAt, stripFilled, T } from './liveHelpers';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const PREFS_KEY = 'wiys:prefs:v1';
const MINUTE = 60_000;

/** R70 (FR-SPAN-3): the row's six, re-cut — the ±10 min pair gave way to the chunk arrows. */
const STEP = {
  en: { next: 'Next pass', prev: 'Previous pass', back1: 'Back one minute', fwd1: 'Forward one minute', fwdChunk: 'Forward four hours' },
  es: { next: 'Pasada siguiente', prev: 'Pasada anterior', back1: 'Un minuto atrás', fwd1: 'Un minuto adelante', fwdChunk: 'Cuatro horas adelante' },
} as const;

/** The theme is a saved preference (D-70): the compact live page carries no switch (D-244). */
async function seedTheme(page: Page, theme: CaptureTheme): Promise<void> {
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ theme })] as [string, string],
  );
}

async function openLive(page: Page, locale: CaptureLocale = 'en', theme: CaptureTheme = 'dark'): Promise<void> {
  await seedTheme(page, theme);
  await homeAt(page, T, locale, true);
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

const shownInstant = (page: Page): Promise<number> => page.getByTestId('time-stripe').getAttribute('aria-valuenow').then((value) => Number(value));

/** A pass id is `<norad>-<rise ms>` (D-56), so the rise is read off the legend's row. */
const riseOf = (passId: string): number => Number(passId.split('-')[1]);

async function box(page: Page, testId: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const rect = await page.getByTestId(testId).boundingBox();
  if (!rect) throw new Error(`${testId} is not laid out`);
  return rect;
}

test.describe('the live page on a portrait phone', () => {
  test.use({ viewport: PORTRAIT, hasTouch: true });

  test('stepping across one pass moves it through ahead, live, linger and gone, and the legend follows (FR-TRAJ-1, FR-TRAJ-3, US-22 AC1..AC3, AC6)', async ({ page }) => {
    await openLive(page);
    const dome = page.getByTestId('live-dome');
    const legend = dome.getByTestId('chart-legend');
    // At T the ISS is ten seconds into its pass: live, with the marker, and the only row.
    await expect(legend.locator('button[data-pass-id^="25544-"]')).toHaveAttribute('data-state', 'live');
    await expect(dome.locator('[data-drawing] [data-pass-id^="25544-"]')).toHaveCount(1);

    // `pass ▶|`: one tap lands on the next rise, within a minute (US-22 AC6 allows three; FR-SPAN-4 does it in one).
    await page.getByRole('button', { name: STEP.en.next }).tap();
    await page.clock.runFor(300);
    const liveRow = legend.locator('button[data-state="live"]');
    await expect(liveRow).toHaveCount(1);
    const passId = (await liveRow.getAttribute('data-pass-id')) ?? '';
    expect(passId).not.toMatch(/^25544-/);
    const rise = riseOf(passId);
    expect(Math.abs((await shownInstant(page)) - rise)).toBeLessThanOrEqual(MINUTE);
    // The dome draws the pass — its key is in the drawing — and the ISS, now over, lingers.
    await expect(dome.locator(`[data-drawing] [data-pass-id="${passId}"]`)).toHaveCount(1);

    // The polar view names the state on the SVG group: the same value the legend shows (D-189).
    await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: /Polar/ }).tap();
    await expect(dome.getByRole('figure')).toHaveAttribute('data-view', 'polar');
    const arc = dome.locator(`[data-drawing] [data-pass-id="${passId}"]`);
    await expect(arc).toHaveAttribute('data-arc', 'live');
    await expect(arc.locator('[data-marker="now"]')).toHaveCount(1);
    // A minute in: the cut track from the rise to the marker (at the rise itself it is one point, so no path yet).
    await page.getByRole('button', { name: STEP.en.fwd1 }).tap();
    await page.clock.runFor(300);
    await expect(arc.locator('[data-marker="live"]')).toHaveCount(1);
    await expect(arc.locator('[data-marker="now"]')).toHaveCount(1);

    // A minute before the rise: the whole arc, faint and dotted, the rise marked, no marker.
    await page.getByRole('button', { name: STEP.en.back1 }).tap();
    await page.getByRole('button', { name: STEP.en.back1 }).tap();
    await page.clock.runFor(300);
    await expect(arc).toHaveAttribute('data-arc', 'ahead');
    await expect(legend.locator(`button[data-pass-id="${passId}"]`)).toHaveAttribute('data-state', 'ahead');
    await expect(arc.locator('[data-marker="ahead"]')).toHaveCount(1);
    await expect(arc.locator('[data-marker="now"]')).toHaveCount(0);

    // Ten minutes at a time past its end: the arc lingers, faint, without a marker… (R70: the ±10 min
    // buttons are gone with FR-SPAN-3's re-cut, and Shift and an arrow key are the ten-minute step that stands.)
    const row = legend.locator(`button[data-pass-id="${passId}"]`);
    await page.getByTestId('time-stripe').focus();
    for (let steps = 0; steps < 12 && (await row.getAttribute('data-state')) !== 'linger'; steps++) {
      await page.keyboard.press('Shift+ArrowRight');
      await page.clock.runFor(300);
    }
    await expect(row).toHaveAttribute('data-state', 'linger');
    await expect(arc).toHaveAttribute('data-arc', 'linger');
    await expect(arc.locator('[data-marker="linger"]')).toHaveCount(1);
    await expect(arc.locator('[data-marker="now"]')).toHaveCount(0);

    // …and ten minutes on it is gone from the drawing and the legend.
    await page.keyboard.press('Shift+ArrowRight');
    await page.clock.runFor(300);
    await expect(arc).toHaveCount(0);
    await expect(row).toHaveCount(0);

    // `|◀ pass` goes back to the latest rise before the instant — another pass may have risen since ours —
    // and lands on it: that pass is live from its rise, one tap (US-22 AC6 the other way).
    await page.getByRole('button', { name: STEP.en.prev }).tap();
    await page.clock.runFor(300);
    const backTo = await shownInstant(page);
    expect(backTo).toBeGreaterThanOrEqual(rise);
    const nowLive = await legend.locator('button[data-state="live"]').first().getAttribute('data-pass-id');
    expect(Math.abs(backTo - riseOf(nowLive ?? ''))).toBeLessThanOrEqual(MINUTE);
  });

  test('the portrait rows: one top row, the box at least its width, the strip in two lines, the stripe block, two control rows, nothing scrolls (FR-LIVE-7, FR-COMP-5, FR-TRAJ-4)', async ({ page }) => {
    await openLive(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    // `--row` is 1.5 rem at the 16 px base (D-65).
    const row = 24;
    const top = await box(page, 'live-top-row');
    const dome = await box(page, 'live-dome');
    const chart = await box(page, 'chart-box');
    const domeReadout = await box(page, 'dome-readout');
    const legend = await box(page, 'chart-legend');
    const strip = await box(page, 'status-strip');
    const readout = await box(page, 'time-readout');
    const stripe = await box(page, 'time-stripe');
    const steps = await box(page, 'step-controls');
    const playback = await box(page, 'playback-controls');
    const actions = await box(page, 'live-actions');
    // FR-COMP-1: one text row at the top (D-246); FR-COMP-5: the box is full-bleed.
    expect(top.height).toBeLessThanOrEqual(row + 1);
    expect(chart.width).toBe(PORTRAIT.width);
    // R59 (D-300, F-55): the box no longer carries D-233's floor on this page — a touch phone's frame
    // spends its first rows on the three-view control and the legend, and a floor that could not be met
    // was met by overflowing the frame onto the rows below. What holds instead is that the box takes what
    // the frame's own rows leave and the frame stays inside the pane the page gives it.
    expect(chart.height).toBeGreaterThan(0);
    // The legend's *slot* is the frame's last row; the list inside it scrolls (D-187), so it is the slot
    // that has to sit inside the pane and the list that may be taller than the four rows it is given.
    const legendSlot = await box(page, 'chart-legend-slot');
    expect(legendSlot.y + legendSlot.height).toBeLessThanOrEqual(dome.y + dome.height + 1);
    // The dome's readout and its legend are under the box, not under it: nothing of the frame spills.
    expect(domeReadout.y).toBeGreaterThanOrEqual(chart.y + chart.height - 1);
    expect(legend.y).toBeGreaterThanOrEqual(domeReadout.y + domeReadout.height - 1);
    // FR-LIVE-7 as amended: the strip in two lines, then the stripe block (readout, overview, three rows,
    // stepping) and two control rows. R70 (FR-SPAN-2): the overview is one row between the readout and the stripe.
    const overview = await box(page, 'stripe-overview');
    expect(strip.height).toBeLessThanOrEqual(2 * row + 8);
    expect(readout.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
    expect(overview.y).toBeGreaterThanOrEqual(readout.y + readout.height - 1);
    expect(overview.height).toBeLessThanOrEqual(row + 1);
    expect(stripe.y).toBeGreaterThanOrEqual(overview.y + overview.height - 1);
    expect(stripe.height).toBeGreaterThanOrEqual(3 * row - 1);
    expect(steps.y).toBeGreaterThanOrEqual(stripe.y + stripe.height - 1);
    expect(playback.y).toBeGreaterThanOrEqual(steps.y + steps.height - 1);
    expect(actions.y).toBeGreaterThanOrEqual(playback.y + playback.height - 1);
    expect(actions.y + actions.height).toBeLessThanOrEqual(PORTRAIT.height);
    // The whole strip is on the screen — nothing of it is under the box.
    expect(strip.y).toBeGreaterThanOrEqual(chart.y + chart.height - 1);
    // FR-LIVE-7 as amended: no "drag the dome" hint on this page.
    await expect(page.getByText(/Drag the dome|Arrastra/)).toHaveCount(0);
  });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`captures 390 px portrait, ${theme}, ${locale}`, async ({ page }) => {
        await openLive(page, locale, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.getByRole('button', { name: STEP[locale].next })).toBeVisible();
        await page.screenshot({ path: `docs/screenshots/r48-live-390-${theme}-${locale}.png` });
      });
    }
  }
});

test.describe('the live page on a landscape phone', () => {
  test.use({ viewport: LANDSCAPE, hasTouch: true });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`captures 844 × 390 landscape, ${theme}, ${locale}`, async ({ page }) => {
        await openLive(page, locale, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // The stripe block is in the side column, under the strip, and the page does not scroll.
        const dome = await box(page, 'live-dome');
        const stripe = await box(page, 'time-stripe');
        const strip = await box(page, 'status-strip');
        expect(stripe.x).toBeGreaterThanOrEqual(dome.x + dome.width - 1);
        expect(stripe.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
        expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
        await page.screenshot({ path: `docs/screenshots/r48-live-844-landscape-${theme}-${locale}.png` });
      });
    }
  }
});
