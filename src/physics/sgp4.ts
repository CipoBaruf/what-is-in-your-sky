import { json2satrec, propagate, type SatRec, SatRecError, type OMMJsonObject } from 'satellite.js';
import type { EpochMs, OmmRecord } from '../model';
import type { Vec3 } from './frames';
import { msToDate } from './time';

export type { SatRec };

export interface EciState {
  position: Vec3; // km, TEME
  velocity: Vec3; // km/s, TEME
}

/**
 * CelesTrak's OMM field names are accepted by `json2satrec` as-is. The only
 * adaptation is at the type level: satellite.js narrows `EPHEMERIS_TYPE` to
 * `0` and `CLASSIFICATION_TYPE` to `'U' | 'C'`, so the record is checked and
 * re-shaped here rather than cast.
 */
export function ommToJsonObject(omm: OmmRecord): OMMJsonObject {
  if (omm.EPHEMERIS_TYPE !== 0) {
    throw new Error(`NORAD ${omm.NORAD_CAT_ID}: unsupported EPHEMERIS_TYPE ${omm.EPHEMERIS_TYPE}`);
  }
  const { EPHEMERIS_TYPE: _e, CLASSIFICATION_TYPE, ...rest } = omm;
  return {
    ...rest,
    EPHEMERIS_TYPE: 0,
    ...(CLASSIFICATION_TYPE === 'U' || CLASSIFICATION_TYPE === 'C' ? { CLASSIFICATION_TYPE } : {}),
  };
}

export function ommToSatrec(omm: OmmRecord): SatRec {
  const satrec = json2satrec(ommToJsonObject(omm));
  if (satrec.error !== SatRecError.None) {
    throw new Error(`NORAD ${omm.NORAD_CAT_ID}: SGP4 initialisation failed with code ${satrec.error}`);
  }
  return satrec;
}

/** Propagate to `t`. Returns null when SGP4 reports an error (decay, bad eccentricity, ...). */
export function propagateEci(satrec: SatRec, t: EpochMs): EciState | null {
  const pv = propagate(satrec, msToDate(t));
  if (!pv || satrec.error !== SatRecError.None) return null;
  return { position: pv.position, velocity: pv.velocity };
}
