/**
 * R89 captures (FR-LIVE-1 as amended v2.1, FR-FAIL-1, FR-FAIL-6, FR-VISIT-3):
 * the live page's three states before it can draw, and a link's moment note.
 *
 *   CAPTURES=1 npx playwright test r89-captures --project=chromium
 *
 * Each in both themes and both languages, at 390 × 844 and 1280 × 800:
 * - no place: `#live` with nothing saved;
 * - loading: a saved place and CelesTrak holding its answer;
 * - failed: a saved place and CelesTrak refusing, `[ details ]` open;
 * - and at 390 × 844 the far note: a live link 30 h ahead, held at the span's end.
 *
 * Evidence for the PR, not a test. Off the pull-request path (FR-CI-1's
 * budget), like every other capture spec. The theme and the language are
 * seeded in `wiys:prefs:v1` and never clicked (D-70).
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { domeDrawn, ha, stubNetwork, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

type Theme = 'dark' | 'night';
type Locale = 'en' | 'es';

const THEMES: readonly Theme[] = ['dark', 'night'];
const LOCALES: readonly Locale[] = ['en', 'es'];
const NEUQUEN = { lat: ha.observer.lat, lon: ha.observer.lon, altM: 0, label: `${String(ha.observer.lat)}, ${String(ha.observer.lon)}`, source: 'coords', timeZone: null };

async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
}

async function prefs(page: Page, value: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ([key, json]: [string, string]) => {
      localStorage.setItem(key, json);
    },
    ['wiys:prefs:v1', JSON.stringify(value)] as [string, string],
  );
}

for (const [label, size] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`no place at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.clock.setFixedTime(T);
        await stubNetwork(page);
        await prefs(page, { locale, theme });
        await page.goto('/#live');
        await expect(page.getByTestId('live-inert')).toHaveAttribute('data-inert', 'no-place');
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r89-no-place-${label}-${theme}-${locale}.png` });
      });

      test(`loading at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.clock.setFixedTime(T);
        await stubNetwork(page);
        // CelesTrak never answers: the page stays on its loading state.
        await page.route('https://celestrak.org/**', () => new Promise<void>(() => undefined));
        await prefs(page, { locale, theme, observer: NEUQUEN });
        await page.goto('/#live');
        await expect(page.getByTestId('live-inert')).toHaveAttribute('data-inert', 'loading');
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r89-loading-${label}-${theme}-${locale}.png` });
      });

      test(`failed at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.clock.setFixedTime(T);
        await stubNetwork(page, 'down');
        await prefs(page, { locale, theme, observer: NEUQUEN });
        await page.goto('/#live');
        await expect(page.getByTestId('live-inert')).toHaveAttribute('data-inert', 'failed', { timeout: 30_000 });
        await page.getByTestId('failure-details').click();
        await expect(page.getByTestId('failure-detail')).toBeVisible();
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r89-failed-${label}-${theme}-${locale}.png` });
      });
    }
  }
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`the far note at 390, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.clock.setFixedTime(T);
      await stubNetwork(page);
      await prefs(page, { locale, theme });
      const at = new Date(T + 30 * 3_600_000).toISOString().replace('.000Z', 'Z');
      await page.goto(`/#live?lat=${String(ha.observer.lat)}&lon=${String(ha.observer.lon)}&alt=0&t=${at}`);
      await domeDrawn(page);
      await expect(page.getByTestId('link-note')).toBeVisible();
      await settle(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r89-far-note-390-${theme}-${locale}.png` });
    });
  }
}
