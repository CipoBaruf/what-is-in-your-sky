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
import { formatClockDuration } from '../../src/lib/format';
import { domeDrawn, enterScrubbing, golden, ha, heading, hhmmss, homeAt, LABEL, openLegend, openSkyScreen, realTimeField, reenterLiveWithTheme, stripFilled, stubCompass, stubNetwork, T, VIEW_GROUP, VIEW_OPTION } from './liveHelpers';

test.describe('the live page', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('fills the viewport with the dome, shows the five fields, and counts what the Up now row counts', async ({ page }) => {
    const panelCount = await homeAt(page, T);
    expect(panelCount).toBe(1);

    await page.getByTestId('live-link').click();
    await expect(page).toHaveURL(/#live$/);
    await domeDrawn(page);

    // FR-LIVE-1 → R132 (FR-FLOW-4, D-864): the compact page is a column at least the viewport tall that scrolls past its box.
    const box = await page.getByTestId('live-page').boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(844);
    await expect(page.getByTestId('live-layout')).toHaveAttribute('data-shape', 'column');
    // R92 (FR-A11Y-1): the banner is the page's own top row. R129 (D-845): the row is the one header, told its page.
    await expect(page.getByTestId('header')).toHaveAttribute('data-page', 'live');
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('banner').getByTestId('live-top-row')).toBeVisible();
    // The dome is the whole width inside the two cells of side padding, and most of the height.
    const dome = await page.getByTestId('live-dome').boundingBox();
    expect(dome?.width).toBeGreaterThan(390 - 4 * 9.6 - 1);
    // R33 (D-172): the stripe and the playback row took their share; 300 px is what the portrait dome keeps, and R34's landscape is the phone's real answer.
    expect(dome?.height).toBeGreaterThan(300);
    // R34 (FR-LIVE-7): portrait still stacks — the list (the conditions, the overview) is under the dome, not beside it (`live-landscape.spec.ts` is the other case).
    const side = await page.getByTestId('live-layout').locator('[data-slot="list"]').boundingBox();
    expect(side?.y).toBeGreaterThanOrEqual((dome?.y ?? 0) + (dome?.height ?? 0) - 1);
    expect(side?.x).toBeLessThan((dome?.x ?? 0) + 1);
    // R121 (FR-WIN-4 as amended v2.5): no touch screen in this profile, and the control offers all three views all the same.
    await expect(page.getByRole('group', { name: 'Chart view' }).getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);

    // FR-LIVE-3: the five fields.
    await stripFilled(page);
    await expect(page.getByTestId('live-time')).toHaveText(realTimeField(T));
    // R77 (FR-WATCH-3): the compact conditions line — the clock, one word each for the sky and the clouds
    // (`unknown` without a forecast), the count — with the labels spoken.
    await expect(page.getByTestId('live-sky')).toHaveText(/Sky (dark|twilight|day)/);
    await expect(page.getByTestId('live-cloud')).toHaveText('Clouds unknown');
    await expect(page.getByTestId('live-count').locator('[data-count]')).toHaveAttribute('data-count', String(panelCount));
    // FR-MOON-3 as amended: the Moon's phase and illumination are the list panel's Moon line, one tap away.
    await expect(page.getByTestId('live-moon')).toHaveCount(0);
    // FR-LIVE-2 / FR-LIVE-10: the ISS is drawn on the chart, by the chart, named at its rise. (The search
    // window starts at now, so the pass under way is listed from this instant and its id is not the golden one.)
    // R45: the legend's rows carry the pass id too, so the drawing's are read inside the drawing.
    await expect(page.getByTestId('live-dome').locator('[data-drawing] [data-pass-id]').first()).toBeAttached();
    await expect(page.getByTestId('live-dome').locator('[data-drawing] [data-pass-id^="25544-"]')).toHaveCount(1);
    // R71 (FR-LEG-7): on a phone the list is one tap away.
    await openLegend(page);
    await expect(page.getByTestId('chart-legend').locator('button[data-pass-id^="25544-"]')).toContainText('ISS (Zarya)');
    const moonLine = page.getByTestId('chart-legend').locator('[data-body="moon"]');
    if ((await moonLine.count()) > 0) await expect(moonLine).toHaveText(/Moon .+, \d+ % · az /);
    // FR-SHARE-1's live form.
    await expect(page.getByRole('button', { name: 'Share this sky' })).toBeVisible();

    // Esc returns to the home page, with the same observer and no hash.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('live-page')).toHaveCount(0);

    // …and the Both door (R130, FR-FLOW-1; the next-event block's `[ Open the live sky ]` before it) opens it again; the return control closes it.
    await page.getByTestId('door-both').click();
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live');
    await page.getByRole('button', { name: LABEL.en.backCompact, exact: true }).click();
    await expect(page.getByTestId('conditions')).toBeVisible();
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
    // R81: the Now panel's `as of` is gone with it; the Satellites door (R130) counts from real time, ten seconds into the pass.
    await expect(page.getByTestId('door-satellites-line').first()).toHaveText(`Up now · peaks in ${formatClockDuration((golden().peak - T) / 1000)}`, { timeout: 60_000 });
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

  // R89 (FR-LIVE-1 as amended v2.1): the states are told apart — `live-failures.spec.ts` follows each one's control.
  test('is inert with its state and the return control without an observer, and without elements (FR-LIVE-1)', async ({ page }) => {
    await page.clock.setFixedTime(T);
    await stubNetwork(page, 'down');
    await page.goto('/#live');
    const inert = page.getByTestId('live-inert');
    await expect(inert).toHaveText('The live sky needs a place.set a place');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'inert');
    await expect(page.getByTestId('sky-chart')).toHaveCount(0);
    await expect(page.getByTestId('status-strip')).toHaveCount(0);
    await page.getByRole('button', { name: LABEL.en.backCompact, exact: true }).click();
    await expect(page.getByRole('banner')).toBeVisible();

    // An observer from a link, and CelesTrak down with nothing cached: no elements, so nothing to draw.
    // A hash-only navigation stays in the document, so the page is reloaded for `startApp` to read the link.
    await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}`);
    await page.reload();
    await expect(page.getByTestId('live-place')).toHaveText('−38.93, −67.99');
    await expect(inert).toHaveAttribute('data-inert', 'failed', { timeout: 30_000 });
    await expect(page.getByTestId('failure-sentence')).toContainText('Could not load the orbital elements');
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
 * the picture in the portrait box with FR-FSC-11's line of advice over it, in
 * their own language, and the `×` (R73: it was FR-FSC-4's note and nothing
 * else until v1.4.1). The screen drawn sideways is `sky-screen.spec.ts`; what
 * this holds is that the layer covers the page in portrait too, that the
 * advice is translated (FR-I18N-2 admits no English on the Spanish page), and
 * that the `×` gives the page back with nothing saved on the way through. The
 * strip's true-north line is gone with the window's being a view of this page:
 * the declination is the screen's readout line now (FR-FSC-4).
 */
test.describe('the live page with the sky screen open upright', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const [locale, note] of [
    ['en', 'Turn the phone sideways to see more sky.'],
    ['es', 'Gira el teléfono de lado para ver más cielo.'],
  ] as const) {
    test(`[ hold up to the sky ] opens the sky screen, which draws upright with the advice over it (${locale})`, async ({ page }) => {
      await stubCompass(page);
      await homeAt(page, T, locale);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);

      // Not following: the dome is the view, with the rows of the watching state under it (R77: the overview,
      // and no stripe block), and no layer over any of it. The line has no heading field.
      const chart = page.getByTestId('sky-chart');
      await expect(chart).toHaveAttribute('data-view', 'dome');
      await expect(page.getByTestId('live-heading')).toHaveCount(0);
      await expect(page.getByTestId('overview-row')).toBeVisible();
      await expect(page.getByTestId('sky-screen')).toHaveCount(0);

      // R136 (FR-FLOW-15): the window option is a view in the box and opens nothing; its `[ hold up to the sky ]`
      // arms the sensor, and the first reading with a north in it opens the screen (D-350).
      expect(await page.evaluate(() => screen.orientation.angle)).toBe(0);
      await page.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: VIEW_OPTION[locale].window }).click();
      await expect(chart).toHaveAttribute('data-view', 'window');
      await heading(page, 270);
      await expect(page.getByTestId('sky-screen')).toHaveCount(0);
      const layer = await openSkyScreen(page, locale);
      await expect(layer).toHaveCount(1);
      // FR-FSC-1: nothing of the page is on the layer, and the page's own chart never became the window.
      await expect(page.getByTestId('stripe-block')).toHaveCount(0);
      await expect(page.getByTestId('playback-row')).toHaveCount(0);
      await expect(page.getByTestId('live-side')).toHaveCount(0);
      // FR-FSC-4 as rewritten / FR-GUT-7 / US-21 AC12 as amended v2.0: upright, the picture is drawn in the band
      // with the advice as a line under the countdown, in this page's language.
      await expect(page.locator('[data-drawing="window"] [data-horizon]')).toHaveCount(1);
      await expect(page.getByTestId('window-turn-advice')).toHaveText(note);
      await expect(page.getByRole('button', { name: locale === 'en' ? 'Close' : 'Cerrar' })).toBeVisible();
      // The capture the PR carries: the screen as an upright phone gets it, in each language. R73 renamed it
      // off `r66-…`, whose two files are the evidence for the state this replaces and stay as they were.
      await page.screenshot({ path: `docs/screenshots/r73-live-390-screen-portrait-dark-${locale}.png` });

      // FR-FSC-2: the `×` is the way out, back to the window in the box the reader picked.
      await page.getByTestId('sky-screen-close').click();
      await expect(layer).toHaveCount(0);
      await expect(chart).toHaveAttribute('data-view', 'window');
      await expect(page.getByTestId('overview-row')).toBeVisible();
      // FR-FLOW-14 (D-876): the window the reader chose is saved on compact as on wide; the screen saved nothing of its own.
      const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('wiys:prefs:v1') ?? '{}') as { chartView?: string });
      expect(prefs.chartView).toBe('window');
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
     * R34 (FR-LIVE-7), R66 (FR-WIN-4): a desktop is offered no window. R61 (D-312), R71 (D-386): the side column
     * is under the box on the phone and beside it at every wide width, which `live-rail.spec.ts` measures.
     */
    const box = await page.getByTestId('chart-box').boundingBox();
    // R132 (FR-FLOW-4): on the phone the list is under the box; on wide the rail's head stands beside it.
    const side = await (width === 390 ? page.getByTestId('live-layout').locator('[data-slot="list"]') : page.getByTestId('live-rail-head')).boundingBox();
    if (width === 390) expect(side?.y).toBeGreaterThanOrEqual((box?.y ?? 0) + (box?.height ?? 0) - 1);
    else expect(side?.x).toBeGreaterThanOrEqual((box?.x ?? 0) + (box?.width ?? 0) - 1);
    await expect(page.getByRole('group', { name: 'Chart view' }).getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
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
  await expect(page.getByRole('button', { name: LABEL.es.backCompact, exact: true })).toBeVisible();
  await expect(page.getByTestId('status-strip')).toHaveAttribute('aria-label', 'Condiciones del cielo');
  await expect(page.getByTestId('live-sky')).toHaveText(/Cielo (oscuro|crepúsculo|día)/);
  // R85 (FR-COMP-7): `s/d` is drawn and "sin datos" is what is said.
  await expect(page.getByTestId('live-cloud')).toHaveText(/^Nubes s\/d\s*sin datos$/);
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
  // R121 (FR-SKY-2 as amended v2.5, V25-17, D-834): the readout stands in the box's top-left corner, over the
  // drawing, inside the layout's `readout` slot (R132, D-864; the slot pads a cell at each side).
  const inCorner = async (page: Page, box: { x: number; y: number; width: number; height: number } | null): Promise<void> => {
    const slot = await page.getByTestId('live-layout').locator('[data-slot="readout"]').boundingBox();
    const readout = await page.getByTestId('dome-readout').boundingBox();
    if (!slot || !readout || !box) throw new Error('a row is missing');
    expect(Math.abs(slot.x - box.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(slot.y - box.y)).toBeLessThanOrEqual(1);
    expect(slot.x + slot.width).toBeLessThanOrEqual(box.x + box.width + 1);
    expect(slot.y + slot.height).toBeLessThanOrEqual(box.y + box.height + 1);
    band(readout, slot);
  };

  /**
   * The rail's rows, top to bottom, and every one of them beside the box rather than under it. R132 (FR-FLOW-4
   * wide, D-864): the stripe block is the rail's foot, under the conditions and above the actions, with the
   * playback row on its clock row (V12-13) and the stripe under that; R61's row under the box (D-315) is gone.
   */
  const expectTheRail = async (page: Page, box: { x: number; y: number; width: number; height: number } | null): Promise<void> => {
    const strip = await page.getByTestId('status-strip').boundingBox();
    const block = await page.getByTestId('stripe-block').boundingBox();
    const playback = await page.getByTestId('playback-row').boundingBox();
    const actions = await page.getByTestId('live-actions').boundingBox();
    for (const row of [strip, block, playback, actions]) rightOf(row, box);
    below(block, strip);
    band(playback, block);
    const stripeRows = await page.getByTestId('time-stripe').boundingBox();
    below(stripeRows, playback);
    below(actions, block);
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

  test('at 1920 × 1080: the view row in the rail beside the box, the strip and the actions with it, the stripe at the rail’s foot with the playback on its clock row, nothing scrolls, no stepping row', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    // R77 (FR-WATCH-4): the stripe block is the scrubbing state's.
    await enterScrubbing(page);
    const toggle = await page.getByRole('group', { name: 'Chart view' }).boundingBox();
    const box = await page.getByTestId('chart-box').boundingBox();
    // R132 (FR-FLOW-4 wide): the view control is the rail's `View` row, beside the box; the readout in the box's corner (D-834).
    rightOf(toggle, box);
    await inCorner(page, box);
    await expectTheRail(page, box);
    await expectLabelsClear(page);
    // The hidden-objects toggle is with the actions in the rail (V12-13). R70 (FR-TRAJ-5 as amended v1.4,
    // V14-6): the stepping row is under the stripe on a pointer too — `pass ▶|` is a control a mouse has no
    // equivalent of — and the overview row is above it, in the block.
    await expect(page.getByTestId('live-actions').getByTestId('live-hidden-toggle')).toBeVisible();
    await expect(page.getByTestId('step-controls')).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Night overview' })).toBeVisible();
    // The box is the dome's shape (D-314); the rail's foot reaches the page's bottom, and the page does not scroll.
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(DOME_BOX_ASPECT, 2);
    // The hint's row under the box is the layout's last, so the foot ends a hint's row above the page's padding.
    const foot = await page.getByTestId('live-rail-foot').boundingBox();
    expect(1080 - ((foot?.y ?? 0) + (foot?.height ?? 0))).toBeLessThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1080);
  });

  /*
   * R71 (FR-LEG-6, V14-4, D-386): 1280 px was the one-column page — the box centred, the stripe and the legend
   * the page's whole width, the strip and the actions on a line under the frame. There is one wide layout now,
   * so this width gets the same rail as 1920 does, and this test fails on the old rule: it asserted
   * `data-columns='one'` and no `chart-aside`, and both are gone.
   */
  test('at 1280 × 800: the rail beside the box, the stripe at its foot with the playback on its clock row, and no label over another', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await homeAt(page, T, 'en', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    await enterScrubbing(page);
    const toggle = await page.getByRole('group', { name: 'Chart view' }).boundingBox();
    const box = await page.getByTestId('chart-box').boundingBox();
    const stripe = await page.getByTestId('time-stripe').boundingBox();
    const clock = await page.getByTestId('time-readout').boundingBox();
    rightOf(toggle, box);
    await inCorner(page, box);
    await expectTheRail(page, box);
    // The legend is in that column too, over the rail's foot (FR-LEG-2 as amended v1.4; R132: in the `list` slot, above the conditions).
    const rail = await page.getByTestId('live-rail-foot').boundingBox();
    const legend = await page.getByTestId('chart-legend-slot').boundingBox();
    rightOf(legend, box);
    below(rail, legend);
    // The block stacks: the clock readout over the stripe.
    below(stripe, clock);
    await expectLabelsClear(page);
    // The box is the dome's shape (D-314); the rail's foot reaches the page's bottom. The page does not scroll.
    expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(DOME_BOX_ASPECT, 2);
    const foot = await page.getByTestId('live-rail-foot').boundingBox();
    expect(800 - ((foot?.y ?? 0) + (foot?.height ?? 0))).toBeLessThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
  });
});
