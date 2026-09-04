import type { MoonGlareThresholds, VisibilityThresholds } from '../model';

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

/**
 * The four user-facing thresholds bundled as the object the worker protocol
 * carries (PLAN §6.2). Frozen so nothing mutates the defaults in place; v1's
 * threshold UI (US-9) spreads a copy instead.
 */
export const DEFAULT_THRESHOLDS: Readonly<VisibilityThresholds> = Object.freeze({
  minElevationDeg: MIN_ELEVATION_DEG,
  sunAltMaxDeg: SUN_ALT_MAX_DEG,
  twilightLabelSunAltDeg: TWILIGHT_LABEL_SUN_ALT_DEG,
  magLimit: MAG_LIMIT,
});

/**
 * Half-width of the band each of the four cardinal phase names keeps around its
 * exact phase angle (FR-MOON-1). 7.5° is about 15 h of the Moon's 12.19°/day
 * elongation rate, and over that span the disc looks like the exact phase:
 * 99.6 % lit at 7.5° from full, 0.4 % at 7.5° from new. The crescent and
 * gibbous names fill the 75° between two cardinal bands, so "gibbous" always
 * means more than half lit and "crescent" always less.
 */
export const MOON_PHASE_BAND_HALF_WIDTH_DEG = 7.5;

/** FR-MOON-2: the Moon must be above the true horizon at the peak. Geometric, like every other altitude here (D-2). */
export const MOON_GLARE_MIN_ALT_DEG = 0;

/**
 * FR-MOON-2: …and at least half lit. Below half, the Moon is faint enough and
 * (near new) close enough to the sun that it is rarely the thing spoiling a
 * pass. OQ-12 holds both this and the separation open until field use.
 */
export const MOON_GLARE_MIN_ILLUMINATION = 0.5;

/**
 * FR-MOON-2: …and within 30° of the pass peak. A bright Moon washes out a
 * region far wider than its half-degree disc; 30° is about the radius over
 * which the sky glow costs a naked-eye magnitude, and it is a third of the way
 * from the peak to the horizon, so the warning stays specific to the track.
 */
export const MOON_GLARE_MAX_SEPARATION_DEG = 30;

/** The FR-MOON-2 thresholds as one object. Not user settings and not carried by the protocol; `findPasses` uses these defaults. */
export const DEFAULT_MOON_GLARE_THRESHOLDS: Readonly<MoonGlareThresholds> = Object.freeze({
  minAltDeg: MOON_GLARE_MIN_ALT_DEG,
  minIlluminatedFraction: MOON_GLARE_MIN_ILLUMINATION,
  maxSeparationDeg: MOON_GLARE_MAX_SEPARATION_DEG,
});
