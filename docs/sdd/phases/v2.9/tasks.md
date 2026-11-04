# v2.9 — TASKS.md sections

Cut from `TASKS.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

## v2.9 tasks

Draft, cut 2026-10-30 from `SPEC.md` v2.9 and `PLAN.md` v0.17. Spec Phase 2r, "follow the phone": where the phone has a motion sensor, `[ follow the phone ]` turns the page's own sky with the phone on the live page, the stars page and the pass detail, and the sky screen it replaces is retired with its compass gutter; the controls sheet is a bottom sheet in both shapes, closes with a `×` or a swipe down, and ends with the satellites list open; the view row lists the window first (FR-GYRO-1..11, US-44, V29-1..V29-9). The phase ends with `2.9.0` on `main`; the tag and the deploy are the owner's.

Delivery is PLAN §16 with §16.28: four tasks in three waves of two, one and one, `Model: fable` on R152 and `opus` on the rest, every task `Review: opus`, `Turns: 500`, `Fallback: off`, `Gate: auto`.

Decision block (§16.2), reserved in PLAN §16.28: **R150 D-953..D-954, R151 D-955..D-956, R152 D-957..D-959, R153 D-960..D-961**. D-941..D-952 are the plan's.

What every session reads, named in each task as "the phase set": SPEC §4.51 whole (FR-GYRO-1..11 and its constants table), US-44, §9 Phase 2r, §12 V29-1..V29-9; SPEC §4.50 (as amended) and §4.23 (withdrawn); PLAN §2.44, §2.45, §9.11 and §16.28.

### Wave 1

- [x] **R150 — The sheet: a bottom sheet both ways, the `×` and the swipe, the tap on the sky withdrawn, the satellites open at its end, the window first**
  - **Lane:** live
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); PLAN D-921..D-923, D-928, D-932, D-935, D-936, D-947..D-951; `components/live/ControlsSheet.{tsx,module.css,test.tsx}`; `components/sky/SkyViewLayout.{tsx,module.css,test.tsx}` (the capture-phase tap listener); `screens/{Live.tsx,Live.test.tsx,liveRows.ts,liveRows.test.ts}`; the legend panel and its hidden toggle in `Live.tsx`; `skychart/SkyChart.tsx` (`SKY_CHART_VIEWS`); `lib/layout.ts`; `src/i18n/{en,es}/{sheet,live}.ts`; `tests/styles/controlRows.test.ts`; `tests/e2e/{live-full,live-states,targets,rhythm,liveHelpers}.ts`.
  - **Goal:** on a phone the controls rise from the bottom upright and sideways, close with a `×` or a swipe down, and end with "Satellites (n)" and the list open; a tap on the sky with the sheet open reaches the sky; every view row reads `[Window] Polar Dome`.
  - **Satisfies:** FR-GYRO-7, FR-GYRO-8, FR-GYRO-10, FR-GYRO-11; FR-FULL-4, FR-FULL-5, FR-TONIGHT-6, FR-FLOW-4 as amended; US-44 AC5, AC6.
  - **Scope (PLAN D-947..D-951):** the side form and `SHEET_SIDE_SHARE` removed; the `×` with its name; the swipe on the head row with `SHEET_SWIPE_CLOSE_PX` and `SHEET_FLICK_PX_PER_MS`; D-922's listener and `SHEET_TAP_SLOP_PX` removed; `[ list (n) ]` replaced by the open satellites at the sheet's end in FR-GYRO-10's order (`liveRows`' `satellites`); `SKY_CHART_VIEWS` reordered; tests per §9.11's third and fourth bullets; `live-full.spec.ts` at 844 × 390 as a bottom sheet, the swipe by touch drags.
  - **Touches outside the lane:** `skychart/SkyChart.tsx` (the one constant), `lib/layout.ts`, `src/i18n/{en,es}/{sheet,live}.ts`, the e2e specs above.
  - **Out of scope:** the follow toggle (R151, R152); the sky screen's removal (R152); the capture set (R153).
  - **Done when:**
    - `ControlsSheet.test.tsx`, `Live.test.tsx`, `liveRows.test.ts`, `SkyViewLayout.test.tsx`, `controlRows.test.ts` pass.
    - `live-full`, `live-states`, `targets`, `rhythm` and `shapes` green at the compact sizes in both languages.
    - The Done note gives the swipe's three cases, the sheet at 844 × 390, and the satellites' heading with its count.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and the named e2e specs green.
  - *Done:* as written, plus D-953 and D-954. **The swipe** (`ControlsSheet.test.tsx`, and `live-full.spec.ts` by touch drags through the DevTools protocol at 390 × 844 in both languages): a slow 40 px drag snaps back (the sheet follows at `--sheet-drag: 40px` with no transition, then returns to its place), a slow 80 px drag closes and gives the focus to `[ controls ]`, a 30 px flick in one move closes; an upward drag never lifts the sheet, a cancel snaps back, a press on `[ settings ]` or the `×` is not a drag. **The sheet at 844 × 390**: 844 × 273 — the full width, 0.70 of the height (`SHEET_MAX_SHARE`), its bottom edge at 390, its body scrolling, the page not, in both languages; at 390 × 844 591 px (0.70) on the twenty-pass run. **The satellites' heading**: "Satellites (n)" / "Satélites (n)", `n` the drawn passes the open list holds — 1, 5 and 0 in `Live.test.tsx` (the empty sky keeps the list's line), 0 by day on `live-full`'s seed, 1 after `[ see next pass ]` in the captures — with `[ ] Hidden` / `[ ] Ocultos` at its end. The `×` is a 48 × 48 target named "Close controls" / "Cerrar controles". Every view row reads `[Window] Polar Dome` / `[Ventana] Polar Domo` (`controlRows.test.ts`, both languages). Tests: `npm test` 3081 passed, 7 skipped; `tests/docs` 216 passed; lint, typecheck, `check:dead` clean. e2e: `live-full` 22, `live-states` + `targets` 20 (the two sky-screen targets fail on the container's `requestPermission`, as R148 recorded), `rhythm` + `shapes` 22, `live-compact` + `live-landscape` + `sky-layout` 34, `r48-trajectories` + `live-playback` 27, `structure` + `live-tonight` + `live.spec` 26 (two sky-screen cases fail as above); `sky-window` fails only its sky-screen and refused-permission cases. Captures: `docs/screenshots/r150-live-{390,844-landscape}-{sheet,satellites}-dark-{en,es}.png` (`r150-captures.spec.ts`). The gated older capture specs that clicked `[ list (n) ]` (`r71`, `r144`, `r148`, `v1-captures`) are left to R153's capture set.

- [x] **R151 — The window follows on the page: `follow`, `onFollowEnd`, `poseAsHand`, `FollowToggle`, the specs' permission stub**
  - *Done:* as written, plus D-955 (a drag is the press past `HIT_RADIUS_PX`; every box key, zoom keys included, ends following; the window seeds the hand itself, and does so too when the page turns `follow` off) and D-956 (the turn applied to the SVG and a notes wrapper in place, the SVG kept the box's child; `turnFor` moved to `screenTurn.ts`; the stub's helpers and its own `orientation.spec.ts`). **Follow states tested** (`SkyWindow.follow.test.tsx`, 8): armed with no reading, the hand's picture stands; after readings the facing and tilt are the phone's at the hand's field (40°), the hand camera untouched; nothing over the drawing — no readout, waiting note, hint, chip, advice or gutter, no `role="status"` — until the phone points down, when the ground note (then the buried note) is the one status line; a sideways pose on a 390 × 844 box turns the drawing and the notes 90° with the drawing laid out 844 × 390, back to 0 upright, and no turn once off; a tap's wobble keeps following, a drag past 12 px calls `onFollowEnd` once with the phone's last pose (true north, the hand's field), the hand seeded there and then dragged 10° by 40 px; a pinch halves the field to 30° and keeps following; `→` and `+` end it, `→` then stepping from the phone's pose; turned off by the page, the camera stays where the phone last pointed; turned off before any reading, the hand stays. **The toggle's two lines** (`FollowToggle.test.tsx`, 8): English `[ ] follow the phone` and "Motion access is off. Allow it in the browser's settings, then tap again."; Spanish `[ ] seguir el teléfono` and "El acceso al movimiento está desactivado. Permitilo en los ajustes del navegador y volvé a tocar." — absent without the constructor or touch points, asked inside the click, a throwing request read as a refusal, the line gone on the next click, off asks nothing. `orientation.spec.ts` 3 passed. `npm test` 3086 passed, 7 skipped (Playwright's browsers aliased 1234 → 1243); lint, typecheck, `tests/docs` and `check:dead` green. The toggle is mounted nowhere yet (R152); the catalog key snapshot gains `window.followToggle` and `window.followRefused`.
  - **Lane:** window
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); SPEC FR-WIN-3, FR-WIN-4, FR-FOL-5, FR-FSC-10, FR-SKY-14; PLAN D-175, D-188, D-240, D-323, D-424..D-431, D-798, D-820, D-941..D-943, D-946; `skychart/window/{SkyWindow.tsx,useViewRotation.ts,useDeviceOrientation.ts,orientationAccess.ts,screenTurn.ts}` and their tests; `components/screen/screenTurn.tsx` (the context the window reads today); `components/live/compassHeading.ts`; `docs/DESIGN.md` (`OptionToggle`).
  - **Goal:** the window can follow the phone on a page with nothing drawn over it, hands the camera back to the finger on a drag, and one toggle asks for the permission and says so when refused — each working on its own (R152 mounts them).
  - **Satisfies:** FR-GYRO-2, FR-GYRO-3, FR-GYRO-4, FR-GYRO-5 (window level), FR-GYRO-1 (the component), FR-GYRO-9 (the stub and the toggle's strings).
  - **Scope (PLAN D-941..D-943, D-946):** `follow` on `SkyWindow` with the sensor camera, the field from the hand's, FR-FSC-10's turn inside the window's own box and only the ground notes in the overlay; `onFollowEnd(pose)` on drag and key, not pinch; `poseAsHand()`; `components/sky/FollowToggle.{tsx,module.css,test.tsx}` with the refusal line; the strings in `window.ts`; `tests/e2e/orientation.ts`'s `stubOrientation`. The `screen` prop and the screen's code stay for R152 to remove.
  - **Touches outside the lane:** `components/sky/FollowToggle.*`, `tests/e2e/orientation.ts`, `src/i18n/{en,es}/window.ts`.
  - **Out of scope:** mounting on any page, removing the screen (R152); `lib/layout.ts` and the sheet (R150).
  - **Done when:**
    - `SkyWindow.follow.test.tsx`, `FollowToggle.test.tsx` and the window's existing tests pass.
    - The Done note gives the follow states it tested and the toggle's two lines in both languages.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run check:dead` green.

