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
import { legendRows, type LegendPass, type LegendRow } from '../../../lib/legend';
import { LIVE_WINDOW_MS, livePasses } from '../../../lib/livePasses';
import { resampleArc } from '../../../lib/skyGeometry';
import { starName, starsAt } from '../../../lib/skyStars';
import type { EpochMs, Pass } from '../../../model';
import { handRotation } from '../../components/guide/skychart/window/camera';
import { project, WINDOW_FOV, WINDOW_FOV_MIN_DEG, type View } from '../../components/guide/skychart/window/projection';
import { arcKey, withArcStates } from '../../components/live/liveArcs';
import { FIELD_LIST_MAX, fieldObjects, fieldPasses, fieldRows, formatStarMag, sceneCatalog, type FieldObject, type FieldPass } from './field';

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

/** The page's set at `T` (FR-SKY-6): the live page's `livePasses`, the arcs' states, and the legend's rows over them. */
function tonight(passes: readonly Pass[]): { passes: readonly LegendPass[]; rows: LegendRow[] } {
  const set = livePasses(passes, T);
  const withStates = withArcStates(set, arcKey(set, T));
  return { passes: withStates, rows: legendRows({ passes: withStates, highlightedPassId: null, now: T, colorBy: 'pass' }) };
}

describe('the passes in the field (FR-SKY-6, D-794)', () => {
  const golden = goldenPassFixture();
  const up = shiftPass(golden, T - 10_000 - golden.start.t, 'up');
  const later = shiftPass(golden, T + 6 * 3_600_000 - golden.start.t, 'later');
  const gone = shiftPass(golden, T - 3 * 3_600_000 - golden.start.t, 'gone');
  const tomorrow = shiftPass(golden, T + LIVE_WINDOW_MS + 60_000 - golden.start.t, 'tomorrow');
  const soon = shiftPass(golden, T + 60_000 - golden.start.t, 'soon');

  it('takes the live page’s set at now: the next 24 h and what is still up, each with its arc’s state', () => {
    const { passes } = tonight([gone, up, later, tomorrow]);
    expect(passes.map((pass) => pass.id)).toEqual(['up', 'later']);
    expect(passes.map((pass) => pass.arc)).toEqual(['live', 'hidden']);
  });

  it('lists a pass whose drawn arc is in the field, with the legend’s key and colour, its state and its peak', () => {
    const scene = tonight([up, later]);
    // Facing where the satellite is now: the part flown so far ends in the middle of the box.
    const now = up.track.filter((point) => point.t <= T).at(-1) ?? up.start;
    const listed = fieldPasses({ ...scene, rotation: handRotation({ azDeg: now.azDeg, altDeg: Math.max(now.elDeg, 10) }), view: VIEW, now: T });
    expect(listed).toEqual([{ id: 'up', key: 'A', color: 'series-1', name: up.name, state: 'live', peakAltDeg: up.peak.elDeg, peakPoint: compassPoint(up.peak.azDeg) }]);
  });

  it('lists nothing facing away from every arc, nothing hidden, and nothing in an unmeasured box', () => {
    const scene = tonight([up, later]);
    const away = { azDeg: (up.start.azDeg + 180) % 360, altDeg: 5 };
    expect(fieldPasses({ ...scene, rotation: handRotation(away), view: { ...VIEW, fovDeg: 20 }, now: T })).toEqual([]);
    expect(fieldPasses({ ...scene, rotation: handRotation({ azDeg: up.start.azDeg, altDeg: 20 }), view: { ...VIEW, width: 0, height: 0 }, now: T })).toEqual([]);
    expect(fieldPasses({ ...tonight([later]), rotation: handRotation({ azDeg: later.peak.azDeg, altDeg: later.peak.elDeg }), view: VIEW, now: T })).toEqual([]);
  });

  it('lists a pass whose arc only crosses a zoomed-in field between two samples (R126 review)', () => {
    const scene = tonight([soon]);
    expect(scene.passes[0]?.arc).toBe('ahead');
    const samples = resampleArc(soon.track, 2);
    const view: View = { fovDeg: WINDOW_FOV_MIN_DEG, width: 120, height: 120, screenAngleDeg: 0 };
    const inside = (p: { x: number; y: number }): boolean => p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height;
    // Walk the camera round a sample 30° up until the drawn line clips a corner of the box with no sample inside it.
    const centre = samples.reduce((best, point) => (Math.abs(point.elDeg - 30) < Math.abs(best.elDeg - 30) ? point : best));
    let found = 0;
    for (let dAz = -15; dAz <= 15; dAz += 0.2) {
      for (let dAlt = -12; dAlt <= 12; dAlt += 0.2) {
        const rotation = handRotation({ azDeg: centre.azDeg + dAz, altDeg: centre.elDeg + dAlt });
        const points = samples.map((point) => project(rotation, point.azDeg, point.elDeg, view));
        if (points.some((p) => p.front && inside(p))) continue;
        // The line between two samples, at a hundred steps per segment.
        const crosses = points.some((a, i) => {
          const b = points[i + 1];
          if (!b || !a.front || !b.front) return false;
          for (let k = 1; k < 100; k += 1) if (inside({ x: a.x + ((b.x - a.x) * k) / 100, y: a.y + ((b.y - a.y) * k) / 100 })) return true;
          return false;
        });
        if (!crosses) continue;
        found += 1;
        expect(fieldPasses({ ...scene, rotation, view, now: T }).map((pass) => pass.id)).toEqual(['soon']);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('lists no pass whose state has no FR-LEG-3 word (an arc handed in with no state is `full`)', () => {
    const passes: LegendPass[] = [up];
    const rows = legendRows({ passes, highlightedPassId: null, now: T, colorBy: 'pass' });
    expect(rows[0]?.state).toBe('full');
    const now = up.track.filter((point) => point.t <= T).at(-1) ?? up.start;
    expect(fieldPasses({ passes, rows, rotation: handRotation({ azDeg: now.azDeg, altDeg: Math.max(now.elDeg, 10) }), view: VIEW, now: T })).toEqual([]);
  });
});

describe('the list’s twelve rows with the passes in them (FR-STAR-7, D-825)', () => {
  const pass = (id: string): FieldPass => ({ id, key: id, color: 'series-1', name: id, state: 'live', peakAltDeg: 40, peakPoint: 'N' });
  const object = (index: number): FieldObject => ({ index, name: String(index), planet: null, mag: index, altDeg: 30, point: 'S' });
  const objects = Array.from({ length: FIELD_LIST_MAX }, (_, i) => object(i));

  it('puts the passes first and fills what is left of FIELD_LIST_MAX with the brightest objects', () => {
    const listed = fieldRows([pass('A'), pass('B')], objects);
    expect(listed.passes.map((p) => p.id)).toEqual(['A', 'B']);
    expect(listed.objects.map((o) => o.index)).toEqual(objects.slice(0, FIELD_LIST_MAX - 2).map((o) => o.index));
  });

  it('never lists more than FIELD_LIST_MAX rows, however many passes', () => {
    const many = Array.from({ length: FIELD_LIST_MAX + 3 }, (_, i) => pass(String(i)));
    const listed = fieldRows(many, objects);
    expect(listed.passes).toHaveLength(FIELD_LIST_MAX);
    expect(listed.objects).toEqual([]);
  });

  it('leaves the stars’ twelve alone with no pass', () => {
    expect(fieldRows([], objects).objects).toEqual(objects);
  });
});
