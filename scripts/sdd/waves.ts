/**
 * PLAN §16.2 and §16.5: what is merged, ready, blocked or failed, and which
 * tasks make up the current wave.
 *
 * The driver has no state of its own (§16.7): every state below is derived
 * from `origin/main`'s checkboxes, the branches on the remote and the open
 * PRs. A task whose branch is on the remote with no open PR and no merge is
 * the residue of a failed run — §16.5 keeps exactly that — so `failed` is
 * read back rather than remembered.
 *
 * Pure: the caller supplies what git and `gh` said, so the tests need no
 * network.
 */
import { runBlockers, type Lane, type Task } from './tasks';

export type TaskState = 'merged' | 'in-review' | 'failed' | 'blocked' | 'ready';

export interface RemoteFacts {
  tasks: readonly Task[];
  /** Task id → open PR number, from `gh pr list`. */
  openPrs: ReadonlyMap<string, number>;
  /** Branch names present on `origin`. */
  remoteBranches: ReadonlySet<string>;
}

export interface TaskStatus {
  task: Task;
  state: TaskState;
  /** Dependencies not yet checked off on `origin/main`. */
  missingDeps: readonly string[];
  /** §16.3 breakdown bugs that stop the driver running it. */
  blockers: readonly string[];
  pr: number | null;
}

export interface WaveLimits {
  /** §16.2: at most one task per lane. */
  maxPerLane: number;
  /** §16.2: at most three tasks at once (D-132) — they run concurrently, and three is what one machine carries. */
  maxTasks: number;
}

export const DEFAULT_LIMITS: WaveLimits = { maxPerLane: 1, maxTasks: 3 };

export interface WaveSelection {
  wave: readonly TaskStatus[];
  /** Ready tasks left out of this wave, each with the reason. */
  skipped: readonly { task: Task; reason: string }[];
}

/** Every task's state, in file order. */
export function statusOf({ tasks, openPrs, remoteBranches }: RemoteFacts): TaskStatus[] {
  const merged = new Set(tasks.filter((task) => task.done).map((task) => task.id));
  return tasks.map((task) => {
    const missingDeps = task.deps.filter((dep) => !merged.has(dep));
    const pr = openPrs.get(task.id) ?? null;
    const state: TaskState = task.done
      ? 'merged'
      : pr !== null
        ? 'in-review'
        : remoteBranches.has(task.branch)
          ? 'failed'
          : missingDeps.length > 0
            ? 'blocked'
            : 'ready';
    return { task, state, missingDeps, blockers: runBlockers(task), pr };
  });
}

/**
 * The current wave: ready tasks in TASKS.md order, at most one per lane and
 * at most three at once (§16.2, D-132). A lane with a task in review is busy — that
 * PR is unmerged work on the same directories. A task missing `Lane:` or
 * `Gate:` is left out and reported (§16.3).
 */
export function selectWave(statuses: readonly TaskStatus[], limits: WaveLimits = DEFAULT_LIMITS): WaveSelection {
  const wave: TaskStatus[] = [];
  const skipped: { task: Task; reason: string }[] = [];
  const laneCount = new Map<Lane, number>();
  for (const status of statuses) if (status.state === 'in-review' && status.task.lane) laneCount.set(status.task.lane, (laneCount.get(status.task.lane) ?? 0) + 1);

  for (const status of statuses) {
    if (status.state !== 'ready') continue;
    if (status.blockers.length > 0) {
      skipped.push({ task: status.task, reason: `breakdown bug: ${status.blockers.join(', ')}` });
      continue;
    }
    if (wave.length >= limits.maxTasks) {
      skipped.push({ task: status.task, reason: `wave is full (${limits.maxTasks} at once)` });
      continue;
    }
    const lane = status.task.lane;
    if (!lane) continue; // unreachable: runBlockers already caught it
    const running = laneCount.get(lane) ?? 0;
    if (running >= limits.maxPerLane) {
      skipped.push({ task: status.task, reason: `lane \`${lane}\` is busy` });
      continue;
    }
    laneCount.set(lane, running + 1);
    wave.push(status);
  }
  return { wave, skipped };
}

/**
 * §16.4 step 1 and §16.5, for `--task <id>`: why the driver will not run it,
 * or `null` when it will.
 */
export function refusalFor(statuses: readonly TaskStatus[], id: string): string | null {
  const status = statuses.find((candidate) => candidate.task.id.toLowerCase() === id.toLowerCase());
  if (!status) return `${id} is not a task in TASKS.md.`;
  const { task, state, missingDeps, blockers, pr } = status;
  if (state === 'merged') return `${task.id} is already checked off on origin/main.`;
  if (state === 'in-review') return `${task.id} has an open PR (#${String(pr)}); merge or close it first.`;
  if (state === 'failed') return `${task.id} left the branch \`${task.branch}\` on origin from an earlier run; delete it before retrying (§16.5).`;
  if (missingDeps.length > 0) return `${task.id} depends on ${missingDeps.join(', ')}, not checked off on origin/main.`;
  if (blockers.length > 0) return `${task.id} has a breakdown bug: ${blockers.join(', ')} (§16.3).`;
  return null;
}
