import type { CatalogEntry, EpochMs, Observer, SatelliteRecord, WeatherSnapshot } from '../model';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { searchWindow } from './passWindow';
import { sameLocation } from './slices/location';
import type { AppStore } from './store';
import type { WorkerClient } from './workerClient';

/**
 * PLAN §4 `state/effects.ts`: observer change → load elements if needed →
 * hand them to the worker once → `computePasses`. Everything asynchronous
 * checks it is still the latest observer before writing, and the worker
 * client cancels the previous job when a new one starts, so a location change
 * mid-computation leaves only the new location's passes (spec §5.6).
 *
 * R7 adds the "Now" tick (FR-VIS-5, US-4 AC2): once the worker has the
 * elements, `computeNow` is requested at once and then every NOW_TICK_MS
 * while the tab is visible; a hidden tab stops the timer and a tab becoming
 * visible again refreshes immediately. The clock is injected (`now`) so the
 * effect itself never reads it, and only the latest request's reply is kept.
 *
 * R8 adds the cloud forecast (FR-WX-1, FR-WX-5, FR-LOC-3): requested for the
 * observer's cell the moment the observer changes, alongside the pass job and
 * without waiting for the elements. A rejection leaves the passes untouched
 * (verdicts read `unknown`); a snapshot fills `Observer.timeZone` when the
 * observer had none (D-3), which replaces the observer object but is not a
 * location change (`sameLocation`), so nothing is recomputed.
 */
export interface LoadedElements {
  records: SatelliteRecord[];
  unavailable: number[];
}

/** `document.hidden` and `visibilitychange`, abstracted so Node tests can drive it. */
export interface VisibilitySource {
  hidden: () => boolean;
  /** Calls `listener` on every change; returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
}

export interface EffectDeps {
  store: AppStore;
  client: WorkerClient;
  catalog: readonly CatalogEntry[];
  loadElements: (catalog: readonly CatalogEntry[], options: { signal: AbortSignal }) => Promise<LoadedElements>;
  /** The cached cloud forecast for a location (PLAN §7.3, `data/weatherCache.ts`). */
  loadWeather: (lat: number, lon: number) => Promise<WeatherSnapshot>;
  /** Wall clock for the "Now" requests; the only place the effects read time. */
  now: () => EpochMs;
  visibility: VisibilitySource;
}

/** US-4 AC2: the panel updates at least every 10 s. */
export const NOW_TICK_MS = 10_000;

/** The browser's Page Visibility API as a `VisibilitySource`. */
export function documentVisibility(doc: Document): VisibilitySource {
  return {
    hidden: () => doc.hidden,
    subscribe: (listener) => {
      doc.addEventListener('visibilitychange', listener);
      return () => {
        doc.removeEventListener('visibilitychange', listener);
      };
    },
  };
}

