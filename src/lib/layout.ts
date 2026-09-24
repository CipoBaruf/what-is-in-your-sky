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

/**
 * R76 (FR-FIRST-5, D-443): the width from which the wide home is three equal
 * panes — Where, When, What — rather than FR-DESK-2's two columns. 108 cells
 * of content is three panes of 36, the compact card's width and the least a
 * pane can hold a pass card in. Its pixel twin counts the rest by D-253's
 * rule: the two 3-cell gutters and one 2-cell shell padding, 116 cells.
 *
 * The spec gives the twin as "about 1114 px" — 116 cells at the 0.6 em advance
 * — and this is 1118: the literal is derived by `thresholdPx` on the widest
 * advance in the font stack (F-10), as the other two are, so three panes never
 * engage before 108 cells of content exist on any font. 1024 × 768 is under it
 * and 1280 × 800 over it either way, which is what the requirement asks of it.
 *
 * It sits between the other two: under it the two columns stand, as the
 * layout the wide breakpoint starts; and since the Where and When panes are
 * what an open pass takes at this width (D-444), `WIDE_SPLIT_MIN_PX`'s split of
 * the right column only ever applies below it — which is to say, on the home
 * page, never. The rule stays, and the breakpoint test keeps the three literals
 * in order.
 */
export const HOME_THREE_PANE_MIN_CELLS = 108;
export const HOME_THREE_PANE_MIN_PX = thresholdPx(HOME_THREE_PANE_MIN_CELLS + 2 * GUTTER_CELLS + SHELL_PADDING_CELLS);
export const HOME_THREE_PANE_QUERY = `(min-width: ${String(HOME_THREE_PANE_MIN_PX)}px)`;

/** FR-FIRST-5 (D-444): an open pass at three-pane widths takes the first two panes, at least this wide. */
export const GUIDE_PANE_MIN_CELLS = 72;

/**
 * R93 (FR-HOME-4, D-546): the width the home page stops growing at. From 160
 * cells — about 1540 px on the widest advance — the header, the three panes
 * and the footer hold that width and are centred, the panes staying equal, so
 * a 2560 px screen is not three panes of 80 cells with 20-cell-wide cards. It
 * is a `max-width` in cells on the shell's content (`App.module.css`), not a
 * media query, so there is no pixel twin to derive: the cap is exactly 160 of
 * whatever cell the device has. The live page is not capped (FR-DOME-1).
 */
export const HOME_MAX_CELLS = 160;

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

/*
 * R71 (FR-LEG-6, D-386): `LIVE_TWO_COLUMN_MIN_PX` (1660) and its query stood
 * here. The wide live page is the rail at every wide width now — one wide
 * layout — so there is no threshold left to read: `WIDE_MIN_PX` is the only
 * width the live page asks about, and it asks `useLayoutMode` for it.
 */

/**
 * R69 (FR-SHP-3, FR-SHP-4; F-65; D-381, D-389): the wide live page at every
 * height. On a wide viewport the desktop layout is the layout whatever the
 * height, and the box is what gives — down to `LIVE_BOX_MIN_PX`, eight rows,
 * the smallest box in which the dome's drawing is still a bowl.
 *
 * R78 (FR-WATCH-5, FR-WATCH-6, FR-SHP-3 as amended v2.0; D-448): what happens
 * under that floor is a state's, not the page's. The rows under the box are
 * the scrub block — the time row, the overview, the stripe and the step row —
 * and only scrubbing renders them (R77), so the table below is per state, and
 * R71's over-count (D-414: the strip's line and the actions row, which are the
 * rail's) is gone from it. Where the block under the box would take the box
 * under its floor the block is not laid out under it at all: `scrubPlacement`
 * answers `overlay`, and the page puts it over the bottom of the drawing, so
 * the box is the same height in both states. The rows *around* the box still
 * fold there, in `LIVE_FOLD_ORDER`: the control rows let their air out, then
 * the actions ride on the conditions line. The overview does not fold: on a
 * short window it is in the rail in both states.
 *
 * Both rules read one number, and it is measured: the height `ChartFrame`
 * has for the box with nothing under it — its own height less its controls
 * row (`fitBox`'s height input) — and not the viewport's, since a browser
 * window is never its screen (D-314). The rows' px are from the tokens
 * (`--row` is 1.5 rem at 16 px, `--tap` two rows), and `foldRows.test.ts`
 * holds them to `tokens.css`.
 */
export const ROW_PX = 1.5 * BASE_FONT_PX;
export const TAP_PX = 2 * ROW_PX;
/** FR-SHP-3: eight rows, the smallest box in which the drawing is still a bowl. */
export const LIVE_BOX_MIN_PX = 8 * ROW_PX;

