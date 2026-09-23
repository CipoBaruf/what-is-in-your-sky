/**
 * R91 captures (FR-FAIL-1, FR-FAIL-2, FR-FAIL-5): the failure line on the home
 * page at 390 and 1280 px — CelesTrak and Open-Meteo both unreachable on a
 * device that never loaded the elements, so the pass list and the cloud row
 * each carry theirs — and the root boundary at 390 px, both themes and both
 * languages.
 *
 * The boundary needs a render error in the production build. `Intl.DateTimeFormat`
 * is made to throw from its formatting methods, so the first card or clock
 * the home draws throws inside React; the boundary itself formats nothing.
 *
 * Evidence for the PR, not a test; off the pull-request path (FR-CI-1):
 *
 *   CAPTURES=1 npx playwright test r91-captures --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { ha, stubNetwork, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const PREFS_KEY = 'wiys:prefs:v1';
const NEUQUEN = { lat: ha.observer.lat, lon: ha.observer.lon, altM: 0, label: `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`, source: 'coords', timeZone: null };
const THEMES = ['dark', 'night'] as const;
const LOCALES = ['en', 'es'] as const;

async function seed(page: Page, width: number, theme: string, locale: string, fixClock = true): Promise<void> {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
  // The clock is left alone for the boundary: its fake `Intl.DateTimeFormat` would stand in front of the broken one.
  if (fixClock) await page.clock.setFixedTime(T);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale, theme, observer: NEUQUEN })] as [string, string],
  );
}

for (const width of [390, 1280] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the failure line on home at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
        await seed(page, width, theme, locale);
        await stubNetwork(page, 'down');
        await page.goto('/');
        await expect(page.locator('[data-testid="failure-line"][data-site="elements"]')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('[data-testid="failure-line"][data-site="forecast"]')).toBeVisible();
        await page.screenshot({ path: `${CAPTURE_DIR}/r91-home-failure-${String(width)}-${theme}-${locale}.png`, fullPage: width === 390 });
      });
    }
  }
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`the root boundary at 390 px, ${theme}, ${locale}`, async ({ page }) => {
      await seed(page, 390, theme, locale, false);
      await stubNetwork(page);
      await page.addInitScript(() => {
        const broken = (): never => {
          throw new TypeError('R91 capture: a render error');
        };
        // `format` is a getter on the prototype, so both are redefined rather than assigned.
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', { configurable: true, get: () => broken });
        Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatToParts', { configurable: true, value: broken });
      });
      await page.goto('/');
      await expect(page.getByTestId('root-boundary')).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: `${CAPTURE_DIR}/r91-boundary-390-${theme}-${locale}.png` });
    });
  }
}
