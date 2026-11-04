# v2.4 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.39 v2.4 decisions, first cut (2026-10-23)

V24-8 puts a spike before anything else in the phase: the catalogue's size, the draw rate with 900 text nodes, the render path and the glyph sizes are numbers the spec cannot know, and FR-STAR-9 makes the render path a plan decision taken before the page task is cut.
This cut plans the spike and nothing after it.
The second cut (v0.12) reads `docs/stars/FINDINGS.md` and plans the catalogue, the scene and camera, the page, the screen's inventory and the release preparation, with their decisions from D-748.

- **D-740 — The spike is one page under `spike/stars/`, served by the window spike's server, importing the app and never editing it.**
  (FR-STAR-12; V24-8, V11-9.) `spike/stars/index.html` and `main.tsx` render one window-shaped field.
  Every knob is a URL parameter read by `spike/stars/params.ts`: `render=react|ref` (positions through React state, as `SkyWindow` draws today, or written to the nodes' `x`/`y` by ref outside render); `mark=glyph|disc`; `layers=` any of `stars,figures,planets,names`; `mag` (the limit, default 4.5); `big` and `small` (the ladder's two sizes in px, default 15 and 12, the sheet's `--chart-text-15` and `--chart-text-12`); `collide` (the collision distance as a fraction of the small cell, default 0.5); `source=sensor|hand`; `facing`, `tilt` and `fov` (default `WINDOW_FOV`); `at` (an ISO instant, default now); `lat` and `lon` (default the three R1 sites by name, `site=neuquen|paris|singapore`).
  The projection, the rotation and the upright camera are imported from `src/ui/components/guide/skychart/window/projection.ts`, the sensor path and the rate meter from `spike/window/sensors.ts`, the positions from `astronomy-engine`'s `Rotation_EQJ_HOR`, as FR-STAR-2 will use them.
  The spike changes no file under `src/`.
  It is served at `/spike/stars/` by the HTTPS dev server `npm run spike:window` already starts, since Vite serves every HTML file under the root; `package.json` gains `spike:stars` as the same command, for the name, and `spike:stars:measure` for the scripts below.
- **D-741 — What the spike measures, and the five answers.**
  (FR-STAR-1, FR-STAR-2, FR-STAR-6, FR-STAR-9, FR-STAR-12; OQ-39.) Four scripts under `spike/stars/`, run by `npm run spike:stars:measure`, and the owner on a phone.
  **(1) The catalogue:** `catalog.ts` builds the spike's catalogue from `data-src/stars/` (D-743) — every star at V ≤ the limit, every fainter figure endpoint, the figures snapped to the nearest star — and prints its star count, its figure count, the worst snap distance, and its size raw and gzipped as JSON objects and as columns (one array per field).
  It writes into `.sdd-cache/spike-stars/`, which the tree ignores.
  **(2) The rate:** the page shows the meter's updates per second.
  The owner reads it on the phone under the sensor and under a drag, for the four combinations of `render` and `mark` with every layer on.
  `perf.ts` measures the same four by D-62's method (a 5 s drag in Playwright's Chromium, the Pixel 5 profile, 4× CPU throttling), so the number can be reproduced without the phone.
  **(3) The precession path:** `precession.ts` holds the rotation against the three fixtures and prints the worst separation per site.
  **(4) The ladder and the collision distance:** `capture.ts` shoots Crux over Neuquén and Orion over Paris at 390 × 844 and 1280 × 800, for the default ladder and two alternatives on each side, into `docs/stars/captures/`.
  `docs/stars/FINDINGS.md` answers, each with a number or a capture behind it: **OQ-39's figure source** (d3-celestial unless the snap fails); **`STARS_BUDGET_KB`** and the catalogue's encoding; **the render path** FR-STAR-9 names, with V24-9 held or reopened by the 30-updates/s rule; **the precession path's worst error** against `STAR_TOLERANCE_DEG`; and **the two sizes and the collision distance** the owner picks, judged on whether Crux keeps its shape and Orion's belt stays three marks in a line.
  A number the phone cannot give (the Android row, as R38 left it) is a line marked open and is not a blocker.
