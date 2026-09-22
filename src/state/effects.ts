import type { CatalogEntry, EpochMs, Observer, Pass, PassRun, SatelliteRecord, TimeWindow, WeatherSnapshot } from '../model';
import type { FinishedRun } from '../data/passesCache';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { searchWindow } from './passWindow';
import { activeObserver, sameLocation } from './slices/location';
import type { AppStore } from './store';
import { toFailure } from './failure';
import { IDLE_RETRY } from './slices/retry';
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
 *
 * R86 (FR-FAIL-1..4, FR-NIGHT-3, FR-NIGHT-4; D-536, D-537, D-540..D-543):
 * failures are stored as kinds (`toFailure`), and each has a retry action in
 * the store — `retryElements`, `retryWeather`, `retryPasses` — that re-enters
 * the path its first attempt took. The forecast is re-requested when the page
 * comes back with a snapshot older than WEATHER_MAX_AGE_MIN and by every
 * re-check after a failed one. A pass job ended by a dead or stalled worker is
 * a failed job, and the next worker is given the elements again. A run whose
 * window start is more than RECOMPUTE_STALE_H behind the clock is recomputed
 * when the page comes back and on the re-check (`recomputeIfStale`), the old
 * list standing in under the progress line; a stored run is shown only for
 * what is left of its window.
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
  loadWeather: (lat: number, lon: number, options?: { persist: boolean }) => Promise<WeatherSnapshot>;
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
/** FR-FAIL-3: a forecast older than this is re-requested when the page becomes visible. */
export const WEATHER_MAX_AGE_MIN = 60;
/** FR-NIGHT-4: a run whose window start is further behind the clock than this is recomputed on wake and on the re-check. */
export const RECOMPUTE_STALE_H = 2;
const WEATHER_MAX_AGE_MS = WEATHER_MAX_AGE_MIN * 60_000;
const RECOMPUTE_STALE_MS = RECOMPUTE_STALE_H * 3_600_000;

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
  /** R83 (D-538): the chain runs for the place on screen, a visited one included. */
  const lookingFrom = (): Observer | null => activeObserver(store.getState());
  /** A visited place's forecast and passes are not written to the device (FR-VISIT-1, D-538). */
  const visiting = (): boolean => store.getState().visiting !== null;

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
        store.getState().setElements({ status: 'error', failure: toFailure(error) });
        elementsPromise = null; // the next observer change, re-check or `retryElements` retries
        return null;
      }
    })();
    return elementsPromise;
  };

  /** The worker generation `workerLoaded` was sent to; a worker that died or stalled has been replaced by one holding nothing (D-543). */
  let loadedGeneration = client.generation();
  const ensureWorkerLoaded = (records: SatelliteRecord[]): Promise<void> => {
    if (loadedGeneration !== client.generation()) workerLoaded = null;
    if (workerLoaded === null) {
      loadedGeneration = client.generation();
      const loading: Promise<void> = client.loadElements(records).then(
        ({ rejected }) => {
          store.getState().setRejected(rejected);
        },
        (error: unknown) => {
          if (workerLoaded === loading) workerLoaded = null; // the next attempt sends them again
          throw error;
        },
      );
      workerLoaded = loading;
    }
    return workerLoaded;
  };

  // --- "Now" tick -----------------------------------------------------------
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  /** True once the worker holds the elements for the current observer, i.e. `computeNow` can be asked. */
  let tickReady = false;
  let nowSeq = 0;

  const requestNow = (): void => {
    const observer = lookingFrom();
    if (!observer || controller.signal.aborted || visibility.hidden()) return;
    const mine = ++nowSeq;
    const gen = generation;
    const fresh = (): boolean => mine === nowSeq && gen === generation && !controller.signal.aborted;
    // Written against the store's observer at reply time: still this location while `fresh()`, possibly with the zone filled in since.
    client.computeNow(observer, now(), DEFAULT_THRESHOLDS).then(
      (state) => {
        const current = lookingFrom();
        if (fresh() && current) store.getState().setNow(current, state);
      },
      (error: unknown) => {
        const current = lookingFrom();
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

  /** The guard for work started outside an observer change (a retry, a refresh): still the same chain, effects still running. */
  const sameChain = (): (() => boolean) => {
    const mine = generation;
    return () => mine !== generation || controller.signal.aborted;
  };

  // --- Weather ------------------------------------------------------------------
  let weatherSeq = 0;
  /**
   * Asks for the forecast of `observer`; only the latest request's answer is written. A refresh of the place on screen
   * keeps its snapshot until this answers (FR-FAIL-3), and a zone still unknown is filled from whichever attempt succeeds.
   */
  const requestWeather = (observer: Observer, stale: () => boolean): void => {
    const mine = ++weatherSeq;
    const superseded = (): boolean => mine !== weatherSeq || stale();
    store.getState().startWeather(observer);
    loadWeather(observer.lat, observer.lon, { persist: !visiting() }).then(
      (snapshot) => {
        const current = lookingFrom();
        if (superseded() || !current) return;
        store.getState().setWeather(current, snapshot);
        if (current.timeZone === null) store.getState().fillTimeZone(snapshot.timeZone);
      },
      (error: unknown) => {
        const current = lookingFrom();
        if (superseded() || !current) return;
        store.getState().setWeatherError(current, toFailure(error));
      },
    );
  };

  /** D-542: the page came back and the forecast on screen is older than WEATHER_MAX_AGE_MIN. */
  const refreshWeatherIfOld = (): void => {
    const observer = lookingFrom();
    const { weather } = store.getState();
    if (!observer || weather.snapshot === null || !sameLocation(weather.observer, observer)) return;
    if (now() - weather.snapshot.fetchedAt > WEATHER_MAX_AGE_MS) requestWeather(observer, sameChain());
  };

  /** D-542: the re-check runs and the last forecast attempt failed. */
  const retryFailedWeather = (): void => {
    const observer = lookingFrom();
    const { weather } = store.getState();
    if (observer && weather.error !== null && weather.status !== 'loading') requestWeather(observer, sameChain());
  };

  // --- Stored passes (R24) --------------------------------------------------------
  /** What was stored for this observer, on screen before anything is requested (FR-OFF-2). Never throws: nothing stored is not a failure. */
  const showStoredRun = async (observer: Observer, stale: () => boolean): Promise<void> => {
    const run = await loadStoredRun(observer);
    if (run && !stale()) store.getState().showStoredPasses(run, now());
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
    if (visiting()) return; // the stored run stays the saved place's (D-538)
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
      store.getState().setElements({ status: 'error', failure: toFailure(error) });
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
        if (terminal) store.getState().failJob(jobId, { kind: 'unknown', detail: `${code}: ${message}` });
        else store.getState().skipObject(jobId, message);
      },
      // D-543: the worker died or stalled. The job is a failed one, and the Now tick stops until a retry reloads a worker.
      onFailure: (failure) => {
        store.getState().failJob(jobId, failure);
        if (stale()) return;
        tickReady = false;
        stopTick();
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
    const observer = lookingFrom();
    const { nowMs } = store.getState();
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

  /** The first load failed (no cache, no network): retry it, computing for the observer if there is one. */
  const retryFirstLoad = (): void => {
    if (lookingFrom()) void onObserverChange();
    else void ensureElements();
  };

  /**
   * FR-NIGHT-4, D-537: the run on screen started more than RECOMPUTE_STALE_H ago and no job is running, so a recompute
   * over a window from now starts from the elements in hand. The old list stands in until the new one arrives.
   */
  const recomputeIfStale = (): void => {
    const observer = lookingFrom();
    if (!observer || !current || controller.signal.aborted || client.activeJobId() !== null) return;
    const { passes } = store.getState();
    if (passes.window === null || !sameLocation(passes.observer, observer)) return;
    const at = now();
    if (at - passes.window.startMs <= RECOMPUTE_STALE_MS) return;
    void computeFor(observer, at, nextGeneration());
  };

  /** Asks the loader again; true when newer elements arrived and a recompute was started for them. */
  const refreshElements = async (loadedBefore: LoadedElements): Promise<boolean> => {
    const loaded = await loadElements(catalog, { signal: controller.signal });
    if (controller.signal.aborted) return false;
    current = loaded;
    elementsPromise = Promise.resolve(loaded.records);
    const newer = loaded.fetchedAt !== loadedBefore.fetchedAt;
    if (!newer && loaded.stale === loadedBefore.stale && loaded.persistent === loadedBefore.persistent) return false;
    const { elements } = store.getState();
    publish(loaded, newer || elements.status !== 'ready' ? [] : elements.rejected);
    if (!newer) return false;
    // New elements: the worker gets them again, and the current observer's passes are recomputed over a window from now.
    workerLoaded = null;
    const observer = lookingFrom();
    if (!observer) return false;
    await computeFor(observer, now(), nextGeneration());
    return true;
  };

  const recheck = async (): Promise<void> => {
    if (recheckInFlight || controller.signal.aborted) return;
    lastCheckAt = now();
    if (!current) {
      retryFirstLoad(); // an observer change requests the forecast too
      return;
    }
    retryFailedWeather();
    recheckInFlight = true;
    let recomputed = false;
    try {
      recomputed = await refreshElements(current);
    } catch (error: unknown) {
      if (!controller.signal.aborted) console.warn(`Elements re-check failed, keeping the loaded set: ${message(error)}`);
    } finally {
      recheckInFlight = false;
    }
    if (!recomputed) recomputeIfStale();
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
      refreshWeatherIfOld();
      recomputeIfStale();
    }
  });

  // --- Retry actions (D-541) --------------------------------------------------------
  store.setState({
    retryElements: () => {
      if (controller.signal.aborted) return;
      retryFirstLoad();
    },
    retryWeather: () => {
      const observer = lookingFrom();
      if (observer && !controller.signal.aborted) requestWeather(observer, sameChain());
    },
    // D-543: a worker that died or stalled has been dropped by the client; this job's first message spawns the new one.
    retryPasses: () => {
      const observer = lookingFrom();
      if (observer && !controller.signal.aborted) void computeFor(observer, now(), nextGeneration());
    },
  });

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.nowMs !== previous.nowMs || !sameLocation(activeObserver(state), activeObserver(previous))) void onObserverChange();
  });
  lastCheckAt = now();
  // R24: with a location already restored from the prefs, the start-up chain runs for it — stored run first, then
  // the network. With no location there is nothing stored to show, so the elements are prefetched while the user types (R3).
  if (lookingFrom()) void onObserverChange();
  else void ensureElements();
  startRecheck();

  return () => {
    store.setState(IDLE_RETRY);
    unsubscribe();
    unsubscribeVisibility();
    stopTick();
    stopRecheck();
    controller.abort();
    const active = client.activeJobId();
    if (active !== null) client.cancel(active);
  };
}
