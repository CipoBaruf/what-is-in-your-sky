# v2.6 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.41 v2.6 decisions (2026-10-27)

SPEC v2.6 does not move any physics, scene or camera code.
What it changes is where things are placed on every page, at both widths.
The risk is the same one that caused the audit's findings: three pages each laying out the same parts their own way.
So the decisions below give the order to one component, the header to one component and the measures to two e2e specs, and the pages only fill slots.
The owner's design canvas (V26-1, https://claude.ai/artifact/T9sDydFaRQNAMy5zVcSi7q, pages Phone and Desktop) is each task's visual reference, matched to 1–2 px as the redesign's screens were: copy, sizes and gaps.

- **D-842 — One layout for a sky view, filled by slot.**
  (FR-FLOW-4, FR-FLOW-9; V26-5, V26-9.) A new `components/sky/SkyViewLayout.tsx` takes named slots — `answer`, `viewRow`, `readout`, `drawing`, `picker`, `hint`, `action`, `layers`, `list`, `foot` — and renders them in FR-FLOW-4's order: on compact as one column, on wide as the box (readout and zoom on its corners, V25-17; `hint` under it) and the rail (`answer`, `viewRow`, `picker`, `layers`, `list`, then `foot` pinned to the rail's bottom).
  `Live.tsx`, `Stars.tsx` and `PassDetail.tsx` stop laying out their sky parts themselves and pass slots; an empty slot renders nothing.
  `usePageShape` stays the one source of compact or wide.
  The layout owns the gap between slots (FR-FLOW-10's three tokens), so a page cannot add a gap of its own.
- **D-843 — The doors are one component reading what the home already has.**
  (FR-FLOW-1; V26-2, V26-3, V26-9.) `screens/home/HomeDoors.tsx` draws the three doors, and the pure `screens/home/doorLines.ts` builds each door's lines from the next event (FR-FIRST-3's), the dark window and cloud word (the conditions the When reading already reads), the passes up now and the highlighted pass's landmark (`lib/landmarkLine.ts`).
  The Stars door's second line is `brightestDrawn(scene)` in `lib/skyStars.ts`: of the stars and planets that `drawnRungs` and `planetsDrawn` draw above 0° at now, the one with the lowest magnitude, with its 16-point direction.
  It lives in the `stars` chunk and is called once `starsChunk.ts`'s idle prefetch resolves.
  Until then the line keeps its height (`min-height: 1lh`), so nothing moves when it arrives.
  The Satellites door's `href` is `#pass/<id>` of the next event's pass, or `#what` with no pass in the span.
  The When reading's `StarsLine.tsx` and the next-event block are removed from the home at both widths.
  `components/location/WhereDome.tsx` and its lazy load are deleted (FR-FIRST-11 as amended), and its bytes are credited to `main` (D-853).
- **D-844 — Where folds by a prop and never folds a fault.**
  (FR-FLOW-2.) `WherePlace.tsx` gains `folded` (compact only), which renders the place with `[ change ]` and one status line ending in a `<button aria-expanded>` `[ details ]` that opens the rest in place, in FR-FIRST-11's order.
  The status line is the first fault of `ReadinessLine`'s not-ready state, the elements warning and `FailureLine`, when one is present, and is otherwise "Ready offline · elements <age> old".
  A fault never collapses into it.
- **D-845 — One `Header`, told its page.**
  (FR-FLOW-3; V26-4, V26-9, V26-10; FR-COMP-1, FR-COMP-7, FR-DESK-2 as amended.) `components/common/Header.tsx` takes `page: 'home' | 'live' | 'stars' | 'pass' | 'settings'` and an optional `context` (the place, or the pass's date).
  **Compact:** the home keeps today's row (mark, title, `[ live ]`, `[ settings ]`); every other page gets `[ ← ]` (FR-COMP-7's control and its accessible name), the page's name in the accent, and the context cut by `text-overflow: ellipsis`.
  **Wide:** one row on every page: `[ ← ]` on a sub-page, the mark and title, a `<nav aria-label>` of `home`, `live`, `stars` with `aria-current="page"` on the current one (drawn `--fg` with a 2 px accent rule under it), the context on a sub-page, and `[ settings ]` last.
  `LanguageToggle` and `ThemeToggle` are removed from `Header.tsx` and `PassDetail.tsx` and stay only on `Settings.tsx`.
  `Live.tsx`'s own top row is replaced by the header.
  The tagline renders on the home only, under the row.
- **D-846 — The view row is the picker's idiom plus the stars toggle.**
  (FR-FLOW-4.) The chart view control renders through `ToggleGroup`'s bracket form (the chosen view `[Window]`, the others plain), as the facing picker does, and `components/live/StarsToggle.tsx` sits at the row's right end in the `viewRow` slot.
  The pass detail's and the live page's view rows are this one row.
  On wide the rail labels the rows `View` and `Facing` (`Vista`, `Hacia`).
  `controlRows.test.ts` gains the row at 360 and 390 px in both languages (35 cells at most in Spanish).
- **D-847 — "Facing" is three strings.**
  (FR-FLOW-5.) `chart.readout` keeps "Facing … · tilt …" and becomes "Hacia el …" in Spanish.
  `window.readout` and `starsPage.readout` become "Facing <point> (<az>) · up <alt>" / "Hacia el <point> (<az>) · <alt> de altura" (the stars page keeps "· <n>° across").
  `messages.test.ts`'s snapshot is re-baselined, and nothing else reads the old words.
- **D-848 — The hint is the layout's, worded by the pointer, gone after a gesture.**
  (FR-FLOW-6.) `SkyWindow.tsx`'s `handHint` paragraph moves out of the SVG overlay into `components/sky/SkyHint.tsx` in the `hint` slot.
  It reads `matchMedia('(pointer: coarse)')` once per mount, and the live page passes `followKey` for the "· tap A to follow" clause.
  `model/prefs.ts`, `state/slices/prefs.ts` and `data/localPrefs.ts` gain `skyHintSeen: boolean` (default false, with a schema test).
  `useChartHand.ts` calls `onFirstGesture` on the first drag, pinch or tap, which sets it.
  The dome and the polar chart get the same hint (drag only) from the same slot.
- **D-849 — The pass detail's head is a slot, and its share is a constant.**
  (FR-FLOW-7.) `PassDetail.tsx` fills `answer` with the name (`h1`), the `Countdown`, the landmark line and a three-cell times row (`components/guide/TimesRow.tsx`), and puts the prose and the table of points in `list`.
  On wide the guide panel lays out `answer` as one band (name, countdown and landmark left; times right; close last), and the drawing takes the panel's remaining height.
  `lib/layout.ts` gains `DETAIL_DRAWING_TOP_PX = 480` and `DETAIL_DRAWING_MIN_SHARE = 0.6`, each with the rationale from the spec.
- **D-850 — The box is cut from what the frame measures, on compact from the bowl.**
  (FR-FLOW-9; F-61, D-615, V25-18.) On compact `ChartFrame.tsx` cuts the dome's box from the bowl's drawn silhouette with `fitBox.ts`'s rule (F-61's divisor 2.0), so the box is the bowl's height plus `DOME_COMPACT_SLACK_PX` (24) above and below, never under FR-LIVE-7's floors.
  On wide the box's height is the viewport less the header and the hint line, for every view, on the live page and the stars page.
  `lib/layout.ts` holds the constant.
  The dome's scene key is unchanged (F-60's lesson: a size change is a remount only through the existing measured key).
