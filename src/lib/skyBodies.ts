import { moonAt } from '../physics/moon';
import { sunAt } from '../physics/sun';
import type { EpochMs, MoonState, Observer } from '../model';

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
}

/** The Sun and the Moon for `observer` at `t`. One evaluation of each; the caller decides how often. */
export function skyBodiesAt(t: EpochMs, observer: Observer): SkyBodies {
  const sun = sunAt(observer, t);
  return { t, sun: { t, ...sun }, moon: moonAt(t, observer) };
}
