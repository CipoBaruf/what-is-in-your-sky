/**
 * R16 (FR-DOME-1..6, PLAN §8.7): the layered dome as two polygon lists — the
 * solid base layer (ground disc, shaded sky bowl, Sun glow) and the braille
 * wireframe line layer (horizon with ticks, altitude rings, meridians, pass
 * arcs with the flown part split off, markers, arrowhead) — plus the label
 * anchors. Pure: no React, no glyphcss, no clock.
 *
 * Built on the R15 strip machinery (`stripAlong`): a line is a thin strip of
 * quads on the unit sphere, because wireframe mode strokes every quad edge, so
 * the strip's half-width in degrees *is* the line weight (D-59). Everything
 * goes through `toDome` so the frame convention stays in `lib/skyGeometry`
 * (D-58).
 */
import { interpolateTrack, resampleArc, toDome, type Vec3 } from '../../src/lib/skyGeometry';
import type { Pass, PassPoint } from '../../src/model';
import type { DomePalette } from './palette';
import type { Params } from './params';

export type Tuple3 = [number, number, number];

export interface Poly {
  vertices: Tuple3[];
  color?: string;
}

export interface Anchor {
  id: string;
  at: Tuple3;
  label: string;
  /** Which FR-DOME-2 meaning colours the label. */
  meaning: keyof DomePalette;
  kind: 'compass' | 'ring' | 'pass' | 'body';
}

/** One `GlyphMesh` in a scene: a polygon list, optionally at its own detail (FR-DOME-8c). */
export interface Mesh {
  id: string;
  polygons: Poly[];
  density?: number;
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
  halfWidthDeg: number;
  radius?: number;
  closed?: boolean;
  omit?: (i: number, n: number) => boolean;
  color?: string;
}

/** A thin strip of quads along a polyline of unit vectors (R15 `domeGeometry.stripAlong`, with a colour). */
export function stripAlong(points: readonly Tuple3[], options: StripOptions): Poly[] {
  const { halfWidthDeg, radius = 1, closed = false, omit, color } = options;
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
    const poly: Poly = { vertices: [l0, r0, r1, l1] };
    if (color) poly.color = color;
    out.push(poly);
  }
  return out;
}

const dashed = (i: number): boolean => i % 2 === 1;

/** Tangent-plane frame at `p`: `e` along the local east-ish direction, `f = p × e`. */
function tangentFrame(p: Tuple3): [Tuple3, Tuple3] {
  let e = norm(cross([0, 0, 1], p));
  if (len(e) < 1e-6) e = [1, 0, 0];
  return [e, norm(cross(p, e))];
}

export const MARKER_RADIUS = 1.02;
export const NOW_MARKER_RADIUS = 1.03;
export const COMPASS_LABEL_RADIUS = 1.1;
export const PASS_LABEL_RADIUS = 1.06;
export const RISE_LABEL_RADIUS = 1.18;
export const ARC_STEP_DEG = 2;

/** A diamond around a sky point, both windings so it reads from any camera. */
export function diamond(point: { azDeg: number; elDeg: number }, sizeDeg: number, radius: number, color?: string): Poly[] {
  const p = tuple(toDome(point.azDeg, point.elDeg));
  const [e, f] = tangentFrame(p);
  const s = Math.sin(sizeDeg * DEG);
  const on = (v: Tuple3): Tuple3 => mul(norm(v), radius);
  const vertices: Tuple3[] = [on(add(p, mul(e, s))), on(add(p, mul(f, s))), on(sub(p, mul(e, s))), on(sub(p, mul(f, s)))];
  const poly: Poly = { vertices };
  if (color) poly.color = color;
  return [poly, { ...poly, vertices: [...vertices].reverse() }];
}

