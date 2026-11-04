# v2.2 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.10 Goals (v2.2, "the showcase")

- **G34. The repository says what is true.**
  A reader who opens any document from the README finds counts, names, paths and versions that match the commit they are reading, and the process it describes is the one that produced the commit.
- **G35. The tree is what a reader needs and nothing else.**
  The paperwork the process runs on is public because it is the evidence; what is local to one machine or one conversation is not in the tree; no line of code is there because nobody deleted it.
- **G36. What a post shows is the build.**
  A video or a picture of the app on a phone or a desk is produced from the repository by one command, from the same fixtures the capture set is shot from, so it can be re-made when the app changes and cannot show a state the app does not have.

**US-36 — Read the repository from a post** *(v2.2)*
As a developer or a recruiter who arrives from a LinkedIn post, I open the repository, read the README and the reading order, and what they say matches what I find when I open the files they name.
- AC1: Every path, npm script, skill and version the README, `CONTRIBUTING.md`, `CLAUDE.md` and `docs/HOW-THIS-WAS-BUILT.md` name exists as named (FR-SHOW-1).
- AC2: Every count or size those documents state is the number at the commit, or is stated with the command that produces it and the commit it was measured at (FR-SHOW-1, FR-SHOW-2).
- AC3: The `.claude/` directory is in the tree with a line in the reading order saying why, and no file under it, under `scripts/sdd/` or anywhere else names a path on the owner's machine or a conversation of theirs (FR-SHOW-3).
- AC4: `npx knip` on the commit reports nothing, and the app I open is the one the tag before the phase deployed: the same screens, the same captures, no chunk larger (FR-SHOW-4, FR-SHOW-5).
- AC5: The videos and pictures the post carries were produced by `npm run promo:record` and show the deterministic fixtures, not a live sky (FR-SHOW-6).
- AC6: The app's footer names glyphcss with its link, in both languages, and neither the app nor the README names the library's author (FR-SHOW-8, FR-X-2 and FR-PUB-4 as amended).
- AC7: The address in every post and every document is `https://inyoursky.app`, and it serves the app with the same headers as before (FR-ADDR-1, FR-ADDR-2).
- AC8 *(v2.2.1)*: The pictures a post carries and the release captures the reading order points at show a named place, local clock times and cloud badges that read a forecast: no screen in them reads "Weather unknown", "no cloud forecast stored yet", a `UTC` clock or FR-SAT-4's staleness warning (FR-SHOW-9, FR-SHOW-10).

### 4.43 The repository as a showcase *(v2.2)*

§4.24 put the repository in front of an engineer and a hiring manager who happened to open it.
From 2026-09-28 it is sent to them: a series of posts about how the app was built, whose readers are recruiters and developers who will open the tree to see whether the process the post describes is the one in front of them. §4.24's requirements still hold and are not restated.
What has changed since they were written is the tree — 60 more tasks, three more phases, 756 captures where there were 326 — and the documents that describe it were written at the size it had then.
The audit of 2026-09-25 at `d7a5d27` read every reader-facing document against the tree and found about fifty-five claims that are no longer true; the ones a reader would notice are named below, each requirement carrying its own.

Nothing here changes what the app does.
Each requirement is checked the way §4.24's are: by a test that reads the repository, or by a command whose output is stated.

