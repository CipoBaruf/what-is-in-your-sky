import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CachedGroup, ElementGroup, EpochMs, OmmRecord } from '../model';
import { fetchGroup as fetchGroupLive, ommRecordSchema, type FetchGroupOptions } from './celestrak';
import { z } from './zod';

/**
 * FR-SAT-6, FR-X-4, PLAN §7.1, D-9, D-10: the raw group payloads live in
 * IndexedDB (database `wiys`, store `elementGroups`, one entry per group with
 * the client clock at fetch time) and are refreshed at most every 2 h. The
 * check-then-fetch runs under a Web Lock (`wiys:elements`) so two tabs opened
 * together fetch once between them; where Web Locks are missing the stored
 * timestamp alone decides, and concurrent loads in one tab share the in-flight
 * promise either way. When CelesTrak cannot be reached the cached copy is used
 * and the result is flagged `stale`; with no copy at all the load rejects.
 * When IndexedDB itself throws (Safari private mode, quota) the cache falls
 * back to memory for the session and reports `persistent: false`.
 */
export const ELEMENTS_DB_NAME = 'wiys';
export const ELEMENTS_STORE_NAME = 'elementGroups';
export const ELEMENTS_LOCK_NAME = 'wiys:elements';
export const ELEMENTS_TTL_MS = 2 * 60 * 60_000;
export const ELEMENT_GROUPS: readonly ElementGroup[] = ['stations', 'visual'];

interface WiysDb extends DBSchema {
  [ELEMENTS_STORE_NAME]: { key: ElementGroup; value: CachedGroup };
}

/** What a stored entry must look like to be trusted; anything else reads as absent (a schema change re-fetches). */
const cachedGroupSchema = z.object({
  group: z.enum(['stations', 'visual']),
  fetchedAt: z.number().finite(),
  records: z.array(ommRecordSchema),
});

/** One group entry in, one out; the IndexedDB and in-memory stores both implement it. */
export interface GroupStore {
  get: (group: ElementGroup) => Promise<CachedGroup | undefined>;
  put: (entry: CachedGroup) => Promise<void>;
}

export function memoryGroupStore(): GroupStore {
  const map = new Map<ElementGroup, CachedGroup>();
  return {
    get: (group) => Promise.resolve(map.get(group)),
    put: (entry) => {
      map.set(entry.group, entry);
      return Promise.resolve();
    },
  };
}

/** The `idb`-backed store over the global `indexedDB` (`fake-indexeddb/auto` in tests); opened on first use. `dbName` is a parameter so tests can isolate. */
export function idbGroupStore(dbName: string = ELEMENTS_DB_NAME): GroupStore {
  let db: Promise<IDBPDatabase<WiysDb>> | null = null;
  const open = (): Promise<IDBPDatabase<WiysDb>> => {
    db ??= openDB<WiysDb>(dbName, 1, {
      upgrade(database) {
        database.createObjectStore(ELEMENTS_STORE_NAME, { keyPath: 'group' });
      },
    });
    return db;
  };
  return {
    get: async (group) => {
      const raw: unknown = await (await open()).get(ELEMENTS_STORE_NAME, group);
      if (raw === undefined) return undefined;
      const parsed = cachedGroupSchema.safeParse(raw);
      return parsed.success && parsed.data.group === group ? parsed.data : undefined;
    },
    put: async (entry) => {
      await (await open()).put(ELEMENTS_STORE_NAME, entry);
    },
  };
}

/** The subset of `navigator.locks` the cache uses (D-10). */
export interface LockManagerLike {
  request: <T>(name: string, options: { signal?: AbortSignal }, callback: () => Promise<T>) => Promise<T>;
}

export interface ElementsCacheDeps {
  /** `null` when the host has no IndexedDB: memory only, `persistent: false`. */
  store: GroupStore | null;
  now: () => EpochMs;
  /** `null` when Web Locks are unavailable: the stored timestamp alone enforces the 2 h rule. */
  locks: LockManagerLike | null;
  fetchGroup: (group: ElementGroup, options: FetchGroupOptions) => Promise<OmmRecord[]>;
}

