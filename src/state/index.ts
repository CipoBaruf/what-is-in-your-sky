import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import { localPrefs, type LocalPrefs } from '../data/localPrefs';
import { appPassesCache, type PassesCache } from '../data/passesCache';
import { loadCloudForecast } from '../data/weatherCache';
import { searchPlaces } from '../data/openMeteo/geocode';
import { startDeviceNaming } from './deviceName';
import { documentVisibility, startEffects, type EffectDeps } from './effects';
import { applyLink, followHash as followHashIn, openLink } from './openLink';
import { setLiveNowClient } from './liveNow';
import { WIDE_QUERY } from '../lib/layout';
import { startMeasure } from './measure';
import { startMeasureEffects } from './measureEffects';
import type { MeasureEnv } from '../data/measure';
import { appStore, type AppStore } from './store';
import { createAppWorker, createWorkerClient, type WorkerLike } from './workerClient';
import { loadZoneCity, type ZoneCity } from '../data/zones/zoneCity';
import { activeObserver } from './slices/location';

export { appStore, useActiveObserver, useAppStore, type AppState } from './store';
export type { OpenLinkResult } from './openLink';

/**
 * R83 (F-93, D-539): the running tab's `hashchange` path. A link pasted into
 * the address bar, or followed inside the page, is read by `openLink` exactly
 * as one the tab booted on — a pass link is visited and its pass selected, not
 * dropped. `App` calls it on every `hashchange`; a hash that carries no place
 * (`#live`, `#settings`, a local `#pass=<id>`, none) changes nothing.
 */
export function followHash(hash: string, now: number = Date.now()): void {
  followHashIn(appStore, hash, now);
}
export type { ElementsState } from './slices/elements';
export { selectOrbitHeight } from './slices/elements';
/** R86 (D-540): failures are stored as kinds; the UI renders the sentence from `kind` and shows `detail` only behind `[ details ]`. */
export { toFailure, type Failure } from './failure';
export type { PassesState } from './slices/passes';
export type { WeatherSliceState } from './slices/weather';
export { NIGHT_MS } from './passWindow';
/** R25 (FR-OFF-1): the app shell's service worker; `main.tsx` registers it, the store carries the waiting version (D-79, D-126). */
export { registerServiceWorker } from './serviceWorker';
/** R33 (FR-LIVE-6): the live page's request for the dimmed set at the shown instant (D-169). */
export { computeNowAt, setLiveNowClient } from './liveNow';
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
/** R170 (FR-GLOBE-9, D-1051): the saved places' one order, newest use first and capped, for the globe's `Place` group. */
export { mostRecentlyUsed } from '../data/favourites';
/** R9: place-name search (PLAN §7.2, session-cached in `src/data`), handed to the UI through `src/state` so `src/ui` never imports `src/data` (PLAN §3). */
export { searchPlaces };
/** R11: the display name of a catalog object by NORAD id, for the banner that lists objects without elements (the store carries ids only). */
export function catalogName(noradId: number): string {
  return CATALOG.find((entry) => entry.noradId === noradId)?.name ?? `NORAD ${String(noradId)}`;
}
/** R12: whether a catalog object is featured (spec §8 rank 1, the ISS hero card); the UI never reads the catalog itself (PLAN §3). */
export function isFeatured(noradId: number): boolean {
  return CATALOG.find((entry) => entry.noradId === noradId)?.featured === true;
}
/** R188 (FR-FACT-2): a catalog object's English description, for the facts group; the UI never reads the catalog itself (PLAN §3). */
export function catalogDescription(noradId: number): string | undefined {
  return CATALOG.find((entry) => entry.noradId === noradId)?.description;
}
/** R188 (FR-FACT-1): the facts' entry type, for the group that shows them. */
export type { FactEntry } from '../data/catalog/facts';

/**
 * The pieces `startApp` would otherwise reach for itself: the singleton store,
 * the device's prefs and cache, a real `Worker`, the network loaders and the
 * wall clock. Production passes none of them. A test passes all of them, which
 * is the only way the guard below can be exercised *as it ships* rather than
 * mirrored in the test (a mirrored branch stays green when the real one is
 * deleted, which is what this seam exists to prevent).
 */
