/**
 * R152 (FR-GYRO-1, FR-GYRO-2, FR-GYRO-5, FR-GYRO-6; US-44 AC1..AC4): `[ follow the phone ]` on the three pages, for
 * the review. A touch phone at 390 × 844 with the stored run at Neuquén, dark, both languages, the toggle on under
 * `stubOrientation` (D-946) and the window following a reading aimed south-east, 30° up:
 *
 * - the live page's sheet open: the view row `[Window] Polar Dome`, `[x] follow the phone` as the row after it, the
 *   facing row with no readout (FR-GYRO-5), the sky behind it the following window;
 * - the stars page: the toggle in the action slot where `[ hold up to the sky ]` stood, the window following;
 * - the pass detail: the toggle in the same slot under the hint, the guide's window following.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { openSheet, seedStoredRun } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';
import { aimedAt, stubOrientation } from './orientation';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', hasTouch: true, viewport: { width: 390, height: 844 } });

const OPEN_GUIDE = { en: /Open guide/, es: /Abrir la guía/ } as const;
const PREFS_KEY = 'wiys:prefs:v1';
const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

async function seedReader(page: Page, locale: 'en' | 'es'): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, observer: NEUQUEN })] as [string, string],
  );
}

/** The toggle tapped, the window following and settled on the reading, the focus ring off the toggle. */
async function following(page: Page): Promise<void> {
  await page.getByTestId('follow-toggle').click();
  const w = page.locator('[data-look-az][data-fov]');
  await expect(w).toHaveAttribute('data-follow', 'true', { timeout: 15_000 });
  await expect(w).toHaveAttribute('data-state', 'on', { timeout: 15_000 });
  await expect(w).toHaveAttribute('data-look-alt', '30', { timeout: 15_000 });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.mouse.move(0, 0);
}

for (const locale of ['en', 'es'] as const) {
  test(`the live sheet with [ follow the phone ] on, 390, ${locale}`, async ({ page }) => {
    await stubOrientation(page, { answer: 'granted', readings: [aimedAt(135, 30)] });
    await seedStoredRun(page, { locale, settled: true, prefs: { chartView: 'dome' } });
    await page.goto('/#live');
    await page.reload();
    await expect(page.getByTestId('live-layout').locator('[data-drawing="dome"]')).toBeAttached({ timeout: 30_000 });
    const card = page.getByTestId('live-card');
    if ((await card.count()) > 0) await card.getByTestId('live-card-now').click();
    await openSheet(page);
    await following(page);
    await page.screenshot({ path: `${CAPTURE_DIR}/r152-live-390-sheet-dark-${locale}.png` });
  });

  test(`the stars page with [ follow the phone ] on, 390, ${locale}`, async ({ page }) => {
    await stubOrientation(page, { answer: 'granted', readings: [aimedAt(135, 30)] });
    await seedReader(page, locale);
    await page.goto('/#stars');
    await expect(page.getByTestId('stars-layout').locator('[data-drawing="window"]')).toBeAttached();
    await following(page);
    await page.screenshot({ path: `${CAPTURE_DIR}/r152-stars-390-dark-${locale}.png`, fullPage: true });
  });

  test(`the pass detail with [ follow the phone ] on, 390, ${locale}`, async ({ page }) => {
    await stubOrientation(page, { answer: 'granted', readings: [aimedAt(135, 30)] });
    await seedStoredRun(page, { locale, settled: true, prefs: { chartView: 'dome' } });
    await page.locator('article[data-pass-id]').first().getByRole('button', { name: OPEN_GUIDE[locale] }).click();
    await expect(page.getByTestId('pass-layout').locator('[data-drawing="dome"]')).toBeAttached({ timeout: 30_000 });
    await following(page);
    // The toggle stands under the hint, below the fold at 844 px: the sheet is scrolled so the row and the box are both in the shot.
    await page.getByTestId('follow-toggle').scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${CAPTURE_DIR}/r152-detail-390-dark-${locale}.png` });
  });
}
