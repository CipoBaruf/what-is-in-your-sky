/**
 * PLAN §16.4 logging: `logs/sdd/<id>-<ISO8601>.log` holds the full session
 * transcript and every command the driver ran; `logs/sdd/run-<ISO8601>.json`
 * holds the run summary. `logs/` is git-ignored. FR-SDD-20: the PR body.
 */
import { createWriteStream, mkdirSync, writeFileSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { LedgerEntry } from './ledger';
import { PR_BODY_MAX_KB } from './limits';

export const LOG_DIR = 'logs/sdd';

/** ISO 8601 with the characters a file name cannot carry replaced. */
export const stamp = (at = new Date()): string => at.toISOString().replace(/[:.]/g, '-');

export interface Logger {
  /** The log file this writes to, or `null` for the console-only logger. */
  readonly path: string | null;
  /** One line, to the log and to the console. */
  line(text: string): void;
  /** A command the driver is about to run, to the log only. */
  command(file: string, args: readonly string[], cwd?: string): void;
  /** Raw session output, to the log only. */
  raw(chunk: string): void;
  close(): void;
}

const consoleLine = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/** A logger that prints and keeps nothing: `--status` and `--dry-run`. */
export const consoleLogger: Logger = {
  path: null,
  line: consoleLine,
  command: () => undefined,
  raw: () => undefined,
  close: () => undefined,
};

class FileLogger implements Logger {
  readonly path: string;
  readonly #stream: WriteStream;
  /** Put in front of every console line — the task id, when a wave runs more than one task at once (D-132). The file gets the line as is. */
  readonly #prefix: string;

  constructor(path: string, prefix = '') {
    this.path = path;
    this.#prefix = prefix;
    this.#stream = createWriteStream(path, { flags: 'a' });
  }

  line(text: string): void {
    consoleLine(this.#prefix ? text.replace(/^(\n*)/, `$1${this.#prefix}`) : text);
    this.#stream.write(`${text}\n`);
  }

  command(file: string, args: readonly string[], cwd?: string): void {
    this.#stream.write(`$ ${cwd ? `(${cwd}) ` : ''}${file} ${args.join(' ')}\n`);
  }

  raw(chunk: string): void {
    this.#stream.write(chunk);
  }

  close(): void {
    this.#stream.end();
  }
}

/** `logs/sdd/<id>-<ISO8601>.log`, created with its directory. */
export function openTaskLog(id: string, dir = LOG_DIR, at = new Date(), options: { prefixConsole?: boolean } = {}): Logger {
  mkdirSync(dir, { recursive: true });
  return new FileLogger(join(dir, `${id}-${stamp(at)}.log`), options.prefixConsole ? `[${id}] ` : '');
}

/** `limit` (v1.1): the account limit ended a session; the worktree is kept and `--wave` or `--task` resumes it once the window resets. */
type TaskOutcome = 'merged' | 'awaiting-owner' | 'findings' | 'blocked' | 'failed' | 'refused' | 'limit';

export interface TaskReport {
  id: string;
  branch: string;
  lane: string | null;
  /** FR-SDD-10, FR-SDD-11: the agent and the tier the implementation ran on, and the model the tier resolved to. */
  agent: string;
  tier: string;
  model: string;
  gate: string | null;
  pr: number | null;
  outcome: TaskOutcome;
  /** Why it ended where it did, in one line. */
  reason: string;
  worktree: string | null;
  log: string | null;
  durations: { implementMs?: number; ciMs?: number; reviewMs?: number; fixMs?: number; totalMs: number };
  /** §16.4 step 10 (D-197): every session the task ran, in order — a limit fallback is a second entry on the next tier. */
  attempts: { stage: 'implement' | 'review' | 'fix'; tier: string; model: string; outcome: string; durationMs: number }[];
  /** `null` when no review ran; `tier: null` when D-1065 skipped it for a docs-only diff. */
  review: { findings: number; tier: string | null; model: string | null } | null;
  /** FR-SDD-2: each session that spent past its tier's running 90th percentile, in one line; report-only. */
  overruns: string[];
}

export interface RunReport {
  startedAt: string;
  finishedAt: string;
  mode: string;
  tasks: TaskReport[];
}

/** `logs/sdd/run-<ISO8601>.json`; returns the path written. */
export function writeRunReport(report: RunReport, dir = LOG_DIR, at = new Date()): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `run-${stamp(at)}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  return path;
}

/** FR-SDD-20: a PR body's ceiling in bytes of UTF-8, from `limits.ts`. */
const PR_BODY_MAX_BYTES = Math.floor(PR_BODY_MAX_KB * 1024);
/** FR-SDD-20: what changed is at most this many lines. */
const CHANGED_LINES = 3;

export interface PrBodyInput {
  /** The task's `Gate:`, the body's first line (§16.4 step 4). */
  gate: string | null;
  /** What changed, at most three lines; longer input is cut. */
  changed: readonly string[];
  /** The ids the PR closes: the task, its findings, the requirements it covers. */
  closes: readonly string[];
  /** The checks that ran, as commands. */
  checks: readonly string[];
  /** The capture diff summary, one line; `null` when there is none. */
  captureDiff: string | null;
  /** The task's ledger lines, in order (FR-SDD-1). */
  usage: readonly LedgerEntry[];
}

const bytes = (text: string): number => Buffer.byteLength(text, 'utf8');

/** `17.0M`, `56.7k`, `207`; `?` when the session left no count. A value that rounds to `1000.0k` is `1.0M`. */
export const tokens = (value: number | null): string => {
  if (value === null) return '?';
  if (value >= 999_950) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
};

/** `23 min`, or seconds under a minute so a spawn that failed in milliseconds does not read as a real minute. */
const wallTime = (ms: number): string => (ms < 59_500 ? `${String(Math.round(ms / 1_000))} s` : `${String(Math.round(ms / 60_000))} min`);

/** FR-SDD-1: one session as the PR body's usage line. */
export function usageLine(entry: LedgerEntry): string {
  const who = [entry.agent, entry.tier, entry.model].filter((part): part is string => part !== null && part !== '').join(' ');
  const turns = entry.turns === null ? '?' : String(entry.turns);
  return `- ${entry.task} ${entry.kind} · ${who} · in ${tokens(entry.inputTokens)} · cached ${tokens(entry.cachedInputTokens)} · out ${tokens(entry.outputTokens)} · ${turns} turns · ${wallTime(entry.wallMs)} · ${entry.outcome}`;
}

/** The sum of one count over the folded sessions; `null` when none of them reported it. */
const total = (entries: readonly LedgerEntry[], pick: (entry: LedgerEntry) => number | null): number | null =>
  entries.some((entry) => pick(entry) !== null) ? entries.reduce((sum, entry) => sum + (pick(entry) ?? 0), 0) : null;

/** The sessions before the last few, folded into one total line. */
function foldedLine(entries: readonly LedgerEntry[]): string {
  const turns = total(entries, (entry) => entry.turns);
  return `- ${String(entries.length)} earlier session(s) · in ${tokens(total(entries, (entry) => entry.inputTokens))} · cached ${tokens(total(entries, (entry) => entry.cachedInputTokens))} · out ${tokens(total(entries, (entry) => entry.outputTokens))} · ${turns === null ? '?' : String(turns)} turns · ${wallTime(entries.reduce((sum, entry) => sum + entry.wallMs, 0))}`;
}

/** The last `keep` sessions one line each, the ones before them as one total line. */
function usageLines(entries: readonly LedgerEntry[], keep: number): string[] {
  if (entries.length === 0) return ['- no session recorded'];
  if (entries.length <= keep) return entries.map(usageLine);
  return [foldedLine(entries.slice(0, entries.length - keep)), ...entries.slice(-keep).map(usageLine)];
}

/** Cuts a line to `max` bytes with an ellipsis, on a character boundary and never inside a backtick code span. */
function cut(line: string, max: number): string {
  if (bytes(line) <= max) return line;
  let out = '';
  for (const char of line) {
    if (bytes(`${out}${char}…`) > max) break;
    out += char;
  }
  // An odd number of backticks means the cut fell inside a code span: drop the open span.
  if ((out.match(/`/g) ?? []).length % 2 === 1) out = out.slice(0, out.lastIndexOf('`')).trimEnd();
  return `${out}…`;
}

