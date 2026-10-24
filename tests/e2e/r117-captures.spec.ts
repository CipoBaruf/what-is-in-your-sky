/**
 * R117 (FR-STAR-5; FR-FSC-1 as amended v2.4, D-756): the sky screen's stars
 * inventory for the review — 844 × 390, a phone held sideways, both themes and
 * both languages — under `docs/screenshots/r117/`, and the compact page with
 * its `[ hold up to the sky ]` row at 390 × 844. Neuquén at the fixture's
 * instant, the phone facing south 30° up under a mocked orientation.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { heading, pose, stubCompass } from './liveHelpers';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', hasTouch: true });

const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];
const HOLD_UP = { en: 'hold up to the sky', es: 'apuntá al cielo' } as const;

async function starsPage(page: Page, locale: 'en' | 'es', theme: 'dark' | 'night'): Promise<void> {
  await stubCompass(page);
  await page.clock.install({ time: NINE_DAYS_ON - 60_000 });
  await page.clock.pauseAt(NINE_DAYS_ON);
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript((prefs: string) => {
    localStorage.setItem('wiys:prefs:v1', prefs);
  }, JSON.stringify({ locale, theme, observer: NEUQUEN }));
  await page.goto('/#stars');
  await expect
    .poll(async () => {
      await page.clock.runFor(500);
      return page.getByTestId('stars-sky').locator('[data-drawing="window"]').count();
    }, { timeout: 15_000 })
    .toBe(1);
}

for (const theme of ['dark', 'night'] as const) {
  for (const locale of ['en', 'es'] as const) {
    test(`the stars screen at 844 × 390, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await starsPage(page, locale, theme);
      await page.getByRole('button', { name: HOLD_UP[locale] }).click();
      await expect
        .poll(async () => {
          await heading(page, 270);
          return page.getByTestId('sky-screen').count();
        }, { timeout: 15_000 })
        .toBe(1);
      await page.clock.runFor(1000);
      await expect
        .poll(async () => {
          await pose(page, { alpha: 180, beta: 120, gamma: 0 });
          return page.getByTestId('sky-screen').getByTestId('window-readout').count();
        }, { timeout: 15_000 })
        .toBe(1);
      await pose(page, { alpha: 180, beta: 120, gamma: 0 });
      // The `×` takes the focus on open; the ring is not what the review is of.
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
      await page.screenshot({ path: `${CAPTURE_DIR}/r117/r117-stars-screen-844-${theme}-${locale}.png` });
    });
  }

  test(`the compact stars page with its [ hold up to the sky ] row at 390 × 844, ${theme}, en`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await starsPage(page, 'en', theme);
    await expect(page.getByRole('button', { name: HOLD_UP.en })).toBeVisible();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.screenshot({ path: `${CAPTURE_DIR}/r117/r117-stars-390-${theme}-en.png`, fullPage: true });
  });
}
