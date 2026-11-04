# v1.3 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.20 v1.3 decisions (2026-09-08)

These plan SPEC v1.3 (V13-1..V13-5). v1.2 spent D-276..D-320 (its per-task blocks included); v1.3 starts at D-321, and §16.10 reserves the per-task blocks from D-328.

- **D-321 — The follow screen is a fixed layer the live page renders in place of its grid, and the v1.2 override is its switch.**
  (FR-FSC-1, FR-FSC-2; D-277.) `useFollowPhone`'s `state === 'on'` is `viewOverride === 'window'` already, so nothing new is stored: while it holds, `Live.tsx` renders `components/live/FollowScreen.tsx` instead of the `.page` grid — the header included is covered, not unmounted — as a `position: fixed; inset: 0; height: 100dvh` layer on the theme's page background, above everything (one z-index token, `--z-follow`).
  The page's hooks are the page's and not the grid's, so they stay mounted: the passes and the stored set (FR-LIVE-11), playback and R48's `now` effect (FR-FOL-3), the wake lock (D-174, so the screen stays awake), `useHiddenObjects` (D-325).
  Closing is the call the second press makes today, `follow.toggle()` — `setViewOverride(null)` — from the `×`, from `Esc`, and from the page's unmount (FR-FOL-1's "leaving the live page").
  `Esc` is the page's existing listener (`Live.tsx`, R35) with one branch added before the one that leaves the page: while following it closes the screen and stops.
  The layer is `role="dialog"` with `aria-modal="true"` and its accessible name is the readout's line; focus moves to the `×` on open and back to the follow control on close, and `Tab` wraps inside the layer — the header under it is covered for the eye and inert for the keyboard.
  Not a route: nothing in the hash (D-13) and no history entry (OQ-22).
  The `×` is a `<button>` whose text is the character `×`, 44 × 44 CSS px, `aria-label` `t.live.followClose`; the two-language copy (the label, the portrait note) is the `live` lane's catalog (D-283) except the note, which is the window's own state and lives in `window.ts` (D-323).
