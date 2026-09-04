import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import { appPassesCache } from '../data/passesCache';
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
export { SEARCH_WINDOW_HOURS, SEARCH_WINDOW_NIGHTS } from './passWindow';
export { NOW_TICK_MS, ELEMENTS_RECHECK_MS } from './effects';
/** The thresholds the state sends to the worker (D-27); the UI quotes them (e.g. "above 10°") from here, never from `src/physics`. */
export { DEFAULT_THRESHOLDS } from '../physics/constants';
/** R9: place-name search (PLAN §7.2, session-cached in `src/data`), handed to the UI through `src/state` so `src/ui` never imports `src/data` (PLAN §3). */
export { searchPlaces };
export type PlaceSearch = typeof searchPlaces;
/** R11: the display name of a catalog object by NORAD id, for the banner that lists objects without elements (the store carries ids only). */
export function catalogName(noradId: number): string {
  return CATALOG.find((entry) => entry.noradId === noradId)?.name ?? `NORAD ${String(noradId)}`;
}
/** R12: whether a catalog object is featured (spec §8 rank 1, the ISS hero card); the UI never reads the catalog itself (PLAN §3). */
export function isFeatured(noradId: number): boolean {
  return CATALOG.find((entry) => entry.noradId === noradId)?.featured === true;
}

/**
 * Creates the worker, restores the saved location and wires the effects to
 * the app store. Called once from `main.tsx`.
 *
 * R10 (US-8) restored the location after the effects were wired, so it was
 * computed like a typed one. R24 moves it in front of them (FR-OFF-2, PLAN
 * §7.5: prefs → stored run → render → network): the effects find the observer
 * already there and run the same chain for it, which now starts by putting
 * whatever was stored for that location on screen. Nothing reaches the
 * network before that, so a cold start with no signal still shows a list.
 */
export function startApp(): () => void {
  const client = createWorkerClient(createAppWorker());
  const cache = appPassesCache();
  appStore.getState().restoreSavedObserver();
  const stop = startEffects({
    store: appStore,
    client,
    catalog: CATALOG,
    loadElements,
    loadWeather: loadCloudForecast,
    loadStoredRun: (observer) => cache.loadForObserver(observer),
    saveRun: (run) => cache.save(run),
    now: () => Date.now(),
    visibility: documentVisibility(document),
  });
  return () => {
    stop();
    client.terminate();
  };
}
