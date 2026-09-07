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

/**
 * F-19 (R51): the bounds an observer's coordinates must be inside, in the one
 * module both sides of a share link can reach. `CoordsInput` validates the
 * form against them and `shareLinks.ts` validates an incoming link against
 * them; they were copied into each, so the form could accept an altitude the
 * parser would then reject and the link would open on the saved location
 * instead. `src/state` may not import `src/ui` (PLAN §3), so `lib` is where
 * the pair meets.
 */
export const LATITUDE_RANGE = { min: -90, max: 90 };
export const LONGITUDE_RANGE = { min: -180, max: 180 };
/** Below the Dead Sea shore and above every town; guards against a typo like "27000". */
export const ALTITUDE_RANGE = { min: -500, max: 9000 };

const inside = (value: number, range: { min: number; max: number }): boolean => value >= range.min && value <= range.max;

export const latitudeInRange = (lat: number): boolean => inside(lat, LATITUDE_RANGE);
export const longitudeInRange = (lon: number): boolean => inside(lon, LONGITUDE_RANGE);
export const altitudeInRange = (altM: number): boolean => inside(altM, ALTITUDE_RANGE);