/** Whole items joined with `, ` within `max` bytes, the rest counted as `+N more`. */
function fitList(items: readonly string[], max: number): string {
  const joined = items.join(', ');
  if (bytes(joined) <= max) return joined;
  const kept: string[] = [];
  for (const item of items) {
    const more = `, +${String(items.length - kept.length - 1)} more`;
    if (bytes([...kept, item].join(', ') + more) > max) break;
    kept.push(item);
  }
  const rest = items.length - kept.length;
  return kept.length > 0 ? `${kept.join(', ')}, +${String(rest)} more` : `${String(rest)} item(s)`;
}

/** FR-SDD-20: at most this many sessions get their own usage line; the ones before them are one total line. */
const USAGE_LINES = 5;

/**
 * FR-SDD-20: the body's fixed shape — what changed, the ids it closes, the
 * checks that ran, the capture diff summary and the usage lines — within
 * `PR_BODY_MAX_KB`. The last `USAGE_LINES` sessions get a line each and the
 * earlier ones one total line. To fit, what changed is shortened first, then
 * the id and check lists and the capture line, then fewer sessions get their
 * own line; a body still over the ceiling loses whole lines from its end.
 */
export function prBody(input: PrBodyInput): string {
  const render = (changed: readonly string[], closes: string, checks: string, captures: string, keep: number): string =>
    [
      `Gate: ${String(input.gate)}`,
      '',
      '**What changed**',
      ...(changed.length > 0 ? changed.map((line) => `- ${line}`) : ['- _The session left no summary._']),
      '',
      `**Closes:** ${closes || '—'}`,
      `**Checks:** ${checks || '—'}`,
      `**Captures:** ${captures}`,
      '',
      '**Usage**',
      ...usageLines(input.usage, keep),
      '',
    ].join('\n');
  const fits = (text: string): boolean => bytes(text) <= PR_BODY_MAX_BYTES;

  const changed = input.changed.map((line) => line.trim()).filter(Boolean).slice(0, CHANGED_LINES);
  const quoted = input.checks.map((check) => `\`${check}\``);
  let closes = input.closes.join(', ');
  let checks = quoted.join(', ');
  let captures = input.captureDiff ?? '—';
  let body = render(changed, closes, checks, captures, USAGE_LINES);
  if (fits(body)) return body;

  // What changed first: an equal share of what is left for each line.
  const fixed = bytes(render(changed.map(() => ''), closes, checks, captures, USAGE_LINES));
  const share = Math.floor((PR_BODY_MAX_BYTES - fixed) / Math.max(changed.length, 1));
  let shortened = changed.map((line) => cut(line, Math.max(share, 40)));
  body = render(shortened, closes, checks, captures, USAGE_LINES);
  if (fits(body)) return body;

  closes = fitList(input.closes, 120);
  checks = fitList(quoted, 120);
  captures = cut(captures, 120);
  body = render(shortened, closes, checks, captures, USAGE_LINES);
  if (fits(body)) return body;

  shortened = shortened.map((line) => cut(line, 40));
  for (let keep = USAGE_LINES; keep >= 1; keep -= 1) {
    body = render(shortened, closes, checks, captures, keep);
    if (fits(body)) return body;
  }
  // Nothing left to shorten (very long agent or model names): drop whole lines from the end.
  const lines = body.split('\n');
  while (lines.length > 1 && !fits(`${lines.join('\n')}\n`)) lines.pop();
  return `${lines.join('\n')}\n`;
}

