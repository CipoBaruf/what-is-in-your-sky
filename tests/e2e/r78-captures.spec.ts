/**
 * R78 (FR-WATCH-9 f, FR-COMP-6's rule): both states of the live page at the two short shapes — the landscape
 * phone (844 × 390), where the scrub block is the rail's, and the short wide window (1200 × 450), where it is a
 * bar over the bottom of the drawing — in both themes and both languages. Sixteen files under
 * `docs/screenshots/r78-live-…`.
 *
 * The theme is set on the home page and the page re-entered, which is the one route both modes share (D-244:
 * the compact live page carries no theme switch). Scrubbing is captured a pass ahead, so the stripe has an arc
 * under the cursor and the headline an offset to show.
 *
 * Not part of a pull request's CI (FR-CI-1, FR-CI-2): run on demand,
 *
 *   CAPTURES=1 npx playwright test r78-captures --project=chromium
 */
import { test } from '@playwright/test';
import { backToLive, domeDrawn, enterScrubbing, homeAt, reenterLiveWithTheme, stripFilled, T } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

const SHORT_SHAPES = [
  [844, 390],
  [1200, 450],
] as const;

for (const [width, height] of SHORT_SHAPES) {
  for (const locale of ['en', 'es'] as const) {
    test(`watching and scrubbing at ${String(width)} × ${String(height)}, both themes, ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await homeAt(page, T, locale, true);
      await page.getByTestId('live-link').click();
      await domeDrawn(page);
      await stripFilled(page);
      for (const theme of ['dark', 'night'] as const) {
        if (theme === 'night') await reenterLiveWithTheme(page, locale, theme);
        const name = (state: string): string => `docs/screenshots/r78-live-${state}-${String(width)}x${String(height)}-${theme}-${locale}.png`;
        await page.clock.runFor(500);
        await page.screenshot({ path: name('watching') });
        await enterScrubbing(page);
        await page.locator('[data-step="next-rise"]').click();
        await page.clock.runFor(500);
        await page.screenshot({ path: name('scrubbing') });
        await backToLive(page);
      }
      // The theme is remembered (US-19): put it back for whatever runs next in this context.
      await reenterLiveWithTheme(page, locale, 'dark');
    });
  }
}
