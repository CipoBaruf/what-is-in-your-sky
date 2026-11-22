# What Is In Your Sky Right Now — Task Breakdown

## Status

This file holds the open phase, v3.0; each closed phase's tasks are in its folder, moved byte for byte (FR-SDD-3).
Each phase's header rows (status, inputs, scope) are in [`docs/sdd/reference/breakdown-inputs.md`](docs/sdd/reference/breakdown-inputs.md).

| Phase | First … last task | Merged | File |
|---|---|---|---|
| mvp | R1 … H | 16 of 16 | [tasks.md](docs/sdd/phases/mvp/tasks.md) |
| v1 | R16 … R36 | 21 of 21 | [tasks.md](docs/sdd/phases/v1/tasks.md) |
| v1.1 | R37 … R55 | 19 of 19 | [tasks.md](docs/sdd/phases/v1.1/tasks.md) |
| v1.2 | R56 … R60 | 6 of 6 | [tasks.md](docs/sdd/phases/v1.2/tasks.md) |
| v1.3 | R62 … R65 | 5 of 5 | [tasks.md](docs/sdd/phases/v1.3/tasks.md) |
| v1.3.2 | P1 … P2 | 2 of 2 | [tasks.md](docs/sdd/phases/v1.3.2/tasks.md) |
| v1.4 | R67 … R72 | 7 of 7 | [tasks.md](docs/sdd/phases/v1.4/tasks.md) |
| v2.0 | R74 … R80 | 9 of 9 | [tasks.md](docs/sdd/phases/v2.0/tasks.md) |
| v2.1 | R83 … R100 | 19 of 19 | [tasks.md](docs/sdd/phases/v2.1/tasks.md) |
| v2.2 | P6 … P5 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.2/tasks.md) |
| v2.2.1 | P7 … P9 | 3 of 3 | [tasks.md](docs/sdd/phases/v2.2.1/tasks.md) |
| v2.3 | R103 … R110 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.3/tasks.md) |
| v2.4 | R111 … R118 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.4/tasks.md) |
| v2.5 | R119 … R128 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.5/tasks.md) |
| v2.6 | R129 … R135 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.6/tasks.md) |
| v2.6.1 | R137 … R140 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.6.1/tasks.md) |
| v2.7 | R141 … R145 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.7/tasks.md) |
| v2.8 | R146 … R149 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.8/tasks.md) |
| v2.9 | R150 … R153 | 4 of 4 | [tasks.md](docs/sdd/phases/v2.9/tasks.md) |
| v2.10 | R154 … R161 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.10/tasks.md) |
| v2.11 | R162 … R165 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.11/tasks.md) |
| v2.12 | R167 … R171 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.12/tasks.md) |
| v2.13 | R172 … R181 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.13/tasks.md) |
| v2.14 | R182 … R191 | 10 of 10 | [tasks.md](docs/sdd/phases/v2.14/tasks.md) |
| v2.14.2 | R192 | 1 of 1 | [tasks.md](docs/sdd/phases/v2.14.2/tasks.md) |
| v2.15 | R193 … R197 | 5 of 5 | [tasks.md](docs/sdd/phases/v2.15/tasks.md) |
| v2.16 | R198 … R205 | 8 of 8 | [tasks.md](docs/sdd/phases/v2.16/tasks.md) |
| v3.0 | R206 … R225 | 0 of 20 | this file |

## v3.0 tasks

Cut 2026-11-21 from the phase folder `docs/sdd/phases/v3.0/` (`spec.md` §2.24, §4.61–§4.67, Phase 2z; `plan.md` §2.55, §8.22, §9.19, §11.11, §16.38).
Spec Phase 2z, "the sky first": the live sky is the first page at both widths, the home goes and the stars fold into live, the next pass is a strip, the sky is dark at every hour, every control has one look per role, and a new version is said on every page (V30-1..V30-32).
Delivery is PLAN §16.38: twenty tasks in nine waves, every one on Opus but the documents' sweep on Sonnet (no `fable` without usage credits),, the design system first (waves 1 and 2, D-1224), every task `Gate: auto` and merged by the driver on green CI and a clean review; the tag `v3.0.0` and the deploy are the owner's.
Every task updates the documents its change touches: `docs/sdd/map.md`, the reference pages, `docs/sdd/gotchas.md` for a new trap, both catalogs (D-1243).
Decision blocks (§16.2): R206 D-1247..D-1249, R207 D-1250..D-1252, R208 D-1253..D-1255, R209 D-1256..D-1258, R210 D-1259..D-1261, R211 D-1262..D-1264, R212 D-1265..D-1267, R213 D-1268..D-1270, R214 D-1271..D-1273, R215 D-1274..D-1276,
R216 D-1277..D-1279, R217 D-1280..D-1282, R218 D-1283..D-1285, R219 D-1286..D-1288, R220 D-1289..D-1291, R221 D-1292..D-1294, R222 D-1295..D-1297, R223 D-1298..D-1300, R224 D-1301..D-1302, R225 D-1303..D-1305.

