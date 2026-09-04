import {
  Body,
  Equator,
  GeoVector,
  Horizon,
  MakeTime,
  Observer as AeObserver,
  RotateVector,
  Rotation_EQJ_EQD,
} from 'astronomy-engine';
import type { EpochMs, Observer } from '../model';
import { unit, type Vec3 } from './frames';
import { msToDate } from './time';

/**
 * Where the sun is for `observer` at `t`: azimuth from north through east and
 * geometric (unrefracted) altitude of its centre, both in degrees. Twilight
 * thresholds (−6°, −12°) are geometric, so refraction is deliberately off
 * (D-2). The azimuth is what FR-DOME-6 draws the glow at (R22); the altitude
 * is what the darkness test has always used.
 */
export function sunAt(observer: Observer, t: EpochMs): { azDeg: number; altDeg: number } {
  const time = MakeTime(msToDate(t));
  const obs = new AeObserver(observer.lat, observer.lon, observer.altM);
  const eq = Equator(Body.Sun, time, obs, true, true);
  const horizon = Horizon(time, obs, eq.ra, eq.dec); // refraction omitted = none
  return { azDeg: horizon.azimuth, altDeg: horizon.altitude };
}

/** Geometric altitude of the sun's centre above the observer's horizon, in degrees. */
export function sunAltitudeDeg(observer: Observer, t: EpochMs): number {
  return sunAt(observer, t).altDeg;
}

/**
 * Unit vector from the Earth's centre toward the sun in the true-equator-of-date
 * frame, which is within arcseconds of the TEME frame satellite.js propagates in (D-2).
 */
export function sunVectorEqd(t: EpochMs): Vec3 {
  const time = MakeTime(msToDate(t));
  const eqj = GeoVector(Body.Sun, time, true);
  const eqd = RotateVector(Rotation_EQJ_EQD(time), eqj);
  return unit({ x: eqd.x, y: eqd.y, z: eqd.z });
}
