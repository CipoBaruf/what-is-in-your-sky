import type { CatalogEntry, EpochMs, Observer, Pass, PassRun, SatelliteRecord, TimeWindow, WeatherSnapshot } from '../model';
import type { FinishedRun } from '../data/passesCache';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { searchWindow } from './passWindow';
import { sameLocation } from './slices/location';
import type { AppStore } from './store';
import type { RejectedElement } from '../worker/protocol';
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
 *
 * R24 puts the stored run in front of the network (FR-OFF-2, FR-OFF-5, PLAN
 * §7.5): an observer change first asks `passesCache` what was stored for that
 * cell and, if there is anything, renders it as a finished list; only then are
 * the forecast and the elements requested. Every job that finishes uncancelled
 * is written back, so storage needs no user action. A start-up with a location
 * already restored from the prefs takes the same path, which is what makes the
 * order prefs → stored run → render → network.
 *
 * R11 adds the elements re-check (PLAN §7.1): every ELEMENTS_RECHECK_MS while
 * the tab is visible the loader is asked again; the 2 h rule lives in the
 * loader, so most re-checks answer from the cache without a request. When
 * the answer carries a newer `fetchedAt` the worker is reloaded and the
 * current observer's passes are recomputed; when only the `stale` flag
 * changed the slice is updated so the banner follows. A re-check that fails
 * keeps what is on screen. A re-check while the first load failed retries it.
 */
export interface LoadedElements {
  records: SatelliteRecord[];
  unavailable: number[];
  fetchedAt: EpochMs;
  stale: boolean;
  persistent: boolean;
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
  /** The stored run for this observer's cell, expired or not (R24, `data/passesCache.ts`). */
  loadStoredRun: (observer: Observer) => Promise<PassRun | null>;
  /** Stores a finished job and prunes the older runs (FR-OFF-5). */
  saveRun: (run: FinishedRun) => Promise<PassRun | null>;
  /** Wall clock for the "Now" requests and the re-check cadence; the only place the effects read time. */
  now: () => EpochMs;
  visibility: VisibilitySource;
}

/** US-4 AC2: the panel updates at least every 10 s. */
export const NOW_TICK_MS = 10_000;
/** PLAN §7.1: the elements are re-checked every 15 min while the tab is visible; the loader enforces the 2 h rule. */
export const ELEMENTS_RECHECK_MS = 15 * 60_000;

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

