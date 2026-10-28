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
import { BARILOCHE, FIXTURE_DATE, PARIS } from './observers';

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
async function chooseWindow(page: Page, locale: CaptureLocale): Promise<Locator> {
  await holdUp(page, locale);
  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 90, gamma: 0, absolute: true }));
  });
  await page.clock.runFor(1000);
  return page.getByTestId('sky-screen');
}

/**
 * R136 (FR-FLOW-14, FR-FLOW-15): the window option chooses the view, and the screen's one door is the window's
 * `[ hold up to the sky ]`, whose tap is the one that asks for the sensor. The window is chosen first where the
 * guide is not on it yet.
 */
async function holdUp(page: Page, locale: CaptureLocale): Promise<void> {
  const option = guide(page).getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: WINDOW_OPTION[locale] });
  if ((await option.getAttribute('aria-pressed')) !== 'true') await option.click();
  await page.clock.runFor(1000);
  await guide(page).getByTestId('window-hold-up').click();
}

/** The hold-up's tap where nothing is expected to open: a refusal, or a phone with no north. */
async function tapWindow(page: Page, locale: CaptureLocale): Promise<void> {
  await holdUp(page, locale);
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
    const toggle = guide(page).getByRole('group', { name: VIEW_GROUP.en });
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);

    // US-21 AC1, AC14 (R136: FR-FLOW-15): the option chooses the window, and its `[ hold up to the sky ]` opens the
    // screen, over the sheet.
    const layer = await chooseWindow(page, 'en');
    await expect(layer).toHaveCount(1);
    // The sheet is untouched under it: the guide is still on the view the reader picked, the window.
    await expect(figure).toHaveAttribute('data-view', 'window');
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
    // Paris: the declination is about +2°, so magnetic north is a true 2° (US-21 AC6). R127: the readout carries it
    // whatever its second line says — the landmark line while the pass detail's pass has one (FR-SKY-11), the
    // true-north line otherwise.
    const declination = Number(await layer.getByTestId('window-readout').getAttribute('data-declination'));
    expect(Math.abs(declination)).toBeGreaterThan(0.5);
    expect(north.az).toBe((Math.round(declination) + 360) % 360);
    expect(north.alt).toBe(0);
    await expect(layer.getByTestId('window-readout')).toContainText(`Facing N (${String(north.az)}°) · up 0°`);
    await expect(layer.locator('[data-testid="window-landmark"], [data-testid="window-heading"]')).toHaveCount(1);
    if ((await layer.getByTestId('window-heading').count()) > 0) await expect(layer.getByTestId('window-heading')).toHaveText(/^true north, declination [+−-]\d\.\d°$/);
    else await expect(layer.getByTestId('window-landmark')).toHaveText(/^passes /);
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

    // R136 (FR-FLOW-14, D-876): the device carries the view the reader picked, the window, saved on compact too.
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'window' });
  });

  /** FR-FOL-2 as amended v1.3.1: a refusal opens no screen, leaves the guide on its view, and keeps the option. */
  test('a refused permission opens nothing, leaves the guide on its view with the note, and the option stays', async ({ page }) => {
    await stubCompass(page);
    await withPermissionPrompt(page, 'denied');
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = guide(page).getByRole('group', { name: VIEW_GROUP.en });
    await tapWindow(page, 'en');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    // R136: the refusal is the hold-up's, and the guide stays on the window the option chose.
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(guide(page).getByTestId('chart-view-note')).toHaveText('Motion access was refused. To be asked again, reload the page: Safari asks once per load.');
    await page.screenshot({ path: `${CAPTURE_DIR}/r66-window-390-denied-dark-en.png` });
    // Any other choice clears the note.
    await toggle.getByRole('button', { name: 'Polar' }).click();
    await expect(guide(page).getByTestId('chart-view-note')).toHaveCount(0);
    await expect(toggle.getByRole('button', { name: 'Window' })).toBeVisible();
  });

  /**
   * FR-WIN-4: a phone whose readings carry no north opens nothing. R121 (FR-WIN-4 as amended v2.5, FR-SKY-2): it
   * keeps the option — the presence test governs the sensor, never the view. R136 (FR-FLOW-15): the ask is the
   * hold-up's, the window stays in the box under the hand, and with no sensor left the hold-up is gone.
   */
  test('a phone with no compass heading gets the note, keeps the option, and the window stays in the box by hand', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = guide(page).getByRole('group', { name: VIEW_GROUP.en });
    await tapWindow(page, 'en');
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 30, beta: 90, gamma: 0, absolute: false }));
    });
    await page.clock.runFor(FRAME_MS);
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    // R136: the window the option chose stays the view, by hand, under the note.
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(figure.locator('[data-look-az]')).toHaveAttribute('data-state', 'hand');
    await expect(guide(page).getByTestId('chart-view-note')).toHaveText('This device is not reporting which way it faces.');
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
    // The sensor is lost for the session, so the window no longer offers the screen's door; the box stays by hand.
    await expect(guide(page).getByTestId('window-hold-up')).toHaveCount(0);
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'window' });
  });

  /** R90 (FR-FAIL-7): the two notes it changed, captured in both languages. */
  for (const locale of ['en', 'es'] as const) {
    for (const note of ['silent', 'denied'] as const) {
      test(`capture: the ${note} note at 390, dark, ${locale}`, async ({ page }) => {
        await stubCompass(page);
        if (note === 'denied') await withPermissionPrompt(page, 'denied');
        await open(page, { width: 390, height: 844 }, { locale, theme: 'dark', observer: PARIS, chartView: 'dome' });
        await openDetail(page, locale);
        await holdUp(page, locale);
        await page.clock.runFor(3000);
        await expect(guide(page).getByTestId('chart-view-note')).toBeVisible();
        await guide(page).getByTestId('chart-view-note').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${CAPTURE_DIR}/r90-window-390-${note}-dark-${locale}.png` });
      });
    }
  }

  /** R90 (FR-FAIL-7, D-550): a device whose orientation API never sends a reading gets the note after SENSOR_WAIT_S (3 s). */
  test('a device that sends no reading gets the note three seconds after the tap', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = guide(page).getByRole('group', { name: VIEW_GROUP.en });
    await holdUp(page, 'en');
    await page.clock.runFor(2900);
    await expect(guide(page).getByTestId('chart-view-note')).toHaveCount(0);
    await page.clock.runFor(100);
    await expect(guide(page).getByTestId('chart-view-note')).toHaveText('This device is not reporting which way it faces.');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(figure).toHaveAttribute('data-view', 'window');
    // R121 (FR-WIN-4 as amended v2.5): the option stays; it is the sensor that is lost for the session.
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
  });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`capture: the sky screen from a pass detail at 844 x 390, ${theme}, ${locale}, aimed at the peak`, async ({ page }) => {
        await stubCompass(page);
        await open(page, { width: 844, height: 390 }, { locale, theme, observer: PARIS, chartView: 'dome' });
        await openDetail(page, locale);
        const layer = await chooseWindow(page, locale);
        const w = layer.locator('[data-look-az]');
        await expect(w).toBeAttached();
        // The placeholder already points at the peak azimuth, as high as the peak needs: the reading puts the phone
        // there, then again less Paris's declination (known once the window is on), so the true look is the placeholder's.
        const aim = await look(w);
        await point(page, aim.az, aim.alt);
        await settle(page);
        await expect(w).toHaveAttribute('data-state', 'on');
        const declination = Number(await layer.getByTestId('window-readout').getAttribute('data-declination'));
        await point(page, aim.az - declination, aim.alt);
        await settle(page);
        expect(await look(w)).toEqual(aim);
        await expect(layer.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(layer.getByTestId('window-readout')).toContainText(locale === 'es' ? 'Hacia el' : 'Facing');
        // R127 (FR-SKY-11): the second line is the landmark line while the pass has one, the true-north line otherwise.
        const second = layer.locator('[data-testid="window-landmark"], [data-testid="window-heading"]');
        await expect(second).toHaveCount(1);
        await expect(second).toContainText(locale === 'es' ? /norte verdadero|^pasa / : /true north|^passes /);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r66-window-844-${theme}-${locale}.png` });
      });
    }
  }

  test('capture: the horizon with its compass names, aimed 12° up toward the peak', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 844, height: 390 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    await openDetail(page, 'en');
    const layer = await chooseWindow(page, 'en');
    const w = layer.locator('[data-look-az]');
    const peakAz = Number(await w.getAttribute('data-look-az'));
    await point(page, peakAz, 12);
    await settle(page);
    await expect(w).toHaveAttribute('data-state', 'on');
    const declination = Number(await layer.getByTestId('window-readout').getAttribute('data-declination'));
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
    const toggle = guide(page).getByRole('group', { name: VIEW_GROUP.en });
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
    // The picker: `peak` first and pressed, the eight points, `up`; no `[ hold up to the sky ]` without a sensor.
    const picker = guide(page).getByRole('group', { name: 'Facing' });
    await expect(picker.getByRole('button')).toHaveText(['peak', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up']);
    await expect(picker.locator('[data-option="peak"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(guide(page).getByTestId('window-hold-up')).toHaveCount(0);
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
        // The box is cut to the browser window's shape (`windowBox`) and the rail stands beside it.
        expect(Math.abs(box.width / box.height - width / height)).toBeLessThan(0.02);
        const [boxRect, rail] = await Promise.all([rectOf(page.getByTestId('chart-box')), rectOf(page.getByTestId('live-rail-head'))]);
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
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
    await toggle.getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
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

  test('lays the window out in the box by hand on the live page, the picker in the controls row', async ({ page }) => {
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    await openLive(page);
    const chart = page.getByTestId('sky-chart');
    await page.getByTestId('live-layout').getByRole('group', { name: VIEW_GROUP.en }).getByRole('button', { name: 'Window' }).click();
    await page.clock.runFor(1000);
    await expect(chart).toHaveAttribute('data-view', 'window');
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(chart.locator('[data-look-az]')).toHaveAttribute('data-state', 'hand');
    await expect(page.getByTestId('live-layout').locator('[data-slot="picker"]').getByTestId('window-facing')).toBeVisible();
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
