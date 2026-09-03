/**
 * PLAN §9.1 (R15): `camera.initialFor` yields yaw = rise azimuth and a pitch
 * inside the clamp; the turntable mapping round-trips; drag and keys move
 * the camera in the documented directions and the tilt never leaves
 * [5°, 80°].
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import {
  clampTilt,
  DEFAULT_TILT_DEG,
  drag,
  DRAG_PX_PER_DEG,
  facingFromRotY,
  gridFor,
  initialFor,
  MAX_COLS,
  MIN_COLS,
  PITCH_MAX_DEG,
  PITCH_MIN_DEG,
  PITCH_STEP_DEG,
  readout,
  tilt,
  toRotY,
  turn,
  YAW_STEP_DEG,
  ZOOM_AT_60_COLS,
} from './camera';

const pass = goldenPassFixture();

describe('initialFor', () => {
  it('faces the rise azimuth at the default tilt, inside the clamp (D-17)', () => {
    const state = initialFor(pass);
    expect(state.facingAzDeg).toBeCloseTo(pass.start.azDeg, 9);
    expect(state.tiltDeg).toBe(DEFAULT_TILT_DEG);
    expect(state.tiltDeg).toBeGreaterThanOrEqual(PITCH_MIN_DEG);
    expect(state.tiltDeg).toBeLessThanOrEqual(PITCH_MAX_DEG);
  });

  it('takes an explicit facing over the pass, normalised, and north with neither', () => {
    expect(initialFor(pass, 380).facingAzDeg).toBe(20);
    expect(initialFor(pass, -90).facingAzDeg).toBe(270);
    expect(initialFor(undefined).facingAzDeg).toBe(0);
  });
});

describe('turntable mapping (PLAN §8.2, D-58)', () => {
  it('rotY = (360 − facing) mod 360 and back', () => {
    expect(toRotY(0)).toBe(0);
    expect(toRotY(90)).toBe(270);
    expect(toRotY(270)).toBe(90);
    for (const az of [0, 46.44, 90, 180, 359.9]) expect(facingFromRotY(toRotY(az))).toBeCloseTo(az, 9);
  });
});

describe('moves', () => {
  const start = { facingAzDeg: 10, tiltDeg: 25 };

  it('turn wraps around and keeps the tilt', () => {
    expect(turn(start, -YAW_STEP_DEG)).toEqual({ facingAzDeg: 355, tiltDeg: 25 });
    expect(turn(start, 355)).toEqual({ facingAzDeg: 5, tiltDeg: 25 });
  });

  it('tilt is clamped to [5°, 80°] and keeps the facing', () => {
    expect(tilt(start, PITCH_STEP_DEG)).toEqual({ facingAzDeg: 10, tiltDeg: 30 });
    expect(tilt(start, 100).tiltDeg).toBe(PITCH_MAX_DEG);
    expect(tilt(start, -100).tiltDeg).toBe(PITCH_MIN_DEG);
    expect(clampTilt(NaN)).toBeNaN();
    expect(clampTilt(80.0001)).toBe(80);
  });

  it('drag: right turns the view left, down lowers the tilt, at 4 px per degree', () => {
    expect(drag(start, 4 * DRAG_PX_PER_DEG, 0)).toEqual({ facingAzDeg: 6, tiltDeg: 25 });
    expect(drag(start, 0, 8 * DRAG_PX_PER_DEG)).toEqual({ facingAzDeg: 10, tiltDeg: 17 });
    expect(drag(start, 0, -1000).tiltDeg).toBe(PITCH_MAX_DEG);
  });
});

describe('readout (FR-GUIDE-4)', () => {
  it('names the 16-point compass direction, the azimuth and the tilt', () => {
    expect(readout({ facingAzDeg: 202.5, tiltDeg: 25 })).toBe('Facing SSW (203°) · tilt 25°');
    expect(readout(initialFor(pass))).toBe('Facing NE (46°) · tilt 25°');
    expect(readout({ facingAzDeg: 359.6, tiltDeg: 80 })).toBe('Facing N (360°) · tilt 80°');
  });
});

describe('gridFor', () => {
  it('is 60 × 30 at 390 px and with no measurement, grows with the host to at most 100 × 50, zoom in step', () => {
    expect(gridFor(390)).toEqual({ cols: MIN_COLS, rows: 30, zoom: ZOOM_AT_60_COLS });
    expect(gridFor(null)).toEqual({ cols: MIN_COLS, rows: 30, zoom: ZOOM_AT_60_COLS });
    expect(gridFor(0)).toEqual({ cols: MIN_COLS, rows: 30, zoom: ZOOM_AT_60_COLS });
    expect(gridFor(200).cols).toBe(MIN_COLS);
    expect(gridFor(520)).toEqual({ cols: 80, rows: 40, zoom: (ZOOM_AT_60_COLS * 80) / 60 });
    expect(gridFor(527).cols).toBe(80); // even columns, so rows are whole
    expect(gridFor(2000)).toEqual({ cols: MAX_COLS, rows: 50, zoom: (ZOOM_AT_60_COLS * 100) / 60 });
  });
});
