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

type Catalog = StarField['catalog'];

/** The first `n` of a column. */
function prefix<T>(column: ArrayLike<T>, n: number): ArrayLike<T> {
  return n >= column.length ? column : Array.prototype.slice.call(column, 0, n);
}

/**
 * How far into the catalogue a cap reaches: one past the last star at `cap` or
 * brighter. In D-748's magnitude order that is exactly the stars at the cap;
 * out of order, no bright star is lost behind a faint one, and a missing or
 * NaN magnitude never counts — `starsFor` holds the cap star by star.
 */
function reach(mag: ArrayLike<number>, cap: number): number {
  for (let i = mag.length - 1; i >= 0; i -= 1) if ((mag[i] ?? Number.NaN) <= cap) return i + 1;
  return 0;
}

/** The catalogue cut to each cap, once per catalogue: only the positions change from tick to tick. */
const cuts = new WeakMap<Catalog, Map<number, Catalog>>();

/**
 * The catalogue cut to the stars at `cap` or brighter (D-748's prefix), with no figures — a figure's segments
 * index the whole catalogue. Memoised per catalogue and cap, so a memo on the cut holds from tick to tick: the
 * views' caps here, and the scene's twilight step (`useSkyScene`, R123).
 */
export function cutCatalog(catalog: Catalog, cap: number): Catalog {
  let byCap = cuts.get(catalog);
  if (!byCap) {
    byCap = new Map();
    cuts.set(catalog, byCap);
  }
  let cut = byCap.get(cap);
  if (!cut) {
    const n = reach(catalog.mag, cap);
    cut = {
      ra: prefix(catalog.ra, n),
      dec: prefix(catalog.dec, n),
      mag: prefix(catalog.mag, n),
      name: catalog.name.slice(0, n),
      desig: catalog.desig.slice(0, n),
      con: catalog.con.slice(0, n),
      figures: [],
    };
    byCap.set(cap, cut);
  }
  return cut;
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
