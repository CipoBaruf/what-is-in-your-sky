import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import { loadCloudForecast } from '../data/weatherCache';
import { searchPlaces } from '../data/openMeteo/geocode';
import { documentVisibility, startEffects } from './effects';
import { appStore } from './store';
import { createAppWorker, createWorkerClient } from './workerClient';

export { appStore, useAppStore, type AppState } from './store';
export type { ElementsState } from './slices/elements';
export type { PassesState, PassesStatus } from './slices/passes';
export type { NowSliceState } from './slices/now';
export type { WeatherSliceState, WeatherStatus } from './slices/weather';
export { SEARCH_WINDOW_HOURS } from './passWindow';
export { NOW_TICK_MS } from './effects';
/** The thresholds the state sends to the worker (D-27); the UI quotes them (e.g. "above 10°") from here, never from `src/physics`. */
export { DEFAULT_THRESHOLDS } from '../physics/constants';
/** R9: place-name search (PLAN §7.2, session-cached in `src/data`), handed to the UI through `src/state` so `src/ui` never imports `src/data` (PLAN §3). */
export { searchPlaces };
export type PlaceSearch = typeof searchPlaces;

/** Creates the worker, wires the effects to the app store and restores the saved location. Called once from `main.tsx`. */
export function startApp(): () => void {
  const client = createWorkerClient(createAppWorker());
  const stop = startEffects({
    store: appStore,
    client,
    catalog: CATALOG,
    loadElements,
    loadWeather: loadCloudForecast,
    now: () => Date.now(),
    visibility: documentVisibility(document),
  });
  // R10 (US-8): the saved location is restored after the effects are wired, so it is computed like a typed one.
  appStore.getState().restoreSavedObserver();
  return () => {
    stop();
    client.terminate();
  };
}
