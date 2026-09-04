import type { Observer } from './observer';
import type { Pass } from './pass';
import type { EpochMs, TimeWindow } from './thresholds';

/**
 * What the app keeps so it still answers with no network (spec §4.11,
 * FR-OFF-2/4, PLAN §5, D-78). `PassRun` is one finished computation as it is
 * stored: the observer it was computed for, the window it covers, when it was
 * computed and how old the elements behind it were, so the offline banners can
 * state the age of what is on screen without recomputing anything.
 * `Readiness` is the summary R27's line renders; it is derived, never stored.
 */
export interface PassRun {
  /** The observer rounded to 0.01° (D-78), e.g. `"-38.93,-67.99"`. */
  cellKey: string;
  observer: Observer;
  /** The window the run covers: 72 h from `computedAt` (FR-VIS-1 amended). */
  window: TimeWindow;
  computedAt: EpochMs;
  /**
   * The newest epoch among the elements the run used, for the FR-SAT-4 banner offline. Newest,
   * not oldest: that is how `lib/elementsAge.ts` defines a set's age (D-108).
   */
  newestElementsEpochMs: EpochMs;
  /**
   * Whether the window held any darkness at all. Stored, because an empty run means two different
   * things — "nothing is visible" and "the sun never sets far enough" — and offline there is no
   * recompute to tell them apart (D-108).
   */
  hasDarkness: boolean;
  passes: Pass[];
}

/**
 * A saved place (FR-OFF-7, US-17, D-85). It carries the whole `Observer`,
 * `timeZone` included, so selecting one offline needs no geocode call and the
 * times are local from the first render. `id` is the observer's 0.01° cell —
 * the same key `PassRun` is stored under (D-138) — so one favourite is one
 * stored run, and saving a place already on the list refreshes it instead of
 * spending a second slot. `addedAt` is when it was first saved and never
 * changes; `lastUsedAt` moves on every selection and is what the eviction
 * reads.
 */
export interface Favourite {
  cellKey: string;
  observer: Observer;
  addedAt: EpochMs;
  lastUsedAt: EpochMs;
}

/**
 * FR-OFF-7: eight saved places, the ninth evicting the least recently used
 * (D-85). A value in `src/model` because both sides need it — `data/favourites.ts`
 * to evict and R28's panel to state the limit.
 */
export const MAX_FAVOURITES = 8;

/** What is missing before the app can answer offline (FR-OFF-4). */
export type ReadinessGap = 'elements' | 'forecast' | 'passes';

export interface Readiness {
  /** The earliest of the stored passes' end and the forecast's end; null when nothing is stored. */
  offlineUntil: EpochMs | null;
  /** When the stored run was computed; null when there is none. */
  storedAt: EpochMs | null;
  missing: ReadinessGap[];
}
