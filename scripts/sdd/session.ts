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

/** §16.4: file reads and writes, Grep/Glob, the project's commands, and the safe half of git. */
export const IMPLEMENT_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'TodoWrite',
  'Skill',
  'Bash(npm run:*)',
  'Bash(npx vitest:*)',
  'Bash(npx playwright:*)',
  'Bash(npx tsc:*)',
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'Bash(git status:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
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

export type SessionOutcome = 'ok' | 'error' | 'timeout' | 'max-turns';

export interface SessionResult {
  outcome: SessionOutcome;
  code: number | null;
  durationMs: number;
  /** The session's final message, when `--output-format stream-json` gave one. */
  result: string | null;
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
    let pending = '';

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
        const event = JSON.parse(line) as { type?: string; subtype?: string; result?: string; is_error?: boolean };
        if (event.type !== 'result') return;
        result = event.result ?? null;
        if (event.subtype === 'error_max_turns') outcome = 'max-turns';
        else if (event.is_error === true || (event.subtype && event.subtype !== 'success')) outcome = 'error';
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
    child.stderr.on('data', (chunk: Buffer) => logger.raw(chunk.toString()));
    child.on('error', (error) => {
      clearTimeout(timer);
      logger.line(`  session could not start: ${error.message}`);
      resolve({ outcome: 'error', code: null, durationMs: Date.now() - startedAt, result: null });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      readLine(pending);
      if (timedOut) outcome = 'timeout';
      else if (code !== 0 && outcome === 'ok') outcome = 'error';
      resolve({ outcome, code, durationMs: Date.now() - startedAt, result });
    });
  });
}
