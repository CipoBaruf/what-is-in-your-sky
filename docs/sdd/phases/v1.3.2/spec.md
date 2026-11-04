# v1.3.2 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 4.24 The repository as a public artefact *(v1.3.2)*

The repository is published for two readers who are not the app's user.
One is an engineer who opens the code and wants to know quickly whether the thing is real and how it is put together.
The other is a hiring manager who will spend a minute on the README and judge how the owner works from what is on that screen.
Neither of them installs the app; both of them are reading a document, and the document is the repository.

Nothing here changes what the app does.
These are requirements about files, and each is checked the way the rest of this spec is checked: by a test that reads the repository, or by a command whose output is stated.
`tests/docs/public.test.ts` is that test.
It stands beside `tests/docs/hygiene.test.ts` and `tests/docs/ci.test.ts`, which already make claims about this repository and check them against it — a claim about a README is not softer than a claim about a `.gitignore`, it is just usually left unchecked.

- **FR-PUB-1** **The first screen.**
  Everything in `README.md` above its first `##` heading answers four questions, in this order: what the app does, in one sentence that names what the reader gets; where the live site is; what it looks like, as the one image of FR-PUB-2; and how it was built, in one paragraph that names spec-driven development, one Claude Code session per task in its own git worktree driven by `scripts/sdd-run.ts`, CI on every pull request, a second session reviewing the diff, and the merge.
  The prologue is at most 25 lines, so it is one screen on a laptop.
  No marketing language, no emoji anywhere in the file, and no badge but the CI workflow's and the deploy's.
  Everything the README carries today — `## Run`, `## Deploy`, the data-source attributions, `## Catalog maintenance` — keeps its heading and moves below that screen.
  *(amended v1.3.3, V13-16)* One exception, and it is a subtraction rather than a move: `## Deploy` keeps only what a reader of the repository can use — that a push to `main` deploys, that every branch gets a preview URL, and that the strict headers are the ones the Playwright suite runs the app under — and links `docs/DEPLOY.md` for the rest.
  The dashboard steps, the worker-rename procedure and the `curl` checks are a runbook for the one person holding the Cloudflare account: nobody else can follow them, and at 45 of 144 lines they were the largest thing in the file.
  *Verification:* `tests/docs/public.test.ts` asserts the prologue is ≤ 25 lines, contains the live URL, contains exactly one image reference, and contains the four words that pin the build paragraph (`SPEC.md`, `worktree`, `CI`, `review`); that the file holds no codepoint in the emoji ranges; that every image whose URL is remote is a badge for a workflow file that exists in `.github/workflows/`; and that the four operational headings still exist below the prologue, that `## Deploy` is at most 20 lines and links `docs/DEPLOY.md`, and that the moved runbook is in that file and not in the README.
- **FR-PUB-2** **The image.**
  One image at `docs/readme/hero.png`, showing the app as it is on a phone, referenced from the prologue with alt text.
  It is composed by `scripts/readme-hero.ts` from captures that are already in `docs/screenshots/` — three of them side by side: a pass list, the dome, the sky screen — so the picture cannot disagree with the build the capture set was shot from, and the app is never run to make it.
  It is not under `docs/screenshots/` and is not named `v1-*`, because `tests/docs/captures.test.ts` owns that directory and that prefix and fails on a file the capture set does not name.
  *Verification:* the test asserts each capture the script names exists, that `docs/readme/hero.png` exists, is non-empty and is 1200 px wide, and that the README's single image reference points at it and carries alt text.
  `npx tsx scripts/readme-hero.ts` regenerates it.
  The owner's check is that it is legible at the width GitHub renders a README image.
