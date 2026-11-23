# v3.0 — PLAN.md sections

Phase file of PLAN.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.55 v3.0 decisions (2026-11-21)

- **D-1224 — The design system's wave is driver waves 1 and 2.**
  (FR-DS-14; V30-28, V30-31.) R206 (the tokens, the looks of five existing primitives, the gallery's states, the width tables measured again) runs in wave 1 and R209 (`Field`'s look, `busy`, six new primitives, the ratchets) in wave 2; both touch `src/ui/components/primitives/**`, so they cannot share a wave.
  Beside them run only tasks that add no control and restyle none: R207 (the update check), R208 (how playback opens), R210 (the events), R211 (the sky's drawing and the glow's removal); none of them consumes a primitive, so running before R209 merges does not break FR-DS-14's order.
  R210's and R211's dependency on R206 only places them in wave 2, three tasks a wave; every screen task depends on R209; nothing is tagged or deployed between waves (V30-31).
- **D-1225 — The control tokens sit in `:root` once, read by both themes.**
  (FR-DS-10.) `src/ui/styles/tokens.css` gains `--control-h`, `--control-pad`, `--control-radius`, `--control-edge`, `--on-ground`, `--on-ink`, `--hover-ground`, `--mark`, `--gap-row`, `--gap-group` and `--label-col` with FR-DS-10's defaults, each an alias of an existing token, so a theme changes them by changing what they alias.
  `scripts/contrast.ts` checks `--on-ink` on `--on-ground` and `--control-edge` on `--bg` (WCAG 1.4.11, 3 : 1); `tests/styles/tokens.test.ts` pins the names.
  No module outside `primitives/` and `dev/` reads a control token in this phase except through a primitive.
- **D-1226 — The drawn box is smaller than the hit box.**
  (FR-CTRL-1, FR-CTRL-7, G6.) `TextButton`, `Field`'s input and the option of `OptionToggle` draw their box on an inner element `--control-h` tall; the element itself keeps `inline-control`'s `--tap` hit area on compact by padding, so no row of a page grows and `tests/styles/targets.test.ts` still holds.
  `TextButton` gains `box?: 'plain' | 'accent'` (the primary form, FR-CTRL-1; R206) and `busy?: boolean` (R209) (FR-CTRL-4: the label and box fixed, `aria-busy`, the words pulsing between 1 and 0.35 opacity, held at 0.35 under reduced motion).
  The brackets leave the primitives' render, not the callers' labels: a caller that passes `[ x ]` text is fixed by the task that owns it.
  R206 measures again every width the brackets were counted in (`tests/styles/cells.ts`, `controlRows.test.ts`, `breakpoint.test.ts`, the compact header's 36 cells, the footer's one line) and fixes the fit tests they move; R206 and R209 may update any test elsewhere that asserts the old render (`[x]`, `[ … ]`).
- **D-1227 — The gallery's states are forced by the browser, not by the page.**
  (FR-DS-13.) `dev/primitives.tsx` lays every primitive once per state (rest, hover, focus, on, picked, busy, disabled, error) in a cell with a stable `data-state` id, in both themes; `tests/e2e/design-captures.spec.ts` forces `:hover` and `:focus-visible` on those cells through CDP `CSS.forcePseudoState`, so no production CSS carries a test selector.
  `captureSet.ts`'s `design` group stays four files (two themes × 390 and 1280 px), each now taller; `manifest.ts` gains a `states` list per row that the gallery and the guide (`npm run design:guide`) both read.
- **D-1228 — The new primitives and their props.**
  (FR-DS-11.) In `src/ui/components/primitives/`, each with a test and a manifest row.
  `Tag({ tone, children })` → `[word]`; `Close({ onClose, label? })` → the bare `×`, name "Close" / "Cerrar"; `PickRow({ picked, onPick | href, current? })`.
  `Disclosure({ open, onToggle, label, count? })` → `▸` / `▾`; `ZoomKeys({ onIn, onOut, onReset })`; `SettingRow({ label, children })`; `StatusLine({ tone: 'progress' | 'failure' | 'ok' | 'empty', children })` → `role="status"`, or `role="alert"` for `failure`.
  `Line` keeps its tones; `StatusLine` composes it.
  R209 builds `Tag`, `Close`, `StatusLine`, `PickRow`, `Disclosure` and `SettingRow`; R214 builds `ZoomKeys`, its only users being the window and the globe (D-1241), so R206 stays small enough to also measure the width tables again (D-1226).
- **D-1229 — Two ratchets keep the controls in the primitives, one allow file per lane.**
  (FR-DS-11, FR-CTRL-14, FR-DS-2 as amended.) `tests/styles/controls.test.ts` reads every `.tsx` under `src/ui` outside `primitives/` and counts JSX matching `<button[\s>/]`, `<a[\s>/]` and `<input[\s>/]` (so `<abbr>`, `<aside>`, `<article>` never count).
  The bracket rule in `tests/styles/literals.ts` counts a bracketed word outside `Tag`: in JSX text, in the catalogs' strings, and in template literals that build `[${…}]`.
  Each lane has its own lists, `tests/styles/allow/<lane>.controls.json` and `<lane>.brackets.json`, a file mapped to its count and a reason; a test fails only on a file over its count, so a lower count from a task of another lane never turns `main` red; an entry may stand above its file's count until its lane's task lowers it.
  R209 seeds them at the day's counts; a task that deletes a file deletes its entry; R224 leaves every list `{}`, which a last assertion then requires.
