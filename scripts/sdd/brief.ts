/**
 * PLAN §16.4 step 3 (D-198): the brief a session reads instead of SPEC.md,
 * PLAN.md and TASKS.md.
 *
 * A v1 session spent about 40 k tokens reading the three documents in full
 * before its first edit, twice with the review. The brief carries what the
 * task actually cites: its TASKS.md entry in full, every SPEC requirement,
 * story, finding, open question and decision-log row it names, every PLAN
 * decision it cites, its lane's §16.1 row, the D-89 commit rule and the tool
 * allowlist. Anything else the session reaches with `rg -n '<ID>'`.
 *
 * Pure: the caller supplies a lookup from an id to the text it lives in —
 * `layoutLookup` reads it through `docs/sdd/ids.md` (FR-SDD-7), `documentSources`
 * from the three documents as they were before the split — so the tests need no git.
 */
import { kindOf } from './ids';
import type { Task } from './tasks';

export interface BriefSources {
  /** The text an id, a task or an old section (`PLAN §16.1`) lives in, SPEC and PLAN text unwrapped; `null` when no file has it. */
  textFor: (key: string) => string | null;
  /** The open TASKS.md text the driver already parsed: where the task entry comes from when ids.md has no line for it. */
  fallbackTasks?: string;
}

/** The lane table's section. */
const LANES_SECTION = 'PLAN §16.1';

/** The pre-split sources: SPEC.md for requirements, stories and rows, PLAN.md for decisions and lanes, TASKS.md for tasks. */
export function documentSources(documents: { spec: string; plan: string; tasks: string }): BriefSources {
  return {
    textFor: (key) => {
      if (key.startsWith('PLAN ')) return documents.plan;
      const kind = kindOf(key)?.origin;
      return kind === 'PLAN' ? documents.plan : kind === 'TASKS' ? documents.tasks : documents.spec;
    },
  };
}

export interface BriefOptions {
  /** `IMPLEMENT_TOOLS`, rendered for the session so it knows what it may run before it tries. */
  allowedTools: readonly string[];
  deniedTools: readonly string[];
}

/**
 * §16.8 (D-453): the ceiling a brief may not pass, ~12 k tokens at four
 * characters a token. Raised from 36 000 for v2.0, whose spec sections are the
 * longest the documents carry (FR-WATCH-* is 30 KB of requirement text,
 * FR-GUT-* 25 KB) — and which is what R61, R64 and R66 already cost at 42–45 k
 * while the cap said 36 000, since the check only reads open tasks.
 */
export const BRIEF_BUDGET_CHARS = 48_000;

/** The decisions every session gets whether or not the task cites them. */
const ALWAYS_DECISIONS = ['D-89'];

/**
 * The ids a task entry can name, and the `A-n..m` / `A-n..A-m` ranges the
 * breakdown writes for a run of them (`F-11..F-13`, `FR-CI-1..3`).
 */
const ID = /\b(FR-[A-Z0-9]+-|US-|F-|D-|OQ-|V11-|V1-)(\d+[a-z]?)(?:\.\.(?:\1)?(\d+))?/g;

/** Every id the text names, ranges expanded, in first-seen order. */
export function citedIds(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(ID)) {
    const [, prefix = '', first = '', last] = match;
    if (last !== undefined && /^\d+$/.test(first)) {
      const from = Number(first);
      const to = Number(last);
      if (to >= from && to - from <= 200) {
        for (let n = from; n <= to; n += 1) seen.add(`${prefix}${String(n)}`);
        continue;
      }
    }
    seen.add(`${prefix}${first}`);
  }
  return [...seen];
}

const escape = (id: string): string => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The task's entry: its heading line and every indented line under it, up to
 * the next line that starts at the margin.
 */
