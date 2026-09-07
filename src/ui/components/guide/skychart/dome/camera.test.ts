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
  CELL_ASPECT,
  clampTilt,
  colsFor,
  DEFAULT_TILT_DEG,
  drag,
  DRAG_PX_PER_DEG,
  DEFAULT_ADVANCE,
  DEFAULT_CELL_WIDTH_PX,
  facingFromRotY,
  fitLayout,
  FIT_STEP_PX,
  GRID_COLS,
  initialFor,
  INK_HEIGHT_UNITS,
  INK_MARGIN_CELLS,
  INK_WIDTH_UNITS,
  layoutFor,
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
  fitLayers,
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
    // R57 (D-293): 60 cells of 5 px is a 300 px raster in a 349.45 px box, 14 % of the width lost
    // to the rounding; the settled cell sets the column count, so the raster covers the box again.
    expect(onLinux.cols).toBe(69);
    expect(onLinux.cols * onLinux.cellWidthPx).toBeGreaterThan(MIN_EXTENT_RATIO * 349.45);
    expect(onLinux.cols * onLinux.cellWidthPx).toBeLessThanOrEqual(349.45 + 0.5);
    // …and the drawing is then sized by the box, as it is wherever the raster covers the box (D-290).
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
    // R57 (D-279, F-54): past 1440 px the old code capped the cell at 12 px, leaving the raster
    // narrower than the box; the cell now keeps growing so the raster still covers it.
    expect(layoutFor(2000, 2000).cellWidthPx).toBeCloseTo(2000 / 120, 9);
    expect(layoutFor(2000, 2000).cols * layoutFor(2000, 2000).cellWidthPx).toBeCloseTo(2000, 9);
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
    // R57 (D-290): from the box, and only held to the raster where the raster falls short of it —
    // 434 px of raster in a 450 px box is not short enough to bind, the labels overhanging the last
    // row being what the box's own 1.7 divisor leaves room for.
    const wide = layoutFor(1240, 450);
    expect(wide.zoom).toBeCloseTo(zoomFor(1240, 450), 9);
    expect(INK_HEIGHT_UNITS * wide.zoom).toBeLessThanOrEqual(wide.rows * wide.cellHeightPx);
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

/**
 * F-54 / D-279 (v1.2): R54's ceiling test only pinned 1280 × 800 and
 * 1920 × 1080. Past 1440 CSS px of width `colsFor`'s 120-column cap forced
 * `layoutFor`'s cell against the old `MAX_CELL_WIDTH_PX = 12`, so the raster
 * stayed 1440 px wide (1920 px at 1920 × 1080, where the label margin still
 * absorbed the 80 px shortfall) while `zoomFor` kept sizing the drawing from
 * the box — at 2560 × 1440 the drawing wants 1650 px of raster and only 1440
 * are there, so the east and west columns fall off the grid. The fix (this
 * file's `layoutFor`) makes the raster cover the box at every width, so the
 * ceiling is now checked against the raster's own painted pixels
 * (`cols × cellWidthPx`, `rows × cellHeightPx`), not just the box — the
 * stronger claim FR-DOME-1 v1.2 makes, and the one the old rule fails here at
 * 2560 × 1440 and above while still (barely) holding at the two sizes R54
 * pinned.
 */
