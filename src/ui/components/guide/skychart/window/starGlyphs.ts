import { RUNG_MAX_MAG } from '../../../../../lib/starRungs';

/**
 * R114 (FR-STAR-6 as amended, FR-DS-8 as amended; PLAN D-753): the ladder,
 * the collision rule and the hit test — the star field's pure rules, with no
 * DOM in them, so one table test holds all three.
 *
 * The **ladder** turns a magnitude into a glyph, a size and a tone, each a
 * name in the sheet: V ≤ 0.5 `*` at `--chart-text-18`; ≤ 1.5 `*` at
 * `--chart-text-15`; ≤ 2.5 `+` at `--chart-text-12`, these three in
 * `--chart-star`; ≤ 3.5 `.` in `--chart-star-dim`; ≤ 4.5 `.` in
 * `--chart-star-faint` (V24-14's three sizes and three tones). A planet is `@`
 * in `--chart-planet` at the size its magnitude at the shown instant earns on
 * the same rungs. The glyph is the magnitude and `@` is the planet, so the
 * reading survives monochrome (FR-X-5).
 *
 * The **collision** rule keeps the brighter of any two glyphs whose centres
 * fall within half the small size of each other, so a close pair never prints
 * as a smudge; the same distance is the gap a figure line leaves at each star
 * (D-754). The **hit test** finds the nearest drawn glyph within `--tap` / 4
 * of a point, or none — there is no hit node per star (FR-STAR-9).
 *
 * No px length outside the sheet (FR-DS-2): `SIZE_PX` carries the chart text
 * tokens' values under their names and `HIT_RADIUS_PX` is `--tap` / 4;
 * `starGlyphs.test.ts` reads `tokens.css` and holds both to it, as
 * `gutter.test.ts` holds `GUTTER_PX`.
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

/**
 * The hit test: the index of the nearest drawn point within `radiusPx` of
 * (`x`, `y`), or `null`. `points` are the glyphs as drawn — `null` for one
 * hidden this frame — in draw order, so a tie goes to the brighter.
 */
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
