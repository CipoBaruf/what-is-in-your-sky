/**
 * PLAN §16.4: the wait between `gh pr create` and the CI watch (D-98). Nothing
 * here reaches the network — the probe is what `gh pr checks` would have said.
 */
import { describe, expect, it } from 'vitest';
import { CHECKS_APPEAR_INTERVAL_MS, CHECKS_APPEAR_TIMEOUT_MS, checksExist, waitForChecks, type ExecResult } from '../../scripts/sdd/git';

/** A probe whose checks appear on call `times + 1`. */
function appearsAfter(times: number): { exists: () => Promise<boolean>; calls: () => number } {
  let calls = 0;
  return {
    exists: () => {
      calls++;
      return Promise.resolve(calls > times);
    },
    calls: () => calls,
  };
}

const result = (code: number, stdout = '', stderr = ''): ExecResult => ({ code, stdout, stderr });

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

describe('checksExist', () => {
  // gh's own words in the window this is all about, taken from the R29 run's log.
  const NOT_REGISTERED_YET = result(1, '', "no checks reported on the 'r29-the-moon-lore-data' branch\n");

  it('reads the exit code where the exit code says it: 0 finished, 8 pending', () => {
    expect(checksExist(result(0, 'ci\tpass\t2m14s\n'))).toBe(true);
    expect(checksExist(result(8, 'ci\tpending\t0\n'))).toBe(true);
  });

  it('separates a red check from a PR whose workflow has not registered — both exit 1', () => {
    expect(checksExist(result(1, 'ci\tfail\t1m02s\n'))).toBe(true);
    expect(checksExist(NOT_REGISTERED_YET)).toBe(false);
  });

  it('treats a call that could not answer — a 404 from an API still catching up, a rate limit, no network — as "not yet"', () => {
    // These exit 1 too, and gh writes them to stderr with nothing on stdout, where a red check would have printed its table.
    expect(checksExist(result(1, '', 'GraphQL: Could not resolve to a PullRequest with the number of 28.'))).toBe(false);
    expect(checksExist(result(1, '', 'HTTP 429: API rate limit exceeded'))).toBe(false);
    expect(checksExist(result(4, '', 'gh: authentication required'))).toBe(false);
    expect(checksExist(result(127, '', 'spawn gh ENOENT'))).toBe(false);
  });
});

describe('waitForChecks', () => {
  it('returns at once when the checks are already there', async () => {
    const clock = fakeClock();
    const probe = appearsAfter(0);
    expect(await waitForChecks(probe.exists, clock)).toBe(true);
    expect(probe.calls()).toBe(1);
    expect(clock.slept()).toEqual([]);
  });

  it('waits out the window GitHub needs to register the workflow', async () => {
    const clock = fakeClock();
    const probe = appearsAfter(3); // the state that scored R29 red: a PR whose checks do not exist yet
    expect(await waitForChecks(probe.exists, { ...clock, intervalMs: 10_000 })).toBe(true);
    expect(probe.calls()).toBe(4);
    expect(clock.slept()).toEqual([10_000, 10_000, 10_000]);
  });

  it('gives up at the deadline, so a PR that never gets a workflow is still red', async () => {
    const clock = fakeClock();
    const probe = appearsAfter(Number.POSITIVE_INFINITY);
    expect(await waitForChecks(probe.exists, { ...clock, timeoutMs: 30_000, intervalMs: 10_000 })).toBe(false);
    expect(clock.slept()).toEqual([10_000, 10_000, 10_000]);
  });

  it('defaults to five minutes at ten-second steps', () => {
    expect(CHECKS_APPEAR_TIMEOUT_MS).toBe(300_000);
    expect(CHECKS_APPEAR_INTERVAL_MS).toBe(10_000);
  });
});
