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
- **D-1184 — The table's Δ runs from the row before, under one source line.** *(R198)*
  (D-1173.) As in `places.txt`, `Δlat` and `Δlon` are the difference in 0.01° from the row before, from 0, 0 at the first row, rows sorted by zone; the file opens with one `#` line naming the tzdata release (the README's first line) and the format, which `parseZones` skips.
  2026f gives 418 rows and 131 aliases, 15.3 KB raw, 6.6 KB gzipped.
- **D-1185 — Names fold by NFD, no marks, lower case, letters and digits only.** *(R198)*
  (FR-OPEN-1, V216-18.) `foldName` in `scripts/build-zones.ts` is the "accents, case and punctuation ignored" of the rule, so `St_Johns` matches `St. John's` and `Urumqi` matches `Ürümqi`; 23 of the 418 zones take a town's spelling, and no district names a zone.
- **D-1186 — The zone row is a phase row, measured with a temporary import.** *(R198)*
  (D-1174.) The row is `zones` in `PHASE_BUDGETS`, matching `zones-*.js`, at `ZONE_TABLE_MAX_KB` (9); 6.6 KB (6,760 bytes) on a build with `loadZoneCity()` imported for the measure only, the main row unchanged.
  Until R200 imports `loadZoneCity` no chunk matches and `bundle:budget` warns the row missing — the accepted caveat; the release task moves it into `BUDGETS` with its measure.
- **D-1187 — The build's test sits in `tests/data/`.** *(R198)*
  (D-1173.) Vitest's `node` project includes `src/**` and `tests/**`, not `scripts/**`, so `scripts/build-zones.test.ts` would never run; the test is `tests/data/build-zones.test.ts` (the data lane), its fixture inline, with a district at Paris's coordinates that must not win.
  "A rerun leaves `zones.txt` unchanged" is a test there: the vendored files build the committed table byte for byte.

- **D-1188 — The wait is closed at its end, and a late run is slow.**
  (FR-OPEN-4, FR-OPEN-6.) `exampleOutcome` answers `slow` from `nowMs - startedMs >= EXAMPLE_WAIT_MS`, so the timer R200 arms at exactly `EXAMPLE_WAIT_MS` latches `slow` rather than finding `pending` again; one ms earlier it is `pending`.
  A run that finishes at or after the wait is `slow` too, not `pass` or `none` (FR-OPEN-6: not ready inside the wait). A `Failure`, and no city, outrank the clock.

- **D-1189 — The inputs are the slice's values, and `none` is `nextEvent`'s.**
  (FR-OPEN-6, FR-FIRST-3.) `city` is an object or null, `elements` a `Failure` or null (null while loading or loaded), `passes` the finished run's `Pass[]`, a `Failure`, or null until finished; the function reads no store and no clock.
  `src/lib` may not import `src/state` (PLAN §3), so the failure inputs are typed by `FailureLike` (`{ kind, detail }`), which `state/failure`'s `Failure` satisfies.
  `none` is `isNoEvent(nextEvent(passes, nowMs))`, so a pass already over at `nowMs` does not count and a pass on a later night inside the 72 h does.

- **D-1190 — The slice holds `example`, `exampleStartedMs` and `exampleOutcome`, which starts `pending`.** *(R200)*
  (D-1175, D-1195.) `exampleOutcome: ExampleOutcome` is `'pending'` until `latchExampleOutcome` stores the first other value; a second call changes nothing, and `setObserver` drops `example` but keeps the outcome, so nothing recomputes it in that load. R201's cast in `measureEffects.ts` is dropped.
  `setExample(observer, startedMs)` is ignored while a place is set or visited, and sets `nowMs` to `startedMs`, the search window's start.
  `ObserverSource` gains `'example'` in `src/model/observer.ts` (outside the lane, the one word D-1175 names); its two exhaustive readers follow: `measureEffects`'s `place_set` returns on it (the example is never `observer`) and `WherePlace`'s sentence reads it as a named place until R202 gives it its own line.
- **D-1191 — The latch reads only the example's own finished run, on one timer.** *(R200)*
  (D-1177, D-1188.) `startEffects` asks `exampleOutcome` while `example` is the active observer and the outcome is `pending`: `elements` is the slice's failure when its status is `error`, `passes` the run only when the slice's observer is the example's — `passes.error` when failed, `passes.passes` when done and not a stored run, null otherwise.
  The timer is armed once, at `exampleStartedMs + EXAMPLE_WAIT_MS` by the effects' clock. A place set before the outcome stops it and leaves `pending`, so a reader who answered the question during the wait sends no `example_shown`.
  `transient()` is `visiting !== null || observer === null`, as D-1175 has it.
- **D-1192 — The start is a frame then a task, and a place set during the lookup wins.** *(R200)*
  (D-1176.) `startApp` checks `activeObserver` after the restore and the link; with none it waits for `requestAnimationFrame` then `setTimeout(0)` (the measure sender's own "after the paint") before importing the table, and checks again when the city arrives. The observer's `timeZone` is `Intl`'s zone, its label the city's name.
  A table chunk that fails to load latches `no_city`, as no city does. Overrides `loadZoneCity` and `afterPaint` are the test seam.
  Because `activeObserver` includes the example, a `#pass/…` hash the example writes is "the place on screen" to `applyLink` and is not adopted as a stored place; a pasted link for exactly the zone city's coordinates is not adopted either, an accepted edge.
- **D-1193 — The throttled wait is 3.25 s; `EXAMPLE_WAIT_MS` stays 10 000.** *(R200)*
  (D-1212, V216-15.) `exampleWait.spec.ts` on Apple silicon with Google Chrome (`channel: 'chrome'`), 2026-11-19: 3.25, 3.38 and 3.67 s, best 3.25 s, each outcome `pass`; a second sitting read 3.81, 3.86 and 3.89 s. Not under 3 s, so the constant is unchanged.
  The app's own files are throttled by CDP; a fulfilled route skips the browser's emulation, so the elements and the forecast are delayed by hand by 400 ms plus their gzipped size at 400 kbit/s. The first contentful paint is read by a `PerformanceObserver` added before `page.clock.install` (which fakes `performance`), and the latch is timed at the `example_shown` beacon.
  The spec skips with `test.skip(process.env['EXAMPLE_WAIT'] !== '1', …)` but is not in `playwright.config.ts`'s `GATE`: `tests/docs/ci.test.ts` pins that list to `CAPTURES` and `DOME_PERF`, so CI carries one skipped test.
- **D-1194 — The zone row prints: 6.6 KB; the main row is +0.9 KB.** *(R200)*
  (D-1186, FR-OPEN-1.) With `loadZoneCity` imported by `startApp`, `zones-*.js` is 6.6 KB gzipped (6,791 bytes) against `ZONE_TABLE_MAX_KB` (9), and the missing-row warning D-1186 accepted is gone.
  The main chunk is 195.8 KB (200,794 bytes) against 194.8 KB (199,845) on the phase branch's tip and 2.15.0, +949 bytes, inside the 1 KB the task allows; it stays over the 185 KB line as 2.15.0 was.

- **D-1195 — `example_shown` is sent once per load, from the latch's first value.** *(R201)*
  (FR-OPEN-10, D-1182, D-1177.) `measureEffects` reads `exampleOutcome` from the flat `AppState` (the slices are merged, so it is `state.exampleOutcome`, not `state.location.exampleOutcome`) and sends `example_shown` with the first value that is not `pending`, checking the state it starts on and every change after; a closure flag makes it once, though the latch never moves.
  `no_city` takes the same path: R200's latch stores it where `setExample` is skipped, so `measureEffects` has no second rule.
  Until R200 lands the field, the read is `(state as { exampleOutcome?: ExampleOutcome }).exampleOutcome` and a missing field is `pending`.
  R200 must name the field `exampleOutcome`, of type `ExampleOutcome` (`'pending'` until the latch), on `AppState`; the cast then stays valid and can be dropped by whoever next edits `measureEffects.ts`. The tests set the field with `store.setState({ exampleOutcome } as never)`.

- **D-1196 — The funnel's base is first-visit `open` on `home`; `where_shown` has no `Home` caller yet.** *(R201)*
  (FR-MEAS-6 as amended, D-1182.) `scripts/funnel.ts` prints `example_shown`, `where_shown`, `place_set` and `door` split by detail and `pass_open`, each with its share of first-visit `open` with detail `home`; the header reads `share of open home`.
  An `open` on `pass`, `live`, `stars` or `settings` by a first visit is not in the base, so it is not a first-run load.

- **D-1197 — `Home.tsx` loses its `when_shown` and `what_shown` calls here, the build's price.** *(R201)*
  Removing the names from `EVENTS` breaks `Home.tsx`'s typecheck (`SHOWN`, and the wide pane count), so R201 deletes those two calls and `SHOWN` (a few lines) and rewrites `Home.measure.test.tsx` to expect `where_shown` only, where the task text left `Home` to R202.
  `where_shown` stays sent as 2.15.0 sent it (no detail, on the where step and the wide cold open); R202 moves it to the place group with its `example` or `fallback` detail, and rewrites `measure.spec.ts`, which still names the removed events and runs only in CI e2e.

- **D-1198 — `usePlaceOpen` is its own module and answers more than three things.** *(R202)*
  (D-1178, D-467; FR-OPEN-5, FR-OPEN-6.) `src/ui/screens/home/usePlaceOpen.ts`, held by `App` as `useSteps` was, returns `open`, `openPlace` and `back`, and with them `showing` (the example is drawn), `fallback`, `asking` (the question is the phone's one screen, which gives the footer its line form), `pending`, and `held` with `settle`:
  a pair typed on the phone's question is the observer at its first valid keystroke, so the screen is held until the field is left, `Enter` or `[ continue ]`, as the where step held it.
  The first-visit test is "no saved and no visited place", read through `src/ui/hooks/useOwnObserver.ts`, because `activeObserver` now answers the example.
  Before the zone's city is known nothing is latched and there is no example: the page holds the example's shape (the band with no words, the action live) rather than flash the question, unless this load has already had a place — a reader who cleared theirs gets the question at once. A zone with no city therefore shows that shape for the frame and the task D-1192 waits.
  `[ back ]` hands the focus to the action it came from; leaving the home for another page closes the question.
- **D-1199 — The example never passes for a place.** *(R202)*
  (FR-OPEN-2, FR-OPEN-4, FR-OPEN-6, D-1179.) The input group's fields, the saved places and `[ Save this place ]` read `useOwnObserver`, so the example's coordinates are in no field and cannot be saved; "its saved places read none" is the saved-places line not drawn while there is none to list.
  The wide example pane keeps the elements line and drops the readiness line, which is about a stored run.
  Under a fallback outcome the example may still be the store's active observer (the latch does not drop it); `Home` draws no reading for it, and `App`'s `data-home` is `cold`. `WhereReading` takes `ask` (the question as a screen: `[ back ]`, the tagline, the held pair) beside D-1179's `example`.
- **D-1200 — The plain words, line by line.** *(R202)*
  (FR-OPEN-12, FR-OPEN-13; D-1209, D-1210.) The elevation phrases are the catalogs' (`ui.ts`), not `lib/phrases.ts`'s: `nextEvent.path(path, plain)` writes the peak as its phrase with no compass point (`NW low → almost overhead → SE`) and a start or end above the threshold as the band's short word;
  `nextEvent.height(band)` hands that short word to the card (`6 min · peak high N · like a bright star`) and to the Satellites door.
  The door's line drops the peak's compass point under `plain` (`Tiangong · almost overhead → ENE`): a word and a point leave a name fewer than its cells in 34, and `fitName` would cut `ISS (Zarya)`.
  The look line's minutes are `passMinutes(pass)` in `NextEventBlock`, the component that holds the pass (D-1209 said the band; the band never sees the pass). `PassCard`'s `detail: 'phrase'` is replaced by `plain`.
  The compass abbreviations stay as the app writes them in both languages (`NW`), where FR-OPEN-13's Spanish example reads `NO`.
- **D-1201 — Where the example's lines stand, and the fold as measured.** *(R202)*
  (FR-OPEN-3, FR-OPEN-4, FR-OPEN-14; D-1179, D-1211.) Compact: the tagline and the band, 0.75 rem apart, over the stacked page; the Where reading under the doors is the label and a bracketed `[ Not there? Set your place ]`. The day line stands in the band between the card and the stripe; on wide in the Where pane under the label.
  On wide the next event returns to the When pane only under the example (FR-OPEN-4, FR-OPEN-12), as its last block with no live link; a set place keeps FR-FIRST-3 as amended v2.6.
  Waiting, the card's place is six `--small` rows, the pane title's row and the card's padding (172 px at 390 px, the fixture's card), the stripe's three 18 px rows, and on wide the next event's block.
  Measured in Google Chrome on the plain build, the fixture clock, zone `America/Argentina/Buenos_Aires`, both languages alike: at 390 × 844 the header ends at 48 px, the tagline 72–120, the band 132–508, the action 447–495; at 360 × 640 the band 132–528 and the action 467–515.
  The label (42 characters and the city) and the look line wrap inside the band; `controlRows.test.ts` holds each to two lines at 390 px and three at 360.
- **D-1202 — `where_shown` is the place group shown on a first visit.** *(R202)*
  (FR-OPEN-10, D-1182.) `Home` counts it when the question is on screen: `example` when the action or a `[ set a place ]` request opens it over the example, `fallback` when the page is the question. A wait that runs out with the group already open counts `fallback` as well; each pair once per load (V215-7). A visit with a place counts nothing here.
  `measure.spec.ts`'s offline case starts from the example, whose page has loaded every chunk the stacked page needs before the connection goes (the service worker is blocked there).
- **D-1203 — The first visit in the capture set: 32 files, nine names.** *(R202)*
  (FR-OPEN-11, FR-FIRST-7 as amended.) `first-example` (390, 1024, 1280; both themes), `first-wait`, `first-place` and `first-noon` (390, dark), and at 360 × 640 the `-short` screens `first-example-short` (both themes), `first-wait-short`, `first-place-short` and `location-short` (dark), D-993's way of naming a second height.
  The fallback is the existing `location` screen (the set runs in UTC), which gains 1024. "The light theme" is the app's second theme, `night`.
  The example's captures run in a describe with `timezoneId: 'America/Argentina/Buenos_Aires'` at the set's instant and at noon seven hours on; the showcase night's forecast answers for the zone city so no file reads "Weather unknown"; the paused clock is ticked until the example lands and then pinned (F-48).
  `r76-captures.spec.ts` and `r84-captures.spec.ts` lose their when and what step cases; the committed `r82-*` and `r84-what-*` images stay as history. The owner's review copies, shot on the Mac, are `docs/screenshots/v2.16-r202/`.
- **D-1204 — The tagline never folds; the main chunk is 181 bytes under 2.15.0.** *(R202)*
  (D-1181, D-1194.) The new words make the wide header's line 70 cells in English and 68 in Spanish, so `HEADER_FOLD_PX` is 675 and 656, both under the wide breakpoint: the tagline shows at every wide width, which moves every home capture at 964–1049 px in Spanish.
  With the steps, `lib/moonNote.ts`, `splitTonight`, the doors' `onWhat`, their catalog keys and `Steps.module.css` gone, `main` is 195.0 KB gzipped (199,664 bytes) against 199,845 on 2.15.0 and 200,794 after R200.
  `tests/e2e/promo-record.spec.ts` still walks the removed steps; it is off every CI path and is left for the next recording.
- **D-1205 — The pages ask whether the example is drawn, not only whether it is the observer.** *(R203)*
  (FR-OPEN-6, FR-OPEN-7, D-1180, D-1199.) The latch keeps the example in the store after a fallback, so `activeObserver` alone would open `#live`, `#stars` and a pass for it.
  `src/ui/hooks/useOwnObserver.ts` adds `usePageObserver()`: the active observer, or `null` when it is the example and the outcome is not `pending` or `pass` (`EXAMPLE_SHOWN`, which `usePlaceOpen` now imports).
  `App`'s observer, the live page's (so its `noPlace` branch is reached with no example or a replaced one) and the stars page's read it; the store is untouched (the smallest change in the `ui` lane, against clearing the example in the `state` slice).
  `ExampleNotice` draws while `usePageObserver()` is the example; it lives in `PageNotices` (`example`, default on; the home passes `false`, its band says the same), so the wide live and pass pages and the phone's live sky (its `fullTop`) carry it with no edit of theirs. The stars page had no strip:
  `App` gives it one with the line alone on wide (`visit={false}`, so a returning visit draws nothing new there, FR-OPEN-9).
  The settings page is not one of FR-OPEN-7's four, so it carries no line; its location section and its header's place read `useOwnObserver`.
  The wide stars page's globe `Place` group reads `useOwnObserver` too (the owner's call, 2026-11-19): under the example it lists no place, and with nothing saved `GlobePlaces` draws nothing, heading and all, as `StarsGroup` draws nothing empty; the page line names the city.
- **D-1206 — On a phone the pass and stars pages draw the line under their head.** *(R203)*
  (FR-OPEN-7, D-1013.) Both are the full form, whose box covers the shell's strip, so `PassDetail` and `StarsPage` draw `ExampleNotice` in their overlay, `--fg-dim`, across the box less `--space-3` each side.
  On the stars page it stands a `--space-1` under the head's target row; on the pass page the corner readout's two `--small` lines already stand there (56–96 px at 390), so the line stands a `--space-1` under them (`3 × --space-1 + --target + 2 × --small-row`, 102 px).
  The wide live page's first-pass question (FR-WIDE-13) opens over the line on its first visit; the e2e and the captures answer `[ stay here ]`.
- **D-1207 — The example's pages in the capture set: 12 files, three names.** *(R203)*
  (FR-OPEN-11, D-1203.) `first-pass`, `first-live` and `first-stars` at 390 × 844 and 1280 × 800, dark, both languages: the satellites, live and stars doors pressed from `first-example`'s page, the page's lazy drawing ticked in and the live page's card or question answered. The phone's live page is the sky screen FR-OPEN-7 names (it was retired as a page of its own in v2.9).
  The set is 508. The owner's review copies, shot on the Mac, are `docs/screenshots/v2.16-r203/`.
- **D-1208 — The zones row joins `BUDGETS`; no other row moves.** *(R203)*
  (D-178, D-1174, D-1186.) `zones` is 6.6 KB (6,760 bytes) on 2.16.0: × 1.1 = 7.3, floored at 10 and capped at `ZONE_TABLE_MAX_KB`, so 9; `PHASE_BUDGETS` is empty again. Every other row's rule gives its current budget; `main` (195.2 KB) stays over its 185 line and warns, as on 2.15.0.
  Measured beside `v2.15.0` built in the same run on the same machine, both plain: `main` +385 bytes (199,454 → 199,839), R202's merge 199,664 and this task +175 (the line and `usePageObserver`). D-1204's 199,845 for 2.15.0 is not what a plain build of the tag reads here; the change against it is −6.

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
- **D-1217 — The live route answers the dialog where it is asked, not where a list says.** *(R204)*
  (FR-CI-6, D-1213.) `liveAt`, the one route every live capture takes, calls `captureSeeds.ts`'s `stayHere` after the compact card's answer: by then the track's pass ticks are drawn and the clock has ticked, so the dialog is asked or not, and `stayHere` presses `Esc` only where it is up (and the focus is blurred only then).
  In today's set only `live-twilight` at 1280 is asked; a screen that later opens the wide page with nothing up is answered without a list to update. The follow question is seeded for every page through `seedPage`, so `promo-record.spec.ts`, which seeds the same way, no longer meets it either.
- **D-1218 — `gather` runs after a failed shard, and fails at the shards' verdict.** *(R204)*
  (FR-CI-6, FR-CI-2.) `gather` is `if: always()` short of a skipped or cancelled `shoot`, so a red run still restores, downloads, diffs, writes the summary and uploads the set; its `every shard passed` step then fails it, and the design captures, the completeness check and the commit do not run — what the one job did after a failed shoot.
  `shoot` is `fail-fast: false`; each shard's files are an artefact `v1-captures-shard-<n>` kept 3 days, and `gather` uploads the whole set as `v1-captures` as before. `pick` keeps its 5 min, under the budget.
- **D-1219 — The follow key is written out, held to `useFollow.ts` by a test.** *(R204)*
  (D-1213.) `useFollow.ts` imports the store, which a Playwright spec cannot load, so `captureSeeds.ts` spells `FOLLOW_ASKED_KEY` out as `follow.spec.ts` does, and `tests/docs/ci-graph.test.ts` reads both files and fails when they differ.
  Verified locally on R204's branch: the whole set (464 tests) once with `--retries=0` on the installed Chrome (no Playwright browser on the machine), 463 green.
  The 80 captures that had failed on `main` (20 screen-widths) all passed first time, and the one red, `guide` at 1280 (night, en), touches neither question, timed out on the dome's glyph wait under five workers and passed 12 of 12 on a rerun.
  The first `captures.yml` run on the phase branch, [44584069653](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/44584069653) on `3c683623`: green, 464 passed with none flaky (116 a shard, 3.6 to 6.2 min), 8 min 54 s from `pick` to `gather`.
- **D-1220 — The split's test sits in `tests/docs/`, and `ci.test.ts` follows the jobs.** *(R205)*
  (FR-CI-5, D-1187.) Vitest's `node` project does not read `scripts/**`, so the split's test is `tests/docs/e2e-shards.test.ts`, beside `ci-affected.test.ts`.
  `tests/docs/ci.test.ts` read the old graph (budget 10, typecheck and lint on shard 1, `--shard`, `reports/vitest.json`), so its lines move to the new jobs in the same change; `ci-graph.test.ts` holds the graph itself.
- **D-1221 — The table is seeded from a full run's list log.** *(R205)*
  (D-1216.) No green run keeps a JSON report (`reports-ci-<n>` uploads on failure only), so the seed is the list reporter's per-test durations in the six shard logs of run 44541731659 (`main` at 9bb5c2b4, 2026-11-19, a full run, all green), summed per spec file over every project, retries counted and skipped tests at 0.
  That is 74 specs and 6,207 s of test time; the cut puts 1,034 to 1,036 s in each of the six shards, about 4.3 min each on four workers, against 3.4 to 6.9 min on that run.
  A full run now uploads each shard's JSON report as `e2e-report-shard-<n>` (7 days), the input `npm run e2e:durations` takes; the phase's first full run refreshes the table from them if its spread passes `CI_SHARD_SPREAD_S`.
- **D-1222 — A shard runs whole spec files, and an empty one starts no Playwright.** *(R205)*
  (FR-CI-5, FR-CI-4.) With no selection the specs are every `tests/e2e/*.spec.ts` less the gated, promo and design ones, read from `playwright.config.ts`'s own exports; a shard hands its files to `playwright test`, which still spreads their tests over the workers.
  A shard the cut leaves empty exits before Playwright, which given no file would run them all. A partial unit selection runs on `unit`'s shard 1 and the other passes; `unit` skips with none, as `build` does.
  Every e2e shard now fails at `inputs` on a failed `build` (shard 1 no longer runs checks without `dist/`), so the old `build result` step is gone; the 5-minute jobs keep their 5.
- **D-1223 — The run that proves it is the task's own, after the push.** *(R205)*
  (FR-CI-4, FR-CI-5.) The phase PR's first run, [44621824233](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/44621824233) (#306, full selection, 792 e2e passed, none flaky): 7 min 45 s wall, inside 8.
  Its e2e stages ran 3.6 to 5.3 min, a spread of about 100 s against 60, so the table was refreshed from that run's six `e2e-report-shard-<n>` reports (`npm run e2e:durations`, 76 specs).
  The next run, [44623254523](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/44623254523), took 7 min 20 s but its e2e stages ran 3.5 to 6.0 min (about 150 s): FR-CI-5's spread is not met, and a shard's time varies by a minute or more between runs of the same specs.
  The new checks are `static` and `unit (shard 1)`, `unit (shard 2)`; making them required on `main` is the owner's (`gh api` branch protection).

### 2.55 Driver pre-flight before v3.0 (2026-11-21)

Repo tooling made before v3.0's unattended run (D-86's precedent), not tasks.

