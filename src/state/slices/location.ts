import type { StateCreator } from 'zustand/vanilla';
import type { EpochMs, Observer } from '../../model';

/**
 * The observer and the instant it was (last) set. `nowMs` is read from the
 * injected clock at that moment and is the start of the search window; the
 * effect never reads the clock itself, so a test can pin it (PLAN §9.3).
 */
export interface LocationSlice {
  observer: Observer | null;
  nowMs: EpochMs;
  setObserver: (observer: Observer | null) => void;
}

export interface LocationDeps {
  now: () => EpochMs;
}

/**
 * Same place: everything but the zone. The forecast fills `timeZone` in
 * later (R8, D-3) by replacing the observer object, and that must not read
 * as a new location to the effects.
 */
export function sameLocation(a: Observer | null, b: Observer | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.lat === b.lat && a.lon === b.lon && a.altM === b.altM && a.source === b.source && a.label === b.label;
}

export const createLocationSlice =
  (deps: LocationDeps): StateCreator<LocationSlice, [], [], LocationSlice> =>
  (set) => ({
    observer: null,
    nowMs: 0,
    setObserver: (observer) => {
      set({ observer, nowMs: deps.now() });
    },
  });
