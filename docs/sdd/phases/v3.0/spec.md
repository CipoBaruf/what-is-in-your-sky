# v3.0 — SPEC.md sections

Phase file of SPEC.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.24 Goals (v3.0, "the sky first")

- **G72. The first thing a visitor sees is the sky, now.**
  Every visit opens on the live sky over the visitor's place (or the example's), at real time, with the next pass one action away; there is no home page to read first.
- **G73. One place, one spot, every page.**
  Where the sky is drawn for is said once, in the same spot of the header, on every page, with one action to change it.
- **G74. A control looks like what it does.**
  A button, an option, a choice, a link and a tab each have one look across the app, and no two share it; the monospace identity, the colours and the dark ground stay.
- **G75. A new version is found within minutes and said on every page.**

**US-62 — The sky on opening** *(v3.0)*
As any visitor, I open the app with no address and see the sky over my place right now, moving at real time.
- AC1: A load of `/` with no hash shows `#live` at both widths, at real time; on wide the view is the globe and the clock ticks at 1× (`● live`); on compact the view is the window (FR-LAND-1, FR-LAND-2).
- AC2: A load with no stored place and a city from the time zone draws the example's sky and the header's place line `Salta · example  change` (FR-LAND-4); with no city the live page shows the place group in place of the sky (FR-LAND-5).
- AC3: `#stars` and a stored link to the old home open `#live`, the stars' layers and list in the live page's rail (FR-LAND-3).
- AC4: No dialog and no card covers the sky on opening, at either width (FR-STRIP-1, FR-STRIP-5).

**US-63 — The next pass, one tap away** *(v3.0)*
As a visitor watching the live sky, I see what passes next and can jump to it and back without a question.
- AC1: With nothing up, the strip reads `Next  ISS · 20:50 · in 1 h 10` with `▶ watch`; tapping it shows the pass playing, and the strip then offers `● back to live` (FR-STRIP-1..3).
- AC2: `● back to live` returns to real time at 1× on wide and to real time, paused at now, on compact (FR-STRIP-3).
- AC3: Leaving `#live` and coming back shows the strip again; nothing is asked once per visit (FR-STRIP-5).

**US-64 — The same dark sky at any hour** *(v3.0)*
As a visitor opening the app by day, I still see a dark sky with its stars, and one line tells me satellites show after dusk.
- AC1: At noon, the window, the dome, the polar chart and the globe draw the deep sky surface and every star rung; the Sun is drawn as its dot (FR-DARK-1, FR-DARK-2).
- AC2: The line `Daytime · satellites show after dusk` is drawn while the Sun is above 0° at the shown instant, and not in twilight or the dark (FR-DARK-3).
- AC3: The settings page has no sun-glow row (FR-DARK-4).

**US-65 — Controls I can read** *(v3.0)*
As a visitor, I can tell at a glance what I can press, what is on, and which page I am on.
- AC1: Every `TextButton` is an outlined box with no brackets; every pressed `OptionToggle` and `ToggleGroup` option is a filled block in `--fg` with `--bg` words; the others are dim words (FR-CTRL-1..3).
- AC2: The header's page links are words; the current page is `--fg` with a 2 px `--accent` underline (FR-CTRL-5).
- AC3: A busy button keeps its label and its box; `Use my location` is the same width before, during and after the search (FR-CTRL-4).
- AC4: The place input and its suggestion list have the same left edge and width (FR-CTRL-7).
- AC5: Every close is the same `×`; every action inside a line of text is underlined blue; every bracketed word is a tag that does nothing when pressed (FR-CTRL-12..14).
- AC6: A picked pass, satellite, star or saved place is raised with a blue line at its left, and every pickable row has a hover (FR-CTRL-15).
- AC7: No scrolling element in the app sits inside another scrolling element at 1280 × 800, 1024 × 700 and 390 × 844 (FR-CTRL-10).

