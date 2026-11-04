# v1.4 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.23 v1.4 decisions (2026-09-08)

These plan SPEC v1.4 (V14-1..V14-8).
P1's block was D-368..D-377 and P2 spent the last of it plus D-378 (§2.22); v1.4 starts at **D-379**, and §16.14 reserves each task's block from D-391.

- **D-379 — The mode is a selector, the shape is a media query, and no rule has one without the other.**
  (FR-SHP-1, FR-SHP-2; F-65; V14-2.) `Live.module.css`'s `(orientation: landscape) and (max-height: 500px)` block becomes `.page[data-compact='true']` throughout — the grid, the column gap, `.dome { --page-pad-x: 0 }` and `.side { overflow-y: auto }` alike — so the landscape-phone layout is what its comment always said it was.
  The check is a stylesheet test rather than a reviewer's eye: `tests/styles/liveShape.test.ts` reads `Live.module.css` as text, as `breakpoint.test.ts` already reads px literals out of the stylesheets (D-253), and asserts two things — every `@media` block in the file carries `[data-compact=` in each of its selectors, and no block that sets `grid-template-areas` or `grid-template-columns` on `.page` sets only one of them.
  It fails on the old file for the first reason and passes for the second, which is the honest state: the collision came from two rules at different specificity, not from one incomplete block, and the test's second half is there to stop the next one.
