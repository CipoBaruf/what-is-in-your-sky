/**
 * R154 (FR-LOOK-8, PLAN D-973, D-976): the deep catalogue — every Yale star
 * past `STAR_MAG_LIMIT` to `DEEP_MAG_LIMIT` that `catalog.json` does not hold —
 * as its own lazy chunk, `stars-deep`, and this is the one place that fetches
 * it: `screens/starsChunk.ts`'s shape, a failure dropped rather than kept so
 * the next request fetches again. The window asks for it the first time its
 * field falls under the first `FIELD_DETAIL_STEPS` row that draws past
 * `STAR_MAG_LIMIT` (`fieldDetail.ts`, R155 wires it); the service worker
 * precaches it with the other chunks (FR-OFF-1), so the pinch works offline.
 * Rollup names the chunk after the JSON file, `deep-*.js`; its budget row is
 * `stars-deep` (D-976).
 *
 * `deep.json` is written by `npm run build:stars` (`scripts/build-stars.ts`)
 * and pinned by `tests/data/starCatalog.test.ts`; this module turns its
 * integer columns into the units the bright catalogue uses.
 */

/** `deep.json` as the build writes it: integers, `ra` and `dec` in 0.01°, `mag` and `bv` in 0.1. */
interface DeepFile {
  ra: number[];
  dec: number[];
  mag: number[];
  bv: number[];
}

/** The deep stars, brightest first, star `i` being `ra[i]`, `dec[i]`, `mag[i]`, `bv[i]`. */
export interface DeepCatalog {
  size: number;
  /** J2000 right ascension, degrees, to 0.01°. */
  ra: Float64Array;
  /** J2000 declination, degrees, to 0.01°. */
  dec: Float64Array;
  /** Visual magnitude, to 0.1. */
  mag: Float32Array;
  /** B−V colour index, to 0.1; 0.2 (white) where the Yale record has none. */
  bv: Float32Array;
}

/** The file's columns in degrees and magnitudes. Throws on a column of another length, as the bright reader does. */
export function parseDeepCatalog(json: DeepFile): DeepCatalog {
  const size = json.ra.length;
  if ([json.dec, json.mag, json.bv].some((column) => column.length !== size)) throw new Error('deep.json: every column has one entry per star');
  return Object.freeze({
    size,
    ra: Float64Array.from(json.ra, (n) => n / 100),
    dec: Float64Array.from(json.dec, (n) => n / 100),
    mag: Float32Array.from(json.mag, (n) => n / 10),
    bv: Float32Array.from(json.bv, (n) => n / 10),
  });
}

let chunk: Promise<DeepCatalog> | undefined;

/** Fetch the `stars-deep` chunk once and parse it; later calls return the same promise, and a rejection is not kept. */
export function loadDeepChunk(): Promise<DeepCatalog> {
  chunk ??= import('./deep.json')
    .then((module) => parseDeepCatalog(module.default))
    .catch((reason: unknown) => {
      chunk = undefined;
      throw reason;
    });
  return chunk;
}