- **D-742 — `v2.3.0` is `6cfa699`.**
  (V24-11; FR-STAR-9, Phase 2l's definition of done.) Nothing is tagged before `v2.5.0`, so wherever the spec measures against `v2.3.0` — the main chunk's size, the live page's and the pass detail's captures — the reference is the R110 merge, `6cfa699`, whose `package.json` reads 2.3.0.
  `scripts/bundle-budget.ts`'s rows and `captures.yml`'s `base` input name the SHA, never a tag. v2.5's `v2.4.0` is v2.4's release-preparation merge, by the same rule.
- **D-743 — The sources and the fixtures as they landed.**
  (FR-STAR-1, FR-STAR-2; V24-3, V24-12.) `data-src/stars/` holds `bsc5-catalog.gz` and `bsc5-ReadMe.txt` (the Yale catalogue as CDS V/50 ships it, 9110 records, 904 at V ≤ 4.5), `d3-celestial-constellations.lines.json` with its licence (89 features: Serpens is drawn as two), and `iau-csn.txt` (the WGSN names, joined to the catalogue by HD number), with a README carrying the sources, the licences and the SHA-256 of each file.
  `tests/docs/public.test.ts` counts `iau-csn.txt` as verbatim third-party text, because its header carries its maintainer's address.
  `tests/fixtures/stars/` holds one file per R1 site at one instant on 2026-11-01, each with twelve named stars (one per 30° of azimuth, at 12° or higher) and the five planets, beside a `.meta.json` naming the source.
  `astronomy-engine`'s one rotation is within 0.0065° of every value at capture, so the 0.25° tolerance has room and can still catch a wrong frame.

R111's decisions (2026-10-23, `docs/stars/FINDINGS.md`):

- **D-744 — The ref path, and V24-9 held.**
  (FR-STAR-9; V24-9.) The field's nodes are rendered once and each frame writes `x`, `y` and `visibility` to them outside React, as `spike/stars/Field.tsx`'s `RefField` does.
  Through React the field falls to 19 draws/s at 4× on the Pixel 5 profile; by ref it holds about 100 at 1×, 4× and 6×.
  On the owner's iPhone both paths draw at the sensor's 61 events/s.
  Glyphs cost what discs cost, so the stars stay characters.
- **D-745 — The catalogue as columns, and the budget at 40 KB.**
  (FR-STAR-1; OQ-39.) d3-celestial's figures, every endpoint snapped to a catalogue star (worst 0.0025°). 1035 stars (904 at V ≤ 4.5 and 131 fainter endpoints), 89 figures, 743 segments, 288 names: 21.1 KB gzipped as one array per field against 25.5 KB as objects.
  `STARS_BUDGET_KB` stays 40.
- **D-746 — Each glyph's ink centred on its point.**
  (FR-STAR-6.) In `--font-mono` the em box's centre is not the ink's: `.` draws 1.9–2.4 px low, `*` and `+` 0.6–0.9 px high, `@` centred, so figure lines stop short of their faint stars.
  Each glyph is shifted by its ink offset, measured once per glyph and size at load from the canvas's text metrics and applied as `dx`/`dy`.
  FR-STAR-6's centring wording is amended by v0.12's spec change.
- **D-747 — The ladder as written, and the picks for the second cut.**
  (FR-STAR-6.) The owner kept FR-STAR-6's 15/12 px, a collision distance of 0.5 of the small size and `.` for the faint steps; Crux and Orion's belt keep their shapes at 390 px.
  Two things go to v0.12 with the findings: the names layer needs a placement rule that avoids marks and lines and keeps each figure's name (the captures lose `Ori` to `Betelgeuse`), and the owner's four looks from Sky Guide — faint figure lines, spaced-capital figure names, the ground with N / E / S / W, and stronger brightness steps — each a spec change before a task.

Second cut (2026-10-23, SPEC v2.4.1, V24-13..V24-21), from `docs/stars/FINDINGS.md` and D-744..D-747:

- **D-748 — The catalogue is a committed build output, in columns, and the names are its data.**
  (FR-STAR-1, FR-STAR-10 as amended; V24-20, D-745.) `scripts/build-stars.ts` (`npm run build:stars`, run under `tsx`, never by `vite build`) reads `data-src/stars/` (D-743) and writes `src/data/stars/catalog.json`: one array per field — `ra` and `dec` (J2000 degrees, three decimals), `mag` (two), `name` (the IAU proper name or `""`), `desig` (Bayer or Flamsteed, or the HR number), `con` (the IAU abbreviation) — plus `figures`, one entry per drawn feature as `{ con, part, segments: [i, j][] }` with indices into the star arrays, every endpoint snapped to the nearest star as the spike did.
  It keeps every star at V ≤ `STAR_MAG_LIMIT` and every fainter endpoint, sorted by magnitude so the brightest come first.
  `src/data/stars/constellations.ts` is the Latin-name table, keyed by abbreviation, with `Ser` as two parts (`Serpens Caput`, `Serpens Cauda`) — the names are data, the same in both languages, and never enter the string catalog.
  `src/data/stars/catalog.ts` parses the file with `zod` once and returns typed arrays.
  The build prints the counts and the gzipped size; `tests/data/starCatalog.test.ts` pins 1035 stars, 89 features, 743 segments, every id in range and unique, every star name non-empty where present, the table complete for every `con` drawn, and the file ≤ 22 KB gzipped; it also re-runs the build into memory and asserts it equals the committed file, so the output cannot drift from its sources.
  The generated notices list packages only, so `scripts/third-party-notices.ts` gains a fixed `DATA_NOTICES` block written after them — d3-celestial's figures (BSD-3-Clause, its licence text from `data-src/stars/`), the Yale catalogue (public domain) and the IAU WGSN names — and `public/third-party-notices.txt` is regenerated.
- **D-749 — The positions in `lib/skyStars.ts`, and the budget row that follows the library.**
  (FR-STAR-2, FR-STAR-9; V24-5, V24-14.) `starsAt(catalog, observer, t)` returns, for one instant, `Float32Array`s of altitude and azimuth in catalogue order and the five planets as `{ body, azDeg, altDeg, mag }`: one `Rotation_EQJ_HOR(MakeTime(t), observer)` applied to every star's J2000 unit vector, the planets through `Equator` / `Horizon` (no refraction) and `Illumination(body, t).mag`.
  Memoised on `(t, lat, lon)` with one slot: a frame under the hand or the sensor reuses it, a change of `t` replaces it.
  The file joins `skyBodies.ts` as the lint boundary's second main-thread exception in `eslint.config.js`.
  It is imported only by the `stars` chunk.
  If Rollup then moves `astronomy-engine` out of `skyBodies-*.js` into a shared chunk, the `astronomy` row of `scripts/bundle-budget.ts` matches both files under its one limit, so the library is counted once, as now, and the row's total is what FR-STAR-9's "no other row moves" reads.
- **D-750 — `SkyScene` and `SkyCamera`, in the window's directory.**
  (FR-STAR-11, FR-STAR-4; V24-4.) `skychart/window/scene.ts` exports `SkyScene = { stars: StarField | null }` where `StarField` carries the catalogue, the positions of D-749 and the layer switches; everything else the scene names in the spec (horizon, rings, Sun, Moon, passes) stays where `SkyChartProps` carries it today, so no caller changes.
  `SkyChartProps` gains `scene?: SkyScene` and `namedStar?: number | null` with `onNameStar?(i: number | null)` (the list's and the tap's shared selection, FR-STAR-7) — the one shared file, `skychart/SkyChart.types.ts`.
  Absent `scene` is `v2.3.0`'s window, byte for byte.
  `skychart/window/camera.ts` holds `SkyCamera`: `source: 'sensor' | 'hand'`, the hand state `{ azDeg, altDeg }` with `dragTo`, `stepYaw`, `stepPitch`, `face(point)` and `up()`, clamped to `STARS_TILT_MIN_DEG`..`STARS_TILT_MAX_DEG`, composing `uprightRotation(az, alt)` (`projection.ts`); the three step constants are imported from `dome/camera.ts`, not moved.
  `useViewRotation(camera)` returns the one `Mat3` whichever source drives it, with `useDeviceOrientation` unchanged underneath.
  The window takes `camera?: SkyCamera`; without it the window is sensor-driven as now.
- **D-751 — One rotation channel; the star field reads it by ref.**
  (FR-STAR-9 as amended; D-744.) `useViewRotation` publishes each new rotation twice in the same animation frame: to React state, as today, for the window's existing layers, the readout, the ground state and the gutter (about twenty nodes, which React redraws within budget), and to a subscriber list.
  `skychart/window/StarField.tsx` is a `memo` child that renders its nodes once per catalogue and layer set — one `<text>` per star and planet, one `<line>` per segment, one `<text>` per name — and on each published rotation projects and writes `x`, `y`, `dx`, `dy` and `visibility` to them directly.
  Both writes land before the frame's paint, so the horizon and the stars never disagree.
  The label placement (D-755) runs only when the rotation has moved past `converged()` since the last placement, so names do not re-collide at the sensor's jitter.
- **D-752 — The ink offsets, measured once.**
  (FR-STAR-6 as amended; V24-15, D-746.) `skychart/window/inkOffsets.ts`: after `document.fonts.ready`, a canvas 2D context set to the window's computed `--font-mono` measures each glyph × size the ladder uses (`*` 18 and 15, `+` 12, `.` 12, `@` 18, 15 and 12) with `textAlign = 'center'` and `textBaseline = 'middle'`; the offset is the negated centre of `actualBoundingBox{Left,Right,Ascent,Descent}`, rounded to 0.1 px, cached in a module map.
  Where the canvas has no metrics (jsdom) every offset is 0, which is what the unit tests assume.
  The offsets are written as `dx`/`dy` when a node is created or its rung changes, never per frame.
- **D-753 — The ladder and the four tokens.**
  (FR-STAR-6, FR-DS-8 as amended; V24-13, V24-14.) `skychart/window/starGlyphs.ts` is the pure module: `rungFor(mag)` returns `{ glyph, sizeToken, colourToken }` on the five rungs of FR-STAR-6, planets on the same sizes with `@` and `--chart-planet`; `collide(points)` keeps the brighter of any two within half the small size; `hitTest(points, x, y)` returns the nearest within `--tap` / 4.
  `tokens.css` gains, in the type section, `--chart-text-18: 18px`; in the edges section, `--chart-hairline: calc(var(--hairline) * 0.75)`; in the colour section and the night block, `--chart-star-faint` (`#626d7a`, 3.65 : 1; night `#a24a40`, 3.51 : 1) and `--chart-figure-name` (`#7a8591`, 5.12 : 1; night `#c4544a`, 4.61 : 1).
  `scripts/contrast.ts` lists the faint star with `CHART_MARK_TOKENS` (≥ 3 : 1) and the figure name as text (≥ 4.5 : 1); `tests/styles/tokens.test.ts` also asserts each sits below `--chart-star-dim` in both themes; `docs/DESIGN.md` is regenerated.
- **D-754 — The figures' gap and clip, and the ground.**
  (FR-STAR-6 as amended; V24-13.) In `StarField`, a segment's two projected ends are each moved toward the other by the collision distance before writing; a segment whose projected length is under twice that is hidden.
  Segments with both ends below the horizon are hidden; the rest are drawn under a `clipPath` of the horizon's closed image (`groundClipPath`, the sky side, `clip-rule: evenodd` against the box) plus the field's edge.
  The ground is one `<path>` of the same closed image filled with `--chart-ground` at `--window-fill-opacity`, drawn when the scene carries stars and the horizon is in view, under the figures and under FR-FOL-5's hatch, whose two states are unchanged.
  The compass points are `SkyWindow`'s own `COMPASS` at `NAME_ALT_DEG`; nothing is added for them.
- **D-755 — The label placement.**
  (FR-STAR-6 as amended; V24-16.) `skychart/window/starLabels.ts`, pure: input the projected marks (point, glyph box from the rung), the drawn segments, the compass labels' boxes, the named mark, the star-name candidates (V ≤ 1.5, brightest first) and the figures (abbreviation, drawn endpoints); output the placed labels with their boxes.
  Text width is `n × 0.6 em` at the token's size, the spacing built into the string (`C R U X`, three spaces between words), so the boxes are the same in every engine.
  Occupied space is the mark boxes, the compass boxes and each segment sampled every 4 px.
  Order: compass (fixed), the named mark's label (right, left, above, below), star names (the same four), figure names (the full spaced name where its width ≤ the drawn endpoints' width + 2 cells, else the abbreviation; at the centroid, then one row above, then below; then the abbreviation in the same three).
  A figure name with no free place removes the placed star names it overlaps, faintest first, and is placed; a removed star name is not retried.
  A table test pins Orion over Paris (`O R I O N` and `Betelgeuse` both placed) and Crux over Neuquén.
  *(amended 2026-10-24, V24-22, D-778)* On R116's measure the six places cross the figure's own lines for both pinned figures, so after the centroid and the rows above and below it, each form searches a grid over the drawn endpoints' bounding box — one row (the name's 11 px) by one cell (0.6 em, 6.6 px), every place whose box reaches into the bounding box, nearest the centroid first — the full name's grid before the abbreviation's; the yielding step runs only when neither form found a free place, and walks the same list, so it takes the first place where only star names are in the way.
  The table test pins Orion over Paris (`O R I O N` at 390 and 1280, `Betelgeuse` at 1280 only, V24-23) and Crux over Neuquén (`C R U` at 390 and at 1280, where the cross is too narrow for the full name; `C R U X` in a 900 × 640 box).
