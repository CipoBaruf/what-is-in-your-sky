/**
 * R87 captures (FR-VISIT-2, FR-VISIT-4, FR-FIRST-1 and FR-FIRST-4 as amended
 * v2.1): the visit notice and the link note, and the phone's first step with
 * its line footer.
 *
 *   CAPTURES=1 npx playwright test r87-captures --project=chromium
 *
 * Each in both themes and both languages:
 * - the visit notice at 390 × 844 and 1280 × 800: a saved place (Neuquén) and
 *   a pass link for Paris;
 * - the unreadable link's note at 390 × 844 (`#live?lat=999`);
 * - the where step at 360 × 640 and 390 × 844, the whole page, footer and all.
 *
 * Evidence for the PR, not a test. Off the pull-request path (FR-CI-1's
 * budget), like every other capture spec. The theme and the language are
 * seeded in `wiys:prefs:v1` and never clicked (D-70).
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

type Theme = 'dark' | 'night';
type Locale = 'en' | 'es';

const THEMES: readonly Theme[] = ['dark', 'night'];
const LOCALES: readonly Locale[] = ['en', 'es'];
const START = new Date(NINE_DAYS_ON + 3_600_000).toISOString().replace('.000Z', 'Z');
const PASS_LINK = `/#pass?lat=48.86&lon=2.35&alt=35&norad=25544&start=${START}`;

async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
}

for (const [label, size] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the visit notice at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await seedStoredRun(page, { locale, prefs: { theme } });
        await page.goto('about:blank');
        await page.goto(PASS_LINK);
        await expect(page.getByTestId('visit-notice')).toBeVisible();
        // The link's pass opens as a sheet on a phone; the notice is what this capture is of.
        if (label === '390') await page.keyboard.press('Escape');
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r87-visit-${label}-${theme}-${locale}.png` });
      });
    }
  }
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`the unreadable link's note at 390, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await seedStoredRun(page, { locale, prefs: { theme } });
      await page.goto('about:blank');
      await page.goto('/#live?lat=999');
      await expect(page.getByTestId('link-note')).toBeVisible();
      await settle(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r87-unreadable-390-${theme}-${locale}.png` });
    });
  }
}

for (const [label, size] of [
  ['360', { width: 360, height: 640 }],
  ['390', { width: 390, height: 844 }],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the where step at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.clock.setFixedTime(NINE_DAYS_ON);
        await stubNetwork(page);
        await page.addInitScript(
          ([key, value]: [string, string]) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
          },
          ['wiys:prefs:v1', JSON.stringify({ locale, theme })] as [string, string],
        );
        await page.goto('/');
        await expect(page.getByTestId('cold-open')).toBeVisible();
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r87-where-${label}-${theme}-${locale}.png`, fullPage: true });
      });
    }
  }
}
