/**
 * D-1314: `--until-done`, the wave loop. After each wave the driver asks `nextLoopStep` what to do:
 * stop when nothing is ready, sleep to a far limit's reset, stop after two waves in a row that
 * made no progress, or run the next wave. D-1317: it also skips a blocked task, one the token
 * ceiling killed three times, and one that failed the same way twice, and stops when only skipped
 * tasks are ready. D-1320: when nothing is ready it first retries, once each, the phase's tasks
 * whose PR is still open (a red, conflicting or unreviewed PR is recoverable), and its exit code
 * says whether anything is left that the owner is not the one to move. Kept apart from `sdd-run.ts`, which runs `main()` on
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
const LOOP_STALLS_MAX = 2;
/** D-1317: how many times a task the token ceiling killed is resumed before the loop skips it. */
const LOOP_BUDGET_RETRIES = 2;
/** D-1320: the most open PRs one retry wave carries on — the wave cap (D-132); the rest wait for the next idle wave. */
const LOOP_RETRY_MAX = 3;
/** D-1317: identical failures in a row before the loop skips a task. */
const LOOP_SAME_FAILURES = 2;

/** What one wave left, as the loop reads it. */
export interface WaveResult {
  /** How many tasks the wave selected; 0 is the dry run's "Nothing to run: no task is ready". */
  planned: number;
  reports: readonly (Pick<TaskReport, 'id' | 'outcome' | 'resetsAt'> & Partial<Pick<TaskReport, 'reason' | 'attempts'>>)[];
  /** D-1317: ready tasks the loop left out because they are skipped. */
  skippedReady?: readonly string[];
  /** D-1320: the open phase's tasks with an open PR the driver can carry on (not labelled for the owner, no blocked note). */
  retryable?: readonly string[];
  /** D-1320: the open phase's unmerged tasks, for the exit code and the stop's list. */
  unmerged?: readonly LoopTask[];
}

/** D-1320: one unmerged task as the stop reads it. `owner` is true when only the owner can move it (labelled `needs-owner`, `Model: interactive`, a missing `Precondition:`). */
export interface LoopTask {
  id: string;
  state: string;
  missingDeps: readonly string[];
  owner: boolean;
}

export type LoopStep = { action: 'stop'; reason: string; code: number } | { action: 'sleep'; ms: number; reason: string } | { action: 'continue' } | { action: 'retry'; ids: readonly string[]; reason: string };

/** The loop's memory between waves: the last wave's failures, how many waves in a row stalled, each task's outcomes, and the tasks it skips. */
export interface LoopState {
  failures: readonly string[] | null;
  stalls: number;
  history?: Readonly<Record<string, readonly string[]>>;
  skip?: readonly string[];
  /** D-1320: the open PRs this loop already retried once. */
  retried?: readonly string[];
}

export const INITIAL_LOOP_STATE: LoopState = { failures: null, stalls: 0, history: {}, skip: [], retried: [] };

/**
 * D-1320: the unmerged tasks the owner is not the one to move: a task waiting on the owner is left
 * out, and so is a blocked task whose every missing dependency is one of those, transitively.
 */
export function stuckTasks(tasks: readonly LoopTask[]): LoopTask[] {
  const owner = new Set(tasks.filter((task) => task.owner).map((task) => task.id));
  for (let grew = true; grew; ) {
    grew = false;
    for (const task of tasks) {
      if (owner.has(task.id) || task.state !== 'blocked' || task.missingDeps.length === 0 || !task.missingDeps.every((dep) => owner.has(dep))) continue;
      owner.add(task.id);
      grew = true;
    }
  }
  return tasks.filter((task) => !owner.has(task.id));
}

const describeTask = (task: LoopTask): string => (task.state === 'blocked' ? `${task.id} blocked on ${task.missingDeps.join(', ')}` : `${task.id} ${task.state}`);

/** D-1320: the stop when nothing is ready and nothing is left to retry: exit 0 only when every unmerged task waits on the owner. */
function idleStop(result: WaveResult): LoopStep {
  const unmerged = result.unmerged ?? [];
  const stuck = stuckTasks(unmerged);
  if (stuck.length > 0) return { action: 'stop', reason: `nothing to run, but ${String(stuck.length)} task(s) of the phase are not merged and not waiting on the owner: ${stuck.map(describeTask).join('; ')}`, code: 1 };
  if (unmerged.length > 0) return { action: 'stop', reason: `nothing to run: every unmerged task waits on the owner (${unmerged.map((task) => task.id).join(', ')})`, code: 0 };
  return { action: 'stop', reason: 'nothing to run: no task is ready', code: 0 };
}

