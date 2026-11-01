/**
 * FR-STAR-1: the faintest magnitude the catalogue keeps for its own sake; a
 * fainter star is kept only when a figure ends on it. Its own module so the
 * build step (`scripts/build-stars.ts`) reads it without loading the file it
 * writes.
 */
export const STAR_MAG_LIMIT = 4.5;

/*
 * R154 (FR-LOOK-10, PLAN D-973, D-974): the look of the sky's second pass, in
 * one module with the ladder's limit above, so the build step and the drawing
 * (R155's `skychart/window/*`, R158's polar chart) read the same numbers. The
 * values are SPEC §4.53's table; the three strengths are the mockup's
 * second-cut sliders and the owner's to re-set once before the release, by a
 * Decision Log row and nothing else (FR-LOOK-10). No slider ships.
 */

/**
 * FR-LOOK-8: the deep catalogue's limit, the Yale catalogue's own — every
 * naked-eye star under a dark sky. `deep.json` holds the Yale stars with
 * `STAR_MAG_LIMIT` < V ≤ this.
 */
export const DEEP_MAG_LIMIT = 6.5;

/**
 * One row of `FIELD_DETAIL_STEPS`: `[aboveDeg, magLimit, nameMag]` — the row
 * applies to a field wider than `aboveDeg`; it draws every star to `magLimit`
 * and names every star to `nameMag`.
 */
export type FieldDetailStep = readonly [aboveDeg: number, magLimit: number, nameMag: number];

/**
 * FR-LOOK-9: detail follows the field, widest first; the first row whose
 * `aboveDeg` the field exceeds applies, and the last (0) catches the rest.
 * 5.3 at 60° is the mockup's second cut; 6.5 at 20° is what makes the pinch a
 * telescope and not a crop. `fieldDetail.ts` reads it.
 */
export const FIELD_DETAIL_STEPS: readonly FieldDetailStep[] = [
  [75, 4.5, 1.5],
  [45, 5.3, 1.5],
  [30, 6.0, 2.5],
  [0, 6.5, 3.2],
];

/**
 * FR-LOOK-9: the deep stars' `<circle>` nodes, created once and reused by ref.
 * At 45° a box holds about 220 stars to 5.3 and at 20° about 140 to 6.5, so
 * the pool never runs out and the DOM never grows with the catalogue.
 */
export const DEEP_NODE_POOL = 600;

/** FR-LOOK-4 (V210-8): brighter than this a star is a `*` character; from here down a round dot. */
export const STAR_DOT_MAG = 2.5;

/**
 * FR-LOOK-4: the dot's radius, linear in magnitude from `bright` at
 * `STAR_DOT_MAG` to `faint` at `DEEP_MAG_LIMIT`, so the size is the magnitude
 * and no two rungs are the same dot.
 */
export const DOT_RADIUS_PX = { bright: 2.4, faint: 0.6 } as const;

/**
 * FR-LOOK-4: the three `*` sizes by rung, brightest first — a star at V ≤
 * `maxMag` takes the first row it fits. One step up from v2.4.1's 18/15/12 so
 * the brightest stand clear of the dots.
 */
export const STAR_SIZES_PX: readonly { readonly maxMag: number; readonly px: number }[] = [
  { maxMag: 0.5, px: 20 },
  { maxMag: 1.5, px: 16 },
  { maxMag: 2.5, px: 13 },
];

/** FR-LOOK-5: the four star tones, each a `--chart-star*` token with a night value (R155's `tokens.css`). */
export type StarTone = 'blue' | 'white' | 'yellow' | 'orange';

/**
 * FR-LOOK-5 (V210-10): the tone from the B−V colour index — the first row
 * whose `below` the index is under. Low in saturation, so size still carries
 * magnitude and monochrome keeps the reading (FR-X-5).
 */
export const BV_TONES: readonly { readonly below: number; readonly tone: StarTone }[] = [
  { below: 0.0, tone: 'blue' },
  { below: 0.4, tone: 'white' },
  { below: 0.8, tone: 'yellow' },
  { below: Infinity, tone: 'orange' },
];

/** FR-LOOK-6: stars and planets brighter than this carry a bloom — about twenty at any instant. */
export const BLOOM_MAG = 1.8;

/**
 * FR-LOOK-6: the bloom's radius is `basePx + (pivotMag − V) × pxPerMag`:
 * Sirius about 26 px, a first-magnitude star about 14.
 */
export const BLOOM_RADIUS_PX = { basePx: 8, pivotMag: 2.2, pxPerMag: 5 } as const;

/** FR-LOOK-6, FR-LOOK-10: the bloom's slider; the gradient's centre alpha is 0.32 × this. */
export const BLOOM_STRENGTH = 0.7;

/** FR-LOOK-3, FR-LOOK-10: the haze's slider; the three bands' alphas are 0.03, 0.04 and 0.05 × this. */
export const MILKY_WAY_STRENGTH = 0.6;

/** FR-LOOK-1, FR-LOOK-10: the horizon band's slider; the band's alpha at the horizon is 0.5 × this. */
export const HORIZON_STRENGTH = 0.6;

/**
 * FR-LOOK-1: the horizon band's height in altitude, degrees. The lightest sky
 * a faint star stands on is at 0°, and the contrast floor is measured there.
 */
export const HORIZON_BAND_DEG = 15;

/**
 * FR-LOOK-3: half-widths in galactic latitude of the three stacked bands,
 * degrees, outermost first — the order `milkyWay.json` writes its rings in.
 * The build widens each toward the core (`scripts/build-stars.ts`) so the
 * bulge reads.
 */
export const MILKY_WAY_BANDS_DEG: readonly number[] = [12, 7, 3];

/** FR-LOOK-7: the Moon's drawn disc, px, in the window and on the whole sky, with its lit limb. */
export const MOON_DISC_PX = 10;
