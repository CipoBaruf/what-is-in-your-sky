# v2.12 — TASKS.md sections

Cut from `TASKS.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

## v2.12 tasks

Draft, cut 2026-11-03 from `SPEC.md` v2.12 and `PLAN.md` v0.20. Spec Phase 2u, "the globe": on a desk the stars page's second view is the whole celestial sphere seen from outside, the shown place's horizon on it, the ground side shaded and never cut, turning with you or with the stars, with its own time (now, ±1 h, ±1 d, a time-lapse at ×60, ×600 and ×3600), the app's place and the saved places one press away, the faint stars on a toggle, every mark named on a hover or a tap; the rail counts what is up and lists it as `Up from <place>`; the phone's stars page is unchanged and never loads the globe (FR-GLOBE-1..18, US-50, V212-1..V212-10). The owner accepted OQ-55..OQ-60's defaults on 2026-11-03: the globe only moves itself, its time is its own, the page opens on the window, no twilight thinning, the other shapes later, no field outline. The phase ends with `2.12.0` on `main`; the tag and the deploy are the owner's.

Delivery is PLAN §16 with §16.31: five tasks in four waves of two, one, one and one, `Model: fable` on R169 and `opus` on the rest, every task `Review: opus`, `Turns: 500`, `Fallback: off`, `Gate: auto` — every pull request merges itself on CI green and a clean review, with an explicit commit message so no co-author line lands on `main` (V210-14). The waves are built around the account's limits (D-1043, D-975's rule): no wave holds more than one `fable` task; the driver's wait-and-resume is on and nothing is started with `--no-wait`; the owner reads `/usage` before wave 2.

Decision block (§16.2), reserved in PLAN §16.31: **R167 D-1044..D-1045, R168 D-1046, R169 D-1047..D-1049, R170 D-1050..D-1051, R171 D-1052..D-1053**. D-1034..D-1043 are the plan's.

What every session reads, named in each task as "the phase set": SPEC §4.55 whole (FR-GLOBE-1..18), US-50, §9 Phase 2u, §12 V212-1..V212-10, OQ-55..OQ-60; SPEC FR-STAR-2, FR-STAR-6, FR-STAR-7, FR-STAR-8 as amended, FR-STAR-14, FR-PHONE-7 as amended, FR-LOOK-2, FR-LOOK-4, FR-LOOK-5, FR-LOOK-8; PLAN §2.48, §8.20, §9.14 and §16.31; the spike, `git show spike-stars-desktop:spike/stars-desktop/<file>` for `IDEAS.md`, `globe.ts`, `renderer.ts`, `main.tsx` and `capture.ts` (R167 and R169); `docs/DESIGN.md` for the tokens and the primitives by name.

### Wave 1

- [x] **R167 — The globe's geometry: `globe/constants.ts`, `projection.ts` and `scene.ts` as pure modules with their tests; nothing mounted**
  - **Lane:** chart
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); SPEC FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-8, FR-GLOBE-12, FR-GLOBE-13, FR-GLOBE-17, FR-STAR-2; PLAN D-1034, D-1036, D-1037, D-1041; the spike's `globe.ts` and `main.tsx` (`git show spike-stars-desktop:spike/stars-desktop/<file>`); `src/lib/skyStars.ts` (the J2000→horizon rotation), `src/lib/skyBodies.ts`; `src/ui/components/guide/skychart/window/{skySurface,starGlyphs,projection}.ts` (read only); `src/ui/screens/stars/FieldList.tsx` (the row shape, read only).
  - **Goal:** the globe's every number exists and is tested before anything draws it: a direction projects to the disc or to the far side, the horizon, the ground and the zenith of any place at any instant are J2000 geometry, a drag turns the view so the grabbed point stays under the pointer, the two frames switch keeping the centre, and the count, the list, the figures' anchors and the sky's surface step are pure functions.
  - **Satisfies:** FR-GLOBE-17; the geometry's half of FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-12, FR-GLOBE-13.
  - **Scope (PLAN D-1036, D-1037):** `src/ui/components/guide/skychart/globe/constants.ts` (every `GLOBE_*` the spec names: radius share, zoom step and bounds, opening altitude, the ground and dim opacities, `GLOBE_MAX_NODES`, `GLOBE_SPAN_DAYS`, `BODIES_EVERY_MS`, the budgets); `projection.ts` ported from the spike's `globe.ts` without the mirror (`Vec3`, `radec`, `EQUATORIAL`, `localFrame`, `viewAxes`, `project`, `pathOf`, `groundPath`, `greatCircle`, `parallel`, `meridian`, `ECLIPTIC_POLE`, `coordsIn`, `dragTurn`, `openView`); `scene.ts` (`globeSky(place, t)` through FR-STAR-2's rotation and its transpose, the bodies from `lib/skyBodies.ts` turned back to J2000, `altAz`, `upCount`, `upList` in `FieldList`'s row shape, `figureAnchor`, `surfaceAt` by `skySurface.tintStep`, the bright stars' unit vectors built once per catalogue); `globe/projection.test.ts` and `globe/scene.test.ts` per PLAN §9.14 (the centre and the rim, the far side, the mirror's sign, a frame switch keeping the centre, a drag keeping the grabbed point and the ±90° clamp, Buenos Aires's zenith against the local sidereal time, London's south pole on the ground side, Quito's horizon through both poles, the count and the list for a fixed place and instant, the surface's step at three instants of one evening, the opening view north and south of the equator).
  - **Touches outside the lane:** none.
  - **Out of scope:** any DOM, renderer or component (R169); `starLabels.ts` (R168); any page (R170); the physics, the worker and the fixtures (FR-GLOBE-17: unchanged).
  - **Done when:**
    - `globe/projection.test.ts` and `globe/scene.test.ts` pass with the cases above; the golden fixtures pass unchanged.
    - Nothing imports `skychart/globe/` yet, and `npm run check:dead` passes with the new modules (an allow-list entry or test-only use as the repo's rule has it, written in the Done note).
    - `npm test`, lint, typecheck and `npx vitest run tests/docs` green.
  - **Done note (R167):** `check:dead` passes by test-only use — knip counts the tests as entries, so no allow-list entry; `GlobeBody` stays unexported. A `constants.test.ts` holds §4.55's table. `BODIES_EVERY_MS` is re-exported from `lib/playback.ts`; `unproject` added beside `dragTurn` (D-1044); planets by `skyStars.ts`'s calls, not `starsAt` (D-1045).

- [x] **R168 — The labels' two options: `starLabels.ts`'s `fixed` bodies and `figureStart: 'vertex'`, off by default, with the globe's cases; the window's and the polar chart's placement and snapshots unchanged**
  - **Lane:** window
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); SPEC FR-GLOBE-11, FR-STAR-7, FR-STAR-14; PLAN D-1041; `src/ui/components/guide/skychart/window/starLabels.{ts,test.ts}`; `src/ui/components/guide/skychart/window/SkyWindow.labels.test.tsx` and `window/__snapshots__` (read only, to prove nothing moved).
  - **Goal:** the label placer the window and the polar chart share can place the globe's labels: the Sun's, the Moon's and the planets' labels are given as fixed and never dropped, and a figure's name can start its walk at a vertex of its drawn lines rather than the centroid, so a figure half behind the rim still names itself on its visible side; with neither option the placement is exactly 2.11.0's.
  - **Satisfies:** FR-GLOBE-11 (the placer's half).
  - **Scope (PLAN D-1041):** `placeLabels(input, options?)` with `fixed?: readonly FixedLabel[]` (placed after the compass at the first free of right, left, above and below, never dropped) and `figureStart?: 'centroid' | 'vertex'` (`'centroid'` by default; `'vertex'` takes the vertex the caller passes, which R167's `figureAnchor` will compute); `FixedLabel` exported; `starLabels.test.ts` gains the globe's cases (a fixed label kept where a star's would be dropped, its first-free order, a vertex start, the default unchanged).
  - **Touches outside the lane:** none.
  - **Out of scope:** any caller passing the options (R169); the globe's geometry (R167).
  - **Done when:**
    - `starLabels.test.ts` passes with the new cases; `SkyWindow.labels.test.tsx` and every existing snapshot pass unchanged (no `-u`).
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run check:dead` green.

