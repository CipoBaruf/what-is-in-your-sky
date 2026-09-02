/**
 * PLAN §9.1 "Worker handler tests": protocol behaviour driven through
 * `createHandler` directly, in Node. Includes the physics check against the
 * R1 reference values (sdd-implement rule): the golden ISS pass must come out
 * of the worker path exactly as it did from the main-thread path in R3.
 */
import { describe, expect, it, vi } from 'vitest';
import { DAY_MS, fixtureRecords, goldenWindowStart, loadReferenceValues } from '../../tests/support/catalogFixtures';
import { ISS_STD_MAG_SEED } from '../../tests/support/heavensAbove';
import { CATALOG } from '../data/catalog';
import type { Observer, SatelliteRecord } from '../model';
import { DEFAULT_THRESHOLDS, nowState, type SatRec } from '../physics';
import { computeOrder, createHandler, createHandlerState, yieldViaMessageChannel, type Handler, type HandlerState } from './handlers';
import type { WorkerRequest, WorkerResponse } from './protocol';

const ref = loadReferenceValues();
const observer: Observer = { ...ref.observer, label: 'Neuquen (spike)', source: 'coords', timeZone: null };
const GOLDEN_WINDOW = { startMs: goldenWindowStart(ref), endMs: goldenWindowStart(ref) + DAY_MS };
const ISS = 25544;

interface Harness {
  state: HandlerState;
  handler: Handler;
  responses: WorkerResponse[];
  send: (request: WorkerRequest) => Promise<void>;
  ofType: <T extends WorkerResponse['type']>(type: T) => (WorkerResponse & { type: T })[];
}

function harness(options: Parameters<typeof createHandler>[1] = {}): Harness {
  const state = createHandlerState();
  const responses: WorkerResponse[] = [];
  const handler = createHandler(state, options);
  return {
    state,
    handler,
    responses,
    send: (request) => handler(request, (r) => responses.push(r)),
    ofType: (type) => responses.filter((r): r is WorkerResponse & { type: typeof type } => r.type === type),
  };
}

async function loaded(records: SatelliteRecord[] = fixtureRecords(), options: Parameters<typeof createHandler>[1] = {}): Promise<Harness> {
  const h = harness(options);
  await h.send({ type: 'loadElements', requestId: 'req-1', records });
  return h;
}

describe('yieldViaMessageChannel', () => {
  it('resolves after queued macrotasks have run', async () => {
    const order: string[] = [];
    setTimeout(() => order.push('timeout'), 0);
    await yieldViaMessageChannel();
    order.push('yield');
    await new Promise((r) => setTimeout(r, 1));
    expect(order[0]).toBeDefined();
    expect(order).toContain('timeout');
    expect(order).toContain('yield');
  });
});

describe('loadElements', () => {
  it('replaces the map and reports every catalog object loaded', async () => {
    const records = fixtureRecords();
    const h = await loaded(records);
    const [reply] = h.ofType('elementsLoaded');
    expect(reply?.requestId).toBe('req-1');
    expect(reply?.loaded).toEqual(records.map((r) => r.catalog.noradId));
    expect(reply?.rejected).toEqual([]);
    expect(h.state.objects.size).toBe(records.length);
  });

  it('reports a corrupt OMM in `rejected` (BAD_OMM) and loads the rest', async () => {
    const records = fixtureRecords();
    const first = records[0];
    if (!first) throw new Error('no records');
    const broken: SatelliteRecord = { ...first, omm: { ...first.omm, EPHEMERIS_TYPE: 3 } };
    const h = await loaded([broken, ...records.slice(1)]);
    const [reply] = h.ofType('elementsLoaded');
    expect(reply?.rejected).toEqual([{ noradId: first.catalog.noradId, reason: expect.stringContaining('EPHEMERIS_TYPE 3') as string }]);
    expect(reply?.loaded).toHaveLength(records.length - 1);
    expect(reply?.loaded).not.toContain(first.catalog.noradId);
    expect(h.ofType('error')).toEqual([]);
  });

  it('a second load replaces the first', async () => {
    const records = fixtureRecords();
    const h = await loaded(records);
    await h.send({ type: 'loadElements', requestId: 'req-2', records: records.slice(0, 3) });
    expect(h.state.objects.size).toBe(3);
  });
});

describe('computeOrder', () => {
  it('puts featured objects first and keeps the rest in load order', async () => {
    const records = fixtureRecords();
    const h = await loaded([...records].reverse());
    const order = computeOrder(h.state.objects.values()).map((o) => o.catalog.noradId);
    expect(order[0]).toBe(ISS);
    expect(order.slice(1)).toEqual(
      records
        .filter((r) => !r.catalog.featured)
        .map((r) => r.catalog.noradId)
        .reverse(),
    );
  });
});

