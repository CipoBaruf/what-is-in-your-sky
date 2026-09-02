/**
 * The subset of `Storage` the caches and prefs use, so tests and non-browser
 * hosts can substitute a map (R8 `weatherCache`, R10 `localPrefs`).
 */
export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
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