**US-66 — A new version, said in time** *(v3.0)*
As a returning visitor after a release, I am told within minutes, on whatever page I am, that a new version is ready.
- AC1: With a new worker deployed, an open tab that comes back into view shows `New version ready · reload` within 10 s, on `#live`, `#pass`, `#settings` (FR-UPD-1, FR-UPD-2).
- AC2: A tab left open finds it within `UPDATE_POLL_MIN` (FR-UPD-1).

### 4.61 The live sky first *(v3.0)*

The owner's review of 2.16.0 (2026-11-21) found the first screen still a page to read before the sky, the example's Where block unclear on a desk, and the stars page a second copy of the desk's globe.
This phase makes the live sky the app's first and main page, removes the home, and folds the stars page into live.

- **FR-LAND-1** *(V30-2)* **The live page is the first page.**
  The route with no hash is `#live` at both widths: a load of `/`, `/#` or an unknown hash draws the live page and replaces the URL's hash with `#live` without a history entry.
  The home route, its doors (FR-FLOW-1, FR-PHONE-12), its panes (FR-FIRST-5) and the example band (FR-OPEN-3) are removed.
  *Verification:* e2e at 390 × 844 and 1280 × 800 for `/`, `/#` and `/#nope`.
- **FR-LAND-2** *(V30-3)* **What each width opens on.**
  On wide the live page's view is the globe (FR-WIDE-1's layout) with the satellites, the stars, the figures and the planets on it, at real time, the clock running at 1× (FR-STRIP-4); on compact the view is the window, at real time.
  A stored view choice (FR-KEEP-1) still wins at both widths.
