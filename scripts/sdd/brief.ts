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
 * Pure: the caller supplies the three documents' text, so the tests need no
 * git and the driver writes the file from the worktree it just created.
 */
import type { Task } from './tasks';

export interface BriefSources {
  spec: string;
  plan: string;
  tasks: string;
}

export interface BriefOptions {
  /** `IMPLEMENT_TOOLS`, rendered for the session so it knows what it may run before it tries. */
  allowedTools: readonly string[];
  deniedTools: readonly string[];
}

/** §16.8: under 12 k tokens before the first edit. At ~4 characters a token this is the file's share of that budget. */
export const BRIEF_BUDGET_CHARS = 36_000;

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

/** The brief for one task. */
export function buildBrief(task: Task, sources: BriefSources, options: BriefOptions): Brief {
  const entry = taskEntry(sources.tasks, task.id) ?? `- [ ] **${task.id} — ${task.title}** _(entry not found in TASKS.md)_`;
  const ids = citedIds(entry);
  for (const finding of task.findings) if (!ids.includes(finding)) ids.push(finding);
  for (const decision of ALWAYS_DECISIONS) if (!ids.includes(decision)) ids.push(decision);
  const missing: string[] = [];
  const pick = (candidates: readonly string[], find: (id: string) => string | null): string[] => {
    const found: string[] = [];
    for (const id of candidates) {
      const text = find(id);
      if (text === null) missing.push(id);
      else found.push(text);
    }
    return found;
  };

  const requirements = pick(ids.filter(isFr), (id) => boldBullet(sources.spec, id));
  const stories = pick(ids.filter(isStory), (id) => userStory(sources.spec, id));
  const findings = pick(ids.filter(isFinding), (id) => tableRow(sources.spec, id));
  const specRows = pick(ids.filter(isSpecRow), (id) => tableRow(sources.spec, id));
  const decisions = pick(ids.filter(isDecision), (id) => boldBullet(sources.plan, id));
  const lane = task.lane ? laneRow(sources.plan, task.lane) : null;

  const lines = [
    `# ${task.id} — ${task.title}`,
    '',
    'This brief replaces SPEC.md, PLAN.md and TASKS.md for this session (PLAN D-198). It carries the task entry and every requirement, story, finding and decision the entry names. Do not read the three documents in full. For an id or a section the brief does not carry, run `rg -n "<ID>" SPEC.md PLAN.md TASKS.md` and read only the lines it points at.',
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
    '## Headless rules (PLAN §16.4)',
    '',
    '- Decide and record rather than ask. An ambiguous task takes the reading closest to the spec text, noted under "Assumptions" in the summary.',
    `- A task that cannot be done as written: write why to \`sdd-run/${task.id}.blocked.md\` and exit. Never diverge from the documents silently.`,
    '- Commit each coherent step as it is finished (D-89 above). An uncommitted working tree is what the turn cap and the wall clock throw away.',
    '- Run narrow tests while iterating (`npx vitest run <file>`, `npx playwright test <spec>`); run the full `npm test` and `npm run typecheck` once before the last commit (D-199).',
    `- Check ${task.id} off in TASKS.md on this branch. Write the summary (files touched, requirement ids covered, assumptions, follow-ups) to \`sdd-run/${task.id}.summary.md\`; the driver makes it the PR body.`,
    '- Never push, never call `gh`, never `git add -A`: the driver rebases, pushes and opens the PR.',
    '',
    '## Tools',
    '',
    `Allowed: ${options.allowedTools.map((tool) => `\`${tool}\``).join(', ')}.`,
    '',
    `Denied (a denial wins over the allowlist): ${options.deniedTools.map((tool) => `\`${tool}\``).join(', ')}.`,
    '',
  ];
  if (missing.length > 0) lines.push(`_Cited but not found in the documents: ${missing.join(', ')}._`, '');
  return { markdown: lines.join('\n'), missing };
}
