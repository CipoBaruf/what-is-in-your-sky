/**
 * Elements caches for tests (R11): a fresh cache per test so nothing leaks
 * between them. `memoryCache` never touches IndexedDB; `idbCache` uses
 * `fake-indexeddb` (installed globally by `tests/setup/vitest.node.ts`) under
 * a unique database name; `serialLocks` is a Web Locks stand-in that runs
 * requests one at a time, like the browser's for one lock name.
 */
import { fetchGroup } from '../../src/data/celestrak';
import { createElementsCache, idbGroupStore, memoryGroupStore, type ElementsCache, type ElementsCacheDeps, type LockManagerLike } from '../../src/data/elementsCache';
import type { EpochMs } from '../../src/model';

let dbCounter = 0;

/** A unique IndexedDB name per call, so two tests never share a store. */
export function uniqueDbName(): string {
  dbCounter += 1;
  return `wiys-test-${String(process.pid)}-${String(dbCounter)}`;
}

/** One lock at a time, in request order: what `navigator.locks` does for a single lock name. */
export function serialLocks(): LockManagerLike & { held: () => number } {
  let queue: Promise<unknown> = Promise.resolve();
  let held = 0;
  return {
    held: () => held,
    request: (_name, _options, callback) => {
      const run = queue.then(async () => {
        held += 1;
        try {
          return await callback();
        } finally {
          held -= 1;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
}

export function memoryCache(now: () => EpochMs, overrides: Partial<ElementsCacheDeps> = {}): ElementsCache {
  return createElementsCache({ store: memoryGroupStore(), now, locks: null, fetchGroup, ...overrides });
}

export function idbCache(now: () => EpochMs, overrides: Partial<ElementsCacheDeps> = {}): ElementsCache {
  return createElementsCache({ store: idbGroupStore(uniqueDbName()), now, locks: serialLocks(), fetchGroup, ...overrides });
}
