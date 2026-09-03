import { interpolateTrack, resampleArc, toDome, type Vec3 } from '../../../../../lib/skyGeometry';
import type { Pass, PassPoint } from '../../../../../model';

/**
 * PLAN §8.3 (R15, from the R14 spike): the dome scene as polygon lists for
 * glyphcss, built through the one `toDome` function so the frame convention
 * (D-58: x south, y east, z up) lives in `lib/skyGeometry`. Pure: no React,
 * no glyphcss, no clock. Lines are thin strips of quads on the unit sphere
 * (wireframe mode strokes every quad edge, so a 0.05°-wide strip renders as
 * one stroke and the 1.5°-wide pass strip as a double dotted line, D-59);
 * dashes leave out every other quad; markers are diamonds at radius 1.02 so
 * they win the raster over the surface they sit on; labels are hotspot
 * anchors just outside the dome.
 */

/** glyphcss's `Vec3`: a plain tuple. */
export type Tuple3 = [number, number, number];

export interface Poly {
  vertices: Tuple3[];
}

export interface Anchor {
  id: string;
  at: Tuple3;
}

const DEG = Math.PI / 180;

/** Sky sample step along an arc (PLAN §8.3). */
export const ARC_STEP_DEG = 2;
/** Half-widths in degrees of sky (D-59). */
export const GRID_HALF_WIDTH_DEG = 0.05;
export const PASS_HALF_WIDTH_DEG = 0.75;
export const DIM_PASS_HALF_WIDTH_DEG = 0.05;
/** Marker diamonds sit just outside the dome (PLAN §8.3). */
export const MARKER_RADIUS = 1.02;
export const NOW_MARKER_RADIUS = 1.03;
export const MARKER_SIZE_DEG = 1.5;
export const NOW_MARKER_SIZE_DEG = 2;
/** Label anchors: compass names just outside the horizon, pass labels further out so they clear the compass. */
export const COMPASS_LABEL_RADIUS = 1.08;
export const PASS_LABEL_RADIUS = 1.06;
export const RISE_LABEL_RADIUS = 1.18;
/** The last fifth of a pass strip has every other quad left out, so the direction of travel reads. */
export const DIRECTION_GAP_FRACTION = 0.8;

const tuple = (p: Vec3, r = 1): Tuple3 => [p.x * r, p.y * r, p.z * r];
const sub = (a: Tuple3, b: Tuple3): Tuple3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Tuple3, b: Tuple3): Tuple3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Tuple3, s: number): Tuple3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Tuple3, b: Tuple3): Tuple3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Tuple3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Tuple3): Tuple3 => {
  const l = len(a);
  return l < 1e-12 ? [0, 0, 0] : mul(a, 1 / l);
};

export interface StripOptions {
  /** Half the strip width, in degrees of sky. */
  halfWidthDeg: number;
  radius?: number;
  closed?: boolean;
  /** Quads to leave out (dashes, direction gaps): called with the quad index and the quad count. */
  omit?: (i: number, n: number) => boolean;
}

/**
 * A thin strip of quads along a polyline of unit vectors on the sphere: each
 * quad joins the left and right offsets (along the tangent-plane normal to
 * the travel direction) of consecutive points, every vertex re-projected onto
 * the sphere of `radius`. Winding is counter-clockwise seen from outside.
 */
export function stripAlong(points: readonly Tuple3[], options: StripOptions): Poly[] {
  const { halfWidthDeg, radius = 1, closed = false, omit } = options;
  const n = points.length;
  if (n < 2) return [];
  const w = Math.sin(halfWidthDeg * DEG);
  const at = (i: number): Tuple3 => points[((i % n) + n) % n] ?? [0, 0, 0];
  const left: Tuple3[] = [];
  const right: Tuple3[] = [];
  for (let i = 0; i < n; i++) {
    const p = at(i);
    const prev = closed || i > 0 ? at(i - 1) : p;
    const next = closed || i < n - 1 ? at(i + 1) : p;
    const d = norm(sub(next, prev));
    const nrm = norm(cross(p, d));
    left.push(mul(norm(add(p, mul(nrm, w))), radius));
    right.push(mul(norm(sub(p, mul(nrm, w))), radius));
  }
  const quads = closed ? n : n - 1;
  const out: Poly[] = [];
  for (let i = 0; i < quads; i++) {
    if (omit?.(i, quads)) continue;
    const j = (i + 1) % n;
    const l0 = left[i];
    const r0 = right[i];
    const l1 = left[j];
    const r1 = right[j];
    if (!l0 || !r0 || !l1 || !r1) continue;
    out.push({ vertices: [l0, r0, r1, l1] });
  }
  return out;
}

const dashed = (i: number): boolean => i % 2 === 1;

/** The horizon: a closed strip at 0° elevation, 5° segments. */
export function horizonRing(): Poly[] {
  const pts: Tuple3[] = [];
  for (let az = 0; az < 360; az += 5) pts.push(tuple(toDome(az, 0)));
  return stripAlong(pts, { halfWidthDeg: GRID_HALF_WIDTH_DEG, closed: true });
}

/** A dashed altitude ring (30°, 60°). */
export function altitudeRing(elDeg: number): Poly[] {
  const pts: Tuple3[] = [];
  for (let az = 0; az < 360; az += 5) pts.push(tuple(toDome(az, elDeg)));
  return stripAlong(pts, { halfWidthDeg: GRID_HALF_WIDTH_DEG, closed: true, omit: dashed });
}

