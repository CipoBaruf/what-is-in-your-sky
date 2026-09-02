import { useStore } from 'zustand/react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { localPrefs } from '../data/localPrefs';
import { createElementsSlice, type ElementsSlice } from './slices/elements';
import { createLocationSlice, type LocationDeps, type LocationSlice } from './slices/location';
import { createNowSlice, type NowSlice } from './slices/now';
import { createPassesSlice, type PassesSlice } from './slices/passes';
import { createPrefsSlice, type PrefsDeps, type PrefsSlice } from './slices/prefs';
import { createWeatherSlice, type WeatherSlice } from './slices/weather';

/**
 * One vanilla Zustand store composed of slices (D-4). It is written from
 * plain modules (the effects, on worker messages) and read from React through
 * `useAppStore`. `createAppStore` exists for tests, which inject a fixed clock
 * and an in-memory prefs store; the app uses the single `appStore` below.
 * R10: every change of the observer object is written through to the prefs
 * (FR-LOC-5), the whole `Prefs` object being rewritten with the new observer
 * (or without one) so other preferences survive.
 */
export type AppState = LocationSlice & ElementsSlice & PassesSlice & NowSlice & WeatherSlice & PrefsSlice;
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
  }));
  store.subscribe((state, previous) => {
    if (state.observer === previous.observer) return;
    const { observer: _dropped, ...rest } = deps.prefs.read();
    deps.prefs.write(state.observer ? { ...rest, observer: state.observer } : rest);
  });
  return store;
}

export const appStore: AppStore = createAppStore({ now: () => Date.now(), prefs: localPrefs });

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}
