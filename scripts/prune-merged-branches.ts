/**
 * FR-SDD-27 (D-1071): delete the local branch, remote branch and worktree of every merged PR.
 * Never main, release, captures, archive, a branch with an open PR, or a branch that moved since its PR merged.
 * `--dry-run` prints and changes nothing. The driver runs it at the start of each wave.
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PROTECTED_BRANCHES: readonly string[] = ['main', 'release', 'captures', 'archive'];

export interface PullRequestFact {
  /** The PR's head branch. */
  branch: string;
  /** The head commit when the PR merged; a branch that has moved since is somebody's new work. */
  sha?: string;
}

export interface PruneFacts {
  merged: readonly PullRequestFact[];
  openBranches: ReadonlySet<string>;
  local: ReadonlyMap<string, string>;
  remote: ReadonlyMap<string, string>;
  /** Worktree directory by branch, the main checkout included. */
  worktrees: ReadonlyMap<string, string>;
  /** The branch checked out where the script runs: kept. */
  current: string | null;
}

export interface PrunePlan {
  branches: string[];
  /** Only the branches that exist locally, on origin, or in a worktree get an action. */
  actions: { kind: 'worktree' | 'local' | 'remote'; branch: string; dir?: string }[];
}

/** Which branches go, from the facts alone. */
export function planPrune(facts: PruneFacts): PrunePlan {
  const branches: string[] = [];
  const actions: PrunePlan['actions'] = [];
  const done = new Set<string>();
  for (const pr of facts.merged) {
    const name = pr.branch;
    if (done.has(name) || PROTECTED_BRANCHES.includes(name) || facts.openBranches.has(name) || name === facts.current) continue;
    done.add(name);
    const local = facts.local.get(name);
    const remote = facts.remote.get(name);
    // A tip that is not the merged head means commits after the merge: leave the branch alone.
    const moved = (tip: string | undefined): boolean => pr.sha !== undefined && tip !== undefined && tip !== pr.sha;
    const dir = facts.worktrees.get(name);
    const keepLocal = local === undefined || moved(local);
    const keepRemote = remote === undefined || moved(remote);
    if (keepLocal && keepRemote) continue;
    branches.push(name);
    if (dir !== undefined && !keepLocal) actions.push({ kind: 'worktree', branch: name, dir });
    if (!keepLocal) actions.push({ kind: 'local', branch: name });
    if (!keepRemote) actions.push({ kind: 'remote', branch: name });
  }
  return { branches, actions };
}

export type Run = (file: string, args: readonly string[]) => string;

export const run: Run = (file, args) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const lines = (text: string): string[] => text.split('\n').filter((line) => line.trim() !== '');

interface GhPr {
  headRefName: string;
  headRefOid?: string;
}

/** Everything the plan needs, read through `run` (git in the current directory, gh for the PRs). */
export function readFacts(exec: Run): PruneFacts {
  const prs = (state: string): GhPr[] => JSON.parse(exec('gh', ['pr', 'list', '--state', state, '--json', 'headRefName,headRefOid', '--limit', '300'])) as GhPr[];
  const local = new Map<string, string>();
  for (const line of lines(exec('git', ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads']))) {
    const [name = '', sha = ''] = line.split(' ');
    local.set(name, sha);
  }
  const remote = new Map<string, string>();
  for (const line of lines(exec('git', ['ls-remote', '--heads', 'origin']))) {
    const [sha = '', ref = ''] = line.split(/\s+/);
    remote.set(ref.replace(/^refs\/heads\//, ''), sha);
  }
  const worktrees = new Map<string, string>();
  let dir = '';
  for (const line of lines(exec('git', ['worktree', 'list', '--porcelain']))) {
    if (line.startsWith('worktree ')) dir = line.slice('worktree '.length);
    else if (line.startsWith('branch ')) worktrees.set(line.slice('branch refs/heads/'.length), dir);
  }
  const current = exec('git', ['branch', '--show-current']).trim();
  return {
    merged: prs('merged').map((pr) => ({ branch: pr.headRefName, ...(pr.headRefOid ? { sha: pr.headRefOid } : {}) })),
    openBranches: new Set(prs('open').map((pr) => pr.headRefName)),
    local,
    remote,
    worktrees,
    current: current === '' ? null : current,
  };
}

/** Carry the plan out; one failure (a dirty worktree) is reported and does not stop the rest. Returns the lines printed. */
export function prune(exec: Run, dryRun: boolean): string[] {
  const out: string[] = [];
  const plan = planPrune(readFacts(exec));
  for (const action of plan.actions) {
    const what = action.kind === 'worktree' ? `remove worktree ${action.dir ?? ''}` : action.kind === 'local' ? `delete local branch ${action.branch}` : `delete remote branch ${action.branch}`;
    if (dryRun) {
      out.push(`would ${what}`);
      continue;
    }
    try {
      if (action.kind === 'worktree') exec('git', ['worktree', 'remove', action.dir ?? '']);
      else if (action.kind === 'local') exec('git', ['branch', '-D', action.branch]);
      else exec('git', ['push', 'origin', '--delete', action.branch]);
      out.push(what);
    } catch (error) {
      out.push(`could not ${what}: ${(error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''}`);
    }
  }
  if (plan.actions.length === 0) out.push('nothing to prune');
  return out;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const line of prune(run, process.argv.includes('--dry-run'))) process.stdout.write(`${line}\n`);
}
