import { readdirSync, readFileSync } from 'node:fs';
import { HorizonFromVector, MakeTime, Observer, RotateVector, Rotation_EQJ_HOR, Spherical, VectorFromSphere } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { starCatalog } from '../data/stars/catalog';
import { sunAltitudeDeg } from '../physics/sun';
import { brightestDrawn, moonNow, PLANETS, starsAt, type StarsAt } from './skyStars';
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
  /** R123 (FR-STAR-13): the Sun the twilight steps read is the Sun at the same instant, as the physics has it. */
  it('carries the Sun’s altitude at the instant, as `physics/sun.ts` gives it', () => {
    for (const at of [t, t + 6 * 3_600_000, t + 12 * 3_600_000]) {
      expect(starsAt(catalog, paris, at).sunAltDeg).toBeCloseTo(sunAltitudeDeg({ ...paris, altM: 0, label: '', source: 'coords', timeZone: null }, at), 2);
    }
  });
});

/** R130 (FR-FLOW-1, D-843): the wide Stars door's Moon line, against astronomy-engine's own altitude and phase. */
describe('moonNow', () => {
  const paris = { lat: 48.86, lon: 2.35 };
  it('says sets while the Moon is up and rises while it is down, the event within a day and after t', () => {
    for (let h = 0; h < 24; h += 3) {
      const t = Date.UTC(2026, 0, 15, h);
      const moon = moonNow(paris, t);
      expect(moon.pct).toBeGreaterThanOrEqual(0);
      expect(moon.pct).toBeLessThanOrEqual(100);
      expect(moon.at).not.toBeNull();
      expect(moon.at ?? 0).toBeGreaterThan(t);
      expect(moon.at ?? 0).toBeLessThan(t + 86_400_000);
      const after = moonNow(paris, (moon.at ?? t) + 30 * 60_000);
      // Half an hour past the event the Moon is on the other side of the horizon.
      expect(after.event).not.toBe(moon.event);
    }
  });
});

/** R130 (FR-FLOW-1, D-843): the Stars door's "Brightest now", over a made-up scene so each rule is seen alone. */
describe('brightestDrawn', () => {
  const scene = (over: { sunAltDeg?: number; alt?: number[]; az?: number[]; planets?: StarsAt['planets'] } = {}) => ({
    // Sirius-like, Canopus-like, a faint one: the catalogue is in magnitude order.
    mag: [-1.46, -0.74, 3.0],
    positions: {
      t: 0,
      altDeg: Float32Array.from(over.alt ?? [20, 30, 60]),
      azDeg: Float32Array.from(over.az ?? [90, 180, 0]),
      planets: over.planets ?? [],
      sunAltDeg: over.sunAltDeg ?? -18,
    } satisfies StarsAt,
  });

  it('takes the lowest magnitude above the horizon, with its 16-point direction', () => {
    expect(brightestDrawn(scene())).toEqual({ kind: 'star', index: 0, mag: -1.46, dir: 'E' });
    expect(brightestDrawn(scene({ alt: [-5, 30, 60] }))).toEqual({ kind: 'star', index: 1, mag: -0.74, dir: 'S' });
  });

  it('lets a brighter planet win, and drops one below the horizon', () => {
    const venus = { body: 'Venus' as const, azDeg: 250, altDeg: 10, mag: -4.2 };
    expect(brightestDrawn(scene({ planets: [venus] }))).toEqual({ kind: 'planet', body: 'Venus', mag: -4.2, dir: 'WSW' });
    expect(brightestDrawn(scene({ planets: [{ ...venus, altDeg: -1 }] }))?.kind).toBe('star');
  });

  it('follows the twilight step: the first two rungs in civil twilight, nothing with the Sun up', () => {
    // At −3° only the rungs to magnitude 1.5 are drawn, so the faint star never counts even alone above the horizon.
    expect(brightestDrawn(scene({ sunAltDeg: -3, alt: [-5, -5, 60] }))).toBeNull();
    expect(brightestDrawn(scene({ sunAltDeg: -3, alt: [-5, 30, 60] }))?.dir).toBe('S');
    expect(brightestDrawn(scene({ sunAltDeg: 5, planets: [{ body: 'Venus', azDeg: 250, altDeg: 10, mag: -4.2 }] }))).toBeNull();
  });

  it('names the real sky: the brightest drawn over Paris at night is in the catalogue and above the horizon', () => {
    const catalog = starCatalog();
    const night = Date.UTC(2026, 0, 15, 23);
    const positions = starsAt(catalog, { lat: 48.86, lon: 2.35 }, night);
    const found = brightestDrawn({ mag: catalog.mag, positions });
    expect(found).not.toBeNull();
    if (found?.kind === 'star') expect(positions.altDeg[found.index]).toBeGreaterThan(0);
  });
});
