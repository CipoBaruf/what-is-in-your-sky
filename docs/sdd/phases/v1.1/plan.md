# v1.1 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.18 v1.1 decisions (2026-09-05)

These plan SPEC v1.1 (V11-1..V11-13).
D-180..D-182 are the unspent tail of R36's reserved block (D-178..D-182) and stay unused; v1.1 starts at D-183.

- **D-183 — The flag is a Vite `define`d constant, and the lore is a lazy import behind it.**
  `lib/flags.ts` exports `MOON_LORE: boolean` from `import.meta.env.VITE_MOON_LORE === 'on'`; `vite.config.ts` declares the variable in `envPrefix` and the build prints it.
  `App.tsx` renders `<MoonLore>` through `React.lazy` inside `if (MOON_LORE)`, so with the flag off Rollup drops the chunk and `data/moon/lore.json` with it (FR-FLAG-1); `tests/build/flags.test.ts` builds with the flag off and asserts no chunk contains a lore key, and the existing `MoonLore.test.tsx` runs with `VITE_MOON_LORE=on` set in `vitest.config.ts` (FR-FLAG-2).
  No other module reads `import.meta.env`; an ESLint `no-restricted-syntax` rule pins that.
- **D-184 — `#settings` is a screen in the hash router, not a state; the compact header is a variant of one `Header` component.**
  `screens/Settings.tsx` composes the existing `LocationInput`, `PlacePicker`, `CoordsInput`, `UseMyLocation`, the favourites list, `LanguageToggle` and `ThemeToggle` unchanged; nothing about how they write the store moves.
  The route joins `passSelection.ts`'s parser as a third form beside `#pass` and `#live` (D-13), and `Esc` closes it through the D-73 listener with the same guard as the guide.
  `Header.tsx` renders the wide row (title, `[ Live sky ]`, prefs at the right on one grid row) or the compact row (title, `[ live ]`, `[ settings ]`) from `useLayoutMode`; the compact home's location summary is `LocationSummary.tsx`, one line from the observer and the accuracy (FR-COMP-1..3).
  The wide layout never links to `#settings` but renders it if navigated to (FR-COMP-2).
- **D-185 — True north is `geomagnetism` 0.2.0, whole, evaluated once per observer in `lib/declination.ts`.**
  Measured 2026-09-05 with esbuild: the whole package bundles to 6.2 KB gzipped (WMM2015–2025 coefficients included), 4.3 KB importing `lib/model.js` with `data/wmm-2025.json` alone.
  The whole package is used: 2 KB is not worth a deep import into an unexported path that a patch release can move.
  It is CommonJS with `require`d JSON, which Vite pre-bundles; the boundary rule is `lib/declination.ts` only (Apache-2.0, §11.1).
  `declinationDeg(observer, date)` returns the WMM value; `compassHeading.ts` adds it to the magnetic heading and the strip prints "true north, declination +1.1°" (Neuquén, 2026-09-05: +1.12°).
  The value is computed when the observer changes, on the main thread, and cached on the live slice; the worker is untouched (FR-WIN-3, F-41).
- **D-186 — Legend rows are derived in one pure module from `SkyChartProps`, and every view draws the key instead of the text.**
  `lib/legend.ts`: `legendRows(props): LegendRow[]` — `{ key, passId, name, colorToken, riseMs, peakMs, endMs, state }` with `state` from the FR-TRAJ-1 arc state or the FR-LIVE-6 reason; the explained pass first on the detail, the pass nearest the zenith first on the live page (FR-LEG-4).
  `SkyChartProps` gains `legendKeys: Record<passId, string>` so the three views draw the same letter at the peak (FR-LEG-1); the dome's label hotspots and the polar's `<text>` labels for names and times are removed, the compass and ring labels stay.
  `Legend.tsx` (in `skychart/`, inside the boundary so the chart's palette is the swatch's) renders the list as buttons; `ChartFrame` places it under the chart on compact and in a 24-cell column at the right on wide (FR-LEG-2).
  On the pass detail `PassNumbers.tsx` becomes the legend's first block (FR-LEG-3): it moves under the chart and takes the key and swatch; no second table.
