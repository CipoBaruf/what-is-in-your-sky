/**
 * PLAN D-1067 (FR-SDD-16): the failure digest, on reports recorded from real Vitest, Playwright,
 * ESLint and tsc runs (`tests/sdd/fixtures/check/`, paths rewritten under `/repo`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { failedJobs, FAILURE_DIGEST_MAX_KB, parseEslint, parsePlaywright, parseTsc, parseVitest, readReports, writeDigest, type Failure, type ToolResult } from '../../scripts/ci-digest';

const ROOT = '/repo';
const FIXTURES = 'tests/sdd/fixtures/check';
const fixture = (name: string): string => readFileSync(`${FIXTURES}/${name}`, 'utf8');
const json = <T>(name: string): T => JSON.parse(fixture(name)) as T;

describe('the report readers', () => {
  it('reads a failing Vitest run: each failed test with its path, titles, assertion and own frames, and a file that failed to load', () => {
    const unit = parseVitest(json('vitest-fail.json'), ROOT);
    expect(unit).toMatchObject({ tool: 'unit', passed: 2, failed: 3, skipped: 1 });
    expect(unit.failures.map((failure) => failure.name)).toEqual([
      'tests/sample/broken.test.ts',
      'tests/sample/sample.test.ts > the sample > parses a number',
      'tests/sample/sample.test.ts > the sample > nested > matches an object',
    ]);
    const [broken, parses] = unit.failures;
    expect(broken?.message[0]).toContain("Cannot find module './does-not-exist'");
    expect(parses?.message).toEqual(['AssertionError: expected 41 to be 42 // Object.is equality']);
    // Only this repository's frames, relative: Vitest's runner and Node's internals are dropped.
    expect(parses?.stack).toEqual(['at tests/sample/sample.test.ts:8:25']);
  });

  it('reads a passing Vitest run as no failures', () => {
    expect(parseVitest(json('vitest-pass.json'), ROOT)).toMatchObject({ passed: 1, failed: 0, failures: [] });
  });

  it('reads a failing Playwright run: the unexpected test is a failure, the flaky one a warning, colours stripped', () => {
    const e2e = parsePlaywright(json('playwright-fail.json'), ROOT);
    expect(e2e).toMatchObject({ tool: 'e2e', passed: 2, failed: 1, skipped: 1, warnings: 1 });
    const [failure] = e2e.failures;
    expect(failure?.name).toBe('tests/e2e/sample.spec.ts:6 > the sample page > counts the passes');
    expect(failure?.message).toEqual(['Error: pass count', 'expect(received).toBe(expected) // Object.is equality', 'Expected: 4', 'Received: 3']);
    expect(failure?.stack).toEqual(['at tests/e2e/sample.spec.ts:7:34']);
    expect(parsePlaywright(json('playwright-pass.json'), ROOT)).toMatchObject({ passed: 1, failed: 0 });
  });

  it('reads ESLint errors as failures and counts its warnings', () => {
    const lint = parseEslint(json('eslint-fail.json'), ROOT);
    expect(lint).toMatchObject({ tool: 'lint', passed: 1, failed: 2, warnings: 1 });
    expect(lint.failures[0]).toMatchObject({ name: 'scripts/sample.ts:1:7', message: ["@typescript-eslint/no-unused-vars: 'unused' is assigned a value but never used. Allowed unused vars must match /^_/u."] });
    expect(parseEslint(json('eslint-pass.json'), ROOT)).toMatchObject({ failed: 0, warnings: 0 });
  });

  it('reads tsc errors', () => {
    const typecheck = parseTsc(fixture('tsc-fail.txt'), ROOT);
    expect(typecheck.failures).toEqual([{ tool: 'typecheck', name: 'scripts/sample.ts:6:14', message: ["TS2322: Type 'string' is not assignable to type 'number'."], stack: [] }]);
    expect(parseTsc('', ROOT).failed).toBe(0);
  });
});

describe('the digest (FR-SDD-16)', () => {
  it('names the failed jobs, each failing test and its first error, from a recorded Playwright and Vitest failure', () => {
    const digest = writeDigest({
      results: [parseVitest(json('vitest-fail.json'), ROOT), parsePlaywright(json('playwright-fail.json'), ROOT)],
      logs: [],
      failedJobs: ['ci'],
      runUrl: 'https://github.com/o/r/actions/runs/1',
    });
    expect(digest).toContain('Failed jobs: ci');
    expect(digest).toContain('## unit (3 failed)');
    expect(digest).toContain('- `tests/sample/sample.test.ts > the sample > parses a number`\n  AssertionError: expected 41 to be 42 // Object.is equality\n  at tests/sample/sample.test.ts:8:25');
    expect(digest).toContain('## e2e (1 failed)');
    expect(digest).toContain('- `tests/e2e/sample.spec.ts:6 > the sample page > counts the passes`\n  Error: pass count\n  expect(received).toBe(expected)');
    expect(Buffer.byteLength(digest)).toBeLessThanOrEqual(FAILURE_DIGEST_MAX_KB * 1024);
  });

  it(`stays within FAILURE_DIGEST_MAX_KB (${FAILURE_DIGEST_MAX_KB}) however many tests failed, and says how many it left out`, () => {
    const unit = parseVitest(json('vitest-fail.json'), ROOT);
    const many: ToolResult = { ...unit, failed: 400, failures: Array.from({ length: 400 }, (_, i) => ({ ...(unit.failures[1] as Failure), name: `tests/sample/sample.test.ts > case ${i}` })) };
    const digest = writeDigest({ results: [many], logs: [{ job: 'trailers', text: 'x\n'.repeat(500) }], failedJobs: ['ci', 'trailers'] });
    expect(Buffer.byteLength(digest)).toBeLessThanOrEqual(FAILURE_DIGEST_MAX_KB * 1024);
    const shown = (digest.match(/^- `/gm) ?? []).length;
    expect(shown).toBeGreaterThan(10);
    // The 400 tests and the log that did not fit.
    expect(digest).toContain(`… ${400 - shown + 1} more not shown`);
  });

  it('reads a downloaded reports directory and quotes the log of a failed job only', () => {
    const input = readReports(FIXTURES, ROOT, ['ci']);
    expect(input.results.map((result) => result.tool).sort()).toEqual(['e2e', 'e2e', 'lint', 'lint', 'unit', 'unit']);
    // `tsc-fail.txt` is a log, not `typecheck.txt`, and no job of that name failed.
    expect(input.logs).toEqual([]);
    const digest = writeDigest(input);
    expect(Buffer.byteLength(digest)).toBeLessThanOrEqual(FAILURE_DIGEST_MAX_KB * 1024);
    expect(digest).toContain('## lint (2 failed)');
  });

  it('takes the failed jobs from the workflow’s needs', () => {
    expect(failedJobs(JSON.stringify({ changes: { result: 'success' }, build: { result: 'skipped' }, ci: { result: 'failure' }, trailers: { result: 'cancelled' } }))).toEqual(['ci', 'trailers']);
    expect(failedJobs(undefined)).toEqual([]);
  });
});
