import type { EpochMs, NoradId, NowState, Observer, Pass, SatelliteRecord, TimeWindow, VisibilityThresholds } from '../model';
import type { RejectedElement, WorkerErrorCode, WorkerRequest, WorkerResponse } from '../worker/protocol';

/**
 * Owns the worker and the request/response correlation of PLAN §6.2. Every
 * job or request gets a fresh id; a response whose id is no longer tracked is
 * dropped, so a cancelled job's late `passes` never reach the store. Issuing
 * a new `computePasses` cancels the previous one first (spec §5.6). One-shot
 * requests (`loadElements`, `computeNow`) are promises keyed by request id.
 */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void;
  terminate(): void;
}

export interface ElementsLoaded {
  loaded: NoradId[];
  rejected: RejectedElement[];
}

export interface PassesJobHandlers {
  onPasses: (noradId: NoradId, passes: Pass[]) => void;
  onProgress: (done: number, total: number) => void;
  onDone: (result: { cancelled: boolean; elapsedMs: number; hasDarkness: boolean }) => void;
  /** PROPAGATION_FAILED is per object and the job goes on; NO_ELEMENTS and INTERNAL end the job. */
  onError: (code: WorkerErrorCode, message: string, terminal: boolean) => void;
}

export interface WorkerClient {
  loadElements: (records: SatelliteRecord[]) => Promise<ElementsLoaded>;
  /** Cancels the previous job, if any, and returns the new job's id. */
  computePasses: (observer: Observer, window: TimeWindow, thresholds: VisibilityThresholds, handlers: PassesJobHandlers) => string;
  /**
   * R7 (D-14): every loaded object at `t`; the worker answers between the
   * objects of a running job. R33 (FR-LIVE-6, D-76): with `includeHidden` the
   * state also carries `hidden`, the dimmed set at `t`; without it the request
   * is the MVP one, byte for byte.
   */
  computeNow: (observer: Observer, t: EpochMs, thresholds: VisibilityThresholds, options?: NowRequestOptions) => Promise<NowState>;
  cancel: (jobId: string) => void;
  activeJobId: () => string | null;
  terminate: () => void;
}

export interface NowRequestOptions {
  includeHidden?: boolean;
}

export const TERMINAL_JOB_ERRORS: readonly WorkerErrorCode[] = ['NO_ELEMENTS', 'INTERNAL'];

/** Deterministic ids: `job-1`, `req-1`, … (no clock, no randomness). */
export function sequentialIds(): (prefix: string) => string {
  let n = 0;
  return (prefix) => `${prefix}-${String(++n)}`;
}

export function createWorkerClient(worker: WorkerLike, nextId: (prefix: string) => string = sequentialIds()): WorkerClient {
  const jobs = new Map<string, PassesJobHandlers>();
  /** One-shot requests awaiting their reply; the resolver receives the whole response and narrows it. */
  const requests = new Map<string, { resolve: (response: WorkerResponse) => void; reject: (reason: Error) => void }>();
  let active: string | null = null;

  const request = <T>(build: (requestId: string) => WorkerRequest, pick: (response: WorkerResponse) => T | null): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const requestId = nextId('req');
      requests.set(requestId, {
        resolve: (response) => {
          const value = pick(response);
          if (value === null) reject(new Error(`Unexpected ${response.type} reply to ${requestId}`));
          else resolve(value);
        },
        reject,
      });
      worker.postMessage(build(requestId));
    });

  const settle = (requestId: string, response: WorkerResponse): void => {
    requests.get(requestId)?.resolve(response);
    requests.delete(requestId);
  };

  const endJob = (jobId: string): void => {
    jobs.delete(jobId);
    if (active === jobId) active = null;
  };

  worker.addEventListener('message', ({ data }) => {
    switch (data.type) {
      case 'elementsLoaded':
      case 'nowState':
        settle(data.requestId, data);
        return;
      case 'passes':
        jobs.get(data.jobId)?.onPasses(data.noradId, data.passes);
        return;
      case 'progress':
        jobs.get(data.jobId)?.onProgress(data.done, data.total);
        return;
      case 'jobDone': {
        const handlers = jobs.get(data.jobId);
        endJob(data.jobId);
        handlers?.onDone({ cancelled: data.cancelled, elapsedMs: data.elapsedMs, hasDarkness: data.hasDarkness });
        return;
      }
      case 'error': {
        const { jobId, requestId } = data.ref;
        if (requestId !== undefined) {
          requests.get(requestId)?.reject(new Error(`${data.code}: ${data.message}`));
          requests.delete(requestId);
        }
        if (jobId !== undefined) {
          const handlers = jobs.get(jobId);
          const terminal = TERMINAL_JOB_ERRORS.includes(data.code);
          if (terminal) endJob(jobId);
          handlers?.onError(data.code, data.message, terminal);
        }
        return;
      }
    }
  });

  const cancel = (jobId: string): void => {
    if (!jobs.has(jobId)) return;
    endJob(jobId);
    worker.postMessage({ type: 'cancel', jobId });
  };

  return {
    loadElements: (records) =>
      request(
        (requestId) => ({ type: 'loadElements', requestId, records }),
        (r) => (r.type === 'elementsLoaded' ? { loaded: r.loaded, rejected: r.rejected } : null),
      ),
    computeNow: (observer, t, thresholds, options = {}) =>
      request(
        (requestId) => ({ type: 'computeNow', requestId, observer, t, thresholds, ...(options.includeHidden ? { includeHidden: true } : {}) }),
        (r) => (r.type === 'nowState' ? r.state : null),
      ),
    computePasses: (observer, window, thresholds, handlers) => {
      if (active !== null) cancel(active);
      const jobId = nextId('job');
      jobs.set(jobId, handlers);
      active = jobId;
      worker.postMessage({ type: 'computePasses', jobId, observer, window, thresholds });
      return jobId;
    },
    cancel,
    activeJobId: () => active,
    terminate: () => {
      jobs.clear();
      requests.clear();
      active = null;
      worker.terminate();
    },
  };
}

/** The app's single module worker (PLAN §6.1); Vite bundles it from the URL. */
export function createAppWorker(): WorkerLike {
  return new Worker(new URL('../worker/passes.worker.ts', import.meta.url), { type: 'module' });
}