- **D-1230 — The route with no hash is the live route; the home's helpers stay where they are.**
  (FR-LAND-1.) `App.tsx`'s route reader maps an empty hash, `#` and any hash that names no route to `live` and replaces the hash with `#live` through `history.replaceState` before the first render; `RouteName` loses `home` (R212) and `stars` (R222), `open`'s `home` detail goes with its route (R212).
  R212 deletes `Home.tsx`, `ExampleBand`, `HomeDoors`, `doorLines` and their tests, and keeps `screens/home/{placeRequest,tonight,usePlaceOpen,shownPasses,useNight}.ts` in place, so `Live.tsx`, `Stars.tsx`, `ExampleNotice.tsx`, `Header.tsx`, `PassList.tsx` and `sky/pass/Empty.tsx` keep compiling; R212 never edits `Live.tsx` or `Stars.tsx`.
  `requestPlace()` opens `#settings`, whose location section is the place group, until R215 points it at the place dialog (D-1238).
  The header loses its `home` link in R212 (`NAV_PAGES`). Live is a tab: it has no `back`, and its `Esc` closes only what is open on it; R222 removes `live.leave` and states the rule in `LiveRoute.ts`'s test (the `live` lane, `Live*`).
  R212 owns the `captureSet.ts` and `tests/docs/captures.test.ts` edits of wave 3, R213's dialog and card names included, so the two never edit one file.
- **D-1231 — The compact satellites page is `#pass` with no pass.**
  (FR-LAND-6.) On compact `#pass` with no id draws tonight's list in `src/ui/screens/sky/pass/Empty.tsx`'s compact branch: FR-FIRST-3's cards (`components/passes/**`) and tonight's stripe (`components/now/TonightStripe.tsx`) as the home drew them; a card opens the pass sheet as today.
  On wide `#pass` with no id is today's pass page of the pass up now or next (FR-CLEAN-14).
- **D-1232 — The strip is one pure function.**
  (FR-STRIP-1..3.) `src/lib/nextPassStrip.ts` (the `live` lane) exports `nextPassStrip({ passes, shownMs, nowMs })` → `{ kind: 'next', pass } | { kind: 'up', pass } | { kind: 'none' }` and `watchInstant(pass)` = rise − `TONIGHT_LEAD_MIN`; the component `src/ui/components/live/NextPassStrip.tsx` draws it at the box's foot on compact and as the rail's head on wide (FR-STRIP-1, V30-30).
  `FirstPassDialog.tsx`, the compact `OpeningCard.tsx` and `lib/tonightJump.ts`'s automatic landing go with their tests (FR-STRIP-5).
- **D-1233 — Playback learns how a page opens.**
  (FR-STRIP-4, FR-LAND-2.) `usePlayback` takes `opening?: { speed, loop?: { fromMs, toMs, holdMs } }`: the wide live page passes `{ speed: 1 }`, the wide pass page `{ speed: 60, loop: { rise, set, 2000 } }`; a hash holding `t` or `prefers-reduced-motion: reduce` opens paused whatever is passed.
  The loop stops for good at the first pause or move of the time by the reader.
- **D-1234 — One sky surface in every view, every rung at every hour.**
  (FR-DARK-1, FR-DARK-2, FR-LOOK-2, FR-STAR-13, FR-SKY-3 as amended.) Every view fills the sky with `--chart-sky-deep` and draws every rung and the Sun's dot.
  R211 (chart) removes the tint from the dome, the polar chart (`PolarStars.tsx`'s `tintStep` import, `SkyPolar.module.css`'s two fills) and the globe (`globe/scene.ts`'s `tintStep`, `SkyGlobe.module.css`'s `data-tint` fills), and makes `src/lib/skyStars.ts`'s rung cut return every rung.
  R214 (window) removes the window's tint (`StarField.tsx`, `SkyWindow.module.css`), then deletes `tintStep` and `SURFACE_TOKENS` from `window/skySurface.ts`, the two tokens from `tokens.css` and their `scripts/contrast.ts` rows.
- **D-1235 — The sun glow goes in one task, across lanes, by exception.**
  (FR-DARK-4, FR-SET-5 removed.) R211 removes `FR-DOME-6`'s glow from the dome and `sunGlow` everywhere it is read or stored: `skychart/SkyChart.tsx` and its types, `window/SkyWindow.tsx`'s prop, `screens/Settings.tsx`'s row and both catalogs' keys, `src/model/prefs.ts`, `src/state/slices/prefs.ts`, `src/data/localPrefs.ts`; a stored `sunGlow` is ignored on load and not written on the next save.
  The crossings (window, ui, physics, data, and `src/lib/skyStars.ts` for D-1234) are named on the task; no other wave-2 task touches those files (R210, `physics`, edits only `measure.ts` and `funnel.ts`).
- **D-1236 — The update check is injected and timed by visibility.**
  (FR-UPD-1.) `src/state/serviceWorker.ts` gains `watchForUpdates(registration, host)` with `UPDATE_POLL_MIN` (30) exported: `update()` once after registering, on each `visibilitychange` to visible, and every 30 min while visible, the timer cleared while hidden; `host` carries the document, the timers and the clock so the unit test drives it with fake timers.
- **D-1237 — The update bar is the shell's, from the task that deletes the home.**
  (FR-UPD-2, FR-OFF-1 as amended.) R212 moves `UpdateBanner` from `Home.tsx` to a slot `Shell.tsx` draws directly under the banner (the header) on every route, so the bar is never without a caller; R220 restyles it, holds it out of the sky's box on every page and proves it on three pages.
  `reload` is a `TextButton` that posts `SKIP_WAITING` and reloads on `controllerchange`, as today; `tests/e2e/update-banner.spec.ts` moves from the home to `#live` in R212 and to `#live`, `#pass` and `#settings` in R220.
