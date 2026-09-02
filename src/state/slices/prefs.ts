import type { StateCreator } from 'zustand/vanilla';
import type { LocalPrefs } from '../../data/localPrefs';
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
 */
export interface PrefsDeps {
  prefs: LocalPrefs;
}

export interface PrefsSlice {
  /** Sets the saved observer, if there is one; returns whether there was. */
  restoreSavedObserver: () => boolean;
  clearSavedObserver: () => void;
}

export const createPrefsSlice =
  (deps: PrefsDeps): StateCreator<AppState, [], [], PrefsSlice> =>
  (_set, get) => ({
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
