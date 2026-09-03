/**
 * PLAN §9.1 "Sky chart geometry" (R15): `domeGeometry` is pure. Quad count
 * for the golden pass, every vertex on the unit sphere (±1e−9) except the
 * markers at 1.02, anchors at the eight compass azimuths.
 */
import { describe, expect, it } from 'vitest';
import { goldenPassFixture } from '../../../../../../tests/support/catalogFixtures';
import { fromDome, resampleArc } from '../../../../../lib/skyGeometry';
import type { Pass } from '../../../../../model';
import {
  altitudeRing,
  ARC_STEP_DEG,
  COMPASS,
  COMPASS_LABEL_RADIUS,
  compassAnchors,
  diamond,
  gridPolygons,
  horizonRing,
  MARKER_RADIUS,
  meridian,
  NOW_MARKER_RADIUS,
  nowMarker,
  nowPoint,
  passAnchors,
  passMarkers,
  passStrip,
  screenSide,
  stripAlong,
  type Poly,
  type Tuple3,
} from './domeGeometry';

const pass = goldenPassFixture();
const radius = (v: Tuple3): number => Math.hypot(v[0], v[1], v[2]);
const everyVertex = (polys: readonly Poly[]): Tuple3[] => polys.flatMap((p) => p.vertices);
/** `fromDome` wants a unit vector; anchors and markers sit outside the dome. */
const skyOf = (v: Tuple3): { azDeg: number; elDeg: number } => {
  const r = radius(v);
  return fromDome({ x: v[0] / r, y: v[1] / r, z: v[2] / r });
};

describe('strips', () => {
  it('builds one quad of four vertices per segment, all on the unit sphere', () => {
    const polys = stripAlong(
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      { halfWidthDeg: 0.75 },
    );
    expect(polys).toHaveLength(2);
    for (const poly of polys) expect(poly.vertices).toHaveLength(4);
    for (const v of everyVertex(polys)) expect(radius(v)).toBeCloseTo(1, 9);
  });

  it('closes a ring, dashes by leaving out every other quad, and draws nothing for a single point', () => {
    expect(horizonRing()).toHaveLength(72);
    expect(altitudeRing(30)).toHaveLength(36);
    expect(meridian(0)).toHaveLength(18);
    expect(meridian(45)).toHaveLength(9);
    expect(stripAlong([[1, 0, 0]], { halfWidthDeg: 1 })).toEqual([]);
  });

  it('keeps the whole grid on the unit sphere and the rings at their elevations', () => {
    for (const v of everyVertex(gridPolygons())) expect(radius(v)).toBeCloseTo(1, 9);
    for (const v of everyVertex(altitudeRing(60))) expect(fromDome({ x: v[0], y: v[1], z: v[2] }).elDeg).toBeCloseTo(60, 1);
    for (const v of everyVertex(horizonRing())) expect(Math.abs(v[2])).toBeLessThan(0.002);
  });
});

describe('pass strip (golden pass)', () => {
  it('has one quad per resampled segment less the direction gaps, every vertex on the unit sphere', () => {
    const points = resampleArc(pass.track, ARC_STEP_DEG);
    expect(points).toHaveLength(7); // D-54: the 13° grazing pass resamples to seven points
    const segments = points.length - 1;
    const gapped = [...Array(segments).keys()].filter((i) => i >= Math.floor(segments * 0.8) && (segments - 1 - i) % 2 === 1).length;
    const highlighted = passStrip(pass, { highlighted: true });
    expect(highlighted).toHaveLength(segments - gapped);
    expect(highlighted).toHaveLength(5);
    for (const v of everyVertex(highlighted)) expect(radius(v)).toBeCloseTo(1, 9);
    expect(passStrip(pass, { highlighted: false })).toHaveLength(5);
  });

  it('is wider when highlighted', () => {
    const width = (polys: Poly[]): number => {
      const [a, b] = polys[0]?.vertices ?? [];
      if (!a || !b) throw new Error('no quad');
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    };
    expect(width(passStrip(pass, { highlighted: true }))).toBeGreaterThan(width(passStrip(pass, { highlighted: false })) * 5);
  });
});