- **D-851 — Blocks are marked, gaps and targets are measured.**
  (FR-FLOW-10, FR-FLOW-11.) A block that counts for rhythm carries `data-rhythm="row" | "group" | "section"`, set by `SkyViewLayout` and the home's readings, not by hand in page markup.
  `tests/e2e/rhythm.spec.ts` reads, at 390 × 844 in both languages, the gap between consecutive marked siblings and checks it against the computed `--space-1`, `--space-3` and `--space-5` (± 1 px), and checks that a row gap ≤ a group gap ≤ a section gap.
  Targets grow by one primitive class, `.target` in `ui/styles/primitives.css` (`min-block-size: 44px; min-inline-size: 44px; padding-block` to fill), applied by `ToggleGroup`, `OptionToggle`, the header's links and the doors.
  A dense row (the facing picker) uses `.target-row`, which gives its items 44 px height and stretches them with `flex: 1` so their hit areas meet.
  `tests/e2e/targets.spec.ts` enumerates `a, button, [role=radio], input` on the five pages and the sky screen at 390 × 844 and asserts the rule, skipping links inside `p`.
- **D-852 — The legend's times get their words in the legend.**
  (FR-FLOW-13.) `skychart/Legend.tsx`'s pass row renders its second line as `rise … · peak … · end …` from new `chart.legend.rise/peak/end` strings, at both widths, with Spanish `sale` / `máximo` / `termina` (V26-13: `end`, not `set`, since a pass often ends in Earth's shadow).
  `Legend.test.tsx` covers both languages.
- **D-853 — The budget: within D-841's 175.**
  (FR-FLOW-12; D-178, D-841.) `main` measured 173.0 KB at 2.5.0.
  The doors, the folded Where, the header's nav, the hint and the layout add at most `FLOW_MAIN_KB` (1.5), and `WhereDome`'s lazy import and its wrapper leave `main` (its chunk row is removed if it had one).
  So `main` stays ≤ 174.5 under the 175 ceiling and budget, and no ceiling moves.
  `stars` grows by `brightestDrawn` only (≤ 0.5 KB).
  The release re-sets every row by D-178.
- **D-876 — The phone's default view is a rule in the prefs reader, not in a page.**
  (FR-FLOW-14; V26-11.) `data/localPrefs.ts`'s `chartView` reader returns `undefined` when nothing is saved, and `screens/chartViewDefault.ts`'s pure `defaultChartView(mode, saved)` returns the saved view, else `'window'` on compact and `'dome'` on wide.
  `Live.tsx` and `PassDetail.tsx` read it through it.
  The live page's opening camera is `skychart/window/camera.ts`'s new `openingFacing(scene, highlighted, nextPass)`, which returns the follow state (D-797's `followPass`), the next rise, or today's default, in that order.
  `chartView: 'window'` is saved on compact as on wide (the D-789 wide-only guard is removed).
- **D-877 — Landscape is `SkyViewLayout`'s third arrangement, keyed by the shape.**
  (FR-FLOW-15; V26-12; FR-SHP-1, D-173.) `SkyViewLayout` reads `usePageShape` and, for the landscape phone, renders the box left (full height, at least 55 % of the width) and the rail right with `overflow-y: auto`, which is the wide arrangement's slots at the compact type size.
  The camera, `t`, playback and the disclosures already live above the layout in page state, so the turn re-renders and remounts nothing (F-60's lesson: the box's size reaches the dome only through the measured key).
  No orientation listener opens the screen.
  `lib/layout.ts` gains `LANDSCAPE_DRAWING_MIN_SHARE = 0.55`.
- **D-854 — Delivered as v2.5 was.**
  (V26-8; D-800, D-801.) Gate `auto` on every task, `fable` only for the two hard tasks (D-842's layout across three pages, D-850's box), `opus` for the rest, with the budget and the schedule in §16.24's shape.
- **D-855 — On the live page the state indicator is the compact header's name.**
  (R129; FR-FLOW-3, FR-COMP-7, FR-WATCH-2; D-845.) `Header` takes a `status` node drawn in the page name's place; `Live.tsx` hands it the `StateIndicator` where the compact top row had it.
  Watching, the indicator's word is `live` / `en vivo`, which is the page's name; drawing the name beside it would take 8 cells in Spanish, and at 360 px the place would lose FR-COMP-7's whole coordinate pair (`[ ← ]`, the mark, `en vivo` and the gaps are 17 of the row's 33 cells; with `en vivo` twice, 25).
  Where the indicator stands in the rail, and on the inert page, the plain name is drawn.
  The live page renders the header as a `div` (`landmark={false}`) inside its own `banner` (D-529), and the sky screen still makes the `live-top-row` box around it inert.
  On wide that header draws no rule — the page's grid draws its own rows — and its `[ ← ]` keeps the boxed form Back had there, so the top row is still the tap row `LIVE_KEPT_ROWS_PX` counts and the short window's fold still takes it to one text row (FR-SHP-3); F-100's ring rule in `Live.module.css` reaches Back through a class of the live page's own that it hands the header (`backClassName`), not through Header's markup.
- **D-856 — Who has which heading and which Back.**
  (R129; FR-FLOW-3, FR-A11Y-1, FR-A11Y-4; D-845.) The compact settings header's page name is the page's `h1` (`ajustes` / `settings`); on wide its `h1` is the title, as the home's.
  The live and stars pages keep their own `h1` and the title is a paragraph there.
  The settings page's own `[ ← Back ]` row goes: the header's `[ ← ]` is the page's way back (`data-testid="settings-back"`; `settingsShell` hands the header and the chunk one ref to it, which the page focuses on entry).
  The compact pass sheet's header is a `div` (a second `banner` inside the dialog otherwise); the wide pass detail is the home's panel, so its header stays the home's (`page="home"`) and the panel keeps its own close and `[ list ]`.
  The header's `[ ← ]` is `TextButton`'s `inline` form at both widths, so F-100's flush focus ring is the primitive's plus one `--focus-offset: 0` in `Header.module.css`.
- **D-857 — The wide row needs no title fold; `home` leaves the whole stack.**
  (R129; FR-FLOW-3, FR-HOME-1; D-546, D-774, D-845.) Without the switches a sub-page's wide row — the two paddings, `[ ← ]`, the mark and the full title, `home live stars` two cells apart, `[ settings ]`, two-cell gaps — is 89 cells in Spanish and 79 in English, so with a context of ten cells it fits the 100-cell wide breakpoint: the title's short form and the live link's short word (D-605, D-774) are gone, `HEADER_FOLD_PX` keeps the two tagline folds only, and the context is what ellipsises: it shrinks first (`flex-shrink` 1000), then the title, cut with an ellipsis rather than drawn over the links; `[ ← ]`, the links and `[ settings ]` never shrink.
  The nav's `home` link calls `navigation.home()`, which goes back by the entry's whole depth (`history.go(-depth)`) — `close` would step back one entry, and a reader who went stars → live would land on the stars — and, since the entry it lands on is the load's and can be a route itself (a bookmark on `#stars`, a reload on a pushed entry), clears that one in place once there.
  A modified click on it is the browser's, as on the shell's route links.
  The stars page's visible `h1` carries a line at `--small`: the dark window as the conditions table words it and the cloud word for the middle of the night (the home's `useNight` reading, on the page's own clock rather than a second timer), joined by ` · `.
