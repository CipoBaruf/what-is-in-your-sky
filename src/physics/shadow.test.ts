import { describe, expect, it } from 'vitest';
import { loadReferenceValues } from '../../tests/support/reference';
import { EARTH_RADIUS_KM } from './constants';
import { dot } from './frames';
import { inUmbra } from './shadow';

const sun = { x: 1, y: 0, z: 0 };
const r = 6371 + 400;
const ref = loadReferenceValues();

describe('shadow (PLAN §9.2 constructed geometries, D-8)', () => {
  it('a satellite on the anti-sun axis at 400 km is in umbra', () => {
    expect(inUmbra({ x: -r, y: 0, z: 0 }, sun)).toBe(true);
  });

  it('the same radius perpendicular to the axis is lit', () => {
    expect(inUmbra({ x: 0, y: r, z: 0 }, sun)).toBe(false);
  });

  it('a sun-side point is lit even inside the cylinder', () => {
    expect(inUmbra({ x: r, y: 0, z: 0 }, sun)).toBe(false);
    expect(inUmbra({ x: 100, y: 1000, z: 0 }, sun)).toBe(false);
  });

  it('the cylinder edge is exactly the Earth radius (6371.0 km, no atmosphere fudge)', () => {
    expect(EARTH_RADIUS_KM).toBe(6371.0);
    expect(inUmbra({ x: -1000, y: 6370.9, z: 0 }, sun)).toBe(true);
    expect(inUmbra({ x: -1000, y: 6371.1, z: 0 }, sun)).toBe(false);
    expect(inUmbra({ x: -1000, y: 6371.1, z: 0 }, sun, 6400)).toBe(true);
  });

  it('is independent of the sun vector orientation (rotated geometry)', () => {
    const s = { x: 0.6, y: 0.0, z: 0.8 }; // unit
    const anti = { x: -0.6 * r, y: 0, z: -0.8 * r };
    const perpendicular = { x: 0.8 * r, y: 0, z: -0.6 * r };
    expect(inUmbra(anti, s)).toBe(true);
    expect(inUmbra(perpendicular, s)).toBe(false);
  });

  it('reproduces the ISS umbra state at the reference instant (reference-values.json)', () => {
    expect(inUmbra(ref.eci.position, ref.sunUnitVectorEqd)).toBe(ref.inUmbra);
    // The pinned instant is local night at Neuquén with the ISS on the night side of the Earth.
    expect(dot(ref.eci.position, ref.sunUnitVectorEqd)).toBeLessThan(0);
  });
});
