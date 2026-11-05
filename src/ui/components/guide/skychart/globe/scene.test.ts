import { MakeTime, RotateVector, Rotation_EQJ_EQD, Vector } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { starCatalog } from '../../../../../data/stars/catalog';
import { starsAt } from '../../../../../lib/skyStars';
import { RUNG_MAX_MAG } from '../../../../../lib/starRungs';
import type { Observer } from '../../../../../model';
import { FIELD_LIST_MAX, fieldObjects } from '../../../../screens/stars/field';
import { handRotation } from '../window/camera';
import { WINDOW_FOV } from '../window/projection';
import { DAY_STARS_ALPHA, DAY_STARS_MAG } from './constants';
import { dot, ECLIPTIC_POLE, EQUATORIAL, greatCircle, project, projector, radec, type Vec3 } from './projection';
import { altAz, dayStars, figureAnchor, globeSky, starVectors, surfaceAt, upCount, upList } from './scene';

/**
 * R167 (FR-GLOBE-3, FR-GLOBE-12, FR-GLOBE-13, FR-GLOBE-17; PLAN §9.14,
 * D-1037): the shown place's sky as J2000 geometry — Buenos Aires's zenith
 * against the local sidereal time, London's south pole on the ground side,
 * Quito's horizon through both poles, the count and the list for a fixed place
 * and instant, the surface's step at three instants of one evening, Hydra's
 * anchor on a vertex. FR-STAR-2's path (`starsAt`, held to the published
 * ephemerides by `skyStars.test.ts`) is the reference the globe's altitudes are
 * held to.
 */

const RAD = Math.PI / 180;
const place = (lat: number, lon: number, timeZone: string | null = null): Observer => ({ lat, lon, altM: 0, label: `${lat}, ${lon}`, source: 'coords', timeZone });
const BUENOS_AIRES = place(-34.6, -58.38, 'America/Argentina/Buenos_Aires');
const LONDON = place(51.51, -0.13, 'Europe/London');
const QUITO = place(-0.18, -78.47, 'America/Guayaquil');
/** 22:00 at Buenos Aires on 2026-11-03: dark, Orion rising. */
const T = Date.parse('2026-11-04T01:00:00Z');

const catalog = starCatalog();

const wrap180 = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;

/** IAU 1982 Greenwich mean sidereal time, degrees: an independent clock for the zenith's right ascension. */
function gmstDeg(t: number): number {
  const d = t / 86_400_000 + 2_440_587.5 - 2_451_545.0;
  return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360;
}

