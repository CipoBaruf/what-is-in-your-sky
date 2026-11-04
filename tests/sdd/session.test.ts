/**
 * PLAN §16.4 step 10 (D-197): the account-limit signature, as the stream
 * carried it when wave 2 hit it on 2026-09-05 — a `rate_limit_event`, then a
 * synthetic sentence — and the sentence alone for a CLI that drops the event.
 */
import { EventEmitter } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLedger } from '../../scripts/sdd/ledger';
import type { Logger } from '../../scripts/sdd/report';
import { isLimitStop, limitFromEvent, MAX_RESET_WAIT_MS, RESET_MARGIN_MS, resetWaitMs, runSession } from '../../scripts/sdd/session';

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

describe('limitFromEvent', () => {
  it('reads the rejected five-hour window and its reset, and calls it account-wide', () => {
    expect(limitFromEvent(EVENT)).toEqual({ window: 'five_hour', resetsAt: 1788646200_000, accountWide: true });
    expect(limitFromEvent({ ...EVENT, rate_limit_info: { ...EVENT.rate_limit_info, rateLimitType: 'seven_day' } })?.accountWide).toBe(true);
  });

  it('ignores an allowed event and every other event type', () => {
    expect(limitFromEvent({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', rateLimitType: 'five_hour' } })).toBeNull();
    expect(limitFromEvent({ type: 'result' })).toBeNull();
    expect(limitFromEvent({ type: 'assistant' })).toBeNull();
  });
});

describe('isLimitStop', () => {
  it('recognises the synthetic sentence in each wording, and the API rate-limit error', () => {
    expect(isLimitStop("You've hit your session limit · resets 7:10pm (America/Argentina/Salta)")).toBe(true);
    expect(isLimitStop("You've hit your weekly limit · resets Tue 9am")).toBe(true);
    expect(isLimitStop("You've hit your limit · resets 3pm (Europe/Madrid)")).toBe(true);
    expect(isLimitStop('Claude AI usage limit reached|1757100000')).toBe(true);
    expect(isLimitStop('API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"..."}}')).toBe(true);
    expect(isLimitStop("You're out of extra usage")).toBe(true);
  });

  it('leaves an ordinary result alone', () => {
    expect(isLimitStop('Done: R41 checked off, summary written.')).toBe(false);
    expect(isLimitStop('The limit of the fit rule is 80 % of the width.')).toBe(false);
    expect(isLimitStop('The rate limit on the geocoder is one request a second.')).toBe(false);
    expect(isLimitStop(null)).toBe(false);
    expect(isLimitStop(undefined)).toBe(false);
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

  const start = (timeoutMs = 60_000): { path: string; session: ReturnType<typeof runSession>; child: FakeChild } => {
    const path = join(mkdtempSync(join(tmpdir(), 'sdd-session-')), 'usage.jsonl');
    const session = runSession({ cwd: '.', prompt: 'p', model: 'opus', maxTurns: 10, timeoutMs, allowedTools: [], logger, ledger: { task: 'R9', kind: 'implement', agent: 'claude', tier: null, path } });
    const child = children.at(-1);
    if (!child) throw new Error('spawn was not called');
    return { path, session, child };
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('records one line per session, with the usage the result event carried', async () => {
    const { path, session, child } = start();
    child.stdout.emit('data', Buffer.from(`${RESULT}\n`));
    child.emit('close', 0);
    const result = await session;
    expect(result.outcome).toBe('ok');
    const lines = readLedger(path);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ task: 'R9', kind: 'implement', agent: 'claude', tier: null, model: 'opus', inputTokens: 30, cachedInputTokens: 4000, cacheCreationTokens: 500, outputTokens: 700, turns: 12, outcome: 'ok' });
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
});
