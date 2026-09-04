import { z } from '../zod';
import type { Locale } from '../../model';

/**
 * FR-MOON-4 / FR-MOON-5: the Moon's tradition text is one hand-reviewed file,
 * `lore.json`, in the style of the catalog (FR-SAT-5) — every entry carries
 * both languages and names where the tradition comes from. This schema is what
 * CI validates it with (`lore.test.ts`), the way `catalog.test.ts` validates
 * the catalog, and nothing else in the app may produce tradition text.
 *
 * The types live here rather than in `src/model` because nothing outside
 * `src/data` computes with them: the lore is read, not calculated. `MoonState`
 * and the phase names derived from the phase angle are physics (D-80).
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The twelve tropical signs in order, 30° apart from 0° Aries (FR-MOON-4). */
export const ZODIAC_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const;
export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

/** The eight phase names of FR-MOON-1, in cycle order; `physics/moon.ts` derives them from the phase angle. */
export const MOON_PHASES = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'] as const;
export type MoonPhaseKey = (typeof MOON_PHASES)[number];

/** Degrees of ecliptic longitude per sign. Twelve signs over the 360° of the tropical zodiac. */
export const SIGN_WIDTH_DEG = 30;

/** One line, both languages, always: a missing language is a validation error, never a fallback to English (FR-I18N-2). */
export const localizedSchema = z.object({
  en: z.string().trim().min(1).max(200),
  es: z.string().trim().min(1).max(200),
}) satisfies z.ZodType<Record<Locale, string>>;

/**
 * Provenance in the catalog's shape (FR-SAT-5). `date` is the day the entry was
 * reviewed against the named source: a tradition has no publication date the
 * way a magnitude file does, so the checkable fact is when a person last read
 * the source and agreed with the text. `note` is required here — every entry
 * has to say what in the source it rests on.
 */
export const provenanceSchema = z.object({
  source: z.string().trim().min(1),
  date: z.string().regex(ISO_DATE, 'YYYY-MM-DD'),
  note: z.string().trim().min(1),
});

export const zodiacSignSchema = z.object({
  key: z.enum(ZODIAC_SIGNS),
  startLonDeg: z.number().int().min(0).max(330),
  name: localizedSchema,
  line: localizedSchema,
  source: provenanceSchema,
});

export const fullMoonNameSchema = z.object({
  month: z.number().int().min(1).max(12),
  name: localizedSchema,
  source: provenanceSchema,
});

export const moonPhaseLoreSchema = z.object({
  key: z.enum(MOON_PHASES),
  line: localizedSchema,
  source: provenanceSchema,
});

/** The signs are the zodiac itself: all twelve, in order, each starting where the previous one ends. */
const signsSchema = z.array(zodiacSignSchema).superRefine((signs, ctx) => {
  ZODIAC_SIGNS.forEach((key, index) => {
    const sign = signs[index];
    if (sign === undefined) ctx.addIssue({ code: 'custom', path: [index], message: `missing sign ${key}` });
    else if (sign.key !== key) ctx.addIssue({ code: 'custom', path: [index, 'key'], message: `expected ${key} at index ${String(index)}, found ${sign.key}` });
    else if (sign.startLonDeg !== index * SIGN_WIDTH_DEG) {
      ctx.addIssue({ code: 'custom', path: [index, 'startLonDeg'], message: `${key} starts at ${String(index * SIGN_WIDTH_DEG)}°, found ${String(sign.startLonDeg)}°` });
    }
  });
  if (signs.length !== ZODIAC_SIGNS.length) ctx.addIssue({ code: 'custom', message: `${String(ZODIAC_SIGNS.length)} signs expected, found ${String(signs.length)}` });
});

/** One folk name per calendar month, January first (FR-MOON-4). */
const monthsSchema = z.array(fullMoonNameSchema).superRefine((months, ctx) => {
  months.forEach((entry, index) => {
    if (entry.month !== index + 1) ctx.addIssue({ code: 'custom', path: [index, 'month'], message: `expected month ${String(index + 1)}, found ${String(entry.month)}` });
  });
  if (months.length !== 12) ctx.addIssue({ code: 'custom', message: `12 months expected, found ${String(months.length)}` });
});

/** One line per phase, in the cycle order of FR-MOON-1. */
const phasesSchema = z.array(moonPhaseLoreSchema).superRefine((phases, ctx) => {
  MOON_PHASES.forEach((key, index) => {
    const phase = phases[index];
    if (phase === undefined) ctx.addIssue({ code: 'custom', path: [index], message: `missing phase ${key}` });
    else if (phase.key !== key) ctx.addIssue({ code: 'custom', path: [index, 'key'], message: `expected ${key} at index ${String(index)}, found ${phase.key}` });
  });
  if (phases.length !== MOON_PHASES.length) ctx.addIssue({ code: 'custom', message: `${String(MOON_PHASES.length)} phases expected, found ${String(phases.length)}` });
});

export const loreSchema = z.object({
  signs: signsSchema,
  /** The folk names are a Northern-hemisphere list and the file says so itself, so the note travels with the names (FR-MOON-4). */
  fullMoons: z.object({ hemisphereNote: localizedSchema, months: monthsSchema }),
  phases: phasesSchema,
});

export type LocalizedText = z.infer<typeof localizedSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type ZodiacSignEntry = z.infer<typeof zodiacSignSchema>;
export type FullMoonName = z.infer<typeof fullMoonNameSchema>;
export type MoonPhaseLore = z.infer<typeof moonPhaseLoreSchema>;
export type MoonLore = z.infer<typeof loreSchema>;

/** Validate an unknown value (the JSON file, or anything else) into the lore. Throws a ZodError on failure. */
export function parseLore(value: unknown): MoonLore {
  return loreSchema.parse(value);
}
