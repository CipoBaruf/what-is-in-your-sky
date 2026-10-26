/**
 * R47 (FR-WIN-1..5, FR-GUIDE-2b as amended, US-21 AC1..AC4, AC7): the sky
 * window on the production build.
 *
 * On a phone (`hasTouch`, D-175's presence test) the view toggle offers
 * "Window"; choosing it draws the window in the frame the dome and the polar
 * share, and a synthetic `deviceorientationabsolute` reading moves the horizon
 * and the compass names with it — the picture eased toward each reading one
 * frame at a time under the installed clock (the rate figure in the summary).
 * A saved window that still needs a tap shows `[ point at the sky ]` in its
 * place; the tap asks, and a refusal leaves the dome with the note.
 *
 * R121 (FR-SKY-2, FR-SKY-7, FR-WIN-4, FR-WIN-5 as amended v2.5; D-789, D-790):
 * the option is on every device. On a desk (the last two blocks) it is a view
 * laid out in the box under the hand camera — saved on wide, cut to the
 * browser window's shape, the picker in the rail or the controls row; the
 * chart's own unsaved choice on compact without a sensor — and the pass
 * detail's window opens facing the pass's peak, on the page and on the screen.
 *
 * The captures for the PR: the window at 390 px, both themes, both languages,
 * aimed from the stubbed orientation at the glare pass's peak, 20° up — the
 * spike's "horizon" framing (`docs/window/FINDINGS.md`). The place, the pass
 * and the instant are `r45-captures.spec.ts`'s: Paris on 2026-09-02, three
 * minutes into the glare pass, with the Moon up and the Sun in the twilight
 * band, so the drawing has its bodies and the legend its lines.
 *
 *   npx playwright test sky-window --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR, LOCALES, THEMES, type CaptureLocale, type CaptureTheme } from './captureSet';
import { stubCompass } from './liveHelpers';
import { FIXTURE_DATE, PARIS } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const GLARE_PASS = `25544-${String(GLARE_PASS_START)}`;
const CLOCK = Date.parse('2026-09-02T03:00:00Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;
const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;
const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;
const WINDOW_OPTION = { en: 'Window', es: 'Ventana' } as const;
const FRAME_MS = 16;

const guide = (page: Page): Locator => page.locator('[role="dialog"], [data-testid="guide-panel"]').first();

async function open(page: Page, viewport: { width: number; height: number }, prefs: { locale: CaptureLocale; theme: CaptureTheme; observer: Observer; chartView: 'dome' | 'polar' | 'window' }): Promise<void> {
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
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

/** iOS's `requestPermission`, answering as told, installed before the app loads. */
async function withPermissionPrompt(page: Page, answer: 'granted' | 'denied'): Promise<void> {
  await page.addInitScript((value: string) => {
    const ctor = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    ctor.requestPermission = () => Promise.resolve(value);
  }, answer);
}

/** A reading from the phone: the W3C alpha for a back facing `azDeg`, tilted `altDeg` up; then one frame. */
async function point(page: Page, azDeg: number, altDeg: number): Promise<void> {
  await page.evaluate(
    ([alpha, beta]) => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha, beta, gamma: 0, absolute: true }));
    },
    [(360 - azDeg) % 360, 90 + altDeg] as [number, number],
  );
  await page.clock.runFor(FRAME_MS);
}

/** The tap that chooses the window; the clock runs after it because the paused clock holds React's lazy reveal (R32). */
/**
 * R66 (FR-FSC-1, FR-FSC-6; V13-6, V13-9, D-350, D-351): choosing "window" on
 * the pass detail opens the **sky screen** — the same layer the live page
 * opens — and not a third view laid out in the sheet. The tap arms the sensor
 * and the first reading with a north in it is what opens anything, so the
 * caller gets a reading in before it waits for the layer.
 */
async function chooseWindow(page: Page, figure: Locator, locale: CaptureLocale): Promise<Locator> {
  await figure.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: WINDOW_OPTION[locale] }).click();
  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 90, gamma: 0, absolute: true }));
  });
  await page.clock.runFor(1000);
  return page.getByTestId('sky-screen');
}

