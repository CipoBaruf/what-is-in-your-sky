# v2.13 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.49 v2.13 decisions (2026-11-03)

v2.13 changes the development process only (V213-1): no file under `src/` or `public/` changes.
Every rule here follows the entry shape SPEC FR-SDD-13 asks of the new documents: an id, a one-line title, at most five lines.
No dependency is added (§11.1 unchanged): the schema uses `zod`, the pixel diff and the compression use `pngjs`, both already installed.

- **D-1057 — Where the new code lives.** (FR-SDD-1..27.) `scripts/sdd/{ledger,split,splitMap,rewrap,ids,agents,review,limits,traceability}.ts` with tests beside them; `scripts/{check,check-sdd,ci-digest,sdd-map,prune-merged-branches}.ts`; `scripts/captures/{manifest.json,diff.ts,compress.ts}`; `sdd.agents.json` at the root; `docs/sdd/archive.json` (path → archive location, empty until R180).
- **D-1058 — The ledger reads the result event.** (FR-SDD-1.) `ledger.ts` takes `stream-json`'s final `result` event: `usage.input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`, `num_turns`. One line per session in `sdd-run/usage.jsonl` (local, as all of `sdd-run/`); the PR body's usage line is the durable copy. The phase report reads the file, and `gh pr view` bodies where it is missing; findings come from the review handoffs, flakes from F-ids marked quarantined, reruns from `gh run list` attempts.
- **D-1059 — The split is a heading map.** (FR-SDD-3, FR-SDD-5.) `splitMap.ts` lists every `##`/`###` heading of the three files with its destination; a heading not in the map fails the split. A story or a section goes to the phase its *(vX)* tag names (untagged: `mvp`); PLAN §2.1–§2.16 go to `mvp`; §16.1–§16.8 to `reference/delivery.md`; both revision histories to `reference/revision-history.md`. The map is written by hand once, from `rg -n '^#'`, never by reading the files whole.
- **D-1060 — The rewrap rule.** (FR-SDD-4.) Break after `.`, `?` or `!` plus a space when the next character opens a sentence (a capital, `*`, `` ` ``, `(`), never inside a code span, a link, a table row or a heading, and not after a listed abbreviation (`e.g.`, `i.e.`, `vs.`, `No.`, `approx.`). A list item's continuation lines are indented to its text. The lossless test compares the input and the output with all whitespace collapsed.
- **D-1061 — `ids.md` is one line per id.** (FR-SDD-6.) `ID<TAB>file#anchor<TAB>heading`; then one line per old section, `SPEC §4.47<TAB>docs/sdd/phases/v2.5/spec.md#…`; then one per archived path from `archive.json`. `npm run sdd:id <id>` (`tsx scripts/sdd/ids.ts --print`) prints from the id's line to the next id of its kind or the end of its block. `ids.ts --check` is `check:sdd`'s staleness and resolution check.
- **D-1062 — The briefs are pinned before the split.** (FR-SDD-7.) R175's first commit records the briefs of R167–R171 from the parent into `scripts/sdd/__fixtures__/briefs/`; its last commit's test regenerates them from the new layout and compares bytes. R180's prefix order (FR-SDD-17) re-records them once, in its own task, with the order change as the only diff.
- **D-1063 — Workflows and pointers.** (FR-SDD-8, FR-SDD-9.) Each workflow opens with `Reads:` and `Never reads:` lines copied from `AGENTS.md`'s table, then numbered steps. A skill keeps its frontmatter and one line: "Follow `docs/sdd/workflows/<name>.md`." Headless sessions write `.claude/` files through `node -e` and `fs` (the memory's recipe, now in `gotchas.md`).
- **D-1064 — The agents config.** (FR-SDD-10, FR-SDD-11.) `agents.ts` holds the zod schema and the loader; `session.ts` builds argv by substituting `{prompt}`, `{model}`, `{maxTurns}` into the entry's `command` and keeps today's `claude` flags exactly. A result parser is `(stdout, exitCode, handoffPath) → { ok, text, usage? }`; `stream-json` is today's code moved, `exit-code` reads exit 0 and the handoff. The allowlist moves from `session.ts` into the `claude` entry as `claude-allowlist`. `tasks.ts` reads `Tier:` and, for closed phases, `Model:` through the default agent's reverse map.
- **D-1065 — Review tier and findings.** (FR-SDD-18.) `review.ts` exports `reviewTier(task, paths)`: none when every path is under `docs/` or a root `*.md`; `standard` for `Tier: hard`, `Gate: owner`, or a path under `src/physics/`, `src/worker/`, `scripts/sdd/`; else `light`. The review writes findings as JSON lines `{file, line, claim, scenario}` in its handoff; a fix session's prompt gets those lines and `fix-ci.md`.
- **D-1066 — `npm run check` wraps the tools.** (FR-SDD-15.) `scripts/check.ts` runs `tsc`, `eslint -f json`, `vitest --reporter=json` and, through `ci-affected.ts`, `playwright --reporter=json`, then prints FR-SDD-15's form. `npm test` and the raw scripts stay for CI and for people.
- **D-1067 — CI, in `ci.yml`.** (FR-SDD-16, FR-SDD-25.) PR runs take `concurrency: ci-${{ github.ref }}` with `cancel-in-progress`; a `build` job uploads `dist/` and the shards download it; `actions/cache` keeps `~/.cache/ms-playwright` keyed on the lockfile's Playwright version; a `changes` job (a shell `git diff --name-only`, no third-party action) sets `docs_only` and `tests_only`; a `digest` job, `if: failure()`, runs `ci-digest.ts` over the JSON reports and uploads `failure-digest.md`.
- **D-1068 — Captures by manifest, diffed by pixels.** (FR-SDD-22, FR-SDD-23.) `scripts/captures/manifest.json` maps each capture name to the source globs it draws; `ci-affected.ts`'s matcher picks the captures a diff reaches. `diff.ts` compares two PNGs with pngjs (YIQ delta, per-pixel threshold 0.1, pixelmatch's default) and composes base and branch side by side at half size; `compress.ts` re-encodes at deflate level 9. The orphan `captures` branch mirrors `docs/screenshots/`'s layout; `captures.yml` commits to it and the release squashes it. The README, design and promo images stay where they are.
- **D-1069 — Traceability from test names.** (FR-SDD-24, FR-SDD-19.) `traceability.ts` collects `(FR|US)-[A-Z0-9]+-\d+` from Vitest and Playwright test titles into `docs/sdd/reference/traceability.md`, under the hand-kept rows of PLAN §12 moved as they are. Lint gets ESLint's own `max-lines` at warn, 600, no plugin.
- **D-1070 — The archive.** (FR-SDD-26.) The listed folders move to an orphan `archive` branch with their paths kept; `archive.json` records each; the `spike:*` scripts and their knip entries go. Nothing under `src/` imports them (knip already proves it).
- **D-1071 — Pruning at the start of a wave.** (FR-SDD-27.) `prune-merged-branches.ts` lists merged PRs with `gh`, and deletes their local branches, remote branches and worktrees, never `main`, `release`, `captures`, `archive` or a branch with an open PR; `--dry-run` prints only. The driver runs it at the start of each wave, which is after the previous wave's merges; the merge is by hand (every PR merged by hand, auto-merge off).
- **D-1072 — Delivery.** (V213-11.) §16.32.
- **D-1073 — The ledger is written where the driver runs, and the review joins the body after.** (FR-SDD-1, FR-SDD-20; R172.) `runSession` takes a `ledger` target and appends one line when the child ends — a guard keeps it to one when `error` and `close` both fire — to `sdd-run/usage.jsonl` resolved against the driver's own checkout, not the task worktree, so the file outlives a merged task's removed worktree and R181 reads one file for the phase. A session with no `result` event (the wall clock, a failed start) is still a line, with `null` tokens and turns. Until R177, `agent` is `claude` and `tier` is `null`; `cacheCreationTokens` rides beside FR-SDD-1's fields because D-1058 reads it. The PR opens with the implementation sessions' usage lines; after the review session the driver rewrites the body with `gh pr edit`, so every session of the task is in it before the merge.
- **D-1074 — The body is read off the summary.** (FR-SDD-20; R172.) `report.ts` builds the body from the session's `summary.md`: what changed is the lines under a `What changed` heading, else a `Summary` one, else the first lines, at most three, list markers dropped; the ids closed are the task, its `Findings:` and every FR/NFR/F/V id the summary names; the checks are the `npm`/`npx` commands it quotes in backticks. Until R178's diff summary, the captures line is the count of files under `docs/screenshots/` in the diff. Over `PR_BODY_MAX_KB`, what changed is cut first, then the id and check lists; the usage lines are never cut. The full summary stays in `sdd-run/` and the session log; the body no longer names the log path or the model, which the usage line carries.
- **D-1075 — The map, the ignore file and the gotchas.** (FR-SDD-12, FR-SDD-14; R173.) `docs/sdd/gotchas.md` has seven sections in the order the spec lists them (e2e and sandbox, captures, the driver, the npm cache, GitHub merging, glyphcss, the dome-perf method), carried from the owner's agent memory without the personal files. `.ignore` also lists `data-src/` and all of `src/data/**/*.json` and `places.txt` as the catalogues, so the `.ts` beside them stays searchable. `scripts/sdd-map.ts` maps the tracked and the untracked-but-not-ignored `.ts` and `.tsx` files under `src/` and `scripts/` (through git when the root is a repository, a plain walk otherwise), leaves out tests, `.d.ts` and snapshots, and takes the first sentence of the first block comment, else of the leading line comments. Its test is `tests/sdd/sdd-map.test.ts`, since the node project reads only `src/` and `tests/`. The `rg --files` test skips itself where `rg` is not an executable on the path.
- **D-1076 — What `ci.yml` gates on, and the concurrency group on `main`.** (FR-SDD-25, D-1067; R174.)
  The group is `ci-<ref>` on a pull request and `ci-<run id>` on `main`: GitHub keeps one pending run per group, so a shared `ci-refs/heads/main` would drop commits on `main`.
  `docs_only` uses D-1031's docs rule (markdown, `docs/`, `.claude/`, `LICENSE`) and skips `dead-code`; the shards still run the doc readers until R179's `check:sdd` takes them over.
  `tests_only` (unit tests, snapshots, e2e specs alone) skips the bundle table. It does not drop the tests that read by path: 16 of the 34 code readers read test files, so they stay, and D-1031 already runs only the touched tests and specs beside them.
  The browser cache key is the lockfile's `node_modules/playwright` version; a hit still runs `playwright install-deps chromium` for the system packages.
