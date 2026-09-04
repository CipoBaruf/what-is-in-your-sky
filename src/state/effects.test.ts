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
import { idbCache } from '../../tests/support/elementsCache';
import { MOON_FIXTURE, NO_MOON_AT_PEAK } from '../../tests/support/moonFixtures';
import { CATALOG } from '../data/catalog';
import { loadElements } from '../data/elementsLoader';
import type { CatalogEntry, NowState, Observer, Pass, PassRun, SatelliteRecord, WeatherSnapshot } from '../model';
import type { FinishedRun } from '../data/passesCache';
import { ALWAYS_VISIBLE, ELEMENTS_RECHECK_MS, NOW_TICK_MS, startEffects, type EffectDeps, type LoadedElements, type VisibilitySource } from './effects';
import { SEARCH_WINDOW_MS } from './passWindow';
import { createLocalPrefs } from '../data/localPrefs';
import { createAppStore, type AppStore } from './store';
import { createWorkerClient, type WorkerClient } from './workerClient';
import type { WorkerRequest } from '../worker/protocol';
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
    ...NO_MOON_AT_PEAK, // the effects do not read the Moon (R19)
  };
};

/** What the loader answers for a fresh, persistent set fetched at NOW. */
const loaded = (records: SatelliteRecord[], extra: Partial<LoadedElements> = {}): LoadedElements => ({ records, unavailable: [], fetchedAt: NOW, stale: false, persistent: true, ...extra });

/** The real loader over a fresh IndexedDB cache (R11), so each test starts with nothing cached and its requests are its own. */
const freshLoader = (): EffectDeps['loadElements'] => {
  const cache = idbCache(() => NOW);
  return (catalog, options) => loadElements(catalog, { ...options, cache });
};

/** A forecast that never arrives, for the tests that are not about weather. */
const neverWeather = (): Promise<WeatherSnapshot> => new Promise(() => undefined);

/** A device with nothing stored, for the tests that are not about offline storage (R24). */
const noStorage: Pick<EffectDeps, 'loadStoredRun' | 'saveRun'> = { loadStoredRun: () => Promise.resolve(null), saveRun: () => Promise.resolve(null) };

const snapshotFor = (lat: number, lon: number): WeatherSnapshot => ({
  provider: 'open-meteo',
  lat,
  lon,
  cellKey: `${lat.toFixed(1)},${lon.toFixed(1)}`,
  fetchedAt: NOW,
  timeZone: 'America/Argentina/Salta',
  hourly: [
    { t: NOW - 3_600_000, totalPct: 10, lowPct: 10, midPct: 0, highPct: 0 },
    { t: NOW + DAY_MS, totalPct: 10, lowPct: 10, midPct: 0, highPct: 0 },
  ],
});

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
    store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(null) });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    stop = startEffects({ ...noStorage, store, client, catalog: CATALOG, loadElements: freshLoader(), loadWeather: neverWeather, now: () => NOW, visibility: ALWAYS_VISIBLE });
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

  it('observer set → elements to the worker once → computePasses with the 72 h window from the pinned clock', async () => {
    store.getState().setObserver(neuquen);
    await waitForSent('loadElements');
    const [load] = sentOfType('loadElements');
    expect(load?.records.map((r) => r.catalog.noradId)).toEqual(fixtureRecords().map((r) => r.catalog.noradId));
    worker.emit({ type: 'elementsLoaded', requestId: load?.requestId ?? '', loaded: [25544], rejected: [{ noradId: 1, reason: 'bad' }] });
    await waitForSent('computePasses');
    const [job] = sentOfType('computePasses');
    expect(job).toMatchObject({ observer: neuquen, window: { startMs: NOW, endMs: NOW + SEARCH_WINDOW_MS } });
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
    worker.emit({ type: 'passes', jobId: first.jobId, noradId: 25544, nightIndex: 0, passes: [samplePass(25544, NOW + 1000)] });
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
    worker.emit({ type: 'passes', jobId: first.jobId, noradId: 2, nightIndex: 0, passes: [samplePass(2, NOW + 2000)] });
    worker.emit({ type: 'jobDone', jobId: first.jobId, cancelled: true, elapsedMs: 3, hasDarkness: true });
    expect(store.getState().passes.passes).toEqual([]);
    expect(store.getState().passes.status).toBe('computing');

    worker.emit({ type: 'passes', jobId: second.jobId, noradId: 3, nightIndex: 0, passes: [samplePass(3, NOW + 5000)] });
    worker.emit({ type: 'passes', jobId: second.jobId, noradId: 4, nightIndex: 0, passes: [samplePass(4, NOW + 4000)] });
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
    const failing = vi.fn().mockRejectedValueOnce(new Error('HTTP 503')).mockImplementation(freshLoader());
    store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(null) });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    stop = startEffects({ ...noStorage, store, client, catalog: CATALOG, loadElements: failing, loadWeather: neverWeather, now: () => NOW, visibility: ALWAYS_VISIBLE });
    await vi.waitFor(() => expect(store.getState().elements).toEqual({ status: 'error', message: 'HTTP 503' }));
    store.getState().setObserver(neuquen);
    await vi.waitFor(() => expect(store.getState().elements.status).toBe('ready'));
    await waitForSent('loadElements');
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

