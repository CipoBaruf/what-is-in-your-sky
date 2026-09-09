/**
 * What the dome paints, in CSS pixels: `dome-fit.spec.ts` (R57, F-54) reads
 * the raster as text to measure the *ink* rather than the elements, and
 * `live-rail.spec.ts` (R61, F-59) measures the same ink against the box the
 * rail leaves it. The helper lives here so the two specs measure one thing.
 */
import type { Locator } from '@playwright/test';
import { MIN_EXTENT_RATIO, zoomFor, zoomWithinRaster } from '../../src/ui/components/guide/skychart/dome/camera';

/** FR-DOME-1's floor: the drawing, labels included, over the side of the box it is fitted to. */
export { MIN_EXTENT_RATIO };
/**
 * D-293's quantum: a platform without subpixel positioning (Linux Chromium, which is what CI runs)
 * rounds every glyph advance to a whole device pixel, so a layer's fitted cell can be up to one CSS
 * pixel under `box / cols` at a device pixel ratio of 1 (half of one at a ratio of 2, which is inside
 * this). A cell further under than that was cut short by something else, and gets no allowance.
 */
export const ADVANCE_QUANTUM_PX = 1;
/** Float noise in a measured cell, as against the quantum above. */
export const CELL_EPS_PX = 0.01;
/** Sub-pixel rounding (worse at a device pixel ratio of 2), and the label snap the unit side already accounts for. */
export const FIT_EPS_PX = 3;

/**
 * The zoom this platform's rasters leave the drawing: `fitLayers`' own rule (D-290's clamp on each
 * layer's settled raster, D-292's one zoom for both), fed the rasters the page actually painted.
 * Where every advance rendered at the width it was asked for this is `zoomFor`'s number; where the
 * platform rounded the cell down it is less, and the drawing — painted on that raster — follows it.
 */
export function platformZoom(layers: readonly LayerInk[], box: Pick<Rect, 'width' | 'height'>): number {
  return Math.min(zoomFor(box.width, box.height), ...layers.map(({ cols, rows, cellWidthPx, cellHeightPx }) => zoomWithinRaster(box.width, box.height, { widthPx: cols * cellWidthPx, heightPx: rows * cellHeightPx, cellWidthPx })));
}

/**
 * The floor this platform is held to, derived rather than pinned: FR-DOME-1's 0.9 at the zoom the
 * platform's rasters leave (D-293: the column count stays exact and the drawing goes short instead),
 * over the zoom the box itself asks for. Where nothing rounds the two are equal and the floor is
 * FR-DOME-1's as written; where a cell rounded down by up to `ADVANCE_QUANTUM_PX` the floor scales
 * with the drawing — the same on both axes, since one zoom draws both.
 *
 * R69 (FR-SHP-4): this used to be a constant, 0.81, measured *across* a 354.4 px square box where the
 * width binds (58 cells of 5 px over 354.4, D-293's 0.818 with a little room). The landscape phone's
 * box at 932 × 430 is 355.8 × 306 — nearly the same width, the same 5 px cell on Linux, the same
 * zoom of 131.8 — but its shorter side is its height, and its shape (1.16 : 1) is under the fit
 * rule's own 2.4 : 2.0, so the width binds and the height already has 3 % of slack with exact
 * advances (0.907 measured on macOS). The same 0.889 of zoom from that start is 0.803 down, which is
 * over this floor (0.800) and under the width's number. The width's allowance was never the height's.
 */
export function fitFloor(layers: readonly LayerInk[], box: Pick<Rect, 'width' | 'height'>): number {
  const shortByMoreThanTheQuantum = layers.some(({ cols, cellWidthPx }) => cellWidthPx < box.width / cols - ADVANCE_QUANTUM_PX - CELL_EPS_PX);
  if (shortByMoreThanTheQuantum) return MIN_EXTENT_RATIO;
  return MIN_EXTENT_RATIO * Math.min(1, platformZoom(layers, box) / zoomFor(box.width, box.height));
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One raster layer of the dome: its grid, where its ink lands in CSS px, and the blank margin left around it. */
export interface LayerInk {
  layer: string;
  cols: number;
  rows: number;
  ink: Rect;
  /** Blank columns between the ink and each side of the grid; 0 means the drawing runs into the edge. */
  margin: { left: number; right: number };
  /** The grid's own cell, `<pre>` width over columns: below `box / cols` where the platform rounded the advance. */
  cellWidthPx: number;
  /** The grid's row, `<pre>` height over rows. */
  cellHeightPx: number;
}

export interface Painted {
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
export async function painted(drawing: Locator): Promise<Painted> {
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
        cellWidthPx,
        cellHeightPx,
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

