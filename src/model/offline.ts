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
  /** The oldest element set the run used, for the FR-SAT-4 banner offline. */
  oldestElementsEpochMs: EpochMs;
  passes: Pass[];
}

/** What is missing before the app can answer offline (FR-OFF-4). */
export type ReadinessGap = 'elements' | 'forecast' | 'passes';

export interface Readiness {
  /** The earliest of the stored passes' end and the forecast's end; null when nothing is stored. */
  offlineUntil: EpochMs | null;
  /** When the stored run was computed; null when there is none. */
  storedAt: EpochMs | null;
  missing: ReadinessGap[];
}
