import { MAX_FAVOURITES, type EpochMs, type Favourite, type Observer } from '../model';
import { passCellKey } from './passesCache';

/**
 * FR-OFF-7, US-17, D-85: the saved places as a list, held newest use first.
 * Four pure functions over an immutable array — the prefs slice holds the list
 * as state, `localPrefs` writes it, and neither owns the rule.
 *
 * A favourite is identified by its 0.01° cell, the key its stored run already
 * uses (D-138): saving a place you have saved before refreshes the entry
 * rather than spending a second of the eight slots, and a favourite therefore
 * maps to at most one `PassRun`. The order is the eviction: the list is sorted
 * by `lastUsedAt`, newest first, so a ninth entry drops off the end, which is
 * the least recently used one. Sorting is stable, so entries saved in the same
 * millisecond — a fixed clock in a test, mostly — keep the order they were
 * added in, and the one just touched is put at the front before the sort so it
 * survives even then.
 */

/** The observer's cell, e.g. `"-38.93,-67.99"`: two observers a few hundred metres apart are one favourite. */
export function favouriteCellKey(observer: Observer): string {
  return passCellKey(observer.lat, observer.lon);
}

const byLastUsed = (a: Favourite, b: Favourite): number => b.lastUsedAt - a.lastUsedAt;

/** Newest use first, and never more than eight: the eviction is the tail of the sort (D-85). */
export function mostRecentlyUsed(favourites: readonly Favourite[]): Favourite[] {
  return [...favourites].sort(byLastUsed).slice(0, MAX_FAVOURITES);
}

/**
 * Saves `observer`, or refreshes the entry for its cell, keeping `addedAt` from
 * the entry that was there. Adding a ninth evicts the least recently used.
 */
export function addFavourite(favourites: readonly Favourite[], observer: Observer, at: EpochMs): Favourite[] {
  const cellKey = favouriteCellKey(observer);
  const existing = favourites.find((favourite) => favourite.cellKey === cellKey);
  const saved: Favourite = { cellKey, observer, addedAt: existing?.addedAt ?? at, lastUsedAt: at };
  return mostRecentlyUsed([saved, ...favourites.filter((favourite) => favourite.cellKey !== cellKey)]);
}

/** Marks a favourite as used now, which is what keeps it out of the eviction's way; an unknown cell changes nothing. */
export function touchFavourite(favourites: readonly Favourite[], cellKey: string, at: EpochMs): Favourite[] {
  const found = favourites.find((favourite) => favourite.cellKey === cellKey);
  if (!found) return [...favourites];
  return mostRecentlyUsed([{ ...found, lastUsedAt: at }, ...favourites.filter((favourite) => favourite.cellKey !== cellKey)]);
}

/** Forgets a favourite (US-17 AC2: no confirmation, so this is the whole of it); an unknown cell changes nothing. */
export function removeFavourite(favourites: readonly Favourite[], cellKey: string): Favourite[] {
  return favourites.filter((favourite) => favourite.cellKey !== cellKey);
}
