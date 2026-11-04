# v2.9 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.45 v2.9 decisions (2026-10-30)

The sensor path is the sky screen's, unchanged: `useDeviceOrientation` (R47), `orientationAccess` (D-240), `useViewRotation`'s sensor camera, FR-FSC-10's quarter turn (`screenTurn`) and FR-FOL-5's ground notes.
What changes is where it runs: in the page's own window instead of a layer over the page.

- **D-941 — `SkyWindow` follows on the page.**
  (FR-GYRO-2, FR-GYRO-5.) `SkyWindow` gains a prop `follow: boolean` (default false) in place of `screen`.
  While `follow` is true, `useViewRotation` takes the sensor camera (as it did under `screen`), the field is the hand camera's current `fovDeg` (FR-SKY-14) and the pinch writes it; the quarter turn of FR-FSC-10 is applied inside the window's own box (the turn context moves from `components/screen/screenTurn.tsx` to `skychart/window/screenTurn.ts`, which already holds the pure part).
  Nothing is drawn over the drawing while following: no readout, no gutter, no legend strip, no advice — the window's overlay slot holds only FR-FOL-5's ground notes.
  `SkyChart` passes `follow` through and switches its view to the window while it is set without calling `setChartView`.
- **D-942 — The finger wins by callback.**
  (FR-GYRO-4.) The window's drag start, and FR-SKY-14's key handler, call a new `onFollowEnd(handAtPose)` prop before they move anything; the page sets its follow state to false and the hand camera is seeded with the pose the sensor last gave (`useViewRotation` exposes `poseAsHand()`), so the picture does not jump.
  The pinch does not call it.
- **D-943 — One `FollowToggle`.**
  (FR-GYRO-1, FR-GYRO-3.) `components/sky/FollowToggle.{tsx,module.css}`: an `OptionToggle` that renders nothing unless `orientationApiPresent()`; its click calls `requestOrientationAccess()` inside the handler and, on `'granted'`, `onChange(true)`; on `'denied'` it leaves the state off and shows the refusal line (`role="status"`) under it until the next click.
  The three pages own the state (`useState(false)`, never in prefs, D-921's rule for the sheet).
- **D-944 — Where it stands.**
  (FR-GYRO-1.) The live page passes it to the sheet as the row after the view row (compact) and to `SkyViewLayout`'s rail `View` group (wide, the `viewRow` slot's second line); the stars page and the pass detail render it in the `action` slot where `[ hold up to the sky ]` was (FR-FLOW-8's slot, R136's `window-hold-up` test id retired, the toggle's id `follow-toggle`).
- **D-945 — The sky screen goes.**
  (FR-GYRO-6.) Removed: `components/screen/{SkyScreen,useSkyScreen}.*`, `skychart/window/{CompassGutter.tsx,gutter.ts}` and their tests, the `skyScreen` flag in the store and every page's `screenOpen` branch (the live page's four `Esc` steps become three: card, sheet, leave), `Shell.tsx`'s screen hook, the `screen` prop through `SkyChart` and `ChartFrame`, the gutter constants in `lib/layout.ts` and `--gutter` in `tokens.css` (and `tests/styles/gutter.test.ts`), and the strings (`chart.screenClose`, the advice, the gutter's names).
  The specs `sky-screen.spec.ts`, `stars-screen.spec.ts` and `first-step-screen.spec.ts` are rewritten as follow specs or removed where they test only the screen.
  `docs/DESIGN.md` is regenerated.
- **D-946 — The specs bring their own permission.**
  (FR-GYRO-9.) `tests/e2e/orientation.ts` (new) exports `stubOrientation(page, { answer, readings })`: an init script that defines `DeviceOrientationEvent.requestPermission` returning the given answer and, after a grant, dispatches the given `deviceorientation` readings on a timer — so the e2e and capture specs behave the same on a Chromium that implements the request (Chrome for Testing 151 answers `'prompt'`) and on one that does not.
  Every spec that taps the toggle uses it.
- **D-947 — The sheet is a bottom sheet in both shapes.**
  (FR-GYRO-7.) `ControlsSheet` drops its `side` form: the `data-form` attribute and `SHEET_SIDE_SHARE` go; landscape takes the bottom form with the same `SHEET_MAX_SHARE` cap.
