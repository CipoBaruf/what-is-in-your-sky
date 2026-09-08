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
 * is one of four fixed sizes — the largest that fits the viewport in both
 * directions — and not whatever the page leaves. Every step is 2.4 : 1.7,
 * `zoomFor`'s two divisors (`dome/camera.ts`), the one shape at which the
 * drawing's fit binds across and down at once, so the drawing fills the box
 * both ways at every step. Below the first step the box is fluid, as before.
 *
 * The viewport each step fits from is arithmetic on the page's own rows, in
 * px at the 9.6 px cell of a 1280 px page (D-314 has the table): across, the
 * box beside a rail of at least `RAIL_MIN_CELLS` with the page's two cells of
 * side padding either side and the frame's three-cell column gap; down, the
 * box under the page's top row and the frame's controls row with their gaps
 * (`DOME_ROWS_ABOVE_PX`), over the page's bottom padding (`DOME_ROWS_BELOW_PX`)
 * and, from step 2, over the stripe block (`STRIPE_BLOCK_PX`: the clock
 * readout, the three stripe rows and the gap — D-315 puts the stripe under
 * the box there). The steps are evaluated as media queries on the viewport
 * (`domeStepQuery`), so the hook that reads them (`ui/hooks/useDomeStep.ts`)
 * fires on a crossing and never on a pixel of a drag, like `useLayoutMode`.
 *
 * The numbers are px literals here and nowhere in a stylesheet: the frame
 * takes the box through an inline custom property, since a wide-layout block
 * may hold no length in px (`tests/styles/breakpoint.test.ts`).
 */
export interface DomeStep {
  /** 1 to 4; 0 is the fluid box and is never in this table. */
  step: 1 | 2 | 3 | 4;
  /** The drawing box, CSS px, at 2.4 : 1.7. */
  box: { widthPx: number; heightPx: number };
  /** The smallest viewport the step fits, CSS px. */
  from: { widthPx: number; heightPx: number };
  /** The viewport the step was cut for. */
  reference: { widthPx: number; heightPx: number };
}

/** The rail's minimum, `ChartFrame.module.css` (D-313): what the playback row and the strip need to be read. */
export const RAIL_MIN_CELLS = 44;
/** A cell on the reference pages, `--cell` at `--font-mono`'s 0.6 em (D-314's arithmetic, not a threshold). */
const REFERENCE_CELL_PX = 9.6;
/** The frame's column gap between the box and its side column, in cells (`ChartFrame.module.css`). */
const FRAME_COLUMN_GAP_CELLS = 3;
/** Above the box: the page's top padding, the top row, the frame's controls row and the two gaps (measured: 114 px). */
export const DOME_ROWS_ABOVE_PX = 114;
/** Under the box: the page's bottom padding (measured: 6 px). */
export const DOME_ROWS_BELOW_PX = 6;
/** The stripe block under the box from step 2: the clock readout, three stripe rows and the frame's gap (measured: 108 px). */
export const STRIPE_BLOCK_PX = 108;
/** The step from which the stripe block stands under the box rather than in the rail (D-315). */
export const STRIPE_UNDER_BOX_FROM_STEP = 2;

const ACROSS_PX = Math.ceil((RAIL_MIN_CELLS + 2 * SHELL_PADDING_CELLS + FRAME_COLUMN_GAP_CELLS) * REFERENCE_CELL_PX);

function step(n: 1 | 2 | 3 | 4, widthPx: number, heightPx: number, referenceW: number, referenceH: number): DomeStep {
  const stripe = n >= STRIPE_UNDER_BOX_FROM_STEP ? STRIPE_BLOCK_PX : 0;
  return {
    step: n,
    box: { widthPx, heightPx },
    from: { widthPx: widthPx + ACROSS_PX, heightPx: heightPx + DOME_ROWS_ABOVE_PX + DOME_ROWS_BELOW_PX + stripe },
    reference: { widthPx: referenceW, heightPx: referenceH },
  };
}

/** The ladder, smallest first: each box is the largest 2.4 : 1.7 rectangle its reference viewport fits with about 20 px to spare. */
export const DOME_STEPS: readonly DomeStep[] = [step(1, 768, 544, 1280, 800), step(2, 1176, 833, 1920, 1080), step(3, 1680, 1190, 2560, 1440), step(4, 2688, 1904, 3840, 2160)];

/** The media query that says a step fits: both sides, so a wide but short window drops a step rather than clip. */
export function domeStepQuery(entry: DomeStep): string {
  return `(min-width: ${String(entry.from.widthPx)}px) and (min-height: ${String(entry.from.heightPx)}px)`;
}

/** The highest step whose query matches, or `null` for the fluid box; the hook's rule, kept here so it is a unit test. */
export function domeStepFor(matches: (entry: DomeStep) => boolean): DomeStep | null {
  let found: DomeStep | null = null;
  for (const entry of DOME_STEPS) if (matches(entry)) found = entry;
  return found;
}
