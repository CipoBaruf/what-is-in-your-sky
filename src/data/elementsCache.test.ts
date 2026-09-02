/**
 * R11 (FR-SAT-6, FR-X-4, PLAN §7.1, D-9, D-10): the 2 h rule against the
 * stored timestamp, one fetch per group for concurrent loads, the stale
 * fallback on network failure, rejection without a cache, the memory fallback
 * when IndexedDB throws, and a real round trip through `fake-indexeddb`.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CELESTRAK_GP, loadOmmFixture, server } from '../../tests/setup/msw';
import { idbCache, memoryCache, serialLocks, uniqueDbName } from '../../tests/support/elementsCache';
import { fetchGroup } from './celestrak';
import { createElementsCache, ELEMENTS_LOCK_NAME, ELEMENTS_TTL_MS, idbGroupStore, isFresh, memoryGroupStore, type GroupStore, type LockManagerLike } from './elementsCache';

const T0 = Date.parse('2026-09-02T12:00:00Z');
const HOUR = 3_600_000;

/** Counts the CelesTrak requests MSW sees while `run` runs. */
async function countingRequests<T>(run: () => Promise<T>): Promise<{ result: T; urls: string[] }> {
  const urls: string[] = [];
  const onRequest = ({ request }: { request: Request }): void => {
    urls.push(request.url);
  };
  server.events.on('request:start', onRequest);
  try {
    return { result: await run(), urls };
  } finally {
    server.events.removeListener('request:start', onRequest);
  }
}

const failCelestrak = (): void => {
  server.use(http.get(CELESTRAK_GP, () => HttpResponse.text('down', { status: 503 })));
};

describe('isFresh', () => {
  it('is fresh under 2 h, not at 2 h, and never for a timestamp in the future', () => {
    expect(isFresh(T0, T0 + ELEMENTS_TTL_MS - 1)).toBe(true);
    expect(isFresh(T0, T0 + ELEMENTS_TTL_MS)).toBe(false);
    expect(isFresh(T0, T0)).toBe(true);
    expect(isFresh(T0 + 1, T0)).toBe(false);
  });
});

