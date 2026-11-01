/**
 * R155 (FR-STAR-2, D-983): the equatorial-to-horizon rotation read back from
 * the scene — exact for positions that came through one rotation, `null`
 * where two stars far enough apart are not there.
 */
import { describe, expect, it } from 'vitest';
import { rotationMatrix, type Mat3 } from './projection';
import { applyFrame, equatorialVector, horizonAt, horizonOf, skyFrameOf, unapplyFrame } from './skyFrame';

const STARS: readonly [number, number][] = [
  [101.29, -16.72], // Sirius
  [95.99, -52.7], // Canopus
  [213.92, 19.18], // Arcturus
  [219.9, -60.83], // Rigil Kentaurus
  [279.23, 38.78], // Vega
  [79.17, 45.99], // Capella
  [78.63, -8.2], // Rigel
  [114.83, 5.22], // Procyon
  [24.43, -57.24], // Achernar
  [88.79, 7.41], // Betelgeuse
];

/** The positions a rotation gives the stars, as the scene carries them (Float32, as `starsAt` writes them). */
function positionsUnder(m: Mat3, stars: readonly [number, number][] = STARS): { altDeg: Float32Array; azDeg: Float32Array } {
  const altDeg = new Float32Array(stars.length);
  const azDeg = new Float32Array(stars.length);
  stars.forEach(([ra, dec], i) => {
    const h = horizonOf(applyFrame(m, equatorialVector(ra, dec)));
    altDeg[i] = h.altDeg;
    azDeg[i] = h.azDeg;
  });
  return { altDeg, azDeg };
}

const catalog = { ra: STARS.map(([ra]) => ra), dec: STARS.map(([, dec]) => dec) };

describe('skyFrameOf (FR-STAR-2, D-983)', () => {
  it.each([
    [0, 0, 0],
    [37, -41, 120],
    [-100, 70, 15],
    [222, 190, -60],
  ])('recovers the rotation (%s, %s, %s) that placed the stars, to the float32 positions’ own precision', (a, b, g) => {
    const m = rotationMatrix(a, b, g);
    const frame = skyFrameOf(catalog, positionsUnder(m));
    expect(frame).not.toBeNull();
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) expect(frame?.[r]?.[c]).toBeCloseTo(m[r]?.[c] ?? Number.NaN, 5);
    // A star the frame was not built from lands where the rotation puts it, within a thousandth of a degree.
    const h = horizonOf(applyFrame(m, equatorialVector(186.65, -63.1))); // Acrux
    const got = horizonAt(frame ?? m, 186.65, -63.1);
    expect(got.altDeg).toBeCloseTo(h.altDeg, 3);
    expect(Math.abs((((got.azDeg - h.azDeg) % 360) + 540) % 360 - 180)).toBeLessThan(0.001);
  });

  it('uses the first finite star and the first after it at least 45° away, skipping a NaN position', () => {
    const m = rotationMatrix(10, 20, 30);
    const positions = positionsUnder(m);
    positions.altDeg[0] = Number.NaN;
    const frame = skyFrameOf(catalog, positions);
    expect(frame).not.toBeNull();
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) expect(frame?.[r]?.[c]).toBeCloseTo(m[r]?.[c] ?? Number.NaN, 5);
  });

  it('is null with one star, with two too close together, or with nothing finite', () => {
    const m = rotationMatrix(10, 20, 30);
    expect(skyFrameOf({ ra: [0], dec: [0] }, positionsUnder(m, [[0, 0]]))).toBeNull();
    expect(skyFrameOf({ ra: [0, 5], dec: [0, 5] }, positionsUnder(m, [[0, 0], [5, 5]]))).toBeNull();
    expect(skyFrameOf(catalog, { altDeg: new Float32Array(STARS.length).fill(Number.NaN), azDeg: new Float32Array(STARS.length) })).toBeNull();
    expect(skyFrameOf({ ra: [], dec: [] }, { altDeg: [], azDeg: [] })).toBeNull();
  });

  it('unapplies what it applied', () => {
    const m = rotationMatrix(37, -41, 120);
    const v = equatorialVector(123.4, -5.6);
    const back = unapplyFrame(m, applyFrame(m, v));
    for (let i = 0; i < 3; i += 1) expect(back[i]).toBeCloseTo(v[i] ?? Number.NaN, 12);
    expect(horizonOf([0, 1, 0])).toEqual({ azDeg: 0, altDeg: 0 });
    expect(horizonOf([1, 0, 0]).azDeg).toBeCloseTo(90, 10);
    expect(horizonOf([0, 0, 1]).altDeg).toBeCloseTo(90, 10);
  });
});
