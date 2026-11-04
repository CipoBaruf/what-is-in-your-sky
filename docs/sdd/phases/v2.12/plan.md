# v2.12 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.48 v2.12 decisions (2026-11-03)

The spike (`spike-stars-desktop`, c914908f) is the starting point: its `globe.ts` is the geometry and its `renderer.ts` the drawing, both already in the window's method.
What changes is that they become the app's — the sheet's tokens, the app's label placement, its catalogs, its time model, its places — and that the true outside view is the only view (V212-3), so the spike's `mirror` switch goes.
No dependency is added (§11.1 unchanged).

- **D-1034 — The globe lives in `skychart/globe/` and is not a `SkyChart` view.**
  (FR-GLOBE-1, FR-GLOBE-14, FR-GLOBE-15, FR-GLOBE-17; SPEC FR-SKY-1 as amended.) New: `src/ui/components/guide/skychart/globe/{constants,projection,scene}.ts` (pure), `GlobeRenderer.ts` (the SVG built once and written per frame), `SkyGlobe.tsx` and `SkyGlobe.module.css` (the component: the box's measure, the pointer, the wheel and the keys, the renderer's host).
  `SkyGlobe.tsx` is the default export of a `React.lazy` in `Stars.tsx`, so Rollup names its chunk `SkyGlobe-*.js` and `scripts/bundle-budget.ts` gains the row `{ name: 'globe', match: /^SkyGlobe-.*\.js$/, limitKb: 15 }` (`GLOBE_BUDGET_KB`).
  The globe draws no pass, takes no `SkyScene` and has its own camera and instant, so it does not go through `SkyChart`'s view switch or `useSkyScene`'s layer table; it reads the catalogue, `starGlyphs.markFor`, `skySurface.tintStep` and `starLabels.ts` from the window's directory as imports.
  The directory is the `chart` lane's (`skychart/**` except `window/`).
