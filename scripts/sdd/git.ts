/**
 * PLAN §16.4: every git and `gh` call the driver makes. The implementation
 * sessions make none of these — a session may not push and may not call `gh`
 * (§16.4 step 4), so a confused session cannot publish anything.
 *
 * Arguments are always an argv array, never a shell string.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COMMIT_TITLE_MAX } from './limits';
import { resolveSharedConflicts, type ResolveIo } from './resolve';
import { consoleLogger, LOG_DIR, stamp, type Logger } from './report';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  logger?: Logger;
  /** Stream stdout to the log as it arrives (the CI watch prints for minutes). */
  stream?: boolean;
  /** Kill the command after this long; the result's code is 124. */
  timeoutMs?: number;
}

/** Runs one command to completion and returns its exit code and output. */
function exec(file: string, args: readonly string[], options: ExecOptions = {}): Promise<ExecResult> {
  const { cwd, env, logger = consoleLogger, stream = false, timeoutMs } = options;
  logger.command(file, args, cwd);
  return new Promise((resolve) => {
    const child = spawn(file, [...args], { cwd, env: env ? { ...process.env, ...env } : process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer =
      timeoutMs === undefined
        ? null
        : setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
          }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stream) logger.raw(chunk.toString());
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stream) logger.raw(chunk.toString());
    });
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      logger.raw(`exit ${String(code ?? -1)}: ${file} ${args.join(' ')}\n`);
      // A failed call's stderr, when it was not streamed: the log is the only place it shows (a CI runner's git refusing to commit, say).
      if (code !== 0 && !stream && stderr.trim()) logger.raw(`${stderr.trim().slice(-1000)}\n`);
      resolve({ code: timedOut ? 124 : (code ?? -1), stdout, stderr });
    });
  });
}

const git = (args: readonly string[], options?: ExecOptions): Promise<ExecResult> => exec('git', args, options);
const gh = (args: readonly string[], options?: ExecOptions): Promise<ExecResult> => exec('gh', args, options);

const ok = (result: ExecResult): boolean => result.code === 0;

/** §16.4 step 1. */
export async function fetchOrigin(logger: Logger): Promise<void> {
  const result = await git(['fetch', 'origin', '--prune'], { logger });
  if (!ok(result)) throw new Error(`git fetch origin failed: ${result.stderr.trim()}`);
}

/** §16.2: TASKS.md as `origin/main` has it, never the working copy. */
export async function readTasksAtRef(ref: string, logger: Logger): Promise<string> {
  const result = await git(['show', `${ref}:TASKS.md`], { logger });
  if (!ok(result)) throw new Error(`cannot read TASKS.md at ${ref}: ${result.stderr.trim()}`);
  return result.stdout;
}

/** FR-SDD-7: a file as `ref` has it, or `null` where it has none (a closed phase's tasks.md). */
export async function readFileAtRef(ref: string, path: string, logger: Logger): Promise<string | null> {
  const result = await git(['show', `${ref}:${path}`], { logger });
  return ok(result) ? result.stdout : null;
}

/** The files under `dir` on `ref`, in one `git ls-tree`; empty where the ref or the directory is missing. */
export async function listFilesAtRef(ref: string, dir: string, logger: Logger): Promise<Set<string>> {
  const result = await git(['ls-tree', '-r', '--name-only', ref, '--', dir], { logger });
  return new Set(ok(result) ? result.stdout.split('\n').filter(Boolean) : []);
}

/** §16.3 `Precondition:`: whether `path` exists on `ref`. */
export async function fileExistsAtRef(ref: string, path: string, logger: Logger): Promise<boolean> {
  return ok(await git(['cat-file', '-e', `${ref}:${path}`], { logger }));
}

