import type { EpochMs, Observer, Pass, PassRun, TimeWindow } from '../model';
import { openWiysDb, PASS_RUNS_STORE_NAME } from './db';
import { MOON_PHASES } from './moon/schema';
import { storedObserverSchema, toObserver } from './schemas';
import { z } from './zod';

/**
 * FR-OFF-2 / FR-OFF-5 / PLAN §7.5, D-78: every finished computation is stored
 * in IndexedDB, keyed by the observer rounded to 0.01° — about a kilometre,
 * inside which the same pass looks the same, which is the argument spec §2.2
 * makes about city-level geocoding. Writing happens on every `jobDone` that
 * was not cancelled; there is no "prepare" action. Only the two most recent
 * runs are kept: FR-OFF-7 promises favourites offline data for the *active*
 * observer, and three 72 h runs of thirty objects would be the largest thing
 * the app stores.
 *
 * A run whose window has passed is still handed back rather than dropped
 * (D-102): with no network it is all the app has, and what to say about its
 * age is the readiness line's decision (FR-OFF-4), not the store's. Storage
 * failures never surface: a browser that cannot write (private mode, quota)
 * simply has nothing stored, exactly as it did before v1.
 */
export const PASS_CELL_DEG = 0.01;
export const MAX_STORED_RUNS = 2;

/** The observer's cell: latitude and longitude to two decimals, e.g. `"-38.93,-67.99"` (D-78). */
export function passCellKey(lat: number, lon: number): string {
  // `toFixed` on the raw number, not on a rounded one: one rounding step, and it never prints "-0.00".
  const round = (n: number): string => (Math.abs(n) < PASS_CELL_DEG / 2 ? 0 : n).toFixed(2);
  return `${round(lat)},${round(lon)}`;
}

const passPointSchema = z.object({
  t: z.number().finite(),
  azDeg: z.number().finite(),
  elDeg: z.number().finite(),
  rangeKm: z.number().finite(),
});

/**
 * The Moon at the pass peak (R19, FR-MOON-1/2). The eight names come from `moon/schema.ts`, which
 * is where the lore file's keys are already declared: one list, and a stored run cannot come back
 * with a ninth name that `phaseLore` has no line for (D-103).
 */
const moonStateSchema = z.object({
  t: z.number().finite(),
  phaseAngleDeg: z.number().finite(),
  illuminatedFraction: z.number().finite(),
  phase: z.enum(MOON_PHASES),
  azDeg: z.number().finite(),
  elDeg: z.number().finite(),
  eclipticLonDeg: z.number().finite(),
});

const passSchema = z.object({
  id: z.string().min(1),
  noradId: z.number().int(),
  name: z.string(),
  start: passPointSchema,
  peak: passPointSchema,
  end: passPointSchema,
  startReason: z.enum(['horizon', 'shadow', 'twilight']),
  endReason: z.enum(['horizon', 'shadow', 'twilight']),
  durationS: z.number().finite(),
  peakMagnitude: z.number().finite(),
  sunAltAtPeakDeg: z.number().finite(),
  twilight: z.boolean(),
  track: z.array(passPointSchema),
  elementsEpochMs: z.number().finite(),
  moonAtPeak: moonStateSchema.nullable(),
  moonGlare: z.object({ glare: z.boolean(), separationDeg: z.number().finite().nullable() }),
});

/** What a stored run must look like to be trusted; anything else reads as absent, and the app recomputes. */
const storedRunSchema = z.object({
  cellKey: z.string().min(1),
  observer: storedObserverSchema,
  window: z.object({ startMs: z.number().finite(), endMs: z.number().finite() }),
  computedAt: z.number().finite(),
  newestElementsEpochMs: z.number().finite(),
  hasDarkness: z.boolean(),
  passes: z.array(passSchema),
});

/** One run in, one out, and the whole set for the prune; IndexedDB and the in-memory stand-in both implement it. */
export interface PassRunStore {
  get: (cellKey: string) => Promise<PassRun | undefined>;
  put: (run: PassRun) => Promise<void>;
  all: () => Promise<PassRun[]>;
  delete: (cellKey: string) => Promise<void>;
}

