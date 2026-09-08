/**
 * R64 (D-321, D-326) → R66 (FR-FSC-1, FR-FSC-2, FR-FSC-4, FR-FSC-9; US-21 AC11,
 * AC12, AC14; V13-6, V13-9): the **sky screen** on the production build, on a
 * phone held sideways, opened from the view control on both pages.
 *
 * The jsdom tests own the layer's contents (`SkyScreen.test.tsx`); what only a
 * browser can answer is here — that the layer really is the viewport, that
 * nothing of the page under it can be hit, that turning the phone swaps the
 * drawing for the note and back with no tap and no second permission prompt,
 * that the `×` gives the page back, and that the same screen opens over a pass
 * detail with its sheet held still under it (FR-FSC-9).
 *
 *   npx playwright test sky-screen --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, homeAt, openSkyScreen, stripFilled, stubCompass, T, VIEW_GROUP, VIEW_OPTION } from './liveHelpers';

const LANDSCAPE = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };
const CLOSE = 'Close';

declare global {
  interface Window {
    __permissionAsks: number;
  }
}

/**
 * iOS's `requestPermission`, granting and counting. FR-WIN-4 puts the request
 * in the tap that chooses the view and nowhere else, and FR-FSC-4's turn of the
 * phone must not be a second one — the window's own hook asks through the same
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
 * The tap, and then readings until the screen is up: the tap arms the sensor
 * and the *first reading with a north in it* is what opens anything (D-350),
 * and the permission answer it waits for lands between the two.
 */
async function openScreen(page: Page): Promise<void> {
  await openSkyScreen(page);
  await expect(drawn(page)).toHaveCount(1);
}

/** The drawing itself: the horizon line is in the box in every landscape state and in none of the portrait one. */
const drawn = (page: Page) => page.locator('[data-drawing="window"] [data-horizon]');

test.describe('the sky screen on a phone held sideways', () => {
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
    const box = await page.getByTestId('sky-screen').boundingBox();
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
      return hit === null ? 'nothing' : row.contains(hit) ? 'the header' : (document.querySelector('[data-testid="sky-screen"]')?.contains(hit) ?? false) ? 'the layer' : 'something else';
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
    await expect(page.getByTestId('sky-screen-close')).toBeVisible();
    await page.setViewportSize(LANDSCAPE);
    await expect(drawn(page)).toHaveCount(1);
    await expect(page.getByTestId('window-portrait-note')).toHaveCount(0);
    // No second prompt for the turn (FR-FOL-2: the request is the tap on the control and nothing else).
    expect(await asks(page)).toBe(1);

    // FR-FSC-2: the `×` is the way out — the live page comes back as it was, on the view it had.
    await page.getByRole('button', { name: CLOSE }).click();
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'dome');
    await expect(page.getByTestId('stripe-block')).toBeVisible();
    await expect(page.getByTestId('live-top-row')).not.toHaveAttribute('aria-hidden', 'true');
    // FR-FSC-2 (D-351): focus is back on the option that opened it.
    await expect(page.getByRole('group', { name: VIEW_GROUP.en }).getByRole('button', { name: VIEW_OPTION.en.window })).toBeFocused();
    expect(await asks(page)).toBe(1);
    // Nothing was written: the window is a mode, not a saved view (FR-WIN-5 as amended v1.3.1).
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('wiys:prefs:v1') ?? '{}')) as { chartView?: string }).not.toMatchObject({ chartView: 'window' });
  });

  /**
   * V13-9 / FR-FSC-9 (US-21 AC14): the same screen over a pass detail. The
   * sheet is the app's one scrolling container, so what a browser has to answer
   * is that it is held still under the layer and comes back where it was.
   */
  test('opens over a pass detail, holds its sheet still, and the × gives the guide back (US-21 AC14, FR-FSC-9)', async ({ page }) => {
    await stubCompass(page);
    await countPermissionAsks(page);
    await homeAt(page, T, 'en', true);
    const card = page.locator('article[data-pass-id]').first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    await card.getByRole('button', { name: /Open guide/ }).click();
    const sheet = page.getByRole('dialog').first();
    await expect(sheet).toBeVisible();
    await sheet.evaluate((element) => {
      element.scrollTop = 80;
    });

    await openSkyScreen(page, 'en', sheet);
    const layer = page.getByTestId('sky-screen');
    // FR-FSC-1: the layer is the viewport, and nothing of the guide is on it.
    const box = await layer.boundingBox();
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    expect(box?.width).toBeCloseTo(viewport.width, 0);
    expect(box?.height).toBeCloseTo(viewport.height, 0);
    await expect(layer.getByTestId('guide-sentence')).toHaveCount(0);
    await expect(layer.getByTestId('pass-numbers')).toHaveCount(0);
    // FR-FSC-9: the layer itself does not scroll, and the sheet under it is held still.
    expect(await layer.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    expect(await sheet.evaluate((element) => getComputedStyle(element).overflow)).toBe('hidden');
    expect(await sheet.evaluate((element) => element.hasAttribute('inert'))).toBe(true);

    await page.getByRole('button', { name: CLOSE }).click();
    await expect(page.getByTestId('sky-screen')).toHaveCount(0);
    await expect(sheet).toBeVisible();
    // The guide comes back where it was and not at the top: the exact number is `PassDetail.test.tsx`'s,
    // where the timing is controlled; what a browser adds is that the sheet is scrolled at all after the close.
    expect(await sheet.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(sheet.getByRole('group', { name: VIEW_GROUP.en }).getByRole('button', { name: VIEW_OPTION.en.window })).toBeFocused();
    expect(await asks(page)).toBe(1);
  });
});
