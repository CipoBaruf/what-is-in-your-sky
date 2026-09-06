/**
 * R30 (FR-MOON-4): the Moon's tradition file reaches the UI through the
 * state, the way the catalog does (D-97, PLAN §3). These are lookups over
 * one hand-reviewed file, never a computation, and nothing else in the app
 * may produce tradition text (FR-MOON-5).
 *
 * Its own module, not `state/index.ts` (FR-FLAG-1, D-183): `MoonLore.tsx` is
 * the only reader, and it already sits behind the `MOON_LORE` build flag's
 * lazy import (`App.tsx`). Re-exporting `data/moon` from the main barrel
 * would put `lore.json` back in the main chunk regardless of the flag, since
 * the barrel is imported eagerly by nearly everything.
 */
export { MOON_LORE, fullMoonName, phaseLore, signAtLongitude } from '../data/moon';
export type { FullMoonName, MoonPhaseLore, ZodiacSign, ZodiacSignEntry } from '../data/moon';
