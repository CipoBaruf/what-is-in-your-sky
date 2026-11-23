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
| v3.0 | R206 … R227 | 0 of 22 | this file |

## v3.0 tasks

Cut 2026-11-21 from the phase folder `docs/sdd/phases/v3.0/` (`spec.md` §2.24, §4.61–§4.67, Phase 2z; `plan.md` §2.55, §8.22, §9.19, §11.11, §16.38).
Spec Phase 2z, "the sky first": the live sky is the first page at both widths, the home goes and the stars fold into live, the next pass is a strip, the sky is dark at every hour, every control has one look per role, and a new version is said on every page (V30-1..V30-32).
Delivery is PLAN §16.38: twenty-two tasks in nine waves, the design system first (waves 1 and 2, D-1224), every task on Opus but the documents' sweep on Sonnet (no `fable` without usage credits), every task `Gate: auto` and merged by the driver; the tag `v3.0.0` and the deploy are the owner's.
Every task updates the documents its change touches: `docs/sdd/map.md`, the reference pages, `docs/sdd/gotchas.md` for a new trap, both catalogs (D-1243).
Decision blocks (§16.2): R206 D-1247..D-1249, R207 D-1250..D-1252, R208 D-1253..D-1255, R209 D-1256..D-1258, R210 D-1259..D-1261, R211 D-1262..D-1264, R212 D-1265..D-1267, R213 D-1268..D-1270,
R214 D-1271..D-1273, R215 D-1274..D-1276, R216 D-1277..D-1279, R217 D-1280..D-1282, R218 D-1283..D-1285, R219 D-1286..D-1288, R220 D-1289..D-1291, R221 D-1292..D-1294,
R222 D-1295..D-1297, R223 D-1298..D-1300, R224 D-1301..D-1303, R225 D-1304..D-1306, R226 D-1307..D-1308, R227 D-1309..D-1311.

- [x] **R206 — The controls' look lives in the design system**
  - **Done 2026-11-22:** the footer's one line holds no primitive and measured the same as on the parent, so its literals stand; the mouse's drag hint now fits beside the controls; D-1247..D-1249.
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-DS-10, FR-DS-13, FR-CTRL-1, FR-CTRL-2, FR-CTRL-3, FR-CTRL-6, FR-CTRL-11; D-1224, D-1225, D-1226, D-1227, D-1243
  - **Goal:** every page shows outlined buttons, filled options and blue section rules from one set of tokens, and `dev/primitives.html` shows each existing primitive in every state in both themes.
  - **Satisfies:** FR-DS-10, FR-DS-13, FR-DS-14's first wave, FR-CTRL-1, FR-CTRL-2, FR-CTRL-3, FR-CTRL-6, FR-CTRL-11; FR-CTRL-17's disabled form and focus ring
  - **Scope:** `src/ui/styles/tokens.css` (D-1225) and `scripts/contrast.ts`'s pairs.
    `TextButton` (box, `box="accent"`), `OptionToggle`, `ToggleGroup`, `BracketLink`, `SectionHeading`, their CSS and tests (D-1226); `dev/primitives.*`, `manifest.ts`'s `states`, `tests/e2e/design-captures.spec.ts`'s forced states (D-1227); `docs/DESIGN.md` by `npm run design:guide`.
    The widths the brackets were counted in, measured again: `tests/styles/cells.ts`, `controlRows.test.ts`, `breakpoint.test.ts`, the compact header's 36 cells, the footer's one line; any test elsewhere asserting `[x]` or `[ … ]` from these primitives.
  - **Deletes:** the primitives' bracket assertions, rewritten in place
  - **Captures:** the four `design` files re-shot by `npm run design:captures`, every state shown
  - **Out of scope:** `Field`, `busy` and the new primitives (R209); any caller's label or layout.
  - **Done when:** `npm run check` green; each primitive's test covers its forms (the box and the `--tap` hit area on compact, `aria-pressed`); `tokens.test.ts`, `targets.test.ts` and the width tests green; `npm run design:captures` writes the four files; `npm run check:sdd` green.

