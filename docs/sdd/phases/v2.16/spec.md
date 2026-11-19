# v2.16 — SPEC.md sections

Phase file of SPEC.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.23 Goals (v2.16, "an answer first")

- **G69. Show what the app is for by showing it work.**
  A first visit sees a real result — a satellite, a time, a direction — before it is asked anything.
- **G70. Never pass an example off as a forecast.**
  The result is for a city guessed from the browser's time zone, which can be hundreds of kilometres off, and every screen that shows it says so.
- **G71. A change is checked in minutes, and the captures run again.**
  A pull request's CI answers within 8 minutes, and the capture set, red on every push to `main` since 2026-11-05, is green before this phase's own captures are taken.

**US-60 — An answer before a question** *(v2.16)*
As a new visitor, I open the app and see when and where to look tonight for a city near me, so I understand what it does before I set anything.
- AC1: From an empty store at 390 × 844 with the time zone `America/Argentina/Buenos_Aires`, the first screen shows the tagline, "Example: Buenos Aires, from your time zone", the next pass of the example as FR-FIRST-3's first card, tonight's stripe and `[ Not there? Set your place ]`, with no scroll, in both languages (FR-OPEN-3).
- AC2: No permission prompt is shown and no request goes to a host other than CelesTrak, Open-Meteo and the page's own origin before the visitor acts (FR-OPEN-1, FR-OPEN-2).
- AC3: At 1280 × 800 the same load shows the three populated panes for the example, the label and the action in the Where pane (FR-OPEN-4).
- AC4: With the time zone `Etc/UTC`, with the elements failing, with the run not ready inside `EXAMPLE_WAIT_MS`, or with no visible pass in 72 h, the first screen is the place question of FR-OPEN-6 (FR-OPEN-6).
- AC5: After a reload with no place set, the example shows again; nothing about it was stored (FR-OPEN-2).
- AC6: The example's card says what the pass looks like, names heights and brightness in words with no degree or magnitude, and, opened at noon, says why the pass is tonight (FR-OPEN-12..14).

**US-61 — From the example to my sky** *(v2.16)*
As a new visitor whose city is not the example's, I set my place in one action and land on my own page.
- AC1: `[ Not there? Set your place ]` opens the place group with the focus in it; `[ back ]` returns to the example without a new run (FR-OPEN-5).
- AC2: Setting a place by any of the three ways lands on the stacked home (compact) or the populated panes (wide) for that place, with no when or what step between (FR-OPEN-5).
- AC3: A load with a stored place is the page 2.15.0 draws, the header's tagline excepted (FR-OPEN-9).
- AC4: Walking from the example to a set place at 390 × 844 sends `open`, `example_shown`, `where_shown`, `place_set`, each once and in that order, with one `id`, and no event carries the example's city, zone or coordinates (FR-OPEN-10).

### 4.59 The example first run *(v2.16)*

The feedback of November 2026 is that new readers do not understand what the app is for, and a first visit today asks for a place before it shows anything (FR-FIRST-1).
This phase opens the first visit on an answer: tonight's next pass for the city of the browser's time zone, labelled as an example, with one action that leads to the visitor's own place.
The place question stays, as the action's destination and as the fallback whenever the example cannot be shown.

