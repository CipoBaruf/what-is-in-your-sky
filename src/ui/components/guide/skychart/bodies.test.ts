import { describe, expect, it } from 'vitest';
import { MOON_DOWN, MOON_FIXTURE } from '../../../../../tests/support/moonFixtures';
import type { MoonPhaseName } from '../../../../model';
import { GLOW_MIN_ALT_DEG, glowHalfWidthDeg, glowHeightDeg, glowStrength, MOON_PHASE_GLYPH, moonGlyph, moonVisible, sunVisible } from './bodies';

/**
 * R22, FR-DOME-6: the reading both views share. These are the rules that keep
 * the dome and the polar chart telling one story (FR-DOME-7), so they are
 * tested here once rather than twice in the two views' own files.
 */
const PHASES: readonly MoonPhaseName[] = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];

describe('the Sun glow ramp', () => {
  it('is nothing at −18°, half at −9° and full at the horizon, and stays full above it', () => {
    expect(glowStrength(GLOW_MIN_ALT_DEG)).toBe(0);
    expect(glowStrength(-30)).toBe(0);
    expect(glowStrength(-9)).toBeCloseTo(0.5, 9);
    expect(glowStrength(0)).toBe(1);
    expect(glowStrength(20)).toBe(1);
  });

  it('grows without a step as the Sun rises, and the Sun is drawn exactly where it has a strength', () => {
    let previous = -1;
    for (let alt = GLOW_MIN_ALT_DEG; alt <= 0; alt += 0.5) {
      const strength = glowStrength(alt);
      expect(strength).toBeGreaterThanOrEqual(previous);
      expect(sunVisible({ altDeg: alt })).toBe(strength > 0);
      previous = strength;
    }
    expect(sunVisible({ altDeg: GLOW_MIN_ALT_DEG - 0.1 })).toBe(false);
  });

  it('is wider than it is tall, and both grow with it', () => {
    for (const strength of [0.1, 0.5, 1]) {
      expect(glowHalfWidthDeg(strength)).toBeGreaterThan(glowHeightDeg(strength));
    }
    expect(glowHalfWidthDeg(1)).toBeGreaterThan(glowHalfWidthDeg(0));
    expect(glowHeightDeg(1)).toBeGreaterThan(glowHeightDeg(0));
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
