# Proposal: an agent-agnostic SDD workflow with documents cut by phase and area

Status: adopted 2026-11-03 as SPEC v2.13 §4.56 (FR-SDD-1..28, V213-1..V213-11) and PLAN v0.21 §2.49, §16.32. Where this proposal and the spec differ, the spec holds.

## Why

1. **Reading cost.** SPEC.md (899 KB), PLAN.md (1.38 MB) and TASKS.md (740 KB) together are about 750 k tokens, more than one context window. Headless task sessions are already cheap because `scripts/sdd/brief.ts` cuts out only the ids a task names (D-198, the 48 k cap of D-453). Every other kind of work is expensive: `sdd-spec`, `sdd-breakdown`, reviews and ad-hoc sessions slice through the three files, and `CLAUDE.md` still says "read all three documents".
2. **Lock-in.** The workflow only runs under Claude Code. The coupling is narrow but real:
   - `CLAUDE.md` is read only by Claude.
   - The four procedures live in `.claude/skills/`.
   - `scripts/sdd/session.ts` spawns `claude -p` and parses its output and limit messages.
   - `scripts/sdd/tasks.ts` names Claude models (`fable`, `opus`, `sonnet`, `haiku`) and a fallback chain built on them.
   - Project knowledge such as the e2e gotchas, capture recipes and driver quirks lives in Claude's per-user memory outside the repo, where no other agent, and no other machine, can see it.

## Goals

- Every kind of work reads only what it needs, and the documents say what that is.
- Any coding agent that reads `AGENTS.md` can do every kind of work interactively.
- The driver runs any agent that a config entry describes. No agent's name or model appears in the driver's code.
- No content is lost or reworded in the move. The Decision Log keeps every row and id as written; it is only relocated.

## Non-goals

- Rewriting history. Closed phases' text is moved, not edited.
- Building adapters for agents nobody has installed here. The config format must be able to describe them; only `claude` is tested in this phase.
- Changing the product. No `src/` change.

## 1. The layout

The current §4 is laid out by phase, not by area: 4.1–4.55, where each phase adds a section and a later section overrides an earlier one. The roadmap (§9), the PLAN decisions (§2) and TASKS.md are laid out by phase too. So the split happens in two stages.

### Stage A: by phase (scripted, lossless)

```
AGENTS.md                      the entry point for every agent (replaces CLAUDE.md's content)
CLAUDE.md                      one line: @AGENTS.md

SPEC.md                        index: summary, goals and non-goals, the current phase, map of files
PLAN.md                        index: fixed inputs, architecture overview, project structure, map
TASKS.md                       the open phase's tasks only, plus a status table of every phase

docs/sdd/phases/<phase>/       one folder per phase: mvp, v1, v1.1, … v2.12
  spec.md                      that phase's §4 sections, §9 roadmap entry, findings, open questions
  plan.md                      that phase's §2 decisions and §16 delivery rows
  tasks.md                     that phase's TASKS.md section
docs/sdd/decisions.md          the §12 Decision Log, moved whole (fixed, append-only)
docs/sdd/ids.md                generated: one line per id (FR-, V…-, D-, R…, F-) → file and heading
docs/sdd/reference/            the timeless parts: glossary, data model, worker contract,
                               testing strategy, build and deploy, requirement traceability
docs/sdd/workflows/            spec.md, breakdown.md, implement.md, review.md, visual-review.md
docs/sdd/gotchas.md            the project knowledge moved out of agent memory
sdd.agents.json                the agents the driver may run
```

A script does the split by headings, so no agent has to read the 3 MB to do it. A test then checks that the concatenated output holds every line of the input, so nothing is lost.

### Stage B: by area (written, incremental)

`docs/sdd/areas/<area>.md` holds the **current** requirements and design of one area, with an id link back to the phase that set each line. Proposed areas: passes, live, stars, globe, chart-views, layout, settings, places, offline-pwa, i18n, design-system, release.

