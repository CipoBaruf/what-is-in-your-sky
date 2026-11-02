/**
 * R115 (FR-STAR-7, D-756): `In this field`'s arithmetic over the real
 * catalogue at one instant — what is drawn in the box at a hand rotation, the
 * brightest first and no more than `FIELD_LIST_MAX`, nothing below the horizon
 * or outside the box, nothing of a layer that is off — and the catalogue in the
 * shape the window's scene types.
 */
import { describe, expect, it } from 'vitest';
import { starCatalog } from '../../../data/stars/catalog';
import { starName, starsAt } from '../../../lib/skyStars';
import type { EpochMs } from '../../../model';
import { handRotation } from '../../components/guide/skychart/window/camera';
import { project, WINDOW_FOV, type View } from '../../components/guide/skychart/window/projection';
import { FIELD_LIST_MAX, fieldObjects, formatStarMag, sceneCatalog } from './field';

const catalog = starCatalog();
/** Neuquén, 2026-10-24 03:00 UTC (midnight local): Crux and Centaurus low in the south-southwest, Canopus in the southeast. */
const NEUQUEN = { lat: -38.95, lon: -68.06 };
const T = Date.UTC(2026, 9, 24, 3, 0, 0) as EpochMs;
const positions = starsAt(catalog, NEUQUEN, T);
const VIEW: View = { fovDeg: WINDOW_FOV, width: 800, height: 500, screenAngleDeg: 0 };
const ON = { stars: true, planets: true };

const inBox = (azDeg: number, altDeg: number, view: View, at: { azDeg: number; altDeg: number }): boolean => {
  const p = project(handRotation(at), azDeg, altDeg, view);
  return altDeg >= 0 && p.front && p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height;
};

describe('fieldObjects (FR-STAR-7)', () => {
  const south = { azDeg: 180, altDeg: 35 };
  const listed = fieldObjects({ catalog, positions, rotation: handRotation(south), view: VIEW, layers: ON, lang: 'en' });

  it('lists at most FIELD_LIST_MAX objects, brightest first', () => {
    expect(listed.length).toBe(FIELD_LIST_MAX);
    const mags = listed.map((object) => object.mag);
    expect(mags).toEqual([...mags].sort((a, b) => a - b));
  });

  it('lists only what is drawn: in front, inside the box and above the horizon', () => {
    for (const object of listed) {
      const where = object.planet === null ? { az: positions.azDeg[object.index] ?? 0, alt: positions.altDeg[object.index] ?? 0 } : (() => {
        const planet = positions.planets[object.index - catalog.size];
        return { az: planet?.azDeg ?? 0, alt: planet?.altDeg ?? 0 };
      })();
      expect(inBox(where.az, where.alt, VIEW, south), object.name ?? object.planet ?? '').toBe(true);
    }
  });

  it('misses no star brighter than the faintest it lists', () => {
    const faintest = Math.max(...listed.map((object) => object.mag));
    const indices = new Set(listed.map((object) => object.index));
    for (let i = 0; i < catalog.size; i += 1) {
      if ((catalog.mag[i] ?? 99) >= faintest) break;
      if (inBox(positions.azDeg[i] ?? 0, positions.altDeg[i] ?? 0, VIEW, south)) expect(indices.has(i), catalog.desig[i]).toBe(true);
    }
  });

  it('names a star by its proper name, or by its designation where it has none', () => {
    for (const object of listed.filter((o) => o.planet === null)) {
      const proper = catalog.name[object.index] ?? '';
      expect(object.name).toBe(proper === '' ? catalog.desig[object.index] : proper);
    }
    expect(listed.some((object) => object.name === 'Canopus' || object.name === 'Acrux' || object.name === 'Hadar')).toBe(true);
  });

  it('gives the direction as a 16-point name and the altitude in degrees', () => {
    for (const object of listed) {
      expect(object.point).toMatch(/^(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)$/);
      expect(object.altDeg).toBeGreaterThanOrEqual(0);
      expect(object.altDeg).toBeLessThanOrEqual(90);
    }
  });

  it('lists nothing of a layer that is off, and nothing in an unmeasured box', () => {
    const starsOff = fieldObjects({ catalog, positions, rotation: handRotation(south), view: VIEW, layers: { stars: false, planets: true }, lang: 'en' });
    expect(starsOff.every((object) => object.planet !== null)).toBe(true);
    expect(fieldObjects({ catalog, positions, rotation: handRotation(south), view: VIEW, layers: { stars: false, planets: false }, lang: 'en' })).toEqual([]);
    expect(fieldObjects({ catalog, positions, rotation: handRotation(south), view: { ...VIEW, width: 0, height: 0 }, layers: ON, lang: 'en' })).toEqual([]);
  });

  it('lists nothing when the field is all ground', () => {
    expect(fieldObjects({ catalog, positions, rotation: handRotation({ azDeg: 180, altDeg: -10 }), view: { ...VIEW, height: 200 }, layers: ON, lang: 'en' }).every((object) => object.altDeg >= 0)).toBe(true);
  });

  it('merges the planets in by their magnitude, with an index past the catalogue', () => {
    // Every planet above the horizon, wherever it is: one field per planet, centred on it.
    for (const [k, planet] of positions.planets.entries()) {
      if (planet.altDeg < 5) continue;
      const at = { azDeg: planet.azDeg, altDeg: planet.altDeg };
      const here = fieldObjects({ catalog, positions, rotation: handRotation(at), view: VIEW, layers: ON, lang: 'en' });
      const found = here.find((object) => object.planet === planet.body);
      expect(found?.index, planet.body).toBe(catalog.size + k);
      expect(found?.mag).toBe(planet.mag);
    }
  });
});

