# v2.13 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

**US-51 — Any agent, a fraction of the reading** *(v2.13)*
As the owner, I start a spec, a breakdown, a task, a review or a fix with any coding agent I have installed, and it reads only what that work needs, while I can see what each session cost.
- AC1: SPEC.md, PLAN.md and TASKS.md are each within `INDEX_MAX_KB`; every phase's text is in `docs/sdd/phases/<version>/`, and the lossless test passes (FR-SDD-3, FR-SDD-4, FR-SDD-13).
- AC2: `npm run sdd:id V212-13` prints that row as it stands in §12 today, with its file and heading (FR-SDD-5, FR-SDD-6).
- AC3: The briefs of R167–R171 are byte for byte the same before and after the split (FR-SDD-7).
- AC4: `AGENTS.md` has the reading table, `CLAUDE.md` is `@AGENTS.md`, and the seven workflows exist within `WORKFLOW_MAX_KB`, each with its reading row (FR-SDD-8, FR-SDD-9).
- AC5: `scripts/sdd/` names no agent or model outside `sdd.agents.json`, and the driver's tests pass on the `claude` entry (FR-SDD-10, FR-SDD-11).
- AC6: Every session of the phase is a line in `sdd-run/usage.jsonl`, and the release notes give the phase's total, its most expensive task, its findings, flakes and CI reruns (FR-SDD-1).
- AC7: `npm run check:sdd` runs in CI and fails on a long line, an oversized file, a stale `ids.md` or `map.md`, an id that does not resolve, an invalid `sdd.agents.json` or a capture with no manifest entry (FR-SDD-4, FR-SDD-6, FR-SDD-10, FR-SDD-13, FR-SDD-14, FR-SDD-22).
- AC8: No file under `src/` or `public/` changes (FR-SDD-28).

### 4.56 The workflow *(v2.13)*

The owner, 2026-11-03, in `docs/proposals/agent-agnostic-sdd.md`: SPEC.md (899 KB), PLAN.md (1.38 MB) and TASKS.md (740 KB) are about 750 k tokens together, more than one context window.
Headless task sessions are cheap because the brief cuts out only the ids a task names (D-198, D-453); every other kind of work slices through the three files.
The workflow also runs only under Claude Code: `CLAUDE.md`, `.claude/skills/`, `claude -p` in `scripts/sdd/session.ts`, Claude model names in `scripts/sdd/tasks.ts`, and project knowledge kept in one user's agent memory outside the repo.
This phase changes the development process and nothing a reader of the app sees.
The proposal is the source; where this section and the proposal differ, this section holds.

Non-goals: no `src/` change; no rewording of a closed phase's text; no adapter for an agent nobody has installed (the config must be able to describe one, only `claude` is tested); the area files (`docs/sdd/areas/`) are written by the renderer phase's spec session, not here (V213-9).

Constants (FR-VIS-6 style; they live in `scripts/sdd/limits.ts` and `check:sdd` reads them):

| Constant | Default | Rationale |
|---|---|---|
| `DOC_LINE_MAX` | 400 chars | One `rg` hit prints one sentence, not a paragraph. Today 747 lines in the three files are over 1,000. |
| `INDEX_MAX_KB` | 15 | SPEC.md, PLAN.md and TASKS.md as indexes: read whole at the start of a spec session for about 4 k tokens each. |
| `PHASE_DOC_MAX_KB` | 60 | A phase's `spec.md` or `plan.md`: the largest past phase section fits; a bigger one is a sign the phase should be two. |
| `AREA_DOC_MAX_KB` | 30 | An area file holds the current rules only, no history. Enforced once area files exist. |
| `WORKFLOW_MAX_KB` | 4 | Today's four skills average under 2 KB; a procedure longer than a page is not followed. |
| `AGENTS_MAX_KB` | 6 | `AGENTS.md` loads into every session of every agent. |
| `HANDOFF_MAX_KB` | 2 | The handoff a session writes is read by the next session and the review. |
| `PR_BODY_MAX_KB` | 1.5 | Today's bodies run 5–6 KB and repeat the brief and the handoff. |
| `COMMIT_TITLE_MAX` | 72 chars | Git's own convention; the ids go in the body. |
| `TASK_DIFF_TARGET_LINES` | 600 | The breakdown's target per task, generated files and captures not counted. R169 added 2,482. |
| `FAILURE_DIGEST_MAX_KB` | 4 | A fix session reads the failing test names and first errors, not a job log. |
| `SNAPSHOT_MAX_KB` | 5 | Agents read snapshot files; a larger one is replaced by assertions. Today's total is 168 KB. |
| `NEW_FILE_MAX_LINES` / `FILE_WARN_LINES` | 500 / 600 | A new source file stays under 500 lines; lint warns on any file over 600. |
| `CAPTURE_DIFF_SHARE` | 0.1 % | A capture counts as changed when more than this share of its pixels differ past the diff tool's per-pixel threshold; under it is anti-aliasing noise (the Mac's sub-pixel AA moved a few files between identical runs). |
| `TIER_BUDGET_FACTOR` | 2 | Each tier's token ceiling, once set, is this multiple of the phase's 90th percentile for that tier (V213-7). |