describe('markers', () => {
  it('are diamonds of two windings at radius 1.02 around the point', () => {
    const polys = diamond(pass.peak);
    expect(polys).toHaveLength(2);
    for (const v of everyVertex(polys)) expect(radius(v)).toBeCloseTo(MARKER_RADIUS, 9);
    expect(polys[1]?.vertices).toEqual([...(polys[0]?.vertices ?? [])].reverse());
    for (const v of everyVertex(polys)) {
      const { azDeg, elDeg } = skyOf(v);
      expect(Math.abs(elDeg - pass.peak.elDeg)).toBeLessThan(1.51);
      expect(Math.abs(azDeg - pass.peak.azDeg)).toBeLessThan(1.6);
    }
  });

  it('marks the peak, and the shadow boundaries only where a boundary is a shadow one', () => {
    expect(passMarkers(pass)).toHaveLength(2);
    const shadowEnd: Pass = { ...pass, endReason: 'shadow' };
    expect(passMarkers(shadowEnd)).toHaveLength(4);
    const both: Pass = { ...pass, startReason: 'shadow', endReason: 'shadow' };
    expect(passMarkers(both)).toHaveLength(6);
  });

  it('places the now marker on the track at radius 1.03, and nowhere outside the pass', () => {
    expect(nowPoint(pass, undefined)).toBeNull();
    expect(nowPoint(pass, pass.start.t - 1)).toBeNull();
    expect(nowPoint(pass, pass.end.t + 1)).toBeNull();
    expect(nowPoint(pass, pass.peak.t)).toEqual(pass.peak);
    const mid = nowPoint(pass, pass.start.t + 5_000);
    if (!mid) throw new Error('expected a point');
    for (const v of everyVertex(nowMarker(mid))) expect(radius(v)).toBeCloseTo(NOW_MARKER_RADIUS, 9);
  });
});

describe('anchors', () => {
  it('put the eight compass names at their azimuths on the horizon, just outside the dome', () => {
    const anchors = compassAnchors();
    expect(anchors.map((a) => a.label)).toEqual(COMPASS.map((c) => c.label));
    for (const anchor of anchors) {
      expect(radius(anchor.at)).toBeCloseTo(COMPASS_LABEL_RADIUS, 9);
      const { azDeg, elDeg } = skyOf(anchor.at);
      expect(azDeg).toBeCloseTo(anchor.azDeg, 6);
      expect(elDeg).toBeCloseTo(0, 6);
    }
  });

  it('put the pass labels at the rise, peak and end points, outside the dome', () => {
    const anchors = passAnchors(pass);
    for (const [anchor, point] of [
      [anchors.rise, pass.start],
      [anchors.peak, pass.peak],
      [anchors.end, pass.end],
    ] as const) {
      expect(radius(anchor.at)).toBeGreaterThan(1.05);
      const { azDeg, elDeg } = skyOf(anchor.at);
      expect(azDeg).toBeCloseTo(point.azDeg, 6);
      expect(elDeg).toBeCloseTo(point.elDeg, 6);
    }
    expect(anchors.rise.id).toBe(`${pass.id}-rise`);
  });

  it('tells which side of the screen a point falls on: at rotY 0 east is right and west left; at rotY 90 north is right', () => {
    const east: Tuple3 = [0, 1, 0];
    const west: Tuple3 = [0, -1, 0];
    const north: Tuple3 = [-1, 0, 0];
    expect(screenSide(east, 0)).toBeGreaterThan(0.9);
    expect(screenSide(west, 0)).toBeLessThan(-0.9);
    expect(Math.abs(screenSide(north, 0))).toBeLessThan(1e-9);
    expect(screenSide(north, 90)).toBeGreaterThan(0.9);
  });
});
