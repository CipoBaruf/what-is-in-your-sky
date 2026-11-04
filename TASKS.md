# What Is In Your Sky Right Now — Task Breakdown

## Status

This file holds the open phase, v2.13; each closed phase's tasks are in its folder, moved byte for byte (FR-SDD-3).
Each phase's header rows (status, inputs, scope) are in [`docs/sdd/reference/breakdown-inputs.md`](docs/sdd/reference/breakdown-inputs.md).

| Phase | First … last task | Merged | File |
|---|---|---|---|
| mvp | R1 … H | 16 of 16 | [tasks.md](docs/sdd/phases/mvp/tasks.md) |
| v1 | R16 … R36 | 21 of 21 | [tasks.md](docs/sdd/phases/v1/tasks.md) |
| v1.1 | R37 … R55 | 19 of 19 | [tasks.md](docs/sdd/phases/v1.1/tasks.md) |
| v1.2 | R56 … R60 | 6 of 6 | [tasks.md](docs/sdd/phases/v1.2/tasks.md) |
| v1.3 | R62 … R65 | 5 of 5 | [tasks.md](docs/sdd/phases/v1.3/tasks.md) |
| v1.3.2 | P1 … P2 | 2 of 2 | [tasks.md](docs/sdd/phases/v1.3.2/tasks.md) |
| v1.4 | R67 … R72 | 7 of 7 | [tasks.md](docs/sdd/phases/v1.4/tasks.md) |
| v2.0 | R74 … R80 | 9 of 9 | [tasks.md](docs/sdd/phases/v2.0/tasks.md) |
| v2.1 | R83 … R100 | 19 of 19 | [tasks.md](docs/sdd/phases/v2.1/tasks.md) |
| v2.2 | P6 … P5 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.2/tasks.md) |
| v2.2.1 | P7 … P9 | 3 of 3 | [tasks.md](docs/sdd/phases/v2.2.1/tasks.md) |
| v2.3 | R103 … R110 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.3/tasks.md) |
| v2.4 | R111 … R118 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.4/tasks.md) |
| v2.5 | R119 … R128 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.5/tasks.md) |
| v2.6 | R129 … R135 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.6/tasks.md) |
| v2.6.1 | R137 … R140 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.6.1/tasks.md) |
| v2.7 | R141 … R145 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.7/tasks.md) |
| v2.8 | R146 … R149 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.8/tasks.md) |
| v2.9 | R150 … R153 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.9/tasks.md) |
| v2.10 | R154 … R161 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.10/tasks.md) |
| v2.11 | R162 … R165 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.11/tasks.md) |
| v2.12 | R167 … R171 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.12/tasks.md) |
| v2.13 | R172 … R181 | 4 of 10 | this file |

## v2.13 tasks

Draft, cut 2026-11-03 from `SPEC.md` v2.13 and `PLAN.md` v0.21. Spec Phase 2v, "the workflow": the development process only, no file under `src/` or `public/` changes and no release (V213-1, FR-SDD-28). The ledger lands alone first; the tasks before the split are its baseline; the split cuts the three documents by phase with the brief change in the same task; then `AGENTS.md` and the workflows, the captures off `main`, the agents config with tiers, `check:sdd`, the archive and pruning, and the phase report that sets the tier ceilings.

Delivery is PLAN §16 with §16.32: ten tasks in seven waves, `Model: fable` on R175 and R177 (each alone in its wave), `opus` on R172, R174, R176, R178, R179 and `sonnet` on R173, R180, R181; every task `Review: opus`, `Turns: 500`, `Fallback: off`, `Gate: auto`, merged by hand on CI green and a clean review with an explicit commit message. R177 converts the open entries' `Model:` to `Tier:` (FR-SDD-11) and from then on the review tier is D-1065's. The `Lane:` field takes the driver's fixed list (§16.32): `data` for the driver and CI, `docs` for the documents, `ui` for the captures and the checks. **After R175 merges, the driver is restarted from a fresh `origin/main`** (R176's and R178's Precondition). The owner reads `/usage` before waves 3 and 5.

