import { GLOBE_OPEN_ALT_DEG } from './constants';

/**
 * R167 (FR-GLOBE-2, FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-17; PLAN D-1036): the
 * celestial globe's geometry, ported from the spike's `globe.ts`
 * (`spike-stars-desktop`) without its mirror. Pure functions over J2000 unit
 * vectors; nothing here touches the DOM, a clock or the catalogue.
 *
 * The globe is the celestial sphere seen from outside under an orthographic
 * projection. A view is three orthonormal axes in J2000 equatorial
 * coordinates: `r` (screen right), `u` (screen up) and `c` (toward the
 * viewer). A direction `s` is on the near side when `s·c > 0` and lands at
 * `(s·r, s·u)` on the unit disc. Nothing flips x: seen from outside, the
 * figures are mirrored as on a brass globe (V212-3) — right ascension grows to
 * the right where, from the ground, east is to the left.
 */

export type Vec3 = readonly [number, number, number];

const RAD = Math.PI / 180;

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function normalize(a: Vec3): Vec3 {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
}

const clamp1 = (v: number): number => Math.max(-1, Math.min(1, v));

/** The unit vector of a J2000 right ascension and declination, degrees. */
export function radec(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * RAD;
  const dec = decDeg * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** A frame to turn the globe in: `pole` up, longitude 0 at `zero`, longitude growing toward `pole × zero`. The two are orthonormal. */
export interface Frame {
  pole: Vec3;
  zero: Vec3;
}

/** FR-GLOBE-5's "with the stars": the north celestial pole up, longitude the right ascension. */
export const EQUATORIAL: Frame = { pole: [0, 0, 1], zero: [1, 0, 0] };

/**
 * FR-GLOBE-5's "with you": the place's zenith up, longitude 0 at its north
 * point. Longitude grows toward `zenith × north`, which is west, so a
 * direction's azimuth is its longitude's negative.
 */
export function localFrame(zenith: Vec3, north: Vec3): Frame {
  return { pole: zenith, zero: north };
}

export interface ViewAxes {
  r: Vec3;
  u: Vec3;
  c: Vec3;
}

/**
 * The axes looking from outside at longitude `lonDeg`, latitude `latDeg` of
 * `frame`, the frame's pole up. Exact at ±90° too: up is then the meridian of
 * `lonDeg`, pointing away from it, as the limit of the latitudes below.
 */
export function viewAxes(frame: Frame, lonDeg: number, latDeg: number): ViewAxes {
  const lat = Math.max(-90, Math.min(90, latDeg)) * RAD;
  const lon = lonDeg * RAD;
  const q = cross(frame.pole, frame.zero);
  const h = add(scale(frame.zero, Math.cos(lon)), scale(q, Math.sin(lon)));
  const c = add(scale(h, Math.cos(lat)), scale(frame.pole, Math.sin(lat)));
  const u = add(scale(h, -Math.sin(lat)), scale(frame.pole, Math.cos(lat)));
  // u × c = q's turn by `lon`: screen right is the direction of growing longitude.
  return { r: cross(u, c), u, c };
}

/** Where the view looks and in which frame: the state a drag, a key and a frame switch write. */
export interface GlobeView {
  frame: Frame;
  /** The view centre's longitude in `frame`, degrees. */
  lon: number;
  /** The view centre's latitude in `frame`, degrees, in [−90, 90]. */
  lat: number;
}

/** One frame's projection: the view, its axes, the screen centre and the globe's radius in px. */
export interface Projector extends GlobeView {
  axes: ViewAxes;
  cx: number;
  cy: number;
  radius: number;
}

export function projector(view: GlobeView, cx: number, cy: number, radius: number): Projector {
  return { ...view, axes: viewAxes(view.frame, view.lon, view.lat), cx, cy, radius };
}

/** Screen x, y and depth (`> 0` on the near side) of `s`. No x flip: the true outside view (D-1036). */
export function project(p: Projector, s: Vec3): [number, number, number] {
  return [p.cx + p.radius * dot(s, p.axes.r), p.cy - p.radius * dot(s, p.axes.u), dot(s, p.axes.c)];
}

/** The near-side direction under a screen point; a point off the disc is taken to the rim. */
export function unproject(p: Projector, x: number, y: number): Vec3 {
  let sx = (x - p.cx) / p.radius;
  let sy = -(y - p.cy) / p.radius;
  const n = Math.hypot(sx, sy);
  if (n > 1) {
    sx /= n;
    sy /= n;
  }
  const sz = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
  const { r, u, c } = p.axes;
  return add(add(scale(r, sx), scale(u, sy)), scale(c, sz));
}

/** SVG path data for a polyline on the sphere, drawn only where it is on the near side (`depth > minDepth`). */
export function pathOf(p: Projector, points: readonly Vec3[], minDepth = 0): string {
  let d = '';
  let pen = false;
  for (const s of points) {
    const [x, y, z] = project(p, s);
    if (z > minDepth) {
      d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      pen = true;
    } else pen = false;
  }
  return d;
}

/**
 * FR-GLOBE-3: the near disc's part below the horizon whose pole is `zenith` —
 * the horizon's near half closed along the globe's rim through the side the
 * ground is on. Empty when the near side has no ground; the whole disc when it
 * is all ground.
 */
export function groundPath(p: Projector, zenith: Vec3, steps = 180): string {
  const zc = dot(zenith, p.axes.c);
  const zx = dot(zenith, p.axes.r);
  const zy = dot(zenith, p.axes.u);
  const R = p.radius.toFixed(1);
  const disc = `M${(p.cx - p.radius).toFixed(1)} ${p.cy.toFixed(1)}a${R} ${R} 0 1 0 ${(2 * p.radius).toFixed(1)} 0a${R} ${R} 0 1 0 ${(-2 * p.radius).toFixed(1)} 0Z`;
  if (Math.hypot(zx, zy) < 1e-4) return zc > 0 ? '' : disc;
  // The rim points where the horizon meets the limb, a quarter turn either side of the zenith's in-plane direction (y up).
  const base = Math.atan2(zy, zx);
  const a1 = base + Math.PI / 2;
  const a2 = base - Math.PI / 2;
  // The horizon's near half, in view coordinates: h = cos φ·e1 + sin φ·e2, both perpendicular to the zenith, e2 toward the viewer.
  const e1: Vec3 = [Math.cos(a1), Math.sin(a1), 0];
  const e2raw = cross([zx, zy, zc], e1);
  const e2 = normalize(e2raw[2] < 0 ? scale(e2raw, -1) : e2raw);
  const half = steps / 2;
  const pts: string[] = [];
  for (let i = 0; i <= half; i += 1) {
    const ph = (i / half) * Math.PI;
    const h = add(scale(e1, Math.cos(ph)), scale(e2, Math.sin(ph)));
    pts.push(`${(p.cx + p.radius * h[0]).toFixed(1)} ${(p.cy - p.radius * h[1]).toFixed(1)}`);
  }
  // Back from a2 to a1 along the rim, on the side away from the zenith.
  for (let i = 0; i <= half; i += 1) {
    const th = a2 - (i / half) * Math.PI;
    pts.push(`${(p.cx + p.radius * Math.cos(th)).toFixed(1)} ${(p.cy - p.radius * Math.sin(th)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** Points along the great circle whose pole is `pole`, `steps` of them, closed (first repeated last). */
export function greatCircle(pole: Vec3, steps = 180): Vec3[] {
  const helper: Vec3 = Math.abs(pole[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const a = normalize(cross(pole, helper));
  const b = cross(pole, a);
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const th = (i / steps) * 2 * Math.PI;
    out.push(add(scale(a, Math.cos(th)), scale(b, Math.sin(th))));
  }
  return out;
}

/** A parallel of declination `decDeg`, closed. */
export function parallel(decDeg: number, steps = 180): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i += 1) out.push(radec((i / steps) * 360, decDeg));
  return out;
}

/** A meridian of right ascension `raDeg`, pole to pole. */
export function meridian(raDeg: number, steps = 90): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i += 1) out.push(radec(raDeg, -90 + (i / steps) * 180));
  return out;
}

/** The ecliptic's pole in J2000 (obliquity 23.4393°). */
export const ECLIPTIC_POLE: Vec3 = radec(270, 90 - 23.4393);

/** A direction's longitude and latitude in `frame`, degrees; longitude in (−180, 180]. */
function lonLatIn(frame: Frame, s: Vec3): { lon: number; lat: number } {
  const q = cross(frame.pole, frame.zero);
  return { lon: Math.atan2(dot(s, q), dot(s, frame.zero)) / RAD, lat: Math.asin(clamp1(dot(s, frame.pole))) / RAD };
}

/** FR-GLOBE-5: the view centre `(lon, lat)` of frame `from` as longitude and latitude of frame `to`, so a frame switch keeps the centre. */
export function coordsIn(to: Frame, from: Frame, lon: number, lat: number): { lon: number; lat: number } {
  return lonLatIn(to, viewAxes(from, lon, lat).c);
}

/** `deg` moved by whole turns to within half a turn of `near`. */
function nearestTurn(deg: number, near: number): number {
  return deg - 360 * Math.round((deg - near) / 360);
}

/**
 * FR-GLOBE-6: the view's new longitude and latitude in `p`'s frame after a
 * drag from screen point `from` to `to`, so the direction grabbed at `from`
 * lands under `to`. The latitude is clamped to ±90°: the globe never turns
 * over its pole, and where the clamp binds the grabbed point lags the hand.
 *
 * In the view's own terms a direction at frame longitude λ and latitude φ has
 * screen x = cos φ·sin(λ − lon), whatever the latitude; so the longitude is
 * fixed by x alone, and the latitude is then the turn about screen right that
 * takes the direction's (depth, y) to the target's.
 */
export function dragTurn(p: Projector, from: readonly [number, number], to: readonly [number, number]): { lon: number; lat: number } {
  const g = lonLatIn(p.frame, unproject(p, from[0], from[1]));
  const target = unproject(p, to[0], to[1]);
  const tx = dot(target, p.axes.r);
  const ty = dot(target, p.axes.u);
  const tz = dot(target, p.axes.c);
  const cosPhi = Math.cos(g.lat * RAD);
  const sinPhi = Math.sin(g.lat * RAD);
  // A grabbed pole has no longitude to turn: the longitude stays, the latitude follows the hand.
  const first = cosPhi < 1e-9 ? 0 : Math.asin(clamp1(tx / cosPhi));
  const candidates = cosPhi < 1e-9 ? [(g.lon - p.lon) * RAD] : [first, Math.PI - first];
  let best: { lon: number; lat: number; cost: number } | null = null;
  for (const delta of candidates) {
    const a = cosPhi * Math.cos(delta);
    const latRaw = (Math.atan2(sinPhi, a) - Math.atan2(ty, tz)) / RAD;
    const latWrapped = nearestTurn(latRaw, 0);
    const lat = Math.max(-90, Math.min(90, latWrapped));
    const lon = nearestTurn(g.lon - delta / RAD, p.lon);
    // Prefer the solution the clamp leaves alone, then the one nearest the present view.
    const cost = Math.abs(lat - latWrapped) * 1000 + Math.abs(lon - p.lon) + Math.abs(lat - p.lat);
    if (!best || cost < best.cost) best = { lon, lat, cost };
  }
  return { lon: best?.lon ?? p.lon, lat: best?.lat ?? p.lat };
}

/**
 * D-1036: the opening view — in the place's local frame, toward the celestial
 * pole the place can see (south, longitude 180°, for a southern latitude;
 * north, longitude 0°, otherwise), `GLOBE_OPEN_ALT_DEG` above the horizon.
 */
export function openView(sky: { frame: Frame; lat: number }): GlobeView {
  return { frame: sky.frame, lon: sky.lat < 0 ? 180 : 0, lat: GLOBE_OPEN_ALT_DEG };
}
