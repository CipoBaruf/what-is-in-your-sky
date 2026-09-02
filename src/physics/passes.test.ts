import { describe, expect, it } from 'vitest';
import type { Observer, OmmRecord, TimeWindow } from '../model';
import { DEFAULT_THRESHOLDS } from './constants';
import { findPasses, parabolicPeakTime, type PassObject } from './passes';
import { ommToSatrec } from './sgp4';
import { parseOmmEpoch } from './time';

// Fabricated circular polar orbit at ~560 km (PLAN §9.2). Equinox epoch so day and night are symmetric.
const polar: OmmRecord = {
  OBJECT_NAME: 'SYNTHETIC POLAR',
  OBJECT_ID: '2026-999A',
  NORAD_CAT_ID: 999999,
  EPOCH: '2026-03-20T00:00:00.000000',
  MEAN_MOTION: 15.0,
  ECCENTRICITY: 0.0001,
  INCLINATION: 90.0,
  RA_OF_ASC_NODE: 0.0,
  ARG_OF_PERICENTER: 0.0,
  MEAN_ANOMALY: 0.0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 1,
  BSTAR: 0,
  MEAN_MOTION_DOT: 0,
  MEAN_MOTION_DDOT: 0,
};
const object: PassObject = { noradId: 999999, name: 'SYNTHETIC POLAR', stdMag: 0, elementsEpochMs: parseOmmEpoch(polar.EPOCH) };
const observer: Observer = { lat: 0, lon: 0, altM: 0, label: 'equator', source: 'coords', timeZone: null };
const t0 = parseOmmEpoch(polar.EPOCH);
const twoDays: TimeWindow = { startMs: t0, endMs: t0 + 2 * 86_400_000 };
// Geometry-only thresholds: any sun altitude counts as dark, no magnitude cut.
const geometryOnly = { ...DEFAULT_THRESHOLDS, sunAltMaxDeg: 90, magLimit: Number.POSITIVE_INFINITY };

describe('findPasses', () => {
  const passes = findPasses(ommToSatrec(polar), observer, twoDays, geometryOnly, object);

  it('finds passes for a polar orbit over an equatorial observer', () => {
    expect(passes.length).toBeGreaterThanOrEqual(2);
    expect(passes.map((p) => p.start.t)).toEqual([...passes.map((p) => p.start.t)].sort((a, b) => a - b));
  });

  it('horizon-bounded passes start and end at the 10° threshold (symmetric rise/set elevations)', () => {
    const horizonOnly = passes.filter((p) => p.startReason === 'horizon' && p.endReason === 'horizon');
    expect(horizonOnly.length).toBeGreaterThan(0);
    for (const p of horizonOnly) {
      expect(p.start.elDeg).toBeGreaterThanOrEqual(10);
      expect(p.end.elDeg).toBeGreaterThanOrEqual(10);
      // Within one dense step of the crossing on both sides: the elevation rate at 10° for a 560 km orbit is ≈ 0.1°/s.
      expect(p.start.elDeg).toBeLessThan(10.3);
      expect(p.end.elDeg).toBeLessThan(10.3);
      expect(Math.abs(p.start.elDeg - p.end.elDeg)).toBeLessThan(0.3);
    }
  });

  it('keeps every reported point inside the pass and the peak highest', () => {
    for (const p of passes) {
      expect(p.start.t).toBeLessThanOrEqual(p.peak.t);
      expect(p.peak.t).toBeLessThanOrEqual(p.end.t);
      expect(p.peak.elDeg).toBeGreaterThanOrEqual(p.start.elDeg);
      expect(p.peak.elDeg).toBeGreaterThanOrEqual(p.end.elDeg);
      expect(p.durationS).toBeCloseTo((p.end.t - p.start.t) / 1000, 9);
      expect(p.id).toBe(`${object.noradId}-${p.start.t}`);
      expect(p.elementsEpochMs).toBe(object.elementsEpochMs);
    }
  });

  it('orders durations with peak elevation for horizon-bounded passes', () => {
    const horizonOnly = passes.filter((p) => p.startReason === 'horizon' && p.endReason === 'horizon');
    const byPeak = [...horizonOnly].sort((a, b) => a.peak.elDeg - b.peak.elDeg);
    const lowest = byPeak[0];
    const highest = byPeak[byPeak.length - 1];
    if (lowest && highest && highest.peak.elDeg - lowest.peak.elDeg > 5) {
      expect(highest.durationS).toBeGreaterThan(lowest.durationS);
    }
  });

  it('track holds ~10 s samples plus the exact start, peak and end, in order, unique', () => {
    for (const p of passes) {
      const ts = p.track.map((s) => s.t);
      expect(ts[0]).toBe(p.start.t);
      expect(ts[ts.length - 1]).toBe(p.end.t);
      expect(ts).toContain(p.peak.t);
      expect(new Set(ts).size).toBe(ts.length);
      expect(ts).toEqual([...ts].sort((a, b) => a - b));
      expect(p.track.length).toBeGreaterThanOrEqual(Math.floor(p.durationS / 10));
    }
  });

  it('finds no pass when the observer is in daylight for the whole window', () => {
    // ±3 h around solar noon at lon 0 on the equinox.
    const noon = Date.UTC(2026, 3, 20, 12, 7); // equation of time ≈ +1 min on 2026-04-20
    const daylight: TimeWindow = { startMs: noon - 3 * 3_600_000, endMs: noon + 3 * 3_600_000 };
    const found = findPasses(ommToSatrec(polar), observer, daylight, { ...DEFAULT_THRESHOLDS, magLimit: Number.POSITIVE_INFINITY }, object);
    expect(found).toEqual([]);
  });

  it('applies the magnitude cut and flags twilight', () => {
    const night = findPasses(ommToSatrec(polar), observer, twoDays, { ...DEFAULT_THRESHOLDS, magLimit: Number.POSITIVE_INFINITY }, object);
    for (const p of night) {
      expect(p.sunAltAtPeakDeg).toBeLessThanOrEqual(-6);
      expect(p.twilight).toBe(p.sunAltAtPeakDeg > -12);
      expect(['horizon', 'shadow', 'twilight']).toContain(p.startReason);
      expect(['horizon', 'shadow', 'twilight']).toContain(p.endReason);
    }
    const cut = findPasses(ommToSatrec(polar), observer, twoDays, { ...DEFAULT_THRESHOLDS, magLimit: -100 }, object);
    expect(cut).toEqual([]);
  });
});

describe('parabolicPeakTime', () => {
  const pt = (t: number, elDeg: number) => ({ t, azDeg: 0, elDeg, rangeKm: 0 });

  it('returns the sample time for a symmetric neighbourhood', () => {
    expect(parabolicPeakTime(pt(0, 40), pt(1000, 41), pt(2000, 40))).toBe(1000);
  });

  it('shifts toward the higher neighbour', () => {
    const t = parabolicPeakTime(pt(0, 40), pt(1000, 41), pt(2000, 40.5));
    expect(t).toBeGreaterThan(1000);
    expect(t).toBeLessThan(2000);
  });

  it('falls back to the sample when a neighbour is missing or there is no curvature', () => {
    expect(parabolicPeakTime(undefined, pt(1000, 41), pt(2000, 40))).toBe(1000);
    expect(parabolicPeakTime(pt(0, 41), pt(1000, 41), pt(2000, 41))).toBe(1000);
  });
});
