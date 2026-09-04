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
  arrowhead,
  BOWL_RADIUS,
  COMPASS,
  COMPASS_LABEL_RADIUS,
  compassAnchors,
  diamond,
  glowStrength,
  gridPolygons,
  GROUND_RADIUS,
  groundDisc,
  horizonRing,
  horizonTicks,
  LABEL_SHIFT_MAX_DEG,
  LABELLED_TICK_HEIGHT_DEG,
  MARKER_RADIUS,
  meridian,
  NOW_MARKER_RADIUS,
  nowMarker,
  nowPoint,
  OBSERVER_MARK_RADIUS,
  observerMark,
  passAnchors,
  passMarkers,
  passStrip,
  projectToScreen,
  resolveLabels,
  RING_ELEVATIONS,
  ringAnchors,
  screenSide,
  skyBowl,
  stripAlong,
  sunDirection,
  sunGlow,
  TICK_HEIGHT_DEG,
  TICK_LABEL_RADIUS,
  tickAnchors,
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

  it('keeps the whole grid on the unit sphere — but for the observer mark at the centre — and the rings at their elevations', () => {
    for (const v of everyVertex(gridPolygons())) {
      const r = radius(v);
      expect(r).toBeCloseTo(r < 0.5 ? OBSERVER_MARK_RADIUS : 1, 9);
    }
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

  it('marks the peak and the arc end, and the shadow boundaries only where a boundary is a shadow one', () => {
    // Two windings each: the peak diamond and the FR-DOME-4 arrowhead.
    expect(passMarkers(pass)).toHaveLength(4);
    const shadowEnd: Pass = { ...pass, endReason: 'shadow' };
    expect(passMarkers(shadowEnd)).toHaveLength(6);
    const both: Pass = { ...pass, startReason: 'shadow', endReason: 'shadow' };
    expect(passMarkers(both)).toHaveLength(8);
  });

  it('points the arrowhead along the last leg of the arc, at the marker radius (FR-DOME-4)', () => {
    const [head] = arrowhead(pass);
    if (!head) throw new Error('no arrowhead');
    expect(head.vertices).toHaveLength(3);
    for (const v of head.vertices) expect(radius(v)).toBeCloseTo(MARKER_RADIUS, 9);
    const tip = head.vertices[0];
    if (!tip) throw new Error('no tip');
    // The tip leads the arc's end, in the direction the satellite is travelling.
    const points = resampleArc(pass.track, ARC_STEP_DEG);
    const end = points.at(-1);
    const before = points.at(-2);
    if (!end || !before) throw new Error('short track');
    const travel = end.azDeg - before.azDeg;
    expect(Math.sign(skyOf(tip).azDeg - end.azDeg)).toBe(Math.sign(travel));
    expect(arrowhead({ ...pass, track: pass.track.slice(0, 1) })).toEqual([]);
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

/* ---- R21 ---- */

describe('orientation detail (FR-DOME-3, FR-DOME-4)', () => {
  it('ticks the horizon every 10°, taller every 30°, and numbers those but not the cardinals', () => {
    const ticks = horizonTicks();
    expect(ticks).toHaveLength(36); // one quad per tick, 10° apart
    const heights = ticks.map((poly) => Math.max(...poly.vertices.map((v) => skyOf(v).elDeg)));
    const tall = heights.filter((h) => h > (TICK_HEIGHT_DEG + LABELLED_TICK_HEIGHT_DEG) / 2);
    expect(tall).toHaveLength(12);
    const numbers = tickAnchors();
    expect(numbers.map((a) => a.valueDeg)).toEqual([30, 60, 120, 150, 210, 240, 300, 330]);
    for (const anchor of numbers) {
      expect(radius(anchor.at)).toBeCloseTo(TICK_LABEL_RADIUS, 9);
      expect(skyOf(anchor.at).azDeg).toBeCloseTo(anchor.valueDeg, 6);
    }
  });

  it('labels the 30° and 60° rings on their own rings', () => {
    const anchors = ringAnchors();
    expect(anchors.map((a) => a.valueDeg)).toEqual([...RING_ELEVATIONS]);
    for (const anchor of anchors) expect(skyOf(anchor.at).elDeg).toBeCloseTo(anchor.valueDeg, 6);
  });

  it('marks the observer at the centre of the ground, above the ground disc and inside the dome', () => {
    const mark = observerMark();
    expect(mark.length).toBeGreaterThan(0);
    for (const v of everyVertex(mark)) {
      expect(radius(v)).toBeCloseTo(OBSERVER_MARK_RADIUS, 9);
      expect(v[2]).toBeGreaterThan(0);
      expect(v[2]).toBeLessThan(0.01);
    }
  });

  it('carries a colour on every polygon when one is given, and none when it is not (FR-DOME-2, FR-X-5)', () => {
    for (const poly of gridPolygons({ horizon: '#111111', rings: '#222222' })) expect(poly.color).toMatch(/^#(111111|222222)$/);
    for (const poly of gridPolygons()) expect(poly.color).toBeUndefined();
    for (const poly of passStrip(pass, { highlighted: true, color: '#333333' })) expect(poly.color).toBe('#333333');
    for (const poly of passMarkers(pass, { peak: '#444444', arrow: '#555555' })) expect(poly.color).toMatch(/^#(444444|555555)$/);
  });
});

describe('base layer (FR-DOME-3, FR-DOME-8a)', () => {
  it('draws the ground as an apron wider than the dome, below the horizon', () => {
    const disc = groundDisc('#161c24');
    expect(disc).toHaveLength(36);
    for (const poly of disc) {
      expect(poly.color).toBe('#161c24');
      for (const v of poly.vertices) {
        expect(v[2]).toBeLessThan(0);
        expect(Math.hypot(v[0], v[1])).toBeLessThanOrEqual(GROUND_RADIUS + 1e-9);
      }
    }
    expect(Math.max(...everyVertex(disc).map((v) => Math.hypot(v[0], v[1])))).toBeCloseTo(GROUND_RADIUS, 9);
  });

  it('draws the sky bowl just inside the line layer, from the horizon to the zenith', () => {
    const bowl = skyBowl();
    for (const v of everyVertex(bowl)) {
      expect(radius(v)).toBeCloseTo(BOWL_RADIUS, 9);
      expect(v[2]).toBeGreaterThanOrEqual(-1e-9);
    }
    expect(Math.max(...everyVertex(bowl).map((v) => skyOf(v).elDeg))).toBeCloseTo(90, 6);
  });

  it('grows the Sun glow from nothing at −18° to full at the horizon, at the Sun’s azimuth (FR-DOME-6)', () => {
    expect(glowStrength(-18)).toBe(0);
    expect(glowStrength(-30)).toBe(0);
    expect(glowStrength(0)).toBe(1);
    expect(glowStrength(2)).toBe(1);
    expect(glowStrength(-9)).toBeCloseTo(0.5, 9);
    expect(sunGlow({ azDeg: 285, altDeg: -18 })).toEqual([]);
    const low = sunGlow({ azDeg: 285, altDeg: -16 });
    const high = sunGlow({ azDeg: 285, altDeg: -2 });
    const spread = (polys: typeof low): number => {
      const azimuths = everyVertex(polys).map((v) => skyOf(v).azDeg);
      return Math.max(...azimuths) - Math.min(...azimuths);
    };
    expect(spread(high)).toBeGreaterThan(spread(low));
    const middle = everyVertex(high).map((v) => skyOf(v).azDeg);
    expect((Math.max(...middle) + Math.min(...middle)) / 2).toBeCloseTo(285, 6);
    expect(Math.max(...everyVertex(high).map((v) => skyOf(v).elDeg))).toBeGreaterThan(0);
  });

  it('points the key light at the Sun (FR-DOME-8a)', () => {
    const west = sunDirection({ azDeg: 270, altDeg: 0 });
    expect(west[1]).toBeCloseTo(-1, 9);
    const up = sunDirection({ azDeg: 0, altDeg: 90 });
    expect(up[2]).toBeCloseTo(1, 9);
  });
});

describe('label collisions (FR-DOME-3)', () => {
  const box = { halfWidth: 0.08, halfHeight: 0.05 };
  const camera = { rotYDeg: 0, tiltDeg: 45 };
  const request = (id: string, kind: 'compass' | 'peak' | 'rise' | 'end', azDeg: number, elDeg = 0) => ({ id, kind, azDeg, elDeg, radius: COMPASS_LABEL_RADIUS, ...box });

  it('projects a point the way the turntable draws it: the zenith is high, the far horizon is behind it', () => {
    expect(projectToScreen([0, 0, 1], { rotYDeg: 0, tiltDeg: 90 })).toEqual({ x: 0, y: 1 });
    // Facing north (rotY 0 stands south looking north) at a top-down camera, north is at the top of the drawing.
    expect(projectToScreen([-1, 0, 0], { rotYDeg: 0, tiltDeg: 0 }).y).toBeCloseTo(1, 9);
    expect(projectToScreen([1, 0, 0], { rotYDeg: 0, tiltDeg: 0 }).y).toBeCloseTo(-1, 9);
    expect(projectToScreen([0, 1, 0], { rotYDeg: 0, tiltDeg: 45 }).x).toBeCloseTo(1, 9);
  });

  it('leaves labels that do not collide where they are', () => {
    const placed = resolveLabels([request('a', 'compass', 90), request('b', 'peak', 270)], camera);
    expect(placed.map((label) => label.shiftedDeg)).toEqual([0, 0]);
    expect(placed.map((label) => label.id)).toEqual(['a', 'b']);
  });

  it('moves the later label along its ring, in the order compass, peak, rise, end', () => {
    const placed = resolveLabels([request('end', 'end', 90), request('rise', 'rise', 90), request('peak', 'peak', 90), request('compass', 'compass', 90)], camera);
    const by = (id: string) => placed.find((label) => label.id === id);
    expect(by('compass')?.shiftedDeg).toBe(0);
    for (const id of ['peak', 'rise', 'end']) expect(Math.abs(by(id)?.shiftedDeg ?? 0), id).toBeGreaterThan(0);
    // Each label takes the nearest offset still free, so a later one never lands closer to its place than an earlier one.
    const distance = (id: string): number => Math.abs(by(id)?.shiftedDeg ?? 0);
    expect(distance('peak')).toBeLessThanOrEqual(distance('rise'));
    expect(distance('rise')).toBeLessThanOrEqual(distance('end'));
    expect(new Set(placed.map((label) => label.azDeg)).size).toBe(4);
    // The order the caller gave is the order it gets back, so the scene never reorders under a collision.
    expect(placed.map((label) => label.id)).toEqual(['end', 'rise', 'peak', 'compass']);
  });

  it('keeps a moved label on its own ring and inside the shift limit', () => {
    const placed = resolveLabels([request('a', 'compass', 45, 30), request('b', 'peak', 45, 30)], camera);
    for (const label of placed) {
      expect(skyOf(label.at).elDeg).toBeCloseTo(30, 6);
      expect(radius(label.at)).toBeCloseTo(COMPASS_LABEL_RADIUS, 9);
      expect(Math.abs(label.shiftedDeg)).toBeLessThanOrEqual(LABEL_SHIFT_MAX_DEG);
    }
    expect(placed[1]?.azDeg).toBeCloseTo(45 + (placed[1]?.shiftedDeg ?? 0), 6);
  });

  it('gives way to the fixed degree numbers, and keeps its place when there is nowhere free', () => {
    const fixed = [{ at: tickAnchors()[0]?.at ?? ([0, 0, 0] as Tuple3), halfWidth: 0.08, halfHeight: 0.05 }];
    const onTop = resolveLabels([request('a', 'compass', 30)], camera, fixed);
    expect(onTop[0]?.shiftedDeg).not.toBe(0);
    // A ring crowded end to end: every offset collides, so the label stays where it belongs rather than vanishing.
    const crowded = Array.from({ length: 36 }, (_, i) => ({ at: [Math.cos(i * 10 * (Math.PI / 180)), Math.sin(i * 10 * (Math.PI / 180)), 0] as Tuple3, halfWidth: 1, halfHeight: 1 }));
    const stuck = resolveLabels([request('a', 'compass', 30)], camera, crowded);
    expect(stuck[0]?.shiftedDeg).toBe(0);
    expect(stuck[0]?.azDeg).toBe(30);
  });
});
