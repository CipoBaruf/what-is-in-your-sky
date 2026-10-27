/**
 * R117 (FR-STAR-5; FR-FSC-1 as amended v2.4, FR-FSC-2, FR-FSC-9, FR-FSC-10,
 * FR-FOL-5, FR-WIN-3, FR-WIN-4; US-38 AC1, AC2; D-756, D-757): the sky
 * screen's **stars inventory** on the production build, opened from `#stars`
 * by `[ hold up to the sky ]` under a mocked orientation.
 *
 * The jsdom tests own what the layer is handed (`SkyScreen.stars.test.tsx`);
 * what only a browser can answer is here — that the tap asks once and opens
 * the layer over the whole viewport, that the stars turn with the phone round
 * the horizon and past the zenith with no reset, that pointing at the ground
 * says so, that a rotation-locked phone held sideways turns the layer, that
 * the `×` and `Esc` give the page back (and `Esc` does not leave it), and that
 * the readout carries its true-north line (D-757).
 *
 *   npx playwright test stars-screen --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { heading, homeAt, pose, stubCompass, T } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const LANDSCAPE = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 };
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const HOLD_UP = 'hold up to the sky';
const CLOSE = 'Close';
const GROUND = 'Pointing at the ground — raise the phone.';
const BURIED = 'You are pointing at the ground — raise the phone.';
const DENIED = /^Motion access was refused/;

declare global {
  interface Window {
    __permissionAsks: number;
  }
}

/** iOS's `requestPermission`, answering `answer` and counting the browser's calls (FR-WIN-4: the tap and nothing else). */
async function permission(page: Page, answer: 'granted' | 'denied' = 'granted'): Promise<void> {
  await page.addInitScript((value) => {
    window.__permissionAsks = 0;
    const ctor = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    ctor.requestPermission = () => {
      window.__permissionAsks += 1;
      return Promise.resolve(value);
    };
  }, answer);
}

const asks = (page: Page): Promise<number> => page.evaluate(() => window.__permissionAsks);

