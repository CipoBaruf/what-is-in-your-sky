# Review a task's pull request

Reads: the brief, the diff, `docs/sdd/gotchas.md`.
Never reads: the phase files, the session transcript.

The review reads and reports; it changes nothing on the branch.
It runs after CI is green, and a clean review is what lets an `auto` task merge.

## The tier (FR-SDD-18, D-1065)

The driver picks the review's tier from the task and the changed paths, cheapest first:

| Diff | Tier |
|---|---|
| every path under `docs/` or a root `*.md` | no review session |
| `Tier: hard`, `Gate: owner`, or any path under `src/physics/`, `src/worker/`, `scripts/sdd/` | `standard` |
| anything else, a tests-only diff included | `light` |

If the findings per phase rise after this rule took effect, review goes back to `standard` for every task (V213-10).

## Steps

1. Read the brief (`sdd-run/<task>.brief.md`): the task's scope, its done-when, the ids it satisfies, the lane's directories.
2. Read the diff against the base the prompt names (`git diff <base>...HEAD`), whole. Open a file beyond the diff only to confirm a finding.
3. Read the sections of `docs/sdd/gotchas.md` the diff touches.
4. Check, in this order:
   - correctness: a concrete input or state that gives a wrong result, a crash or a lost write;
   - each done-when line: met, and proved by a test or a command at the lowest level that proves it;
   - scope: nothing outside the lane and the one shared file the task names; nothing under `src/` or `public/` in a phase that forbids it;
   - the documents: a behaviour the spec does not state, or a decision the plan does not record;
   - user-visible text in both catalogs (en, es).
5. Keep only findings you can state with a failure scenario. Style, taste and "consider" are not findings.
6. Write each finding as one JSON line, `{"file": "<repo path>", "line": <n>, "claim": "<the defect in one sentence>", "scenario": "<input or state → wrong outcome>"}`, to the handoff file the prompt names; write the file with no lines when there is nothing to report.
7. Change nothing else: no edit, no commit, no comment on the PR.

## What happens next

No findings: the driver merges an `auto` task, or labels a `Gate: owner` one for the owner.
Findings: the PR stays open, and a fix session gets these lines and `docs/sdd/workflows/fix-ci.md`, not this session's transcript.
