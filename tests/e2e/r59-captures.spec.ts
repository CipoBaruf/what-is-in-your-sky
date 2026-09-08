/**
 * R59 captures (FR-FOL-1, FR-FOL-3, FR-LIVE-7 as amended v1.2): the live page
 * on a phone, not following — the dome in its box, the rows under it spaced by
 * the one `--live-row-gap` (D-281), the stripe block and the playback row where
 * they belong, and the control unpressed.
 *
 * R64 (FR-FSC-1, D-321): the second shot this file used to take — the page
 * *following*, with the sky window in the box and the strip carrying the
 * true-north line — is a picture of a state the app no longer has. What the
 * control opens is a layer over the whole page, and its captures are
 * `follow-screen-*` in the release set (FR-FSC-7); `r59-live-390-following-*`
 * left `docs/screenshots/` with the state.
 *
 * Evidence for the PR, not a test: the assertions only make sure each capture
 * shows the state it is named after. Off the pull-request path (FR-CI-1's
 * budget), like R54's, R55's and R56's:
 *
 *   CAPTURES=1 npx playwright test r59-captures --project=chromium
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR, LOCALES, THEMES } from './captureSet';
import { domeDrawn, homeAt, setThemeOnHome, stripFilled, stubCompass, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

test.describe('the live page with the follow control on it', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`capture: the live page with the control offered, 390 px, ${theme}, ${locale}`, async ({ page }) => {
        await stubCompass(page);
        await homeAt(page, T, locale, true);
        if (theme === 'night') await setThemeOnHome(page, locale, 'night');
        await page.getByTestId('live-link').click();
        await domeDrawn(page);
        await stripFilled(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        // Not following: the stripe block and the playback row are on the page, and the control is unpressed.
        await expect(page.getByTestId('stripe-block')).toBeVisible();
        await expect(page.getByTestId('playback-row')).toBeVisible();
        await expect(page.getByTestId('follow-toggle')).toHaveAttribute('aria-pressed', 'false');
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${CAPTURE_DIR}/r59-live-390-${theme}-${locale}.png` });
      });
    }
  }
});