describe('formatStarMag (FR-STAR-7)', () => {
  it('writes one decimal, the typographic minus and no plus, in the language’s decimal mark', () => {
    expect(formatStarMag(0.6, 'en')).toBe('0.6');
    expect(formatStarMag(-0.74, 'en')).toBe('−0.7');
    expect(formatStarMag(1.25, 'es')).toBe('1,3');
    expect(formatStarMag(-0.02, 'en')).toBe('0.0');
  });
});

describe('sceneCatalog (the window’s scene shape, R113)', () => {
  const scene = sceneCatalog(catalog);

  it('keeps the columns and pairs the segments', () => {
    expect(scene.mag).toBe(catalog.mag);
    expect(scene.figures).toHaveLength(catalog.figures.length);
    const first = catalog.figures[0];
    expect(scene.figures[0]?.segments.flat()).toEqual([...(first?.segments ?? [])]);
  });

  it('names Serpens’ two halves by their part and every other figure by none', () => {
    const serpens = scene.figures.filter((figure) => figure.con === 'Ser').map((figure) => figure.part);
    expect(serpens).toEqual(['Caput', 'Cauda']);
    expect(scene.figures.filter((figure) => figure.con !== 'Ser').every((figure) => figure.part === '')).toBe(true);
  });

  it('converts once', () => {
    expect(sceneCatalog(catalog)).toBe(scene);
  });
});

describe('the list’s names in both languages (FR-STAR-10 as amended v2.5, D-832)', () => {
  it('names a star through starName: Spanish where names-es.tsv has a name, the IAU name otherwise', () => {
    const canopus = catalog.name.indexOf('Canopus');
    const at = { azDeg: positions.azDeg[canopus] ?? 0, altDeg: positions.altDeg[canopus] ?? 0 };
    const es = fieldObjects({ catalog, positions, rotation: handRotation(at), view: VIEW, layers: ON, lang: 'es' });
    const en = fieldObjects({ catalog, positions, rotation: handRotation(at), view: VIEW, layers: ON, lang: 'en' });
    expect(es.find((object) => object.index === canopus)?.name).toBe('Canopo');
    expect(en.find((object) => object.index === canopus)?.name).toBe('Canopus');
    for (const object of es.filter((o) => o.planet === null)) expect(object.name).toBe(starName(catalog, object.index, 'es'));
    // A star with no Spanish row keeps its IAU name in both.
    const kept = es.find((object) => object.planet === null && (catalog.nameEs[object.index] ?? '') === '' && (catalog.name[object.index] ?? '') !== '');
    expect(kept?.name).toBe(catalog.name[kept?.index ?? -1]);
  });
});

/**
 * R160 (FR-PHONE-7, D-971): the whole sky — the polar chart in the box — lists every object above the horizon as its
 * field, whatever the camera and the box, so `In this field` is the whole sky's twelve brightest.
 */
describe('the whole sky’s field (FR-PHONE-7)', () => {
  const unmeasured: View = { ...VIEW, width: 0, height: 0 };
  const whole = fieldObjects({ catalog, positions, rotation: handRotation({ azDeg: 180, altDeg: 35 }), view: unmeasured, layers: ON, lang: 'en', whole: true });

  it('lists the twelve brightest above the horizon, whatever the camera and the box', () => {
    expect(whole).toHaveLength(FIELD_LIST_MAX);
    expect(whole.map((o) => o.mag)).toEqual([...whole.map((o) => o.mag)].sort((a, b) => a - b));
    expect(whole.every((o) => o.altDeg >= 0)).toBe(true);
    // Brightest first over the whole sky: no star above the horizon is brighter than the faintest listed and left out.
    const faintest = Math.max(...whole.map((o) => o.mag));
    const listed = new Set(whole.map((o) => o.index));
    for (let i = 0; i < catalog.size; i += 1) {
      if ((positions.altDeg[i] ?? -90) >= 0 && (catalog.mag[i] ?? 99) < faintest) expect(listed.has(i)).toBe(true);
    }
    // The same twelve from any camera.
    expect(fieldObjects({ catalog, positions, rotation: handRotation({ azDeg: 0, altDeg: 90 }), view: VIEW, layers: ON, lang: 'en', whole: true })).toEqual(whole);
    // The window's own field lists fewer, and nothing in an unmeasured box.
    expect(fieldObjects({ catalog, positions, rotation: handRotation({ azDeg: 180, altDeg: 35 }), view: unmeasured, layers: ON, lang: 'en' })).toEqual([]);
  });
});
