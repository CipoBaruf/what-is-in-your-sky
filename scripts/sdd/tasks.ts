/**
 * PLAN §16.3: TASKS.md as the driver reads it.
 *
 * A task is one checkbox item — `- [x] **R15 — …**` — with its fields as
 * sub-bullets. The checkbox is the merged signal (§16.2): the driver reads
 * this file from `origin/main`, never from the working copy. `Lane:`,
 * `Model:` and `Gate:` arrive with the v1 tasks, `Tier:` and `Agent:` with
 * v2.13 (FR-SDD-11), `Model:` read through the agent's model → tier map; R1–R15 and H predate them
 * and come back `null`, which is only an error for a task the driver is
 * asked to run (§16.3).
 *
 * Since the split (FR-SDD-7) TASKS.md holds the open phase and each closed
 * phase's tasks are in `docs/sdd/phases/<version>/tasks.md`; `layoutTasksText`
 * puts them together, closed phases first, so a dependency on a closed task
 * resolves and reads as merged.
 *
 * Pure: the caller supplies the files' text, so the tests need no git.
 */
import { TIERS, type Tier } from './agents';
import { OPEN_PHASE, PHASES } from './splitMap';

/** FR-SDD-7: a closed phase's tasks file. */
export const phaseTasksPath = (phase: string): string => `docs/sdd/phases/${phase}/tasks.md`;

/** FR-SDD-7: every task of the layout as one text, the closed phases in release order and then the open TASKS.md. */
export function layoutTasksText(open: string, read: (path: string) => string | null): string {
  const closed = PHASES.filter((phase) => phase !== OPEN_PHASE).map((phase) => read(phaseTasksPath(phase))).filter((text): text is string => text !== null);
  return [...closed, open].join('\n');
}

const LANES = ['ui', 'chart', 'data', 'physics', 'live', 'window', 'docs'] as const; // `live` split from `ui` (D-132); `window` and `docs` for v1.1 (D-196)
/** §16.6 (D-197): `Model: interactive` marks a task the owner drives by hand; the driver lists it and never runs it. */
const OWNER_DRIVEN = 'interactive';
const GATES = ['auto', 'owner'] as const;

export type Lane = (typeof LANES)[number];
type Gate = (typeof GATES)[number];

export interface Task {
  /** `R16`, `H`. */
  id: string;
  title: string;
  /** `r16-the-layered-dome`: the branch the driver creates for it (§16.4 step 2). */
  branch: string;
  /** Checked off on the ref this text came from. */
  done: boolean;
  /** The `[P]` marker in the heading (TASKS.md conventions), kept for reporting only. */
  parallel: boolean;
  lane: Lane | null;
  /** FR-SDD-11: `Tier:`, or a closed phase's `Model:` through the model → tier map; `null` when neither says. */
  tier: Tier | null;
  /** `Model:` as written, lower case: kept for `interactive` and for reporting. */
  model: string | null;
  /** FR-SDD-10: `Agent:` pins the task to one entry of `sdd.agents.json`. */
  agent: string | null;
  /** `Agent:` named an entry the config does not have (`parseTasks` was given the names): the task is held back. */
  unknownAgent: string | null;
  gate: Gate | null;
  deps: readonly string[];
  /** §16.3 (v1.1): a file that must exist on `origin/main` before the task may start, or `null`. */
  precondition: string | null;
  /** §16.3 (v1.1): the `F-<n>` findings the task closes (D-194). */
  findings: readonly string[];
  /** §16.3 (v2.2, D-659): the tier the review runs on (a model name read through the map), or `null` for D-1065's rule. */
  review: Tier | null;
  /** §16.3 (v2.2, D-659): the implementation session's turn cap, or `null` for the driver's default; the wall clock scales with it. */
  turns: number | null;
  /** §16.3 (v2.2, D-659): whether a limit-stopped session may be retried on the next model down, or `null` for the `--fallback` flag. */
  fallback: boolean | null;
  /** Position in the file; the driver runs a wave in this order. */
  order: number;
}

export interface ParsedTasks {
  tasks: readonly Task[];
  /** Breakdown bugs found while reading: bad field values, duplicate ids, unknown dependencies. */
  problems: readonly string[];
}

