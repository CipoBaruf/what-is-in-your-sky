/**
 * R64 (FR-FSC-1, FR-FSC-2, FR-FSC-4, FR-FOL-1; US-21 AC11, AC12; D-321, D-326):
 * the follow screen on the production build, on a phone held sideways.
 *
 * The jsdom tests own the layer's contents (`FollowScreen.test.tsx`); what only
 * a browser can answer is here — that the layer really is the viewport, that
 * nothing of the page under it can be hit, that turning the phone swaps the
 * drawing for the note and back with no tap and no second permission prompt,
 * and that the `×` gives the live page back.
 *
 *   npx playwright test follow-screen --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, heading, homeAt, stripFilled, stubCompass, T } from './liveHelpers';

const LANDSCAPE = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };
const FOLLOW = 'Follow phone';
const CLOSE = 'Close';

declare global {
  interface Window {
    __permissionAsks: number;
  }
}

/**
 * iOS's `requestPermission`, granting and counting. FR-FOL-2 puts the request
 * in the tap on the control and nowhere else, and FR-FSC-4's turn of the phone
 * must not be a second one — the window's own hook asks through the same
 * memoised `requestOrientationAccess`, so what is counted here is the browser's
 * call and not the app's (R63's reading of "asked once").
 */
async function countPermissionAsks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__permissionAsks = 0;
    const ctor = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    ctor.requestPermission = () => {
      window.__permissionAsks += 1;
      return Promise.resolve('granted');
    };
  });
}

const asks = (page: Page): Promise<number> => page.evaluate(() => window.__permissionAsks);

/** The live page, drawn and settled, on a landscape phone. */
async function livePage(page: Page): Promise<void> {
  await homeAt(page, T, 'en');
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

/**
 * The press, and then readings until the screen is up: the press arms the
 * sensor and the *first reading with a north in it* is what opens anything
 * (D-276), and the permission answer it waits for lands between the two.
 */
async function openScreen(page: Page): Promise<void> {
  await page.getByRole('button', { name: FOLLOW }).click();
  await expect
    .poll(
      async () => {
        await heading(page, 270);
        return page.getByTestId('follow-screen').count();
      },
      { timeout: 15_000 },
    )
    .toBe(1);
  // The paused clock holds the lazy chunk's Suspense reveal (R32).
  await page.clock.runFor(1000);
  await expect(drawn(page)).toHaveCount(1);
}

/** The drawing itself: the horizon line is in the box in every landscape state and in none of the portrait one. */
const drawn = (page: Page) => page.locator('[data-drawing="window"] [data-horizon]');

test.describe('the follow screen on a phone held sideways', () => {
  test.use({ viewport: LANDSCAPE, hasTouch: true });

  test('covers the viewport, cannot be seen past, turns with the phone, and the × gives the page back (FR-FSC-1, FR-FSC-2, FR-FSC-4)', async ({ page }) => {
    await stubCompass(page);
    await countPermissionAsks(page);
    await livePage(page);
    await expect(page.getByTestId('stripe-block')).toBeVisible();
    expect(await asks(page)).toBe(0);

    await openScreen(page);
    expect(await asks(page)).toBe(1);

    // FR-FSC-1: the layer is the whole visual viewport — no page padding, no header, nothing beside it.
    const box = await page.getByTestId('follow-screen').boundingBox();
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    expect(box?.width).toBeCloseTo(viewport.width, 0);
    expect(box?.height).toBeCloseTo(viewport.height, 0);
    expect(box?.x).toBeCloseTo(0, 0);
    expect(box?.y).toBeCloseTo(0, 0);

    // The page's one-row header is under it and not reachable: what is at its middle is the layer, not the row.
    const reachable = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="live-top-row"]');
      if (!row) return 'no row';
      const rect = row.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit === null ? 'nothing' : row.contains(hit) ? 'the header' : (document.querySelector('[data-testid="follow-screen"]')?.contains(hit) ?? false) ? 'the layer' : 'something else';
    });
    expect(reachable).toBe('the layer');
    // …and it is out of the keyboard's way as well as the finger's (D-321).
    await expect(page.getByTestId('live-top-row')).toHaveAttribute('aria-hidden', 'true');
    // None of the page's rows is rendered at all.
    for (const testid of ['live-side', 'stripe-block', 'playback-row', 'live-actions']) await expect(page.getByTestId(testid)).toHaveCount(0);

    // FR-FSC-4 / US-21 AC12: held upright the screen is the note; turning it back brings the drawing with no tap.
    await page.setViewportSize(PORTRAIT);
    await expect(page.getByTestId('window-portrait-note')).toBeVisible();
    // The note is the whole box: nothing of the sky is drawn under it, and the readout and the legend are gone.
    await expect(drawn(page)).toHaveCount(0);
    await expect(page.getByTestId('window-readout')).toHaveCount(0);
    await expect(page.getByTestId('chart-legend')).toHaveCount(0);
    await expect(page.getByTestId('follow-close')).toBeVisible();
    await page.setViewportSize(LANDSCAPE);
    await expect(drawn(page)).toHaveCount(1);
    await expect(page.getByTestId('window-portrait-note')).toHaveCount(0);
    // No second prompt for the turn (FR-FOL-2: the request is the tap on the control and nothing else).
    expect(await asks(page)).toBe(1);

    // FR-FSC-2: the `×` is the second press — the live page comes back as it was.
    await page.getByRole('button', { name: CLOSE }).click();
    await expect(page.getByTestId('follow-screen')).toHaveCount(0);
    await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
    await expect(page.getByTestId('stripe-block')).toBeVisible();
    await expect(page.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('live-top-row')).not.toHaveAttribute('aria-hidden', 'true');
    expect(await asks(page)).toBe(1);
  });
});