- **D-948 — The `×` and the swipe.**
  (FR-GYRO-8.) The head's `[ close ]` becomes a `<button>` holding `×` with `aria-label` "Close controls" / "Cerrar controles", `.target`.
  The swipe is pointer events on the head row (`touch-action: none` there, so the body keeps its native scroll): `pointerdown` captures, `pointermove` sets `--sheet-drag` (a downward `translateY`, never upward), `pointerup` closes when the travel exceeds `SHEET_SWIPE_CLOSE_PX` or the last 100 ms' speed exceeds `SHEET_FLICK_PX_PER_MS`, else snaps back; the transition is off while dragging and under reduced motion.
  The two constants join `lib/layout.ts`.
  D-922's capture-phase tap listener in `SkyViewLayout` and `SHEET_TAP_SLOP_PX` are removed.
- **D-949 — The satellites, open.**
  (FR-GYRO-10.) The sheet's last child is the legend panel the `[ list (n) ]` toggle used to open, rendered always, under a `SectionHeading` "Satellites (n)" with the hidden toggle at its end (D-905's head).
  `liveRows.ts`'s `COMPACT_SHEET` loses `list` (the button) and gains `satellites` (`live-satellites`); `share` stays.
  The sheet's children follow FR-GYRO-10's order.
- **D-950 — The window first.**
  (FR-GYRO-11.) `SKY_CHART_VIEWS` is reordered to window, polar, dome; every view row reads from it, so the order changes everywhere at once.
  The default view rules (FR-FLOW-14, V25-1) read the pref, not the order, and do not move.
- **D-951 — The count is FR-TONIGHT-7's.**
  (FR-GYRO-10.) The heading's `n` is the same visible-pass count `[ list (n) ]` carried.
