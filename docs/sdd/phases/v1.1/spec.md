# v1.1 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.4 Goals (v1.1, "phone pass")

- **G12. Readable on a phone.**
  Every chart is the largest thing on the screen it is on, and nothing the page needs wraps, hides the chart or pushes it down.
- **G13. Explore by pointing.**
  Hold the phone up and the sky window shows where the passes run in the direction the phone faces.
- **G14. Controls out of the way.**
  Preferences and the location form live on one settings page on a phone; the home screen is the answer, not the form.

**US-20 — Set things up on a phone without scrolling past the form** *(v1.1)*
As a phone user, I open the app and see what is in my sky; the location form, the language and the theme are one tap away on a settings page.
- AC1: Below the wide breakpoint the header is one row: the title, `[ live ]` and `[ settings ]`.
  No language or theme control is on the home screen.
- AC2: `#settings` holds, in order: language, theme, the location inputs (place name, coordinates, altitude, use my location, the precision note), saved places with save and remove, and clear saved location.
  Every change applies at once; there is no save button.
  *(amended v2.0, V20-5)* The order is Location, Saved places, This browser (FR-SET-1).
- AC3: The home screen shows a one-line location summary ("Using <label> · [ change ]") that opens the settings page, then the readiness line, the banners, the Now panel, the Moon line, the hero card, the sort row and the list.
  *(amended v2.0, V20-5)* The summary's `[ change ]` opens the form in place, and the home screen is the three readings (FR-FIRST-4).
- AC4: `Esc`, the page's back control and the browser's back button return to the home screen with the observer, the selection and the list state intact.
- AC5: At and above the wide breakpoint nothing changes: the controls stay where US-14 puts them and no link to `#settings` is shown.
- AC6: No control row on the home screen, the settings page, the pass detail or the live page wraps at 390 px (FR-COMP-4).

**US-21 — Point my phone at the sky** *(v1.1; the home of US-10 on a phone)*
As a user outside, I hold my phone up and see, through it, where the passes run in the part of the sky I am pointing at.
- AC1: On a touch device the chart view control offers a third view, "window".
  Choosing it asks for orientation permission in that tap and then shows the sky in the direction the phone points.
  *(amended v1.3: on the pass detail; on the live page the follow control is the only way in, FR-FSC-6.)* *(amended v1.3.1, V13-6: on both pages again — the control is gone, and the tap that chooses "window" is the one that asks and the one that opens the sky screen.)*
- AC2: The window shows the horizon with compass names where it is in view, the altitude lines, the arcs of the passes in view with their rise, peak, end and shadow-entry markers, the live marker, the Sun and the Moon, from the same pass geometry as the dome (FR-LIVE-10).
- AC3: Turning, tilting and rolling the phone moves the view smoothly (the FR-GUIDE-6 target), and lifting the phone past the zenith keeps the picture continuous.
- AC4: Where orientation is absent or denied the option is absent or shows a note, and the dome stays the view.
- AC5: On the live page the window shows real time: entering it returns the shown instant to now and hides the time stripe and playback; leaving it brings them back.
  *(amended v1.3: on the live page the window is the follow screen, AC11..AC13; it hides the whole page, not the stripe alone.)* *(amended v1.3.1, V13-7: the screen shows the instant the page is showing — real time, or wherever the stripe and playback have taken it, still running at its speed — and entering no longer returns it to now.)*
- AC6: The heading is true north: the window and the following dome apply the local magnetic declination, and the strip shows it ("true north, declination +2.1°").
- AC7: The chosen chart view is remembered on the device.
  When the window is the remembered view and the browser needs a tap before it will give orientation, the chart shows a single `[ point at the sky ]` control in the window's place until tapped.
  *(amended v1.3.1, V13-8: the dome and the polar chart are what is remembered.
  The window is a mode: I enter it with a tap and the `×` gives back the view I came from, nothing restores it on a later load, and the `[ point at the sky ]` control has nothing left to gate.)*
