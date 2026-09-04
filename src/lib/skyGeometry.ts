import type { ChartOrientation, PassPoint } from '../model';

/**
 * PLAN §8.1/§8.2 (R13): the az/el geometry both sky chart views share, so
 * the ASCII dome (R15) and the SVG polar chart cannot drift. Pure; time is a
 * parameter (D-15). Everything angular goes through `toDome`, so a sign flip
 * found in the glyphcss spike (PLAN §8.5) is a one-line change here.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

const DEG = Math.PI / 180;

export const CHART_ORIENTATIONS: readonly ChartOrientation[] = ['looking-up', 'map'];
/** FR-GUIDE-4: the polar chart defaults to the looking-up convention. */
export const DEFAULT_CHART_ORIENTATION: ChartOrientation = 'looking-up';

export function isChartOrientation(value: unknown): value is ChartOrientation {
  return typeof value === 'string' && (CHART_ORIENTATIONS as readonly string[]).includes(value);
}

/**
 * PLAN §8.2 as fixed by the R14 spike (D-58): the dome frame is glyphcss's.
 * Right-handed, Z up, unit radius, observer at the origin: x south, y east,
 * z up (north is −x), so azimuth increases clockwise seen from above. With
 * this frame glyphcss's turntable camera at `rotY = 0` stands south of the
 * observer looking north, east on the right, and `rotY = −azimuth` faces
 * any azimuth.
 */
export function toDome(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  return { x: -Math.cos(el) * Math.cos(az), y: Math.cos(el) * Math.sin(az), z: Math.sin(el) };
}

/** The inverse of `toDome` for a unit vector: azimuth in [0, 360), elevation in [−90, 90]. */
export function fromDome(v: Vec3): { azDeg: number; elDeg: number } {
  const elDeg = Math.asin(clamp(v.z, -1, 1)) / DEG;
  const azDeg = Math.atan2(v.y, -v.x) / DEG;
  return { azDeg: ((azDeg % 360) + 360) % 360, elDeg };
}

/**
 * FR-GUIDE-2b/4: the equidistant azimuthal projection of the polar chart.
 * Unit disc, horizon at radius 1, zenith at the centre; screen convention
 * (+x right, +y down) with north at the top. `looking-up` puts east on the
 * left (the sky as seen lying on your back), `map` puts east on the right.
 */
export function toPolar(azDeg: number, elDeg: number, orientation: ChartOrientation): Vec2 {
  const r = (90 - elDeg) / 90;
  const az = azDeg * DEG;
  const east = orientation === 'map' ? 1 : -1;
  return { x: east * r * Math.sin(az), y: -r * Math.cos(az) };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** The angle between two sky directions, in degrees. */
export function angularDistanceDeg(a: { azDeg: number; elDeg: number }, b: { azDeg: number; elDeg: number }): number {
  return Math.acos(clamp(dot(toDome(a.azDeg, a.elDeg), toDome(b.azDeg, b.elDeg)), -1, 1)) / DEG;
}

/** Great-circle interpolation between two sky directions; `f` in [0, 1]. */
function slerp(a: Vec3, b: Vec3, f: number): Vec3 {
  const omega = Math.acos(clamp(dot(a, b), -1, 1));
  if (omega < 1e-9) return a;
  const wa = Math.sin((1 - f) * omega) / Math.sin(omega);
  const wb = Math.sin(f * omega) / Math.sin(omega);
  return { x: wa * a.x + wb * b.x, y: wa * a.y + wb * b.y, z: wa * a.z + wb * b.z };
}

/** The point a fraction `f` of the way from `a` to `b`: along the great circle in the sky, linearly in time and range. */
export function interpolatePoint(a: PassPoint, b: PassPoint, f: number): PassPoint {
  if (f <= 0) return a;
  if (f >= 1) return b;
  const { azDeg, elDeg } = fromDome(slerp(toDome(a.azDeg, a.elDeg), toDome(b.azDeg, b.elDeg), f));
  return { t: Math.round(a.t + f * (b.t - a.t)), azDeg, elDeg, rangeKm: a.rangeKm + f * (b.rangeKm - a.rangeKm) };
}

/**
 * Where the satellite is at `t`, from the track's samples (which are in time
 * order). A sample's own time returns that sample; times outside the track
 * clamp to its ends. The track must not be empty.
 */
export function interpolateTrack(track: readonly PassPoint[], t: number): PassPoint {
  const first = track[0];
  if (!first) throw new Error('interpolateTrack: empty track');
  if (t <= first.t) return first;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    if (!a || !b) break;
    if (t === b.t) return b;
    if (t < b.t) return interpolatePoint(a, b, (t - a.t) / (b.t - a.t));
  }
  return track[track.length - 1] ?? first;
}

