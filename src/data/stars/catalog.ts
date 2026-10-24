import { z } from '../zod';
import catalogJson from './catalog.json';

/**
 * FR-STAR-1 (R112, D-748): the star catalogue, read once from the committed
 * build output `catalog.json` (`npm run build:stars`) and handed out as typed
 * arrays in catalogue order — brightest first. Star `i` is `ra[i]`, `dec[i]`,
 * `mag[i]`, `name[i]`, `desig[i]`, `con[i]`; a figure's segments are pairs of
 * those indices.
 *
 * Positions are J2000 degrees with no proper motion; `lib/skyStars.ts` turns
 * them into an observer's sky. The names are data, the same in both languages
 * (FR-STAR-10 as amended); the figures' Latin names are `constellations.ts`.
 */

const figureSchema = z.object({
  con: z.string().min(1),
  part: z.number().int().min(0),
  segments: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])),
});

export const catalogSchema = z
  .object({
    ra: z.array(z.number().min(0).max(360)),
    dec: z.array(z.number().min(-90).max(90)),
    mag: z.array(z.number()),
    name: z.array(z.string()),
    desig: z.array(z.string().min(1)),
    con: z.array(z.string().min(1)),
    figures: z.array(figureSchema),
  })
  .refine((c) => [c.dec, c.mag, c.name, c.desig, c.con].every((column) => column.length === c.ra.length), 'every column has one entry per star')
  .refine((c) => c.figures.every((f) => f.segments.every(([a, b]) => a < c.ra.length && b < c.ra.length)), 'every figure endpoint is a star');

/** One drawn feature: `segments` is flat, `[a0, b0, a1, b1, …]`, star indices. */
export interface StarFigure {
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
  /** Bayer or Flamsteed designation (`Alp UMa`, `61 Cyg`), or `HR n`. */
  desig: readonly string[];
  /** IAU constellation abbreviation. */
  con: readonly string[];
  figures: readonly StarFigure[];
}

/** The file's JSON, validated, as typed arrays. */
export function parseStarCatalog(json: unknown): StarCatalog {
  const c = catalogSchema.parse(json);
  return Object.freeze({
    size: c.ra.length,
    ra: Float64Array.from(c.ra),
    dec: Float64Array.from(c.dec),
    mag: Float32Array.from(c.mag),
    name: Object.freeze(c.name),
    desig: Object.freeze(c.desig),
    con: Object.freeze(c.con),
    figures: Object.freeze(c.figures.map((f) => Object.freeze({ con: f.con, part: f.part, segments: Uint16Array.from(f.segments.flat()) }))),
  });
}

let parsed: StarCatalog | undefined;

/** The catalogue, parsed on first use and kept. */
export function starCatalog(): StarCatalog {
  parsed ??= parseStarCatalog(catalogJson);
  return parsed;
}
