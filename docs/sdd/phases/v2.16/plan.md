# v2.16 — PLAN.md sections

Phase file of PLAN.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.54 v2.16 decisions (2026-11-18)

- **D-1173 — The zones are vendored tzdata, built into a text table.**
  (FR-OPEN-1; V216-2, V216-15.) `scripts/data/tz/zone.tab`, `zone1970.tab` and `backward` are copied unchanged from one tzdata release (public domain), its version on the first line of `scripts/data/tz/README.md`; all three are committed (2026f), because task sessions have no network.
  `scripts/build-zones.ts` (`npm run build:zones`) writes `src/data/zones/zones.txt`: a line `Zone\tΔlat\tΔlon[\tName]` per zone `zone.tab` or `zone1970.tab` lists (0.01° as in `places.txt`, sorted by zone, `zone.tab`'s coordinates first where both list it), and a line `=Alias\tZone` per `backward` link whose alias is not a row and whose target is.
  So `Europe/Stockholm` is its own row at Stockholm, though `backward` links it to `Europe/Berlin`; `Asia/Calcutta` is an alias of `Asia/Kolkata`.
  `Name` is written only where it differs from the zone's last part with `_` as a space.
  It is the spelling of a town of `src/data/places/places.txt` within `ZONE_NAME_MATCH_KM` (50), by `greatCircleKm`, whose name equals the zone's last part with `_` as a space once accents, case and punctuation are ignored (the nearest such town where several match); otherwise the zone's last part as it is (V216-18).
  The output is committed, like `places.txt`, so a build never reads the tz files.
- **D-1174 — The lookup is pure, the table is its own chunk.**
  (FR-OPEN-1.) `src/data/zones/zoneCity.ts` exports `parseZones(text)`, `zoneCity(zone, zones)` → `{ name, lat, lon } | null` and `loadZoneCity()`, which imports `zones.txt?raw` dynamically, as `nearestTown.ts` imports the places.
  `null` for a missing or empty zone, `UTC`, anything under `Etc/` and an unknown name; an alias resolves once, never in a chain.
  `bundle:budget` gains the chunk's row at `ZONE_TABLE_MAX_KB` (9 KB gzipped; a draft of the two files' 418 + 146 rows measured 7.0 KB before names, V216-15).
- **D-1175 — The example is a third observer slot, never written.**
  (FR-OPEN-2; V216-6.) `ObserverSource` gains `'example'`; the location slice gains `example: Observer | null` and `setExample`; `activeObserver` becomes `visiting ?? observer ?? example`, so every page that reads it works for the example with no change of its own (FR-OPEN-7).
  `setObserver` clears `example`; the store's write-through still watches `observer` only (D-538), so nothing writes the example.
  The effects' `visiting()` gate becomes `transient()` — `visiting !== null || observer === null` — so the example, like a visit, never saves its run (`saveRun`) and loads its forecast with `persist: false`.
  A pass opened from the example writes the usual `#pass/…` hash; its share link carries the zone city's coordinates, which are public and are not the visitor's.
- **D-1176 — The example starts after the first paint, only on a first visit.**
  (FR-OPEN-2, FR-OPEN-9.) `startApp`, with no stored observer and no link being visited, awaits `loadZoneCity()` after the first render and calls `setExample` with the city, altitude 0, `timeZone` the zone itself, and `exampleStartedMs` from the injected clock.
  A load with a stored observer never imports the table.
- **D-1212 — The wait is checked against a throttled cold visit.**
  (FR-OPEN-4; V216-15.) R200 adds `tests/e2e/exampleWait.spec.ts`, run only under `EXAMPLE_WAIT=1` like `DOME_PERF`: 390 × 844, empty storage and cache, CDP network at Slow 4G (400 ms latency, 400 kbit/s down) and CPU at 4×, with the elements and forecast served from the fixtures through the throttled route.
  It times the first paint to the latch, best of three (as D-817), and R200 writes the figure in its decisions block.
  `EXAMPLE_WAIT_MS` stays 10 000 unless the figure is under 3 s, when it becomes three times the figure rounded up to the second; over 10 s, R200 stops and asks.
  The release record repeats the reading on the owner's phone.