- **D-952 — Delivery shape.**
  (V29-7.) Four tasks in three waves, gate auto, opus except R152 (the pages and the screen's removal, which crosses the most files) on fable; §16.28.
- **D-953 — The swipe starts on the head row, not on its controls.**
  (R150; FR-GYRO-8, D-948.) A press that lands on `[ settings ]` or the `×` is theirs: the head's `pointerdown` handler returns when the target is inside an `a` or a `button`, so it never captures the pointer, and the tap's `click` reaches the control (a capture on press would retarget the release to the row and lose the tap).
  A drag starts anywhere else on the row — in practice the place, which takes the row's free width.
  The release's speed is read over the drag's last 100 ms from the events' `timeStamp`, against the point before the window when the window holds only the release.
  In Chromium a tap that follows an instant synthetic flick is swallowed by the browser's own tap suppression after a fling; `live-full.spec.ts` taps the `×` before its flick for that reason.
- **D-954 — The satellites are v2.8's list panel, open; the hidden toggle is theirs.**
  (R150; FR-GYRO-10, D-905, D-949.) The panel keeps D-388's two `--tap` rows and the chart's `legendOpen` (now always `true` on compact), so it scrolls inside itself as before while the sheet's body scrolls around it.
  The hidden-objects toggle stays out of `LiveRow`'s compact lists (D-905): it is part of the `satellites` row, and `Live.test.tsx`'s inventory counts it reachable exactly when the satellites are.
  `LegendToggle`, `t.live.list` and `LEGEND_PANEL_ID`'s use on the page went with the button; the `liveLegendOpen` pref is no longer read by any page and is left in the store for a later cleanup.
- **D-955 — Where the finger wins.**
  (FR-GYRO-2, FR-GYRO-4; R151.) A drag starts, for `onFollowEnd`, when the press has travelled `HIT_RADIUS_PX` (the tap's slop, 12 px): short of it the press may still be a tap that names a star, or the first finger of a pinch, and neither ends following; the moves made before it are summed and applied to the hand once it is seeded, and a press that lifts short of it leaves nothing pending. "FR-SKY-14's keys" are the box's keys, all of them — the arrows and `+`, `=`, `-`, `0` — read literally: a zoom key ends following though the pinch does not.
  The window seeds the hand camera itself (`HandCamera.open` with `poseAsHand()`, the tilt clamped to the hand's range, the field the hand's) before it calls `onFollowEnd(pose)`, so the page has only to set its state; the same seed runs in a layout effect when the page turns `follow` off on its own (the toggle), so "turning it off leaves the camera where the phone last pointed" needs nothing from the page either.
  Before any reading there is no pose, and the hand stays where it was, which is what was drawn.
  While following the box stays focusable and keeps the hand's handlers, and nothing describes it (no readout is drawn).
- **D-956 — The turn in the window's own box, and the stub's shape.**
  (FR-FSC-10, FR-GYRO-9; R151.) When the following window's quarter differs from the browser's angle, the SVG and a `.notes` wrapper round the notes over it (`display: contents` otherwise) are each centred in the box at the box's size with its sides swapped for a quarter (inline px from what the box measured) and rotated by `turnFor(quarter, angle)`, and the projection's `view` takes the swapped size; the SVG stays the box's own child, since the stars page's focus and the specs' pinch find the box as its parent, so the picture is laid out wide to a reader holding a rotation-locked phone sideways.
  A tap is turned back by the same angle about the box's centre before it is hit-tested.
  `turnFor` moved from `SkyScreen.tsx` to `skychart/window/screenTurn.ts` beside `quarterTurnFor`, and the screen imports it until R152 removes the screen.
  `tests/e2e/orientation.ts` exports `stubOrientation`, plus `aimedAt` (a reading for an azimuth and altitude), `setReadings` (the phone turned) and `orientationAsks` (the count of requests); the readings repeat the last one, at 100 ms by default, on the page's `setInterval` so `page.clock` drives them; `tests/e2e/orientation.spec.ts` checks the stub on a blank routed page (granted, denied, and the plain event with `webkitCompassHeading` where there is no absolute one), which is also its import until R152's specs use it.
- **D-957 — Following leaves the view on the window, and takes the sheet's facing row while it lasts.**
  (FR-GYRO-2, FR-GYRO-4, FR-GYRO-5; R152.) D-941's "the window while `follow` is set" is read as "the view becomes the window": `SkyChart` keeps an unsaved hold on the window once `follow` has been on (`becameWindow`, its own state) until the reader chooses a view, so a drag that ends following hands the finger the window it is on and not the saved dome, and turning the toggle off leaves the window where the phone last pointed; the preference is never written, so a reload opens on the saved view.
  While following, the compact live sheet does not render its facing row: the readout is not drawn (FR-GYRO-5) — the row would be a nameless button over empty words — and a pick by hand would fight the sensor; the row is back when following ends.
  The pass detail and the stars page have no such row.
  Each page draws the toggle only where `orientationApiPresent()` passes, asked once at mount, so a page without the sensor has no row for it at all (not a wrapper round a toggle that renders nothing).
- **D-958 — The screen's captures are retired in place; R153 cuts them out with the hero.**
  (FR-GYRO-6, FR-GYRO-9; R152.) `tests/docs/captureIds.test.ts` holds every id a capture spec names to one the app renders, so with `sky-screen`, `window-hold-up` and the gutter's ids gone the v1 spec could not keep the screen's shot functions; but the README's hero (`scripts/readme-hero.ts`, FR-PUB-2) is composed from `v1-sky-screen-sky-844-dark-en.png`, which `tests/docs/public.test.ts` and `captures.test.ts` together hold on disk and in the set.
  So `CaptureScreen` gains `retired?: 'R152'`, the nine screens the layer owned (`window`, the six `sky-screen-*`, `stars-screen`, `stars-passes-screen`) carry it, `v1-captures.spec.ts` skips a retired screen and has no route for it, and the files stay named and on disk until R153 removes them from the set with the hero's new second tile (FR-GYRO-9's named removals).
  The per-task screen specs `r117-captures.spec.ts` and `r126-captures.spec.ts` are deleted; their PNGs under `docs/screenshots/r117/` and `r126/` stay as history.
  The `stars` capture at 360 and 390 now waits for `follow-toggle`, so R153's re-shoot of it shows the toggle (FR-GYRO-9's named move).