describe('the place’s zenith, north and east (FR-GLOBE-3)', () => {
  it('Buenos Aires: the zenith’s right ascension is the local sidereal time and its declination the latitude, to 0.1°', () => {
    for (const t of [T, T + 6 * 3_600_000, Date.parse('2026-06-21T12:00:00Z')]) {
      const sky = globeSky(BUENOS_AIRES, t);
      // The globe's zenith is J2000; the sidereal time is the equinox of date's: rotate it there to compare.
      const time = MakeTime(new Date(t));
      const ofDate = RotateVector(Rotation_EQJ_EQD(time), new Vector(sky.zenith[0], sky.zenith[1], sky.zenith[2], time));
      const raDeg = Math.atan2(ofDate.y, ofDate.x) / RAD;
      const decDeg = Math.asin(ofDate.z) / RAD;
      expect(Math.abs(wrap180(raDeg - (gmstDeg(t) + BUENOS_AIRES.lon)))).toBeLessThan(0.1);
      expect(Math.abs(decDeg - BUENOS_AIRES.lat)).toBeLessThan(0.1);
    }
  });

  it('the three axes are orthonormal, east is north turned 90° toward the left of the zenith', () => {
    const sky = globeSky(BUENOS_AIRES, T);
    for (const v of [sky.zenith, sky.north, sky.east]) expect(dot(v, v)).toBeCloseTo(1, 12);
    expect(dot(sky.zenith, sky.north)).toBeCloseTo(0, 12);
    expect(dot(sky.zenith, sky.east)).toBeCloseTo(0, 12);
    expect(dot(sky.north, sky.east)).toBeCloseTo(0, 12);
    expect(altAz(sky, sky.zenith).altDeg).toBeCloseTo(90, 4); // asin near 1 loses digits
    expect(altAz(sky, sky.north)).toEqual({ altDeg: expect.closeTo(0, 9) as number, azDeg: expect.closeTo(0, 6) as number });
    expect(altAz(sky, sky.east).azDeg).toBeCloseTo(90, 6);
    // The north point is the meridian's foot toward the north celestial pole: the south pole is on the other side for a southern place.
    expect(dot(sky.north, [0, 0, 1])).toBeGreaterThan(0);
    expect(sky.frame).toEqual({ pole: sky.zenith, zero: sky.north });
  });

  it('London: the south celestial pole is on the ground side', () => {
    const sky = globeSky(LONDON, T);
    const scp: Vec3 = [0, 0, -1];
    expect(altAz(sky, scp).altDeg).toBeCloseTo(-LONDON.lat, 0);
    expect(dot(scp, sky.zenith)).toBeLessThan(0);
    // And the north one is up, at the latitude.
    expect(altAz(sky, [0, 0, 1]).altDeg).toBeCloseTo(LONDON.lat, 0);
  });

  it('Quito: the horizon passes within 1° of both poles', () => {
    for (const t of [T, T + 12 * 3_600_000]) {
      const sky = globeSky(QUITO, t);
      const horizon = greatCircle(sky.zenith, 3_600);
      for (const pole of [
        [0, 0, 1],
        [0, 0, -1],
      ] as Vec3[]) {
        expect(Math.abs(altAz(sky, pole).altDeg)).toBeLessThan(1);
        const nearest = Math.min(...horizon.map((s) => Math.acos(Math.max(-1, Math.min(1, dot(s, pole)))) / RAD));
        expect(nearest).toBeLessThan(1);
      }
    }
  });

  it('every star’s altitude and azimuth are FR-STAR-2’s, the rotation read backwards', () => {
    for (const where of [BUENOS_AIRES, LONDON, QUITO]) {
      const sky = globeSky(where, T);
      const positions = starsAt(catalog, where, T);
      const dirs = starVectors(catalog);
      for (let i = 0; i < catalog.size; i += 1) {
        const s: Vec3 = [dirs[3 * i] ?? 0, dirs[3 * i + 1] ?? 0, dirs[3 * i + 2] ?? 0];
        const { altDeg, azDeg } = altAz(sky, s);
        expect(Math.abs(altDeg - (positions.altDeg[i] ?? 0))).toBeLessThan(1e-3);
        if (Math.abs(altDeg) < 89.9) expect(Math.abs(wrap180(azDeg - (positions.azDeg[i] ?? 0)))).toBeLessThan(1e-3);
      }
      // The planets as the window places them.
      positions.planets.forEach((planet, k) => {
        const mine = sky.planets[k];
        expect(mine?.body).toBe(planet.body);
        expect(mine?.altDeg).toBeCloseTo(planet.altDeg, 9);
        expect(mine?.mag).toBeCloseTo(planet.mag, 9);
        if (mine) expect(altAz(sky, mine.dir).altDeg).toBeCloseTo(planet.altDeg, 6);
      });
    }
  });

  it('turns the Sun and the Moon back to J2000 where the window puts them; the Sun on the ecliptic', () => {
    const sky = globeSky(BUENOS_AIRES, T);
    for (const body of [sky.sun, sky.moon]) {
      expect(dot(body.dir, body.dir)).toBeCloseTo(1, 12);
      const back = altAz(sky, body.dir);
      expect(back.altDeg).toBeCloseTo(body.altDeg, 6);
      expect(Math.abs(wrap180(back.azDeg - body.azDeg))).toBeLessThan(1e-6);
    }
    expect(sky.sunAltDeg).toBe(sky.sun.altDeg);
    expect(sky.moon.altDeg).toBe(sky.moon.state.elDeg);
    // Precession moves the ecliptic of date off J2000's by a few arcseconds a year: well inside a tenth of a degree.
    expect(Math.abs(Math.asin(dot(sky.sun.dir, ECLIPTIC_POLE)) / RAD)).toBeLessThan(0.1);
  });

  it('is one rotation per instant: the same arguments return the same object, a new instant a new one', () => {
    const a = globeSky(BUENOS_AIRES, T);
    expect(globeSky({ ...BUENOS_AIRES }, T)).toBe(a);
    const b = globeSky(BUENOS_AIRES, T + 1);
    expect(b).not.toBe(a);
    expect(starVectors(catalog)).toBe(starVectors(catalog));
  });
});

