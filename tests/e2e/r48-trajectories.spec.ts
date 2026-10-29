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
import { domeDrawn, enterScrubbing, homeAt, openLegend, stripFilled, T } from './liveHelpers';

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

/**
 * R144 (FR-TONIGHT-6, FR-WATCH-1 as amended v2.7): the stepping row and the stripe are the wide page's now, so the
 * arcs' states are stepped through on a desk with a touch screen (`.tap()` needs one); the phone's own timeline is
 * the track (`live-tonight.spec.ts`), and the portrait rows and the captures below keep the phone.
 */
test.describe('the live page on a desk with a touch screen', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test('stepping across one pass moves it through ahead, live, linger and gone, and the legend follows (FR-TRAJ-1, FR-TRAJ-3, US-22 AC1..AC3, AC6)', async ({ page }) => {
    await openLive(page);
    // R71 (FR-LEG-7): on wide the legend stands in the rail (a no-op), and this test is about what it says.
    await openLegend(page);
    // R77 (FR-WATCH-9 e): the step row is the scrubbing state's.
    await enterScrubbing(page);
    const dome = page.getByTestId('live-dome');
    const legend = page.getByTestId('chart-legend');
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
});

test.describe('the live page on a portrait phone', () => {
  test.use({ viewport: PORTRAIT, hasTouch: true });

  test('the portrait rows: one top row, the headline, the full-bleed box with the readout in its corner, the track, the taps, the actions, the list, nothing scrolls (FR-LIVE-7, FR-COMP-5, FR-TONIGHT-6)', async ({ page }) => {
    await openLive(page);
    /*
     * R71 (FR-LEG-7): the legend is a row of this page only while `[ list (n) ]` holds it open, so the rows
     * below are measured with it open — the state that has one of everything. Closed, the box has the panel's
     * height instead, which is `live-compact.spec.ts`'s measurement (FR-LEG-8).
     *
     * R144 (FR-TONIGHT-6): the rows are the same held or not; the instant is held on the track all the same.
     */
    await openLegend(page);
    await enterScrubbing(page);
    // `--row` is 1.5 rem at the 16 px base (D-65).
    const row = 24;
    const top = await box(page, 'live-top-row');
    const headline = await box(page, 'live-headline');
    const context = await box(page, 'live-context');
    const chart = await box(page, 'chart-box');
    const readout = await box(page, 'sky-readout-toggle');
    // The list's panel, two tap rows that scroll inside themselves (`live-compact.spec.ts`), not the rows it holds.
    const legend = await box(page, 'chart-legend-slot');
    const head = await box(page, 'live-list-head');
    const track = await box(page, 'live-track');
    const taps = await box(page, 'live-taps');
    const actions = await box(page, 'live-actions');
    // FR-COMP-1: one text row at the top (D-246); FR-COMP-5: the box is full-bleed.
    expect(top.height).toBeLessThanOrEqual(row + 1);
    expect(chart.width).toBe(PORTRAIT.width);
    expect(chart.height).toBeGreaterThan(0);
    // FR-TONIGHT-6: the headline and its context line between the top row and the box; the readout inside the box's corner.
    expect(headline.y).toBeGreaterThanOrEqual(top.y + top.height - 1);
    expect(context.y).toBeGreaterThanOrEqual(headline.y + headline.height - 1);
    expect(chart.y).toBeGreaterThanOrEqual(context.y + context.height - 1);
    expect(readout.y).toBeGreaterThanOrEqual(chart.y - 1);
    expect(readout.y + readout.height).toBeLessThanOrEqual(chart.y + chart.height / 2);
    // Under the box: the track (two tap rows with its label row), the taps, the actions, then the list's head and the list.
    expect(track.y).toBeGreaterThanOrEqual(chart.y + chart.height - 1);
    expect(track.height).toBeGreaterThanOrEqual(2 * row - 1);
    expect(taps.y).toBeGreaterThanOrEqual(track.y + track.height - 1);
    expect(actions.y).toBeGreaterThanOrEqual(taps.y + taps.height - 1);
    expect(head.y).toBeGreaterThanOrEqual(actions.y + actions.height - 1);
    expect(legend.y).toBeGreaterThanOrEqual(head.y + head.height - 1);
    // FR-TONIGHT-9: everything inside the viewport, and the page does not scroll.
    expect(legend.y + legend.height).toBeLessThanOrEqual(PORTRAIT.height + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(PORTRAIT.height + 1);
    // FR-LIVE-7 as amended: no "drag the dome" hint on this page.
    await expect(page.getByText(/Drag the dome|Arrastra el domo/)).toHaveCount(0);
  });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`captures 390 px portrait, ${theme}, ${locale}`, async ({ page }) => {
        await openLive(page, locale, theme);
        await enterScrubbing(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.getByTestId('live-tap-next')).toBeVisible();
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
        await enterScrubbing(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // R144 (FR-TONIGHT-6, FR-FLOW-15): the track is in the rail, under the headline, and the page does not scroll.
        const dome = await box(page, 'live-dome');
        const track = await box(page, 'live-track');
        const headline = await box(page, 'live-headline');
        expect(track.x).toBeGreaterThanOrEqual(dome.x + dome.width - 1);
        expect(track.y).toBeGreaterThanOrEqual(headline.y + headline.height - 1);
        await page.screenshot({ path: `docs/screenshots/r48-live-844-landscape-${theme}-${locale}.png` });
      });
    }
  }
});