describe('the fit rule holds above the R54 pins too (FR-DOME-1 v1.2, D-279, F-54)', () => {
  it.each([
    [1280, 800],
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ])('covers between 90 %% and 100 %% of the shorter side, and never outgrows the raster, at %d × %d', (width, height) => {
    const layout = layoutFor(width, height);
    const extent = drawingExtent(layout.zoom, DEFAULT_TILT_DEG, 0, { widthPx: layout.cellWidthPx, heightPx: layout.cellHeightPx });
    const shorter = Math.min(width, height);
    const rasterWidth = layout.cols * layout.cellWidthPx;
    const rasterHeight = layout.rows * layout.cellHeightPx;
    expect(Math.max(extent.width, extent.height)).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO * shorter);
    // The raster never exceeds its box (F-51's rounded-down rows, and now the uncapped cell).
    expect(rasterWidth).toBeLessThanOrEqual(width + 1e-6);
    expect(rasterHeight).toBeLessThanOrEqual(height + 1e-6);
    // F-54: and the drawing never exceeds the raster it is painted on, box or no box.
    expect(extent.width).toBeLessThanOrEqual(MAX_EXTENT_RATIO * rasterWidth);
    expect(extent.height).toBeLessThanOrEqual(MAX_EXTENT_RATIO * rasterHeight);
  });

  it('would have cut the east and west columns under the old cell cap at 2560 × 1440, which is F-54', () => {
    const oldCellWidthPx = 12; // the retired MAX_CELL_WIDTH_PX
    const oldRasterWidth = MAX_GRID_COLS * oldCellWidthPx; // 1440, whatever the box's width
    const oldZoom = zoomFor(2560, 1440); // the old rule sized the drawing from the box, uncapped
    const extent = drawingExtent(oldZoom, DEFAULT_TILT_DEG, 0, { widthPx: oldCellWidthPx, heightPx: oldCellWidthPx * CELL_ASPECT });
    expect(extent.width).toBeGreaterThan(oldRasterWidth);
    const fixed = layoutFor(2560, 1440);
    const fixedExtent = drawingExtent(fixed.zoom, DEFAULT_TILT_DEG, 0, { widthPx: fixed.cellWidthPx, heightPx: fixed.cellHeightPx });
    expect(fixedExtent.width).toBeLessThanOrEqual(fixed.cols * fixed.cellWidthPx);
  });

  it('re-clamps the zoom to the raster fitLayout actually settles on, not the pre-fit one (F-54)', () => {
    // A measureRows stub that, like Linux Chromium's whole-pixel rounding, forces the font size
    // (and so the cell) to step down at least once before the row fits.
    const steppedDown = (fontSizePx: number, cols: number) => ({ brailleRowPx: cols * Math.floor(0.6 * fontSizePx * 10) / 10, spaceRowPx: cols * Math.floor(0.6 * fontSizePx * 10) / 10 });
    const fitted = fitLayout(2560, 1440, DEFAULT_ADVANCE, steppedDown);
    const rasterWidth = fitted.cols * fitted.cellWidthPx;
    const rasterHeight = fitted.rows * fitted.cellHeightPx;
    // The old rule left `zoom` from the pre-fit `layoutFor` call, sized for the cell the font
    // stepped down from — the fixed zoom must fit the raster fitLayout actually painted.
    expect(INK_WIDTH_UNITS * fitted.zoom).toBeLessThanOrEqual(rasterWidth - 2 * INK_MARGIN_CELLS * fitted.cellWidthPx);
    expect(INK_HEIGHT_UNITS * fitted.zoom).toBeLessThanOrEqual(rasterHeight);
    const extent = drawingExtent(fitted.zoom, DEFAULT_TILT_DEG, 0, { widthPx: fitted.cellWidthPx, heightPx: fitted.cellHeightPx });
    expect(extent.width).toBeLessThanOrEqual(MAX_EXTENT_RATIO * rasterWidth);
    expect(extent.height).toBeLessThanOrEqual(MAX_EXTENT_RATIO * rasterHeight);
  });
});

/**
 * D-291, D-293 (R57, FR-DOME-1 v1.2): the floor on the `fitLayout` path, which
 * is the path CI's Linux takes and this machine does not. Linux Chromium lays
 * glyphs out without subpixel positioning, so every advance rounds to a whole
 * device pixel: the fit loop steps the font down until a row fits, and a cell
 * rounded down from 5.9 px to 5 px is a raster 15 % narrower than its box. In
 * a *square* box the dome is width-bound — `zoomFor` is `min(w / 2.4, h / 1.7)`
 * and 2.4 is the divisor that wins — so the drawing is as wide as the raster
 * lets it be, and the painted extent cannot exceed the raster it is painted on
 * however the zoom is chosen. D-279 clamped the zoom to that short raster and
 * the drawing came out at 0.81 of the shorter side against FR-DOME-1's 0.9;
 * D-293 gives the lost width back as columns instead, and D-290's clamp then
 * has no reason to bind.
 *
 * The pass detail at 1280 × 800 with a device pixel ratio of 2 (which
 * `dome-fit.spec.ts` runs) is a 354.4 px square box, measured on the page.
 */
