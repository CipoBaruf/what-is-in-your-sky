/**
 * R113 (FR-STAR-11, FR-STAR-9; PLAN D-750): the sky scene — what the window
 * draws beyond the layers `SkyChartProps` already carries. The horizon and the
 * rings, the Sun, the Moon and the passes stay where they are today, on the
 * props, so no caller changes; the scene names only what v2.4 adds, the star
 * field, and a window without a scene is `v2.3.0`'s byte for byte.
 *
 * The field's data is typed here structurally — the catalogue's columns as
 * D-748 lays them out, the positions as D-749 returns them, the four layer
 * switches of FR-STAR-3 — so the window (this lane) and the catalogue (the
 * `data` lane, R112) agree on a shape without one importing the other's file.
 * The window never computes a position: the page hands it the field at the
 * shown instant and the window only projects it (FR-STAR-2, FR-LIVE-10).
 */

/** One figure, as the catalogue stores it (D-748): the segments are index pairs into the star columns. */
export interface StarFigure {
  /** The IAU abbreviation, `Ori`, `Cru`; `Ser` appears twice with its two parts. */
  con: string;
  /** `""` for a whole constellation; `Caput` or `Cauda` for the halves of Serpens. */
  part: string;
  segments: readonly (readonly [number, number])[];
}

/**
 * The catalogue in columns, sorted by magnitude so the brightest come first
 * (D-748). `ArrayLike<number>` admits the typed arrays the reader returns and
 * the plain arrays a test writes by hand.
 */
export interface StarCatalog {
  /** J2000 right ascension, degrees. */
  ra: ArrayLike<number>;
  /** J2000 declination, degrees. */
  dec: ArrayLike<number>;
  /** Visual magnitude. */
  mag: ArrayLike<number>;
  /** The IAU proper name, or `""`. */
  name: readonly string[];
  /** The Bayer or Flamsteed designation, or the HR number. */
  desig: readonly string[];
  /** The constellation's IAU abbreviation. */
  con: readonly string[];
  figures: readonly StarFigure[];
}

/** One planet at the shown instant (D-749): where it is and how bright, the library's at that tick. */
export interface PlanetPosition {
  body: 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';
  azDeg: number;
  altDeg: number;
  mag: number;
}

/** Every star's place at the shown instant, in catalogue order (D-749): one rotation applied to every J2000 vector, no refraction. */
export interface StarPositions {
  altDeg: ArrayLike<number>;
  azDeg: ArrayLike<number>;
  planets: readonly PlanetPosition[];
}

/** FR-STAR-3's four layer switches, as the page's toggles hold them. */
export interface StarLayers {
  stars: boolean;
  figures: boolean;
  planets: boolean;
  names: boolean;
}

/** The star field: the catalogue, where everything in it is right now, and which layers are on. */
export interface StarField {
  catalog: StarCatalog;
  positions: StarPositions;
  layers: StarLayers;
}

/**
 * The scene (FR-STAR-11). `stars: null` is a window with no star field — the
 * live page's and the pass detail's — and draws exactly what it drew before
 * the scene existed.
 */
export interface SkyScene {
  stars: StarField | null;
}
