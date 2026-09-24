/**
 * R96 captures (FR-A11Y-7): what the axe run changed on screen — the wide cold open's ghost stripe, whose hours
 * are now the pane's `--fg-dim` with only the bar in `--rule`, in both themes; and the guide's numbers table on
 * a phone, its sideways-scrolling box now a stop in the Tab order, shown focused.
 *
 * Evidence for the PR, not a test; off the pull-request path (FR-CI-1):
 *
 *   CAPTURES=1 npx playwright test r96-captures --project=chromium
 */
import { expect, test } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { NINE_DAYS_ON } from './observers';
import { seedStoredRun, stubNetwork } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

for (const theme of ['dark', 'night'] as const) {
  test(`cold home at 1280 px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.clock.setFixedTime(NINE_DAYS_ON);
    await stubNetwork(page);
    await page.addInitScript((value: string) => localStorage.setItem('wiys:prefs:v1', value), JSON.stringify({ locale: 'en', theme }));
    await page.goto('/');
    await expect(page.getByTestId('ghost-when')).toBeVisible();
    await page.screenshot({ path: `${CAPTURE_DIR}/r96-home-cold-1280-${theme}.png` });
  });
}

test('the guide at 390 px with the numbers table focused', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedStoredRun(page, { settled: true });
  // By the keyboard, as a reader reaches it: a mouse click would leave the ring off (`:focus-visible`).
  await page.getByRole('button', { name: 'Open guide' }).first().focus();
  await page.keyboard.press('Enter');
  const box = page.getByRole('region', { name: /Start, peak and end/ });
  await expect(box).toBeVisible();
  for (let presses = 0; presses < 40 && !(await box.evaluate((element) => element === document.activeElement)); presses++) await page.keyboard.press('Tab');
  await expect(box).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.screenshot({ path: `${CAPTURE_DIR}/r96-guide-390-numbers-focus.png` });
});
