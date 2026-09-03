---
name: sdd-breakdown
description: Generate or regenerate TASKS.md from SPEC.md and PLAN.md as vertical slices. Use when the user asks to create, redo, or extend the task list.
---

# Task breakdown as vertical slices

Read SPEC.md and PLAN.md first. Do not implement anything.

## Slicing rules

- Every task after the physics spike delivers something a user can see or run end-to-end, even if crude. "Build the data layer" is not a task; "show the next ISS pass as text for typed coordinates" is.
- Order by user value and risk: the riskiest unknown (physics) first, then the thinnest path to a working product, then breadth (more satellites, weather, geocoding), then polish (sky dome, visual identity).
- A task should be one PR. If it touches more than ~3 modules, split it.
- Prefer extending a thin slice over adding a parallel one.

## Task format

- [ ] **T<n> — <goal in one line>**
  - Satisfies: FR-\* IDs
  - Depends on: T<ids> (or none)
  - [P] if parallelizable with neighbours
  - Done when: verifiable check (test name, command output, or exact visual state)

## Appending a phase

When TASKS.md already has checked tasks (a finished phase), do not regenerate them. Append a new block under a heading for the phase (`## v1 tasks`, with its own status line naming the spec and plan versions it was cut from) and continue the task numbering (R16 after R15). Checked tasks and their notes stay byte for byte. The new tasks may depend on checked ones by ID.

The header table gets a new row per phase (`Inputs (v1)`, `Scope (v1)`) rather than rewriting the MVP rows.

## Output

Write TASKS.md, then show only the list of IDs and goals. Ask before regenerating if a TASKS.md with checked items already exists; appending a phase (above) needs no confirmation once the spec and plan for that phase are approved.
