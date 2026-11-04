/**
 * PLAN §16.4 step 10 (D-197): the account-limit signature, as the stream
 * carried it when wave 2 hit it on 2026-09-05 — a `rate_limit_event`, then a
 * synthetic sentence — and the sentence alone for a CLI that drops the event;
 * since R177 the session runs on the agent entry of `sdd.agents.json` (D-1064).
 */
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { limitFromText, loadAgents, pickAgent } from '../../scripts/sdd/agents';
import { readLedger } from '../../scripts/sdd/ledger';
import { limitFromEvent } from '../../scripts/sdd/parsers';
import type { Logger } from '../../scripts/sdd/report';
import { limitNote, MAX_RESET_WAIT_MS, RESET_MARGIN_MS, resetWaitMs, runSession } from '../../scripts/sdd/session';

const agent = pickAgent(loadAgents());

/** A stand-in for the `claude` child: the test drives its stdout and its `error` and `close` events. */
class FakeChild extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  readonly pid = undefined;
  readonly kill = vi.fn();
}

const children: FakeChild[] = [];
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const child = new FakeChild();
    children.push(child);
    return child;
  }),
}));

/** Verbatim from `logs/sdd/R42-2026-09-05T21-18-43-739Z.log`. */
const EVENT = JSON.parse(
  '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","resetsAt":1788646200,"rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false,"unifiedWindows":{"five_hour":{"utilization":1,"resetsAt":1788646200},"seven_day":{"utilization":0.41,"resetsAt":1788660000}}},"uuid":"3b171903-e9a6-43a6-96f5-0fc8a177e183","session_id":"df51dabe-d765-4faf-a2c9-c566c702586d"}',
) as Parameters<typeof limitFromEvent>[0];

/** Verbatim from R175's log of 2026-11-04: one model's own weekly window, with every model's at 75 %. */
const MODEL_WEEKLY = JSON.parse(
  '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","resetsAt":1794103200,"rateLimitType":"seven_day_overage_included","overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false,"unifiedWindows":{"five_hour":{"utilization":0.36,"resetsAt":1793768400,"status":"allowed"},"seven_day":{"utilization":0.75,"resetsAt":1794103200,"status":"allowed_warning","surpassedThreshold":0.75},"seven_day_overage_included":{"utilization":1,"resetsAt":1794103200,"status":"rejected","surpassedThreshold":1}}},"uuid":"98e9bd30-5e4d-4e9a-a79e-19746d0a60c6","session_id":"44749359-8a92-494c-a4a9-517d5282996f"}',
) as Parameters<typeof limitFromEvent>[0];
/** The same session's result sentence. */
const MODEL_WEEKLY_TEXT = "You've reached your Fable limit. Switch to another model, or manage usage credits at https://claude.ai/settings/usage?from=cc_cli_limit_message, to continue.";

