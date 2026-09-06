/**
 * PLAN §9.1 (R15): `camera.initialFor` yields yaw = rise azimuth and a pitch
 * inside the clamp; the turntable mapping round-trips; drag and keys move
 * the camera in the documented directions and the tilt never leaves
 * [5°, 80°].
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { en } from '../../../../../i18n/en';
import { es } from '../../../../../i18n/es';
import {
  baseColsFor,
  baseLayoutFor,
  clampTilt,
  colsFor,
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
  MAX_GRID_COLS,
  MIN_BASE_COLS,
  MIN_CELL_WIDTH_PX,
  MAX_EXTENT_RATIO,
  MIN_EXTENT_RATIO,
  drawingExtent,
  PITCH_MAX_DEG,
  PITCH_MIN_DEG,
  PITCH_STEP_DEG,
  readoutParams,
  sameLayout,
  tilt,
  toRotY,
  turn,
  YAW_STEP_DEG,
  zoomFor,
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

describe('readoutParams (FR-GUIDE-4)', () => {
  it('names the 16-point compass direction, the azimuth and the tilt, which the catalogs word (R17)', () => {
    expect(readoutParams({ facingAzDeg: 202.5, tiltDeg: 25 })).toEqual({ point: 'SSW', azimuth: '203°', tilt: '25°' });
    expect(en.chart.readout(readoutParams({ facingAzDeg: 202.5, tiltDeg: 25 }))).toBe('Facing SSW (203°) · tilt 25°');
    expect(en.chart.readout(readoutParams(initialFor(pass)))).toBe('Facing NE (46°) · tilt 45°'); // D-92: the default tilt is 45°
    expect(en.chart.readout(readoutParams({ facingAzDeg: 359.6, tiltDeg: 80 }))).toBe('Facing N (360°) · tilt 80°');
    expect(es.chart.readout(readoutParams(initialFor(pass)))).toBe('Hacia NE (46°) · inclinación 45°');
  });
});

describe('fitLayout', () => {
  const exact = (fontSizePx: number, cols: number) => ({ brailleRowPx: cols * 0.6 * fontSizePx, spaceRowPx: cols * 0.6 * fontSizePx });
  /** Linux Chromium: every advance rounded to whole pixels. */
  const rounded = (fontSizePx: number, cols: number) => ({ brailleRowPx: cols * Math.round(0.6 * fontSizePx), spaceRowPx: cols * Math.round(0.6 * fontSizePx) });

  it('keeps the computed size where the row renders at its exact width, and follows the measured row otherwise', () => {
    const fitted = fitLayout(349.45, 349.45, DEFAULT_ADVANCE, exact);
    expect(fitted.fontSizePx).toBeCloseTo(349.45 / 60 / 0.6, 9);
    expect(fitted.cellWidthPx * 60).toBeLessThanOrEqual(349.45 + 0.5);
    expect(fitted.wordSpacingPx).toBeCloseTo(0, 9);
    const onLinux = fitLayout(349.45, 349.45, DEFAULT_ADVANCE, rounded);
    expect(onLinux.cellWidthPx).toBe(5); // 6 px cells would be 360 px, over the box; 5 px cells fit
    expect(onLinux.cellHeightPx).toBe(10);
    expect(onLinux.fontSizePx).toBeLessThan(9.17);
    expect(onLinux.zoom).toBeCloseTo(zoomFor(349.45, 349.45), 9);
    expect(fitLayout(390, 390, DEFAULT_ADVANCE, exact)).toEqual(layoutFor(390, 390));
  });

  it('widens the space to the braille cell when the two rows differ, and falls back without a measurement', () => {
    const fitted = fitLayout(390, 390, DEFAULT_ADVANCE, (fs, cols) => ({ brailleRowPx: cols * 0.6 * fs, spaceRowPx: cols * 0.55 * fs }));
    expect(fitted.wordSpacingPx).toBeCloseTo(0.05 * fitted.fontSizePx, 9);
    expect(fitLayout(390, 390, DEFAULT_ADVANCE, () => ({ brailleRowPx: 0, spaceRowPx: 0 }))).toEqual(layoutFor(390, 390));
    expect(fitLayout(null, null, DEFAULT_ADVANCE, exact)).toEqual(layoutFor(null, null));
    // A row that never fits stops at the smallest cell rather than looping forever.
    expect(fitLayout(100, 100, DEFAULT_ADVANCE, () => ({ brailleRowPx: 1000, spaceRowPx: 1000 })).fontSizePx).toBeCloseTo(4 / 0.6, 6);
  });

  it('fits the wider grid of a wider box (FR-DOME-1)', () => {
    const desktop = fitLayout(1280, 1280, DEFAULT_ADVANCE, exact);
    expect(desktop.cols).toBe(MAX_GRID_COLS);
    expect(desktop.cellWidthPx).toBeCloseTo(1280 / MAX_GRID_COLS, 9);
  });
});