/** The option's tap where nothing is expected to open: a refusal, or a phone with no north. */
async function tapWindow(page: Page, figure: Locator, locale: CaptureLocale): Promise<void> {
  await figure.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: WINDOW_OPTION[locale] }).click();
  await page.clock.runFor(1000);
}

/** Frames until the smoothing has settled on the last reading. */
const settle = async (page: Page): Promise<void> => {
  await page.clock.runFor(40 * FRAME_MS);
};

const look = async (window: Locator): Promise<{ az: number; alt: number }> => ({
  az: Number(await window.getAttribute('data-look-az')),
  alt: Number(await window.getAttribute('data-look-alt')),
});

test.describe('the sky window on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('is offered on the pass detail, opens the sky screen, and turns with the phone one frame at a time', async ({ page }) => {
    await stubCompass(page);
    // R66 (FR-FSC-4): the screen draws sideways, so the phone is held sideways for every drawing case here.
    await open(page, { width: 844, height: 390 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    await expect(figure).toHaveAttribute('data-view', 'dome');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);

    // US-21 AC1, AC14: the tap chooses the view and what it opens is the screen, over the sheet.
    const layer = await chooseWindow(page, figure, 'en');
    await expect(layer).toHaveCount(1);
    // The sheet is untouched under it: the guide is still on the view the reader picked.
    await expect(figure).toHaveAttribute('data-view', 'dome');
    const drawing = layer.locator('[data-drawing="window"]');
    await expect(drawing).toBeVisible();
    await expect(drawing).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('canvas').count()).toBe(0);
    const w = layer.locator('[data-look-az]');
    // R121 (FR-SKY-7, D-790): before the first reading the screen looks at the pass as `facePeak` says — the peak's
    // azimuth at `clamp(61 − 15, 20, 75)` = 46°, the peak in the field's upper half and its key in view. (R47's rule,
    // 61 − 30 + 8 = 39°, is the live page's screen's still, which names its own facing.)
    const placeholder = await look(w);
    expect(placeholder.alt).toBe(46);
    await expect(layer.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
    await expect(layer.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveText('A');
    await expect(layer.locator('[data-anchor="pass"], [data-anchor="peak"]')).toHaveCount(0);
    // No hand-driven view (FR-WIN-5): a drag on the drawing turns nothing.
    const box = (await drawing.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await look(w)).toEqual(placeholder);

    // US-21 AC3: a reading north on the horizon; the compass name N comes into view, S is not.
    const horizonBefore = await layer.locator('[data-horizon]').getAttribute('d');
    await point(page, 0, 0);
    await settle(page);
    await expect(w).toHaveAttribute('data-state', 'on');
    const north = await look(w);
    // Paris: the declination is about +2°, so magnetic north is a true 2° (US-21 AC6).
    const declination = Number(await layer.getByTestId('window-heading').getAttribute('data-declination'));
    expect(Math.abs(declination)).toBeGreaterThan(0.5);
    expect(north.az).toBe((Math.round(declination) + 360) % 360);
    expect(north.alt).toBe(0);
    await expect(layer.getByTestId('window-readout')).toContainText(`Looking N (${String(north.az)}°) · up 0°`);
    await expect(layer.getByTestId('window-heading')).toHaveText(/^true north, declination [+−-]\d\.\d°$/);
    await expect(layer.locator('[data-anchor="N"]')).toHaveAttribute('data-in-view', 'true');
    await expect(layer.locator('[data-anchor="S"]')).toHaveAttribute('data-in-view', 'false');
    expect(await layer.locator('[data-horizon]').getAttribute('d')).not.toBe(horizonBefore);

    // A quarter turn east and 30° up, then the rate: thirty readings a degree apart, one frame each, and every
    // frame drew — the look moved on each (FR-WIN-3: the window draws at the display rate, 60/s under the clock).
    await point(page, 90, 30);
    const partWay = await look(w);
    expect(partWay.az).toBeGreaterThan(north.az + 5);
    expect(partWay.az).toBeLessThan(85);
    await settle(page);
    expect(await look(w)).toEqual({ az: (90 + Math.round(declination) + 360) % 360, alt: 30 });
    await expect(layer.locator('[data-anchor="N"]')).toHaveAttribute('data-in-view', 'false');
    await expect(layer.locator('[data-anchor="E"]')).toHaveAttribute('data-in-view', 'true');
    let drawn = 0;
    let previous = (await look(w)).az;
    for (let i = 1; i <= 30; i += 1) {
      await point(page, 90 + i * 3, 30);
      const now = (await look(w)).az;
      if (now !== previous) drawn += 1;
      previous = now;
    }
    expect(drawn).toBeGreaterThanOrEqual(28);

    // Over the head (US-21 AC3): the zenith mark in view, the picture continuous.
    await point(page, 180, 89);
    await settle(page);
    expect((await look(w)).alt).toBe(89);
    await expect(layer.locator('[data-marker="zenith"]')).toHaveAttribute('data-in-view', 'true');

    // FR-WIN-5 as amended v1.3.1 (V13-8): the window is a mode — the device still carries the view the reader picked.
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'dome' });
  });

  /** FR-FOL-2 as amended v1.3.1: a refusal opens no screen, leaves the guide on its view, and keeps the option. */
  test('a refused permission opens nothing, leaves the guide on its view with the note, and the option stays', async ({ page }) => {
    await stubCompass(page);
    await withPermissionPrompt(page, 'denied');
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await tapWindow(page, figure, 'en');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(figure).toHaveAttribute('data-view', 'dome');
    await expect(figure.getByTestId('chart-view-note')).toHaveText('Motion access was refused, so the dome stays the view. To be asked again, reload the page: Safari asks once per load.');
    await page.screenshot({ path: `${CAPTURE_DIR}/r66-window-390-denied-dark-en.png` });
    // Any other choice clears the note.
    await toggle.getByRole('button', { name: 'Polar' }).click();
    await expect(figure.getByTestId('chart-view-note')).toHaveCount(0);
    await expect(toggle.getByRole('button', { name: 'Window' })).toBeVisible();
  });

  /**
   * FR-WIN-4: a phone whose readings carry no north opens nothing. R121 (FR-WIN-4 as amended v2.5, FR-SKY-2): it
   * keeps the option — the presence test governs the sensor, never the view — and the next tap, with no sensor
   * left to ask, lays the window out in the box under the hand, unsaved.
   */
  test('a phone with no compass heading gets the note, keeps the option, and the next tap is the box by hand', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await tapWindow(page, figure, 'en');
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 30, beta: 90, gamma: 0, absolute: false }));
    });
    await page.clock.runFor(FRAME_MS);
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(figure).toHaveAttribute('data-view', 'dome');
    await expect(figure.getByTestId('chart-view-note')).toHaveText('This device is not reporting which way it faces.');
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
    await tapWindow(page, figure, 'en');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(figure.locator('[data-look-az]')).toHaveAttribute('data-state', 'hand');
    await expect(figure.getByTestId('chart-view-note')).toHaveCount(0);
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'dome' });
  });

  /** R90 (FR-FAIL-7): the two notes it changed, captured in both languages. */
  for (const locale of ['en', 'es'] as const) {
    for (const note of ['silent', 'denied'] as const) {
      test(`capture: the ${note} note at 390, dark, ${locale}`, async ({ page }) => {
        await stubCompass(page);
        if (note === 'denied') await withPermissionPrompt(page, 'denied');
        await open(page, { width: 390, height: 844 }, { locale, theme: 'dark', observer: PARIS, chartView: 'dome' });
        const figure = await openDetail(page, locale);
        await figure.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: WINDOW_OPTION[locale] }).click();
        await page.clock.runFor(3000);
        await expect(figure.getByTestId('chart-view-note')).toBeVisible();
        await figure.getByTestId('chart-view-note').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${CAPTURE_DIR}/r90-window-390-${note}-dark-${locale}.png` });
      });
    }
  }

  /** R90 (FR-FAIL-7, D-550): a device whose orientation API never sends a reading gets the note after SENSOR_WAIT_S (3 s). */
  test('a device that sends no reading gets the note three seconds after the tap', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await toggle.getByRole('button', { name: WINDOW_OPTION.en }).click();
    await page.clock.runFor(2900);
    await expect(figure.getByTestId('chart-view-note')).toHaveCount(0);
    await page.clock.runFor(100);
    await expect(figure.getByTestId('chart-view-note')).toHaveText('This device is not reporting which way it faces.');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(figure).toHaveAttribute('data-view', 'dome');
    // R121 (FR-WIN-4 as amended v2.5): the option stays; it is the sensor that is lost for the session.
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
  });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`capture: the sky screen from a pass detail at 844 x 390, ${theme}, ${locale}, aimed at the peak`, async ({ page }) => {
        await stubCompass(page);
        await open(page, { width: 844, height: 390 }, { locale, theme, observer: PARIS, chartView: 'dome' });
        const figure = await openDetail(page, locale);
        const layer = await chooseWindow(page, figure, locale);
        const w = layer.locator('[data-look-az]');
        await expect(w).toBeAttached();
        // The placeholder already points at the peak azimuth, as high as the peak needs: the reading puts the phone
        // there, then again less Paris's declination (known once the window is on), so the true look is the placeholder's.
        const aim = await look(w);
        await point(page, aim.az, aim.alt);
        await settle(page);
        await expect(w).toHaveAttribute('data-state', 'on');
        const declination = Number(await layer.getByTestId('window-heading').getAttribute('data-declination'));
        await point(page, aim.az - declination, aim.alt);
        await settle(page);
        expect(await look(w)).toEqual(aim);
        await expect(layer.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(layer.getByTestId('window-readout')).toContainText(locale === 'es' ? 'Mirando al' : 'Looking');
        await expect(layer.getByTestId('window-heading')).toContainText(locale === 'es' ? 'norte verdadero' : 'true north');
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r66-window-844-${theme}-${locale}.png` });
      });
    }
  }

  test('capture: the horizon with its compass names, aimed 12° up toward the peak', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 844, height: 390 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const layer = await chooseWindow(page, figure, 'en');
    const w = layer.locator('[data-look-az]');
    const peakAz = Number(await w.getAttribute('data-look-az'));
    await point(page, peakAz, 12);
    await settle(page);
    await expect(w).toHaveAttribute('data-state', 'on');
    const declination = Number(await layer.getByTestId('window-heading').getAttribute('data-declination'));
    await point(page, peakAz - declination, 12);
    await settle(page);
    expect(await look(w)).toEqual({ az: peakAz, alt: 12 });
    // The peak is in the south-southwest: the names either side of it are on the horizon in view, and the ticks between them.
    await expect(layer.locator('[data-horizon]')).toHaveAttribute('d', /^M/);
    await expect(layer.locator('[data-anchor="S"]')).toHaveAttribute('data-in-view', 'true');
    await expect(layer.locator('[data-tick][data-in-view="true"]')).not.toHaveCount(0);
    await layer.locator('[data-drawing]').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r66-window-844-horizon-dark-en.png` });
  });
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
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    // A view like the other two: drawn here, not on a screen, and saved (FR-WIN-5 as amended v2.5).
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'window' });
    const w = figure.locator('[data-look-az]');
    await expect(w).toHaveAttribute('data-state', 'hand');
    await expect(w).toHaveAttribute('data-in-box', 'true');
    // FR-SKY-7: facing the peak's azimuth at clamp(61 − 15, 20, 75) = 46°, the arc under it and its key in view.
    const opened = await look(w);
    expect(opened.alt).toBe(46);
    await expect(figure.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
    // The box takes the browser window's shape (D-789), the readout stands in its corner, the hint in its foot.
    const frame = figure.getByTestId('chart-frame');
    await expect(frame).toHaveAttribute('data-hand-window', 'true');
    const box = await boxSettled(page, figure.getByTestId('chart-box'));
    expect(Math.abs(box.width / box.height - 1280 / 800)).toBeLessThan(0.02);
    const readout = await rectOf(figure.getByTestId('window-readout'));
    const boxRect = await rectOf(figure.getByTestId('chart-box'));
    expect(readout.x).toBeGreaterThanOrEqual(boxRect.x - 1);
    expect(readout.y).toBeGreaterThanOrEqual(boxRect.y - 1);
    expect(readout.y).toBeLessThan(boxRect.y + boxRect.height / 2);
    await expect(figure.getByTestId('window-hand-hint')).toHaveText('Drag the window, or use the arrow keys, to look around.');
    // The picker: `peak` first and pressed, the eight points, `up`; no `[ hold up to the sky ]` without a sensor.
    const picker = figure.getByRole('group', { name: 'Facing' });
    await expect(picker.getByRole('button')).toHaveText(['peak', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up']);
    await expect(picker.locator('[data-option="peak"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(figure.getByTestId('window-hold-up')).toHaveCount(0);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r121-detail-1280-window-dark-en.png` });
    // The hand (FR-STAR-4): a drag at 4 px per degree, the sky following the pointer; the keys while the box has focus.
    await page.mouse.move(boxRect.x + boxRect.width / 2, boxRect.y + boxRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(boxRect.x + boxRect.width / 2 + 120, boxRect.y + boxRect.height / 2, { steps: 5 });
    await page.clock.runFor(FRAME_MS);
    await page.mouse.up();
    await page.clock.runFor(FRAME_MS);
    expect((await look(w)).az).toBe((opened.az - 30 + 360) % 360);
    await expect(picker.locator('[data-option="peak"]')).toHaveAttribute('aria-pressed', 'false');
    await figure.locator('[tabindex="0"]').focus();
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
    await expect(figure.getByRole('group', { name: 'Mirando' }).getByRole('button')).toHaveText(['pico', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'arriba']);
    await expect(figure.getByTestId('window-readout')).toContainText('Mirando al');
    await boxSettled(page, figure.getByTestId('chart-box'));
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
        // FR-STAR-3's rule for a page with no pass to face: the pole side — north for Paris — at 35°.
        expect(await look(w)).toEqual({ az: 0, alt: 35 });
        const box = await boxSettled(page, page.getByTestId('chart-box'));
        // The box is cut to the browser window's shape (`windowBox`) and the rail stands beside it.
        expect(Math.abs(box.width / box.height - width / height)).toBeLessThan(0.02);
        const [boxRect, rail] = await Promise.all([rectOf(page.getByTestId('chart-box')), rectOf(page.getByTestId('live-rail-head'))]);
        expect(rail.x).toBeGreaterThanOrEqual(boxRect.x + boxRect.width - 1);
        // The facing picker in the rail (FR-SKY-2), the readout in the box's corner.
        await expect(page.getByTestId('chart-aside').getByTestId('window-facing')).toBeVisible();
        await expect(page.getByTestId('chart-aside').getByRole('group', { name: 'Facing' }).getByRole('button')).toHaveText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up']);
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
 * the hand camera, since there is no screen to open and nothing to ask; the
 * choice is not saved, so a reload opens on the saved view.
 */
test.describe('the sky window on a compact page without a sensor', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: false });

  test('lays the window out in the box by hand on the pass detail, does not save it, and a reload opens on the saved view', async ({ page }) => {
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    const w = figure.locator('[data-look-az]');
    await expect(w).toHaveAttribute('data-state', 'hand');
    expect((await look(w)).alt).toBe(46);
    // Compact keeps the dome's box — square, full-bleed — and the readout in its row, not the corner.
    const frame = figure.getByTestId('chart-frame');
    await expect(frame).toHaveAttribute('data-compact', 'true');
    const box = await rectOf(figure.getByTestId('chart-box'));
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    const readout = await rectOf(figure.getByTestId('window-readout'));
    expect(readout.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    await expect(figure.getByRole('group', { name: 'Facing' }).locator('[data-option="peak"]')).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'dome' });
    await figure.getByTestId('chart-box').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r121-detail-390-window-dark-en.png` });
    // Unsaved: the reload opens on the dome.
    await page.reload();
    const again = guide(page).getByRole('figure');
    await expect(again).toBeVisible({ timeout: 60_000 });
    await expect(again).toHaveAttribute('data-view', 'dome');
  });

  test('lays the window out in the box by hand on the live page, the picker in the controls row', async ({ page }) => {
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    await openLive(page);
    const chart = page.getByTestId('sky-chart');
    await chart.getByRole('group', { name: VIEW_GROUP.en }).getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    await expect(chart).toHaveAttribute('data-view', 'window');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(chart.locator('[data-look-az]')).toHaveAttribute('data-state', 'hand');
    await expect(chart.locator('[data-row="controls"]').getByTestId('window-facing')).toBeVisible();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r121-live-390-window-dark-en.png` });
  });
});
