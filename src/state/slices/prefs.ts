import type { StateCreator } from 'zustand/vanilla';
import type { LocalPrefs } from '../../data/localPrefs';
import { DEFAULT_PASS_SORT } from '../../lib/passSort';
import { browserLanguages, resolveLocale } from '../../i18n/locale';
import { DEFAULT_CHART_ORIENTATION } from '../../lib/skyGeometry';
import { DEFAULT_THEME, type ChartOrientation, type ChartView, type Locale, type PassSort, type Theme } from '../../model';
import type { AppState } from '../store';

/**
 * FR-LOC-5, US-8: the saved location. The slice holds no state of its own:
 * whatever observer the store has is what `wiys:prefs:v1` holds, kept in
 * step by the write-through subscription `createAppStore` installs (every
 * observer object change is written, so a zone filled in by the forecast
 * (D-3) is remembered too). `restoreSavedObserver` runs once at startup,
 * after the effects are wired, and goes through `setObserver` so the restored
 * location is computed like a typed one; `clearSavedObserver` forgets the
 * saved location *and* drops the active observer, so the screen visibly
 * returns to its empty state (the write-through then removes the key).
 * R12 (US-5 AC2): the pass list order is a preference the slice does hold
 * as state, read from storage when the store is created and written through
 * by `setSort`; the observer write-through preserves it. R13 adds the sky
 * chart view (US-6 AC5) and the polar chart's orientation (FR-GUIDE-4) the
 * same way. R17 adds the language (FR-I18N-1): it is resolved once when the
 * store is created, from the saved preference if there is one and from
 * `navigator.languages` otherwise, and `setLocale` both changes it and saves
 * it — after which the browser's list no longer decides. R20 adds the theme
 * (FR-THEME-1) as a plain saved preference: unlike the language it is never
 * guessed from the device, so it is dark until someone asks for night.
 */
export interface PrefsDeps {
  prefs: LocalPrefs;
}

/** US-6 AC3: the dome is the default chart view; until R15 registers it, `SkyChart` falls back to the polar view. */
export const DEFAULT_CHART_VIEW: ChartView = 'polar'; // D-68: polar for now, the owner's call in the R15 review

export interface PrefsSlice {
  /** The pass list order (US-5 AC2), `chronological` unless saved otherwise. */
  sort: PassSort;
  setSort: (sort: PassSort) => void;
  /** The sky chart view (US-6 AC5), `polar` unless saved otherwise (D-68). */
  chartView: ChartView;
  setChartView: (view: ChartView) => void;
  /** The polar chart's convention (FR-GUIDE-4), `looking-up` unless saved otherwise. */
  chartOrientation: ChartOrientation;
  setChartOrientation: (orientation: ChartOrientation) => void;
  /** The language (FR-I18N-1), from the saved preference or the browser's list. */
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** The palette (FR-THEME-1), `dark` unless saved otherwise. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Sets the saved observer, if there is one; returns whether there was. */
  restoreSavedObserver: () => boolean;
  clearSavedObserver: () => void;
}

export const createPrefsSlice =
  (deps: PrefsDeps): StateCreator<AppState, [], [], PrefsSlice> =>
  (set, get) => ({
    sort: deps.prefs.read().sort ?? DEFAULT_PASS_SORT,
    setSort: (sort) => {
      set({ sort });
      deps.prefs.write({ ...deps.prefs.read(), sort });
    },
    chartView: deps.prefs.read().chartView ?? DEFAULT_CHART_VIEW,
    setChartView: (chartView) => {
      set({ chartView });
      deps.prefs.write({ ...deps.prefs.read(), chartView });
    },
    chartOrientation: deps.prefs.read().chartOrientation ?? DEFAULT_CHART_ORIENTATION,
    setChartOrientation: (chartOrientation) => {
      set({ chartOrientation });
      deps.prefs.write({ ...deps.prefs.read(), chartOrientation });
    },
    locale: resolveLocale(browserLanguages(), deps.prefs.read().locale),
    setLocale: (locale) => {
      set({ locale });
      deps.prefs.write({ ...deps.prefs.read(), locale });
    },
    theme: deps.prefs.read().theme ?? DEFAULT_THEME,
    setTheme: (theme) => {
      set({ theme });
      deps.prefs.write({ ...deps.prefs.read(), theme });
    },
    restoreSavedObserver: () => {
      const { observer } = deps.prefs.read();
      if (!observer) return false;
      get().setObserver(observer);
      return true;
    },
    clearSavedObserver: () => {
      get().setObserver(null); // the write-through removes the observer from storage
    },
  });
