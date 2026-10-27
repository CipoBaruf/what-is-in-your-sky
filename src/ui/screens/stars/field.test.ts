/**
 * R115 (FR-STAR-7, D-756): `In this field`'s arithmetic over the real
 * catalogue at one instant — what is drawn in the box at a hand rotation, the
 * brightest first and no more than `FIELD_LIST_MAX`, nothing below the horizon
 * or outside the box, nothing of a layer that is off — and the catalogue in the
 * shape the window's scene types.
 */
import { describe, expect, it } from 'vitest';
import { starCatalog } from '../../../data/stars/catalog';
import { goldenPassFixture } from '../../../../tests/support/catalogFixtures';
import { compassPoint } from '../../../lib/compass';
import { starName, starsAt } from '../../../lib/skyStars';
import type { EpochMs, Pass } from '../../../model';
import { handRotation } from '../../components/guide/skychart/window/camera';
import { project, WINDOW_FOV, type View } from '../../components/guide/skychart/window/projection';
import { FIELD_LIST_MAX, fieldObjects, fieldPasses, formatStarMag, sceneCatalog, STARS_PASSES_WINDOW_MS, tonightPasses } from './field';

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

/** A pass moved in time by `ms`, every instant with it. */
function shiftPass(pass: Pass, ms: number, id = pass.id): Pass {
  const at = <P extends { t: number }>(point: P): P => ({ ...point, t: point.t + ms });
  return { ...pass, id, start: at(pass.start), peak: at(pass.peak), end: at(pass.end), track: pass.track.map(at) };
}

describe('the passes in the field (FR-SKY-6, D-794)', () => {
  const golden = goldenPassFixture();
  const up = shiftPass(golden, T - 10_000 - golden.start.t, 'up');
  const later = shiftPass(golden, T + 6 * 3_600_000 - golden.start.t, 'later');
  const gone = shiftPass(golden, T - 3 * 3_600_000 - golden.start.t, 'gone');
  const tomorrow = shiftPass(golden, T + STARS_PASSES_WINDOW_MS + 60_000 - golden.start.t, 'tomorrow');

  it('takes FR-TRAJ-1’s set at now: the next 24 h and what is still up, each with its arc’s state', () => {
    const tonight = tonightPasses([gone, up, later, tomorrow], T);
    expect(tonight.map((pass) => pass.id)).toEqual(['up', 'later']);
    expect(tonight.map((pass) => pass.arc)).toEqual(['live', 'hidden']);
  });

  it('lists a pass whose drawn arc is in the field, with the legend’s key and colour, its state and its peak', () => {
    const tonight = tonightPasses([up, later], T);
    // Facing where the satellite is now: the part flown so far ends in the middle of the box.
    const now = up.track.filter((point) => point.t <= T).at(-1) ?? up.start;
    const listed = fieldPasses({ passes: tonight, rotation: handRotation({ azDeg: now.azDeg, altDeg: Math.max(now.elDeg, 10) }), view: VIEW, now: T });
    expect(listed).toEqual([{ id: 'up', key: 'A', color: 'series-1', name: up.name, state: 'live', peakAltDeg: up.peak.elDeg, peakPoint: compassPoint(up.peak.azDeg) }]);
  });

  it('lists nothing facing away from every arc, nothing hidden, and nothing in an unmeasured box', () => {
    const tonight = tonightPasses([up, later], T);
    const away = { azDeg: (up.start.azDeg + 180) % 360, altDeg: 5 };
    expect(fieldPasses({ passes: tonight, rotation: handRotation(away), view: { ...VIEW, fovDeg: 20 }, now: T })).toEqual([]);
    expect(fieldPasses({ passes: tonight, rotation: handRotation({ azDeg: up.start.azDeg, altDeg: 20 }), view: { ...VIEW, width: 0, height: 0 }, now: T })).toEqual([]);
    expect(fieldPasses({ passes: tonightPasses([later], T), rotation: handRotation({ azDeg: later.peak.azDeg, altDeg: later.peak.elDeg }), view: VIEW, now: T })).toEqual([]);
  });
});