const HEADING = /^#{1,6}\s+/;
/** A heading's text: the line without its `#` marks. */
const headingText = (line: string): string => line.trim().replace(HEADING, '').trim();

/** The lines under the first heading whose text `name` matches, up to the next heading, or `null`. */
function section(summary: string, name: RegExp): string[] | null {
  const lines = summary.split('\n');
  const start = lines.findIndex((line) => HEADING.test(line.trim()) && name.test(headingText(line)));
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && HEADING.test(line.trim()));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/**
 * FR-SDD-20: what changed, from the session's summary — the lines under a
 * `What changed` heading, else a `Changes` one, else a `Summary` one, else the
 * summary's first lines — at most three, list markers dropped. The headings
 * must be the whole heading text, so a title such as `# R172 summary` is not
 * taken for the section.
 */
export function whatChanged(summary: string | null): string[] {
  if (summary === null) return [];
  const content = (lines: readonly string[]): string[] =>
    lines
      .map((line) => line.trim())
      .filter((line) => line !== '' && !HEADING.test(line) && !/^gate:/i.test(line))
      .map((line) => line.replace(/^([-*+]|\d+\.)\s+/, '').trim())
      .filter(Boolean)
      .slice(0, CHANGED_LINES);
  for (const name of [/^what changed\b/i, /^changes$/i, /^summary$/i]) {
    const lines = content(section(summary, name) ?? []);
    if (lines.length > 0) return lines;
  }
  return content(summary.split('\n'));
}

