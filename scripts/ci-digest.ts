/**
 * PLAN D-1067 (FR-SDD-16): the failure digest, and the report readers `npm run check` shares (D-1066).
 *
 *   node scripts/ci-digest.ts <reports-dir> <out-file>
 *
 * CI's jobs leave their reports in `reports/`: `typecheck.txt` (`tsc --pretty false`), `eslint.json`,
 * `vitest.json`, `playwright-<shard>.json`, and a plain log for a job that has no JSON reporter
 * (`build.txt`, `trailers.txt`, `dead-code.txt`). The `digest` job downloads them all and this script
 * writes the failing test names and their first errors to `failure-digest.md`, never more than
 * `FAILURE_DIGEST_MAX_KB`. `NEEDS` (the workflow's `toJSON(needs)`) names the failed jobs, and a log
 * is quoted only for a job that failed.
 *
 * Node runs this file as it is (Node 24 strips the types), so the digest job needs no `npm ci`; it
 * imports nothing outside Node, which is also why the readers live here and `check.ts` imports them.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** SPEC §Constants: a fix session reads the failing test names and first errors, not a job log. */
export const FAILURE_DIGEST_MAX_KB = 4;

export type Tool = 'typecheck' | 'lint' | 'unit' | 'e2e';

/** One failing test, lint error or type error. */
export interface Failure {
  tool: Tool;
  name: string;
  /** The first assertion: the error's leading lines, without the stack or a code snippet. */
  message: string[];
  /** Stack frames outside `node_modules` and Node's internals, paths relative to the root. */
  stack: string[];
}

export interface ToolResult {
  tool: Tool;
  /** Tests passed; for lint, the files linted; for the typecheck, unused. */
  passed: number;
  failed: number;
  skipped: number;
  /** Lint warnings; for e2e, the tests that passed only on a retry (flaky). */
  warnings: number;
  failures: Failure[];
  /** Set when the tool did not run, with why (`no spec affected`, `--no-e2e`). */
  skippedWhy?: string;
}

const MESSAGE_LINES = 4;
const LINE_MAX = 240;

// eslint-disable-next-line no-control-regex -- the escape character is what is being matched
const ANSI = /\u001b\[[0-9;]*m/g;
export const stripAnsi = (text: string): string => text.replace(ANSI, '');

const clip = (line: string): string => (line.length > LINE_MAX ? `${line.slice(0, LINE_MAX - 1)}…` : line);

/** A path relative to `root`, with `file://` dropped; a path elsewhere is left as it is. */
export function relativePath(path: string, root: string): string {
  const plain = path.replace(/^file:\/\//, '');
  const base = root.endsWith('/') ? root : `${root}/`;
  return plain.startsWith(base) ? plain.slice(base.length) : plain;
}

const relativeAll = (text: string, root: string): string => text.replaceAll(`file://${root}/`, '').replaceAll(`${root}/`, '');

const FRAME = /^\s*at\s/;
const SNIPPET = /^\s*>?\s*\d+\s*\|/;

/** The error's leading lines: everything before the first frame or code snippet, blank lines dropped. */
export function firstAssertion(text: string, root: string, lines = MESSAGE_LINES): string[] {
  const out: string[] = [];
  for (const raw of stripAnsi(text).split('\n')) {
    if (FRAME.test(raw) || SNIPPET.test(raw)) break;
    const line = raw.trim();
    if (line) out.push(clip(relativeAll(line, root)));
    if (out.length === lines) break;
  }
  return out;
}

/** The frames that point at this repository's code. */
export function ownFrames(text: string, root: string): string[] {
  return stripAnsi(text)
    .split('\n')
    .filter((line) => FRAME.test(line) && !/node_modules|node:internal|<anonymous>/.test(line))
    .map((line) => clip(relativeAll(line.trim(), root)));
}

/** A tool's result with every count at zero, and `fields` over it. */
export const toolResult = (tool: Tool, fields: Partial<ToolResult> = {}): ToolResult => ({ tool, passed: 0, failed: 0, skipped: 0, warnings: 0, failures: [], ...fields });

/** `tsc --pretty false` output: one `file(line,col): error TSnnnn: text` line per error. */
export function parseTsc(text: string, root: string): ToolResult {
  const failures: Failure[] = [];
  for (const line of stripAnsi(text).split('\n')) {
    const match = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line.trim());
    if (match) failures.push({ tool: 'typecheck', name: `${relativePath(match[1] ?? '', root)}:${match[2]}:${match[3]}`, message: [clip(`${match[4]}: ${match[5]}`)], stack: [] });
    else if (/^error TS\d+:/.test(line.trim())) failures.push({ tool: 'typecheck', name: 'tsc', message: [clip(line.trim())], stack: [] });
  }
  return toolResult('typecheck', { failed: failures.length, failures });
}

interface EslintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line?: number;
  column?: number;
}
interface EslintFile {
  filePath: string;
  messages: EslintMessage[];
  errorCount: number;
  warningCount: number;
}