/** Branch names on `origin` — the trace a failed run leaves (§16.5). */
export async function remoteBranches(logger: Logger): Promise<Set<string>> {
  const result = await git(['ls-remote', '--heads', 'origin'], { logger });
  if (!ok(result)) throw new Error(`git ls-remote failed: ${result.stderr.trim()}`);
  const names = new Set<string>();
  for (const line of result.stdout.split('\n')) {
    const name = /refs\/heads\/(.+)$/.exec(line.trim())?.[1];
    if (name) names.add(name);
  }
  return names;
}

/** An open PR: its number and its label names (D-1320 reads `needs-owner`). */
export interface OpenPullRequest {
  number: number;
  labels: readonly string[];
}

/** Open PRs by head branch. */
export async function openPullRequests(logger: Logger): Promise<Map<string, OpenPullRequest>> {
  const result = await gh(['pr', 'list', '--state', 'open', '--json', 'number,headRefName,labels', '--limit', '100'], { logger });
  const byBranch = new Map<string, OpenPullRequest>();
  if (!ok(result)) {
    logger.line(`  (gh pr list failed, treating the remote as having no open PRs: ${result.stderr.trim().split('\n')[0] ?? ''})`);
    return byBranch;
  }
  const rows = JSON.parse(result.stdout) as { number: number; headRefName: string; labels?: { name: string }[] }[];
  for (const row of rows) byBranch.set(row.headRefName, { number: row.number, labels: (row.labels ?? []).map((label) => label.name) });
  return byBranch;
}

/** D-1320: `git worktree add` for a branch already on origin (an open PR the loop retries with no kept worktree). */
export async function addWorktreeFromRemote(dir: string, branch: string, logger: Logger): Promise<void> {
  const result = await git(['worktree', 'add', '-B', branch, dir, `origin/${branch}`], { logger });
  if (!ok(result)) throw new Error(`git worktree add failed: ${result.stderr.trim()}`);
}

/** §16.4 step 2: a fresh worktree from `origin/main`, never from the current checkout. */
export async function addWorktree(dir: string, branch: string, base: string, logger: Logger): Promise<void> {
  const result = await git(['worktree', 'add', dir, '-b', branch, base], { logger });
  if (!ok(result)) throw new Error(`git worktree add failed: ${result.stderr.trim()}`);
}

/** The branch checked out in `dir`, or `null` when it is not a git worktree. */
export async function branchAt(dir: string, logger: Logger): Promise<string | null> {
  const result = await git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, logger });
  return ok(result) ? result.stdout.trim() : null;
}

/** Paths with staged or unstaged changes in `dir`. */
export async function dirtyFiles(dir: string, logger: Logger): Promise<string[]> {
  const result = await git(['status', '--porcelain'], { cwd: dir, logger });
  return ok(result) ? result.stdout.split('\n').filter(Boolean) : [];
}

export async function removeWorktree(dir: string, logger: Logger): Promise<void> {
  await git(['worktree', 'remove', '--force', dir], { logger });
}

/** §16.4 step 2: `~/.npm` is not writable here, so the cache is project-local. */
export async function installDeps(dir: string, cacheDir: string, logger: Logger): Promise<void> {
  mkdirSync(cacheDir, { recursive: true });
  const result = await exec('npm', ['ci'], { cwd: dir, env: { npm_config_cache: cacheDir }, logger, stream: true });
  if (!ok(result)) throw new Error(`npm ci failed in ${dir}`);
}

/** §16.4 step 4: the branch must actually have commits. */
export async function commitsAhead(dir: string, base: string, logger: Logger): Promise<number> {
  const result = await git(['rev-list', '--count', `${base}..HEAD`], { cwd: dir, logger });
  return ok(result) ? Number.parseInt(result.stdout.trim(), 10) : 0;
}

export async function changedFiles(dir: string, base: string, logger: Logger): Promise<string[]> {
  const result = await git(['diff', '--name-only', `${base}...HEAD`], { cwd: dir, logger });
  return ok(result) ? result.stdout.split('\n').filter(Boolean) : [];
}

