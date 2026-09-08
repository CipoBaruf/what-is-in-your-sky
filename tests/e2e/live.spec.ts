/**
 * R32 (FR-LIVE-1, FR-LIVE-2, FR-LIVE-3, FR-LIVE-9, FR-LIVE-10; US-15 AC1, AC2,
 * AC9) on the production build, with the R1 fixtures at Neuquén and the clock
 * installed ten seconds into the golden ISS pass — the instant `now-panel.spec`
 * pins the Now panel at, so the two counts can be held to each other.
 *
 *   - `#live` fills the viewport with the dome and nothing scrolls; the strip
 *     shows its five fields; the count is the Now panel's; Esc, the return
 *     control, the header and the Now panel each go one way or the other;
 *   - a `#live?…` URL in a fresh context sets the observer (rounded label,
 *     source coords) and the shown instant; a `t` that cannot be read falls
 *     back to real time;
 *   - both inert states are one line and the return control;
 *   - the captures the PR carries, at both widths, in both themes, and in
 *     Spanish at the phone width.
 */
import { DOME_BOX_ASPECT } from '../../src/ui/components/guide/skychart/dome/camera';
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, golden, ha, heading, hhmmss, homeAt, LABEL, realTimeField, reenterLiveWithTheme, stripFilled, stubCompass, stubNetwork, T, VIEW_GROUP, VIEW_OPTION } from './liveHelpers';