- **D-1077 — One report reader for the check and the digest.** (FR-SDD-15, FR-SDD-16; R174.)
  The Vitest, ESLint, Playwright and tsc readers live in `scripts/ci-digest.ts`, which imports nothing outside Node, so the `digest` job runs it with no `npm ci`; `check.ts` imports them.
  A failure is its name, the error's lines before the first frame or snippet (at most four, colours stripped), and the frames outside `node_modules` and Node, relative to the root. `check` prints five frames; the digest prints two message lines and one frame, whole entries only, and says how many did not fit.
  Warnings per tool: lint's warnings and e2e's flaky tests; tsc and Vitest report none. `check` reads the e2e selection from the merge base with `origin/main` (`--base`) to the working tree, untracked files included, and `--no-e2e` skips it.
  CI's lint stage writes `eslint.json` and runs ESLint again for the log only when it failed; trailers and dead-code tee their output, which the digest quotes (last 15 lines) only for a failed job.
- **D-1078 — Where each section went.** (FR-SDD-3, D-1059; R175.)
  Folders follow SPEC §9's phases; a point release with none of its own goes into the phase before it (v1.3.1 → v1.3, v1.3.3 → v1.3.2, v1.4.1 → v1.4, v2.0.2 and v2.0.3 → v2.0, v2.4.1 → v2.4), PLAN §2.26–§2.34 (R74–R82) to v2.0 and the first §2.39 (R103, R104) to v2.3.
  Reference: PLAN §4 `project-structure.md` (15.4 KB, so not in PLAN.md), §5 `data-model.md`, §6 `worker-contract.md`, §7 `data-layer.md`, §9.1–§9.3 `testing.md` (§9.4–§9.15 to their phases), §11 `build-and-deploy.md`, §16.1–§16.8 `delivery.md`; SPEC §10 `glossary.md`; TASKS.md's header table `breakdown-inputs.md`.
  SPEC.md keeps §1, §2.1, §2.2, the open phase's §2.20, §9's Phase 2v and Phase 3; untagged sections go to `mvp`.
