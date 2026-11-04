/**
 * PLAN D-1066 (FR-SDD-15): `npm run check`, the quiet check.
 *
 *   npm run check                      # typecheck, lint, unit tests, the affected e2e specs
 *   npm run check -- --base <ref>      # the e2e selection against <ref> (default origin/main)
 *   npm run check -- --no-e2e          # the first three only
 *
 * It runs `tsc -b --pretty false`, `eslint -f json`, `vitest --reporter=json` and, for the specs
 * `scripts/ci-affected.ts` selects from this branch's change against the base (committed or not),
 * a build with the moon flag on and `playwright --reporter=json`. On a failure it prints each
 * failure's name, first assertion and five stack lines, then the counts; on success, one line with
 * the counts passed and the warnings per tool. The exit status is the run's.
 *
 * `npm test`, `npm run lint` and the rest stay as they are, for CI and for people.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNameStatus, readerTests, select, type Change, type Pick } from './ci-affected';
import { parseEslint, parsePlaywright, parseTsc, parseVitest, stripAnsi, type Failure, type Tool, type ToolResult } from './ci-digest';

/** FR-SDD-15: five lines of stack per failure. */
export const CHECK_STACK_LINES = 5;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One tool's counts, as the closing line shows them. */
export function describeResult(result: ToolResult): string {
  if (result.skippedWhy) return `${result.tool} skipped (${result.skippedWhy})`;
  const failed = result.failed > 0 ? [`${result.failed} failed`] : [];
  switch (result.tool) {
    case 'typecheck':
      return `typecheck ${plural(result.failed, 'error')}`;
    case 'lint':
      return `lint ${[...(result.failed > 0 ? [plural(result.failed, 'error')] : []), `${plural(result.passed, 'file')} clean`, plural(result.warnings, 'warning')].join(', ')}`;
    case 'unit':
      return `unit ${[...failed, `${result.passed} passed`, `${result.skipped} skipped`].join(', ')}`;
    case 'e2e':
      return `e2e ${[...failed, `${result.passed} passed`, `${result.skipped} skipped`, `${result.warnings} flaky`].join(', ')}`;
  }
}

function describeFailure(failure: Failure, stackLines: number): string {
  const lines = [`FAIL ${failure.tool}  ${failure.name}`, ...failure.message.map((line) => `  ${line}`), ...failure.stack.slice(0, stackLines).map((line) => `    ${line}`)];
  return lines.join('\n');
}

/** FR-SDD-15's form: the failures and a closing line, or the one line on success. */
export function formatCheck(results: readonly ToolResult[], stackLines = CHECK_STACK_LINES): string {
  const failures = results.flatMap((result) => result.failures);
  const counts = results.map(describeResult).join(' · ');
  if (failures.length === 0) return `check: ok — ${counts}`;
  return [...failures.map((failure) => describeFailure(failure, stackLines)), '', `check: failed — ${counts}`].join('\n');
}

const tail = (text: string, lines = 5): string[] =>
  stripAnsi(text)
    .trimEnd()
    .split('\n')
    .slice(-lines)
    .map((line) => line.trimEnd());

/** A tool that exited without the report it was asked for (a config error, a crash). */
const noReport = (tool: Tool, output: string): ToolResult => ({
  tool,
  passed: 0,
  failed: 1,
  skipped: 0,
  warnings: 0,
  failures: [{ tool, name: `${tool} wrote no report`, message: tail(output), stack: [] }],
});

interface Run {
  status: number;
  output: string;
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv = {}): Run {
  const child = spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 512 * 1024 * 1024 });
  return { status: child.status ?? 1, output: `${child.stdout ?? ''}${child.stderr ?? ''}${child.error ? String(child.error) : ''}` };
}

const readJson = <T>(path: string): T | undefined => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : undefined);

/** This branch's change against `base`: the merge base to the working tree, untracked files included. */
export function localChanges(base: string): Change[] {
  const git = (args: readonly string[]): string => execFileSync('git', args, { encoding: 'utf8' });
  const from = git(['merge-base', base, 'HEAD']).trim();
  const changes = parseNameStatus(git(['diff', '--name-status', '-M', from]));
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .map((path) => ({ path, deleted: false }));
  return [...changes, ...untracked];
}

/** The specs `ci-affected.ts` picks for this change; every spec when there is no diff to read (no base ref). */
function e2eSelection(base: string, root: string): Pick {
  try {
    return select(localChanges(base), readerTests(root)).e2e;
  } catch {
    return 'all';
  }
}

function runE2e(pick: Pick, dir: string, root: string): ToolResult {
  if (pick !== 'all' && pick.length === 0) return { tool: 'e2e', passed: 0, failed: 0, skipped: 0, warnings: 0, failures: [], skippedWhy: 'no spec affected' };
  // FR-FLAG-2 (D-183): the e2e build is the one with the moon flag on, as `npm run e2e` and CI build it.
  const build = run('npx', ['vite', 'build'], { VITE_MOON_LORE: 'on' });
  if (build.status !== 0) return { tool: 'e2e', passed: 0, failed: 1, skipped: 0, warnings: 0, failures: [{ tool: 'e2e', name: 'vite build', message: tail(build.output), stack: [] }] };
  const report = join(dir, 'playwright.json');
  const specs = pick === 'all' ? [] : [...pick];
  const e2e = run('npx', ['playwright', 'test', '--reporter=json', ...specs], { PLAYWRIGHT_JSON_OUTPUT_NAME: report });
  const parsed = readJson<Parameters<typeof parsePlaywright>[0]>(report);
  return parsed ? parsePlaywright(parsed, root) : noReport('e2e', e2e.output);
}

export function runCheck(options: { base: string; e2e: boolean; root: string }): ToolResult[] {
  const dir = mkdtempSync(join(tmpdir(), 'check-'));
  const results: ToolResult[] = [];

  const tsc = run('npx', ['tsc', '-b', '--pretty', 'false']);
  const typecheck = parseTsc(tsc.output, options.root);
  results.push(tsc.status !== 0 && typecheck.failed === 0 ? noReport('typecheck', tsc.output) : typecheck);

  const eslintReport = join(dir, 'eslint.json');
  const eslint = run('npx', ['eslint', '.', '-f', 'json', '-o', eslintReport]);
  const lint = readJson<Parameters<typeof parseEslint>[0]>(eslintReport);
  results.push(lint ? parseEslint(lint, options.root) : noReport('lint', eslint.output));

  const vitestReport = join(dir, 'vitest.json');
  const vitest = run('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${vitestReport}`]);
  const unit = readJson<Parameters<typeof parseVitest>[0]>(vitestReport);
  results.push(unit ? parseVitest(unit, options.root) : noReport('unit', vitest.output));

  if (!options.e2e) results.push({ tool: 'e2e', passed: 0, failed: 0, skipped: 0, warnings: 0, failures: [], skippedWhy: '--no-e2e' });
  else results.push(runE2e(e2eSelection(options.base, options.root), dir, options.root));
  return results;
}

export function parseArgs(argv: readonly string[]): { base: string; e2e: boolean } {
  const options = { base: 'origin/main', e2e: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--no-e2e') options.e2e = false;
    else if (arg === '--base' && argv[i + 1]) options.base = argv[(i += 1)] ?? options.base;
    else throw new Error(`unknown argument ${arg ?? ''}; usage: npm run check -- [--base <ref>] [--no-e2e]`);
  }
  return options;
}

function main(argv: readonly string[]): void {
  const results = runCheck({ ...parseArgs(argv), root: process.cwd() });
  console.log(formatCheck(results));
  process.exitCode = results.some((result) => result.failed > 0) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
