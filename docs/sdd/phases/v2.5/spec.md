# v2.5 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.13 Goals (v2.5, "one sky")

- **G43. One scene.**
  Whatever draws the sky — the dome, the polar chart, the window, the screen — draws the same inventory of one instant from one source, and a star or a pass is at the same place in all of them.
- **G44. The window everywhere.**
  The first-person view is a view on every page and every device, hand-driven where there is no sensor, so a desk can point at the sky the way a phone does.
- **G45. The pass among the stars.**
  A reader finds a satellite by the stars around it: the stars are under the arcs by default, at the instant the page shows.

**US-40 — See the pass among the stars** *(v2.5)*
As a reader watching a pass through the phone, or scrubbing to one at a desk, I see the stars under the arc, so "it rises under Orion" is something the drawing shows and not only something the guide says.
- AC1: The live page's and the pass detail's drawings and screens carry the stars, the figures and the planets under the arcs, on by default, behind one `[ stars ]` toggle that is remembered (FR-SKY-3).
- AC2: On the live page the stars are drawn at the shown instant `t` and move with it when I scrub or play; on the pass detail at its instant (FR-SKY-8).
- AC3: The polar chart shows the stars to magnitude 3.5 under the arcs; the dome shows the twenty brightest as dots; a star I pick is at the same place in the three views and on the screen (FR-SKY-1, FR-SKY-4, FR-SKY-5).
- AC4: The dome's drag rate on the FR-GUIDE-6 device is not below its `v2.4.0` measure by more than a tenth, and never below 30 (FR-SKY-5).
- AC5: On the stars page, `[ passes ]` brings tonight's passes onto the sky with their keys, the gutter's ticks and the chip, and the list names them; the screen it opens is the live page's screen with the stars on (FR-SKY-6).
- AC6: On the live page and the pass detail, the highlighted pass has a line under its name that names the bright star nearest its peak and the constellation the peak is among ("passes 7° above Betelgeuse, in Orion"), and that star is ringed in the dome, the polar chart, the window and the screen; with `[ stars ]` off neither is shown (FR-SKY-11).
- AC7: The pass detail's rise, peak and end rows, and the shadow-entry row where there is one, name the constellation each point is among (FR-SKY-12).
- AC8: In Spanish every star and constellation name the pages show — the landmark line, the `Among` column, the tap label, the figure names and `In this field` — is the Spanish name where `names-es.tsv` has one (`en Orión`, `Can Mayor`, `Sirio`) and the IAU name otherwise (FR-STAR-10 as amended).

**US-41 — Point the window from a desk** *(v2.5)*
As a desk reader, I choose the window on the live page or a pass detail and turn it by hand; the pass detail's window opens already looking at the pass.
- AC1: The view control offers the dome, the polar chart and the window on every device; on wide the window is laid out in the box with the hand camera and can be my saved view; on compact choosing it opens the screen as today (FR-SKY-2).
- AC2: A pass detail's window opens facing the pass's peak azimuth at a tilt that keeps the peak in the field, the arc clipped at the edge like any arc, and its facing picker offers `peak` (FR-SKY-7).
- AC3: The contract test holds the same anchors, keys and star across the three views (FR-SKY-1).
- AC4: The captures show the window on the live page and the pass detail at 1280 and 1920 px in both themes, and the two screens at 844 × 390 with stars and passes together (FR-SKY-9).
- AC5: On the live page with the window in the box, the facing picker offers the highlighted pass's key after `up`; choosing it, or pressing `f`, turns the window to the pass and keeps it there as the pass moves, until I drag or pick another facing (FR-SKY-13).
- AC6: I pinch, ctrl-scroll or press `+`/`-` on the window, wherever it is drawn, and the field narrows to 20° or widens to 90° about its centre with the stars the same size; the readout names the field while it is not 60°, `0` restores it, and a reload opens at 60° (FR-SKY-14).

### 4.47 One sky *(v2.5)*

v2.4 taught the window a scene and a camera and drew the stars on one page.
This block makes that the way the app draws the sky: one scene for every view, the window on every page and device, the stars under the passes, and the two screens one screen.
The dome stays what a new reader sees first (V25-1): it is the product's signature and the mark's lineage, and it gains the brightest stars rather than losing its place.

