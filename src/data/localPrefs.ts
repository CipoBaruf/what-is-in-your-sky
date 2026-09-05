import type { ChartOrientation, ChartView, Favourite, Locale, Observer, PassSort, Theme } from '../model';
import { mostRecentlyUsed } from './favourites';
import { storedObserverSchema, toObserver } from './schemas';
import { browserStorage, type StorageLike } from './storage';
import { z } from './zod';

/**
 * FR-LOC-5, US-8: the last observer lives in `localStorage` under
 * `wiys:prefs:v1` (PLAN §5) and nowhere else. The whole observer is kept,
 * zone and accuracy included, so a reload shows local times before any
 * forecast arrives. A body that does not match the schema is treated as
 * empty rather than repaired; storage failures (quota, private mode) are
 * ignored, the session simply is not remembered. R12 adds the pass list
 * order (US-5 AC2); R13 the sky chart view (US-6 AC5) and the polar chart's
 * orientation (FR-GUIDE-4); R17 the language (FR-I18N-1), absent until the
 * header switch is used, so the browser's list keeps deciding; R20 the theme
 * (FR-THEME-1), absent until the header switch is used, so the app stays
 * dark; R26 the saved places (FR-OFF-7, D-85), which are read item by item as
 * well as independently — a favourite that does not match the schema drops
 * only itself, so one bad entry costs one place and not the other seven.
 * R28 the install hint's dismissal (FR-OFF-6): written only when the hint has
 * been answered, and only ever `true`, so an untouched browser has no key for
 * it. Each preference is optional and read
 * independently, so an unknown or invalid value of one never loses the
 * others.
 */
export const PREFS_KEY = 'wiys:prefs:v1';

export interface Prefs {
  observer?: Observer;
  sort?: PassSort;
  chartView?: ChartView;
  chartOrientation?: ChartOrientation;
  locale?: Locale;
  theme?: Theme;
  favourites?: Favourite[];
  /** FR-OFF-6: the install hint has been answered and is not offered again. Absent until then. */
  installHintDismissed?: boolean;
}

/** One saved place as it is written (FR-OFF-7); the whole observer, so selecting it offline needs no geocode. */
const storedFavouriteSchema = z.object({
  cellKey: z.string().min(1),
  observer: storedObserverSchema,
  addedAt: z.number().finite(),
  lastUsedAt: z.number().finite(),
});

const storedPrefsSchema = z.object({
  observer: storedObserverSchema.optional().catch(undefined),
  sort: z.enum(['chronological', 'best']).optional().catch(undefined),
  chartView: z.enum(['dome', 'polar']).optional().catch(undefined),
  chartOrientation: z.enum(['looking-up', 'map']).optional().catch(undefined),
  locale: z.enum(['en', 'es']).optional().catch(undefined),
  theme: z.enum(['dark', 'night']).optional().catch(undefined),
  // `.catch(null)` per item, not on the array: a malformed favourite becomes a hole that is
  // filtered out, where a schema on the array alone would drop all eight for one bad entry.
  favourites: z
    .array(storedFavouriteSchema.nullable().catch(null))
    .optional()
    .catch(undefined),
  installHintDismissed: z.boolean().optional().catch(undefined),
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
        const { observer, sort, chartView, chartOrientation, locale, theme, favourites, installHintDismissed } = parsed.data;
        const prefs: Prefs = {};
        if (observer) prefs.observer = toObserver(observer);
        if (sort) prefs.sort = sort;
        if (chartView) prefs.chartView = chartView;
        if (chartOrientation) prefs.chartOrientation = chartOrientation;
        if (locale) prefs.locale = locale;
        if (theme) prefs.theme = theme;
        // The limit is applied on read too, so a hand-edited or half-written list is still eight at most.
        if (favourites) {
          const kept = favourites.filter((favourite) => favourite !== null).map((favourite) => ({ ...favourite, observer: toObserver(favourite.observer) }));
          if (kept.length > 0) prefs.favourites = mostRecentlyUsed(kept);
        }
        // Only `true` is a preference; `false` is what an absent key already means.
        if (installHintDismissed) prefs.installHintDismissed = true;
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
