/**
 * FR-MEAS-2's state rows (D-1147): one store subscription counts `place_set`, `no_passes`, `failure` and `example_shown`.
 * Only the slices that store a `Failure` are read here (`elements`, `forecast`, `passes`); `search` and `live` are held by
 * their screens and counted there (R196). It cannot see a coordinate or a name: it passes a name and a closed detail only.
 */
import type { Count } from '../data/measure';
import type { ExampleOutcome } from '../lib/exampleOutcome';
import type { Observer } from '../model';
import type { AppState, AppStore } from './store';
import { sameLocation } from './slices/location';

const SOURCE_DETAIL = { geocode: 'search', coords: 'coords', device: 'device' } as const satisfies Record<Exclude<Observer['source'], 'example'>, string>;

function placeSet(state: AppState, previous: AppState, count: Count): void {
  const observer = state.observer;
  // A zone filled in or a device fix named after its town replaces the object, not the place (`sameLocation`).
  // The example is never `observer` (D-1175); the guard only narrows the source.
  if (observer === null || observer.source === 'example' || sameLocation(previous.observer, observer)) return;
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

/**
 * FR-OPEN-10, D-1182: `example_shown` when the latch (R200's `exampleOutcome`, D-1177) takes its first value that is not
 * `pending`. R200's field is read through a cast until it lands on the slice; a missing field is `pending`.
 */
const latched = (state: AppState): Exclude<ExampleOutcome, 'pending'> | null => {
  const outcome = (state as { exampleOutcome?: ExampleOutcome }).exampleOutcome;
  return outcome === undefined || outcome === 'pending' ? null : outcome;
};

/** Wired by `startApp` after the saved place is restored, so a restore is not a place set; returns the unsubscribe. */
export function startMeasureEffects(store: AppStore, count: Count): () => void {
  // The latch never moves in a load (D-1177), so one `example_shown` per load: the first value seen, or the one already held.
  let shown = false;
  const exampleShown = (state: AppState): void => {
    const outcome = latched(state);
    if (shown || outcome === null) return;
    shown = true;
    count('example_shown', outcome);
  };
  exampleShown(store.getState());
  return store.subscribe((state, previous) => {
    exampleShown(state);
    placeSet(state, previous, count);
    noPasses(state, previous, count);
    failures(state, previous, count);
  });
}