/** D-1315: the resolver's git calls and the repo's generators, run in the task's worktree. */
export function gitResolveIo(dir: string, logger: Logger): ResolveIo {
  const npx = (args: readonly string[]): Promise<boolean> => exec('npx', args, { cwd: dir, logger }).then(ok);
  return {
    conflicted: async () => (await git(['diff', '--name-only', '--diff-filter=U'], { cwd: dir, logger })).stdout.split('\n').filter(Boolean),
    checkoutSide: async (path) => ok(await git(['checkout', '--theirs', '--', path], { cwd: dir, logger })) || ok(await git(['checkout', '--ours', '--', path], { cwd: dir, logger })),
    regenerate: async () => (await npx(['tsx', 'scripts/sdd/ids.ts', '--write'])) && (await npx(['tsx', 'scripts/sdd/traceability.ts', '--write'])) && (await npx(['tsx', 'scripts/sdd-map.ts'])),
    regenerateSnapshot: () => npx(['vitest', 'run', 'src/i18n/messages.test.ts', '-u']),
    add: async (paths) => ok(await git(['add', '--', ...paths], { cwd: dir, logger })),
  };
}

/** How many times one rebase may stop on a conflict the resolver settles (one per replayed commit). */
const MAX_RESOLVED_STOPS = 50;

/**
 * §16.4 step 4. D-1315: a conflict only in the shared files (`resolve.ts`) is resolved and the
 * rebase continues; any other conflict aborts it and ends the task as failed (§16.5).
 */
export async function rebaseOnto(dir: string, base: string, logger: Logger, io: ResolveIo = gitResolveIo(dir, logger)): Promise<boolean> {
  let result = await git(['rebase', base], { cwd: dir, logger });
  for (let stops = 0; !ok(result) && stops < MAX_RESOLVED_STOPS; stops += 1) {
    if (!(await resolveSharedConflicts(dir, 'ours', io))) break;
    logger.line('  resolved the shared-file conflict (plan decisions kept on both sides, generated files regenerated; D-1315)');
    result = await git(['-c', 'core.editor=true', 'rebase', '--continue'], { cwd: dir, logger, env: { GIT_EDITOR: 'true' } });
  }
  if (ok(result)) return true;
  await git(['rebase', '--abort'], { cwd: dir, logger });
  return false;
}

/** D-1316: whether `base` is already in HEAD's history, so a merge needs no refresh. */
export async function containsBase(dir: string, base: string, logger: Logger): Promise<boolean> {
  return ok(await git(['merge-base', '--is-ancestor', base, 'HEAD'], { cwd: dir, logger }));
}

/** D-1316: merges `base` into the branch (no force-push needed), the shared files resolved as in a rebase; any other conflict aborts. */
export async function mergeBase(dir: string, base: string, logger: Logger, io: ResolveIo = gitResolveIo(dir, logger)): Promise<boolean> {
  if (ok(await git(['-c', 'core.editor=true', 'merge', '--no-edit', base], { cwd: dir, logger, env: { GIT_EDITOR: 'true' } }))) return true;
  if ((await resolveSharedConflicts(dir, 'theirs', io)) && ok(await git(['-c', 'core.editor=true', 'commit', '--no-edit'], { cwd: dir, logger, env: { GIT_EDITOR: 'true' } }))) {
    logger.line(`  merged ${base} and resolved the shared-file conflict (D-1316)`);
    return true;
  }
  await git(['merge', '--abort'], { cwd: dir, logger });
  return false;
}

export async function push(dir: string, branch: string, logger: Logger): Promise<boolean> {
  return ok(await git(['push', '-u', 'origin', branch], { cwd: dir, logger }));
}

/** D-1320: how a push of a published branch went: pushed, the base merge conflicted outside the shared files, or the push failed. */
export type RefreshOutcome = 'pushed' | 'conflict' | 'push-failed';

