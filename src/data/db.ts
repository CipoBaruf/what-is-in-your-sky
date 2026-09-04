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

export function openWiysDb(dbName: string = DB_NAME): Promise<IDBPDatabase<WiysDb>> {
  let connection = connections.get(dbName);
  if (!connection) {
    connection = openDB<WiysDb>(dbName, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(ELEMENTS_STORE_NAME)) database.createObjectStore(ELEMENTS_STORE_NAME, { keyPath: 'group' });
        if (!database.objectStoreNames.contains(PASS_RUNS_STORE_NAME)) database.createObjectStore(PASS_RUNS_STORE_NAME, { keyPath: 'cellKey' });
      },
    });
    connections.set(dbName, connection);
  }
  return connection;
}