- **D-1310 — A `credits_required` refusal is the model's own limit, and `hard` runs opus for now.**
  (§16.4 step 10, D-197.) `claude -p --model fable` now answers with a `rate_limit_event` that is `rejected` with `errorCode: "credits_required"`, no `rateLimitType` and a reset days away, and the sentence "Fable 5.2 requires usage credits. Switch to another model…".
  `limitFromEvent` read a windowless event as account-wide, so the fallback never ran and the task ended `limit`; that code, and a windowless event whose sentence says "switch to another model", are now model-only, and the next tier runs.
  `sdd.agents.json` maps `hard` to opus with a `note` saying why, `fable` stays readable as an alias of `hard`, and a model two tiers share reads as the lower one, so `Model: opus` still means `standard`.
- **D-1311 — The CI watch gives up after 40 minutes, and the task ends `ci-timeout`.**
  (§16.4 step 5.) `gh pr checks --watch` had no cap, so a check stuck pending (a Workers Builds outage) held the wave's slot for good.
  `watchChecks` kills the watch at `CHECKS_WATCH_TIMEOUT_MS` and returns `timeout`, apart from red; the task ends `ci-timeout` with its PR open and unmerged, the wave ends, and the run exits 1.
- **D-1312 — The driver merges only the head CI saw.**
  (§16.4 step 8.) `gh pr merge --squash` gains `--match-head-commit` with the PR head read before the last green watch, so a push after CI fails the merge instead of landing unchecked (gotchas, *GitHub merging*).
