import { drawnMagLimit, drawnRungs } from './skyStars';

/**
 * FR-SKY-11, FR-SKY-12, FR-STAR-14 (R120, D-795): which bright star a pass's
 * peak passes, which figure a point is among, and how far a point is from a
 * figure's line. Pure, on the positions `skyStars.ts`'s `starsAt` produces and
 * the catalogue's figures; imported only by the `stars` chunk (FR-SKY-10).
 *
 * Distances are great-circle degrees on the observer's sky. A point is
 * `{ azDeg, altDeg }`, azimuth from north through east.
 */

export { drawnRungs };

/** The faintest a landmark may be: the ladder's third rung, the brightest `+` (FR-STAR-6). */
export const LANDMARK_MAG = 2.5;
/** The farthest a landmark may be from the peak, degrees: about a fist and a half at arm's length. */
export const LANDMARK_DEG = 12;
/** The altitude difference, degrees, from which the peak is `above` or `below` its landmark rather than `beside` it. */
export const LANDMARK_LEVEL_DEG = 2;
/** The farthest a figure's line may be from a point that is named among it, degrees. */
export const AMONG_MAX_DEG = 10;

export interface SkyPoint {
  azDeg: number;
  altDeg: number;
}

/** The stars as the scene has them: catalogue magnitudes beside one instant's positions, in catalogue order (brightest first, though nothing here needs the order). */
export interface LandmarkStars {
  mag: ArrayLike<number>;
  altDeg: ArrayLike<number>;
  azDeg: ArrayLike<number>;
}

export interface Landmark {
  /** The star's catalogue index. */
  index: number;
  /** Its distance from the peak, degrees. */
  sepDeg: number;
  /** The peak against the star: higher, lower, or level within `LANDMARK_LEVEL_DEG`. */
  word: 'above' | 'below' | 'beside';
}

/** One drawn feature, as `StarCatalog.figures` holds it: `segments` flat, `[a0, b0, a1, b1, …]`. */
export interface FigureLines {
  con: string;
  part: number;
  segments: ArrayLike<number>;
}

export interface Among {
  con: string;
  part: number;
  /** The nearest drawn line's distance from the point, degrees. */
  deg: number;
}

type Vec = [number, number, number];

const RAD = Math.PI / 180;

const vec = (azDeg: number, altDeg: number): Vec => {
  const az = azDeg * RAD;
  const alt = altDeg * RAD;
  return [Math.cos(alt) * Math.cos(az), Math.cos(alt) * Math.sin(az), Math.sin(alt)];
};

const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const norm = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);

/** The angle between two unit vectors, degrees, by `atan2` so it holds near 0° and 180°. */
const angleDeg = (a: Vec, b: Vec): number => Math.atan2(norm(cross(a, b)), dot(a, b)) / RAD;

const vecOf = (p: SkyPoint): Vec => vec(p.azDeg, p.altDeg);

/**
 * The great-circle distance from `p` to the shorter arc between `a` and `b`,
 * degrees: the perpendicular when its foot falls between the ends, else the
 * nearer end (FR-STAR-14's tap, FR-SKY-12's column).
 */
export function segmentDistanceDeg(p: SkyPoint, a: SkyPoint, b: SkyPoint): number {
  return segmentDistance(vecOf(p), vecOf(a), vecOf(b));
}

/** `segmentDistanceDeg` on unit vectors, so a caller can convert each star once. */
function segmentDistance(vp: Vec, va: Vec, vb: Vec): number {
  const n = cross(va, vb);
  const len = norm(n);
  const toEnd = Math.min(angleDeg(vp, va), angleDeg(vp, vb));
  if (len < 1e-12) return toEnd; // the ends coincide (or are antipodal): no one arc
  const u: Vec = [n[0] / len, n[1] / len, n[2] / len];
  // The foot is between the ends when p turns the same way from a as b does, and b the same way from p.
  if (dot(cross(va, vp), u) >= 0 && dot(cross(vp, vb), u) >= 0) return Math.abs(Math.asin(Math.max(-1, Math.min(1, dot(vp, u))))) / RAD;
  return toEnd;
}

/**
 * The landmark of a pass's peak (FR-SKY-11): among the stars at
 * `LANDMARK_MAG` or brighter that `rungs` drawn rungs show above the horizon,
 * the nearest within `LANDMARK_DEG`; ties go to the brighter. Planets are not
 * in `stars`, so never the landmark. `null` when there is none.
 */
export function landmark(stars: LandmarkStars, peak: SkyPoint, rungs: number): Landmark | null {
  const limit = Math.min(LANDMARK_MAG, drawnMagLimit(rungs));
  const at = vecOf(peak);
  let best: Landmark | null = null;
  let bestMag = Infinity;
  // Every star is looked at, so a subset or a reordered list gives the same answer as the catalogue's order.
  for (let i = 0; i < stars.mag.length; i += 1) {
    const mag = stars.mag[i] ?? NaN;
    if (!(mag <= limit)) continue;
    const altDeg = stars.altDeg[i] ?? NaN;
    if (!(altDeg >= 0)) continue; // below the horizon nothing is drawn (FR-STAR-6)
    const sepDeg = angleDeg(at, vec(stars.azDeg[i] ?? NaN, altDeg));
    if (!(sepDeg <= LANDMARK_DEG)) continue;
    if (best !== null && (sepDeg > best.sepDeg || (sepDeg === best.sepDeg && mag >= bestMag))) continue;
    const rise = peak.altDeg - altDeg;
    best = { index: i, sepDeg, word: rise >= LANDMARK_LEVEL_DEG ? 'above' : rise <= -LANDMARK_LEVEL_DEG ? 'below' : 'beside' };
    bestMag = mag;
  }
  return best;
}

/**
 * The figure a point is among (FR-SKY-12): the one with a drawn line nearest
 * the point, within `AMONG_MAX_DEG`, else `null`. Every line counts, the ones
 * under the horizon too: a rise is named by where the eye is sent. A tie goes
 * to the figure first in the catalogue.
 */
export function constellationAt(point: SkyPoint, figures: readonly FigureLines[], positions: Pick<LandmarkStars, 'altDeg' | 'azDeg'>): Among | null {
  // Stars are shared between segments and figures: each is turned into a vector once per call.
  const vectors = new Map<number, Vec>();
  const star = (k: number): Vec => {
    let v = vectors.get(k);
    if (v === undefined) {
      v = vec(positions.azDeg[k] ?? NaN, positions.altDeg[k] ?? NaN);
      vectors.set(k, v);
    }
    return v;
  };
  const at = vecOf(point);
  let best: Among | null = null;
  for (const f of figures) {
    for (let k = 0; k + 1 < f.segments.length; k += 2) {
      const deg = segmentDistance(at, star(f.segments[k] ?? -1), star(f.segments[k + 1] ?? -1));
      if (deg <= AMONG_MAX_DEG && (best === null || deg < best.deg)) best = { con: f.con, part: f.part, deg };
    }
  }
  return best;
}
