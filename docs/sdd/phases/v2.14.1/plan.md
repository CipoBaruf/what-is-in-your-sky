# v2.14.1 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.51 v2.14.1 decisions (2026-11-05)

- **D-1134 — The pass page is a header page: `page="pass"`, `[ ← ]`, `[ satellites ]`.**
  (FR-WIDE-1, FR-CLEAN-14 as amended; V214-26, V214-27.) `Header`'s `NAV_PAGES` gains `pass` between `live` and `stars`, its label `satellites` / `satélites`; the wide pass branch in `App.tsx` renders `<Header page="pass" onBack={…}>` in place of `homeLink`, so the back arrow and the current form come from the existing `sub` rule.
  `onBack` is the branch's existing close (`Esc`, `[ × ]`): home with the card scrolled into view.
  The link's href is `#pass=<id>` of `firstPassFor(passes, now)` — the pass with `arcState === 'live'` at now, else the first with a rise after now — computed in `App.tsx` from the store's passes; with none it is `#pass` with no id, which the pass branch renders with the list's empty line and no arc.
- **D-1135 — The rail's list is tonight's passes, opened in place.**
  (FR-WIDE-1 as amended.) The wide pass branch hands `PassDetail` a `PassList` filtered to the span of the page's time control (`now` to `now + LIVE_WINDOW_MS`), the selected row `aria-current`; a row calls `openPass`, which already only sets the hash, so the page re-renders on the new pass without the home.
  The `PassList` keeps its own scroll off inside the rail (the rail scrolls).
- **D-1136 — Nothing in the rail is wider than the rail.**
  (FR-WIDE-1 as amended.) `.rail` and `.rail > .list` set `overflow-x: hidden` beside `overflow-y: auto`, and every grid and flex child in the rail gets `min-width: 0`; `PassNumbers`' table drops `white-space: nowrap` for its prose cells and keeps it for the clock and numbers, its columns sized by the table at the rail's width, so the `.scroll` wrapper is no longer needed on wide.
  The rail's column keeps `minmax(44 cells, 60 cells)`; the page's cap (FR-CLEAN-12) bounds the layout, so the rail's right edge is inside the header's.
- **D-1137 — On the pass page the arc is the whole track, faced at open, at the rise.**
  (FR-WIDE-3 as amended; V214-28, supersedes D-1131's call.) `globeArcs` takes `whole?: boolean`; with it the polyline is the full track at every state and the marker is drawn only while `live`, at `t`; `guideTimes` follows.
  `SkyGlobeProps` gains `openCentre?: { azDeg: number; altDeg: number }`, used at mount, on a place change and on `Home` in place of `openView` when given; the pass page passes the peak's azimuth and `min(peak altitude, 60°)` so the whole arc is on the near side.
  `PassDetail`'s `usePlayback` takes `initial: pass.rise` (paused), and `[ now ]` is the control's existing return.
- **D-1138 — The stars page's time is the clock and the steps.**
  (FR-WIDE-4 as amended; V214-29.) `StarsTime` stops rendering `TimeControl`; it renders the clock readout (the place's zone), `[ now ]`, the speeds and the four steps, restoring the pre-R187 `GlobeClock` and `GlobeTime` markup (`3cf618fd^:src/ui/screens/stars/GlobeRail.tsx`) on top of the playback R187 kept, so `shiftDays` and the globe's instant are unchanged.
- **D-1139 — Day stars on the globe at `DAY_STARS_ALPHA`.**
  (FR-STAR-13 as amended; V214-30.) `drawnRungs` keeps its rule for the window, the dome and the polar chart; the globe's star source asks for `drawnRungs(max(sunAlt, −1))` rungs (the first two) when the Sun is up and the stars layer is on, and `GlobeRenderer` multiplies the star and figure opacity by `DAY_STARS_ALPHA` (0.35, `globe/constants.ts`) while the scene's tint step is `day`.
  `SkyChart`'s `GlobeView` stops falling back to `NO_STARS` layers by day.
- **D-1140 — The first-pass dialog is `FirstPassDialog`, from the overlay's parts.**
  (FR-WIDE-13; V214-31.) A new `components/sky/FirstPassDialog.tsx` uses `ShortcutsOverlay`'s portal and `useOpenerFocus`; `Live.tsx` shows it on wide when `nextEvent` at now is not `peak` or `end`, the span has a pass, the hash has no time, and a module-level `askedThisVisit` flag is unset.
  `go and play` calls `playback.stepTo(firstRise)` then `play()`; `stay here` and `Esc` close it; both set the flag.
  While shown, the headline's `[ see this pass ]` is not rendered.
- **D-1141 — A field's focus is its border.**
  (FR-WIDE-14; V214-31.) `global.css` adds `:is(input, select, textarea):focus-visible { outline: none; border-color: var(--accent); }` after the ring rule; no module restates it (D-704 holds for everything else).
  The accent against the surfaces is already checked at 3:1 for the ring (`contrast.test.ts`); the test gains the field border pair.

### 16.34 v2.14.1 delivery

One local branch, `v2-14-1-desk-fixes`, the docs first, then one commit per decision, each with its tests; no driver run, no push until the owner has read it (V214-25).
The owner's review is the gate; a fresh-context review of the diff runs before it.
