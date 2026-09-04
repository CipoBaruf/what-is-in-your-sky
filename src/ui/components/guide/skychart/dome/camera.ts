import { compassPoint, normalizeAzimuthDeg, type CompassPoint } from '../../../../../lib/compass';
import { degrees } from '../../../../../lib/format';
import type { Pass } from '../../../../../model';

/**
 * PLAN §8.3/§8.4 (R15): the dome's camera as two numbers the user controls,
 * the azimuth they face and the tilt, and the mapping to glyphcss's
 * turntable (D-58: `rotY = (360 − facing) mod 360`, `rotX` = tilt from
 * top-down 0° to horizontal 90°). Pure. D-17: the initial view faces the
 * pass's rise azimuth at a tilt that shows both the horizon and the peak;
 * the tilt is clamped so the user can neither go under the horizon nor to a
 * pure top-down view (which is the polar chart's job).
 */
export interface CameraState {
  /** The azimuth the viewer faces, degrees clockwise from north, in [0, 360). */
  facingAzDeg: number;
  /** Tilt from top-down (0°) toward horizontal (90°), inside [PITCH_MIN_DEG, PITCH_MAX_DEG]. */
  tiltDeg: number;
}

/**
 * D-92 (from the R16 spike): 45°. Below 35° the bowl flattens into the polar
 * chart's disc and buries the horizon labels; above 55° the zenith leaves the
 * top of the drawing.
 */
export const DEFAULT_TILT_DEG = 45;
export const PITCH_MIN_DEG = 5;
export const PITCH_MAX_DEG = 80;
/** Keyboard steps (FR-GUIDE-2, PLAN §8.3). */
export const YAW_STEP_DEG = 15;
export const PITCH_STEP_DEG = 5;
/** Drag sensitivity, the same as glyphcss's orbit controls: 4 px per degree. */
export const DRAG_PX_PER_DEG = 4;
/**
 * Orthographic zoom in CSS px per world unit at the reference 390 px box: the
 * unit dome spans ≈ 72 % of the width, leaving the labels their margin. It
 * scales with the *box* and not with the cell (D-91): glyphcss measures zoom
 * against the cell it probes at mount, so two stacked layers of different
 * coarseness must take the same number or the coarser one is drawn twice the
 * size.
 */
export const ZOOM_AT_60_COLS = 140;
export const REFERENCE_WIDTH_PX = 390;

export function clampTilt(tiltDeg: number): number {
  return Math.min(PITCH_MAX_DEG, Math.max(PITCH_MIN_DEG, tiltDeg));
}

/** The initial camera for a pass: facing its rise azimuth (D-17) at the default tilt. */
export function initialFor(pass: Pass | undefined, facingAzDeg?: number): CameraState {
  const facing = facingAzDeg ?? pass?.start.azDeg ?? 0;
  return { facingAzDeg: normalizeAzimuthDeg(facing), tiltDeg: DEFAULT_TILT_DEG };
}

/** glyphcss `rotY` for a facing azimuth (PLAN §8.2). */
export function toRotY(facingAzDeg: number): number {
  return normalizeAzimuthDeg(360 - facingAzDeg);
}

/** The facing azimuth for a glyphcss `rotY` (the inverse of `toRotY`). */
export function facingFromRotY(rotYDeg: number): number {
  return normalizeAzimuthDeg(360 - rotYDeg);
}

export function turn(state: CameraState, byDeg: number): CameraState {
  return { ...state, facingAzDeg: normalizeAzimuthDeg(state.facingAzDeg + byDeg) };
}

export function tilt(state: CameraState, byDeg: number): CameraState {
  return { ...state, tiltDeg: clampTilt(state.tiltDeg + byDeg) };
}

/**
 * A drag by (dx, dy) CSS pixels: the dome follows the finger, so dragging
 * right turns the view left (the facing azimuth decreases) and dragging
 * down brings the near horizon toward the viewer (the tilt decreases toward
 * top-down).
 */
export function drag(state: CameraState, dxPx: number, dyPx: number): CameraState {
  return tilt(turn(state, -dxPx / DRAG_PX_PER_DEG), -dyPx / DRAG_PX_PER_DEG);
}

/** FR-GUIDE-4: what the readout under the dome says, as parameters; `Messages['chart']['readout']` words it (R17, FR-I18N-2). */
export function readoutParams(state: CameraState): { point: CompassPoint; azimuth: string; tilt: string } {
  return { point: compassPoint(state.facingAzDeg), azimuth: degrees(state.facingAzDeg), tilt: degrees(state.tiltDeg) };
}

