import type { CatalogEntry, EpochMs, NoradId, SatelliteRecord } from '../model';
import { findPasses, hasDarkness, nowState, ommToSatrec, type NowObject, type SatRec } from '../physics';
import type { WorkerRequest, WorkerResponse } from './protocol';

/**
 * PLAN §6.2 as a pure function of `(state, request, emit)`: no `self`, no
 * `postMessage`, so Node tests drive it directly. `passes.worker.ts` binds it.
 *
 * - `loadElements` replaces the satrec map; a record `json2satrec` rejects is
 *   reported in `rejected` (BAD_OMM) and the rest load.
 * - `computePasses` streams one `passes` message per object, featured objects
 *   first, then `progress`, and yields to the event loop between objects so a
 *   queued `cancel` is seen (D-6). A cancelled job still ends with
 *   `jobDone { cancelled: true }`. An object whose search throws is skipped
 *   with `PROPAGATION_FAILED`; anything else is `INTERNAL` and aborts the job
 *   (no `jobDone` follows an `INTERNAL` or `NO_ELEMENTS` error).
 * - `computeNow` (R7, D-14) evaluates every loaded object at the request's `t`
 *   with `physics/now.ts` and answers one `nowState`; with nothing loaded it
 *   answers `NO_ELEMENTS`. It is a one-shot request and cannot be cancelled.
 */
export interface LoadedObject {
  satrec: SatRec;
  catalog: CatalogEntry;
  epochMs: EpochMs;
}

export interface HandlerState {
  objects: Map<NoradId, LoadedObject>;
  /** Job ids a `cancel` has been received for; cleared when the job ends. */
  cancelled: Set<string>;
}

export function createHandlerState(): HandlerState {
  return { objects: new Map(), cancelled: new Set() };
}

export type Emit = (response: WorkerResponse) => void;
export type Handler = (request: WorkerRequest, emit: Emit) => Promise<void>;

export interface HandlerOptions {
  /** Yield between objects; defaults to a `MessageChannel` ping (a macrotask, so queued messages run). */
  yieldToEventLoop?: () => Promise<void>;
  /** Monotonic clock for `elapsedMs`; never used for physics (D-15). */
  clock?: () => number;
}

/** A macrotask boundary: queued `message` events (including `cancel`) are dispatched before it resolves. */
export function yieldViaMessageChannel(): Promise<void> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = () => {
      port1.close();
      resolve();
    };
    port2.postMessage(null);
  });
}

/** Featured objects first (the ISS), the rest in the order they were loaded (PLAN §6.2). */
export function computeOrder(objects: Iterable<LoadedObject>): LoadedObject[] {
  return [...objects].sort((a, b) => Number(Boolean(b.catalog.featured)) - Number(Boolean(a.catalog.featured)));
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function createHandler(state: HandlerState, options: HandlerOptions = {}): Handler {
  const yieldToEventLoop = options.yieldToEventLoop ?? yieldViaMessageChannel;
  const clock = options.clock ?? (() => performance.now());

  const loadElements = (records: SatelliteRecord[]): WorkerResponse & { type: 'elementsLoaded' } => {
    const next = new Map<NoradId, LoadedObject>();
    const rejected: { noradId: NoradId; reason: string }[] = [];
    for (const record of records) {
      try {
        next.set(record.catalog.noradId, { satrec: ommToSatrec(record.omm), catalog: record.catalog, epochMs: record.epochMs });
      } catch (error: unknown) {
        rejected.push({ noradId: record.catalog.noradId, reason: message(error) });
      }
    }
    state.objects = next;
    return { type: 'elementsLoaded', requestId: '', loaded: [...next.keys()], rejected };
  };

  const computePasses = async (request: WorkerRequest & { type: 'computePasses' }, emit: Emit): Promise<void> => {
    const { jobId, observer, window, thresholds } = request;
    if (state.objects.size === 0) {
      emit({ type: 'error', ref: { jobId }, code: 'NO_ELEMENTS', message: 'No orbital elements loaded; send loadElements first' });
      return;
    }
    const t0 = clock();
    const order = computeOrder(state.objects.values());
    const total = order.length;
    const finish = (cancelled: boolean): void => {
      state.cancelled.delete(jobId);
      emit({ type: 'jobDone', jobId, cancelled, elapsedMs: clock() - t0, hasDarkness: hasDarkness(observer, window, thresholds) });
    };
    let done = 0;
    for (const object of order) {
      if (state.cancelled.has(jobId)) {
        finish(true);
        return;
      }
      const { catalog } = object;
      try {
        const passes = findPasses(object.satrec, observer, window, thresholds, {
          noradId: catalog.noradId,
          name: catalog.name,
          stdMag: catalog.stdMag,
          elementsEpochMs: object.epochMs,
        });
        emit({ type: 'passes', jobId, noradId: catalog.noradId, passes });
      } catch (error: unknown) {
        emit({ type: 'error', ref: { jobId }, code: 'PROPAGATION_FAILED', message: `${catalog.name} (${String(catalog.noradId)}): ${message(error)}` });
      }
      done++;
      emit({ type: 'progress', jobId, done, total });
      await yieldToEventLoop();
    }
    finish(state.cancelled.has(jobId));
  };

  return async (request, emit) => {
    try {
      switch (request.type) {
        case 'loadElements':
          emit({ ...loadElements(request.records), requestId: request.requestId });
          return;
        case 'computePasses':
          await computePasses(request, emit);
          return;
        case 'cancel':
          state.cancelled.add(request.jobId);
          return;
        case 'computeNow': {
          const { requestId, observer, t, thresholds } = request;
          if (state.objects.size === 0) {
            emit({ type: 'error', ref: { requestId }, code: 'NO_ELEMENTS', message: 'No orbital elements loaded; send loadElements first' });
            return;
          }
          const objects: NowObject[] = computeOrder(state.objects.values()).map((o) => ({
            satrec: o.satrec,
            noradId: o.catalog.noradId,
            name: o.catalog.name,
            stdMag: o.catalog.stdMag,
          }));
          emit({ type: 'nowState', requestId, state: nowState(objects, observer, t, thresholds) });
          return;
        }
        default: {
          const unknown: never = request;
          emit({ type: 'error', ref: {}, code: 'INTERNAL', message: `Unknown request ${JSON.stringify(unknown)}` });
        }
      }
    } catch (error: unknown) {
      const ref = 'jobId' in request ? { jobId: request.jobId } : 'requestId' in request ? { requestId: request.requestId } : {};
      if ('jobId' in request) state.cancelled.delete(request.jobId);
      emit({ type: 'error', ref, code: 'INTERNAL', message: message(error) });
    }
  };
}
