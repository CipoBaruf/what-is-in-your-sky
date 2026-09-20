/**
 * R69 (FR-SHP-3; D-381), R78 (FR-SHP-3 as amended v2.0; D-448): the wide live
 * page's box floor, its rows per state and the fold order, pure. The numbers
 * are the stylesheet's rows in px, so the first tests hold them to the tokens
 * the stylesheet is written in, the way `tests/styles/breakpoint.test.ts` holds
 * the wide breakpoint to the font stack. `liveRows.test.ts` holds the fold to
 * the inventory from the other side (D-447).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BASE_FONT_PX,
  foldBelowPx,
  foldRows,
  LIVE_BOX_MIN_PX,
  LIVE_FOLD_ACTIONS_UNDER_PX,
  LIVE_FOLD_GIVES_PX,
  LIVE_FOLD_ORDER,
  LIVE_FOLDED_GAP_PX,
  LIVE_FOLDED_PADDING_PX,
  LIVE_GAP_PX,
  LIVE_KEPT_GAPS,
  LIVE_KEPT_ROWS_PX,
  LIVE_PAGE_PADDING_PX,
  LIVE_SCRUB_BLOCK_PX,
  liveKeptPx,
  ROW_PX,
  TAP_PX,
  unfoldedBoxHeightPx,
} from './layout';

const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
const liveCss = readFileSync('src/ui/screens/Live.module.css', 'utf8');

/** The rows both wide states render that a fold re-cuts. */
const WIDE_ROWS = ['top-row', 'box', 'conditions', 'actions'] as const;
/** The box height at which the block under the box leaves the box exactly its floor. */
const FLOOR = LIVE_BOX_MIN_PX + LIVE_SCRUB_BLOCK_PX;

