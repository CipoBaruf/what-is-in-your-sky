# Release preparation for a phase

Reads: `docs/RELEASE.md`, the last phase's `release.md`, the phase's `tasks.md`.
Never reads: earlier records, other phases.

A phase's release task writes the phase's record, `docs/sdd/phases/<version>/release.md`, and leaves the tag and the deploy to the owner.
`docs/RELEASE.md` stays the procedure every release runs (§1–§5, §10); nothing per release goes into it.

## Steps

1. Read the phase's definition of done (SPEC.md's current phase, or `npm run sdd:id` on the phase's ids) and its `tasks.md`; every other task is checked off.
2. Start the record with a `## <n>. <version> (spec §9 Phase <x>)` heading, `<n>` one past the last record's, and a short paragraph: what the phase delivered, with ids, and that `main` reads `<version>` once this task merges.
3. **The captures (`<n>.1`).** Shoot the full set at release preparation, the only time it is shot whole, from a plain build, and the base's set from the last release's SHA on the same machine (`docs/sdd/gotchas.md`, *captures*). Diff by pixels (`docs/sdd/workflows/visual-review.md`) and record: the set's file count against the last record's, each changed file grouped by the requirement that moved it, the known noise by its F-id, and two runs' agreement (FR-CAP-5). Leave checkboxes for the owner's `captures.yml` runs against the base.
4. **The budget (`<n>.2`).** Run `npm run bundle:budget` beside the base built in the same run. Re-set the budgets by D-178 (the measure × 1.1, up to the next 5 KB line, inside PLAN §11's ceilings) in `scripts/bundle-budget.ts`, write the table (chunk, gzip KB, budget KB, base, change) and explain every row that moved. Point the budget test in `tests/docs/accuracy.test.ts` at this record.
5. **What the phase removed (`<n>.3`).** `npm run check:dead` reports nothing; list each removed component, message key or file, or say none.
6. **The usage report.** From `sdd-run/usage.jsonl`: the phase's total tokens, its most expensive task, each task's changed lines, the findings (F-ids) per phase, the flaky tests quarantined and the CI reruns per PR (FR-SDD-1, FR-SDD-21). Set each tier's ceiling when the phase calls for it (FR-SDD-2).
7. **What the owner decides (`<n>.4`).** One checkbox per open call: an accepted overrun, a raster choice, a finding left open.
8. **The run on a device (`<n>.5`).** One checkbox per user-visible change, on the phone or at the desk the phase targets, each stating what to do and what should be seen.
9. **The release itself (`<n>.6`).** One checkbox each:
   - `package.json` is `<version>` on `main` and every task of the phase is checked off;
   - `<n>.4`'s items are decided and `<n>.1`'s `captures.yml` runs are recorded;
   - `npm run check:dead` is clean on the release commit and the bundle table is `<n>.2`'s;
   - `<n>.5`'s run is written down;
   - the release commit is the squash merge of this task's PR, its SHA written into the record;
   - tag it: `git tag -a v<version> <sha> -m "<version>: <title>"`, then push the tag;
   - deploy the same SHA, `git push origin <sha>:release` (D-739, `docs/DEPLOY.md`), and run `docs/RELEASE.md` §2 and §5 against the live site.
10. Bump `package.json` (and the lockfile's root entry) to `<version>`, unless the phase is one with no release.
11. Mark the previous record history: a `> *History (marked <date>): …*` line under its heading.
12. Run `npm run check` and `npm test`; commit; summarise what the owner still owes (the tag, the deploy, the captures runs, the device run).

The tag, the push to `release` and the device run are the owner's; the task never runs them.
