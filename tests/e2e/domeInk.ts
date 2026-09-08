/**
 * What the dome paints, in CSS pixels: `dome-fit.spec.ts` (R57, F-54) reads
 * the raster as text to measure the *ink* rather than the elements, and
 * `live-rail.spec.ts` (R61, F-59) measures the same ink against the box the
 * rail leaves it. The helper lives here so the two specs measure one thing.
 */
import type { Locator } from '@playwright/test';

/** FR-DOME-1's floor: the drawing, labels included, over the side of the box it is fitted to. */
export const MIN_EXTENT_RATIO = 0.9;
/**
 * D-293: what the drawing may shrink to where the platform rounds a glyph advance to a whole device
 * pixel. `camera.test.ts` measures 0.818 at a device pixel ratio of 1 and 0.9001 at a ratio of 2;
 * this is the lower of the two with a little room, so a further regression still fails here.
 */
export const WHOLE_PIXEL_MIN_RATIO = 0.81;
/** A fitted cell this far under `box / cols` means the platform rounded the advance, not float noise. */
export const CELL_EPS_PX = 0.01;
/** Sub-pixel rounding (worse at a device pixel ratio of 2), and the label snap the unit side already accounts for. */
export const FIT_EPS_PX = 3;

/**
 * Which floor this platform is held to: the rounded one where a layer's fitted
 * cell is measurably under `box / cols`, FR-DOME-1's as written otherwise.
 */
export function fitFloor(layers: readonly LayerInk[], boxWidthPx: number): number {
  return layers.some(({ cols, cellWidthPx }) => cellWidthPx < boxWidthPx / cols - CELL_EPS_PX) ? WHOLE_PIXEL_MIN_RATIO : MIN_EXTENT_RATIO;
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

