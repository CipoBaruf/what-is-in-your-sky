# v2.4 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.12 Goals (v2.4, "the stars")

- **G40. Hold the phone up and know what you see.**
  The stars, the figures and the planets in front of the reader, named on a tap, from the same sensor path and the same projection the passes already use.
- **G41. The same sky from a desk.**
  The page turns by a drag, the keys and a facing picker, so the feature is not a phone-only one and the desk is where a night is planned.
- **G42. Nothing fetched, nothing heavy.**
  The catalogue is built into the app, loads offline, lives in its own chunk with its own budget, and draws at the rate the window already meets.

**US-38 — Hold the phone up to the stars** *(v2.4)*
As someone outside at night with the app open, I tap `[ stars ]`, hold the phone up, and see the stars that are in front of me drawn where they are, with the figures joined and the bright ones named when I tap them.
- AC1: `#stars` opens a page with the sky drawn facing the pole side of the horizon; `[ hold up to the sky ]` is there where the sensor is, asks in that tap and never on load, and opens the sky screen in the stars inventory (FR-STAR-3, FR-STAR-5).
- AC2: Turning the phone round the horizon, past the zenith and behind me moves the stars continuously with no reset, as the passes move today (FR-WIN-3, FR-FOL-4); pointing at the ground says so (FR-FOL-5).
- AC3: At the three golden sites, at the fixture instant, every catalogue star is drawn within `STAR_TOLERANCE_DEG` of the published ephemeris (FR-STAR-2).
- AC4: A tap on a star or a planet names it beside the mark and on the readout's second line, with its magnitude and altitude; a second tap, or four seconds, clears it (FR-STAR-7).
- AC5: Every star, figure and planet is drawn from the sheet's chart tokens, in both themes, and the night screen is all red (FR-STAR-6, FR-DS-8).
- AC6: With the figures, names and planets on, the screen draws at ≥ 30 updates/s on the FR-GUIDE-6 device (FR-STAR-9).
- AC7: Offline, the page and the screen work exactly as online (FR-STAR-8).

**US-39 — Read the stars from a desk** *(v2.4)*
As a reader at a desk, or on a phone before I hold it up, I turn the sky by hand — a drag, the arrow keys, a compass point — and read what is in the field from a list beside the drawing.
- AC1: On a desk the page is the drawing and a rail: the facing picker, the layer toggles and the "In this field" list; dragging the drawing turns it at the dome's rate and the arrow keys step it (FR-STAR-4).
- AC2: The list names the brightest objects in the field with magnitude, altitude and direction, is the drawing's text alternative, and a row's focus highlights its mark (FR-STAR-7, FR-GUIDE-7).
- AC3: The page is laid out in both languages at every size of FR-SHP-4's matrix without scrolling the drawing out of view on compact, and the header's row still fits 36 cells (FR-STAR-3, FR-COMP-4).
- AC4: The `?` overlay lists the page's keys (FR-DESK-4), and the route has its `h1`, its title and its focus target (FR-A11Y-1..3).
- AC5: The `stars` chunk is under its budget row and the main chunk grew by no more than the route and the link (FR-STAR-9).

### 4.46 The stars *(v2.4)*

The app draws the sky three ways and has never drawn a star.
The window (§4.18) is the one that already answers "what is in front of me": first-person, sensor-fused, calibrated against the zenith, corrected for declination and for a locked rotation, drawing from alt/az through one projection.
Stars are more points through it.
The dome cannot do this — glyphcss's camera looks at the bowl from outside (PLAN §8, D-60), every star is raster work against a 33 draws/s floor, and the braille font holds no letters — and a polar map is a map to read, not a view to hold up (V24-2).
So the stars are the window with a catalogue behind it and, for the first time, a camera a hand can drive; what the window learns here is what the satellites move onto in v2.5.

