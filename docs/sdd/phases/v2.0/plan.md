# v2.0 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.25 v2.0 decisions (2026-09-09)

These plan SPEC v2.0 (V20-1..V20-13). §16.15 reserved R73's block to D-437; v2.0 starts at **D-438**, D-453 is the phase's one delivery decision, and §16.16 reserves each task's block from D-454.
D-460, the last of R74's block, is v2.0.1's (V20-14, 2026-09-14) and amends three of the block's own.

- **D-438 — The mark is rasterised by a page, not by a script that imports glyphcss, and the output is committed.**
  (FR-MARK-1, FR-MARK-6; lane `ui`.) `@glyphcss/react` may be imported only under `skychart/dome/` and, by `eslint.config.js`'s own exception, under `spike/**` (D-16, D-28).
  A generator that imported it in `scripts/` would either break that boundary or move the mark's meshes into the dome's directory, where they have no business.
  So the generator is the shape `scripts/mockup-capture.ts` already has: a throwaway page under `spike/mark/` builds the scene with `GlyphScene` at each tier's grid, and `scripts/build-mark.ts` drives it with Playwright, reads the rasterised text out of the two `<pre>` elements, and writes `src/ui/components/mark/rasters.json`.
  Nothing of glyphcss reaches the app: the mark at runtime is that JSON and two `<pre>`s.
  The asset is committed and a unit test re-runs the generator in CI and asserts the file is byte-identical, so the drawing cannot drift from the scene that produced it.
  The braille font is read from where it already is (`skychart/dome/wiys-braille.otf`, FR-MARK-1); no second copy is added, and the mark's `<pre>` uses the same `@font-face` the dome's stylesheet declares — which is why `Mark`'s stylesheet imports that rule rather than restating it.
- **D-439 — The tiers are data and the bead is frames; the component holds no geometry.**
  (FR-MARK-2, FR-MARK-5.) `rasters.json` is `{ [tier]: { cols, rows, body: string, frames: [[row, col, glyph], ...][] } }` — the body as the text it is, each of the 60 bead frames as the one or two cells that differ from empty, since a bead is a cell and a dense 32 × 16 string per frame would be 30 KB of spaces per tier.
  `Mark.tsx` renders two absolutely positioned `<pre>`s in one grid — the body once, the bead frame at the index a timer holds — and knows nothing about rings, radii or cameras.
  This is what keeps FR-MARK-5's "the body raster never re-rasterises" true in the code: the body's text node is never written after mount, so a bead step is one small text update and no layout.
- **D-440 — The icons and the favicon are photographs of the same text.**
  (FR-MARK-4, FR-MARK-6; supersedes D-127's drawing, not its reasoning.) D-127 drew the icon cell by cell into a PNG because the identity was a grid and a horizon; the identity is now a mark that already exists as text, so drawing it twice would be two drawings that can disagree.
  The same Playwright run renders the tier's text at the pixel size on `--bg` and screenshots it, which is exactly how `docs/mockups` and `docs/readme/hero.png` are made (D-370's rule: compose from what exists, never run the app to make a picture).
  `scripts/build-icons.ts` is deleted and `npm run build:icons` points at `scripts/build-mark.ts`; `tests/deploy/manifest.test.ts` keeps pinning the manifest's bytes, and gains the favicon's presence and its 16 × 16 size.
  *(amended v0.7.1, D-460)* The photograph was the wrong half of this: one script and one scene stand, but the files are drawn as dots, not screenshotted as text.
- **D-441 — The header's mark is a cell-grid citizen, so the row's arithmetic is unchanged.**
  (FR-MARK-4, FR-COMP-1, FR-COMP-4.) The mark in a header is 24 px — one `--row` — and occupies three cells of the row's 36 by `tests/styles/cells.ts`'s counting, because at the 16 px base three cells are 28.8 px and two are 19.2, so three is the first count that holds a 24 px box without the row's other controls moving.
  The compact row is `mark + 'Your sky' + [ live ] + [ settings ]` = 33 cells.
  On wide the tagline's `padding-left` goes from `calc(2 * var(--cell))` to `calc(24px + var(--cell))` expressed in the same token arithmetic, so the tagline still starts under the wordmark's first letter and `Header.module.css` keeps one rule for it.
- **D-442 — The next event is one pure module and one component with two hosts.**
  (FR-FIRST-3, FR-WATCH-2.) `lib/nextEvent.ts`: `nextEvent(passes, t)` → `{ pass, kind: 'rise' | 'peak' | 'end', at, azimuth }` or a reason (`no-passes`, `no-darkness`, `no-elements`), pure and taking `t` as a parameter (D-15).
  `ui/components/passes/NextEventBlock.tsx` renders it with a `useNow` tick at `NEXT_EVENT_TICK_MS`; the home page and the live page's watching headline are the same component with different hosts, so the two can never word the same fact differently.
  The countdown reuses `lib/format.formatClockDuration` (D-502 amends this: D-442 first wrote `lib/timeFormat.formatCountdown`).
  No worker request and no store field: the block reads the passes the page already holds (FR-LIVE-11's set on the live page, the run's on the home page).
  *(amended v0.7.2, D-508: the block is the board's three lines — the label with the countdown, the clock time, the path — and a card form for the phone's third step; the one-sentence headline and the peak line are retired with their catalog keys)*
- **D-443 — The three readings are a composition, and the three panes are a third breakpoint literal.**
  (FR-FIRST-4, FR-FIRST-5.) `Home.tsx` composes three region elements — `where`, `when`, `what`, each with a `SectionHeading` (D-49) — from the components that exist; nothing about how any of them writes the store changes, which is what makes the task a re-composition and not a rewrite.
  The layout is CSS: compact stacks the three, and `App.module.css` gains one media query at `HOME_THREE_PANE_MIN_PX` for the three equal columns.
  `lib/layout.ts` gains `HOME_THREE_PANE_MIN_CELLS = 108` and its pixel twin by D-253's counting (the two 3-cell gutters and one 2-cell shell padding: 116 cells, 1114 px at the 16 px base), and `tests/styles/breakpoint.test.ts` pins the literal to the stylesheet as it pins `WIDE_SPLIT_MIN_PX`.
  Three literals now live in that test — 960, 1114 and 1272 — and the test asserts they are in ascending order and that each is a real rule in `App.module.css`, so a fourth cannot be added by accident.
- **D-444 — An open pass at three-pane widths is a grid change, not a third shell.**
  (FR-FIRST-5, FR-DESK-3.) D-72's rule is one guide component and two shells (the compact sheet, the wide panel), and this phase does not add a third: at three-pane widths an open pass sets `data-guide="pane"` on the page grid and the existing wide panel is placed in the `where` and `when` columns' span, while the `what` column keeps the list.
  The panel's own floor (40 cells) is met with room, since two panes are at least 72 cells.
  Under the three-pane width nothing changes at all — D-253's `[ list ]` swap and the full-column guide stand — so `wide.spec.ts` at 1024 px passes untouched and the new assertion is at 1280 px.
- **D-445 — Settings is re-ordered and the coordinates become a disclosure; no store change.**
  (FR-SET-1, FR-SET-2.) `Settings.tsx` moves its three blocks and wraps `CoordsInput` in a disclosure whose default open state is `observer.source === 'coords'`; `LocationInput`'s `showClear` and `savedPlacesFooter` slots (D-262) already let the page decide where the clear action sits, so the group re-arrangement is the page's and the components are untouched.
  What buys the viewport is the grouping rather than any cut: language, theme and install become three label-and-control rows under one heading instead of three headings with a control under each, which is six rows saved at 24 px, and the coordinate fields are two rows behind a disclosure instead of four rows always open.
  Measured on the artboard's own composition, that is the difference between about 1020 px and about 800 at 390 × 844 in English; `settings.spec.ts` is what actually decides it, in Spanish, and the fit is FR-SET-2's assertion rather than an argument from these numbers.
