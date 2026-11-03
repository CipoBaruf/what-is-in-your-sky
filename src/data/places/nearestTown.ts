import placesUrl from './places.txt?url';
import { nearestPlace, parsePlaces, type NearPlace, type Places } from './nearestPlace';

/**
 * FR-LOC-1 (c) as amended 2026-11-02 (PLAN D-1025): the one place that fetches
 * the town list. This module is imported only with `import()` (by
 * `state/deviceName.ts`), so it and `nearestPlace.ts` are their own lazy
 * chunk, and `places.txt` is a hashed asset Vite emits beside the build: it is
 * fetched from the app's own origin, once, the first time a device location
 * needs a name — nothing about the reader's position leaves the device. A
 * failure (offline before the first fetch) is dropped rather than kept, so the
 * next device location fetches again. The service worker does not precache it
 * (D-1025: a reader who never presses the button never downloads it); the
 * asset is immutable, so the browser's cache keeps it once fetched.
 */
let loading: Promise<Places> | null = null;

function loadPlaces(fetchText: (url: string) => Promise<string>): Promise<Places> {
  loading ??= fetchText(placesUrl)
    .then(parsePlaces)
    .catch((error: unknown) => {
      loading = null;
      throw error;
    });
  return loading;
}

const fetchSameOrigin = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`places: HTTP ${String(response.status)}`);
  return response.text();
};

/** The town nearest the fix within `NEAR_PLACE_MAX_KM`, or `null`; rejects when the list could not be fetched. */
export async function nearestTown(lat: number, lon: number, fetchText: (url: string) => Promise<string> = fetchSameOrigin): Promise<NearPlace | null> {
  return nearestPlace(await loadPlaces(fetchText), lat, lon);
}
