/**
 * PLAN §16.4 logging: `logs/sdd/<id>-<ISO8601>.log` holds the full session
 * transcript and every command the driver ran; `logs/sdd/run-<ISO8601>.json`
 * holds the run summary. `logs/` is git-ignored. FR-SDD-20: the PR body.
 */
import { createWriteStream, mkdirSync, writeFileSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import type { LedgerEntry } from './ledger';

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
  model: string;
  gate: string | null;
  pr: number | null;
  outcome: TaskOutcome;
  /** Why it ended where it did, in one line. */
  reason: string;
  worktree: string | null;
  log: string | null;
  durations: { implementMs?: number; ciMs?: number; reviewMs?: number; totalMs: number };
  /** §16.4 step 10 (D-197): every session the task ran, in order — a limit fallback is a second entry on the next model. */
  attempts: { stage: 'implement' | 'review'; model: string; outcome: string; durationMs: number }[];
  review: { findings: number; model: string } | null;
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

/** FR-SDD-20: a PR body's ceiling, in KB of UTF-8 (SPEC's constants table). */
export const PR_BODY_MAX_KB = 1.5;
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

/** `17.0M`, `56.7k`, `207`; `?` when the session left no count. */
export const tokens = (value: number | null): string => {
  if (value === null) return '?';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
};

/** FR-SDD-1: one session as the PR body's usage line. */
export function usageLine(entry: LedgerEntry): string {
  const who = [entry.agent, entry.tier, entry.model].filter((part): part is string => part !== null && part !== '').join(' ');
  const minutes = Math.max(1, Math.round(entry.wallMs / 60_000));
  const turns = entry.turns === null ? '?' : String(entry.turns);
  return `- ${entry.task} ${entry.kind} · ${who} · in ${tokens(entry.inputTokens)} · cached ${tokens(entry.cachedInputTokens)} · out ${tokens(entry.outputTokens)} · ${turns} turns · ${String(minutes)} min · ${entry.outcome}`;
}

/** Cuts a line to `max` bytes with an ellipsis, on a character boundary. */
function cut(line: string, max: number): string {
  if (bytes(line) <= max) return line;
  let out = '';
  for (const char of line) {
    if (bytes(`${out}${char}…`) > max) break;
    out += char;
  }
  return `${out}…`;
}

/**
 * FR-SDD-20: the body's fixed shape — what changed, the ids it closes, the
 * checks that ran, the capture diff summary and one usage line per session —
 * within `PR_BODY_MAX_KB`. The usage lines are never cut; what changed is
 * shortened first, then the id and check lists, to fit.
 */
export function prBody(input: PrBodyInput): string {
  const render = (changed: readonly string[], closes: string, checks: string): string =>
    [
      `Gate: ${String(input.gate)}`,
      '',
      '**What changed**',
      ...(changed.length > 0 ? changed.map((line) => `- ${line}`) : ['- _The session left no summary._']),
      '',
      `**Closes:** ${closes || '—'}`,
      `**Checks:** ${checks || '—'}`,
      `**Captures:** ${input.captureDiff ?? '—'}`,
      '',
      '**Usage**',
      ...(input.usage.length > 0 ? input.usage.map(usageLine) : ['- no session recorded']),
      '',
    ].join('\n');

  const changed = input.changed.map((line) => line.trim()).filter(Boolean).slice(0, CHANGED_LINES);
  let closes = input.closes.join(', ');
  let checks = input.checks.map((check) => `\`${check}\``).join(', ');
  let body = render(changed, closes, checks);
  if (bytes(body) <= PR_BODY_MAX_BYTES) return body;

  // What changed first: an equal share of what is left for each line.
  const fixed = bytes(render(changed.map(() => ''), closes, checks));
  const share = Math.floor((PR_BODY_MAX_BYTES - fixed) / Math.max(changed.length, 1));
  const shortened = changed.map((line) => cut(line, Math.max(share, 40)));
  body = render(shortened, closes, checks);
  if (bytes(body) <= PR_BODY_MAX_BYTES) return body;

  closes = cut(closes, 120);
  checks = cut(checks, 120);
  body = render(shortened, closes, checks);
  if (bytes(body) <= PR_BODY_MAX_BYTES) return body;
  return render(
    shortened.map((line) => cut(line, 40)),
    closes,
    checks,
  );
}

const HEADING = /^#{1,6}\s+/;

/** The lines under the first heading `name` matches, up to the next heading, or `null`. */
function section(summary: string, name: RegExp): string[] | null {
  const lines = summary.split('\n');
  const start = lines.findIndex((line) => HEADING.test(line.trim()) && name.test(line));
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && HEADING.test(line.trim()));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/**
 * FR-SDD-20: what changed, from the session's summary — the lines under a
 * `What changed` heading, else a `Summary` one, else the summary's first lines —
 * at most three, list markers dropped.
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
  for (const name of [/what changed/i, /summary/i]) {
    const lines = content(section(summary, name) ?? []);
    if (lines.length > 0) return lines;
  }
  return content(summary.split('\n'));
}

const ID = /\b(?:FR-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d+[a-z]?|NFR-[A-Z0-9]+-\d+|F-\d+|V\d+-\d+)\b/g;

/** FR-SDD-20: the task, its findings, then every requirement or finding id the summary names, once each. */
export function closedIds(task: string, findings: readonly string[], summary: string | null): string[] {
  return [...new Set([task, ...findings, ...(summary?.match(ID) ?? [])])];
}

const CHECK = /`((?:npm (?:test|run [\w:-]+)|npx (?:vitest|playwright|tsc|eslint|tsx)\b)[^`]*)`/g;

/** FR-SDD-20: the checks the summary says ran, as the commands it quotes, once each. */
export function checksRun(summary: string | null): string[] {
  if (summary === null) return [];
  return [...new Set([...summary.matchAll(CHECK)].map((match) => (match[1] ?? '').trim()))];
}