- **D-858 — The folded Where puts a failure first.**
  (FR-FLOW-2; D-844; R130.) A failed elements load always leaves the readiness line not ready too (no elements, no job), so D-844's order — not-ready, then the warning, then the failure — would never show the failure or its `[ retry ]`.
  `WherePlace`'s status line takes the elements load's failure first, with `[ retry ]` and `[ details ]`, then the not-ready state, then the elements warning; with none it is "Ready offline · elements <age> old", or "Elements <age> old" while the readiness line is still waiting.
  Each fault line is the fault's own sentence in its own tone and ends in the fold's `[ details ]`; the not-ready and warning lines are the readiness and elements lines' words, which the opened panel still draws in full.
- **D-859 — The doors' words are their own, sized to 34 cells.**
  (FR-FLOW-1, FR-COMP-4; D-843; R130.) `src/i18n/{en,es}/home.ts` carries a `doors` section and a `whereFold` one, merged into the catalogs after the lane files.
  The door has its own short cloud words (`Clear`, `Partly cloudy`, `Cloudy`, `No forecast`; `Despejado`, `Algo nuboso`, `Cubierto`, `Sin datos`) and its own up-now line (`Up now · into shadow in 2:05`, `Arriba · a la sombra en 2:05`), since `weather.state`'s and the next-event block's do not fit after the dark window or in Spanish.
  With no zone yet the dark line and the `No full dark` line both drop the cloud word, to make room for F-27's `UTC` (there is no forecast then either).
  A name too long for its line is cut with an ellipsis, never the path; a landmark star that does not fit leaves the Both door's count alone.
  The Satellites door's target is the cards' `#pass=<id>` (`passIdHash`), the hash the pass detail already opens on; with no pass it is `#what`, the What reading's own id, so a new tab or a copied link lands on the reading; a plain click is the door's: the page scrolls to the What reading and its heading takes the focus, and the hash is not touched, while a modified or middle click is left to the browser.
  The doors are a labelled list of links (`Where to look` / `Dónde mirar`), not a `nav`, so the home keeps one navigation landmark.
- **D-860 — The stars chunk answers the doors through two exports.**
  (FR-FLOW-1; D-843; R130.) `Stars.tsx` re-exports `brightestNow(observer, t, lang)` (`stars/source.ts`, over `brightestDrawn`, naming the star by D-832's reader and a planet by the stars page's own words) and `moonNow(observer, t)` (`lib/skyStars.ts`: the lit part and the next set while up, the next rise while down, within a day) for the wide Stars door's third line; the Satellites door's wide line is the scene's landmark at the next event's peak through `starSource().sceneAt`, worded by `lib/landmarkLine.ts`.
  `useDoorSky` takes the module from `prefetchStarsWhenIdle(onLoad)` — the home now prefetches the chunk on idle — and re-reads it once a minute; a chunk already loaded is read at once (`loadedStarsChunk`), so doors mounted again on the way back from `#stars` or `#live` do not blank, and while it is not in the doors ask again each minute, since `loadStarsChunk` does not keep a failure.
  It reads `brightestNow` before `sceneAt`, so both use the one rotation at that minute.
  `moonNow` takes up or down from the search itself — which of the next rise and the next set comes first — not from the centre's geometric altitude, which just after a refracted rise would still say down and ask for a rise a lunar day away; with neither within a day it falls back to the centre's altitude.
  On compact the folded Where mounts `[ details ]`' readiness and elements lines only while open, so the status line is their one reader while folded.
  `lib/layout.ts`'s `whereDomeSize` and its test went with `WhereDome`.
- **D-861 — The legend's three words replace R85's `times`.**
  (R131; FR-FLOW-13, D-852, D-565.) `chart.legend.times` (`rise`/`peak`/`end`, `sale`/`culmina`/`termina`) is gone; `chart.legend.rise/peak/end` are the only words for a row's times (V26-13).
  The row's first line is the name and the state (`SAT 0 · soon`), the second `rise … · peak … · end …` with the separators as text, so the drawn line is also the row's accessible name.
  The pass detail's dim rows keep rise and end alone (FR-LEG-3).
  The sky screen's one-line strip (FR-FSC-3) keeps its bare figures and the state after them, the words in `sr-only` as before: its width is the name's, and FR-FLOW-13 names wide and compact, not the strip.
  The short wide inventory's header row is dropped by D-863.
- **D-862 — `starsPage.readout` gains the azimuth.**
  (R131; FR-FLOW-5, D-847.) The stars page's string becomes the window's line plus the field width, so it takes `azimuth` like `window.readout`.
  Nothing draws it today — the stars page's box shows `window.readout` with `window.field` — so the change is the catalog's and its test in `messages.test.ts` alone.
