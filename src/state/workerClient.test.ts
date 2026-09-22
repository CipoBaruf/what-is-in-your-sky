import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Observer } from '../model';
import { MOON_FIXTURE } from '../../tests/support/moonFixtures';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';
import { toFailure } from './failure';
import { createWorkerClient, JOB_STALL_S, sequentialIds, type PassesJobHandlers, type WorkerLike, type WorkerLikeEvents } from './workerClient';

/** A scripted worker: records what was posted, and the test emits the responses (and, R86, its `error` and `messageerror` events). */
export function fakeWorker(): WorkerLike & {
  sent: WorkerRequest[];
  emit: (response: WorkerResponse) => void;
  fail: (type: 'error' | 'messageerror', message?: string) => void;
  terminated: boolean;
} {
  const listeners: { [K in keyof WorkerLikeEvents]: ((event: WorkerLikeEvents[K]) => void)[] } = { message: [], error: [], messageerror: [] };
  const sent: WorkerRequest[] = [];
  return {
    sent,
    terminated: false,
    postMessage: (message) => {
      sent.push(message);
    },
    addEventListener: (type, listener) => {
      (listeners[type] as (typeof listener)[]).push(listener);
    },
    terminate() {
      this.terminated = true;
    },
    emit: (response) => {
      for (const l of listeners.message) l({ data: response } as MessageEvent<WorkerResponse>);
    },
    fail: (type, message) => {
      for (const l of listeners[type]) l(Object.assign(new Event(type), message === undefined ? {} : { message }));
    },
  };
}

const observer: Observer = { lat: 0, lon: 0, altM: 0, label: '0, 0', source: 'coords', timeZone: null };
const window = { startMs: 0, endMs: 1 };
const handlers = (): PassesJobHandlers => ({ onPasses: vi.fn(), onProgress: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onFailure: vi.fn() });

describe('sequentialIds', () => {
  it('numbers ids per client, with the prefix', () => {
    const next = sequentialIds();
    expect([next('req'), next('job'), next('job')]).toEqual(['req-1', 'job-2', 'job-3']);
  });
});

