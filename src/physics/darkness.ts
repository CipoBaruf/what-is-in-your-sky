import type { Observer, TimeWindow, VisibilityThresholds } from '../model';
import { sunAltitudeDeg } from './sun';

/** Sun-altitude sampling step for the darkness check. The sun moves ≤ 0.25°/min, so 10 min resolves twilight to ~2.5°. */
export const DARKNESS_STEP_MS = 10 * 60_000;

/**
 * Whether the observer is in darkness (sun at or below `sunAltMaxDeg`) at any
 * instant of `window`, sampled every DARKNESS_STEP_MS plus the window end
 * (spec §5.6 "no darkness tonight at this latitude"). Pure: time enters only
 * through `window` (D-15).
 */
export function hasDarkness(observer: Observer, window: TimeWindow, thresholds: Pick<VisibilityThresholds, 'sunAltMaxDeg'>): boolean {
  for (let t = window.startMs; t < window.endMs; t += DARKNESS_STEP_MS) {
    if (sunAltitudeDeg(observer, t) <= thresholds.sunAltMaxDeg) return true;
  }
  return sunAltitudeDeg(observer, window.endMs) <= thresholds.sunAltMaxDeg;
}
