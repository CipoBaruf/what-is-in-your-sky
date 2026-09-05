/**
 * PLAN §16.4 step 3 and step 6: the one-shot `claude -p` sessions the driver
 * runs, and the tool allowlist that keeps them inside the task.
 *
 * A session edits files, runs the project's own commands and commits. It may
 * not push, may not call `gh`, may not reach the network and may not run
 * prettier (this repository is not formatted with it). Publishing is the
 * driver's job.
 */
import { spawn } from 'node:child_process';
import type { Logger } from './report';

/**
 * §16.4: file reads and writes, Grep/Glob, the project's commands, the shell
 * tools that look at what they produced, and the safe half of git.
 *
 * The list has to cover the commands the tasks are actually written in, or a
 * session ships code it could not run: R20's was refused `npm test` (its own
 * package script, which is `npm test`, not `npm run test`), `npx tsx
 * scripts/contrast.ts` — the script its acceptance names — `node`, and every
 * compound command with an `echo` or a `cat` in it, so it wrote a theme it
 * never executed and CI found the failure (D-101).
 *
 * Breadth here is not the fence. A session that may run `npx vitest` already
 * runs whatever the repository's own test files run; what keeps it inside the
 * task is the *disallowed* list — no push, no `gh`, no `rm`, no network — and
 * that is unchanged.
 */
export const IMPLEMENT_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'TodoWrite',
  'Skill',
  'Bash(npm run:*)',
  'Bash(npm test:*)',
  'Bash(npm ci:*)',
  'Bash(npx vitest:*)',
  'Bash(npx playwright:*)',
  'Bash(npx tsc:*)',
  'Bash(npx eslint:*)',
  'Bash(npx tsx:*)',
  'Bash(node:*)',
  'Bash(cat:*)',
  'Bash(ls:*)',
  'Bash(head:*)',
  'Bash(tail:*)',
  'Bash(wc:*)',
  'Bash(sed:*)',
  'Bash(awk:*)',
  'Bash(find:*)',
  'Bash(echo:*)',
  'Bash(mkdir:*)',
  'Bash(cp:*)',
  'Bash(mv:*)',
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
] as const;

/** The review session reads and reports; it does not edit the branch. */
export const REVIEW_TOOLS = ['Read', 'Write', 'Glob', 'Grep', 'Skill', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git status:*)'] as const;

/**
 * §16.4. Denials win over the allowlist, which is what makes
 * `Bash(git add -A:*)` meaningful beside `Bash(git add:*)`: this repository
 * has parallel sessions sharing a checkout.
 */
export const DENIED_TOOLS = [
  'Bash(git push:*)',
  'Bash(git add -A:*)',
  'Bash(git add .:*)',
  'Bash(gh:*)',
  'Bash(rm:*)',
  'Bash(curl:*)',
  'Bash(wget:*)',
  'Bash(prettier:*)',
  'Bash(npx prettier:*)',
  'WebFetch',
  'WebSearch',
  'Task',
] as const;

/** `limit` (v1.1, D-197): the session ended on the account's usage limit and `--fallback` may retry it on the next model. */
export type SessionOutcome = 'ok' | 'error' | 'timeout' | 'max-turns' | 'limit';

/**
 * §16.4 step 10: the account-limit signature, as captured on 2026-09-05 when
 * wave 2 hit it. The stream carries a `rate_limit_event` whose
 * `rate_limit_info.status` is `rejected`, then a synthetic assistant message
 * "You've hit your session limit · resets 7:10pm (…)", then an ordinary
 * `result` whose text is that sentence. The event names the window
 * (`five_hour`, `seven_day`) and `resetsAt` in epoch seconds; both windows
 * are the account's, shared by every model, so a retry on another model
 * meets the same wall. The text is matched too, for a CLI that changes the
 * event before it changes the sentence.
 */
export const LIMIT_SIGNATURE = /hit your (session |weekly |usage )?limit|usage limit|limit reached|out of extra usage|rate_limit_error/i;

export const isLimitStop = (text: string | null | undefined): boolean => text !== null && text !== undefined && LIMIT_SIGNATURE.test(text);

