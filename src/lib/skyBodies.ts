import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { moonAt } from '../physics/moon';
import { sunAt } from '../physics/sun';
import type { EpochMs, MoonState, Observer, SkyState, VisibilityThresholds } from '../model';

/**
 * FR-DOME-6 / FR-LIVE-5 (R22, D-80): where the Sun and the Moon are at one
 * instant, for the charts to draw. This is **the one file in `src/lib` that
 * imports `src/physics` at runtime** (PLAN §3, D-80): everywhere else the
 * astronomy runs in the worker and arrives with `NowState` and `Pass`, but the
 * two bodies move continuously under a marker that has to keep up with the
 * 10 s tick on the detail sheet and with playback on the live page, and a
 * worker round trip per frame is exactly what FR-DOME-5 and FR-LIVE-5 forbid.
 *
 * Pure and clock-free (D-15): time enters through `t`. `astronomy-engine` is
 * the whole cost of this module, which is why the chart loads it through a
 * dynamic import (`useSkyBodies`) rather than static: nothing the app needs to
 * paint depends on it.
 */

/** Where the Sun is: azimuth from north through east, geometric altitude, both in degrees. */
export interface SunState {
  t: EpochMs;
  azDeg: number;
  altDeg: number;
}

export interface SkyBodies {
  t: EpochMs;
  sun: SunState;
  moon: MoonState;
  /** FR-LIVE-3 (R32): the sky in words at `t`, from the Sun's altitude — day, bright twilight or dark. */
  sky: SkyState;
}

/**
 * R32 (FR-LIVE-3, D-159): the `SkyState` of a Sun altitude, by the same two
 * thresholds the worker's `physics/now.ts` uses (`skyState` there; the test
 * holds the two to the same answer over a sweep). It is restated here rather
 * than imported because `now.ts` is the whole Now pipeline, and this module
 * is the one piece of `src/physics` the page loads outside the worker — its
 * chunk is budgeted at 30 KB (D-148), and satellite.js is not in that budget.
 */
export function skyStateOf(sunAltDeg: number, thresholds: Pick<VisibilityThresholds, 'sunAltMaxDeg' | 'twilightLabelSunAltDeg'> = DEFAULT_THRESHOLDS): SkyState {
  if (sunAltDeg > thresholds.sunAltMaxDeg) return 'day';
  if (sunAltDeg > thresholds.twilightLabelSunAltDeg) return 'bright-twilight';
  return 'dark';
}

/** R33 (FR-LIVE-4): the sky state alone — the Sun without the Moon — for the time stripe's night bands, which sample it a few hundred times over the span. */
export function skyStateAt(t: EpochMs, observer: Observer): SkyState {
  return skyStateOf(sunAt(observer, t).altDeg);
}

/** The Sun and the Moon for `observer` at `t`. One evaluation of each; the caller decides how often. */
export function skyBodiesAt(t: EpochMs, observer: Observer): SkyBodies {
  const sun = sunAt(observer, t);
  return { t, sun: { t, ...sun }, moon: moonAt(t, observer), sky: skyStateOf(sun.altDeg) };
}