describe('computePasses', () => {
  it('streams one `passes` message per object, the featured object first, then progress and jobDone', async () => {
    const h = await loaded();
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    const passes = h.ofType('passes');
    expect(passes).toHaveLength(h.state.objects.size);
    expect(passes[0]?.noradId).toBe(ISS);
    expect(new Set(passes.map((p) => p.noradId)).size).toBe(passes.length);
    for (const p of passes) expect(p.jobId).toBe('job-1');

    const progress = h.ofType('progress');
    expect(progress.map((p) => p.done)).toEqual(passes.map((_, i) => i + 1));
    expect(progress.every((p) => p.total === passes.length)).toBe(true);

    const [done] = h.ofType('jobDone');
    expect(done).toMatchObject({ jobId: 'job-1', cancelled: false, hasDarkness: true });
    expect(done?.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(h.responses.at(-1)?.type).toBe('jobDone');
    // Each object's passes message precedes its progress message.
    const types = h.responses.map((r) => r.type).filter((t) => t === 'passes' || t === 'progress');
    expect(types).toEqual(passes.flatMap(() => ['passes', 'progress']));
    expect(h.ofType('error')).toEqual([]);
  });

  it('reproduces the first golden ISS pass from the R1 reference values (physics check)', async () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
    const h = await loaded();
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    const iss = h.ofType('passes').find((p) => p.noradId === ISS)?.passes ?? [];
    expect(iss).toHaveLength(1);
    const pass = iss[0];
    if (!pass) return;
    expect(pass.name).toBe('ISS (Zarya)');
    expect(pass.start.t).toBe(golden.start.t);
    expect(pass.start.azDeg).toBeCloseTo(golden.start.azDeg, 6);
    expect(pass.peak.t).toBe(golden.peak.t);
    expect(pass.peak.elDeg).toBeCloseTo(golden.peak.elDeg, 6);
    expect(pass.end.t).toBe(golden.end.t);
    expect(pass.twilight).toBe(golden.twilight);
    const issStdMag = CATALOG.find((e) => e.noradId === ISS)?.stdMag;
    expect(issStdMag).toBeDefined();
    expect(pass.peakMagnitude).toBeCloseTo(golden.peakMagnitude + ((issStdMag ?? 0) - ISS_STD_MAG_SEED), 6);

    const all = h.ofType('passes').flatMap((p) => p.passes);
    expect(all.length).toBeGreaterThan(1);
    for (const p of all) {
      expect(p.start.t).toBeGreaterThanOrEqual(GOLDEN_WINDOW.startMs);
      expect(p.end.t).toBeLessThanOrEqual(GOLDEN_WINDOW.endMs);
      expect(p.peakMagnitude).toBeLessThanOrEqual(DEFAULT_THRESHOLDS.magLimit);
      expect(p.peak.elDeg).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.minElevationDeg);
    }
  });

  it('a `cancel` received mid-job yields jobDone { cancelled: true } with no further passes', async () => {
    let h: Harness | null = null;
    let yields = 0;
    // The yield between objects is where a queued `cancel` message gets processed (D-6).
    const yieldToEventLoop = async (): Promise<void> => {
      yields++;
      if (yields === 2) await h?.send({ type: 'cancel', jobId: 'job-1' });
    };
    h = await loaded(fixtureRecords(), { yieldToEventLoop });
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    expect(h.ofType('passes')).toHaveLength(2);
    expect(h.ofType('passes')[0]?.noradId).toBe(ISS);
    const [done] = h.ofType('jobDone');
    expect(done).toMatchObject({ jobId: 'job-1', cancelled: true });
    expect(h.responses.at(-1)?.type).toBe('jobDone');
    expect(h.state.cancelled.size).toBe(0); // cleared once the job ended
  });

  it('a `cancel` during the last yield still reports cancelled', async () => {
    let h: Harness | null = null;
    const records = fixtureRecords().slice(0, 2);
    let yields = 0;
    const yieldToEventLoop = async (): Promise<void> => {
      if (++yields === records.length) await h?.send({ type: 'cancel', jobId: 'job-1' });
    };
    h = await loaded(records, { yieldToEventLoop });
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    expect(h.ofType('passes')).toHaveLength(2);
    expect(h.ofType('jobDone')[0]?.cancelled).toBe(true);
  });

  it('a `cancel` for an unknown job is ignored', async () => {
    const h = await loaded(fixtureRecords().slice(0, 2));
    await h.send({ type: 'cancel', jobId: 'job-none' });
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    expect(h.ofType('jobDone')[0]?.cancelled).toBe(false);
  });

  it('reports hasDarkness: false for a high-latitude summer window and finds no passes', async () => {
    const h = await loaded(fixtureRecords().filter((r) => r.catalog.noradId === ISS));
    const tromso: Observer = { lat: 69.65, lon: 18.96, altM: 0, label: 'Tromsø', source: 'coords', timeZone: null };
    const start = Date.UTC(2026, 5, 21);
    await h.send({ type: 'computePasses', jobId: 'job-1', observer: tromso, window: { startMs: start, endMs: start + DAY_MS }, thresholds: DEFAULT_THRESHOLDS });
    expect(h.ofType('jobDone')[0]).toMatchObject({ cancelled: false, hasDarkness: false });
    expect(h.ofType('passes').flatMap((p) => p.passes)).toEqual([]);
  });

  it('answers NO_ELEMENTS, and no jobDone, when nothing is loaded', async () => {
    const h = harness();
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    expect(h.responses).toEqual([{ type: 'error', ref: { jobId: 'job-1' }, code: 'NO_ELEMENTS', message: expect.any(String) as string }]);
  });

  it('skips an object whose search throws (PROPAGATION_FAILED) and finishes the rest', async () => {
    const h = await loaded(fixtureRecords().slice(0, 4));
    const victim = [...h.state.objects.values()][1];
    if (!victim) throw new Error('no victim');
    victim.satrec = new Proxy({} as SatRec, {
      get() {
        throw new Error('boom');
      },
    });
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    const errors = h.ofType('error');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ ref: { jobId: 'job-1' }, code: 'PROPAGATION_FAILED' });
    expect(errors[0]?.message).toContain(victim.catalog.name);
    expect(h.ofType('passes').map((p) => p.noradId)).not.toContain(victim.catalog.noradId);
    expect(h.ofType('passes')).toHaveLength(3);
    expect(h.ofType('progress').at(-1)).toMatchObject({ done: 4, total: 4 });
    expect(h.ofType('jobDone')[0]?.cancelled).toBe(false);
  });

  it('an unexpected failure aborts the job with INTERNAL and no jobDone', async () => {
    const clock = vi.fn(() => {
      throw new Error('clock broke');
    });
    const h = await loaded(fixtureRecords().slice(0, 2), { clock });
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    expect(h.responses.slice(1)).toEqual([{ type: 'error', ref: { jobId: 'job-1' }, code: 'INTERNAL', message: 'clock broke' }]);
  });
});

