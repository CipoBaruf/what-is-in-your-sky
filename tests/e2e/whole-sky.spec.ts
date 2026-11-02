/**
 * R160 (FR-PHONE-7, FR-PHONE-9, FR-PHONE-10; US-46 AC1, AC3, AC4; PLAN D-970, D-971, D-990..D-992; §9.12): the whole
 * sky on the stars page, on the production build, at 390 × 844 and 1280 × 800 in both languages.
 *
 * - The view row reads `[ Window ] Whole sky` / `[ Ventana ] Cielo entero` on one line between the `h1` block and the
 *   readout; the page opens on the window; `Whole sky` draws the polar chart in the box with the page's layers — the
 *   stars and the figures, each layer off taking its marks off, the names off by default on compact and on on wide —
 *   and with `[ passes ]` on the passes with their keys; `In this field` lists the whole sky's twelve brightest, the
 *   passes first; the polar chart's convention line and its looking-up / map toggle take the readout and the picker
 *   rows; back on the window the camera is where it was, and a reload opens on the window with nothing saved.
 * - The window's field is outlined on the whole sky and moves with injected readings while following
 *   (`stubOrientation`), and with the hand's camera by hand.
 * - A pinch past the window's widest field opens the whole sky, and a pinch on the whole sky returns to the window at
 *   the widest field facing the sky under the pinch's midpoint, within 1° (the error is printed for the Done note);
 *   the pinches are synthetic (`windowZoom.ts`), so they run at both sizes.
 *
 *   npx playwright test whole-sky --project=chromium
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { homeAt, T } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';
import { aimedAt, setReadings, stubOrientation } from './orientation';
import { pinch, pinchPolar, skyUnder } from './windowZoom';

type Locale = 'en' | 'es';
const SIZES = [
  { width: 390, height: 844, touch: true, wide: false },
  { width: 1280, height: 800, touch: false, wide: true },
] as const;
const LOCALES: readonly Locale[] = ['en', 'es'];

const WORDS = {
  en: { window: 'Window', wholeSky: 'Whole sky', viewGroup: 'Chart view', orientationGroup: 'Chart orientation', field: 'In this field', passes: 'passes', stars: 'stars', figures: 'figures', names: 'names', facing: 'Facing' },
  es: { window: 'Ventana', wholeSky: 'Cielo entero', viewGroup: 'Vista del gráfico', orientationGroup: 'Orientación del gráfico', field: 'En este campo', passes: 'pases', stars: 'estrellas', figures: 'figuras', names: 'nombres', facing: 'Mirando' },
} as const;

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

/** A reader with a place and no stored run: the page, its window drawn. */
async function openStars(page: Page, locale: Locale, prefs: Record<string, unknown> = {}, state: 'hand' | 'on' = 'hand'): Promise<Locator> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN, ...prefs })] as [string, string],
  );
  await page.goto('/#stars');
  const layout = page.getByTestId('stars-layout');
  await expect(layout).toBeVisible();
  await expect(windowRoot(page)).toHaveAttribute('data-state', state, { timeout: 15_000 });
  return layout;
}

/**
 * The stars page ten seconds into the golden pass (`liveHelpers.ts`'s `T`, the instant the live specs draw their arcs
 * at), with the 72 h run in, so `[ passes ]` has a pass up: the home at `T` with the whole list, then the hash. The clock
 * is paused there (`homeAt`), so the lazy chunks land as it is run (R32).
 */
