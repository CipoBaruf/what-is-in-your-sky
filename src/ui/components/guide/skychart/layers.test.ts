import { describe, expect, it } from 'vitest';
import { DOME_STAR_MAG, drawsLayer, landmarkFor, LAYERS, POLAR_STAR_MAG, sceneFor, starsFor, type Layer, type SkyView } from './layers';
import type { SkyLandmark, SkyScene, StarField } from './window/scene';

/**
 * FR-SKY-1 / PLAN §9.7 (R119): the layer table is a pure module — every view
 * names every layer one way or the other, the caps are the spec's, and
 * `sceneFor` applies the table to a scene without a view deciding anything.
 */
const EVERY_LAYER: readonly Layer[] = ['passes', 'bodies', 'stars', 'figures', 'planets', 'names', 'landmark', 'surface', 'haze', 'bloom', 'moonDisc', 'fieldOutline'];
const VIEWS: readonly SkyView[] = ['dome', 'polar', 'window', 'globe'];

/** Four stars in magnitude order (D-748) and one planet; star 3 is below the horizon. */
const field: StarField = {
    catalog: {
      ra: [0, 0, 0, 0],
      dec: [0, 0, 0, 0],
      mag: [-1.4, 1.5, 3.5, 4.4],
      name: ['Sirius', 'Adhara', 'C', 'D'],
      desig: ['α CMa', 'ε CMa', 'c', 'd'],
      con: ['CMa', 'CMa', 'CMa', 'CMa'],
      figures: [{ con: 'CMa', part: '', segments: [[0, 1]] }],
    },
    positions: { altDeg: [40, 30, 20, -5], azDeg: [90, 100, 110, 120], planets: [{ body: 'Venus', azDeg: 270, altDeg: 10, mag: -4 }] },
    layers: { stars: true, figures: true, planets: true, names: true },
};
const scene: SkyScene = { stars: field };

describe('the layer table (FR-SKY-1, D-788)', () => {
  it('names every layer for every view: drawn or skipped by the table, never by a view of its own', () => {
    for (const view of VIEWS) {
      expect(Object.keys(LAYERS)).toContain(view);
      for (const layer of EVERY_LAYER) expect(typeof drawsLayer(view, layer)).toBe('boolean');
      expect(new Set(LAYERS[view]).size).toBe(LAYERS[view].length);
      for (const layer of LAYERS[view]) expect(EVERY_LAYER).toContain(layer);
    }
    expect(Object.keys(LAYERS).sort()).toEqual([...VIEWS].sort());
  });

  /** R158 (FR-PHONE-8, FR-PHONE-9, FR-SKY-1 as amended v2.10; D-968, D-969). */
  it('gives the polar chart every layer — the star layer whole, the look, and the field outline — and the window every layer but the outline, which is its own field', () => {
    expect([...LAYERS.polar].sort()).toEqual([...EVERY_LAYER].sort());
    expect([...LAYERS.window].sort()).toEqual(EVERY_LAYER.filter((layer) => layer !== 'fieldOutline').sort());
    for (const layer of ['figures', 'names', 'surface', 'haze', 'bloom', 'moonDisc', 'fieldOutline'] as const) expect(drawsLayer('polar', layer)).toBe(true);
    expect(drawsLayer('window', 'fieldOutline')).toBe(false);
  });

  it('leaves the dome’s row as it was: the passes, the bodies, the stars, the planets and the landmark (FR-PHONE-11)', () => {
    expect([...LAYERS.dome].sort()).toEqual(['bodies', 'landmark', 'passes', 'planets', 'stars']);
    for (const layer of ['figures', 'names', 'surface', 'haze', 'bloom', 'moonDisc', 'fieldOutline'] as const) expect(drawsLayer('dome', layer)).toBe(false);
  });

  it('FR-WIDE-3: gives the globe the window’s row, the field outline off, and no star cap (D-1099)', () => {
    expect([...LAYERS.globe].sort()).toEqual([...LAYERS.window].sort());
    expect(drawsLayer('globe', 'fieldOutline')).toBe(false);
    expect(sceneFor('globe', scene)).toBe(scene);
  });

  it('caps the polar chart at the catalogue’s 4.5 and the dome at 1.5', () => {
    expect(POLAR_STAR_MAG).toBe(4.5);
    expect(DOME_STAR_MAG).toBe(1.5);
  });
});

