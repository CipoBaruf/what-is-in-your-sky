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
async function chooseWindow(page: Page, figure: Locator, locale: CaptureLocale): Promise<void> {
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

  test('is offered, draws in the shared frame, and turns with the phone one frame at a time', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    await expect(figure).toHaveAttribute('data-view', 'dome');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
    const frameBox = async () => (await figure.getByTestId('chart-frame').boundingBox()) ?? { x: NaN, y: NaN, width: NaN, height: NaN };
    const domeFrame = await frameBox();

    // US-21 AC1: the tap chooses the view; Chromium has no permission prompt, so the window is drawn at once.
    await chooseWindow(page, figure, 'en');
    await expect(figure).toHaveAttribute('data-view', 'window');
    const drawing = figure.locator('[data-drawing="window"]');
    await expect(drawing).toBeVisible();
    await expect(drawing).toHaveAttribute('aria-hidden', 'true');
    expect(await frameBox()).toEqual(domeFrame); // one frame for the three views
    expect(await page.locator('canvas').count()).toBe(0);
    const w = figure.locator('[data-look-az]');
    await expect(w).toHaveAttribute('data-state', 'idle');
    await expect(figure.getByTestId('window-note')).toHaveText('Waiting for the phone’s sensors…');
    // The placeholder: at the pass's peak azimuth, raised from 20° so the 61° peak keeps 8° inside the top of the
    // 60° box (61 − 30 + 8), the key at the peak in view.
    const placeholder = await look(w);
    expect(placeholder.alt).toBe(39);
    await expect(figure.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
    await expect(figure.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveText('A');
    await expect(figure.locator('[data-anchor="pass"], [data-anchor="peak"]')).toHaveCount(0);
    await expect(figure.getByTestId('chart-legend').locator(`button[data-pass-id="${GLARE_PASS}"]`)).toContainText('ISS (Zarya)');
    // No hand-driven view (FR-WIN-5): a drag on the drawing turns nothing.
    const box = (await drawing.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await look(w)).toEqual(placeholder);

    // US-21 AC3: a reading north on the horizon; the compass name N comes into view, S is not.
    const horizonBefore = await figure.locator('[data-horizon]').getAttribute('d');
    await point(page, 0, 0);
    await settle(page);
    await expect(w).toHaveAttribute('data-state', 'on');
    const north = await look(w);
    // Paris: the declination is about +2°, so magnetic north is a true 2° (US-21 AC6).
    const declination = Number(await figure.getByTestId('window-heading').getAttribute('data-declination'));
    expect(Math.abs(declination)).toBeGreaterThan(0.5);
    expect(north.az).toBe((Math.round(declination) + 360) % 360);
    expect(north.alt).toBe(0);
    await expect(figure.getByTestId('window-readout')).toContainText(`Looking N (${String(north.az)}°) · up 0°`);
    await expect(figure.getByTestId('window-heading')).toHaveText(/^true north, declination [+−-]\d\.\d°$/);
    await expect(figure.locator('[data-anchor="N"]')).toHaveAttribute('data-in-view', 'true');
    await expect(figure.locator('[data-anchor="S"]')).toHaveAttribute('data-in-view', 'false');
    expect(await figure.locator('[data-horizon]').getAttribute('d')).not.toBe(horizonBefore);

    // A quarter turn east and 30° up, then the rate: thirty readings a degree apart, one frame each, and every
    // frame drew — the look moved on each (FR-WIN-3: the window draws at the display rate, 60/s under the clock).
    await point(page, 90, 30);
    const partWay = await look(w);
    expect(partWay.az).toBeGreaterThan(north.az + 5);
    expect(partWay.az).toBeLessThan(85);
    await settle(page);
    expect(await look(w)).toEqual({ az: (90 + Math.round(declination) + 360) % 360, alt: 30 });
    await expect(figure.locator('[data-anchor="N"]')).toHaveAttribute('data-in-view', 'false');
    await expect(figure.locator('[data-anchor="E"]')).toHaveAttribute('data-in-view', 'true');
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
    await expect(figure.locator('[data-marker="zenith"]')).toHaveAttribute('data-in-view', 'true');

    // US-21 AC7: the choice is saved on the device.
    expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).toMatchObject({ chartView: 'window' });
  });

  test('a saved window that needs a tap shows [ point at the sky ]; the tap asks and, granted, the window follows the phone', async ({ page }) => {
    await stubCompass(page);
    await withPermissionPrompt(page, 'granted');
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'window' });
    const figure = await openDetail(page, 'en');
    await expect(figure).toHaveAttribute('data-view', 'window');
    await page.clock.runFor(1000);
    const gate = figure.getByTestId('window-gate');
    await expect(gate).toHaveText('point at the sky');
    await expect(gate).toBeVisible();
    await expect(figure.getByTestId('chart-box')).toContainText('point at the sky');
    // Before the tap, readings change nothing.
    const w = figure.locator('[data-look-az]');
    await point(page, 0, 0);
    await expect(w).toHaveAttribute('data-state', 'idle');
    await gate.click();
    await page.clock.runFor(100);
    await expect(gate).toHaveCount(0);
    await point(page, 0, 0);
    await settle(page);
    await expect(w).toHaveAttribute('data-state', 'on');
    await page.screenshot({ path: `${CAPTURE_DIR}/r47-window-390-gate-tapped-dark-en.png` });
  });

  test('a refused permission leaves the dome as the view with the note, and the option stays', async ({ page }) => {
    await stubCompass(page);
    await withPermissionPrompt(page, 'denied');
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await chooseWindow(page, figure, 'en');
    await expect(figure).toHaveAttribute('data-view', 'dome');
    await expect(figure.getByTestId('chart-view-note')).toHaveText('Motion access was refused, so the dome stays the view.');
    await expect(toggle.getByRole('button', { name: 'Window' })).toHaveAttribute('aria-pressed', 'false');
    await page.screenshot({ path: `${CAPTURE_DIR}/r47-window-390-denied-dark-en.png` });
    // Any other choice clears the note.
    await toggle.getByRole('button', { name: 'Polar' }).click();
    await expect(figure.getByTestId('chart-view-note')).toHaveCount(0);
  });

  test('a phone with no compass heading gets the note, the dome, and no window option', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    const toggle = figure.getByRole('group', { name: VIEW_GROUP.en });
    await chooseWindow(page, figure, 'en');
    await expect(figure).toHaveAttribute('data-view', 'window');
    await expect(figure.locator('[data-drawing="window"]')).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 30, beta: 90, gamma: 0, absolute: false }));
    });
    await page.clock.runFor(FRAME_MS);
    await expect(figure).toHaveAttribute('data-view', 'dome');
    await expect(figure.getByTestId('chart-view-note')).toHaveText('This phone gives no compass heading, so the window cannot find north.');
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome']);
  });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`capture: the window at 390 px, ${theme}, ${locale}, aimed at the peak from the stubbed orientation`, async ({ page }) => {
        await stubCompass(page);
        await open(page, { width: 390, height: 844 }, { locale, theme, observer: PARIS, chartView: 'dome' });
        const figure = await openDetail(page, locale);
        await chooseWindow(page, figure, locale);
        await expect(figure).toHaveAttribute('data-view', 'window');
        const w = figure.locator('[data-look-az]');
        await expect(w).toBeAttached();
        // The placeholder already points at the peak azimuth, as high as the peak needs: the reading puts the phone
        // there, then again less Paris's declination (known once the window is on), so the true look is the placeholder's.
        const aim = await look(w);
        await point(page, aim.az, aim.alt);
        await settle(page);
        await expect(w).toHaveAttribute('data-state', 'on');
        const declination = Number(await figure.getByTestId('window-heading').getAttribute('data-declination'));
        await point(page, aim.az - declination, aim.alt);
        await settle(page);
        expect(await look(w)).toEqual(aim);
        await expect(figure.locator(`[data-pass-id="${GLARE_PASS}"] [data-anchor="key"]`)).toHaveAttribute('data-in-view', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(figure.getByTestId('window-readout')).toContainText(locale === 'es' ? 'Mirando al' : 'Looking');
        await expect(figure.getByTestId('window-heading')).toContainText(locale === 'es' ? 'norte verdadero' : 'true north');
        await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r47-window-390-${theme}-${locale}.png` });
      });
    }
  }

  test('capture: the horizon with its compass names, aimed 12° up toward the peak', async ({ page }) => {
    await stubCompass(page);
    await open(page, { width: 390, height: 844 }, { locale: 'en', theme: 'dark', observer: PARIS, chartView: 'dome' });
    const figure = await openDetail(page, 'en');
    await chooseWindow(page, figure, 'en');
    const w = figure.locator('[data-look-az]');
    const peakAz = Number(await w.getAttribute('data-look-az'));
    await point(page, peakAz, 12);
    await settle(page);
    await expect(w).toHaveAttribute('data-state', 'on');
    const declination = Number(await figure.getByTestId('window-heading').getAttribute('data-declination'));
    await point(page, peakAz - declination, 12);
    await settle(page);
    expect(await look(w)).toEqual({ az: peakAz, alt: 12 });
    // The peak is in the south-southwest: the names either side of it are on the horizon in view, and the ticks between them.
    await expect(figure.locator('[data-horizon]')).toHaveAttribute('d', /^M/);
    await expect(figure.locator('[data-anchor="S"]')).toHaveAttribute('data-in-view', 'true');
    await expect(figure.locator('[data-tick][data-in-view="true"]')).not.toHaveCount(0);
    await figure.locator('[data-drawing]').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r47-window-390-horizon-dark-en.png` });
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
