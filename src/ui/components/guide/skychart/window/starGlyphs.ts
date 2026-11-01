import { BLOOM_MAG, BV_TONES, DEEP_MAG_LIMIT, DOT_RADIUS_PX, STAR_DOT_MAG, STAR_MAG_LIMIT, STAR_SIZES_PX, type StarTone } from '../../../../../data/stars/constants';
import { RUNG_MAX_MAG } from '../../../../../lib/starRungs';

/**
 * R114 (FR-STAR-6 as amended, FR-DS-8 as amended; PLAN D-753): the ladder,
 * the collision rule and the hit test — the star field's pure rules, with no
 * DOM in them, so one table test holds all three.
 *
 * R155 (FR-LOOK-4, FR-LOOK-5, FR-LOOK-6; V210-8, V210-10; PLAN D-974, D-982):
 * the window's ladder is **marks** now, `markFor(mag, bv)`: V ≤
 * `STAR_DOT_MAG` a `*` character at `STAR_SIZES_PX` by rung; fainter, a round
 * dot of `DOT_RADIUS_PX` by magnitude, continuous, at a `fill-opacity` that
 * falls from 0.7 at `STAR_MAG_LIMIT` to 0.3 at `DEEP_MAG_LIMIT`; every mark in
 * one of four tones from its B−V index (`BV_TONES`, white where there is
 * none); a planet `@` at the `*` sizes by its magnitude, never a dot. The
 * glyph or the dot and its size carry the magnitude and `@` says planet, so
 * the reading survives monochrome (FR-X-5).
 *
 * The **rungs** below (`rungFor`, `planetRungFor`, `LADDER`) are v2.4.1's
 * ladder of characters — `*`, `+` and `.` in three greys — which the polar
 * chart still draws until R158 moves it onto the marks; `RUNG_MAX_MAG`'s five
 * bounds are theirs and the twilight steps' (`lib/skyStars.ts`), and the
 * three top bounds are the marks' `*` sizes too. The old ladder leaves with
 * R158's re-baseline and not before, so the chart lane's snapshot is not
 * moved by the window lane.
 *
 * The **collision** rule keeps the brighter of any two marks whose centres
 * fall within half the small size of each other, so a close pair never prints
 * as a smudge; the same distance is the gap a figure line leaves at each star
 * (D-754). The **hit test** finds the nearest drawn mark within `--tap` / 4
 * of a point, or none — there is no hit node per star (FR-STAR-9).
 *
 * No px length outside the sheet (FR-DS-2): `SIZE_PX` carries the chart text
 * tokens' values under their names and `HIT_RADIUS_PX` is `--tap` / 4;
 * `starGlyphs.test.ts` reads `tokens.css` and holds both to it. The marks'
 * sizes are SPEC §4.53's own constants (`data/stars/constants.ts`, R154).
 */

export type StarGlyph = '*' | '+' | '.' | '@';
/** The chart text tokens the ladder draws at, by name. */
export type SizeToken = 'chart-text-18' | 'chart-text-15' | 'chart-text-12';
/** The colour tokens the ladder draws in, by name. */
export type ColourToken = 'chart-star' | 'chart-star-dim' | 'chart-star-faint' | 'chart-planet';

export interface Rung {
  glyph: StarGlyph;
  sizeToken: SizeToken;
  colourToken: ColourToken;
}

/** The sheet's values for the three sizes, at the base (the tokens are px on purpose, OQ-38); the test pins them to `tokens.css`. */
export const SIZE_PX: Readonly<Record<SizeToken, number>> = { 'chart-text-18': 18, 'chart-text-15': 15, 'chart-text-12': 12 };

/** The small size: the collision distance and the figures' gap are half of it. */
export const SMALL_SIZE: SizeToken = 'chart-text-12';
/** FR-STAR-6: half a cell at the small size, the distance under which the fainter of two glyphs is not drawn, and the gap a figure line keeps from a star. */
export const COLLISION_PX = SIZE_PX[SMALL_SIZE] / 2;
/** FR-STAR-6: `--tap` / 4 — the tap floor is two 24 px rows — the radius a tap or a click reaches a glyph within. */
export const HIT_RADIUS_PX = 12;
/** R127 (FR-SKY-11, D-796): the landmark's ring, px of radius — dashed in `--chart-star` at the chart hairline, in every view (the polar chart in its user units, D-812). */
export const LANDMARK_RING_PX = 13;

type Row = Rung & { maxMag: number };
/** The bottom rung: everything the catalogue holds beyond 3.5 (its limit is `STAR_MAG_LIMIT`, 4.5), and the row a magnitude outside every bound falls to. */
const FAINTEST: Row = { maxMag: RUNG_MAX_MAG[4], glyph: '.', sizeToken: 'chart-text-12', colourToken: 'chart-star-faint' };

