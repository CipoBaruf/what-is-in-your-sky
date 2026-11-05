/**
 * R190 (FR-KEEP-1..4, US-57 AC1–AC4; D-1096, D-1097, D-1105, D-1108): the kept choices on the production build at
 * 390 × 844 and 1280 × 800 — every choice made, a reload and a new tab find it; a moment (the globe's instant, the
 * camera, the globe's place) is not kept; an empty store opens on FR-KEEP-3's table; either privacy `[ × ]` closes the
 * note for good, and the settings page still states it.
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { globeAt, LONDON, openStarsPage, showGlobe } from './globeHelpers';
import { openSheet } from './liveHelpers';
import { DEFAULT_PLAY_SPEED } from '../../src/model';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

const stored = (page: Page): Promise<Record<string, unknown>> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>, PREFS_KEY);
const layer = (page: Page, key: string): Locator => page.getByTestId('stars-layers').locator(`[data-layer="${key}"]`);
const sky = (page: Page): Locator => page.getByTestId('stars-sky');
const windowRoot = (page: Page): Locator => sky(page).locator('[data-look-az]');
const viewButton = (page: Page, name: string): Locator => page.getByTestId('stars-view-row').getByRole('button', { name, exact: true });
// The options' names carry their `[x]` mark, so they are found by value.
const turnButton = (page: Page, value: 'you' | 'stars'): Locator => page.getByTestId('globe-turn-row').locator(`[data-option="${value}"]`);
// v2.14.1 (D-1138, V214-34): the playback row's speeds, found by rate.
const speedButton = (page: Page, speed: number): Locator => page.getByTestId('stars-time').getByTestId('playback-controls').locator(`[data-option="${String(speed)}"]`);

/** The window's box under the hand: the one the keys go to. */
async function windowKey(page: Page, key: string): Promise<void> {
  await windowRoot(page).locator('div[data-dragging]').press(key);
}

/** The globe's `An hour later`: a held instant, under which the playback row shows its speeds. */
async function hourLater(page: Page): Promise<void> {
  await page.getByTestId('globe-steps').getByRole('button', { name: 'An hour later' }).click();
}

/** Where the globe's zenith is drawn: the view's turn, read off the renderer's attributes. */
async function zenith(page: Page): Promise<string> {
  const mark = page.locator('[data-globe] [data-zenith]');
  return [await mark.getAttribute('x'), await mark.getAttribute('y')].join(',');
}

/** The stars page in a second tab of the same profile, the network refused as in the first. */
async function newTab(context: BrowserContext): Promise<Page> {
  const tab = await context.newPage();
  await tab.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await tab.route(pattern, (route) => route.abort('failed'));
  await tab.goto('/#stars');
  await expect(tab.getByTestId('stars-page')).toBeVisible({ timeout: 30_000 });
  return tab;
}

