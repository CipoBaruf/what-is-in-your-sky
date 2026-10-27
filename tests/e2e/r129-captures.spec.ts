/**
 * R129 captures (FR-FLOW-3, D-845): the one header on each of the five pages — the home, the live page, the stars
 * page, the pass detail and settings — at 390 × 844 and 1280 × 800, in both languages: the compact `[ ← ]` row with
 * the page's name and the place, the wide row with the page links and the current one marked, `[ settings ]` last,
 * and no language or theme switch on any of them.
 *
 * Evidence for the PR, not a test; off the pull-request path (FR-CI-1):
 *
 *   CAPTURES=1 npx playwright test r129-captures --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { seedStoredRun } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const LOCALES = ['en', 'es'] as const;

const go = async (page: Page, hash: string): Promise<void> => {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
};

for (const width of [390, 1280] as const) {
  for (const locale of LOCALES) {
    test(`the five headers at ${String(width)} px, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await seedStoredRun(page, { locale });
      const shot = (name: string): Promise<Buffer> => page.screenshot({ path: `${CAPTURE_DIR}/r129-${name}-${String(width)}-${locale}.png` });
      await expect(page.getByTestId('header')).toHaveAttribute('data-page', 'home');
      await shot('home');

      await page.getByRole('button', { name: locale === 'es' ? /Abrir la guía/ : /Open guide/ }).first().click();
      if (width === 390) await expect(page.getByTestId('pass-date')).toBeVisible();
      else await expect(page.getByTestId('guide-panel')).toBeVisible();
      await shot('pass');
      await page.keyboard.press('Escape');

      await go(page, 'live');
      await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live', { timeout: 30_000 });
      await shot('live');

      await go(page, 'stars');
      await expect(page.getByTestId('stars-intro')).toBeVisible({ timeout: 30_000 });
      await shot('stars');

      await go(page, 'settings');
      await expect(page.getByTestId('settings-privacy')).toBeVisible();
      await expect(page.getByTestId('location-actions')).toBeVisible();
      await shot('settings');
    });
  }
}