/** A reader with a saved place, every provider refused, on a held clock at the fixture's instant (FR-STAR-8). */
async function starsPage(page: Page): Promise<void> {
  // Installed a minute early: `pauseAt` the same instant fails once a loaded machine has let the clock run past it.
  await page.clock.install({ time: NINE_DAYS_ON - 60_000 });
  await page.clock.pauseAt(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript((prefs: string) => {
    if (localStorage.getItem('wiys:prefs:v1') === null) localStorage.setItem('wiys:prefs:v1', prefs);
  }, JSON.stringify({ locale: 'en', observer: NEUQUEN }));
  await page.goto('/#stars');
  // The paused clock holds React's lazy reveal of the page's chunk and the window's (R32): run it until both are in.
  await expect
    .poll(async () => {
      await page.clock.runFor(500);
      return page.getByTestId('stars-sky').locator('[data-drawing="window"]').count();
    }, { timeout: 15_000 })
    .toBe(1);
}

const layer = (page: Page) => page.getByTestId('sky-screen');
const screenWindow = (page: Page) => layer(page).locator('[data-look-az]');

/** Where the phone's back points, `azDeg` round from north and `altDeg` up, as one absolute reading. */
const look = (page: Page, azDeg: number, altDeg: number): Promise<void> => pose(page, { alpha: (360 - azDeg) % 360, beta: 90 + altDeg, gamma: 0 });

/** The tap, then readings until the layer is up and the window's own listener has had one (D-350, R73). */
async function holdUp(page: Page): Promise<void> {
  await page.getByRole('button', { name: HOLD_UP }).click();
  await expect
    .poll(
      async () => {
        await heading(page, 270);
        return layer(page).count();
      },
      { timeout: 15_000 },
    )
    .toBe(1);
  // The paused clock holds the lazy chunk's Suspense reveal (R32).
  await page.clock.runFor(1000);
  await expect
    .poll(
      async () => {
        await look(page, 180, 30);
        return layer(page).getByTestId('window-readout').count();
      },
      { timeout: 15_000 },
    )
    .toBe(1);
}

test.describe('the stars screen on a phone held sideways (US-38 AC1, AC2)', () => {
  test.use({ viewport: LANDSCAPE, hasTouch: true });

  test('opens from [ hold up to the sky ] over the whole viewport, with the stars, the ×, the readout and its true-north line, the gutter, and no pass', async ({ page }) => {
    await stubCompass(page);
    await permission(page);
    await starsPage(page);
    // FR-WIN-4: offered where the sensor is, and nothing asked on load.
    await expect(page.getByRole('button', { name: HOLD_UP })).toBeVisible();
    expect(await asks(page)).toBe(0);

    await holdUp(page);
    expect(await asks(page)).toBe(1);
    await expect(layer(page)).toHaveAttribute('data-inventory', 'stars');

    // FR-FSC-1: the layer is the whole visual viewport, and what is under its middle is the layer.
    const box = await layer(page).boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0 });
    expect(box?.width).toBeCloseTo(LANDSCAPE.width, 0);
    expect(box?.height).toBeCloseTo(LANDSCAPE.height, 0);
    const hit = await page.evaluate(() => {
      const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return document.querySelector('[data-testid="sky-screen"]')?.contains(target) ?? false;
    });
    expect(hit).toBe(true);

    // The four things: the window with the page's star field in it, the `×`, the readout, the gutter's band and bracket.
    await expect(layer(page).locator('[data-drawing="window"] [data-layer="stars"]')).toHaveCount(1);
    await expect(layer(page).locator('[data-drawing="window"] [data-star]:not([visibility="hidden"])').first()).toBeAttached();
    await expect(layer(page).getByRole('button', { name: CLOSE })).toBeVisible();
    await expect(layer(page).getByTestId('compass-gutter')).toBeVisible();
    await expect(layer(page).getByTestId('gutter-bracket')).toBeAttached();
    // No pass: no arc, no tick, no chip, no list.
    await expect(layer(page).locator('[data-pass-id]')).toHaveCount(0);
    await expect(layer(page).locator('[data-gutter-mark]')).toHaveCount(0);
    await expect(layer(page).getByTestId('window-chip')).toBeHidden();
    await expect(layer(page).getByTestId('chart-legend')).toHaveCount(0);

    // D-757 / FR-WIN-3: the sensor's readout, with the correction to true north named under it.
    const readout = layer(page).getByTestId('window-readout');
    await expect(readout).toBeVisible();
    await expect(readout).toContainText(/Facing S(SW|SE)? \(\d+°\) · up \d+°/);
    await expect(layer(page).getByTestId('window-heading')).toHaveText(/^true north, declination [+−]\d+\.\d°$/);
    const declination = Number(await layer(page).getByTestId('window-heading').getAttribute('data-declination'));
    expect(Math.abs(declination)).toBeGreaterThan(0);
    expect(Math.abs(declination)).toBeLessThan(30);
  });

  test('turns with the phone round the horizon and past the zenith with no reset, and says when it points at the ground (US-38 AC2, FR-FOL-5)', async ({ page }) => {
    await stubCompass(page);
    await permission(page);
    await starsPage(page);
    await holdUp(page);

    // Round the horizon: the window's facing follows each reading, the star field is the same nodes throughout.
    const field = layer(page).locator('[data-drawing="window"] [data-layer="stars"]');
    const handle = await field.elementHandle();
    const facings: number[] = [];
    for (const az of [180, 225, 270, 315, 0, 45, 90]) {
      await look(page, az, 30);
      facings.push(Number(await screenWindow(page).getAttribute('data-look-az')));
    }
    // Each step moved the facing the same way round, by about the step (no jump back, no reset to the opening one).
    for (let i = 1; i < facings.length; i += 1) {
      const step = ((((facings[i] ?? 0) - (facings[i - 1] ?? 0)) % 360) + 360) % 360;
      expect(step, `${String(facings[i - 1])} → ${String(facings[i])}`).toBeGreaterThan(30);
      expect(step).toBeLessThan(60);
    }
    // Past the zenith and behind: up to 80°, then over the top to the other side, the altitude passing through 90.
    await look(page, 90, 80);
    expect(Number(await screenWindow(page).getAttribute('data-look-alt'))).toBeGreaterThan(70);
    const before = Number(await screenWindow(page).getAttribute('data-look-az'));
    // On over the top: the phone tipped 10° past straight up (`beta` 190, written −170) looks 80° up the other side.
    await pose(page, { alpha: 270, beta: -170, gamma: 0 });
    expect(Number(await screenWindow(page).getAttribute('data-look-alt'))).toBeGreaterThan(70);
    const after = Number(await screenWindow(page).getAttribute('data-look-az'));
    expect(Math.abs(((((after - before) % 360) + 360) % 360) - 180)).toBeLessThan(20);
    // The field was never remounted (D-751: its nodes exist once).
    expect(await field.evaluate((node, before) => node === before, handle)).toBe(true);
    await expect(layer(page).getByTestId('window-ground-note')).toHaveCount(0);

    // FR-FOL-5: below the horizon, the note; all the way down, the box is ground and the note is all there is.
    await look(page, 180, -20);
    await expect(layer(page).getByTestId('window-ground-note')).toHaveText(GROUND);
    await expect(screenWindow(page)).toHaveAttribute('data-ground', 'ground');
    await look(page, 180, -70);
    await expect(layer(page).getByTestId('window-ground-note')).toHaveText(BURIED);
    await expect(screenWindow(page)).toHaveAttribute('data-ground', 'buried');
    // And raised again, the stars are back with no tap.
    await look(page, 180, 30);
    await expect(layer(page).getByTestId('window-ground-note')).toHaveCount(0);
    await expect(screenWindow(page)).toHaveAttribute('data-ground', 'sky');
    expect(await asks(page)).toBe(1);
  });

  test('the × and Esc give the page back as it was, focus on the control, and Esc does not leave #stars (FR-FSC-2)', async ({ page }) => {
    await stubCompass(page);
    await permission(page);
    await starsPage(page);
    await page.getByRole('group', { name: 'Facing' }).getByRole('button', { name: 'NE' }).click();
    const was = { az: await page.getByTestId('stars-page').getAttribute('data-look-az'), alt: await page.getByTestId('stars-page').getAttribute('data-look-alt') };

    await holdUp(page);
    await layer(page).getByRole('button', { name: CLOSE }).click();
    await expect(layer(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: HOLD_UP })).toBeFocused();
    await expect(page.getByTestId('stars-page')).toHaveAttribute('data-look-az', was.az ?? '');
    await expect(page.getByTestId('stars-page')).toHaveAttribute('data-look-alt', was.alt ?? '');

    // A second open asks nothing new of the browser beyond its own tap, and Esc closes it and stays on the page.
    await holdUp(page);
    await page.keyboard.press('Escape');
    await expect(layer(page)).toHaveCount(0);
    await expect(page).toHaveURL(/#stars$/);
    await expect(page.getByTestId('stars-page')).toBeVisible();
    await expect(page.getByRole('button', { name: HOLD_UP })).toBeFocused();
    // The window is a mode, never a saved view (FR-WIN-5).
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('wiys:prefs:v1') ?? '{}')) as { chartView?: string }).not.toMatchObject({ chartView: 'window' });
  });

  test('a denial leaves the page as it was with the note beside the control (FR-FOL-2)', async ({ page }) => {
    await stubCompass(page);
    await permission(page, 'denied');
    await starsPage(page);
    await page.getByRole('button', { name: HOLD_UP }).click();
    await expect(page.getByTestId('stars-hold-up-note')).toHaveText(DENIED);
    await expect(layer(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: HOLD_UP })).toBeVisible();
    expect(await asks(page)).toBe(1);
  });
});