- **FR-SHOW-1** **The documents say what is true at the commit.**
  In `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/HOW-THIS-WAS-BUILT.md`, `docs/DEPLOY.md`, `docs/RELEASE.md`, `docs/mockups/README.md`, `tests/fixtures/heavens-above/README.md` and the four `.claude/skills/*/SKILL.md`: every path, npm script, skill name and version exists as named; every count or size is the number at the commit or is stated beside the command that produces it and the commit it was read at (FR-PUB-7's shape); nothing is described as pending, future or "follows in R<n>" when it is merged.
  Found and to be corrected: the README's "a 2 h cache follows in R11" and "from R8 and R9" (all three merged the week they were written); `readme-hero.ts` described as making "the two pictures above" where the README shows one; `docs/HOW-THIS-WAS-BUILT.md`'s "1053 lines", "1846 lines", "1459 lines", "`D-1` … `D-375`", "53 MB", "35 MB … 326 PNGs", "two spike reports" and R28's "five items" (1775, 2362, 2565, D-646, about 101 MB, 82 MB and 756 files of which 254 are the `v1-*` release set, three spike folders, four items); `docs/RELEASE.md`'s "§12 is v2.0's" and its budget table (main is 170, live 15, and `settings` is missing); `docs/DEPLOY.md`'s "three lines"; `docs/mockups/README.md`'s "960 px breakpoint" (964) and a compact mockup still "waiting for the owner's approval" on a task merged three phases ago; the Heavens-Above README's `*.extras.json` that no file matches and "pending R3's provenance work"; `sdd-implement`'s "`← NEW`" and "`← CHANGED`" edit markers and its "on `main` … parallel sessions share this checkout" (the driver gives each session a worktree); `sdd-breakdown`'s `T<n>` ids and its lane and model lists (missing `live`, `window`, `sonnet`, `interactive`); `visual-review`'s "Pixel 5" (390 × 844 is the iPhone 15 Pro profile) and "not tests" (the `v1-*` set is enforced by `captures.test.ts`); `CLAUDE.md`'s "Read all three documents" (a headless session reads its brief, D-198) and "no backend in MVP".
  `SPEC.md` §1 and §5 are the two places this spec describes itself as a proposal: §5's "Status: proposal … to be validated in the plan phase" header and its §5.1 table ("Tailwind (or CSS modules)", "or suncalc", `tz-lookup`) get a dated *as built* note naming the real stack in one line and pointing at PLAN §11.1; §1 gains the live page, the sky screen, offline and the two languages in one sentence; nothing else in this document is touched by the task, and the Decision Log never (V22-7).
  PLAN §4's tree is redrawn from `git ls-files` (it lists `IssHeroCard.tsx`, `slices/live.ts` and `spike/horizon-panorama/`, none of which exist, and omits `tests/docs/`, `scripts/readme-hero.ts` and twenty other files).
  *Verification:* `tests/docs/accuracy.test.ts` (PLAN D-650) asserts the paths, scripts, skills and versions; that `docs/HOW-THIS-WAS-BUILT.md`'s *By the numbers* table has a command column and names the commit it was read at; and that none of the strings this audit found stale (`53 MB`, `326 PNGs`, `1053 lines`, `1846 lines`, `1459 lines`, `D-375`, `← NEW`, `Pixel 5`, `T<n>`) appears in the files listed above.
  The words "53 MB" leave `public.test.ts` with the number.
  The prose corrections are read at the owner's gate.
- **FR-SHOW-2** **The reading order is honest about what the driver did.**
  `docs/HOW-THIS-WAS-BUILT.md` and the README's build paragraph say that R1–R15 and H — the MVP — were built by hand in Claude Code sessions on one branch after another before `scripts/sdd-run.ts` existed (first committed 2026-09-03, `6b79db1`), that the driver ran every task from R16 on except R38 (`Model: interactive`), and that the `Done` notes in `TASKS.md` are written by the sessions, so "never edited by hand except to check a task off" is true of hands and not of sessions (`CONTRIBUTING.md` says the same).
  The document is carried to v2.1: §16 has seventeen delivery sections, the example task keeps R28, and a *By the numbers* section states, with the command and the commit, the tasks merged, the pull requests, the test files and tests, the decisions and the findings — the figures a post will quote, so a post and the tree quote one source.
  *Verification:* the accuracy test's count rule; the sentence about R1–R15 is pinned by the words `by hand` and `R16` in the file.
- **FR-SHOW-3** **The public half and the local half are named.**
  The process paperwork is public on purpose and says so: `.claude/settings.json` (one allow rule, `gh pr merge`, for the driver's merge step), the four skills, `CLAUDE.md` and `scripts/sdd/` get a short section in `docs/HOW-THIS-WAS-BUILT.md`, *What is deliberately public*, with one sentence on what is not tracked and why — `sdd-run/` (the briefs and summaries), `logs/`, `.sdd-cache/`, `handoff/` and `redesign/` (the design phase's artboards, V20-11) and `promo/` (FR-SHOW-6).
  No tracked file names a path on the owner's machine or a session URL: FR-PUB-7's scans already say so and keep saying so; `.gitignore` gains `/promo` (written by `P6`, the phase's first task, so no two tasks of a wave touch the file).
  *Verification:* `hygiene.test.ts` asserts the `/promo` line and that no file under those six directories is tracked; `public.test.ts`'s scans are re-run over `.claude/**` by name.
- **FR-SHOW-4** **No export nothing imports.**
  The audit ran `npx knip` (5.x, no configuration) at `d7a5d27`: 0 unused dependencies, 0 unused development dependencies, 83 unused exports, 39 unused exported types and 4 duplicate exports across `src/`, `scripts/` and `tests/`, and 20 unused files, all under `spike/`.
  The rule (PLAN D-648): an export nothing outside its file imports loses the keyword if the file reads it and is deleted if nothing does, with any test that existed only to import it; a duplicate export keeps the name a requirement uses; the barrels export what is imported.
  `spike/**` is out of scope and configured out of knip's report: its pages are HTML entry points knip does not follow, and §4.24's reading order and three findings files cite it.
  `docs/**` is captures and data.
  After the task `npx knip` reports nothing, `npm run check:dead` is that command, and CI's `dead-code` job runs it on every pull request beside `trailers`, outside FR-CI-1's ten minutes.
  `knip` is a development dependency the owner installs on `main` first, with an empty `knip.json` beside it as the file the driver's precondition can see (V22-4, D-622's precedent).
  *Verification:* the CI job; the report before and after in the pull request.
- **FR-SHOW-5** **The app is unchanged, measured.**
  `npm run bundle:budget`'s table on the 2.1.0 build and on the phase's last commit, in the pull request: no row larger.
  `passes.golden.test.ts` and every golden fixture untouched; `tests/docs/captures.test.ts` green with no file added to or removed from `docs/screenshots/`; `npm run e2e` green; the deploy test and the CSP unchanged.
  One exception, FR-SHOW-8's footer line and the captures it re-shoots.
  A behaviour a task finds worth changing is a §4.20 finding and is left (D-656).
  *Verification:* the table and the suites; `git diff --stat v2.1.0 -- docs/screenshots public/_headers tests/fixtures` lists only the files R102's `Done` note names.
- **FR-SHOW-6** **One command records the app.**
  `npm run promo:record` builds the app as `npm run e2e` does and runs the `promo` project of `playwright.config.ts` (PLAN D-652): one test per flow, each writing a video to `promo/media/<flow>-<device>.webm`, an `.mp4` beside it when `ffmpeg` is on `PATH` (and a printed line saying which it did), and the stills the flow names as `promo/media/<flow>-<device>-<still>.png`.
  The flows, in `PROMO_FLOWS`: on a **phone** (390 × 844, DPR 3, portrait) the first run from a cold open through where → when → what to the first card opened; the list with tonight open and a pass card opened to the guide; the live page watching, `[ see this pass ]`, the scrubbed instant and `[ now ]`; the settings page and a language switch; on a **desktop** (1440 × 900) the cold open's three panes, a place set and the countdown, a pass opened in the first two panes; the live page watching and scrubbing with the rail; *(amended v2.2.2, V22-20)* on both devices, the live dome over London played forward at 60× through the evening's crowded half hour (FR-SHOW-9).
  Each flow is under 40 s, in English by default with the Spanish first run as one more flow, both themes for the phone's first run.
  The seeds are the capture set's — *(amended v2.2.1, V22-16)* the showcase night of FR-SHOW-9 for every flow, the place typed as `bariloche` and picked from the recorded geocoder answer, its stored run written into IndexedDB so the picked place fills at once (was: the Paris night with coordinates typed and the forecast refused, PLAN D-673; the draft's Neuquén fixture nine days on put FR-SAT-4's staleness warning in the lists) — under `page.clock` run forward between actions so the countdown ticks and the mark's bead moves in the file; nothing in a recording is live data.
  The run is excluded from `npm run e2e` and from CI.
  *Verification:* `tests/docs/promo.test.ts` asserts `PROMO_FLOWS` names a device, a language and a duration for every flow and that the project exists and is ignored by the others; the run and the watching are the owner's (Phase 2i's gate).