/** A visibility source the test flips. */
function fakeVisibility(): VisibilitySource & { set: (hidden: boolean) => void } {
  let hidden = false;
  const listeners = new Set<() => void>();
  return {
    hidden: () => hidden,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (value) => {
      hidden = value;
      for (const l of listeners) l();
    },
  };
}

const nowState = (t: number): NowState => ({ t, sunAltDeg: -30, sky: 'dark', items: [], moon: MOON_FIXTURE });

describe('the "Now" tick (FR-VIS-5, US-4 AC2)', () => {
  let store: AppStore;
  let worker: ReturnType<typeof fakeWorker>;
  let client: WorkerClient;
  let visibility: ReturnType<typeof fakeVisibility>;
  let clock: number;
  let stop: () => void;
  const records = fixtureRecords();
  const sentNow = () => worker.sent.filter((m): m is WorkerRequest & { type: 'computeNow' } => m.type === 'computeNow');

  beforeEach(() => {
    vi.useFakeTimers();
    clock = NOW;
    store = createAppStore({ now: () => clock, prefs: createLocalPrefs(null) });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    visibility = fakeVisibility();
    stop = startEffects({
      ...noStorage,
      store,
      client,
      catalog: CATALOG,
      loadElements: () => Promise.resolve(loaded(records)),
      loadWeather: neverWeather,
      now: () => clock,
      visibility,
    });
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  /** Observer set → elements in the worker → the job started; returns once the first computeNow is out. */
  const ready = async (observer: Observer): Promise<void> => {
    store.getState().setObserver(observer);
    await vi.waitFor(() => expect(worker.sent.some((m) => m.type === 'loadElements')).toBe(true));
    const load = worker.sent.find((m) => m.type === 'loadElements');
    worker.emit({ type: 'elementsLoaded', requestId: load?.requestId ?? '', loaded: [], rejected: [] });
    await vi.waitFor(() => expect(sentNow().length).toBeGreaterThanOrEqual(1));
  };

  it('asks once as soon as the worker has the elements, then every 10 s, with the injected clock', async () => {
    await ready(neuquen);
    expect(sentNow()).toHaveLength(1);
    expect(sentNow()[0]).toMatchObject({ observer: neuquen, t: NOW });
    // `vi.waitFor` already advanced the fake clock a little (under one tick), so each further tick adds exactly one request.
    clock = NOW + 4_000;
    await vi.advanceTimersByTimeAsync(NOW_TICK_MS);
    expect(sentNow()).toHaveLength(2);
    expect(sentNow()[1]?.t).toBe(NOW + 4_000);
    await vi.advanceTimersByTimeAsync(3 * NOW_TICK_MS);
    expect(sentNow()).toHaveLength(5);
  });

  it('writes the reply to the now slice, keeping only the latest request’s answer', async () => {
    await ready(neuquen);
    await vi.advanceTimersByTimeAsync(NOW_TICK_MS);
    const [first, second] = sentNow();
    worker.emit({ type: 'nowState', requestId: second?.requestId ?? '', state: nowState(2) });
    await vi.waitFor(() => expect(store.getState().now.state?.t).toBe(2));
    expect(store.getState().now.observer).toBe(neuquen);
    worker.emit({ type: 'nowState', requestId: first?.requestId ?? '', state: nowState(1) }); // late answer to an older request
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().now.state?.t).toBe(2);
  });

  it('stops while the document is hidden and refreshes immediately when it becomes visible again', async () => {
    await ready(neuquen);
    visibility.set(true);
    await vi.advanceTimersByTimeAsync(5 * NOW_TICK_MS);
    expect(sentNow()).toHaveLength(1);
    clock = NOW + 60_000;
    visibility.set(false);
    expect(sentNow()).toHaveLength(2);
    expect(sentNow()[1]?.t).toBe(NOW + 60_000);
    await vi.advanceTimersByTimeAsync(NOW_TICK_MS);
    expect(sentNow()).toHaveLength(3);
  });

  it('a request error is recorded without dropping the last good state', async () => {
    await ready(neuquen);
    worker.emit({ type: 'nowState', requestId: sentNow()[0]?.requestId ?? '', state: nowState(1) });
    await vi.waitFor(() => expect(store.getState().now.state?.t).toBe(1));
    await vi.advanceTimersByTimeAsync(NOW_TICK_MS);
    worker.emit({ type: 'error', ref: { requestId: sentNow()[1]?.requestId ?? '' }, code: 'INTERNAL', message: 'boom' });
    await vi.waitFor(() => expect(store.getState().now.error).toBe('INTERNAL: boom'));
    expect(store.getState().now.state?.t).toBe(1);
  });

  it('an observer change drops the previous location’s in-flight answer and restarts the cadence for the new one', async () => {
    await ready(neuquen);
    const [first] = sentNow();
    store.getState().setObserver(paris);
    await vi.waitFor(() => expect(sentNow().length).toBe(2));
    expect(sentNow()[1]?.observer).toBe(paris);
    worker.emit({ type: 'nowState', requestId: first?.requestId ?? '', state: nowState(1) });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().now.state).toBeNull();
    worker.emit({ type: 'nowState', requestId: sentNow()[1]?.requestId ?? '', state: nowState(2) });
    await vi.waitFor(() => expect(store.getState().now).toMatchObject({ observer: paris, state: { t: 2 } }));
  });

  it('clearing the observer resets the slice and stops the tick; stop() stops it too', async () => {
    await ready(neuquen);
    worker.emit({ type: 'nowState', requestId: sentNow()[0]?.requestId ?? '', state: nowState(1) });
    await vi.waitFor(() => expect(store.getState().now.state).not.toBeNull());
    store.getState().setObserver(null);
    expect(store.getState().now).toEqual({ observer: null, state: null, error: null });
    await vi.advanceTimersByTimeAsync(3 * NOW_TICK_MS);
    expect(sentNow()).toHaveLength(1);

    await ready(neuquen);
    stop();
    const count = sentNow().length;
    await vi.advanceTimersByTimeAsync(3 * NOW_TICK_MS);
    expect(sentNow()).toHaveLength(count);
  });
});

