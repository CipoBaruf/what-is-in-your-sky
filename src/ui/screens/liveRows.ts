import type { LayoutMode, LiveState, ScrubPlacement } from '../../lib/layout';

/**
 * R77 (FR-WATCH-4, D-447): what the live page renders, per state, in one
 * table. `Live.tsx` renders a row or a control exactly when `rowsFor` lists
 * it, and the component test asserts against the same list by test id —
 * presence *and* absence — so FR-WATCH-4's "absent, not hidden" is checked in
 * one place rather than in thirty assertions that drift.
 *
 * The state is FR-WATCH-1's: **watching** while the shown instant is real
 * time, **scrubbing** while it is held (paused or playing). It is read from
 * the instant (`usePlayback`'s `realTime`), never stored (D-446).
 *
 * The ids name what is placed, not where: on compact `time-row` is the held
 * headline standing where the next-event block stood; on wide it is the row
 * under the box with the playback controls beside the held instant (V12-13).
 * The chart's own rows — the view control, the facing readout, the legend —
 * are the frame's and are in every state; `box` stands for them.
 *
 * `shape` is FR-WATCH-5's height half of the matrix: `tall` is the compact
 * portrait page and the wide page above the fold threshold, `short` the
 * landscape phone and the short wide window — in `lib/layout.ts`'s words, the
 * shapes where `scrubPlacement` (D-448) answers `rail` or `overlay` rather than
 * `under`. R77 cut the tall shapes and R78 the short ones (`shortRowsFor`).
 */
export type { LiveState };
export type LiveShape = 'tall' | 'short';

/** D-448: the shape the placement rule's answer means — the block under the box is the tall page's, anywhere else the short one's. */
export function liveShape(placement: ScrubPlacement): LiveShape {
  return placement === 'under' ? 'tall' : 'short';
}

export type LiveRow =
  | 'top-row'
  | 'indicator'
  | 'clock'
  | 'next-event'
  | 'time-row'
  | 'box'
  | 'conditions'
  | 'overview'
  | 'overview-labels'
  | 'stripe'
  | 'steps'
  | 'playback'
  | 'actions'
  | 'scrub'
  | 'back-to-live'
  | 'hidden'
  | 'list'
  | 'share';

/** The test id each row renders under: the one place a test finds it by. */
export const LIVE_ROW_TEST_ID: Readonly<Record<LiveRow, string>> = {
  'top-row': 'live-top-row',
  indicator: 'live-indicator',
  clock: 'live-clock',
  'next-event': 'next-event',
  'time-row': 'time-row',
  box: 'live-dome',
  conditions: 'status-strip',
  overview: 'overview-row',
  'overview-labels': 'overview-labels',
  stripe: 'time-stripe',
  steps: 'step-controls',
  playback: 'playback-row',
  actions: 'live-actions',
  scrub: 'live-scrub',
  'back-to-live': 'live-now',
  hidden: 'live-hidden-toggle',
  list: 'live-legend-toggle',
  share: 'live-share',
};

export const LIVE_ROWS = Object.keys(LIVE_ROW_TEST_ID) as readonly LiveRow[];

/**
 * FR-WATCH-4's inventory, in reading order.
 *
 * - **Compact, watching:** the top row with the indicator on it (V20-8), the
 *   next-event block, the box, the conditions line, the overview with its end
 *   labels, and `[ scrub ] [ list (n) ] Share`.
 * - **Compact, scrubbing:** the held instant in the headline's place, the box,
 *   the conditions line, the overview, the stripe, the step row, the playback
 *   row and `[ back to live ] [ hidden ] Share` — the hidden-objects toggle
 *   joins this row and the list control leaves it (33 cells, V20-8).
 * - **Wide, watching:** the box, and the rail — the indicator with the clock,
 *   the next-event block, the conditions line, the overview and
 *   `[ scrub the night ] [ Hidden ] [ Share this sky ]`.
 * - **Wide, scrubbing:** the box with the scrub block under it — the time row
 *   with the playback controls, the overview, the stripe and the step row —
 *   and the rail: the indicator with `[ back to live ]`, the conditions line and
 *   `[ Hidden ] [ Share this moment ]`.
 */
export function rowsFor(state: LiveState, mode: LayoutMode, shape: LiveShape): readonly LiveRow[] {
  if (shape === 'short') return shortRowsFor(state, mode);
  if (mode === 'compact') {
    return state === 'watching'
      ? ['top-row', 'indicator', 'next-event', 'box', 'conditions', 'overview', 'overview-labels', 'actions', 'scrub', 'list', 'share']
      : ['top-row', 'indicator', 'time-row', 'box', 'conditions', 'overview', 'stripe', 'steps', 'playback', 'actions', 'back-to-live', 'hidden', 'share'];
  }
  return state === 'watching'
    ? ['top-row', 'box', 'indicator', 'clock', 'next-event', 'conditions', 'overview', 'actions', 'scrub', 'hidden', 'share']
    : ['top-row', 'box', 'time-row', 'playback', 'overview', 'stripe', 'steps', 'indicator', 'back-to-live', 'conditions', 'actions', 'hidden', 'share'];
}

