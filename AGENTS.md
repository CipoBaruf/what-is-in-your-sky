# What is in your sky right now

Naked-eye satellite spotting web app. Spec-driven development.
This file is for any coding agent; `CLAUDE.md` imports it.

## Documents

- `SPEC.md`: what the product does, as an index of the phases. The Decision Log (`docs/sdd/decisions.md`) is fixed unless the owner says otherwise; a later row may supersede an earlier one, never edit it.
- `PLAN.md`: how it is built: the fixed inputs, the architecture, a map of the files.
- `TASKS.md`: the open phase's tasks as vertical slices, and a status table of every phase. Only implement what is listed there.
- `docs/sdd/phases/<version>/`: each phase's `spec.md`, `plan.md`, `tasks.md` and, once released, `release.md`.
- `docs/sdd/reference/`: the glossary, the data model, the worker contract, testing, build and deploy, delivery (the lanes, the waves, the task fields).
- `docs/sdd/ids.md`: where every id lives. `npm run sdd:id <id>` prints one id's text with its file and heading; it is the cheapest lookup there is.
- `docs/sdd/map.md`: one line per source file with its purpose and exports. Locate code there before opening files.
- `docs/sdd/gotchas.md`: the project's known traps (e2e and the sandbox, captures, the driver, the npm cache, GitHub merging, glyphcss, dome perf). Read the section for the work at hand.

## What each kind of work reads

| Work | Workflow | Reads | Never reads |
|---|---|---|---|
| New phase or spec change | `docs/sdd/workflows/spec.md` | SPEC.md and PLAN.md, `ids.md`, each touched id by `sdd:id` | closed phases whole, TASKS.md |
| Breakdown | `docs/sdd/workflows/breakdown.md` | the new phase's `spec.md` and `plan.md`, TASKS.md, `reference/delivery.md` §16.1–§16.3 | other phases |
| Implement a task, headless | `docs/sdd/workflows/implement.md` | `sdd-run/<task>.brief.md` | the index files, the phase files |
| Implement a task, interactive | `docs/sdd/workflows/implement.md` | the task's entry, each cited id by `sdd:id`, `map.md` | whole phase files |
| Visual review | `docs/sdd/workflows/visual-review.md` | the pixel-diff report, the side-by-side images past `CAPTURE_DIFF_SHARE` | unchanged captures, the phase files |
| Review a PR | `docs/sdd/workflows/review.md` | the brief, the diff, `gotchas.md` | the phase files, the session transcript |
| Fix CI or findings | `docs/sdd/workflows/fix-ci.md` | the failure digest, the findings, the brief | the job log, the session transcript |
| Release preparation | `docs/sdd/workflows/release.md` | `docs/RELEASE.md`, the last phase's `release.md`, the phase's `tasks.md` | earlier records, other phases |
| Bug fix or question | none | `map.md`, then ids by `sdd:id` | the index files' history |

Each workflow opens with its own row as `Reads:` and `Never reads:` lines.

## Workflow

- Headless (`SDD_HEADLESS=1`, a session started by `scripts/sdd-run.ts`): the brief replaces the three documents (PLAN D-198); look an id up only where the brief points.
- Interactive: read the task's entry and the ids it names, not the documents whole.
- If code needs something the docs do not cover, stop and propose the doc change first.
- One task per branch. Check the task off on that branch; merging to `main` marks it done.
- Regenerate TASKS.md only through the breakdown workflow; never edit it by hand except to check a task off.
- Run `npm run check` (typecheck, lint, unit tests and the affected e2e specs, quietly) in place of the raw tools; `npm test` runs once before the last commit.

## Stack

React 19 + TypeScript + Vite, a static deploy on Cloudflare Workers static assets, no backend. Physics in a Web Worker with satellite.js. Sky chart with @glyphcss/react. See PLAN.md for the rest.

## Conventions

- Plain, direct language in docs and commit messages. Commit titles at most 72 characters; ids go in the body.
- Tests for every acceptance criterion; physics changes must pass the golden fixtures from R1.
- npm for package management.
- Never `git add -A`: name the files.
