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

export const DEFAULT_TILT_DEG = 25;
export const PITCH_MIN_DEG = 5;
export const PITCH_MAX_DEG = 80;
/** Keyboard steps (FR-GUIDE-2, PLAN §8.3). */
export const YAW_STEP_DEG = 15;
export const PITCH_STEP_DEG = 5;
/** Drag sensitivity, the same as glyphcss's orbit controls: 4 px per degree. */
export const DRAG_PX_PER_DEG = 4;
/** Orthographic zoom in CSS px per world unit for 6.5 px cells: the unit dome spans ≈ 43 of the 60 columns, leaving room for the labels; it scales with the cell. */
export const ZOOM_AT_60_COLS = 140;

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
 * The grid is always 60 × 30 (D-59, D-65 as amended in the R15 review): the
 * cell scales with the host so the dome fills the shared square drawing box
 * at any width, and the raster is the same everywhere. 6.5 × 13 px is the
 * cell of a 390 px host and the default without a measurement.
 */
export const GRID_COLS = 60;
export const GRID_ROWS = 30;
export const CELL_ASPECT = 2;
export const DEFAULT_CELL_WIDTH_PX = 6.5;
export const MIN_CELL_WIDTH_PX = 4;
export const MAX_CELL_WIDTH_PX = 12;
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
  cellWidthPx: number;
  cellHeightPx: number;
  /** The font size that makes one braille cell exactly `cellWidthPx` wide. */
  fontSizePx: number;
  /** Added to every space so a space is as wide as a braille cell. */
  wordSpacingPx: number;
  zoom: number;
}

const usable = (ratio: number, fallback: number): number => (Number.isFinite(ratio) && ratio > 0 ? ratio : fallback);

/** Rendered widths of one 60-cell row of braille and one of spaces at a font size, measured in the raster's font. */
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
export function fitLayout(hostWidthPx: number | null, advance: GlyphAdvance, measureRows: (fontSizePx: number) => RowMetrics): DomeLayout {
  const base = layoutFor(hostWidthPx, advance);
  if (hostWidthPx === null || !Number.isFinite(hostWidthPx) || hostWidthPx <= 0) return base;
  const minFontPx = MIN_CELL_WIDTH_PX / usable(advance.braille, DEFAULT_ADVANCE.braille);
  let fontSizePx = base.fontSizePx;
  for (let step = 0; step < FIT_STEPS; step++) {
    const rows = measureRows(fontSizePx);
    if (!(rows.brailleRowPx > 0)) return base;
    if (rows.brailleRowPx <= hostWidthPx + FIT_SLACK_PX || fontSizePx <= minFontPx) {
      const cellWidthPx = rows.brailleRowPx / GRID_COLS;
      const spaceRowPx = rows.spaceRowPx > 0 ? rows.spaceRowPx : rows.brailleRowPx;
      return { cellWidthPx, cellHeightPx: cellWidthPx * CELL_ASPECT, fontSizePx, wordSpacingPx: (rows.brailleRowPx - spaceRowPx) / GRID_COLS, zoom: (ZOOM_AT_60_COLS * cellWidthPx) / DEFAULT_CELL_WIDTH_PX };
    }
    fontSizePx = Math.max(minFontPx, fontSizePx - FIT_STEP_PX);
  }
  return base;
}

export function layoutFor(hostWidthPx: number | null, advance: GlyphAdvance = DEFAULT_ADVANCE): DomeLayout {
  const measured = hostWidthPx !== null && Number.isFinite(hostWidthPx) && hostWidthPx > 0;
  const cellWidthPx = measured ? Math.min(MAX_CELL_WIDTH_PX, Math.max(MIN_CELL_WIDTH_PX, hostWidthPx / GRID_COLS)) : DEFAULT_CELL_WIDTH_PX;
  const braille = usable(advance.braille, DEFAULT_ADVANCE.braille);
  const space = usable(advance.space, braille);
  const fontSizePx = cellWidthPx / braille;
  return { cellWidthPx, cellHeightPx: cellWidthPx * CELL_ASPECT, fontSizePx, wordSpacingPx: cellWidthPx - space * fontSizePx, zoom: (ZOOM_AT_60_COLS * cellWidthPx) / DEFAULT_CELL_WIDTH_PX };
}
