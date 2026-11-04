# v1.2 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.19 v1.2 decisions (2026-09-07)

These plan SPEC v1.2 (V12-1..V12-6). v1.1 spent D-183..D-275; v1.2 starts at D-276, and §16.9 reserves the per-task blocks from D-285.

- **D-276 — Follow becomes a view switch, and one sensor stack serves it.**
  (FR-FOL-1..3, FR-LIVE-8 as amended.) `useFollowPhone` keeps what the control needs — the presence test, the permission request, the `relative` and `denied` notes — and loses the part that produced a heading: nothing consumes it once the dome stops turning.
  While the window is showing, `window/useDeviceOrientation` is the only listener on the sensor, as it already is when the window is chosen from the view control, so there is never a second `deviceorientation` subscription and never two smoothing states to disagree.
  `Live.tsx` stops passing `facingAzDeg`; `SkyChartProps.facingAzDeg` stays exactly as it is, because the pass detail and the dome's own drag still use it — this is what keeps the whole change inside the `live` lane, with no file of the `chart` lane touched.
  `compassHeading.ts` keeps `orientationApiPresent`, `orientationEventName`, `screenAngle` and `quantise` (the window imports them) and loses only the dome's heading path and its tests.
  The strip's declination line (D-185) now follows the window being shown rather than `follow.state === 'on'`, which is what FR-WIN-3 asked for in the first place and what makes the line correct when the window is entered from the view control.
- **D-277 — The view the control opens is an override in the store, not a written preference.**
  (FR-FOL-1, FR-WIN-5 as amended.) `SkyChart` reads `chartView` from the store and the view toggle writes it through `setChartView`, which persists to `localPrefs` (`state/slices/prefs.ts`).
  Following must change the view without changing what the reader chose, so the slice gains `viewOverride: ChartView | null` and `setViewOverride`, and the selector every consumer already reads — `chartView` — becomes the *effective* view, `viewOverride ?? saved`.
  The saved value is exposed as `savedChartView` for the toggle and for `localPrefs`; `setChartView` clears the override and writes prefs, so a reader who picks a view by hand while following simply stops following.
  The override is never written to storage (§7.9 is unchanged) and is cleared when the live page unmounts.
  Two consequences the cut depends on: no `chart`-lane file changes, since `SkyChart` keeps reading the same selector; and the `data` lane owns this change, so the `live` task that presses the control depends on it.
- **D-278 — The ground state is a pure function of the view plus a veil over the drawing.**
  (FR-FOL-5.) `window/projection.ts` gains `groundState(view, box): 'sky' | 'ground' | 'buried'`, derived and not configured: `WINDOW_FOV` spans the shorter side (FR-WIN-1), so the vertical half-field is `FOV / 2` in portrait and `FOV / 2 × height / width` in landscape, and the three states are the centre altitude above the horizon, below it with the top edge still above, and the top edge at or below it.
  `SkyWindow` renders a hatched `<rect>` — an SVG `<pattern>`, not a colour, so FR-X-5 holds without colour — clipped to the horizon line it already computes, plus one `role="status"` note; at `buried` it renders the veil and the note over the whole box and skips the arcs, markers and bodies, which is also the cheapest frame the view can draw.
  The note's keys go in `i18n/{en,es}/window.ts` (D-283).
  Unit tests are on `groundState` at the three boundaries in portrait and landscape; `SkyWindow.test.tsx` asserts the veil, the note and, at `buried`, that no arc is in the tree.