/** The ladder as a table, top rung first: the first row whose `maxMag` the magnitude does not exceed is the rung. The bounds are `RUNG_MAX_MAG`'s (D-806). */
export const LADDER: readonly Row[] = [
  { maxMag: RUNG_MAX_MAG[0], glyph: '*', sizeToken: 'chart-text-18', colourToken: 'chart-star' },
  { maxMag: RUNG_MAX_MAG[1], glyph: '*', sizeToken: 'chart-text-15', colourToken: 'chart-star' },
  { maxMag: RUNG_MAX_MAG[2], glyph: '+', sizeToken: 'chart-text-12', colourToken: 'chart-star' },
  { maxMag: RUNG_MAX_MAG[3], glyph: '.', sizeToken: 'chart-text-12', colourToken: 'chart-star-dim' },
  FAINTEST,
];

const rowFor = (mag: number): Row => LADDER.find((row) => mag <= row.maxMag) ?? FAINTEST;

/** A star's rung by its visual magnitude. */
export function rungFor(mag: number): Rung {
  const { glyph, sizeToken, colourToken } = rowFor(mag);
  return { glyph, sizeToken, colourToken };
}

/** A planet's rung by its magnitude at the shown instant: `@` in `--chart-planet`, at the size the same ladder gives (18 at V ≤ 0.5, 15 at ≤ 1.5, 12 otherwise). */
export function planetRungFor(mag: number): Rung {
  return { glyph: '@', sizeToken: rowFor(mag).sizeToken, colourToken: 'chart-planet' };
}

/** Every glyph × size the ladder can draw, for the ink offsets to measure once (D-752). */
export const GLYPH_SIZES: readonly (readonly [StarGlyph, SizeToken])[] = [
  ['*', 'chart-text-18'],
  ['*', 'chart-text-15'],
  ['+', 'chart-text-12'],
  ['.', 'chart-text-12'],
  ['@', 'chart-text-18'],
  ['@', 'chart-text-15'],
  ['@', 'chart-text-12'],
];

// --- R155: the window's marks (FR-LOOK-4, FR-LOOK-5) ---------------------------

/** The four star tones' tokens (FR-LOOK-5, FR-DS-8 as amended): the white is `--chart-star`, unchanged. */
export type ToneToken = 'chart-star' | 'chart-star-blue' | 'chart-star-yellow' | 'chart-star-orange';
const TONE_TOKENS: Readonly<Record<StarTone, ToneToken>> = { blue: 'chart-star-blue', white: 'chart-star', yellow: 'chart-star-yellow', orange: 'chart-star-orange' };

/** The tone for a B−V index by `BV_TONES`' rows: the first whose `below` the index is under; no index (or none a number) is white. */
export function toneFor(bv: number | undefined): StarTone {
  if (bv === undefined || Number.isNaN(bv)) return 'white';
  return BV_TONES.find((row) => bv < row.below)?.tone ?? 'orange';
}

/** The tone's token name, for `data-tone` and the sheet. */
export const toneToken = (bv: number | undefined): ToneToken => TONE_TOKENS[toneFor(bv)];

/** A `*` (or a planet's `@`) at one of the three sizes, px. */
export interface CharMark {
  kind: 'char';
  glyph: '*' | '@';
  px: number;
  tone: ToneToken | 'chart-planet';
}

/** A round dot: its radius and its tone, and the opacity a deep star fades at. */
interface DotMark {
  kind: 'dot';
  r: number;
  tone: ToneToken;
  opacity: number;
}

export type Mark = CharMark | DotMark;

/** The `*` size for a magnitude by `STAR_SIZES_PX`, or `null` past `STAR_DOT_MAG`, where a star is a dot. */
function starSizePx(mag: number): number | null {
  if (!(mag <= STAR_DOT_MAG)) return null;
  return STAR_SIZES_PX.find((row) => mag <= row.maxMag)?.px ?? STAR_SIZES_PX[STAR_SIZES_PX.length - 1]?.px ?? 0;
}

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/** FR-LOOK-4: the dot's radius, linear in magnitude from `DOT_RADIUS_PX.bright` at `STAR_DOT_MAG` to `.faint` at `DEEP_MAG_LIMIT`, held at the ends. */
export function dotRadiusPx(mag: number): number {
  const t = clamp01((mag - STAR_DOT_MAG) / (DEEP_MAG_LIMIT - STAR_DOT_MAG));
  return Math.round((DOT_RADIUS_PX.bright + (DOT_RADIUS_PX.faint - DOT_RADIUS_PX.bright) * t) * 100) / 100;
}

/** The opacity a dot fades at past `STAR_MAG_LIMIT`: 0.7 there to 0.3 at `DEEP_MAG_LIMIT`, 1 for every bright-catalogue star. */
export const DOT_OPACITY = { atLimit: 0.7, atDeep: 0.3 } as const;
export function dotOpacity(mag: number): number {
  if (!(mag > STAR_MAG_LIMIT)) return 1;
  const t = clamp01((mag - STAR_MAG_LIMIT) / (DEEP_MAG_LIMIT - STAR_MAG_LIMIT));
  return Math.round((DOT_OPACITY.atLimit + (DOT_OPACITY.atDeep - DOT_OPACITY.atLimit) * t) * 100) / 100;
}