These files are not written in one pass. A phase's `sdd-spec` session writes or updates the area files it touches, as part of that phase. The renderer phase writes the first four: chart-views, stars, globe and live. Until an area file exists, a session reaches that area through `ids.md` and the phase files.

## 2. What each kind of work reads

This table goes into `AGENTS.md` and each workflow file repeats its own row.

| Work | Reads | Never reads |
|---|---|---|
| Implement a task (headless) | `sdd-run/<task>.brief.md` | the index files, the phase files |
| Implement a task (interactive) | the task's entry, then each cited id via `npm run sdd:id <id>` | whole phase files |
| Review a PR | the brief, the diff, `gotchas.md` | the phase files |
| New phase (`workflows/spec.md`) | SPEC and PLAN index, the area files touched, `ids.md` | closed phases, except by id |
| Breakdown (`workflows/breakdown.md`) | the new phase's `spec.md` and `plan.md`, TASKS conventions | other phases |
| Bug fix or question | the area file, then ids | the index files' history |

`npm run sdd:id D-1054` prints one id's text, with its heading and file. It's the cheapest lookup there is, and it works the same for every agent.

## 3. Agent-agnostic tooling

### `AGENTS.md`

`AGENTS.md` is the shared file that Codex, Cursor, Copilot, Gemini CLI, Jules and others read. It holds today's `CLAUDE.md` content, the reading table and the stack. It points to the workflows and to `gotchas.md`.

`CLAUDE.md` keeps one import line: `@AGENTS.md`.

### Workflows instead of skills

The four `.claude/skills/*/SKILL.md` procedures (about 150 lines) move to `docs/sdd/workflows/*.md`, written as plain procedures with no tool-specific calls. Each Claude skill becomes a three-line pointer to its workflow, so `/sdd-implement` keeps working.

### The driver: an agent is a config entry

`scripts/sdd/session.ts` stops naming `claude`. It reads `sdd.agents.json`:

```json
{
  "default": "claude",
  "agents": {
    "claude": {
      "command": ["claude", "-p", "{prompt}", "--model", "{model}", "--output-format", "stream-json", "--max-turns", "{maxTurns}"],
      "tiers": { "hard": "fable", "standard": "opus", "light": "sonnet" },
      "fallback": ["hard", "standard", "light"],
      "limit": { "pattern": "…the message claude prints on a usage limit…", "reset": "…capture group for the reset time…" },
      "result": "stream-json",
      "toolPolicy": "claude-allowlist"
    }
  }
}
```

- **Tiers.** TASKS.md names a tier (`hard`, `standard`, `light`), not a model. Each agent maps tiers to its own models. The existing `model` fields convert one to one: fable→hard, opus→standard, sonnet→light, haiku→light. The review model is a tier too.
- **The fallback chain** is a list of tiers in the config, so `fable → opus → sonnet` becomes data.
- **Limit detection** is a pattern in the config. "Waits out a limit and resumes" (D-835) keeps working for any agent whose limit message the pattern matches.
- **Results.** `result` names a parser. `stream-json` is the one that exists today. A plain `exit-code` parser (success = exit 0, plus the handoff file the session writes) is the fallback any agent can meet.
- **Tool policy.** Today's allowlist is Claude's permission syntax. It stays in the claude entry. Another agent's entry names its own policy, or `none` when that agent sandboxes itself.
- `npm run sdd -- --wave --agent codex` picks an agent for a run; a task may also pin one with `Agent: <name>` in its TASKS entry.

The `claude` entry has to reproduce today's behaviour exactly. The driver's existing tests run against it unchanged, apart from model names becoming tiers.

### Knowledge out of memory

The project facts in Claude's memory move into `docs/sdd/gotchas.md`, one section per subject:
- e2e and sandbox (paused clock, hash goto, user-event and fake timers);
- captures (wrapper config, the lore build, macOS noise, base-vs-branch recipe);
- driver (waves, races, orphaned sessions, headless env vars, `.claude/` edits);
- npm cache;
- GitHub merging (stale heads, stacked PRs, `--match-head-commit`);
- glyphcss (while it lasts);
- dome perf method.

