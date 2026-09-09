/**
 * R54: the live page on `r45-captures.spec.ts`'s instant — Paris on 2026-09-02,
 * three minutes into the glare pass, four passes up so the legend has rows
 * beside the drawing — at a viewport and in a theme, the prefs seeded in
 * `wiys:prefs:v1` (D-70). Shared by the R54 captures and the F-53 legend spec.
 */
import { expect, type Page } from '@playwright/test';
import type { CaptureTheme } from './captureSet';
import { domeDrawn, stripFilled } from './liveHelpers';
import { FIXTURE_DATE, PARIS } from './observers';

const PREFS_KEY = 'wiys:prefs:v1';
const GLARE_PASS_START = Date.parse('2026-09-02T03:52:46.469Z');
const SHOWN = GLARE_PASS_START + 180_000;
const TICK_MS = 10_000;

export const LIVE_VIEWPORTS = {
  1920: { width: 1920, height: 1080 },
  1280: { width: 1280, height: 800 },
  /**
   * A short two-column page: the legend column is shorter than its list, so F-53's scroll is exercised.
   * 1280 × 720 until R61 took the stripe block out of the rail (V12-12), which gave the legend the stripe's
   * rows, and then made 1280 a one-column page (V12-14), where the legend is the compact four-row one under
   * the drawing; 1660 is the first two-column width, 540 a laptop window with the browser's chrome above it.
   *
   * R70 (FR-SPAN-2, FR-SHP-3): 540 is no longer that page. The overview row and the stepping row put two more
   * rows under the box, which is what makes 540 short enough for FR-SHP-3's fold to engage there — and a folded
   * page gives the box, and with it the rail, more height than the unfolded 540 had, so the four-pass list fits
   * the column and F-53's scroll goes untested. 380 is a folded page whose rail is shorter than its list again:
   * 334 px of rail against the legend's 264 and the aside's 101, the shape 540 had before the two rows arrived.
   */
  short: { width: 1660, height: 380 },
  /** R61 (F-59): the width the owner reported the blank third of the box at. */
  2560: { width: 2560, height: 1440 },
  /** R61 (D-314): step 4 of the ladder, the largest reference viewport. */
  3840: { width: 3840, height: 2160 },
} as const;

export async function openParisLive(page: Page, width: keyof typeof LIVE_VIEWPORTS, theme: CaptureTheme): Promise<void> {
  await page.setViewportSize(LIVE_VIEWPORTS[width]);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    [PREFS_KEY, JSON.stringify({ locale: 'en', theme, observer: PARIS, chartView: 'dome' })] as [string, string],
  );
  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  for (const pattern of ['https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) await page.route(pattern, (route) => route.abort('failed'));
  await page.clock.install({ time: SHOWN });
  await page.clock.pauseAt(SHOWN);
  await page.goto('/');
  await expect(page.getByTestId('iss-hero')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
  await page.evaluate(() => {
    location.hash = '#live';
  });
  await domeDrawn(page);
  await stripFilled(page);
  await page.clock.setSystemTime(SHOWN - TICK_MS);
  await page.clock.runFor(TICK_MS);
  await page.mouse.move(0, 0);
}
