/**
 * R71 (the owner's finding on a phone, 2026-09-09): the live page scrolled
 * sideways on a narrow screen — the page's content was wider than the phone.
 *
 * The cause is not the drawing and not the legend. `.page`'s single column was
 * the implicit `auto` track, and an `auto` track cannot be narrower than its
 * content's minimum: a row at FR-COMP-4's 36-cell budget is wider than a
 * 344 px screen once the page's two cells of padding are off each side, so the
 * track grew past the page's content box, and the full-bleed drawing
 * (`ChartFrame.module.css`, D-187) then broke out of a pane that was already
 * too wide. Measured on `origin/main` at 344 x 700: the page 356 px inside a
 * 344 px viewport; at 360 x 800 under WebKit, whose `ch` is 9.891 rather than
 * Chromium's 9.6, the same defect at the width the owner's phone has. The
 * column is `minmax(0, 1fr)` now, so no row can widen the page.
 *
 * The 320 px column of the table below is deliberately not asserted: there the
 * shell itself is over the screen (the home page too, 337 of 320, on code that
 * predates v1.4), which is FR-COMP-4's budget against a screen narrower than
 * any the matrix claims — the owner's call, not this task's.
 */
import { expect, test } from '@playwright/test';
import { domeDrawn, homeAt, seedStoredRun, stripFilled, T } from './liveHelpers';

/** The page against its own viewport: what a phone scrolls sideways by. */
async function scroll(page: import('@playwright/test').Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
}

test.describe('a narrow phone does not scroll sideways', () => {
  test('the live page holds the viewport at 344 and 360 (FR-COMP-5, FR-SHP-2)', async ({ page }) => {
    await seedStoredRun(page, { settled: true });
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    for (const width of [360, 344]) {
      await page.setViewportSize({ width, height: 700 });
      await domeDrawn(page);
      const measured = await scroll(page);
      expect(measured.scrollWidth, `${String(width)} px: the live page scrolls sideways`).toBeLessThanOrEqual(measured.clientWidth);
    }
  });

  /**
   * The owner's second measurement, on the same phone: the home page, only once a place is set and the page
   * has its content — the location summary, the readiness line and the install note are what the shell's
   * track is measured against, and in Spanish they are longer than in English. `.main` and `.column` in
   * `App.module.css` had the same implicit `auto` track the live page had. English was already inside the
   * box at the same width, which is why the page had to be Spanish and populated for the defect to show.
   */
  test('the home page holds the viewport at 344 in Spanish, with its content (FR-COMP-5, FR-I18N-2)', async ({ page }) => {
    // 344 and not the 360 the owner measured: Chromium's `ch` is 9.6 px against WebKit's 9.891, so the same
    // defect reaches 360 on a phone and 344 here. The width is the one this engine can hold the fix to.
    await page.setViewportSize({ width: 344, height: 800 });
    await homeAt(page, T, 'es', true);
    const plain = await scroll(page);
    expect(plain.scrollWidth, '344 px, Spanish: the home page scrolls sideways').toBeLessThanOrEqual(plain.clientWidth);
    // The install note is a row of the same column, and the longest line the page has (FR-OFF-6).
    await page.evaluate(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: () => Promise.resolve() }));
    });
    await expect(page.getByTestId('install-hint')).toBeVisible();
    const offered = await scroll(page);
    expect(offered.scrollWidth, '344 px, Spanish, install note: the home page scrolls sideways').toBeLessThanOrEqual(offered.clientWidth);
  });
});