describe('layoutFor (FR-DOME-1, D-91)', () => {
  it('is the phone’s 60 × 30 grid at 390 px and without a measurement, at a 6.5 × 13 px cell', () => {
    const at390 = { cols: 60, rows: 30, cellWidthPx: DEFAULT_CELL_WIDTH_PX, cellHeightPx: 13, fontSizePx: DEFAULT_CELL_WIDTH_PX / 0.6, wordSpacingPx: 0, zoom: zoomFor(390, 390) };
    expect(layoutFor(390, 390)).toEqual(at390);
    expect(layoutFor(null, null)).toEqual({ ...at390, rows: 30 });
    expect(layoutFor(0, 0)).toEqual({ ...at390, rows: 30 });
    expect(layoutFor(348, 348)).toEqual({ cols: 60, rows: 30, cellWidthPx: 5.8, cellHeightPx: 11.6, fontSizePx: 5.8 / 0.6, wordSpacingPx: 0, zoom: zoomFor(348, 348) });
    expect(layoutFor(100, 100).cellWidthPx).toBe(MIN_CELL_WIDTH_PX);
  });

  it('grows the column count with the width and caps it at 120, keeping the cell near 6.5 px', () => {
    expect(colsFor(null)).toBe(GRID_COLS);
    expect(colsFor(200)).toBe(GRID_COLS); // never coarser than the phone's grid
    expect(colsFor(390)).toBe(60);
    expect(colsFor(650)).toBe(100);
    expect(colsFor(1280)).toBe(MAX_GRID_COLS); // the literal rule would be 197 (D-91)
    expect(colsFor(2560)).toBe(MAX_GRID_COLS);
    const desktop = layoutFor(1280, 1280);
    expect(desktop.cols).toBe(120);
    expect(desktop.rows).toBe(60);
    expect(desktop.cellWidthPx).toBeCloseTo(1280 / 120, 9);
    expect(layoutFor(2000, 2000).cellWidthPx).toBe(MAX_CELL_WIDTH_PX);
  });

  it('fills the box’s height in rows, so nothing is letterboxed (FR-DOME-1)', () => {
    expect(layoutFor(390, 260).rows).toBe(20);
    expect(layoutFor(390, 780).rows).toBe(60);
    expect(layoutFor(390, null).rows).toBe(30);
  });

  it('rounds the row count down, so no row is drawn past the box (R54, F-51)', () => {
    // 991 × 325 (the live box at 1280 × 800): 120 columns, an 8.26 px cell, 16.5 px rows — 19 fit, the 20th would not.
    const live = layoutFor(991, 325);
    expect(live.rows).toBe(Math.floor(325 / live.cellHeightPx));
    expect(live.rows * live.cellHeightPx).toBeLessThanOrEqual(325);
    // A box that is an exact number of rows keeps them all.
    expect(layoutFor(1280, 1280).rows).toBe(60);
    expect(layoutFor(390, 273).rows).toBe(21);
  });

  it('scales the zoom with the box and not with the cell, so the two layers agree (D-91)', () => {
    expect(layoutFor(390, 390).zoom).toBe(zoomFor(390, 390));
    expect(layoutFor(1280, 1280).zoom).toBeCloseTo(zoomFor(1280, 1280), 9);
    // R32 (D-161): a box wider than tall zooms to its height, so the top of the dome stays inside it; a taller one to its width.
    expect(layoutFor(1240, 450).zoom).toBeCloseTo(zoomFor(1240, 450), 9);
    expect(layoutFor(352, 600).zoom).toBeCloseTo(zoomFor(352, 600), 9);
    expect(layoutFor(390, null).zoom).toBe(zoomFor(390, 390));
    const line = layoutFor(1280, 1280);
    const base = baseLayoutFor(line, 1280, 1280, 0.6);
    expect(base.zoom).toBe(line.zoom);
    expect(base.cols).toBe(60);
    expect(base.rows).toBe(30);
    expect(base.cols * base.cellWidthPx).toBeCloseTo(line.cols * line.cellWidthPx, 9);
    expect(base.rows * base.cellHeightPx).toBeCloseTo(line.rows * line.cellHeightPx, 9);
    expect(baseColsFor(60)).toBe(30);
    expect(baseColsFor(4)).toBe(MIN_BASE_COLS);
    expect(baseLayoutFor(line, null, null, 0).fontSizePx).toBeGreaterThan(0);
  });

  it('sets the font size from the measured braille cell and widens the space to match', () => {
    const measured = layoutFor(390, 390, { braille: 0.65, space: 0.6 });
    expect(measured.fontSizePx).toBe(10);
    expect(measured.wordSpacingPx).toBeCloseTo(0.5, 9);
    expect(layoutFor(390, 390, { braille: 0, space: 0 })).toEqual(layoutFor(390, 390));
    expect(layoutFor(390, 390, { braille: NaN, space: 0.6 })).toEqual(layoutFor(390, 390));
    expect(layoutFor(390, 390, { braille: 0.65, space: NaN }).wordSpacingPx).toBe(0);
  });
});

