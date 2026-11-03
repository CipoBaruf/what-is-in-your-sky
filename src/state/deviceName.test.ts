/** D-1025 (FR-LOC-1 (c) as amended 2026-11-02): a device location is named after the nearest town, after its coordinates are set. */
import { describe, expect, it, vi } from 'vitest';
import { createLocalPrefs } from '../data/localPrefs';
import type { NearPlace } from '../data/places/nearestPlace';
import { coordsLabel } from '../lib/place';
import type { Observer } from '../model';
import { deviceLabel, startDeviceNaming, type NearestTown } from './deviceName';
import { sameLocation } from './slices/location';
import { createAppStore } from './store';

const NOW = Date.UTC(2026, 10, 2, 22);
const fix: Observer = { lat: -38.94, lon: -68.0, altM: 270, label: coordsLabel(-38.94, -68.0), source: 'device', timeZone: null, accuracyM: 12_000 };
const cipolletti: NearPlace = { name: 'Cipolletti', country: 'AR', km: 1.4 };

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(nearestTown: NearestTown) {
  const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(null) });
  store.getState().setLocale('en');
  const stop = startDeviceNaming(store, nearestTown);
  return { store, stop };
}

describe('deviceLabel', () => {
  it('reads "Cipolletti, Argentina", the country in the reader's language ("Berlin, Alemania"), with no "Near" (D-1029)', () => {
    expect(deviceLabel(cipolletti, fix.lat, fix.lon, 'en')).toBe('Cipolletti, Argentina');
    expect(deviceLabel(cipolletti, fix.lat, fix.lon, 'es')).toBe('Cipolletti, Argentina');
    expect(deviceLabel({ name: 'Berlin', country: 'DE', km: 0.2 }, 52.52, 13.4, 'es')).toBe('Berlin, Alemania');
  });

  it('keeps the coordinates when no town is near', () => {
    expect(deviceLabel(null, fix.lat, fix.lon, 'en')).toBe('−38.94, −68.00');
  });
});

describe('startDeviceNaming', () => {
  it('sets the coordinates first, then the town once the lookup answers, without a new location', async () => {
    let answer: (near: NearPlace | null) => void = () => undefined;
    const lookup = vi.fn<NearestTown>(() => new Promise((resolve) => (answer = resolve)));
    const { store, stop } = setup(lookup);
    store.getState().setObserver(fix);
    expect(store.getState().observer?.label).toBe('−38.94, −68.00'); // the page does not wait on the name
    expect(lookup).toHaveBeenCalledWith(-38.94, -68.0);
    const before = store.getState().observer;
    const nowMs = store.getState().nowMs;
    answer(cipolletti);
    await flush();
    const named = store.getState().observer;
    expect(named).toEqual({ ...fix, label: 'Cipolletti, Argentina' });
    expect(sameLocation(before, named)).toBe(true); // the passes and the forecast are not recomputed
    expect(store.getState().nowMs).toBe(nowMs);
    expect(lookup).toHaveBeenCalledTimes(1); // the rename itself does not look up again
    stop();
  });

  it('rewrites the label when the language changes', async () => {
    // D-1029: the town's name is the same in both; the country is the reader's.
    const { store, stop } = setup(() => Promise.resolve({ name: 'Berlin', country: 'DE', km: 0.2 }));
    store.getState().setObserver(fix);
    await flush();
    expect(store.getState().observer?.label).toBe('Berlin, Germany');
    store.getState().setLocale('es');
    await flush();
    expect(store.getState().observer?.label).toBe('Berlin, Alemania');
    stop();
  });

  it('drops an answer for a place no longer on screen', async () => {
    let answer: (near: NearPlace | null) => void = () => undefined;
    const { store, stop } = setup(() => new Promise((resolve) => (answer = resolve)));
    store.getState().setObserver(fix);
    const typed: Observer = { lat: 52.52, lon: 13.4, altM: 0, label: coordsLabel(52.52, 13.4), source: 'coords', timeZone: null };
    store.getState().setObserver(typed);
    answer(cipolletti);
    await flush();
    expect(store.getState().observer).toBe(typed);
    stop();
  });

  it('never names typed coordinates or a picked place', async () => {
    const lookup = vi.fn<NearestTown>(() => Promise.resolve(cipolletti));
    const { store, stop } = setup(lookup);
    store.getState().setObserver({ lat: fix.lat, lon: fix.lon, altM: 0, label: fix.label, source: 'coords', timeZone: null });
    store.getState().setObserver({ lat: -38.95, lon: -68.06, altM: 270, label: 'Neuquén, Neuquén, Argentina', source: 'geocode', timeZone: 'America/Argentina/Salta' });
    await flush();
    expect(lookup).not.toHaveBeenCalled();
    stop();
  });

  it('keeps the coordinates when the list cannot be fetched, and tries again on the next fix', async () => {
    const lookup = vi.fn<NearestTown>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(cipolletti);
    const { store, stop } = setup(lookup);
    store.getState().setObserver(fix);
    await flush();
    expect(store.getState().observer?.label).toBe('−38.94, −68.00');
    store.getState().setObserver({ ...fix }); // the button pressed again, at the very same spot
    await flush();
    expect(store.getState().observer?.label).toBe('Cipolletti, Argentina');
    stop();
  });

  it('names a device location restored at start-up', async () => {
    const store = createAppStore({ now: () => NOW, prefs: createLocalPrefs(null) });
    store.getState().setLocale('en');
    store.getState().setObserver(fix);
    const stop = startDeviceNaming(store, () => Promise.resolve(cipolletti));
    await flush();
    expect(store.getState().observer?.label).toBe('Cipolletti, Argentina');
    stop();
  });
});
