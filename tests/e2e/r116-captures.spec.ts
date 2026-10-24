/**
 * R116 (FR-STAR-6 as amended, V24-22, V24-23; D-755, D-778, D-779): the names
 * for the review — Orion over Paris and Crux over Neuquén at 390 × 844 and
 * 1280 × 800, both themes, under `docs/screenshots/r116/`. The camera is the
 * hand's, turned with the facing picker and the arrow keys onto each figure's
 * mean direction (Orion 165° / 47°, Crux 169° / 68° at these instants). The
 * figure's name is placed at both widths; `Betelgeuse` at 1280 only, as
 * V24-23 reads the task's Done (at 390 a tap names it). The names are the
 * IAU's and the Latin, the same in both languages, so the set is English.
 */
import { expect, test, type Page } from '@playwright/test';
import type { Observer } from '../../src/model';
import { CAPTURE_DIR } from './captureSet';
import { NEUQUEN, PARIS } from './observers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');
test.use({ serviceWorkers: 'block' });

const EXTERNAL = ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**'];

const CASES = [
  // From the picker's S (180°, 35°): ← is 15° left, ↑ 5° up.
  { name: 'orion-paris', observer: PARIS, iso: '2026-12-15T23:00:00Z', con: 'Ori', figure: { 390: 'O R I O N', 1280: 'O R I O N' }, keys: ['ArrowLeft', 'ArrowUp', 'ArrowUp'] },
  { name: 'crux-neuquen', observer: NEUQUEN, iso: '2027-04-15T03:00:00Z', con: 'Cru', figure: { 390: 'C R U', 1280: 'C R U' }, keys: ['ArrowLeft', ...Array<string>(7).fill('ArrowUp')] },
] as const;

async function open(page: Page, observer: Observer, iso: string, theme: 'dark' | 'night'): Promise<void> {
  await page.clock.setFixedTime(Date.parse(iso));
  for (const pattern of EXTERNAL) await page.route(pattern, (route) => route.abort('failed'));
  await page.addInitScript((prefs: string) => {
    localStorage.setItem('wiys:prefs:v1', prefs);
  }, JSON.stringify({ locale: 'en', theme, observer }));
  await page.goto('/#stars');
  await expect.poll(async () => page.getByTestId('field-list').getByRole('button').count()).toBeGreaterThan(0);
}

for (const c of CASES) {
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    for (const theme of ['dark', 'night'] as const) {
      test(`${c.name} at ${String(width)} × ${String(height)}, ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await open(page, c.observer, c.iso, theme);
        await page.getByRole('group', { name: 'Facing' }).locator('[data-option="S"]').click();
        const sky = page.getByTestId('stars-sky');
        await sky.locator('[tabindex="0"]').focus();
        for (const key of c.keys) await page.keyboard.press(key);
        const figureName = sky.locator(`[data-figure-name][data-con="${c.con}"][visibility="visible"]`);
        await expect.poll(async () => figureName.allTextContents()).toContain(c.figure[width]);
        const betelgeuse = sky.locator('[data-star-name][visibility="visible"]', { hasText: 'Betelgeuse' });
        if (c.con === 'Ori') await expect(betelgeuse).toHaveCount(width === 1280 ? 1 : 0);
        // The focus ring off the picture for the review.
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
        });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${CAPTURE_DIR}/r116/r116-${c.name}-${String(width)}-${theme}.png`, fullPage: width < 964 });
      });
    }
  }
}