const ID_SOURCE = String.raw`\b(?:FR-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d+[a-z]?|NFR-[A-Z0-9]+-\d+|F-\d+|V\d+-\d+)\b`;
const ID = new RegExp(ID_SOURCE, 'g');
const ID_LIST = String.raw`${ID_SOURCE}(?:\s*(?:,|and|&)\s*${ID_SOURCE})*`;
/** A section whose ids the task closes: `## Requirements`, `## Closes`, `## Findings fixed`, `## Covered`. */
const CLOSING_SECTION = /requirement|clos|fixed|satisf|cover|done/i;
/** A section whose ids stay open, whatever its lines say. */
const OPEN_SECTION = /follow|open|left|assumption|out of scope|not done/i;
/** Outside a closing section, a verb that closes the ids right after it: `closes F-102`, `Fixes F-70, F-71`. */
const CLOSING_VERB = new RegExp(String.raw`\b(?:closes?|closed|fix(?:es|ed)?|satisf(?:y|ies|ied)|covers?|covered):?\s+(${ID_LIST})`, 'gi');
/** Outside a closing section, an id the line calls closed: `F-70 is fixed`, `FR-SDD-3 done`. */
const CLOSED_AFTER = new RegExp(String.raw`(${ID_SOURCE})\s+(?:is\s+|are\s+)?(?:closed|fixed|done)\b`, 'g');
/** A line that says the ids on it are not closed. */
const OPEN_WORDS = /\b(?:open|not|stays?|still|left|later|follow-?ups?|deferred|out of scope|remains?)\b/i;

/** The ids the summary marks as closed: every id on a line of a closing section, or the ids a line says it closes, and never on a line or in a section that says they stay open. */
function closedInSummary(summary: string): string[] {
  const ids: string[] = [];
  let heading = '';
  for (const raw of summary.split('\n')) {
    const line = raw.trim();
    if (HEADING.test(line)) {
      heading = headingText(line);
      continue;
    }
    if (OPEN_SECTION.test(heading) || OPEN_WORDS.test(line)) continue;
    if (CLOSING_SECTION.test(heading)) ids.push(...(line.match(ID) ?? []));
    else for (const match of [...line.matchAll(CLOSING_VERB), ...line.matchAll(CLOSED_AFTER)]) ids.push(...((match[1] ?? '').match(ID) ?? []));
  }
  return ids;
}

/** FR-SDD-20: the task, its findings, then every requirement or finding id the summary marks as closed, once each. */
export function closedIds(task: string, findings: readonly string[], summary: string | null): string[] {
  return [...new Set([task, ...findings, ...(summary === null ? [] : closedInSummary(summary))])];
}

const CHECK = /`((?:npm (?:test|run [\w:-]+)|npx (?:vitest|playwright|tsc|eslint|tsx)\b)[^`]*)`/g;

/** FR-SDD-20: the checks the summary says ran, as the commands it quotes, once each. */
export function checksRun(summary: string | null): string[] {
  if (summary === null) return [];
  return [...new Set([...summary.matchAll(CHECK)].map((match) => (match[1] ?? '').trim()))];
}