- **D-863 — The named times fit the rows they are on.**
  (R131's review; FR-FLOW-13, D-852, D-549.) Measured at 1200 × 450, the named times with a zone after each (`rise 03:55:46 UTC · peak … UTC · end … UTC`) were 539 px in the short wide inventory's 530 px rail and clipped the end time; at 1920 × 1080 every row wrapped to three lines.
  So the zone is written once, after the last time (`rise 03:55:46 · peak 03:55:59 · end 04:00:47 UTC`, FR-FLOW-13's own example has none per time); the separator closes the time before it and a time is `nowrap`, so a narrow column wraps between whole times and no line starts with `·`; the short wide inventory keeps rise and end, as the sky screen's strip and the pass detail's dim rows do, since its line never wraps and three named times with `GMT-3` in Spanish are 56 cells; its `aria-hidden` header row is dropped, since every row names its own times; and the state stands outside the name's text, so the inventory's ellipsis cuts the name and never the state.
  After it: the inventory line 530 of 530 px, the 1920 rows two lines, the 1280 one-column rows three (376 px is 39 cells).

- **D-864 — The chart's parts reach the layout by portal, and the frame is untouched.**
  (R132; FR-FLOW-4, D-842.) `SkyViewLayout` renders the page's slots as grid items named by area — one DOM order, three `grid-template-areas` (the column, the box and the rail, the guide's panel) — and the gap above a slot is its rhythm's token as a margin (`data-rhythm`, D-851).
  The view control, the readout, the facing picker and the legend are drawn by `SkyChart` and its views, which know nothing of the page; a page puts `<SkyViewChartSlot name="control" | "readout" | "picker" | "list" />` where it wants each, and the chart portals the part there (`useChartSlot`) and draws nothing in its frame's own row — `ChartFrame.tsx` is not changed, its emptied rows are hidden by the layout's stylesheet and its grid re-cut to the box alone, the device the stars page used since R115.
  The polar chart's orientation control stands in the `picker` slot, its convention line in `readout`.
  The pass detail's chart is `fill` on both shells, so the box is the layout's to size (the frame's floor on the phone; on the panel `--sky-drawing-h`, measured from the body's height and the control line, so the drawing takes the rest of the body and the prose and the table follow under it); the figure has no caption and is `aria-describedby` the prose in `list`.
  The compact portrait live page is a column that scrolls past its box (`data-column`), since FR-FLOW-4 puts the actions, the legend, the conditions and the stripe under the hint; every other shape is one viewport high.
  On wide the live page's rail is the layout's and the frame has no aside: it is `stacked` and cuts the box to the dome's aspect inside the drawing slot, and the scrub block is the rail's foot (FR-FLOW-4 wide: the stripe and the actions), except on the short wide window, where it stays the frame's bar over the box (D-449).
  R85's inventory clip measures the layout's `list` slot less the conditions line under the legend, and R78's fold correction (`unfoldedBoxHeightPx`) is gone, since a fold gives the box nothing back.
  From R132's review: the hint (D-848) is the dome's and the window's only — the polar chart has no drag, so it gets no hint, and a gesture on any view that has one still puts it away; a page asks `useSkyHintShown` and hands the `hint` slot nothing when there is no line, so no empty slot or gap is left; the view a page words the hint by is `shownChartView`, the rule `SkyChart` draws by; the stars page, whose window has its own camera and no hand slot, marks the hint seen on a pointer down in its box; the figure, captionless in a layout, is named by the page's heading where it gives one (`labelledBy`, the pass's name) and as the live page's otherwise; and on the landscape phone that fills its height the hint wraps under the box instead of cutting its follow clause, the box giving up the hint's measured lines (`--sky-hint-h`, one row at least) — so a Spanish line that wraps when a pass gains a key moves the box by a line, which R136's landscape arrangement settles.

- **D-865 — Rows that cannot fit FR-COMP-4 are cut to it, and the stars box is four to three for now.**
  (R132; FR-FLOW-4, FR-FLOW-8, FR-COMP-4.) FR-FLOW-8's first layer row, `[x] stars [x] figures [x] planets`, is 33 cells in English and 38 in Spanish, two past the 36 a 390 px phone has, so the split is cut to the budget (`firstRowCount`): three then two in English, two then three in Spanish (25 and 34).
  The view row is 29 cells in English and 34 in Spanish as `cells.ts` counts it (one cell between controls; the spec's 30 and 35 count the two at the row's end), inside 36 at 390 px; at 360 px the widest font gives the row 33, so the Spanish row wraps `[x] estrellas` under the control there — pinned in `controlRows.test.ts` as a finding for the spec, not hidden.
  With the rows FR-FLOW-4 puts above it, `In this field`'s heading and first row stood 50 px under the fold at 390 × 844 beside a square box, so the stars page's compact box is four wide to three tall (`Stars.module.css`, the frame's floor off by D-233's switch) until R133, which reads `sky-layout.spec.ts`, decides the fit.
  `[ hold up to the sky ]` is the accent box at the column's width (FR-FLOW-8's 48 px).

- **D-866 — The panel's share is of its body, and the head's lines are the spec's.**
  (R132; FR-FLOW-7, D-849.) At 1280 × 800 the guide panel is 818 × 442 px — the home's right-hand column under the header and the question, above the footer — and the head band FR-FLOW-7 asks for (the name, the countdown at the headline size, the landmark line, the three times) is 138 px of it, the control line and the hint another 80, so 0.6 of the whole panel is unreachable by any head the requirement allows (a one-line head would be 0.63).
  `DETAIL_DRAWING_MIN_SHARE` is read against the panel's body — what the head leaves, which the drawing takes "the rest of" — where it is about 0.65; `lib/layout.ts` and `sky-layout.spec.ts` say so.
  In the band the name's column is 36 cells at least and the times wrap their cells before the name wraps its letters (measured: a 193 px column wrapped the name and the countdown to two lines each and the body to 158 px).
  The pass's name is the `h1` of the compact sheet, which is the whole screen, and the `h2` of the wide panel, which stands beside the home's `h1`; the date line stays on the panel's band and leaves the compact head, where the header carries it (R129).
  The spec's "zoom `+`/`−` on the box's corner" names controls the window does not draw (the zoom is the pinch, the wheel and the keys, FR-SKY-14); nothing was added.

- **D-881 — The landscape rail scrolls inside the layout, and the panel's drawing has a floor.**
  (R132, numbered after the reserved blocks since its own D-864..D-866 were full; FR-LIVE-7, FR-WATCH-5, FR-WATCH-7, FR-FLOW-7.) On the landscape phone the layout takes the rail form with the compact tokens, and the rail's rows — the answer, the view row, the facing row, the list, the foot — come to 374 px at 844 × 390 against the 348 the page has under its top row, so something has to scroll.
  A page that grows with its rows (the first cut) let the page scroll and the box, which spans every rail row, grow with the rail: `[ see this pass ]` and the scrub block each made the box taller (FR-WATCH-7 says nothing the sky does resizes it).
  Now a page that gives the layout a height says so (`fill`, the live page, one viewport high wherever there is a rail), and the layout is the scroll box there: `overflow-y: auto`, a size container, the box and the readout sticky at the top at the layout's height less the hint's row (`100cqh`), the hint sticky at the bottom, and the rail's rows scrolling between them.
  Two things the grid does in that state are written down: a grid shorter than its rows hands out no free space, so an auto row is its items' *minimum* contribution and the list's `min-height: 0` (the wide rail's row that gives) has to go back to `auto` there; and the browser's scroll anchoring is off, so a swap of the head and the foot with the state never moves the rail under the reader's thumb.
  A page without `fill` (the stars page, the sheet) keeps the growing layout and scrolls as a page; whether every row fits the landscape rail is R136's, and `[ scrub ]` at the rail's foot is below the fold there meanwhile (`enterScrubbing` scrolls the rail back to read its head).
  On the panel, a short window (964 × 700: the band wraps its times under the name and the body has 46 px left) measured the drawing to 0 px; it keeps seven rows at least and the body scrolls to the prose (D-119).
  The wide rail is content-sized between 44 and 60 cells, so a row the state or the jump control changes can move the box's cut by a pixel; `shapes.spec.ts` allows that pixel and R133, which sizes the box, decides whether the rail's width should depend on its rows at all.
- **D-870 — The home's sections are measured across its columns, the settings page's blocks are groups, and a gap the layout owes is named, not skipped.**
  (R134; FR-FLOW-10, D-851.) `rhythm.spec.ts` calls two marked blocks consecutive when they share their nearest marked ancestor (or have none) and follow in document order, so the compact home's Where, doors and When (the left column) and What (the right) are one run of four sections; the gap is the lower block's token.
  The home gets it from one custom property, `--home-section-gap` (`App.module.css`), which `.main` and `.column` read and which only the populated compact home sets (`--space-5`): the phone's steps keep the row the cold open's margins are written against, and the wide grid restores its own.
  FR-FLOW-10 names no rhythm for the settings page; its three blocks — Location, Saved places, This browser — are marked `group` (`--space-3`), the reading nearest the text that keeps FR-SET-2 (`settings.spec.ts` passes with the 48 px it adds; `section` would add twice that to a page R75 spaced by its structure to fit).
  `Favourites` is wrapped in the marked `div` rather than taught the attribute.
  The one gap the spec finds that is not R134's — on the live page and the pass detail in the dome view, the `picker` slot renders around an empty chart slot and its `--space-1` stacks on the hint's, 12 px for 6 — is the layout's (`components/sky/**`, out of R134's scope): the spec holds it as a named exception at exactly two rows, so the fix in `SkyViewLayout` fails the spec and removes the entry.
- **D-871 — `.target` is border-box and a token, and a dense row is `ToggleGroup`'s `dense`.**
  (R134; FR-FLOW-11, D-851.) `--target` (`tokens.css`, `calc(var(--tap) - var(--row) / 6)`, 44 px — the expression `TextButton`'s `.toggle` used for the WCAG floor, and now reads as `var(--target)`, so the floor is written once) is what `.target` and `.target-row` hold a control to; `ui/styles/primitives.css` is `@import`ed at the head of `global.css`, so it loads before every module and needs no import of its own.
  `.target` sets `box-sizing: border-box`: an `a` is content-box, and its inline tap box's 24 px of padding was added to the floor (68 px, which stretched the wide header's row).
  Its height floor is `:where(.target)`, weightless, so an element's own floor wins: a button keeps global.css's `--tap` (48 px) — as a class `.target` shrank `[ ] Hidden` to 44 beside a 48 px Share on the live page's actions row — and only a control with no floor of its own (a link, a door) takes 44.
  The facing picker is the one dense row: `ToggleGroup` takes `dense`, which makes the group a `.target-row` with no gap, and the cell that was the gap becomes half a cell of padding each side of every option (none at the row's two ends, and a whole cell after the wide picker's `Facing:` prefix), so the row's cells are unchanged and the hit areas meet; its options are not `.target`s (`OptionToggle` takes `target={false}`), and their 44 px height floor is under `:where()` too, so the buttons stay 48.
  `FacingPicker` passes `dense` (one word in `skychart/window/`, outside the `ui` lane).
  Without it every `ToggleGroup` option and every `OptionToggle` is a `.target`, once, as are the header's Back, its links and the doors.
  FR-FLOW-11 is a compact rule, so the two things that change a row's width — `.target`'s width floor and the dense row's `flex: 1` — are undone from the wide breakpoint (`width >= 964px`): a short tight option on the wide live page's one-line controls row (R121) keeps its width, and the picker's points on the wide rail stay at their cells rather than spreading over a wrapped line.
  The height floors stay at every width; they add nothing to a button.
- **D-872 — Targets are measured at rest; D-500's ring keeps the text line.**
  (R134; FR-FLOW-11, FR-X-5, D-500.) The sub-pages focus `[ ← ]` on arrival, and a ring drawn by `:focus-visible` drops an inline control's tap box so the ring sits on the text line (global.css, D-500), which `targets.spec.ts` read as a 24 px Back.
  That is the keyboard's state and `settings.spec.ts` holds it; `targets.spec.ts` lets the page's focus go before it measures, and `.target:is(a, .inline-control):focus-visible` lets the floor go with the box (`min-block-size: auto`), or the ring would be drawn round 44 px again.

- **D-878 — The landscape layout leaves the page's column and is one viewport high on all three pages.**
  (R136; FR-FLOW-15, D-877, superseding D-881's "a page without `fill` scrolls as a page".) The stars page and the sheet keep their 60-cell column for the portrait phone (their stylesheets are R134's), so on the landscape phone `SkyViewLayout.module.css` takes the layout out of it to the viewport's two-cell side padding (`margin-inline: calc(50% - 50vw + 2 * var(--cell))`; both pages centre the column).
  The drawing's column is `--sky-drawing-share × 100vw`, the share written on the layout through the CSSOM from `LANDSCAPE_DRAWING_MIN_SHARE` (a style attribute would meet the CSP).
  A `fill` page gives the layout its height as before; otherwise `SkyViewLayout` measures it: the nearest scroll box (the sheet, else the document), the layout's top in it, and what stands under the layout (read with the layout set to the whole scroll box, so the scroll box overflows and its `scrollHeight` cannot clamp), giving `--sky-landscape-h` = the scroll box's height less the top and `--sky-landscape-trail`, a negative bottom margin that takes back the page's padding under the layout.
  The layout is `position: relative`: a size container is not the containing block of the rail's visually hidden text, which otherwise escaped the scroll box and made the live page's document 58 px too tall at 667 × 375.
  The rail's rows are `max-content`, not D-881's `auto`.
  The grid is shorter than its rows, so an auto row is an item's minimum contribution, and for a slot with a `min-height` of its own (the view row's `--tap`) that minimum is all the row got.
  The view row wrapped at 667 px, kept one line's 48 px, and its `[x] stars` lay over the facing row.
  `sky-layout.spec.ts` now asserts every rail slot holds its own content.
  Measured at 844 × 390 the drawing slot is 464 px of 844 (0.55) on the three pages; at 667 × 375 it is 367 of 667 (0.55).