describe('the floor holds on the fit path too (FR-DOME-1 v1.2, D-291, D-293)', () => {
  /** Linux Chromium: every glyph advance rounded to a whole device pixel — 1 CSS px, or 0.5 at a device pixel ratio of 2. */
  const roundedTo = (devicePx: number) => (fontSizePx: number, cols: number) => {
    const advancePx = Math.round((0.6 * fontSizePx) / devicePx) * devicePx;
    return { brailleRowPx: cols * advancePx, spaceRowPx: cols * advancePx };
  };
  /** A platform with subpixel positioning: the row renders at exactly the width it was asked for. */
  const exact = (fontSizePx: number, cols: number) => ({ brailleRowPx: cols * 0.6 * fontSizePx, spaceRowPx: cols * 0.6 * fontSizePx });

  it.each([
    ['whole CSS pixels', 1],
    ['half a CSS pixel (a device pixel ratio of 2)', 0.5],
  ])('covers at least 90 %% of the square pass-detail box with advances rounded to %s', (_label, devicePx) => {
    const box = 354.4;
    const font = { advance: DEFAULT_ADVANCE, measureRows: roundedTo(devicePx) };
    const { lines, base } = fitLayers(box, box, font, font);
    // The font did step down: this is the path the fit loop takes, not `layoutFor`'s.
    expect(lines.fontSizePx).toBeLessThan(box / GRID_COLS / 0.6);
    const extent = drawingExtent(lines.zoom, DEFAULT_TILT_DEG, 0, { widthPx: lines.cellWidthPx, heightPx: lines.cellHeightPx });
    expect(Math.max(extent.width, extent.height)).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO * box);
    expect(extent.width).toBeLessThanOrEqual(MAX_EXTENT_RATIO * box);
    expect(extent.height).toBeLessThanOrEqual(MAX_EXTENT_RATIO * box);
    // `drawingExtent` counts the labels' own boxes and the cell they snap by, which `dome-fit.spec.ts`
    // only gets where a label happens to be the outermost thing; the ink alone — the ground disc, the
    // widest thing painted into a cell — has to clear the floor too, or the page measures below it.
    expect(INK_WIDTH_UNITS * lines.zoom).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO * box);
    for (const layer of [lines, base]) {
      // The raster covers its box (D-293) and holds the ink with a blank column either side (D-290).
      const rasterWidth = layer.cols * layer.cellWidthPx;
      expect(rasterWidth).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO * box);
      expect(rasterWidth).toBeLessThanOrEqual(box + FIT_STEP_PX);
      expect(INK_WIDTH_UNITS * layer.zoom).toBeLessThanOrEqual(rasterWidth - 2 * INK_MARGIN_CELLS * layer.cellWidthPx);
      expect(INK_HEIGHT_UNITS * layer.zoom).toBeLessThanOrEqual(layer.rows * layer.cellHeightPx);
    }
  });

  it('draws both layers at one zoom, whatever each layer’s own raster settles on (D-91, D-292)', () => {
    // What `SkyDome` builds, and why `fitLayers` builds it rather than the component: each layer
    // floors its own rows and settles its own cell, so their D-290 clamps differ, and glyphcss
    // measures zoom against the cell it probes at mount — the two must draw at one number or the
    // coarser layer is drawn at a different size from the finer one over it. Taken layer by layer
    // at 2271 × 1193 (the live page at 2560 × 1440) the two come out 690.2 and 667.9, 3.2 % apart.
    const boxes: [number, number][] = [
      [2271.02, 1193],
      [354.4, 354.4],
      [991, 325],
      [390, 390],
      [1631, 605],
    ];
    for (const [width, height] of boxes) {
      for (const measureRows of [exact, roundedTo(1), roundedTo(0.5)]) {
        const font = { advance: DEFAULT_ADVANCE, measureRows };
        const { lines, base } = fitLayers(width, height, font, font);
        // The base layer is asked for half the line layer's columns (D-92) and, like the line
        // layer, keeps whatever its own settled cell then leaves room for (D-293).
        expect(base.cols).toBeGreaterThanOrEqual(baseColsFor(lines.cols));
        expect(base.zoom).toBe(lines.zoom);
        // And the shared number is one both rasters can hold (D-279): neither layer's ink runs
        // into the first or last column of its own grid.
        for (const layer of [lines, base]) expect(INK_WIDTH_UNITS * layer.zoom).toBeLessThanOrEqual(layer.cols * layer.cellWidthPx - 2 * INK_MARGIN_CELLS * layer.cellWidthPx);
      }
    }
  });

  it('is the fit path that D-279 alone left short of the floor: 60 cells of 5 px in a 354.4 px box', () => {
    // The measurement behind D-291, held here so the reason the rule needs D-293 does not go
    // unrecorded: with the column count fixed at `colsFor`'s 60, a whole-pixel cell is 5 px, the
    // raster is 300 px of a 354.4 px box, and the drawing — which is painted *on* that raster and
    // so can never be wider than it — reaches 0.85 of the box at best, whatever the zoom.
    const box = 354.4;
    const shortRasterWidth = GRID_COLS * 5;
    expect(shortRasterWidth / box).toBeLessThan(MIN_EXTENT_RATIO);
    // D-293: the same 5 px cell, the columns the box has room for.
    const fitted = fitLayout(box, box, DEFAULT_ADVANCE, roundedTo(1));
    expect(fitted.cellWidthPx).toBe(5);
    expect(fitted.cols).toBeGreaterThan(GRID_COLS);
    expect((fitted.cols * fitted.cellWidthPx) / box).toBeGreaterThanOrEqual(MIN_EXTENT_RATIO);
  });
});