- **D-1313 — The e2e shard's timeout is 10 minutes; the budget stays 8.**
  (FR-CI-1, D-1215.) Shard 5 of `06f1fb19`'s run ran 8 min 16 s and was cancelled at its 8-minute timeout.
  `ci.yml` gains `CI_E2E_TIMEOUT_MIN: 10` and the `ci` job carries it; `CI_PR_BUDGET_MIN` stays 8, the target the step summary reports and every other stage job's timeout.
  This loosens FR-CI-1's "no job's timeout passes it" for the e2e job only; the owner confirmed it on 2026-11-21.
- **D-1314 — `--until-done` runs wave after wave.**
  (§16.7.) `npm run sdd -- --wave --until-done` repeats the wave in one process, with `--fix` unless `--no-fix`; each wave reads `origin/main` afresh and prunes first.
  After each wave `nextLoopStep` (`scripts/sdd/loop.ts`) decides: nothing ready stops it (exit 0); a task ended `limit` sleeps to the latest reset plus 2 minutes, at most 7 days, an hour when no reset is known; two waves in a row with nothing merged and the same failures stop it (exit 1); otherwise the next wave runs.
  The stop prints why and what did not merge; the state between waves is that list and a count, in memory only.

- **D-1315 — A rebase resolves the conflicts every parallel task makes.**
  (§16.4 step 4.) Each task appends rows to its phase's `plan.md` decisions and rewrites `docs/sdd/ids.md`, `docs/sdd/reference/traceability.md`, `docs/sdd/map.md` and the i18n key snapshot; in v2.14 R184's rebase conflicted on them and went back to `ready` to conflict again, since a session cannot rebase.
  When a rebase stops and every conflicted file is one of those, `scripts/sdd/resolve.ts` keeps both sides of each `plan.md` hunk (main's rows, then the branch's), checks out either side of the generated files and reruns their generators (`vitest -u` for the snapshot), and the rebase continues.
  Any other conflicted file aborts it as before. This is the owner's `resolve-sdd.sh` from v2.14, made the driver's.
