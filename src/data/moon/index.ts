import loreJson from './lore.json';
import { SIGN_WIDTH_DEG, ZODIAC_SIGNS, parseLore } from './schema';
import type { FullMoonName, MoonLore, MoonPhaseKey, MoonPhaseLore, ZodiacSign, ZodiacSignEntry } from './schema';

/**
 * The Moon's tradition text (FR-MOON-4): one hand-reviewed file, both
 * languages, every entry with its provenance. Parsed once at module load; the
 * JSON is also validated by `lore.test.ts` so CI catches a bad edit, the way
 * the catalog is (FR-SAT-5).
 *
 * Everything here is tradition and must be labelled as such where it is shown
 * (FR-MOON-5). No observing fact may be derived from this file.
 */
export const MOON_LORE: MoonLore = Object.freeze(parseLore(loreJson));

/** The sign whose 30° band contains this tropical ecliptic longitude, for any real value of it (FR-MOON-4). */
export function signAtLongitude(eclipticLonDeg: number): ZodiacSignEntry {
  const normalized = ((eclipticLonDeg % 360) + 360) % 360;
  const index = Math.floor(normalized / SIGN_WIDTH_DEG);
  return entryOrThrow(MOON_LORE.signs[index], `sign at ${String(eclipticLonDeg)}°`);
}

export function signByKey(key: ZodiacSign): ZodiacSignEntry {
  return entryOrThrow(MOON_LORE.signs[ZODIAC_SIGNS.indexOf(key)], `sign ${key}`);
}

/** The folk name of the full Moon of this calendar month, 1 = January. Northern-hemisphere tradition; see `MOON_LORE.fullMoons.hemisphereNote`. */
export function fullMoonName(month: number): FullMoonName {
  return entryOrThrow(MOON_LORE.fullMoons.months[month - 1], `full Moon name for month ${String(month)}`);
}

export function phaseLore(key: MoonPhaseKey): MoonPhaseLore {
  return entryOrThrow(
    MOON_LORE.phases.find((phase) => phase.key === key),
    `phase ${key}`,
  );
}

/** The schema fixes the length and the order of every list, so a miss here is a corrupt build, not a runtime case to handle. */
function entryOrThrow<T>(entry: T | undefined, what: string): T {
  if (entry === undefined) throw new Error(`moon lore is missing the ${what}`);
  return entry;
}

export { MOON_PHASES, SIGN_WIDTH_DEG, ZODIAC_SIGNS, loreSchema, parseLore } from './schema';
export type { FullMoonName, LocalizedText, MoonLore, MoonPhaseKey, MoonPhaseLore, Provenance, ZodiacSign, ZodiacSignEntry } from './schema';
