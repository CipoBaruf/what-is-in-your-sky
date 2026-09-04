import { interpolateTrack, resampleArc, splitArcAt, toDome, type Vec3 } from '../../../../../lib/skyGeometry';
import type { MoonState, Pass, PassPoint } from '../../../../../model';
import { glowHalfWidthDeg, glowHeightDeg, glowStrength, moonVisible } from '../bodies';

/**
 * PLAN §8.3 / §8.7 (R15, extended by R21): the dome scene as polygon lists for
 * glyphcss, built through the one `toDome` function so the frame convention
 * (D-58: x south, y east, z up) lives in `lib/skyGeometry`. Pure: no React,
 * no glyphcss, no clock. Lines are thin strips of quads on the unit sphere
 * (wireframe mode strokes every quad edge, so a 0.05°-wide strip renders as
 * one stroke and the 0.75°-wide pass strip as a double dotted line, D-59);
 * dashes leave out every other quad; markers are diamonds at radius 1.02 so
 * they win the raster over the surface they sit on; labels are hotspot
 * anchors just outside the dome.
 *
 * R21 adds, from the R16 composition (D-92): a colour per polygon (FR-DOME-2,
 * the value comes from `palette.ts`, never from here), the base layer's
 * surfaces (ground disc, sky bowl, Sun glow — FR-DOME-3/8a), the orientation
 * detail of FR-DOME-4 (10° horizon ticks with a degree every 30°, labelled
 * altitude rings, an arrowhead at the arc's end), the observer's mark at the
 * centre of the ground (FR-DOME-3), and the label-collision resolution, which
 * is pure geometry and therefore unit-tested rather than eyeballed.
 */

/** glyphcss's `Vec3`: a plain tuple. */
export type Tuple3 = [number, number, number];

export interface Poly {
  vertices: Tuple3[];
  /** FR-DOME-2: the colour of this polygon, from `palette.ts`. Absent leaves it in the page's foreground (the monochrome reading). */
  color?: string;
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
export const ARROWHEAD_SIZE_DEG = 1.8;
/** Label anchors: compass names just outside the horizon, pass labels further out so they clear the compass. */
export const COMPASS_LABEL_RADIUS = 1.08;
export const PASS_LABEL_RADIUS = 1.06;
export const RISE_LABEL_RADIUS = 1.18;
/** FR-DOME-4: the degree numbers sit inside the compass names, the ring numbers just off their ring at the north-west. */
export const TICK_LABEL_RADIUS = 1.03;
export const RING_LABEL_RADIUS = 1.02;
export const RING_LABEL_AZ_DEG = 315;
/** Base layer (FR-DOME-8a, D-92): the ground reaches 1.1 radii, the sky bowl sits just inside the lines, the glow just inside the horizon ring. */
export const GROUND_RADIUS = 1.1;
export const GROUND_DEPTH = 0.002;
export const BOWL_RADIUS = 0.985;
export const GLOW_RADIUS = 0.995;
/** The base layer's surfaces are coarse on purpose: it is a wash, not a drawing (D-92). */
export const BASE_STEP_DEG = 10;
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
  /** FR-DOME-2: the colour every quad of this strip carries. */
  color?: string;
}

/**
 * A thin strip of quads along a polyline of unit vectors on the sphere: each
 * quad joins the left and right offsets (along the tangent-plane normal to
 * the travel direction) of consecutive points, every vertex re-projected onto
 * the sphere of `radius`. Winding is counter-clockwise seen from outside.
 */
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
    out.push(painted({ vertices: [l0, r0, r1, l1] }, color));
  }
  return out;
}

/** A polygon with its FR-DOME-2 colour, or without one where no palette is in force. */
const painted = (poly: Poly, color?: string): Poly => (color ? { ...poly, color } : poly);

const dashed = (i: number): boolean => i % 2 === 1;

/** The horizon: a closed strip at 0° elevation, 5° segments. */
export function horizonRing(color?: string): Poly[] {
  const pts: Tuple3[] = [];
  for (let az = 0; az < 360; az += 5) pts.push(tuple(toDome(az, 0)));
  return stripAlong(pts, { halfWidthDeg: GRID_HALF_WIDTH_DEG, closed: true, ...(color ? { color } : {}) });
}