- **D-1079 — The rewrap keeps only what it can undo.** (FR-SDD-4, FR-SDD-7; R175.)
  `rewrapBlocks` rewraps a block (the lines between blank lines) only where `unwrap`, its exact inverse, gives the block back; two PLAN blocks already one sentence per line stay as they were.
  No break inside a `**…**` span (`**G1. Zero-friction start.**`). TASKS text, closed and open, moves byte for byte.
  About 230 SPEC and 500 PLAN lines are single sentences over `DOC_LINE_MAX`, and 385 TASKS lines moved as they were; R179's check meets them.
- **D-1080 — The brief reads through a lookup.** (FR-SDD-7; R175.)
  `buildBrief` takes `textFor(key)`: `layoutLookup` finds the file through `ids.md` and returns SPEC and PLAN text unwrapped, TASKS text as it is; `documentSources` serves the pre-split files, the fixture test's before side. The lane row is `PLAN §16.1`'s.
  The driver's waves read TASKS.md and every closed phase's `tasks.md` at `origin/main` (`layoutTasksText`, `readFileAtRef`), so a dependency on a closed task reads as merged.
- **D-1081 — `ids.md`'s kinds, and TASKS.md over its ceiling.** (FR-SDD-6, FR-SDD-13; R175.)
  A kind is read only from its document (SPEC: FR, G, US, F, OQ, V; PLAN: D; TASKS: tasks), first definition first; an old section is listed for each numbered heading of a one-document file. `--check` checks staleness; whether every cited id resolves is R179's.
  SPEC.md and PLAN.md are under `INDEX_MAX_KB`; TASKS.md is about 25 KB because the open v2.13 block alone is 23.8 KB, so FR-SDD-3 and FR-SDD-13 cannot both hold for it without rewording a task. Proposed: the ceiling binds TASKS.md from the next phase, when the closed v2.13 block leaves.
