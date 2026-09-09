import type { StateCreator } from 'zustand/vanilla';
import { addFavourite as withFavourite, removeFavourite as withoutFavourite, touchFavourite as withFavouriteUsed } from '../../data/favourites';
import type { LocalPrefs } from '../../data/localPrefs';
import { decline, type InstallAnswer } from '../../lib/installSnooze';
import { DEFAULT_PASS_SORT } from '../../lib/passSort';
import { browserLanguages, resolveLocale } from '../../i18n/locale';
import { DEFAULT_CHART_ORIENTATION } from '../../lib/skyGeometry';
import { DEFAULT_LIVE_LEGEND_OPEN, DEFAULT_THEME, savedChartView as narrowChartView, type ChartOrientation, type EpochMs, type Favourite, type Locale, type Observer, type PassSort, type SavedChartView, type Theme } from '../../model';
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
 * R58 (D-277) split the chart view in two, the written preference and the
 * follow control's override. R66 (FR-WIN-5 as amended v1.3.1, V13-8, D-352)
 * puts it back together and replaces the override with what it always meant:
 * the sky screen is up. `chartView` is one saved value again, narrowed to the
 * dome and the polar chart — the window is a mode, not a view a page can be
 * left in — and a `'window'` written by an older build is migrated to the dome
 * on load, once, so nothing downstream has to know the old shape.
 *
 * Beside it are the three things the screen and the page that opened it have
 * to agree on, all session-only: `skyScreen`, whether the layer is up;
 * `windowNote`, the one line a refused permission or a phone with no compass
 * heading leaves beside the view control (FR-FOL-2); and `windowLost`, the
 * relative-only phone's answer, which takes the option away for the rest of
 * the session (FR-WIN-4). They live here rather than in `SkyChart`'s own state
 * because the window that fails is the one *on the screen*, and the control
 * that has to show for it is on the page underneath.
 */
export interface PrefsDeps {
  prefs: LocalPrefs;
  /** The same clock `LocationDeps` uses; the slice stamps `lastUsedAt` with it and never reads the wall clock itself. */
  now: () => EpochMs;
}

/** US-6 AC3: the dome is the default chart view; until R15 registers it, `SkyChart` falls back to the polar view. */
// FR-DOME-7: the dome again, now that FR-DOME-1..4 and FR-DOME-8 have made it readable. D-68 (polar for now) is closed by V1-4.
export const DEFAULT_CHART_VIEW: SavedChartView = 'dome';

export interface PrefsSlice {
  /** The pass list order (US-5 AC2), `chronological` unless saved otherwise. */
  sort: PassSort;
  setSort: (sort: PassSort) => void;
  /** The sky chart view (US-6 AC5), the dome unless saved otherwise (V1-4); never the window, which is a mode (D-352). */
  chartView: SavedChartView;
  /** Sets the view, through to storage. The window is not one of them: choosing it opens the screen and writes nothing. */
  setChartView: (view: SavedChartView) => void;
  /**
   * R71 (FR-LEG-7, D-387): whether the compact live page's legend panel is
   * open. Closed unless saved otherwise, so a first visit gets the box at
   * FR-COMP-5's floor; a corrupt stored value is not an answer and reads as
   * closed (`localPrefs.ts`).
   */
  liveLegendOpen: boolean;
  setLiveLegendOpen: (open: boolean) => void;
  /** R66 (FR-FSC-1, D-351): whether the sky screen is up. Session only — no page restores it and no hash carries it (FR-FSC-2). */
  skyScreen: boolean;
  /** Opens the screen. The caller has already asked for the permission inside its tap and had a reading with a heading (FR-WIN-4, D-350). */
  openSkyScreen: () => void;
  /** Closes it: the `×`, `Esc`, leaving the page, or a window that reports it cannot run here. */
  closeSkyScreen: () => void;
  /** FR-FOL-2: the one line beside the view control after a refusal or a phone with no north; cleared by the next choice. */
  windowNote: 'denied' | 'relative' | null;
  setWindowNote: (note: 'denied' | 'relative' | null) => void;
  /** FR-WIN-4: a phone that gives a relative heading only is not offered the window again this session. */
  windowLost: boolean;
  /**
   * FR-FSC-2 (D-351): the screen has just closed, so the view control's window
   * option takes focus back. A one-shot flag rather than an effect inside the
   * chart, because the page's chart is *unmounted* while the layer is up — it
   * is a new element when it returns and has no memory of having opened
   * anything — and `SkyChart` clears the flag when it has focused it.
   */
  refocusWindow: boolean;
  windowRefocused: () => void;
  /**
   * R66 (FR-WIN-4, FR-FOL-2, D-352; replaces R58's `dropChartView`): the
   * window, once mounted, says it cannot run here. It closes the screen, shows
   * the note beside the control on the page underneath, and — for a phone with
   * no compass heading, which will not have one on the next tap either — takes
   * the option off the control for the session. Nothing is written: the reader
   * chose neither the failure nor a view to fall back to.
   */
  dropWindowView: (reason: 'denied' | 'relative') => void;
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
 * D-352: the stored view, narrowed, and the migration that goes with it. A
 * device that chose the window before v1.3.1 has `'window'` under the key;
 * it reads as the dome and is rewritten at once, so the preference the reader
 * sees is the one the app will keep using.
 */
function migrateChartView(prefs: LocalPrefs): SavedChartView {
  const stored = prefs.read();
  const view = narrowChartView(stored.chartView, DEFAULT_CHART_VIEW);
  if (stored.chartView === 'window') prefs.write({ ...stored, chartView: view });
  return view;
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
      chartView: migrateChartView(deps.prefs),
      setChartView: (chartView) => {
        set({ chartView, windowNote: null });
        deps.prefs.write({ ...deps.prefs.read(), chartView });
      },
      liveLegendOpen: deps.prefs.read().liveLegendOpen ?? DEFAULT_LIVE_LEGEND_OPEN,
      setLiveLegendOpen: (liveLegendOpen) => {
        set({ liveLegendOpen });
        deps.prefs.write({ ...deps.prefs.read(), liveLegendOpen });
      },
      skyScreen: false,
      openSkyScreen: () => {
        set({ skyScreen: true, windowNote: null, refocusWindow: false });
      },
      closeSkyScreen: () => {
        set({ skyScreen: false, refocusWindow: true });
      },
      windowNote: null,
      setWindowNote: (windowNote) => {
        set({ windowNote });
      },
      windowLost: false,
      refocusWindow: false,
      windowRefocused: () => {
        set({ refocusWindow: false });
      },
      dropWindowView: (reason) => {
        set((state) => ({ skyScreen: false, windowNote: reason, windowLost: state.windowLost || reason === 'relative', refocusWindow: state.skyScreen }));
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
