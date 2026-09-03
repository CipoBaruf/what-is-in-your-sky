---
name: sdd-spec
description: Revise SPEC.md (and then PLAN.md) for a new phase or a scope change. Use when the user wants a new spec version, new requirements, a Decision Log change, or says "start the v1 spec", "amend the spec", "add a requirement".
---

# Spec revision loop

The spec is the contract; the plan follows it; TASKS.md follows both. This skill covers the first two. Do not implement anything and do not touch TASKS.md (that is `sdd-breakdown`).

## Before writing

1. Read SPEC.md, PLAN.md and TASKS.md in full. Note the current version numbers and the last Decision Log row.
2. List every requested change against the Decision Log (§12). A change that contradicts a row needs the owner's explicit authorisation and a new row; ask before drafting, one question at a time if the owner prefers.
3. Ask the owner the open questions with a recommended default on each. Do not draft until the answers are in.
4. Confirm the working tree is clean and create a branch `spec-<slug>` from `origin/main`. Never commit to `main`.

## Writing the spec

- Amend in place. Bump the status line (version, one-line summary of what changed, the new Decision Log range) and the date.
- New requirements get new stable IDs in a new family (`FR-<FAMILY>-<n>`); an existing requirement that changes keeps its ID and gets an "*(amended v<x>)*" note with the old rule in one clause so history stays readable.
- Every user story gets acceptance criteria that a test can check. "Looks good" is not a criterion; "the list has two columns at 100 cells and one below" is.
- Thresholds are constants with a documented default and rationale (FR-VIS-6 style).
- Roadmap (§9): the phase being specified gets a definition of done that lists requirement IDs; items leaving the phase are moved, never deleted.
- Decision Log: one row per decision, dated, with the consequence column naming the requirement IDs it touched.
- Plain, direct language. No marketing. Both languages of the product are English and Spanish, but the documents are English.

## Writing the plan

After the owner approves the spec:

- Bump PLAN.md's status line and input line (spec version).
- Add a decisions subsection for the phase (`§2.<n> <phase> decisions`) with `D-<n>` rows continuing the numbering.
- Extend §4 project structure, §5 data model, §6 worker contract, §7 data layer, §9 testing and §11 build only where the new requirements need it; each addition cites the FR it serves.
- Update §12 traceability so every new FR names a module.
- Note dependency additions in §11.1 with licence, boundary and risks.

## When done

1. Run `npm run typecheck` only if code was touched (it should not have been).
2. Commit on the branch in small steps (spec, then plan). No trailers.
3. Summarise: versions, new requirement families, Decision Log rows, open questions left for the owner, and say that `sdd-breakdown` is next.
