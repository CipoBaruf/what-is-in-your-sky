import { Body, EclipticGeoMoon, Equator, Horizon, Illumination, MakeTime, MoonPhase, Observer as AeObserver } from 'astronomy-engine';
import type { EpochMs, MoonGlare, MoonGlareThresholds, MoonPhaseName, MoonState, Observer } from '../model';
import { MOON_PHASE_BAND_HALF_WIDTH_DEG } from './constants';
import { msToDate } from './time';

/**
 * The Moon, from `astronomy-engine` the way `sun.ts` takes the sun (D-80): pure
 * functions of an instant and an observer, run in the worker so `NowState.moon`
 * and `Pass.moonAtPeak` arrive with everything else (FR-MOON-1, FR-MOON-2).
 * Nothing here reads the lore; the tradition text is data (`src/data/moon`).
 */

/** Wrap to [0, 360). */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * FR-MOON-1's bands, from the phase angle (0 = new, 90 = first quarter,
 * 180 = full, 270 = last quarter). The four cardinal names take
 * ±MOON_PHASE_BAND_HALF_WIDTH_DEG around their exact angle and the crescent and
 * gibbous names fill the gaps. Every band is half-open on its low edge, so an
 * angle exactly on a boundary belongs to the band above it and the eight bands
 * partition [0, 360) exactly once.
 */
export function phaseName(phaseAngleDeg: number): MoonPhaseName {
  // Shifting by the half-width puts the start of the "new" band at 0, so each
  // 90° quadrant is one cardinal band followed by one wide one.
  const shifted = normalizeDeg(phaseAngleDeg + MOON_PHASE_BAND_HALF_WIDTH_DEG);
  const cardinal = shifted % 90 < 2 * MOON_PHASE_BAND_HALF_WIDTH_DEG;
  switch (Math.floor(shifted / 90)) {
    case 0:
      return cardinal ? 'new' : 'waxingCrescent';
    case 1:
      return cardinal ? 'firstQuarter' : 'waxingGibbous';
    case 2:
      return cardinal ? 'full' : 'waningGibbous';
    default:
      return cardinal ? 'lastQuarter' : 'waningCrescent';
  }
}

/** The Moon at `t` for `observer` (FR-MOON-1). Pure: time enters only through `t` (D-15). */
export function moonAt(t: EpochMs, observer: Observer): MoonState {
  const time = MakeTime(msToDate(t));
  const obs = new AeObserver(observer.lat, observer.lon, observer.altM);
  // Topocentric equator of date, then horizon without refraction — the same
  // path and the same convention as `sunAltitudeDeg` (D-2). Parallax matters
  // here in a way it never does for the sun: the Moon sits up to 1° off its
  // geocentric direction, which `Equator`'s observer argument accounts for.
  const eq = Equator(Body.Moon, time, obs, true, true);
  const horizon = Horizon(time, obs, eq.ra, eq.dec);
  const phaseAngleDeg = normalizeDeg(MoonPhase(time));
  return {
    t,
    phaseAngleDeg,
    illuminatedFraction: Illumination(Body.Moon, time).phase_fraction,
    phase: phaseName(phaseAngleDeg),
    azDeg: horizon.azimuth,
    elDeg: horizon.altitude,
    eclipticLonDeg: normalizeDeg(EclipticGeoMoon(time).lon),
  };
}

/** Angle between two directions given as azimuth and elevation in the same horizontal frame. */
export function angularSeparationDeg(a: { azDeg: number; elDeg: number }, b: { azDeg: number; elDeg: number }): number {
  const rad = Math.PI / 180;
  const cos = Math.sin(a.elDeg * rad) * Math.sin(b.elDeg * rad) + Math.cos(a.elDeg * rad) * Math.cos(b.elDeg * rad) * Math.cos((a.azDeg - b.azDeg) * rad);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / rad;
}

/**
 * FR-MOON-2: the Moon washes out this pass when all three hold at the peak —
 * it is above the horizon, at least half lit, and closer to the peak than the
 * separation threshold. A Moon below the horizon still gets its separation
 * measured, because the angle between two directions is a fact either way; it
 * simply fails the altitude condition and so raises no glare (D-109).
 */
export function moonGlare(moon: MoonState, peak: { azDeg: number; elDeg: number }, thresholds: MoonGlareThresholds): MoonGlare {
  const separationDeg = angularSeparationDeg(moon, peak);
  const glare = moon.elDeg > thresholds.minAltDeg && moon.illuminatedFraction >= thresholds.minIlluminatedFraction && separationDeg < thresholds.maxSeparationDeg;
  return { glare, separationDeg };
}