- **D-879 — The turned rail keeps the wide rail's order and lets the view row wrap.**
  (R136; FR-FLOW-4, FR-FLOW-15.) The rail's order is the wide one, `action` and `foot` at its foot under the list (D-877: "the wide arrangement's slots"), so the live page's `[ hold up to the sky ]` comes after the legend there.
  Beside a drawing at its share the rail is 33 cells at 844 px and 25 at 667, under the view row's 30 and 35 (FR-FLOW-4), so `[x] stars` takes a second line in Spanish at 844 and in both languages at 667; FR-FLOW-4's one-line assertion stays at 390 × 844 and 1280 × 800, and the turned spec asserts both parts inside the rail instead.
  The headline's path wraps in that rail too.
  `[ see this pass ]` rides on the path's last line at 844 and 932 px, so `shapes.spec.ts` drops their 24 px allowance.
  At 740 px it takes a line of its own, so that width gains one (D-624's rule, measured).
  The page's top row stays in the page's column (the stars page and the sheet), so it stands right of the drawing's left edge there; that is the pages' stylesheets and left as a follow-up.
- **D-880 — The turn test drags first and reads the camera once it holds still.**
  (R136; FR-FLOW-15.) `sky-layout.spec.ts` drags the window so the camera is the reader's own, waits until `data-look-az`, `data-look-alt` and `data-fov` read the same twice 150 ms apart (the drag's last frames land after the release), then turns 390 × 844 → 844 × 390 → 390 × 844 and asserts the three and the shown instant (the status strip's `<time>`, on compact in both shapes) unchanged and no `sky-screen`.
  The specs written about the compact dome before R136 save it rather than lean on the old default: `liveHelpers.ts`'s `seedStoredRun` seeds `chartView: 'dome'` (`prefs: { chartView: undefined }` is a fresh profile) and `homeAt` calls the new `savedDome`.
  `openSkyScreen` picks the window and taps `[ hold up to the sky ]`.
  The phone's default itself is held by `sky-layout.spec.ts` alone.

- **D-873 — FR-FLOW-12's files are four screens and two widths, and two of its states are files the set already has.**
  (R135; FR-FLOW-12, D-179, FR-CAP-1, FR-CAP-2.) The doors' `a later pass` is the home at `CLOCK`, 48 minutes before the night's first bright pass, and the home's `-view` twin is that page cropped to the viewport at 360, 390, 1280 and 1920 already, so a fifth file of it would be the same bytes under a second name; the other three states are `home-up-now` (`SHOWN`), `home-no-pass` and `home-daylight` (13:00 local on the 6th, `DAYLIGHT`), viewport shots at the same four widths.
  The folded Where is the top of the home's own 360 and 390 files, and the opened one is `where-opened` at 360 and 390 only — on wide the Where is never folded (D-844), so `captures.test.ts` carries it as a phone's screen by name.
  The 844 × 390 files are `stars` and `guide` with the width added (`live-watching` and `live-scrubbing` had it); the stars page there has touch, as a turned phone does.
  The phone's live files show the window because the app opens there (D-876), which the route follows rather than seeds; that makes `live-window` at 360 and 390 the same picture as `live-watching` there, so those 8 files are retired and `live-window` is a desk's screen at 1280 and 1920 (the R135 review). 330 → 386 files.
- **D-874 — `no pass` is the night over a catalogue cut to orbits a 41° S observer never sees well, and the routes follow the phase's pages.**
  (R135; FR-FLOW-1, FR-FLOW-12, FR-SHOW-9.) No instant of the showcase night has an empty 72 h, so `home-no-pass` serves the fixtures' elements cut to inclinations under 32° (HST, Hitomi, XRISM, an Atlas Centaur stage; none of the stations), and keeps the night's forecast, zone and elements age, which is a reader where the catalogue never reaches.
  The app stores no run for an empty search, so that home's Where reads "Not ready offline: no passes stored yet" (a finding, RELEASE §18.4).
  The capture spec's waits follow the pages R129–R136 left: the compact home's readiness line is inside the folded Where, so the settled-list wait reads the fold's `Ready offline` line there (`captureSeeds.ts` is unchanged, so the promo recording's copy still waits for `readiness`); the doors wait for no `data-pending` line, since the Stars door's lines are the `stars` chunk's; `WhereDome`'s wait is gone with it; the live page waits for whichever view it opened on; and the sky screen is opened by `[ hold up to the sky ]` (D-880), with the pass detail's instant put back on `SHOWN` before the tap so the screen is drawn at 2.5.0's instant.
