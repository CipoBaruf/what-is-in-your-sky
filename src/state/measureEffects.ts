/**
 * FR-MEAS-2's state rows (D-1147): one store subscription counts `place_set`, `no_passes` and `failure`.
 * Only the slices that store a `Failure` are read here (`elements`, `forecast`, `passes`); `search` and `live` are held by
 * their screens and counted there (R196). It cannot see a coordinate or a name: it passes a name and a closed detail only.
 */
import type { Count } from '../data/measure';
import type { Observer } from '../model';
import type { AppState, AppStore } from './store';
import { sameLocation } from './slices/location';

const SOURCE_DETAIL = { geocode: 'search', coords: 'coords', device: 'device' } as const satisfies Record<Observer['source'], string>;

function placeSet(state: AppState, previous: AppState, count: Count): void {
  const observer = state.observer;
  // A zone filled in or a device fix named after its town replaces the object, not the place (`sameLocation`).
  if (observer === null || sameLocation(previous.observer, observer)) return;
  count('place_set', state.observerVia ?? SOURCE_DETAIL[observer.source]);
}

function noPasses(state: AppState, previous: AppState, count: Count): void {
  const { passes } = state;
  if (passes !== previous.passes && passes.status === 'done' && passes.passes.length === 0) count('no_passes');
}

function failures(state: AppState, previous: AppState, count: Count): void {
  if (state.elements !== previous.elements && state.elements.status === 'error') count('failure', 'elements');
  if (state.weather.error !== null && state.weather.error !== previous.weather.error) count('failure', 'forecast');
  if (state.passes.error !== null && state.passes.error !== previous.passes.error) count('failure', 'passes');
}

/** Wired by `startApp` after the saved place is restored, so a restore is not a place set; returns the unsubscribe. */
export function startMeasureEffects(store: AppStore, count: Count): () => void {
  return store.subscribe((state, previous) => {
    placeSet(state, previous, count);
    noPasses(state, previous, count);
    failures(state, previous, count);
  });
}
