/**
 * FR-SDD-4, FR-SDD-6, FR-SDD-8, FR-SDD-9, FR-SDD-10, FR-SDD-13, FR-SDD-14, FR-SDD-22, FR-SDD-24
 * (D-1069): `npm run check:sdd`, the rules of the `docs/sdd/` layout, each a function of the tree.
 * It checks shape and staleness, not meaning: a decision that says the wrong thing passes.
 *
 *   npx tsx scripts/check-sdd.ts          # every rule; exit 1 on any problem
 *   npx tsx scripts/check-sdd.ts --list   # and every line or file a rule lets through
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENS, CAPTURE_DIR, CAPTURE_FILE } from '../tests/e2e/captureSet';
import { compressPng } from './captures/compress';
import { globToRegExp, screenGlobs, type CaptureManifest } from './ci-affected';
import { renderMap, MAP_PATH } from './sdd-map';
import { parseAgents } from './sdd/agents';
import { generateIds, IDS_PATH, parseIds } from './sdd/ids';
import { AGENTS_MAX_KB, AREA_DOC_MAX_KB, DOC_LINE_MAX, INDEX_MAX_KB, PHASE_DOC_MAX_KB, WORKFLOW_MAX_KB } from './sdd/limits';
import { generateTraceability, TRACEABILITY_PATH, tracedIds } from './sdd/traceability';

/** One broken rule. */
export interface Problem {
  rule: string;
  message: string;
}

/** What a rule returns: its problems, and what it lets through but lists (FR-SDD-4's table rows). */
export interface Outcome {
  problems: Problem[];
  listed?: string[];
}

/** FR-SDD-9: the seven workflows. */
export const WORKFLOWS = ['spec', 'breakdown', 'implement', 'visual-review', 'review', 'fix-ci', 'release'] as const;
const INDEX_FILES = ['SPEC.md', 'PLAN.md', 'TASKS.md'] as const;

const read = (root: string, path: string): string => readFileSync(join(root, path), 'utf8');
const exists = (root: string, path: string): boolean => existsSync(join(root, path));
const problem = (rule: string, message: string): Problem => ({ rule, message });

/** Tracked files under `root` (a git work tree), optionally under some paths. */
export function trackedFiles(root: string, ...paths: string[]): string[] {
  return execFileSync('git', ['-C', root, 'ls-files', '-z', '--', ...paths], { encoding: 'utf8', maxBuffer: 1e8 })
    .split('\0')
    .filter((path) => path !== '' && exists(root, path));
}

/** The documents FR-SDD-4 and FR-SDD-13 read: `docs/sdd/**.md`, `AGENTS.md` and the index files. */
export const layoutDocs = (root: string): string[] => [...INDEX_FILES.filter((path) => exists(root, path)), ...(exists(root, 'AGENTS.md') ? ['AGENTS.md'] : []), ...trackedFiles(root, 'docs/sdd').filter((path) => path.endsWith('.md'))];

/** The documents as they stood before the split (D-1062's fixture): a sentence found here verbatim is moved text. */
export const PARENT_DIR = 'scripts/sdd/__fixtures__/parent';