describe('the box floor and the fold (FR-SHP-3)', () => {
  it('takes the row and the tap target from tokens.css rather than from memory', () => {
    const row = /--row:\s*([\d.]+)rem;/.exec(tokens);
    expect(row, 'tokens.css should give --row in rem').not.toBeNull();
    expect(ROW_PX).toBe(Number(row?.[1]) * BASE_FONT_PX);
    expect(tokens).toMatch(/--tap:\s*calc\(2 \* var\(--row\)\);/);
    expect(TAP_PX).toBe(2 * ROW_PX);
  });

  it('is eight rows: the smallest box in which the drawing is still a bowl', () => {
    expect(LIVE_BOX_MIN_PX).toBe(192);
    expect(LIVE_BOX_MIN_PX / ROW_PX).toBe(8);
  });

  it("takes the page's padding and gap from the stylesheet: a quarter row each, and the folded page's from its fold block", () => {
    expect(liveCss).toMatch(/\.page \{[^}]*padding: calc\(var\(--row\) \/ 4\) calc\(2 \* var\(--cell\)\);/);
    expect(liveCss).toMatch(/\.page \{[^}]*gap: calc\(var\(--row\) \/ 4\);/);
    expect(LIVE_PAGE_PADDING_PX).toBe(ROW_PX / 2);
    expect(LIVE_GAP_PX).toBe(ROW_PX / 4);
    expect(liveCss).toMatch(/\.page\[data-compact='false'\]\[data-fold\] \{[^}]*--live-row-gap: calc\(var\(--row\) \/ 6\);[^}]*padding-bottom: calc\(var\(--row\) \/ 2\);/);
    expect(LIVE_FOLDED_GAP_PX).toBe(ROW_PX / 6);
    expect(LIVE_FOLDED_PADDING_PX).toBe(ROW_PX / 4 + ROW_PX / 2);
  });

  /*
   * R78 (D-448, re-deriving D-414): the rows are a state's. Watching keeps the top row and the controls row and
   * nothing under the box; scrubbing adds the block's four rows with a gap each. The strip's line and the
   * actions row R71 moved to the rail — what the old table over-counted by — are in neither.
   */
  it('keeps the rows each state draws around the box: two watching, the scrub block under it scrubbing', () => {
    expect(LIVE_KEPT_ROWS_PX.watching).toEqual([TAP_PX, TAP_PX]);
    expect(LIVE_KEPT_ROWS_PX.scrubbing).toEqual([TAP_PX, TAP_PX, TAP_PX, ROW_PX, 3 * ROW_PX, TAP_PX]);
    expect(LIVE_KEPT_GAPS).toEqual({ watching: 2, scrubbing: 6 });
    expect(liveKeptPx('watching')).toBe(120);
    expect(liveKeptPx('scrubbing')).toBe(336);
    // The block: 48 + 24 + 72 + 48 of rows, the three gaps between them and the one over them.
    expect(LIVE_SCRUB_BLOCK_PX).toBe(216);
    // The old table said 427 for every state: over by the strip's line (37), the actions row (48) and a gap (6).
    expect(427 - liveKeptPx('scrubbing')).toBe(ROW_PX + ROW_PX / 2 + 1 + TAP_PX + LIVE_GAP_PX);
  });

  it('folds nothing while the box keeps its floor with the block under it, and the head of the order when it does not', () => {
    expect(foldRows(null, WIDE_ROWS)).toEqual([]);
    expect(foldRows(960, WIDE_ROWS)).toEqual([]);
    expect(foldRows(FLOOR, WIDE_ROWS)).toEqual([]);
    expect(foldRows(FLOOR - 1, WIDE_ROWS)).toEqual(['controls']);
    expect(foldRows(FLOOR - LIVE_FOLD_ACTIONS_UNDER_PX, WIDE_ROWS)).toEqual(['controls']);
    expect(foldRows(FLOOR - LIVE_FOLD_ACTIONS_UNDER_PX - 1, WIDE_ROWS)).toEqual(['controls', 'actions']);
    expect(foldRows(0, WIDE_ROWS)).toEqual(LIVE_FOLD_ORDER);
    // 1200 × 450 unfolded: the page's 450 less the watching rows is a 330 px box, 114 with the block under it.
    expect(foldRows(450 - liveKeptPx('watching'), WIDE_ROWS)).toEqual(LIVE_FOLD_ORDER);
  });

  it('folds in the order and no other: every answer is a head of LIVE_FOLD_ORDER, and never shrinks as the height grows', () => {
    let last = LIVE_FOLD_ORDER.length;
    for (let height = 0; height <= 1200; height += 1) {
      const folded = foldRows(height, WIDE_ROWS);
      expect(folded).toEqual(LIVE_FOLD_ORDER.slice(0, folded.length));
      expect(folded.length).toBeLessThanOrEqual(last);
      last = folded.length;
    }
  });

  it('never names a row the state does not render, nor any after it (D-447)', () => {
    expect(foldRows(0, [])).toEqual([]);
    expect(foldRows(0, ['top-row', 'box'])).toEqual(['controls']);
    expect(foldRows(0, ['top-row', 'box', 'conditions'])).toEqual(['controls']);
    expect(foldRows(0, ['conditions', 'actions'])).toEqual([]);
  });

  it('names the height each row folds under, consistently with foldRows', () => {
    for (const row of LIVE_FOLD_ORDER) {
      const below = foldBelowPx(row);
      expect(foldRows(below, WIDE_ROWS)).not.toContain(row);
      expect(foldRows(below - 1, WIDE_ROWS)).toContain(row);
    }
    expect(foldBelowPx('controls')).toBe(FLOOR);
  });

  it('gives the box back what the control rows let out, and takes it out of the measurement again', () => {
    // Two rows of 48 at 24, two gaps of 6 at 4, less the 6 px the page's foot grows by: at 1200 × 450, 330 to 376.
    expect(LIVE_FOLD_GIVES_PX.controls).toBe(46);
    expect(LIVE_FOLD_GIVES_PX.actions).toBe(0);
    expect(unfoldedBoxHeightPx(376, ['controls', 'actions'])).toBe(330);
    expect(unfoldedBoxHeightPx(330, [])).toBe(330);
    // The decision is the same from either side of the fold, so folding cannot unfold itself.
    for (let height = 0; height <= 1200; height += 1) {
      const folded = foldRows(height, WIDE_ROWS);
      const measured = height + folded.reduce((sum, row) => sum + LIVE_FOLD_GIVES_PX[row], 0);
      expect(foldRows(unfoldedBoxHeightPx(measured, folded), WIDE_ROWS)).toEqual(folded);
    }
  });
});
