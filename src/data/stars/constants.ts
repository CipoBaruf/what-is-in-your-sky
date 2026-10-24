/**
 * FR-STAR-1: the faintest magnitude the catalogue keeps for its own sake; a
 * fainter star is kept only when a figure ends on it. Its own module so the
 * build step (`scripts/build-stars.ts`) reads it without loading the file it
 * writes.
 */
export const STAR_MAG_LIMIT = 4.5;
