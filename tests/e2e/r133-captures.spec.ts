/**
 * R133 (FR-FLOW-9, FR-FLOW-7's wide share; D-850, D-867..D-869): the boxes, for the review. The stored run's sky
 * (`seedStoredRun`), watching, dark, English unless the capture is about a Spanish line:
 *
 * - 390 × 844: the live page and the pass detail, the dome's box cut from the bowl (one slack over and under it).
 * - 1280 × 800: the live page in the three views and the stars page, the box down to the hint line; the pass
 *   detail's panel, the drawing most of its body; the Spanish window view, whose two-line hint the box now leaves
 *   room for (D-869).
 * - 844 × 390: the live page, unchanged by this task and shot for FR-LIVE-7's record.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { domeDrawn, seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const VIEW_GROUP = { en: 'Chart view', es: 'Vista del gráfico' } as const;
const VIEW_NAME = { en: { Dome: 'Dome', Polar: 'Polar', Window: 'Window' }, es: { Dome: 'Domo', Polar: 'Polar', Window: 'Ventana' } } as const;

async function live(page: Page, size: { width: number; height: number }, locale: 'en' | 'es' = 'en'): Promise<void> {
  await page.setViewportSize(size);
  await seedStoredRun(page, { locale, settled: true });
  await page.goto('/#live');
  await page.reload();
  await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
  await domeDrawn(page);
  await page.mouse.move(0, 0);
}

async function view(page: Page, locale: 'en' | 'es', name: 'Dome' | 'Polar' | 'Window'): Promise<void> {
  if (name === 'Dome') return;
  await page.getByRole('group', { name: VIEW_GROUP[locale] }).getByRole('button', { name: VIEW_NAME[locale][name] }).click();
  await expect(page.locator(`[data-drawing="${name.toLowerCase()}"]`)).toBeAttached({ timeout: 30_000 });
  // The polar chart and the window draw on their own clocks; a moment for the first paint.
  await page.waitForTimeout(1500);
  await page.mouse.move(0, 0);
}

async function detail(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seedStoredRun(page, { locale: 'en', settled: true });
  await page.locator('article[data-pass-id]').first().getByRole('button', { name: /Open guide/ }).click();
  const layout = page.getByTestId('pass-layout');
  await expect(layout.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  await page.mouse.move(0, 0);
}

test('the live page at 390 × 844: the box hugs the bowl', async ({ page }) => {
  await live(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${CAPTURE_DIR}/r133-live-390-dome-dark-en.png` });
});

test('the pass detail at 390 × 844: the same cut', async ({ page }) => {
  await detail(page, { width: 390, height: 844 });
  await page.screenshot({ path: `${CAPTURE_DIR}/r133-detail-390-dome-dark-en.png` });
});

test('the live page at 844 × 390, for the record', async ({ page }) => {
  await live(page, { width: 844, height: 390 });
  await page.screenshot({ path: `${CAPTURE_DIR}/r133-live-844-dome-dark-en.png` });
});

for (const name of ['Dome', 'Polar', 'Window'] as const) {
  test(`the live page at 1280 × 800, ${name}: the box to the hint line`, async ({ page }) => {
    await live(page, { width: 1280, height: 800 });
    await view(page, 'en', name);
    await page.screenshot({ path: `${CAPTURE_DIR}/r133-live-1280-${name.toLowerCase()}-dark-en.png` });
  });
}

test('the live page at 1280 × 800, the window in Spanish: the two-line hint under the box', async ({ page }) => {
  await live(page, { width: 1280, height: 800 }, 'es');
  await view(page, 'es', 'Window');
  await page.screenshot({ path: `${CAPTURE_DIR}/r133-live-1280-window-dark-es.png` });
});

test('the stars page at 1280 × 800: the window down to the hint line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', observer: NEUQUEN })] as [string, string],
  );
  await page.goto('/#stars');
  await expect(page.getByTestId('stars-layout').locator('[data-drawing="window"]')).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${CAPTURE_DIR}/r133-stars-1280-window-dark-en.png` });
});

test('the pass detail at 1280 × 800: the drawing most of the panel', async ({ page }) => {
  await detail(page, { width: 1280, height: 800 });
  await page.screenshot({ path: `${CAPTURE_DIR}/r133-detail-1280-dome-dark-en.png` });
});
