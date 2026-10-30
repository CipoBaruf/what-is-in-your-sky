/**
 * R47 (FR-WIN-1..5, FR-GUIDE-2b as amended, US-21 AC1..AC4, AC7): the sky
 * window on the production build.
 *
 * R121 (FR-SKY-2, FR-SKY-7, FR-WIN-4, FR-WIN-5 as amended v2.5; D-789, D-790):
 * the option is on every device. On a desk it is a view laid out in the box
 * under the hand camera — saved on wide, cut to the browser window's shape,
 * the picker in the rail or the controls row — and the pass detail's window
 * opens facing the pass's peak; on a compact page it is the same view in the
 * square box. R152 (FR-GYRO-6, D-945): the phone's cases — the sky screen the
 * pass detail opened, its refusal and its compass-less phone — went with the
 * screen; the phone's window following the phone is `follow.spec.ts`.
 *
 * The place, the pass and the instant are `r45-captures.spec.ts`'s: Paris on
 * 2026-09-02, three minutes into the glare pass, with the Moon up and the Sun
 * in the twilight band, so the drawing has its bodies and the legend its lines.
 *
 *   npx playwright test sky-window --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR, LOCALES, THEMES, type CaptureLocale, type CaptureTheme } from './captureSet';
import { bandUnderBox, openSheet, SPACE_3_PX } from './liveHelpers';
import { BARILOCHE, FIXTURE_DATE, PARIS } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;
const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;
const FRAME_MS = 16;

const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

async function open(page: Page, viewport: { width: number; height: number }, prefs: { locale: CaptureLocale; theme: CaptureTheme; observer: Observer; chartView: 'dome' | 'polar' | 'window' }): Promise<void> {
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      // Only when nothing is saved yet (R136): the window is saved on compact now, and a reload must read it back.
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(CLOCK);
}

/** The glare pass's guide, open, at the shown instant. */
async function openDetail(page: Page, locale: CaptureLocale): Promise<Locator> {
  await page.goto('/');
  const card = page.locator(`article[data-pass-id="${GLARE_PASS}"]`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await card.getByRole('button', { name: OPEN_GUIDE[locale] }).click();
  const figure = guide(page).getByRole('figure');
  await expect(figure).toBeVisible();
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);
  return figure;
}

const look = async (window: Locator): Promise<{ az: number; alt: number }> => ({
  az: Number(await window.getAttribute('data-look-az')),
  alt: Number(await window.getAttribute('data-look-alt')),
});

/** The box a locator is laid out in. */
const rectOf = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

/** The live page from the home page the fixtures filled, on whatever view is saved. */
async function openLive(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator(`article[data-pass-id="${GLARE_PASS}"]`)).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await page.getByTestId('live-link').click();
  // The paused clock holds React's lazy reveal (R32): the live chunk lands only as the clock runs.
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return page.getByTestId('sky-chart').count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
  await page.clock.runFor(1000);
}

/** The box has stopped moving: two identical reads a frame apart (the frame cuts it on a `ResizeObserver`). */
async function boxSettled(page: Page, box: Locator): Promise<{ width: number; height: number }> {
  let last = '';
  await expect
    .poll(async () => {
      const rect = await rectOf(box);
      const now = `${String(Math.round(rect.width))}x${String(Math.round(rect.height))}`;
      const same = now === last && rect.width > 100;
      last = now;
      await page.clock.runFor(FRAME_MS);
      return same;
    })
    .toBe(true);
  const rect = await rectOf(box);
  return { width: Math.round(rect.width), height: Math.round(rect.height) };
}

/**
 * R121 (FR-SKY-2, FR-SKY-7, FR-WIN-4, FR-WIN-5, FR-FSC-6 as amended v2.5; US-41
 * AC1, AC2; D-789, D-790): the window on a desk. R47's "not offered without a
 * touch screen, and a saved window is the dome" is the opposite now: the option
 * is on every device, on wide it is a saved view laid out in the box under the
 * hand camera, and the pass detail's opens looking at the pass.
 */
