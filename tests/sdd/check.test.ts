/**
 * PLAN D-1066 (FR-SDD-15): `npm run check` prints the failures, or one line on success. The formatter
 * runs on reports recorded from real Vitest, Playwright, ESLint and tsc runs (`tests/sdd/fixtures/check/`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHECK_STACK_LINES, formatCheck, parseArgs } from '../../scripts/check';
import { parseEslint, parsePlaywright, parseTsc, parseVitest, type ToolResult } from '../../scripts/ci-digest';

const ROOT = '/repo';
const fixture = (name: string): string => readFileSync(`tests/sdd/fixtures/check/${name}`, 'utf8');
const json = <T>(name: string): T => JSON.parse(fixture(name)) as T;

const failing = (): ToolResult[] => [
  parseTsc(fixture('tsc-fail.txt'), ROOT),
  parseEslint(json('eslint-fail.json'), ROOT),
  parseVitest(json('vitest-fail.json'), ROOT),
  parsePlaywright(json('playwright-fail.json'), ROOT),
];
const passing = (): ToolResult[] => [parseTsc('', ROOT), parseEslint(json('eslint-pass.json'), ROOT), parseVitest(json('vitest-pass.json'), ROOT), parsePlaywright(json('playwright-pass.json'), ROOT)];

describe('npm run check (FR-SDD-15)', () => {
  it('on success prints one line: the counts passed and the warnings per tool', () => {
    const out = formatCheck(passing());
    expect(out.split('\n')).toHaveLength(1);
    expect(out).toBe('check: ok — typecheck 0 errors · lint 1 file clean, 0 warnings · unit 1 passed, 0 skipped · e2e 1 passed, 0 skipped, 0 flaky');
  });

  it('on failure prints each failure: the test name, the first assertion and the stack', () => {
    const out = formatCheck(failing());
    expect(out).toContain("FAIL typecheck  scripts/sample.ts:6:14\n  TS2322: Type 'string' is not assignable to type 'number'.");
    expect(out).toContain('FAIL lint  scripts/sample.ts:2:27\n  @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.');
    expect(out).toContain('FAIL unit  tests/sample/sample.test.ts > the sample > parses a number\n  AssertionError: expected 41 to be 42 // Object.is equality\n    at tests/sample/sample.test.ts:8:25');
    expect(out).toContain('FAIL e2e  tests/e2e/sample.spec.ts:6 > the sample page > counts the passes\n  Error: pass count\n');
    // No runner frames, no colour codes, no passing test's name.
    expect(out).not.toMatch(/node_modules|node:internal/);
    expect(out).not.toContain(String.fromCharCode(27));
    expect(out).not.toContain('adds');
    expect(out.split('\n').at(-1)).toBe('check: failed — typecheck 1 error · lint 2 errors, 1 file clean, 1 warning · unit 3 failed, 2 passed, 1 skipped · e2e 1 failed, 2 passed, 1 skipped, 1 flaky');
  });

  it('cuts each stack to five lines', () => {
    expect(CHECK_STACK_LINES).toBe(5);
    const frames = Array.from({ length: 9 }, (_, i) => `at src/lib/f.ts:${i + 1}:1`);
    const result: ToolResult = { tool: 'unit', passed: 0, failed: 1, skipped: 0, warnings: 0, failures: [{ tool: 'unit', name: 'a > b', message: ['Error: x'], stack: frames }] };
    const out = formatCheck([result]);
    expect(out).toContain('at src/lib/f.ts:5:1');
    expect(out).not.toContain('at src/lib/f.ts:6:1');
  });

  it('says why a tool did not run', () => {
    const results = [...passing().slice(0, 3), { tool: 'e2e', passed: 0, failed: 0, skipped: 0, warnings: 0, failures: [], skippedWhy: 'no spec affected' } satisfies ToolResult];
    expect(formatCheck(results)).toMatch(/· e2e skipped \(no spec affected\)$/);
  });

  it('takes --base and --no-e2e and refuses anything else', () => {
    expect(parseArgs([])).toEqual({ base: 'origin/main', e2e: true });
    expect(parseArgs(['--base', 'main', '--no-e2e'])).toEqual({ base: 'main', e2e: false });
    expect(() => parseArgs(['--fast'])).toThrow(/usage/);
  });
});