- AC8 *(v1.2)*: The `[ follow phone ]` control on the live page opens the window from whatever view is showing, and pressing it again returns me to the view I had; what I picked from the view control myself is what stays remembered.
  *(amended v1.3: what opens is the follow screen, and its `×` is the second press; FR-FSC-2.)* *(amended v1.3.1, V13-6: the control is gone.
  The view control's "window" is the way in, its `×` the way out, and what I picked before it is what it gives back.)*
- AC9 *(v1.2)*: I can sweep the phone over the whole sky — round the horizon, past the zenith and behind me — and the picture stays continuous; nothing is clipped to a region I can leave.
- AC10 *(v1.2)*: With the phone pointed down the picture says so: the ground below the horizon is hatched with a one-line note while sky is still in the field, and the whole box becomes "you are pointing at the ground — raise the phone" once no sky is left in it.
  Raising the phone brings the sky back with no tap.
- AC11 *(v1.3; amended v1.3.1, V13-6)*: Choosing "window" from the view control gives me a screen that is the picture and nothing else: the sky the phone points at filling the screen, a `×` in the top-right corner, where I am looking in the top-left corner and the legend along the bottom.
  No header, no view control, no hint, no strip, no toggles, no share.
  The `×` puts the live page back exactly as it was.
  *(amended v2.0, V20-9)* The legend along the bottom is the compass gutter (FR-GUT-1).
- AC12 *(v1.3)*: The picture is drawn only with the phone held sideways.
  Held upright, the screen tells me to turn the phone, in my language, and turning it brings the picture with no tap and no second permission prompt.
  *(amended v1.4.1, V14-9: the picture is always there.
  Held upright I get it in the portrait box with one line advising me to turn the phone; nothing waits for the turn.)* *(amended v2.0, V20-9)* Upright, the advice is a line under the countdown, not over the picture (FR-GUT-7).
- AC13 *(v1.3; amended v1.3.1, V13-6, V13-9)*: Hidden objects never appear on the sky screen. "Window" is in the view control on both the live page and the pass detail, and choosing it on either opens the same screen.
- AC14 *(v1.3.1)*: On a pass detail, choosing "window" gives me that same screen over the sheet — the whole arc of the pass I opened (FR-DOME-5), the `×`, where I am looking and the legend — and the `×` gives the sheet back with the view it had.
  Nothing scrolls while the screen is up: not the screen, not the sheet under it.
- AC15 *(v1.4.1)*: With my phone's rotation locked, holding it sideways gives me the same wide screen an unlocked phone gives — the sky, where I am looking, the legend and the `×` all the right way up to my eye — and tipping it flat to look at a pass overhead does not spin the picture.

**US-22 — Watch the trajectories appear** *(v1.1)*
As a user on the live page, I move time forward and see each satellite's track appear, grow and fade, instead of a chart full of every arc of the coming day.
- AC1: At the shown instant `t` a pass under way is drawn from its rise to its position at `t`, solid, in its colour, with the marker; the part of the arc ahead of `t` is not drawn.
- AC2: A pass that rises within the next few minutes of shown time (`ARC_LOOKAHEAD`) is drawn faint and dotted over its whole arc with the rise point marked, so I know where to look next.
- AC3: A pass that ended within the last few minutes of shown time (`ARC_LINGER`) stays as a faint full arc without a marker, then disappears.
- AC4: Playing at 3600× reads as trails appearing, growing and fading, at the FR-LIVE-5 rate.
- AC5: The stripe's hour labels, the date at each midnight and the shown instant are readable at arm's length on a phone; the shown instant is a clock readout above the stripe.
- AC6: I can land the shown instant within a minute of a pass's rise in at most three taps on a phone (the method is chosen by the spike, FR-TRAJ-5).
  *(amended v1.4)* One tap does it: `[ pass ▶| ]` (FR-SPAN-4).
  The three-tap ceiling stands as the ceiling.
- AC7: The pass detail is unchanged: it keeps drawing the whole arc of the pass it explains.

**US-23 — Read the chart by its legend** *(v1.1)*
As a user, I read which arc is which from a colour-keyed list beside or under the chart, and the drawing itself carries no names or clock times.
- AC1: No satellite name, clock time, Sun or Moon caption or hidden-object reason is drawn inside the dome, the polar chart or the window.
  Compass names, ring labels and degree ticks stay.
- AC2: A legend under the chart (compact) or beside it (wide) lists every drawn pass: a one-character key that is also drawn at the arc's peak, a swatch in the arc's colour, the name, the rise, peak and end times, and the state at the shown instant.
  *(amended v1.4, V14-4, V14-5)* Beside the chart at every wide width (FR-LEG-6); on the compact live page behind a `[ list (n) ]` control that opens it at a fixed height (FR-LEG-7).
- AC3: On the pass detail the existing start/peak/end table is the legend: it sits directly under the chart with the key and the swatch, and the other passes drawn dim get one row each; the Sun and the Moon get one line each.
- AC4: Tapping or focusing a row highlights its arc and dims the others; the highlighted pass is listed first.
- AC5: The legend colours match the arcs in both themes, and the key is the channel that survives without colour (FR-DOME-2).

### 4.15 Feature flags *(v1.1)*

- **FR-FLAG-1** A build-time flag `VITE_MOON_LORE` (`on` | `off`, default `off`, read from the environment at build) controls the tradition line (FR-MOON-4, FR-MOON-5).
  Off: the lore component is not rendered, its data file is in no chunk of the build, and no lore string reaches the DOM.
  On: v1 behaviour.
  The flag is read in exactly one module and exposed as a typed constant; no other code reads the environment.
  The observing facts (FR-MOON-1..3) and the Moon on the charts do not depend on it.
- **FR-FLAG-2** Both states are tested: the component and its copy under `on` (the existing tests, run with the flag set), the default capture set (D-179) under `off`, and a build test that fails when the lore data is present in `dist/` with the flag off.
  The flag's value is printed in the build log.

### 4.16 Compact layout and settings *(v1.1)*

"Compact" is FR-DESK-1's breakpoint: below 100 cells of viewport width.

- **FR-COMP-1** Compact header: one row of at most 36 cells (a 390 px viewport at the default cell): the title, `[ live ]` and `[ settings ]`.
  The tagline is not shown on compact.
  The wide header is FR-DESK-2 as amended.
  *(amended v2.0, V20-3)* The row is the mark at 24 px, the short title, `[ live ]` and `[ settings ]` — 33 cells (FR-MARK-4).
- **FR-COMP-2** A settings page at `#settings`, in this order: Language (FR-I18N-1's control), Theme (FR-THEME-1's control), Location (the FR-LOC-1 inputs, the device-location button, the precision note of US-1 AC4), Saved places (FR-OFF-7), Install (FR-OFF-6 as amended v1.1.2, V11-16 — the offer with no decline beside it), Clear saved location.
  Every change applies and is saved at once as it does today; there is no save action.
  `Esc`, the page's `[ ← Back ]` control and the browser's back return to the home screen; the hash is the only route state (D-13), so a reload on `#settings` reopens it.
  The route exists at every width; only the compact header links to it.
  *(amended v2.0, V20-5)* The order is FR-SET-1's: Location, Saved places, then one `This browser` group of language, theme and install; the page fits 390 × 844 (FR-SET-2).
  The controls, the route and the way back are unchanged.
- **FR-COMP-3** Compact home, after the header and in this order: a one-line location summary ("Using <label> · [ change ]", with the accuracy note of US-3 AC3 when it applies) that opens `#settings`; the readiness line (FR-OFF-4); the elements banners; the Now panel; the Moon line; the hero card; the sort row; the list; the footer.
  With no observer the summary is the prompt to set one and opens `#settings`.
  *(amended v2.0, V20-5)* The compact home is the three readings of FR-FIRST-4: the location reading is the cold open with no observer and the one-line summary with one, whose `[ change ]` opens the form in place; nothing on the home screen opens `#settings` to set a place (FR-SET-3).
  The rest of the order above stands, under the When and What readings.
  *(amended v2.0.2, V20-16)* On the first visit the compact home is FR-FIRST-4's three steps, and every later visit the three readings stacked with the lighter contents of FR-FIRST-9..11; the hero card is folded into the list (FR-FIRST-10).
  *(amended v2.6, V26-2)* On compact with an observer, after the first visit, the home is FR-FLOW-1's: the two-line Where (FR-FLOW-2), the three doors, then When and What; the next-event block and `[ Open the live sky ]` are carried by the doors.
- **FR-COMP-4** Control-row fit: every row of controls the compact layout renders MUST fit in 36 cells without wrapping: the header, the sort row ("Sort: [x] Soonest [ ] Best"), the chart view control, the live page's playback rows, the share and follow actions.
  A unit test renders each control row's text at compact and asserts its cell count.
  Labels MAY differ between compact and wide (US-5 AC2); meaning may not.
  *(amended v1.4)* The rows this phase adds are counted the same way: FR-SPAN-3's stepping row at 35 cells, and the actions row with `[ list (n) ]` on it (FR-LEG-7).
  *(amended v2.0, V20-8)* The rows this phase adds are counted the same way: the compact header with the mark (33 cells), the conditions line (FR-WATCH-3), the two actions rows of FR-WATCH-4 (27 and 33), the top row with the indicator, the settings page's rows (FR-SET-1) and the cold open's step line.
- **FR-COMP-5** The chart box on compact: full-bleed (it spans the viewport width and ignores the page padding) and never shorter than it is wide.
  *(amended v1.3.1, V13-10, F-63)* Full-bleed is the width of the **pane** the box is in, not of the viewport.
  Where the pane is the page — portrait on either page, and the pass detail's sheet — the box ignores the page's side padding as it always has; where the page has put the box in a column of its own, which is the landscape-phone live layout (FR-LIVE-7), the box is that column's width and breaks out of nothing.
  No part of the drawing, its labels and its raster included, may cross into another pane at any supported size.
  On the pass detail the box is a square.
  On the live page in portrait the box takes the height left by the header row, the two-line strip, the stripe block and the control rows (FR-LIVE-7 as amended), and at least its own width.
  The drawing fills the box under FR-DOME-1's 90 % rule; the cell keeps D-65's rule, so the grid gains rows and columns rather than the cell growing.
  *(amended v1.4, V14-5)* On the live page in portrait the height the rows leave the box no longer counts the legend: it is behind a control and rendered only while open (FR-LEG-7).
  The floor is measured with the list closed, at 390 × 844 and 390 × 667 (FR-LEG-8); with it open the box MAY fall under the floor — the reader's own tap — and the page still does not scroll.
  *(amended v2.1, V21-14, F-62)* The floor is restated by height: on a viewport at least 844 px tall the box is never shorter than it is wide (374 px at 390); at 390 × 667 it is at least `COMPACT_BOX_MIN_SHORT_PX` (320 px — the shipped build measures 329), since every gap is already at its minimum there and the rows are the page's inventory.
  `shapes.spec.ts` asserts both.
  *(was: "MUST hold at 390 × 667", which the 2.0.0 build does not and cannot without dropping a row)* *(amended v2.1, V21-23)* The short phone's floor is `COMPACT_BOX_MIN_SHORT_PX` **304 px, while watching**.
  The headline's path is the pass's own words and wraps to a second line when they are long (47 cells do at 390 px), which takes 24 px from the box: 329 with a one-line path, 306 with two. 304 holds either.
  While scrubbing, the stripe block's rows take the box to about 220 px at 390 × 667, and no floor holds there, so the 667 floor is not asserted while scrubbing.
  The 844 rule holds in both states where the box spans the viewport (the phones), and while watching where FR-TAB-1's column caps it (the tablets: 578 × 577 while scrubbing at 768 × 1024).
  *(was: 320 px in both states, and the 844 rule at every width)* *(amended v2.5, V25-18)* The short phone's floor is `COMPACT_BOX_MIN_SHORT_PX` **280 px, while watching**.
  The landmark line (FR-SKY-11) is the compact headline's fourth line and takes 23 px from the box: 306 with a one-line path, 282 with two. 280 holds either.
  *(was: 304 px)*
- **FR-COMP-6** A 390 px mockup set approved by the owner is the visual reference for the compact home screen, the settings page and the pass detail with its legend, in both themes, kept in `docs/mockups/`; the tasks that build those screens are gated on it as R23 was on FR-DESK-5.
  The live page's compact layout is not mocked up: it follows the spike of FR-WIN-7.
  Every task of this phase ships 390 px captures in both languages and both themes for the screens it changes, and 1280 px captures where the wide layout changed.
  *(amended v1.4)* This phase's captures are FR-SHP-5, FR-SPAN-7 and FR-LEG-9.
  *(amended v2.0)* This phase's captures are FR-FIRST-7, FR-MARK-8, FR-WATCH-9, FR-GUT-8 and FR-SET-4; its visual reference is the design phase's artboards under `redesign/captures/`, untracked (V20-11), and where a number in the text and the artboard disagree the text wins.
  *(amended v2.1, V21-12)* What a capture has to show, the widths of the set and the evidence a closed question may cite are §4.39 (FR-CAP-1..5).
  The compact screens gain a 360 px column and the home a 1920 px capture.
- **FR-COMP-7** *(v2.1, V21-10)* The compact live page's rows hold in Spanish with room to spare.
  On compact the top row's Back control is drawn as `[ ← ]` in both languages — accessible name "Back" / "Volver", the 48 px hit box unchanged — so the place has the width the word took; at 360 px in Spanish the place shows a whole coordinate pair before it ellipsises.
  The action row's Share control has its brackets again (`[ Compartir ]`), which PLAN D-411 took off to fit; the Spanish labels on that row are shortened in the catalog until the row fits.
  `controlRows.test.ts` pins both rows at no more than 34 of FR-COMP-4's 36 cells in both languages.
  The conditions line's short words — `limpio`, `tapado`, `s/d` — stay: they are what keeps that line inside 36 cells (FR-WX-5), and `s/d` has the accessible name "sin datos".
  *(F-82)* *(amended v2.6, V26-4)* The `[ ← ]` top row is every compact sub-page's — live, stars, pass detail, settings — with the page's name (FR-FLOW-3).

### 4.17 Chart legend *(v1.1)*

- **FR-LEG-1** The dome, the polar chart and the sky window draw no satellite name, no clock time, no Sun or Moon caption and no hidden-object reason.
  They keep: compass names, the 30°/60° ring labels and degree ticks, the markers (rise, peak, end, shadow entry, live position), the arrowhead, the Sun glow, the Moon glyph and, new, a one-character *key* at each drawn arc's peak marker (and at a hidden object's dimmed position).
  Keys are `A`, `B`, `C`… in legend order.
  *(amended v2.5, V25-4)* Stars, figures and planets carry no key and no caption on the pass pages: the names layer is the stars page's (FR-STAR-6), a tap names a star anywhere (FR-STAR-7), and the legend lists passes and the two bodies as before.
  *(amended v2.5, V25-9)* One star is the exception: the highlighted pass's landmark (FR-SKY-11) is ringed in every view and named beside its ring in the window and on the screen, and its name is the only star name the pass pages draw unasked.