export function taskEntry(tasks: string, id: string): string | null {
  const lines = tasks.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^- \\[[ xX]\\] \\*\\*${escape(id)}(\\s|\\*)`).test(line));
  if (start < 0) return null;
  const entry = [lines[start] ?? ''];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      // A blank line ends the entry unless the next non-blank line is still indented.
      const next = lines.slice(index + 1).find((candidate) => candidate.trim() !== '');
      if (next === undefined || !/^\s/.test(next)) break;
      entry.push(line);
      continue;
    }
    if (!/^\s/.test(line)) break;
    entry.push(line);
  }
  return entry.join('\n').trimEnd();
}

/**
 * A bullet keyed by a bold id — `- **FR-CI-1** …`, `- **D-197 — …**` — with
 * any indented continuation lines. SPEC requirements and PLAN decisions share
 * this shape.
 */
export function boldBullet(doc: string, id: string): string | null {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^- \\*\\*${escape(id)}(\\*\\*|\\s)`).test(line));
  if (start < 0) return null;
  const entry = [lines[start] ?? ''];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!/^\s+\S/.test(line)) break;
    entry.push(line);
  }
  return entry.join('\n');
}

/** A user story: `**US-20 — …**` and its lines up to the next blank line. */
export function userStory(spec: string, id: string): string | null {
  const lines = spec.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^\\*\\*${escape(id)}\\s`).test(line));
  if (start < 0) return null;
  const entry: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') break;
    entry.push(line);
  }
  return entry.join('\n');
}

/** A table row whose first cell is the id: a finding (§4.20), an open question (§7), or a decision-log row (§12, second cell). */
export function tableRow(doc: string, id: string): string | null {
  const first = new RegExp(`^\\| ${escape(id)}(\\s|\\|)`);
  const second = new RegExp(`^\\|[^|]*\\| ${escape(id)}(\\s|\\|)`);
  return doc.split('\n').find((line) => first.test(line) || second.test(line)) ?? null;
}

/** The lane's row of PLAN §16.1. */
export function laneRow(plan: string, lane: string): string | null {
  const row = new RegExp(`^\\| \`${escape(lane)}\`(\\s|\\|)`);
  return plan.split('\n').find((line) => row.test(line)) ?? null;
}

function section(title: string, items: readonly string[]): string[] {
  if (items.length === 0) return [];
  return [`## ${title}`, '', ...items.flatMap((item) => [item, '']), ''];
}

const isFr = (id: string): boolean => id.startsWith('FR-');
const isStory = (id: string): boolean => id.startsWith('US-');
const isFinding = (id: string): boolean => id.startsWith('F-');
const isDecision = (id: string): boolean => id.startsWith('D-');
const isSpecRow = (id: string): boolean => id.startsWith('OQ-') || id.startsWith('V1-') || id.startsWith('V11-');

export interface Brief {
  markdown: string;
  /** Ids the entry cited that none of the documents carry: a breakdown bug, reported and not fatal. */
  missing: readonly string[];
}

/** FR-SDD-17: a digest of docs/sdd/gotchas.md, fixed text so it stays byte-stable; the file has the rest. */
export const GOTCHAS_DIGEST: readonly string[] = [
  '- Read the section of `docs/sdd/gotchas.md` for the work at hand; `rg -n "<word>" docs/sdd/gotchas.md` finds it.',
  '- Do not run prettier here: there is no config and it rewrites every file.',
  '- Lint after the last edit (`eslint .` also lints `sdd-run/`) and run `npx knip` before the last commit: the dead-code CI job has failed tasks alone.',
  '- A headless session refuses `VAR=1 cmd`, `rm`, `git checkout`, redirects outside the worktree and `.claude/` edits; write files with the file tools or `node -e`.',
  '- A session cannot add npm dependencies (no network); a full e2e run rewrites committed captures, so restore them with `git show HEAD:<path>`.',
];

