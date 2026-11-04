# v2.2.1 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.37 v2.2.1 decisions (2026-09-28)

The phase changes nothing the app does.
Its decisions are where the showcase night lives in the tests, how the recordings and the captures reach it, and what the two new fixtures are.
The instants below were computed with the app's own worker handler (`worker/handlers.ts`, the path `scripts/build-stored-run.ts` takes) over the committed 2026-09-02 elements; the tasks recompute them from the stored run and record any difference in their `Done` notes.

- **D-682 — The showcase night is constants in `observers.ts` and one option on `stubNetwork`.**
  (FR-SHOW-9; V22-16, V22-17.) `tests/e2e/observers.ts` is the Playwright-free module the stored-run script and the docs tests already read, so the night goes there beside `NEUQUEN` and `PARIS`: `BARILOCHE_QUERY = 'bariloche'`; `BARILOCHE`, the `Observer` the place picker would write — the first `Place` of `parseGeocodeBody` (`data/openMeteo/geocode.ts`) over the geocode fixture, passed to `lib/place.ts`'s `observerFromPlace` as `PlacePicker.tsx` does, so the name, the region, the altitude (839 m) and the zone (`America/Argentina/Salta`) are the app's and not typed by hand (F-49's rule, which R37 applied to coordinates); `SHOWCASE_NIGHT = Date.parse('2026-09-06T07:00:00Z')`, 04:00 local, 43 minutes before the night's first pass (04:43) and 1 h 48 min before its first bright one (Tiangong, 05:48); `SHOWCASE_UNTIL`, the instant FR-SAT-4's warning would appear — the fixtures' newest epoch (`2026-09-01T23:20:48Z`, read by `lib/elementsAge.ts`'s `newestEpoch`) plus `EPOCH_WARN_MS`, `2026-09-06T23:20:48Z`, 20:20 local — as a literal the test checks against the computation; `STORED_RUN_BARILOCHE_FILE`.
  `liveHelpers.ts`'s `stubNetwork(page, elements)` gains a third parameter, `weather: 'refused' | 'showcase' = 'refused'`: refused is today's behaviour for every existing caller, byte for byte; showcase fulfils `api.open-meteo.com/v1/forecast` with the forecast fixture when the request's `latitude`/`longitude` are the fixture's cell (`-41.1`, `-71.3`) and refuses any other cell, and fulfils `geocoding-api.open-meteo.com/v1/search` with the geocode fixture when `name` is `bariloche` and refuses any other name, so a flow that drifts to another place fails loudly rather than showing Bariloche's weather over it.
- **D-683 — The recordings type the name and pick it, over a stored run at 04:00.**
  (P7; FR-SHOW-6 as amended, FR-SHOW-9; supersedes D-673's Paris run.) `scripts/build-stored-run.ts` writes `tests/fixtures/stored-run-bariloche.json`, the 72 h search over `BARILOCHE` at `SHOWCASE_NIGHT`, by the same `build()`; `stored-run-paris.json` and `STORED_RUN_PARIS_FILE` are deleted, since only the recordings read them, and `stored-run-neuquen.json` is written byte for byte as before.
  Every flow calls `stubNetwork(page, 'fixtures', 'showcase')` and seeds that run before the place is set (the R82 method, as D-673).
  The first-run and desk cold-open flows type `bariloche` into the place search, wait for the result list and pick the first result — the search is on camera and the observer is the picker's; the flows that open on a saved place seed `BARILOCHE` in `wiys:prefs:v1` as `seedPrefs` does today.
  The desk's live flow is at the showcase's `SHOWN`: three minutes into the night's brightest pass, Tiangong's rising at 07:20 local (peak −2.1, 48°, in twilight), read from the stored run by its object and start rather than written as a number.
  The phone's live flow stays "that night by day" for D-673's reason (`[ see this pass ]` is offered only while nothing is up): `SHOWCASE_NIGHT + 12 h`, 16:00 local on the 6th, under `SHOWCASE_UNTIL`.
  No flow runs its clock past `SHOWCASE_UNTIL`; `promo.test.ts` asserts each flow's start plus its seconds is under it.
  `captureSeeds.ts`, `v1-captures.spec.ts` and `captureSet.ts` are not touched by P7: the release set stays on Paris until P8 re-shoots it, so for one task the two nights differ, and FR-SHOW-9's "no seed module exports a Paris night for the capture set" is P8's to meet.
- **D-684 — The capture set moves onto the same seeds, its routes and its shape unchanged.**
  (P8; FR-SHOW-10, FR-SHOW-9, FR-CAP-1..5; supersedes D-179's "one place and one night: Paris" and D-639's instants.) `captureSeeds.ts`'s `CLOCK` becomes `SHOWCASE_NIGHT`, `SHOWN` the showcase's (D-683), and `seedPage`'s observer `BARILOCHE`; `v1-captures.spec.ts` calls `stubNetwork(page, 'fixtures', 'showcase')`.
  `GLARE_PASS` is re-derived: the capture run looks in the stored run for a pass the app flags with Moon glare on the night (the Moon is a 27 % waning crescent, 3–14° up in the north-east during the morning passes); if there is one it takes its place, and if there is none the screens that used it are shot on the night's brightest pass and their `what` lines say the glare state is absent and why (FR-SHOW-9's rule), the file names unchanged.
  The same for the `Next ISS` tag and any other state the night lacks.
  D-179's reason for closing the night groups on the home capture (fifty passes a night over Paris) is re-checked against Bariloche's count; the route stays as it is unless the count makes a capture unreviewable, and the `Done` note says which.
  `PARIS_NIGHT` leaves `observers.ts` when nothing imports it (knip's rule, D-648); `PARIS` stays for the specs that name it for their own reasons.
  `scripts/readme-hero.ts` is run as it is and the two pictures it writes are committed; the owner uploads `docs/readme/social-preview.png` again (FR-PUB-11).
  The two-run comparison of FR-CAP-5 is `captures.yml` twice on the branch's head, both run links in the pull request.
- **D-685 — The seeds' test reads the fixtures, not the specs' prose.**
  (FR-SHOW-9, FR-SHOW-10.) `tests/docs/showcase.test.ts`, created by P7 and extended by P8, imports `observers.ts` and the fixtures only (no Playwright): `BARILOCHE` deep-equals `observerFromPlace(parseGeocodeBody(fixture)[0])`; `SHOWCASE_NIGHT` and every instant `promoFlows.ts` names (and, from P8, `captureSeeds.ts`'s `CLOCK` and `SHOWN`) fall on 2026-09-05 or 2026-09-06 in `America/Argentina/Salta` and before `SHOWCASE_UNTIL`; `SHOWCASE_UNTIL` equals the newest epoch of the catalog-filtered fixture elements plus `EPOCH_WARN_MS`; the forecast fixture's cell is `BARILOCHE`'s by `passCellKey`'s rounding (D-37), its `hourly.time` covers every such instant, and none of its four series has a null; the stored Bariloche run's `observer` is `BARILOCHE` and its `computedAt` is `SHOWCASE_NIGHT`.
  From P8 it also asserts that `captureSeeds.ts` does not import `PARIS` or `PARIS_NIGHT`.
  `promo.test.ts`'s D-673 check (the Paris run at `PARIS_NIGHT`, never `NINE_DAYS_ON`) is rewritten to the Bariloche run at `SHOWCASE_NIGHT`.
- **D-686 — The two fixtures, and the one word on the forecast's `.meta.json`.**
  (FR-SHOW-9; V22-17.) `tests/fixtures/open-meteo/2026-09-06-bariloche-forecast.json` is the verbatim body of `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=-41.1&longitude=-71.3&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&start_date=2026-09-06&end_date=2026-09-08&timezone=auto&timeformat=unixtime`, re-indented, captured 2026-09-28 with an `Origin` header (the response carried `access-control-allow-origin: *`): 72 hourly samples from `1788663600` (2026-09-06 00:00 local) to `1788919200`, four series, no nulls, `timezone: America/Argentina/Salta`, the model grid point `-41.019333, -71.25534`.
  Its `.meta.json` has the Neuquén fixture's fields (`fetchedAt`, `source`, `cell`, `observer`, `timezone`, `coverage`, `note`) and one more, `"kind": "historical-forecast reconstruction"`, and its `note` says in a sentence that the body was assembled after the fact from archived model runs and is not a forecast fetched at the clock, so the fixture's kind is a field a test can read and not a sentence a reader must find.
  `2026-09-06-bariloche-geocode.json` is the verbatim body of `https://geocoding-api.open-meteo.com/v1/search?name=bariloche&count=8&language=en&format=json` captured the same day, four results, the first `Bariloche, Rio Negro, Argentina` at `-41.14557, -71.30822`, 839 m; its `.meta.json` is the Cipolletti fixture's shape.
  Both files are named for the night they serve, not the day they were fetched, as the Neuquén forecast is.
  They are the owner's commit on `main` (V22-17), made from this session's captures.
- **D-687 — Each flow names its instant, and the recordings seed themselves.**
  (P7; FR-SHOW-9, D-683, D-685.) `PromoFlow` gains `at`, the instant its paused clock is installed at, so the docs tests read every instant a recording starts from the list rather than from the spec's prose: `SHOWCASE_NIGHT` for the first runs, the list, the settings and the desk's cold open; `SHOWCASE_BY_DAY` (`SHOWCASE_NIGHT + 12 h`) for the phone's live flow; `SHOWCASE_SHOWN` for the desk's.
  `promoFlows.ts` finds `BRIGHTEST_PASS` in the stored run as Tiangong (NORAD 48274) rising within the 07:20 local minute on the 6th, and `SHOWCASE_SHOWN` is its start plus three minutes; `showcase.test.ts` checks that it is the lowest peak magnitude before `SHOWCASE_UNTIL` (−2.14).
  `promo-record.spec.ts` seeds with its own `seedShowcase` (the prefs init script, `stubNetwork(page, 'fixtures', 'showcase')`, the clock at `of.at`) rather than `captureSeeds.seedPage`, whose private network stub refuses the forecast and which P7 may not touch; it still takes `guide`, `OPEN_GUIDE` and `SeedPrefs` from there.
  `SHOWCASE_UNTIL` is the literal D-682 names, `2026-09-06T23:20:48Z`; the newest epoch is `23:20:48.008Z`, so the test holds the literal to the computation floored to the second, and to the warning's own measure (`epochIsOld` false at it, true a second after).
  The forecast cell is checked with `weatherCache.cellCentre`, the 0.1° rounding D-37 means; `passCellKey`, which D-685 names, rounds to 0.01° and gives the stored run's key, not the forecast's.
- **D-688 — A picked place moves the first run on by itself, and the pointer leaves the page.**
  (P7; FR-FIRST-2, D-683.) A place picked from the list is settled (`useSteps` goes to `when` at once for any observer that is not a typed pair), so the first run has no `[ continue ]` to tap; the `where` still is shot with the recorded answer listed under `bariloche`, the search on screen, and the desk's `cold-open` still before typing, as before.
  After the pick the pointer is moved to the corner: the tap lands where the when step puts its sky box, and with a forecast that box has a tooltip, which in Spanish covered `[ Ver qué cruza ]` and failed the first take.
  The two live flows wait on `homeSettled` — a card, nothing busy, the night groups and the readiness line — because `captureSeeds.listSettled` also waits for the ISS's `Next` tag, which the night does not hold (FR-SHOW-9).
- **D-689 — What the first Bariloche run showed.**
  (P7; FR-SHOW-9.) All eight flows pass in 3.3 min; the countdown's first pass is Cosmos 2428 at 04:43 (`in 43:22` on the list still), the list and the desk's panes read `Clear` on every morning card and `Clouds now Clear`, the readiness line `Ready offline until 2026-09-08 22:09`, the Where reading `Elements 4 d 7 h old` without the warning, and the desk's live page, three minutes into Tiangong's 07:20 pass, `Partly cloudy, 31 % cloud`.
  Both live flows' held instants land on the evening's first rise, SL-16 R/B (Cosmos 2369) at 20:44 local, 24 minutes past `SHOWCASE_UNTIL`: the phone's `[ see this pass ]` from 16:00 and the desk's `[ pass ▶| ]` from 07:26 have nothing nearer to go to.
  No warning shows, because FR-SAT-4's warning reads the page's clock, which stays under `SHOWCASE_UNTIL`; whether FR-SHOW-9's "nothing after it is shown" also covers a held instant is the owner's to say (the phone's flow at `SHOWCASE_NIGHT` would hold at 04:43 instead).
  *(Superseded by D-690: it does, and neither flow holds the evening now.)*
- **D-690 — At the gate: 05:00, a morning hold, and the pass as a literal.**
  (P7; FR-SHOW-9 (a), FR-SHOW-6; the owner on PR #167, amends D-682's `SHOWCASE_NIGHT` and D-683's phone instant.) Three answers, one per question the first run left.
  **The clock starts at 05:00 local** (`SHOWCASE_NIGHT = 2026-09-06T08:00:00Z`, was 07:00Z): at 04:00 the list's first card was Cosmos 2428, `Faint, needs dark sky (+4.3)`, a weak first thing for a post to show, and at 05:00 it is Tiangong at 05:48, `Like a bright star (+0.4)`, 47 minutes out; the stored run is recomputed there (24 passes; `stored-run-neuquen.json` unchanged).
  **"Nothing after it is shown" covers a held instant**: the phone's live flow opens at `SHOWCASE_NIGHT` instead of twelve hours on — nothing is up at 05:00, so `[ see this pass ]` is offered and holds Tiangong's 05:48 pass — and it takes no minute steps, since that pass lasts 40 s and a step leaves it behind (`0 up`); the desk's flow steps a minute at a time along Tiangong's 07:20 pass and never takes `[ pass ▶| ]`, whose next rise is the evening's.
  `SHOWCASE_BY_DAY` is gone.
  **The review's finding is fixed here rather than filed**: `promoFlows.ts` read the stored run at import and threw when no Tiangong pass rose in the 10:20 UTC minute, and `playwright.config.ts` imports it, so a regenerated run would have failed every Playwright run at load; `BRIGHTEST_PASS` is now the literal `48274-1788690047813` and `showcase.test.ts` holds it to the run.
  The seeds' test gains two assertions: the first pass after `SHOWCASE_NIGHT` is Tiangong at 05:48 and brighter than `FAINT_MAG`, and the phone flow's next rise is 05:48 while the recording spec never uses `data-step="next-rise"`.
  **The phone's `.mp4` is cropped and scaled**: Chromium's screencast captures the page at its CSS size and ignores the device pixel ratio, so every phone video since P4 carried the page in the top-left 390 × 844 of its 1170 × 2532 frame and grey padding in the rest (D-652 and P4's Done note foresaw a capped frame, not a padded one).
  The conversion now crops a flow's viewport out and scales it to its device's frame with `lanczos` wherever the two differ; the desk's, equal, are converted as before.
  The text is softer than a still's; a frame-by-frame build from DPR-3 screenshots would be sharp and is left for a later task.
  The `.webm` stays the unedited record.

- **D-691 — P8: the set on the showcase night, what the night lacks, and a guard for US-36 AC8.**
  (P8; FR-SHOW-9, FR-SHOW-10, FR-CAP-1..5; applies D-684, D-685.) **The glare pass:** the stored Bariloche run has five passes before `SHOWCASE_UNTIL` and none with `moonGlare.glare` (the nearest is the 05:48 Tiangong pass, 8.3° from the Moon and not flagged), so `GLARE_PASS` became `SHOWN_PASS`, the night's brightest (`BRIGHTEST_PASS`, Tiangong at 07:20:47 local), and the guide, polar and window files are shot on it; `showcase.test.ts` asserts the absence, so the day a regenerated run has a glare pass the test says so.
  **The `Next ISS` tag:** only the ISS is `featured`, and the 72 h run has no ISS pass, so no card on the night has a tag; `captureSeeds.listSettled` waited for one and now waits for the first card, as `promo-record.spec.ts`'s `homeSettled` already did.
  **The chip's instant** moved from eight minutes before the pass to three (`SHOWN_PASS_START - 3 * 60_000`): eight minutes over Paris was inside the lookahead of another pass; over Bariloche it is outside `ARC_LOOKAHEAD_MS` for the only pass coming, and at three minutes the 07:04 pass has set, so the field is empty and the chip names Tiangong `139° right, up in 2:50`.
  **The legend** at `SHOWN + 2 min` has one drawn row, `up`: the night's passes do not overlap, so no instant holds `soon` or `gone` beside another, and nothing hidden is above the horizon in the twilight, so the FR-LIVE-6 rows are absent; the `what` line says so and the instant is unchanged.
  **The home's closed nights** (D-179): the night has five passes and the 72 h nineteen, so the open default would no longer make an unreviewable file; the route is kept so the set's shape and its `-view` pairing do not change.
  **A guard:** every capture now fails before its shot if the page's visible text holds `UTC`, a cloud badge without a forecast, the readiness or failure line about the forecast, or FR-SAT-4's warning, in either language — US-36 AC8 as a check rather than a look.
  **The run:** 254 passed in 1.9 min on a ten-core Mac against `npm run build`; 230 files changed against `main` (the 24 unchanged are `location`, which has no place yet, and `shortcuts`, whose overlay covers the page).
  A second local run differed in 16 files by 3 to 10 pixels of at most 2 levels on bar and stripe edges (`legend-360`, `live-scrubbing` at 1200, 1920 and 3840, `live-watching` at 360 and 1024): D-611's sub-pixel noise on this machine, not the instant (every clock is pinned and asserted to the second).
  The first run is the committed set; FR-CAP-5's reading of record is `captures.yml` twice on the branch head.
  **Seen at the re-shoot and left** (D-656): F-101, the saved-places row on a phone wrapping round a geocoded label.
- **D-696 — The dome flows: London at 21:18 on the 6th, played at 60×.**
  (P9; FR-SHOW-6 and FR-SHOW-9 as amended, V22-20.) `observers.ts` gains `LONDON_QUERY`, `LONDON` (the first `Place` of `parseGeocodeBody` over `2026-09-06-london-geocode.json`, through `observerFromPlace`, as `BARILOCHE` is built), `DOME_NIGHT = 2026-09-06T20:18:00Z` (21:18 BST) and `STORED_RUN_LONDON_FILE`; `scripts/build-stored-run.ts` writes the London run there (170 passes in 72 h; the Neuquén and Bariloche runs byte for byte unchanged).
  `stubNetwork`'s `'showcase'` weather reads a table of places — each forecast with the cell its `.meta.json` names, each geocode with its query — so it answers Bariloche's and London's requests and refuses every other.
  `promoFlows.ts` gains two `dome-playback` flows, phone and desk, `at: DOME_NIGHT`, 32 s, stills `crowded` and `overhead`; the spec stores the London run and reloads (the `homeAtBariloche` method), opens the live page, enters scrubbing, presses `live-play` at the default 60× and watches 29 s of wall time — 21:18 to about 21:48 of sky — before pausing.
  The stills a test shot are keyed by flow and device, since the two share a name.
  Computed with the worker handler over the committed elements: from 20:19 UTC eleven passes cross in 26 minutes, ten brighter than `FAINT_MAG`, up to five up at once (Tiangong at −0.8, Terra, Okean-O at 88°, five rocket bodies).
  The flows' sky ends at about 20:48 UTC, under `SHOWCASE_UNTIL`.
  `showcase.test.ts` holds the observer, the cell, the clear 20:00 UTC sample, the run and the window's counts.

### 16.19 Delivery of the v2.2.1 tasks *(V22-16..V22-19, D-682..D-686)*

The V1-11 rules are unchanged.
Two `P` tasks (§16.12's numbering: the repository's material, not a release), two waves, on `main` after the `v2.2.0` tag.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | P7 — The recording run on the Bariloche night | `ui` (`tests/e2e/observers.ts`, `tests/e2e/liveHelpers.ts`, `tests/e2e/promo-record.spec.ts`, `tests/e2e/promoFlows.ts`, `scripts/build-stored-run.ts`, `tests/fixtures/stored-run-*.json`; outside the lane, `tests/docs/showcase.test.ts` and `tests/docs/promo.test.ts`) | fable | owner (`npm run promo:record` on the Mac, every file opened — FR-SHOW-9 (a)–(c)) | P5; **Precondition:** `tests/fixtures/open-meteo/2026-09-06-bariloche-forecast.json` |
| 2 | P8 — The release set re-shot on the Bariloche night, the hero and the social preview regenerated | `ui` (`tests/e2e/captureSeeds.ts`, `tests/e2e/v1-captures.spec.ts`, `tests/e2e/captureSet.ts`, `tests/e2e/observers.ts`, `docs/screenshots/v1-*.png`; outside the lane, `docs/readme/*.png` and `tests/docs/showcase.test.ts`) | fable | owner (the re-shot set in both languages and both themes, FR-CAP-5's two runs) | P7 |

The two are sequential, so no file is shared within a wave; P8 depends on P7 because it imports the seeds P7 adds and must not write a second copy of the night.
P8 crosses into `docs` for the two composed pictures, as P6 did the other way, because they are made from the captures it re-shoots and a separate `docs` task would only run one script.

**Sessions** (V22-19, V22-13, D-659): both entries carry `Model: fable`, `Review: opus`, `Turns: 500`, `Fallback: off`.

**Decision block** (§16.2): **P7 takes D-687..D-690, P8 D-691..D-695**.
D-682..D-686 are this plan's.
*(V22-20)* **P9** — the dome flows over London, `ui`, run in the owner's session (`Model: interactive`) beside P8 and reviewed on `opus` by hand — takes D-696..D-699.

**Preconditions a driver run must check:** P7's `Precondition:` is the forecast fixture on `origin/main`, which the owner's commit adds together with the geocode fixture and both `.meta.json` files (V22-17, D-686); the driver skips P7 until it exists.
P8 needs nothing beyond P7's merge.
P7's gate is the owner's Mac and the files watched; P8 does not wait on it, only on the merge, but the owner may hold P8 until the recordings are accepted, since both show the same night.

What each session reads (D-284's rule): both SPEC FR-SHOW-6, FR-SHOW-7, FR-SHOW-9, FR-SHOW-10, FR-SAT-4, §9 Phase 2j, §12 V22-16..V22-19, PLAN §2.37 and this section.
P7: D-652..D-654, D-671..D-673; `tests/e2e/promo-record.spec.ts`, `tests/e2e/promoFlows.ts`, `tests/e2e/observers.ts` and `scripts/build-stored-run.ts` whole; `tests/e2e/liveHelpers.ts`'s `stubNetwork`; `tests/docs/promo.test.ts`.
P8: D-179, D-611, D-639, FR-CAP-1..5, FR-ADDR-4, FR-PUB-2; `tests/e2e/captureSeeds.ts`, `tests/e2e/v1-captures.spec.ts` and `tests/e2e/captureSet.ts` whole; `scripts/readme-hero.ts`; `.github/workflows/captures.yml`.