- **FR-PUB-3** **The reading order.**
  `docs/HOW-THIS-WAS-BUILT.md`, linked from the prologue, tells a visitor which files to open and in what order to understand the workflow: `SPEC.md`, `PLAN.md`, `TASKS.md`, `scripts/sdd-run.ts`, one example task end to end — its entry in TASKS.md, its pull request, the review session's findings comment on that pull request, and its captures — and the four skills in `.claude/skills/`.
  Every one is a link.
  For each it states plainly what was written by hand and what a session produced, and it says why `docs/` is 53 MB: the capture set is the acceptance evidence the phase's definition of done requires (FR-COMP-6, D-179), not decoration.
  *Verification:* the test asserts every relative link in the file resolves to a path that exists, that all six targets above are linked, and that the example task's pull-request link is an absolute URL to this repository.
- **FR-PUB-4** **Credits.**
  The README's attribution section names every source with the terms it is used under: CelesTrak (free for any use with attribution), Open-Meteo (CC BY 4.0), GeoNames (CC BY 4.0), Mike McCants' `qs.mag` intrinsic magnitudes, Heavens-Above (transcribed by hand, development only, never fetched), and — missing today, in the README and everywhere else — **glyphcss**, <https://glyphcss.com>, MIT, © 2025 Layoutit *(amended v2.2, V22-15: the library, its licence and its copyright holder; the author's name, which v1.3.2 had put here, leaves the README and the test that pinned it)*, with one line on why it was chosen: the app draws the sky into the same monospace cell grid as the rest of the page, so the chart is text and needs no canvas.
  The app's footer (FR-X-2) is checked against each provider's current terms and left exactly as it is unless one of its three credits is wrong: the UI does not change in this phase, and glyphcss's MIT notice is carried by FR-PUB-5 rather than by a fourth footer line *(superseded v2.2, V22-10: FR-X-2 as amended adds that line, with the author's name)*.
  *Verification:* the test asserts the README names all six sources with their licence strings, and that `ATTRIBUTION_URLS` in `src/ui/components/common/Footer.tsx` and the footer messages in both catalogs are unchanged by this task (a diff check in review, not a snapshot).
- **FR-PUB-5** **Third-party notices.**
  `public/third-party-notices.txt`, generated by `scripts/third-party-notices.ts` from the installed tree, carries the name, version, licence identifier and verbatim licence text of every package that reaches the production bundle — `dependencies` and their transitive production dependencies, which is what `npm ls --omit=dev --all` lists.
  Vite copies `public/` into `dist/`, so the notice ships with the code it covers; today the deployed site serves minified MIT and ISC code with the notice stripped, which is the one licence obligation this repository is not meeting.
  `.txt` is not in the service worker's `globPatterns` (`vite.config.ts`), so nothing about the precache changes, and no page links to it from the UI.
  *Verification:* the test asserts every package that `npm ls --omit=dev --all --json` reports appears in the file with a licence body of at least 100 characters, and that the file names no package that is not in that list.