/** A meridian from the horizon to the zenith; the cardinal ones solid, the intercardinal ones dashed. */
export function meridian(azDeg: number): Poly[] {
  const pts: Tuple3[] = [];
  for (let el = 0; el <= 90; el += 5) pts.push(tuple(toDome(azDeg, el)));
  const cardinal = azDeg % 90 === 0;
  return stripAlong(pts, cardinal ? { halfWidthDeg: GRID_HALF_WIDTH_DEG } : { halfWidthDeg: GRID_HALF_WIDTH_DEG, omit: dashed });
}

export const MERIDIAN_AZIMUTHS: readonly number[] = [0, 45, 90, 135, 180, 225, 270, 315];

/** The whole fixed grid: horizon, the 30° and 60° rings, the eight meridians. */
export function gridPolygons(): Poly[] {
  return [...horizonRing(), ...altitudeRing(30), ...altitudeRing(60), ...MERIDIAN_AZIMUTHS.flatMap((az) => meridian(az))];
}

/** The pass as a strip through the resampled track, the last fifth gapped for the direction of travel. */
export function passStrip(pass: Pass, options: { highlighted: boolean }): Poly[] {
  const pts = resampleArc(pass.track, ARC_STEP_DEG).map((p) => tuple(toDome(p.azDeg, p.elDeg)));
  return stripAlong(pts, {
    halfWidthDeg: options.highlighted ? PASS_HALF_WIDTH_DEG : DIM_PASS_HALF_WIDTH_DEG,
    omit: (i, n) => i >= Math.floor(n * DIRECTION_GAP_FRACTION) && (n - 1 - i) % 2 === 1,
  });
}

/** Tangent-plane frame at `p`: `e` along the local east-ish direction, `f = p × e`. */
function tangentFrame(p: Tuple3): [Tuple3, Tuple3] {
  let e = norm(cross([0, 0, 1], p));
  if (len(e) < 1e-6) e = [1, 0, 0];
  return [e, norm(cross(p, e))];
}

/**
 * A diamond around a sky point, both windings so it reads from any camera,
 * every vertex on the sphere of `radius` (1.02 by default: just outside the
 * dome, so it wins the raster over the strip it marks).
 */
export function diamond(point: { azDeg: number; elDeg: number }, sizeDeg = MARKER_SIZE_DEG, radius = MARKER_RADIUS): Poly[] {
  const p = tuple(toDome(point.azDeg, point.elDeg));
  const [e, f] = tangentFrame(p);
  const s = Math.sin(sizeDeg * DEG);
  const on = (v: Tuple3): Tuple3 => mul(norm(v), radius);
  const vertices: Tuple3[] = [on(add(p, mul(e, s))), on(add(p, mul(f, s))), on(sub(p, mul(e, s))), on(sub(p, mul(f, s)))];
  return [{ vertices }, { vertices: [...vertices].reverse() }];
}

/** The peak marker, plus the shadow-entry and shadow-exit markers where a boundary is a shadow one. */
export function passMarkers(pass: Pass): Poly[] {
  const out = diamond(pass.peak);
  if (pass.startReason === 'shadow') out.push(...diamond(pass.start));
  if (pass.endReason === 'shadow') out.push(...diamond(pass.end));
  return out;
}

/** Where the satellite is at `now`, or null when `now` is outside the pass. */
export function nowPoint(pass: Pass, now: number | undefined): PassPoint | null {
  if (now === undefined || now < pass.start.t || now > pass.end.t) return null;
  return interpolateTrack(pass.track, now);
}

/** The current-position marker: a larger diamond a little further out than the peak's. */
export function nowMarker(point: { azDeg: number; elDeg: number }): Poly[] {
  return diamond(point, NOW_MARKER_SIZE_DEG, NOW_MARKER_RADIUS);
}

export const COMPASS: readonly { label: string; azDeg: number }[] = [
  { label: 'N', azDeg: 0 },
  { label: 'NE', azDeg: 45 },
  { label: 'E', azDeg: 90 },
  { label: 'SE', azDeg: 135 },
  { label: 'S', azDeg: 180 },
  { label: 'SW', azDeg: 225 },
  { label: 'W', azDeg: 270 },
  { label: 'NW', azDeg: 315 },
];

export interface CompassAnchor extends Anchor {
  label: string;
  azDeg: number;
}

/** Hotspot anchors for the eight compass names, just outside the horizon. */
export function compassAnchors(): CompassAnchor[] {
  return COMPASS.map(({ label, azDeg }) => ({ id: `compass-${label}`, label, azDeg, at: tuple(toDome(azDeg, 0), COMPASS_LABEL_RADIUS) }));
}

export interface PassAnchors {
  rise: Anchor;
  peak: Anchor;
  end: Anchor;
}

/** Hotspot anchors for a pass's labels: the name at the rise point, `max N°` at the peak, the direction arrow at the end. */
export function passAnchors(pass: Pass): PassAnchors {
  return {
    rise: { id: `${pass.id}-rise`, at: tuple(toDome(pass.start.azDeg, pass.start.elDeg), RISE_LABEL_RADIUS) },
    peak: { id: `${pass.id}-peak`, at: tuple(toDome(pass.peak.azDeg, pass.peak.elDeg), PASS_LABEL_RADIUS) },
    end: { id: `${pass.id}-end`, at: tuple(toDome(pass.end.azDeg, pass.end.elDeg), PASS_LABEL_RADIUS) },
  };
}

/**
 * Which side of the screen's centre line a world point projects to for a
 * camera turned by `rotY` (PLAN §8.2: at `rotY = 0` +y is on the right,
 * positive `rotY` turns the world clockwise on screen). Positive is right.
 * Used to run a label away from the drawing's edge.
 */
export function screenSide(at: Tuple3, rotYDeg: number): number {
  const theta = rotYDeg * DEG;
  return at[1] * Math.cos(theta) - at[0] * Math.sin(theta);
}