- **D-1082 — The release records keep their numbers.** (FR-SDD-9; R176.)
  RELEASE.md §6–§9 and §11–§25 moved byte for byte, heading and number kept, to `docs/sdd/phases/<version>/release.md`; RELEASE.md keeps §1–§5 and §10 under their old numbers and a table from each old § to its file, so "RELEASE §23.1" in code and in the records resolves with no edit.
  `ids.md` does not index `release.md`. The doc tests read the records from their folders; the budget test reads the last record, and each release task points it at its own.
- **D-1083 — The reading rows are tested now; the review's file is the prompt's.** (FR-SDD-8, FR-SDD-9, D-1063, D-1065; R176.)
  `tests/docs/sdd-workflows.test.ts` checks `AGENTS.md`'s size and table, the import line, each workflow's size and its `Reads:`/`Never reads:` lines against its table row (two rows sharing `implement.md` read `headless, …; interactive, …`), and the skill pointers; R179 moves the size rules onto `limits.ts`.
  `accuracy.test.ts` scans `AGENTS.md` and the workflows for paths and scripts, R178's three capture scripts allowed until they exist.
  `review.md` writes D-1065's JSON lines to "the handoff file the prompt names"; R177 names it.
- **D-1084 — The shape of an agent entry.** (FR-SDD-10, FR-SDD-11, D-1064; R177.)
  A tier is `{model, maxTurns?, tokenCeiling?}`; `aliases` maps a closed phase's model that is no tier's (`haiku`) to a tier.
  The tool policy carries its own flags, separator and lists, so no agent's flag is in the code; a name ending `-allowlist` passes them, `none` passes nothing.
  `limit` has `pattern` (group 1 is the reset time, read as the next such local time), `modelPattern` (a limit one model owns) and `accountWindows` (the event windows every model shares).
  `--tier` overrides one `--task` run; `--model` still works, read through the agent's map; a task's `Agent:` wins over `--agent`.
