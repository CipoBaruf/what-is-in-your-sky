/**
 * R14 spike (PLAN §8.3): the dome scene as glyphcss polygons, built through
 * `toDome` so the frame convention is one function. Throwaway: R15 lifts what
 * survives into `skychart/dome/domeGeometry.ts` with tests.
 */
import { interpolateTrack, resampleArc, toDome, type Vec3 } from '../src/lib/skyGeometry';
import type { Pass, PassPoint } from '../src/model';

export type Tuple3 = [number, number, number];
export interface Poly {
  vertices: Tuple3[];
  color?: string;
}
export interface Anchor {
  id: string;
  label: string;
  at: Tuple3;
}

const DEG = Math.PI / 180;
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
  /** Emit every quad in both windings so an interior camera sees it whatever the culling (spike item 4). */
  doubleSided?: boolean;
  color?: string;
}

/**
 * A thin strip of quads along a polyline of unit vectors on the sphere: each
 * quad joins the left and right offsets (along the tangent-plane normal to the
 * travel direction) of consecutive points. Winding is counter-clockwise seen
 * from outside the sphere, which is what glyphcss documents for `Polygon`.
 */
export function stripAlong(points: readonly Tuple3[], options: StripOptions): Poly[] {
  const { halfWidthDeg, radius = 1, closed = false, omit, doubleSided = false, color } = options;
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
    const l0 = left[i], r0 = right[i], l1 = left[j], r1 = right[j];
    if (!l0 || !r0 || !l1 || !r1) continue;
    const poly: Poly = { vertices: [l0, r0, r1, l1] };
    if (color) poly.color = color;
    out.push(poly);
    if (doubleSided) out.push({ ...poly, vertices: [l0, l1, r1, r0] });
  }
  return out;
}

const dashed = (i: number) => i % 2 === 1;

export function horizonRing(options: Partial<StripOptions> = {}): Poly[] {
  const pts: Tuple3[] = [];
  for (let az = 0; az < 360; az += 5) pts.push(tuple(toDome(az, 0)));
  return stripAlong(pts, { halfWidthDeg: 0.75, closed: true, ...options });
}

export function altitudeRing(elDeg: number, options: Partial<StripOptions> = {}): Poly[] {
  const pts: Tuple3[] = [];
  for (let az = 0; az < 360; az += 5) pts.push(tuple(toDome(az, elDeg)));
  return stripAlong(pts, { halfWidthDeg: 0.5, closed: true, omit: dashed, ...options });
}

export function meridian(azDeg: number, options: Partial<StripOptions> = {}): Poly[] {
  const pts: Tuple3[] = [];
  for (let el = 0; el <= 90; el += 5) pts.push(tuple(toDome(azDeg, el)));
  const cardinal = azDeg % 90 === 0;
  const base = { halfWidthDeg: 0.5, ...(cardinal ? {} : { omit: dashed }) };
  return stripAlong(pts, cardinal ? { ...base, ...options, omit: () => false } : { ...base, ...options });
}

export const ARC_STEP_DEG = 2;

/** The pass as a strip through the resampled track; the last fifth has every other quad omitted so the direction of travel reads. */
export function passStrip(pass: Pass, options: Partial<StripOptions> = {}): Poly[] {
  const pts = resampleArc(pass.track, ARC_STEP_DEG).map((p) => tuple(toDome(p.azDeg, p.elDeg)));
  return stripAlong(pts, {
    halfWidthDeg: 0.75,
    omit: (i, n) => i >= Math.floor(n * 0.8) && (n - 1 - i) % 2 === 1,
    ...options,
  });
}

/** Tangent-plane frame at `p`: `e` eastward-ish, `f = p × e`. */
function tangentFrame(p: Tuple3): [Tuple3, Tuple3] {
  let e = norm(cross([0, 0, 1], p));
  if (len(e) < 1e-6) e = [1, 0, 0];
  return [e, norm(cross(p, e))];
}

/** A diamond on the sphere around a sky point, at `radius` (1.02 by default: just outside the dome so it wins the raster). */
export function diamond(point: { azDeg: number; elDeg: number }, sizeDeg = 1.5, radius = 1.02, color?: string): Poly[] {
  const p = tuple(toDome(point.azDeg, point.elDeg));
  const [e, f] = tangentFrame(p);
  const s = Math.sin(sizeDeg * DEG);
  const c = mul(p, radius);
  const poly: Poly = { vertices: [add(c, mul(e, s)), add(c, mul(f, s)), sub(c, mul(e, s)), sub(c, mul(f, s))] };
  if (color) poly.color = color;
  return [poly, { ...poly, vertices: [...poly.vertices].reverse() }];
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

export function compassAnchors(radius = 1.08): Anchor[] {
  return COMPASS.map(({ label, azDeg }) => ({ id: `compass-${label}`, label, at: tuple(toDome(azDeg, 0), radius) }));
}

export function passAnchors(pass: Pass, riseLabel: string): Anchor[] {
  return [
    { id: `${pass.id}-rise`, label: riseLabel, at: tuple(toDome(pass.start.azDeg, pass.start.elDeg), 1.06) },
    { id: `${pass.id}-peak`, label: `max ${Math.round(pass.peak.elDeg)}°`, at: tuple(toDome(pass.peak.azDeg, pass.peak.elDeg), 1.06) },
    { id: `${pass.id}-end`, label: '→', at: tuple(toDome(pass.end.azDeg, pass.end.elDeg), 1.06) },
  ];
}

export function nowPoint(pass: Pass, now: number | undefined): PassPoint | null {
  if (now === undefined || now < pass.start.t || now > pass.end.t) return null;
  return interpolateTrack(pass.track, now);
}

export function zenithAnchor(): Anchor {
  return { id: 'zenith', label: 'zenith', at: [0, 0, 1.08] };
}