export interface StartAppOverrides {
  store?: AppStore;
  prefs?: LocalPrefs;
  cache?: Pick<PassesCache, 'loadForObserver' | 'save'>;
  createWorker?: () => WorkerLike;
  loadElements?: EffectDeps['loadElements'];
  loadWeather?: EffectDeps['loadWeather'];
  now?: EffectDeps['now'];
  visibility?: EffectDeps['visibility'];
  /** The hash to boot on; `window.location.hash` unless a test names one. */
  hash?: string;
  /** FR-MEAS-3 (D-1146): the sender's gates and beacon; the browser's unless a test names them. */
  measureEnv?: MeasureEnv;
  /** FR-OPEN-1: the browser's zone looked up in the table (D-1176); a test names the city. */
  loadZoneCity?: () => Promise<ZoneCity | null>;
  /** Runs its argument once the first frame has painted; a test runs it at once. */
  afterPaint?: (run: () => void) => void;
}

/** A frame, then a task: the first render has been committed and painted before the zone table is asked for. */
const afterFirstPaint = (run: () => void): void => {
  if (typeof requestAnimationFrame !== 'function') setTimeout(run, 0);
  else requestAnimationFrame(() => setTimeout(run, 0));
};

/**
 * R200 (FR-OPEN-2, D-1176): a first visit — nothing stored, no link's place — looks from the zone city after the first
 * paint; no city latches `no_city` without an example. A place set while the table loads wins. Returns the cancel.
 */
function startExample(store: AppStore, overrides: StartAppOverrides, now: () => number): () => void {
  let cancelled = false;
  const nothingSet = (): boolean => !cancelled && activeObserver(store.getState()) === null;
  if (!nothingSet()) return () => undefined;
  (overrides.afterPaint ?? afterFirstPaint)(() => {
    if (!nothingSet()) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    (overrides.loadZoneCity ?? loadZoneCity)().then(
      (city) => {
        if (!nothingSet()) return;
        if (city === null) store.getState().latchExampleOutcome('no_city');
        else store.getState().setExample({ lat: city.lat, lon: city.lon, altM: 0, label: city.name, source: 'example', timeZone: zone }, now());
      },
      // The table is part of the build; a chunk that fails to load leaves the reader with the question, as no city does.
      () => {
        if (nothingSet()) store.getState().latchExampleOutcome('no_city');
      },
    );
  });
  return () => {
    cancelled = true;
  };
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
export function startApp(overrides: StartAppOverrides = {}): () => void {
  const store = overrides.store ?? appStore;
  const prefs = overrides.prefs ?? localPrefs;
  const client = createWorkerClient(overrides.createWorker ?? createAppWorker);
  setLiveNowClient(client);
  const cache = overrides.cache ?? appPassesCache();
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
  // `sameHashPlace` (D-295) compares at the precision the hash carries, which
  // is `shareLinks.ts`'s own rounding and not a second copy of it.
  //
  // R83 (FR-VISIT-1, D-538, D-539; supersedes D-135's store-on-load): the
  // saved place is restored first, always, and the link is then read by
  // `openLink` against it. Over a saved place a link for another one is a
  // visit — this tab looks from there, `wiys:prefs:v1` is not written — and
  // D-280's "my own place" guard now covers pass links too. With nothing
  // saved the link's place is adopted and stored as before. The running tab's
  // `hashchange` goes through the same function (`followHash`).
  const now = overrides.now ?? (() => Date.now());
  store.getState().restoreSavedObserver();
  // FR-MEAS-1, D-1147: the load's context is fixed here, after the restore (first or return) and before a link is
  // read, so an adopted link is counted as a place set and the restored place is not.
  const loaded = store.getState();
  const wide = typeof matchMedia === 'function' && matchMedia(WIDE_QUERY).matches;
  const count = startMeasure({ returning: loaded.observer !== null, wide, lang: loaded.locale }, overrides.measureEnv);
  const stopMeasure = startMeasureEffects(store, count);
  applyLink(store, openLink(overrides.hash ?? window.location.hash, prefs.read().observer ?? null, now()));
  const stop = startEffects({
    store,
    client,
    catalog: CATALOG,
    loadElements: overrides.loadElements ?? loadElements,
    loadWeather: overrides.loadWeather ?? loadCloudForecast,
    loadStoredRun: (observer) => cache.loadForObserver(observer),
    saveRun: (run) => cache.save(run),
    now,
    visibility: overrides.visibility ?? documentVisibility(document),
  });
  // D-1025: a device location is named after the nearest town, on the device, once its coordinates are on screen.
  const stopNaming = startDeviceNaming(store);
  const stopExample = startExample(store, overrides, now);
  return () => {
    stopExample();
    stopMeasure();
    stopNaming();
    stop();
    setLiveNowClient(null);
    client.terminate();
  };
}