describe('weather (FR-WX-1, FR-WX-5, FR-LOC-3)', () => {
  let store: AppStore;
  let worker: ReturnType<typeof fakeWorker>;
  let client: WorkerClient;
  let stop: () => void;
  const records = fixtureRecords();
  interface Deferred {
    resolve: (s: WeatherSnapshot) => void;
    reject: (e: Error) => void;
    lat: number;
    lon: number;
  }
  let requests: Deferred[];
  const loadWeather = (lat: number, lon: number): Promise<WeatherSnapshot> =>
    new Promise<WeatherSnapshot>((resolve, reject) => {
      requests.push({ resolve, reject, lat, lon });
    });

  beforeEach(() => {
    requests = [];
    store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(null) });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    stop = startEffects({ ...noStorage, store, client, catalog: CATALOG, loadElements: () => Promise.resolve(loaded(records)), loadWeather, now: () => NOW, visibility: ALWAYS_VISIBLE });
  });
  afterEach(() => {
    stop();
  });

  const sent = <T extends WorkerRequest['type']>(type: T) => worker.sent.filter((m): m is WorkerRequest & { type: T } => m.type === type);
  /** Observer set → job started (elements in the worker) → first computeNow out. */
  const started = async (observer: Observer): Promise<void> => {
    store.getState().setObserver(observer);
    await vi.waitFor(() => expect(sent('loadElements')).toHaveLength(1));
    worker.emit({ type: 'elementsLoaded', requestId: sent('loadElements')[0]?.requestId ?? '', loaded: [], rejected: [] });
    await vi.waitFor(() => expect(sent('computePasses')).toHaveLength(1));
    await vi.waitFor(() => expect(sent('computeNow')).toHaveLength(1));
  };

  it('is requested with the pass job, for the observer coordinates, without waiting for the elements', async () => {
    store.getState().setObserver(neuquen);
    // R24: the stored run is read first (a local lookup), so the request goes out on the next turn rather than in this one.
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({ lat: neuquen.lat, lon: neuquen.lon });
    expect(store.getState().weather).toMatchObject({ observer: neuquen, status: 'loading' });
  });

  it('a snapshot fills the zone from the forecast without recomputing, and every slice still points at the observer', async () => {
    await started(neuquen);
    const job = sent('computePasses')[0];
    if (job?.type !== 'computePasses') throw new Error('no job');
    worker.emit({ type: 'passes', jobId: job.jobId, noradId: 25544, nightIndex: 0, passes: [samplePass(25544, NOW + 1000)] });
    worker.emit({ type: 'nowState', requestId: sent('computeNow')[0]?.requestId ?? '', state: nowState(NOW) });
    await vi.waitFor(() => expect(store.getState().now.state).not.toBeNull());

    requests[0]?.resolve(snapshotFor(-38.9, -68));
    await vi.waitFor(() => expect(store.getState().weather.status).toBe('ready'));
    const { observer, passes, now, weather } = store.getState();
    expect(observer?.timeZone).toBe('America/Argentina/Salta');
    expect(observer).toMatchObject({ lat: neuquen.lat, lon: neuquen.lon, label: neuquen.label });
    expect(passes.observer).toBe(observer);
    expect(now.observer).toBe(observer);
    expect(weather.observer).toBe(observer);
    expect(weather.snapshot?.timeZone).toBe('America/Argentina/Salta');
    // Not a location change: one job, no cancel, passes kept.
    expect(sent('computePasses')).toHaveLength(1);
    expect(sent('cancel')).toHaveLength(0);
    expect(passes).toMatchObject({ jobId: job.jobId, status: 'computing' });
    expect(passes.passes).toHaveLength(1);
    expect(requests).toHaveLength(1);
  });

  it('a rejection leaves the passes intact and the zone unknown (US-7 AC4, FR-X-4)', async () => {
    await started(neuquen);
    const job = sent('computePasses')[0];
    if (job?.type !== 'computePasses') throw new Error('no job');
    worker.emit({ type: 'passes', jobId: job.jobId, noradId: 25544, nightIndex: 0, passes: [samplePass(25544, NOW + 1000)] });
    requests[0]?.reject(new Error('Open-Meteo forecast: HTTP 503'));
    await vi.waitFor(() => expect(store.getState().weather.status).toBe('error'));
    expect(store.getState().weather).toMatchObject({ observer: neuquen, error: 'Open-Meteo forecast: HTTP 503', snapshot: null });
    expect(store.getState().observer).toBe(neuquen);
    expect(store.getState().observer?.timeZone).toBeNull();
    expect(store.getState().passes.passes).toHaveLength(1);
    expect(store.getState().passes.status).toBe('computing');
  });

  it('does not overwrite a zone the observer already has (geocoded input)', async () => {
    const geocoded: Observer = { ...neuquen, source: 'geocode', label: 'Neuquén, Argentina', timeZone: 'America/Argentina/Buenos_Aires' };
    store.getState().setObserver(geocoded);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    requests[0]?.resolve(snapshotFor(-38.9, -68));
    await vi.waitFor(() => expect(store.getState().weather.status).toBe('ready'));
    expect(store.getState().observer).toBe(geocoded);
  });

  it('an observer change drops the previous location’s late snapshot; clearing the observer resets the slice', async () => {
    store.getState().setObserver(neuquen);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    store.getState().setObserver(paris);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    requests[0]?.resolve(snapshotFor(-38.9, -68));
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().weather).toMatchObject({ observer: paris, status: 'loading', snapshot: null });
    expect(store.getState().observer).toBe(paris);
    requests[1]?.resolve({ ...snapshotFor(48.9, 2.4), timeZone: 'Europe/Paris' });
    await vi.waitFor(() => expect(store.getState().weather.status).toBe('ready'));
    expect(store.getState().observer?.timeZone).toBe('Europe/Paris');
    store.getState().setObserver(null);
    expect(store.getState().weather).toEqual({ observer: null, status: 'idle', snapshot: null, error: null });
  });
});

