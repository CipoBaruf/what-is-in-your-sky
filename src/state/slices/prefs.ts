import type { StateCreator } from 'zustand/vanilla';
import type { LocalPrefs } from '../../data/localPrefs';
import { DEFAULT_PASS_SORT } from '../../lib/passSort';
import type { PassSort } from '../../model';
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
 * R12 (US-5 AC2): the pass list order is the one preference the slice does
 * hold as state, read from storage when the store is created and written
 * through by `setSort`; the observer write-through preserves it.
 */
export interface PrefsDeps {
  prefs: LocalPrefs;
}

export interface PrefsSlice {
  /** The pass list order (US-5 AC2), `chronological` unless saved otherwise. */
  sort: PassSort;
  setSort: (sort: PassSort) => void;
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
