import type { Observer } from '../model';
import { z } from './zod';

/**
 * Shapes shared by more than one store. Everything the app writes to the
 * device is read back through a schema: a body that does not match is treated
 * as absent rather than repaired, so a change to the model re-fetches or
 * recomputes instead of rendering something half-migrated (PLAN §7.1, §7.5).
 * The observer is stored twice — in the prefs as the last location (FR-LOC-5)
 * and inside every `PassRun` (FR-OFF-2) — so its schema lives here.
 */
export const storedObserverSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altM: z.number(),
  label: z.string().min(1),
  source: z.enum(['geocode', 'coords', 'device']),
  timeZone: z.string().min(1).nullable(),
  accuracyM: z.number().optional(),
});

export type StoredObserver = z.infer<typeof storedObserverSchema>;

/** Zod's optional fields are `T | undefined`; the model's are absent-or-number (`exactOptionalPropertyTypes`). */
export function toObserver(stored: StoredObserver): Observer {
  const { accuracyM, ...rest } = stored;
  return accuracyM === undefined ? rest : { ...rest, accuracyM };
}
