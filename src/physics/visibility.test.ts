import { describe, expect, it } from 'vitest';
import { loadFixturePair } from '../../tests/support/fixtures';
import { ISS_NORAD_ID, ISS_STD_MAG_SEED } from '../../tests/support/heavensAbove';
import { loadReferenceValues, referenceObserver } from '../../tests/support/reference';
import { DEFAULT_THRESHOLDS } from './constants';
import { ommToSatrec } from './sgp4';
import { failingReason, sampleAt, visibilityAt, type VisibilitySample } from './visibility';

const ref = loadReferenceValues();
const observer = referenceObserver(ref);
const pair = loadFixturePair(ref.fixture, ref.ommFixture);
const iss = pair.omm.find((r) => r.NORAD_CAT_ID === ISS_NORAD_ID);
if (!iss) throw new Error('ISS missing from OMM fixture');
const satrec = ommToSatrec(iss);

const base: VisibilitySample = {
  t: 0,
  posEci: { x: 7000, y: 0, z: 0 },
  azDeg: 0,
  elDeg: 45,
  rangeKm: 1000,
  sunAltDeg: -30,
  lit: true,
  phaseDeg: 90,
  magnitude: -1,
};

describe('visibility predicate (PLAN §6.3 step 3)', () => {
  it('is visible only when above the minimum elevation, dark and lit', () => {
    expect(visibilityAt(base, DEFAULT_THRESHOLDS)).toEqual({ aboveMinElevation: true, dark: true, lit: true, visible: true });
    expect(visibilityAt({ ...base, elDeg: 9.99 }, DEFAULT_THRESHOLDS).visible).toBe(false);
    expect(visibilityAt({ ...base, elDeg: 10 }, DEFAULT_THRESHOLDS).visible).toBe(true); // inclusive at 10°
    expect(visibilityAt({ ...base, sunAltDeg: -5.99 }, DEFAULT_THRESHOLDS).visible).toBe(false);
    expect(visibilityAt({ ...base, sunAltDeg: -6 }, DEFAULT_THRESHOLDS).visible).toBe(true); // inclusive at −6°
    expect(visibilityAt({ ...base, lit: false }, DEFAULT_THRESHOLDS).visible).toBe(false);
  });

  it('names the failing condition in the order horizon, shadow, twilight', () => {
    expect(failingReason(base, DEFAULT_THRESHOLDS)).toBeNull();
    expect(failingReason({ ...base, elDeg: 5 }, DEFAULT_THRESHOLDS)).toBe('horizon');
    expect(failingReason({ ...base, lit: false }, DEFAULT_THRESHOLDS)).toBe('shadow');
    expect(failingReason({ ...base, sunAltDeg: 0 }, DEFAULT_THRESHOLDS)).toBe('twilight');
    expect(failingReason({ ...base, elDeg: 5, lit: false, sunAltDeg: 0 }, DEFAULT_THRESHOLDS)).toBe('horizon');
    expect(failingReason({ ...base, lit: false, sunAltDeg: 0 }, DEFAULT_THRESHOLDS)).toBe('shadow');
  });
});

describe('sampleAt', () => {
  it('reproduces the reference ECI position, look angles, sun altitude and umbra state at capturedAt (reference-values.json)', () => {
    const s = sampleAt(satrec, observer, ref.t, ISS_STD_MAG_SEED);
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.t).toBe(ref.t);
    expect(s.posEci.x).toBeCloseTo(ref.eci.position.x, 6);
    expect(s.posEci.y).toBeCloseTo(ref.eci.position.y, 6);
    expect(s.posEci.z).toBeCloseTo(ref.eci.position.z, 6);
    expect(s.azDeg).toBeCloseTo(ref.lookAngles.azDeg, 6);
    expect(s.elDeg).toBeCloseTo(ref.lookAngles.elDeg, 6);
    expect(s.rangeKm).toBeCloseTo(ref.lookAngles.rangeKm, 6);
    expect(s.sunAltDeg).toBeCloseTo(ref.sunAltitudeDeg, 6);
    expect(s.lit).toBe(!ref.inUmbra);
    expect(s.phaseDeg).toBeGreaterThanOrEqual(0);
    expect(s.phaseDeg).toBeLessThanOrEqual(180);
    expect(Number.isFinite(s.magnitude)).toBe(true);
    // Below the horizon at the pinned instant, so the sample is invisible for the horizon reason first.
    expect(failingReason(s, DEFAULT_THRESHOLDS)).toBe('horizon');
  });

  it('reproduces the pinned peak of the first golden pass', () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference has no golden pass');
    const s = sampleAt(satrec, observer, golden.peak.t, ISS_STD_MAG_SEED);
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.azDeg).toBeCloseTo(golden.peak.azDeg, 6);
    expect(s.elDeg).toBeCloseTo(golden.peak.elDeg, 6);
    expect(s.rangeKm).toBeCloseTo(golden.peak.rangeKm, 6);
    expect(s.magnitude).toBeCloseTo(golden.peakMagnitude, 6);
    expect(s.sunAltDeg).toBeCloseTo(golden.sunAltAtPeakDeg, 6);
    expect(visibilityAt(s, DEFAULT_THRESHOLDS).visible).toBe(true);
  });

  it('returns null when SGP4 cannot propagate (decayed orbit)', () => {
    // The ISS with a drag term 600× the real one has decayed ten days after its epoch (SGP4 error 6).
    const dragged = ommToSatrec({ ...iss, BSTAR: 0.05 });
    expect(sampleAt(dragged, observer, ref.iss.epochMs + 10 * 86_400_000, ISS_STD_MAG_SEED)).toBeNull();
  });
});