- **D-875 — The budgets are re-set to v2.6's measured sizes, `main` to the owner's 180, after one import is taken back.**
  (R135; V26-14; FR-FLOW-12 as amended, D-853, D-178, D-841, D-882.) Measured on one Mac, plain builds, gzip level 9, against `89a8e5b` (2.5.0, 172.9): the branch's `main` was 181.0 KB (+8,287 bytes; R129 +0.2, R130 +1.7, R132 +2.6, R133 +3.7, R134 +0.1, R136 −0.2), over `FLOW_MAIN_KB` (1.5) and the 175 ceiling.
  R133's 3.7 was one import: `ChartFrame.tsx`, in `main`, took `compactBowlBoxPx` from `dome/camera.ts`, which put the lazy `camera` chunk (3.8 KB at 2.5.0) and `domeGeometry` in `main`.
  R135 stopped there for the owner (`sdd-run/R135.blocked.md`); the owner's call of 2026-10-28 (V26-14) was to fix the import and then raise `main`'s §11 ceiling and budget to 180.
  With D-882's leaf module `main` is 177.5 (+4,667 bytes), and the rows are re-set by D-178 on that build: `main` 180 (the rule's 195.3 → 200, held at the new ceiling, the next 5 KB line over 177.5 as V25-20 did, D-841), `chart` 110 (97.1 × 1.1 = 106.8; its ceiling), `astronomy` 30 (24.1 × 1.1 = 26.5; its ceiling; R130's `moonNow`); `worker` 40, `stars` 30 (26.7, +834 bytes against FR-FLOW-12's old 0.5 KB), `window` 30 (26.6), `live` 15, `service worker` 10 and `settings` 10 (1.1) are unmoved.
  `chart`'s 2.4 KB is the move's other side, not new code: 2.5.0's build put `domeGeometry` in the `camera` chunk the window, live and stars pages share, because `camera.ts` used its `GROUND_RADIUS`; with that number in `bowl.ts`, `camera.ts`'s remaining uses of `domeGeometry` (`projectToScreen` and `COMPASS_LABEL_RADIUS`, for `drawingExtent`, which only the tests call) are shaken out of the build and Rollup puts the module in the `SkyDome` chunk — a placement that rests on the tree-shaking, not on the import graph, so the dome page loads the same bytes (177.5 + 97.1 + 1.2 against 181.0 + 94.8) and the other pages 2.6 KB fewer.
  FR-FLOW-12's allowances are the measured figures (`docs/RELEASE.md` §18.2).