- **D-959 — FR-FAIL-7's silent-device wait is not re-made; the spec needs the amendment.**
  (FR-FAIL-7, FR-GYRO-6; R152.) `SENSOR_WAIT_S` and its timer lived in `useSkyScreen`, which D-945 removes, and FR-GYRO-6 withdraws §4.23 but not FR-FAIL-7's first sentence, which is about the screen.
  A following window that gets no reading keeps the hand's picture (FR-GYRO-2: "from the sensor's next reading"), and nothing says anything after 3 s; a phone whose readings carry no north still gets FR-FOL-2's note beside the view control through `onUnavailable`, and the iOS denial is the toggle's own line (FR-GYRO-3).
  Proposed to the owner: FR-FAIL-7's first sentence goes with the screen, its second stays as `window.denied`'s wording.
  Two more findings for the record: `lib/layout.ts`'s `GUTTER_CELLS` is the wide shell's column gutter (D-253), not the compass gutter, so D-945's "gutter constants in `lib/layout.ts`" named nothing to remove; and `first-step-screen.spec.ts` is FR-FIRST-1's home page spec ("one screen") and not a sky-screen spec, so it stays as D-945 did not intend it.
  `stubOrientation` also stops the browser's own (trusted) orientation events, as `stubCompass` did: headless Chromium fires one all-`null` `deviceorientation` on a new listener, which the app reads as a phone with no north and leaves the note under the view row.
- **D-960 — The capture set on the v2.9 pages, and what it shoots.**
  (R153; FR-GYRO-9, FR-GYRO-11, FR-CAP-5; D-946, D-958.) The nine screens D-958 marked retired leave `captureSet.ts` with the `retired` field, and their 38 files leave `docs/screenshots`; the set is 384 (414 − 38 + 8).
  The compact live sheet's files (`live-sheet`, `live-sheet-list`, and `legend` at 360 and 390, which is the same sheet) are shot on a touch phone, because the toggle's row FR-GYRO-9 names is drawn only where `orientationApiPresent()` passes (D-957), and 2.8.0's desk-without-touch sheet would not show it; the sheet-closed live files stay as they were shot (no touch), so they do not move.
  Every touch capture installs `stubOrientation` with no readings: nothing is asked or read until a capture taps the toggle, and the desk browser's own all-`null` event never reaches the page (D-959).
  Two screens join at 390 × 844 only, as FR-GYRO-9 names the size: `live-following` (the toggle tapped in the sheet, the sheet closed by its `×`) and `stars-following` (the toggle on in the action slot); each sets the stub's readings to `aimedAt` the window's own look before the tap, rounded to the degree, so following keeps the picture's field, the window settles on whole degrees, and the instant is pinned after it.
  `live-sheet-list` keeps its name though there is no list to open: it is the sheet scrolled to its satellites, and renaming it would be a removal and an addition FR-GYRO-9 does not name.
  The README hero's second tile, the retired `v1-sky-screen-sky-844-dark-en`, becomes `v1-stars-844-dark-en` — the phone turned, as the tile was, on a page the app has (FR-PUB-2); the alt text says so.
- **D-961 — The budget as R153 found it: `live` grew, measured and not moved.**
  (R153; FR-GYRO-9, D-178, D-938, D-940.) Built plainly beside `c996ba3` (2.8.0) on one machine: `main` 180,854 bytes gzipped against 184,361 (−3,507), `stars` −631, `window` −592, and `live` 16,007 against 15,658 (+349, 15.6 KB against 15.3, inside its budget of 20).
  The screen left every chunk it was in, but `live` also took R150's sheet code (the `×`, the swipe and its speed reading, the satellites' head) and R152's toggle row, which only the lazy `Live.tsx` imports.
  FR-GYRO-9 says no row may grow; R153 changes no behaviour and no code, so it neither re-sets the row nor trims the sheet: the owner settles it (RELEASE §22.4) — amend FR-GYRO-9 to the measure (× 1.1 is 17.2, so D-178 keeps 20 and nothing in the script moves), or a `live` task takes about 350 bytes out of the sheet.
  Until then R153 stays unchecked in `TASKS.md`, as R149 did.
  *(Settled 2026-10-31: the owner accepted the measure, V29-10; FR-GYRO-9 is amended and no budget moves.)*

### 9.11 v2.9 additions *(FR-GYRO)*

- **The window follows.**
  `SkyWindow.follow.test.tsx`: with a stubbed grant and readings, the readout state follows the pose, nothing is rendered in the overlay but the ground notes, a drag calls `onFollowEnd` with the pose, a pinch does not.
- **The toggle.**
  `FollowToggle.test.tsx`: absent without the constructor or touch points; a grant calls `onChange(true)`; a refusal leaves it off with the line; the line goes on the next click.
- **The sheet.**
  `ControlsSheet.test.tsx`: the `×`'s name, no side form, the swipe's three cases (40 px snaps back, 80 px closes, a fast short flick closes), no transition under reduced motion.
  `Live.test.tsx`: the sheet's order with the satellites last and open, the toggle row on a sensor device, a tap on the sky with the sheet open reaching the sky.
