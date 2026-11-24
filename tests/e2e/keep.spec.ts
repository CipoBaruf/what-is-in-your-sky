/**
 * R190 (FR-KEEP-1..4, US-57 AC1–AC4; D-1096, D-1097, D-1105, D-1108): the kept choices on the production build at
 * 390 × 844 and 1280 × 800 — every choice made, a reload and a new tab find it; a moment (the camera) is not kept; an
 * empty store opens on FR-KEEP-3's table; D-1150: no page carries a privacy note, in either language.
 * R222 (FR-LAND-3, D-1240): the stars' choices — the layers, `Turn`, the globe's zoom, the window's field — are made on
 * the live page now; the stars page's own clock and `Place` group went with it.
 */
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { openLiveSky, showGlobe } from './globeHelpers';
import { openSheet, stubNetwork } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

const stored = (page: Page): Promise<Record<string, unknown>> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>, PREFS_KEY);
const layer = (page: Page, key: string): Locator => page.getByTestId('live-layers').locator(`[data-layer="${key}"]`);
const sky = (page: Page): Locator => page.getByTestId('sky-chart');
const windowRoot = (page: Page): Locator => sky(page).locator('[data-look-az]');
const viewButton = (page: Page, name: string): Locator => page.getByTestId('live-layout').getByRole('group', { name: 'Chart view' }).getByRole('button', { name, exact: true });
// The options are found by value, whatever the language's word.
const turnButton = (page: Page, value: 'you' | 'stars'): Locator => page.getByTestId('globe-turn-row').locator(`[data-option="${value}"]`);

/** The window's box under the hand: the one the keys go to. */
async function windowKey(page: Page, key: string): Promise<void> {
  await windowRoot(page).locator('div[data-dragging]').press(key);
}

/** Where the globe's zenith is drawn: the view's turn, read off the renderer's attributes. */
async function zenith(page: Page): Promise<string> {
  const mark = page.locator('[data-globe] [data-zenith]');
  return [await mark.getAttribute('x'), await mark.getAttribute('y')].join(',');
}

/** The live page in a second tab of the same profile (the stored run is the profile's), the network stubbed as in the first. */
async function newTab(context: BrowserContext): Promise<Page> {
  const tab = await context.newPage();
  await tab.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(tab);
  await tab.goto('/#live');
  await expect(tab.getByTestId('live-page')).toBeVisible({ timeout: 30_000 });
  return tab;
}

