/**
 * R208 (FR-LAND-2, FR-STRIP-4, FR-LIVE-9; D-1233): what each width opens on. A desk opens the live page on the globe
 * with real time running by seconds and a pass page playing from its rise; a phone opens the window, not playing; a
 * stored view wins at both widths, and a link's instant or reduced motion opens paused.
 */
import { expect, test, type Page } from '@playwright/test';
import { formatClock } from '../../src/lib/timeFormat';
import type { ChartView } from '../../src/model';
import { shownInstant } from './deskPages';
import { NINE_DAYS_ON, seedStoredRun } from './liveHelpers';
import { NEUQUEN } from './observers';

/** The stored run at Neuquén with `chartView` saved, or nothing saved, and the live page reached by its hash. */
async function openLive(page: Page, chartView?: ChartView, hash = '#live'): Promise<void> {
  await seedStoredRun(page, { settled: true, prefs: { chartView } });
  await page.evaluate((to) => {
    window.location.hash = to;
  }, hash);
  await expect(page.getByTestId('live-layout')).toBeVisible({ timeout: 30_000 });
}

const drawing = (page: Page) => page.getByTestId('live-dome');

test.describe('on a desk', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test('FR-LAND-2, FR-STRIP-4: the globe, at real time, the clock advancing by real seconds', async ({ page }) => {
    await openLive(page);
    await expect(drawing(page).locator('[data-globe]')).toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('time-control')).toHaveAttribute('data-state', 'watching');
    // The seed's clock is fixed, so each second is set. The page's 10 s tick could show one of them, never all three.
    for (const second of [1, 2, 3]) {
      const at = NINE_DAYS_ON + second * 1_000;
      await page.clock.setFixedTime(at);
      await expect(page.getByTestId('live-clock')).toContainText(formatClock(at, 'UTC', 'en').slice(0, 8), { timeout: 3_000 });
    }
    await expect(page).toHaveURL(/#live$/);
  });

  test('FR-LAND-2: a stored Window wins', async ({ page }) => {
    await openLive(page, 'window');
    await expect(drawing(page).locator('[data-look-az]')).toBeAttached({ timeout: 30_000 });
    await expect(drawing(page).locator('[data-globe]')).toHaveCount(0);
  });

  test('FR-LIVE-9, FR-STRIP-4: a link’s t opens that instant paused', async ({ page }) => {
    const t = NINE_DAYS_ON + 3_600_000;
    await openLive(page, undefined, `#live?lat=${String(NEUQUEN.lat)}&lon=${String(NEUQUEN.lon)}&alt=0&t=${new Date(t).toISOString()}`);
    await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
    await expect.poll(() => shownInstant(page.getByTestId('live-layout'))).toBe(t);
  });

  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`FR-STRIP-4: a pass page ${motion === 'reduce' ? 'stays at the rise under reduced motion' : 'plays at 60×, its instant past the rise'}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await seedStoredRun(page, { settled: true, prefs: { chartView: undefined } });
      await page.getByTestId('pass-link').click();
      const layout = page.getByTestId('pass-layout');
      await expect(layout).toBeVisible({ timeout: 30_000 });
      const id = (await page.getByTestId('guide-panel').getAttribute('data-pass-id')) ?? '';
      const rise = Number(/-(\d+)$/.exec(id)?.[1]);
      await expect(layout.getByTestId('live-play')).toHaveAttribute('data-playing', String(motion !== 'reduce'));
      if (motion === 'reduce') await expect.poll(() => shownInstant(layout)).toBe(rise);
      else await expect.poll(() => shownInstant(layout), { timeout: 10_000 }).toBeGreaterThan(rise);
    });
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('FR-LAND-2: the window, at real time, not playing', async ({ page }) => {
    await openLive(page);
    await expect(drawing(page).locator('[data-look-az]')).toBeAttached({ timeout: 30_000 });
    await expect(page.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
    await expect(page).toHaveURL(/#live$/);
  });

  test('FR-LAND-2: a stored Dome wins', async ({ page }) => {
    await openLive(page, 'dome');
    await expect(drawing(page).locator('[data-look-az]')).toHaveCount(0);
    await expect(page.getByTestId('live-layout')).toBeVisible();
  });
});
