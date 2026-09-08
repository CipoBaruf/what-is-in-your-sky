/**
 * FR-PUB-13 (D-377): the branches on `origin` whose pull request is merged,
 * listed — and deleted only when asked in so many words.
 *
 *   npx tsx scripts/prune-merged-branches.ts            # list, delete nothing
 *   npx tsx scripts/prune-merged-branches.ts --delete   # delete the listed ones
 *
 * P1's audit counted 93 branches on `origin`, one per task plus the spec
 * branches (FR-PUB-9). They are noise on the branch page of a public
 * repository, but the ones that are genuinely unmerged are load-bearing: a
 * failed task's branch is how `npm run sdd -- --status` reads the task back as
 * failed, and `--task` refuses to retry until it is gone (PLAN §16.5). So the
 * default is to do nothing and print.
 *
 * **Why the merge test is GitHub's and not git's.** The obvious check is
 * `git branch -r --merged origin/main`, and on this repository it is wrong: it
 * calls 20 branches merged and 74 unmerged, when GitHub has 103 merged pull
 * requests. Every pull request here is squash-merged (PLAN §16.4 step 8,
 * `gh pr merge --squash`), and a squash writes a *new* commit onto `main` with
 * a new tree and no link to the branch it came from — so the branch tip is
 * never an ancestor of `main` and reachability can never see it. Using that
 * test would have left ninety dead branches in place while reporting them as
 * unmerged, which is the safe direction to be wrong in and still useless.
 *
 * The record that a branch was merged lives in GitHub, so that is what is
 * asked: a branch is deletable when a **merged** pull request has it as its
 * head, no **open** pull request does, and it is not protected.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Never deleted, whatever anything else says. */
export const PROTECTED = new Set(['main', 'HEAD']);

/** `git branch -r` output → the branch names on `origin`, without the remote prefix. */
export function parseBranches(out: string): string[] {
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.includes('->'))
    .map((line) => line.replace(/^origin\//, ''))
    .filter((name) => !PROTECTED.has(name));
}

/**
 * Which of `branches` may be deleted. Pure, so the rule is tested without a
 * network: deletable = a merged pull request's head, not an open one's, not
 * protected. A branch nobody ever opened a pull request for is left alone —
 * it is someone's work in progress, not a leftover.
 */
export function deletable(branches: readonly string[], mergedHeads: readonly string[], openHeads: readonly string[]): string[] {
  const merged = new Set(mergedHeads);
  const open = new Set(openHeads);
  return branches.filter((name) => !PROTECTED.has(name) && merged.has(name) && !open.has(name));
}

const git = (args: readonly string[]): string => execFileSync('git', [...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const heads = (state: 'merged' | 'open'): string[] =>
  execFileSync('gh', ['pr', 'list', '--state', state, '--limit', '500', '--json', 'headRefName', '-q', '.[].headRefName'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

function main(argv: readonly string[]): number {
  execFileSync('git', ['fetch', 'origin', '--prune'], { stdio: 'inherit' });
  const branches = parseBranches(git(['branch', '-r', '--list', 'origin/*']));
  const mergedHeads = heads('merged');
  const openHeads = heads('open');
  const dead = deletable(branches, mergedHeads, openHeads);
  const kept = branches.filter((name) => !dead.includes(name));

  console.log(`\n${String(dead.length)} of ${String(branches.length)} branches on origin belong to a merged pull request:\n`);
  for (const name of dead) console.log(`  ${name}`);
  console.log(`\n${String(kept.length)} do not, and are never touched by this script:\n`);
  for (const name of kept) console.log(`  ${name}`);

  if (!argv.includes('--delete')) {
    console.log('\nNothing deleted. Re-run with --delete to remove the ones above.');
    return 0;
  }
  if (dead.length === 0) return 0;
  // In batches, because a push with ninety refspecs is one failure for all of them.
  for (let start = 0; start < dead.length; start += 20) {
    execFileSync('git', ['push', 'origin', '--delete', ...dead.slice(start, start + 20)], { stdio: 'inherit' });
  }
  console.log(`\nDeleted ${String(dead.length)} branches.`);
  return 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