for (const viewport of VIEWPORTS) {
  const wide = viewport.width >= 964;
  test.describe(`kept choices at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('FR-KEEP-3: an empty store opens the live page’s sky on the first visit’s defaults', async ({ page }) => {
      await openLiveSky(page);
      await expect(sky(page)).toHaveAttribute('data-view', wide ? 'globe' : 'window');
      if (!wide) await openSheet(page);
      for (const key of ['stars', 'figures', 'planets', 'names']) await expect(layer(page, key)).toHaveAttribute('aria-pressed', 'true');
      if (wide) {
        await expect(layer(page, 'faint')).toHaveAttribute('aria-pressed', 'false');
        await expect(turnButton(page, 'you')).toHaveAttribute('aria-pressed', 'true');
      } else {
        await expect(windowRoot(page)).toHaveAttribute('data-fov', '60');
      }
      // D-1096: a value the reader has not chosen is not written.
      const prefs = await stored(page);
      for (const key of ['chartView', 'starLayers', 'namesChoice', 'faintStars', 'globeTurn', 'globeZoom', 'windowFov', 'playSpeed']) expect(prefs[key], key).toBeUndefined();
    });

    test('FR-KEEP-1: every choice is found after a reload and in a new tab', async ({ page, context }) => {
      await openLiveSky(page);
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
        await page.getByRole('button', { name: 'Zoom in' }).click();
        expect(await stored(page)).toMatchObject({ chartView: 'globe', starLayers: { stars: true, figures: false, planets: true }, namesChoice: false, faintStars: true, globeTurn: 'stars', windowFov: 48 });
        expect((await stored(page))['globeZoom']).toBeGreaterThan(1);
        const radius = await page.locator('[data-globe] [data-disc]').getAttribute('r');
        await page.reload();
        await expect(page.getByTestId('globe-box')).toBeVisible({ timeout: 30_000 });
        await expect(sky(page)).toHaveAttribute('data-view', 'globe');
        await expect(layer(page, 'figures')).toHaveAttribute('aria-pressed', 'false');
        await expect(layer(page, 'names')).toHaveAttribute('aria-pressed', 'false');
        await expect(layer(page, 'faint')).toHaveAttribute('aria-pressed', 'true');
        await expect(turnButton(page, 'stars')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-globe] [data-disc]')).toHaveAttribute('r', radius ?? '');
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
      expect(await stored(page)).toMatchObject({ starLayers: { stars: true, figures: false, planets: true }, namesChoice: false, windowFov: 48 });
      await page.reload();
      await expect(windowRoot(page)).toHaveAttribute('data-fov', '48', { timeout: 30_000 });
      await openSheet(page);
      await expect(layer(page, 'figures')).toHaveAttribute('aria-pressed', 'false');
      await expect(layer(page, 'names')).toHaveAttribute('aria-pressed', 'false');
      const tab = await newTab(context);
      await expect(windowRoot(tab)).toHaveAttribute('data-fov', '48', { timeout: 30_000 });
    });

    test('FR-KEEP-2: a reload opens at the opening aim', async ({ page }) => {
      await openLiveSky(page);
      if (wide) {
        await page.getByTestId('globe-box').focus();
        await page.keyboard.press('Home');
        await page.waitForTimeout(200);
        const aim = await zenith(page);
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => zenith(page)).not.toBe(aim);
        await page.reload();
        await expect(page.locator('[data-globe] > *').first()).toBeAttached({ timeout: 30_000 });
        await expect.poll(() => zenith(page)).toBe(aim);
        return;
      }
      const opening = await windowRoot(page).getAttribute('data-look-az');
      await windowKey(page, 'ArrowRight');
      await expect(windowRoot(page)).not.toHaveAttribute('data-look-az', opening ?? '');
      await page.reload();
      await expect(windowRoot(page)).toHaveAttribute('data-look-az', opening ?? '', { timeout: 30_000 });
    });

    // D-1150 (FR-MEAS-7): no privacy note on any page, in either language; a stored `privacyNoteClosed` is ignored.
    for (const [locale, words, close] of [
      ['en', ['No tracking', 'No analytics', 'No account, no tracking'], 'Close the privacy note'],
      ['es', ['Sin rastreo', 'Sin analítica', 'Sin cuenta, sin rastreo'], 'Cerrar la nota de privacidad'],
    ] as const) {
      test(`FR-MEAS-7: the live page and settings carry no privacy note in ${locale}, and a stored flag changes nothing`, async ({ page }) => {
        await page.clock.setFixedTime(NINE_DAYS_ON);
        for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
        await page.addInitScript(
          ([key, value]: [string, string]) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
          },
          [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN, privacyNoteClosed: false })] as [string, string],
        );
        const expectNone = async () => {
          await expect(page.getByTestId('privacy-note')).toHaveCount(0);
          await expect(page.getByTestId('settings-privacy')).toHaveCount(0);
          await expect(page.getByRole('button', { name: close })).toHaveCount(0);
          for (const word of words) await expect(page.getByText(word)).toHaveCount(0);
        };
        // R212 (FR-LAND-1): `/` is the live page, whose phone footer is the controls sheet's last row.
        await page.goto('/');
        await expect(page.getByTestId('live-page')).toBeVisible({ timeout: 30_000 });
        await expectNone();
        await page.goto('/#settings');
        await expect(page.getByTestId('app-footer').last()).toBeAttached({ timeout: 30_000 });
        await expectNone();
      });
    }
  });
}
