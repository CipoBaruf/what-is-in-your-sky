import type { NearPlace } from '../data/places/nearestPlace';
import { coordsLabel } from '../lib/place';
import type { Locale, Observer } from '../model';
import type { AppStore } from './store';

/**
 * FR-LOC-1 (c) as amended 2026-11-02 (PLAN D-1025): a device location is named
 * after the nearest town, on the device. The button sets the observer with its
 * coordinates as the label at once (the page never waits on a name); this
 * watcher then looks the fix up in the bundled GeoNames list
 * (`data/places/nearestTown.ts`, a lazy chunk and a same-origin asset — no request carries
 * the position) and, when the answer is still for the observer on screen,
 * writes `Cipolletti, Argentina` (the country in the reader's language,
 * `Berlin, Alemania`; no "Near", D-1029) as its label. No town within `NEAR_PLACE_MAX_KM` keeps the coordinates.
 *
 * The label is a stored string, so it is written in the language of the
 * moment; a change of language, and every new device observer — a restored
 * one, a saved place picked again — runs the lookup again and rewrites it.
 * Typed coordinates and picked places are never touched. A failed fetch
 * (offline before the list was ever fetched) leaves the coordinates, and the
 * next device observer tries again.
 *
 * Renaming replaces the observer object; the slices holding the old one are
 * re-pointed, as `fillTimeZone` does (D-3), and `sameLocation` ignores a
 * device observer's label, so the passes and the forecast are not recomputed.
 */
export type NearestTown = (lat: number, lon: number) => Promise<NearPlace | null>;

const lazyNearestTown: NearestTown = (lat, lon) => import('../data/places/nearestTown').then((m) => m.nearestTown(lat, lon));

/** "Argentina" / "Argentina", "Germany" / "Alemania"; the code itself where the runtime has no names. */
function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The label a device observer at this fix carries: the near town in `locale`, or the coordinates. */
export function deviceLabel(near: NearPlace | null, lat: number, lon: number, locale: Locale): string {
  if (near === null) return coordsLabel(lat, lon);
  // D-1029: the town's name as a picked place reads, with no "Near" before it.
  return `${near.name}, ${countryName(near.country, locale)}`;
}

export function startDeviceNaming(store: AppStore, nearestTown: NearestTown = lazyNearestTown): () => void {
  let seq = 0;
  let stopped = false;
  const name = (): void => {
    const { observer, locale } = store.getState();
    const mine = ++seq;
    if (observer?.source !== 'device') return;
    nearestTown(observer.lat, observer.lon).then(
      (near) => {
        if (stopped || mine !== seq) return;
        const state = store.getState();
        const current = state.observer;
        if (current?.source !== 'device' || current.lat !== observer.lat || current.lon !== observer.lon || state.locale !== locale) return;
        const label = deviceLabel(near, current.lat, current.lon, locale);
        if (label === current.label) return;
        const named: Observer = { ...current, label };
        store.setState((s) => {
          const repoint = <T extends { observer: Observer | null }>(slice: T): T => (slice.observer === current ? { ...slice, observer: named } : slice);
          return { observer: named, passes: repoint(s.passes), now: repoint(s.now), weather: repoint(s.weather) };
        });
      },
      () => undefined, // offline before the list was fetched: the coordinates stay, and the next device observer tries again
    );
  };
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.locale !== previous.locale) {
      name();
      return;
    }
    const next = state.observer;
    const before = previous.observer;
    if (next === before) return;
    // Our own rename and the forecast's zone replace the observer for the same fix; neither is a new lookup.
    // A fresh fix still labelled with its coordinates always is, even at the very same spot.
    const sameFix = next?.source === 'device' && before?.source === 'device' && next.lat === before.lat && next.lon === before.lon;
    if (!sameFix || (next.source === 'device' && next.label === coordsLabel(next.lat, next.lon))) name();
  });
  name();
  return () => {
    stopped = true;
    unsubscribe();
  };
}
