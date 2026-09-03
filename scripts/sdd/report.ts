/**
 * PLAN §16.4 logging: `logs/sdd/<id>-<ISO8601>.log` holds the full session
 * transcript and every command the driver ran; `logs/sdd/run-<ISO8601>.json`
 * holds the run summary. `logs/` is git-ignored.
 */
import { createWriteStream, mkdirSync, writeFileSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

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

  constructor(path: string) {
    this.path = path;
    this.#stream = createWriteStream(path, { flags: 'a' });
  }

  line(text: string): void {
    consoleLine(text);
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
export function openTaskLog(id: string, dir = LOG_DIR, at = new Date()): Logger {
  mkdirSync(dir, { recursive: true });
  return new FileLogger(join(dir, `${id}-${stamp(at)}.log`));
}

export type TaskOutcome = 'merged' | 'awaiting-owner' | 'findings' | 'blocked' | 'failed' | 'refused';

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
  review: { findings: number } | null;
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
