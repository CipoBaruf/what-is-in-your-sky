/**
 * R49 (F-16, F-20): the two scratch files that were left in a working tree —
 * a debug script beside the source, and a second Playwright config that
 * hard-coded a port with `reuseExistingServer: true` — are gone, and
 * `.gitignore` names both shapes so the next one never reaches a commit.
 *
 * Like `ci.test.ts`, this is a claim about the repository checked against the
 * repository: a directory listing and one ignore file. It cannot see a file
 * that is already ignored, which is the point — an ignored scratch file is out
 * of everyone's `git status`, and the one that is *not* ignored is the one this
 * fails on.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gitignore = readFileSync('.gitignore', 'utf8');
const lines = gitignore.split('\n').map((line) => line.trim());

/** A debug script: `debug-anything`, at the root or in `scripts/`. */
const DEBUG = /^debug[-.]/;
/** A Playwright config that is not the one the repository has: `playwright.local.config.ts`, `playwright-4173.config.ts`. */
const PLAYWRIGHT_CONFIG = /^playwright[-.].+[-.]config\./;

describe('the working tree carries no scratch files (F-16, F-20)', () => {
  it('has no debug script at the root or in scripts/', () => {
    expect(readdirSync('.').filter((name) => DEBUG.test(name))).toEqual([]);
    expect(readdirSync('scripts').filter((name) => DEBUG.test(name))).toEqual([]);
  });

  it('has exactly one Playwright config, the committed one', () => {
    const configs = readdirSync('.').filter((name) => name.startsWith('playwright') && name.includes('config'));
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
    expect(lines).toContain('debug-*');
    expect(lines).toContain('scripts/debug-*');
  });

  it('ignores a second Playwright config', () => {
    expect(lines).toContain('playwright.*.config.*');
    expect(lines).toContain('playwright-*.config.*');
  });

  it('still tracks the committed config: no pattern of ours matches its name', () => {
    expect(PLAYWRIGHT_CONFIG.test('playwright.config.ts')).toBe(false);
    expect(PLAYWRIGHT_CONFIG.test('playwright.local.config.ts')).toBe(true);
  });
});
