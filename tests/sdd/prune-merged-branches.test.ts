/** FR-SDD-27 (D-1071): the prune script on a fixture repo, with `gh` answered from a list. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planPrune, prune, PROTECTED_BRANCHES, type Run } from '../../scripts/prune-merged-branches';

const git = (cwd: string, ...args: string[]): string => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

interface Fixture {
  repo: string;
  exec: (merged: string[], open: string[]) => Run;
}

function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'prune-'));
  const origin = join(root, 'origin.git');
  const repo = join(root, 'repo');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  git(repo, 'config', 'user.email', 't@example.com');
  git(repo, 'config', 'user.name', 't');
  git(repo, 'remote', 'add', 'origin', origin);
  writeFileSync(join(repo, 'a.txt'), 'a');
  git(repo, 'add', 'a.txt');
  git(repo, 'commit', '-q', '-m', 'first');
  for (const branch of [...PROTECTED_BRANCHES.filter((name) => name !== 'main'), 'r1-merged', 'r2-open', 'r3-unmerged', 'r4-moved']) git(repo, 'branch', branch);
  git(repo, 'worktree', 'add', '-q', join(root, 'wt-r1'), 'r1-merged');
  git(repo, 'push', '-q', 'origin', '--all');
  const sha = (branch: string): string => git(repo, 'rev-parse', branch);
  const exec =
    (merged: string[], open: string[]): Run =>
    (file, args) => {
      if (file === 'gh') {
        const rows = args.includes('merged') ? merged : open;
        return JSON.stringify(rows.map((headRefName) => ({ headRefName, headRefOid: headRefName === 'r4-moved' ? 'f'.repeat(40) : sha(headRefName) })));
      }
      return execFileSync(file, args, { cwd: repo, encoding: 'utf8' });
    };
  return { repo, exec };
}

describe('FR-SDD-27: prune-merged-branches', () => {
  it('FR-SDD-27: deletes only merged branches, and never a protected one, an open PR or a moved branch', () => {
    const { repo, exec } = fixture();
    const merged = ['r1-merged', 'r2-open', 'r4-moved', ...PROTECTED_BRANCHES];
    const out = prune(exec(merged, ['r2-open']), false);
    expect(out.join('\n')).toContain('delete local branch r1-merged');
    const local = git(repo, 'branch', '--format=%(refname:short)').split('\n');
    expect(local).not.toContain('r1-merged');
    expect(local).toEqual(expect.arrayContaining(['main', 'release', 'captures', 'archive', 'r2-open', 'r3-unmerged', 'r4-moved']));
    const remote = git(repo, 'ls-remote', '--heads', 'origin');
    expect(remote).not.toContain('refs/heads/r1-merged');
    for (const kept of ['main', 'release', 'captures', 'archive', 'r2-open', 'r3-unmerged', 'r4-moved']) expect(remote).toContain(`refs/heads/${kept}`);
    expect(existsSync(join(repo, '..', 'wt-r1'))).toBe(false);
  });

  it('FR-SDD-27: --dry-run prints and changes nothing', () => {
    const { repo, exec } = fixture();
    const out = prune(exec(['r1-merged'], []), true);
    expect(out).toEqual(['would remove worktree ' + git(repo, 'worktree', 'list', '--porcelain').split('\n').find((l) => l.includes('wt-r1'))?.slice('worktree '.length), 'would delete local branch r1-merged', 'would delete remote branch r1-merged']);
    expect(git(repo, 'branch', '--format=%(refname:short)')).toContain('r1-merged');
    expect(git(repo, 'ls-remote', '--heads', 'origin')).toContain('refs/heads/r1-merged');
  });

  it('FR-SDD-27: keeps the branch the script runs on', () => {
    const plan = planPrune({ merged: [{ branch: 'r9' }], openBranches: new Set(), local: new Map([['r9', 'a']]), remote: new Map(), worktrees: new Map(), current: 'r9' });
    expect(plan.actions).toEqual([]);
  });
});