- **FR-SKY-1** **One scene, a layer table per view.**
  Every drawing of the sky — `SkyDome`, `SkyPolar`, `SkyWindow`, on the live page, the pass detail, the stars page, the Where pane and the screen — draws from one `SkyScene` (FR-STAR-11) built once per tick by one hook from the observer, the instant and the layer toggles, through a **layer table** that says what each view draws: the window every layer; the polar chart the passes, the Sun, the Moon, the planets and the stars to `POLAR_STAR_MAG` (3.5), no figures and no names (OQ-43); the dome the passes, the Sun, the Moon and the stars to `DOME_STAR_MAG` (1.5) and the planets as dots, no figures and no names.
  A view skips a layer by the table and never by a condition of its own.
  `SkyChartProps` carries `scene` beside `passes` (FR-LIVE-10 as amended); the passes stay on their path.
  *Verification:* `SkyChart.contract.test.tsx` gains a star case — a scene with one star and one planet at a known altitude and azimuth is at the same anchor in all three views, within the views' own tolerances — and the layer table is a pure module with a test that every view names every layer.
  *(amended v2.5, V25-9)* The table gains two rows: the landmark's ring, drawn by every view (the dome only for its own stars, FR-SKY-11), and its name, drawn by the window and the screen only (the dome's font holds no letters; on the polar chart's 250-unit disc a name would sit on the arcs and the ring is enough).
  The contract test's star case is the landmark: the ring is at the same anchor in the three views.
  *(amended v2.10, V210-5, V210-7)* The polar chart's row is the star layer whole — stars to `STAR_MAG_LIMIT`, the figures, the names with `names` on (FR-PHONE-8) — and the window's field outline where the page has a camera (FR-PHONE-9); the window's row adds the surface and the band, the haze, the bloom and the Moon's disc (FR-LOOK-1..3, FR-LOOK-6, FR-LOOK-7).
  The dome's row does not change (FR-PHONE-11).
  *(amended v2.12, V212-1)* The globe (§4.55) is not a `SkyChart` view and reads no layer table: it draws the stars page's own layers over the whole sphere at its own instant (FR-GLOBE-2..4, FR-GLOBE-10).