- **FR-PUB-6** **Licence.**
  `LICENSE` at the root: the MIT licence, © 2026 Ezequiel Baruf (the owner's choice, V13-12).
  `package.json` gains `"license": "MIT"` and keeps `"private": true`, which blocks an accidental `npm publish` and says nothing about the terms the source is offered under.
  *Verification:* the test asserts `LICENSE` exists, that its first line is `MIT License`, that it names the year and the owner, that it contains the notice-retention sentence verbatim, and that `package.json`'s `license` field is `MIT`.
  The owner's check after the merge is that `gh repo view --json licenseInfo` reports MIT, since GitHub detects the file on push.
- **FR-PUB-7** **Hygiene.**
  Nothing personal or secret in the tree, or in the history reachable from `main`.
  The audit of 2026-09-08 at `8b5395e` found none of the usual kinds: no `.env`, key, token, credential, `.npmrc` or editor configuration is tracked or has ever been added; no email address appears in any tracked text file; no absolute path carries a user name.
  It found three things that are recorded here rather than fixed, because two of them cannot be fixed without rewriting published history and the third is how git works:
  - **(a)** 19 commits reachable from `main`, across three sessions, carry a `Claude-Session:` trailer holding a session URL — against this project's own rule (`.claude/skills/sdd-spec/SKILL.md`: "No trailers").
    Removing them means rewriting history that is already pushed to a public repository, which is the owner's decision and not this task's.
  - **(b)** `docs/spike-glyphcss/measurements.json` records two `/Volumes/Data/Projects/…` strings, captured as `data-vite-dev-id` DOM attributes during the R14 spike.
    They carry the machine's directory layout and no user name.
    They are dead information inside a dated measurement file, so this task rewrites the two strings to the repo-relative path and says so in the file's own note; the measurements themselves are untouched.
  - **(c)** the owner's personal email address is the author address on this repository's commits, which is how git records authorship and is the same person the `LICENSE` names.
  *Verification:* the test asserts that no tracked path matches the secret shapes (`.env*`, `*.pem`, `*.key`, `.npmrc`, `.vscode/**`, `.idea/**`, `*.iml`), that no tracked text file contains an email address, and that no tracked text file contains an absolute path beginning `/Users/`, `/home/` or `/Volumes/`.
  The trailer count is a stated command with its output rather than a memory: `git log --format=%B origin/main | grep -c '^Claude-Session:'` prints `19` at `8b5395e`.
- **FR-PUB-8** **A clean clone works.**
  From a fresh clone of the public repository, following nothing but the README's own steps, `npm ci`, `npm test`, `npm run build` and `npm run bundle:budget` all succeed.
  Two prerequisites the README does not state today and must: the Node version (24, which `.node-version` and the CI workflow already pin), and `npx playwright install chromium` as a step of its own before `npm test` rather than a comment at the foot of the block — `npm test` boots a real Chromium for the worker project, so without it the suite does not run.
  *Verification:* the run itself, from a clone of the branch into an empty directory, with its output pasted into the pull request.
  It was green at `8b5395e` before this task was written: `npm test` 152 files / 1466 tests / 25.5 s, `npm run build` clean, `npm run bundle:budget` with every chunk inside its budget and no warning.
- **FR-PUB-9** **Signal, not noise.**
  The audit found the tree clean of the things that read as abandonment: no `TODO`, `FIXME` or `XXX` anywhere; no commented-out code; no leftover debug logging (the six `console.warn` calls in `src/data` and `src/state` are injected, documented fallbacks); no unused dependency, runtime or development; one `eslint-disable` and three `@ts-expect-error`, each with a comment.
  What is noise is the branch list: 93 branches on `origin`, one per task plus the spec branches.
  Every branch that is fully merged into `origin/main` is deleted, and no other — a branch that is not merged is how `--status` reads a failed task back (PLAN §16.5) and it stays.
  The list is printed in the pull request and the deletion runs on the owner's word, because it is the one irreversible thing in this task.
  *Verification:* `git branch -r --merged origin/main` is printed before and after; the test asserts nothing else, since a branch list is not a file.
- **FR-PUB-10** **Contribution stance.**
  `CONTRIBUTING.md`, linked from the prologue, says whether issues and pull requests are accepted and what the process is: a change here starts as a task — a SPEC and PLAN change first if it changes what the product does, then an entry in TASKS.md, then a branch — and not as a bare pull request against `main`, which has no requirement to trace to and no acceptance criteria to meet.
  *Verification:* the test asserts the file exists, that the README links it, and that it names `SPEC.md`, `PLAN.md` and `TASKS.md`.
- **FR-PUB-11** **Repository metadata.**
  The description, the topics and the social preview image are set in the GitHub UI and cannot be set from the tree, so this task's job is to have the exact text ready to paste and the image ready to upload.
  `docs/RELEASE.md` gains a section carrying four things: the one-line repository description, at most 12 topics, the homepage URL (the live site), and the path of a 1280 × 640 social preview image, produced by `scripts/readme-hero.ts` from the same captures as the hero so the two never disagree.
  At the audit all four were empty on GitHub — the repository is already public with no description, no topics, no homepage and no detected licence.
  *Verification:* the test asserts the section exists with those four items and that the preview image exists at exactly 1280 × 640.
  The owner's check, after setting them, is `gh repo view --json description,repositoryTopics,homepageUrl,licenseInfo`.
- **FR-PUB-12** *(v1.3.3)* **No commit written from here on carries an agent trailer.**
  This project's rule is that commit messages carry no trailers (`.claude/skills/sdd-spec/SKILL.md`), and FR-PUB-7 (a) reports 19 commits reachable from `main` that carry a `Claude-Session:` one anyway.
  Those 19 stay the owner's decision, because removing them rewrites published history.
  This requirement is about the next one: no commit *after* the recorded baseline — `d7514ec`, the merge that added §4.24, the first commit written after the audit — carries `Claude-Session:`, a `Co-Authored-By:` naming Claude or Anthropic, or a "Generated with Claude" line.
  The rule is about those signatures and not about trailers in general: `Signed-off-by`, `Refs` and a human co-author are untouched.
  *Verification:* `scripts/check-trailers.ts` walks `<baseline>..HEAD` and exits non-zero naming each offending commit; `ci.yml`'s `trailers` job runs it on a full-history checkout, since the main job's depth-1 clone cannot see the range.
  `tests/docs/trailers.test.ts` pins the shape of the rule — the three forbidden forms, the four that are not, the line anchoring so that prose quoting a trailer is not a violation, and that the baseline is reachable.
- **FR-PUB-13** *(v1.3.3)* **A branch is deletable when its pull request is merged, and deletion is a separate word.**
  FR-PUB-9 leaves the branch list to the owner; this says what the list *is* and gives it a tool.
  `scripts/prune-merged-branches.ts` prints, for every branch on `origin`, whether a merged pull request has it as its head, and deletes only the ones that do, only with `--delete`, and never `main`.
  A branch with an open pull request, or with none at all, is left alone — the second is someone's work in progress, not a leftover.
  The merge test is GitHub's record and not `git branch -r --merged`: every pull request here is squash-merged (PLAN §16.4), and a squash writes a new commit with no link to the branch, so the branch tip is never an ancestor of `main`.
  Measured on 2026-09-08: reachability called 20 branches merged and 74 not, against 103 merged pull requests and 94 branches, every one of which belongs to a merged pull request.
  *Verification:* `tests/docs/trailers.test.ts` checks the deletable rule over written-out branch, merged-head and open-head lists, and asserts the script does not reach for `--merged`.

### Phase 2e — v1.3.2 ("public readiness", as decided 2026-09-08, V13-11)

After the `v1.3.0` tag.
No product change: not one line of `src/` runs differently, no requirement of the app is amended, and no test is changed to pass.
The phase is one task, `P1`, and its subject is the repository rather than the app (§4.24).

- The README's first screen answers what the app does, where it is live, what it looks like on a phone, and how it was built; the operational content it carries today moves below that and keeps its text.
- A reading order for the process (`docs/HOW-THIS-WAS-BUILT.md`), a contribution stance (`CONTRIBUTING.md`), the missing glyphcss credit, a `LICENSE` (MIT), and the third-party notices the deployed bundle does not carry today.
- The hygiene, clean-clone, dead-signal and metadata audits, each recorded with the command that produced it.

Definition of done:
- FR-PUB-1..FR-PUB-11 met, with `tests/docs/public.test.ts` green and the clean-clone run pasted into the pull request.
- The three §4.24 findings the task does not fix — the `Claude-Session:` trailers, the author email in the history, the merged branch list — are decided by the owner rather than left unmentioned.
- No file under `src/` is changed, and the capture set and the bundle budgets are untouched: `npm test`, lint, typecheck and the pull request's e2e path green inside FR-CI-1's ten minutes.
- No version bump and no tag.
  This phase ships no product, so `package.json` stays at 1.3.0 and the deployed site is the `v1.3.0` build.
  The repository description, topics and social preview are set by the owner in the GitHub UI.