- **D-322 — The chart gains a `screen` mode: no caption, no controls, no toggle, the box is the host, and the status and the legend are overlays.**
  (FR-FSC-1, FR-FSC-3, FR-LEG-2 as amended; lane `chart`.) `SkyChartProps.screen?: boolean`.
  In `SkyChart` with `screen`: the view is `WINDOW_VIEW` and `viewFor` is not consulted; no `OptionToggle`, no `figcaption`, no `chartControls`, `fill` implied; `aside` and `stripe` are not rendered.
  In `ChartFrame` with `screen`: the box is the host's whole size — no `aspect-ratio`, no `--chart-floor`, no full-bleed margins, no measurement of a column — the `status` slot is absolutely placed at the top-left over the drawing, the `legend` slot along the bottom edge over it (`max-height: calc(2 * var(--legend-row))`, `overflow-y: auto`), and a new `overlay` slot renders the page's own children (the `×`) over everything.
  Both overlays sit on `--follow-overlay`, `color-mix(in srgb, var(--surface) 85%, transparent)` — `FOLLOW_OVERLAY_ALPHA` is that 85 %, one token in `styles/tokens.css`, chosen so the text keeps FR-THEME-2's contrast over the darkest sky token and the horizon line under the strip still reads.
  `Legend` with `screen` draws the compact rows (FR-LEG-3's short form) so two rows are two lines at 844 px.
  The dome and the polar chart never see `screen`; the type allows it and `SkyChart` ignores it for them, so the contract test's three implementations are unchanged.
- **D-323 — The window's portrait state is a fourth veil beside the ground ones, read from a media query, and only in `screen` mode.**
  (FR-FSC-4; lane `window`.) `SkyWindow` reads `props.screen`: with it, the frame gets no `controls` (no toggle, no hint — that row is what the page has and the screen has not), the readout is the `status` slot as today, and `useMediaQuery('(orientation: landscape)')` (`hooks/useMediaQuery.ts`, D-319's hook) decides a state `portrait` that is drawn like `buried`: no SVG content painted, the `role="status"` note `t.window.portrait` ("Turn the phone sideways to follow the sky." / "Gira el teléfono de lado para seguir el cielo.") as the whole box, `data-orientation="portrait"` on the root, and `status={null}` and `legend={null}` handed to the frame so neither overlay is drawn (FR-FSC-4: the note and the `×` and nothing else).
  `useDeviceOrientation` stays mounted across the state, which is what keeps the sensor running and the permission asked once (FR-FOL-2).
  The ground states (D-278, D-285, D-286) are computed only when landscape, so `portrait` wins over them.
  Without `screen` nothing changes: the pass detail's window is a square box and draws in both orientations as R47 built it.
  `groundState` is untouched; the new state is the component's, not the projection's.
- **D-324 — The view control offers what the page allows: `SkyChartProps.views`.**
  (FR-FSC-6, FR-WIN-4 and FR-WIN-5 as amended; lane `chart`.) `views?: readonly ChartView[]` — the ids a page offers, of the registered ones; `offeredViews(lost, views)` keeps the registered order and drops what is not listed, and a page that passes nothing offers all three, so the pass detail is unchanged by construction.
  `Live.tsx` passes `['dome', 'polar']` (the `live` task, after the `chart` one).
  `viewFor` already falls back to the dome when the saved view is not offered, and `setChartView` is not called on the way, so a saved `window` is drawn as the dome on the live page and stays `window` in `localPrefs` for the pass detail (D-277's `savedChartView` is what the detail reads).
  The `[ point at the sky ]` gate is rendered by `SkyWindow` alone, so it can never appear on a page where the window view does not mount.
  `FollowPhone` keeps its own presence test (D-175): the control is offered where the window would be, whatever `views` says, because the screen is not one of the page's views.
- **D-325 — Hidden objects are held off the follow screen at the hook, not at the drawing.**
  (FR-FSC-5, FR-LIVE-6 as amended.) `Live.tsx` calls `useHiddenObjects(observer, shown, liveHidden && !following)`, so while following the worker gets no `computeAt` request and `hidden` is empty; `FollowScreen` passes no `hidden` prop at all, so the screen cannot draw a dimmed mark even if the hook's cache still holds one.
  The toggle is not rendered on the screen (D-321 renders none of the actions) and its saved state is untouched.
  A test asserts no `computeAt` message leaves the page while following with the toggle on.
- **D-326 — What is tested, and what is captured.**
  (FR-FSC-7, §9.1.) jsdom, with `matchMedia` mocked for the orientation query and the synthetic orientation events of `SkyWindow.test.tsx`: `FollowScreen.test.tsx` — open shows the drawing, the `×`, the readout and the legend and none of the page's testids (`live-side`, `stripe-block`, `playback-row`, `live-actions`, the header); `×`, `Esc` and unmount close and restore the previous view and the rows at real time; focus lands on the `×` and returns to the control; portrait shows the note and the `×` only and the sensor hook stays mounted; `hidden` is never passed (D-325).
  `SkyChart.test.tsx` — `views` filters the toggle and a saved `window` draws the dome without writing; `screen` renders no toggle, caption or controls.
  `SkyWindow.test.tsx` — the `portrait` state, and that without `screen` portrait draws.
  `App.live.test.tsx`'s follow states are rewritten for the screen: pressing the control no longer switches the page's `data-view`; it mounts the layer.
  End to end, `tests/e2e/follow-screen.spec.ts` at 844 × 390 with `hasTouch` and the orientation helpers of `sky-window.spec.ts`: the layer covers the viewport (its box is `innerWidth × innerHeight`), the header is not hit-testable under it, the `×` restores the page, and a `setViewportSize(390, 844)` shows the note.
  Captures, in `v1-captures.spec.ts` and the D-179 list `captures.test.ts` checks: `follow-screen-844-{sky,ground,buried}-{dark,night}-{en,es}` and `follow-screen-390-portrait-{dark,night}-{en,es}`, in place of the v1.2 `following` captures, which are removed from the set and from `docs/screenshots/`.
- **D-327 — The v1.3 cut is four tasks over three waves, on Opus.**
  (V13-5.) `chart` takes the `screen` mode and the `views` prop (R62); `window` takes the portrait state and the chromeless rendering (R63); the two share no file, so wave 1 runs both.
  `live` takes the screen itself, the switch, `Esc`, the hook guard, the e2e and the captures (R64) and waits for both, wave 2.
  `ui` takes the release (R65), wave 3.
  Every task runs on `opus` — the owner's instruction for the phase; §16.6's table is not rewritten, the phase's rows in §16.10 say so — and the review models stay §16.6's.
  Gates: R62 owner (the compact live page's view control becomes one row, so its captures move), R63 owner (Spanish copy), R64 owner (the phone run, V11-9), R65 owner.
- **D-328 — The overlay surface is `--bg-raised` at one alpha token, and the screen frame is a class of its own.**
  (FR-FSC-3, FR-THEME-2; R62, refining D-322.) D-322 writes the overlay as `color-mix(in srgb, var(--surface) 85 %, transparent)`, and there is no `--surface` token: the app's surfaces are `--bg` (the page ground) and `--bg-raised` (a panel over it), with `--chart-ground` and `--chart-sky` the *drawing's* base layers.
  The overlay is a panel over the drawing, so it takes `--bg-raised`, which each theme already sets — the composite over the darkest sky token is 4.70 : 1 for `--fg-dim` dark and 5.10 : 1 night, every text token clear of FR-THEME-2's 4.5.
  What goes in `tokens.css` is the alpha alone, `--follow-overlay-alpha: 85%`: it is one number for both themes, and `readTokens` matches `#rrggbb` declarations only, so the pair table, the red-hue rule and the "no dark value showing through" rule of `tests/styles/tokens.test.ts` neither see it nor have to make an exception for it.
  `--follow-overlay` itself is derived in `ChartFrame.module.css`, where it is used.
  `tests/styles/followOverlay.test.ts` composes the mix from the token values and holds it to 4.5 : 1 in both themes — a new file rather than a case in the tokens test, so the one shared stylesheet is the only shared file the task touches.
  The frame in `screen` mode carries `.screen` and neither `.frame` nor `.fill`: the framed chart's rules are eleven blocks of grid, container query, floor and full-bleed margin at up to three attributes of specificity, and a screen that had to unpick them one by one would be a second F-52 waiting.
  Nothing above the block can reach `.screen`, and the block itself is nine declarations.
- **D-329 — `overlay` is on `SkyChartProps` too, and the live page's `views` is R62's with an exception for the v1.2 override.**
  (FR-FSC-1, FR-FSC-6; R62, refining D-322 and D-324.) D-322 puts the `×` in `ChartFrame`'s overlay slot and D-321 has `FollowScreen` — a page — hand it over; the page's only route to the frame is through `SkyChart` and the view, so `SkyChartProps` carries `overlay?: ReactNode` beside `screen`, and `SkyChart` forwards it.
  The last link is `SkyWindow`'s `<ChartFrame>` call, which is the `window` lane's: R62 cannot write it, and R63 is the task that rewrites that call anyway (it hands the frame `screen`, `status` and `legend`), so `overlay` goes through with them there.
  Until it does, `screen` reaches `SkyChart` and stops at `SkyWindow`: R62's own frame tests mount `ChartFrame` directly, and `SkyChart.test.tsx` asserts only what the boundary owns.
  The live page's `views` is R62's rather than R64's, because R62's own "done when" captures the two-option control and D-327 makes that the reason for R62's owner gate.
  It cannot be the plain `['dome', 'polar']` yet: until R64 the follow control opens the window *as the page's view* (D-277's override), and a page that stopped offering the window would draw the dome under its own follow control.
  So `Live.tsx` offers the two views except while `follow.state === 'on'`, and R64 deletes the exception with the override it belongs to.

- **D-333 — The window passes the frame's screen mode on, because the window is what renders the frame.**
  (FR-FSC-1, FR-FSC-3; D-322, D-323.) D-322 gives `ChartFrame` a `screen` mode and `SkyChart` one, but the two are not adjacent: `SkyChart` renders the *view*, and each view renders its own `ChartFrame` (`SkyChart.tsx`'s `DomeView` and `PolarView` do it inline; the window does it in `SkyWindow.tsx`).
  So the prop travels `SkyChart` → `SkyWindow` → `ChartFrame`, and the middle step is the `window` lane's — R63's, not R62's, which owns neither end of it.
  `SkyWindow` reads `screen` off its props through a cast and spreads it into the frame through another, so the file compiles both before R62 adds the two prop declarations and after; once it has, both casts are widenings of the real type and whoever next edits the lines can drop them.
  Without this the follow screen would hold a chromeless window inside a frame still laying out a page's rows, and no test in either task would have seen it, since R62 tests the frame directly and R63 tests the window against the frame it has today.

- **D-334 — The `matchMedia` stub understands `(orientation: …)`.**
  (D-326; `tests/support/matchMedia.ts`.) The stub answered `min-width` and `min-height` and *threw* on anything else, which is the right default — a query it cannot evaluate is a silently wrong answer otherwise — but it made the follow screen's own query a crash in any jsdom test that renders the window in screen mode, R62's `SkyChart.test.tsx` included.
  It now reads the orientation off the width and height it already tracks, the way CSS does: landscape unless the viewport is taller than it is wide, so `stubMatchMedia(844, 390)` is the phone on its side and `stubMatchMedia(390, 844)` the same phone upright, and `setSize` is what turns it.
  One shared file, named here as R63's one crossing out of its lane.

- **D-335 — The portrait state is captured from a harness page, not from the app.**
  (FR-FSC-4, D-326.) The state needs `screen`, and in wave 1 no page passes it: `SkyChart` learns the prop in R62 and the follow screen that sets it is R64.
  Rather than ship the phase's first owner gate — the Spanish copy — with no picture of the copy, `spike/window/screen.tsx` mounts the *production* `SkyWindow` with the prop, in `tokens.css` and `global.css`, inside a `position: fixed; inset: 0` layer with `--page-pad-x` at zero, and `spike/window/screen-capture.ts` drives it over the Vite dev server the way `spike/window/capture.ts` has driven the R38 spike since then: `npx tsx spike/window/screen-capture.ts`, four shots at 390 × 844 across both themes and both languages plus one at 844 × 390, each asserting the state it is named after.
  What the shots therefore do *not* show is D-322's frame — the rows the frame still keeps for the controls and the status push the note above the middle of the viewport — and that is exactly the part R62 owns.
  `docs/screenshots/r63-window-*` are superseded by D-326's `follow-screen-390-portrait-*` when R64 shoots them through the real page, and the harness page stays as the way to photograph the window's own states with no page around it.

- **D-338 — The layer replaces `LiveSky`'s grid, not `LivePage`'s, and the header it covers is made inert where it stands.**
  (FR-FSC-1, D-321.) D-321 says the layer is rendered "instead of the `.page` grid" *and* that the page's hooks stay mounted, and those two are only compatible one way: every hook D-321 names — the passes, playback and the `now` effect, the wake lock, `useHiddenObjects`, the hash — lives in `LiveSky`, the component inside the grid, so it is `LiveSky` that returns `<FollowScreen>` in place of the dome and the side column.
  `LivePage`'s one-row header stays where it is and is covered, which is what D-321 asks for.
  Covered is not enough on its own, though: `inert` keeps it off the keyboard and out of a tap that lands past the layer, and `aria-hidden` is what takes it out of the accessible tree — `inert` is a browser behaviour that jsdom does not implement, so without the second attribute "the header is not on the screen" would be a claim no unit test could make.
  `LivePage` reads the flag with `useFollowing()`, a one-line selector on the override beside `useFollowPhone` (D-277: the override *is* following), rather than calling the hook a second time and arming a second sensor.

- **D-339 — The `×` reaches the frame through the window, and the Suspense fallback is a screen too.**
  (FR-FSC-1, FR-FSC-2; D-321, D-329, D-333.) D-329 left the last link of the overlay chain — `SkyWindow`'s `<ChartFrame>` call — to R63, and R63 rewrote that call for `screen`, `status` and `legend` without it.
  R64 adds it: two lines in `SkyWindow.tsx`, the `window` lane's file and this task's one crossing into it, without which the `overlay` prop `SkyChartProps` has carried since R62 reaches the window and stops.
  The second half is `WindowView`'s Suspense fallback in `SkyChart.tsx`, which built its holding frame without `screen` and without `overlay`: the window is a lazy chunk (PLAN §11), so for the first frames of every follow screen the layer would have held a *page's* frame with no way out of it — the one control FR-FSC-2 says is always there, missing exactly when the reader has nothing else to look at.
  The fallback now forwards both, and the `×` is in the document from the first commit.

- **D-340 — The `×` takes focus with a callback ref, and the dialog is named by the readout where there is one.**
  (FR-FSC-2, D-321.) A mount effect would have focused the `×` once, in the Suspense fallback, and then lost it: React replaces the fallback's button rather than moving it when the chunk lands, and focus falls to the body.
  So the ref is a callback that focuses the node it is given *only when nothing else holds focus* — the body, which is where focus is on the mount (the follow control has just been removed) and again after the swap, and which a legend row the reader has tabbed to is not.
  On the way out, `Live.tsx` focuses the follow control through a ref of its own: the control is a different element by then, so `useOpenerFocus`'s remembered node (`isConnected`, R50) would have declined to focus it.
  D-321's "the accessible name is the readout's line" is `aria-labelledby` to `SCREEN_STATUS_ID`, an id `ChartFrame` puts on the screen's status slot — one screen frame exists at a time, so a constant is unique — and in the portrait state, where FR-FSC-4 hands the frame `status={null}` and there is no such element, the layer falls back to `aria-label` with the name of the control that opened it.
  A dangling `aria-labelledby` is an `aria-valid-attr-value` failure, so which of the two is set follows the same `(orientation: landscape)` query the window's own state does.

- **D-341 — The strip's true-north line has no caller left, and the page's `views` is unconditional.**
  (FR-WIN-6 as amended v1.3, FR-FSC-6; D-185, D-329.) R44 hung the declination on the status strip because the window was a view of the live page and the strip was beside it (US-21 AC6).
  It is not any more: the screen carries no strip, and FR-FSC-4 makes the declination the readout's second line, which is where the capture set now shows it.
  So `Live.tsx` stops passing `declinationDeg` and stops calling `useDeclination` — the hook is the window's own, and `StatusStrip` keeps the optional prop and its unit test, since the strip is not what changed.
  With the same edit D-329's exception goes: the page hands the chart `views={['dome', 'polar']}` whatever the control is doing, because what the control opens is no longer drawn by that chart.

- **D-342 — The follow screen is four screens in the capture set, and the one with no wide picture.**
  (FR-FSC-7, D-179, D-326.) D-326 names the files as `follow-screen-844-{sky,ground,buried}-…` and `follow-screen-390-portrait-…`; D-179's naming puts the state before the width (`captureName` is `v1-<screen>-<width>-<theme>-<locale>`, and `window-ground` is already a screen in that shape), so the set gains four *screens* — `follow-screen-sky`, `-ground`, `-buried` at 844 and `-portrait` at 390 — and the sixteen files are `v1-follow-screen-<state>-<width>-<theme>-<locale>.png`.
  The count, the states, the themes and the languages are D-326's exactly; only the order of two words in the name is the list's own.
  It is also the first screen in the set that is not shot at 1280: the control that opens it is absent on desktop (FR-FOL-1) and the drawing needs the phone sideways (FR-FSC-4), so a wide file would be a picture of a place no reader can be.
  `captures.test.ts`'s "every screen at 390 and 1280" carries the exception by name rather than being weakened for everything.

### 2.21 v1.3.1 decisions (2026-09-08)

These plan SPEC v1.3.1 (V13-6..V13-10). v1.3 spent D-321..D-349 (§16.10's per-task blocks included, R65's D-345..D-349 still unspent); v1.3.1 starts at D-350, and §16.11 reserves R66's block from D-358.

- **D-350 — The way in is the view control, and the entry rule moves there with the control's other duties.**
  (FR-FSC-6, FR-WIN-4 as amended; V13-6; supersedes D-276 and D-301.) `useFollowPhone` becomes `components/screen/useSkyScreen.ts` and keeps everything the control had that was never about the control: the presence test (`orientationApiPresent`), the permission asked *inside the tap* through `window/orientationAccess.ts`, F-42's one-reading test — arm a listener, and open only on a reading that carries a heading — and the `relative` and `denied` notes.
  What calls it is `SkyChart`'s view control: choosing `window` calls `open()` instead of `setChartView`, choosing `dome` or `polar` writes the preference as it does today.
  `FollowPhone.tsx`, `FollowPhone.module.css`, `useFollowPhone.ts` and the `live.follow*` copy keys are deleted; the notes render beside the view control, from `chart` copy.
  `compassHeading.ts` stays where it is (`components/live/`) — it is a pure module and moving it would touch a lane for nothing.
- **D-351 — The screen is a shared component and each page renders it.**
  (FR-FSC-1, FR-FSC-9; V13-6, V13-9; supersedes D-321's "the live page renders the layer" and D-277 entirely.) `components/live/FollowScreen.tsx` moves to `components/screen/SkyScreen.tsx` + module, unchanged in what it draws: the fixed layer at `--z-follow` (renamed `--z-screen`), the chart with `screen`, the `×` in the overlay slot, focus on open, `Tab` wrapping, `Esc` handled by the page that renders it.
  `Live.tsx` renders it in place of `LiveSky`'s grid with every hook still mounted (D-338's rule, unchanged); `PassDetail.tsx` renders it over the sheet, in a portal to the body as the sheet itself is (D-243's pattern), with the sheet `inert` under it.
  The open flag is one boolean in the prefs slice (`skyScreen`), set by `useSkyScreen`'s `open()` and cleared by the `×`, by `Esc`, by leaving the page and by a window that reports it cannot run here (`dropChartView`'s successor).
  Focus returns to the view control's `window` option, which is on the page again — where R64 needed a ref to the follow control, the option's own id is enough.
- **D-352 — The window is never a saved view: `savedChartView` narrows to `'dome' | 'polar'`.**
  (FR-WIN-5 as amended, FR-FSC-6; V13-8; supersedes D-277 and D-296's window path.) The prefs slice loses `viewOverride`; the stored value is read through a narrowing that maps a stored `'window'` — every device that ever chose it before v1.3.1 has one — to `'dome'` on load and rewrites it, so nothing downstream has to know the old shape.
  `SkyChart` drops the `[ point at the sky ]` gate and the `views` prop's live-page exception (D-324, D-329): both pages pass no `views` and the registered set is what is offered, less what FR-WIN-4's presence test denies.
  `dropChartView` keeps its job for a window that fails at runtime — it now closes the screen instead of rewriting a preference.
- **D-353 — The page's instant is the screen's, so the `now` effect goes.**
  (FR-FSC-8, FR-WIN-6 and FR-FOL-3 as amended; V13-7.) `Live.tsx`'s R48 effect — `if (following) toNow()` — is deleted, and `SkyScreen` is handed `now={shown}` and the same `passes` the page has already built for the instant.
  Nothing else is needed: the layer replaces the grid with every hook mounted, so `usePlayback` keeps its interval and the screen re-renders at the page's speed.
  Closing gives back the page at whatever instant playback has reached, which is `shown` and needs no restore.
  The unit test is the one that used to assert the reset: enter at a scrubbed instant and at 60×, and the screen's chart carries that instant and it advances.
- **D-354 — The pass detail holds its sheet still and gives the scroll position back.**
  (FR-FSC-9; V13-9.) The sheet is the app's one scrolling container (`PassDetail.module.css`); while the screen is up the sheet is `inert` and its `overflow` is `hidden`, and its `scrollTop` is read on open and written back on close.
  `overscroll-behavior: contain` on the layer keeps a drag at the edge of the drawing off whatever is behind it.
  The live page needs none of this: it never scrolls (FR-LIVE-1).
- **D-355 — Full-bleed is measured from the pane, and the landscape live page says so with `--page-pad-x: 0`.**
  (FR-COMP-5 and FR-LIVE-7 as amended, F-63; V13-10.) D-187's rule stands — on compact the box breaks out of the page's side padding with negative margins — and the escape hatch it already has is the answer: `ChartFrame.module.css` reads `var(--page-pad-x, calc(2 * var(--cell)))`, so `Live.module.css` sets `--page-pad-x: 0` on `.dome` inside the `(orientation: landscape) and (max-height: 500px)` block, where the pane is a grid column and there is no page padding under it to escape.
  Portrait, the pass detail and the wide page are untouched.
  The test is an e2e that measures the drawing, not the panes — `chart-box`'s right edge against `live-side`'s left edge and its left edge against the page's — at 740 × 360, 844 × 390 and 932 × 430, and it fails on the old CSS (FR-FIX-1).
- **D-356 — The rename, in one table.**
  (V13-6; FR-FSC-1..9, FR-FSC-7's capture names.) `FollowScreen.tsx` → `screen/SkyScreen.tsx`; `useFollowPhone.ts` → `screen/useSkyScreen.ts` (`useFollowing` goes with the store flag); test ids `follow-screen` → `sky-screen`, `follow-close` → `sky-screen-close`, `follow-phone` / `follow-toggle` / `follow-note` → the view control's own (`chart-view`, `chart-view-note`); copy `live.followClose` → `chart.screenClose`, `live.follow*` deleted, `chart.windowDenied` / `chart.windowRelative` for the notes; tokens `--follow-overlay*` → `--screen-overlay*`, `--z-follow` → `--z-screen`, `FOLLOW_OVERLAY_ALPHA` → `SCREEN_OVERLAY_ALPHA`; e2e `follow-screen.spec.ts` → `sky-screen.spec.ts`; captures `follow-screen-*` → `sky-screen-*` with the pass detail's pair added (D-342's list re-cut).
  The FR-FSC ids do not move (V13-6), so §12's rows are re-pointed, not renumbered.
- **D-357 — v1.3.1 is one task, R66, on Opus, before R65.**
  (V13-6..V13-10; §16.11.) The four changes are one screen, one view control and one phone run, and three of them touch `Live.tsx` and the chart together, so splitting them by lane would cost three merges and three phone runs to save nothing.
  R66 takes lanes `live`, `chart`, `window` and the new `screen` directory at once — it is the only task in flight — and R65 (release preparation, D-345..D-349 unspent) follows it and re-shoots the capture set on top.
  The gate is the owner's, on a phone: the sky screen from both pages, sideways and upright, and a pass in the future watched through it.

**R66's block** (§16.11 reserves D-358..D-367; what it spent):

- **D-358 — The view control drops its visible `View:` on compact.**
  (FR-COMP-4, US-5 AC2; V13-6.) With the window back in the control the three options plus the prefix are 38 cells at 390 px — one cell of trailing padding per option is what the 35-cell count in `OptionToggle`'s test does not see — and the row wrapped to two, which is exactly what V13-4 had taken away and what the owner did not want back.
  The prefix is the one part that carries nothing: it is `aria-hidden`, and the group is named "Chart view" for anything that reads the page.
  Dropping it on compact leaves 33 cells and one row, with the same meaning; wide keeps it.
- **D-359 — The store carries the note, the lost option and a one-shot focus flag, not `SkyChart`.**
  (FR-FOL-2, FR-WIN-4, FR-FSC-2; D-350, D-351.) The window that fails is the one *on the screen* and the control that has to answer for it is on the page underneath, so `windowNote` and `windowLost` cannot be the page chart's own state.
  `refocusWindow` is the same problem for focus: the page's chart is unmounted while the layer is up and is a new element when it returns, so it has no memory of having opened anything — the flag says "the screen just closed", the chart focuses its `window` option (`data-option`, added to `OptionToggle`) and clears it, and where the phone has just lost the window the first option takes focus instead so it never falls to the body.
- **D-360 — The screen takes its initial facing from the page that opens it.**
  (FR-WIN-1, D-188, D-241.) R64 hard-coded `initialFacingAzDeg={0}`, which is right for the live page — its sky has no one pass to aim at — and wrong for the pass detail, where R47's placeholder points the box at the pass the guide is about so its key is in view from the first frame.
  `SkyScreen` passes the prop through only when it is given one; the live page gives 0 and the pass detail gives none.
- **D-361 — `[ point at the sky ]` is deleted rather than left unreachable.**
  (FR-WIN-5 as amended v1.3.1, V13-8.) R64 had already suppressed the gate on a screen, and a screen is now the only place a window is mounted, so the branch could not render.
  It goes with `window.pointAtSky` in both catalogs and the `.gate` rules; `useDeviceOrientation.start` stays, since the hook's state machine is the `window` lane's and nothing else in it changed.
- **D-362 — The pass detail's `Esc` is a capture listener that stops the press.**
  (FR-FSC-2, D-354.) The live page owns its own `keydown` and can branch (D-321), but the guide is closed by the app's one listener (`lib/shortcuts.ts`), a bubble listener on the document.
  So while the screen is up the page installs a *capture* listener on the same document and calls `stopPropagation`: the press closes the screen and never reaches the shortcut table.
  `PassDetail.test.tsx` asserts it with a stand-in bubble listener, which is what makes "and only then closes the guide" a claim rather than a hope.
- **D-363 — The capture set's `window` is the screen from a pass, and its two ground states leave.**
  (FR-FSC-7 as amended, D-179.) `window`, `window-ground` and `window-buried` were the pass detail's window laid out in the sheet at 390 and 1280 — three screens no reader can be on any more.
  `window` becomes the same screen opened from a pass, at 844 (the exception `captures.test.ts` already carries for the sky screen now covers it), and the two ground states go: they are `sky-screen-ground` and `sky-screen-buried`, shot from the live page, and a second picture of each from a pass shows nothing the first does not.
  `r59-captures.spec.ts` and `r62-captures.spec.ts` are deleted with the states they asserted; their PNGs stay in `docs/screenshots/` as the record of those PRs, as R64 left R59's.
- **D-345 — The window's budget follows the World Magnetic Model back into its chunk, and the declination row is deleted.**
  (R65; D-178, D-179, D-242, D-341, SPEC §9 Phase 2d.) The release re-set is `measured × 1.1`, rounded up to the next 5 KB, floored at 10 and capped at the §11 ceiling, measured on the 1.3.0 build with `VITE_MOON_LORE=on` as CI's bundle stage builds it.
  One row moves: `SkyWindow-*.js` measures 12.0 KB against a budget of 10, and ×1.1 is 13.2, so the budget follows to 15.
  Nothing in the window grew — R47 split `useDeclination` and the model out of the live chunk because both pages reached them (D-242), and R66 took the live page's last call away with the strip's true-north line (D-341), so Vite has one caller again and folds 6.1 KB back into the window's 5.9.
  The declination budget goes with the chunk: `scripts/bundle-budget.ts` prints a `::warning::` for a budget that matches no file, which is right for a chunk that vanished by accident and wrong for one deleted on purpose, and a row kept for sentiment would warn on every build.
  `main` measures 137.9 against 136.6 — the sky screen's copy in the `ui` catalog, which ships in main by design (§11) — and stays inside 155; `Live-*.js` falls to 7.4 with the follow control deleted; every other chunk measures what it did.
- **D-346 — The capture set is re-shot whole on the release build, not topped up, and stays 116 files.**
  (R65; D-179, D-273, FR-FSC-7 as amended.) The set is the app's screens, so the release re-shoot is what says whether each picture is still true — the discipline D-273 set when the clear-before-the-run caught four files showing a form that had moved to `#settings`. v1.3 and v1.3.1 changed the list rather than lengthening it: R64 put the sky screen's four screens in, R66 renamed them and made `window` the same screen opened from a pass at 844 while its two ground states left (D-363), so 128 files became 116 with three screens more than v1.2 had.
  Every file in the set is re-shot from the 1.3.0 build; `docs/screenshots/r*.png` stay untouched, being the record each PR was reviewed against.
- **D-347 — `docs/RELEASE.md` §9 replaces §8.1's follow checks rather than adding to them.**
  (R65; SPEC §9 Phase 2d, FR-FSC-1..9, V11-9.) The checklist is cumulative — every earlier section still applies — but §8.1 asks the owner to press a control that no longer exists (D-350), and a checklist with a step that cannot be performed teaches the reader to skip steps. §9.1 says so in a line and carries the phone run the phase's definition of done needs: the door on both pages, the portrait note across a turn with no second prompt, a future pass scrubbed and played *before* the screen opens (FR-FSC-8, US-21 AC14), nothing scrolling, and F-63's landscape live page checked by eye where `live-landscape.spec.ts` measures it. §9.2 is the owner's release steps, with the tag pinned to the release commit's SHA rather than `main`'s head, which is what a peer session's merge would otherwise put inside the tag.

---

### 8.13 The sky screen *(v1.3, FR-FSC-1..7, D-321..D-327; recut v1.3.1, FR-FSC-1..9, D-350..D-357)*

*(v1.3.1)* The seams move one step out.
The screen is no longer the live page's: `components/screen/` owns the layer and the way in, `Live.tsx` and `PassDetail.tsx` each render it over their own chrome, and the chart's view control is the only trigger — so the `live` lane keeps the page's decisions (what is under the layer, what the hidden-objects hook is asked) and loses the screen itself.
What follows describes the v1.3 arrangement; D-350..D-356 say what each part becomes.

Nothing new is designed beyond the seams the decisions draw, and the seams are the lanes: the `live` page decides *when* the screen shows and renders the layer (D-321) and starves the hidden objects (D-325); the `chart` frame knows *how* to be a screen — no chrome, overlays instead of slots — and which views a page offers (D-322, D-324); the `window` view knows it is on a screen and what to draw when the phone is upright (D-323).
The three meet through two props on `SkyChartProps`, `screen` and `views`, and the store's existing override.
The pass detail passes neither and is untouched by every test it already has.

### 16.10 Delivery of the v1.3 tasks *(V13-5, D-327)*

The V1-11 rules are unchanged: the same driver, the same waves computed from the checkboxes on `origin/main`, at most one task per lane and at most three at once, auto-merge on a green CI and a clean review except where the owner gates.
One rule is added for the phase: every task runs on `opus` (the owner, 2026-09-08); `--model` still overrides one run, and the review models are §16.6's.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R62 — the chart's screen mode and the views a page offers | `chart` | opus | owner (the compact live page's view control becomes one row; captures move) | R60 |
| 1 | R63 — the window on a screen: no chrome, and the portrait state | `window` | opus | owner (Spanish copy, captures) | R60 |
| 2 | R64 — the follow screen: the layer, the `×`, `Esc`, hidden off, the e2e and the captures | `live` | opus | owner (phone run, sideways and upright; captures) | R62, R63 |
| 3 | R65 — v1.3 release preparation | `ui` | opus | owner | R64 |

Wave 1 runs the two lanes that share no file: `chart` adds the two props and the frame's screen mode with tests that render the window through `SkyChart screen` using the registered view as it is; `window` adds the state and the chromeless rendering with tests that pass `screen` straight to `SkyWindow`.
Neither needs the other to compile, since `screen` is read from `props` in both and `SkyChartProps` is the `chart` lane's type — R63 reads the prop the type may not yet declare through the same `as` cast R48 used for `chartView` before R47 landed (`Live.tsx`'s "the `string` reading is what lets it compile before then").
The `live` task is one task: the switch, the layer and the captures are one screen and one owner gate.

**Decision blocks** (§16.2), reserved here before wave 1: **R62 takes D-328 to D-332, R63 D-333 to D-337, R64 D-338 to D-344, R65 D-345 to D-349.**
Numbers a task does not use stay unused; a task added to the phase later takes the next block after D-349.

What each session is told to read (D-284's rule): R62 — SPEC §4.17 (FR-LEG-2 as amended), §4.18 (FR-WIN-4, FR-WIN-5 as amended), §4.23 (FR-FSC-1, FR-FSC-3, FR-FSC-6), PLAN §8.13, D-322, D-324, D-186, D-187; R63 — SPEC §4.18, §4.22 (FR-FOL-2, FR-FOL-5), §4.23 (FR-FSC-1, FR-FSC-4), PLAN §8.10, §8.13, D-323, D-278, D-283; R64 — SPEC §4.10 (FR-LIVE-6, FR-LIVE-7, FR-LIVE-8), §4.22, §4.23, PLAN §8.8, §8.12, §8.13, D-321, D-325, D-326, D-277, D-301; R65 — `docs/RELEASE.md`, D-178, D-179, D-326.
No session reads the three documents whole.

---

### 16.11 Delivery of the v1.3.1 task *(V13-6..V13-10, D-357)*

The V1-11 rules are unchanged.
One task, alone in flight, then R65 on top of it.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R66 — the window is a view again, the screen is shared, the instant is the page's, and F-63 | `live` (with `chart`, `window` and the new `components/screen/`) | opus | owner (phone run from both pages, sideways and upright, and a future pass watched through it; captures) | — |
| 2 | R65 — v1.3 release preparation | `ui` | opus | owner | R66 |

R66 holds every lane it touches because it is the only task running: the four changes are one screen, one view control and one phone run, and three of them cross `Live.tsx`, `SkyChart.tsx` and the prefs slice together (D-357).
R65 is unchanged in scope — the capture set re-shot on `main`, the budgets re-measured, `package.json` at 1.3.0 — and re-shoots the set with the sky screen's names (D-356) rather than R64's.

**Decision blocks** (§16.2): **R66 takes D-358 to D-367**, and R65 keeps D-345 to D-349, unspent.

What the session is told to read (D-284's rule): SPEC §4.16 (FR-COMP-5 as amended), §4.18 (FR-WIN-4, FR-WIN-5, FR-WIN-6 as amended), §4.20 (F-63, FR-FIX-1), §4.22 (what is withdrawn), §4.23 (FR-FSC-1..9), §3.2 US-21 AC1, AC5, AC7, AC8, AC11..AC14, §12 V13-1..V13-10; PLAN §2.20, §2.21, §8.10, §8.12, §8.13, §9.1, §12 and this section.

- **D-376 — The trailer check is anchored at a baseline and runs in its own CI job.**
  (FR-PUB-12; V13-15.) Two constraints shape it.
  First, it may never be a test that fails on existing history: the 19 commits are the owner's to decide about, and a check that went red on them would have exactly one green path — the force-push D-372 was written to keep out of a test's reach.
  So `BASELINE` is `d7514ec`, the merge that added §4.24, and only `BASELINE..HEAD` is walked.
  Second, it cannot live in `tests/docs/` with the others: the `ci` job checks out at depth 1 and a shallow clone has no range to walk, and a check that silently passes where it cannot see is worse than none.
  So `ci.yml` gains a small `trailers` job with `fetch-depth: 0` that runs `scripts/check-trailers.ts`, and the script exits 2 with a message rather than 0 when the baseline is missing.
  The unit test keeps the part that is pure — `offenders()` over written-out messages — which is where the rule's shape actually lives.
  The job is parallel to `ci` and does not spend its ten-minute budget.
- **D-377 — Deletable means "its pull request is merged", asked of GitHub.**
  (FR-PUB-13; V13-15.) `git branch -r --merged origin/main` is the obvious test and it is wrong here, which was found by running it: 20 branches called merged, 74 not, against 103 merged pull requests.
  Every pull request in this project is squash-merged (§16.4 step 8), and a squash writes a new commit with a new tree and no parent link to the branch, so the branch tip is never an ancestor of `main` and reachability cannot see it.
  The merge record lives in GitHub, so `gh pr list --state merged --json headRefName` is what is asked, with `--state open` subtracted so a reopened branch is never pulled out from under its own pull request.
  A branch with no pull request at all is left alone: that is work in progress.
  `deletable()` is pure and takes the three lists, so the rule is tested without a network; the script's own `main()` is what fetches them.
  Deletion needs `--delete` and batches the refspecs twenty at a time, because one push of ninety is one failure for all ninety.

- **D-378 — `docs/DEPLOY.md`, and the line the README keeps.**
  (FR-PUB-1 as amended; V13-16.) The split is by who can act on it.
  The README keeps the three facts that are true of the *repository* — a push to `main` deploys, every branch gets a preview URL, and `public/_headers` carries the CSP the Playwright suite runs the app under — because those are the reader's evidence that this is deployed continuously and tested against the headers it ships.
  `docs/DEPLOY.md` takes everything that needs the Cloudflare account: the three dashboard steps, the rename procedure, the `curl` checks and the observability note.
  The moved text is moved verbatim, not rewritten, so nothing about the deployment is restated in two places and can drift; the README's paragraph is new prose and names no dashboard path.
  The test pins the split from both ends — `## Deploy` is at most 20 lines and links the file, and the strings that identify the runbook are in `docs/DEPLOY.md` and not in `README.md` — because the failure mode is somebody helpfully putting a step back.
