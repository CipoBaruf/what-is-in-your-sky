/**
 * R113 (FR-STAR-4; PLAN D-750): the hand camera — the dome's constants, the
 * page's own tilt range, the five moves, and the rotation `uprightRotation`
 * gives for where the hand points.
 */
import { describe, expect, it, vi } from 'vitest';
import { DRAG_PX_PER_DEG, PITCH_MAX_DEG, PITCH_MIN_DEG, PITCH_STEP_DEG, YAW_STEP_DEG } from '../dome/camera';
import {
  bearingOf,
  clampWindowTilt,
  createHandCamera,
  defaultFacingDeg,
  dragTo,
  face,
  facePeak,
  FACING_OPTIONS,
  FACING_POINTS,
  facingOf,
  handRotation,
  initialHand,
  PEAK_BELOW_CENTRE_DEG,
  PEAK_FACING_OPTIONS,
  PEAK_TILT_MAX_DEG,
  PEAK_TILT_MIN_DEG,
  resetZoom,
  SENSOR_CAMERA,
  STARS_DEFAULT_FACING,
  STARS_DEFAULT_TILT,
  STARS_TILT_MAX_DEG,
  STARS_TILT_MIN_DEG,
  stepPitch,
  stepYaw,
  up,
  ZOOM_KEY_FACTOR,
  ZOOM_WHEEL_RATE,
  zoomBy,
} from './camera';
import { clampWindowFov, lookDirection, uprightRotation, verticalHalfFieldDeg, WINDOW_FOV, WINDOW_FOV_MAX_DEG, WINDOW_FOV_MIN_DEG } from './projection';

