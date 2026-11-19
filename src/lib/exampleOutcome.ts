import type { EpochMs, Pass } from '../model';
import { isNoEvent, nextEvent } from './nextEvent';

/**
 * R199 (FR-OPEN-4, FR-OPEN-6, D-1177): what the example first run came to, as one
 * pure function of what the page holds and the clock. The latch that stores the
 * first answer that is not `pending`, and the timer that asks again at
 * `EXAMPLE_WAIT_MS`, are R200's; this file only answers.
 */

/**
 * How long the first screen waits for the example's run, ms. A first visit
 * fetches the elements and runs 72 h before it can answer, and a reader who has
 * waited that long is better served by the question (FR-OPEN-4, V216-15).
 */
export const EXAMPLE_WAIT_MS = 10_000;

export type ExampleOutcome = 'pending' | 'pass' | 'none' | 'no_city' | 'failed' | 'slow';

/** The shape of `state/failure`'s `Failure`, which `lib` may not import (PLAN §3); a `Failure` is assignable to it (D-1189). */
interface FailureLike {
  kind: string;
  detail: string;
}

export interface ExampleOutcomeInput {
  /** The zone's city (FR-OPEN-1), or null where the zone has none. */
  city: object | null;
  /** The elements' failure, or null while they are loading or loaded. */
  elements: FailureLike | null;
  /** The finished run's passes, a `Failure` where the run failed, null until it is finished. */
  passes: readonly Pass[] | FailureLike | null;
  /** When the example began, epoch ms (the injected clock, D-15). */
  startedMs: EpochMs;
  nowMs: EpochMs;
}

const isRun = (passes: readonly Pass[] | FailureLike): passes is readonly Pass[] => Array.isArray(passes);

export function exampleOutcome({ city, elements, passes, startedMs, nowMs }: ExampleOutcomeInput): ExampleOutcome {
  if (city === null) return 'no_city';
  if (elements !== null || (passes !== null && !isRun(passes))) return 'failed';
  // A run that finishes at or after the wait was not ready inside it (D-1188).
  if (nowMs - startedMs >= EXAMPLE_WAIT_MS) return 'slow';
  if (passes === null) return 'pending';
  // FR-OPEN-6: a pass on a later night inside the 72 h is a pass; `nextEvent` decides, as FR-FIRST-3 does.
  return isNoEvent(nextEvent(passes, nowMs)) ? 'none' : 'pass';
}
