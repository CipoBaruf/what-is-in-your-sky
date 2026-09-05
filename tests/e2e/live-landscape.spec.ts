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
import { domeDrawn, homeAt, LABEL, stripFilled, T } from './liveHelpers';

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

/**
 * Only this file's readings reach the page. Chrome fires one orientation event with every value
 * `null` when the first listener is added on a machine with no sensor — a CI runner — and the hook
 * rightly reads that as "no compass heading". Landing between a click and an assertion, or between a
 * dispatched reading and its animation frame, it turned this test into a race (PR #57's merged head).
 * The browser's own events are trusted and the dispatched ones are not, so a capturing listener
 * installed before the app's stops the trusted ones.
 */
async function stubCompass(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const name of ['deviceorientationabsolute', 'deviceorientation']) {
      window.addEventListener(
        name,
        (event) => {
          if (event.isTrusted) event.stopImmediatePropagation();
        },
        true,
      );
    }
  });
}

async function setVisibility(page: Page, state: 'visible' | 'hidden'): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/** A reading from the phone's compass: Chrome's absolute event, `alpha` counter-clockwise from north. */
async function heading(page: Page, alpha: number): Promise<void> {
  await page.evaluate((value) => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: value, beta: 0, gamma: 0, absolute: true }));
  }, alpha);
  // The facing is handed out on the next animation frame, which the installed clock holds.
  await page.clock.runFor(100);
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
    const back = await page.getByRole('button', { name: LABEL.en.back }).boundingBox();
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
    // The stripe, the controls and the strip are all in the side column, in that order, and the
    // whole strip is on the screen — the side column is what the layout is for.
    expect(stripe.x).toBeGreaterThanOrEqual(dome.x + dome.width - 1);
    expect(strip.x).toBeGreaterThanOrEqual(dome.x + dome.width - 1);
    expect(strip.y).toBeGreaterThan(stripe.y + stripe.height - 1);
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

  test('follow phone: a heading turns the dome, a drag turns following off, and the control turns it on again (FR-LIVE-8)', async ({ page }) => {
    await stubCompass(page);
    await liveLandscape(page);
    const dome = page.getByTestId('live-dome');
    const facing = dome.locator('[data-facing-az]');
    await expect(facing).toHaveAttribute('data-facing-az', '0');
    const toggle = page.getByRole('button', { name: FOLLOW.en });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    // Not following: a reading turns nothing.
    await heading(page, 270);
    await expect(facing).toHaveAttribute('data-facing-az', '0');

    // Following: `360 − alpha`, turned by the screen's angle (0 in this emulation; asserted so the number below means what it says).
    expect(await page.evaluate(() => screen.orientation.angle)).toBe(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'on');
    await heading(page, 270);
    await expect(facing).toHaveAttribute('data-facing-az', '90');
    await expect(page.getByTestId('dome-readout')).toHaveText('Facing E (90°) · tilt 45°');
    await heading(page, 180);
    await expect(facing).toHaveAttribute('data-facing-az', '180');

    // A drag: following off, the dome where the drag left it (40 px right is 10° left), the next reading ignored.
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
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('follow-phone')).toHaveAttribute('data-state', 'off');
    await expect(facing).toHaveAttribute('data-facing-az', '170');
    await heading(page, 0);
    await expect(facing).toHaveAttribute('data-facing-az', '170');

    // The control turns it on again, and the next reading turns the dome.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await heading(page, 90);
    await expect(facing).toHaveAttribute('data-facing-az', '270');
    // A relative-only reading: the note, the control still pressed, the dome where it was.
    await page.evaluate(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 45, beta: 0, gamma: 0, absolute: false }));
    });
    await expect(page.getByTestId('follow-note')).toHaveText('This phone gives no compass heading, so the dome cannot turn with it.');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(facing).toHaveAttribute('data-facing-az', '270');
  });

  test('captures in landscape, both themes', async ({ page }) => {
    await liveLandscape(page, 'en', true);
    await expect(page.getByRole('button', { name: FOLLOW.en })).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-dark-en.png' });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.night }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    await page.clock.runFor(500);
    await page.screenshot({ path: 'docs/screenshots/r34-live-844-landscape-night-en.png' });
    await page.getByRole('group', { name: LABEL.en.theme }).getByRole('button', { name: LABEL.en.dark }).click();
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
    // D-177: the toggle (16 cells) and the boxed share action (20) are 38 cells with their gap, two more
    // than the phone has, so the share action takes a fourth line and the dome pays a row for it —
    // 291 px against the 300 the untouched profile keeps (D-172). Landscape is the phone's answer.
    const dome = await page.getByTestId('live-dome').boundingBox();
    expect(dome?.height).toBeGreaterThan(280);
    const follow = await toggle.boundingBox();
    const share = await page.getByRole('button', { name: 'Share this sky' }).boundingBox();
    expect(share?.y).toBeGreaterThan((follow?.y ?? 0) + (follow?.height ?? 0) - 1);
  });
});
