/**
 * FR-PUB-12 (D-376): no commit added from here on carries an agent trailer; FR-SDD-20 (R179):
 * no commit title after `TITLE_BASELINE` is over `COMMIT_TITLE_MAX`.
 *
 *   npx tsx scripts/check-trailers.ts            # BASELINE..HEAD
 *   npx tsx scripts/check-trailers.ts <ref>      # <ref>..HEAD, for both checks
 *
 * This project's own rule is that commit messages carry no trailers
 * (`AGENTS.md`), and P1's audit found 19 commits
 * reachable from `main` that carry one anyway (FR-PUB-7 (a)). Those 19 are the
 * owner's to decide about, because removing them rewrites published history —
 * so this check is not about them. It is about the next one: it looks only at
 * commits *after* `BASELINE`, so the count can never grow whatever is decided
 * about the commits before it.
 *
 * A test that failed on history would be a test whose only green path is a
 * force-push, which is precisely the decision the owner reserved (PLAN D-372).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { COMMIT_TITLE_MAX } from './sdd/limits';

/**
 * The last commit on `main` before this rule was in force: the merge of PR #104
 * (SPEC v1.3.2), which is the first commit written after the audit that found
 * the trailers. Everything from here on is checked; everything before it is the
 * history FR-PUB-7 reports and does not touch.
 *
 * Moved on 2026-10-30, on the owner's answer, to the squash merge of PR #227 (`3492466`, SPEC
 * v2.8), to which GitHub added `Co-authored-by: Claude` because the branch's
 * commits were authored by that identity. The owner chose to move the line
 * rather than rewrite `main` (D-372): that commit joins the history FR-PUB-7
 * reports, and every commit after it is checked as before.
 */
export const BASELINE = '668be0d';

/**
 * The trailers that may not appear. All three are the shapes an agent adds to
 * say it was there; the repository says that in `docs/HOW-THIS-WAS-BUILT.md`,
 * once, in prose, rather than 200 times in the log. `Signed-off-by` and the
 * rest of the conventional trailers are not here — this is not a rule against
 * trailers in general, it is a rule against these.
 */
export const FORBIDDEN = [/^Claude-Session:/im, /^Co-Authored-By:.*(claude|anthropic)/im, /^\s*(Generated|Co-authored) with .*(Claude|Anthropic)/im] as const;

/**
 * FR-SDD-20: the tip of `main` when the title rule came in (R179). The titles before it are
 * history, as the trailers before `BASELINE` are; a check red on them could only go green by a rewrite.
 */
// Moved past 363bd9e7 (R179's 83-character squash title, merged before the check ran on main).
export const TITLE_BASELINE = '363bd9e7';

/** One commit, as this check reads it. */
export interface Commit {
  sha: string;
  subject: string;
  body: string;
}

/**
 * The commits that carry a forbidden trailer. Pure, so the shape of the rule is
 * tested without a repository: `trailers.test.ts` runs it over written-out
 * messages, and the CLI below runs it over real ones.
 */
export function offenders(commits: readonly Commit[]): Commit[] {
  return commits.filter((commit) => FORBIDDEN.some((pattern) => pattern.test(commit.body)));
}

/**
 * FR-SDD-20: the commits whose title is over `max`, GitHub's squash suffix ` (#123)` not counted:
 * the rule binds the title a person writes, and the PR number is added after.
 */
export function longTitles(commits: readonly Commit[], max = COMMIT_TITLE_MAX): Commit[] {
  return commits.filter((commit) => commit.subject.replace(/ \(#\d+\)$/, '').length > max);
}

/** `<ref>..HEAD`, as commits. The record separator is a NUL so a body can hold anything. */
export function commitsSince(ref: string, ...options: string[]): Commit[] {
  const out = execFileSync('git', ['log', ...options, '--format=%H%x1f%s%x1f%b%x00', `${ref}..HEAD`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out
    .split('\0')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [sha = '', subject = '', body = ''] = record.split('\x1f');
      return { sha, subject, body };
    });
}

/** True when `ref` is an object this clone actually has: a shallow clone has not. */
export function reachable(ref: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function main(argv: readonly string[]): number {
  const ref = argv[0] ?? BASELINE;
  const titleRef = argv[0] ?? TITLE_BASELINE;
  for (const each of [ref, titleRef])
    if (!reachable(each)) {
      // A depth-1 checkout cannot answer the question. Saying so and failing is
      // the honest outcome: a check that quietly passes on a shallow clone is a
      // check that passes in CI and nowhere else. `ci.yml` fetches the history.
      console.error(`check-trailers: ${each} is not in this clone — fetch the history (actions/checkout with fetch-depth: 0).`);
      return 2;
    }
  let status = 0;
  const commits = commitsSince(ref);
  const bad = offenders(commits);
  if (bad.length === 0) console.log(`check-trailers: ${String(commits.length)} commits since ${ref}, none carrying an agent trailer.`);
  else {
    console.error(`check-trailers: ${String(bad.length)} of ${String(commits.length)} commits since ${ref} carry an agent trailer:`);
    for (const commit of bad) console.error(`  ${commit.sha.slice(0, 9)} ${commit.subject}`);
    console.error('\nThis project writes no trailers (AGENTS.md). Amend or rebase them out before merging.');
    status = 1;
  }
  // A merge commit's title is GitHub's (`Merge <sha> into <sha>` on a pull request's checkout), not anyone's.
  const titled = commitsSince(titleRef, '--no-merges');
  const long = longTitles(titled);
  if (long.length === 0) console.log(`check-titles: ${String(titled.length)} commits since ${titleRef}, no title over ${String(COMMIT_TITLE_MAX)} characters.`);
  else {
    console.error(`check-titles: ${String(long.length)} of ${String(titled.length)} commits since ${titleRef} have a title over COMMIT_TITLE_MAX (${String(COMMIT_TITLE_MAX)}):`);
    for (const commit of long) console.error(`  ${commit.sha.slice(0, 9)} ${String(commit.subject.length)} chars: ${commit.subject}`);
    console.error('\nIds go in the body (AGENTS.md). Reword the title before merging.');
    status = 1;
  }
  return status;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
