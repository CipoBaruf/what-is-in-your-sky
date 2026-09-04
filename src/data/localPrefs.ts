import type { ChartOrientation, ChartView, Locale, Observer, PassSort, Theme } from '../model';
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
 * dark. Each preference is optional and read
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
}

const storedPrefsSchema = z.object({
  observer: storedObserverSchema.optional().catch(undefined),
  sort: z.enum(['chronological', 'best']).optional().catch(undefined),
  chartView: z.enum(['dome', 'polar']).optional().catch(undefined),
  chartOrientation: z.enum(['looking-up', 'map']).optional().catch(undefined),
  locale: z.enum(['en', 'es']).optional().catch(undefined),
  theme: z.enum(['dark', 'night']).optional().catch(undefined),
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
        const { observer, sort, chartView, chartOrientation, locale, theme } = parsed.data;
        const prefs: Prefs = {};
        if (observer) prefs.observer = toObserver(observer);
        if (sort) prefs.sort = sort;
        if (chartView) prefs.chartView = chartView;
        if (chartOrientation) prefs.chartOrientation = chartOrientation;
        if (locale) prefs.locale = locale;
        if (theme) prefs.theme = theme;
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
