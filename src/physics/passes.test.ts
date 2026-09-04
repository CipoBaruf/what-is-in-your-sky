import { describe, expect, it } from 'vitest';
import type { Observer, OmmRecord, TimeWindow } from '../model';
import { loadFixturePair } from '../../tests/support/fixtures';
import { ISS_NORAD_ID, ISS_STD_MAG_SEED, SPIKE_THRESHOLDS } from '../../tests/support/heavensAbove';
import { loadReferenceValues, referenceObserver } from '../../tests/support/reference';
import { DEFAULT_MOON_GLARE_THRESHOLDS, DEFAULT_THRESHOLDS, DENSE_STEP_MS } from './constants';
import { angularSeparationDeg, moonGlare } from './moon';
import { coarseSegments, findPasses, parabolicPeakTime, type PassObject } from './passes';
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

describe('the Moon on every pass (R19 review, D-109)', () => {
  // Six days, not the two the other cases use: near this epoch the Moon is a waxing crescent
  // losing about 13° of altitude a day at the morning pass, and it takes until day six for one
  // peak to fall with the Moon below the horizon — the case US-18 AC1 turns on.
  const sixDays: TimeWindow = { startMs: t0, endMs: t0 + 6 * 86_400_000 };
  const passes = findPasses(ommToSatrec(polar), observer, sixDays, geometryOnly, object);

  it('carries the Moon at the peak instant, up or down, on every pass', () => {
    expect(passes.length).toBeGreaterThan(0);
    for (const pass of passes) {
      // The evaluation instant is the peak's, not the start's: `moonGlare` measures from the peak.
      expect(pass.moonAtPeak.t).toBe(pass.peak.t);
      expect(pass.moonAtPeak.illuminatedFraction).toBeGreaterThanOrEqual(0);
      expect(pass.moonAtPeak.illuminatedFraction).toBeLessThanOrEqual(1);
    }
    // Both cases are present, and both carry a Moon: US-18 AC1 wants the phase either way.
    expect(passes.some((pass) => pass.moonAtPeak.elDeg > 0)).toBe(true);
    expect(passes.some((pass) => pass.moonAtPeak.elDeg <= 0)).toBe(true);
  });

  it('measures the separation from the peak of that pass, not from another point on it', () => {
    for (const pass of passes) {
      const fromPeak = angularSeparationDeg(pass.moonAtPeak, pass.peak);
      expect(pass.moonGlare.separationDeg).toBeCloseTo(fromPeak, 9);
    }
    // The start of a pass is a different direction, so this is a real distinction.
    const first = passes[0];
    if (!first) throw new Error('no pass to check');
    expect(Math.abs(angularSeparationDeg(first.moonAtPeak, first.start) - first.moonGlare.separationDeg)).toBeGreaterThan(1);
  });

  it('raises glare only where moonGlare does, so the altitude rule lives in exactly one place', () => {
    for (const pass of passes) {
      expect(pass.moonGlare).toEqual(moonGlare(pass.moonAtPeak, pass.peak, DEFAULT_MOON_GLARE_THRESHOLDS));
      if (pass.moonGlare.glare) expect(pass.moonAtPeak.elDeg).toBeGreaterThan(DEFAULT_MOON_GLARE_THRESHOLDS.minAltDeg);
    }
  });
});

describe('findPasses against the pinned first golden pass (reference-values.json)', () => {
  const ref = loadReferenceValues();
  const golden = ref.firstGoldenPass;
  if (!golden) throw new Error('reference has no golden pass');
  const pair = loadFixturePair(ref.fixture, ref.ommFixture);
  const iss = pair.omm.find((r) => r.NORAD_CAT_ID === ISS_NORAD_ID);
  if (!iss) throw new Error('ISS missing from OMM fixture');
  const satrec = ommToSatrec(iss);
  const observer = referenceObserver(ref);
  const issObject: PassObject = { noradId: ISS_NORAD_ID, name: iss.OBJECT_NAME, stdMag: ISS_STD_MAG_SEED, elementsEpochMs: parseOmmEpoch(iss.EPOCH) };
  // One hour either side of the pinned pass: the same result as the 10-day run, in a fraction of the time.
  const around: TimeWindow = { startMs: golden.start.t - 3_600_000, endMs: golden.end.t + 3_600_000 };

  it('reproduces start, peak and end to the millisecond and the pinned reasons, magnitude and twilight flag', () => {
    const found = findPasses(satrec, observer, around, SPIKE_THRESHOLDS, issObject);
    expect(found).toHaveLength(1);
    const p = found[0];
    if (!p) return;
    for (const key of ['start', 'peak', 'end'] as const) {
      expect(p[key].t).toBe(golden[key].t);
      expect(p[key].azDeg).toBeCloseTo(golden[key].azDeg, 6);
      expect(p[key].elDeg).toBeCloseTo(golden[key].elDeg, 6);
      expect(p[key].rangeKm).toBeCloseTo(golden[key].rangeKm, 6);
    }
    expect(p.startReason).toBe(golden.startReason);
    expect(p.endReason).toBe(golden.endReason);
    expect(p.peakMagnitude).toBeCloseTo(golden.peakMagnitude, 6);
    expect(p.sunAltAtPeakDeg).toBeCloseTo(golden.sunAltAtPeakDeg, 6);
    expect(p.twilight).toBe(golden.twilight);
    expect(p.id).toBe(`${ISS_NORAD_ID}-${golden.start.t}`);
  });

  it('coarse scan brackets the golden pass in one segment padded by a step on each side', () => {
    const segments = coarseSegments(satrec, observer, around);
    const holding = segments.filter((s) => s.startMs <= golden.start.t && s.endMs >= golden.end.t);
    expect(holding).toHaveLength(1);
  });

  it('drops the pass under a magnitude cut just brighter than its pinned peak and keeps it just fainter', () => {
    const tight = { ...SPIKE_THRESHOLDS, magLimit: golden.peakMagnitude - 0.01 };
    const loose = { ...SPIKE_THRESHOLDS, magLimit: golden.peakMagnitude + 0.01 };
    expect(findPasses(satrec, observer, around, tight, issObject)).toEqual([]);
    expect(findPasses(satrec, observer, around, loose, issObject)).toHaveLength(1);
  });

  it('clamps dense sampling to the requested window when the window cuts through the pass', () => {
    const cut: TimeWindow = { startMs: golden.peak.t, endMs: golden.end.t + 3_600_000 };
    const found = findPasses(satrec, observer, cut, SPIKE_THRESHOLDS, issObject);
    expect(found).toHaveLength(1);
    expect(found[0]?.start.t).toBeGreaterThanOrEqual(cut.startMs);
    // The 1 s grid is now in phase with the window start, so the end lands within one dense step of the pinned end.
    expect(Math.abs((found[0]?.end.t ?? 0) - golden.end.t)).toBeLessThan(DENSE_STEP_MS);
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
