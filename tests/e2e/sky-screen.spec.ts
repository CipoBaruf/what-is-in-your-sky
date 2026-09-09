/**
 * R64 (D-321, D-326) → R66 (FR-FSC-1, FR-FSC-2, FR-FSC-9; US-21 AC11, AC14;
 * V13-6, V13-9) → R73 (FR-FSC-4 as rewritten, FR-FSC-10, FR-FSC-11; US-21 AC12
 * as amended, AC15): the **sky screen** on the production build, opened from
 * the view control on both pages, sideways and upright.
 *
 * The jsdom tests own the layer's contents (`SkyScreen.test.tsx`); what only a
 * browser can answer is here — that the layer really is the viewport, that
 * nothing of the page under it can be hit, that the picture is there in either
 * orientation with no tap and no second permission prompt, that a phone whose
 * rotation is locked gets the wide picture by the layer's own turn, that the
 * `×` gives the page back, and that the same screen opens over a pass detail
 * with its sheet held still under it (FR-FSC-9).
 *
 *   npx playwright test sky-screen --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { domeDrawn, homeAt, openSkyScreen, pose, stripFilled, stubCompass, T, VIEW_GROUP, VIEW_OPTION } from './liveHelpers';

const LANDSCAPE = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };
const CLOSE = 'Close';
/** FR-FSC-11's line (`i18n/en/window.ts`). */
const TURN_ADVICE = 'Turn the phone sideways to see more sky.';

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
  /*
   * R73: readings *after* the layer is up, since the tap's own listener is what the ones before it fed (D-350)
   * and the window's own is armed only once its lazy chunk has mounted — which is a turn of the event loop
   * after the layer, so the poll keeps sending until the readout says a reading arrived. Upright, 20° up.
   */
  await expect
    .poll(async () => {
      await pose(page, { alpha: 90, beta: 110, gamma: 0 });
      return page.getByTestId('window-readout').count();
    }, { timeout: 15_000 })
    .toBe(1);
}

/** The drawing itself: the horizon line, which R73 puts in the box in every orientation. */
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

    // FR-FSC-4 as rewritten / US-21 AC12: the viewport goes upright and the picture stays — the drawing, the
    // readout and the `×` are all still there, with FR-FSC-11's line of advice over them.
    await page.setViewportSize(PORTRAIT);
    await expect(drawn(page)).toHaveCount(1);
    await expect(page.getByTestId('window-turn-note')).toHaveText(TURN_ADVICE);
    await expect(page.getByTestId('window-readout')).toBeVisible();
    await expect(page.getByTestId('sky-screen-close')).toBeVisible();
    await expect(page.getByTestId('window-portrait-note')).toHaveCount(0);
    await page.setViewportSize(LANDSCAPE);
    await expect(drawn(page)).toHaveCount(1);
    await expect(page.getByTestId('window-turn-note')).toHaveCount(0);
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

/**
 * R73 (FR-FSC-4 as rewritten, FR-FSC-9, FR-FSC-10, FR-FSC-11; US-21 AC12 as
 * amended, AC15; D-426, D-430): the phone whose rotation is locked. The
 * viewport is 390 × 844 and stays that way whatever the hand does — which is
 * exactly what a rotation lock is — so the pose is the only thing that knows
 * the reader has turned the phone.
 *
 * On `origin/main` both of these fail: upright the box was a note with no
 * drawing in it, and sideways it was the same note, because the viewport never
 * became landscape.
 */
test.describe('the sky screen on a phone that does not rotate', () => {
  test.use({ viewport: PORTRAIT, hasTouch: true });

  test('draws upright with the advice, and turns its own layer when the phone is held sideways (FR-FSC-10, FR-FSC-11)', async ({ page }) => {
    await stubCompass(page);
    await countPermissionAsks(page);
    await livePage(page);
    await openScreen(page);
    const layer = page.getByTestId('sky-screen');
    const box = page.getByTestId('chart-box');

    // Upright: the picture is in the portrait box, with one line of advice over it and nothing waiting on it.
    await expect(layer).toHaveAttribute('data-turn', '0');
    await expect(drawn(page)).toHaveCount(1);
    await expect(page.getByTestId('window-turn-note')).toHaveText(TURN_ADVICE);
    await expect(page.getByTestId('window-readout')).toBeVisible();
    expect(await box.evaluate((element) => element.clientHeight > element.clientWidth)).toBe(true);

    // Held sideways, its top to the reader's left. The viewport never reflows, so the layer turns instead.
    await pose(page, { beta: 0, gamma: -90 });
    await expect(layer).toHaveAttribute('data-turn', '90');
    // The picture is landscape inside a portrait viewport: the window measures the layer's layout box, which
    // a quarter turn takes with its two sides swapped (D-426), so `WINDOW_FOV` lands across the reader's wide side.
    expect(await box.evaluate((element) => element.clientWidth > element.clientHeight)).toBe(true);
    const viewBox = await page.locator('[data-drawing="window"]').getAttribute('viewBox');
    const [, , width, height] = (viewBox ?? '0 0 0 0').split(' ').map(Number);
    expect(width).toBeGreaterThan(height ?? 0);
    await expect(drawn(page)).toHaveCount(1);
    // FR-FSC-11: the picture the reader is looking at is wide now, so the advice has gone.
    await expect(page.getByTestId('window-turn-note')).toHaveCount(0);
    // FR-FSC-9: still nothing scrolls — the turned layer covers the viewport exactly and no more.
    const scroll = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, inner: window.innerHeight, width: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
    expect(scroll.height).toBe(scroll.inner);
    expect(scroll.width).toBe(scroll.innerWidth);
    const layerBox = await layer.boundingBox();
    expect(layerBox?.width).toBeCloseTo(scroll.innerWidth, 0);
    expect(layerBox?.height).toBeCloseTo(scroll.inner, 0);

    // Back upright, with no tap and no second permission prompt (FR-FOL-2).
    await pose(page, { beta: 110, gamma: 0 });
    await expect(layer).toHaveAttribute('data-turn', '0');
    await expect(page.getByTestId('window-turn-note')).toHaveText(TURN_ADVICE);
    expect(await asks(page)).toBe(1);
  });
});
