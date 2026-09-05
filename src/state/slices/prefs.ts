import type { StateCreator } from 'zustand/vanilla';
import { addFavourite as withFavourite, removeFavourite as withoutFavourite, touchFavourite as withFavouriteUsed } from '../../data/favourites';
import type { LocalPrefs } from '../../data/localPrefs';
import { DEFAULT_PASS_SORT } from '../../lib/passSort';
import { browserLanguages, resolveLocale } from '../../i18n/locale';
import { DEFAULT_CHART_ORIENTATION } from '../../lib/skyGeometry';
import { DEFAULT_THEME, type ChartOrientation, type ChartView, type EpochMs, type Favourite, type Locale, type Observer, type PassSort, type Theme } from '../../model';
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
 * R26 (FR-OFF-7, US-17) adds the saved places, the one preference with
 * operations rather than a setter: `addFavourite`, `selectFavourite` and
 * `removeFavourite` each rewrite the list through `data/favourites.ts` and
 * write it back. Selecting goes through `setObserver` (D-139), so a favourite
 * starts the ordinary FR-VIS-5 recompute and nothing in the effects, the
 * worker or the caches has to learn that favourites exist.
 * R28 (FR-OFF-6) adds the install hint's dismissal, the one preference with no
 * setter, only a latch: `dismissInstallHint` writes `true` and there is no way
 * back, because "shown once" is the requirement (D-153).
 */
export interface PrefsDeps {
  prefs: LocalPrefs;
  /** The same clock `LocationDeps` uses; the slice stamps `lastUsedAt` with it and never reads the wall clock itself. */
  now: () => EpochMs;
}

/** US-6 AC3: the dome is the default chart view; until R15 registers it, `SkyChart` falls back to the polar view. */
// FR-DOME-7: the dome again, now that FR-DOME-1..4 and FR-DOME-8 have made it readable. D-68 (polar for now) is closed by V1-4.
export const DEFAULT_CHART_VIEW: ChartView = 'dome';

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
  /** The saved places (FR-OFF-7), newest use first, eight at most. Empty until one is saved. */
  favourites: Favourite[];
  /** Saves the observer under its own label, or refreshes the place already saved for its cell (D-138). */
  addFavourite: (observer: Observer) => void;
  /** Makes a saved place the observer, which recomputes (FR-VIS-5); false when there is no such place. */
  selectFavourite: (cellKey: string) => boolean;
  /** Forgets a saved place. The active observer, if it was that place, stays: removing is not leaving. */
  removeFavourite: (cellKey: string) => void;
  /** FR-OFF-6: whether the install hint has already been answered on this device. */
  installHintDismissed: boolean;
  /** Answers the install hint for good — installed, declined or waved away, it is the same latch. */
  dismissInstallHint: () => void;
  /** Sets the saved observer, if there is one; returns whether there was. */
  restoreSavedObserver: () => boolean;
  clearSavedObserver: () => void;
}

export const createPrefsSlice =
  (deps: PrefsDeps): StateCreator<AppState, [], [], PrefsSlice> =>
  (set, get) => {
    /** State and storage together, and an empty list is no key: the same shape the observer write-through uses. */
    const saveFavourites = (favourites: Favourite[]): void => {
      set({ favourites });
      const { favourites: _dropped, ...rest } = deps.prefs.read();
      deps.prefs.write(favourites.length > 0 ? { ...rest, favourites } : rest);
    };

    return {
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
      favourites: deps.prefs.read().favourites ?? [],
      addFavourite: (observer) => {
        saveFavourites(withFavourite(get().favourites, observer, deps.now()));
      },
      selectFavourite: (cellKey) => {
        const found = get().favourites.find((favourite) => favourite.cellKey === cellKey);
        if (!found) return false;
        // Both write-throughs re-read the stored object and replace one field of it, so the use stamped
        // here and the observer set below survive each other under the one key (D-139).
        saveFavourites(withFavouriteUsed(get().favourites, cellKey, deps.now()));
        get().setObserver(found.observer);
        return true;
      },
      removeFavourite: (cellKey) => {
        saveFavourites(withoutFavourite(get().favourites, cellKey));
      },
      installHintDismissed: deps.prefs.read().installHintDismissed ?? false,
      dismissInstallHint: () => {
        set({ installHintDismissed: true });
        deps.prefs.write({ ...deps.prefs.read(), installHintDismissed: true });
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
    };
  };
