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
 * Geometric (unrefracted) altitude of the sun's centre above the observer's
 * horizon, in degrees. Twilight thresholds (−6°, −12°) are geometric, so
 * refraction is deliberately off (D-2).
 */
export function sunAltitudeDeg(observer: Observer, t: EpochMs): number {
  const time = MakeTime(msToDate(t));
  const obs = new AeObserver(observer.lat, observer.lon, observer.altM);
  const eq = Equator(Body.Sun, time, obs, true, true);
  return Horizon(time, obs, eq.ra, eq.dec).altitude; // refraction omitted = none
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
