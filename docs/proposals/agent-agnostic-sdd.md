# Proposal: an agent-agnostic SDD workflow with documents cut by phase and area

Status: draft for the owner's approval. Nothing here is decided until it goes through `sdd-spec` as a phase.

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

These files are not written in one pass. A phase's `sdd-spec` session writes or updates the area files it touches, as part of that phase. This proposal's own phase seeds only the areas the next phase needs: chart-views, stars, globe and live, for the renderer work. Until an area file exists, a session reaches that area through `ids.md` and the phase files.

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

## 4. Checks

- `npm run check:sdd` in CI:
  - every id cited anywhere resolves in `ids.md`;
  - `ids.md` is up to date with the files;
  - every workflow file names its reading row;
  - `sdd.agents.json` validates against its schema;
  - TASKS.md holds only the open phase.
- The split script's lossless test, run once at the migration and kept as a regression for the generator.
- The driver's existing tests, on the `claude` entry.

## 5. Order of work

1. The split script and its lossless test. Then the phase folders, the index files, `decisions.md`, `reference/` and the `ids.md` generator with `sdd:id`.
2. `brief.ts` and `tasks.ts` read the new layout: a task's entry from the open TASKS.md or its phase's `tasks.md`, and ids through `ids.md`. Briefs for the last phase's tasks must come out byte-for-byte the same as before the split. That's the test.
3. `AGENTS.md`, `CLAUDE.md` as an import, and the workflows, with the skills reduced to pointers.
4. `sdd.agents.json`, the config-driven `session.ts`, tiers in TASKS.md, and the fallback and limit settings as data.
5. `gotchas.md` and the memory trim.
6. `check:sdd` in CI.
7. Seed the area files for chart-views, stars, globe and live, ready for the renderer phase.

Steps 1–2 must land together, or the driver breaks. Steps 3–6 can each be a task. Step 7 can be the first task of the renderer phase instead.

## 6. Cost and risk

- **Cost:** the split itself costs little in tokens, because a script does it. The main costs are the `brief.ts` change with its byte-for-byte test, the config-driven `session.ts`, and writing the four seed area files. The rough estimate is 5–8 % of a weekly limit, spread over four to five tasks.
- **Risk: the driver.** If briefs or sessions change behaviour, the next phase's waves fail. That's mitigated by the byte-for-byte brief test and by keeping the `claude` entry's command line identical to today's.
- **Risk: links.** Ids and section numbers cited in code comments (`PLAN §16.4`, `SPEC §4.47`) stop pointing at a numbered section. Ids keep working through `sdd:id`. For section numbers, `ids.md` also maps each old `§` to its new file, so no code comment needs editing.
- **Risk: the Decision Log is "fixed".** It moves to `docs/sdd/decisions.md` unchanged. The owner approves the move as part of this proposal.

## Open questions for the owner

1. The phase folder names: `v2.12`, or the roadmap's letters (`2u`)? This proposal assumes version numbers.
2. Should the closed phases' TASKS sections keep their checkboxes, or become a plain record?
3. Should the area files be seeded in this phase (step 7), or written by the renderer phase's own `sdd-spec`?
