import { describe, expect, it } from 'vitest';
import { FIELD_DETAIL_STEPS, STAR_MAG_LIMIT } from '../../../../../data/stars/constants';
import { fieldDetail } from './fieldDetail';
import { WINDOW_FOV, WINDOW_FOV_MAX_DEG, WINDOW_FOV_MIN_DEG } from './projection';

/** R154 (FR-LOOK-9, D-974): the row of `FIELD_DETAIL_STEPS` for a field. */
describe('fieldDetail', () => {
  it.each([
    [WINDOW_FOV_MAX_DEG, 4.5, 1.5],
    [76, 4.5, 1.5],
    [75, 5.3, 1.5],
    [WINDOW_FOV, 5.3, 1.5],
    [45.01, 5.3, 1.5],
    [45, 6.0, 2.5],
    [30.5, 6.0, 2.5],
    [30, 6.5, 3.2],
    [WINDOW_FOV_MIN_DEG, 6.5, 3.2],
    [0, 6.5, 3.2],
  ])('at %f° draws to %f and names to %f', (fov, magLimit, nameMag) => {
    expect(fieldDetail(fov)).toEqual({ magLimit, nameMag });
  });

  it('takes a field that is not a number as the widest, and a negative one as the narrowest', () => {
    expect(fieldDetail(Number.NaN)).toEqual({ magLimit: 4.5, nameMag: 1.5 });
    expect(fieldDetail(-1)).toEqual({ magLimit: 6.5, nameMag: 3.2 });
  });

  it('never draws less or names less as the field narrows', () => {
    let last = fieldDetail(WINDOW_FOV_MAX_DEG);
    for (let fov = WINDOW_FOV_MAX_DEG; fov >= WINDOW_FOV_MIN_DEG; fov -= 0.5) {
      const row = fieldDetail(fov);
      expect(row.magLimit).toBeGreaterThanOrEqual(last.magLimit);
      expect(row.nameMag).toBeGreaterThanOrEqual(last.nameMag);
      last = row;
    }
  });

  it('needs the deep catalogue only past the widest row, and draws every deep star at the narrowest', () => {
    expect(fieldDetail(WINDOW_FOV_MAX_DEG).magLimit).toBeLessThanOrEqual(STAR_MAG_LIMIT);
    expect(fieldDetail(WINDOW_FOV_MIN_DEG).magLimit).toBe(FIELD_DETAIL_STEPS.at(-1)?.[1]);
  });

  it('reads the steps it is given, and refuses none', () => {
    expect(fieldDetail(10, [[0, 5, 2]])).toEqual({ magLimit: 5, nameMag: 2 });
    expect(fieldDetail(10, [[20, 5, 2]])).toEqual({ magLimit: 5, nameMag: 2 });
    expect(() => fieldDetail(10, [])).toThrow(/no steps/);
  });
});
