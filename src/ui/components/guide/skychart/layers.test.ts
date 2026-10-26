import { describe, expect, it } from 'vitest';
import { DOME_STAR_MAG, drawsLayer, LAYERS, POLAR_STAR_MAG, sceneFor, starsFor, type Layer, type SkyView } from './layers';
import type { SkyScene, StarField } from './window/scene';

/**
 * FR-SKY-1 / PLAN §9.7 (R119): the layer table is a pure module — every view
 * names every layer one way or the other, the caps are the spec's, and
 * `sceneFor` applies the table to a scene without a view deciding anything.
 */
const EVERY_LAYER: readonly Layer[] = ['passes', 'bodies', 'stars', 'figures', 'planets', 'names', 'landmark'];
const VIEWS: readonly SkyView[] = ['dome', 'polar', 'window'];

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

  it('gives the window every layer, the polar chart and the dome the passes, the bodies, the stars, the planets and the landmark, and neither the figures nor the names', () => {
    expect([...LAYERS.window].sort()).toEqual([...EVERY_LAYER].sort());
    for (const view of ['polar', 'dome'] as const) {
      expect([...LAYERS[view]].sort()).toEqual(['bodies', 'landmark', 'passes', 'planets', 'stars']);
      expect(drawsLayer(view, 'figures')).toBe(false);
      expect(drawsLayer(view, 'names')).toBe(false);
    }
  });

  it('caps the polar chart at 3.5 and the dome at 1.5', () => {
    expect(POLAR_STAR_MAG).toBe(3.5);
    expect(DOME_STAR_MAG).toBe(1.5);
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
    expect(b?.positions.altDeg).toEqual([41, 31, 21]);
  });

  it('cuts the polar chart to the stars at 3.5 or brighter with the planets, no figures and no names', () => {
    const polar = sceneFor('polar', scene)?.stars;
    expect(polar?.catalog.mag).toEqual([-1.4, 1.5, 3.5]);
    expect(polar?.catalog.name).toEqual(['Sirius', 'Adhara', 'C']);
    expect(polar?.positions.altDeg).toEqual([40, 30, 20]);
    expect(polar?.positions.azDeg).toEqual([90, 100, 110]);
    expect(polar?.positions.planets).toBe(field.positions.planets);
    expect(polar?.catalog.figures).toEqual([]);
    expect(polar?.layers).toEqual({ stars: true, figures: false, planets: true, names: false });
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
      { key: 'planet-Venus', azDeg: 270, altDeg: 10, mag: -4, planet: 'Venus' },
    ]);
  });

  it('skips a star or planet below the horizon or with no altitude, and a switch that is off', () => {
    const low: StarField = { ...field, positions: { altDeg: [Number.NaN, -1, 0], azDeg: [0, 0, 0], planets: [{ body: 'Mars', azDeg: 0, altDeg: -2, mag: 1 }] } };
    expect(starsFor('polar', low).map((body) => body.key)).toEqual(['star-2']);
    expect(starsFor('polar', { ...field, layers: { ...field.layers, stars: false } }).map((body) => body.key)).toEqual(['planet-Venus']);
  });
});