describe('the elements re-check (R11, PLAN §7.1, FR-SAT-6)', () => {
  let store: AppStore;
  let worker: ReturnType<typeof fakeWorker>;
  let client: WorkerClient;
  let visibility: ReturnType<typeof fakeVisibility>;
  let clock: number;
  let stop: () => void;
  const records = fixtureRecords();
  const requested: string[] = [];
  const onRequest = ({ request }: { request: Request }): void => {
    requested.push(request.url);
  };
  const sent = <T extends WorkerRequest['type']>(type: T) => worker.sent.filter((m): m is WorkerRequest & { type: T } => m.type === type);

  const start = (loader: EffectDeps['loadElements']): void => {
    store = createAppStore({ now: () => clock, prefs: createLocalPrefs(null) });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    visibility = fakeVisibility();
    stop = startEffects({ ...noStorage, store, client, catalog: CATALOG, loadElements: loader, loadWeather: neverWeather, now: () => clock, visibility });
  };
  /** Observer set → elements in the worker → job started. */
  const started = async (observer: Observer): Promise<void> => {
    store.getState().setObserver(observer);
    await vi.waitFor(() => expect(sent('loadElements').length).toBeGreaterThanOrEqual(1));
    const load = sent('loadElements').at(-1);
    worker.emit({ type: 'elementsLoaded', requestId: load?.requestId ?? '', loaded: [], rejected: [] });
    await vi.waitFor(() => expect(sent('computePasses').length).toBeGreaterThanOrEqual(1));
  };
  /** Moves the injected clock and the fake timers together. */
  const elapse = async (ms: number): Promise<void> => {
    clock += ms;
    await vi.advanceTimersByTimeAsync(ms);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    clock = NOW;
    requested.length = 0;
    server.events.on('request:start', onRequest);
  });
  afterEach(() => {
    stop();
    server.events.removeListener('request:start', onRequest);
    vi.useRealTimers();
  });

  it('asks the loader every 15 min; the loader’s 2 h rule keeps the network quiet until it expires, then the worker and the passes are refreshed', async () => {
    const cache = idbCache(() => clock);
    const loader = vi.fn((catalog: readonly CatalogEntry[], options: { signal: AbortSignal }) => loadElements(catalog, { ...options, cache }));
    start(loader);
    await started(neuquen);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(requested).toHaveLength(2);
    const before = store.getState().elements;
    expect(before).toMatchObject({ status: 'ready', fetchedAt: NOW, stale: false, persistent: true });

    await elapse(ELEMENTS_RECHECK_MS);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(0);
    expect(requested).toHaveLength(2); // younger than 2 h: answered from IndexedDB
    expect(store.getState().elements).toBe(before); // nothing changed, nothing rewritten
    expect(sent('loadElements')).toHaveLength(1);
    expect(sent('computePasses')).toHaveLength(1);

    // Seven more checks (1 h 45 min later the cache is still under 2 h; at 2 h it is not).
    for (let i = 0; i < 7; i++) await elapse(ELEMENTS_RECHECK_MS);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(9));
    await vi.waitFor(() => expect(requested).toHaveLength(4));
    await vi.waitFor(() => expect(store.getState().elements).toMatchObject({ status: 'ready', fetchedAt: NOW + 8 * ELEMENTS_RECHECK_MS, stale: false }));
    // New elements: the worker is reloaded and the current observer's passes recomputed over a window from now.
    await vi.waitFor(() => expect(sent('loadElements')).toHaveLength(2));
    worker.emit({ type: 'elementsLoaded', requestId: sent('loadElements')[1]?.requestId ?? '', loaded: [], rejected: [] });
    await vi.waitFor(() => expect(sent('computePasses')).toHaveLength(2));
    expect(sent('computePasses')[1]).toMatchObject({ observer: neuquen, window: { startMs: NOW + 8 * ELEMENTS_RECHECK_MS } });
    expect(sent('cancel')).toEqual([{ type: 'cancel', jobId: sent('computePasses')[0]?.jobId }]);
  });

  it('a re-check that only flips `stale` updates the slice without recomputing', async () => {
    const loader = vi.fn<EffectDeps['loadElements']>().mockResolvedValueOnce(loaded(records)).mockResolvedValue(loaded(records, { stale: true }));
    start(loader);
    await started(neuquen);
    expect(store.getState().elements).toMatchObject({ stale: false });
    await elapse(ELEMENTS_RECHECK_MS);
    await vi.waitFor(() => expect(store.getState().elements).toMatchObject({ status: 'ready', stale: true, fetchedAt: NOW }));
    expect(sent('loadElements')).toHaveLength(1);
    expect(sent('computePasses')).toHaveLength(1);
    expect(sent('cancel')).toHaveLength(0);
  });

  it('does not check while hidden, and checks at once when shown again after longer than the cadence', async () => {
    const loader = vi.fn<EffectDeps['loadElements']>().mockResolvedValue(loaded(records));
    start(loader);
    await vi.waitFor(() => expect(store.getState().elements.status).toBe('ready'));
    visibility.set(true);
    await elapse(4 * ELEMENTS_RECHECK_MS);
    expect(loader).toHaveBeenCalledTimes(1);
    visibility.set(false);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    await elapse(ELEMENTS_RECHECK_MS);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(3));
  });

  it('a failed re-check keeps the loaded set on screen', async () => {
    const loader = vi.fn<EffectDeps['loadElements']>().mockResolvedValueOnce(loaded(records)).mockRejectedValue(new Error('HTTP 503'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    start(loader);
    await started(neuquen);
    await elapse(ELEMENTS_RECHECK_MS);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().elements).toMatchObject({ status: 'ready', stale: false });
    expect(store.getState().passes.status).toBe('computing');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/re-check failed.*HTTP 503/));
    warn.mockRestore();
  });

  it('a re-check after a failed first load retries it', async () => {
    const loader = vi.fn<EffectDeps['loadElements']>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(loaded(records));
    start(loader);
    await vi.waitFor(() => expect(store.getState().elements).toEqual({ status: 'error', message: 'offline' }));
    await elapse(ELEMENTS_RECHECK_MS);
    await vi.waitFor(() => expect(store.getState().elements.status).toBe('ready'));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('stop() ends the re-checks', async () => {
    const loader = vi.fn<EffectDeps['loadElements']>().mockResolvedValue(loaded(records));
    start(loader);
    await vi.waitFor(() => expect(store.getState().elements.status).toBe('ready'));
    stop();
    await elapse(3 * ELEMENTS_RECHECK_MS);
    expect(loader).toHaveBeenCalledTimes(1);
    stop = () => undefined;
  });
});

