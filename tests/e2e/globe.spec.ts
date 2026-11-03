/**
 * R170 (FR-GLOBE-1, FR-GLOBE-6..9, FR-GLOBE-15, FR-GLOBE-16; US-50 AC1, AC4..AC7; D-1035, D-1039, D-1040, D-1042):
 * the wide stars page's globe in a browser, at 1280 × 800 and 1920 × 1080 — the view row, the breakpoint crossing
 * with the globe chosen, a drag, the box's keys, the steps, ×3600 under a paused `page.clock`, a saved place, the Tab
 * order through the rail, the hash unchanged throughout; and at 390 × 844 the compact page, which never asks for
 * `SkyGlobe-*.js`.
 */
import { expect, test, type Page } from '@playwright/test';
import { globeAt, GLOBE_WORD, LONDON, openStarsPage, showGlobe } from './globeHelpers';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Where the zenith's and the north pole's marks are drawn, to the pixel: the view's turn, read off the renderer's attributes. */
async function zenith(page: Page): Promise<string> {
  const read = async (selector: string): Promise<string> => {
    const mark = page.locator(`[data-globe] ${selector}`);
    return [await mark.getAttribute('x'), await mark.getAttribute('y'), await mark.getAttribute('visibility')].join(',');
  };
  return `${await read('[data-zenith]')} ${await read('[data-pole="north"]')}`;
}

const DESKS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

