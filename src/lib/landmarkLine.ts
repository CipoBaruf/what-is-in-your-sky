import { degrees } from './format';

/**
 * R127 (FR-SKY-11, D-796): the landmark line under the highlighted pass's
 * name — "passes 7° above Betelgeuse, in Orion" / "pasa 7° sobre Betelgeuse,
 * en Orión" — worded once for the live page's headline block, the pass
 * detail's head and the screen's readout. Beside `passPath.ts`: the numbers
 * and the names come from the scene (`useSkyScene`'s landmark, D-832's name
 * readers), the sentence from the catalog (`live.landmarkLine`,
 * `live.landmarkThrough`), so the two languages order the parts as they like
 * and nothing here reads a catalog or a clock.
 *
 * The constellation is the figure the peak is among (FR-SKY-12's rule); with
 * none within reach but a star in reach, it is the star's own, so a landmark
 * star never stands without its sky. With no star the line is "passes through
 * Orion"; with neither there is no line (`null`).
 */

/** The scene's landmark as the line needs it (`SkyLandmark`'s two parts). */
export interface LandmarkParts {
  star: { index: number; sepDeg: number; word: 'above' | 'below' | 'beside' } | null;
  among: { con: string } | null;
}

/** The names, in the active language (D-832's readers closed over the catalogue and the language). */
export interface LandmarkNames {
  /** Star `i`'s name. */
  star: (i: number) => string;
  /** A constellation's name by its abbreviation, or `undefined` for one the table does not have. */
  constellation: (con: string) => string | undefined;
  /** Star `i`'s constellation's abbreviation. */
  constellationOf: (i: number) => string;
}

/** The catalog's two sentences, keyed as `live` carries them so `t.live` is handed in whole. */
/**
 * The names in one language, as the pages and the window reach them — the star source's `names` (D-832) or the
 * window's own accessors over the scene's catalogue — with the catalogue's constellation column (R127 review: one
 * adapter, not one per caller).
 */
export function landmarkNames<L>(names: { star: (i: number, lang: L) => string; constellation: (con: string, lang: L) => string | undefined }, con: readonly string[], lang: L): LandmarkNames {
  return { star: (i) => names.star(i, lang), constellation: (c) => names.constellation(c, lang), constellationOf: (i) => con[i] ?? '' };
}

export interface LandmarkWords {
  landmarkLine: (p: { degrees: string; word: 'above' | 'below' | 'beside'; star: string; constellation: string }) => string;
  landmarkThrough: (p: { constellation: string }) => string;
}

export function landmarkLine(landmark: LandmarkParts | null | undefined, names: LandmarkNames, words: LandmarkWords): string | null {
  if (!landmark) return null;
  const { star, among } = landmark;
  const con = among?.con ?? (star === null ? null : names.constellationOf(star.index));
  const constellation = con === null ? undefined : (names.constellation(con) ?? con);
  if (star === null) return constellation === undefined ? null : words.landmarkThrough({ constellation });
  return words.landmarkLine({ degrees: degrees(star.sepDeg), word: star.word, star: names.star(star.index), constellation: constellation ?? '' });
}
