---
name: sdd-implement
description: Implement one task from TASKS.md following the project's spec-driven workflow. Use when the user says "implement task N", "next task", "continue with TASKS.md", or starts a session to work on the satellite app.
---

# SDD task loop

## Before writing code

1. Read SPEC.md, PLAN.md and TASKS.md. Identify the requested task (or the first unchecked one if the user said "next").
2. Confirm its dependencies are checked off. If not, stop and say which are missing.
3. Confirm the working tree is clean and on `main` (or start from `origin/main` after a fetch; parallel sessions share this checkout, so never `git add -A`). Create a branch `r<n>-<short-slug>` from `main` before the first edit. Never commit to `main`. ← NEW
4. Restate the task in two sentences: what it delivers and which requirement IDs (FR-\*) it satisfies. Wait for confirmation only if the task is ambiguous.

## While implementing

- Stay inside the task's scope. If something adjacent needs changing, note it under "Follow-ups" instead of doing it.
- If the spec or plan turns out to be wrong or incomplete, stop, explain the conflict, and propose the document change first. Never silently diverge.
- Write or update tests for the task's acceptance criteria before marking it done.
- Physics-related code must include a check against the reference values recorded in the spike (R1).
- Commit in small, meaningful steps on the task branch. ← NEW

## When done

1. Run the test suite and typecheck; report results.
2. If the task changed the UI, run the `visual-review` skill: captures at 390 px and 1280 px (and 844 × 390 for the live page), both languages when text changed, both themes when colour changed. File them under `docs/screenshots/` and list them in the PR.
3. If the task added or changed user-visible text, both message catalogs (en, es) carry it: `npm run typecheck` is the check (a missing message is a type error, FR-I18N-2), and the Spanish capture shows no English.
4. Check the task off in TASKS.md on this branch only, adding a one-line note if what was done differs from the task text. Merging to `main` is what marks it done for the project. ← CHANGED
5. Append any decisions made to the PLAN.md Decisions section.
6. Push the branch (`git push -u origin <branch>`) and open a PR with `gh pr create --title "R<n>: <goal>"` and a body containing the summary below. Do not merge. ← NEW
7. Summarize: files touched, requirement IDs covered, follow-ups, PR link, and the next task ID.
8. Suggest the user `/clear` before the next task.
