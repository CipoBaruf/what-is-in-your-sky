/**
 * R52 captures (FR-COMP-1..3, FR-DESK-2 as amended, V11-16): the three screens
 * this task changed, against the approved mockups.
 *
 * The compact home (`docs/mockups/compact-390-home-*.png`): the one-row header,
 * the location summary where the form used to be, and the order of FR-COMP-3.
 * The settings page (`compact-390-settings-*.png`): FR-COMP-2's rows, with the
 * install offer between the saved places and the clear action — which the
 * mockup predates and this is the first picture of. And the wide header, where
 * `[ Live sky ]` moved to the title's own line (V11-8).
 *
 * Evidence for the PR, not a test: the assertions only make sure the capture
 * shows the thing it is named after. Off the pull-request path (FR-CI-1's
 * budget), like R54's and R55's:
 *
 *   CAPTURES=1 npx playwright test r52-captures --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR, LOCALES, THEMES } from './captureSet';
import { openSettings, seedStoredRun } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const COMPACT = { width: 390, height: 844 };
const WIDE = { width: 1280, height: 800 };

/** The browser offering an install, so the settings page's row is in the picture (V11-16). */
async function offerInstall(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
  });
}

for (const theme of THEMES) {
  for (const locale of LOCALES) {
    test(`the compact home, 390 px, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize(COMPACT);
      await seedStoredRun(page, { locale, prefs: { theme }, settled: true });
      await expect(page.getByTestId('header')).toBeVisible();
      await expect(page.getByTestId('location-summary')).toBeVisible();
      await expect(page.getByTestId('settings-link')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r52-home-390-${theme}-${locale}.png` });
    });

    test(`the settings page with the install row, 390 px, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize(COMPACT);
      // A device that has already answered the hint for good: the settings row is
      // there all the same, which is the whole of V11-16.
      await seedStoredRun(page, { locale, prefs: { theme, installHintDismissed: true, installHintDeclines: 3 }, settled: true });
      await openSettings(page);
      await offerInstall(page);
      await expect(page.getByTestId('settings-install')).toBeVisible();
      await expect(page.getByTestId('install-action')).toBeVisible();
      await expect(page.getByTestId('clear-saved-location')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r52-settings-390-${theme}-${locale}.png`, fullPage: true });
    });

    test(`the wide header, 1280 px, ${theme}, ${locale}`, async ({ page }) => {
      await page.setViewportSize(WIDE);
      await seedStoredRun(page, { locale, prefs: { theme }, settled: true });
      await expect(page.getByTestId('live-link')).toBeVisible();
      await expect(page.getByTestId('settings-link')).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${CAPTURE_DIR}/r52-header-1280-${theme}-${locale}.png`, clip: { x: 0, y: 0, width: WIDE.width, height: 160 } });
    });
  }
}