- **FR-SKY-2** **The window on every page and device.**
  The chart view control offers the dome, the polar chart and the window on the live page and the pass detail for every reader (FR-FSC-6 as amended; FR-WIN-4's presence test governs the sensor alone).
  **Wide:** the window is a view laid out in the box, cut to its shape as FR-STAR-3 cuts the stars page's, under the hand camera (FR-STAR-4: drag, keys, the facing picker in the rail), with the facing readout in the box's corner; it may be the saved preference (FR-WIN-5 as amended); *(amended v2.5, V25-17)* on the wide live page the status slot of every view — the dome's facing readout, the polar chart's convention line, the window's facing readout — stands in the box's top-left corner on that same overlay, so the row above the box is the view control alone and stays one line at every wide width; where the device has a sensor as well (a tablet), `[ hold up to the sky ]` in the rail opens the screen.
  **Compact:** unchanged — choosing the window is the tap that asks and opens the screen (FR-FSC-1, FR-FSC-6), the preference holds the dome or the polar chart, the window is a mode; a compact reader without a sensor (a phone-sized desk window, FR-TAB-1's sizes) gets the window laid out in the box under the hand camera, since there is no screen to open and nothing to ask; that choice is not saved (the compact preference holds the dome or the polar chart, FR-WIN-5 as amended), so a reload opens on the saved view — and that reader is every headless capture at 390 px, so the compact captures of the window view show the box (FR-SKY-9).
  `[ ground ]` and `[ buried ]` (FR-FOL-5) apply under the hand as under the sensor.
  *(amended v2.6, V26-5)* On compact the view control is one line with `[x] stars` at its end, and the window's readout, picker and hint follow FR-FLOW-4 and FR-FLOW-6.
- **FR-SKY-3** **The stars under the arcs.**
  The live page, the pass detail and the screen draw the stars layer — stars, figures, planets, as FR-STAR-6 draws them, under the arcs in SVG order and under the line layer on the dome — behind one `[ stars ]` / `[ estrellas ]` toggle, **on by default**, saved in the prefs as `starsLayer`: on the live page's actions row and the pass detail's view row within FR-COMP-4, and set from the page before the screen opens (the screen holds its four things, FR-FSC-1).
  With it on, the `stars` chunk is loaded when the page is (prefetched on idle after the chart chunk, FR-SKY-10).
  The names layer is not offered on the pass pages (FR-LEG-1 as amended; OQ-45); a tap names a star (FR-STAR-7).
  A highlighted pass (FR-LEG-4) dims the other passes and not the stars.
  The stars dim with the twilight: while the Sun is above −6° the stars layer draws the first two bins of the star ladder and every planet (Venus is a twilight object), and above 0° nothing, so a daytime scrub does not show a night sky; the thresholds are `SkyState`'s (FR-LIVE-3).
  *(amended v2.5, V25-9)* These are FR-STAR-13's steps, built here for every page that draws stars, the stars page included; the landmark (FR-SKY-11) follows them — a star the step hides is not ringed and not named.
- **FR-SKY-4** **The polar chart's stars.**
  Stars to `POLAR_STAR_MAG` as FR-STAR-6's glyphs (V24-9) — the same ladder, the same `starGlyphs.ts`, the two sizes scaled to the chart's 250-unit viewBox by the chart's unit as its labels already are — the planets as `@`, no figures, no names; they follow the looking-up / map toggle with the arcs; `SkyPolar.live.svg`'s snapshot is re-baselined once, the phase's named move for the chart (FR-SKY-9).
  *(amended v2.10, V210-5; before: stars to 3.5, no figures, no names)* The chart draws FR-PHONE-8's row — stars to 4.5 on FR-LOOK-4's ladder, the figures as hairlines with the gap, the names by FR-STAR-6's placement at the chart's unit — and the snapshot is re-baselined once more.
- **FR-SKY-5** **The dome's stars, and its rate.**
  The stars to `DOME_STAR_MAG` and the planets as single points in the line layer (one braille dot each, one mesh for all, `--chart-star` for the stars and `--chart-planet` for the planets through `palette.ts`), no figures and no names: the font holds no letters and the raster budget holds no more.
  The dome's drag rate on the FR-GUIDE-6 device, by `dome-perf.spec.ts`, is not below `v2.4.0`'s measure by more than a tenth and never below 30 updates/s; the raster snapshots are re-baselined once (FR-SKY-9).
  The Where pane's dome on the home draws no stars (OQ-44).
- **FR-SKY-6** **The passes on the stars page, and one screen.**
  The stars page's layer row gains `[ passes ]` / `[ pases ]`, off by default and not saved: with it on, the scene carries tonight's passes — FR-TRAJ-1's set at the shown instant, which on this page is now — with the legend keys at the peaks, the gutter's ticks and the chip (FR-GUT-4..6) on the screen, and a row per pass in the field in `In this field` (key, name, state as FR-LEG-3 words).
  The live page's screen with `[ stars ]` on and the stars page's screen with `[ passes ]` on are **one screen**: one component, one scene, the inventory naming only which page opened it, which page it returns to on `×`, and whether the gutter's pass marks are drawn (they are whenever passes are in the scene).
  *(amended v2.11, V211-7; withdrawn in part)* The `[ passes ]` toggle leaves the stars page and its scene carries no pass (FR-CLEAN-11): the page shows now, when a visible pass is rarely up, and the view of both is the live page with `[x] stars`.
  The one-screen half was withdrawn with the screen (V29-1).
- **FR-SKY-7** **The pass detail's window looks at the pass.**
  Opened from a pass detail — in the box on wide, on the screen on compact before the sensor's first reading — the window faces the pass's peak azimuth at a tilt of `clamp(peakAlt − 15°, 20°, 75°)`, which puts the peak inside the field's upper half (`WINDOW_FOV` is 60° across the shorter side, FR-WIN-1; `peakAlt / 2` would have left an 80° peak 40° above the centre and out of view), with the arc drawn as every arc is, clipped at the field's edge (FR-DOME-5, FR-WIN-2); the facing picker on the pass detail offers `peak` beside the eight points and `up`.
  On the screen the sensor takes over at its first reading (FR-FSC-10's "starts at none" rule unchanged).
  *(amended v2.5, V25-11)* On the live page the picker offers the highlighted pass's key instead of `peak` (FR-SKY-13); `peak` stays the pass detail's.
- **FR-SKY-8** **The instant.**
  The live page's stars are drawn at the shown instant `t` and move with scrubbing and playback, one rotation per shown instant (FR-STAR-2), so at 3600× the stars turn with the arcs and never jump; the pass detail's at its own instant; the stars page's at now (FR-STAR-8 as amended).
  The scene's rotation is one per instant for every view on the page.
- **FR-SKY-9** **Named moves, captures and tests.**
  The phase's visible changes are: the stars under the arcs where `[ stars ]` is on (every chart capture), the polar snapshot and the dome rasters re-baselined once, the window laid out in the box on wide pages and on compact without a sensor, and the `[ stars ]` and `[ passes ]` controls.
  The capture set gains the live page's and the pass detail's window at 1280 and 1920 px in both themes and languages, the screen at 844 × 390 with stars and passes together from both pages, the window in the box at 390 px on the live page and the pass detail (the compact reader without a sensor, FR-SKY-2, which is what a headless capture is), and the stars page with `[ passes ]` on; the release notes list every changed file, and FR-CAP-5's two runs agree.
  Tests: the contract test's star case; the layer table's; `starsLayer` in the prefs schema test; `sky-screen.spec.ts` with stars; `dome-perf.spec.ts` and `live-perf.spec.ts` with the stars on.
  *(amended v2.5, V25-9..V25-11)* The named moves add the landmark line on the live page's headline block and the pass detail's head, the landmark's ring (and its name in the window and on the screen), the pass detail's `Among` column and the pass's key in the live page's facing picker; the capture set's live and pass detail files carry them, and one capture shows the live page's window faced to the pass (`f`) at 1280 px in both themes.
  Tests: `landmark.test.ts` (the pick, the cap, the direction word, the twilight step, the constellation fallback), `constellationAt` against the three fixture sites, the picker's key in `sky-window.spec.ts`.
  *(amended v2.5, V25-14)* And the zoom: the readout's field and the narrowed bracket are named moves only where a capture zooms, which one does — the stars page at 1280 px at `WINDOW_FOV_MIN_DEG` in both themes; `window-zoom.spec.ts` joins the tests.
- **FR-SKY-10** **Chunks.**
  The star drawing and the catalogue stay in the `stars` chunk; the live page and the pass detail load it when `[ stars ]` is on and prefetch it on idle after their own chunks; the dome's points mesh is `domeLayers.ts`'s and the `chart` row's (≤ 2 KB gzipped); the polar chart's star group is `SkyPolar`'s and sits where `SkyPolar` sits, and `starGlyphs.ts`, imported by both from here on, lands where Vite puts a shared module and is charged to `main` with the toggle and the prefetch (≤ 1 KB); `live` ≤ 1 KB; the `stars` chunk does not grow; no other row moves, and the release re-sets every row by D-178.
  *(amended v2.5, V25-9, V25-10)* The landmark and `constellationAt` read the catalogue and the figures, so they live in the `stars` chunk with them and are computed by the scene; the line's two words and the column's heading are strings in the main chunk's catalog within its ≤ 1 KB; the `stars` row may grow by the two functions, ≤ 1 KB, and nothing else.
  *(amended v2.5, V25-16)* The `stars` row may also grow by the Spanish names (FR-STAR-10 as amended), ≤ 1 KB more, so this phase's whole growth of the row is ≤ 2 KB gzipped; nothing of the names reaches `main`.
  *(amended v2.5, V25-20)* The release measured `main` +3.2 KB, `stars` +2.2 KB and `window` 3.6 KB (0.7 KB past its 25 KB row); the owner accepted those as the phase's growth, in place of the allowances above, and the release re-set the rows to them: `main` 175 with its §11 ceiling, `window` 30, `stars` 30.
- **FR-SKY-11** *(V25-9)* **The landmark.**
  The highlighted pass (FR-LEG-4) — on the live page the pass the headline is about, on the pass detail its own pass — has a **landmark**: of the stars at `LANDMARK_MAG` (2.5) or brighter within `LANDMARK_DEG` (12°) of its peak that FR-SKY-3's twilight step draws at the instant, the nearest to the peak; planets are never the landmark (they move between nights and the line is about the fixed sky). 2.5 is the ladder's third rung (FR-STAR-6), the brightest `+`: about ninety stars, enough that most peaks have one within 12°, and every one of them easy to see from a town; 12° is about a fist and a half at arm's length, as far as a reader can carry the eye from a star to a moving point.
  The **landmark line** sits under the pass's name line on the live page's headline block (wide and compact) and on the pass detail's head: "passes 7° above Betelgeuse, in Orion" / "pasa 7° sobre Betelgeuse, en Orión" — the separation in whole degrees, the direction word from the peak's altitude against the star's (`above` / `sobre` when the peak is higher by `LANDMARK_LEVEL_DEG` (2°) or more, `below` / `bajo` when lower by as much, `beside` / `junto a` between), the star's proper name (its designation where it has none), and the constellation the peak is among by FR-SKY-12's rule, in the active language's name (FR-STAR-10 as amended v2.5: `Orion` / `Orión`; the v2.5 draft had the Latin name in both).
  With no landmark the line is "passes through Orion" / "pasa por Orión"; with no constellation either (FR-SKY-12's cap) there is no line.
  On the drawings the landmark is ringed — a dashed circle of `LANDMARK_RING_PX` (13 px) radius in `--chart-star` at the chart hairline — in the polar chart, the window and the screen, and in the dome when the landmark is one of its stars (`DOME_STAR_MAG`, FR-SKY-5), so the dome never rings an empty place, and named beside the ring in the window and on the screen by FR-STAR-6's placement (where every place is covered, as V24-23 found for Betelgeuse at 390 px, the ring stands alone and the line names it).
  On the screen the readout's second line is the landmark line while a pass is in the scene and none is tapped; a tap's name (FR-STAR-7) takes the line while it holds, and the declination line (FR-FSC-4) is the line when the scene has no pass.
  With `[ stars ]` off, or with the landmark hidden by FR-SKY-3's twilight step, there is no ring, no name and no line.
  The landmark is the scene's, computed once per instant with the rotation (FR-SKY-8), so it is the same star in every view and moves with a scrub only when the highlighted pass changes.
  *(amended v2.5, V25-19)* On a short wide window (FR-SHP-3's shape: the live page with the scrub block over the box, FR-WATCH-6) the headline carries no landmark line: it is the first row to fold there, before the overview row.
  The ring still marks the star in the drawing, and the pass detail keeps the line.
- **FR-SKY-12** *(V25-10)* **The constellation at each point.**
  The pass detail's table of points (rise, peak, end; shadow entry where it is a row) gains a last column, `Among` / `Entre`, naming the constellation the point is among: the figure (FR-STAR-6's 88, Serpens' two halves one name, `Serpens` / `Serpiente`) with a drawn line nearest the point on the sky, if that line is within `AMONG_MAX_DEG` (10°), else `—`.
  The figures' lines are the data the app already ships (D-745, `constellations.ts`); IAU boundaries are not shipped (OQ-46), so the column says *among* and not *in*, and a point between two figures takes the nearer.
  A point below 0° (a rise or set at the horizon) is named like any other: the stars there are under the ground but the constellation is where the eye is sent.
  The rows' text alternative reads the column with the rest.
  *(amended v2.5, V25-16)* The names are the active language's (`Canis Major` / `Can Mayor`, FR-STAR-10 as amended); on compact a long name wraps to a second line in its cell rather than being cut.
- **FR-SKY-13** *(V25-11)* **Face the pass.**
  On the live page with the window in the box (wide, or compact without a sensor, FR-SKY-2), the facing picker gains the highlighted pass's key after `up` (`· A`), and `f` on a desk does the same: the hand camera turns to the pass's live position — before it rises its rise point, after it sets its set point — at a tilt of `clamp(alt − 15°, 20°, 75°)` as FR-SKY-7, and keeps the pass there every tick while the key is the chosen facing, so a pass crossing the field at 3600× stays in it.
  A drag, an arrow key or another facing point ends it; the readout's first line says `Following A` / `Siguiendo A` in place of the facing point while it holds.
  Changing the highlighted pass moves the key to the new one.
  The screen does not offer it: there the sensor faces, and the gutter's tick and chip already point the way (FR-GUT-4..6).
- **FR-SKY-14** *(V25-14)* **Zoom.**
  The window's field can be narrowed and widened by hand wherever the window is drawn — the box on any page, the stars page and the screen, under the hand camera and under the sensor alike.
  The field is `fov`, the angle across the box's shorter side that FR-WIN-1 fixes at `WINDOW_FOV` (60°), now between `WINDOW_FOV_MIN_DEG` **20°** — about the height of Orion, so one figure fills the box, and below it a 4.5-limited catalogue (FR-STAR-1) leaves a field nearly empty and a pass crosses it in a second at 3600× — and `WINDOW_FOV_MAX_DEG` **90°**, which on an 844 × 390 screen spans about 167° across, nearly the horizon from side to side, before the stereographic edge stretches past a third (D-204).
  **Touch:** a two-finger pinch scales `fov` by the inverse of the change in the two pointers' distance, one update per animation frame, about the field's centre (the facing and the tilt do not move, so the readout and the gutter stay true while the fingers move); a one-finger drag stays FR-STAR-4's.
  **Desk:** a wheel event with `ctrlKey` (what a trackpad pinch sends, and ctrl + wheel on a mouse) scales `fov` by `exp(deltaY × ZOOM_WHEEL_RATE)` (`ZOOM_WHEEL_RATE` 0.002 per pixel, so one mouse notch of about 100 px is about a fifth), and `+` (or `=`) and `-` scale it by `ZOOM_KEY_FACTOR` (1.25) while the box has focus, as FR-STAR-4's arrows do — box keys, not page shortcuts, so FR-DESK-4 gains no global key and the browser's own ctrl + `+` is untouched; `0` returns to `WINDOW_FOV`.
  A plain wheel without `ctrlKey` scrolls the page as today.
  `fov` is clamped to the range, is never saved and is not in the share link: every load, every opening of the screen and every pass detail opens at `WINDOW_FOV`, and FR-SKY-7's and FR-SKY-13's tilts are reckoned at the current `fov` (the peak stays in the field's upper half).
  Picking a facing point keeps the zoom; only `0`, the range's ends and a reload change it otherwise.
  While `fov` is not `WINDOW_FOV` the readout's first line ends with ` · field 30°` / ` · campo 30°` (rounded to 5°).
  What zoom changes is the projection's scale and nothing else: every glyph, line weight, the star ladder (FR-STAR-6), the collision and hit distances stay in px, so zooming in spreads the same stars apart and zooming out packs them, and the names layer resolves its collisions at each draw as it does now.
  Everything FR-WIN-1's `WINDOW_FOV` fed reads `fov` instead — the gutter's bracket (FR-GUT-3), FR-FOL-5's ground thresholds, FR-SKY-7's tilt and the landmark's ring stay right at any zoom.
  The dome and the polar chart do not zoom.
  *Verification:* `projection.test.ts` at both ends of the range (the bracket's half-width and the ground thresholds); `window-zoom.spec.ts` on the live page's box and the stars page — `+` three times reads `field 30°` and narrows the bracket, `0` restores both, ctrl + wheel and a synthetic two-pointer pinch move `fov` the same way, a plain wheel scrolls; the screen's pinch under the sensor in `sky-screen.spec.ts`; the window's drag rate in `live-perf.spec.ts` unchanged at `WINDOW_FOV_MIN_DEG`.
  *(amended v2.10, V210-5, V210-9)* On touch a pinch past either end by `PINCH_HANDOFF_RATIO` crosses to the whole sky and back (FR-PHONE-10); the ends are otherwise as written. "Every glyph stays in px" stands, but the stars drawn and named now follow `fov` by FR-LOOK-9's table, so zooming in brings in fainter stars as well as spreading the bright ones.

### 5.13 v2.5 additions *(proposal; the plan decides)*

- **The scene hook and the table.**
  `skychart/useSkyScene(observer, t, layers)` memoised per tick; `skychart/layers.ts` as a pure table `Record<View, readonly Layer[]>` with the magnitude caps; `SkyChartProps.scene`.
- **The window everywhere.**
  `SKY_CHART_VIEWS`' `available()` for the window returns true; `ChartFrame` lays the window out in the box on wide as it lays the dome; `SkyCamera`'s hand source on the live page and the pass detail; the prefs' chart view schema admits `window` on wide only (a guard on load that falls back to the dome on compact).
- **The stars layer.**
  `starsLayer: boolean` in the prefs schema (default true) and its toggle through `OptionToggle`; the `stars` chunk's prefetch from `liveChunk`/the detail; `SkyPolar`'s star group; `SkyDome`'s points mesh in `domeLayers.ts` (`palette.ts` gains the two tokens).
- **One screen.**
  `SkyScreen` takes `inventory: 'passes' | 'stars'` for the return route only; the gutter reads the scene's passes; `useSkyScreen.open()` from the stars page as from the live page.
- **The landmark and the column.**
  `skychart/landmark.ts`: `landmark(scene, pass)` → `{ star, sepDeg, word, constellation } | null` with the constants of FR-SKY-11, and `constellationAt(alt, az, rotation)` → the nearest figure within `AMONG_MAX_DEG`, both in the `stars` chunk and run by `useSkyScene`; the scene carries `landmark` beside its layers; the ring is a layer every view draws from its table row.
- **Face the pass.**
  The facing picker's options gain `{ kind: 'pass', key }` on the live page; `SkyCamera`'s hand source takes a target that is re-aimed each tick while it is the facing, and any drag or key clears it.
- **Zoom.**
  `SkyCamera` carries `fov` beside the rotation; `window/projection.ts` takes it where it took `WINDOW_FOV`; one pointer handler in the box takes one pointer as the drag and two as the pinch; the constants beside `WINDOW_FOV`.
- **Tests and captures.**
  The contract test's star case; `layers.test.ts`; the perf specs' thresholds read from a measured constants file as `dome-perf` does; `captureSet.ts` extended.

---

### Phase 2m — v2.5 ("one sky", as decided 2026-10-19, V25-1)

After v2.4 is on `main` (no tag, V24-11).
Every task merges on CI green and a clean review with no owner gate, as v2.4's did after R111 (V24-21); the owner's look — the capture set in both themes, one pass watched through the phone with the stars on, one scrubbed at a desk in the window — is read at the release preparation, and the `v2.5.0` tag and the deploy are the owner's (V24-11, V25-15).
The tasks, in order:

- The scene for every view (FR-SKY-1, FR-LIVE-10 as amended): `useSkyScene`, the layer table, `scene` on the props, the contract test's star case; no visible change.
- The window everywhere (FR-SKY-2, FR-SKY-7; FR-WIN-4, FR-WIN-5, FR-FSC-6 as amended): the view control, the box on wide, the hand camera on the pass pages, the saved view, the pass detail facing the peak.
- The stars under the arcs (FR-SKY-3, FR-SKY-8, FR-SKY-10): `[ stars ]`, `starsLayer`, the chunk's load and prefetch, the twilight rule, the screen.
- The polar chart's stars (FR-SKY-4) and the dome's dots with the rate (FR-SKY-5), two tasks in the chart lane, each re-baselining its own snapshot.
- The passes on the stars page and one screen (FR-SKY-6).
- The Spanish names (FR-STAR-10, FR-STAR-1, FR-STAR-6 as amended v2.5): the build reads `names-es.tsv`, the catalogue carries both languages, every name shown picks by language; the stars page's strings unchanged.
- The landmark, the column and the facing key (FR-SKY-11, FR-SKY-12, FR-SKY-13; FR-STAR-14's figure tap with them, since both read the figures' lines): `landmark.ts`, `constellationAt`, the line on both pages, the ring in the table, the `Among` column, the picker's key and `f`.
- Zoom (FR-SKY-14; FR-WIN-1, FR-GUT-3, FR-STAR-4 as amended): `fov` on the camera, the pinch, ctrl + wheel and the box's `+`/`-`/`0`, the readout's field, the bracket and the ground thresholds from the current field.
- Captures and release preparation (FR-SKY-9): the set extended and diffed, `v2.5.0`, `docs/RELEASE.md` §17, the README's screens; the first tag and deploy since `v2.2.0`, covering v2.3, v2.4 and v2.5 (V24-11).

Definition of done:
- US-40 AC1–AC8 and US-41 AC1–AC6 accepted; FR-SKY-1..14 met; FR-STAR-13 and FR-STAR-14 built.
- The contract test green with the star case; `dome-perf.spec.ts` within a tenth of v2.4's measure (its merge on `main`) and above 30; `live-perf.spec.ts` green with the stars on.
- The capture set's diff against v2.4's merge on `main` is the list FR-SKY-9 names and nothing else; FR-CAP-5's two runs agree.
- `npm run bundle:budget`: `chart` ≤ 2 KB over, `live` and `main` ≤ 1 KB over, `stars` not grown, no other row moved; every row re-set by D-178 at the release.
- `literals.test.ts` green with no new allow-list entry.
- The owner has watched one pass on the release build through the phone with the stars on, and scrubbed to one at a desk in the window.