/** The index of the highest sample (the first one, if equal). */
export function trackPeakIndex(track: readonly PassPoint[]): number {
  let peak = 0;
  track.forEach((p, i) => {
    if (p.elDeg > (track[peak]?.elDeg ?? -Infinity)) peak = i;
  });
  return peak;
}

/**
 * The track resampled to about `stepDeg` of sky between consecutive points,
 * so both views draw a smooth arc whatever the sample cadence. The start,
 * the peak (highest sample) and the end are kept as the same objects; each
 * of the two legs is divided into equal angular steps along the sampled
 * polyline, so the spacing is `stepDeg` to within the leg's rounding.
 */
export function resampleArc(track: readonly PassPoint[], stepDeg: number): PassPoint[] {
  if (track.length < 2) return [...track];
  const peak = trackPeakIndex(track);
  const out: PassPoint[] = [];
  for (const [from, to] of [
    [0, peak],
    [peak, track.length - 1],
  ] as const) {
    const leg = track.slice(from, to + 1);
    const first = leg[0];
    if (!first) continue;
    if (out.length === 0) out.push(first);
    if (leg.length < 2) continue;
    const cumulative = [0];
    for (let i = 1; i < leg.length; i++) {
      const a = leg[i - 1];
      const b = leg[i];
      if (!a || !b) break;
      cumulative.push((cumulative[i - 1] ?? 0) + angularDistanceDeg(a, b));
    }
    const length = cumulative[cumulative.length - 1] ?? 0;
    const n = Math.max(1, Math.round(length / stepDeg));
    let segment = 1;
    for (let k = 1; k < n; k++) {
      const s = (k * length) / n;
      while (segment < leg.length - 1 && (cumulative[segment] ?? 0) < s) segment++;
      const a = leg[segment - 1];
      const b = leg[segment];
      const s0 = cumulative[segment - 1] ?? 0;
      const s1 = cumulative[segment] ?? s0;
      if (!a || !b) break;
      out.push(s1 > s0 ? interpolatePoint(a, b, (s - s0) / (s1 - s0)) : a);
    }
    const last = leg[leg.length - 1];
    if (last) out.push(last);
  }
  return out;
}

/**
 * FR-DOME-5 (R22): an arc cut at the instant `t` into the part already flown
 * and the part still to come, for the two views to draw in their two colours.
 * The cut point belongs to both halves, so the arc has no gap at the marker;
 * an instant before the arc leaves the whole of it to come and one after
 * leaves the whole of it flown. `points` must be in time order — the output of
 * `resampleArc`, whose samples carry the times they were interpolated at.
 */
export function splitArcAt(points: readonly PassPoint[], t: number | undefined): { flown: PassPoint[]; remaining: PassPoint[] } {
  const first = points[0];
  const last = points[points.length - 1];
  if (t === undefined || !first || !last || t <= first.t) return { flown: [], remaining: [...points] };
  if (t >= last.t) return { flown: [...points], remaining: [] };
  const cut = interpolateTrack(points, t);
  const before = points.filter((p) => p.t < cut.t);
  const after = points.filter((p) => p.t > cut.t);
  return { flown: [...before, cut], remaining: [cut, ...after] };
}