**Measure first**

- **FR-SDD-1** *(V213-6)* **The usage ledger.**
  The driver records every session it runs, implementation, review and fix alike: task id, session kind, agent, tier, model, input tokens, cached input tokens, output tokens, turns, wall time and outcome, one JSON line each in `sdd-run/usage.jsonl`.
  The PR body carries one usage line per session of that task.
  Each phase's release notes report the phase's total, the most expensive task, the findings (F-ids) per phase, the flaky tests quarantined and the CI reruns per PR.
  *Verification:* `session.test.ts` parses a recorded `stream-json` result into one ledger line with every field; the PR body test checks the usage line; the ledger task merges alone in the first wave, and this phase's tasks before the split are its baseline.
- **FR-SDD-2** *(V213-7)* **A budget per tier.**
  Each tier in `sdd.agents.json` has an optional token ceiling beside `maxTurns`.
  Unset, the driver records an overrun against the phase's running 90th percentile and stops nothing.
  Set, it stops a session that passes the ceiling and reports it as it reports the wall clock today.
  This phase's release task sets each ceiling to `TIER_BUDGET_FACTOR` × the phase's 90th percentile for that tier.
  *Verification:* driver unit tests for both modes.

**The layout**

- **FR-SDD-3** *(V213-2)* **Documents by phase.**
  A script splits SPEC.md, PLAN.md and TASKS.md by their headings into `docs/sdd/phases/<version>/{spec,plan,tasks}.md` (folders named by version: `mvp`, `v1`, `v1.1` … `v2.13`), `docs/sdd/decisions.md`, `docs/sdd/reference/` (glossary, data model, worker contract, testing strategy, build and deploy) and the three index files.
  SPEC.md keeps the summary, goals and non-goals, the current phase and a map of the files; PLAN.md keeps the fixed inputs, the architecture overview, the project structure and a map; TASKS.md keeps the open phase's tasks and a status table of every phase.
  Closed TASKS sections move byte for byte, checkboxes included.
  *Verification:* the lossless test: after removing whitespace changes allowed by FR-SDD-4, the output files together hold every line of the input exactly once; it runs at the migration and stays as the generator's regression test.
- **FR-SDD-4** **One sentence per line.**
  The split rewraps the moved text at sentence ends, whitespace only.
  `check:sdd` fails on any line in `docs/sdd/`, `AGENTS.md` or the index files over `DOC_LINE_MAX`; a table row that cannot be wrapped is the one exception, and it is listed by the check.
  *Verification:* the lossless test compares text with whitespace collapsed; `check:sdd`'s unit test.
- **FR-SDD-5** *(V213-3)* **The Decision Log moves whole.** §12 moves to `docs/sdd/decisions.md` with every row and id as written, in the same order.
  It stays fixed and append-only: a later row may supersede an earlier one, never edit it.
  *Verification:* a test checks the file's rows against §12 at the parent commit, character for character apart from FR-SDD-4's whitespace.
- **FR-SDD-6** **Ids resolve in one place.**
  `docs/sdd/ids.md` is generated: one line per id (FR-, US-, V…-, OQ-, D-, R…, F-, G…) giving its file and heading, plus one line per old section number (`SPEC §4.47`, `PLAN §16.4`) giving its new file, so no code comment needs editing.
  `npm run sdd:id <id>` prints that id's text with its heading and file.
  *Verification:* `check:sdd` fails when `ids.md` is stale or when an id cited in the docs, the code or the tests does not resolve; `sdd:id` unit tests on one id of each kind.
- **FR-SDD-7** **The driver reads the new layout.**
  `brief.ts` and `tasks.ts` read a task from the open TASKS.md or its phase's `tasks.md`, and an id through `ids.md`.
  *Verification:* the briefs of every v2.12 task (R167–R171) come out byte for byte the same as before the split.

**Any agent**

- **FR-SDD-8** *(V213-4)* **`AGENTS.md` is the entry point.**
  It holds today's `CLAUDE.md` content, the stack, a table of what each kind of work reads (the proposal's §2 table, amended by this section) and pointers to the workflows and to `gotchas.md`.
  `CLAUDE.md` is one line, `@AGENTS.md`.
  Within `AGENTS_MAX_KB`.
  *Verification:* `check:sdd` checks the size, the import line and that every workflow is named in the table.