- [ ] **R206 — The controls' look lives in the design system**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-DS-10, FR-DS-13, FR-CTRL-1, FR-CTRL-2, FR-CTRL-3, FR-CTRL-6, FR-CTRL-11, FR-CTRL-12, FR-CTRL-14; D-1224, D-1225, D-1226, D-1227, D-1228, D-1243
  - **Goal:** every page shows outlined buttons, filled options and blue section rules from one set of tokens, `Tag`, `Close` and `StatusLine` exist, and `dev/primitives.html` shows each primitive in every state in both themes.
  - **Satisfies:** FR-DS-10, FR-DS-13, FR-DS-14's first wave, FR-CTRL-1, FR-CTRL-2, FR-CTRL-3, FR-CTRL-6, FR-CTRL-11; the primitive halves of FR-CTRL-12 (`Close`), FR-CTRL-14 (`Tag`) and FR-CTRL-17 (`StatusLine`, the disabled form, the focus ring)
  - **Scope:** `src/ui/styles/tokens.css` (D-1225), `scripts/contrast.ts`'s pairs.
    `TextButton` (box, `box="accent"`), `OptionToggle`, `ToggleGroup`, `BracketLink`, `SectionHeading` and their CSS and tests (D-1226); `Tag`, `Close`, `StatusLine` with tests and manifest rows (D-1228); `dev/primitives.*` and `manifest.ts`'s `states` (D-1227); `tests/e2e/design-captures.spec.ts`'s forced states; `docs/DESIGN.md` by `npm run design:guide`.
  - **Deletes:** the primitives' bracket assertions in their own tests, rewritten in place
  - **Captures:** the four `design` files re-shot by `npm run design:captures`, every state shown
  - **Out of scope:** `Field`, `busy` and the other new primitives (R209); any caller's label or layout.
  - **Done when:** `npm run check` green; each primitive test covers its forms (the box and the `--tap` hit area on compact, `aria-pressed`, `Close`'s name in both languages, `Tag` never a control, `StatusLine`'s roles); `tests/styles/tokens.test.ts` and `targets.test.ts` green; `npm run design:captures` writes the four files with every state; `npm run check:sdd` green.

- [ ] **R207 — A new version is looked for within minutes**
  - **Lane:** data
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-UPD-1, FR-OFF-1; D-1236, D-1243
  - **Goal:** an open tab calls the service worker's `update()` on load, when it comes back into view and every 30 minutes while visible, so a deployed release is downloaded within minutes.
  - **Satisfies:** FR-UPD-1
  - **Scope:** `src/state/serviceWorker.ts`'s `watchForUpdates` and `UPDATE_POLL_MIN` (D-1236), its call where the worker is registered, `serviceWorker.test.ts`; `docs/sdd/reference/build-and-deploy.md`'s line on updates.
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** where the bar is drawn (R215).
  - **Done when:** `npm run check` green; the unit test with fake timers shows `update()` once on register, once per visible change, every 30 min while visible and never while hidden; `npm run check:sdd` green.

