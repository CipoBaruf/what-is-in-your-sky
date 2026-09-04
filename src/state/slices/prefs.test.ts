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

  it('reads the saved chart view and orientation at creation, writes each through, and the other write-throughs keep them (R13, US-6 AC5, FR-GUIDE-4)', () => {
    const storage = memoryStorage();
    const fresh = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) }).getState();
    expect(fresh.chartView).toBe('dome'); // FR-DOME-7, closing D-68
    expect(fresh.chartOrientation).toBe('looking-up');
    // The saved view is the one the default is not, so this proves the read rather than agreeing with it by accident.
    storage.map.set(PREFS_KEY, JSON.stringify({ chartView: 'polar', chartOrientation: 'map' }));
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().chartView).toBe('polar');
    expect(store.getState().chartOrientation).toBe('map');
    store.getState().setChartOrientation('looking-up');
    expect(store.getState().chartOrientation).toBe('looking-up');
    expect(stored(storage)).toEqual({ chartView: 'polar', chartOrientation: 'looking-up' });
    store.getState().setChartView('dome');
    expect(stored(storage)).toEqual({ chartView: 'dome', chartOrientation: 'looking-up' });
    store.getState().setChartView('dome');
    expect(store.getState().chartView).toBe('dome');
    expect(stored(storage)).toEqual({ chartView: 'dome', chartOrientation: 'looking-up' });
    store.getState().setObserver(neuquen);
    store.getState().setSort('best');
    expect(stored(storage)).toEqual({ observer: neuquen, sort: 'best', chartView: 'dome', chartOrientation: 'looking-up' });
  });

  it('resolves the language from the browser until one is saved, then keeps the saved one (R17, FR-I18N-1)', () => {
    const storage = memoryStorage();
    // jsdom reports an English list, so a fresh store is English and nothing is written until the switch is used.
    const fresh = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(fresh.getState().locale).toBe('en');
    expect(storage.map.has(PREFS_KEY)).toBe(false);
    fresh.getState().setLocale('es');
    expect(fresh.getState().locale).toBe('es');
    expect(stored(storage)).toEqual({ locale: 'es' });
    // A saved language wins over the browser at the next start, and the observer write-through keeps it.
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().locale).toBe('es');
    store.getState().setObserver(neuquen);
    expect(stored(storage)).toEqual({ observer: neuquen, locale: 'es' });
  });

  it('is dark until a theme is saved, then keeps the saved one (R20, FR-THEME-1)', () => {
    const storage = memoryStorage();
    // Unlike the language, the theme is never guessed from the device: nothing is written until the switch is used.
    const fresh = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(fresh.getState().theme).toBe('dark');
    expect(storage.map.has(PREFS_KEY)).toBe(false);
    fresh.getState().setTheme('night');
    expect(fresh.getState().theme).toBe('night');
    expect(stored(storage)).toEqual({ theme: 'night' });
    // A saved theme wins at the next start, and the other write-throughs keep it.
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().theme).toBe('night');
    store.getState().setObserver(neuquen);
    store.getState().setLocale('es');
    expect(stored(storage)).toEqual({ observer: neuquen, locale: 'es', theme: 'night' });
    store.getState().setTheme('dark');
    expect(stored(storage)).toEqual({ observer: neuquen, locale: 'es', theme: 'dark' });
  });

  it('ignores a theme it does not know without losing the other preferences', () => {
    const storage = memoryStorage();
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'sepia', locale: 'es' }));
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().locale).toBe('es');
  });
});
