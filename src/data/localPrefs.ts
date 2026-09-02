import type { Observer, PassSort } from '../model';
import { browserStorage, type StorageLike } from './storage';
import { z } from './zod';

/**
 * FR-LOC-5, US-8: the last observer lives in `localStorage` under
 * `wiys:prefs:v1` (PLAN §5) and nowhere else. The whole observer is kept,
 * zone and accuracy included, so a reload shows local times before any
 * forecast arrives. A body that does not match the schema is treated as
 * empty rather than repaired; storage failures (quota, private mode) are
 * ignored, the session simply is not remembered. R12 adds the pass list
 * order (US-5 AC2); the chart orientation joins in R13. Each preference is
 * optional and read independently, so an unknown or invalid value of one
 * never loses the others.
 */
export const PREFS_KEY = 'wiys:prefs:v1';

export interface Prefs {
  observer?: Observer;
  sort?: PassSort;
}

const storedObserverSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altM: z.number(),
  label: z.string().min(1),
  source: z.enum(['geocode', 'coords', 'device']),
  timeZone: z.string().min(1).nullable(),
  accuracyM: z.number().optional(),
});
const storedPrefsSchema = z.object({
  observer: storedObserverSchema.optional().catch(undefined),
  sort: z.enum(['chronological', 'best']).optional().catch(undefined),
});

export interface LocalPrefs {
  read: () => Prefs;
  /** Replaces the stored object; an empty object removes the key. */
  write: (prefs: Prefs) => void;
}

export function createLocalPrefs(storage: StorageLike | null): LocalPrefs {
  return {
    read: () => {
      try {
        const raw = storage?.getItem(PREFS_KEY);
        if (!raw) return {};
        const parsed = storedPrefsSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return {};
        const { observer, sort } = parsed.data;
        const prefs: Prefs = {};
        if (observer) {
          const { accuracyM, ...rest } = observer;
          prefs.observer = accuracyM === undefined ? rest : { ...rest, accuracyM };
        }
        if (sort) prefs.sort = sort;
        return prefs;
      } catch {
        return {};
      }
    },
    write: (prefs) => {
      try {
        if (Object.keys(prefs).length === 0) storage?.removeItem(PREFS_KEY);
        else storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
      } catch {
        // Quota or private mode: this session is simply not remembered.
      }
    },
  };
}

/** The app's prefs, over `localStorage` (null storage remembers nothing). */
export const localPrefs: LocalPrefs = createLocalPrefs(browserStorage());