### Wave 2

- [x] **R152 — The pages follow and the screen goes: the toggle on the live page, the stars page and the pass detail; the sky screen, its hook, the gutter, `[ hold up to the sky ]` and their strings removed; `follow.spec.ts`**
  - **Lane:** live
  - **Model:** fable
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R150, R151
  - **Reads:** the phase set (above); SPEC FR-FLOW-8, FR-STAR-5 (withdrawn), FR-GUT-* (withdrawn); PLAN D-321, D-350, D-351, D-877, D-927, D-944, D-945, D-946; `screens/{Live,Stars,PassDetail}.*`; `skychart/{SkyChart,ChartFrame}.tsx`; `components/screen/**`; `skychart/window/{CompassGutter.tsx,gutter.ts}`; `Shell.tsx`; `state/**` (`skyScreen`); `lib/layout.ts` (gutter constants); `src/ui/styles/tokens.css` (`--gutter`) and `tests/styles/gutter.test.ts`; `tests/e2e/{sky-screen,stars-screen,first-step-screen,targets,live}.spec.ts`; R150's and R151's changes.
  - **Goal:** on a phone, `[ follow the phone ]` stands in the live page's sheet after the view row and on the stars page and the pass detail where `[ hold up to the sky ]` stood; following turns the page's own window with the phone; nothing opens the sky screen, which is gone with its gutter.
  - **Satisfies:** FR-GYRO-1, FR-GYRO-5, FR-GYRO-6; US-44 AC1–AC4.
  - **Scope (PLAN D-944, D-945):** the toggle mounted on the three pages (and wide's `View` group); each page's follow state; the screen and everything only it used removed, `Esc`'s steps three; `docs/DESIGN.md` regenerated; the screen's e2e specs rewritten as `tests/e2e/follow.spec.ts` with `stubOrientation` or removed; `targets.spec.ts` without the screen's case.
  - **Touches outside the lane:** the stars page, the pass detail, `skychart/**`, `state/**`, `Shell.tsx`, `lib/layout.ts`, `tokens.css`, `docs/DESIGN.md`, `src/i18n/**`, the e2e specs above.
  - **Out of scope:** the capture set (R153).
  - **Done when:**
    - `follow.spec.ts` green at 390 × 844 and 844 × 390 in both languages, on the live page, the stars page and the pass detail.
    - No `sky-screen*`, `window-hold-up` or gutter test id rendered; `npm run check:dead` green.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` (in groups) green.
  - *Done:* as written, plus D-957 (following leaves the view on the window until a view is chosen; the live sheet's facing row is not drawn while following; the toggle's row exists only where the sensor is), D-958 (the screen's nine captures retired in the set and skipped, their files kept for the README hero until R153; `r117-captures.spec.ts` and `r126-captures.spec.ts` deleted) and D-959 (FR-FAIL-7's 3 s wait went with `useSkyScreen` — a spec amendment is proposed; `GUTTER_CELLS` is the shell's, not the compass gutter's; `first-step-screen.spec.ts` is the home's and stays). **Mounted:** `FollowToggle` in the live sheet as `live-follow` after the view row, in the wide rail's `View` group after `[x] stars` as a second line, and in the stars page's and the pass detail's `action` slot where `[ hold up to the sky ]` stood; each page owns `useState(false)`; `SkyChart` takes `follow`/`onFollowEnd` (now `SkyChartProps`') and shows the window without `setChartView`. **Removed:** `components/screen/**`, `CompassGutter.*`, `gutter.*`, `tests/styles/gutter.test.ts`, `ChartFrame.test.tsx` (all screen), the `screen`/`overlay`/`inventory` props and the frame's screen branch, the window's gutter, chip, probe, headline, advice and landmark line, `HandFacingRow`'s hold-up, the store's `skyScreen`/`openSkyScreen`/`closeSkyScreen`/`refocusWindow`/`windowRefocused`/`setWindowNote` and the `liveLegendOpen` pref (`DEFAULT_LIVE_LEGEND_OPEN`, the schema key), `Shell.tsx`'s screen hook, `--gutter` (`docs/DESIGN.md` regenerated), the strings `chart.screenClose`, `starsPage.holdUp`, `window.{turnAdvice,emptyField,emptySky,gutterLabel,gutterMark}` in both catalogs, the live page's `Esc` screen step (card → sheet → leave) and its inert top row, `liveHelpers`' `openSkyScreen`/`heading`/`pose`/`VIEW_GROUP`/`VIEW_OPTION`, `flowPages`' `openSkyScreenPage`, the specs `sky-screen.spec.ts` and `stars-screen.spec.ts`, `live.spec.ts`'s screen case, `sky-window.spec.ts`'s phone describe (the screen from a pass detail, its refusal, its compass-less phone, R90's silent device and the `r66-window-844-*` shots). **Tests:** `Live.test.tsx` (the row after the view row, the wide group, the tap asking once and the window following with `chartView` and storage untouched, off leaving the window, the refusal line, a drag ending it, `Esc` in three steps), `PassDetail.test.tsx` and `Stars.test.tsx` (the action slot with and without the sensor, on/off), `SkyChart.contract.test.tsx` (the window as a page's view with `PEAK_FACING_OPTIONS`, `follow` the window with the pref untouched), `SkyChart.test.tsx` (the option asks nothing; the compass-less phone's note under `follow`); `npm test` 2985 passed, 7 skipped; `tests/docs` 214; lint, typecheck and `check:dead` clean. **e2e:** `follow.spec.ts` 21 — on each of the three pages at 390 × 844 and 844 × 390 in both languages the tap asks once, the chart is the window with `data-follow`, the window settles on `aimedAt(90, 30)` then `aimedAt(200, 50)` with no readout, note, chip, advice, gutter or `sky-screen`, off keeps the window at the last pose with the pref untouched; the refusal line in both languages on each page; a drag ends following on each page with the camera the finger's and later readings moving nothing. `targets.spec.ts` measures the toggle on the three pages under touch. Groups green: live-full + live-states 28 (the sheet's order with `live-follow` under touch), targets + rhythm 34, shapes + sky-layout 37, sky-window + live.spec 20, stars + pass-detail 11, wide 12, window-zoom + live-compact + live-landscape + live-tonight + orientation 23. **Budget:** main 176.6 KB of 180 (180.0 on the 2.8.0 branch: the screen left main), live 15.6 of 20, window 26.1 of 30, stars 26.0 of 30. **Captures:** `docs/screenshots/r152-{live-390-sheet,stars-390,detail-390}-dark-{en,es}.png` (`r152-captures.spec.ts`, under `stubOrientation`). Follow-ups: the all-`null` orientation event a desk Chromium fires could be ignored by `useDeviceOrientation` rather than read as a compass-less phone; `chart-view-note` under the compact sheet's view row overlaps the row below it (pre-existing); the wide rail's toggle is tested but not captured.

### Wave 3

- [x] **R153 — The capture set and 2.9.0: the moved and removed captures, the following captures, the budget, `package.json` 2.9.0, `docs/RELEASE.md` §22, no tag**
  - *Done (the budget settled by the owner, V29-10: `live` +349 bytes accepted, FR-GYRO-9 amended):* the set is 384 (414 − 38 + 8). Against `c996ba3` shot by its own spec off its own plain build on one Linux container, 228 of the 376 files both shot are byte-identical and 148 moved, all named: **FR-GYRO-11's window-first view row** (108) — `v1-guide-{360,390,768,1280}-*`, `v1-polar-{360,390,1280}-*`, `v1-guide-window-{360,390,1280,1920}-*`, `v1-legend-1280-*`, `v1-live-watching-{1024,1200,1280,1920,2560,3840}-*`, `v1-live-scrubbing-{1024,1200,1280,1920,2560,3840}-*`, `v1-live-window-{1280,1920}-*`, `v1-live-window-follow-1280-*`; **FR-GYRO-9's compact live sheet** (24, now shot on a touch phone, D-960) — `v1-live-sheet-{390,844}-*`, `v1-live-sheet-list-{390,844}-*`, `v1-legend-{360,390}-*`: the `×`, `[Window] Polar Dome`, `[ ] follow the phone`, the open satellites, the bottom sheet at 844; **FR-GYRO-9's toggle where hold-up was** (16) — `v1-stars-{360,390}-*`, `v1-stars-passes-{360,390}-*`. **Added** (8): `v1-live-following-390-*`, `v1-stars-following-390-*`, under `stubOrientation`. **Removed** (38): `v1-window-844-*`, `v1-sky-screen-{sky,chip,ground,buried}-844-*`, `v1-sky-screen-portrait-{360,390}-*`, `v1-sky-screen-turned-{360,390}-dark-en`, `v1-stars-screen-844-*`, `v1-stars-passes-screen-844-*`, with the `retired` field. No other file moved; 184 unchanged files that differ only by this container's renderer were restored, not committed. Two runs of the 156: 132 byte-identical, 24 at ≤ 23 px and a step ≤ 2 (F-99). **Budget against 2.8.0** (gzip bytes): `main` 180,854 against 184,361 (−3,507), `stars` −631, `window` −592, `chart` −1, `settings` −2, `astronomy` +1, `sw` +2, `worker` 0, and **`live` 16,007 against 15,658 (+349, 15.6 KB against 15.3, budget 20)** — R150's sheet code and R152's toggle row; FR-GYRO-9 says no row may grow, so it is recorded and left to the owner (no code or budget changed). **Removed:** no message key (each key whose read the phase removed has another reader) and no code (`check:dead` clean). The README hero's second tile is `v1-stars-844-dark-en` (D-960); hero and social preview re-drawn. The older gated specs `r71`, `r144`, `r148` open the sheet and scroll to its satellites instead of pressing `[ list (n) ]`. `package.json` 2.9.0; RELEASE §22 with the owner's phone check; D-960, D-961. Tag the squash merge of this PR (RELEASE §22.5). Follow-up: `seedPage`'s `clock.pauseAt` race ('Cannot fast-forward to the past') cost one capture per run, on 2.8.0 as on the branch.
  - **Lane:** docs
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R152
  - **Reads:** the phase set (above); SPEC FR-CAP-5; PLAN D-178, D-937, D-938, D-940, D-946; `docs/RELEASE.md` §21; `tests/e2e/{captureSet.ts,v1-captures.spec.ts}`; `scripts/bundle-budget.ts`.
  - **Goal:** the capture set shows the follow toggle, the bottom sheet with its `×` and open satellites and the window-first view row, has no sky screen, and `main` reads 2.9.0 ready for the owner's tag.
  - **Satisfies:** FR-GYRO-9; §9 Phase 2r's release item.
  - **Scope:** re-shoot with `stubOrientation` where a capture follows; remove the sky screen's files from the set; add the live page and the stars page following at 390 × 844; list the moves against FR-GYRO-9; the budget (no row larger than 2.8.0's); `package.json` 2.9.0; RELEASE §22 with the owner's phone check.
  - **Out of scope:** any behaviour change; the tag and the deploy.
  - **Done when:**
    - FR-CAP-5's diff against 2.8.0 lists only FR-GYRO-9's named moves and removals.
    - `npm run bundle:budget` and `npm run check:dead` green.
    - The Done note lists the changed, added and removed files, the budget rows against 2.8.0, and "tag the squash merge of this PR".

### Requirement coverage (v2.9)

| Requirement | Task |
|---|---|
| FR-GYRO-1 | R151 (the component), R152 (mounted) |
| FR-GYRO-2 | R151 |
| FR-GYRO-3 | R151 |
| FR-GYRO-4 | R151 |
| FR-GYRO-5 | R151, R152 |
| FR-GYRO-6 | R152 |
| FR-GYRO-7 | R150 |
| FR-GYRO-8 | R150 |
| FR-GYRO-9 | R151 (stub, strings), R153 |
| FR-GYRO-10 | R150 |
| FR-GYRO-11 | R150 |

Waves (for the sanity check): **wave 1** R150 (live) + R151 (window) — **wave 2** R152 (live) — **wave 3** R153 (docs). R150 and R151 share no file.