Personal preferences stay in Claude's memory: commit trailers, asking questions one by one, promo voice. After the move, the memory index shrinks to those plus a pointer to `gotchas.md`.

## 3a. Token economy as a rule

Token cost is a requirement, not a habit. Every workflow, document, script and code change is held to it, and the checks in §4 enforce what can be enforced.

### Measure first

- **A usage ledger.** The driver records each session's tokens from the agent's result: input, cached input, output, turns, tier and outcome. It appends them to `sdd-run/usage.jsonl` and prints a per-task line in the PR body. Every rule below is judged against this ledger, and each phase's release notes report the phase's total and the most expensive task.
- **A budget per tier.** Each tier in `sdd.agents.json` carries a token ceiling next to `maxTurns`. The driver stops a session that passes it and reports the overrun, the way it handles the wall clock today.

### What a session reads

1. **One sentence per line in the documents.** Today 747 lines in SPEC, PLAN and TASKS are over 1,000 characters, so one `rg` hit prints a whole paragraph. The split rewraps the text at sentence ends: whitespace only, which the lossless test checks. `check:sdd` then fails on any line over 400 characters.
2. **Size ceilings.** The index files stay at 15 KB or less. A phase's `spec.md` or `plan.md` stays at 60 KB or less, an area file at 30 KB or less, a workflow at 4 KB or less, and `AGENTS.md` at 6 KB or less. `check:sdd` enforces all of them.
3. **A shape for each entry.** A decision gets an id, a one-line title and at most five lines of body. Its rationale goes in the phase's `plan.md` only when it's longer. A requirement is one testable statement. History lives in the phase files and never in the area files.
4. **A `.ignore` file** (read by `rg`, `fd` and most agents' search tools) leaves out `dist/`, `node_modules/`, `docs/screenshots/`, `**/__snapshots__/`, fixtures, `public/data/`, the places and star catalogues, and lockfiles. A search then hits source and docs only.
5. **A code map.** `docs/sdd/map.md` is generated: one line per source file with its purpose (the file's first doc-comment sentence) and its exports. An agent locates code from the map before it opens anything. `check:sdd` keeps it current.

### What a session writes and runs

6. **Quiet commands.** `npm run check` runs typecheck, lint, unit tests and the affected e2e tests (`scripts/ci-affected.ts`). It prints only failures: the test name, the first assertion and five lines of stack. On success it prints one line: what passed and the count of warnings by tool. A warning count that rises is reported in the handoff. The workflows tell every agent to run it in place of the raw tools.
7. **Failure digests for fix sessions.** When CI fails, the driver hands the fix session a digest of the failing jobs (test names and first errors, capped at 4 KB), not the job log.
8. **Pixel diffs before images.** Visual review compares captures with a pixel-diff script first. An agent looks only at the captures that differ past a threshold, at reduced size, and side by side in one image. An image costs about as much as a page of text.
9. **Comments.** A comment cites the id and says in one line what the code can't. A new file keeps a header of at most five lines. Existing comments are left alone; this rule is for new code.
10. **File size.** A new source file stays under 500 lines. The five files over 880 lines (`SkyWindow`, `Live`, `GlobeRenderer`, `Stars`, `StarField`) are split when a task next touches them, not in a sweep. A lint warning flags any file over 600 lines.

### How sessions run

11. **A stable prefix for the prompt cache.** The brief puts the parts every session shares first, in a fixed order: rules, tool policy, gotchas digest. The task's own parts come last. Sessions in one wave then share a cached prefix, and cached input costs a fraction of fresh input.
12. **The cheapest tier that works.** Review runs on `light`, except that it stays on `standard` for:
    - `hard` tasks;
    - tasks with `Gate: owner`;
    - any diff that touches `src/physics/`, the worker or `scripts/sdd/`.

    A task that changes only docs gets no review session. A task that changes only tests keeps one, because a weakened test passes CI. `hard` is kept for tasks marked hard in the breakdown. If the findings per phase rise after the switch, review goes back to `standard`.
13. **One task per session, no re-reading.** The workflows repeat this: read once, locate before reading, slice large files, delegate broad searches to a search subagent where the agent has one, and keep the handoff file under 2 KB.

## 3b. The rest of the development loop, at the same quality

None of these rules lowers the bar. The golden fixtures, the axe cases, the bundle budgets, the contrast checks and the owner's release reading all stay. The rules remove repetition and waste. **Quality is watched with the same ledger as cost:** the findings (F-ids) per phase, the flake rate and the CI retries per PR. A rule that raises any of them is reverted.

### Pull requests

- **A short body.** The body is 1.5 KB at most, with a fixed shape: what changed (three lines at most), the ids it closes, the checks that ran, the image diff summary and the usage line. Today's bodies run 5–6 KB, and the task's brief and handoff already carry the detail.
- **Short commit titles.** A title is 72 characters at most, with the ids in the body.
- **Smaller tasks.** The breakdown aims at a diff of about 600 changed lines per task, not counting generated files and captures. R169 added 2,482. Smaller diffs make cheaper reviews, cheaper fix sessions and fewer review misses.
- **Structured review findings.** Each finding is file, line, claim and failure scenario. The fix session reads the findings, not the review transcript.

### Images

- **Committed images live outside git history.** `docs/screenshots` is 116 MB in 1,099 PNGs, `.git` is 878 MB, and each full re-shoot adds a few dozen MB forever. The capture set moves to an orphan `captures` branch whose history is squashed at each release (owner, 2026-11-03). Only the README, design and promo images stay on `main`.
- **Re-shoot only what changed.** A capture manifest maps each capture to the source files it draws, the way `ci-affected.ts` does for specs. A task re-shoots only the captures its diff reaches. The full set is shot once, at release prep. `check:sdd` fails when a capture spec has no manifest entry, or when an entry names a file that no longer exists, so no screen goes unwatched until release.
- **Lossless compression** (`oxipng` or lossless WebP) at capture time, enforced in `check:sdd`.
- **Diffs, not sets.** The PR shows the captures that changed past the pixel threshold, side by side, in the job summary. That's the same diff the agent looks at (§3a 8).

### Tests

- **One test per acceptance criterion, at the lowest level that proves it.** Unit before component before e2e. An e2e spec covers a flow, not a single rule a unit test can hold.
- **The test name carries the id** (`FR-GLOBE-12: …`). The requirement-traceability table (PLAN §12, about 300 hand-kept lines) is then generated from the test names, and a requirement with no test fails `check:sdd`.
- **Superseded tests are removed with the behaviour they tested.** When a phase replaces a requirement, its breakdown lists the tests to delete, the same way it lists the files to change.
- **No large snapshots.** A snapshot over 5 KB is replaced by assertions on what matters, because agents read snapshot files. Today's total is small, at 168 KB, so this is a rule for new tests.
- **Flakes get quarantined with an F-id** and a fix task, not retried in place. A flaky test costs a fix session every time it fires.

### GitHub Actions

- **`concurrency` with `cancel-in-progress`** on CI for pull requests, so a superseded push stops running.
- **Build once.** One job builds and uploads `dist/`, and the e2e shards download it. Today all five shards run `npm run build`.
- **Cache the Playwright browsers**, keyed on the Playwright version.
- **Skip what a change can't break.** A docs-only or `docs/sdd/`-only PR runs `check:sdd` and the trailers job, not the build or e2e. A test-only PR runs only the tests it touched.
- **Captures only when captured screens change.** `captures.yml` uses the capture manifest on `main` instead of running for 20 minutes on every push, plus `workflow_dispatch` at release.
- **The failure digest is a CI artifact** (§3a 7), written by the job, so neither the fix session nor the owner opens a raw log.

## 3c. Workflows and cleanup

### The workflows, rewritten (not just moved)

| Workflow | Today's problem | Rewrite |
|---|---|---|
| `spec.md` (was `sdd-spec`) | Step 1 reads SPEC, PLAN and TASKS "in full", about 750 k tokens. It amends one big file in place, status lines and history included. | Read the index files, the touched area files and `ids.md`. Write the phase folder and update the area files. Hold the entry shapes and size ceilings of §3a. |
| `breakdown.md` (was `sdd-breakdown`) | Reads SPEC and PLAN first. Names models in `Model:`. Sizes tasks as "~3 modules". | Read only the new phase's `spec.md` and `plan.md`. Use `Tier:` with an optional `Agent:`. Aim for about 600 changed lines per task. Each task lists the superseded tests it deletes and the capture-manifest entries it adds. |
| `implement.md` (was `sdd-implement`) | Interactive mode reads all three documents. Runs the full `npm test`. Appends to PLAN's Decisions. No limit on the PR body. | Look up ids with `sdd:id`. Run `npm run check`. Write decisions to the phase's `plan.md`. Use the 1.5 KB PR template. |
| `visual-review.md` | Reads every PNG and copies captures to `docs/screenshots/` on `main`. | Pixel-diff first and look only at what changed. Captures go to the `captures` branch, with a manifest entry each. |
| `review.md` (new) | The driver's review prompt lives in code, so only the driver can use it. | Written down, with the tier rules of §3a 12 and structured findings. |
| `fix-ci.md` (new) | Fix sessions start from raw logs. | Start from the failure digest and touch only the failing checks. |
| `release.md` (new) | Release prep has run about ten times from `RELEASE.md`, now 188 KB. | One procedure. Each release's record goes in its phase folder, and `RELEASE.md` becomes the procedure only. |

### Obsolete after this phase

- **`CLAUDE.md`'s body** becomes `@AGENTS.md`. **The four skills' bodies** become pointers to their workflows.
- **About 30 of the 48 agent-memory files** are removed once `gotchas.md` holds them. Personal preferences stay.
- **PLAN §12's hand-kept traceability table** is replaced by the table generated from test names (§3b).
- **`docs/screenshots/` on `main`** (116 MB) moves to the `captures` branch.
- **`RELEASE.md`'s per-release sections** move into the phase folders.
- **The closed spikes and the evidence for decisions already made**, about 23 MB on `main`: `spike/` (including the panorama prototype, dropped 2026-11-03), `docs/dome-composition/`, `docs/mockups/`, `docs/stars/`, `docs/spike-glyphcss/`, `docs/window/` and the `spike:*` npm scripts. They move to an orphan `archive` branch and stay in git history. A decision that cites one of these files cites it through `ids.md`, which records the archive path.

### Obsolete after the renderer phase (listed here so that phase removes them)

glyphcss and `@glyphcss/react`, `scripts/build-braille-font.ts` and its npm script, `wiys-braille.otf`, the dome palette, the `#glyph-styles` sentinel, and the glyphcss allowances in the CSP.

### Housekeeping, once and then in CI

- `scripts/prune-merged-branches.ts` runs after each merge in the driver. Today there are 138 local and 136 remote branches.
- The driver removes a task's worktree once its PR merges.

## 4. Checks

- `npm run check:sdd` in CI:
  - doc line length and size ceilings (§3a 1–2), the code map is current (§3a 5);
  - every id cited anywhere resolves in `ids.md`;
  - `ids.md` is up to date with the files;
  - every workflow file names its reading row;
  - `sdd.agents.json` validates against its schema;
  - TASKS.md holds only the open phase.
- The split script's lossless test, run once at the migration and kept as a regression for the generator.
- The driver's existing tests, on the `claude` entry.

## 5. Order of work

0. **The usage ledger, alone and first** (§3a, "Measure first"). It runs on one or two tasks of the current driver before anything else changes, and the result is the baseline every later step is judged against. It records findings per phase, flakes and CI retries next to tokens.
1. The split script and its lossless test. Then the phase folders, the index files, `decisions.md`, `reference/` and the `ids.md` generator with `sdd:id`.
2. `brief.ts` and `tasks.ts` read the new layout: a task's entry from the open TASKS.md or its phase's `tasks.md`, and ids through `ids.md`. Briefs for the last phase's tasks must come out byte-for-byte the same as before the split. That's the test.
3. `AGENTS.md`, `CLAUDE.md` as an import, and the workflows, with the skills reduced to pointers.
4. `sdd.agents.json`, the config-driven `session.ts`, tiers in TASKS.md, and the fallback and limit settings as data.
5. `gotchas.md` and the memory trim.
6. `check:sdd` in CI.
6a. The token rules of §3a: the usage ledger and tier budgets in the driver, the rewrap (inside step 1), `.ignore`, `map.md`, the quiet `npm run check`, CI failure digests, the pixel-diff step in visual review, the cache-friendly brief order.

6b. §3b: the PR template and title rule, the capture manifest and the captures move, compression, test-name ids with the generated traceability, the CI changes (concurrency, build once, browser cache, path skips, captures by manifest).

6c. §3c: the seven workflows, the memory trim, the generated traceability replacing PLAN §12, the captures and archive branches, RELEASE.md split, branch and worktree pruning in the driver.

Steps 1–2 must land together, or the driver breaks. Steps 3–6 can each be a task.

## 6. Cost and risk

### Expected effect (estimates until the ledger measures them)

| Session kind | Reduction in tokens | Main levers |
|---|---|---|
| Spec and breakdown | 50–70 % | phase folders, `ids.md`, one sentence per line, area files |
| Ad-hoc and interactive | 40–60 % | `.ignore`, code map, `sdd:id` |
| Headless implementation | 20–35 % | quiet `check`, code map, smaller tasks, pixel diffs, cache-friendly brief |
| Fix sessions | 30–50 %, and fewer of them | failure digests, flake quarantine |
| Review | similar tokens, lower cost per token | light tier, docs-only PRs skipped |

Per phase that's roughly 30–45 % fewer tokens, plus a lower cost per token from tiers and prompt caching.

### Quality risks and their guards

- **Light-tier review misses more.** Guard: `standard` for hard, owner-gated, physics, worker and driver diffs, and a revert if findings per phase rise.
- **Affected-only captures miss an unmapped screen.** Guard: the manifest-coverage check, and the full set at release.
- **Deleting superseded tests drops coverage that's still valid.** Guard: the breakdown lists the tests to delete, and the review checks that list.
- **Quiet output hides warnings.** Guard: the warning count on success.
- **Reading less context misses a decision that cuts across areas.** Guard: `ids.md`, the area files and `check:sdd`. The brief has already proved that reading by id works for headless sessions.

- **Cost:** the split itself costs little in tokens, because a script does it. The main costs are the `brief.ts` change with its byte-for-byte test, the config-driven `session.ts`, and writing the four seed area files. The rough estimate is 5–8 % of a weekly limit, spread over four to five tasks.
- **Risk: the driver.** If briefs or sessions change behaviour, the next phase's waves fail. That's mitigated by the byte-for-byte brief test and by keeping the `claude` entry's command line identical to today's.
- **Risk: links.** Ids and section numbers cited in code comments (`PLAN §16.4`, `SPEC §4.47`) stop pointing at a numbered section. Ids keep working through `sdd:id`. For section numbers, `ids.md` also maps each old `§` to its new file, so no code comment needs editing.
- **Risk: the Decision Log is "fixed".** It moves to `docs/sdd/decisions.md` unchanged. The owner approves the move as part of this proposal.

## Owner's answers (2026-11-03)

1. **Phase folders** are named by version number: `docs/sdd/phases/v2.12/`.
2. **Closed TASKS sections** move byte-for-byte, checkboxes included.
3. **Area files** are written by the renderer phase's `sdd-spec` session, not by this phase. So step 7 is dropped here.
4. **The capture set** moves to an orphan `captures` branch whose history is squashed at each release. The README, design and promo images stay on `main`.
