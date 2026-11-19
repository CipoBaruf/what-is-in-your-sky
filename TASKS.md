# What Is In Your Sky Right Now — Task Breakdown

## Status

This file holds the open phase, v2.16; each closed phase's tasks are in its folder, moved byte for byte (FR-SDD-3).
Each phase's header rows (status, inputs, scope) are in [`docs/sdd/reference/breakdown-inputs.md`](docs/sdd/reference/breakdown-inputs.md).

| Phase | First … last task | Merged | File |
|---|---|---|---|
| mvp | R1 … H | 16 of 16 | [tasks.md](docs/sdd/phases/mvp/tasks.md) |
| v1 | R16 … R36 | 21 of 21 | [tasks.md](docs/sdd/phases/v1/tasks.md) |
| v1.1 | R37 … R55 | 19 of 19 | [tasks.md](docs/sdd/phases/v1.1/tasks.md) |
| v1.2 | R56 … R60 | 6 of 6 | [tasks.md](docs/sdd/phases/v1.2/tasks.md) |
| v1.3 | R62 … R65 | 5 of 5 | [tasks.md](docs/sdd/phases/v1.3/tasks.md) |
| v1.3.2 | P1 … P2 | 2 of 2 | [tasks.md](docs/sdd/phases/v1.3.2/tasks.md) |
| v1.4 | R67 … R72 | 7 of 7 | [tasks.md](docs/sdd/phases/v1.4/tasks.md) |
| v2.0 | R74 … R80 | 9 of 9 | [tasks.md](docs/sdd/phases/v2.0/tasks.md) |
| v2.1 | R83 … R100 | 19 of 19 | [tasks.md](docs/sdd/phases/v2.1/tasks.md) |
| v2.2 | P6 … P5 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.2/tasks.md) |
| v2.2.1 | P7 … P9 | 3 of 3 | [tasks.md](docs/sdd/phases/v2.2.1/tasks.md) |
| v2.3 | R103 … R110 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.3/tasks.md) |
| v2.4 | R111 … R118 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.4/tasks.md) |
| v2.5 | R119 … R128 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.5/tasks.md) |
| v2.6 | R129 … R135 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.6/tasks.md) |
| v2.6.1 | R137 … R140 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.6.1/tasks.md) |
| v2.7 | R141 … R145 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.7/tasks.md) |
| v2.8 | R146 … R149 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.8/tasks.md) |
| v2.9 | R150 … R153 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.9/tasks.md) |
| v2.10 | R154 … R161 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.10/tasks.md) |
| v2.11 | R162 … R165 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.11/tasks.md) |
| v2.12 | R167 … R171 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.12/tasks.md) |
| v2.13 | R172 … R181 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.13/tasks.md) |
| v2.14 | R182 … R191 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.14/tasks.md) |
| v2.14.2 | R192 | 1 of 1 | [tasks.md](docs/sdd/phases/v2.14.2/tasks.md) |
| v2.15 | R193 … R197 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.15/tasks.md) |
| v2.16 | R198 … R205 | 0 of 8 | this file |

## v2.16 tasks

Cut 2026-11-19 from the phase folder `docs/sdd/phases/v2.16/` (`spec.md` §2.23, §4.59, §4.60, Phase 2y; `plan.md` §2.54, §9.18, §11.10, §16.37).
Spec Phase 2y, "an answer first": a first visit opens on tonight's next pass for the time zone's city, labelled as an example, with one action to set a place and the place question as the fallback; CI answers within 8 minutes and the capture set is green again (V216-1..V216-18).
Delivery is PLAN §16.37: eight tasks in four waves, each built by a sub-agent in its own worktree and merged into the phase branch on green checks; the CI tasks R204 and R205 merge before R202 takes the first captures.
Decision blocks (§16.2): R198 D-1184..D-1187, R199 D-1188..D-1189, R200 D-1190..D-1194, R201 D-1195..D-1197, R202 D-1198..D-1204, R203 D-1205..D-1208, R204 D-1217..D-1219, R205 D-1220..D-1223.