describe('createWorkerClient', () => {
  it('loadElements resolves with the worker reply for its request id', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    const pending = client.loadElements([]);
    expect(worker.sent[0]).toMatchObject({ type: 'loadElements', requestId: 'req-1', records: [] });
    worker.emit({ type: 'elementsLoaded', requestId: 'req-other', loaded: [1], rejected: [] });
    worker.emit({ type: 'elementsLoaded', requestId: 'req-1', loaded: [2], rejected: [{ noradId: 3, reason: 'bad' }] });
    await expect(pending).resolves.toEqual({ loaded: [2], rejected: [{ noradId: 3, reason: 'bad' }] });
  });

  it('loadElements rejects on an error carrying its request id', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    const pending = client.loadElements([]);
    worker.emit({ type: 'error', ref: { requestId: 'req-1' }, code: 'INTERNAL', message: 'nope' });
    await expect(pending).rejects.toThrow('INTERNAL: nope');
  });

  it('computePasses cancels the previous job first, and drops that job’s late messages', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    const first = handlers();
    const second = handlers();
    const job1 = client.computePasses(observer, window, DEFAULT_THRESHOLDS, first);
    expect(client.activeJobId()).toBe(job1);
    const job2 = client.computePasses(observer, window, DEFAULT_THRESHOLDS, second);
    expect(worker.sent.map((m) => m.type)).toEqual(['computePasses', 'cancel', 'computePasses']);
    expect(worker.sent[1]).toEqual({ type: 'cancel', jobId: job1 });
    expect(client.activeJobId()).toBe(job2);

    worker.emit({ type: 'passes', jobId: job1, noradId: 1, nightIndex: 0, passes: [] });
    worker.emit({ type: 'progress', jobId: job1, done: 1, total: 2 });
    worker.emit({ type: 'jobDone', jobId: job1, cancelled: true, elapsedMs: 1, hasDarkness: true });
    expect(first.onPasses).not.toHaveBeenCalled();
    expect(first.onProgress).not.toHaveBeenCalled();
    expect(first.onDone).not.toHaveBeenCalled();

    worker.emit({ type: 'passes', jobId: job2, noradId: 1, nightIndex: 0, passes: [] });
    worker.emit({ type: 'progress', jobId: job2, done: 1, total: 2 });
    expect(second.onPasses).toHaveBeenCalledWith(1, []);
    expect(second.onProgress).toHaveBeenCalledWith(1, 2);
    worker.emit({ type: 'jobDone', jobId: job2, cancelled: false, elapsedMs: 5, hasDarkness: false });
    expect(second.onDone).toHaveBeenCalledWith({ cancelled: false, elapsedMs: 5, hasDarkness: false });
    expect(client.activeJobId()).toBeNull();
  });

  it('computeNow resolves with the state for its request id and rejects on an error', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    const state = { t: 5, sunAltDeg: -20, sky: 'dark' as const, items: [], moon: MOON_FIXTURE };
    const first = client.computeNow(observer, 5, DEFAULT_THRESHOLDS);
    const second = client.computeNow(observer, 6, DEFAULT_THRESHOLDS);
    expect(worker.sent).toEqual([
      { type: 'computeNow', requestId: 'req-1', observer, t: 5, thresholds: DEFAULT_THRESHOLDS },
      { type: 'computeNow', requestId: 'req-2', observer, t: 6, thresholds: DEFAULT_THRESHOLDS },
    ]);
    worker.emit({ type: 'nowState', requestId: 'req-2', state: { ...state, t: 6 } });
    worker.emit({ type: 'nowState', requestId: 'req-1', state });
    worker.emit({ type: 'nowState', requestId: 'req-1', state: { ...state, t: 99 } }); // a second reply is ignored
    await expect(first).resolves.toEqual(state);
    await expect(second).resolves.toEqual({ ...state, t: 6 });

    const third = client.computeNow(observer, 7, DEFAULT_THRESHOLDS);
    worker.emit({ type: 'error', ref: { requestId: 'req-3' }, code: 'NO_ELEMENTS', message: 'nothing loaded' });
    await expect(third).rejects.toThrow('NO_ELEMENTS: nothing loaded');
  });

  it('computeNow carries includeHidden only when asked for it (R33, FR-LIVE-6, D-76)', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    void client.computeNow(observer, 5, DEFAULT_THRESHOLDS, { includeHidden: true });
    void client.computeNow(observer, 6, DEFAULT_THRESHOLDS, { includeHidden: false });
    void client.computeNow(observer, 7, DEFAULT_THRESHOLDS, {});
    expect(worker.sent).toEqual([
      { type: 'computeNow', requestId: 'req-1', observer, t: 5, thresholds: DEFAULT_THRESHOLDS, includeHidden: true },
      { type: 'computeNow', requestId: 'req-2', observer, t: 6, thresholds: DEFAULT_THRESHOLDS },
      { type: 'computeNow', requestId: 'req-3', observer, t: 7, thresholds: DEFAULT_THRESHOLDS },
    ]);
  });

  it('a reply of the wrong type rejects the request', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    const pending = client.computeNow(observer, 5, DEFAULT_THRESHOLDS);
    worker.emit({ type: 'elementsLoaded', requestId: 'req-1', loaded: [], rejected: [] });
    await expect(pending).rejects.toThrow('Unexpected elementsLoaded reply to req-1');
  });

  it('cancel of an untracked job posts nothing', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    client.cancel('job-99');
    expect(worker.sent).toEqual([]);
  });

  it('PROPAGATION_FAILED is reported and the job stays active; NO_ELEMENTS and INTERNAL end it', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    const h = handlers();
    const job = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    worker.emit({ type: 'error', ref: { jobId: job }, code: 'PROPAGATION_FAILED', message: 'x' });
    expect(h.onError).toHaveBeenCalledWith('PROPAGATION_FAILED', 'x', false);
    expect(client.activeJobId()).toBe(job);
    worker.emit({ type: 'error', ref: { jobId: job }, code: 'INTERNAL', message: 'y' });
    expect(h.onError).toHaveBeenCalledWith('INTERNAL', 'y', true);
    expect(client.activeJobId()).toBeNull();
    worker.emit({ type: 'jobDone', jobId: job, cancelled: false, elapsedMs: 1, hasDarkness: true });
    expect(h.onDone).not.toHaveBeenCalled();

    const h2 = handlers();
    const job2 = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h2);
    worker.emit({ type: 'error', ref: { jobId: job2 }, code: 'NO_ELEMENTS', message: 'z' });
    expect(h2.onError).toHaveBeenCalledWith('NO_ELEMENTS', 'z', true);
    expect(client.activeJobId()).toBeNull();
  });

  it('terminate forgets every job and stops the worker', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(() => worker);
    const h = handlers();
    const job = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    client.terminate();
    expect(worker.terminated).toBe(true);
    expect(client.activeJobId()).toBeNull();
    worker.emit({ type: 'passes', jobId: job, noradId: 1, nightIndex: 0, passes: [] });
    expect(h.onPasses).not.toHaveBeenCalled();
  });
});

