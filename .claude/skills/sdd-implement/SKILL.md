---
name: sdd-implement
description: Implement one task from TASKS.md following the project's spec-driven workflow. Use when the user says "implement task N", "next task", "continue with TASKS.md", or starts a session to work on the satellite app.
---

# SDD task loop

## Before writing code

1. Interactive: read SPEC.md, PLAN.md and TASKS.md. Identify the requested task (or the first unchecked one if the user said "next"). Headless (`SDD_HEADLESS=1`): read `sdd-run/<task>.brief.md` instead — the driver wrote it (PLAN D-198) and it carries the task's entry, every requirement, story, finding and decision the entry names, the lane's row, the commit rule and the tool allowlist. Do not read the three documents in full; for an id or a section the brief does not carry, `rg -n "<ID>" SPEC.md PLAN.md TASKS.md` and read the lines it points at.
2. Confirm its dependencies are checked off. If not, stop and say which are missing.
3. Confirm the working tree is clean and on `main` (or start from `origin/main` after a fetch; parallel sessions share this checkout, so never `git add -A`). Create a branch `r<n>-<short-slug>` from `main` before the first edit. Never commit to `main`. ← NEW
4. Restate the task in two sentences: what it delivers and which requirement IDs (FR-\*) it satisfies. In an interactive session, wait for confirmation only if the task is ambiguous. In a headless session (`SDD_HEADLESS=1` in the environment, set by `scripts/sdd-run.ts`), never wait: if the task is ambiguous, pick the reading closest to the spec text, say so in the PR body under "Assumptions", and continue; if the task cannot be done as written, stop, write why to `sdd-run/<task>.blocked.md` in the worktree, and exit without a PR.

## While implementing

- Stay inside the task's scope. If something adjacent needs changing, note it under "Follow-ups" instead of doing it.
- If the spec or plan turns out to be wrong or incomplete, stop, explain the conflict, and propose the document change first. Never silently diverge. Headless: write the conflict and the proposed change to `sdd-run/<task>.blocked.md` and exit without a PR; the driver marks the task blocked for the owner.
- Write or update tests for the task's acceptance criteria before marking it done.
- Run narrow tests while iterating: `npx vitest run <file or directory>` and `npx playwright test <spec>` for what the task touches. The full `npm test` runs once, before the last commit (D-199), not after every edit.
- Physics-related code must include a check against the reference values recorded in the spike (R1).
- Commit in small, meaningful steps on the task branch. Headless: this is the only thing that survives the turn cap or the wall clock (PLAN §16.4), so commit each coherent step as you finish it — a converted module, a migrated test file — rather than holding the whole task in the working tree until the end. A red typecheck between steps is fine on the branch; the driver's checks run at the end.

## When done

1. Run the full test suite (`npm test`) and typecheck once; report results.
2. If the task changed the UI, run the `visual-review` skill: captures at 390 px and 1280 px (and 844 × 390 for the live page), both languages when text changed, both themes when colour changed. File them under `docs/screenshots/` and list them in the PR.
3. If the task added or changed user-visible text, both message catalogs (en, es) carry it: `npm run typecheck` is the check (a missing message is a type error, FR-I18N-2), and the Spanish capture shows no English.
4. Check the task off in TASKS.md on this branch only, adding a one-line note if what was done differs from the task text. Merging to `main` is what marks it done for the project. ← CHANGED
5. Append any decisions made to the PLAN.md Decisions section.
6. Interactive only: push the branch (`git push -u origin <branch>`) and open a PR with `gh pr create --title "R<n>: <goal>"` and a body containing the summary below. Do not merge. Headless: **never push and never call `gh`** — `scripts/sdd-run.ts` rebases, pushes, opens the PR and watches CI (PLAN §16.4 step 4), so a confused session cannot publish anything.
7. Summarize: files touched, requirement IDs covered, follow-ups, PR link, and the next task ID. Headless: write that summary to `sdd-run/<id>.summary.md` in the worktree instead — the driver makes it the PR body, under a first line carrying the task's `Gate:` value.
8. Interactive only: suggest the user `/clear` before the next task. Headless: exit; the driver starts the next session empty.