- **D-1085 — A model's own limit is not the account's.** (FR-SDD-11, D-835; R177.)
  R175's session of 2026-11-04 ended on `seven_day_overage_included`, one model's weekly window, while every model stood at 75 %.
  A window outside `accountWindows`, or a sentence matching `modelPattern`, is that model's: with fallback on, the next tier runs; with it off, the log says so instead of "no model escapes it".
  Waiting for the reset applies to either kind when the reset is known and within `MAX_RESET_WAIT_MS`.
- **D-1086 — The review's file and tier.** (FR-SDD-18, FR-SDD-9, D-1065; R177.)
  The findings go to `sdd-run/<id>.findings.jsonl`, removed before each review; a line that is not a finding counts against the merge.
  `Review:` still picks the tier (D-659), except that a docs-only diff gets no session; the old rule by gate is gone, `Gate: owner` now gets `standard`.
  The review and fix prompts carry their workflow whole, so they are several lines; §16.4 step 3's one line is the implementation prompt's.
- **D-1087 — Fix sessions and the budget.** (FR-SDD-16, FR-SDD-2; R177.)
  `--fix` (off by default) gives a task one fix session per run, on its own tier: on red CI with the `failure-digest` artifact, fetched with `gh run download` after `gh run watch`, or on findings with their lines; then CI and, after a findings fix, one more review.
  An overrun is a session past the nearest-rank 90th percentile of the open phase's ledger lines of the same agent, kind and tier, counting input, cached, cache-write and output tokens, once there are `MIN_BUDGET_SAMPLES` (5); it goes to the task log and the run report.
  A set ceiling stops a `stream-json` session from its assistant messages' usage, outcome `budget`; an `exit-code` agent reports no tokens until it ends, so its ceiling cannot stop it.
- **D-1088 — How the set gets to the `captures` branch.** (FR-SDD-22, FR-SDD-23; R178.)
  The branch's root is `docs/screenshots/`'s (`v1-*.png` at the top), plus `diff/` with the last run's side-by-side images and a short README.
  A task session cannot push, so the branch is made by the first `captures.yml` run on `main` after R178 merges: no branch means the whole set.
  `manifest.json` has an `all` list beside `screens`, so the globs every capture draws are written once; a unit test or snapshot under `src/` draws nothing.
  The spec shoots the screens `CAPTURE_SCREENS` names; the job restores the branch's set first, so `captures.test.ts` checks a whole set under `CAPTURES_SET=1` and checks only that `main` tracks no `v1-*` file otherwise.
  The job summary links the images at the commit that holds them (`/raw/<sha>/diff/…`); a dispatch on another ref commits nothing and points at the artefact.
  R128's `base` input is gone: the base is the branch.
  The README hero's three source captures stay on `main` as README images, in `docs/readme/sources/`. The design captures stay where `docs/DESIGN.md` shows them. The per-task `r<n>-*` files are not the set and stay on `main` until a task moves them.
- **D-1090 — What `check:sdd` lets through, and lists.** (FR-SDD-4, FR-SDD-6, FR-SDD-13; R179.)
  Closed text is not reworded, so, as D-1081 did for TASKS.md, the rules bind what is written from now on; `--list` prints what they let through.
  A line over `DOC_LINE_MAX` passes when it is a table row, a task's field line (`tasks.ts` reads a field from one line) or a sentence found verbatim in the split's parent fixture; a phase doc before v2.13 passes `PHASE_DOC_MAX_KB`.
  An id passes when it resolves, when its base does (`FR-DOME-8c`), when it ends a reserved range (`D-200 to D-203`), or when the line citing it is moved text; `tests/sdd/` cites made-up ids on purpose and is not read.
  `ids.md` now indexes the MVP plan's `| **D-n** |` rows; a decision is defined once, an amendment (`- **D-8 evidence — …`) is not a second definition.