describe('the count and the list (FR-GLOBE-12)', () => {
  const sky = globeSky(BUENOS_AIRES, T);
  const positions = starsAt(catalog, BUENOS_AIRES, T);

  it('counts the stars above the horizon, as FR-STAR-2 places them', () => {
    const count = upCount(sky, starVectors(catalog));
    let reference = 0;
    for (let i = 0; i < catalog.size; i += 1) if ((positions.altDeg[i] ?? -90) >= 0) reference += 1;
    expect(count).toBe(reference);
    expect(count).toBe(597);
    expect(catalog.size).toBe(1033);
    // A set of directions of its own: the deep catalogue's on load, any unit vectors.
    expect(upCount(sky, Float64Array.from([...sky.zenith, ...sky.zenith.map((v) => -v)]))).toBe(1);
  });

  it('lists the twelve brightest up, brightest first, in FieldList’s row shape — the whole sky’s list', () => {
    const list = upList(sky, catalog, sky.planets, 'en');
    expect(list).toHaveLength(FIELD_LIST_MAX);
    expect(list.map((o) => o.name ?? o.planet)).toEqual(['Sirius', 'Canopus', 'Rigil Kentaurus', 'Rigel', 'Saturn', 'Achernar', 'Hadar', 'Altair', 'Aldebaran', 'Fomalhaut', 'Mimosa', 'Acrux']);
    expect(list[0]).toEqual({ index: 0, name: 'Sirius', planet: null, mag: expect.closeTo(-1.46, 2) as number, altDeg: expect.closeTo(0.2, 1) as number, point: 'ESE' });
    expect(list.find((o) => o.planet === 'Saturn')?.index).toBe(catalog.size + 4);
    // The same rows the stars page's whole-sky field lists (R160).
    const whole = fieldObjects({ catalog, positions, rotation: handRotation({ azDeg: 0, altDeg: 30 }), view: { fovDeg: WINDOW_FOV, width: 0, height: 0, screenAngleDeg: 0 }, layers: { stars: true, planets: true }, lang: 'en', whole: true });
    expect(list.map(({ index, name, planet, point }) => ({ index, name, planet, point }))).toEqual(whole.map(({ index, name, planet, point }) => ({ index, name, planet, point })));
    list.forEach((o, k) => {
      expect(o.altDeg).toBeCloseTo(whole[k]?.altDeg ?? NaN, 3);
      expect(o.mag).toBeCloseTo(whole[k]?.mag ?? NaN, 5);
    });
  });

  it('names in the reader’s language, and lists no planet when none is passed', () => {
    const es = upList(sky, catalog, sky.planets, 'es');
    expect(es[0]?.name).toBe('Sirio');
    const noPlanets = upList(sky, catalog, [], 'en');
    expect(noPlanets.every((o) => o.planet === null)).toBe(true);
    expect(noPlanets).toHaveLength(FIELD_LIST_MAX);
  });
});

describe('the surface (FR-GLOBE-13)', () => {
  it('steps from day through twilight to deep across one Buenos Aires evening', () => {
    const at = (iso: string): ReturnType<typeof surfaceAt> => surfaceAt(globeSky(BUENOS_AIRES, Date.parse(iso)));
    expect(at('2026-11-03T21:30:00Z')).toBe('day'); // 18:30, the Sun about 10° up
    expect(at('2026-11-03T22:40:00Z')).toBe('twilight'); // 19:40, about 4° down
    expect(at('2026-11-03T23:10:00Z')).toBe('deep'); // 20:10, about 9° down
  });
});

