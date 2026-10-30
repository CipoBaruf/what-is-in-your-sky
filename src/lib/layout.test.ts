/**
 * R147 (FR-FULL-3, FR-FULL-4, D-918, D-924): the full sky's constants hold the spec's numbers, the side sheet is
 * the landscape rail's width by construction, and `hintFitsBeside` puts the hint on the button's row only when the
 * two fit FR-COMP-4's 36 cells, the hint counted at `--small` as `controlRows.test.ts` counts it.
 */
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { FULL_OVERLAY_MAX_SHARE, hintFitsBeside, LANDSCAPE_DRAWING_MIN_SHARE, SHEET_MAX_SHARE, SHEET_SIDE_SHARE, SHEET_TAP_SLOP_PX } from './layout';

describe('the full sky’s constants (FR-FULL, D-918)', () => {
  it('are SPEC §4.50’s defaults', () => {
    expect(FULL_OVERLAY_MAX_SHARE).toBe(0.12);
    expect(SHEET_MAX_SHARE).toBe(0.7);
    expect(SHEET_TAP_SLOP_PX).toBe(8);
    expect(SHEET_SIDE_SHARE).toBeCloseTo(0.45, 10);
  });

  it('give the side sheet exactly the width the landscape drawing leaves', () => {
    expect(SHEET_SIDE_SHARE + LANDSCAPE_DRAWING_MIN_SHARE).toBeCloseTo(1, 10);
  });

  it('leave at least 250 px of sky above the open sheet at 390 × 844', () => {
    expect(844 * (1 - SHEET_MAX_SHARE)).toBeGreaterThanOrEqual(250);
  });
});

describe('hintFitsBeside (FR-FULL-3, D-924)', () => {
  it('counts the hint at --small, a cell of gap and the bracketed label at the body size, up to 36 cells', () => {
    // ` [ controls ]` is 13 body cells, so the hint has 23 of them: 26 characters at 14/16 of a cell each.
    const label = en.sheet.controls;
    const room = Math.floor(((36 - 1 - 4 - label.length) * 16) / 14);
    expect(hintFitsBeside('x'.repeat(room), label)).toBe(true);
    expect(hintFitsBeside('x'.repeat(room + 1), label)).toBe(false);
  });

  it('puts the dome’s drag clause beside the button but the Spanish mouse line, and the window’s three clauses above it', () => {
    // The drag clause alone, `SkyHint`'s dome line: 12, 26, 19 and 26 characters before ` [ controls ]` /
    // ` [ controles ]` — 23.5, 35.75, 30.63 and 36.75 cells. Only the Spanish mouse line is over.
    const beside = { en: { coarse: true, fine: true }, es: { coarse: true, fine: false } } as const;
    for (const [locale, m] of [
      ['en', en],
      ['es', es],
    ] as const) {
      const words = m.window.skyHint;
      for (const pointer of ['coarse', 'fine'] as const) {
        expect(hintFitsBeside(words.drag[pointer], m.sheet.controls), `${locale} ${pointer}: ${words.drag[pointer]}`).toBe(beside[locale][pointer]);
        const window = [words.drag[pointer], words.zoom[pointer], words.star[pointer]].join(' · ');
        expect(hintFitsBeside(window, m.sheet.controls), window).toBe(false);
      }
    }
  });

  it('is a fact of the strings alone: an empty hint always fits', () => {
    expect(hintFitsBeside('', en.sheet.controls)).toBe(true);
    expect(hintFitsBeside('', 'x'.repeat(31))).toBe(true);
    expect(hintFitsBeside('', 'x'.repeat(32))).toBe(false);
  });
});
