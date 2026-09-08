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
 * place; the tap asks, and a refusal leaves the dome with the note. Without
 * touch (the desktop profile) the option is absent and a saved window is the
 * dome.
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
    // The placeholder: at the pass's peak azimuth, raised from 20° so the 61° peak keeps 8° inside the top of the
    // 60° box (61 − 30 + 8), the key at the peak in view.
    const placeholder = await look(w);
    expect(placeholder.alt).toBe(39);
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
    await expect(figure.getByTestId('chart-view-note')).toHaveText('Motion access was refused, so the dome stays the view.');
    await page.screenshot({ path: `${CAPTURE_DIR}/r66-window-390-denied-dark-en.png` });
    // Any other choice clears the note.
    await toggle.getByRole('button', { name: 'Polar' }).click();
    await expect(figure.getByTestId('chart-view-note')).toHaveCount(0);
    await expect(toggle.getByRole('button', { name: 'Window' })).toBeVisible();
  });

  /** FR-WIN-4: a phone whose readings carry no north opens nothing and is not offered the window again. */
  test('a phone with no compass heading gets the note and loses the option', async ({ page }) => {
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
    await expect(figure.getByTestId('chart-view-note')).toHaveText('This phone gives no compass heading, so the window cannot find north.');
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome']);
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

test.describe('the sky window without a touch screen', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test('is not offered, and a saved window is the dome', async ({ page }) => {
    await open(page, { width: 1280, height: 800 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'window' });
    const figure = await openDetail(page, 'en');
    await expect(figure).toHaveAttribute('data-view', 'dome');
    await expect(figure.getByRole('group', { name: VIEW_GROUP.en }).getByRole('button')).toHaveText(['Polar', 'Dome']);
    await expect(figure.getByTestId('window-gate')).toHaveCount(0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r47-detail-1280-no-window-dark-en.png` });
  });
});
