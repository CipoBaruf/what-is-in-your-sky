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
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, golden, ha, heading, hhmmss, homeAt, LABEL, realTimeField, reenterLiveWithTheme, stripFilled, stubCompass, stubNetwork, T } from './liveHelpers';

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
    // R34 (FR-LIVE-8, D-175): no touch screen in this profile, so no phone to follow and no control.
    await expect(page.getByTestId('follow-phone')).toHaveCount(0);

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
 * FR-LIVE-8 as amended v1.2, D-276): the follow case, on the phone viewport
 * with a touch screen — the one profile the control is rendered in (D-175).
 *
 * The control opens the sky window over the view that is showing rather than
 * turning the dome, so what this asserts is the switch: the press asks and
 * arms, the first reading with a north in it makes the window the view, the
 * shown instant goes back to real time with the stripe block and the playback
 * row gone (FR-WIN-6), and the second press gives the dome back. The strip's
 * true-north line goes with the window, in whole words rather than leaving the
 * viewer to wonder why the picture sits a degree off the compass they are
 * holding: +1.12° at Neuquén on the fixtures' date. Both languages, because
 * the field is text on the page and FR-I18N-2 admits no English on the
 * Spanish one.
 */
test.describe('the live page following a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const [locale, line] of [
    ['en', 'Heading true north, declination +1.1°'],
    ['es', 'Rumbo norte verdadero, declinación +1,1°'],
  ] as const) {
    test(`opens the sky window, at real time, and names the declination on the strip (${locale})`, async ({ page }) => {
      await stubCompass(page);
      await homeAt(page, T, locale);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);

      // Not following: the dome is the view, with the stripe block and the playback row under it,
      // and no heading is being corrected, so the strip has its five fields and no sixth.
      const chart = page.getByTestId('sky-chart');
      const field = page.getByTestId('live-heading');
      await expect(chart).toHaveAttribute('data-view', 'dome');
      await expect(field).toHaveCount(0);
      await expect(page.getByTestId('stripe-block')).toBeVisible();

      // Following: the press arms the sensor and the first reading with a north in it opens the window.
      expect(await page.evaluate(() => screen.orientation.angle)).toBe(0);
      const toggle = page.getByRole('button', { name: locale === 'en' ? 'Follow phone' : 'Seguir al teléfono' });
      await toggle.click();
      await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
      await heading(page, 270);
      await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
      await expect(chart).toHaveAttribute('data-view', 'window');
      // FR-FOL-3 / FR-WIN-6: a "now" mode — the stripe block and the playback row are not on the page.
      await expect(page.getByTestId('stripe-block')).toHaveCount(0);
      await expect(page.getByTestId('playback-row')).toHaveCount(0);
      await expect(field).toHaveText(line);
      // The tenth of a degree the line prints is the value itself, not a coincidence of the wording.
      await expect(field.locator('[data-declination]')).toHaveAttribute('data-declination', '1.1');
      // The capture the PR carries: the strip with its heading field, at the phone width, in each language.
      await page.screenshot({ path: `docs/screenshots/r44-live-390-following-dark-${locale}.png` });

      // FR-FOL-1: the second press gives back the view it came from, and what is saved is still that view.
      await toggle.click();
      await expect(chart).toHaveAttribute('data-view', 'dome');
      await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
      await expect(field).toHaveCount(0);
      await expect(page.getByTestId('stripe-block')).toBeVisible();
      // FR-WIN-5 as amended: nothing was saved on the way through — the reader picked no view, so the
      // device still carries none, and what following opened was never written over the one they have.
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
     * R34 (FR-LIVE-7, FR-LIVE-8): a desktop gets no follow control. R61 (D-312): and the side column is under
     * the box on the phone, beside it on wide — where "beside" is measured against the *box*, since the rail
     * lives inside the chart the `live-dome` wrapper holds.
     */
    const box = await page.getByTestId('chart-box').boundingBox();
    const side = await page.getByTestId('live-side').boundingBox();
    if (width === 390) expect(side?.y).toBeGreaterThanOrEqual((box?.y ?? 0) + (box?.height ?? 0) - 1);
    else expect(side?.x).toBeGreaterThanOrEqual((box?.x ?? 0) + (box?.width ?? 0) - 1);
    await expect(page.getByTestId('follow-phone')).toHaveCount(0);
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

  /** The rail's rows, top to bottom, and every one of them beside the box rather than under it. */
  const expectTheRail = async (page: Page, box: { x: number; y: number; width: number; height: number } | null): Promise<void> => {
    const strip = await page.getByTestId('status-strip').boundingBox();
    const block = await page.getByTestId('stripe-block').boundingBox();
    const playback = await page.getByTestId('playback-row').boundingBox();
    const actions = await page.getByTestId('live-actions').boundingBox();
    for (const row of [strip, block, playback, actions]) rightOf(row, box);
    below(block, strip);
    below(playback, block);
    below(actions, playback);
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

  test('at 1920 × 1080: one row above the box, the rest in the rail beside it, the box the height of the page, nothing scrolls, no stepping row', async ({ page }) => {
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
    await expectTheRail(page, box);
    await expectLabelsClear(page);
    // The hidden-objects toggle is on the playback row, and there is no stepping row without touch.
    await expect(page.getByTestId('playback-row').getByTestId('live-hidden-toggle')).toBeVisible();
    await expect(page.getByTestId('step-controls')).toHaveCount(0);
    // Nothing is under the box but the page's own padding, and the page does not scroll.
    expect(1080 - ((box?.y ?? 0) + (box?.height ?? 0))).toBeLessThanOrEqual(32);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(0.85 * 1080);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1080);
  });

  test('at 1280 × 800: the same rail, with the clock readout above the stripe and no label over another', async ({ page }) => {
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
    await expectTheRail(page, box);
    // In a 44-cell rail the block stacks: the clock readout over the stripe, which takes the column's width.
    below(stripe, clock);
    await expectLabelsClear(page);
    expect(800 - ((box?.y ?? 0) + (box?.height ?? 0))).toBeLessThanOrEqual(32);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
  });
});
