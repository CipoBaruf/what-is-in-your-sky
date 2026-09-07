/**
 * FR-DOME-1 as amended (v1.2, D-279, F-54): the fit rule past the two sizes
 * R54's ceiling test pinned (1280 × 800, 1920 × 1080) — at 2560 × 1440, and at
 * 1280 × 800 doubled by a device pixel ratio of 2, on the live page and on the
 * pass detail's guide sheet. `colsFor` caps the raster at 120 columns and
 * `layoutFor` used to cap the cell at 12 px, so past 1440 CSS px of width the
 * raster fell short of the box while the drawing was still sized from it,
 * cutting the east and west columns; `camera.test.ts` holds the unit-level fix
 * and this file measures the painted page.
 *
 * It measures the *ink*, not the elements. A `<pre>` element is the raster
 * grid, and after D-279 the grid covers the box by construction, so its rect
 * against the box is near-tautological — at 2560 × 1440 the `<pre>` is
 * 2271 px wide in a 2271 px box while the drawing inside it, labels and all,
 * is 1507 px, so "inside the box" and "90 % of the shorter side" hold however
 * the dome is drawn. Each layer's `<pre>` is read as text instead: the cells that are
 * neither a space nor U+2800 BRAILLE PATTERN BLANK give the ink's row and
 * column range, which the grid's own cell size turns back into CSS pixels.
 * The labels are real elements and keep their rects. Two things are asserted,
 * and it takes the second to see F-54:
 *
 *   - the ink and the labels together stay inside the `chart-box` and cover at
 *     least 90 % of its shorter side — FR-DOME-1's rule, now about the drawing
 *     rather than about the grid it is drawn on;
 *   - no layer's ink reaches the first or last *column of its own grid*. This
 *     is the assertion the old rule fails. A drawing wider than its raster is
 *     not painted outside it — it is cut at the edge, so the measured extent
 *     stays inside the box and still covers 90 % of it, and only the grid it
 *     was cut against can show the loss. Measured at 2560 × 1440 on the live
 *     page: with the fix the base layer leaves 11 blank columns west and 10
 *     east of a 60-column grid, and the lines layer 23 either side of 120;
 *     with `MAX_CELL_WIDTH_PX = 12` back, the base layer's grid is 60 × 12 px
 *     = 720 px wide for a drawing `zoomFor` sized at about 1516 px and its
 *     ink runs edge to edge — 0 blank columns on both sides.
 *
 * Only the columns. The first and last *rows* carry ink in every box the app
 * draws, and legitimately: `rowsFor` floors the row count to the box, so a
 * cell is a large share of the drawing's height (75 px of a 944 px bowl on the
 * live page's base layer) and a dome that tapers smoothly still lights its top
 * and bottom row. F-54's cut is horizontal anyway — it is the cell *width*
 * cap that the column cap turns into a raster narrower than its box.
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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One raster layer of the dome: its grid, where its ink lands in CSS px, and the blank margin left around it. */
interface LayerInk {
  layer: string;
  cols: number;
  rows: number;
  ink: Rect;
  /** Blank columns between the ink and each side of the grid; 0 means the drawing runs into the edge. */
  margin: { left: number; right: number };
}

interface Painted {
  /** The ink of every layer and the labels' rects, unioned: FR-DOME-1's extent. */
  extent: Rect;
  layers: LayerInk[];
}

/**
 * What the dome actually paints. Each `[data-layer]`'s `<pre>` is read as a
 * grid of characters — the row count and the longest row are the grid, and the
 * element's own rect divides into them for the cell — so the ink's cell range
 * converts to CSS px without the page having to hand out its `DomeLayout`.
 */
