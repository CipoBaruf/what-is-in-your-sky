# v2.12 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.19 Goals (v2.12, "the globe")

- **G57. The whole sky of the whole world on a desk.**
  On a desk the stars page shows the celestial sphere from outside: every star and figure of both hemispheres, the reader's horizon across it, the share they can see marked off from the share they cannot.
- **G58. The sky in motion, and from another place.**
  Without leaving the page the reader turns the globe, runs its time an hour, a day or a time-lapse forward or back, and moves the horizon to a saved place, and sees why the sky changes with the hour, the season and the latitude.

**US-50 — The whole sky on a desk** *(v2.12)*
As a reader at a desk, I open the stars page and see the whole celestial sphere with my horizon on it, turn it, run its clock and move it to another of my places, and every star I point at is named.
- AC1: At 1280 × 800 and 1920 × 1080 the stars page's `View` row reads `[ Window ] Globe` / `[ Ventana ] Globo`, and the globe takes the box; at 390 × 844 the row still reads `[Window] Whole sky` and draws the polar chart (FR-GLOBE-1).
- AC2: The globe draws the bright catalogue's stars and the 88 figures on its near side, mirrored as a globe seen from outside, with the horizon as a great circle, the ground side shaded and its stars dimmed and not removed, the zenith, N E S W and the two poles marked, and the Sun, the Moon and the planets on it (FR-GLOBE-2..4).
- AC3: It opens turning with me — my zenith up, the sky wheeling about the pole as its time runs — and one control switches it to turning with the stars, where the stars hold still and the horizon sweeps; the switch does not move the view's centre (FR-GLOBE-5).
- AC4: A drag turns it with the point under the pointer staying under it, the wheel zooms it between 0.5× and 4×, and with the box focused the arrow keys turn it, `+` and `-` zoom it and `Home` resets the view (FR-GLOBE-6).
- AC5: `[ now ]`, `−1 d`, `−1 h`, `+1 h`, `+1 d` and the ×60, ×600 and ×3600 time-lapse move the globe's instant and nothing else: the window view, the app's clock and the link do not change (FR-GLOBE-7).
- AC6: The clock reads in the place's time zone, "21:14:05 GMT−3", and in UTC where the zone is not known (FR-GLOBE-8).
- AC7: My place and each saved place are one press each; a press moves the horizon, the clock's zone and the list to that place and leaves the app's place as it was (FR-GLOBE-9).
- AC8: `[ ] faint` is off on every visit; on, the 7,373 faint stars are drawn and the globe's node count does not change (FR-GLOBE-10).
- AC9: A hover, a tap or a click on a star, a body or a figure names it as on the window; the names of the Sun, the Moon and the planets never overlap a star's name; a long figure's name sits on its own lines (FR-GLOBE-11).
  *(amended v2.12, V212-11..13)* A named figure's lines and name are emphasised, and naming anything never changes the globe's size (FR-GLOBE-11); `[ + ]` and `[ − ]` zoom it (FR-GLOBE-6); a desk opens on the globe (FR-GLOBE-1).
- AC10: Every string is in both languages, the axe run is clean, the globe holds ≥ 30 updates/s under a drag and under ×3600 with the faint stars on, and the bundle rows hold (FR-GLOBE-15, FR-GLOBE-16).

### 4.55 The globe *(v2.12)*

The owner, 2026-11-02, at the desk: "Could we improve the stars view on desktop?
Maybe make a globe and see the stars of the whole world.
The flat (polar) view doesn't make much sense to me on desktop." A desk has no sky behind its screen; what it has is room, a mouse and time, which suit the questions asked while planning: what will I see tonight and where, what is on the other side, why is Orion here in December and gone in June, what does someone in another city see.
The polar chart answers the first and folds the sky inward to do it.
The spike on `spike-stars-desktop` (c914908f, `spike/stars-desktop/IDEAS.md`) weighed five shapes and built one, the **celestial globe**: the whole celestial sphere seen from outside, the reader's horizon a great circle across it.
It answers all four questions at a glance, reuses the catalogue, the figures, the names, the marks, the tones, the Milky Way outline and the window's ref-written SVG, needs no dependency, and drew at 76–86 frames/s headless with every faint star on.
The owner chose it for the desk on 2026-11-02 and 2026-11-03 (V212-1..V212-9).
The phone is unchanged.