/** R127 (FR-SKY-11, D-796): which view rings the landmark — every view, but the dome only one of its own stars. */
describe('landmarkFor (FR-SKY-11)', () => {
  const landmarkOf = (index: number): SkyLandmark => ({ passId: 'p', star: { index, sepDeg: 3, word: 'above' }, among: null });

  it('rings a bright star in every view, and a star past the dome’s cap in the window and the polar chart alone', () => {
    const bright: SkyScene = { stars: field, landmark: landmarkOf(1) };
    for (const view of VIEWS) expect(landmarkFor(view, bright)).toBe(1);
    // Star 2 is V 3.5: within the polar chart's cap, past the dome's.
    const faint: SkyScene = { stars: field, landmark: landmarkOf(2) };
    expect(landmarkFor('window', faint)).toBe(2);
    expect(landmarkFor('polar', faint)).toBe(2);
    expect(landmarkFor('dome', faint)).toBeNull();
  });

  it('rings nothing without a landmark star, with the stars switch off, under the horizon, or with no scene', () => {
    expect(landmarkFor('window', { stars: field, landmark: { passId: 'p', star: null, among: { con: 'CMa', part: 0 } } })).toBeNull();
    expect(landmarkFor('window', { stars: field, landmark: null })).toBeNull();
    expect(landmarkFor('window', { stars: field })).toBeNull();
    expect(landmarkFor('window', { stars: { ...field, layers: { ...field.layers, stars: false } }, landmark: landmarkOf(1) })).toBeNull();
    expect(landmarkFor('window', { stars: field, landmark: landmarkOf(3) })).toBeNull();
    expect(landmarkFor('window', { stars: null, landmark: landmarkOf(1) })).toBeNull();
    expect(landmarkFor('window', undefined)).toBeNull();
  });
});