- [x] **R207 — A new version is looked for within minutes**
  - **Lane:** data
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-UPD-1; D-1236, D-1243
  - **Goal:** an open tab calls the service worker's `update()` on load, when it comes back into view and every 30 minutes while visible.
  - **Satisfies:** FR-UPD-1
  - **Scope:** `src/state/serviceWorker.ts`'s `watchForUpdates` and `UPDATE_POLL_MIN` (D-1236), its call where the worker is registered, its test; `docs/sdd/reference/build-and-deploy.md`'s line on updates.
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** the bar (R212, R220).
  - **Done when:** `npm run check` green; the unit test with fake timers shows `update()` once on register, once per visible change, every 30 min while visible and never while hidden; `npm run check:sdd` green.
  - **Done 2026-11-22:** build and deploy had no line on updates, so one was added (and data-layer §7.7's); three e2e fake registrations gain `update()`; D-1250, D-1251.

- [x] **R208 — The desk plays on opening**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** —
  - **Reads:** FR-STRIP-4, FR-LAND-2, FR-LIVE-9; D-1233, D-1243
  - **Goal:** on wide `#live` opens on the globe at real time running at 1×, a pass page opens at 60× from the rise and loops with a 2 s hold at the set; a `t` in the hash or reduced motion opens paused; on compact `#live` opens on the window; a stored view wins at both widths.
  - **Satisfies:** FR-STRIP-4, FR-LAND-2
  - **Scope:** `components/sky/time/usePlayback.ts`'s `opening` (D-1233) and `usePlayback.test.tsx`; `screens/Live.tsx`'s opening; the pass page's opening.
  - **Touches outside the lane:** `src/ui/screens/PassDetail.tsx`
  - **Deletes:** the assertions that a wide page opens paused, rewritten in place
  - **Captures:** none
  - **Out of scope:** the strip and the play button's words (R213).
  - **Done when:** `npm run check` green; `usePlayback.test.tsx` covers the three openings, the loop's hold and its end at the first pause; `landing.spec.ts` (new) sees the wide globe with the clock advancing by real seconds, the compact window, and a stored `Window` winning on wide; the pass page's instant passes the rise; `npm run check:sdd` green.

- [x] **R209 — Every control is a primitive** (the bracket ratchet also reads CSS `content`, D-1257)
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R206
  - **Reads:** FR-DS-11, FR-DS-2, FR-CTRL-4, FR-CTRL-7, FR-CTRL-12, FR-CTRL-14, FR-CTRL-15, FR-CTRL-17; D-1226, D-1227, D-1228, D-1229, D-1243
  - **Goal:** `Field` is FR-CTRL-7's box, a busy button keeps its size, `Tag`, `Close`, `StatusLine`, `PickRow`, `Disclosure` and `SettingRow` exist with their gallery states, and the ratchets hold every `<button>`, `<a>`, `<input>` and bracket outside the primitives to per-lane lists.
  - **Satisfies:** FR-DS-11 (the primitives and the ratchet), FR-DS-2 as amended, FR-X-6 as amended; the primitive halves of FR-CTRL-4, FR-CTRL-7, FR-CTRL-12, FR-CTRL-14, FR-CTRL-15, FR-CTRL-16's disclosure, FR-CTRL-17's status line, FR-DS-12's `SettingRow`
  - **Scope:** `Field` and `TextButton`'s `busy` (D-1226); the six primitives, their CSS, tests and manifest rows, `dev/primitives.tsx` (D-1228); `tests/styles/controls.test.ts`, the bracket rule in `literals.ts`, `tests/styles/allow/<lane>.{controls,brackets}.json` seeded at the day's counts (D-1229); `docs/DESIGN.md`; any test elsewhere asserting the old `Field` render.
  - **Deletes:** none
  - **Captures:** the four `design` files re-shot with the new rows
  - **Out of scope:** `ZoomKeys` (R214); using the primitives on a page (R212 onward).
  - **Done when:** `npm run check` green; a test per primitive form (`aria-busy` with the width unchanged, `Close`'s name in both languages, `Tag` never a control, `StatusLine`'s roles, `PickRow`'s `aria-current`, `Disclosure`'s `aria-expanded`); the ratchet fails on a raised count and passes on a lowered one (fixture cases), and ignores `<abbr>`, `<aside>`, `<article>`; `npm run check:sdd` green.

- [x] **R210 — The events follow the live page**
  - **Done 2026-11-22:** `data-model.md` had no event list, so the task wrote it; D-1259, D-1260.
  - **Lane:** physics
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R206
  - **Reads:** FR-MEAS-2, FR-MEAS-6; D-1242, D-1243
  - **Goal:** the closed list accepts `watch`, and `npm run funnel` reads first-visit `open` on any route as its base, with a `watch` row and no `door` row.
  - **Satisfies:** FR-MEAS-2 and FR-MEAS-6 as amended (the list and the funnel)
  - **Scope:** `src/model/measure.ts`'s `EVENTS`, `scripts/funnel.ts` and their tests (D-1242); `docs/sdd/reference/data-model.md`'s event list.
  - **Deletes:** the funnel test's `door` row
  - **Captures:** none
  - **Out of scope:** removing `door` (R212); sending `watch` (R213) and `where_shown` (R215).
  - **Done when:** `npm run check` green; the route and the sender accept `watch` with no detail; the funnel's test prints the new rows from a fixture spanning 2.16 and 3.0 events; `npm run check:sdd` green.

- [x] **R211 — The dome, the polar chart and the globe are dark at noon; the glow goes**
  - **Done 2026-11-22:** the rung cut is deleted rather than left constant, and the globe's day cut and fade go with it; the stars page's and the door's eye-based lines read the Sun; the settings page's one-row allowance goes with the row; D-1262..D-1264.
  - **Lane:** chart
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R206
  - **Reads:** FR-DARK-1, FR-DARK-2, FR-DARK-4; US-64 AC1, AC3; D-1234, D-1235, D-1243
  - **Goal:** at noon the dome, the polar chart and the globe draw the deep sky with every star rung and the Sun's dot, and the settings page has no sun-glow row.
  - **Satisfies:** FR-DARK-1 and FR-DARK-2 for the dome, the polar chart and the globe, FR-DARK-4, FR-LOOK-2, FR-STAR-13, FR-SKY-3, FR-SET-5 removed; US-64 AC1 for those views, AC3
  - **Scope:** `skychart/dome/**`, `skychart/polar/**` (`PolarStars.tsx`'s `tintStep`, the two fills), `skychart/globe/{scene.ts,SkyGlobe.module.css}` (D-1234); the glow and `sunGlow` (D-1235).
  - **Touches outside the lane:** `skychart/window/SkyWindow.tsx` (the `sunGlow` prop), `src/ui/screens/Settings.tsx`, `src/i18n/{en,es}/ui.ts` (the row's keys), `src/model/prefs.ts`, `src/state/slices/prefs.ts`, `src/data/localPrefs.ts`, `src/lib/skyStars.ts` (D-1235)
  - **Deletes:** the glow's tests and the settings row's test; the tests that thin stars or tint the sky by the Sun in these views, rewritten
  - **Captures:** none
  - **Out of scope:** the window's tint and the tokens' deletion (R214).
  - **Done when:** `npm run check` green; a test of each view at a Sun altitude of +40° shows the deep surface, the faintest rung and the Sun's dot; a stored `sunGlow` is ignored on load and absent after a save; `npm run check:sdd` green.

- [ ] **R212 — The live page is the first page**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R209, R210
  - **Reads:** FR-LAND-1, FR-LAND-6, FR-LAND-7; US-62 AC1; D-1230, D-1231, D-1237, D-1242, D-1245, D-1246, D-1243
  - **Goal:** `/`, `/#` and an unknown hash open `#live` with no history entry; the home is gone; on compact `#pass` lists tonight's passes; the update bar shows under the header on every page.
  - **Satisfies:** FR-LAND-1, FR-LAND-6 (the pages behind the links), FR-LAND-7, FR-OPEN-14 as amended; US-62 AC1
  - **Scope:** `App.tsx`'s route reader, `routeTitle`, `openedRoute`, `Header.tsx`'s `NAV_PAGES` without `home` (D-1230); `Home.tsx`, `ExampleBand`, `HomeDoors`, `doorLines` deleted, the other `screens/home/` modules kept in place; `requestPlace()` opening `#settings`; `screens/sky/pass/Empty.tsx`'s compact list (D-1231); `UpdateBanner` mounted by `Shell.tsx` (D-1237); `door` and `open`'s `home` deleted (D-1242); the `home` budget row (D-1246); `captureSet.ts` and `tests/docs/captures.test.ts` for wave 3, the home's, the first-pass dialog's and the opening card's names (D-1245).
  - **Touches outside the lane:** `src/model/measure.ts`
  - **Deletes:** `home.spec.ts`, `home-desk.spec.ts`, `Home*.test.tsx`, `ExampleBand.test.tsx`, `HomeDoors.test.tsx`, `doorLines.test.ts`; the home cases of `firstRun.spec.ts`, `examplePages.spec.ts` and `exampleWait.spec.ts`, re-pointed at `#live` where they test the example
  - **Captures:** none
  - **Out of scope:** `Live.tsx` and `Stars.tsx` (never edited here); the header's place line and tabs (R215); the strip (R213).
  - **Done when:** `npm run check` and `npm run check:dead` green; `landing.spec.ts` covers `/`, `/#`, `/#nope` at 390 × 844 and 1280 × 800 with `history.length` unchanged; the compact `#pass` e2e opens a card's sheet; `update-banner.spec.ts` green on `#live`; a test that `example_shown` is sent on `#live`; `npm run check:sdd` green.

- [x] **R213 — The next pass is a strip, not a question**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R208, R209, R210
  - **Reads:** FR-STRIP-1, FR-STRIP-2, FR-STRIP-3, FR-STRIP-5, FR-STRIP-6, FR-DARK-3; US-63, US-62 AC4; D-1232, D-1242, D-1243
  - **Goal:** the live page always shows the next-pass strip; `▶ watch` plays the pass, `● back to live` returns to now; no card or dialog opens; play is one `▶ play` / `❚❚ pause` button and the time line ends with `● live` or the offset; by day the context line says satellites show after dusk.
  - **Satisfies:** FR-STRIP-1, FR-STRIP-2, FR-STRIP-3, FR-STRIP-5, FR-STRIP-6, FR-DARK-3; US-63, US-62 AC4; `watch`'s sender
  - **Scope:** `src/lib/nextPassStrip.ts`, `components/live/NextPassStrip.tsx` (on compact at the box's foot with `[example] <city>`; on wide in the rail's head slot), `components/live/OpeningCard.tsx` and the automatic landing deleted (D-1232); `components/sky/time/PlaybackControls.tsx`, `components/live/ShownTime.tsx`; `Live.tsx`; the catalogs' `live` section.
  - **Touches outside the lane:** `src/ui/components/sky/FirstPassDialog.tsx` (deleted)
  - **Deletes:** `live-dialog.spec.ts`, `FirstPassDialog.test.tsx`, `OpeningCard.test.tsx`, the automatic-jump cases of `live-tonight.spec.ts`
  - **Captures:** none (R212 removes the manifest's names)
  - **Out of scope:** the rail's order (R216); `captureSet.ts` (R212).
  - **Done when:** `npm run check` green; `nextPassStrip.test.ts`; `NextPassStrip.test.tsx` (each kind, the `[example] Salta` prefix on compact, the play button's two words, `● live` and the offset); `live-strip.spec.ts` walks US-63 AC1–AC3 and checks US-62 AC4 at 390 × 844 and 1280 × 800; `watch` sent once per visit; the day line at noon, not in twilight or at night; `npm run check:sdd` green.

- [ ] **R214 — The window: dark at noon, zoom keys under the box**
  - **Lane:** window
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R209, R211
  - **Reads:** FR-DARK-1, FR-DARK-2, FR-CTRL-9; D-1228, D-1234, D-1241, D-1243
  - **Goal:** at noon the window draws the deep sky with every rung and the Sun's dot; `−`, `+` and `⟲` sit under the box at its left and zoom as the wheel and pinch do; the hint shows until the first drag or zoom; the facing control is a primitive.
  - **Satisfies:** FR-DARK-1 and FR-DARK-2 for the window, FR-CTRL-9 for the window; US-64 AC1 for the window
  - **Scope:** `skychart/window/**` (`SkyWindow.tsx`, `StarField.tsx`, `SkyWindow.module.css`, `FacingPicker.tsx`'s hit area); `tintStep`, `SURFACE_TOKENS`, the two tokens and their `contrast.ts` rows deleted (D-1234); `primitives/ZoomKeys.tsx` with its test, manifest row and gallery row (D-1228); the zoom slot under the box and the hint (D-1241); the window lane's allow entries lowered.
  - **Touches outside the lane:** `src/ui/components/primitives/ZoomKeys.tsx`, `src/ui/components/sky/SkyViewLayout.tsx`, `src/ui/components/sky/SkyHint.tsx`, `src/ui/styles/tokens.css`, `scripts/contrast.ts`
  - **Deletes:** the window's Sun-tint tests, rewritten to one surface
  - **Captures:** none
  - **Out of scope:** the globe's keys (R217).
  - **Done when:** `npm run check` green; a window test at +40° Sun with the Sun's dot; an e2e presses `+`, `−` and `⟲` and reads the field of view each time, and sees the hint gone after one drag and after a reload; `npm run check:sdd` green.

- [ ] **R215 — The place is one line in the header**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R212
  - **Reads:** FR-LAND-4, FR-LAND-6, FR-CTRL-5; US-62 AC2; D-1238, D-1242, D-1243
  - **Goal:** every page's header reads `Salta · example  change`, the place's name with `change`, or `Set your place`; `change` opens the place dialog; the header's links are `live`, `satellites`, `settings` with the current page underlined and `← back` where a page has one.
  - **Satisfies:** FR-LAND-4 (wide and the satellites list's head), FR-LAND-6 (the links), FR-CTRL-5; FR-OPEN-4, FR-OPEN-5, FR-OPEN-7, FR-CLEAN-14, FR-COMP-1 as amended; US-62 AC2 (the header); `where_shown`
  - **Scope:** `Header.tsx` and its CSS (D-1238), `location/PlaceDialog.tsx`, the satellites list's head; `placeRequest.ts`'s `requestPlace()` opening the dialog; `ExampleNotice.tsx` deleted and its uses in `Stars.tsx`, `PassDetail.tsx`, `VisitNotice.tsx`; the catalogs' header keys.
  - **Touches outside the lane:** `src/ui/screens/Stars.tsx` (the notice's use only)
  - **Deletes:** `ExampleNotice.test.tsx`; the header tests of the bracketed links, rewritten
  - **Captures:** none
  - **Out of scope:** `Live.tsx` (R216 holds it); the place group's controls (R218); the sheet's head (R219); the bar (R220).
  - **Done when:** `npm run check` green; `Header.test.tsx` covers the three readings, the current tab's 2 px underline and `← back`; `PlaceDialog.test.tsx` sets a place each of three ways and sees it close; the compact header holds the mark and three links in 36 cells; `npm run check:sdd` green.

- [ ] **R216 — The live rail, in order**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R213, R214
  - **Reads:** FR-NOW-1, FR-CTRL-10, FR-WIDE-1; D-1239, D-1243
  - **Goal:** at a desk the rail reads strip, `View` with `share`, `Time`, then the turn, layers, up-now and up-from slots, and scrolls as one column with no list capped; the phone's sheet holds the same groups in the same order.
  - **Satisfies:** FR-NOW-1, FR-CTRL-10 for the rail, FR-WIDE-1 as amended
  - **Scope:** `SkyViewLayout`'s `SLOT_ORDER` with all seven slots and the cap removed (D-1239); `screens/sky/live/**`; `Live.tsx`; `Hidden objects` into `Layers`, `scrub the night` and `see this pass` as buttons in `Time`; `ControlsSheet`'s order.
  - **Touches outside the lane:** `src/ui/components/sky/SkyViewLayout.tsx`, `src/ui/components/sky/ControlsSheet.tsx`
  - **Deletes:** `live-rail.spec.ts` and `sheetRows.test.ts` rewritten to the new order
  - **Captures:** none
  - **Out of scope:** `Up now`'s content (R219); `Turn` and `Up from` (R222).
  - **Done when:** `npm run check` green; `live-rail.spec.ts` at 1280 × 800 reads the groups in order and finds no scrolling element inside the rail; the compact sheet's order at 390 × 844; `npm run check:sdd` green.

- [ ] **R217 — The globe's zoom keys and the legend's up-only form**
  - **Lane:** chart
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R214
  - **Reads:** FR-CTRL-9, FR-CTRL-14, FR-CTRL-15, FR-NOW-2; D-1229, D-1239, D-1241, D-1243
  - **Goal:** the globe carries the window's three keys and hint; the legend's satellites are rows you pick with a blue line; its `upOnly` form lists the satellites above the horizon, then the Moon and the Sun, each with compass point and degrees in aligned columns, or `No satellite up`; the chart's cloud and Moon labels are tags.
  - **Satisfies:** FR-CTRL-9 for the globe; FR-CTRL-15 for the legend; FR-CTRL-14 inside `skychart/`; FR-NOW-2's rows (mounted by R219)
  - **Scope:** `globe/SkyGlobe.tsx`'s zoom steps and `ZoomKeys` in its zoom slot (D-1241); `Legend.tsx`'s `PickRow` rows and `upOnly` form, `src/lib/legend.ts`'s compass and columns (D-1239); the chart's tags; the chart lane's allow entries lowered to zero.
  - **Deletes:** the legend's accent-name assertions, rewritten
  - **Captures:** none
  - **Out of scope:** any live screen; the window (R214).
  - **Done when:** `npm run check` green; `globe.spec.ts` presses the three keys; `legend.test.ts` covers the 16 compass boundaries and below-horizon rows; `Legend.test.tsx` covers `upOnly` with none up and with one up; `legend-hover.spec.ts` sees the picked row's line and `aria-pressed`; `npm run check:sdd` green.

- [ ] **R218 — The place group's controls**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R215
  - **Reads:** FR-CTRL-4, FR-CTRL-7, FR-CTRL-8, FR-CTRL-17, FR-DS-12; US-65 AC3, AC4; D-1226, D-1243
  - **Goal:** `Use my location` keeps its width while it searches and says progress and error on one line under it; the suggestion list lines up with the input; saved places are rows, the one in use picked; the dialog keeps one rhythm.
  - **Satisfies:** FR-CTRL-4, FR-CTRL-7, FR-CTRL-8, FR-CTRL-17 for the place group, FR-DS-12 for the place dialog; US-65 AC3, AC4
  - **Scope:** `location/{UseMyLocation,PlacePicker,LocationInput,Favourites,PlaceDialog}.tsx` and CSS; the placeholder in both catalogs; the `location/` allow entries lowered to zero.
  - **Deletes:** `UseMyLocation`'s own error-style test, rewritten to `StatusLine`
  - **Captures:** none
  - **Out of scope:** the header (R215).
  - **Done when:** `npm run check` green; the button's box is the same width before, during and after; `place-search.spec.ts` measures the list's left edge and width against the input's; `favourites.spec.ts` sees the picked row; `npm run check:sdd` green.

- [ ] **R219 — What is up now, as rows**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R215, R216, R217
  - **Reads:** FR-NOW-2, FR-NOW-3, FR-LAND-4; US-65 AC9; D-1238, D-1239, D-1243
  - **Goal:** the rail's `Up now` is the legend's up-only form followed by `Clouds` and `Moon` as rows; the status line is gone; on the phone the controls sheet opens on the place line.
  - **Satisfies:** FR-NOW-2, FR-NOW-3, FR-LAND-4's compact sheet head; US-65 AC9
  - **Scope:** the `upNow` slot in `screens/sky/live/**` with `Legend`'s `upOnly` and two `SettingRow`s; `components/live/StatusStrip.tsx` deleted; `ControlsSheet`'s head with the place line (D-1238); the live lane's allow entries for these files lowered.
  - **Touches outside the lane:** `src/ui/components/sky/ControlsSheet.tsx`
  - **Deletes:** `StatusStrip.test.tsx`
  - **Captures:** none
  - **Out of scope:** the stars' groups (R222).
  - **Done when:** `npm run check` green; `live-rail.spec.ts` at 1280 × 800 with nothing up and with a pass up, the Moon's and the Sun's rows at the column's left edge, the two rows after them; the sheet's first line at 390 × 844 with the example and with a place; `npm run check:sdd` green.

- [ ] **R220 — The update bar on every page**
  - **Lane:** data
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R207, R215
  - **Reads:** FR-UPD-2; US-66; D-1237, D-1243
  - **Goal:** after a release, an open tab on `#live`, `#pass` or `#settings` shows `New version ready · reload` under the header within 10 s of coming back into view, never over the sky.
  - **Satisfies:** FR-UPD-2, FR-OFF-1 as amended; US-66
  - **Scope:** `Shell.tsx`'s slot and `UpdateBanner.tsx` in §4.64's looks (D-1237); `update-banner.spec.ts`'s fake `navigator.serviceWorker` gaining an `update()` that yields a waiting worker after a `visibilitychange`.
  - **Touches outside the lane:** `src/ui/Shell.tsx`, `src/ui/components/common/UpdateBanner.tsx` and its test
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** the check itself (R207).
  - **Done when:** `npm run check` green; `update-banner.spec.ts` sees the bar within 10 s on the three pages at 390 × 844 and 1280 × 800, outside the sky's box; `npm run check:sdd` green.

- [ ] **R221 — Rows you pick, tags and disclosures in the pass lists**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R218
  - **Reads:** FR-CTRL-14, FR-CTRL-15, FR-CTRL-16; US-65 AC6; D-1229, D-1243
  - **Goal:** a pass card or list row has no frame, a hover ground and, picked, a blue line at its left; `[twilight]`, `[faint]`, the cloud tags and the banners' tags are tags; the night groups open with `▸ Tonight · 3`.
  - **Satisfies:** FR-CTRL-14, FR-CTRL-15 and FR-CTRL-16's disclosure for the pass lists and banners; US-65 AC6
  - **Scope:** `components/passes/**`, `components/now/**`, `components/guide/**` (not `skychart/`), `common/Banner.tsx`, `primitives/Card.tsx`'s `selected` removed with its callers in these modules; their allow entries lowered to zero.
  - **Deletes:** `Card`'s `selected` tests and the night toggle's `[+]` tests, rewritten
  - **Captures:** none
  - **Out of scope:** `Card`'s callers in `Live.tsx` and the stars' screens (R222); closes and inline actions (R224).
  - **Done when:** `npm run check` green; `pass-list.spec.ts` sees the picked row's line and `aria-current`; a `Tag` has no role and no hover; no allow entry left for the modules named; `npm run check:sdd` green.

- [ ] **R222 — The stars fold into live**
  - **Lane:** live
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R215, R219
  - **Reads:** FR-LAND-3, FR-LAND-5, FR-STAR-3; US-62 AC2, AC3; D-1230, D-1240, D-1246, D-1243
  - **Goal:** `#stars` opens `#live`, whose rail gains `Turn` (wide), the stars' layers and `Up from <place>` as rows you pick; with no place and no example the sky's box holds the place group; live is a tab with no back.
  - **Satisfies:** FR-LAND-3, FR-LAND-5, FR-STAR-3 as amended, FR-CTRL-15 for `Up from`; US-62 AC2 (no city), AC3
  - **Scope:** the stars' groups into the `turn`, `layers` and `upFrom` slots (D-1240); `#stars…` rewritten to `#live`; `Live.tsx`'s no-place branch and its `Card`; `live.leave` and `Esc` (D-1230); `screens/home/{placeRequest,tonight}.ts` deleted; the `stars` budget row (D-1246); the manifest's stars names; the live lane's allow entries lowered to zero.
  - **Touches outside the lane:** `src/ui/screens/Stars.tsx`, `StarsRoute.ts`, `starsChunk.ts`, `screens/stars/**`, `screens/sky/stars/**`, `screens/home/{placeRequest,tonight}.ts` (deleted); `src/ui/App.tsx`, `src/ui/openedRoute.ts`, `src/lib/routeTitle.ts`, the stars catalog keys, `src/model/measure.ts` (`open: 'stars'`, `stars_open`), `tests/e2e/captureSet.ts`
  - **Deletes:** `Stars.test.tsx`, `StarsGlobe.test.tsx`; the stars page's e2e cases, moved to `#live` where they test a layer
  - **Captures:** none
  - **Out of scope:** `components/sky/time/**` (R223).
  - **Done when:** `npm run check` and `npm run check:dead` green; `landing.spec.ts` gains `#stars` and `#stars?<params>`; an e2e toggles each layer on `#live` at both widths; `live-rail.spec.ts` reads all seven groups at 1280 × 800 and the compact sheet's order; the no-place e2e sees the place group in the box; `npm run check:sdd` green.

- [ ] **R223 — The time row's buttons**
  - **Lane:** window
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R209, R219
  - **Reads:** FR-CTRL-16; D-1229, D-1243
  - **Goal:** the step buttons (`|◀ pass` … `pass ▶|`) and the pass's clickable times are boxes or links of the primitives; nothing in the time controls renders a control of its own.
  - **Satisfies:** FR-CTRL-16's step buttons and the times row
  - **Scope:** `components/sky/time/**` (the `window` lane by name: `live` holds R222 in this wave); their allow entries lowered to zero.
  - **Touches outside the lane:** `src/ui/components/sky/time/**`
  - **Deletes:** the step buttons' bracket assertions, rewritten
  - **Captures:** none
  - **Out of scope:** `Live.tsx` and the rail (R222).
  - **Done when:** `npm run check` green; `live-playback.spec.ts` steps by pass and by time; no allow entry left under `components/sky/time/`; `npm run check:sdd` green.

- [ ] **R224 — One close, links in a line, one feedback**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 500
  - **Fallback:** off
  - **Review:** opus
  - **Gate:** auto
  - **Depends on:** R221, R222, R223
  - **Reads:** FR-CTRL-12, FR-CTRL-13, FR-CTRL-16, FR-CTRL-17, FR-DS-11; US-65 AC5; D-1229, D-1243
  - **Goal:** every close is the same `×`, every action inside a line of text is an underlined blue link, every standalone button is a box, `follow` is an option, every form says progress and failure the same way, dialogs share one frame; no control and no bracket is left outside the primitives.
  - **Satisfies:** FR-CTRL-12, FR-CTRL-13, FR-CTRL-16, FR-CTRL-17; FR-DS-11's end state; US-65 AC5
  - **Scope:** the pass panel, `facts/**`, full screen's exit, `ControlsSheet`'s close, `ShortcutsOverlay`, the link note, `InstallHint`, `RootBoundary`, `ShareButton`, `FollowToggle`, `AskDialog`'s frame, the inline actions; every allow list left `{}` and the test requiring it.
  - **Deletes:** the bracketed-close assertions, rewritten
  - **Captures:** none
  - **Out of scope:** the settings page's rhythm (R225).
  - **Done when:** `npm run check` green; every allow list is `{}`; every close is `Close` with its name in both languages; a test per inline action that it is a link with the `--tap` hit area; `npm run check:sdd` green.

- [ ] **R225 — One rhythm on every page**
  - **Lane:** ui
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R224
  - **Reads:** FR-DS-12, FR-CTRL-10; US-65 AC7, AC8; D-1243
  - **Goal:** the settings page's groups are `SettingRow`s with equal heights and gaps, labels in one column; every group starts at the column's left edge; no scrolling element sits in another on any page.
  - **Satisfies:** FR-DS-12, FR-CTRL-10; US-65 AC7, AC8
  - **Scope:** `Settings.tsx` and its CSS, `screens/sky/pass/**`, and, where the walk fails, `screens/sky/live/**` and `components/live/**`; `rhythm.spec.ts`, `one-scroll.spec.ts`. A failure on any other page is written to `sdd-run/R225.blocked.md`, not fixed here.
  - **Touches outside the lane:** `src/ui/screens/sky/live/**`, `src/ui/components/live/**`
  - **Deletes:** the `controlRows.test.ts` cases the rhythm test supersedes, named in the PR
  - **Captures:** none
  - **Out of scope:** the documents (R226).
  - **Done when:** `npm run check` green; `rhythm.spec.ts` measures the settings page's browser group and the rails at 1280 × 800 and 390 × 844, equal to the pixel; `one-scroll.spec.ts` walks every page at 1280 × 800, 1024 × 700 and 390 × 844; `npm run check:sdd` green.

- [ ] **R226 — The documents describe 3.0**
  - **Lane:** docs
  - **Tier:** light
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R217, R224
  - **Reads:** FR-LAND-1, FR-LAND-3, FR-LAND-4, FR-STRIP-1, FR-STRIP-5, FR-DARK-4, FR-CTRL-14, FR-UPD-2; D-1243, D-1244
  - **Goal:** no document outside the history still describes the home page, the `#stars` route, the bracketed controls, the sun glow or the first-pass question, and a test keeps it so.
  - **Satisfies:** D-1244's sweep (the definition of done)
  - **Scope:** `README.md`, `docs/RELEASE.md`, `docs/DESIGN.md`, `docs/HOW-THIS-WAS-BUILT.md`, `docs/sdd/reference/glossary.md` and the other reference pages, `docs/sdd/map.md`, every screenshot reference to a removed capture; `tests/docs/stale.test.ts` (D-1244).
  - **Deletes:** none
  - **Captures:** none
  - **Out of scope:** the version, the budget and the record (R227).
  - **Done when:** `tests/docs/stale.test.ts` green and failing on a planted `#stars`; `npm run check:sdd` and `tests/docs/**` green.

- [ ] **R227 — 3.0.0**
  - **Lane:** docs
  - **Tier:** standard
  - **Turns:** 300
  - **Fallback:** off
  - **Review:** sonnet
  - **Gate:** auto
  - **Depends on:** R225, R226
  - **Reads:** FR-DS-14; D-1244, D-1245, D-1246
  - **Goal:** `main` reads 3.0.0 with every budget row re-set, the README's version current and the release record written; the capture set, the tag and the deploy are left to the owner.
  - **Satisfies:** FR-DS-14 (the moves listed for the owner's run); the definition of done's version, budget and funnel items
  - **Scope:** `docs/sdd/workflows/release.md`'s steps, without the in-session capture shoot (D-1245).
    `docs/sdd/phases/v3.0/release.md`: the moves by requirement from the manifest's diff and D-1245's new states; the bundle table, every row within 1 KB of 2.16.0 or named (D-1246); `npm run funnel`'s 14 days before and after as an owner checkbox (V30-22); the gallery and the pages to check by hand (FR-DS-14) and the desk and phone runs in its owner sections.
    `scripts/bundle-budget.ts`, `tests/docs/accuracy.test.ts`'s record, `README.md`'s version, `package.json` and the lockfile's root at 3.0.0.
  - **Deletes:** none
  - **Captures:** none (the owner's `captures.yml` run shoots the set)
  - **Out of scope:** the tag, the deploy, `captures.yml` and the device runs (the owner's).
  - **Done when:** `npm run check` and `npm test` green; `npm run bundle:budget` green with every row explained; `tests/docs/accuracy.test.ts` points at the record; `tests/docs/stale.test.ts` green on this tree; `npm run check:dead` clean; `npm run check:sdd` green.

Waves: **wave 1** R206, R207, R208; **wave 2** R209, R210, R211; **wave 3** R212, R213, R214; **wave 4** R215, R216, R217; **wave 5** R218, R219, R220; **wave 6** R221, R222, R223; **wave 7** R224; **wave 8** R225, R226; **wave 9** R227.
