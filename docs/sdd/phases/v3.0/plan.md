# v3.0 — PLAN.md sections

Phase file of PLAN.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.55 v3.0 decisions (2026-11-21)

- **D-1224 — The design system's wave is driver waves 1 and 2.**
  (FR-DS-14; V30-28, V30-31.) R206 (the tokens and the looks of every existing primitive, the gallery's states) runs in wave 1 and R209 (the new primitives and the controls test) in wave 2; both touch `src/ui/components/primitives/**`, so they cannot share a wave.
  Beside them run only tasks that add no control and restyle none: the update check, playback's opening, the events, the sky drawing.
  Every screen task depends on R209, so none starts before both are on `main`; nothing is tagged or deployed between waves (V30-31).
- **D-1225 — The control tokens sit in `:root` once, read by both themes.**
  (FR-DS-10.) `src/ui/styles/tokens.css` gains `--control-h`, `--control-pad`, `--control-radius`, `--control-edge`, `--on-ground`, `--on-ink`, `--hover-ground`, `--mark`, `--gap-row`, `--gap-group` and `--label-col` with FR-DS-10's defaults, each an alias of an existing token, so a theme changes them by changing what they alias.
  `scripts/contrast.ts` checks `--on-ink` on `--on-ground` and `--control-edge` on `--bg` (WCAG 1.4.11, 3 : 1); `tests/styles/tokens.test.ts` pins the names.
  No module outside `primitives/` and `dev/` reads a control token in this phase except through a primitive.
- **D-1226 — The drawn box is smaller than the hit box.**
  (FR-CTRL-1, FR-CTRL-7, G6.) `TextButton`, `Field`'s input and the option of `OptionToggle` draw their box on an inner element `--control-h` tall; the element itself keeps `inline-control`'s `--tap` hit area on compact by padding, so no row of a page grows and `tests/styles/targets.test.ts` still holds.
  `TextButton` gains `box?: 'plain' | 'accent'` (the primary form, FR-CTRL-1) and `busy?: boolean` (FR-CTRL-4: the label and box fixed, `aria-busy`, the words pulsing between 1 and 0.35 opacity, held at 0.35 under reduced motion).
  The brackets leave the primitives' render, not the callers' labels: a caller that passes `[ x ]` text is fixed by the task that owns it.
- **D-1227 — The gallery's states are forced by the browser, not by the page.**
  (FR-DS-13.) `dev/primitives.tsx` lays every primitive once per state (rest, hover, focus, on, picked, busy, disabled, error) in a cell with a stable `data-state` id, in both themes; `tests/e2e/design-captures.spec.ts` forces `:hover` and `:focus-visible` on those cells through CDP `CSS.forcePseudoState`, so no production CSS carries a test selector.
  `captureSet.ts`'s `design` group stays four files (two themes × 390 and 1280 px), each now taller; `manifest.ts` gains a `states` list per row that the gallery and the guide (`npm run design:guide`) both read.
- **D-1228 — The new primitives and their props.**
  (FR-DS-11.) In `src/ui/components/primitives/`, each with a test and a manifest row: `Tag({ tone, children })` → `[word]`; `Close({ onClose, label? })` → the bare `×`, name "Close" / "Cerrar"; `PickRow({ picked, onPick | href, current? })`; `Disclosure({ open, onToggle, label, count? })` → `▸` / `▾`; `ZoomKeys({ onIn, onOut, onReset })`; `SettingRow({ label, children })`; `StatusLine({ tone: 'progress' | 'failure' | 'ok' | 'empty', children })` → `role="status"`, or `role="alert"` for `failure`.
  `Line` keeps its tones; `StatusLine` composes it.
- **D-1229 — Two ratchets keep the controls in the primitives.**
  (FR-DS-11, FR-CTRL-14, FR-DS-2 as amended.) `tests/styles/controls.test.ts` parses every `.tsx` under `src/ui` outside `primitives/` and counts JSX `<button`, `<a` and `<input`; `tests/styles/controls.allow.json` maps a file to its count and a reason.
  The test fails on a file over its count and on a file under it whose entry was not lowered, so the list only shrinks; R209 seeds it at the day's counts and R221 leaves it `{}`.
  The bracket rule is the same shape: `tests/styles/literals.ts` gains a check for a bracketed word (`[` text `]`) in TSX text and in the catalogs outside `Tag`, its list `tests/styles/brackets.allow.json`, emptied by the same tasks.
- **D-1230 — The route with no hash is the live route.**
  (FR-LAND-1.) `App.tsx`'s route reader maps an empty hash, `#` and any hash that names no route to `live` and replaces the URL's hash with `#live` through `history.replaceState` before the first render, so no history entry is written.
  `RouteName` loses `home` (R212) and `stars` (R219); `routeTitle` and `openedRoute` follow.
  `Home.tsx`, `screens/home/**` save the pieces the pass list keeps (D-1231), `ExampleBand`, the doors and their tests are deleted; `npm run check:dead` decides what else goes.
- **D-1231 — The compact satellites page is `#pass` with no pass.**
  (FR-LAND-6.) On compact `#pass` with no id draws tonight's list: FR-FIRST-3's cards (`components/passes/**`) and tonight's stripe (`components/now/TonightStripe.tsx`) as the home drew them, in `src/ui/screens/sky/pass/Empty.tsx`'s compact branch; what the home kept under `screens/home/` for them (`shownPasses.ts`, `useNight.ts`) moves to `src/ui/screens/pass/`.
  A card opens the pass sheet as today.
  On wide `#pass` with no id is today's pass page of the pass up now or next (FR-CLEAN-14).
- **D-1232 — The strip is one pure function.**
  (FR-STRIP-1..3.) `src/lib/nextPassStrip.ts` (the `live` lane) exports `nextPassStrip({ passes, shownMs, nowMs })` → `{ kind: 'next', pass } | { kind: 'up', pass } | { kind: 'none' }` and `watchInstant(pass)` = rise − `TONIGHT_LEAD_MIN`; the component `src/ui/components/live/NextPassStrip.tsx` draws it at the box's foot on compact and as the rail's head on wide (FR-STRIP-1, V30-30).
  `FirstPassDialog.tsx`, the compact `OpeningCard.tsx` and `lib/tonightJump.ts`'s automatic landing go with their tests (FR-STRIP-5).
- **D-1233 — Playback learns how a page opens.**
  (FR-STRIP-4, FR-LAND-2.) `usePlayback` takes `opening?: { speed, loop?: { fromMs, toMs, holdMs } }`: the wide live page passes `{ speed: 1 }`, the wide pass page `{ speed: 60, loop: { rise, set, 2000 } }`; a hash holding `t` or `prefers-reduced-motion: reduce` opens paused whatever is passed.
  The loop stops for good at the first pause or move of the time by the reader.
- **D-1234 — One sky surface in every view, every rung at every hour.**
  (FR-DARK-1, FR-DARK-2.) The dome, the polar chart and the window fill the sky with `--chart-sky-deep`; the function that thinned the stars by the Sun's altitude returns every rung; each view draws the Sun as its dot where the globe already does.
  R211 makes the dome and the polar chart stop reading `--chart-sky-day` and `--chart-sky-twilight`, R214 the window, and R214 then deletes both tokens and their `scripts/contrast.ts` rows.
- **D-1235 — The sun glow goes in one task across four files.**
  (FR-DARK-4.) R211 removes `FR-DOME-6`'s glow from the dome, the settings row, and `sunGlow` from `src/model/prefs.ts`, `src/state/slices/prefs.ts` and `src/data/localPrefs.ts`: a stored `sunGlow` is ignored on load and not written on the next save.
  These are outside the `chart` lane; no other wave-2 task touches them, which is what the lane rule protects, so they are named on the task rather than split into three tasks.
- **D-1236 — The update check is injected and timed by visibility.**
  (FR-UPD-1.) `src/state/serviceWorker.ts` gains `watchForUpdates(registration, host)` with `UPDATE_POLL_MIN` (30) exported: `update()` once after registering, on each `visibilitychange` to visible, and every 30 min while visible, the timer cleared while hidden; `host` carries the document, the timers and the clock so the unit test drives it with fake timers.
- **D-1237 — The update bar is the shell's.**
  (FR-UPD-2, FR-OFF-1 as amended.) `Shell.tsx` draws `UpdateBanner` in a slot directly under the banner (the header) on every route, never inside `main`'s sky box; the home's copy goes with the home.
  `reload` is a `TextButton` that posts `SKIP_WAITING` and reloads on `controllerchange`, as today.
- **D-1238 — The place line is the header's, and the place dialog hosts the place group.**
  (FR-LAND-4, FR-LAND-5's header reading, FR-MEAS-2 as amended.) `Header` takes `place: { label, example } | null` and `onChangePlace`; on wide it is drawn centred in the header row, on compact by `ControlsSheet`'s head and the satellites list's head.
  `src/ui/components/location/PlaceDialog.tsx` is `AskDialog`'s frame around `LocationInput`'s group; a place set there closes it; `where_shown` is sent when it opens; `ExampleNotice` and `placeRequest.ts` go.
- **D-1239 — The rail's order is one list, and the rail is the column's one scroll.**
  (FR-NOW-1, FR-CTRL-10, FR-WIDE-1 as amended.) `SkyViewLayout`'s `SLOT_ORDER` becomes `strip, view, time, turn, layers, upNow, upFrom`; the compact `ControlsSheet` renders the same slots in the same order; V214-33's 7.5-row cap and every inner `overflow: auto` in the rail go.
  `Up now` is `src/ui/components/live/UpNow.tsx` over a pure `src/lib/upNow.ts` (16-point compass, rounded degrees, satellites by height then the Sun and the Moon); `StatusStrip.tsx` goes for its `SettingRow`s (FR-NOW-3).
- **D-1240 — The stars page's groups move into the live lane.**
  (FR-LAND-3, FR-STAR-3 as amended.) `Turn`, `Layers` and `Up from <place>` move from `screens/Stars.tsx`, `screens/stars/**` and `screens/sky/stars/**` to `src/ui/components/live/`; those files, `StarsRoute.ts`, `starsChunk.ts` and the `stars` budget row go (the globe's own chunk, `globeChunk.ts`, moves with them and stays a chunk).
  A load of `#stars…` is rewritten to `#live` with the parameters `useLiveRoute` parses, the others dropped; the `stars` route's title and `open` detail go with it.
- **D-1241 — The zoom keys sit under the box, and the hint is one key.**
  (FR-CTRL-9.) `SkyViewLayout`'s `zoom` chart slot moves from the box's bottom-right corner to the row under the box, at its left (R214); the window (R214) and the globe (R217) portal `ZoomKeys` into it, each with steps equal to its wheel and pinch step and `⟲` to its opening camera.
  The hint `drag to turn · scroll to zoom` replaces `SkyHint`'s wide line in the corner until the first drag or zoom; `wiys:hint:globe:v1` is written then, by both views.
- **D-1242 — The events: `watch` arrives first, `door` leaves with the home.**
  (FR-MEAS-2, FR-MEAS-6 as amended.) R210 adds `watch: []` to `src/model/measure.ts`'s `EVENTS` and moves `scripts/funnel.ts`'s base to first-visit `open` on `live`, with a `watch` row and no `door` row; R212 deletes `door` with its last sender, R213 sends `watch` once per visit, R215 sends `where_shown` from the place dialog.
- **D-1243 — Every task leaves the repository consistent.**
  (The owner's rule, 2026-11-21.) Each task updates, in the same pull request, what its change makes untrue: `docs/sdd/map.md`'s rows for each file it adds, moves or deletes; the `docs/sdd/reference/*` page that describes it (glossary, data model, worker contract, testing, build and deploy); a section of `docs/sdd/gotchas.md` for a new trap; both catalogs for every user-facing word.
  Each task's `Done when` carries `npm run check:sdd` and `tests/docs/**` green.
- **D-1244 — The sweep is a task and a test.**
  (The definition of done, V30-31.) R223 sweeps `README.md`, `docs/RELEASE.md`, `docs/DESIGN.md`, `docs/HOW-THIS-WAS-BUILT.md` and every page under `docs/` outside the phase folders and the logs for the removed home, the `#stars` route, the bracketed controls, `sunGlow`, the first-pass question and the version, and fixes them.
  It adds `tests/docs/stale.test.ts`, which fails on a listed stale string (`#stars`, `[ home ]`, `[ set your place ]`, `sunGlow`, `Next up`, the home's capture names) in those files and the catalogs; history (`decisions.md`, `revision-history.md`, closed phases, release records) is exempt.
  The definition of done gains: the sweep's test green on the release commit.
- **D-1245 — The capture set loses the home and the stars page and gains the live page's new states.**
  (FR-DS-14, the definition of done.) Each screen task updates `tests/e2e/captureSet.ts`'s manifest for the screens it removes or renames (the home's names, the stars page's, the first-pass dialog's) so `tests/docs/captures.test.ts` stays green; no task but R206 and R209 (the gallery) shoots captures; R224 re-shoots the whole set and the release record names every move by requirement.
- **D-1246 — The budget rows follow the chunks.**
  (The definition of done.) The `home` and `stars` rows leave `scripts/bundle-budget.ts` with their chunks (R212, R219); the `live` row grows by the stars' groups and the strip, a named reason (FR-LAND-3, FR-STRIP-1); R224 re-sets every row by D-178 and names any row over 2.16.0's by more than 1 KB.

### 8.22 The sky first *(v3.0, FR-LAND, FR-STRIP, FR-DARK, FR-CTRL, FR-DS-10..14, FR-NOW, FR-UPD)*

What moves where, by lane (§16.1; this phase adds `src/lib/{nextPassStrip,upNow}.ts` and the live page's rail slots `src/ui/screens/sky/live/**` to `live`, and `dev/**` to `ui`):

| Lane | Added | Changed | Deleted |
|---|---|---|---|
| `ui` | `primitives/{Tag,Close,PickRow,Disclosure,ZoomKeys,SettingRow,StatusLine}.tsx`, `location/PlaceDialog.tsx`, `screens/pass/**`, `tests/styles/{controls.test.ts,controls.allow.json,brackets.allow.json}` | `tokens.css`, the six primitives, `dev/primitives.*`, `App.tsx`, `Shell.tsx`, `Header.tsx`, `ControlsSheet.tsx`, `SkyViewLayout.tsx`, `Settings.tsx`, the location components, the pass list and cards, the catalogs | `Home.tsx`, `screens/home/**` (less what moves), `ExampleNotice.tsx`, `FirstPassDialog.tsx`, `placeRequest.ts` |
| `live` | `components/live/{NextPassStrip,UpNow}.tsx`, the stars' groups, `lib/{nextPassStrip,upNow}.ts` | `Live.tsx`, `screens/sky/live/**`, `components/sky/time/**` | `StatusStrip.tsx`, `OpeningCard.tsx`, `Stars.tsx`, `StarsRoute.ts`, `starsChunk.ts`, `screens/stars/**`, `screens/sky/stars/**` |
| `chart` | — | `dome/**`, `polar/**`, `globe/SkyGlobe.tsx`, `Legend.tsx` | the glow |
| `window` | — | `SkyWindow.tsx`, `StarField.tsx`, `FacingPicker.tsx` | — |
| `data` | — | `state/serviceWorker.ts` | — |
| `physics` | — | `model/measure.ts`, `scripts/funnel.ts` | — |

**Data model** (`docs/sdd/reference/data-model.md` follows in the task that changes it): `Prefs` loses `sunGlow` (R211, D-1235); `RouteName` loses `home` and `stars` (D-1230, D-1240); one device key is added, `wiys:hint:globe:v1` (`'1'` once the box was dragged or zoomed, D-1241); `EVENTS` gains `watch` and loses `door` (D-1242).
**Worker contract:** unchanged; the Sun's position the views draw is already in the scene.
**Constants:** `UPDATE_POLL_MIN` 30 (FR-UPD-1, in `state/serviceWorker.ts`); the strip reuses `TONIGHT_LEAD_MIN` and FR-LIVE-2's 24 h span; the loop's hold is 2 000 ms (FR-STRIP-4).

### 9.19 v3.0 additions *(FR-LAND, FR-STRIP, FR-DARK, FR-CTRL, FR-DS, FR-NOW, FR-UPD)*

- **Pure.** `lib/nextPassStrip.test.ts` (each kind, the span's edge, a pass up at the shown instant, `watchInstant`), `lib/upNow.test.ts` (compass points at the 16 boundaries, below-horizon rows for the Sun and the Moon, the order), `state/serviceWorker.test.ts` (`update()` on register, on visible, every 30 min, never while hidden).
- **Primitives.** A test per primitive form (FR-CTRL-17's verification): the box and the hit area, `aria-pressed` on an option, `aria-busy` and the fixed width under `busy`, `Tag` never a control, `Close`'s name in both languages, `PickRow`'s `aria-current`, `Disclosure`'s `aria-expanded`, `StatusLine`'s roles.
- **Ratchets.** `tests/styles/controls.test.ts` and the bracket rule (D-1229); `tests/styles/tokens.test.ts` for FR-DS-10's names; `contrast.ts` for the new pairs.
- **Components.** `NextPassStrip.test.tsx`, `UpNow.test.tsx`, `PlaceDialog.test.tsx` (search, location, coordinates; a set place closes it), `Header.test.tsx` (the place line's two forms and `Set your place`), `UpdateBanner` in `Shell` on every route.
- **End to end.** `landing.spec.ts`: `/`, `/#`, `/#nope` and `#stars?…` at 390 × 844 and 1280 × 800 (FR-LAND-1, FR-LAND-3); `live-strip.spec.ts`: US-63's walk at both widths; `live-rail.spec.ts` rewritten to FR-NOW-1's order; `dark-sky.spec.ts`: noon in each view draws every rung (FR-DARK-2) and the day line (FR-DARK-3); `update.spec.ts`: a second worker deployed under the test server, the bar within 10 s of a visibility change on `#live`, `#pass` and `#settings` (US-66); `rhythm.spec.ts`: FR-DS-12's measures; `one-scroll.spec.ts`: FR-CTRL-10's walk at three sizes.
- **Deleted.** The home's specs and tests (`home.spec.ts`, `home-desk.spec.ts`, `firstRun.spec.ts`'s home cases, `Home*.test.tsx`), the first-pass dialog's (`live-dialog.spec.ts`, `FirstPassDialog.test.tsx`), the stars page's (`Stars*.test.tsx`), `exampleWait.spec.ts` re-pointed at the live page; each task names the files it deletes.
- **Captures.** The gallery per theme and width with every state (FR-DS-13); the whole set re-shot by R224, every capture moved (§4.64).

### 11.11 v3.0 build *(FR-UPD-1, FR-LAND-3)*

No dependency is added and no host joins the CSP.
The `home` and `stars` chunks go; the stars' groups load with the live chunk, which the first page now always loads (D-1246).
`sw.js` is unchanged: the check is the registration's `update()`, one request for `sw.js` per check (FR-UPD-1's rationale).

### 16.38 v3.0 delivery *(V30-1..V30-32, D-1224..D-1246)*

The gate is v2.14's: every task `Gate: auto`, release preparation included, merged on CI green and a clean review; the tag `v3.0.0` and the deploy stay the owner's (V30-31).
Nineteen tasks in nine waves, at most three a wave and one per lane (§16.1–§16.3); waves 1 and 2 are the design system's (D-1224).
v2.14's sessions that stopped were its big ones (R184, R185 near the 32.7 M ceiling, R186 four times on budget), so no task here is planned past about 600 changed lines (FR-SDD-21) and the controls sweep is cut by surface.

| Wave | Task | Lane | Tier (model) | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R206 — The controls' look in the design system: tokens, the six primitives, busy, the gallery's states (D-1225..D-1227) | `ui` | hard (fable) | auto | — |
| 1 | R207 — The update check (D-1236) | `data` | standard (opus) | auto | — |
| 1 | R208 — The desk plays on opening (D-1233) | `live` | standard (opus) | auto | — |
| 2 | R209 — Every control is a primitive: the seven new ones, the ratchets (D-1228, D-1229) | `ui` | standard (opus) | auto | R206 |
| 2 | R210 — The events: `watch`, the funnel on `live` (D-1242) | `physics` | standard (opus) | auto | R206 |
| 2 | R211 — A dark dome and polar chart at noon; the glow goes (D-1234, D-1235) | `chart` | standard (opus) | auto | R206 |
| 3 | R212 — The live page is the first page; the home goes; `#pass` lists tonight (D-1230, D-1231) | `ui` | standard (opus) | auto | R209, R210 |
| 3 | R213 — The next-pass strip; no question on opening (D-1232) | `live` | standard (opus) | auto | R208, R209, R210 |
| 3 | R214 — The window: dark at noon, the zoom keys, the two tokens gone (D-1234, D-1241) | `window` | standard (opus) | auto | R209, R211 |
| 4 | R215 — The place line in the header, the place dialog, the tabs, the update bar (D-1237, D-1238) | `ui` | standard (opus) | auto | R212 |
| 4 | R216 — The live rail, ordered: the strip as its head, `Up now`, the sky's state as rows, one scroll (D-1239) | `live` | hard (fable) | auto | R213, R214 |
| 4 | R217 — The globe's zoom keys and the legend's rows (D-1241) | `chart` | standard (opus) | auto | R214 |
| 5 | R218 — The place group's controls: busy, suggestions, saved places, one error (D-1226) | `ui` | standard (opus) | auto | R215 |
| 5 | R219 — The stars fold into live; no place, no example; the time row's buttons (D-1240) | `live` | standard (opus) | auto | R215, R216 |
| 6 | R220 — Rows you pick, tags, disclosures: the pass list and cards (D-1229) | `ui` | standard (opus) | auto | R218 |
| 7 | R221 — One close, links in a line, the remaining buttons, one feedback; the ratchets empty (D-1229) | `ui` | standard (opus) | auto | R220 |
| 8 | R222 — One rhythm: the settings page, the rails, the walk (FR-DS-12, FR-CTRL-10) | `ui` | standard (opus) | auto | R219, R221 |
| 8 | R223 — The documents swept (D-1243, D-1244) | `docs` | light (sonnet) | auto | R217, R219, R221 |
| 9 | R224 — 3.0.0: the capture set, the budget, the README, the record (D-1245, D-1246) | `docs` | standard (opus) | auto | R222, R223 |

R206 and R216 are the hard tasks, the only `fable` sessions: R206 sets every control's look that every later capture moves with, and R216 rebuilds the desk's rail and the compact sheet around the new order.
The `ui` lane is the long pole (R206, R209, R212, R215, R218, R220, R221, R222); the other lanes run beside it and finish by wave 5.
Files two lanes share are given to one task of a wave: `SkyViewLayout.tsx` to R214 (wave 3) and R216 (wave 4); `FirstPassDialog.tsx` to R213; `Stars.tsx` and `PassDetail.tsx` to R219 and R208; the prefs files and `Settings.tsx`'s glow row to R211 (D-1235).

**Sessions:** every entry is cut with `Tier:` as the table, `Turns: 500`, `Fallback: off`, `Review: opus`; every task is `Gate: auto`.
Every task updates the documents its change touches (D-1243).

**The budget,** from `sdd-run/usage.jsonl`: v2.14's ten tasks spent about 85 M input tokens, nearly all cached, and 0.4 M output; a finished `standard` session ran 3–32 M input and 10–100 k output in 15–48 min, and a review 0.2–1.6 M.
Nineteen tasks at about 10 M each and their reviews come to **about 200–240 M input and 1–1.5 M output, about 7–9 five-hour windows**; waves 1 and 4 hold the `fable` sessions, so the owner reads `/usage` before them.
Wait-and-resume is on; nothing is started with `--no-wait`.

**The schedule it implies:** waves 1 and 4 about 4 h each (the hard task sets them); waves 2, 3 and 5 about 3 h; waves 6, 7 and 8 about 2.5 h; wave 9 about 3 h with the capture set.
Unstopped about 27.5 h; with four or five five-hour stops about 2½ days.
The critical path is R206 → R209 → R212 → R215 → R218 → R220 → R221 → R222 → R224.

**Owner gates:** none inside the run.
After R224: the `captures.yml` runs against 2.16.0, the gallery and the pages named in the record checked by hand (FR-DS-14), the desk and phone runs, the overruns R224 names; then the tag `v3.0.0` and the deploy.

**Decision blocks** (§16.2): **R206 D-1247..D-1250, R207 D-1251..D-1253, R208 D-1254..D-1256, R209 D-1257..D-1259, R210 D-1260..D-1262, R211 D-1263..D-1265, R212 D-1266..D-1268, R213 D-1269..D-1271, R214 D-1272..D-1274, R215 D-1275..D-1277, R216 D-1278..D-1281, R217 D-1282..D-1284, R218 D-1285..D-1287, R219 D-1288..D-1290, R220 D-1291..D-1293, R221 D-1294..D-1296, R222 D-1297..D-1299, R223 D-1300..D-1301, R224 D-1302..D-1304.**
D-1224..D-1246 are this plan's.