- **FR-STAR-1** **The catalogue.**
  A build step (`scripts/build-stars.ts`) writes `src/data/stars/catalog.json` from raw files vendored under `data-src/stars/` and committed by the owner once (sessions have no network, V22-17's reason): every star with V ≤ `STAR_MAG_LIMIT` (4.5) from the Yale Bright Star Catalogue (public domain) with its J2000 right ascension and declination, magnitude, Bayer or Flamsteed designation, constellation and IAU proper name where one exists; every star fainter than the limit that is an endpoint of a figure's line, so no figure is cut; the 88 figures as line segments between catalogue ids, from the source OQ-39 names, credited in `public/third-party-notices.txt`; and nothing else.
  The five naked-eye planets are not data: they are `astronomy-engine`'s, evaluated like the Moon.
  The file's star count and byte size are printed by the build step and pinned by `tests/data/starCatalog.test.ts`, with every figure's endpoints present, every id unique and every name present in the string catalog of both languages (FR-STAR-10).
  *(amended v2.4.1, V24-20)* The names are data in the `stars` chunk, not strings in the catalog: the IAU proper names are the same in both languages, and the 88 Latin figure names are one table beside the catalogue, keyed by the IAU abbreviation, with Serpens' two drawn halves named Serpens Caput and Serpens Cauda.
  In the string catalog they would sit in the main chunk and cost it more than FR-STAR-9's 1 KB.
  `starCatalog.test.ts` asserts every star name non-empty and the figure table complete (89 drawn features, 88 names) instead of asserting the names in both catalogs.
  *(amended v2.5, V25-16)* The build also reads `data-src/stars/names-es.tsv` and writes the Spanish names beside the English ones: a Spanish name per figure part and for Serpens whole, and a Spanish name for each star that has a row there (FR-STAR-10 as amended).
  The catalogue test asserts all 88 abbreviations and 89 parts have a Spanish name, every star row's key is a name the catalogue carries, and no Spanish name comes from anywhere but that file.
  *(amended v2.10, V210-7, V210-9, V210-10)* The build writes two more files beside the catalogue: `deep.json`, the stars from 4.5 to `DEEP_MAG_LIMIT` with their B−V as quantised columns (FR-LOOK-8), and `milkyWay.json`, the galactic plane's outline (FR-LOOK-3); the bright catalogue gains a B−V column to 0.1 (FR-LOOK-5).
  `starCatalog.test.ts` pins both files' counts and sizes.
- **FR-STAR-2** **Positions, and how right they are.**
  Every catalogue star's altitude and azimuth at the shown instant come from one rotation per instant from the J2000 equatorial frame to the observer's horizon (`astronomy-engine`'s `Rotation_EQJ_HOR`, precession and nutation inside it), applied to every star, on the main thread in the astronomy chunk's manner (PLAN D-2's path for the Sun, `lib/skyBodies.ts`'s for the Moon): the worker is never called, and the rotation is computed once per shown instant and memoised on it — a change of `t` is a new rotation, a frame under the sensor or the hand is not; one 3 × 3 matrix and 900 products is nothing FR-LIVE-5's once-a-second rule needs to ration, and rationing it would make the stars jump when `t` runs fast (FR-SKY-8).
  Altitudes are geometric, with no refraction, as the passes' are, so a satellite and the star it passes are in one frame.
  The planets are evaluated through the same library at the same tick.
  *Verification:* `tests/fixtures/stars/<site>-<instant>.json`, the owner's capture from a published ephemeris (Stellarium or the USNO, named in the fixture's `.meta.json`, as the Heavens-Above fixtures are; *as captured, V24-12:* IAU SOFA through astropy for the stars and JPL Horizons for the planets) at the three R1 sites at one instant each, for twelve stars across the sky and the five planets; `skyStars.test.ts` holds every one within `STAR_TOLERANCE_DEG` (0.25°, half the Moon's width, five times tighter than FR-GUIDE-4's degree, chosen so a figure's shape is right and not only its place).
- **FR-STAR-3** **The section.**
  A route `#stars`, reached from a `[ stars ]` / `[ estrellas ]` link in the header's page links beside `[ live ]` on wide, and on compact from the first line of the home's When pane ("Stars tonight · [ look up ]" / "Estrellas esta noche · [ mirá arriba ]"), because the compact header holds 34 of its 36 cells (FR-COMP-1, D-441) and the live page's actions rows 32 and 33 (FR-COMP-7), and neither word fits either (V24-10; OQ-40 resolved), with its own title, `h1` and focus target (FR-A11Y-1..3), inert with FR-LIVE-1's one-line message when there is no observer.
  **Wide** (FR-DESK-1's breakpoint): the drawing's box on the left, cut to the window's shape from what the window leaves as FR-LIVE-7's rail rule cuts the dome's, and a rail of `RAIL_MIN_CELLS` on the right holding, top to bottom: `Facing` — a `ToggleGroup` of the eight compass points and `up`; `Layers` — `[x] stars` `[x] figures` `[x] planets` `[ ] names`; and `In this field` (FR-STAR-7).
  The facing readout (FR-FSC-3's form, "Facing SW · 32° up", with the field's width across) stands in the box's top-left corner on `--screen-overlay`.
  **Compact**: the one-row header (FR-COMP-1), the readout row, the box full-bleed (FR-COMP-5's rule, `COMPACT_BOX_MIN_SHORT_PX` its floor), the facing row and the layers row within FR-COMP-4, `[ hold up to the sky ]` / `[ apuntá al cielo ]` as one `--tap` row where FR-WIN-4's presence test passes and nothing where it does not, then the list.
  The page opens facing `STARS_DEFAULT_FACING` — 180° south of the equator, 0° north of it: the pole side, where the circumpolar stars are and the field is never empty — at `STARS_DEFAULT_TILT` (35°), and every open is the same: the camera is not saved (FR-WIN-5's reason, the preference holds nothing of the window).
  Every primitive on the page is §4.45's and every length a token (FR-DS-2).
  *(amended v2.4.1, V24-16)* The layers read `[x] stars` `[x] figures` `[x] planets` `[x] names`: names are on by default, because they are half of the look the owner chose (V24-13) and the placement rule keeps them to a few per field.
  *(amended v2.6, V26-2, V26-4, V26-5)* On compact the entry is the home's Stars door (FR-FLOW-1), not the When reading's first line; the page has the compact top row and a visible `h1` (FR-FLOW-3) and lays out in FR-FLOW-4's and FR-FLOW-8's order.
  *(amended v2.10, V210-5)* The page offers the whole sky through a view row, the polar chart in the window's box with the page's layers, not saved (FR-PHONE-7).
  *(amended v2.11, V211-4)* The compact layout — the one-row header, the readout row, the full-bleed box, the facing row, the layers row, the list — is replaced by FR-CLEAN-1..4: the box is the screen and the rows are the sheet's.
  Wide is unchanged.
- **FR-STAR-4** **The hand camera.**
  On the page the window takes the dome's controls, from the same constants: a pointer drag at `DRAG_PX_PER_DEG` (4 px per degree), `YAW_STEP_DEG` (15°) for `←`/`→` and `PITCH_STEP_DEG` (5°) for `↑`/`↓` while the box has focus — the three shared from `dome/camera.ts` — one update per animation frame with the pointer captured; a compass point on the facing picker turns to it at the current tilt and `up` sets the tilt to 90°.
  The tilt range is the page's own, not the dome's [5°, 80°]: `STARS_TILT_MIN_DEG` (−10°) to `STARS_TILT_MAX_DEG` (90°), so the horizon can stand high in the field and FR-FOL-5's two ground states apply exactly as they do under the sensor.
  The camera is one rotation (FR-WIN-3's `Mat3`) whatever drives it: the hand composes `uprightRotation(az, alt)` and the sensor composes the device's; smoothing, the ground state, the readout and the gutter read the rotation and never ask which (FR-STAR-11).
  On a phone the page's box is hand-driven too; the sensor is the screen's (FR-STAR-5).
  The `?` overlay lists the four keys and `s` opens the page (FR-DESK-4 amended to add it).
  *(amended v2.4.1, V24-19)* There is no pinch and no zoom in this phase: the field stays `WINDOW_FOV` under the hand and the sensor.
  Zoom is v2.5's, decided once for the stars and the satellites on the one camera.
  *(amended v2.5, V25-14)* And decided: FR-SKY-14's pinch, ctrl + wheel and `+`/`-`/`0` on the box, here as on every window.
- **FR-STAR-5** **The screen, stars inventory.**
  `[ hold up to the sky ]` is FR-WIN-4's tap: it asks for the permission, waits one reading as `useSkyScreen.open()` does, and opens the sky screen (§4.23) in the **stars inventory** (FR-FSC-1 as amended): the window drawing with FR-STAR-6's content and no pass, the `×`, the facing readout, and the gutter with its band and bracket and no tick and no chip.
  Everything of §4.23 holds — the layer, the turn (FR-FSC-10), the notes (FR-FOL-5), no scroll (FR-FSC-9), the `×` and `Esc` (FR-FSC-2) — and the layers are what the page's toggles were when it was opened.
  A denial or a relative-only reading leaves the page as it was with FR-LIVE-8's note beside the control (FR-FOL-2).
  The screen shows the instant the page shows (FR-FSC-8), which in this phase is now (FR-STAR-8).
  *(withdrawn v2.9, V29-1)* `[ hold up to the sky ]` gives way to `[ follow the phone ]` on the stars page (FR-GYRO-1); the stars page's own window follows the phone.
- **FR-STAR-6** **What is drawn, and from which tokens.**
  On the window's SVG, in this order under the horizon and the rings of FR-WIN-2: the figures as 1 px polylines in `--chart-figure`, each segment clipped at the field's edge as an arc is; the stars and the planets as **characters** — SVG `<text>` in `--font-mono`, centred on the projected point (`text-anchor: middle`, `dominant-baseline: central`), so a star is a glyph of the app's own type placed exactly where it is, not a disc and not a cell of a text grid (V24-9) — in a ladder where the glyph and its size carry magnitude: V ≤ 0.5 `*` at `--chart-text-15`; ≤ 1.5 `*` at `--chart-text-12`; ≤ 2.5 `+` at `--chart-text-12`; ≤ 3.5 `.` at `--chart-text-12`, these four in `--chart-star`; ≤ 4.5 `.` at `--chart-text-12` in `--chart-star-dim`; a planet `@` at `--chart-text-12` in `--chart-planet`, the glyph being what says "planet" without colour.
  Two glyphs whose centres fall within half a cell of each other (`--chart-text-12` / 2 in the box's px) draw the brighter alone, so a close pair never prints as a smudge; the ladder and the collision rule are one pure function (`starGlyphs.ts`) with a table test.
  A tap or a click is resolved by the same module's hit test — the nearest projected glyph within `--tap` / 4 (12 px) of the point, or none — so there is no hit node per star, and each text node exists once and is toggled by `visibility` (FR-STAR-9).
  Then the Sun's glow and the Moon's glyph as FR-DOME-6 has them; with `names` on, the IAU proper name beside every star of V ≤ 1.5 and the Latin name of each figure at the centroid of its drawn segments, in `--chart-text-12` and `--chart-star-dim`, a label dropped where it would overlap another (FR-DOME-3's collision rule, names after compass).
  Below the horizon nothing is drawn, as FR-FOL-5 has it.
  No hex, no px length outside the sheet (FR-DS-2: the two sizes are the sheet's chart text tokens, the hit distance is `--tap` / 4).
  Monochrome keeps the reading (FR-X-5): the glyph is the magnitude, `@` is a planet, a line is a figure.
  *(amended v2.4.1, V24-13..V24-16)* **The look, after the spike.**
  The owner held the spike beside Sky Guide (Fifth Star Labs, iOS) and asked for its look in the app's own characters and colour tokens.
  The drawing is this, in place of the text above where they differ, in this order under the horizon and the rings of FR-WIN-2.
  **The ground:** on a window whose scene carries stars, the horizon's closed image (FR-FOL-5's clip path) is filled with `--chart-ground` at `--window-fill-opacity` whenever the horizon is in the field, so the sky has a floor; FR-FOL-5's hatch and notes sit on it in their two states unchanged, and the compass points are FR-WIN-2's own — N, E, S and W in `--chart-compass` on the horizon line, the minor points beside them — reused, not redrawn.
  A window whose scene has no stars draws no fill, as at `v2.3.0` (FR-STAR-11).
  **The figures** are hairlines, `--chart-hairline` (0.75 px) in `--chart-figure`, with no dash and no opacity: each segment stops short of the glyph at both ends by the collision distance (half the small size), so a line never touches a star; a segment shorter than the two gaps is not drawn; a segment with either end above the horizon is drawn, clipped to the sky side of it and at the field's edge as an arc is.
  **The stars and the planets** are characters, SVG `<text>` in `--font-mono`, with each glyph's **ink** centred on the projected point, not its em box: the box is centred as above and shifted by the glyph's ink offset, measured once per glyph and size at load, after the fonts are ready, from the canvas's text metrics (V24-15).
  The ladder has three sizes and three tones (V24-14): V ≤ 0.5 `*` at `--chart-text-18`; ≤ 1.5 `*` at `--chart-text-15`; ≤ 2.5 `+` at `--chart-text-12`, these three in `--chart-star`; ≤ 3.5 `.` at `--chart-text-12` in `--chart-star-dim`; ≤ 4.5 `.` at `--chart-text-12` in `--chart-star-faint` (a mark: ≥ 3 : 1 in both themes, and below `--chart-star-dim`).
  A planet is `@` in `--chart-planet` at the size its magnitude at the shown instant earns on the same ladder (`astronomy-engine`'s illumination: 18 px at V ≤ 0.5, 15 at ≤ 1.5, 12 otherwise).
  The collision rule (half the small size, the brighter alone) and the hit test (12 px) are unchanged.
  **The names** (V24-16), with `names` on: the IAU proper name of every drawn star of V ≤ 1.5, in `--chart-text-12` and `--chart-star-dim`, at the first of right, left, above and below that is free; and the Latin name of each figure with two or more drawn segments in spaced capitals (`C R U X`; three spaces between two words), centred on the centroid of its drawn endpoints, in `--chart-text-11` and `--chart-figure-name` (text: ≥ 4.5 : 1 in both themes, and below `--chart-star-dim`, so a figure's name is dimmer than a star's) — the full name where its width fits the figure's drawn width plus two cells, the IAU abbreviation in spaced capitals (`C M A`) where it does not.
  A label is placed only where it covers no drawn mark, no drawn segment and no label already placed, in the order: the compass, the named mark's label (FR-STAR-7), the star names brightest first, the figure names.
  A star name with no free place is dropped.
  **A figure keeps its name:** a figure name with no free place at its centroid tries one row above and one row below it, then the abbreviation in the same three places, and if none is free, the star names in its way are dropped, faintest first, until it fits — so `Ori` is not lost to `Betelgeuse`.
  No mark and no compass point is ever dropped for a name.
  The ladder, the ink offsets, the gap and the collision rule are one pure module with a table test, and the placement is another.
  Below the horizon nothing is drawn but the ground.
  No hex and no px length outside the sheet: the four new tokens join FR-DS-8's, each colour with a night value.
  Monochrome keeps the reading (FR-X-5).
  *(amended v2.4.1, V24-22)* **A figure's name where its centroid is crowded.**
  A figure name is centred on the centroid of its drawn endpoints; where that place is not free, at the free place nearest the centroid inside the figure's drawn extent (the name's box reaching into the drawn endpoints' bounding box), on a grid of one row (the name's height) by one cell, the full name before the abbreviation; the centroid and the rows above and below it are tried first, as above, and only where no place on either form's grid is free does the figure drop the star names in its way, at the first place of the same walk where only star names are in the way.
  A star name keeps its four places beside the mark (V24-23): where all four are covered, as `Betelgeuse` is by Orion's lines at phone width, the name is not drawn, and a tap names the star (FR-STAR-7).
  *(amended v2.5, V25-16)* In Spanish the figure names are the Spanish names upper-cased with their accents (`O R I Ó N`, `C R U Z   D E L   S U R`) under the same fit rule; the abbreviation that stands in when the name does not fit is the IAU's in both languages (`C M A`).
  *(amended v2.10, V210-7, V210-8, V210-10)* §4.53 is the look from this version, in place of the ladder and the greys above where they differ: the surface and the horizon band under everything (FR-LOOK-1, FR-LOOK-2), the haze under the figures (FR-LOOK-3), `*` to magnitude 2.5 at `STAR_SIZES_PX` and round dots sized by magnitude below it (FR-LOOK-4), four tones by B−V (FR-LOOK-5), the bloom under the brightest (FR-LOOK-6), the Moon's disc (FR-LOOK-7), and the stars and the names to the field's step (FR-LOOK-9).
  The ground, the figures' gap, the ink centring, the names' placement, the hit test and the collision rule stand.
- **FR-STAR-7** **Naming, and the list.**
  A tap or a click on a star or a planet names it: a label beside the mark (name, or designation where there is no proper name; magnitude as `mag 0.6`) and the readout's second line ("Canopus · mag −0.7 · 28° up · S"); a second tap, a tap elsewhere or `STAR_LABEL_HOLD_S` (4 s) clears it.
  On a desk, hovering shows the same label while the pointer is there.
  `In this field` lists the `FIELD_LIST_MAX` (12) brightest objects in the drawn field, brightest first, each a row: name, magnitude, altitude, 16-point direction; a row's focus or activation names its mark as a tap does (FR-LEG-4's rule); the list is the drawing's text alternative (FR-GUIDE-7) and the drawing is `aria-hidden`; with no star in the field (pointed at the ground) the list is FR-FOL-5's note.
  On the screen the list is not shown (FR-FSC-1); the tap and the readout are.
  *(amended v2.4.1, V24-14, V24-18)* A planet's magnitude in the label, the readout and the list is the library's at the shown instant, as its size is.
  A tap names a star or a planet only; a tap on a figure's line naming the constellation is v2.5's (FR-STAR-14).
  *(amended v2.11, V211-5)* On compact `In this field` is the sheet's last group, open under its heading (FR-CLEAN-4); the tap, the readout's second line and the row's naming are unchanged.
- **FR-STAR-8** **Now, and offline.**
  The page and the screen draw the sky at real time, ticking as the live page's watching state ticks; there is no stripe, no scrub and no `t` in the hash in this phase (OQ-41).
  *(amended v2.5, V25-4)* The stars page keeps now; the live page's `[ stars ]` draws the stars at its shown instant `t` and the pass detail's at its own (FR-SKY-8), which is where the planner's case lives.
  The catalogue is in the `stars` chunk, precached by the service worker with the other chunks (FR-OFF-1), so the page works offline exactly as online with a saved observer; with none it is FR-LIVE-1's inert line.
  *(amended v2.12, V212-7)* The page's views stay at now; the wide page's globe has its own instant with its own time controls, which move the globe and nothing else (FR-GLOBE-7).
- **FR-STAR-9** **The chunk and the rate.**
  `#stars` is a lazy chunk, `stars`, holding the page, the catalogue and the star drawing, with its own row in `scripts/bundle-budget.ts` at `STARS_BUDGET_KB` (40 KB gzipped until the release re-sets it by D-178's rule); the main chunk grows by the route, the link and the prefetch only, ≤ 1 KB over `v2.3.0`'s measure; no other row moves.
  With every layer on, the screen and the page's box draw at ≥ 30 updates/s on the FR-GUIDE-6 device under the sensor and under a drag, measured by `tests/e2e/stars-perf.spec.ts` the way `dome-perf.spec.ts` measures the dome; the window's stable-DOM rule (every star a node that exists once and is toggled by `visibility`) holds.
  The rate's risk is named: at `v2.3.0` the window's rotation is React state and a frame re-renders the SVG, which 900 text nodes may not survive on a phone; if the spike (FR-STAR-12) measures that path under 30, the star positions are written to their nodes by ref outside render — the nodes still React's, their `x`/`y` not — and the plan says so before the page task is cut.
  *(amended v2.4.1, V24-20)* The spike measured the path (PLAN D-744): through React the dense southern field falls to 19 draws/s at 4× throttling, and written by ref it holds about 100.
  The positions of every star, planet, segment and name are written to their nodes outside render — the rule now, not the fallback — while the window's existing layers stay React's.
  The catalogue is columns, 21.1 KB gzipped at the spike, and `STARS_BUDGET_KB` stays 40 (D-745).
  *(amended v2.10, V210-9)* A second lazy chunk, `stars-deep`, with its own row at `DEEP_BUDGET_KB` (FR-LOOK-8); the rate rule holds at `WINDOW_FOV_MIN_DEG` with the deep stars drawn through a pool of `DEEP_NODE_POOL` nodes written by ref (FR-LOOK-9, FR-LOOK-11).
- **FR-STAR-10** **Both languages.**
  Every string the page shows is in the string catalog in English and Spanish (FR-I18N-*): the link, the headings, the facing points (`compass`'s names), the layer labels, the list's words and the control.
  Proper names are the IAU's in both languages; figure names are Latin in both.
  The compact rows fit 36 cells in both (FR-COMP-4), checked by `controlRows.test.ts`.
  *(amended v2.4.1, V24-20)* The proper names and the figure names are the catalogue's data, the same in both languages (FR-STAR-1 as amended), not strings in the catalog; every other word on the page is.
  *(amended v2.5, V25-16)* And in Spanish they are Spanish: the 88 constellations by their Spanish names (`Orión`, `Can Mayor`, `Cruz del Sur`, Serpens' halves `Cabeza de la Serpiente` and `Cola de la Serpiente`, Serpens whole `Serpiente`) and the stars with an established Spanish form by it (`Sirio`, `Canopo`, `Arturo`, `Proción`, `Aldebarán`, `Pólux`, `Cástor`, `Régulo`, `Espiga`, `Estrella Polar`, `Denébola`, `Alfard`, `Alcíone`, `Mérope`); every other star keeps its IAU name in both.
  The names stay the catalogue's data in the `stars` chunk, picked by the active language at render, never strings in the catalog; they apply wherever a name is shown — the tap label, the figure names, `In this field`, the landmark line, the `Among` column, the readout.
  The list of record is `data-src/stars/names-es.tsv`, committed with this amendment and read by the build (FR-STAR-1); a session never invents a name.
  A name wider than its place is never cut mid-word on the drawing (FR-STAR-6's fit rule falls back to the abbreviation); in `In this field` and the tap label a row is one line ended by `…` with the whole name as its accessible name, and `controlRows.test.ts` checks the longest Spanish names (`Cabeza de la Serpiente`, `Cabellera de Berenice`) at 360 px.
- **FR-STAR-11** **The scene and the camera, named.**
  The window is re-cut into what v2.5 needs, without changing what the live page's window draws: a **`SkyScene`** — the bodies of one instant at one observer in alt/az: horizon and rings, Sun, Moon, passes with their arcs and markers (as `SkyChartProps` carries them today), stars, figures, planets — and a **`SkyCamera`** — one rotation with two sources, the sensor and the hand (FR-STAR-4).
  `SkyChartProps` gains `scene` beside `passes` and the window draws every layer the scene carries and skips the ones it does not; the live page's and the pass detail's windows pass a scene with no stars and are pixel-identical to `v2.3.0`'s captures.
  FR-LIVE-10's rule stands: nothing draws a satellite by another path.
  *(proposal; the plan decides the names and the files.)*
- **FR-STAR-12** **The spike, first.**
  Before the page task is cut, a half-day spike in `spike/stars/` fixes with numbers: the catalogue's size at 4.5 with the figure endpoints and the source OQ-39 picks, gzipped, as JSON objects and as columns (one array per field), so `STARS_BUDGET_KB` is set from a measure and not a guess; the draw rate of the window with 900 glyph nodes, the figures and the names on, under the sensor on a phone (D-62's method), measured twice — through React's render as the window draws today, and with the positions written by ref outside it (FR-STAR-9) — beside the same scene drawn as discs, so V24-9 has its number — if the glyphs cannot hold 30 draws/s where discs can, the decision is revisited with that measure and not before; the precession path against the fixture (FR-STAR-2); and the glyph ladder's two sizes and the collision distance at 390 and 1280 px, judged on whether Crux keeps its shape and Orion's belt stays a line of three.
  One page with every knob as a URL parameter, captures, a findings file the owner reads, and the owner on a phone, not headless (FR-WIN-7's rule, V11-9).
- **FR-STAR-13** *(v2.4.1, V24-17; built in v2.5)* **The twilight limit.**
  While the sky is still light, fewer stars are drawn: the faintest rung drawn follows the Sun's altitude the scene already carries (FR-DOME-6), on by default, so the field shows what the eye can see at that hour.
  Decided with the look; built in v2.5 so that v2.4 meets its deadline (V24-21).
  *(amended v2.5, V25-9)* Its steps are FR-SKY-3's — every rung at the Sun's altitude −6° and below, the first two rungs and every planet above −6°, nothing above 0° — on the stars page, its screen and the pass pages alike, so one rule thins every drawing of the sky.
- **FR-STAR-14** *(v2.4.1, V24-18; built in v2.5)* **Naming a figure.**
  A tap or a click on a figure's line, where no star or planet is within the hit distance, names the constellation beside the tap and on the readout's second line, and clears as a star's label does (FR-STAR-7).
  Decided with the look; built in v2.5 (V24-21).

### 5.12 v2.4 additions *(proposal; the plan decides)*

- **Data.**
  `data-src/stars/` (the vendored raw files and their licences, the owner's commit), `scripts/build-stars.ts`, `src/data/stars/catalog.json` with a `catalog.ts` reader typed by `zod`, and `tests/data/starCatalog.test.ts`.
- **Positions.**
  `lib/skyStars.ts` beside `lib/skyBodies.ts`, the second main-thread exception in the lint boundary, loaded with the `stars` chunk: `starsAt(observer, t) → { stars, planets }` in alt/az, memoised on `t`.
- **The glyphs.**
  `skychart/window/starGlyphs.ts`, pure: the magnitude ladder (glyph, size token, colour token), the collision rule and the hit test over projected points; `SkyWindow` renders its output as `<text>` nodes in one stable group, positioned by ref outside render if the spike says so (FR-STAR-9).
- **The scene and the camera.**
  `skychart/scene.ts` (`SkyScene`) and `skychart/window/camera.ts` (`SkyCamera`: `source: 'sensor' | 'hand'`, the `Mat3`, the reducers moved from `dome/camera.ts` where they are shared), `useViewRotation()` returning the rotation whichever source drives it; `useDeviceOrientation` unchanged underneath.
- **The page.**
  `screens/Stars.tsx` as a lazy chunk with `starsChunk.ts`'s prefetch, `StarsRoute.ts`, `isStarsRoute`/`STARS_HASH` in `shareLinks.ts`, the header link on wide, the When pane's line on compact, the `s` key in `useShortcuts`, a `RouteName` value, and `routeTitle.ts`'s row; the screen's `inventory` prop.
- **Tests and captures.**
  `skyStars.test.ts` on the fixtures; `SkyWindow.stars.test.tsx`; `tests/e2e/stars.spec.ts` with the orientation stub; `stars-perf.spec.ts`; captures at 390, 1280 and 1920 in both themes and languages and the screen at 844 × 390, on the capture set's clock over the showcase night (FR-SHOW-9's place), joining `captureSet.ts`.
- **No new dependency.**
  `astronomy-engine` does the rotation and the planets; the catalogue is data.
- *(v2.4.1, V24-13..V24-16)* **The look.**
  The glyph module gains the ink offsets, measured at load, and the three-size ladder; the names are placed by a second pure module (`starLabels.ts`) over the projected marks and segments; the ground fill and the figures' gap are the window's.
  PLAN v0.12 names the files.

### Phase 2l — v2.4 ("the stars", as decided 2026-10-19, V24-1)

After v2.3 is on `main` (`6cfa699`; no tag, V24-11), built from the sheet and the primitives.
Precondition: the raw star files and the three ephemeris fixtures on `main` as the owner's commit (FR-STAR-1, FR-STAR-2; V22-17's pattern).
The tasks, in order:

- The spike (FR-STAR-12), the owner on a phone; its findings fix OQ-39, the radii and the rate before anything else is cut.
- The catalogue and the positions (FR-STAR-1, FR-STAR-2, FR-STAR-10's names): the build step, the reader, `skyStars.ts`, the two tests.
  No UI.
- The scene and the camera (FR-STAR-11, FR-STAR-4): `SkyScene`, `SkyCamera`, the hand source, the live page's and the pass detail's windows pixel-identical after it.
- The page (FR-STAR-3, FR-STAR-6, FR-STAR-7, FR-STAR-8, FR-STAR-9): the route, the link, the layouts, the drawing, the list, the chunk and its budget row.
- The screen's stars inventory (FR-STAR-5; FR-FSC-1 as amended).
- Captures and release preparation: the set extended, `v2.4.0`, `docs/RELEASE.md` §16 (no tag and no deploy, V24-11), the README's screens and the reading order naming the stars.

Definition of done:
- US-38 AC1–AC7 and US-39 AC1–AC5 accepted; FR-STAR-1..12 met.
- `skyStars.test.ts` within `STAR_TOLERANCE_DEG` at the three sites; `starCatalog.test.ts` green; `stars-perf.spec.ts` ≥ 30 updates/s; the capture set extended and FR-CAP-5's two runs agreeing.
- The live page's and the pass detail's captures byte-identical to `v2.3.0`'s: the phase draws a star on `#stars` and its screen only.
- `npm run bundle:budget`: the `stars` row present and under `STARS_BUDGET_KB`; main ≤ 1 KB over `v2.3.0`; no other row moved.
- `literals.test.ts` green with no new allow-list entry: the page is built from the sheet.
- The owner has held a phone up to a clear sky on the v2.4 build (`main`'s preview, V24-11) and named three stars and a planet against another app.

*(v2.4.1, V24-13..V24-21)* The tasks after the spike are cut by PLAN v0.12 §16.22 to meet the owner's deadline, 2026-10-24 22:00 −03: the catalogue and positions; the scene and camera; the star field as FR-STAR-6 is amended; the page with its way in and its list; the names; the screen's stars inventory; the capture set and the release preparation (`docs/RELEASE.md` §16, `2.4.0`, no tag).
Every one merges on CI and review (V24-21).
The last item of the definition of done — the owner's phone held up to a clear sky — moves to v2.5's release preparation, with the owner's reading of the stars captures; FR-STAR-13 and FR-STAR-14 are v2.5's.