/** v2.14.1 (FR-STAR-13 as amended, V214-30, V214-36; D-1139): the globe's stars by day; the drawing is `GlobeRenderer.test.ts`'s. */
describe('the day stars (FR-STAR-13 as amended)', () => {
  it('are the stars to DAY_STARS_MAG at DAY_STARS_ALPHA while the Sun is above −6°: day and twilight alike', () => {
    const day = { maxMag: DAY_STARS_MAG, alpha: DAY_STARS_ALPHA };
    expect(DAY_STARS_ALPHA).toBe(0.35);
    expect(DAY_STARS_MAG).toBe(3.5);
    // Fainter than the window's twilight rungs (V214-36: about 13 stars was a dozen points, not a sky).
    expect(DAY_STARS_MAG).toBeGreaterThan(RUNG_MAX_MAG[1] ?? 0);
    for (const alt of [70, 20, 0.1, 0, -3, -5.9]) expect(dayStars(alt), String(alt)).toEqual(day);
    // Over a Buenos Aires morning, the Sun +20° up: the surface's `day` step; at dusk, −3°: its `twilight`.
    const morning = globeSky(BUENOS_AIRES, Date.parse('2026-11-04T10:33:00Z'));
    expect(morning.sunAltDeg).toBeCloseTo(20, 0);
    expect(dayStars(morning.sunAltDeg)).toEqual(day);
  });

  it('are none at −6° and below: the globe draws as at night', () => {
    for (const alt of [-6, -10, -20, Number.NaN]) expect(dayStars(alt)).toBeNull();
  });

  it('cut the Up from list to the stars drawn: none fainter than DAY_STARS_MAG by day, the night’s list at night', () => {
    const noon = globeSky(BUENOS_AIRES, Date.parse('2026-11-04T15:00:00Z'));
    const listed = upList(noon, catalog, [], 'en', dayStars(noon.sunAltDeg)?.maxMag);
    expect(listed.length).toBeGreaterThan(0);
    for (const object of listed) expect(object.mag).toBeLessThanOrEqual(DAY_STARS_MAG);
    expect(upList(noon, catalog, [], 'en', 1)).toEqual(upList(noon, catalog, [], 'en').filter((object) => object.mag <= 1));
  });
});

describe('a figure’s anchor (D-1041)', () => {
  const hydra = catalog.figures.find((f) => f.con === 'Hya');
  const p = projector({ frame: EQUATORIAL, lon: 160, lat: -15 }, 600, 400, 380);
  const drawn = Array.from({ length: catalog.size }, (_, i) => {
    const [x, y, depth] = project(p, radec(catalog.ra[i] ?? 0, catalog.dec[i] ?? 0));
    return depth > 0 ? { x, y } : null;
  });

  it('is Hydra’s drawn vertex nearest its endpoints’ centroid, on the figure and not in its bend', () => {
    expect(hydra).toBeDefined();
    if (!hydra) return;
    const anchor = figureAnchor(hydra, drawn);
    expect(anchor).not.toBeNull();
    if (!anchor) return;
    const vertices = new Set(hydra.segments);
    expect(vertices.has(anchor.index)).toBe(true);
    expect({ x: anchor.x, y: anchor.y }).toEqual(drawn[anchor.index]);
    const points = [...vertices].map((i) => drawn[i]).filter((q): q is { x: number; y: number } => q !== null);
    const cx = points.reduce((s, q) => s + q.x, 0) / points.length;
    const cy = points.reduce((s, q) => s + q.y, 0) / points.length;
    const d = (q: { x: number; y: number }): number => Math.hypot(q.x - cx, q.y - cy);
    for (const q of points) expect(d(anchor)).toBeLessThanOrEqual(d(q));
    // The bend: the centroid itself is off the line, more than a few px from any vertex.
    expect(d(anchor)).toBeGreaterThan(5);
  });

  it('counts a segment only when both its ends are drawn, and is null when none is', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, null, { x: 100, y: 100 }];
    expect(figureAnchor({ segments: [0, 1, 1, 2, 2, 3] }, pts)).toEqual({ index: 0, x: 0, y: 0 });
    expect(figureAnchor({ segments: [2, 3] }, pts)).toBeNull();
    expect(figureAnchor({ segments: [] }, pts)).toBeNull();
  });
});
