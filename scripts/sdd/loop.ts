/**
 * D-1314: `--until-done`, the wave loop. After each wave the driver asks `nextLoopStep` what to do:
 * stop when nothing is ready, sleep to a far limit's reset, stop after two waves in a row that
 * made no progress, or run the next wave. Kept apart from `sdd-run.ts`, which runs `main()` on
 * import, so the decision is testable without a run.
 */
import type { TaskReport } from './report';

/** The margin after a limit's reset before the next wave starts. */
export const LOOP_RESET_MARGIN_MS = 2 * 60_000;
/** The longest one sleep lasts, whatever the reset says. */
export const LOOP_SLEEP_MAX_MS = 7 * 24 * 60 * 60_000;
/** The sleep when a limit ended a task with no reset time to read. */
export const LOOP_UNKNOWN_RESET_MS = 60 * 60_000;
/** Waves in a row with nothing merged and the same failures before the loop stops. */
export const LOOP_STALLS_MAX = 2;

/** What one wave left, as the loop reads it. */
export interface WaveResult {
  /** How many tasks the wave selected; 0 is the dry run's "Nothing to run: no task is ready". */
  planned: number;
  reports: readonly Pick<TaskReport, 'id' | 'outcome' | 'resetsAt'>[];
}

export type LoopStep = { action: 'stop'; reason: string } | { action: 'sleep'; ms: number; reason: string } | { action: 'continue' };

/** The loop's memory between waves: the last wave's failures and how many waves in a row stalled. */
export interface LoopState {
  failures: readonly string[] | null;
  stalls: number;
}

export const INITIAL_LOOP_STATE: LoopState = { failures: null, stalls: 0 };

/** Each task that did not merge, as `<id> <outcome>`, sorted, so two waves compare by value. */
export const failuresOf = (result: WaveResult): string[] =>
  result.reports
    .filter((report) => report.outcome !== 'merged')
    .map((report) => `${report.id} ${report.outcome}`)
    .sort();

/** D-1314: the step after a wave, and the state the next decision reads. */
export function nextLoopStep(result: WaveResult, state: LoopState, now: number): { step: LoopStep; state: LoopState } {
  if (result.planned === 0) return { step: { action: 'stop', reason: 'nothing to run: no task is ready' }, state };
  const failures = failuresOf(result);
  const limited = result.reports.filter((report) => report.outcome === 'limit');
  if (limited.length > 0) {
    // A limit is not a stall: the wave waits it out and runs again (the in-run wait already gave up on it).
    const resets = limited.map((report) => report.resetsAt).filter((at): at is number => typeof at === 'number');
    const ms = resets.length > 0 ? Math.min(Math.max(Math.max(...resets) - now, 0) + LOOP_RESET_MARGIN_MS, LOOP_SLEEP_MAX_MS) : LOOP_UNKNOWN_RESET_MS;
    const until = resets.length > 0 ? new Date(Math.max(...resets)).toISOString() : 'unknown';
    return { step: { action: 'sleep', ms, reason: `a usage limit ended ${limited.map((report) => report.id).join(', ')} (resets ${until})` }, state: { failures, stalls: 0 } };
  }
  const merged = result.reports.some((report) => report.outcome === 'merged');
  const same = state.failures !== null && state.failures.length === failures.length && state.failures.every((failure, index) => failure === failures[index]);
  const stalls = !merged && same ? state.stalls + 1 : 0;
  const next = { failures, stalls };
  if (stalls >= LOOP_STALLS_MAX) return { step: { action: 'stop', reason: `no progress in ${String(stalls)} waves in a row: nothing merged, the same failures (${failures.join(', ') || 'none'})` }, state: next };
  return { step: { action: 'continue' }, state: next };
}
