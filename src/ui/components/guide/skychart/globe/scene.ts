import { Body, Equator, Horizon, Illumination, MakeTime, Observer as AeObserver, Rotation_EQJ_HOR } from 'astronomy-engine';
import { compassPoint } from '../../../../../lib/compass';
import { skyBodiesAt } from '../../../../../lib/skyBodies';
import { PLANETS, starName, type StarNamesSource, type StarPositionsSource } from '../../../../../lib/skyStars';
import type { EpochMs, Locale, MoonState, Observer } from '../../../../../model';
import { FIELD_LIST_MAX, type FieldObject } from '../../../../screens/stars/field';
import type { Point } from '../window/starGlyphs';
import { tintStep, type TintStep } from '../window/skySurface';
import { add, dot, localFrame, scale, type Frame, type Vec3 } from './projection';

/**
 * R167 (FR-GLOBE-3, FR-GLOBE-8, FR-GLOBE-12, FR-GLOBE-13, FR-GLOBE-17; PLAN
 * D-1037): the shown place's sky at one instant, as J2000 geometry for the
 * globe. One rotation per instant — FR-STAR-2's `Rotation_EQJ_HOR`, the call
 * `lib/skyStars.ts` makes, precession and nutation inside it — read backwards:
 * its transpose's columns are the zenith, the north point and the west point
 * as J2000 directions, and every horizon position (the Sun and the Moon from
 * `lib/skyBodies.ts`, the planets by `skyStars.ts`'s own calls) is turned back
 * to J2000 through it, so each body sits on the globe where the window puts it
 * in the sky. The stars are drawn at their J2000 places without precession
 * (FR-GLOBE-17); their altitudes through the same rotation are FR-STAR-2's.
 *
 * Pure and clock-free (D-15): time enters through `t`. No worker message and no
 * physics module: `skyBodies.ts` is the main thread's one door to the Sun and
 * the Moon (D-80).
 */

const RAD = Math.PI / 180;

type PlanetName = (typeof PLANETS)[number];

/** A body on the globe: its J2000 direction and where it stands in the place's sky. */
interface GlobeBody {
  dir: Vec3;
  /** Geometric altitude, degrees. */
  altDeg: number;
  /** Azimuth from north through east, degrees, in [0, 360). */
  azDeg: number;
}

export interface GlobePlanet extends GlobeBody {
  body: PlanetName;
  /** Visual magnitude at `t`. */
  mag: number;
}

/** The place's sky at one instant, as J2000 directions. */
export interface GlobeSky {
  t: EpochMs;
  /** The place's latitude, degrees (`openView` reads its sign). */
  lat: number;
  zenith: Vec3;
  north: Vec3;
  east: Vec3;
  /** FR-GLOBE-5's "with you": the zenith up, longitude 0 north. */
  frame: Frame;
  sun: GlobeBody;
  moon: GlobeBody & { state: MoonState };
  planets: readonly GlobePlanet[];
  /** The Sun's geometric altitude at `t`, degrees — what the surface's step reads. */
  sunAltDeg: number;
}

let memo: { t: EpochMs; lat: number; lon: number; altM: number; sky: GlobeSky } | undefined;

/**
 * D-1037: `place`'s sky at `t`. The same arguments twice return the same
 * object — one rotation per shown instant (FR-STAR-2), a frame under the hand
 * reuses it, a change of `t` replaces it.
 */
export function globeSky(place: Observer, t: EpochMs): GlobeSky {
  const { lat, lon, altM } = place;
  if (memo && memo.t === t && memo.lat === lat && memo.lon === lon && memo.altM === altM) return memo.sky;

  const time = MakeTime(new Date(t));
  const where = new AeObserver(lat, lon, 0);
  // Stored column by column: hor_j = Σ_i rot[i][j]·eq_i, so HOR axis j in J2000 is (rot[0][j], rot[1][j], rot[2][j]) — the transpose's column j.
  const rot = Rotation_EQJ_HOR(time, where).rot;
  const axis = (j: number): Vec3 => [rot[0]?.[j] ?? 0, rot[1]?.[j] ?? 0, rot[2]?.[j] ?? 0];
  const north = axis(0);
  const west = axis(1);
  const zenith = axis(2);
  // HOR (x north, y west, z zenith) back to J2000.
  const fromHorizon = (azDeg: number, altDeg: number): GlobeBody => {
    const ca = Math.cos(altDeg * RAD);
    const dir = add(add(scale(north, ca * Math.cos(azDeg * RAD)), scale(west, -ca * Math.sin(azDeg * RAD))), scale(zenith, Math.sin(altDeg * RAD)));
    return { dir, altDeg, azDeg };
  };

  const bodies = skyBodiesAt(t, place);
  const planets = PLANETS.map((body): GlobePlanet => {
    // `skyStars.ts`'s calls: topocentric of date, geometric horizon.
    const eq = Equator(Body[body], time, where, true, true);
    const h = Horizon(time, where, eq.ra, eq.dec);
    return { body, mag: Illumination(Body[body], time).mag, ...fromHorizon(h.azimuth, h.altitude) };
  });

  const sky: GlobeSky = {
    t,
    lat,
    zenith,
    north,
    east: scale(west, -1),
    frame: localFrame(zenith, north),
    sun: fromHorizon(bodies.sun.azDeg, bodies.sun.altDeg),
    moon: { ...fromHorizon(bodies.moon.azDeg, bodies.moon.elDeg), state: bodies.moon },
    planets,
    sunAltDeg: bodies.sun.altDeg,
  };
  memo = { t, lat, lon, altM, sky };
  return sky;
}

