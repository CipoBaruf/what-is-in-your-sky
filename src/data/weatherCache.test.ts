/**
 * TASKS R8 (FR-WX-5): two locations in the same 0.1° cell share one fetch,
 * a stored entry older than 30 min is refetched, concurrent loads share the
 * in-flight request, storage is optional and storage failures are ignored.
 * R24 (FR-OFF-3): none of that changes while there is a network — what is new
 * is that a failed fetch falls back to the stored snapshot past its TTL,
 * keeping `fetchedAt`, until the snapshot is older than the span it covers.
 */
import { describe, expect, it, vi } from 'vitest';
import type { WeatherSnapshot } from '../model';
import { cellCentre, cellKey, createWeatherCache, WEATHER_CACHE_KEY, WEATHER_RETENTION_MS, WEATHER_TTL_MS, type StorageLike } from './weatherCache';

const T0 = Date.parse('2026-09-02T19:00:00Z');

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const snapshotFor = (lat: number, lon: number, key: string, fetchedAt: number): WeatherSnapshot => ({
  provider: 'open-meteo',
  lat,
  lon,
  cellKey: key,
  fetchedAt,
  timeZone: 'America/Argentina/Salta',
  hourly: [{ t: fetchedAt, totalPct: 12, lowPct: 10, midPct: 5, highPct: 50 }],
});

function harness(storage: StorageLike | null = memoryStorage()) {
  let clock = T0;
  const fetchForecast = vi.fn((lat: number, lon: number, key: string, { now }: { now: () => number }) => Promise.resolve(snapshotFor(lat, lon, key, now())));
  const cache = createWeatherCache({ storage, now: () => clock, fetchForecast });
  return { cache, fetchForecast, storage, advance: (ms: number) => void (clock += ms) };
}

describe('cellKey', () => {
  it('rounds to 0.1° and prints one decimal with the sign kept', () => {
    expect(cellKey(-38.93, -67.99)).toBe('-38.9,-68.0');
    expect(cellKey(48.86, 2.35)).toBe('48.9,2.4');
    expect(cellKey(0.04, -0.04)).toBe('0.0,0.0'); // no "-0.0" keys
    expect(cellCentre(-38.93, -67.99)).toEqual({ lat: -38.9, lon: -68 });
  });
});