/** Wires the effects; returns a function that stops them (aborts the load, cancels the job, stops the timers). */
export function startEffects({ store, client, catalog, loadElements, loadWeather, loadStoredRun, saveRun, now, visibility }: EffectDeps): () => void {
  const controller = new AbortController();
  let generation = 0;
  /** The latest set the loader gave us, or null until the first load succeeds. */
  let current: LoadedElements | null = null;
  let elementsPromise: Promise<SatelliteRecord[] | null> | null = null;
  let workerLoaded: Promise<void> | null = null;

  const publish = (loaded: LoadedElements, rejected: RejectedElement[]): void => {
    store.getState().setElements({
      status: 'ready',
      records: loaded.records,
      unavailable: loaded.unavailable,
      rejected,
      fetchedAt: loaded.fetchedAt,
      stale: loaded.stale,
      persistent: loaded.persistent,
    });
  };

  const ensureElements = (): Promise<SatelliteRecord[] | null> => {
    elementsPromise ??= (async () => {
      store.getState().setElements({ status: 'loading' });
      try {
        const loaded = await loadElements(catalog, { signal: controller.signal });
        current = loaded;
        publish(loaded, []);
        return loaded.records;
      } catch (error: unknown) {
        if (controller.signal.aborted) return null;
        store.getState().setElements({ status: 'error', message: message(error) });
        elementsPromise = null; // the next observer change (or re-check) retries
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

  // --- Stored passes (R24) --------------------------------------------------------
  /** What was stored for this observer, on screen before anything is requested (FR-OFF-2). Never throws: nothing stored is not a failure. */
  const showStoredRun = async (observer: Observer, stale: () => boolean): Promise<void> => {
    const run = await loadStoredRun(observer);
    if (run && !stale()) store.getState().showStoredPasses(run);
  };

  /**
   * The element set behind a finished run, as the FR-SAT-4 banner quotes it offline when there is
   * no loader answer to read. The age of a set is that of its *newest* epoch, not its oldest
   * (`lib/elementsAge.ts`): an old oldest epoch is normal for a quiet rocket body, while an old
   * newest epoch means the whole fetch is old. Taking the minimum here made a fresh set read as
   * weeks old and would have tripped R27's 5-day warning on it (D-108).
   */
  const newestElementsEpoch = (passes: Pass[]): EpochMs => {
    const epochs = current && current.records.length > 0 ? current.records.map((record) => record.epochMs) : passes.map((pass) => pass.elementsEpochMs);
    return epochs.length > 0 ? Math.max(...epochs) : now();
  };

  /** FR-OFF-5: every job that finishes uncancelled is stored, with no user action. */
  const storeRun = (jobId: string, observer: Observer, window: TimeWindow): void => {
    const { passes } = store.getState();
    if (passes.jobId !== jobId) return; // a newer job already owns the slice; its own `jobDone` will store it
    // An empty run is a real answer — a window with no darkness, or nothing bright enough — and is
    // worth storing. An empty run with objects skipped is not: propagation failed, and writing it
    // back would destroy the good run that is the only thing the app can show offline (D-108).
    if (passes.passes.length === 0 && passes.skipped.length > 0) return;
    void saveRun({ observer, window, newestElementsEpochMs: newestElementsEpoch(passes.passes), passes: passes.passes, hasDarkness: passes.hasDarkness ?? true });
  };

  // --- Pass job -----------------------------------------------------------------
  /** Elements (loaded, in the worker) → `computePasses` for `observer` over the 72 h from `windowStart` → the Now tick. */
  const computeFor = async (observer: Observer, windowStart: EpochMs, stale: () => boolean): Promise<void> => {
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
    const window = searchWindow(windowStart);
    const jobId = client.computePasses(observer, window, DEFAULT_THRESHOLDS, {
      onPasses: (_noradId, passes) => {
        store.getState().addPasses(jobId, passes);
      },
      onProgress: (done, total) => {
        store.getState().setProgress(jobId, done, total);
      },
      onDone: (result) => {
        store.getState().finishJob(jobId, result);
        if (!result.cancelled) storeRun(jobId, observer, window);
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

  /** Invalidates every in-flight chain; returns the predicate the new chain checks before writing. */
  const nextGeneration = (): (() => boolean) => {
    const mine = ++generation;
    nowSeq++; // any in-flight `computeNow` answer belongs to the previous chain
    tickReady = false;
    stopTick();
    return () => mine !== generation || controller.signal.aborted;
  };

  // --- Observer change --------------------------------------------------------
  const onObserverChange = async (): Promise<void> => {
    const stale = nextGeneration();
    const { observer, nowMs } = store.getState();
    if (!observer) {
      const active = client.activeJobId();
      if (active !== null) client.cancel(active);
      store.getState().resetPasses();
      store.getState().resetNow();
      store.getState().resetWeather();
      return;
    }
    // FR-OFF-2, PLAN §7.5: prefs → stored run → render → network. Nothing is requested until whatever
    // is stored for this location is on screen, so a cold start with no network shows the last three nights.
    await showStoredRun(observer, stale);
    if (stale()) return;
    requestWeather(observer, stale);
    await computeFor(observer, nowMs, stale);
  };

  // --- Elements re-check (R11) ---------------------------------------------------
  let recheckTimer: ReturnType<typeof setInterval> | null = null;
  let recheckInFlight = false;
  let lastCheckAt: EpochMs | null = null;

  const recheck = async (): Promise<void> => {
    if (recheckInFlight || controller.signal.aborted) return;
    lastCheckAt = now();
    if (!current) {
      // The first load failed (no cache, no network): retry it, computing for the observer if there is one.
      if (store.getState().observer) void onObserverChange();
      else void ensureElements();
      return;
    }
    recheckInFlight = true;
    try {
      const loaded = await loadElements(catalog, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const previous = current;
      current = loaded;
      elementsPromise = Promise.resolve(loaded.records);
      const newer = loaded.fetchedAt !== previous.fetchedAt;
      if (!newer && loaded.stale === previous.stale && loaded.persistent === previous.persistent) return;
      const { elements } = store.getState();
      publish(loaded, newer || elements.status !== 'ready' ? [] : elements.rejected);
      if (!newer) return;
      // New elements: the worker gets them again, and the current observer's passes are recomputed over a window from now.
      workerLoaded = null;
      const { observer } = store.getState();
      if (observer) await computeFor(observer, now(), nextGeneration());
    } catch (error: unknown) {
      if (!controller.signal.aborted) console.warn(`Elements re-check failed, keeping the loaded set: ${message(error)}`);
    } finally {
      recheckInFlight = false;
    }
  };

  const stopRecheck = (): void => {
    if (recheckTimer !== null) clearInterval(recheckTimer);
    recheckTimer = null;
  };

  const startRecheck = (): void => {
    stopRecheck();
    if (visibility.hidden()) return;
    // A tab hidden for longer than the cadence checks the moment it is shown again.
    if (lastCheckAt !== null && now() - lastCheckAt >= ELEMENTS_RECHECK_MS) void recheck();
    recheckTimer = setInterval(() => void recheck(), ELEMENTS_RECHECK_MS);
  };

  const unsubscribeVisibility = visibility.subscribe(() => {
    if (visibility.hidden()) {
      stopTick();
      stopRecheck();
    } else {
      if (tickReady) startTick();
      startRecheck();
    }
  });

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.nowMs !== previous.nowMs || !sameLocation(state.observer, previous.observer)) void onObserverChange();
  });
  lastCheckAt = now();
  // R24: with a location already restored from the prefs, the start-up chain runs for it — stored run first, then
  // the network. With no location there is nothing stored to show, so the elements are prefetched while the user types (R3).
  if (store.getState().observer) void onObserverChange();
  else void ensureElements();
  startRecheck();

  return () => {
    unsubscribe();
    unsubscribeVisibility();
    stopTick();
    stopRecheck();
    controller.abort();
    const active = client.activeJobId();
    if (active !== null) client.cancel(active);
  };
}
