import type { StateCreator } from 'zustand/vanilla';
import { addFavourite as withFavourite, removeFavourite as withoutFavourite, touchFavourite as withFavouriteUsed } from '../../data/favourites';
import type { LocalPrefs } from '../../data/localPrefs';
import { decline, type InstallAnswer } from '../../lib/installSnooze';
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
 * `refreshFavouriteTimeZone` (F-12) is the weather slice's `fillTimeZone`
 * reaching in to update the matching favourite, so one saved before its first
 * forecast resolved does not keep `timeZone: null` forever.
 * R28 (FR-OFF-6) adds the install hint's answer. R55 (FR-OFF-6 as amended
 * v1.1.2, D-272) makes it two actions rather than one latch: `dismissInstallHint`
 * still ends the offer for good — an install, by our action or any other route
 * — and `declineInstallHint` is what "Not now" writes, a count and an expiry
 * from `lib/installSnooze.ts`, until the decline past the last snooze, which
 * ends it after all. The three fields are held together as one `InstallAnswer`
 * so the pure rule and the store cannot read the device differently.
 * R58 (D-277) splits the chart view in two: `savedChartView` is the written
 * preference and `viewOverride` is the follow control's, held only in memory.
 * `chartView` is the effective value the rest of the app already reads
 * (`viewOverride ?? savedChartView`), kept in sync by the setters rather than
 * computed lazily, so `SkyChart` and every other reader need no change. There
 * are three of them and only one writes: `setChartView` is the view control,
 * `setViewOverride` is the follow control, and `dropChartView` is a view
 * saying it cannot run here (FR-WIN-5's refused orientation), which must leave
 * the saved preference exactly as the reader left it.
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
  /** The sky chart view (US-6 AC5), `polar` unless saved otherwise (D-68) — the *effective* view: `viewOverride ?? savedChartView`. */
  chartView: ChartView;
  /** R58 (D-277, FR-FOL-1, FR-WIN-5 as amended): the view the follow control opened, while it is following. Never saved, and cleared when the live page leaves it (R59). */
  viewOverride: ChartView | null;
  setViewOverride: (view: ChartView | null) => void;
  /** R58 (D-277): the saved chart view underneath the override — what the view toggle reads and `setChartView` writes. */
  savedChartView: ChartView;
  /** Sets the saved view, through to storage, and ends any override: a reader who picks a view by hand while following simply stops following. */
  setChartView: (view: ChartView) => void;
  /**
   * R58 review (D-277, FR-WIN-5 as amended): a view that reports itself
   * unavailable — orientation refused, no compass heading — stops being the
   * view, and nothing is written. This is the only way out of a failed view:
   * `setChartView` would save it, and the reader chose neither the failure nor,
   * when the follow control opened the window, the view that failed.
   *
   * Clearing the override is enough when the failed view *is* the override
   * (the reader returns to what they chose). When it is what they chose, the
   * override becomes the default instead, so the effective view still leaves
   * the failed one while the preference waits for the phone it was saved on.
   */
  dropChartView: (view: ChartView) => void;
  /** The polar chart's convention (FR-GUIDE-4), `looking-up` unless saved otherwise. */
  chartOrientation: ChartOrientation;
  setChartOrientation: (orientation: ChartOrientation) => void;
  /** The language (FR-I18N-1), from the saved preference or the browser's list. */
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** The palette (FR-THEME-1), `dark` unless saved otherwise. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** R33 (FR-LIVE-6): whether the live page draws the hidden objects dimmed. Off unless saved otherwise. */
  liveHidden: boolean;
  setLiveHidden: (liveHidden: boolean) => void;
  /** The saved places (FR-OFF-7), newest use first, eight at most. Empty until one is saved. */
  favourites: Favourite[];
  /** Saves the observer under its own label, or refreshes the place already saved for its cell (D-138). */
  addFavourite: (observer: Observer) => void;
  /** Makes a saved place the observer, which recomputes (FR-VIS-5); false when there is no such place. */
  selectFavourite: (cellKey: string) => boolean;
  /** Forgets a saved place. The active observer, if it was that place, stays: removing is not leaving. */
  removeFavourite: (cellKey: string) => void;
  /** F-12: gives the matching favourite a zone once the forecast resolves one, if it was still saved without one. */
  refreshFavouriteTimeZone: (cellKey: string, timeZone: string) => void;
  /** FR-OFF-6 as amended (D-272): what this device remembers about the install offer — the latch, the declines and the current expiry. */
  installAnswer: InstallAnswer;
  /** Answers the install hint for good: the app was installed, or our install action was pressed. */
  dismissInstallHint: () => void;
  /** FR-OFF-6 as amended: "Not now" — a snooze, until the decline past the last one, which is the latch (D-272). */
  declineInstallHint: () => void;
  /** Sets the saved observer, if there is one; returns whether there was. */
  restoreSavedObserver: () => boolean;
  clearSavedObserver: () => void;
}

