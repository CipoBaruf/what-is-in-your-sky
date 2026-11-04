# Fix a red CI run or a review's findings

Reads: the failure digest, the findings, the brief.
Never reads: the job log, the session transcript.

A fix session starts from what failed, not from what the first session did.
It touches only what the failing checks or the findings name, on the task's own branch.

## Inputs

- The failure digest: the `failure-digest` artifact of the failed run (written by `scripts/ci-digest.ts`, within `FAILURE_DIGEST_MAX_KB`): each failing job, each failing test's name, its first error lines and a frame (FR-SDD-16).
- The findings: one JSON line each, `{file, line, claim, scenario}`, from the review (D-1065).
- The brief, `sdd-run/<task>.brief.md`, for the task's scope and done-when.

## Steps

1. Read the digest or the findings whole, then the brief's done-when.
2. For each failure or finding, reproduce it locally first: the failing test by name (`npx vitest run <file> -t "<name>"`, `npx playwright test <spec> -g "<name>"`), or the finding's scenario as a new failing test.
3. Fix the cause in the code the failure points at. Do not widen a threshold, skip a test or retry it in place to make it pass; a test that fails without a code cause is flaky: quarantine it with an F-id and a fix task (FR-SDD-24), and say so.
4. A finding you judge wrong: leave the code, and answer it in the summary with the reason in one line.
5. Stay inside the task's lane and scope; a fix that needs a file outside it goes under "Follow-ups".
6. Commit each fix as it passes, its title naming the failure or the finding.
7. Run `npm run check`; when it is green, run the checks the digest named once more.
8. Write the summary: each failure or finding and what fixed it, or why not; the checks that ran.
9. Headless: never push and never open or comment on a PR; the driver pushes the branch and re-runs CI and the review.
