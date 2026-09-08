/**
 * P2 (FR-PUB-12, FR-PUB-13; D-376, D-377): the two rules P1 left to the owner,
 * as far as a test can carry them.
 *
 * It cannot carry them all the way. Whether the 19 commits already on `main`
 * keep their trailers is a history rewrite and the owner's call (FR-PUB-7 (a)),
 * and whether 90-odd merged branches are deleted is an irreversible act on the
 * remote (FR-PUB-9). What a test *can* do is pin the shape of both rules — what
 * counts as a forbidden trailer, what counts as a deletable branch — so the
 * scripts that enforce them are checked without a repository in a known state.
 *
 * The commit walk itself runs in CI, not here: `ci.yml`'s `trailers` job checks
 * out the full history and runs `scripts/check-trailers.ts`, because a unit test
 * on a depth-1 checkout cannot see the commits it would need.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { BASELINE, offenders, reachable, type Commit } from '../../scripts/check-trailers';
import { deletable, parseBranches, PROTECTED } from '../../scripts/prune-merged-branches';

const commit = (body: string, sha = 'a'.repeat(40), subject = 'R1: a change'): Commit => ({ sha, subject, body });

/**
 * An address, assembled rather than written out. FR-PUB-7's check fails on any
 * tracked text file that contains one, and a fixture is a file like any other —
 * `public.test.ts` builds its own examples this way, for the same reason. This
 * one caught it: the first version of this file wrote the addresses as literals
 * and P1's hygiene test went red on it in CI, which is the guard working.
 */
const address = (local: string, host: string): string => [local, host].join('@');

describe('the trailer rule (FR-PUB-12, D-376)', () => {
  it('catches the three shapes an agent signs a commit with', () => {
    const bad = [
      commit('Claude-Session: https://claude.ai/code/session_01B1HnB7k1MX27EZdm21qj5V'),
      commit(`Some body.\n\nCo-Authored-By: Claude <${address('noreply', 'anthropic.com')}>`),
      commit('Generated with Claude Code'),
    ];
    expect(offenders(bad)).toHaveLength(3);
  });

  it('and only at the start of a line, so prose that mentions them is not a violation', () => {
    // This repository's own documents discuss the trailers at length — the
    // audit in SPEC §4.24 quotes the string. A rule that fired on the word
    // would fail on the commit that wrote the rule down.
    const fine = [
      commit('P1: the audit reports 19 commits carrying a Claude-Session: trailer.'),
      commit('Explain why we do not use Co-Authored-By: lines here.'),
    ];
    expect(offenders(fine)).toEqual([]);
  });

  it('leaves the conventional trailers alone: this is a rule about agent signatures, not trailers', () => {
    const fine = [commit(`Body.\n\nSigned-off-by: A Person <${address('someone', 'example.com')}>`), commit('Body.\n\nRefs: #104\nReviewed-by: someone')];
    expect(offenders(fine)).toEqual([]);
  });

  it('does not fire on a human co-author', () => {
    expect(offenders([commit(`Body.\n\nCo-Authored-By: A Person <${address('person', 'example.com')}>`)])).toEqual([]);
  });

  it('is anchored at a baseline commit, so it can never be made green by rewriting history', () => {
    // The point of the baseline: the 19 commits before it are reported by
    // FR-PUB-7 and decided by the owner. If this test could fail on them, its
    // only green path would be the force-push the owner reserved.
    //
    // Only the shape is asserted here. Whether the baseline is *reachable* is a
    // question about the clone, and the `ci` job checks out at depth 1 — this
    // asserted it and went red on the first run, which is D-376's own rule
    // ("it cannot live in tests/docs/ with the others") applied to the script
    // and then forgotten in the test. `reachable()` is exercised where it
    // matters: `ci.yml`'s `trailers` job fetches the history and the script
    // exits 2 rather than 0 when it cannot see the range.
    expect(BASELINE).toMatch(/^[0-9a-f]{7,40}$/);
    expect(typeof reachable).toBe('function');
  });
});

describe('the branch rule (FR-PUB-13, D-377)', () => {
  it('reads a remote branch list and drops the symbolic ref', () => {
    const out = ['  origin/HEAD -> origin/main', '  origin/main', '  origin/r61-the-wide-live-page-gets-a-rail', '  origin/spec-v1-1-phone-pass', ''].join('\n');
    expect(parseBranches(out)).toEqual(['r61-the-wide-live-page-gets-a-rail', 'spec-v1-1-phone-pass']);
  });

  it('never offers main for deletion, whatever git says', () => {
    expect(PROTECTED.has('main')).toBe(true);
    expect(parseBranches('  origin/main\n  origin/HEAD -> origin/main\n')).toEqual([]);
    expect(deletable(['main'], ['main'], [])).toEqual([]);
  });

  it('deletes a merged pull request head, and nothing else', () => {
    const branches = ['r61-done', 'r99-failed', 'p2-owner-actions', 'someones-wip'];
    // r61 merged; r99 opened a PR that is still open; p2 is merged but still
    // has an open PR (a reopened branch); someones-wip never had one at all.
    const merged = ['r61-done', 'p2-owner-actions'];
    const open = ['r99-failed', 'p2-owner-actions'];
    expect(deletable(branches, merged, open)).toEqual(['r61-done']);
  });

  it('leaves a branch that never had a pull request alone: that is work in progress, not a leftover', () => {
    expect(deletable(['someones-wip'], [], [])).toEqual([]);
  });

  it('does not use git reachability, which squash merges make useless here', () => {
    // The reason this rule is GitHub's record and not `git branch --merged`:
    // a squash writes a new commit with no link to the branch, so the tip is
    // never an ancestor of main. On this repository that test called 20
    // branches merged against 103 merged pull requests.
    const source = readFileSync('scripts/prune-merged-branches.ts', 'utf8');
    expect(source).not.toMatch(/'--merged'/);
    expect(source).toContain("'pr', 'list'");
  });
});