- [ ] **R208 — The desk plays on opening**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-STRIP-4, FR-LAND-2, FR-LIVE-9; D-1233, D-1243
  - **Goal:** on wide `#live` opens on the globe at real time running at 1×, a pass page opens playing at 60× from the rise and loops with a 2 s hold at the set; a `t` in the hash or reduced motion opens paused.
  - **Satisfies:** FR-STRIP-4, FR-LAND-2
  - **Scope:** `components/sky/time/usePlayback.ts`'s `opening` (D-1233) and its test; `screens/Live.tsx`'s wide opening; the pass page's opening.
  - **Touches outside the lane:** `src/ui/screens/PassDetail.tsx`
  - **Deletes:** the e2e and unit assertions that a wide page opens paused, rewritten in place
  - **Captures:** none
  - **Out of scope:** the strip and `● back to live` (R213); the play button's words (R213).
  - **Done when:** `npm run check` green; `usePlayback.test.ts` covers the three openings, the loop's hold and its end at the first pause; an e2e at 1280 × 800 sees the live clock advance by real seconds and the pass page's instant pass the rise; `npm run check:sdd` green.

- [ ] **R209 — Every control is a primitive**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R206
  - **Reads:** FR-DS-11, FR-DS-2, FR-CTRL-4, FR-CTRL-7, FR-CTRL-9, FR-CTRL-15, FR-CTRL-16; D-1226, D-1227, D-1228, D-1229, D-1243
  - **Goal:** `Field` is FR-CTRL-7's box, a busy button keeps its size, `PickRow`, `Disclosure`, `ZoomKeys` and `SettingRow` exist with their gallery states, and two tests hold every `<button>`, `<a>`, `<input>` and bracket outside the primitives to a list that only shrinks.
  - **Satisfies:** FR-DS-11 (the primitives and the ratchet), FR-DS-2 as amended, FR-X-6 as amended; the primitive halves of FR-CTRL-4 (`busy`), FR-CTRL-7 (the input), FR-CTRL-9, FR-CTRL-15, FR-CTRL-16's disclosure, FR-DS-12's `SettingRow`
  - **Scope:** `Field` and `TextButton`'s `busy` (D-1226); the four primitives, their CSS and tests, `manifest.ts` rows, `dev/primitives.tsx` (D-1228); `tests/styles/controls.test.ts`, `controls.allow.json`, the bracket rule in `literals.ts` and `brackets.allow.json`, seeded at the day's counts (D-1229); `docs/DESIGN.md` regenerated.
  - **Deletes:** none
  - **Captures:** the four `design` files re-shot with the new rows
  - **Out of scope:** using the primitives on a page (R212 onward).
  - **Done when:** `npm run check` green; a test per primitive form, `aria-busy` with the width unchanged among them; the ratchet test fails on a file raised over its count and on a lowered file whose entry was not lowered (two fixture cases); `npm run check:sdd` green.

- [ ] **R210 — The events follow the live page**
  - **Lane:** physics
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R206
  - **Reads:** FR-MEAS-2, FR-MEAS-6; D-1242, D-1243
  - **Goal:** the closed list accepts `watch`, and `npm run funnel` reads first-visit `open` on `live` as its base, with a `watch` row and no `door` row.
  - **Satisfies:** FR-MEAS-2 and FR-MEAS-6 as amended (the list and the funnel)
  - **Scope:** `src/model/measure.ts`'s `EVENTS`, `scripts/funnel.ts` and their tests (D-1242); `docs/sdd/reference/data-model.md`'s event list.
  - **Deletes:** the funnel test's `door` row
  - **Captures:** none
  - **Out of scope:** removing `door` (R212); sending `watch` (R213) and `where_shown` (R215).
  - **Done when:** `npm run check` green; the route and the sender accept `watch` with no detail; the funnel's test prints the new rows; `npm run check:sdd` green.

- [ ] **R211 — The dome and the polar chart are dark at noon; the glow goes**
  - **Lane:** chart
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R206
  - **Reads:** FR-DARK-1, FR-DARK-2, FR-DARK-4, FR-DOME-6; D-1234, D-1235, D-1243
  - **Goal:** at noon the dome and the polar chart draw the deep sky with every star rung and the Sun's dot, and the settings page has no sun-glow row.
  - **Satisfies:** FR-DARK-1 and FR-DARK-2 for the dome and the polar chart, FR-DARK-4
  - **Scope:** `skychart/dome/**`, `skychart/polar/**`, the Sun-thinning helper (D-1234); the glow and `sunGlow` (D-1235).
  - **Touches outside the lane:** `src/ui/screens/Settings.tsx` (the row), `src/model/prefs.ts`, `src/state/slices/prefs.ts`, `src/data/localPrefs.ts` (D-1235)
  - **Deletes:** the glow's tests and the settings row's test; the tests that thin stars by the Sun, rewritten to every rung
  - **Captures:** none
  - **Out of scope:** the window (R214); deleting the two tokens (R214).
  - **Done when:** `npm run check` green; a unit test of each view at a Sun altitude of +40° shows the deep surface and the faintest rung; a stored `sunGlow` is ignored on load and absent after a save; `npm run check:sdd` green.