- **D-1316 — Before the merge, a PR whose base moved is brought up to date by a merge.**
  (§16.4 step 8, D-1312.) R187's squash merge failed because a sibling landed after its checks. The driver now fetches before merging; if `origin/main` is not in the branch, it merges it in (the D-1315 resolver, main's side first), pushes without force, watches CI again and merges that head. At most 3 rounds; then the task ends `failed` with its PR open.
- **D-1317 — The standard ceiling is 40 M tokens, a killed session logs what it spent, and the loop skips stuck tasks.**
  (FR-SDD-2, D-1314.) In v2.14 three of seven kills at 32.7 M came within the last 12 turns of committed work. `standard`'s `tokenCeiling` is 40,000,000.
  A session killed by the ceiling or the clock writes the tokens the stream counted to `usage.jsonl` instead of nothing.
  `--until-done` resumes a budget-killed task at most twice, skips a `blocked` task (or one whose kept worktree holds `sdd-run/<id>.blocked.md`) and one that failed the same way twice, and stops with exit 1 when every ready task left is skipped.
- **D-1318 — Two fix sessions a task run, on their own caps.**
  (FR-SDD-16.) A fix spent on red CI left review findings with none, and the PR stalled its lane. A task run now gets one fix on red CI and one on findings, each capped at 250 turns and 45 minutes whatever the task's `Turns:`.
