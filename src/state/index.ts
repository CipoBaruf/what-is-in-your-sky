import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import { localPrefs } from '../data/localPrefs';
import { appPassesCache } from '../data/passesCache';
import { loadCloudForecast } from '../data/weatherCache';
import { searchPlaces } from '../data/openMeteo/geocode';
import { observerFromLink, parseHash, type SharedObserver } from '../lib/shareLinks';
import type { Observer } from '../model';
import { documentVisibility, startEffects } from './effects';
import { setLiveNowClient } from './liveNow';
import { appStore } from './store';
import { createAppWorker, createWorkerClient } from './workerClient';

export { appStore, useAppStore, type AppState } from './store';
export type { ElementsState } from './slices/elements';
export type { PassesState, PassesStatus } from './slices/passes';
export type { NowSliceState } from './slices/now';
export type { WeatherSliceState, WeatherStatus } from './slices/weather';
export { NIGHT_MS, SEARCH_WINDOW_HOURS, SEARCH_WINDOW_NIGHTS } from './passWindow';
/** R25 (FR-OFF-1): the app shell's service worker; `main.tsx` registers it, the store carries the waiting version (D-79, D-126). */
export { registerServiceWorker, SERVICE_WORKER_URL, SKIP_WAITING } from './serviceWorker';
export type { AppUpdateSlice } from './slices/appUpdate';
export { NOW_TICK_MS, ELEMENTS_RECHECK_MS } from './effects';
/** R33 (FR-LIVE-6): the live page's request for the dimmed set at the shown instant (D-169). */
export { computeNowAt, setLiveNowClient } from './liveNow';
/** The thresholds the state sends to the worker (D-27); the UI quotes them (e.g. "above 10°") from here, never from `src/physics`. */
export { DEFAULT_THRESHOLDS } from '../physics/constants';
/** R30 (FR-MOON-2): the glare thresholds the `[moon glare]` tooltip quotes, beside the visibility ones and for the same reason (D-27). */
export { DEFAULT_MOON_GLARE_THRESHOLDS } from '../physics/constants';
// R30's Moon tradition lookups moved to `state/moonLore.ts` (FR-FLAG-1, D-183):
// re-exporting them here would put `data/moon/lore.json` in the main chunk
// regardless of the `MOON_LORE` build flag, since this barrel is eager.
/**
 * R28 (FR-OFF-7): which saved place the active observer *is*. The answer is
 * `data/favourites.ts`'s cell key (D-138) and there must not be a second one,
 * so the panel that marks the entry in use reaches it through here rather than
 * comparing coordinates of its own (PLAN §3: `src/ui` never imports `src/data`).
 */
export { favouriteCellKey } from '../data/favourites';
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
 * D-280 (FR-LIVE-11, F-56): whether a `#live` link's coordinates are the
 * saved observer, at the precision the hash carries (`shareLinks.ts`'s two
 * decimals) — close enough that the link names no new place, so `startApp`
 * restores the saved observer (its label, its zone, its stored run) instead
 * of building a fresh `source: 'coords'` one that would drop them and start a
 * search. A hash for a different place stays what it is today: a new
 * observer.
 */
export function sameRoundedPlace(saved: Observer | null, link: SharedObserver): boolean {
  if (saved === null) return false;
  const round = (n: number): number => Math.round(n * 100);
  return round(saved.lat) === round(link.lat) && round(saved.lon) === round(link.lon);
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
  setLiveNowClient(client);
  const cache = appPassesCache();
  // R31 (FR-SHARE-1, FR-LIVE-9): a link carries its own observer, and it wins
  // over the saved one — someone who opens it asked to look from there. It is
  // set here, before the effects are wired, for the reason R24 moved the
  // restore here: the chain then runs once, for the right place, instead of
  // computing the saved location's passes and throwing them away a tick later
  // (D-135). It goes through `setObserver` like any other, so it is saved like
  // any other: the recipient's next visit opens where the link left them.
  // R58 (D-280): a `#live` link for the place already saved is not "someone
  // asking to look from there" — FR-LIVE-9 writes it into the hash on the
  // first scrub, which is how an ordinary session's own reload arrives here —
  // so that one restores the saved observer instead, stored run and all.
  const link = parseHash(window.location.hash);
  if (link !== null && link.kind === 'live' && sameRoundedPlace(localPrefs.read().observer ?? null, link.observer)) appStore.getState().restoreSavedObserver();
  else if (link !== null && link.kind !== 'passId') appStore.getState().setObserver(observerFromLink(link));
  else appStore.getState().restoreSavedObserver();
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
    setLiveNowClient(null);
    client.terminate();
  };
}
