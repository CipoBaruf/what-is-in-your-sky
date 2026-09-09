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
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

test.describe('a narrow phone does not scroll sideways', () => {
  test('the live page holds the viewport at 344 and 360 (FR-COMP-5, FR-SHP-2)', async ({ page }) => {
    await seedStoredRun(page, { settled: true });
    await page.getByTestId('live-link').click();
    await domeDrawn(page);
    await stripFilled(page);
    for (const width of [360, 344]) {
      await page.setViewportSize({ width, height: 700 });
      await domeDrawn(page);
      const scroll = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      expect(scroll.scrollWidth, `${String(width)} px: the live page scrolls sideways`).toBeLessThanOrEqual(scroll.clientWidth);
    }
  });
});
