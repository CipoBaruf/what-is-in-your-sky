import { Body, Equator, Horizon, Illumination, MakeTime, Observer as AeObserver, Rotation_EQJ_HOR } from 'astronomy-engine';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { msToDate } from '../physics/time';
import type { EpochMs, Locale, Observer, VisibilityThresholds } from '../model';

/**
 * FR-STAR-2 (R112, D-749): where every catalogue star and the five naked-eye
 * planets are in the observer's sky at one instant. This is one of the
 * lint boundary's main-thread exceptions, beside `skyBodies.ts` and
 * `arcReveal.ts` (`eslint.config.js`): the stars
 * follow the clock and the hand as the Sun and the Moon do, and a worker round
 * trip per frame is what FR-STAR-2 rules out.
 *
 * One `Rotation_EQJ_HOR` per instant (precession and nutation inside it),
 * applied to every star's J2000 unit vector; geometric altitudes, no
 * refraction, as the passes are. The result is memoised in one slot on
 * `(t, lat, lon)`: a frame under the hand or the sensor reuses it, a change of
 * `t` replaces it.
 *
 * Pure and clock-free (D-15): time enters through `t`. Imported only by the
 * `stars` chunk (D-749), so `astronomy-engine` stays out of the main chunk.
 */

/** What the positions need of the catalogue (`data/stars/catalog.ts`'s `StarCatalog` has it): J2000 degrees, in catalogue order. */
export interface StarPositionsSource {
  size: number;
  ra: ArrayLike<number>;
  dec: ArrayLike<number>;
}

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
type PlanetName = (typeof PLANETS)[number];

interface PlanetAt {
  body: PlanetName;
  /** Azimuth from north through east, degrees. */
  azDeg: number;
  /** Geometric altitude, degrees. */
  altDeg: number;
  /** Visual magnitude at `t` (`Illumination().mag`). */
  mag: number;
}

export interface StarsAt {
  t: EpochMs;
  /** Altitude of star `i`, degrees, in catalogue order. */
  altDeg: Float32Array;
  /** Azimuth of star `i` from north through east, degrees, in `[0, 360)`. */
  azDeg: Float32Array;
  planets: readonly PlanetAt[];
}

const RAD = Math.PI / 180;

let memo: { catalog: StarPositionsSource; t: EpochMs; lat: number; lon: number; result: StarsAt } | undefined;

/** Every star and planet for `observer` at `t`. The same call twice returns the same object. */
export function starsAt(catalog: StarPositionsSource, observer: Pick<Observer, 'lat' | 'lon'>, t: EpochMs): StarsAt {
  const { lat, lon } = observer;
  if (memo && memo.catalog === catalog && memo.t === t && memo.lat === lat && memo.lon === lon) return memo.result;

  const time = MakeTime(msToDate(t));
  const where = new AeObserver(lat, lon, 0);
  // `RotateVector`'s product, written out: the matrix is stored column by column.
  const [c0 = [], c1 = [], c2 = []] = Rotation_EQJ_HOR(time, where).rot;
  const [m00 = 0, m01 = 0, m02 = 0] = c0;
  const [m10 = 0, m11 = 0, m12 = 0] = c1;
  const [m20 = 0, m21 = 0, m22 = 0] = c2;

  const altDeg = new Float32Array(catalog.size);
  const azDeg = new Float32Array(catalog.size);
  for (let i = 0; i < catalog.size; i += 1) {
    const ra = (catalog.ra[i] ?? 0) * RAD;
    const dec = (catalog.dec[i] ?? 0) * RAD;
    const x = Math.cos(dec) * Math.cos(ra);
    const y = Math.cos(dec) * Math.sin(ra);
    const z = Math.sin(dec);
    // HOR: x north, y west, z zenith.
    const hx = m00 * x + m10 * y + m20 * z;
    const hy = m01 * x + m11 * y + m21 * z;
    const hz = m02 * x + m12 * y + m22 * z;
    altDeg[i] = Math.atan2(hz, Math.hypot(hx, hy)) / RAD;
    const az = Math.atan2(-hy, hx) / RAD;
    const wrapped = az < 0 ? az + 360 : az;
    azDeg[i] = Math.fround(wrapped) >= 360 ? 0 : wrapped; // a hair west of north rounds up to 360 in 32 bits
  }

  const planets = PLANETS.map((body): PlanetAt => {
    const eq = Equator(Body[body], time, where, true, true);
    const h = Horizon(time, where, eq.ra, eq.dec); // no refraction argument: geometric
    return { body, azDeg: h.azimuth, altDeg: h.altitude, mag: Illumination(Body[body], time).mag };
  });

  const result: StarsAt = { t, altDeg, azDeg, planets };
  memo = { catalog, t, lat, lon, result };
  return result;
}