/** A report's outcome as one comparable string; a token-ceiling kill reads `budget`. */
const signature = (report: WaveResult['reports'][number]): string => (report.attempts?.at(-1)?.outcome === 'budget' ? 'budget' : `${report.outcome}|${report.reason ?? ''}`);

/** D-1317: the tasks to leave out of later waves: blocked, killed for budget past its retries, or failing the same way twice. */
function skipsAfter(result: WaveResult, state: LoopState): { history: Record<string, string[]>; skip: string[] } {
  const history: Record<string, string[]> = Object.fromEntries(Object.entries(state.history ?? {}).map(([id, list]) => [id, [...list]]));
  const skip = new Set(state.skip ?? []);
  for (const report of result.reports) {
    if (report.outcome === 'merged') continue;
    const list = (history[report.id] ??= []);
    list.push(signature(report));
    const budgetKills = list.filter((entry) => entry === 'budget').length;
    const last = list.slice(-LOOP_SAME_FAILURES);
    const repeated = last.length === LOOP_SAME_FAILURES && last.every((entry) => entry === last[0]) && last[0] !== 'budget' && !last[0]?.startsWith('limit|');
    if (report.outcome === 'blocked' || budgetKills > LOOP_BUDGET_RETRIES || repeated) skip.add(report.id);
  }
  return { history, skip: [...skip].sort() };
}

/** Each task that did not merge, as `<id> <outcome>`, sorted, so two waves compare by value. */
export const failuresOf = (result: WaveResult): string[] =>
  result.reports
    .filter((report) => report.outcome !== 'merged')
    .map((report) => `${report.id} ${report.outcome}`)
    .sort();

/** D-1314: the step after a wave, and the state the next decision reads. */
export function nextLoopStep(result: WaveResult, state: LoopState, now: number): { step: LoopStep; state: LoopState } {
  if (result.planned === 0) {
    // D-1320: an open PR left red, conflicting or with findings is carried on once before the loop gives up on it.
    const done = new Set([...(state.retried ?? []), ...(state.skip ?? [])]);
    const retry = (result.retryable ?? []).filter((id) => !done.has(id)).slice(0, LOOP_RETRY_MAX);
    if (retry.length > 0) return { step: { action: 'retry', ids: retry, reason: `no task is ready; carrying on the open PR(s) of ${retry.join(', ')} once (D-1320)` }, state: { ...state, retried: [...(state.retried ?? []), ...retry].sort() } };
    if ((result.skippedReady?.length ?? 0) > 0) return { step: { action: 'stop', reason: `every remaining ready task is skipped: ${(result.skippedReady ?? []).join(', ')} (blocked, killed for budget ${String(LOOP_BUDGET_RETRIES + 1)} times, or the same failure twice)`, code: 1 }, state };
    return { step: idleStop(result), state };
  }
  const failures = failuresOf(result);
  const kept = skipsAfter(result, state);
  const limited = result.reports.filter((report) => report.outcome === 'limit');
  if (limited.length > 0) {
    // A limit is not a stall: the wave waits it out and runs again (the in-run wait already gave up on it).
    const resets = limited.map((report) => report.resetsAt).filter((at): at is number => typeof at === 'number');
    const ms = resets.length > 0 ? Math.min(Math.max(Math.max(...resets) - now, 0) + LOOP_RESET_MARGIN_MS, LOOP_SLEEP_MAX_MS) : LOOP_UNKNOWN_RESET_MS;
    const until = resets.length > 0 ? new Date(Math.max(...resets)).toISOString() : 'unknown';
    // D-1320: a retry a limit cut short is not spent.
    const retried = (state.retried ?? []).filter((id) => !limited.some((report) => report.id === id));
    return { step: { action: 'sleep', ms, reason: `a usage limit ended ${limited.map((report) => report.id).join(', ')} (resets ${until})` }, state: { failures, stalls: 0, ...kept, retried } };
  }
  const merged = result.reports.some((report) => report.outcome === 'merged');
  const same = state.failures !== null && state.failures.length === failures.length && state.failures.every((failure, index) => failure === failures[index]);
  const stalls = !merged && same ? state.stalls + 1 : 0;
  const next = { failures, stalls, ...kept, retried: state.retried ?? [] };
  if (stalls >= LOOP_STALLS_MAX) return { step: { action: 'stop', reason: `no progress in ${String(stalls)} waves in a row: nothing merged, the same failures (${failures.join(', ') || 'none'})`, code: 1 }, state: next };
  return { step: { action: 'continue' }, state: next };
}
