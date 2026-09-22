/**
 * R85 (FR-COMP-7, FR-CAP-5; F-81, F-82): the owner's gate. The compact live page in Spanish at 360 and 390 px,
 * watching and scrubbing — `[ ← ]` with the place beside it, `[ fijar ] [ ver n ] [ Compartir ]` and
 * `[ vivo ] [ ] Ocultos [ Compartir ]` — and the short wide window (1200 × 450) watching on the four-pass Paris
 * instant, where the inventory ends on a whole entry with its `+n` line and the header row names the times. Both
 * themes. Twelve files under `docs/screenshots/r85-live-…`.
 *
 * Not part of a pull request's CI (FR-CI-1, FR-CI-2): run on demand,
 *
 *   CAPTURES=1 npx playwright test r85-captures --project=chromium
 */
import { test } from '@playwright/test';
import { backToLive, domeDrawn, enterScrubbing, homeAt, reenterLiveWithTheme, stripFilled, T } from './liveHelpers';
import { openParisLive } from './parisLive';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

for (const width of [360, 390] as const) {
  test(`the compact live rows in Spanish at ${String(width)} px, watching and scrubbing, both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 360 ? 640 : 844 });
    await homeAt(page, T, 'es', true);
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    for (const theme of ['dark', 'night'] as const) {
      if (theme === 'night') await reenterLiveWithTheme(page, 'es', theme);
      const name = (state: string): string => `docs/screenshots/r85-live-${state}-${String(width)}-${theme}-es.png`;
      await page.clock.runFor(500);
      await page.screenshot({ path: name('watching') });
      await enterScrubbing(page);
      await page.clock.runFor(500);
      await page.screenshot({ path: name('scrubbing') });
      await backToLive(page);
    }
    await reenterLiveWithTheme(page, 'es', 'dark');
  });
}

for (const theme of ['dark', 'night'] as const) {
  test(`the short wide inventory at 1200 × 450, watching, ${theme}`, async ({ page }) => {
    await openParisLive(page, 'shortWide', theme);
    await page.getByTestId('legend-more').waitFor();
    await page.clock.runFor(500);
    await page.screenshot({ path: `docs/screenshots/r85-live-watching-1200x450-${theme}-en.png` });
  });
}
