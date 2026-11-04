# v1.3.2 — TASKS.md sections

Cut from `TASKS.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

## Public-readiness task

- [x] **P1 — Public-readiness**
  - **Lane:** ui
  - **Model:** opus
  - **Gate:** owner
  - **Depends on:** R65
  - **Lane note:** the lane is `ui` because a task must declare one and that lane already owns the repository's own furniture; what P1 actually touches is `scripts/`, `tests/docs/`, `public/`, `docs/**` and the shared root files, which no lane owns (PLAN D-374). Nothing under `src/`.
  - **Goal:** The repository reads, to an engineer who opens it and to a hiring manager who gives it a minute, as the thing it is: a working app with a live URL, a picture, a licence, its sources credited, and a process a visitor can follow from the first screen. Nothing about the app changes.
  - **Satisfies:** FR-PUB-1..FR-PUB-11 (spec §4.24) and the Phase 2e definition of done (spec §9).
  - **Why not a slice:** It delivers nothing a user of the app can see. The exception is the point: the reader it serves is not the app's user, and §4.24 says so in its first line.
  - **Scope (spec §4.24, PLAN §2.22):**
    - **The first screen (FR-PUB-1, FR-PUB-2).** `README.md` is re-cut so everything above the first `##` is: the title; one sentence on what the app does; the live URL; `docs/readme/hero.png`; one paragraph on how it was built — spec-driven, one Claude Code session per task in its own git worktree driven by `scripts/sdd-run.ts`, CI on every pull request, a second session reviewing the diff, then the merge — and the three links out (`docs/HOW-THIS-WAS-BUILT.md`, `CONTRIBUTING.md`, `LICENSE`). At most 25 lines. `## Run`, `## Deploy`, the attributions and `## Catalog maintenance` keep their content and move below, `## Run` gaining the two missing prerequisites of FR-PUB-8. No emoji, no marketing, one badge: the CI workflow's.
    - **The hero (FR-PUB-2, D-370).** `scripts/readme-hero.ts` composes three existing captures side by side with Playwright and writes `docs/readme/hero.png` (1200 px wide) and `docs/readme/social-preview.png` (1280 × 640). The three are named in one exported constant. The app is never run; `docs/screenshots/` is read, never written.
    - **The reading order (FR-PUB-3).** `docs/HOW-THIS-WAS-BUILT.md`: `SPEC.md` → `PLAN.md` → `TASKS.md` → `scripts/sdd-run.ts` → one example task end to end (its TASKS.md entry, its pull request, the review session's findings comment on it, its captures) → the four skills in `.claude/skills/`. Every one a link, each with one line on what was written by hand and what a session produced, and one line on why `docs/` is 53 MB.
    - **Credits and notices (FR-PUB-4, FR-PUB-5).** The README's attribution section gains glyphcss — Juan Cruz Fortunatti, <https://glyphcss.com>, MIT, © 2025 Layoutit — with one line on why it was chosen, and the existing five entries are checked against their providers' current terms. `scripts/third-party-notices.ts` generates `public/third-party-notices.txt` from `npm ls --omit=dev --all`. The app's footer is read and left alone.
    - **Licence (FR-PUB-6).** `LICENSE` — MIT, © 2026 Ezequiel Baruf — and `"license": "MIT"` in `package.json`, which keeps `"private": true`.
    - **Contribution stance (FR-PUB-10).** `CONTRIBUTING.md`: issues and pull requests, and that a change starts as a task, not as a bare pull request against `main`.
    - **Hygiene (FR-PUB-7, D-373).** The two `/Volumes/Data/Projects/…` strings in `docs/spike-glyphcss/measurements.json` become `spike/spike.css`, with a note at the head of that directory's `FINDINGS.md`. Nothing else is touched, and no history is rewritten.
    - **Metadata (FR-PUB-11).** `docs/RELEASE.md` gains a section with the description, up to 12 topics, the homepage URL and the preview image path, ready for the owner to paste.
    - **The test (FR-PUB-1..11, D-368).** `tests/docs/public.test.ts` asserts every claim above that a test can reach.
  - **Touches outside the lane:** `scripts/`, `tests/docs/`, `public/`, `package.json` (the `license` field only), `docs/**`, `README.md`, `SPEC.md` §4.20 (findings only), `TASKS.md`. **Nothing under `src/`.**
  - **Out of scope, by the owner's instruction:** refactors; new features; changing any test to make it pass; anything under R5 and later; rewriting git history; deleting a branch that is not fully merged.
  - **Done when:**
    - `npx vitest run tests/docs/public.test.ts` passes, and it asserts: the prologue is ≤ 25 lines and holds the live URL, exactly one image and the four build words; no emoji codepoint in `README.md`; every remote image is a badge for a workflow file that exists; the four operational headings survive; the hero and preview exist at 1200 px wide and 1280 × 640 and their source captures exist; every relative link in `docs/HOW-THIS-WAS-BUILT.md` resolves and all six targets are linked; the README names all six sources with their licence strings; every package in `npm ls --omit=dev --all` is in `public/third-party-notices.txt` with a body ≥ 100 characters and nothing else is; `LICENSE` is MIT and `package.json` agrees; no tracked path matches the secret shapes and no tracked text file holds an email address or a `/Users/`, `/home/` or `/Volumes/` path; `CONTRIBUTING.md` exists, is linked and names the three documents; `docs/RELEASE.md` carries the four metadata items.
    - **The clean clone, run and pasted into the pull request (FR-PUB-8):** clone the branch into an empty directory and run, with nothing but what `## Run` says, `npm ci` → `npx playwright install chromium` → `npm test` → `npm run build` → `npm run bundle:budget`. All five succeed and the output goes in the PR body. *(At `8b5395e`, before this task: `npm test` 152 files / 1466 tests / 25.5 s; `npm run build` clean; `npm run bundle:budget` every chunk inside budget, no warning.)*
    - **The trailer count is stated, not remembered:** `git log --format=%B origin/main | grep -c '^Claude-Session:'` is run and its number reported in the PR beside the three §4.24 findings the task does not fix. The owner decides on each.
    - **The branch list is printed before anything is deleted:** `git branch -r --merged origin/main` in the PR body. The merged branches are deleted only after the owner says so, and unmerged branches are never touched (PLAN §16.5).
    - `npm test`, `npm run lint`, `npm run typecheck` and the PR's e2e path green inside FR-CI-1's 10 min. `git diff --stat origin/main -- src/` is empty.
    - The capture set is untouched: `tests/docs/captures.test.ts` passes with no file added to or removed from `docs/screenshots/`.
    - The owner's gate: the first screen read cold, the hero legible at GitHub's width, the branch list approved, and the description, topics and social preview set in the GitHub UI.
  - **Done 2026-09-08:** as specified, with four readings recorded in the PR rather than as decisions, since D-368..D-375 already settle the shape. The prologue is 21 lines and carries the hero alone, so the CI badge opens `## Run` instead of sitting under the title: FR-PUB-1 asks for exactly one image reference above the first `##`, and a badge is an image reference. The hero is the home screen cropped to a phone's height, the guide's dome, and the sky screen — the last of these landscape, because the only portrait sky-screen capture in the set is the "turn the phone sideways" prompt; the tile keeps its own aspect and is centred against the two phones. `scripts/third-party-notices.ts` falls back to a package's `@preserve` header when it publishes no licence file, which is how `astronomy-engine` ships its MIT text. The two content scans in `public.test.ts` skip `package-lock.json` and `public/third-party-notices.txt`, which are verbatim third-party metadata — the notices file is a licence obligation whose point is that the text is unaltered, and both carry addresses their authors published; and the absolute-path shape requires three segments below the root, so SPEC §4.24, PLAN D-373 and this entry can go on quoting the finding they record. Measured: 153 test files / 1510 tests / 23.4 s, every chunk inside its budget, `dist/third-party-notices.txt` present. Not done by the session: the clean-clone run of FR-PUB-8, because `git clone` and creating a directory outside the worktree are both outside this session's tool allowlist — CI's own `npm ci` on a fresh checkout covers four of the five commands, and the fifth (`npx playwright install chromium` as its own README step) is stated in the PR for the owner to run.

- [x] **P2 — The owner's three, guarded**
  - **Lane:** ui
  - **Model:** opus
  - **Gate:** owner
  - **Depends on:** P1
  - **Done 2026-09-08:** as specified, plus the deploy split the owner asked for mid-task (V13-16, D-378). Found on the way and fixed in the writing: `git branch -r --merged origin/main` is meaningless in a squash-merging repository — it called 20 branches merged where GitHub has 103 merged pull requests — so FR-PUB-13's rule is GitHub's record (D-377). Measured after the change: 94 of 94 branches on `origin` belong to a merged pull request.
  - **Goal:** The two P1 findings that are not judgement calls stop needing one: the trailer count cannot grow, and the branch list is produced by a script instead of by hand. The three decisions themselves stay the owner's.
  - **Satisfies:** FR-PUB-12, FR-PUB-13 (spec §4.24).
  - **Why not a slice:** Same reason as P1: the reader it serves is not the app's user.
  - **Scope (spec §4.24, PLAN §2.22, §16.13):**
    - `scripts/check-trailers.ts`: walks `BASELINE..HEAD` (`d7514ec`) and exits non-zero naming each commit carrying `Claude-Session:`, a Claude/Anthropic `Co-Authored-By:`, or a "Generated with Claude" line; exits 2 rather than 0 when the baseline is not in the clone. `offenders()` is pure and exported.
    - `.github/workflows/ci.yml`: a `trailers` job at `fetch-depth: 0`, parallel to `ci`, spending none of FR-CI-1's budget.
    - `scripts/prune-merged-branches.ts`: lists every branch on `origin` against GitHub's merged and open pull-request heads, deletes only merged ones, only with `--delete`, never `main`, in batches of twenty. `deletable()` is pure and exported.
    - `tests/docs/trailers.test.ts`: the shape of both rules, without a repository in a known state.
    - *(added mid-task, V13-16, D-378)* The deploy runbook leaves the README for `docs/DEPLOY.md`: the README keeps one paragraph on what the deployment is — `main` deploys, every branch gets a preview URL, the strict headers are the ones the Playwright suite runs the app under — and links the rest. FR-PUB-1 amended with it.
    - The three findings themselves are **not** acted on: no history rewritten, no branch deleted, no repository setting changed.
  - **Touches outside the lane:** `scripts/`, `tests/docs/`, `.github/workflows/`, `SPEC.md`, `PLAN.md`, `TASKS.md`. **Nothing under `src/`.**
  - **Done when:**
    - `npx tsx scripts/check-trailers.ts` prints `13 commits since d7514ec, none carrying an agent trailer` and exits 0; run against a range that contains one (`8b5395e~30`) it names `54253af6e` and exits 1.
    - `npx tsx scripts/prune-merged-branches.ts` prints the two lists and deletes nothing without `--delete`.
    - `npx vitest run tests/docs/trailers.test.ts` passes, including that the prune script does not reach for `--merged`.
    - `npm test`, lint, typecheck green; `git diff --stat origin/main -- src/` empty; the capture set untouched.
    - `## Deploy` is at most 20 lines and links `docs/DEPLOY.md`; the four strings that identify the runbook are in that file and in neither the README nor anywhere else.
    - The owner's gate: the branch deletion, the trailer rewrite and the repository metadata, all three still theirs.