/** A source that is never hidden, for environments without a document. */
export const ALWAYS_VISIBLE: VisibilitySource = { hidden: () => false, subscribe: () => () => undefined };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Wires the effects; returns a function that stops them (aborts the load, cancels the job, stops the tick). */
export function startEffects({ store, client, catalog, loadElements, loadWeather, now, visibility }: EffectDeps): () => void {
  const controller = new AbortController();
  let generation = 0;
  let elementsPromise: Promise<SatelliteRecord[] | null> | null = null;
  let workerLoaded: Promise<void> | null = null;

  const ensureElements = (): Promise<SatelliteRecord[] | null> => {
    elementsPromise ??= (async () => {
      store.getState().setElements({ status: 'loading' });
      try {
        const { records, unavailable } = await loadElements(catalog, { signal: controller.signal });
        store.getState().setElements({ status: 'ready', records, unavailable, rejected: [] });
        return records;
      } catch (error: unknown) {
        if (controller.signal.aborted) return null;
        store.getState().setElements({ status: 'error', message: message(error) });
        elementsPromise = null; // the next observer change retries
        return null;
      }
    })();
    return elementsPromise;
  };

  const ensureWorkerLoaded = (records: SatelliteRecord[]): Promise<void> => {
    workerLoaded ??= client.loadElements(records).then(({ rejected }) => {
      store.getState().setRejected(rejected);
    });
    return workerLoaded;
  };

  // --- "Now" tick -----------------------------------------------------------
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  /** True once the worker holds the elements for the current observer, i.e. `computeNow` can be asked. */
  let tickReady = false;
  let nowSeq = 0;

  const requestNow = (): void => {
    const { observer } = store.getState();
    if (!observer || controller.signal.aborted || visibility.hidden()) return;
    const mine = ++nowSeq;
    const gen = generation;
    const fresh = (): boolean => mine === nowSeq && gen === generation && !controller.signal.aborted;
    // Written against the store's observer at reply time: still this location while `fresh()`, possibly with the zone filled in since.
    client.computeNow(observer, now(), DEFAULT_THRESHOLDS).then(
      (state) => {
        const current = store.getState().observer;
        if (fresh() && current) store.getState().setNow(current, state);
      },
      (error: unknown) => {
        const current = store.getState().observer;
        if (fresh() && current) store.getState().setNowError(current, message(error));
      },
    );
  };

  const stopTick = (): void => {
    if (tickTimer !== null) clearInterval(tickTimer);
    tickTimer = null;
  };

  /** Refresh now and every NOW_TICK_MS from now on (restarts the interval so the cadence is anchored on this call). */
  const startTick = (): void => {
    stopTick();
    if (visibility.hidden()) return;
    requestNow();
    tickTimer = setInterval(requestNow, NOW_TICK_MS);
  };

  const unsubscribeVisibility = visibility.subscribe(() => {
    if (visibility.hidden()) stopTick();
    else if (tickReady) startTick();
  });

  // --- Weather ------------------------------------------------------------------
  const requestWeather = (observer: Observer, stale: () => boolean): void => {
    store.getState().startWeather(observer);
    loadWeather(observer.lat, observer.lon).then(
      (snapshot) => {
        const current = store.getState().observer;
        if (stale() || !current) return;
        store.getState().setWeather(current, snapshot);
        if (current.timeZone === null) store.getState().fillTimeZone(snapshot.timeZone);
      },
      (error: unknown) => {
        const current = store.getState().observer;
        if (stale() || !current) return;
        store.getState().setWeatherError(current, message(error));
      },
    );
  };

  // --- Observer change --------------------------------------------------------
  const onObserverChange = async (): Promise<void> => {
    const mine = ++generation;
    nowSeq++; // any in-flight `computeNow` answer belongs to the previous observer
    tickReady = false;
    stopTick();
    const { observer, nowMs } = store.getState();
    const stale = (): boolean => mine !== generation || controller.signal.aborted;
    if (!observer) {
      const active = client.activeJobId();
      if (active !== null) client.cancel(active);
      store.getState().resetPasses();
      store.getState().resetNow();
      store.getState().resetWeather();
      return;
    }
    requestWeather(observer, stale);
    const records = await ensureElements();
    if (stale() || !records) return;
    if (records.length === 0) return;
    try {
      await ensureWorkerLoaded(records);
    } catch (error: unknown) {
      if (stale()) return;
      store.getState().setElements({ status: 'error', message: message(error) });
      return;
    }
    if (stale()) return;
    const window = searchWindow(nowMs);
    const jobId = client.computePasses(observer, window, DEFAULT_THRESHOLDS, {
      onPasses: (_noradId, passes) => {
        store.getState().addPasses(jobId, passes);
      },
      onProgress: (done, total) => {
        store.getState().setProgress(jobId, done, total);
      },
      onDone: (result) => {
        store.getState().finishJob(jobId, result);
      },
      onError: (code, message, terminal) => {
        if (terminal) store.getState().failJob(jobId, `${code}: ${message}`);
        else store.getState().skipObject(jobId, message);
      },
    });
    store.getState().startJob(jobId, observer, window);
    tickReady = true;
    startTick();
  };

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.nowMs !== previous.nowMs || !sameLocation(state.observer, previous.observer)) void onObserverChange();
  });
  void ensureElements(); // prefetch while the user types (R3 behaviour)

  return () => {
    unsubscribe();
    unsubscribeVisibility();
    stopTick();
    controller.abort();
    const active = client.activeJobId();
    if (active !== null) client.cancel(active);
  };
}
