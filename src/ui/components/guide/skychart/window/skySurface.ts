import { HORIZON_BAND_DEG, HORIZON_STRENGTH } from '../../../../../data/stars/constants';
import { groundClipPath, lookDirection, project, ring, type Mat3, type Projected, type View } from './projection';

/**
 * R155 (FR-LOOK-1; V210-7; PLAN D-974): the horizon band, pure — over the
 * window's one surface (`--chart-sky-deep` at every Sun altitude since R214:
 * FR-DARK-1, D-1234) a band of `HORIZON_BAND_DEG` in altitude fades from
 * `--chart-horizon-glow` at the horizon to nothing at the band's top, so the
 * sky reads dark at the zenith and lighter at the horizon.
 *
 * **The band** is drawn with no filter, as `HORIZON_BAND_STEPS` strips: each
 * is the region between two altitude rings' closed images under the
 * projection (`groundClipPath`'s rule — the projection is stereographic, so a
 * ring is a closed curve on the plane wherever the camera points), filled
 * under `evenodd` at an alpha that steps down from `HORIZON_STRENGTH` × 0.5
 * at the horizon to nothing at `HORIZON_BAND_DEG`. Which side of a ring's
 * image is "inside" flips when the antipode of the look direction falls
 * inside a strip (D-770's reason: the point at infinity is the antipode), so
 * such a strip is drawn against the box, as the ground is. The strips are on
 * the sky side by construction, so they need no clip, and the ground fill and
 * the hatch sit over them unchanged.
 */

/** How many strips the band's gradient is drawn in: enough that the steps read as a fade at 15° of altitude, few enough to project per frame. */
export const HORIZON_BAND_STEPS = 5;
/** The band's rings are sampled every 3° of azimuth: a closed image of 121 points, the horizon's own is 181 at 2°. */
const BAND_RING_STEP_DEG = 3;
/** FR-LOOK-1: the band's alpha at the horizon. */
export const BAND_ALPHA_AT_HORIZON = HORIZON_STRENGTH * 0.5;

/** The `HORIZON_BAND_STEPS + 1` rings the strips run between, from the horizon up, sampled once. */
const RINGS = Array.from({ length: HORIZON_BAND_STEPS + 1 }, (_, k) => ring((k * HORIZON_BAND_DEG) / HORIZON_BAND_STEPS, BAND_RING_STEP_DEG));

export interface BandStrip {
  /** The strip's path, `evenodd`: the two rings' closed images, against the box where the antipode falls inside the strip. */
  d: string;
  /** The strip's fill alpha, the lower strip the stronger. */
  opacity: number;
}

const fmt = (n: number): string => n.toFixed(1);

/** Whether (`x`, `y`) is inside the polygon of `points` (the samples `groundClipPath` keeps), by the ray cast the tests use. */
export function insidePolygon(points: readonly Projected[], x: number, y: number): boolean {
  const kept = points.filter((p) => p.offAxisDeg <= 179.5 && Number.isFinite(p.x) && Number.isFinite(p.y));
  let inside = false;
  for (let i = 0, j = kept.length - 1; i < kept.length; j = i, i += 1) {
    const a = kept[i];
    const b = kept[j];
    if (!a || !b) continue;
    if (a.y > y !== b.y > y && x < a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

/** The alpha of strip `k` (0 at the horizon): a linear fade measured at the strip's middle. */
export const stripOpacity = (k: number): number => Math.round(BAND_ALPHA_AT_HORIZON * (1 - (k + 0.5) / HORIZON_BAND_STEPS) * 1000) / 1000;

/** The band for one rotation: `HORIZON_BAND_STEPS` strips, lowest first. */
export function horizonBand(rotation: Mat3, view: View): BandStrip[] {
  const projected = RINGS.map((points) => points.map((p) => project(rotation, p.azDeg, p.elDeg, view)));
  const images = projected.map(groundClipPath);
  const box = `M0 0H${fmt(view.width)}V${fmt(view.height)}H0Z`;
  const look = lookDirection(rotation);
  const stripDeg = HORIZON_BAND_DEG / HORIZON_BAND_STEPS;
  const strips: BandStrip[] = [];
  for (let k = 0; k < HORIZON_BAND_STEPS; k += 1) {
    const lower = projected[k] ?? [];
    const upper = projected[k + 1] ?? [];
    // A point of the strip on the look's azimuth: at least 90° from the antipode, so its image is finite and near.
    const probe = project(rotation, look.azDeg, (k + 0.5) * stripDeg, view);
    const flipped = insidePolygon(lower, probe.x, probe.y) === insidePolygon(upper, probe.x, probe.y);
    strips.push({ d: `${flipped ? box : ''}${images[k] ?? ''}${images[k + 1] ?? ''}`, opacity: stripOpacity(k) });
  }
  return strips;
}