async function openStarsWithRun(page: Page, locale: Locale): Promise<Locator> {
  await homeAt(page, T, locale, true);
  await page.evaluate(() => {
    location.hash = '#stars';
  });
  await expect
    .poll(async () => {
      await page.clock.runFor(200);
      return windowRoot(page).count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
  const layout = page.getByTestId('stars-layout');
  await expect(layout).toBeVisible();
  await expect(windowRoot(page)).toHaveAttribute('data-state', 'hand');
  return layout;
}

const windowRoot = (page: Page): Locator => page.getByTestId('stars-sky').locator('[data-look-az][data-fov]');
const chart = (page: Page): Locator => page.getByTestId('sky-chart');
const polar = (page: Page): Locator => page.getByTestId('stars-sky').locator('svg[data-drawing="polar"]');
const viewRow = (page: Page): Locator => page.getByTestId('stars-view-row');
const marks = (page: Page): Locator => polar(page).locator('[data-layer="stars"] [data-star]');
const figures = (page: Page): Locator => polar(page).locator('[data-figures] path');
const names = (page: Page): Locator => polar(page).locator('[data-names] text');
const outline = (page: Page): Locator => polar(page).locator('[data-field-outline]');
/** A layer toggle by its word: its accessible name carries the `[x]` mark Playwright reads off the stylesheet, so the word is matched inside it. */
const layerToggle = (page: Page, name: string): Locator => page.getByTestId('stars-layers').getByRole('button', { name: new RegExp(`${name}$`) });

/** The whole sky chosen from the row, its stars drawn (the polar chart's star group is a lazy chunk; a paused clock is run for it). */
async function chooseWholeSky(page: Page, locale: Locale, paused = false): Promise<void> {
  await viewRow(page).getByRole('button', { name: WORDS[locale].wholeSky }).click();
  await expect(chart(page)).toHaveAttribute('data-view', 'polar');
  await expect(polar(page)).toBeAttached();
  await expect
    .poll(async () => {
      if (paused) await page.clock.runFor(200);
      return marks(page).count();
    }, { timeout: 30_000 })
    .toBeGreaterThan(0);
}

const look = async (w: Locator): Promise<{ az: number; alt: number; fov: number }> => ({ az: Number(await w.getAttribute('data-look-az')), alt: Number(await w.getAttribute('data-look-alt')), fov: Number(await w.getAttribute('data-fov')) });
const azError = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

for (const size of SIZES) {
  for (const locale of LOCALES) {
    test.describe(`the whole sky on the stars page at ${String(size.width)} × ${String(size.height)}, ${locale}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch });

      test('the view row, the whole sky with the layers on and off and the passes, In this field, the camera kept, nothing saved (FR-PHONE-7)', async ({ page }) => {
        const layout = await openStarsWithRun(page, locale);
        const words = WORDS[locale];
        // The row: `[ Window ] Whole sky`, one line, between the answer and the readout; the window pressed.
        const row = viewRow(page);
        await expect(row.getByRole('button')).toHaveText([words.window, words.wholeSky]);
        await expect(row.getByRole('button', { name: words.window })).toHaveAttribute('aria-pressed', 'true');
        const [left, right] = await Promise.all([row.getByRole('button').first().boundingBox(), row.getByRole('button').last().boundingBox()]);
        expect(Math.abs((left?.y ?? 0) - (right?.y ?? 1))).toBeLessThanOrEqual(1);
        const slots = await layout.locator('[data-slot]').evaluateAll((els) => els.map((el) => el.getAttribute('data-slot')));
        expect(slots.indexOf('viewRow')).toBe(slots.indexOf('answer') + 1);
        if (!size.wide) expect(slots.indexOf('readout')).toBe(slots.indexOf('viewRow') + 1);
        await expect(chart(page)).toHaveAttribute('data-view', 'window');

        // Whole sky: the polar chart in the box with the stars and the figures, the names by width.
        await chooseWholeSky(page, locale, true);
        await expect(row.getByRole('button', { name: words.wholeSky })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('stars-sky').locator('[data-drawing="window"]')).toHaveCount(0);
        const drawn = await marks(page).count();
        expect(await figures(page).count()).toBeGreaterThan(0);
        await expect(layerToggle(page, words.names)).toHaveAttribute('aria-pressed', size.wide ? 'true' : 'false');
        if (size.wide) await expect.poll(() => names(page).count()).toBeGreaterThan(0);
        else await expect(names(page)).toHaveCount(0);
        // The polar chart's own rows: the convention line in the readout's place, the looking-up / map toggle in the picker's.
        await expect(layout.locator('[data-slot="readout"]').getByTestId('chart-convention')).toBeVisible();
        await expect(layout.locator('[data-slot="picker"]').getByRole('group', { name: words.orientationGroup })).toBeVisible();
        await expect(layout.getByRole('group', { name: words.facing })).toHaveCount(0);
        // The layers off take their marks off the whole sky; on again, back.
        await layerToggle(page, words.figures).click();
        await expect(figures(page)).toHaveCount(0);
        await layerToggle(page, words.stars).click();
        await expect(marks(page)).toHaveCount(0);
        await layerToggle(page, words.stars).click();
        await layerToggle(page, words.figures).click();
        await expect.poll(() => marks(page).count()).toBe(drawn);
        await page.clock.runFor(200);
        await expect.poll(() => figures(page).count()).toBeGreaterThan(0);
        // `In this field` is the whole sky's twelve brightest; with `[ passes ]` on the passes come first and the arcs carry their keys.
        const list = page.getByRole('list', { name: words.field });
        await expect(list.getByRole('listitem')).toHaveCount(12);
        await layerToggle(page, words.passes).click();
        await expect(polar(page).locator('[data-pass-id]').first()).toBeAttached();
        await expect(polar(page).locator('[data-key="A"]')).toBeAttached();
        await expect(list.locator('[data-kind="pass"]').first()).toBeAttached();
        await expect(list.getByRole('listitem')).toHaveCount(12);
        await expect(list.getByRole('listitem').first().locator('[data-kind="pass"]')).toBeAttached();
        await layerToggle(page, words.passes).click();
        await expect(polar(page).locator('[data-pass-id]')).toHaveCount(0);
        console.log(`[FR-PHONE-7] ${String(size.width)} px ${locale}: ${String(drawn)} stars drawn on the whole sky, ${String(await figures(page).count())} figure paths`);

        // Back to the window: the camera where it was. A reload opens on the window; nothing of the view is saved.
        await row.getByRole('button', { name: words.window }).click();
        await expect(chart(page)).toHaveAttribute('data-view', 'window');
        await page.clock.runFor(200);
        await expect(windowRoot(page)).toHaveAttribute('data-state', 'hand');
        await expect(windowRoot(page)).toHaveAttribute('data-look-az', '180');
        await expect(windowRoot(page)).toHaveAttribute('data-look-alt', '35');
        await chooseWholeSky(page, locale, true);
        expect(await page.evaluate((key) => localStorage.getItem(key) ?? '', PREFS_KEY)).not.toMatch(/polar/);
        expect((JSON.parse(await page.evaluate((key) => localStorage.getItem(key) ?? '{}', PREFS_KEY)) as { chartView?: string }).chartView).toBe('dome');
        await page.reload();
        await expect
          .poll(async () => {
            await page.clock.runFor(200);
            return windowRoot(page).count();
          }, { timeout: 30_000 })
          .toBeGreaterThan(0);
        await expect(windowRoot(page)).toHaveAttribute('data-state', 'hand');
        await expect(chart(page)).toHaveAttribute('data-view', 'window');
      });

      test('a pinch past the widest field opens the whole sky, and a pinch on it returns to the window facing the spot under the fingers within 1° (FR-PHONE-10)', async ({ page }) => {
        await openStars(page, locale);
        const w = windowRoot(page);
        await expect(w).toHaveAttribute('data-fov', '60');
        const box = page.getByTestId('stars-sky').locator('div[data-dragging]');
        // Out past the end by the ratio: from 60°, fingers from 200 px to 100 px ask for 120°, past 103.5°.
        await pinch(box, 200, 100);
        await expect(chart(page)).toHaveAttribute('data-view', 'polar');
        await expect(viewRow(page).getByRole('button', { name: WORDS[locale].wholeSky })).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => marks(page).count(), { timeout: 30_000 }).toBeGreaterThan(0);
        // The window's camera is kept at the end: the whole sky outlines a 90° field facing south, an open run cut at the horizon.
        await expect(outline(page)).toBeAttached();
        const held = (await outline(page).getAttribute('d')) ?? '';
        expect(held).toMatch(/^M/);
        expect(await page.evaluate((key) => localStorage.getItem(key) ?? '', PREFS_KEY)).not.toMatch(/chartView|polar/);

        // In on the whole sky (the fingers spreading) about a point west of the zenith, a third of the way to the horizon: the window at 90° facing it.
        const svg = polar(page);
        const rect = await svg.evaluate((el) => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number });
        const side = Math.min(rect.width, rect.height);
        const at = { x: rect.x + rect.width / 2 + side * 0.13, y: rect.y + rect.height / 2 - side * 0.05 };
        const expected = await skyUnder(svg, at);
        await pinchPolar(svg, 60, 120, at);
        await expect(chart(page)).toHaveAttribute('data-view', 'window');
        await expect(viewRow(page).getByRole('button', { name: WORDS[locale].window })).toHaveAttribute('aria-pressed', 'true');
        await expect(w).toHaveAttribute('data-state', 'hand');
        await expect(w).toHaveAttribute('data-fov', '90');
        const after = await look(w);
        const error = { az: azError(after.az, expected.azDeg), alt: Math.abs(after.alt - expected.altDeg) };
        console.log(`[FR-PHONE-10] ${String(size.width)} px ${locale}: the midpoint at az ${expected.azDeg.toFixed(2)}° alt ${expected.altDeg.toFixed(2)}°, the window facing ${String(after.az)}° ${String(after.alt)}° up at ${String(after.fov)}°: error ${error.az.toFixed(2)}° / ${error.alt.toFixed(2)}°`);
        expect(error.az).toBeLessThanOrEqual(1);
        expect(error.alt).toBeLessThanOrEqual(1);
        // The readout says so; a reload still opens at 60° on the window (nothing of the field or the view is saved).
        await expect(page.getByTestId('window-readout')).toContainText(locale === 'en' ? 'field 90°' : 'campo 90°');
        await page.reload();
        await expect(windowRoot(page)).toHaveAttribute('data-fov', '60');
        await expect(chart(page)).toHaveAttribute('data-view', 'window');
      });

      test('the outline on the whole sky moves with the phone while following, and is the hand’s otherwise (FR-PHONE-9)', async ({ page }) => {
        test.skip(!size.touch, 'following is the touch phone’s (FR-WIN-4); the hand’s outline is the handoff case’s');
        await stubOrientation(page, { answer: 'granted', readings: [aimedAt(90, 30)], request: false });
        await openStars(page, locale, {}, 'on');
        const w = windowRoot(page);
        await expect(w).toHaveAttribute('data-follow', 'true', { timeout: 15_000 });
        await expect.poll(async () => (await look(w)).alt, { timeout: 15_000 }).toBe(30);
        await chooseWholeSky(page, locale);
        // Following goes on under the whole sky: the outline is the sensor's and moves with every reading.
        await expect(chart(page)).toHaveAttribute('data-follow', 'true');
        await expect(page.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'true');
        await expect(outline(page)).toHaveAttribute('data-following', 'true');
        const east = (await outline(page).getAttribute('d')) ?? '';
        expect(east).toMatch(/^M/);
        await setReadings(page, [aimedAt(200, 50)]);
        await expect.poll(() => outline(page).getAttribute('d'), { timeout: 15_000 }).not.toBe(east);
        const south = (await outline(page).getAttribute('d')) ?? '';
        await setReadings(page, [aimedAt(300, 10)]);
        await expect.poll(() => outline(page).getAttribute('d'), { timeout: 15_000 }).not.toBe(south);
        // Following off by the toggle: still the whole sky, the outline the hand's where the phone last pointed, and still.
        await page.getByTestId('follow-toggle').click();
        await expect(chart(page)).not.toHaveAttribute('data-follow', 'true');
        await expect(chart(page)).toHaveAttribute('data-view', 'polar');
        await expect(outline(page)).not.toHaveAttribute('data-following', 'true');
        const still = (await outline(page).getAttribute('d')) ?? '';
        expect(still).toMatch(/^M/);
        await setReadings(page, [aimedAt(45, 60)]);
        await page.waitForTimeout(400);
        expect(await outline(page).getAttribute('d')).toBe(still);
      });
    });
  }
}
