# v2.6 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 4.48 The phone flow *(v2.6)*

v2.4 and v2.5 put a whole sky behind every view, and on a phone each new control went where it fitted in 36 cells rather than where a reader looks for it.
The audit of 2026-10-27 read the 2.5.0 capture set at 390 × 844 (the design canvas https://claude.ai/artifact/T9sDydFaRQNAMy5zVcSi7q, findings F1–F14 below) and found the same four faults on every page: the answer sits under status lines, the stars have no front door, the three sky views lay out the same parts in different orders, and the gaps follow no rule.
It covers compact (FR-DESK-1's breakpoint and under) and wide alike (V26-9): the wide audit read the same pages at 1280 × 800 (findings D1–D10) and found the same faults spread wider — a header that changes per page, the controls of one drawing at opposite corners, drawings that stop short of their space.
Where a requirement says *on compact* or *on wide* it binds that layout only; otherwise it binds both.

The audit's findings, kept here so each requirement can name the one it closes:

| ID | Page | Finding at 390 × 844 |
|---|---|---|
| F1 | home | The only compact entry to the stars is "Stars tonight · [ look up ]" inside When, above the night bar; the words name neither the page nor what it does. |
| F2 | home | Six lines of Where status sit above the next pass; `[ Open the live sky ]` lands at y ≈ 700. |
| F3 | live, pass detail | The view row wraps: `[ ] Polar [ ] Dome [x] Window` fills the line and `[x] stars` drops alone below it, read as a fourth view. |
| F4 | live | The dome's box leaves about 100 px blank above the bowl and 90 px below it; the stripe and the actions are pushed to the fold. |
| F5 | live, pass detail | The window's hand hint is drawn over the drawing and names the arrow keys on a phone. |
| F6 | live, stars | The facing picker is above the drawing and the readout below it on the live page, the other way round on the stars page. |
| F7 | stars | No page name: the header is the home's ("Your sky"), there is no back control and no visible heading. |
| F8 | stars | `[ hold up to the sky ]`, the page's one phone action, comes after four layer toggles; `In this field` starts at y ≈ 773. |
| F9 | stars | The layer rows sit 48 px apart: the gap inside a group is larger than the gap to the next section. |
| F10 | pass detail | The language and theme switches open the page; the countdown is its fifth line and the chart is off the first screen. |
| F11 | pass detail | The landmark line comes before the date and the countdown and reads as a subtitle. |
| F12 | every view | Two readouts for one idea: "Facing N (0°) · tilt 45°" on the dome, "Looking S (180°) · up 35°" on the window. |
| F13 | every page | Compass points about 39 × 22 px and toggles 20 px tall: under 44 px. |
| F14 | every view | Tap-to-name, pinch zoom and following a pass are never shown on a phone. |

And at 1280 × 800:

| ID | Page | Finding at 1280 × 800 |
|---|---|---|
| D1 | home | The next pass sits mid-height in the middle pane; the eye starts at the place and a large inert dome. |
| D2 | home | The stars are a header link only; nothing on the home says what they are or that tonight is good for them. |
| D3 | every page | The header changes per page (title and tagline on the home and the stars page, `[ ← Back ]` and the place on the live page), and the language and theme switches take its right half. |
| D4 | stars | No page name, and the header's `[ stars ]` is drawn dim: the current page looks like a disabled link. |
| D5 | live, stars | The drawing stops at y ≈ 625–660 and leaves 140–175 px blank under it while the rail runs past the fold. |
| D6 | live | `View:` is at the box's top-left, `Facing:` mid-rail, `[x] stars` alone beside Share at the rail's foot: three corners for one drawing. |
| D7 | live, pass detail | The hand hint is drawn over the drawing and over its labels. |
| D8 | pass detail | The window is 420 × 270 inside an 820 × 575 panel, and the panel's head has no countdown and no times. |
| D9 | live | The legend prints three bare times ("07:23:47 GMT-3 07:23:55 GMT-3 07:27:03 GMT-3 · up") with no rise, peak or set. |
| D10 | every view | "Looking S" in the box under a rail heading "Facing" (F12 on wide). |

- **FR-FLOW-1** *(V26-2, V26-3)* **Three doors.**
  On compact, with an observer and after the first visit (FR-FIRST-4's steps are unchanged), the home is, under the header: the Where reading in two lines (FR-FLOW-2); then **three doors** in this fixed order; then the When and What readings as they are today, less what the doors now carry.
  A door is one link, the whole of a box ruled in `--rule` (FR-FIRST-10's box), full width, at least 44 px tall, holding a title line in `--fg` and one or two answer lines at `--small`, every line within 34 cells in both languages (FR-COMP-4): *(amended v2.10, V210-6)* On compact the doors come first and the Where reading after them (FR-PHONE-12); the third door is "Live sky" with a second line of its own (FR-PHONE-13).
  *(amended v2.11, V211-11)* On wide the doors take FR-CLEAN-16's form: pane-sized titles, body-sized lines, control frames, the accent on hover and focus.
  - **Satellites** / **Satélites** — the next event of FR-FIRST-3: "Next 05:48 · in 48:04" and "Tiangong · NE 11° → ENE", or "Up now · peaks in 0:08" while a pass is up.
    It opens that pass's detail (`#pass/…`), which already carries its countdown, its landmark (FR-SKY-11) and a chart facing its peak (FR-SKY-7).
    With no visible pass in the 72 h span it reads "No visible pass in 72 h" and opens the What reading in place.
  - **Stars** / **Estrellas** — the dark window and the cloud word, "Dark 20:25 → 07:05 · Clear" (*(amended 2026-11-02, the owner's call, PLAN D-1028)* "Dark, clear 02:00 → 07:05" on a night that clears at 02:00, "Dark 20:25 → 07:05 · Variable" on one that changes more than once, FR-WX-4), and "Brightest now: Canopus, S": the brightest star or planet that FR-SKY-3's twilight step draws above the horizon at now, with its 16-point direction; while the Sun is above 0° the second line is "Stars from 20:25".
    The second line is computed in the `stars` chunk (FR-SKY-10) once it has loaded, prefetched on idle; its height is reserved from the first paint so nothing below it moves.
    It opens `#stars`.
    *(amended v2.6.1, V26-17; before: the second line was "Stars from" the dark band's start, and "No dark sky tonight" with no dark band)* With no dark band tonight (the Sun stays above −12°, as it does above about 54.5° N near the June solstice) the second line names the start of tonight's bright-twilight band instead (the Sun below −6°, where FR-STAR-13 draws every rung); "No dark sky tonight" / its Spanish line stands only when tonight has neither band.
    *Verification:* the doorLines test for a night with a bright-twilight band and no dark band, and for one with neither.
  - **Both · live sky** / **Ambos · cielo en vivo** — "1 up now, beside Mintaka" (the passes up now and, when there is a highlighted pass, its landmark star) or "Nothing up now · next 05:48".
    It opens `#live` with the saved `starsLayer`.

  The When reading's first line ("Stars tonight · [ look up ]", FR-STAR-3) and the next-event block with `[ Open the live sky ]` leave the compact home, since the doors are both.
  The header keeps `[ live ]` and `[ settings ]` (FR-COMP-1).
  **On wide** the same three doors stand in one row of three equal boxes under the header, spanning the three panes' width (FR-FIRST-5), each with one more line than on compact (the Satellites door the landmark line, the Stars door the Moon and its set time, the Both door "Stars under the arcs, drag to look"); under them the three panes as today, less the next-event block (in the Satellites door) and less the Where pane's dome (FR-FIRST-11), whose job — a sky, now, a link to `#live` — the Both door does.
  Between FR-DESK-1's breakpoint and the three-pane width the doors are one row over FR-DESK-2's two columns.
  Closes F1, F2, D1, D2.
  *Verification:* a component test asserts the three doors' order, each door's lines for an up-now pass, a later pass, no pass, daylight, and the stars chunk not yet loaded (reserved height, no second line); `controlRows.test.ts` fits every door line in 34 cells in both languages; an e2e test at 390 × 844 asserts the three doors' bottom edge at or above 600 px and each door's target, and at 1280 × 800 the three doors in one row above the panes and no dome in the Where pane.
- **FR-FLOW-2** *(V26-2)* **Where in two lines.**
  On compact the populated Where reading (FR-FIRST-11) is two lines: the place in `--fg` with `[ change ]` at the row's right end, and at `--small` in `--fg-dim` "Ready offline · elements 4 d old · [ details ]".
  `[ details ]` opens in place, in FR-FIRST-11's order, the observer's sentence, the readiness line with its date, the elements line with its own details, and the saved places.
  A fault is never folded: a not-ready state (FR-OFF-4), an elements warning (FR-SAT-4) or a failure (§4.36) shows its full line in the second line's place.
  Wide is unchanged.
  *Verification:* a component test for the folded and opened states and for each fault; the e2e home capture.
  *(amended v2.10, V210-6)* A ready second line is `[ details ]` alone, under the place at the row's right end; a fault keeps its full line (FR-PHONE-12).
  *(amended 2026-11-02, the owner's call, PLAN D-1024)* The Where reading has one control: `[ change ]` on the place line.
  There is no `[ details ]` and, while the state is ready, no second line.
  `[ change ]` opens the FR-FIRST-2 group with, at its top and above the inputs, in FR-FIRST-11's order, the observer's sentence, the readiness line with its date, the elements line with its own `[ details ]`, and the saved places.
  A fault (a not-ready state, an elements warning, a failure with its `[ retry ]`) still shows its full line under the place at all times, open or closed, with no `[ details ]` on it.
  This replaces the folded line's `[ details ]` and the panel it opened under the place.
- **FR-FLOW-3** *(V26-4)* **Every other page names itself.**
  On compact the live page, the stars page, the pass detail and the settings page share one top row: `[ ← ]` (FR-COMP-7's control, Back by §4.37's rule), the page's name in the accent (`live`, `stars`, `pass`, `settings` and their catalog Spanish), then the place, or the pass's date on the pass detail, in `--fg-dim`, cut with an ellipsis to the row's 36 cells.
  The stars page shows a visible `h1`, "Stars tonight" / "Estrellas esta noche", with the dark window and the cloud word under it at `--small`.
  **On wide** every page has one header row: on a sub-page `[ ← ]` first; the mark and the title; the page links `home`, `live`, `stars` (`inicio`, `en vivo`, `estrellas`), the current one in `--fg` with a 2 px accent rule under it and `aria-current="page"`, the others in the accent; on a sub-page the place in `--fg-dim`; and `[ settings ]` at the row's right end.
  The language and theme switches leave the wide header for the settings page, as on compact (FR-COMP-2, V26-10); the tagline stays on the home only, under the header row.
  Closes F7, D3, D4.
  *Verification:* the header test for the four pages in both languages; `controlRows.test.ts`; the page's `h1` in the outline test (F-72's).
  *(amended v2.8, V28-3)* On the compact live page the top row is FR-FULL-2's head over the box: `[ ← ]` and the shown time, the page's name and the place visually hidden in the `h1` (the place is also in the sheet's head).
  *(amended v2.11, V211-3)* On the compact stars page and pass detail the top row is FR-CLEAN-2's head over the box: `[ ← ]` and one line, the page's name and the place visually hidden in the `h1` (the place is in the sheet's head), as the live page has had since v2.8.
  *(amended v2.11, V211-9)* On wide the three page links are `[ home ] [ live ] [ stars ]`, `BracketLink`s with the current page in the dim `current` form; the accent rule under the current one goes (FR-CLEAN-14).
- **FR-FLOW-4** *(V26-5)* **One order for every sky view.**
  On compact the live page (every view), the stars page and the pass detail lay out, top to bottom: the top row (FR-FLOW-3); the page's answer (the live page's headline block with its landmark line; the stars page's `h1`; the pass detail's FR-FLOW-7 head); the view row, on the live page and the pass detail; the readout; the drawing; the facing picker; the hint (FR-FLOW-6); the page's primary action; the layer rows; then the page's list, stripe or prose.
  The **view row** is one line: the view control drawn as a `ToggleGroup` with the chosen view in brackets and the others plain (`Polar Dome [Window]`, as the facing picker draws its points), and `[x] stars` at the row's right end — 30 cells in English and 35 in Spanish (`Polar Domo [Ventana]  [x] estrellas`).
  The readout sits directly above the drawing and the picker directly under it, `--space-1` from each.
  **On wide** the box is the left column and the rail the right (FR-SKY-2, FR-STAR-3), and the rail holds the same parts in the same order: the answer; the `View` row (the view control and `[x] stars` on one line, on the live page and the pass detail); the `Facing` row; the `Layers` rows on the stars page; the legend or `In this field`; the conditions; and, at the rail's foot, the stripe and the actions.
  The readout and the zoom's `+`/`−` stay on the box's top corners (V25-17, FR-SKY-14).
  Closes F3, F6, D6.
  *Verification:* an e2e test at 390 × 844 and at 1280 × 800 asserts the order by bounding boxes on the three pages, each view, and both languages, and that the view row is one line.
  *(amended v2.8, V28-2, V28-4)* The compact live page no longer lays its parts out in this column: the drawing is the screen (FR-FULL-1) and the other slots are in FR-FULL-4's sheet.
  The stars page and the pass detail keep this order.
  *(amended v2.9, V29-9)* The view row lists the window first: `[Window] Polar Dome  [x] stars` (FR-GYRO-11).
  *(amended v2.11, V211-4)* The compact stars page and pass detail no longer lay their parts out in this column either: the drawing is the screen (FR-CLEAN-1) and the other slots are in FR-CLEAN-4's and FR-CLEAN-5's sheets.
  Wide keeps this order in its rail.
- **FR-FLOW-5** *(V26-5)* **One readout.**
  Every readout of where a view faces begins with the same word: "Facing" / "Hacia".
  The window and the stars page read "Facing S (180°) · up 35°" / "Hacia el S (180°) · 35° de altura" (the stars page keeps its field width after it, FR-SKY-14); the dome keeps "· tilt 45°", since its tilt is the camera's angle on the bowl and not a direction in the sky.
  This is the phase's one change that reaches wide captures.
  Closes F12.
  *Verification:* the strings' snapshot; the readout tests of the window, the stars page and the dome.
  *(amended v2.6.1, V26-18; before: "the stars page keeps its field width after it")* The stars page's readout is the window's: the field width follows it only while the field is zoomed away from `WINDOW_FOV` (FR-SKY-14, " · field 30°"), as shipped in 2.6.0 and drawn on the handoff's boards; the unzoomed page reads "Facing S (180°) · up 35°" with nothing after it.
  The never-rendered `starsPage.readout` string is removed (FR-FLOW-17).
- **FR-FLOW-6** *(V26-5)* **The hint, under the drawing and in the reader's terms.**
  The hand hint (`window.handHint`) leaves the drawing and becomes one line at `--small` in `--fg-dim` under the facing picker, worded by the pointer: coarse — "Drag to look · pinch to zoom · tap a star" / "Arrastrá para mirar · pellizcá para acercar · tocá una estrella"; fine — "Drag or use the arrow keys · ctrl + wheel to zoom · click a star".
  On the live page with a highlighted pass the coarse line ends "· tap A to follow" (FR-SKY-13).
  On wide the line sits under the box, the width of the box.
  The line shows until the reader's first drag, pinch or tap on any sky view and is then gone for good, saved in the prefs as `skyHintSeen`.
  Closes F5, F14, D7.
  *Verification:* a component test for both pointers, the follow clause and the pref; an e2e test that no hint text intersects the drawing's box.
  *(amended v2.8, V28-3)* On the compact live page, which has nothing under the drawing, the line stands over the box's bottom-left on `--screen-overlay` beside or above `[ controls ]` (FR-FULL-3), where it covers the sky's edge and not the middle F5 was about.
  *(amended v2.10, V210-4)* The coarse line is two clauses, the star clause dropped, and with a highlighted pass the follow clause takes the zoom clause's place (FR-PHONE-5).
- **FR-FLOW-7** *(V26-6)* **The pass detail leads with the countdown.**
  On compact the pass detail's head is, in order: the pass's name as the `h1`; the countdown line ("Leaves shadow in 5:00") in the accent at the headline size; the landmark line (FR-SKY-11); the rise, peak and set times as one row of three cells, the peak with its altitude and direction; then the view row and the drawing (FR-FLOW-4); the prose description and the table of points after the drawing.
  The language and theme switches leave the pass detail on compact: they live on the settings page (FR-COMP-2).
  At 390 × 844 the drawing's top edge is at or above `DETAIL_DRAWING_TOP_PX` (480 px) in both languages, so the chart is on the first screen.
  **On wide** the guide panel (FR-DESK-3) has the same head in one band — the name, the countdown and the landmark line on the left, the three times on the right, the close control at the end — then the view control, `[x] stars` and the facing picker on one line, then the drawing at the panel's full width and the rest of its height, at least `DETAIL_DRAWING_MIN_SHARE` (0.6) of the panel's area at 1280 × 800; the prose and the table of points follow under the drawing.
  Closes F10, F11, D8.
  *Verification:* the component test's order; an e2e bounding-box test at 390 × 844 in both languages.
  *(amended v2.10, V210-6)* On compact the three time cells are one row at `--small` and the zone is the head's date line's (FR-PHONE-14); the drawing's top edge is asserted at 390 × 667 as well.
  *(amended v2.11, V211-3, V211-4)* On compact the head is FR-CLEAN-2's: the countdown at the headline size with the name as its chip over the sky; the name with the date and the zone, the landmark line and the times row are the sheet's first groups (FR-CLEAN-5); `DETAIL_DRAWING_TOP_PX` stops binding compact and leaves `lib/layout.ts`.
  Wide's band is unchanged.
- **FR-FLOW-8** *(V26-5)* **The stars page's action comes first.**
  On compact the stars page's primary action, `[ hold up to the sky ]`, is a full-width button at least 48 px tall directly after the hint; the layer toggles follow as one group of two rows (`[x] stars [x] figures [x] planets`, `[x] names [ ] passes`) `--space-1` apart; then `In this field`.
  At 390 × 844 the heading of `In this field` and its first row are inside the viewport.
  Closes F8, F9.
  *Verification:* an e2e bounding-box test at 390 × 844 in both languages, with `[ passes ]` off and on.
  *(amended v2.10, V210-5)* The stars page has a view row, `[Window] Whole sky`, between the `h1` block and the readout (FR-PHONE-7); the action slot keeps `[ follow the phone ]`.
  *(amended v2.10, V210-17; before: the heading of `In this field` and its first row inside the viewport)* With the view row (54 px) and the box at FR-COMP-5's floor, the heading of `In this field` is inside the viewport at 390 × 844 and its first row within one row's height under the fold, in both languages (R160 measured the first row's end 28.5 px and 52.5 px under the fold); `sky-layout.spec.ts` pins it.
  *(amended v2.11, V211-4; withdrawn for compact)* The stars page has no compact column: the layer rows and `In this field` are the sheet's groups (FR-CLEAN-4), and the fold rule of V210-17 goes with the column.
  Wide is unchanged.
- **FR-FLOW-9** *(V26-7)* **The dome's box fits the bowl on compact.**
  On compact the dome's box is cut from the bowl's drawn silhouette as FR-LIVE-7's rail rule cuts it on wide (F-61's divisor), so the blank between the view row and the bowl's highest drawn cell, and between the bowl's lowest drawn cell and the readout, are each at most `DOME_COMPACT_SLACK_PX` (24 px, one `--space-3`) at 390 × 844 at the opening tilt.
  FR-LIVE-7's floors still hold (V25-18's 280 px while watching).
  **On wide** the box runs from under the header to the hint line at the viewport's foot for every view, so no band under the drawing is taller than `--space-3` at 1280 × 800 on the live page and the stars page.
  Closes F4, D5.
  *Verification:* an e2e test reads the bowl's drawn extent from the scene's measured box and asserts both gaps.
  *(amended v2.8, V28-2; before: the compact live page's dome box was cut from the bowl too)* On the compact live page the box is the screen (FR-FULL-1) and the bowl is drawn inside it at the largest size that fits; the cut and its slack hold for the pass detail.
  *(amended v2.11, V211-4)* On the compact pass detail the box is the screen too (FR-CLEAN-1) and the bowl is drawn inside it at the largest size that fits; the cut and `DOME_COMPACT_SLACK_PX` are withdrawn for compact and leave `lib/layout.ts`.
  Wide's rule stands.
- **FR-FLOW-10** *(V26-7)* **Three gaps.**
  On compact every vertical gap between blocks of a page is one of three of the design system's tokens (§4.45): `--space-1` between rows of one control group (layer rows, the readout and the drawing, the drawing and the picker, the picker and the hint), `--space-3` between groups, `--space-5` between sections (Where, the doors, When, What; `In this field`).
  A gap inside a group is never larger than a gap between groups.
  *Verification:* `rhythm.spec.ts` at 390 × 844 measures the gaps between the marked blocks of the home, the live page, the stars page, the pass detail and the settings page in both languages and fails on any other value (± 1 px).
  *(The plan decides how blocks and groups are marked.)* *(amended v2.6.1, V26-19; before: the live page and the pass detail were measured in the dome only)* The live page and the pass detail are measured in both views a phone can open on: the window (a fresh profile, FR-FLOW-14) and the dome (a saved `chartView`).
  A slot of FR-FLOW-4 that holds nothing (the dome's empty `picker`) takes no gap, so the drawing and the hint are `--space-1` apart in both views and `rhythm.spec.ts` lists no known exception.
- **FR-FLOW-11** *(V26-7)* **Targets a thumb can hit.**
  On compact every control's hit area is at least 44 × 44 px (WCAG 2.5.5, target size (enhanced), Apple's guideline), grown by padding so no row's cell count changes (FR-COMP-4).
  A row of options too dense for 44 px each — the facing picker's ten points in 350 px — meets it as a row: each item at least 44 px tall and the items' hit areas meeting with no gap, so every point of the row is a target.
  Inline links in running text are exempt.
  Closes F13.
  *Verification:* `targets.spec.ts` at 390 × 844 enumerates the interactive elements of the five pages and the sky screen and asserts the rule.
  *(amended v2.6.1, V26-19)* `targets.spec.ts` measures the live page and the pass detail in the window as well as the dome, the facing picker's row included.
- **FR-FLOW-14** *(V26-11)* **The window first on a phone.**
  In the compact mode (both shapes), a reader with no saved chart view (FR-WIN-5's `chartView` unset) gets the window on the live page and the pass detail, under the hand camera (FR-STAR-4), until the sensor's first reading on the screen.
  It opens facing the pass.
  On the live page it follows the highlighted pass as the `A` key does (FR-SKY-13: the readout says `Following A`); with no highlighted pass it faces the next pass's rise point at a tilt of `clamp(alt − 15°, 20°, 75°)`; with no pass in the span it faces the default point of today's window (the pole's opposite, at FR-WIN-1's opening tilt).
  On the pass detail it faces the peak (FR-SKY-7, unchanged).
  Choosing Dome or Polar saves it in `chartView` on compact as on wide, and a saved view wins on every later visit.
  On wide the dome stays the default (V25-1).
  Closes the gap between the stars layer and the view a phone opens on.
  *Verification:* a component test of the default for no pref, each saved view, and each of the three facing cases; `sky-layout.spec.ts` asserts the window at 390 × 844 for a fresh profile and the dome at 1280 × 800.
  *(amended v2.6.1, V26-16; before: the facing was chosen once, when the window first drew)* When the window draws before the passes are known (a cold load of `#live`: the window chunk resolves before the worker's passes), it faces the default point and, when the passes arrive, turns once to the facing this rule gives for them — unless the reader has moved the camera by then (a drag, a key, a zoom or the facing picker), which always wins.
  It never turns again on later pass updates.
  *Verification:* a component test that mounts the window with no passes, then passes with a highlighted one, and asserts `Following A`; and one that moves the camera first and asserts it stays.
- **FR-FLOW-15** *(V26-12)* **Upright and turned.**
  Every page works in both shapes of the compact mode (FR-SHP-1): portrait, and the landscape phone (wider than tall, at most 500 px high).
  In the landscape shape the live page, the stars page and the pass detail lay out as wide does, but small.
  The drawing takes the left at the viewport's full height and at least `LANDSCAPE_DRAWING_MIN_SHARE` (0.55) of its width.
  The rest of FR-FLOW-4's slots stand in their order in a rail on the right, which scrolls on its own while the page does not (FR-LIVE-1).
  The home and the settings page stay one column and scroll.
  Turning the phone changes the layout only.
  The view, the camera's facing, tilt and field, the shown instant, playback and any open disclosure are kept, and the sky screen still opens only from `[ hold up to the sky ]` (FR-STAR-5, FR-FSC-10 unchanged), never from the turn.
  FR-SHP-4's invariants hold for the three pages at 844 × 390 and 667 × 375.
  *Verification:* `sky-layout.spec.ts` at 844 × 390 and 667 × 375 asserts the drawing's share, the rail's order and no page scroll on the three pages, and turns 390 × 844 → 844 × 390 → 390 × 844 asserting the camera state and `t` unchanged and no screen opened.
  *(amended v2.8, V28-4)* The live page in the landscape shape is all sky too: the drawing fills the viewport and the rail is FR-FULL-4's side sheet, `SHEET_SIDE_SHARE` wide, opened by `[ controls ]`; the stars page and the pass detail keep the left drawing and the right rail.
  *(amended v2.11, V211-4)* The stars page and the pass detail in the landscape shape are all sky too, with FR-GYRO-7's bottom sheet (FR-CLEAN-7); the left-drawing-and-right-rail arrangement has no compact page left and is withdrawn for compact.
  The turn's invariants stand.
- **FR-FLOW-16** *(v2.6.1, V26-19)* **The capture specs run.**
  Every spec under `tests/e2e/` that `CAPTURES=1` runs waits only for elements the current pages draw: no wait names a test id v2.6 removed (`where-dome`).
  Closes the review's B3.
  *Verification:* `tests/docs/captures.test.ts` (or a test beside it) reads every `getByTestId('…')` in the capture specs and fails on one that no file under `src/` renders; the `r76` and `r84` capture specs run green with `CAPTURES=1` at 390 and 1280 px.
- **FR-FLOW-17** *(v2.6.1, V26-15)* **Nothing v2.6 left behind.**
  What v2.6 stopped using is removed: message keys with no reader outside `src/i18n` (`stars.tonight`, `stars.lookUp`, `starsPage.readout`, and the stars page's heading kept once), props no caller passes (`LanguageToggle`'s `className`), parameters that are always the same value (the legend inventory's `headerRows`), and constants imported only as a switch (`boxAspect: DOME_BOX_ASPECT`); and every comment that names a removed part (`← Back`, `windowBox`, `WhereDome`, the times header) or the wrong file or property is corrected.
  No visible change: the 2.6.0 capture set is unchanged by it.
  *Verification:* `npm run check:dead` green; the messages snapshot loses only the removed keys; FR-CAP-5's diff against 2.6.0 lists only FR-FLOW-1's and FR-FLOW-10's files.
- **FR-FLOW-12** *(V26-1)* **Strings, chunks, captures.**
  Every new string is in the catalog in English and Spanish (FR-I18N-*).
  The doors, the folded Where and the hint are the `main` chunk's, within `FLOW_MAIN_KB` (1.5 KB gzipped over `v2.5.0`'s measure); the brightest-now line is the `stars` chunk's and it does not grow by more than 0.5 KB; no other row moves, and the release re-sets every row by D-178.
  The phase's named moves are the home (compact and wide), every header, the sky views' order, view row, hint and box at every width, the pass detail's head and panel, the stars page's order, the legend's times, and the readout's word; the settings page, the sky screen and the first-visit steps are byte-identical.
  The capture set gains the home's doors at 360, 390, 1280 and 1920 px (a later pass, up now, no pass, daylight), the folded and opened Where, and the live page, the stars page and the pass detail at 844 × 390, in both themes and languages; the phone's live captures show the window (FR-FLOW-14), a named move.
  *(amended v2.6, V26-14)* The release measured `main` 177.5 KB, +4.6 KB over `v2.5.0` (R133's `ChartFrame` import of the dome camera taken back out first), `stars` +0.8 KB, `astronomy` +1.5 KB (R130's moon times), `window` +0.9 KB, `settings` +0.1 KB, and `chart` +2.4 KB once the build moved the dome's geometry out of the shared `camera` chunk into the dome's; the owner accepted those as the phase's growth, in place of the allowances above, and the release re-set the rows to them: `main` 180 with its §11 ceiling, `chart` 110 and `astronomy` 30 by D-178.
  The settings page is not byte-identical either: it moves by the header (FR-FLOW-3, D-856) and by FR-FLOW-10's group gaps (R134, D-870), and by nothing else.
  `live-window`'s 360 and 390 px files are retired: since FR-FLOW-14 the phone's `live-watching` files are that picture, FR-SKY-9's window in the box at 390 px on the live page.
- **FR-FLOW-13** *(V26-9, V26-13)* **The legend's times are named.**
  A pass's legend row (FR-LEG-3) writes its times with their words, "rise 07:23:47 · peak 07:23:55 · end 07:27:03" / "sale … · máximo … · termina …", on its second line under the name and state, on wide and on compact.
  The last word is "end" and not "set": a pass often ends by fading into Earth's shadow, not at the horizon (V26-13).
  Closes D9.
  *Verification:* the legend's component test in both languages.
  *(amended v2.6.1, V26-18; before: "on wide and on compact" with no exception)* Two rows keep rise and end alone, as shipped: the short wide inventory, whose one line never wraps (D-863), and the pass detail's dim rows (FR-LEG-3).
  Every other legend row names all three.


### 5.14 v2.6 additions *(proposal; the plan decides)*

- A home doors component for compact, reading the next event the home already computes and, from the `stars` chunk once loaded, one `brightestNow(scene)` over the scene's drawn stars and planets (FR-FLOW-1).
- One compact top row for the four sub-pages (FR-FLOW-3) and one compact sky-view layout that the live page, the stars page and the pass detail fill in by slot (FR-FLOW-4), so the order is one component's and not three pages'.
- `skyHintSeen` in the prefs schema (FR-FLOW-6); `DETAIL_DRAWING_TOP_PX`, `DOME_COMPACT_SLACK_PX` and `FLOW_MAIN_KB` beside the other layout constants.
- Two e2e specs, `rhythm.spec.ts` and `targets.spec.ts`, that read bounding boxes at 390 × 844 (FR-FLOW-10, FR-FLOW-11).

### Phase 2n — v2.6 ("the phone flow", as decided 2026-10-27, V26-1)

After v2.5 is on `main`.
Compact and wide: the audit of 2026-10-27 at 390 × 844 and 1280 × 800 (§4.48, F1–F14, D1–D10).
Every task merges on CI green and a clean review with no owner gate, as v2.5's did (V26-8); the owner's look — the capture set at 390 px in both themes, and one evening on the phone from the home's doors to a pass watched with the stars on — is read at the release preparation, and the tag and the deploy are the owner's.

- The home's doors and the two-line Where (FR-FLOW-1, FR-FLOW-2; FR-COMP-3, FR-FIRST-3, FR-FIRST-11, FR-STAR-3 as amended).
- The compact top row on every sub-page and the stars page's heading (FR-FLOW-3).
- One order for the three sky views, the one-line view row, one readout word, the hint under the drawing (FR-FLOW-4, FR-FLOW-5, FR-FLOW-6).
- The pass detail's head and the stars page's order (FR-FLOW-7, FR-FLOW-8).
- The dome's compact box, the three gaps and the 44 px targets, each with its e2e measure (FR-FLOW-9, FR-FLOW-10, FR-FLOW-11).
- The wide header, the wide sky views' rail order and full-height box, the wide pass panel, the legend's named times (FR-FLOW-3, FR-FLOW-4, FR-FLOW-7, FR-FLOW-9, FR-FLOW-13 on wide).
- The window first on a phone, and the landscape phone's layout for the three sky pages (FR-FLOW-14, FR-FLOW-15).
- Release preparation (FR-FLOW-12): the captures, the budgets, the release notes.

Definition of done:
- FR-FLOW-1..15 met, each by its verification line.
- The settings page, the sky screen and the first-visit steps byte-identical to `v2.5.0`'s captures; FR-CAP-5's two runs agree.
- `controlRows.test.ts`, `rhythm.spec.ts` and `targets.spec.ts` green in both languages.
- The owner has gone from the home's Satellites door to a watched pass, and from the Stars door to the sky screen, on the release build on a phone, and through the three doors at a desk; and has turned the phone on the live page while a pass was followed.