- [x] **R198 — A time zone names a city** *(the build test is `tests/data/build-zones.test.ts`, D-1187; the budget row prints once R200 imports the lookup, D-1186)*
  - **Lane:** data
  - **Tier:** standard
  - **Gate:** auto
  - **Depends on:** —
  - **Precondition:** `scripts/data/tz/zone.tab`
  - **Reads:** FR-OPEN-1, FR-LOC-1; D-1173, D-1174; PLAN §11.10; V216-15
  - **Goal:** `npm run build:zones` writes `src/data/zones/zones.txt` from the vendored tz files and `places.txt`, and `loadZoneCity()` turns the browser's zone into `{ name, lat, lon }` or `null` from its own chunk of at most 9 KB gzipped.
  - **Satisfies:** FR-OPEN-1
  - **Scope:** `scripts/build-zones.ts` and `scripts/build-zones.test.ts` with a fixture of `zone.tab`, `zone1970.tab` and `backward` rows (D-1173); `src/data/zones/zones.txt` (generated, committed), `src/data/zones/zoneCity.ts` and `zoneCity.test.ts` (D-1174); `scripts/bundle-budget.ts`'s `ZONE_TABLE_MAX_KB` row; `package.json`'s `build:zones` script.
  - **Touches outside the lane:** `scripts/bundle-budget.ts`
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** calling the lookup at start (R200); any screen.
  - **Done when:** `npm run check` green; `zoneCity.test.ts` covers FR-OPEN-1's verification cases (`Europe/Stockholm` → Stockholm, `Asia/Calcutta`, `Etc/UTC`, `UTC`, unknown, empty, a name from a town and one without); rerunning `npm run build:zones` leaves `zones.txt` unchanged; `npm run bundle:budget` prints the zone row at or under 9 KB and the main row unchanged.