- **FR-SHOW-8** **The chart's library is credited in the app.**
  *(V22-10, V22-15)* FR-X-2 as amended: a fourth credit in the footer, "Sky chart: glyphcss.", one link, both languages, in the full footer, the wide one-row footer (D-120) and the phone steps' line form (D-548) alike.
  The library and not its author: the author's name and profile belong to the owner's posts, not to the app or the repository (V22-15), and the README's credit (FR-PUB-4 as amended) names the library, its licence and its copyright holder the same way.
  The full form's attributions already wrap (GeoNames's is longer), so the new sentence wraps like them on compact; the one-row forms keep their shape and may wrap once where the fourth item does not fit — D-120's row is a form, not a width promise — and the task reports the narrowest wide width at which it holds in Spanish.
  *(V22-14)* The wrap's row is taken from the shell's padding, not from the panes: FR-HOME-3 as amended says how, so FR-HOME-2 and FR-HOME-3 keep their sizes.
  The one product change of the phase, and the exception FR-SHOW-5 names: the release-set captures whose screen renders the footer — `home` at every width and variant, and any other `captureSet.ts` entry whose screen does — are re-shot by the task that adds the line, those files and no others, listed in its `Done` note with `git diff --stat`.
  `README.md`'s glyphcss paragraph loses the author's name (FR-PUB-4 as amended) and `docs/RELEASE.md` §14's footer item says the library alone; P3 writes both (the documents are `docs`'s), R102 touches no document.
  *Verification:* a component test asserts the four credits, their hrefs and both languages in each form; the e2e that counts the home's footer links (`identity.spec.ts`, "3 footer links") is updated to four; `git grep -i fortunatti` over the tracked tree returns only the Decision Log rows, this block's history and P1's checked entry (V22-15); the re-shot captures at the owner's gate.
