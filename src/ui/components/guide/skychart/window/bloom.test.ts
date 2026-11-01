/** R155 (FR-LOOK-6; D-974): the bloom's radii, stops, tones and ids. */
import { describe, expect, it } from 'vitest';
import { BLOOM_STRENGTH } from '../../../../../data/stars/constants';
import { BLOOM_STOPS, BLOOM_TONES, bloomGradientId, bloomRadiusPx } from './bloom';

describe('the bloom (FR-LOOK-6)', () => {
  it('is 8 + (2.2 − V) × 5 px: Sirius about 26, a first-magnitude star about 14', () => {
    expect(bloomRadiusPx(-1.46)).toBe(26.3);
    expect(bloomRadiusPx(1)).toBe(14);
    expect(bloomRadiusPx(1.79)).toBe(10.1);
    expect(bloomRadiusPx(-4)).toBe(39);
  });

  it('fades from 0.32 × BLOOM_STRENGTH at the centre through 0.08 × it at 35 % to nothing', () => {
    expect(BLOOM_STRENGTH).toBe(0.7);
    expect(BLOOM_STOPS).toEqual([
      { offset: 0, alpha: 0.224 },
      { offset: 0.35, alpha: 0.056 },
      { offset: 1, alpha: 0 },
    ]);
  });

  it('has one gradient per tone and one for the planets, under the field’s prefix', () => {
    expect(BLOOM_TONES).toEqual(['chart-star', 'chart-star-blue', 'chart-star-yellow', 'chart-star-orange', 'chart-planet']);
    expect(bloomGradientId('r1', 'chart-star-orange')).toBe('r1-bloom-chart-star-orange');
    expect(new Set(BLOOM_TONES.map((tone) => bloomGradientId('r1', tone))).size).toBe(5);
  });
});
