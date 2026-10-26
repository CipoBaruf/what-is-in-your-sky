import type { SkyScene, StarField } from './window/scene';

/**
 * R119 (FR-SKY-1, FR-LIVE-10 as amended; PLAN D-788): the layer table — what
 * each view takes from the one scene a page builds (`useSkyScene`). A view
 * filters the scene through `sceneFor` and has no condition of its own: the
 * window draws every layer; the polar chart the passes, the bodies, the
 * planets and the stars to `POLAR_STAR_MAG`, no figures and no names (OQ-43);
 * the dome the passes, the bodies, the planets as dots and the stars to
 * `DOME_STAR_MAG`, no figures and no names. The landmark's ring (FR-SKY-11) is
 * every view's; its name rides with the `names` layer, which only the window
 * draws (the dome's font holds no letters, the polar disc no room).
 *
 * Pure: no React, no DOM, no clock. The passes and the bodies are rows of the
 * table but stay on their own props (`passes`, `sun`, `moon`): the table says
 * a view draws them, the props carry them, as before.
 */

export type SkyView = 'dome' | 'polar' | 'window';

export type Layer = 'passes' | 'bodies' | 'stars' | 'figures' | 'planets' | 'names' | 'landmark';

/** The faintest star the polar chart draws (FR-SKY-1, FR-SKY-4). */
export const POLAR_STAR_MAG = 3.5;
/** The faintest star the dome draws (FR-SKY-1, FR-SKY-5). */
export const DOME_STAR_MAG = 1.5;

export const LAYERS: Record<SkyView, readonly Layer[]> = {
  window: ['passes', 'bodies', 'stars', 'figures', 'planets', 'names', 'landmark'],
  polar: ['passes', 'bodies', 'stars', 'planets', 'landmark'],
  dome: ['passes', 'bodies', 'stars', 'planets', 'landmark'],
};

/** The star cap per view: the window draws the whole catalogue, whose own cut is FR-STAR-1's. */
const STAR_MAG: Record<SkyView, number> = { window: Infinity, polar: POLAR_STAR_MAG, dome: DOME_STAR_MAG };

export function drawsLayer(view: SkyView, layer: Layer): boolean {
  return LAYERS[view].includes(layer);
}

/** The first `n` of a column; the catalogue is in magnitude order (D-748), so a cap is a prefix. */
function prefix<T>(column: ArrayLike<T>, n: number): ArrayLike<T> {
  return n >= column.length ? column : Array.prototype.slice.call(column, 0, n);
}

/** How many of the catalogue's stars are at `mag` or brighter: the first index past it. */
function brighterThan(mag: ArrayLike<number>, cap: number): number {
  let n = 0;
  while (n < mag.length && (mag[n] ?? Infinity) <= cap) n += 1;
  return n;
}

/**
 * The scene as `view` draws it: the layers the table leaves it, the stars cut
 * to its cap. The window, the one view without a cap, draws every layer and
 * gets the scene itself, so a memo on it holds; a scene with no stars is
 * returned as it is.
 */
export function sceneFor(view: SkyView, scene: SkyScene | undefined): SkyScene | undefined {
  const field = scene?.stars;
  const cap = STAR_MAG[view];
  if (!scene || !field || cap === Infinity) return scene;
  const layers: StarField['layers'] = {
    stars: field.layers.stars && drawsLayer(view, 'stars'),
    figures: field.layers.figures && drawsLayer(view, 'figures'),
    planets: field.layers.planets && drawsLayer(view, 'planets'),
    names: field.layers.names && drawsLayer(view, 'names'),
  };
  const n = brighterThan(field.catalog.mag, cap);
  const { catalog, positions } = field;
  return {
    ...scene,
    stars: {
      catalog: {
        ra: prefix(catalog.ra, n),
        dec: prefix(catalog.dec, n),
        mag: prefix(catalog.mag, n),
        name: catalog.name.slice(0, n),
        desig: catalog.desig.slice(0, n),
        con: catalog.con.slice(0, n),
        // A figure's segments index the whole catalogue; a view that draws no figures carries none.
        figures: layers.figures ? catalog.figures : [],
      },
      positions: { altDeg: prefix(positions.altDeg, n), azDeg: prefix(positions.azDeg, n), planets: positions.planets },
      layers,
    },
  };
}
