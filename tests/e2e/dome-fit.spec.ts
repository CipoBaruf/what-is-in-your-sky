/**
 * FR-DOME-1 as amended (v1.2, D-279, F-54): the fit rule past the two sizes
 * R54's ceiling test pinned (1280 × 800, 1920 × 1080) — at 2560 × 1440, and at
 * 1280 × 800 doubled by a device pixel ratio of 2, on the live page and on the
 * pass detail's guide sheet. `colsFor` caps the raster at 120 columns and
 * `layoutFor` used to cap the cell at 12 px, so past 1440 CSS px of width the
 * raster fell short of the box while the drawing was still sized from it,
 * cutting the east and west columns; `camera.test.ts` holds the unit-level
 * fix, this file measures the real, painted raster — the lines layer's
 * `<pre>` and every label, F-51's half-cell snap and all — against the
 * `chart-box` it is drawn in on a real page: inside it, and covering at least
 * 90 % of its shorter side.
 *
 * Runs in its own `desktop-2560` Playwright project (`playwright.config.ts`),
 * never at the default project's 1280 × 720.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { domeDrawn, seedStoredRun, stripFilled } from './liveHelpers';

interface Reference {
  firstGoldenPass: { start: { t: number } } | null;
}
const reference = JSON.parse(readFileSync('tests/fixtures/reference-values.json', 'utf8')) as Reference;
const golden = reference.firstGoldenPass;
if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
const PASS_ID = `25544-${String(golden.start.t)}`;

const MIN_EXTENT_RATIO = 0.9;
/** Sub-pixel rounding (worse at a device pixel ratio of 2), and the label snap the unit side already accounts for. */
const FIT_EPS_PX = 3;

/** The raster's own painted extent: the lines layer's `<pre>` and every label (`[data-side]`), F-54's ceiling. */
async function paintedExtent(drawing: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  return drawing.evaluate((el) => {
    // A tick behind the dome (D-56's ring runs all the way round) is `display: none` rather than
    // drawn off-box, and reports an all-zero rect — excluded, or it would drag the extent to (0, 0).
    const rects = Array.from(el.querySelectorAll('pre.glyph-output, [data-side]'))
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
}

/** FR-DOME-1 v1.2: the raster stays inside its box, and covers at least 90 % of the box's shorter side. */
async function expectFit(chartBox: Locator, drawing: Locator): Promise<void> {
  const box = await chartBox.boundingBox();
  if (!box) throw new Error('no chart box');
  const extent = await paintedExtent(drawing);
  expect(extent.x).toBeGreaterThanOrEqual(box.x - FIT_EPS_PX);
  expect(extent.y).toBeGreaterThanOrEqual(box.y - FIT_EPS_PX);
  expect(extent.x + extent.width).toBeLessThanOrEqual(box.x + box.width + FIT_EPS_PX);
  expect(extent.y + extent.height).toBeLessThanOrEqual(box.y + box.height + FIT_EPS_PX);
  const shorter = Math.min(box.width, box.height);
  expect(Math.max(extent.width, extent.height)).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO * shorter);
}

/** The live page, the dome drawn, at a viewport this context was created with. */
async function openLive(page: Page): Promise<void> {
  await seedStoredRun(page, { settled: true });
  await page.getByTestId('live-link').click();
  await domeDrawn(page);
  await stripFilled(page);
}

/**
 * The golden ISS pass's guide, on the dome (FR-DOME-7). Both target
 * viewports are past `WIDE_SPLIT_MIN_PX` (desktop.spec.ts), where the guide
 * is the inline `guide-panel` beside the list (R50) rather than the sheet's
 * `role="dialog"` a narrower page would show.
 */
async function openPassDetail(page: Page): Promise<Locator> {
  await seedStoredRun(page, { settled: true });
  await page.locator(`article[data-pass-id="${PASS_ID}"]`).getByRole('button', { name: /Open guide/ }).click();
  const panel = page.getByTestId('guide-panel');
  await expect(panel.locator('[data-layer="lines"] pre.glyph-output')).toBeVisible({ timeout: 30_000 });
  return panel;
}

test.describe('at 2560 × 1440', () => {
  test.use({ viewport: { width: 2560, height: 1440 } });

  test('the live page fits its box', async ({ page }) => {
    await openLive(page);
    const dome = page.getByTestId('live-dome');
    await expectFit(dome.getByTestId('chart-box'), dome.locator('[data-drawing="dome"]'));
  });

  test('the pass detail fits its box', async ({ page }) => {
    const panel = await openPassDetail(page);
    await expectFit(panel.getByTestId('chart-box'), panel.locator('[data-drawing="dome"]'));
  });
});

test.describe('at 1280 × 800, device pixel ratio 2', () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

  test('the live page fits its box', async ({ page }) => {
    await openLive(page);
    const dome = page.getByTestId('live-dome');
    await expectFit(dome.getByTestId('chart-box'), dome.locator('[data-drawing="dome"]'));
  });

  test('the pass detail fits its box', async ({ page }) => {
    const panel = await openPassDetail(page);
    await expectFit(panel.getByTestId('chart-box'), panel.locator('[data-drawing="dome"]'));
  });
});
