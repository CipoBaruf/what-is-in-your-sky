import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CachedGroup, ElementGroup, PassRun } from '../model';

/**
 * The app's one IndexedDB database (PLAN §5). It held the CelesTrak element
 * groups alone until v1; D-78 adds `passRuns`, so the version goes to 2 and
 * the upgrade creates whatever the open database is missing — a browser that
 * has the MVP's v1 database keeps its cached elements and simply gains the new
 * store. Both caches open it through here and share the one connection, so an
 * upgrade is never blocked by the app's own second connection. `dbName` is a
 * parameter so a test can isolate itself (`uniqueDbName()`).
 */
export const DB_NAME = 'wiys';
export const DB_VERSION = 2;
export const ELEMENTS_STORE_NAME = 'elementGroups';
export const PASS_RUNS_STORE_NAME = 'passRuns';

export interface WiysDb extends DBSchema {
  elementGroups: { key: ElementGroup; value: CachedGroup };
  passRuns: { key: string; value: PassRun };
}

const connections = new Map<string, Promise<IDBPDatabase<WiysDb>>>();

/**
 * A second tab still holding the database at version 1 blocks this upgrade, and `openDB` would
 * then stay pending for as long as that tab lives. Every caller waits with it, and since the
 * stored run is read before anything is fetched (PLAN §7.5), the elements, the weather and the
 * pass job would all wait too — one forgotten tab and the app never starts. So a blocked upgrade
 * fails instead of hanging: both caches treat a failure as "nothing stored" and the app carries
 * on unstored, which is the same place a private-mode browser is in (D-108).
 */
export function openWiysDb(dbName: string = DB_NAME): Promise<IDBPDatabase<WiysDb>> {
  const cached = connections.get(dbName);
  if (cached) return cached;

  const forget = (): void => {
    if (connections.get(dbName) === connection) connections.delete(dbName);
  };

  const connection = new Promise<IDBPDatabase<WiysDb>>((resolve, reject) => {
    const opening = openDB<WiysDb>(dbName, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(ELEMENTS_STORE_NAME)) database.createObjectStore(ELEMENTS_STORE_NAME, { keyPath: 'group' });
        if (!database.objectStoreNames.contains(PASS_RUNS_STORE_NAME)) database.createObjectStore(PASS_RUNS_STORE_NAME, { keyPath: 'cellKey' });
      },
      blocked() {
        reject(new Error(`IndexedDB "${dbName}" is open at an older version in another tab; the upgrade cannot start`));
      },
      blocking() {
        // The other side of the same problem: this connection is what blocks someone else's
        // upgrade. Let go of it, and reopen on the next call.
        void opening.then(
          (database) => {
            database.close();
          },
          () => undefined,
        );
        forget();
      },
      terminated: forget,
    });
    opening.then(resolve, reject);
  });

  connections.set(dbName, connection);
  void connection.catch(forget); // a failed open is not remembered: the next call tries again
  return connection;
}