describe('limitFromEvent', () => {
  it('reads the rejected five-hour window and its reset, and calls it account-wide', () => {
    expect(limitFromEvent(EVENT, agent.limit)).toEqual({ window: 'five_hour', resetsAt: 1788646200_000, accountWide: true });
    expect(limitFromEvent({ ...EVENT, rate_limit_info: { ...EVENT.rate_limit_info, rateLimitType: 'seven_day' } }, agent.limit)?.accountWide).toBe(true);
  });

  it("calls one model's own weekly window not account-wide, by its event and by its sentence (R175, 2026-11-04)", () => {
    expect(limitFromEvent(MODEL_WEEKLY, agent.limit)).toEqual({ window: 'seven_day_overage_included', resetsAt: 1794103200_000, accountWide: false });
    expect(limitFromText(agent.limit, MODEL_WEEKLY_TEXT)).toMatchObject({ accountWide: false });
    expect(limitNote('implement', { window: 'seven_day_overage_included', resetsAt: null, accountWide: false }, false)).toMatch(/its model's own limit .*fallback is off/);
    expect(limitNote('implement', { window: 'five_hour', resetsAt: null, accountWide: true }, true)).toMatch(/the account limit .*no tier escapes it/);
  });

  it('ignores an allowed event and every other event type', () => {
    expect(limitFromEvent({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour' } }, agent.limit)).toBeNull();
    expect(limitFromEvent({ type: 'result' }, agent.limit)).toBeNull();
    expect(limitFromEvent({ type: 'assistant' }, agent.limit)).toBeNull();
  });
});

describe('resetWaitMs (D-835)', () => {
  const now = 1788646200_000 - 30 * 60_000;
  const limit = { window: 'five_hour', resetsAt: 1788646200_000, accountWide: true };

  it('waits to the reset and the margin past it', () => {
    expect(resetWaitMs(limit, now)).toBe(30 * 60_000 + RESET_MARGIN_MS);
  });

  it('waits only the margin when the reset has already passed', () => {
    expect(resetWaitMs(limit, limit.resetsAt + 60_000)).toBe(RESET_MARGIN_MS);
  });

  it('does not wait for an unknown reset, or one past the cap', () => {
    expect(resetWaitMs({ ...limit, resetsAt: null }, now)).toBeNull();
    expect(resetWaitMs(null, now)).toBeNull();
    expect(resetWaitMs({ ...limit, window: 'seven_day', resetsAt: now + 2 * 24 * 60 * 60_000 }, now)).toBeNull();
    expect(resetWaitMs({ ...limit, resetsAt: now + MAX_RESET_WAIT_MS }, now)).toBeNull();
  });
});

describe('runSession and the usage ledger (FR-SDD-1)', () => {
  const logger: Logger = { path: null, line: () => undefined, command: () => undefined, raw: () => undefined, close: () => undefined };
  const RESULT = '{"type":"result","subtype":"success","is_error":false,"num_turns":12,"result":"done","usage":{"input_tokens":30,"cache_read_input_tokens":4000,"cache_creation_input_tokens":500,"output_tokens":700}}';

  const start = (timeoutMs = 60_000, on = agent): { path: string; session: ReturnType<typeof runSession>; child: FakeChild } => {
    const path = join(mkdtempSync(join(tmpdir(), 'sdd-session-')), 'usage.jsonl');
    const session = runSession({ cwd: '.', prompt: 'p', agent: on, tier: 'standard', kind: 'implement', maxTurns: 10, timeoutMs, logger, ledger: { task: 'R9', path } });
    const child = children.at(-1);
    if (!child) throw new Error('spawn was not called');
    return { path, session, child };
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("FR-SDD-10: spawns the entry's command with the tier's model", async () => {
    const { session, child } = start();
    expect(vi.mocked(spawn).mock.lastCall?.slice(0, 2)).toEqual(['claude', ['-p', 'p', '--model', 'opus', '--permission-mode', 'acceptEdits', '--max-turns', '10', '--output-format', 'stream-json', '--verbose', '--allowedTools', expect.stringContaining('Bash(npm run:*)'), '--disallowedTools', expect.stringContaining('Bash(git push:*)')]]);
    child.emit('close', 0);
    await session;
  });

  it('records one line per session, with the usage the result event carried', async () => {
    const { path, session, child } = start();
    child.stdout.emit('data', Buffer.from(`${RESULT}\n`));
    child.emit('close', 0);
    const result = await session;
    expect(result.outcome).toBe('ok');
    const lines = readLedger(path);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ task: 'R9', kind: 'implement', agent: 'claude', tier: 'standard', model: 'opus', inputTokens: 30, cachedInputTokens: 4000, cacheCreationTokens: 500, outputTokens: 700, turns: 12, outcome: 'ok' });
  });

  it('records a spawn that fails once, with null usage, when both error and close fire', async () => {
    const { path, session, child } = start();
    child.emit('error', new Error('spawn claude ENOENT'));
    child.emit('close', null);
    const result = await session;
    expect(result.outcome).toBe('error');
    const lines = readLedger(path);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ outcome: 'error', inputTokens: null, cachedInputTokens: null, outputTokens: null, turns: null });
  });

  it('records a session killed at the wall clock with null usage', async () => {
    vi.useFakeTimers();
    const { path, session, child } = start(1_000);
    vi.advanceTimersByTime(1_000);
    child.emit('close', null);
    const result = await session;
    expect(result.outcome).toBe('timeout');
    expect(readLedger(path)).toEqual([expect.objectContaining({ outcome: 'timeout', inputTokens: null, turns: null })]);
  });

  it('FR-SDD-2: stops a session past a set ceiling and reports it as the wall clock does', async () => {
    const capped = { ...agent, tiers: { ...agent.tiers, standard: { ...agent.tiers.standard, tokenCeiling: 1_000 } } };
    const { path, session, child } = start(60_000, capped);
    const turn = (output: number): string => `${JSON.stringify({ type: 'assistant', message: { id: 'msg_1', usage: { input_tokens: 10, cache_read_input_tokens: 500, output_tokens: output } } })}\n`;
    child.stdout.emit('data', Buffer.from(turn(100)));
    expect(child.kill).not.toHaveBeenCalled();
    child.stdout.emit('data', Buffer.from(turn(600)));
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    child.emit('close', null);
    expect((await session).outcome).toBe('budget');
    expect(readLedger(path)[0]).toMatchObject({ outcome: 'budget' });
  });

  it('FR-SDD-2: stops nothing when no ceiling is set', async () => {
    const { session, child } = start();
    child.stdout.emit('data', Buffer.from(`${JSON.stringify({ type: 'assistant', message: { id: 'm', usage: { input_tokens: 10_000_000 } } })}\n${RESULT}\n`));
    child.emit('close', 0);
    expect(child.kill).not.toHaveBeenCalled();
    expect((await session).outcome).toBe('ok');
  });
});
