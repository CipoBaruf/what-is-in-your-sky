import { describe, expect, it } from 'vitest';
import { loadFixturePair } from '../../tests/support/fixtures';
import { ISS_NORAD_ID, ISS_STD_MAG_SEED } from '../../tests/support/heavensAbove';
import { loadReferenceValues, referenceObserver } from '../../tests/support/reference';
import { observerEci } from './frames';
import { apparentMagnitude, phaseAngleDeg, phaseFunction } from './magnitude';
import { ommToSatrec, propagateEci } from './sgp4';
import { sunVectorEqd } from './sun';

const ref = loadReferenceValues();

describe('magnitude (D-1)', () => {
  it('anchor: m(1000 km, 90°) = stdMag', () => {
    expect(apparentMagnitude(-1.8, 1000, 90)).toBeCloseTo(-1.8, 12);
    expect(apparentMagnitude(3.2, 1000, 90)).toBeCloseTo(3.2, 12);
  });

  it('m(2000 km, 90°) = stdMag + 1.505', () => {
    expect(apparentMagnitude(0, 2000, 90)).toBeCloseTo(1.505, 3);
    expect(apparentMagnitude(-1.8, 2000, 90)).toBeCloseTo(-1.8 + 5 * Math.log10(2), 9);
  });

  it('full phase is brighter than half phase, back-lit is fainter', () => {
    expect(apparentMagnitude(0, 1000, 0)).toBeLessThan(apparentMagnitude(0, 1000, 90));
    expect(apparentMagnitude(0, 1000, 150)).toBeGreaterThan(apparentMagnitude(0, 1000, 90));
    expect(apparentMagnitude(0, 1000, 0)).toBeCloseTo(-2.5 * Math.log10(Math.PI), 6);
  });

  it('stays finite at exactly 180° phase (p(β) floored, no −Infinity)', () => {
    expect(Number.isFinite(apparentMagnitude(0, 1000, 180))).toBe(true);
    expect(apparentMagnitude(0, 1000, 180)).toBeGreaterThan(apparentMagnitude(0, 1000, 179));
  });

  it('phase function is the diffuse-sphere law', () => {
    expect(phaseFunction(Math.PI / 2)).toBeCloseTo(1, 12);
    expect(phaseFunction(0)).toBeCloseTo(Math.PI, 12);
    expect(phaseFunction(Math.PI)).toBeCloseTo(0, 12);
  });

  it('phase angle is measured at the satellite between the sun and observer directions', () => {
    const sat = { x: 7000, y: 0, z: 0 };
    const sun = { x: 0, y: 1, z: 0 };
    expect(phaseAngleDeg(sat, { x: 7000, y: 1000, z: 0 }, sun)).toBeCloseTo(0, 9); // observer toward the sun
    expect(phaseAngleDeg(sat, { x: 7000, y: -1000, z: 0 }, sun)).toBeCloseTo(180, 9); // back-lit
    expect(phaseAngleDeg(sat, { x: 6000, y: 0, z: 0 }, sun)).toBeCloseTo(90, 9);
  });

  it('reproduces the pinned peak magnitude of the first golden pass (reference-values.json)', () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference has no golden pass');
    const pair = loadFixturePair(ref.fixture, ref.ommFixture);
    const iss = pair.omm.find((r) => r.NORAD_CAT_ID === ISS_NORAD_ID);
    if (!iss) throw new Error('ISS missing from OMM fixture');
    const state = propagateEci(ommToSatrec(iss), golden.peak.t);
    if (!state) throw new Error('propagation failed');
    const observer = referenceObserver(ref);
    const phase = phaseAngleDeg(state.position, observerEci(observer, golden.peak.t), sunVectorEqd(golden.peak.t));
    expect(apparentMagnitude(ISS_STD_MAG_SEED, golden.peak.rangeKm, phase)).toBeCloseTo(golden.peakMagnitude, 6);
    // Morning-twilight pass seen back-lit: phase angle well past 90°, hence fainter than stdMag despite the range.
    expect(phase).toBeGreaterThan(90);
    expect(golden.peakMagnitude).toBeGreaterThan(ISS_STD_MAG_SEED);
  });
});