- **D-380 — The matrix is one page resized, not twenty loads.**
  (FR-SHP-4; D-316's lesson.) `tests/e2e/shapes.spec.ts` loads the live page once against the R1 fixtures and walks FR-SHP-4's sizes with `page.setViewportSize`, measuring the invariants at each: the panes' rectangles against each other, `document.documentElement.scrollHeight` against `innerHeight`, `scrollWidth` against `clientWidth`, and `chart-box` against `LIVE_BOX_MIN_PX` and FR-DOME-1's fit.
  Twenty fresh loads cost about 2.6 s each on CI's two cores and would put the e2e stage near FR-CI-1's ten minutes; one page resized is under 15 s, and the resize path is also the one F-60 was about, so the walk is doing double duty.
  Where the assertion is specifically about a fresh load (1280 × 800 after a large size) `dome-resize.spec.ts` keeps its own control.
  The home page and the pass detail take the compact-portrait and desktop rows from one load each, in the same spec.
- **D-381 — `LIVE_BOX_MIN_PX` and the fold order go in `lib/layout.ts`, a recorded crossing.**
  (FR-SHP-3; V14-2.) `LIVE_BOX_MIN_PX = 192` and `foldRows(heightPx)` — pure, from the height the page has to which rows under the box it drops — join `fitBox`, `WIDE_MIN_PX` and the rest in `src/lib/layout.ts`, which the `ui` lane owns, and `LIVE_TWO_COLUMN_MIN_PX` is deleted from the same file.
  `Live.tsx` reads them.
  Recorded here so the breakdown does not cut a second task for two constants in a file the `live` task must edit anyway (§16.13 names the crossing).
- **D-382 — The chunk is derived from the instant, never stored.**
  (FR-SPAN-1; V14-3.) `lib/timeStripe.ts` gains `chunkFor(t, span, timeZone)` → `Span`, pure: the boundaries are multiples of `STRIPE_CHUNK_H` hours from the observer's local midnight, found through the same `Intl.DateTimeFormat` path `hourTicks` already uses and memoised on the zone as that is, then clipped to the span.
  `TimeStripe` keeps taking the 24 h span and computes the drawn window from `t` itself.
  Nothing new is stored: no slice field, no prop from the page, nothing in the `#live` hash (FR-LIVE-9 unchanged).
  This is what makes FR-SPAN-1's "not a state the reader manages" true in the code rather than only in the copy — there is no second thing that could disagree with `t`.
  The geometry memos (`hourTicks`, `nightBands`, `passSegments`) key on the chunk instead of the span, so playback pays one recompute per boundary crossing and nothing per frame (FR-SPAN-5, D-190's rule kept).
- **D-383 — The overview is its own component, not a mode of the stripe.**
  (FR-SPAN-2.) `components/live/StripeOverview.tsx`: the whole span in one row of body-size cells, the night bands and one mark per pass from the same `lib/timeStripe.ts` functions at its own width, a bracket from `chunkFor`, and its own `role="slider"` with the 15 min and one-chunk key steps.
  Threading a `rows` prop through `TimeStripe` would put two pictures with different jobs behind one set of props and one memo set; the two components share the pure module and nothing else.
- **D-384 — `StepControls` keeps its file, its contract and its six buttons; two of them change.**
  (FR-SPAN-3, FR-SPAN-4, FR-TRAJ-5 as amended; V14-3, V14-6.) `previousRise` and `nextRise` are already in `lib/timeStripe.ts` and already exact; the ±10 min buttons are deleted and two chunk buttons take their place, stepping `t` by `STRIPE_CHUNK_H` hours and clamping to the span through the same `onStep` the row has always had.
  `Live.tsx` drops the `touch &&` guard so the row is rendered wherever the stripe is (V14-6).
  The labels are message ids in both catalogs and their cell count is `tests/styles/controlRows.test.ts`'s to assert — 35 cells against FR-COMP-4's 36, which is the tightest row in the app and the reason the ±10 min pair could not simply stay.
- **D-385 — The speed fallback is a pure predicate on the speed the slice already holds.**
  (FR-SPAN-6; V14-8.) `drawnSpan(t, span, timeZone, speed)` in `lib/timeStripe.ts` returns `chunkFor(...)` while `STRIPE_CHUNK_H × 3600 / speed ≥ CHUNK_MIN_WALL_S` (10) and the whole span otherwise — true for 1× and 60×, false for 600× and 3600×, with the arithmetic in one place instead of a speed list to keep in step with `usePlayback`.
  Nothing is stored and nothing is animated: the stripe re-renders at the new span on the tick that changes the speed.
- **D-386 — The rail is the wide layout; `data-columns` and the one-column rules go.**
  (FR-LEG-6; V14-4; supersedes D-319 and D-320.) `Live.tsx` loses its `columns` state, its `oneColumn` flag and the `stacked` prop it passed the frame; it hands `aside` to `SkyChart` at every wide width, with `boxAspect` and `stripe` as now.
  `Live.module.css` loses `.page[data-compact='false'][data-columns='one']` and the `.side` row rules under it.
  That block is also the other party to F-65's specificity collision, so this deletion removes the collision — but it does not *fix* F-65, and the two tasks are deliberately independent: R69's guard is what makes the landscape rule the phone's, and it holds whether or not the one-column block still exists.
  The matrix test (D-380) is what proves both, and it runs in each of the two tasks.
- **D-387 — The control is the page's, the panel is the frame's, the preference is the store's.**
  (FR-LEG-7; V14-5.) Three seams, one per lane: `Live.tsx` renders `[ list (n) ]` in the actions row and passes `legendOpen` down (`live`); `ChartFrame` renders its legend slot only while open and gives it exactly `calc(2 * var(--tap))` with `overflow-y: auto` — the rule the sky screen's strip already uses at `--legend-row` (FR-FSC-3), so this is a second use of an existing mechanism and not a new one — and `Legend.tsx` gains the empty line (`chart`); `prefs.liveLegendOpen`, a boolean beside `savedChartView` in `src/model/prefs.ts` and `src/state/slices/prefs.ts`, default `false` (`data`).
  The `chart` and `data` parts are recorded crossings of the one task that owns the change (§16.14); cutting three tasks for one control would put a page that renders a control at a panel that does not exist yet on `main`.
- **D-388 — `n` is the drawn passes.**
  (FR-LEG-7; OQ-26.) `lib/legend.ts` already returns the pass rows and the body lines separately; `n` is the length of the first.
  A count that included the Sun and the Moon would read `list (2)` on an empty sky, which is the one number the control must not show.
- **D-389 — The fold order arrives in two pieces.**
  (FR-SHP-3, FR-SPAN-2.) R69 implements FR-SHP-3's fold with the rows that exist on its branch — the actions row joining the status strip's line — and R70 puts the overview row at the head of the order in the task that creates it, extending the matrix test in the same branch.
  The alternative is a branch whose stylesheet names a row nothing renders.
- **D-390 — v1.4 is six tasks over five waves, findings first.**
  (§16.14; V14-1, V14-7.) F-64 is a red test on `origin/main`, so it is in wave 1 and every later task inherits a green baseline; the two `window` cleanups run beside it in their own lane.
  The three layout changes then run one per wave, because all three are the `live` lane and each changes what the frame measures — the shape rules, then the stripe's rows, then the box's width — and a rebase of any two of them onto one another is a merge in the one file the phase is about (`Live.module.css`).
  The release task is last, as every phase's has been.
- **D-391 — F-64 was the `e2e` script, not the catalogue or the fixture.**
  (R67; FR-FIX-1, FR-FLAG-1, FR-FLAG-2.) With `VITE_MOON_LORE=on` set, `moon.spec.ts` passed unchanged, its "Taurus" assertion included, so neither the lore catalogue nor the fixture's date was at fault.
  `playwright.config.ts` only ever previews whatever `dist/` already holds — CI's `ci.yml` builds that `dist/` with the flag on before its Playwright stage, but `package.json`'s `"e2e"` script (`vite build && playwright test`, the one `README.md` and `PLAN.md` §5 document as the local equivalent) built with the flag at its unset default (off), so a bare `npm run e2e`, or `npx playwright test moon.spec.ts` against the dist it left behind, showed the Now panel with no lore line — exactly the row's report.
  The fix sets the flag in that one script (`"VITE_MOON_LORE=on vite build && playwright test"`), matching CI; `tests/build/flags.test.ts` (which builds its own throwaway `dist` with the flag deliberately unset) and `v1-captures.spec.ts` (skipped unless `CAPTURES=1`, and shot by `captures.yml`'s own separate `npm run build` with the flag left off) are both untouched by it.
- **D-411 — The compact live page's share action loses its brackets.**
  (R71; FR-COMP-4 as amended v1.4, FR-LEG-7.) With `[ list (n) ]` on it the actions row is `[ ] Ocultos [ lista (3) ] [ Compartir ]` — **39 cells** in Spanish against FR-COMP-4's 36, so it wraps at 390 px and the compact page has three rows of controls where FR-LIVE-7 allows two.
  The arithmetic has one degree of freedom: the hidden-objects toggle is 11 cells and the share action 13, which leaves 10 for a control whose shortest honest Spanish label (`lista (3)`, plus the brackets every action carries) is 13.
  No label change saves three cells without changing meaning, which FR-COMP-4 forbids; D-245 had already spent the cheap two by making this action bracketed text rather than a boxed button.
  So the brackets themselves go, on this row only: `ShareButton` gains `plain`, a class of its own rather than an override, so `tests/styles/cells.ts` still reads the row's width off the stylesheet.
  The row is 35, the word keeps the accent colour and the 48 px hit box, and every other share action in the app is unchanged.
  The alternative the owner may prefer is a shorter Spanish label, and it is one string away.
- **D-412 — The cut box stands at the left of its area.**
  (R71; FR-LIVE-7, FR-LEG-6.) `.drawing`'s `margin: 0 auto` centres the box in the two `auto` columns it spans.
  While the box was the widest thing in them — every width the rail had before R71 — that was the same as the left edge.
  At the narrow wide widths it is not: at 1280 × 720 the stripe's 44-cell floor and the row above the box make the area wider than the box, and the centred box stood 13 px right of the stripe under it (19 px at 964 × 700).
  FR-LIVE-7 says the box stands at the left of the page, so the boxed rail layout sets `margin: 0` and the box, the stripe and the page's own margin share an edge.
  `live-rail.spec.ts` asserts that edge at all ten sizes.
- **D-413 — `ChartFrame`'s `stacked` mode stays, unused.**
  (R71; D-386, D-319.) D-386's deletion is `Live.tsx`, `Live.module.css` and `lib/layout.ts` — the page's three files.
  No page passes `stacked` now, but removing the frame's mode is a `chart`-lane change to four files and their contract tests, which D-386 did not ask for and which would make this task's diff harder to read against the one thing it is about.
  It is dead API with a comment saying so; a `chart`-lane cleanup can take it.
- **D-414 — The fold table is not re-derived here.**
  (R71; FR-SHP-3, D-389.) `lib/layout.ts`'s `LIVE_KEPT_ROWS_PX` counts the status strip's line and the actions row as rows *under* the box, which they no longer are: they are the rail's.
  The table therefore over-counts by about 93 px, so a short wide window folds a little **earlier** than the floor asks and never later, which costs no window its box.
  What it also means is that folding `actions` — moving the actions onto the strip's line — now buys the box almost nothing vertically, since both are beside the box: at 964 × 420 the box is 142 px where R70 measured 155.
  Re-deriving the table is a measurement across heights on the new layout and is a task of its own; `tests/e2e/shapes.spec.ts` holds that row to what it measures today, as it has held every row since R69.
- **D-415 — F-62 is closed at 390 × 844 and open at 390 × 667.**
  (R71; FR-LEG-8, FR-COMP-5.) Measured on the branch with the list closed, on the box: 375 px at 390 × 844 against the floor of 374 (the frame's own measured width, `--chart-floor`), where F-62 reported 259; and 198 px at 390 × 667, where it reported 82.
  The 667 px phone cannot reach its floor and no legend is left to cut — the rows the page must draw under the box take more than the 293 px that height leaves over a 374 px box — so FR-LEG-8's "MUST hold … at 390 × 667" is not met and is written up in SPEC §4.20 rather than asserted around.
  The owner's call: drop the floor at that height, or take a row off the page there.
- **D-419 — The 1.4.0 budgets: the rule ran and nothing moved.**
  (R72; D-178, SPEC §9 Phase 2f; re-measured on the shipping build after R73, V14-11.) Measured on the flag-on build CI's bundle stage builds (D-307): main 140.1, chart 94.2, worker 36.1, astronomy 22.1, window 11.1, live 8.5, service worker 5.0.
  The figures before R73 were main 138.4 and window 12.1; the release is taken on the code that ships, so these are the ones the rule ran on.
  R73 moves two rows without moving a budget: main gains 1.7 KB — the layer's turn, the context and the advice in both catalogs, all of it in `components/screen/` and the copy — and the window chunk *sheds* 1.0 KB, because deleting the portrait veil took its media-query path with it and the quarter is arithmetic on a rotation the chunk already had.
  Every `measured × 1.1` rounded up to the next 5 KB and floored at 10 lands on the number the budget already carries, so §11's table is re-stated rather than changed and `scripts/bundle-budget.ts` keeps its seven rows.
  Recorded as a decision because "nothing moved" is a result and not a skipped step — the alternative reading of D-178 would be to move `chart` down to 100 or `window` down to 15 → 10 on measured figures that have not fallen, which would spend a release on rounding noise.
  The rule's floor is what the phase actually bought: `live` at 8.5 against 7.4 is the largest single-chunk growth of any release re-set so far, and it is still inside the 10 KB floor.
- **D-420 — The capture set gains two widths for one screen, and no second height.**
  (R72; D-179, FR-SHP-5, FR-LEG-9.) The set is topped up with `live` at 1024 × 768 and 1200 × 450 — eight files, both themes and both languages, no new screen — and re-shot whole off one build, which is what D-179 means by the set. 1024 is the desktop width FR-SHP-5 names as never covered: the home and the guide have been shot there since D-192 and the live page never, which left the page the phase spent its work on with no picture between the wide breakpoint and 1280. 1200 × 450 is F-65's own size, and it is in the set for the reason F-65 survived four phases: every test of the landscape rules ran at a compact width, and a set with no short-and-wide picture is the same blind spot in the record that CI had in the suite.
  What is **not** added is FR-LEG-9's 390 × 667: the files are named `v1-<screen>-<width>-…`, so a second height at 390 either collides with the phone already in the set or is filed under a number that is not its width, and F-62's 667 half is unsettled (D-415), so the picture would be of a layout the spec has not decided.
  R71's `r71-*` captures hold that evidence until it is.
  The set is 124 files and `captures.yml`'s note says so.
- **D-421 — F-66 is written down, not chased.**
  (R72; SPEC §4.20, F-48.) The release re-shoot changed one file no v1.4 task touched: `v1-polar-390-night-es.png` alternates between two states 142 px apart inside the drawing (bounding box x 137–318, y 269–385), while the other three variants of that screen are byte-identical across three runs off one build.
  It is not F-48's run-dependent instant — that would move every variant of every screen — and it is `chart`-lane code, which this task may not touch (§16.1).
  So it goes in the register with its measurement, the way F-57 and F-62 went in, and the re-shot file is committed as it came out: a set re-shot off one build is the point of D-179, and the one capture that cannot answer twice the same way is worth a row rather than a rerun until it agrees.
- **D-422 — OQ-26 closes here, OQ-24 and OQ-25 stay open, and the difference is what a headless run can see.**
  (R72; SPEC §7, V14-12.) All three of v1.4's open questions shipped their proposed default, and only one of them is answerable without a night outdoors.
  OQ-26 is a rule about what a number means — `[ list (n) ]` counts the drawn passes and the two body rows sit in the panel uncounted — and the argument for it is on the page: a count including the bodies could never read zero, and `list (0)` with a one-line panel is exactly what an empty sky has to be able to say.
  So it is closed by V14-9.
  OQ-24 (four hours) and OQ-25 (the whole-span fallback at 600× and 3600×) are questions about how something feels to use at speed, in the dark, on a phone; the phase measured what it could — 40 s per pixel against four minutes, 24 s and 4 s of wall time per chunk — and neither figure decides them.
  They are left open with the reason stated in §7 and put on the owner's release run (`docs/RELEASE.md` §11.1, §11.3) rather than answered by a task that cannot see the thing being judged.
- **D-423 — The release section is `RELEASE.md` §11, appended after the metadata section rather than before it.**
  (R72; FR-PUB-11.) §10 is the repository-metadata checklist, which is not a phase and was appended last by P1; the phase sections run §6 to §9.
  Inserting v1.4 as a new §10 would renumber it, and SPEC §4.24's v1.3.3 note points at "`docs/RELEASE.md` §10" by number.
  So the phase sections are §6–§9 and §11, with §10 between them, and the ordering rule for this file is now "append": a section number, once printed in another document, is a name.

### 2.24 v1.4.1 decisions (2026-09-09)

These plan SPEC v1.4.1 (V14-9..V14-11). §16.14 reserved v1.4's task blocks up to D-423 (R72's); v1.4.1 starts at **D-424**, and §16.15 reserves R73's block from D-431.

- **D-424 — The quarter turn is a pure function of the rotation the window already smooths.**
  (FR-FSC-10; lane `window`.) `skychart/window/screenTurn.ts`, one exported function: `quarterTurnFor(m: Mat3 | null, held: Quarter): Quarter`, `Quarter = 0 | 90 | 180 | 270`.
  The pose costs no new API, no second permission and no second listener, because `useDeviceOrientation` already hands out the smoothed device -> earth rotation the drawing is aimed by: up in the room, taken through that rotation into the phone's own frame, is the vector the function reads, and it reads it through `projection.ts`'s existing frame helpers rather than restating the convention (D-188, D-285's lesson: a frame written twice is a frame written wrong once).
  Its component in the plane of the screen gives the direction; the quarter returned is the one whose screen-up is nearest it, expressed the way `screen.orientation.angle` expresses it, so the number means the same thing the browser's does.
  Two guards, both in the function: `held` comes back unchanged while `hypot(x, y) < sin(SCREEN_TURN_FLAT_DEG)` — the phone within 25 degrees of flat, which is the zenith pose the app exists for — and while the nearest quarter is not more than `SCREEN_TURN_HYSTERESIS_DEG` (20 degrees) past the diagonal from `held`.
  `m === null`, before the first reading, returns `0`.
  Pure, so the pose table is a unit test and not a device (D-429).
- **D-425 — The projection is composed with the quarter, not with the browser's angle.**
  (FR-FSC-10, FR-WIN-1.) `View.screenAngleDeg` (`window/projection.ts`) is what turns the projected plane, and today it is `screen.orientation.angle` verbatim.
  On a screen it becomes the quarter D-424 returns, which on an unlocked phone *is* the browser's angle and on a locked one is what the browser's angle would have been.
  Nothing in `projection.ts` changes: the plane is turned by the number it is handed, `scaleFor` still spans the shorter side of the measured box, and `groundState`, `verticalHalfFieldDeg` and `drawableDeg` all read that box, so the wide field arrives with the box and not with a special case.
  Off a screen — the spike's harness, and any window not mounted in the layer — the value stays the browser's angle and nothing moves.
- **D-426 — The layer is turned by the difference, with its sides swapped.**
  (FR-FSC-10, FR-FSC-9; lane `screen`.) `SkyScreen` holds the reported quarter and turns itself by `quarter - screen.orientation.angle`, so an unlocked phone turns by nothing.
  `SkyScreen.module.css` keeps `position: fixed` and gains, for a non-zero turn, `width: 100dvh; height: 100dvw; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(var(--screen-turn))` with `transform-origin: center`: the layer covers the viewport exactly in either pose, and the drawing, the readout, the legend and the `×` turn as one thing because they are one thing.
  The box the window measures is the layer's *layout* box — `ResizeObserver` reports the border box before transforms — so a turned layer measures 844 x 390 inside a 390 x 844 viewport and the picture is landscape by construction, not by a media query.
  `data-turn` on the layer is what the tests and the captures read.
  FR-FSC-9 is unaffected: a fixed layer the size of the viewport still cannot scroll, and `overscroll-behavior` stays where R66 put it.
- **D-427 — The portrait veil is deleted, and the ground states are computed in every orientation again.**
  (FR-FSC-4 as rewritten; supersedes D-323.) `SkyWindow`'s `portrait` state, its `useMediaQuery('(orientation: landscape)')` and the `status={null}` / `legend={null}` it handed the frame all go: the SVG is painted in both orientations, the readout and the legend are the frame's overlays in both, and `ground` is `groundState(m, view)` unconditionally — D-323 had made the ground states landscape-only so the veil could win, and with no veil that guard is what would hide the ground note on an upright phone.
  `data-orientation` stays on the window root but is now read from the measured box (wider than tall, or not), which is what the reader is looking at, rather than from the viewport's media query, which under a rotation lock is not.
  `SkyScreen`'s `aria-labelledby` branch goes with the veil: there is always a readout to name the dialog now, and `chart.screenLabel` goes too if nothing else names it.
- **D-428 — The advice is a note beside the ground ones and loses to them.**
  (FR-FSC-11; lane `window`.) One more `role="status"` line in the same place in `SkyWindow`'s box, rendered when the measured box is taller than it is wide and `ground === 'sky'`; the ground notes (D-278) keep the position and the precedence, so at most one line ever stands over the picture.
  Copy in `i18n/{en,es}/window.ts`: the key `portrait` is replaced by `turnAdvice` — "Turn the phone sideways to see more sky." / "Gira el teléfono de lado para ver más cielo." — because the old key's text was an instruction to obey and the new one is a sentence about what a wider box buys; a rewritten string under the old key would leave every reader of the code believing the gate is still there.
  Test id `window-portrait-note` -> `window-turn-note`.
- **D-429 — The quarter is reported up through one context, not measured twice.**
  (FR-FSC-10; F-57 and F-58's lesson.) The rotation lives in `SkyWindow` (the hook is its) and the transform lives in `SkyScreen` (the layer is its), with `SkyChart` in between and no business in either.
  A second `deviceorientation` listener in the layer would answer it and would be exactly the duplicated work R68 has just removed, so instead `components/screen/screenTurn.tsx` holds a context: `SkyScreen` provides `{ quarter, report }`, `SkyWindow` calls `report(quarter)` in an effect when the quarter it computed changes, and with no provider — the spike, any window not in a layer — `report` is a no-op and the quarter is `0`.
  The window uses the quarter it computed for its own projection, so the two never disagree about geometry; the layer's transform lands one commit later, which the ResizeObserver settles in the frame after, and a quarter flip is a thing that happens once when a hand turns, not per frame.
- **D-430 — The tests, the captures and what must fail first.**
  (FR-FSC-4 as rewritten, FR-FSC-10, FR-FSC-11, FR-FSC-7; FR-FIX-1's shape.) Unit: `screenTurn.test.ts` walks a table of poses — upright, both sideways, upside down, each diagonal inside and outside `SCREEN_TURN_HYSTERESIS_DEG`, flat face-up and face-down holding `held`, and `null` — and `projection.test.ts` gains the composed angle at one pose per quarter, pinning that a locked-portrait phone held sideways projects the horizon exactly where an unlocked one does.
  Component: `SkyWindow.test.tsx` asserts, in `screen` mode in a portrait box, that the arcs, the readout and the legend are in the tree with the advice line, and that pointed at the ground the ground note is the only line; `SkyScreen.test.tsx` asserts the layer's `data-turn` and its swapped box from a reported quarter, and the dialog named by the readout in both orientations.
  E2E: `sky-screen.spec.ts` at 390 x 844 with `stubCompass` and a sideways pose (`liveHelpers.ts` gains `pose(page, {beta, gamma})` beside `heading`) asserts the turned layer, a drawing box wider than tall and no scroll; upright, the drawing and the advice together.
  The assertions that must fail on the old code are those two e2e cases and the component one: on `main` today the portrait box is a note with no drawing in it.
  Captures (FR-FSC-7): the `sky-screen-390-portrait-*` pair is re-shot with the picture in it, and one `sky-screen-390-turned` is added at one theme and one language; `tests/e2e/captureSet.ts`, `tests/docs/captures.test.ts` and `docs/screenshots/` follow, and `spike/window/screen-capture.ts`'s "the harness is not in the portrait state" guard becomes a check that the drawing is there.

- **D-431 — The quarter is folded where the rotation is folded.**
  (FR-FSC-10; refines D-424 and D-429, taken during R73.) `quarterTurnFor` is pure and takes the quarter it is holding, so *something* has to keep the previous answer between readings — the hysteresis is exactly that dependence.
  D-429 put it in `SkyWindow`, which cannot hold it: `react-hooks/set-state-in-effect` forbids the state update from an effect and `react-hooks/refs` forbids a ref read during a render, and both rules are on.
  So the fold is `useDeviceOrientation`'s, one step per animation frame beside the `smoothRotation` step it already folds there, handed out as `quarter` on the handle; `setQuarter((current) => quarterTurnFor(next, current))` bails out on the same value, so a phone held still costs no render and a turn of the hand costs one.
  Everything else of D-424 and D-429 stands: the function is untouched, the window still decides — the quarter on a screen once there is a reading, `nearestQuarter(screen.orientation.angle)` before it and off a screen, which is FR-FSC-10's "it starts at none" — and the context is still how the layer hears about it.
  `nearestQuarter`, the rounding both ends share, is exported beside `quarterTurnFor` rather than written twice.
- **D-432 — A half turn covers the viewport as it is.**
  (FR-FSC-10, FR-FSC-9; refines D-426, taken during R73.) D-426's `width: 100dvh; height: 100dvw` is right for a quarter turn and wrong for a half one: a layer turned 180° needs the viewport's own two sides, and swapping them would leave it 390 x 844 inside an 844 x 390 screen — the opposite of what FR-FSC-10 asks the swap for ("so it still covers the screen exactly").
  So the turned rule sets `100dvw` by `100dvh` and the swap is a second rule for every turn that is not the half one: `.screen[data-turn]:not([data-turn='0']):not([data-turn='180'])`.
  The `:not` chain is not decoration — `[data-turn='90']` alone loses on specificity to the rule above it, which is a mistake that costs nothing to make and is invisible until a phone is in a hand, so `SkyScreen.test.tsx` pins both selectors as text.


### 8.14 The shape, the chunk and the list *(v1.4, FR-SHP-1..5, FR-SPAN-1..7, FR-LEG-6..9, D-379..D-390)*

Nothing new is designed here either; the three changes are three seams that already exist, used once more.

The **shape** is a CSS question and stays one: the mode is on the page element as `data-compact` (D-72) and every media query names it (D-379).
What is new is not a mechanism but a check — a stylesheet test and a viewport walk (D-380) — and one constant with a pure rule beside `fitBox`, where the layout arithmetic already lives (D-381).
No component learns anything.

The **chunk** is a pure function of the instant (D-382).
`lib/timeStripe.ts` is where the stripe's geometry has always been, `TimeStripe` keeps its props, the overview is a second small component over the same module (D-383), and the stepping row keeps its one contract (D-384).
The store is untouched, which is the point: a chunk that lived in a slice could disagree with `t`, and then the reader would have two things to steer.

The **list** is the only one that crosses lanes, and it crosses them the way the sky screen did: the page decides *whether* (a control and a flag), the frame decides *how* (a slot at a fixed height), the store remembers (a boolean), and the legend itself only gains one line of copy (D-387).
The rail's return is a deletion rather than an addition — `data-columns`, the one-column block and a threshold constant all go (D-386) — which is why it is the last of the three: it removes the CSS the other two are measured against.

The order of the overlays is the order of reading: the readout at the top-left is what the phone is doing, the legend at the bottom is what the letters on the arcs mean, the `×` at the top-right is the way out; none of the three moves with the layout mode, since the screen is the viewport at every size the control is offered.
The dome's fit rule and the wide page's rail (D-312..D-320) are not involved: the window is SVG and scales to its host (D-188), and the host is the screen.

### 8.15 The screen that does not wait *(v1.4.1, FR-FSC-4 as rewritten, FR-FSC-10, FR-FSC-11, D-424..D-430)*

One seam, and it is the seam D-333 already drew.
The rotation is the window's, the layer is the screen's, and the chart between them learns nothing: the window computes the quarter from the rotation it is already smoothing and uses it for its own projection (D-424, D-425); the screen reads the quarter through a context and turns itself by the part the browser did not do (D-426, D-429).
Delete the veil and the window is the view it always was, drawn in whatever box it is given (D-427) — which is why this is a small change and not a second window: every rule that made the picture right in a landscape box reads the measured box already (`scaleFor`, `verticalHalfFieldDeg`, `groundState`, `drawableDeg`, `fitBox`), and a turned layer is a landscape box.

What the phase must not do is add a second sensor path.
F-57 and F-58 were the window doing the same work twice per render and R68 has just taken that out; a `deviceorientation` listener in the layer would put it back for the sake of one number a frame.
The number travels instead.

### 16.14 Delivery of the v1.4 tasks *(V14-1, D-390)*

The V1-11 rules are unchanged.
Six tasks over five waves, on `main` after Phase 2e.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R67 — F-64: the Moon lore test that fails on `main` | `ui` | sonnet | auto | — |
| 1 | R68 — F-57 and F-58: the window's repeated work per render | `window` | sonnet | auto | — |
| 2 | R69 — Window shapes: the mode in every rule, F-65, and the matrix | `live` (with `lib/layout.ts`, `ui`'s, for `LIVE_BOX_MIN_PX` and `foldRows` — D-381) | fable | owner (a window dragged short, by eye, beside the matrix's numbers) | R67 |
| 3 | R70 — The stripe's span: the chunk, the overview and the re-cut row | `live` | fable | owner (one tap to a pass, and a drag that aims, on a phone) | R69 |
| 4 | R71 — The legend's place: the rail at every width and the list control | `live` (with `skychart/` — `chart`'s — and the prefs slice — `data`'s — D-387) | opus | owner (the list open and closed on a phone; the rail at 1024 and 1280) | R70 |
| 5 | R72 — v1.4 release preparation | `ui` | opus | owner | R71 |

Wave 1 is the two findings tasks, in different lanes, so they run together and neither waits: F-64 first in the order of *reading* as well as of work — a red suite on `main` is what every later task would otherwise inherit (V14-7).
R69, R70 and R71 are one per wave because all three are the `live` lane and each changes what `ChartFrame` measures; the order is the shape rules, then the rows under the box, then the box's own width, so no task is measured against CSS a later one deletes (D-390).
Two crossings are recorded rather than cut into tasks of their own: two constants in `lib/layout.ts` (R69) and the frame's slot with the prefs boolean (R71).

Models follow §16.6 rather than a phase override: R67 and R68 are mechanical with a stated cause and a test that must fail first, so `sonnet`; R69 and R70 are visual work the session can verify itself, against a matrix of numbers and a capture set, so `fable`; R71 crosses three lanes, changes a stored preference and rewrites two layouts, where a plausible wrong answer is expensive, so `opus`, as is the release task.

**Decision blocks** (§16.2): **R67 takes D-391 to D-393, R68 D-394 to D-396, R69 D-397 to D-403, R70 D-404 to D-410, R71 D-411 to D-418, R72 D-419 to D-423.**
Numbers a task does not spend stay unspent.
**D-500** and **D-501** are outside the blocks: both were taken at R75's gate, for rules that belong to no one task.

What each session is told to read (D-284's rule): all six read SPEC §4.20 (FR-FIX-1 and their finding's row) and §12 V14-1..V14-8, and PLAN §2.23, §8.14 and this section.
Then R67: SPEC §4.12 (FR-MOON-4, FR-MOON-5) and the F-64 row.
R68: SPEC §4.18 (FR-WIN-1..3) and PLAN §8.10, §8.12.
R69: SPEC §4.25 (FR-SHP-1..5), §4.8 (FR-DESK-1), §4.10 (FR-LIVE-1, FR-LIVE-7 as amended), §4.16 (FR-COMP-5) and §3.2 US-25; PLAN §8.14, §9.1.
R70: SPEC §4.26 (FR-SPAN-1..7), §4.10 (FR-LIVE-4), §4.19 (FR-TRAJ-4, FR-TRAJ-5 as amended), §4.16 (FR-COMP-4) and §3.2 US-22, US-24.
R71: SPEC §4.27 (FR-LEG-6..9), §4.17 (FR-LEG-1..5), §4.10 (FR-LIVE-7 as amended), §4.16 (FR-COMP-5), §4.18 (FR-WIN-5, for the slice the preference joins) and §3.2 US-23; PLAN §8.9, §8.13.
R72: SPEC §9 Phase 2f, §4.16 (FR-COMP-6), `docs/RELEASE.md` and PLAN §11.

### 16.15 Delivery of the v1.4.1 task *(V14-9..V14-11, D-430)*

The V1-11 rules are unchanged.
One task, one wave, on `main` after R71.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 6 | R73 — The screen does not wait: both orientations, the turn and the advice | `window` (with `components/screen/` — the layer's transform and the context, D-426, D-429) | opus | owner (a phone with rotation locked and unlocked: sideways, upright and flat) | R71 |

R72 moves to wave 7 and is re-run rather than merged as it stands: its version bump, its budgets and its capture set are the release's, and all three must be taken on the code that ships (V14-11).
Nothing in R72's brief changes except the build it runs against and FR-FSC-7's two capture changes, which R73 makes.

`opus`, by §16.6: the change is a geometry whose sign is not guessable from the code — a quarter turn composed into a projection, with a plausible wrong answer that looks right in a unit test and is upside down in the hand — it rewrites copy in two languages, and its acceptance is the owner's on a device (V11-9).
One crossing is recorded rather than cut into a task of its own: the layer and the context in `components/screen/`, which is the `window` lane reaching one directory out, as R63 did for the frame (D-333).

What the session is told to read (D-284's rule): SPEC §4.23 (FR-FSC-1..4 as rewritten, FR-FSC-7, FR-FSC-9, FR-FSC-10, FR-FSC-11), §4.18 (FR-WIN-1..5), §4.22 (FR-FOL-2, FR-FOL-4, FR-FOL-5), §3.2 US-21 (AC3, AC10, AC12, AC15) and §12 V13-2, V14-9..V14-11; PLAN §2.24, §8.10, §8.13, §8.15, §9.1, D-188, D-278, D-285, D-323 (what it supersedes), D-333, D-351.
Not the three documents whole.
