/**
 * TASKS R10 (FR-LOC-5, US-8): the store writes every observer change
 * through to `wiys:prefs:v1` (a zone filled in later included), restores
 * the saved observer on request, and the clear action drops both the saved and the active observer.
 */
import { describe, expect, it } from 'vitest';
import { createLocalPrefs, PREFS_KEY } from '../../data/localPrefs';
import type { StorageLike } from '../../data/storage';
import type { Observer } from '../../model';
import { createAppStore } from '../store';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const NOW = 1_789_120_000_000;
const neuquen: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: '−38.93, −67.99', source: 'coords', timeZone: null };
const paris: Observer = { lat: 48.86, lon: 2.35, altM: 35, label: '48.86, 2.35', source: 'device', timeZone: null, accuracyM: 2000 };

const stored = (storage: ReturnType<typeof memoryStorage>): unknown => JSON.parse(storage.map.get(PREFS_KEY) ?? 'null');

describe('prefs slice', () => {
  it('writes the observer through to storage on every change, the filled-in zone included', () => {
    const storage = memoryStorage();
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(storage.map.has(PREFS_KEY)).toBe(false);
    store.getState().setObserver(neuquen);
    expect(stored(storage)).toEqual({ observer: neuquen });
    store.getState().fillTimeZone('America/Argentina/Salta');
    expect(stored(storage)).toEqual({ observer: { ...neuquen, timeZone: 'America/Argentina/Salta' } });
    store.getState().setObserver(paris);
    expect(stored(storage)).toEqual({ observer: paris });
    store.getState().setObserver(null);
    expect(storage.map.has(PREFS_KEY)).toBe(false);
  });

  it('restores the saved observer through setObserver (window start from the clock) and reports whether there was one', () => {
    const storage = memoryStorage();
    storage.map.set(PREFS_KEY, JSON.stringify({ observer: paris }));
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().observer).toBeNull();
    expect(store.getState().restoreSavedObserver()).toBe(true);
    expect(store.getState()).toMatchObject({ observer: paris, nowMs: NOW });
    const empty = createAppStore({ now: () => NOW, prefs: createLocalPrefs(memoryStorage()) });
    expect(empty.getState().restoreSavedObserver()).toBe(false);
    expect(empty.getState().observer).toBeNull();
  });

  it('clearSavedObserver empties the observer in wiys:prefs:v1 and drops the active observer (US-8 AC2)', () => {
    const storage = memoryStorage();
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    store.getState().setObserver(neuquen);
    store.getState().clearSavedObserver();
    expect(store.getState().observer).toBeNull();
    expect(storage.map.has(PREFS_KEY)).toBe(false);
    expect(createLocalPrefs(storage).read()).toEqual({});
  });

  it('reads the saved sort order at creation, writes it through beside the observer, and the observer write-through keeps it (R12, US-5 AC2)', () => {
    const storage = memoryStorage();
    expect(createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) }).getState().sort).toBe('chronological');
    storage.map.set(PREFS_KEY, JSON.stringify({ sort: 'best' }));
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().sort).toBe('best');
    store.getState().setObserver(neuquen);
    expect(stored(storage)).toEqual({ observer: neuquen, sort: 'best' });
    store.getState().setSort('chronological');
    expect(store.getState().sort).toBe('chronological');
    expect(stored(storage)).toEqual({ observer: neuquen, sort: 'chronological' });
    store.getState().setObserver(null);
    expect(stored(storage)).toEqual({ sort: 'chronological' }); // the order outlives the location
  });
});