export interface LimitInfo {
  /** `five_hour`, `seven_day`, or whatever the event said; `null` when only the sentence was seen. */
  window: string | null;
  /** Epoch milliseconds, or `null` when the event did not say. */
  resetsAt: number | null;
  /** The account's shared windows: a model change does not escape them (§16.4 step 10, as amended). */
  accountWide: boolean;
}

interface RateLimitEvent {
  type?: string;
  rate_limit_info?: { status?: string; resetsAt?: number; rateLimitType?: string };
}

/** The limit a stream event announces, or `null` for any other event. */
export function limitFromEvent(event: RateLimitEvent): LimitInfo | null {
  if (event.type !== 'rate_limit_event' || event.rate_limit_info?.status !== 'rejected') return null;
  const info = event.rate_limit_info;
  const window = info.rateLimitType ?? null;
  return { window, resetsAt: typeof info.resetsAt === 'number' ? info.resetsAt * 1000 : null, accountWide: window === null || window === 'five_hour' || window === 'seven_day' };
}

/** `19:10` in the machine's zone, for the log and the run summary. */
export const resetTime = (limit: LimitInfo | null): string => (limit?.resetsAt ? new Date(limit.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'unknown');

export interface SessionResult {
  outcome: SessionOutcome;
  code: number | null;
  durationMs: number;
  /** The session's final message, when `--output-format stream-json` gave one. */
  result: string | null;
  /** What the limit said, when `outcome` is `limit`. */
  limit: LimitInfo | null;
}

export interface SessionOptions {
  cwd: string;
  /** One line (§16.4 step 3). */
  prompt: string;
  model: string;
  maxTurns: number;
  timeoutMs: number;
  allowedTools: readonly string[];
  logger: Logger;
  env?: Record<string, string>;
}

/** Runs one `claude -p` session to completion, or kills it at the wall clock. */
export function runSession(options: SessionOptions): Promise<SessionResult> {
  const { cwd, prompt, model, maxTurns, timeoutMs, allowedTools, logger, env } = options;
  const args = [
    '-p',
    prompt,
    '--model',
    model,
    '--permission-mode',
    'acceptEdits',
    '--max-turns',
    String(maxTurns),
    '--output-format',
    'stream-json',
    '--verbose',
    '--allowedTools',
    allowedTools.join(','),
    '--disallowedTools',
    DENIED_TOOLS.join(','),
  ];
  logger.command('claude', args, cwd);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn('claude', args, {
      cwd,
      detached: true,
      env: { ...process.env, SDD_HEADLESS: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let timedOut = false;
    let outcome: SessionOutcome = 'ok';
    let result: string | null = null;
    let limit: LimitInfo | null = null;
    let pending = '';
    let stderr = '';

    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    }, timeoutMs);

    const readLine = (line: string): void => {
      if (!line.trim()) return;
      logger.raw(`${line}\n`);
      try {
        const event = JSON.parse(line) as { type?: string; subtype?: string; result?: string; is_error?: boolean } & RateLimitEvent;
        const announced = limitFromEvent(event);
        if (announced) {
          limit = announced;
          outcome = 'limit';
          return;
        }
        if (event.type !== 'result') return;
        result = event.result ?? null;
        if (outcome === 'limit') return; // the event already said so; the result is the synthetic sentence
        if (event.subtype === 'error_max_turns') outcome = 'max-turns';
        else if (isLimitStop(result)) {
          outcome = 'limit';
          limit ??= { window: null, resetsAt: null, accountWide: true };
        } else if (event.is_error === true || (event.subtype && event.subtype !== 'success')) outcome = 'error';
      } catch {
        // not a JSON event line; it is already in the log
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
      stderr += text.slice(-2000);
      logger.raw(text);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      logger.line(`  session could not start: ${error.message}`);
      resolve({ outcome: 'error', code: null, durationMs: Date.now() - startedAt, result: null, limit: null });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      readLine(pending);
      if (timedOut) outcome = 'timeout';
      else if (outcome !== 'max-turns' && outcome !== 'limit' && isLimitStop(stderr)) {
        outcome = 'limit';
        limit ??= { window: null, resetsAt: null, accountWide: true };
      } else if (code !== 0 && outcome === 'ok') outcome = 'error';
      resolve({ outcome, code, durationMs: Date.now() - startedAt, result, limit: outcome === 'limit' ? limit : null });
    });
  });
}