Constants (FR-VIS-6 style, centralised with the others):

| Constant | Default | Rationale |
|---|---|---|
| `GLOBE_RADIUS_SHARE` | 0.45 | The globe's radius at zoom 1 as a share of the box's shorter side: the spike's, leaving the rim room for N E S W and the pole labels. |
| `GLOBE_OPEN_ALT_DEG` | 25° | The opening view's centre: this far above the horizon on the meridian toward the reader's visible celestial pole, so the zenith is up, the circumpolar sky faces the reader and the horizon crosses the lower third (the spike's default). |
| `GLOBE_ZOOM_MIN` / `GLOBE_ZOOM_MAX` | 0.5 / 4 | Out to the whole globe with room around it; in to one figure filling the box (the spike's range). |
| `GLOBE_ZOOM_STEP` | 1.25 | One wheel notch or one `+`/`-`; ten steps cover the range. |
| `GLOBE_KEY_STEP_DEG` | 15° | An arrow key turns the globe this far, `YAW_STEP_DEG`'s value, so the keys feel as the window's do. |
| `GLOBE_DIM_OPACITY` | 0.4 | Stars, figures, names and bodies under the reader's horizon: dimmed, never removed (V212-1), and still told apart from the sky side at a glance. |
| `GLOBE_GROUND_OPACITY` | 0.85 | The ground side's shade in `--chart-ground`: dark enough to read as "not yours", light enough that the dimmed stars show through. |
| `GLOBE_GRID_STEP_DEG` | 30° | The equatorial grid: hour circles every 2 h and parallels every 30°, hairlines that orient without crowding. |
| `GLOBE_SPAN_DAYS` | 366 | How far the globe's instant may run either side of now: a whole year, so ±1 d steps and the ×3600 time-lapse can show every season. |
| `GLOBE_SPEEDS` | ×60, ×600, ×3600 | `SPEEDS`' three time-lapse rates (FR-LIVE-5), the spike's three. |
| `GLOBE_MAX_NODES` | 400 | The SVG's node ceiling: the spike's 324 (the `*` glyphs, the names, the bodies, the marks and 40 dot paths) with room; the faint stars add none. |
| `GLOBE_BUDGET_KB` | 15 KB gzipped | The `globe` chunk: the spike's geometry and renderer are about 800 lines; the release re-sets it by D-178. |
| `GLOBE_MAIN_KB` | 1.5 KB | What `main` may grow over 2.11.0's measure: the phase's strings in both catalogs and the lazy import (main is 182.0 against its 185 ceiling). |
| `GLOBE_STARS_KB` | 1.5 KB | What the `stars` chunk may grow: the view row's third value and the rail's globe groups. |

- **FR-GLOBE-1** *(V212-1, V212-2)* **The view row on a desk.**
  On wide (FR-DESK-1's breakpoint, `width >= 964px`) the stars page's rail `View` row (FR-PHONE-7, FR-CLEAN-13) reads `[ Window ] Globe` / `[ Ventana ] Globo`: the window is unchanged and the globe takes the polar chart's place, in the box the window has, with the rail beside it.
  The polar chart is not offered on the wide stars page; the live page and the pass detail keep their view rows as they are.
  On compact the row stays `[Window] Whole sky` in the sheet (FR-CLEAN-4) and draws the polar chart: the globe is never mounted and its chunk never loaded on a phone.
  The second value is one choice at two widths — crossing the breakpoint with it chosen shows the globe on wide and the whole sky on compact, the window's camera kept as FR-PHONE-10 keeps it — and the page opens on the window at every width, unsaved, as FR-PHONE-7 has it (OQ-57).
  `v` (FR-DESK-4) cycles the two values.
  *Verification:* the view row's component test at both widths in both languages; `controlRows.test.ts`; `globe.spec.ts` resizes across the breakpoint with the second value chosen and asserts the globe, then the polar chart, then the globe.
  *(amended v2.12, V212-11; before: "the page opens on the window at every width")* On wide the page opens on the globe — `[ Window ] [Globe]` with `Globe` pressed — and the window is one press away; on compact it opens on the window as before.
  The width at the open picks the view; the choice is still the page's own and not saved, and no hash or pref names it (FR-PHONE-7), so there is no link that asks for the window: a press of `Window` or `v` is the way there.
  Crossing the breakpoint keeps the one choice as above (a desk opened on the globe shows the whole sky when narrowed).
  *Verification:* `StarsGlobe.test.tsx` — wide opens with `Globe` pressed and the store's `chartView` untouched, compact on the window; `globe.spec.ts` opens on the globe at 1280 × 800 and 1920 × 1080.
- **FR-GLOBE-2** *(V212-1, V212-3)* **The sphere from outside.**
  The globe is the celestial sphere under an orthographic projection seen from outside: radius `GLOBE_RADIUS_SHARE` of the box's shorter side times the zoom, centred in the box; a direction on the near side is drawn, one on the far side is not.
  **Figures are mirrored**, as on a brass globe: east is to the left of north as seen from the ground and to the right on the globe, and nothing flips them back; the labels' text reads normally.
  The disc is filled by FR-GLOBE-13's surface; over it, in this order: the equatorial grid every `GLOBE_GRID_STEP_DEG` as hairlines in `--rule`; the ecliptic dashed in `--chart-sun`; the Milky Way's three outlines (FR-LOOK-3's `milkyWay.json`) dotted in `--chart-haze`; the figures as 1 px lines in `--chart-figure`; the stars and the bodies (FR-GLOBE-4); the names (FR-GLOBE-11).
  The two celestial poles are marked `+` and labelled `NCP` / `SCP` (`PCN` / `PCS`) where they are on the near side.
  *Verification:* `globe/projection.test.ts` — a direction at the view's centre lands at the box's centre, one 90° off on the rim, one behind is not drawn; the mirror's sign (Betelgeuse right of Rigel's meridian on the globe when facing Orion from outside); a component test counts the grid, the ecliptic, the Milky Way and the figures' paths.
- **FR-GLOBE-3** *(V212-1)* **The horizon and the ground.**
  The shown place's horizon is a great circle in `--chart-horizon`, its near half drawn; the near disc's part below it is shaded in `--chart-ground` at `GLOBE_GROUND_OPACITY`, and every star, figure, name and body there is drawn at `GLOBE_DIM_OPACITY`, never removed.
  The zenith is a `+` in `--chart-compass` labelled `zenith` / `cenit`; N, E, S, W stand on the horizon at their points where those are on the near side (FR-I18N-4's abbreviations, the same in both languages), drawn in `--chart-compass`.
  *Verification:* `globe/scene.test.ts` — Buenos Aires at a fixed instant: the zenith's right ascension is the local sidereal time and its declination the latitude to 0.1°; London: the south celestial pole is on the ground side; Quito: the horizon passes within 1° of both poles; a component test asserts the dimmed class on a star below the horizon and that it is in the DOM.
- **FR-GLOBE-4** *(V212-1)* **The marks.**
  Stars by FR-LOOK-4's ladder and FR-LOOK-5's tones (`starGlyphs.markFor`, the window's): a `*` character at its size to `STAR_DOT_MAG`, a round dot below, sized by `DOT_RADIUS_PX`.
  The dots are not nodes: every dot of one tone, one size step and one side of the horizon is a zero-length round-capped segment in one `<path>`, so the node count is fixed at mount and never above `GLOBE_MAX_NODES`.
  The Sun as the window's Sun mark in `--chart-sun`, the Moon as FR-LOOK-7's disc with its phase, the planets as `@` (FR-LOOK-4), placed from `lib/skyBodies.ts` for the shown place and the globe's instant.
  No bloom, no horizon band and no haze fill: the globe is the atlas, the window the view.
  *Verification:* `globe/renderer.test.ts` — the node count with the faint stars off and on is the same and ≤ `GLOBE_MAX_NODES`; a dot path's segment count equals its bucket's stars on the near side.
- **FR-GLOBE-5** *(V212-4)* **Turning with you, or with the stars.**
  The globe opens **turning with you**: its frame's pole is the shown place's zenith and its longitude zero the north point, the view's centre is held in that frame (at `GLOBE_OPEN_ALT_DEG` toward the visible pole; north on the equator), so the zenith stays up and the sky wheels about the pole as the globe's time runs — the motion seen outside.
  A `Turn` / `Giro` row in the rail, `[x] with you [ ] with the stars` / `[x] con el horizonte [ ] con las estrellas` (a `ToggleGroup`, FR-I18N-3's neutral Spanish), switches to **turning with the stars**: the frame is the equatorial one (the north celestial pole up), the view's centre is held in right ascension and declination, the stars stand still and the horizon sweeps across them as time runs — the clearest picture of why the seasons change the sky.
  A switch keeps the direction at the view's centre, so nothing jumps; the choice is the visit's and not saved.
  *Verification:* `globe/projection.test.ts` — a switch keeps the centre direction to 1e-9; with you, the zenith's screen position does not move across an hour; with the stars, a star's does not; a component test of the row in both languages.
- **FR-GLOBE-6** *(V212-7)* **The hand and the keys.**
  A pointer drag turns the globe so the point under the pointer stays under it (to the rim's tenth; the view's latitude in its frame clamped to ±90°, so the globe never turns over its pole); the wheel, and a pinch on a touch screen, zoom about the box's centre by `GLOBE_ZOOM_STEP` per notch between `GLOBE_ZOOM_MIN` and `GLOBE_ZOOM_MAX`.
  The box is focusable (`tabindex="0"`, the focus ring of FR-DS-4's controls); while it has focus `←`/`→` turn the view's longitude by `GLOBE_KEY_STEP_DEG`, `↑`/`↓` its latitude, `+` (and `=`) and `-` zoom one step, and `Home` returns to the opening view at zoom 1 without touching the time or the place; none of them is a page shortcut (FR-DESK-4's list is unchanged).
  A drag or a key is one write per animation frame with the pointer captured, positions written by ref outside React's render (D-744, D-751), as the window draws.
  *Verification:* `globe/projection.test.ts` — the grabbed point after a drag is within 0.5 px of the pointer for a drag ending inside 0.8 of the radius; `globe.spec.ts` — keys and wheel change the view, `Home` restores it.
  *(amended v2.12, V212-12)* Two zoom buttons, `[ + ]` and `[ − ]` (TextButton, the app's bracketed control; accessible names "Zoom in" / "Acercar" and "Zoom out" / "Alejar"), stand at the right end of the readout row under the box (FR-GLOBE-11), since the window has no zoom control to copy and the row is the globe's own: each press is one `GLOBE_ZOOM_STEP` about the box's centre, clamped to `GLOBE_ZOOM_MIN`..`GLOBE_ZOOM_MAX`, and the button is disabled at its end of the range.
  They are outside the box and the row's height does not change with them, so they never cover the globe or change its size.
  *Verification:* `SkyGlobe.test.tsx` — a press changes the radius by one step, each button disabled at its limit, the names in both languages; `globe.spec.ts` presses `[ + ]` and `[ − ]`.
- **FR-GLOBE-7** *(V212-7)* **The globe's own time.**
  The globe draws at its own instant, which opens at now and ticks with real time as the page does (FR-STAR-8).
  The rail's `Time` / `Hora` group holds the clock (FR-GLOBE-8), `[ now ]` / `[ ahora ]`, `[ −1 d ] [ −1 h ] [ +1 h ] [ +1 d ]`, and the time-lapse `[ ×60 ] [ ×600 ] [ ×3600 ]` — pressing a speed plays at it, pressing the pressed one pauses, `[ now ]` returns to real time stopped.
  The instant is a second `usePlayback` (FR-LIVE-4, FR-LIVE-5's hook) owned by the globe, with the span now ± `GLOBE_SPAN_DAYS` and `GLOBE_SPEEDS`; playback stops at the span's end.
  It moves the globe and nothing else: not the window view (real time, FR-STAR-8), not the app's clock, not the hash, not the prefs; leaving the globe and coming back within the visit keeps it, a new visit opens at now.
  Every frame of a time-lapse is one rotation for its instant (FR-STAR-2); the bodies are recomputed at most every `BODIES_EVERY_MS` of wall time, as the live page's are.
  *Verification:* `usePlayback`'s existing tests stand; a component test: `+1 d` moves the globe's clock by a day and the window's readout not at all; `globe.spec.ts` with a paused clock: ×3600 for one second of wall time moves the clock by an hour, and the hash is unchanged.
- **FR-GLOBE-8** *(V212-8)* **The clock in the place's zone.**
  The clock line is `formatClock` and `formatDate` of the globe's instant in the shown place's `timeZone` — "21:14:05 GMT−3 · 2026-11-03" — and in UTC, labelled so, where the place's zone is not known (D-3's rule, as every time in the app); with the instant held, FR-TONIGHT-7's chip follows it (`+3 h`, `−1 d`).
  The spike's local mean solar time is not used anywhere.
  *Verification:* a component test with a saved place in `Europe/London` and the observer in `America/Argentina/Buenos_Aires`: the clock's zone changes with the place and the instant does not.
- **FR-GLOBE-9** *(V212-5)* **Your place and your saved places.**
  The rail's `Place` / `Lugar` group lists the app's observer first and then the saved places (FR-OFF-7) by `mostRecentlyUsed`, at most `MAX_FAVOURITES`, each a one-press option (a vertical `ToggleGroup`, labels ellipsised at the rail's width, the full name as the option's accessible name); with no saved place it is the observer's line alone.
  Pressing a place moves the globe to it: the horizon, the ground, the zenith, the compass points, the bodies, the clock's zone, the count and the list (FR-GLOBE-12); the globe's instant is kept (the same moment, read in the new zone); turning with you, the view re-opens at that place's opening view; turning with the stars, the view is kept.
  **It changes the globe only:** the app's observer, the saved places' order (`lastUsedAt`), the window view and every other page are untouched (OQ-55).
  No geocoding, no new place source, no dependency; the places are what the prefs already hold.
  *Verification:* a component test with two saved places: pressing one moves the zenith and the clock's zone and leaves the store's observer and `lastUsedAt` unchanged.
- **FR-GLOBE-10** *(V212-6)* **The faint stars.**
  The globe's layer row holds the page's `stars`, `figures`, `planets` and `names` (FR-STAR-6, as the window has them, `names` on by default on wide) and `[ ] faint` / `[ ] débiles`, off on every visit and not saved.
  On, the deep catalogue (FR-LOOK-8's `stars-deep` chunk, fetched by `deepChunk.ts`, the one place that fetches it) is drawn as dots into FR-GLOBE-4's paths — 7,373 more stars to 6.5, no new node; while it loads the toggle is pressed and nothing more is drawn, and a failed load unpresses it so the next press fetches again (`deepChunk.ts`'s rule).
  Offline it works as online (the chunk is precached, FR-OFF-1).
  *Verification:* a component test with the chunk mocked: off, no fetch; on, one fetch and the dot paths longer; failed, unpressed; the node count check of FR-GLOBE-4.
- **FR-GLOBE-11** *(V212-7)* **Naming, and labels that do not collide.**
  A hover, a tap or a click on a star, a planet, the Sun or the Moon names it as FR-STAR-7 does — the label beside the mark and the readout's second line ("Canopus · mag −0.7 · 28° up · S", or "· 12° below · S" / "· 12° bajo el horizonte · S" on the ground side, the altitude and point at the shown place and instant); on a figure's line with no mark within the hit distance it names the figure as FR-STAR-14; a second press, a press elsewhere or `STAR_LABEL_HOLD_S` clears it.
  The names are placed by `starLabels.ts`'s order (FR-STAR-6, D-755) with two additions on the globe: after the compass, the poles and the zenith, the Sun's, the Moon's and the planets' names are placed as fixed boxes and never dropped, so no star name lands on them (the spike's overlap); and a figure's name starts its walk at the figure's own drawn vertex nearest the centroid of its drawn endpoints, not at the centroid, so a long, bent figure (Eridanus, Hydra) is named on its own lines (the spike's oddity).
  The window and the polar chart keep their placement.
  *Verification:* `starLabels.test.ts` gains the globe's two cases: a planet's box beside a star name keeps the planet's and moves or drops the star's; Hydra's anchor is one of its vertices; the window's cases unchanged.
  *(amended v2.12, V212-13)* **The named figure is emphasised.**
  While a figure is named — under the pointer, tapped or clicked — its drawn lines are drawn again over the others in `--accent` at a 2 px stroke, and its name is the named label in `--accent`, shown whether `names` is on or off (with `names` on, the figure's own name is not drawn a second time); naming something else or nothing restores it.
  The emphasis is one path the renderer makes at mount and writes by ref, so the node count and the frame's cost do not change (FR-GLOBE-14, FR-GLOBE-15).
  **Naming never resizes the globe:** the readout row under the box is one line that never wraps (ellipsised) and holds the zoom buttons (FR-GLOBE-6), so its height is the same named or not and the box above it is never re-measured by a hover.
  *Verification:* `GlobeRenderer.test.ts` — a named figure's emphasis path holds its segments and none of the others', the label carries the figure's mark with `names` off, both cleared when the name goes; `globe.spec.ts` — the globe's bounding box is identical before and while hovering a star and a planet at 1280 × 800 and 1920 × 1080, and a hovered figure's emphasis path is drawn and empty after the pointer leaves.
- **FR-GLOBE-12** *(V212-8)* **The rail's count and the list.**
  Under the globe's groups the rail states "502 of 904 stars above the horizon" / "502 de 904 estrellas sobre el horizonte" (the bright catalogue, or with the faint stars on the whole drawn set) and the planets up with their direction; `In this field` becomes `Up from <place>` / `Sobre <lugar>`: the `FIELD_LIST_MAX` brightest objects above the shown place's horizon at the globe's instant, brightest first, each FieldList's row (name, magnitude, altitude, 16-point direction), a row's focus or activation naming its mark on the globe (FR-LEG-4's rule).
  The list is the globe's text alternative (FR-GUIDE-7); the SVG is `role="img"` with a label naming the place, the instant and the turn ("Celestial globe over Buenos Aires at 21:14 GMT−3, turning with you" / its Spanish), and the readout's second line is the polite live region the window's is.
  *Verification:* `globe/scene.test.ts` — the count and the list for a fixed place and instant; a component test of the list's focus naming the mark and of the SVG's label in both languages.
- **FR-GLOBE-13** **The twilight on the globe.**
  The disc's sky side takes FR-LOOK-2's surface for the Sun's altitude at the shown place and the globe's instant (`--chart-sky-day` above 0°, `--chart-sky-twilight` to −6°, `--chart-sky-deep` below), so a time-lapse across sunset darkens the globe, and the ground side's shade lies over it.
  Every rung is drawn on both sides at every hour: FR-STAR-13's twilight limit thins what a person can see from one place, and the globe is the whole sphere (OQ-58).
  *Verification:* `globe/scene.test.ts` — the surface's step at three instants of one evening; a component test asserts the class on the disc.
- **FR-GLOBE-14** *(V212-9)* **SVG by ref, and only the sheet's tokens.**
  The globe is one SVG built once at mount and moved by ref per frame, the window's method (D-744, D-751); not glyphcss (R124: 25 point polygons cost the dome 17 % of its drag rate, and a globe has 900 to 8,000 points; the R14 notes: braille only, no styling under the CSP).
  Every colour is a token that exists (`--chart-sky-*`, `--chart-horizon`, `--chart-ground`, `--chart-compass`, `--rule`, `--chart-sun`, `--chart-haze`, `--chart-figure`, `--chart-star*`, `--chart-planet`, `--chart-moon`), so the night theme is red with no new value; every length in the module is the sheet's (FR-DS-2) and every control a primitive (FR-DS-4).
  A token the build finds missing joins `tokens.css` with its night value and `docs/DESIGN.md` is regenerated.
  *Verification:* `literals.test.ts`, the tokens test and `design.test.ts` green; the night capture has no channel with `g > r`.
- **FR-GLOBE-15** *(V212-8)* **The chunk and the rate.**
  The globe — its projection, its scene and its renderer — is its own lazy chunk, `globe` (`SkyGlobe-*.js`), with its own row in `scripts/bundle-budget.ts` at `GLOBE_BUDGET_KB`, loaded when the wide stars page first shows the globe and prefetched on idle after the `stars` chunk on wide only; the service worker precaches it (FR-OFF-1).
  `main` grows by at most `GLOBE_MAIN_KB` over 2.11.0's measure and `stars` by at most `GLOBE_STARS_KB`; no other row moves; the release re-sets every row by D-178.
  Under a drag and under the ×3600 time-lapse, with every layer on and the faint stars off and on, the globe draws at ≥ 30 updates/s at 1280 × 800 and 1920 × 1080 with the CPU throttled 4× (FR-GUIDE-6's device as `stars-perf.spec.ts` stands for it), by `tests/e2e/globe-perf.spec.ts`, best of three drags (D-817's method); the spike measured 75.8 to 86.2 frames/s headless.
  *Verification:* `npm run bundle:budget`; `globe-perf.spec.ts`; a test that the compact stars page requests no `SkyGlobe-*.js`.
- **FR-GLOBE-16** *(V212-8)* **Both languages, and every reader.**
  Every string the globe and its rail groups show is in both catalogs (FR-I18N-*): the view's name, the groups' headings, the turn's two values, `now`, the steps and the speeds' accessible names, the place line, `faint`, the count, the list's heading, the pole and zenith labels, "below" in the readout, the SVG's label; the Latin and Spanish figure names are the catalogue's (FR-STAR-10).
  Every rail row fits the rail in both languages (`controlRows.test.ts`).
  Landmarks, the `h1` and the focus target are the page's (FR-A11Y-1..4); the axe run (FR-A11Y-7) covers the stars page with the globe shown; every control is reachable by Tab in reading order, the box among them.
  *Verification:* `messages.test.ts`; `axe.spec.ts` gains the globe; `globe.spec.ts` Tabs through the rail.
- **FR-GLOBE-17** **Pure modules, and the physics untouched.**
  The geometry is pure and tested apart from the DOM: `globe/projection.ts` (unit vectors, the two frames, the view's axes, the projection, a polyline's near-side path, the ground's region, a drag's turn) and `globe/scene.ts` (the shown place's zenith, north and east as J2000 directions at an instant through FR-STAR-2's rotation, alt/az of any direction, the count, the list, the figures' label anchors).
  No worker message, no physics module and no fixture changes: the golden fixtures from R1 pass unchanged.
  The stars' J2000 positions are drawn without precession, as the spike measured is invisible at a globe's scale; the bodies are topocentric as the window's are.
  *Verification:* the two modules' tests; `npm test` with the fixtures unchanged.
- **FR-GLOBE-18** *(V212-8)* **Named moves and captures.**
  The phase's visible changes are the wide stars page's view row (`Globe` for `Whole sky`) and the globe itself; every other capture is byte-identical to 2.11.0's under FR-CAP-5's comparison (the wide `stars` captures move by the row's word alone).
  The capture set loses `stars-whole` at 1280 (it keeps 390) and gains, at the set's fixed instant over Bariloche: `stars-globe` at 1280 × 800 and 1920 × 1080 (as it opens), `stars-globe-stars` at 1280 (turning with the stars), `stars-globe-faint` at 1920 (the faint stars on), `stars-globe-place` at 1280 (a saved place in London from the seeds: the south shaded) and `stars-globe-named` at 1280 (a star named by the list's first row), in the set's languages and themes.
  *Verification:* `captureIds.test.ts`; the release's diff against 2.11.0 (FR-CAP-5).

---

### 5.17 v2.12 additions *(proposal; the plan decides)*

- A `globe/` module set beside the window — `projection.ts` and `scene.ts` pure, a `GlobeRenderer` that builds the SVG once and writes it per frame — behind a `SkyGlobe` component that is its own lazy chunk (FR-GLOBE-14, FR-GLOBE-15, FR-GLOBE-17).
  The spike's `globe.ts` and `renderer.ts` are the starting point, cut to the sheet's tokens and the app's label placement.
- The stars page's view held as `window` or `whole`, the second drawn by `SkyPolar` on compact and `SkyGlobe` on wide, so the breakpoint maps one choice to two views with no saved state (FR-GLOBE-1).
- A second `usePlayback` instance for the globe's instant; no new time model (FR-GLOBE-7).
- `globe.spec.ts` and `globe-perf.spec.ts` at the wide sizes (FR-GLOBE-1, FR-GLOBE-6, FR-GLOBE-7, FR-GLOBE-15).

### Phase 2u — v2.12 ("the globe", as decided 2026-11-03, V212-1)

After v2.11.0 is on `main`.
The wide stars page only; the phone untouched.

- The globe's geometry as pure modules: the projection, the two frames, the scene, the count, the list, the label anchors (FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-5, FR-GLOBE-13, FR-GLOBE-17).
- The renderer and the hand: the SVG by ref, the marks, the faint stars, the drag, the wheel, the keys, the names (FR-GLOBE-4, FR-GLOBE-6, FR-GLOBE-10, FR-GLOBE-11, FR-GLOBE-14).
- The stars page's wiring: the view row, the rail's groups — time, turn, place, layers, count, list — both languages, the chunk (FR-GLOBE-1, FR-GLOBE-7..9, FR-GLOBE-12, FR-GLOBE-15, FR-GLOBE-16).
- Captures, the rate, the budget rows and 2.12.0 (FR-GLOBE-15, FR-GLOBE-18).

Definition of done:
- FR-GLOBE-1..18 met, each by its verification line; US-50's criteria green.
- `globe.spec.ts`, `globe-perf.spec.ts`, `axe.spec.ts`, `stars.spec.ts`, `whole-sky.spec.ts` and `sky-layout.spec.ts` green; every compact spec unchanged and green.
- Every task `Gate: auto`, merged on CI green and a clean review; the model per task is PLAN §16.31's; at most one `fable` task per wave, the driver's wait-and-resume on (V212-10, D-975's rule).
- `npm run bundle:budget`: every row inside its budget; `main` and `stars` within `GLOBE_MAIN_KB` and `GLOBE_STARS_KB`; the new `globe` row inside `GLOBE_BUDGET_KB`; the release re-sets the rows by D-178.
- The owner's desk run written into `docs/RELEASE.md` §25; `package.json` reads 2.12.0.
  The tag and the deploy are the owner's.