/**
 * R101 (FR-JUMP-1, D-624): where `[ see this pass ]` stands while watching — after the headline's path line
 * (`path`), or beside `[ scrub the night ]` on the actions row (`actions`) — so that it adds no row. It is never
 * a row of its own, which is why it is not a `LiveRow`: it rides on the `next-event` row or on the `actions` row,
 * and is in the DOM exactly when its row is and the headline names a rise far enough ahead (`jumpInstant`).
 *
 * The rule, from R101's walk of FR-SHP-4's matrix in both languages (the control shown against the control
 * taken out, every row's height compared; the table is `shapes.spec.ts`'s `JUMP_ALLOWANCE`):
 *
 * - **Compact, both shapes: the path line, always.** The path is the pass's own words, so whether 17 more cells
 *   fit after its last line depends on the pass; where they do not, the control takes a text line under the path
 *   (24 px). The compact actions row is full — `[ scrub ] [ list (n) ] [ Share ]` is 34 of 36 cells — so beside
 *   `[ scrub ]` it would take a tap row (48 px), which on the portrait page is taken from the box. Measured on the
 *   fixture's pass (a 47-cell path): no row changes at any portrait row; on the landscape phone at 844 px the
 *   headline gains its text line inside the rail, whose own scroll has the room (the dome's column is untouched).
 * - **Wide, both shapes: the path line where the control fits after the path's last line, otherwise beside
 *   `[ scrub the night ]`.** The rail is what the box leaves, from 44 cells up, so the fit is measured, not
 *   tabled (`jumpFitsOnPath`, fed by `Live.tsx`). Measured: no row changes at any tall wide row in either
 *   language — the path line under 1660 px, where the 44-cell rail wraps the path and leaves its last line room,
 *   and the actions row from 1660 px, where they share the line `[ Hidden ]` stands on. On the short wide window
 *   the rail's rows are one flowing line under the fold (FR-SHP-3), and the English actions take a line of it
 *   from 1200 px; the box is the overlay's and does not move.
 */
export type JumpPlacement = 'path' | 'actions';

export function jumpPlacement(mode: LayoutMode, fitsOnPath: boolean): JumpPlacement {
  return mode === 'compact' || fitsOnPath ? 'path' : 'actions';
}

/** The control fits after the path's last line: that line's end, one cell of space and the control, inside the row (half a pixel for rounding). */
export function jumpFitsOnPath({ lastLineEndPx, spacePx, controlPx, rowPx }: { lastLineEndPx: number; spacePx: number; controlPx: number; rowPx: number }): boolean {
  return lastLineEndPx + spacePx + controlPx <= rowPx + 0.5;
}

/**
 * R78 (FR-WATCH-5, FR-WATCH-6; D-448): the two short shapes, where the box is
 * the same height in both states and the scrub block goes beside or over it.
 *
 * - **The landscape phone** (compact, `scrubPlacement` answers `rail`): the
 *   dome has the `2fr` column to itself and everything else is the `3fr` rail's.
 *   Watching: the indicator with the clock, the next event, the conditions line,
 *   the overview and `[ scrub ] [ list (n) ] Share`. Scrubbing adds the time
 *   row, the stripe, the step row and the playback row, with `[ back to live ]`
 *   beside the indicator at the rail's head — the rail scrolls inside itself,
 *   and the way out of the state is the one control that must not scroll away.
 *   The indicator is the rail's here and not the top row's: the top row's cells
 *   were V20-8's worry on a portrait phone, and this rail has them to spare.
 * - **The short wide window** (`overlay`): watching is the tall wide page's
 *   inventory. Scrubbing, the bar over the bottom of the drawing is the time row
 *   with the playback controls, the stripe and the step row; the overview stays
 *   in the rail, under the conditions line, in both states.
 */
/**
 * R85 (F-81, FR-CAP-5, D-549): the short wide window's inventory — the legend in the rail, between the rail's
 * head and its foot — ends on a whole entry, with a `+n` line under it for the entries the clip leaves out.
 *
 * Every entry is a whole number of text rows there (`Legend.module.css`, `.clipped`): a pass or a hidden
 * object is its tap target, two rows (the name over the three times), and a Sun or Moon line one. So the list's
 * `max-height` is `rows` text rows, which is a row boundary *and* an entry boundary, and nothing is cut
 * mid-glyph. `budgetRows` is what the rail leaves the list, in whole rows; when the entries do not all fit, one
 * of those rows is the `+n` line's.
 */
export interface InventoryClip {
  /** The list's height, in text rows. */
  rows: number;
  /** The entries it shows whole, from the top. */
  shown: number;
  /** The entries under the clip: the `+n`, and 0 when there is no line. */
  more: number;
}

export function inventoryClip(entryRows: readonly number[], budgetRows: number): InventoryClip {
  const total = entryRows.reduce((sum, rows) => sum + rows, 0);
  if (total <= budgetRows) return { rows: total, shown: entryRows.length, more: 0 };
  const room = budgetRows - 1;
  let rows = 0;
  let shown = 0;
  for (const entry of entryRows) {
    if (rows + entry > room) break;
    rows += entry;
    shown += 1;
  }
  return { rows, shown, more: entryRows.length - shown };
}

function shortRowsFor(state: LiveState, mode: LayoutMode): readonly LiveRow[] {
  if (mode === 'compact') {
    return state === 'watching'
      ? ['top-row', 'box', 'indicator', 'clock', 'next-event', 'conditions', 'overview', 'actions', 'scrub', 'list', 'share']
      : ['top-row', 'box', 'indicator', 'back-to-live', 'time-row', 'conditions', 'overview', 'stripe', 'steps', 'playback', 'actions', 'hidden', 'share'];
  }
  return state === 'watching'
    ? ['top-row', 'box', 'indicator', 'clock', 'next-event', 'conditions', 'overview', 'actions', 'scrub', 'hidden', 'share']
    : ['top-row', 'box', 'time-row', 'playback', 'stripe', 'steps', 'indicator', 'back-to-live', 'conditions', 'overview', 'actions', 'hidden', 'share'];
}
