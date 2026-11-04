/**
 * FR-PUB-13 (D-377): the branches on `origin` whose pull request is merged,
 * listed — and deleted only when asked in so many words.
 *
 *   npx tsx scripts/prune-merged-branches.ts            # list, delete nothing
 *   npx tsx scripts/prune-merged-branches.ts --delete   # delete the listed ones
 *
 * P1's audit counted 93 branches on `origin`, one per task plus the spec
 * branches (FR-PUB-9). They are noise on the branch page of a public
 * repository, but the ones that are genuinely unmerged are load-bearing: a
 * failed task's branch is how `npm run sdd -- --status` reads the task back as
 * failed, and `--task` refuses to retry until it is gone (PLAN §16.5). So the
 * default is to do nothing and print.
 *
 * **Why the merge test is GitHub's and not git's.** The obvious check is
 * `git branch -r --merged origin/main`, and on this repository it is wrong: it
 * calls 20 branches merged and 74 unmerged, when GitHub has 103 merged pull
 * requests. Every pull request here is squash-merged (PLAN §16.4 step 8,
 * `gh pr merge --squash`), and a squash writes a *new* commit onto `main` with
 * a new tree and no link to the branch it came from — so the branch tip is
 * never an ancestor of `main` and reachability can never see it. Using that
 * test would have left ninety dead branches in place while reporting them as
 * unmerged, which is the safe direction to be wrong in and still useless.
 *
 * The record that a branch was merged lives in GitHub, so that is what is
 * asked: a branch is deletable when a **merged** pull request has it as its
 * head, no **open** pull request does, and it is not protected.
 *
 * FR-SDD-27 (D-1071), R180: the driver also clears the local side. `prune()`
 * deletes a merged PR's local branch, remote branch and worktree, and keeps a
 * branch whose tip is not the head its PR merged (commits made after the
 * merge). `--dry-run` runs it and prints only; `--delete` is the old
 * remote-only deletion.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PROTECTED_BRANCHES: readonly string[] = ['main', 'release', 'captures', 'archive'];

/** Never deleted, whatever anything else says. */
export const PROTECTED = new Set(['HEAD', ...PROTECTED_BRANCHES]);

/** `git branch -r` output → the branch names on `origin`, without the remote prefix. */
export function parseBranches(out: string): string[] {
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.includes('->'))
    .map((line) => line.replace(/^origin\//, ''))
    .filter((name) => !PROTECTED.has(name));
}

/**
 * Which of `branches` may be deleted. Pure, so the rule is tested without a
 * network: deletable = a merged pull request's head, not an open one's, not
 * protected. A branch nobody ever opened a pull request for is left alone —
 * it is someone's work in progress, not a leftover.
 */
export function deletable(branches: readonly string[], mergedHeads: readonly string[], openHeads: readonly string[]): string[] {
  const merged = new Set(mergedHeads);
  const open = new Set(openHeads);
  return branches.filter((name) => !PROTECTED.has(name) && merged.has(name) && !open.has(name));
}

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
  actions: { kind: 'worktree' | 'local' | 'remote'; branch: string; dir?: string }[];
}

/** Which branches go, from the facts alone. */
export function planPrune(facts: PruneFacts): PrunePlan {
  const branches: string[] = [];
  const actions: PrunePlan['actions'] = [];
  const done = new Set<string>();
  for (const pr of facts.merged) {
    const name = pr.branch;
    if (done.has(name) || PROTECTED.has(name) || facts.openBranches.has(name) || name === facts.current) continue;
    done.add(name);
    const local = facts.local.get(name);
    const remote = facts.remote.get(name);
    // A tip that is not the merged head means commits after the merge: leave the branch alone.
    const moved = (tip: string | undefined): boolean => pr.sha !== undefined && tip !== undefined && tip !== pr.sha;
    const keepLocal = local === undefined || moved(local);
    const keepRemote = remote === undefined || moved(remote);
    if (keepLocal && keepRemote) continue;
    branches.push(name);
    const dir = facts.worktrees.get(name);
    if (dir !== undefined && !keepLocal) actions.push({ kind: 'worktree', branch: name, dir });
    if (!keepLocal) actions.push({ kind: 'local', branch: name });
    if (!keepRemote) actions.push({ kind: 'remote', branch: name });
  }
  return { branches, actions };
}

export type Run = (file: string, args: readonly string[]) => string;

export const run: Run = (file, args) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });

const lines = (text: string): string[] => text.split('\n').filter((line) => line.trim() !== '');

interface GhPr {
  headRefName: string;
  headRefOid?: string;
}

/** Everything the plan needs, read through `run` (git in the current directory, gh for the PRs). */
export function readFacts(exec: Run): PruneFacts {
  const prs = (state: string): GhPr[] => JSON.parse(exec('gh', ['pr', 'list', '--state', state, '--json', 'headRefName,headRefOid', '--limit', '500'])) as GhPr[];
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

const git = (args: readonly string[]): string => execFileSync('git', [...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const heads = (state: 'merged' | 'open'): string[] =>
  execFileSync('gh', ['pr', 'list', '--state', state, '--limit', '500', '--json', 'headRefName', '-q', '.[].headRefName'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

function main(argv: readonly string[]): number {
  execFileSync('git', ['fetch', 'origin', '--prune'], { stdio: 'inherit' });
  if (argv.includes('--dry-run')) {
    for (const line of prune(run, true)) console.log(line);
    return 0;
  }
  const branches = parseBranches(git(['branch', '-r', '--list', 'origin/*']));
  const mergedHeads = heads('merged');
  const openHeads = heads('open');
  const dead = deletable(branches, mergedHeads, openHeads);
  const kept = branches.filter((name) => !dead.includes(name));

  console.log(`\n${String(dead.length)} of ${String(branches.length)} branches on origin belong to a merged pull request:\n`);
  for (const name of dead) console.log(`  ${name}`);
  console.log(`\n${String(kept.length)} do not, and are never touched by this script:\n`);
  for (const name of kept) console.log(`  ${name}`);

  if (!argv.includes('--delete')) {
    console.log('\nNothing deleted. Re-run with --delete to remove the ones above.');
    return 0;
  }
  if (dead.length === 0) return 0;
  // In batches, because a push with ninety refspecs is one failure for all of them.
  for (let start = 0; start < dead.length; start += 20) {
    execFileSync('git', ['push', 'origin', '--delete', ...dead.slice(start, start + 20)], { stdio: 'inherit' });
  }
  console.log(`\nDeleted ${String(dead.length)} branches.`);
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
