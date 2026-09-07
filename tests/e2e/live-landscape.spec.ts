/**
 * R34 (FR-LIVE-7, FR-LIVE-8; US-10, US-15 AC7, AC8) on the production build,
 * in a landscape phone viewport with a touch screen — the one place the
 * follow control is rendered (D-175):
 *
 *   - the two-pane layout: the dome on the left with the whole height, the
 *     top row, the stripe, the controls and the strip on the right, and
 *     nothing scrolls;
 *   - the wake lock, stubbed so the requests can be read: asked on entry,
 *     released when the document hides, asked again when it shows, released
 *     on leaving;
 *   - the follow control: a heading turns the dome, a drag turns following
 *     off and the dome stays where the drag left it, the control turns it on
 *     again;
 *   - the captures the PR carries: landscape in both themes and in Spanish,
 *     and portrait with the control, where it costs the dome a line.
 *
 * Portrait unchanged and no control on a desktop are asserted in
 * `live.spec.ts`, beside the layout facts it already holds.
 */
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, heading, homeAt, reenterLiveWithTheme, stripFilled, stubCompass, T } from './liveHelpers';

const LANDSCAPE = { width: 844, height: 390 };
const FOLLOW = { en: 'Follow phone', es: 'Seguir al teléfono' } as const;

declare global {
  interface Window {
    __wakeLock: string[];
  }
}

/** A wake lock the test can read: every request and release the page makes, in order, on `window.__wakeLock`. */
async function stubWakeLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[] = [];
    window.__wakeLock = log;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: (type: string) => {
          log.push(`request:${type}`);
          const listeners: (() => void)[] = [];
          return Promise.resolve({
            released: false,
            release: () => {
              log.push('release');
              for (const listener of listeners) listener();
              return Promise.resolve();
            },
            addEventListener: (_type: string, listener: () => void) => {
              listeners.push(listener);
            },
          });
        },
      },
    });
  });
}

const wakeLog = (page: Page): Promise<string[]> => page.evaluate(() => window.__wakeLock);

async function setVisibility(page: Page, state: 'visible' | 'hidden'): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

