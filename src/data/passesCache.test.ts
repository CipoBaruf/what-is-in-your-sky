/**
 * R24 (FR-OFF-2, FR-OFF-5, PLAN §7.5, D-78, D-102): the `passRuns` store over
 * `fake-indexeddb` — a finished run round-trips whole, two observers a few
 * hundred metres apart share one cell, the third run evicts the oldest, a run
 * whose window has passed is still handed back, a body that no longer matches
 * the schema reads as absent, and a store that throws never fails a save.
 */
import { describe, expect, it, vi } from 'vitest';
import { DAY_MS, goldenPassFixture, goldenWindowStart, loadReferenceValues } from '../../tests/support/catalogFixtures';
import { uniqueDbName } from '../../tests/support/elementsCache';
import type { Observer, Pass, TimeWindow } from '../model';
import { openWiysDb, PASS_RUNS_STORE_NAME } from './db';
import { createPassesCache, idbPassRunStore, MAX_STORED_RUNS, memoryPassRunStore, passCellKey, type FinishedRun, type PassRunStore } from './passesCache';

const ref = loadReferenceValues();
const T0 = goldenWindowStart(ref);
const WINDOW_MS = 3 * DAY_MS;
const golden = goldenPassFixture(ref);

const observerAt = (lat: number, lon: number, label = `${String(lat)}, ${String(lon)}`): Observer => ({ lat, lon, altM: 0, label, source: 'coords', timeZone: null });
const neuquen = observerAt(ref.observer.lat, ref.observer.lon, '−38.93, −67.99');

const window = (startMs: number): TimeWindow => ({ startMs, endMs: startMs + WINDOW_MS });
const finished = (observer: Observer, startMs: number, passes: Pass[] = [golden]): FinishedRun => ({ observer, window: window(startMs), oldestElementsEpochMs: ref.t, passes });

const idbCache = (now: () => number, dbName = uniqueDbName()) => createPassesCache({ store: idbPassRunStore(dbName), now, warn: () => undefined });

describe('passCellKey', () => {
  it('rounds to 0.01°, keeps the sign and never prints a negative zero', () => {
    expect(passCellKey(-38.9312, -67.9885)).toBe('-38.93,-67.99');
    expect(passCellKey(-38.9288, -67.9942)).toBe('-38.93,-67.99'); // ~260 m away: the same cell
    expect(passCellKey(-38.94, -67.99)).toBe('-38.94,-67.99'); // one cell south: a different key
    expect(passCellKey(0, 0)).toBe('0.00,0.00');
    expect(passCellKey(-0.001, -0.002)).toBe('0.00,0.00');
    expect(passCellKey(51.5, -0.13)).toBe('51.50,-0.13');
  });
});

describe('createPassesCache', () => {
  it('stores a finished run whole and reads it back for any observer in the cell', async () => {
    const cache = idbCache(() => T0);
    const saved = await cache.save(finished(neuquen, T0));
    expect(saved).toMatchObject({ cellKey: '-38.93,-67.99', computedAt: T0, oldestElementsEpochMs: ref.t, window: window(T0) });

    const read = await cache.loadForObserver(observerAt(ref.observer.lat + 0.002, ref.observer.lon - 0.003));
    expect(read).toEqual(saved);
    expect(read?.passes).toEqual([golden]); // the track and every field survive the round trip
    expect(read?.observer.label).toBe('−38.93, −67.99'); // the run carries the observer it was computed for, not the one asking
  });

  it('answers null for a cell with nothing stored', async () => {
    const cache = idbCache(() => T0);
    await cache.save(finished(neuquen, T0));
    expect(await cache.loadForObserver(observerAt(48.86, 2.35))).toBeNull();
  });

  it('keeps the two most recent runs and prunes the rest on write (D-78)', async () => {
    let now = T0;
    const dbName = uniqueDbName();
    const cache = idbCache(() => now, dbName);
    await cache.save(finished(observerAt(48.86, 2.35), T0));
    now = T0 + 60_000;
    await cache.save(finished(observerAt(51.5, -0.13), now));
    now = T0 + 120_000;
    await cache.save(finished(neuquen, now));

    const store = idbPassRunStore(dbName);
    const kept = (await store.all()).map((run) => run.cellKey).sort();
    expect(kept).toHaveLength(MAX_STORED_RUNS);
    expect(kept).toEqual(['-38.93,-67.99', '51.50,-0.13']); // the oldest, Paris, is gone
    expect(await cache.loadForObserver(observerAt(48.86, 2.35))).toBeNull();
    expect(await cache.loadForObserver(neuquen)).not.toBeNull();
  });

  it('rewriting the same cell keeps one entry and the newest content', async () => {
    let now = T0;
    const dbName = uniqueDbName();
    const cache = idbCache(() => now, dbName);
    await cache.save(finished(neuquen, T0));
    now = T0 + DAY_MS;
    await cache.save(finished(neuquen, now, []));
    const runs = await idbPassRunStore(dbName).all();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ computedAt: T0 + DAY_MS, passes: [] });
  });

  it('hands back a run whose window has passed rather than dropping it (D-102)', async () => {
    let now = T0;
    const cache = idbCache(() => now);
    await cache.save(finished(neuquen, T0));
    now = T0 + WINDOW_MS + DAY_MS; // a day past the end of the stored window
    const read = await cache.loadForObserver(neuquen);
    expect(read?.computedAt).toBe(T0);
    expect(read?.window.endMs).toBeLessThan(now); // expired, and still the app's only answer offline
    expect(read?.passes).toEqual([golden]);
  });

  it('reads a body that no longer matches the schema as absent', async () => {
    const dbName = uniqueDbName();
    const cache = idbCache(() => T0, dbName);
    await cache.save(finished(neuquen, T0));
    const db = await openWiysDb(dbName);
    await db.put(PASS_RUNS_STORE_NAME, { cellKey: '-38.93,-67.99', observer: neuquen, computedAt: T0, passes: 'not an array' } as never);
    expect(await cache.loadForObserver(neuquen)).toBeNull();
  });

  it('drops a run whose passes are not all passes, rather than half of one', async () => {
    const dbName = uniqueDbName();
    const cache = idbCache(() => T0, dbName);
    await cache.save(finished(neuquen, T0, [golden, { ...golden, id: 'broken', peak: { t: 1 } } as Pass]));
    expect(await cache.loadForObserver(neuquen)).toBeNull();
  });

  it('never fails a save or a load when the store throws, and warns once each', async () => {
    const warn = vi.fn();
    const broken: PassRunStore = {
      get: () => Promise.reject(new Error('quota')),
      put: () => Promise.reject(new Error('quota')),
      all: () => Promise.resolve([]),
      delete: () => Promise.resolve(),
    };
    const cache = createPassesCache({ store: broken, now: () => T0, warn });
    expect(await cache.save(finished(neuquen, T0))).toBeNull();
    expect(await cache.loadForObserver(neuquen)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.map(([m]) => String(m))).toEqual([expect.stringContaining('store the finished run'), expect.stringContaining('read the stored run')]);
  });

  it('stores nothing at all without IndexedDB', async () => {
    const cache = createPassesCache({ store: null, now: () => T0 });
    expect(await cache.save(finished(neuquen, T0))).toBeNull();
    expect(await cache.loadForObserver(neuquen)).toBeNull();
  });

  it('works the same over the in-memory store', async () => {
    const cache = createPassesCache({ store: memoryPassRunStore(), now: () => T0 });
    await cache.save(finished(neuquen, T0));
    expect((await cache.loadForObserver(neuquen))?.passes).toEqual([golden]);
  });
});