- **D-1319 — The review reads the stat, then the diff without deletions.**
  (D-1065.) The review prompt and `review.md` read `git diff --stat <base>...HEAD`, then `git diff -M --diff-filter=d <base>...HEAD`, so a large deletion or rename does not fill the session's context.
- **D-1320 — A published branch is pushed up to date, a conflicting PR is refreshed, and the loop carries an open PR on before it stops.**
  (§16.4 steps 5 and 8, D-1314, D-1316, D-98.) In the v3.0 run R206's fix session waited out a limit while R207 and R208 merged; the push made PR #312 conflict with `main`, GitHub ran no CI, `gh pr checks` said "no checks reported", the task ended `failed — CI is red after the fix session`, and `--until-done` stopped with exit 0 on "no task is ready" with every other task blocked on R206.
  Every push of a branch that has a PR (after a fix session, the pre-merge refresh, a conflicting PR) now goes through `pushUpToDate`: fetch, merge `origin/main` in when it is not in the branch (the D-1315 resolver), push without force; the first push fetches before its rebase.
  While a PR shows no checks, `watchChecks` reads its `mergeable`: `CONFLICTING` answers `conflicting` at once, the driver refreshes the branch and watches again, at most 3 times; otherwise the D-98 wait for the checks to register stands, and only its deadline is red.
  When nothing is ready, `--until-done` reruns once each open-phase task whose PR is open, not labelled `needs-owner` and with no blocked note: the run skips the session, brings the branch up to date, then CI, review (with `--fix`) and merge as usual, and keeps the PR body. A limit does not spend the retry; the D-1317 skips still apply.
  It then stops with exit 0 only when every unmerged task of the phase waits on the owner (a `needs-owner` PR, `Model: interactive`, a missing `Precondition:`, or blocked only on those); otherwise exit 1, listing each task and what holds it.
- **D-1321 — `docs/sdd/gotchas.md` is a shared file the resolver unions.**
  (D-1315, D-1316.) Parallel tasks append gotchas, and a conflict there stopped the driver with "conflicted outside the shared files": main added an indented continuation line to a bullet while the branch added a new bullet at the same spot.
  `sharedKind` now treats `gotchas.md` like a phase `plan.md`: every hunk keeps both sides, main's first (`mainSide` as for the plan), with no markers left, and the file is staged.

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
