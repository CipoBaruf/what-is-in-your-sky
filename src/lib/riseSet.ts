import { Body, Constellation, Equator, Horizon, Illumination, MakeTime, Observer as AeObserver, RotateVector, Rotation_EQJ_EQD, SearchAltitude, SiderealTime, Vector } from 'astronomy-engine';
import type { EpochMs, Observer } from '../model';
import { msToDate } from '../physics/time';
import type { PLANETS } from './skyStars';

/**
 * FR-FACT-3 (R183, D-1101): rise and set as geometric horizon crossings of the centre (no refraction) on the night
 * that holds `t`, the 24 h from local mean noon by longitude, so an evening set and a dawn rise share a night. The
 * first crossing of each kind in that span; a body may miss one (`null`). Pure: time enters through `t` (D-15).
 */

export type RiseSet = { kind: 'never-sets' } | { kind: 'never-rises' } | { kind: 'crosses'; rise: EpochMs | null; set: EpochMs | null };

export type RiseSetBody = 'Moon' | (typeof PLANETS)[number];

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;
/** The Earth's turn against the stars, degrees per millisecond. */
const SIDEREAL_DEG_PER_MS = 360.98564736629 / DAY_MS;

const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** The night that holds `t`: from the local mean noon at or before it, 24 h on. */
export function nightOf(lon: number, t: EpochMs): { from: EpochMs; to: EpochMs } {
  const noonOffset = DAY_MS / 2 - (lon / 360) * DAY_MS;
  const from = Math.floor((t - noonOffset) / DAY_MS) * DAY_MS + noonOffset;
  return { from, to: from + DAY_MS };
}

/**
 * A catalogue star from its J2000 RA/Dec (degrees, no proper motion), carried to the night's equator so the times
 * agree with the list's altitudes (`starsAt` places stars through the same of-date frame).
 */
export function starRiseSet(raDeg: number, decDeg: number, observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs): RiseSet {
  const { from, to } = nightOf(observer.lon, t);
  const time = MakeTime(msToDate((from + to) / 2));
  const j2000 = new Vector(Math.cos(decDeg * RAD) * Math.cos(raDeg * RAD), Math.cos(decDeg * RAD) * Math.sin(raDeg * RAD), Math.sin(decDeg * RAD), time);
  const v = RotateVector(Rotation_EQJ_EQD(time), j2000);
  const ra = Math.atan2(v.y, v.x) / RAD;
  const dec = Math.atan2(v.z, Math.hypot(v.x, v.y));

  const cosH0 = -Math.tan(observer.lat * RAD) * Math.tan(dec);
  if (cosH0 <= -1) return { kind: 'never-sets' };
  if (cosH0 >= 1) return { kind: 'never-rises' };
  const h0 = Math.acos(cosH0) / RAD;

  const hourAngleAtFrom = SiderealTime(msToDate(from)) * 15 + observer.lon - ra;
  const after = (targetHa: number): EpochMs => from + Math.round(wrap360(targetHa - hourAngleAtFrom) / SIDEREAL_DEG_PER_MS);
  return { kind: 'crosses', rise: after(-h0), set: after(h0) };
}

/** A planet or the Moon, topocentric, through `astronomy-engine`'s altitude search at 0°. */
export function bodyRiseSet(body: RiseSetBody, observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs): RiseSet {
  const { from, to } = nightOf(observer.lon, t);
  const where = new AeObserver(observer.lat, observer.lon, 0);
  const start = MakeTime(msToDate(from));
  const find = (direction: 1 | -1): EpochMs | null => {
    const hit = SearchAltitude(Body[body], where, direction, start, 1, 0);
    const ms = hit?.date.getTime();
    return ms !== undefined && ms < to ? ms : null;
  };
  const rise = find(1);
  const set = find(-1);
  if (rise !== null || set !== null) return { kind: 'crosses', rise, set };
  const time = MakeTime(msToDate(t));
  const eq = Equator(Body[body], time, where, true, true);
  return Horizon(time, where, eq.ra, eq.dec).altitude > 0 ? { kind: 'never-sets' } : { kind: 'never-rises' };
}

/** FR-FACT-3 (R188): one catalogue star's place at `t` — its J2000 RA/Dec carried to the equator of date, no refraction, as `starsAt` places every star. */
export function starAltAz(raDeg: number, decDeg: number, observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs): { altDeg: number; azDeg: number } {
  const time = MakeTime(msToDate(t));
  const j2000 = new Vector(Math.cos(decDeg * RAD) * Math.cos(raDeg * RAD), Math.cos(decDeg * RAD) * Math.sin(raDeg * RAD), Math.sin(decDeg * RAD), time);
  const v = RotateVector(Rotation_EQJ_EQD(time), j2000);
  const raHours = wrap360(Math.atan2(v.y, v.x) / RAD) / 15;
  const dec = Math.atan2(v.z, Math.hypot(v.x, v.y)) / RAD;
  const horizon = Horizon(time, new AeObserver(observer.lat, observer.lon, 0), raHours, dec);
  return { altDeg: horizon.altitude, azDeg: horizon.azimuth };
}

/** FR-FACT-3 (R188): a planet or the Moon at `t` — where it is (topocentric, geometric), how bright, and its constellation (IAU abbreviation). */
export interface BodyNow {
  altDeg: number;
  azDeg: number;
  mag: number;
  con: string;
}

export function bodyNow(body: RiseSetBody, observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs): BodyNow {
  const time = MakeTime(msToDate(t));
  const where = new AeObserver(observer.lat, observer.lon, 0);
  const ofDate = Equator(Body[body], time, where, true, true);
  const horizon = Horizon(time, where, ofDate.ra, ofDate.dec);
  // The constellation boundaries are drawn on the J2000 frame.
  const j2000 = Equator(Body[body], time, where, false, true);
  return { altDeg: horizon.altitude, azDeg: horizon.azimuth, mag: Illumination(Body[body], time).mag, con: Constellation(j2000.ra, j2000.dec).symbol };
}
