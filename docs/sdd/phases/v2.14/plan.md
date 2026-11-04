# v2.14 — PLAN.md sections

Written by `sdd-spec` as a phase folder (V213-2); ids resolve through `docs/sdd/ids.md`.

### 2.50 v2.14 decisions (2026-11-04)

No backend, no database and no dependency is added (§11.1 unchanged): the new data is a static file, the new numbers are computed in the browser, and the saved choices are fields of the store FR-LOC-5 already writes.
The worker contract and the physics do not change, so the golden fixtures pass untouched.
The dome stays on glyphcss (V214-4); the globe of v2.12 becomes every desk page's whole sky.

- **D-1094 — The networked data lands first, as P10, interactive.**
  (FR-FACT-1, FR-FACT-3, FR-NAME-1, FR-NAME-2; V214-19.) Before the breakdown, one interactive session with web search opens one pull request.
  It holds `src/data/catalog/facts.json` with its zod schema `facts.ts` and `facts.test.ts`; `data-src/stars/names-es.tsv` with a sourced row for every named star and every constellation, `build-stars.ts`'s missing-row failure widened (D-832);
  the Bayer/Flamsteed names of FR-NAME-2 written into `catalog.json` as a `desig` name for every unnamed star brighter than `BAYER_LABEL_MAG`; and `tests/fixtures/rise-set-horizons.json` from JPL Horizons.
  The owner spot-checks the sources before it merges; it is not a driver task and carries no `R` id.
  The `stars` chunk grows by the names and labels only (about 1 KB).
- **D-1095 — One saved view, mapped per page and width in one function.**
  (FR-WIDE-2, FR-KEEP-1; amends D-876.) `ChartView` gains `'globe'`; `chartViewDefault.ts` becomes `viewFor(page, mode, saved)`: with nothing saved, `window` on compact and `globe` on wide; a saved value the page or width does not offer maps to the one that stands for it (`globe` ↔ `polar` across the breakpoint, `dome` → `globe` on the wide stars page and `polar` on the compact one).
  Every page reads its view through `viewFor` and writes the reader's pick with `setChartView`; the stars page's own `StarsView` state goes.