/**
 * D-1320: every push of a branch that already has a PR goes through here — after a fix session, before the
 * merge (D-1316) and when GitHub calls the PR conflicting. `base` not in the branch → it is merged in (the
 * D-1315 resolver, main's side first); then the branch is pushed, never forced. The caller fetches first.
 */
export async function pushUpToDate(dir: string, base: string, branch: string, logger: Logger, io: ResolveIo = gitResolveIo(dir, logger)): Promise<{ outcome: RefreshOutcome; merged: boolean }> {
  let merged = false;
  if (!(await containsBase(dir, base, logger))) {
    if (!(await mergeBase(dir, base, logger, io))) return { outcome: 'conflict', merged };
    merged = true;
  }
  return { outcome: (await push(dir, branch, logger)) ? 'pushed' : 'push-failed', merged };
}

/**
 * Bodies go through a file: they carry newlines, backticks and markdown.
 * The path is absolute, because every `gh` call that reads one runs with
 * `cwd` set to the task's worktree while `LOG_DIR` is relative to the
 * driver's own checkout (D-93).
 */
function bodyFile(id: string, kind: string, body: string): string {
  mkdirSync(LOG_DIR, { recursive: true });
  const path = resolve(LOG_DIR, `${id}-${kind}-${stamp()}.md`);
  writeFileSync(path, body);
  return path;
}

/** FR-SDD-20: rewrites a PR's body, so the review session's usage line joins it; a failure is logged and nothing more. */
export async function editPullRequestBody(dir: string, id: string, pr: number, body: string, logger: Logger): Promise<void> {
  const result = await gh(['pr', 'edit', String(pr), '--body-file', bodyFile(id, 'pr', body)], { cwd: dir, logger });
  if (!ok(result)) logger.line(`  gh pr edit failed: ${result.stderr.trim().split('\n')[0] ?? ''}`);
}

/** Room GitHub's squash merge takes after the title: ` (#12345)`. */
const SQUASH_SUFFIX = 9;

/**
 * FR-SDD-20: the PR title is the squash commit's title, so it is cut at a word to leave `COMMIT_TITLE_MAX` room for
 * the ` (#n)` GitHub adds; a task's one-line goal is often longer (R182's merged at 140 characters).
 */