- **FR-SDD-9** **Workflows, not skills.**
  Seven plain procedures in `docs/sdd/workflows/`: `spec.md`, `breakdown.md`, `implement.md`, `visual-review.md`, `review.md`, `fix-ci.md`, `release.md`, each within `WORKFLOW_MAX_KB`, each opening with its own reading row, none calling a tool by one agent's name.
  Each `.claude/skills/*/SKILL.md` becomes a pointer of at most five lines to its workflow, so `/sdd-implement` and the others keep working.
  The driver's review and fix prompts are built from `review.md` and `fix-ci.md`.
  `RELEASE.md` keeps the procedure only; each release's record moves to its phase folder.
  *Verification:* `check:sdd` (sizes, reading rows); a driver test that the review prompt contains `review.md`'s text.
- **FR-SDD-10** **An agent is a config entry.**
  `sdd.agents.json`, checked against a JSON schema, names a default agent and, per agent, the command line with `{prompt}`, `{model}` and `{maxTurns}` placeholders, a model per tier (`hard`, `standard`, `light`), the fallback chain as a list of tiers, a limit pattern with a capture group for the reset time, a result parser (`stream-json` or `exit-code`, which reads success from exit 0 and the handoff file) and a tool policy (`claude-allowlist` or `none`).
  `scripts/sdd/` names no agent and no model outside that file.
  `npm run sdd -- --wave --agent <name>` picks the agent for a run; `Agent: <name>` in a task pins one.
  *Verification:* the `claude` entry's command line equals today's for each tier; the driver's existing tests pass on it with model names turned into tiers; a schema test; an `rg` check in `check:sdd` for agent and model names in `scripts/sdd/`.
- **FR-SDD-11** **Tiers, not models.**
  TASKS entries carry `Tier:` (`hard`, `standard`, `light`) in place of `Model:`; the open entries convert fable→hard, opus→standard, sonnet→light, haiku→light; closed phases keep `Model:` as written and the driver reads both.
  Waiting out a usage limit and resuming (D-835) works for any agent whose limit pattern matches.
  *Verification:* `tasks.test.ts` on both fields; the limit test against the `claude` entry's pattern.
- **FR-SDD-12** **Project knowledge in the repo.**
  `docs/sdd/gotchas.md` holds, one section per subject, the project facts now in agent memory: e2e and sandbox, captures, the driver, the npm cache, GitHub merging, glyphcss (until the renderer phase) and the dome-perf method.
  Personal preferences stay out of it.
  Trimming the agent memory afterwards is the owner's (it is outside the repo).
  *Verification:* `check:sdd` checks the file's sections exist; the owner's trim is a release-note line.

**What a session reads, writes and runs**

- **FR-SDD-13** **Size ceilings.**
  `check:sdd` enforces `INDEX_MAX_KB`, `PHASE_DOC_MAX_KB`, `AREA_DOC_MAX_KB`, `WORKFLOW_MAX_KB` and `AGENTS_MAX_KB`, and that TASKS.md holds only the open phase.
  A decision is an id, a one-line title and at most five lines; a requirement is one testable statement.
  *Verification:* `check:sdd`'s unit tests, one per ceiling.
- **FR-SDD-14** **Search sees source and docs only.**
  A root `.ignore` leaves out `dist/`, `node_modules/`, `docs/screenshots/`, `**/__snapshots__/`, fixtures, `public/data/`, the place and star catalogues and lockfiles.
  `docs/sdd/map.md` is generated: one line per source file with its first doc-comment sentence and its exports.
  *Verification:* `check:sdd` fails when `map.md` is stale; a test that `rg --files` from the root lists none of the ignored paths.
- **FR-SDD-15** **Quiet checks.**
  `npm run check` runs the typecheck, lint, unit tests and the affected e2e specs (`scripts/ci-affected.ts`).
  On failure it prints the test name, the first assertion and five lines of stack per failure; on success one line with the counts passed and the warnings per tool.
  The workflows tell every agent to run it in place of the raw tools, and a rising warning count goes in the handoff.
  *Verification:* unit tests on the output formatter with a recorded failing and passing run.
- **FR-SDD-16** **Failure digests.**
  When CI fails, the job writes a digest of the failing jobs (test names and first errors) within `FAILURE_DIGEST_MAX_KB` as a CI artifact; the driver gives a fix session the digest, not the log.
  *Verification:* the digest writer's unit test on a recorded failing Playwright and Vitest report.
- **FR-SDD-17** **A stable prefix.**
  A brief puts what every session shares first, in a fixed order (rules, tool policy, gotchas digest) and the task's own parts last, so sessions in one wave share a cached prefix.
  *Verification:* two briefs of one wave share their first section byte for byte; FR-SDD-7's byte-for-byte test is re-recorded once, in the same task, with the order change as the only difference.
