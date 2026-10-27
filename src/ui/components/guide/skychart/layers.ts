import { cutCatalog, prefix } from './catalogCut';
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

/**
 * The scene as `view` draws it: the layers the table leaves it, the stars cut
 * to its cap. A scene the table leaves whole — the window's, which draws every
 * layer and has no cap — is returned as it is, so a memo on it holds; so is a
 * scene with no stars.
 */
export function sceneFor(view: SkyView, scene: SkyScene | undefined): SkyScene | undefined {
  const field = scene?.stars;
  if (!scene || !field) return scene;
  const layers: StarField['layers'] = {
    stars: field.layers.stars && drawsLayer(view, 'stars'),
    figures: field.layers.figures && drawsLayer(view, 'figures'),
    planets: field.layers.planets && drawsLayer(view, 'planets'),
    names: field.layers.names && drawsLayer(view, 'names'),
  };
  const cap = STAR_MAG[view];
  if (cap === Infinity) {
    const whole = layers.stars === field.layers.stars && layers.figures === field.layers.figures && layers.planets === field.layers.planets && layers.names === field.layers.names;
    return whole ? scene : { ...scene, stars: { ...field, layers } };
  }
  const catalog = cutCatalog(field.catalog, cap);
  const n = catalog.mag.length;
  const { positions } = field;
  return {
    ...scene,
    stars: {
      // A figure's segments index the whole catalogue; a view that draws no figures carries none.
      catalog: { ...catalog, figures: layers.figures ? field.catalog.figures : [] },
      positions: { altDeg: prefix(positions.altDeg, n), azDeg: prefix(positions.azDeg, n), planets: positions.planets },
      layers,
    },
  };
}

/**
 * R127 (FR-SKY-11, D-796): the landmark star `view` rings, as a catalogue
 * index, or `null` — no landmark star in the scene, the layer not the view's,
 * the stars switch off, the star past the view's cap (the dome rings only one
 * of its own stars, never an empty place) or under the horizon. The scene is
 * the page's whole one: the cut is the prefix the cap gives, so the star is
 * in it exactly when its index is under the cut's length.
 */
export function landmarkFor(view: SkyView, scene: SkyScene | undefined): number | null {
  const star = scene?.landmark?.star;
  const field = scene?.stars;
  if (!star || !field || !field.layers.stars || !drawsLayer(view, 'landmark')) return null;
  const cut = sceneFor(view, scene)?.stars;
  if (!cut || star.index >= cut.catalog.mag.length) return null;
  const altDeg = field.positions.altDeg[star.index];
  return altDeg !== undefined && altDeg >= 0 ? star.index : null;
}

/** One star or planet a capped view places: its key, its direction, its magnitude (the catalogue's, or the planet's at the instant) and its identity — a catalogue index or a planet's name. */
export interface PlacedBody {
  key: string;
  azDeg: number;
  altDeg: number;
  mag: number;
  star?: number;
  planet?: string;
}

/**
 * The one visibility rule the polar chart and the dome share, on a field
 * `sceneFor` gave `view`: each star at the view's cap and above the horizon,
 * then each planet above it, for the switches the field leaves on. A star with
 * no altitude, or a NaN one, is not placed.
 */
export function starsFor(view: SkyView, field: StarField): PlacedBody[] {
  const { catalog, positions, layers } = field;
  const cap = STAR_MAG[view];
  const placed: PlacedBody[] = [];
  if (layers.stars) {
    for (let i = 0; i < catalog.mag.length; i += 1) {
      const altDeg = positions.altDeg[i];
      const mag = catalog.mag[i] ?? Number.NaN;
      if (!(mag <= cap) || altDeg === undefined || !(altDeg >= 0)) continue;
      placed.push({ key: `star-${String(i)}`, azDeg: positions.azDeg[i] ?? 0, altDeg, mag, star: i });
    }
  }
  if (layers.planets) {
    for (const planet of positions.planets) {
      if (!(planet.altDeg >= 0)) continue;
      placed.push({ key: `planet-${planet.body}`, azDeg: planet.azDeg, altDeg: planet.altDeg, mag: planet.mag, planet: planet.body });
    }
  }
  return placed;
}