describe('createWeatherCache', () => {
  it('two locations in the same 0.1° cell share one fetch, made for the cell centre', async () => {
    const { cache, fetchForecast } = harness();
    const a = await cache.load(-38.93, -67.99);
    const b = await cache.load(-38.91, -68.04);
    expect(fetchForecast).toHaveBeenCalledTimes(1);
    expect(fetchForecast.mock.calls[0]?.slice(0, 3)).toEqual([-38.9, -68, '-38.9,-68.0']);
    expect(b).toBe(a);
    await cache.load(-38.8, -68);
    expect(fetchForecast).toHaveBeenCalledTimes(2); // a different cell
  });

  it('concurrent loads for one cell share the in-flight request', async () => {
    const { cache, fetchForecast } = harness();
    const [a, b] = await Promise.all([cache.load(-38.93, -67.99), cache.load(-38.9, -68)]);
    expect(fetchForecast).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('refetches once the entry is 30 min old, and serves it up to then', async () => {
    const { cache, fetchForecast, advance } = harness();
    await cache.load(-38.9, -68);
    advance(WEATHER_TTL_MS - 1);
    await cache.load(-38.9, -68);
    expect(fetchForecast).toHaveBeenCalledTimes(1);
    advance(1);
    const later = await cache.load(-38.9, -68);
    expect(fetchForecast).toHaveBeenCalledTimes(2);
    expect(later.fetchedAt).toBe(T0 + WEATHER_TTL_MS);
  });

  it('persists to storage under wiys:wx:v1 and a fresh cache reads it back without fetching', async () => {
    const storage = memoryStorage();
    const first = harness(storage);
    const snapshot = await first.cache.load(-38.9, -68);
    expect(Object.keys(JSON.parse(storage.map.get(WEATHER_CACHE_KEY) ?? '{}') as object)).toEqual(['-38.9,-68.0']);

    const second = harness(storage);
    expect(await second.cache.load(-38.93, -67.99)).toEqual(snapshot);
    expect(second.fetchForecast).not.toHaveBeenCalled();
  });

  it('evicts stored entries past the retention span on write, keeps merely stale ones, and ignores corrupt storage', async () => {
    const storage = memoryStorage();
    storage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({
        '0.0,0.0': snapshotFor(0, 0, '0.0,0.0', T0 - WEATHER_RETENTION_MS - 1), // covers no future hour: gone
        '48.9,2.4': snapshotFor(48.9, 2.4, '48.9,2.4', T0 - WEATHER_TTL_MS - 1), // past the TTL but still the offline answer (FR-OFF-3)
      }),
    );
    const { cache } = harness(storage);
    await cache.load(-38.9, -68);
    expect(Object.keys(JSON.parse(storage.map.get(WEATHER_CACHE_KEY) ?? '{}') as object).sort()).toEqual(['-38.9,-68.0', '48.9,2.4']);

    storage.setItem(WEATHER_CACHE_KEY, '{not json');
    const { cache: other, fetchForecast } = harness(storage);
    await other.load(-38.9, -68);
    expect(fetchForecast).toHaveBeenCalledTimes(1);
  });

  it('works without storage and when storage throws', async () => {
    const none = harness(null);
    await none.cache.load(-38.9, -68);
    await none.cache.load(-38.9, -68);
    expect(none.fetchForecast).toHaveBeenCalledTimes(1);

    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('private mode');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const broken = harness(throwing);
    await expect(broken.cache.load(-38.9, -68)).resolves.toMatchObject({ cellKey: '-38.9,-68.0' });
  });

  it('a failed fetch is not cached: the next load tries again', async () => {
    const fetchForecast = vi.fn<(lat: number, lon: number, key: string, o: { now: () => number }) => Promise<WeatherSnapshot>>().mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValueOnce(snapshotFor(-38.9, -68, '-38.9,-68.0', T0));
    const cache = createWeatherCache({ storage: null, now: () => T0, fetchForecast });
    await expect(cache.load(-38.9, -68)).rejects.toThrow('HTTP 503');
    await expect(cache.load(-38.9, -68)).resolves.toMatchObject({ cellKey: '-38.9,-68.0' });
    expect(fetchForecast).toHaveBeenCalledTimes(2);
  });

  it('offline, the stored snapshot stays in use past the TTL with its own fetchedAt (FR-OFF-3)', async () => {
    const storage = memoryStorage();
    const { cache, fetchForecast, advance } = harness(storage);
    const fresh = await cache.load(-38.9, -68);
    expect(fresh.fetchedAt).toBe(T0);

    // Two hours later the network is gone: the same snapshot comes back, not an error and not a blank.
    advance(2 * 3_600_000);
    fetchForecast.mockRejectedValue(new Error('Failed to fetch'));
    const offline = await cache.load(-38.93, -67.99);
    expect(offline).toEqual(fresh);
    expect(offline.fetchedAt).toBe(T0); // the age the badge shows

    // Still nothing cached as current: every load keeps trying, so the first one that works wins.
    await cache.load(-38.9, -68);
    expect(fetchForecast).toHaveBeenCalledTimes(3);
  });

  it('a new session offline reads the stored snapshot back from storage', async () => {
    const storage = memoryStorage();
    await harness(storage).cache.load(-38.9, -68);
    const next = harness(storage);
    next.advance(2 * 3_600_000);
    next.fetchForecast.mockRejectedValue(new Error('Failed to fetch'));
    await expect(next.cache.load(-38.9, -68)).resolves.toMatchObject({ cellKey: '-38.9,-68.0', fetchedAt: T0 });
  });

  it('stops falling back once the stored snapshot is older than the span it covers', async () => {
    const storage = memoryStorage();
    const { cache, fetchForecast, advance } = harness(storage);
    await cache.load(-38.9, -68);
    advance(WEATHER_RETENTION_MS);
    fetchForecast.mockRejectedValue(new Error('Failed to fetch'));
    await expect(cache.load(-38.9, -68)).rejects.toThrow('Failed to fetch');
  });

  it('clear() drops memory and storage', async () => {
    const storage = memoryStorage();
    const { cache, fetchForecast } = harness(storage);
    await cache.load(-38.9, -68);
    cache.clear();
    expect(storage.map.has(WEATHER_CACHE_KEY)).toBe(false);
    await cache.load(-38.9, -68);
    expect(fetchForecast).toHaveBeenCalledTimes(2);
  });
});
