/**
 * PLAN §16.3: TASKS.md as the driver reads it.
 *
 * A task is one checkbox item — `- [x] **R15 — …**` — with its fields as
 * sub-bullets. The checkbox is the merged signal (§16.2): the driver reads
 * this file from `origin/main`, never from the working copy. `Lane:`,
 * `Model:` and `Gate:` arrive with the v1 tasks; R1–R15 and H predate them
 * and come back `null`, which is only an error for a task the driver is
 * asked to run (§16.3).
 *
 * Pure: the caller supplies the file's text, so the tests need no git.
 */

export const LANES = ['ui', 'chart', 'data', 'physics', 'live', 'window', 'docs'] as const; // `live` split from `ui` (D-132); `window` and `docs` for v1.1 (D-196)
/** §16.6 (D-197): `interactive` marks a task the owner drives by hand; the driver lists it and never runs it. */
export const MODELS = ['opus', 'fable', 'sonnet', 'haiku', 'interactive'] as const;
export const GATES = ['auto', 'owner'] as const;

export type Lane = (typeof LANES)[number];
export type Model = (typeof MODELS)[number];
/** A model `claude -p` can be given: every `Model:` but `interactive`. */
export type SessionModel = Exclude<Model, 'interactive'>;
export type Gate = (typeof GATES)[number];

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
  model: Model | null;
  gate: Gate | null;
  deps: readonly string[];
  /** §16.3 (v1.1): a file that must exist on `origin/main` before the task may start, or `null`. */
  precondition: string | null;
  /** §16.3 (v1.1): the `F-<n>` findings the task closes (D-194). */
  findings: readonly string[];
  /** Position in the file; the driver runs a wave in this order. */
  order: number;
}

export interface ParsedTasks {
  tasks: readonly Task[];
  /** Breakdown bugs found while reading: bad field values, duplicate ids, unknown dependencies. */
  problems: readonly string[];
}

const HEADING = /^- \[([ xX])\] \*\*([A-Z][A-Z0-9]*)(\s+\[P\])?\s+—\s+([\s\S]+?)\*\*/;
const FIELD = /^\s+- \*\*(Lane|Model|Gate|Depends on|Precondition|Findings):\*\*\s*(.*?)\s*$/;
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

/** Reads every task in TASKS.md, in file order. */
export function parseTasks(markdown: string): ParsedTasks {
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
        model: null,
        gate: null,
        deps: [],
        precondition: null,
        findings: [],
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
      current.model = parseEnum(value, MODELS);
      if (!current.model) problems.push(`${current.id}: \`Model: ${plain(value)}\` is not one of ${MODELS.join(', ')}.`);
    } else if (name === 'Gate') {
      current.gate = parseEnum(value, GATES);
      if (!current.gate) problems.push(`${current.id}: \`Gate: ${plain(value)}\` is not one of ${GATES.join(', ')}.`);
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
export const ownerDriven = (task: Task): boolean => task.model === 'interactive';

/**
 * §16.3: "A task with no `Lane:` or no `Gate:` is a breakdown bug and the
 * driver refuses to run it." `Model:` defaults to Opus (§16.6) rather than
 * refusing, since Opus is that table's stated default.
 */
export function runBlockers(task: Task): string[] {
  const blockers: string[] = [];
  if (!task.lane) blockers.push('no `Lane:`');
  if (!task.gate) blockers.push('no `Gate:`');
  return blockers;
}

/** §16.6: the model a task's session runs on; Opus is the default. An owner-driven task has no session, so it reads as Opus here only for reporting. */
export const modelFor = (task: Task): SessionModel => (task.model === null || task.model === 'interactive' ? 'opus' : task.model);

/** §16.6 (D-197): the review runs on Opus where it is the gate (`Gate: auto`) and on Sonnet where the owner reads the PR anyway. */
export const reviewModelFor = (task: Task): SessionModel => (task.gate === 'owner' ? 'sonnet' : 'opus');

/**
 * §16.4 step 10 (D-197): the model a limit-stopped session is retried on,
 * once, along `fable → opus → sonnet`; `null` at the end of the chain.
 */
export function nextModel(model: SessionModel): SessionModel | null {
  if (model === 'fable') return 'opus';
  if (model === 'opus') return 'sonnet';
  return null;
}

export const byId = (tasks: readonly Task[], id: string): Task | undefined => tasks.find((task) => task.id.toLowerCase() === id.toLowerCase());