/** FR-SDD-17: the part of a brief every task shares, in the fixed order rules, tool policy, gotchas digest. Task-neutral: `<id>` is the id in the heading below it. */
export function sharedPrefix(options: BriefOptions): string[] {
  const list = (tools: readonly string[]): string => tools.map((tool) => `\`${tool}\``).join(', ');
  return [
    'This brief replaces SPEC.md, PLAN.md and TASKS.md for this session (PLAN D-198). It carries the task entry and every requirement, story, finding and decision the entry names. Do not read the three documents in full. For an id or a section the brief does not carry, run `rg -n "<ID>" SPEC.md PLAN.md TASKS.md` and read only the lines it points at.',
    '',
    '## Headless rules (PLAN §16.4)',
    '',
    '- Decide and record rather than ask. An ambiguous task takes the reading closest to the spec text, noted under "Assumptions" in the summary.',
    '- A task that cannot be done as written: write why to `sdd-run/<id>.blocked.md` and exit. Never diverge from the documents silently.',
    '- Commit each coherent step as it is finished (D-89 below). An uncommitted working tree is what the turn cap and the wall clock throw away.',
    '- Run narrow tests while iterating (`npx vitest run <file>`, `npx playwright test <spec>`); run the full `npm test` and `npm run typecheck` once before the last commit (D-199).',
    '- Check the task off in TASKS.md on this branch. Write the summary (files touched, requirement ids covered, assumptions, follow-ups) to `sdd-run/<id>.summary.md`; the driver makes it the PR body.',
    '- Never push, never call `gh`, never `git add -A`: the driver rebases, pushes and opens the PR.',
    '',
    '## Tools',
    '',
    `Allowed: ${list(options.allowedTools)}.`,
    '',
    `Denied (a denial wins over the allowlist): ${list(options.deniedTools)}.`,
    '',
    '## Gotchas (docs/sdd/gotchas.md)',
    '',
    ...GOTCHAS_DIGEST,
    '',
  ];
}

/** The brief for one task. */
export function buildBrief(task: Task, sources: BriefSources, options: BriefOptions): Brief {
  const tasksText = sources.textFor(task.id);
  const entry = (tasksText === null ? null : taskEntry(tasksText, task.id)) ?? (sources.fallbackTasks === undefined ? null : taskEntry(sources.fallbackTasks, task.id)) ?? `- [ ] **${task.id} — ${task.title}** _(entry not found in TASKS.md)_`;
  const ids = citedIds(entry);
  for (const finding of task.findings) if (!ids.includes(finding)) ids.push(finding);
  for (const decision of ALWAYS_DECISIONS) if (!ids.includes(decision)) ids.push(decision);
  const missing: string[] = [];
  const pick = (candidates: readonly string[], find: (doc: string, id: string) => string | null): string[] => {
    const found: string[] = [];
    for (const id of candidates) {
      const doc = sources.textFor(id);
      const text = doc === null ? null : find(doc, id);
      if (text === null) missing.push(id);
      else found.push(text);
    }
    return found;
  };

  const requirements = pick(ids.filter(isFr), boldBullet);
  const stories = pick(ids.filter(isStory), userStory);
  const findings = pick(ids.filter(isFinding), tableRow);
  const specRows = pick(ids.filter(isSpecRow), tableRow);
  const decisions = pick(ids.filter(isDecision), boldBullet);
  const lanes = sources.textFor(LANES_SECTION);
  const lane = task.lane && lanes !== null ? laneRow(lanes, task.lane) : null;

  // FR-SDD-17: what every session shares comes first and is the same bytes for every task (no id in it), so a wave's sessions share a cached prefix.
  const lines = [
    ...sharedPrefix(options),
    `# ${task.id} — ${task.title}`,
    '',
    '## The task (TASKS.md)',
    '',
    entry,
    '',
    ...section('Requirements (SPEC.md)', requirements),
    ...section('User stories (SPEC.md)', stories),
    ...section('Findings (SPEC.md §4.20)', findings.length > 0 ? ['| ID | From | Lane | Finding |', '|---|---|---|---|', ...findings] : []),
    ...section('Open questions and decision-log rows (SPEC.md)', specRows),
    ...section('Decisions (PLAN.md)', decisions),
    ...section(`Lane \`${String(task.lane)}\` (PLAN §16.1: what this task may touch)`, lane ? ['| Lane | Owns | Typical tasks |', '|---|---|---|', lane] : []),
  ];
  if (missing.length > 0) lines.push(`_Cited but not found in the documents: ${missing.join(', ')}._`, '');
  return { markdown: lines.join('\n'), missing };
}