- **D-1177 — The outcome is one pure function, latched once.**
  (FR-OPEN-4, FR-OPEN-6.) `src/lib/exampleOutcome.ts` exports `EXAMPLE_WAIT_MS` (10 000) and `exampleOutcome({ city, elements, passes, startedMs, nowMs })` → `'pending' | 'pass' | 'none' | 'no_city' | 'failed' | 'slow'`: `failed` from an elements or passes `Failure`, `none` where the finished run has no visible pass (FR-FIRST-3's next-event module returns none), `slow` past the wait.
  A state effect evaluates it on each change and on one timer at `EXAMPLE_WAIT_MS`, and stores the first value that is not `pending` in the slice's `exampleOutcome`; it is never recomputed in that load (FR-OPEN-6's late run).
  The forecast is not part of the outcome: a failed forecast shows FR-FAIL-1's line as for any place.
- **D-1178 — The steps go; the home keeps one first-visit branch.**
  (FR-OPEN-3, FR-OPEN-5, FR-OPEN-6; V216-4.) `Home`'s first-visit test stays `observer === null`; inside it, `pending` and `pass` draw the example, the other outcomes draw the place question.
  `useSteps` becomes `usePlaceOpen` → `{ open, openPlace, back }`, page state as the step was; `StepLine`, `WhenStep`, `WhatStep` and their tests are deleted, and `home/tonight.ts`, `home/useNight.ts` and `lib/moonNote.ts` with them where nothing else imports them (`npm run check:dead` decides).
  The compact place screen keeps FR-FIRST-1's one-screen rule and the one-line footer form; its heading and group are the where step's as they are.
  Setting a place leaves `open` false, so the next render is the stacked home or the panes.
- **D-1179 — The band reuses the first card and the stripe.**
  (FR-OPEN-3, FR-OPEN-4.) `src/ui/screens/home/ExampleBand.tsx` draws the label, FR-FIRST-3's component in its first-card form for the active observer, the stripe of FR-FIRST-8 and the action; in `pending` the card and the stripe hold their height and the line is `example.finding`.
  On wide `WhereReading` takes `example?: { name, onSetPlace }` and draws the label and the action in place of the place line and `[ change ]`; the When and What panes are the populated ones for the active observer.
  No dome is drawn on compact: the stripe is the band's picture (the owner's open item 1, taken at its default).
