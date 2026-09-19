import type { LayoutMode } from '../../lib/layout';

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
 * landscape phone and the short wide window. R77 cuts the tall shapes; the
 * short ones render their mode's tall inventory until R78 re-cuts them (the
 * landscape phone's rail order, the short wide window's overlay, D-448), so
 * the table already takes the argument the placement rule will read.
 */
export type LiveState = 'watching' | 'scrubbing';
export type LiveShape = 'tall' | 'short';

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
  // R78 re-cuts the short shapes (FR-WATCH-5, FR-WATCH-6); until then they are their mode's tall page.
  void shape;
  if (mode === 'compact') {
    return state === 'watching'
      ? ['top-row', 'indicator', 'next-event', 'box', 'conditions', 'overview', 'overview-labels', 'actions', 'scrub', 'list', 'share']
      : ['top-row', 'indicator', 'time-row', 'box', 'conditions', 'overview', 'stripe', 'steps', 'playback', 'actions', 'back-to-live', 'hidden', 'share'];
  }
  return state === 'watching'
    ? ['top-row', 'box', 'indicator', 'clock', 'next-event', 'conditions', 'overview', 'actions', 'scrub', 'hidden', 'share']
    : ['top-row', 'box', 'time-row', 'playback', 'overview', 'stripe', 'steps', 'indicator', 'back-to-live', 'conditions', 'actions', 'hidden', 'share'];
}
