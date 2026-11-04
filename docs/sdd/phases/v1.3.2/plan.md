# v1.3.2 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.22 v1.3.2 decisions (2026-09-08)

These plan SPEC v1.3.2 (V13-11..V13-14). v1.3.1 spent D-350..D-367 (§16.11's block for R66 included); v1.3.2 starts at **D-368**, and §16.12 reserves P1's block from there.

- **D-368 — The claims about the repository are a unit test, not a checklist.**
  (FR-PUB-1..11; V13-11.) `tests/docs/public.test.ts` joins `hygiene.test.ts` and `ci.test.ts` in `tests/docs/`: it reads `README.md`, `LICENSE`, `CONTRIBUTING.md`, `docs/HOW-THIS-WAS-BUILT.md`, `docs/RELEASE.md`, `package.json`, `public/third-party-notices.txt` and `git ls-files`, and asserts what §4.24 states about each.
  It runs in the `node` project, so `npm test` on any branch catches a README that lost its live URL or a `LICENSE` that stopped matching `package.json` — the failure mode these files actually have is silent drift, months later, and a checklist in `RELEASE.md` is read once.
  What it cannot assert — is the prologue *good*, is the hero legible — is the owner's gate, and is named as such in the task rather than approximated by a test.
- **D-369 — The prologue is delimited by the first `##`, and that is what the test measures.**
  (FR-PUB-1.) The test needs a definition of "the first screen" it can compute: everything from the title to the first `##` heading.
  Twenty-five lines is the budget — the title, one sentence, the live line, the image, the build paragraph and the three links, with room to breathe — and it is a maximum, not a target.
  The emoji check is a codepoint scan over the whole file (the ranges `U+1F300..U+1FAFF`, `U+2600..U+27BF`, `U+FE0F`), not a blocklist, and the badge check allows exactly one shape: `https://github.com/<owner>/<repo>/actions/workflows/<file>/badge.svg`, with `<file>` required to exist in `.github/workflows/`.
  A deploy badge has no such shape — Cloudflare Workers Builds publishes none — so the deploy is a link, not a badge, and the test allows no second badge host.
- **D-370 — `scripts/readme-hero.ts` composes, and never runs the app.**
  (FR-PUB-2, FR-PUB-11; V13-13.) The script writes one HTML page with three `<img>` tags pointing at files already in `docs/screenshots/`, opens it with Playwright's Chromium — the dependency the mockup script already uses (`scripts/mockup-capture.ts`), so nothing is installed — and screenshots it twice: `docs/readme/hero.png` at 1200 px wide, and `docs/readme/social-preview.png` at exactly 1280 × 640.
  Both are deterministic given the inputs, and the inputs are named in one exported constant the test reads, so a capture renamed by a later phase fails the test instead of leaving a broken image in the README.
  `docs/readme/` is a new directory; `captures.test.ts` scans `docs/screenshots/` only and is untouched.
- **D-371 — The notices file is generated from `npm ls --omit=dev --all`, and checked against it.**
  (FR-PUB-5; V13-12.) `scripts/third-party-notices.ts` reads the production dependency tree as JSON, walks `node_modules/<name>/` for each entry, takes `license` from its `package.json` and the body from the first of `LICENSE`, `LICENSE.md`, `LICENCE`, `LICENSE.txt`, and writes `public/third-party-notices.txt` sorted by name with a stable header.
  A package with no licence file and no `license` field fails the script rather than being skipped silently — that is the case that would quietly drop an obligation.
  The test regenerates nothing (a build step in a unit test is a slow test); it asserts that every name in the tree appears in the committed file with a body of at least 100 characters, and that no name in the file is absent from the tree.
  `.txt` is outside `globPatterns` in `vite.config.ts`, so the precache manifest does not change.
- **D-372 — The hygiene assertions are shapes over `git ls-files`, and the history is only ever reported.**
  (FR-PUB-7; V13-14.) The test walks the tracked tree — the same `git ls-files -z` `hygiene.test.ts` already uses — and asserts three things over the text files in it: no path matching the secret shapes, no RFC-5322-shaped email address, and no absolute path beginning `/Users/`, `/home/` or `/Volumes/`.
  Binary files are skipped by extension.
  Nothing in the test touches `git log`: a test that fails on history is a test that can only be made green by a rewrite, which is exactly the decision the owner reserved.
  The trailer count is a command in the task's done-when list with its output stated, so the number is checked when a human runs it and is not pretended to be a gate.
- **D-373 — The two `/Volumes/` strings in the R14 measurements are rewritten, and the measurements are not.**
  (FR-PUB-7 (b).) `docs/spike-glyphcss/measurements.json` holds two captured `data-vite-dev-id` attribute values carrying the absolute path of the spike's stylesheet.
  They are DOM noise inside a dated evidence file: the two strings become `spike/spike.css`, a note is added at the head of `docs/spike-glyphcss/FINDINGS.md` saying so and why, and no measured number is touched.
  This is what makes D-372's third assertion green without an exemption, and an exemption is the wrong shape here — the next absolute path to arrive would inherit it.
- **D-374 — P1 is a `ui` task that also touches what no lane owns.**
  (§16.12; V13-11.) The lane table (§16.1) puts `README.md`, `TASKS.md` and `docs/**` in the shared set every task touches additively, and `scripts/` and `tests/docs/` belong to no lane at all.
  P1 touches only those, plus `package.json` (one field) and `public/` (one generated file) — it changes nothing under `src/`, which is what every lane is drawn around.
  It is declared `ui` because that lane already owns the repository's own furniture (`.github/workflows/**`, the mockups) and because a task must declare one; it runs alone, so the declaration costs nothing.
- **D-375 — `Gate: owner`.**
  (§16.5.) Four of the acceptance items are judgement a test cannot reach: whether the first screen reads well to someone with no context, whether the hero is legible at GitHub's width, which of the 93 remote branches may be deleted, and what the repository's description and topics should say.
  The gate is what stops the driver merging a README nobody read.

### 16.12 Delivery of the v1.3.2 task *(V13-11, D-374, D-375)*

The V1-11 rules are unchanged.
One task, alone in flight, on `main` after the `v1.3.0` tag.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | P1 — public readiness | `ui` (with `scripts/`, `tests/docs/` and `public/`, which no lane owns — D-374) | opus | owner (the first screen, the hero, the branch list, the metadata — D-375) | R65 |

P1 is the first task whose id is not `R<n>`: it delivers no requirement of the product and belongs to no release, so numbering it into the release sequence would put a README beside the physics spike in the same list.
`P` is for the repository's own readiness; a second one, if it ever comes, is `P2`.

**Decision block** (§16.2): **P1 takes D-368 to D-377**, of which D-368..D-375 are spent above; D-376 and D-377 are left for the session.

What the session is told to read (D-284's rule): SPEC §4.24 (FR-PUB-1..11), §9 Phase 2e, §12 V13-11..V13-14, §6.5's glyphcss row; PLAN §2.22, §16.1's lane table and this section; and, for the reading order it has to write, PLAN §16.2..§16.6 in full — that section *is* the process the document describes, so it is the one place the session reads more rather than less.

### 16.13 Delivery of the v1.3.3 task *(V13-15, D-376, D-377)*

The V1-11 rules are unchanged.
One task, alone in flight, on `main` after P1.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | P2 — the owner's three, guarded | `ui` (with `scripts/`, `tests/docs/` and `.github/workflows/`) | opus | owner (the deletion, and the two decisions the task does not take) | P1 |

P2 spends the two decisions P1 was given and left unused (D-376, D-377), so the phase's block D-368..D-377 closes exactly full.
**D-378 is P2's own**, taken after the owner's question about the README's deploy section reopened FR-PUB-1 mid-task; extending a block rather than opening a wave is safe here for the reason §16.2 gives the rule — P2 is the only task in flight, so there is no second session reading the same last decision number.
It touches no lane's directories and nothing under `src/`, as P1 did not.
