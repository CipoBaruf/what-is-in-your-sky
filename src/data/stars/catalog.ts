import { z } from '../zod';
import catalogJson from './catalog.json';
import { CONSTELLATION_NAMES, CONSTELLATION_WHOLE_NAMES } from './constellations';

/**
 * FR-STAR-1 (R112, D-748): the star catalogue, read once from the committed
 * build output `catalog.json` (`npm run build:stars`) and handed out as typed
 * arrays in catalogue order — brightest first. Star `i` is `ra[i]`, `dec[i]`,
 * `mag[i]`, `name[i]`, `nameEs[i]`, `desig[i]`, `con[i]`; a figure's segments
 * are pairs of those indices.
 *
 * Positions are J2000 degrees with no proper motion; `lib/skyStars.ts` turns
 * them into an observer's sky. The names are data in the `stars` chunk, never
 * strings in the catalog (FR-STAR-10 as amended v2.5, D-832): the Spanish ones
 * come from `data-src/stars/names-es.tsv` through the build, the figures' Latin
 * names are `constellations.ts`, and `lib/skyStars.ts`'s `starName`,
 * `figureName` and `constellationName` are the only readers of either.
 */

/** The file's shape as the build writes it (`scripts/build-stars.ts`, `CatalogOut`). */
interface CatalogFile {
  ra: number[];
  dec: number[];
  mag: number[];
  name: string[];
  nameEs: string[];
  desig: string[];
  con: string[];
  figures: { con: string; part: number; segments: number[][] }[];
  figuresEs: Record<string, string[]>;
  wholeEs: Record<string, string>;
}

/**
 * A cheap shape check, not an element-by-element parse: every column is an
 * array with one entry per star, and the Spanish tables hold a name for
 * every abbreviation and part the English ones do, so `figureName(…, 'es')`
 * never comes back empty where `'en'` does not. The values themselves are held by
 * `tests/data/starCatalog.test.ts`, which re-runs the build and asserts the
 * committed file byte for byte, so the main thread does not walk them again.
 */
const column = z.custom<unknown[]>((v) => Array.isArray(v), 'an array');
const names = z.custom<string[]>((v) => Array.isArray(v) && v.every((n) => typeof n === 'string' && n !== ''), 'an array of names');
/** Whether `table` has exactly `latin`'s abbreviations as keys (D-832). */
const sameKeys = (table: Readonly<Record<string, unknown>>, latin: Readonly<Record<string, unknown>>): boolean => {
  const keys = Object.keys(latin);
  return Object.keys(table).length === keys.length && keys.every((k) => Object.hasOwn(table, k));
};
const catalogSchema = z
  .object({ ra: column, dec: column, mag: column, name: column, nameEs: column, desig: column, con: column, figures: column, figuresEs: z.record(z.string(), names), wholeEs: z.record(z.string(), z.string()) })
  .refine((c) => [c.dec, c.mag, c.name, c.nameEs, c.desig, c.con].every((col) => col.length === c.ra.length), 'every column has one entry per star')
  .refine((c) => sameKeys(c.figuresEs, CONSTELLATION_NAMES) && Object.entries(CONSTELLATION_NAMES).every(([con, latin]) => c.figuresEs[con]?.length === latin.length), 'figuresEs names every part CONSTELLATION_NAMES does')
  .refine((c) => sameKeys(c.wholeEs, CONSTELLATION_WHOLE_NAMES) && Object.values(c.wholeEs).every((n) => n !== ''), 'wholeEs names every whole CONSTELLATION_WHOLE_NAMES does');

/** One drawn feature: `segments` is flat, `[a0, b0, a1, b1, …]`, star indices. */
interface StarFigure {
  con: string;
  /** 0, or 1 for the second half of Serpens (`constellations.ts`). */
  part: number;
  segments: Uint16Array;
}

export interface StarCatalog {
  size: number;
  /** J2000 right ascension, degrees. */
  ra: Float64Array;
  /** J2000 declination, degrees. */
  dec: Float64Array;
  /** Visual magnitude. */
  mag: Float32Array;
  /** IAU proper name, or `''`. */
  name: readonly string[];
  /** Spanish name where `names-es.tsv` has one, or `''` (D-832). */
  nameEs: readonly string[];
  /** Bayer or Flamsteed designation (`Alp UMa`, `61 Cyg`), or `HR n`. */
  desig: readonly string[];
  /** IAU constellation abbreviation. */
  con: readonly string[];
  figures: readonly StarFigure[];
  /** Each language's name of every drawn part, by abbreviation, indexed by `part`. */
  figureNames: Readonly<Record<'en' | 'es', Readonly<Record<string, readonly string[]>>>>;
  /** Each language's name of a constellation drawn in more than one part, whole (`Ser`). */
  wholeNames: Readonly<Record<'en' | 'es', Readonly<Record<string, string>>>>;
}

/** The file's JSON, its shape checked, as typed arrays. */
export function parseStarCatalog(json: unknown): StarCatalog {
  catalogSchema.parse(json);
  const c = json as CatalogFile;
  return Object.freeze({
    size: c.ra.length,
    ra: Float64Array.from(c.ra),
    dec: Float64Array.from(c.dec),
    mag: Float32Array.from(c.mag),
    name: Object.freeze(c.name),
    nameEs: Object.freeze(c.nameEs),
    desig: Object.freeze(c.desig),
    con: Object.freeze(c.con),
    figures: Object.freeze(c.figures.map((f) => Object.freeze({ con: f.con, part: f.part, segments: Uint16Array.from(f.segments.flat()) }))),
    figureNames: Object.freeze({ en: CONSTELLATION_NAMES, es: Object.freeze(c.figuresEs) }),
    wholeNames: Object.freeze({ en: CONSTELLATION_WHOLE_NAMES, es: Object.freeze(c.wholeEs) }),
  });
}

let parsed: StarCatalog | undefined;

/** The catalogue, parsed on first use and kept. */
export function starCatalog(): StarCatalog {
  parsed ??= parseStarCatalog(catalogJson);
  return parsed;
}
