# v2.16 — PLAN.md sections

Phase file of PLAN.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.54 v2.16 decisions (2026-11-18)

- **D-1173 — The zones are vendored tzdata, built into a text table.**
  (FR-OPEN-1; V216-2.) `scripts/data/tz/zone1970.tab` and `scripts/data/tz/backward` are copied unchanged from one tzdata release (public domain), its version on the first line of `scripts/data/tz/README.md`; they are committed before R198 starts, because task sessions have no network.
  `scripts/build-zones.ts` (`npm run build:zones`) writes `src/data/zones/zones.txt`: a line `Zone\tName\tΔlat\tΔlon` per canonical zone (0.01° as in `places.txt`) and a line `=Alias\tZone` per `backward` link whose target is in the table.
  `Name` is the nearest town of `src/data/places/places.txt` within `ZONE_NAME_MATCH_KM` (50), by `greatCircleKm`; otherwise the zone's last part with `_` as a space.
  The output is committed, like `places.txt`, so a build never reads the tz files.
- **D-1174 — The lookup is pure, the table is its own chunk.**
  (FR-OPEN-1.) `src/data/zones/zoneCity.ts` exports `parseZones(text)`, `zoneCity(zone, zones)` → `{ name, lat, lon } | null` and `loadZoneCity()`, which imports `zones.txt?raw` dynamically, as `nearestTown.ts` imports the places.
  `null` for a missing or empty zone, `UTC`, anything under `Etc/` and an unknown name; an alias resolves once, never in a chain.
  `bundle:budget` gains the chunk's row at `ZONE_TABLE_MAX_KB` (6 KB gzipped).
- **D-1175 — The example is a third observer slot, never written.**
  (FR-OPEN-2; V216-6.) `ObserverSource` gains `'example'`; the location slice gains `example: Observer | null` and `setExample`; `activeObserver` becomes `visiting ?? observer ?? example`, so every page that reads it works for the example with no change of its own (FR-OPEN-7).
  `setObserver` clears `example`; the store's write-through still watches `observer` only (D-538), so nothing writes the example.
  The effects' `visiting()` gate becomes `transient()` — `visiting !== null || observer === null` — so the example, like a visit, never saves its run (`saveRun`) and loads its forecast with `persist: false`.
  A pass opened from the example writes the usual `#pass/…` hash; its share link carries the zone city's coordinates, which are public and are not the visitor's.
- **D-1176 — The example starts after the first paint, only on a first visit.**
  (FR-OPEN-2, FR-OPEN-9.) `startApp`, with no stored observer and no link being visited, awaits `loadZoneCity()` after the first render and calls `setExample` with the city, altitude 0, `timeZone` the zone itself, and `exampleStartedMs` from the injected clock.
  A load with a stored observer never imports the table.
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

- **D-1209 — The look line is one catalog function.**
  (FR-OPEN-12; V216-12.) `example.looks(minutes)` in both catalogs, `minutes` = `max(1, round(durationS / 60))` computed by the band from the pass, never by the catalog.
- **D-1210 — The plain words are a prop, not a second component.**
  (FR-OPEN-13; V216-13.) The next-event block, the one-line card and the Satellites door take `plain?: boolean`, set by `Home` while `observer === null`; under it the path line takes `elevationPhrase(elevationBand(peakDeg))` from `lib/phrases.ts` in place of the degrees, and the brightness phrase drops its magnitude.
  `ElevationBand`'s thresholds are FR-GUIDE-2's as they are; nothing new is measured.
- **D-1211 — The day test reads the stripe's band at now.**
  (FR-OPEN-14; V216-14.) The band and the Where pane already hold tonight's bands for the stripe (`lib/tonightStripe.ts`); the line is drawn where the band holding `nowMs` is `day`, so the stripe and the line can never disagree.

### 9.18 v2.16 additions *(FR-OPEN)*

