import type { CatalogEntry, SatelliteRecord } from '../model';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { searchWindow } from './passWindow';
import type { AppStore } from './store';
import type { WorkerClient } from './workerClient';

/**
 * PLAN §4 `state/effects.ts`: observer change → load elements if needed →
 * hand them to the worker once → `computePasses`. Everything asynchronous
 * checks it is still the latest observer before writing, and the worker
 * client cancels the previous job when a new one starts, so a location change
 * mid-computation leaves only the new location's passes (spec §5.6).
 */
export interface LoadedElements {
  records: SatelliteRecord[];
  unavailable: number[];
}

export interface EffectDeps {
  store: AppStore;
  client: WorkerClient;
  catalog: readonly CatalogEntry[];
  loadElements: (catalog: readonly CatalogEntry[], options: { signal: AbortSignal }) => Promise<LoadedElements>;
}

/** Wires the effects; returns a function that stops them (aborts the load, cancels the job). */
export function startEffects({ store, client, catalog, loadElements }: EffectDeps): () => void {
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
        store.getState().setElements({ status: 'error', message: error instanceof Error ? error.message : String(error) });
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

  const onObserverChange = async (): Promise<void> => {
    const mine = ++generation;
    const { observer, nowMs } = store.getState();
    const stale = (): boolean => mine !== generation || controller.signal.aborted;
    if (!observer) {
      const active = client.activeJobId();
      if (active !== null) client.cancel(active);
      store.getState().resetPasses();
      return;
    }
    const records = await ensureElements();
    if (stale() || !records) return;
    if (records.length === 0) return;
    try {
      await ensureWorkerLoaded(records);
    } catch (error: unknown) {
      if (stale()) return;
      store.getState().setElements({ status: 'error', message: error instanceof Error ? error.message : String(error) });
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
  };

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.observer !== previous.observer || state.nowMs !== previous.nowMs) void onObserverChange();
  });
  void ensureElements(); // prefetch while the user types (R3 behaviour)

  return () => {
    unsubscribe();
    controller.abort();
    const active = client.activeJobId();
    if (active !== null) client.cancel(active);
  };
}
