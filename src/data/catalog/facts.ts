import { z } from '../zod';

/**
 * FR-FACT-1 (V214-6, PLAN D-1094): the satellite facts — country, operator,
 * purpose, launch date, size and the Spanish description — one entry per
 * catalogue NORAD id, each fact sourced as `stdMagSource` is. A second file
 * beside `catalog.json`, which stays the single source of the orbit-relevant
 * metadata; `facts.test.ts` checks the two agree. Compiled with web search in
 * P10's interactive session and spot-checked by the owner (V214-19).
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The purpose keys of FR-FACT-1's table; each has a phrase in both languages. */
export const FACT_PURPOSES = ['crewed-station', 'space-telescope', 'earth-observation', 'ocean-observation', 'radar-observation', 'military', 'rocket-stage'] as const;

/** The country codes the facts may name: ISO 3166-1 alpha-2, or `ESA`. */
export const FACT_COUNTRIES = ['US', 'RU', 'JP', 'CA', 'ESA', 'CN', 'UA', 'FR'] as const;

const factSourceSchema = z.object({
  source: z.string().trim().min(1),
  date: z.string().regex(ISO_DATE, 'YYYY-MM-DD'),
  note: z.string().trim().min(1).optional(),
});

export const factEntrySchema = z.object({
  countries: z.array(z.enum(FACT_COUNTRIES)).min(1),
  operator: z.string().trim().min(1),
  purpose: z.enum(FACT_PURPOSES),
  launched: z.string().regex(ISO_DATE, 'YYYY-MM-DD'),
  // The largest dimension, two significant figures: from a 0.1 m ring to the ISS's 110 m.
  sizeM: z.number().positive().max(200),
  descriptionEs: z.string().trim().min(1),
  source: z.object({
    countries: factSourceSchema,
    operator: factSourceSchema,
    purpose: factSourceSchema,
    launched: factSourceSchema,
    sizeM: factSourceSchema,
  }),
});

export type FactEntry = z.infer<typeof factEntrySchema>;

/** The whole file: entries keyed by the NORAD id as a string. */
const factsSchema = z.record(z.string().regex(/^\d+$/), factEntrySchema);

/** Validate an unknown value (the JSON file) into facts keyed by NORAD id. Throws a ZodError on failure. */
export function parseFacts(value: unknown): ReadonlyMap<number, FactEntry> {
  return new Map(Object.entries(factsSchema.parse(value)).map(([id, entry]) => [Number(id), entry]));
}
