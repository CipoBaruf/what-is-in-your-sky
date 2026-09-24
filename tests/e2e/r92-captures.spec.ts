/**
 * R92 captures (FR-A11Y-5, FR-A11Y-1): the one thing R92 draws — "Skip to content", focused, at the top of
 * home and of settings — at 390 and 1280 px, both themes and both languages; and the live page at both widths,
 * whose top row and content are now the page's banner and main and must look exactly as they did.
 *
 * Evidence for the PR, not a test; off the pull-request path (FR-CI-1):
 *
 *   CAPTURES=1 npx playwright test r92-captures --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { seedStoredRun } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const THEMES = ['dark', 'night'] as const;
const LOCALES = ['en', 'es'] as const;

async function focusSkip(page: Page): Promise<void> {
  // The link is the first stop from the top of the document; Settings moves the focus to its Back control on the
  // way in, so the link is focused directly there — the drawing is the same.
  await page.getByTestId('skip-link').focus();
  await expect(page.getByTestId('skip-link')).toBeInViewport();
}

for (const width of [390, 1280] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the skip link on home and settings at ${String(width)} px, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await seedStoredRun(page, { locale, prefs: { theme } });
        await page.keyboard.press('Tab');
        await expect(page.getByTestId('skip-link')).toBeFocused();
        await page.screenshot({ path: `${CAPTURE_DIR}/r92-skip-home-${String(width)}-${theme}-${locale}.png` });
        await page.evaluate(() => {
          window.location.hash = 'settings';
        });
        await expect(page.getByTestId('settings-back')).toBeVisible();
        await focusSkip(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r92-skip-settings-${String(width)}-${theme}-${locale}.png` });
      });
    }
  }

  test(`the live page in its landmarks at ${String(width)} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await seedStoredRun(page);
    await page.getByTestId('live-link').click();
    await expect(page.getByTestId('live-page')).toHaveAttribute('data-state', 'live', { timeout: 30_000 });
    await expect(page.getByTestId('live-back')).toBeFocused();
    await page.screenshot({ path: `${CAPTURE_DIR}/r92-live-${String(width)}-dark-en.png` });
  });
}