- **D-1096 — The saved choices are optional keys of `wiys:prefs:v1`.**
  (FR-KEEP-1..4.) `storedPrefsSchema` gains `starLayers`, `namesChoice`, `faintStars`, `globeTurn`, `globeZoom`, `windowFov`, `playSpeed` and `privacyNoteClosed`, each optional and validated alone, so a bad value drops that key and nothing else (the favourites' rule); the key stays `v1` and nothing migrates.
  The defaults table is `src/model/prefs.ts`'s, one constant per row of FR-KEEP-3; the prefs slice gains one setter per key and writes only what the reader chose.
  Zoom and field are clamped on read to `GLOBE_ZOOM_MIN..MAX` and `WINDOW_FOV_MIN_DEG..MAX`.
- **D-1097 — The time is never read from the store.**
  (FR-KEEP-2.) `usePlayback` takes `playSpeed` as the rate `play` starts at and opens at now, watching, whatever the store holds; the camera, the globe's view and the globe's place keep their opening rules; a share link's `t` wins for that open and writes nothing.
- **D-1098 — The shell is `SkyViewLayout` on all three wide pages.**
  (FR-WIDE-1, FR-WIDE-5; amends FR-DESK-3's shell, D-72.) On wide `PassDetail` renders `SkyViewLayout`'s slots in the home's place (the home's doors and columns unmounted, the list in the `list` slot with the card highlighted), and `GuidePanel` stays only for compact's sheet; `WIDE_SPLIT_MIN_CELLS` and its test go.
  The slot order is fixed in `SLOT_ORDER` for wide (`answer`, `viewRow`, `timeline`, `action`, `layers`, `list`), so the three pages cannot drift; the live page's one-row header and hidden footer on wide go.
  The box's corners are four named overlay slots of the chart slot (`readout`, `fullscreen`, `hint`, `zoom`), so a view supplies its extras and the layout places them.
- **D-1099 — The globe takes the page's passes, through the layer table.**
  (FR-WIDE-3, FR-WIDE-7, FR-NAME-3.) `SkyGlobe` gains `passes`, `highlightedPassId`, `t`, `onPassHover` and `onPick`; `layers.ts` gains a `globe` row equal to the window's minus `fieldOutline`.
  New pure `globe/arcs.ts`: a pass's track points to J2000 directions through `globe/scene.ts`'s local frame (the inverse of `altAz`), FR-TRAJ-1's state through `lib/arcReveal.ts`, the minute ticks and the arrow's point.
  The renderer draws each arc as one fixed `<path>` per series (`SERIES_COUNT`), the ticks and the arrow as one path each, so the node count rises by at most `SERIES_COUNT` + 2 + 5 planet discs and stays under `GLOBE_MAX_NODES`.
  The hover hit test is the projected polyline's distance, computed on `pointermove` at most once a frame.
- **D-1100 — The time control is the live page's components, reused.**
  (FR-WIDE-4, FR-WIDE-8.) `StripeOverview`, `TimeStripe`, `PlaybackControls` and `usePlayback` move from the `Live` chunk to a `time` folder under `components/sky/` imported by the three pages' lazy chunks; the stars page's span is `usePlayback`'s with a `shiftDays` the day steps move.
  The cloud band is a pure `lib/cloudBand.ts` (bands and runs from the weather slice's hourly cloud) and one `<path>` per band in each SVG.
- **D-1101 — The facts are their own lazy chunk.**
  (FR-FACT-1..3, FR-WIDE-11.) `facts.json`, `FactsGroup.tsx` (the satellite's and the sky object's groups) and their words load as `facts-*.js` on wide when a group first opens, prefetched on idle after the globe; `scripts/bundle-budget.ts` gains `{ name: 'facts', limitKb: 6 }`.
  The orbit height is `lib/orbitHeight.ts` (perigee and apogee from the OMM's mean motion and eccentricity, Earth's equatorial radius, rounded to `FACT_HEIGHT_STEP_KM`), read in the elements slice from the records it already holds; no worker message changes.
  Rise and set are `lib/riseSet.ts`: a star's from its J2000 position and the place's latitude and sidereal time, a planet's and the Moon's from `astronomy-engine`'s `SearchRiseSet` as `lib/skyStars.ts` already calls it; it joins `skyStars.ts` in the lint allowance for `astronomy-engine` (§3's table gains the row).
- **D-1102 — One key table.**
  (FR-WIDE-9.) `lib/shortcuts.ts`'s `SHORTCUTS` and `PAGE_KEYS` gain `g`, `w`, `d`, `,`, `.`, `t`, `Space`, `a` and `f` with their new meaning; a test asserts no key appears twice; the `?` overlay reads the table.
  The page actions (`setView`, `stepHour`, `toNow`, `togglePlay`, `facePass`, `fullscreen`) are one `SkyKeyActions` object each page builds and `useShortcuts` takes.
- **D-1103 — Full screen is the layout's, with the browser's API behind one function.**
  (FR-WIDE-10.) `SkyViewLayout` holds a `full` state, calls `enterFullscreen(el)` / `exitFullscreen()` from `lib/fullscreen.ts`, listens for `fullscreenchange`, and re-runs its box measure; the e2e spec stubs `lib/fullscreen.ts`'s calls by an init script and asserts the layout's `data-full` and the refit box.
- **D-1104 — The planets' and the clouds' tokens.**
  (FR-NAME-3, FR-WIDE-8; V214-21.) `tokens.css` gains `--chart-planet-{mercury,venus,mars,jupiter,saturn}` and `--chart-cloud-{1,2,3}` in the dark theme; in the night theme the planet tokens are one, the ramp's brightest, and the cloud tokens the ramp's three lowest; `scripts/contrast.ts` gains them as `CHART_MARK_TOKENS`.
- **D-1105 — The privacy note's flag is read by the footer and the location input.**
  (FR-KEEP-4.) One selector `usePrivacyNote()` returns `{ shown, close }`; `Footer` and `LocationInput` render `[ × ]` beside their lines while `shown`; the settings page renders its sentence from `t.settings.privacy` with no control.
- **D-1106 — `check:sdd` waits for the breakdown.**
  (V214-14.) Already on the spec branch: `newestBrokenDown` in `scripts/check-sdd.ts`.
- **D-1107 — The README and the metadata ride with the release.**
  (FR-PUB-14..16.) The release task runs `readme-hero.ts` on the 2.14 captures, rewrites `README.md` and `docs/HOW-THIS-WAS-BUILT.md`'s reading order, and writes the description and topics into the phase's `release.md` for the owner's `gh repo edit`; `tests/docs/readme.test.ts` checks FR-PUB-14's four rules.
- **D-1108 — The e2e suite and saved choices.**
  (FR-KEEP-1.) Every e2e test starts with an empty store (Playwright's fresh context); the task that adds the keys greps the suite for a reload or `goto` after a choice that expects a default and seeds or clears the store there, listing each in its PR.

### 8.21 One sky on a desk *(v2.14, FR-WIDE-1..12, D-1094..D-1108)*

Nothing new crosses a module boundary: the data is `src/data`'s, the arithmetic `src/lib`'s, the choices the prefs slice's, the drawing `skychart/`'s and the shell `components/sky/`'s.
The desk's three pages become one shell with page slots; the globe, already the stars page's, takes the passes the window takes; the time control moves out of the live chunk to be shared.
The phone keeps every 2.13 component and gains the saved choices, the names and the privacy note's `[ × ]`.

| Request on a wide page | Chunk | When |
|---|---|---|
| the globe | `globe` (`SkyGlobe-*`, `GlobeRail-*`, `scene-*`) | the first wide page with nothing or `globe` saved; prefetched on idle on wide |
| the dome | `SkyDome-*`, the braille font | only when `Dome` is first chosen (FR-WIDE-6) |
| the facts | `facts-*` | when a facts group first opens; prefetched after the globe |
| the time control | `time-*` | with the first sky page |

---

### 9.16 v2.14 additions *(FR-WIDE, FR-FACT, FR-NAME, FR-KEEP, FR-PUB)*

- **Pure by numbers.**
  `globe/arcs.test.ts`, `lib/cloudBand.test.ts`, `lib/orbitHeight.test.ts`, `lib/riseSet.test.ts` (the Horizons fixture), `viewFor.test.ts` (every page × width × saved value), `localPrefs.test.ts` (each key's round trip, clamp and bad value).
- **Data by schema.**
  `facts.test.ts`, `starCatalog.test.ts` (the Spanish forms and the 33 labels pinned), `build-stars.test.ts` (the missing row).
- **Components.**
  `FactsGroup.test.tsx`, `Footer.test.tsx`, `LocationInput.test.tsx`, `SkyGlobe.test.tsx` (arcs, hover, planets), the shortcut table's uniqueness.
- **End to end.**
  `sky-layout.spec.ts` (the one shell, the corners, the shared view), `globe.spec.ts` (arcs on the live page), `legend-hover.spec.ts`, `keys.spec.ts`, `fullscreen.spec.ts`, `keep.spec.ts`, `globe-perf.spec.ts` on the live page, `axe.spec.ts` with a facts group open.
- **Captures.**
  The set re-shot whole by `captures.yml` with the pixel-diff report; the owner reads it (V214-22).

### 16.33 Delivery of the v2.14 tasks *(V214-1..V214-22, D-1094..D-1108)*

The gate is v2.13's (V213-11): auto, merged by hand on CI green and a clean review, every squash merge with an explicit message, at most one `hard` task per wave, the driver's wait-and-resume on.
P10 (D-1094) merges first; then ten `R` tasks in six waves.
The Lane column names each task's file set; the `Lane:` field takes the driver's list (`ui`, `chart`, `data`, `physics`, `live`, `window`, `docs`), one task of a lane per wave.

| Wave | Task | Lane | Tier | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R182 — The saved choices: `ChartView` `globe`, `viewFor` (D-1095), the prefs keys and defaults (D-1096, FR-KEEP-3), the slice's setters, the privacy flag's selector (D-1105); no page reads them yet | `data` (`src/model/prefs.ts`, `src/data/localPrefs.ts`, `src/state/slices/prefs.ts`, `src/ui/screens/chartViewDefault.ts`, tests) | standard | auto | P10 |
| 1 | R183 — The numbers: `lib/orbitHeight.ts` and its selector in the elements slice, `lib/riseSet.ts` with the Horizons fixture, `lib/cloudBand.ts`, the lint allowance (D-1101) | `physics` (`src/lib/{orbitHeight,riseSet,cloudBand}.ts`, `src/state/slices/elements.ts`, `eslint.config.*`, tests) | standard | auto | P10 |
| 1 | R184 — The globe's passes and planets: `globe/arcs.ts`, the renderer's arcs, ticks, arrow, hover hit test and planet discs and labels, `SkyGlobe`'s new props, `layers.ts`'s `globe` row, the planet and cloud tokens with `contrast.ts` (D-1099, D-1104); not mounted on a new page | `chart` (`skychart/globe/**`, `skychart/layers.ts`, `src/ui/styles/tokens.css`, `scripts/contrast.ts`) | hard | auto | P10 |
| 2 | R185 — The window's ticks, arrow, arc hover and planets; the designation names after the proper names in `starLabels.ts` (FR-NAME-2, FR-NAME-3, FR-WIDE-7) | `window` (`skychart/window/**`) | standard | auto | R184 |
| 2 | R186 — One shell: `SkyViewLayout` on the three wide pages (D-1098), the pass detail out of `GuidePanel` on wide, the three-value `View` row read and written through `viewFor`, the globe mounted on the live page and the pass detail, the dome by choice and not prefetched, the corners; `sky-layout.spec.ts`, `globe.spec.ts`'s live case, `globe-perf.spec.ts` on the live page; every spec that pins the old shell or the dome default rewritten here | `ui` (`components/sky/**`, `screens/{Live,Stars,PassDetail,Home}.*`, `components/guide/GuidePanel.*`, `components/guide/skychart/SkyChart.tsx`, `tests/e2e/{sky-layout,globe,globe-perf,dome,guide,live}.spec.ts`) | hard | auto | R182, R184 |
| 3 | R187 — One time control: the `time` folder (D-1100), the stars page's steps under the playback row, the pass detail's rise, peak and set as buttons, the cloud band in the overview and the stripe | `live` (`components/live/**` → `components/sky/time/**`, `screens/{Live,Stars,PassDetail}.tsx` time slots, tests) | standard | auto | R183, R186 |
| 3 | R188 — The facts: the `facts` chunk and budget row, `This satellite` on the pass detail, the live page's pick by row or arc, a star's, a planet's and the Moon's facts on the globe and the window (D-1101); `factsGroup` words in both catalogs | `ui` (`components/sky/facts/**`, `src/i18n/**/facts.ts`, `scripts/bundle-budget.ts`, the pages' page-group slot) | standard | auto | R183, R185, R186 |
| 4 | R189 — The keys and the full sky: the key table (D-1102), `a` for the pass, the overlay, `lib/fullscreen.ts` and the layout's `full` state (D-1103); `keys.spec.ts`, `fullscreen.spec.ts`; every spec that presses `f` to face the pass rewritten here | `live` (`src/lib/{shortcuts,fullscreen}.ts`, `src/ui/hooks/useShortcuts.ts`, the overlay, `SkyViewLayout`'s `full`, the pages' action objects) | standard | auto | R187, R188 |
| 5 | R190 — The choices kept: every page reads and writes the layers, names, faint stars, turn, zoom and speed (FR-KEEP-1, FR-KEEP-2), the stars page's view saved, the privacy note's `[ × ]` and the settings sentence (FR-KEEP-4); `keep.spec.ts`; the reload sweep of D-1108 | `data` (the pages' state hooks, `usePlayback`, `SkyGlobe`'s zoom, the window's field, `Footer`, `LocationInput`, `Settings`, `tests/e2e/**` reload fixes) | standard | auto | R189 |
| 6 | R191 — 2.14.0: the capture set re-shot by `captures.yml` with the new screens (FR-WIDE-12), every budget row by D-178 (V214-20 at the gate), the README, the reading order, the hero and the social preview, `readme.test.ts`, the description and topics in `release.md` (D-1107), `package.json` 2.14.0, the owner's desk and phone run | `docs` (`tests/e2e/{captureSet,captureSeeds,v1-captures}.ts`, `scripts/bundle-budget.ts`, `README.md`, `docs/HOW-THIS-WAS-BUILT.md`, `docs/readme/`, `tests/docs/readme.test.ts`, `package.json`, `docs/sdd/phases/v2.14/release.md`) | standard | auto | R190 |

R184 and R186 are the hard tasks, one per wave: R184 must keep the globe's rate with the arcs on (fixed nodes, D-1038's method); R186 moves three pages into one shell and rewrites the specs that pinned the old ones.
R186 is the only task of waves 1–2 that touches the screens; R187, R188, R189 and R190 each touch them after it, one wave at a time where they share a file (R187 and R188 share none: the time slots against the page-group slot).
R190 runs alone because it touches every page's state and the e2e suite's reloads.
Each spec file that pins an old behaviour is named in exactly one task's lane, so no two tasks of a wave edit it.

**Sessions:** every entry is cut with `Tier:` as the table, `Turns: 500`, `Fallback: off`; the review tier is D-1065's.
Every task is `Gate: auto`.

**The budget** (D-761's units): two `hard` tasks and eight `standard` tasks with their reviews, **about 3.5–4.5 five-hour windows**, and P10's interactive session apart.
Waves 1 and 2 each hold one `hard` task; the owner reads `/usage` before them.
Wait-and-resume is on; nothing is started with `--no-wait`.

**The schedule it implies:** wave 1 about 4 h (the hard task sets it); wave 2 about 4 h; wave 3 about 3 h; waves 4, 5 and 6 about 2.5 h each.
Unstopped about 18.5 h; with two five-hour stops about 28 h.
The critical path is P10 → R184 → R186 → R188 → R189 → R190 → R191.

**Owner gates:** P10's spot-check before it merges.
At R191: the capture diff, the main ceiling if it is over (V214-20), the desk run (the three pages, the views, a pass's arc and facts, a star's facts, the hover, the clouds, the keys, full screen, a reload keeping the choices) and the phone run (the window, the names, a reload keeping the choices, the privacy note closed for good).
Then `gh repo edit` with `release.md`'s text, the tag `v2.14.0` and the deploy.

**Decision block** (§16.2): **R182 takes D-1109..D-1110, R183 D-1111..D-1112, R184 D-1113..D-1115, R185 D-1116..D-1117, R186 D-1118..D-1121, R187 D-1122..D-1123, R188 D-1124..D-1125, R189 D-1126..D-1127, R190 D-1128..D-1129, R191 D-1130..D-1131.**
D-1094..D-1108 are this plan's.

What every session reads (D-284's rule): the task's entry and each id it names by `npm run sdd:id`; SPEC §4.57's constants table and the FR ids of its row; US-52..US-57's criteria for its ids; this section and §2.50's decisions it names.
