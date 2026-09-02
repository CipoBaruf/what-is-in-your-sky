import { useStore } from 'zustand/react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createElementsSlice, type ElementsSlice } from './slices/elements';
import { createLocationSlice, type LocationDeps, type LocationSlice } from './slices/location';
import { createPassesSlice, type PassesSlice } from './slices/passes';

/**
 * One vanilla Zustand store composed of slices (D-4). It is written from
 * plain modules (the effects, on worker messages) and read from React through
 * `useAppStore`. `createAppStore` exists for tests, which inject a fixed clock;
 * the app uses the single `appStore` below.
 */
export type AppState = LocationSlice & ElementsSlice & PassesSlice;
export type AppStore = StoreApi<AppState>;

export type AppStoreDeps = LocationDeps;

export function createAppStore(deps: AppStoreDeps): AppStore {
  return createStore<AppState>()((...a) => ({
    ...createLocationSlice(deps)(...a),
    ...createElementsSlice(...a),
    ...createPassesSlice(...a),
  }));
}

export const appStore: AppStore = createAppStore({ now: () => Date.now() });

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}
