/**
 * R111 (FR-STAR-2, FR-STAR-6, D-741 items 3 and 4): where the catalogue is in
 * the observer's sky at one instant, and which glyph each star is drawn with.
 * One J2000-to-horizon rotation per instant (`Rotation_EQJ_HOR`), applied to
 * every star; the planets through the same library. Shared by the page and by
 * `precession.ts`, so the precession number is the page's own path.
 */
import { Body, Equator, Horizon, HorizonFromVector, MakeTime, Observer, Rotation_EQJ_HOR, RotateVector, Spherical, VectorFromSphere } from 'astronomy-engine';
import type { Star } from './catalogData';

export interface AltAz {
  altDeg: number;
  azDeg: number;
}

export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
export type PlanetName = (typeof PLANETS)[number];

export interface PlanetAt extends AltAz {
  body: PlanetName;
  /** Visual magnitude, for the list and the draw order. */
  v: number;
}

/** Every star's geometric altitude and azimuth at `at`, in catalogue order. */
export function starsAt(stars: readonly Pick<Star, 'ra' | 'dec'>[], lat: number, lon: number, at: Date): AltAz[] {
  const time = MakeTime(at);
  const rotation = Rotation_EQJ_HOR(time, new Observer(lat, lon, 0));
  return stars.map((s) => {
    const horizon = HorizonFromVector(RotateVector(rotation, VectorFromSphere(new Spherical(s.dec, s.ra, 1), time)), ''); // '' is no refraction: geometric, as the passes are
    return { altDeg: horizon.lat, azDeg: horizon.lon };
  });
}

// Magnitudes by eye at a planet's usual brightness; the spike draws `@` for every planet whatever its magnitude.
const PLANET_V: Record<PlanetName, number> = { Mercury: 0, Venus: -4, Mars: 0.5, Jupiter: -2.2, Saturn: 0.7 };

export function planetsAt(lat: number, lon: number, at: Date): PlanetAt[] {
  const time = MakeTime(at);
  const observer = new Observer(lat, lon, 0);
  return PLANETS.map((body) => {
    const eq = Equator(Body[body], time, observer, true, true);
    const h = Horizon(time, observer, eq.ra, eq.dec);
    return { body, altDeg: h.altitude, azDeg: h.azimuth, v: PLANET_V[body] };
  });
}

/** The three R1 sites, as the fixtures name them. */
export const SITES = {
  neuquen: { lat: -38.93, lon: -67.99 },
  paris: { lat: 48.86, lon: 2.35 },
  singapore: { lat: 1.35, lon: 103.82 },
} as const;
export type SiteName = keyof typeof SITES;

export interface Glyph {
  char: string;
  /** Which of the ladder's two sizes. */
  size: 'big' | 'small';
  tone: 'star' | 'dim' | 'planet';
}

/** FR-STAR-6's ladder: V ≤ 0.5 `*` big; ≤ 1.5 `*`; ≤ 2.5 `+`; ≤ 3.5 `.`; fainter `.` dim. */
export function glyphFor(v: number): Glyph {
  if (v <= 0.5) return { char: '*', size: 'big', tone: 'star' };
  if (v <= 1.5) return { char: '*', size: 'small', tone: 'star' };
  if (v <= 2.5) return { char: '+', size: 'small', tone: 'star' };
  if (v <= 3.5) return { char: '.', size: 'small', tone: 'star' };
  return { char: '.', size: 'small', tone: 'dim' };
}

export const PLANET_GLYPH: Glyph = { char: '@', size: 'small', tone: 'planet' };

/** Disc radius for the `mark=disc` comparison, px: the same four steps as the ladder. */
export function discRadius(v: number): number {
  if (v <= 0.5) return 3;
  if (v <= 1.5) return 2.4;
  if (v <= 2.5) return 1.8;
  if (v <= 3.5) return 1.3;
  return 0.9;
}

/**
 * FR-STAR-6's collision rule: walking brightest first, a point within `distancePx`
 * of one already kept is dropped. `points` are in draw order (brightest first),
 * `null` for one not drawn; returns which survive. A grid of `distancePx` cells
 * keeps it linear.
 */
export function collide(points: readonly ({ x: number; y: number } | null)[], distancePx: number): boolean[] {
  const keep = points.map(() => false);
  if (distancePx <= 0) return points.map((p) => p !== null);
  const cells = new Map<string, { x: number; y: number }[]>();
  const d2 = distancePx * distancePx;
  points.forEach((p, i) => {
    if (!p) return;
    const cx = Math.floor(p.x / distancePx);
    const cy = Math.floor(p.y / distancePx);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const q of cells.get(`${String(cx + dx)},${String(cy + dy)}`) ?? []) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < d2) return;
      }
    }
    const key = `${String(cx)},${String(cy)}`;
    const list = cells.get(key);
    if (list) list.push(p);
    else cells.set(key, [p]);
    keep[i] = true;
  });
  return keep;
}
