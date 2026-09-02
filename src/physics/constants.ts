import type { VisibilityThresholds } from '../model';

/**
 * Centralised thresholds (FR-VIS-6). Every default carries its rationale here;
 * nothing else in `src/physics` hard-codes one of these numbers.
 */

/** Minimum elevation for a pass to count. 0° is unusable in practice (buildings, haze, extinction). */
export const MIN_ELEVATION_DEG = 10;

/** Observer counts as "in darkness" when the sun is at or below this altitude (end of civil twilight). */
export const SUN_ALT_MAX_DEG = -6;

/** Passes whose peak has the sun between this and SUN_ALT_MAX_DEG carry the "sky still bright" label (FR-VIS-7). */
export const TWILIGHT_LABEL_SUN_ALT_DEG = -12;

/** Faintest peak magnitude shown by default: roughly what an average suburban sky allows. */
export const MAG_LIMIT = 4.5;

/** Mean Earth radius used by the cylindrical umbra test (D-8). No atmosphere fudge, no penumbra. */
export const EARTH_RADIUS_KM = 6371.0;

/** Coarse scan step. Any LEO pass reaching 10° spends well over 60 s above 0°, so 30 s cannot skip one (PLAN §6.3). */
export const COARSE_STEP_MS = 30_000;

/** Dense sampling step inside a pass; gives the ≤ 1 s boundary precision FR-VIS-2 asks for (D-7). */
export const DENSE_STEP_MS = 1_000;

/** Bisection stops when the bracket around a 10° crossing is this narrow. */
export const BISECTION_TOLERANCE_MS = 500;

/** The sky-chart track keeps every Nth dense sample (10 s at DENSE_STEP_MS = 1 s). */
export const TRACK_EVERY_N_SAMPLES = 10;

export const DEFAULT_THRESHOLDS: Readonly<VisibilityThresholds> = Object.freeze({
  minElevationDeg: MIN_ELEVATION_DEG,
  sunAltMaxDeg: SUN_ALT_MAX_DEG,
  twilightLabelSunAltDeg: TWILIGHT_LABEL_SUN_ALT_DEG,
  magLimit: MAG_LIMIT,
});
