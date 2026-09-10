/**
 * R74 (FR-MARK-2, FR-MARK-5): the mark's ladder and its constants, in one
 * place because three programs read them — the generator page under
 * `spike/mark/`, `scripts/build-mark.ts`, and the component beside this file.
 *
 * A tier is a **grid**, not a size: `cols × rows` braille cells and the
 * readings that survive at that grid. Where a tier is drawn is a **pixel
 * size**, and the two are separate (V20-12), which is why the `header32` tier
 * is drawn at 24 px and the `header56` tier has no placement at all in this
 * phase (OQ-29). A grid is square when `cols = 2 × rows`: the cell's advance
 * is 0.6 em and its line box is two advances, so two cells stacked are as tall
 * as one is wide.
 */

/** The ladder, widest grid first. Each tier sheds one reading from the one above it (FR-MARK-2). */
export const MARK_TIERS = ['hero', 'icon192', 'lockup80', 'header56', 'header32', 'favicon16'] as const;

export type MarkTier = (typeof MARK_TIERS)[number];

export interface MarkGrid {
  cols: number;
  rows: number;
}

/** FR-MARK-2's grids. Every one is `cols = 2 × rows`, so every raster is square on screen. */
export const MARK_GRIDS: Record<MarkTier, MarkGrid> = {
  hero: { cols: 32, rows: 16 },
  icon192: { cols: 24, rows: 12 },
  lockup80: { cols: 14, rows: 7 },
  header56: { cols: 10, rows: 5 },
  header32: { cols: 6, rows: 3 },
  favicon16: { cols: 4, rows: 2 },
};

/** One cell of a bead frame: the row, the column and the glyph the bead inks there (D-439). */
export type MarkCell = [row: number, col: number, glyph: string];

/** One tier as `rasters.json` carries it: the body as text, the bead as `MARK_ORBIT_FRAMES` sparse frames. */
export interface MarkRaster {
  cols: number;
  rows: number;
  body: string;
  frames: MarkCell[][];
}

export type MarkRasters = Record<MarkTier, MarkRaster>;

/**
 * A bead frame as the text of a whole grid — what the `<pre>` shows. The
 * frames are stored sparse because a bead is one or two cells and a dense
 * `hero` frame would be 500 spaces sixty times over (D-439); they are drawn
 * dense because a `<pre>` overlaid on the body must have the body's shape or
 * the two rasters do not line up.
 */
export function denseFrame(cells: readonly MarkCell[], cols: number, rows: number): string {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
  for (const [row, col, glyph] of cells) {
    const line = grid[row];
    if (line && col >= 0 && col < cols) line[col] = glyph;
  }
  return grid.map((line) => line.join('')).join('\n');
}

/**
 * FR-MARK-5: one orbit a minute, one pre-rasterised bead frame a second. The
 * period is slow enough not to pull the eye off the sky and fast enough to
 * read as motion in a glance; the frame count follows from stepping it once a
 * second, which is also what a bead crossing a cell looks like at these grids.
 */
export const MARK_ORBIT_PERIOD_S = 60;
export const MARK_ORBIT_FRAMES = 60;
/** The timer's step, in milliseconds (`MARK_ORBIT_PERIOD_S / MARK_ORBIT_FRAMES`). */
export const MARK_FRAME_MS = (MARK_ORBIT_PERIOD_S / MARK_ORBIT_FRAMES) * 1000;

/** FR-MARK-4 (a) and (b): both headers draw the `header32` tier at one `--row`. */
export const MARK_HEADER_PX = 24;

/**
 * The cell's advance at the 16 px base: `--cell` is `1ch` and the app's
 * monospace advance is 0.6 em (D-441).
 */
export const BASE_CELL_PX = 9.6;

/**
 * How many cells of a control row a mark at this pixel size takes (D-441,
 * FR-COMP-4). At the header's 24 px that is three — two cells are 19.2 px and
 * would not hold the box — so the compact row is the mark, the short title,
 * `[ live ]` and `[ settings ]`, 33 of the 36. `tests/styles/cells.ts` counts a
 * mark by this number rather than by the braille it draws.
 */
export function markCells(sizePx: number): number {
  return Math.ceil(sizePx / BASE_CELL_PX);
}
/** FR-PUB-11: the lockup beside the wordmark on the social preview. */
export const MARK_LOCKUP_PX = 80;

/**
 * FR-MARK-4 (d), (e): the PNGs the browser and the OS require, and the tier
 * each is drawn from. The two manifest icons are one tier at two pixel sizes —
 * one drawing, no resampling — and the favicon is the tier that survives 16 px.
 */
export const MARK_IMAGES = [
  { file: 'icon-192.png', tier: 'icon192', px: 192 },
  { file: 'icon-512.png', tier: 'icon192', px: 512 },
  { file: 'favicon.png', tier: 'favicon16', px: 16 },
] as const satisfies readonly { file: string; tier: MarkTier; px: number }[];
