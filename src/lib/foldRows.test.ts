/**
 * R69 (FR-SHP-3; D-381): the wide live page's box floor and the fold order,
 * pure. The numbers are the stylesheet's rows in px, so the first test holds
 * them to the tokens the stylesheet is written in, the way
 * `tests/styles/breakpoint.test.ts` holds the wide breakpoint to the font
 * stack.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASE_FONT_PX, foldBelowPx, foldRows, LIVE_BOX_MIN_PX, LIVE_FOLD_GIVES_PX, LIVE_FOLD_ORDER, LIVE_GAP_PX, LIVE_KEPT_PX, LIVE_PAGE_PADDING_PX, ROW_PX, TAP_PX } from './layout';

const tokens = readFileSync('src/ui/styles/tokens.css', 'utf8');
const liveCss = readFileSync('src/ui/screens/Live.module.css', 'utf8');

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

  it("takes the page's padding and gap from the stylesheet: a quarter row each", () => {
    expect(liveCss).toMatch(/\.page \{[^}]*padding: calc\(var\(--row\) \/ 4\) calc\(2 \* var\(--cell\)\);/);
    expect(liveCss).toMatch(/\.page \{[^}]*gap: calc\(var\(--row\) \/ 4\);/);
    expect(LIVE_PAGE_PADDING_PX).toBe(ROW_PX / 2);
    expect(LIVE_GAP_PX).toBe(ROW_PX / 4);
  });

  it('keeps the rows measured at 1200 × 450 on the one-column page (spec §4.20 F-65: 343 px of rows, a 107 px box)', () => {
    expect(LIVE_KEPT_PX).toBe(343);
    expect(foldRows(450)).toEqual(['actions']);
  });

  it('folds nothing while the height leaves the box its floor, and the head of the order when it does not', () => {
    expect(foldRows(1080)).toEqual([]);
    expect(foldRows(768)).toEqual([]);
    expect(foldRows(LIVE_KEPT_PX + LIVE_BOX_MIN_PX)).toEqual([]);
    expect(foldRows(LIVE_KEPT_PX + LIVE_BOX_MIN_PX - 1)).toEqual(['actions']);
    expect(foldRows(420)).toEqual(['actions']);
    expect(foldRows(0)).toEqual(LIVE_FOLD_ORDER);
  });

  it('folds in the order and no other: every answer is a head of LIVE_FOLD_ORDER, and never shrinks as the height grows', () => {
    let last = LIVE_FOLD_ORDER.length;
    for (let height = 0; height <= 1200; height += 1) {
      const folded = foldRows(height);
      expect(folded).toEqual(LIVE_FOLD_ORDER.slice(0, folded.length));
      expect(folded.length).toBeLessThanOrEqual(last);
      last = folded.length;
    }
  });

  it('names the height each row folds under, consistently with foldRows', () => {
    for (const row of LIVE_FOLD_ORDER) {
      const below = foldBelowPx(row);
      expect(foldRows(below)).not.toContain(row);
      expect(foldRows(below - 1)).toContain(row);
    }
    expect(foldBelowPx('actions')).toBe(LIVE_KEPT_PX + LIVE_BOX_MIN_PX);
  });

  it('gives the box back more than the row it names: the four tap rows at one text row and the gaps at the compact token', () => {
    expect(LIVE_FOLD_GIVES_PX.actions).toBeGreaterThan(TAP_PX);
    // 48 for the row, 96 for the four rows, 10 for the five gaps, 8 for the strip's air, 24 back for the line the actions take: 138.
    expect(LIVE_FOLD_GIVES_PX.actions).toBe(138);
  });
});
