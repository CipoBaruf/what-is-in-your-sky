/**
 * TASKS R13 (PLAN §8.1, §9.1 presentation helpers): the dome frame puts the
 * cardinals and the zenith on the unit axes (±1e−9), the polar projection
 * puts them on the disc in both conventions, resampling the first golden
 * pass keeps start / peak / end and spaces the rest about 2° apart, and
 * interpolation at a sample's time returns that sample.
 */
import { describe, expect, it } from 'vitest';
import { loadFixturePair } from '../../tests/support/fixtures';
import { runOurPipeline } from '../../tests/support/heavensAbove';
import { loadReferenceValues } from '../../tests/support/reference';
import type { PassPoint } from '../model';
import { angularDistanceDeg, fromDome, interpolatePoint, interpolateTrack, resampleArc, toDome, toPolar, trackPeakIndex } from './skyGeometry';

const EPS = 1e-9;
const close = (v: object, expected: Record<string, number>): void => {
  for (const [k, e] of Object.entries(expected)) expect((v as Record<string, number>)[k], k).toBeCloseTo(e, 9);
};

function goldenPass() {
  const ref = loadReferenceValues();
  const pair = loadFixturePair(ref.fixture, ref.ommFixture);
  const first = runOurPipeline(pair.ha, pair.omm)[0];
  if (!first || !ref.firstGoldenPass) throw new Error('no first golden pass');
  return first;
}

describe('toDome (PLAN §8.2)', () => {
  it('maps N, E, S, W and the zenith to the unit axes', () => {
    close(toDome(0, 0), { x: -1, y: 0, z: 0 });
    close(toDome(90, 0), { x: 0, y: 1, z: 0 });
    close(toDome(180, 0), { x: 1, y: 0, z: 0 });
    close(toDome(270, 0), { x: 0, y: -1, z: 0 });
    close(toDome(123, 90), { x: 0, y: 0, z: 1 });
  });

  it('always yields a unit vector, and fromDome inverts it', () => {
    const cases: readonly [number, number][] = [
      [0, 0],
      [37.5, 12],
      [200, 45],
      [359.9, 89],
      [90, -5],
    ];
    for (const [az, el] of cases) {
      const v = toDome(az, el);
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 12);
      const back = fromDome(v);
      expect(back.azDeg).toBeCloseTo(az, 9);
      expect(back.elDeg).toBeCloseTo(el, 9);
    }
    expect(fromDome({ x: 0, y: 0, z: 1 }).elDeg).toBeCloseTo(90, 9);
  });
});

describe('toPolar (FR-GUIDE-2b, FR-GUIDE-4)', () => {
  it('puts north up, the horizon at radius 1 and the zenith at the centre, with east on the left when looking up', () => {
    close(toPolar(0, 0, 'looking-up'), { x: 0, y: -1 });
    close(toPolar(90, 0, 'looking-up'), { x: -1, y: 0 });
    close(toPolar(180, 0, 'looking-up'), { x: 0, y: 1 });
    close(toPolar(270, 0, 'looking-up'), { x: 1, y: 0 });
    close(toPolar(45, 90, 'looking-up'), { x: 0, y: 0 });
  });

  it('puts east on the right in the map convention', () => {
    close(toPolar(0, 0, 'map'), { x: 0, y: -1 });
    close(toPolar(90, 0, 'map'), { x: 1, y: 0 });
    close(toPolar(180, 0, 'map'), { x: 0, y: 1 });
    close(toPolar(270, 0, 'map'), { x: -1, y: 0 });
    close(toPolar(45, 90, 'map'), { x: 0, y: 0 });
  });

  it('is equidistant: 30° and 60° of elevation sit at 2/3 and 1/3 of the radius', () => {
    close(toPolar(0, 30, 'map'), { x: 0, y: -2 / 3 });
    close(toPolar(0, 60, 'map'), { x: 0, y: -1 / 3 });
  });
});

