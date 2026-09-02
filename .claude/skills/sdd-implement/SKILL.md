---
name: sdd-implement
description: Implement one task from TASKS.md following the project's spec-driven workflow. Use when the user says "implement task N", "next task", "continue with TASKS.md", or starts a session to work on the satellite app.
---

# SDD task loop

## Before writing code

1. Read SPEC.md, PLAN.md and TASKS.md. Identify the requested task (or the first unchecked one if the user said "next").
2. Confirm its dependencies are checked off. If not, stop and say which are missing.
3. Restate the task in two sentences: what it delivers and which requirement IDs (FR-\*) it satisfies. Wait for confirmation only if the task is ambiguous.

## While implementing

- Stay inside the task's scope. If something adjacent needs changing, note it under "Follow-ups" instead of doing it.
- If the spec or plan turns out to be wrong or incomplete, stop, explain the conflict, and propose the document change first. Never silently diverge.
- Write or update tests for the task's acceptance criteria before marking it done.
- Physics-related code must include a check against the reference values recorded in the spike (task 1).

## When done

1. Run the test suite and typecheck; report results.
2. Check the task off in TASKS.md and add a one-line note of what was actually done if it differs from the task text.
3. Append any decisions made to the PLAN.md Decisions section.
4. Summarize: files touched, requirement IDs covered, follow-ups, and the next task ID.
5. Suggest the user `/clear` before the next task.
