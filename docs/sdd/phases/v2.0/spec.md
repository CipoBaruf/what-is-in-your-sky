# v2.0 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.8 Goals (v2.0, "the redesign")

- **G22. The page says which data matters.**
  A place first, then when it is dark, then what crosses; once a place is set the next pass is a countdown before anything else, on a phone and at a desk alike, and the two layouts organise the same facts in the same order.
- **G23. The app has a mark.**
  One drawing, made the way the dome is made, that is the icon, the favicon, the header and the cold open, and that moves while the app is loading or live.
- **G24. Watching is not operating.**
  At night, one-handed, the live page is the drawing and the next event; the stripe, the steps and the speeds come out when asked for and go away when done, and nothing the page could do is gone.
- **G25. The screen says which way to turn.**
  On the sky screen the bottom edge is a compass: where I face, what I can see of it, where each pass is, and, with nothing in front of me, which pass is off the edge and how far to turn.
- **G26. Settings is what its name says.**
  The page is for changing a preference, opens on the row anyone returns for, and fits a phone without scrolling; a first visit never lands on it.

---

**US-26 — Set up in three readings** *(v2.0)*
As a first-time visitor, I answer where I am, then read when it is dark and what crosses, in that order, and the answer I came for is the first thing on the page once a place is set.
- AC1: With no place set, the page shows the mark, the tagline, the step line, one primary action `[ Use my location ]` with the place and coordinate fields as alternatives, and the two notes at the foot of the group; no list, no Now panel and no pass banner is rendered (FR-FIRST-1, FR-FIRST-2).
  *(amended v2.1, V21-4, V21-5)* No field on it looks filled before the reader fills it, and at 390 × 844 the whole of it, footer included, is one screen.
  *(amended v2.0.2, V20-15, V20-17)* No mark and no tagline: on a phone the page is the step line, the question and its sentence, the group and its two notes; on a wide page it is the three panes with Where active and When and What dimmed (FR-FIRST-1).
- AC2: Once a place is set, the first block after the location reading is the next pass as a countdown — name, next event, direction and the time to it — with its peak direction, peak altitude and brightness under it; the list follows (FR-FIRST-3).
  *(amended v2.0.2, V20-18)* The next pass is the next-event block of FR-FIRST-3 as amended — a ticking countdown, the clock time and the path — and it follows tonight's stripe and the conditions table in the When reading.
- AC3: On a phone the three readings stack in the order where, when, what, and the location reading collapses to one line with `[ change ]` that opens the form in place, not on another page (FR-FIRST-4).
  *(amended v2.0.2, V20-16)* On the first visit they are three steps, one screen each, advanced by the reader; every later visit opens on the three stacked (FR-FIRST-4).
- AC4: On a wide page from `HOME_THREE_PANE_MIN_CELLS` the three readings are three equal panes, Where, When and What, and a pass I open takes the place of the first two while the list stays in the third (FR-FIRST-5).
  *(amended v2.0.2, V20-15)* Each pane holds what board 1B draws: Where the place and a dome of the sky now, When the stripe, the table and the next event, What the one-line cards (FR-FIRST-5).
- AC5: The settings page is not where I am sent to set a place (FR-SET-3).
- AC6 *(v2.0.2, V20-15)*: Every pass card is one line of time and name and one line of duration, peak and brightness, with the cloud word where a forecast covers it; the next ISS pass is tagged in the list rather than drawn as a card of its own (FR-FIRST-10).
  *(amended v2.1, V21-3, V21-16)* The card has no Moon sentence (US-18 AC1), and the whole of its box opens the pass.
- AC7 *(v2.1, V21-16)*: Every step of the phone's first run has a visible control that moves it on: a pair I typed offers `[ continue ]` as soon as it parses, and the first card of the third step opens that pass's guide like any other card (FR-FIRST-2, FR-FIRST-3).

**US-27 — Watch the live sky, then scrub it** *(v2.0)*
As a user on the live page at night, I see the drawing and what happens next, and I bring the time controls out only when I want to move time.
- AC1: At real time the page shows the next event as its headline (`ISS rises NW in 4:12`), the drawing at every row it can take, one line of conditions and the 24 h overview; the stripe, the step row and the speeds are not rendered (FR-WATCH-2, FR-WATCH-3, FR-WATCH-4).
- AC2: `[ scrub ]`, a click or a drag on the overview, or a link that carries an instant, hold the shown instant and reveal the stripe, the step row and the playback row; `[ back to live ]` puts them away and returns to real time (FR-WATCH-1).
- AC3: While scrubbing the headline is the held instant and its offset from now (`21:47 · +33 min`) (FR-WATCH-2).
- AC4: The mark beside the state word runs while the page is real time and stands still while an instant is held, and the word `live` or `held` is beside it (FR-MARK-5).
- AC5: On a window too short for the box's floor the controls come up over the bottom of the drawing, and the drawing's box is the same height in both states (FR-WATCH-6).
- AC6: Nothing the live page could do before is gone: hidden objects, the list, share, every speed, every step, every view (FR-WATCH-4).
- AC7 *(v2.1, V21-21)*: While watching, with the next pass more than two minutes away, one control on the headline takes the page to that pass's rise, held; `[ now ]` brings it back (FR-JUMP-1, FR-JUMP-2).

**US-28 — Know which way to turn** *(v2.0)*
As a user holding the phone up, the bottom edge tells me where I am facing, which part of it I can see, where each pass is and, when nothing is in front of me, where to turn.
- AC1: A 28 px gutter along the bottom edge carries the 180° of azimuth centred on my facing with the compass names on it, and a bracket showing my field of view (FR-GUT-1, FR-GUT-2, FR-GUT-3).
- AC2: Every drawn pass is a tick on the gutter at its bearing, in its colour, with its key under it when it is on the band but outside my field (FR-GUT-4).
- AC3: A pass off the band is a marker at the nearer end of the gutter with its key and the angle to turn (`A 110° ▶`) (FR-GUT-5).
- AC4: With no pass in the field, one line over the drawing names the next pass, how far to turn and when it rises (FR-GUT-6).
- AC5: Held upright I get the countdown above a band of sky, two legend rows under it and the gutter at the bottom; the advice to turn is a line of secondary copy under the countdown, not a note over the picture (FR-GUT-7).
- AC6: The drawing is 68 px taller than it was, at 390 × 844 and at 844 × 390 (FR-GUT-1).

**US-29 — Change a setting without scrolling** *(v2.0)*
As a phone user, I open settings on the row I came back for and see the whole page.
- AC1: `#settings` opens on Location, then Saved places, then one group, This browser, with language, theme and install (FR-SET-1).
- AC2: At 390 × 844 the page fits the viewport in both languages with the privacy line at its foot — with no observer, and with an observer and two saved places (FR-SET-2).
- AC3: A first visit never lands on `#settings`; the location step is on the home screen (FR-SET-3).

### 4.28 The first run *(v2.0)*

The design phase's diagnosis of the home screen: the page does not say which data matters, and the two layouts organise it differently for no reason a reader can see.
On wide the place field, the coordinate field and the device button sit at equal weight; on compact none of them exists, the home is one line that sends the reader to `#settings` (FR-COMP-3, D-184), and the settings page puts language and theme above the thing they came for (§4.32).
Once a place is set, the Now panel's summary and the list's status line both precede anything an observer can act on.

Three directions were drawn (`redesign/captures/turn-1-first-run-directions.png`, boards 1A–1C) and the owner chose **three readings** (V20-2): *where → when → what*, a sequence that on a wide page *becomes* the three panes of the page, so the setup teaches the layout.
The artboards are the visual reference the way `docs/mockups/` is for FR-COMP-6; they are not tracked in the tree (V20-11), so every number and string a task needs is in this section.

*(v2.0.2, V20-15)* On R76's gate the owner compared the captures with board 1B and asked for the board: v2.0 had kept every component of the home whole (the old FR-FIRST-6) and taken the cold open's hero mark from board 1A, so the panes were the old page re-cut rather than the drawing.
The requirements below are rewritten to the board, each with its v2.0 rule in one clause; board 1B's numbers are now in the text, and where the text and the board still disagree the text wins.

