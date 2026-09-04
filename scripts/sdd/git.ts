/**
 * PLAN §16.4: every git and `gh` call the driver makes. The implementation
 * sessions make none of these — a session may not push and may not call `gh`
 * (§16.4 step 4), so a confused session cannot publish anything.
 *
 * Arguments are always an argv array, never a shell string.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { consoleLogger, LOG_DIR, stamp, type Logger } from './report';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  logger?: Logger;
  /** Stream stdout to the log as it arrives (the CI watch prints for minutes). */
  stream?: boolean;
}

/** Runs one command to completion and returns its exit code and output. */
export function exec(file: string, args: readonly string[], options: ExecOptions = {}): Promise<ExecResult> {
  const { cwd, env, logger = consoleLogger, stream = false } = options;
  logger.command(file, args, cwd);
  return new Promise((resolve) => {
    const child = spawn(file, [...args], { cwd, env: env ? { ...process.env, ...env } : process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stream) logger.raw(chunk.toString());
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stream) logger.raw(chunk.toString());
    });
    child.on('error', (error) => {
      resolve({ code: 127, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (code) => {
      logger.raw(`exit ${String(code ?? -1)}: ${file} ${args.join(' ')}\n`);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export const git = (args: readonly string[], options?: ExecOptions): Promise<ExecResult> => exec('git', args, options);
export const gh = (args: readonly string[], options?: ExecOptions): Promise<ExecResult> => exec('gh', args, options);

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

/** Open PRs by head branch. */
export async function openPullRequests(logger: Logger): Promise<Map<string, number>> {
  const result = await gh(['pr', 'list', '--state', 'open', '--json', 'number,headRefName', '--limit', '100'], { logger });
  const byBranch = new Map<string, number>();
  if (!ok(result)) {
    logger.line(`  (gh pr list failed, treating the remote as having no open PRs: ${result.stderr.trim().split('\n')[0] ?? ''})`);
    return byBranch;
  }
  const rows = JSON.parse(result.stdout) as { number: number; headRefName: string }[];
  for (const row of rows) byBranch.set(row.headRefName, row.number);
  return byBranch;
}

/** §16.4 step 2: a fresh worktree from `origin/main`, never from the current checkout. */
export async function addWorktree(dir: string, branch: string, base: string, logger: Logger): Promise<void> {
  const result = await git(['worktree', 'add', dir, '-b', branch, base], { logger });
  if (!ok(result)) throw new Error(`git worktree add failed: ${result.stderr.trim()}`);
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

/** §16.4 step 4. A conflict ends the task as failed (§16.5), so the rebase is aborted first. */
export async function rebaseOnto(dir: string, base: string, logger: Logger): Promise<boolean> {
  const result = await git(['rebase', base], { cwd: dir, logger });
  if (ok(result)) return true;
  await git(['rebase', '--abort'], { cwd: dir, logger });
  return false;
}

export async function push(dir: string, branch: string, logger: Logger): Promise<boolean> {
  return ok(await git(['push', '-u', 'origin', branch], { cwd: dir, logger }));
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

/** §16.4 step 4; returns the PR number. */
export async function createPullRequest(dir: string, id: string, title: string, body: string, logger: Logger): Promise<number | null> {
  const result = await gh(['pr', 'create', '--title', title, '--body-file', bodyFile(id, 'pr', body)], { cwd: dir, logger });
  if (!ok(result)) {
    logger.line(`  gh pr create failed: ${result.stderr.trim().split('\n')[0] ?? ''}`);
    return null;
  }
  const number = /\/pull\/(\d+)/.exec(result.stdout.trim())?.[1];
  return number ? Number.parseInt(number, 10) : null;
}

/** §16.4 step 5: CI watched to completion; red CI ends the task as failed. */
export async function watchChecks(dir: string, pr: number, logger: Logger): Promise<boolean> {
  const result = await gh(['pr', 'checks', String(pr), '--watch', '--fail-fast'], { cwd: dir, logger, stream: true });
  return ok(result);
}

export async function commentOnPullRequest(dir: string, id: string, pr: number, body: string, logger: Logger): Promise<void> {
  await gh(['pr', 'comment', String(pr), '--body-file', bodyFile(id, 'review', body)], { cwd: dir, logger });
}

/** §16.5: `Gate: owner` PRs are labelled and left open. */
export async function labelPullRequest(dir: string, pr: number, label: string, logger: Logger): Promise<void> {
  await gh(['pr', 'edit', String(pr), '--add-label', label], { cwd: dir, logger });
}

export async function mergePullRequest(dir: string, pr: number, logger: Logger): Promise<boolean> {
  return ok(await gh(['pr', 'merge', String(pr), '--squash'], { cwd: dir, logger }));
}
