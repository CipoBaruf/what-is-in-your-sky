import { describe, expect, it } from 'vitest';
import stations from '../../tests/fixtures/omm/2026-09-02-stations.json';
import type { OmmRecord } from '../model';
import { FACT_HEIGHT_STEP_KM, orbitHeight } from './orbitHeight';

describe('orbitHeight', () => {
  it('FR-FACT-1: the ISS in the fixed 2026-09-02 OMM is one number, 420 km (perigee 416, apogee 423 before rounding)', () => {
    const iss = (stations as OmmRecord[]).find((r) => r.NORAD_CAT_ID === 25544);
    if (!iss) throw new Error('fixture has no ISS');
    expect(orbitHeight(iss)).toEqual({ kind: 'one', km: 420 });
  });

  it('FR-FACT-1: an eccentric orbit is a range, each end rounded to FACT_HEIGHT_STEP_KM', () => {
    expect(FACT_HEIGHT_STEP_KM).toBe(10);
    // n = 14 rev/day, e = 0.01: a = 7271.4 km, so 821.1 and 966.5 km over the WGS-84 equator.
    expect(orbitHeight({ MEAN_MOTION: 14, ECCENTRICITY: 0.01 })).toEqual({ kind: 'range', perigeeKm: 820, apogeeKm: 970 });
    // A Molniya orbit: 527.6 to 39 837.0 km.
    expect(orbitHeight({ MEAN_MOTION: 2.00563, ECCENTRICITY: 0.74 })).toEqual({ kind: 'range', perigeeKm: 530, apogeeKm: 39_840 });
  });

  it('FR-FACT-1: no height from a record that has no orbit', () => {
    expect(orbitHeight({ MEAN_MOTION: 0, ECCENTRICITY: 0 })).toBeNull();
    expect(orbitHeight({ MEAN_MOTION: 15, ECCENTRICITY: 1.2 })).toBeNull();
    expect(orbitHeight({ MEAN_MOTION: Number.NaN, ECCENTRICITY: 0 })).toBeNull();
  });
});