- **D-882 — The bowl's size is a leaf module the `main` chunk may import.**
  (R135; FR-FLOW-9, D-850, D-867, D-875; numbered after the reserved blocks, R135's D-873..D-875 being full.) `skychart/dome/bowl.ts` holds `bowlHeightPx`, `compactBowlBoxPx` and the numbers they are cut from (`DEFAULT_TILT_DEG`, `DOME_RADIUS`, `GROUND_RADIUS`, the two zoom divisors, `DRAWING_HEIGHT_UNITS`, `DOME_BOX_ASPECT`), and imports nothing but `lib/layout`.
  `camera.ts` and `domeGeometry.ts` re-export what they used to define, so every other importer and test is unchanged; `ChartFrame` and `Live.tsx` import from `bowl.ts`.
  A module in `main` that needs a dome number takes it from here, never from `camera.ts` or `domeGeometry.ts`, whose chunks are lazy.

- **D-867 — The compact bowl cut is read as the bowl's drawn height plus the slack, and the column's slot follows the chart.**
  (R133; FR-FLOW-9, D-850; F-61, D-293, D-317.) D-850 says the box is "the bowl's height plus `DOME_COMPACT_SLACK_PX` above and below" with "`fitBox`'s rule (F-61's divisor 2.0)", and the two readings of "the bowl's height" differ by the divisor's own margin: `DRAWING_HEIGHT_UNITS` at the width's zoom (1.78 units, 288.9 px at 390: F-61's silhouette-to-ground extent, the number the divisor was derived from) gives a 337 px box; the divisor's full height (2.0 units, 325 px, the 10 % label margin inside it) gives 373.
  Measured on the Mac at 390 × 844, the scene's cell snap (D-293: whole rows) and D-317's analytic centring put the drawn cells 12 px under the analytic top and 22 px past the analytic bottom in a 390 px box, so a 373 px box leaves 30 px of blank over the bowl and the verification's "at most 24" cannot hold even with a perfectly centred raster (49 px of blank over two sides); the 337 px box leaves 18 px over and 14 px under the drawn cells.
  So the rule is `camera.ts` `bowlHeightPx(width) = width / ZOOM_WIDTH_DIVISOR × DRAWING_HEIGHT_UNITS`, and `lib/layout.ts` `compactDomeBoxHeightPx` adds the slack and holds `COMPACT_BOX_MIN_SHORT_PX` (280) as the floor, which binds under about 313 px of box width.
  The e2e reading of "the blank between the view row and the bowl's highest drawn cell" is the blank *inside the box* — from the box's edges to the raster's drawn cells, the labels aside — since the readout row and the row gaps stand between the view row and the box by FR-FLOW-4's order and would put the literal reading over 24 at zero slack; the rows are held a row gap from the box's edges beside it.
  Where a platform's advance rounds down (Linux Chromium) the raster paints the bowl short of the zoom the box asked for, and the test allows the blank that adds, as `fitFloor` allows the short raster (D-293).
  **The slot:** the compact box's height was not the frame's to cut — `SkyViewLayout.module.css`'s column rule sized the drawing slot to the full-bleed width (R132's FR-COMP-5 rule, "the box's size itself is R133's" in its own comments) and a frame cannot size its parent — so the layout gains one rule, `.drawing:has([data-bowl='true']) { height: auto }`, and the frame writes the box's height as `--chart-bowl-h` from a layout effect (its own property: the wide box's `--chart-box-h` is cleared by a passive effect's cleanup, which on a wide → compact switch runs after this one) (before the first paint; no `aspect-ratio` fallback, which with the width `auto` sized the width from the height and fed the measurement its own answer: 514 px wide, measured).
  That is a touch on `components/sky/**`, R136's files this wave, taken against the task's out-of-scope line because the task cannot be done without it and the rule is one selector far from the landscape rules R136 re-cuts; the summary says so.
  The other views keep their square on compact; whether the polar chart and the window should take a cut of their own is the owner's (follow-up).
  **The tablet's column** (review): past about 525 px of box width the bowl and its slack are shorter than the height at which the width binds the zoom (`zoomFor`, width ÷ 2.4 × 2.0), so a box cut to them was height-bound and drew the bowl smaller than it was cut for (618 px at 768, 34 px of blank each side).
  `camera.ts` `compactBowlBoxPx(width)` is the whole rule — the bowl plus the slack over two floors, 280 and that width-bound height (640 at 768) — and the blank there is the divisor's own margin (0.045 of the width); FR-FLOW-9's 24 px is the phone's.
  **The spare room:** the 337 px box leaves the live page's `fill` column room over at 390 × 844, and a grid with room over stretches its auto rows, which drew the empty `picker` slot 1.2 px tall and put fractions on FR-FLOW-10's gaps (`rhythm.spec.ts`); the column with a bowl packs at the start (`align-content: start`) and the room stays under the last row.
  *(v0.14.1)* Since D-882 `bowlHeightPx` and `compactBowlBoxPx` live in `dome/bowl.ts`; `dome/camera.ts` re-exports them for the tests that import them there.

- **D-868 — The wide box is the room, `windowBox` is gone, and the wide `fill` slot is the layout's height.**
  (R133; FR-FLOW-9, FR-STAR-3, FR-SKY-2, D-850; D-314, D-448, D-789, D-881.) `fitBox` has no aspect any more (the review found its aspect branch held only by its own test): the box written as `--chart-box-w` / `--chart-box-h` is as tall as the frame leaves it and as wide as the rail does, for the dome, the polar chart and the window alike, and the drawing's own fit (FR-DOME-1, `zoomFor`) keeps the bowl its shape inside it — at 1280 × 800 the box went from 644 × 536 (D-314's 2.4 : 2.0) and 644 × 402 (D-789's window shape) to 644 × 728, and the band under the drawing from about 200 px to the row gap.
  `windowBox` had no caller left — the stars page's fit is `fitBox` of the room over the hint's row, re-run when the hint comes or goes — and is removed with its test; `viewportAspect` stays for the guide's `--chart-box-aspect`.
  `boxAspect` stays as the measurement's switch (the live page passes it with `stacked`; `Live.tsx` is R136's this wave) and its value no longer cuts the box — a rename to `measured` is a follow-up.
  **What the room is:** the wide rail layout's drawing slot spans the rail's rows, and on a short window (964 × 420) the rail's rows overflow the layout, so a slot that was the grid area grew with the rail and the box with it — 31 px between watching and scrubbing, and again with `[ see this pass ]` (FR-WATCH-6, D-448; `shapes.spec.ts`).
  R61's aspect cut had hidden this, the box being width-bound there.
  So the wide `fill` layout is a size container and its drawing slot `100cqh` less the hint's row and its gap, exactly as D-881 made the landscape phone's; the second touch on `components/sky/**`.
  The specs that pinned the old shapes — `live.spec.ts`, `live-rail.spec.ts`, `r61-captures.spec.ts`, `sky-window.spec.ts`, `stars.spec.ts` — hold the band under the box to one `--space-3` (`liveHelpers.ts` `bandUnderBox`), and `live-rail.spec.ts` holds FR-DOME-1 on the box's shorter side rather than "both ways", which only a box of the drawing's own shape could fill.