- **D-279 — The dome's zoom follows the painted raster, and the raster is allowed to follow the box.**
  (FR-DOME-1 as amended v1.2, F-54.) Measured cause: `colsFor` caps the grid at `MAX_GRID_COLS = 120` and `layoutFor` caps the cell at `MAX_CELL_WIDTH_PX = 12`, so the raster is at most 1440 CSS px wide however wide the box is, while `zoomFor` takes the box — `min(width / 2.4, height / 1.6)`.
  The two agree until the box is both wider than 1440 px and taller than 960 px, where `1.6 × zoom` is set by the height and `2.4 × zoom` passes 1440: the drawing is sized for a box the raster does not cover and its east and west columns fall off the grid.
  At 1920 × 1080 the live box is about 800 px tall (D-268's fold), the drawing 1200 px wide inside a 1440 px raster, which is why R54's ceiling test passes there and the owner still sees clipping at 2560 × 1440, where the box is past 1100 px tall and the drawing wants 1650 px.
  The fix is both halves of the disagreement: `layoutFor` lets the cell keep growing once the column cap binds, so `cols × cellWidth` covers the box at every width (the *grid* is unchanged, so the rasterisation cost and D-234's drag rate are unchanged; the drawing above 1440 px gets larger and coarser rather than finer, which is what a fixed column count means), and `zoomFor` is given `min(box, cols × cellWidth)` by `min(box, rows × cellHeight)` so the ceiling holds by construction even if a cell cap is ever reintroduced.
  `MIN_CELL_WIDTH_PX` is untouched.
- **D-280 — A `#live` link for the place the store already holds is not a new observer.**
  (FR-LIVE-11, F-56.) Measured cause: `startApp` sets the observer from the hash on every `#live?lat=…` load (D-135), and `observerFromLink` builds `{ label: '−38.93, −67.99', source: 'coords', timeZone: null }`, which differs from the saved geocoded observer, so the observer-change chain drops the stored run and starts a 72 h search — and FR-LIVE-9 puts the coordinates into the hash on the first scrub, which is how an ordinary session becomes a "shared link" on its next reload.
  The guard is in `src/state/` and nowhere else (the `data` lane): before `setObserver`, compare the link's coordinates with the saved observer at the precision the hash carries (the five decimals `shareLinks.ts` writes, D-295) and, when they match, restore the saved observer instead — its label, its zone and its stored run survive, which is the whole of FR-LIVE-11's first sentence.
  A hash for a different place stays what it is today: a new observer and a search, with the page saying so.
  The click-without-reload half of F-56 is reproduced first and, if it is a second defect, closed under the same finding.
- **D-281 — One spacing token under the drawing on compact, and the invariant is an e2e measurement.**
  (FR-LIVE-7 as amended v1.2, F-55.) `Live.module.css`'s compact branch gives the rows under the box a single `--live-row-gap` instead of the per-block margins that add up today, and the readout, the strip, the stripe and the stepping row take it from one place. jsdom resolves no layout, so the test that matters is an e2e at 390 × 667 and 390 × 844 that reads the bounding boxes of the facing readout, the status strip, the clock readout, the stripe and the stepping row and asserts no two of them intersect and that the page does not scroll; `controlRows.test.ts` keeps pinning the widths (FR-COMP-4).
  The order when the arithmetic runs out is the gaps first and the box only after them, so `--chart-floor` (D-187) is applied as a floor that yields rather than a minimum that overflows.
- **D-282 — The v1.2 cut is five tasks over three waves.**
  (V12-6.) `window` takes the ground state, `chart` the fit ceiling, `data` the store guard and the view override, `live` the follow switch and the compact rows in one task, `ui` the release.
  Wave 1 is `window` + `chart` + `data`, which fills the three concurrent slots (§16.2) with three lanes that share no file; wave 2 is the `live` task, which waits for the `data` task's override (D-277); wave 3 is the release.
  Two tasks in the `live` lane would not have run any faster — one lane, one task at a time — so the follow switch and the compact rows are one task, one capture set and one owner gate. §16.9 has the table.
- **D-283 — The per-lane message catalogs belong to their lane.**
  (Clarifies §16.1 after D-199's split.) `i18n/{en,es}/window.ts` is the `window` lane's file, `live.ts` the `live` lane's, `chart.ts` the `chart` lane's and `ui.ts` the `ui` lane's; the `en.ts` / `es.ts` barrels stay with `ui` and are touched only when a lane adds a whole section, which no v1.2 task does.
  This is what lets the ground state's Spanish copy ship inside the `window` task rather than waiting for a `ui` slot.
- **D-284 — What v1.2 spends.**
  (§16.8 continued.) Every task takes the D-198 brief, and each brief names the sections it needs — the follow task gets SPEC §4.22, §4.10 and PLAN §8.8/§8.12, the fit task §4.9 and §8.7, the store task §4.10 and §7.5 — instead of the three documents.
  Models: Opus for the two tasks that carry judgement (the ground state's composition and copy, the follow switch's states), Sonnet for the three that are a measured fix with the answer written down here (the fit ceiling, the store guard, the release).
  Test runs stay narrow while iterating and the whole suite runs once before the last commit (D-199); captures only from the owner-gated tasks and only the screens they change (D-195).
- **D-312 — The wide live page's rows are a rail beside the box, and the chart's side column is where they go.**
  (FR-LIVE-7, FR-LEG-2 and FR-TRAJ-4 as amended v1.2.1; F-59.) Measured cause, and it is geometry rather than a defect in the fit rule: the drawing's extent is 2.16 world units across and 1.53 down at the default 45° tilt — about 1.41 : 1 — and D-187 sizes it from the shorter side of its box, which on a wide page is the height.
  R54's box was the page's whole width, 1.96 : 1 at 1920 × 1080 and wider above, so the drawing covered 66 % of it across and the rest stayed blank at every desktop size (65 % at 1280 × 800, 68 % at 2560, 69 % at 3840).
  The two levers were measured before one was chosen.
  A steeper tilt flattens the ellipse but the zenith rises to meet it — the extent's aspect is `2 / (cos θ + max(cos θ, sin θ))`, so 1.41 at 45°, 1.46 at 60°, 1.56 at 70° and only 1.73 at the 80° clamp — so no tilt anyone would look at fills a 1.9 : 1 box, and it changes the picture everywhere including the phone.
  Moving the rows beside the box does both things at once: the box gets the drawing's own shape *and* the height the rows were taking.
  So `Live.tsx` keeps building one side column and places it twice — the page's own row on compact (unchanged, D-244/D-281), and on wide the chart's `aside` — and `screens/Live.module.css` drops D-268's fold, its `@container` rule and the page's third row with it, since the rail stacks like a phone's and `STRIPE_ROW_MIN_CELLS` no longer means anything.

  The column is the chart's because the legend is already in it: a rail beside the frame would have put the box, the legend and the rail in three columns and left the box *narrower* than it is today (1078 px at 1920 × 1080, against 1373 with the rail).
  `SkyChartProps` gains `aside`, passed through the three views to `ChartFrame` the way `legend` is (D-186); the frame places it under the legend and widens that column to `max(44 cells, 26 %)` — 44 because that is what the stripe and the playback row need to be read, 26 % because it leaves the box at about 1.41 : 1 at every 16 : 9 viewport.
  The legend keeps `flex: 0 1 auto` above it and scrolls inside what is left, so a long list never pushes the page's controls off the column.
  Nothing else in the chart lane changes: the frame is where the box's geometry already lives (D-187), and no view learns what it is drawing beside.

  Measured after: the box goes from 1631 × 833 to 1373 × 960 at 1920 × 1080 and the drawing from 1072 px to 1258, 66 % of the box's width to 92 %; at 2560 × 1440 from 1552 to 1693 in a 1847 px box; at 1280 × 800 from 644 to 732 in 798.
  FR-DOME-1 is untouched — the drawing still covers ≥ 90 % of the shorter side and is still inside the box, which `dome-fit.spec.ts` keeps checking — and the new e2e (`live-rail.spec.ts`) measures the painted ink against the box's *width*, which is what F-59 was about and what no test asserted.
  One consequence outside the layout: the stripe is 44 to 68 cells in the rail instead of the page's full width, so `labelEveryHours` reads the stripe's own measured width rather than the shell (60 cells buys twelve labels, under that eight), and `keepLabels` drops a label that would be drawn over its neighbour, the date winning where two collide.
- **D-313 — The rail stops growing at 60 cells, so its share of the page falls as the page grows.**
  (FR-LIVE-7 as amended v1.2.1; the owner on the deployed R61 branch at 2560 px.) D-312 gave the rail `max(44 cells, 26 %)`, which holds a quarter of the page at every width: 656 px at 2560 and 988 at 3840, most of it empty under the share action.
  The width is `clamp(44 cells, 26 %, 60 cells)` now — 424 px at 1280, 489 at 1920, 578 from about 2222 px up, which is 33 %, 25 %, 23 % and 15 % of those pages.
  Both ends measure the rail's *contents* and not the box: under 44 cells the playback row and the strip wrap past what is readable, and 60 is what FR-TRAJ-4's twelve hour labels want, past which nothing in the rail reads better.
  What the cap costs is nothing the drawing had: above the cap the box's height is what sizes the drawing (`zoom = min(w / 2.4, h / 1.7)` with the height binding), so the width the rail gives back becomes margin around the dome — measured, the drawing is 1702 px at 2560 × 1440 against 1693 with the uncapped rail, and 2629 at 3840 × 2160 against 2561.
  The coverage rule follows: `live-rail.spec.ts` expects 90 % of the box's width where the rail is still a share of the page and 85 % where the cap binds, both far above the 65–69 % the old layout gave.
  *(D-314)* With the box cut to its shape, the middle of the clamp is what the box leaves the column and not 26 % of the page; the two ends stand.
- **D-314 — The wide dome box is the largest rectangle of the drawing's own shape the frame leaves, measured.**
  (FR-LIVE-7 as amended v1.2.1, V12-8, V12-10; F-59.) D-312's box was still the page's leftover, so it was a different shape at every viewport and the drawing filled a different share of it — 92 % at 1920 × 1080, 82 % at 3840 × 2160.
  `zoomFor` is `min(w / 2.4, h / 2.0)` (D-317), so a box at exactly 2.4 : 2.0 (`camera.ts` `DOME_BOX_ASPECT`) is the one shape where the width and the height bind together and the drawing fills both.
  The first cut of this was a table of four fixed boxes chosen by `matchMedia` on width and height (V12-8) — withdrawn the same day (V12-10): a browser window is never its screen, and a 2560 × 1440 monitor's 1235 px viewport took the 1920 step and left the rest of the page blank, which is what the owner saw as the layout broken.
  So the box is continuous.
  `ChartFrame` is the one thing that knows what the drawing can have — it is as tall as the page's dome row, and the rows around the drawing are its own — so with `boxAspect` it measures on a `ResizeObserver` of itself, its controls row and its stripe row: its height less the controls row and the stripe row with their gaps, its width less the rail's minimum (44 cells, read off a probe span, since `--cell` is `1ch` and no script turns that into px) and the column gap.
  `lib/layout.ts` `fitBox` is the rule, pure and unit-tested: the taller box of the aspect that fits both, whole pixels, never negative.
  The answer is written inline as `--chart-box-w` / `--chart-box-h` — inline and not in the stylesheet, because a wide-layout block may hold no px (`tests/styles/breakpoint.test.ts`) — and only when it changes, so the observer never feeds itself.
  `ChartFrame.module.css` then sizes the drawing from the two properties, makes the two columns it spans `auto` and packs the grid at the start, so the rail stands beside the box and takes what is left up to D-313's cap; whatever a wide page has past that is blank at the right, the owner's choice over a stretched rail or a box the drawing cannot fill.
  Measured, at D-317's 2.4 : 2.0 with the stripe under the box everywhere (V12-12): at 1920 × 1080 the box is 1022 × 852 (height-bound, through the stripe under it); at 1280 × 800 it is 686 × 572 (height-bound too, the stripe under it); at 2560 × 1235 — the owner's real window — 1208 × 1007, where V12-8's table gave 1176 × 833.
  The drawing is 92 % of the box's width and of its height at every one of them.
  `SkyChart.contract.test.tsx` holds the frame to the arithmetic with the measurement stubbed both ways round, and `live-rail.spec.ts` measures the page.
- **D-315 — The stripe block is under the box on every wide page, and it is a slot of the frame.**
  (FR-LIVE-7 and FR-TRAJ-4 as amended v1.2.1, V12-8, V12-10, V12-12.) The owner wants the time stripe under the dome.
  The draft put it there from a width — `STRIPE_UNDER_MIN_PX = 1666`, the first width at which a box of the height a 1080 p window leaves stood beside a full rail, so that a 1280 px page kept the height the stripe would cost — and in the rail below it; the owner took that back (V12-12), so there is no threshold and no `useMediaQuery`: on wide the stripe is the frame's, on compact the page's, and `useLayoutMode` is the only switch.
  `SkyChartProps` gains `stripe` beside `aside`; `ChartFrame` places it in a `stripe` grid area under the drawing, the box's width, when the page hands it one, and counts its row in D-314's height; `Live.tsx` hands the block to `stripe` on wide and puts it in the side column between the status strip and the playback row on compact — one element, one test id, two places, the way the side column already is placed twice.
  Under the box the stripe is the box's width (62 cells at 1280 × 800, 106 at 1920 × 1080), so `labelEveryHours` gives every 2 h on every wide page.
  What it costs: at 1280 × 800 the box is 686 × 572 rather than 798 × 665, the stripe's row taken off the height, which binds there now; the drawing still fills it at 92 %.
  And the stripe row is the box's width by rule (`ChartFrame.module.css`), not by content: the stripe keeps the width it last measured, and after a window shrank it held the `auto` track open and pushed the box off the page's left edge (the resize spec caught it).
- **D-316 — The scene remounts on the cell, not on the column count.**
  (FR-DOME-1 as amended v1.2.1, V12-9; F-60.) glyphcss measures its cell once, at mount, so `SkyDome` remounts each layer's `GlyphOrthographicCamera` through a React `key` when the layout changes — and the key was the layer and its column count.
  `colsFor` is capped at `MAX_GRID_COLS = 120`, which every desktop box reaches, so on a desktop the key never changed and a resize left the scene drawing the new font size through the cell it had measured at mount: 107 % of the box across at 1280 × 800 after 3840 × 2160, clipped at 100 % at 3840 after 1920, the compass labels (DOM elements placed from the layout, not from the scene) off the dome.
  The key carries `fontSizePx` as well now, and `tests/e2e/dome-resize.spec.ts` drives one page through 1920 → 3840 → 1280 → 2560, asserts each extent inside its box at FR-DOME-1's floor, and at 1280 × 800 against a fresh load's within a cell — two page loads, since a run that loaded a fresh reference for every size took 53 s on CI's two cores and put the job over FR-CI-1's ten minutes.
  Measured with the change: the chain gives the fresh-load numbers exactly.
- **D-317 — The fit rule counts the bowl's silhouette, and the scene is centred on the drawing's extent.**
  (FR-DOME-1 as amended v1.2.1, V12-11; F-61; lifts D-294 for the height divisor.) `drawingExtent` (D-177) took the compass ring and the zenith, 1.08 cos 45° above and below the observer at the default tilt — 1.53 units — and `ZOOM_HEIGHT_DIVISOR = 1.7` was that with the label margin.
  But `gridPolygons` draws the meridians from the horizon to the zenith and the 30° and 60° rings all the way round, and a hemisphere seen from 45° has a *silhouette*: the point at 45° of altitude on the far side projects a full `DOME_RADIUS` (1.0) above the observer — the outline of the bowl above the far horizon, with the far tops of both rings just inside it at 0.97.
  Below the observer the lowest thing is the ground disc's near edge, `GROUND_RADIUS` cos 45° = 0.78.
  So the drawing is 1.78 units tall, not 1.53, and its middle is 0.11 above the observer.
  On a height-bound box the raster is the box and the observer was at its middle, so the top half held 0.85 units of a drawing that needed 1.0: the top 0.24 — the outline, the tops of the rings — was cut, drawn as flat fragments against the box's edge.
  Every desktop live page since R45 is height-bound; the phone is width-bound and never lost it, which is why no golden raster caught it, and the pre-R61 wide box was so wide that the cut read as the picture's own edge.
  Measured on the third R61 preview by projecting `gridPolygons` (`y` from −0.71 to +1.00 at radius 1) against `drawingExtent`, and proved with a square budget for one screenshot.
  Three changes: `drawingExtent` samples the bowl at `DOME_RADIUS` every 5° in azimuth and altitude, the ring at the names' radius and the ground disc, so the silhouette is in what FR-DOME-1 measures; `ZOOM_HEIGHT_DIVISOR` is 2.0, `DRAWING_HEIGHT_UNITS` (1.78) with the width's own 10 % margin, and `INK_HEIGHT_UNITS` is the same 1.78 for the raster clamp (D-290); and `SkyDome` hands each layer's `GlyphOrthographicCamera` a `center` — glyphcss's origin in normalized grid coordinates — of `[0.5, 0.5 + shift × zoom / rasterHeight]`, `centerShiftUnits(tilt) = (DOME_RADIUS − GROUND_RADIUS cos tilt) / 2`, so the drawing's middle and not the observer sits at the grid's middle, both layers by the same screen offset through their own grids, and the labels' hotspots with them.
  The divisors were frozen by D-294 to keep the captures still; a drawing with its top cut off is not something a capture set should keep still for, so the freeze is lifted for the height and every desktop dome capture moves (R60's set is re-shot in full, as its scope already says).
  The box's shape follows: `DOME_BOX_ASPECT` is 2.4 / 2.0, and the wide live page's box (D-314) is cut to it.
  Measured, with the drawing centred to within a cell above and below: 2560 × 1235 → 1208 × 1007, the drawing 92 % across and 92 % down; 1920 × 1080 → 1022 × 852, 92 % and 92 %; 1280 × 800 → 686 × 572 with the stripe under it (V12-12), 92 % and 92 %; 2560 × 1440 → 1454 × 1212 and 3840 × 2160 → 2318 × 1932, 92 % both ways; the phone's 390 × 355 box is width-bound as before, 92 % across.
  `camera.test.ts` holds the extent, the divisor's derivation, the shift and the two layers' agreement; `live-rail.spec.ts` measures the blank above and below the drawing on the page.
- **D-318 — The playback controls are the stripe block's, on the clock's row, on wide.**
  (FR-LIVE-7 and FR-TRAJ-4 as amended v1.2.1, V12-13.) `Live.tsx` builds the playback controls once and places them twice, as it does the side column: on compact the page's own playback row under the stripe block (R48, unchanged); on wide inside the stripe block's first child, a `timeRow` flex row that holds the clock readout and the `playback-row` beside it on the readout's baseline, wrapping under it in a box too narrow for both.
  The hidden-objects toggle is with the actions on both shells now (D-268 had it on the wide playback row), so the rail is `status-strip`, `live-actions` and nothing about time.
  The frame's stripe slot (D-315) needs no change: it takes the block whatever its first row is, and its height is measured for D-314's box.
  `Live.test.tsx` pins the order on both shells; `live.spec.ts` and `live-rail.spec.ts` measure the row on the page (the playback row left of the rail, on the clock's baseline, above the stripe's rows).
- **D-319 — Under 1660 px the wide live page is one centred column, and the frame stacks.**
  (FR-LIVE-7 and FR-LEG-2 as amended v1.2.1, V12-14.) `lib/layout.ts` `LIVE_TWO_COLUMN_MIN_PX = 1660` and its query, read by `hooks/useMediaQuery.ts` (the shape of `useLayoutMode`; a px literal never written in a stylesheet, so `breakpoint.test.ts` is untouched).
  `Live.tsx` sets `data-columns` (`compact` / `one` / `two`) on the page and the dome wrapper: on `two` the side column is the chart's `aside`; on `one` and on compact it is the page's own row, and on `one` the chart is handed `stacked`.
  `ChartFrame` with `stacked` and no aside (an aside wins — the rail is what it is for) sets `data-stacked` and takes the one-column grid in `ChartFrame.module.css`: `'controls status' / 'drawing drawing' / 'stripe stripe' / 'legend legend'`, rows `auto` packed at the top; the drawing is cut by `fitBox` from the frame's whole width (no rail probe) and the height its controls row, its stripe row *and its legend* leave — the legend is measured and observed as the stripe is — and stands centred (`margin: 0 auto`); the stripe and the legend are `clamp(60 cells, the box's width, 100 %)` centred, the floor because a box a short window cut small would wrap the time row into a column and the taller row would cut the box smaller still, down to nothing (seen at 1280 × 540); the legend is the compact one, four rows and scrolling.
  `Live.module.css` gives the one-column page its third row back and lays the side column out as a centred wrapping row.
  Measured at 1280 × 800: the box 548 × 457, the dome 92 % of it both ways, the stripe 576 px over it.
  `r54-legend.spec.ts`'s short viewport moves to 1660 × 540, the first two-column width, since the one-column legend is the compact one whose last pass row stands above the Sun and Moon lines in a four-row window.
  The e2e capture at 1280 (`live.spec.ts`) and `r61-captures.spec.ts` read the one-column page; `live-rail.spec.ts` measures both pages by width.
- **D-320 — The one-column stripe and legend are the page's whole width, and the strip reads from the left.**
  (FR-LIVE-7, FR-LEG-2 and FR-TRAJ-4 as amended v1.2.1, V12-15.) Three rules, all in the stylesheets D-319 wrote.
  `ChartFrame.module.css`: the stacked frame's stripe slot and legend slot are `width: 100 %` instead of `clamp(60 cells, --chart-box-w, 100 %)` centred — each slot spans both columns of the one-column grid, so 100 % is the frame's own width, which is the page's; the clamp's 60-cell floor goes with them, since the frame is never narrower than FR-DESK-1's 100 cells and the label cadence (`labelEveryHours`) reads the width it measures.
  The legend keeps its four rows and its own scroll: the width only decides how many of its lines wrap.
  `Live.module.css`: the one-column `side` row is `justify-content: flex-start`, so the status strip starts at the page's content edge — the stripe's first hour label — and the actions follow it on the same line.
  Only the drawing is centred now, and everything under it shares one left margin.
  The fit rule and the two-column page are untouched: `fitBox` reads the stripe and legend rows' *height*, and a wider legend wraps fewer lines, so the box grows a little rather than moving.
  `live-rail.spec.ts`'s one-column branch measures the stripe block and the legend against the frame's box (same left edge, same width) and the strip against its row's, beside the centring check the box keeps.
- **D-285 — The vertical half-field is read from the box, and D-278's parenthetical has its two orientations the wrong way round.**
  (FR-FOL-5, R56.) `WINDOW_FOV` spans the *shorter* side (FR-WIN-1, `scaleFor`), so the vertical half-field is `FOV / 2` exactly in a square box **and in every box wider than it is tall**, and *more* than `FOV / 2` in a tall one, growing with `height / width`.
  D-278 says the reverse — "`FOV / 2` in portrait and `FOV / 2 × height / width` in landscape" — which agrees with the code only for the square box the guide draws; taken literally on the live page's tall box it would call the field `buried` with ten degrees of sky still drawn at the top of it.
  FR-FOL-5's own threshold is the one implemented, "the top edge of the field at or below the horizon": `projection.ts` exports `verticalHalfFieldDeg(view) = 2·atan((height / 2) / scaleFor(view))` — which `placeholderAltDeg` was already computing inline for the same reason (D-233) and now shares — and `groundState` reads it.
  `projection.test.ts` pins `FOV / 2` for the square and the landscape box, 56.4° for a box twice as tall as it is wide, and both state boundaries in each.
  Nothing else in D-278 changes.
- **D-286 — The ground is the inside of the horizon's own closed curve.**
  (FR-FOL-5, R56.) D-278 asks for the hatch "clipped to the horizon it already computes", and the projection makes that cheap: it is stereographic, so the horizon — a great circle — draws a *circle* on the plane, and the point at infinity is the antipode of where the phone points.
  In both ground states the centre of the field is below the horizon, so the antipode is above it: the sky is the part that runs off to infinity and the ground is exactly the inside of the closed curve.
  The clip is therefore the same 181 horizon samples the grid draws, taken whole instead of cut to the drawable field and closed with `Z` — no half-plane, no side test, no second geometry.
  The curve grows without bound as the centre approaches the horizon, so samples within half a degree of the antipode (where the projection has no answer at all) are dropped; they lie hundreds of box-widths away and only exist in the last fraction of a degree before the state is `sky` again.
  The unit test casts a ray at the top and the bottom of the box to prove the clipped region is the ground and not the sky.
- **D-290 — The raster's clamp is about the ink, not about the labels.**
  (FR-DOME-1 as amended v1.2, F-54; amends D-279.) D-279 clamped the zoom with `zoomFor(min(box, cols × cellWidth), min(box, rows × cellHeight))` — the *box's* divisors, 2.4 and 1.7, applied to the raster.
  Those two numbers are 2.16 and 1.53 (the compass ring at 1.08 radii, at the default tilt) plus a 10 % margin for the label names, and a label is a DOM element positioned over the grid, not a cell of it: it may overhang the raster as long as it stays inside the box.
  Charging the raster for it a second time cost the drawing a tenth of its size wherever the clamp bound.
  `zoomWithinRaster(box, raster)` is the rule instead: the box through `zoomFor` as before, the raster through `INK_WIDTH_UNITS = 2 × GROUND_RADIUS = 2.2` (the ground disc is the widest thing painted into a cell, on the base layer) less `INK_MARGIN_CELLS = 1` column either side, and `INK_HEIGHT_UNITS = 2.2 cos 45°` with no margin — `rowsFor` floors the row count, so one cell is a large share of the drawing's height and a dome that tapers smoothly lights its top and bottom row legitimately, which is why `dome-fit.spec.ts` asserts the columns and not the rows.
  The blank column is that spec's own rule made structural.
  The clamp now binds only where the raster is more than a tenth short of its box, which is F-54's case and nothing else: at 1240 × 450 and on the live page's 991 × 325 box the zoom is the box's again, as it was before R57.

- **D-291 — The floor cannot be met from the clamp alone: the drawing is never wider than the raster it is painted on.**
  (FR-DOME-1 as amended v1.2, F-54.) Measured on the pass detail at 1280 × 800 with a device pixel ratio of 2: a 354.4 px **square** box, where the dome is width-bound (`min(w / 2.4, h / 1.7)` is 147.7 against 208.5), the ink 2.2 world units across and so 0.917 of the box at the very most — 6 px of headroom over FR-DOME-1's 0.9, which this machine measures as 0.915 and CI's Linux does not have.
  Linux Chromium lays glyphs out without subpixel positioning, so the fit loop (`fitLayout`) steps the font down until a row of whole-pixel advances fits: a 5.9 px cell becomes 5 px and 60 of them are a 300 px raster in a 354.4 px box.
  The drawing is painted *on* that raster, so it can be no wider than 300 px however the zoom is chosen — 0.85 of the box — and a clamp cannot recover what the raster no longer has.
  Either the divisors shrink (which resizes the dome at every viewport and invalidates every committed capture — not done, see D-294) or the raster stops losing the width, which is D-293.

- **D-292 — One zoom for both layers, computed where it can be tested: `fitLayers`.**
  (D-91, FR-DOME-1.) glyphcss measures zoom against the cell it probes at mount, so the two stacked layers must draw at one number or the coarser one is drawn at a different size from the finer one over it.
  Before R57 both took `zoomFor(width, height)` and were equal by construction; D-279's clamp is per layer, from that layer's own floored `rows × cellHeightPx` and its own settled cell, and the two diverged — 690.2 and 667.9, 3.2 % apart, on the live page at 2560 × 1440, because `SkyDome` builds the base layer at half the columns (D-92) and the two grids floor differently.
  The composition moves out of the component into `camera.fitLayers(width, height, lineFont, baseFont)`, which fits both layers to the box and gives them `min(lines.zoom, base.zoom)` — the one zoom that fits *both* rasters, so D-279's guarantee holds for each.
  It is in `camera.ts` rather than `SkyDome.tsx` so the rule is a unit test over a table of boxes and glyph roundings rather than a render test.

- **D-293 — The column count stays exact on every platform; the drawing goes short instead.**
  (FR-DOME-1 as amended v1.2, D-291; the owner's call, 2026-09-07.) D-291 leaves two ways to meet the floor where whole-pixel advances shrink the cell, and both cost something.
  Letting the settled cell set the column count — `max(cols, floor((hostWidth + FIT_SLACK_PX) / cellWidth))`, 69 cells of 5 px instead of 60 — recovers the fill, and was implemented and measured: the raster covers its box again and the drawing is sized by the box, as on a machine with exact advances.
  Its cost is that the count stops being platform-independent.
  `GRID_COLS` is an integer rule and `sky-dome.spec.ts` pins it — "the phone's 60 at this width (an integer rule, so exact everywhere)" — and CI's Linux returned 65 against that 60.
  The grid is the picture's texture, so the same box would be a 60-column picture on one reader's machine and a 69-column one on another's, and the cap `MAX_GRID_COLS` states would be advisory.
  **Reverted.**
  What ships: the count is `colsFor`'s on every platform, and where the platform rounds the advance the raster is short of the box (60 cells of 5 px, 300 px in a 354.4 px box) and the drawing follows it — 0.818 of the box at a device pixel ratio of 1, and 0.9001 at a ratio of 2, where the rounding costs a cell in six rather than one in five and the floor still holds.
  `camera.test.ts` pins both regimes and the 0.81 lower bound, so a regression that shrank the drawing further would fail; `dome-fit.spec.ts` asks the floor of the raster the drawing actually has rather than of the box, and asks everywhere that the drawing fill that raster with a blank column either side, which is the half of F-54 that regressed.
  The shortfall is a finding for a later phase, not a defect this task leaves open.
  D-290 and D-292 are unaffected and are what recover the 5 % shrink R57 itself had introduced.

- **D-294 — What R57 does not change: the two divisors.**
  (FR-DOME-1, D-187, D-268.) `ZOOM_WIDTH_DIVISOR = 2.4` and `ZOOM_HEIGHT_DIVISOR = 1.7` set the dome's size at *every* viewport, so moving them would resize every capture in `docs/screenshots` and turn R60's top-up into a re-shoot; D-291's floor is met from the clamp and the fit loop instead.
  Two captures' worth of drawing does move, and both follow from D-290 undoing a shrink D-279 had introduced within R57 itself: the live page at 2560 × 1440 (the two layers now agree at 701.8 rather than 690.2 and 667.9, a 5 % larger dome, re-shot here) and the live page's box at 1280 × 800 with a device pixel ratio of 2 (293.5 rather than 291.4, 0.7 %).
  The 1280 × 800 pass-detail captures are unchanged: that box is square and was never clamped.

- **D-295 — "The precision the hash carries" is five decimals, and one helper decides it.**
  (FR-LIVE-11, F-56; corrects D-280 and R58's entry.) Both said "the two decimals `shareLinks.ts` writes".
  `shareLinks.ts` writes **five** (`coord`, "about a metre"); two decimals is `coordsLabel`'s, the label a coordinates-only observer is *named* by, and the guard shipped with a second hand-written literal at that precision — so a link for a genuinely different place, up to about 1.1 km away, was answered with the saved observer's stored run.
  FR-LIVE-11 is the authority and says the hash's precision, so the comparison moves into `lib/shareLinks.ts` beside the rounding it has to agree with: `hashCoord` is the one rounding, `coord` formats with it, and `sameHashPlace(place, link)` compares latitude and longitude through it and altitude at the whole metres `observerQuery` writes.
  There is no second literal left to drift.
  Two places call it, and they are the same arrival a render apart: `startApp`'s guard (D-280) and `App.tsx`'s R39 effect, which had its own exact-equality test — never true for a phone's own fix, since `observerFromPosition` keeps the whole reading and the hash rounds it — and so undid the guard on every `#live` link a phone wrote for itself.
  SPEC needs no change; this corrects the two documents that misread it.
- **D-296 — A failed chart view ends through `dropChartView`, which writes nothing.**
  (FR-WIN-5 as amended, D-277.) D-277 makes `setChartView` both the view control's setter and the thing that clears the override, and `SkyChart`'s `unavailable()` — a refused orientation permission, a phone with no compass heading — was still calling it, so a view the *follow control* opened could save itself over the view the reader picked, which is what the amendment forbids.
  `slices/prefs.ts` gains `dropChartView(view)`: it clears the override when the failed view was the override (back to what the reader chose) and overrides with the default when the failed view was the saved choice (the dome is shown, the preference waits for the phone it was saved on), and in neither case does it touch `localPrefs`. §7.9 is still unchanged.
  The slice now has exactly three ways the view moves — the view control writes, the follow control overrides, a failure drops — and one of them writes.
- **D-300 — The compact live page turns the chart floor off, because it cannot be met without overflowing the frame.**
  (FR-LIVE-7 as amended v1.2, FR-COMP-5, F-55, D-281; R59.) D-281 asks for `--chart-floor` to be "a floor that yields rather than a minimum that overflows".
  It is applied in `ChartFrame.module.css` twice — as `min-height` on the drawing and as the minimum of its track — and both are hard: where the rows leave less than the frame's width, the frame's grid grows past its own box and every row of the frame under the drawing lands on the page's rows beneath it.
  That is what F-55 saw, and measuring it is what shows how far off the arithmetic is: on a 390 px touch phone the frame spends **96 px on the view control** (three views since FR-WIN-1, two rows of tap targets) and **96 px on the legend** (D-187's four rows) before the page's own rows — 24 top, 55 strip, 152 stripe block, 48 playback, 48 actions, 24 readout — are counted, some 550 px above and below a box whose floor is 374.
  So the box cannot have its width at 390 × 667, and at 390 × 844 it can only have it by overflowing.
  The live page therefore sets `--chart-floor-on: 0` on compact, which is exactly what D-233 put that switch there for ("a page whose rows do not yet leave the box its width sets it to 0 rather than have the drawing spill over the rows under it"), and the floor becomes the page's own `minmax(0, 1fr)` dome row: every pixel the rows leave, more than the frame's width where there is room and everything left where there is not.
  `SkyChart.contract.test.tsx` pins the switch being *used* in place of R48's assertion that it was not; `live-compact.spec.ts` measures the result at both phone heights.
  What this does not do is give the box back its width — that needs a row cut in the `chart` lane (the view control on compact, D-187's legend budget on a short phone), which is a finding for the register and not this task's to make.
- **D-301 — The follow control waits for one reading before it opens anything.**
  (FR-FOL-1, FR-FOL-2, D-276; R59.) D-276 leaves `useFollowPhone` "the presence test, the permission request, the `relative` and `denied` notes" while `window/useDeviceOrientation` is the only listener on the sensor.
  The two meet at a question the permission cannot answer: a phone can grant motion access and still send readings with no north in them, and FR-FOL-2 says such a device "shows its note and the view does not change".
  So the press arms a listener of the hook's own, and the *first reading* decides — a heading opens the window and the listener goes with the same commit that mounts the window's, so the two are never subscribed at once; no heading is the note, with the view untouched.
  This is F-42's rule kept ("the click arms; the first reading is what names the state"), and it is what makes "the view does not change" literally true rather than a flicker through the window and back out of it.
  The permission goes through `window/orientationAccess.ts` rather than `compassHeading.permissionRequest` directly, so the grant this tap wins is remembered for the session and the window it opens arms at once instead of showing `[ point at the sky ]`.
  And `state` is derived from the store (`viewOverride === 'window'`) rather than mirrored beside it: following *is* the override, so a view picked by hand and a window that reports it cannot run here (D-296) end it with no listener of the hook's own watching for either.
- **D-307 — The chart chunk's budget follows R57 and R61 down to 105 KB; the main chunk crosses a rounding line up to 155.**
  (R60; D-178, SPEC §9 Phase 2c.) The release re-set is `measured × 1.1`, rounded up to the next 5 KB, floored at 10 and capped at the §11 ceiling, measured on the 1.2.0 build with `VITE_MOON_LORE=on` as CI's bundle stage builds it (R42) — a plain `npm run build` is a few tenths of a KB smaller and is not what the script's number is enforced against.
  Two rows move.
  `SkyDome-*.js` measures 94.2 KB against a budget of 110 — R57's raster fix (D-279) stopped the grid running coarser past its column cap and R61's centring (D-317) samples the silhouette rather than the wider ring, together shedding the 2.9 KB the fit fixes cost the phase — so its budget follows down to 105.
  `index-*.js` measures 136.6 KB against 150, 1.3 KB over the 1.1.0 build's 135.3; ×1.1 is 150.3, one rounding step past the 148.8 the 1.1.0 figure gave, so the budget follows up to 155 — the two new window states' Spanish and English copy (D-283) landing in the `ui` catalog, which ships in main by design (§11).
  `Live-*.js` (8.0 KB, up from 7.6 with the follow control) and `SkyWindow-*.js` (5.9 KB, up from 5.3 with the ground state) both grew and both still floor at 10, so neither budget moves.
  Every other budget re-measures to the number it already carries (worker 36.1 → 40, astronomy 22.1 → 25, declination 6.1 → 10, service worker 5.0 → 10).

---

### 8.12 Follow, the ground state and the fit ceiling *(v1.2, FR-FOL-1..5, FR-DOME-1 as amended, D-276..D-281)*

Nothing new is designed here beyond the boundaries the decisions above draw.
The three pieces sit in three lanes and meet only through the store: the `live` page presses the control and sets the override (D-276, D-277); `SkyWindow` mounts, takes the sensor and draws the ground state (D-278); `dome/camera.ts` is arithmetic with a table test (D-279).
The window's existing contract test (`SkyChart.contract.test.tsx`) keeps covering that the three views draw the same geometry, and it is the test that fails if the ground state ever hides an arc that should be in frame.

The follow states worth a test each, all in `Live.test.tsx` and `App.live.test.tsx` with synthetic orientation events: pressing the control from the dome and from the polar chart switches the view and starts real time (FR-FOL-3); pressing it again returns to the view it came from; a denial and a relative-only device leave the view alone, show the note and leave the control unpressed (FR-FOL-2); picking a view by hand while following clears the override and stops following (D-277); the saved preference is what the view control wrote and never what following opened (FR-WIN-5).

### 16.9 Delivery of the v1.2 tasks *(V12-6, D-282, D-284)*

The V1-11 rules are unchanged: the same driver, the same waves computed from the checkboxes on `origin/main`, at most one task per lane and at most three at once, auto-merge on a green CI and a clean review except where the owner gates.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R56 — the ground state in the sky window | `window` | opus | owner (Spanish copy, captures) | — |
| 1 | R57 — the dome fits its box at every size | `chart` | sonnet | owner (every dome capture moves) | — |
| 1 | R58 — the live link keeps the place; the view override | `data` | sonnet | auto | — |
| 2 | R59 — follow opens the window; the compact rows | `live` | opus | owner (phone run, captures) | R58 |
| — | R61 — the wide live page's rail (a hotfix on the owner's ask, out of wave order) | `live` | opus | owner | — |
| 3 | R60 — v1.2 release preparation | `ui` | sonnet | owner | R56, R57, R58, R59, R61 |

Wave 1 fills the three slots with three lanes that share no file, so the phase's three independent pieces land together.
The `live` task waits only for the store override (D-277); it is one task and not two because a second `live` task could not have run beside the first anyway, and because the follow switch and the row spacing are the same screen, the same captures and the same owner gate.
The release task is the only one that touches `package.json`, the budgets and the capture set.

**Decision blocks** (§16.2), reserved here before wave 1 so no session has to read this file to number its first decision: **R56 takes D-285 to D-289, R57 D-290 to D-294, R58 D-295 to D-299, R59 D-300 to D-306, R60 D-307 to D-311.**
Numbers a task does not use stay unused; a task added to the phase later takes the next block after D-311.
*(v1.2.1)* R61, the wide live page's rail, takes **D-312 to D-316** (all five spent: the rail, its cap, the cut box, the stripe's place and the resize remount) and, on the owner's third and fourth reviews, **D-317** — the fit rule that counts the bowl's silhouette (F-61) — **D-318**, the time row, **D-319**, the one-column page under 1660 px, and **D-320**, its full-width stripe and legend with the status strip at the left; a task after it starts at D-321.

What each session is told to read (D-284): R56 — SPEC §4.18, §4.22, PLAN §8.10, §8.12, D-278, D-283; R57 — SPEC §4.9, PLAN §8.7, D-279, and `docs/` D-234 for the rate it must not lose; R58 — SPEC §4.10 (FR-LIVE-9, FR-LIVE-11), §4.18 (FR-WIN-5), PLAN §7.5, D-277, D-280; R59 — SPEC §4.22, §4.10 (FR-LIVE-7, FR-LIVE-8), PLAN §8.8, §8.12, D-276, D-281; R60 — `docs/RELEASE.md`, D-178, D-179.
No session reads the three documents in full.