- **D-1091 — Titles and traceability.** (FR-SDD-20, FR-SDD-24, D-1069; R179.)
  `check-trailers.ts` also fails a non-merge commit title over `COMMIT_TITLE_MAX` after `TITLE_BASELINE` (`9833534a`), GitHub's ` (#n)` squash suffix not counted.
  The traceability ids are D-1069's pattern plus `US-<n>`, read from the titles of tracked tests; the table goes below the moved §12 rows under its own heading.
  A v2.13-or-later requirement with no test fails `check:sdd` unless an open task's `Satisfies:` names it (FR-SDD-17, -26, -27, -28 are R180's and R181's).
  `max-lines` is ESLint's, at warn, 600 (21 files today); `eslint.config.js` restates the number and a test holds it equal to `limits.ts`.

---

### 9.15 v2.13 additions *(FR-SDD)*

- **Lossless.**
  `split.test.ts`: every input line in the output once, whitespace collapsed; `decisions.md` against §12 at the parent; a heading missing from the map fails.
- **Byte for byte.**
  `brief.test.ts` regenerates R167–R171's briefs from the new layout and compares them with the fixtures of D-1062.
- **The driver on the `claude` entry.**
  The existing `scripts/sdd/*.test.ts` unchanged apart from model names becoming tiers; `agents.test.ts` (schema, argv equal to today's per tier, both parsers, the limit pattern); `review.test.ts` (each tier case); `ledger.test.ts` (a recorded result event).
- **The checks.**
  `check-sdd.test.ts`: one failing fixture per rule; `check.test.ts` and `ci-digest.test.ts` on recorded reports; `diff.test.ts` on an identical, an anti-aliased and a changed pair.
- **The app unchanged.**
  No `src/` or `public/` path in the phase's diff; `dist/` asset names equal the base's; `npm test` and the e2e suite green and unchanged.

---

### 16.32 Delivery of the v2.13 tasks *(V213-1..V213-11, D-1057..D-1072)*

The V1-11 rules are unchanged; the gate is v2.10's (D-975): auto, merged by hand on CI green and a clean review, every squash merge with an explicit message.
Ten `R` tasks in seven waves, after this plan is on `main`.
The Lane column names each task's file set; the `Lane:` field takes the driver's fixed list (`tasks.ts`'s `LANES`): `data` for the driver and CI (R172, R174, R177, R180), `docs` for the documents (R173, R175, R176, R181), `ui` for the captures and the checks (R178, R179), so no wave holds two tasks of one lane.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R172 — The ledger and the short PR body: `ledger.ts`, `usage.jsonl`, the usage line, FR-SDD-20's body shape in `report.ts` | `driver` (`scripts/sdd/{ledger,session,report}.ts`) | opus | auto | — |
| 2 | R173 — `gotchas.md` from the memory files (`~/.claude/projects/-Volumes-Data-Projects-what-is-in-your-sky-right-now/memory/`, read-only), `.ignore`, `sdd-map.ts` and `map.md` | `docs` (`docs/sdd/{gotchas,map}.md`, `.ignore`, `scripts/sdd-map.ts`; no `package.json` change) | sonnet | auto | R172 |
| 2 | R174 — Quiet checks and CI: `check.ts`, `ci-digest.ts`, `ci.yml` per D-1067 | `ci` (`scripts/{check,ci-digest}.ts`, `.github/workflows/ci.yml`, `package.json` scripts) | opus | auto | R172 |
| 3 | R175 — The split: briefs pinned, `split`/`splitMap`/`rewrap`, the phase folders, `decisions.md`, `reference/`, the index files, `ids.ts`, `sdd:id`, `brief.ts` and `tasks.ts` on the new layout, `archive.json` empty | `docs` + `driver` (every document, `scripts/sdd/{split,splitMap,rewrap,ids,brief,tasks}.ts`) | fable | auto | R173, R174 |
| 4 | R176 — `AGENTS.md`, `CLAUDE.md`, the seven workflows, the skills as pointers, `RELEASE.md` as a procedure with its records in the phase folders | `docs` (`AGENTS.md`, `CLAUDE.md`, `docs/sdd/workflows/`, `.claude/skills/`, `docs/RELEASE.md`) | opus | auto | R175 |
| 4 | R178 — Captures: the manifest, `diff.ts`, `compress.ts`, the `captures` branch, `captures.yml`, the job summary | `captures` (`scripts/captures/`, `tests/e2e/captureSet.ts`, `captures.yml`, `docs/screenshots/v1-*`) | opus | auto | R175 |
| 5 | R177 — The agents config: `agents.ts`, `sdd.agents.json`, the config-driven `session.ts`, tiers, `--agent`, `Agent:`, the open entries to `Tier:`, the budget report-only, `review.ts`, findings, prompts from `review.md` and `fix-ci.md`, the digest to fix sessions | `driver` (`scripts/sdd/**`, `sdd.agents.json`, TASKS.md's open entries) | fable | auto | R176 |
| 6 | R179 — `check:sdd` and traceability: `check-sdd.ts`, `limits.ts`, `traceability.ts`, the `max-lines` warning, the title check, the CI job | `checks` (`scripts/check-sdd.ts`, `scripts/sdd/{limits,traceability}.ts`, `eslint.config.*`, `ci.yml`'s `sdd` job) | opus | auto | R177, R178 |
| 6 | R180 — Pruning and the brief's prefix: `prune-merged-branches.ts`, the wave-start call, FR-SDD-17 with the fixtures re-recorded | `driver` (`scripts/sdd/{cli,brief}.ts`, `scripts/prune-merged-branches.ts`) | sonnet | auto | R177 |
| 7 | R181 — The archive and the phase report: the `archive` branch and `archive.json` (FR-SDD-26), the ceilings set by FR-SDD-2, the report in `docs/sdd/phases/v2.13/`, FR-SDD-28's checks, the owner's memory-trim line | `docs` (`sdd.agents.json` ceilings, `docs/sdd/{phases/v2.13,archive.json}`, `spike/`, the evidence folders, `package.json`'s `spike:*`, knip) | sonnet | auto | R179, R180 |

R175 is the critical task: the split and the brief change land together or the driver breaks (V213-11).
**After R175 merges, the driver is restarted from a fresh `origin/main`**, so later briefs come from the new `brief.ts`.
R173 and R174 run on the old layout and are the ledger's baseline (V213-6).
R176 writes `visual-review.md` with D-1068's script names; R178 builds them.
R177 is the only task after R175 that changes `session.ts`; R180 touches `cli.ts` and `brief.ts` only after R177 has merged.
The archive sits in R181, alone in its wave, because it and R179 both change `package.json`.

**Sessions:** every entry is cut with `Model:` as the table; R177 converts the open entries (R179–R181) to `Tier:` (FR-SDD-11), and from then on the review tier is D-1065's.
Every row has `Turns: 500` and `Fallback: off`; R172–R177 have `Review: opus`.
Every task is `Gate: auto`.

**The budget** (D-761's units): two Fable tasks, five Opus tasks and three Sonnet tasks with their reviews, **about 3–4 five-hour windows**.
Waves 3 and 5 each hold a Fable task alone; the owner reads `/usage` before them.
Wait-and-resume is on; nothing is started with `--no-wait`.

**The schedule it implies:** waves 1, 2 and 4 about 1.5–2 h each; wave 3 about 4 h; wave 5 about 3 h; waves 6 and 7 about 2 h each.
Unstopped about 16 h; with two five-hour stops about 26 h.
The critical path is R172 → R174 → R175 → R176 → R177 → R179 → R181.

**Owner gates:** none in the waves.
Owner's: approve the captures and archive branches' first push if GitHub asks; trim the agent memory after R173 (V213-4's knowledge move is done when the memory index points at `gotchas.md`); no tag, no deploy.

**Decision block** (§16.2): **R172 takes D-1073..D-1074, R173 D-1075, R174 D-1076..D-1077, R175 D-1078..D-1081, R176 D-1082..D-1083, R177 D-1084..D-1087, R178 D-1088..D-1089, R179 D-1090..D-1091, R180 D-1092, R181 D-1093.**
D-1057..D-1072 are this plan's.

What every session reads (D-284's rule): SPEC §4.56 whole (FR-SDD-1..28), US-51, §9 Phase 2v, §12 V213-1..V213-11; PLAN §2.49, §9.15 and this section; `docs/proposals/agent-agnostic-sdd.md` §1–§3c for intent only, as SPEC §4.56 holds where they differ; and, from R176 on, through `npm run sdd:id`, not by reading the old files.

---
