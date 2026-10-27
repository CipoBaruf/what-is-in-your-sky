/**
 * R130 (FR-FLOW-1, FR-FLOW-2; D-843, D-844): the home with its three doors,
 * for the review — 390 × 844 with the Where folded and opened, and 1280 × 800
 * with the doors in one row over the panes, in both languages. The stored run
 * at the fixtures' instant, once the `stars` chunk has answered the Stars door.
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { seedStoredRun } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

async function home(page: Page, locale: 'en' | 'es', size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seedStoredRun(page, { locale, settled: true });
  await expect(page.getByTestId('door-stars').getByTestId('door-stars-line').nth(1)).not.toHaveAttribute('data-pending', '', { timeout: 30_000 });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
}

for (const locale of ['en', 'es'] as const) {
  test(`the home at 390 × 844, folded and opened, ${locale}`, async ({ page }) => {
    await home(page, locale, { width: 390, height: 844 });
    await page.screenshot({ path: `${CAPTURE_DIR}/r130-home-390-${locale}.png` });
    await page.getByTestId('where-details').click();
    await page.screenshot({ path: `${CAPTURE_DIR}/r130-home-390-details-${locale}.png` });
  });

  test(`the home at 1280 × 800, ${locale}`, async ({ page }) => {
    await home(page, locale, { width: 1280, height: 800 });
    await page.screenshot({ path: `${CAPTURE_DIR}/r130-home-1280-${locale}.png` });
  });
}
