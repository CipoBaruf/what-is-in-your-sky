/**
 * R113 (FR-STAR-4; PLAN D-750): the hand camera — the dome's constants, the
 * page's own tilt range, the five moves, and the rotation `uprightRotation`
 * gives for where the hand points.
 */
import { describe, expect, it, vi } from 'vitest';
import { DRAG_PX_PER_DEG, PITCH_MAX_DEG, PITCH_MIN_DEG, PITCH_STEP_DEG, YAW_STEP_DEG } from '../dome/camera';
import {
  bearingOf,
  clampTilt,
  createHandCamera,
  defaultFacingDeg,
  dragTo,
  face,
  handRotation,
  initialHand,
  SENSOR_CAMERA,
  STARS_DEFAULT_FACING,
  STARS_DEFAULT_TILT,
  STARS_TILT_MAX_DEG,
  STARS_TILT_MIN_DEG,
  stepPitch,
  stepYaw,
  up,
} from './camera';
import { lookDirection, uprightRotation } from './projection';

const hand = { azDeg: 180, altDeg: 35 };

describe('the hand camera (FR-STAR-4)', () => {
  it('uses the dome’s three constants and its own tilt range', () => {
    expect(DRAG_PX_PER_DEG).toBe(4);
    expect(YAW_STEP_DEG).toBe(15);
    expect(PITCH_STEP_DEG).toBe(5);
    expect(STARS_TILT_MIN_DEG).toBe(-10);
    expect(STARS_TILT_MAX_DEG).toBe(90);
    // The page's range is not the dome's [5°, 80°]: it reaches below the horizon and up to the zenith.
    expect(STARS_TILT_MIN_DEG).toBeLessThan(PITCH_MIN_DEG);
    expect(STARS_TILT_MAX_DEG).toBeGreaterThan(PITCH_MAX_DEG);
    expect(clampTilt(-30)).toBe(STARS_TILT_MIN_DEG);
    expect(clampTilt(95)).toBe(STARS_TILT_MAX_DEG);
    expect(clampTilt(12.5)).toBe(12.5);
  });

  it('opens on the pole side at 35° (FR-STAR-3)', () => {
    expect(STARS_DEFAULT_TILT).toBe(35);
    expect(STARS_DEFAULT_FACING).toEqual({ north: 0, south: 180 });
    expect(defaultFacingDeg(-38.93)).toBe(180);
    expect(defaultFacingDeg(48.85)).toBe(0);
    expect(defaultFacingDeg(0)).toBe(0);
    expect(initialHand(-38.93)).toEqual({ azDeg: 180, altDeg: 35 });
  });

  it('drags at 4 px per degree with the sky following the finger', () => {
    // 40 px to the right pulls the sky right: the view turns 10° left. 20 px down: the view looks 5° higher.
    expect(dragTo(hand, 40, 20)).toEqual({ azDeg: 170, altDeg: 40 });
    expect(dragTo(hand, -40, -20)).toEqual({ azDeg: 190, altDeg: 30 });
    // The azimuth wraps; the altitude clamps.
    expect(dragTo({ azDeg: 5, altDeg: 85 }, 40, 400)).toEqual({ azDeg: 355, altDeg: 90 });
    expect(dragTo({ azDeg: 350, altDeg: -5 }, -80, -400)).toEqual({ azDeg: 10, altDeg: -10 });
  });

  it('steps 15° in yaw and 5° in pitch, inside the clamp', () => {
    expect(stepYaw(hand, 1)).toEqual({ azDeg: 195, altDeg: 35 });
    expect(stepYaw(hand, -1)).toEqual({ azDeg: 165, altDeg: 35 });
    expect(stepYaw({ azDeg: 355, altDeg: 35 }, 1)).toEqual({ azDeg: 10, altDeg: 35 });
    expect(stepPitch(hand, 1)).toEqual({ azDeg: 180, altDeg: 40 });
    expect(stepPitch(hand, -1)).toEqual({ azDeg: 180, altDeg: 30 });
    expect(stepPitch({ azDeg: 180, altDeg: 88 }, 1)).toEqual({ azDeg: 180, altDeg: 90 });
    expect(stepPitch({ azDeg: 180, altDeg: -8 }, -1)).toEqual({ azDeg: 180, altDeg: -10 });
  });

  it('faces a compass point at the current tilt, and `up` is the zenith', () => {
    expect(bearingOf('N')).toBe(0);
    expect(bearingOf('E')).toBe(90);
    expect(bearingOf('SW')).toBe(225);
    expect(bearingOf('NNW')).toBe(337.5);
    expect(face(hand, 'NE')).toEqual({ azDeg: 45, altDeg: 35 });
    expect(face({ azDeg: 10, altDeg: -10 }, 'W')).toEqual({ azDeg: 270, altDeg: -10 });
    expect(up(hand)).toEqual({ azDeg: 180, altDeg: 90 });
  });

  it('composes the rotation the sensor would give for a phone held upright toward the same point', () => {
    const m = handRotation(hand);
    expect(m).toEqual(uprightRotation(180, 35));
    const look = lookDirection(m);
    expect(look.azDeg).toBeCloseTo(180, 6);
    expect(look.altDeg).toBeCloseTo(35, 6);
    const below = lookDirection(handRotation({ azDeg: 90, altDeg: -10 }));
    expect(below.azDeg).toBeCloseTo(90, 6);
    expect(below.altDeg).toBeCloseTo(-10, 6);
  });
});

describe('createHandCamera', () => {
  it('is a store: the same snapshot until a move changes it, one notice per change, none for a move that changes nothing', () => {
    const camera = createHandCamera({ azDeg: -10, altDeg: 95 });
    expect(camera.source).toBe('hand');
    // The initial state is normalised and clamped like every other.
    expect(camera.get()).toEqual({ azDeg: 350, altDeg: 90 });
    const first = camera.get();
    expect(camera.get()).toBe(first);
    const listener = vi.fn();
    const stop = camera.subscribe(listener);
    camera.up();
    expect(listener).not.toHaveBeenCalled();
    expect(camera.get()).toBe(first);
    camera.stepPitch(1);
    expect(listener).not.toHaveBeenCalled();
    camera.stepPitch(-2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(camera.get()).toEqual({ azDeg: 350, altDeg: 80 });
    camera.dragTo(40, 0);
    camera.stepYaw(1);
    camera.face('S');
    expect(listener).toHaveBeenCalledTimes(4);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 80 });
    camera.up();
    expect(listener).toHaveBeenCalledTimes(5);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 90 });
    stop();
    camera.stepYaw(-1);
    expect(listener).toHaveBeenCalledTimes(5);
    expect(camera.get()).toEqual({ azDeg: 165, altDeg: 90 });
  });

  it('the sensor camera carries nothing but its source', () => {
    expect(SENSOR_CAMERA).toEqual({ source: 'sensor' });
  });
});
