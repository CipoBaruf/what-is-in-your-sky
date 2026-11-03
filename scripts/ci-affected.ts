/**
 * PLAN D-1031 (FR-CI-1 as amended 2026-11-02): which tests a pull request reaches.
 *
 *   node scripts/ci-affected.ts <base-ref> [<head-ref>]   # merge-base(base, head) to head (HEAD)
 *   node scripts/ci-affected.ts --all <why>    # everything (a push to main, the `full-ci` label)
 *
 * It prints the selection for a person and, when `GITHUB_OUTPUT` is set, writes
 * it for the workflow: `unit` and `e2e` are `all`, `some` or `none`, and
 * `unit_files` / `e2e_specs` are the space-separated paths for `some`.
 *
 * The rule, in order:
 *
 * 1. A change to what every test stands on — the package files, a build, test,
 *    type or lint config, the workflows, `public/_headers`, the test setup,
 *    support and fixtures (the golden physics fixtures among them) — runs
 *    everything.
 * 2. Unit: every changed file that still exists is handed to `vitest related`,
 *    which runs the test files among them and every test file whose imports
 *    reach the rest. A changed snapshot hands over its test file. A test that
 *    reads files by path (it or a local module it imports takes `node:fs` or
 *    `node:child_process`, or it loads a module by `new URL`) cannot be seen by
 *    the module graph, so the readers
 *    run on every pull request. A docs-only change (markdown, `docs/`,
 *    `.claude/`, `LICENSE`) runs the readers outside `CODE_READERS` alone —
 *    `tests/docs`, `tests/sdd`, `tests/deploy` — since the readers inside it
 *    read source, styles, data and the build, never the docs (a test holds
 *    them to that).
 * 3. e2e: a spec drives the built app, not the module it imports, so any change
 *    to what the build reads (`src/` outside the unit tests, `public/`,
 *    `index.html`) or to an e2e helper runs the whole suite. Otherwise only the
 *    changed specs run, and none when no spec changed.
 *
 * Node runs this file as it is (Node 24 strips the types), so the workflow
 * calls it before `npm ci`; it imports nothing outside Node.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One path in the diff; a rename is its old path deleted and its new path added. */
export interface Change {
  path: string;
  deleted: boolean;
}

export type Pick = 'all' | readonly string[];

export interface Selection {
  unit: Pick;
  e2e: Pick;
  reason: string;
}

/** Rule 1: a change to any of these runs every test. */
const FULL: readonly RegExp[] = [
  /^package(-lock)?\.json$/,
  /^\.npmrc$/,
  /^\.nvmrc$/,
  /^(vite|vitest|playwright|playwright\.design)\.config\.ts$/,
  /^tsconfig[^/]*\.json$/,
  /^eslint\.config\.js$/,
  /^knip\.json$/,
  /^\.github\//,
  /^public\/_headers$/,
  /^tests\/(setup|support|fixtures)\//,
];

/**
 * Rule 3: what `vite build` reads (the unit tests and their snapshots under `src/` are not
 * shipped), and an e2e helper, which any spec may import and `playwright.config.ts` itself
 * does (`promoFlows.ts`). The unit tests that import a helper are found by the graph.
 */
