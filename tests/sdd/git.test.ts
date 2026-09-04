/**
 * PLAN §16.4: the wait between `gh pr create` and the CI watch (D-98). Nothing
 * here reaches the network — the probe is what `gh pr checks` would have said.
 */
import { describe, expect, it } from 'vitest';
import { CHECKS_APPEAR_INTERVAL_MS, CHECKS_APPEAR_TIMEOUT_MS, waitForChecks } from '../../scripts/sdd/git';

/** A probe that reports "no checks" the first `times` calls, then reports checks. */
function appearsAfter(times: number): { missing: () => Promise<boolean>; calls: () => number } {
  let calls = 0;
  return {
    missing: () => {
      calls++;
      return Promise.resolve(calls <= times);
    },
    calls: () => calls,
  };
}

/** A clock that only moves when the loop sleeps, so a five-minute wait costs nothing to test. */
function fakeClock(): { now: () => number; sleep: (ms: number) => Promise<void>; slept: () => number[] } {
  let t = 1_000;
  const slept: number[] = [];
  return {
    now: () => t,
    sleep: (ms: number) => {
      slept.push(ms);
      t += ms;
      return Promise.resolve();
    },
    slept: () => slept,
  };
}

describe('waitForChecks', () => {
  it('returns at once when the checks are already there', async () => {
    const clock = fakeClock();
    const probe = appearsAfter(0);
    expect(await waitForChecks(probe.missing, clock)).toBe(true);
    expect(probe.calls()).toBe(1);
    expect(clock.slept()).toEqual([]);
  });

  it('waits out the window GitHub needs to register the workflow', async () => {
    const clock = fakeClock();
    const probe = appearsAfter(3); // the state that scored R29 red: a PR whose checks do not exist yet
    expect(await waitForChecks(probe.missing, { ...clock, intervalMs: 10_000 })).toBe(true);
    expect(probe.calls()).toBe(4);
    expect(clock.slept()).toEqual([10_000, 10_000, 10_000]);
  });

  it('gives up at the deadline, so a PR that never gets a workflow is still red', async () => {
    const clock = fakeClock();
    const probe = appearsAfter(Number.POSITIVE_INFINITY);
    expect(await waitForChecks(probe.missing, { ...clock, timeoutMs: 30_000, intervalMs: 10_000 })).toBe(false);
    expect(clock.slept()).toEqual([10_000, 10_000, 10_000]);
  });

  it('defaults to five minutes at ten-second steps', () => {
    expect(CHECKS_APPEAR_TIMEOUT_MS).toBe(300_000);
    expect(CHECKS_APPEAR_INTERVAL_MS).toBe(10_000);
  });
});