describe('sceneFor (FR-SKY-1)', () => {
  it('hands the window the scene itself', () => {
    expect(sceneFor('window', scene)).toBe(scene);
    expect(sceneFor('window', undefined)).toBeUndefined();
    const none: SkyScene = { stars: null };
    expect(sceneFor('dome', none)).toBe(none);
  });

  it('applies the table to the window too: a scene is handed back whole only when the window draws every switch it has on', () => {
    // Every row of the window's is on today, so the scene comes back as it is; the check is the table's, not a shortcut for the uncapped view.
    const off: SkyScene = { stars: { ...field, layers: { stars: false, figures: true, planets: false, names: true } } };
    expect(sceneFor('window', off)).toBe(off);
  });

  it('cuts each catalogue once per cap and moves only the positions from tick to tick', () => {
    const next: SkyScene = { stars: { ...field, positions: { ...field.positions, altDeg: [41, 31, 21, -4] } } };
    const a = sceneFor('polar', scene)?.stars;
    const b = sceneFor('polar', next)?.stars;
    expect(b?.catalog.mag).toBe(a?.catalog.mag);
    expect(b?.catalog.name).toBe(a?.catalog.name);
    expect(b?.positions.altDeg).toEqual([41, 31, 21, -4]);
    const c = sceneFor('dome', next)?.stars;
    expect(sceneFor('dome', scene)?.stars?.catalog.mag).toBe(c?.catalog.mag);
  });

  it('cuts the polar chart to the stars at 4.5 or brighter and keeps the planets, the figures and the names (R158)', () => {
    const polar = sceneFor('polar', scene)?.stars;
    expect(polar?.catalog.mag).toEqual([-1.4, 1.5, 3.5, 4.4]);
    expect(polar?.catalog.name).toEqual(['Sirius', 'Adhara', 'C', 'D']);
    expect(polar?.positions.altDeg).toEqual([40, 30, 20, -5]);
    expect(polar?.positions.azDeg).toEqual([90, 100, 110, 120]);
    expect(polar?.positions.planets).toBe(field.positions.planets);
    expect(polar?.catalog.figures).toBe(field.catalog.figures);
    expect(polar?.layers).toEqual({ stars: true, figures: true, planets: true, names: true });
    // A star past 4.5 (a hand-written catalogue's; the app's own stops there) is cut, and a switch the page turned off stays off.
    const deep: SkyScene = { stars: { ...field, catalog: { ...field.catalog, mag: [-1.4, 1.5, 3.5, 4.6] }, layers: { ...field.layers, names: false } } };
    const cut = sceneFor('polar', deep)?.stars;
    expect(cut?.catalog.mag).toEqual([-1.4, 1.5, 3.5]);
    expect(cut?.layers.names).toBe(false);
  });

  it('cuts the dome to the stars at 1.5 or brighter, and keeps a switch the page turned off', () => {
    const off: SkyScene = { stars: { ...field, layers: { stars: true, figures: true, planets: false, names: true } } };
    const dome = sceneFor('dome', off)?.stars;
    expect(dome?.catalog.mag).toEqual([-1.4, 1.5]);
    expect(dome?.positions.altDeg).toEqual([40, 30]);
    expect(dome?.layers).toEqual({ stars: true, figures: false, planets: false, names: false });
  });

  it('cuts typed columns the same way', () => {
    const typed: SkyScene = {
      stars: {
        ...field,
        catalog: { ...field.catalog, mag: new Float32Array([-1.5, 1.5, 3.5, 4.5]) },
        positions: { ...field.positions, altDeg: new Float32Array([40, 30, 20, -5]), azDeg: new Float32Array([90, 100, 110, 120]) },
      },
    };
    const dome = sceneFor('dome', typed)?.stars;
    expect(Array.from(dome?.catalog.mag ?? [])).toEqual([-1.5, 1.5]);
    expect(Array.from(dome?.positions.azDeg ?? [])).toEqual([90, 100]);
  });

  it('keeps a bright star behind a faint or NaN one, so the cap does not hang on the order', () => {
    const unordered: StarField = {
      ...field,
      catalog: { ...field.catalog, mag: [-1.4, Number.NaN, 4.4, 1.0] },
      positions: { ...field.positions, altDeg: [40, 30, 20, 10] },
    };
    const dome = sceneFor('dome', { stars: unordered })?.stars;
    expect(dome?.catalog.mag).toHaveLength(4);
    expect(starsFor('dome', dome as StarField).map((body) => body.key)).toEqual(['star-0', 'star-3', 'planet-Venus']);
  });
});

describe('starsFor (FR-SKY-1): the polar chart and the dome place by one rule', () => {
  it('places each star at the cap above the horizon by catalogue index, then each planet above it, each with its magnitude', () => {
    const polar = sceneFor('polar', scene)?.stars as StarField;
    expect(starsFor('polar', polar)).toEqual([
      { key: 'star-0', azDeg: 90, altDeg: 40, mag: -1.4, star: 0 },
      { key: 'star-1', azDeg: 100, altDeg: 30, mag: 1.5, star: 1 },
      { key: 'star-2', azDeg: 110, altDeg: 20, mag: 3.5, star: 2 },
      // Star 3 (V 4.4) is within the cap and under the horizon.
      { key: 'planet-Venus', azDeg: 270, altDeg: 10, mag: -4, planet: 'Venus' },
    ]);
  });

  it('skips a star or planet below the horizon or with no altitude, and a switch that is off', () => {
    const low: StarField = { ...field, positions: { altDeg: [Number.NaN, -1, 0], azDeg: [0, 0, 0], planets: [{ body: 'Mars', azDeg: 0, altDeg: -2, mag: 1 }] } };
    expect(starsFor('polar', low).map((body) => body.key)).toEqual(['star-2']);
    expect(starsFor('polar', { ...field, layers: { ...field.layers, stars: false } }).map((body) => body.key)).toEqual(['planet-Venus']);
  });
});
