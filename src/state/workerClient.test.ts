import { describe, expect, it, vi } from 'vitest';
import type { Observer } from '../model';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';
import { createWorkerClient, sequentialIds, type PassesJobHandlers, type WorkerLike } from './workerClient';

/** A scripted worker: records what was posted, and the test emits the responses. */
export function fakeWorker(): WorkerLike & { sent: WorkerRequest[]; emit: (response: WorkerResponse) => void; terminated: boolean } {
  const listeners: ((event: MessageEvent<WorkerResponse>) => void)[] = [];
  const sent: WorkerRequest[] = [];
  return {
    sent,
    terminated: false,
    postMessage: (message) => {
      sent.push(message);
    },
    addEventListener: (_type, listener) => {
      listeners.push(listener);
    },
    terminate() {
      this.terminated = true;
    },
    emit: (response) => {
      for (const l of listeners) l({ data: response } as MessageEvent<WorkerResponse>);
    },
  };
}

const observer: Observer = { lat: 0, lon: 0, altM: 0, label: '0, 0', source: 'coords', timeZone: null };
const window = { startMs: 0, endMs: 1 };
const handlers = (): PassesJobHandlers => ({ onPasses: vi.fn(), onProgress: vi.fn(), onDone: vi.fn(), onError: vi.fn() });

describe('sequentialIds', () => {
  it('numbers ids per client, with the prefix', () => {
    const next = sequentialIds();
    expect([next('req'), next('job'), next('job')]).toEqual(['req-1', 'job-2', 'job-3']);
  });
});

describe('createWorkerClient', () => {
  it('loadElements resolves with the worker reply for its request id', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(worker);
    const pending = client.loadElements([]);
    expect(worker.sent[0]).toMatchObject({ type: 'loadElements', requestId: 'req-1', records: [] });
    worker.emit({ type: 'elementsLoaded', requestId: 'req-other', loaded: [1], rejected: [] });
    worker.emit({ type: 'elementsLoaded', requestId: 'req-1', loaded: [2], rejected: [{ noradId: 3, reason: 'bad' }] });
    await expect(pending).resolves.toEqual({ loaded: [2], rejected: [{ noradId: 3, reason: 'bad' }] });
  });

  it('loadElements rejects on an error carrying its request id', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(worker);
    const pending = client.loadElements([]);
    worker.emit({ type: 'error', ref: { requestId: 'req-1' }, code: 'INTERNAL', message: 'nope' });
    await expect(pending).rejects.toThrow('INTERNAL: nope');
  });

  it('computePasses cancels the previous job first, and drops that job’s late messages', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(worker);
    const first = handlers();
    const second = handlers();
    const job1 = client.computePasses(observer, window, DEFAULT_THRESHOLDS, first);
    expect(client.activeJobId()).toBe(job1);
    const job2 = client.computePasses(observer, window, DEFAULT_THRESHOLDS, second);
    expect(worker.sent.map((m) => m.type)).toEqual(['computePasses', 'cancel', 'computePasses']);
    expect(worker.sent[1]).toEqual({ type: 'cancel', jobId: job1 });
    expect(client.activeJobId()).toBe(job2);

    worker.emit({ type: 'passes', jobId: job1, noradId: 1, passes: [] });
    worker.emit({ type: 'progress', jobId: job1, done: 1, total: 2 });
    worker.emit({ type: 'jobDone', jobId: job1, cancelled: true, elapsedMs: 1, hasDarkness: true });
    expect(first.onPasses).not.toHaveBeenCalled();
    expect(first.onProgress).not.toHaveBeenCalled();
    expect(first.onDone).not.toHaveBeenCalled();

    worker.emit({ type: 'passes', jobId: job2, noradId: 1, passes: [] });
    worker.emit({ type: 'progress', jobId: job2, done: 1, total: 2 });
    expect(second.onPasses).toHaveBeenCalledWith(1, []);
    expect(second.onProgress).toHaveBeenCalledWith(1, 2);
    worker.emit({ type: 'jobDone', jobId: job2, cancelled: false, elapsedMs: 5, hasDarkness: false });
    expect(second.onDone).toHaveBeenCalledWith({ cancelled: false, elapsedMs: 5, hasDarkness: false });
    expect(client.activeJobId()).toBeNull();
  });

  it('computeNow resolves with the state for its request id and rejects on an error', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(worker);
    const state = { t: 5, sunAltDeg: -20, sky: 'dark' as const, items: [] };
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

  it('a reply of the wrong type rejects the request', async () => {
    const worker = fakeWorker();
    const client = createWorkerClient(worker);
    const pending = client.computeNow(observer, 5, DEFAULT_THRESHOLDS);
    worker.emit({ type: 'elementsLoaded', requestId: 'req-1', loaded: [], rejected: [] });
    await expect(pending).rejects.toThrow('Unexpected elementsLoaded reply to req-1');
  });

  it('cancel of an untracked job posts nothing', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(worker);
    client.cancel('job-99');
    expect(worker.sent).toEqual([]);
  });

  it('PROPAGATION_FAILED is reported and the job stays active; NO_ELEMENTS and INTERNAL end it', () => {
    const worker = fakeWorker();
    const client = createWorkerClient(worker);
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
    const client = createWorkerClient(worker);
    const h = handlers();
    const job = client.computePasses(observer, window, DEFAULT_THRESHOLDS, h);
    client.terminate();
    expect(worker.terminated).toBe(true);
    expect(client.activeJobId()).toBeNull();
    worker.emit({ type: 'passes', jobId: job, noradId: 1, passes: [] });
    expect(h.onPasses).not.toHaveBeenCalled();
  });
});