/**
 * FR-DOME-1 as amended / D-177, D-187 (R45): the drawing's extent, labels
 * included, is at least 90 % of the box's shorter side. R54 (v1.1.1, D-268,
 * F-51): and at most the whole of it, counting the half-cell snap of every
 * label's hotspot — the live page's boxes at 1280 × 800 (991 × 325) and
 * 1920 × 1080 (1631 × 605) are the two the finding was measured on.
 */
describe('the fit rule (FR-DOME-1, D-187, D-268)', () => {
  it('takes the zoom from the shorter side through the two divisors', () => {
    expect(zoomFor(390, 390)).toBe(390 / 2.4);
    expect(zoomFor(1240, 450)).toBe(450 / 1.7);
    expect(zoomFor(352, 600)).toBe(352 / 2.4);
  });

  it.each([
    [390, 390],
    [1240, 450],
    [1280, 1280],
    [844, 324],
    [991, 325],
    [1631, 605],
    [330, 324],
  ])('covers between 90 %% and 100 %% of the shorter side, labels and cell snap included, at %d × %d, at the default tilt (F-51)', (width, height) => {
    const layout = layoutFor(width, height);
    const extent = drawingExtent(layout.zoom, DEFAULT_TILT_DEG, 0, { widthPx: layout.cellWidthPx, heightPx: layout.cellHeightPx });
    const shorter = Math.min(width, height);
    expect(Math.max(extent.width, extent.height)).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO * shorter);
    // The ceiling is per side: the ring is 1.4× wider than tall at 45°, so in a wide box it is the height that meets the shorter side.
    expect(extent.width).toBeLessThanOrEqual(MAX_EXTENT_RATIO * width);
    expect(extent.height).toBeLessThanOrEqual(MAX_EXTENT_RATIO * height);
    // The raster itself stays inside the box too: no row is drawn past its bottom.
    expect(layout.rows * layout.cellHeightPx).toBeLessThanOrEqual(height + 1e-6);
  });

  it('would have left the box under the old height divisor at the 1280 × 800 live box, which is F-51', () => {
    const layout = layoutFor(991, 325);
    const oldZoom = Math.min(991 / 2.4, 325 / 1.6);
    const extent = drawingExtent(oldZoom, DEFAULT_TILT_DEG, 0, { widthPx: layout.cellWidthPx, heightPx: layout.cellHeightPx });
    expect(extent.height).toBeGreaterThan(325);
    expect(drawingExtent(layout.zoom, DEFAULT_TILT_DEG, 0, { widthPx: layout.cellWidthPx, heightPx: layout.cellHeightPx }).height).toBeLessThanOrEqual(325);
  });

  it('is unchanged where the width binds: the phone and the square guide box', () => {
    expect(layoutFor(390, 390).zoom).toBe(390 / 2.4);
    expect(layoutFor(390, 450).zoom).toBe(390 / 2.4);
  });

  it('is the same whichever way the dome is turned: the compass ring is round', () => {
    const { zoom } = layoutFor(390, 390);
    const a = drawingExtent(zoom, DEFAULT_TILT_DEG, 0);
    const b = drawingExtent(zoom, DEFAULT_TILT_DEG, 137);
    expect(a.width).toBeCloseTo(b.width, 0);
    expect(a.height).toBeCloseTo(b.height, 0);
  });
});

describe('sameLayout (F-35)', () => {
  it('says two identical layouts are the same', () => {
    expect(sameLayout(layoutFor(390, 390), layoutFor(390, 390))).toBe(true);
  });

  it('catches a zoom-only change, which a height-only resize can produce (D-161, F-35) while cols, rows, cell and font hold', () => {
    // A box wider than tall zooms to its height (D-161): two heights close enough to round to the
    // same row count still move `zoom`, since it is a continuous function of the shorter side.
    // Two heights inside the same 21.3 px row (R54 rounds the count down, so both are 15 rows).
    const shorter = layoutFor(1280, 322);
    const taller = layoutFor(1280, 330);
    expect(taller.rows).toBe(shorter.rows);
    expect(taller.cols).toBe(shorter.cols);
    expect(taller.cellWidthPx).toBe(shorter.cellWidthPx);
    expect(taller.fontSizePx).toBe(shorter.fontSizePx);
    expect(taller.zoom).not.toBeCloseTo(shorter.zoom, 2);
    expect(sameLayout(taller, shorter)).toBe(false);
  });

  it('still catches a cols/rows/cell/font change on its own', () => {
    expect(sameLayout(layoutFor(390, 390), layoutFor(1280, 1280))).toBe(false);
  });
});