### Wave 2

- [x] **R169 — The renderer and the hand: `GlobeRenderer` and `SkyGlobe`, its stylesheet on the sheet's tokens, the renderer's and the component's tests; nothing mounted on a page**
  - **Lane:** chart
  - **Model:** fable
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R167, R168
  - **Reads:** the phase set (above); SPEC FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-4, FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-10, FR-GLOBE-11, FR-GLOBE-13, FR-GLOBE-14, FR-GLOBE-15, FR-LOOK-7, FR-DS-2; PLAN D-744, D-751, D-817, D-1034, D-1038, D-1041; the spike's `renderer.ts`, `main.tsx` and `capture.ts` (`git show spike-stars-desktop:spike/stars-desktop/<file>`); `src/ui/components/guide/skychart/globe/**` (R167's); `src/ui/components/guide/skychart/window/{starLabels,starGlyphs,skySurface,MoonDisc,SkyWindow}.*` (read only, the method and the imports); `src/data/stars/deepChunk.ts`; `docs/DESIGN.md` (the chart tokens).
  - **Goal:** a `<SkyGlobe>` that, given a place, an instant, a turn mode, the layers and the faint toggle, draws the spike's globe the app's way — one SVG built once, moved by ref, the dots bucketed so the node count never changes, the far side gone, the ground side dimmed not cut, the sky side tinted by the Sun — turns under a drag, zooms on the wheel and the pinch, answers the keys, and names what is hovered or pressed on its readout line, ready for R170 to mount.
  - **Satisfies:** FR-GLOBE-4, FR-GLOBE-14; the drawing's and the hand's half of FR-GLOBE-2, FR-GLOBE-3, FR-GLOBE-5, FR-GLOBE-6, FR-GLOBE-10, FR-GLOBE-11, FR-GLOBE-13; FR-GLOBE-15's structure (the default export a page can `React.lazy`, no idle loop).
  - **Scope (PLAN D-1034, D-1038):** `globe/GlobeRenderer.ts` (the disc and the ground, the grid, the ecliptic and the Milky Way, one figure path per side, one `<text>` per star to `STAR_DOT_MAG` and per named star and figure, the Sun, the Moon by `MoonDisc`'s geometry, the planets, the compass, the zenith and the poles, the 40 dot paths; `set(state)` scheduling one `requestAnimationFrame`; the labels by `placeLabels` with R168's `fixed` and `figureStart: 'vertex'`; the deep stars appended to the buckets when `deepChunk.ts` resolves, no node created); `globe/SkyGlobe.tsx` as a default export (the box's measure, the pointer drag by `dragTurn`, the wheel and the pinch, the focusable box's keys, the frame switch by `coordsIn`, the naming on hover and press with the readout line, the props a page passes: place, instant, turn, layers, faint, language); `globe/SkyGlobe.module.css` with only the tokens FR-GLOBE-14 names and the opacities as attributes; `GlobeRenderer.test.ts` (jsdom: node count fixed across the faint toggle and ≤ `GLOBE_MAX_NODES`, a bucket's segments equal to its near-side stars, the dimmed stars present with the dimmed class, a frame's attributes, the deep stars' append) and `SkyGlobe.test.tsx` (the keys, the wheel's bounds, a drag, the label's naming, no frame without a change).
  - **Touches outside the lane:** none (`window/` files are imported, not edited).
  - **Out of scope:** the stars page, its rail, its strings and the second `usePlayback` (R170); `globe.spec.ts` and `globe-perf.spec.ts` (R170: the rate is asserted once the page mounts the globe, and a miss there is a follow-up to the renderer, §16.31); the captures (R171).
  - **Done when:**
    - `GlobeRenderer.test.ts` and `SkyGlobe.test.tsx` pass with the cases above; R167's and R168's tests still pass.
    - The Done note gives the node count at mount (faint off and on) and the frames per second of a local drag on a test harness or the spike's `capture.ts` method, against the spike's 76–86.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run check:dead` green (a page mounts `SkyGlobe` only in R170; the Done note names how `check:dead` holds until then).
  - **Done (2026-11-03, D-1047..D-1049):** 288 SVG nodes at mount, faint off and on alike (the deep chunk's 7 373 stars go into the 40 dot paths' member arrays; `GLOBE_MAX_NODES` is 400). Draw rate by the spike's method (`GlobeRenderer` alone, turned 0.6°/frame, best of three 5 s sweeps, Apple silicon, headless Chromium): 1280 × 800 faint off 76.6/s at 1× and 76.6/s at 4×, faint on 79.1/s and 59.3/s; 1920 × 1080 faint off 76.4/s and 73.3/s, faint on 78.5/s and 62.4/s; the ×3600 time-lapse at 4× 63.7–70.3/s — against the spike's 76–86 at 1×, and every case over FR-GLOBE-15's 30 at 4×. `check:dead` holds because the two test files import `SkyGlobe` and `GlobeRenderer` (knip's vitest plugin reads tests as entries) and the module-only helpers are not exported. The drawing's words are `chart.globe` in `i18n/{en,es}/chart.ts` (the chart lane's file, D-283), not a top-level `globe` section: the rail's words are R170's and may join or move them. One known limit: at the opening view about 8 of the 13 named stars on the near side get a name; the rest are dropped by D-755's rule (a figure line or a mark in the way), and zooming names them.

### Wave 3

- [x] **R170 — The stars page's globe: the wide view row `[ Window ] Globe`, the lazy chunk and its prefetch, the rail's `Time`, `Turn`, `Place` and layer groups with `faint`, the second `usePlayback`, the count and `Up from <place>`, the `globe` strings in both languages, the `globe` budget row, `globe.spec.ts`, `globe-perf.spec.ts`, the axe case**
  - **Lane:** ui
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Done (2026-11-03):** `globe-perf.spec.ts` at 4×: drag best of three 49.4 / 44.4 updates/s at 1280 × 800 and 47.5 / 43.1 at 1920 × 1080 (faint off / on), ×3600 58.5 / 48.7 and 55.9 / 43.1. Budgets: `globe` 13.4 of 15 (`SkyGlobe` 9.0 + `GlobeRail` 1.9 + `scene` 2.5), `main` 182.8 (+749 bytes over 2.11.0), `stars` 31.4 (+1.5 KB over 2.11.0). Differs from the text: the rail's groups are lazy with the globe and sit in the layout's scrolling list row (D-1050); the wide globe cases are `StarsGlobe.test.tsx`, beside `Stars.test.tsx`.
  - **Depends on:** R169
  - **Reads:** the phase set (above); SPEC FR-GLOBE-1, FR-GLOBE-7, FR-GLOBE-8, FR-GLOBE-9, FR-GLOBE-10, FR-GLOBE-12, FR-GLOBE-15, FR-GLOBE-16, FR-OFF-1, FR-OFF-7, FR-DESK-4, FR-TONIGHT-7, FR-CLEAN-13; PLAN D-178, D-817, D-1035, D-1039, D-1040, D-1042; `src/ui/screens/{Stars.tsx,Stars.module.css,Stars.test.tsx}`; `src/ui/screens/stars/**`; `src/ui/components/guide/skychart/globe/SkyGlobe.tsx` (R169's props, read only); `src/ui/components/live/usePlayback.ts` (read only); `src/data/stars/deepChunk.ts`; `src/i18n/{en,es}/starsPage.ts`; `src/i18n/messages.test.ts`; `scripts/bundle-budget.ts`; `tests/e2e/{stars-perf,axe}.spec.ts`; `tests/styles/controlRows.test.ts`.
  - **Goal:** on a desk the stars page's `View` row reads `[ Window ] Globe`; pressing `Globe` loads the globe's chunk and shows it in the window's box with the rail beside it, turning with you, its own clock, steps and time-lapse moving only it, the app's place and the saved places one press each and changing nothing else, the faint stars on a toggle, and the rail's count and `Up from <place>` following the shown place and instant; the phone's stars page is unchanged and never requests `SkyGlobe-*.js`.
  - **Satisfies:** FR-GLOBE-1, FR-GLOBE-7, FR-GLOBE-8, FR-GLOBE-9, FR-GLOBE-10, FR-GLOBE-12, FR-GLOBE-15, FR-GLOBE-16; US-50.
  - **Scope (PLAN D-1035, D-1039, D-1040, D-1042):** `Stars.tsx`'s view state `'window' | 'whole'`, `whole` drawing `SkyChart view="polar"` on compact and the lazy `<SkyGlobe>` on wide, the row's label by width, `v` cycling the two; the lazy import and the idle prefetch after the `stars` chunk on wide only; the rail's `Time` group (the clock in the place's zone, `[ now ]`, the four steps, the three speeds) on a second `usePlayback` that writes no hash, pref or store; the `Turn` group (with you / with the stars); the `Place` group (a vertical `ToggleGroup` of the observer and the `mostRecentlyUsed` favourites, local state only, falling back to the observer when its favourite goes); the layer row with `[ ] faint`, off every visit; the count line and `Up from <place>` memoised on `BODIES_EVERY_MS`; the `globe` section in `src/i18n/{en,es}/` with every word of §4.55; the `globe` row in `scripts/bundle-budget.ts`; `Stars.test.tsx`'s wide globe cases; `controlRows.test.ts` for the rail's rows in both languages; `tests/e2e/globe.spec.ts` (1280 × 800 and 1920 × 1080: the breakpoint crossing, a drag, the keys, the steps, ×3600 under a paused `page.clock`, a saved place, the Tab order, the hash unchanged, no `SkyGlobe-*.js` on compact) and `tests/e2e/globe-perf.spec.ts` (`stars-perf.spec.ts`'s 4× throttle, best of three drags and a ×3600 run, faint off and on, ≥ 30 updates/s); `axe.spec.ts` with the globe shown.
  - **Touches outside the lane:** `src/i18n/**`, `scripts/bundle-budget.ts` (the one row), `tests/e2e/{globe,globe-perf,axe}.spec.ts`, `tests/styles/controlRows.test.ts`.
  - **Out of scope:** the renderer's internals (R169; a rate miss in `globe-perf.spec.ts` is written as a finding for a renderer follow-up, not fixed by widening this lane, §16.31); the capture set and the release (R171); the live page and the pass detail (unchanged).
  - **Done when:**
    - `Stars.test.tsx`, `controlRows.test.ts` and `messages.test.ts` pass; `globe.spec.ts`, `globe-perf.spec.ts` and `axe.spec.ts` green in both languages; every compact stars e2e unchanged and green.
    - The Done note gives `globe-perf.spec.ts`'s rates per case and the budget rows (`globe` within `GLOBE_BUDGET_KB`, `main` within `GLOBE_MAIN_KB` of 2.11.0, `stars` within `GLOBE_STARS_KB`).
    - `npm test`, lint, typecheck, `npx vitest run tests/docs`, `npm run bundle:budget` and `npm run check:dead` green.

### Wave 4

- [x] **R171 — Captures and 2.12.0: the London favourite in the seeds, the five globe screens and `stars-whole` at 390 only, the capture set re-shot and diffed against 2.11.0, every budget row re-set, `package.json` 2.12.0, `docs/RELEASE.md` §25, no tag**
  - **Lane:** docs
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R170
  - **Reads:** the phase set (above); SPEC FR-GLOBE-15, FR-GLOBE-18, FR-CAP-5; PLAN D-178, D-1042; `docs/RELEASE.md` §24 (the shape §25 follows); `tests/e2e/{captureSet,captureSeeds}.ts`, `tests/e2e/v1-captures.spec.ts`; `tests/docs/captureIds.test.ts`; `scripts/bundle-budget.ts`; `package.json`.
  - **Goal:** the capture set shows the globe as it opens at 1280 and 1920, turning with the stars, with the faint stars, over a saved London and with a star named, and drops the wide `stars-whole`; every other capture is 2.11.0's but for the wide `stars` row's word; `main` reads 2.12.0 ready for the owner's desk run and tag.
  - **Satisfies:** FR-GLOBE-18; FR-GLOBE-15's release half (the rows re-set by D-178); §9 Phase 2u's release items.
  - **Scope (PLAN D-1042):** `captureSeeds.ts` gains a London favourite; `captureSet.ts` gains `stars-globe` (1280 × 800, 1920 × 1080), `stars-globe-stars` (1280), `stars-globe-faint` (1920), `stars-globe-place` (1280, London) and `stars-globe-named` (1280, the list's first row), and `stars-whole`'s widths become `[390]`; `captureIds.test.ts` updated; the set re-shot by `captures.yml` (two runs) and diffed against 2.11.0 by FR-CAP-5; every budget row re-set by D-178; `package.json` 2.12.0; `docs/RELEASE.md` §25 with the owner's desk run as a checklist (`[ Window ] Globe`, turning with you, the switch to the stars, a drag, the wheel, the keys, ×3600, a saved place, the faint stars, a star named; the phone's stars page unchanged).
  - **Touches outside the lane:** `tests/e2e/{captureSet,captureSeeds}.ts`, `tests/e2e/v1-captures.spec.ts`, `docs/screenshots/v1-*`, `scripts/bundle-budget.ts`, `package.json` (no source file under `src/`).
  - **Out of scope:** any behaviour change; the tag and the deploy.
  - **Done when:**
    - FR-CAP-5's diff against 2.11.0 lists only the wide `stars` row's word, the globe's additions and `stars-whole`'s 1280 removals; two runs agree but for F-99's noise.
    - `captureIds.test.ts`, `npm run bundle:budget`, `npm run check:dead` and `npx vitest run tests/docs` green.
    - The Done note lists the changed, added and removed files, the budget rows against 2.11.0, and "tag the squash merge of this PR".
  - **Done:** the set is 436 files (D-1052, D-1053). Added 24: `v1-stars-globe-{1280,1920}-*`, `v1-stars-globe-stars-1280-*`, `v1-stars-globe-faint-1920-*`, `v1-stars-globe-place-1280-*`, `v1-stars-globe-named-1280-*`. Changed 12, the view row's word alone: `v1-stars-{1280,1920}-*`, `v1-stars-zoom-1280-*`. Removed 4: `v1-stars-whole-1280-*`. Against 2.11.0, both shot on one Mac (headless, no `captures.yml` dispatch): 379 identical, the 12 moved and 21 of F-99's noise; two branch runs 20 apart, all F-99. Budget rows against 2.11.0 (`8413d978`): main 182.0 → 182.8 (+762 bytes), stars 29.9 → 31.4 (+1,536, GLOBE_STARS_KB exactly), live 14.7 → 13.7, window 13.2 → 13.0, globe 13.5 new into `BUDGETS` at 15; no budget moves. `captureIds.test.ts` needed no change (it reads the specs). Fixed in review: a list row's naming now reaches the globe (FR-GLOBE-12, `SkyGlobe`'s `named`), `v1-stars-globe-named-1280-*` re-shot. Tag the squash merge of this PR.

### Requirement coverage (v2.12)

| Requirement | Task |
|---|---|
| FR-GLOBE-1 | R170 |
| FR-GLOBE-2 | R167 (the geometry), R169 |
| FR-GLOBE-3 | R167 (the geometry), R169 |
| FR-GLOBE-4 | R169 |
| FR-GLOBE-5 | R167 (the frames), R169 |
| FR-GLOBE-6 | R167 (`dragTurn`), R169 |
| FR-GLOBE-7 | R170 |
| FR-GLOBE-8 | R170 |
| FR-GLOBE-9 | R170 |
| FR-GLOBE-10 | R169 (the buckets), R170 (the toggle) |
| FR-GLOBE-11 | R168 (the placer), R169 |
| FR-GLOBE-12 | R167 (the functions), R170 |
| FR-GLOBE-13 | R167 (`surfaceAt`), R169 |
| FR-GLOBE-14 | R169 |
| FR-GLOBE-15 | R169 (the chunk's shape), R170, R171 (the rows re-set) |
| FR-GLOBE-16 | R170 |
| FR-GLOBE-17 | R167 |
| FR-GLOBE-18 | R171 |
| US-50 | R170 |

Waves (for the sanity check): **wave 1** R167 (chart) + R168 (window) — **wave 2** R169 (chart) — **wave 3** R170 (ui) — **wave 4** R171 (docs). R167 and R168 name no file in common (`skychart/globe/` against `window/starLabels.*`); every later wave holds one task. Wave 2 holds the phase's one `fable` task alone (D-1043).
