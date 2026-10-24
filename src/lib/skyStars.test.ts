import { readdirSync, readFileSync } from 'node:fs';
import { HorizonFromVector, MakeTime, Observer, RotateVector, Rotation_EQJ_HOR, Spherical, VectorFromSphere } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { starCatalog } from '../data/stars/catalog';
import { PLANETS, starsAt } from './skyStars';
import { angularDistanceDeg } from './skyGeometry';

/**
 * R112, FR-STAR-2, US-38 AC3: every star and planet within `STAR_TOLERANCE_DEG`
 * of the published ephemeris at the three R1 sites (`tests/fixtures/stars/`,
 * IAU SOFA for the stars and JPL Horizons for the planets, D-743), through the
 * catalogue as the app ships it, and the one memo slot.
 */
const STAR_TOLERANCE_DEG = 0.25;
const DIR = new URL('../../tests/fixtures/stars/', import.meta.url);

interface Fixture {
  site: string;
  observer: { lat: number; lon: number };
  instant: string;
  stars: { hr: number; name: string; designation: string; altDeg: number; azDeg: number }[];
  planets: { body: string; altDeg: number; azDeg: number }[];
}

const fixtures: Fixture[] = readdirSync(DIR)
  .filter((f) => /Z\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Fixture);

/** Great-circle distance between two alt/az points, degrees: the dome's one helper, clamped. */
const separation = (a1: number, z1: number, a2: number, z2: number): number =>
  angularDistanceDeg({ azDeg: z1, elDeg: a1 }, { azDeg: z2, elDeg: a2 });

const catalog = starCatalog();

describe('starsAt against the published ephemeris', () => {
  it('has the three R1 sites', () => {
    expect(fixtures.map((f) => f.site)).toEqual(['neuquen', 'paris', 'singapore']);
  });

  for (const fx of fixtures) {
    const t = Date.parse(fx.instant);

    it(`${fx.site}: the twelve stars, found in the catalogue by name, within ${String(STAR_TOLERANCE_DEG)}°`, () => {
      expect(fx.stars).toHaveLength(12);
      const at = starsAt(catalog, fx.observer, t);
      for (const want of fx.stars) {
        const i = catalog.name.indexOf(want.name);
        expect(i, want.name).toBeGreaterThanOrEqual(0);
        expect(catalog.desig[i]?.replace(/ /g, ''), want.name).toBe(want.designation.replace(/ /g, '')); // the fixtures write `Alp1Cen` as the record does
        const d = separation(at.altDeg[i] ?? NaN, at.azDeg[i] ?? NaN, want.altDeg, want.azDeg);
        expect(d, `${fx.site} ${want.name}`).toBeLessThanOrEqual(STAR_TOLERANCE_DEG);
      }
    });

    it(`${fx.site}: the five planets within ${String(STAR_TOLERANCE_DEG)}°, with a magnitude each`, () => {
      const { planets } = starsAt(catalog, fx.observer, t);
      expect(planets.map((p) => p.body)).toEqual([...PLANETS]);
      for (const want of fx.planets) {
        const p = planets.find((q) => q.body === want.body);
        expect(p, want.body).toBeDefined();
        if (!p) continue;
        expect(separation(p.altDeg, p.azDeg, want.altDeg, want.azDeg), `${fx.site} ${want.body}`).toBeLessThanOrEqual(STAR_TOLERANCE_DEG);
      }
      // The fixtures carry no magnitudes (D-758: "where they carry one"), so the check is the planets' known ranges.
      const mag = Object.fromEntries(planets.map((p) => [p.body, p.mag]));
      expect(mag.Venus).toBeLessThan(-3.5);
      expect(mag.Jupiter).toBeLessThan(-1.5);
      for (const p of planets) expect(p.mag, p.body).toBeGreaterThan(-5);
      for (const p of planets) expect(p.mag, p.body).toBeLessThan(6); // Mercury near inferior conjunction reaches +5
    });
  }

  it("applies the library's own rotation to every star, element by element", () => {
    const fx = fixtures[1];
    if (!fx) throw new Error('no fixture');
    const t = Date.parse(fx.instant);
    const at = starsAt(catalog, fx.observer, t);
    const time = MakeTime(new Date(t));
    const rotation = Rotation_EQJ_HOR(time, new Observer(fx.observer.lat, fx.observer.lon, 0));
    for (let i = 0; i < catalog.size; i += 1) {
      const h = HorizonFromVector(RotateVector(rotation, VectorFromSphere(new Spherical(catalog.dec[i] ?? 0, catalog.ra[i] ?? 0, 1), time)), '');
      expect(separation(at.altDeg[i] ?? NaN, at.azDeg[i] ?? NaN, h.lat, h.lon), String(i)).toBeLessThan(1e-4);
      expect(at.azDeg[i]).toBeGreaterThanOrEqual(0);
      expect(at.azDeg[i]).toBeLessThan(360);
    }
  });
});

describe('starsAt memo', () => {
  const paris = { lat: 48.86, lon: 2.35 };
  const t = Date.UTC(2026, 10, 1, 21);

  it('returns the same object for the same instant and place, catalogue order and length', () => {
    const a = starsAt(catalog, paris, t);
    expect(starsAt(catalog, { ...paris }, t)).toBe(a);
    expect(a.t).toBe(t);
    expect(a.altDeg).toHaveLength(catalog.size);
    expect(a.azDeg).toHaveLength(catalog.size);
  });

  it('replaces the slot when the instant or the place changes, and keeps one slot only', () => {
    const a = starsAt(catalog, paris, t);
    const b = starsAt(catalog, paris, t + 1000);
    expect(b).not.toBe(a);
    expect(b.t).toBe(t + 1000);
    expect(starsAt(catalog, paris, t + 1000)).toBe(b);
    expect(starsAt(catalog, { lat: paris.lat, lon: 2.36 }, t + 1000)).not.toBe(b);
    expect(starsAt(catalog, { lat: 48.87, lon: 2.36 }, t + 1000)).not.toBe(b);
    // One slot: going back to the first instant computes it again, to equal values.
    const again = starsAt(catalog, paris, t);
    expect(again).not.toBe(a);
    expect(again.altDeg).toEqual(a.altDeg);
  });

  it('moves the stars with the instant: about a quarter of a degree a minute at the celestial equator', () => {
    const a = starsAt(catalog, paris, t);
    const i = catalog.name.indexOf('Altair');
    const altA = a.altDeg[i] ?? NaN;
    const azA = a.azDeg[i] ?? NaN;
    const b = starsAt(catalog, paris, t + 60_000);
    const d = separation(altA, azA, b.altDeg[i] ?? NaN, b.azDeg[i] ?? NaN);
    expect(d).toBeGreaterThan(0.2);
    expect(d).toBeLessThan(0.3);
  });
});