- **FR-SDD-18** **The cheapest tier that works.**
  Review runs on `light`, except on `standard` for `hard` tasks, `Gate: owner` tasks and any diff touching `src/physics/`, `src/worker/` or `scripts/sdd/`.
  A docs-only diff gets no review session; a tests-only diff keeps one.
  A finding is file, line, claim and failure scenario, and a fix session reads the findings, not the transcript.
  If the findings per phase rise after the switch, review goes back to `standard` (V213-10).
  *Verification:* driver unit tests on the tier choice for each case; the findings parser's test.
- **FR-SDD-19** **Comments and file size.**
  New code cites ids and says in one line what the code cannot; a new file's header is at most five lines.
  A new source file stays under `NEW_FILE_MAX_LINES`; lint warns past `FILE_WARN_LINES`.
  The five files over 880 lines are split when a task next touches them, not in a sweep.
  *Verification:* the lint rule's test; existing comments are left alone.

**Pull requests, images, tests and CI**

- **FR-SDD-20** **Short PRs.**
  A PR body has a fixed shape within `PR_BODY_MAX_KB`: what changed (at most three lines), the ids it closes, the checks that ran, the capture diff summary and the usage line.
  Commit titles are at most `COMMIT_TITLE_MAX`.
  *Verification:* the driver's PR body test; a CI check on titles beside the trailers job.
- **FR-SDD-21** **Smaller tasks.**
  The breakdown aims at `TASK_DIFF_TARGET_LINES` per task and lists, per task, the superseded tests it deletes and the capture-manifest entries it adds.
  *Verification:* the breakdown workflow says so; the release notes report each task's changed lines from the ledger.
- **FR-SDD-22** *(V213-5)* **Captures outside `main`'s history.**
  The capture set moves from `docs/screenshots/` to an orphan `captures` branch whose history is squashed at each release.
  The README, design and promo images stay on `main` (V13-13 holds).
  A capture manifest maps each capture to the source files it draws; a task re-shoots only the captures its diff reaches, and the full set is shot at release prep.
  Captures are written losslessly compressed.
  *Verification:* `check:sdd` fails on a capture spec with no manifest entry, on an entry naming a missing file, and on an uncompressed capture; `captures.yml` runs on `main` only when the manifest says a captured screen changed, and on `workflow_dispatch`.
- **FR-SDD-23** **Pixel diffs before images.**
  Visual review compares each capture with its base by pixels first.
  Only captures past `CAPTURE_DIFF_SHARE` are looked at, reduced, base and branch side by side in one image.
  The PR's job summary shows the same side-by-side images.
  *Verification:* the diff script's unit test on an identical pair, an anti-aliasing pair and a changed pair.
- **FR-SDD-24** **Tests carry their ids.**
  A test for a requirement from v2.13 on names its id (`FR-SDD-6: …`).
  PLAN §12's hand-kept traceability table is replaced by `docs/sdd/reference/traceability.md`, generated from the test names, with the hand-kept rows for earlier requirements kept as they were.
  `check:sdd` fails on a v2.13-or-later requirement with no test.
  A snapshot over `SNAPSHOT_MAX_KB` is not added.
  A flaky test is quarantined with an F-id and a fix task, not retried in place.
  One test per acceptance criterion, at the lowest level that proves it.
  *Verification:* the generator's unit test; `check:sdd`.
- **FR-SDD-25** **CI does less.**
  Pull-request CI uses `concurrency` with `cancel-in-progress`; one job builds `dist/` and the e2e shards download it; the Playwright browsers are cached on the Playwright version; a PR that changes only `docs/` runs `check:sdd` and the trailers job; a PR that changes only tests runs the tests it touched.
  *Verification:* the workflow files; a docs-only PR in this phase runs only those two jobs.

**Cleanup**

- **FR-SDD-26** *(V213-5)* **Closed evidence to an archive.**
  `spike/`, `docs/dome-composition/`, `docs/mockups/`, `docs/stars/`, `docs/spike-glyphcss/`, `docs/window/` and the `spike:*` npm scripts move to an orphan `archive` branch; `ids.md` records each moved path's archive location, so a decision that cites one still resolves.
  *Verification:* `check:sdd`'s id and path resolution; `npm run build` and `npm test` unchanged.
- **FR-SDD-27** **Branches and worktrees pruned.**
  The driver removes a task's worktree once its PR merges and runs `scripts/prune-merged-branches.ts` after each merge.
  *Verification:* the prune script's unit test on a fixture repo.
- **FR-SDD-28** **The app does not change.**
  No file under `src/` or `public/` changes in this phase; `package.json` stays 2.12.0; no tag and no deploy (V213-1).
  *Verification:* `git diff --stat` from the phase's base to its end shows no `src/` or `public/` path; `npm run build`'s `dist/` asset names are the same as the base's.