describe('resampleArc', () => {
  it('keeps start, peak and end of the first golden pass and spaces the rest about 2° apart', () => {
    const pass = goldenPass();
    expect(pass.track.length).toBeGreaterThan(3);
    const arc = resampleArc(pass.track, 2);
    expect(arc[0]).toBe(pass.track[0]);
    expect(arc[arc.length - 1]).toBe(pass.track[pass.track.length - 1]);
    expect(arc).toContain(pass.track[trackPeakIndex(pass.track)]);
    expect(arc.map((p) => p.t)).toEqual([...arc].map((p) => p.t).sort((a, b) => a - b));
    // The first golden pass is a 48 s grazing pass (peak 10.2°), 13° of sky: seven points at about 2.2°.
    const gaps = arc.slice(1).map((p, i) => angularDistanceDeg(arc[i] as PassPoint, p));
    expect(gaps.length).toBeGreaterThanOrEqual(4);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(1.5);
      expect(gap).toBeLessThan(2.5);
    }
    expect(gaps.reduce((a, b) => a + b, 0) / gaps.length).toBeCloseTo(2, 0);
  });

  it('subdivides a three-point track along great circles and leaves short tracks alone', () => {
    const start: PassPoint = { t: 0, azDeg: 250, elDeg: 10, rangeKm: 1500 };
    const peak: PassPoint = { t: 180_000, azDeg: 180, elDeg: 60, rangeKm: 500 };
    const end: PassPoint = { t: 360_000, azDeg: 70, elDeg: 10, rangeKm: 1500 };
    const arc = resampleArc([start, peak, end], 5);
    expect(arc[0]).toBe(start);
    expect(arc).toContain(peak);
    expect(arc[arc.length - 1]).toBe(end);
    expect(arc.length).toBeGreaterThan(20); // 60° up, 60° down
    for (const p of arc) {
      const v = toDome(p.azDeg, p.elDeg);
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 9);
    }
    const gaps = arc.slice(1).map((p, i) => angularDistanceDeg(arc[i] as PassPoint, p));
    for (const gap of gaps) expect(gap).toBeCloseTo(5, 0);
    expect(resampleArc([start], 2)).toEqual([start]);
    expect(resampleArc([], 2)).toEqual([]);
  });
});

describe('interpolateTrack', () => {
  it('returns the peak at the peak time of the first golden pass, and clamps outside the track', () => {
    const pass = goldenPass();
    expect(interpolateTrack(pass.track, pass.peak.t)).toEqual(pass.peak);
    expect(interpolateTrack(pass.track, pass.start.t - 60_000)).toEqual(pass.start);
    expect(interpolateTrack(pass.track, pass.end.t + 60_000)).toEqual(pass.end);
    const a = pass.track[3] as PassPoint;
    const b = pass.track[4] as PassPoint;
    const mid = interpolateTrack(pass.track, (a.t + b.t) / 2);
    expect(mid.t).toBe(Math.round((a.t + b.t) / 2));
    expect(angularDistanceDeg(a, mid)).toBeCloseTo(angularDistanceDeg(mid, b), 6);
    expect(mid.rangeKm).toBeCloseTo((a.rangeKm + b.rangeKm) / 2, 9);
  });

  it('interpolatePoint follows the great circle through the zenith', () => {
    const a: PassPoint = { t: 0, azDeg: 270, elDeg: 10, rangeKm: 2000 };
    const b: PassPoint = { t: 100_000, azDeg: 90, elDeg: 10, rangeKm: 2000 };
    const mid = interpolatePoint(a, b, 0.5);
    expect(mid.elDeg).toBeCloseTo(90, 4); // asin is steep at the zenith: 2e−6° of rounding
    expect(mid.t).toBe(50_000);
    expect(interpolatePoint(a, b, 0)).toBe(a);
    expect(interpolatePoint(a, b, 1)).toBe(b);
    expect(() => interpolateTrack([], 0)).toThrow();
    expect(Math.abs(toDome(0, 0).y)).toBeLessThan(EPS);
  });
});