test.describe('the live page', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fills the viewport with the dome, shows the five fields, and counts what the Now panel counts', async ({ page }) => {
    const panelCount = await homeAt(page, T);
    expect(panelCount).toBe(1);

    await page.getByTestId('live-link').click();
    await expect(page).toHaveURL(/#live$/);
    await domeDrawn(page);

    // FR-LIVE-1: the page is the viewport — as tall as it, and nothing to scroll.
    const box = await page.getByTestId('live-page').boundingBox();
    expect(box?.height).toBe(844);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await expect(page.getByRole('banner')).toHaveCount(0);
    // The dome is the whole width inside the two cells of side padding, and most of the height.
    const dome = await page.getByTestId('live-dome').boundingBox();
    expect(dome?.width).toBeGreaterThan(390 - 4 * 9.6 - 1);
    // R33 (D-172): the stripe and the playback row took their share; 300 px is what the portrait dome keeps, and R34's landscape is the phone's real answer.
    expect(dome?.height).toBeGreaterThan(300);
    // R34 (FR-LIVE-7): portrait still stacks — the side column is under the dome, not beside it (`live-landscape.spec.ts` is the other case).
    const side = await page.getByTestId('live-side').boundingBox();
    expect(side?.y).toBeGreaterThanOrEqual((dome?.y ?? 0) + (dome?.height ?? 0) - 1);
    expect(side?.x).toBeLessThan((dome?.x ?? 0) + 1);
    // R66 (FR-WIN-4, V13-6): no touch screen in this profile, so no window to point and the control offers two views.
    await expect(page.getByRole('group', { name: 'Chart view' }).getByRole('button')).toHaveText(['Polar', 'Dome']);

    // FR-LIVE-3: the five fields.
    await stripFilled(page);
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
    await expect(page.getByTestId('live-sky')).toHaveText(/Sky (dark|bright twilight|day)/);
    // R48 (D-246): the compact strip is two lines — the numbers, `n/a` for the clouds without a forecast.
    await expect(page.getByTestId('live-cloud')).toHaveText('Clouds n/a');
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', String(panelCount));
    await expect(page.getByTestId('live-moon')).toHaveText(/^Moon \d+ %$/);
    // FR-LIVE-2 / FR-LIVE-10: the ISS is drawn on the chart, by the chart, named at its rise. (The search
    // window starts at now, so the pass under way is listed from this instant and its id is not the golden one.)
    // R45: the legend's rows carry the pass id too, so the drawing's are read inside the drawing.
    await expect(page.getByTestId('live-dome').locator('[data-drawing] [data-pass-id]').first()).toBeAttached();
    await expect(page.getByTestId('live-dome').locator('[data-drawing] [data-pass-id^="25544-"]')).toHaveCount(1);
    await expect(page.getByTestId('live-dome').getByTestId('chart-legend').locator('button[data-pass-id^="25544-"]')).toContainText('ISS (Zarya)');
    // FR-SHARE-1's live form.
    await expect(page.getByRole('button', { name: 'Share this sky' })).toBeVisible();

    // Esc returns to the home page, with the same observer and no hash.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('live-page')).toHaveCount(0);

    // …and the Now panel's link opens it again; the return control closes it.
    await page.getByTestId('now-live-link').click();
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
    await page.getByRole('button', { name: LABEL.en.back }).click();
    await expect(page.getByRole('region', { name: LABEL.en.now })).toBeVisible();
  });

  test('a #live?… URL sets the observer and the shown instant, and a bad t falls back to real time (FR-LIVE-9)', async ({ page }) => {
    const { peak } = golden();
    await page.clock.install({ time: T });
    await page.clock.pauseAt(T);
    await stubNetwork(page);
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=${new Date(peak).toISOString().replace('.000Z', 'Z')}`);

    // The observer came out of the link: rounded label, no saved location involved (a fresh context has none).
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    await domeDrawn(page);
    // The shown instant is the link's, not the clock's.
    await expect(page.getByTestId('live-time')).toHaveText(`Time ${hhmmss(peak)} UTC`);
    // At the peak the ISS is up: one marker, once the passes are in.
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', '1', { timeout: 60_000 });
    await stripFilled(page);
    // Real time was not touched by the link.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: LABEL.en.now })).toContainText(`as of ${hhmmss(T)} UTC`, { timeout: 60_000 });
    // R52 (FR-COMP-3): the home screen names the observer in its summary line; the form that holds it is on `#settings`.
    await expect(page.getByTestId('location-summary')).toContainText('−38.93, −67.99');

    // A t that names no instant: the place is kept and the instant is real time. (A hash-only
    // navigation stays in the document; the reload is what makes it a fresh arrival on the link.)
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=soon`);
    await page.reload();
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    // Real time: the installed clock, not the link.
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
  });

  test('is inert with one line and the return control without an observer, and without elements (FR-LIVE-1)', async ({ page }) => {
    await page.clock.setFixedTime(T);
    await stubNetwork(page, 'down');
    await page.goto('/#live');
    const inert = page.getByTestId('live-inert');
    await expect(inert).toHaveText('The live sky needs somewhere to look from: a place name or coordinates on the home page.');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'inert');
    await expect(page.getByTestId('sky-chart')).toHaveCount(0);
    await expect(page.getByTestId('status-strip')).toHaveCount(0);
    await page.getByRole('button', { name: LABEL.en.back }).click();
    await expect(page.getByRole('banner')).toBeVisible();

    // An observer from a link, and CelesTrak down with nothing cached: no elements, so nothing to draw.
    // A hash-only navigation stays in the document, so the page is reloaded for `startApp` to read the link.
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}`);
    await page.reload();
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    await expect(inert).toHaveText('No orbital elements yet, so there is nothing to draw.', { timeout: 30_000 });
    await expect(page.getByTestId('sky-chart')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
  });
});

/**
 * R44 (FR-WIN-3, US-21 AC6; F-41, D-185), rewritten by R59 (FR-FOL-1..3,
 * FR-LIVE-8 as amended v1.2, D-276) and again by R64 (FR-FSC-1, FR-FSC-2,
 * FR-FSC-4, FR-WIN-6 as amended v1.3; D-321): the follow case, on the phone
 * viewport with a touch screen — the one profile the control is rendered in
 * (D-175).
 *
 * What the option opens is the sky screen, a layer over the whole viewport,
 * and this viewport is a phone held *upright*: so what a reader gets here is
 * FR-FSC-4's note asking them to turn it, in their own language, with the `×`
 * beside it and nothing else. The screen drawn sideways is
 * `sky-screen.spec.ts`; what this holds is that the layer covers the page in
 * portrait too, that the note is translated (FR-I18N-2 admits no English on the
 * Spanish page), and that the `×` gives the page back with nothing saved on the
 * way through. The strip's true-north line is gone with the window's being a
 * view of this page: the declination is the screen's readout line now
 * (FR-FSC-4).
 */