- **D-869 — The bowl slot's minimum is the box, and every rail that fills its height measures its hint.**
  (R133; FR-FLOW-9, FR-FLOW-6, FR-FLOW-4; D-867, D-868, D-881.) Two things the first cut of D-867 and D-868 left, both found by the specs the earlier session could not run to the end.
  **The slot's minimum.**
  The column's bowl slot was `height: auto` over the layout's `.drawing { min-height: 0 }`, and with the list open at 390 × 667 it came out 241 px under a 337 px box, the raster over `[ list (n) ]` (`live-compact.spec.ts`).
  Measured: the column is a `container-type: inline-size` grid whose block size its parent's `1fr` row gives it, and when a row arrives inside it (the legend's 96 px) Chromium re-lays the column at the height it had — 766 — rather than growing the page; the grid is then shorter than its rows, an auto row is its items' minimum (D-881), and the one row whose minimum was 0 paid.
  `container-type: normal` on the layout also cured it, but the column's square rule for the other views is `100cqw`, so the slot's `min-height: auto` is the fix: the box is the slot's content and the slot is never shorter than it; the rows overflow the stale height and the page grows to them, which is what R132's column that scrolls past its box means.
  A relayout for any other reason (the reflow forced in the probe) also put the page at 904.
  **The hint.**
  D-868 cut the wide `fill` slot to `100cqh` less `max(--sky-hint-h, --row)`, calling the hint one text row on wide; the Spanish window hint ("Arrastrá o usá las flechas · ctrl + rueda para acercar · hacé clic en una estrella") is two lines beside the 644 px box at 1280 × 800 and the box ran 10 px into it (`sky-layout.spec.ts`, es).
  `SkyViewLayout` measured the hint on the landscape phone alone (D-881); it measures on every `fill` rail now, so the wide box ends a row gap over the hint whatever its line count — the third touch on `components/sky/**` this task, one condition.
  Not done: a frame-side track minimum (`grid-template-rows` with `--chart-box-h`, R48's device) was tried first and is dead inside the layout, whose `.layout .drawing [chart-frame]` rule sets the frame's rows; the layout owns the slot, so the fix is the layout's.
  Observed and left: the wide live page's top row is 24 px taller in the polar and window views than in the dome's (the layout starts at 60 rather than 36 at 1280 × 800); `sky-box.spec.ts` reads the layout's box per view.
  `tests/e2e/sky-box.spec.ts` is the task's check and `r133-captures.spec.ts` the review's eyes.

### 9.8 v2.6 additions *(FR-FLOW)*

- **The order is a bounding-box test.**
  `sky-layout.spec.ts` asserts FR-FLOW-4's order at 390 × 844 and 1280 × 800 on the live page (each view), the stars page and the pass detail, in both languages.
  `SkyViewLayout.test.tsx` asserts that empty slots render nothing and that the gaps come from the layout.
- **The doors are a pure function.**
  `doorLines.test.ts` covers an up-now pass, a later pass, no pass, daylight and the pending stars line.
  `home.spec.ts` covers the doors' bottom edge ≤ 600 px at 390 × 844, their targets, and the doors row with no dome at 1280 × 800.
- **The measures are specs.**
  `rhythm.spec.ts` and `targets.spec.ts` (D-851).
  `sky-layout.spec.ts` also asserts `DETAIL_DRAWING_TOP_PX`, `DETAIL_DRAWING_MIN_SHARE`, `DOME_COMPACT_SLACK_PX` and the wide box reaching the hint line.
- **Rows fit.**
  `controlRows.test.ts` gains the view row and every door line, at 360 and 390 px in both languages.
- **Unchanged is a capture.**
  The settings page, the sky screen and the first-visit steps are re-shot byte-identical to 2.5.0's.
  Every other changed file is one of FR-FLOW-12's named moves.

### 16.24 Delivery of the v2.6 tasks *(V26-1..V26-12, D-842..D-854, D-876, D-877)*

The V1-11 rules are unchanged except the gate and the models, which are v2.5's (D-800, D-801) kept for the phase (D-854).
There are eight `R` tasks in four waves of three, one, three and one, after this plan is on `main`.
No deadline is set.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R129 — One header: `Header.tsx`'s `page` and `context`, the compact top row on the four sub-pages, the wide nav with `aria-current`, `[ settings ]`, and the language and theme switches removed from the header and the pass detail | `ui` (`components/common/{Header.tsx,Header.module.css,Header.test.tsx}`, the header's call sites in `App.tsx` and `Shell.tsx`, `src/i18n/{en,es}/ui.ts`) | opus | auto | — |
| 1 | R130 — The home's doors and the folded Where: `HomeDoors`, `doorLines`, `brightestDrawn`, the Satellites door's target, `WherePlace`'s `folded`, `StarsLine` and `WhereDome` removed, the doors at both widths | `home` (`screens/Home.tsx`, `screens/home/**`, `components/location/{WherePlace,WhereDome}*`, `lib/skyStars.ts`, `src/i18n/{en,es}/home.ts` (new) and its registration in `src/i18n/{en,es}.ts`, `tests/e2e/home*.spec.ts`) | opus | auto | — |
| 1 | R131 — The words: "Facing" in the three readouts, the legend's rise · peak · set | `chart` (`skychart/Legend.tsx`, `src/i18n/{en,es}/{chart,window,starsPage}.ts`, `messages.test.ts`) | opus | auto | — |
| 2 | R132 — One order for every sky view: `SkyViewLayout`, the three pages filled by slot, the one-line view row, `SkyHint` and `skyHintSeen`, the stars page's action first, the pass detail's head and `TimesRow`, at both widths | `sky`, crossing into `live`, `ui` and the prefs (`components/sky/**`, `screens/{Live.tsx,Stars.tsx,PassDetail.tsx}` and their CSS, `screens/stars/**`, `components/guide/TimesRow.tsx`, `skychart/window/SkyWindow.tsx`'s hint, `skychart/useChartHand.ts`, `model/prefs.ts`, `state/slices/prefs.ts`, `data/localPrefs.ts`, `tests/e2e/sky-layout.spec.ts`) | fable | auto | R129, R131 |
| 3 | R133 — The boxes: the compact dome cut from the bowl, the wide box to the hint line, the pass panel's share | `chart` (`skychart/ChartFrame.tsx` and its tests, `lib/{fitBox,layout}.ts`) | fable | auto | R132 |
| 3 | R136 — The phone's window first and the turned phone: `defaultChartView`, `openingFacing`, `chartView` saved on compact, `SkyViewLayout`'s landscape arrangement for the three sky pages, the turn test | `sky`, crossing into the prefs and the camera (`components/sky/**`, `screens/chartViewDefault.ts`, `screens/{Live.tsx,PassDetail.tsx}`'s view default, `skychart/window/camera.ts`, `data/localPrefs.ts`, `lib/layout.ts`'s one constant, `tests/e2e/sky-layout.spec.ts`) | opus | auto | R132 |
| 3 | R134 — The rhythm and the targets: `data-rhythm`, `.target`, `.target-row`, the two specs, and every gap or target they find on the five pages | `ui` (`ui/styles/primitives.css`, `components/primitives/**`, the pages' `.module.css` except `ChartFrame`'s, `tests/e2e/{rhythm,targets}.spec.ts`) | opus | auto | R130, R132 |
| 4 | R135 — The capture set and the release preparation: FR-FLOW-12's files, the diff against 2.5.0, `2.6.0`, `docs/RELEASE.md` §18, the README's screens, no tag | `docs` (`tests/e2e/{captureSet.ts,v1-captures.spec.ts}`, `docs/screenshots/v1-*`, `docs/RELEASE.md`, `README.md`, `package.json`'s version, `scripts/bundle-budget.ts`) | opus | auto | R133, R134, R136 |

No two tasks in a wave name the same file.
Each wave-1 task owns its own i18n modules: R129 `ui.ts`, R130 the new `home.ts` and the two registration files, R131 `chart.ts`, `window.ts` and `starsPage.ts`.
In wave 1, R130 is the only task that touches the home and R129 the only one that touches the header.
R129 removes the toggles from `PassDetail.tsx`'s markup only, through the header's call site; if the toggles are inline in the page, R129 owns that one block and R132 starts after it.
In wave 3, R133 holds `ChartFrame` and `lib/fitBox.ts`, R136 holds `components/sky/**`, the view default, the camera's opening and the prefs, and R134 holds the stylesheets and primitives but not `ChartFrame.module.css` or `SkyViewLayout.module.css`.
`lib/layout.ts` gets one constant from R133 and one from R136 on separate lines; whichever merges second rebases.

**Sessions** (D-801, D-854): every row carries `Review: opus`, `Turns: 500`, `Fallback: off`; `Model:` is `fable` for R132 and R133 and `opus` for the rest.

**The schedule** (from the plan's merge; a stop waits for its reset): wave 1 about 2 h, wave 2 about 3 h, wave 3 about 3 h, wave 4 about 1 h.
Unstopped, the phase is about 9 h.
With one five-hour stop and one CI rerun per task it is about 14–16 h.
The critical path is R129 → R132 → R133 → R135.

**Owner gates:** none (D-854).
The owner merges this plan, starts `--wave` after each wave merges, and resumes after a stop.
At R135 the owner reads the captures in both themes, goes from the home's Satellites door to a watched pass and from the Stars door to the sky screen on a phone, and goes through the three doors at a desk.
The tag and the deploy are the owner's.

**Decision block** (§16.2): **R129 takes D-855..D-857, R130 D-858..D-860, R131 D-861..D-863, R132 D-864..D-866, R133 D-867..D-869, R134 D-870..D-872, R135 D-873..D-875, R136 D-878..D-880.**
D-842..D-854, D-876 and D-877 are this plan's (D-876 and D-877 came after the blocks were reserved, so they follow them).
D-881 (R132) and D-882 (R135) were taken after the blocks, their own being full.

**What `Done` must say.**
R129: the header's cells at 360 px in Spanish on the four sub-pages.
R130: the doors' bottom edge at 390 × 844, and the `main` and `stars` rows against 2.5.0.
R131: the re-baselined strings, by key.
R132: the bounding-box order on the three pages at both widths, and which canvas boards were matched to 1–2 px.
R133: the blank above and below the bowl at 390 × 844, and the pass panel's share at 1280 × 800.
R134: every gap or target the specs found, and its fix.
R135: the changed capture files against FR-FLOW-12's named moves.
R136: the default for each pref case, the drawing's share at 844 × 390 and 667 × 375, and the turn test's names.

What every session reads (D-284's rule): SPEC §4.48 whole (FR-FLOW-1..15, F1–F14, D1–D10), §9 Phase 2n, §12 V26-1..V26-12; PLAN §2.41, §9.8 and this section; and the design canvas's boards for the task's screens on the Phone and Desktop pages.
Each task's `Reads:` adds its own files.
