/**
 * FR-SDD-1 (D-1058): the usage ledger. Every session the driver runs —
 * implementation, review and fix alike — is one JSON line in
 * `sdd-run/usage.jsonl`, read from `stream-json`'s final `result` event. The
 * file is local, as all of `sdd-run/` is; the PR body's usage line
 * (FR-SDD-20, `report.ts`) is the durable copy.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Relative to the driver's working directory, which outlives every task worktree. */
export const LEDGER_PATH = 'sdd-run/usage.jsonl';

type SessionKind = 'implement' | 'review' | 'fix';

/** What the final `result` event says the session spent. */
export interface ResultUsage {
  inputTokens: number;
  /** `cache_read_input_tokens`: input served from the prompt cache. */
  cachedInputTokens: number;
  /** `cache_creation_input_tokens`: input written to the prompt cache. */
  cacheCreationTokens: number;
  outputTokens: number;
  turns: number;
}

/** One ledger line: FR-SDD-1's fields, in its order. */
export interface LedgerEntry {
  /** ISO 8601, when the session ended. */
  at: string;
  task: string;
  kind: SessionKind;
  agent: string;
  /** `hard`, `standard` or `light` once R177 brings tiers (FR-SDD-10); `null` until then. */
  tier: string | null;
  model: string;
  /** The token fields and `turns` are `null` when the session left no `result` event (killed at the wall clock, never started). */
  inputTokens: number | null;
  cachedInputTokens: number | null;
  cacheCreationTokens: number | null;
  outputTokens: number | null;
  turns: number | null;
  wallMs: number;
  outcome: string;
}

interface ResultEvent {
  type?: string;
  num_turns?: unknown;
  usage?: {
    input_tokens?: unknown;
    cache_read_input_tokens?: unknown;
    cache_creation_input_tokens?: unknown;
    output_tokens?: unknown;
  };
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

/** The usage a `result` event carries, or `null` for any other event. */
export function usageFromResult(event: ResultEvent): ResultUsage | null {
  if (event.type !== 'result') return null;
  const usage = event.usage ?? {};
  return {
    inputTokens: count(usage.input_tokens),
    cachedInputTokens: count(usage.cache_read_input_tokens),
    cacheCreationTokens: count(usage.cache_creation_input_tokens),
    outputTokens: count(usage.output_tokens),
    turns: count(event.num_turns),
  };
}

export interface SessionRecord {
  task: string;
  kind: SessionKind;
  agent: string;
  tier: string | null;
  model: string;
  usage: ResultUsage | null;
  wallMs: number;
  outcome: string;
}

/** One session as a ledger line. */
export function ledgerEntry(record: SessionRecord, at = new Date()): LedgerEntry {
  const { usage } = record;
  return {
    at: at.toISOString(),
    task: record.task,
    kind: record.kind,
    agent: record.agent,
    tier: record.tier,
    model: record.model,
    inputTokens: usage?.inputTokens ?? null,
    cachedInputTokens: usage?.cachedInputTokens ?? null,
    cacheCreationTokens: usage?.cacheCreationTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    turns: usage?.turns ?? null,
    wallMs: Math.round(record.wallMs),
    outcome: record.outcome,
  };
}

/** Appends one line. A single short `appendFileSync` keeps concurrent tasks' lines whole. */
export function appendLedger(entry: LedgerEntry, path = LEDGER_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(entry)}\n`);
}

const isEntry = (value: unknown): value is LedgerEntry =>
  typeof value === 'object' && value !== null && typeof (value as LedgerEntry).task === 'string' && typeof (value as LedgerEntry).kind === 'string' && typeof (value as LedgerEntry).wallMs === 'number' && typeof (value as LedgerEntry).at === 'string';

/**
 * Every line of the ledger, in order; a missing file is an empty ledger and an
 * unreadable line is skipped. `task` filters to one task's sessions, `since`
 * to the sessions that ended at or after it (one driver run's).
 */
export function readLedger(path = LEDGER_PATH, task?: string, since?: Date): LedgerEntry[] {
  if (!existsSync(path)) return [];
  const from = since?.getTime() ?? -Infinity;
  const entries: LedgerEntry[] = [];
  // Read whole on each call (twice per task): a few hundred bytes a session, so a phase's file is small; rotate it if that ever stops being true.
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isEntry(parsed) && (task === undefined || parsed.task === task) && Date.parse(parsed.at) >= from) entries.push(parsed);
    } catch {
      // a torn or hand-edited line; the rest of the ledger still reads
    }
  }
  return entries;
}