test.describe('the live page with the sky screen open upright', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const [locale, note] of [
    ['en', 'Turn the phone sideways to follow the sky.'],
    ['es', 'Gira el teléfono de lado para seguir el cielo.'],
  ] as const) {
    test(`the window option opens the sky screen, which is the note and the × while the phone is upright (${locale})`, async ({ page }) => {
      await stubCompass(page);
      await homeAt(page, T, locale);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);

      // Not following: the dome is the view, with the stripe block and the playback row under it,
      // and no layer over any of it. The strip has its five fields and no sixth.
      const chart = page.getByTestId('sky-chart');
      await expect(chart).toHaveAttribute('data-view', 'dome');
      await expect(page.getByTestId('live-heading')).toHaveCount(0);
      await expect(page.getByTestId('stripe-block')).toBeVisible();
      await expect(page.getByTestId('sky-screen')).toHaveCount(0);

      // The tap arms the sensor and the first reading with a north in it opens the screen (D-350).
      expect(await page.evaluate(() => screen.orientation.angle)).toBe(0);
      await page.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: VIEW_OPTION[locale].window }).click();
      await expect(page.getByTestId('sky-screen')).toHaveCount(0);
      await heading(page, 270);
      const layer = page.getByTestId('sky-screen');
      await expect(layer).toHaveCount(1);
      // The paused clock holds the lazy chunk's Suspense reveal (R32).
      await page.clock.runFor(1000);
      // FR-FSC-1: nothing of the page is on the layer, and the page's own chart never became the window.
      await expect(page.getByTestId('stripe-block')).toHaveCount(0);
      await expect(page.getByTestId('playback-row')).toHaveCount(0);
      await expect(page.getByTestId('live-side')).toHaveCount(0);
      // FR-FSC-4 / US-21 AC12: upright, the note is the whole box, in this page's language.
      await expect(page.getByTestId('window-portrait-note')).toHaveText(note);
      await expect(page.getByRole('button', { name: locale === 'en' ? 'Close' : 'Cerrar' })).toBeVisible();
      // The capture the PR carries: the screen as an upright phone gets it, in each language.
      await page.screenshot({ path: `docs/screenshots/r66-live-390-screen-portrait-dark-${locale}.png` });

      // FR-FSC-2: the `×` is the way out, and what is saved is still the view the page had.
      await page.getByTestId('sky-screen-close').click();
      await expect(layer).toHaveCount(0);
      await expect(chart).toHaveAttribute('data-view', 'dome');
      await expect(page.getByTestId('stripe-block')).toBeVisible();
      // FR-WIN-5 as amended v1.3.1: nothing was saved on the way through — the window is a mode, and the
      // reader picked no view, so the device still carries none.
      const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { chartView?: string });
      expect(prefs.chartView ?? 'dome').toBe('dome');
    });
  }
});

/**
 * The captures for the PR: the live page at both widths, in both themes, in
 * English, and in Spanish at the phone width — the ISS up and marked, the
 * coming night's arcs in their series colours, the strip under the dome.
 */
