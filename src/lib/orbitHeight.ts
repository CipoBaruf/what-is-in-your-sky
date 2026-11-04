import type { OmmRecord } from '../model';

/**
 * FR-FACT-1 (R183, D-1101): a satellite's height as a range, perigee to apogee, from its OMM's mean motion and
 * eccentricity over Earth's equatorial radius. Mean elements, so it is the orbit's shape, not this minute's height.
 */

/** SPEC v2.14's constants table: orbits drift by kilometres a week, so a finer number would be false precision. */
export const FACT_HEIGHT_STEP_KM = 10;

/** WGS-84: Earth's gravitational parameter (km³/s²) and equatorial radius (km). */
const MU_KM3_S2 = 398_600.4418;
const EQUATORIAL_RADIUS_KM = 6378.137;

export type OrbitHeight = { kind: 'one'; km: number } | { kind: 'range'; perigeeKm: number; apogeeKm: number };

const round = (km: number): number => Math.round(km / FACT_HEIGHT_STEP_KM) * FACT_HEIGHT_STEP_KM;

/** Null when the record's mean motion is not a usable number (a decayed or malformed record). */
export function orbitHeight(omm: Pick<OmmRecord, 'MEAN_MOTION' | 'ECCENTRICITY'>): OrbitHeight | null {
  const n = (omm.MEAN_MOTION * 2 * Math.PI) / 86_400; // rev/day to rad/s
  const e = omm.ECCENTRICITY;
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(e) || e < 0 || e >= 1) return null;
  const a = Math.cbrt(MU_KM3_S2 / (n * n));
  const perigeeKm = round(a * (1 - e) - EQUATORIAL_RADIUS_KM);
  const apogeeKm = round(a * (1 + e) - EQUATORIAL_RADIUS_KM);
  return perigeeKm === apogeeKm ? { kind: 'one', km: perigeeKm } : { kind: 'range', perigeeKm, apogeeKm };
}