/** FR-WATCH-1: the live page's two states. `ui/screens/liveRows.ts` is the inventory of each. */
export type LiveState = 'watching' | 'scrubbing';

/** FR-SHP-1's second decision: portrait, or the landscape phone — wider than tall and at most 500 px high (D-173). */
export type PageShape = 'portrait' | 'landscape-phone';
export const LANDSCAPE_PHONE_MAX_HEIGHT_PX = 500;
export const LANDSCAPE_PHONE_QUERY = `(orientation: landscape) and (max-height: ${String(LANDSCAPE_PHONE_MAX_HEIGHT_PX)}px)`;

/** Which shape a `matchMedia(LANDSCAPE_PHONE_QUERY)` result means. The mode is asked separately (FR-SHP-1). */
export function pageShape(matchesLandscapePhone: boolean): PageShape {
  return matchesLandscapePhone ? 'landscape-phone' : 'portrait';
}

/** The page's padding above and below, and the gap between its rows: a quarter row each (`Live.module.css`). */
export const LIVE_PAGE_PADDING_PX = ROW_PX / 2;
export const LIVE_GAP_PX = ROW_PX / 4;
/** The same two while the page is folded: the compact page's spacing token between the rows, and half a row under the page for the last line's hit boxes. */
export const LIVE_FOLDED_GAP_PX = ROW_PX / 6;
export const LIVE_FOLDED_PADDING_PX = ROW_PX / 4 + ROW_PX / 2;

/**
 * The wide page's rows above and under the box, per state, top to bottom, before anything folds (D-448).
 * Watching: the top row and the frame's controls row — nothing is under the box, which takes the height down
 * to the page's foot (FR-WATCH-5). Scrubbing adds the scrub block: the time row, the overview's text row, the
 * stripe's three rows and the step row.
 *
 * The time row is counted as it stands where the count matters. The block is as wide as the box, or 44 cells
 * where the box is narrower (`ChartFrame.module.css`), and a box near its floor is some 230 px wide — so at the
 * height this table decides anything, the block is always at its 44-cell floor, where the held instant and the
 * six playback controls do not share a line: measured at 1200 × 560, the readout's line (26 px) over two lines
 * of controls in English (74 px) and over four in Spanish (122 px). The table takes the taller, as D-414's did
 * by accident and this does on purpose: a window folds a little earlier than English asks and never later than
 * Spanish does, and the floor holds in both. `shapes.spec.ts` drags a window through the number.
 */
export const LIVE_TIME_ROW_FLOOR_PX = ROW_PX + 2 + 4 * ROW_PX;
export const LIVE_KEPT_ROWS_PX: Readonly<Record<LiveState, readonly number[]>> = {
  watching: [TAP_PX, TAP_PX],
  scrubbing: [TAP_PX, TAP_PX, LIVE_TIME_ROW_FLOOR_PX, ROW_PX, 3 * ROW_PX, TAP_PX],
};
/** The gaps those rows cost: after the top row and after the controls row; scrubbing, after the box and between the block's four rows too. */
export const LIVE_KEPT_GAPS: Readonly<Record<LiveState, number>> = { watching: 2, scrubbing: 6 };

/** What the wide page keeps for its rows in `state`, px: the page's height less this is the box's. */
export function liveKeptPx(state: LiveState): number {
  return LIVE_PAGE_PADDING_PX + LIVE_KEPT_ROWS_PX[state].reduce((sum, row) => sum + row, 0) + LIVE_KEPT_GAPS[state] * LIVE_GAP_PX;
}

/** What the scrub block costs the box where it is laid out under it: its four rows, the gaps between them and the gap over them. */
export const LIVE_SCRUB_BLOCK_PX = liveKeptPx('scrubbing') - liveKeptPx('watching');

/**
 * R78 (FR-WATCH-5, FR-WATCH-6; D-448): where the scrub block goes. The rail on the landscape phone, the one
 * place with rows to spare; on a wide page the overlay where the block under the box would take the box under
 * `LIVE_BOX_MIN_PX`; under the box otherwise — the tall wide page, and compact portrait, whose box yields on the
 * reader's own tap (FR-WATCH-5). The mode is asked first: a short wide window is landscape and under 500 px
 * too, and it is not a phone (FR-SHP-1).
 *
 * `boxHeightPx` is the height the frame has measured for the box with nothing under it and nothing folded
 * (`unfoldedBoxHeightPx`), so the answer is the same in both states and the box never moves on it. Before the
 * frame has measured — the first render, jsdom — it is `null` and the block is under the box, as it always was.
 */
export type ScrubPlacement = 'under' | 'rail' | 'overlay';

