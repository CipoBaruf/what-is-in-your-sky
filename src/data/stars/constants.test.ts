import { describe, expect, it } from 'vitest';
import {
  BLOOM_MAG,
  BLOOM_RADIUS_PX,
  BLOOM_STRENGTH,
  BV_TONES,
  DEEP_MAG_LIMIT,
  DEEP_NODE_POOL,
  DOT_RADIUS_PX,
  FIELD_DETAIL_STEPS,
  HORIZON_BAND_DEG,
  HORIZON_STRENGTH,
  MILKY_WAY_BANDS_DEG,
  MILKY_WAY_STRENGTH,
  MOON_DISC_PX,
  STAR_DOT_MAG,
  STAR_MAG_LIMIT,
  STAR_SIZES_PX,
} from './constants';

/**
 * R154 (FR-LOOK-10, D-974): the look's constants are SPEC §4.53's table. The
 * three strengths are the owner's and move only by a Decision Log row, so a
 * change here without one is a failing test.
 */
describe("the look's constants (SPEC §4.53)", () => {
  it("pins the three strengths at the mockup's second-cut sliders", () => {
    expect([BLOOM_STRENGTH, MILKY_WAY_STRENGTH, HORIZON_STRENGTH]).toEqual([0.7, 0.6, 0.6]);
  });

  it('pins the deep catalogue, the field steps and the pool', () => {
    expect(DEEP_MAG_LIMIT).toBe(6.5);
    expect(FIELD_DETAIL_STEPS).toEqual([
      [75, 4.5, 1.5],
      [45, 5.3, 1.5],
      [30, 6.0, 2.5],
      [0, 6.5, 3.2],
    ]);
    expect(DEEP_NODE_POOL).toBe(600);
  });

  it('keeps the field steps widest first, ending at 0 and at the deep limit, starting at the bright one', () => {
    const above = FIELD_DETAIL_STEPS.map(([a]) => a);
    expect(above).toEqual([...above].sort((a, b) => b - a));
    expect(above.at(-1)).toBe(0);
    expect(FIELD_DETAIL_STEPS[0]?.[1]).toBe(STAR_MAG_LIMIT);
    expect(FIELD_DETAIL_STEPS.at(-1)?.[1]).toBe(DEEP_MAG_LIMIT);
    for (const [, magLimit, nameMag] of FIELD_DETAIL_STEPS) expect(nameMag).toBeLessThan(magLimit);
  });

  it('pins the ladder: characters to 2.5 at 20, 16 and 13 px, dots from 2.4 to 0.6 px', () => {
    expect(STAR_DOT_MAG).toBe(2.5);
    expect(STAR_SIZES_PX).toEqual([
      { maxMag: 0.5, px: 20 },
      { maxMag: 1.5, px: 16 },
      { maxMag: 2.5, px: 13 },
    ]);
    expect(STAR_SIZES_PX.at(-1)?.maxMag).toBe(STAR_DOT_MAG);
    expect(DOT_RADIUS_PX).toEqual({ bright: 2.4, faint: 0.6 });
  });

  it('pins the four tones from B−V', () => {
    expect(BV_TONES).toEqual([
      { below: 0.0, tone: 'blue' },
      { below: 0.4, tone: 'white' },
      { below: 0.8, tone: 'yellow' },
      { below: Infinity, tone: 'orange' },
    ]);
  });

  it('pins the bloom: Sirius about 26 px, a first-magnitude star about 14', () => {
    expect(BLOOM_MAG).toBe(1.8);
    const radius = (v: number): number => BLOOM_RADIUS_PX.basePx + (BLOOM_RADIUS_PX.pivotMag - v) * BLOOM_RADIUS_PX.pxPerMag;
    expect(radius(-1.46)).toBeCloseTo(26.3, 1);
    expect(radius(1)).toBe(14);
  });

  it('pins the band, the haze and the Moon', () => {
    expect(HORIZON_BAND_DEG).toBe(15);
    expect(MILKY_WAY_BANDS_DEG).toEqual([12, 7, 3]);
    expect(MOON_DISC_PX).toBe(10);
  });
});
