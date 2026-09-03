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
  DEFAULT_ADVANCE,
  DEFAULT_CELL_WIDTH_PX,
  facingFromRotY,
  fitLayout,
  GRID_COLS,
  initialFor,
  layoutFor,
  MAX_CELL_WIDTH_PX,
  MIN_CELL_WIDTH_PX,
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

describe('fitLayout', () => {
  const exact = (fontSizePx: number) => ({ brailleRowPx: GRID_COLS * 0.6 * fontSizePx, spaceRowPx: GRID_COLS * 0.6 * fontSizePx });
  /** Linux Chromium: every advance rounded to whole pixels. */
  const rounded = (fontSizePx: number) => ({ brailleRowPx: GRID_COLS * Math.round(0.6 * fontSizePx), spaceRowPx: GRID_COLS * Math.round(0.6 * fontSizePx) });

  it('keeps the computed size where the row renders at its exact width, and follows the measured row otherwise', () => {
    const fitted = fitLayout(349.45, DEFAULT_ADVANCE, exact);
    expect(fitted.fontSizePx).toBeCloseTo(349.45 / 60 / 0.6, 9);
    expect(fitted.cellWidthPx * 60).toBeLessThanOrEqual(349.45 + 1e-9);
    expect(fitted.wordSpacingPx).toBeCloseTo(0, 9);
    const onLinux = fitLayout(349.45, DEFAULT_ADVANCE, rounded);
    expect(onLinux.cellWidthPx).toBe(5); // 6 px cells would be 360 px, over the box; 5 px cells fit
    expect(onLinux.cellHeightPx).toBe(10);
    expect(onLinux.fontSizePx).toBeLessThan(9.17);
    expect(onLinux.zoom).toBeCloseTo((ZOOM_AT_60_COLS * 5) / 6.5, 9);
    expect(fitLayout(390, DEFAULT_ADVANCE, exact)).toEqual(layoutFor(390));
  });

  it('widens the space to the braille cell when the two rows differ, and falls back without a measurement', () => {
    const fitted = fitLayout(390, DEFAULT_ADVANCE, (fs) => ({ brailleRowPx: 60 * 0.6 * fs, spaceRowPx: 60 * 0.55 * fs }));
    expect(fitted.wordSpacingPx).toBeCloseTo(0.05 * fitted.fontSizePx, 9);
    expect(fitLayout(390, DEFAULT_ADVANCE, () => ({ brailleRowPx: 0, spaceRowPx: 0 }))).toEqual(layoutFor(390));
    expect(fitLayout(null, DEFAULT_ADVANCE, exact)).toEqual(layoutFor(null));
    // A row that never fits stops at the smallest cell rather than looping forever.
    expect(fitLayout(100, DEFAULT_ADVANCE, () => ({ brailleRowPx: 1000, spaceRowPx: 1000 })).fontSizePx).toBeCloseTo(4 / 0.6, 6);
  });
});

describe('layoutFor', () => {
  it('is a 6.5 × 13 px cell at 390 px and without a measurement, scales with the host between 4 and 12 px, zoom in step', () => {
    const at390 = { cellWidthPx: DEFAULT_CELL_WIDTH_PX, cellHeightPx: 13, fontSizePx: DEFAULT_CELL_WIDTH_PX / 0.6, wordSpacingPx: 0, zoom: ZOOM_AT_60_COLS };
    expect(layoutFor(390)).toEqual(at390);
    expect(layoutFor(null)).toEqual(at390);
    expect(layoutFor(0)).toEqual(at390);
    expect(layoutFor(348)).toEqual({ cellWidthPx: 5.8, cellHeightPx: 11.6, fontSizePx: 5.8 / 0.6, wordSpacingPx: 0, zoom: (ZOOM_AT_60_COLS * 5.8) / 6.5 });
    expect(layoutFor(100).cellWidthPx).toBe(MIN_CELL_WIDTH_PX);
    expect(layoutFor(2000).cellWidthPx).toBe(MAX_CELL_WIDTH_PX);
    expect(layoutFor(2000).zoom).toBeCloseTo((ZOOM_AT_60_COLS * 12) / 6.5, 9);
    // The measured advances set the font size from the braille cell and widen the space to match; a bad measurement falls back.
    const measured = layoutFor(390, { braille: 0.65, space: 0.6 });
    expect(measured.fontSizePx).toBe(10);
    expect(measured.wordSpacingPx).toBeCloseTo(0.5, 9);
    expect(layoutFor(390, { braille: 0, space: 0 })).toEqual(at390);
    expect(layoutFor(390, { braille: NaN, space: 0.6 })).toEqual(at390);
    expect(layoutFor(390, { braille: 0.65, space: NaN }).wordSpacingPx).toBe(0);
  });
});