/** Altitude and azimuth (from north through east, in [0, 360)) of a J2000 direction in the place's sky, degrees. */
export function altAz(sky: GlobeSky, s: Vec3): { altDeg: number; azDeg: number } {
  const altDeg = Math.asin(Math.max(-1, Math.min(1, dot(s, sky.zenith)))) / RAD;
  const az = Math.atan2(dot(s, sky.east), dot(s, sky.north)) / RAD;
  const azDeg = az < 0 ? az + 360 : az;
  return { altDeg, azDeg: azDeg >= 360 ? 0 : azDeg };
}

/** Unit vectors `[x0, y0, z0, x1, …]` of a catalogue's J2000 places. */
export type StarVectors = Float64Array;

const vectors = new WeakMap<StarPositionsSource, StarVectors>();

/** D-1037: a catalogue's stars as J2000 unit vectors, built once per catalogue (the bright one at mount, the deep one on load). */
export function starVectors(catalog: StarPositionsSource): StarVectors {
  const known = vectors.get(catalog);
  if (known) return known;
  const out = new Float64Array(catalog.size * 3);
  for (let i = 0; i < catalog.size; i += 1) {
    const ra = (catalog.ra[i] ?? 0) * RAD;
    const dec = (catalog.dec[i] ?? 0) * RAD;
    out[3 * i] = Math.cos(dec) * Math.cos(ra);
    out[3 * i + 1] = Math.cos(dec) * Math.sin(ra);
    out[3 * i + 2] = Math.sin(dec);
  }
  vectors.set(catalog, out);
  return out;
}

const starAt = (dirs: StarVectors, i: number): Vec3 => [dirs[3 * i] ?? 0, dirs[3 * i + 1] ?? 0, dirs[3 * i + 2] ?? 0];

/** FR-GLOBE-12: how many of `dirs` are above the place's horizon (altitude ≥ 0, as the whole sky's list counts). */
export function upCount(sky: GlobeSky, dirs: StarVectors): number {
  const [zx, zy, zz] = sky.zenith;
  let n = 0;
  for (let k = 0; k + 2 < dirs.length; k += 3) if ((dirs[k] ?? 0) * zx + (dirs[k + 1] ?? 0) * zy + (dirs[k + 2] ?? 0) * zz >= 0) n += 1;
  return n;
}

/**
 * FR-GLOBE-12: `Up from <place>` — the `FIELD_LIST_MAX` brightest objects
 * above the place's horizon, brightest first, in `FieldList`'s row shape. The
 * catalogue is sorted by magnitude (D-748), so the walk stops at the twelfth
 * star up; `planets` (the sky's, or none when the layer is off) are merged in
 * by their magnitude, a planet's index past the catalogue's length (D-750).
 */
export function upList(sky: GlobeSky, catalog: StarPositionsSource & StarNamesSource & { mag: ArrayLike<number> }, planets: readonly GlobePlanet[], lang: Locale): FieldObject[] {
  const dirs = starVectors(catalog);
  const found: FieldObject[] = [];
  for (let i = 0; i < catalog.size && found.length < FIELD_LIST_MAX; i += 1) {
    const { altDeg, azDeg } = altAz(sky, starAt(dirs, i));
    if (altDeg < 0) continue;
    found.push({ index: i, name: starName(catalog, i, lang), planet: null, mag: catalog.mag[i] ?? 99, altDeg, point: compassPoint(azDeg) });
  }
  planets.forEach((planet, k) => {
    if (planet.altDeg >= 0) found.push({ index: catalog.size + k, name: null, planet: planet.body, mag: planet.mag, altDeg: planet.altDeg, point: compassPoint(planet.azDeg) });
  });
  return found.sort((a, b) => a.mag - b.mag).slice(0, FIELD_LIST_MAX);
}

/**
 * D-1041: where a figure's name starts its walk on the globe — the drawn
 * vertex nearest the centroid of the drawn segments' endpoints, so a curved
 * figure (Hydra) is named on its line and not in the empty middle of its bend.
 * `segments` is the catalogue's flat `[a0, b0, a1, b1, …]`; `drawn[i]` is star
 * `i`'s screen point, or `null` where it is not drawn. A segment is drawn when
 * both its ends are; `null` when none is.
 */
export function figureAnchor(figure: { segments: ArrayLike<number> }, drawn: readonly (Point | null | undefined)[]): (Point & { index: number }) | null {
  const ends = new Map<number, Point>();
  for (let k = 0; k + 1 < figure.segments.length; k += 2) {
    const a = figure.segments[k] ?? -1;
    const b = figure.segments[k + 1] ?? -1;
    const pa = drawn[a];
    const pb = drawn[b];
    if (!pa || !pb) continue;
    ends.set(a, pa);
    ends.set(b, pb);
  }
  if (ends.size === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of ends.values()) {
    sx += p.x;
    sy += p.y;
  }
  const cx = sx / ends.size;
  const cy = sy / ends.size;
  let best: (Point & { index: number }) | null = null;
  let bestD = Infinity;
  for (const [index, p] of ends) {
    const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { index, x: p.x, y: p.y };
    }
  }
  return best;
}

/** FR-GLOBE-13: the disc's surface step — FR-LOOK-2's, for the Sun's altitude at the place and the globe's instant. */
export function surfaceAt(sky: GlobeSky): TintStep {
  return tintStep(sky.sunAltDeg);
}