describe('createWorkerClient: a dead or stalled worker (R86, FR-FAIL-4, D-543)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A factory handing out a new fake per spawn, so a test can see the second worker. */
  const spawner = () => {
    const spawned: ReturnType<typeof fakeWorker>[] = [];
    return {
      spawned,
      spawn: () => {
        const worker = fakeWorker();
        spawned.push(worker);
        return worker;
      },
    };
  };

  it('an error event ends the job and the pending requests with its kind, and terminates the worker', async () => {
    const { spawned, spawn } = spawner();
    const client = createWorkerClient(spawn);
    const h = handlers();
    client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    const now = client.computeNow(observer, 5, DEFAULT_THRESHOLDS);
    const before = client.generation();
    spawned[0]?.fail('error', 'Uncaught ReferenceError: x is not defined');
    expect(h.onFailure).toHaveBeenCalledWith({ kind: 'unknown', detail: 'Worker error: Uncaught ReferenceError: x is not defined' });
    await expect(now).rejects.toMatchObject({ kind: 'unknown' });
    expect(spawned[0]?.terminated).toBe(true);
    expect(client.activeJobId()).toBeNull();
    expect(client.generation()).toBe(before + 1);
  });

  it('a messageerror ends the job as bad data', () => {
    const { spawned, spawn } = spawner();
    const client = createWorkerClient(spawn);
    const h = handlers();
    client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    spawned[0]?.fail('messageerror');
    expect(h.onFailure).toHaveBeenCalledWith(expect.objectContaining({ kind: 'bad-data' }));
  });

  it('a job silent for JOB_STALL_S is ended as a timeout; each progress message resets the clock', () => {
    vi.useFakeTimers();
    const { spawned, spawn } = spawner();
    const client = createWorkerClient(spawn);
    const h = handlers();
    const job = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    vi.advanceTimersByTime(59_000);
    spawned[0]?.emit({ type: 'progress', jobId: job, done: 1, total: 9 });
    vi.advanceTimersByTime(59_000);
    expect(h.onFailure).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(h.onFailure).toHaveBeenCalledWith({ kind: 'timeout', detail: `The pass job reported no progress for ${String(JOB_STALL_S)} s` });
    expect(toFailure(vi.mocked(h.onFailure).mock.calls[0]?.[0]).kind).toBe('timeout');
    expect(spawned[0]?.terminated).toBe(true);
    expect(client.activeJobId()).toBeNull();
  });

  it('a finished or cancelled job stops the stall clock', () => {
    vi.useFakeTimers();
    const { spawned, spawn } = spawner();
    const client = createWorkerClient(spawn);
    const h = handlers();
    const job = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    spawned[0]?.emit({ type: 'jobDone', jobId: job, cancelled: false, elapsedMs: 1, hasDarkness: true });
    const h2 = handlers();
    const job2 = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h2);
    client.cancel(job2);
    vi.advanceTimersByTime(JOB_STALL_S * 3000);
    expect(h.onFailure).not.toHaveBeenCalled();
    expect(h2.onFailure).not.toHaveBeenCalled();
    expect(spawned[0]?.terminated).toBe(false);
  });

  it('the next job after a stall spawns a new worker, and the dead one is not heard any more', () => {
    vi.useFakeTimers();
    const { spawned, spawn } = spawner();
    const client = createWorkerClient(spawn);
    const h = handlers();
    const job = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    vi.advanceTimersByTime(JOB_STALL_S * 1000);
    expect(spawned).toHaveLength(1);
    const retry = handlers();
    const job2 = client.computePasses(observer, window, DEFAULT_THRESHOLDS, retry);
    expect(spawned).toHaveLength(2);
    expect(spawned[1]?.sent).toEqual([{ type: 'computePasses', jobId: job2, observer, window, thresholds: DEFAULT_THRESHOLDS }]);
    spawned[0]?.emit({ type: 'progress', jobId: job, done: 1, total: 2 });
    expect(h.onProgress).not.toHaveBeenCalled();
    spawned[1]?.emit({ type: 'jobDone', jobId: job2, cancelled: false, elapsedMs: 3, hasDarkness: true });
    expect(retry.onDone).toHaveBeenCalled();
  });
});