- **FR-FIRST-1** The cold open.
  With no observer the home page renders, after the header and before the footer, exactly this and nothing else.
  **Compact** (FR-FIRST-4's first step): the step line `[01] where ── 02 when ── 03 what` at `--small`, the current step bracketed and in the accent, the others in `--fg-dim`, the rules between them in `--rule`; the heading "Where will you be looking from?" at 22 px on a 28 px line; one sentence half a rem under it at `--small` ("A pass looks the same from anywhere within a few kilometres, so city-level is enough.
  Pick any one."); the input group of FR-FIRST-2 in its `boxed` look; and, ruled off in `--rule` at the foot of the screen — the cold open is one screen tall — "Saved in this browser only.
  No account, no tracking." (`home.savedFoot`).
  **Wide:** the three panes of FR-FIRST-5; `Where` is active — its heading `── [01] Where ──` in the accent with the trailing rule in `--rule` — and holds the question at 20 px on a 26 px line, with no sentence, the group in its `plain` look, and at its foot the precision note (US-1 AC4, `location.precisionNote`: "Precision is city-level: a pass looks the same from anywhere within a few kilometres." / "La precisión es a nivel de ciudad: un pase se ve igual desde cualquier punto a unos pocos kilómetros."); `When` and `What` are drawn in `--fg-dim` under muted headings (`── 02 When ──`, `── 03 What ──`) as what they will hold — `When` "When is it dark enough?" at the question's size, a placeholder of FR-FIRST-8's stripe in `--rule` and "The dark band for your place, with tonight's cloud and moon in it."; `What` "What crosses, and where to look" and one ruled placeholder card, "Each pass as a card: time, direction, how high it climbs, how bright it gets." The two dimmed panes are `aria-hidden` and hold no control; between the wide breakpoint and `HOME_THREE_PANE_MIN_CELLS` they stand where FR-DESK-2 puts When and What.
  The board's sizes and spacing are the contract (V20-23): body text 16 px on a 24 px line; the second size (`--small`) 14 px on 20 — labels, notes, the step line and every sentence under a heading; the cold open and the phone's steps put 1.2 rem (19 px) between blocks and half a rem from a question to its sentence; the populated panes put 0.75 rem (12 px) between blocks.
  No Now panel, no readiness line, no list and no elements banner: those are about a place, and there is none.
  *(amended v2.0.2, V20-15, V20-17, V20-22, V20-23; was: the `hero` mark at 120 / 140 px, centred, the tagline under it on compact, the group in one centred column on wide, and both notes under the group in every layout, the precision note in a longer form that repeated the sentence under the question)* *(amended v2.1, V21-5, V21-6)* **"One screen tall" counts the footer.**
  At 390 × 844, in both languages, the header, the step and the footer fit the viewport with no scroll; at 360 × 640 at most the footer is below the fold.
  To make that so, on the phone's first-run steps (FR-FIRST-4) the footer takes the wide page's one-line form — `Data: CelesTrak, Open-Meteo.com, GeoNames (CC BY 4.0) · Made by <owner>`, wrapping to two lines, every credit and link kept (PLAN D-120) — and its privacy sentence is not drawn, because `home.savedFoot` says it four lines higher; the step has no empty block between its last field and its foot note.
  Every later visit keeps the full compact footer.
  **`[ live ]` with no place is not a dead end:** the link stays in the header (FR-COMP-1, FR-DESK-2, FR-FIRST-6), and the live page with no observer reads "The live sky needs a place." with one control, `[ set a place ]`, that opens the home page's where step with the focus in the input group; the same when `#live` is opened cold from a bookmark.
  *Verification:* an e2e at 390 × 844 and 360 × 640 in both languages asserts `document.documentElement.scrollHeight` against the viewport on the where step, the footer's form and the absence of the second privacy sentence; an e2e follows `[ live ]` from the cold open and back.
  *(was: "the cold open is one screen tall" with the footer unmentioned — about 1180 px in an 844 px viewport, F-74; the live page with no observer a sentence and `[ ← Back ]`, F-75)*
- **FR-FIRST-2** One primary action.
  The input group is one column, in order: `[ Use my location ]` (US-3, `location.useMyLocation`) as the one primary action — one full-width button in the accent's border, the bracketed label in the accent at its left and its note under it at `--small` ("Fastest.
  Your browser asks first; nothing is sent anywhere."), 12 px by a cell inside on a phone and 16 by 12 px in the wide pane — then the place field (US-1) and the coordinate fields with altitude (US-2) as equal alternatives under it, 1.2 rem apart.
  Each alternative has one visible label at `--small` in `--fg-dim` ("Place name", "Coordinates (lat, lon)"), half a rem above a full-width field; the altitude stands beside the coordinates, a cell away, its unit inside its box after the value ("0 m") and its own label ("Altitude (m)") read by assistive technology rather than drawn.
  Two looks: `boxed` on a phone, each alternative in a box ruled in `--rule`, 12 px by a cell inside, the altitude 96 px wide; `plain` in the wide pane, no box, the altitude 80 px.
  The placeholders are the catalog's ("e.g. Cipolletti", "-38.93, -67.99").
  Where US-3 AC1 withholds the device button (no API, or not HTTPS), the place field takes the first position and nothing says a button is missing.
  A denial follows US-3 AC2 and leaves the alternatives usable.
  *Verification:* the component test asserts the document order of the three controls, the primary control's accessible name and its note, the look, and the look's one foot note after the last field (FR-FIRST-1); the e2e with a stubbed `geolocation` answers the primary action and asserts the page moves to the next step (compact) or the populated panes (wide) with no navigation.
  *(amended v2.0.2, V20-15, V20-23; was: the alternatives beside the primary action on wide, each field at the settings panel's width, and the altitude a labelled field of its own)* *(amended v2.1, V21-4, V21-16)* **No field looks filled.**
  The coordinate field's placeholder is the format, `lat, lon`, and its visible label carries the example instead of repeating the format: "Coordinates · e.g. -38.93, -67.99" (`location.coordsLabel`, the example at `--small` in `--fg-dim`).
  The place field keeps "e.g. Cipolletti", which its "e.g." already marks.
  The altitude box starts **empty** with the placeholder `0`; empty means 0 m, and a stored altitude other than 0 is shown as a value.
  **A typed pair has a way forward.**
  As soon as the pair parses, a `[ continue ]` control (`location.continue`) is drawn under the coordinate fields, in the accent, 48 px tall; it does what leaving the field and `Enter` already do (PLAN D-513), which both stay.
  It is not drawn for the other two ways in, which move the page on themselves.
  *Verification:* the component test asserts the three placeholders, the label, an empty altitude parsing as 0 and the control appearing and disappearing with the pair's validity; the catalog snapshot changes with them; the e2e types a pair, presses `[ continue ]` and asserts the when step.
  *(was: the placeholders the catalog's "e.g. Cipolletti" and "-38.93, -67.99" beside an altitude box holding `0` — a screen that looked answered, F-73; a typed pair advanced on blur or `Enter` only, with nothing on the screen saying so, F-86)*
- **FR-FIRST-3** The next event.
  Once a location is set, the When reading ends with the **next event** of the pass nearest in time in the stored run, ruled off above in `--rule` with 0.75 rem inside: the label line at `--small` in `--fg-dim` — `Next up · in 3:45:07` before a pass rises, `Up now · peaks in 1:10` between its start and its peak, `Up now · sets in 2:05` / `Up now · enters shadow in 2:05` between its peak and its end (the verb by FR-VIS-3's end reason) — whose countdown ticks once a second (`NEXT_EVENT_TICK_MS` = 1000, US-5 AC4) and is written `m:ss` under an hour and `h:mm:ss` above it (D-502); the event's clock time in the observer's zone, `21:14`, in the accent at 32 px on a 38 px line; the path line in `--fg`, `ISS · NW low → 68° N → SE` — the name, then the start (its compass point, and `low` where the pass rises at the elevation threshold or its altitude where it leaves Earth's shadow above it), the peak (altitude then compass point) and the end (its compass point, and its altitude where it enters shadow above the threshold); then, 0.75 rem below the block, `[ Open the live sky ]` (FR-LIVE-1).
  On the phone's third step (FR-FIRST-4) the same fact is the first card: `First up · in 12:34` at `--small`, then `21:14   ISS` in the accent at 20 px on a 26 px line, then the path with the duration (`NW low → 68° N → SE · 6 min`), then the brightness phrase with the magnitude (FR-GUIDE-3, `Brighter than Venus (-3.4)`) in `--warn`, in a box ruled in the accent.
  The event is the next of rise, peak and end for the pass whose next event is soonest, computed from the wall clock against the stored passes with no worker request (FR-DOME-5's rule).
  With no pass in the 72 h window the block says so in one line, with FR-LIVE-1's reasons where they apply (no darkness, no elements).
  The block is the live page's watching headline (FR-WATCH-2): one pure module, one component, two hosts.
  *Verification:* a pure-module test over a fixture run at instants before, during and after a pass pins the event, the label, the path and the countdown; a component test asserts the lines and the control in order, and the first-card form.
  *(amended v2.0.2, V20-18, V20-23; was: the first block after the location reading, as one headline sentence — `ISS rises NW in 4:12` — with the peak line under it)* *(amended v2.1, V21-16)* **The first card is a control.**
  On the phone's third step the first card opens its pass exactly as FR-FIRST-10's cards do — the whole box, the same accessible name form, the same sheet — since it is the one pass of the night the list under it leaves out.
  *Verification:* the component test asserts the control and its name; the first-run e2e opens the first card and asserts the guide for that pass.
  *(was: a `section` with no control, so the pass a new reader is likeliest to go out for could not be opened from the screen that announced it, F-84)* *(amended v2.6, V26-2, V26-9)* The next event is the Satellites door's answer (FR-FLOW-1) and leaves the When reading, on compact and on wide.
- **FR-FIRST-4** Three readings on compact: steps on the first visit, then stacked.
  *(amended v2.1, V21-5, V21-16: the first-run steps' footer is FR-FIRST-1's one-line form, and each step has a visible control that moves it on — FR-FIRST-2's `[ continue ]` on where, `[ See what crosses ]` on when.)* *(amended v2.12, D-1021: the third step is the choice of the three doors, not tonight's cards; the when step's control reads `[ Choose what to see ]`; was: "<Five> things cross tonight", a sentence, the first card, tonight's other cards and `[<n> more tonight]` `[<n> more nights]`.)* **The first visit** — a load with no observer — is three steps, one screen each, under the step line (FR-FIRST-1's, a finished step written `01 where ✓` in `--fg-dim`), each a heading at 22 px on 28 and a sentence at `--small` half a rem under it, then 1.2 rem between blocks: **where** is the cold open (FR-FIRST-1); once a place is set the page moves on to **when** — "When is it dark enough?", "<place>, tonight.
  Satellites are only lit in the dark band between dusk and dawn.", a box ruled in `--rule` holding tonight's stripe (FR-FIRST-8) and three rows (`Dark from` · `20:14`, `Until` · `05:31`, `Passes in it` · `5 tonight, 7 in 72 h`, the last value in the accent), a second ruled box holding `Clouds tonight` · the cloud word for the dark window in its colour (`--ok` for clear; *(amended 2026-11-02, the owner's call, PLAN D-1028)* read hour by hour, a night that changes once is two rows, `Until 02:00` · its word and `From 02:00` · its word, and one that changes more is `Variable`, FR-WX-4), `Moon` · `waxing crescent, 18 % lit`, and one sentence at `--small` — "A bright moon washes out the faint ones.
  Tonight it will not." or "… Tonight it will." by whether the Moon is up and at least `MOON_BRIGHT_PCT` (50 %) lit inside the dark window — and, at the foot of the screen, `[ See what crosses ]` as a full-width button in the accent's border; that control, `[ Choose what to see ]`, moves on to **what** — the choice: "What do you want to see?" and the home's three doors (FR-FLOW-1, FR-PHONE-13: Satellites, Stars, Live sky) as the stacked page draws them, Satellites opening the next pass or, with none to open, leaving the steps for the stacked page with its What reading open, Stars and Live sky their pages, and coming back from any of them being the stacked page; then, ruled off at the foot of the screen at `--small`, `<place> · dark 20:14–05:31 · clear [ edit ]`, whose `[ edit ]` returns to **where** with the group open.
  A finished step's item in the step line is a control that returns to it.
  The step is the page's own state, not a stored preference and not in the URL.
  **Every later visit** — a load with an observer — is the three readings stacked, each under its pane heading as FR-FIRST-5 draws them: **where** — FR-FIRST-11 without the dome; **when** — the stripe, the table (FR-FIRST-9) and the next-event block; **what** — the count and sort line and the cards grouped by night (FR-FIRST-10); then the footer.
  Every row keeps FR-COMP-4's 36 cells.
  This amends FR-COMP-3 and reverses D-184's first-run role for `#settings` (V20-5): the route and the page stay, and the header's `[ settings ]` still opens it, but nothing on the home screen sends a reader there to set a place.
  *(amended v2.0.2, V20-16, V20-23; was: the three readings stacked on every visit, When holding the next-event block, the dark window line, the Now panel, the cloud cover and the Moon line, and What the hero card, the sort row and the full cards)*
- **FR-FIRST-5** Three panes on wide.
  From `HOME_THREE_PANE_MIN_CELLS` (108 cells of content: three panes of 36 cells, the compact card's width, which is the least a pane can hold a pass card in; its pixel twin counts the two 3-cell gutters and one 2-cell shell padding by D-253's rule — 116 cells, about 1114 px at the 16 px base, so 1024 × 768 is under it and 1280 × 800 over it) the wide home is **three equal panes** under the header: `Where` (the location reading of FR-FIRST-4, the saved places, the readiness line, the banners), `When` (the next-event block, the dark window, the Now panel, the cloud cover, the Moon line) and `What` (the hero card, the sort row, the list), each with a character-rule heading (D-49) numbered like the step line (`[01] Where`, `02 When`, `03 What`).
  Between FR-DESK-1's wide breakpoint and that width the page is FR-DESK-2's two columns as they are today, with `Where` above `When` in the 40-cell left column and `What` at the right — the same three readings, two of them stacked.
  **An open pass** at three-pane widths takes the place of `Where` and `When` together — the guide panel of FR-DESK-3 in the first two panes' width, at least 72 cells, so its 40-cell floor holds everywhere — and `What` keeps the list with the selected card highlighted; `Esc` or the close control brings the two panes back.
  Under the three-pane width FR-DESK-3's rules stand unchanged (the guide takes the right column and `[ list ]` swaps back).
  The selection hash (D-13) is the same in every case.
  This amends FR-DESK-2 and FR-DESK-3.
  *Verification:* `tests/styles/breakpoint.test.ts` pins the constant and its pixel twin to the stylesheet literal as it pins `WIDE_SPLIT_MIN_PX`; a layout test at three widths (964, 1024 and 1280 px) asserts two columns, two columns and three panes; the e2e at 1280 × 800 opens a pass and asserts the guide's width is the first two panes' and the list is still in the document.
  *(amended v2.0.2, V20-15, V20-23)* The panes' widths, the literal, the two-column range and the open pass stand; their contents are board 1B's: `Where` is FR-FIRST-11; `When` is the stripe (FR-FIRST-8), the conditions table (FR-FIRST-9) and the next-event block (FR-FIRST-3); `What` is the count and sort line and the one-line cards grouped by night (FR-FIRST-10).
  Populated, a pane's heading is the plain word — `── Where ──`, `── When ──`, `── What ──`, the title in `--fg` and the rules in `--fg-dim` — the numbers being the cold open's and the steps', and a pane puts 0.75 rem between its blocks.
  The old components' inner headings (`Right now`, `Upcoming passes`) are not drawn.
- **FR-FIRST-6** Nothing is lost.
  Every fact the home page had has a place, and the table is the contract: the location inputs, the favourites and clear → Where; the readiness line and the elements banners → Where, one line each, the full text behind `[ details ]` (FR-FIRST-11); the Now panel → the When table's `Clouds now`, `Moon` and `Up now` rows (FR-FIRST-9), and its live link → the next-event block's `[ Open the live sky ]`; the Moon tradition line → under the table; the hero card → the `Next ISS` tag and the next-event block (FR-FIRST-10); the sort control and the list → What; the footer after all three.
  The `[ Live sky ]` control stays in the header (FR-DESK-2).
  *Verification:* the existing component and e2e tests for each of those facts pass with their locators re-pointed; an assertion about a component that no longer exists on the home moves to where its fact now is, and no fact's assertion is dropped.
  *(amended v2.0.2, V20-15; was: "nothing is removed" — every component of the home kept whole, which is what made the panes the old page re-cut)*
- **FR-FIRST-7** Captures and the reference.
  At 390 × 844: the three first-visit steps and the stacked home (the where line collapsed, and once expanded); at 1024 × 768 the two columns, cold and populated; at 1280 × 800 the three panes cold (two dimmed) and populated, and with a pass open — each in both themes and both languages, but the pass open in one theme.
  The D-179 set's `home` and `location` screens are re-shot on `main` by the release task.
  Board 1B of `redesign/captures/turn-1-first-run-directions.png` — the cold open, the three compact steps and the two wide states, which the design canvas steps through — is the visual reference; where a capture and the board disagree on a number this section has, this section wins.
  *(amended v2.0.2, V20-15; was: the cold open and the stacked home only)*
- **FR-FIRST-8** *(v2.0.2, V20-15, V20-23)* Tonight's stripe.
  The When reading opens with the night as three lines of text at `--small` on an 18 px line: the hour labels every `TONIGHT_STRIPE_LABEL_STEP_H` (2 h) in the observer's zone, `18   20   22   00   02   04   06`, in `--fg`; the band, one character to `24 min` of `TONIGHT_STRIPE_HOURS` (12 h — an evening to a morning, what a reader plans across), so 30 characters — `▓` day in `--warn`, `▒` bright twilight in `--chart-pass-flown`, `█` dark in `--chart-sky`, the same bands of FR-LIVE-4 the live stripe shades, so the two never disagree; and a tick `▲` in the accent under the character that holds the peak of each listed pass inside the span.
  The span is centred on the middle of tonight's dark band and rounded to the hour, or on local solar midnight where there is no dark band (OQ-33).
  It is a picture of facts the table states in words, so it is `aria-hidden`.
  *Verification:* a pure-module test pins the span, the labels, the band's characters and the tick positions over the fixture run, and the span with no dark band.
- **FR-FIRST-9** *(v2.0.2, V20-15, V20-19, V20-23)* The conditions table.
  Under the stripe, rows of a label in `--fg-dim` at the left and a value in `--fg` at the right, right-aligned, one body line each and 0.75 rem apart: `Dark` · `20:14 → 05:31` (tonight's dark window, the first `dark` band still open or to come, from the stripe's bands; "No full darkness tonight." where there is none); `Clouds now` · FR-WX-3's current cover as its word, in the verdict's colour (`--ok` for clear); `Moon` · FR-MOON-3's phase and illumination, `waxing crescent, 18 %`, and where the Moon is up its compass point; and `Up now` — only while at least one satellite is visible (US-4) — the first one's name and time left and `+<n>` for the rest.
  It is a description list, so each value is read with its label.
  The phone's **when** step draws the night's own rows instead (FR-FIRST-4).
  *Verification:* a component test asserts the rows in order, the `Up now` row present with a visible item and absent with none, and the no-darkness value.
- **FR-FIRST-10** *(v2.0.2, V20-15, V20-20, V20-23)* The one-line card.
  A pass in the list is a box ruled in `--rule`, 12 px inside, the cards 0.75 rem apart: the start time and the name in the accent, three spaces between (`21:14   ISS`); then at `--small` in `--fg-dim` the duration, the peak altitude and compass point and the magnitude (`6 min · peak 68° N · mag -3.4`) — on the phone's third step the brightness phrase in place of the magnitude (`4 min · peak 41° NE · like a bright star`) — which is US-5 AC1's content; and at `--small` the cloud word in its colour where a forecast covers the pass (US-7 AC2).
  The whole card is the control that opens the pass (FR-DESK-3; the sheet on compact), and the open pass's card is ruled in the accent.
  The next ISS pass carries a `Next ISS` tag on its first line, which is what the hero card said, and the hero card is not drawn.
  The count and the sort share one line at `--small`, `7 visible passes in 72 h · Sort: [ Soonest ] Best`, and the night groups keep US-16 AC5's order and toggles with their headings on one line under the cards, `[−] Tonight 5 passes   [+] Tomorrow 2`.
  The guide keeps every figure of US-6 AC2.
  *Verification:* a component test asserts a card's lines, the tag on the next ISS pass alone, the count and sort on one line, and `controlRows.test.ts` the card's first line in both languages.
  *(amended v2.1, V21-3, V21-16)* **Three lines, and no Moon sentence.**
  The card's third line is the cloud word followed, where they apply, by the `[sky still bright]` tag (FR-VIS-7) and the `[moon glare]` tag (FR-MOON-2), on that one line; the Moon-at-peak sentence is the guide's (US-18 AC1 as amended).
  At 1280 × 800 at least five cards are whole inside the What pane.
  **The whole card is the hit area:** the control that opens the pass covers the card's entire box, tags and cloud line included, with `cursor: pointer`, and is one tab stop.
  **The count line never ends in a separator:** the ` · ` between the count and `Sort:` is drawn only when both are on one line; when the sort wraps, the count line ends at its last word (F-78).
  *Verification:* the component test asserts the three lines and that no `MoonAtPeak` is rendered in a card; an e2e at 1280 × 800 counts the whole cards in the pane and asserts the control's box equals the card's within 2 px; an e2e at 390 and 1280 in Spanish asserts the count line's last character.
  *(was: a fourth line, "Moon at peak: waxing gibbous, 78 % lit", on every card with the Moon up — three and a half cards at 1280 × 800, F-77; the control 76 px of a 150 px card, F-85)*
- **FR-FIRST-11** *(v2.0.2, V20-15, V20-21, V20-23)* The Where reading.
  Populated, 0.75 rem between blocks: the place in `--fg` with its coordinates after it in `--fg-dim` (`Cipolletti (-38.93, -67.99)`), or the coordinates alone; then at `--small` in `--fg-dim` one sentence — "Using the centre of <place>." for a place picked by name, "Using these coordinates." for typed ones, "Using your device's location (±<n> m)." for the device — then "Saved in this browser only." and `[ change ]`, which opens the FR-FIRST-2 group in place; on wide, a dome of the sky at the current instant, the pane's width square with `W`, `N` and `E` at its rim (FR-DOME-1's drawing with its passes, no controls, loaded after the page as the live page's is, and a link to `#live`); then at `--small` the readiness line (FR-OFF-4 as amended, `Ready offline until 2026-09-12 05:31`); the elements line (FR-SAT-4 as amended), `[ details ]` opening the epoch, the confirmation, the storage time and the warning in place; and `Saved places · [ Save this place ]`, each saved place a line under it.
  On compact the stacked Where is the same without the dome.
  *Verification:* a component test asserts the order, each sentence by the observer's source, and the disclosure; `wide.spec.ts` asserts the dome in the Where pane at 1280 px and not on compact.
  *(amended v2.6, V26-2, V26-9)* On compact the populated Where is two lines with the rest behind `[ details ]` (FR-FLOW-2); on wide the Where pane loses its dome, whose job the home's Both door does (FR-FLOW-1).
  *(amended 2026-11-02, the owner's call, PLAN D-1024)* On compact the populated Where is the place with `[ change ]`, its one control, and a fault line under it only while there is a fault; the sentence, the readiness line, the elements line and the saved places head the group `[ change ]` opens, above the inputs (FR-FLOW-2 as amended).
  This replaces "the rest behind `[ details ]`".
  Wide, which shows them unfolded, is unchanged.
  *(amended 2026-11-02, the owner's call from the phone, PLAN D-1029)* The place line is the place's name alone — a picked place's first part, a named device fix's town — or the coordinates where there is no name; a named place's coordinates are the first words of the sentence (`−38.94, −68.00 · Using your device's location …`), which compact shows under `[ change ]` and wide always.

### 4.29 The mark — "Aperture" *(v2.0)*

The app's identity has been a character rule and a monospace grid (FR-X-6) and an icon that is a horizon with an arc over it (D-127).
The design phase gives it a mark: a wireframe mesh rasterised to braille through glyphcss exactly as the dome is — the same 2 × 4 dot cell, the same orthographic camera, the same font (`src/ui/components/guide/skychart/dome/wiys-braille.otf`) — so the mark is text in the page's own grid and not an image dropped into it.
The reference is `redesign/captures/turn-3-aperture-mark.png`; the rasters it is drawn from are embedded in FR-MARK-2, since the reference is not tracked (V20-11) and a task session has nothing else to seed the golden test with.
It ships in this phase, first in the order of work (V20-3).

- **FR-MARK-1** Construction.
  Three concentric readings inside a **bezel with four cardinal ticks**: the bezel, an orbit ring, and a globe with its limb and one meridian, plus one **bead** on the orbit ring — the satellite.
  The camera is orthographic and tilted `MARK_TILT_DEG` (30°: enough that no ring reads as a flat line, every ring visibly an ellipse; less than the dome's 35°–55° so the globe stays round).
  The mesh, the camera and the grid are fixed by the rasters of FR-MARK-2, which the generator MUST reproduce; the mesh's radii and the tick length are the generator's constants, recorded in PLAN with the values that reproduce the rasters.
  Nothing is hand-drawn: a tier is the same scene rasterised at that tier's grid with the meshes FR-MARK-2's ladder says it sheds.
- **FR-MARK-2** The size ladder.
  A braille grid of `cols × rows` is square when `cols = 2 × rows`, since the cell's advance is 0.6 em and a row is two cell widths.
  The ladder is six tiers, each shedding one reading from the one above it, never a separate small-size logo:

  | Tier | Placement (FR-MARK-4) | Grid (cols × rows) | Sheds |
  |---|---|---|---|
  | `hero` | the cold open at 120 / 140 px | 32 × 16 | nothing |
  | `icon192` | the manifest icons at 192 and 512 px | 24 × 12 | nothing — full |
  | `lockup80` | the 80 px lockup (the social preview, FR-PUB-11's image) | 14 × 7 | the globe's meridian |
  | `header56` | 56 px (no placement in this phase; OQ-29) | 10 × 5 | the globe's limb |
  | `header32` | the compact and wide headers at 24 px | 6 × 3 | the orbit; the bead moves **inside** the bezel, on a circle of `BEAD_INNER_R` (0.6) in the screen plane *(amended v2.0.1, V20-14; was onto the bezel, where a bead with a blank dot around it cannot fit on the smallest rings)* |
  | `favicon16` | the favicon at 16 px | 4 × 2 | everything but one ring and the bead |

  At the 24 px placements (FR-MARK-4) the bead is a full cell rather than a dot within one, so it stays legible at three cells of width.

  Each tier is two layers, `body` and `mark` (the bead), as the dome has a base and a line layer (D-74).
  The rasters below are the golden set: the generator's output for each tier MUST equal them cell for cell, and the committed snapshots (FR-MARK-8) are seeded from them.
  Where the first implementation cannot reproduce a tier cell for cell, the PR shows the two side by side with the count of differing cells, and the owner accepts the re-baked snapshot or not (`Gate: owner`); a snapshot is never updated silently.

  **`hero` — 32 × 16, `body`:**

  ```
          ⢀⣠⠤⠖⠒⠋⠉⢹⠉⠉⠙⠒⠲⠤⣄⡀        
       ⢀⡠⠞⠉      ⠈       ⠉⠳⢄⡀     
     ⢀⡴⠋    ⣀⠤⠖⠒⠋⠉⠉⠓⠒⠦⣄⡀    ⠙⢦⡀   
    ⣠⠎   ⢀⡰⠊⠁          ⠈⠲⣄    ⠱⣄  
   ⣰⠃   ⢠⠎     ⣠⠤⣔⣒⣲⣤⣄   ⠈⠳⡀   ⠘⣆ 
  ⢠⠇   ⢠⠃   ⢀⣴⡫⠚⠉    ⠈⠙⢦   ⠱⡀   ⠸⡄
  ⡼    ⡎   ⢀⣮⠯⠒⠒⠋⠉⠉⠙⠒⠒⠤⣌⣧   ⢣    ⢧
  ⡇    ⡇  ⢠⣿⠃           ⣹⡄  ⢸    ⢸
  ⡏⠉⠁  ⡇  ⠘⣏           ⢠⣿⠃  ⢸  ⠈⠉⢹
  ⢳    ⢣   ⢻⡙⠒⠤⠤⣄⣀⣀⣠⠤⠤⣲⡻⠁   ⡸    ⡞
  ⠘⡆   ⠈⢆   ⠳⣄⡀    ⣀⡤⣪⠟⠁   ⢠⠃   ⢰⠃
   ⠹⡄   ⠈⢦⡀   ⠙⠛⠯⠭⠝⠒⠋     ⡰⠃   ⢠⠏ 
    ⠙⢆    ⠙⠦⡀          ⢀⡠⠎⠁   ⡰⠋  
     ⠈⠳⣄    ⠈⠙⠲⠤⢤⣀⣀⣠⠤⠴⠒⠉    ⣠⠞⠁   
       ⠈⠑⢦⣀       ⡀      ⣀⡴⠊⠁     
          ⠈⠙⠒⠦⠤⣄⣀⣀⣇⣀⣠⠤⠴⠒⠋⠁        
  ```

  **`hero` — 32 × 16, `mark` (frame 0):**

  ```
                                  
                                  
                                  
                                  
                                  
                                  
                                  
                                  
                                  
                                  
                          ⢰⣶⣶     
                          ⠘⠛⠛     
                                  
                                  
                                  
                                  
  ```

  **`icon192` — 24 × 12, `body`:**

  ```
       ⢀⣠⠴⠒⠚⠉⢹⠉⠉⠓⠒⠦⣄⡀     
     ⣠⠖⠋   ⣀⣀⣀⣀⣀⡀   ⠙⠲⣄   
   ⢀⡼⠁  ⣠⠔⠋⠁    ⠉⠑⠦⡀  ⠈⢧⡀ 
  ⢀⡞  ⢀⡜⠁  ⣀⣤⣴⡶⠦⣤⡀ ⠙⢦   ⢳⡀
  ⣸   ⡜  ⢀⣾⣟⣩⠤⠤⣄⣀⡙⣆ ⠈⢇   ⣇
  ⡇   ⡇ ⢠⣾⠉      ⠉⢻⡄ ⢸   ⢸
  ⡏⠉  ⡇ ⠘⣧⣀      ⣀⡿⠃ ⢸  ⠉⢹
  ⢹   ⢱⡀ ⠹⣌⠉⠙⠒⠒⣋⣽⡿⠁  ⡜   ⡏
  ⠈⢧   ⠳⣄ ⠈⠛⠲⠶⠟⠛⠉  ⢀⡜⠁  ⡼⠁
   ⠈⢳⡀  ⠈⠲⢄⣀    ⢀⣠⠔⠋  ⢀⡞⠁ 
     ⠙⠦⣄   ⠈⠉⠉⠉⠉⠉   ⣠⠴⠋   
       ⠈⠙⠲⠤⢤⣀⣀⣇⣀⡤⠤⠖⠋⠁     
  ```

  **`icon192` — 24 × 12, `mark` (frame 0):**

  ```
                          
                          
                          
                          
                          
                          
                          
                    ⣀⡀    
                    ⠛⠃    
                          
                          
                          
  ```

  **`lockup80` — 14 × 7, `body`:**

  ```
    ⣀⡴⠒⠋⠹⠉⠙⠒⢦⣀  
  ⢀⡼⠁⢀⡤⠖⠒⠒⠲⢄ ⠈⢧⡀
  ⡼ ⢀⠎ ⣠⣖⣒⣲⡄⢳⡀ ⢧
  ⡧⠄⢸ ⢾⡁  ⢈⡷ ⡇⠠⢼
  ⢳ ⠈⢧⠘⠯⠭⠽⠋ ⡰⠁ ⡞
  ⠈⢳⡀ ⠑⠦⠤⠤⠴⠚⠁⢀⡞⠁
    ⠉⠳⠤⣄⣀⣆⣠⠤⠞⠉  
  ```

  **`lockup80` — 14 × 7, `mark` (frame 0):**

  ```
                
                
                
                
            ⣶⡆  
                
                
  ```

  **`header56` — 10 × 5, `body`:**

  ```
   ⣠⠖⠋⠙⠉⠙⠲⣄ 
  ⡼⠁⣠⠞⠉⠉⠳⡄⠈⢧
  ⡧ ⡇    ⢸ ⢼
  ⢳⡀⠘⢦⣀⣀⡴⠋⢀⡞
   ⠙⠦⣄⣀⣄⣠⠴⠋ 
  ```

  **`header56` — 10 × 5, `mark` (frame 0):**

  ```
            
            
            
         ⠁  
            
  ```

  **`header32` — 6 × 3, `body`:**

  ```
  ⣠⠞⠙⠉⠳⣄
  ⡧    ⢼
  ⠙⢦⣀⣄⡴⠋
  ```

  **`header32` — 6 × 3, `mark` (frame 0):**

  ```
      ⠂ 
        
        
  ```

  **`favicon16` — 4 × 2, `body`:**

  ```
  ⡴⠋⠙⢦
  ⠳⣄⣠⠞
  ```

  **`favicon16` — 4 × 2, `mark` (frame 0):**

  ```
    ⠐ 
      
  ```


- **FR-MARK-3** Two tones, from tokens.
  The body is drawn in `--fg-dim` and the bead alone in `--accent`; the bead is the only bright element in the mark, so the eye lands on the moving part.
  While an instant is held on the live page (FR-MARK-5) the bead is `--warn`.
  All three are text tokens with a value in both themes and a contrast the tokens test already pins at ≥ 4.5 : 1 on `--bg` (`--fg-dim` 5.28 : 1 dark; `--accent` 11.75 : 1; `--warn` 11.93 : 1), so no token is added and `tests/styles/tokens.test.ts` is untouched (FR-THEME-1..3 hold by construction).
  On the night theme the mark is red like everything else.
- **FR-MARK-4** Placement.
  (a) The compact header (FR-COMP-1 as amended): the `header32` tier at `MARK_HEADER_PX` (24 px — one `--row`, so the header stays one row tall) before the short title, then `[ live ]` and `[ settings ]`; the row is 33 cells counting the mark as three, inside FR-COMP-4's 36.
  (b) The wide header (FR-DESK-2 as amended): the same tier at 24 px on the title line before the title, and the tagline's `padding-left` changes from `calc(2 * var(--cell))` to the mark's width plus one cell, so the tagline aligns under the wordmark.
  (c) The cold open (FR-FIRST-1): the `hero` tier at 120 / 140 px.
  *(withdrawn v2.0.2, V20-15: the cold open carries no mark, so `MARK_HERO_COMPACT_PX` and `MARK_HERO_WIDE_PX` go; the `hero` tier stays in the ladder and its golden raster, and is placed nowhere in the app)* (d) The manifest (FR-OFF-6 as amended): `icon-192.png` and `icon-512.png` are the mark's scene with every reading (the `icon192` tier's construction) drawn as dots on `--bg` — a 48 × 48 dot grid at 4 px a dot for the 192 and a 64 × 64 grid at 8 px for the 512, the same five elements at a coarser step, so the pitch is a whole number of pixels in both and nothing is resampled — replacing D-127's horizon-and-arc icon; `index.html`'s `apple-touch-icon` follows.
  *(amended v2.0.1, V20-14; was the `icon192` tier's text photographed at each size)* (e) The favicon, three files linked from `index.html` with the SVG first: `public/favicon.svg`, the `favicon16` construction (the bezel, and the bead inside it) on a 16 × 16 dot grid as rectangles; `public/favicon.png`, that grid at 1 px a dot; and `public/favicon-32.png`, the `header32` construction (the bezel, its ticks and the bead inside) on a 32 × 32 grid at 1 px a dot, for browsers without SVG favicons and 2 × screens.
  These three have **no ground**: the mark sits on whatever the tab strip provides, the bezel does the containing, and the bezel and its ticks are drawn one ramp step brighter than the body — `--chart-horizon` in the files only — so the ring holds on a light strip as well as a dark one.
  The manifest icons keep their full-bleed `--bg` ground, since a launcher's icon is a tile and not a glyph on a strip; one rule for both would be wrong for one of them.
  At every file the bezel is rasterised from one octant and reflected eight ways, so it is symmetric by construction, and the bead is a 2 × 2 block with a blank dot between it and anything else.
  *(amended v2.0.1, V20-14; was one 16 × 16 PNG of the `favicon16` tier's text, whose 8 × 8 dots arrived through the font at 2 px a dot, and then, for a day, an opaque square with the bead on the ring and a clearance that bit a quarter of it)* (f) The live page's state indicator (FR-MARK-5, FR-WATCH-2): the `header32` tier at 24 px beside the state word.
  The 80 px lockup and the social preview are FR-PUB-11's, regenerated by `scripts/readme-hero.ts` from the tier, not a placement in the app.
  The icons and the favicons are files the build draws dot by dot with no font in the path (FR-MARK-6); everywhere else the mark is text in the DOM.
- **FR-MARK-5** Animated by the bead alone.
  Only the bead's mesh advances — the body's camera and meshes are fixed (`rotY` constant), so the body raster never re-rasterises and the animation is the bead's layer changing while the body's text is untouched.
  One orbit per `MARK_ORBIT_PERIOD_S` (60 s: slow enough not to pull the eye from the sky, fast enough to read as motion in a glance).
  Three uses, all the same animation: (a) **loading** — on the home page the bead runs while the elements load and the run computes, and stops when the list is computed (the passes slice at `done`), in `--accent`; (b) **live** — on the live page the bead runs, in `--accent`, while the shown instant is real time, with the word `live` beside it; (c) **held** — the bead stands still, in `--warn`, while an instant is held (FR-WATCH-1: paused or playing at a speed), with the word `held` beside it.
  The word is always beside the mark, so the state is never colour alone (FR-X-5).
  Under `prefers-reduced-motion: reduce` the bead does not move in any of the three; the colour and the word still change.
  The animation costs no rasterisation at runtime: the bead's positions around the orbit are `MARK_ORBIT_FRAMES` (60, one per second of the orbit) pre-rasterised frames per tier, and the page swaps the bead layer's text on a one-second timer (`setInterval`, not `requestAnimationFrame`: a step a second is what a bead crossing a cell every second or so looks like anyway, and the page pays nothing between steps).
- **FR-MARK-6** The build step.
  The rasters are generated, not hand-edited: `scripts/build-mark.ts` builds the scene, rasterises every tier's body and its 60 bead frames through glyphcss, and writes them as a committed asset the app imports (`src/ui/components/mark/rasters.json`; the bead frames as sparse `[row, col, glyph]` lists, since a bead is one or two cells); the same script draws the two icons and the three favicons from the same scene (`spike/mark/scene.ts`, the polygons the tiers are rasterised from) on a dot grid — the grid chosen per file so the pitch is a whole number of pixels, one dot one square of pixels, no font and no browser in the path — so the files and the DOM mark are one construction at two rasterisations.
  *(amended v2.0.1, V20-14; was the tier's text drawn in the braille font at the pixel size and screenshotted, which at 16 px put a 2 px dot through hinting and antialiasing and made the ring a smudge with a hole)* `npm run build:icons` (D-127) is that script now.
  A test regenerates the rasters and asserts the committed file is byte-identical, so the asset cannot drift from the generator; the icons and the favicons are pinned the same way: `tests/build/mark-icons.test.ts` re-draws every file from the scene and asserts the committed bytes are identical, which a dot renderer with no font in it makes possible on every machine (D-460, lifting D-459's cell-by-cell pin); the same test asserts that every pixel of every PNG is one of the declared tones — the bezel's, the body's, the bead's, and the ground's on the manifest icons — or fully transparent, and nothing else (another colour means something was resampled); that the bead is one contiguous block holding a 2 × 2 of pixels with only ground or bead beside it (the blank dot); that the bezel has ink in each of the eight octants around the centre; and that the bezel with its ticks is invariant under both mirrors and a quarter turn at every size, as is the whole drawing minus the bead at 16 and 32.
  *(amended v2.0.1, V20-14)* `tests/deploy/manifest.test.ts` keeps the manifest's bytes and gains the three favicons' presence, the two PNGs' sizes and the SVG's link before them.
  The mark lands in the **main** chunk (the header is on every page); its cost — the component, the six body rasters and the sparse frames — MUST fit inside main's current budget (155 KB, PLAN §11) with no budget raised, and the release task measures it.
- **FR-MARK-7** Identity.
  FR-X-6 is amended: the app's visual identity is the monospace grid, the character rules *and* the mark, and the mark is text on that grid.
  FR-GUIDE-5's rule stands in spirit — the mark in the DOM is braille text, not an image, a canvas or an SVG; the only rasters are the icon and favicon files the browser and the OS require.
- **FR-MARK-8** Verification.
  (a) A golden raster test like `SkyDome.raster.test.tsx`: the six tiers' `body` and frame-0 `mark` layers as committed snapshots seeded from FR-MARK-2, updated only deliberately (FR-MARK-2's rule).
  (b) Structural checks that do not depend on the exact raster: the `favicon16` tier carries a ring and a bead — at least one non-space cell on each of its two rows in the body and exactly one bead cell; each tier's body has fewer non-space cells than the tier above it; the bead is inside the grid in every frame; frame 0 and frame 30 put the bead in different cells at every tier but `favicon16`.
  (c) A component test that the bead advances on the timer, stops on `done`, and does not advance under `prefers-reduced-motion: reduce` (`matchMedia` stubbed).
  (d) `tests/styles/controlRows.test.ts` counts the compact header with the mark at ≤ 36 cells in both languages.
  (e) Captures: the compact header at 390 px and the wide header at 1280 px, both themes, one language; the cold open per FR-FIRST-7; the live page's `live` and `held` states per FR-WATCH-9; the two icons and the three favicons opened at 1 : 1 in the PR, the SVG on a dark and a light tab strip.
  *(amended v2.0.1, V20-14)* (f) The file checks of FR-MARK-6 as amended: byte identity with the dot renderer, only the declared tones or transparency, a contiguous bead of at least 2 × 2 pixels, the blank dot around it, the bezel in every octant, and the bezel's symmetry under both mirrors and a quarter turn.
  *(added v2.0.1, V20-14)*

### 4.30 The live page's two states *(v2.0)*

The diagnosis: about twenty controls surround one drawing — the five-field strip, the clock readout, the overview row, the three-row stripe, the six step buttons, play, `Now`, four speeds, the hidden-objects toggle, the list control, share and the three-way view control — all present at once, at night, one-handed.
Every one of them is justified by a requirement in this document, and nothing is removed.
It is **sequenced**: the page is either **watching** (real time) or **scrubbing** (an instant held), and each state renders what it is for.
The reference is `redesign/captures/turn-4-live-page.png`, `turn-4-live-page-scrubbing.png` and, for the two short shapes, `turn-7-short-screens.png`, `turn-7a-landscape-phone-scrubbing.png` and `turn-7b-short-wide-overlay.png`.

- **FR-WATCH-1** Two states, one fact.
  The live page is **watching** while the shown instant `t` is real time (FR-LIVE-5's `now` state, advancing on the 10 s tick) and **scrubbing** while `t` is held — paused, or playing at a speed.
  There is no second flag: the state is read from the live slice's instant, so nothing can disagree with `t` (D-382's rule for the chunk, applied to the page).
  Scrubbing is entered by (a) `[ scrub ]` — on compact `[ scrub ]`, on wide `[ scrub the night ]` — which holds `t` at the instant of the tap (FR-LIVE-5's pause, at now); (b) a click, a drag or a key on the overview (FR-SPAN-2), which sets `t`; (c) a `#live` URL that carries `t` (FR-LIVE-9).
  It is left by `[ back to live ]`, which is FR-LIVE-5's `now` action under a name that says where it goes: `t` returns to real time and advances again, and the scrub block goes away.
  The `[ Now ]` control is not rendered separately — `[ back to live ]` is it.
  Leaving the page (FR-LIVE-1) leaves the state with it; the URL still carries `t` while scrubbing and nothing while watching (FR-LIVE-9 unchanged), so a reload comes back in the state it left.
  *(amended v2.7, V27-3; FR-TONIGHT-6: on the compact live page `[ scrub ]` and `[ back to live ]` are gone; the two states remain a fact read from `t`, and the page renders one inventory in both.)*
- **FR-WATCH-2** The headline.
  **Watching:** the next-event block of FR-FIRST-3 — the label, `ISS rises NW in 4:12`, the peak line — computed from the same stored run the drawing uses, at real time.
  **Scrubbing:** the held instant and its offset from real time — `21:47 · +33 min` (`−12 min` behind now; hours and minutes past sixty; the weekday when `t` is not today, FR-TRAJ-4's readout rule) — which is FR-TRAJ-4's clock readout moved to the headline's place and given its offset; the stripe's own time row (FR-LIVE-7, V12-13) carries it on wide with the playback controls beside it.
  Beside the headline in both states stands the **state indicator**: the mark (FR-MARK-5) and the word `live` or `held`.
  On compact the indicator stands on the top row beside the place name (`[ ← Back ]` at the left; the mark, the word and the place at the right), so the actions row keeps its cells (FR-WATCH-4, V20-8); on wide and on the landscape phone it stands at the head of the rail with the clock (`21:14:32 GMT−3`) on the same line.
  *(amended v2.0.2, V20-18)* Watching, the headline is the next-event block in FR-FIRST-3's amended layout — `Next up · in 4:12`, the clock time, the path line — so the two hosts still render one component.
  *(amended v2.7, V27-5; FR-TONIGHT-7: on the compact live page the headline is the shown time with its chip in both states; the state word leaves the top row.)*
- **FR-WATCH-3** One line of conditions.
  The five-field strip (FR-LIVE-3) becomes one line per state: **compact** — the clock with its zone, the sky state word, the cloud verdict word, and the count as `n up`, at most 36 cells in both languages (English `21:14:32 dark clear 3 up`, 30 cells with one-cell gaps; the cell count is `tests/styles/controlRows.test.ts`'s to assert, Spanish being the longer); the Moon's phase and illumination leave the compact line for the list panel's Moon line (FR-LEG-7, FR-DOME-6), one tap away, which amends FR-MOON-3 for the compact live page only.
  **Wide and the landscape phone** — the line stands in the rail and carries the sky state, the cloud verdict with its percentage, the count and the Moon (`Sky dark · Clouds clear, 12 % · Up 3 · Moon 18 %`), wrapping inside the rail where the width asks as the strip does today; the clock is on the indicator's line.
  The cloud verdict is "unknown" where there is no forecast (FR-WX-5) and carries the "as of" note offline (FR-OFF-3).
  The speed while playing is shown by the pressed speed control on the playback row (scrubbing only) and not on the line.
  This amends FR-LIVE-3.
  *(amended v2.7, V27-5; FR-TONIGHT-7: on the compact live page the conditions line loses the clock (the headline carries it) and becomes the context line.)*
- **FR-WATCH-4** What each state renders.
  The inventory is the contract; a control listed is rendered, one not listed is not in the DOM (not hidden — absent, so the box gets its rows).
  *(amended v2.7, V27-6; FR-TONIGHT-6: the compact inventory is FR-TONIGHT-6's, the same in both states.)*

  **Watching** renders: the top row (`[ ← Back ]` and the place; on compact the indicator too); the view control's row as FR-LIVE-7 has it today (the dome, the polar chart, the window — the way into the sky screen, FR-FSC-6; OQ-27 records that the artboards omit it and where it might go); the headline (FR-WATCH-2); the box, which takes every row the state leaves it (FR-COMP-5, FR-LIVE-7); the facing readout (FR-GUIDE-4); the conditions line (FR-WATCH-3); the **24 h overview** (FR-SPAN-2), the only timeline in this state — on compact under the conditions line with one text row of labels under it (`now` at the left, `+24 h` at the right); on wide and on the landscape phone in the rail; the legend where FR-LEG-6 and FR-LEG-7 put it (the rail; `[ list (n) ]`); and the actions row.
  The actions row is, on compact, `[ scrub ] [ list (n) ] Share` (27 cells; share plain by D-411); on the landscape phone `[ scrub ] [ hidden ] [ list (n) ] [ share ]` in the rail; on wide `[ scrub the night ] [ Hidden ] [ Share this sky ]` at the foot of the rail.
  **Not rendered** while watching: the time row, the stripe (FR-TRAJ-4's three rows), the step row (FR-SPAN-3) and the playback row (play, the speeds).

  **Scrubbing** renders everything watching renders except the next-event block, plus: the time row (the headline of FR-WATCH-2; on wide with the playback controls at its right, V12-13), the stripe, the step row and the playback row (`[ ▶ ] 1× 60× 600× 3600×`; `Now` is `[ back to live ]`).
  Where they stand: on compact under the overview, as FR-LIVE-7 has them today; on the landscape phone in the rail under the overview; on wide under the box at the box's width (V12-12), the overview moving from the rail to the head of the block (FR-SPAN-2's "directly above the stripe" holds where the stripe is drawn); on a short wide window, the overlay of FR-WATCH-6.
  The actions row while scrubbing is, on compact, `[ back to live ] [ hidden ] Share` (33 cells: the hidden-objects toggle joins the scrubbing row, V20-8, its saved state applying in both states as FR-LIVE-6 says — a toggle moved, not a behaviour); on the landscape phone `[ back to live ]` on the playback row's line and `[ hidden ] [ list (n) ] [ share ]` above it; on wide `[ back to live ]` beside the indicator at the head of the rail and `[ Hidden ] [ Share this moment ]` at its foot.
  **Playback is reachable only while scrubbing** (FR-LIVE-5 as amended): play, pause and the speeds are on the playback row, which watching does not render; the arrow keys and Page Up / Page Down act on the stripe and the overview, which have focus only while rendered, and a key on the overview while watching enters scrubbing (FR-WATCH-1 b).
  The chart view control, the hidden-objects behaviour (FR-LIVE-6), the list control (FR-LEG-7), share (FR-LIVE-9's link, with `t` while scrubbing), the wake lock and `Esc` (FR-LIVE-1) are unchanged in both states.
- **FR-WATCH-5** The four shapes.
  Both states exist at every row of FR-SHP-4's matrix, and the matrix is walked in both (FR-SHP-4 as amended).
  What each shape does with the split: *(amended v2.7, V27-6; FR-TONIGHT-6: on compact portrait the box no longer changes height between the states.)*
  - **Compact portrait** (390 × 844, 390 × 667): the rows above.
    The box is what the rows leave (FR-COMP-5); in watching it is taller than in scrubbing, since the stripe block and two control rows are not there.
    Measured with the list closed at 390 × 667 in watching, the rows under the box are the facing readout, the conditions line, the overview and its labels and the actions row — 168 px with their gaps — and the box comes out over FR-COMP-5's floor of 374 where R71 measured 198 with every row present; in scrubbing the box yields as it does today, which is the reader's own tap (FR-LEG-8's escape).
    The number at 390 × 667 in watching is asserted, with the view control's row where FR-WATCH-4 leaves it; OQ-27 records the arithmetic that the floor at that height depends on.
  - **Landscape phone** (D-173: compact, wider than tall, at most 500 px high; 740 × 360, 844 × 390, 932 × 430): the split works unchanged.
    Watching puts the indicator and the clock, the headline, the conditions line and the overview in the `3fr` rail and gives the dome the whole `2fr` column; scrubbing adds the time row, the stripe, the step row and the playback row to the rail, the one place with rows to spare, and the rail scrolls inside itself where a language or a height overflows it (D-173, D-119).
    Nothing folds and the drawing does not move between the states: the dome column's width and height are the same in both, asserted at all three sizes.
  - **Wide** above the fold threshold (FR-DESK-1's mode, the box at or over `LIVE_BOX_MIN_PX` with the scrub block under it): watching puts the indicator, the headline, the conditions, the legend, the overview and the actions in the rail (FR-LEG-6's order, with the headline and the overview added) and leaves nothing under the box but the facing readout's row, so the box takes the height down to the page's foot; scrubbing puts the scrub block under the box at the box's width as FR-LIVE-7 has it today, and the box is re-fitted to the height the block leaves (D-314's rule).
    So on a tall wide page the box *does* change height between the states — on the reader's tap — and the drawing is re-fitted once, not per frame.
  - **Short wide window** (FR-SHP-3's shape; 964 × 420, 1024 × 450, 1200 × 450, 1400 × 480, 1920 × 500): FR-WATCH-6.
- **FR-WATCH-6** Under the floor, scrubbing is an overlay.
  On a wide viewport where placing the scrub block under the box would take the box under `LIVE_BOX_MIN_PX` (FR-SHP-3's floor, 192 px; the decision is made from the measured height the way `fitBox` sizes the box, not from a viewport literal), the block is not laid out under the box at all: the time row with the playback controls, the three stripe rows and the step row come up as a **bar over the bottom edge of the drawing**, on `--screen-overlay` (the surface the sky screen's overlays already use, `ChartFrame.module.css`'s `color-mix` of `--bg-raised` at `--screen-overlay-alpha`), each control row one text row tall with its 48 px hit box kept by D-246's padding-and-negative-margin.
  The overview stays in the rail, `[ back to live ]` stays at the head of the rail and dismisses the bar with the state.
  **The box does not resize between the two states**, so the picture never jumps: `chart-box`'s measured height is identical in watching and in scrubbing at every short-wide row of the matrix, which is what the overlay buys and what the e2e asserts.
  The bar covers at most half of the box's height (measured at 1200 × 450: the box about 380 px, the bar about 130), so the horizon and the bowl's top stay in view under it.
  Watching at this height keeps FR-SHP-3's folding — the rail's control rows one text row tall, the actions riding on the conditions line rather than taking a row — and the overview does not fold, since it is in the rail and not under the box.
  Above the threshold the wide page keeps the under-the-box behaviour of FR-WATCH-5.
  This amends FR-SHP-3.
- **FR-WATCH-7** The reader's tap is the only thing that resizes the box.
  FR-LEG-7's rule — "that press is the only thing that may change the box's height on the live page" — becomes: the box's height on the live page changes on the reader's own action and on nothing the sky does.
  The actions are `[ list (n) ]` (FR-LEG-7), and entering or leaving scrubbing on compact and on the tall wide page (FR-WATCH-5).
  A pass rising, ending, being hidden or shown, a chunk boundary, a speed change and the 10 s tick MUST NOT change the height of any row, the panel or the box.
  On the landscape phone and the short wide window not even the state change does.
  *(amended v2.8, V28-5)* On the compact live page nothing at all resizes the box but the viewport (FR-FULL-6): `[ list (n) ]` opens the list inside the sheet over the sky.
- **FR-WATCH-8** Copy.
  New strings in both catalogs (`i18n/{en,es}/live.ts`): the state words `live` / `held`; `scrub` / `scrub the night`; `back to live`; the next-event label and verbs (FR-FIRST-3, shared with the home page's catalog section); the overview's end labels; the wide share action's two names (`Share this sky` while watching, `Share this moment` while scrubbing — the same action, the link the same as today, the name saying what the link carries).
  FR-COMP-4's rule counts every new compact row: the top row with the indicator (the place name truncated as today), the conditions line, the two actions rows.
- **FR-WATCH-9** Verification.
  (a) A component test per state on `Live.tsx`: which rows are in the DOM (FR-WATCH-4's inventory, asserted by test id, presence *and* absence), the headline's text, the indicator's word, and that `[ scrub ]` holds `t` and `[ back to live ]` returns it to real time.
  (b) `tests/e2e/live-states.spec.ts`: enters scrubbing, steps a pass with `pass ▶|`, plays at 60×, returns to live, at all four shapes — 390 × 844, 844 × 390, 1280 × 800 and 1200 × 450 — and at 1200 × 450 asserts `chart-box`'s height is identical in both states and the bar is inside the box; at 844 × 390 that the dome column is identical in both.
  (c) `tests/e2e/shapes.spec.ts` walks the matrix in both states (FR-SHP-4).
  (d) `live-compact.spec.ts` measures the box at 390 × 667 in watching with the list closed.
  (e) The existing playback, stripe, overview, step-row, list and hidden-objects tests pass once they enter scrubbing first; no assertion is loosened.
  (f) Captures (FR-COMP-6's rule): both states at 390 × 844, 844 × 390, 1280 × 800 and 1200 × 450, both themes and both languages, filed under the task's prefix; the D-179 set's `live` screen becomes two screens, `live-watching` and `live-scrubbing`, at the widths it has today plus 1200 × 450.

### 4.31 The compass gutter *(v2.0)*

Two field problems with the sky screen (§4.23).
The legend strip (FR-FSC-3) takes two `--tap` rows — 96 px — off the bottom of the sky and lists passes the reader may be nowhere near pointing at; and with nothing in the field the screen is empty sky with no indication of which way to turn.
The strip is replaced by a compass gutter along the bottom edge, and portrait stops instructing.
The reference is `redesign/captures/turn-5-window-mode.png` and `turn-5-window-mode-aiming.png`; `redesign/data/window-projections.json` is reference geometry only.
Unchanged: the fixed layer at `--z-screen`, `100dvh`, no route, no history entry, no scrolling (FR-FSC-9), `role="dialog"`, `Esc` closes (FR-FSC-2), the FR-FSC-10 turn, hidden objects never drawn (FR-FSC-5), the facing readout at the top-left and the `×` at the top-right (FR-FSC-2, FR-FSC-3).

- **FR-GUT-1** The gutter replaces the strip.
  Along the bottom edge of the sky screen, over the drawing, a gutter `GUTTER_PX` (28 px: one text row of 24 for the compass names and 4 px of tick above them, the least that holds a name with a mark over it; against the strip's 96 it gives the drawing back 68) tall and the screen's whole width, on `--screen-overlay` (FR-FSC-3's surface).
  The legend strip is not rendered on the screen in landscape; FR-FSC-3 and FR-LEG-2 are amended.
  *Verification:* the window's drawing box is 68 px taller than on `main` at 844 × 390 and at 390 × 844, measured on the SVG's box in `sky-screen.spec.ts`, and the gutter's height is `GUTTER_PX` in `tests/styles/` against the token.
  *(withdrawn v2.9, V29-1)* The gutter lived only on the sky screen and goes with it (FR-GYRO-6); FR-GUT-2..8 likewise.
- **FR-GUT-2** The band.
  The gutter maps the azimuth range the reader stands in — the facing ± `GUTTER_HALF_SPAN_DEG` (90°: the half of the horizon a turn of the head reaches; a pass further round is behind the reader and gets FR-GUT-5's marker) — linearly onto its width: `x(bearing) = width × (wrap(bearing − facing) + 90) / 180`, `wrap` into (−180, 180].
  On it, the eight 45° compass names (`compass`'s 8-point names, translated) at their bearings where they fall inside the band, each with a tick above it, and the facing read from the same smoothed heading the readout shows (FR-FSC-3, FR-WIN-3), so the band scrolls under the bracket as the reader turns.
  On a compact turn the names move, never jump: the band is the same function of the facing the projection is.
- **FR-GUT-3** The bracket.
  A bracket on the band shows the current horizontal field of view: from `facing − h` to `facing + h`, where `h` is half the horizontal field the projection draws in the measured box — derived from `WINDOW_FOV` and the box's aspect through `projection.ts`'s own functions (FR-FOL-5's rule for thresholds: no new constant).
  Sideways the bracket is wider than upright, which is what "turn sideways for twice the sky" means and what FR-GUT-7 says with words.
  *(amended v2.5, V25-14)* Derived from the current field, so it narrows and widens with FR-SKY-14's zoom.
- **FR-GUT-4** A tick per pass.
  Every pass the screen draws (FR-TRAJ-1's set on the live page's screen; the explained pass and the dim others on a pass detail's, FR-DOME-5) is a tick on the band at its **bearing**: the azimuth of the satellite at the shown instant while the pass is under way (`up`), and the rise azimuth otherwise (where to look next), in the pass's series colour (FR-LEG-5) and with its legend key (FR-LEG-1) under the tick when the tick is on the band but outside the bracket.
  Inside the bracket the key is already at the arc's peak on the drawing and the tick carries no letter.
  The tick is at least 2 px wide and 8 px tall, so it is visible without colour (FR-X-5); the key is the channel that names it.
- **FR-GUT-5** Edge markers.
  A pass whose bearing is off the band — more than `GUTTER_HALF_SPAN_DEG` from the facing — becomes a marker at the end of the gutter nearer to it by the shorter turn: `◀ A 110°` at the left end, `A 110° ▶` at the right, the key in the series colour, the angle the whole degrees to turn (the readout's own rounding, no new constant).
  Where two passes share an end their markers stack in legend order and the nearest angle is first.
  *Verification:* the pure module is tested over a table of facings and bearings — in the bracket, on the band, off the band left, off the band right, exactly 180° behind — for the branch and for `x`, in the style of `lib/timeStripe.ts`'s tests; nothing about the gutter is tested through the DOM.
- **FR-GUT-6** The empty-field chip.
  When no drawn pass crosses the field at the shown instant — no arc, no marker, no rise point inside the bracket — one chip stands over the drawing, above the gutter, on `--screen-overlay`: "Nothing in this part of the sky.
  ISS is 110° right, up in 4:12." — the pass whose next event is soonest (FR-FIRST-3's rule), the turn direction as `left` / `right` by the shorter way, the angle as FR-GUT-5 gives it, and the countdown to its next event.
  It is a `role="status"` line in both languages, not modal, and goes when a pass enters the field.
  FR-FOL-5's ground notes take precedence: pointed below the horizon, the ground note is the only line, as it is for FR-FSC-11 today.
  With no drawn pass at all (nothing in the span) the chip says so in one line and names no direction.
- **FR-GUT-7** Portrait stops instructing.
  Held upright — the measured box taller than wide, however the viewport and FR-FSC-10 got it there — the screen is, top to bottom: the facing readout and the `×` on the first row (FR-FSC-3); the next-event block of FR-FIRST-3 (label, headline, the peak line) with the advice as secondary copy on the peak line — "turn sideways for twice the sky" / its Spanish — in `--fg-dim`, not a `role="status"` note and not over the picture; a **band** holding the wide-field drawing, at most as tall as it is wide (`WINDOW_FOV` across its shorter side, so a square band gives the field sideways gives across the phone's 390 px, and the 130° sideways is the "twice"; OQ-28 records the cap as the owner's to confirm), as tall as the screen leaves under the cap; two `--tap` rows of legend under the band (FR-LEG-3's rows, the strip's two rows kept here because portrait has the height and sideways does not); and the gutter at the bottom (FR-GUT-1..6, the bracket narrow).
  FR-FSC-11's `role="status"` advice line is withdrawn: what it said is on the peak line, and the notes over the drawing are FR-FOL-5's ground notes and FR-GUT-6's chip alone.
  FR-FSC-11 is amended, and FR-FSC-4's "the readout, the legend and the `×` are there upright and sideways alike" holds with the legend as the two rows upright and the gutter sideways.
- **FR-GUT-8** Verification and captures.
  The pure module (FR-GUT-5); a component test that the gutter renders a name per compass point in the band, a tick per drawn pass with the key only outside the bracket, an edge marker per off-band pass, the chip only with an empty field and never over a ground note; `sky-screen.spec.ts` at 844 × 390 and 390 × 844 with `stubCompass` for the 68 px (FR-GUT-1), the chip with a heading turned away from every pass, and the portrait layout's five rows in order.
  Captures (FR-FSC-7 as amended): the screen sideways at 844 × 390 with a pass in the field and with the chip, upright at 390 × 844, both themes and both languages; the D-179 set's `sky-screen-*` screens are re-shot with the gutter.

### 4.32 The settings page *(v2.0)*

This is the screen the phone's first run lands on today, and it is the strongest argument in the design phase.
FR-COMP-3 gives the compact home no form — one line, `No place set · [ set a place ]`, linking to `#settings` (D-184) — so a first visit on a phone opens the settings page, where FR-COMP-2's order puts Language and Theme above the thing the reader came for.
Measured at 390 × 844 with no observer the page is about 1020 px tall, roughly 176 px past the fold, so the install offer at its foot is unreachable without scrolling on exactly the visit most likely to want it.
The reference is `redesign/captures/turn-6-settings-page.png`.

- **FR-SET-1** The order inverts.
  *(amended v2.1, V21-17: the Install row's visible label is "App", `settings.installLabel`, so the row reads `App [ Install ]` and not `Install [ Install ]`, F-83; and a native prompt the reader cancels leaves the button working, FR-FAIL-8.)* `#settings` holds, after the header and `[ ← Back ]` (FR-COMP-2's controls, unchanged), in this order: **Location** — the place field (US-1), then one row `[ Use my location ] [ coordinates ]` where `[ coordinates ]` is a disclosure (`aria-expanded`) that opens the coordinate and altitude fields (US-2) under it, open by default when the observer's source is `coords`, then the precision note (US-1 AC4); **Saved places** — FR-OFF-7's list, one row per place (`[ <label> ]`, `(in use)` on the active one, `[ × ]` to remove) and one row `[ Save this place ] [ Clear saved ]` (US-17 and US-8 AC2's clear); **This browser** — one group under one heading holding three rows, each a label and its control on one line: `Language` (FR-I18N-1's `[x] English [ ] Español`), `Theme` (FR-THEME-1's `[x] Dark [ ] Night`) and `Install` (FR-OFF-6 as amended v1.1.2's plain action, shown only while the browser has something to offer); and, at the foot, the privacy line "No tracking.
  Your location is saved in this browser only." (`location.savedHere`'s sentence).
  Language, theme and install are facts about the device rather than about the sky, which is why they are one group and why they are last.
  Every change still applies at once with no save action, and `Esc`, `[ ← Back ]` and the browser's back still return to the home screen (FR-COMP-2).
  Every row keeps FR-COMP-4's 36 cells.
  This amends FR-COMP-2 (V20-5).
  *(amended v2.10, V210-6)* The Theme row offers `Auto` as a third option within 36 cells (FR-PHONE-15).
  *(amended 2026-11-02, the owner's call, PLAN D-1023)* The foot is the app's footer (FR-X-2 as amended) and not the privacy line: the full credits on compact, the one row on wide; the footer's own privacy sentence says what the line said.
- **FR-SET-2** One viewport.
  At 390 × 844 the page MUST fit the viewport with no scrolling — `document.documentElement.scrollHeight <= window.innerHeight` — in both languages, Spanish being the longer and the real test, in two states: with no observer (the coordinate fields closed, no saved place, the install offer shown), and with an observer and `SETTINGS_FIT_PLACES` (2: the artboard's state, and the number a reader who keeps a home and one dark site has) saved places, the offer shown.
  With more saved places than that the page MAY scroll — the reader's own list growing — and the footer's privacy line stays last.
  *Verification:* `tests/e2e/settings.spec.ts` at 390 × 844 in `en` and `es`, both states, asserting the inequality and the privacy line's box inside the viewport.
  *(amended 2026-11-02, the owner's call, PLAN D-1019)* With FR-SET-5's row, the fullest state (an observer, `SETTINGS_FIT_PLACES` places, the coordinates open, the install offer) runs 32 px past 844 and may scroll by at most `SETTINGS_SKY_ROW_PX` (40); the empty state still fits with no scrolling.
  *(amended 2026-11-02, the owner's call, PLAN D-1023)* With the footer at the foot (FR-SET-1 as amended), the fit is the page's above it: at 390 × 844 the header and `main` end inside the viewport in the states above, and the full credits follow under them, so the page scrolls by the footer's height and no more.
  The privacy line's box assertion becomes the `main`'s bottom edge inside the viewport.
  *(amended 2026-11-02, the owner's call on a desk, PLAN D-1033)* On wide nothing scrolls but the place search's pick list: it floats over what follows the field and scrolls inside itself past five rows; and no home pane scrolls sideways.
- **FR-SET-3** Not the first-run destination.
  The location step is on the home screen in every layout (FR-FIRST-1, FR-FIRST-4), so nothing on the home screen links to `#settings` to set a place: `LocationSummary`'s `[ set a place ]` and `[ change ]` links to the route are withdrawn and `[ change ]` opens the form in place.
  The route exists at every width and only the compact header links to it, as FR-COMP-2 says; a reload on `#settings` reopens it; the wide layout renders it if navigated to and never links to it (US-20 AC5).
  This amends FR-COMP-3 and reverses D-184's first-run role (V20-5); D-184's route rule — a screen in the hash router, not a state — stands.
- **FR-SET-4** Captures.
  The settings page at 390 × 844 with no observer and with two saved places, both themes and both languages; the D-179 set's `settings` screen re-shot on `main` by the release task.
  The `docs/mockups/compact-390.html` settings board (FR-COMP-6) is superseded by the artboard for this page and is not re-drawn: the artboard is the reference and this section carries its numbers.
- **FR-SET-5** *(2026-11-02, the owner's call, PLAN D-1019)* **The Sun's glow, a setting.**
  The browser rows gain one, after the theme: the label "Sky" / "Cielo" and one `OptionToggle`, `[ ] sun glow` / `[ ] brillo del sol`, named "The Sun's glow on the horizon" / "El brillo del Sol en el horizonte".
  Off by default and saved when turned on (`sunGlow` in `wiys:prefs:v1`, only `true` stored, a malformed value read as off).
  While it is off, no sky view — the window, the dome or the polar chart, on any page and at any width — draws FR-DOME-6's glow; the Sun still lights the dome, still gives the Moon its bright limb and still has its legend line.
  *Verification:* the prefs slice test (default, saved, cleared, malformed); `Settings.test.tsx` (the toggle writes the store); `SkyChart.test.tsx` (no glow by default, the glow once on); `live-marker.spec.ts` (the polar chart draws no glow on a fresh profile).

### 5.9 v2.0 additions *(proposal; the plan decides)*

- **The mark.**
  `ui/components/mark/`: a `Mark` component that renders two `<pre>` layers of text from a committed rasters asset (body per tier, bead frames per tier as sparse cells) with `size`, `state` (`loading` | `live` | `held` | `still`) and `tier` props, and a timer hook for the bead; `scripts/build-mark.ts` generates the asset and the PNGs through glyphcss in a headless page (the same tool the mockup and hero scripts use), so no glyphcss reaches the main chunk at runtime.
- **The next event.**
  `lib/nextEvent.ts`, pure: `(passes, t) → { pass, event, at, azimuth }` or the empty reason; one `NextEventBlock` component used by the home page and the live page.
- **The states.**
  No slice field: `Live.tsx` derives `scrubbing` from the live slice's held instant; the scrub-block placement (under the box, the rail, the overlay) is a pure function of the mode, the shape and the measured height beside `fitBox` in `lib/layout.ts`.
- **The gutter.**
  `skychart/window/gutter.ts`, pure: bearing → `x`, the bracket's half-width from the projection, and the in-bracket / on-band / off-band branch per pass; `CompassGutter.tsx` renders it as the screen's bottom overlay in `ChartFrame`'s slot where the strip was.
- **The three panes.**
  `App.module.css` gains a third breakpoint literal, `HOME_THREE_PANE_MIN_PX`, pinned like `WIDE_SPLIT_MIN_PX`; `Home` composes the three readings from the components that exist.
- **Settings.**
  `Settings.tsx` re-ordered; a `Disclosure` for the coordinate fields; no store change.

### Phase 2g — v2.0 ("the redesign", as decided 2026-09-09, V20-1)

After the `v1.4.0` tag.
Still no backend and the same two providers.
Six areas from the design phase's approved artboards (`redesign/`, untracked, V20-11), each a section of §4, and nothing else; what is found on the way is written down as a finding for a later phase.
The phase keeps the Phase 2 lettering because "Phase 3" is a name earlier rows use for what comes after the UX phases (V1-1, FR-FIX-1), and a number once printed elsewhere is a name (D-423).

- The mark: construction, the ladder, placement in both headers, the cold open, the manifest and the favicon, the bead's animation as the loading and live/held indicator, and the build step that generates it (§4.29).
  **First in the order of work** (V20-3): it is the only new build step and the headers, the cold open and the live page all lean on it.
- The settings page inverted and fitting one viewport, and the compact home carrying the form again — D-184 reversed (§4.32, V20-5).
  Second: the smallest change, and what makes the compact first run possible.
- The first run: the cold open, one primary action, the countdown first, three readings on compact and three panes on wide (§4.28).
  *(v2.0.2)* As board 1B draws it: no hero mark, the wide cold open's three panes with two dimmed, the phone's first visit as three steps, and light panes — the stripe, the conditions table, the one-line cards.
- The live page's two states at all four shapes, with scrubbing as an overlay on a short wide window (§4.30).
- The compass gutter on the sky screen, and portrait no longer instructing (§4.31).
- *(v2.0.3)* The e2e stage sharded across two jobs, so the phase's own tests stop spending the last seconds of FR-CI-1's budget (V20-24).
  Shipped with the amendment itself: no `src/` file changes, and no task, because the runs it unblocks included the one that would have carried it.
- The release: `package.json` 2.0.0, the D-179 set re-shot with the new and renamed screens, the budgets by the D-178 rule.

Definition of done:
- US-26 AC1..AC6, US-27 AC1..AC6, US-28 AC1..AC6 and US-29 AC1..AC3 accepted; FR-FIRST-1..11, FR-MARK-1..8, FR-WATCH-1..9, FR-GUT-1..8 and FR-SET-1..4 met; the amended FR-LOC-1, FR-X-6, FR-DESK-2, FR-DESK-3, FR-LIVE-3, FR-LIVE-4, FR-LIVE-5, FR-LIVE-7, FR-OFF-6, FR-MOON-3, FR-COMP-1, FR-COMP-2, FR-COMP-3, FR-COMP-4, FR-COMP-6, FR-LEG-2, FR-LEG-7, FR-TRAJ-4, FR-FSC-1, FR-FSC-3, FR-FSC-7, FR-FSC-11, FR-SHP-3, FR-SHP-4, FR-SPAN-2 and FR-SPAN-3 met, with FR-SAT-4, FR-OFF-4, FR-WX-3, FR-MARK-4 and FR-WATCH-2 as amended v2.0.2; US-4, US-14, US-16, US-20 and US-21 as amended met.
- Physics untouched: no task changes the golden fixtures from R1, and `passes.golden.test.ts` passes unchanged.
- Every slice provable on a laptop with no network: `npm ci`, `npx playwright install chromium`, `npm test`, `npm run build`, `npm run bundle:budget` and `npm run e2e` green, the e2e under the strict CSP inside FR-CI-1's ten minutes, the app still connecting to CelesTrak and Open-Meteo alone (FR-X-3); the mark's font and rasters same-origin assets.
- The earlier definitions of done still hold: the golden tests, the FR-GUIDE-6 and FR-LIVE-5 rates on the reference device, the D-179 capture set re-shot on `main` with `live-watching`, `live-scrubbing`, the sky screen's gutter, the cold open and the settings page, and the bundle budgets re-set by the D-178 rule with the mark inside main's.
- The owner has run, on a phone: the first run from a clean browser to a countdown; the live page in both states, one-handed; the sky screen sideways with the chip and upright with the band; and the settings page without scrolling in Spanish — the hand on the glass is not a headless thing (V11-9).
  And on a desk: the three panes with a pass open, and a window dragged short in both states.
- `package.json` version 2.0.0, a `v2.0.0` tag, and the release checklist run on the deploy.
