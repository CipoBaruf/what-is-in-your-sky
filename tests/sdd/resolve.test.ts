/**
 * D-1315, D-1316: the shared-file conflicts a parallel task makes, resolved on a real repository.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { containsBase, gitResolveIo, mergeBase, pushUpToDate, rebaseOnto } from '../../scripts/sdd/git';
import type { Logger } from '../../scripts/sdd/report';
import { sharedKind, unionConflicts, type ResolveIo } from '../../scripts/sdd/resolve';

/** Every line and command output the driver's calls wrote, printed with a failed expectation (CI has no other window on git's stderr). */
const log: string[] = [];
const quiet = { path: null, line: (text: string) => log.push(text), raw: (text: string) => log.push(text), command: (file: string, args: readonly string[]) => log.push(`$ ${file} ${args.join(' ')}`) } as unknown as Logger;
const PLAN = 'docs/sdd/phases/v9/plan.md';
const IDS = 'docs/sdd/ids.md';
let repo = '';

const git = (...args: string[]): string => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
const write = (path: string, text: string): void => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};
const read = (path: string): string => readFileSync(join(repo, path), 'utf8');
const commit = (message: string, files: Record<string, string>): void => {
  for (const [path, text] of Object.entries(files)) write(path, text);
  git('add', '--', ...Object.keys(files));
  git('commit', '-q', '-m', message);
};
/** The real git calls, with a stand-in generator: ids.md lists the plan's D- ids. */
const io = (): ResolveIo => ({
  ...gitResolveIo(repo, quiet),
  regenerate: () => {
    write(IDS, `${[...read(PLAN).matchAll(/D-\d+/g)].map((match) => match[0]).join('\n')}\n`);
    return Promise.resolve(true);
  },
  regenerateSnapshot: () => Promise.resolve(true),
});

/** main and the task branch each append a decision after D-1 and regenerate ids.md. */
function forked(extra: Record<string, string> = {}): void {
  repo = mkdtempSync(join(tmpdir(), 'sdd-resolve-'));
  git('init', '-q', '-b', 'main');
  // The repo's own identity and no editor, hooks or signing: a CI runner has no global git config.
  for (const [key, value] of [['user.name', 't'], ['user.email', 't@t'], ['commit.gpgsign', 'false'], ['core.hooksPath', '/dev/null'], ['init.defaultBranch', 'main']] as const) git('config', key, value);
  commit('base', { [PLAN]: '## Decisions\n\n- **D-1 — one.**\n\nNext section.\n', [IDS]: 'D-1\n', 'src/a.ts': 'a\n' });
  git('checkout', '-q', '-b', 'task');
  commit('task', { [PLAN]: '## Decisions\n\n- **D-1 — one.**\n- **D-3 — the task.**\n\nNext section.\n', [IDS]: 'D-1\nD-3\n', ...extra });
  git('checkout', '-q', 'main');
  commit('sibling', { [PLAN]: '## Decisions\n\n- **D-1 — one.**\n- **D-2 — the sibling.**\n\nNext section.\n', [IDS]: 'D-1\nD-2\n', ...(extra['src/a.ts'] ? { 'src/a.ts': 'main\n' } : {}) });
  git('checkout', '-q', 'task');
}

let remote = '';

/** A bare `origin` holding both branches, as GitHub does once the task's PR is open. */
function published(): void {
  remote = mkdtempSync(join(tmpdir(), 'sdd-origin-'));
  execFileSync('git', ['init', '-q', '--bare', remote]);
  git('remote', 'add', 'origin', remote);
  git('push', '-q', 'origin', 'main', 'task');
}
const remoteHead = (branch: string): string => execFileSync('git', ['rev-parse', branch], { cwd: remote, encoding: 'utf8' }).trim();

afterEach(() => {
  log.length = 0;
  if (repo) rmSync(repo, { recursive: true, force: true });
  if (remote) rmSync(remote, { recursive: true, force: true });
  repo = '';
  remote = '';
});

