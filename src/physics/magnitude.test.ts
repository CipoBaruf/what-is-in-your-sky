import { describe, expect, it } from 'vitest';
import { apparentMagnitude, phaseAngleDeg, phaseFunction } from './magnitude';

describe('magnitude (D-1)', () => {
  it('anchor: m(1000 km, 90°) = stdMag', () => {
    expect(apparentMagnitude(-1.8, 1000, 90)).toBeCloseTo(-1.8, 12);
    expect(apparentMagnitude(3.2, 1000, 90)).toBeCloseTo(3.2, 12);
  });

  it('m(2000 km, 90°) = stdMag + 1.505', () => {
    expect(apparentMagnitude(0, 2000, 90)).toBeCloseTo(1.505, 3);
  });

  it('full phase is brighter than half phase, back-lit is fainter', () => {
    expect(apparentMagnitude(0, 1000, 0)).toBeLessThan(apparentMagnitude(0, 1000, 90));
    expect(apparentMagnitude(0, 1000, 150)).toBeGreaterThan(apparentMagnitude(0, 1000, 90));
    expect(apparentMagnitude(0, 1000, 0)).toBeCloseTo(-2.5 * Math.log10(Math.PI), 6);
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
});
