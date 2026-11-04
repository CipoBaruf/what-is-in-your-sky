# v2.2 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.36 v2.2 decisions (2026-09-25)

The phase changes nothing the app does.
Its decisions are about how a claim about the repository becomes a test, how dead code is found and kept out, and how a video of the app is made from the same seeds as a capture.

- **D-647 — knip is the dead-code tool, and the owner installs it.**
  (FR-SHOW-4; V22-4.) `knip` (MIT, ~5.x, a development dependency) reads `package.json`, the Vite and Vitest configs and every import, and reports unused files, exports, types and dependencies in one run; the 2026-09-25 audit in SPEC §4.43 was made with it and no configuration.
  A task session cannot add a dependency (no network under `npm ci`, D-622's precedent), so `npm install --save-dev knip` is the owner's commit on `main`, and that commit also adds an empty `knip.json` (`{}`) because the driver's `Precondition:` checks a file on `origin/main` (§16.3) and a lockfile line is not one — `knip.json` is `P5`'s precondition and `P5` fills it.
  `knip.json` at the root: `entry` is what Vite and Vitest already know plus `scripts/*.ts` and `spike/**/main.tsx`; `ignore` is `spike/**` (its pages are HTML entry points knip does not read, and SPEC §4.43 keeps the spike as cited evidence) and `docs/**`; `ignoreDependencies` is empty and stays so — a dependency knip calls unused is removed or the reason is written beside the rule.
  `npm run check:dead` is `knip`; `ci.yml` gains a `dead-code` job parallel to `trailers`, so it spends none of FR-CI-1's budget and a new unused export fails the pull request that adds it.
- **D-648 — The rule for an unused export.**
  (FR-SHOW-4.) An exported symbol nothing outside its file imports **loses the `export` keyword** when the file itself reads it, and is **deleted** when nothing does; a test that exists only to import a deleted symbol is deleted with it, and a test that imports a symbol only to pin a constant a requirement names keeps it exported — the requirement is the reason, and the test is the import knip sees.
  A duplicate export (`TAP_PX` beside `LIVE_FOLD_ACTIONS_UNDER_PX`, the two `camera.ts` pairs, `timeStripe.ts`'s minute) keeps the name the requirement uses and drops the alias.
  The barrels `src/state/index.ts` and `src/model/index.ts` re-export only what a file outside their directory imports.
  No signature changes, no rename, no moved file: the diff is `export` keywords, deleted declarations and deleted tests, so a reviewer can read every hunk as one of three shapes.
- **D-649 — The app unchanged is a measurement, not a promise.**
  (FR-SHOW-5.) Before `P5` touches a file it builds `main` and records `npm run bundle:budget`'s table in `sdd-run/P5.summary.md`; after, the same table.
  No row may be larger — dead exports are tree-shaken, so a larger chunk means a symbol that was not dead.
  `npm run e2e`, the golden suite and `captures.test.ts` are the rest of the measurement; no capture is re-shot because no screen changes, and a screen that did change is a finding, not a re-shoot.
- **D-650 — A claim about a document is a test that reads the document.**
  (FR-SHOW-1; D-368's rule, extended.) `tests/docs/accuracy.test.ts`: for `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/HOW-THIS-WAS-BUILT.md`, `docs/DEPLOY.md`, `docs/RELEASE.md` and the four `SKILL.md` files, every backticked token that looks like a repository path (`docs/…`, `scripts/…`, `src/…`, `tests/…`, `.claude/…`, `.github/…`, a root file with an extension) exists in `git ls-files`; every `npm run <x>` and `npx tsx scripts/<x>` names a script in `package.json` or a file in `scripts/`; the skills the reading order lists are the directories under `.claude/skills/`; the version the README or the release checklist calls current is `package.json`'s.
  Counts are not pinned to the number — the figures live in one *By the numbers* table whose columns are the figure, its value, the command that produces it and the commit it was read at, and the test asserts the table's shape and that the strings the 2026-09-25 audit found stale never return (SPEC FR-SHOW-1's list); it does not do the arithmetic, because a test that recounts the tree on every run would make the document wrong the moment a task merged.
  Off line, like every `tests/docs` test: it reads the tree and `git ls-files`, never `gh`.
- **D-651 — The public and the local halves of the tree are named in one place.**
  (FR-SHOW-3.) `.gitignore` gains `/promo` beside `/redesign` (P6 writes the line, first in the phase) and `hygiene.test.ts` asserts it (P3); `docs/HOW-THIS-WAS-BUILT.md` gains a short section, *What is deliberately public*, naming `.claude/settings.json` (one allow rule, `gh pr merge`, for the driver's merge step), the four skills, `CLAUDE.md` and `scripts/sdd/`, and a sentence on what is not tracked and why (`sdd-run/`, `logs/`, `.sdd-cache/`, `handoff/`, `redesign/`, `promo/`).
  `public.test.ts`'s path and address scans already cover the rest; they gain `.claude/**` explicitly, which `git ls-files` includes but the test's reader should be seen to include.
- **D-652 — The recording run is a project of the one config.**
  (FR-SHOW-6; `hygiene.test.ts`'s "exactly one Playwright config".) `playwright.config.ts` gains a `promo` project: `testMatch: /promo-record\.spec\.ts/`, `use: { video: { mode: 'on', size } }` with the viewport set per flow in the spec, and the existing projects gain `testIgnore` for that file so `npm run e2e` never records.
  `size` matters: Playwright scales a recording to fit 800 × 800 unless told otherwise, so the phone flows ask for 1170 × 2532 (390 × 844 at 3×, a reel's shape) and the desktop ones for 1440 × 900; Chromium's screencast may cap the phone frame below that, and the task records the frame size it got in its `Done` note rather than promising one.
  `npm run promo:record` is `vite build && playwright test --project=promo`, the build with `VITE_MOON_LORE=on` as `e2e` does.
  Videos land where Playwright puts them, and the spec's `afterAll` moves each to `promo/media/<flow>-<device>.webm`, then runs `ffmpeg -i … -c:v libx264 -pix_fmt yuv420p` to `.mp4` when `ffmpeg` is on `PATH` and prints one line saying which it did — LinkedIn and Instagram take `.mp4`, and a `.webm` alone is still the record.
  No new dependency: `ffmpeg` is an optional external binary, the way `openssl` is for the window spike.
- **D-653 — The flows are seeded like captures and moved by the clock.**
  (FR-SHOW-6, FR-SHOW-7.) `tests/e2e/promo-record.spec.ts` imports the observers, the prefs seed and the helpers `v1-captures.spec.ts` uses (`PARIS`, `NEUQUEN`, `seedPrefs`, `domeDrawn`, `enterScrubbing`), so the two never disagree about what the fixtures show; `page.clock.install` at the fixture instant, and `page.clock.runFor` between actions so the countdown ticks and the bead moves in the file.
  Each flow is one test; `PROMO_FLOWS` in the spec is exported and names the flow, its device (`phone` 390 × 844 at DPR 3, `desktop` 1440 × 900), its language and the seconds it runs, and `tests/docs/promo.test.ts` asserts the list against the files a run leaves (when `promo/media/` exists — the run is the owner's).
- **D-654 — Screenshots are frames, not a second spec.**
  (FR-SHOW-6.) The same flows call `page.screenshot` at the moments the flow names (`stills: ['after-place', 'pass-open', …]`), into `promo/media/<flow>-<device>-<still>.png`.
  `scripts/readme-hero.ts` and the D-179 set are untouched: those are evidence and this is material.
- **D-655 — `P5` runs alone and last.**
  (§16.18.) It touches every lane's directories at once, so it cannot share a wave (§16.1's rule is about ownership, not size); it runs after `P3` so the counts `P3` states are read at a commit `P5` does not move; and it is the one task with a `Precondition:` (knip on `origin/main`).
- **D-657 — The chart's credit is a fourth `Attribution`.**
  (FR-SHOW-8, FR-X-2 as amended; V22-10, **amended V22-15**.) `ATTRIBUTION_URLS` gains `glyphcss` (`https://glyphcss.com`).
  The catalogs gain `footer.chart`, an ordinary one-link `LinkedText` — `{ before: 'Sky chart: ', link: 'glyphcss', after: '.' }` / `{ before: 'Carta del cielo: ', link: 'glyphcss', after: '.' }` — and `footer.short.chart` is `'Chart:'` / `'Carta:'` for the wide row (D-120), where the library's name stands as a link beside the three sources.
  *(V22-15)* As first written this row carried two links and the author's name; the second anchor `Linked` had learned for it goes with the name, so no `LinkedText` field is left that only one entry used.
  The line form (D-548) carries the same text after the credit.
  `Footer.test.tsx` asserts the four credits' hrefs in both languages and forms; `tests/e2e/identity.spec.ts`'s count of the home's controls (its comment says "3 footer links") moves up by two.
  The one-row forms may wrap once where the fourth item does not fit (FR-SHOW-8); the task measures the narrowest wide width at which the Spanish row holds one line and writes it in the `Done` note — no literal is pinned for it.
  The captures: the task runs `CAPTURES=1 npx playwright test v1-captures -g home` and the same for any other `captureSet.ts` entry whose screen renders `<Footer>` (the settings page has its own foot, FR-SET-1, and is not one), and commits those files only, naming them in its `Done` note; `captures.test.ts` is unchanged because no file is added or removed.
  The README's glyphcss paragraph gains the author's profile link, written by P3 in wave 2 (the README is `docs`'s; R102 touches no document), and FR-PUB-4's test keeps passing because it checks the six names and licence strings, which do not change.
- **D-681 — The two-line footer's row is the shell's, per language.**
  (FR-HOME-3 as amended, FR-SHOW-8; V22-14; extends D-608.) `FOOTER_ONE_LINE_MIN_PX = { en, es }` in `src/lib/layout.ts`, the widths R102 measures on the built app (1330/1349 with the author's name in the row; smaller without it, V22-15 — the task re-measures and the literals are whatever the build says), pinned by `tests/styles/breakpoint.test.ts` beside D-546's header literals.
  In `App.module.css`, under `:root[lang="en"]` from `WIDE_MIN_PX` to 1329 px and under `:root[lang="es"]` to 1348 px, the main's padding above and below the panes is half a row and the footer's `padding-top` is half; the D-608 rule (under 720 px tall) composes with it — both true, the padding is what the smaller of the two rules leaves, which under 720 px and below the literal is none.
  No JavaScript measures the footer: the width decides, as it decides the wrap.
  `home-desk.spec.ts` is unchanged and is the proof; a one-line comment in it names this decision.
  Numbered outside the phase's reserved blocks (D-660..D-680) because it is the plan's own, made between waves; R102 records what it does with it in D-666, the one number left in its block.
- **D-659 — No economy for the showcase: `fable` implements, `opus` reviews, 500 turns, no fallback.**
  (V22-13; §16.3, §16.6.) The owner's instruction on reviewing the draft: this phase is how the app and the process are shown, so no token or model saving applies to it.
  The driver gains three optional task fields — `Review:`, `Turns:`, `Fallback:` — read by `scripts/sdd/tasks.ts` and honoured by `sdd-run.ts` (`reviewModelFor`, `limitsFor`, `fallbackFor`), with `tests/sdd/tasks.test.ts` pinning each and a bad value reported as a breakdown problem like any other field.
  Fields on the task rather than flags on the run, so the decision survives a `--wave` typed from memory; scaling the wall clock and the review's cap with `Turns:` so a doubled cap is not a session timing out with turns to spare.
  Made as repo tooling on the spec branch before the first wave (D-86's precedent), the one code change of the spec pull request.
- **D-658 — The custom domain is a route in `wrangler.jsonc`, and the deploy binds it.**
  (FR-ADDR-1..4; V22-11; D-12 unchanged.) `"routes": [{ "pattern": "inyoursky.app", "custom_domain": true }]` beside `"workers_dev": true` and `"preview_urls": true`.
  `wrangler deploy` — the command Workers Builds runs after `npm run build` — creates the DNS record and provisions the certificate for a custom domain whose zone is in the account, which is why the task's `Precondition:` is the zone and not a dashboard step; the first deploy after the merge is the binding, and the task cannot see it succeed (a session has no `curl` to the internet), so the owner's `curl -sI` on both origins is the gate.
  No `main` entry, no script: assets only, D-12 as amended in §2.5.
  The eight `workers.dev` strings in the documents become the new origin except `docs/DEPLOY.md`'s branch-preview line and its one "still serves" sentence; `tests/docs/public.test.ts`'s `LIVE` and `scripts/readme-hero.ts`'s wordmark change with them, and the script is re-run so `docs/readme/hero.png` and `social-preview.png` print the new line from the unchanged captures (FR-PUB-2's test holds; FR-SHOW-5 is untouched because `docs/screenshots/` is).
  The deploy test gains a `wrangler.jsonc` assertion so a later edit cannot drop the route or the `workers_dev` flag silently.
  `docs/DEPLOY.md` gains a *Domain* section (registrar, auto-renew, the renewal date, the GitHub *Website* field, the two `curl` checks) and `docs/RELEASE.md`'s metadata item points at the new homepage.
  The old origin's IndexedDB and prefs stay where they are (FR-ADDR-3): no code reads `location.hostname`, and none starts to.
- **D-660 — The `workers.dev` scan is a fixed-string scan.**
  (P6; FR-ADDR-1, FR-SHOW-1.) `wrangler.jsonc` must keep `"workers_dev": true` and `tests/deploy/wrangler.test.ts` asserts it, and `git grep 'workers.dev'` without `-F` matches that key through the unescaped dot — so the task's `Done when` line, read literally, could never print `docs/DEPLOY.md` alone.
  The check that means what FR-ADDR-1 says is `git grep -nF 'workers.dev' -- ':!SPEC.md' ':!PLAN.md' ':!TASKS.md' ':!package-lock.json'`, which prints `docs/DEPLOY.md` only; `accuracy.test.ts` (P3) uses the fixed string.
  Two lines were reworded rather than carried: `docs/RELEASE.md` §1's branch-preview item now points at `docs/DEPLOY.md`'s *Domain* section instead of naming the preview URL, and `wrangler.jsonc`'s comment says "per-branch URL", so the address is written in the two places FR-ADDR-1 allows and nowhere else.
- **D-661 — The hero carries no wordmark; the social preview does.**
  (P6; FR-ADDR-4, D-370.) `scripts/readme-hero.ts` composes `hero.png` with `title: false` — the README's prose above the image already names the app and the address, and every pixel of the hero goes to the screens — and `social-preview.png` with the lockup and the wordmark line.
  Only the preview prints `inyoursky.app`; the hero was regenerated in the same run because FR-ADDR-4 says both are, and its bytes differ from `main`'s through the renderer (Chromium's text rasterisation on the machine that ran the script), not through its content.
  The pair stays the output of one run so the two never disagree (FR-PUB-11).
- **D-662 — `docs/RELEASE.md` §14 is written by the phase's first task as a skeleton.**
  (P6; V22-12.) The section carries the checks only the owner can run after the merge deploys — both origins' header blocks, the app at the new address, the old origin's state left in place, the *Website* field — plus the hero, the footer captures R102 re-shoots, the knip and bundle items P5 proves, and the `v2.2.0` tag with the SHA written in.
  Later tasks of the phase append items under §14.1–§14.3 rather than restructure it, so the checklist exists before the second wave needs a place to write.
- **D-656 — No `src/` behaviour, no `Done` note about behaviour.**
  The three tasks' `Done` notes record what was deleted, what was corrected and what was recorded, with the commands; a task that finds a behaviour worth changing writes a finding under §4.20 and leaves it.
- **D-663 — The chart's credit is the last item of every footer form.**
  (R102; FR-SHOW-8, D-657, D-548; **amended V22-15**.) D-657 places the line form's chart item "after the credit" and says the wide row has the library "beside the three sources", which read apart could put the item in two places.
  D-548 defines the line form as the wide row without its privacy word, so the two rows keep one order: `Data: … (CC BY 4.0) · No tracking · Built by Ezequiel Baruf. · Chart: glyphcss`, the line form the same less `No tracking`.
  In the row the library's name stands as a link after `Chart:`, the way the sources stand after `Data:`.
  The full form follows: the three sources, the privacy sentence, the maker, then "Sky chart: glyphcss." as its sixth line, so the sources and the page's own lines keep the order every earlier capture shows and the fourth credit is what was added, in each form, at the end.
  *(V22-15)* As first built the item carried a second name after a comma and the sentence a second link; the third session took both out, and the order above is the one that stayed.
- **D-664 — The one-row footer wraps under 1118 px (en) and 1137 px (es); the 1280 px captures hold one line.**
  (R102; FR-SHOW-8, D-657; **amended V22-15**.) Measured on the built app by a one-off Playwright script (`sdd-run/`, not kept), with the library alone in the row: the wide row holds one line from 1118 px of viewport in English and 1137 px in Spanish, and is two lines from `WIDE_MIN_PX` (964) up to those widths, the 1024 px capture width among them and the 1280 one not.
  With the author's name in the row the same script had found 1330/1349, so the wrap that reached every desk capture width then reaches only the mid width now, and the 1280 × 800 desk keeps the shell height every earlier requirement was measured against.
  FR-SHOW-8 allows the one wrap and D-657 pins no literal for the gate; the pair is `FOOTER_ONE_LINE_MIN_PX` because D-681 needs it (D-666).
  At 1920 the content is capped at `HOME_MAX_CELLS` (FR-HOME-4) and the row holds one line.
  What the wrap costs under the fold is one row of the D-119 shell's height — paid from the shell's air, not the panes, by D-681's rule (D-666); `desktop.spec.ts`'s bottom-of-screen and one-`<p>` assertions hold as written.
  The English fold equals `HOME_THREE_PANE_MIN_PX` (1118) by measurement, not by construction: FR-HOME-3's 1118 × 700 check therefore runs with a one-line footer in English and a two-line one in Spanish, and is green in both.
- **D-665 — `LinkedText` stays a one-link sentence; the catalog test reads the short row and the library's name.**
  (R102; D-657; **amended V22-15**.) The first two sessions gave the interface optional `middle` and `link2` fields for a second link, rendered only together; V22-15 took the second link out and with it the fields, so `LinkedText` is the shape it was and `Linked` renders one anchor.
  What stays from that work: `messages.test.ts` renders `footer.chart` with the other linked sentences and the short row's four strings (`footer.short` was not rendered before), so the Spanish and never-address-the-reader checks cover them; `glyphcss` and `(CC BY 4.0)` join the shared set as names (FR-I18N-6).
  `git grep -i fortunatti src tests` finds one line on the branch, `tests/docs/public.test.ts`'s README pin, which is `main`'s and P3's to remove with the README paragraph (FR-PUB-4 as amended).
- **D-666 — The shell's air is one calculation, and the two rules that take from it are shares of a row.**
  (R102 resumed; FR-HOME-3 as amended, FR-SHOW-8; D-681, D-608, D-664; **amended V22-15**.) D-681 asks for two rules that compose — the short window's (D-608) and the two-line footer's — with both true leaving no padding above or below the panes.
  Two media blocks each writing `calc(var(--row) / 2)` would not compose: whichever wins the cascade leaves half.
  So the wide `.main` rule (`App.module.css`) owns the padding once, `calc(var(--row) * (1 - var(--short-window) - var(--two-line-footer)))`, and each rule sets its own custom property to `0.5` — a number, the share of the row it takes, so the wide blocks keep to cells and rows (FR-DESK-1's test) — and under 720 px tall below the literal the two shares are the whole row.
  `FOOTER_ONE_LINE_MIN_PX = { en: 1118, es: 1137 }` in `lib/layout.ts` is D-664's measurement and nothing derives it; the stylesheet writes it as `(min-width: 964px) and (width < 1118px)` under `:root[lang='en']` and `(width < 1137px)` under `es`, the header's fold syntax (D-546), so the literal appears verbatim and the block still counts as a wide one.
  The footer's half is on `#root > footer[data-form='short']` from the same block: the settings page's own foot (FR-SET-1) is not that element and keeps its padding, and the line form (D-548) is compact-only and never under the query.
  `breakpoint.test.ts` holds the pair, its order (Spanish the longer), its place between the 1024 and 1280 px capture widths and under the split literal, and each block's two rules and nothing else.
  `home-desk.spec.ts` is unchanged but for a comment naming D-681: FR-HOME-2 at 1024 × 768 and FR-HOME-3 at 1118 × 700 are green in both languages with no number moved.
  The captures: the row's text changes in every file whose footer is in the picture, so the five footer screens were re-shot whole (V22-15); against `main` the 1024 px files show the fourth credit on a second line with half a row less air above and below the panes, and every other width shows the fourth credit on the one line and the shell as it was.
  The one-off measurement script and the `CAPTURES=1` wrapper config live under `sdd-run/` (ignored) and are not committed.
- **D-671 — The `promo` project is in the config only when the command line asked for it.**
  (P4; FR-SHOW-6, D-652.) A bare `playwright test` — `npm run e2e`, CI — runs every project in the config, so a `promo` project that was always listed would have recorded under both whatever the other three ignore.
  `playwright.config.ts` exports `promoSelected(argv)` (`--project=promo` or `--project promo`) and adds `PROMO_PROJECT` to `projects` only when it is true; because every worker loads the config again with its own argv, the runner's answer is relayed as `PLAYWRIGHT_PROMO=1` in the environment the workers inherit ("Project not found in the worker process" otherwise).
  `tests/docs/promo.test.ts` asserts both spellings select it, that the process running vitest sees no such project, and that the three other projects ignore the file; `npx playwright test --list` shows none of its eight tests and `--project=promo --list` shows all of them.
  The project keeps `fullyParallel: false`, `retries: 0` and a 180 s timeout: a recording wants the box to itself, a second take is the same file written twice, and `afterAll` in the one worker moves every video the file produced.
- **D-672 — One context per flow, recording at its device's frame.**
  (P4; FR-SHOW-6, D-652.) Two frames in one file is more than `test.use` allows: Playwright refuses a `video` option inside a `describe` ("it forces a new worker"), and at file level it is one size for every test.
  So `promo-record.spec.ts` opens `browser.newContext` per flow with the device's viewport, pixel ratio, touch and `recordVideo: { dir, size }` — `tests/e2e/promoFlows.ts`'s `DEVICES`: the phone 390 × 844 at 3× asking for 1170 × 2532, the desk 1440 × 900 asking for its own size — and closes it in `done`, which is what finishes the file; `afterAll` moves the closed files.
  The project's own `video` option stays as D-652 wrote it, the phone frame, for any page the fixture would open.
  The frame the first run produced is what was asked, 1170 × 2532 (VP8, 25 fps; Chromium's screencast did not cap it), and the desk 1440 × 900.
  The `.mp4` is D-652's `libx264` and `yuv420p` plus `-vf scale=trunc(iw/2)*2:trunc(ih/2)*2`, which keeps the even dimensions the encoder wants whatever frame a screencast produces, and `-movflags +faststart` for a file a feed streams; `ffmpeg` is found by scanning `PATH` for the executable, the way a shell resolves it, and one line per file says which of the two was written.
- **D-673 — The flows are seeded from two modules, every flow on the capture set's night, and the phone's live flow is that night by day.**
  (P4; FR-SHOW-6, D-653, D-654, D-179.) The capture spec exported nothing, so its night, its seed and its two waits — `CLOCK`, `GLARE_PASS`, `SHOWN`, `TICK_MS`, `seedPrefs`, `seedPage`, `stubNetwork`, `guide`, `listSettled`, `pinnedAt` — moved whole to `tests/e2e/captureSeeds.ts`, which `v1-captures.spec.ts` imports (its routes stay where they were; `ci.test.ts`'s F-48 check reads the helper there).
  The list — name, device, language, theme, seconds, stills — is `tests/e2e/promoFlows.ts`, the `captureSet.ts` shape, because a Playwright spec cannot be imported by a unit test (`test()` at module load) and the config wants the phone frame; the spec re-exports `PROMO_FLOWS` from it.
  **Every flow runs over Paris on the capture set's night**, not the lists at Neuquén nine days on as FR-SHOW-6's text has it: nine days on the elements are past FR-SAT-4's five-day threshold, so the home of the three first runs, the list, the settings and the desk's cold open carried the amber `Elements 9 d 4 h old` line — a warning a reader of a fresh install never sees, and promo material must not show one — which is the reason D-179 moved the capture set to Paris.
  So `scripts/build-stored-run.ts` writes a second fixture, `tests/fixtures/stored-run-paris.json`, the same 72 h search over Paris at `CLOCK` (`observers.ts`'s `PARIS_NIGHT`, 2026-09-02 03:00 UTC, where the elements are seven hours old and the ISS rises at 03:52, fifty minutes ahead, so the countdown runs on camera); `stored-run-neuquen.json` is written as before, byte for byte, and the rest of the suite does not move.
  The list flows seed that run into IndexedDB before the place is typed (the R82 method) and type Paris's coordinates, so the panes fill on the tap and the recompute runs on camera behind them; what the seed shows instead of the warning is the capture set's cost, a cloud badge reading `Weather unknown` and the readiness line's "no cloud forecast stored yet", because the only recorded forecast is over Neuquén (D-179).
  `tests/docs/promo.test.ts` holds the Paris run to `PARIS` at `PARIS_NIGHT` with its elements under `EPOCH_WARN_MS`, and the spec to that run and that clock, never `NINE_DAYS_ON`.
  The charts run over the same Paris: the desk's live flow at `SHOWN`, the ISS overhead; the phone's at `CLOCK + 12 h` (15:00 UTC), because `[ see this pass ]` is offered only while nothing is up and the next rise is between two minutes and a day ahead (FR-JUMP-1), and three minutes into the overhead pass it is not there — by day the headline counts to the evening's first rise and the one tap holds the page there with its arc drawn.
  Between actions the paused clock is run forward by `watch`: 50 ms of `runFor` then 50 ms of wall time, twenty times a second, so the countdown ticks and the bead moves in the file at the reader's pace while every instant on screen is still the fixture's.
  The flows' `seconds` are the watching stretches (12–18 s); the files came out at 17–29 s including the loads, under FR-SHOW-6's 40.
  `afterAll` converts each video on its own: an `ffmpeg` that exits non-zero is caught, named in one printed line, and the loop goes on, so a failed conversion costs that flow its `.mp4` (its `.webm` is already in `promo/media/`) and nothing of the flows after it, where one throw would have left their videos in `test-results/` for the next run to wipe.
- **D-675 — `knip.json` as filled: `ffmpeg` ignored as a binary, `docs/**` not ignored.**
  (P5; FR-SHOW-4, D-647.) Two things the decision's text did not foresee, both from running knip 6.38 (what the precondition's `npm install` resolved; the audit's 5.x reported 83 exports and 39 types, this version 172 and 58 under the same rule, so the counts in FR-SHOW-4 are the audit's and the task's `Done` note carries the run's).
  First, knip reads `execFileSync('ffmpeg', …)` in `tests/e2e/promo-record.spec.ts` as an unlisted binary; `ffmpeg` is the optional system converter D-652 and D-672 describe, found on `PATH` and never a dependency, so `ignoreBinaries: ["ffmpeg"]` is the one entry beside the empty `ignoreDependencies` — a binary is not a dependency, and D-647's rule for the latter (removed, or the reason written beside it) is kept by writing the reason here.
  Second, knip prints a configuration hint on every run for an `ignore` pattern no analysed file matches, and `docs/**` is captures and data with no source under it; a report that prints a line is not the empty report the task is measured by, so `ignore` is `spike/**` alone and the result is what D-647 wanted, `docs/**` contributing nothing to the analysis either way.
  `entry` is `scripts/*.ts` and `spike/**/main.tsx` as written; Vite, Vitest and Playwright's entries come from their plugins.
- **D-676 — A duplicate's alias loses its keyword, and the test that imported the alias imports the kept name.**
  (P5; FR-SHOW-4, D-648.) Two of the four duplicates resolved themselves — `KEY_STEP_MS` and `EXTENT_TOP_UNITS` were on the unused list and lost their keyword by the rule.
  The other two aliases were each imported by one test: `LIVE_FOLD_ACTIONS_UNDER_PX` (`foldRows.test.ts`) and `INK_HEIGHT_UNITS` (`camera.test.ts`).
  D-648 names `TAP_PX` and §12 names `DRAWING_HEIGHT_UNITS` for FR-DOME-1, so those are the kept names; each alias stays as a local `const` its file reads, and the two tests import the kept name in its place, the assertions unchanged (the values are equal by definition).
  This is the one hunk shape beyond D-648's three — an import specifier renamed in a test — and it is the smallest edit that leaves one export per value; no test was changed to pass, and none was deleted, because nothing on knip's list had a test importing it.

- **D-667 — *By the numbers* is read at the `main` commit the task branched from, not at the task's own.**
  (P3; FR-SHOW-1, FR-SHOW-2, D-650.) A figure needs a commit a reader can check out.
  The task's commits are squashed at merge, so a branch SHA in the table would name a commit `main` never has; the base commit (`2b6ff66` for P3) is on `main` for good.
  The cost is stated in the table's preamble: the task's own edits move the three documents' line counts by a few lines and add one test file, and the figures are the base's.
  The `npm test` row is measured, not derived: the session swapped the base commit's `tests/docs` files back in and ran the suite once (2165 tests in 194 files, against the branch's 2213 in 195), so the row is what the command printed at the tree it names.
  A later phase that rewrites the page re-reads every row at its own base and changes the one SHA.
- **D-668 — `docs/RELEASE.md` keeps every released version's checklist as history, marked, and only its current sections are read for paths.**
  (P3; FR-SHOW-1.) §6 to §13 are the lists of releases that happened and name files, budgets and sentences as they stood then — `FollowPhone.tsx`, main at 155 — and rewriting them would falsify the record the way editing a Done note would.
  Each carries a one-line `> *History (…)*` marker under its heading; `accuracy.test.ts` asserts the marker sits on exactly §6–§9 and §11–§13 and drops those sections before scanning the file for paths and scripts, while the stale-string check reads the whole file. §1–§5, §10 and the last section are current and are held to the tree.
  The intro says the same in words: §14 is the phase in progress, §13 the last release.
- **D-669 — What counts as a path claim.**
  (P3; D-650.) A backticked token with a `/` under `docs`, `scripts`, `src`, `tests`, `public`, `spike`, `.claude` or `.github` must be a tracked file or a directory holding one; a bare token with a file extension must be the basename of a tracked file, so the README's `catalog.json` and a skill's `Footer.tsx` pass without a path and a `no-such.ts` fails.
  Anything with a glob, a placeholder, a `$`, whitespace or a leading `/` is not a claim (`docs/screenshots/v1-*.png`, `sdd-run/<id>.brief.md`, `/third-party-notices.txt`).
  A document with no claims would pass vacuously, so the test also asserts the rule found more than forty across the set.
  The same reading covers `npm run <x>` against `package.json`'s scripts and `npx tsx scripts/<x>.ts` against the tree.
  The visual-review skill's example names were the first thing the rule caught: `r16-home-1280.png` and two more named captures that never existed, replaced with real files.

### 9.5 v2.2 additions *(FR-SHOW)*

- **Documents are read, not remembered.**
  `tests/docs/accuracy.test.ts` (D-650) resolves every path, script, skill and version the reader-facing documents name against `git ls-files` and `package.json`; a count is allowed only beside its command and commit.
  It joins the `tests/docs` project, off line.
- **Dead code is a CI job.**
  `npm run check:dead` (knip, D-647) runs in `ci.yml`'s `dead-code` job, parallel to `trailers`, outside the ten minutes.
- **Unchanged is measured.**
  The bundle table before and after `P5`, the golden suite, `captures.test.ts` and `npm run e2e` (D-649).
- **The recording run is not a test.**
  The `promo` project is excluded from every other project and from CI; `tests/docs/promo.test.ts` checks the flow list and, when a run has left files, that every flow has its video and stills (D-653).
  Nothing in it asserts what a frame looks like: the file is the owner's to watch.

### 16.18 Delivery of the v2.2 tasks *(V22-1, D-647..D-656)*

The V1-11 rules are unchanged.
Four `P` tasks (§16.12's numbering: the repository's own readiness, not a release) and one `R` (the footer credit, a product change with a requirement), three waves, on `main` after the `v2.1.0` tag.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | P6 — The address: `inyoursky.app` bound by the deploy, named everywhere, the hero regenerated; `/promo` ignored | `docs` (`wrangler.jsonc`, `README.md`'s live URL, `docs/DEPLOY.md`, `docs/RELEASE.md`, `tests/docs/public.test.ts`, `tests/deploy/`, `scripts/readme-hero.ts`, `docs/readme/*.png`, `.gitignore`) | opus | owner (`curl -sI` on both origins after the deploy — D-658) | R100; **Precondition:** `wrangler.jsonc` (the zone, V22-11, is the owner's check) |
| 1 | R102 — The footer credits glyphcss *(the library alone, V22-15)* | `ui` (`Footer.tsx`, the catalogs, `Footer.test.tsx`, `identity.spec.ts`, the footer captures) | opus | owner (Spanish copy, the re-shot captures) | R100 |
| 2 | P3 — The documents made true, the public half named, the reading order to v2.1; the README's glyphcss paragraph | `docs` (`docs/**`, the root documents, `.claude/skills/**`, `tests/docs/accuracy.test.ts`, `hygiene.test.ts`, `public.test.ts`, this plan's §4) | opus | owner (the reading order and the README read cold) | P6, R102 |
| 2 | P4 — The recording run: phone and desktop flows into `promo/` | `ui` (`playwright.config.ts`, `tests/e2e/promo-record.spec.ts`, `tests/docs/promo.test.ts`, `package.json` scripts) | opus | owner (the run on a Mac, the files watched — FR-SHOW-6) | R102 |
| 3 | P5 — The dead code removed, knip in CI | `ui` (touches every lane's directories, alone — D-655) | opus | owner (the bundle table, the clean clone, the tag) | P3, P4 |

No two tasks of a wave name one file.
Wave 1: P6 writes the deploy config, the documents' address, the hero and `.gitignore`; R102 writes the footer, its tests and its captures, and no document.
Wave 2: P3 writes documents and tests under `tests/docs/` (including the README's glyphcss paragraph for FR-SHOW-8, which is why it also depends on R102); P4 writes the Playwright config, the recording spec, `tests/docs/promo.test.ts` and `package.json`'s `scripts`.
P6 goes first because P3's whole job is to make the documents true, so the address has to be settled before P3 reads them, and because `.gitignore`'s `/promo` line has to exist before P3's `hygiene.test.ts` asserts it and before P4 writes into `promo/`.
P4 waits for R102 so the recordings show the credit.

The `docs` lane is in §16.1's table from this plan on (it was used by R43 in v1.1 under D-196 and by the driver's `LANES` since, and never written into the table): it owns `docs/**`, the root documents, `.claude/**`, `tests/docs/**`, `tests/deploy/**`, `wrangler.jsonc` and the README-composing scripts.

**R102 resumed twice** (V22-14, D-681; V22-15): the task's first session built the credit in every form and stopped on FR-HOME-2/3 (`sdd-run/R102.blocked.md` on its branch); its scope is extended with FR-HOME-3 as amended and it is rerun with `--task R102`, which resumes the existing worktree and branch (§16.4 step 2's check) under a fresh brief.
The two-line footer rule is `ui`'s, in `App.module.css` and `layout.ts`, so no lane is crossed.
The second resume (V22-15) drops the author's name and the second link from the credit, removes the second-anchor field from `LinkedText`, re-measures the one-line width per language, re-shoots the footer captures, and reverts the branch's edits to `README.md`, `docs/RELEASE.md` and `tests/docs/public.test.ts` — those are P3's under the amended FR-PUB-4.

**Sessions** (V22-13, D-659): every row above runs on `fable` and is reviewed on `opus`, with `Turns: 500` and `Fallback: off` on each entry; the `Model` column's `opus` is superseded by the entries, which are what the driver reads.

**Decision block** (§16.2): **P6 takes D-660..D-662, R102 D-663..D-666, P3 D-667..D-670, P4 D-671..D-674, P5 D-675..D-680**.
D-647..D-659 are this plan's.

**Preconditions a driver run must check:** P6 needs the `inyoursky.app` zone active in the Cloudflare account (V22-11) — the driver cannot check a zone, so the owner confirms it before the first `--wave` and the task's `Precondition:` line names it as the file-shaped stand-in `wrangler.jsonc` on `origin/main`, which exists; the real check is the owner's.
P5's `Precondition:` is `knip.json` on `origin/main`, which the owner's install commit adds empty beside the dependency (D-647); the driver skips P5 until it exists.
P4's gate is the owner's Mac; P5 does not wait on it, only on the merge.

What each session reads (D-284's rule): all of them SPEC §4.43, §4.44, §9 Phase 2i, §12 V22-1..V22-11, PLAN §2.36 and this section.
P6: SPEC §4.44, FR-PUB-1, FR-PUB-2, FR-PUB-11; PLAN §2.5 (D-12 as amended, the rename), §11's header block, D-370, D-658; `docs/DEPLOY.md` whole.
P3: SPEC §4.24 (FR-PUB-1..13), `docs/HOW-THIS-WAS-BUILT.md` whole, PLAN §4 whole and §16.2..§16.6 (the process it documents), D-368, D-650, D-651.
R102: SPEC FR-X-2 as amended, FR-SHOW-8, FR-COMP-4; PLAN D-120, D-548, D-657; `tests/e2e/captureSet.ts`, `tests/e2e/identity.spec.ts`.
P4: `tests/e2e/v1-captures.spec.ts` and `tests/e2e/captureSet.ts` whole, `playwright.config.ts`, `tests/docs/hygiene.test.ts`, D-652..D-654.
P5: the knip report in SPEC §4.43's audit, D-647..D-649, §11's budget table, `tests/docs/captures.test.ts`.
No session reads the three documents whole.