/** FR-DOME-4: an arrowhead at the arc's end, pointing along the direction of travel. */
export function arrowhead(track: readonly PassPoint[], sizeDeg: number, color?: string): Poly[] {
  const pts = resampleArc(track, ARC_STEP_DEG);
  const last = pts.at(-1);
  const before = pts.at(-2);
  if (!last || !before) return [];
  const tip = tuple(toDome(last.azDeg, last.elDeg));
  const back = tuple(toDome(before.azDeg, before.elDeg));
  const dir = norm(sub(tip, back));
  const side = norm(cross(tip, dir));
  const s = Math.sin(sizeDeg * DEG);
  const on = (v: Tuple3): Tuple3 => mul(norm(v), MARKER_RADIUS);
  const base = sub(tip, mul(dir, s * 1.6));
  const vertices: Tuple3[] = [on(add(tip, mul(dir, s * 0.6))), on(add(base, mul(side, s))), on(sub(base, mul(side, s)))];
  const poly: Poly = { vertices };
  if (color) poly.color = color;
  return [poly, { ...poly, vertices: [...vertices].reverse() }];
}

/** Where the satellite is at `now` (a fraction of the pass), or null. */
export function nowPointAt(pass: Pass, fraction: number): PassPoint | null {
  if (!(fraction >= 0) || fraction > 1) return null;
  return interpolateTrack(pass.track, pass.start.t + fraction * (pass.end.t - pass.start.t));
}

export const MERIDIAN_SETS: Record<string, readonly number[]> = {
  none: [],
  cardinal: [0, 90, 180, 270],
  eight: [0, 45, 90, 135, 180, 225, 270, 315],
  sixteen: [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5],
};

function ringPoints(elDeg: number, stepDeg = 5): Tuple3[] {
  const pts: Tuple3[] = [];
  for (let az = 0; az < 360; az += stepDeg) pts.push(tuple(toDome(az, elDeg)));
  return pts;
}

function meridianPoints(azDeg: number): Tuple3[] {
  const pts: Tuple3[] = [];
  for (let el = 0; el <= 90; el += 5) pts.push(tuple(toDome(azDeg, el)));
  return pts;
}

/** FR-DOME-4: a radial tick at the horizon, taller every 30°. */
function tick(azDeg: number, heightDeg: number, weight: number, color: string): Poly[] {
  return stripAlong([tuple(toDome(azDeg, 0)), tuple(toDome(azDeg, heightDeg))], { halfWidthDeg: weight, color });
}

export interface LineLayer {
  meshes: Mesh[];
  anchors: Anchor[];
}

const COMPASS: readonly { label: string; azDeg: number }[] = [
  { label: 'N', azDeg: 0 },
  { label: 'NE', azDeg: 45 },
  { label: 'E', azDeg: 90 },
  { label: 'SE', azDeg: 135 },
  { label: 'S', azDeg: 180 },
  { label: 'SW', azDeg: 225 },
  { label: 'W', azDeg: 270 },
  { label: 'NW', azDeg: 315 },
];

/** ⚊ a phase glyph for an illuminated fraction (FR-DOME-6; the real one is R22's job). */
export function moonGlyph(phase: number): string {
  const glyphs = ['○', '◔', '◑', '◕', '●'];
  return glyphs[Math.min(glyphs.length - 1, Math.max(0, Math.round(phase * (glyphs.length - 1))))] ?? '●';
}

export interface LineLayerInput {
  params: Params;
  palette: DomePalette;
  highlighted: Pass;
  others: readonly Pass[];
  /** Pulse phase 0–1; scales the live marker (FR-DOME-8d). */
  pulse: number;
  clock: (t: number) => string;
}

/**
 * The line layer: the fixed grid in one mesh (it never changes, so it can stay
 * in the shared `<pre>`), each pass in its own, and the highlighted pass split
 * into flown and remaining so FR-DOME-5's two colours are two meshes.
 */