- [ ] **R212 — The live page is the first page**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R209, R210
  - **Reads:** FR-LAND-1, FR-LAND-6, FR-LAND-7, FR-CLEAN-14; US-62 AC1; D-1230, D-1231, D-1242, D-1245, D-1246, D-1243
  - **Goal:** `/`, `/#` and an unknown hash open `#live` with no history entry; the home is gone; on compact `#pass` lists tonight's passes and a card opens the pass sheet.
  - **Satisfies:** FR-LAND-1, FR-LAND-6 (the pages behind the links), FR-LAND-7; FR-FLOW-1, FR-PHONE-12, FR-FIRST-5, FR-OPEN-3 removed; US-62 AC1
  - **Scope:** `App.tsx`'s route reader, `routeTitle`, `openedRoute` (D-1230); `Home.tsx`, `screens/home/**`, `ExampleBand` deleted, `shownPasses.ts` and `useNight.ts` moved (D-1231); `screens/sky/pass/Empty.tsx`'s compact list; `door` deleted with its sender (D-1242); the `home` budget row (D-1246); `captureSet.ts`'s home names (D-1245).
  - **Touches outside the lane:** `src/model/measure.ts`
  - **Deletes:** `home.spec.ts`, `home-desk.spec.ts`, `Home*.test.tsx`, `ExampleBand.test.tsx`, `HomeDoors.test.tsx`, `doorLines.test.ts`, the home cases of `firstRun.spec.ts` and `examplePages.spec.ts` (each re-pointed at `#live` where it tests the example)
  - **Captures:** none (the manifest's home entries removed)
  - **Out of scope:** the header's links and place line (R215); the strip (R213).
  - **Done when:** `npm run check` and `npm run check:dead` green; `landing.spec.ts` covers `/`, `/#`, `/#nope` at 390 × 844 and 1280 × 800 (`history.length` unchanged); the compact `#pass` e2e opens a card's sheet; `npm run check:sdd` green.

- [ ] **R213 — The next pass is a strip, not a question**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R208, R209, R210
  - **Reads:** FR-STRIP-1, FR-STRIP-2, FR-STRIP-3, FR-STRIP-5, FR-STRIP-6, FR-DARK-3; US-63; D-1232, D-1242, D-1243
  - **Goal:** the live page always shows the next-pass strip; `▶ watch` plays the pass, `● back to live` returns to now; no card or dialog opens; play is one `▶ play` / `❚❚ pause` button and the time line ends with `● live` or the offset; by day the context line says satellites show after dusk.
  - **Satisfies:** FR-STRIP-1, FR-STRIP-2, FR-STRIP-3, FR-STRIP-5, FR-STRIP-6, FR-DARK-3; FR-FULL-10, FR-WIDE-13, FR-TONIGHT-1 removed; US-63; `watch`'s sender (FR-MEAS-2)
  - **Scope:** `src/lib/nextPassStrip.ts`, `components/live/NextPassStrip.tsx` (on compact at the box's foot with `[example] <city>`; on wide in the rail's head slot as it stands), `OpeningCard.tsx` and the automatic landing deleted (D-1232); `components/sky/time/PlaybackControls.tsx`, `ShownTime.tsx`; the catalogs' `live` section.
  - **Touches outside the lane:** `src/ui/components/sky/FirstPassDialog.tsx` (deleted)
  - **Deletes:** `live-dialog.spec.ts`, `FirstPassDialog.test.tsx`, `OpeningCard.test.tsx`, the automatic-jump cases of `live-tonight.spec.ts`
  - **Captures:** none (the manifest's dialog and card entries removed)
  - **Out of scope:** the rail's order (R216) and `Up now` (R219).
  - **Done when:** `npm run check` green; `nextPassStrip.test.ts`; `live-strip.spec.ts` walks US-63 AC1–AC3 at 390 × 844 and 1280 × 800; a test that `watch` is sent once per visit; a noon e2e sees the day line and a night one does not; `npm run check:sdd` green.

- [ ] **R214 — The window: dark at noon, zoom keys under the box**
  - **Lane:** window
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R209, R211
  - **Reads:** FR-DARK-1, FR-DARK-2, FR-CTRL-9; D-1234, D-1241, D-1243
  - **Goal:** at noon the window draws the deep sky with every rung and the Sun's dot; `−`, `+` and `⟲` sit under the box at its left and zoom as the wheel and pinch do; the hint shows until the first drag or zoom; the facing control is a primitive.
  - **Satisfies:** FR-DARK-1 and FR-DARK-2 for the window (the tokens deleted), FR-CTRL-9 for the window
  - **Scope:** `skychart/window/**` (`SkyWindow.tsx`, `StarField.tsx`, `FacingPicker.tsx`'s hit area as a primitive); `--chart-sky-day`, `--chart-sky-twilight` and their `contrast.ts` rows deleted (D-1234); the zoom slot under the box and the hint's key (D-1241); `controls.allow.json`'s window entries lowered.
  - **Touches outside the lane:** `src/ui/components/sky/SkyViewLayout.tsx` (the zoom slot)
  - **Deletes:** the window's Sun-tint tests, rewritten to one surface
  - **Captures:** none
  - **Out of scope:** the globe's keys (R217).
  - **Done when:** `npm run check` green; a window test at +40° Sun; an e2e presses `+`, `−` and `⟲` and reads the field of view each time, and sees the hint gone after one drag and still gone after a reload; `npm run check:sdd` green.

- [ ] **R215 — The place is one line in the header**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R212
  - **Reads:** FR-LAND-4, FR-LAND-6, FR-CTRL-5, FR-UPD-2; US-62 AC2; D-1237, D-1238, D-1242, D-1243
  - **Goal:** every page's header reads `Salta · example  change`, the place's name with `change`, or `Set your place`; `change` opens the place dialog; the header's links are `live`, `satellites`, `settings` with the current page underlined; the update bar shows under the header on every page.
  - **Satisfies:** FR-LAND-4, FR-LAND-6 (the links), FR-CTRL-5, FR-UPD-2; FR-OPEN-4, FR-OPEN-5, FR-OPEN-7, FR-CLEAN-14, FR-COMP-1, FR-OFF-1 as amended; US-62 AC2 (the header); `where_shown` (FR-MEAS-2)
  - **Scope:** `Header.tsx` and its CSS (D-1238), `location/PlaceDialog.tsx`, the satellites list's head; `Shell.tsx`'s update slot and `UpdateBanner` (D-1237); `ExampleNotice.tsx` and `placeRequest.ts` deleted; the catalogs' header keys.
  - **Deletes:** `ExampleNotice.test.tsx`, the header tests of the bracketed links, rewritten
  - **Captures:** none
  - **Out of scope:** the place group's own controls (R218); the sheet's head (R219); the live page's no-place box (R221).
  - **Done when:** `npm run check` green; `Header.test.tsx` covers the three readings; `PlaceDialog.test.tsx` sets a place each of three ways and sees the dialog close; the compact header holds the mark and three links in 36 cells (`breakpoint.test.ts`); `update.spec.ts` sees the bar within 10 s on `#live`, `#pass` and `#settings`; `npm run check:sdd` green.

- [ ] **R216 — The live rail, in order**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R213, R214
  - **Reads:** FR-NOW-1, FR-CTRL-10, FR-WIDE-1; D-1239, D-1243
  - **Goal:** at a desk the rail reads strip, `View` with `share`, `Time`, `Layers`, then today's legend and status in their slot, and scrolls as one column with no list capped; the phone's sheet holds the same groups in the same order.
  - **Satisfies:** FR-NOW-1, FR-CTRL-10 for the rail, FR-WIDE-1 as amended
  - **Scope:** `SkyViewLayout`'s `SLOT_ORDER` with an `upNow` slot and the cap removed (D-1239); `screens/sky/live/**`; `Hidden objects` into `Layers`, `scrub the night` and `see this pass` as buttons in `Time`; `ControlsSheet`'s order.
  - **Touches outside the lane:** `src/ui/components/sky/SkyViewLayout.tsx`, `src/ui/components/sky/ControlsSheet.tsx`
  - **Deletes:** `live-rail.spec.ts` and `sheetRows.test.ts` rewritten to the new order
  - **Captures:** none
  - **Out of scope:** `Up now` and the rows (R219); `Turn` and `Up from` (R221).
  - **Done when:** `npm run check` green; `live-rail.spec.ts` at 1280 × 800 reads the groups in order and finds no scrolling element inside the rail; the compact sheet's order at 390 × 844; `npm run check:sdd` green.

- [ ] **R217 — The globe's zoom keys and the legend's rows**
  - **Lane:** chart
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R214
  - **Reads:** FR-CTRL-9, FR-CTRL-14, FR-CTRL-15; D-1229, D-1241, D-1243
  - **Goal:** the globe carries the same three keys under the box as the window, sharing its hint; a satellite in the legend is a row you pick with a blue line; the chart's cloud and Moon labels are tags.
  - **Satisfies:** FR-CTRL-9 for the globe; FR-CTRL-15 for the legend; FR-CTRL-14 inside `skychart/`
  - **Scope:** `globe/SkyGlobe.tsx`'s zoom steps and `ZoomKeys` in the zoom slot (D-1241); `Legend.tsx` rows as `PickRow`, the accent names gone; the chart's tags; `controls.allow.json` and `brackets.allow.json` entries under `skychart/` lowered to zero.
  - **Deletes:** the legend's accent-name assertions, rewritten
  - **Captures:** none
  - **Out of scope:** the window (R214).
  - **Done when:** `npm run check` green; `globe.spec.ts` presses the three keys and reads the zoom; `legend-hover.spec.ts` sees the picked row's line and `aria-pressed`; no allow-list entry left under `skychart/`; `npm run check:sdd` green.

- [ ] **R218 — The place group's controls**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R215
  - **Reads:** FR-CTRL-4, FR-CTRL-7, FR-CTRL-8, FR-CTRL-17, FR-DS-12; US-65 AC3, AC4; D-1226, D-1243
  - **Goal:** `Use my location` keeps its width while it searches and says its progress and its error on one line under it; the suggestion list lines up with the input; saved places are rows, the one in use picked; the dialog's rows keep one rhythm.
  - **Satisfies:** FR-CTRL-4, FR-CTRL-7, FR-CTRL-8, FR-CTRL-17 for the place group, FR-DS-12 for the place dialog; US-65 AC3, AC4
  - **Scope:** `location/{UseMyLocation,PlacePicker,LocationInput,Favourites}.tsx` and CSS; the placeholder in both catalogs; `controls.allow.json` and `brackets.allow.json` entries under `location/` lowered to zero.
  - **Deletes:** `UseMyLocation`'s own error-style test, rewritten to `StatusLine`
  - **Captures:** none
  - **Out of scope:** the header and the dialog's frame (R215).
  - **Done when:** `npm run check` green; a component test that the button's box is the same width before, during and after; `place-search.spec.ts` measures the list's left edge and width against the input's; `favourites.spec.ts` sees the picked row; `npm run check:sdd` green.

- [ ] **R219 — What is up now, as rows**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R215, R216
  - **Reads:** FR-NOW-2, FR-NOW-3, FR-LAND-4; US-65 AC9; D-1238, D-1239, D-1243
  - **Goal:** the rail's `Up now` lists the satellites up, then the Moon and the Sun with direction and height in aligned columns, then `Clouds` and `Moon` as rows; with none up it reads `No satellite up`; on the phone the controls sheet opens on the place line.
  - **Satisfies:** FR-NOW-2, FR-NOW-3, FR-LAND-4's compact sheet head; US-65 AC9
  - **Scope:** `src/lib/upNow.ts`, `components/live/UpNow.tsx` in the `upNow` slot; `StatusStrip.tsx` deleted; `ControlsSheet`'s head with `Header`'s place line (D-1238); `controls.allow.json`'s entries for the live rail lowered.
  - **Touches outside the lane:** `src/ui/components/sky/ControlsSheet.tsx`
  - **Deletes:** `StatusStrip.test.tsx`
  - **Captures:** none
  - **Out of scope:** the rail's order (R216); the stars' groups (R221).
  - **Done when:** `npm run check` green; `upNow.test.ts` (the 16 compass boundaries, below-horizon rows, the order) and `UpNow.test.tsx`; `live-rail.spec.ts` at 1280 × 800 with nothing up and with a pass up, the Moon's and the Sun's rows at the column's left edge; the sheet's first line at 390 × 844 with the example and with a place; `npm run check:sdd` green.

- [ ] **R220 — Rows you pick, tags and disclosures in the pass lists**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R218
  - **Reads:** FR-CTRL-14, FR-CTRL-15, FR-CTRL-16; US-65 AC6; D-1229, D-1243
  - **Goal:** a pass card or list row has no frame, a hover ground and, picked, a blue line at its left; `[twilight]`, `[faint]`, the cloud tags and the banners' tags are tags; the night groups open with `▸ Tonight · 3`.
  - **Satisfies:** FR-CTRL-14, FR-CTRL-15 and FR-CTRL-16's disclosure for `components/passes/**`, `components/now/**`, `components/guide/**` (not `skychart/`) and `common/Banner.tsx`; US-65 AC6
  - **Scope:** those modules and `Card`'s `selected` frame removed; their entries in both allow lists lowered to zero.
  - **Deletes:** `Card`'s `selected` tests and the night toggle's `[+]` tests, rewritten
  - **Captures:** none
  - **Out of scope:** closes, inline actions and the rest (R222).
  - **Done when:** `npm run check` green; `pass-list.spec.ts` sees the picked row's line and `aria-current`; a test that a `Tag` has no role and no hover; no allow-list entry left for the modules named; `npm run check:sdd` green.

- [ ] **R221 — The stars fold into live**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R215, R219
  - **Reads:** FR-LAND-3, FR-LAND-5, FR-STAR-3, FR-CTRL-16; US-62 AC2, AC3; D-1240, D-1246, D-1243
  - **Goal:** `#stars` opens `#live`, whose rail gains `Turn` (wide), the stars' layers and `Up from <place>`; with no place and no example the sky's box holds the place group; the step buttons and the time row are primitives.
  - **Satisfies:** FR-LAND-3, FR-LAND-5, FR-STAR-3 and FR-FIRST-1 as amended, FR-CTRL-15 for `Up from`, FR-CTRL-16's step buttons; US-62 AC2 (no city), AC3
  - **Scope:** the stars' groups into `components/live/` and `screens/sky/live/**` (D-1240); `#stars…` rewritten to `#live`; `Live.tsx`'s no-place branch; `components/sky/time/**`'s step buttons and times row; the `stars` budget row (D-1246); `captureSet.ts`'s stars names; `controls.allow.json` entries under the live lane lowered to zero.
  - **Touches outside the lane:** `src/ui/screens/Stars.tsx`, `StarsRoute.ts`, `starsChunk.ts`, `screens/stars/**`, `screens/sky/stars/**` (deleted, D-1240)
  - **Deletes:** `Stars.test.tsx`, `StarsGlobe.test.tsx`, the stars page's e2e cases (moved to `#live` where they test a layer)
  - **Captures:** none (the manifest's stars entries removed)
  - **Out of scope:** the rail's other groups (R216, R219).
  - **Done when:** `npm run check` and `npm run check:dead` green; `landing.spec.ts` gains `#stars` and `#stars?<params>`; an e2e toggles each layer on `#live` at 1280 × 800 and 390 × 844; the no-place e2e sees the place group in the box; `npm run check:sdd` green.

- [ ] **R222 — One close, links in a line, one feedback**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R220, R221
  - **Reads:** FR-CTRL-12, FR-CTRL-13, FR-CTRL-16, FR-CTRL-17, FR-DS-11; US-65 AC5; D-1229, D-1243
  - **Goal:** every close is the same `×`, every action inside a line of text is an underlined blue link, every standalone button is a box, `follow` is an option, every form says progress and failure the same way; no `<button>`, `<a>` or `<input>` and no bracket is left outside the primitives.
  - **Satisfies:** FR-CTRL-12, FR-CTRL-13, FR-CTRL-16, FR-CTRL-17; FR-DS-11's end state; US-65 AC5
  - **Scope:** the pass panel, `facts/**`, full screen's exit, `ControlsSheet`, `ShortcutsOverlay`, the link note, `InstallHint`, `RootBoundary`, `AskDialog`'s frame (FR-CTRL-17), `ShareButton`, `FollowToggle`, the inline actions; `controls.allow.json` and `brackets.allow.json` left `{}`.
  - **Deletes:** the bracketed-close assertions, rewritten
  - **Captures:** none
  - **Out of scope:** the settings page's rhythm (R223).
  - **Done when:** `npm run check` green; both allow lists are `{}`; a test that every close in the app is `Close` with its name in both languages; `npm run check:sdd` green.

- [ ] **R223 — One rhythm on every page**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R222
  - **Reads:** FR-DS-12, FR-CTRL-10; US-65 AC7, AC8; D-1243
  - **Goal:** the settings page's groups are `SettingRow`s with equal heights and gaps, labels in one column; every group starts at the column's left edge; no scrolling element sits in another on any page.
  - **Satisfies:** FR-DS-12, FR-CTRL-10; US-65 AC7, AC8
  - **Scope:** `Settings.tsx` and its CSS, the pass rail's groups, any page the walk fails on; `rhythm.spec.ts`, `one-scroll.spec.ts`.
  - **Deletes:** `controlRows.test.ts` cases the rhythm test supersedes, named in the PR
  - **Captures:** none
  - **Out of scope:** the documents (R224).
  - **Done when:** `npm run check` green; `rhythm.spec.ts` measures the settings page's browser group and the rails at 1280 × 800 and 390 × 844, equal to the pixel; `one-scroll.spec.ts` walks every page at 1280 × 800, 1024 × 700 and 390 × 844; `npm run check:sdd` green.

- [ ] **R224 — The documents describe 3.0**
  - **Lane:** docs
  - **Tier:** light
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R217, R222
  - **Reads:** D-1243, D-1244
  - **Goal:** no document outside the history still describes the home page, the `#stars` route, the bracketed controls, the sun glow or the first-pass question, and a test keeps it so.
  - **Satisfies:** D-1244's sweep (the definition of done)
  - **Scope:** `README.md`, `docs/RELEASE.md`, `docs/DESIGN.md`, `docs/HOW-THIS-WAS-BUILT.md`, `docs/sdd/glossary` and the reference pages, `docs/sdd/map.md`, every screenshot reference to a removed capture; `tests/docs/stale.test.ts` (D-1244).
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** the version, the budget and the record (R225).
  - **Done when:** `tests/docs/stale.test.ts` green and failing on a planted `#stars`; `npm run check:sdd` and `tests/docs/**` green.

- [ ] **R225 — 3.0.0**
  - **Lane:** docs
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R223, R224
  - **Reads:** the definition of done of §4.67; D-1244, D-1245, D-1246, D-178
  - **Goal:** `main` reads 3.0.0 with the capture set re-shot, every budget row re-set, the README's version and pictures current and the release record written; the tag and the deploy are left to the owner.
  - **Satisfies:** FR-DS-14 (the set re-shot, the moves listed); the definition of done (the captures, the budget, the funnel's comparison set up, `package.json` 3.0.0, the sweep's test green)
  - **Scope:** `docs/sdd/workflows/release.md`'s steps; `tests/e2e/{captureSet,v1-captures}.ts`, `docs/screenshots/**`, `scripts/bundle-budget.ts` (D-1246), `README.md`'s version and hero, `package.json` and the lockfile's root, `docs/sdd/phases/v3.0/release.md` with the moves by requirement, the gallery and the pages to check by hand (FR-DS-14) and `npm run funnel`'s two windows (V30-22).
  - **Deletes:** none
  - **Captures:** the whole set re-shot (D-1245)
  - **Out of scope:** the tag, the deploy, the `captures.yml` runs and the device runs (the owner's).
  - **Done when:** `npm run check` and `npm test` green; `npm run bundle:budget` green with every row explained; `tests/docs/accuracy.test.ts` points at the record; `tests/docs/stale.test.ts` green; `npm run check:sdd` green.

Waves: **wave 1** R206, R207, R208; **wave 2** R209, R210, R211; **wave 3** R212, R213, R214; **wave 4** R215, R216, R217; **wave 5** R218, R219; **wave 6** R220, R221; **wave 7** R222; **wave 8** R223, R224; **wave 9** R225.
