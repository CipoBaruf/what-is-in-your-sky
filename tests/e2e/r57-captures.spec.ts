/**
 * R57 (FR-DOME-1 as amended v1.2, D-279, F-54): the fit-rule captures the
 * task asks for — the live page at 2560 × 1440 dark English, and the pass
 * detail at 1280 × 800 both themes. Reuses `dome-fit.spec.ts`'s page-reaching
 * helpers; this file only screenshots, `dome-fit.spec.ts` asserts the fit.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { domeDrawn, seedStoredRun, setThemeOnHome, stripFilled } from './liveHelpers';

interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const golden = reference.firstGoldenPass;
if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
const PASS_ID = `25544-${String(golden.start.t)}`;

async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

async function openPassDetail(page: Page): Promise<Locator> {
  await seedStoredRun(page, { settled: true });
  await page.locator(`article[data-pass-id="${PASS_ID}"]`).getByRole('button', { name: /Open guide/ }).click();
  const panel = page.getByTestId('guide-panel');
  await expect(panel.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  // D-119: the panel body scrolls, and the dome is below the pass summary text.
  await panel.locator('[data-drawing="dome"]').scrollIntoViewIfNeeded();
  return panel;
}

test.describe('at 2560 × 1440', () => {
  test.use({ viewport: { width: 2560, height: 1440 } });

  test('the live page, dark, English', async ({ page }) => {
    await openLive(page);
    await page.screenshot({ path: 'test-results/r57-live-2560-dark-en.png' });
  });
});

test.describe('at 1280 × 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the pass detail, dark, English', async ({ page }) => {
    const panel = await openPassDetail(page);
    await expect(panel.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible();
    await page.screenshot({ path: 'test-results/r57-guide-1280-dark-en.png' });
  });

  test('the pass detail, night, English', async ({ page }) => {
    await seedStoredRun(page, { settled: true });
    await setThemeOnHome(page, 'en', 'night');
    await page.locator(`article[data-pass-id="${PASS_ID}"]`).getByRole('button', { name: /Open guide/ }).click();
    const panel = page.getByTestId('guide-panel');
    await expect(panel.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
    await panel.locator('[data-drawing="dome"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/r57-guide-1280-night-en.png' });
  });
});