export interface CachedElements {
  groups: Record<ElementGroup, CachedGroup>;
  /** True when at least one group is past the 2 h rule and its refresh failed (FR-SAT-6 "on network failure use the cached set"). */
  stale: boolean;
  /** False when the groups live only in memory for this session (PLAN §7.1 "not cached" banner). */
  persistent: boolean;
}

export interface ElementsCache {
  load: (options?: FetchGroupOptions) => Promise<CachedElements>;
}

/** Fresh means fetched less than the TTL ago by the same clock; a timestamp in the future (clock set back) is not trusted. */
export function isFresh(fetchedAt: EpochMs, now: EpochMs): boolean {
  const age = now - fetchedAt;
  return age >= 0 && age < ELEMENTS_TTL_MS;
}

export function createElementsCache(deps: ElementsCacheDeps): ElementsCache {
  let store: GroupStore = deps.store ?? memoryGroupStore();
  let persistent = deps.store !== null;
  let inFlight: Promise<CachedElements> | null = null;

  /** First storage failure: switch to memory for the rest of the session, never fail the load over it. */
  const fallBackToMemory = (warn: (m: string) => void, error: unknown): void => {
    if (!persistent) return;
    persistent = false;
    store = memoryGroupStore();
    warn(`Elements cache: IndexedDB unavailable, keeping elements in memory for this session (${error instanceof Error ? error.message : String(error)})`);
  };

  const read = async (group: ElementGroup, warn: (m: string) => void): Promise<CachedGroup | undefined> => {
    try {
      return await store.get(group);
    } catch (error: unknown) {
      fallBackToMemory(warn, error);
      return undefined;
    }
  };

  const write = async (entry: CachedGroup, warn: (m: string) => void): Promise<void> => {
    try {
      await store.put(entry);
    } catch (error: unknown) {
      fallBackToMemory(warn, error);
      await store.put(entry); // the memory store cannot throw
    }
  };

  const loadGroup = async (group: ElementGroup, options: FetchGroupOptions, warn: (m: string) => void): Promise<{ entry: CachedGroup; stale: boolean }> => {
    const cached = await read(group, warn);
    if (cached && isFresh(cached.fetchedAt, deps.now())) return { entry: cached, stale: false };
    try {
      const records = await deps.fetchGroup(group, { ...options, warn });
      const entry: CachedGroup = { group, fetchedAt: deps.now(), records };
      await write(entry, warn);
      return { entry, stale: false };
    } catch (error: unknown) {
      if (!cached || options.signal?.aborted) throw error;
      warn(`Elements cache: could not refresh CelesTrak ${group}, using the copy fetched at ${new Date(cached.fetchedAt).toISOString()} (${error instanceof Error ? error.message : String(error)})`);
      return { entry: cached, stale: true };
    }
  };

  const loadAll = async (options: FetchGroupOptions): Promise<CachedElements> => {
    const warn = options.warn ?? ((m: string) => console.warn(m));
    const loaded = await Promise.all(ELEMENT_GROUPS.map((group) => loadGroup(group, options, warn)));
    const groups = Object.fromEntries(loaded.map(({ entry }) => [entry.group, entry])) as Record<ElementGroup, CachedGroup>;
    return { groups, stale: loaded.some(({ stale }) => stale), persistent };
  };

  const underLock = (options: FetchGroupOptions): Promise<CachedElements> => {
    if (!deps.locks) return loadAll(options);
    return deps.locks.request(ELEMENTS_LOCK_NAME, options.signal ? { signal: options.signal } : {}, () => loadAll(options));
  };

  return {
    load: (options = {}) => {
      if (inFlight) return inFlight;
      const promise = underLock(options).finally(() => {
        inFlight = null;
      });
      inFlight = promise;
      return promise;
    },
  };
}

let appCache: ElementsCache | null = null;

/** The app's cache: the browser's IndexedDB and Web Locks when present, the wall clock, the live CelesTrak client. Created on first use. */
export function appElementsCache(): ElementsCache {
  appCache ??= createElementsCache({
    store: typeof indexedDB === 'undefined' ? null : idbGroupStore(),
    now: () => Date.now(),
    locks: typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null,
    fetchGroup: fetchGroupLive,
  });
  return appCache;
}
