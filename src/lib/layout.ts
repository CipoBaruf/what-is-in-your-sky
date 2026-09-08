/**
 * R23 (FR-DESK-1, D-71), R50 (FR-DESK-3 amended, D-252/D-253): the one place
 * that says where compact ends, where wide begins, and where the wide right
 * column is finally wide enough to show the list and the guide at once.
 *
 * The requirements state both thresholds in cells, but a media query cannot
 * read `var(--cell)` — font-relative units in a media query are resolved
 * against the browser's initial font, not the app's — so each threshold is
 * carried into the CSS as a pixel literal and `tests/styles/breakpoint.test.ts`
 * recomputes it from the numbers below.
 *
 * R50 (F-10) is why that computation is no longer `cells × 0.6 em × 16 px`.
 * `--cell` is `1ch`, one character advance of whichever family in
 * `--font-mono` the device actually has, and the advances differ: the 0.6 em
 * the old derivation assumed is right for SF Mono and Liberation Mono, 0.602
 * for Menlo and DejaVu Sans Mono, and 0.55 for Consolas — so the old 960 px
 * was 100 cells on a Mac and 109 cells on Windows. One literal cannot be one
 * cell count everywhere; what it can be is never *fewer* cells than the
 * threshold names. Each literal is therefore derived from the widest advance
 * in the stack and rounded up (`thresholdPx`): a layout that needs 124 cells
 * never engages before 124 cells of it exist. The other direction — Consolas
 * reaching the threshold a few cells late — costs a reader on a narrow window
 * nothing but the wider layout arriving slightly later, which is the safe way
 * to be wrong.
 *
 * The hook is `ui/hooks/useLayoutMode.ts`, not this file: PLAN §3 forbids
 * React in `src/lib` (D-116).
 */

/** `html { font-size }` in `styles/global.css`: what every `em` and `rem` is measured against. */
export const BASE_FONT_PX = 16;

/**
 * One character advance in em, per family of the `--font-mono` stack in
 * `styles/tokens.css`, from each font's own metrics (advanceWidth / unitsPerEm).
 * `ui-monospace` is the platform's own — SF Mono on Apple, and elsewhere it
 * falls through to one of the named families.
 */
export const CELL_ADVANCE_EM: Readonly<Record<string, number>> = {
  'SF Mono': 0.6,
  Menlo: 1233 / 2048,
  Consolas: 1126 / 2048,
  'DejaVu Sans Mono': 1233 / 2048,
  'Liberation Mono': 0.6,
};

const advances = Object.values(CELL_ADVANCE_EM);
/** The widest cell in the stack (Menlo, DejaVu Sans Mono): what a threshold in px has to survive. */
export const CELL_ADVANCE_EM_MAX = Math.max(...advances);
/** The narrowest (Consolas): the font on which a px threshold lands latest in cells. */
export const CELL_ADVANCE_EM_MIN = Math.min(...advances);

/** The pixel literal a threshold of `cells` needs, on every font in the stack (F-10). */
export function thresholdPx(cells: number): number {
  return Math.ceil(cells * CELL_ADVANCE_EM_MAX * BASE_FONT_PX);
}

/** FR-DESK-1: wide starts at 100 cells of viewport width; 964 px, up from D-71's 960 (F-10). */
export const WIDE_CELLS = 100;
export const WIDE_MIN_PX = thresholdPx(WIDE_CELLS);
export const WIDE_QUERY = `(min-width: ${String(WIDE_MIN_PX)}px)`;

/** The gutter between two columns of the wide shell, in cells (`App.module.css`). */
export const GUTTER_CELLS = 3;

/** The side padding of the header, the main and the footer, in cells (`styles/global.css`). */
export const SHELL_PADDING_CELLS = 2;

/**
 * FR-DESK-3 as amended (V11-13, D-192): the width at which the right column
 * can hold the 44-cell list and a 40-cell guide side by side. Below it an open
 * guide takes the whole right column and the list is one `[ list ]` control
 * away, the way the compact sheet works (F-6).
 *
 * The constant is D-192's, and it counts the three columns: 40 left + 44 list
 * + 40 guide. Its pixel twin counts what the reader's screen also has to find
 * for them to be three columns (D-253) — the two 3-cell gutters between them,
 * and the shell's own side padding. Only the left half of that padding: the
 * shell is 2 cells clear on each side, and where the tracks are a few pixels
 * wider than the space between them the panel leans into the right margin
 * rather than the layout folding, which costs the guide's border a few pixels
 * of air and nothing else. Counting both halves instead would put the
 * threshold at 1291 px and take the split away from 1280 — the width of the
 * approved desktop mockup (FR-DESK-5), where the two columns have been since
 * R23. The one thing the twin may never do is let that lean become a page
 * that scrolls sideways, which is what `WIDE_SPLIT_MIN_CELLS` + the gutters +
 * one padding is exactly the width for; `tests/styles/breakpoint.test.ts`
 * holds it there and `tests/e2e/wide.spec.ts` looks for the scrollbar.
 */
