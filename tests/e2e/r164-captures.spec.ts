/**
 * R164 (FR-CLEAN-1..3, FR-CLEAN-5, FR-CLEAN-7; US-49 AC1..AC5): the pass detail in the full form, for the review. A
 * touch phone with the stored run at Neuquén (`NINE_DAYS_ON`, the forecast down, so UTC), a fresh profile's view (the
 * window), the first card's guide, dark, both languages:
 *
 * - at 390 × 844 with the sheet closed: the window the whole screen, `[ ← ]` with the countdown and the name's chip over
 *   its top-left, the facing readout and the landmark line under the head at the right, `[ controls ]` at the
 *   bottom-right and the touch hint;
 * - at 390 × 844 with the sheet open: the name with the date and the zone and the landmark line, the times row, the
 *   view row, the facing row, `[ Share ]`, then the prose; and scrolled to its end, the table of points;
 * - at 844 × 390 with the sheet open: the same bottom sheet across the phone turned.
 *
 *   CAPTURES=1 npx playwright test r164-captures --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { openSheet, seedStoredRun } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block', hasTouch: true });

async function openDetail(page: Page, locale: 'en' | 'es'): Promise<void> {
  await seedStoredRun(page, { locale, settled: true, prefs: { chartView: undefined } });
  await page.locator('article[data-pass-id]').first().getByRole('button').first().click();
  await expect(page.getByTestId('pass-layout')).toHaveAttribute('data-shape', 'full');
  const w = page.locator('[role="dialog"][data-pass-id] [data-look-az][data-fov]');
  await expect(w).toHaveAttribute('data-state', 'hand', { timeout: 15_000 });
  // The landmark line and the named stars' labels land with the stars' chunk: a settled frame before the shot.
  await expect(page.getByTestId('pass-corner-landmark')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => w.locator('[data-drawing="window"] text').count(), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.mouse.move(0, 0);
}

for (const locale of ['en', 'es'] as const) {
  test.describe(`the pass detail at 390 × 844, ${locale}`, () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the sky with the head, the readout and the bottom row; then the sheet open, and at its end', async ({ page }) => {
      await openDetail(page, locale);
      await page.screenshot({ path: `${CAPTURE_DIR}/r164-detail-390-dark-${locale}.png` });
      await openSheet(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r164-detail-390-sheet-dark-${locale}.png` });
      await page.getByTestId('sheet-body').evaluate((el) => {
        el.scrollTo(0, el.scrollHeight);
      });
      await page.screenshot({ path: `${CAPTURE_DIR}/r164-detail-390-sheet-end-dark-${locale}.png` });
    });
  });

  test.describe(`the pass detail at 844 × 390, ${locale}`, () => {
    test.use({ viewport: { width: 844, height: 390 } });

    test('the sky turned, the bottom sheet open', async ({ page }) => {
      await openDetail(page, locale);
      await openSheet(page);
      await page.screenshot({ path: `${CAPTURE_DIR}/r164-detail-844-landscape-sheet-dark-${locale}.png` });
    });
  });
}