const HEADING = /^- \[([ xX])\] \*\*([A-Z][A-Z0-9]*)(\s+\[P\])?\s+—\s+([\s\S]+?)\*\*/;
const FIELD = /^\s+- \*\*(Lane|Model|Tier|Agent|Gate|Depends on|Precondition|Findings|Review|Turns|Fallback):\*\*\s*(.*?)\s*$/;
const SWITCH = ['on', 'off'] as const;
const NONE = /^(—|-|–|none)$/i;

/** Strips markdown emphasis and code ticks from a field value. */
const plain = (value: string): string => value.replace(/[`*_]/g, '').trim();

/** `R16` + `The layered dome` → `r16-the-layered-dome`, capped at four words / 32 characters. */
export function branchName(id: string, title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const kept: string[] = [];
  for (const word of words.slice(0, 4)) {
    if (kept.join('-').length + word.length + 1 > 32) break;
    kept.push(word);
  }
  const slug = kept.join('-');
  return slug ? `${id.toLowerCase()}-${slug}` : id.toLowerCase();
}

function parseDeps(value: string): string[] {
  const plainValue = plain(value);
  if (!plainValue || NONE.test(plainValue)) return [];
  return plainValue
    .split(/[,&]/)
    .map((part) => part.trim())
    .filter((part) => /^[A-Z][A-Z0-9]*$/.test(part));
}

function parseEnum<T extends string>(value: string, allowed: readonly T[]): T | null {
  const plainValue = plain(value).toLowerCase();
  return (allowed as readonly string[]).includes(plainValue) ? (plainValue as T) : null;
}

/**
 * Reads every task in TASKS.md, in file order. `modelTiers` is the default
 * agent's model → tier map (`agents.ts`), which `Model:` and `Review:` are
 * read through; without it only tiers and `interactive` are known.
 */
export function parseTasks(markdown: string, modelTiers: Readonly<Record<string, Tier>> = {}, agentNames?: readonly string[]): ParsedTasks {
  const models = Object.keys(modelTiers);
  const asTier = (value: string): Tier | null => {
    const name = plain(value).toLowerCase();
    return (TIERS as readonly string[]).includes(name) ? (name as Tier) : (modelTiers[name] ?? null);
  };
  const tasks: Task[] = [];
  const problems: string[] = [];
  let current: Task | null = null;

  for (const line of markdown.split('\n')) {
    const heading = HEADING.exec(line);
    if (heading) {
      const [, checkbox = ' ', id = '', parallel, title = ''] = heading;
      current = {
        id,
        title: title.trim(),
        branch: branchName(id, title.trim()),
        done: checkbox.toLowerCase() === 'x',
        parallel: Boolean(parallel),
        lane: null,
        tier: null,
        model: null,
        agent: null,
        unknownAgent: null,
        gate: null,
        deps: [],
        precondition: null,
        findings: [],
        review: null,
        turns: null,
        fallback: null,
        order: tasks.length,
      };
      if (tasks.some((task) => task.id === id)) problems.push(`${id}: appears twice in TASKS.md.`);
      tasks.push(current);
      continue;
    }
    if (!current) continue;
    const field = FIELD.exec(line);
    if (!field) continue;
    const [, name = '', value = ''] = field;
    if (name === 'Depends on') current.deps = parseDeps(value);
    else if (name === 'Precondition') current.precondition = NONE.test(plain(value)) || plain(value) === '' ? null : plain(value);
    else if (name === 'Findings') current.findings = parseFindings(value, current.id, problems);
    else if (name === 'Lane') {
      current.lane = parseEnum(value, LANES);
      if (!current.lane) problems.push(`${current.id}: \`Lane: ${plain(value)}\` is not one of ${LANES.join(', ')}.`);
    } else if (name === 'Model') {
      const model = plain(value).toLowerCase();
      const tier = model === OWNER_DRIVEN ? null : (modelTiers[model] ?? null);
      current.model = model === OWNER_DRIVEN || tier !== null ? model : null;
      current.tier ??= tier;
      if (current.model === null) problems.push(`${current.id}: \`Model: ${plain(value)}\` is not one of ${[...models, OWNER_DRIVEN].join(', ')}.`);
    } else if (name === 'Tier') {
      current.tier = parseEnum(value, TIERS);
      if (!current.tier) problems.push(`${current.id}: \`Tier: ${plain(value)}\` is not one of ${TIERS.join(', ')}.`);
    } else if (name === 'Agent') {
      current.agent = plain(value).toLowerCase() || null;
      if (current.agent !== null && agentNames !== undefined && !agentNames.includes(current.agent)) {
        current.unknownAgent = current.agent;
        problems.push(`${current.id}: \`Agent: ${plain(value)}\` is not an entry of sdd.agents.json (${agentNames.join(', ')}).`);
      }
    } else if (name === 'Gate') {
      current.gate = parseEnum(value, GATES);
      if (!current.gate) problems.push(`${current.id}: \`Gate: ${plain(value)}\` is not one of ${GATES.join(', ')}.`);
    } else if (name === 'Review') {
      current.review = asTier(value);
      if (!current.review) problems.push(`${current.id}: \`Review: ${plain(value)}\` is not one of ${[...TIERS, ...models].join(', ')}.`);
    } else if (name === 'Turns') {
      const turns = Number(plain(value));
      current.turns = Number.isInteger(turns) && turns > 0 ? turns : null;
      if (current.turns === null) problems.push(`${current.id}: \`Turns: ${plain(value)}\` is not a positive whole number.`);
    } else if (name === 'Fallback') {
      const setting = parseEnum(value, SWITCH);
      current.fallback = setting === null ? null : setting === 'on';
      if (setting === null) problems.push(`${current.id}: \`Fallback: ${plain(value)}\` is not one of ${SWITCH.join(', ')}.`);
    }
  }

  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) for (const dep of task.deps) if (!ids.has(dep)) problems.push(`${task.id}: depends on ${dep}, which is not a task.`);

  return { tasks, problems };
}

