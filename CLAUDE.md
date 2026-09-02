# What is in your sky right now

Naked-eye satellite spotting web app. Spec-driven development.

## Documents

- SPEC.md — what the product does. Decision Log (§12) is fixed unless I say otherwise.
- PLAN.md — how it's built: architecture, data model, worker contract, testing.
- TASKS.md — ordered vertical slices. Only implement what's listed there.

## Workflow

- Read all three documents before touching code.
- Use the `sdd-implement` skill for any implementation work.
- Use the `sdd-breakdown` skill to regenerate TASKS.md; never edit it by hand except to check tasks off.
- If code needs something the docs don't cover, stop and propose the doc change first.
- One task per branch. Check the task off on that branch; merging to main marks it done.

## Stack

React 19 + TypeScript + Vite, static deploy, no backend in MVP. Physics in a Web Worker with satellite.js. Sky chart with @glyphcss/react. See PLAN.md for the rest.

## Conventions

- Plain, direct language in docs and commit messages.
- Tests for every acceptance criterion; physics changes must pass the golden fixtures from R1.
- npm for package management.
