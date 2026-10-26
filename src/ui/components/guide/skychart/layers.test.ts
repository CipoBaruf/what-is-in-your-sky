import { describe, expect, it } from 'vitest';
import { DOME_STAR_MAG, drawsLayer, LAYERS, POLAR_STAR_MAG, sceneFor, type Layer, type SkyView } from './layers';
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
});
