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
 *   - F-63 (R66): the drawing stays inside the dome pane rather than lying
 *     over the status strip beside it, at every size a phone gives this
 *     layout;
 *   - the captures the PR carries: landscape in both themes and in Spanish,
 *     and portrait with the control, where it costs the dome a line.
 *
 * Portrait unchanged and no control on a desktop are asserted in
 * `live.spec.ts`, beside the layout facts it already holds.
 */
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, homeAt, reenterLiveWithTheme, stripFilled, T } from './liveHelpers';

const LANDSCAPE = { width: 844, height: 390 };

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
   * R66 (F-63, FR-COMP-5 and FR-LIVE-7 as amended v1.3.1; V13-10, D-355): the
   * drawing stays inside the dome pane.
   *
   * The compact chart box is full-bleed — it breaks out of the page's side
   * padding with a negative margin on each side (R45, D-187) — which is right
   * in portrait, where the pane is the whole page, and wrong here, where the
   * pane is the left column of a two-column grid. On the R64 build the box came
   * out one padding wider than its pane on each side and lay over the status
   * strip: at 844 x 390 the pane ran x 19 -> 340, the side column started at
   * 344, and the box ran 0 -> 359. The panes themselves never overlapped, which
   * is why the layout test above never saw it — so what is measured here is the
   * *drawing*, at the three sizes a phone gives this layout.
   */
  test('the drawing stays inside the dome pane and clear of the side column at every landscape phone size (F-63)', async ({ page }) => {
    for (const size of [
      { width: 844, height: 390 },
      { width: 932, height: 430 },
      { width: 740, height: 360 },
    ]) {
      await page.setViewportSize(size);
      if (size.width === 844) await liveLandscape(page);
      await page.clock.runFor(500);
      const pane = await page.getByTestId('live-dome').boundingBox();
      const box = await page.getByTestId('chart-box').boundingBox();
      const side = await page.getByTestId('live-side').boundingBox();
      const label = `${String(size.width)} x ${String(size.height)}`;
      if (!pane || !box || !side) throw new Error(`the live page is not laid out at ${label}`);
      // Inside its pane on both edges, and clear of the column beside it.
      expect(box.x, label).toBeGreaterThanOrEqual(pane.x - 0.5);
      expect(box.x + box.width, label).toBeLessThanOrEqual(pane.x + pane.width + 0.5);
      expect(box.x + box.width, label).toBeLessThanOrEqual(side.x + 0.5);
      // And still worth having: the box is most of the pane it is in.
      expect(box.width, label).toBeGreaterThan(pane.width * 0.9);
    }
  });

  test('captures in landscape, both themes', async ({ page }) => {
    await liveLandscape(page, 'en', true);
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-dark-en.png' });
    // R48 (D-244): a landscape phone is compact, and the compact live page carries no theme switch.
    await reenterLiveWithTheme(page, 'en', 'night');
    await page.clock.runFor(500);
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-night-en.png' });
  });

  test('captures in landscape in Spanish: the control and its row carry no English (FR-I18N-2)', async ({ page }) => {
    await liveLandscape(page, 'es', true);
    await expect(page.getByRole('button', { name: 'Compartir este cielo' })).toBeVisible();
    await expect(page.getByTestId('live-sky')).toHaveText(/Cielo (oscuro|crepúsculo claro|de día)/);
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-dark-es.png' });
  });
});

test.describe('the live page on a portrait phone with a compass', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  /**
   * R34's capture of the page with `[ follow phone ]` on it, re-shot by R66
   * (V13-6) as what a phone gets now: the three-option view control, and an
   * actions row of two — the hidden-objects toggle and the share action.
   */
  test('captures portrait on a phone: three view options, two actions on one row, and the box inside its pane', async ({ page }) => {
    await liveLandscape(page, 'en', true);
    const toggle = page.getByRole('group', { name: 'Chart view' });
    await expect(toggle.getByRole('button')).toHaveText(['Polar', 'Dome', 'Window']);
    await page.screenshot({ path: 'docs/screenshots/r66-live-390-views-dark-en.png' });
    // R59 (D-300, F-55): the dome keeps no floor here — what is asserted is that the box stays inside its pane.
    // `live-compact.spec.ts` is where the fit itself is measured, row by row, at both phone heights.
    const dome = await page.getByTestId('live-dome').boundingBox();
    const drawing = await page.getByTestId('chart-box').boundingBox();
    expect((drawing?.y ?? 0) + (drawing?.height ?? 0)).toBeLessThanOrEqual((dome?.y ?? 0) + (dome?.height ?? 0) + 0.5);
    // FR-COMP-4: the actions row is `Hidden · Share` and stays one line.
    const share = await page.getByRole('button', { name: 'Share this sky' }).boundingBox();
    const hidden = await page.getByRole('button', { name: 'Hidden objects' }).boundingBox();
    expect(Math.abs((share?.y ?? 0) - (hidden?.y ?? 0))).toBeLessThanOrEqual(1);
    // The view control is one row too, with three options (V13-4's two-option row is withdrawn).
    const options = await toggle.getByRole('button').all();
    const tops = await Promise.all(options.map(async (option) => (await option.boundingBox())?.y ?? 0));
    for (const top of tops) expect(Math.abs(top - (tops[0] ?? 0))).toBeLessThanOrEqual(1);
  });
});
