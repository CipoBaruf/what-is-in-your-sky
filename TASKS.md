# What Is In Your Sky Right Now — Task Breakdown

## Status

This file holds the open phase, v2.14; each closed phase's tasks are in its folder, moved byte for byte (FR-SDD-3).
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
| v2.14 | R182 … R191 | 0 of 10 | this file |

## v2.14 tasks

Draft, cut 2026-11-04 from the phase folder `docs/sdd/phases/v2.14/` (`spec.md` §2.21, §4.57, Phase 2w;
`plan.md` §2.50, §8.21, §9.16, §16.33).
Spec Phase 2w, "one sky on a desk": on a desk the live page, the stars page and the pass detail are one layout with the globe as the whole sky, the passes on it, one time control with the clouds, the facts of a satellite, a star or a planet, the keys and the full screen.
At every width, the star names, the remembered choices and the privacy note closed once.
With the release, the README, the reading order and the repository's description for 2.14.0 (G62..G66, US-52..US-57, V214-1..V214-24).
P10 (D-1094, #285) landed the networked data first:
`facts.json`, the reviewed `names-es.tsv`, the designations and the rise/set fixture.

Delivery is PLAN §16.33: ten tasks in six waves, `Tier: hard` on R184 and R186 (one per wave), `standard` on the rest; every task `Turns: 500`, `Fallback: off`, `Gate: auto`, merged by hand on CI green and a clean review with an explicit commit message; the review tier is D-1065's.
The `Lane:` field takes the driver's list; the files each task may touch outside its lane are named under **Touches outside the lane**.
Wait-and-resume is on; the owner reads `/usage` before waves 1 and 2.

Decision block (§16.2), reserved in PLAN §16.33: **R182 D-1109..D-1110, R183 D-1111..D-1112, R184 D-1113..D-1115, R185 D-1116..D-1117, R186 D-1118..D-1121, R187 D-1122..D-1123, R188 D-1124..D-1125, R189 D-1126..D-1127, R190 D-1128..D-1129, R191 D-1130..D-1131**. D-1094..D-1108 are the plan's.

What every session reads, named in each task as "the phase set": the task's entry and each id it names by `npm run sdd:id <id>`; SPEC §4.57's constants table; US-52..US-57's criteria for the task's ids; PLAN §16.33 and the §2.50 decisions the task names. Never the phase files whole.

### Wave 1

- [x] **R182 — The saved choices underneath: `globe` as a view, `viewFor`, the new prefs keys with their defaults, and the privacy note's flag** — the stars page reads a saved `dome` as its whole sky and `defaultChartView` keeps 2.13's answer until R186 (D-1109); FR-KEEP-3's ×1 is the opening rate (D-1110).
  - **Lane:** data
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** the phase set; SPEC FR-WIDE-2, FR-KEEP-1, FR-KEEP-3, FR-KEEP-4, FR-LOC-5, FR-WIN-5; PLAN D-1095, D-1096, D-1105, D-876.
  - **Goal:** the store can hold every FR-KEEP-1 choice and the privacy flag, an empty store answers FR-KEEP-3's table, and one function says which view a page opens on at a width; the pages keep reading what they read today, so nothing on screen moves except that the wide stars page and the pass detail ask `viewFor` (same answer as now where nothing is saved).
  - **Satisfies:** FR-KEEP-3 (the table), FR-KEEP-1 (the keys and setters; the pages are R190's), FR-WIDE-2 (the mapping; the row is R186's), FR-KEEP-4 (the selector; the controls are R190's).
  - **Scope (D-1095, D-1096, D-1105):** `src/model/prefs.ts` — `ChartView` gains `'globe'`, one constant per FR-KEEP-3 row; `src/data/localPrefs.ts` — `storedPrefsSchema` gains `starLayers`, `namesChoice`, `faintStars`, `globeTurn`, `globeZoom`, `windowFov`, `playSpeed`, `privacyNoteClosed`, each optional and validated alone, zoom and field clamped on read, key stays `v1`; `src/state/slices/prefs.ts` — one setter per key, writing only what the reader chose; `usePrivacyNote()` returning `{ shown, close }`; `src/ui/screens/chartViewDefault.ts` becomes `viewFor(page, mode, saved)` (with `defaultChartView` kept as a thin caller until R186 removes it).
  - **Touches outside the lane:** `src/model/prefs.ts` (physics-owned, types and constants only), `src/ui/screens/chartViewDefault.ts`.
  - **Deletes:** the cases of `chartViewDefault.test.ts` that pin `dome` as the wide default, rewritten as `viewFor.test.ts`.
  - **Captures:** none.
  - **Out of scope:** any page reading the new keys (R190); the `View` row's third value (R186); the `[ × ]` controls (R190).
  - **Done when:**
    - `viewFor.test.ts` covers every page × width × saved value (nothing, `globe`, `polar`, `window`, `dome`) with FR-WIDE-2's mapping.
    - `localPrefs.test.ts`: each new key's round trip, its clamp, and a bad value that drops that key alone; `prefs.test.ts` pins FR-KEEP-3's table.
    - A slice test: an untouched choice writes nothing to the store.
    - `npm run check` green; no capture moves.

- [x] **R183 — The numbers: a satellite's height range, rise and set for a star, a planet and the Moon, and the cloud bands**
  - **Lane:** physics
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** the phase set; SPEC FR-FACT-1 (the height), FR-FACT-3 (rise and set), FR-WIDE-8, FR-WX-1, FR-WX-3, FR-GLOBE-17; constants `FACT_HEIGHT_STEP_KM`, `CLOUD_STEPS`; PLAN D-1100 (the cloud band), D-1101.
  - **Goal:** the pure functions the facts and the stripe need exist and are pinned by numbers against the committed references; nothing on screen moves yet.
  - **Satisfies:** FR-FACT-1 (the height), FR-FACT-3 (rise and set), FR-WIDE-8 (the bands and runs; the drawing is R187's).
  - **Scope (D-1101, D-1100):** `src/lib/orbitHeight.ts` (perigee and apogee from the OMM's mean motion and eccentricity, Earth's equatorial radius, rounded to `FACT_HEIGHT_STEP_KM`, one number when equal) and a selector in `src/state/slices/elements.ts` from the records it holds; `src/lib/riseSet.ts` (a star from its J2000 position, latitude and sidereal time; a planet and the Moon through `astronomy-engine`'s `SearchRiseSet`; `never sets` / `never rises`); `src/lib/cloudBand.ts` (an hourly cloud series to the four bands and the runs of equal bands, the hour with no forecast a gap); the lint allowance for `astronomy-engine` gains `riseSet.ts` and PLAN §3's table its row.
  - **Touches outside the lane:** `src/lib/{orbitHeight,riseSet,cloudBand}.ts`, `src/state/slices/elements.ts` (the selector), the ESLint config (one path).
  - **Deletes:** none.
  - **Captures:** none.
  - **Out of scope:** any component (R187, R188); the worker contract (unchanged, D-1101).
  - **Done when:**
    - `riseSet.test.ts`: Sirius over Bariloche on the fixture's night against USNO, Jupiter and the Moon against `tests/fixtures/rise-set-horizons.json`, each within ±2 min; a circumpolar and a never-rising star.
    - `orbitHeight.test.ts` against a fixed OMM; `cloudBand.test.ts`: bands and runs for a fixed forecast, the gap.
    - `npm run check` green; the golden fixtures pass untouched.

- [x] **R184 — The globe takes the passes and the planets: arcs in legend colours with ticks and an arrow, the hover hit test, planet discs and labels**
  - **Lane:** chart
  - **Tier:** hard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** the phase set; SPEC FR-WIDE-3, FR-WIDE-7 (ticks, arrow, the arc's hover), FR-WIDE-11, FR-NAME-3, FR-TRAJ-1, FR-LEG-4, FR-LEG-5, FR-GLOBE-11, FR-GLOBE-15, FR-SKY-1; constants `ARC_TICK_MIN`, `ARC_ARROW_SHARE`, `PLANET_MARK_PX`, `SKY_GLOBE_KB`; PLAN D-1099, D-1104, D-1038, D-817.
  - **Goal:** `SkyGlobe` given passes, a highlighted pass and `t` draws each pass's near-side arc in its legend colour by FR-TRAJ-1's state with its marker and key, the highlighted one with minute ticks and an arrow, reports which arc is under the pointer, and draws the five planets as coloured discs with labels that stay with the names off; the stars page shows the planets' new look, nothing else mounts the arcs yet.
  - **Satisfies:** FR-WIDE-3 (the drawing; the mounting is R186's), FR-WIDE-7 (the globe's ticks, arrow and arc hit test), FR-NAME-3 (the globe and the tokens), FR-WIDE-11 (the globe's rate and `SKY_GLOBE_KB`).
  - **Scope (D-1099, D-1104):** pure `skychart/globe/arcs.ts` (track points to J2000 directions through `scene.ts`'s local frame, FR-TRAJ-1's state through `lib/arcReveal.ts`, tick points, the arrow's point and heading); the renderer draws one fixed `<path>` per series (`SERIES_COUNT`), the ticks and the arrow as one path each, five planet discs; the hit test is the projected polyline's distance within 8 px, at most once a frame on `pointermove`; `SkyGlobe` gains `passes`, `highlightedPassId`, `t`, `onPassHover`, `onPick`; `skychart/layers.ts` gains the `globe` row (the window's minus `fieldOutline`); `tokens.css` gains `--chart-planet-*` and `--chart-cloud-{1,2,3}` in both themes; `scripts/contrast.ts` adds them to `CHART_MARK_TOKENS`.
  - **Touches outside the lane:** `src/ui/styles/tokens.css`, `scripts/contrast.ts`.
  - **Deletes:** none.
  - **Captures:** none added; the wide stars-page captures move by the planets alone.
  - **Out of scope:** mounting the globe on the live page and the pass detail (R186); the window's ticks and planets (R185); the facts on a pick (R188).
  - **Done when:**
    - `arcs.test.ts`: a fixed pass's polyline at three instants of FR-TRAJ-1's states, the ticks' count and places, the arrow's point at `ARC_ARROW_SHARE` and at the marker while up.
    - `SkyGlobe.test.tsx`: three passes draw three arc paths in the legend tokens; the node count stays under `GLOBE_MAX_NODES`; with names off five planet labels and no star label.
    - `globe-perf.spec.ts` on the stars page with three passes fed by a test harness holds ≥ 30 updates/s at 1280 × 800 and 1920 × 1080, CPU 4×, best of three.
    - `contrast.ts` green with the new tokens in every theme; `npm run bundle:budget` with `globe` inside `SKY_GLOBE_KB`; `npm run check` green.
  - *Done note:* the tests that pinned the old look moved too (`GlobeRenderer.test.ts`, `dome/palette.test.tsx`, `tests/styles/tokens.test.ts`) and `docs/DESIGN.md` was regenerated; the perf harness is `window.__globeHarness` (D-1114); `globe` is 15.9 KB, +2.1 inside `SKY_GLOBE_KB` and an accepted overrun of its 15 KB row (D-1115).

### Wave 2

- [x] **R185 — The window gets the same: ticks, arrow, the arc's hover, planet discs; and a label for every bright unnamed star**
  - **Lane:** window
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R184
  - **Reads:** the phase set; SPEC FR-WIDE-7, FR-NAME-2, FR-NAME-3, FR-STAR-7, FR-SKY-14; constants `ARC_TICK_MIN`, `ARC_ARROW_SHARE`, `PLANET_MARK_PX`, `BAYER_LABEL_MAG`; PLAN D-1099 (the tick and arrow geometry, reused), D-1104.
  - **Goal:** on wide the window's highlighted arc carries the globe's ticks and arrow and reports a hover on an arc; the planets are the globe's discs; at every width every unnamed star brighter than `BAYER_LABEL_MAG` is labelled `γ Vel` after the proper names, and the polar chart, the globe and the lists pick that up from the same rule.
  - **Satisfies:** FR-WIDE-7 (the window), FR-NAME-2, FR-NAME-3 (the window).
  - **Scope:** `skychart/window/**` — ticks and arrow from `globe/arcs.ts`'s helpers, the hover hit test and an `onPassHover` prop, planet discs on wide; `window/starLabels.ts` places designation names after the proper names; the "is labelled" rule as one predicate in `src/lib/skyStars.ts` (a proper name, or `desig` and `mag < BAYER_LABEL_MAG`) read by every label and list.
  - **Touches outside the lane:** `src/lib/skyStars.ts` (the predicate).
  - **Note (from R184):** the globe pads the planets' name boxes 14 / 12 because `starLabels.ts` measures every label at the star names' size; give `starLabels` a per-label size and the globe can drop the padding (D-1113).
  - **Deletes:** none.
  - **Captures:** none added; files showing a bright unnamed star move by its label.
  - **Out of scope:** the window's mounting in the new shell (R186); the facts on a pick (R188).
  - **Done when:**
    - `starCatalog.test.ts` pins the 33 designation labels and their count; `starLabels.test.ts`: a designation never displaces a proper name.
    - A window test: the highlighted arc's ticks and arrow; a pointer within 8 px of an arc fires `onPassHover` with its id.
    - `npm run check` green; `sky-window.spec.ts` green.
  - **Done (R185):** also touched, for the goal's "the polar chart, the globe and the lists": `polar/PolarStars.tsx`, `globe/GlobeRenderer.ts` (the rule, and the planet padding dropped), `globe/arcs.ts` and `arcLayer.ts` (the shared helpers), `SkyChart.types.ts` (`onPassHover`); D-1116, D-1117.

- [x] **R186 — One shell on a desk: the live page, the stars page and the pass detail in `SkyViewLayout`, the globe on all three, the dome by choice, the box's corners** — `GuidePanel` went whole (D-1118); the braille font is the mark's, so only the dome chunk is pinned absent (D-1120); the `globe` row stays at 15 and warns (D-1121).
  - **Lane:** ui
  - **Tier:** hard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R182, R184
  - **Reads:** the phase set; SPEC FR-WIDE-1, FR-WIDE-2, FR-WIDE-3, FR-WIDE-5, FR-WIDE-6, FR-WIDE-11 (the live page's rate), FR-DESK-3, FR-GLOBE-1; US-52 AC1, AC2, AC3, AC5, AC6, AC7; PLAN D-1095, D-1098, D-1099, §8.21's chunk table.
  - **Goal:** at a desk the three pages are one layout — box left, rail right in `head → View → Time → page group → list` — with the app's header and footer; the `View` row reads `Globe Window Dome` everywhere, saved and shared through `viewFor`; the live page and the pass detail draw the globe with their passes; the dome loads only when chosen; the zoom, readout, hint and full-screen corners are the same on every page; the phone is unchanged.
  - **Satisfies:** FR-WIDE-1, FR-WIDE-2, FR-WIDE-3 (mounted), FR-WIDE-5, FR-WIDE-6, FR-WIDE-11 (the live page's rate); US-52 AC1–AC3, AC5–AC7.
  - **Scope (D-1098, D-1095):** `components/sky/SkyViewLayout` gains the wide `SLOT_ORDER` and the four corner slots of the chart (`readout`, `fullscreen` as an empty slot R189 fills, `hint`, `zoom`); each page's rail slots as separate modules under `screens/sky/<page>/` (`Time.tsx` holding today's time control, `Group.tsx` its page group), so R187 and R188 edit different files; `PassDetail` on wide renders the layout in the home's place (list in the `list` slot with the card highlighted, `Esc` / `[ × ]` / `[ home ]` back to the card), `GuidePanel` kept for compact only, `WIDE_SPLIT_MIN_CELLS` and its test removed; the live page's one-row header and hidden footer go on wide; `SkyChart.tsx` mounts the globe for `'globe'` and lazy-loads the dome only when chosen, the globe prefetched on idle on wide; `defaultChartView` removed for `viewFor`; the stars page's `StarsView` state goes.
  - **Touches outside the lane:** `src/ui/screens/Live*` and `components/live/**` (the page shell only; the time control's move is R187's), `skychart/SkyChart.tsx`.
  - **Note (from R184):** retire `window.__globeHarness` once `globe-perf.spec.ts` measures the live page (D-1114), and move the `globe` budget row in `scripts/bundle-budget.ts` to cover R184's 15.9 KB (D-1115).
  - **Deletes:** the specs and tests that pin the old wide shell or the dome as the wide default — `GuidePanel`'s wide split tests, the wide cases of `home-desk.spec.ts`, `desktop.spec.ts`, `pass-detail.spec.ts`, `live.spec.ts`, `sky-dome.spec.ts` and `dome-*.spec.ts` that assume the dome without choosing it — each rewritten in place to the new shell or to `Dome` chosen, listed in the PR.
  - **Captures:** the manifest gains `sky-live-globe` and `sky-pass-globe` (1280 × 800, Bariloche, the set's instant, the set's languages and themes); the wide dome entries re-shot with `Dome` chosen.
  - **Out of scope:** the shared time control (R187), the facts (R188), the keys and full screen (R189), the other saved choices (R190).
  - **Done when:**
    - `sky-layout.spec.ts` at 1024 × 640, 1280 × 800, 1920 × 1080: box left and top, rail left and width and group order equal on the three pages to the pixel; each corner extra in its corner per view; `Window` chosen on the live page is found on the stars page and the pass detail after a reload; `Esc` on the pass detail returns home with the card in view.
    - `globe.spec.ts` live case: three arcs at the set's instant, colours the legend's.
    - A test that a wide page with nothing saved requests no `SkyDome-*.js` and no braille font; the dome specs green with `Dome` chosen.
    - `globe-perf.spec.ts` on the live page ≥ 30 updates/s under a drag and ×3600 at both desk sizes, CPU 4×, best of three.
    - Every compact spec green and no compact capture moved; `npm run check` green; `npm run bundle:budget` green.

### Wave 3

- [ ] **R187 — One time control: the live page's overview, stripe and playback on all three desk pages, the stars page's day steps under it, the pass's times as buttons, the clouds on the stripe**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R183, R186
  - **Reads:** the phase set; SPEC FR-WIDE-4, FR-WIDE-8, FR-SPAN-2, FR-LIVE-4, FR-LIVE-5, FR-GLOBE-7, FR-GLOBE-8, FR-FLOW-7; constants `CLOUD_STEPS`, `CLOUD_BAND_PX`, `GLOBE_SPAN_DAYS`; PLAN D-1100.
  - **Goal:** the three desk pages share the `Time` group (overview, stripe while scrubbing, playback); the stars page keeps `−1 d −1 h +1 h +1 d` under it and a day step moves the span; the pass detail's rise, peak and set set `t`; the overview and the stripe carry the cloud band with its sentence.
  - **Satisfies:** FR-WIDE-4, FR-WIDE-8; US-52 AC4, US-55 AC3.
  - **Scope (D-1100):** `StripeOverview`, `TimeStripe`, `PlaybackControls` and `usePlayback` move from `components/live/` to `components/sky/time/` (imports updated, the `Live` chunk no longer their only home); `usePlayback` gains `shiftDays`; the three pages' `screens/sky/<page>/Time.tsx`; the pass detail's FR-FLOW-7 cells become buttons; the cloud band as one `<path>` per band from `lib/cloudBand.ts`, an empty hour left blank, the runs sentence in the stripe's description in both catalogs.
  - **Touches outside the lane:** `components/sky/time/**`, `screens/sky/*/Time.tsx`, the pass detail's times row, `src/i18n/**` (the cloud sentence, in the `live` section).
  - **Note (from R186):** remove the wide overlay branch, the fold and the overlay inventory (`useInventoryRows(... 'overlay')`) in `Live.tsx` per D-1133.
  - **Note (from R186's review):** `LiveGroup` and `PassGroup` choose the `Facing` section (the `picker` slot) from `viewFor`'s view, not the view `SkyChart` draws; after following ends `SkyChart` holds the window (`heldView`) while `hintView` says `globe`, so the facing row loses its slot. Feed the drawn view (and the hint) from `SkyChart` on both pages.
  - **Deletes:** the stars page's clock row and its tests (FR-GLOBE-7's steps re-tested under the playback row).
  - **Captures:** the manifest gains `sky-clouds` (1280 × 800).
  - **Out of scope:** the keys `,` `.` `t` `Space` (R189); `playSpeed` read from the store (R190).
  - **Done when:**
    - `sky-layout.spec.ts`: the three `Time` groups have the same controls in the same order.
    - `stars.spec.ts`: `+1 d` twice moves the globe two days and the stripe to that night; `[ now ]` brings it back.
    - `pass-detail.spec.ts`: the peak cell sets the readout to the peak time.
    - A component test: the band's cells for a fixed forecast, the gap blank, the sentence in both languages; `live-playback.spec.ts` green.
    - `npm run check` green.

- [x] **R188 — The facts and the hover: `This satellite` on the pass detail and the live page's pick, a star's, a planet's or the Moon's facts, and list rows and arcs answering each other** — the chunk carries `factsShown.json`, the facts without their sources, to fit `FACTS_BUDGET_KB` (D-1124); the words ride in the chunk (D-1125); the stars page's `Group.tsx` takes the group as a child, unchanged.
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R183, R185, R186
  - **Reads:** the phase set; SPEC FR-FACT-1, FR-FACT-2, FR-FACT-3, FR-WIDE-7 (the rows and arcs), FR-LEG-4, FR-WIDE-11 (the facts chunk), FR-GLOBE-11, FR-STAR-7, FR-MOON-*; constants `FACTS_BUDGET_KB`; PLAN D-1101.
  - **Goal:** at a desk a pass's detail shows who flies it, what for, since when, how big and how high; on the live page a click, tap or `Enter` on a legend row or an arc shows the same; a click or `Enter` on a star, a planet or the Moon on the globe or the window shows its names, magnitude, place and rise and set; `Esc` or `[ × ]` closes; hovering or focusing a list card or legend row emphasises its arc and hovering an arc its row, changing no state; the phone loads none of it.
  - **Satisfies:** FR-FACT-2, FR-FACT-3, FR-FACT-1 (shown), FR-WIDE-7 (wired), FR-WIDE-11 (the `facts` chunk); US-53 AC2–AC4, US-54 AC1, US-55 AC1.
  - **Scope (D-1101):** `components/sky/facts/FactsGroup.tsx` (the satellite's and the sky object's groups), lazy as `facts-*.js`, prefetched on idle after the globe on wide; the three pages' `screens/sky/<page>/Group.tsx` mount it; the live page's pick wires `onPick` from the globe (R184) and the window (R185) and the legend rows; a transient hover id beside the page's highlight, fed by the rows' hover and focus and by `onPassHover`, never written to the hash or the store; the heading takes focus when opened from the keyboard; `factsGroup` words and the purpose phrases in both catalogs; `scripts/bundle-budget.ts` gains `{ name: 'facts', limitKb: 6 }`.
  - **Touches outside the lane:** `screens/sky/*/Group.tsx`, `scripts/bundle-budget.ts`.
  - **Deletes:** none.
  - **Captures:** the manifest gains `sky-pass-facts`, `sky-live-facts`, `sky-stars-star-facts`, `sky-hover` (1280 × 800).
  - **Out of scope:** the `a` key and the key overlay (R189).
  - **Done when:**
    - `FactsGroup.test.tsx` in both languages: a station, a rocket stage, a star (`Sirio · Sirius`), a planet, the Moon, a never-setting star.
    - `legend-hover.spec.ts`: hover a row, the arc's class; hover the arc, the row's class; leave, both restored; the hash unchanged.
    - `live.spec.ts`: click the arc, the group; `Esc`, gone. `stars.spec.ts`: click the list's first row's mark, the group.
    - A test that the compact pages request no `facts-*.js`; `axe.spec.ts` covers a facts group open on each page.
    - `npm run bundle:budget` with `facts` inside `FACTS_BUDGET_KB`; `controlRows.test.ts` green; `npm run check` green.

### Wave 4

- [ ] **R189 — The keys and the full sky: `g w d , . t Space a f` in one table, the `?` overlay from it, and the box in full screen**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R187, R188
  - **Reads:** the phase set; SPEC FR-WIDE-9, FR-WIDE-10, FR-DESK-4, FR-SKY-13, FR-TRAJ-4; US-56; PLAN D-1102, D-1103.
  - **Goal:** on the three desk pages the reader picks a view, steps the hour, returns to now, plays and pauses, faces the pass and goes full screen from the keyboard, the `?` overlay lists every key, and `f` or `[ full screen ]` gives the box the screen with the readout and `[ × ]` and back with nothing changed.
  - **Satisfies:** FR-WIDE-9, FR-WIDE-10; US-56 AC1, AC2.
  - **Scope (D-1102, D-1103):** `src/lib/shortcuts.ts`'s `SHORTCUTS` and `PAGE_KEYS` gain the keys, `f` moves to full screen and `a` faces the pass; one `SkyKeyActions` object per page passed to `useShortcuts`; the overlay reads the table; `src/lib/fullscreen.ts` (`enterFullscreen`, `exitFullscreen`, `fullscreenSupported`); `SkyViewLayout` holds `full`, fills the `fullscreen` corner, listens for `fullscreenchange` and refits with the rail at zero; the control absent where the API is.
  - **Touches outside the lane:** `src/lib/{shortcuts,fullscreen}.ts`, `src/ui/hooks/useShortcuts.ts`, the overlay, `components/sky/SkyViewLayout.tsx`, the pages' action objects, `src/i18n/**` (the overlay's lines).
  - **Deletes:** every spec step that presses `f` to face the pass (`shortcuts.spec.ts`, `desktop.spec.ts`, `home.spec.ts` and any other the grep finds), rewritten to `a`.
  - **Captures:** the manifest gains `sky-fullscreen` (1280 × 800).
  - **Out of scope:** the saved choices (R190).
  - **Done when:**
    - A unit test that no two entries of the key table share a key.
    - `keys.spec.ts`: each key on each page.
    - `fullscreen.spec.ts` with `requestFullscreen` stubbed by an init script: enter and leave on each view, `data-full` set, the box refit, the camera and `t` read back equal.
    - `npm run check` green.

### Wave 5

- [ ] **R190 — Your sky as you left it: every page reads and writes the kept choices, opens at now, and the privacy note closes for good**
  - **Lane:** data
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R189
  - **Reads:** the phase set; SPEC FR-KEEP-1, FR-KEEP-2, FR-KEEP-3, FR-KEEP-4, FR-PHONE-7, FR-GLOBE-10, FR-SHARE-1; US-57; PLAN D-1096, D-1097, D-1105, D-1108.
  - **Goal:** on a phone and at a desk the view, the layers, the names, the faint stars, the globe's turn, the zoom, the field and the speed come back after a reload and in a new tab; the time is always now, the camera and the globe's place open by their rules, a share link wins without saving; either privacy `[ × ]` hides both lines for good while the settings page still says it.
  - **Satisfies:** FR-KEEP-1, FR-KEEP-2, FR-KEEP-4, FR-KEEP-3 (end to end); US-57 AC1–AC4.
  - **Scope (D-1096, D-1097, D-1105, D-1108):** the pages' state hooks read and write `starLayers`, `namesChoice`, `faintStars`, `globeTurn`; `SkyGlobe`'s zoom and the window's field from `globeZoom` and `windowFov`; `usePlayback` takes `playSpeed` as `play`'s rate and opens at now; `Footer` and `LocationInput` render `[ × ]` from `usePrivacyNote()`, the footer row closing up; `Settings` renders `t.settings.privacy` plainly; the reload sweep: grep `tests/e2e/**` for a reload or `goto` after a choice that expects a default and seed or clear the store there, each listed in the PR.
  - **Touches outside the lane:** the pages' state hooks, `components/sky/time/usePlayback.ts`, `skychart/globe/SkyGlobe.tsx` and `skychart/window/**` (the zoom and field props only), `components/common/Footer.tsx`, `components/location/LocationInput.tsx`, the settings screen, `src/i18n/**` (the close label), `tests/e2e/**` (the reload fixes).
  - **Deletes:** the tests that pin the stars page's view or the faint stars resetting at each open (FR-PHONE-7, FR-GLOBE-10 amended).
  - **Captures:** none added; files showing the privacy line move by its `[ × ]`.
  - **Out of scope:** the release (R191).
  - **Note (from R186):** on the live page, crossing the 963/964 px breakpoint re-mounts the page (main kept one tree), so state not in the URL or the kept choices is lost; keep one tree across the breakpoint or carry that state, with a test that resizes across it.
  - **Done when:**
    - `keep.spec.ts` at 390 × 844 and 1280 × 800: make every choice, reload, find it; scrub, turn, pick a saved place, reload: now, the opening aim, the reader's place; an empty store opens on FR-KEEP-3's table; close the note on the home, reload, the stars page has none, the settings page has the sentence.
    - `Footer.test.tsx` and `LocationInput.test.tsx`: shown, closed by either, gone from both.
    - The full e2e suite green (`npm test`), the reload fixes listed in the PR; `npm run check` green.

### Wave 6

- [ ] **R191 — 2.14.0: the capture set re-shot, every budget row re-set, the README, the reading order, the images, the repository's description and topics**
  - **Lane:** docs
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R190
  - **Reads:** the phase set; `docs/sdd/workflows/release.md`; SPEC FR-WIDE-11, FR-WIDE-12, FR-PUB-14, FR-PUB-15, FR-PUB-16, FR-CAP-5, FR-SDD-22; constants `SKY_MAIN_KB`; V214-20, V214-22; PLAN D-1107, D-178.
  - **Goal:** `main` reads 2.14.0 with every new capture in the set, every bundle row re-set, a README, reading order, hero and social preview that describe this release, and the description and topics written for the owner's `gh repo edit`; the owner can run the desk and phone checks, tag and deploy.
  - **Satisfies:** FR-WIDE-12, FR-WIDE-11 (the rows), FR-PUB-14, FR-PUB-15, FR-PUB-16; US-52 AC7.
  - **Scope (D-1107):** `tests/e2e/{captureSet,captureSeeds,v1-captures}.ts` hold the eight new ids (`sky-live-globe`, `sky-pass-globe`, `sky-pass-facts`, `sky-live-facts`, `sky-stars-star-facts`, `sky-hover`, `sky-clouds`, `sky-fullscreen`) in the set's languages and themes; `scripts/bundle-budget.ts` rows by D-178, `main` within `SKY_MAIN_KB` or the ceiling's next 5 KB line flagged for the owner (V214-20); `README.md` by FR-PUB-14 and `docs/HOW-THIS-WAS-BUILT.md`'s reading order by FR-PUB-15; `scripts/readme-hero.ts` re-run on the 2.14 captures; `tests/docs/readme.test.ts`; `docs/sdd/phases/v2.14/release.md` with the description, homepage and twenty topics, the moved-capture list and the owner's desk and phone checklist; `package.json` 2.14.0.
  - **Touches outside the lane:** `tests/e2e/{captureSet,captureSeeds,v1-captures}.ts`, `scripts/bundle-budget.ts`, `package.json`.
  - **Deletes:** none.
  - **Captures:** the eight ids are added by R186–R189; here the whole set re-shot by `captures.yml` on the `captures` branch with the pixel-diff report.
  - **Out of scope:** the tag, the deploy, `gh repo edit` (the owner's).
  - **Done when:**
    - `captureIds.test.ts` green with the eight ids; the `captures.yml` run's report linked in `release.md`, each moved file tied to a named change.
    - `readme.test.ts`: the live line's version equals `package.json`'s; no "in progress"; every relative link in `README.md` and the reading order resolves; each "By the numbers" figure carries the release date.
    - `npm run bundle:budget` every row inside its budget; `npm test` green; `npm run check:sdd` green.

### Requirement coverage (v2.14)

| Requirement | Task |
|---|---|
| FR-WIDE-1 | R186 |
| FR-WIDE-2 | R182 (the mapping), R186 (the row) |
| FR-WIDE-3 | R184 (the drawing), R186 (mounted) |
| FR-WIDE-4 | R187 |
| FR-WIDE-5 | R186 (the corners), R189 (the full-screen corner) |
| FR-WIDE-6 | R186 |
| FR-WIDE-7 | R184 (globe), R185 (window), R188 (rows and arcs wired together) |
| FR-WIDE-8 | R183 (bands), R184 (tokens), R187 (drawn) |
| FR-WIDE-9 | R189 |
| FR-WIDE-10 | R189 |
| FR-WIDE-11 | R184 (globe rate, `globe` row), R186 (live page's rate), R188 (`facts` row), R191 (every row) |
| FR-WIDE-12 | R186–R189 (their captures), R191 (the set) |
| FR-FACT-1 | P10 (the file), R183 (the height), R188 (shown) |
| FR-FACT-2 | R188 |
| FR-FACT-3 | P10 (the fixture), R183 (rise and set), R188 (shown) |
| FR-NAME-1 | P10 |
| FR-NAME-2 | P10 (the designations), R185 (the labels) |
| FR-NAME-3 | R184 (globe, tokens), R185 (window) |
| FR-KEEP-1 | R182 (keys), R190 (pages) |
| FR-KEEP-2 | R190 |
| FR-KEEP-3 | R182 (the table), R190 (end to end) |
| FR-KEEP-4 | R182 (the flag), R190 (the controls) |
| FR-PUB-14..16 | R191 |
| US-52 | R186 (AC1–3, AC5–7), R187 (AC4) |
| US-53 | P10 (AC1), R183 (AC4), R188 (AC2–3) |
| US-54 | P10 (AC2), R185 (AC3), R184 + R185 (AC4), R188 (AC1) |
| US-55 | R184 + R185 (AC2), R187 (AC3), R188 (AC1) |
| US-56 | R189 |
| US-57 | R190 |

Waves (for the sanity check):
**wave 1** R182 (data) + R183 (physics) + R184 (chart, hard) — **wave 2** R185 (window) + R186 (ui, hard) — **wave 3** R187 (live) + R188 (ui) — **wave 4** R189 (live) — **wave 5** R190 (data) — **wave 6** R191 (docs).
No pair shares a file:
R182 (`model/prefs.ts`, `localPrefs.ts`, `slices/prefs.ts`, `chartViewDefault.ts`) against R183 (`lib/{orbitHeight,riseSet,cloudBand}.ts`, `slices/elements.ts`, ESLint) against R184 (`skychart/globe/**`, `layers.ts`, `tokens.css`, `contrast.ts`);
R185 (`skychart/window/**`, `lib/skyStars.ts`) against R186 (`components/sky/SkyViewLayout`, the screens, `SkyChart.tsx`, `GuidePanel`, the e2e shell specs);
R187 (`components/sky/time/**`, `screens/sky/*/Time.tsx`) against R188 (`components/sky/facts/**`, `screens/sky/*/Group.tsx`, the pages' hover state, `bundle-budget.ts`) — R186 splits each page's rail slots into those two files so wave 3 can run both.
Waves 1 and 2 each hold one `hard` task.