- **FR-LAND-3** *(V30-4)* **The stars page folds into live.**
  `#stars` is removed: a load of `#stars` (with or without its parameters) draws `#live` and keeps the parameters `#live` understands.
  The live page's rail (wide) and its controls (compact) gain the stars page's groups: `Turn` (with you / with the stars), `Layers` (stars, figures, planets, names, faint) and the `Up from <place>` list (FR-STAR-7's rows), in that order after `Time`.
  The stars page's entry to the sky screen moves to the live page's controls.
  *Verification:* e2e of a `#stars` link and of each layer on `#live`.
- **FR-LAND-4** *(V30-5)* **The place line in the header.**
  Every page's header carries one place line, centred in the header row on wide and centred on the header's second row on compact: `<city> · example` + a `change` button while the example is the observer (FR-OPEN-1), `<place name>` + `change` once a place is set.
  `change` opens the place group (FR-OPEN-5's group: search, use my location, coordinates, saved places) in a dialog over the page; a place set there closes it and redraws the page for that place.
  The `Example: … · [ set your place ]` strip under the header (FR-OPEN-7) and the Where pane are removed.
  *Verification:* captures of the header at 1280, 1024 and 390 px with the example and with a place; a component test of the dialog's three ways.
- **FR-LAND-5** *(V30-6)* **When there is no example.**
  With no stored place and no example (FR-OPEN-6's cases), the live page draws the place group in the sky's box with the tagline above it, and the header's place line reads `Set your place`.
- **FR-LAND-6** *(V30-7)* **The header's pages.**
  The header's page links are `live`, `satellites` and `settings` / `en vivo`, `satélites`, `ajustes`, at both widths, in FR-CTRL-5's form.
  `satellites` opens the pass list: on wide the pass page (FR-CLEAN-14's `#pass` of the pass up now or next), on compact the list of tonight's passes (FR-FIRST-3's cards and tonight's stripe) at `#pass`, a card opening the pass sheet as today.
  The compact header holds the mark and the three links in 36 cells (FR-COMP-1).
- **FR-LAND-7** *(V30-8)* **The example's day line moves.**
  FR-OPEN-14's line is FR-DARK-3's on the live page; the example has no other first-visit text.

### 4.62 The next pass, without a question *(v3.0)*

- **FR-STRIP-1** *(V30-9)* **The next-pass strip.**
  The live page carries one strip at the foot of the sky's box (compact) or the foot of the rail (wide), always drawn, one text row tall:
  - nothing up at the shown instant and a visible pass within FR-LIVE-2's 24 h span: `Next  <name> · <rise HH:MM> · in <countdown>` and a primary `▶ watch` button;
  - a visible pass up at the shown instant: `Up now  <name> · sets <HH:MM> · look <direction>`;
  - no visible pass in the span: `No visible pass in the next 24 h`.
- **FR-STRIP-2** *(V30-9)* **Watch.**
  `▶ watch` sets the shown instant to the pass's rise − `TONIGHT_LEAD_MIN` and plays: at FR-TONIGHT-5's automatic speed on compact, at 60× on wide.
- **FR-STRIP-3** *(V30-9)* **Back to live.**
  While the shown instant is not real time the strip ends with `● back to live` / `● volver a en vivo`, which returns to real time (1×, running, on wide; paused at now on compact) and clears `t` from the hash.
- **FR-STRIP-4** *(V30-10)* **Desktop plays by default.**
  On wide every sky view opens playing: `#live` at 1× from real time; a pass page (`#pass`) at 60× from the rise, holding 2 s at the set and starting again from the rise until the reader pauses or moves the time.
  A URL holding `t` opens that instant paused, as today (FR-LIVE-9).
  Reduced motion opens every view paused.
- **FR-STRIP-5** *(V30-9)* **No question on opening.**
  The compact card of FR-FULL-10 and the wide dialog of FR-WIDE-13 are removed, and FR-TONIGHT-1's automatic jump with them: `#live` opens at real time and the strip offers the pass.
- **FR-STRIP-6** *(V30-11)* **One play button and the live mark.**
  Play and pause are one button, `▶ play` / `❚❚ pause`.
  The time line ends with `● live` in `--accent` while the shown instant is real time; otherwise with the offset, `+2 h 10 min` or `−35 min`, in `--fg-dim`.

### 4.63 The same dark sky at any hour *(v3.0)*

- **FR-DARK-1** *(V30-12)* **One sky surface.**
  Every sky view fills its sky with `--chart-sky-deep` at every Sun altitude; `--chart-sky-day` and `--chart-sky-twilight` are removed (FR-LOOK-2).
- **FR-DARK-2** *(V30-12)* **Every star at every hour.**
  Every rung of stars and every planet is drawn at every Sun altitude in every view, as the globe already does (FR-STAR-13 as amended); the Sun is drawn as its dot.
- **FR-DARK-3** *(V30-12)* **The daytime line.**
  While the Sun is above 0° at the shown instant, the live page's context line ends with `Daytime · satellites show after dusk` / `De día · los satélites se ven al anochecer`, at `--small` in `--fg-dim`; in twilight and the dark it is not drawn.
- **FR-DARK-4** *(V30-13)* **The sun glow goes.**
  FR-SET-5's setting and FR-DOME-6's glow are removed; a stored `sunGlow` is ignored and dropped on the next save of the prefs.

### 4.64 Controls *(v3.0)*

The look of every control changes, in the primitives only (FR-DS-4): the font, the grid, the tokens, the dark ground and the `──` section rules stay.
Each role has one look: blue is a line or a mark, white is what is on, an outline is what you press.

- **FR-CTRL-1** *(V30-14)* **Buttons.**
  `TextButton` drops its brackets and is drawn as an outlined box: `--border-control`, `--radius-2`, `--fg` words, one `--row` tall plus a hairline above and below, a cell of padding each side; hover and press lay `--bg-raised` under it and the edge in `--fg-dim`.
  The drawn box is smaller than the tap box: the hit area stays `--tap` tall on compact (G6) by an invisible extension, so no row grows.
  The primary form (`box="accent"`, one per screen at most: `▶ watch`, the place dialog's `Use my location`) has an `--accent` edge.
- **FR-CTRL-2** *(V30-14)* **Options.**
  `OptionToggle` drops `[ ]` / `[x]`: an option that is off is its word in `--fg-dim`; on, the word is `--bg` on a block of `--fg` with `--radius-2` and a cell of padding each side; hover lays `--bg-raised` under an option that is off.
  The block is a change of shape and contrast, not of colour alone (FR-X-5), and `aria-pressed` carries it.
- **FR-CTRL-3** *(V30-14)* **Choices.**
  A pick-one set (`ToggleGroup`: the view, the speeds, the turn, the sort, the language, the theme) is FR-CTRL-2's look, the options a quarter cell apart.
- **FR-CTRL-4** *(V30-15)* **A busy button keeps its size.**
  While a button's action runs, its label and box do not change; its words pulse between full and 35 % opacity (still at 35 % under reduced motion), it is `aria-busy`, and the progress words (`Finding your location…`) go in a `role="status"` line under the control.
- **FR-CTRL-5** *(V30-16)* **The header's tabs and back.**
  The header's page links are words in `--fg-dim`, `--fg` on hover; the current page is a span in `--fg` with a 2 px `--accent` underline 6 px under the words.
  `back` is `← back` / `← volver` in `--fg-dim`, `--fg` on hover, with no box.
- **FR-CTRL-6** *(V30-17)* **Section rules in blue.**
  `SectionHeading`'s rules are drawn in `--accent`; its title stays `--fg`.
- **FR-CTRL-7** *(V30-18)* **Inputs and their suggestions.**
  A text input is FR-CTRL-1's box (the same height, edge and radius); hover draws the edge in `--fg-dim`, focus in `--accent` with a 1 px `--accent` ring.
  The place picker's suggestion list is exactly the input's width at its left edge, on `--bg-raised` in a `--border-control` box with `--radius-2`; a row is the name in `--fg` and the region in `--fg-dim` on one line, no `>` and no rules between rows, at least `--target` tall on compact; the active row is FR-CTRL-2's block.
  The placeholder is `e.g. Buenos Aires` / `p. ej. Buenos Aires`.
- **FR-CTRL-8** *(V30-18, V30-25)* **Saved places.**
  A saved place is a row of FR-CTRL-15: the place in use is the picked row; the row has no frame; its `×` is FR-CTRL-12's, `--danger` on hover.
- **FR-CTRL-9** *(V30-19)* **Zoom.**
  The globe and the window carry a row of three keys under the view, at its left: `−`, `+` and `⟲` (back to the view's opening camera), joined into one FR-CTRL-1 box with hairline dividers; the wheel and a pinch zoom by the same steps.
  On first open a hint `drag to turn · scroll to zoom` / `arrastrá para girar · rueda para acercar` sits in the box's corner until the first drag or zoom; it is remembered on the device (`wiys:hint:globe:v1`).
- **FR-CTRL-10** *(V30-20)* **One scroll per column.**
  No scrolling element sits inside another: on wide the rail is the column's one scroll and the lists in it (the pass list, `Up from <place>`) are not capped (V214-33's 7.5-row cap goes); on compact the page is the one scroll.
  *Verification:* an e2e walks every page at 1280 × 800, 1024 × 700 and 390 × 844 and fails on an element with `overflow` `auto` or `scroll` and content taller than its box that has an ancestor with the same.
- **FR-CTRL-11** *(V30-14)* **Links.**
  `BracketLink` drops its brackets: a link in a line of text is the global `a` (accent, underlined).
- **FR-CTRL-12** *(V30-26)* **One close.**
  Every close or dismiss control (the pass panel, the facts group, full screen's exit, the controls sheet, the shortcuts overlay, the link note) is a bare `×` in `--fg-dim` at the top-right corner of what it closes, `--fg` on a `--bg-raised` ground on hover, with a `--target` hit area and the name "Close" / "Cerrar"; a declined offer (`Not now` on the install hint) is an FR-CTRL-1 button.
- **FR-CTRL-13** *(V30-24)* **Actions inside a line of text.**
  A control that sits inside a line of text (`details`, `change`, `retry`, `set your place`, `back to my place`, `keep this place`, `enter coordinates instead`, a pass's clickable times) is drawn as a link: `--accent`, underlined, with no box and no brackets, whether it navigates or acts; it keeps its own element (`<button>` or `<a>`) and the `--tap` hit area of `inline-control`.
  An action that stands on its own row is FR-CTRL-1's box.
- **FR-CTRL-14** *(V30-23)* **Tags keep the brackets.**
  A label that cannot be pressed (a pass's `[twilight]` and `[faint]`, the cloud tags `[clear]` / `[partly]` / `[obscured]`, a banner's `[info]` / `[warning]`, the Moon's tags) is a new `Tag` primitive: the word in brackets in its tone, never underlined, never with a hover ground.
  Brackets in the app then mean a label and nothing else: FR-DS-2's bracket allowance narrows to `Tag`.
  The cloud and Moon tags keep their explanation on hover and focus.
- **FR-CTRL-15** *(V30-25)* **Rows you can pick.**
  A row or card that opens or picks something (a pass card, a row of the pass list, a satellite in the legend, a star or planet in `Up from <place>`, a saved place) has no frame; hover lays `--bg-raised` under it; the picked one is `--bg-raised` with a 2 px `--accent` line down its left edge and `aria-current` or `aria-pressed`; its name keeps its colour.
  Card's `selected` frame and the legend's and the star list's accent names go.
- **FR-CTRL-16** *(V30-27)* **Every other control takes one of the looks.**
  - Standalone buttons are FR-CTRL-1's box: the step buttons (`|◀ pass` … `pass ▶|`), `controls`, `full screen`, `share` (its edge form goes), `Install`, `reload` (the error page and the update bar), `retry` on its own row, the dialogs' answers (the first one primary).
  - On/off is FR-CTRL-2's option: `follow` (today a pressed `TextButton` on compact); the night groups' `[+]` / `[−]` become a disclosure, `▸ Tonight · 3` / `▾ Tonight · 3`, the whole line the control.
  - The custom sliders (the time track, the stripes) keep their accent thumb: blue is a mark.
- **FR-CTRL-17** *(V30-27)* **Feedback.**
  - Progress is one `role="status"` line in `--fg-dim` under or after its control (FR-CTRL-4); an error is one `role="alert"` `Line` `failure` in `--danger` in the same place, the same for every form (UseMyLocation's own error style goes); an empty list is one dim line; success is `Line` `ok`.
  - A disabled control keeps its shape with its words in `--fg-dim`, its edge in `--rule`, and no hover.
  - Focus is the one global ring at every control, fields excepted (FR-CTRL-7).
  - A dialog (`AskDialog`) is a `--bg-raised` frame with `--border-control` and `--radius-2` on the dimmed page.
  *Verification:* a component test per primitive form; `tests/styles/literals.test.ts` fails a bracket outside `Tag`; the capture set's control rows.

### 4.65 New versions *(v3.0)*

- **FR-UPD-1** *(V30-21)* **Look for a new version.**
  The app calls the service worker registration's `update()` on load, whenever the page becomes visible, and every `UPDATE_POLL_MIN` (30) while visible; rationale: a release is a handful of files and the check is one request for `sw.js`.
- **FR-UPD-2** *(V30-21)* **Say it on every page.**
  The `New version ready · reload` / `Nueva versión lista · recargar` bar is part of the shell, under the header on every page, not the home's (FR-OFF-1); `reload` activates the waiting worker and reloads; the bar stays until then.
  It is never drawn over the sky's box.

#### Amended

- **FR-FLOW-1**, **FR-PHONE-12**, **FR-FIRST-5** *(removed v3.0, V30-2)*: the home and its doors and panes are gone (FR-LAND-1).
- **FR-OPEN-3**, **FR-OPEN-4** *(amended v3.0, V30-5; before: the example band on compact, the Where pane on wide)*: the example is the live page's observer, said by the header's place line (FR-LAND-4).
- **FR-OPEN-5** *(amended v3.0, V30-5)*: the place group opens in the place dialog of FR-LAND-4.
- **FR-OPEN-7** *(amended v3.0, V30-5; before: a line under the header)*: the line is the header's place line.
- **FR-OPEN-14** *(amended v3.0, V30-8; before: the example's own line)*: FR-DARK-3's line.
- **FR-FIRST-1** *(amended v3.0, V30-6)*: the cold open is FR-LAND-5's form in the live page's box.
- **FR-STAR-3** *(amended v3.0, V30-4; before: a page `#stars`)*: the stars are the live page's layers and list (FR-LAND-3).
- **FR-CLEAN-14**, **FR-COMP-1** *(amended v3.0, V30-7, V30-16; before: `[ home ] [ live ] [ stars ]` as BracketLinks)*: FR-LAND-6's links in FR-CTRL-5's form.
- **FR-FULL-10**, **FR-WIDE-13**, **FR-TONIGHT-1** *(removed v3.0, V30-9)*: FR-STRIP-5.
- **FR-LOOK-2** *(amended v3.0, V30-12; before: three tints by the Sun)*: one surface (FR-DARK-1).
- **FR-STAR-13**, **FR-SKY-3** *(amended v3.0, V30-12; before: stars thinned by the Sun)*: every rung at every hour (FR-DARK-2).
- **FR-SET-5** *(removed v3.0, V30-13)*: FR-DARK-4.
- **FR-X-6** *(amended v3.0, V30-14, V30-23; before: "bracketed controls")*: "outlined buttons, filled options, underlined tabs, bracketed tags" (§4.64).
- **FR-DS-2** *(amended v3.0, V30-23; before: brackets allowed in the control primitives)*: brackets are allowed in `Tag` alone.
- **FR-WIDE-1** *(amended v3.0, V30-20; before: the list takes what is left and scrolls)*: FR-CTRL-10.
- **FR-OFF-1** *(amended v3.0, V30-21; before: the banner on the next load, on home)*: FR-UPD-1, FR-UPD-2.
- **FR-MEAS-2**, **FR-MEAS-6** *(amended v3.0, V30-22)*: `open` is counted on `live`; `example_shown` is sent when the live page first draws the example's sky; `where_shown` when the place dialog opens; `door` is removed; `watch` is added, sent once per visit when `▶ watch` is first pressed.

#### Definition of done

- FR-LAND-1..7, FR-STRIP-1..6, FR-DARK-1..4, FR-CTRL-1..17, FR-UPD-1..2 and the amendments above met, each by its verification; US-62..US-66 by their criteria.
- The capture set re-shot; every capture moves (§4.64), and the release record names the moves by requirement.
- `npm test` green; no bundle row over 2.16.0's by more than 1 KB without a named reason.
- `npm run funnel` over the 14 days before and the 14 after the release, compared in the release record (V30-22).
- `package.json` reads 3.0.0; the tag and the deploy are the owner's.

### Phase 2z — v3.0 ("the sky first", as decided 2026-11-21, V30-1)

After v2.16, which shipped as 2.16.0 on 2026-11-21.
The live sky is the first and main page at both widths; the home goes and the stars fold into live; the next pass is a strip, not a question; the sky is dark at every hour; every control gets one look per role; a new version is found and said on every page.
Goals G72–G75, §4.61–§4.65, FR-LAND-1..7, FR-STRIP-1..6, FR-DARK-1..4, FR-CTRL-1..17, FR-UPD-1..2 and the amendments listed, US-62..US-66; the decisions are V30-1..V30-27.