describe('computeNow', () => {
  it('returns a NowState matching physics/now.ts on the R1 fixture, every object, the ISS first', async () => {
    const golden = ref.firstGoldenPass;
    if (!golden) throw new Error('reference-values.json has no firstGoldenPass');
    const t = golden.start.t + 10_000; // inside the golden pass, on its 1 s grid
    const h = await loaded();
    await h.send({ type: 'computeNow', requestId: 'req-9', observer, t, thresholds: DEFAULT_THRESHOLDS });
    const [reply] = h.ofType('nowState');
    expect(reply?.requestId).toBe('req-9');
    const expected = nowState(
      computeOrder(h.state.objects.values()).map((o) => ({ satrec: o.satrec, noradId: o.catalog.noradId, name: o.catalog.name, stdMag: o.catalog.stdMag })),
      observer,
      t,
      DEFAULT_THRESHOLDS,
    );
    expect(reply?.state).toEqual(expected);
    expect(reply?.state.items).toHaveLength(h.state.objects.size);
    expect(reply?.state.items[0]?.noradId).toBe(ISS);
    expect(reply?.state.sky).toBe('bright-twilight');
    const iss = reply?.state.items.find((i) => i.noradId === ISS);
    expect(iss).toMatchObject({ name: 'ISS (Zarya)', visible: true, visibleUntil: golden.end.t, endReason: 'horizon' });
    expect(h.ofType('error')).toEqual([]);
  });

  it('answers NO_ELEMENTS when nothing is loaded', async () => {
    const h = harness();
    await h.send({ type: 'computeNow', requestId: 'req-9', observer, t: ref.t, thresholds: DEFAULT_THRESHOLDS });
    expect(h.responses).toEqual([{ type: 'error', ref: { requestId: 'req-9' }, code: 'NO_ELEMENTS', message: expect.any(String) as string }]);
  });

  it('is answered between the objects of a running computePasses job (D-6 yield)', async () => {
    let h: Harness | null = null;
    let yields = 0;
    const yieldToEventLoop = async (): Promise<void> => {
      if (++yields === 1) await h?.send({ type: 'computeNow', requestId: 'req-now', observer, t: ref.t, thresholds: DEFAULT_THRESHOLDS });
    };
    h = await loaded(fixtureRecords().slice(0, 3), { yieldToEventLoop });
    await h.send({ type: 'computePasses', jobId: 'job-1', observer, window: GOLDEN_WINDOW, thresholds: DEFAULT_THRESHOLDS });
    const types = h.responses.map((r) => r.type);
    expect(types.indexOf('nowState')).toBeGreaterThan(types.indexOf('passes'));
    expect(types.indexOf('nowState')).toBeLessThan(types.lastIndexOf('passes'));
    expect(h.ofType('jobDone')[0]?.cancelled).toBe(false);
  });
});

describe('other requests', () => {

  it('an unknown request type answers INTERNAL', async () => {
    const h = harness();
    await h.send({ type: 'bogus' } as unknown as WorkerRequest);
    expect(h.ofType('error')[0]).toMatchObject({ ref: {}, code: 'INTERNAL' });
  });
});
