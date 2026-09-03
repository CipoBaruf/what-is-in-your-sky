import { compassPoint, normalizeAzimuthDeg } from '../../../../../lib/compass';
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
/** Orthographic zoom in CSS px per world unit for a 60-column grid of 6.5 px cells: the unit dome spans ≈ 43 of the 60 columns, leaving room for the labels. */
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

/** FR-GUIDE-4: the facing readout, e.g. `Facing SSW (203°) · tilt 25°`. */
export function readout(state: CameraState): string {
  return `Facing ${compassPoint(state.facingAzDeg)} (${String(Math.round(state.facingAzDeg))}°) · tilt ${String(Math.round(state.tiltDeg))}°`;
}

/** Grid size for a host width in CSS px: 60 columns at 390 px (D-59), finer on wider hosts, at most 100 × 50 (the sizes the spike measured). */
export const CELL_WIDTH_PX = 6.5;
export const CELL_HEIGHT_PX = 13;
export const MIN_COLS = 60;
export const MAX_COLS = 100;

export interface Grid {
  cols: number;
  rows: number;
  zoom: number;
}

export function gridFor(hostWidthPx: number | null): Grid {
  const raw = hostWidthPx === null || !Number.isFinite(hostWidthPx) || hostWidthPx <= 0 ? MIN_COLS : Math.floor(hostWidthPx / CELL_WIDTH_PX);
  const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, raw - (raw % 2)));
  return { cols, rows: cols / 2, zoom: (ZOOM_AT_60_COLS * cols) / MIN_COLS };
}