/**
 * FR-DOME-1 (R21, D-91, amending D-65): the drawing fills its box and the
 * grid follows its size — the cell keeps the 6.5 px it has at 390 px, so the
 * column count grows with the width and a desktop panel gets a finer drawing
 * rather than a scaled-up phone one. The growth is capped at 120 columns: at
 * 1280 px the literal rule is 197 columns and measures 18.8 rasterisations/s
 * under the D-62 method against 26.2/s at 120, the cap halves the longest
 * frame under load, and 120 is still twice the phone's detail. The rows
 * follow the box's height at cell aspect 2, so no frame and no letterbox is
 * left over. 60 × 30 at 6.5 × 13 px is the small end and the default without
 * a measurement — the phone's grid is exactly R15's.
 */
export const GRID_COLS = 60;
export const GRID_ROWS = 30;
export const MAX_GRID_COLS = 120;
export const CELL_ASPECT = 2;
export const DEFAULT_CELL_WIDTH_PX = 6.5;
export const MIN_CELL_WIDTH_PX = 4;
export const MAX_CELL_WIDTH_PX = 12;
/** D-92: the base layer is a wash under the lines, at half their columns. */
export const BASE_COLS_RATIO = 0.5;
export const MIN_BASE_COLS = 8;

/**
 * The base layer's shading (D-92, from the R16 spike): the `blocks` ramp
 * reads as a wash where the default ramp scatters dashes and reads as noise,
 * and the two light intensities are the ones the spike's captures were
 * picked from.
 */
export const BASE_GLYPH_PALETTE = 'blocks';
export const AMBIENT_INTENSITY = 0.35;
export const KEY_INTENSITY = 0.85;

/**
 * D-111: FR-DOME-6 puts the real Sun on the chart, and that is R22's task —
 * it owns the prop that carries it. Until then the base layer's key light
 * points along a fixed civil-twilight direction, so the bowl is shaded from
 * one side rather than lit flat, and R22 replaces this with the Sun the
 * worker reports. The altitude is inside the −18°..0° band of FR-DOME-6, so
 * the same number drives a glow once there is a Sun to draw.
 */
export const DEFAULT_SUN = { azDeg: 270, altDeg: -8 } as const;

/** FR-DOME-1: how many columns a host of this width gets, between the phone's 60 and the D-91 cap. */
export function colsFor(hostWidthPx: number | null): number {
  if (hostWidthPx === null || !Number.isFinite(hostWidthPx) || hostWidthPx <= 0) return GRID_COLS;
  return Math.min(MAX_GRID_COLS, Math.max(GRID_COLS, Math.round(hostWidthPx / DEFAULT_CELL_WIDTH_PX)));
}

/** D-92: the base layer's column count for a line layer of `cols`. */
export function baseColsFor(cols: number): number {
  return Math.max(MIN_BASE_COLS, Math.round(cols * BASE_COLS_RATIO));
}
/**
 * Glyph advances as fractions of the font size, measured at mount by
 * `SkyDome` on the glyphs the raster uses: the braille cells usually come
 * from a fallback font whose advance differs from the monospace font's
 * space, so the font size is set from the braille advance and the space is
 * widened with `word-spacing` to match. This is the fallback where nothing
 * can be measured (jsdom).
 */
export interface GlyphAdvance {
  braille: number;
  space: number;
}
export const DEFAULT_ADVANCE: GlyphAdvance = { braille: 0.6, space: 0.6 };

export interface DomeLayout {
  /** FR-DOME-1: the grid this layer is drawn on, from the box it fills. */
  cols: number;
  rows: number;
  cellWidthPx: number;
  cellHeightPx: number;
  /** The font size that makes one cell exactly `cellWidthPx` wide. */
  fontSizePx: number;
  /** Added to every space so a space is as wide as a braille cell. */
  wordSpacingPx: number;
  zoom: number;
}

const usable = (ratio: number, fallback: number): number => (Number.isFinite(ratio) && ratio > 0 ? ratio : fallback);

/** Rendered widths of one full row of braille and one of spaces at a font size, measured in the raster's font. */
export interface RowMetrics {
  brailleRowPx: number;
  spaceRowPx: number;
}
/** The font-size step of the fit search, and its length. */
export const FIT_STEP_PX = 0.1;
const FIT_STEPS = 80;
/** A row may exceed the box by this much (a rounding error, hidden by overflow) before the font steps down. */
const FIT_SLACK_PX = 0.5;

/**
 * The layout that actually fits the host: some platforms (Linux Chromium
 * without subpixel positioning) round every glyph advance to whole pixels,
 * so the font size computed from the advance ratio can render a row wider
 * than the box. Starting from that size, the font shrinks in 0.1 px steps
 * until a measured 60-cell row fits, and the cell, the word spacing and the
 * zoom follow the measured row. Falls back to `layoutFor` when nothing can be
 * measured.
 */