- **D-1180 — The page line sits beside the visit notice.**
  (FR-OPEN-7.) `src/ui/components/common/ExampleNotice.tsx` is drawn by `App.tsx` where `VisitNotice` is, with the same `Line` primitive, while `observer === null && example !== null`, on every route but the home.
  Its control calls `requestPlace()` (`home/placeRequest.ts`, F-75's existing way back) and opens the home, which opens the place group.
  The live page's `noPlace` branch reads `activeObserver`, so it is reached only with no example.
- **D-1181 — The tagline is the existing key with new words.**
  (FR-OPEN-8; V216-8.) The header's `tagline` keeps its key in `ui.ts` and takes the new text in both languages, and the compact home reads the same key; FR-OPEN-8's `home.tagline` is that key.
  `HEADER_FOLD_PX` is measured again for the shorter text, as R129 measured it.
  The new keys `example.label`, `example.setPlace`, `example.finding`, `example.back` and `example.pageLine` go in a new `example.ts` in each catalog.
- **D-1182 — The closed list changes in one file, both sides with it.**
  (FR-OPEN-10; V216-7.) `src/model/measure.ts`'s `EVENTS` gains `example_shown: ['pass', 'none', 'no_city', 'failed', 'slow']` and `where_shown: ['example', 'fallback']`, and loses `when_shown` and `what_shown`; the route imports the same file (D-1145), so one deploy carries both sides.
  `example_shown` is sent by `measureEffects` when `exampleOutcome` latches (`no_city` included, sent where `setExample` is skipped); `where_shown` by `Home` when the place group shows, its detail from the outcome.
  `scripts/funnel.ts`'s rows follow FR-MEAS-6 as amended; the share's base is first-visit `open` with `home`.
- **D-1183 — The e2e suite runs in UTC unless a test names a zone.**
  (FR-OPEN-11.) `playwright.config.ts` sets `timezoneId: 'UTC'`, which is what CI's runners already are, so every existing first-run spec sees the fallback on the Mac as on CI; a spec of the example sets `test.use({ timezoneId: 'America/Argentina/Buenos_Aires' })` and seeds the elements fixture and a fixed clock.

- **D-1188 — The wait is closed at its end, and a late run is slow.**
  (FR-OPEN-4, FR-OPEN-6.) `exampleOutcome` answers `slow` from `nowMs - startedMs >= EXAMPLE_WAIT_MS`, so the timer R200 arms at exactly `EXAMPLE_WAIT_MS` latches `slow` rather than finding `pending` again; one ms earlier it is `pending`.
  A run that finishes at or after the wait is `slow` too, not `pass` or `none` (FR-OPEN-6: not ready inside the wait). A `Failure`, and no city, outrank the clock.

- **D-1189 — The inputs are the slice's values, and `none` is `nextEvent`'s.**
  (FR-OPEN-6, FR-FIRST-3.) `city` is an object or null, `elements` a `Failure` or null (null while loading or loaded), `passes` the finished run's `Pass[]`, a `Failure`, or null until finished; the function reads no store and no clock.
  `src/lib` may not import `src/state` (PLAN §3), so the failure inputs are typed by `FailureLike` (`{ kind, detail }`), which `state/failure`'s `Failure` satisfies.
  `none` is `isNoEvent(nextEvent(passes, nowMs))`, so a pass already over at `nowMs` does not count and a pass on a later night inside the 72 h does.

- **D-1209 — The look line is one catalog function.**
  (FR-OPEN-12; V216-12.) `example.looks(minutes)` in both catalogs, `minutes` = `max(1, round(durationS / 60))` computed by the band from the pass, never by the catalog.
- **D-1210 — The plain words are a prop, not a second component.**
  (FR-OPEN-13; V216-13.) The next-event block, the one-line card and the Satellites door take `plain?: boolean`, set by `Home` while `observer === null`; under it the path line takes `elevationPhrase(elevationBand(peakDeg))` from `lib/phrases.ts` in place of the degrees, and the brightness phrase drops its magnitude.
  `ElevationBand`'s thresholds are FR-GUIDE-2's as they are; nothing new is measured.
- **D-1211 — The day test reads the stripe's band at now.**
  (FR-OPEN-14; V216-14.) The band and the Where pane already hold tonight's bands for the stripe (`lib/tonightStripe.ts`); the line is drawn where the band holding `nowMs` is `day`, so the stripe and the line can never disagree.
- **D-1213 — The capture routes answer the two questions.**
  (FR-CI-6; V216-17.) `tests/e2e/captureSeeds.ts`'s seed writes `FOLLOW_ASKED_KEY` (`useFollow.ts`), so the phone's follow question never opens; a route that opens the wide live page with nothing up answers the first-pass dialog with `[ stay here ]` (its `Esc`) before its first click, through one helper in `captureSeeds.ts`.
  A capture *of* either question seeds nothing and shoots it as it is.
- **D-1214 — The capture set shoots on four runners and commits once.**
  (FR-CI-6, FR-CI-2.) `captures.yml`'s `captures` job becomes a `shoot` matrix of `CAPTURE_SHARDS` (4) running `playwright test v1-captures --shard=<n>/4`, each uploading its files, and a `gather` job that downloads them over the restored set, runs the completeness check, the diff and the commit, as the one job does now.
  The design captures run in `gather`; `timeout-minutes` is `CAPTURES_BUDGET_MIN` (20) per job.
- **D-1215 — One static job, two unit shards, e2e only on the shards.**
  (FR-CI-4, FR-CI-1.) `ci.yml` gains `static` (typecheck, lint; needs `changes` only) and `unit` (matrix of `CI_UNIT_SHARDS`, `vitest --shard=<n>/2`, or `vitest related` on one shard when the selection is partial); the `ci` shards drop their shard-1 stages.
  Each new job writes its report to `reports/` for `digest` as shard 1 did (D-1067); `CI_PR_BUDGET_MIN` becomes 8 and every job's `timeout-minutes` follows it.
- **D-1216 — The shards are cut from a committed duration table.**
  (FR-CI-5.) `tests/e2e/durations.json` maps each spec to its seconds on a full run; `scripts/e2e-shards.ts` (pure `splitSpecs(specs, table, n)`, longest first into the lightest shard, the median for a missing spec) prints shard `<n>`'s spec list, which the shard passes to `playwright test` in place of `--shard`.
  `npm run e2e:durations <report.json>` rewrites the table from a run's JSON report; R205 seeds it from the phase's first full run, and a later task refreshes it when the spread passes `CI_SHARD_SPREAD_S`.
  The env flag that keeps skipped capture tests out of the count (`playwright.config.ts`) stays for local `--shard`.

### 9.18 v2.16 additions *(FR-OPEN)*

- **Pure.** `scripts/build-zones.test.ts` (a fixture of `zone.tab`, `zone1970.tab` and `backward` rows: a merged zone kept at its own city, an alias kept and an alias dropped because it is a row, a name from a town and one without), `src/data/zones/zoneCity.test.ts` (FR-OPEN-1's cases), `src/lib/exampleOutcome.test.ts` (each outcome, the wait's edge, a pass inside 72 h on a later night is `pass`).
- **State.** `location.test.ts`: `activeObserver`'s order, `setObserver` clearing the example, the example never in the write-through; `effects.test.ts`: no `saveRun` and `persist: false` under the example; the latch never moves; `measureEffects.test.ts`: `example_shown` once per outcome.
- **Components.** `ExampleBand.test.tsx` (blocks, the card as a control, the waiting state), `ExampleNotice.test.tsx`, `Home.test.tsx` re-pointed from the steps to the band and the place screen; `messages.test.ts` and `controlRows.test.ts` for the new keys; `breakpoint.test.ts`'s `HEADER_FOLD_PX` row.
- **End to end.** `firstRun.spec.ts`: US-60 and US-61 at 390 × 844, 360 × 640, 1024 × 768 and 1280 × 800 in both languages; each fallback cause; the late run; storage and hosts after the example (FR-OPEN-2). `measure.spec.ts`: US-61 AC4's walk, the fallback walk, the wide walk, the zone city in the forbidden strings.
- **CI.** `scripts/e2e-shards.test.ts` (FR-CI-5's cases); `tests/docs/ci-graph.test.ts` reads `ci.yml` and `captures.yml`: `static` and `unit` need no `build`, the shards run no typecheck, lint or unit stage, the budgets and shard counts are the constants (FR-CI-4, FR-CI-6).
- **Captures.** FR-OPEN-11's set; every page's header moves with the tagline (FR-OPEN-9), a named move; the first-run step captures leave the set.

### 11.10 v2.16 build *(FR-OPEN-1)*

`npm run build:zones` regenerates `src/data/zones/zones.txt` from the vendored tz files and `places.txt`; it is run by hand when either changes, like `build:places`, and the output is committed.
The tz files are public domain (tzdata's own notice), about 45 KB in the repository and none of it shipped: the shipped table is at most 9 KB gzipped in its own chunk, loaded only on a first visit.
No npm dependency is added and no host is added to the CSP.

### 16.37 v2.16 delivery

Eight tasks in four waves, each built by a sub-agent in its own worktree and merged into the phase branch when its checks are green; one pull request for the phase when the owner asks for it.
v2.15 shipped as 2.15.0 before the breakdown, so no task waits on it (V216-16); the phase branch is rebased onto `main` and each wave starts from the branch with the wave before it merged.
The driver runs one task per lane at a time, so R199 and R201, both `physics`, sit in different waves.
The CI tasks are `ui` (§16.1 gives it `.github/workflows/**` and `tests/e2e/v1-captures.spec.ts`), which waves 1 and 2 leave free, so they cost no wave of their own and are merged before R202 takes the first captures (V216-17); this phase adds `tests/e2e/captureSeeds.ts`, `tests/e2e/durations.json`, `scripts/e2e-shards.ts` and `tests/docs/ci-graph.test.ts` to `ui`.
The Lane column is §16.1's; this phase adds `scripts/build-zones.ts` and `scripts/data/tz/**` to `data`, `src/lib/exampleOutcome.ts` to `physics`, and gives `physics` R201's `scripts/funnel.ts` edit because the change starts in `src/model/measure.ts`.
Precondition for R198: the three tz files and their README are committed (D-1173), as they are.

| Wave | Task | Lane | Tier | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R198 — The zone table: `scripts/build-zones.ts`, `src/data/zones/**`, the budget row (D-1173, D-1174) | `data` | standard | auto | — |
| 1 | R204 — The capture set green on four runners: `captureSeeds.ts`, `v1-captures.spec.ts`, `captures.yml` (D-1213, D-1214) | `ui` | standard | auto | — |
| 1 | R199 — The outcome: `src/lib/exampleOutcome.ts` and its test (D-1177's pure half) | `physics` | light | auto | — |
| 2 | R200 — The example observer: the location slice, `transient()`, the latch effect, `startApp`'s start, `playwright.config.ts`'s zone, the wait's measurement (D-1175..D-1177, D-1183, D-1212) | `data` | standard | auto | R198, R199 |
| 2 | R201 — The events: `model/measure.ts`, `measureEffects`, `scripts/funnel.ts` and their tests (D-1182 less `Home`) | `physics` | light | auto | R199 (lane) |
| 2 | R205 — CI by time: `ci.yml`'s `static` and `unit` jobs, `scripts/e2e-shards.ts`, the duration table, `CI_PR_BUDGET_MIN` 8 (D-1215, D-1216) | `ui` | standard | auto | R204 (lane) |
| 3 | R202 — The first screen: `Home`, `ExampleBand`, `WhereReading`, the place screen, the steps deleted, the words, `where_shown`, `firstRun.spec.ts` (D-1178, D-1179, D-1181, D-1209..D-1211) | `ui` | hard | owner (captures) | R200, R201, R205 |
| 4 | R203 — The pages and 2.16.0: `ExampleNotice`, the live page's branch, the captures, `package.json`, the release record (D-1180) | `ui` | standard | owner (captures) | R202 |

Decision blocks: R198 D-1184..D-1187, R199 D-1188..D-1189, R200 D-1190..D-1194, R201 D-1195..D-1197, R202 D-1198..D-1204, R203 D-1205..D-1208, R204 D-1217..D-1219, R205 D-1220..D-1223.
Budget: the main chunk grows by at most 1 KB gzipped against 2.15.0; the zone table is a new chunk of at most 9 KB; the home chunk may shrink by the deleted steps.
R204 and R205 are `standard`: workflow and test-harness edits checked by the phase's own runs, and R204's first green capture run on `main` is its proof.
R202 is `hard` because it rewrites the home's first-visit branch across two layouts and two languages against a fold rule; the rest are a table, a slice and a list.
