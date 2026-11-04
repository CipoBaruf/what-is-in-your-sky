# Breakdown: a phase's tasks as vertical slices

Reads: the new phase's `spec.md` and `plan.md`, TASKS.md, `docs/sdd/reference/delivery.md` §16.1–§16.3.
Never reads: other phases.

Do not implement anything.
Look up an id from another phase with `npm run sdd:id <id>`, never by opening that phase's files.

## Slicing rules

1. Every task delivers something a user can see or run end to end, even if crude. "Build the data layer" is not a task; "show the next ISS pass as text for typed coordinates" is. A task about the repository itself is `P<n>`, not `R<n>`.
2. Order by value and risk: the riskiest unknown first, then the thinnest path to something working, then breadth, then polish.
3. A task is one PR and one unattended session, with a clear stopping point and no owner question in the middle. Anything the owner must decide is a `Gate: owner` task of its own.
4. Aim at `TASK_DIFF_TARGET_LINES` changed lines per task, generated files and captures not counted (FR-SDD-21). Split a task that would pass it.
5. Each task lists the superseded tests it deletes and the capture-manifest entries it adds (FR-SDD-21); "none" is an answer.
6. Prefer extending a thin slice over adding a parallel one.

## Task format

```
- [ ] **R<n> — <goal in one line>**
  - **Lane:** ui | live | chart | window | data | physics | docs
  - **Model:** fable | opus | sonnet | interactive   (R177 converts this to `Tier:` and `Agent:`; until it lands `scripts/sdd/tasks.ts` parses only `Model:`)
  - **Gate:** auto | owner
  - **Depends on:** R<ids>, or —
  - **Reads:** the ids and sections the session needs
  - **Goal:** what the user or the owner can do afterwards
  - **Satisfies:** FR-* and US-* ids
  - **Scope:** the modules and files, citing the plan's decisions
  - **Deletes:** the superseded tests, or none
  - **Captures:** the manifest entries it adds, or none
  - **Out of scope:** what a neighbouring task does
  - **Done when:** checks a test or a command can verify
```

- `Lane:` is §16.1's table: a task stays inside its lane's directories plus at most one shared file it names.
- `Tier:` is the cheapest that will do: `hard` only for a task that has failed before or carries the phase's risk.
- `Gate: owner` whenever acceptance includes captures to compare, Spanish copy to read, a composition to choose or a Decision Log change; everything else is `auto`.
- The optional fields of §16.3 (`Precondition:`, `Findings:`, `Review:`, `Turns:`, `Fallback:`) apply as written there.

## Waves

After the list, print the waves: wave 1 is every task with no unchecked dependency, wave n+1 every task whose dependencies are all in earlier waves.
Two tasks in one wave never name the same shared file; split the shared change into its own earlier task.
The driver (`scripts/sdd-run.ts`) recomputes the waves from `main` at run time; the printed list is for the owner to check the parallelism.

## Writing TASKS.md

1. TASKS.md holds the open phase only. When a phase closes, its block moves byte for byte, checkboxes included, to `docs/sdd/phases/<version>/tasks.md`, and the status table gains its row.
2. Add the new phase under `## <version> tasks` with a status line naming the spec and plan it was cut from, and continue the numbering.
3. Write the phase's header rows (status, inputs, scope) into `docs/sdd/reference/breakdown-inputs.md`.
4. Reserve each task's decision block (`D-<n>..D-<m>`) in the phase's intro.
5. Regenerate `docs/sdd/ids.md` with `npx tsx scripts/sdd/ids.ts --write`.

## Output

Show only the list of ids and goals and the waves.
Ask before regenerating a phase that has checked tasks; appending a phase needs no confirmation once its spec and plan are approved.
