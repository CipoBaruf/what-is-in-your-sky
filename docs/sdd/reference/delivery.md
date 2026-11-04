## 16. Delivery of the v1 and v1.1 Tasks *(V1-11, V11-9)*

The MVP was built one task at a time, by hand, on one branch after another. v1 is larger and most of it is independent, so the tasks are cut into lanes, run in waves, and driven by a script.
This section is the contract `sdd-breakdown` writes TASKS.md against and `scripts/sdd-run.ts` implements.

### 16.1 Lanes

A lane is a set of directories one task at a time may touch.
Two tasks in different lanes cannot conflict, because no file belongs to two lanes.

| Lane | Owns | Typical tasks |
|---|---|---|
| `ui` | `src/ui/**` except `guide/skychart/**`, `screens/Live*` and `components/live/**`; `src/i18n/**`, `src/lib/{layout,shortcuts,shareLinks,moonPhrases,readiness,flags}.ts`, `src/ui/styles/**`, `.github/workflows/**`, `tests/e2e/v1-captures.spec.ts`, `docs/mockups/**` | language, desktop layout, shortcuts, theme, share button, Moon line, readiness line, banners; *(v1.1)* CI time, the flag, the catalog split, the mockups, the settings page and header, the ui findings, mid widths, the detail's legend block, release |
| `live` | `src/ui/screens/Live*`, `src/ui/components/live/**`, `src/lib/{timeStripe,playback}.ts`; *(v1.1)* `src/lib/declination.ts` | *(D-132)* the live page, the status strip, the time stripe and playback, landscape, wake lock and compass follow; *(v1.1)* the live findings, true north, the stripe rework and stepping, the live page's compact layout and window mode |
| `chart` | `src/ui/components/guide/skychart/**` except `window/`, `src/lib/skyGeometry.ts`, `src/lib/skyBodies.ts`, `spike/dome-composition/**`; *(v1.1, D-196)* `src/lib/{legend,arcReveal}.ts`, `skychart/Legend.tsx`, `skychart/ChartFrame.tsx` | the dome spike, the layered dome, the polar view's v1 markers, the live page's chart wiring; *(v1.1)* the legend, the box and fit rule, the arc states in the dome and polar views, the chart findings |
| `window` *(v1.1, D-196)* | `src/ui/components/guide/skychart/window/**`, `spike/window/**`, `docs/window/**`; *(v2.4, D-740)* `spike/stars/**`, `docs/stars/**` | the sky-window spike and the window view |
| `data` | `src/data/**`, `src/state/**`, `vite.config.ts`, `public/**`; *(v2.4, D-748, D-749)* `scripts/build-stars.ts`, `src/lib/skyStars.ts`, `tests/data/**`; *(v2.5, D-795)* `src/lib/landmark.ts` | offline store, service worker, manifest, favourites, forecast window, prefs |
| `physics` | `src/physics/**`, `src/worker/**`, `src/model/**` | the Moon module, the 72 h night-outer search, `includeHidden` |
| `docs` *(v1.1, D-196; written in here v2.2, §16.18)* | `docs/**` except the per-task captures a `ui` task files, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/**`, `tests/docs/**`, `tests/deploy/**`, `wrangler.jsonc`, `scripts/readme-hero.ts`, `scripts/third-party-notices.ts` | the mockups (R43), public readiness, the documents made true, the address |

Rules the breakdown must respect:

- A task declares exactly one lane and touches only that lane's directories.
  A task that genuinely needs two lanes is two tasks with a dependency, or it is cut differently.
- `src/model/**` is owned by `physics` because every type change starts there.
  A UI task that needs a new field waits for the physics task that adds it — that dependency is what puts them in different waves.
- Shared files that no lane owns (`package.json`, `README.md`, `TASKS.md`, `docs/**`) are touched by every task in small, additive ways: a dependency line, a checkbox, a screenshot directory.
  Those conflicts are trivial and are resolved by rebasing, which the driver does before it opens the PR.
  **This decision log is the exception** — two tasks appending to the end of it write different text at the same numbers, which is a content conflict no rebase can settle and, worse, one that does not conflict at all when the two land far enough apart to renumber silently. §16.2's decision blocks are the answer.

### 16.2 Waves

A **wave** is the set of tasks whose dependencies are all merged to `main`.
It is computed, not written down: the driver reads the checkboxes on `origin/main` and the `Depends on:` fields, and everything unblocked is in the current wave.
`sdd-breakdown` prints the expected waves in TASKS.md as a reading aid, but the driver never trusts that list over the graph.

A lane with an unmerged PR open counts as busy, so a task waiting on review holds its lane until it merges or closes.
Within a wave the driver runs **at most one task per lane** and **at most three tasks at once, concurrently** (D-132).
*(v1.1)* The lanes are five (`ui`, `chart`, `window`, `live`, `data`; `physics` has no task this phase), so a wave usually fills its three slots.
One per lane removes file conflicts; three is what one machine carries — every session builds, runs the unit suite and drives a browser — and keeps the review load legible.
A wave's tasks start together and the run ends when the last of them does; a lane freed early is picked up by the next `--wave`, not by this one.

`live` is the one lane cut from another (D-132).
It shares two places with `ui`, and both are handled by position rather than by ownership: `App.tsx` gets the `#live` route from R32 and the keyboard listener from R35, which depends on R32 and so never runs beside it; the message catalogs (`src/i18n/**`, owned by `ui`) get one `live` section, added by R32 directly after `chart` and extended only by later `live` tasks, so a `ui` task's keys and a `live` task's keys are never adjacent hunks.

**Decision blocks.**
Every task in a wave is given a block of decision numbers before it starts, and records its decisions only inside that block, leaving any it does not use unspent.
Without this, each session reads the same `origin/main`, sees the same last decision, and numbers its first one after it — so a wave of two produces two D-*n*s with different text, and the second to merge either conflicts in this file or, if the hunks sit far enough apart, merges clean and leaves the log with a number that means two things.
The block is written into this log as the last entry before the wave starts, so the reservation is the first thing a session sees at the place it is about to write.

### 16.3 What TASKS.md must carry

Each task keeps its MVP shape (scope, done-when, acceptance criteria) and gains three fields:

```
- [ ] **R17 — The layered dome**
  - **Lane:** chart
  - **Model:** fable
  - **Gate:** owner
  - **Depends on:** R16
```

The checkbox is the shape TASKS.md already uses and the driver reads it as the merged signal (§16.2), so a v1 task is an MVP task with three more sub-bullets — nothing about the file's structure changes.

- **`Lane:`** one of `ui`, `chart`, `data`, `physics`, `live`, `window`, `docs` *(the last since v1.1, D-196)*.
- **`Model:`** `fable`, `opus`, `sonnet` or `haiku` (§16.6); *(v1.1)* `interactive` marks a task the owner drives in a session by hand, which the driver lists and never runs.
- **`Gate:`** `auto` or `owner`.
  `owner` is required whenever the acceptance criteria include captures to compare, Spanish copy to read, or a composition to choose — anything a test cannot check.
  Everything else is `auto`.
- **`Depends on:`** task ids, or `—`.
- **`Precondition:`** *(v1.1, optional)* a file that must exist on `origin/main` before the task may start (a mockup, a findings file); the driver checks it and skips the task, as R23's session would have blocked, so a lane's slot is not burnt on a task that cannot run.
- **`Findings:`** *(v1.1, optional)* the `F-<n>` ids a task closes (D-194), so `--status` can print which findings are still open.
- **`Review:`** *(v2.2, optional, D-659)* the model the review session runs on — `fable`, `opus`, `sonnet` or `haiku` — in place of §16.6's rule by gate.
- **`Turns:`** *(v2.2, optional, D-659)* the implementation session's turn cap; the driver's default is 250, and its 45-minute wall clock, the review's 40 turns and its 15 minutes all scale by `Turns / 250`.
- **`Fallback:`** *(v2.2, optional, D-659)* `on` or `off`: whether a limit-stopped session is retried once on the next model down (§16.4 step 10).
  Written on the task it wins over `--fallback` / `--no-fallback`; absent, the flag decides.

A task with no `Model:` runs on Opus, the stated default of §16.6.

A task with no `Lane:` or no `Gate:` is a breakdown bug and the driver refuses to run it.

### 16.4 `scripts/sdd-run.ts`

```
npm run sdd -- --status          # merged / in review / ready / blocked / failed, from origin/main and the graph; open F-numbers (v1.1)
npm run sdd -- --dry-run         # print exactly what would run, and stop
npm run sdd -- --wave            # run the current wave (≤ 1 per lane, ≤ 3 at once, concurrently)
npm run sdd -- --task R17        # run one task, dependencies checked
npm run sdd -- --task R22 --model opus   # the same, on another model than TASKS.md says (§16.6)
npm run sdd -- --wave --no-fallback      # v1.1: do not retry a limit-stopped session on the next model
```

Per task, in order:

1. `git fetch origin`; refuse if the task's dependencies are not checked off on `origin/main`.
2. `git worktree add ../wiys-tasks/<id> -b <id>-<slug> origin/main` — a fresh worktree from `origin/main`, never from the current checkout. Node modules are installed in it with `npm ci` and `npm_config_cache` pointed at a project-local cache directory, because the user's `~/.npm` is not writable. Worktree creation and removal are queued, since both write the shared `.git`; everything else a task does happens in its own worktree, on its own PR, or on the network, and runs beside the other tasks of the wave (D-132).
3. *(v1.1, D-198)* The driver writes `sdd-run/<id>.brief.md`: the task's entry, the SPEC requirements and stories it names (by ID, extracted verbatim), the PLAN decisions it cites, its lane's §16.1 row, the D-89 commit rule and the allowlist. The session reads the brief instead of the three documents; `rg -n` on an ID is how it reaches anything else.
4. One `claude -p` session in that worktree: `--model <task model>`, `--permission-mode acceptEdits`, `--max-turns 250`, a 45-minute wall clock, and the allowlist below. Its environment carries `SDD_HEADLESS=1`, the npm cache, and `E2E_PORT` — 4173 plus the task's slot in the wave, or `E2E_PORT` from the driver's own environment plus the slot, for a `--task` run started beside a wave — which `playwright.config.ts` and the `visual-review` skill read; under `SDD_HEADLESS` Playwright never adopts a preview server it did not start, since with two worktrees it could be another task's build (D-132). The prompt is one line: use the `sdd-implement` skill on `<id>`, headless — decide and record rather than ask, and commit each coherent step as it is finished (D-89).
   The session and the driver exchange three files in the worktree's `sdd-run/` directory: `<id>.blocked.md` (written instead of a PR when the task cannot be done as written), `<id>.summary.md` (the session's summary, which becomes the PR body), and `<id>.review.json` (`{ "findings": [...] }`, written by the review session in step 6). The directory is scratch and is never committed.
5. On a clean exit the driver checks the branch actually has commits and the task's checkbox is ticked; then it rebases onto `origin/main`, pushes, and opens the PR with `gh`, titled `<id>: <goal>` with `Gate: <gate>` as the body's first line and the session's `<id>.summary.md` under it. **The session never pushes and never calls `gh`** — that is the driver's job, so a confused session cannot publish anything, and `sdd-implement`'s push-and-open-a-PR step is interactive-only for exactly this reason.
6. CI is watched to completion. Red CI ends the task as failed.
7. A second one-shot session (`--max-turns 40`, 15 minutes; Opus for `Gate: auto`, Sonnet for `Gate: owner`, D-197) reads the same brief and runs the `code-review` skill over the branch diff and writes its verdict to `sdd-run/<id>.review.json`. Findings are posted as a PR comment and the task stops there for a human. A session that ends without a verdict counts as findings: nothing merges on a review that did not finish.
8. Green CI, no findings, `Gate: auto` → `gh pr merge --squash`. `Gate: owner` → the PR is labelled `needs-owner`, the captures are linked in the body, and it waits.
9. The worktree is removed after a merge and **kept** after a failure, alongside its log.
10. *(v1.1, D-197; amended after wave 2, 2026-09-05)* The limit signature is the stream's `rate_limit_event` with `status: rejected`, which names the window (`five_hour`, `seven_day`) and `resetsAt`, followed by the synthetic "You've hit your session limit · resets …" result; the sentence alone is matched too. Both windows are the account's and every model shares them, so a model change does not escape them: a session that ends on one ends the task `limit`, with the reset time in the log and the run summary, and **keeps the worktree**. The next `--wave` or `--task <id>` finds a worktree already on the task's branch and resumes it — the new session is told to read the branch's commits and its working tree first — instead of creating a fresh one. `--fallback` (on by default; `--no-fallback`) still retries once on the next model of `fable → opus → sonnet` for a limit that is not account-wide. *(D-835, 2026-10-26)* Before giving up, the driver waits the limit out: when the event gives a reset within six hours, it logs the time, sleeps to two minutes past it and runs the same stage again in the same worktree (an implementation session on the cut-short prompt above), up to three times per stage; `--no-wait` turns this off. Only an unknown reset, a reset further off (a weekly window), or a fourth limit ends the task `limit`. A review session that ends on the limit leaves the PR open with a comment and the task `limit`; a review has to be rerun or done by hand. The log and the run report record every attempt with its model.

Allowed tools in an implementation session: file reads and writes, `Grep`/`Glob`, the project's commands — `npm run *`, `npm test *`, `npm ci *`, `npx vitest *`, `npx playwright *`, `npx tsc *`, `npx eslint *`, `npx tsx *`, `node *` — the shell tools that look at what those produced (`cat`, `ls`, `head`, `tail`, `wc`, `sed`, `awk`, `find`, `echo`, `mkdir`, `cp`, `mv`), and `git add <paths>` / `git commit` / `git status` / `git diff` / `git log` / `git show`.
The list has to cover the commands the tasks are written in or a session ships code it could not run (D-101); breadth is not the fence here, the denied list is.
Denied: `git push`, `git add -A` (this repository has parallel sessions sharing a checkout), `gh`, `rm -rf`, anything that reaches the network other than the package installs the setup step already did, and `prettier` (this repository is not formatted with it).

Logging: `logs/sdd/<id>-<ISO8601>.log` holds the full session transcript and every command the driver ran; `logs/sdd/run-<ISO8601>.json` holds the run summary — per task, the branch, the PR number, the exit reason, the durations and the review verdict.
`logs/` is git-ignored.

### 16.5 Merge policy

| Condition | Result |
|---|---|
| CI green, review clean, `Gate: auto` | squash-merged by the driver |
| CI green, review clean, `Gate: owner` | PR labelled `needs-owner`, left open |
| Review has findings | PR left open with the findings as a comment; the task is not retried automatically |
| CI red, session error, timeout, turn cap, or rebase conflict | task marked failed; branch, worktree and log kept |
| The session wrote `sdd-run/<id>.blocked.md` | task marked blocked; no PR, worktree and log kept for the owner |

The branch left on `origin` is how a later `--status` reads the task back as failed; deleting it is what clears the state, and `--task` refuses to retry until it is gone.
A failed task blocks its dependents — they simply never become ready — and the run continues with everything else.
The driver never merges to `main` outside `gh pr merge`, never force-pushes, and never rewrites a branch it did not create in this run.

### 16.6 Model policy

*(rewritten for v1.1, D-197; the v1 rows are history in D-88 and D-131.)* Four models are available to `claude -p` on this account: `fable`, `opus`, `sonnet`, `haiku`.
The rule is to spend the most capable model where a plausible wrong answer is the expensive kind and the least where the task is fully specified by a test or a table.

| Task kind | Model | Why |
|---|---|---|
| Visual and interactive work the session can verify itself: the sky-window view, the legend and the fit rule inside the three views, the arc states in the views, the stripe rework and the live page's compact layout | `fable` | Acceptance is captures, raster snapshots and a rate the session measures; many short iterations against what it draws. The account's limit is shared with the owner's interactive sessions (D-88), so `--fallback` retries on Opus. |
| The spike (FR-WIN-7) | `interactive` | The owner drives it on a phone (V11-5); the driver never runs it. Fable in that session. |
| Semantics, routing, copy in two languages, and anything that a stranger's device or a test cannot check: the settings page and header, the mid-width rule and `[ list ]`, the detail's legend block, the `ui` and `live` findings, true north, CI time, release | `opus` | D-88's reason stands: a hash, a route guard, an offline sentence, a workflow gate. |
| Mechanical tasks with a complete spec: the flag (D-183), the catalog split (D-199), the `data` findings (F-11..F-13), the `chart` findings (F-1..F-5, F-35), the compact mockup capture script, the 1024 px profile | `sonnet` | Each is a table, a constant or a test written down here; the session executes and checks. |
| Nothing that ships code | `haiku` | Reserved for driver-side summaries if the driver ever needs one. |
| Review of a `Gate: auto` task | `opus` | The review is the only gate between the session and `main`. |
| Review of a `Gate: owner` task | `sonnet` | The owner reads the PR anyway; the review's job is to list what to look at. |

`Model:` in TASKS.md is what a wave runs a task on; `--model` overrides it for one run.
A session that ends on a model limit is retried once on the next model of `fable → opus → sonnet` in the same worktree (`--fallback`, §16.4 step 10); a second limit fails the task as §16.5 says.

*(v2.2, V22-13, D-659)* The table above is an economy, and a phase may decline it. v2.2 does: every task runs on `fable`, every review on `opus` (a second model reading the diff, D-197's reason, kept), the caps doubled and the fallback off — written on each task with the three §16.3 fields rather than remembered as a flag, so a `--wave` started without ceremony still runs the phase as decided.
The rows above stay the default for any phase that does not say otherwise.

### 16.7 What the driver is not

It is not a scheduler, a queue, or a service: it is a script the owner runs, in the foreground, when there is a wave to run.
It has no state of its own — `origin/main`, the branches and the PRs are the state, so a run can be interrupted at any point and started again with nothing to reconcile.
It is written and reviewed before the first wave (D-86), proved by `--dry-run` against the existing R1–R15 entries, and it is not itself a task in TASKS.md.

### 16.8 Tokens and delivery time *(v1.1, D-198, D-199)*

What a v1 task cost, from the logs: a session read SPEC, PLAN and TASKS in full at its start (≈ 40 k tokens, twice with the review), ran the whole unit suite and the whole e2e suite several times, and the `ui` lane ran eleven tasks one after another.
The rules below are what the driver, the skills and the breakdown do differently in v1.1; the driver and skill changes are repo tooling made before the first wave (D-86's precedent), not tasks.

| Rule | Where | Effect |
|---|---|---|
| The brief replaces the three documents in a session's context (D-198). | `scripts/sdd/brief.ts`, `sdd-implement` under `SDD_HEADLESS` | Under 12 k tokens before the first edit; the review session gets the same brief. |
| Narrow test runs while iterating, the full `npm test` once before the last commit (D-199). | `sdd-implement` | Minutes per iteration instead of the whole suite. |
| No PR spec waits on a 72 h search it does not test (FR-CI-3). | `tests/e2e/liveHelpers.ts` `seedStoredRun` | The e2e suite drops under the 10 min PR budget with room. |
| Captures only from `Gate: owner` tasks and only for the changed screens; the capture set runs on `main` (D-195). | `visual-review`, `captures.yml` | No PR pays the 8.5 min capture job. |
| The catalogs are split per lane before the feature wave (D-199). | `src/i18n/en/*.ts`, `es/*.ts` | The one file every v1 lane touched no longer conflicts on rebase. |
| A task is sized to about 25 implementation turns; findings tasks hold at most ten findings (D-199). | `sdd-breakdown` | A limit or a cap costs a small branch, not a wave. |
| Sonnet for mechanical tasks and owner-gated reviews, Fable only where the session verifies its own output (D-197). | `Model:` fields | Roughly a third of the phase's sessions on the cheapest model that can do them. |
| Five lanes and a wave cap of three (D-132, D-196). | the driver | A wave is usually full; the `ui` chain is shorter because the findings, the flag and the mockups are split off it. |
| `Precondition:` is checked by the driver (§16.3). | `scripts/sdd/tasks.ts` | A gated task never burns a lane's slot on a blocked session. |
| *(v2.0, D-453)* The brief's ceiling is 48 000 characters, asserted for every open task. | `scripts/sdd/brief.ts` `BRIEF_BUDGET_CHARS`, `tests/sdd/brief.test.ts` | The number matches what a brief has actually cost since v1.2 (R61 44 509, R64 43 024, R66 42 165); a task over it is a breakdown that cites more than it amends. |
