/**
 * PLAN §16.4 step 3 and step 6: the one-shot sessions the driver runs. Since
 * R177 (D-1064) the command line, the model per tier, the tool policy and the
 * result parser all come from the agent's entry in `sdd.agents.json`.
 *
 * A session edits files, runs the project's own commands and commits. It may
 * not push, may not call `gh`, may not reach the network and may not run
 * prettier (this repository is not formatted with it): the entry's denied
 * list says so to an agent that takes one. Publishing is the driver's job.
 */
import { spawn } from 'node:child_process';
import { buildArgv, type Agent, type LimitInfo, type SessionKind, type Tier } from './agents';
import { appendLedger, ledgerEntry, type ResultUsage } from './ledger';
import { PARSERS, StreamTokens, type SessionOutcome } from './parsers';
import type { Logger } from './report';

/** §16.4 step 10 (D-835): how long past the reset a resumed session starts, so the window has turned over. */
export const RESET_MARGIN_MS = 2 * 60_000;
/** D-835: the longest a run waits for a reset; a weekly window days away ends the task `limit` instead. */
export const MAX_RESET_WAIT_MS = 6 * 60 * 60_000;
/** D-835: how many times one stage of one task waits and resumes before it gives up. */
export const MAX_RESET_WAITS = 3;

/** D-835: milliseconds to wait before resuming after `limit`, or `null` when the reset is unknown or too far off to wait for. */
export function resetWaitMs(limit: LimitInfo | null, now: number, maxMs: number = MAX_RESET_WAIT_MS): number | null {
  if (!limit?.resetsAt) return null;
  const wait = Math.max(limit.resetsAt - now, 0) + RESET_MARGIN_MS;
  return wait > maxMs ? null : wait;
}

/** `19:10` in the machine's zone, for the log and the run summary. */
export const resetTime = (limit: LimitInfo | null): string => (limit?.resetsAt ? new Date(limit.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown');

/**
 * §16.4 step 10: the log line for a limit the run does not retry. A window
 * every model shares is the account's; any other (R175's, 2026-11-04: one
 * model's weekly window) is that model's, and only the fallback setting kept
 * the run from another tier.
 */
export function limitNote(stage: string, limit: LimitInfo | null, fallback: boolean): string {
  const window = `${limit?.window ?? 'window unknown'}, resets ${resetTime(limit)}`;
  if (limit?.accountWide !== false) return `  the ${stage} session ended on the account limit (${window}); no tier escapes it, the worktree is kept`;
  return `  the ${stage} session ended on its model's own limit (${window}); ${fallback ? 'no tier is left in the fallback chain' : 'fallback is off for this task'}, the worktree is kept`;
}

export interface SessionResult {
  outcome: SessionOutcome;
  code: number | null;
  durationMs: number;
  /** The session's final message, where the parser found one. */
  result: string | null;
  /** What the limit said, when `outcome` is `limit`. */
  limit: LimitInfo | null;
  /** FR-SDD-1: what the session says it spent, or `null` when it left nothing to read. */
  usage: ResultUsage | null;
  /** The model the tier resolved to. */
  model: string;
}

export interface SessionOptions {
  cwd: string;
  prompt: string;
  agent: Agent;
  tier: Tier;
  kind: SessionKind;
  maxTurns: number;
  timeoutMs: number;
  logger: Logger;
  env?: Record<string, string>;
  /** The file whose presence says the session finished (`exit-code` only); relative to `cwd`. */
  handoff?: string;
  /** FR-SDD-1 (D-1058): append one ledger line, at `path` or `LEDGER_PATH`, when the session ends. */
  ledger?: { task: string; path?: string };
}

/** The output tail kept for an `exit-code` agent's limit detection. */
const TAIL_KEEP = 8000;
/** The rejected limit events kept for a `stream-json` session. */
const EVENTS_KEEP = 20;

/** Runs one session to completion, or kills it at the wall clock or past its tier's token ceiling. */
export function runSession(options: SessionOptions): Promise<SessionResult> {
  const { cwd, prompt, agent, tier, kind, maxTurns, timeoutMs, logger, env, handoff, ledger } = options;
  const { model, tokenCeiling } = agent.tiers[tier];
  const { file, args } = buildArgv(agent, { prompt, model, maxTurns, kind });
  const parse = PARSERS[agent.parser];
  logger.command(file, args, cwd);
  const startedAt = Date.now();

  let recorded = false;
  const finish = (result: SessionResult): SessionResult => {
    // `error` and `close` can both fire for one child; the ledger gets one line.
    if (ledger && !recorded) {
      recorded = true;
      try {
        appendLedger(ledgerEntry({ task: ledger.task, kind, agent: agent.name, tier, model, usage: result.usage, wallMs: result.durationMs, outcome: result.outcome }), ledger.path);
      } catch (error) {
        logger.line(`  usage ledger: could not append (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    return result;
  };

  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd,
      detached: true,
      env: { ...process.env, SDD_HEADLESS: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stopped: 'timeout' | 'budget' | null = null;
    // What the parser needs, not the whole stream: the rejected limit events and the last result event
    // (`stream-json`), and a bounded tail of the output for limit detection (`exit-code`).
    let events: string[] = [];
    let tail = '';
    let pending = '';
    let stderr = '';
    const tokens = new StreamTokens();

    const kill = (why: 'timeout' | 'budget'): void => {
      stopped ??= why;
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
          return;
        } catch {
          // fall through to the child alone
        }
      }
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => {
      kill('timeout');
    }, timeoutMs);

    const readLine = (line: string): void => {
      if (!line.trim()) return;
      logger.raw(`${line}\n`);
      tail = `${tail}${line}\n`.slice(-TAIL_KEEP);
      if (line.includes('"type":"result"')) events = [...events.filter((kept) => !kept.includes('"type":"result"')), line];
      else if (line.includes('"rate_limit_event"') && line.includes('"rejected"')) events = [...events, line].slice(-EVENTS_KEEP);
      // FR-SDD-2: a set ceiling stops the session as the wall clock does.
      if (tokenCeiling !== undefined && agent.parser === 'stream-json' && tokens.add(line) > tokenCeiling && stopped === null) {
        logger.line(`  the session passed the ${tier} tier's ceiling of ${String(tokenCeiling)} tokens; stopping it (FR-SDD-2)`);
        kill('budget');
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      pending += chunk.toString();
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) readLine(line);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr = (stderr + text).slice(-2000);
      logger.raw(text);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      logger.line(`  session could not start: ${error.message}`);
      resolve(finish({ outcome: 'error', code: null, durationMs: Date.now() - startedAt, result: null, limit: null, usage: null, model }));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      readLine(pending);
      const parsed = parse(agent.parser === 'stream-json' ? events.join('\n') : tail, code, handoff === undefined ? null : `${cwd}/${handoff}`, { limit: agent.limit, stderr });
      const outcome = stopped ?? parsed.outcome;
      resolve(finish({ outcome, code, durationMs: Date.now() - startedAt, result: parsed.text, limit: outcome === 'limit' ? parsed.limit : null, usage: parsed.usage, model }));
    });
  });
}