/** `eslint -f json`: an error is a failure, a warning is counted. */
export function parseEslint(files: readonly EslintFile[], root: string): ToolResult {
  const failures: Failure[] = [];
  let warnings = 0;
  for (const file of files) {
    for (const message of file.messages) {
      if (message.severity < 2) {
        warnings += 1;
        continue;
      }
      const at = message.line === undefined ? '' : `:${message.line}:${message.column ?? 0}`;
      failures.push({ tool: 'lint', name: `${relativePath(file.filePath, root)}${at}`, message: [clip(`${message.ruleId ?? 'parse'}: ${message.message}`)], stack: [] });
    }
  }
  return toolResult('lint', { passed: files.filter((file) => file.errorCount === 0).length, failed: failures.length, warnings, failures });
}

interface VitestAssertion {
  ancestorTitles: string[];
  title: string;
  status: string;
  failureMessages: string[];
}
interface VitestFile {
  name: string;
  status: string;
  message: string;
  assertionResults: VitestAssertion[];
}
interface VitestReport {
  success: boolean;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTodoTests?: number;
  testResults: VitestFile[];
}

/** `vitest --reporter=json`: each failed test, and each file that failed before any test ran. */
export function parseVitest(report: VitestReport, root: string): ToolResult {
  const failures: Failure[] = [];
  for (const file of report.testResults) {
    const path = relativePath(file.name, root);
    const failed = file.assertionResults.filter((test) => test.status === 'failed');
    for (const test of failed) {
      const text = test.failureMessages[0] ?? '';
      failures.push({ tool: 'unit', name: [path, ...test.ancestorTitles, test.title].join(' > '), message: firstAssertion(text, root), stack: ownFrames(text, root) });
    }
    if (file.status === 'failed' && failed.length === 0) {
      failures.push({ tool: 'unit', name: path, message: firstAssertion(file.message || 'the file failed with no failing test', root), stack: ownFrames(file.message, root) });
    }
  }
  if (!report.success && failures.length === 0) {
    failures.push({ tool: 'unit', name: 'vitest', message: ['the run failed with no failing test (an unhandled error?): run `npm test` to see it'], stack: [] });
  }
  return toolResult('unit', {
    passed: report.numPassedTests,
    failed: failures.length,
    skipped: report.numPendingTests + (report.numTodoTests ?? 0),
    failures,
  });
}

interface PlaywrightError {
  message?: string;
  stack?: string;
}
interface PlaywrightTest {
  projectName: string;
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  results: { status: string; error?: PlaywrightError; errors?: PlaywrightError[] }[];
}
interface PlaywrightSpec {
  title: string;
  file: string;
  line: number;
  tests: PlaywrightTest[];
}
interface PlaywrightSuite {
  title: string;
  file: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}
interface PlaywrightReport {
  config?: { rootDir?: string };
  suites: PlaywrightSuite[];
  errors?: PlaywrightError[];
}

/** `playwright --reporter=json`: an unexpected test is a failure (its last retry's error), a flaky one a warning. */
export function parsePlaywright(report: PlaywrightReport, root: string): ToolResult {
  const counts = toolResult('e2e');
  const testDir = report.config?.rootDir;
  const specPath = (file: string): string => relativePath(testDir ? join(testDir, file) : file, root);
  const visit = (suite: PlaywrightSuite, titles: string[]): void => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        if (test.status === 'expected') counts.passed += 1;
        else if (test.status === 'skipped') counts.skipped += 1;
        else if (test.status === 'flaky') {
          counts.passed += 1;
          counts.warnings += 1;
        } else {
          const last = test.results.at(-1);
          const error = last?.error ?? last?.errors?.[0] ?? {};
          const project = test.projectName ? ` [${test.projectName}]` : '';
          counts.failures.push({
            tool: 'e2e',
            name: `${[`${specPath(spec.file)}:${spec.line}`, ...titles, spec.title].join(' > ')}${project}`,
            message: firstAssertion(error.message ?? last?.status ?? 'failed', root),
            stack: ownFrames(error.stack ?? '', root),
          });
        }
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...titles, child.title]);
  };
  // A file's own suite is titled with its path, which the spec's `file:line` already says.
  for (const suite of report.suites) visit(suite, []);
  for (const error of report.errors ?? []) {
    counts.failures.push({ tool: 'e2e', name: 'playwright', message: firstAssertion(error.message ?? 'an error outside any test', root), stack: ownFrames(error.stack ?? '', root) });
  }
  counts.failed = counts.failures.length;
  return counts;
}

/** The jobs `toJSON(needs)` reports as failed or cancelled. */
export function failedJobs(needs: string | undefined): string[] {
  if (!needs) return [];
  const parsed = JSON.parse(needs) as Record<string, { result?: string }>;
  return Object.entries(parsed)
    .filter(([, job]) => job.result === 'failure' || job.result === 'cancelled')
    .map(([name]) => name);
}

