/**
 * PLAN §16.4 step 10 (D-197): the account-limit signature, which is what
 * turns a session's end into a `limit` outcome and a retry on the next model.
 */
import { describe, expect, it } from 'vitest';
import { isLimitStop } from '../../scripts/sdd/session';

describe('isLimitStop', () => {
  it('recognises the CLI wordings and the API rate-limit error', () => {
    expect(isLimitStop("You've hit your limit · resets 3pm (Europe/Madrid)")).toBe(true);
    expect(isLimitStop('Claude AI usage limit reached|1757100000')).toBe(true);
    expect(isLimitStop('API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"..."}}')).toBe(true);
    expect(isLimitStop("You're out of extra usage")).toBe(true);
  });

  it('leaves an ordinary result alone', () => {
    expect(isLimitStop('Done: R41 checked off, summary written.')).toBe(false);
    expect(isLimitStop('The limit of the fit rule is 80 % of the width.')).toBe(false);
    expect(isLimitStop(null)).toBe(false);
    expect(isLimitStop(undefined)).toBe(false);
  });
});
