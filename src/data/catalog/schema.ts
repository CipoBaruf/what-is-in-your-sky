import { z } from 'zod';
import type { CatalogEntry } from '../../model';

/**
 * FR-SAT-1 / FR-SAT-5: the curated catalog is validated by this schema in a
 * Vitest test (PLAN §7.4) so a malformed entry fails CI, and by
 * `scripts/check-catalog.ts` before it checks membership against CelesTrak.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const stdMagSourceSchema = z.object({
  source: z.string().trim().min(1),
  date: z.string().regex(ISO_DATE, 'YYYY-MM-DD'),
  note: z.string().trim().min(1).optional(),
});

export const catalogEntrySchema = z.object({
  noradId: z.number().int().positive(),
  name: z.string().trim().min(1),
  category: z.enum(['station', 'payload', 'rocket-body']),
  // Nothing naked-eye is fainter than +6 intrinsic; nothing is brighter than the ISS by more than a few magnitudes.
  stdMag: z.number().min(-8).max(8),
  stdMagSource: stdMagSourceSchema,
  description: z.string().trim().min(1).optional(),
  featured: z.literal(true).optional(),
});

export const catalogSchema = z.array(catalogEntrySchema).superRefine((entries, ctx) => {
  const seen = new Map<number, number>();
  entries.forEach((entry, index) => {
    const first = seen.get(entry.noradId);
    if (first !== undefined) {
      ctx.addIssue({ code: 'custom', path: [index, 'noradId'], message: `duplicate noradId ${String(entry.noradId)} (first at index ${String(first)})` });
    } else seen.set(entry.noradId, index);
  });
  const featured = entries.filter((e) => e.featured).length;
  if (featured !== 1) ctx.addIssue({ code: 'custom', message: `exactly one entry must be featured, found ${String(featured)}` });
});

type ParsedEntry = z.infer<typeof catalogEntrySchema>;

/** Drop the `undefined` optionals zod leaves behind so the result satisfies `exactOptionalPropertyTypes`. */
export function toCatalogEntry(parsed: ParsedEntry): CatalogEntry {
  const { note, ...source } = parsed.stdMagSource;
  const entry: CatalogEntry = {
    noradId: parsed.noradId,
    name: parsed.name,
    category: parsed.category,
    stdMag: parsed.stdMag,
    stdMagSource: note === undefined ? source : { ...source, note },
  };
  if (parsed.description !== undefined) entry.description = parsed.description;
  if (parsed.featured) entry.featured = true;
  return entry;
}

/** Validate an unknown value (the JSON file, or anything else) into catalog entries. Throws a ZodError on failure. */
export function parseCatalog(value: unknown): CatalogEntry[] {
  return catalogSchema.parse(value).map(toCatalogEntry);
}