export function fitLayout(hostWidthPx: number | null, hostHeightPx: number | null, advance: GlyphAdvance, measureRows: (fontSizePx: number, cols: number) => RowMetrics, cols = colsFor(hostWidthPx)): DomeLayout {
  const base = layoutFor(hostWidthPx, hostHeightPx, advance, cols);
  if (hostWidthPx === null || !Number.isFinite(hostWidthPx) || hostWidthPx <= 0) return base;
  const minFontPx = MIN_CELL_WIDTH_PX / usable(advance.braille, DEFAULT_ADVANCE.braille);
  let fontSizePx = base.fontSizePx;
  for (let step = 0; step < FIT_STEPS; step++) {
    const rows = measureRows(fontSizePx, cols);
    if (!(rows.brailleRowPx > 0)) return base;
    if (rows.brailleRowPx <= hostWidthPx + FIT_SLACK_PX || fontSizePx <= minFontPx) {
      const cellWidthPx = rows.brailleRowPx / cols;
      const spaceRowPx = rows.spaceRowPx > 0 ? rows.spaceRowPx : rows.brailleRowPx;
      return { ...base, cols, rows: rowsFor(hostHeightPx, cellWidthPx * CELL_ASPECT, cols), cellWidthPx, cellHeightPx: cellWidthPx * CELL_ASPECT, fontSizePx, wordSpacingPx: (rows.brailleRowPx - spaceRowPx) / cols };
    }
    fontSizePx = Math.max(minFontPx, fontSizePx - FIT_STEP_PX);
  }
  return base;
}

/** FR-DOME-1: rows enough to fill the box's height at cell aspect 2; a square box is `cols / 2` rows, the phone's 30. */
function rowsFor(hostHeightPx: number | null, cellHeightPx: number, cols: number): number {
  const square = Math.max(2, Math.round(cols / CELL_ASPECT));
  if (hostHeightPx === null || !Number.isFinite(hostHeightPx) || hostHeightPx <= 0 || cellHeightPx <= 0) return square;
  return Math.max(2, Math.round(hostHeightPx / cellHeightPx));
}

/**
 * The grid and the cell for a box of this size. `zoom` is CSS pixels per
 * world unit against the box, not the cell (D-91), so both layers of the
 * stacked dome take the same value however coarse each one is.
 */
export function layoutFor(hostWidthPx: number | null, hostHeightPx: number | null = null, advance: GlyphAdvance = DEFAULT_ADVANCE, cols = colsFor(hostWidthPx)): DomeLayout {
  const measured = hostWidthPx !== null && Number.isFinite(hostWidthPx) && hostWidthPx > 0;
  const cellWidthPx = measured ? Math.min(MAX_CELL_WIDTH_PX, Math.max(MIN_CELL_WIDTH_PX, hostWidthPx / cols)) : DEFAULT_CELL_WIDTH_PX;
  const braille = usable(advance.braille, DEFAULT_ADVANCE.braille);
  const space = usable(advance.space, braille);
  const fontSizePx = cellWidthPx / braille;
  const width = measured ? hostWidthPx : REFERENCE_WIDTH_PX;
  return {
    cols,
    rows: rowsFor(hostHeightPx, cellWidthPx * CELL_ASPECT, cols),
    cellWidthPx,
    cellHeightPx: cellWidthPx * CELL_ASPECT,
    fontSizePx,
    wordSpacingPx: cellWidthPx - space * fontSizePx,
    zoom: (ZOOM_AT_60_COLS * width) / REFERENCE_WIDTH_PX,
  };
}

/** The base layer's layout (D-92): the same box and the same zoom, half the columns, in the page's monospace font. */
export function baseLayoutFor(line: DomeLayout, hostWidthPx: number | null, hostHeightPx: number | null, monoAdvance: number): DomeLayout {
  const cols = baseColsFor(line.cols);
  const width = hostWidthPx !== null && Number.isFinite(hostWidthPx) && hostWidthPx > 0 ? hostWidthPx : line.cellWidthPx * line.cols;
  const cellWidthPx = width / cols;
  const advance = usable(monoAdvance, DEFAULT_ADVANCE.braille);
  return {
    cols,
    rows: rowsFor(hostHeightPx, cellWidthPx * CELL_ASPECT, cols),
    cellWidthPx,
    cellHeightPx: cellWidthPx * CELL_ASPECT,
    fontSizePx: cellWidthPx / advance,
    wordSpacingPx: 0,
    zoom: line.zoom,
  };
}