describe('createElementsCache', () => {
  it('fetches both groups on first load, stores them with the client clock, and reports fresh and persistent', async () => {
    const cache = idbCache(() => T0);
    const { result, urls } = await countingRequests(() => cache.load({ warn: () => undefined }));
    expect(urls).toHaveLength(2);
    expect(result.stale).toBe(false);
    expect(result.persistent).toBe(true);
    expect(result.groups.stations).toEqual({ group: 'stations', fetchedAt: T0, records: loadOmmFixture('stations') });
    expect(result.groups.visual.fetchedAt).toBe(T0);
    expect(result.groups.visual.records).toHaveLength(loadOmmFixture('visual').length);
  });

  it('makes no network call while fetchedAt is younger than 2 h, and refreshes once it is not', async () => {
    let now = T0;
    const cache = idbCache(() => now);
    await cache.load();
    now = T0 + ELEMENTS_TTL_MS - 1;
    const second = await countingRequests(() => cache.load());
    expect(second.urls).toEqual([]);
    expect(second.result.groups.stations.fetchedAt).toBe(T0);
    now = T0 + ELEMENTS_TTL_MS;
    const third = await countingRequests(() => cache.load());
    expect(third.urls).toHaveLength(2);
    expect(third.result.groups.stations.fetchedAt).toBe(T0 + ELEMENTS_TTL_MS);
  });

  it('a second cache over the same database reads the first one’s entries (reload, other tab)', async () => {
    const dbName = uniqueDbName();
    const first = createElementsCache({ store: idbGroupStore(dbName), now: () => T0, locks: null, fetchGroup });
    await first.load();
    const second = createElementsCache({ store: idbGroupStore(dbName), now: () => T0 + HOUR, locks: null, fetchGroup });
    const { result, urls } = await countingRequests(() => second.load());
    expect(urls).toEqual([]);
    expect(result.groups.stations.fetchedAt).toBe(T0);
    expect(result.groups.stations.records).toEqual(loadOmmFixture('stations'));
  });

  it('two concurrent loads with a stale cache fetch each group exactly once (single-flight)', async () => {
    let now = T0;
    const cache = idbCache(() => now);
    await cache.load();
    now = T0 + 3 * HOUR;
    const { result, urls } = await countingRequests(() => Promise.all([cache.load(), cache.load()]));
    expect(urls).toHaveLength(2);
    expect(new Set(urls.map((u) => new URL(u).searchParams.get('GROUP')))).toEqual(new Set(['stations', 'visual']));
    expect(result[0].groups.stations.fetchedAt).toBe(T0 + 3 * HOUR);
    expect(result[1]).toBe(result[0]);
  });

  it('two caches (two tabs) racing under the Web Lock fetch each group exactly once between them', async () => {
    const dbName = uniqueDbName();
    const locks = serialLocks();
    const tab = (): ReturnType<typeof createElementsCache> => createElementsCache({ store: idbGroupStore(dbName), now: () => T0, locks, fetchGroup });
    const { result, urls } = await countingRequests(() => Promise.all([tab().load(), tab().load()]));
    expect(urls).toHaveLength(2);
    expect(result[1].groups.stations.fetchedAt).toBe(T0);
    expect(locks.held()).toBe(0);
  });

  it('takes the lock by its PLAN name and passes the abort signal along', async () => {
    const calls: [string, { signal?: AbortSignal }][] = [];
    const locks: LockManagerLike = {
      request: (name, options, callback) => {
        calls.push([name, options]);
        return callback();
      },
    };
    const controller = new AbortController();
    const cache = memoryCache(() => T0, { locks });
    await cache.load({ signal: controller.signal });
    expect(calls).toEqual([[ELEMENTS_LOCK_NAME, { signal: controller.signal }]]);
  });

  it('network failure with a cache past the 2 h rule returns the cached records flagged stale', async () => {
    let now = T0;
    const cache = idbCache(() => now);
    await cache.load();
    now = T0 + 3 * HOUR;
    failCelestrak();
    const warn = vi.fn();
    const result = await cache.load({ warn });
    expect(result.stale).toBe(true);
    expect(result.groups.stations.fetchedAt).toBe(T0);
    expect(result.groups.stations.records).toEqual(loadOmmFixture('stations'));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/could not refresh CelesTrak stations.*HTTP 503/));
  });

  it('network failure without a cache rejects', async () => {
    failCelestrak();
    await expect(idbCache(() => T0).load({ warn: () => undefined })).rejects.toThrow(/HTTP 503/);
  });

  it('an abort while a cached copy exists rejects rather than answering stale', async () => {
    let now = T0;
    const cache = memoryCache(() => now);
    await cache.load();
    now = T0 + 3 * HOUR;
    const controller = new AbortController();
    controller.abort();
    await expect(cache.load({ signal: controller.signal })).rejects.toThrow();
  });

  it('falls back to memory when IndexedDB throws, keeps working for the session, and reports persistent: false', async () => {
    const throwing: GroupStore = {
      get: () => Promise.reject(new Error('InvalidStateError: private mode')),
      put: () => Promise.reject(new Error('QuotaExceededError')),
    };
    let now = T0;
    const warn = vi.fn();
    const cache = createElementsCache({ store: throwing, now: () => now, locks: null, fetchGroup });
    const first = await countingRequests(() => cache.load({ warn }));
    expect(first.urls).toHaveLength(2);
    expect(first.result.persistent).toBe(false);
    expect(first.result.stale).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/IndexedDB unavailable.*private mode/));
    // The memory copy now enforces the 2 h rule for the rest of the session.
    now = T0 + HOUR;
    const second = await countingRequests(() => cache.load({ warn }));
    expect(second.urls).toEqual([]);
    expect(second.result.groups.visual.fetchedAt).toBe(T0);
  });

  it('a put that throws after a successful get also falls back to memory', async () => {
    const backing = memoryGroupStore();
    const store: GroupStore = { get: backing.get, put: () => Promise.reject(new Error('QuotaExceededError')) };
    const cache = createElementsCache({ store, now: () => T0, locks: null, fetchGroup });
    const result = await cache.load({ warn: () => undefined });
    expect(result.persistent).toBe(false);
    expect(result.groups.stations.records.length).toBeGreaterThan(0);
  });

  it('with no IndexedDB at all (store: null) the cache is memory only and persistent: false', async () => {
    const cache = createElementsCache({ store: null, now: () => T0, locks: null, fetchGroup });
    const result = await cache.load();
    expect(result.persistent).toBe(false);
    expect(result.groups.stations.fetchedAt).toBe(T0);
  });

  it('a stored entry that fails the schema reads as absent and is re-fetched', async () => {
    const dbName = uniqueDbName();
    const raw = idbGroupStore(dbName);
    await raw.put({ group: 'stations', fetchedAt: T0, records: [{ bogus: true } as never] });
    const cache = createElementsCache({ store: idbGroupStore(dbName), now: () => T0 + 1, locks: null, fetchGroup });
    const { result, urls } = await countingRequests(() => cache.load({ warn: () => undefined }));
    expect(urls).toHaveLength(2);
    expect(result.groups.stations.fetchedAt).toBe(T0 + 1);
  });
});