/**
 * The three stored fields as one answer, and back (D-272). Reading is where
 * the shape is normalised — an absent count is no declines — so the pure rule
 * in `lib/installSnooze.ts` never has to know what the storage leaves out.
 */
function readInstallAnswer(prefs: LocalPrefs): InstallAnswer {
  const stored = prefs.read();
  const answer: InstallAnswer = {};
  if (stored.installHintDismissed === true) answer.dismissed = true;
  if (stored.installHintDeclines !== undefined) answer.declines = stored.installHintDeclines;
  if (stored.installHintSnoozedUntil !== undefined) answer.snoozedUntil = stored.installHintSnoozedUntil;
  return answer;
}

/** Writes the answer through to the device and to the store, which is what the hint reads. */
function writeInstallAnswer(set: (partial: Partial<AppState>) => void, prefs: LocalPrefs, answer: InstallAnswer): void {
  set({ installAnswer: answer });
  const stored = { ...prefs.read() };
  delete stored.installHintDismissed;
  delete stored.installHintDeclines;
  delete stored.installHintSnoozedUntil;
  if (answer.dismissed === true) stored.installHintDismissed = true;
  if (answer.declines !== undefined) stored.installHintDeclines = answer.declines;
  if (answer.snoozedUntil !== undefined) stored.installHintSnoozedUntil = answer.snoozedUntil;
  prefs.write(stored);
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
      viewOverride: null,
      setViewOverride: (viewOverride) => {
        set((state) => ({ viewOverride, chartView: viewOverride ?? state.savedChartView }));
      },
      savedChartView: deps.prefs.read().chartView ?? DEFAULT_CHART_VIEW,
      setChartView: (chartView) => {
        set({ chartView, savedChartView: chartView, viewOverride: null });
        deps.prefs.write({ ...deps.prefs.read(), chartView });
      },
      dropChartView: (view) => {
        set((state) => {
          const viewOverride = state.savedChartView === view ? DEFAULT_CHART_VIEW : null;
          return { viewOverride, chartView: viewOverride ?? state.savedChartView };
        });
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
      liveHidden: deps.prefs.read().liveHidden ?? false,
      setLiveHidden: (liveHidden) => {
        set({ liveHidden });
        deps.prefs.write({ ...deps.prefs.read(), liveHidden });
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
      refreshFavouriteTimeZone: (cellKey, timeZone) => {
        const found = get().favourites.find((favourite) => favourite.cellKey === cellKey);
        if (!found || found.observer.timeZone !== null) return;
        saveFavourites(get().favourites.map((favourite) => (favourite.cellKey === cellKey ? { ...favourite, observer: { ...favourite.observer, timeZone } } : favourite)));
      },
      installAnswer: readInstallAnswer(deps.prefs),
      dismissInstallHint: () => {
        writeInstallAnswer(set, deps.prefs, { ...readInstallAnswer(deps.prefs), dismissed: true });
      },
      declineInstallHint: () => {
        writeInstallAnswer(set, deps.prefs, decline(readInstallAnswer(deps.prefs), deps.now()));
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
