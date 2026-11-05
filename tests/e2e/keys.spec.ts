/**
 * R189 (FR-WIDE-9, US-56 AC1; D-1102): the desk keys on each of the three sky pages at 1280 × 800 — `g` `w` `d` choose
 * the view, `,` `.` step the shown instant an hour, `t` returns to now, `Space` plays and pauses (and presses a focused
 * button instead, as the browser does), `?` lists every key. `a` facing the pass is `sky-window.spec.ts`'s (the live
 * page's window with a pass to face); `f` is `fullscreen.spec.ts`'s.
 */
import { expect, test } from '@playwright/test';
import { HOUR_MS } from '../../src/lib/timeStripe';
import { DESK_PAGES, openDeskPage, playState, shownInstant, shownView, timeState } from './deskPages';

test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

for (const which of DESK_PAGES) {
  test.describe(`FR-WIDE-9 on the ${which} page`, () => {
    test('g w d choose the view', async ({ page }) => {
      const layout = await openDeskPage(page, which);
      expect(await shownView(layout)).toBe('globe');
      for (const [key, view] of [
        ['w', 'window'],
        ['d', 'dome'],
        ['g', 'globe'],
      ] as const) {
        await page.keyboard.press(key);
        await expect.poll(() => shownView(layout), { timeout: 30_000 }).toBe(view);
      }
    });

    test(', and . step the instant an hour, t returns to now, Space plays and pauses', async ({ page }) => {
      const layout = await openDeskPage(page, which);
      // v2.14.1 (D-1137): the pass page opens held at its pass's rise, the other two at now; the steps are from there.
      await expect(timeState(layout)).toHaveAttribute('data-state', which === 'pass' ? 'scrubbing' : 'watching', { timeout: 30_000 });
      const now = await shownInstant(layout);
      await page.keyboard.press('.');
      await expect(timeState(layout)).toHaveAttribute('data-state', 'scrubbing');
      await page.keyboard.press('.');
      await expect.poll(() => shownInstant(layout)).toBe(now + 2 * HOUR_MS);
      await page.keyboard.press(',');
      await expect.poll(() => shownInstant(layout)).toBe(now + HOUR_MS);
      await page.keyboard.press('t');
      await expect(timeState(layout)).toHaveAttribute('data-state', 'watching');

      await page.keyboard.press(' ');
      const play = playState(layout);
      await expect(play).toHaveAttribute('data-playing', 'true');
      await page.keyboard.press(' ');
      await expect(play).toHaveAttribute('data-playing', 'false');
      await page.keyboard.press('t');
      await expect(timeState(layout)).toHaveAttribute('data-state', 'watching');
    });

    test('Space on a focused button is the button, and ? lists every key', async ({ page }) => {
      const layout = await openDeskPage(page, which);
      await layout.locator('[data-slot="viewRow"]').getByRole('button', { name: /^(\[ )?Window( \])?$/ }).focus();
      await page.keyboard.press(' ');
      await expect.poll(() => shownView(layout), { timeout: 30_000 }).toBe('window');
      // Nothing played: the instant is still real time (no playback row; the stars page's window has no time control) —
      // on the pass page, still held at the rise and paused (v2.14.1, D-1137).
      if (which === 'pass') await expect(layout.getByTestId('live-play')).toHaveAttribute('data-playing', 'false');
      else await expect(layout.getByTestId('live-play')).toHaveCount(0);

      await page.keyboard.press('?');
      const overlay = page.getByTestId('shortcuts-overlay');
      await expect(overlay).toBeVisible();
      await expect(overlay.getByTestId('shortcuts-sky-keys').locator('kbd')).toHaveText(['g', 'w', 'd', ',', '.', 't', 'Space', 'a', 'f']);
      // Behind the overlay the page is inert, and its keys with it.
      await page.keyboard.press('g');
      await page.keyboard.press('Escape');
      await expect(overlay).toHaveCount(0);
      await expect(layout).toBeVisible();
      expect(await shownView(layout)).toBe('window');
    });
  });
}