export function scrubPlacement({ mode, shape, boxHeightPx }: { mode: LayoutMode; shape: PageShape; boxHeightPx: number | null }): ScrubPlacement {
  if (mode === 'compact') return shape === 'landscape-phone' ? 'rail' : 'under';
  if (boxHeightPx === null) return 'under';
  return boxHeightPx - LIVE_SCRUB_BLOCK_PX < LIVE_BOX_MIN_PX ? 'overlay' : 'under';
}

/**
 * The rows around the box that fold on a short wide window, in the order they go (FR-SHP-3 as amended v2.0):
 * first the control rows — the top row and the frame's controls row, and with them every control around the
 * box — go to one text row, their 48 px hit boxes kept by D-246's padding and negative margin, and the gaps take
 * the compact page's token; then the actions ride on the conditions line rather than taking a row of the rail.
 * R70's `overview` stood at the head of this order while the overview was a row under the box (D-389); it is
 * the rail's on a short window now and does not fold (FR-WATCH-6).
 */
export type LiveFold = 'controls' | 'actions';
export const LIVE_FOLD_ORDER: readonly LiveFold[] = ['controls', 'actions'];

/** The rows of `liveRows.ts`'s table each fold re-cuts: a fold is only named where the state renders all of them (D-447). */
export const LIVE_FOLD_NEEDS: Readonly<Record<LiveFold, readonly string[]>> = {
  controls: ['top-row', 'box'],
  actions: ['conditions', 'actions'],
};

/**
 * What each fold gives the box, px. `controls`: the top row and the controls row at one text row, the two
 * gaps at the folded token, less the half row the page's foot takes for the last line's hit boxes. `actions`:
 * nothing — the actions are the rail's (D-414), so what their fold gives is the rail's legend a row, not the box.
 */
export const LIVE_FOLD_GIVES_PX: Readonly<Record<LiveFold, number>> = {
  controls: 2 * (TAP_PX - ROW_PX) + LIVE_KEPT_GAPS.watching * (LIVE_GAP_PX - LIVE_FOLDED_GAP_PX) - (LIVE_FOLDED_PADDING_PX - LIVE_PAGE_PADDING_PX),
  actions: 0,
};
/** The rail gives its actions' row up a row of tap targets under the height at which the controls fold. */
export const LIVE_FOLD_ACTIONS_UNDER_PX = TAP_PX;

/**
 * The frame's measurement with the fold taken back out: what the box would have with nothing under it on the
 * unfolded page. The fold changes the rows the frame is measured under, so the decision is made on this, which
 * the fold does not move — otherwise folding would give the box the height that unfolds it again.
 */
export function unfoldedBoxHeightPx(measuredPx: number, folded: readonly LiveFold[]): number {
  return measuredPx - folded.reduce((sum, row) => sum + LIVE_FOLD_GIVES_PX[row], 0);
}

/**
 * FR-SHP-3: which rows the wide page folds with `boxHeightPx` for the box (as `scrubPlacement` reads it) — the
 * head of the order, as far as the height asks. `controls` folds exactly where the scrub block is an overlay,
 * in both states, so the box is one height in the two (FR-WATCH-6); `actions` a row of tap targets under that.
 * `rows` is the state's inventory (`liveRows.ts` `rowsFor`): a fold whose rows the state does not render is
 * not named, and nor is any after it (D-447).
 */
export function foldRows(boxHeightPx: number | null, rows: readonly string[]): readonly LiveFold[] {
  if (boxHeightPx === null) return [];
  const folded: LiveFold[] = [];
  let underPx = LIVE_BOX_MIN_PX + LIVE_SCRUB_BLOCK_PX;
  for (const row of LIVE_FOLD_ORDER) {
    if (boxHeightPx >= underPx || !LIVE_FOLD_NEEDS[row].every((needed) => rows.includes(needed))) break;
    folded.push(row);
    underPx -= LIVE_FOLD_ACTIONS_UNDER_PX;
  }
  return folded;
}

/** The box height (as `foldRows` reads it) under which `row` is folded. */
export function foldBelowPx(row: LiveFold): number {
  return LIVE_BOX_MIN_PX + LIVE_SCRUB_BLOCK_PX - LIVE_FOLD_ORDER.indexOf(row) * LIVE_FOLD_ACTIONS_UNDER_PX;
}

/**
 * R75 (FR-SET-2): the number of saved places the settings page must fit 390 × 844 with, beside an observer
 * and the install offer. Two is the artboard's state, and the number a reader who keeps a home and one dark
 * site has; past it the page may scroll, since what grows it is the reader's own list.
 */
export const SETTINGS_FIT_PLACES = 2;
