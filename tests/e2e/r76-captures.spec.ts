/**
 * R76 captures (FR-FIRST-7): the first run and the three readings.
 *
 *   CAPTURES=1 npx playwright test r76-captures --project=chromium
 *
 * The cold open at 390 × 844 and 1280 × 800; the populated home at 390 × 844
 * with the location line collapsed and once `[ change ]` has opened it, at
 * 1024 × 768 (two columns) and at 1280 × 800 (three panes) — each in both
 * themes and both languages; and the three-pane page with a pass open at
 * 1280 × 800, one theme, both languages. The phone captures are the whole
 * page, since the readings are one column that scrolls; the desk ones are the
 * viewport, which is the whole page there (D-119).
 *
 * Evidence for the PR, not a test. Off the pull-request path (FR-CI-1's
 * budget), like every other capture spec. The theme and the language are
 * seeded in `wiys:prefs:v1` and never clicked (D-70).
 */
import { expect, test, type Page } from '@playwright/test';
import { CAPTURE_DIR } from './captureSet';
import { NINE_DAYS_ON, seedStoredRun, stubNetwork } from './liveHelpers';

test.skip(process.env['CAPTURES'] !== '1', 'captures run with CAPTURES=1 (FR-CI-1, FR-CI-2)');

type Theme = 'dark' | 'night';
type Locale = 'en' | 'es';

const THEMES: readonly Theme[] = ['dark', 'night'];
const LOCALES: readonly Locale[] = ['en', 'es'];

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
}

async function coldOpen(page: Page, theme: Theme, locale: Locale): Promise<void> {
  await page.clock.setFixedTime(NINE_DAYS_ON);
  await stubNetwork(page);
  await page.addInitScript(
    ([key, value]: [string, string]) => {
      localStorage.setItem(key, value);
    },
    ['wiys:prefs:v1', JSON.stringify({ locale, theme })] as [string, string],
  );
  await page.goto('/');
  await expect(page.getByTestId('cold-open')).toBeVisible();
  await settle(page);
}

for (const [label, size] of [
  ['390', { width: 390, height: 844 }],
  ['1280', { width: 1280, height: 800 }],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the cold open at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await coldOpen(page, theme, locale);
        await page.screenshot({ path: `${CAPTURE_DIR}/r76-cold-${label}-${theme}-${locale}.png`, fullPage: label === '390' });
      });
    }
  }
}

for (const [label, size, expand] of [
  ['390-collapsed', { width: 390, height: 844 }, false],
  ['390-expanded', { width: 390, height: 844 }, true],
  ['1024', { width: 1024, height: 768 }, false],
  ['1280', { width: 1280, height: 800 }, false],
] as const) {
  for (const theme of THEMES) {
    for (const locale of LOCALES) {
      test(`the populated home at ${label}, ${theme}, ${locale}`, async ({ page }) => {
        await page.setViewportSize(size);
        await seedStoredRun(page, { locale, prefs: { theme }, settled: true });
        await expect(page.getByTestId('next-event-headline')).toBeVisible();
        if (expand) {
          await page.getByTestId('location-summary-change').click();
          await expect(page.getByTestId('location-group')).toBeVisible();
          await page.mouse.move(0, 0);
        }
        await settle(page);
        await page.screenshot({ path: `${CAPTURE_DIR}/r76-home-${label}-${theme}-${locale}.png`, fullPage: size.width === 390 });
      });
    }
  }
}

for (const locale of LOCALES) {
  test(`the three panes with a pass open at 1280, dark, ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStoredRun(page, { locale, settled: true });
    await page.getByTestId('iss-hero').getByRole('button').first().click();
    const panel = page.getByTestId('guide-panel');
    await expect(panel).toBeVisible();
    // The capture is only evidence once the lazy chart chunk has drawn.
    await expect(panel.locator('[data-layer="lines"] [data-anchor="key"]').first()).toHaveText('A', { timeout: 30_000 });
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: `${CAPTURE_DIR}/r76-pane-1280-dark-${locale}.png` });
  });
}