const runsEveryE2eSpec = (path: string): boolean =>
  (/^src\//.test(path) && !/\.test\.tsx?$/.test(path) && !/\/__snapshots__\//.test(path)) ||
  /^public\//.test(path) ||
  path === 'index.html' ||
  (/^tests\/e2e\//.test(path) && !/\.spec\.ts$/.test(path));

const isE2eSpec = (path: string): boolean => /^tests\/e2e\/[^/]+\.spec\.ts$/.test(path);

/** `dir/__snapshots__/X.test.ts.snap` belongs to `dir/X.test.ts`. */
const snapshotOwner = (path: string): string | undefined => /^(.*)\/__snapshots__\/(.+)\.snap$/.exec(path)?.slice(1).join('/');

/** Rule 2: what a docs-only change is made of. */
export const isDoc = (path: string): boolean => /\.md$/.test(path) || /^(docs|\.claude)\//.test(path) || path === 'LICENSE';

/** Rule 2: the readers that read code, styles, data or the build, and not the docs. */
export const CODE_READERS = /^(src|tests\/(styles|build|data))\//;

/**
 * The selection for a diff. `readers` are the unit test files that read the
 * repository by path (see `readerTests`); they run on every non-empty change,
 * the code readers among them only when something other than docs changed.
 */
export function select(changes: readonly Change[], readers: readonly string[]): Selection {
  if (changes.length === 0) return { unit: [], e2e: [], reason: 'nothing changed' };
  const full = changes.find((change) => FULL.some((pattern) => pattern.test(change.path)));
  if (full) return { unit: 'all', e2e: 'all', reason: `${full.path} is something every test stands on` };
  // Arguments travel space-separated through the workflow; a path that cannot is not guessed at.
  const spaced = changes.find((change) => /\s/.test(change.path));
  if (spaced) return { unit: 'all', e2e: 'all', reason: `"${spaced.path}" has whitespace in its path` };

  const unit = new Set<string>();
  for (const { path, deleted } of changes) {
    if (deleted || isE2eSpec(path)) continue;
    unit.add(snapshotOwner(path) ?? path);
  }
  const docsOnly = changes.every((change) => isDoc(change.path));
  for (const reader of readers) if (!docsOnly || !CODE_READERS.test(reader)) unit.add(reader);

  const input = changes.find((change) => runsEveryE2eSpec(change.path));
  const e2e: Pick = input ? 'all' : changes.filter((change) => !change.deleted && isE2eSpec(change.path)).map((change) => change.path);
  const reason = input ? `${input.path} can reach every spec (the build or an e2e helper)` : 'nothing the build reads changed';
  return { unit: [...unit].sort(), e2e, reason };
}

/**
 * Rule 2's readers: unit test files that take `node:fs` or `node:child_process`, themselves or
 * through a local import, and test files that load a module by URL (`new URL('./x', import.meta.url)`:
 * the worker integration test boots `passes.worker.ts` that way, which no import shows).
 */
const READS_BY_PATH = /from 'node:(fs|fs\/promises|child_process)'/;
const LOADS_BY_URL = /new URL\(\s*['`]/;
const LOCAL_IMPORT = /(?:from|import)\s*\(?\s*'(\.{1,2}\/[^'?]+)/g;

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function resolveLocal(from: string, specifier: string): string | undefined {
  const base = resolve(dirname(from), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find((path) => /\.tsx?$/.test(path) && existsSync(path));
}

/**
 * Helpers whose reads do not make their importers readers: the test support and setup modules
 * and the e2e helpers read `tests/fixtures`, which is rule 1 (it runs everything) already.
 */
const READS_FIXTURES_ONLY = /^tests\/(support|setup|e2e)\/.*(?<!\.test\.tsx?)$/;

export function readerTests(root: string): string[] {
  const reads = new Map<string, boolean>();
  const readsByPath = (file: string): boolean => {
    const known = reads.get(file);
    if (known !== undefined) return known;
    reads.set(file, false); // a cycle back to this file adds nothing
    if (READS_FIXTURES_ONLY.test(relative(root, file).split('\\').join('/'))) return false;
    const source = readFileSync(file, 'utf8');
    const local = [...source.matchAll(LOCAL_IMPORT)].map((match) => resolveLocal(file, match[1] ?? ''));
    const answer = READS_BY_PATH.test(source) || local.some((path) => path !== undefined && readsByPath(path));
    reads.set(file, answer);
    return answer;
  };
  return ['src', 'tests']
    .flatMap((dir) => walk(join(root, dir), []))
    .filter((path) => /\.test\.tsx?$/.test(path))
    .map((path) => [path, relative(root, path).split('\\').join('/')] as const)
    .filter(([path, name]) => !/^tests\/(e2e|live)\//.test(name) && (readsByPath(path) || LOADS_BY_URL.test(readFileSync(path, 'utf8'))))
    .map(([, name]) => name)
    .sort();
}

/** `git diff --name-status -M` lines, renames split into a deletion and an addition. */
export function parseNameStatus(text: string): Change[] {
  const changes: Change[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const [status = '', ...paths] = line.split('\t');
    if (status.startsWith('R') || status.startsWith('C')) {
      const [from = '', to = ''] = paths;
      if (status.startsWith('R')) changes.push({ path: from, deleted: true });
      changes.push({ path: to, deleted: false });
    } else changes.push({ path: paths[0] ?? '', deleted: status === 'D' });
  }
  return changes;
}

const git = (args: readonly string[]): string => execFileSync('git', args, { encoding: 'utf8' });

const describe = (pick: Pick): string => (pick === 'all' ? 'all' : pick.length === 0 ? 'none' : `${pick.length} file(s)`);

function report(selection: Selection): void {
  console.log(`unit: ${describe(selection.unit)}`);
  if (selection.unit !== 'all') for (const path of selection.unit) console.log(`  ${path}`);
  console.log(`e2e:  ${describe(selection.e2e)}`);
  if (selection.e2e !== 'all') for (const path of selection.e2e) console.log(`  ${path}`);
  console.log(`why:  ${selection.reason}`);
  const out = process.env['GITHUB_OUTPUT'];
  if (!out) return;
  const mode = (pick: Pick): string => (pick === 'all' ? 'all' : pick.length === 0 ? 'none' : 'some');
  const list = (pick: Pick): string => (pick === 'all' ? '' : pick.join(' '));
  const lines = [`unit=${mode(selection.unit)}`, `unit_files=${list(selection.unit)}`, `e2e=${mode(selection.e2e)}`, `e2e_specs=${list(selection.e2e)}`, `reason=${selection.reason.replaceAll('\n', ' ')}`];
  appendFileSync(out, `${lines.join('\n')}\n`);
}

function main(argv: readonly string[]): void {
  if (argv[0] === '--all') {
    report({ unit: 'all', e2e: 'all', reason: argv.slice(1).join(' ') || 'asked for everything' });
    return;
  }
  const [base, head = 'HEAD'] = argv;
  if (!base) throw new Error('usage: node scripts/ci-affected.ts <base-ref> [<head-ref>] | --all <why>');
  const from = git(['merge-base', base, head]).trim();
  const changes = parseNameStatus(git(['diff', '--name-status', '-M', from, head]));
  report(select(changes, readerTests(process.cwd())));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
