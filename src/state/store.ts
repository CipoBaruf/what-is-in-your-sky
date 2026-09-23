import { useStore } from 'zustand/react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { localPrefs } from '../data/localPrefs';
import { createAppUpdateSlice, type AppUpdateSlice } from './slices/appUpdate';
import { createElementsSlice, type ElementsSlice } from './slices/elements';
import { createLocationSlice, type LocationDeps, type LocationSlice } from './slices/location';
import { createNowSlice, type NowSlice } from './slices/now';
import { createPassesSlice, type PassesSlice } from './slices/passes';
import { createPrefsSlice, type PrefsDeps, type PrefsSlice } from './slices/prefs';
import { createRetrySlice, type RetrySlice } from './slices/retry';
import { createUiSlice, type UiSlice } from './slices/ui';
import { createWeatherSlice, type WeatherSlice } from './slices/weather';
import { clearLocationHash } from './hash';
import { activeObserver } from './slices/location';

/**
 * One vanilla Zustand store composed of slices (D-4). It is written from
 * plain modules (the effects, on worker messages) and read from React through
 * `useAppStore`. `createAppStore` exists for tests, which inject a fixed clock
 * and an in-memory prefs store; the app uses the single `appStore` below.
 * R10: every change of the observer object is written through to the prefs
 * (FR-LOC-5), the whole `Prefs` object being rewritten with the new observer
 * (or without one) so other preferences survive.
 * R83 (D-538): `observer` only. A visited place (`visiting`) is never written,
 * so a link opened over a saved place leaves `wiys:prefs:v1` as it was.
 */
export type AppState = LocationSlice & ElementsSlice & PassesSlice & NowSlice & WeatherSlice & PrefsSlice & AppUpdateSlice & UiSlice & RetrySlice;
export type AppStore = StoreApi<AppState>;

export type AppStoreDeps = LocationDeps & PrefsDeps;

export function createAppStore(deps: AppStoreDeps): AppStore {
  const store = createStore<AppState>()((...a) => ({
    ...createLocationSlice(deps)(...a),
    ...createElementsSlice(...a),
    ...createPassesSlice(...a),
    ...createNowSlice(...a),
    ...createWeatherSlice(...a),
    ...createPrefsSlice(deps)(...a),
    ...createAppUpdateSlice(...a),
    ...createUiSlice(...a),
    ...createRetrySlice(...a),
  }));
  store.subscribe((state, previous) => {
    if (state.observer === previous.observer) return;
    const stored = deps.prefs.read();
    // R83: the observer the device already holds — the one restored at boot, the saved one back after a
    // visit — is not rewritten, so the key's bytes (its field order included) are left as they were.
    if (JSON.stringify(stored.observer ?? null) === JSON.stringify(state.observer)) return;
    const { observer: _dropped, ...rest } = stored;
    deps.prefs.write(state.observer ? { ...rest, observer: state.observer } : rest);
  });
  return store;
}

export const appStore: AppStore = createAppStore({ now: () => Date.now(), prefs: localPrefs, clearHash: clearLocationHash });

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

/** R83 (D-538): the observer every reader uses — the visited place while there is one, the saved one otherwise. */
export function useActiveObserver() {
  return useAppStore(activeObserver);
}