- **Pure.** `scripts/build-zones.test.ts` (a fixture of `zone1970.tab` and `backward` rows, a name from a town and one without), `src/data/zones/zoneCity.test.ts` (FR-OPEN-1's cases), `src/lib/exampleOutcome.test.ts` (each outcome, the wait's edge, a pass inside 72 h on a later night is `pass`).
- **State.** `location.test.ts`: `activeObserver`'s order, `setObserver` clearing the example, the example never in the write-through; `effects.test.ts`: no `saveRun` and `persist: false` under the example; the latch never moves; `measureEffects.test.ts`: `example_shown` once per outcome.
- **Components.** `ExampleBand.test.tsx` (blocks, the card as a control, the waiting state), `ExampleNotice.test.tsx`, `Home.test.tsx` re-pointed from the steps to the band and the place screen; `messages.test.ts` and `controlRows.test.ts` for the new keys; `breakpoint.test.ts`'s `HEADER_FOLD_PX` row.
- **End to end.** `firstRun.spec.ts`: US-60 and US-61 at 390 × 844, 360 × 640, 1024 × 768 and 1280 × 800 in both languages; each fallback cause; the late run; storage and hosts after the example (FR-OPEN-2). `measure.spec.ts`: US-61 AC4's walk, the fallback walk, the wide walk, the zone city in the forbidden strings.
- **Captures.** FR-OPEN-11's set; every page's header moves with the tagline (FR-OPEN-9), a named move; the first-run step captures leave the set.

### 11.10 v2.16 build *(FR-OPEN-1)*

`npm run build:zones` regenerates `src/data/zones/zones.txt` from the vendored tz files and `places.txt`; it is run by hand when either changes, like `build:places`, and the output is committed.
The tz files are public domain (tzdata's own notice), about 25 KB in the repository and none of it shipped: the shipped table is at most 6 KB gzipped in its own chunk, loaded only on a first visit.
No npm dependency is added and no host is added to the CSP.

### 16.37 v2.16 delivery

Six tasks in four waves, each built by a sub-agent in its own worktree and merged into the phase branch when its checks are green; one pull request for the phase when the owner asks for it.
Wave 1 runs alongside v2.15: it adds files of its own and touches none of v2.15's (V216-10).
Wave 2 starts once v2.15's R196 has merged, from the merged branch.
The Lane column is §16.1's; this phase adds `scripts/build-zones.ts` and `scripts/data/tz/**` to `data`, `src/lib/exampleOutcome.ts` to `physics`, and gives `physics` R201's `scripts/funnel.ts` edit because the change starts in `src/model/measure.ts`.
Precondition for R198: the two tz files and their README are committed (D-1173).

| Wave | Task | Lane | Tier | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R198 — The zone table: `scripts/build-zones.ts`, `src/data/zones/**`, the budget row (D-1173, D-1174) | `data` | standard | auto | the tz files |
| 1 | R199 — The outcome: `src/lib/exampleOutcome.ts` and its test (D-1177's pure half) | `physics` | light | auto | — |
| 2 | R200 — The example observer: the location slice, `transient()`, the latch effect, `startApp`'s start, `playwright.config.ts`'s zone (D-1175..D-1177, D-1183) | `data` | standard | auto | R198, R199, v2.15 R196 |
| 2 | R201 — The events: `model/measure.ts`, `measureEffects`, `scripts/funnel.ts` and their tests (D-1182 less `Home`) | `physics` | light | auto | v2.15 R196 |
| 3 | R202 — The first screen: `Home`, `ExampleBand`, `WhereReading`, the place screen, the steps deleted, the words, `where_shown`, `firstRun.spec.ts` (D-1178, D-1179, D-1181, D-1209..D-1211) | `ui` | hard | owner (captures) | R200, R201 |
| 4 | R203 — The pages and 2.16.0: `ExampleNotice`, the live page's branch, the captures, `package.json`, the release record (D-1180) | `ui` | standard | owner (captures) | R202 |

Decision blocks: R198 D-1184..D-1187, R199 D-1188..D-1189, R200 D-1190..D-1194, R201 D-1195..D-1197, R202 D-1198..D-1204, R203 D-1205..D-1208.
Budget: the main chunk grows by at most 1 KB gzipped against 2.15.0; the zone table is a new chunk of at most 6 KB; the home chunk may shrink by the deleted steps.
R202 is `hard` because it rewrites the home's first-visit branch across two layouts and two languages against a fold rule; the rest are a table, a slice and a list.