for (const width of [390, 1280] as const) {
  test(`captures at ${String(width)} px, in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    /*
     * R34 (FR-LIVE-7), R66 (FR-WIN-4): a desktop is offered no window. R61 (D-312, D-319): the side column is under
     * the box on the phone and on the one-column wide page (1280 px is under `LIVE_TWO_COLUMN_MIN_PX`); it is
     * the rail beside the box only from 1660 px, which `live-rail.spec.ts` measures.
     */
    const box = await page.getByTestId('chart-box').boundingBox();
    const side = await page.getByTestId('live-side').boundingBox();
    expect(side?.y).toBeGreaterThanOrEqual((box?.y ?? 0) + (box?.height ?? 0) - 1);
    await expect(page.getByRole('group', { name: 'Chart view' }).getByRole('button')).toHaveText(['Polar', 'Dome']);
    await page.screenshot({ path: `docs/screenshots/r32-live-${String(width)}-dark-en.png` });
    // R48 (D-244): the compact live page carries no theme switch, so the theme is set on the home page.
    await reenterLiveWithTheme(page, 'en', 'night');
    await page.clock.runFor(500);
    await page.screenshot({ path: `docs/screenshots/r32-live-${String(width)}-night-en.png` });
  });
}

test('captures in Spanish at 390 px: no English on the page (FR-I18N-2)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await homeAt(page, T, 'es', true);
  await page.getByTestId('live-link').click();
  await expect(page.getByTestId('live-link')).toHaveCount(0);
  await domeDrawn(page);
  await stripFilled(page);
  await expect(page.getByRole('button', { name: LABEL.es.back })).toBeVisible();
  await expect(page.getByTestId('status-strip')).toHaveAttribute('aria-label', 'Estado del cielo');
  await expect(page.getByTestId('live-sky')).toHaveText(/Cielo (oscuro|crepúsculo claro|de día)/);
  await expect(page.getByTestId('live-cloud')).toHaveText('Nubes s/d');
  await expect(page.getByRole('button', { name: 'Compartir este cielo' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/r32-live-390-dark-es.png' });
});

/**
 * R61 (FR-LIVE-7 as amended v1.2, FR-TRAJ-4 as amended, FR-LEG-2 as amended, D-312; F-59): the wide live page.
 * R54 (D-268) folded the rows under the box from five to two; the box was still the page's whole width, which
 * the drawing cannot fill — it is about 1.41 : 1 at the default tilt — so a third of it stayed blank at every
 * desktop size. The rows are a rail beside the box now, in the order the requirement lists them (the strip, the
 * stripe block, the playback row, the actions), under the legend and inside the chart's own side column, and the
 * box takes every row of the page's height. `live-rail.spec.ts` measures what the drawing then covers; this file
 * keeps the page's rows in their places. (F-53's legend reach needs an instant with several passes:
 * `r61-captures.spec.ts`.)
 */
test.describe('the wide live page (R61)', () => {
  const band = (inner: { y: number; height: number } | null, outer: { y: number; height: number } | null): void => {
    if (!inner || !outer) throw new Error('a row is missing');
    expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1);
    expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
  };
  const below = (lower: { y: number } | null, upper: { y: number; height: number } | null): void => {
    if (!lower || !upper) throw new Error('a row is missing');
    expect(lower.y).toBeGreaterThanOrEqual(upper.y + upper.height - 1);
  };
  const rightOf = (row: { x: number } | null, box: { x: number; width: number } | null): void => {
    if (!row || !box) throw new Error('a row is missing');
    expect(row.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
  };

  /**
   * The rail's rows, top to bottom, and every one of them beside the box rather than under it. The stripe
   * block is a row under the box on every wide page (D-315, V12-12); `'in the rail'` is kept for the record.
   */
  const expectTheRail = async (page: Page, box: { x: number; y: number; width: number; height: number } | null, stripe: 'in the rail' | 'under the box'): Promise<void> => {
    const strip = await page.getByTestId('status-strip').boundingBox();
    const block = await page.getByTestId('stripe-block').boundingBox();
    const playback = await page.getByTestId('playback-row').boundingBox();
    const actions = await page.getByTestId('live-actions').boundingBox();
    for (const row of [strip, actions]) rightOf(row, box);
    below(actions, strip);
    if (stripe === 'in the rail') {
      rightOf(block, box);
      rightOf(playback, box);
      below(block, strip);
      below(playback, block);
      below(actions, playback);
    } else {
      // V12-13: the playback row is the stripe block's, on the clock's row above the stripe, under the box.
      below(block, box);
      expect(block?.x ?? 0).toBeCloseTo(box?.x ?? -1, 0);
      expect(block?.width ?? 0).toBeCloseTo(box?.width ?? -1, 0);
      band(playback, block);
      const stripeRows = await page.getByTestId('time-stripe').boundingBox();
      below(stripeRows, playback);
    }
  };

  /** FR-TRAJ-4: whatever cadence the stripe's width buys, no label is drawn over the one beside it. */
  const expectLabelsClear = async (page: Page): Promise<void> => {
    const labels = await page.locator('[data-row="labels"] text').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map(({ left, width }) => ({ left, right: left + width })));
    expect(labels.length).toBeGreaterThan(3);
    for (const [i, label] of labels.entries()) {
      const previous = labels[i - 1];
      if (previous) expect(label.left, `label ${String(i)} clears the one before it`).toBeGreaterThanOrEqual(previous.right);
    }
  };

  test('at 1920 × 1080: one row above the box, the strip and the actions in the rail beside it, the stripe under the box with the playback on its clock row, nothing scrolls, no stepping row', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    const toggle = await page.getByRole('group', { name: 'Chart view' }).boundingBox();
    const readout = await page.getByTestId('dome-readout').boundingBox();
    const box = await page.getByTestId('chart-box').boundingBox();
    // One row above: the readout shares the toggle's row, and the box starts right under it.
    band(readout, toggle);
    below(box, toggle);
    await expectTheRail(page, box, 'under the box');
    await expectLabelsClear(page);
    // The hidden-objects toggle is with the actions in the rail (V12-13), and there is no stepping row without touch.
    await expect(page.getByTestId('live-actions').getByTestId('live-hidden-toggle')).toBeVisible();
    await expect(page.getByTestId('step-controls')).toHaveCount(0);
    // The box is the dome's shape and reaches the page's bottom through the stripe (D-314), and the page does not scroll.
    await expect(page.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'true');
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(DOME_BOX_ASPECT, 2);
    const stripeBlock = await page.getByTestId('stripe-block').boundingBox();
    expect(1080 - ((stripeBlock?.y ?? 0) + (stripeBlock?.height ?? 0))).toBeLessThanOrEqual(24);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1080);
  });

  test('at 1280 × 800: one column — the box centred, the stripe and the legend full width, the strip and the actions under them at the left — and no label over another', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    const toggle = await page.getByRole('group', { name: 'Chart view' }).boundingBox();
    const readout = await page.getByTestId('dome-readout').boundingBox();
    const box = await page.getByTestId('chart-box').boundingBox();
    const stripe = await page.getByTestId('time-stripe').boundingBox();
    const clock = await page.getByTestId('time-readout').boundingBox();
    band(readout, toggle);
    below(box, toggle);
    // D-319 (V12-14): under 1660 px there is no rail. The stripe block is under the box, the legend under that,
    // and the page's own row — the strip and the actions on one line — under the frame. The box is centred; the
    // stripe and the legend take the page's whole width and every row under them reads from that left edge (D-320, V12-15).
    await expect(page.getByTestId('live-dome')).toHaveAttribute('data-columns', 'one');
    await expect(page.getByTestId('chart-aside')).toHaveCount(0);
    const block = await page.getByTestId('stripe-block').boundingBox();
    const legend = await page.getByTestId('chart-legend-slot').boundingBox();
    const strip = await page.getByTestId('status-strip').boundingBox();
    const actions = await page.getByTestId('live-actions').boundingBox();
    below(block, box);
    below(legend, block);
    below(strip, legend);
    // The strip and the actions are one row that wraps: the actions on the strip's line where the width allows it, under it where not — never above.
    expect(actions?.y ?? 0).toBeGreaterThanOrEqual((strip?.y ?? 0) - 1);
    const sideRow = await page.getByTestId('live-side').boundingBox();
    expect(Math.abs((sideRow?.x ?? 0) + (sideRow?.width ?? 0) / 2 - 640)).toBeLessThanOrEqual(2);
    expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - 640)).toBeLessThanOrEqual(2);
    // D-320 (V12-15): the stripe and the legend are the page's whole width — wider than the box the height cut here — and the strip starts at that edge.
    expect((block?.width ?? 0)).toBeGreaterThan((box?.width ?? 0));
    expect(Math.abs((legend?.x ?? 0) - (block?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((strip?.x ?? 0) - (block?.x ?? 0))).toBeLessThanOrEqual(1);
    // The block stacks: the clock readout over the stripe.
    below(stripe, clock);
    await expectLabelsClear(page);
    // The box is the dome's shape (D-314) and height-bound: the last row reaches the page's bottom. The page does not scroll.
    await expect(page.getByTestId('live-dome')).toHaveAttribute('data-stripe-under', 'true');
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(DOME_BOX_ASPECT, 2);
    expect(800 - ((actions?.y ?? 0) + (actions?.height ?? 0))).toBeLessThanOrEqual(24);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
  });
});