/** A dashed altitude ring (30°, 60°). */
export function altitudeRing(elDeg: number, color?: string): Poly[] {
  const pts: Tuple3[] = [];
  for (let az = 0; az < 360; az += 5) pts.push(tuple(toDome(az, elDeg)));
  return stripAlong(pts, { halfWidthDeg: GRID_HALF_WIDTH_DEG, closed: true, omit: dashed, ...(color ? { color } : {}) });
}

/** A meridian from the horizon to the zenith; the cardinal ones solid, the intercardinal ones dashed. */
export function meridian(azDeg: number, color?: string): Poly[] {
  const pts: Tuple3[] = [];
  for (let el = 0; el <= 90; el += 5) pts.push(tuple(toDome(azDeg, el)));
  const cardinal = azDeg % 90 === 0;
  return stripAlong(pts, { halfWidthDeg: GRID_HALF_WIDTH_DEG, ...(cardinal ? {} : { omit: dashed }), ...(color ? { color } : {}) });
}

export const MERIDIAN_AZIMUTHS: readonly number[] = [0, 45, 90, 135, 180, 225, 270, 315];

/** FR-DOME-4: the labelled altitude rings, and the elevations the ticks number. */
export const RING_ELEVATIONS: readonly number[] = [30, 60];
export const TICK_STEP_DEG = 10;
export const TICK_LABEL_STEP_DEG = 30;
/** How far a tick rises off the horizon, in degrees of sky: taller where it is numbered. */
export const TICK_HEIGHT_DEG = 2;
export const LABELLED_TICK_HEIGHT_DEG = 3.5;
/** The observer's mark: a small cross on the ground at the centre of the dome, in dome radii. */
export const OBSERVER_MARK_RADIUS = 0.07;
export const OBSERVER_MARK_HEIGHT = 0.004;

/** FR-DOME-4: radial ticks every 10° of azimuth on the horizon, taller every 30°. */
export function horizonTicks(color?: string): Poly[] {
  const out: Poly[] = [];
  for (let az = 0; az < 360; az += TICK_STEP_DEG) {
    const height = az % TICK_LABEL_STEP_DEG === 0 ? LABELLED_TICK_HEIGHT_DEG : TICK_HEIGHT_DEG;
    out.push(...stripAlong([tuple(toDome(az, 0)), tuple(toDome(az, height))], { halfWidthDeg: GRID_HALF_WIDTH_DEG, ...(color ? { color } : {}) }));
  }
  return out;
}

/**
 * FR-DOME-3: where the observer stands — a small cross at the centre of the
 * ground, just above the base layer's disc so it reads against it. It is the
 * one mark that is not on the sphere: the dome is drawn around it.
 */
export function observerMark(color?: string): Poly[] {
  // `stripAlong` puts its vertices on a sphere of `radius`, so an arm is two opposite directions lifted a little off the ground plane.
  const lift = OBSERVER_MARK_HEIGHT / OBSERVER_MARK_RADIUS;
  const arm = (dx: number, dy: number): Tuple3[] => [
    [-dx, -dy, lift],
    [dx, dy, lift],
  ];
  const options = { halfWidthDeg: GRID_HALF_WIDTH_DEG, radius: OBSERVER_MARK_RADIUS, ...(color ? { color } : {}) };
  return [...stripAlong(arm(1, 0), options), ...stripAlong(arm(0, 1), options)];
}

export interface GridOptions {
  /** FR-DOME-2 colours; absent leaves the grid monochrome (R15's reading). */
  horizon?: string;
  rings?: string;
  /** FR-DOME-4 ticks. On by default (D-92). */
  ticks?: boolean;
}

/** The whole fixed grid: horizon with its ticks, the 30° and 60° rings, the eight meridians, the observer's mark. */
export function gridPolygons(options: GridOptions = {}): Poly[] {
  const { horizon, rings, ticks = true } = options;
  return [
    ...horizonRing(horizon),
    ...(ticks ? horizonTicks(horizon) : []),
    ...RING_ELEVATIONS.flatMap((el) => altitudeRing(el, rings)),
    ...MERIDIAN_AZIMUTHS.flatMap((az) => meridian(az, rings)),
    ...observerMark(horizon),
  ];
}