export interface DigestInput {
  results: ToolResult[];
  /** Plain logs of failed jobs that have no JSON report: job name and text. */
  logs: { job: string; text: string }[];
  failedJobs: string[];
  runUrl?: string;
}

const LOG_TAIL_LINES = 15;

/** The digest, cut to `maxBytes`: whole entries only, and a last line saying how many did not fit. */
export function writeDigest(input: DigestInput, maxBytes = FAILURE_DIGEST_MAX_KB * 1024): string {
  const head = ['# CI failure digest', ''];
  if (input.runUrl) head.push(`Run: ${input.runUrl}`);
  head.push(`Failed jobs: ${input.failedJobs.length ? input.failedJobs.join(', ') : 'unknown'}`, '');

  // A failed job's log tail comes first, cut to a share of the budget, so a red `trailers`, `dead-code`
  // or `build` job is never pushed out by a long list of test failures. A section heading travels with
  // its first entry, so a heading never stands alone.
  const entries: string[] = [];
  const logShare = Math.floor(maxBytes / 4);
  for (const log of input.logs) {
    const tail = stripAnsi(log.text).trimEnd().split('\n').slice(-LOG_TAIL_LINES).map(clip);
    const entry = (): string => `\n## ${log.job} (log tail)\n\n\`\`\`\n${tail.join('\n')}\n\`\`\`\n`;
    while (tail.length > 1 && Buffer.byteLength(entry(), 'utf8') > logShare) tail.shift();
    entries.push(entry());
  }
  for (const tool of input.results) {
    tool.failures.forEach((failure, i) => {
      const lines = [`- \`${failure.name}\``, ...failure.message.slice(0, 2).map((line) => `  ${line}`)];
      if (failure.stack[0]) lines.push(`  ${failure.stack[0]}`);
      const heading = i === 0 ? `\n## ${tool.tool} (${tool.failures.length} failed)\n` : '';
      entries.push(`${heading}${lines.join('\n')}\n`);
    });
  }
  if (entries.length === 0) entries.push('No failing test or log was found in the reports; read the failed jobs above.\n');

  const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');
  const reserve = 96; // the "not shown" line
  let out = `${head.join('\n')}\n`;
  let shown = 0;
  for (const entry of entries) {
    if (bytes(out) + bytes(entry) + reserve > maxBytes) break;
    out += entry;
    shown += 1;
  }
  const hidden = entries.length - shown;
  if (hidden > 0) out += `\n… ${hidden} more not shown (FAILURE_DIGEST_MAX_KB); the job logs have them.\n`;
  return out;
}

/** Reads a downloaded `reports/` directory (flat: the artifacts are merged into it). */
export function readReports(dir: string, root: string, failed: readonly string[]): DigestInput {
  const results: ToolResult[] = [];
  const logs: DigestInput['logs'] = [];
  const files = existsSync(dir) ? readdirSync(dir).sort() : [];
  const json = <T>(file: string): T | undefined => {
    try {
      return JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;
    } catch {
      // Every JSON report comes from the `ci` job; a passing run's unreadable report is not news.
      if (failed.length === 0 || failed.includes('ci')) logs.push({ job: file, text: 'the report could not be read as JSON' });
      return undefined;
    }
  };
  for (const file of files) {
    if (file === 'typecheck.txt') results.push(parseTsc(readFileSync(join(dir, file), 'utf8'), root));
    else if (/^eslint.*\.json$/.test(file)) {
      const report = json<EslintFile[]>(file);
      if (report) results.push(parseEslint(report, root));
    } else if (/^vitest.*\.json$/.test(file)) {
      const report = json<VitestReport>(file);
      if (report) results.push(parseVitest(report, root));
    } else if (/^playwright.*\.json$/.test(file)) {
      const report = json<PlaywrightReport>(file);
      if (report) results.push(parsePlaywright(report, root));
    } else if (/\.(txt|log)$/.test(file)) {
      const job = file.replace(/\.(txt|log)$/, '');
      if (failed.length === 0 || failed.includes(job)) logs.push({ job, text: readFileSync(join(dir, file), 'utf8') });
    }
  }
  return { results, logs, failedJobs: [...failed] };
}

function main(argv: readonly string[]): void {
  const [dir, out] = argv;
  if (!dir || !out) throw new Error('usage: node scripts/ci-digest.ts <reports-dir> <out-file>');
  const failed = failedJobs(process.env['NEEDS']);
  const input = readReports(dir, process.cwd(), failed);
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: run } = process.env;
  if (server && repo && run) input.runUrl = `${server}/${repo}/actions/runs/${run}`;
  const digest = writeDigest(input);
  writeFileSync(out, digest);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) appendFileSync(summary, digest);
  console.log(digest);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