- **D-187 — The chart box is sized by `ChartFrame`, the drawing by the D-177 fit rule.**
  `ChartFrame` owns the box: on compact it breaks out of the page padding with negative margins and sets `aspect-ratio: 1 / 1` on the detail; on the live page in portrait its height is `100dvh` minus the measured header, strip, stripe and control rows (a `ResizeObserver` on those, not arithmetic in CSS), floored at the width (FR-COMP-5).
  Inside, `camera.ts` takes `zoom = min(width / 2.4, height / 1.6)` (D-177's proposal, now adopted) so the drawing's extent with labels is ≥ 90 % of the shorter side; the raster grid keeps D-65's rule.
  Every dome capture changes; the raster snapshot is re-baked once by the chart findings task and the D-172 rate is re-measured in the same task.
- **D-188 — The sky window is a third registered view with its own pure projection and an orientation hook that extends compass follow.**
  `skychart/window/`: `projection.ts` (pure: a device rotation as a quaternion from `alpha`/`beta`/`gamma` plus the screen angle, azimuth/altitude → unit vector → view coordinates under the projection the spike picks, `WINDOW_FOV` clipping); `useDeviceOrientation.ts` (the D-175 permission and event path, now three angles, smoothed by `WINDOW_SMOOTHING`, at most one update per frame); `SkyWindow.tsx` (SVG; arcs from `Pass.track` clipped to the field, markers, keys, the horizon and altitude lines, Sun and Moon).
  It registers in `SKY_CHART_VIEWS` (D-55) with an `available()` predicate — D-175's presence test — so the toggle offers it only on touch devices (FR-WIN-4).
  The saved `chartView` (D-57) gains `'window'`; when it is saved and orientation needs a gesture, `SkyChart` renders `[ point at the sky ]` in the window's place (FR-WIN-5).
  The window ignores `facingAzDeg` and `onDrag`.
  In `Live.tsx`, choosing the window dispatches `now()` and sets `windowMode`, which hides the stripe and playback (FR-WIN-6).
- **D-189 — Arc state is computed by a pure module and carried per pass in the props; the pass detail passes `'full'`.**
  `lib/arcReveal.ts`: `arcState(pass, t): 'hidden' | 'ahead' | 'live' | 'linger' | 'full'` with `ARC_LOOKAHEAD_MS` and `ARC_LINGER_MS` in `physics/constants.ts` beside the other thresholds (FR-TRAJ-2), and `cutTrack(pass, t)` returning the samples up to `t` with the interpolated position appended.
  `SkyChartProps.passes[i].arc` is that state; the dome's `domeGeometry`, the polar and the window draw `'live'` as the cut track solid, `'ahead'` dotted faint, `'linger'` faint, `'hidden'` not at all and `'full'` as today (FR-TRAJ-1, FR-TRAJ-3).
  `Live.tsx` sets it from `t`; `PassDetail` sets `'full'`.
  The legend's `state` is the same value (D-186), so the two cannot disagree.
- **D-190 — The stripe is three SVG rows with memoised geometry; the readout is a heading above it; stepping is added by the spike's choice.**
  `TimeStripe.tsx` renders labels, band and segments as three `<g>` rows in body-cell units, the date at each midnight from `Intl` in the observer's zone; `hourTicks`, `nightBands` and `passSegments` are `useMemo`d on `(span, passes, zone)` (F-38); pointer-down no longer calls `preventDefault`, and the stripe is `tabIndex=0` and focuses itself on pointer-down (F-39).
  `TimeReadout.tsx` prints `t` at the heading size with the weekday when not today (FR-TRAJ-4).
  `usePlayback` clamps the held instant on resume (F-36).
  The stepping control is a second component added after the spike names it (FR-TRAJ-5); its contract is one function, `stepTo(ms)`, on the playback hook.
- **D-191 — The compact mockups are pages on the app's own stylesheets, like the desktop one.**
  `docs/mockups/compact-390.html` follows `desktop-1280.html` (D-119's precedent): it links `tokens.css` and `global.css`, has one `<style>` block for the compact rules, and shows home, settings and the pass detail with its legend in both themes; `npm run mockup:compact` regenerates the PNGs through `scripts/mockup-capture.ts`.
  It is the FR-COMP-6 artefact and the `Precondition:` of the settings, header and detail-legend tasks, checked the way R23 checked for the desktop one.
- **D-192 — Mid widths: one constant, one CSS rule, one profile.**
  `lib/layout.ts` gains `WIDE_SPLIT_MIN_CELLS = 124` (40 left + 44 list + 40 guide) and the breakpoint test pins its pixel twin; below it `App.module.css` gives an open guide the whole right column and `GuidePanel` shows `[ list ]`, which sets `data-guide="list"` and swaps back (FR-DESK-3).
  `playwright.config.ts` gains a `desktop-1024` project used by `wide.spec.ts` and the capture set (FR-DESK-5, F-6).
- **D-193 — The control-row fit test measures strings, not pixels.**
  `tests/styles/controlRows.test.ts` renders each control row named in FR-COMP-4 with RTL at compact, joins its visible text with the cell counts of its brackets and gaps, and asserts ≤ 36 for both locales.
  It cannot see CSS wrapping, but every control here is monospace text whose width is its length, which is the FR-X-6 invariant the test relies on; a capture at 390 px in the task confirms it once.
- **D-194 — Findings close in their lane's task, each by its number, with the test first.**
  `F-<n>` is the commit subject's prefix and the acceptance line; a finding the session verifies as already fixed on `main` is recorded in the task's summary with the commit that fixed it and not touched (FR-FIX-1).
  The three `data` findings (F-11..F-13) are one small `data` task; F-41 (declination) and F-6 (mid widths) are closed by the true-north and mid-widths work, not by the findings tasks.
  F-46..F-50 are the CI task's.
- **D-195 — CI is two workflows: a budgeted PR job and a main-branch capture job.**
  `ci.yml` keeps its stages, sets `timeout-minutes: 10` (FR-CI-1's budget, by name in a comment), and adds a `time` step that wraps each stage with `date +%s` and writes the table to `$GITHUB_STEP_SUMMARY`.
  `v1-captures.spec.ts` gains `test.skip(process.env['CAPTURES'] !== '1')` like `dome-perf`, and `captures.yml` (on `push` to `main` and `workflow_dispatch`) runs `CAPTURES=1 npx playwright test v1-captures`, uploads `docs/screenshots/v1-*.png` as an artefact and fails on a missing file; it commits nothing, and `tests/docs/captures.test.ts` keeps checking the committed set (FR-CI-2).
  Playwright on CI runs `workers: '100%'` with `reuseExistingServer` off, and `e2e/liveHelpers.ts` gains `seedStoredRun()` so page specs load a stored run instead of waiting on the 72 h search; a `--reporter=list` timing line over 60 s is a finding by FR-CI-3.
- **D-196 — Lanes for the phase: `window` is new, `chart` gains the legend, `ui` keeps everything else.** §16.1's table is amended.
  `window` owns `skychart/window/**`, `spike/window/**` and `docs/window/**`; `chart` keeps `skychart/**` minus `window/` and gains `lib/{legend,arcReveal}.ts`; `live` gains `lib/declination.ts` and `components/live/**` as before; `data` is unchanged; `physics` has no task this phase.
  A sixth lane, `docs` (`docs/mockups/**`, `scripts/mockup-capture.ts`), exists for the one task that touches no source, the compact mockups (D-191), so it never holds the `ui` slot.
  The catalogs stay in `ui` with the D-132 positional rule: a `chart` or `live` task appends keys only to its own section of `en.ts` / `es.ts`.
- **D-197 — Model policy is per task kind across four models, with a limit fallback.** §16.6 is rewritten (V11-9, the owner's ask on 2026-09-05 for a per-task check).
  Fable takes the visual and interactive work whose acceptance the session can verify itself (the window, the legend and fit rule in the views, the trajectory drawing, the stripe); Opus takes semantics, copy in two languages and anything a plausible wrong answer makes expensive (settings and routing, the findings in `ui` and `live`, true north, CI); Sonnet takes tasks that are fully specified by a test or a table and mechanical to execute (the `data` and `chart` findings, the flag, the catalog split, the mid-width rule, the mockup capture script); Haiku takes nothing that ships code.
  Reviews: Opus where the review is the gate (`Gate: auto`), Sonnet where the owner reads the PR anyway (`Gate: owner`).
  The driver gains `--fallback`: a session that ends on a model limit is retried once on the next model of `fable → opus → sonnet`, with the worktree kept, so a limit costs a retry and not a wave.
- **D-198 — Sessions read a brief, not the three documents.**
  The largest fixed cost of a task session is the ~40 k tokens of SPEC, PLAN and TASKS read at the start, twice (implementation and review).
  The driver writes `sdd-run/<id>.brief.md` before the session: the task's TASKS.md entry in full; every SPEC requirement and user story it names (extracted by ID); every PLAN decision it cites and the lane's row of §16.1; the D-89 commit rule; the allowlist.
  `sdd-implement` under `SDD_HEADLESS` reads the brief and opens the three documents only by `rg -n` for an ID it does not have.
  The review session gets the same brief and the diff.
  Measured target: under 12 k tokens of context before the first edit.
- **D-199 — Delivery time: smaller tasks, a split catalog, narrow test runs, and the wave as the unit of review.**
  (1) A v1.1 task is sized to 25 turns of implementation or less where the cut allows; the findings tasks are the exception and are capped at ten findings each.
  (2) The message catalogs are split per lane before the feature wave (`i18n/en/{ui,chart,live,window}.ts` merged by `en.ts`), so the one file every lane touched in v1 no longer conflicts (a Sonnet task, first wave).
  (3) A session runs `npx vitest run <its directories>` and its own e2e spec while iterating and the full `npm test` once before its last commit; CI runs everything.
  (4) Captures are shot only by `Gate: owner` tasks and only for the screens the task changed.
  (5) The wave cap stays three (D-132, the machine's memory); the lanes are now five, so a wave is usually full.
- **D-232 — The legend goes beside the drawing only where the frame has the room, and a container query asks.**
  FR-LEG-2 read literally — beside on wide — put a 24-cell column next to the dome inside the 40-cell guide column of the three-column layout and left the drawing 14 cells (R45's first 1280 px capture).
  `ChartFrame` wraps its grid in a shell with `container-type: inline-size` (a container query answers for descendants, never for the container itself), and `@container (min-width: 62ch)` — 36 cells for the drawing, the compact chart's own width, a 2-cell gap and the 24-cell column; font-relative units in a container condition resolve against the container, so `62ch` is 62 cells — puts the legend at the right on wide; a narrower wide frame keeps it under, as compact does.
  Compact never goes beside, even where a tablet frame would have the room, so FR-LEG-2's text holds there.
  On this branch the live page at 1280 px is the wide frame with the room; the detail's goes beside at D-192's 1024 px mid width once R43's mid-width rule is in.
  Proposed SPEC wording, for the owner: FR-LEG-2 "at the right of the chart on wide (24 cells minimum) where the box leaves the drawing at least 36 cells, under it otherwise".
- **D-233 — The portrait floor is the frame's, behind a page switch the live page holds off until R48.**
  `ChartFrame`'s `ResizeObserver` writes the frame's measured width to `--chart-floor`; the drawing's `min-height` is `calc(var(--chart-floor) * var(--chart-floor-on, 1))`, in portrait only (FR-COMP-5 says portrait; landscape gives the dome the whole height beside the strip, FR-LIVE-7, where a floor at the pane's width would be taller than the page).
  The live page's grid is one viewport high with a bounded dome row (D-119's lesson), so with the rows it has today the floor spilled the raster over the stripe and the controls — the Play button under a `<pre>`, every live e2e click intercepted.
  `Live.module.css` sets `--chart-floor-on: 0` with a note; R48, which re-cuts the portrait rows per FR-LIVE-7 as amended and has "the legend on the page" in its scope, removes the line.
  Meanwhile a legend under a live drawing is bounded to four rows and scrolls inside, and beside one it is the column's height and scrolls too, so the legend never costs the page its budget or overlaps the rows under the box.
- **D-234 — The D-172 rate after the fit rule: 45.3/s at 390 px, 34.0/s at 1280 px.**
  Measured by the D-62 method on 2026-09-06 (`DOME_PERF=1 npx playwright test live-perf`): 45.3/s at 390 px (60 columns, longest frame 45 ms) and 34.0/s at 1280 px (120 columns, longest frame 50 ms), against 57.6 and 46.9 before — the same grids, a larger drawing in them (the D-177 fit rule lights more cells) and the keys.
  Both above FR-LIVE-5's 30/s, so no FR-DOME-8 fallback was engaged; the 1280 px margin is now four per second and the next chart task re-measures.
- **D-244 — The compact live page's top row is the return control and the place; the language and theme switches are wide-only.**
  R32 put `LanguageToggle` and `ThemeToggle` on the live page's top row because the page has no header.
  On a 36-cell phone that row was three lines of 48 px tap targets — `[ ← Back ]`, the place, and the two switches wrapping under — and FR-LIVE-7 as amended asks for one.
  FR-COMP-2 puts both switches on the settings page on a phone (R52), so the compact live page drops them: its top row is `[ ← Back ]` and the place, which ellipsises, and `data-compact` on the page is what the stylesheet and the tests read.
  Wide keeps R32's row.
  The e2e captures that used to click the theme on the live page set it on the home page's header and come back (`reenterLiveWithTheme`), which is what a reader on a phone does today and what the settings page will replace.
- **D-245 — The two compact control rows, counted in characters, with nothing boxed.**
  FR-COMP-4 gives each row 36 cells.
  The playback row is `[ ▶ ] [ Now ] 1× [60×] 600× 3600×`: play and pause are glyphs (`▶`, `‖`) under their spoken names, and the speeds bracket the chosen one instead of carrying `[x]` marks — 19 cells for the four where the toggle form was 33 — so the row is 34 cells in both languages.
  The actions row is `[ ] Hidden [ ] Follow [ Share ]` (31 cells; Spanish `[ ] Ocultos [ ] Seguir [ Compartir ]`, 36), the hidden-objects toggle having moved here from the playback row.
  The unit test counts the catalogs' characters with one cell between controls; for that count to be the truth, every control on the two compact rows is text — the share action loses the global button's box and its cell of padding each side, and its confirmation row keeps no flex gap before an empty confirmation: those were the 37th and 38th cells that wrapped the Spanish row and cost the dome 48 px.
  Labels differ between the shells (`Share` for `Share this sky`, under the full accessible name); meaning does not.
- **D-246 — The portrait rows at 390 × 844: a 24 px top row, the drawing track floored, the legend what is left, the strip in two lines.**
  The budget is 844 px less 12 of page padding, and with R48's rows it did not close: top row 48, view control 48, drawing ≥ 351 (D-233's floor, the frame's width inside the page padding), three half-row gaps, the dome readout 24, the legend up to 96, the strip at five lines 133, the readout 24, the stripe 72, three 48 px control rows and the page's quarter-row gaps came to about 970, and the floored drawing spilled over the readout, the legend and the strip's first line (R45's first capture with the switch on; this task's first capture with it off).
  Four cuts close it.
  (1) The top row is one text row: the return control keeps its 48 px hit box by the inline-control rule (vertical padding, the matching negative margin), as links in prose do.
  (2) The frame's gaps are a quarter row, and its drawing track is `minmax(floor, 1fr)` in portrait compact rather than `minmax(0, 1fr)` with the floor on the item: a track whose minimum is 0 sizes to what the other rows leave and the item overflows it, whereas a floored track makes the grid hand the drawing its width first and the legend — `minmax(0, auto)`, scrolling inside, down to nothing — what remains; with one legend row the drawing is 351 px and the legend 24.
  (3) The strip on compact is two lines of at most 36 cells, `09:48:24 GMT-3  bright twilight` over `Clouds 12 %  Visible 3  Moon 72 %`: the first line's labels are spoken (`sr-only`) and not shown, the clouds and the Moon are their percentages (`n/a` / `s/d` without a forecast) and the count its number, because the wide words ("Clear, 12 % cloud", "waning gibbous, 72 % lit") are 50 cells; the date is the readout's weekday and the stripe's midnight labels.
  The `dl` stays flat — its content model and the definition-list a11y rule allow groups and nothing around them — so the lines are an inline formatting context's, the fields inline two cells apart with a newline after the field that ends a line; each line is then its own, and a wide zone abbreviation on the first (`GMT+12:45`) moves nothing on the second, which a shared grid column would.
  The speed while playing and the heading while following take a line each under the two, so the dome gives up a row while either is on.
  (4) The strip's rule keeps a quarter row of air, not a half.
  The floor stays D-233's — the frame's measured width, 351 px, not the full-bleed box's 390 — since the rows cannot give the box 39 more pixels without losing the legend altogether; FR-COMP-5's "never shorter than it is wide" is read as the frame's width here, and the summary says so.
  Landscape (844 × 390) gets the same strip, and its side column now fits the 348 px under the top row in both languages where R34's scrolled.
- **D-247 — The D-172 rate after the trajectories: 59.1/s at 390 px and at 1280 px; the arc states memoised on a key.**
  Measured by the D-62 method on 2026-09-06 (`DOME_PERF=1 npx playwright test live-perf`, one worker): 59.1/s at 390 px (60 columns, longest frame 33 ms) and 59.1/s at 1280 px (120 columns, longest frame 38 ms), against D-234's 45.3 and 34.0 — the same grids, and far fewer cells lit: FR-TRAJ-1 draws the arc under way up to `t` and the few within `ARC_LOOKAHEAD` or `ARC_LINGER`, where FR-LIVE-2 drew every arc of the day.
  The states are `arcKey(passes, t)` — the five-word key of one frame, cheap — and `withArcStates(passes, key)` is memoised on the passes and the key, so a frame that changes no state remakes neither the props array nor the chart's geometry nor the legend's rows; the first cut kept the previous array in a ref written during render, which React's lint forbids.
  Window mode's e2e goes with R47: the preference schema (`localPrefs.ts`) rejects a chart view it does not know, so `window` cannot be seeded before the view is registered, and FR-WIN-6 is asserted in `Live.test.tsx` by setting the preference by name.
- **Reserved for the v1.1 tasks, on 2026-09-05 (the D-133 precedent): R37 takes D-200 to D-203, R38 D-204 to D-207, R39 D-208 to D-211, R40 D-212 to D-215, R41 D-216 to D-219, R42 D-220 to D-223, R43 D-224 to D-227, R44 D-228 to D-231, R45 D-232 to D-235, R46 D-236 to D-239, R47 D-240 to D-243, R48 D-244 to D-247, R49 D-248 to D-251, R50 D-252 to D-255, R51 D-256 to D-259, R52 D-260 to D-263, R53 D-264 to D-267.**
  Four per task rather than five: the v1 tasks used two to five each, and a task that needs a fifth records it as a sub-point of its fourth.
  A session numbers only inside its block; unused numbers stay unused.
- **D-204 — The sky window's constants, from the R38 spike on a phone.**
  Stereographic at `WINDOW_FOV = 60°` across the shorter side (OQ-16's start, kept: the bent horizon read as the sky in front and the arc near the zenith kept its shape); `WINDOW_SMOOTHING = 0.6` applied to the rotation's axes and re-orthonormalised, never to the three angles, so the picture is continuous across north and past the zenith; the screen angle applied as `+angle` to the projected plane (level in landscape on the phone); the stripe steps by six buttons — previous rise, −10 min, −1 min, +1 min, +10 min, next rise — since `next rise` met US-22 AC6 in one tap and neither tap-to-jump (a 1.6 px segment) nor slow drag is a countable tap (OQ-18 closed as expected).
  `docs/window/FINDINGS.md` carries the captures and the numbers; R47 and R48 take the constants from there.
- **D-205 — The heading on iOS is alpha calibrated by the compass while upright, drawn at the display rate.**
  Measured on the iPhone (OQ-17): `deviceorientation` only, `absolute` undefined, `webkitCompassHeading` with usable beta and gamma in the same event, `alpha` relative and drifting, the first event's accuracy `−1`.
  Taking the heading from the compass field on every reading reset the picture at the zenith, because that field is the direction of the phone's top along the ground and has none overhead; the event's own alpha is continuous there.
  So the window follows alpha and learns the offset `(360 − heading) − alpha` as a circular running mean while the phone is upright (beta 45–135°) with compass accuracy in `[0, 30°]`; on the phone it settled at 31° from 1145 samples and the sweep over the head stayed continuous.
  Safari delivers 60 readings a second, Chrome on iOS about 10: the window keeps drawing at the display rate, easing toward the latest reading, so FR-WIN-3's ≥ 30/s holds on either.
  D-175's `compassHeading.ts` is unchanged for the dome's follow; R47's hook adds the calibration, the display-rate loop and the `−1` guard.

- **D-240 — The window's permission is asked in the tap that chooses the view, by a module outside React, and a view that cannot stay mounted says why.** iOS grants `DeviceOrientationEvent` only inside a user gesture, and the tap that picks "Window" happens in `SkyChart`'s toggle, before `SkyWindow` exists to ask.
  So `window/orientationAccess.ts` owns the one request: `SkyChartView` gains `choose()`, called inside the toggle's tap before the view mounts, and `available()`, D-175's presence test, so `offeredViews()` lists the window only on a touch screen with the constructor and a saved `'window'` on a desktop is the dome (FR-WIN-4).
  The answer is remembered for the page session (iOS answers a second request from memory anyway): a window mounted after the grant arms at once, a request in flight from the tap is awaited, a refusal is asked again only on the next tap.
  Where no request exists (Android, and the desktop browsers that carry the constructor) listening is not a prompt, so the hook arms on mount; FR-WIN-4's "never on load" is about the prompt.
  `useDeviceOrientation` keeps five states — `idle`, `waiting`, `on`, `relative`, `denied` — and `SkyChart` gets `onUnavailable(reason)` from the view: `denied` shows the one-line note and puts the dome back; `relative` (a reading with no north, FR-LIVE-8's case) does the same and drops the option for the rest of the session, since a phone that gave no heading once will not grow one.
  The hook computes in the animation frame, never in the event: the latest reading is kept, the frame fuses the heading (D-205, corrected by the observer's declination through R44's `useDeclination`), builds the W3C rotation and eases the previous one toward it by `WINDOW_SMOOTHING` on the axes, at most one state update per frame and frames kept coming until `converged` — so the picture draws at the display rate whatever the sensor's (FR-WIN-3).
  The e2e (`sky-window.spec.ts`, `hasTouch`) pins it under the installed clock: thirty readings three degrees apart, one frame each, and at least twenty-eight frames moved the look.
- **D-241 — Before the first reading the window looks at the peak azimuth, 20° up or as high as the peak needs.**
  The placeholder is the picture behind `[ point at the sky ]` and the frame the e2e captures aim from, so it should show the explained pass's key at its peak (FR-LEG-1).
  Twenty degrees up puts the horizon in the lower third of the box and the arc's lower part above it, but the box on the phone is square (D-233's floor) and 60° across (D-204), so the top edge is 30° above the centre and a 61° peak — R45's glare pass, the captures' pass — sat above it.
  `placeholderAltDeg(peakEl, view)` returns `max(20, peakEl − top + 8)`, where `top` is the vertical half-field of the *measured* box (`2·atan(h/2 ÷ scale)`, 30° on the square, 56° on the live page's tall box), so the peak keeps 8° inside the top with its key nine pixels above it; the glare pass asks for 39°.
  Where the horizon and the peak cannot both fit, the peak wins: the horizon comes into view the moment the phone lowers, and the sensor replaces the placeholder within a frame on a working phone.
- **D-242 — The window and the declination are chunks of their own, budgeted at the floor.**
  `SkyWindow.tsx` is the second `React.lazy` in `SkyChart.tsx` and lands as `SkyWindow-*.js`: SVG and arithmetic, no library, 5.3 KB gzipped on the R47 build, budgeted at D-178's 10 KB floor.
  Because the window reaches `useDeclination` too, Vite splits it and the World Magnetic Model out of the live chunk into `useDeclination-*.js` (6.1 KB), shared by both pages; the live chunk falls to 6.3 KB and keeps its 15 KB budget, and the new chunk gets the 10 KB floor so an addition to the model shows up where it lands.
  The chart chunk did not move: the window shares nothing with glyphcss.
  `scripts/bundle-budget.ts` carries both rows.
- **D-224 — The compact title is the manifest's `short_name`, "Your sky".**
  FR-COMP-1 puts the title, `[ live ]` and `[ settings ]` in one row of 36 cells.
  The two controls are 21 cells with the space between them, and the full title is 31 with `h1`'s `> ` prefix, so the row cannot hold both: compact needs a shorter title.
  It takes the one the app already has — `short_name` in `public/manifest.webmanifest`, which is what a phone launcher prints under the icon, and which `tests/deploy/manifest.test.ts` already holds to 12 characters.
  `> Your sky [ live ] [ settings ]` is 32 cells.
  The wide header keeps the full title and the tagline (FR-DESK-2).
  The string is a catalog message like every other, so Spanish is free to be shorter still; 36 cells is the test's bar in both locales (R52).
- **D-225 — One compact header on every screen; the current page is dim and inert, and `#settings` is left by its own `[ ← Back ]`.**
  FR-COMP-1 describes one header, so R52 renders one: the same row on home, on the detail and on `#settings`, with no per-screen variant to keep in step.
  On the page it points at, the control stays in place but is rendered dim and not as a link — it is where the reader already is, and a link to here is a control that does nothing.
  Getting back is FR-COMP-2's `[ ← Back ]` at the top of the settings page, beside `Esc` and the browser's back button; the header's `[ settings ]` is not overloaded into a toggle.
- **D-226 — The mockups' capture script takes the mockup's name, and the compact frames are shot one screen at a time.**
  `scripts/mockup-capture.ts <name>` (no name: both) keeps one browser launch and one themed-page helper for `desktop-1280.html` and `compact-390.html`.
  The desktop page stays a full-page shot per theme — its frames are two states of one layout and are read side by side.
  The compact page is three screens, and a phone screen is read on its own, so each frame is shot as an element at a 390 px viewport: `compact-390-{home,settings,detail}-{dark,night}.png`, the names R52 and R51 carry as their `Precondition:`.
  The viewport matters as much as the crop — the app's own 960 px breakpoint has to *not* match while these are taken, or `global.css` would lay the frames out wide.
- **D-268 — The wide live page: the fit rule gets a ceiling, the rows around the dome fold, and the legend scrolls.**
  (v1.1.1, V11-14; the number follows the D-227..D-267 reservation.) The fit rule in `dome/camera.ts` (D-187) is bounded above as it is below: the drawing's extent, labels included, is at most the shorter side of its box, and the test that pins the 90 % floor pins the 100 % ceiling too — at 1920 × 1080 the raster was 722 px in a 719 px box, which is the north and south rows clipped (F-51).
  `screens/Live.module.css` gets a wide branch beside D-173's landscape one, a media query at FR-DESK-1's 100 cells, with the areas `top`, `dome`, `bottom`, `strip`: the top row is the view control, the facing readout and the hint on one line; the bottom row is the playback controls at the left, the stripe block with its readout filling the rest and the share action at the right; the strip is one line.
  The dome row is `minmax(0, 1fr)` as now, so the two rows given back go to the box (F-52).
  `skychart/Legend.module.css` makes the column beside the chart scroll within the box's height (`overflow-y: auto`, `min-height: 0` up the grid), and `Legend.tsx` scrolls the activated row into view, so every pass the chart draws is reachable by pointer and keyboard (F-53).
  One `live`-lane task carries the three, since that lane is idle while the `ui` chain runs, and names the legend files as its touch outside the lane (FR-FIX-1).
  Tests: the fit test's upper bound at 1280 × 800 and 1920 × 1080; an e2e at 1920 × 1080 that counts one row above the dome and two under it and reads the box's height; a legend test that reaches the last pass by keyboard.
- **D-269 — The live page's view toggle lives in the chart frame's controls slot, so the row above the drawing is the frame's one row.**
  (R54, F-52.) D-268 put "the view control, the facing readout and the hint on one line" in `Live.module.css`, but none of the three is the page's: the toggle is `SkyChart`'s figure header, the readout is the frame's `status` slot under the drawing, and the hint is not shown on this page (R48).
  Two nested grids cannot share a row, so the toggle moves rather than the rule: `SkyChartProps.controls` carries the toggle and its note, `SkyChart` renders them into that prop on `fill` and in the figure otherwise, and each view puts them first in `ChartFrame`'s controls before its own control (the polar orientation toggle, the window hint).
  `ChartFrame.module.css` then lays `controls` and `status` side by side on one baseline for `.fill[data-compact='false']`, with the 24-cell legend column kept where D-232 puts it, and `SkyChart.module.css`'s `.fill` figure is one row.
  Compact keeps the stack — the toggle is still 48 px above the drawing, one gap closer — which is what R48's portrait rows count on.
  Touched outside the `live` lane for it: `SkyChart.tsx`, `SkyChart.types.ts`, `SkyChart.module.css`, `ChartFrame.module.css`, `dome/SkyDome.tsx`, `polar/SkyPolar.tsx`, `window/SkyWindow.tsx` — the `chart` and `window` lanes, none of them touched by the `ui` chain running beside this task.
- **D-270 — The stripe joins the bottom row from 164 cells; the stepping row is drawn only with touch.**
  (R54, F-52.) One row for the playback controls, the stripe and the share action needs the width: the playback row is 50 cells, the hidden-objects toggle 18, the clock readout 5, the boxed share action 22 and the gaps 9 — 104 cells before the stripe — and FR-TRAJ-4's stripe wants 60 for twelve two-character hour labels with their space.
  So `STRIPE_ROW_MIN_CELLS = 164`, a `@container (min-width: 164ch)` rule on the page (the side column's size container; a container never answers for itself), pinned by `Live.test.tsx`: 1920 px is 200 cells and folds to two rows under the dome (the box is 833 px of 1080, 77 %); 1280 and 1440 are 133 and 150 and keep the stripe on a row of its own, the readout at its left — three rows where R48 had five, and the box 553 px of 800 at 1280 against 325 before.
  The hidden-objects toggle joins the playback row on wide (`Live.tsx`, `!compact`) and stays on the actions row on compact, where FR-COMP-4's 36 cells set the rows.
  FR-TRAJ-5's stepping row is for fingers: `pageHasTouch()` (`components/live/touch.ts`, `navigator.maxTouchPoints > 0`, which Playwright's `hasTouch` sets) gates it, so a desktop has the arrow keys and no third stripe row.
  The DOM order stays the compact one — the wide rows are grid areas — so the reading order is the same on every width.
- **D-271 — F-53 in two halves: the pointer's was already fixed on `main` by R45's D-232 rule; the keyboard's was real, and focus now highlights a row without promoting it.**
  (R54.) The finding measured the legend *list* (`chart-legend`, 6492 px on the pre-R48 build with every arc drawn) and read it as the column: the *slot* (`chart-legend-slot`) has had `overflow-y: auto` inside the box's height since R45 (`499242a`, `.fill[data-compact='false'][data-legend='true'] .legend`), and at 1280 × 800 it is 361 px tall over a 576 px list and scrolls, so every row is one wheel away — recorded as already fixed per FR-FIX-1.
  The keyboard half stood: a focused row fired the same `onActivate` a click does, which pins the row *and promotes it to the top* (FR-LEG-4, `promoteRow`), so Tab from row B reached A again, then B, then A — the rows past the fold could not be reached by key at all, a loop the test found.
  FR-LEG-4 asks focus to *highlight* the row's arc and dim the others, not to reorder the list under the reader's hands: `Legend` now has `onFocusRow` beside `onActivate`, and `SkyChart` keeps two memories where it kept one — `pinned`, the highlight, which a click, a tap or focus moves, and `promoted`, the row at the top, which only a click or a tap moves — so the list holds still while the keyboard walks it, the highlight travels with the focus, and the browser's focus scrolling keeps the row in view.
  Which also settles the #70 review's second finding (focus and click both activating): they do different things now.
  `r54-legend.spec.ts` (on the four-pass instant, `parisLive.ts`) checks both halves at 1280 × 720; the task's three captures sit in `r54-captures.spec.ts` behind `CAPTURES=1`, off the pull-request path, since #75's run was already 9 min 37 s of FR-CI-1's 10: the column scrolls to its end and the last row is inside the slot's box, where a click pins it; and n − 1 tabs from the first row reach every pass in order, the last inside the slot's box.
  Touched: `skychart/Legend.tsx`, `skychart/SkyChart.tsx` (the `chart` lane, named by the task).

- **D-252 — A breakpoint literal is derived from the widest advance in the font stack, not from an assumed 0.6 em.**
  (R50, F-10.) `--cell` is `1ch`, one character advance of whichever family of `--font-mono` the device actually has, and a media query cannot read it — font-relative units in a media query resolve against the browser's initial font, not the app's — so each threshold the requirements state in cells is carried into the CSS as a pixel literal.
  The old derivation multiplied cells by 0.6 em; that is right for SF Mono and Liberation Mono, 0.602 for Menlo and DejaVu Sans Mono, and 0.55 for Consolas, so 960 px was 100 cells on a Mac and 109 on Windows (F-10).
  One literal cannot be one cell count everywhere; what it can be is never *fewer* cells than the threshold names.
  `lib/layout.ts` records the advance of every family in the stack from that font's own metrics and `thresholdPx(cells)` rounds `cells × CELL_ADVANCE_EM_MAX × BASE_FONT_PX` up, so a layout never engages before the cells it needs exist — FR-DESK-1's wide breakpoint is 964 px now, up from D-71's 960.
  Being wrong the other way, Consolas reaching a threshold a few cells late, costs a reader nothing but the wider layout arriving slightly later.
  `tests/styles/breakpoint.test.ts` holds every `min-width` in `src/ui` to one of the two literals, holds each literal to at least its cells on every font and to no more than one cell over on the widest, and holds the advance table itself to the stack in `tokens.css`, since a family added there without its advance would make the derivation a guess again.
  `tests/e2e/wide.spec.ts` measures a `100ch` probe in the real browser and asks that what it resolved is one of the advances in the table.

- **D-253 — Mid widths: one constant, one CSS rule, one profile; the constant's pixel twin counts the gutters and one padding.**
  (R50, F-6, FR-DESK-3 as amended, FR-DESK-5.) `WIDE_SPLIT_MIN_CELLS = 124` is the three columns — 40 left + 44 list + 40 guide — as D-192 asked.
  Its pixel twin counts what the screen also has to find for them to be three columns: the two 3-cell gutters, and one of the shell's two 2-cell side paddings, which makes it 1272 px.
  One padding and not both because both floors are real minima, so just above the threshold the pair of tracks is a padding wider than the column that holds them and leans into the right margin — costing the guide's border a few pixels of air and nothing else — while counting both would put the split at 1291 px and take it away from 1280, the width of the approved desktop mockup (FR-DESK-5), where the two columns have been since R23.
  What the lean may never do is make the page scroll sideways, and `WIDE_SPLIT_MIN_CELLS` + the gutters + one padding is exactly the width at which it does not: `breakpoint.test.ts` pins the padding to `global.css` and `wide.spec.ts` sets the viewport to the literal itself and asks for the guide's 40 cells, the list's 44 and no horizontal scrollbar.
  Below the literal `App.module.css` gives an open guide the whole right column and `GuidePanel` shows `[ list ]`, which sets `data-guide="list"` and swaps back without touching the selection — the pass stays open and stays in the hash (D-13), which is what makes `[ list ]` different from closing — and focus follows the swap to the selected card, where the compact sheet's `← Back` also leaves the reader.
  `playwright.config.ts` gains a `desktop-1024` project; `wide.spec.ts` reads its own viewport and asserts the layout that width is meant to have, so the pair is one file and not two, and the D-179 capture set gains the 1024 × 768 profile for the home and the guide.

- **D-256 — The pass detail's numeric table reaches the legend as a block the caller renders and the chart places, called with the row it stands for.**
  (R51, FR-LEG-3, US-23 AC3.) The table is `PassNumbers`, which belongs to the guide and knows the pass; the key and the swatch belong to `lib/legend.ts`, which derives them from the same props the drawing draws (D-186).
  Neither side can build the other's half: `PassDetail` cannot work out that the explained pass is `A` in the pass colour without duplicating `legendRows`, and `SkyChart` cannot import `PassNumbers` without a cycle, since the table now takes its swatch from `skychart/`.
  So `SkyChartProps.legendLead` is a function of the row — `SkyChart` finds the row of the *caller's* `highlightedPassId`, calls it, and hands `Legend` the result as the block that replaces that row.
  Pinning a dim row still moves that row to the top of the list (FR-LEG-4) but never moves the table, which is what the guide is about.
  `Legend` reads one prop for two behaviours, both of them the pass detail's reading: the lead at the head of the list, and the rows under it timed at rise and end only, since the explained pass's peak is a line of the table.
  The swatch itself is now `LegendSwatch`, one component owning the `data-color` → `--chart-*` map (FR-LEG-5, FR-THEME-3) for the list and the table alike.

- **D-257 — A boundary the satellite crosses in Earth's shadow renames its row in the table; it does not add a fourth.**
  (R51, FR-LEG-3.) FR-LEG-3 asks the detail's table to add "the shadow-entry row where one applies", but a `Pass` has three points — start, peak, end — and the drawing does not add a marker for the shadow either: it *swaps* the rise or end marker for the half-filled shadow one (`SkyPolar`, `startReason`/`endReason`).
  A fourth table row would therefore carry the end row's time, azimuth, elevation and range again under a second name, and the legend would list one more thing than the drawing draws, which is the one thing FR-LEG-2 forbids.
  So the row that is the shadow boundary is named for it — "Enters shadow" / "Leaves shadow", `data-point="shadow"` — and the reasons in words stay in the `<dl>` under the table where they have been since R6.
  The owner chose this reading over the fourth row in the R51 session.

- **D-258 — A share link is authoritative once: it is consumed and cleared from the hash as soon as the observer is not the one it named.**
  (R51, F-17, and F-18, F-19 beside it.) The link's observer wins over the saved one on arrival, before the first render (D-135) — but it kept winning for as long as it sat in the hash, so a recipient who typed their own coordinates had the guide torn down by the recompute and put straight back from the link, on a pass belonging to somebody else's sky, with no way out but editing the URL (F-17).
  `App` compares the store's observer with `observerFromLink` on the link's coordinates alone, as R39's `#live` effect already does — the label and the zone arrive later from the forecast and do not identify a place — and calls the selection's `close()`, which replaces the hash in place: the guide closes and the reader is on their own list.
  F-18 is the same screen's other half: the FR-SHARE-3 substitute pass now waits for `passes.status === 'done'`, because the cards stream in and "the nearest pass of that object" is provisional until then, so the pass used to open a second before the sentence explaining why it is not the one the link named; the link's own pass (`same`, inside the D-33 tolerance) still opens as soon as it is computed.
  F-19 is the same class of thing one level down: `LATITUDE_RANGE`, `LONGITUDE_RANGE` and `ALTITUDE_RANGE` move to `lib/place.ts`, which both `CoordsInput` and `shareLinks.ts` may import (`src/state` may not reach `src/ui`, PLAN §3), so the form and the parser cannot come to disagree about what a valid observer is.
  The two copies held the same numbers, so nothing was wrong yet: the test that fails on the old code is the identity of the ranges, and the agreement across the boundary is what it buys.

- **D-259 — The legend goes beside the drawing only while it is a list; the pass detail's table stays under it at every width.**
  (R51, the owner's review of the wide guide.) D-232 moves the legend into a 24-cell column once the chart frame has 62 cells, which is right for what the legend was when that rule was written — a row per pass, a name and three times.
  R51 made the detail's legend the FR-GUIDE-1 numeric table, five columns of figures, and the guide column grows with the screen (D-253's `1.05fr`), so on a large desktop the frame passed the threshold and the table folded itself into 24 cells while the drawing was squeezed beside it.
  `Legend` marks its own list `data-lead` when it was handed the table, so the frame needs to learn nothing about what it was given, and the `@container` block takes the beside rule back for such a frame — as an *override at the end of the block*, not as a `:not(:has(…))` exception on the rule itself.
  That distinction is the decision: written as an exception it adds a specificity step to a rule the wide live page's own three-column grid (D-269) and legend scroll (D-271) sit *under*, so the guide's two-column grid won them both and the live page broke — which is what CI caught on #80, and what `r54-legend.spec.ts` and `live.spec.ts` are for.
  As an override the step is what the rule wants: nothing above it changes weight, and the one rule that outweighs the live page's is the one no live frame can match, since the live legend is never a table.
  Checked where it broke — `desktop.spec.ts` at 1920 × 1080 measures the frame past 62 cells, the table under the box and as wide as the frame, and fails on the old rule; jsdom resolves no container query, so the unit test can only pin the selector.

- **D-273 — The release capture set gains three screens and keeps its name; the re-shoot is what says whether a picture is still true.**
  (R53; SPEC §9 Phase 2b, D-179.) v1.1 added three places a reader can be that the set had no file for, so `captureSet.ts` gains `settings` (FR-COMP-2), `window` (FR-WIN-1) and `legend` (FR-LEG-3's states), 92 files where v1 had 60.
  Three things the additions fix in the machinery rather than in the list: the window is offered on a *touch device*, not at a width (FR-WIN-4), so its four-per-width tests are wrapped in a `test.describe` with a `hasTouch` context of their own and every other capture stays a picture of the device that width really is; the legend screen is shot two minutes past the instant the search ran, because at the search instant every drawn arc has just been clipped to `now` and every row reads `soon`, and two minutes on the same rows read `up`, one has run out, and the FR-LIVE-6 rows underneath say why they are not drawn — and the row is activated *after* the instant is set, since a new `shown` rebuilds the rows and drops the pin (F-53's promotion rule, D-271); the files keep the `v1-` prefix, because the set is the app's screens and not a phase's, and renaming 92 files would throw away the only thing a reviewer can diff against.
  The set is also *cleared before the run*, locally as `captures.yml` already does on `main`: that is what caught `v1-favourites-390-*`, four files still showing the saved places on a home screen R52 moved to `#settings` a task ago.
  A capture set that is only ever added to is a set that lies quietly; re-shooting the whole of it every release is the point of D-179 and the reason it is a single spec.

- **D-274 — The live chunk's budget goes back to the 10 KB floor.**
  (R53; D-178, SPEC §9 Phase 2b.) The release re-set is `measured × 1.1`, rounded up to the next 5 KB, floored at 10 and capped at the §11 ceiling, and on the 1.1.0 build it moves exactly one row: `Live-*.js` measures 7.6 KB against a budget of 15.
  That 15 is R44's, for the World Magnetic Model, which R47 then split into `useDeclination-*.js`; R47 left the budget alone on the ground that the next addition was the number to watch, and v1.1 has since made those additions — the trajectories, the stripe's three rows, the stepping control, the wide fold — for 1.3 KB.
  So the headroom goes back: at the floor the chunk has the same tenth of room as every other row, and the next six kilobytes are a `::warning::` on the PR that adds them instead of silence.
  Every other budget re-measures to the number it already carries (main 135.3 → 150, chart 97.1 → 110, worker 36.1 → 40, astronomy 22.1 → 25, declination 6.1 → 10, window 5.3 → 10, service worker 5.0 → 10), which is the more useful half of the result: a phase that added a settings page, a legend, a third view and live trajectories cost the main chunk 0.6 KB.

- **D-275 — The findings register is the release PR's table, and R53 is where it is written once.**
  (R53; FR-FIX-1, D-194.) SPEC §9 Phase 2b asks that no finding be silently open, and D-194 already says a finding is recorded in its task's summary with the commit that closed it.
  Those summaries are seventeen PR bodies, which answers "was F-23 fixed?" and not "is anything still open?", so the release task states all of it at once: one row per finding F-1..F-53 with the lane, the task, the merge commit on `main`, and the Decision Log row where the fix produced one.
  It is a table and not a new document because it has exactly one reader on exactly one day — the owner, deciding whether to tag — and a file listing closed findings would be stale from the first commit after it.
  F-51..F-53 are in it too, although the task entry says F-1..F-50: they were written after that entry, and a register that stops three rows short of the register it is checking would be the one thing it exists to prevent.

### 8.9 The legend and the fit rule *(v1.1, FR-LEG-1..5, FR-COMP-5, D-186, D-187)*

The chart contract test (§9.1) gains a third implementation and a fourth assertion: every view draws each pass's `legendKeys` letter once, at the peak, and draws no other text than compass and ring labels.
`Legend.tsx` is tested once against a fixture `SkyChartProps` for order, states, colours in both themes and the highlight round-trip; `PassNumbers` is tested as the detail's first legend block.
`ChartFrame` is tested with a stubbed `ResizeObserver` for the compact box (full-bleed, square; the live height floor) and `camera.ts` for the fit rule (`zoom` from the shorter side, ≥ 90 % extent on the fixture pass at 390 × 390 and 1240 × 450).

### 8.10 The sky window *(v1.1, FR-WIN-1..7, D-188)*

Not designed here beyond the boundary: `projection.ts` is pure and unit-tested against hand-computed points (north on the horizon at heading 0°, the zenith at pitch 90°, a roll of 90° swapping the axes); `useDeviceOrientation` is tested with synthetic events for the permission path, the smoothing and the once-per-frame rate; `SkyWindow` is tested through the contract test.
The spike (`spike/window/`, FR-WIN-7) fixes the projection, `WINDOW_FOV`, `WINDOW_SMOOTHING`, the sensor facts of OQ-17 and the stripe stepping of FR-TRAJ-5, and writes `docs/window/FINDINGS.md`; the owner drives it on a phone in an interactive session (§16.6), so its acceptance is the findings file, not a driver run.

### 8.11 Live trajectories *(v1.1, FR-TRAJ-1..5, D-189, D-190)*

`arcReveal.ts` is tested at the five states' boundaries (`t` at rise − lookahead − 1 ms, at rise, inside, at end, at end + linger, past) and `cutTrack` for the interpolated last point; each view's geometry module is tested once per state on the fixture pass; the live e2e scrubs across one pass and asserts the legend's `state` and the drawn segment count follow.
The stripe's three rows, the midnight date and the readout are RTL tests in a fixed zone; the stepping control's test is written with it, after the spike.

`installSnooze.ts` is tested at its own boundaries (FR-OFF-6 as amended, D-272): no answer shows the offer; a decline at `t` hides it at `t + 7 d − 1 ms` and shows it at `t + 7 d`; the second decline hides it for 30 days; the third answers it for good, as an install does at any point.
`InstallHint.test.tsx` then covers only what the component adds — which button writes which answer, and that a snoozed hint is not rendered — and `localPrefs.test.ts` that the two new keys round-trip and that a blob written before v1.1.2 reads as a device with no declines.