export function pullRequestTitle(title: string): string {
  const max = COMMIT_TITLE_MAX - SQUASH_SUFFIX;
  if (title.length <= max) return title;
  const cut = title.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,:;—-]+$/u, '')}…`;
}

/** §16.4 step 4; returns the PR number. */
export async function createPullRequest(dir: string, id: string, title: string, body: string, logger: Logger): Promise<number | null> {
  const result = await gh(['pr', 'create', '--title', pullRequestTitle(title), '--body-file', bodyFile(id, 'pr', body)], { cwd: dir, logger });
  if (!ok(result)) {
    logger.line(`  gh pr create failed: ${result.stderr.trim().split('\n')[0] ?? ''}`);
    return null;
  }
  const number = /\/pull\/(\d+)/.exec(result.stdout.trim())?.[1];
  return number ? Number.parseInt(number, 10) : null;
}

/** How long to wait for GitHub to register a workflow before watching it, and how often to look (D-98). */
export const CHECKS_APPEAR_TIMEOUT_MS = 5 * 60_000;
export const CHECKS_APPEAR_INTERVAL_MS = 10_000;

const NO_CHECKS = /no checks reported/i;

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

export interface ChecksWaits {
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/**
 * Whether the PR's checks exist yet, from one `gh pr checks` run. The exit code
 * answers where it can: **0** every check finished and passed, **8** some are
 * pending. **1** is three different things — a check failed, the PR has no
 * checks at all, or `gh` could not answer (a 404 from an API still catching up
 * with `gh pr create`, a rate limit, no network) — so it is read further: the
 * "no checks reported" message, and then stdout, which carries the check table
 * when there is one and is empty when `gh` only wrote an error to stderr.
 * Anything that is not an answer counts as "not yet", and the caller keeps
 * polling until its deadline rather than reading a stumble as a verdict.
 */
export function checksExist(result: ExecResult): boolean {
  if (result.code === 0 || result.code === 8) return true;
  if (NO_CHECKS.test(result.stdout) || NO_CHECKS.test(result.stderr)) return false;
  return result.code === 1 && result.stdout.trim() !== ''; // a red check prints its table; a failed call prints nothing
}

/**
 * Polls `exists` until the PR's checks are there, and answers whether they ever
 * were. In the seconds after `gh pr create`, GitHub has not registered the
 * workflow yet and `gh pr checks` exits 1 with "no checks reported on the
 * '<branch>' branch" — the same exit code a red check gets, and one `--watch`
 * does not wait out, so the driver scored a finished task as red (D-98).
 */
export async function waitForChecks(exists: () => Promise<boolean>, waits: ChecksWaits = {}): Promise<boolean> {
  const timeoutMs = waits.timeoutMs ?? CHECKS_APPEAR_TIMEOUT_MS;
  const intervalMs = waits.intervalMs ?? CHECKS_APPEAR_INTERVAL_MS;
  const pause = waits.sleep ?? sleep;
  const clock = waits.now ?? Date.now;
  const deadline = clock() + timeoutMs;
  while (!(await exists())) {
    if (clock() >= deadline) return false;
    await pause(intervalMs);
  }
  return true;
}

/** D-1311: the longest `gh pr checks --watch` may run; a check stuck pending (a Workers Builds outage) ends the task `ci-timeout`. */
export const CHECKS_WATCH_TIMEOUT_MS = 40 * 60_000;

/** D-1311: how one watch of the PR's checks ended. D-1320: `conflicting` — GitHub runs no CI on a PR that conflicts with its base. */
export type ChecksVerdict = 'green' | 'red' | 'timeout' | 'conflicting';

/** `exec`'s 124 is its own kill at `timeoutMs`; every other non-zero exit is a red or unreadable run. */
export const checksVerdict = (result: ExecResult): ChecksVerdict => (result.code === 0 ? 'green' : result.code === 124 ? 'timeout' : 'red');

/** The commit the PR's head points at, or `null` when `gh` cannot say. */
async function pullRequestHead(dir: string, pr: number, logger: Logger): Promise<string | null> {
  const head = await gh(['pr', 'view', String(pr), '--json', 'headRefOid', '--jq', '.headRefOid'], { cwd: dir, logger });
  const sha = head.stdout.trim();
  return ok(head) && sha !== '' ? sha : null;
}

/** D-1320: GitHub's `mergeable` for the PR — `MERGEABLE`, `CONFLICTING` or `UNKNOWN` (still computing) — or `null` when `gh` cannot say. */
async function pullRequestMergeable(dir: string, pr: number, logger: Logger): Promise<string | null> {
  const result = await gh(['pr', 'view', String(pr), '--json', 'mergeable', '--jq', '.mergeable'], { cwd: dir, logger });
  const value = result.stdout.trim();
  return ok(result) && value !== '' ? value : null;
}

/**
 * §16.4 step 5: CI watched to completion; red CI ends the task as failed. D-1311: the watch
 * gives up after `CHECKS_WATCH_TIMEOUT_MS`, and the result carries the head commit read before
 * it, the one the checks ran on (D-1312 merges only that commit).
 */
export async function watchChecks(dir: string, pr: number, logger: Logger, waits: ChecksWaits & { watchMs?: number } = {}): Promise<{ verdict: ChecksVerdict; head: string | null }> {
  // D-1320: while no checks show, ask whether the PR conflicts with its base: then none will ever come.
  let conflicting = false;
  const appeared = await waitForChecks(async () => {
    if (checksExist(await gh(['pr', 'checks', String(pr)], { cwd: dir, logger }))) return true;
    conflicting = (await pullRequestMergeable(dir, pr, logger)) === 'CONFLICTING';
    return conflicting;
  }, waits);
  const head = await pullRequestHead(dir, pr, logger);
  if (conflicting) {
    logger.line(`  PR #${String(pr)} conflicts with its base, so GitHub runs no CI on it (D-1320)`);
    return { verdict: 'conflicting', head };
  }
  if (!appeared) {
    logger.line(`  PR #${String(pr)} reports no checks; treating that as red`);
    return { verdict: 'red', head };
  }
  const watchMs = waits.watchMs ?? CHECKS_WATCH_TIMEOUT_MS;
  const verdict = checksVerdict(await gh(['pr', 'checks', String(pr), '--watch', '--fail-fast'], { cwd: dir, logger, stream: true, timeoutMs: watchMs }));
  if (verdict === 'timeout') logger.line(`  PR #${String(pr)}'s checks were still pending after ${String(Math.round(watchMs / 60_000))} min; giving up on them (D-1311)`);
  return { verdict, head };
}

