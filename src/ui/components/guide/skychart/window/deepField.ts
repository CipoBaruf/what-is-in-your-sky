import { DEEP_NODE_POOL } from '../../../../../data/stars/constants';
import type { DeepCatalog } from '../../../../../data/stars/deepChunk';
import { drawableDeg, project, type Mat3, type View } from './projection';
import { applyFrame, equatorialVector, horizonOf } from './skyFrame';
import { collide, dotOpacity, dotRadiusPx, toneToken, type Point, type ToneToken } from './starGlyphs';

/**
 * R155 (FR-LOOK-8, FR-LOOK-9, FR-STAR-9 as amended; V210-9; PLAN D-974,
 * D-983): the deep stars through a pool. The deep catalogue
 * (`data/stars/deepChunk.ts`, every Yale star from 4.5 to 6.5 the bright
 * catalogue does not hold, brightest first) goes through the instant's
 * rotation once per positions object (`prepareDeep`, `skyFrame.ts`), and per
 * frame the stars to the field's magnitude (`fieldDetail.ts`'s row for the
 * `fov`) that are up, in front and in the box fill `DEEP_NODE_POOL`
 * `<circle>` nodes brightest first; the rest are not drawn, so the DOM never
 * grows with the catalogue. A deep star within the collision distance of a
 * drawn mark — a bright one or a deep one before it — is dropped, the
 * ladder's one rule. The field is culled before any projection by the angle
 * from the look direction (one dot product a star), so 7,000 stars cost a
 * frame a few thousand multiplications and a few hundred projections.
 *
 * Pure: the prepared columns and the frame's list; the nodes and their
 * writes are `StarField`'s.
 */

export interface PreparedDeep {
  size: number;
  /** Visual magnitude, brightest first. */
  mag: Float32Array;
  /** Earth-frame unit vectors at the instant (`skyVector`'s layout), one per star. */
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  azDeg: Float32Array;
  altDeg: Float32Array;
  /** Each star's mark, fixed by its magnitude and index. */
  r: Float32Array;
  opacity: Float32Array;
  tone: ToneToken[];
}

/** The deep catalogue at the instant behind `frame`: rotated once, with each star's dot ready. */
export function prepareDeep(deep: DeepCatalog, frame: Mat3): PreparedDeep {
  const n = deep.size;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const z = new Float32Array(n);
  const azDeg = new Float32Array(n);
  const altDeg = new Float32Array(n);
  const r = new Float32Array(n);
  const opacity = new Float32Array(n);
  const tone: ToneToken[] = [];
  for (let i = 0; i < n; i += 1) {
    const v = applyFrame(frame, equatorialVector(deep.ra[i] ?? 0, deep.dec[i] ?? 0));
    x[i] = v[0];
    y[i] = v[1];
    z[i] = v[2];
    const h = horizonOf(v);
    azDeg[i] = h.azDeg;
    altDeg[i] = h.altDeg;
    const mag = deep.mag[i] ?? Number.NaN;
    r[i] = dotRadiusPx(mag);
    opacity[i] = dotOpacity(mag);
    tone.push(toneToken(deep.bv[i]));
  }
  return { size: n, mag: Float32Array.from(deep.mag), x, y, z, azDeg, altDeg, r, opacity, tone };
}

/** How far into the (sorted) catalogue the stars to `magLimit` reach: one past the last at the limit or brighter. */
export function reachOf(mag: ArrayLike<number>, magLimit: number): number {
  let lo = 0;
  let hi = mag.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((mag[mid] ?? Number.POSITIVE_INFINITY) <= magLimit) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface DeepDrawn {
  /** The star's index in the deep catalogue. */
  index: number;
  x: number;
  y: number;
}

/** A dot is drawn while its centre is within this of the box, so it leaves the frame rather than winking out: the largest dot's radius. */
const EDGE_PX = 3;

/**
 * The deep stars one rotation draws, brightest first, at most `pool`: those to `magLimit`, up, within the drawable
 * field, in the box, and not within the collision distance of a mark in `kept` (the bright marks as drawn) or a
 * deep star before them.
 */
export function deepFrame(rotation: Mat3, view: View, deep: PreparedDeep, magLimit: number, kept: readonly Point[], pool = DEEP_NODE_POOL): DeepDrawn[] {
  const reach = reachOf(deep.mag, magLimit);
  if (reach === 0 || pool <= 0) return [];
  // The look direction as an earth-frame vector: a star whose angle from it is past the drawable field is skipped before any projection.
  const look = (() => {
    const lx = -rotation[0][2];
    const ly = -rotation[1][2];
    const lz = -rotation[2][2];
    return [lx, ly, lz] as const;
  })();
  const limit = drawableDeg(view);
  const cosLimit = Math.cos(Math.min(limit, 150) * (Math.PI / 180));
  const candidates: DeepDrawn[] = [];
  for (let i = 0; i < reach; i += 1) {
    if (!((deep.altDeg[i] ?? -1) >= 0)) continue;
    const along = (deep.x[i] ?? 0) * look[0] + (deep.y[i] ?? 0) * look[1] + (deep.z[i] ?? 0) * look[2];
    if (along < cosLimit) continue;
    const q = project(rotation, deep.azDeg[i] ?? 0, deep.altDeg[i] ?? 0, view);
    if (!q.front || q.x < -EDGE_PX || q.x > view.width + EDGE_PX || q.y < -EDGE_PX || q.y > view.height + EDGE_PX) continue;
    candidates.push({ index: i, x: q.x, y: q.y });
  }
  if (candidates.length === 0) return [];
  const survive = collide([...kept, ...candidates]);
  const drawn: DeepDrawn[] = [];
  for (let k = 0; k < candidates.length && drawn.length < pool; k += 1) {
    const candidate = candidates[k];
    if (survive[kept.length + k] && candidate) drawn.push(candidate);
  }
  return drawn;
}
