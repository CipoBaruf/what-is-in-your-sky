/**
 * TASKS R10 (FR-LOC-5, US-8): the last observer round-trips through
 * `wiys:prefs:v1`, an empty write removes the key, and a corrupt or
 * out-of-range body reads as empty; storage may be absent or throwing.
 */
import { describe, expect, it } from 'vitest';
import type { Observer } from '../model';
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