test.describe('the sky window on a desk (wide, no sensor)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test('is offered on the pass detail, saved as the view, laid out in the window-shaped box facing the peak, and turned by hand', async ({ page }) => {
    await open(page, { width: 1280, height: 800 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = guide(page).getByRole('group', { name: VIEW_GROUP.en });
    await expect(toggle.getByRole('button')).toHaveText(['Window', 'Polar', 'Dome']);
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    // A view like the other two: drawn here and saved (FR-WIN-5 as amended v2.5).
    await expect(figure).toHaveAttribute('data-view', 'window');
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'window' });
    const w = figure.locator('[data-look-az]');
    await expect(w).toHaveAttribute('data-state', 'hand');
    await expect(w).toHaveAttribute('data-in-box', 'true');
    // FR-SKY-7: facing the peak's azimuth at clamp(61 − 15, 20, 75) = 46°, the arc under it and its key in view.
    const opened = await look(w);
    expect(opened.alt).toBe(46);
    await expect(figure.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
    // R132 (FR-FLOW-7, D-849): on the panel the drawing is the layout's slot at the panel's full width and the height
    // the body leaves (D-789's window shape is the sky screen's); the readout stands in its corner.
    const frame = figure.getByTestId('chart-frame');
    await expect(frame).toHaveAttribute('data-hand-window', 'true');
    const box = await boxSettled(page, figure.getByTestId('chart-box'));
    const slot = await rectOf(page.getByTestId('pass-layout').locator('[data-slot="drawing"]'));
    expect(Math.abs(box.width - slot.width)).toBeLessThanOrEqual(1);
    expect(box.height).toBeGreaterThan(0);
    console.log(`R121 pass detail window box at 1280 × 800: ${String(box.width)} × ${String(box.height)} px`);
    const readout = await rectOf(guide(page).getByTestId('window-readout'));
    const boxRect = await rectOf(figure.getByTestId('chart-box'));
    expect(readout.x).toBeGreaterThanOrEqual(boxRect.x - 1);
    expect(readout.y).toBeGreaterThanOrEqual(boxRect.y - 1);
    expect(readout.y).toBeLessThan(boxRect.y + boxRect.height / 2);
    await expect(guide(page).getByTestId('sky-hint')).toHaveText('Drag or use the arrow keys · ctrl + wheel to zoom · click a star');
    // The picker: `peak` first and pressed, the eight points, `up`; no `[ follow the phone ]` without a sensor (FR-GYRO-1).
    const picker = guide(page).getByRole('group', { name: 'Facing' });
    await expect(picker.getByRole('button')).toHaveText(['peak', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up']);
    await expect(picker.locator('[data-option="peak"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(guide(page).getByTestId('follow-toggle')).toHaveCount(0);
    // The guide panel scrolls on its own, so the box stands below its fold at 800 px: bring its foot to the panel's edge first.
    await figure.getByTestId('chart-box').evaluate((el) => { el.scrollIntoView({ block: 'end' }); });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r121-detail-1280-window-dark-en.png` });
    // The hand (FR-STAR-4): a drag at 4 px per degree, the sky following the pointer; the keys while the box has focus.
    // The box stands below the fold at 800 px, and the mouse works in viewport coordinates: bring it up first.
    await figure.getByTestId('chart-box').scrollIntoViewIfNeeded();
    const dragRect = await rectOf(figure.getByTestId('chart-box'));
    await page.mouse.move(dragRect.x + dragRect.width / 2, dragRect.y + dragRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragRect.x + dragRect.width / 2 + 120, dragRect.y + dragRect.height / 2, { steps: 5 });
    await page.clock.runFor(FRAME_MS);
    await page.mouse.up();
    await page.clock.runFor(FRAME_MS);
    expect((await look(w)).az).toBe((opened.az - 30 + 360) % 360);
    await expect(picker.locator('[data-option="peak"]')).toHaveAttribute('aria-pressed', 'false');
    await figure.locator('[data-dragging]').focus();
    await page.keyboard.press('ArrowUp');
    expect((await look(w)).alt).toBe(51);
    await picker.locator('[data-option="up"]').click();
    expect((await look(w)).alt).toBe(90);
    await picker.locator('[data-option="peak"]').click();
    expect(await look(w)).toEqual(opened);
    // The dome and back keeps the facing (the chart's slot, D-789).
    await picker.locator('[data-option="W"]').click();
    await toggle.getByRole('button', { name: 'Dome' }).click();
    await expect(figure).toHaveAttribute('data-view', 'dome');
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    expect((await look(figure.locator('[data-look-az]'))).az).toBe(270);
  });

  test('opens on the saved window, in Spanish too', async ({ page }) => {
    await open(page, { width: 1280, height: 800 }, { locale: 'es', theme: 'dark', observer: PARIS, chartView: 'window' });
    const figure = await openDetail(page, 'es');
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(figure.locator('[data-look-az]')).toHaveAttribute('data-state', 'hand');
    await expect(guide(page).getByRole('group', { name: 'Mirando' }).getByRole('button')).toHaveText(['pico', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'arriba']);
    await expect(guide(page).getByTestId('window-readout')).toContainText('Hacia el');
    await boxSettled(page, figure.getByTestId('chart-box'));
    await figure.getByTestId('chart-box').evaluate((el) => { el.scrollIntoView({ block: 'end' }); });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r121-detail-1280-window-dark-es.png` });
  });

  for (const [width, height] of [
    [1280, 800],
    [1920, 1080],
  ] as const) {
    for (const theme of width === 1280 ? THEMES : (['dark'] as const)) {
      test(`the live page at ${String(width)} × ${String(height)}, ${theme}: the window in the box beside the rail, the picker in the rail`, async ({ page }) => {
        await open(page, { width, height }, { locale: 'en', theme, observer: PARIS, chartView: 'window' });
        await openLive(page);
        const chart = page.getByTestId('sky-chart');
        await expect(chart).toHaveAttribute('data-view', 'window');
        const w = chart.locator('[data-look-az]');
        await expect(w).toHaveAttribute('data-state', 'hand');
        // R136 (FR-FLOW-14, D-876: `openingFacing`): no pass is highlighted, so the window opens on the next pass's
        // rise point — Paris's next one rises at 352°, on the horizon — at `clamp(alt − 15°, 20°, 75°)` = 20°.
        expect(await look(w)).toEqual({ az: 352, alt: 20 });
        const box = await boxSettled(page, page.getByTestId('chart-box'));
        const [boxRect, rail] = await Promise.all([rectOf(page.getByTestId('chart-box')), rectOf(page.getByTestId('live-rail-head'))]);
        // R133 (FR-FLOW-9, D-850): the box is the room, down to the hint line (it was the browser window's shape, `windowBox`), and the rail stands beside it.
        expect(await bandUnderBox(page, boxRect)).toBeLessThanOrEqual(SPACE_3_PX);
        expect(rail.x).toBeGreaterThanOrEqual(boxRect.x + boxRect.width - 1);
        // The facing picker in the rail (FR-SKY-2), the readout in the box's corner.
        await expect(page.getByTestId('live-layout').locator('[data-slot="picker"]').getByTestId('window-facing')).toBeVisible();
        await expect(page.getByTestId('live-layout').locator('[data-slot="picker"]').getByRole('group', { name: 'Facing' }).getByRole('button')).toHaveText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up']);
        const readout = await rectOf(page.getByTestId('window-readout'));
        expect(readout.y).toBeLessThan(boxRect.y + boxRect.height / 2);
        expect(readout.x).toBeGreaterThanOrEqual(boxRect.x - 1);
        test.info().annotations.push({ type: 'box', description: `${String(width)} × ${String(height)}: the window's box is ${String(box.width)} × ${String(box.height)} px` });
        console.log(`R121 live window box at ${String(width)} × ${String(height)}: ${String(box.width)} × ${String(box.height)} px`);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r121-live-${String(width)}-window-${theme}-en.png` });
      });
    }
  }
});

/**
 * FR-SKY-2: a compact reader without a sensor — a phone-sized desk window, and
 * every headless capture at 390 px — gets the window laid out in the box under
 * the hand camera, since there is no screen to open and nothing to ask. R136
 * (FR-FLOW-14, D-876): the choice is saved on compact as on wide, so a reload
 * opens on the window.
 */
test.describe('the sky window on a compact page without a sensor', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: false });

  test('lays the window out in the box by hand on the pass detail, saves it, and a reload opens on it (FR-FLOW-14)', async ({ page }) => {
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = guide(page).getByRole('group', { name: VIEW_GROUP.en });
    await expect(toggle.getByRole('button')).toHaveText(['Window', 'Polar', 'Dome']);
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    await expect(figure).toHaveAttribute('data-view', 'window');
    const w = figure.locator('[data-look-az]');
    await expect(w).toHaveAttribute('data-state', 'hand');
    expect((await look(w)).alt).toBe(46);
    // Compact keeps the dome's box — square, full-bleed — and the readout in its row, not the corner: directly above
    // the drawing (R132, FR-FLOW-4), where the column puts the readout slot.
    const frame = figure.getByTestId('chart-frame');
    await expect(frame).toHaveAttribute('data-compact', 'true');
    const box = await rectOf(figure.getByTestId('chart-box'));
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    const readout = await rectOf(guide(page).getByTestId('window-readout'));
    expect(readout.y + readout.height).toBeLessThanOrEqual(box.y + 1);
    await expect(guide(page).getByRole('group', { name: 'Facing' }).locator('[data-option="peak"]')).toHaveAttribute('aria-pressed', 'true');
    // R136 (FR-FLOW-14, D-876): the window is saved on compact as on wide.
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'window' });
    await figure.getByTestId('chart-box').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r121-detail-390-window-dark-en.png` });
    // Saved: the reload opens on the window.
    await page.reload();
    const again = guide(page).getByRole('figure');
    await expect(again).toBeVisible({ timeout: 60_000 });
    await expect(again).toHaveAttribute('data-view', 'window');
  });

  test('lays the window out in the box by hand on the live page, the picker in the sheet’s facing row', async ({ page }) => {
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    await openLive(page);
    const chart = page.getByTestId('sky-chart');
    // R148 (FR-FULL-4): the view control is the sheet's; the card over the sky is answered first.
    const card = page.getByTestId('live-card');
    if ((await card.count()) > 0) await card.getByTestId('live-card-now').click();
    await openSheet(page);
    await page.getByTestId('live-layout').getByRole('group', { name: VIEW_GROUP.en }).getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    await expect(chart).toHaveAttribute('data-view', 'window');
    await expect(chart.locator('[data-look-az]')).toHaveAttribute('data-state', 'hand');
    // R148 (FR-FULL-4, D-923): the facing row opens from the readout in the sheet.
    await expect(page.getByTestId('live-facing-picker')).toHaveCount(0);
    await page.getByTestId('sky-readout-toggle').click();
    await expect(page.getByTestId('live-facing-picker').getByTestId('window-facing')).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r121-live-390-window-dark-en.png` });
  });
});

/**
 * R127 (FR-SKY-11, FR-SKY-12, FR-SKY-13, FR-DESK-4 as amended v2.5; US-40 AC6,
 * AC7, AC8; US-41 AC5; D-796, D-797, D-832): the landmark and the facing key,
 * on the showcase night over Bariloche, where Tiangong crosses Orion at 09:25
 * UTC on 2026-09-07 — "pasa 8° bajo Bellatrix, en Orión", the peak among
 * Orión in the table — so the Spanish captures show `Orión` on the line and in
 * `Entre`. The passes come from the fixtures' elements as every spec's do.
 */
/** Tiangong's catalogue number: the card's id carries its start to the millisecond, which the worker's run sets, so the id is read off the card. */
const ORION_NORAD = '48274';
const ORION_RISE = Date.parse('2026-09-07T09:24:57.000Z');
const ORION_PEAK = Date.parse('2026-09-07T09:25:40.089Z');
/** Five minutes before the rise: the headline counts down to Tiangong, the pass the landmark is of. */
const ORION_CLOCK = ORION_RISE - 5 * 60_000;

/** The showcase night's home page, the passes computed. */
async function openShowcase(page: Page, viewport: { width: number; height: number }, locale: CaptureLocale, chartView: 'dome' | 'window'): Promise<string> {
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, theme: 'dark', observer: BARILOCHE, chartView })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: ORION_CLOCK });
  await page.clock.pauseAt(ORION_CLOCK);
  await page.goto('/');
  const card = page.locator(`article[data-pass-id^="${ORION_NORAD}-"]`).first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  return (await card.getAttribute('data-pass-id')) ?? '';
}

test.describe('the landmark and the facing key (R127)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  for (const locale of LOCALES) {
    test(`the live page at 1280, ${locale}: the landmark line under the headline, the pass's key after up, the key and f follow the pass`, async ({ page }) => {
      const passId = await openShowcase(page, { width: 1280, height: 800 }, locale, 'window');
      await page.getByTestId('live-link').click();
      await expect
        .poll(async () => {
          await page.clock.runFor(200);
          return page.getByTestId('sky-chart').count();
        }, { timeout: 30_000 })
        .toBeGreaterThan(0);
      await page.clock.runFor(1000);
      const chart = page.getByTestId('sky-chart');
      await expect(chart).toHaveAttribute('data-view', 'window');
      const w = chart.locator('[data-look-az]');
      await expect(w).toHaveAttribute('data-state', 'hand');
      // Two minutes before the rise: inside FR-TRAJ-1's look-ahead, so the arc is drawn and the pass has its key (FR-LEG-1).
      await page.clock.setSystemTime(ORION_RISE - 2 * 60_000 - TICK_MS);
      await page.clock.runFor(TICK_MS);
      await page.clock.runFor(1000);
      // FR-SKY-11: the line under the headline's name line, in the reader's language (D-832).
      const line = page.getByTestId('next-event-landmark');
      // The star is whichever bright one the worker's peak is nearest (Aldebarán or Bellatrix, by a degree); the figure is Orion.
      const linePattern = locale === 'es' ? /^pasa \d+° (?:sobre|bajo|junto a) (.+), en Orión$/ : /^passes \d+° (?:above|below|beside) (.+), in Orion$/;
      await expect(line).toHaveText(linePattern, { timeout: 30_000 });
      const starName = linePattern.exec((await line.textContent()) ?? '')?.[1] ?? '';
      expect(starName).not.toBe('');
      // FR-SKY-13: the picker ends with the pass's key, after `up` — one capital, the legend's (the arc itself is not drawn yet five minutes out).
      const picker = page.getByTestId('live-layout').locator('[data-slot="picker"]').getByRole('group', { name: locale === 'es' ? 'Mirando' : 'Facing' });
      const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', locale === 'es' ? 'arriba' : 'up'];
      await expect(picker.getByRole('button')).toHaveText([...points, /^[A-Z]$/]);
      const key = (await picker.getByRole('button').last().textContent()) ?? '';
      const keyOption = picker.locator(`[data-option="pass:${passId}"]`);
      await expect(keyOption).toHaveAttribute('aria-pressed', 'false');
      // Choosing it: before the rise the camera turns to the rise point at FR-SKY-7's tilt, and the readout says so.
      await keyOption.click();
      await expect(keyOption).toHaveAttribute('aria-pressed', 'true');
      const readout = page.getByTestId('window-readout');
      await expect(readout).toHaveAttribute('data-following', passId);
      await expect(readout).toContainText(locale === 'es' ? `Siguiendo ${key}` : `Following ${key}`);
      const atRise = await look(w);
      expect(atRise.alt).toBe(20);
      // The pass under way: every tick re-aims, so the look moves with the satellite and the key stays pressed.
      await page.clock.setSystemTime(ORION_PEAK - TICK_MS);
      await page.clock.runFor(TICK_MS);
      await page.clock.runFor(1000);
      const atPeak = await look(w);
      expect(atPeak).not.toEqual(atRise);
      expect(Math.abs(atPeak.az - 24)).toBeLessThanOrEqual(3);
      await expect(keyOption).toHaveAttribute('aria-pressed', 'true');
      await expect(readout).toHaveAttribute('data-following', passId);
      // FR-SKY-11: the landmark ringed in the window, a few degrees from the peak, in the field now; named beside the ring
      // where the placement finds a free place (Bellatrix sits among Orion's lines, Aldebarán where the Hyades' lines
      // meet, so there the ring stands alone and the line names it, V24-23's rule).
      await expect(chart.locator('[data-landmark-ring]')).not.toHaveAttribute('visibility', 'hidden');
      const name = chart.locator('[data-landmark-name]');
      await expect(name).toHaveCount(1);
      if ((await name.getAttribute('visibility')) !== 'hidden') await expect(name).toHaveText(starName);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r127-live-1280-window-dark-${locale}.png` });
      // A drag ends it: the key is no longer pressed and the readout names the facing again.
      const box = (await chart.getByTestId('chart-box').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
      await page.clock.runFor(FRAME_MS);
      await page.mouse.up();
      await page.clock.runFor(FRAME_MS);
      await expect(keyOption).toHaveAttribute('aria-pressed', 'false');
      await expect(readout).not.toHaveAttribute('data-following', passId);
      await expect(readout).toContainText(locale === 'es' ? 'Hacia el' : 'Facing');
      expect((await look(w)).az).toBe((atPeak.az - 30 + 360) % 360);
      // FR-DESK-4 as amended v2.5: `f` does the same as the key, and an arrow key ends it.
      await page.keyboard.press('f');
      await page.clock.runFor(FRAME_MS);
      await expect(keyOption).toHaveAttribute('aria-pressed', 'true');
      await expect(readout).toHaveAttribute('data-following', passId);
      await chart.locator('div[data-dragging]').focus();
      await page.keyboard.press('ArrowLeft');
      await expect(keyOption).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('f');
      await page.clock.runFor(FRAME_MS);
      await expect(keyOption).toHaveAttribute('aria-pressed', 'true');
      // Past the pass, its key gone and the headline on the next: following ends where the camera stands, and no
      // later pass takes the camera without the reader's hand (R127 review).
      const before = await look(w);
      await page.clock.setSystemTime(ORION_PEAK + 30 * 60_000 - TICK_MS);
      await page.clock.runFor(TICK_MS);
      await page.clock.runFor(1000);
      await expect(readout).not.toHaveAttribute('data-following', /.+/);
      await expect(keyOption).toHaveCount(0);
      expect((await look(w)).az).toBe(before.az);
    });
  }

  /**
   * FR-SKY-11 as amended v2.5 (V25-19, D-840): on a short wide window — FR-SHP-3's shape, the scrub block over the
   * box — the headline carries no landmark line, the first row to fold; the ring still marks the star. The same page
   * at 1280 × 800 has the line, so the one condition is the placement.
   */
  test('the short wide window: no landmark line on the headline, the ring stands, the line back on a tall window', async ({ page }) => {
    await openShowcase(page, { width: 1200, height: 450 }, 'en', 'window');
    await page.getByTestId('live-link').click();
    await expect
      .poll(async () => {
        await page.clock.runFor(200);
        return page.getByTestId('sky-chart').count();
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await page.clock.setSystemTime(ORION_RISE - 2 * 60_000 - TICK_MS);
    await page.clock.runFor(TICK_MS);
    await page.clock.runFor(1000);
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-scrub-placement', 'overlay');
    await expect(page.getByTestId('sky-chart').locator('[data-landmark-ring]')).toHaveCount(1);
    await expect(page.getByTestId('next-event-landmark')).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.clock.runFor(1000);
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-scrub-placement', 'under');
    await expect(page.getByTestId('next-event-landmark')).toHaveText(/^passes \d+° (?:above|below|beside) .+, in Orion$/);
  });

  for (const locale of LOCALES) {
    test(`the pass detail at 390, ${locale}: the line under the name, Orión in the Entre column, the ring on the polar chart`, async ({ page }) => {
    const passId = await openShowcase(page, { width: 390, height: 844 }, locale, 'dome');
    await page.locator(`article[data-pass-id="${passId}"]`).getByRole('button', { name: OPEN_GUIDE[locale] }).click();
    const sheet = guide(page);
    await expect(sheet).toBeVisible();
    // FR-SKY-11: the line, under the name, in the reader's language (D-832).
    await expect(sheet.getByTestId('pass-landmark')).toHaveText(locale === 'es' ? /^pasa \d+° (?:sobre|bajo|junto a) .+, en Orión$/ : /^passes \d+° (?:above|below|beside) .+, in Orion$/, { timeout: 30_000 });
    // FR-SKY-12: the `Among` / `Entre` column, the peak among Orión; the rise and the set named by where the eye is sent.
    const table = sheet.getByRole('table');
    await expect(table.getByRole('columnheader').last()).toHaveText(locale === 'es' ? 'Entre' : 'Among');
    await expect(table.locator('tr[data-point="peak"] td').last()).toHaveText(locale === 'es' ? 'Orión' : 'Orion');
    // The rise (out of the shadow) and the set are named too, by where the eye is sent — a name or the dash.
    for (const row of [0, 2]) await expect(table.locator('tbody tr').nth(row).locator('td').last()).toHaveText(/^(\p{Lu}[\p{L} ]+|—)$/u);
    await page.clock.runFor(1000);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r127-detail-390-dark-${locale}.png` });
    await table.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURE_DIR}/r127-detail-390-among-dark-${locale}.png` });
    // The polar chart rings the landmark too (FR-SKY-11: one ring in every view).
    await sheet.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: 'Polar' }).click();
    await page.clock.runFor(1000);
    await expect(sheet.locator('[data-drawing="polar"] [data-landmark-ring]')).toHaveCount(1);
    await sheet.locator('[data-drawing="polar"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${CAPTURE_DIR}/r127-detail-390-polar-dark-${locale}.png` });
    });
  }
});