test.describe('the stars screen on a phone that does not rotate (FR-FSC-10)', () => {
  test.use({ viewport: PORTRAIT, hasTouch: true });

  test('turns its own layer when the phone is held sideways, and covers the viewport exactly', async ({ page }) => {
    await stubCompass(page);
    await permission(page);
    await starsPage(page);
    await holdUp(page);
    await expect(layer(page)).toHaveAttribute('data-turn', '0');
    await pose(page, { beta: 0, gamma: -90 });
    await expect(layer(page)).toHaveAttribute('data-turn', '90');
    const viewBox = await layer(page).locator('[data-drawing="window"]').getAttribute('viewBox');
    const [, , width, height] = (viewBox ?? '0 0 0 0').split(' ').map(Number);
    expect(width).toBeGreaterThan(height ?? 0);
    // FR-FSC-9: nothing scrolls, the page under it included — the compact page is taller than the viewport, and held still.
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await page.clock.runFor(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
    await pose(page, { beta: 110, gamma: 0 });
    await expect(layer(page)).toHaveAttribute('data-turn', '0');
    expect(await asks(page)).toBe(1);
  });
});

/**
 * R126 (FR-SKY-6, FR-FSC-1 as amended v2.5; US-40 AC5; D-794): `[ passes ]` on the stars page. The reader comes
 * from the home screen with the fixture's run on it (the ISS up at `T`), so the store holds tonight's passes for
 * this place; the page's toggle brings them onto its sky, into `In this field`, and onto the screen it opens,
 * which is then the live page's screen with the stars on: the arcs and the gutter's ticks.
 */
test.describe('[ passes ] on the stars page (FR-SKY-6, US-40 AC5)', () => {
  test.use({ viewport: LANDSCAPE, hasTouch: true });
  const PASSES = 'passes';

  test('brings tonight’s passes onto the sky, the list and the screen, which draws their ticks', async ({ page }) => {
    await stubCompass(page);
    await permission(page);
    await homeAt(page, T, 'en');
    await page.evaluate(() => {
      window.location.hash = '#stars';
    });
    await expect
      .poll(async () => {
        await page.clock.runFor(500);
        return page.getByTestId('stars-sky').locator('[data-drawing="window"]').count();
      }, { timeout: 15_000 })
      .toBe(1);

    // Off on every open: no arc on the page's sky.
    const toggle = page.getByTestId('stars-layers').getByRole('button', { name: PASSES });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('stars-sky').locator('[data-pass-id]')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('stars-sky').locator('[data-pass-id]').first()).toBeAttached();

    // `In this field` lists a pass ahead of the stars wherever the camera faces its arc: one of the eight points does.
    const picker = page.getByRole('group', { name: 'Facing' });
    /*
     * The list reads the camera deferred (`useDeferredValue`), so a loaded machine may show the last point's field for
     * a step or two of the paused clock: the list is read in one snapshot, and the walk stops at the first field with
     * a pass in it, where the pass must be the first row.
     */
    const snapshot = () =>
      page.getByTestId('field-list').evaluate((list) => ({
        passes: list.querySelectorAll('[data-kind="pass"]').length,
        firstIsPass: list.querySelector('li')?.querySelector('[data-kind="pass"]') != null,
        first: list.querySelector('li')?.textContent ?? '',
      }));
    let seen: Awaited<ReturnType<typeof snapshot>> | null = null;
    for (const point of ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']) {
      await picker.getByRole('button', { name: point, exact: true }).click();
      for (let step = 0; step < 10 && seen === null; step += 1) {
        await page.clock.runFor(100);
        const now = await snapshot();
        if (now.passes > 0) seen = now;
      }
      if (seen !== null) break;
    }
    expect(seen?.firstIsPass).toBe(true);
    expect(seen?.first).toMatch(/^[A-Z]: .+ · (up|soon|gone) · peaks \d+° up · [NESW]{1,3}/);

    // The screen is the live page's with the stars on: the stars, the arcs and the gutter's ticks.
    await holdUp(page);
    await expect(layer(page)).toHaveAttribute('data-inventory', 'stars');
    await expect(layer(page).locator('[data-drawing="window"] [data-layer="stars"]')).toHaveCount(1);
    await expect(layer(page).locator('[data-drawing="window"] [data-pass-id]').first()).toBeAttached();
    expect(await layer(page).locator('[data-gutter-mark]').count()).toBeGreaterThan(0);
  });
});

test.describe('the stars page on a desk', () => {
  test.use({ viewport: DESK });

  test('offers no [ hold up to the sky ]: the presence test governs the sensor, not the view (FR-WIN-4 as amended)', async ({ page }) => {
    await starsPage(page);
    await expect(page.getByTestId('stars-sky').locator('[data-drawing="window"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: HOLD_UP })).toHaveCount(0);
  });
});
