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

  it('keeps the hidden objects off until the live page turns them on, then remembers it (R33, FR-LIVE-6)', () => {
    const storage = memoryStorage();
    const fresh = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(fresh.getState().liveHidden).toBe(false);
    expect(stored(storage)).toBeNull();
    fresh.getState().setLiveHidden(true);
    expect(fresh.getState().liveHidden).toBe(true);
    expect(stored(storage)).toEqual({ liveHidden: true });
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().liveHidden).toBe(true);
    store.getState().setTheme('night');
    store.getState().setLiveHidden(false);
    expect(stored(storage)).toEqual({ theme: 'night', liveHidden: false });
  });

  it('ignores a theme it does not know without losing the other preferences', () => {
    const storage = memoryStorage();
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'sepia', locale: 'es' }));
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().locale).toBe('es');
  });
});

/**
 * TASKS R26 (FR-OFF-7, US-17, D-85, D-138, D-139): the saved places are store
 * state read from `wiys:prefs:v1` at creation, and the three operations write
 * the list back. Selecting one is a `setObserver`, which is what starts the
 * FR-VIS-5 recompute; `effects.test.ts` proves the recompute itself.
 */
describe('favourites', () => {
  const MINUTE = 60_000;
  const NEUQUEN_CELL = '-38.93,-67.99';
  const PARIS_CELL = '48.86,2.35';

  it('starts empty, saves the whole observer under its cell, and writes the list through', () => {
    const storage = memoryStorage();
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().favourites).toEqual([]);
    expect(storage.map.has(PREFS_KEY)).toBe(false);

    store.getState().addFavourite(neuquen);
    expect(store.getState().favourites).toEqual([{ cellKey: NEUQUEN_CELL, observer: neuquen, addedAt: NOW, lastUsedAt: NOW }]);
    expect(stored(storage)).toEqual({ favourites: [{ cellKey: NEUQUEN_CELL, observer: neuquen, addedAt: NOW, lastUsedAt: NOW }] });

    // And they come back at the next start, the zone and accuracy of each observer included.
    store.getState().addFavourite(paris);
    const restarted = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(restarted.getState().favourites.map((favourite) => favourite.observer)).toEqual([paris, neuquen]);
  });

  it('selects a saved place: it becomes the observer, with the window start from the clock (FR-VIS-5, US-17 AC2)', () => {
    const storage = memoryStorage();
    let clock = NOW;
    const store = createAppStore({ now: () => clock, prefs: createLocalPrefs(storage) });
    store.getState().addFavourite(neuquen);
    store.getState().addFavourite(paris);
    expect(store.getState().observer).toBeNull(); // saving a place does not select it

    clock = NOW + 5 * MINUTE;
    expect(store.getState().selectFavourite(NEUQUEN_CELL)).toBe(true);
    expect(store.getState()).toMatchObject({ observer: neuquen, nowMs: NOW + 5 * MINUTE });
    // Used, so it is now the front of the list and the last thing the eviction would drop.
    expect(store.getState().favourites.map((favourite) => favourite.cellKey)).toEqual([NEUQUEN_CELL, PARIS_CELL]);
    expect(store.getState().favourites[0]).toMatchObject({ addedAt: NOW, lastUsedAt: NOW + 5 * MINUTE });
    // The observer write-through and the favourites write-through do not overwrite each other.
    expect(stored(storage)).toMatchObject({ observer: neuquen });
    expect(createLocalPrefs(storage).read().favourites?.map((favourite) => favourite.cellKey)).toEqual([NEUQUEN_CELL, PARIS_CELL]);
  });

  it('reports an unknown place rather than clearing the observer', () => {
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(memoryStorage()) });
    store.getState().setObserver(paris);
    expect(store.getState().selectFavourite(NEUQUEN_CELL)).toBe(false);
    expect(store.getState().observer).toBe(paris);
    expect(store.getState().favourites).toEqual([]);
  });

  it('removes one place with no other effect, and an empty list leaves no key behind (US-17 AC2)', () => {
    const storage = memoryStorage();
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    store.getState().addFavourite(neuquen);
    store.getState().addFavourite(paris);
    store.getState().selectFavourite(PARIS_CELL);

    store.getState().removeFavourite(PARIS_CELL);
    expect(store.getState().favourites.map((favourite) => favourite.cellKey)).toEqual([NEUQUEN_CELL]);
    expect(store.getState().observer).toBe(paris); // removing a place is not leaving it
    expect(createLocalPrefs(storage).read().favourites).toHaveLength(1);

    store.getState().removeFavourite(NEUQUEN_CELL);
    expect(store.getState().favourites).toEqual([]);
    expect(createLocalPrefs(storage).read()).toEqual({ observer: paris });
  });

  it('keeps the ninth place and drops the least recently used, across a restart (D-85)', () => {
    const storage = memoryStorage();
    let clock = NOW;
    const store = createAppStore({ now: () => clock, prefs: createLocalPrefs(storage) });
    for (let n = 0; n < 8; n++) {
      clock = NOW + n * MINUTE;
      store.getState().addFavourite({ ...neuquen, lat: -38.93 + n, label: `place ${n}` });
    }
    expect(store.getState().favourites).toHaveLength(8);
    clock = NOW + 8 * MINUTE;
    store.getState().addFavourite(paris);
    expect(store.getState().favourites).toHaveLength(8);
    expect(store.getState().favourites.map((favourite) => favourite.observer.label)).not.toContain('place 0');

    const restarted = createAppStore({ now: () => clock, prefs: createLocalPrefs(storage) });
    expect(restarted.getState().favourites.map((favourite) => favourite.observer.label)).toEqual(store.getState().favourites.map((favourite) => favourite.observer.label));
  });

  it('drops a malformed saved place without losing the others or the observer', () => {
    const storage = memoryStorage();
    const good = { cellKey: NEUQUEN_CELL, observer: neuquen, addedAt: NOW, lastUsedAt: NOW };
    storage.map.set(PREFS_KEY, JSON.stringify({ observer: paris, favourites: [good, { cellKey: PARIS_CELL, observer: { lat: 91 }, addedAt: NOW, lastUsedAt: NOW }] }));
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(storage) });
    expect(store.getState().favourites).toEqual([good]);
    expect(store.getState().restoreSavedObserver()).toBe(true);
    expect(store.getState().observer).toEqual(paris);
  });
});