- **D-446 — The live page's state is derived from the instant, and there is no second flag.**
  (FR-WATCH-1; D-382's rule applied to the page.) `Live.tsx` reads `scrubbing` from the live slice: the slice already holds whether `t` is pinned (the `now` action clears it, a scrub or a `#live?t=` sets it), so the state is that predicate and no more.
  `[ scrub ]` calls the same action the pause path calls with `t = now`; `[ back to live ]` is the existing `now` action renamed in the catalogs only.
  Nothing is added to the store, nothing new goes in the hash (FR-LIVE-9 unchanged), and a URL with `t` therefore opens scrubbing with no code that knows about states.
- **D-447 — The inventory is a table in one module, so the page and its tests cannot disagree.**
  (FR-WATCH-4.) `screens/liveRows.ts`, pure: `rowsFor(state, mode, shape)` → the ordered list of row ids the page renders.
  `Live.tsx` renders from it and the component test asserts against it, and FR-WATCH-4's "absent, not hidden" is checkable in one place instead of thirty assertions that drift.
  It is also what `foldRows` (D-381) and the placement rule (D-448) consume, so the fold order cannot name a row the state does not render — the mistake D-389 had to split a task to avoid.
- **D-448 — Where the scrub block goes is a pure function beside `fitBox`.**
  (FR-WATCH-5, FR-WATCH-6.) `lib/layout.ts` gains `scrubPlacement({ mode, shape, boxHeightPx })` → `'under' | 'rail' | 'overlay'`: the rail on the landscape phone, the overlay on a wide page where placing the block under the box would take it below `LIVE_BOX_MIN_PX`, under the box otherwise.
  The decision is made from the height the frame has measured, not from a viewport literal, for the reason D-314 gives about ladders — a browser window is never its screen — so an inspector docked at the bottom crosses the threshold at exactly the height where the box would otherwise break its floor.
  `LIVE_KEPT_ROWS_PX`'s over-count (D-414) is re-derived in the same task, since the rows under the box are now a state's and not the page's, and the table is what the fold reads.
- **D-449 — The overlay is the frame's screen surface used a third time.**
  (FR-WATCH-6, FR-FSC-3.) `ChartFrame` already has overlay slots on `--screen-overlay` for the sky screen's readout and legend (D-322), and FR-LEG-7's fixed-height panel is the second use of the same mechanism (D-387).
  The scrub bar is the third: the frame takes a `bottomOverlay` slot rendered inside the box's own box, so the drawing does not resize when it appears — which is exactly what FR-WATCH-6 buys and what the e2e measures.
  `Live.tsx` decides *whether* (D-448) and passes the block in; the frame decides *how*.
  The `chart` crossing is recorded here so the breakdown does not cut a task for one slot (§16.16).
- **D-450 — The gutter is a pure module and one component, and it takes the strip's slot.**
  (FR-GUT-1..6; lane `window`.) `skychart/window/gutter.ts`, pure: `gutterX(bearing, facing, widthPx)`, `bracketFor(view)` from the projection's own field functions (FR-GUT-3's "no new constant"), and `gutterMarks(passes, facing, view)` → one entry per pass with its branch (`in-bracket` | `on-band` | `off-left` | `off-right`), its `x` or its angle, its key and its colour token.
  `CompassGutter.tsx` renders it into the slot `Legend`'s strip occupies on the screen today, so `ChartFrame`'s screen mode changes which component fills the bottom overlay and not how the overlay works.
  The bearing a pass is at — its position while up, its rise otherwise — comes from the same `SkyChartProps` the drawing uses (FR-LIVE-10's rule), so the tick and the arc can never disagree.
- **D-451 — Portrait reads the measured box, never the viewport.**
  (FR-GUT-7; FR-FSC-10's lesson, D-427.) The screen's upright layout is chosen from the box `ResizeObserver` reports — taller than wide — as `data-orientation` already is since R73, and not from `(orientation: portrait)`: under a rotation lock with the layer turned, the viewport's orientation is not the reader's.
  The band's square cap, the two legend rows and the gutter are therefore laid out from the same number the projection scales from, and a turned layer gets the sideways layout by construction.
  FR-FSC-11's `role="status"` line and its `turnAdvice` key are not deleted but re-placed: the string moves to the peak line's secondary copy (FR-GUT-7) and the `role="status"` wrapper goes, so the copy and its Spanish survive the change and only the note's shape moves.
- **D-452 — Seven tasks over six waves, two frame crossings, and what may not be split.**
  (§16.16.) The order is the phase's risk and the prompt's: the mark first, because it is the only new build step and every later task uses it; the settings inversion second, because it is the smallest and the compact first run depends on the page being right before the home stops linking to it; then the home screen; then the live states; then the gutter; then the short shapes; then the release.
  Four of the seven are the `ui` lane and run one per wave, which is what serialises the phase — the alternative is two sessions in `Header.tsx`, `Settings.tsx` and `src/i18n/en/ui.ts` at once, which §16.1 exists to prevent.
  Two crossings into `chart`'s `ChartFrame` are recorded rather than cut into tasks of their own (D-449, D-450), and they are put in **different waves** so no two branches edit that file at once.
  Two things may not be split: the settings page's order and its one-viewport fit (the fit is what the order is for), and the mark's generator and its placements (a committed raster with nothing rendering it is not a mergeable state).
  One thing is deliberately split: FR-SET-3's withdrawal of the home screen's `#settings` links belongs to the home task and not to the settings task, because withdrawing the link before the home carries the form would leave a compact reader with no way to set a place at all.
- **D-453 — The brief's budget is 48 000 characters, and the number was always the cost.**
  (§16.8, D-198; TASKS v2.0.) `BRIEF_BUDGET_CHARS` said 36 000 and `brief.test.ts` asserts it for **open** tasks alone, so four merged tasks passed it unnoticed: R61 at 44 509 characters, R64 at 43 024, R66 at 42 165 and R73 at 37 614.
  This phase's briefs measure R74 32 721, R75 22 902, R76 37 623, R77 44 950, R78 37 492, R79 46 817 and R80 14 939 — the same shape as those four, for the same reason: FR-WATCH-1..9 is 30 KB of requirement text and FR-GUT-1..8 with FR-FSC-1..11 is 25 KB, and a task that amends a requirement must carry it.
  The alternative was to cite fewer ids and let the session `rg` for the rest, which trades a measured cost for an unmeasured one and puts §16.16's reading list at odds with the entries.
  So the constant becomes 48 000 — the observed ceiling plus a little — and D-198's rule is unchanged: a brief replaces the three documents, and 12 k tokens is what it may cost.**

### 2.26 R74 decisions (2026-09-09)

- **D-454 — The mark's scene, in numbers.**
  (FR-MARK-1, which asks for them here.) The frame is the dome's (§8.2): **z is up**, and the orthographic camera sits at `MARK_TILT_DEG` = **30°** above the horizontal with `rotY = 0`, so world *y* runs across the screen.
  Two planes carry everything.
  The **screen plane** — spanned by `right = (0, 1, 0)` and `up = (−sin tilt, 0, cos tilt)` — faces the camera exactly, so a circle drawn in it reads as a circle: the bezel, its four cardinal ticks, the globe's limb and the bead live there, because a bezel is a rim seen face on and a sphere's silhouette is round whatever the camera does.
  The **world horizontal plane** `z = 0` is squashed by the tilt to an ellipse half as tall as it is wide: that is the orbit, and it is what makes the drawing read as three dimensions rather than three circles.
  In bezel radii: `BEZEL_R` 1, `TICK_LEN` 0.18 (inward from the rim, at 0°, 90°, 180°, 270° of the screen plane), `ORBIT_R` 0.62, `GLOBE_R` 0.40, `MERIDIAN_LON_DEG` 60 (a great circle through the poles, turned out of the camera-facing plane — at 0° it would project to a bare line), `STROKE` 0.004 (half a ribbon's width; every ring is 120 quads and glyphcss's wireframe strokes their edges, so a ribbon this thin draws as one line and its rungs are shorter than a braille dot), `BEAD_R` 0.07 with `BEAD_RINGS` 5 and `BEAD_PHASE_DEG` 45, and `BEAD_INNER_R` 0.6 — the circle in the screen plane the bead rides once the orbit is shed (`header32`, `favicon16`), inside the bezel and not on it (v2.0.1, D-460: on the rim a bead with a blank dot around it cannot fit at 16 dots).
  `FILL` is 1: the bezel's diameter is the raster's width.
  The bead is **five nested squares** rather than one, because a wireframe fills nothing and a single square two cells across draws as a hollow box — which is the one shape the mark already has three of.
  Every number is `spike/mark/scene.ts`'s, and changing one is a re-run of `npm run build:icons` and a re-baked snapshot, never an edit to `rasters.json`.

- **D-455 — The rasters are re-baked from this generator, not reproduced cell for cell.**
  (FR-MARK-1, FR-MARK-2's own escape clause; `Gate: owner`.) FR-MARK-2 embeds the design handoff's rasters as the golden set and requires the generator to reproduce them, but the handoff's own radii, tick length, stroke width and bead size were never written down — V20-11 left `redesign/` out of the tree — so what the spec fixes is a *picture*, and the constants that produce it are exactly what this task had to choose.
  The construction is reproduced (bezel with four cardinal ticks, orbit ring, globe with limb and one meridian, one bead; the shedding ladder; the grids), the weight is within a few cells at every tier (the hero inks 225 cells against the spec's 230; the favicon 8 against 8), and the cells themselves differ: 701 of the 1 950 in the twelve blocks, the counts per tier in the PR.
  The committed snapshots are therefore this generator's output, offered for the owner's acceptance rather than slipped in — which is what FR-MARK-2's "never silently" asks for.
  From here on the rule is the strict one: a snapshot changes only with a change to `scene.ts` and a re-run.

- **D-456 — The mark declares the braille `@font-face`; it does not `@import` the dome's.**
  (FR-MARK-1, FR-MARK-6.) The brief asks the mark's stylesheet to import the dome's rule rather than restate it, and in CSS modules that means `@import`ing `SkyDome.module.css` — which copies *all* of it, glyphcss's base styles included, into the main chunk's CSS.
  The mark is on every page and the dome is behind `React.lazy` (D-66), so that trade is backwards: five lines of `@font-face` are restated in `Mark.module.css`, pointing at the same `wiys-braille.otf` the dome points at, and the one thing that must not be duplicated — the font file — is not: both rules resolve to one emitted asset, and the browser fetches it once.

- **D-457 — The mark stands where the `>` prompt was, and the compact row is 34 cells.**
  (FR-COMP-1 as amended, FR-COMP-4, D-441.) `global.css` puts `content: '> '` before every `h1`, which no control-row count has ever included: the compact header measured 30 cells and drew 32.
  With a three-cell mark in front of it the row came to 37 and the browser ellipsised "Your sky" at 390 px.
  So `.brand h1::before` is `none`: the mark is the prompt now, which is what a mark is for, and two marks of the same thing before one title is one too many.
  The row is then `mark + 'Your sky' + [ live ] + [ settings ]` with a cell of gap between each pair — **34** cells, not FR-COMP-1's 33, which counted the mark's three cells but not the gap after it; both numbers are inside FR-COMP-4's 36, and `controlRows.test.ts` pins the 34.
  On wide the same deletion makes D-441's indent literally true: `calc(var(--row) + var(--cell))` puts the tagline under the title's first letter, which with a prompt in between it would not have done.

- **D-458 — The favicon's bead does not move, and the regeneration test lives in `tests/build/`.**
  (FR-MARK-5, FR-MARK-6, FR-MARK-8 b.) Two consequences of the smallest grid and the slowest test.
  The `favicon16` tier is a file the browser draws, never a `<pre>` a page steps, and FR-MARK-8 (b) asks frame 0 and frame 30 to be the *same* cell there — so the generator holds that tier's bead fixed and its sixty frames are sixty copies of one cell, which is what makes that check meaningful rather than accidental.
  *(amended v0.7.1, D-460)* Doubly so now: the favicon files are drawn from the scene at frame 0 and never step.
  And the test that re-runs the generator and compares bytes is `tests/build/mark-rasters.test.ts`, not `src/ui/components/mark/rasters.test.ts` as §4 sketched: everything under `src/ui` runs in the **jsdom** project, and a test that starts a Vite dev server and a Chromium has no business in a fake DOM.
  It sits beside `flags.test.ts`, the other test that runs a real build, and costs about a second.
- **D-459 — The icons are pinned to the rasters by what they draw, not by their bytes.**
  (FR-MARK-6 as amended, FR-MARK-4 d/e; corrects D-440, which did not notice what it removed.) Until v2.0 `tests/deploy/manifest.test.ts` asserted `public/icon-192.png` and `icon-512.png` were byte-identical to `scripts/build-icons.ts`'s output, and that assertion held because the encoder was `deflateSync` over filter-0 scanlines — the same bytes on every machine.
  D-440 replaced the encoder with a Playwright screenshot of braille text and kept the sentence in FR-MARK-6 that says the icons are pinned "as today", which is no longer possible: the committed PNGs are rendered by whichever machine ran `npm run build:icons` and CI is `ubuntu-latest`, with a different Chromium and a different text rasteriser, so a byte check would fail for the one reason we do not care about.
  R74 shipped with the check simply deleted and the review caught it.
  The pin moves down a level instead: `tests/build/mark-icons.test.ts` decodes each shipped PNG, lays the tier's grid over it, and asserts that the cells carrying ink are exactly the raster's body plus its frame-0 bead, and that the cells drawn in `--accent` are exactly that bead.
  Both questions survive a change of rasteriser because they are about which cells were drawn in, not about what the antialiasing did inside them, and the margins are wide — measured on the committed files an inked cell holds at least 8 non-background pixels against a blank cell's 0, and the body's blue-minus-red reaches 20 where the bead's is 87.
  A stale icon moves dozens of cells and fails.
  `tests/build/mark-rasters.test.ts` pins the rasters to the generator; this pins the pictures to the rasters, and the two together are what FR-MARK-6 asked for.
  It sits in `tests/build/` for D-458's reason, though it is fast — it starts no browser.
  *(superseded v0.7.1, D-460)* The cell pin was a symptom of the photograph: with no font in the path the files are byte-stable on every machine, and `mark-icons.test.ts` pins them by bytes again.
- **D-460 — The icons and the favicons are the scene on a dot grid at an integer pitch; the pin returns to bytes.**
  (FR-OFF-6, FR-MARK-4 d/e, FR-MARK-6, FR-MARK-8 e/f as amended v2.0.1, V20-14; amends D-440, D-458 and D-459; `Gate: owner`.) The owner rejected R74's favicon at the gate and named D-440 as the cause.
  Two faults in one decision.
  A 16 px file made from `favicon16`'s 4 × 2 cells is 8 × 8 dots at 2 px a dot arriving through `wiys-braille.otf`, and at that scale the text engine's hinting and antialiasing are bigger than the artwork: a dot on a half pixel is two 50 % greys, and the ring a smudge with a hole.
  And a PNG has no braille cell — the cell is a constraint of `<pre>` rendering — so drawing the file from the text tier threw three quarters of its pixels away.
  **The renderer.**
  `spike/mark/dots.ts` (no glyphcss, no font, no browser; it imports `scene.ts` and nothing from the DOM) projects the scene's polygons through the same orthographic basis the page uses (`screenBasis`, D-454) onto an `N × N` dot grid whose bezel radius is `(N − 1) / 2` dots, samples every polygon edge at a tenth of a dot and inks the dot each sample falls in — the same wireframe glyphcss strokes, at a pitch the file can carry.
  The bead is a filled square of `max(2, round(2 · BEAD_R · R))` dots snapped to whole dots at frame 0, and every body dot within one dot of that square is cleared first: R74's own table had the favicon inking 8 of 8 body cells with the bead on top of ring ink, indistinguishable at any quality, and the owner's guide had asked for the cleared dot.
  **The grids.**
  One per file so the pitch is a whole number of pixels and nothing is resampled anywhere: `favicon.png` 16 dots at 1 px and `favicon.svg` the same grid; `favicon-32.png` 32 dots at 1 px (the `header32` construction, the smallest with ticks); `icon-192.png` 48 dots at 4 px; `icon-512.png` 64 dots at 8 px — the 48-dot construction with the same five elements at a coarser step, which the owner offered against the other integer answer (48 dots at 10 px on a 512 canvas with a 16 px margin, legitimate in a maskable icon) and which is taken because both icons then fill their square the way every tier fills its grid (`FILL`), and the renderer is parametric in `N` so the fourth grid costs a table row.
  Which construction a grid draws follows the ladder by size: 16 the favicon's, 32 the compact header's, 48 and 64 the icon's.
  **The ground.**
  The PNGs stay opaque on `--bg`, and `favicon.svg` goes first in `index.html` with a `<style>` of its own: the dark theme's three literals, and under `@media (prefers-color-scheme: light)` the ground and the body swapped, so the bezel keeps its containing job on either tab strip (the owner's option b; a transparent ground would have lost the bezel's edge).
  An icon has no page stylesheet, so `ICON_TONES` in `scripts/build-mark.ts` duplicates `--bg`, `--fg-dim` and `--accent` as literals, and `tests/styles/tokens.test.ts` gains the assertion that they equal what `tokens.css` declares, so the duplication cannot drift.
  **The pin.**
  `tests/build/mark-icons.test.ts` re-draws all five files through `dots.ts` and asserts byte identity with `public/` — possible again because nothing in the path varies by machine, which is what D-459's cell pin had given up — and adds the three structural checks FR-MARK-8 (f) names: every PNG pixel is one of the three tones and no fourth; the bead is one contiguous block holding a 2 × 2 of pixels; every bead pixel has only ground or bead in its eight neighbours; the bezel has body ink in each of the eight octants of its band.
  The PNG encoder is the one `scripts/build-icons.ts` had (filter 0, one `deflateSync`), brought back inside `build-mark.ts` rather than as a second script.
  **What does not move.**
  The six committed bodies, `Mark.tsx`, `useBead`, both headers and the 34-cell row (D-455, D-457): the dot files are a second rasterisation of the same scene.
  *(amended the same day, on the SVG read dot by dot)* **The bead moves inside the bezel at the two smallest tiers.**
  A 2 × 2 bead with one blank dot around it on a 16-dot ring removes the ring's dots at `(11,1) (12,2) (13,3) (14,4)` — the whole upper-right arc — so the ring reads as bitten.
  No constant fixes that; the bead leaves the rim: `beadOn: 'inner'` rides a circle of `BEAD_INNER_R` 0.6 in the screen plane at `header32` and `favicon16` (D-454), where at 16 dots it lands on `x 10..11, y 3..4` with two blank dots to the ring and needs no clearance.
  The `header32` and `favicon16` frame-0 snapshots are re-baked deliberately for it (FR-MARK-2's rule) and the header captures re-shot; every body is unchanged.
  **The ring is symmetric by construction.**
  Sampling a circle row by row breaks rounding ties differently in its two halves — at 16 dots the top run sat on column 8 and the bottom on 7.
  `dots.ts` now recognises a centred circle in the screen plane (the bezel, the limb) and rasterises one octant on half-integer offsets from the centre, then reflects it eight ways; the ticks are two dots wide on the axis, because on an even grid a one-dot line has no symmetric place there.
  The test asserts the bezel with its ticks invariant under both mirrors and a quarter turn at every size, and the whole drawing minus the bead at 16 and 32 (the orbit and the meridian at 48 and 64 are not symmetric, by design).
  **The ground is (a), not (b).**
  The PNG fallback cannot carry two polarities, so a swapping stylesheet leaves it wrong on one strip; and an opaque `--bg` square reads as a hole on a dark strip.
  The three favicons have no ground (RGBA, alpha 0) and the bezel with its ticks is one ramp step brighter — `--chart-horizon`, `#a7b1bf`, in the files only — so the ring holds on a light strip; the manifest icons keep the full-bleed `--bg` tile, because a launcher icon is a tile and the maskable case wants a bleed.
  `ICON_TONES` carries four literals and `tokens.test.ts` pins all four.

### 2.27 R75 decisions (2026-09-17)

- **D-461 — The settings page arranges `LocationInput` through seams, and the components gain only placements.**
  (FR-SET-1; amends D-445's "the components are untouched".) `showClear` and `savedPlacesFooter` could move the clear action, but not the rest of FR-SET-1: the device button and the coordinate fields were `LocationInput`'s own children in a fixed order, and the saved places were its tail.
  Lifting the fields out of `LocationInput` would lose the seed and remount key F-29 depends on, so the component gains three optional props whose defaults are the wide panel exactly as it was: `arrangeInputs` (a render prop that is handed the fields and the device button and places them — the page puts the button and a `[ coordinates ]` disclosure on one row and the fields under it), `showSavedHere`, and `showFavourites`.
  The page renders `Favourites` itself with `titled` (an `h2` block of its own) and `limit="empty-or-full"`; `Favourites`' `footer` now sits on the save row, `[ Save this place ] [ Clear saved ]`; `ClearSavedLocation` takes `short` (the visible `settings.clearSaved`, with the full `location.clearSaved` as the accessible name, which it starts with — WCAG 2.5.3); and `InstallAction` takes `bare` (the button without the sentence offering it, since the Install row is a label and its control on one line).
  No store field changes, and nothing any of them writes moves.
  The disclosure's fields stay mounted while it is closed, `hidden`, so what was typed survives closing it, and a capture-phase listener on the page opens it when the place picker's "enter coordinates instead" link is clicked — otherwise the link would find nothing to focus and fall through to a `#coords` hash the router reads as leaving the page.
- **D-462 — The settings page's foot is its privacy line, not the shell's footer.**
  (FR-SET-1, FR-SET-2.) The compact footer — three attributions, the privacy sentence and the credit, under a character rule — is about 300 px on a 390 px phone, a third of the budget by itself, and FR-SET-1 names the privacy line as the page's foot.
  So `App` renders `SettingsPage` alone on `#settings`, and the page ends in a `<footer>` holding `settings.privacy` ("No tracking.
  Your location is saved in this browser only.").
  `location.savedHere` keeps its key and its wide-panel sentence; the page does not say it as well.
  The attributions stay on the home screen, where the data they credit is shown.
  What the settings page does show from a credited source is the place picker's GeoNames results, and whether that page needs a credit line of its own is a follow-up for the owner, not something this task decides.
- **D-463 — The page is spaced by its structure, and the limit sentence is said where it is news.**
  (FR-SET-2.) Measured at 390 × 844 with the rows FR-SET-1 lists, the page was 943 px in English and 967 px in Spanish with the coordinate fields open and two places saved, even after the grouping D-445 counted on.
  What brought it inside: no gap between blocks and no margin under a heading (each block opens on a character-rule heading, which is the separation), the field labels sitting directly on their inputs, half a row above the back row and nothing below the privacy line, the device button drawn as a bracketed text control rather than a padded box (whose padding also wrapped `[ coordinates ]` onto a second line), and the coordinate field 22 cells wide rather than 24, so it and the altitude field share one line.
  The `Up to 8 places…` sentence is shown on this page while the list is empty and once it is full, which is when the limit is news; between those it would be three lines under every list.
  The "Using …" line and every other string an existing test asserts stay.
  The largest state, Spanish with a coordinates observer (fields open) and two saved places, measures **835 px**; with no observer it is 571 px in Spanish.
  `settings.spec.ts` asserts the coordinates-observer state, which is the larger of the two readings of FR-SET-2's second state.
- **D-464 — Two short labels where the row would not fit in Spanish.**
  (FR-COMP-4, FR-SET-1.) `[ Usar mi ubicación ] [ coordenadas ]` is 37 cells and `[ Guardar este lugar ] [ Borrar la ubicación guardada ]` far more, against a budget of 36.
  The disclosure is `lat, lon` in Spanish (the field's own label already reads "Coordenadas (lat, lon)"), making the row 34; the clear is `Borrar` on the save row, making it 33.
  English keeps `coordinates` (35) and `Clear saved` (35).
  `tests/styles/controlRows.test.ts` measures both rows, the saved-place row and the three label-and-control rows (the longest label in the language, one cell, the control) on the rendered page in both languages.

- **D-500 — The focus ring is drawn round the text line, not round the tap box.**
  (FR-X-5.) `global.css` gives every inline control a 48 px tap box out of vertical padding and a matching negative margin, so the box stands a quarter row into the line above and the line below while the layout reserves only the text line.
  The ring is drawn on that box, so on the settings page it crossed the header above and the Location heading below, and in the wide header the `[ Live sky ]` link's ring landed on the tagline.
  `a:focus-visible, .inline-control:focus-visible` now sets both to zero: the two cancelled each other, so the line box does not move, nothing reflows and no line breaks differently — only the ring's own geometry changes.
  The pointer target is the full box except while the control holds a keyboard focus ring, which is the state where a pointer is not being used.
  Nothing is painted on the box that the reader would see shrink: each inline control draws its own text and brackets, and the raised grounds in the app belong to tooltips rather than to the controls that open them.
  The wide header's tagline also takes a quarter row above it (`Header.module.css`), because that row and the title row were flush and the ring needs its 2 px offset and its 2 px line; the compact header has no tagline.
  Taken after R75's gate, on the owner's reading of the captures, and numbered past the phase's reserved blocks.

- **D-502 — The next event counts down on a clock, not in minutes.**
  (FR-FIRST-3, D-442, at the owner's gate.) D-442 said the block reuses `formatCountdown`, which rolls hours into minutes: a pass 3 h 45 min away read "in 225:07" while the hero card on the same page read "5:57:14" for its own.
  The block now uses `lib/format.formatClockDuration` — "m:ss" under an hour, "h:mm:ss" above — so the two readings agree, and the live page's headline (R77) inherits it from the same component.
  `formatCountdown` is unchanged and still the Now panel's, whose countdown is the minutes a pass has left.
  `nextEvent.test.ts` pins an instant hours out, and `home.spec.ts`'s headline pattern takes the optional hour field.

- **D-503 — The home screens are aligned to board 1B's drawing where the spec leaves the drawing open.**
  (FR-FIRST-1, FR-FIRST-2, FR-FIRST-4, FR-FIRST-5, D-471, at the owner's gate.) The owner compared the R76 captures with the redesign's board 1B and found the screens unaligned; everything below is layout and none of it changes a requirement, a string or how a component writes the store.
  **The primary action is one button**: label and note inside one full-width box with the accent's border, where a box had been drawn round a smaller bracketed button; the accessible name stays the label (`aria-label`) and the note stays its description.
  **The alternatives are boxes**: the place field and the coordinates each in a ruled box with the label dim inside, the fields their box's full width, and the altitude beside the coordinates with a visible `m` and its label read rather than shown (`PlacePicker` and `CoordsInput` gain a placement-only `boxed`, D-461's rule).
  **The three are one grid** of 30-cell columns, so on a desk the cold open stands them in one row with their tops and bottoms aligned — FR-FIRST-2's "beside it on wide" — and in a phone or a 36-cell pane they stack at one width.
  **The wide cold open is 108 cells wide, centred, with its head and foot centred**: at 80 cells the pair stacked beside the button and the column was 104 px taller than 1280 × 800 leaves, so the two foot notes FR-FIRST-1 requires were under the footer.
  **The question is one row a line**, the sentence half a row under it, and the next-event headline one row a line.
  **The inner headings are read, not drawn** (D-471 kept them for their names): `Right now`, `Moon tonight` and `Upcoming passes` are visually hidden inside a reading, which is `position: relative` so the hidden heading cannot stand outside a column that scrolls itself.
  A fade on a pane with more below it, as a scroll-driven mask, was tried and withdrawn: in CI's software compositor it slowed the e2e stage from 4 min 42 s to past the ten-minute cap on two runs, and `theme.spec.ts`'s frame sampling at 1280 × 720 hung to its 90 s timeout; a pane that overflows is left to the lighter pane contents of SPEC v2.0.2.
  **The saved places lose their top margin** in the Where pane and in the group, where the grid's gap already is that row.
  **The wide header** puts the title, `[ Live sky ]` and the preferences on one baseline and gives the tagline its own row across the header, so it is one line at 1280 and 1024 px in English (it was two).
  Out of this decision and left to the owner: the cold open's height on a phone (the hero mark and the tagline are FR-FIRST-1's; the page is 1386 px at 390 × 844), the precision note repeating the question's sentence, and the order and weight of the readings' contents, which FR-FIRST-3..6 fix.

- **D-504 — Board 1B's cold open and inputs, measured from the design canvas.**
  (FR-FIRST-1, FR-FIRST-2 as amended v2.0.2, V20-22, V20-23.) The owner asked for the home's inputs to be the design's.
  The canvas's two cold-open artboards were measured element by element (position, size, type, colour, border) and the app measured the same way until the two agree to a pixel or two.
  **A second text size**, `--small` 14 px on `--small-row` 20 px, in `tokens.css`: labels, notes, the step line and the sentences under headings; `--cell` stays the body's advance, so widths in cells do not move, and `controlRows.test.ts` counts a row set at `--small` in its own characters (36 cells hold 41 of them).
  **The inputs' two looks** are placement props, D-461's rule: `CoordsInput` and `PlacePicker` take `look: 'panel' | 'boxed' | 'plain'` (the settings page is `panel`, unchanged), and `LocationInput`'s group takes `look: 'boxed' | 'plain'` from the layout mode and says which foot note it carries.
  The altitude's unit sits inside its box after the value — an absolutely placed `m`, a cell after the value's last character (`--value-cells`), pointer-transparent so the whole box is the field; the box carries the border and the focus ring (`:has(input:focus-visible)`), its field none.
  **The cold open is one screen tall on a phone** (`min-height: calc(100svh - 3 * var(--row) - 1.2rem)`), so the group's ruled foot stands at the bottom as the board draws it; the step line sits 1.2 rem under the header, not the main's row.
  **On a desk the cold open is the Where pane of the populated page's own grid** — `data-home='cold'` joins `'readings'` in the three-pane rules — with the two dimmed panes as `GhostWhen` and `GhostWhat` (`aria-hidden`, no control), so there is no second layout for the page with no place.
  `SectionHeading` gains `tone: 'active' | 'muted'` for the panes' headings.
  The wide header's preferences keep their 48 px tap boxes but reserve one line (negative block margins, as `inline-control` does), so the title row is 24 px and the panes start where the board puts them.
  `MARK_HERO_COMPACT_PX` and `MARK_HERO_WIDE_PX` are deleted with FR-MARK-4 (c).

- **D-501 — The header row aligns on the title's baseline, not the mark's.**
  (FR-COMP-1, FR-DESK-2 as amended, FR-MARK-4.) `.brand` is the mark and the title as one flex group, and the row aligns on that group's baseline.
  The mark's two layers are absolutely positioned, so its box holds no line of its own and its baseline is its bottom edge — seven pixels below the title's.
  Both headers drew their controls against that: `[ live ] [ settings ]` at 390 px and `[ Live sky ]` at 1280 px sat seven pixels under the words they read beside.
  `.brand` now aligns on the baseline itself, which makes the title the one item in it carrying one, and the mark takes `align-self: center` to stand where D-441 puts it.
  `settings.spec.ts` measures the drawn text at both widths — the ranges, not the boxes, since a bracketed control's 48 px tap box never agrees with a heading's line.

### 2.28 R76 decisions (2026-09-18)

- **D-465 — The three-pane literal is 1118 px, not 1114.**
  (FR-FIRST-5, D-443, F-10.) FR-FIRST-5 and D-443 give the pixel twin of `HOME_THREE_PANE_MIN_CELLS` + two gutters + one padding (116 cells) as "about 1114 px" — 116 × 0.6 em × 16 px.
  Since R50 every literal is derived by `thresholdPx` on the *widest* advance in the font stack (Menlo and DejaVu, 0.602 em), so a layout never engages before its cells exist on any font; 116 cells there is 1117.4 px, so the literal is **1118**, as the wide breakpoint is 964 and not 960.
  What the requirement asks of the number holds either way: 1024 × 768 is under it and 1280 × 800 over it.
  `breakpoint.test.ts` pins 964, 1118 and 1272, ascending, each a real rule in `App.module.css`.
- **D-466 — `nextEvent` takes the reasons as a third argument, and a pass that starts at its peak has no peak to count to.**
  (FR-FIRST-3, D-442.) D-442 writes the signature as `nextEvent(passes, t)`, but two of its three reasons are facts the passes cannot carry — whether the run found darkness, whether there were elements to compute from — so the module takes an optional `{ hasDarkness, elementCount }` and answers `no-elements`, then `no-darkness`, then `no-passes`, in that order; left out, the answer is `no-passes`.
  The event is the soonest of every pass's next boundary (rise, then peak, then end), ties to the pass that rose first.
  A pass that leaves Earth's shadow already at its highest (`start.t === peak.t`, a third of the stored Neuquén run) goes from its rise straight to its end.
  The verbs are the catalog's (`nextEvent.headline`), by the boundary reason of the event counted to — `appears` / `emerges from shadow` / `becomes visible`, `peaks 62° S`, `sets` / `enters shadow` / `fades` — so the live page's headline (R77) words them by the same function.
  While the passes are still arriving the block says it is looking rather than that there is nothing, so a first run never reads "no pass" for the second before the first card lands.
- **D-467 — The home page's input group is one mounted instance across the cold open and the readings.**
  (FR-FIRST-1, FR-FIRST-2, FR-FIRST-4.) A coordinate pair becomes an observer at its first valid keystroke (`CoordsInput` emits as it parses), and an invalid one drops it.
  With the cold open and the location line each owning a copy of the form, typing `-38.93, -67.99` into the cold open unmounted it at `-38.93, -6` — the field gone under the reader's fingers, and the focus with it — and clearing the field under `[ change ]` did the same in reverse.
  So `screens/Home.tsx`'s `WhereReading` renders the group in one place in the tree in both states and only hides it; the cold open's head and the line are what change around it.
  When the place arrives while a field of the group has the focus, the group stays open under the line; when it arrives any other way — the device button, a saved place — it folds, and the countdown is what follows the line (FR-FIRST-3).
  The group is `LocationInput`'s new `variant: 'group'` (the primary action first with its note as the button's description, the place field and the coordinates as the alternatives in an `auto-fit` grid of 36-cell columns — beside the button where the group has room for both, under it where it does not — and the two notes at its foot, the clear action beside the second once there is a place to clear).
  The settings page's `panel` is unchanged, and so is everything any of them writes.
- **D-468 — What the cold open holds besides FR-FIRST-1's inventory, and what the in-place group leaves out.**
  (FR-FIRST-1, FR-FIRST-6.) Two page-level offers head it when they are there: the update offer and the install hint (FR-OFF-1, FR-OFF-6) are statements about the app, not about a place, and appear only while a new version waits or the browser offers the install; FR-FIRST-6 removes nothing the page had, and `update-banner.spec.ts` asks for the offer on an empty page.
  The saved places appear in it only when there are some — a reader who cleared their place keeps the way back to the others — which is `Favourites`' own rule (it renders nothing with no observer and no places), so a first run is the inventory exactly.
  The group drops the "Using …" active line the old wide panel had: the location line above it names the place already, and the settings page keeps the line where the form is the page.
- **D-469 — Above the three-pane literal the split is dormant on the home page, and the 1280 px assertions follow the panes.**
  (FR-FIRST-5, FR-DESK-3 as amended, D-253, D-444.) At three-pane widths an open pass is `data-guide="pane"`, which `App` reads from `useMediaQuery(HOME_THREE_PANE_QUERY)` — the same literal the stylesheet's query carries — so D-253's `open` and `list` states occur only under 1118 px and the 1272 px rule, though still a real rule, never applies to the home page.
  `[ list ]` is hidden from 1118 px (`GuidePanel.module.css`): the list is in the third pane.
  What the move costs is D-253's 44-cell list floor at 1280 px — a pane there is about 41 cells, and FR-FIRST-5's floor is 36 — so `desktop.spec.ts` measures FR-DESK-2's two columns at 1024 px, where they now live, and the guide beside the list at 1280 px as panes (the guide at least 72 cells from Where's edge to When's, the list at least 36); `wide.spec.ts`'s test at the split literal becomes one at each of 1118 and 1272 px asking for the panes and no sideways scroll.
  The 1024 px project runs every branch it ran before, unchanged.
- **D-470 — The dark window is read from the stripe's own bands.**
  (FR-FIRST-4, FR-LIVE-4.) "Dark 20:14 → 05:31" is the first `dark` band still open or next to open, from `useSkyBands` — the hook the live page's stripe shades with, imported and not changed — over a span from twelve hours back to a day ahead, so a window that is already open is named by the dusk it opened at and not by the span's first sample.
  It loads the same astronomy chunk the stripe does (D-148) and says nothing until it has.
- **D-471 — The readings' headings are numbered as the spec writes them, and the components keep theirs.**
  (FR-FIRST-4, FR-FIRST-5, D-49.) Each reading is a `section` headed by a `SectionHeading` — `[01] Where`, `02 When`, `03 What`, the first bracketed on every page as FR-FIRST-5 prints them — and the Now panel and the pass list keep their own titled regions inside, so every locator that named "Right now" or "Upcoming passes" still finds it.
  On wide the saved places are the Where pane's own, under the line (FR-FIRST-5 lists them there); on compact they are inside the group `[ change ]` opens, so nothing stands between the line and the countdown.
  The step line's dashes are CSS, so its three items are read as a list.

### 2.29 v2.0.2 decisions (2026-09-18)

SPEC v2.0.2 rewrote the home to board 1B after R76 had shipped the cold open, the inputs and the three-pane grid (D-502..D-504).
What is left is the populated page: what each pane holds, and the phone's first visit.
Nothing below changes the worker, the store's shape or how any component writes the store.

- **D-505 — The populated home is two tasks, and R77 waits for the first.**
  (FR-FIRST-3..11, FR-WATCH-2 as amended.) **R81** is the panes' contents in both layouts — the stripe, the table, the next-event block's new layout, the one-line cards, the Where reading and its dome — because they are one composition and one set of captures, and the stacked phone page is the same components in a column.
  **R82** is the phone's first visit as three steps, which reuses every component R81 builds and adds only the step state and the two step screens.
  One task would be R76's size again plus half, and R76 filled its session.
  R77 depends on R81, since its watching headline is the block R81 re-cuts; R79 does not, and runs beside R81.
- **D-506 — Tonight's stripe is a pure module over the bands the live stripe already computes.**
  (FR-FIRST-8, FR-LIVE-4, D-470.) `lib/tonightStripe.ts`: `tonightSpan(bands, observer, now)` → the 12 h span (`TONIGHT_STRIPE_HOURS`), centred on the middle of the dark band still open or next to open and rounded to the hour, or on local solar midnight (UTC midnight less the longitude at 4 min a degree, the one nearest ahead of `now`) where there is none (OQ-33); `tonightStripe(bands, passes, span, zone)` → the label line (every `TONIGHT_STRIPE_LABEL_STEP_H`, zero-padded hours, five characters apart), 30 cells of `{ char, sky }` (a cell is 24 min, its sky the band holding the cell's middle), and the tick cells (the cell holding each pass's peak inside the span).
  The bands come from `useSkyBands` over the span, the hook the live stripe and D-470's dark window use, so the three never disagree.
  `ui/components/now/TonightStripe.tsx` draws it as text in one `pre`, `aria-hidden`, the characters coloured by class (`--warn`, `--chart-pass-flown`, `--chart-sky`, the accent).
- **D-507 — The path is one formatter.**
  (FR-FIRST-3, FR-FIRST-10.) `lib/passPath.ts`: `passPath(pass)` → `{ start, peak, end }`, each a compass point and an altitude or `low`, by the pass's own boundary reasons (FR-VIS-3): a start at the elevation threshold is `low`, a start out of Earth's shadow carries its altitude, an end into shadow above the threshold carries its altitude; the catalog words it (`nextEvent.path`, `NW low → 68° N → SE`).
  The block, the phone's first card and nothing else use it.
- **D-508 — The next-event block is the board's three lines, with a card form.**
  (FR-FIRST-3, FR-WATCH-2, amends D-442.) `NextEventBlock` keeps `nextEvent` and the tick and renders: the label line from `nextEvent.label({ kind, reason, countdown })` (`Next up · in 3:45:07`, `Up now · peaks in 1:10`, `Up now · sets in 2:05`); the event's clock time (`formatShortClock` in the observer's zone); the path line (D-507); and, in the block form, `[ Open the live sky ]` under it.
  `form: 'card'` is the phone's third-step card — `First up · …`, the time and the name, the path with the duration, the brightness phrase in `--warn`.
  The sentence headline (`nextEvent.headline`) and the peak line (`nextEvent.peakLine`) are deleted with their keys; `nextEvent.test.ts` pins the label and the path in their place.
  The tick stays in the block, so a host never re-renders every second.
- **D-509 — The conditions table replaces the Now panel on the home.**
  (FR-FIRST-9, US-4 AC1 and AC3 as amended, FR-WX-3, FR-MOON-3.) `ui/components/now/ConditionsTable.tsx` is a `dl` reading what `NowPanel` read — the store's `now` for this observer (the visible items and the Moon), the weather slice for the cover — and the stripe's bands for `Dark` (D-470's `tonightsDark`, moved here from `DarkWindow`).
  `Up now` is rendered only while `now.state.items` is non-empty.
  `NowPanel`, `DarkWindow` and their tests go: nothing else renders them, and FR-FIRST-6's table moves each assertion to the row that now carries its fact (the nothing-visible statement's cases become the row's absence).
  The Moon tradition line (FR-MOON-4) renders under the table.
- **D-510 — The card is two lines, and the hero card becomes a tag.**
  (FR-FIRST-10, US-5 AC1, §8 rank 1 as amended.) `PassCard` is re-cut to the board's card and keeps its control and its selected state; the phone's brightness-phrase line is a `detail: 'magnitude' | 'phrase'` prop.
  `IssHeroCard` is deleted; the `Next ISS` tag is drawn on the card `nextFeaturedPass` chooses, which reads the page's instant and not the wall clock (F-68 holds).
  `PassList`'s status line and `SortToggle` share one line (`passes.countLine`), and the night groups' toggles move under the cards on one row, each group's cards staying in document order under their night (US-16 AC5).
- **D-511 — The Where reading is its own components.**
  (FR-FIRST-11, FR-SAT-4, FR-OFF-4 as amended.) `ui/components/location/WherePlace.tsx` — the place line, the sentence by source and `[ change ]` with `aria-expanded` over the D-467 group — replaces `LocationSummary`, which nothing else renders.
  `ReadinessLine` keeps its logic and loses the storage time on the home (`form: 'line'`).
  `ElementsLine.tsx` is the epoch age as one line and `[ details ]`, a disclosure that holds what `ElementsBanners` renders today, so every banner's text and its test survive behind it.
  `Favourites` gains `form: 'line'` (`Saved places · [ Save this place ]`, the places a line each), a placement prop by D-461's rule; the settings page is unchanged.
- **D-512 — The Where dome is the live page's dome at real time, loaded after the page.**
  (FR-FIRST-11, OQ-32.) `ui/components/location/WhereDome.tsx` lazy-loads the chart chunk the live page loads (D-148), draws the dome at `now` with the stored run's drawn passes, no controls and no legend, square at the pane's width, wrapped in one link to `#live`; wide only (`useLayoutMode`), so a phone never fetches the chunk for it.
  The main chunk does not grow; the chart chunk is fetched on the wide home after the first paint, which the release measures by the D-178 rule.
- **D-513 — The phone's steps are page state, and they never move on a keystroke.**
  (FR-FIRST-4 as amended, D-467.) `Home` holds `step: 'where' | 'when' | 'what' | null`, initialised once at mount: `'where'` with no observer, `null` (stacked) with one; it is not stored and not in the hash.
  A place from the device button, a picked place name or a saved place moves `where` to `when`; a typed coordinate pair moves it when the field loses focus or on `Enter`, never on the keystroke that made it parse — D-467's reason, the field under the reader's fingers.
  `[ See what crosses ]` moves to `what`; `[ edit ]` and a finished step's item move back.
  `ui/screens/home/WhenStep.tsx` and `WhatStep.tsx` compose R81's components; the count in words is the catalog's (`home.count(n)`, one to twelve in both languages, figures after); `MOON_BRIGHT_PCT` (50) lives in `lib/moonNote.ts` with the one-line rule that picks the sentence.
- **D-514 — Tests, captures and the CI budget.**
  (FR-FIRST-7, FR-CI-1.) Each new module has the test its FR names; the existing home, now-panel, pass-list, moon and location specs are re-pointed to where their facts went, no assertion dropped.
  The e2e stage ran 5 min 8 s on the last green run against a ten-minute job, so each task adds its e2e as assertions inside existing page loads where it can, and at most three new page loads; R82's step walk is one test.
  Captures are FR-FIRST-7's, R81 the panes and the stacked page, R82 the three steps; `r76-captures.spec.ts` keeps its name and gains their states.
- **D-515 — The card opens from its first two lines, not from its flags line.**
  (FR-FIRST-10, FR-DESK-3, R81.) The card's button lies over the time and name line, the duration line and the padding around them (`.hit`), and the flags line under them — the cloud word, `[moon glare]`, `[sky still bright]`, the Moon at the peak — stays outside it.
  Those words are tooltip triggers and stand above the button; with the button over the whole card, one of them sat under the button's middle, which is where a pointer aims and where Playwright clicks, and the click opened a tooltip instead of the pass.
- **D-516 — Small controls keep the 44 px tap box.**
  (FR-FIRST-10, R81.) At `--small` the sort's `Best` is 34 px wide, so each sort option has `min-inline-size: 44px` with its word at the start (`min-width` would read as a breakpoint to `breakpoint.test.ts`).
  The nights' toggles are `inline-control`s, whose tap box reaches half a tap past the line; where their row wraps, a wrapped toggle's box covered the middle of the one above and took its taps, so the wrapped rows stand `--tap − --row` apart.
- **D-517 — The count and the sort break at the separator wherever the pane cannot hold both.**
  (FR-FIRST-10, R81.) `7 visible passes in 72 h · Sort: [ Soonest ] Best` is 49 to 51 small characters.
  A phone's 36 cells hold 41 of them and the 1280 px What pane's 41 cells about 47, so the line wraps after `·` on both, and `controlRows.test.ts` measures the two halves as rows of their own.
  For the owner's gate against board 1B.
- **D-518 — What FR-FIRST-6 moved, where the amended spec itself took a fact off the home.**
  (FR-FIRST-6, FR-FIRST-9, US-4 AC3 and FR-MOON-3 as amended v2.0.2, R81.) The Now panel's `as of` time, a visible satellite's azimuth and elevation, the Moon's elevation, the percentage beside the cloud word and the place in the pass count are not drawn on the home any more.
  Their assertions moved to what now carries the fact: the `Up now` row's time left moving 10 s with the clock (US-4 AC2), the next-event label counting from real time after the live page closes, the cloud word's tooltip (the percentage and the local fetch stamp), the `Dark` row's zone, and the Where reading's place line.
  The nothing-visible sentences are the `Up now` row's absence (D-509).
  The live page keeps US-4 AC3 in full.
- **D-519 — The Where dome's drawing is inert inside its link.**
  (FR-FIRST-11, D-512, R81.) The dome's own drag and keys would be a control inside a control, so its box is `inert` and the link names where it goes (`Open the live sky`).
  The specs that assert that an open guide makes nothing inert (`desktop.spec.ts`) leave the dome's link out of the count.
- **D-520 — The Spanish Where lines.**
  (FR-FIRST-11, FR-I18N-2, R81.) The sentence under the place is impersonal (`Con el centro de …`, `Con estas coordenadas.`), and the saved places line is headed `Guardados`: `Lugares guardados · [ Guardar este lugar ]` is 42 of a phone line's 41 small characters.

### 2.30 R79 decisions (2026-09-19)

- **D-487 — The gutter's sign, its ties and its bracket.**
  (FR-GUT-2, FR-GUT-3, FR-GUT-5; D-450.) A bearing clockwise of the facing is right of centre, because `projection.ts` puts east on the reader's right in every pose (FR-FSC-10), so a tick and its arc are on the same side.
  `wrapDeg` resolves a point exactly behind to `+180`, never `−180`, so a pass 180° away is `off-right` and cannot swap ends from one frame to the next.
  Both branch boundaries count as the inner branch: a pass on the bracket's edge is `in-bracket` because it is being drawn, and a pass at ±90° is `on-band`.
  The bracket's half width is `horizontalHalfFieldDeg(view)`, the twin of `verticalHalfFieldDeg` computed from the same `scaleFor`, so it is `WINDOW_FOV / 2` upright and wider sideways, with no constant of its own.
- **D-488 — Edge markers stack nearest first, with legend order breaking ties.**
  (FR-GUT-5.) FR-GUT-5 says both "in legend order" and "the nearest angle is first".
  Those can only both hold if one of them decides ties, so `edgeMarkers` sorts by the angle to turn and falls back to legend order when two angles are equal.
  The angle to turn is the angle the reader acts on, so it sorts first.
- **D-489 — What makes the field empty, and which verb the chip uses.**
  (FR-GUT-6.) The field is empty when no drawn pass's mark is `in-bracket` (this covers a rise point inside the bracket, since a pass that is not up has its rise azimuth as its bearing) and no drawn arc has any point in the box (`arcInBox`).
  The pass the chip names is `nextEvent`'s pick over the drawn passes (FR-FIRST-3's rule), and the turn is to `passBearing`: the satellite's azimuth while the pass is up, its rise azimuth otherwise.
  `nextEvent` may pick a peak or an end, not only a rise, so the verb follows the event: "up in" / "sale en", "peaks in" / "culmina en", "sets in" / "se pone en".
  The spec's example, "up in 4:12", is the rise form.
- **D-490 — The gutter has a text alternative.**
  (FR-GUT-4, FR-X-5.) The ticks and the bracket are graphics, so the gutter is a group named "Which way to turn" ("Hacia dónde girar") holding a visually hidden list with one item per mark: "A ISS: in view" or "A ISS: 110° to the right".
  A screen reader gets from the list what a sighted reader gets from the band.
  The list's items are what the e2e test counts one-for-one against the marks.
- **D-491 — Upright, the band sits on the legend rows, and the × keeps the readout's row.**
  (FR-GUT-7, D-451.) The portrait screen is a five-row grid with its own named areas (`status`, `headline`, `drawing`, `legend`, `gutter`).
  The drawing row takes the leftover height as `minmax(0, 1fr)`, and the band inside it is `min(100%, 100cqw)` tall and aligned to the end of the row.
  So the square cap leaves its spare height between the next-event block and the band, and the band always sits directly on the two legend rows.
  The `×` is a full-grid overlay pinned to the top-right corner, on the readout's row, which is FR-FSC-2's corner.
- **D-492 — Where FR-GUT-1's 68 px is measured.**
  (FR-GUT-1, US-28 AC6.) The 68 px is the strip's cap (two `--tap` rows, 96 px) minus `GUTTER_PX` (28), measured as the clear drawing above the bottom overlay.
  The SVG's own box is the whole screen before and after.
  On `origin/main` (e9120c0), with `sky-screen.spec.ts`'s fixture: at 844 × 390 the SVG was 844 × 390 with an 84 px strip (two rows of 42 px), and at 390 × 844 it was 390 × 844 with an 84 px strip.
  At 844 × 390 the clear drawing is now 362 px, against 294 at the strip's cap.
  At 390 × 844 the 68 px is asserted on the turned layer, which is the sideways layout inside a portrait viewport (FR-FSC-10).
  Held upright, FR-GUT-7 caps the band at 390 × 390 on purpose, so that number is reported, not compared with main's 760.

### 2.31 R82 decisions (2026-09-19)

- **D-521 — What the phone's steps count as tonight.**
  (FR-FIRST-4 as amended v2.0.2, D-513.) One rule for both steps (`ui/screens/home/tonight.ts`), so the when step's `5 tonight, 7 in 72 h` and the what step's "Five things cross tonight" cannot disagree: tonight is the night the list opens on (`defaultOpenNight`, US-16 AC5) less the passes already over, since a first visit is about what is still to come; the later nights are every pass after it; the total is the two together.
  The first card is the next event's pass (FR-FIRST-3), and "tonight's other cards" are tonight less that one.
- **D-522 — The stretch of night the Moon's sentence and the cloud word are about.**
  (FR-FIRST-4, D-513.) The rest of tonight's dark band, from now when it is already open, or the stripe's twelve hours where there is no dark band (OQ-33).
  The Moon is sampled across it every quarter hour (`MOON_NOTE_STEP_MS`) from the astronomy chunk the stripe's bands already load (D-148), and the sentence is left out until the chunk lands rather than guessed; "lit" is the whole percent the row beside it shows, so "50 %" never stands beside "it will not".
  The cloud word is the forecast at the stretch's middle, the same word in `Clouds tonight` and in the what step's foot line; its tooltip says so (`in the middle of the dark band`).
- **D-523 — The what step's cards and its two controls.**
  (FR-FIRST-4, FR-FIRST-10.) Board 1B draws the first card and two more before `[ 2 more tonight ]   [ 2 more nights ]`, so `WHAT_STEP_CARDS` is 3.
  Each control opens the cards it counts in place and goes away; the later nights' cards stand under their night's name (`nightLabel`), because a card gives only a time.
  The cards are FR-FIRST-10's with the brightness phrase and, where a forecast covers the pass, the cloud word (FR-FIRST-10 says so; the board draws none); they carry no `Next ISS` tag, which is the list's, and each opens its pass in the sheet, which stands over whichever step is showing — a `#pass=` link that resolves on a first visit included.
- **D-524 — How the steps move.**
  (FR-FIRST-4, D-513, D-467.) The where step keeps the cold open's look while a typed pair is already the observer and when `[ edit ]` brings the reader back with a place set.
  A typed pair waits for the focus to leave the step or for `Enter` in a field; any other new place on the where step — the device, a picked name, a saved place — moves on at once.
  After `[ edit ]` the steps already reached are finished items too (`02 when ✓`), the way forward without choosing the place again.
  Every move puts the focus on the new step's heading, and a first mount does not.
  The step exists only on compact: a desk shows its own page whatever the step is, and a place set from the stacked page never starts the steps.
- **D-525 — The steps' rows at 36 cells.**
  (FR-COMP-4, FR-FIRST-4.) Three Spanish labels are shorter than their English: `Pasan` (`Pases en ella` with `5 esta noche, 7 en 72 h` is 37 cells), `Nubes` (`Nubes esta noche` with `Probablemente cubierto` is 39) and the Moon's value `… % de luz` (`gibosa menguante, 99 % iluminada` is 38).
  The more controls and the foot line break between their pieces where a phone cannot hold them all, as the count and sort line does (D-517), so `controlRows.test.ts` measures each piece as a row, `[ edit ]` with the cloud word on the foot's last line; the place is a name of any length and wraps.
  The rows are measured at their longest (the longest phase at 100 %, the longest cloud word, two-digit counts, a clock that says UTC), and the step line with two finished steps by its items and the stylesheet's rules, since `cells.ts` counts a rule only on a leaf.
### 2.32 R77 decisions (2026-09-19)

- **D-473 — `[ scrub ]` holds what is on screen, and the clamp stands.**
  (FR-WATCH-1, D-446, D-81.) `scrubbing` is `!playback.realTime` and nothing else.
  `[ scrub ]` calls `pause()` then `scrub(shown)`, where `shown` is the instant the page is showing.
  Watching, that is the last 10 s tick, so the first frame held is the last frame watched.
  `[ back to live ]` is `toNow`, and it keeps the old control's test id (`live-now`).
  D-81's clamp is unchanged: a held instant that real time has passed reads as the span's start.
  So an instant held at now moves with the tick until the reader moves it.
  That is the rule FR-LIVE-4 already had for a paused instant; it is not a second flag.
- **D-474 — The inventory's ids and its shapes.**
  (FR-WATCH-4, D-447.) `rowsFor(state, mode, shape)` returns ids that name *what* is rendered, not where.
  The frame's own rows (the view control, the facing readout, the legend) are one id, `box`.
  The actions row's controls are ids too, because FR-WATCH-4 lists them.
  `LIVE_ROW_TEST_ID` maps every id to one test id, and the component test walks all of them for presence and absence.
  On compact, `time-row` is the held headline in the headline's place, above the box (as the artboard draws it).
  On wide, it is the row under the box with the playback controls.
  The overview's end labels are watching's alone: while scrubbing, the stripe's own label row is directly under the overview.
  `shape` is `'tall' | 'short'`.
  R77 cuts the tall shapes, and `short` returns its mode's tall inventory until R78 re-cuts it (D-448).
- **D-475 — The wide rail's order is the page's stylesheet, not the frame.**
  (FR-WATCH-5, FR-LEG-6.) The rail is the indicator line, the headline, the conditions, the legend, then the overview and the actions at its foot.
  The legend is the frame's, and `ChartFrame` is R78's crossing (D-449).
  So on an unfolded wide page, `Live.module.css` sets the frame's aside wrapper and the page's `.side` to `display: contents`.
  The rail's head and foot then become items of the legend slot's own flex column: the head takes `order: -1`, and the foot takes `margin-top: auto`.
  On a folded page (short wide, FR-SHP-3), R69's one wrapped line stays until R78's overlay replaces it, and the fold's overview rule is scoped to the scrub block's overview only.
- **D-476 — The compact conditions line's words.**
  (FR-WATCH-3, FR-COMP-4.) The compact line is `21:14:32 dark clear 3 up`.
  Its words come from three new catalog keys: `skyShort`, `cloudWord` and `upCount`.
  The labels are spoken, not shown, and so is the zone: the artboard draws the line without it, and a zone abbreviation (`GMT+12:45` at its widest) is what would take the line past 36 cells.
  In Spanish the longest line is `21:14:32 crepúsculo limpio 12 arriba`, 36 cells, so the cloud words are `limpio / nuboso / tapado / s/d`; `despejado` and `cubierto` were three cells too many beside `crepúsculo`.
  The wide line keeps the Moon's phase with its illumination (`Moon waxing crescent, 18 % lit`), because FR-MOON-3 as amended says the wide page is unchanged.
  FR-WATCH-3's `Moon 18 %` example is read as the line's shape, not as a narrower field.
- **D-477 — The list panel's Moon line carries the phase, on the compact live page alone.**
  (FR-WATCH-3, FR-MOON-3 as amended; a `chart` crossing.) The catalog holds two lines: `chart.legend.moon` is the plain one every legend has drawn, and `chart.legend.moonLit` adds the phase name and the illumination (`☽ Moon waxing crescent, 18 % · az 291° · alt +12°`), which `Legend.tsx` fills from `moonFacts`.
  `Legend` chooses between them on a `moonPhase` prop that `SkyChart` forwards, and the compact live page is its one caller — FR-MOON-3 leaves the Now panel and the wide live page unchanged, and R79's sky screen draws the legend too.
  The prop stops at `SkyChart`: the legend is built there and handed to `ChartFrame` as an element, so R78's file (D-449) is untouched.
  *(The first cut of this task set the phase in the shared line and took the leak as a trade; the review named it and the owner asked for the fix.)*
- **D-478 — Compact scrubbing keeps an open list.**
  (FR-WATCH-4, V20-8.) The compact scrubbing row is `[ back to live ] [ hidden ] Share`, with no `[ list (n) ]`, but FR-WATCH-4 says scrubbing renders everything watching renders except the next-event block.
  So the panel follows `prefs.liveLegendOpen` in both states.
  A list opened while watching stays open through the scrub, with the arcs' states in it, and is closed from the watching row.
  The hidden-objects toggle's saved state applies in both states (FR-LIVE-6).
- **D-479 — The headline is the home's block, without its link, set smaller on a phone.**
  (FR-WATCH-2, V20-18; a `ui` crossing.) `NextEventBlock` gains `liveLink` (default `true`).
  The live page passes `false`, because the block's `[ Open the live sky ]` would point at the page it stands on.
  It is fed the live page's passes (the stored run, the coming 24 h, so its "no pass" line says 24 h).
  On compact, `Live.module.css` takes off the block's rule and top padding and sets its clock time at the readout's heading size on one text row.
  The block is three lines, 68 px.
  On wide it is the home's block unchanged.
  The Spanish state words are `en vivo / fijado`, and the actions are `fijar` (compact), `recorrer la noche` (wide) and `ir al vivo`: `[ ir al vivo ] [ ] Ocultos Compartir` is 36 cells, where `volver al vivo` was 40.
  Where the overview moves from the rail into the scrub block (wide), it takes back the keyboard focus it had, so a key that enters scrubbing is not the last key it hears.
- **D-480 — The 390 × 667 watching box is held as measured: 330 px.**
  (FR-WATCH-5, FR-WATCH-9 d, V20-13, OQ-27.) With the list closed and the view control's row where FR-LIVE-7 has it, the rows under the box are 169 px (FR-WATCH-5 counts 168).
  The rows above it are the top row (24), the headline (68) and the view control (48), which leaves the box 330 px against FR-COMP-5's floor of 374.
  OQ-27's 367 did not count the headline's three lines.
  Without the view row the box would be about 378.
  The task's "over 374" cannot hold with the row where V20-13 leaves it.
  OQ-27's resolution is to assert the measurement, so `live-compact.spec.ts` holds 330, and the choice (the view row, or a shorter headline on a phone) is the owner's.
  Scrubbing at 667 is held to R71's 198.

**R78's block** (§16.16 reserves D-481..D-486; what it spent):

- **D-481 — The number `scrubPlacement` reads is the frame's space for the box with nothing under it, with the fold taken back out.**
  (FR-WATCH-6, D-448.) D-448 says "the height the frame has measured".
  The box's own height cannot be it: it is smaller while scrubbing (the block is under it), so the answer would differ between the states, and at 964 × 700 it is width-bound and says nothing about height.
  So `ChartFrame` reports `onBoxSpace`: its height less its controls row and the gap, which is `fitBox`'s height input before the stripe row and is the same in both states.
  The fold changes that number too — the control rows at one text row give the box 46 px — so a rule that read it raw would fold, measure the taller box, unfold and fold again.
  `Live.tsx` stores it through `unfoldedBoxHeightPx` with the fold the measured layout was drawn with (`LIVE_FOLD_GIVES_PX`), so the decision does not move on the fold.
  `shapes.spec.ts` drags a 1200 px window a pixel at a time through the threshold in both states and both languages: the answer turns once, at the table's own pixel (602 px), and the page settles at every height.
- **D-482 — The table counts the time row as it stands at the block's 44-cell floor, in Spanish.**
  (FR-SHP-3, D-448, re-deriving D-414.) `LIVE_KEPT_ROWS_PX` is per state: watching `[48, 48]` (the top row and the controls row; nothing is under the box), scrubbing those and the block's four rows.
  The first cut counted the time row as one row of tap targets, 48 px, and the sweep failed it: a box near its floor is some 230 px wide, so wherever the table decides anything the block is at its 44-cell minimum, where the held instant and the six playback controls wrap — 74 px in English, 122 px in Spanish (measured at 1200 × 560).
  The table takes 122 (`LIVE_TIME_ROW_FLOOR_PX`), so the block costs 290 px and the overlay starts at a 602 px viewport: a little earlier than English needs and exactly where Spanish does.
  The strip's line and the actions row, which D-414 over-counted, are in neither state's list.
- **D-483 — The fold is one decision with the overlay, and its order is `controls`, then `actions`.**
  (FR-SHP-3 as amended v2.0, FR-WATCH-6.) The box must be one height in both states on a short wide window, and folding the control rows changes the box, so the fold cannot read the state: `controls` folds exactly where `scrubPlacement` answers `overlay`, watching or scrubbing.
  `actions` folds a row of tap targets under that (a 554 px viewport), which is every short-wide row of the matrix.
  `overview` is out of the order — it is the rail's at these heights and FR-WATCH-6 says it does not fold.
  `foldRows(boxHeightPx, rows)` takes the state's inventory and names a fold only where every row it re-cuts is rendered (`LIVE_FOLD_NEEDS`, D-447); `lib` may not import `ui`, so the rows are an argument and `liveRows.test.ts` holds the two together.
  In the folded rail the overview is ordered last, so the actions still ride on the conditions line.
- **D-484 — The bar and the measurement reach the frame by a context, not through the views.**
  (D-449.) `ChartFrame` has the `bottomOverlay` and `onBoxSpace` props D-449 asks for.
  `Live.tsx` cannot pass them: the frame is rendered by the view (`SkyDome`, `SkyPolar`, `SkyWindow`) or by `SkyChart`'s two fallbacks, and threading two props through five `chart` files is a larger crossing than the one slot D-449 records.
  So `ChartFrame.tsx` also exports `ChartFrameSlots`, a context carrying the same two values, and the frame reads the prop first and the context second.
  The crossing stays inside the one named file.
  The bar is a child of `chart-box`, absolutely placed on its bottom edge, at most half its height and scrolling inside past that, with half a row of padding so the one-row controls keep their 48 px hit boxes (D-246).
- **D-485 — The landscape phone has a hook, and its rail has a head.**
  (FR-WATCH-5, D-173.) D-173 had no hook because nothing in React changed between portrait and landscape.
  Now something does: FR-WATCH-5 puts the indicator and the clock in the rail, so `usePageShape` asks `LANDSCAPE_PHONE_QUERY` (`lib/layout.ts`), and `tests/styles/liveShape.test.ts` holds the stylesheet's media query to the same string.
  At this shape the page renders the top row without the indicator, the dome, and a rail whose head is the indicator with the clock — or with `[ back to live ]` while scrubbing, so the way out never scrolls away — then the headline, the conditions, the overview, the scrub rows and the actions.
  The grid is two areas under the top row (`dome side`), so the dome's column is one track in both states.
  The rail's rows do not shrink (`flex-shrink: 0`): a squeezed conditions line lost its clock's descenders at 844 × 390 with touch, and the rail scrolls instead (D-119).
- **D-486 — Wrapped actions under the fold stand a row apart.**
  (FR-X-5, D-246.) A folded control is one text row with a 48 px hit box.
  On two wrapped lines a row apart the lower control's hit box lay over the upper one's text and took its taps: at 1200 × 450 in Spanish, `[ Compartir este cielo ]` over `[ recorrer la noche ]`, found when the capture run could not press `[ scrub ]`.
  The folded actions get `row-gap: var(--row)`; on one line, as in English, it costs nothing.

---

### 2.33 v2.0.3 decisions (2026-09-19)

- **D-526 — The e2e stage is two shards, and the budget is read off the slowest one.**
  (FR-CI-1 as amended v2.0.3, V20-24; D-195.) `ci.yml`'s `ci` job gains `strategy.matrix.shard: [1, 2]` and runs `npx playwright test --shard=${{ matrix.shard }}/${{ strategy.job-total }}`; `CI_E2E_SHARDS` sits beside `CI_PR_BUDGET_MIN` in the workflow's `env` as the number a PR has to raise visibly, and each shard keeps `timeout-minutes: 10`, so one shard over the budget still fails the run.
  Playwright's own `--shard` splits by spec file after sorting, so the two halves are stable between runs and no spec is dropped or shot twice; `workers: '100%'` (D-195) is unchanged and applies inside a shard.
  The stage-times step runs in each shard and names it in the summary's heading, so the table still says where the minutes went.
  The install, typecheck, lint and unit stages run in both shards — about 130 s of duplicated machine time against roughly 3 min 30 s of wall time saved, and V20-24 is the decision to spend it; splitting them into a third job would put the unit stage's verdict behind a second runner's queue for no gain to the reader.
  The capture workflow (FR-CI-2) is untouched: it is not on the reader's path and has its own 40 min.
  The change ships with this amendment rather than as a task of its own, because by the evening it was written every pull request — including this one — was being cancelled on the cap after passing its tests, and a task to fix that could not have gone green to land.
  It is nine lines of `ci.yml` and an assertion in `tests/docs/ci.test.ts`, and no file under `src/` moves; §16.16's task list is unchanged.

### 2.34 R80 decisions (2026-09-20)

- **D-495 — The main chunk's overrun is a finding with the mark's share measured, not a budget raised.**
  (R80; FR-MARK-6, D-178, §11; SPEC §4.20 F-69.) The 2.0.0 build measures 158.0 KB gzipped in `main` against the 155 KB budget.
  D-178's rule would put it at 175, the §11 ceiling would cap that at 170, and §11's own v2.0 paragraph forbids the move in advance — *"a mark that does not fit inside main's 155 KB is a finding for the owner, not a budget raised by the task that spent it"*.
  So the budget is untouched, `npm run bundle:budget` prints its `::warning::` on every build from here, and F-69 carries the numbers.
  FR-MARK-6 asks the release task to **measure** the mark, which an attribution guess is not, so it is measured by ablation: the same tree with `Mark.tsx` replaced by a stub that renders an empty box and imports neither `rasters.json` nor `useBead` nor `denseFrame` builds `main` at 152.8 KB (488.6 raw) against 158.0 (506.6 raw), so the component, the six body rasters and the 60 sparse bead frames per tier are **5.2 KB gzipped, 18.0 KB raw**.
  Two facts fall out of that and both belong in the row: without the mark the chunk is inside 155 with 2.2 KB to spare, and the mark is only 5.2 of the 17.9 KB `main` grew over the 1.4.0 build — the rest is board 1B's home screen, the inverted settings page and the phase's copy in both catalogs, whose source alone grew 8.0 KB gzipped over the same span.
  A row that named only the mark would send the owner to cut the cheapest 5 KB in the chunk instead of the largest.
  Every other budget is the D-178 rule agreeing with the number already there, so **no budget moves at all**.
- **D-496 — "The cold open and the settings page added" is a re-shoot, and the only screen the set gains is the live page's second state.**
  (R80; D-179, FR-WATCH-9 f, FR-FIRST-7, FR-SET-4, FR-GUT-8.) The task entry and SPEC §9 both list the re-shoot as "`live-watching`, `live-scrubbing`, the sky screen's gutter, the cold open and the settings page", and `settings` has been a screen of the set since R53 while `location` — "home before a location is known" — *is* the cold open.
  The four requirements that actually say what the set holds all say "re-shot on `main` by the release task" and none of them names a new screen, so the list is read as what the re-shoot must **cover** and not as names to add: only `live` splits.
  It becomes `live-watching` and `live-scrubbing` at the eight widths it already had (1200 × 450 among them since R72), by the rule this file has used since `window` and `legend` — a state is a screen when a reader can be looking at nothing else — and 1200 × 450 is where the pair earns its keep, because FR-WATCH-7 says the box may not move between the two pictures.
  The 32 committed `v1-live-*.png` are **renamed** in the same commit that splits the set, before the shoot, so `captures.test.ts`'s "no capture the set does not name" never has 32 orphans to report.
  `scripts/readme-hero.ts` follows the rename; `tests/docs/public.test.ts` is what caught that it had to.
- **D-497 — F-66 did not reproduce, and it is still open; F-70 is the same defect one screen over.**
  (R80; SPEC §4.20 F-66, F-70; D-421.) R72's method run again on the 2.0.0 build — shoot `polar at 390 px` three times off one build, hash the four files after each run — comes out byte-identical in all four variants, where 1.4.0 alternated in the `dark`/`es` one.
  That is not a closure: nobody changed the code that would have to change, three runs that agree are weaker evidence than one run that disagrees, and the row keeps both measurements.
  What the same probe did find is a second one.
  `v1-sky-screen-chip-844-*.png` alternates in two of its four variants across three runs; decoded and differenced, it is 47 pixels in `night`/`en` and 52 in `dark`/`es`, both inside a box of x 481–562, y 221–289 of 844 × 390 — a glyph or two inside the drawing, not the chip and not the gutter, and not the capture route's azimuth sweep landing elsewhere, which would redraw the whole picture.
  It goes in the register as F-70 with its measurement and the committed file is the one the single run of record produced, exactly as D-421 decided for F-66.
  The probe's own files are put back to that run afterwards, so the set stays one build and one run.
- **D-498 — Every v2.0 question closes as its proposed default, except the one whose condition never arose.**
  (R80; SPEC §7, §12 V20-25..V20-30.) OQ-27..OQ-32 were each answered by the shipped build taking the default the question proposed, so each gets a Decision Log row that says what shipped and why the alternative was not needed — R72's shape for OQ-26, which appends the resolution to the §7 row rather than deleting it, so the question and its answer stay next to each other.
  Two of them have an owner's confirmation attached (OQ-28's phone check on the band, OQ-30's night with the indicator); those are release-checklist items and not reasons to leave a question open, because what ships is decided and only the confirmation is outstanding — a confirmation that went the other way would open a new question.
  **OQ-33 stays open with its reason**: it says "revisit if the stripe looks empty on a summer capture", every fixture in the repository is Neuquén or Paris in September, and no capture or test in this phase has a night without a dark band in it.
  Closing it on a picture that does not exist is the closure the register exists to prevent.
- **D-499 — The release section's owner run is ordered by what a second run would spoil.**
  (R80; `docs/RELEASE.md` §12, SPEC §9 Phase 2g.) §12.1 is the first visit from a clean browser and is first because it is the only item in the list that cannot be run twice on one profile: a second visit is not a first one, and the Spanish walk needs a second clean profile of its own.
  After it the order is the phone in the hand — the live page's two states, the sky screen sideways and upright, the settings page in Spanish — and then the desk, because the three panes and the window dragged short are the two things a laptop can do and a phone cannot. §12.6 carries the three sentences that are the owner's rather than a task's (F-69's budget, F-62's 45 px at 390 × 667, and the two nondeterministic captures), each with the choices named so the answer is a Decision Log row and not a conversation. §12.7's tag item spells out the SHA rule the last two releases needed: a squash merge rewrites the commit, so the tag goes on the release commit and not on whatever `main` has reached by then.

### 8.16 The redesign *(v2.0, FR-FIRST-*, FR-MARK-*, FR-WATCH-*, FR-GUT-*, FR-SET-*, D-438..D-452)*

Five changes, and only one of them is a new kind of thing.

The **mark** is the new one, and it is the dome's own machinery pointed at a different mesh: the same braille cell, the same font, the same orthographic camera, rasterised at build time instead of at mount time because a header is not a chart and must not carry glyphcss (D-438).
What ships is text and a JSON of text; what runs is a timer swapping one small text node (D-439).
The files the browser and the OS require are that same scene drawn as dots at a whole number of pixels a dot, by a renderer with no font and no browser in it, so the icon can never be a different drawing from the header's and its bytes are the same on every machine (D-460; D-440 had them as photographs of the text, which at 16 px cannot survive the font).
*(R74: the scene's numbers — the two planes, the radii, the tick, the stroke and the bead — are D-454; what was re-baked rather than reproduced, and by how many cells, is D-455.)*

The **first run** is a composition, not a mechanism: the three readings are three regions built from the components the home page already has, and the three panes are one media query at one new literal (D-443).
The only genuinely new module is `lib/nextEvent.ts`, and it exists because two pages must say the same sentence about the same fact (D-442).

*(v0.7.2)* SPEC v2.0.2 makes the panes board 1B's, which is where the composition stops being only a re-cut: three small pure modules (`tonightStripe`, `passPath`, `moonNote`) and five components (`TonightStripe`, `ConditionsTable`, `WherePlace`, `ElementsLine`, `WhereDome`, D-506..D-512) replace `NowPanel`, `DarkWindow`, `IssHeroCard` and `LocationSummary` on the one page that rendered them.
The phone's steps are a `useState` in `Home` and two screens that compose the same components (D-513).

The **live page's two states** are a predicate over the instant, not a flag (D-446), an inventory table the page and its tests share (D-447), and a placement function beside `fitBox` (D-448).
The overlay on a short wide window is `ChartFrame`'s screen surface used a third time (D-449) — the same mechanism as the sky screen's overlays and the list panel, which is why the box can stop resizing between the states without anything learning a new trick.

The **gutter** replaces the sky screen's legend strip in the slot the strip already occupies (D-450), and portrait's layout is chosen from the measured box rather than the viewport, which is the rule R73 had to learn for the turn (D-451).

The **settings page** moves three blocks and hides two rows behind a disclosure (D-445).
No store field changes anywhere in the phase; the one preference this phase might have added — which state the live page opens in — is deliberately not added, because FR-WATCH-1 reads the state from the instant and the instant is already in the URL.

### 16.16 Delivery of the v2.0 tasks *(V20-1, D-452)*

The V1-11 rules are unchanged: the same driver, the same waves computed from the checkboxes on `origin/main`, at most one task per lane and at most three at once, auto-merge on a green CI and a clean review except where the owner gates.
Seven tasks over six waves, on `main` after the `v1.4.0` tag.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R74 — Aperture: the generator, the ladder, both headers, the icons and the favicon | `ui` (with `spike/mark/`, `scripts/`, `public/` and `index.html` — `data`'s and no lane's, D-438, D-440) | fable | owner (a new mark in every header, the icons at 1 : 1, captures) | — |
| 2 | R75 — The settings page: the order inverted, one viewport in Spanish | `ui` | opus | owner (Spanish copy, the fit measured on a phone, captures) | R74 |
| 3 | R76 — The first run: the cold open, the countdown, three readings, three panes | `ui` (with `lib/nextEvent.ts`, its own) | opus | owner (Spanish copy, the three panes at a desk, captures) | R74, R75 |
| 4 | R81 — The home's panes as drawn: the stripe, the table, the next event, the cards and the Where reading | `ui` (with `lib/tonightStripe.ts`, `lib/passPath.ts` — its own) | opus | owner (Spanish copy, the panes beside board 1B, captures) | R76 |
| 4 | R79 — The compass gutter, and portrait's band | `window` (with `skychart/ChartFrame.tsx` — `chart`'s, D-450) | opus | owner (a phone held up, sideways and upright; Spanish copy; captures) | R76 |
| 5 | R77 — Watching and scrubbing: the split, the inventory, the headline and the conditions line | `live` | opus | owner (one-handed at night, captures) | R76, R81 |
| 5 | R82 — The phone's first visit: three steps, then stacked | `ui` (with `lib/moonNote.ts`, its own) | opus | owner (a first visit on a phone from a clean browser, Spanish copy, captures) | R81 |
| 6 | R78 — The two short shapes: the landscape phone's rail and the short wide window's overlay | `live` (with `skychart/ChartFrame.tsx` — `chart`'s, D-449, and `lib/layout.ts` — `ui`'s, D-448) | fable | owner (a window dragged short in both states, beside the matrix's numbers) | R77, R79 |
| 7 | R80 — v2.0 release preparation | `ui` | opus | owner | R78, R82 |

Four of the seven are the `ui` lane, and that is what shapes the schedule: R74, R75, R76 and R80 run one per wave because two sessions in `Header.tsx`, `Settings.tsx` and `src/i18n/en/ui.ts` at once is exactly what §16.1 exists to prevent.
Wave 4 is the phase's only full one, `live` and `window` on two screens that share no file.
R78 depends on R79 as well as on R77 — not for anything it needs, but because both cross into `ChartFrame` (D-449, D-450) and a wave that put them together would put two branches in that file; the dependency is the cheapest way to say so, and it costs one wave in a phase whose `ui` chain is longer anyway.

Models follow §16.6.
R74 and R78 are visual work whose acceptance the session can measure itself — a committed raster table, and a matrix of heights that must come out equal — so `fable`.
R75, R76, R77 and R79 are copy in two languages and semantics a test cannot fully reach: an inverted page that must fit a Spanish viewport, a first run with new sentences and a new breakpoint that interacts with the guide's, a page split into two states where a plausible wrong answer leaves a control unreachable, and a gutter whose bearing sign looks right in a unit test and is backwards in the hand (R73's argument).
The release task is `opus`, as every phase's has been.
Every task is `Gate: owner`: each ships captures, Spanish copy, or both.

**Decision blocks** (§16.2), reserved here before wave 1: **R74 takes D-454 to D-460, R75 D-461 to D-464, R76 D-465 to D-472, R77 D-473 to D-480, R78 D-481 to D-486, R79 D-487 to D-494, R80 D-495 to D-499.**
Numbers a task does not spend stay unspent.
**D-500** and **D-501** are outside the blocks: both were taken at R75's gate, for rules that belong to no one task.
*(v0.7.2)* **R81 takes D-515 to D-522 and R82 D-523 to D-528**; D-505..D-514 are this plan's, and D-502..D-504 were R76's gate's.
With R81 and R82 the phase is nine tasks over seven waves: wave 4 is R81 and R79, wave 5 R82 and R77, both waves full in the sense §16.16 means — two screens, or two lanes, sharing no file.
R81 and R82 are `ui` and so one per wave by §16.1; R82 and R77 share no file (`Home.tsx` and `screens/home/**` against `Live.tsx` and `liveRows.ts`), and R77 reaches the block R81 re-cut only through its props.

**Lane ownership for this phase** (§16.1's table, extended rather than rewritten): `src/ui/components/mark/**` and `src/lib/nextEvent.ts` are `ui`'s; `src/ui/screens/liveRows.ts` is `live`'s, being `screens/Live*`'s neighbour and read by nothing else; `src/ui/components/guide/skychart/window/gutter.ts` and `CompassGutter.tsx` are `window`'s; `spike/mark/**` and `scripts/build-mark.ts` belong to no lane and are R74's alone.
`public/**` is `data`'s and R74 crosses into it for the two icons and the favicon; `skychart/ChartFrame.tsx` is `chart`'s and R78 and R79 cross into it in different waves.
Every crossing is named in its task's entry, as R71's and R73's were.

What each session is told to read (D-284's rule): all seven read SPEC §12 V20-1..V20-13 and PLAN §2.25, §8.16 and this section.
Then R74: SPEC §4.29 (FR-MARK-1..8), §4.6 (FR-X-6 as amended), §4.11 (FR-OFF-6 as amended), §4.16 (FR-COMP-1, FR-COMP-4 as amended), §4.8 (FR-DESK-2 as amended); PLAN §8.1, D-16, D-28, D-127 (what it supersedes), D-370.
R75: SPEC §4.32 (FR-SET-1..4), §4.16 (FR-COMP-2 as amended), §3.2 US-20, US-29; PLAN D-184, D-260, D-262.
R76: SPEC §4.28 (FR-FIRST-1..7), §4.1 (FR-LOC-1 as amended), §4.8 (FR-DESK-1, FR-DESK-2, FR-DESK-3 as amended), §4.16 (FR-COMP-3 as amended), §3.2 US-1..US-5, US-14, US-26; PLAN §8.16, D-72, D-192, D-253.
R77: SPEC §4.30 (FR-WATCH-1..9), §4.10 (FR-LIVE-1..7 as amended), §4.26 (FR-SPAN-2 as amended), §4.27 (FR-LEG-6, FR-LEG-7 as amended), §3.2 US-27; PLAN §8.8, §8.14, D-190, D-386, D-387.
R78: SPEC §4.30 (FR-WATCH-5, FR-WATCH-6, FR-WATCH-7), §4.25 (FR-SHP-1..5 as amended); PLAN D-173, D-246, D-314, D-381, D-414, D-449.
R79: SPEC §4.31 (FR-GUT-1..8), §4.23 (FR-FSC-1..11 as amended), §4.18 (FR-WIN-1..3), §4.17 (FR-LEG-1..5), §3.2 US-21, US-28; PLAN §8.10, §8.13, §8.15, D-188, D-278, D-322, D-427, D-451.
R80: SPEC §9 Phase 2g, §4.16 (FR-COMP-6 as amended), `docs/RELEASE.md` and PLAN §11.
No session reads the three documents whole.