- [x] **R199 — The example's outcome is one pure function**
  - **Lane:** physics
  - **Tier:** light
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-OPEN-4, FR-OPEN-6, FR-FIRST-3; D-1177
  - **Goal:** `exampleOutcome({ city, elements, passes, startedMs, nowMs })` answers `pending`, `pass`, `none`, `no_city`, `failed` or `slow`, and `EXAMPLE_WAIT_MS` is exported at 10 000.
  - **Satisfies:** FR-OPEN-6's rule (the screens are R202's); FR-OPEN-4's wait constant
  - **Scope:** `src/lib/exampleOutcome.ts` and `exampleOutcome.test.ts` (D-1177's pure half; §16.37 gives this file to `physics`).
  - **Touches outside the lane:** `src/lib/exampleOutcome.ts`
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** the latch effect and the timer (R200); the events (R201).
  - **Done when:** `npm run check` green; the test covers each outcome, the wait's edge (one ms either side), a run with a pass only on a later night inside 72 h is `pass`, and a `Failure` from either input is `failed`.

- [x] **R204 — The capture set is green on four runners** *(the first `captures.yml` run on the phase branch is green: D-1219)*
  - **Lane:** ui
  - **Tier:** standard
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-CI-6, FR-CI-2; D-1213, D-1214; `docs/sdd/gotchas.md` (captures)
  - **Goal:** no capture route waits on the follow question or the first-pass dialog, and `captures.yml` shoots the set on four shards and gathers it in one job that checks completeness and commits, within 20 minutes a job.
  - **Satisfies:** FR-CI-6; FR-CI-2 as amended
  - **Scope:** `tests/e2e/captureSeeds.ts` (the seed writes `FOLLOW_ASKED_KEY`; one helper answers the first-pass dialog with `[ stay here ]`, D-1213); the routes of `tests/e2e/v1-captures.spec.ts` that open the wide live page with nothing up call it; `.github/workflows/captures.yml`'s `shoot` matrix (`CAPTURE_SHARDS` 4) and `gather` job, `timeout-minutes` at `CAPTURES_BUDGET_MIN` (D-1214); `tests/docs/ci-graph.test.ts`'s captures half (§16.37 adds these files to `ui`).
  - **Touches outside the lane:** none
  - **Deletes:** none
  - **Captures:** none added; a capture *of* either question keeps shooting it as it is.
  - **Out of scope:** `ci.yml` (R205); this phase's own captures (R202, R203).
  - **Done when:** `npm run check` green; `ci-graph.test.ts` asserts the four shards, the `gather` job's needs and the budget; the v1-captures routes that touched an overlay pass locally once each with no retry; the first `captures.yml` run on the phase branch is green with no retry inside the budget (its link in the decisions block).

- [x] **R200 — The example is a third observer, started on a first visit**
  - **Lane:** data
  - **Tier:** standard
  - **Gate:** auto
  - **Depends on:** R198, R199
  - **Reads:** FR-OPEN-2, FR-OPEN-4, FR-OPEN-6, FR-OPEN-11; D-1175, D-1176, D-1177, D-1183, D-1212; D-538
  - **Goal:** an empty store in a known zone gets the example observer after the first paint, its passes run and its forecast loads unsaved, the outcome latches once, and a reload shows nothing stored; a stored place never imports the zone table.
  - **Satisfies:** FR-OPEN-2; FR-OPEN-4's wait (measured); FR-OPEN-6's latch
  - **Scope:** the location slice's `example`, `setExample`, `activeObserver` order, `setObserver` clearing the example, `exampleOutcome` in the slice (D-1175); the effects' `transient()` gate (no `saveRun`, `persist: false`); the latch effect and its one timer (D-1177); `startApp`'s start in `src/state/index.ts` (D-1176); `playwright.config.ts`'s `timezoneId: 'UTC'` (D-1183); `tests/e2e/exampleWait.spec.ts` under `EXAMPLE_WAIT=1`, its figure in the decisions block and `EXAMPLE_WAIT_MS` changed only as D-1212 says (stop and ask over 10 s).
  - **Touches outside the lane:** `playwright.config.ts`
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** any screen or label (R202, R203); `example_shown` (R201).
  - **Done when:** `npm run check` green; `location.test.ts` covers the order, the clearing and the write-through never holding the example; `effects.test.ts` covers no `saveRun`, `persist: false` and a latch that never moves; the existing first-run e2e specs pass unchanged under `timezoneId: 'UTC'`; `npm run bundle:budget` main row within 1 KB of 2.15.0's.

- [x] **R201 — The events follow the example**
  - **Lane:** physics
  - **Tier:** light
  - **Gate:** auto
  - **Depends on:** R199
  - **Reads:** FR-OPEN-10, FR-MEAS-2 and FR-MEAS-6 as amended, FR-MEAS-5; D-1182, D-1145
  - **Goal:** the closed list carries `example_shown` and `where_shown`'s details and no longer `when_shown` or `what_shown`; `example_shown` is sent once when the outcome latches; `npm run funnel` prints the amended rows.
  - **Satisfies:** FR-MEAS-2 and FR-MEAS-6 as amended; FR-OPEN-10's state half
  - **Scope:** `src/model/measure.ts`'s `EVENTS` and its test; `src/state/measureEffects.ts` and its test (`no_city` sent where `setExample` is skipped); `scripts/funnel.ts` and `tests/deploy/funnel.test.ts` (§16.37 gives this edit to `physics`).
  - **Touches outside the lane:** `src/state/measureEffects.ts`, `scripts/funnel.ts`
  - **Deletes:** the `when_shown` and `what_shown` cases of `measure.test.ts`, `funnel.test.ts` and `tests/deploy/endpoint.test.ts`, rewritten for the new names.
  - **Captures:** none
  - **Out of scope:** `where_shown` from `Home`, the `Home.tsx` calls to the removed names and `measure.spec.ts` (R202).
  - **Done when:** `npm run check` green; `measureEffects.test.ts` asserts `example_shown` once per outcome, never again in that load; `funnel.test.ts` prints FR-MEAS-6's amended rows with the share of first-visit `open` on `home`; the route rejects `when_shown`.

- [x] **R205 — CI by time: checks beside the build, shards cut by duration**
  - **Lane:** ui
  - **Tier:** standard
  - **Gate:** auto
  - **Depends on:** R204
  - **Reads:** FR-CI-4, FR-CI-5, FR-CI-1 as amended; D-1215, D-1216, D-1067
  - **Goal:** a pull request's typecheck, lint and unit suite run in jobs that do not wait for `build`, the e2e shards run e2e only from a duration table, and the whole answers within 8 minutes.
  - **Satisfies:** FR-CI-4, FR-CI-5; FR-CI-1 as amended
  - **Scope:** `.github/workflows/ci.yml`'s `static` and `unit` (`CI_UNIT_SHARDS` 2) jobs, the shards' stages, `CI_PR_BUDGET_MIN` 8 and the `timeout-minutes` (D-1215); `scripts/e2e-shards.ts` with `splitSpecs` and `scripts/e2e-shards.test.ts`; `tests/e2e/durations.json` seeded from the phase's first full run; `npm run e2e:durations` (D-1216); `tests/docs/ci-graph.test.ts`'s ci half.
  - **Touches outside the lane:** `package.json`
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** `captures.yml` (R204); refreshing the table later.
  - **Done when:** `npm run check` green; `e2e-shards.test.ts` covers a table, a missing spec at the median and more shards than specs; `ci-graph.test.ts` asserts `static` and `unit` need no `build` and the shards run no typecheck, lint or unit stage; the task's own full CI run finishes within 8 minutes with a shard spread under 60 s (both in the decisions block).

- [x] **R202 — The first screen is an answer** — done; `usePlaceOpen` is `home/usePlaceOpen.ts`, the fallback captures are the `location` screen, and `promo-record.spec.ts` still walks the steps (D-1198..D-1204).
  - **Lane:** ui
  - **Tier:** hard
  - **Gate:** owner
  - **Depends on:** R200, R201, R205
  - **Reads:** FR-OPEN-3..6, FR-OPEN-8, FR-OPEN-10..14; FR-FIRST-1, FR-FIRST-4, FR-FIRST-7 as amended; FR-FIRST-3, FR-FIRST-5, FR-FIRST-8, FR-GUIDE-2, FR-GUIDE-3, FR-COMP-4; D-1178, D-1179, D-1181, D-1209, D-1210, D-1211; US-60, US-61
  - **Goal:** a first visit at 390 × 844 shows the tagline, the example band and `[ Not there? Set your place ]` with no scroll; on wide the three populated panes for the example; the action opens the place group with `[ back ]`; setting a place lands on the stacked home or the panes with no step between; each fallback cause shows the place question.
  - **Satisfies:** FR-OPEN-3, FR-OPEN-4, FR-OPEN-5, FR-OPEN-6, FR-OPEN-8 (the home's keys), FR-OPEN-10's screen half, FR-OPEN-11 (the home's captures), FR-OPEN-12, FR-OPEN-13, FR-OPEN-14; FR-FIRST-1, FR-FIRST-4, FR-FIRST-7 as amended; US-60 AC1..AC6; US-61 AC1, AC2, AC4
  - **Scope:** `Home`'s first-visit branch and `usePlaceOpen` (D-1178); `src/ui/screens/home/ExampleBand.tsx` and its test, `WhereReading`'s `example` prop (D-1179); the tagline's new words in both catalogs, `HEADER_FOLD_PX` measured again (D-1181); `example.ts` in each catalog; `example.looks`, the `plain` prop and the day line (D-1209..D-1211); `where_shown` with its detail and the removed `when_shown`/`what_shown` calls in `Home`; `tests/e2e/firstRun.spec.ts` (Buenos Aires zone, fixed clock, elements fixture) and `measure.spec.ts`'s walks; FR-OPEN-11's home entries in `v1-captures.spec.ts`.
  - **Touches outside the lane:** none
  - **Deletes:** `StepLine.tsx`, `WhenStep.tsx`, `WhatStep.tsx`, `Steps.module.css`, `WhenStep.clouds.test.tsx`, the steps' cases of `Home.test.tsx`, `Home.measure.test.tsx`, `controlRows.test.ts` and `first-run-controls.spec.ts`; `home/tonight.ts`, `home/useNight.ts` and `lib/moonNote.ts` with their tests where `npm run check:dead` finds nothing else imports them.
  - **Captures:** adds FR-OPEN-11's home set — the example, the wait, the place group from the example and the fallback at 390 × 844 and 360 × 640; the example and the fallback at 1024 × 768 and 1280 × 800; both languages, dark, the example also light, plus the example at noon; removes the first-run step captures; every page's header moves with the tagline (a named move).
  - **Out of scope:** the other pages' line and the live page's branch (R203); the release record.
  - **Done when:** `npm run check` and `npm test` green; `ExampleBand.test.tsx` and `Home.test.tsx` cover FR-OPEN-3..6 and 12..14's component lines; `firstRun.spec.ts` covers US-60 and US-61 at the four sizes in both languages, each fallback cause and the late run; `measure.spec.ts` passes US-61 AC4's, the fallback and the wide walk with the city and coordinates in the forbidden strings; `messages.test.ts` and `controlRows.test.ts` hold the new keys at 360 and 390 px; the owner has compared the captures.

- [x] **R203 — Every page works with the example; 2.16.0** — done; the pages read `usePageObserver` (the store keeps the example after a fallback), the phone's pass and stars pages draw the line under their head, settings shows no place and no line, and the full capture set was compared on seven screens only (D-1205..D-1208).
  - **Lane:** ui
  - **Tier:** standard
  - **Gate:** owner
  - **Depends on:** R202
  - **Reads:** FR-OPEN-7, FR-OPEN-9, FR-OPEN-11; FR-FIRST-1 as amended; D-1180; F-75; `docs/RELEASE.md`
  - **Goal:** from the example, the pass detail, `#live`, `#stars` and the sky screen open for it with `Example: <city>, from your time zone · [ set your place ]` under the header, whose control opens the place group on the home; the live page's "needs a place" shows only with no example; `package.json` reads 2.16.0 with the release record.
  - **Satisfies:** FR-OPEN-7; FR-OPEN-9; FR-OPEN-11 (the pages); the phase's definition of done less the tag and deploy
  - **Scope:** `src/ui/components/common/ExampleNotice.tsx` and its test, drawn in `App.tsx` beside `VisitNotice` (D-1180); the live page's `noPlace` branch reading `activeObserver`; an e2e opening each door and header link from the example at 390 × 844 and 1280 × 800; `package.json` 2.16.0; `docs/sdd/phases/v2.16/release.md` with the moved captures, the bundle rows and the wait figure for the owner's phone; `docs/sdd/map.md` regenerated.
  - **Touches outside the lane:** `src/ui/screens/Live*` (the one branch), `package.json`
  - **Deletes:** none
  - **Captures:** adds the page line on the pass detail, `#live`, `#stars` and the sky screen from the example at 390 × 844 and 1280 × 800, both languages; the release record names every returning-visit capture whose only move is the tagline.
  - **Out of scope:** the tag, the deploy and the phone reading (the owner's).
  - **Done when:** `npm run check` and `npm test` green; `ExampleNotice.test.tsx` and the e2e cover FR-OPEN-7's verification line; `npm run bundle:budget` within 1 KB of 2.15.0 on every row, the zone table in its own row; the owner has compared the captures.

Waves: **wave 1** R198, R199, R204; **wave 2** R200, R201, R205; **wave 3** R202; **wave 4** R203.
