import { MILKY_WAY_BANDS_DEG, MILKY_WAY_STRENGTH } from '../../../../../data/stars/constants';
import { groundClipPath, lookDirection, project, skyVector, type Mat3, type View } from './projection';
import { applyFrame, equatorialVector, horizonOf, unapplyFrame } from './skyFrame';

/**
 * R155 (FR-LOOK-3; V210-7; PLAN D-974, D-983): the Milky Way as a haze. The
 * build writes `milkyWay.json` (R154, D-977): for each half-width of
 * `MILKY_WAY_BANDS_DEG` one closed ring of `[ra, dec]` — along +b once round
 * from the anticentre and back along −b, the core widened — and the scene
 * carries the three rings with the catalogue. The window draws each as one
 * filled path in `--chart-haze` at its alpha × `MILKY_WAY_STRENGTH`, under
 * the figures and over the surface, clipped to the sky side of the horizon by
 * the field's own clip; the three stack, so the plane reads darkest at its
 * middle and the core widest. No blur filter (a phone pays for one every
 * frame).
 *
 * The rings go through the instant's rotation once (`prepareHaze`, per
 * positions object, through `skyFrame.ts`), and per frame each point is
 * projected whole, as the horizon is for the ground clip: the projection is
 * stereographic, so a closed ring on the sphere is a closed curve on the
 * plane and the SVG clips it at the box. The one case that needs care is
 * D-770's: when the antipode of the look direction lies inside a band, the
 * band's image is the plane *outside* the drawn curve, so that band is drawn
 * against the box under `evenodd` — decided per frame by the antipode's
 * galactic latitude against the band's half-width at its longitude, the
 * build's own rule.
 *
 * Pure: the paths and their alphas; the nodes are `StarField`'s.
 */

/** FR-LOOK-3: the three bands' alphas before `MILKY_WAY_STRENGTH`, outermost first. */
export const HAZE_ALPHAS: readonly number[] = [0.03, 0.04, 0.05];

/** The IAU 1958 galactic frame in J2000, the build's numbers (`scripts/build-stars.ts`'s `GALACTIC_POLE`; `milkyWay.test.ts` holds them equal). */
export const GALACTIC_POLE = { raDeg: 192.85948, decDeg: 27.12825, lNcpDeg: 122.93192 } as const;
/** The core's widening, the build's (`MILKY_WAY_CORE`): each half-width grows by `widenDeg` × exp(−(l / `scaleDeg`)²). */
export const MILKY_WAY_CORE = { widenDeg: 3, scaleDeg: 55 } as const;

const RAD = Math.PI / 180;

/** J2000 right ascension and declination to galactic longitude and latitude, degrees: the inverse of the build's `galacticToEquatorial`. */
export function galacticOf(raDeg: number, decDeg: number): { lDeg: number; bDeg: number } {
  const { raDeg: raGp, decDeg: decGp, lNcpDeg } = GALACTIC_POLE;
  const dec = decDeg * RAD;
  const dra = (raDeg - raGp) * RAD;
  const sinB = Math.sin(dec) * Math.sin(decGp * RAD) + Math.cos(dec) * Math.cos(decGp * RAD) * Math.cos(dra);
  const y = Math.cos(dec) * Math.sin(dra);
  const x = Math.sin(dec) * Math.cos(decGp * RAD) - Math.cos(dec) * Math.sin(decGp * RAD) * Math.cos(dra);
  const l = (((lNcpDeg - Math.atan2(y, x) / RAD) % 360) + 360) % 360;
  return { lDeg: l, bDeg: Math.asin(Math.max(-1, Math.min(1, sinB))) / RAD };
}

/** A longitude as its distance from the galactic centre, in (−180, 180]. */
const fromCentre = (lDeg: number): number => ((((lDeg + 180) % 360) + 360) % 360) - 180;

/** Band `k`'s half-width at longitude `lDeg`, the build's rule. */
export function bandHalfWidthDeg(k: number, lDeg: number): number {
  const half = MILKY_WAY_BANDS_DEG[k] ?? 0;
  return half + MILKY_WAY_CORE.widenDeg * Math.exp(-((fromCentre(lDeg) / MILKY_WAY_CORE.scaleDeg) ** 2));
}

/** One ring at the instant: every point's azimuth and altitude. */
export interface HazeRing {
  azDeg: Float64Array;
  altDeg: Float64Array;
}

export interface PreparedHaze {
  rings: readonly HazeRing[];
  /** The instant's rotation, for the antipode's galactic place per frame. */
  frame: Mat3;
}

/** The outline's rings through the instant's rotation, once per positions object. */
export function prepareHaze(outline: readonly (readonly (readonly number[])[])[], frame: Mat3): PreparedHaze {
  const rings = outline.map((ring): HazeRing => {
    const azDeg = new Float64Array(ring.length);
    const altDeg = new Float64Array(ring.length);
    ring.forEach((point, i) => {
      const h = horizonOf(applyFrame(frame, equatorialVector(point[0] ?? 0, point[1] ?? 0)));
      azDeg[i] = h.azDeg;
      altDeg[i] = h.altDeg;
    });
    return { azDeg, altDeg };
  });
  return { rings, frame };
}

export interface HazePath {
  d: string;
  opacity: number;
}

const fmt = (n: number): string => n.toFixed(1);

/** FR-LOOK-3: band `k`'s alpha. */
export const hazeOpacity = (k: number): number => Math.round((HAZE_ALPHAS[k] ?? 0) * MILKY_WAY_STRENGTH * 1000) / 1000;

/** The three bands for one rotation, outermost first; a band whose ring is empty draws nothing. */
export function hazePaths(rotation: Mat3, view: View, haze: PreparedHaze): HazePath[] {
  const look = lookDirection(rotation);
  // The antipode of the look direction, back in the equatorial frame and then in galactic coordinates.
  const antipode = unapplyFrame(haze.frame, skyVector(look.azDeg + 180, -look.altDeg));
  const { lDeg, bDeg } = galacticOf(Math.atan2(antipode[1], antipode[0]) / RAD, Math.asin(Math.max(-1, Math.min(1, antipode[2]))) / RAD);
  const box = `M0 0H${fmt(view.width)}V${fmt(view.height)}H0Z`;
  return haze.rings.map((ring, k) => {
    const points = [];
    for (let i = 0; i < ring.azDeg.length; i += 1) points.push(project(rotation, ring.azDeg[i] ?? 0, ring.altDeg[i] ?? 0, view));
    const image = groundClipPath(points);
    if (image === '') return { d: '', opacity: hazeOpacity(k) };
    const flipped = Math.abs(bDeg) < bandHalfWidthDeg(k, lDeg);
    return { d: `${flipped ? box : ''}${image}`, opacity: hazeOpacity(k) };
  });
}