/** The pre-split text, all four documents joined; empty when the fixture is gone. */
export function movedText(root: string): string {
  const dir = join(root, PARENT_DIR);
  if (!existsSync(dir)) return '';
  return ['SPEC.md', 'PLAN.md', 'TASKS.md', 'RELEASE.md']
    .filter((name) => existsSync(join(dir, name)))
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

/** A task's field line (`  - **Scope:** …`): `tasks.ts` reads a field from one line, so it cannot be wrapped. */
const TASK_FIELD = /^\s+- \*\*[^*]+:\*\* /;

/**
 * FR-SDD-4: no line over DOC_LINE_MAX. What cannot be wrapped is let through and listed: a table
 * row, a task's field line in a tasks file, and one sentence moved verbatim by the split (a closed
 * phase's text is not reworded, SPEC §4.56's non-goals).
 */
export function checkLines(root: string, docs = layoutDocs(root), moved = movedText(root)): Outcome {
  const problems: Problem[] = [];
  const listed: string[] = [];
  for (const path of docs) {
    const tasksFile = path === 'TASKS.md' || path.endsWith('/tasks.md');
    read(root, path)
      .split('\n')
      .forEach((line, index) => {
        if (line.length <= DOC_LINE_MAX) return;
        const where = `${path}:${String(index + 1)} (${String(line.length)} chars)`;
        if (line.startsWith('|') || (tasksFile && TASK_FIELD.test(line)) || (moved !== '' && moved.includes(line.trim()))) listed.push(where);
        else problems.push(problem('line', `${where} is over DOC_LINE_MAX (${String(DOC_LINE_MAX)})`));
      });
  }
  return { problems, listed };
}

/** TASKS.md's phase blocks: each `## <phase> tasks` heading to the next `## `. */
export function phaseBlocks(tasks: string): { heading: string; text: string }[] {
  const lines = tasks.split('\n');
  const blocks: { heading: string; text: string }[] = [];
  lines.forEach((line, index) => {
    if (!/^## .+ tasks\s*$/.test(line)) return;
    let end = index + 1;
    while (end < lines.length && !/^## /.test(lines[end] ?? '')) end += 1;
    blocks.push({ heading: line, text: lines.slice(index, end).join('\n') });
  });
  return blocks;
}

/** FR-SDD-13: the size ceilings, and TASKS.md holding the open phase only. */
export function checkSizes(root: string): Outcome {
  const problems: Problem[] = [];
  const listed: string[] = [];
  const over = (path: string, bytes: number, max: number, name: string): void => {
    if (bytes > max * 1024) problems.push(problem('size', `${path} is ${(bytes / 1024).toFixed(1)} KB, over ${name} (${String(max)} KB)`));
  };
  const size = (path: string): number => Buffer.byteLength(read(root, path));
  for (const path of INDEX_FILES) {
    if (!exists(root, path)) continue;
    if (path !== 'TASKS.md') {
      over(path, size(path), INDEX_MAX_KB, 'INDEX_MAX_KB');
      continue;
    }
    const text = read(root, path);
    const blocks = phaseBlocks(text);
    if (blocks.length > 1) problems.push(problem('size', `TASKS.md holds ${String(blocks.length)} phases (${blocks.map((block) => block.heading.slice(3)).join(', ')}); it holds the open one only`));
    // D-1081: the ceiling binds TASKS.md without the open phase's block.
    over('TASKS.md without the open phase', Buffer.byteLength(text) - Buffer.byteLength(blocks[0]?.text ?? ''), INDEX_MAX_KB, 'INDEX_MAX_KB');
  }
  for (const path of trackedFiles(root, 'docs/sdd')) {
    const phase = /^docs\/sdd\/phases\/([^/]+)\/(?:spec|plan)\.md$/.exec(path)?.[1];
    if (phase !== undefined) {
      // Like D-1081's TASKS.md: the ceiling binds from v2.13 on; a phase the split moved byte for byte is listed.
      if (phaseAtLeast(phase, [2, 13])) over(path, size(path), PHASE_DOC_MAX_KB, 'PHASE_DOC_MAX_KB');
      else if (size(path) > PHASE_DOC_MAX_KB * 1024) listed.push(path);
    } else if (/^docs\/sdd\/areas\/[^/]+\.md$/.test(path)) over(path, size(path), AREA_DOC_MAX_KB, 'AREA_DOC_MAX_KB');
    else if (/^docs\/sdd\/workflows\/[^/]+\.md$/.test(path)) over(path, size(path), WORKFLOW_MAX_KB, 'WORKFLOW_MAX_KB');
  }
  if (exists(root, 'AGENTS.md')) over('AGENTS.md', size('AGENTS.md'), AGENTS_MAX_KB, 'AGENTS_MAX_KB');
  return { problems, listed };
}

/** FR-SDD-6, FR-SDD-14, FR-SDD-24: a generated file that no longer matches its sources. */
export function checkGenerated(root: string): Outcome {
  const files: [string, () => string, string][] = [
    [IDS_PATH, () => generateIds(root), 'npx tsx scripts/sdd/ids.ts --write'],
    [MAP_PATH, () => renderMap(root), 'npx tsx scripts/sdd-map.ts'],
    [TRACEABILITY_PATH, () => generateTraceability(root), 'npx tsx scripts/sdd/traceability.ts --write'],
  ];
  const problems = files.filter(([path, generate]) => !exists(root, path) || read(root, path) !== generate()).map(([path, , fix]) => problem('stale', `${path} is stale; run \`${fix}\``));
  return { problems };
}

/** An id as the docs, the code and the tests cite it. */
const CITED = /\b(?:FR-[A-Z][A-Z0-9]*-\d+[a-z]?|US-\d+|OQ-\d+|V\d+-\d+|D-\d+|F-\d+)\b/g;

/** Where cited ids are read: text the project wrote, not fixtures, generated files or recorded data. */
export const citingFiles = (root: string): string[] =>
  trackedFiles(root, 'src', 'scripts', 'tests', 'docs', '.github', '*.md').filter(
    (path) => /\.(ts|tsx|js|md|yml|css)$/.test(path) && !/(^|\/)(__fixtures__|fixtures|__snapshots__)\//.test(path) && !path.startsWith('tests/sdd/') && path !== IDS_PATH && path !== MAP_PATH && !path.startsWith(`${CAPTURE_DIR}/`),
  );

/** A block of ids (`D-1073..D-1093`, `D-200 to D-203`): a reservation names ids before they exist, so it is not a citation. */
const RANGE = /\b((?:[A-Z][A-Z0-9]*-)+)\d+[a-z]?\s*(?:\.\.\.?|–|—| to )\s*(?:\1)?\d+[a-z]?\b/g;

/**
 * FR-SDD-6: every id cited in the docs, the code and the tests resolves through `ids.md`. A
 * letter-suffixed id (`FR-DOME-8c`) resolves through its base. A dangling citation on a line the
 * split moved verbatim was dangling before it, and is listed: closed text is not reworded.
 */
export function checkIdsResolve(root: string, files = citingFiles(root), moved = movedText(root)): Outcome {
  if (!exists(root, IDS_PATH)) return { problems: [problem('id', `${IDS_PATH} is missing`)] };
  const known = parseIds(read(root, IDS_PATH));
  const resolves = (id: string): boolean => known.has(id) || known.has(id.replace(/(\d)[a-z]$/, '$1'));
  const missing = new Map<string, string>();
  const listed = new Map<string, string>();
  for (const path of files)
    read(root, path)
      .split('\n')
      .forEach((line, index) => {
        for (const [id] of line.replace(RANGE, '').matchAll(CITED)) {
          if (resolves(id) || missing.has(id)) continue;
          const where = `${path}:${String(index + 1)}`;
          if (moved !== '' && moved.includes(line.trim())) {
            if (!listed.has(id)) listed.set(id, where);
          } else missing.set(id, where);
        }
      });
  for (const id of missing.keys()) listed.delete(id);
  return {
    problems: [...missing].map(([id, where]) => problem('id', `${id} (first cited at ${where}) is not in ${IDS_PATH}`)),
    listed: [...listed].map(([id, where]) => `${id} at ${where} (moved text)`),
  };
}

/** No `D-` id is defined twice across `docs/sdd/` (D-1088 is the case that made the rule). */
export function checkDecisionsUnique(root: string): Outcome {
  // A definition is the id then its title or its cell; `- **D-8 evidence — …` and `- **D-12 amended — …` add to one.
  const decision = /^(?:- \*\*|\| \*\*)(D-\d+)(?:\*\*| — )/;
  const first = new Map<string, string>();
  const problems: Problem[] = [];
  for (const path of ['PLAN.md', ...trackedFiles(root, 'docs/sdd').filter((file) => file.endsWith('.md') && file !== IDS_PATH)].filter((file) => exists(root, file)))
    read(root, path)
      .split('\n')
      .forEach((line, index) => {
        const id = decision.exec(line)?.[1];
        if (id === undefined) return;
        const where = `${path}:${String(index + 1)}`;
        const earlier = first.get(id);
        if (earlier === undefined) first.set(id, where);
        else problems.push(problem('decision', `${id} is defined at ${earlier} and again at ${where}`));
      });
  return { problems };
}

/** FR-SDD-8, FR-SDD-9: the seven workflows exist, each opens with its reading row and AGENTS.md's table names it; CLAUDE.md is the import. */
export function checkWorkflows(root: string): Outcome {
  const problems: Problem[] = [];
  const agents = exists(root, 'AGENTS.md') ? read(root, 'AGENTS.md') : '';
  if (agents === '') problems.push(problem('workflow', 'AGENTS.md is missing'));
  if (!exists(root, 'CLAUDE.md') || read(root, 'CLAUDE.md') !== '@AGENTS.md\n') problems.push(problem('workflow', 'CLAUDE.md is not the one line `@AGENTS.md`'));
  const table = agents.slice(agents.indexOf('## What each kind of work reads'));
  for (const name of WORKFLOWS) {
    const path = `docs/sdd/workflows/${name}.md`;
    if (!exists(root, path)) {
      problems.push(problem('workflow', `${path} is missing`));
      continue;
    }
    const lines = read(root, path).split('\n');
    if (!/^# /.test(lines[0] ?? '') || !/^Reads: \S/.test(lines[2] ?? '') || !/^Never reads: \S/.test(lines[3] ?? '')) problems.push(problem('workflow', `${path} does not open with its title, then its \`Reads:\` and \`Never reads:\` lines`));
    if (!table.includes(`\`${path}\``)) problems.push(problem('workflow', `AGENTS.md's reading table does not name ${path}`));
  }
  return { problems };
}

/** FR-SDD-10: `sdd.agents.json` passes its schema, and `scripts/sdd/` names none of its agents or models outside `agents.ts`'s comments. */
export function checkAgents(root: string): Outcome {
  let names: string[];
  try {
    const config = parseAgents(JSON.parse(read(root, 'sdd.agents.json')) as unknown);
    names = Object.entries(config.agents).flatMap(([name, entry]) => [name, ...Object.values(entry.tiers).map((tier) => tier.model), ...Object.keys(entry.aliases ?? {})]);
  } catch (error) {
    return { problems: [problem('agents', error instanceof Error ? error.message : String(error))] };
  }
  const named = new RegExp(`\\b(?:${[...new Set(names)].map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
  const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const files = [...trackedFiles(root, 'scripts/sdd').filter((path) => /^scripts\/sdd\/[^/]+\.ts$/.test(path)), 'scripts/sdd-run.ts'].filter((path) => exists(root, path));
  const problems = files.filter((path) => named.test(path.endsWith('/agents.ts') ? code(read(root, path)) : read(root, path))).map((path) => problem('agents', `${path} names an agent or a model; they live in sdd.agents.json`));
  return { problems };
}

/** FR-SDD-22: every capture screen has a manifest entry and the reverse, every glob matches a tracked file, every tracked capture is compressed. */
export function checkCaptures(root: string, screens: readonly string[] = SCREENS.map((screen) => screen.name)): Outcome {
  const path = 'scripts/captures/manifest.json';
  if (!exists(root, path)) return { problems: [problem('capture', `${path} is missing`)] };
  const manifest = JSON.parse(read(root, path)) as CaptureManifest;
  const problems: Problem[] = [];
  for (const screen of screens) if (!(screen in manifest.screens) || screenGlobs(manifest, screen).length === 0) problems.push(problem('capture', `capture screen \`${screen}\` has no entry in ${path}`));
  for (const name of Object.keys(manifest.screens)) if (!screens.includes(name)) problems.push(problem('capture', `${path} names \`${name}\`, which tests/e2e/captureSet.ts does not shoot`));
  const tracked = trackedFiles(root);
  const globs = new Set([...manifest.all, ...Object.values(manifest.routes).flat(), ...Object.values(manifest.screens).flatMap((screen) => screen.extras)]);
  for (const glob of globs) {
    const re = globToRegExp(glob);
    if (!tracked.some((file) => re.test(file))) problems.push(problem('capture', `${path}'s \`${glob}\` names no tracked file`));
  }
  for (const file of tracked.filter((file) => file.startsWith(`${CAPTURE_DIR}/`) && CAPTURE_FILE.test(file.slice(CAPTURE_DIR.length + 1)))) {
    const bytes = readFileSync(join(root, file));
    if (compressPng(bytes).length < bytes.length) problems.push(problem('capture', `${file} is not compressed; run \`npx tsx scripts/captures/compress.ts ${file}\``));
  }
  return { problems };
}

/** Phase folder names in order: `v2.13` after `v2.9`. */
const phaseAtLeast = (phase: string, floor: number[]): boolean => {
  const parts = /^v(\d+(?:\.\d+)*)$/.exec(phase)?.[1]?.split('.').map(Number);
  if (!parts) return false;
  for (let i = 0; i < Math.max(parts.length, floor.length); i += 1) if ((parts[i] ?? 0) !== (floor[i] ?? 0)) return (parts[i] ?? 0) > (floor[i] ?? 0);
  return true;
};

/** The ids an open task of TASKS.md names in its `Satisfies:` line: their tests are that task's to write. */
export function pendingIds(tasks: string): Set<string> {
  const pending = new Set<string>();
  let open = false;
  for (const line of tasks.split('\n')) {
    if (/^- \[[ xX]\] /.test(line)) open = line.startsWith('- [ ]');
    else if (open && /^\s+- \*\*Satisfies:\*\*/.test(line)) for (const [id] of line.matchAll(/FR-[A-Z0-9]+-\d+[a-z]?/g)) pending.add(id);
  }
  return pending;
}

/** FR-SDD-24: a requirement from v2.13 on with no test naming it, unless an open task still owes it. */
export function checkTested(root: string): Outcome {
  if (!exists(root, IDS_PATH) || !exists(root, TRACEABILITY_PATH)) return { problems: [problem('untested', `${IDS_PATH} or ${TRACEABILITY_PATH} is missing`)] };
  const traced = tracedIds(read(root, TRACEABILITY_PATH));
  const pending = exists(root, 'TASKS.md') ? pendingIds(read(root, 'TASKS.md')) : new Set<string>();
  const problems: Problem[] = [];
  for (const entry of parseIds(read(root, IDS_PATH)).values()) {
    const phase = /^docs\/sdd\/phases\/([^/]+)\/spec\.md$/.exec(entry.path)?.[1];
    if (!entry.key.startsWith('FR-') || phase === undefined || !phaseAtLeast(phase, [2, 13])) continue;
    if (!traced.has(entry.key) && !pending.has(entry.key)) problems.push(problem('untested', `${entry.key} (${phase}) has no test naming it in its title`));
  }
  return { problems };
}

/** Every rule, in the order the report prints them. */
export const RULES: readonly [string, (root: string) => Outcome][] = [
  ['lines (FR-SDD-4)', checkLines],
  ['sizes (FR-SDD-13)', checkSizes],
  ['generated files (FR-SDD-6, FR-SDD-14, FR-SDD-24)', checkGenerated],
  ['ids resolve (FR-SDD-6)', checkIdsResolve],
  ['decisions defined once', checkDecisionsUnique],
  ['workflows (FR-SDD-8, FR-SDD-9)', checkWorkflows],
  ['agents config (FR-SDD-10)', checkAgents],
  ['captures (FR-SDD-22)', checkCaptures],
  ['tests carry their ids (FR-SDD-24)', checkTested],
];

/** Runs every rule over `root`; returns the exit code. */
export function run(root: string, log: (line: string) => void = console.log, list = false): number {
  let failed = 0;
  for (const [name, rule] of RULES) {
    const { problems, listed = [] } = rule(root);
    failed += problems.length;
    log(`check:sdd ${problems.length === 0 ? 'ok  ' : 'FAIL'} ${name}${listed.length > 0 ? ` (${String(listed.length)} let through and listed; --list prints them)` : ''}`);
    for (const { message } of problems) log(`  ${message}`);
    if (list) for (const where of listed) log(`  listed: ${where}`);
  }
  log(failed === 0 ? 'check:sdd: every rule holds' : `check:sdd: ${String(failed)} problem(s)`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run('.', console.log, process.argv.includes('--list'));
}