/**
 * R24 (FR-OFF-2, FR-OFF-5, PLAN §7.5, D-78): the start-up order is prefs →
 * stored run → render → network, every uncancelled job is written back, and a
 * stored list stays on screen until the job replacing it has something of its
 * own to show.
 */
describe('stored passes (R24, FR-OFF-2, FR-OFF-5)', () => {
  const STORED_AT = NOW - 2 * 3_600_000;
  const storedPass = samplePass(25544, NOW + 5 * 60_000);
  const storedRun: PassRun = {
    cellKey: '-38.93,-67.99',
    observer: neuquen,
    window: { startMs: STORED_AT, endMs: STORED_AT + SEARCH_WINDOW_MS },
    computedAt: STORED_AT,
    newestElementsEpochMs: ref.t,
    hasDarkness: true,
    passes: [storedPass],
  };
  /** The newest epoch in the fixture set: what a finished run records as its provenance (FR-SAT-4, D-108). */
  const newestEpoch = Math.max(...fixtureRecords().map((record) => record.epochMs));

  let store: AppStore;
  let worker: ReturnType<typeof fakeWorker>;
  let client: WorkerClient;
  let stop: () => void;
  let saved: FinishedRun[];
  let requested: string[];
  /** How many requests had gone out when the stored passes first reached the screen; zero is the point of the test. */
  let requestedWhenStoredRendered: number | null;
  const onRequest = ({ request }: { request: Request }): void => {
    requested.push(request.url);
  };

  /** `startApp`'s own order: the saved observer is in the store before the effects are wired. */
  const start = (stored: PassRun | null, savedObserver: Observer | null = neuquen): void => {
    store = createAppStore({ now: () => NOW, prefs: { read: () => (savedObserver ? { observer: savedObserver } : {}), write: () => undefined } });
    store.subscribe((state) => {
      if (state.passes.storedAt !== null && requestedWhenStoredRendered === null) requestedWhenStoredRendered = requested.length;
    });
    worker = fakeWorker();
    client = createWorkerClient(worker);
    store.getState().restoreSavedObserver();
    stop = startEffects({
      store,
      client,
      catalog: CATALOG,
      loadElements: freshLoader(),
      loadWeather: neverWeather,
      loadStoredRun: () => Promise.resolve(stored),
      saveRun: (run) => {
        saved.push(run);
        return Promise.resolve(null);
      },
      now: () => NOW,
      visibility: ALWAYS_VISIBLE,
    });
  };

  const sent = <T extends WorkerRequest['type']>(type: T) => worker.sent.filter((m): m is WorkerRequest & { type: T } => m.type === type);
  /** Elements accepted by the worker → the job for the restored observer. */
  const jobStarted = async (): Promise<string> => {
    await vi.waitFor(() => expect(sent('loadElements')).toHaveLength(1));
    worker.emit({ type: 'elementsLoaded', requestId: sent('loadElements')[0]?.requestId ?? '', loaded: [], rejected: [] });
    await vi.waitFor(() => expect(sent('computePasses')).toHaveLength(1));
    return sent('computePasses')[0]?.jobId ?? '';
  };

  beforeEach(() => {
    saved = [];
    requested = [];
    requestedWhenStoredRendered = null;
    server.events.on('request:start', onRequest);
  });
  afterEach(() => {
    stop();
    server.events.removeListener('request:start', onRequest);
  });

  it('renders the stored run for the saved location before any request goes out', async () => {
    start(storedRun);
    await vi.waitFor(() => expect(store.getState().passes.passes).toHaveLength(1));
    expect(store.getState().passes).toMatchObject({ status: 'done', storedAt: STORED_AT, observer: neuquen, window: storedRun.window, jobId: null });
    expect(store.getState().passes.passes).toEqual([storedPass]);
    expect(requestedWhenStoredRendered).toBe(0); // prefs → stored run → render, and only then the network

    // And the network follows on its own: the elements are fetched and the recompute starts.
    await vi.waitFor(() => expect(requested).toHaveLength(2));
    expect([...new Set(requested.map((u) => new URL(u).host))]).toEqual(['celestrak.org']);
    await jobStarted();
  });

  it('keeps the stored passes on screen while the recompute runs, until the first object of the new job arrives', async () => {
    start(storedRun);
    await vi.waitFor(() => expect(store.getState().passes.storedAt).toBe(STORED_AT));
    const jobId = await jobStarted();
    // The list does not blank while the worker works: the stored passes stand in, still marked as stored.
    expect(store.getState().passes).toMatchObject({ status: 'computing', jobId, storedAt: STORED_AT });
    expect(store.getState().passes.passes).toEqual([storedPass]);

    const fresh = samplePass(25544, NOW + 90 * 60_000);
    worker.emit({ type: 'passes', jobId, noradId: 25544, nightIndex: 0, passes: [fresh] });
    expect(store.getState().passes.passes).toEqual([fresh]); // replaced, not appended to
    expect(store.getState().passes.storedAt).toBeNull();
  });

  it('brings hasDarkness back with the stored run, so an empty one is not read as "nothing visible" (D-108)', async () => {
    start({ ...storedRun, passes: [], hasDarkness: false });
    await vi.waitFor(() => expect(store.getState().passes.storedAt).toBe(STORED_AT));
    // Without the stored flag this would be `null` and the list would word it as nothing visible,
    // when the truth is that the window held no darkness at all (spec §5.6).
    expect(store.getState().passes).toMatchObject({ status: 'done', hasDarkness: false });
  });

  it('an empty batch does not count as the new job having something to show (D-108)', async () => {
    start(storedRun);
    await vi.waitFor(() => expect(store.getState().passes.storedAt).toBe(STORED_AT));
    const jobId = await jobStarted();

    // The worker reports every (night, object) pair, empty ones included. Night 0 of an object with
    // no passes must not blank the list a moment into a recompute that runs for seconds.
    worker.emit({ type: 'passes', jobId, noradId: 25544, nightIndex: 0, passes: [] });
    worker.emit({ type: 'passes', jobId, noradId: 25544, nightIndex: 1, passes: [] });
    expect(store.getState().passes.passes).toEqual([storedPass]);
    expect(store.getState().passes.storedAt).toBe(STORED_AT);

    // The first batch that carries a pass is what takes over.
    const fresh = samplePass(25544, NOW + 90 * 60_000);
    worker.emit({ type: 'passes', jobId, noradId: 25544, nightIndex: 2, passes: [fresh] });
    expect(store.getState().passes.passes).toEqual([fresh]);
    expect(store.getState().passes.storedAt).toBeNull();
  });

  it('a recompute that finds nothing clears the stored passes at jobDone', async () => {
    start(storedRun);
    await vi.waitFor(() => expect(store.getState().passes.storedAt).toBe(STORED_AT));
    const jobId = await jobStarted();
    worker.emit({ type: 'jobDone', jobId, cancelled: false, elapsedMs: 10, hasDarkness: true });
    expect(store.getState().passes).toMatchObject({ status: 'done', storedAt: null });
    expect(store.getState().passes.passes).toEqual([]);
  });

  it('stores every uncancelled job as it finishes, with the window and the newest elements epoch (FR-OFF-5)', async () => {
    start(null);
    const jobId = await jobStarted();
    const found = samplePass(25544, NOW + 1000);
    worker.emit({ type: 'passes', jobId, noradId: 25544, nightIndex: 0, passes: [found] });
    expect(saved).toHaveLength(0); // nothing is written mid-stream
    worker.emit({ type: 'jobDone', jobId, cancelled: false, elapsedMs: 42, hasDarkness: true });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ observer: neuquen, window: { startMs: NOW, endMs: NOW + SEARCH_WINDOW_MS }, newestElementsEpochMs: newestEpoch });
    expect(newestEpoch).toBeGreaterThan(Math.min(...fixtureRecords().map((record) => record.epochMs))); // the two differ, so the assertion above means something
    expect(saved[0]?.passes).toEqual([found]);
  });

  it('stores an empty run when the job really found nothing, and keeps hasDarkness (D-108)', async () => {
    start(null);
    const jobId = await jobStarted();
    worker.emit({ type: 'jobDone', jobId, cancelled: false, elapsedMs: 12, hasDarkness: false });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ hasDarkness: false });
    expect(saved[0]?.passes).toEqual([]);
  });

  it('does not overwrite a good stored run when every object was skipped (D-108)', async () => {
    start(storedRun);
    await vi.waitFor(() => expect(store.getState().passes.storedAt).toBe(STORED_AT));
    const jobId = await jobStarted();
    worker.emit({ type: 'error', ref: { jobId }, code: 'PROPAGATION_FAILED', message: 'object 25544: boom' });
    worker.emit({ type: 'jobDone', jobId, cancelled: false, elapsedMs: 12, hasDarkness: true });
    // Nothing computed is not an answer: the run that is the only offline list survives.
    expect(saved).toHaveLength(0);
  });

  it('does not store a cancelled job', async () => {
    start(null);
    const jobId = await jobStarted();
    worker.emit({ type: 'jobDone', jobId, cancelled: true, elapsedMs: 5, hasDarkness: true });
    expect(saved).toEqual([]);
  });

  it('with no saved location nothing is read back and the elements are still prefetched', async () => {
    start(storedRun, null);
    await vi.waitFor(() => expect(store.getState().elements.status).toBe('ready'));
    expect(store.getState().passes).toMatchObject({ status: 'idle', storedAt: null });
    expect(requestedWhenStoredRendered).toBeNull();
  });
});