- **The view row.**
  `controlRows.test.ts` and the view row's component test read `[Window] Polar Dome` in both languages.
- **The pages.**
  A new `tests/e2e/follow.spec.ts` with `stubOrientation` at 390 × 844 and 844 × 390: the toggle on the live page, the stars page and the pass detail, the window turning with injected readings, a drag ending it, a refusal's line.
  `live-full.spec.ts`: the bottom sheet at 844 × 390, the swipe, the satellites' heading and count.
  `targets.spec.ts` and `rhythm.spec.ts` with the new rows; the screen's specs removed or rewritten (D-945).
- **Unchanged is a capture.**
  Every wide capture that never showed the screen's entry is byte-identical to 2.8.0's.

### 16.28 Delivery of the v2.9 tasks *(V29-1..V29-9, D-941..D-952)*

The V1-11 rules are unchanged; the gate is v2.8's (D-929): auto, merged on CI green and a clean review.
Four `R` tasks in three waves of two, one and one, after this plan is on `main`.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R150 — The sheet: a bottom sheet both ways, the `×` and the swipe, the tap on the sky withdrawn, the satellites open at its end, the window first | `live` (`components/live/ControlsSheet.*`, `components/sky/SkyViewLayout.*` (the tap listener), `screens/{Live.tsx,Live.test.tsx,liveRows.ts,liveRows.test.ts}`, `skychart/SkyChart.tsx` (`SKY_CHART_VIEWS` only), `lib/layout.ts`, `src/i18n/{en,es}/{sheet,live}.ts`, `tests/styles/controlRows.test.ts`, `tests/e2e/{live-full,live-states,targets,rhythm}.spec.ts`) | opus | auto | — |
| 1 | R151 — The window follows on the page: `follow`, `onFollowEnd`, `poseAsHand`, `FollowToggle`, the specs' permission stub | `window` (`skychart/window/{SkyWindow.tsx,useViewRotation.ts,screenTurn.ts}` and tests, `components/sky/FollowToggle.*`, `src/i18n/{en,es}/window.ts`, `tests/e2e/orientation.ts`) | opus | auto | — |
| 2 | R152 — The pages follow and the screen goes: the toggle on the live page, the stars page and the pass detail; the sky screen, its hook, the gutter, `[ hold up to the sky ]` and their strings removed; `follow.spec.ts` | `live`, crossing into `stars`, `detail`, `window`, `state` (`screens/{Live,Stars,PassDetail}.*`, `skychart/SkyChart.tsx`, `ChartFrame.tsx`, `components/screen/**` (removed), `skychart/window/{CompassGutter,gutter}*` (removed), `Shell.tsx`, `state/**`, `lib/layout.ts`, `src/ui/styles/tokens.css`, `docs/DESIGN.md`, `src/i18n/**`, `tests/e2e/**` screen specs) | fable | auto | R150, R151 |
| 3 | R153 — The capture set and 2.9.0: the moved and removed captures, the following captures, the budget, `package.json` 2.9.0, `docs/RELEASE.md` §22, no tag | `docs` | opus | auto | R152 |

R150 and R151 name no file in common: R150 owns `lib/layout.ts`, `sheet.ts`, `live.ts` and `SkyChart.tsx`'s view list; R151 owns the window's files and `window.ts`.
R152 is alone in its wave.

**Sessions** (D-929): every row carries `Review: opus`, `Turns: 500`, `Fallback: off`; `Model:` is `fable` for R152 and `opus` for the rest.

**Owner gates:** none (D-952).
At R153 the owner opens the live sky on the iPhone, taps `[ follow the phone ]`, allows motion, turns, drags, and closes the sheet with the `×` and with a swipe.
The tag `v2.9.0` and the deploy are the owner's.

**Decision block** (§16.2): **R150 takes D-953..D-954, R151 D-955..D-956, R152 D-957..D-959, R153 D-960..D-961.**
D-941..D-952 are this plan's.

What every session reads (D-284's rule): SPEC §4.51 whole (FR-GYRO-1..11), US-44, §9 Phase 2r, §12 V29-1..V29-9; SPEC §4.50 (FR-FULL-1..10, as amended) and §4.23 (FR-FSC-*, withdrawn) for what moves and what goes; PLAN §2.44, §2.45, §9.11 and this section.