/**
 * FR-STAR-10 as amended v2.5 (D-832): what the names need of the catalogue
 * (`data/stars/catalog.ts`'s `StarCatalog` has it). These three are the only
 * readers of a star's or a figure's name; `src/lib` may not import `src/data`,
 * so the catalogue is passed in, as `starsAt` takes it.
 */
export interface StarNamesSource {
  name: readonly string[];
  nameEs: readonly string[];
  desig: readonly string[];
  figureNames: Readonly<Record<Locale, Readonly<Record<string, readonly string[]>>>>;
  wholeNames: Readonly<Record<Locale, Readonly<Record<string, string>>>>;
}

/** Star `i`'s name: the Spanish one where `names-es.tsv` has it, else the IAU proper name, else the designation. */
export function starName(names: StarNamesSource, i: number, lang: Locale): string {
  return (lang === 'es' ? names.nameEs[i] : '') || names.name[i] || (names.desig[i] ?? '');
}

const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);

/** One drawn part's name in `lang` (`Serpens Caput` / `Cabeza de la Serpiente`), or `undefined` for a part the table does not have. */
export function figureName(names: StarNamesSource, con: string, part: number, lang: Locale): string | undefined {
  return own(names.figureNames[lang], con)?.[part];
}

/** A constellation's one name in `lang` (`Serpens` / `Serpiente` whole, otherwise its one part's), or `undefined`. */
export function constellationName(names: StarNamesSource, con: string, lang: Locale): string | undefined {
  return own(names.wholeNames[lang], con) ?? figureName(names, con, 0, lang);
}

/**
 * FR-STAR-13, FR-SKY-3 (D-791): the twilight steps. The ladder's rungs
 * (FR-STAR-6, `starGlyphs.ts`'s `LADDER`) by their faintest magnitude; a star
 * is on rung `k` when `k` is the first whose bound it does not exceed.
 */
export const RUNG_MAX_MAG: readonly number[] = [0.5, 1.5, 2.5, 3.5, Number.POSITIVE_INFINITY];

/** Above this Sun altitude, degrees, the stars layer draws nothing: a daytime sky. */
const DAYLIGHT_ALT = 0;

/** How many rungs are drawn at a Sun altitude: every one at `sunAltMaxDeg` (−6°, the threshold `skyStateOf` calls day) and below, the first two up to 0°, none above. */
export function drawnRungs(sunAltDeg: number, thresholds: Pick<VisibilityThresholds, 'sunAltMaxDeg'> = DEFAULT_THRESHOLDS): number {
  if (sunAltDeg > DAYLIGHT_ALT) return 0;
  return sunAltDeg > thresholds.sunAltMaxDeg ? 2 : RUNG_MAX_MAG.length;
}

/** Whether the planets are drawn at a Sun altitude: up to 0° (Venus is a twilight object). */
export const planetsDrawn = (sunAltDeg: number): boolean => sunAltDeg <= DAYLIGHT_ALT;

/** The faintest magnitude `rungs` drawn rungs show; `-Infinity` for none. */
export const drawnMagLimit = (rungs: number): number => (rungs > 0 ? (RUNG_MAX_MAG[Math.min(rungs, RUNG_MAX_MAG.length) - 1] ?? Number.NEGATIVE_INFINITY) : Number.NEGATIVE_INFINITY);
