import { describe, expect, it } from 'vitest';
import { inUmbra } from './shadow';

const sun = { x: 1, y: 0, z: 0 };
const r = 6371 + 400;

describe('shadow', () => {
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

  it('the cylinder edge is exactly the Earth radius', () => {
    expect(inUmbra({ x: -1000, y: 6370.9, z: 0 }, sun)).toBe(true);
    expect(inUmbra({ x: -1000, y: 6371.1, z: 0 }, sun)).toBe(false);
    expect(inUmbra({ x: -1000, y: 6371.1, z: 0 }, sun, 6400)).toBe(true);
  });
});
