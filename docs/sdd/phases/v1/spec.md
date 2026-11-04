# v1 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.3 Goals (v1)

- **G7. Speaks the visitor's language.**
  English and Spanish, chosen from the browser, switchable in one tap.
- **G8. Uses a desktop screen.**
  On a wide screen the location, the Now panel, the pass list and the guide are on screen together; nothing is a phone column in the middle of a monitor.
- **G9. The dome is the signature.**
  Coloured, detailed, live, and the first thing a pass opens (UX-1 restored).
- **G10. Watch the night unfold.**
  A full-screen live sky with a timeline for the coming 24 h, scrubbed by hand or played at speed.
- **G11. Works off-grid.**
  Three nights of passes and forecast, and the app itself, stay usable with no connection.

**US-9 — Tune visibility thresholds** *(later; was v1, V1-1)*
As a hobbyist, I can adjust minimum elevation, limiting magnitude, and twilight rule.

**US-10 — Point my phone at the sky** *(v1, on the live page)*
As a user, I can hold my phone up and have the live sky turn with me, so the dome shows the horizon I am facing.
*(amended v1: the dome's facing follows the compass heading rather than an arrow; FR-LIVE-8.)* *(amended v1.2, V12-1: the control opens the sky window instead of turning the dome, so US-21 is where this story now lives; FR-FOL-1.)* *(amended v1.3, V13-1: what the control opens is the follow screen, a layer over the whole viewport for a phone held sideways; FR-FSC-1.)* *(amended v1.3.1, V13-6: there is no control — the window is a view again, and choosing it opens what is now called the sky screen; FR-FSC-1, FR-FSC-6.)*

**US-11 — Be notified before a pass** *(v1 / later)*
As a user, I can opt in to a reminder a few minutes before a selected pass.

**US-12 — Share a pass** *(v1)*
As a user, I can copy a link that reproduces this pass view (location + satellite + time) for someone else, or a moment on the live page.
- AC1: A share action on the pass detail and on the live page produces a URL that reproduces the view on the recipient's device by recomputing locally (FR-SHARE-1).
- AC2: On devices with `navigator.share` the system sheet opens; elsewhere the link is copied and the action confirms it.

**US-13 — Read the app in my language** *(v1)*
As a visitor whose browser is in Spanish, I see the app in Spanish without doing anything.
- AC1: On the first visit the language follows the browser: Spanish for `es` and any `es-*` in `navigator.languages`, English otherwise.
- AC2: A `[ EN | ES ]` control in the header switches at once, without a reload; the choice is saved locally and wins over the browser on later visits.
- AC3: Every string the app renders is translated: labels, banners, the guide sentence, compass names, brightness and cloud phrases, the Moon text of US-18, the shortcuts overlay.
  Satellite names, provider names and place names stay as catalogued.
- AC4: Dates, times and numbers follow the language's conventions through `Intl`, still in the observer's zone (FR-LOC-3).
- AC5: `<html lang>` and the page title follow the active language.

**US-14 — Use the app on a desktop** *(v1)*
As a user at a desk, I see the location, the Now panel and the pass list at once, and a pass opens beside the list instead of covering it.
- AC1: At 100 cells of viewport width and above, the page has two columns: location, favourites, banners, Now panel and Moon line on the left; hero card, sort and pass list on the right.
  *(amended v2.0, V20-10)* From `HOME_THREE_PANE_MIN_CELLS` the two columns are three panes (FR-FIRST-5).
- AC2: Opening a pass shows the guide in a panel beside the list; the list stays visible and the selected card is highlighted; below the wide breakpoint the full-screen sheet stays.
  *(amended v2.0, V20-10)* At three-pane widths the guide takes the first two panes and the list stays in the third.
- AC3: The dome fills the width of its panel at desktop sizes and is drawn at the finer grid that width allows (FR-DOME-1).
- AC4: Keyboard shortcuts work when no input has focus: `j` / `k` next and previous pass, `Enter` open, `Esc` close, `l` live page, `v` chart view, `n` night theme, `?` the list of shortcuts.
- AC5: Column widths and breakpoints are in cells; the layout stays on the character grid (FR-X-6).

**US-15 — Watch the sky live and ahead** *(v1)*
As a user, I open a full-screen live sky that shows what is up now and lets me run the coming 24 h forward.
- AC1: A live page, reachable from the header and from the Now panel, fills the viewport with the dome; the passes of the next 24 h are drawn as arcs and every satellite currently above the horizon has a marker on its arc.
- AC2: A status strip shows the observer's time, the sky state (day, bright twilight, dark), cloud cover at that time and the count of satellites visible at the shown instant.
- AC3: A time stripe under the dome spans now to now + 24 h with each pass marked; I can drag it or use the arrow keys to move the shown instant, and the dome, the markers and the status follow.
- AC4: Play runs the shown instant forward at 1×, 60×, 600× or 3600×; pause stops it; a `now` action returns to real time, which then advances on the 10 s tick.
- AC5: The Sun (a glow on the horizon while it is just below it) and the Moon with its phase are drawn at their positions for the shown instant.
- AC6: Objects above the horizon but not visible are hidden by default; a toggle shows them dimmed with the reason (daylight, in shadow, too faint).
- AC7: On a phone the page works in landscape, and the screen stays awake while the page is open.
- AC8: With permission, the dome faces where the phone faces (US-10); dragging still works and turns following off until it is re-enabled.
- AC9: The URL carries the location and the shown instant, so the page can be shared (US-12) and reloaded.

**US-16 — Take the app off-grid for three nights** *(v1)*
As a user driving to a dark site, the app keeps working with no signal.
- AC1: After any successful load, the app itself, the elements, the location, the forecast and the passes for the next 72 h are stored on the device with no action from me.
- AC2: A line near the location says "Ready offline until <date and time>" from the stored data, or says what is missing.
- AC3: Opening the app with no connection loads it and shows the stored passes, the guide and the live page; weather shows the stored forecast with its age, or "unknown" past its end.
- AC4: The app can be installed: a manifest, an icon, and an install hint the browser's offer brings up.
  *(amended v1.1.2, V11-15; was "shown once")* Installing it answers the hint for good; "Not now" hides it for 7 days, a second "Not now" for 30 days, and a third never shows it again.
  The settings page keeps an Install action with no decline beside it, so the app can still be installed after the hint is done with (V11-16).
  *(amended v2.0, V20-3)* The icon is the mark (FR-MARK-4).
- AC5: The pass list can show the three nights grouped under night headings; tonight is the default.
  *(amended v2.1, V21-8)* A night is the observer's local noon to the next local noon, so a pass before dawn belongs to the night that began the evening before; tonight is the night that holds the present instant or, by day, the coming one (FR-NIGHT-1).
  *(was: undefined; the build cut 24 h blocks from the instant of the computation)*

**US-17 — Keep a few places** *(v1)*
As a user, I can save places and switch between them.
- AC1: Save the current location under its label; the list holds up to 8 (a constant).
- AC2: Picking one makes it the observer and recomputes; removing one is one action with no confirmation dialog.
- AC3: Stored locally only (FR-LOC-5).
  Offline data (US-16) is kept for the active place only.

**US-18 — Know about the Moon** *(v1)*
As a user, I see whether the Moon will wash out a pass, and a little Moon lore.
- AC1: Each pass card and the guide show the Moon's phase and illumination at the pass peak, and a "moon glare" warning when the Moon is up, bright and near the track (FR-MOON-2).
  *(amended v2.1, V21-3)* The **guide** shows the Moon's phase and illumination at the pass peak; the **card** carries the `[moon glare]` tag alone, and the night's Moon is said once, in When (FR-FIRST-9; the phone's second step).
  F-14 closed this criterion by putting the sentence on every card; on the one-line card it was a fourth line repeating nearly the same words down the whole list (F-77).
  *(was: the phase and illumination on each card as well)*
- AC2: The Now panel and the live page show the Moon's phase name, illumination and, when it is up, its direction and elevation.
- AC3: A "Moon tonight" line adds tradition: the zodiac sign the Moon is in, the folk name of the month's full moon when within a day of full, and a curated one-liner for the phase or the sign, in both languages, labelled as tradition (FR-MOON-4, FR-MOON-5).

**US-19 — Use the app in the dark** *(v1)*
As a user outdoors, I switch to a red night theme that keeps my dark adaptation.
- AC1: A `[ night ]` toggle in the header swaps the palette to red on black; the choice is saved locally.
- AC2: Every text pair keeps WCAG AA contrast in the red palette, and the dome and polar colours have night counterparts.

### 4.7 Language *(v1)*

- **FR-I18N-1** The app MUST ship English and Spanish.
  On the first visit the language is chosen from `navigator.languages`: the first entry whose primary subtag is `es` selects Spanish, otherwise English.
  A saved preference, set through the header control, MUST win over the browser afterwards.
- **FR-I18N-2** All user-visible strings MUST come from one typed message catalog per language.
  A message missing from either catalog MUST be a type error at build time, never a runtime fallback to the other language.
  Template sentences (FR-GUIDE-1, FR-GUIDE-3, cloud verdicts, elevation words, compass names, the Moon text) are messages with parameters, so word order and agreement can differ per language.
- **FR-I18N-3** Spanish MUST be neutral and impersonal: no `tú`, no `vos`, no `usted`.
  Instructions describe the sky ("Aparece bajo en el oeste-suroeste a las 21:14"), never address the reader.
- **FR-I18N-4** Dates, times, numbers and lists MUST be formatted through `Intl` with the active language and the observer's zone (FR-LOC-3).
  Degrees, magnitudes and compass abbreviations (N, NE, …) are identical in both languages; spelled-out compass names are translated.
- **FR-I18N-5** `document.documentElement.lang` and the document title MUST follow the active language.
  Switching MUST NOT reload the page or lose the observer, the selection or the live page's instant.
- **FR-I18N-6** The language is a preference, not a route: no path prefix, no URL parameter.
  Catalogued names (satellites, data providers, places returned by geocoding) are never translated.

### 4.8 Desktop layout *(v1)*

- **FR-DESK-1** Breakpoints are in cells (`--cell`, FR-X-6): *compact* below 100 cells of viewport width, *wide* at 100 cells and above (about 960 px at the 16 px base).
  Column and panel widths are in cells.
- **FR-DESK-2** Wide: two columns.
  The left column is fixed at 40 cells and holds, in order, location (inputs, favourites, clear), the elements banners, the Now panel and the Moon line (FR-MOON-3).
  The right column fills the rest and holds the hero card, the sort control and the pass list.
  The header spans both columns and carries the title, the tagline and, at the right, the language, night-theme and live-page controls.
  *(amended v1.1, V11-8)* The live-page control leaves the right-hand group: `[ Live sky ]` sits on the title line beside the title, as navigation; the right of the header holds the language and night-theme controls on one baseline row, aligned in cells.
  The Now panel keeps its own live link (FR-LIVE-1).
  *(amended v2.0, V20-2, V20-3, V20-10)* Two things.
  The title line carries the mark at 24 px before the title, and the tagline's padding-left is the mark's width plus one cell (FR-MARK-4).
  And from `HOME_THREE_PANE_MIN_CELLS` the two columns become three equal panes — Where, When, What (FR-FIRST-5); between the wide breakpoint and that width the two columns above stand, with the Where and When readings stacked in the 40-cell left column.
  *(amended v2.0.2, V20-15)* The panes' contents are FR-FIRST-5's as amended; between the wide breakpoint and `HOME_THREE_PANE_MIN_CELLS` the left column is Where over When and the right is What, as before.
  *(amended v2.6, V26-9, V26-10)* The wide header is FR-FLOW-3's one row on every page — page links with the current one marked, `[ settings ]` at the end — and no longer holds the language and theme switches.
- **FR-DESK-3** Wide: a selected pass opens the guide in a panel beside the list.
  The right column splits into the list (44 cells minimum) and the guide (the rest); the list stays scrollable and the selected card is highlighted; `Esc` or the close control closes the panel.
  Compact keeps the full-screen sheet of MVP.
  The selection stays in the URL hash (D-13) in both cases.
  *(amended v1.1, V11-13)* Between the wide breakpoint and the width at which the 44-cell list and a 40-cell guide both fit (`WIDE_SPLIT_MIN_CELLS`, default 124 cells, a constant pinned by the breakpoint test), an open guide takes the whole right column and the list is one `[ list ]` control away, the way the compact sheet works; the split returns at that width.
  The guide column MUST never be narrower than 40 cells while open.
  *(amended v2.0, V20-10)* At three-pane widths (FR-FIRST-5) an open pass takes the place of the Where and When panes — the guide at least 72 cells — and the list stays in the What pane; under that width this requirement stands as written.
- **FR-DESK-4** Keyboard shortcuts, active when no input or button has focus and listed in an overlay opened with `?`: `j` / `k` move the selection down and up the list, `Enter` opens it, `Esc` closes the guide or the overlay, `l` opens the live page, `v` toggles the chart view, `n` toggles the night theme.
  Shortcuts are single keys with no modifier and MUST NOT collide with browser or screen-reader defaults.
  *(amended v2.4, V24-1)* `s` opens the stars page (FR-STAR-3), and the stars page's own four keys are FR-STAR-4's.
  *(amended v2.5, V25-11)* `f` faces the highlighted pass where the live page's window is in the box (FR-SKY-13); elsewhere it does nothing.
- **FR-DESK-5** A desktop mockup approved by the owner is the visual reference for the wide layout (V1-3).
  Every desktop task ships 1280 px captures for comparison (the `visual-review` skill), alongside the 390 px ones.
  *(amended v1.1, V11-13)* Wide captures are shot at 1024 px as well as 1280 px for the home and guide screens; the D-179 capture set gains the 1024 px profile.

### 4.9 Sky dome, second pass *(v1)*

The R15 dome reads as a wire cage: rings, meridians and arc in one colour at nearly one weight, seen from a tilt that flattens the bowl into a disc.
FR-DOME-1..7 say what the second pass must show; FR-DOME-8 says how the composition is chosen, because none of the layered settings below has been tried in the real rasteriser yet (V1-10).

- **FR-DOME-1** No frame around the dome.
  The drawing fills the width of its container up to the container's height, and the raster grid follows the drawing's size (the cell keeps its 390 px proportions, D-65's scaling continues, and the column count grows with the width), so the dome on a desktop panel is a larger and finer drawing, not a scaled-up phone one.
  *(amended v1.1, V11-4)* "Fills the width" is now a rule with a number: the drawing's extent, labels included, MUST cover at least 90 % of the shorter side of its box at every width (PLAN D-177's fit rule); the compact box itself is set by FR-COMP-5.
  *(amended v1.1.1, V11-14)* And at most the whole of it: no row or column of the raster, labels included, is cut by the box, so the extent covers between 90 % and 100 % of the shorter side (F-51).
  *(amended v1.2, V12-3)* The rule holds in every box the app can hand the drawing, not only at the two sizes R54's test pins: every viewport width, above 1920 px included, every viewport height, and every device pixel ratio.
  It is checked at 1280 × 800, 1920 × 1080 and 2560 × 1440, and at a device pixel ratio of 2, against the raster's own painted extent with its labels (F-54).
  *(amended v1.2.1, V12-9)* And the rule holds after a resize as it does on a fresh load: when the box changes size the drawing is fitted to it again, and the raster's scene is rebuilt whenever its cell changes — not only when its column count does, which on a desktop it never does.
  Checked by resizing one page through 1920 × 1080, 3840 × 2160, 1280 × 800 and 2560 × 1440: at each size the extent MUST be inside its box and cover it as this requirement asks, and at 1280 × 800 — the worst case the owner saw — it MUST be what a fresh load at that size gives, within one cell (F-60).
  *(amended v1.2.1, V12-11)* And "the drawing's extent" is what the scene draws, not the ring: a bowl seen from the default tilt has a silhouette — the meridians and the altitude rings turning over above the far horizon — a full radius above the observer, and the ground disc's near edge 0.78 of one below it, so the drawing is 1.78 units tall against the ring's 1.53 and its middle is 0.11 units above the observer.
  The fit rule's height budget MUST count the silhouette (PLAN D-317: the height divisor is 2.0, from 1.78 with the width's own margin), and the drawing MUST be centred in the box on its own extent rather than on the observer, so that neither the bowl's outline at the top nor the ground at the bottom is cut on a height-bound box.
  On the wide live page, which is the height-bound case, the drawing covers between 90 % and 100 % of the box down as well as across, with the blank above and below it within a cell of each other (F-61).
- **FR-DOME-2** Colour by meaning, from tokens in `tokens.css` with a value in each theme: the highlighted pass, the other passes (dim), the peak marker, the shadow-entry marker, the current-position marker, the flown part of an arc, the horizon ring, the altitude rings, the compass labels, the Sun glow and the Moon *(amended v2.5, V25-2: and the stars, the dim stars, the figures and the planets, FR-DS-8's four tokens)*.
  Colour is never the only channel: line weight and glyph keep the monochrome reading (FR-X-5).
- **FR-DOME-3** Orientation cues: a mark at the observer's position at the centre of the ground; a ground fill (hatched or dimmed disc) below the horizon so up and down read at a glance; compass names that never overlap pass labels (a label that would collide moves along its ring, in the order compass, peak, rise, end).
- **FR-DOME-4** More detail: horizon ticks every 10° with the degree number every 30°; the 30° and 60° rings labelled; the pass arc labelled with the clock time at rise, peak and end; the direction of travel as an arrowhead at the arc's end.
  *(amended v1.1, V11-6)* The clock times at rise, peak and end move to the legend (FR-LEG-1); the arc keeps its markers and the arrowhead and gains the legend key at its peak.
- **FR-DOME-5** Live marker: when the instant shown (real time on the detail sheet, the shown instant on the live page) falls inside a pass, the satellite's position is drawn on its arc and the flown part of the arc is drawn in the "flown" colour.
  The position is interpolated from `Pass.track` (10 s samples); no worker call is made for it.
- **FR-DOME-6** Sun and Moon at the shown instant: the Sun as a glow on the horizon ring at its azimuth while its altitude is between −18° and 0° (wider and brighter the closer to 0°), the Moon as a marker with a phase glyph when above the horizon, both labelled.
  *(amended v1.1, V11-6)* "Both labelled" means a line each in the legend; the drawing carries the glow and the phase glyph only.
  *(amended v2.10, V210-7)* In the window and on the polar chart the Moon is a disc with its lit limb (FR-LOOK-7); the dome keeps the glyph.
- **FR-DOME-7** The dome is the default chart view again (UX-1 as written; D-68 closed by V1-4); the polar chart stays one toggle away with all its features and gains the Sun and Moon markers, the live marker and the colours of FR-DOME-2 so both views keep telling the same story.
  FR-GUIDE-2 interaction and FR-GUIDE-6 performance are unchanged: colour MUST NOT drop the drag rate below the FR-GUIDE-6 target.
  *(amended v2.5, V25-1, V25-5, V25-6)* The dome stays the default view; it gains the twenty brightest stars and the planets as braille dots (FR-SKY-5), and the polar chart gains the stars to magnitude 3.5 (FR-SKY-4), both from the one scene, so the three views keep telling the same story with the stars in it.
- **FR-DOME-8** Layers, and the spike that fixes them.
  The dome is drawn as layers, not as one wireframe: (a) a *base* layer for surfaces (the ground disc, a sky bowl shaded from the horizon to the zenith, the Sun glow), rendered in glyphcss's solid mode with the scene's directional light set to the Sun's real direction so twilight shows on the right side of the sky; (b) the *line* layer for the horizon, rings, meridians, arcs and markers in braille wireframe; (c) the highlighted pass and the live marker at a finer density than the base grid (glyphcss per-mesh density) so the arc is the sharpest thing on screen; (d) at most one effect (a soft pulse on the live marker), and only while the FR-GUIDE-6 rate holds.
  All layers share one camera state (PLAN D-64) so they cannot drift.
  The composition (tilt default in 35°–55°, which meridians are drawn, weights, the exact colours, whether the pulse stays) MUST be fixed by a half-day spike in `spike/` before the implementation task is cut: one page with every knob as a URL parameter, captures at 390 px and 1280 px of the same two fixture passes (the golden grazing pass and the synthetic high pass of R14), the D-62 drag-rate measurement for each candidate, and a findings file the owner picks from.
  The polar chart is not affected.

### 4.10 Live sky page *(v1)*

- **FR-LIVE-1** A page at `#live` fills the viewport with the dome, a status strip and a time stripe.
  It is reachable from the header control and from the Now panel, and `Esc` or the header returns to the home page.
  It is inert with a one-line message when there is no observer or no elements.
  *(amended v1.4, V14-2)* "Fills the viewport" and "never scrolls" are claims about every size of FR-SHP-4's matrix and not only about the sizes a feature test happened to pick: a page that scrolls at 1200 × 450 (F-65) breaks this requirement exactly as one that scrolls at 390 × 667 does.
  *(amended v2.1, V21-6, V21-9)* The page's states before it can draw are three and are told apart: **no place** (FR-FIRST-1's sentence and `[ set a place ]`), **loading** (the mark's bead moving and "Loading orbital elements…"), and **failed** (FR-FAIL-1's line with `[ retry ]`).
  With stored passes it is never inert for want of a network (FR-OFF-8).
  *(was: one sentence, "No orbital elements yet", for loading and failed alike, F-92)*
- **FR-LIVE-2** Content at the shown instant `t`: every pass with `start ≤ now + 24 h` and `end ≥ now` drawn as an arc coloured per satellite (a palette of at least 6 distinguishable hues per theme, assigned in pass order); a marker on each pass whose interval contains `t`; the Sun and the Moon per FR-DOME-6; hidden objects per FR-LIVE-6.
  *(amended v1.1, V11-7)* Which of those passes are drawn at `t`, and how much of each arc, is set by FR-TRAJ-1; the palette and the per-satellite colour rule are unchanged.
- **FR-LIVE-3** Status strip: `t` in the observer's zone with the zone abbreviation; the sky state in words (day, bright twilight, dark; `SkyState`); cloud cover interpolated to `t` (FR-WX-2) or "unknown"; the count of satellites visible at `t`; the Moon's phase and illumination; while playing, the speed.
  *(amended v2.0, V20-4)* The strip is one line per state (FR-WATCH-3): on compact the clock, the sky state, the cloud word and the count; on wide and the landscape phone the sky state, the cloud verdict with its percentage, the count and the Moon, with the clock on the indicator's line.
  The speed is the pressed control on the playback row.
- **FR-LIVE-4** Time stripe: horizontal, `now` at the left edge and `now + 24 h` at the right, hour ticks, night shading from the sun altitude (the three `SkyState` bands), each pass a segment in its arc's colour.
  Drag, click and arrow keys (1 min; with Shift 10 min) set `t`; `t` clamps to the span; the shown instant is marked with a cursor and its clock time.
  *(amended v1.1, V11-7)* The stripe's layout and text are re-specified in FR-TRAJ-4 and the touch stepping in FR-TRAJ-5; the span, the shading, the clamp and the keyboard steps stand.
  *(amended v1.4, V14-3)* The span is unchanged and is what the overview row shows; the stripe itself draws the four-hour chunk that holds `t` (FR-SPAN-1, FR-SPAN-2).
  The keyboard gains Page Up and Page Down, one chunk each.
  *(amended v2.0, V20-4)* The stripe is rendered only while scrubbing (FR-WATCH-4); while watching the overview (FR-SPAN-2) is the page's only timeline, and a click, a drag or a key on it enters scrubbing (FR-WATCH-1).
  *(amended v2.7, V27-3; FR-TONIGHT-3: on the compact live page the stripe is replaced by the time track.)*
- **FR-LIVE-5** Playback: play and pause; speeds 1×, 60×, 600× and 3600× (24 h in 24 s); a `now` action returns `t` to real time, which then advances with the 10 s tick; playing stops at the end of the span.
  Target: ≥ 30 updates/s at 3600× on the FR-GUIDE-6 device.
  The worker is never called per frame: satellite positions come from the tracks (FR-DOME-5); the Sun and Moon are evaluated on the main thread at most once per second of wall time.
  *(amended v2.0, V20-4, V20-6)* Play, pause and the speeds are on the playback row, which only the scrubbing state renders (FR-WATCH-4); the `now` action is `[ back to live ]` (FR-WATCH-1), and `[ scrub ]` is the pause at now.
  The rates, the tick and the worker rule are unchanged.
  *(amended v2.7, V27-4; FR-TONIGHT-5: on the compact live page one play control with an automatic speed replaces the four speeds; wide keeps them.)*
- **FR-LIVE-6** Objects above the horizon at `t` but not visible (daylight, in shadow, too faint) are hidden by default.
  A toggle draws them dimmed with a reason label.
  Their positions come from the worker for the instant `t` (a `computeAt` request, the Now pipeline at an arbitrary time), throttled to one request per 250 ms of wall time while scrubbing or playing.
  *(amended v1.1, V11-6)* The reason label is a legend row (FR-LEG-3); the dimmed position on the drawing carries the legend key only.
  *(amended v1.3, V13-3)* Reviewed and kept, on the default live view only: the sky screen (§4.23, named the follow screen until v1.3.1) never draws hidden objects and carries no toggle (FR-FSC-5).
- **FR-LIVE-7** Layout: portrait stacks dome, strip and stripe; landscape on a phone puts the dome on the left and the strip and stripe on the right.
  The page requests a Screen Wake Lock while it is visible and releases it when hidden; where the API is unsupported nothing is shown.
  *(amended v1.1, V11-4)* Portrait on compact: the one-row header (FR-COMP-1), the dome box (FR-COMP-5), the status strip in two lines, the stripe block (FR-TRAJ-4) and at most two rows of controls, every row within FR-COMP-4.
  The "drag the dome" hint is not shown on the live page.
  In window mode (FR-WIN-6) the stripe block and the playback row are absent.
  *(amended v1.3, V13-1; v1.3.1, V13-6)* On the live page the window is the sky screen (§4.23), a layer over the whole page rather than a view laid out in it; the page's layout is what the screen covers and uncovers.
  *(amended v1.1.1, V11-14)* Wide (FR-DESK-1): one row above the dome holds the view control, the facing readout (FR-GUIDE-4) and the hint; one row under it holds the playback controls at the left (play, now, hidden objects, the speeds), the stripe block (FR-TRAJ-4) filling the rest with its clock readout at the stripe's left on the same row, and the share action at the right; then the status strip on one line.
  So the block above the dome is one row and the block under it is two, and the dome box takes the rest of the viewport height (F-52).
  The stepping row (FR-TRAJ-5) stays under the stripe only where the page has touch.
  Landscape on a phone and portrait are unchanged.
  *(amended v1.2.1, V12-7, V12-8, V12-10, V12-14)* Wide is two columns from `LIVE_TWO_COLUMN_MIN_PX` (1660 px of viewport, the owner's number) and one centred column under it, and the box is cut to the drawing's own shape rather than being whatever the page leaves.
  The row above the box is unchanged in both.
  **Two columns:** the status strip and the actions (the hidden-objects toggle, the follow control where it is offered, and the share action) MUST stand in a rail at the right of the box — under the legend, which shares that column (FR-LEG-2) — in that order.
  The stripe block (FR-TRAJ-4) stands under the box, as wide as the box, on every wide page (V12-8, V12-12: the stripe always under the dome; the v1.2.1 draft kept it in the rail under 1666 px, and the owner took that back), and the playback controls (play, now, the speeds) stand on the clock readout's row above the stripe, to the right of the readout — the time row, so the controls are beside the instant they set (V12-13; the draft had them in the rail).
  So the rail is about the sky and the row under the box is about time.
  **One column** (from FR-DESK-1's wide breakpoint up to 1660 px): no rail; the box, the stripe block (with the time row) and the legend stand under one another, the box centred, and the legend is the compact one (FR-LEG-2, at most four rows, scrolling inside).
  *(amended v1.2.1, V12-15)* The stripe block and the legend are the page's whole width, at every one-column width and whatever the height has left the box, and the status strip and the actions are one row under them that reads from the left — the strip first, the actions after it, wrapping where the width asks.
  So everything under the drawing shares one left margin.
  The box is cut from the page's whole width and the height the rows leave, so on a short window it is small — the owner's choice over a rail beside a box the height has already cut down.
  The box is the largest rectangle at 2.4 : 2.0 — the fit rule's own shape (V12-11), at which FR-DOME-1's fit binds across and down at once — that the frame leaves it: as tall as the height under the row above and over the stripe block, unless the width beside a rail of at least 44 cells binds first, in which case as wide as that (PLAN D-314).
  The box stands at the left of the page; the rail beside it takes what the page leaves up to 60 cells — what FR-TRAJ-4's twelve hour labels want, past which nothing in the rail reads better — and the rest of the width stays blank at the right.
  So the drawing covers at least 90 % of the box **across** as well as down at every size — the number F-59 reported at 65–69 % (FR-DOME-1 measures the shorter side only) — and the box grows with the window continuously, not by steps: a browser window is never its screen (V12-10).
  Checked at 1280 × 800, 1280 × 720, 1920 × 1080, 1920 × 940, 2560 × 1440, 2560 × 1235 and 3840 × 2160.
  Landscape on a phone and portrait are unchanged.
  *(amended v1.2, V12-4)* Portrait on compact, the rows under the drawing — the facing readout, the status strip, the clock readout, the stripe and the stepping row — share one vertical spacing token, set small enough that all of them fit the shortest phone the app supports (390 × 667 CSS px) beneath a box at FR-COMP-5's floor.
  The invariant is that no element of the page overlaps another at any supported size; the gaps are what gives first, and only where the gaps are at their minimum and the rows still do not fit does the box yield below its floor.
  The page still fits one screen: it does not scroll to make room (F-55).
  *(amended v1.3.1, V13-10, F-63)* That invariant — no element of the page over another — holds in the landscape-phone layout as much as in portrait: the drawing stays inside the dome pane and the status strip, the stripe block and the actions inside theirs, whatever the compact box's full-bleed rule does elsewhere (FR-COMP-5 as amended).
  Checked at 740 × 360, 844 × 390 and 932 × 430, the sizes a phone gives this layout.
  *(amended v1.4, V14-2, V14-4, V14-5)* Three changes.
  **One wide layout:** the two-column rule above holds at every wide width and the one-column page under 1660 px is withdrawn with `LIVE_TWO_COLUMN_MIN_PX` (FR-LEG-6); on a short wide window the box is what gives, down to FR-SHP-3's floor, and the rows under it fold in the order FR-SHP-3 states rather than the page scrolling.
  **The shape:** the landscape-phone layout is compact's alone, said in the selector and not only in a comment (FR-SHP-1, F-65).
  **The compact rows:** the legend leaves them for the `[ list (n) ]` control in the actions row (FR-LEG-7), and the stripe block gains the overview row (FR-SPAN-2) while its stepping row is re-cut and no longer touch-only (FR-SPAN-3).
  *(amended v2.0, V20-4, V20-7, V20-8)* The rows are per state now — FR-WATCH-4's inventory at FR-WATCH-5's four shapes — and the row lists above describe the scrubbing state; while watching the stripe block, the step row and the playback row are absent and the box takes their rows.
  The rail on wide gains the indicator and the headline at its head and the overview above the actions (FR-WATCH-5); the compact actions rows are V20-8's; on a short wide window the scrub block is FR-WATCH-6's overlay.
  *(amended v2.10, V210-4)* The stars page and the pass detail request the wake lock too while following is on (FR-PHONE-6).
- **FR-LIVE-8** Compass follow (US-10): a `[ follow phone ]` control requests `DeviceOrientationEvent` permission where required (iOS `requestPermission()`, HTTPS) and turns the dome's facing to the device heading (`absolute` events or `webkitCompassHeading`; relative-only devices show a note).
  A drag turns following off; the control turns it on again.
  The control is hidden where the API is absent (desktop).
  *(amended v1.1, V11-5)* The control belongs to the dome view.
  In the sky window (§4.18) following is implicit and the control is not shown.
  *(amended v1.1, V11-12)* The heading is corrected to true north as FR-WIN-3 says; the control is hidden on the polar view, which does not consume the facing.
  *(amended v1.2, V12-1)* The control no longer turns the dome.
  It opens the sky window (§4.22, FR-FOL-1), and the dome's facing is the drag's alone (FR-GUIDE-4); the permission request, the notes for a denial and for a relative-only device, and the true-north correction move with it.
  *(amended v1.3, V13-1)* What it opens is the follow screen (FR-FSC-1); the control's label, presence test and notes are unchanged.
  *(amended v1.3.1, V13-6)* There is no control.
  `[ follow phone ]` is removed from the live page with its label and its notes, and what this requirement still governs moves to the view control's "window" option (FR-WIN-4, FR-FSC-6): the presence test, the permission asked inside the tap, the one-line notes for a denial and for a relative-only device, and the true-north correction of FR-WIN-3.
- **FR-LIVE-9** URL state: `#live?lat=&lon=&alt=&t=`, `t` an ISO-8601 instant or absent for real time.
  Loading such a URL sets the observer (label from the rounded coordinates until geocoded, source `coords`) and `t`.
  The hash is updated while scrubbing at most twice per second and never while playing.
  *(amended v2.1, V21-7)* "Sets the observer" means for this view: whether the place is also stored is FR-VISIT-1's rule, and a `t` outside the stripe's span is FR-VISIT-3's.
  *(was: the link's observer stored like any other, PLAN D-135)* *(amended v2.7, V27-2; FR-TONIGHT-1: on the compact live page an absent `t` opens on real time and then may jump once to the next visible pass.)*
- **FR-LIVE-10** The live page reuses `SkyChartProps` with `now = t` and a `passes` array; nothing in the live page draws satellites by any other path (FR-GUIDE-2b's "same geometry" rule).
  *(amended v2.5, V25-2)* And a `scene` beside `passes` (FR-STAR-11, FR-SKY-1): the rest of the sky comes through it and nothing draws a star by any other path either.
- **FR-LIVE-11** *(v1.2, V12-5)* The drawn set survives the instant.
  Setting `t` — a click or a drag on the stripe, a step, an arrow key, playback, or a reload of a `#live` URL that carries `t` — MUST NOT change which passes the page holds: the arcs, the stripe's segments and the strip's count come from the same stored set before and after, and the only thing that changes is what of it is drawn (FR-TRAJ-1).
  An observer restored from the hash (FR-LIVE-9) that matches the stored observer to the precision the hash carries IS the stored observer, so its passes, its forecast and its cache survive the reload; a hash for a different place is a new observer and starts a search.
  While a search runs the page says so; where it has no set at all it shows FR-LIVE-1's inert line.
  An empty sky with a working stripe is a defect, never a state (F-56).

### 4.11 Offline for three nights *(v1)*

- **FR-OFF-1** A service worker precaches the app shell (HTML, JS, CSS, the braille font, the manifest, icons) in a versioned cache and serves it cache-first.
  A new version activates on the next load and shows a "new version ready, reload" banner.
  The worker MUST NOT cache CelesTrak or Open-Meteo responses: those live in IndexedDB under FR-SAT-6 and FR-WX-5.
- **FR-OFF-2** The computation window is 72 h from the time of computation (FR-VIS-1 as amended).
  Passes are stored in IndexedDB with `computedAt`, the observer and the elements epoch; with no network they are shown as stored, with their age in the readiness line.
- **FR-OFF-3** The forecast covers at least 72 h (`forecast_days=4`) and is stored with `fetchedAt`.
  With no network it stays in use past the 30 min TTL with an "as of <time>" note on the cloud badge; hours past its end show "unknown" (FR-WX-5 still applies online).
- **FR-OFF-4** A readiness line under the location states "Ready offline until <date time>" (the earliest of the stored passes' end and the forecast's end) and the storage time, or names what is missing (no elements, no forecast, no passes).
  *(amended v2.0.2, V20-21)* On the home page the line is one line — `Ready offline until 12 Sep 05:31`, or what is missing — and the storage time moves behind the elements line's `[ details ]` (FR-FIRST-11).
- **FR-OFF-5** Storage is automatic on every successful load and recompute.
  There is no "prepare" action.
- **FR-OFF-6** PWA: a web manifest with one name (the manifest is not localised), icons at 192 and 512 px in the terminal identity, `display: standalone`, dark theme colour.
  An install hint is shown once when `beforeinstallprompt` fires (and an iOS "Add to Home Screen" note where that event never fires), dismissible and remembered.
  *(amended v1.1.2, V11-15)* "Shown once" becomes "answered once, declined three times".
  Installing the app answers the offer for good, whether through the hint's own action or by any other route (`appinstalled`); so does pressing that action, whatever the browser's own dialog then returns, since the page is not told. "Not now" instead *snoozes* the hint: `INSTALL_SNOOZE_DAYS` default `[7, 30]`, centralised with the other thresholds (FR-VIS-6) with its rationale — a week is long enough that the offer is not the same week's question twice and short enough to reach a reader who has since made the app a habit; a month is the back-off for one who has now said no twice — after which the hint MAY be shown again if the browser still offers it.
  The number of declines and the instant the current snooze ends are remembered on the device beside the answered latch, and a reader who declines once more than there are entries in `INSTALL_SNOOZE_DAYS` (three times, by default) is never offered again.
  The rule is the same for the iOS note, whose only answer is "Not now".
  *(amended v1.1.2, V11-16)* The offer MUST also be reachable on the settings page (FR-COMP-2), as a plain action with no decline beside it, whenever the browser has something to offer — the held `beforeinstallprompt`, or the iOS note — however the hint itself was answered.
  It is not shown once the app is installed, which is the same condition that leaves the browser with nothing to offer.
  Taking it installs the app and ends the hint, as the hint's own action does; leaving the page does nothing.
  *(amended v2.0, V20-3)* The two icons are the mark's `icon192` tier on `--bg` (FR-MARK-4), and the app gains a 16 px favicon from the `favicon16` tier; the manifest's names, colours and sizes are unchanged.
  *(amended v2.0.1, V20-14)* The two icons and the favicons are the mark's scene drawn as dots at an integer pitch (FR-MARK-4 d, e), not the tiers' text photographed; the manifest is still unchanged, and the favicon is three files with the SVG first.
- **FR-OFF-7** Favourites (US-17): up to 8 observers in the local prefs; the active observer is either one of them or ad hoc.
  Selecting one triggers the FR-VIS-5 recompute.
  *(amended 2026-11-02, the owner's call from the phone, PLAN D-1030)* The saved place in use is marked by its row — ruled in the accent on the raised ground, as the open pass's card — and `aria-current`, not by the words `(in use)`.
- **FR-OFF-8** With no network, everything that needs it fails soft: place search says it is offline, device location still works, the live page and the guide run from the stored passes, and the elements banner says the age of what is in use (FR-SAT-4).
  *(amended v2.1, V21-9)* The live page runs from the stored run and the stored elements with no network; with a stored run and no usable elements it still opens, on the stored passes' tracks, rather than standing inert (FR-FAIL-6, F-92).

### 4.12 Moon *(v1)*

- **FR-MOON-1** `astronomy-engine` supplies the Moon's phase angle, illuminated fraction, altitude, azimuth and ecliptic longitude at any instant.
  Phase names (new, waxing crescent, first quarter, waxing gibbous, full, waning gibbous, last quarter, waning crescent) come from the phase angle with band boundaries as constants.
- **FR-MOON-2** Moon glare for a pass: Moon altitude > 0° at the pass peak AND illuminated fraction ≥ 50 % AND angular separation between the Moon and the pass peak < 30°.
  Thresholds are constants shown in the tooltip.
  The card shows a `[moon glare]` label; the guide adds one sentence ("The Moon is bright and close to the track.").
- **FR-MOON-3** The Now panel and the live strip show the phase name, the illumination percentage and, when the Moon is up, its compass direction and elevation.
  *(amended v2.0, V20-4)* On the compact live page the phase and illumination are in the list panel's Moon line (FR-WATCH-3) rather than on the conditions line; the Now panel and the wide live page are unchanged.
  *(amended v2.0.2, V20-19)* On the home page these are the When table's `Moon` row (FR-FIRST-9); the tradition line of FR-MOON-4, where its flag is on, stands under the table.
- **FR-MOON-4** Tradition ("Moon tonight"): the tropical zodiac sign from the Moon's ecliptic longitude (30° per sign from 0° Aries); the folk name of the full moon by calendar month (the widely used North American list, noted as Northern-hemisphere tradition), shown within one day of full; and a curated one-liner per phase and per sign.
  All of it lives in a static JSON in both languages with no external source, in the same style as the catalog (FR-SAT-5): one file, reviewed by hand.
  *(amended v1.1, V11-2)* Rendered only when the build flag of FR-FLAG-1 is on; off by default.
- **FR-MOON-5** Tradition text MUST be labelled as tradition ("lore" / "tradición") and MUST NOT be worded as a prediction or as observing advice.
  The observing facts (phase, glare) are separate lines that never depend on the tradition text.

### 4.13 Share *(v1)*

- **FR-SHARE-1** A share action on the pass detail builds `#pass?lat=&lon=&alt=&norad=&start=` (start as an ISO-8601 instant); the live page's share builds FR-LIVE-9's form.
  The recipient's browser recomputes locally: no server, no shortener, no tracking.
- **FR-SHARE-2** `navigator.share` where available (title, text with the guide sentence, URL); elsewhere the URL is copied to the clipboard and the action confirms it inline.
- **FR-SHARE-3** Opening a pass link whose pass is no longer in the window selects the nearest pass of that satellite in the window, or shows a message naming the satellite and the original time.
  *(amended v2.1, V21-7)* The link's place is a visit (FR-VISIT-1).
  A pass link pasted into a running tab is honoured the way a pasted live link is — the place visited, the pass selected — and not dropped by clearing the hash (F-93).

### 4.14 Night theme *(v1)*

- **FR-THEME-1** A red-on-black palette: every token in `tokens.css` has a night value *(amended v2.3, V23-3: every **colour** token; the sheet's lengths, type sizes, borders and stacking levels are written once in `:root` and have no night value, which is how the sheet has read since R20 and is now the rule)*; the header toggle sets `data-theme="night"` on the root element; the choice is saved in the local prefs and applied before first paint.
  *(amended v2.10, V210-6)* A third value, `auto`, sets `data-theme` by the Sun's altitude at the observer, before first paint and on the tick (FR-PHONE-15).
- **FR-THEME-2** Contrast: every text pair ≥ 4.5 : 1 and non-text ≥ 3 : 1 in the night palette, pinned by the existing tokens test extended to both themes.
- **FR-THEME-3** The dome and polar colours (FR-DOME-2), the Sun glow, the cloud badge and the live stripe have night counterparts; no element keeps a non-red hue in night mode.

### 5.7 v1 additions *(proposal; the plan decides)*

- **Language.**
  No i18n library: two typed catalogs (`en.ts`, `es.ts`) sharing one message type, a `useT()` hook, and `Intl` for everything numeric and temporal.
  A missing key fails `tsc`.
- **Routes.**
  Hash routing stays (D-13): `#pass?…` and `#live?…` join the existing selection hash; no history library.
- **Service worker.**
  Hand-written or `vite-plugin-pwa` with a precache manifest, the plan's call; must stay under the strict CSP (`worker-src 'self'` covers it) and never touch data requests.
- **Worker contract.**
  One new request, `computeAt(t)`: the Now pipeline at an arbitrary instant, for FR-LIVE-6.
  The 72 h window changes only the request's `window`.
- **Moon.**
  `physics/moon.ts` (pure, astronomy-engine) with a `moonAt(t, observer)` result carried on `NowState`, on each `Pass` (`moonAtPeak`, glare flag) and computed in the worker; the tradition text is a static JSON under `data/`.
- **Colour in the dome.**
  `useColors` in glyphcss with `style-src-attr 'unsafe-inline'`; the palette is read from the CSS tokens at mount so themes work.
- **Offline store.**
  IndexedDB gains `passes` (keyed by observer cell and `computedAt`) and the forecast record keeps its `fetchedAt`; the readiness line derives from both.

### Phase 2 — v1 ("outdoor-ready", as decided 2026-09-03, V1-1)

Still no backend.
Everything below runs in the browser against the same two providers.

- Language: English and Spanish from the browser, switchable (§4.7).
- Desktop layout: two columns and a side guide panel at 100 cells, keyboard shortcuts (§4.8).
- Sky dome, second pass: no frame, fills its box, colour by meaning, orientation cues, more detail, live marker, Sun and Moon, drawn as lit surfaces under braille lines (§4.9); the composition is fixed by a spike that is the **first v1 task**, and the dome is the default view again.
- Live sky page: full-screen dome, status strip, 24 h time stripe with scrub and playback, hidden-objects toggle, landscape and wake lock, compass follow (US-10), shareable URL (§4.10).
- Offline for three nights: service worker, 72 h passes and forecast stored automatically, readiness line, PWA install, favourites, three nights grouped in the list (§4.11).
- Moon: phase, glare warning, and lore (§4.12).
- Share links for a pass and for a live moment (§4.13).
- Night theme (§4.14).

Definition of done:
- US-10, US-12..US-19 accepted; FR-I18N-1..6, FR-DESK-1..5, FR-DOME-1..7, FR-LIVE-1..10, FR-OFF-1..8, FR-MOON-1..5, FR-SHARE-1..3, FR-THEME-1..3 met; the amended FR-LOC-5, FR-VIS-1, FR-WX-1, FR-GUIDE-5, FR-X-1, FR-X-4 met.
- The MVP definition of done still holds (golden tests, headers, budgets, the FR-GUIDE-6 device check) with the budgets in PLAN §11 re-set for the new chunks.
- Desktop and phone captures for every screen in both languages and both themes in `docs/screenshots/`.
- `package.json` version 1.0.0, a `v1.0.0` tag, and the release checklist run on the deploy.
