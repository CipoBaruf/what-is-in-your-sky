/**
 * TASKS R10 (FR-LOC-5, US-8): the last observer round-trips through
 * `wiys:prefs:v1`, an empty write removes the key, and a corrupt or
 * out-of-range body reads as empty; storage may be absent or throwing.
 */
import { describe, expect, it } from 'vitest';
import { MAX_FAVOURITES, type Favourite, type Observer } from '../model';
import { addFavourite } from './favourites';
import { createLocalPrefs, PREFS_KEY } from './localPrefs';
import type { StorageLike } from './storage';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const device: Observer = { lat: -38.93, lon: -67.99, altM: 270, label: '−38.93, −67.99', source: 'device', timeZone: 'America/Argentina/Salta', accuracyM: 2000 };
const coords: Observer = { lat: 48.86, lon: 2.35, altM: 0, label: '48.86, 2.35', source: 'coords', timeZone: null };
const NOW = 1_789_120_000_000;

describe('createLocalPrefs', () => {
  it('round-trips the observer, zone and accuracy included, under wiys:prefs:v1', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    expect(prefs.read()).toEqual({});
    prefs.write({ observer: device });
    expect(JSON.parse(storage.map.get(PREFS_KEY) ?? '{}')).toEqual({ observer: device });
    expect(prefs.read()).toEqual({ observer: device });
    prefs.write({ observer: coords });
    expect(prefs.read()).toEqual({ observer: coords });
    expect(prefs.read().observer).not.toHaveProperty('accuracyM');
  });

  it('an empty write removes the key', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ observer: coords });
    prefs.write({});
    expect(storage.map.has(PREFS_KEY)).toBe(false);
    expect(prefs.read()).toEqual({});
  });

  it('reads a corrupt, foreign or out-of-range body as empty', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    for (const raw of ['not json', '[]', '{"observer":{"lat":91,"lon":0,"altM":0,"label":"x","source":"coords","timeZone":null}}', '{"observer":{"lat":1,"lon":2}}', '{"observer":{"lat":1,"lon":2,"altM":0,"label":"x","source":"gps","timeZone":null}}']) {
      storage.map.set(PREFS_KEY, raw);
      expect(prefs.read(), raw).toEqual({});
    }
    storage.map.set(PREFS_KEY, '{"nightMode":"red"}'); // a later preference alone: nothing to restore, nothing lost
    expect(prefs.read()).toEqual({});
  });

  it('round-trips the sort order beside the observer, and drops an unknown order without losing the observer (R12, US-5 AC2)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ sort: 'best' });
    expect(prefs.read()).toEqual({ sort: 'best' });
    prefs.write({ observer: coords, sort: 'best' });
    expect(prefs.read()).toEqual({ observer: coords, sort: 'best' });
    storage.map.set(PREFS_KEY, JSON.stringify({ observer: coords, sort: 'soonest' }));
    expect(prefs.read()).toEqual({ observer: coords });
    storage.map.set(PREFS_KEY, JSON.stringify({ observer: { lat: 91 }, sort: 'best' }));
    expect(prefs.read()).toEqual({ sort: 'best' });
  });

  it('round-trips the chart view and orientation, and drops an unknown value of either alone (R13, US-6 AC5, FR-GUIDE-4)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ observer: coords, sort: 'best', chartView: 'polar', chartOrientation: 'map' });
    expect(prefs.read()).toEqual({ observer: coords, sort: 'best', chartView: 'polar', chartOrientation: 'map' });
    storage.map.set(PREFS_KEY, JSON.stringify({ observer: coords, chartView: 'globe', chartOrientation: 'map' }));
    expect(prefs.read()).toEqual({ observer: coords, chartOrientation: 'map' });
    storage.map.set(PREFS_KEY, JSON.stringify({ chartView: 'dome', chartOrientation: 'mirror' }));
    expect(prefs.read()).toEqual({ chartView: 'dome' });
  });

  it('round-trips the saved places with the whole observer, so selecting one offline needs no geocode (R26, FR-OFF-7)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    const favourites = addFavourite(addFavourite([], device, NOW), coords, NOW + 60_000);
    prefs.write({ observer: device, favourites });
    expect(prefs.read()).toEqual({ observer: device, favourites });
    // The observer comes back whole — zone, accuracy, source and label — which is what makes an offline selection possible.
    expect(prefs.read().favourites?.[1]?.observer).toEqual(device);
    expect(prefs.read().favourites?.[0]?.observer).toEqual(coords);
  });

  it('drops a malformed favourite alone, keeping the others and the rest of the prefs (R26)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    const good: Favourite = { cellKey: '-38.93,-67.99', observer: device, addedAt: NOW, lastUsedAt: NOW };
    const older: Favourite = { cellKey: '48.86,2.35', observer: coords, addedAt: NOW - 60_000, lastUsedAt: NOW - 60_000 };
    for (const bad of [{ cellKey: '0,0', observer: { lat: 91, lon: 0, altM: 0, label: 'x', source: 'coords', timeZone: null }, addedAt: NOW, lastUsedAt: NOW }, { cellKey: '', observer: coords, addedAt: NOW, lastUsedAt: NOW }, { observer: coords, addedAt: NOW }, 'not a favourite', null]) {
      storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', favourites: [good, bad, older] }));
      expect(prefs.read(), JSON.stringify(bad)).toEqual({ theme: 'night', favourites: [good, older] });
    }
    // A favourites value that is not a list at all drops the whole field and nothing else.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', favourites: 'home' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
    // An empty list is no list: nothing was saved, so nothing is restored.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', favourites: [] }));
    expect(prefs.read()).toEqual({ theme: 'night' });
  });

  it('reads the live page hidden-objects flag as a boolean and drops anything else (R33, FR-LIVE-6)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ theme: 'night', liveHidden: true });
    expect(prefs.read()).toEqual({ theme: 'night', liveHidden: true });
    prefs.write({ liveHidden: false });
    expect(prefs.read()).toEqual({ liveHidden: false });
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', liveHidden: 'yes' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
  });

  it('reads at most eight places, newest use first, whatever the stored list says (R26, D-85)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    const twelve: Favourite[] = Array.from({ length: 12 }, (_, n) => ({ cellKey: `${n}.00,0.00`, observer: { ...coords, lat: n, label: `place ${n}` }, addedAt: NOW, lastUsedAt: NOW + n * 60_000 }));
    storage.map.set(PREFS_KEY, JSON.stringify({ favourites: twelve }));
    const read = prefs.read().favourites ?? [];
    expect(read).toHaveLength(MAX_FAVOURITES);
    expect(read[0]?.observer.label).toBe('place 11');
    expect(read.at(-1)?.observer.label).toBe('place 4');
  });

  it('works without storage and swallows storage errors', () => {
    const none = createLocalPrefs(null);
    none.write({ observer: coords });
    expect(none.read()).toEqual({});
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const prefs = createLocalPrefs(throwing);
    expect(() => {
      prefs.write({ observer: coords });
    }).not.toThrow();
    expect(() => {
      prefs.write({});
    }).not.toThrow();
    expect(prefs.read()).toEqual({});
  });
});