async function liveLandscape(page: Page, locale: 'en' | 'es' = 'en', wholeList = false): Promise<void> {
  await homeAt(page, T, locale, wholeList);
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

test.describe('the live page on a landscape phone', () => {
  test.use({ viewport: LANDSCAPE, hasTouch: true });

  test('two panes — the dome left with the whole height, the rest right — nothing scrolls, and the wake lock follows visibility (FR-LIVE-7)', async ({ page }) => {
    await stubWakeLock(page);
    await liveLandscape(page);

    // The page is the viewport, and nothing scrolls.
    const pageBox = await page.getByTestId('live-page').boundingBox();
    expect(pageBox?.height).toBe(LANDSCAPE.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);

    const dome = await page.getByTestId('live-dome').boundingBox();
    const side = await page.getByTestId('live-side').boundingBox();
    // R48 (D-246): the return control's 48 px hit box overhangs its 24 px row, so the row is what is measured.
    const back = await page.getByTestId('live-top-row').boundingBox();
    const stripe = await page.getByTestId('time-stripe').boundingBox();
    const strip = await page.getByTestId('status-strip').boundingBox();
    if (!dome || !side || !back || !stripe || !strip) throw new Error('the live page is not laid out');
    // The top row is one line across the top; under it the dome is the left two fifths and the
    // side column the right three (D-173). The dome keeps every row under the top one: about
    // 324 px against portrait's 300 (D-172).
    expect(dome.y).toBeGreaterThanOrEqual(back.y + back.height - 1);
    expect(side.y).toBeGreaterThanOrEqual(back.y + back.height - 1);
    expect(dome.x + dome.width).toBeLessThanOrEqual(side.x + 1);
    expect(dome.width).toBeGreaterThan(280);
    expect(dome.height).toBeGreaterThan(310);
    expect(dome.y + dome.height).toBeGreaterThan(LANDSCAPE.height - 12);
    // The strip, the stripe block and the controls are all in the side column, in that order (R48:
    // FR-LIVE-7 as amended puts the strip first), and the whole strip is on the screen — the side
    // column is what the layout is for.
    expect(stripe.x).toBeGreaterThanOrEqual(dome.x + dome.width - 1);
    expect(strip.x).toBeGreaterThanOrEqual(dome.x + dome.width - 1);
    expect(stripe.y).toBeGreaterThan(strip.y + strip.height - 1);
    expect(strip.y + strip.height).toBeLessThanOrEqual(LANDSCAPE.height);
    for (const field of ['time', 'sky', 'cloud', 'count', 'moon']) await expect(page.getByTestId(`live-${field}`)).toBeInViewport({ ratio: 1 });
    // The side column may scroll itself where its content wraps past the viewport; the page never does.
    expect(side.y + side.height).toBeLessThanOrEqual(LANDSCAPE.height + 1);

    // The wake lock: asked on entry, released when hidden, asked again when visible, released on leaving.
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-wake-lock', 'held');
    expect(await wakeLog(page)).toEqual(['request:screen']);
    await setVisibility(page, 'hidden');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-wake-lock', 'released');
    expect(await wakeLog(page)).toEqual(['request:screen', 'release']);
    await setVisibility(page, 'visible');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-wake-lock', 'held');
    expect(await wakeLog(page)).toEqual(['request:screen', 'release', 'request:screen']);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('live-page')).toHaveCount(0);
    expect(await wakeLog(page)).toEqual(['request:screen', 'release', 'request:screen', 'release']);
  });

  /**
   * R59 (FR-FOL-1, FR-FOL-2, FR-LIVE-8 as amended v1.2, D-276): the control
   * opens the sky window here too — a landscape phone is a phone — and the
   * dome's facing is the drag's alone (FR-GUIDE-4). R44's correction is still
   * what the strip states while the window is the view (US-21 AC6): +1.12° at
   * Neuquén on the fixtures' date, printed in whole words rather than leaving
   * the viewer to wonder why the picture sits a degree off the compass they
   * are holding.
   */
  test('follow phone: the control opens the window, the second press gives the dome back, and a phone with no north opens nothing (FR-FOL-1, FR-FOL-2)', async ({ page }) => {
    await stubCompass(page);
    await liveLandscape(page);
    const chart = page.getByTestId('sky-chart');
    const dome = page.getByTestId('live-dome');
    const facing = dome.locator('[data-facing-az]');
    await expect(facing).toHaveAttribute('data-facing-az', '0');
    const toggle = page.getByRole('button', { name: FOLLOW.en });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Not following: a reading opens nothing and turns nothing.
    await heading(page, 270);
    await expect(facing).toHaveAttribute('data-facing-az', '0');
    await expect(chart).toHaveAttribute('data-view', 'dome');

    expect(await page.evaluate(() => screen.orientation.angle)).toBe(0);
    await toggle.click();
    // R39 (F-42), D-276: the click arms the sensor and the first reading is what opens the window, so a
    // device that answers nothing leaves the page alone instead of showing a window with nothing to point at.
    await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    await expect(chart).toHaveAttribute('data-view', 'dome');
    await heading(page, 270);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    await expect(chart).toHaveAttribute('data-view', 'window');
    // US-21 AC6: the strip names the correction while the window is what is drawn.
    await expect(page.getByTestId('live-heading')).toHaveText('Heading true north, declination +1.1°');

    // The second press gives the dome back, where it was: the readings never moved it (FR-GUIDE-4).
    await toggle.click();
    await expect(chart).toHaveAttribute('data-view', 'dome');
    await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    await expect(page.getByTestId('live-heading')).toHaveCount(0);
    await expect(facing).toHaveAttribute('data-facing-az', '0');

    // A drag is the dome's own, and following is not part of it: 40 px right is 10° left, and the control stays as it was.
    const stage = dome.getByRole('group', { name: 'Sky dome' });
    const box = await stage.boundingBox();
    if (!box) throw new Error('the dome is not laid out');
    const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 20, cy, { steps: 2 });
    await page.mouse.move(cx + 40, cy, { steps: 2 });
    await page.clock.runFor(100);
    await page.mouse.up();
    await page.clock.runFor(100);
    await expect(facing).toHaveAttribute('data-facing-az', '350');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // FR-FOL-2: a phone whose readings carry no north shows the note, leaves the view alone and stays unpressed.
    await toggle.click();
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 45, beta: 0, gamma: 0, absolute: false }));
    });
    await expect(page.getByTestId('follow-note')).toHaveText('This phone gives no compass heading, so the sky window cannot open.');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(chart).toHaveAttribute('data-view', 'dome');
    await expect(facing).toHaveAttribute('data-facing-az', '350');
  });

  test('captures in landscape, both themes', async ({ page }) => {
    await liveLandscape(page, 'en', true);
    await expect(page.getByRole('button', { name: FOLLOW.en })).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-dark-en.png' });
    // R48 (D-244): a landscape phone is compact, and the compact live page carries no theme switch.
    await reenterLiveWithTheme(page, 'en', 'night');
    await page.clock.runFor(500);
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-night-en.png' });
  });

  test('captures in landscape in Spanish: the control and its row carry no English (FR-I18N-2)', async ({ page }) => {
    await liveLandscape(page, 'es', true);
    await expect(page.getByRole('button', { name: FOLLOW.es })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compartir este cielo' })).toBeVisible();
    await expect(page.getByTestId('live-sky')).toHaveText(/Cielo (oscuro|crepúsculo claro|de día)/);
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-dark-es.png' });
  });
});

test.describe('the live page on a portrait phone with the control', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('captures portrait with the follow control: one more controls line, and the dome about 290 px (D-177)', async ({ page }) => {
    await liveLandscape(page, 'en', true);
    const toggle = page.getByRole('button', { name: FOLLOW.en });
    await expect(toggle).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/r34-live-390-follow-dark-en.png' });
    // D-177 had the boxed share action on a fourth line, 38 cells with the toggle. R48 (FR-COMP-4,
    // D-245): the actions row is `Hidden · Follow · Share` on compact, 31 cells, so the three share one line.
    // R59 (D-300, F-55): the dome no longer keeps a floor here — on a touch phone the frame spends its
    // first 190 px on the three-view control and the legend, and a floor that overflowed onto the rows
    // under the box is what the finding was — so what is asserted is that the box stays inside its pane.
    // `live-compact.spec.ts` is where the fit itself is measured, row by row, at both phone heights.
    const dome = await page.getByTestId('live-dome').boundingBox();
    const drawing = await page.getByTestId('chart-box').boundingBox();
    expect((drawing?.y ?? 0) + (drawing?.height ?? 0)).toBeLessThanOrEqual((dome?.y ?? 0) + (dome?.height ?? 0) + 0.5);
    const follow = await toggle.boundingBox();
    const share = await page.getByRole('button', { name: 'Share this sky' }).boundingBox();
    const hidden = await page.getByRole('button', { name: 'Hidden objects' }).boundingBox();
    expect(Math.abs((share?.y ?? 0) - (follow?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((hidden?.y ?? 0) - (follow?.y ?? 0))).toBeLessThanOrEqual(1);
  });
});
