# Implement one task

Reads: headless, `sdd-run/<task>.brief.md`; interactive, the task's entry, each cited id by `npm run sdd:id <id>`, `docs/sdd/map.md`.
Never reads: the index files and the phase files whole.

## Before writing code

1. Headless (`SDD_HEADLESS=1`): read the brief; it carries the task's entry and every requirement, story, finding and decision it names, the lane's row, the commit rule and the tool policy. Interactive: read the task's entry in TASKS.md, then each id it names with `npm run sdd:id <id>`.
2. Confirm the task's dependencies are checked off. If not, stop and say which are missing.
3. Confirm the working tree is clean. Interactive: fetch and create `r<n>-<short-slug>` from `origin/main`. Headless: the driver made the worktree and the branch; stay on it. Never commit to `main`; never `git add -A`.
4. Restate the task in two sentences: what it delivers and which ids it satisfies.
5. Locate the code in `docs/sdd/map.md` before opening files; read the `docs/sdd/gotchas.md` section for the work.

## Ambiguity and conflicts

- Headless never asks. An ambiguous task takes the reading closest to the spec text, noted under "Assumptions" in the summary.
- If the documents are wrong or incomplete, or the task cannot be done as written: interactive, stop and propose the doc change; headless, write the conflict and the proposed change to `sdd-run/<task>.blocked.md` and exit without a PR.
- Stay inside the task's scope and lane. Adjacent work goes under "Follow-ups".

## While implementing

1. Write or update a test per acceptance criterion, at the lowest level that proves it; a test for a v2.13-or-later requirement names its id (`FR-SDD-6: …`).
2. Run narrow checks while iterating: `npx vitest run <file>`, `npx playwright test <spec>`, or `npm run check -- --no-e2e`.
3. Physics changes pass the golden fixtures from R1.
4. Commit each coherent step as it is done (D-89). A red typecheck between commits costs nothing; an uncommitted working tree is what the turn cap and the wall clock throw away.
5. New code cites ids and says in one line what the code cannot; a new file stays under `NEW_FILE_MAX_LINES`, its header at most five lines.

## When done

1. Run `npm run check` and `npm test` once; report the counts and any rising warning count.
2. If the task changed the UI, follow `docs/sdd/workflows/visual-review.md`.
3. If it added or changed user-visible text, both catalogs (en, es) carry it; the typecheck fails on a missing message (FR-I18N-2).
4. Check the task off in TASKS.md on this branch, with a one-line note if what was done differs from the task text.
5. Append the decisions made to the phase's `plan.md`, in the task's reserved block.
6. Write the summary in the PR body's shape, within `PR_BODY_MAX_KB`: what changed (at most three lines), the ids it closes, the checks that ran, the captures, assumptions and follow-ups.
7. Interactive: push and open the PR titled `R<n>: <goal>` (at most 72 characters). Do not merge.
8. Headless: never push, never open a PR. Write the summary to `sdd-run/<task>.summary.md` and exit; the driver rebases, pushes, opens the PR and watches CI.
