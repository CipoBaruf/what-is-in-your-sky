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