- **D-756 — The page, its way in, its list, and the screen's inventory.**
  (FR-STAR-3..5, FR-STAR-7, FR-STAR-8, FR-STAR-10.) `screens/Stars.tsx` + module, lazy behind `screens/StarsRoute.ts` and `starsChunk.ts` (`settingsChunk.ts`'s pattern), `isStarsRoute` / `STARS_HASH` in `lib/shareLinks.ts`, a `RouteName` value in `ui/navigation.ts`, the title row in `lib/routeTitle.ts`; it builds the `SkyScene` from `catalog.ts` and `starsAt` at the ticking instant, holds the `SkyCamera` (hand) and the layer switches in component state, and renders the window, the facing picker (`ToggleGroup`), the layers (`OptionToggle`s) and `In this field` (`screens/stars/FieldList.tsx`, the `FIELD_LIST_MAX` brightest drawn objects, rows setting `namedStar`).
  The header link, the When pane's line and the `s` key and `?` line are in `common/Header.tsx`, the home's When pane and `lib/shortcuts.ts`.
  Every string the page and the window's star readout use is added in one `stars` section of both catalogs by the page task, so the names task adds none.
  The screen: `SkyScreen` gains `inventory: 'passes' | 'stars'` (default `passes`), `useSkyScreen.open()` takes the scene, and the page's `[ hold up to the sky ]` row calls it where FR-WIN-4's presence test passes.
  The precache needs nothing: the `stars` chunk is a `.js` file under `globPatterns` (D-79); `tests/e2e/stars.spec.ts` proves the offline reload.
- **D-757 — Magnetic declination: nothing to add.**
  (FR-WIN-3; V24-20.) The spike passed 0; the app's sensor path already subtracts the WMM declination (`lib/declination.ts`, `useDeclination`, `projection.alphaFor`) and the stars screen uses that path.
  The hand camera points at true bearings and has no declination.
  The screen task's e2e asserts the readout's true-north line under a mocked orientation.
- **D-758 — Tests and captures.**
  (FR-STAR-2, FR-STAR-6, FR-STAR-9, FR-STAR-11.) Unit: `starCatalog.test.ts`, `skyStars.test.ts` (the three fixtures within `STAR_TOLERANCE_DEG`; planets' magnitudes within 0.3 of the fixtures where they carry one), `camera.test.ts`, `starGlyphs.test.ts` (the table), `starLabels.test.ts`, `SkyWindow.stars.test.tsx` (nodes once, the channel writes, the ground and clip present only with a scene).
  E2E: `stars.spec.ts` (route, link, keys, picker, layers, list, both languages, offline), `stars-perf.spec.ts` (≥ 30 updates/s at 4× under a drag, `dome-perf.spec.ts`'s method), `stars-screen.spec.ts` (mocked orientation).
  Each visual task files its own captures under `docs/screenshots/r1NN/` (Crux over Neuquén, Orion over Paris at 390 and 1280, both themes) as the visual-review skill does, for the review and for the owner's later reading.
  The release capture set gains the page at 390, 1280 and 1920 and the screen at 844 × 390, both themes, on the set's clock (FR-SHOW-9's place); `captures.yml` diffs the set against `6cfa699` and only the new files may differ.
- **D-759 — The budgets.**
  (FR-STAR-9; D-178, D-742.) `scripts/bundle-budget.ts` gains `{ name: 'stars', match: /^Stars-.*\.js$/, limitKb: 40 }` with the page task; main ≤ 1 KB over `6cfa699`'s measure; the window row is re-measured with the star field in it and stays under 15 or the task says by how much and why.
  The release preparation re-sets `stars` by D-178's rule.
  *(amended 2026-10-24, V24-24, D-780)* The window row is not slimmed in v2.4: R116 measured it at 21.8 KB against 15 (16.8 on `main` before R116).
  R118's release preparation re-sets it from the measured build by D-178's rule, as it re-sets `stars`, and writes the reason beside the row: the star names, the page's label words, the constellation table and the magnitude format are shared by the `stars` and `SkyWindow` chunks, and Rollup puts what they share in `SkyWindow-*.js`.
- **D-760 — Every task after R111 is `Gate: auto`.**
  (V24-21; §16.3, §16.5.) The owner's instruction: nothing is released before v2.5 (V24-11), so a task merges on CI green and a clean `opus` review, including the visual ones and the Spanish copy.
  Every choice a task would otherwise bring to the owner is taken in SPEC v2.4.1 and here.
  The owner's look moves to v2.5's release preparation (the stars captures in both themes, the phone under a clear sky); an optional reading of the v2.4 captures after R118 blocks nothing.
- **D-761 — Models, caps and the five-hour budget.**
  (V24-21; §16.6, D-659.) `fable` implements the three tasks where a plausible wrong answer is expensive and the session must iterate against what it draws — the scene and camera split with the ref channel, the star field, the label placement; `opus` implements the catalogue, the page, the screen and the release, which are fully specified by tests and tables; `opus` reviews every task; `Turns: 500` and `Fallback: off` on every task, so no task drops to a cheaper model.
  Fable everywhere (D-659's choice for v2.2) does not fit the deadline under the account's limit (§16.22's budget).
- **D-762 — What moves to v2.5.**
  (V24-17..V24-19, V24-21.) The twilight limit (FR-STAR-13), the tap on a figure's line (FR-STAR-14) and pinch-zoom move whole to v2.5.
  Planets sized by magnitude stay: the magnitude comes with the positions (D-749) and the size is one ladder lookup.
- **D-763 — The catalogue's columns as they landed.**
  (FR-STAR-1; D-748, D-745; R112.) The build prints 1033 stars (904 at V ≤ 4.5, 129 fainter endpoints) of 9096 positioned records, 89 features, 743 segments, worst snap 0.0025°, 289 names, 51.2 KB raw and 18.8 KB gzipped — under D-745's 21.1 KB because the positions are three decimals and the HR column is gone.
  A figure's point snaps to the nearest star by great-circle distance, searched in a declination band, and the build fails if any point sits farther than `SNAP_MAX_DEG` (0.1°); a tie, as on a double whose two Yale records share a position, goes to the brighter component — which keeps `Zet Boo`'s and `Alp Psc`'s fainter records out.
  A WGSN name whose record is not kept goes to the nearest kept star within `SNAP_MAX_DEG` that has no name of its own, so Alrescha, which the list gives the fainter `Alp Psc` record's HD, lands on the brighter one, and so does Izar (`Eps Boo`), which the first build missed; the build counts these carries and the test pins two.
  A segment the figure already draws, either way round, and one whose two points snap to one star are dropped (none are, today).
  When two WGSN lines carry one HD the first in the file keeps it and the build counts the rest (none, today); the test pins both counts at zero.
  Three details D-748 leaves open: a figure's `part` is its order among the features with the same abbreviation in d3-celestial's file, so Serpens' first feature (RA 233–240°) is part 0, `Serpens Caput`, and its second (RA 257–270°) part 1, `Serpens Cauda`; a Yale record names a constellation only beside a Bayer or Flamsteed designation, so for the 82 kept stars with neither, `con` is read off the IAU boundaries by `astronomy-engine`'s `Constellation()` at build time, which agrees with all 951 the catalogue does name; and `desig` is `Alp1 Cen` (letter, superscript, space, constellation) where the fixtures write `Alp1Cen`.
  `STAR_MAG_LIMIT` lives in `src/data/stars/constants.ts`, so the build reads it without loading the file it writes.
  `tests/data` joins `tsconfig.node.json`'s `include`, so the test is typechecked.
- **D-764 — A star's id is its index, and a designation is not unique.**
  (FR-STAR-1; D-748; R112.) The Yale catalogue lists the two components of six kept doubles as separate records with one designation (`Alp Gem`, `Zet Ori`, `Zet UMa`, `Gam Vir`, `Del Ser`, `Iot Cnc`), so "every id unique" is read as every star once: no two kept stars share designation, position and magnitude, and the duplicated designations are pinned at six.
  The label task decides how a reader tells the two apart.
- **D-765 — The data notices sit under their own rule.**
  (FR-STAR-1, FR-PUB-5; D-748; R112.) `public.test.ts` splits the notices file on `RULE` and holds the entries to the installed package tree, so `DATA_NOTICES` (`dataNotices()`) is written after the packages under `DATA_RULE` (76 `=`) with a `DATA` heading: d3-celestial's figures (BSD-3-Clause, quoted from `data-src/stars/d3-celestial-LICENSE.txt`), the Yale catalogue (public domain) and the IAU WGSN names (CC BY 4.0, the attribution its header asks for).
  `starCatalog.test.ts` holds the file to that list; `public.test.ts` cuts the file at the first `DATA_RULE` before it splits on `RULE`, so the data text never pads the last package's licence.
- **D-766 — The hand camera is a store the window drives and the page reads.**
  (R113; FR-STAR-4, FR-STAR-9; D-750.) `SkyCamera` is `SENSOR_CAMERA` (`{ source: 'sensor' }`, one value) or a `HandCamera` from `createHandCamera(initial)`: `get()`, `subscribe()`, and the five moves applied in place over the pure reducers `dragTo`, `stepYaw`, `stepPitch`, `face`, `up` (exported on their own for the test), each a normalised azimuth and a tilt clamped to `STARS_TILT_MIN_DEG`..`STARS_TILT_MAX_DEG`; a move that changes nothing notifies nobody.
  A store and not React state because the per-frame path under a drag must hold the window alone: `useViewRotation` reads it with `useSyncExternalStore`, the page (R115) reads the facing the same way for its picker and list, and no callback prop or parent re-render stands between a pointer move and the frame.
  `camera?` is on `SkyWindowProps` (`SkyChartProps & { camera? }`, exported by `SkyWindow.tsx`), not on `SkyChartProps`: the dome and the polar never see it, and the shared file carries only the three the scope names.
  The directions: a drag follows the finger, as the dome's does (right turns the azimuth down, down raises the altitude); `↑` looks up; `STARS_DEFAULT_FACING` is `{ north: 0, south: 180 }` with `defaultFacingDeg(lat)` and `initialHand(lat)` reading the hemisphere, since FR-STAR-3's default depends on the observer.
- **D-767 — The channel publishes in the layout effect of the commit that draws the rotation.**
  (R113; FR-STAR-9 as amended; D-751, D-744.) `useViewRotation(camera, declinationDeg, fallback)` returns the render's `Mat3` — the hand's `uprightRotation`, the sensor's, or the window's placeholder (`fallback`) before the first reading — and a `subscribe(listener)` whose listeners are called in a `useLayoutEffect` keyed on that `Mat3`, after React has written the commit's DOM and before the browser paints it.
  Not in the animation frame that set the state: React 19 commits a state set from an rAF in a later task, so a subscriber called there would place the stars a frame ahead of the horizon; in the layout effect the two writes are the same commit and no paint can fall between them.
  Exactly one call per rotation the window drew, none between commits, and a late subscriber is given the current rotation at once.
  `StarField` subscribes in its own layout effect, which runs before the parent's, so the first publish of its mount reaches it.
  R113's `StarField` is the empty `<g data-layer="stars">`, `memo`ed on `(field, view, subscribe)`, and its one write per rotation is the group's `visibility`, hidden at `buried`; it is mounted outside the `ground !== 'buried'` fragment so its nodes exist once across the ground states, and placed before the grid (under the horizon and the rings, FR-STAR-6).
- **D-768 — The sensor is not armed under the hand, and the hand's chrome is the one line.**
  (R113; FR-STAR-4, D-757.) `useDeviceOrientation(declinationDeg, enabled = true)` gains the one flag; `false` makes `available` false, so nothing is armed, no state moves and the handle reads as a device without the API — the sensor path's maths is untouched.
  Under a hand camera the window's `status` is the readout's first line (no declination line: the hand points at true bearings), there is no waiting note and no "hold the phone up" hint, the wrapper's `data-state` is `hand`, and the box is `tabIndex=0`, `aria-describedby` its readout, with the dome's `grab`/`grabbing` cursor and `touch-action: none`; the group's accessible name is the page's to add with its strings (R115).
  Under the sensor the box carries none of this, so its DOM is unchanged.
- **D-769 — What the dead-export check made of the new modules.**
  (R113; D-647.) `scene.ts` exports `StarField` and `SkyScene` alone; the parts (the catalogue's columns, the positions, a planet, the layer switches) are interfaces reached as `StarField['catalog']` until a task imports one by name, when it exports it.
  `drawField` is `StarField.tsx`'s private function until R114 fills it.
  `projection.ts`'s `projectDevice`, exported since R47 and imported by nothing (the spike has its own copy), is un-exported — it was the one report `npm run check:dead` made on the parent.
- **D-770 — Which side of the horizon's image is the sky depends on where the centre of the field is.**
  (R114; FR-STAR-6 as amended, FR-FOL-5; D-754, D-278.) `groundClipPath`'s closed curve is the stereographic image of the horizon, and the point at infinity is the antipode of the look direction: with the centre *above* the horizon the sky is the inside of the curve and the ground is everything outside it; *below* the horizon (FR-FOL-5's `ground` state, the only one R56 drew it in) the sides swap.
  So D-754's "the sky side, `evenodd` against the box" is one of two paths per frame, chosen by the sign of `lookDirection(rotation).altDeg`: the sky-side clip is the image alone when the centre is up and the box's rectangle plus the image under `clip-rule: evenodd` when it is down, and the ground fill is the other of the two under `fill-rule: evenodd`.
  Nothing tests "the horizon is in view" separately: when it is out of the box the image encloses the box and the floor's `evenodd` path covers nothing inside it, and at `buried` the whole group is hidden as R113 left it.
  `SkyWindow.stars.test.tsx` holds the three states with R56's point-in-polygon reader, and that the image the field fills at `ground` is byte for byte the one the window clips its hatch to.
- **D-771 — The ink offsets probe is the browser project's test, and the numbers on the Mac.**
  (R114; FR-STAR-6 as amended, V24-15; D-752.) The brief asked for an e2e probe of `inkOffsets.ts` on any page; a Playwright spec cannot import the module into the page, so it would have carried a copy of the measurement.
  `inkOffsets.integration.test.ts` instead runs in `vitest.config.ts`'s `browser` project (`src/**/*.integration.test.ts`, real Chromium), imports the module and the sheet, prints the table and holds its shape — `.` below the point, `*` and `+` at or above it, `@` within 1.5 px, nothing past 4 px, every value a tenth — without pinning values that are the machine's face's.
  The `ui` project collects every test under `src/ui` into jsdom as well, so the file `describe.skipIf`s itself where `document.fonts` is missing.
  Measured on the owner's Mac (`ui-monospace` resolves to SF Mono): `*` 18 px dx 0.0 dy +0.9; `*` 15 px 0.0/+0.7; `+` 12 px −0.1/+0.7; `.` 12 px +0.3/−1.9; `@` 18/15/12 px +0.1/0.0 — the spike's figures (`docs/stars/FINDINGS.md` §5) to the tenth.
  `dx`/`dy` are rendered as attributes from the module's map (0 before the measurement), and a field mounted before the fonts are ready writes them once more when `inkOffsetsReady()` resolves; a field mounted after it has them from its render and skips the pass.
- **D-772 — The frame's walk: one projection per star, the planets in the magnitude order, a margin for the edge.**
  (R114; FR-STAR-6 as amended, FR-STAR-9.) Per published rotation `StarField` projects every catalogue star once into four typed arrays (`x`, `y`, off-axis angle, in front) — the glyphs need the ones up and in the box, the segments need both ends whatever they are — and the planets separately.
  The collision walk is `collide` over the stars and the planets *together* in magnitude order (`prepare()` sorts the combined index once per field), so a planet fainter than a star beside it is the one dropped, where the spike always kept the planet.
  A glyph is drawn while its centre is within half the top size (9 px) of the box, so an 18 px `*` leaves the frame rather than winking out at its edge; a segment's ends are projected to `drawableDeg` plus 15°, the spike's margin, so a line to a star just outside the frame reaches the edge.
  A layer that is off skips its loop (its group is hidden by the render), so the three switches cost nothing per frame; the nodes stay, and a switch re-renders the field once and re-subscribes, which replays the current rotation.
- **D-773 — What else R114 settled in the window's files.**
  (R114; FR-DS-2, D-647, D-753.) `starGlyphs.ts` carries the two px numbers the rules need — `SIZE_PX`, the three chart text tokens' values under their names, and `HIT_RADIUS_PX`, `--tap` / 4 — and `starGlyphs.test.ts` reads `tokens.css` and holds both to it, `gutter.test.ts`'s pattern for `GUTTER_PX`; the stylesheet names every size and tone by token (`.size18 { font-size: var(--chart-text-18) }`, `.starFaint { fill: var(--chart-star-faint) }`, `.figures line { stroke-width: var(--chart-hairline) }`), so `literals.allow.json` gains nothing.
  `SkyPoint`, `ring`, `HORIZON` and `groundClipPath` move from `SkyWindow.tsx` to `projection.ts`, exported, because the field projects the same 181 horizon points per frame that the window projects per render (F-57's one sampling, two readers).
  `hitTest` is exported with no caller but its test, for R116's tap.
  The scene's `StarFigure.segments` is pairs (`readonly [number, number][]`, D-750) while `data/stars/catalog.ts` stores a flat `Uint16Array`: the page maps the catalogue into the scene's shape once per load, or R115 proposes the one type; R114 keeps the scene as R113 cut it.
  `scripts/contrast.ts`'s `CHART_RESERVED_TOKENS` keeps its name and gains `chart-star-faint`: the dome's palette test (`dome/palette.test.tsx`, outside the lane) reads it as the chart marks that are not the dome's, and the five star marks are the window's now, not reserved; the guide's cell keeps its "reserved for the stars" phrase because `tests/docs/design.test.ts` (also outside the lane) pins it.
- **D-774 — `[ stars ]` on the wide title row moves the header's fold, and the live link folds with the title.**
  (R115; FR-STAR-3, FR-HOME-1; D-546, D-605, F-76.) The title row gains two cells and `[ stars ]` / `[ estrellas ]`: 112 cells in English and 128 in Spanish, so `HEADER_FOLD_PX.*.title` is 1079 and 1233 px (`thresholdPx`), `Header.module.css`'s two folds with it and `tests/styles/breakpoints.json`.
  The short title alone would leave the Spanish row at 105 cells, over the wide breakpoint's 100, so under the same fold `[ Cielo en vivo ]` takes its short word (`live.openShort`, drawn from a `data-short` attribute as the title's is): 87 and 96 cells folded.
  F-76's reading moves: both languages are under their fold at 1024 px and Spanish at the three panes too; neither is at 1280.
  `controlRows.test.ts` and `home-desk.spec.ts` assert the new arithmetic, and `breakpoint.test.ts` holds the title folds under `WIDE_SPLIT_MIN_PX` instead of the three panes'.
  On the stars page the header's title is a `p`, so the page's own name is the route's one `h1` (FR-A11Y-1), as on the live page.
- **D-775 — `src/ui` may import `src/data/stars`.**
  (R115; D-756, PLAN §3.) D-756 has the page build its scene from `catalog.ts`, and §3's zone forbids `src/ui` → `src/data`; `eslint.config.js`'s zone gains `./stars` as its one exception, beside the comment that names D-756.
  The only importer is the `stars` chunk (`Stars.tsx`, `stars/field.ts`), so the catalogue stays out of main.
  The catalogue's figures are flat index pairs with a numeric part, the window's scene types pairs with a word (`Caput`, `Cauda`); the page converts once (`sceneCatalog`, memoised on the catalogue), the one place both shapes meet.
- **D-776 — The page's layout as built.**
  (R115; FR-STAR-3, FR-COMP-4, FR-COMP-5, FR-LIVE-7.) The window is placed, not restyled: the page leaves `SkyWindow` untouched and puts its frame's cells by `Stars.module.css` through the frame's test ids and the `data-row="controls"` / `data-row="status"` names `ChartFrame` gives its two rows (review fix: never by child order) — the empty controls row not drawn, the status slot (the window's own readout) the row above the box on compact and an overlay in the box's top-left corner on wide, on the screen overlay's surface.
  **Wide:** the box is cut by `fitBox` to the browser window's own aspect ("the window's shape") from the page's height and the width beside a rail of `RAIL_MIN_CELLS`, the rail taking the rest up to 60 cells and scrolling inside; the page does not scroll.
  **Compact:** the readout row, the box full-bleed and square (390 × 390 at 390 × 844, so FR-COMP-5's floor holds), the facing row, the layers, the list; the page scrolls past the box.
  The facing picker is a `ToggleGroup` in the compact speeds' tight form (D-245) with a cell between the options, `N NE E SE [S] SW W NW up`, 24 cells in English and 28 in Spanish — the bracketed form reserves `[ ` ` ]` on every option and is 58; a point keeps the current tilt (FR-STAR-4), so from the zenith `up` stays pressed; after a drag no point is pressed.
  The layers are four `OptionToggle`s in two rows of two on every width — one row of four is 43 cells in English and 51 in Spanish — and FR-STAR-3's "the layers row" is read as the two.
  The h2 headings `Facing` and `Layers` are visually hidden on compact, where the rows are their own label.
  The page's focus target is the drawing's box, focused on mount (it takes the arrow keys); the box is wrapped in a `group` named by the page.
  The list reads the camera through `useDeferredValue`, so a drag's frame is the window's alone; a row's focus or click names its mark (`namedStar` held by the page, cleared after `STAR_LABEL_HOLD_S`, a new naming restarting the hold), and the window's `onNameStar(null)` clears it.
  The `[ stars ]` link and the When pane's `[ look up ]` prefetch the chunk on `pointerenter` and `focus`; there is no idle prefetch, since the chunk is some 24 KB and a reader who never opens the page should not pay it on a phone.
  The When pane's line is set at `--small` (Spanish 38 of 41 characters).
- **D-777 — The page's own words ride in the `stars` chunk.**
  (R115; FR-STAR-9, FR-STAR-10, FR-I18N-2; D-69, D-756.) D-756's one `stars` section in both catalogs measured main at +1.3 KB over `6cfa699`, over FR-STAR-9's 1 KB: the two languages' page words are 0.76 KB gzipped on their own.
  The section is split by who draws the word.
  `i18n/{en,es}/stars.ts`, merged into the catalogs, holds what main draws — the header's link, the page's name and title, the When pane's line, the loading line, the `?` overlay's block — and `i18n/{en,es}/starsPage.ts` holds the rest — the inert line, the drawing's name, the three blocks, the picker's `up`, the layer names, the list's words and the planets' names, `mag`, the readout's form and the named line, and R117's `[ hold up to the sky ]` — read by `useStarsPageT()` in the active language and imported only from the chunk (and, for R116, the window it renders).
  `es/starsPage.ts` is typed `typeof` the English, so a missing word is still a `tsc -b` failure (FR-I18N-2).
  Main measures +923 bytes.
  The magnitude prints one decimal, the typographic minus and no plus (`mag 0.6`, `mag −0.7`, `mag 1,3`), the page's `formatStarMag`, since the pass card's `formatMagnitude` signs both ways.
- **D-778 — The figure name's grid.**
  (R116; FR-STAR-6 as amended, V24-22; D-755.) `placeLabels` keeps D-755's three places, then `gridOffsets` walks the offsets `(i × cell, j × row)` whose point lies inside the drawn endpoints' bounding box grown by half the name's box (so the box reaches into it: Crux at 390 is 23 × 36 px, narrower than `C R U`), sorted by distance from the centroid (ties by row, then column, so the order is fixed), the three places left out; the full spaced name's places, then the abbreviation's.
  The yielding step walks that same list, not the three places alone: a pinned figure's three places all cross its own lines, which never yield, and with the yielding step on them alone `C R U` was still lost to `Acrux` and `Mimosa`.
  Measured on the catalogue with the camera on the figure's mean direction: Orion over Paris (2026-12-15T23:00Z) places `O R I O N` at 390 × 390 and at 798 × 498 (the box the page draws at 1280 × 800), Crux over Neuquén (2027-04-15T03:00Z) `C R U` at both and `C R U X` in a 900 × 640 box, and the sky cases' invariant — no label on a mark, a segment sample or another label — holds.
  The grid is clipped to the places whose box fits the field (a large figure's up-sky ends can project thousands of px out) and walked lazily, stopping at the first free place, so a figure whose centroid is free costs three queries; the placement runs only past `converged()` or when the drawn set changes.
- **D-779 — `Betelgeuse` at 390 is dropped, and the Done is read that way.**
  (R116; FR-STAR-6, FR-STAR-7, V24-23.) At 60° across 390 px the four places beside Betelgeuse each cover a mark or one of Orion's four lines that meet at it; eight directions at four distances (to 36 px) were no better.
  The rule stays: no star name covers a mark or a line, and a dropped name is a tap away.
  R116's `Done when` names `Betelgeuse` placed at 1280 only; the test pins it at 798 × 498, the box the page draws at 1280 × 800, and at 390 pins only that it is not placed over anything.
- **D-780 — The window row stays over until the release.**
  (R116; FR-STAR-9, V24-24; D-759, D-178.) `window` measures 21.8 KB on this branch, rebased on R117 (budget 15; 16.8 on `main` before R116), `stars` 23.6 (40), `main` 169.7 (170).
  The overrun is the budget script's `::warning::`, not a failure.
  Handing the words to the window in the scene would move `Stars.tsx`, outside the `window` lane, under the deadline; the owner chose the re-set at R118 by D-178's rule, D-759 amended to say so.
- **D-781 — What R116 settled in the placement.**
  (R116; FR-STAR-6 as amended, FR-STAR-7; D-755.) Accepted by the owner as written: a mark's box is its glyph's cell, 0.6 em square, centred on the ink; the gap between a mark and its name is half a cell at the name's size; a row is the name's own height; figures are named in order of most drawn segments first; the named label is never dropped — with no free place it takes the first of its four places that is inside the box; it is drawn in `--chart-star-dim` at `--chart-text-12`, like a star's name; and the tap and the hover are wired for the hand camera only, the sensor screen's tap being R117's.
  Settled at the review: where a tap can name, the hand camera holds still until the press travels past the hit radius (12 px), and the tap is tested at the press point, so a finger's wobble neither turns the sky nor misses the mark; a mouse drag clears the hover; a star named from `In this field` whose glyph the collision hid is labelled at its own point; the compass boxes follow the window's own in-view rule (`EDGE_MARGIN_PX`, now `projection.ts`'s).
- **D-782 — The stars inventory takes the scene as a prop, and `open()` keeps its signature.**
  (R117; FR-STAR-5, FR-FSC-8; D-756.) D-756 says `useSkyScreen.open()` takes the scene.
  A scene handed over at the tap would be the instant of the tap, and FR-FSC-8 has the screen show the page's instant as it runs; the hook's state is the store's flag, which a page reads to render the layer over itself (D-350).
  So the tap stays `open()`, and `SkyScreen`'s props are a union on `inventory`: `'passes'` (the default, unchanged) or `'stars'` with the page's live `scene` and no `passes`.
  `Stars.tsx` portals the layer to the body as the pass detail does, closes it on `Esc` in the capture phase (the app's `Esc` would leave `#stars`) and on unmount, holds the document's scroll under it (FR-FSC-9: the compact page scrolls the document), and gives the document its place and the focus back to `[ hold up to the sky ]` on a close of the screen it opened — not on the store's global `refocusWindow`, which a close on any page sets, and not on an unmount (a route change).
  Under the layer the page is `inert` and `aria-hidden` and held at its last render, so a tick redraws one window, the screen's.
  `FR-LIVE-8`'s note shows only after this page's own tap.
  The screen is the sensor's, so it gets no `camera`; it starts at the hand's azimuth at the open (`initialFacingAzDeg`).
- **D-783 — What the window builds for a screen with no pass is left out by the layer.**
  (R117; FR-FSC-1 as amended v2.4, FR-GUT-6, FR-GUT-7.) The task said the window already draws no chip without a pass.
  It does draw one — `t.window.emptySky`, "no pass to turn to" — on any screen with an instant and nothing in the field; upright it draws the next-event block; and `SkyChart` builds a legend of the Sun and Moon lines.
  So `SkyChartProps` carries the inventory (`inventory: 'stars'`, from `SkyScreen`): `SkyChart` builds no legend and the window no chip and no next-event block; FR-FSC-11's advice line under the block stays.
  Hiding them by test id in CSS (the first cut) still built them every tick and would have come back on a renamed id.
- **D-784 — `[ hold up to the sky ]` stands after the layers in both layouts.**
  (R117; FR-STAR-3, FR-STAR-5, FR-WIN-4.) FR-STAR-3 places the row on compact; a wide touch device (a tablet held sideways) passes the presence test too, so the row is in the rail under `Layers` there, and on a desk it is not rendered.
  FR-LIVE-8's note stands beside it (`role="status"`, the one part of the row that wraps); a relative-only phone loses the control for the session (`windowLost`) and keeps the note, as the view control does.
- **D-785 — The release re-sets `stars` to 30 and `window` to 25.**
  (R118; FR-STAR-9, V24-24; D-178, D-759 as amended, D-780.) On the 2.4.0 build, gzip level 9: `stars` 23.6 KB, × 1.1 = 26.0, the next 5 KB line 30, under `STARS_BUDGET_KB` (40), which stays the ceiling; `window` 22.1, × 1.1 = 24.3, so 25 (no ceiling in §11, as since D-242).
  The reason for the window's size is written beside its row in `scripts/bundle-budget.ts`: the names, the page's label words, the constellation table and the magnitude format are shared with the `stars` chunk and Rollup puts what two chunks share in `SkyWindow-*.js`.
  Every other row is the rule agreeing with the number already there.
  The table, beside `6cfa699`'s built on the same machine, is `docs/RELEASE.md` §16.2 and the comment at the top of the script.
- **D-786 — The capture set gains `stars` at 360, 390, 1280 and 1920 and `stars-screen` at 844, and touch is a property of the capture.**
  (R118; FR-CAP-1, FR-CAP-2, FR-STAR-3, FR-STAR-5; D-758.) D-758 names the page at 390, 1280 and 1920; FR-CAP-2 puts a 360 px file beside every compact 390, and `captures.test.ts` holds every non-sky-screen to it, so the page has four widths (16 files).
  The screen is `stars-screen` so its files are `v1-stars-*` as the entry asks, and it joins the sky screen's exception in `captures.test.ts` (844 only).
  The page is shot on a touch phone at 360 and 390, where `[ hold up to the sky ]` is on it, and on a desk without touch at 1280 and 1920, where FR-WIN-4 leaves it off — so `v1-captures.spec.ts` decides touch per capture (`isTouch`) rather than per screen.
  Both are reached through the home with the list settled, like the live page, so the background run cannot change the document between `settled`'s two ticks; the page faces south 35° up as it opens, and the screen is aimed there.
  The set is 274 files.
  The shortcuts route counted the overlay's 8 keys and had failed since R115 added `s` and the page's two rows; it counts 11.
- **D-787 — The diff against `6cfa699` is measured locally, and main's 0.24 KB is recorded, not trimmed.**
  (R118; FR-CAP-5, FR-STAR-9, V24-11; D-742.) A task session cannot dispatch `captures.yml`, and the committed set is the Linux renderer's (D-732), so a Mac run against it differs everywhere.
  The diff of record for the task is both commits shot on one Mac by this branch's spec off plain builds: 155 of 254 byte-identical, 99 differing, every one on four lists — the header's `[ stars ]` (48), the When pane's line (24), the `?` overlay's three new keys (12), F-99's noise (15).
  The entry's "none changed" is read as "nothing but what the phase's own requirements moved".
  The review dispatched `captures.yml` on the branch (runs 40106274669 and 40106522515, D-732's Linux renderer), and run 1's artefact is the committed set in place of the Mac's 20 files (`docs/RELEASE.md` §16.1).
  Main is 1,270 bytes over `6cfa699` against FR-STAR-9's 1 KB; with no `src/` in this task the figure goes to the owner (`docs/RELEASE.md` §16.4), as v2.3's did (D-738).


### 8.17 The stars spike *(v2.4, FR-STAR-12, D-740, D-741)*

The spike sits beside the window spike and borrows from it rather than copying it: the projection and the camera come from `src/` so the measured path is the one the page will run, and the sensor and the meter come from `spike/window/` so R38's iOS facts carry over.
Nothing under `src/` changes and no test is added to `npm test`; the scripts run under `tsx` and Playwright on the owner's machine.
Its acceptance is `docs/stars/FINDINGS.md`, as R38's was `docs/window/FINDINGS.md`: the owner drives it on a phone in an interactive session (§16.6), and the driver lists the task and never runs it.

### 8.18 The stars page *(v2.4.1, FR-STAR-1..11, D-748..D-759)*

The page is a `ui` screen over a `window` drawing over `data` and `lib` modules, and each lane keeps its own side: the catalogue and the positions know nothing of the screen; the window knows the scene and the camera but not the route; the page composes them and owns the strings.
The star field is the window's only new node set and the only one written outside React (D-751).
Nothing outside `#stars` and its screen draws a star; a window without `scene` is `v2.3.0`'s.

### 16.21 Delivery of the v2.4 tasks, first cut *(V24-8, D-740..D-743)*

The V1-11 rules are unchanged.
One task now, R111, the spike; the rest of Phase 2l (the catalogue and positions, the scene and camera, the page, the screen's stars inventory, the release preparation) is cut by v0.12 from `docs/stars/FINDINGS.md` and appended to `## v2.4 tasks` then, numbered from R112.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R111 — The stars spike: the catalogue's size, the rate with 900 glyphs, the render path, the precession path and the ladder, on a phone | `window` (`spike/stars/**`, `docs/stars/**`, `package.json`'s two scripts) | interactive | owner (`docs/stars/FINDINGS.md` with the five answers) | — |

**Precondition:** `data-src/stars/` on `main` (#180, `44c33cf`) and `tests/fixtures/stars/` on `main` (#181).
Both are the owner's commits in the sense V22-17 meant: data a headless session cannot fetch, made in an interactive session at the owner's request (V24-12).

**Decision block** (§16.2): **R111 takes D-744..D-747.**
D-740..D-743 are this cut's; v0.12 starts at D-748.

**What `Done` must say.**
The five answers of D-741 in one line each, the phone and the browser the rate was read on, and the commit of `docs/stars/FINDINGS.md`.

What the session reads (D-284's rule): SPEC §4.46 whole (FR-STAR-1..12), US-38, US-39, §9 Phase 2l, §12 V24-1..V24-12, OQ-39..OQ-42; PLAN §2.39, §8.10, §8.17 and this section; `docs/window/FINDINGS.md`; `spike/window/sensors.ts`, `spike/window/params.ts` and `spike/window/https.config.ts`; `src/ui/components/guide/skychart/window/projection.ts` and `SkyWindow.tsx`; `data-src/stars/README.md`; `tests/fixtures/stars/README.md`; PLAN D-62.

### 16.22 Delivery of the v2.4 tasks, second cut *(V24-13..V24-21, D-748..D-762)*

The V1-11 rules are unchanged except the gate (D-760) and the models (D-761).
Seven `R` tasks in four waves of two, two and two and one, after R111 on `main` (`c7db7c8`).
The deadline is the owner's: every task merged by **2026-10-24 22:00 −03** (V24-21).

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R112 — The catalogue and the positions: `build-stars.ts`, `catalog.json` in columns, the figure-name table, `skyStars.ts`, the two tests | `data` (`scripts/build-stars.ts`, `src/data/stars/**`, `src/lib/skyStars.ts`, `eslint.config.js`'s one line, `package.json`'s script, the notices script and file) | opus | auto | — |
| 1 | R113 — The scene, the camera and the rotation channel: `SkyScene`, `SkyCamera` with the hand source, `useViewRotation` publishing to state and to subscribers | `window` (`skychart/window/**`, `skychart/SkyChart.types.ts`) | fable | auto | — |
| 2 | R114 — The star field: the ladder, the ink offsets, the collision and hit test, the hairlines with their gap and clip, the ground, written by ref | `window` (`skychart/window/**`, `src/ui/styles/tokens.css`, `scripts/contrast.ts`, `tests/styles/tokens.test.ts`, `docs/DESIGN.md`) | fable | auto | R112, R113 |
| 2 | R115 — The `#stars` page: route, chunk and budget row, both layouts, the hand camera, the picker, the layers, `In this field`, the way in, every string | `ui` (`screens/Stars*`, `screens/stars/**`, `common/Header.tsx`, the When pane, `lib/{shareLinks,routeTitle,shortcuts}.ts`, `ui/navigation.ts`, `src/i18n/**`, `scripts/bundle-budget.ts`, `tests/e2e/stars.spec.ts`) | opus | auto | R112, R113 |
| 3 | R116 — The names and the tap: the placement, spaced figure names, the tap and hover label, the readout's second line, the rate | `window` (`skychart/window/**`, `tests/e2e/stars-perf.spec.ts`) | fable | auto | R114, R115 |
| 3 | R117 — The screen's stars inventory: `[ hold up to the sky ]`, `inventory: 'stars'`, the true-north line | `ui` (`components/screen/**`, `screens/Stars*`, `tests/e2e/stars-screen.spec.ts`) | opus | auto | R115 |
| 4 | R118 — The capture set and the release preparation: the stars files, the diff against `6cfa699`, `2.4.0`, `docs/RELEASE.md` §16, no tag | `docs`, crossing into `ui` (`tests/e2e/captureSet.ts`, `tests/e2e/v1-captures.spec.ts`, `docs/screenshots/v1-stars-*`, `docs/RELEASE.md`, `README.md`, `package.json`'s version, `scripts/bundle-budget.ts`'s `stars` limit) | opus | auto | R116, R117 |

No two tasks in a wave name the same file: R113 alone touches `SkyChart.types.ts`; R114 alone touches the sheet and the guide, and R115 uses only tokens already in it; every string, the window's star readout included, is R115's, so R116 adds none; R116 and R117 meet in no file, the screen passing the scene to the window it already renders.
R118 runs alone, so its crossing into `ui`'s capture files is D-655's rule for a wave of one.

**Sessions** (D-761): every row carries `Review: opus`, `Turns: 500`, `Fallback: off`; `Model:` is `fable` for R113, R114 and R116 and `opus` for the rest.

**The budget.** v2.3's eight tasks ran one at a time, each `fable` with an `opus` review at 500 turns, from 2026-10-19 16:48 to 10-22 14:20 with the owner's gates between them; the account's five-hour limit ended an implement session four times (R104 once, R105 twice, R107 once), and the driver kept the worktree for `--wave` or `--task` to resume after the reset.
Unlimited, a task took 45 to 90 minutes; one to two Fable tasks fit in a window.
From the plan's merge (about 2026-10-23 23:30 −03) to the deadline is about 22 hours: four windows and part of a fifth.
Concurrency does not multiply throughput under that limit — three sessions spend the window about three times as fast — but it does shorten the wall clock between stops, so the waves are two wide and no wider.
As an estimate, in windows: a Fable task 0.5–0.7, an Opus task 0.25–0.4 (an assumption: Opus draws less of the limit per task; the owner reads the real figures with `/usage`, and a weekly limit may also apply), an Opus review 0.05.
Three Fable tasks, four Opus tasks and seven reviews come to **about 2.9–4.1 windows of the 4.4 available**: it fits, with about one window to spare at the low end and none at the top.
Fable on every task (D-659's choice for v2.2) would be 4–5.3 windows and does not fit.
The twilight limit and the figure tap (V24-17, V24-18) are moved to v2.5 whole for the same reason, so no task is made thinner.

**The schedule it implies** (−03, from the plan's merge; a stop waits for the window's reset): wave 1 about 00:00–02:00; wave 2 about 02:00–04:30, where the first stop is most likely; wave 3 after the reset, about 05:30–08:00; wave 4 about 08:30–10:00.
With two stops and one CI rerun per task (an e2e shard cancelled at its 10-minute cap by a stalled browser install; a rerun fixes it) the phase ends about 15:00–18:00, four to seven hours inside the deadline.
The critical path is the three `window` tasks (R113 → R114 → R116) and R118; each Fable task starts a wave, so a stop costs the shorter Opus task beside it the least.
**If the budget runs short** — more than 2.5 windows spent when wave 2 merges, or the deadline less than six hours away with wave 3 unmerged — R117 moves to v2.5 whole (the screen's phone check is v2.5's anyway, V24-21) and R118 drops its dependency on it; after that, R118's capture-set extension moves to v2.5's release preparation and R118 writes §16 alone.
Nothing else is cut.

**Owner gates:** none (D-760).
The owner merges this plan, starts `--wave` after each wave merges and resumes after a stop; the captures each visual task files and the phone check are read at v2.5's release preparation.

**Decision block** (§16.2): **R112 takes D-763..D-765, R113 D-766..D-769, R114 D-770..D-773, R115 D-774..D-777, R116 D-778..D-781, R117 D-782..D-784, R118 D-785..D-787.**
D-748..D-762 are this cut's.

**What `Done` must say.**
R112: the counts and the gzipped size the build printed, and the worst fixture separation.
R113: that the live page's and the pass detail's window captures re-shot byte-identical, by name.
R114: the measured ink offsets in Chromium, the window row's size.
R115: the main chunk's and the `stars` row's sizes against `6cfa699`.
R116: the perf spec's rate at 4×, and the capture names.
R117: the e2e names.
R118: the diff list (only `v1-stars-*` files new), the budget table, and the release SHA (no tag).

What every session reads (D-284's rule): SPEC §4.46 whole (FR-STAR-1..14 as amended), US-38, US-39, §9 Phase 2l, §12 V24-1..V24-21; PLAN §2.39, §8.18 and this section; `docs/stars/FINDINGS.md`.
Each task's `Reads:` adds its own files.
