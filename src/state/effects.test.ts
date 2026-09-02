/**
 * Store tests with a fake worker (TASKS R5): the effects load the elements
 * through the real loader (MSW serves the fixture and asserts only CelesTrak
 * is called), hand them to the worker once, start a job per observer, cancel
 * the previous job when the observer changes, and never let a stale job's
 * late messages into the store.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../tests/setup/msw';
import { DAY_MS, fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../tests/support/catalogFixtures';
import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import type { Observer, Pass } from '../model';
import { startEffects } from './effects';
import { createAppStore, type AppStore } from './store';
import { createWorkerClient, type WorkerClient } from './workerClient';
import { fakeWorker } from './workerClient.test';

const ref = loadReferenceValues();
const NOW = goldenWindowStart(ref);
const neuquen: Observer = { ...ref.observer, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const paris: Observer = { lat: 48.86, lon: 2.35, altM: 0, label: '48.86, 2.35', source: 'coords', timeZone: null };

const samplePass = (noradId: number, startT: number): Pass => {
  const point = { t: startT, azDeg: 0, elDeg: 20, rangeKm: 800 };
  return {
    id: `${String(noradId)}-${String(startT)}`,
    noradId,
    name: `object ${String(noradId)}`,
    start: point,
    peak: { ...point, t: startT + 60_000 },
    end: { ...point, t: startT + 120_000 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: 120,
    peakMagnitude: 1,
    sunAltAtPeakDeg: -20,
    twilight: false,
    track: [],
    elementsEpochMs: ref.t,
  };
};

describe('startEffects', () => {
  let store: AppStore;
  let worker: ReturnType<typeof fakeWorker>;
  let client: WorkerClient;
  let stop: () => void;
  const requested: string[] = [];
  const onRequest = ({ request }: { request: Request }): void => {
    requested.push(request.url);
  };

  beforeEach(() => {
    requested.length = 0;
    server.events.on('request:start', onRequest);
    store = createAppStore({ now: () => NOW });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    stop = startEffects({ store, client, catalog: CATALOG, loadElements });
  });
  afterEach(() => {
    stop();
    server.events.removeListener('request:start', onRequest);
  });

  const sentOfType = <T extends (typeof worker.sent)[number]['type']>(type: T) => worker.sent.filter((m): m is (typeof worker.sent)[number] & { type: T } => m.type === type);
  const waitForSent = (type: (typeof worker.sent)[number]['type'], count = 1) => vi.waitFor(() => expect(sentOfType(type).length).toBeGreaterThanOrEqual(count));

  it('prefetches the elements once and calls only CelesTrak', async () => {
    await vi.waitFor(() => expect(store.getState().elements.status).toBe('ready'));
    const hosts = new Set(requested.map((u) => new URL(u).host));
    expect([...hosts]).toEqual(['celestrak.org']);
    expect(requested).toHaveLength(2);
    // The worker is told nothing until there is an observer.
    expect(worker.sent).toEqual([]);
  });

  it('observer set → elements to the worker once → computePasses with the 24 h window from the pinned clock', async () => {
    store.getState().setObserver(neuquen);
    await waitForSent('loadElements');
    const [load] = sentOfType('loadElements');
    expect(load?.records.map((r) => r.catalog.noradId)).toEqual(fixtureRecords().map((r) => r.catalog.noradId));
    worker.emit({ type: 'elementsLoaded', requestId: load?.requestId ?? '', loaded: [25544], rejected: [{ noradId: 1, reason: 'bad' }] });
    await waitForSent('computePasses');
    const [job] = sentOfType('computePasses');
    expect(job).toMatchObject({ observer: neuquen, window: { startMs: NOW, endMs: NOW + DAY_MS } });
    expect(store.getState().passes).toMatchObject({ jobId: job?.jobId, status: 'computing', observer: neuquen });
    const { elements } = store.getState();
    expect(elements.status === 'ready' && elements.rejected).toEqual([{ noradId: 1, reason: 'bad' }]);
    expect(requested).toHaveLength(2); // still the two group requests, no refetch
  });

  it('changing the observer twice quickly cancels the first job and ignores its late passes', async () => {
    store.getState().setObserver(neuquen);
    await waitForSent('loadElements');
    worker.emit({ type: 'elementsLoaded', requestId: sentOfType('loadElements')[0]?.requestId ?? '', loaded: [], rejected: [] });
    await waitForSent('computePasses');
    const first = sentOfType('computePasses')[0];
    if (!first) throw new Error('no first job');
    worker.emit({ type: 'passes', jobId: first.jobId, noradId: 25544, passes: [samplePass(25544, NOW + 1000)] });
    expect(store.getState().passes.passes).toHaveLength(1);

    store.getState().setObserver(paris);
    await waitForSent('computePasses', 2);
    const second = sentOfType('computePasses')[1];
    if (!second) throw new Error('no second job');
    expect(second.observer).toEqual(paris);
    expect(sentOfType('cancel')).toEqual([{ type: 'cancel', jobId: first.jobId }]);
    expect(sentOfType('loadElements')).toHaveLength(1); // elements are sent to the worker once
    expect(store.getState().passes).toMatchObject({ jobId: second.jobId, status: 'computing', observer: paris, passes: [] });

    // Late messages from the first job: dropped by the client, and the slice ignores the id anyway.
    worker.emit({ type: 'passes', jobId: first.jobId, noradId: 2, passes: [samplePass(2, NOW + 2000)] });
    worker.emit({ type: 'jobDone', jobId: first.jobId, cancelled: true, elapsedMs: 3, hasDarkness: true });
    expect(store.getState().passes.passes).toEqual([]);
    expect(store.getState().passes.status).toBe('computing');

    worker.emit({ type: 'passes', jobId: second.jobId, noradId: 3, passes: [samplePass(3, NOW + 5000)] });
    worker.emit({ type: 'passes', jobId: second.jobId, noradId: 4, passes: [samplePass(4, NOW + 4000)] });
    worker.emit({ type: 'progress', jobId: second.jobId, done: 2, total: 31 });
    expect(store.getState().passes.passes.map((p) => p.noradId)).toEqual([4, 3]); // sorted by start as they stream
    expect(store.getState().passes).toMatchObject({ done: 2, total: 31 });
    worker.emit({ type: 'error', ref: { jobId: second.jobId }, code: 'PROPAGATION_FAILED', message: 'object 5: boom' });
    worker.emit({ type: 'jobDone', jobId: second.jobId, cancelled: false, elapsedMs: 42, hasDarkness: true });
    expect(store.getState().passes).toMatchObject({ status: 'done', elapsedMs: 42, hasDarkness: true, skipped: [{ noradId: null, message: 'object 5: boom' }] });
  });

  it('clearing the observer cancels the job and resets the passes', async () => {
    store.getState().setObserver(neuquen);
    await waitForSent('loadElements');
    worker.emit({ type: 'elementsLoaded', requestId: sentOfType('loadElements')[0]?.requestId ?? '', loaded: [], rejected: [] });
    await waitForSent('computePasses');
    const job = sentOfType('computePasses')[0]?.jobId ?? '';
    store.getState().setObserver(null);
    expect(sentOfType('cancel')).toEqual([{ type: 'cancel', jobId: job }]);
    expect(store.getState().passes.status).toBe('idle');
  });

  it('a terminal worker error marks the job failed', async () => {
    store.getState().setObserver(neuquen);
    await waitForSent('loadElements');
    worker.emit({ type: 'elementsLoaded', requestId: sentOfType('loadElements')[0]?.requestId ?? '', loaded: [], rejected: [] });
    await waitForSent('computePasses');
    const job = sentOfType('computePasses')[0]?.jobId ?? '';
    worker.emit({ type: 'error', ref: { jobId: job }, code: 'INTERNAL', message: 'boom' });
    expect(store.getState().passes).toMatchObject({ status: 'error', error: 'INTERNAL: boom' });
  });

  it('a failed loadElements reply surfaces as an elements error', async () => {
    store.getState().setObserver(neuquen);
    await waitForSent('loadElements');
    worker.emit({ type: 'error', ref: { requestId: sentOfType('loadElements')[0]?.requestId ?? '' }, code: 'INTERNAL', message: 'worker down' });
    await vi.waitFor(() => expect(store.getState().elements).toEqual({ status: 'error', message: 'INTERNAL: worker down' }));
    expect(sentOfType('computePasses')).toEqual([]);
  });

  it('a failed fetch is reported and retried on the next observer change', async () => {
    stop();
    const failing = vi.fn().mockRejectedValueOnce(new Error('HTTP 503')).mockImplementation(loadElements);
    store = createAppStore({ now: () => NOW });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    stop = startEffects({ store, client, catalog: CATALOG, loadElements: failing });
    await vi.waitFor(() => expect(store.getState().elements).toEqual({ status: 'error', message: 'HTTP 503' }));
    store.getState().setObserver(neuquen);
    await vi.waitFor(() => expect(store.getState().elements.status).toBe('ready'));
    await waitForSent('loadElements');
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