describe('D-1315: the shared-file resolver', () => {
  it('knows the shared files and nothing else', () => {
    expect([PLAN, IDS, 'docs/sdd/map.md', 'docs/sdd/reference/traceability.md', 'src/i18n/__snapshots__/messages.test.ts.snap'].map(sharedKind)).toEqual(['plan', 'generated', 'generated', 'generated', 'snapshot']);
    expect(sharedKind('PLAN.md')).toBeNull();
    expect(sharedKind('src/a.ts')).toBeNull();
  });

  it("keeps both sides of a hunk, main's first, on either side of the markers, and drops a diff3 base", () => {
    const text = 'x\n<<<<<<< HEAD\nA\n||||||| base\nO\n=======\nB\n>>>>>>> task\ny';
    expect(unionConflicts(text, 'ours')).toBe('x\nA\nB\ny');
    expect(unionConflicts(text, 'theirs')).toBe('x\nB\nA\ny');
    expect(unionConflicts('no conflict', 'ours')).toBeNull();
  });

  it("rebases through a conflicting decision block and generated file: main's row, then the branch's", async () => {
    forked();
    expect(await rebaseOnto(repo, 'main', quiet, io()), log.join('\n')).toBe(true);
    expect(read(PLAN)).toBe('## Decisions\n\n- **D-1 — one.**\n- **D-2 — the sibling.**\n- **D-3 — the task.**\n\nNext section.\n');
    expect(read(IDS)).toBe('D-1\nD-2\nD-3\n');
    expect(await containsBase(repo, 'main', quiet)).toBe(true);
  });

  it('aborts the rebase when any other file conflicts too', async () => {
    forked({ 'src/a.ts': 'task\n' });
    expect(await rebaseOnto(repo, 'main', quiet, io())).toBe(false);
    expect(git('status', '--porcelain')).toBe('');
    expect(read('src/a.ts')).toBe('task\n');
  });
});

describe('D-1316: bringing a published branch up to date by a merge', () => {
  it('merges main in with the same resolution, main first', async () => {
    forked();
    expect(await containsBase(repo, 'main', quiet)).toBe(false);
    expect(await mergeBase(repo, 'main', quiet, io()), log.join('\n')).toBe(true);
    expect(read(PLAN)).toContain('- **D-2 — the sibling.**\n- **D-3 — the task.**');
    expect(read(IDS)).toBe('D-1\nD-2\nD-3\n');
    expect(await containsBase(repo, 'main', quiet)).toBe(true);
  });

  it('aborts the merge on another conflict', async () => {
    forked({ 'src/a.ts': 'task\n' });
    expect(await mergeBase(repo, 'main', quiet, io())).toBe(false);
    expect(git('status', '--porcelain')).toBe('');
  });
});

describe('D-1320: a published branch is pushed only up to date with main', () => {
  it('merges a moved main in, then pushes without force', async () => {
    forked();
    published();
    expect(await pushUpToDate(repo, 'main', 'task', quiet, io()), log.join('\n')).toEqual({ outcome: 'pushed', merged: true });
    expect(remoteHead('task')).toBe(git('rev-parse', 'HEAD').trim());
    expect(git('merge-base', '--is-ancestor', 'main', 'origin/task')).toBe('');
  });

  it('pushes a branch already up to date with no merge', async () => {
    forked();
    git('merge', '-q', '--no-edit', '-X', 'theirs', 'main');
    published();
    commit('fix', { 'src/b.ts': 'fix\n' });
    expect(await pushUpToDate(repo, 'main', 'task', quiet, io())).toEqual({ outcome: 'pushed', merged: false });
    expect(remoteHead('task')).toBe(git('rev-parse', 'HEAD').trim());
  });

  it('pushes nothing when the merge conflicts outside the shared files', async () => {
    forked({ 'src/a.ts': 'task\n' });
    published();
    const before = remoteHead('task');
    expect(await pushUpToDate(repo, 'main', 'task', quiet, io())).toEqual({ outcome: 'conflict', merged: false });
    expect(remoteHead('task')).toBe(before);
    expect(git('status', '--porcelain')).toBe('');
  });
});
