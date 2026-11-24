/**
 * R222 (FR-LAND-3, FR-STAR-3 as amended, FR-CTRL-15; US-62 AC3; D-1230, D-1240): the stars page's groups on `#live`.
 * Each layer toggled at 1280 × 800 (on the globe, `[ ] faint` among them) and at 390 × 844 (in the sheet); `Up from
 * <place>`'s rows follow the layers; a picked mark's facts open in the rail, and `Esc` closes them and leaves the page
 * where it is — live is a tab, with no back.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { clickFirstRowMark } from './factsHelpers';
import { domeDrawn, openSheet, seedStoredRun } from './liveHelpers';

const LAYERS = ['stars', 'figures', 'planets', 'names'] as const;

async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
}

/** `Up from <place>`'s rows of one kind. */
const rows = (page: Page, kind: 'star' | 'planet'): Locator => page.getByTestId('live-up-from').locator(`[data-testid="field-list"] button[data-kind="${kind}"]`);

/** Each toggle is on, turns off, and turns back on; stars and planets leave `Up from <place>` while they are off. */
async function toggleEach(page: Page, layers: Locator, names: readonly string[]): Promise<void> {
  await expect.poll(() => rows(page, 'star').count(), { timeout: 30_000 }).toBeGreaterThan(0);
  for (const name of names) {
    const toggle = layers.locator(`[data-layer="${name}"]`);
    await expect(toggle, name).toHaveAttribute('aria-pressed', name === 'faint' ? 'false' : 'true');
    await toggle.click();
    await expect(toggle, name).toHaveAttribute('aria-pressed', name === 'faint' ? 'true' : 'false');
    if (name === 'stars') await expect(rows(page, 'star')).toHaveCount(0);
    if (name === 'planets') await expect(rows(page, 'planet')).toHaveCount(0);
    await toggle.click();
    await expect(toggle, name).toHaveAttribute('aria-pressed', name === 'faint' ? 'false' : 'true');
  }
  await expect.poll(() => rows(page, 'star').count()).toBeGreaterThan(0);
}

test.describe('at 1280 × 800', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });

  test('FR-LAND-3: each layer toggles on the globe, [ ] faint with them, and on the dome without it', async ({ page }) => {
    await openLive(page);
    const layout = page.getByTestId('live-layout');
    const layers = layout.locator('[data-slot="layers"]');
    // The dome: the four layers, no `[ ] faint` (it is the globe's deep catalogue, FR-GLOBE-10).
    await expect(layers.locator('[data-layer="faint"]')).toHaveCount(0);
    await toggleEach(page, layers, LAYERS);
    await layout.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Globe' }).click();
    await expect(page.getByTestId('sky-chart')).toHaveAttribute('data-view', 'globe');
    await toggleEach(page, layers, [...LAYERS, 'faint']);
    // The figures layer draws the globe's figure lines; off, none is drawn.
    const drawn = () => page.locator('[data-globe] [data-figure-lines] path').evaluateAll((paths) => paths.filter((path) => /M/.test(path.getAttribute('d') ?? '')).length);
    await expect.poll(drawn).toBeGreaterThan(0);
    await layers.locator('[data-layer="figures"]').click();
    await expect.poll(drawn).toBe(0);
  });

  test('FR-LAND-3, FR-FACT-3, D-1230: a picked mark’s facts open in the rail; Esc closes them and the page stays', async ({ page }) => {
    await openLive(page);
    await page.getByTestId('live-layout').getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Globe' }).click();
    await expect(page.locator('svg[data-globe][viewBox]')).toBeAttached({ timeout: 30_000 });
    const kind = await clickFirstRowMark(page);
    const group = page.getByTestId('facts-group');
    await expect(group).toBeVisible({ timeout: 30_000 });
    await expect(group).toHaveAttribute('data-facts', kind);
    await page.keyboard.press('Escape');
    await expect(group).toHaveCount(0);
    await expect(page).toHaveURL(/#live$/);
    // Nothing open: Esc has nothing to close, and live has no back.
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/#live$/);
    await expect(page.getByTestId('live-page')).toBeVisible();
  });

  test('FR-CTRL-15: a row of Up from <place> has no frame, and the picked one is marked', async ({ page }) => {
    await openLive(page);
    const first = page.getByTestId('live-up-from').locator('[data-testid="field-list"] button').first();
    await expect(first).toBeVisible({ timeout: 30_000 });
    expect(await first.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('none');
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('at 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('FR-LAND-3: each layer toggles in the sheet, with no Turn and no [ ] faint', async ({ page }) => {
    await openLive(page);
    await openSheet(page);
    const layers = page.getByTestId('sheet-body').getByTestId('live-layers');
    await expect(layers.locator('[data-layer="faint"]')).toHaveCount(0);
    await expect(page.getByTestId('globe-turn')).toHaveCount(0);
    await toggleEach(page, layers, LAYERS);
  });
});
