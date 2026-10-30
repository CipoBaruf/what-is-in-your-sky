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
import { domeDrawn, enterScrubbing, homeAt, leaveLive, openSheet, reenterLiveWithTheme, stripFilled, T } from './liveHelpers';

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
    // R77 (FR-WATCH-9 e) → R144 (FR-TONIGHT-6, FR-FLOW-15): the rail holds the same slots in both states; the instant is held on the track.
    await enterScrubbing(page);

    // The page is the viewport, and nothing scrolls.
    const pageBox = await page.getByTestId('live-page').boundingBox();
    expect(pageBox?.height).toBe(LANDSCAPE.height);

    // R148 (FR-FULL-1, FR-FULL-4): the box is the whole viewport; the head stands over its top-left and the sheet
    // (opened by `enterScrubbing`) is a side panel at the right, with the context line and the track in it, in order.
    const dome = await page.getByTestId('live-dome').boundingBox();
    const side = await page.getByTestId('live-sheet').boundingBox();
    const head = await page.getByTestId('live-head').boundingBox();
    const track = await page.getByTestId('live-track').boundingBox();
    const context = await page.getByTestId('live-context').boundingBox();
    if (!dome || !side || !head || !track || !context) throw new Error('the live page is not laid out');
    expect(Math.round(dome.width)).toBe(LANDSCAPE.width);
    expect(Math.round(dome.height)).toBe(LANDSCAPE.height);
    expect(head.y).toBeLessThan(LANDSCAPE.height / 4);
    expect(head.x).toBeLessThan(side.x);
    expect(side.x + side.width).toBeLessThanOrEqual(LANDSCAPE.width + 1);
    expect(Math.round(side.height)).toBe(LANDSCAPE.height);
    expect(track.x).toBeGreaterThanOrEqual(side.x - 1);
    expect(context.x).toBeGreaterThanOrEqual(side.x - 1);
    expect(track.y).toBeGreaterThan(context.y + context.height - 1);
    for (const id of ['shown-time', 'context-line']) await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
    // The sheet's body may scroll itself where its rows wrap past the viewport; the page never does.

    // The wake lock: asked on entry, released when hidden, asked again when visible, released on leaving.
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-wake-lock', 'held');
    expect(await wakeLog(page)).toEqual(['request:screen']);
    await setVisibility(page, 'hidden');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-wake-lock', 'released');
    expect(await wakeLog(page)).toEqual(['request:screen', 'release']);
    await setVisibility(page, 'visible');
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-wake-lock', 'held');
    expect(await wakeLog(page)).toEqual(['request:screen', 'release', 'request:screen']);
    await leaveLive(page);
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
      const label = `${String(size.width)} x ${String(size.height)}`;
      if (!pane || !box) throw new Error(`the live page is not laid out at ${label}`);
      // R148 (FR-FULL-1): the box is the pane, and the pane the viewport, at every landscape size.
      expect(box.x, label).toBeGreaterThanOrEqual(pane.x - 0.5);
      expect(box.x + box.width, label).toBeLessThanOrEqual(pane.x + pane.width + 0.5);
      expect(box.x + box.width, label).toBeLessThanOrEqual(size.width + 0.5);
      expect(Math.round(box.width), label).toBe(size.width);
      expect(Math.round(box.height), label).toBe(size.height);
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
    // R148 (FR-FULL-4): the share action, the chip and the taps are the sheet's.
    await openSheet(page);
    await expect(page.getByRole('button', { name: 'Compartir este cielo' })).toBeVisible();
    // R144 (FR-TONIGHT-7): the chip and the taps in Spanish.
    await expect(page.getByTestId('shown-chip')).toHaveText('ahora');
    await expect(page.getByTestId('live-taps').getByRole('button', { name: '[ noche ]', exact: true })).toBeVisible();
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
    // R148 (FR-FULL-4): the view row, the actions and the taps are the sheet's.
    await openSheet(page);
    const toggle = page.getByRole('group', { name: 'Chart view' });
    await expect(toggle.getByRole('button')).toHaveText(['Window', 'Polar', 'Dome']);
    await page.screenshot({ path: 'docs/screenshots/r66-live-390-views-dark-en.png' });
    // R59 (D-300, F-55): the dome keeps no floor here — what is asserted is that the box stays inside its pane.
    // `live-full.spec.ts` is where the box is measured against the viewport.
    const dome = await page.getByTestId('live-dome').boundingBox();
    const drawing = await page.getByTestId('chart-box').boundingBox();
    expect((drawing?.y ?? 0) + (drawing?.height ?? 0)).toBeLessThanOrEqual((dome?.y ?? 0) + (dome?.height ?? 0) + 0.5);
    // FR-COMP-4: the actions row stays one line in both states — R150 (FR-GYRO-10): `Share` alone, the satellites
    // after it — and the taps row `▶ [ tonight ] [ next ] [ now ]` one line too, held or not.
    const actions = await page.getByTestId('live-actions').boundingBox();
    const shareWatching = await page.getByRole('button', { name: 'Share this sky' }).boundingBox();
    expect(shareWatching?.height ?? 0, 'one line').toBeLessThanOrEqual((actions?.height ?? 0) + 1);
    const taps = await page.getByTestId('live-taps').getByRole('button').all();
    const tapTops = await Promise.all(taps.map(async (tap) => (await tap.boundingBox())?.y ?? 0));
    for (const top of tapTops) expect(Math.abs(top - (tapTops[0] ?? 0))).toBeLessThanOrEqual(1);
    await enterScrubbing(page);
    const share = await page.getByRole('button', { name: 'Share this moment' }).boundingBox();
    const actionsHeld = await page.getByTestId('live-actions').boundingBox();
    expect(share?.height ?? 0, 'one line').toBeLessThanOrEqual((actionsHeld?.height ?? 0) + 1);
    expect(actionsHeld?.height).toBe(actions?.height);
    await page.getByTestId('live-tap-now').click();
    // The view control is one row too, with three options (V13-4's two-option row is withdrawn).
    const options = await toggle.getByRole('button').all();
    const tops = await Promise.all(options.map(async (option) => (await option.boundingBox())?.y ?? 0));
    for (const top of tops) expect(Math.abs(top - (tops[0] ?? 0))).toBeLessThanOrEqual(1);
  });
});