- **FR-LEG-2** Placement: under the chart on compact, at the right of the chart on wide (24 cells minimum), the same in all three views.
  *(amended v1.3, V13-1; renamed v1.3.1, V13-6)* On the sky screen (§4.23) the legend is a strip over the bottom edge of the drawing, at most two rows high and scrolling inside, on the overlay surface FR-FSC-3 sets.
  *(amended v1.2.1, V12-14, V12-15)* On the one-column live page (FR-LIVE-7, under 1660 px) the legend is under the stripe as on compact: at most four rows, scrolling inside, the page's whole width.
  *(amended v1.2.1, V12-7)* That column is the page's to fill under the legend: on the wide live page it carries FR-LIVE-7's rail, and is as wide as the rail needs rather than the legend's 24 cells.
  The legend keeps the room its rows ask for and scrolls inside what is left, so a long list never pushes the page's own controls out of the column.
  The legend is rendered from the same props as the chart (FR-LIVE-10's rule) and lists exactly the passes the chart draws, in the states it draws them.
  *(amended v1.4, V14-4, V14-5)* Wide: beside the chart at every wide width, in the rail (FR-LEG-6), and the one-column clause above is withdrawn with the layout it described.
  Compact on the live page: behind the `[ list (n) ]` control, two `--tap` rows when open (FR-LEG-7).
  Compact elsewhere — the pass detail — is unchanged, as is the sky screen's strip.
  *(amended v2.0, V20-9)* On the sky screen sideways the strip is withdrawn for the compass gutter (FR-GUT-1); upright the legend is two `--tap` rows under the band (FR-GUT-7).
- **FR-LEG-3** A row per drawn pass: the key, a two-cell swatch in the arc's colour, the name, the rise, peak and end clock times in the observer's zone, and the state at the shown instant: `up` (marker on the arc), `soon` (lookahead, FR-TRAJ-1), `gone` (linger), `in shadow`, `daylight`, `too faint` (the FR-LIVE-6 reasons).
  On the pass detail the FR-GUIDE-1 numeric table is the legend: it moves directly under the chart, its heading carries the key and the swatch, it adds the shadow-entry row where one applies, and the other passes drawn dim get one row each (key, swatch, name, rise and end times).
  The Sun and the Moon get one line each with azimuth and altitude at the shown instant and, for the Moon, the phase glyph.
- **FR-LEG-4** Interaction: a tap or click on a row, or keyboard focus on it, highlights its arc (full colour and weight) and dims the others until another row or the chart is activated; on the pass detail the explained pass is highlighted by default and listed first; on the live page the first row is the pass whose marker is nearest the zenith.
  Rows are buttons; the list is the text alternative of FR-GUIDE-7.
- **FR-LEG-5** Colours: the swatches use the arc tokens (FR-DOME-2, FR-LIVE-2's palette) with their night values (FR-THEME-3), and text on the swatch row keeps FR-THEME-2's contrast.
  The key is the channel that carries the mapping without colour.

### 4.18 Sky window *(v1.1)*

- **FR-WIN-1** A third chart view, "window": a 2D projection of the sky as seen from the observer in the direction the device points, drawn in SVG (FR-GUIDE-5 permits it for 2D) from `SkyChartProps` (FR-LIVE-10).
  Nothing in the window draws satellites by any other path.
  The field of view (`WINDOW_FOV`, default 60° across the shorter side) and the projection (gnomonic or stereographic) are constants fixed by the spike (FR-WIN-7).
  *(amended v2.5, V25-14)* `WINDOW_FOV` is the default field; the reader may zoom between `WINDOW_FOV_MIN_DEG` and `WINDOW_FOV_MAX_DEG` (FR-SKY-14), and everything derived from the field reads the current one.
- **FR-WIN-2** Content: the horizon line with compass names along it where it is in view; the altitude lines at 30° and 60° and a zenith mark; azimuth ticks every 30° on the horizon; the arcs of the passes that cross the view with their rise, peak, end and shadow-entry markers and the arrowhead; the live marker and the flown part (FR-DOME-5); the Sun glow and the Moon glyph (FR-DOME-6); the legend keys at the peaks (FR-LEG-1).
  Colours per FR-DOME-2 and FR-LIVE-2; the legend of §4.17 applies.
  *(amended v2.5, V25-2)* The content is the layers of the `SkyScene` the page passes (FR-SKY-1): with the stars layer on, the stars, the figures and the planets of FR-STAR-6 under the arcs.
- **FR-WIN-3** Orientation: heading, pitch and roll from `DeviceOrientationEvent` (an `absolute` event or `webkitCompassHeading`, as FR-LIVE-8), taken as one rotation so the view stays continuous past the zenith and when the phone rolls; the screen's orientation is applied.
  A smoothing constant (`WINDOW_SMOOTHING`, default fixed by the spike) steadies the sensor.
  Target: ≥ 30 updates/s on the FR-GUIDE-6 device; the worker is never called for the view.
  Heading is corrected to true north with the local magnetic declination from the World Magnetic Model at the observer's position, computed once per observer on the main thread; the strip names the correction ("true north, declination +2.1°").
  The same correction applies to FR-LIVE-8.
  *(amended 2026-11-02, the owner's call from the phone, PLAN D-1027)* Held upright at the horizon the picture must be as steady as tilted.
  The compass calibration reads the back's azimuth from the whole rotation (upright is where alpha and gamma lock, and a hand's tremor swings them both), settles to a slow mean and drops samples far from it; the smoothing is timed by the clock and steadier while the phone is still than while it turns (a time constant of 0.23 s held still, `WINDOW_SMOOTHING`'s 0.6 a frame at the fastest).
- **FR-WIN-4** Availability and permission: the window is offered only where FR-LIVE-8's presence test passes (a touch device with the constructor).
  Permission is requested in the tap that chooses the view or the `[ point at the sky ]` control, never on load.
  A denial shows a one-line note and leaves the dome as the view; a relative-only device (no heading) shows FR-LIVE-8's note and does not offer the window.
  Desktop never sees the option.
  *(amended v1.2, V12-1)* The tap on the `[ follow phone ]` control (FR-FOL-1) is one of the taps that may ask.
  *(amended v1.3, V13-4)* On the live page it is the only one: the view control there does not offer the window (FR-FSC-6).
  *(amended v1.3.1, V13-6)* Withdrawn with the control itself: the tap that chooses "window" from the view control is the only tap that asks, on the live page and on the pass detail alike, and it is the tap that opens the sky screen (FR-FSC-1, FR-FSC-6).
  *(amended v2.4, V24-4)* On the stars page (§4.46) the window is drawn for every reader, desk included, under the hand camera (FR-STAR-4); the presence test governs the sensor there — whether `[ hold up to the sky ]` is offered — and not the view.
  The live page and the pass detail are unchanged by this phase.
  *(amended v2.5, V25-1, V25-3)* And then they are not: the window is offered on every page and every device (FR-SKY-2), and the presence test governs the sensor alone everywhere — whether the screen can follow the phone — never whether the view is offered.
- **FR-WIN-5** The chart view (dome, polar, window) is a saved preference on the device.
  When the window is the saved view and orientation still needs a tap, the chart area shows one `[ point at the sky ]` control in the window's place until tapped.
  The window has no manual pan or drag: the dome is the hand-driven view.
  *(amended v1.2, V12-1)* A view entered by the follow control is not saved: the preference is what the reader picked from the view control, and leaving follow returns to it.
  *(amended v1.3, V13-4)* The `[ point at the sky ]` control is the pass detail's alone: the live page never shows it, and a saved view of `window` is drawn as the dome there and left as it is (FR-FSC-6).
  *(amended v1.3.1, V13-8)* The saved preference holds the dome or the polar chart and nothing else.
  The window is a **mode**, not a view the page can be left in: it is entered by the tap that chooses it, the screen's `×` gives back the view that was showing, and no load, reload or share link ever restores it — so the `[ point at the sky ]` control has nothing left to gate and is removed from both pages, and no page has to draw a saved `window` as something else.
  What the reader last picked deliberately, dome or polar, is what every page opens on.
  *(amended v2.4, V24-4)* "The window has no manual pan or drag: the dome is the hand-driven view" is withdrawn for the stars page, where the window is the only view and takes the dome's drag and keys (FR-STAR-4); it stands on the live page and the pass detail until v2.5.
  *(amended v2.5, V25-3)* On wide the window is a view like the other two, laid out in the box under the hand camera, and the saved preference may hold it; on compact the window is still a mode — the screen — and the preference still holds the dome or the polar chart only (FR-SKY-2).
- **FR-WIN-6** On the live page, entering the window returns `t` to real time (FR-LIVE-5's `now` action), hides the stripe block and the playback row and keeps the two-line strip; leaving it restores them.
  The pass detail's window draws the whole arc (FR-DOME-5); the live page's window follows FR-TRAJ-1.
  *(amended v1.3, V13-1; renamed v1.3.1, V13-6)* On the live page the window is the sky screen (§4.23): the two-line strip is not kept there, the declination is the readout's line (FR-FSC-4), and the whole page is what entering hides and leaving restores.
  *(amended v1.3.1, V13-7)* The "now" rule is withdrawn.
  Entering the window does not touch `t` and neither does leaving it: the screen draws the instant its page is showing and keeps running at that page's speed (FR-FSC-8).
  The stripe block and the playback row are absent because nothing of the page is on the screen, not because time has been reset.
- **FR-WIN-7** The spike.
  Before the window task or the stripe-stepping task is cut, a half-day spike in `spike/` fixes: the projection and `WINDOW_FOV`; the sensor path on iOS Safari and Android Chrome (permission flow, absolute versus relative readings, screen rotation, roll; the D-175 assumption about `webkitCompassHeading`); the smoothing; the update rate by the D-62 method; and the touch stepping of the stripe (FR-TRAJ-5) among its candidates.
  One page with every knob as a URL parameter, captures at 390 px, and a findings file the owner picks from.
  The owner runs the spike with the session, on a phone, not headless (V11-9).

### 4.19 Live trajectories and the stripe *(v1.1)*

- **FR-TRAJ-1** What the live page draws at the shown instant `t`, per pass in FR-LIVE-2's set: with `start ≤ t ≤ end`, the arc from the rise to the position at `t`, solid, in its colour, with the marker; the part beyond `t` is not drawn.
  With `t < start ≤ t + ARC_LOOKAHEAD`, the whole arc faint and dotted with the rise point marked and no marker.
  With `t − ARC_LINGER ≤ end < t`, the whole arc faint, no marker.
  Otherwise not drawn.
  Hidden objects (FR-LIVE-6) are unchanged: dimmed positions, no arcs.
- **FR-TRAJ-2** `ARC_LOOKAHEAD` default 5 min and `ARC_LINGER` default 10 min, both in shown time, centralised with the other thresholds (FR-VIS-6) with their rationale: long enough to see where to look next and what just passed at 60×, short enough that the chart does not fill at 3600×.
- **FR-TRAJ-3** FR-TRAJ-1 applies to the dome, the polar chart and the window on the live page at every width.
  The pass detail is not affected: it keeps the whole arc of the explained pass and the dim arcs of the others (FR-DOME-5).
  The legend lists exactly the drawn passes with their FR-TRAJ-1 states (FR-LEG-3).
- **FR-TRAJ-4** The stripe: three rows in body-size cells.
  Row 1: hour labels, every 2 h on wide and every 3 h on compact, with the date (day and month, short) at each midnight crossing.
  Row 2: the band, with FR-LIVE-4's night shading and a tick every hour.
  Row 3: the pass segments in their arc colours.
  A cursor crosses all three rows at `t`, and a clock readout in the observer's zone (hours and minutes, and the weekday when `t` is not today) stands above the stripe in the heading size — on a wide page with the playback controls beside it on that row (FR-LIVE-7, V12-13).
  The stripe is at least 36 cells wide on compact; wider viewports scale it to the box.
  *(amended v1.2.1, V12-7, V12-8)* The label cadence follows the stripe's own width and not the shell it is drawn in: every 2 h where twelve two-character labels fit — 60 cells — and every 3 h under that.
  On the wide live page the stripe is under the box (FR-LIVE-7) — the box's width in two columns, the page's whole width in one (V12-15) — which is every 2 h at every wide width; the rail's 3 h is the compact page's and the landscape phone's.
  Whatever the cadence, no label may be drawn over another: where two would touch, the one that stays is the date, since no other label carries the day (F-59).
  *(amended v1.4, V14-3)* The three rows draw the chunk and not the span (FR-SPAN-1), with the label cadence recomputed for the chunk's width — every 30 min where twelve labels fit, every hour under that — and the overview row (FR-SPAN-2) stands above them, under the clock readout.
  Everything else stated here stands (FR-SPAN-7).
  *(amended v2.0, V20-4)* The clock readout is the scrubbing state's headline with its offset from now (FR-WATCH-2), on the time row on wide; the three rows are rendered only while scrubbing (FR-WATCH-4).
- **FR-TRAJ-5** Touch stepping: the spike (FR-WIN-7) chooses among step buttons (`[ −1 h ] [ −10 min ] [ +10 min ] [ +1 h ]` under the stripe), tapping a pass segment to jump `t` to that pass's rise, and a slow-scrub gesture; the arrow keys keep FR-LIVE-4's 1 min and 10 min steps.
  Whatever is chosen MUST let the user land `t` within 1 min of a pass's rise in at most three taps (US-22 AC6) and MUST fit FR-COMP-4.
  *(amended v1.4, V14-3, V14-6)* The row is re-cut to `|◀ pass  ◀ 4h  −1m  +1m  4h ▶  pass ▶|` (FR-SPAN-3) — the ±10 min steps withdrawn and the chunk arrows in their place — and it is shown wherever the stripe is rather than on a touch device alone.
  The three-tap ceiling stands; one tap now does it (FR-SPAN-4).
  *(amended v2.7, V27-3; FR-TONIGHT-3, FR-TONIGHT-4: on the compact live page the step row is gone; a tap on a pass tick and the `next` control replace it.)*

### 4.20 The v1 findings *(v1.1)*

Every v1 task PR was merged with its review findings open (V1-11's gate merges on the owner's word, not on a clean review).
They are listed here so the phase closes them, with the PR they came from and the lane that owns the code.
The wording is the reviewer's, shortened.
*(v1.1.1)* F-51..F-53 are the owner's findings on the wide live page after wave 4 (V11-14), measured on the fixtures at 1280 × 800, 1920 × 1080 and 2560 × 1440.
*(v1.2)* F-54..F-56 are the owner's findings on the released v1.1 build (V12-3..V12-5); FR-FIX-1 governs them as it governs the rest, and the v1.2 tasks carry them.
F-57 and F-58 are R56's review findings, merged open with #87 and written down here for a later phase as V12-6 asks; no v1.2 task carries them.
*(v1.2.1)* F-59 is the owner's finding on the released v1.2 build (V12-7), and F-60 and F-61 are what reproducing it found (V12-9, V12-11); R61 carries all three.
F-62 is R59's follow-up, merged open with #91 and written down here for a later phase as V12-6 asks; no v1.2 task carries it.
*(v1.2 release)* F-54, F-55 and F-56 are closed by R57 (#89), R59 (#91) and R58 (#90) respectively; F-59, F-60 and F-61 are all three closed by R61 (#92); each closure is a change with a test that fails on the old code (FR-FIX-1), recorded in that PR.
F-57, F-58 and F-62 stay open, as this section already says: no v1.2 task carries them.
*(v1.3.1)* F-63 is the owner's finding on the R64 build, reproduced and measured before it was written down (V13-10); R66 carries it, and FR-FIX-1 governs it as it governs the rest.
F-64 is what running the suite for R66 found — an `moon.spec.ts` failure that reproduces on `origin/main` — and no v1.3.1 task carries it.
*(v1.4)* F-65 is the owner's finding on the 1.3.0 build, reproduced and measured before it was written down (V14-2); and F-57, F-58, F-62 and F-64 — the four rows no phase carried — are v1.4's, the owner's call when asked (V14-7).
FR-FIX-1 governs all five.
*(R67)* F-64 is closed: the catalogue and the fixture were already right — with `VITE_MOON_LORE=on` set, `moon.spec.ts` passed unchanged, including its "Taurus" assertion — the cause was the local `e2e` npm script building with the flag off while CI already built the e2e stage with it on (FR-FLAG-1/2), so only a bare `npm run e2e` (or a preview served from that build) ever showed the failure `origin/main` reproduces.
Fixed by matching the `e2e` script's build to CI's, with `tests/build/flags.test.ts` holding the two sides together so the flag cannot fall off one of them again (#108).
*(R68)* F-57 and F-58 are closed by R68 (#109), a change with a test that fails on the old code (FR-FIX-1): the window projects the horizon once per render where it draws it, and reads `lookDirection` once.
*(R69)* F-65 is closed by R69 (#110): every rule of the landscape block names the compact mode, `tests/styles/liveShape.test.ts` fails on the old sheet and `tests/e2e/shapes.spec.ts` walks the FR-SHP-4 matrix.
*(R71)* F-62 is closed at 390 × 844 by R71 (#112) — 375 px of box against the floor of 374, measured with the list closed by `live-compact.spec.ts`, which fails on the old layout — and its last sentence is open at 390 × 667, where 198 px is 176 under the floor and no furniture is left to cut.
*(v1.4 release, R72)* The phase's five rows and where they stand: F-64 closed by R67 (#108), F-57 and F-58 by R68 (#109), F-65 by R69 (#110), F-62 closed at 390 × 844 by R71 (#112).
None of the five is closed silently, and the one thing left open is not a defect to fix but a requirement to restate: FR-LEG-8's "MUST hold at 390 × 667" against FR-COMP-5's own escape, which is the owner's sentence and is on the release checklist (`docs/RELEASE.md` §11.3) rather than assigned to a task.
F-66 is what the release re-shoot of the capture set found; no v1.4 task carries it.
*(v2.0)* F-67 and F-68 are what the phase's own CI found before and during its first task — a wall-clock test and then four files of them — and each was closed by the PR that reproduced it, #116 and #117.
No other v2.0 task carries a row: the six areas are new sections, not fixes.
*(v2.0 release, R80)* Where every row this phase carried stands, none of them closed silently.
**F-67** closed by #116 and **F-68** by #117, each a test pinned to the fixture's instant.
**F-66 stays open and did not reproduce**: the 2.0.0 re-shoot shot `polar at 390 px` three times off the one build and all four variants came out byte-identical, where the 1.4.0 build alternated in the `night`/`es` one — the row keeps its v1.4 measurement and gains this one, because a flake that three runs did not show is not a flake that is fixed, and the cause is `chart`-lane code no v2.0 task touched.
**F-62's open half** — the compact box at 390 × 667 — is not closed either, and it moved: R71 measured 198 px against FR-COMP-5's floor of 374, and R77's watching state (FR-WATCH-4 renders no stripe, no step row and no playback row at all) measures 329, so the gap is 45 px rather than 176.
Still the owner's sentence rather than a task's, now on `docs/RELEASE.md` §12.
Two rows are added by this task and belong to a later phase: **F-69**, the main chunk over its budget with the mark in it, and **F-70**, a second capture of the set that does not answer twice the same way.

- **FR-FIX-1** Each finding below MUST be closed by a change with a test that fails on the old code, or recorded as *already fixed on main* with the commit that fixed it, or moved to Phase 3 by an explicit Decision Log row.
  A findings task per lane (V11-11) carries them; a finding whose code a v1.1 feature task rewrites MAY be closed by that task instead, named in its acceptance.
- **FR-FIX-2** Findings that are e2e or CI defects (F-33, F-34, F-36, F-37, F-38) are closed in the first wave together with §4.21, before any feature task runs.

| ID | From | Lane | Finding |
|---|---|---|---|
| F-1 | R22 #48 | chart | A failed dynamic import of the astronomy chunk is memoised, so the Sun and Moon stay absent for the session and the dome falls back to the default key light. |
| F-2 | R22 #48 | chart | The flown strip drops the `omit` gap, so the dashed direction-of-travel tail is painted over once `now` passes 80 % of the arc. |
| F-3 | R22 #48 | chart | The polar Sun label is drawn under the grid, so rings, ticks and arcs draw over it. |
| F-4 | R22 #48 | chart | A fixed 4° sampling step leaves the twilight glow up to 2° off the Sun's azimuth on the polar chart. |
| F-5 | R22 #48 | chart | The flown strip ignores `highlighted`, so a dim pass's flown half outshines the highlighted one. |
| F-6 | R23 #39 | ui | Between 960 px and about 1350 px the list pins at its 44-cell floor and the guide collapses to 43–107 px (FR-DESK-3 as amended). |
| F-7 | R23 #39 | ui | The document `Escape` listener has no guard, so an `Escape` meant for the place picker's suggestions also closes the guide and clears the hash. |
| F-8 | R23 #39 | ui | Opening a second pass reuses the `PassDetail` instance, so the new heading is never focused and closing returns focus to the first opener. |
| F-9 | R23 #39 | ui | The list's fixed `max-height` (34 rows) is taller than a 720 px laptop viewport. |
| F-10 | R23 #39 | ui | The "0.6 em advance" the 960 px derivation and the breakpoint test rely on is false for Consolas (0.55 em); the breakpoint is 109 cells on Windows. |
| F-11 | R26 #49 | data | `addFavourite` re-sorts by `lastUsedAt`, so on a full list a stamp newer than `at` pushes the just-saved entry off the end. |
| F-12 | R26 #49 | data | A favourite saved before the forecast resolves keeps `timeZone: null` forever, so offline selections render every time in UTC. |
| F-13 | R26 #49 | data | The `Favourite` doc block still describes `id` as the cell while the field is `cellKey`. |
| F-14 | R30 #44 | ui | US-18 AC1 is half done: the Moon's phase and illumination never appear on a pass card or in the guide unless glare is set. |
| F-15 | R30 #44 | ui | The minimum-altitude glare condition is hard-coded into both catalogs as prose, unlike the other two thresholds. |
| F-16 | R30 #44 | ui | A leftover debug script is untracked in the tree and inside ESLint's glob. |
| F-17 | R31 #50 | ui | A share link stays authoritative while it is in the hash: a recipient typing their own coordinates has the detail unmounted and re-opened from the link. |
| F-18 | R31 #50 | ui | The FR-SHARE-3 substitute pass opens without its explanation while the job is still computing. |
| F-19 | R31 #50 | ui | Altitude bounds are copied from `CoordsInput` instead of shared, so the form can emit links the parser rejects. |
| F-20 | R31 #50 | ui | An uncommitted scratch Playwright config hard-codes a port with `reuseExistingServer: true`. |
| F-21 | R27 #52 | ui | Every warm start flashes "Not ready offline: no orbital elements and cloud forecast" before the requests return. |
| F-22 | R27 #52 | ui | The place picker's offline notice keys off the field's pre-filled text, so opening offline with a saved place shows "No connection". |
| F-23 | R27 #52 | ui | `offlineUntil` is never compared with now, so an expired stored run reads "Ready offline until <a past date>". |
| F-24 | R27 #52 | ui | Night-group overrides are never reset per run, so after a location change tonight can stay closed and no night is open. |
| F-25 | R27 #52 | ui | The night heading counts the pass promoted to the hero card, so "3 passes" lists 2. |
| F-26 | R27 #52 | ui | "Tomorrow night" is now + 24 h, off by a calendar day across a DST transition. |
| F-27 | R27 #52 | ui | The readiness stamp drops the zone, so with no zone it shows an unlabelled UTC time. |
| F-28 | R27 #52 | ui | Spanish "Sin conexión hasta <date>" reads as "no connection until" and opens like the opposite state. |
| F-29 | R28 #54 | ui | Picking a saved place does not reseed `CoordsInput`, so a later altitude edit re-emits the old place or wipes the observer. |
| F-30 | R28 #54 | ui | The update offer stays reachable under an open pass on wide because `inert` is applied only on compact. |
| F-31 | R28 #54 | ui | The `beforeinstallprompt` listener exists only while the shell is mounted, so a session that opens on `#live` never shows the install hint. |
| F-32 | R28 #54 | ui | `prompt()` has no catch, so a rejected prompt is an unhandled rejection. |
| F-33 | R28 #54 | ui | The "no panel on a first visit" e2e assertion runs before hydration and passes without the guard. |
| F-34 | R32 #51 | live | A same-document navigation to a shared `#live?lat=…` URL renders the current observer's sky at the link's instant and re-shares that. |
| F-35 | R32 #51 | chart | The dome's keep guard compares columns, rows, cell and font but not zoom, so a height-only resize keeps a stale zoom. |
| F-36 | R33 #55 | live | Playback resumes from the unclamped held instant, so a link with `t` before the span starts plays from outside the span. |
| F-37 | R33 #55 | live | The `60×` e2e locator also matches `600×` and `3600×`; the `60×` half of the test never runs. |
| F-38 | R33 #55 | live | Hour ticks, night bands and pass segments are recomputed on every frame while playing, with a fresh `Intl.DateTimeFormat` each time. |
| F-39 | R33 #55 | live | `preventDefault()` on pointer-down suppresses focus, so after clicking or dragging the stripe the arrow keys do nothing. |
| F-40 | R34 #57 | live | The follow-phone control is a dead toggle on the polar view (FR-LIVE-8 as amended). |
| F-41 | R34 #57 | live | A magnetic heading is used as a true-north azimuth; no declination is applied (FR-WIN-3, FR-LIVE-8 as amended). |
| F-42 | R34 #57 | live | Where `requestPermission` is absent the state goes to `on` and stays there when no reading ever arrives. |
| F-43 | R35 #56 | ui | The opener is captured after `inert` has blurred the focused card, so `Escape` never restores focus to the pass. |
| F-44 | R35 #56 | ui | `moveCursor` reports handled without confirming focus moved, so `j` / `k` swallow the key under the overlay or the sheet. |
| F-45 | R35 #56 | ui | `inert` misses the compact sheet's body-level portal, so `?` leaves the sheet's controls live under the overlay. |
| F-46 | R36 #58 | ui | The 60 capture tests run unconditionally in CI, about 8.5 min per PR, with no env gate (§4.21). |
| F-47 | R36 #58 | ui | The capture spec duplicates `liveHelpers.ts` helpers and drops the original's visibility check. |
| F-48 | R36 #58 | ui | Captures are shot at a run-dependent instant, so the time field and markers differ between runs. |
| F-49 | R36 #58 | ui | Seeded observers pair `source: 'coords'` with a real zone, a state the app never produces. |
| F-50 | R36 #58 | ui | The expected capture-set size hard-codes `* 4` instead of themes × locales. |
| F-51 | owner, R48 #74 | live | On wide the dome's raster fills its box to the edge: the extent, labels included, reaches the whole of the shorter side plus rounding (722 px in a 719 px box at 1920 × 1080), so the north row with its `N` label and the south row are clipped and the picture reads as larger than its box. |
| F-52 | owner, R48 #74 | live | On wide the rows around the dome stack: the view row and the hint above, the facing readout, the stripe, the playback row and the strip below, six rows plus gaps, so the dome box gets 719 px of a 1080 px viewport. FR-LIVE-7 as amended folds them to one row above and two below. |
| F-53 | R45 #70, measured 2026-09-06 | chart | The legend column beside the chart does not scroll and the box clips it: at 1280 × 800 it ends after the fifth pass and at 1920 × 1080 after the seventh, and the rest of the rows (6492 px of them on the fixtures) cannot be reached by pointer or keyboard. |
| F-54 | owner, v1.1 build | chart | On a desktop wider than 1920 px the dome's drawing is still larger than its box: the raster's extent with its labels exceeds the shorter side, so the outer rows and columns are cut and part of the picture cannot be seen. R54's ceiling is pinned only at 1280 × 800 and 1920 × 1080. |
| F-55 | owner, v1.1 build | live | On a phone the clock readout above the stripe overlaps the facing-and-tilt line under the drawing: the rows under the box ask for more height than portrait leaves them. |
| F-56 | owner, v1.1 build | live | A click on the stripe, or a reload of the live page, empties it: no arcs on the drawing, no segments on the stripe, a count of zero, and it stays empty until the home page searches again. |
| F-57 | R56 #87 | window | `groundClipPath` re-projects all 181 horizon points from scratch instead of reusing the `HORIZON.map(at)` array the horizon grid path already computed, doubling the projection work on every render while the ground state is shown. |
| F-58 | R56 #87 | window | `lookDirection` is computed twice per render, once for the look direction and again inside the ground-state test. |
| F-59 | owner, v1.2 build | live | On every desktop size the dome is about two thirds of the width of its box, with the rest of the width blank: the box is the page's whole width and the drawing, fixed at about 1.41 : 1 by the tilt, is sized from the box's shorter side, which is the height. Measured: 65 % at 1280 × 800, 66 % at 1920 × 1080, 68 % at 2560 × 1440, 69 % at 3840 × 2160. |
| F-60 | owner, R61 preview | chart | After a window resize the dome is drawn at the wrong scale until the page is reloaded — far too small, with its compass labels off the dome, after the window shrinks; zoomed in and clipped after it grows. The scene measures its cell once at mount and is rebuilt only when the column count changes, which is capped at 120 and never changes on a desktop, so the new font size is drawn through the old cell. Reproduced on main as well as on the R61 branch: 107 % of the box across at 1280 × 800 after 3840 × 2160, 100 % and clipped at 3840 after 1920. |
| F-61 | owner, R61 preview | chart | On every desktop the top of the bowl is cut off: above the far horizon only flat fragments of the meridians and the 30° and 60° rings show, against the box's top edge, where the whole outline of the bowl should be. The fit rule sized the drawing from the horizon ring and the zenith — 1.53 units tall at 45° — while the scene draws the bowl's silhouette a full radius above the observer, so on a height-bound box the raster cut 0.24 units off the top; and it centred the observer, not the drawing. Since R45 on every height-bound box, which is every desktop live page; never on a phone, whose box is width-bound. |
| F-62 | R59 #91 | chart | On a touch phone the live frame spends about 190 px above and below the drawing on furniture the page does not own — 96 px on the three-view control, whose tap targets take two rows at 390 px, and 96 px on the legend at D-187's four rows — so once R59's spacing has given all it can the box yields to 259 px at 390 × 844 and 82 px at 390 × 667, under FR-COMP-5's floor of 374. Cutting either one is what gives the floor back, and both are `chart`-lane changes. *Closed at 390 × 844 by R71 (#112; FR-LEG-7, D-386, D-387), and open at 390 × 667.* Both halves of the furniture are gone: the view control's second row went with PLAN D-358, and the legend is behind `[ list (n) ]` and rendered only while it is open. Measured on the branch with the list closed, on the box and not argued from the rows (`live-compact.spec.ts`, which fails on the old layout): **375 px at 390 × 844**, against the floor of 374 — the frame's own measured width, which is what `--chart-floor` is (D-187) — where it was 259; and **198 px at 390 × 667**, where it was 82. The 667 px phone is still 176 px under its floor, and no legend is left to cut: the rows the page must draw under the box — the readout, the strip's two lines, the clock, the overview row (FR-SPAN-2), the stripe's three rows, the stepping row and the actions — take more than the 293 px that height leaves over a 374 px box, so FR-COMP-5's own escape applies ("only where the gaps are at their minimum and the rows still do not fit does the box yield below its floor") and FR-LEG-8's "MUST hold at 390 × 667" does not hold as written. What is left of F-62 is that sentence, and it is the owner's to restate: either the floor is not a rule at 667 px, or a row that is on the page at that height has to go. |
| F-64 | R66 | ui | `moon.spec.ts`'s Now-panel test fails on `origin/main` as well as on this branch: the "Moon tonight" region does not contain the lore line it asserts. Found while running the suite for R66, reproduced on a worktree of `origin/main` at dd126f2, and not caused by anything in v1.3.1 — the lore line is chosen from the Moon's constellation, so a date-dependent fixture is the first place to look. No v1.3.1 task carries it. |
| F-63 | owner, R64 phone run | live | On a landscape phone the live drawing lies over the status strip and the stripe beside it. The compact box is full-bleed by negative side margins of one page padding each (R45, D-187), which assumes the pane it is in is the page's whole width; in the landscape-phone layout (D-173) the dome pane is only the left 2fr column, so the box comes out a whole page padding wider than its pane on each side. Measured on the R64 build at 844 × 390: the dome pane runs x 19 → 340 and the side column starts at 344, while `chart-box` runs 0 → 359 — 19 px off the left edge of the page and 15 px into the strip. The same at 740 × 360 (pane to 298, side from 302, box to 318) and at 932 × 430 (375, 379, 394). Since R45; never seen because the landscape layout's own tests measure the panes, which do not overlap, and not the drawing inside them. |
| F-65 | owner, 1.3.0 build (Chrome device mode, responsive frame) | live | On a wide viewport shorter than 500 px the live page takes the landscape phone's grid **tracks** and keeps the desktop's grid **areas**, so the whole page is drawn inside the left `2fr` column and the drawing collapses. `Live.module.css`'s `(orientation: landscape) and (max-height: 500px)` block sets `grid-template-columns: minmax(0, 2fr) minmax(0, 3fr)` with no mode selector, while `.page[data-compact='false'][data-columns='one']` sets the areas one-column and wins on specificity; the block's own comment states the assumption that fails — "the landscape phone (D-173) is compact and keeps its own two columns". Reproduced and measured on the 1.3.0 build before it was written down (V14-2). At 1200 × 450: the page is 1200 × 450 and every row of it 456 px wide at x 19; `live-top-row`, a one-line row, is 144 px tall; `chart-box` is 243 × **0**; `document.documentElement.scrollHeight` is 624 against an inner height of 450, so the page scrolls, against FR-LIVE-1; and the facing readout is set one character per line. The same at 1400 × 480 (`chart-box` 279 × 0, `scrollHeight` 576). Correct at 1200 × 700 (the desktop layout) and at 900 × 450 (a real compact landscape). Since R34 (PLAN D-173), and invisible to the suite because every test of the landscape layout runs at a compact width, where the rule is right. *Closed by R69 (#110; D-379):* every rule in the landscape block is `.page[data-compact='true']`'s, `tests/styles/liveShape.test.ts` fails on the old sheet, and `tests/e2e/shapes.spec.ts` walks FR-SHP-4. Measured on the branch at 1200 × 450: the page's rows are 1161 px wide, `chart-box` 262 × 219 with the rows folded (FR-SHP-3: the actions on the strip's line, every control's row one text row), the drawing 92 % of the box across, `scrollHeight` 450 against 450. FR-SHP-3's "486 × 405" at that size is not reachable with the time row and the stripe under the box — 450 less the padding, the top row and the frame's row leaves 405 for the box *and* the stripe together — and is a figure for the owner to restate. |
| F-66 | R72, the v1.4 release re-shoot | chart | One capture of the set is not deterministic: `v1-polar-390-night-es.png` comes out in either of two states, 142 pixels apart, inside the polar drawing (bounding box x 137–318, y 269–385 of 390 × 844). Measured on the 1.4.0 build by shooting `polar at 390 px` three times off one build and hashing the four files: the other three variants of that screen are byte-identical across all three runs, and the `dark`/`es` one alternates. So it is not the seeded instant F-48 fixed — that would move every variant — but something inside the drawing that only the Spanish dark picture is on the edge of, and 142 px is a glyph or two. What it costs is small and real: a release re-shoot of an unchanged screen shows one file changed, so the reviewer of the set has to tell that apart from a screen that moved, which is the whole point of the set being re-shot off one build (D-179). No v1.4 task carries it; a `chart`-lane finding for a later phase, like F-57 and F-62 before it. *(R80, the v2.0 re-shoot)* **It did not reproduce, and it is not closed.** The same measurement on the 2.0.0 build — `polar at 390 px` shot three times off the one build, the four files hashed after each run — comes out byte-identical in all four variants, the `dark`/`es` one included. All four `v1-polar-390-*.png` files do differ from the committed 1.4.1 ones, but so does every other screen with a header on it: v2.0 put the mark there (FR-MARK-4). So the row stays open with both measurements beside it. Three runs that agree are not a fix, nobody changed the code they would have to have changed, and F-70 is the same shape of defect turning up one screen over. *(R94)* **Measured again, still open, and the variant moves.** Two whole runs off one commit: `v1-polar-390-night-en` differed in one pair (146 pixels, at most 39 levels, in this row's own box x 137–318, y 269–385) and `v1-polar-390-night-es` in the next (9 pixels), while the final pair of runs had all four polar files identical. A fixed clock and a settled frame (PLAN D-611) did not remove it and neither did software compositing; `main`'s own spec shows the same on the same machine. It is anti-aliasing along the horizon circle, the same picture a fraction of a pixel apart, and no one variant alternates, so nothing leaves the set (FR-CAP-5's leave is for a variant). |
| F-67 | v2.0 breakdown, CI on PR #116 | ui | `PassList.test.tsx`'s "names the nights from the reader's own clock" reads the wall clock and is red for a whole calendar day at a time, on any branch: `nightLabel` has three branches (tonight, tomorrow night, the date) and the assertion had two, so on the day before the golden window's date — when the first night is "tomorrow" — it expects `Night of 2026-09-11` and the component correctly says `Tomorrow night`. Reproduced at 00:06 UTC on a branch with no `src/` change; the same test passed at 23:30 UTC. The component is right and the test was wrong. Closed by PR #116: the test pins `Date.now()` to the fixture's instant and asserts the three labels as literals (§9.3's determinism rule, applied to a test that had escaped it). |
| F-68 | R74 revisit, CI on PR #117 (2026-09-14) | ui | The hero card's choice reads the wall clock — `PassList.tsx` hands `nextFeaturedPass` a ticking `Date.now()`, not the store's `nowMs` — and the golden passes are dated, so from the calendar day their window ended every assertion on `iss-hero` went red on any branch: three tests in `App.test.tsx`, `App.wide.test.tsx` and `App.settings.test.tsx` that render the frame with the golden pass, and the two in `PassList.test.tsx` that promote it. Reproduced on untouched `main` the same day. The component is right and the tests were F-67's mistake again, one file over. Closed by PR #117: the four files pin `Date.now()` at the fixture's instant (§9.3's determinism rule), as F-67 did. Whether the hero should read the store's clock instead is open: the card counts down in real time by design. *(R88: the clause lapsed with the hero card; the list — its tag's choice, its nights' names and its pruning — reads the store's clock (D-579), and the `Date.now()` pins in `PassList.test.tsx` are gone. The countdown that reads the wall clock is `NextEventBlock`'s own.)* |
| F-69 | R80, the v2.0 release measurement | ui | The main chunk is over its budget on the shipping build: 158.0 KB gzipped against the 155 KB `scripts/bundle-budget.ts` enforces (PLAN §11), so every build of `main` from here prints a `::warning::`. The mark's share is measured and not estimated, which is what FR-MARK-6 asks the release task for: the same tree built with `Mark.tsx` stubbed to an empty box — importing neither `rasters.json` nor `useBead` nor `denseFrame` — measures 152.8 KB, so the component, the six body rasters and the 60 sparse bead frames per tier are **5.2 KB gzipped, 18.0 KB raw**. Without the mark the chunk is inside 155 with 2.2 KB to spare; with it, 3.0 KB over. It is not the whole cause: `main` grew 17.9 KB over the 1.4.0 build (140.1 → 158.0) and the mark is 5.2 of it, the rest being board 1B's home screen, the inverted settings page and the phase's copy in both catalogs, whose source alone grew 8.0 KB gzipped over the same span. PLAN §11's v2.0 paragraph decides what a release task may do about it — "a mark that does not fit inside main's 155 KB is a finding for the owner, not a budget raised by the task that spent it" — so the budget is unchanged and this row is the measurement. The choices are the owner's and each is a Decision Log row: raise main's enforced budget towards the 170 KB ceiling §11 already reserves, split something out of the shell behind a `React.lazy` (the settings page is the obvious candidate — one route, reached by a link), or shrink the mark (five tiers instead of six, or fewer than 60 bead frames). |
| F-70 | R80, the v2.0 release re-shoot | window | A second capture of the set is not deterministic, and it is not the one F-66 is about. `v1-sky-screen-chip-844-*.png` comes out in either of two states in two of its four variants: shot three times off the 2.0.0 build, `dark`/`en` and `night`/`es` are byte-identical across all three runs while `dark`/`es` and `night`/`en` alternate. The difference is small and inside the drawing, not in the chip or the gutter: 47 differing pixels in `night`/`en` and 52 in `dark`/`es`, both inside a box of x 481–562, y 221–289 of 844 × 390 — a glyph or two, the same shape of defect F-66 records in the polar chart. Not the azimuth sweep the capture's route does to find an empty field: a different facing would redraw the whole picture, not fifty pixels of it. It costs what F-66 costs (D-421): a release re-shoot of an unchanged screen shows a file changed, and the reviewer of the set has to tell that apart from a screen that moved. No v2.0 task carries it; `window`-lane code this task may not touch, so it goes in the register with its measurement and the committed file is the one the single run of record produced. *(R94)* **A cause found and fixed in the spec, a residue that is not the chip's.** The route that opens the sky screen polled with a 100 ms tick per iteration, so the sweep's instant was a property of the run (PLAN D-611); the routes now re-pin the instant after the sweep. After that, the chip differed once in `dark`/`en` (19 pixels, at most 7 levels, on the arc's edge at x 36–45, y 263–266) and in the final two whole runs all four chip files were identical, while the live page's `night` files at 1024, 1200 and 1280 and the legend at 1280 differed by 6 to 524 pixels of at most 116 levels — the rounded bar's corners and the stripe's hour labels, anti-aliased a fraction of a pixel apart. `main`'s own spec shows the same, so the row stays open with this measurement and the workflow's two runs (R100) are the reading of record. |
| F-71 | v2.1 audit (2026-09-21) | ui | The live page has no document structure: no `main`, no heading of any level, no `header`, `nav` or `footer`. `App.tsx` returns the live page in place of the shell that carries them. Every route has the same document title, and entering `#live` moves the focus nowhere. FR-A11Y-1, FR-A11Y-3, FR-A11Y-4. |
| F-72 | v2.1 audit | ui | The home's outline is flat: at 360 px one `h1`, 45 `h2`, no `h3`. A pass card's name has the rank of Where, When and What; a night is a `role="group"` with no heading. The wide header has no `nav`. FR-A11Y-1, FR-A11Y-2. |
| F-73 | v2.1 audit | ui | The cold open's placeholders read as values: `-38.93, -67.99` and `e.g. Cipolletti` in `--fg-dim` beside an altitude box holding a real `0`. Both widths, both languages. FR-FIRST-2. |
| F-74 | v2.1 audit | ui | The phone's first step is about 1180 px tall in an 844 px viewport: about 170 px of nothing under the coordinates, then `home.savedFoot`, then the full footer (7 lines in English, 8 in Spanish), which repeats the privacy promise. FR-FIRST-1. |
| F-75 | v2.1 audit | live | The cold open's header offers `[ live ]`, which opens a page that says only that there is no place. FR-FIRST-1. |
| F-76 | v2.1 audit | ui | Spanish breaks the header at 1024 × 768: `[ Cielo en vivo ]` drops to its own line outside the tagline's indent and the tagline wraps, the header grows about 48 px and the next-event block is cut at the footer rule. In English the line naming the satellite is already cut. FR-HOME-1, FR-HOME-2. |
| F-77 | v2.1 audit | ui | The cards are taller than FR-FIRST-10 draws them: `PassCard.tsx` adds `MoonAtPeak` under the cloud line (US-18 AC1, F-14), so with the Moon up every card is four lines and about three and a half fit at 1280 × 800. FR-FIRST-10, US-18 AC1. |
| F-78 | v2.1 audit | ui | The count line ends in a dangling ` ·` when `Sort:` wraps: a CSS `::after` on a wrapping flex row. Seen at 1280 and at 375. FR-FIRST-10. |
| F-79 | v2.1 walk (2026-09-21) | ui | At 1280 × 800 the Where pane overflows by 40 px (616 in 576) and scrolls; the saved-places line is below its fold. FR-HOME-3. |
| F-80 | v2.1 audit | e2e | The home captures are not the home: `v1-captures.spec.ts` closes every night, and the paused `page.clock` holds the `requestAnimationFrame` `WhereDome` waits for, so `v1-home-1024-*` and `v1-home-1280-*` show neither the dome nor an open night — and OQ-32 was closed citing them as the dome's pictures. The behaviour is right; the evidence is not. FR-CAP-1, FR-CAP-4. |
| F-81 | v2.1 audit | live | At 1200 × 450 the watching inventory's object list is cut mid-glyph on its third entry with no scroll affordance, and the three times on each row carry no labels. FR-CAP-5 carries the fix: the list clips on a row boundary with a `+n` line, and the row's times are labelled `rise`, `peak`, `end` in its accessible name and its header row. |
| F-82 | v2.1 audit | live | Spanish crowds the compact live rows: the action row ends at x ≈ 378 of 390 (338 in English) and Share lost its brackets to fit (PLAN D-411); at 360 px the top row shows 66 of the place's 135 px. FR-COMP-7. |
| F-83 | v2.1 audit | ui | `Instalar [ Instalar ]` on the settings page: the row's label repeats the button, in both languages. FR-SET-1. |
| F-84 | v2.1 walk | ui | On the phone's third step the first card is not a control and its pass is not in the list under it, so the next pass cannot be opened from the first run. FR-FIRST-3. |
| F-85 | v2.1 walk | ui | A card's control is its top 76 px of 150; the cloud and Moon lines are dead, and the cursor is `auto`. FR-FIRST-10 says the whole card. |
| F-86 | v2.1 walk | ui | A typed coordinate pair is saved at its first valid keystroke but the step moves on only on blur or `Enter`; nothing on the screen offers either. FR-FIRST-2. |
| F-87 | v2.1 flow reading | data | No failure has a retry. The forecast is requested on a place change and never again in a session; failed elements wait for the 15-minute recheck; a failed pass job waits for a reload. FR-FAIL-1..3. |
| F-88 | v2.1 flow reading | worker | The worker client has no `error` or `messageerror` listener and the app no error boundary: a worker that dies leaves "Computing…" and a spinning bead for ever, and a render error is a blank page. FR-FAIL-4, FR-FAIL-5. |
| F-89 | v2.1 flow reading | data | A shared link's place is stored over the reader's own — label and time zone replaced by rounded coordinates and null — with no notice and no way back unless the place was a favourite. The spec never decided it (PLAN D-135 did). FR-VISIT-1, FR-VISIT-2. |
| F-90 | v2.1 flow reading | ui | "Tonight" is a 24 h block from the instant of the computation (`nightGroups.ts`), so a run made at 01:00 files that morning's 05:00 pass and the same evening's 21:00 pass together; ended passes stay as cards and in the count; a stored run of any age is shown as `done`. FR-NIGHT-1..4. |
| F-91 | v2.1 flow reading | ui | Opening a pass, the live page or settings pushes a history entry and closing them replaces the state, so each open-and-close leaves a second home entry and Back does nothing once per visit. FR-ROUTE-1. |
| F-92 | v2.1 flow reading | live | The live page's inert text is the same for loading and failed, flashes on every cold `#live` load, and with no network and a stored run contradicts FR-OFF-8. FR-LIVE-1, FR-FAIL-6. |
| F-93 | v2.1 flow reading | ui | Links fail silently: a live link with a past `t` opens held at now; a link with an unreadable value lands on the reader's own home; a pass link pasted into a running tab for another place has its hash cleared, where a pasted live link is adopted. FR-VISIT-3, FR-VISIT-4, FR-SHARE-3. |
| F-94 | v2.1 flow reading | window | On a touch device whose orientation API never sends an event the sky screen stays armed with nothing said; an iOS denial is remembered for the session and the note offers no way to ask again. FR-FAIL-7. |
| F-95 | v2.1 flow reading | ui | The settings page's install button is spent by one press: the prompt is latched as dismissed whatever the answer and the held event is never cleared, so after a cancelled dialog it stays and does nothing. FR-FAIL-8. |
| F-96 | v2.1 flow reading | ui | Raw internals reach the reader — `HTTP 429`, `code: message` — inside localized sentences, and an error string already shown keeps its old language after a switch. FR-FAIL-2. |
| F-97 | v2.1 audit, **not confirmed** | ui | In an emulated 375 px pane, scrolling the first step blanked the top of the page above the form. Possibly the pane's own artefact. To be checked on a phone in the release run (RELEASE); no task until it is seen there. |
| F-98 | R96 axe run | chart | The dome's horizon-tick and 30°/60° ring degree labels are text drawn in `--chart-rings` — a non-text token, 3:1 by design — at `opacity: 0.8` (`SkyDome.module.css` `.degree`), so they measure 2.7 : 1 in dark and 2.53 : 1 in night, under AA's 4.5 : 1 for 9 px text, on `#live` in both states and on the desk guide. `axe.spec.ts` excuses `color-contrast` on those nodes only, naming this row. FR-X-5, FR-A11Y-7. |
| F-99 | R100, the v2.1 release re-shoot | live | The capture set is not deterministic on the live page's clocks, and this is not F-66's anti-aliasing. Two whole runs of the 254 off one commit (a ten-core Mac, 2.3 min each) differ in 38 files. About half are R94's sub-pixel edges (at most 2 levels). The rest are **the shown instant one second apart**: the scrubbing clock reads `03:55:45` in one run and `03:55:46` in the other (seen in `live-scrubbing-390-*-es`), and the watching countdown reads `se pone en 1:06` against `1:07` (seen in `legend-360-*-es`). The other files that differ at full contrast differ in boxes of the same size and place — `live-scrubbing` at 360, 768, 1024, 1200, 1920, 2560 and 3840, `live-watching` at 390, 768, 844, 1024, 1200 and 1920 — and were not opened one by one. `liveAt` in `v1-captures.spec.ts` re-pins the clock after the dome's wait (F-48, `pinnedAt`), but the assertion after it reads only `hh:mm:s`, so a one-second drift passes. The likely cause is a 1 s interval — the next-event countdown (`NEXT_EVENT_TICK_MS`) and the instant `[ scrub ]` holds — whose phase is set by how many ticks the dome's wait took, not by the pin. Measured by the release task, not fixed there: the fix is in `live` code or in the spec's pin, and the release may change neither. FR-CAP-5. |
| F-100 | R100, the v2.1 release re-shoot | ui | Every live capture now shows a focus ring round the back control (`[ ← Back ]` wide, `[ ← ]` on compact): R92 moves the focus there on entering `#live` (FR-A11Y-3), and with no pointer or key yet pressed Chromium draws it as `:focus-visible`. At 390 px the ring's box is taller than the control and crosses the `A continuación` line under it, and at 1200 × 450 it crosses `View:`. A tap into `#live` on a phone may draw no ring at all, so this is first a question for the owner's run (`docs/RELEASE.md` §13.4): whether the ring is drawn, and whether it covers the row under it. FR-A11Y-3. |
| F-101 | P8, the v2.2.1 release re-shoot | ui | With a geocoded place saved, the saved-places row on a phone gives the label most of the line and squeezes the mark beside it: in `v1-favourites-390-*` and `v1-settings-390-*` `[ Bariloche, Rio Negro, Argentina ]` wraps to two lines, and `(in use)` and `[ × ]` each break over two more in columns a word wide, where the coordinate label the set was shot with before fitted on one line. `v1-favourites-390-*` also shows the Altitude field at `0` under an empty coordinates box while the observer is the geocoder's 839 m, which may be the box's own value and is a question before it is a defect. Left, per D-656. FR-COMP-2, FR-LOC-4. |
| F-103 | R128, the v2.5 release re-shoot | chart | On a phone the dome drew the box it mounted in, not the box it had. The landmark line (FR-SKY-11) arrives with the `stars` chunk and takes 23 px from the compact box (PLAN D-838); when the chunk landed after the dome had mounted, the drawing kept the taller box's projection — two local runs of `v1-live-watching-{360,390,768}` differed by about 5,000 pixels inside the dome, and a reader opening the live page cold saw the taller drawing. `SkyDome.tsx` remounted a layer's scene on a change of columns or font size (D-316, F-60) and a box that changes height alone moves only the rows, which glyphcss takes as an option without re-projecting. The same stale projection drew the compact live page's dome through the watching box after the scrubbing block took its height (`v1-legend-{360,390}`, `v1-live-scrubbing-{360,390,768}`). Fixed in R128: the key carries the rows; `dome-resize.spec.ts` holds a 390 px box shortened by height alone to a fresh load's rasters (PLAN D-830). F-102 is the P8 branch's. FR-DOME-1, FR-CAP-5. |

The NaN facing loop from R34 (#57) was fixed on main before the merge and is not listed.

**Status register *(v2.1, V21-17)*.**
The table has no status column and is not given one; this paragraph is the register, and a release's preparation task brings it up to date.
**Closed:** F-1..F-56 (the v1.1 findings tasks), F-57 and F-58 (R68), F-59..F-61 (R61), F-63 (R66), F-64 (R67 — the row's last sentence, "No v1.3.1 task carries it", is superseded), F-65 (R69; its "486 × 405" is superseded by what `shapes.spec.ts` measures, FR-SHP-3), F-67 (#116), F-68 (#117; the hero card it concerned is no longer drawn, so its open clause lapses).
**Closed by this phase's decisions, each with a task:** F-62 (FR-COMP-5 restated, V21-14), F-66 and F-70 (FR-CAP-5, V21-15), F-69 (the settings page as a lazy chunk, §5.10, V21-13).
**Closed by this phase's tasks *(checked by R95 against the merges; re-checked by R100, which closes the phase's list: every one of F-71..F-96 is below)*:** F-89 (R83, #134); F-73, F-77, F-78, F-84, F-85 and F-86 (R84, #133); F-81 and F-82 (R85, #135); F-87 (R86, #137); F-74 and F-93 (R87, #138); F-90 (R88, #141, which also closed F-68's open clause: the list reads the store's clock, PLAN D-579); F-75 and F-92 (R89, #140); F-94 (R90, #136); F-83, F-88, F-95 and F-96 (R91, #144); F-71, F-72 and F-91 (R92, #145); F-76 and F-79 (R93, #147); F-80 (R94, #151); F-62 (R95, #152).
**Open, this phase, though a decision above names them:** F-66 and F-70 (R94 measured them and closed neither, PLAN D-611; R100's two `captures.yml` runs are the reading of record).
**Closed *(v2.3)*:** F-98 (R109: the degree labels drawn in `--chart-compass` at full opacity, the axe exception removed, FR-DS-5 and PLAN D-708; the two sentences below that leave it open are superseded).
**Open, waiting on a phone:** F-97.
*(R100, the v2.1 release)* **Left open at the release, each with its reason.**
**F-69:** *closed at the release gate by the owner (V21-24, #154)*: main measures **166.6 KB** on the 2.1.0 build, and the budget is raised to 170, D-178's rule capped at the §11 ceiling (PLAN D-641).
That leaves 3.4 KB.
D-609's breakdown (React 59, zod 24, the store and data layer 20, the guide 10, …) is still the way down when the next phase needs room.
**F-66 and F-70:** the drawing-lane anti-aliasing R94 measured is not a variant that alternates, so nothing leaves the set by FR-CAP-5; the release's two local runs (PLAN D-639) saw both again — `sky-screen-chip-844-night-es` 146 pixels of at most 14 levels in F-70's own box (x 450–565, y 221–289), `polar-360-night-es` 41 pixels of at most 45 inside the polar drawing — beside F-99, which is a different defect; the two `captures.yml` runs on the release commit stay the reading of record — the owner closes both rows on two byte-identical runs, or keeps them with the files that differed.
**F-98:** `chart`-lane code no v2.1 task may touch.
**F-99 and F-100** were found by the release's re-shoot and fixed in it at the owner's word (V21-24, #154, PLAN D-642).
F-99: `pinnedAt` fires the page's timers once at the pinned instant, so two runs of the final set differ in 7 files: 3 to 6 pixels of at most 2 levels on the live and legend pages, and 3 to 19 pixels of at most 7 in `sky-screen-chip-844`, F-70's own screen.
That is F-66/F-70's anti-aliasing, not the clock.
F-100: Back's ring is drawn round its text line, not its tap box. §13.4's phone look still stands for F-100.
**F-97:** not confirmed until the owner's phone run, `docs/RELEASE.md` §13.1's last item.
*(v2.5, R128)* **F-103** was found by the v2.5 release's re-shoot and fixed in it (PLAN D-830): closed.

### 4.21 CI time *(v1.1)*

- **FR-CI-1** A pull request's CI MUST finish within `CI_PR_BUDGET_MIN` (default 10 min wall time, a constant in the workflow) and the job fails when it does not, so the PR that made CI slower is the one that shows it.
  The budget is the job's `timeout-minutes`; a separate step prints the wall time of each stage (typecheck, lint, unit, build, e2e) in the job summary.
  *(amended v2.0.3, V20-24)* The budget is what the reader waits for — the wall time from the run starting to the last required check finishing — and not the machine time the run spends.
  The e2e stage MAY therefore be split across parallel jobs, each shard carrying its own `timeout-minutes` and its own stage times, and the reader's wait is the slowest shard rather than their sum.
  Two things hold the old rule's purpose: the number of shards is a constant in the workflow beside the budget, so making CI slower still shows up as a raised number in a PR; and a single shard's wall time MUST stay inside the budget, so a run that has to be split further is a defect to fix, not a budget to raise.
  *(amended 2026-11-02, the owner's call, PLAN D-1031)* A pull request runs the tests its change reaches, not the whole suite: the unit tests whose imports reach a changed file plus every test that reads the repository by path, and the whole e2e suite when anything the build reads changed (only the changed specs otherwise).
  A change to the package files, a build, test, type or lint config, the workflows, `public/_headers` or the test setup, support and fixtures runs everything, as does the `full-ci` label and every push to `main`.
  Typecheck, lint, `check:dead` and the trailer check run on every pull request.
- **FR-CI-2** The capture set (D-179) does not run on pull requests.
  It runs behind an env flag, like the perf spec's `DOME_PERF=1`, on every push to `main` and on `workflow_dispatch`; a PR that changes a screen ships its own captures through the `visual-review` skill as before.
  The main-branch run commits nothing: it uploads the captures as a workflow artefact and fails when the set is incomplete (the `captures.test.ts` check keeps running in unit tests against the committed files).
- **FR-CI-3** The e2e suite on a PR runs in one Playwright worker per available core with the browser reused, and no spec waits on a full 72 h search unless it tests the search: specs that only need a rendered page use the stored-run fixture path.
  Any spec longer than 60 s on CI is a defect to fix, not a budget to raise.

---

### 5.8 v1.1 additions *(proposal; the plan decides)*

- **Flags.**
  One module (`lib/flags.ts`) reads `import.meta.env.VITE_MOON_LORE` and exports a typed constant; the lore component is behind a dynamic import in the `on` branch so the data file is tree-shaken when off.
- **Settings route.**
  `#settings` joins the hash router (D-13); a `Settings` screen composes the existing location, favourites, language and theme components; the header gets a compact variant.
  No new state.
- **Legend.**
  A pure module derives legend rows (key, colour token, name, times, state) from `SkyChartProps` plus the FR-TRAJ-1 states; one `Legend` component serves all three views; the dome and polar label drawers drop their text labels and draw the key at the peak.
- **Sky window.**
  `skychart/window/`: a pure projection module (azimuth/altitude and a device rotation to x/y within the field of view), an orientation hook that extends the compass-follow hook with pitch and roll, and an SVG component.
  The spike lives under `spike/window/` beside the dome spike.
- **Follow screen** *(v1.3)*.
  `ui/components/live/FollowScreen.tsx`: a fixed layer the live page renders in place of its grid while following, holding the window in a chromeless frame with the readout and the legend as overlays and the close control; the portrait note is the window's own state beside the ground ones.
  The store's view override (v1.2) is the switch; nothing new is saved.
- **Trajectories.**
  A pure module takes a pass and `t` and returns its FR-TRAJ-1 state and the cut track; the chart props carry that state per pass so the three views draw the same thing.
- **Stripe.**
  The existing stripe component is re-laid out to three rows with the readout above it; the stepping control is added after the spike.
- **True north.**
  `geomagnetism` 0.2.0 (Apache-2.0), installed 2026-09-05 on the spec branch so it is in the lockfile before the wave that needs it (task sessions have no network, the R25 precedent); declination computed once per observer in `lib/` and applied in `compassHeading.ts`.
  Measured at 6.2 KB gzipped for the whole package, under OQ-20's 15 KB rule (PLAN D-185).
- **Findings.**
  One findings task per lane in the first wave (V11-11); each fix names its F-number in the commit and adds the test that fails on the old code.
- **CI.**
  The workflow gains a wall-time step and the 10 min budget; the capture spec is gated by `CAPTURES=1`, run by a second workflow on pushes to `main` and on dispatch that uploads an artefact.

### Phase 2b — v1.1 ("phone pass", as decided 2026-09-05, V11-1)

After the `v1.0.0` tag.
Still no backend; the same two providers.

- Feature flag: the Moon lore line off by default (§4.15).
- Compact layout: a one-row header, a settings page for language, theme and location, a one-line location summary on the home screen, control rows that fit, the chart full-bleed and at least square (§4.16); the wide header re-aligned with the live link beside the title (FR-DESK-2).
- Chart legend: names, times and captions leave the drawings for a colour-keyed list; the detail table is the legend there (§4.17).
- Sky window: a third view that shows the sky in the direction the phone points, fixed by a spike that is the **first task of the phase** and also settles the stripe's touch stepping (§4.18).
- Live trajectories: arcs appear, grow and fade with the shown instant; the stripe is re-laid out with readable hours and a clock readout (§4.19).
- The v1 findings: the fifty open review findings closed, one findings task per lane in the first wave (§4.20); true-north headings; the mid-width desktop guide fixed with a 1024 px profile.
- CI time: a 10 min budget on pull requests, the capture set moved to `main` and on-demand runs (§4.21).
  This lands first, because every task of the phase pays for it.
- The install offer stops being a one-shot latch: "Not now" snoozes it, 7 days then 30, and only the third decline is final (FR-OFF-6 as amended, V11-15), and the settings page carries the offer with no decline beside it (V11-16).

Definition of done:
- US-20..US-23 accepted; FR-FLAG-1..2, FR-COMP-1..6, FR-LEG-1..5, FR-WIN-1..7, FR-TRAJ-1..5, FR-FIX-1..2, FR-CI-1..3 met; the amended US-5 AC2, FR-GUIDE-2b, FR-GUIDE-7, FR-DESK-2, FR-DESK-3, FR-DESK-5, FR-DOME-1, FR-DOME-4, FR-DOME-6, FR-LIVE-2, FR-LIVE-4, FR-LIVE-6, FR-LIVE-7, FR-LIVE-8, FR-MOON-4 met.
- Every finding F-1..F-53 is closed, recorded as already fixed, or moved to Phase 3 by a Decision Log row; none is silently open.
- The amended FR-OFF-6 and US-16 AC4 are met: the snooze survives a reload, expires on its own, the third decline is the latch, and the settings page installs the app after the hint is done.
- The v1 definition of done still holds: golden tests, headers, the FR-GUIDE-6 and FR-LIVE-5 rates on the reference device, the D-179 capture set extended with the settings page, the legend, the window and the 1024 px profile, re-shot in both languages and themes on `main`, and the bundle budgets re-set by the D-178 rule.
- The owner has approved the compact mockups (FR-COMP-6) and the spike findings (FR-WIN-7) before the tasks behind them ran.
- `package.json` version 1.1.0, a `v1.1.0` tag, and the release checklist run on the deploy.