/** Zod's optional fields are `T | undefined`; the model's are absent-or-number (`exactOptionalPropertyTypes`). */
function toRun(parsed: z.infer<typeof storedRunSchema>): PassRun {
  return { ...parsed, observer: toObserver(parsed.observer) };
}

export function memoryPassRunStore(): PassRunStore {
  const map = new Map<string, PassRun>();
  return {
    get: (cellKey) => Promise.resolve(map.get(cellKey)),
    put: (run) => {
      map.set(run.cellKey, run);
      return Promise.resolve();
    },
    all: () => Promise.resolve([...map.values()]),
    delete: (cellKey) => {
      map.delete(cellKey);
      return Promise.resolve();
    },
  };
}

/** The `idb`-backed store over the shared `wiys` database (`fake-indexeddb/auto` in tests); opened on first use. */
export function idbPassRunStore(dbName?: string): PassRunStore {
  const open = (): ReturnType<typeof openWiysDb> => openWiysDb(dbName);
  const parse = (raw: unknown): PassRun | undefined => {
    const parsed = storedRunSchema.safeParse(raw);
    return parsed.success ? toRun(parsed.data) : undefined;
  };
  return {
    get: async (cellKey) => parse(await (await open()).get(PASS_RUNS_STORE_NAME, cellKey)),
    put: async (run) => {
      await (await open()).put(PASS_RUNS_STORE_NAME, run);
    },
    all: async () => {
      const raw: unknown[] = await (await open()).getAll(PASS_RUNS_STORE_NAME);
      return raw.map(parse).filter((run): run is PassRun => run !== undefined);
    },
    delete: async (cellKey) => {
      await (await open()).delete(PASS_RUNS_STORE_NAME, cellKey);
    },
  };
}

export interface PassesCacheDeps {
  /** `null` when the host has no IndexedDB: nothing is stored and nothing is read back. */
  store: PassRunStore | null;
  now: () => EpochMs;
  warn?: (message: string) => void;
}

/** A finished job, as the effects hand it over; the cache adds the key and the clock. */
export interface FinishedRun {
  observer: Observer;
  window: TimeWindow;
  newestElementsEpochMs: EpochMs;
  hasDarkness: boolean;
  passes: Pass[];
}

export interface PassesCache {
  /** Stores the run and prunes to the two most recent; returns what was stored, or null when nothing could be. */
  save: (run: FinishedRun) => Promise<PassRun | null>;
  /** The stored run for this observer's cell, expired or not (D-102), or null when there is none. */
  loadForObserver: (observer: Observer) => Promise<PassRun | null>;
}

export function createPassesCache({ store, now, warn = (m) => console.warn(m) }: PassesCacheDeps): PassesCache {
  const failed = (what: string, error: unknown): null => {
    warn(`Passes cache: could not ${what} (${error instanceof Error ? error.message : String(error)})`);
    return null;
  };

  /** Newest first, keep MAX_STORED_RUNS, delete the rest. The run just written is the newest, so it always survives. */
  const prune = async (keeping: PassRunStore): Promise<void> => {
    const runs = await keeping.all();
    if (runs.length <= MAX_STORED_RUNS) return;
    const dropped = [...runs].sort((a, b) => b.computedAt - a.computedAt).slice(MAX_STORED_RUNS);
    for (const run of dropped) await keeping.delete(run.cellKey);
  };

  return {
    save: async ({ observer, window, newestElementsEpochMs, hasDarkness, passes }) => {
      if (!store) return null;
      const run: PassRun = { cellKey: passCellKey(observer.lat, observer.lon), observer, window, computedAt: now(), newestElementsEpochMs, hasDarkness, passes };
      try {
        await store.put(run);
        await prune(store);
        return run;
      } catch (error: unknown) {
        return failed('store the finished run', error);
      }
    },
    loadForObserver: async (observer) => {
      if (!store) return null;
      try {
        return (await store.get(passCellKey(observer.lat, observer.lon))) ?? null;
      } catch (error: unknown) {
        return failed('read the stored run', error);
      }
    },
  };
}

let appCache: PassesCache | null = null;

/** The app's passes cache: the browser's IndexedDB and the wall clock. Created on first use. */
export function appPassesCache(): PassesCache {
  appCache ??= createPassesCache({ store: typeof indexedDB === 'undefined' ? null : idbPassRunStore(), now: () => Date.now() });
  return appCache;
}
