import { describe, expect, it } from 'vitest';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../../tests/support/moonFixtures';
import type { MoonPhaseName } from '../../../../model';
import { MOON_PHASE_GLYPH, moonGlyph, moonVisible, sunListed, sunVisible } from './bodies';

/**
 * R22, FR-DOME-6: the reading both views share. These are the rules that keep
 * the dome and the polar chart telling one story (FR-DOME-7), so they are
 * tested here once rather than twice in the two views' own files.
 */
const PHASES: readonly MoonPhaseName[] = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];

describe('the Sun', () => {
  it('FR-DARK-2: is drawn while its centre is above the horizon', () => {
    for (const altDeg of [0.01, 40, 90]) expect(sunVisible({ altDeg })).toBe(true);
    for (const altDeg of [0, -0.1, -8, -30]) expect(sunVisible({ altDeg })).toBe(false);
  });

  it('keeps its legend line down to −18° (D-1262)', () => {
    for (const altDeg of [40, 0, -8, -17.9]) expect(sunListed({ altDeg })).toBe(true);
    for (const altDeg of [-18, -30]) expect(sunListed({ altDeg })).toBe(false);
  });
});

describe('the Moon', () => {
  it('is drawn while it is above the horizon and not below it', () => {
    expect(moonVisible(MOON_FIXTURE)).toBe(true);
    expect(moonVisible(MOON_DOWN)).toBe(false);
    expect(moonVisible({ elDeg: 0 })).toBe(false);
    expect(moonVisible({ elDeg: 0.01 })).toBe(true);
  });

  it('has a glyph for every phase name, all of them single monochrome characters', () => {
    for (const phase of PHASES) {
      const glyph = MOON_PHASE_GLYPH[phase];
      expect(glyph, phase).toBeTruthy();
      // One code point, and outside the emoji planes: FR-THEME-3 lets no
      // element keep a hue of its own in the night theme, which a colour
      // emoji would (FR-X-5 wants the monochrome reading anyway).
      expect([...glyph], phase).toHaveLength(1);
      expect(glyph.codePointAt(0) ?? 0, phase).toBeLessThan(0x1_00_00);
    }
    expect(Object.keys(MOON_PHASE_GLYPH).sort()).toEqual([...PHASES].sort());
    expect(moonGlyph(MOON_FIXTURE)).toBe(MOON_PHASE_GLYPH.waningGibbous);
  });

  it('tells the two crescents and the two quarters apart, waxing lit on one side and waning on the other', () => {
    expect(MOON_PHASE_GLYPH.waxingCrescent).not.toBe(MOON_PHASE_GLYPH.waningCrescent);
    expect(MOON_PHASE_GLYPH.firstQuarter).not.toBe(MOON_PHASE_GLYPH.lastQuarter);
    expect(MOON_PHASE_GLYPH.new).not.toBe(MOON_PHASE_GLYPH.full);
    // The two gibbous phases share a glyph and are the only pair that does;
    // both read as "nearly full" and the phase's name is written out elsewhere.
    const glyphs = PHASES.map((phase) => MOON_PHASE_GLYPH[phase]);
    expect(new Set(glyphs).size).toBe(PHASES.length - 1);
    expect(MOON_PHASE_GLYPH.waxingGibbous).toBe(MOON_PHASE_GLYPH.waningGibbous);
  });
});