export function lineLayer({ params, palette, highlighted, others, pulse, clock }: LineLayerInput): LineLayer {
  const meshes: Mesh[] = [];
  const anchors: Anchor[] = [];

  const grid: Poly[] = [...stripAlong(ringPoints(0), { halfWidthDeg: params.horizonWeight, closed: true, color: palette.horizon })];
  if (params.ticks) {
    for (let az = 0; az < 360; az += 10) grid.push(...tick(az, az % 30 === 0 ? 3.5 : 2, params.horizonWeight, palette.horizon));
    for (let az = 0; az < 360; az += 30) anchors.push({ id: `tick-${String(az)}`, at: tuple(toDome(az, 0), 1.04), label: `${String(az)}°`, meaning: 'rings', kind: 'ring' });
  }
  for (const el of [30, 60]) {
    grid.push(...stripAlong(ringPoints(el), { halfWidthDeg: params.ringWeight, closed: true, omit: dashed, color: palette.rings }));
    if (params.ringLabels) anchors.push({ id: `ring-${String(el)}`, at: tuple(toDome(315, el), 1.02), label: `${String(el)}°`, meaning: 'rings', kind: 'ring' });
  }
  for (const az of MERIDIAN_SETS[params.meridians] ?? []) {
    const cardinal = az % 90 === 0;
    grid.push(...stripAlong(meridianPoints(az), { halfWidthDeg: params.meridianWeight, color: palette.rings, ...(cardinal ? {} : { omit: dashed }) }));
  }
  meshes.push({ id: 'grid', polygons: grid });

  for (const [index, pass] of others.entries()) {
    const pts = resampleArc(pass.track, ARC_STEP_DEG).map((p) => tuple(toDome(p.azDeg, p.elDeg)));
    meshes.push({ id: `dim-${String(index)}`, polygons: stripAlong(pts, { halfWidthDeg: params.dimWeight, color: palette.dim }) });
    anchors.push({ id: `dim-label-${String(index)}`, at: tuple(toDome(pass.peak.azDeg, pass.peak.elDeg), PASS_LABEL_RADIUS), label: pass.name, meaning: 'dim', kind: 'pass' });
  }

  const track = resampleArc(highlighted.track, ARC_STEP_DEG);
  const current = nowPointAt(highlighted, params.now);
  const flownUntil = current === null ? -1 : track.findIndex((p) => p.t > current.t);
  const points = track.map((p) => tuple(toDome(p.azDeg, p.elDeg)));
  const arc = stripAlong(points, {
    halfWidthDeg: params.passWeight,
    color: palette.highlighted,
    omit: (i, n) => (flownUntil > 0 && i < flownUntil - 1) || (i >= Math.floor(n * 0.8) && (n - 1 - i) % 2 === 1),
  });
  meshes.push({ id: 'pass', polygons: arc, ...(params.passDensity > 1 ? { density: params.passDensity } : {}) });
  if (flownUntil > 0) {
    const flown = stripAlong(points.slice(0, flownUntil), { halfWidthDeg: params.passWeight, color: palette.flown });
    meshes.push({ id: 'flown', polygons: flown, ...(params.passDensity > 1 ? { density: params.passDensity } : {}) });
  }

  const markers: Poly[] = [...diamond(highlighted.peak, 1.5, MARKER_RADIUS, palette.peak)];
  if (highlighted.startReason === 'shadow') markers.push(...diamond(highlighted.start, 1.5, MARKER_RADIUS, palette.shadow));
  if (highlighted.endReason === 'shadow') markers.push(...diamond(highlighted.end, 1.5, MARKER_RADIUS, palette.shadow));
  markers.push(...arrowhead(highlighted.track, 1.8, palette.highlighted));
  meshes.push({ id: 'markers', polygons: markers });

  if (current) {
    // FR-DOME-8d: the pulse is the marker breathing between 1.6° and 2.6° of sky.
    const size = 2.1 + (params.pulse ? 0.5 * Math.sin(pulse * 2 * Math.PI) : -0.1);
    meshes.push({ id: 'now', polygons: diamond(current, size, NOW_MARKER_RADIUS, palette.now), ...(params.passDensity > 1 ? { density: params.passDensity } : {}) });
  }

  if (params.moon && params.moonAlt > 0) {
    meshes.push({ id: 'moon', polygons: diamond({ azDeg: params.moonAz, elDeg: params.moonAlt }, 2.2, MARKER_RADIUS, palette.moon) });
    anchors.push({ id: 'moon-label', at: tuple(toDome(params.moonAz, params.moonAlt), PASS_LABEL_RADIUS), label: `${moonGlyph(params.moonPhase)} Moon`, meaning: 'moon', kind: 'body' });
  }

  for (const { label, azDeg } of COMPASS) anchors.push({ id: `compass-${label}`, at: tuple(toDome(azDeg, 0), COMPASS_LABEL_RADIUS), label, meaning: 'compass', kind: 'compass' });

  anchors.push({ id: 'pass-rise', at: tuple(toDome(highlighted.start.azDeg, highlighted.start.elDeg), RISE_LABEL_RADIUS), label: params.timeLabels ? `${highlighted.name} ${clock(highlighted.start.t)}` : highlighted.name, meaning: 'highlighted', kind: 'pass' });
  anchors.push({ id: 'pass-peak', at: tuple(toDome(highlighted.peak.azDeg, highlighted.peak.elDeg), PASS_LABEL_RADIUS), label: params.timeLabels ? `${clock(highlighted.peak.t)} · max ${String(Math.round(highlighted.peak.elDeg))}°` : `max ${String(Math.round(highlighted.peak.elDeg))}°`, meaning: 'peak', kind: 'pass' });
  anchors.push({ id: 'pass-end', at: tuple(toDome(highlighted.end.azDeg, highlighted.end.elDeg), PASS_LABEL_RADIUS), label: params.timeLabels ? clock(highlighted.end.t) : '→', meaning: 'highlighted', kind: 'pass' });

  return { meshes, anchors };
}