/** A star's mark by its magnitude and its B−V index (FR-LOOK-4, FR-LOOK-5). A magnitude that is not a number is the faintest dot. */
export function markFor(mag: number, bv?: number): Mark {
  const px = starSizePx(mag);
  const tone = toneToken(bv);
  if (px !== null) return { kind: 'char', glyph: '*', px, tone };
  const m = Number.isNaN(mag) ? DEEP_MAG_LIMIT : mag;
  return { kind: 'dot', r: dotRadiusPx(m), tone, opacity: dotOpacity(m) };
}

/** A planet's mark: `@` in `--chart-planet` at the `*` size its magnitude earns, the smallest past `STAR_DOT_MAG`; never a dot (FR-LOOK-4). */
export function planetMarkFor(mag: number): CharMark {
  return { kind: 'char', glyph: '@', px: starSizePx(mag) ?? STAR_SIZES_PX[STAR_SIZES_PX.length - 1]?.px ?? 0, tone: 'chart-planet' };
}

/** FR-LOOK-6: whether a star or a planet at `mag` carries a bloom. */
export const bloomed = (mag: number): boolean => mag < BLOOM_MAG;

/** Every glyph × px the marks can draw, for the ink offsets to measure once (D-752): `*` and `@` at each of `STAR_SIZES_PX`. */
export const MARK_GLYPH_SIZES: readonly (readonly [StarGlyph, number])[] = STAR_SIZES_PX.flatMap((row): (readonly [StarGlyph, number])[] => [
  ['*', row.px],
  ['@', row.px],
]);

export interface Point {
  x: number;
  y: number;
}

/**
 * The collision walk's order, one rule for every view that draws the ladder:
 * the indices of `mags` brightest first. A tie keeps the given order (the
 * sort is stable: the catalogue's own order, then the planets'), and a
 * magnitude that is missing or not a number ranks last, as `rungFor` puts it
 * on the faintest rung — so the window and the polar chart keep the same body
 * of a close pair.
 */
export function magnitudeOrder(mags: ArrayLike<number>): number[] {
  const rank = (k: number): number => {
    const mag = mags[k];
    return mag === undefined || Number.isNaN(mag) ? Infinity : mag;
  };
  return Array.from({ length: mags.length }, (_, k) => k).sort((a, b) => rank(a) - rank(b) || 0);
}

/**
 * The collision rule. `points` are in draw order, brightest first, `null` for
 * one not drawn; the result says which survive: walking in order, a point
 * within `distancePx` of one already kept is dropped, so of any close pair the
 * brighter alone is drawn. A grid of `distancePx` cells keeps it linear in the
 * catalogue, which the per-frame path needs.
 */
export function collide(points: readonly (Point | null)[], distancePx = COLLISION_PX): boolean[] {
  const keep = points.map(() => false);
  if (distancePx <= 0) return points.map((p) => p !== null);
  const cells = new Map<number, Point[]>();
  // A numeric cell key, so the per-frame walk builds no strings: the box is a few hundred px, far inside ±2^15 cells.
  const cellKey = (cx: number, cy: number): number => cx * 65536 + cy;
  const d2 = distancePx * distancePx;
  points.forEach((p, i) => {
    if (!p) return;
    const cx = Math.floor(p.x / distancePx);
    const cy = Math.floor(p.y / distancePx);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const q of cells.get(cellKey(cx + dx, cy + dy)) ?? []) if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < d2) return;
      }
    }
    const key = cellKey(cx, cy);
    const list = cells.get(key);
    if (list) list.push(p);
    else cells.set(key, [p]);
    keep[i] = true;
  });
  return keep;
}

/** A drawn figure segment in the box's px, as the star field writes its line. */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * R127 (FR-STAR-14, D-795): the figure line under a tap — the nearest drawn
 * segment within `radiusPx` of the point (the glyphs' own radius), by the
 * distance to the segment itself, or `null`. Called only where `hitTest`
 * found no mark: a star or a planet within the distance wins over a line.
 */
export function hitLine(lines: readonly (Segment | null)[], x: number, y: number, radiusPx = HIT_RADIUS_PX): number | null {
  let best: number | null = null;
  let bestD2 = radiusPx * radiusPx;
  lines.forEach((s, i) => {
    if (!s) return;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len2 = dx * dx + dy * dy;
    const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / len2));
    const d2 = (s.x1 + u * dx - x) ** 2 + (s.y1 + u * dy - y) ** 2;
    if (d2 <= bestD2 && (best === null || d2 < bestD2)) {
      best = i;
      bestD2 = d2;
    }
  });
  return best;
}

/**
 * The hit test: the index of the nearest drawn point within `radiusPx` of
 * (`x`, `y`), or `null`. `points` are the glyphs as drawn — `null` for one
 * hidden this frame — in draw order, so a tie goes to the brighter.
 */
export function hitTest(points: readonly (Point | null)[], x: number, y: number, radiusPx = HIT_RADIUS_PX): number | null {
  let best: number | null = null;
  let bestD2 = radiusPx * radiusPx;
  points.forEach((p, i) => {
    if (!p) return;
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 <= bestD2 && (best === null || d2 < bestD2)) {
      best = i;
      bestD2 = d2;
    }
  });
  return best;
}
