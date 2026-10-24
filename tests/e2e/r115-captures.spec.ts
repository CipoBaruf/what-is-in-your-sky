/**
 * R115 (FR-STAR-3, FR-STAR-10; D-758): the `#stars` page's captures for the
 * review — 390 × 844 and 1280 × 800, both themes, both languages — under
 * `docs/screenshots/r115/`. Neuquén at the fixture's instant, facing the pole
 * side. The star field itself is R114's (this task's window draws its empty
 * group): what these show is the page around it — the box, the readout, the
 * rail or the compact rows, and `In this field`.
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { NEUQUEN, NINE_DAYS_ON } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

for (const [width, height] of [
  [390, 844],
  [1280, 800],
] as const) {
  for (const theme of ['dark', 'night'] as const) {
    for (const locale of ['en', 'es'] as const) {
      test(`the stars page at ${String(width)} × ${String(height)}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.clock.setFixedTime(NINE_DAYS_ON);
        for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
        await page.addInitScript((prefs: string) => {
          localStorage.setItem('wiys:prefs:v1', prefs);
        }, JSON.stringify({ locale, theme, observer: NEUQUEN }));
        await page.goto('/#stars');
        await expect.poll(async () => page.getByTestId('field-list').getByRole('button').count()).toBeGreaterThan(0);
        // The box keeps the focus ring off the picture for the review: the focus is on the page's body.
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${CAPTURE_DIR}/r115/r115-stars-${String(width)}-${theme}-${locale}.png`, fullPage: width < 964 });
      });
    }
  }
}
