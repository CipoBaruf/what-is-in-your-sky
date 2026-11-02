/**
 * R163 (FR-CLEAN-1..4, FR-CLEAN-7, FR-CLEAN-11; US-49 AC1..AC6): the stars page in the full form, for the review. A
 * touch phone with a place and no stored run at Neuquén (`NINE_DAYS_ON`), dark, both languages:
 *
 * - at 390 × 844 with the sheet closed: the window the whole screen, `[ ← ]` with the door's line over its top-left, the
 *   facing readout in the top-right corner, `[ follow ]` and `[ controls ]` at the bottom-right, the touch hint above them;
 * - at 390 × 844 with the sheet open: `[Window] Whole sky`, `[ ] follow the phone`, the facing row, the layer rows
 *   `[x] stars [x] figures [x] planets` and `[x] names` (no `[ passes ]`), and `In this field` open under its heading;
 * - at 844 × 390 with the sheet open: the same bottom sheet across the phone turned, `SHEET_MAX_SHARE` of its height.
 *
 *   CAPTURES=1 npx playwright test r163-captures --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { openSheet } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', hasTouch: true });

const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

async function openStars(page: Page, locale: 'en' | 'es'): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN })] as [string, string],
  );
  await page.goto('/#stars');
  await expect(page.getByTestId('stars-layout')).toHaveAttribute('data-shape', 'full');
  const w = page.getByTestId('stars-sky').locator('[data-look-az][data-fov]');
  await expect(w).toHaveAttribute('data-state', 'hand', { timeout: 15_000 });
  // The named stars' labels and the door's line land late: a settled frame before the shot.
  await expect(page.getByTestId('stars-head-line')).toHaveText(/\S/);
  await expect.poll(() => page.getByTestId('stars-sky').locator('[data-drawing="window"] text').count(), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.mouse.move(0, 0);
}

for (const locale of ['en', 'es'] as const) {
  test.describe(`the stars page at 390 × 844, ${locale}`, () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the sky with the head, the readout and the bottom row; then the sheet open', async ({ page }) => {
      await openStars(page, locale);
      await page.screenshot({ path: `${CAPTURE_DIR}/r163-stars-390-dark-${locale}.png` });
      await openSheet(page);
      await expect(page.getByRole('list', { name: locale === 'en' ? 'In this field' : 'En este campo' })).toBeVisible();
      await page.screenshot({ path: `${CAPTURE_DIR}/r163-stars-390-sheet-dark-${locale}.png` });
    });
  });

  test.describe(`the stars page at 844 × 390, ${locale}`, () => {
    test.use({ viewport: { width: 844, height: 390 } });

    test('the sky turned, the bottom sheet open', async ({ page }) => {
      await openStars(page, locale);
      await openSheet(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r163-stars-844-landscape-sheet-dark-${locale}.png` });
    });
  });
}
