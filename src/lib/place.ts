import type { Observer, Place } from '../model';

/**
 * PLAN §7.2: a chosen place becomes an `Observer { source: 'geocode' }` whose
 * label is "name, admin1, country" (whatever of the three the provider gave)
 * and whose zone is the one the geocoding result carries (FR-LOC-3), so times
 * are local from the first render, before any forecast arrives.
 */
export function placeLabel(place: Place): string {
  return [place.name, place.admin1, place.country].filter((part): part is string => part !== undefined && part !== '').join(', ');
}

/** The secondary line of a pick-list row: "Santa Fe, Argentina", or "" when the provider gave neither. */
export function placeRegion(place: Place): string {
  return [place.admin1, place.country].filter((part): part is string => part !== undefined && part !== '').join(', ');
}

/** The observer stands at the place's recorded elevation; the pass search is insensitive to it at this scale. */
export function observerFromPlace(place: Place): Observer {
  return { lat: place.lat, lon: place.lon, altM: place.elevationM, label: placeLabel(place), source: 'geocode', timeZone: place.timeZone };
}

/**
 * Rounded, with a real minus sign: "−38.93, −67.99" (PLAN §5, FR-LOC-4 MVP
 * behaviour). R31 moved this and `observerFromCoords` down from
 * `ui/components/location/CoordsInput.tsx`: a shared link also arrives as bare
 * coordinates (FR-SHARE-1, FR-LIVE-9) and is turned into an observer by
 * `lib/shareLinks.ts`, which `src/state` calls before the first render — and
 * `src/state` may not import `src/ui` (PLAN §3).
 */
export function coordsLabel(lat: number, lon: number): string {
  const f = (n: number): string => n.toFixed(2).replace('-', '−');
  return `${f(lat)}, ${f(lon)}`;
}

export function observerFromCoords(lat: number, lon: number, altM = 0): Observer {
  return { lat, lon, altM, label: coordsLabel(lat, lon), source: 'coords', timeZone: null };
}
