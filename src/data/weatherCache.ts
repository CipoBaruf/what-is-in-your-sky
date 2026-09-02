import type { EpochMs, WeatherSnapshot } from '../model';
import { fetchCloudForecast } from './openMeteo/forecast';
import { storedCacheSchema, type StoredSnapshot } from './openMeteo/schemas';

/**
 * FR-WX-5: weather is cached for 30 min per 0.1° cell, in memory and in
 * `localStorage` (`wiys:wx:v1`, PLAN §5). Two observers in the same cell share
 * one snapshot, and concurrent requests for a cell share one in-flight fetch.
 * A stored entry older than the TTL is evicted on read and on write. Storage
 * failures (quota, private mode) never fail a load: the memory map carries on.
 */
export const WEATHER_CACHE_KEY = 'wiys:wx:v1';
export const WEATHER_TTL_MS = 30 * 60_000;
export const CELL_DEG = 0.1;

/** The cell's coordinates: rounded to the nearest 0.1°. */
export function cellCentre(lat: number, lon: number): { lat: number; lon: number } {
  const perDeg = Math.round(1 / CELL_DEG);
  const round = (n: number): number => Math.round(n * perDeg) / perDeg; // divide, not multiply by 0.1: keeps -38.9 exact
  return { lat: round(lat), lon: round(lon) };
}

/** `"-38.9,-68.0"` (PLAN §5). */
export function cellKey(lat: number, lon: number): string {
  const c = cellCentre(lat, lon);
  return `${c.lat.toFixed(1)},${c.lon.toFixed(1)}`;
}

/** The subset of `Storage` the cache uses, so tests and non-browser hosts can substitute a map. */
export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface WeatherCacheDeps {
  storage: StorageLike | null;
  now: () => EpochMs;
  fetchForecast: (lat: number, lon: number, cellKey: string, options: { signal?: AbortSignal; now: () => EpochMs }) => Promise<WeatherSnapshot>;
}

export interface WeatherCache {
  load: (lat: number, lon: number, options?: { signal?: AbortSignal }) => Promise<WeatherSnapshot>;
  /** Drops everything, memory and storage. */
  clear: () => void;
}

export function createWeatherCache({ storage, now, fetchForecast }: WeatherCacheDeps): WeatherCache {
  const memory = new Map<string, WeatherSnapshot>();
  const inFlight = new Map<string, Promise<WeatherSnapshot>>();

  const fresh = (snapshot: WeatherSnapshot): boolean => now() - snapshot.fetchedAt < WEATHER_TTL_MS;

  const readStorage = (): Record<string, WeatherSnapshot> => {
    try {
      const raw = storage?.getItem(WEATHER_CACHE_KEY);
      if (!raw) return {};
      const parsed = storedCacheSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return {};
      return Object.fromEntries(Object.entries(parsed.data).map(([key, stored]) => [key, fromStored(stored)]));
    } catch {
      return {};
    }
  };

  const writeStorage = (entries: Record<string, WeatherSnapshot>): void => {
    try {
      if (Object.keys(entries).length === 0) storage?.removeItem(WEATHER_CACHE_KEY);
      else storage?.setItem(WEATHER_CACHE_KEY, JSON.stringify(entries));
    } catch {
      // Quota or private mode: the in-memory copy is enough for this session.
    }
  };

  const lookup = (key: string): WeatherSnapshot | null => {
    const inMemory = memory.get(key);
    if (inMemory && fresh(inMemory)) return inMemory;
    memory.delete(key);
    const stored = readStorage()[key];
    if (stored && fresh(stored)) {
      memory.set(key, stored);
      return stored;
    }
    return null;
  };

  const remember = (key: string, snapshot: WeatherSnapshot): void => {
    memory.set(key, snapshot);
    const entries = Object.fromEntries(Object.entries(readStorage()).filter(([, v]) => fresh(v)));
    entries[key] = snapshot;
    writeStorage(entries);
  };

  return {
    load: (lat, lon, options = {}) => {
      const key = cellKey(lat, lon);
      const hit = lookup(key);
      if (hit) return Promise.resolve(hit);
      const pending = inFlight.get(key);
      if (pending) return pending;
      const centre = cellCentre(lat, lon);
      const promise = fetchForecast(centre.lat, centre.lon, key, { ...options, now })
        .then((snapshot) => {
          remember(key, snapshot);
          return snapshot;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, promise);
      return promise;
    },
    clear: () => {
      memory.clear();
      writeStorage({});
    },
  };
}

/** `localStorage` when the host has one that works, else null (Safari private mode throws on access). */
export function browserStorage(): StorageLike | null {
  try {
    const storage: unknown = globalThis.localStorage;
    return typeof storage === 'object' && storage !== null && 'getItem' in storage ? (storage as StorageLike) : null;
  } catch {
    return null;
  }
}

/** Zod's optional fields are `T | undefined`; the model's are absent-or-number (`exactOptionalPropertyTypes`). */
function fromStored(stored: StoredSnapshot): WeatherSnapshot {
  return {
    ...stored,
    hourly: stored.hourly.map(({ t, totalPct, lowPct, midPct, highPct }) => ({
      t,
      totalPct,
      ...(lowPct !== undefined && midPct !== undefined && highPct !== undefined ? { lowPct, midPct, highPct } : {}),
    })),
  };
}

let appCache: WeatherCache | null = null;

/** The app's cache, created on first use with `localStorage` and the wall clock. */
export function loadCloudForecast(lat: number, lon: number, options: { signal?: AbortSignal } = {}): Promise<WeatherSnapshot> {
  appCache ??= createWeatherCache({ storage: browserStorage(), now: () => Date.now(), fetchForecast: fetchCloudForecast });
  return appCache.load(lat, lon, options);
}