/** FR-DOME-6: how wide and how bright the Sun glow is at a sun altitude (0 at −18°, full at 0°). */
export function glowStrength(sunAltDeg: number): number {
  if (sunAltDeg > 0) return 1;
  if (sunAltDeg < -18) return 0;
  return 1 - sunAltDeg / -18;
}

export interface BaseLayerInput {
  params: Params;
  palette: DomePalette;
}

/**
 * The base layer: the ground as an apron disc a little wider than the dome
 * (so it reads around the horizon rather than hiding behind the bowl), the sky
 * bowl just inside the line layer's radius, and the Sun glow as a patch on the
 * horizon at the Sun's azimuth.
 */
export function baseLayer({ params, palette }: BaseLayerInput): Poly[] {
  const out: Poly[] = [];
  const GROUND_RADIUS = 1.22;
  const BOWL_RADIUS = 0.985;
  if (params.ground) {
    const step = 10;
    for (let az = 0; az < 360; az += step) {
      const a0 = az * DEG;
      const a1 = (az + step) * DEG;
      // CCW seen from +z (up), so the disc faces the sky and takes the ambient fill.
      out.push({
        vertices: [
          [0, 0, -0.002],
          [Math.cos(a0) * GROUND_RADIUS, Math.sin(a0) * GROUND_RADIUS, -0.002],
          [Math.cos(a1) * GROUND_RADIUS, Math.sin(a1) * GROUND_RADIUS, -0.002],
        ],
        color: palette.ground,
      });
    }
  }
  if (params.bowl) {
    const azStep = 10;
    const elStep = 10;
    for (let az = 0; az < 360; az += azStep) {
      for (let el = 0; el < 90; el += elStep) {
        const p = (a: number, e: number): Tuple3 => tuple(toDome(a, Math.min(90, e)), BOWL_RADIUS);
        out.push({ vertices: [p(az, el), p(az + azStep, el), p(az + azStep, el + elStep), p(az, el + elStep)], color: palette.sky });
      }
    }
  }
  const strength = glowStrength(params.sunAlt);
  if (strength > 0) {
    const halfWidth = 12 + 28 * strength;
    const height = 6 + 18 * strength;
    const step = halfWidth / 4;
    for (let d = -halfWidth; d < halfWidth; d += step) {
      const p = (a: number, e: number): Tuple3 => tuple(toDome(params.sunAz + a, e), 0.995);
      out.push({ vertices: [p(d, 0), p(d + step, 0), p(d + step, height), p(d, height)], color: palette.sun });
    }
  }
  return out;
}

/** The unit vector toward the Sun, for the base layer's key light (FR-DOME-8a). */
export function sunDirection(params: Params): Tuple3 {
  return tuple(toDome(params.sunAz, params.sunAlt));
}
