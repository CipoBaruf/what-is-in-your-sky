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

  /** R136 (FR-FLOW-14, D-876): nothing saved is no `chartView` at all, so the page's default decides; a malformed one is nothing saved. */
  it('reads no chart view when none is saved, or when the saved one is not a view (R136, D-876)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    expect(prefs.read().chartView).toBeUndefined();
    prefs.write({ sort: 'best' });
    expect('chartView' in prefs.read()).toBe(false);
    storage.map.set(PREFS_KEY, JSON.stringify({ chartView: 42, sort: 'best' }));
    expect(prefs.read()).toEqual({ sort: 'best' });
  });

  /** R121 (FR-WIN-5 as amended v2.5, D-789, D-808), R136 (D-876): the window is a saved view on compact as on wide; this layer keeps it whatever the viewport. */
  it('round-trips the window as a chart view and never rewrites it', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ chartView: 'window', sort: 'best' });
    expect(prefs.read()).toEqual({ chartView: 'window', sort: 'best' });
    expect(JSON.parse(storage.map.get(PREFS_KEY) ?? '{}')).toEqual({ chartView: 'window', sort: 'best' });
    // A write-through of another preference spreads the read and so carries the window with it.
    prefs.write({ ...prefs.read(), theme: 'night' });
    expect(prefs.read()).toEqual({ chartView: 'window', sort: 'best', theme: 'night' });
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

  it('reads the faint-passes flag only when it is true, and as absent when it is false, missing or malformed (R98, FR-FAINT-3, D-623)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ theme: 'night', showFaint: true });
    expect(prefs.read()).toEqual({ theme: 'night', showFaint: true });
    // `false` is what an absent key means, so a record written that way reads one field shorter and stays empty when it was.
    prefs.write({ showFaint: false });
    expect(prefs.read()).toEqual({});
    // A record from before v2.1 has no field at all.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
    // `.catch(false)`: a value that is not a boolean is no choice and costs nothing else.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', showFaint: 'yes' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
    storage.map.set(PREFS_KEY, JSON.stringify({ locale: 'es', showFaint: 1 }));
    expect(prefs.read()).toEqual({ locale: 'es' });
  });

  it('reads the stars layer only when it is false, and as absent when it is true, missing or malformed (R123, FR-SKY-3, D-791)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ theme: 'night', starsLayer: false });
    expect(prefs.read()).toEqual({ theme: 'night', starsLayer: false });
    // `true` is what an absent key means: the stars are on by default.
    prefs.write({ starsLayer: true });
    expect(prefs.read()).toEqual({});
    // A record from before v2.5 has no field at all.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
    // `.catch(true)`: a value that is not a boolean is no choice, so the stars stay on and nothing else is lost.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', starsLayer: 'no' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
    storage.map.set(PREFS_KEY, JSON.stringify({ locale: 'es', starsLayer: 0 }));
    expect(prefs.read()).toEqual({ locale: 'es' });
  });

  it('reads the sky hint as seen only when it is true, and as absent when it is false, missing or malformed (R132, FR-FLOW-6, D-848)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ theme: 'night', skyHintSeen: true });
    expect(prefs.read()).toEqual({ theme: 'night', skyHintSeen: true });
    // `false` is what an absent key means: the hint shows until the first gesture.
    prefs.write({ skyHintSeen: false });
    expect(prefs.read()).toEqual({});
    // A record from before v2.6 has no field at all.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
    // `.catch(false)`: a value that is not a boolean is no gesture, so the hint still shows and nothing else is lost.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', skyHintSeen: 'yes' }));
    expect(prefs.read()).toEqual({ theme: 'night' });
    storage.map.set(PREFS_KEY, JSON.stringify({ locale: 'es', skyHintSeen: 1 }));
    expect(prefs.read()).toEqual({ locale: 'es' });
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

  it('reads the install-hint dismissal only when it is true (R28, FR-OFF-6)', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    prefs.write({ theme: 'night', installHintDismissed: true });
    expect(prefs.read()).toEqual({ theme: 'night', installHintDismissed: true });
    // `false` and a non-boolean both mean "not answered", which is the absent key.
    for (const bad of [false, 'yes', 1, null]) {
      storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', installHintDismissed: bad }));
      expect(prefs.read(), JSON.stringify(bad)).toEqual({ theme: 'night' });
    }
  });

  /** R55 (FR-OFF-6 as amended v1.1.2, D-272): the snooze beside the latch, and what an older blob reads as. */
  it('round-trips the install-hint declines and expiry, and reads a pre-v1.1.2 blob as a device with none', () => {
    const storage = memoryStorage();
    const prefs = createLocalPrefs(storage);
    const until = Date.UTC(2026, 8, 13, 21, 0);
    prefs.write({ theme: 'night', installHintDeclines: 2, installHintSnoozedUntil: until });
    expect(prefs.read()).toEqual({ theme: 'night', installHintDeclines: 2, installHintSnoozedUntil: until });

    // Written before v1.1.2: the latch alone, or neither key. Both read as no declines, so nothing migrates.
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', installHintDismissed: true }));
    expect(prefs.read()).toEqual({ theme: 'night', installHintDismissed: true });
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night' }));
    expect(prefs.read()).toEqual({ theme: 'night' });

    // A nonsense count or expiry drops itself and leaves the rest: zero declines is the absent key.
    for (const bad of ['soon', -1, 1.5, null]) {
      storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', installHintDeclines: bad, installHintSnoozedUntil: until }));
      expect(prefs.read(), JSON.stringify(bad)).toEqual({ theme: 'night', installHintSnoozedUntil: until });
    }
    storage.map.set(PREFS_KEY, JSON.stringify({ theme: 'night', installHintDeclines: 1, installHintSnoozedUntil: 'never' }));
    expect(prefs.read()).toEqual({ theme: 'night', installHintDeclines: 1 });
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