Decision block (§16.2), reserved in PLAN §16.32: **R172 D-1073..D-1074, R173 D-1075, R174 D-1076..D-1077, R175 D-1078..D-1081, R176 D-1082..D-1083, R177 D-1084..D-1087, R178 D-1088..D-1089, R179 D-1090..D-1091, R180 D-1092, R181 D-1093**. D-1057..D-1072 are the plan's.

What every session reads, named in each task as "the phase set": SPEC §4.56 whole (FR-SDD-1..28 and its constants), US-51, §9 Phase 2v, §12 V213-1..V213-11; PLAN §2.49, §9.15 and §16.32; `docs/proposals/agent-agnostic-sdd.md` for intent only (SPEC §4.56 holds where they differ). From R176 on these are reached through `npm run sdd:id <id>` and the phase folder `docs/sdd/phases/v2.13/`, never by reading the old files whole.

### Wave 1

- [x] **R172 — The usage ledger and the short PR body: every driver session is a line in `sdd-run/usage.jsonl`, and the PR body has FR-SDD-20's shape with a usage line**
  - **Lane:** data
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); SPEC FR-SDD-1, FR-SDD-20; PLAN D-1057, D-1058, D-835, D-198; `scripts/sdd/{session,report,cli}.ts` and their tests.
  - **Goal:** from this task on, every implementation, review and fix session the driver runs leaves its tokens, turns, tier, model, wall time and outcome in the ledger, and every PR it opens has a body of at most `PR_BODY_MAX_KB` ending in one usage line per session.
  - **Satisfies:** FR-SDD-1 (the ledger and the usage line; the phase report is R181's), FR-SDD-20 (the body; the title check is R179's).
  - **Scope (PLAN D-1058):** `scripts/sdd/ledger.ts` (parse `stream-json`'s final `result` event; append a line; read the file back); `session.ts` calls it after each session; `report.ts` writes the body as what changed (≤ 3 lines), ids closed, checks run, capture diff summary (empty until R178) and usage; tests on a recorded result event and on the body's shape and size.
  - **Touches outside the lane:** none.
  - **Out of scope:** tiers and the agents config (R177); the budget (R177); the phase report (R181).
  - **Done when:**
    - `ledger.test.ts` turns a recorded result event into one line with every FR-SDD-1 field; `report.test.ts` checks the body's sections and that it is ≤ 1.5 KB with five sessions.
    - The driver's existing tests pass unchanged.
    - `npm test`, lint and typecheck green; no `src/` path in the diff.

### Wave 2

- [x] **R173 — Project knowledge in the repo and search that sees only source and docs: `docs/sdd/gotchas.md`, `.ignore`, and the generated code map**
  - **Lane:** docs
  - **Model:** sonnet
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R172
  - **Reads:** the phase set (above); SPEC FR-SDD-12, FR-SDD-14; PLAN D-1057; the project facts in the owner's agent memory, `~/.claude/projects/-Volumes-Data-Projects-what-is-in-your-sky-right-now/memory/*.md` (read only; skip the personal ones: commit trailers, questions one by one, promo voice, LinkedIn posts, domain shortlist).
  - **Goal:** any agent finds the project's hard-won facts in one file in the repo, a search from the root never prints a fixture, a capture or a catalogue, and an agent can locate a source file from a one-line map before opening anything.
  - **Satisfies:** FR-SDD-12, FR-SDD-14.
  - **Scope:** `docs/sdd/gotchas.md` with one section each for e2e and sandbox, captures, the driver, the npm cache, GitHub merging, glyphcss and the dome-perf method, each fact as a short rule with its why; `.ignore` per FR-SDD-14; `scripts/sdd-map.ts` (first doc-comment sentence and exports per file under `src/` and `scripts/`) with `--check`, and `docs/sdd/map.md` generated, run as `npx tsx scripts/sdd-map.ts` (R179's `check:sdd` calls its `--check`).
  - **Touches outside the lane:** none.
  - **Out of scope:** trimming the memory (the owner's); `check:sdd` (R179 wires `--check` in).
  - **Done when:**
    - `gotchas.md` has the seven sections and no personal preference; `sdd-map.test.ts` passes on a fixture tree, and `npx tsx scripts/sdd-map.ts --check` exits 0.
    - A test lists `rg --files` from the root and finds none of FR-SDD-14's ignored paths.
    - `npm test`, lint and typecheck green; the ledger has this task's sessions (baseline, V213-6).

- [x] **R174 — Quiet checks and leaner CI: `npm run check`, the failure digest, and `ci.yml` per D-1067**
  - **Lane:** data
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R172
  - **Reads:** the phase set (above); SPEC FR-SDD-15, FR-SDD-16, FR-SDD-25; PLAN D-1066, D-1067; `scripts/ci-affected.ts`, `.github/workflows/ci.yml`, `package.json` scripts, `playwright.config.*`, `vitest.config.*`.
  - **Goal:** an agent runs one command and reads only failures, or one line on success; a failed CI run leaves a 4 KB digest; a superseded push stops, the build runs once, the browsers come from a cache, and a docs-only PR runs only the docs jobs.
  - **Satisfies:** FR-SDD-15, FR-SDD-16 (the digest; handing it to fix sessions is R177's), FR-SDD-25.
  - **Scope (PLAN D-1066, D-1067):** `scripts/check.ts` and `npm run check`; `scripts/ci-digest.ts`; `ci.yml`: `concurrency` with `cancel-in-progress` on PRs, a `build` job uploading `dist/` and the shards downloading it, the Playwright cache, a `changes` job setting `docs_only` and `tests_only`, a `digest` job `if: failure()` uploading `failure-digest.md`; tests on recorded Vitest, ESLint and Playwright JSON reports.
  - **Touches outside the lane:** `package.json` (the `check` script only).
  - **Out of scope:** the `check:sdd` job and the title check (R179); `captures.yml` (R178).
  - **Done when:**
    - `check.test.ts` prints FR-SDD-15's form for a failing and a passing recorded run; `ci-digest.test.ts` writes ≤ `FAILURE_DIGEST_MAX_KB` from a recorded failure.
    - This PR's own CI shows one `build` job and the shards downloading `dist/`; the job list and the gates on `main` are otherwise unchanged.
    - `npm test`, lint and typecheck green; the ledger has this task's sessions (baseline, V213-6).

### Wave 3

- [x] **R175 — The split: the three documents cut by phase into `docs/sdd/`, rewrapped one sentence per line, the Decision Log moved whole, `ids.md` and `sdd:id`, and the driver reading the new layout**
  - **Lane:** docs
  - **Model:** fable
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R173, R174
  - **Reads:** the phase set (above); SPEC FR-SDD-3..7, FR-SDD-13 (the ceilings the output must meet); PLAN D-1059..D-1062; the three documents **by heading only** (`rg -n '^#' SPEC.md PLAN.md TASKS.md`) and by slice where a heading's destination is unclear; `scripts/sdd/{brief,tasks}.ts` and their tests.
  - **Goal:** SPEC.md, PLAN.md and TASKS.md become indexes within `INDEX_MAX_KB`; every phase's text is in `docs/sdd/phases/<version>/`, the Decision Log in `docs/sdd/decisions.md` row for row, the timeless parts in `docs/sdd/reference/`; `npm run sdd:id <id>` prints any id; and the driver's briefs for R167–R171 are byte for byte what they were.
  - **Satisfies:** FR-SDD-3, FR-SDD-4, FR-SDD-5, FR-SDD-6, FR-SDD-7; US-51 AC1–AC3.
  - **Scope (PLAN D-1059..D-1062):** first commit: R167–R171's briefs recorded into `scripts/sdd/__fixtures__/briefs/` from the parent; `scripts/sdd/{splitMap,split,rewrap,ids}.ts` with tests; the split run and its output committed (phase folders named by version, closed TASKS sections byte for byte with their checkboxes, both revision histories to `reference/revision-history.md`, PLAN §12 to `reference/traceability.md` as it is); `docs/sdd/archive.json` empty; `ids.md` with the old-section lines; `npm run sdd:id`; `brief.ts` and `tasks.ts` reading the open TASKS.md, a phase's `tasks.md` and ids through `ids.ts`.
  - **Touches outside the lane:** `scripts/sdd/{brief,tasks}.ts` (V213-11: the split and the brief change land together); `package.json` (the `sdd:id` script only).
  - **Out of scope:** `AGENTS.md`, `CLAUDE.md` and the workflows (R176); any rewording; the area files (V213-9).
  - **Done when:**
    - `split.test.ts`: every input line in the output once with whitespace collapsed; `decisions.md` equals §12 at the parent row for row; a heading missing from the map fails.
    - `brief.test.ts` regenerates R167–R171's briefs from the new layout equal to the fixtures, byte for byte.
    - The index files are each ≤ 15 KB; TASKS.md holds only the v2.13 block and the status table; `npm run sdd:id V212-13` prints the row.
    - `npm test`, lint and typecheck green; no `src/` path in the diff.
  - **Note (as done):** SPEC.md and PLAN.md are under 15 KB, TASKS.md is about 25 KB because the open block alone is 23.8 KB (D-1081); PLAN §4 went to `reference/project-structure.md` to keep PLAN.md under the ceiling (D-1078); `sdd-run.ts` and `git.ts` read the closed phases' tasks.md too (D-1080).

### Wave 4

- [ ] **R176 — `AGENTS.md` for every agent, `CLAUDE.md` as its import, the seven workflows, the skills as pointers, and `RELEASE.md` as a procedure**
  - **Lane:** docs
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R175
  - **Precondition:** the driver restarted from a fresh `origin/main` after R175 merged.
  - **Reads:** the phase set (through `sdd:id` and `docs/sdd/phases/v2.13/`); SPEC FR-SDD-8, FR-SDD-9, FR-SDD-18, FR-SDD-21, FR-SDD-23; PLAN D-1063, D-1065, D-1068; `CLAUDE.md`; `.claude/skills/*/SKILL.md`; the review and fix prompts in `scripts/sdd/session.ts` (read only); `docs/RELEASE.md` by heading.
  - **Goal:** any coding agent that reads `AGENTS.md` knows what each kind of work reads and follows a plain procedure for it; `/sdd-implement` and the other skills still work, pointing at the same procedures.
  - **Satisfies:** FR-SDD-8, FR-SDD-9 (the files; building the driver's prompts from them is R177's), FR-SDD-21 (in `breakdown.md`); US-51 AC4.
  - **Scope (PLAN D-1063):** `AGENTS.md` within `AGENTS_MAX_KB` (today's `CLAUDE.md` content, the stack, the reading table, the pointers); `CLAUDE.md` = `@AGENTS.md`; `docs/sdd/workflows/{spec,breakdown,implement,visual-review,review,fix-ci,release}.md`, each within `WORKFLOW_MAX_KB` and opening with `Reads:` and `Never reads:`; `review.md` with D-1065's tiers and finding shape; `visual-review.md` with D-1068's scripts; the four skills reduced to pointers (written through `node -e` and `fs` in a headless session, per `gotchas.md`); `RELEASE.md` as the procedure, each release's record moved to its phase folder.
  - **Touches outside the lane:** `.claude/skills/*/SKILL.md`.
  - **Out of scope:** the driver's code (R177); the capture scripts (R178).
  - **Done when:**
    - `AGENTS.md` ≤ 6 KB; each workflow ≤ 4 KB with its reading lines; each skill ≤ 5 lines after its frontmatter; `CLAUDE.md` is one line.
    - `RELEASE.md` holds no per-release section; each moved record is in its phase folder, and the lossless test still passes.
    - `npm test`, lint and typecheck green.

- [ ] **R178 — Captures off `main`'s history: the manifest, the pixel diff, the compression, the `captures` branch and `captures.yml` on the manifest**
  - **Lane:** ui
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R175
  - **Precondition:** the driver restarted from a fresh `origin/main` after R175 merged.
  - **Reads:** the phase set (through `sdd:id`); SPEC FR-SDD-22, FR-SDD-23; PLAN D-1068; `tests/e2e/{captureSet,captureSeeds}.ts`, `tests/e2e/v1-captures.spec.ts`, `.github/workflows/captures.yml`, `scripts/ci-affected.ts`; `README.md` and `docs/DESIGN.md` for the images they cite; `docs/sdd/gotchas.md`'s captures section.
  - **Goal:** a task re-shoots only the captures its diff reaches, an agent looks only at the ones that changed, side by side, and the capture set stops growing `main`'s history.
  - **Satisfies:** FR-SDD-22, FR-SDD-23.
  - **Scope (PLAN D-1068):** `scripts/captures/manifest.json` (every capture in `captureSet.ts` mapped to its source globs), `diff.ts` (pngjs, YIQ delta, `CAPTURE_DIFF_SHARE`, the half-size side-by-side image) and `compress.ts`, with tests; the capture spec writing compressed files; `captures.yml` on the manifest and `workflow_dispatch`, committing to the orphan `captures` branch and writing the side-by-side images to the job summary; `docs/screenshots/v1-*` removed from `main` once on the branch; the README, design and promo images kept.
  - **Touches outside the lane:** `.github/workflows/captures.yml`.
  - **Out of scope:** the manifest-coverage check in `check:sdd` (R179); any capture's content changing (no `src/` change).
  - **Done when:**
    - `diff.test.ts`: an identical pair and an anti-aliased pair are under `CAPTURE_DIFF_SHARE`, a changed pair is over it, and the side-by-side image has both halves.
    - Every capture name in `captureSet.ts` is in the manifest, and every glob matches a file.
    - The `captures` branch holds the set; `main` keeps only the README, design and promo images; the README renders its images.
    - `npm test`, lint and typecheck green.

### Wave 5

- [ ] **R177 — An agent is a config entry: `sdd.agents.json`, the config-driven session, tiers, the review tier and structured findings**
  - **Lane:** data
  - **Model:** fable
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R176
  - **Reads:** the phase set (through `sdd:id`); SPEC FR-SDD-2, FR-SDD-9 (the prompts), FR-SDD-10, FR-SDD-11, FR-SDD-16 (the digest's hand-off), FR-SDD-18; PLAN D-1064, D-1065, D-835; `scripts/sdd/**` and their tests; `docs/sdd/workflows/{review,fix-ci}.md`.
  - **Goal:** the driver runs whatever agent `sdd.agents.json` describes, names no agent or model in its code, picks models by tier, records budget overruns without stopping anything, chooses the review tier by D-1065 and hands fix sessions the findings and the failure digest; with the `claude` entry it behaves exactly as today.
  - **Satisfies:** FR-SDD-2 (report-only), FR-SDD-9 (the prompts from the workflows), FR-SDD-10, FR-SDD-11, FR-SDD-16 (the hand-off), FR-SDD-18; US-51 AC5.
  - **Scope (PLAN D-1064, D-1065):** `scripts/sdd/agents.ts` (zod schema, loader), `sdd.agents.json` with the `claude` entry (today's argv, tiers fable/opus/sonnet, fallback, limit pattern, `stream-json`, `claude-allowlist`, optional ceilings unset); `session.ts` building argv from the entry and choosing the parser; the `exit-code` parser; `tasks.ts` reading `Tier:` and `Agent:` and closed `Model:`; `--agent`; `review.ts`; findings as JSON lines; the review and fix prompts from the workflow files; the open TASKS entries (R179–R181) converted to `Tier:`.
  - **Touches outside the lane:** `TASKS.md` (the open entries' `Model:` → `Tier:` only).
  - **Out of scope:** pruning and the brief's prefix (R180); setting the ceilings (R181); a second agent's entry.
  - **Done when:**
    - `agents.test.ts`: the schema accepts the file and rejects a broken one; the argv per tier equals today's; both parsers; the limit pattern matches the recorded limit message and its reset time.
    - `review.test.ts` covers every D-1065 case; the existing driver tests pass with model names turned into tiers.
    - `rg` finds no `claude`, `fable`, `opus`, `sonnet` or `haiku` in `scripts/sdd/*.ts` outside tests and `agents.ts`'s comments.
    - `npm test`, lint and typecheck green.

### Wave 6

- [ ] **R179 — `npm run check:sdd` in CI, the generated traceability, the `max-lines` warning and the commit-title check**
  - **Lane:** ui
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R177, R178
  - **Reads:** the phase set (through `sdd:id`); SPEC FR-SDD-4, FR-SDD-6, FR-SDD-8, FR-SDD-9, FR-SDD-10, FR-SDD-13, FR-SDD-14, FR-SDD-19, FR-SDD-20, FR-SDD-22, FR-SDD-24; PLAN D-1069; `scripts/check-trailers.ts`, `.github/workflows/ci.yml`, `eslint.config.*`.
  - **Goal:** CI fails a PR that breaks any rule of the new layout (a long line, an oversized file, a stale `ids.md` or `map.md`, an id that does not resolve, a workflow without its reading row, an invalid agents config, a capture with no manifest entry, a v2.13 requirement with no test, a long commit title); the traceability table writes itself from test names.
  - **Satisfies:** FR-SDD-4 (the check), FR-SDD-13, FR-SDD-19, FR-SDD-20 (the title check), FR-SDD-24; the checks of FR-SDD-6, FR-SDD-8, FR-SDD-9, FR-SDD-10, FR-SDD-14, FR-SDD-22; US-51 AC7.
  - **Scope (PLAN D-1069):** `scripts/sdd/limits.ts` (SPEC §4.56's constants), `scripts/check-sdd.ts` and `npm run check:sdd`, `scripts/sdd/traceability.ts` writing `docs/sdd/reference/traceability.md` under the moved hand-kept rows; ESLint `max-lines` at warn, 600; the title check beside `trailers`; an `sdd` job in `ci.yml` that runs on every PR, `docs_only` included; the v2.13 tests renamed to carry their ids where they do not yet.
  - **Touches outside the lane:** `.github/workflows/ci.yml` (the `sdd` job only), `eslint.config.*`.
  - **Out of scope:** the archive paths (R180 fills `archive.json`; the resolution check reads it whatever it holds).
  - **Done when:**
    - `check-sdd.test.ts` has one failing fixture per rule above, and `npm run check:sdd` exits 0 on the branch.
    - `traceability.md` lists every FR-SDD id with a test; the earlier rows are byte for byte the moved table.
    - `npm test`, lint (warnings counted, none new as errors) and typecheck green.

- [ ] **R180 — Pruning at each wave and the brief's stable prefix**
  - **Lane:** data
  - **Model:** sonnet
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R177
  - **Reads:** the phase set (through `sdd:id`); SPEC FR-SDD-17, FR-SDD-27; PLAN D-1062, D-1071; `scripts/sdd/{cli,brief,git}.ts`.
  - **Goal:** merged branches and worktrees go at the start of each wave, and sessions of one wave share their brief's first part byte for byte.
  - **Satisfies:** FR-SDD-17, FR-SDD-27.
  - **Scope (PLAN D-1062, D-1071):** `scripts/prune-merged-branches.ts` with `--dry-run`, called by `cli.ts` at the start of a wave; `brief.ts` with the shared part first (rules, tool policy, gotchas digest) and R175's fixtures re-recorded with that order as the only change.
  - **Touches outside the lane:** none.
  - **Out of scope:** the archive (R181); `captures` (R178).
  - **Done when:**
    - `prune-merged-branches.test.ts` on a fixture repo deletes only merged branches and never `main`, `release`, `captures`, `archive` or an open PR's branch.
    - Two briefs of one wave share their first section byte for byte; the re-recorded fixtures differ from R175's by the order only.
    - `npm run check:sdd`, `npm test`, lint and typecheck green.

### Wave 7

- [ ] **R181 — The archive and the phase report: closed evidence off `main`, the tier ceilings set from the ledger, the phase's totals and quality, and the app unchanged**
  - **Lane:** docs
  - **Model:** sonnet
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R179, R180
  - **Reads:** the phase set (through `sdd:id`); SPEC FR-SDD-1, FR-SDD-2, FR-SDD-26, FR-SDD-28; PLAN D-1058, D-1070; the knip config and `package.json` scripts; `sdd-run/usage.jsonl` and the phase's PR bodies (`gh pr view`).
  - **Goal:** the phase ends with numbers: its tokens in total and per task, the most expensive task, the baseline against the post-split tasks, findings, flakes and CI reruns, and each tier's ceiling written into `sdd.agents.json`.
  - **Satisfies:** FR-SDD-1 (the report), FR-SDD-2 (the ceilings), FR-SDD-26, FR-SDD-28; US-51 AC6, AC8.
  - **Scope (PLAN D-1070):** the orphan `archive` branch with `spike/`, `docs/{dome-composition,mockups,stars,spike-glyphcss,window}/` and the local branches kept at the 2026-11-03 cleanup (listed in `gotchas.md`, else the PR asks the owner); `archive.json` filled and `ids.md` regenerated; the `spike:*` scripts and their knip entries removed; `docs/sdd/phases/v2.13/report.md`; each tier's ceiling = `TIER_BUDGET_FACTOR` × the phase's 90th percentile for that tier; FR-SDD-28's checks (no `src/` or `public/` path in the phase's diff, `dist/` asset names equal the base's); a line for the owner's memory trim.
  - **Touches outside the lane:** `sdd.agents.json` (the ceilings only), `package.json` (the `spike:*` scripts removed), the knip config, `spike/`.
  - **Out of scope:** a tag, a deploy, a version bump (V213-1).
  - **Done when:**
    - Every archived path resolves through `ids.md`; `npm run check:dead` green.
    - `report.md` has every number above, each traced to ledger lines or PR bodies.
    - `sdd.agents.json` validates with the ceilings set; `npm run check:sdd` green.
    - `git diff --stat <phase base>..HEAD -- src public` is empty; the `dist/` asset-name comparison is in the report.

### Requirement coverage (v2.13)

| Requirement | Task |
|---|---|
| FR-SDD-1 | R172 (the ledger), R181 (the report) |
| FR-SDD-2 | R177 (report-only), R181 (the ceilings) |
| FR-SDD-3..7 | R175 |
| FR-SDD-8 | R176 (the files), R179 (the check) |
| FR-SDD-9 | R176 (the files), R177 (the prompts), R179 (the check) |
| FR-SDD-10, FR-SDD-11 | R177 |
| FR-SDD-12 | R173 |
| FR-SDD-13 | R179 |
| FR-SDD-14 | R173 (the files), R179 (the check) |
| FR-SDD-15 | R174 |
| FR-SDD-16 | R174 (the digest), R177 (the hand-off) |
| FR-SDD-17 | R180 |
| FR-SDD-18 | R176 (`review.md`), R177 |
| FR-SDD-19 | R179 |
| FR-SDD-20 | R172 (the body), R179 (the title check) |
| FR-SDD-21 | R176 |
| FR-SDD-22 | R178 (the move), R179 (the check) |
| FR-SDD-23 | R178 |
| FR-SDD-24 | R179 |
| FR-SDD-25 | R174 |
| FR-SDD-26 | R181 |
| FR-SDD-27 | R180 |
| FR-SDD-28 | every task; R181 checks it |
| US-51 | R175 (AC1–3), R176 (AC4), R177 (AC5), R179 (AC7), R181 (AC6, AC8) |

Waves (for the sanity check): **wave 1** R172 (data) — **wave 2** R173 (docs) + R174 (data) — **wave 3** R175 (docs) — **wave 4** R176 (docs) + R178 (ui) — **wave 5** R177 (data) — **wave 6** R179 (ui) + R180 (data) — **wave 7** R181 (docs). No pair shares a file: R173 (`docs/sdd/`, `.ignore`, `scripts/sdd-map.ts`) against R174 (`scripts/{check,ci-digest}.ts`, `ci.yml`, `package.json`); R176 (documents, skills) against R178 (`scripts/captures/`, `tests/e2e/`, `captures.yml`); R179 (`check-sdd.ts`, `limits.ts`, `traceability.ts`, `ci.yml`, ESLint, `package.json`) against R180 (`cli.ts`, `brief.ts`, `prune-merged-branches.ts`). Waves 3 and 5 hold the phase's two `fable` tasks alone.
