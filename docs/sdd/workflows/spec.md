# Spec: a new phase or a scope change

Reads: SPEC.md and PLAN.md, `docs/sdd/ids.md`, each touched id by `npm run sdd:id <id>`.
Never reads: closed phases whole, TASKS.md.

The spec is the contract; the plan follows it; TASKS.md follows both.
This workflow covers the first two.
Do not implement anything and do not touch TASKS.md (that is `breakdown.md`).

## Before writing

1. Read SPEC.md and PLAN.md (the indexes) and note the open phase, the last version numbers and the last Decision Log row in `docs/sdd/decisions.md`.
2. Look up every id the request touches with `npm run sdd:id <id>`; read a closed phase's file only at the heading an id points to.
3. Before a screen, read `docs/DESIGN.md`: a handoff names the sheet's tokens and primitives by the names it prints, and a name it does not print is translated into the sheet before a task is cut (FR-DS-9).
4. List every requested change against the Decision Log. A change that contradicts a row needs the owner's explicit authorisation and a new row.
5. Ask the owner the open questions, one at a time, each with a recommended default. Do not draft until the answers are in.
6. Confirm the working tree is clean and create a branch `spec-<slug>` from `origin/main`. Never commit to `main`.

## Writing the spec

1. Create `docs/sdd/phases/<version>/spec.md` for the phase: its section, its requirements, its user stories, its roadmap entry. Keep it within `PHASE_DOC_MAX_KB`, one sentence per line, no line over `DOC_LINE_MAX`.
2. Update SPEC.md's status line, its current-phase section and its map; the status line it replaces moves, unchanged, to `docs/sdd/reference/revision-history.md`. SPEC.md stays within `INDEX_MAX_KB`.
3. New requirements get new stable ids in a family (`FR-<FAMILY>-<n>`), each one testable statement. An existing requirement that changes keeps its id and gets an "*(amended v<x>)*" note with the old rule in one clause.
4. Every user story gets acceptance criteria a test can check. "Looks good" is not a criterion; "the list has two columns at 100 cells and one below" is.
5. Thresholds are constants with a default and a rationale (FR-VIS-6 style).
6. The phase's definition of done lists requirement ids; items leaving the phase move, never vanish.
7. Append Decision Log rows to `docs/sdd/decisions.md`: one row per decision, dated, the consequence naming the ids it touched.
8. Plain, direct language. The product is English and Spanish; the documents are English.

## Writing the plan

After the owner approves the spec:

1. Create `docs/sdd/phases/<version>/plan.md`: a decisions block with `D-<n>` entries continuing the numbering (an id, a one-line title, at most five lines each), and the additions to testing, the data model, the worker contract or build that the requirements need, each citing its FR.
2. Update PLAN.md's status, input line and map; replaced lines go to the revision history.
3. Name the delivery: the waves, the tier per task, the budget (as the last phase's plan did).
4. Note each dependency addition with its licence, boundary and risks.
5. Regenerate `docs/sdd/ids.md` (`npx tsx scripts/sdd/ids.ts --write`) and check it with `npm run ids:check`.

## When done

1. Run `npm run check` only if code was touched (it should not have been).
2. Commit on the branch in small steps (spec, then plan).
3. Summarise: versions, new requirement families, Decision Log rows, questions left for the owner, and that `breakdown.md` is next.