async function painted(drawing: Locator): Promise<Painted> {
  return drawing.evaluate((el) => {
    // An unlit cell: a space, a non-breaking space, or U+2800 BRAILLE PATTERN BLANK.
    const blank = (ch: string): boolean => ch === ' ' || ch === '⠀' || ch === ' ';
    const layers: LayerInk[] = [];
    for (const layer of Array.from(el.querySelectorAll('[data-layer]'))) {
      const pre = layer.querySelector('pre.glyph-output');
      if (!pre) continue;
      const rect = pre.getBoundingClientRect();
      const grid = (pre.textContent ?? '').split('\n');
      // glyphcss ends the raster with a newline; that trailing '' is not a row of the grid.
      while (grid.length > 0 && grid[grid.length - 1] === '') grid.pop();
      const cols = Math.max(...grid.map((row) => row.length));
      if (grid.length === 0 || cols === 0 || rect.width === 0) continue;
      let minCol = Infinity;
      let maxCol = -Infinity;
      let minRow = Infinity;
      let maxRow = -Infinity;
      grid.forEach((row, r) => {
        for (const [c, ch] of Array.from(row).entries()) {
          if (blank(ch)) continue;
          minCol = Math.min(minCol, c);
          maxCol = Math.max(maxCol, c);
          minRow = Math.min(minRow, r);
          maxRow = Math.max(maxRow, r);
        }
      });
      if (maxCol < 0) continue;
      const cellWidthPx = rect.width / cols;
      const cellHeightPx = rect.height / grid.length;
      layers.push({
        layer: layer.getAttribute('data-layer') ?? '?',
        cols,
        rows: grid.length,
        ink: {
          x: rect.left + minCol * cellWidthPx,
          y: rect.top + minRow * cellHeightPx,
          width: (maxCol + 1 - minCol) * cellWidthPx,
          height: (maxRow + 1 - minRow) * cellHeightPx,
        },
        margin: { left: minCol, right: cols - 1 - maxCol },
      });
    }
    // A tick behind the dome (D-56's ring runs all the way round) is `display: none` rather than
    // drawn off-box, and reports an all-zero rect — excluded, or it would drag the extent to (0, 0).
    const boxes: Rect[] = Array.from(el.querySelectorAll('[data-side]'))
      .map((node) => node.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height }));
    boxes.push(...layers.map((l) => l.ink));
    const left = Math.min(...boxes.map((r) => r.x));
    const top = Math.min(...boxes.map((r) => r.y));
    const right = Math.max(...boxes.map((r) => r.x + r.width));
    const bottom = Math.max(...boxes.map((r) => r.y + r.height));
    return { extent: { x: left, y: top, width: right - left, height: bottom - top }, layers };
  });
}

/**
 * FR-DOME-1 v1.2: the painted drawing stays inside its box and covers at least
 * 90 % of the box's shorter side, and no layer's drawing is cut by the raster
 * it is drawn on (F-54, which the first two rules cannot see).
 */
async function expectFit(chartBox: Locator, drawing: Locator): Promise<void> {
  const box = await chartBox.boundingBox();
  if (!box) throw new Error('no chart box');
  const { extent, layers } = await painted(drawing);
  expect(layers.length).toBeGreaterThan(0);
  expect(extent.x).toBeGreaterThanOrEqual(box.x - FIT_EPS_PX);
  expect(extent.y).toBeGreaterThanOrEqual(box.y - FIT_EPS_PX);
  expect(extent.x + extent.width).toBeLessThanOrEqual(box.x + box.width + FIT_EPS_PX);
  expect(extent.y + extent.height).toBeLessThanOrEqual(box.y + box.height + FIT_EPS_PX);
  const shorter = Math.min(box.width, box.height);
  /*
   * D-293: the floor is asked of the raster the drawing actually has. Where a glyph advance renders
   * at the width it was asked for, the raster covers its box and the drawing is sized by the box, so
   * FR-DOME-1's floor applies to the box as written. Where the advance rounds to a whole device
   * pixel — Linux Chromium at a device pixel ratio of 1, which is what CI runs — the fitted cell is
   * narrower than `box / cols`, so 60 columns fall short of the box and the drawing, painted on that
   * raster, is short with it. The owner chose the exact column count over the last few per cent of
   * fill, so that shortfall is the accepted behaviour; `camera.test.ts` pins how far it may go
   * (0.818 of the box, and no further). What still has to hold everywhere is that the drawing fills
   * the raster it was given, which is the half of F-54 that regressed.
   */
  const rasterWidth = Math.max(
    ...layers.map(({ cols, ink, margin }) => {
      const inkCols = cols - margin.left - margin.right;
      return inkCols > 0 ? (ink.width / inkCols) * cols : ink.width;
    }),
  );
  const rasterCoversBox = rasterWidth >= MIN_EXTENT_RATIO * box.width;
  const floorAgainst = rasterCoversBox ? shorter : Math.min(rasterWidth, box.height);
  expect(
    Math.max(extent.width, extent.height),
    rasterCoversBox
      ? `the drawing against its ${shorter.toFixed(0)} px box`
      : `the drawing against the ${rasterWidth.toFixed(0)} px raster this platform's glyph rounding left it, in a ${box.width.toFixed(0)} px box (D-293)`,
  ).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO * floorAgainst);
  for (const { layer, cols, margin } of layers) {
    expect(margin.left, `blank columns west of the ${layer} layer's ink, in its ${String(cols)}-column grid`).toBeGreaterThan(0);
    expect(margin.right, `blank columns east of the ${layer} layer's ink, in its ${String(cols)}-column grid`).toBeGreaterThan(0);
  }
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
