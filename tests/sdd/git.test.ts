/**
 * PLAN §16.4: the wait between `gh pr create` and the CI watch (D-98). Nothing
 * here reaches the network — the probe is what `gh pr checks` would have said.
 */
import { describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHECKS_APPEAR_INTERVAL_MS, CHECKS_APPEAR_TIMEOUT_MS, CHECKS_WATCH_TIMEOUT_MS, checksExist, openPullRequests, checksVerdict, DIGEST_WAIT_MS, mergeArgs, pullRequestTitle, runForHead, waitForChecks, watchChecks, type ExecResult } from '../../scripts/sdd/git';
import type { Logger } from '../../scripts/sdd/report';
import { COMMIT_TITLE_MAX } from '../../scripts/sdd/limits';

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

describe('FR-SDD-16: the digest picks the run by the PR head', () => {
  const rows = [
    { databaseId: 3, headSha: 'bbb', headBranch: 'other' },
    { databaseId: 2, headSha: 'bbb', headBranch: 'r9-task' },
    { databaseId: 1, headSha: 'aaa', headBranch: 'r9-task' },
  ];

  it('takes the run on that commit and branch, not the newest run', () => {
    expect(runForHead(rows, 'bbb', 'r9-task')).toBe(2);
    expect(runForHead(rows, 'aaa', 'r9-task')).toBe(1);
    expect(runForHead(rows, 'ccc', 'r9-task')).toBeUndefined();
  });

  it('waits at most 20 minutes for the run', () => {
    expect(DIGEST_WAIT_MS).toBe(20 * 60_000);
  });
});

describe('FR-SDD-20: pullRequestTitle', () => {
  it('keeps a short title and cuts a long one at a word, leaving room for the squash suffix', () => {
    expect(pullRequestTitle('R183: The numbers')).toBe('R183: The numbers');
    const long = "R182: The saved choices underneath: `globe` as a view, `viewFor`, the new prefs keys with their defaults, and the privacy note's flag";
    const cut = pullRequestTitle(long);
    expect(`${cut} (#12345)`.length).toBeLessThanOrEqual(COMMIT_TITLE_MAX);
    expect(cut.endsWith('…')).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(0, -1)).not.toMatch(/[\s,:;]$/u);
  });
});

const quiet: Logger = { path: null, line: () => undefined, raw: () => undefined, command: () => undefined } as unknown as Logger;

const PENDING_GH = '#!/bin/sh\ncase "$*" in\n  *--watch*) exec sleep 30 ;;\n  "pr view"*) echo abc123 ;;\n  *) printf "build\\tpending\\t0\\turl\\n"; exit 8 ;;\nesac\n';

/** A stand-in `gh` on PATH; by default `pr checks` lists one pending check, `pr view` prints a head, and `--watch` never finishes. */
function withFakeGh<T>(work: () => Promise<T>, script = PENDING_GH): Promise<T> {
  const bin = mkdtempSync(join(tmpdir(), 'sdd-gh-'));
  const gh = join(bin, 'gh');
  writeFileSync(gh, script);
  chmodSync(gh, 0o755);
  const path = process.env.PATH;
  process.env.PATH = `${bin}:${path ?? ''}`;
  return work().finally(() => {
    process.env.PATH = path;
    rmSync(bin, { recursive: true, force: true });
  });
}

describe('D-1311: the CI watch has a cap', () => {
  it('reads exec\'s kill as a timeout, distinct from red', () => {
    expect(checksVerdict({ code: 0, stdout: '', stderr: '' })).toBe('green');
    expect(checksVerdict({ code: 1, stdout: '', stderr: '' })).toBe('red');
    expect(checksVerdict({ code: 124, stdout: '', stderr: '' })).toBe('timeout');
    expect(CHECKS_WATCH_TIMEOUT_MS).toBe(40 * 60_000);
  });

  it('gives up on a check stuck pending and returns the head it read', async () => {
    const result = await withFakeGh(() => watchChecks(process.cwd(), 7, quiet, { watchMs: 300 }));
    expect(result).toEqual({ verdict: 'timeout', head: 'abc123' });
  }, 10_000);
});

describe('D-1312: the merge names the head CI saw', () => {
  it('squashes with --match-head-commit', () => {
    expect(mergeArgs(42, 'abc123')).toEqual(['pr', 'merge', '42', '--squash', '--match-head-commit', 'abc123']);
  });
});

/** A `gh` whose PR has no checks (the "no checks reported" exit 1) and whose `mergeable` is `state`. */
const noChecksGh = (state: string): string =>
  `#!/bin/sh\ncase "$*" in\n  *mergeable*) echo ${state} ;;\n  "pr view"*) echo abc123 ;;\n  "pr checks"*) echo "no checks reported on the 'r206' branch" >&2; exit 1 ;;\nesac\n`;

describe('D-1320: no checks on a conflicting PR is not red CI', () => {
  it('answers `conflicting` at once when GitHub calls the PR conflicting', async () => {
    const clock = fakeClock();
    const result = await withFakeGh(() => watchChecks(process.cwd(), 312, quiet, { now: clock.now, sleep: clock.sleep }), noChecksGh('CONFLICTING'));
    expect(result).toEqual({ verdict: 'conflicting', head: 'abc123' });
    expect(clock.slept()).toEqual([]);
  });

  it('keeps waiting for checks on a mergeable PR, and is red only at the deadline', async () => {
    const clock = fakeClock();
    const result = await withFakeGh(() => watchChecks(process.cwd(), 312, quiet, { now: clock.now, sleep: clock.sleep, timeoutMs: 30_000, intervalMs: 10_000 }), noChecksGh('MERGEABLE'));
    expect(result).toEqual({ verdict: 'red', head: 'abc123' });
    expect(clock.slept()).toEqual([10_000, 10_000, 10_000]);
  });

  it('reads each open PR\'s labels, so the loop leaves an owner-labelled PR alone', async () => {
    const rows = JSON.stringify([{ number: 312, headRefName: 'r206', labels: [] }, { number: 313, headRefName: 'r209', labels: [{ name: 'needs-owner' }] }]);
    const prs = await withFakeGh(() => openPullRequests(quiet), `#!/bin/sh\necho '${rows}'\n`);
    expect(prs.get('r206')).toEqual({ number: 312, labels: [] });
    expect(prs.get('r209')).toEqual({ number: 313, labels: ['needs-owner'] });
  });
});