- **FR-OPEN-1** *(V216-2)* **The city from the time zone.**
  The guess is the zone `Intl.DateTimeFormat().resolvedOptions().timeZone` returns, looked up in a table generated at build time from tzdata's `zone.tab` and `zone1970.tab` (public domain): one row per zone either file lists, holding the zone's name, a display name and its coordinates to 0.01°.
  `zone.tab`'s coordinates come first, so a zone tzdata has merged into another (`Europe/Stockholm` into `Europe/Berlin`, `Atlantic/Reykjavik` into `Africa/Abidjan`) keeps its own city (V216-15).
  An alias zone (`backward`) that neither file lists resolves to its target's row.
  The display name is the zone's last part with `_` as a space, spelled as a town of `places.txt` (FR-LOC-1 (c)) within `ZONE_NAME_MATCH_KM` (50 km) of the zone's coordinates whose name is the same once accents, case and punctuation are ignored (`São Paulo`, `Zürich`); a nearer town of another name never replaces it, so `Europe/Paris` is Paris and not one of its districts (V216-18).
  No zone, `UTC`, any `Etc/` zone, or a zone not in the table is **no city**.
  The lookup asks for no permission, makes no request and writes nothing; the table loads after the first paint, at most `ZONE_TABLE_MAX_KB` (9 KB gzipped; rationale: the two files' 564 zones and aliases measure about 7 KB gzipped before the name column), and is not in the main chunk.
  *Verification:* `zoneCity.test.ts` — a canonical zone, a merged zone (`Europe/Stockholm` → Stockholm, not Berlin), an alias (`Asia/Calcutta`), `Etc/UTC`, `UTC`, an unknown string and an empty value.
  The display-name rule on a zone with a matching town and one without; the build script's output pinned by a fixture of `zone.tab`, `zone1970.tab` and `backward` rows; `npm run bundle:budget` with the table's row.

- **FR-OPEN-2** *(V216-2, V216-6)* **The example observer.**
  The example is an observer with the source `example`, the city's coordinates, an altitude of 0 m and the display name as its label.
  It is never written to the store, the URL, the saved places or the settings page, and a load with no stored observer is still a first visit (FR-MEAS-1's `visit`).
  Its passes, its night and its forecast are computed and fetched as for any observer: the elements from CelesTrak, the run in the worker, the forecast from Open-Meteo for the city's coordinates, which come from the time zone and never from the visitor.
  It is dropped the moment a place is set, and its run is not kept.
  *Verification:* a store test — the example never reaches persistence or the URL; `firstRun.spec.ts` — after the example has shown, local storage and IndexedDB hold no observer, the requests go only to CelesTrak, Open-Meteo and the page's origin, and the forecast request's coordinates are the zone city's.

- **FR-OPEN-3** *(V216-2, V216-8)* **The first screen, compact.**
  With no stored observer and a city, the home is, under the header: the tagline at body size in `--fg` ("Which satellites you can see tonight, when, and where to look." / "Qué satélites se ven esta noche, cuándo y hacia dónde mirar.", `home.tagline`); then the **example band**; then the stacked home of FR-FLOW-1 for the example, doors first.
  The band, in a box ruled in the accent, 12 px by a cell inside, 0.75 rem between its blocks, holds four blocks.
  First the label at `--small` in `--fg-dim` ("Example: <city>, from your time zone" / "Ejemplo: <city>, según tu zona horaria", `example.label`); then the next event of the example as FR-FIRST-3's first card, a control that opens that pass; then tonight's stripe (FR-FIRST-8).
  Last, `[ Not there? Set your place ]` / `[ ¿No es ahí? Elegí tu lugar ]` (`example.setPlace`) as one full-width button in the accent's border, at least 48 px tall.
  There is no step line.
  At 390 × 844 the header, the tagline and the band's last control fit the viewport with no scroll in both languages; at 360 × 640 the action is above the fold.
  Every line keeps FR-COMP-4's 36 cells.
  *Verification:* a component test asserts the band's blocks in order, the card as a control and the action's name; an e2e at 390 × 844 and 360 × 640 in both languages asserts the action's box inside the viewport.

- **FR-OPEN-4** *(V216-5, V216-7)* **The first screen, wide, and the wait.**
  On wide the first visit is the populated page of FR-FIRST-5 for the example, the header carrying the tagline in place of its subtitle; the Where pane opens with the label and `[ Not there? Set your place ]` where the place line and `[ change ]` stand for a real place, and its saved places read none.
  Until the example's run is ready the band (compact) or the Where pane (wide) shows the label, "Finding tonight's passes over <city>…" / "Buscando los pases de esta noche sobre <city>…" (`example.finding`) and the action, already live; the readings that need the run hold their height and show nothing.
  The wait is at most `EXAMPLE_WAIT_MS` (10 000), rationale: a first visit fetches the elements and runs 72 h before it can answer, and a reader who has waited that long is better served by the question; the plan measures the real time in a throttled first visit and may lower it (V216-15).
  *Verification:* a component test of the waiting state; a layout e2e at 1280 × 800 and 1024 × 768 asserts the label and the action in the Where pane and the next-event block in When.

- **FR-OPEN-5** *(V216-4)* **Not there: set your place.**
  The action opens the place group of FR-FIRST-2 with the focus in it: on compact as one screen — the heading "Where will you be looking from?", its sentence and the group, boxed — with `[ back ]` above the heading; on wide in place in the Where pane, plain, with `[ back ]` under the group.
  `[ back ]` returns to the example as it was, with no new run.
  Once a place is set by any way in, the page is the stacked home (compact) or the populated panes (wide) for that place, with no when or what step, and the observer is saved as today.
  A denial of the device location follows US-3 AC2 and keeps the group open.
  *Verification:* the component test asserts the focus and `[ back ]`; the e2e sets a place by each of the three ways from the example and asserts the stacked home at 390 × 844 and the panes at 1280 × 800.

- **FR-OPEN-6** *(V216-3)* **When there is no example.**
  With no city (FR-OPEN-1), when the elements, the worker or the run fail, when the run is not ready inside `EXAMPLE_WAIT_MS`, or when the example has no visible pass in the 72 h span, the first screen is the place question.
  On compact it is FR-OPEN-5's screen without `[ back ]`, the tagline above its heading; on wide the cold open of FR-FIRST-1 (the Where pane active, When and What dimmed), the tagline in the header.
  A night with no darkness but a pass inside 72 h is not a fallback: the example shows that pass on the night it is in.
  A cloudy night is not a fallback: the example shows its cloud word as any place does.
  Once the fallback is shown, a late run does not replace it.
  *Verification:* `firstRun.spec.ts` — each of the four causes, at 390 × 844 and 1280 × 800, asserts the question and the tagline; a late run after the timeout leaves the question on screen.

- **FR-OPEN-7** *(V216-9)* **The pages with the example.**
  While the example is the observer, every page opens for it: the pass detail, `#live`, `#stars` and the sky screen.
  Under the header each carries one line at `--small`, `Example: <city>, from your time zone · [ set your place ]`, whose control opens FR-OPEN-5 on the home.
  The live page's "The live sky needs a place." (FR-FIRST-1) is shown only where there is no example.
  The settings page's location section shows no place.
  *Verification:* an e2e opens each door and the header's links from the example and asserts the line and the control at 390 × 844 and 1280 × 800.

- **FR-OPEN-8** *(V216-8)* **The words.**
  Every new string is in both languages in the catalog, each line within FR-COMP-4's cells: `home.tagline`, `example.label`, `example.setPlace`, `example.finding`, `example.back` (`[ back ]` / `[ volver ]`), `example.pageLine`, `example.looks` (FR-OPEN-12) and `example.afterDusk` (FR-OPEN-14).
  The tagline replaces the header's subtitle on every page that draws it.
  *Verification:* `messages.test.ts`'s snapshot gains the keys; `controlRows.test.ts` fits every new row at 360 and 390 px in both languages.

- **FR-OPEN-9** *(V216-11)* **A returning visit is unchanged.**
  A load with a stored observer draws exactly what 2.15.0 draws, apart from the header's tagline (FR-OPEN-8); no stored field is added or read.
  *Verification:* the captures of every page with a stored observer move only in the header's tagline line, a named move in the release record.

- **FR-OPEN-10** *(V216-7)* **The first run is counted from its first day.**
  FR-MEAS-2's table is amended as below; the events carry FR-MEAS-1's fields only, and no event carries the example's city, zone or coordinates (FR-MEAS-5).
  *Verification:* `measure.spec.ts` — US-61 AC4's walk, the fallback walk and the wide walk in both languages, reading the captured requests; FR-MEAS-5's checks with the example's city and coordinates added to the forbidden strings.

- **FR-OPEN-12** *(V216-12)* **What it looks like.**
  The example's first card (FR-OPEN-3) and, on wide, the next-event block in the When pane end with one line at `--small` in `--fg`: "A steady moving dot, no blinking, crosses in about <n> min." / "Un punto que se mueve parejo, sin parpadear, cruza en unos <n> min." (`example.looks`), `<n>` the pass's duration in whole minutes, at least 1.
  It is drawn only while the example is the observer.
  *Verification:* a component test asserts the line, `<n>` for a 5 min 40 s pass (`6`) and a 40 s pass (`1`), and its absence for a set place; `controlRows.test.ts` fits it at 360 px in both languages.

- **FR-OPEN-13** *(V216-13)* **Words, not numbers, on the first visit.**
  While the example is the observer, every height and brightness on the home is a phrase: the path line names the peak by FR-GUIDE-2's elevation phrase in place of its altitude (`NW low → almost overhead → SE · 6 min` / `NO bajo → casi en el cenit → SE · 6 min`).
  The brightness phrase (FR-GUIDE-3) is drawn with no magnitude after it; the What pane's cards show the brightness phrase in place of `mag <m>` (FR-FIRST-10's phone form), and the Satellites door's path line uses the same phrases.
  The pass detail keeps every figure (US-6 AC2), and a set place's home is unchanged (FR-OPEN-9).
  *Verification:* a component test of the band, the next-event block, a card and the door under the example asserts no `°` and no `mag` and the phrases; the same components for a set place keep the figures.

- **FR-OPEN-14** *(V216-14)* **Why tonight.**
  When the example's band or Where pane is drawn while the Sun is in the stripe's day band at the current instant (FR-FIRST-8's `▓`), the card is followed by one line at `--small` in `--fg-dim`: "Satellites are only visible after dusk." / "Los satélites solo se ven después del anochecer." (`example.afterDusk`).
  In twilight or dark it is not drawn.
  *Verification:* a component test at an instant in the day band, one in twilight and one in the dark band; the capture of the example is taken at night, and one more at noon.

- **FR-OPEN-11** **Captures and the reference.**
  At 390 × 844 and 360 × 640: the example, the wait, the place group from the example and the fallback; at 1024 × 768 and 1280 × 800: the example and the fallback — each in both languages and the dark theme, the example also in the light theme.
  The captures fix the clock, the time zone (`America/Argentina/Buenos_Aires`) and the elements fixture, so the example's pass is the same on every run.
  There is no design board for this phase; the captures are the reference the owner reviews.

### 4.60 CI time, again *(v2.16)*

A full run takes 9.4 min against FR-CI-1's 10, because shard 1 runs the typecheck, the lint and the unit suite (3.3 min) before its share of e2e, and the e2e shards, cut by test count, run from 4 to 7.5 min.
The capture set has failed on every push to `main` since 2026-11-05: v2.14's two questions (the wide live page's first-pass dialog and the phone's follow question) cover the page, and 80 of 464 captures time out three times each in a 52 min job.

- **FR-CI-4** *(V216-17)* **The checks that need no build run beside it.**
  Typecheck, lint and the unit suite run in a job of their own that does not wait for `build`, the unit suite split into `CI_UNIT_SHARDS` (2) parallel jobs; the e2e shards run e2e only.
  FR-CI-1's selection holds: a pull request runs the unit tests and specs its change reaches.
  *Verification:* the workflow's job graph (a test reads `ci.yml`); the job summary's stage times on the phase's own pull request.

- **FR-CI-5** *(V216-17)* **The e2e shards are cut by time.**
  The e2e specs are split across the `CI_SHARDS` shards by their recorded durations, longest first into the shard with the least, from a committed table of seconds per spec that a script refreshes from a run's JSON report; a spec missing from the table counts as the table's median.
  On a full run no shard's e2e stage is more than `CI_SHARD_SPREAD_S` (60 s) longer than the shortest's, rationale: today's spread is 3.5 min, and a minute absorbs a runner's variance.
  *Verification:* a unit test of the split (a table, a missing spec, more shards than specs); the phase's full run shows the spread in the job summary.

- **FR-CI-6** *(V216-17)* **The capture set answers the questions and runs on four runners.**
  Every capture route answers the follow question and the first-pass dialog the way a returning reader does before it acts, so no capture waits on an overlay.
  The set is shot on `CAPTURE_SHARDS` (4) parallel jobs, and one job after them gathers the files, checks the set complete (FR-CI-2) and commits to the captures branch, within `CAPTURES_BUDGET_MIN` (20).
  *Verification:* the set's run on the phase's first push to `main` is green with no retry, inside the budget.

#### Amended

- **FR-CI-1** *(amended v2.16, V216-17; before: `CI_PR_BUDGET_MIN` 10 and the whole-program checks on shard 1)*: `CI_PR_BUDGET_MIN` is 8; the typecheck, lint and unit stages are FR-CI-4's job, not shard 1's.
- **FR-CI-2** *(amended v2.16, V216-17; before: one job shoots the set)*: the set runs as FR-CI-6 says.
- **FR-MEAS-2** *(amended v2.16, V216-7; before: `where_shown` with no detail, and `when_shown` and `what_shown` sent by the first run's steps)*
  Added: `example_shown`, sent once when the band or the Where pane shows its answer or the fallback is chosen, with `detail` `pass` (an answer), `none` (no visible pass in 72 h), `no_city`, `failed` (the elements, the worker or the run) or `slow` (`EXAMPLE_WAIT_MS` passed).
  `where_shown` gains `detail`: `example` when FR-OPEN-5 opens from the action, `fallback` when FR-OPEN-6 shows the question.
  `when_shown` and `what_shown` are removed: there are no steps to count.
- **FR-MEAS-6** *(amended v2.16, V216-7; before: one row each for `where_shown`, `place_set`, `when_shown`, `what_shown`, `door` and `pass_open`, shares of `where_shown`'s)*
  For first visits the rows are `example_shown` by detail, `where_shown` by detail, `place_set` by method, `door` by door and `pass_open`, each with its count of distinct `id`s and its share of the first visits' `open` on `home`.
- **US-58 AC3** *(amended v2.16)*: the walk is US-61 AC4's.
- **FR-FIRST-1** *(amended v2.16, V216-3)*: the cold open is FR-OPEN-6's fallback only, with no step line; the wide form (V20-17) stands for the fallback; `[ live ]` with no observer reads "The live sky needs a place." only where there is no example (FR-OPEN-7).
- **FR-FIRST-4** *(amended v2.16, V216-4; before: a first visit is the three steps where, when, what)*: a first visit is the example (FR-OPEN-3) and, once a place is set, the stacked home; the when and what steps, the step line and their footer form are removed; every later visit is unchanged.
- **FR-FIRST-7** *(amended v2.16)*: the first-visit captures are FR-OPEN-11's.

#### Definition of done

- FR-OPEN-1..14, FR-CI-4..6, FR-CI-1, FR-CI-2, FR-MEAS-2, FR-MEAS-6, FR-FIRST-1, FR-FIRST-4 and FR-FIRST-7 as amended met, each by its verification line; US-60 and US-61 by their criteria.
- `npm test` green; `npm run bundle:budget` no row over 2.15.0's by more than 1 KB without a named reason in the release record, the zone table in its own row.
- `npm run funnel` on the first production day prints the amended rows.
- `package.json` reads 2.16.0; the release record lists the captures that move (FR-OPEN-9, FR-OPEN-11).
- The tag and the deploy are the owner's.

### Phase 2y — v2.16 ("an answer first", as decided 2026-11-18, V216-1)

Built right after v2.15, which shipped as 2.15.0 on 2026-11-19, so no task waits on it (V216-16); the CI work goes in the first waves, before the screens (V216-17).
A first visit opens on tonight's next pass for the time zone's city, labelled as an example, with one action to set a place, and the place question as the fallback.
Goals G69–G71, §4.59, §4.60, FR-OPEN-1..14, FR-CI-4..6, FR-CI-1, FR-CI-2, FR-MEAS-2 and FR-MEAS-6 amended, FR-FIRST-1, FR-FIRST-4 and FR-FIRST-7 amended, US-60..US-61; the decisions are V216-1..V216-18.