- **FR-SHOW-7** **Material is not evidence.**
  Nothing under `promo/` is tracked, referenced from a document, or read by a test other than `promo.test.ts`'s optional check; `docs/readme/hero.png` and the D-179 set are not produced from it and are untouched *(but see FR-ADDR-4: the hero is regenerated once for the address; and, amended v2.2.1, FR-SHOW-10: the set and both pictures are re-shot on the showcase night — from the capture run, still never from `promo/`)*.
  The post drafts, the calendar and the hike photograph the owner adds live beside the media in `promo/` on the owner's machine and are not this specification's.
  *Verification:* `hygiene.test.ts` (FR-SHOW-3); `rg promo/ docs README.md` empty.
- **FR-SHOW-9** **The showcase night: Bariloche, 5 to 6 September 2026, with its weather.**
  *(v2.2.1, V22-16, V22-17)* The recording run (FR-SHOW-6) and the release capture set (FR-SHOW-10) are seeded on one place and one night.
  The place is the first result the geocoder returns for the query `bariloche` — Bariloche, Rio Negro, Argentina, `-41.14557, -71.30822`, 839 m, `America/Argentina/Salta` — picked as a reader picks it, so the observer is one the app writes (F-49's rule).
  The night is 5 to 6 September 2026 over the committed 2026-09-02 elements; the instant each screen shows is the plan's (PLAN §2.37), inside that night or, for a screen that needs the day, on the 6th.
  At every instant a recording or a capture shows, three things hold: (a) the elements are under FR-SAT-4's five days old, so no screen carries the staleness warning — they are a little over four days old at the night's first bright pass, and the five days run out on the evening of the 6th (the plan states the instant, measured as FR-SAT-4's warning measures it), so nothing after it is shown; (b) the observer has its zone, so every clock reads local time (`GMT-3`, D-36) and none reads `UTC`; (c) the forecast is the one recorded for the place's 0.1° cell (`-41.1, -71.3`, D-37), so the cloud badges, the conditions table and the readiness line read clouds, and none reads "Weather unknown" or "no cloud forecast stored yet".
  The forecast is Open-Meteo's historical-forecast record for 2026-09-06 to 2026-09-08 in the forecast API's own shape (the app's request parameters, `timeformat=unixtime`, 72 hourly samples from local midnight, no nulls), captured on 2026-09-28: the one fixture in the tree whose weather was not fetched at the time it describes, and its `.meta.json` says so and names the endpoint.
  It reads 0 % from midnight to 04:00 on the 6th, 6 % at 05:00 and 38–41 % at 06:00–07:00, so the night's passes carry clear and cloudy badges both.
  The two new fixtures — `tests/fixtures/open-meteo/2026-09-06-bariloche-forecast.json` and `2026-09-06-bariloche-geocode.json`, each with its `.meta.json` — are the owner's commit on `main` before the first task, because a task session has no network (D-647's precedent).
  *(amended v2.2.2, V22-20)* **One exception to the one place:** the two dome flows of FR-SHOW-6 are over London — the first result the geocoder returns for `london`, `51.50853, -0.12574`, `Europe/London` — on the evening of the same 6th from 21:18 local, with Open-Meteo's historical-forecast record for its cell (`51.5, -0.1`; 0 % cloud at 20:00 and 21:00 UTC), because over Bariloche the dome never holds more than one satellite and over London eleven passes cross in the half hour and up to five are up at once.
  (a)–(c) hold there as over Bariloche; the fixtures are `2026-09-06-london-forecast.json` and `2026-09-06-london-geocode.json` with their `.meta.json`.
  **What the night does not hold.**
  Its bright passes are before dawn on the 6th, from 04:40 to 07:20 local, and none is the ISS: its visible season over northern Patagonia starts on the 11th (D-179's note for Neuquén), past the elements' five days.
  So a screen whose subject was "the ISS pass" is of the night's brightest pass instead, and a state the night does not hold — the `Next ISS` tag, and any other the capture run cannot find on the night — is not produced from another place, another night or a hand-made fixture: its `captureSet.ts` `what` line says it is absent and why, and a finding or question that closed on it keeps pointing at the per-task capture that showed it (FR-CAP-4).
  The rest of the suite does not move: Neuquén nine days on, the golden fixtures and `passes.golden.test.ts`, `stored-run-neuquen.json`, and every spec that names Paris for its own reason.
  *Verification:* a unit test over the seeds (PLAN §2.37) asserts the seeded observer is the geocode fixture's first result as `lib/place.ts` builds it; every instant the capture and recording specs name is on 2026-09-05 or 2026-09-06 in the observer's zone and under `EPOCH_WARN_MS` from the elements the warning reads; the forecast fixture's cell is the observer's cell and its samples cover every such instant; and no seed module exports a Paris observer or `PARIS_NIGHT` for the capture set or the recordings.
- **FR-SHOW-10** **The release set is re-shot on the showcase night.**
  *(v2.2.1, V22-16, V22-18)* Every file of the D-179 set — the 254 `v1-*` captures `captureSet.ts` names — is re-shot on FR-SHOW-9's night by `v1-captures.spec.ts` with its routes unchanged, both languages, both themes, every width; the set's shape does not change (no screen, width or variant added or dropped, so `captures.test.ts` passes on the same list), only its pictures and the `what` lines whose words named Paris, the ISS pass or "weather unknown".
  FR-CAP-5 holds on the new night: two runs of `captures.yml` on one commit give byte-identical files, or the file leaves the set with a row saying why.
  `scripts/readme-hero.ts` regenerates `docs/readme/hero.png` and `docs/readme/social-preview.png` from the re-shot files (FR-ADDR-4's two pictures; FR-PUB-2: composed, never run), and the owner uploads the social preview again (FR-PUB-11, the GitHub UI).
  The per-task `r*-` captures are history and are not touched (D-179).
  Screens that change only because the data did are not findings; a screen that renders wrongly with a forecast or a zone is a §4.20 finding and is left, as FR-SHOW-5's rule for the phase has it (D-656).
  *Verification:* `captures.test.ts` green on the unchanged list; `git diff --stat` in the task's `Done` note lists `docs/screenshots/v1-*` and the two `docs/readme/` pictures and no other capture; the two-run comparison of FR-CAP-5 in the pull request; the pictures at the owner's gate.

### 4.44 The address *(v2.2, V22-11)*

The app has been served from `https://in-your-sky.ezequiel-baruf.workers.dev` since the worker was renamed (PLAN §2.5, 2026-09-03): the account subdomain is spent and the worker's name was the whole of the free improvement.
On 2026-09-25 the owner bought `inyoursky.app` at Cloudflare Registrar; the zone is active in the same account as the Worker.
OQ-10 is closed by it.
This block says what the address is, how it is bound, and what does not change.

- **FR-ADDR-1** **The origin.**
  `https://inyoursky.app` is the app's public address, and it is the one every reader-facing document and every test names where the `workers.dev` address is named today: `README.md`'s prologue (FR-PUB-1's live URL), every occurrence in `docs/DEPLOY.md` and `docs/RELEASE.md` (the `SITE=` lines, the deploy items of each release, §10's metadata homepage, FR-PUB-11), `tests/docs/public.test.ts`'s `LIVE`, and the wordmark line `scripts/readme-hero.ts` prints under the title.
  The `workers.dev` address is then written in two places only: `docs/DEPLOY.md`'s branch-preview line (FR-ADDR-2) and one sentence in the same file saying it still serves.
  No `www`: the zone has one name bound and the apex is it; a `www` record is a later decision if a reader ever types one.
  *Verification:* `public.test.ts` asserts the README's live URL is `https://inyoursky.app`; `accuracy.test.ts` (FR-SHOW-1) asserts `git grep -l workers.dev` over tracked text files returns `docs/DEPLOY.md` and this specification's and the plan's history, and nothing else.
- **FR-ADDR-2** **Bound by the deploy, not the dashboard.**
  `wrangler.jsonc` gains `"routes": [{ "pattern": "inyoursky.app", "custom_domain": true }]`.
  A custom domain on a Worker is created by `wrangler deploy` — the DNS record and the certificate come with it — so the deploy from `main` that Workers Builds already runs is what binds the name, and nothing is clicked in the dashboard for it.
  D-12 holds: there is still no Worker script, `dist/` is served as-is, `public/_headers` supplies the §11 headers on the new origin exactly as on the old (the CSP's `connect-src 'self'` needs no host added; `tests/deploy` is unchanged).
  `"workers_dev": true` stays, so `in-your-sky.ezequiel-baruf.workers.dev` keeps serving the same build unchanged — no redirect, because a redirect would need a Worker script, and because an installed app on the old origin must go on working (FR-ADDR-3).
  `"preview_urls": true` stays and branch previews remain `https://<branch>-in-your-sky.ezequiel-baruf.workers.dev`: a custom domain has no preview form.
  *Verification:* `tests/deploy/wrangler.test.ts` (or the existing deploy test's file) asserts the route with `custom_domain: true`, `workers_dev: true`, `preview_urls: true` and no `main` script entry; the owner's check after the first deploy is `curl -sI https://inyoursky.app` printing §11's header block, and the same for the old address, with the command in `docs/DEPLOY.md`.
- **FR-ADDR-3** **State does not move, and that is accepted.**
  IndexedDB, the prefs record, the saved places, the stored run and an installed app all belong to an origin; a reader who used the `workers.dev` address finds a first run at `inyoursky.app` and keeps everything at the old one, which goes on serving.
  No migration, no banner, no message: the audience of the old address is the owner and the people who were sent a link by hand before 2026-09-28, and a first run costs them a place name.
  *Verification:* none in code; the sentence in `docs/DEPLOY.md` and this row.
- **FR-ADDR-4** **The hero prints the address, so it is regenerated — once, and it is not the app.**
  `scripts/readme-hero.ts` composes `docs/readme/hero.png` and `docs/readme/social-preview.png` from captures that do not change, and its wordmark line is the one string in the pictures that does.
  FR-SHOW-5 is a claim about the app — screens, captures, chunks — and the two pictures are the repository's (FR-PUB-2: composed, never run), so regenerating them is inside FR-SHOW-5, not an exception to it: `docs/screenshots/` is untouched and FR-PUB-2's test keeps passing.
  The owner-only steps go in `docs/DEPLOY.md` per V13-16, under a *Domain* heading: the registrar (Cloudflare, auto-renew on, the renewal date 2026-09-25 each year), the GitHub *Website* field set to the new address (FR-PUB-11's item points there), and what to check after a deploy.
  *Verification:* FR-PUB-2's and FR-PUB-11's tests (the files exist at their sizes); `accuracy.test.ts` asserts `docs/DEPLOY.md` has the *Domain* heading and the renewal date.

### Phase 2i — v2.2 ("the showcase", as decided 2026-09-25, V22-1)

After the `v2.1.0` tag.
One product change, and it is a credit: the footer names glyphcss and its author (FR-SHOW-8, V22-10).
Otherwise no requirement of the app is amended, no screen changes, no capture is re-shot but the footer's, and no test is changed to pass.
Like Phase 2e its subject is the repository: four `P` tasks and one `R` (§4.43, §4.44), in the order that keeps the last one honest:

- The address: `inyoursky.app` bound by the deploy, the documents and tests naming it, the hero regenerated, the owner's steps in `docs/DEPLOY.md` (§4.44, FR-ADDR-1..4).
  `P6`, **first**, with a precondition that the zone exists, so that `P3` reads the new address as the truth and never writes the old one.
- The documents made true, the tree's public and local halves named, the reading order carried to v2.1 and the numbers in it stated with their commands (FR-SHOW-1..3).
  `P3`, after `P6`.
- The footer's fourth credit, both languages, every form, and the footer captures re-shot (FR-SHOW-8).
  `R102`, beside `P6`: `ui` against `docs`, no shared file.
- The recording run: phone and desktop flows off the capture set's fixtures, into `promo/`, which the tree ignores (FR-SHOW-6, FR-SHOW-7).
  `P4`, after `R102`, so the recordings show the credit.
- The dead code removed, with knip on `main` first and in CI after (FR-SHOW-4, FR-SHOW-5).
  `P5`, alone in flight and last, because it touches every lane's directories and because the counts `P3` states are read at a commit, not remembered.

Definition of done:
- `https://inyoursky.app` serves the build from `main` with §11's headers, checked by the owner with `curl -sI` on both addresses after `P6`'s deploy (FR-ADDR-2); the old address serves unchanged.
- US-36 AC1..AC7 accepted; FR-SHOW-1..8, FR-ADDR-1..4 met and FR-X-2 as amended met, with `tests/docs/accuracy.test.ts`, `tests/docs/promo.test.ts` and the extended `hygiene.test.ts` green.
- `npx knip` reports nothing at the phase's last commit and CI's `dead-code` job runs it on every pull request from then on, outside FR-CI-1's ten minutes.
- The app unchanged: `passes.golden.test.ts` and every golden fixture untouched; `tests/docs/captures.test.ts` green with no file added to or removed from `docs/screenshots/`; `npm run e2e` green; no chunk's gzipped size above what `npm run bundle:budget` printed at `d7a5d27` (FR-SHOW-5's table, in the pull request).
- Every session of the phase on the most capable model with a second model reviewing, doubled caps and no fallback to a lesser model (V22-13): a task that ends on a limit is rerun the same way, never finished cheaper.
- The clean-clone run of FR-PUB-8, by the owner, on the phase's last commit, because the owner's knip commit and `P5` together are the first change to `package.json`'s dependencies since P1 that lands beside a change to `src/`.
- The owner has run `npm run promo:record` on their Mac and opened every file it names; the videos play, the phone ones are portrait, the desktop ones are landscape, and the countdown moves in all of them (FR-SHOW-6).
  That is a hand-and-eye thing and the only gate a laptop cannot answer.
- `package.json` version **2.2.0** and a `v2.2.0` tag by the owner once `P5` is on `main` (V22-12; the draft said 2.1.1): the phase's name and its version agree as every earlier phase's did, and a new address and a new credit are things a reader sees.
  No budget re-set (FR-SHOW-5 is that nothing moved) and no capture re-shoot beyond the footer's (FR-SHOW-8); `docs/RELEASE.md` gains a short §14 for it — the headers on both origins, the hero, the footer's captures, the tag — and its §13 phone run is v2.1's and stays owed.
