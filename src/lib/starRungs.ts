/**
 * FR-STAR-13, FR-SKY-3, FR-STAR-6 (D-791, D-806): the ladder's rungs by their
 * faintest magnitude, top rung first; a star is on rung `k` when `k` is the
 * first whose bound it does not exceed. `starGlyphs.ts`'s `LADDER` takes its
 * bounds from here and `skyStars.ts`'s twilight steps count them, so the two
 * cannot drift. A module of its own, with no imports, so the window's chunk
 * reads it without `skyStars.ts`'s ephemeris.
 */
export const RUNG_MAX_MAG: readonly [number, number, number, number, number] = [0.5, 1.5, 2.5, 3.5, Number.POSITIVE_INFINITY];