/** The longest the digest waits for the PR's CI run to finish. */
export const DIGEST_WAIT_MS = 20 * 60_000;

/** The run among `gh run list` rows (newest first) that is the PR head's: same commit and same branch. */
export function runForHead(rows: readonly { databaseId?: number; headSha?: string; headBranch?: string }[], sha: string, branch: string): number | undefined {
  return rows.find((row) => row.headSha === sha && row.headBranch === branch)?.databaseId;
}

/**
 * FR-SDD-16: the `failure-digest` artifact of the CI run on the PR's head
 * commit and branch, or `null` when there is none, the run does not finish
 * within `waitMs` or any call fails. The `digest` job runs after every other
 * job, so this waits for the run to finish first.
 */
export async function failureDigest(dir: string, pr: number, branch: string, logger: Logger, waitMs = DIGEST_WAIT_MS): Promise<string | null> {
  const sha = await pullRequestHead(dir, pr, logger);
  if (sha === null) return null;
  const list = await gh(['run', 'list', '--branch', branch, '--commit', sha, '--workflow', 'ci.yml', '--limit', '20', '--json', 'databaseId,headSha,headBranch'], { cwd: dir, logger });
  let run: number | undefined;
  try {
    run = ok(list) ? runForHead(JSON.parse(list.stdout) as { databaseId?: number; headSha?: string; headBranch?: string }[], sha, branch) : undefined;
  } catch {
    run = undefined;
  }
  if (run === undefined) return null;
  if (!ok(await gh(['run', 'watch', String(run)], { cwd: dir, logger, timeoutMs: waitMs }))) {
    logger.line(`  the CI run ${String(run)} did not finish within ${String(Math.round(waitMs / 60_000))} min, or could not be watched; no digest`);
    return null;
  }
  const out = join(dir, 'sdd-run', 'ci-digest', String(run));
  if (!ok(await gh(['run', 'download', String(run), '--name', 'failure-digest', '--dir', out], { cwd: dir, logger }))) return null;
  const file = join(out, 'failure-digest.md');
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

export async function commentOnPullRequest(dir: string, id: string, pr: number, body: string, logger: Logger): Promise<void> {
  await gh(['pr', 'comment', String(pr), '--body-file', bodyFile(id, 'review', body)], { cwd: dir, logger });
}

/** §16.5: `Gate: owner` PRs are labelled and left open. */
export async function labelPullRequest(dir: string, pr: number, label: string, logger: Logger): Promise<void> {
  await gh(['pr', 'edit', String(pr), '--add-label', label], { cwd: dir, logger });
}

/** D-1312: the squash merge, refused by GitHub when the PR's head is no longer the commit CI and the review saw. */
export const mergeArgs = (pr: number, head: string): string[] => ['pr', 'merge', String(pr), '--squash', '--match-head-commit', head];

export async function mergePullRequest(dir: string, pr: number, head: string, logger: Logger): Promise<boolean> {
  return ok(await gh(mergeArgs(pr, head), { cwd: dir, logger }));
}
