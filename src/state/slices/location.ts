import type { StateCreator } from 'zustand/vanilla';
import type { EpochMs, Observer } from '../../model';

/**
 * The observer and the instant it was (last) set. `nowMs` is read from the
 * injected clock at that moment and is the start of the search window; the
 * effect never reads the clock itself, so a test can pin it (PLAN §9.3).
 *
 * R83 (FR-VISIT-1, D-538): beside the saved `observer` sits `visiting`, the
 * place a link opened over it. It is this tab's observer for as long as it is
 * set — every reader asks `activeObserver`, never `observer` alone — and it is
 * never written anywhere: the store's write-through watches `observer` only.
 * `setObserver` is the reader choosing a place, so it ends any visit;
 * `keepVisit` makes the visited place the saved one (FR-LOC-5); `endVisit`
 * drops it, clears the link from the hash and recomputes for the saved place.
 */
export interface LocationSlice {
  observer: Observer | null;
  /** The place a link opened over the saved one, for this session only (D-538). */
  visiting: Observer | null;
  nowMs: EpochMs;
  setObserver: (observer: Observer | null) => void;
  /** Looks from a link's place without storing it. */
  visit: (observer: Observer) => void;
  /** Stores the visited place as the observer; the sky on screen does not change. */
  keepVisit: () => void;
  /** Back to the saved place: clears the hash and recomputes. */
  endVisit: () => void;
}

export interface LocationDeps {
  now: () => EpochMs;
  /** Clears the URL hash in place; the browser's by default (`state/hash.ts`). */
  clearHash?: () => void;
}

/** The observer this tab is looking from: the visited place while there is one, the saved one otherwise (D-538). */
export function activeObserver(state: Pick<LocationSlice, 'observer' | 'visiting'>): Observer | null {
  return state.visiting ?? state.observer;
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
  (set, get) => ({
    observer: null,
    visiting: null,
    nowMs: 0,
    setObserver: (observer) => {
      set({ observer, visiting: null, nowMs: deps.now() });
    },
    visit: (observer) => {
      set({ visiting: observer, nowMs: deps.now() });
    },
    keepVisit: () => {
      const { visiting } = get();
      if (visiting === null) return;
      // The same object moves across, so the active observer is unchanged and nothing is recomputed.
      set({ observer: visiting, visiting: null });
    },
    endVisit: () => {
      if (get().visiting === null) return;
      set({ visiting: null, nowMs: deps.now() });
      deps.clearHash?.();
    },
  });