/** `F-1, F-2` → `['F-1', 'F-2']`; anything that is not an `F-<n>` is a breakdown bug (D-194). */
function parseFindings(value: string, id: string, problems: string[]): string[] {
  const text = plain(value);
  if (text === '' || NONE.test(text)) return [];
  const items = text.split(/[,\s]+/).filter(Boolean);
  const bad = items.filter((item) => !/^F-\d+$/.test(item));
  if (bad.length > 0) problems.push(`${id}: \`Findings: ${bad.join(', ')}\` is not an F-<n> id.`);
  return items.filter((item) => /^F-\d+$/.test(item));
}

/** §16.6 (D-197): a task the owner drives in a session by hand; the driver never opens a session for it. */
export const ownerDriven = (task: Task): boolean => task.model === OWNER_DRIVEN;

/**
 * §16.3: "A task with no `Lane:` or no `Gate:` is a breakdown bug and the
 * driver refuses to run it." A task with no tier runs on `standard`, the
 * tier of §16.6's stated default.
 */
export function runBlockers(task: Task): string[] {
  const blockers: string[] = [];
  if (!task.lane) blockers.push('no `Lane:`');
  if (!task.gate) blockers.push('no `Gate:`');
  if (task.unknownAgent !== null) blockers.push(`\`Agent: ${task.unknownAgent}\` is not an entry of sdd.agents.json`);
  return blockers;
}

/** FR-SDD-11: the tier a task's session runs on; `standard` when the task names none. An owner-driven task has no session, so its tier is for reporting only. */
export const tierFor = (task: Task): Tier => task.tier ?? 'standard';

/** §16.3 (v2.2, D-659): `Fallback:` on the task wins over the `--fallback` flag; with neither written, the flag's default. */
export const fallbackFor = (task: Task, flag: boolean): boolean => task.fallback ?? flag;

/**
 * §16.3 (v2.2, D-659): the session caps a task runs under. `Turns:` sets the
 * implementation cap, and everything else — its wall clock, the review's cap
 * and clock — scales by the same factor, so a task given twice the turns is
 * given twice the time to spend them and a review sized to the diff.
 */
export function limitsFor(
  task: Task,
  base: { implement: { maxTurns: number; timeoutMs: number }; review: { maxTurns: number; timeoutMs: number } },
): { implement: { maxTurns: number; timeoutMs: number }; review: { maxTurns: number; timeoutMs: number } } {
  const factor = (task.turns ?? base.implement.maxTurns) / base.implement.maxTurns;
  const scale = (limit: { maxTurns: number; timeoutMs: number }) => ({ maxTurns: Math.round(limit.maxTurns * factor), timeoutMs: Math.round(limit.timeoutMs * factor) });
  return { implement: scale(base.implement), review: scale(base.review) };
}

export const byId = (tasks: readonly Task[], id: string): Task | undefined => tasks.find((task) => task.id.toLowerCase() === id.toLowerCase());