- **D-1035 — The stars page's view is `window` or `whole`, and the width picks what `whole` draws.**
  (FR-GLOBE-1.) `Stars.tsx`'s view state becomes `'window' | 'whole'`; `whole` renders `SkyChart` with `view="polar"` on compact (FR-PHONE-7 unchanged) and `<SkyGlobe>` on wide, the label `t.chart.views.wholeSky` on compact and `t.globe.view` (`Globe` / `Globo`) on wide.
  A resize across the breakpoint re-renders with the same state, so the mapping needs no effect; the window's camera is the page's and survives as it does today.
  `v` cycles the two values.
  On wide with `whole`, `FieldSection`'s list is the globe's (`globe/scene.ts`'s `upList`, D-1037) and its heading `Up from <place>`; the facing row is not drawn (the globe has no facing); the layer row gains `faint`.
- **D-1036 — The projection is the spike's, without the mirror.**
  (FR-GLOBE-2, FR-GLOBE-5, FR-GLOBE-6.) `globe/projection.ts` ports `globe.ts`: `Vec3` helpers, `radec`, `Frame` (`EQUATORIAL`; `localFrame(zenith, north)` for turning with you), `viewAxes(frame, lon, lat)`, `project(p, s)` → `[x, y, depth]` with no x flip (the true outside view, V212-3), `pathOf` (a polyline's near-side path), `groundPath`, `greatCircle`, `parallel`, `meridian`, `ECLIPTIC_POLE`; and two the spike had in `main.tsx`: `coordsIn(to, from, lon, lat)` (a frame switch that keeps the centre) and `dragTurn(p, from, to)` (the view's new longitude and latitude so the grabbed direction lands under the pointer, latitude clamped to ±90°).
  The opening view is `openView(sky)`: in the local frame, longitude 180° (south) when the place's latitude is negative and 0° (north) otherwise, latitude `GLOBE_OPEN_ALT_DEG`.
- **D-1037 — The scene is one rotation per instant, inverted.**
  (FR-GLOBE-3, FR-GLOBE-8, FR-GLOBE-12, FR-GLOBE-13, FR-GLOBE-17; SPEC FR-STAR-2.) `globe/scene.ts`'s `globeSky(place, t)` takes the J2000→horizon rotation FR-STAR-2 already builds (`astronomy-engine`'s `Rotation_EQJ_HOR`, through `lib/skyStars.ts`'s path) and reads the zenith, north and east as J2000 directions from its transpose's columns; the bodies come from `lib/skyBodies.ts` at the same instant and are turned back to J2000 by the same transpose, so they sit where the window puts them.
  `altAz(sky, s)` reads any direction's altitude and azimuth; `upCount(sky, dirs)` and `upList(sky, catalog, bodies, lang)` (the `FIELD_LIST_MAX` brightest above the horizon, `FieldList`'s row shape); `figureAnchor(figure, drawn)` (the drawn vertex nearest the drawn endpoints' centroid, D-1041); `surfaceAt(sky)` is `skySurface.tintStep` of the Sun's altitude.
  The positions of the 904 bright stars as unit vectors are built once per catalogue, and the deep catalogue's on load.
- **D-1038 — The renderer: fixed nodes, bucketed dots, frames only when something moves.**
  (FR-GLOBE-4, FR-GLOBE-10, FR-GLOBE-14, FR-GLOBE-15.) `GlobeRenderer` creates at mount: the disc and the ground, the grid, the ecliptic and the Milky Way paths, one path per figure layer side (above and below the horizon), one `<text>` per star of V ≤ `STAR_DOT_MAG` (about 93) and per named star and figure (about 23 and 89), the Sun, the Moon (FR-LOOK-7's `MoonDisc` geometry), the planets, the compass, the zenith and the poles, and 40 dot paths (4 tones × 5 sizes × 2 sides) — the spike's 324 nodes, under `GLOBE_MAX_NODES`.
  `set(state)` merges a change and schedules one `requestAnimationFrame`; a frame projects every direction, writes the `d`, `x`, `y`, `visibility` and class attributes by ref, and places the labels (D-1041).
  There is no idle loop: a frame runs on a drag, a wheel, a key, a prop change and each playback tick.
  The deep stars are appended to the dot buckets' arrays when `deepChunk.ts` resolves; no node is created.
  Colours are classes in `SkyGlobe.module.css` over the tokens FR-GLOBE-14 names; the opacities are `globe/constants.ts`'s numbers written as attributes (FR-DS-2 admits a unitless opacity).
- **D-1039 — The globe's time is a second `usePlayback`.**
  (FR-GLOBE-7, FR-GLOBE-8; SPEC OQ-56's default.) `Stars.tsx` mounts `usePlayback({ span, realNow: now, initial: null })` for the globe, with `span` = now ± `GLOBE_SPAN_DAYS` read once per visit, and passes its `t` to `SkyGlobe`; the steps call `stepTo(t ± HOUR_MS | 24 × HOUR_MS)`, a speed button `setSpeed` then `play` (or `pause` when it is the pressed one), `[ now ]` `toNow`.
  The hook is imported from `components/live/usePlayback.ts` read-only (the `live` lane's file is not edited); Rollup moves it to a shared chunk, which the release measures.
  While playing the page re-renders per frame as the live page does; the rail's count and list are memoised on `t` floored to `BODIES_EVERY_MS` so they recompute at most once a second of wall time, and the renderer writes every frame.
  The hash, the prefs and the store are not written.
- **D-1040 — The places are read, never written.**
  (FR-GLOBE-9; SPEC OQ-55's default.) The rail's `Place` group reads `observer` and `favourites` from the store (`mostRecentlyUsed`) and holds the globe's choice as local state, `'observer'` or a `cellKey`; a press sets it and nothing else — no `setObserver`, no `touchFavourite`, no prefs write.
  A choice whose favourite is removed meanwhile falls back to `'observer'`.
  Turning with you, a new place re-opens `openView` for it; turning with the stars, the view is kept.
- **D-1041 — `starLabels.ts` gains two options, off by default.**
  (FR-GLOBE-11.) `placeLabels(input, options?)` takes `fixed?: readonly FixedLabel[]` — the bodies' labels, placed after the compass at the first free of right, left, above and below, and never dropped — and `figureStart?: 'centroid' | 'vertex'`, `'centroid'` by default; with `'vertex'` the walk's first place is `figureAnchor`'s vertex.
  The window and the polar chart pass neither, so their placement and snapshots do not move; `starLabels.test.ts` gains the globe's cases.
  *(R168, as built)* The vertex reaches the placer as `FigureLabel.anchor` (optional; a figure without one keeps the centroid under `'vertex'`, and the grid stays over the drawn endpoints' extent, nearest the start).
  A fixed label with no free place takes the first of the four inside the box and clear of the labels already placed, else the first inside, else the right, and the named mark's label falls back the same way, so neither writes over a body's name; it is `kind: 'fixed'`; a star name or the landmark's on a fixed label's mark is not drawn twice; a fixed label gives way to the tap's label on its own mark (the tap's, placed next, carries the magnitude); and a figure never removes one to keep its name, as it removes a star's.
- **D-1042 — Strings, tests and captures.**
  (FR-GLOBE-16, FR-GLOBE-18.) A `globe` section in `src/i18n/{en,es}/` holds every word of §4.55 (in `main` by FR-I18N-2's one catalog, within `GLOBE_MAIN_KB`).
  Tests: `globe/{projection,scene}.test.ts`, `GlobeRenderer.test.ts` (jsdom: node counts, a frame's attributes, the deep stars' append), `SkyGlobe.test.tsx` (keys, wheel, the label's naming), `Stars.test.tsx`'s wide globe cases (the view row, the rail's groups, the second playback, the places, the faint toggle), `tests/e2e/globe.spec.ts` (1280 × 800 and 1920 × 1080: the breakpoint crossing, drag, keys, steps, ×3600 under a paused `page.clock`, a saved place, Tab order, the hash unchanged), `tests/e2e/globe-perf.spec.ts` (`stars-perf.spec.ts`'s CDP throttle at 4×, best of three drags and a ×3600 run, faint off and on), `axe.spec.ts` with the globe shown.
  `captureSeeds.ts` gains a London favourite; `captureSet.ts` the five screens of FR-GLOBE-18 and `stars-whole`'s widths `[390]`.
- **D-1043 — Delivery shape.**
  (V212-10; D-975's rule.) Five tasks in four waves (§16.31): one `fable` (the renderer and the hand, which must iterate against what it draws and hold the rate), four `opus`; every task `Gate: auto`, reviewed on `opus` at 500 turns with no fallback; at most one Fable task per wave; the driver's wait-and-resume on; every squash merge with an explicit commit message.
  The owner reads `/usage` before wave 2.
- **D-1044 — A drag turns about the frame's pole and reaches what the pole lets it.**
  (FR-GLOBE-6; R167.) `dragTurn(p, from, to)` solves the turn in closed form: in the view's own terms a direction at frame latitude φ has screen x = cos φ·sin(λ − lon) whatever the view's latitude, so x fixes the longitude (two roots, the one whose view axes — centre and up — turn least from the present view's chosen, so where the nearer root is clamped the point lags the hand rather than the globe flipping to the other root half a turn away) and the latitude is the turn about screen right taking the grabbed direction's (depth, y) to the pointer's.
  With the pole kept up, a target further than cos φ radii from the screen's vertical is unreachable; there the grabbed point goes to the nearest x it can reach, and `projection.test.ts` holds the 0.5 px rule on the reachable drags (over 250 of 400 seeded drags inside 0.8 of the radius).
  `unproject(p, x, y)` (a screen point to its near-side direction, off-disc points taken to the rim) is the drag's other half and is exported for the renderer's hover.
  `viewAxes` drops the spike's ±89.5° clamp: up is written as −sin(lat)·h + cos(lat)·pole, exact at the poles, so the ±90° clamp is the drag's alone.
- **D-1045 — The globe's planets are `skyStars.ts`'s calls, not `starsAt`.**
  (FR-GLOBE-17, FR-STAR-2; R167.) `globeSky(place, t)` makes `Rotation_EQJ_HOR` itself and evaluates the five planets with the same `Equator(…, true, true)`, `Horizon` and `Illumination` calls `lib/skyStars.ts` makes, rather than calling `starsAt`: `starsAt` memoises one slot keyed on the catalogue, so the globe asking it with an empty catalogue would evict the stars page's entry, and asking it with the page's catalogue would do 1 033 products the globe already has.
  `scene.test.ts` holds every star's altitude and azimuth and every planet's to `starsAt`'s at three sites.
  `globeSky` keeps its own one-slot memo on `(t, lat, lon, altM)`.
  `BODIES_EVERY_MS` is `lib/playback.ts`'s, re-exported by `globe/constants.ts` rather than restated.
  `upList(sky, catalog, planets, lang)` takes the planets as an argument so the planets layer off passes `[]`; a planet's row index is past the catalogue's length (D-750).
  `figureAnchor(figure, drawn)` returns `{ index, x, y }` (the vertex's star index and its screen point) or `null`, counting a segment only when both its ends are drawn.
  The zenith's test turns the J2000 zenith to the equator of date before comparing it with the sidereal time: J2000 and of-date right ascensions differ by about 0.3° in 2026, three times the test's tolerance.
- **D-1047 — The renderer fills React's `<svg>`, and what it draws that D-1038 left open.**
  (FR-GLOBE-2, FR-GLOBE-4, FR-GLOBE-10, FR-GLOBE-11, FR-GLOBE-16, FR-X-3; R169.) `SkyGlobe` renders one empty `<svg>` (the class, `role="img"` and `data-globe` React's) and `GlobeRenderer` takes it, makes every child with `createElementNS` in the root's own `namespaceURI` and writes the label and the `viewBox`; `dispose` empties it and leaves the root.
  No namespace string is written in `src/`: `tests/deploy/headers.test.ts` reads every `http://host` in the code as a connection the CSP must allow, and `www.w3.org` is not one.
  The Sun is a disc of `MOON_DISC_PX` in `--chart-sun` (the window has no point mark for the Sun, only the horizon glow, which has no place on a sphere).
  A figure line keeps the collision gap at each end (D-754, as the window draws), and a segment shorter than the two gaps is not drawn: with the lines into the stars, nine of thirteen named stars at the opening view had no free place.
  The dot buckets are five even steps from `DOT_RADIUS_PX.faint` to `.bright` (`DOT_STEPS`); a deep star takes its bucket's full opacity, since a bucket is one path and FR-GLOBE-4 names the size alone.
  Every bright-catalogue star is a hit (a dot at its point, with no mark box), so a dot can be named too; the deep stars are not (they have no name and no designation).
  The star names with a node are the proper names to the window's base row (`FIELD_DETAIL_STEPS[0]`'s `nameMag`, 1.5 — 23 nodes); a figure's name node is `figureName` of its part.
  The drawing's words — the SVG's label, `zenith`, the poles' `NCP`/`SCP` (`PCN`/`PCS`), `Sun`, `Moon`, the readout's `below` line and the Sun's and the Moon's own lines without a magnitude (`bodyUp`, `bodyBelow`) — are a `globe` section inside `chart` in `i18n/{en,es}/chart.ts`, the chart lane's file (D-283), reached as `t.chart.globe`; the planets' names and the sky-side readout line are the stars page's (`STARS_PAGE_CATALOGS`).
  D-1042's top-level `globe` section is the rail's (R170), which may move these under it; `messages.test.ts`'s key snapshot was updated for the eight keys.
- **D-1048 — The hand is a ref, and what it owns.**
  (FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-9, FR-GLOBE-10, FR-GLOBE-11; D-744, D-751, D-1040; R169.) The view (`lon`, `lat`, `zoom`) is a ref in `SkyGlobe`; a drag, a wheel, a pinch and a key write it and call `renderer.set`, which draws on its own animation frame; React renders the component only for a prop, the named object or the dragging flag.
  A drag folds the moves since the last frame into one `dragTurn` on the next frame, from the last point applied to the latest, against `projectorFor` of the view as it now stands (not the last drawn frame's), so a late frame never turns twice.
  A press that travels under `HIT_RADIUS_PX` holds the globe still and names on release what was under the press; past it, it is a drag and names nothing.
  The wheel is the globe's whole (a notch of 100 px, or 3 lines, zooms one `GLOBE_ZOOM_STEP`, a trackpad's smaller deltas their share of one, at most one notch an event; `preventDefault` without a modifier), unlike the window's ctrl + wheel, since the globe has no page under it to scroll; ctrl or cmd + wheel stays the browser's zoom; a pinch zooms by the ratio of the fingers' distance, continuous, clamped the same; ctrl or cmd with `+`/`=`/`-` stays the browser's.
  `Home` is `openView` carried into the current frame by `coordsIn`.
  A turn switch converts the view by `coordsIn` from the frame last drawn (the old turn at the place and instant it was drawn with) into the new one, so a place or a time that changes in the same render does not move the centre; a new place while turning with you re-opens the view in the component (D-1040's rule lives here, so R170's page passes the place and nothing else).
  `faint` on calls `loadDeepChunk` once and hands the catalogue to `setDeep` (a load cut short by `faint` off before it returns is asked for again on the next on); a rejection calls the `onFaintFailed` prop and the next `faint` on fetches again — the page's toggle (R170) unpresses on it.
  A pressed name holds `STAR_LABEL_HOLD_S` as the window's own does; a hover's goes with the pointer.
  The box carries `tabindex="0"`, `aria-describedby` to its readout line and no name of its own: the page names the group, as it names the window's (R115).
- **D-1049 — The labels are placed every frame, and the rate measured.**
  (FR-GLOBE-11, FR-GLOBE-15; D-817; R169.) The renderer runs `placeLabels` on every frame rather than behind the window's `converged()` gate: the globe has no sensor jitter, and under a drag or the ×3600 lapse every frame moves every name.
  Measured by the spike's method (`GlobeRenderer` alone in a full-window harness, turned 0.6°/frame with the latitude swinging ±20°, a 1 s warm-up, the best of three 5 s sweeps; Apple silicon, headless Chromium, 2026-11-03): 288 nodes at mount, faint off and on; a drag at 1280 × 800 76.6/s at 1× and 76.6/s at 4× faint off, 79.1 and 59.3 faint on; at 1920 × 1080 76.4 and 73.3 faint off, 78.5 and 62.4 faint on; the ×3600 lapse at 4× between 63.7 and 70.3; mean draw 2–3 ms at 1× and 7–11 ms at 4×, the placement inside it.
  Against the spike's 76–86 at 1× and FR-GLOBE-15's 30 at 4× there is headroom; `globe-perf.spec.ts` (R170) is the gate on the page.
  Known limit: at the opening view about eight of the thirteen named stars on the near side get a name, the rest dropped by D-755's rule (a line or a mark in the way); zooming in names them.
- **D-1050 — The globe's rail is lazy with the globe, and on the globe it is the layout's scrolling row.**
  (FR-GLOBE-7..12, FR-GLOBE-15; D-1035; R170.) The rail's groups and its list (`stars/GlobeRail.tsx`) are a second dynamic import beside `SkyGlobe` (`stars/globeChunk.ts`, both prefetched on idle on wide only), because with them in `stars` that chunk measured 32.5 KB against 2.11.0's 29.9, past `GLOBE_STARS_KB`; lazy, `stars` is 31.4 (32,143 bytes, +1.5) and `main` 187,143 bytes (+749 over 186,394).
  The `globe` row in `PHASE_BUDGETS` counts `SkyGlobe-*.js`, `GlobeRail-*.js` and the `scene-*.js` they share: 13.4 against `GLOBE_BUDGET_KB` (15).
  The groups — `Time`, `Turn`, `Place` (up to nine options), then the layer rows with `[ ] faint`, then the count and `Up from <place>` — are one column in `SkyViewLayout`'s `list` slot, the row that gives and scrolls: in the `timeline` and `layers` slots at 1280 × 800 they were ~626 px of fixed rows in a ~606 px column, so the list had no room and the place group ran under the footer; and the rail's grid draws `layers` above `timeline`, against the DOM order.
  No facing picker, no readout slot and no hint on the globe.
  The SVG's own label is R169's fixed sentence (`chart.globe.label`); FR-GLOBE-12's label naming the place, the instant and the turn is the page's group around the box (`aria-label` on `stars-sky`, as it names the window's), since `SkyGlobe` takes no label prop.
- **D-1051 — On the stars page `v` is the page's, and the places list skips the observer's own entry.**
  (FR-GLOBE-1, FR-GLOBE-9, FR-DESK-4; D-1040; R170.) The page's one capture listener on the window (R163's `Esc` one) also takes `v` (by `shortcutFor`'s guard, so a typing target and the overlay's inert page are left alone) and cycles `window` / `whole` at both widths, before `App`'s listener would switch the other pages' saved chart view.
  The `Place` group lists the observer, then the favourites newest use first (`mostRecentlyUsed`, re-exported from `src/state` as `favouriteCellKey` is, since `src/ui` may not import `src/data`), leaving out the favourite whose `cellKey` is the observer's, so the same place is not offered twice.
  A time-lapse pauses when the globe is left (to the window or to compact), since the page re-renders per frame while it plays; the instant is kept.
  `globe-perf.spec.ts` (Apple silicon, headless Chromium, 4× throttle, 2026-11-03): drag best of three 49.4/44.4 at 1280 × 800 and 47.5/43.1 at 1920 × 1080 (faint off/on); ×3600 58.5/48.7 and 55.9/43.1.
- **D-1052 — The release's capture diff is measured on one machine, and only what moved is committed.**
  (FR-GLOBE-18, FR-CAP-5; D-742; R171.) A headless task cannot dispatch `captures.yml` (no `gh`), so R171 measured as R161 did: 2.11.0's set shot by `8413d978`'s own spec off a plain build of `8413d978` extracted into a scratch tree, and the branch's set shot twice off the branch's plain build, all on one Mac.
  The comparison is between those runs, never against the committed Linux raster, which differs from a Mac's everywhere.
  What is committed is 2.11.0's files where nothing moved, the Mac run's files for the 12 moved (the wide view row's word) and the 24 new, and the four `stars-whole-1280` files deleted; `captures.yml`'s run on `main` after the merge is the set of record, and whether its artefact replaces the mixed set is the owner's (RELEASE §25.4).
  The routes: `globeShown` ticks the paused clock until the zenith's mark and the rail's groups are drawn (the two lazy chunks' Suspense reveals, R32) and pins `CLOCK`, which is the globe's own instant too (its playback opens at now); `stars-globe-place` scrolls London's row to the rail's end, since the click's own scroll differs by where the row starts; `stars-globe-named` pins first and presses the row after, since `STAR_LABEL_HOLD_S` is 4 s and a pin is a 10 s tick.
  The London favourite is `observers.ts`'s geocoded `LONDON`, not `globeHelpers.ts`'s literal, so the rail's name is the geocoder's (`London, England, United Kingdom`).
- **D-1053 — `live` and `window` give bytes back to shared chunks, and that is not a moved row.**
  (FR-GLOBE-15, D-178; R171.) Against 2.11.0, `live` is −1,074 bytes and `window` −135: what the globe shares with them (`shownTime`, `useWallThrottle`, `skySurface`, `starGlyphs.module`, `deepChunk`) is a chunk of its own now.
  FR-GLOBE-15's "no other row moves" is read as "no other row grows": no budget changes, and RELEASE §25.4 asks the owner to accept the reading.
  `globe` leaves `PHASE_BUDGETS` for `BUDGETS` at 15 (13.5 × 1.1 = 14.9, GLOBE_BUDGET_KB its ceiling).
- **D-1054 — A desk opens the stars page on the globe; the width at the open picks the view.**
  (FR-GLOBE-1, FR-PHONE-7 as amended; V212-11, OQ-57.) `StarsSky`'s view state starts `wide ? 'whole' : 'window'`: the one choice of D-1035 is kept, so a desk opened on the globe and narrowed shows the polar chart, and a phone opened on the window and widened shows the window.
  Nothing is saved and no hash or pref names the view (FR-PHONE-7), so there is no link to the window to honour; `Window` and `v` stay one press away.
  The page's focus rule (FR-A11Y-1..3) is the window's: `SkyGlobe` focuses its own box on mount when the focus is on nothing, so `stars` pays no bytes for it, and the window's MutationObserver still focuses the window's box when that arrives and the focus is in the sky.
  The specs written for the window press `Window` after the open (`globeHelpers.ts`'s `onWindow`), and the five `v1-stars` desk captures that showed the window now show the globe.
  `stars` is 32,121 bytes against 2.12.0's 32,147 (−26): the `globeSky` class switch on `stars-sky` went to a `[data-view='globe']` selector in `Stars.module.css` to pay for the default.
- **D-1055 — The row under the globe has one height, and the zoom buttons stand in it.**
  (FR-GLOBE-6, FR-GLOBE-11 as amended; V212-12, V212-13.) The bug: `stars-sky` on the globe is a two-row grid, `minmax(0, 1fr) auto`, the box above and the readout `<p>` below; with nothing named the `<p>` is empty and 0 px tall, so a hover's name gave it a line and the box lost that line, and the renderer's `ResizeObserver` re-measured the radius from the shorter box — the globe shrank on every hover and grew back on leave.
  The row is now `SkyGlobe`'s `.foot`, a flex row holding the readout (one line, `nowrap`, ellipsised, `flex: 1`) and `[ + ]` `[ − ]` (TextButton), so its height is the buttons' whether a name is shown or not.
  The buttons go there, not in the rail beside `Turn`: the window has no zoom control to copy, the view and its zoom are `SkyGlobe`'s ref (D-744) and the rail is another lazy module, so the row keeps them in the `globe` chunk with no state lifted through `stars`.
  A press is `zoomBy(GLOBE_ZOOM_STEP)` or its inverse, the clamp the wheel's; a `zoomEnd` state (`'min'`, `'max'` or none) changes only at an end of the range and disables that button, so a wheel's notches do not re-render the component.
  The names are `chart.globe.zoomIn` / `zoomOut` in `main` (+34 bytes, inside GLOBE_MAIN_KB).
  `globe.spec.ts` asserts the box and the disc's radius identical before and while a star and a planet are hovered at both desk sizes.
- **D-1056 — The named figure is one more path, written by ref.**
  (FR-GLOBE-11 as amended, FR-GLOBE-14, FR-GLOBE-15; V212-13.) `GlobeRenderer` makes a `[data-figure-named]` path at mount, after the two figure paths, in `.figureNamed` (`--accent`, 2 px); each frame writes into it the drawn segments of the named figure (a hover, a tap or a click; `s.named.kind === 'figure'`) and nothing otherwise, from the loop that already builds the figure paths.
  The named label carries `data-figure` while a figure is named, `.starLabel[data-figure]` filling it in `--accent`; the named label is placed whatever `names` says (it always was), and with `names` on the figure's own name is left out of the walk so it is not drawn twice.
  One node, no new listener, no new loop: the node count stays under `GLOBE_MAX_NODES` and the frame's cost is a string concatenation over the named figure's segments.
  The `globe` row is 14,080 bytes against R171's 13,807 (+273 for D-1055 and D-1056), under GLOBE_BUDGET_KB (15,360); no budget row moves.

### 8.20 The globe *(v2.12, FR-GLOBE-1..18, D-1034..D-1043)*

The globe is a fourth drawing of the sky beside the dome, the polar chart and the window, but not a fourth `SkyChart` view: it shows the sphere, not a place's sky, so it takes the catalogue and a place and an instant rather than a scene.
The pure half (`projection.ts`, `scene.ts`) knows no DOM and is tested by numbers; the renderer knows no React and is written by ref; `SkyGlobe` is the only part React renders, once per prop change; the page owns the instant (a second `usePlayback`), the place choice and the layers, and passes them down.
It is reached only from the wide stars page and costs a phone nothing.

---

### 9.14 v2.12 additions *(FR-GLOBE)*

- **The geometry by numbers.**
  `globe/projection.test.ts` and `globe/scene.test.ts`: the centre and the rim, the far side, the mirror's sign, a frame switch keeping the centre, a drag keeping the grabbed point, the zenith of Buenos Aires against the local sidereal time, London's south pole on the ground side, Quito's horizon through both poles, the count and the list for a fixed place and instant, the surface's three steps across one evening, Hydra's anchor on a vertex.
- **The drawing by structure.**
  `GlobeRenderer.test.ts`: the node count fixed across the faint toggle and ≤ `GLOBE_MAX_NODES`; a bucket's segments equal its near-side stars; dimmed stars present with the dimmed class.
- **The page.**
  `Stars.test.tsx` and `SkyGlobe.test.tsx` per D-1042; `controlRows.test.ts` for the rail's rows in both languages; `messages.test.ts` for the catalogs.
- **End to end and the rate.**
  `globe.spec.ts` and `globe-perf.spec.ts` per D-1042; `axe.spec.ts` with the globe.
- **Unchanged is a capture.**
  Every compact capture and every live and pass-detail capture byte-identical to 2.11.0's; the wide `stars` captures move by the view row's word alone.

### 16.31 Delivery of the v2.12 tasks *(V212-1..V212-10, D-1034..D-1043)*

The V1-11 rules are unchanged; the gate is v2.10's (D-975): auto, merged on CI green and a clean `opus` review, every squash merge with an explicit commit message.
Five `R` tasks in four waves, after this plan is on `main`.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R167 — The globe's geometry: `globe/constants.ts`, `projection.ts` and `scene.ts` as pure modules with their tests (the frames, the view, the projection, the paths, the ground, the drag's turn, the frame switch, the opening view, the place's sky at an instant, alt/az, the count, the list, the anchors, the surface step); nothing mounted | `chart` (`skychart/globe/{constants,projection,scene}.ts` and tests) | opus | auto | — |
| 1 | R168 — The labels' two options: `starLabels.ts`'s `fixed` bodies and `figureStart: 'vertex'`, off by default, with the globe's cases; the window's and the polar chart's placement and snapshots unchanged | `window` (`skychart/window/starLabels.{ts,test.ts}`) | opus | auto | — |
| 2 | R169 — The renderer and the hand: `GlobeRenderer` (the SVG once, the marks, the bucketed dots, the deep stars on load, the dimmed side, the surface, the labels by R168's options) and `SkyGlobe` (the measure, the drag, the wheel and the pinch, the keys, the naming on hover and press, the readout line), its stylesheet on the sheet's tokens, the renderer's and the component's tests; nothing mounted on a page | `chart` (`skychart/globe/**`) | fable | auto | R167, R168 |
| 3 | R170 — The stars page's globe: the view state `window`/`whole` and the wide row `[ Window ] Globe`, the lazy import and the prefetch, the rail's `Time`, `Turn`, `Place` and layer groups with `faint`, the second `usePlayback`, the count and `Up from <place>`, the `globe` catalog section in both languages, the `globe` budget row, `globe.spec.ts`, `globe-perf.spec.ts`, the axe case | `ui` (`screens/Stars.*`, `screens/stars/**`, `src/i18n/**`, `scripts/bundle-budget.ts` (the row), `tests/e2e/{globe,globe-perf,axe}.spec.ts`, `tests/styles/controlRows.test.ts`) | opus | auto | R169 |
| 4 | R171 — Captures and 2.12.0: `captureSeeds.ts`'s London favourite, the five globe screens and `stars-whole` at 390 only, the capture set re-shot and diffed against 2.11.0 (FR-CAP-5), every budget row re-set by D-178, `package.json` 2.12.0, `docs/RELEASE.md` §25 with the owner's desk run, no tag | `docs`, crossing into `ui` (`tests/e2e/{captureSet,captureSeeds}.ts`, `tests/e2e/v1-captures.spec.ts`, `docs/screenshots/v1-*`, `scripts/bundle-budget.ts`, `package.json`, `docs/RELEASE.md`) | opus | auto | R170 |

R167 and R168 share no file.
R169 is the critical task: it is the spike made the app's, and it keeps the structure the spike measured at 76–86 frames/s (fixed nodes, bucketed dots, no idle loop, D-1038); the rate is asserted by R170's `globe-perf.spec.ts` once the page mounts the globe, and a miss there is R170's finding to fix in the renderer by a follow-up, not a reason to widen R170's lane.
R170 is the only task that touches `Stars.tsx`; R171 touches no source file.

**Sessions** (D-1043): every row carries `Review: opus`, `Turns: 500`, `Fallback: off`; `Model:` is `fable` on R169 (the renderer, the hand and the labels must iterate against what they draw and hold the rate) and `opus` on R167, R168, R170 and R171.
Every task is `Gate: auto`.

**The budget** (D-761's units): one Fable task and four Opus tasks with five reviews come to **about 1.7–2.5 five-hour windows**, as v2.11's.
Wave 2 holds the Fable task alone; the owner reads `/usage` before it.
The driver's wait-and-resume is on; nothing is started with `--no-wait`.

**The schedule it implies:** wave 1 about 1.5 h (two Opus tasks together); wave 2 about 3 h; wave 3 about 2.5 h; wave 4 about 2 h.
Unstopped about 9 h; with one five-hour stop about 14 h.
The critical path is R167 → R169 → R170 → R171.

**Owner gates:** none.
At R171 the owner opens the stars page on the desk: `[ Window ] Globe`, the globe turning with them, the switch to the stars, a drag, the wheel, the keys, a time-lapse at ×3600, a saved place, the faint stars, a star named; and the phone's stars page unchanged.
The tag `v2.12.0` and the deploy are the owner's.

**Decision block** (§16.2): **R167 takes D-1044..D-1045, R168 D-1046, R169 D-1047..D-1049, R170 D-1050..D-1051, R171 D-1052..D-1053.**
D-1034..D-1043 are this plan's.

What every session reads (D-284's rule): SPEC §4.55 whole (FR-GLOBE-1..18), US-50, §9 Phase 2u, §12 V212-1..V212-10, OQ-55..OQ-60; SPEC FR-STAR-2, FR-STAR-6, FR-STAR-7, FR-STAR-8 as amended, FR-STAR-14, FR-PHONE-7 as amended, FR-LOOK-2, FR-LOOK-4, FR-LOOK-5, FR-LOOK-8; PLAN §2.48, §8.20, §9.14 and this section; the spike, `git show spike-stars-desktop:spike/stars-desktop/<file>` for `IDEAS.md`, `globe.ts`, `renderer.ts`, `main.tsx` and `capture.ts` (R167 and R169).