for (const viewport of VIEWPORTS) {
  const wide = viewport.width >= 964;
  test.describe(`kept choices at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('FR-KEEP-3: an empty store opens the stars page on the first visit’s defaults', async ({ page }) => {
      await openStarsPage(page);
      await expect(sky(page)).toHaveAttribute('data-view', wide ? 'globe' : 'window');
      await openSheet(page);
      for (const key of ['stars', 'figures', 'planets', 'names']) await expect(layer(page, key)).toHaveAttribute('aria-pressed', 'true');
      if (wide) {
        await expect(layer(page, 'faint')).toHaveAttribute('aria-pressed', 'false');
        await expect(turnButton(page, 'you')).toHaveAttribute('aria-pressed', 'true');
        // v2.14.1 (V214-34): the playback row marks the stored speed, the default with nothing saved; the page opens paused.
        for (const rate of [1, 60, 600, 3600]) await expect(speedButton(page, rate)).toHaveAttribute('aria-pressed', String(rate === DEFAULT_PLAY_SPEED));
        await expect(page.getByTestId('stars-time')).toHaveAttribute('data-playing', 'false');
      } else {
        await expect(windowRoot(page)).toHaveAttribute('data-fov', '60');
      }
      // D-1096: a value the reader has not chosen is not written.
      const prefs = await stored(page);
      for (const key of ['chartView', 'starLayers', 'namesChoice', 'faintStars', 'globeTurn', 'globeZoom', 'windowFov', 'playSpeed', 'privacyNoteClosed']) expect(prefs[key], key).toBeUndefined();
    });

    test('FR-KEEP-1: every choice is found after a reload and in a new tab', async ({ page, context }) => {
      await openStarsPage(page);
      if (wide) {
        // The window's field first, then back to the globe for its own choices; the globe is the view left.
        await viewButton(page, 'Window').click();
        await expect(windowRoot(page)).toBeAttached({ timeout: 30_000 });
        await windowKey(page, '+');
        await expect(windowRoot(page)).toHaveAttribute('data-fov', '48');
        await showGlobe(page);
        await layer(page, 'figures').click();
        await layer(page, 'names').click();
        await layer(page, 'faint').click();
        await turnButton(page, 'stars').click();
        await page.getByTestId('globe-zoom-in').click();
        await hourLater(page);
        await speedButton(page, 600).click();
        await expect(speedButton(page, 600)).toHaveAttribute('aria-pressed', 'true');
        expect(await stored(page)).toMatchObject({ chartView: 'globe', starLayers: { stars: true, figures: false, planets: true }, namesChoice: false, faintStars: true, globeTurn: 'stars', windowFov: 48, playSpeed: 600 });
        const zoom = (await stored(page))['globeZoom'];
        expect(zoom).toBeGreaterThan(1);
        const radius = await page.locator('[data-globe] [data-disc]').getAttribute('r');
        await page.reload();
        await expect(page.getByTestId('globe-box')).toBeVisible({ timeout: 30_000 });
        await expect(sky(page)).toHaveAttribute('data-view', 'globe');
        await expect(layer(page, 'figures')).toHaveAttribute('aria-pressed', 'false');
        await expect(layer(page, 'names')).toHaveAttribute('aria-pressed', 'false');
        await expect(layer(page, 'faint')).toHaveAttribute('aria-pressed', 'true');
        await expect(turnButton(page, 'stars')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-globe] [data-disc]')).toHaveAttribute('r', radius ?? '');
        // FR-KEEP-2: the page opens at now, watching; the speed is where `play` starts once the instant is held.
        await expect(page.getByTestId('stars-time')).toHaveAttribute('data-state', 'watching');
        // v2.14.1 (FR-WIDE-4 as amended, D-1138): FR-GLOBE-7's speeds press only while playing, so the kept rate is read
        // from the store, and the page opens paused.
        expect((await stored(page))['playSpeed']).toBe(600);
        await expect(speedButton(page, 600)).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('stars-time')).toHaveAttribute('data-playing', 'false');
        await viewButton(page, 'Window').click();
        await expect(windowRoot(page)).toHaveAttribute('data-fov', '48', { timeout: 30_000 });
        await showGlobe(page);
        const tab = await newTab(context);
        await expect(tab.getByTestId('globe-box')).toBeVisible({ timeout: 30_000 });
        await expect(layer(tab, 'figures')).toHaveAttribute('aria-pressed', 'false');
        await expect(turnButton(tab, 'stars')).toHaveAttribute('aria-pressed', 'true');
        return;
      }
      await windowKey(page, '+');
      await expect(windowRoot(page)).toHaveAttribute('data-fov', '48');
      await openSheet(page);
      await layer(page, 'figures').click();
      await layer(page, 'names').click();
      await viewButton(page, 'Whole sky').click();
      await expect(sky(page).locator('[data-drawing="polar"]')).toBeAttached({ timeout: 30_000 });
      expect(await stored(page)).toMatchObject({ chartView: 'polar', starLayers: { stars: true, figures: false, planets: true }, namesChoice: false, windowFov: 48 });
      await page.reload();
      await expect(sky(page).locator('[data-drawing="polar"]')).toBeAttached({ timeout: 30_000 });
      await openSheet(page);
      await expect(layer(page, 'figures')).toHaveAttribute('aria-pressed', 'false');
      await expect(layer(page, 'names')).toHaveAttribute('aria-pressed', 'false');
      await viewButton(page, 'Window').click();
      await expect(windowRoot(page)).toHaveAttribute('data-fov', '48', { timeout: 30_000 });
      const tab = await newTab(context);
      await expect(sky(tab)).toHaveAttribute('data-view', 'window');
      await expect(windowRoot(tab)).toHaveAttribute('data-fov', '48', { timeout: 30_000 });
    });

    test('FR-KEEP-2: a reload opens at now, at the opening aim, at the reader’s own place', async ({ page }) => {
      await openStarsPage(page, { favourites: [LONDON] });
      if (wide) {
        const at = await globeAt(page);
        const aim = await zenith(page);
        await page.getByTestId('globe-steps').getByRole('button', { name: 'An hour later' }).click();
        await expect.poll(() => globeAt(page)).toBeGreaterThan(at);
        await page.getByTestId('globe-box').press('ArrowRight');
        await page.getByTestId('globe-place').getByRole('button', { name: LONDON.label }).click();
        await expect(page.getByTestId('globe-place').getByRole('button', { name: LONDON.label })).toHaveAttribute('aria-pressed', 'true');
        await page.reload();
        await expect(page.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
        expect(await globeAt(page)).toBe(at);
        await expect(page.getByTestId('stars-time')).toHaveAttribute('data-state', 'watching');
        await expect(page.getByTestId('globe-place').getByRole('button', { name: NEUQUEN.label })).toHaveAttribute('aria-pressed', 'true');
        expect(await zenith(page)).toBe(aim);
        return;
      }
      const opening = await windowRoot(page).getAttribute('data-look-az');
      await windowKey(page, 'ArrowRight');
      await expect(windowRoot(page)).not.toHaveAttribute('data-look-az', opening ?? '');
      await page.reload();
      await expect(windowRoot(page)).toHaveAttribute('data-look-az', opening ?? '', { timeout: 30_000 });
    });

    test('FR-KEEP-4: closed on the home, the note is gone from the stars page after a reload, and the settings page still says it', async ({ page }) => {
      await page.clock.setFixedTime(NINE_DAYS_ON);
      for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
      await page.addInitScript(
        ([key, value]: [string, string]) => {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        },
        [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
      );
      await page.goto('/');
      const close = page.getByRole('button', { name: 'Close the privacy note' });
      await expect(close.first()).toBeVisible({ timeout: 30_000 });
      await close.first().click();
      await expect(close).toHaveCount(0);
      await expect(page.getByTestId('privacy-note')).toHaveCount(0);
      expect(await stored(page)).toMatchObject({ privacyNoteClosed: true });
      await page.reload();
      await page.goto('/#stars');
      await expect(page.getByTestId('stars-page')).toBeVisible({ timeout: 30_000 });
      await openSheet(page);
      await expect(page.getByTestId('app-footer')).toBeAttached();
      await expect(page.getByTestId('privacy-note')).toHaveCount(0);
      await expect(page.getByTestId('app-footer')).not.toContainText('No tracking');
      await page.goto('/#settings');
      // D-1129: the settings page’s footer keeps its privacy part plain — the sentence on a phone, the word in the desk’s row.
      await expect(page.getByTestId('settings-privacy')).toHaveText(wide ? '·No tracking' : 'No analytics, no tracking: your location is saved in this browser only.', { timeout: 30_000 });
      await expect(close).toHaveCount(0);
    });
  });
}