export const WIDE_SPLIT_MIN_CELLS = 124;
export const WIDE_SPLIT_MIN_PX = thresholdPx(WIDE_SPLIT_MIN_CELLS + 2 * GUTTER_CELLS + SHELL_PADDING_CELLS);

export type LayoutMode = 'compact' | 'wide';

/** Which shell a `matchMedia(WIDE_QUERY)` result means (D-72). */
export function layoutMode(matchesWide: boolean): LayoutMode {
  return matchesWide ? 'wide' : 'compact';
}

/**
 * R61 (FR-LIVE-7 as amended v1.2.1, D-314, F-59): the wide live page's dome box
 * is the largest rectangle at the drawing's own aspect that the window leaves
 * — not whatever the page leaves (a third of it blank, F-59) and not a step of
 * a table (which wasted most of a real browser window, whose viewport is some
 * 200 px shorter than the screen it is on: V12-10). The aspect is `zoomFor`'s
 * two divisors, 2.4 : 2.0 (`dome/camera.ts` `DOME_BOX_ASPECT`), the one shape
 * at which the drawing's fit binds across and down at once.
 *
 * `fitBox` is the rule, pure, so it is a unit test: the box is as tall as the
 * height the frame leaves it — under its controls row and, where the stripe is
 * under the box, over the stripe row, gaps counted — unless the width beside a
 * rail of `RAIL_MIN_CELLS` binds first, in which case it is as wide as that.
 * `ChartFrame` measures the four inputs and writes the answer inline as two
 * custom properties (px may not be written in a wide stylesheet block,
 * `tests/styles/breakpoint.test.ts`).
 */
export interface BoxFit {
  /** The frame's own box, CSS px. */
  frameWidthPx: number;
  frameHeightPx: number;
  /** The rows the frame keeps above the drawing (its controls row) and, under it, the stripe row; each with the gap it costs. */
  aboveHeightPx: number;
  belowHeightPx: number;
  /** The rail's minimum, in px, plus the column gap before it. */
  besideWidthPx: number;
  /** Width over height. */
  aspect: number;
}

/** The rail's minimum, `ChartFrame.module.css` (D-313): what the playback row and the strip need to be read. */
export const RAIL_MIN_CELLS = 44;

/** The largest `aspect` box the frame leaves, height-bound or width-bound; never negative. */
export function fitBox({ frameWidthPx, frameHeightPx, aboveHeightPx, belowHeightPx, besideWidthPx, aspect }: BoxFit): { widthPx: number; heightPx: number } {
  const heightPx = Math.max(0, frameHeightPx - aboveHeightPx - belowHeightPx);
  const widthPx = Math.max(0, frameWidthPx - besideWidthPx);
  if (heightPx * aspect <= widthPx) return { widthPx: Math.floor(heightPx * aspect), heightPx: Math.floor(heightPx) };
  return { widthPx: Math.floor(widthPx), heightPx: Math.floor(widthPx / aspect) };
}

/**
 * FR-LIVE-7 and FR-TRAJ-4 as amended (v1.2.1, D-315): the width from which the
 * stripe block stands under the box, the box's width, rather than in the rail
 * — the owner's stripe at the bottom on a big screen. Below it the height is
 * the scarcer side, and the rail is where the stripe costs the box nothing.
 * 1666 px is where a box of the height a 1080 p browser window leaves (about
 * 840 px, so 1186 wide at 2.4 : 2.0) stands beside a full 44-cell rail with the
 * page's padding and the column gap: the first width at which the stripe
 * under the box makes the box no narrower.
 */
export const STRIPE_UNDER_MIN_PX = 1666;
export const STRIPE_UNDER_QUERY = `(min-width: ${String(STRIPE_UNDER_MIN_PX)}px)`;