/** The pass as a strip through the resampled track, the last fifth gapped for the direction of travel. */
export function passStrip(pass: Pass, options: { highlighted: boolean; color?: string }): Poly[] {
  const pts = resampleArc(pass.track, ARC_STEP_DEG).map((p) => tuple(toDome(p.azDeg, p.elDeg)));
  return stripAlong(pts, {
    halfWidthDeg: options.highlighted ? PASS_HALF_WIDTH_DEG : DIM_PASS_HALF_WIDTH_DEG,
    omit: (i, n) => i >= Math.floor(n * DIRECTION_GAP_FRACTION) && (n - 1 - i) % 2 === 1,
    ...(options.color ? { color: options.color } : {}),
  });
}

/**
 * FR-DOME-5: the part of the arc the satellite has already flown at `now`,
 * drawn in the flown colour over the arc itself. A hair further out
 * (`FLOWN_RADIUS`) so it wins the raster where the two strips share a cell,
 * and it ends exactly under the live marker, which `splitArcAt` guarantees by
 * giving both halves the same cut point. Empty before the pass starts, which
 * is also what `now === undefined` means here.
 */
export const FLOWN_RADIUS = 1.004;

export function flownStrip(pass: Pass, now: number | undefined, options: { highlighted: boolean; color?: string } = { highlighted: true }): Poly[] {
  const { flown } = splitArcAt(resampleArc(pass.track, ARC_STEP_DEG), now);
  if (flown.length < 2) return [];
  return stripAlong(
    flown.map((p) => tuple(toDome(p.azDeg, p.elDeg))),
    {
      halfWidthDeg: options.highlighted ? PASS_HALF_WIDTH_DEG : DIM_PASS_HALF_WIDTH_DEG,
      radius: FLOWN_RADIUS,
      ...(options.color ? { color: options.color } : {}),
    },
  );
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
export function diamond(point: { azDeg: number; elDeg: number }, sizeDeg = MARKER_SIZE_DEG, radius = MARKER_RADIUS, color?: string): Poly[] {
  const p = tuple(toDome(point.azDeg, point.elDeg));
  const [e, f] = tangentFrame(p);
  const s = Math.sin(sizeDeg * DEG);
  const on = (v: Tuple3): Tuple3 => mul(norm(v), radius);
  const vertices: Tuple3[] = [on(add(p, mul(e, s))), on(add(p, mul(f, s))), on(sub(p, mul(e, s))), on(sub(p, mul(f, s)))];
  return [painted({ vertices }, color), painted({ vertices: [...vertices].reverse() }, color)];
}

/**
 * FR-DOME-4: the direction of travel as an arrowhead at the arc's end,
 * pointing along the last resampled segment. Two windings, like the markers,
 * so it reads from any camera.
 */
export function arrowhead(pass: Pass, sizeDeg = ARROWHEAD_SIZE_DEG, color?: string): Poly[] {
  const pts = resampleArc(pass.track, ARC_STEP_DEG);
  const last = pts.at(-1);
  const before = pts.at(-2);
  if (!last || !before) return [];
  const tip = tuple(toDome(last.azDeg, last.elDeg));
  const back = tuple(toDome(before.azDeg, before.elDeg));
  const dir = norm(sub(tip, back));
  if (len(dir) < 1e-9) return [];
  const side = norm(cross(tip, dir));
  const s = Math.sin(sizeDeg * DEG);
  const on = (v: Tuple3): Tuple3 => mul(norm(v), MARKER_RADIUS);
  const base = sub(tip, mul(dir, s * 1.6));
  const vertices: Tuple3[] = [on(add(tip, mul(dir, s * 0.6))), on(add(base, mul(side, s))), on(sub(base, mul(side, s)))];
  return [painted({ vertices }, color), painted({ vertices: [...vertices].reverse() }, color)];
}

export interface MarkerColors {
  peak?: string;
  shadow?: string;
  /** The arrowhead takes the arc's own colour. */
  arrow?: string;
}

/** The peak marker, the shadow markers where a boundary is a shadow one, and the arrowhead at the end (FR-DOME-4). */
export function passMarkers(pass: Pass, colors: MarkerColors = {}): Poly[] {
  const out = diamond(pass.peak, MARKER_SIZE_DEG, MARKER_RADIUS, colors.peak);
  if (pass.startReason === 'shadow') out.push(...diamond(pass.start, MARKER_SIZE_DEG, MARKER_RADIUS, colors.shadow));
  if (pass.endReason === 'shadow') out.push(...diamond(pass.end, MARKER_SIZE_DEG, MARKER_RADIUS, colors.shadow));
  out.push(...arrowhead(pass, ARROWHEAD_SIZE_DEG, colors.arrow));
  return out;
}

/** Where the satellite is at `now`, or null when `now` is outside the pass. */
export function nowPoint(pass: Pass, now: number | undefined): PassPoint | null {
  if (now === undefined || now < pass.start.t || now > pass.end.t) return null;
  return interpolateTrack(pass.track, now);
}

/** The current-position marker: a larger diamond a little further out than the peak's. */
export function nowMarker(point: { azDeg: number; elDeg: number }, color?: string): Poly[] {
  return diamond(point, NOW_MARKER_SIZE_DEG, NOW_MARKER_RADIUS, color);
}

/** FR-DOME-6: the Moon's disc, and how far above it its label sits. */
export const MOON_MARKER_SIZE_DEG = 2.5;
export const MOON_LABEL_OFFSET_DEG = 5;
const MOON_RING_STEP_DEG = 30;

/**
 * A small circle of angular radius `sizeDeg` around a sky point: the outline
 * of a disc, drawn as a closed strip so the wireframe strokes it once.
 */
export function circleAround(point: { azDeg: number; elDeg: number }, sizeDeg: number, radius = MARKER_RADIUS, color?: string): Poly[] {
  const p = tuple(toDome(point.azDeg, point.elDeg));
  const [e, f] = tangentFrame(p);
  const s = Math.sin(sizeDeg * DEG);
  const pts: Tuple3[] = [];
  for (let a = 0; a < 360; a += MOON_RING_STEP_DEG) {
    const th = a * DEG;
    pts.push(mul(norm(add(p, add(mul(e, s * Math.cos(th)), mul(f, s * Math.sin(th))))), radius));
  }
  return stripAlong(pts, { halfWidthDeg: GRID_HALF_WIDTH_DEG, radius, closed: true, ...(color ? { color } : {}) });
}

/**
 * FR-DOME-6: the Moon as a disc at its own place in the sky, drawn only while
 * it is above the horizon. A circle rather than a diamond, so it is not read
 * as one more pass marker; the phase is carried by the label's glyph, which is
 * where a shape the raster can render it at survives (`../bodies`).
 */
export function moonMarker(moon: Pick<MoonState, 'azDeg' | 'elDeg'>, color?: string): Poly[] {
  if (!moonVisible(moon)) return [];
  return circleAround(moon, MOON_MARKER_SIZE_DEG, MARKER_RADIUS, color);
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

/**
 * Where a world point lands on the drawing, in world units, for the
 * orthographic turntable of PLAN §8.2: `rotY` turns the world clockwise on
 * screen and `rotX` tilts from top-down (0°) to horizontal (90°). `x` is
 * `screenSide`; at a horizontal camera `y` is the point's height, and at a
 * top-down one it is how far it lies beyond the observer in the direction the
 * camera faces. Multiplying by the scene's `zoom` gives CSS pixels.
 */
export function projectToScreen(at: Tuple3, camera: { rotYDeg: number; tiltDeg: number }): { x: number; y: number } {
  const theta = camera.rotYDeg * DEG;
  const phi = camera.tiltDeg * DEG;
  const depth = at[0] * Math.cos(theta) + at[1] * Math.sin(theta);
  return { x: screenSide(at, camera.rotYDeg), y: at[2] * Math.sin(phi) - depth * Math.cos(phi) };
}

/* ---- FR-DOME-3: labels that do not overlap ---- */

/**
 * The fixed resolution order of FR-DOME-3: the compass names win, then the
 * peak, the rise and the end labels. R22 adds the Sun's and the Moon's names
 * (FR-DOME-6) at the end of it: the passes are what the drawing is about and
 * the two bodies are the context they are seen against, so a body's name is
 * the one that moves when the two want the same place.
 */
export const LABEL_ORDER = ['compass', 'peak', 'rise', 'end', 'sun', 'moon'] as const;
export type LabelKind = (typeof LABEL_ORDER)[number];
/** How far along its ring a label may move, and in what steps (degrees of azimuth). */
export const LABEL_SHIFT_STEP_DEG = 5;
export const LABEL_SHIFT_MAX_DEG = 45;

export interface LabelBox {
  /** Half-width and half-height of the label on the drawing, in world units (CSS pixels ÷ the scene's zoom). */
  halfWidth: number;
  halfHeight: number;
}

export interface LabelRequest extends LabelBox {
  id: string;
  kind: LabelKind;
  /** Where the label wants to sit: its own point in the sky, and the radius its anchor sits at. */
  azDeg: number;
  elDeg: number;
  radius: number;
}

export interface PlacedLabel extends LabelBox {
  id: string;
  kind: LabelKind;
  at: Tuple3;
  azDeg: number;
  /** How far the label had to move along its ring, signed, in degrees of azimuth; 0 where it kept its place. */
  shiftedDeg: number;
}

const anchorAt = (azDeg: number, elDeg: number, radius: number): Tuple3 => tuple(toDome(azDeg, elDeg), radius);

interface ScreenBox extends LabelBox {
  x: number;
  y: number;
}

const overlaps = (a: ScreenBox, b: ScreenBox): boolean => Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth && Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight;

/** The offsets a label tries, in order: its own place first, then alternating sides, further and further along its ring. */
function shifts(): number[] {
  const out = [0];
  for (let d = LABEL_SHIFT_STEP_DEG; d <= LABEL_SHIFT_MAX_DEG; d += LABEL_SHIFT_STEP_DEG) out.push(d, -d);
  return out;
}

/**
 * FR-DOME-3: labels placed so none overlaps another, in the fixed order
 * compass, peak, rise, end. A label that would collide moves *along its ring*
 * — the same elevation, a different azimuth — which keeps it attached to the
 * thing it names; the first free offset wins, and a label with nowhere to go
 * stays where it was rather than disappearing. `fixed` are the labels that
 * never move (the ring and tick numbers of FR-DOME-4).
 *
 * Pure, and the reason it is here rather than in the component: it is
 * geometry, so it is unit-tested rather than eyeballed.
 */
export function resolveLabels(requests: readonly LabelRequest[], camera: { rotYDeg: number; tiltDeg: number }, fixed: readonly { at: Tuple3; halfWidth: number; halfHeight: number }[] = []): PlacedLabel[] {
  const taken: ScreenBox[] = fixed.map((box) => ({ ...projectToScreen(box.at, camera), halfWidth: box.halfWidth, halfHeight: box.halfHeight }));
  const ordered = [...requests].sort((a, b) => LABEL_ORDER.indexOf(a.kind) - LABEL_ORDER.indexOf(b.kind));
  const placed: PlacedLabel[] = [];
  for (const request of ordered) {
    let chosen: { shiftedDeg: number; box: ScreenBox } | null = null;
    for (const shift of shifts()) {
      const at = anchorAt(request.azDeg + shift, request.elDeg, request.radius);
      const box: ScreenBox = { ...projectToScreen(at, camera), halfWidth: request.halfWidth, halfHeight: request.halfHeight };
      if (taken.some((other) => overlaps(box, other))) continue;
      chosen = { shiftedDeg: shift, box };
      break;
    }
    const shiftedDeg = chosen?.shiftedDeg ?? 0;
    const at = anchorAt(request.azDeg + shiftedDeg, request.elDeg, request.radius);
    taken.push(chosen?.box ?? { ...projectToScreen(at, camera), halfWidth: request.halfWidth, halfHeight: request.halfHeight });
    placed.push({ id: request.id, kind: request.kind, at, azDeg: normalizeAz(request.azDeg + shiftedDeg), shiftedDeg, halfWidth: request.halfWidth, halfHeight: request.halfHeight });
  }
  // Back in the order the caller gave them, so the scene's mesh order never depends on the resolution.
  return requests.map((request) => placed.find((label) => label.id === request.id)).filter((label): label is PlacedLabel => label !== undefined);
}

const normalizeAz = (azDeg: number): number => ((azDeg % 360) + 360) % 360;

/* ---- FR-DOME-4: the numbers around the drawing ---- */

export interface DegreeAnchor extends Anchor {
  /** The number the label carries, in whole degrees. */
  valueDeg: number;
}

/** FR-DOME-4: the degree number every 30° of azimuth, except at the four cardinals, whose compass name already says it. */
export function tickAnchors(): DegreeAnchor[] {
  const out: DegreeAnchor[] = [];
  for (let az = 0; az < 360; az += TICK_LABEL_STEP_DEG) {
    if (az % 90 === 0) continue;
    out.push({ id: `tick-${String(az)}`, valueDeg: az, at: anchorAt(az, 0, TICK_LABEL_RADIUS) });
  }
  return out;
}

/** FR-DOME-4: the 30° and 60° rings labelled, at the north-west of the drawing where no pass label starts. */
export function ringAnchors(): DegreeAnchor[] {
  return RING_ELEVATIONS.map((el) => ({ id: `ring-${String(el)}`, valueDeg: el, at: anchorAt(RING_LABEL_AZ_DEG, el, RING_LABEL_RADIUS) }));
}

/* ---- FR-DOME-3 / FR-DOME-8a: the base layer's surfaces ---- */

/** FR-DOME-3: the ground below the horizon, an apron a little wider than the dome so it reads all around it (D-92: 1.1 radii). */
export function groundDisc(color?: string, radius = GROUND_RADIUS): Poly[] {
  const out: Poly[] = [];
  for (let az = 0; az < 360; az += BASE_STEP_DEG) {
    const a0 = az * DEG;
    const a1 = (az + BASE_STEP_DEG) * DEG;
    // Counter-clockwise seen from above, so the disc faces the sky and takes the ambient fill.
    out.push(
      painted(
        {
          vertices: [
            [0, 0, -GROUND_DEPTH],
            [Math.cos(a0) * radius, Math.sin(a0) * radius, -GROUND_DEPTH],
            [Math.cos(a1) * radius, Math.sin(a1) * radius, -GROUND_DEPTH],
          ],
        },
        color,
      ),
    );
  }
  return out;
}

/** FR-DOME-8a: the sky as a bowl just inside the line layer, shaded by the scene's lights from the horizon to the zenith. */
export function skyBowl(color?: string): Poly[] {
  const out: Poly[] = [];
  for (let az = 0; az < 360; az += BASE_STEP_DEG) {
    for (let el = 0; el < 90; el += BASE_STEP_DEG) {
      const p = (a: number, e: number): Tuple3 => tuple(toDome(a, Math.min(90, e)), BOWL_RADIUS);
      out.push(painted({ vertices: [p(az, el), p(az + BASE_STEP_DEG, el), p(az + BASE_STEP_DEG, el + BASE_STEP_DEG), p(az, el + BASE_STEP_DEG)] }, color));
    }
  }
  return out;
}

/** FR-DOME-6's ramp, shared with the polar view (`../bodies`) so both draw one Sun. */
export { glowStrength };

/** FR-DOME-6: the Sun as a patch of light on the horizon ring at its azimuth, wider and taller the closer it is to rising. */
export function sunGlow(sun: { azDeg: number; altDeg: number }, color?: string): Poly[] {
  const strength = glowStrength(sun.altDeg);
  if (strength <= 0) return [];
  const halfWidth = glowHalfWidthDeg(strength);
  const height = glowHeightDeg(strength);
  const step = halfWidth / 4;
  const out: Poly[] = [];
  for (let d = -halfWidth; d < halfWidth; d += step) {
    const p = (a: number, e: number): Tuple3 => tuple(toDome(sun.azDeg + a, e), GLOW_RADIUS);
    out.push(painted({ vertices: [p(d, 0), p(d + step, 0), p(d + step, height), p(d, height)] }, color));
  }
  return out;
}

/** FR-DOME-8a: the unit vector toward the Sun, which the base scene's key light points along so twilight brightens the right side of the sky. */
export function sunDirection(sun: { azDeg: number; altDeg: number }): Tuple3 {
  return tuple(toDome(sun.azDeg, sun.altDeg));
}