for (const viewport of DESKS) {
  test.describe(`the globe at ${String(viewport.width)} × ${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('reads [ Window ] Globe, draws the globe in the box, and keeps the choice across the breakpoint (FR-GLOBE-1)', async ({ page }) => {
      await openStarsPage(page);
      const hash = await page.evaluate(() => window.location.hash);
      const row = page.getByTestId('stars-view-row');
      await expect(row.getByRole('button')).toHaveText(['Window', 'Globe']);
      await showGlobe(page);
      await expect(page.locator('[data-drawing]')).toHaveCount(0);
      // The globe's box is the window's: it stands where the window stood, beside the rail.
      const box = await page.getByTestId('globe-box').boundingBox();
      const rail = await page.getByTestId('globe-groups').boundingBox();
      expect(box && rail && box.x + box.width <= rail.x).toBe(true);
      // Compact: the polar chart, the row in the sheet reading Whole sky; back to wide: the globe.
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator('[data-drawing="polar"]')).toBeAttached({ timeout: 30_000 });
      await expect(page.getByTestId('globe-box')).toHaveCount(0);
      // The sheet is closed, so its row is inert: read its buttons' words, not their roles.
      await expect(row.locator('button')).toHaveText(['Window', 'Whole sky']);
      await page.setViewportSize(viewport);
      await expect(page.getByTestId('globe-box')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-drawing]')).toHaveCount(0);
      expect(await page.evaluate(() => window.location.hash)).toBe(hash);
    });

    test('turns under a drag and the box’s keys, and Home returns to the opening view (FR-GLOBE-6)', async ({ page }) => {
      await openStarsPage(page);
      await showGlobe(page);
      const box = page.getByTestId('globe-box');
      const before = await zenith(page);
      const rect = await box.boundingBox();
      if (!rect) throw new Error('the globe has no box');
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= 10; i += 1) await page.mouse.move(cx + i * 8, cy - i * 4);
      await page.mouse.up();
      await expect.poll(() => zenith(page)).not.toBe(before);
      // The first gesture puts the hint away, which can give a height-bound box a few pixels: the opening view is read
      // after it, from Home.
      await box.focus();
      await page.keyboard.press('Home');
      await page.waitForTimeout(200);
      const opening = await zenith(page);
      await page.keyboard.press('ArrowUp');
      await expect.poll(() => zenith(page)).not.toBe(opening);
      await page.keyboard.press('Home');
      await expect.poll(() => zenith(page)).toBe(opening);
      await page.keyboard.press('Home');
      await page.keyboard.press('+');
      await expect.poll(() => zenith(page)).not.toBe(opening);
      await page.keyboard.press('Home');
      await expect.poll(() => zenith(page)).toBe(opening);
    });

    test('moves only the globe’s clock by the steps; the hash and the prefs stay (FR-GLOBE-7)', async ({ page }) => {
      await openStarsPage(page);
      await showGlobe(page);
      const hash = await page.evaluate(() => window.location.hash);
      const prefs = await page.evaluate(() => localStorage.getItem('wiys:prefs:v1'));
      const at = await globeAt(page);
      const steps = page.getByTestId('globe-steps');
      await steps.getByRole('button', { name: 'A day later' }).click();
      await expect.poll(() => globeAt(page)).toBe(at + DAY_MS);
      await steps.getByRole('button', { name: 'An hour earlier' }).click();
      await expect.poll(() => globeAt(page)).toBe(at + DAY_MS - HOUR_MS);
      await expect(page.getByTestId('globe-chip')).not.toHaveAttribute('data-kind', 'now');
      await page.getByTestId('globe-now').click();
      await expect(page.getByTestId('globe-chip')).toHaveAttribute('data-kind', 'now');
      expect(await page.evaluate(() => window.location.hash)).toBe(hash);
      expect(await page.evaluate(() => localStorage.getItem('wiys:prefs:v1'))).toBe(prefs);
    });

    test('×3600 for one second of wall time under a paused clock moves the globe an hour, and the hash stays (FR-GLOBE-7)', async ({ page }) => {
      await openStarsPage(page, { clock: 'installed' });
      await showGlobe(page);
      const hash = await page.evaluate(() => window.location.hash);
      const now = await page.evaluate(() => Date.now());
      await page.clock.pauseAt(now + 1_000);
      const fast = page.getByTestId('globe-speeds').getByRole('button', { name: 'Time-lapse at 3600 times real time' });
      await fast.click();
      await expect(fast).toHaveAttribute('aria-pressed', 'true');
      const from = await globeAt(page);
      await page.clock.runFor(1_000);
      const moved = (await globeAt(page)) - from;
      // One second of frames at ×3600: an hour, give or take the frames at either end.
      expect(Math.abs(moved - HOUR_MS), `moved ${String(moved)} ms`).toBeLessThanOrEqual(3 * 3_600 * 17);
      await fast.click();
      await expect(fast).toHaveAttribute('aria-pressed', 'false');
      expect(await page.evaluate(() => window.location.hash)).toBe(hash);
    });

    test('moves the globe to a saved place: the clock’s zone and the list follow, the app’s place stays (FR-GLOBE-8, FR-GLOBE-9)', async ({ page }) => {
      await openStarsPage(page, { favourites: [LONDON] });
      await showGlobe(page);
      const prefs = await page.evaluate(() => localStorage.getItem('wiys:prefs:v1'));
      const places = page.getByTestId('globe-place');
      await expect(places.getByRole('button')).toHaveCount(2);
      const at = await globeAt(page);
      await places.getByRole('button', { name: 'London' }).click();
      await expect(places.getByRole('button', { name: 'London' })).toHaveAttribute('aria-pressed', 'true');
      // The suite's night is in September: London keeps summer time.
      await expect(page.getByTestId('globe-clock')).toContainText(/GMT\+1|BST/);
      await expect(page.getByRole('heading', { name: 'Up from London' })).toBeVisible();
      await expect(page.getByTestId('stars-sky')).toHaveAttribute('aria-label', /over London/);
      expect(await globeAt(page)).toBe(at);
      expect(await page.evaluate(() => localStorage.getItem('wiys:prefs:v1'))).toBe(prefs);
    });

    test('Tabs through the view row, the box and the rail in reading order (FR-GLOBE-16)', async ({ page }) => {
      await openStarsPage(page, { favourites: [LONDON] });
      await showGlobe(page);
      await page.getByTestId('stars-view-row').getByRole('button', { name: GLOBE_WORD.en }).focus();
      const seen: string[] = [];
      for (let i = 0; i < 24; i += 1) {
        await page.keyboard.press('Tab');
        seen.push(
          await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el) return '';
            return el.dataset['testid'] ?? el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
          }),
        );
      }
      const order = ['globe-box', 'A day earlier', 'A day later', 'globe-now', 'Time-lapse at 3600 times real time', 'with the stars', 'London', 'faint'];
      // The rail's scrolling row is a stop of its own (a scroll container takes the focus in Chromium): names are matched whole.
      const at = order.map((name) => seen.indexOf(name));
      expect(at.every((index) => index >= 0), seen.join(' | ')).toBe(true);
      expect([...at].sort((a, b) => a - b), seen.join(' | ')).toEqual(at);
      // The box is the first stop after the view row.
      expect(seen[0]).toBe('globe-box');
    });
  });
}

test.describe('the compact stars page', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('never asks for SkyGlobe-*.js, the whole sky drawn as the polar chart (FR-GLOBE-1, FR-GLOBE-15)', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (/SkyGlobe-|GlobeRail-/.test(request.url())) asked.push(request.url());
    });
    await openStarsPage(page);
    await page.getByTestId('live-controls').click();
    await page.getByTestId('stars-view-row').getByRole('button', { name: 'Whole sky' }).click();
    await expect(page.locator('[data-drawing="polar"]')).toBeAttached({ timeout: 30_000 });
    // Past the idle the wide page prefetches on.
    await page.waitForTimeout(1_500);
    expect(asked).toEqual([]);
    await expect(page.getByTestId('globe-box')).toHaveCount(0);
  });
});
