import type { EpochMs, NoradId, NowState, Observer, Pass, SatelliteRecord, TimeWindow, VisibilityThresholds } from '../model';
import type { RejectedElement, WorkerErrorCode, WorkerRequest, WorkerResponse } from '../worker/protocol';
import type { Failure, FailureKind } from './failure';

/**
 * Owns the worker and the request/response correlation of PLAN §6.2. Every
 * job or request gets a fresh id; a response whose id is no longer tracked is
 * dropped, so a cancelled job's late `passes` never reach the store. Issuing
 * a new `computePasses` cancels the previous one first (spec §5.6). One-shot
 * requests (`loadElements`, `computeNow`) are promises keyed by request id.
 *
 * R86 (FR-FAIL-4, D-543): a worker that dies or stalls ends its work. The
 * client listens for `error` and `messageerror`, and times the pass job: a
 * job with no `progress` (or `passes`) message for `JOB_STALL_S` is a
 * stall. Either terminates the worker, rejects every pending request and ends
 * the job through `onFailure` with the failure's kind (`timeout` for a
 * stall). The next message posted spawns a new worker from the factory, and
 * `generation()` moves on so the caller knows the new one holds no elements
 * yet. The worker's message contract (PLAN §6) is unchanged.
 */
export interface WorkerLikeEvents {
  message: MessageEvent<WorkerResponse>;
  error: Event;
  messageerror: Event;
}

export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  addEventListener<K extends keyof WorkerLikeEvents>(type: K, listener: (event: WorkerLikeEvents[K]) => void): void;
  terminate(): void;
}

/** FR-FAIL-4: a pass job that reports no progress for this long is ended. */
export const JOB_STALL_S = 60;

/** A request rejected because the worker died or stalled: an `Error` that is also a `Failure`, so `toFailure` keeps its kind. */
export class WorkerFailure extends Error implements Failure {
  constructor(
    readonly kind: FailureKind,
    readonly detail: string,
  ) {
    super(detail);
    this.name = 'WorkerFailure';
  }
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
  /** R86 (D-543): the worker died (`error`, `messageerror`) or the job stalled (`timeout`); the job is over. */
  onFailure: (failure: Failure) => void;
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
  /** R86: moves on each time the worker dies or stalls; a new value means the next worker holds no elements. */
  generation: () => number;
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

/** `spawn` makes a worker: once now, and again after one dies or stalls (D-543). */
export function createWorkerClient(spawn: () => WorkerLike, nextId: (prefix: string) => string = sequentialIds()): WorkerClient {
  const jobs = new Map<string, PassesJobHandlers>();
  /** One-shot requests awaiting their reply; the resolver receives the whole response and narrows it. */
  const requests = new Map<string, { resolve: (response: WorkerResponse) => void; reject: (reason: Error) => void }>();
  let active: string | null = null;
  let worker: WorkerLike | null = null;
  let generation = 0;
  let closed = false;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;

  const clearStall = (): void => {
    if (stallTimer !== null) clearTimeout(stallTimer);
    stallTimer = null;
  };

  /** The worker is gone: every pending request and the job end with `failure`, and the next post spawns a new one. */
  const die = (failure: Failure): void => {
    clearStall();
    const dead = worker;
    worker = null;
    generation++;
    dead?.terminate();
    const pendingRequests = [...requests.values()];
    const pendingJobs = [...jobs.values()];
    requests.clear();
    jobs.clear();
    active = null;
    for (const pending of pendingRequests) pending.reject(new WorkerFailure(failure.kind, failure.detail));
    for (const handlers of pendingJobs) handlers.onFailure(failure);
  };

  /** (Re)starts the stall timer for the active job; called when it starts and on each message of its progress. */
  const armStall = (): void => {
    clearStall();
    if (active === null) return;
    stallTimer = setTimeout(() => {
      die({ kind: 'timeout', detail: `The pass job reported no progress for ${String(JOB_STALL_S)} s` });
    }, JOB_STALL_S * 1000);
  };

  const settle = (requestId: string, response: WorkerResponse): void => {
    requests.get(requestId)?.resolve(response);
    requests.delete(requestId);
  };

  const endJob = (jobId: string): void => {
    jobs.delete(jobId);
    if (active === jobId) {
      active = null;
      clearStall();
    }
  };

  const onMessage = ({ data }: MessageEvent<WorkerResponse>): void => {
    switch (data.type) {
      case 'elementsLoaded':
      case 'nowState':
        settle(data.requestId, data);
        return;
      case 'passes':
        if (data.jobId === active) armStall();
        jobs.get(data.jobId)?.onPasses(data.noradId, data.passes);
        return;
      case 'progress':
        if (data.jobId === active) armStall();
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
  };

  const start = (): WorkerLike => {
    const created = spawn();
    // A listener of a worker that has since died is ignored: its late events belong to nothing.
    created.addEventListener('message', (event) => {
      if (created === worker) onMessage(event);
    });
    created.addEventListener('error', (event) => {
      if (created !== worker) return;
      const text = 'message' in event && typeof event.message === 'string' && event.message !== '' ? event.message : 'the worker failed';
      die({ kind: 'unknown', detail: `Worker error: ${text}` });
    });
    created.addEventListener('messageerror', () => {
      if (created === worker) die({ kind: 'bad-data', detail: 'Worker messageerror: a message could not be read' });
    });
    return created;
  };

  const post = (message: WorkerRequest): void => {
    if (closed) return;
    worker ??= start();
    worker.postMessage(message);
  };

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
      post(build(requestId));
    });

  const cancel = (jobId: string): void => {
    if (!jobs.has(jobId)) return;
    endJob(jobId);
    post({ type: 'cancel', jobId });
  };

  worker = start();

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
      post({ type: 'computePasses', jobId, observer, window, thresholds });
      armStall();
      return jobId;
    },
    cancel,
    activeJobId: () => active,
    generation: () => generation,
    terminate: () => {
      closed = true;
      clearStall();
      jobs.clear();
      requests.clear();
      active = null;
      worker?.terminate();
      worker = null;
    },
  };
}

/** The app's single module worker (PLAN §6.1); Vite bundles it from the URL. */
export function createAppWorker(): WorkerLike {
  return new Worker(new URL('../worker/passes.worker.ts', import.meta.url), { type: 'module' });
}
