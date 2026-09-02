import { describe, expect, it } from 'vitest';
import { sgp4, twoline2satrec } from 'satellite.js';
import type { OmmRecord } from '../model';
import { ommToJsonObject, ommToSatrec, propagateEci } from './sgp4';

// Vallado et al. (2006) SGP4 verification case, satellite 00005 (Vanguard 2 rocket body).
const line1 = '1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753';
const line2 = '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667';
const omm: OmmRecord = {
  OBJECT_NAME: 'VANGUARD 2 R/B',
  OBJECT_ID: '1958-002B',
  NORAD_CAT_ID: 5,
  EPOCH: '2000-06-27T18:50:19.733568', // day 179.78495062 of 2000
  MEAN_MOTION: 10.82419157,
  ECCENTRICITY: 0.1859667,
  INCLINATION: 34.2682,
  RA_OF_ASC_NODE: 348.7242,
  ARG_OF_PERICENTER: 331.7664,
  MEAN_ANOMALY: 19.3264,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  ELEMENT_SET_NO: 475,
  REV_AT_EPOCH: 41366,
  BSTAR: 0.000028098,
  MEAN_MOTION_DOT: 0.00000023,
  MEAN_MOTION_DDOT: 0,
};
// Published TEME positions (km) from the verification output, tsince = 0 and 360 min.
const posAt0 = { x: 7022.46529266, y: -1400.08296755, z: 0.03995155 };
const posAt360 = { x: -7154.03120202, y: -3783.17682504, z: -3536.19412294 };

describe('sgp4', () => {
  it('json2satrec accepts CelesTrak OMM field names as-is and matches twoline2satrec', () => {
    const fromJson = ommToSatrec(omm);
    const fromTle = twoline2satrec(line1, line2);
    expect(fromJson.jdsatepoch).toBeCloseTo(fromTle.jdsatepoch, 7);
    for (const tsince of [0, 360]) {
      const a = sgp4(fromJson, tsince)?.position;
      const b = sgp4(fromTle, tsince)?.position;
      expect(a).toBeDefined();
      expect(a?.x).toBeCloseTo(b?.x ?? NaN, 6);
      expect(a?.y).toBeCloseTo(b?.y ?? NaN, 6);
      expect(a?.z).toBeCloseTo(b?.z ?? NaN, 6);
    }
  });

  it('reproduces the Vallado verification vector at tsince = 0 and 360 min', () => {
    const satrec = ommToSatrec(omm);
    const p0 = sgp4(satrec, 0)?.position;
    const p360 = sgp4(satrec, 360)?.position;
    expect(p0?.x).toBeCloseTo(posAt0.x, 5);
    expect(p0?.y).toBeCloseTo(posAt0.y, 5);
    expect(p0?.z).toBeCloseTo(posAt0.z, 5);
    expect(p360?.x).toBeCloseTo(posAt360.x, 5);
    expect(p360?.y).toBeCloseTo(posAt360.y, 5);
    expect(p360?.z).toBeCloseTo(posAt360.z, 5);
  });

  it('propagating by epoch-ms lands on the same vector (time base is UTC ms → JD)', () => {
    const satrec = ommToSatrec(omm);
    const epochMs = Date.UTC(2000, 5, 27, 18, 50, 19, 734);
    const state = propagateEci(satrec, epochMs);
    // ≤ 1 ms of epoch rounding × 7 km/s ≈ 7 m
    expect(state?.position.x).toBeCloseTo(posAt0.x, 1);
    expect(state?.position.y).toBeCloseTo(posAt0.y, 1);
    expect(state?.position.z).toBeCloseTo(posAt0.z, 1);
    const later = propagateEci(satrec, epochMs + 360 * 60_000);
    expect(later?.position.x).toBeCloseTo(posAt360.x, 1);
    expect(later?.position.y).toBeCloseTo(posAt360.y, 1);
    expect(later?.position.z).toBeCloseTo(posAt360.z, 1);
  });

  it('narrows EPHEMERIS_TYPE and CLASSIFICATION_TYPE for satellite.js and rejects other ephemeris types', () => {
    expect(ommToJsonObject(omm).EPHEMERIS_TYPE).toBe(0);
    expect(ommToJsonObject({ ...omm, CLASSIFICATION_TYPE: 'X' }).CLASSIFICATION_TYPE).toBeUndefined();
    expect(() => ommToSatrec({ ...omm, EPHEMERIS_TYPE: 2 })).toThrow(/EPHEMERIS_TYPE/);
  });
});