describe('sameLayout (F-35)', () => {
  it('says two identical layouts are the same', () => {
    expect(sameLayout(layoutFor(390, 390), layoutFor(390, 390))).toBe(true);
  });

  it('catches two heights inside the same row bucket, which draw at different zooms (D-290)', () => {
    // The two boxes round to the same 15 rows of 21.3 px, so cols, rows, cell and font all hold
    // and only `zoom` moves. D-279 briefly took the zoom from that shared raster height, which
    // made them the same drawing; D-290 clamps against the raster only where the raster falls
    // short of the box, so a taller box is a larger drawing again and the observer has to notice.
    const shorter = layoutFor(1280, 322);
    const taller = layoutFor(1280, 330);
    expect(taller.rows).toBe(shorter.rows);
    expect(taller.cols).toBe(shorter.cols);
    expect(taller.cellWidthPx).toBe(shorter.cellWidthPx);
    expect(taller.fontSizePx).toBe(shorter.fontSizePx);
    expect(taller.zoom).toBeGreaterThan(shorter.zoom);
    expect(sameLayout(taller, shorter)).toBe(false);
  });

  it('still catches a zoom-only change from a narrow, MIN_CELL_WIDTH_PX-bound resize (F-35)', () => {
    // Below 240 px `colsFor` is already at its floor (60, GRID_COLS) and the cell clamps to
    // MIN_CELL_WIDTH_PX, so the raster (240 px) is wider than the box and `zoomFor` takes the
    // box's own width — the one range left where zoom still varies continuously while cols, rows,
    // cell and font all hold, so a resize inside it still needs `sameLayout` to notice.
    const narrower = layoutFor(150, 1000);
    const wider = layoutFor(200, 1000);
    expect(wider.cols).toBe(narrower.cols);
    expect(wider.rows).toBe(narrower.rows);
    expect(wider.cellWidthPx).toBe(narrower.cellWidthPx);
    expect(wider.fontSizePx).toBe(narrower.fontSizePx);
    expect(wider.zoom).not.toBeCloseTo(narrower.zoom, 2);
    expect(sameLayout(wider, narrower)).toBe(false);
  });

  it('still catches a cols/rows/cell/font change on its own', () => {
    expect(sameLayout(layoutFor(390, 390), layoutFor(1280, 1280))).toBe(false);
  });
});