- **D-1238 — The place line is the header's, and the place dialog hosts the place group.**
  (FR-LAND-4, FR-LAND-5's header reading, FR-MEAS-2 as amended.) `Header` takes `place: { label, example } | null` and `onChangePlace`; on wide it is drawn centred in the header row, on compact by the satellites list's head (R215) and `ControlsSheet`'s head (R219, which owns the sheet in its wave).
  `src/ui/components/location/PlaceDialog.tsx` is `AskDialog`'s frame around `LocationInput`'s group; a place set there closes it; `where_shown` is sent when it opens.
  R215 re-implements `requestPlace()` in `placeRequest.ts` to open the dialog (the module stays, `Live.tsx` and `Stars.tsx` still import it) and deletes `ExampleNotice.tsx` with its three callers' uses: `Stars.tsx`, `PassDetail.tsx`, `VisitNotice.tsx`.
- **D-1239 — The rail's order is one list; `Up now` is the legend in an up-only form.**
  (FR-NOW-1..3, FR-CTRL-10, FR-WIDE-1 as amended.) R216 makes `SkyViewLayout`'s `SLOT_ORDER` `strip, view, time, turn, layers, upNow, upFrom` with all seven slots (`turn` and `upFrom` empty until R222), the compact `ControlsSheet` in the same order, and removes V214-33's 7.5-row cap and every inner `overflow: auto` in the rail.
  `Up now` is `skychart/Legend.tsx`, so FR-LEG-4's pin and hover, FR-FACT-3's facts on pick and R217's rows are kept: R217 (chart) gives it an `upOnly` form (satellites above the horizon at the shown instant, then the Moon and the Sun), the compass point and degrees in aligned columns from `src/lib/legend.ts`, and `No satellite up`.
  R219 (live) mounts it in the `upNow` slot with `Clouds` and `Moon` as `SettingRow`s after it and deletes `StatusStrip.tsx`.
- **D-1240 — The stars page's groups move into the live lane.**
  (FR-LAND-3, FR-STAR-3 as amended; R222.) `Turn`, `Layers` and `Up from <place>` move from `screens/Stars.tsx`, `screens/stars/**` and `screens/sky/stars/**` into the `turn`, `layers` and `upFrom` slots R216 made.
  Those files, `StarsRoute.ts`, `starsChunk.ts`, `screens/home/{placeRequest,tonight}.ts` (their last importers gone) and the `stars` budget row go; the globe's `globeChunk.ts` moves with them and stays a chunk.
  A load of `#stars…` is rewritten to `#live` with the parameters `useLiveRoute` parses; `App.tsx`, `openedRoute.ts`, `src/lib/routeTitle.ts`, the stars catalog keys and `measure.ts`'s `open: 'stars'` and `stars_open` go with the route.
- **D-1241 — The zoom keys sit under the box, and the hint is one key.**
  (FR-CTRL-9.) `SkyViewLayout`'s `zoom` chart slot moves from the box's bottom-right corner to the row under the box, at its left (R214); R214 builds the `ZoomKeys` primitive (`primitives/`, a named exception); the window (R214) and the globe (R217, in `SkyGlobe.tsx` only) portal it into the slot, steps equal to the wheel's and the pinch's, `⟲` to the opening camera.
  R214 changes `components/sky/SkyHint.tsx`: FR-CTRL-9's line in the box's corner until the first drag or zoom, then `wiys:hint:globe:v1`, shared by both views.
  On a touch screen the line reads `drag to turn · pinch to zoom` / `arrastrá para girar · pellizcá para acercar`: FR-CTRL-9 names the wheel, which a phone has not, so the second clause follows the pointer as `SkyHint` does today; the owner confirmed it on 2026-11-21.
- **D-1242 — The events: `watch` arrives first, `door` leaves with the home.**
  (FR-MEAS-2, FR-MEAS-6 as amended; V30-22.) R210 adds `watch: []` to `src/model/measure.ts`'s `EVENTS` and makes `scripts/funnel.ts`'s base first-visit `open` on any route, the same before and after 3.0 so V30-22's two windows compare, with a `watch` row and no `door` row.
  R212 deletes `door` and `open`'s `home` with their senders and asserts `example_shown` fires on `#live`; R213 sends `watch` once per visit; R215 sends `where_shown` from the place dialog; R222 deletes `open`'s `stars` and `stars_open`.
- **D-1243 — Every task leaves the repository consistent.**
  (The owner's rule, 2026-11-21.) Each task updates, in the same pull request, what its change makes untrue: `docs/sdd/map.md`'s rows for each file it adds, moves or deletes; the `docs/sdd/reference/*` page that describes it (glossary, data model, worker contract, testing, build and deploy); a section of `docs/sdd/gotchas.md` for a new trap; both catalogs for every user-facing word.
  Each task's `Done when` carries `npm run check:sdd` and `tests/docs/**` green.
- **D-1244 — The sweep is a task and a test.**
  (The definition of done, V30-31.) R226 sweeps `README.md`, `docs/RELEASE.md`, `docs/DESIGN.md`, `docs/HOW-THIS-WAS-BUILT.md` and every page under `docs/` outside the phase folders and the logs for the removed home, the `#stars` route, the bracketed controls, `sunGlow`, the first-pass question and the version, and fixes them.
  It adds `tests/docs/stale.test.ts`, which fails on a listed stale string (`#stars`, `[ home ]`, `[ set your place ]`, `sunGlow`, `Next up`, the home's capture names) in those files and the catalogs; history (`decisions.md`, `revision-history.md`, closed phases, release records) is exempt.
  The definition of done gains: the sweep's test green on the release commit.
- **D-1245 — The capture set is re-shot once, at the end; the gallery at each design-system task.**
  (FR-DS-14; owner-confirmed 2026-11-21.) FR-DS-14 asks a token or primitive change to re-shoot the gallery and the whole set; R206 and R209 re-shoot the gallery only, and the whole set is shot once, by the owner's `captures.yml` run after R227, because every screen task after them moves every capture again and a full set per task is about 450 files of churn and 20 min of CI each.
  `main` keeps no `v1-*` capture files, so R227 does not shoot in its session: it writes the moves from the manifest's diff and the owner's `captures.yml` run after it shoots the set.
  Each screen task keeps `tests/e2e/captureSet.ts`'s manifest true for what it removes (the home's, the stars page's, the first-pass dialog's names); R227 adds FR-LAND-4's header at 1280 and 1024 px with the example and with a place, the compact sheet's head at 390 px with both, and FR-NOW-3's rail at 1280 × 800 with nothing up and with a pass up.
- **D-1246 — The budget rows follow the chunks.**
  (The definition of done.) The `home` and `stars` rows leave `scripts/bundle-budget.ts` with their chunks (R212, R222); the `live` row grows by the stars' groups and the strip, a named reason (FR-LAND-3, FR-STRIP-1); R227 re-sets every row by D-178 and names any row over 2.16.0's by more than 1 KB.
- **D-1253 — Real time running at 1× is nothing held, read each second.**
  (R208; FR-STRIP-4, FR-LAND-2, D-1233.) The wide live page's opening holds no instant: `realTime` stays true, so the hash, the share link, the watching state and `live` read as real time, while `playing` is true at 1× and the shown instant is the wall clock, read once a second.
  A frame loop would redraw the globe 60 times a second for as long as the page is open and, adding wall deltas, would drift from the clock it claims to show.
  The state follows from the opening and from nothing being held: a pause holds the second on screen, a move holds where it lands, and any return to real time on wide (`now`, a held instant real time overtakes, a link whose moment has passed) runs again, as FR-STRIP-3 words it.
  A speed saved or picked is still the one `play` runs a held instant at (FR-KEEP-1).
- **D-1254 — The reader's pause or move ends the pass's loop where it lands, paused.**
  (R208; FR-STRIP-4, D-1233.) "Until the reader pauses or moves the time" is read as ending the playing opening: a tap on `peak` shows the peak and does not run on from it at 60×; `play` then plays as it always has, past the set to the span's end.
  A speed is neither, so the loop goes on at it; the opening's 60× is not saved. The page's own placing of a rise past the span (`goTo(rise, 'page')`) is no move.
  The loop runs to the set unclamped, for a pass that rises inside the span and sets past its end, and it is wide's alone: on compact it stands still.
- **D-1255 — What opens paused is decided in the hook.**
  (R208; FR-LIVE-9, FR-STRIP-4.) `usePlayback` asks reduced motion itself, so no page can open playing under it.
  It knows a link's instant by `initial`: any on the live page, and on a pass page any that is not the loop's start. A pass link holds no `t` (its `start` names the pass), so a pass page opened by a link plays.
- **D-1247 — A box is its words and two cells, and takes no height in its line.**
  (R206; D-1226, FR-CTRL-1.) The hairline is inside the cell of padding, so a button and an option are both the label plus two cells; negative block margins leave the box out of the line's height.
  A short control keeps `--target` of width by a block of no height after the box, not by `min-inline-size`, which would let a flex item shrink under its words.
  `bare` stays words without a box, in the accent, and `note` draws the box on the button itself.
- **D-1248 — An option has one look; the props of the older looks stay until their callers move.**
  (R206; FR-CTRL-2, FR-CTRL-3.) `mark`, `gap` and `alone` are accepted and draw nothing different, because their callers are in other tasks' lanes.
  A dense row (the facing picker, FR-FLOW-11) keeps its half cell of hit padding and draws its block a quarter cell into it, so the row keeps its cells.
  Two options side by side outside a group (the stars page's layers) take the same quarter cell between them, or two that are on read as one block.
  Disabled and on keeps a block, on `--hover-ground` with dim words (FR-CTRL-17).
- **D-1249 — The widths follow the box, and so does the hint's fit.**
  (R206; D-1226.) `BRACKET_CELLS` (4) is `BOX_CELLS` (2) in `hintFitsBeside`, so the mouse's drag hint now stands beside `controls` in both languages where only the touch one did.
  The stars page's `firstRowCount` counts the same two cells and a quarter cell between options, so its first row holds three layers in both languages (25.5 and 30.5 of 32 cells).
  The gallery restates the colour aliases on each theme's column, since an alias resolves where it is declared; the app's theme is on the root and needs none.
- **D-1256 — A field's box is a frame after its input, and busy is not disabled.**
  (R209; D-1226, FR-CTRL-4, FR-CTRL-7.) An input holds no element, so it draws nothing and the frame after it in their wrapper is the box; its focus rule is the one exception to D-1141's test, the edge and the hairline ring reading as one 2 px line.
  `busy` sets `aria-disabled` and swallows the press instead of disabling, which would dim the box and drop the focus.
  The pulse's hold under reduced motion is asked in script (D-932), by a hook of the primitives' own, since FR-DS-3 keeps that query out of a stylesheet.
- **D-1257 — `Close`'s word is handed down, and the bracket ratchet also reads a stylesheet's `content`.**
  (R209; D-703, D-1228, D-1229.) A primitive imports no catalog, so `I18nProvider` hands `shortcuts.close` ("Close", "Cerrar") to `closeName.ts`'s context and `label` outranks it; outside the provider a caller passes `label`.
  Seven of the day's eight files with bracketed words draw them as CSS `content`, so the rule counts that form beside D-1229's three, or the lists could be empty with the brackets still drawn.
  D-1229's JSX text includes the words written into a prop, which is how `Line` and `TextButton` take theirs; there a selector (an `=`, or a `data-` or `aria-` name) does not count.
  A `+` is read as the template it equals and an element's children as one text, so a bracket written apart from its word counts; one held in a variable is not followed.
  A file is listed under the lane of the task that lowers it: `StepControls` under `window` (R223), `ControlsSheet` under `ui` (R224), `screens/stars/**` under `live` (R222).
- **D-1258 — The picked row's attribute, and a row's height with its hit area aside.**
  (R209; D-1228, FR-CTRL-15, FR-DS-12.) A `PickRow` link is `aria-current` when picked; a button is `aria-pressed`, or `aria-current` with `current`, where the row is the one shown of its set.
  A disabled link drops its `href` and any `tabindex` and is a `role="link"` with `aria-disabled`, since an `<a>` has no `disabled` (FR-CTRL-17).
  `PickRow` and `SettingRow`'s controls are `--control-h` tall on wide and keep their `--tap` hit box in the row on compact, where rows 30 px apart would put one row's hit area over the next one's box.

### 8.22 The sky first *(v3.0, FR-LAND, FR-STRIP, FR-DARK, FR-CTRL, FR-DS-10..14, FR-NOW, FR-UPD)*

What moves where, by lane (§16.1). This phase adds to `live` `src/lib/nextPassStrip.ts`, the live page's rail slots `src/ui/screens/sky/live/**` and the time controls `src/ui/components/sky/time/**` (where R187 moved `components/live/`'s time files); it adds `dev/**` and `tests/styles/**` to `ui`, each lane's allow files apart (D-1229).

| Lane | Added | Changed | Deleted |
|---|---|---|---|
| `ui` | `primitives/{Tag,Close,PickRow,Disclosure,ZoomKeys,SettingRow,StatusLine}.tsx`, `location/PlaceDialog.tsx`, `tests/styles/controls.test.ts`, `tests/styles/allow/*.json` | `tokens.css`, six primitives, `dev/primitives.*`, `App.tsx`, `Shell.tsx`, `Header.tsx`, `SkyViewLayout.tsx`, `SkyHint.tsx`, `Settings.tsx`, `screens/home/placeRequest.ts`, the location components, the pass list and cards, the catalogs | `Home.tsx`, `ExampleBand`, `HomeDoors`, `doorLines`, `ExampleNotice.tsx`, `FirstPassDialog.tsx` |
| `live` | `components/live/NextPassStrip.tsx`, the stars' groups, `lib/nextPassStrip.ts` | `Live.tsx`, `screens/sky/live/**`, `components/sky/time/**`, `ControlsSheet.tsx` (R216, R219) | `StatusStrip.tsx`, `OpeningCard.tsx`, `Stars.tsx`, `StarsRoute.ts`, `starsChunk.ts`, `screens/stars/**`, `screens/sky/stars/**`, `screens/home/{placeRequest,tonight}.ts` |
| `chart` | — | `dome/**`, `polar/**`, `globe/**`, `Legend.tsx`, `src/lib/legend.ts` | the glow, the globe's and the polar chart's tint |
| `window` | — | `SkyWindow.tsx`, `StarField.tsx`, `FacingPicker.tsx`, `skySurface.ts` | `tintStep`, `SURFACE_TOKENS` |
| `data` | — | `state/serviceWorker.ts` | — |
| `physics` | — | `model/measure.ts`, `scripts/funnel.ts` | — |

**Data model** (`docs/sdd/reference/data-model.md` follows in the task that changes it): `Prefs` loses `sunGlow` (R211, D-1235); `RouteName` loses `home` and `stars` (D-1230, D-1240); one device key is added, `wiys:hint:globe:v1` (`'1'` once the box was dragged or zoomed, D-1241); `EVENTS` gains `watch` and loses `door`, `open`'s `home` and `stars`, and `stars_open` (D-1242).
**Worker contract:** unchanged; the Sun's position the views draw is already in the scene.
**Constants:** `UPDATE_POLL_MIN` 30 (FR-UPD-1, in `state/serviceWorker.ts`); the strip reuses `TONIGHT_LEAD_MIN` and FR-LIVE-2's 24 h span; the loop's hold is 2 000 ms (FR-STRIP-4).

### 9.19 v3.0 additions *(FR-LAND, FR-STRIP, FR-DARK, FR-CTRL, FR-DS, FR-NOW, FR-UPD)*

- **Pure.** `lib/nextPassStrip.test.ts` (each kind, the span's edge, a pass up at the shown instant, `watchInstant`), `lib/legend.test.ts`'s compass cases (the 16 boundaries, below-horizon rows for the Sun and the Moon), `state/serviceWorker.test.ts` (`update()` on register, on visible, every 30 min, never while hidden).
- **Primitives.** A test per primitive form (FR-CTRL-17's verification): the box and the hit area, `aria-pressed` on an option, `aria-busy` and the fixed width under `busy`, `Tag` never a control, `Close`'s name in both languages, `PickRow`'s `aria-current`, `Disclosure`'s `aria-expanded`, `StatusLine`'s roles.
- **Ratchets.** `tests/styles/controls.test.ts` and the bracket rule (D-1229); `tests/styles/tokens.test.ts` for FR-DS-10's names; `contrast.ts` for the new pairs.
- **Components.** `NextPassStrip.test.tsx` (each kind, the compact `[example] <city>` prefix, `▶ play` / `❚❚ pause`, `● live` and the offset), `Legend.test.tsx`'s `upOnly` form,
  `PlaceDialog.test.tsx` (search, location, coordinates; a set place closes it), `Header.test.tsx` (the place line's two forms, `Set your place`, the current tab's underline, `← back`), `UpdateBanner` in `Shell` on every route.
- **End to end.** `landing.spec.ts`: `/`, `/#`, `/#nope` and `#stars?…` at 390 × 844 and 1280 × 800 (FR-LAND-1, FR-LAND-3); the wide globe and the compact window by default and a stored view winning (FR-LAND-2).
  `live-strip.spec.ts`: US-63's walk and US-62 AC4 (no dialog or card over the sky) at both widths; `live-rail.spec.ts` rewritten to FR-NOW-1's order, all seven groups by R222; `dark-sky.spec.ts`: noon in each view draws every rung and the Sun's dot (FR-DARK-2), the day line by day and not in twilight or the dark (FR-DARK-3).
  `update-banner.spec.ts`: its fake `navigator.serviceWorker` (a second build cannot be made inside a test) gains an `update()` that yields a waiting worker after a `visibilitychange`, and the bar shows within 10 s on `#live`, `#pass` and `#settings` (US-66); `rhythm.spec.ts`: FR-DS-12's measures; `one-scroll.spec.ts`: FR-CTRL-10's walk at three sizes.
- **Deleted.** The home's specs and tests (`home.spec.ts`, `home-desk.spec.ts`, `firstRun.spec.ts`'s home cases, `Home*.test.tsx`), the first-pass dialog's (`live-dialog.spec.ts`, `FirstPassDialog.test.tsx`), the stars page's (`Stars*.test.tsx`), `exampleWait.spec.ts` re-pointed at the live page; each task names the files it deletes.
- **Captures.** The gallery per theme and width with every state (FR-DS-13); the whole set shot by `captures.yml` after R227, every capture moved (§4.64), with D-1245's new states.

### 11.11 v3.0 build *(FR-UPD-1, FR-LAND-3)*

No dependency is added and no host joins the CSP.
The `home` and `stars` chunks go; the stars' groups load with the live chunk, which the first page now always loads (D-1246).
`sw.js` is unchanged: the check is the registration's `update()`, one request for `sw.js` per check (FR-UPD-1's rationale).

### 16.38 v3.0 delivery *(V30-1..V30-32, D-1224..D-1246)*

The gate is v2.14's: every task `Gate: auto`, release preparation included, merged by the driver on CI green and a clean review; the tag `v3.0.0` and the deploy stay the owner's (V30-31).
Twenty-two tasks in nine waves, at most three a wave and one per lane (§16.1–§16.3); waves 1 and 2 are the design system's (D-1224).
The run is `npm run sdd -- --wave --until-done` (driver PR #307): it loops wave after wave, runs up to two fix sessions on red CI or findings, skips a task that is blocked or fails twice, and sleeps through a limit; at rebase and before a merge it settles the plan's decision blocks, `ids.md`, `map.md`, `traceability.md` and the catalog snapshot itself.
v2.14's sessions that stopped were its big ones (R184, R185 near the ceiling, R186 four times on budget), so no task is planned past about 600 changed lines (FR-SDD-21) and the big pieces are split by surface.

**No `fable` this phase.** `claude -p --model fable` is refused on this account without usage credits (checked 2026-11-21, `credits_required`).
So the two tasks that would have been `hard` run on Opus and are cut smaller instead: the design system across R206 and R209 (`ZoomKeys` to R214, D-1228), the live rail across R216 (the order, the slots, the one scroll) and R219 (`Up now` as rows).
Every implementation task is `standard` (Opus) but R226, the documents' sweep, which is `light` (Sonnet).

| Wave | Task | Lane | Tier (model) | Review | Gate | Depends on |
|---|---|---|---|---|---|---|
| 1 | R206 — The controls' look: the tokens, five primitives, the gallery's states, the width tables (D-1225..D-1227) | `ui` | standard (opus) | opus | auto | — |
| 1 | R207 — The update check (D-1236) | `data` | standard (opus) | sonnet | auto | — |
| 1 | R208 — The desk plays on opening (D-1233) | `live` | standard (opus) | sonnet | auto | — |
| 2 | R209 — Every control is a primitive: `Field`, `busy`, six new primitives, the ratchets (D-1226, D-1228, D-1229) | `ui` | standard (opus) | opus | auto | R206 |
| 2 | R210 — The events: `watch`, the funnel's base (D-1242) | `physics` | standard (opus) | sonnet | auto | R206 |
| 2 | R211 — A dark dome, polar chart and globe at noon; the glow goes (D-1234, D-1235) | `chart` | standard (opus) | sonnet | auto | R206 |
| 3 | R212 — The live page is the first page; the home goes; `#pass` lists tonight; the bar in the shell (D-1230, D-1231, D-1237) | `ui` | standard (opus) | opus | auto | R209, R210 |
| 3 | R213 — The next-pass strip; no question on opening (D-1232) | `live` | standard (opus) | opus | auto | R208, R209, R210 |
| 3 | R214 — The window: dark at noon, `ZoomKeys`, the hint, the two tokens gone (D-1234, D-1241) | `window` | standard (opus) | sonnet | auto | R209, R211 |
| 4 | R215 — The place line in the header, the place dialog, the tabs (D-1238) | `ui` | standard (opus) | opus | auto | R212 |
| 4 | R216 — The live rail in order, seven slots, one scroll, the sheet in the same order (D-1239) | `live` | standard (opus) | opus | auto | R213, R214 |
| 4 | R217 — The globe's zoom keys; the legend's `upOnly` form and rows (D-1239, D-1241) | `chart` | standard (opus) | sonnet | auto | R214 |
| 5 | R218 — The place group's controls (D-1226) | `ui` | standard (opus) | sonnet | auto | R215 |
| 5 | R219 — `Up now` and the sky's state as rows; the sheet's place line (D-1238, D-1239) | `live` | standard (opus) | sonnet | auto | R215, R216, R217 |
| 5 | R220 — The update bar on every page (D-1237) | `data` | standard (opus) | sonnet | auto | R207, R215 |
| 6 | R221 — Rows you pick, tags, disclosures: the pass lists (D-1229) | `ui` | standard (opus) | sonnet | auto | R218 |
| 6 | R222 — The stars fold into live; no place, no example; live as a tab (D-1230, D-1240) | `live` | standard (opus) | opus | auto | R215, R219 |
| 6 | R223 — The time row's buttons (FR-CTRL-16) | `window` | standard (opus) | sonnet | auto | R209, R219 |
| 7 | R224 — One close, links in a line, the remaining buttons, one feedback; the lists empty (D-1229) | `ui` | standard (opus) | opus | auto | R221, R222, R223 |
| 8 | R225 — One rhythm: the settings page, the rails, the walk (FR-DS-12, FR-CTRL-10) | `ui` | standard (opus) | sonnet | auto | R224 |
| 8 | R226 — The documents swept (D-1243, D-1244) | `docs` | light (sonnet) | sonnet | auto | R217, R224 |
| 9 | R227 — 3.0.0: the budget, the README, the record, the version (D-1245, D-1246) | `docs` | standard (opus) | sonnet | auto | R225, R226 |

**Files two tasks of a wave could share, and who holds them.**
- Wave 2: R211 crosses into the window lane, `ui`, `physics` and `data` for the glow (D-1235); R209 touches neither `Settings.tsx` nor the catalogs' `sunGlow` keys, and the ratchet fails only on a raised count (D-1229), so R211 lowering a count never breaks R209.
- Wave 3: `Live.tsx` is R213's alone (R212 never edits it, D-1230); the home's helpers stay where they are; `captureSet.ts` and `tests/docs/captures.test.ts` are R212's for both (D-1230); `primitives/ZoomKeys.tsx` is R214's.
- Wave 4: `Live.tsx`, `SkyViewLayout.tsx` and `ControlsSheet.tsx` are R216's; R215 edits `Stars.tsx`, `PassDetail.tsx`, `VisitNotice.tsx` and `placeRequest.ts`, never `Live.tsx`; R217 edits `SkyGlobe.tsx` and `Legend.tsx`, never a live screen.
- Wave 5: `ControlsSheet.tsx` is R219's; `Shell.tsx` and `UpdateBanner.tsx` are R220's (a `data` task crossing into `ui` by name).
- Wave 6: `Live.tsx` and the stars' screens are R222's, `Card`'s `selected` callers there included; `components/sky/time/**` is R223's (the `window` lane by name, since `live` holds R222); R221 edits only `components/passes/**`, `components/now/**`, `components/guide/**` (not `skychart/`), `common/Banner.tsx` and `primitives/Card.tsx`.
- Wave 8: R226 sweeps beside R225; R225 changes no stale string's file outside `Settings.tsx` and the rails, and R227 runs `tests/docs/stale.test.ts` again on the last tree.

**Sessions:** `Turns: 500` on the six larger tasks (R206, R209, R212, R216, R222, R224), where the wall clock it scales is needed; `Turns: 300` elsewhere; the 40 M token ceiling binds near 200–250 turns either way. `Fallback: off`; `Review:` as the table.
Every task updates the documents its change touches (D-1243).

**The budget,** from `sdd-run/usage.jsonl`: v2.14's ten tasks logged about 85 M input and 0.4 M output, but its budget-stopped sessions logged 0, and counted at the ceiling a task cost about 31 M.
Six larger tasks at about 31 M, sixteen smaller at 8–15 M, twenty-two reviews at about 1 M, about ten fix sessions at 5 M and the resumes come to **about 350–500 M input and 2–3 M output, about 11–17 five-hour windows, 3½–5 days**.
The weekly limit can become a real stop; the loop sleeps through it as through the five-hour one, and nobody needs to watch.

**The schedule it implies:** waves 1 to 6 about 3–4 h each, waves 7 to 9 about 2.5–3 h, about 30 h of work; the limits stretch it to the 3½–5 days above.
The critical path is R206 → R209 → R212 → R215 → R218 → R221 → R224 → R225 → R227.

**Owner gates:** none inside the run.
After R227: the `captures.yml` run that shoots the set (D-1245), the gallery and the pages the record names checked by hand (FR-DS-14), the desk and phone runs, the overruns R227 names; then the tag `v3.0.0` and the deploy.

- **D-1250 — The 30 minutes are the clock's, looked at by the minute.** *(R207)*
  (FR-UPD-1, D-1236.) While visible a one-minute timer compares the host's clock with the last check and calls `update()` at `UPDATE_POLL_MIN`; a single 30-minute timer would run late by however long the machine slept.
  The host's document is the existing `VisibilitySource` (`documentVisibility`), so the module adds no second reading of `visibilitychange`.
- **D-1251 — A load in the background still checks once.** *(R207)*
  (FR-UPD-1, D-1236.) `update()` runs once after registering whether or not the page is visible, as both texts say "on load"; "never while hidden" is the timer's rule, and a hidden page holds no timer.
  A failed check is dropped and the next one is the retry.
- **D-1262 — The Sun's dot is drawn while it is up; its legend line keeps twilight.** *(R211)*
  (FR-DARK-2, FR-DARK-4, FR-DOME-6, FR-LEG-3.) The dome and the polar chart draw the dot while the Sun's centre is above 0°, as they draw the Moon (`sunVisible`): a filled spot in `--chart-sun` under the Moon.
  The legend's line keeps its old reach, down to −18° (`sunListed`), so a twilight reader still reads how far down the Sun is.
  The window loses the glow with the prop and has no mark for the Sun until R214 draws its dot.
- **D-1263 — The dome's sky is its bowl, in the deep token; the key light stays the Sun's.** *(R211)*
  (FR-DARK-1, FR-DOME-8.) The dome has no CSS surface, so its palette's `sky` is `--chart-sky-deep` in place of `--chart-sky`, which the stripes keep.
  FR-DOME-8's key light still follows the Sun and still shades the bowl's side: glyphcss multiplies the polygon's colour by the lights, so a near-black bowl stays near-black at every altitude.
- **D-1264 — The step is deleted, and what reads it for the eye reads the Sun.** *(R211)*
  (FR-DARK-2, D-1234, D-1139 superseded.) With every rung drawn the cut has no caller, so `drawnRungs`, `planetsDrawn`, the scene's twilight and day branches and the globe's day cut and fade (`dayStars`) are deleted rather than left returning a constant; a highlighted pass has its landmark at every hour.
  Two readers said what the eye can find rather than what is drawn, and keep saying it from the Sun's altitude: the stars page's `Stars from 20:25` and the home door's brightest star, both none of it while the Sun is above 0°; in twilight the door's star is no longer held to the first two rungs.

- **D-1259 — The watch row stands where the door row stood, and is not split.** *(R210)*
  (FR-MEAS-6 as amended, D-1242.) The rows are `example_shown`, `where_shown`, `place_set`, `watch` and `pass_open`; `watch` takes no detail, so it has one line.
  A window that spans the release sums both sides under the one base and ignores the stored `door` rows; the header reads "share of open, any route".
- **D-1260 — The data model gains the event list.** *(R210)*
  (D-1242, D-1243.) R210 names an event list in `docs/sdd/reference/data-model.md` and that page had none, so it is written there whole, from `EVENTS`.
  A task that adds or removes a name or a detail (R212, R222) edits that table with it, as D-1243 asks.
- **D-1268 — One row on the phone, a block on the desk.** *(R213)*
  (FR-STRIP-1, FR-STRIP-2, FR-STRIP-3, D-1232, V30-30, V30-32.) On compact the strip is one text row, and while the instant is held `● back to live` takes `▶ watch`'s place in it: the row cannot hold both beside `[example] <city>`; the rail shows both.
  The row's text gives from the name first, then the times, the lead and the city; the tag never. The countdown and the direction are read at the shown instant, and a time says `UTC` where the place has no zone.
  On wide `none` and `up` keep the block's own words and reasons (V30-30); `up` adds the `sets · look` line under it.
  `[ follow ]`, `[ controls ]` and the hint stand a tap higher, over the strip. `▶ watch` lands paused under reduced motion (FR-TONIGHT-2).
- **D-1269 — Compact's play button has a row of its own; watch's speed is the run's.** *(R213)*
  (FR-STRIP-2, FR-STRIP-6, FR-TONIGHT-4.) The button stands over `tonight`, `next` and `now`, so its two faces never move them and the Spanish words fit at 360 px.
  `▶ watch`'s 60× on a desk is never saved: `● back to live` and the next visit have the saved rate.
- **D-1270 — The time line is the head's on a phone and the clock's on a desk.** *(R213)*
  (FR-STRIP-6, FR-DARK-3, FR-TONIGHT-7.) On compact the head's line ends `● live` or the offset, so the chip's `tonight` and weekday words leave it; the stars page's clock keeps the chip.
  On wide the clock's line ends `● live` and the held readout carries the offset, so the indicator's word `live` is only spoken.
  The daytime line wraps as a line of its own at the context line's end; the rail, which has no context line, draws it under the strip.
  `● en vivo` is about 25 px wider than `ahora`, so the follow refusal at 844 × 390 in Spanish covers 0.123 of the box; `follow.spec.ts` reads that transient state against `FULL_OVERLAY_MAX_SHARE` + 0.005, and the closed-sheet budget is unchanged.

- **D-1271 — The keys are named by their host, and `⟲` is the opening rule at 60°.** *(R214)*
  (FR-CTRL-9, D-1228, D-1241, D-703.) `ZoomKeys` imports no catalog, so beside D-1228's three presses it takes `names`, and `end` for the key that FR-GLOBE-6 disables at its end of the range.
  `⟲` runs the window's opening rule again at the shown instant (the peak, the followed pass or the next rise, the pole side) at `WINDOW_FOV`, as the globe's `Home` does at zoom 1; the saved field would make it a key that does nothing after a reload.
  It ends following the phone as a drag does; `−` and `+` keep it, as a pinch does.
- **D-1272 — In a sky layout the plain wheel zooms the window, a key's step a notch.** *(R214)*
  (FR-CTRL-9, D-1241; FR-SKY-14's "a plain wheel scrolls" and its 0.002 a pixel superseded.) The hint says "scroll to zoom" and no sky layout scrolls under its box, so the plain wheel zooms there; outside a layout it is left to the page, and ctrl + wheel zooms everywhere.
  `ZOOM_WHEEL_RATE` is ln 1.25 / 100, so a notch is `ZOOM_KEY_FACTOR` and one event moves a notch at most, as the globe's wheel; the keys keep 1.25 and three `+` still read 30°. The pinch stays the fingers' own ratio, clamped to the same range.
- **D-1273 — The row is reserved on every wide view, and the hint's key is the zooming views'.** *(R214)*
  (FR-CTRL-9, D-1241, FR-WIDE-1, FR-WIDE-10.) The box is a `--target` shorter on every view, so a change of view moves no edge of it; the row hangs inside the drawing's element, so full screen keeps the keys, there over the box's foot with the hint a row higher.
  At 964 × 420 the reserved row left the box 170 px, under FR-SHP-3's `LIVE_BOX_MIN_PX`; so under `LANDSCAPE_PHONE_QUERY` (landscape, 500 px tall or less: the short-wide rows and the landscape phone) the box keeps its height and the row stands over its foot as when full, the one existing height fold rather than a fourth (FR-DS-3).
  `wiys:hint:globe:v1` governs the window's and the globe's line, which a tap no longer dismisses and which has no follow clause; the dome, which does not zoom, keeps its drag line and `skyHintSeen`.

- **D-1280 — The globe's hint is shown by the stars page, and any zoom ends it.** *(R217)*
  (FR-CTRL-9, D-1241, D-1273.) The hint is the page's slot, and `Stars.tsx` had held it off the wide globe since R170; R217's one line there drops that guard, the only edit outside its lane, so the globe "carries the hint" as the task asks.
  `zoomBy` ends it, so the keys, the wheel, the pinch and the `+` / `-` keys all do; so does the first drag past `HIT_RADIUS_PX` and `⟲` / `Home`. A tap does not. Box keys and the zoom range are FR-GLOBE-6's, unchanged.
- **D-1281 — `Up now` lists the Moon before the Sun and drops the key letter.** *(R217)*
  (FR-NOW-2, D-1239.) FR-NOW-2's prose says "the Sun and the Moon" but its example and D-1239 put the Moon first; the example wins. A row is FR-NOW-2's four cells (swatch, name, point, height): the arc's key letter and the times are the full legend's.
  A row is up when its marker, interpolated at the shown instant on the pass's track (`LegendRow.at`), is above 0°; a FR-LIVE-6 hidden object is never up. Heights round to whole degrees and `−0.4°` reads `0° up`.
- **D-1282 — The columns are measured in characters, and the legend's pick is the primitive's.** *(R217)*
  (FR-NOW-2, FR-CTRL-15, FR-DS-10.) `upNowColumns` gives the point and height columns their widest entry in `ch`, which aligns them because the app's face is mono; the name column takes what is left and ellipsises.
  The rows' layout moved into an inner `.cells` span, so `PickRow` keeps its own ground, line and padding; the body and empty lines indent by one `--cell` for the row's padding, since a module outside the primitives may not read `--control-pad`. The chart lane's brackets list was already `{}`: no bracketed word is left inside `skychart/`, so "the chart's tags" had nothing to convert.

**Decision blocks** (§16.2): **R206 D-1247..D-1249, R207 D-1250..D-1252, R208 D-1253..D-1255, R209 D-1256..D-1258, R210 D-1259..D-1261, R211 D-1262..D-1264, R212 D-1265..D-1267, R213 D-1268..D-1270,
R214 D-1271..D-1273, R215 D-1274..D-1276, R216 D-1277..D-1279, R217 D-1280..D-1282, R218 D-1283..D-1285, R219 D-1286..D-1288, R220 D-1289..D-1291, R221 D-1292..D-1294,
R222 D-1295..D-1297, R223 D-1298..D-1300, R224 D-1301..D-1303, R225 D-1304..D-1306, R226 D-1307..D-1308, R227 D-1309..D-1311.**
D-1224..D-1246 are this plan's.
