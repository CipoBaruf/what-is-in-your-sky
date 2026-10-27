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

/*
 * Only `StarField` and `SkyScene` are exported: the parts are reached through
 * them (`StarField['catalog']`) until a task imports one by name — the
 * dead-export check (D-647) would otherwise fail on what is, for now, a
 * contract and not a dependency.
 */

/** One figure, as the catalogue stores it (D-748): the segments are index pairs into the star columns. */
interface StarFigure {
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
interface StarCatalog {
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
  /**
   * R127 (FR-STAR-10 as amended v2.5, D-832): the names as data, so a view reads
   * them through `lib/skyStars.ts`'s accessors and in the reader's language.
   * Optional: a catalogue built by hand (a test's) without them is read in
   * English with the abbreviation where a table is missing.
   */
  /** The Spanish name where `names-es.tsv` has one, else `''`. */
  nameEs?: readonly string[];
  /** Each language's name of every drawn part, by abbreviation, indexed by `part`. */
  figureNames?: Readonly<Record<'en' | 'es', Readonly<Record<string, readonly string[]>>>>;
  /** Each language's one name of a constellation drawn in parts (`Ser`). */
  wholeNames?: Readonly<Record<'en' | 'es', Readonly<Record<string, string>>>>;
}

/** One planet at the shown instant (D-749): where it is and how bright, the library's at that tick. */
interface PlanetPosition {
  body: 'Mercury' | 'Venus' | 'Mars' | 'Jupiter' | 'Saturn';
  azDeg: number;
  altDeg: number;
  mag: number;
}

/** Every star's place at the shown instant, in catalogue order (D-749): one rotation applied to every J2000 vector, no refraction. */
interface StarPositions {
  altDeg: ArrayLike<number>;
  azDeg: ArrayLike<number>;
  planets: readonly PlanetPosition[];
}

/** FR-STAR-3's four layer switches, as the page's toggles hold them. */
interface StarLayers {
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
 * R127 (FR-SKY-11, FR-SKY-12; D-796): the highlighted pass's landmark, the
 * scene's and so one star in every view. `star` is the bright star nearest the
 * peak (`lib/landmark.ts`'s `landmark`), `null` where none is within reach;
 * `among` the figure the peak is among (`constellationAt`), `null` past
 * `AMONG_MAX_DEG`. The scene carries it only when one of the two is there.
 */
export interface SkyLandmark {
  /** The pass whose peak it is — the highlighted one: the headline's on the live page, the explained one on the pass detail. */
  passId: string;
  star: {
    /** The star's catalogue index. */
    index: number;
    /** Its distance from the peak, degrees. */
    sepDeg: number;
    /** The peak against the star. */
    word: 'above' | 'below' | 'beside';
  } | null;
  among: { con: string; part: number } | null;
}

/**
 * The scene (FR-STAR-11). `stars: null` is a window with no star field — the
 * live page's and the pass detail's — and draws exactly what it drew before
 * the scene existed. R127: `landmark` is the highlighted pass's; absent or
 * `null`, nothing is ringed, named or lined.
 */
export interface SkyScene {
  stars: StarField | null;
  landmark?: SkyLandmark | null;
}
