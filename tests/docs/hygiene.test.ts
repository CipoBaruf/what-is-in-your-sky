/**
 * R49 (F-16, F-20): the two scratch files that were left in a working tree —
 * a debug script beside the source, and a second Playwright config that
 * hard-coded a port with `reuseExistingServer: true` — are gone, and
 * `.gitignore` names both shapes so the next one never reaches a commit.
 *
 * Like `ci.test.ts`, this is a claim about the repository checked against the
 * repository: what git tracks, and one ignore file. It reads `git ls-files`
 * rather than the directory, so a scratch file `.gitignore` already keeps out
 * of a commit is invisible here too — it is out of everyone's `git status`,
 * which is where an ignored file belongs — and the one that is *not* ignored
 * is the one this fails on.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';

const gitignore = readFileSync('.gitignore', 'utf8');
const lines = gitignore.split('\n').map((line) => line.trim());

/** Every tracked path, relative to the root. */
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((path) => path !== '');
/** The tracked file names directly under `dir` (`.` for the root). */
const trackedIn = (dir: string): string[] => tracked.filter((path) => dirname(path) === dir).map((path) => basename(path));

/** A debug script: `debug-anything`, at the root or in `scripts/`. */
const DEBUG = /^debug[-.]/;
/** A Playwright config that is not the one the repository has: `playwright.local.config.ts`, `playwright-4173.config.ts`. */
const PLAYWRIGHT_CONFIG = /^playwright[-.].+[-.]config\./;
/** The four patterns, as `.gitignore` must spell them: anchored to the root, so they cannot swallow a real file deeper in the tree. */
const PATTERNS = ['/debug-*', '/scripts/debug-*', '/playwright.*.config.*', '/playwright-*.config.*'];

describe('the tracked tree carries no scratch files (F-16, F-20)', () => {
  it('tracks no debug script at the root or in scripts/', () => {
    expect(trackedIn('.').filter((name) => DEBUG.test(name))).toEqual([]);
    expect(trackedIn('scripts').filter((name) => DEBUG.test(name))).toEqual([]);
  });

  it('tracks exactly one Playwright config, the committed one', () => {
    const configs = trackedIn('.').filter((name) => name.startsWith('playwright') && name.includes('config'));
    expect(configs).toEqual(['playwright.config.ts']);
  });

  it('and the committed config never adopts a server it did not start under a driver session (F-20)', () => {
    // The scratch config's real defect: `reuseExistingServer: true` against a
    // fixed port is how one worktree's e2e ends up testing another's build.
    const config = readFileSync('playwright.config.ts', 'utf8');
    expect(config).toMatch(/reuseExistingServer: !process\.env\['CI'\] && !HEADLESS_TASK/);
  });
});

describe('.gitignore names both shapes (F-16, F-20)', () => {
  it('ignores a debug script at the root and in scripts/', () => {
    expect(lines).toContain('/debug-*');
    expect(lines).toContain('/scripts/debug-*');
  });

  it('ignores a second Playwright config', () => {
    expect(lines).toContain('/playwright.*.config.*');
    expect(lines).toContain('/playwright-*.config.*');
  });

  it('anchors each of them to the root: unanchored, `debug-*` would also hide a `src/ui/debug-overlay.tsx`', () => {
    const unanchored = PATTERNS.map((pattern) => pattern.slice(1));
    expect(lines.filter((line) => unanchored.includes(line))).toEqual([]);
  });

  it('still tracks the committed config: no pattern of ours matches its name', () => {
    expect(PLAYWRIGHT_CONFIG.test('playwright.config.ts')).toBe(false);
    expect(PLAYWRIGHT_CONFIG.test('playwright.local.config.ts')).toBe(true);
  });
});
