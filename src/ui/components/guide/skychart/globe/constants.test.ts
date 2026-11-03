import { describe, expect, it } from 'vitest';
import { BODIES_EVERY_MS as LIVE_BODIES_EVERY_MS } from '../../../../../lib/playback';
import { YAW_STEP_DEG } from '../dome/camera';
import {
  BODIES_EVERY_MS,
  GLOBE_BUDGET_KB,
  GLOBE_DIM_OPACITY,
  GLOBE_GRID_STEP_DEG,
  GLOBE_GROUND_OPACITY,
  GLOBE_KEY_STEP_DEG,
  GLOBE_MAIN_KB,
  GLOBE_MAX_NODES,
  GLOBE_OPEN_ALT_DEG,
  GLOBE_RADIUS_SHARE,
  GLOBE_SPAN_DAYS,
  GLOBE_SPEEDS,
  GLOBE_STARS_KB,
  GLOBE_ZOOM_MAX,
  GLOBE_ZOOM_MIN,
  GLOBE_ZOOM_STEP,
} from './constants';

/** R167: SPEC §4.55's constants table, value for value. */
describe('the globe’s constants (SPEC §4.55)', () => {
  it('are the spec table’s', () => {
    expect({
      GLOBE_RADIUS_SHARE,
      GLOBE_OPEN_ALT_DEG,
      GLOBE_ZOOM_MIN,
      GLOBE_ZOOM_MAX,
      GLOBE_ZOOM_STEP,
      GLOBE_KEY_STEP_DEG,
      GLOBE_DIM_OPACITY,
      GLOBE_GROUND_OPACITY,
      GLOBE_GRID_STEP_DEG,
      GLOBE_SPAN_DAYS,
      GLOBE_SPEEDS,
      GLOBE_MAX_NODES,
      GLOBE_BUDGET_KB,
      GLOBE_MAIN_KB,
      GLOBE_STARS_KB,
    }).toEqual({
      GLOBE_RADIUS_SHARE: 0.45,
      GLOBE_OPEN_ALT_DEG: 25,
      GLOBE_ZOOM_MIN: 0.5,
      GLOBE_ZOOM_MAX: 4,
      GLOBE_ZOOM_STEP: 1.25,
      GLOBE_KEY_STEP_DEG: 15,
      GLOBE_DIM_OPACITY: 0.4,
      GLOBE_GROUND_OPACITY: 0.85,
      GLOBE_GRID_STEP_DEG: 30,
      GLOBE_SPAN_DAYS: 366,
      GLOBE_SPEEDS: [60, 600, 3600],
      GLOBE_MAX_NODES: 400,
      GLOBE_BUDGET_KB: 15,
      GLOBE_MAIN_KB: 1.5,
      GLOBE_STARS_KB: 1.5,
    });
  });

  it('share what they say they share: the window’s key step, the live page’s bodies budget', () => {
    expect(GLOBE_KEY_STEP_DEG).toBe(YAW_STEP_DEG);
    expect(BODIES_EVERY_MS).toBe(LIVE_BODIES_EVERY_MS);
    // Ten zoom steps cover the range (§4.55): 1.25^10 ≈ 9.3 against 4 / 0.5 = 8.
    expect(GLOBE_ZOOM_STEP ** 10).toBeGreaterThan(GLOBE_ZOOM_MAX / GLOBE_ZOOM_MIN);
    expect(GLOBE_ZOOM_STEP ** 9).toBeLessThan(GLOBE_ZOOM_MAX / GLOBE_ZOOM_MIN);
    // The grid's hour circles every 2 h.
    expect(GLOBE_GRID_STEP_DEG / 15).toBe(2);
  });
});
