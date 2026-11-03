/**
 * R147 (FR-FULL-3, FR-FULL-4, D-918, D-924): the full sky's constants hold the spec's numbers, the swipe's two
 * thresholds are SPEC §4.51's, and `hintFitsBeside` puts the hint on the button's row only when the
 * two fit FR-COMP-4's 36 cells, the hint counted at `--small` as `controlRows.test.ts` counts it. R157 (FR-PHONE-3,
 * FR-PHONE-5): over the row's labels, `[ follow ]` and `[ controls ]`, and `HINT_TOUCH_CLAUSES` is the spec's.
 */
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { FULL_OVERLAY_MAX_SHARE, HINT_TOUCH_CLAUSES, hintFitsBeside, SHEET_FLICK_PX_PER_MS, SHEET_MAX_SHARE, SHEET_SWIPE_CLOSE_PX } from './layout';

describe('the full sky’s constants (FR-FULL, D-918)', () => {
  it('are SPEC §4.50’s defaults', () => {
    expect(FULL_OVERLAY_MAX_SHARE).toBe(0.12);
    expect(SHEET_MAX_SHARE).toBe(0.7);
  });

  it('hold SPEC §4.51’s swipe constants (FR-GYRO-8, D-948)', () => {
    expect(SHEET_SWIPE_CLOSE_PX).toBe(64);
    expect(SHEET_FLICK_PX_PER_MS).toBe(0.5);
  });

  it('close on a swipe well under the sheet’s height at 390 × 667', () => {
    expect(SHEET_SWIPE_CLOSE_PX).toBeLessThan(667 * SHEET_MAX_SHARE * 0.25);
  });

  it('leave at least 250 px of sky above the open sheet at 390 × 844', () => {
    expect(844 * (1 - SHEET_MAX_SHARE)).toBeGreaterThanOrEqual(250);
  });
});

describe('hintFitsBeside (FR-FULL-3, D-924; FR-PHONE-3, D-964)', () => {
  it('counts the hint at --small, then a cell of gap and the bracketed label for each control and the row’s cell of padding (D-1026), up to 36 cells', () => {
    // ` [ controls ]` is 13 body cells and the padding one, so the hint has 22 of them: 25 characters at 14/16 of a cell each.
    const label = en.sheet.controls;
    const room = Math.floor(((36 - 1 - 1 - 4 - label.length) * 16) / 14);
    expect(hintFitsBeside('x'.repeat(room), [label])).toBe(true);
    expect(hintFitsBeside('x'.repeat(room + 1), [label])).toBe(false);
    // ` [ follow ] [ controls ]` is 24 body cells and the padding one, so beside both the hint has 11: 12 characters.
    const both = [en.sheet.follow, en.sheet.controls];
    const roomBoth = Math.floor(((36 - 1 - 2 - 8 - en.sheet.follow.length - label.length) * 16) / 14);
    expect(roomBoth).toBe(12);
    expect(hintFitsBeside('x'.repeat(roomBoth), both)).toBe(true);
    expect(hintFitsBeside('x'.repeat(roomBoth + 1), both)).toBe(false);
  });

  it('puts the dome’s touch drag clause beside [ controls ] but not the mouse lines, and the window’s three clauses above it', () => {
    // The drag clause alone, `SkyHint`'s dome line: 12, 26, 19 and 26 characters before ` [ controls ]` /
    // ` [ controles ]` and the row's padding cell (D-1026) — 24.5, 36.75, 31.63 and 37.75 cells. The mouse lines are over.
    const beside = { en: { coarse: true, fine: false }, es: { coarse: true, fine: false } } as const;
    for (const [locale, m] of [
      ['en', en],
      ['es', es],
    ] as const) {
      const words = m.window.skyHint;
      for (const pointer of ['coarse', 'fine'] as const) {
        expect(hintFitsBeside(words.drag[pointer], [m.sheet.controls]), `${locale} ${pointer}: ${words.drag[pointer]}`).toBe(beside[locale][pointer]);
        // R161: a touch line has no star clause since FR-PHONE-5 (its words left the catalogs), so it is drag and zoom.
        const window = (pointer === 'fine' ? [words.drag.fine, words.zoom.fine, words.star.fine] : [words.drag.coarse, words.zoom.coarse]).join(' · ');
        expect(hintFitsBeside(window, [m.sheet.controls]), window).toBe(false);
      }
    }
  });

  it('puts the touch line above [ follow ] [ controls ] in both languages, both forms (FR-PHONE-3, FR-PHONE-5)', () => {
    for (const m of [en, es]) {
      const words = m.window.skyHint;
      const labels = [m.sheet.follow, m.sheet.controls];
      for (const line of [`${words.drag.coarse} · ${words.zoom.coarse}`, `${words.drag.coarse} · ${words.follow({ key: 'A' })}`]) expect(hintFitsBeside(line, labels), line).toBe(false);
      // The dome's touch line, the drag clause alone, fits beside both in English (10.5 + 24 cells) and not in Spanish (16.63 + 25).
      expect(hintFitsBeside(words.drag.coarse, labels)).toBe(m === en);
    }
  });

  it('is a fact of the strings alone: an empty hint always fits', () => {
    expect(hintFitsBeside('', [en.sheet.controls])).toBe(true);
    expect(hintFitsBeside('', ['x'.repeat(30)])).toBe(true);
    expect(hintFitsBeside('', ['x'.repeat(31)])).toBe(false);
    expect(hintFitsBeside('', [])).toBe(true);
  });
});

describe('HINT_TOUCH_CLAUSES (FR-PHONE-5)', () => {
  it('is SPEC §4.52’s 2', () => {
    expect(HINT_TOUCH_CLAUSES).toBe(2);
  });
});
