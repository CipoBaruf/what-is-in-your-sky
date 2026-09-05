/**
 * PLAN §16.4 step 10 (D-197): the account-limit signature, as the stream
 * carried it when wave 2 hit it on 2026-09-05 — a `rate_limit_event`, then a
 * synthetic sentence — and the sentence alone for a CLI that drops the event.
 */
import { describe, expect, it } from 'vitest';
import { isLimitStop, limitFromEvent } from '../../scripts/sdd/session';

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