const hand = { azDeg: 180, altDeg: 35, fovDeg: WINDOW_FOV };

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
    expect(clampWindowTilt(-30)).toBe(STARS_TILT_MIN_DEG);
    expect(clampWindowTilt(95)).toBe(STARS_TILT_MAX_DEG);
    expect(clampWindowTilt(12.5)).toBe(12.5);
  });

  it('opens on the pole side at 35° (FR-STAR-3)', () => {
    expect(STARS_DEFAULT_TILT).toBe(35);
    expect(STARS_DEFAULT_FACING).toEqual({ north: 0, south: 180 });
    expect(defaultFacingDeg(-38.93)).toBe(180);
    expect(defaultFacingDeg(48.85)).toBe(0);
    expect(defaultFacingDeg(0)).toBe(0);
    expect(initialHand(-38.93)).toEqual({ azDeg: 180, altDeg: 35, fovDeg: WINDOW_FOV });
  });

  /** R125 (FR-SKY-14, D-798): the zoom — the field on the state, scaled by a factor inside the range, and the reset. */
  it('zooms the field by a factor inside [20°, 90°] about the centre, keeps it through every other move, and `0` restores it', () => {
    expect(WINDOW_FOV_MIN_DEG).toBe(20);
    expect(WINDOW_FOV_MAX_DEG).toBe(90);
    expect(ZOOM_WHEEL_RATE).toBe(0.002);
    expect(ZOOM_KEY_FACTOR).toBe(1.25);
    expect(clampWindowFov(10)).toBe(20);
    expect(clampWindowFov(95)).toBe(90);
    expect(clampWindowFov(45.5)).toBe(45.5);
    // `+` narrows by the key factor; three of them from 60° is 30.72°, which the readout rounds to 30°.
    const once = zoomBy(hand, 1 / ZOOM_KEY_FACTOR);
    expect(once).toEqual({ azDeg: 180, altDeg: 35, fovDeg: 48 });
    const thrice = zoomBy(zoomBy(once, 1 / ZOOM_KEY_FACTOR), 1 / ZOOM_KEY_FACTOR);
    expect(thrice.fovDeg).toBeCloseTo(30.72, 6);
    expect(Math.round(thrice.fovDeg / 5) * 5).toBe(30);
    // `-` widens; the range holds at both ends, and a step at an end changes nothing.
    expect(zoomBy(hand, ZOOM_KEY_FACTOR).fovDeg).toBe(75);
    expect(zoomBy(hand, ZOOM_KEY_FACTOR * ZOOM_KEY_FACTOR).fovDeg).toBe(WINDOW_FOV_MAX_DEG);
    expect(zoomBy(hand, 0.1).fovDeg).toBe(WINDOW_FOV_MIN_DEG);
    const atMin = { ...hand, fovDeg: WINDOW_FOV_MIN_DEG };
    expect(zoomBy(atMin, 0.5)).toEqual(atMin);
    // One mouse notch of ctrl + wheel, about 100 px down, widens by about a fifth: exp(0.2).
    expect(zoomBy(hand, Math.exp(100 * ZOOM_WHEEL_RATE)).fovDeg).toBeCloseTo(73.28, 2);
    expect(zoomBy(hand, Math.exp(-100 * ZOOM_WHEEL_RATE)).fovDeg).toBeCloseTo(49.12, 2);
    // A factor that is not a positive number is no zoom at all.
    expect(zoomBy(hand, 0)).toBe(hand);
    expect(zoomBy(hand, -2)).toBe(hand);
    expect(zoomBy(hand, Number.NaN)).toBe(hand);
    expect(zoomBy(hand, Number.POSITIVE_INFINITY)).toBe(hand);
    // The aim is untouched by a zoom, and the zoom is untouched by every aim: picking a point keeps it (FR-SKY-14).
    const narrow = zoomBy(hand, 0.5);
    expect(narrow.fovDeg).toBe(30);
    expect(dragTo(narrow, 40, 20)).toEqual({ azDeg: 170, altDeg: 40, fovDeg: 30 });
    expect(stepYaw(narrow, 1).fovDeg).toBe(30);
    expect(stepPitch(narrow, -1).fovDeg).toBe(30);
    expect(face(narrow, 'NE')).toEqual({ azDeg: 45, altDeg: 35, fovDeg: 30 });
    expect(up(narrow)).toEqual({ azDeg: 180, altDeg: 90, fovDeg: 30 });
    expect(facePeak({ azDeg: 203, elDeg: 61 }, narrow.fovDeg)).toEqual({ azDeg: 203, altDeg: 53.5, fovDeg: 30 });
    // `0`: back to the default field, the aim where it was.
    expect(resetZoom(narrow)).toEqual({ azDeg: 180, altDeg: 35, fovDeg: WINDOW_FOV });
    expect(resetZoom(hand)).toEqual(hand);
  });

  it('drags at 4 px per degree with the sky following the finger', () => {
    // 40 px to the right pulls the sky right: the view turns 10° left. 20 px down: the view looks 5° higher.
    expect(dragTo(hand, 40, 20)).toEqual({ azDeg: 170, altDeg: 40, fovDeg: WINDOW_FOV });
    expect(dragTo(hand, -40, -20)).toEqual({ azDeg: 190, altDeg: 30, fovDeg: WINDOW_FOV });
    // The azimuth wraps; the altitude clamps.
    expect(dragTo({ azDeg: 5, altDeg: 85, fovDeg: WINDOW_FOV }, 40, 400)).toEqual({ azDeg: 355, altDeg: 90, fovDeg: WINDOW_FOV });
    expect(dragTo({ azDeg: 350, altDeg: -5, fovDeg: WINDOW_FOV }, -80, -400)).toEqual({ azDeg: 10, altDeg: -10, fovDeg: WINDOW_FOV });
  });

  it('steps 15° in yaw and 5° in pitch, inside the clamp', () => {
    expect(stepYaw(hand, 1)).toEqual({ azDeg: 195, altDeg: 35, fovDeg: WINDOW_FOV });
    expect(stepYaw(hand, -1)).toEqual({ azDeg: 165, altDeg: 35, fovDeg: WINDOW_FOV });
    expect(stepYaw({ azDeg: 355, altDeg: 35, fovDeg: WINDOW_FOV }, 1)).toEqual({ azDeg: 10, altDeg: 35, fovDeg: WINDOW_FOV });
    expect(stepPitch(hand, 1)).toEqual({ azDeg: 180, altDeg: 40, fovDeg: WINDOW_FOV });
    expect(stepPitch(hand, -1)).toEqual({ azDeg: 180, altDeg: 30, fovDeg: WINDOW_FOV });
    expect(stepPitch({ azDeg: 180, altDeg: 88, fovDeg: WINDOW_FOV }, 1)).toEqual({ azDeg: 180, altDeg: 90, fovDeg: WINDOW_FOV });
    expect(stepPitch({ azDeg: 180, altDeg: -8, fovDeg: WINDOW_FOV }, -1)).toEqual({ azDeg: 180, altDeg: -10, fovDeg: WINDOW_FOV });
  });

  it('faces a compass point at the current tilt, and `up` is the zenith', () => {
    expect(bearingOf('N')).toBe(0);
    expect(bearingOf('E')).toBe(90);
    expect(bearingOf('SW')).toBe(225);
    expect(bearingOf('NNW')).toBe(337.5);
    expect(face(hand, 'NE')).toEqual({ azDeg: 45, altDeg: 35, fovDeg: WINDOW_FOV });
    expect(face({ azDeg: 10, altDeg: -10, fovDeg: WINDOW_FOV }, 'W')).toEqual({ azDeg: 270, altDeg: -10, fovDeg: WINDOW_FOV });
    expect(up(hand)).toEqual({ azDeg: 180, altDeg: 90, fovDeg: WINDOW_FOV });
  });

  /** R121 (FR-SKY-7, D-790): the pass detail's window opens on the peak, and its picker's `peak` goes back there. */
  it('faces a peak at its azimuth, 15° below the centre of the field, inside [20°, 75°]', () => {
    expect(PEAK_BELOW_CENTRE_DEG).toBe(15);
    expect(PEAK_TILT_MIN_DEG).toBe(20);
    expect(PEAK_TILT_MAX_DEG).toBe(75);
    // The glare pass of `sky-window.spec.ts`: a 61° peak in the south-southwest is faced at 46°.
    expect(facePeak({ azDeg: 203, elDeg: 61 }, WINDOW_FOV)).toEqual({ azDeg: 203, altDeg: 46, fovDeg: WINDOW_FOV });
    // A low pass: the floor, so the horizon stays in the lower part of the field. A pass overhead: the ceiling, never the zenith.
    expect(facePeak({ azDeg: 90, elDeg: 12 }, WINDOW_FOV)).toEqual({ azDeg: 90, altDeg: 20, fovDeg: WINDOW_FOV });
    expect(facePeak({ azDeg: 350, elDeg: 88 }, WINDOW_FOV)).toEqual({ azDeg: 350, altDeg: 73, fovDeg: WINDOW_FOV });
    expect(facePeak({ azDeg: 350, elDeg: 90 }, WINDOW_FOV)).toEqual({ azDeg: 350, altDeg: 75, fovDeg: WINDOW_FOV });
    // The azimuth is normalised like every other move's.
    expect(facePeak({ azDeg: -10, elDeg: 40 }, WINDOW_FOV).azDeg).toBe(350);
    // Why 15 and not `peakAlt / 2` (FR-SKY-7): at 60° across a square box the half-field is 30°, so an 80° peak faced at
    // 65° stands 15° above the centre — in view — where `peakAlt / 2` would have left it 40° up and out of it.
    const half = verticalHalfFieldDeg({ fovDeg: WINDOW_FOV, width: 390, height: 390, screenAngleDeg: 0 });
    for (const elDeg of [10, 25, 40, 61, 80, 90]) {
      const faced = facePeak({ azDeg: 0, elDeg }, WINDOW_FOV);
      expect(elDeg - faced.altDeg).toBeGreaterThanOrEqual(-half);
      expect(elDeg - faced.altDeg).toBeLessThanOrEqual(half);
    }
    // A narrower field (D-798) keeps the peak a quarter of the field below the centre, never 15° in a 20° field.
    expect(facePeak({ azDeg: 180, elDeg: 50 }, 20)).toEqual({ azDeg: 180, altDeg: 45, fovDeg: 20 });
  });

  it('lists the picker’s options, and names the pressed one from the hand', () => {
    expect(FACING_POINTS).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
    expect(FACING_OPTIONS).toEqual([...FACING_POINTS, 'up']);
    expect(PEAK_FACING_OPTIONS).toEqual(['peak', ...FACING_POINTS, 'up']);
    const st = (azDeg: number, altDeg: number, fovDeg = WINDOW_FOV) => ({ azDeg, altDeg, fovDeg });
    expect(facingOf(st(180, 35))).toBe('S');
    expect(facingOf(st(315, -10))).toBe('NW');
    expect(facingOf(st(181, 35))).toBe('');
    // The zenith is `up` whatever the azimuth; the peak is pressed only where `facePeak` put the hand.
    expect(facingOf(st(180, 90))).toBe('up');
    const peak = { azDeg: 203, elDeg: 61 };
    expect(facingOf(st(203, 46), peak)).toBe('peak');
    expect(facingOf(st(203, 45), peak)).toBe('');
    expect(facingOf(st(180, 46), peak)).toBe('S');
    expect(facingOf(st(203, 90), peak)).toBe('up');
    // A narrowed field (D-798) is the state's own: the peak pressed is where `facePeak` puts it for that field.
    expect(facingOf(st(203, 56, 20), peak)).toBe('peak');
    expect(facingOf(st(203, 46, 20), peak)).toBe('');
    // …or passed through, where a caller reckons at another field.
    expect(facingOf(st(203, 56), peak, 20)).toBe('peak');
    // Without a peak to compare against, the hand where a peak would be is no option at all.
    expect(facingOf(st(203, 46))).toBe('');
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
    expect(camera.get()).toEqual({ azDeg: 350, altDeg: 90, fovDeg: WINDOW_FOV });
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
    expect(camera.get()).toEqual({ azDeg: 350, altDeg: 80, fovDeg: WINDOW_FOV });
    camera.dragTo(40, 0);
    camera.stepYaw(1);
    camera.face('S');
    expect(listener).toHaveBeenCalledTimes(4);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 80, fovDeg: WINDOW_FOV });
    camera.up();
    expect(listener).toHaveBeenCalledTimes(5);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 90, fovDeg: WINDOW_FOV });
    // R121: the sixth move, the pass detail's `peak`, at the window's field; the same aim twice notifies once.
    camera.facePeak({ azDeg: 203, elDeg: 61 });
    camera.facePeak({ azDeg: 203, elDeg: 61 });
    expect(listener).toHaveBeenCalledTimes(6);
    expect(camera.get()).toEqual({ azDeg: 203, altDeg: 46, fovDeg: WINDOW_FOV });
    // A narrowed field (D-798) holds the peak a quarter of it below the centre, so it stays in view; the field given is kept.
    camera.facePeak({ azDeg: 203, elDeg: 61 }, 20);
    expect(listener).toHaveBeenCalledTimes(7);
    expect(camera.get()).toEqual({ azDeg: 203, altDeg: 56, fovDeg: 20 });
    expect(facingOf(camera.get(), { azDeg: 203, elDeg: 61 })).toBe('peak');
    camera.face('S');
    expect(listener).toHaveBeenCalledTimes(8);
    stop();
    camera.stepYaw(-1);
    expect(listener).toHaveBeenCalledTimes(8);
    expect(camera.get()).toEqual({ azDeg: 165, altDeg: 56, fovDeg: 20 });
  });

  /** R125 (FR-SKY-14): the two zoom moves on the store, and a `facePeak` with no field reckoned at the camera's own. */
  it('zooms as a store: one notice per change, none at the range’s end, and `facePeak` reckons at the current field', () => {
    const camera = createHandCamera({ azDeg: 180, altDeg: 35 });
    expect(camera.get().fovDeg).toBe(WINDOW_FOV);
    const listener = vi.fn();
    camera.subscribe(listener);
    camera.zoomBy(1 / ZOOM_KEY_FACTOR);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(camera.get()).toEqual({ azDeg: 180, altDeg: 35, fovDeg: 48 });
    // The aim's moves keep the zoom.
    camera.stepYaw(1);
    camera.up();
    expect(camera.get()).toEqual({ azDeg: 195, altDeg: 90, fovDeg: 48 });
    // To the end, then a further step is no change and no notice.
    camera.zoomBy(0.01);
    expect(camera.get().fovDeg).toBe(WINDOW_FOV_MIN_DEG);
    expect(listener).toHaveBeenCalledTimes(4);
    camera.zoomBy(0.5);
    expect(listener).toHaveBeenCalledTimes(4);
    // `facePeak` with no field: the camera's own 20°, so the peak stands 5° below the centre and stays in view (FR-SKY-7).
    camera.facePeak({ azDeg: 203, elDeg: 61 });
    expect(camera.get()).toEqual({ azDeg: 203, altDeg: 56, fovDeg: 20 });
    expect(facingOf(camera.get(), { azDeg: 203, elDeg: 61 })).toBe('peak');
    // The reset: once, and the same reset again is nothing.
    camera.resetZoom();
    expect(camera.get()).toEqual({ azDeg: 203, altDeg: 56, fovDeg: WINDOW_FOV });
    expect(listener).toHaveBeenCalledTimes(6);
    camera.resetZoom();
    expect(listener).toHaveBeenCalledTimes(6);
    // An opening field is held to the range too, and a camera made at a field keeps it.
    expect(createHandCamera({ azDeg: 0, altDeg: 20, fovDeg: 200 }).get().fovDeg).toBe(WINDOW_FOV_MAX_DEG);
    expect(createHandCamera({ azDeg: 0, altDeg: 20, fovDeg: 30 }).get()).toEqual({ azDeg: 0, altDeg: 20, fovDeg: 30 });
  });

  it('the sensor camera carries nothing but its source', () => {
    expect(SENSOR_CAMERA).toEqual({ source: 'sensor' });
  });
});
