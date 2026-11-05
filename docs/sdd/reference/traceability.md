## 12. Requirement Traceability

| Requirement | Module(s) |
|---|---|
| FR-LOC-1/2/6 | `ui/components/location`, `data/openMeteo/geocode.ts` |
| FR-LOC-3 | `lib/timeFormat.ts`, `Observer.timeZone` from geocode/forecast (D-3) |
| FR-LOC-5 | `data/localPrefs.ts` |
| FR-SAT-1/5 | `data/catalog/catalog.json`, `schema.ts`, `scripts/check-catalog.ts` |
| FR-SAT-2/3/6 | `data/celestrak.ts`, `data/elementsCache.ts`, `data/elementsLoader.ts` (D-9, D-10) |
| FR-SAT-4 | `SatelliteRecord.epochMs`, `ui/components/common/Banner.tsx` |
| §4.3 rules, FR-VIS-1/2/3/6/7 | `physics/*`, `physics/constants.ts` (D-1, D-7, D-8) |
| FR-VIS-4 | `worker/*`, perf budget test |
| FR-VIS-5 | `state/effects.ts`, `workerClient.ts` (`computeNow` every 10 s; recompute on change) (D-14) |
| FR-GUIDE-1/3 | `lib/phrases.ts`, `lib/compass.ts`, `ui/components/guide/GuideText.tsx` |
| FR-GUIDE-2 (3D dome, rotate/tilt, default facing) | `ui/components/guide/skychart/dome/*` (glyphcss), `lib/skyGeometry.ts`, `Pass.track` (D-16, D-17, §8) |
| FR-GUIDE-2b (2D polar fallback, same data) | `ui/components/guide/skychart/polar/SkyPolar.tsx`, `SkyChart.tsx` toggle, `lib/skyGeometry.ts` (R13) |
| FR-GUIDE-4 (polar orientation toggle; dome facing readout) | `SkyPolar.tsx`, `SkyDome.tsx` facing text (§8.4) |
| FR-GUIDE-5 (DOM only, no WebGL/canvas) | glyphcss renders one `<pre>`; polar view is SVG; lint rule forbids `canvas`/`webgl` imports; e2e asserts no `<canvas>` in the document |
| FR-GUIDE-6 (interactive performance) | §8.5 spike item 3; release checklist (§9.1) |
| FR-GUIDE-7 (text alternative, grid hidden from AT) | `SkyChart.tsx` `<figure>`/`<figcaption>`, `aria-hidden` grid; `jest-axe` in the contract test (R13) |
| FR-WX-1/5 | `data/openMeteo/forecast.ts`, `data/weatherCache.ts` |
| FR-WX-2/3/4 | `lib/cloudVerdict.ts`, `ui/components/weather/CloudBadge.tsx`, `NowPanel.tsx` |
| FR-X-1 | `ui/styles/tokens.css` (D-5) |
| FR-X-6 (monospace / terminal identity) | `ui/styles/tokens.css` `--font-mono`, `--cell` grid unit (D-5); global styles; visual review in the spike |
| FR-X-2 | `ui/components/common/Footer.tsx` |
| FR-X-4 | IndexedDB cache + in-memory fallback; e2e offline test |
| FR-X-5 | component tests with `jest-axe`; chart text duplication in `PassNumbers.tsx` |
| Spec §5.6 clock skew | **Not in MVP** (D-11) |
| **v1** — FR-I18N-1..6 | `src/i18n/*` (D-69), `lib/timeFormat.ts`, `lib/phrases.ts` (returns keys, not sentences), `ui/components/common/LanguageToggle.tsx`, `main.tsx` (D-70) |
| FR-DESK-1..4 | `ui/styles/global.css` + `ui/App.module.css` + `tests/styles` (D-71), `lib/layout.ts` + `ui/hooks/useLayoutMode.ts` (D-116), `ui/App.tsx`, `ui/components/guide/GuidePanel.tsx` (D-72, D-117, D-118, D-119), `ui/components/common/Footer.tsx` (D-120), `lib/shortcuts.ts` + `ui/hooks/useShortcuts.ts` + `ui/components/common/ShortcutsOverlay.tsx` + `ui/components/passes/passCursor.ts` (D-73, D-163..167) |
| FR-DESK-5 | `docs/mockups/` (the owner-approved reference), `visual-review` captures at 1280 px |
| FR-DOME-1..7 | `dome/camera.ts` (`layoutFor` from width and height), `dome/palette.ts`, `dome/domeGeometry.ts`, `dome/domeLayers.ts`, `dome/SkyDome.tsx`, `skychart/bodies.ts` + `skychart/useSkyBodies.ts` + `lib/skyBodies.ts` (FR-DOME-5/6, D-148..D-151), `lib/skyGeometry.ts` (`splitArcAt`, D-150), `polar/SkyPolar.tsx` + `SkyPolar.module.css` (same markers and palette, D-152) — §8.7 |
| FR-DOME-8 | `spike/dome-composition/` and `docs/dome-composition/` first; then `dome/domeLayers.ts` + the two scenes in `SkyDome.tsx` (D-74) |
| FR-LIVE-1..10 | `ui/screens/Live.tsx`, `ui/components/live/*`, `state/slices/live.ts`, `lib/skyBodies.ts`, `lib/shareLinks.ts`, `worker` `computeNow { includeHidden }` (D-76, D-81, D-82) |
| FR-OFF-1, FR-OFF-6 | `vite.config.ts` (`vite-plugin-pwa`, D-79), `state/serviceWorker.ts` + `state/slices/appUpdate.ts` (D-126), `public/manifest.webmanifest` + `scripts/build-mark.ts` (D-127, D-440), `ui/components/common/UpdateBanner.tsx`, `InstallHint.tsx`, `lib/installSnooze.ts` + `data/localPrefs.ts` (D-272), `common/InstallAction.tsx` + `screens/Settings.tsx` (D-260) |
| FR-OFF-2, FR-OFF-5 | `data/passesCache.ts` (D-78), `state/slices/passes.ts`, `state/passWindow.ts` (72 h, D-77) |
| FR-OFF-3 | `data/openMeteo/forecast.ts` (`forecast_days=4`), `data/weatherCache.ts` |
| FR-OFF-4 | `lib/readiness.ts`, `ui/components/common/ReadinessLine.tsx` |
| FR-OFF-7 | `data/favourites.ts` + `data/localPrefs.ts` (D-85, D-138), `state/slices/prefs.ts` (D-139), `ui/components/location/*` |
| FR-OFF-8 | `state/effects.ts` failure paths, `data/*` catch branches, existing banners |
| FR-MOON-1..3 | `physics/moon.ts` (D-80), `physics/constants.ts`, `NowState.moon`, `Pass.moonAtPeak`, `lib/moonPhrases.ts`, `ui/components/moon/MoonLine.tsx` (D-122), `ui/components/moon/MoonGlare.tsx` (D-125) |
| FR-MOON-4/5 | `data/moon/lore.json` + `schema.ts`, `lib/moonPhrases.ts` (D-121, D-123, D-124), `state/index.ts` (the lookups the UI reads, D-97), `ui/components/moon/MoonLore.tsx` |
| FR-SHARE-1..3 | `lib/shareLinks.ts` (D-83), `ui/components/common/ShareButton.tsx`, `screens/passSelection.ts` |
| FR-THEME-1..3 | `ui/styles/tokens.css` `[data-theme="night"]` (D-84, D-100), `ui/styles/theme.ts` + `global.css` `html[data-theme]` (D-99), `main.tsx` (D-70), `ui/components/common/ThemeToggle.tsx`, `model/prefs.ts`, `scripts/contrast.ts`, `dome/palette.ts` |
| FR-VIS-1 / FR-WX-1 amended (72 h) | `state/passWindow.ts`, `worker/handlers.ts` (D-77), `data/openMeteo/forecast.ts` |
| FR-GUIDE-5 amended (CSP) | `public/_headers`, `tests/deploy` (D-75) |
| FR-X-4 amended (shell offline) | `vite-plugin-pwa` (D-79), `data/passesCache.ts` (D-78) |
| Spec §5.7 `computeAt` | **Not needed** — `computeNow` already takes an instant (D-76); see §15 |
| **v1.1** — FR-FLAG-1..2 | `lib/flags.ts`, `vite.config.ts`, `ui/App.tsx` lazy branch, `tests/build/flags.test.ts` (D-183) |
| FR-COMP-1..3 | `ui/components/common/Header.tsx`, `LocationSummary.tsx`, `ui/screens/Settings.tsx`, `screens/passSelection.ts` (D-184) |
| FR-COMP-4 | `tests/styles/controlRows.test.ts`, `SortToggle.tsx` short labels (D-193) |
| FR-COMP-5 | `skychart/ChartFrame.tsx`, `dome/camera.ts` fit rule (D-187) |
| FR-COMP-6 | `docs/mockups/compact-390.html` + PNGs, `scripts/mockup-capture.ts` (D-191) |
| FR-LEG-1..5 | `lib/legend.ts`, `skychart/Legend.tsx`, `SkyChart.types.ts` `legendKeys`, the three views' label code, `guide/PassNumbers.tsx` (D-186) |
| FR-WIN-1..6 | `skychart/window/*`, `SkyChart.tsx` registration, `state/slices/prefs.ts` `chartView`, `ui/screens/Live.tsx` `windowMode` (D-188) |
| FR-WIN-7 | `spike/window/`, `docs/window/FINDINGS.md` (§8.10) |
| FR-TRAJ-1..3 | `lib/arcReveal.ts`, `physics/constants.ts`, `SkyChartProps.passes[].arc`, the three views (D-189) |
| FR-TRAJ-4..5 | `components/live/TimeStripe.tsx`, `TimeReadout.tsx`, the stepping control, `usePlayback.ts` (D-190) |
| FR-FIX-1..2 | one findings task per lane; `F-<n>` commit prefixes and test names (D-194) |
| FR-CI-1..3 | `.github/workflows/ci.yml`, `captures.yml`, `tests/e2e/v1-captures.spec.ts` gate, `playwright.config.ts` workers, `e2e/liveHelpers.ts` `seedStoredRun` (D-195) |
| FR-DESK-2 amended | `Header.tsx` wide row (D-184) |
| FR-DESK-3 / FR-DESK-5 amended | `lib/layout.ts` `WIDE_SPLIT_MIN_CELLS`, `App.module.css`, `GuidePanel.tsx` `[ list ]`, `playwright.config.ts` `desktop-1024` (D-192) |
| FR-WIN-3 / FR-LIVE-8 amended (true north) | `lib/declination.ts`, `components/live/compassHeading.ts`, `StatusStrip.tsx` (D-185) |
| FR-DOME-1 amended (fill) | `dome/camera.ts` (D-187) |
| FR-LIVE-7 / FR-LEG-2 / FR-TRAJ-4 amended (the rail and the cut box, v1.2.1) | `screens/Live.tsx` and `Live.module.css` (the rail, the time row), `skychart/ChartFrame.tsx` + module (the measurement), `SkyChart.types.ts` `aside`, `stripe`, `boxAspect` and `stacked`, `dome/camera.ts` `DOME_BOX_ASPECT`, `lib/layout.ts` `fitBox` and `LIVE_TWO_COLUMN_MIN_PX`, `hooks/useMediaQuery.ts`, `lib/timeStripe.ts` (`labelEveryHours`, `keepLabels`); `tests/e2e/live-rail.spec.ts` (D-312..D-315, D-318, D-319, D-320); F-59 |
| FR-DOME-1 amended (after a resize, v1.2.1) | `dome/SkyDome.tsx` layer keys, `tests/e2e/dome-resize.spec.ts` (D-316); F-60 |
| FR-DOME-1 amended (the silhouette and the centring, v1.2.1) | `dome/camera.ts` `drawingExtent`, `ZOOM_HEIGHT_DIVISOR`, `DRAWING_HEIGHT_UNITS`, `centerShiftUnits`, `layerCenter`; `dome/SkyDome.tsx` `center`; `camera.test.ts` (D-317); F-61 |
| FR-DOME-1 amended (ceiling, v1.1.1) | `dome/camera.ts` upper bound and its test (D-268); F-51 |
| FR-LIVE-7 amended (wide, v1.1.1) | `screens/Live.module.css` wide grid, `screens/Live.tsx` row order (D-268); F-52 |
| F-53 (v1.1.1) | `skychart/Legend.module.css`, `skychart/Legend.tsx` scroll-into-view (D-268) |
| FR-DOME-4 / FR-DOME-6 / FR-LIVE-6 amended (labels to the legend) | `dome/domeGeometry.ts` hotspots, `polar/SkyPolar.tsx` labels, `lib/legend.ts` (D-186) |
| FR-LIVE-2 / FR-LIVE-4 / FR-LIVE-7 amended | `Live.tsx`, `Live.module.css`, `arcReveal.ts`, `TimeStripe.tsx` (D-189, D-190, D-187) |
| FR-MOON-4 amended | `App.tsx` behind `MOON_LORE` (D-183) |
| FR-FOL-1..3 (v1.2) | `screens/Live.tsx`, `components/live/FollowPhone.tsx`, `useFollowPhone.ts`, `state/slices/prefs.ts` `viewOverride` (D-276, D-277) |
| FR-FOL-4/5 (v1.2) | `skychart/window/projection.ts` `groundState`, `SkyWindow.tsx`, `SkyWindow.module.css`, `i18n/{en,es}/window.ts` (D-278) |
| FR-LIVE-8 amended (v1.2) | `useFollowPhone.ts` (heading path removed), `StatusStrip.tsx` declination on window mode (D-276) |
| FR-WIN-4 / FR-WIN-5 amended (v1.2) | `window/orientationAccess.ts` request from the control, `state/slices/prefs.ts` `savedChartView` (D-277) |
| FR-DOME-1 amended (ceiling at every size, v1.2) | `dome/camera.ts` `layoutFor` cell growth, `zoomWithinRaster`, `fitLayout`'s column count and `fitLayers`' one zoom, `camera.test.ts` size table, `tests/e2e/dome-fit.spec.ts` (D-279, D-290..D-294); F-54 |
| FR-LIVE-7 amended (compact spacing, v1.2) | `screens/Live.module.css` `--live-row-gap`, `tests/e2e/live-compact.spec.ts` (D-281); F-55 |
| FR-LIVE-11 (v1.2) | `state/index.ts` observer guard, `state/slices/*` stored run, `tests/e2e/live-reload.spec.ts` (D-280); F-56 |
| FR-FSC-1/2 (v1.3) | `components/live/FollowScreen.tsx` + module, `screens/Live.tsx` (the switch, `Esc`, the inert header, focus back to the control), `components/live/useFollowPhone.ts` `useFollowing`, `components/live/FollowPhone.tsx` `buttonRef`, `skychart/ChartFrame.tsx` `SCREEN_STATUS_ID`, `skychart/SkyChart.tsx` (the window fallback forwards `screen` and `overlay`), `skychart/window/SkyWindow.tsx` (`overlay` to the frame), `styles/tokens.css` `--z-follow`, `i18n/{en,es}/live.ts` `followClose` (D-321, D-338, D-339, D-340) |
| FR-FSC-3 / FR-LEG-2 amended (v1.3) | `skychart/SkyChart.tsx` `screen`, `skychart/ChartFrame.tsx` + module (overlay slots, `--follow-overlay`), `skychart/Legend.tsx` compact rows on screen, `styles/tokens.css` `FOLLOW_OVERLAY_ALPHA` (D-322) |
| FR-FSC-4 (v1.3) | `skychart/window/SkyWindow.tsx` + module (the `portrait` state, and `screen` passed on to the frame), `hooks/useMediaQuery.ts`, `i18n/{en,es}/window.ts` `portrait`, `tests/support/matchMedia.ts` (the orientation query), `spike/window/screen.tsx` + `screen-capture.ts` (the captures) (D-323, D-333, D-334, D-335) |
| FR-FSC-5 / FR-LIVE-6 amended (v1.3) | `screens/Live.tsx` `useHiddenObjects` guard (D-325) |
| FR-FSC-6 / FR-WIN-4, FR-WIN-5 amended (v1.3) | `skychart/SkyChart.tsx` `views` and `offeredViews`, `screens/Live.tsx` passes `['dome', 'polar']` (D-324) |
| FR-FSC-7 (v1.3) | `tests/e2e/follow-screen.spec.ts`, `tests/e2e/captureSet.ts` (four screens), `tests/e2e/v1-captures.spec.ts`, `tests/docs/captures.test.ts` (the no-1280 exception), `docs/screenshots/v1-follow-screen-*` (D-326, D-342) |
| FR-FOL-1 / FR-FOL-3 / FR-LIVE-7 / FR-LIVE-8 / FR-WIN-6 amended (v1.3) | `screens/Live.tsx` (the grid replaced by the layer while following), `FollowScreen.tsx` (D-321) |
| FR-FSC-1/2 re-pointed, FR-FSC-6 rewritten (v1.3.1) | `components/screen/SkyScreen.tsx` + module, `components/screen/useSkyScreen.ts`, `skychart/SkyChart.tsx` (the three-option control and its notes), `screens/Live.tsx`, `screens/PassDetail.tsx`, `state/slices/prefs.ts` `skyScreen` (D-350, D-351) |
| FR-WIN-5 amended, FR-FOL-1/2 withdrawn (v1.3.1) | `state/slices/prefs.ts` `savedChartView` narrowed and migrated, `skychart/SkyChart.tsx` (the gate removed), deleted `components/live/FollowPhone.tsx` + `useFollowPhone.ts` + `live.follow*` copy (D-350, D-352) |
| FR-FSC-8 / FR-WIN-6, FR-FOL-3 amended (v1.3.1) | `screens/Live.tsx` (the `now` effect deleted, `now={shown}` to the screen), `components/live/usePlayback.ts` unchanged (D-353) |
| FR-FSC-9 (v1.3.1) | `components/screen/SkyScreen.module.css` (`100dvh`, `overscroll-behavior`), `screens/PassDetail.tsx` + module (the sheet held still, the scroll restored) (D-354) |
| FR-COMP-5 / FR-LIVE-7 amended (v1.3.1) | `screens/Live.module.css` `--page-pad-x: 0` in the landscape block, `skychart/ChartFrame.module.css` (the rule it reads), `tests/e2e/live-landscape.spec.ts` (D-355); F-63 |
| FR-FSC-7 re-pointed (v1.3.1) | `tests/e2e/sky-screen.spec.ts`, `tests/e2e/captureSet.ts`, `tests/e2e/v1-captures.spec.ts`, `tests/docs/captures.test.ts`, `docs/screenshots/sky-screen-*` (D-356) |
| FR-PUB-1, FR-PUB-4 (v1.3.2) | `README.md` (D-369) |
| FR-PUB-2, FR-PUB-11 (v1.3.2) | `scripts/readme-hero.ts`, `docs/readme/hero.png`, `docs/readme/social-preview.png`, `docs/RELEASE.md` (D-370) |
| FR-PUB-3, FR-PUB-10 (v1.3.2) | `docs/HOW-THIS-WAS-BUILT.md`, `CONTRIBUTING.md` |
| FR-PUB-5 (v1.3.2) | `scripts/third-party-notices.ts`, `public/third-party-notices.txt` (D-371) |
| FR-PUB-6 (v1.3.2) | `LICENSE`, `package.json` |
| FR-PUB-7 (v1.3.2) | `docs/spike-glyphcss/measurements.json`, `docs/spike-glyphcss/FINDINGS.md` (D-372, D-373) |
| FR-PUB-1..11 verification (v1.3.2) | `tests/docs/public.test.ts` (D-368) |
| FR-PUB-12, FR-PUB-13 (v1.3.3) | `scripts/check-trailers.ts`, `scripts/prune-merged-branches.ts`, `tests/docs/trailers.test.ts`, `.github/workflows/ci.yml` (D-376, D-377) |
| FR-PUB-1 amended (v1.3.3) | `README.md`, `docs/DEPLOY.md` (D-378) |
| FR-SHOW-1, FR-SHOW-2 (v2.2) | `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/HOW-THIS-WAS-BUILT.md`, `docs/DEPLOY.md`, `docs/RELEASE.md`, `.claude/skills/*/SKILL.md`, this plan's §4 tree; `tests/docs/accuracy.test.ts` (D-650) |
| FR-SHOW-3 (v2.2) | `.gitignore`, `docs/HOW-THIS-WAS-BUILT.md`, `tests/docs/hygiene.test.ts`, `tests/docs/public.test.ts` (D-651) |
| FR-SHOW-4, FR-SHOW-5 (v2.2) | `knip.json`, `package.json` (`check:dead`), `.github/workflows/ci.yml` (`dead-code`), every file the audit names under `src/`, `scripts/`, `tests/` (D-647..D-649) |
| FR-ADDR-1..4 (v2.2) | `wrangler.jsonc`, `README.md`, `docs/DEPLOY.md`, `docs/RELEASE.md`, `tests/docs/public.test.ts`, `tests/deploy/`, `scripts/readme-hero.ts`, `docs/readme/*.png` (D-658) |
| FR-SHOW-8 / FR-X-2 amended (v2.2) | `ui/components/common/Footer.tsx`, `i18n/en/ui.ts`, `i18n/es/ui.ts`, `Footer.test.tsx`, `tests/styles/controlRows.test.ts`, the footer's `v1-*` captures, `README.md` (D-657) |
| FR-SHOW-6, FR-SHOW-7 (v2.2) | `playwright.config.ts` (`promo` project), `tests/e2e/promo-record.spec.ts`, `package.json` (`promo:record`), `tests/docs/promo.test.ts` (D-652..D-654) |
| FR-SHOW-9, FR-SHOW-6 amended (v2.2.1) | `tests/e2e/observers.ts` (`BARILOCHE`, `SHOWCASE_NIGHT`, `SHOWCASE_UNTIL`), `tests/e2e/liveHelpers.ts` (`stubNetwork`'s `weather`), `tests/fixtures/open-meteo/2026-09-06-bariloche-*.json`, `tests/fixtures/stored-run-bariloche.json`, `scripts/build-stored-run.ts`, `tests/e2e/promo-record.spec.ts`, `tests/e2e/promoFlows.ts`, `tests/docs/showcase.test.ts`, `tests/docs/promo.test.ts` (D-682, D-683, D-685, D-686) |
| FR-SHOW-10, FR-SHOW-7 amended (v2.2.1) | `tests/e2e/captureSeeds.ts`, `tests/e2e/v1-captures.spec.ts`, `tests/e2e/captureSet.ts` (`what` lines), `docs/screenshots/v1-*.png`, `docs/readme/hero.png`, `docs/readme/social-preview.png`, `tests/docs/showcase.test.ts` (D-684, D-685) |
| FR-SHP-1, FR-SHP-2 *(v1.4)* | `screens/Live.module.css` (the landscape block, mode-scoped), `tests/styles/liveShape.test.ts` (D-379); F-65 |
| FR-SHP-3 *(v1.4)* | `lib/layout.ts` `LIVE_BOX_MIN_PX`, `foldRows`; `screens/Live.tsx`, `screens/Live.module.css` (D-381, D-389) |
| FR-SHP-4, FR-SHP-5 *(v1.4)* | `tests/e2e/shapes.spec.ts`, `docs/screenshots/` (D-380) |
| FR-SPAN-1, FR-SPAN-5 *(v1.4)* | `lib/timeStripe.ts` `chunkFor`, `STRIPE_CHUNK_H`; `components/live/TimeStripe.tsx` (D-382) |
| FR-SPAN-2 *(v1.4)* | `components/live/StripeOverview.tsx` + `.module.css`, `lib/timeStripe.ts` (D-383) |
| FR-SPAN-3, FR-SPAN-4 *(v1.4)* | `components/live/StepControls.tsx`, `screens/Live.tsx` (the `touch` guard removed), `i18n/{en,es}/live.ts`, `tests/styles/controlRows.test.ts` (D-384) |
| FR-SPAN-6 *(v1.4)* | `lib/timeStripe.ts` `drawnSpan`, `CHUNK_MIN_WALL_S` (D-385) |
| FR-SPAN-7 *(v1.4)* | `components/live/TimeStripe.tsx` (the cadence on the chunk's width), `lib/timeStripe.ts` `keepLabels` |
| FR-LEG-6 *(v1.4)* | `screens/Live.tsx` (`columns` deleted), `screens/Live.module.css`, `lib/layout.ts` (`LIVE_TWO_COLUMN_MIN_PX` deleted) (D-386) |
| FR-LEG-7, FR-LEG-8, FR-LEG-9 *(v1.4)* | `screens/Live.tsx` (`[ list (n) ]`), `skychart/ChartFrame.tsx` + `.module.css` (the slot at two `--tap` rows), `skychart/Legend.tsx` (the empty line), `model/prefs.ts` and `state/slices/prefs.ts` (`liveLegendOpen`), `lib/legend.ts` (the count) (D-387, D-388) |
| FR-FSC-4 rewritten, FR-FSC-11 *(v1.4.1)* | `skychart/window/SkyWindow.tsx` + module (the `portrait` veil deleted, the ground states unguarded, the advice line, `data-orientation` from the measured box), `i18n/{en,es}/window.ts` `turnAdvice` (`portrait` deleted), `components/screen/SkyScreen.tsx` (the `aria-labelledby` branch deleted) (D-427, D-428) |
| FR-FSC-10 *(v1.4.1)* | `skychart/window/screenTurn.ts` `quarterTurnFor`, `SCREEN_TURN_FLAT_DEG`, `SCREEN_TURN_HYSTERESIS_DEG`; `skychart/window/projection.ts` (`View.screenAngleDeg` composed); `components/screen/screenTurn.tsx` (the context), `components/screen/SkyScreen.tsx` + module (the transform, the swapped box, `data-turn`) (D-424, D-425, D-426, D-429) |
| FR-FSC-7 re-pointed *(v1.4.1)* | `tests/e2e/sky-screen.spec.ts`, `tests/e2e/liveHelpers.ts` (`pose`), `tests/e2e/captureSet.ts`, `tests/docs/captures.test.ts`, `docs/screenshots/`, `spike/window/screen-capture.ts` (D-430) |
| **v2.0** — FR-FIRST-1, FR-FIRST-2 | `ui/screens/Home.tsx`, `ui/components/location/*` (unchanged, re-composed), `ui/components/mark/Mark.tsx`, `i18n/{en,es}/ui.ts` (D-443) |
| FR-FIRST-3 | `lib/nextEvent.ts`, `ui/components/passes/NextEventBlock.tsx`, `lib/format.ts` `formatClockDuration` `lib/passPath.ts` (D-442, D-502, D-507, D-508) |
| FR-FIRST-4, FR-FIRST-6 | `ui/screens/Home.tsx`, `ui/screens/home/WhenStep.tsx`, `ui/screens/home/WhatStep.tsx`, `lib/moonNote.ts`, `ui/App.module.css` (D-443, D-513) |
| FR-FIRST-5 | `lib/layout.ts` `HOME_THREE_PANE_MIN_CELLS` + its pixel twin, `ui/App.module.css`, `ui/components/guide/GuidePanel.tsx` (`data-guide="pane"`), `tests/styles/breakpoint.test.ts` (D-443, D-444) |
| FR-FIRST-8 | `lib/tonightStripe.ts`, `ui/components/now/TonightStripe.tsx`, `ui/components/live/useSkyBands.ts` (D-506) |
| FR-FIRST-9 | `ui/components/now/ConditionsTable.tsx` (D-509) |
| FR-FIRST-10 | `ui/components/passes/PassCard.tsx`, `ui/components/passes/PassList.tsx`, `ui/components/passes/nightGroups.ts` (D-510) |
| FR-FIRST-11 | `ui/components/location/WherePlace.tsx`, `ui/components/elements/ElementsLine.tsx`, `ui/components/common/ReadinessLine.tsx`, `ui/components/location/Favourites.tsx`, `ui/components/location/WhereDome.tsx` (D-511, D-512) |
| FR-FIRST-7, FR-MARK-8, FR-WATCH-9, FR-GUT-8, FR-SET-4 | `docs/screenshots/`, `tests/e2e/captureSet.ts`, `tests/docs/captures.test.ts` |
| FR-MARK-1, FR-MARK-2, FR-MARK-6 | `spike/mark/` (the scene), `scripts/build-mark.ts`, `src/ui/components/mark/rasters.json`, `tests/build/mark-rasters.test.ts`, `tests/build/mark-icons.test.ts` (D-438, D-458, D-459) |
| FR-MARK-3, FR-MARK-5 | `ui/components/mark/Mark.tsx` + `Mark.module.css`, `ui/components/mark/useBead.ts`, `ui/styles/tokens.css` (read, unchanged) (D-439) |
| FR-MARK-4 | `ui/components/common/Header.tsx` + `Header.module.css` (both rows, the tagline's padding), `ui/screens/Home.tsx` (the hero), `public/icon-192.png`, `public/icon-512.png`, `public/favicon.png`, `index.html`, `scripts/readme-hero.ts` (the lockup) (D-440, D-441) |
| FR-MARK-7 / FR-X-6, FR-OFF-6 amended | `public/manifest.webmanifest` (unchanged bytes), `tests/deploy/manifest.test.ts`, `scripts/build-icons.ts` deleted (D-440) |
| FR-WATCH-1, FR-WATCH-2 | `ui/screens/Live.tsx`, `state/slices/live.ts` (read, unchanged), `ui/components/passes/NextEventBlock.tsx`, `ui/components/mark/Mark.tsx`, `i18n/{en,es}/live.ts` (D-446) |
| FR-WATCH-3 | `ui/components/live/StatusStrip.tsx` + module, `tests/styles/controlRows.test.ts` (FR-MOON-3 amended) |
| FR-WATCH-4, FR-WATCH-7 | `ui/screens/liveRows.ts`, `ui/screens/Live.tsx`, `ui/screens/Live.module.css` (D-447) |
| FR-WATCH-5, FR-WATCH-6 | `lib/layout.ts` `scrubPlacement`, `LIVE_KEPT_ROWS_PX` re-derived, `ui/screens/Live.module.css`, `skychart/ChartFrame.tsx` + module (the `bottomOverlay` slot) (D-448, D-449) |
| FR-WATCH-8 | `i18n/{en,es}/live.ts`, `i18n/{en,es}/ui.ts` |
| FR-GUT-1..FR-GUT-6 | `skychart/window/gutter.ts`, `skychart/window/CompassGutter.tsx` + module, `skychart/ChartFrame.tsx` (the screen's bottom slot), `skychart/Legend.tsx` (the strip withdrawn on the screen), `i18n/{en,es}/window.ts` (D-450) |
| FR-GUT-7 / FR-FSC-11 amended | `skychart/window/SkyWindow.tsx` + module (the upright layout from the measured box), `ui/components/passes/NextEventBlock.tsx`, `i18n/{en,es}/window.ts` `turnAdvice` re-placed (D-451) |
| FR-SET-1, FR-SET-2 | `ui/screens/Settings.tsx` + `Settings.module.css`, `ui/components/location/CoordsInput.tsx` (wrapped, unchanged), `tests/e2e/settings.spec.ts` (D-445) |
| FR-SET-3 / FR-COMP-3 amended | `ui/components/common/LocationSummary.tsx`, `ui/screens/Home.tsx` (D-445, D-443) |
| FR-A11Y-1, FR-A11Y-3..5 *(v2.1)* | `ui/Shell.tsx`, `ui/App.tsx`, `ui/components/common/Header.tsx`, `ui/screens/Live.tsx` (crossing, §16.17), `lib/routeTitle.ts`, `i18n/useT.ts`, `tests/e2e/structure.ts` + `structure.spec.ts` (D-529, D-531, D-532) |
| FR-A11Y-2 | `ui/components/primitives/SectionHeading.tsx` (moved from `common/` by R105, D-703), `passes/PassCard.tsx`, `passes/PassList.tsx`, `guide/GuidePanel.tsx` (D-530) |
| FR-ROUTE-1..3 | `ui/navigation.ts`, `screens/passSelection.ts`, `screens/LiveRoute.ts`, `ui/App.tsx` (D-533) |
| FR-NIGHT-1, FR-NIGHT-2, FR-NIGHT-5 / US-16 AC5 amended | `lib/nights.ts`, `passes/nightGroups.ts`, `screens/home/shownPasses.ts`, `lib/tonightStripe.ts`, `passes/PassList.tsx` (D-534, D-535) |
| FR-NIGHT-3, FR-NIGHT-4 / FR-VIS-5 amended | `state/slices/passes.ts`, `state/effects.ts` (D-536, D-537) |
| FR-VISIT-1, FR-VISIT-3, FR-VISIT-4 / FR-LIVE-9, FR-SHARE-3 amended | `state/openLink.ts`, `state/slices/observer` (`visiting`), `state/store.ts`, `state/index.ts`, `lib/shareLinks.ts` (D-538, D-539) |
| FR-VISIT-2 | `ui/components/common/VisitNotice.tsx`, `ui/App.tsx`, `ui/screens/Live.tsx` (crossing), `i18n/{en,es}/ui.ts` |
| FR-FAIL-1, FR-FAIL-2, FR-FAIL-5, FR-FAIL-8 | `state/failure.ts`, `ui/components/common/FailureLine.tsx`, `ui/RootBoundary.tsx`, `common/InstallAction.tsx`, `passes/PassList.tsx`, `location/PlacePicker.tsx`, `location/UseMyLocation.tsx`, `elements/ElementsBanners.tsx` (D-540, D-544, D-550) |
| FR-FAIL-3, FR-FAIL-4 | `state/effects.ts`, `state/workerClient.ts`, `state/slices/{weather,passes,elements}.ts` (D-541..D-543) |
| FR-FAIL-6 / FR-LIVE-1, FR-OFF-8 amended | `ui/screens/Live.tsx`, `i18n/{en,es}/live.ts` |
| FR-FAIL-7 | `ui/components/screen/useSkyScreen.ts`, `skychart/window/orientationAccess.ts`, `i18n/{en,es}/window.ts` (D-550) |
| FR-HOME-1..4 | `ui/App.module.css`, `common/Header.tsx` + module, `screens/home/WhenStep.tsx`, `location/WhereDome.tsx`, `tests/styles/breakpoint.test.ts`, `tests/styles/controlRows.test.ts` (D-546) |
| FR-FIRST-1..4, FR-FIRST-10 amended / US-18 AC1, US-26 AC7 | `location/CoordsInput.tsx`, `screens/Home.tsx` (`WhereReading`), `passes/NextEventBlock.tsx`, `passes/PassCard.tsx` + module, `passes/PassList.module.css`, `common/Footer.tsx`, `i18n/{en,es}/ui.ts` + snapshot (D-548) |
| FR-COMP-7 | `ui/screens/Live.tsx` + module, `ui/screens/liveRows.ts`, `i18n/es/live.ts`, `tests/styles/controlRows.test.ts` (D-549) |
| FR-COMP-5 amended (F-62) | `tests/e2e/shapes.spec.ts`, `lib/layout.ts` (`COMPACT_BOX_MIN_SHORT_PX`) |
| FR-CAP-1..5 / FR-COMP-6 amended | `tests/e2e/captureSet.ts`, `tests/e2e/v1-captures.spec.ts`, `tests/docs/captures.test.ts`, `.github/workflows/captures.yml` (D-547) |
| FR-SET-1 amended, F-69 | `ui/App.tsx` (lazy settings), `scripts/bundle-budget`, `ui/screens/Settings.tsx`, `i18n/{en,es}/ui.ts` (D-545) |
| FR-A11Y-7 | `tests/e2e/axe.spec.ts`, `package.json` (dev dependency, owner-installed) (D-622) |
| FR-FAINT-1..4 | `lib/faint.ts`, `screens/home/shownPasses.ts`, `passes/PassList.tsx` + module, `passes/PassCard.tsx`, `data/localPrefs.ts` + `state/slices/prefs.ts` (`showFaint` — `data`'s, its own task), `i18n/{en,es}/ui.ts` (D-623) |
| FR-JUMP-1..3 | `passes/NextEventBlock.tsx` (`onSee`, a crossing from `live`), `screens/Live.tsx`, `screens/liveRows.ts`, `i18n/{en,es}/live.ts` (D-624) |
| FR-TAB-1..3 | `ui/App.module.css`, `ui/Shell.tsx`, `screens/PassDetail.module.css`, `screens/Settings.module.css`, `screens/Live.module.css` (crossing), `tests/styles/breakpoint.test.ts`, `tests/e2e/shapes.spec.ts` (D-625) |
| FR-DS-1, FR-THEME-1 amended *(v2.3)* | `ui/styles/tokens.css`, `scripts/contrast.ts` (`readSections`), `tests/styles/tokens.test.ts` (D-700) |
| FR-DS-2, FR-X-6 amended | `tests/styles/literals.test.ts`, `tests/styles/literals.allow.json` (D-701) |
| FR-DS-3 | `lib/layout.ts` (three heights, `FRAME_LEGEND_MIN_CELLS`), `tests/styles/breakpoint.test.ts`, `tests/styles/breakpoints.json`, every `@media` in `src/ui/**` (D-702) |
| FR-DS-4 | `ui/components/primitives/**` (eight primitives, `manifest.ts`, tests), `eslint.config.js` (the primitives zone), the composing components in `common/`, `passes/`, `location/`, `elements/`, `live/` (D-703..D-705) |
| FR-DS-5 | `skychart/dome/SkyDome.module.css` (`.degree`), `tests/e2e/axe.spec.ts`, `.github/workflows/captures.yml` (the run), `docs/RELEASE.md` §14 (D-708) |
| FR-DS-6 | `dev/primitives.html`, `dev/primitives.tsx`, `playwright.design.config.ts`, `tests/e2e/design-captures.spec.ts`, `tests/e2e/captureSet.ts` (`design`), `scripts/design-guide.ts`, `docs/DESIGN.md`, `tests/docs/design.test.ts`, `docs/HOW-THIS-WAS-BUILT.md` (D-706, D-707) |
| FR-DS-7 | `scripts/bundle-budget.ts` (unchanged rows; the table in the PR) (D-708) |
| FR-DS-8 | `ui/styles/tokens.css` (`--chart-star`, `--chart-star-dim`, `--chart-figure`, `--chart-planet`), `scripts/contrast.ts` (`CHART_MARK_TOKENS`), `tests/styles/tokens.test.ts` (D-700) |
| FR-DS-9 | `docs/DESIGN.md`'s last section (the static block in `scripts/design-guide.ts`), `.claude/skills/sdd-spec/SKILL.md` (one line: read the guide) (D-707) |
| FR-STAR-12 *(v2.4)* | `spike/stars/**` (the page, `params.ts`, `catalog.ts`, `perf.ts`, `precession.ts`, `capture.ts`), `docs/stars/FINDINGS.md`, `docs/stars/captures/` (D-740, D-741) |
| FR-STAR-1, FR-STAR-10 *(v2.4.1)* | `scripts/build-stars.ts`, `data/stars/{catalog.json,catalog.ts,constellations.ts}`, `tests/data/starCatalog.test.ts`; the page's `stars` catalog section (D-748, D-756) |
| FR-STAR-2 *(v2.4.1)* | `lib/skyStars.ts` and its test, `tests/fixtures/stars/` (D-749, D-743) |
| FR-STAR-3, FR-STAR-7, FR-STAR-8 *(v2.4.1)* | `screens/{Stars.tsx,StarsRoute.ts,starsChunk.ts}`, `screens/stars/FieldList.tsx`, `lib/{shareLinks,routeTitle,shortcuts}.ts`, `ui/navigation.ts`, `common/Header.tsx`, the When pane; `tests/e2e/stars.spec.ts` (D-756) |
| FR-STAR-4, FR-STAR-11 *(v2.4.1)* | `skychart/window/{camera.ts,scene.ts}`, `skychart/SkyChart.types.ts` (`scene`, `namedStar`), `useViewRotation` (D-750, D-751) |
| FR-STAR-5 *(v2.4.1)* | `components/screen/{SkyScreen.tsx,useSkyScreen.ts}` (`inventory`), `tests/e2e/stars-screen.spec.ts` (D-756, D-757) |
| FR-STAR-6 *(v2.4.1)* | `skychart/window/{starGlyphs.ts,inkOffsets.ts,starLabels.ts,StarField.tsx}`, `ui/styles/tokens.css` (the four tokens), `scripts/contrast.ts` (D-752..D-755) |
| FR-STAR-9 *(v2.4.1)* | `StarField.tsx` (the channel), `scripts/bundle-budget.ts` (`stars`), `tests/e2e/stars-perf.spec.ts` (D-751, D-759) |
| FR-STAR-13 *(v2.4.1; built v2.5)* | `lib/skyStars.ts` (`drawnRungs`, `planetsDrawn`), every view's star group through the scene (D-791) |
| FR-STAR-14 *(v2.4.1; built v2.5)* | `lib/landmark.ts` (`segmentDistanceDeg`, `constellationAt`), `skychart/window/StarField.tsx`'s hit test (D-795, D-796) |
| FR-SKY-1 *(v2.5)* | `skychart/{useSkyScene.ts,layers.ts}` and its test, `SkyChart.types.ts` (`scene`), `SkyChart.contract.test.tsx` (D-788) |
| FR-SKY-2 *(v2.5)* | `skychart/SkyChart.tsx` (`WINDOW_VIEW.available`), `skychart/ChartFrame.tsx` (`windowBox`), `screens/{Live.tsx,PassDetail.tsx}`, `model/prefs.ts`, `data/localPrefs.ts` (D-789) |
| FR-SKY-3, FR-SKY-8 *(v2.5)* | `model/prefs.ts`, `state/slices/prefs.ts` (`starsLayer`), `screens/{Live.tsx,PassDetail.tsx}` (the toggle, the chunk's load and prefetch), `screens/starsChunk.ts` (D-791) |
| FR-SKY-4 *(v2.5)* | `skychart/polar/SkyPolar.tsx` (the star group), `__snapshots__/SkyPolar.live.svg` (D-792) |
| FR-SKY-5 *(v2.5)* | `skychart/dome/{domeLayers.ts,palette.ts}`, the raster snapshots, `tests/e2e/dome-perf.spec.ts` (D-793) |
| FR-SKY-6 *(v2.5)* | `components/screen/{SkyScreen.tsx,useSkyScreen.ts}`, `screens/Stars.tsx` (`[ passes ]`), `screens/stars/field.ts` (D-794) |
| FR-SKY-7 *(v2.5)* | `skychart/window/camera.ts` (`facePeak`), `screens/PassDetail.tsx` (the picker's list) (D-790) |
| FR-SKY-9, FR-SKY-10 *(v2.5)* | `tests/e2e/captureSet.ts`, `tests/e2e/v1-captures.spec.ts`, `scripts/bundle-budget.ts`, `docs/RELEASE.md` §17 (D-799) |
| FR-STAR-1, FR-STAR-6, FR-STAR-10 *(amended v2.5, V25-16)* | `data-src/stars/names-es.tsv`, `scripts/build-stars.ts`, `data/stars/catalog.json` (`nameEs`, `figuresEs`), `lib/skyStars.ts` (`starName`, `figureName`, `constellationName`), `tests/data/starCatalog.test.ts`, `controlRows.test.ts` (D-832) |
| FR-SKY-11, FR-SKY-12 *(v2.5)* | `lib/landmark.ts`, `lib/landmarkLine.ts`, `skychart/window/scene.ts` (`landmark`), `skychart/layers.ts`, `screens/{Live.tsx,PassDetail.tsx}` (the line, the `Among` column), `components/screen/SkyScreen.tsx` (the readout) (D-795, D-796) |
| FR-SKY-13 *(v2.5)* | `skychart/window/camera.ts` (`follow`, `followPass`), `screens/Live.tsx`, `lib/shortcuts.ts` (`f`) (D-797) |
| FR-SKY-14 *(v2.5)* | `skychart/window/{camera.ts,projection.ts,SkyWindow.tsx,gutter.ts}`, `screens/Stars.tsx`, `components/screen/SkyScreen.tsx`, `tests/e2e/window-zoom.spec.ts` (D-798) |
| FR-FLOW-1 *(v2.6)* | `screens/home/{HomeDoors.tsx,doorLines.ts}`, `screens/Home.tsx`, `lib/skyStars.ts` (`brightestDrawn`), `screens/starsChunk.ts`; removed `StarsLine.tsx`, `WhereDome.tsx` (D-843) |
| FR-FLOW-2 *(v2.6)* | `components/location/WherePlace.tsx` (`folded`), `ReadinessLine.tsx`, `FailureLine.tsx` (D-844) |
| FR-FLOW-3 *(v2.6)* | `components/common/Header.tsx` (`page`, `context`), `screens/{Live.tsx,PassDetail.tsx,Stars.tsx,Settings.tsx}` (D-845) |
| FR-FLOW-4 *(v2.6)* | `components/sky/SkyViewLayout.tsx`, `screens/{Live.tsx,Stars.tsx,PassDetail.tsx}`, `components/primitives/ToggleGroup.tsx`, `components/live/StarsToggle.tsx`, `tests/e2e/sky-layout.spec.ts` (D-842, D-846) |
| FR-FLOW-5 *(v2.6)* | `src/i18n/{en,es}/{chart,window,starsPage}.ts`, `messages.test.ts` (D-847) |
| FR-FLOW-6 *(v2.6)* | `components/sky/SkyHint.tsx`, `skychart/window/SkyWindow.tsx` (the hint removed), `skychart/useChartHand.ts` (`onFirstGesture`), `model/prefs.ts`, `data/localPrefs.ts` (D-848) |
| FR-FLOW-7 *(v2.6)* | `screens/PassDetail.tsx`, `components/guide/TimesRow.tsx`, `lib/layout.ts` (D-849) |
| FR-FLOW-8 *(v2.6)* | `screens/Stars.tsx` (slots), `screens/stars/**` (D-842) |
| FR-FLOW-9 *(v2.6)* | `skychart/ChartFrame.tsx`, `lib/fitBox.ts`, `lib/layout.ts` (`DOME_COMPACT_SLACK_PX`) (D-850) |
| FR-FLOW-10, FR-FLOW-11 *(v2.6)* | `components/sky/SkyViewLayout.tsx` (`data-rhythm`), `ui/styles/primitives.css` (`.target`, `.target-row`), `tests/e2e/{rhythm,targets}.spec.ts` (D-851) |
| FR-FLOW-12 *(v2.6)* | `tests/e2e/{captureSet.ts,v1-captures.spec.ts}`, `scripts/bundle-budget.ts`, `docs/RELEASE.md` §18 (D-853) |
| FR-FLOW-13 *(v2.6)* | `skychart/Legend.tsx`, `src/i18n/{en,es}/chart.ts` (D-852) |
| FR-FLOW-14 *(v2.6)* | `screens/chartViewDefault.ts`, `data/localPrefs.ts` (`chartView`), `skychart/window/camera.ts` (`openingFacing`), `screens/{Live.tsx,PassDetail.tsx}` (D-876) |
| FR-FLOW-15 *(v2.6)* | `components/sky/SkyViewLayout.tsx` (the landscape arrangement), `lib/layout.ts`, `tests/e2e/sky-layout.spec.ts` (D-877) |
| FR-FLOW-16 *(v2.6.1)* | `tests/docs/captureIds.test.ts`, `tests/e2e/{r76,r84}-captures.spec.ts` (D-886) |
| FR-FLOW-17 *(v2.6.1)* | `src/i18n/{en,es}/{stars,starsPage}.ts`, `components/common/LanguageToggle.tsx`, `skychart/Legend.tsx`, `screens/Live.tsx`, the comments FR-FLOW-17 names (D-887) |
| FR-TONIGHT-1 *(v2.7)* | `lib/tonightJump.ts` (`openingJump`), `screens/Live.tsx` (the jump effect), `state/slices/ui.ts` (`stayOnNow`), `components/live/usePlayback.ts` (the reader-wrote ref) (D-897, D-898) |
| FR-TONIGHT-2 *(v2.7)* | `screens/Live.tsx` (the reduced-motion check) (D-898) |
| FR-TONIGHT-3 *(v2.7)* | `components/live/TimeTrack.{tsx,module.css}`, `lib/layout.ts` (`TRACK_HEIGHT_PX`) (D-896, D-900) |
| FR-TONIGHT-4 *(v2.7)* | `components/live/TimeTaps.{tsx,module.css}`, `lib/tonightJump.ts` (`tonightTarget`, `nextTarget`) (D-897, D-901) |
| FR-TONIGHT-5 *(v2.7)* | `lib/playback.ts` (`autoSpeed`, `nightEnd`), `components/live/usePlayback.ts` (`speed: 'auto'`), `physics/constants.ts` (D-896, D-899) |
| FR-TONIGHT-6 *(v2.7)* | `screens/liveRows.ts`, `screens/Live.tsx`, `components/sky/SkyViewLayout.tsx` (`readoutIn`), the list panel's head (D-902, D-904, D-905) |
| FR-TONIGHT-7 *(v2.7)* | `components/live/ShownTime.tsx`, `lib/shownTime.ts`, `lib/contextLine.ts`, `src/i18n/{en,es}/live.ts` (D-903) |
| FR-TONIGHT-8 *(v2.7)* | `src/i18n/{en,es}/{live,track}.ts`, `npm run check:dead` |
| FR-TONIGHT-9 *(v2.7)* | `tests/e2e/{live-compact,live-states,live-tonight,targets,rhythm,shapes}.spec.ts` (§9.9) |
| FR-TONIGHT-10 *(v2.7)* | `scripts/bundle-budget.ts`, `tests/e2e/{captureSet.ts,v1-captures.spec.ts}` |
| FR-FULL-1 *(v2.8)* | `components/sky/SkyViewLayout.{tsx,module.css}` (`form: 'full'`), `screens/Live.tsx`, `lib/layout.ts` (D-918, D-919) |
| FR-FULL-2 *(v2.8)* | `components/live/SkyHead.{tsx,module.css}`, `screens/Live.tsx` (the hidden `h1`) (D-920) |
| FR-FULL-3 *(v2.8)* | `components/live/ControlsSheet.tsx` (the button), the hint in the overlay, `lib/layout.ts` (`hintFitsBeside`) (D-921, D-924) |
| FR-FULL-4 *(v2.8)* | `components/live/ControlsSheet.{tsx,module.css}`, `screens/Live.tsx` (the sheet's children), `components/sky/SkyViewLayout.tsx` (`readoutIn: 'sheet'`) (D-921, D-923) |
| FR-FULL-5 *(v2.8)* | `components/live/ControlsSheet.tsx`, `components/sky/SkyViewLayout.tsx` (the tap listener), `screens/Live.tsx` (the `Esc` listener) (D-921, D-922, D-927) |
| FR-FULL-6 *(v2.8)* | `components/sky/SkyViewLayout.tsx` (the fixed wrapper), `tests/e2e/live-states.spec.ts` (D-919) |
| FR-FULL-7 *(v2.8)* | `screens/Live.tsx`, `tests/e2e/live-tonight.spec.ts` (D-925) |
| FR-FULL-8 *(v2.8)* | `src/i18n/{en,es}/{live,sheet}.ts`, `npm run check:dead` |
| FR-FULL-9 *(v2.8)* | `scripts/bundle-budget.ts`, `tests/e2e/{captureSet.ts,v1-captures.spec.ts}` |
| FR-FULL-10 *(v2.8)* | `lib/tonightJump.ts` (`openingChoice`), `components/live/OpeningCard.{tsx,module.css}`, `screens/Live.tsx` (the card's effect), `state/slices/ui.ts` (`stayOnNow` removed) (D-925, D-926) |
| FR-GYRO-1 *(v2.9)* | `components/sky/FollowToggle.{tsx,module.css}`, `screens/{Live,Stars,PassDetail}.tsx` (D-943, D-944) |
| FR-GYRO-2 *(v2.9)* | `skychart/window/SkyWindow.tsx` (`follow`), `skychart/window/useViewRotation.ts`, `skychart/SkyChart.tsx` (D-941) |
| FR-GYRO-3 *(v2.9)* | `components/sky/FollowToggle.tsx`, `skychart/window/orientationAccess.ts` (D-943) |
| FR-GYRO-4 *(v2.9)* | `skychart/window/SkyWindow.tsx` (`onFollowEnd`), `useViewRotation.ts` (`poseAsHand`) (D-942) |
| FR-GYRO-5 *(v2.9)* | `skychart/window/SkyWindow.tsx` (the overlay while following) (D-941) |
| FR-GYRO-6 *(v2.9)* | removals across `components/screen/`, `skychart/window/{CompassGutter,gutter}`, `state`, `Shell.tsx`, `lib/layout.ts`, `tokens.css` (D-945) |
| FR-GYRO-7 *(v2.9)* | `components/live/ControlsSheet.{tsx,module.css}`, `lib/layout.ts` (D-947) |
| FR-GYRO-8 *(v2.9)* | `components/live/ControlsSheet.{tsx,module.css}`, `components/sky/SkyViewLayout.tsx` (the tap listener removed), `lib/layout.ts` (D-948) |
| FR-GYRO-9 *(v2.9)* | `src/i18n/**`, `scripts/bundle-budget.ts`, `tests/e2e/{orientation.ts,captureSet.ts,v1-captures.spec.ts}` (D-946) |
| FR-GYRO-10 *(v2.9)* | `screens/{Live.tsx,liveRows.ts}`, the legend panel (D-949, D-951) |
| FR-GYRO-11 *(v2.9)* | `skychart/SkyChart.tsx` (`SKY_CHART_VIEWS`) (D-950) |
| FR-PHONE-1 *(v2.10)* | `components/sky/useFollow.ts`, `screens/{Live,Stars,PassDetail}.tsx` (D-962) |
| FR-PHONE-2 *(v2.10)* | `components/sky/useFollow.ts`, `components/sky/SkyViewLayout.tsx` (the first-touch listener), `model/prefs.ts` (`followGranted`), `state/slices/prefs.ts` (D-962, D-963) |
| FR-PHONE-3 *(v2.10)* | `components/live/FollowControl.tsx`, `screens/Live.tsx`, `lib/layout.ts` (`hintFitsBeside`), `src/i18n/{en,es}/sheet.ts` (D-964) |
| FR-PHONE-4 *(v2.10)* | `components/sky/SkyViewLayout.tsx` (the `readout` overlay slot), `screens/Live.tsx` (D-965) |
| FR-PHONE-5 *(v2.10)* | `components/sky/SkyHint.tsx`, `src/i18n/{en,es}/window.ts`, `tests/e2e/captureSet.ts` (D-966) |
| FR-PHONE-6 *(v2.10)* | `screens/{Stars,PassDetail}.tsx`, `components/live/useWakeLock.ts` (D-967) |
| FR-PHONE-7 *(v2.10)* | `screens/Stars.tsx`, `screens/stars/FieldList.tsx`, `src/i18n/{en,es}/chart.ts` (D-971) |
| FR-PHONE-8 *(v2.10)* | `skychart/layers.ts`, `skychart/polar/SkyPolar.tsx`, `skychart/window/{starGlyphs,starLabels}.ts` (D-968) |
| FR-PHONE-9 *(v2.10)* | `skychart/polar/fieldOutline.ts`, `skychart/polar/SkyPolar.tsx` (D-969) |
| FR-PHONE-10 *(v2.10)* | `skychart/window/SkyWindow.tsx` (`onFieldHandoff`), `skychart/polar/SkyPolar.tsx` (the pinch), `skychart/SkyChart.tsx` (`heldView`), `lib/layout.ts` (`PINCH_HANDOFF_RATIO`) (D-970) |
| FR-PHONE-11 *(v2.10)* | nothing: the dome's files and rasters unchanged (D-968) |
| FR-PHONE-12 *(v2.10)* | `screens/Home.tsx`, `components/location/WherePlace.tsx` (D-972) |
| FR-PHONE-13 *(v2.10)* | `screens/home/{doorLines.ts,HomeDoors.tsx}`, `src/i18n/{en,es}/ui.ts` (D-972) |
| FR-PHONE-14 *(v2.10)* | `components/guide/TimesRow.tsx`, `screens/PassDetail.tsx` (the head), `lib/format.ts` (`formatTimesRow`) (D-972) |
| FR-PHONE-15 *(v2.10)* | `model/prefs.ts` (`Theme`), `ui/styles/theme.ts` (`resolveTheme`, `THEME_AUTO_SUN_DEG`, `useThemeTick`), `Shell.tsx` (the tick), `screens/Settings.tsx` (D-972, D-979) |
| FR-PHONE-16 *(v2.10)* | `src/i18n/**`, `scripts/bundle-budget.ts`, `tests/e2e/{captureSet.ts,v1-captures.spec.ts}`, `docs/RELEASE.md` (D-966, D-975) |
| FR-LOOK-1 *(v2.10)* | `skychart/window/skySurface.ts`, `skychart/window/StarField.tsx`, `skychart/polar/SkyPolar.tsx`, `ui/styles/tokens.css`, `scripts/contrast.ts` (D-974) |
| FR-LOOK-2 *(v2.10)* | `skychart/window/skySurface.ts` (the tint step), `skychart/starScene.ts` (D-974) |
| FR-LOOK-3 *(v2.10)* | `scripts/build-stars.ts` (`milkyWay.json`), `skychart/window/milkyWay.ts`, `data/stars/constants.ts` (D-973, D-974) |
| FR-LOOK-4 *(v2.10)* | `skychart/window/starGlyphs.ts`, `skychart/window/StarField.tsx`, `skychart/window/starGlyphs.module.css` (D-974) |
| FR-LOOK-5 *(v2.10)* | `scripts/build-stars.ts` (`bv`), `skychart/window/starGlyphs.ts` (the tones), `ui/styles/tokens.css` (D-973, D-974) |
| FR-LOOK-6 *(v2.10)* | `skychart/window/bloom.ts`, `skychart/window/StarField.tsx` (D-974) |
| FR-LOOK-7 *(v2.10)* | `skychart/window/MoonDisc.tsx`, `skychart/window/SkyWindow.tsx`, `skychart/polar/SkyPolar.tsx`, `skychart/useSkyBodies.ts` (the limb angle) (D-974) |
| FR-LOOK-8 *(v2.10)* | `scripts/build-stars.ts` (`deep.json`), `data/stars/deepChunk.ts`, `scripts/bundle-budget.ts` (D-973) |
| FR-LOOK-9 *(v2.10)* | `skychart/window/fieldDetail.ts`, `skychart/window/deepField.ts`, `skychart/window/StarField.tsx`, `skychart/window/starLabels.ts` (D-974) |
| FR-LOOK-10 *(v2.10)* | `data/stars/constants.ts` (the three strengths and the look's constants) (D-974, D-975) |
| FR-LOOK-11 *(v2.10)* | `tests/e2e/{stars-perf,live-perf}.spec.ts` (D-974) |
| FR-LOOK-12 *(v2.10)* | `ui/styles/tokens.css`, `docs/DESIGN.md`, `scripts/bundle-budget.ts`, `tests/e2e/captureSet.ts`, `docs/RELEASE.md` §23 (D-975) |
| FR-CLEAN-1 *(v2.11)* | `screens/{Stars,PassDetail}.tsx`, `components/sky/SkyViewLayout.tsx` (D-997, D-998) |
| FR-CLEAN-2 *(v2.11)* | `components/sky/SkyHead.tsx`, `screens/{Stars,PassDetail}.tsx`, `screens/home/doorLines.ts` (the stars line) (D-996, D-997, D-998) |
| FR-CLEAN-3 *(v2.11)* | `components/sky/ControlsSheet.tsx`, `components/live/FollowControl.tsx`, `components/sky/SkyHint.tsx` (D-996) |
| FR-CLEAN-4 *(v2.11)* | `screens/Stars.tsx`, `screens/stars/FieldList.tsx` (D-997) |
| FR-CLEAN-5 *(v2.11)* | `screens/PassDetail.tsx`, `components/guide/{TimesRow,GuideText,PassNumbers}.tsx` (D-998) |
| FR-CLEAN-6 *(v2.11)* | `screens/{Stars,PassDetail}.tsx` (the listeners), `components/sky/ControlsSheet.tsx` (D-999) |
| FR-CLEAN-7 *(v2.11)* | `components/sky/SkyViewLayout.{tsx,module.css}` (D-1000) |
| FR-CLEAN-8 *(v2.11)* | `components/sky/SkyViewLayout.*`, `lib/layout.ts` (the two constants removed), `screens/flowPages.ts`, `tests/e2e/{rhythm,targets}.spec.ts` (D-1000) |
| FR-CLEAN-9 *(v2.11)* | `src/i18n/**`, `scripts/bundle-budget.ts`, `tests/e2e/{captureSet.ts,v1-captures.spec.ts}`, `docs/RELEASE.md` (D-1001, D-1002) |
| FR-CLEAN-10 *(v2.11)* | nothing: the wide branches untouched by the sheets (D-997, D-998) |
| FR-CLEAN-11 *(v2.11)* | `screens/Stars.tsx`, `screens/stars/FieldList.tsx`, `skychart/useSkyScene.ts`, `src/i18n/{en,es}/starsPage.ts`, `tests/e2e/captureSet.ts` (D-1004) |
| FR-CLEAN-12 *(v2.11)* | `App.module.css`, `Shell.module.css`, `Shell.tsx`, `tests/e2e/wide.spec.ts` (D-1003) |
| FR-CLEAN-13 *(v2.11)* | `components/sky/SkyViewLayout.module.css` (the rail's `viewRow` rule) (D-1003) |
| FR-CLEAN-14 *(v2.11)* | `components/common/Header.{tsx,module.css}`, `components/primitives/BracketLink.tsx` (read only), `tests/e2e/home-header.spec.ts` or FR-HOME-1's spec (D-1003) |
| FR-CLEAN-15 *(v2.11)* | `screens/Settings.module.css` (the wide block), `tests/e2e/rhythm.spec.ts` (D-1003) |
| FR-CLEAN-16 *(v2.11)* | `screens/home/HomeDoors.{tsx,module.css}`, `components/primitives/Card.{tsx,module.css}` (the new prop, `emphasis` or as the task names it), `components/primitives/manifest.ts`, `docs/DESIGN.md` regenerated, `tests/e2e/wide.spec.ts` (D-1003) |
| FR-GLOBE-1 *(v2.12)* | `screens/Stars.tsx` (the view state and row), `src/i18n/{en,es}/globe.ts` (D-1035) |
| FR-GLOBE-2 *(v2.12)* | `skychart/globe/projection.ts`, `skychart/globe/GlobeRenderer.ts` (D-1036, D-1038) |
| FR-GLOBE-3 *(v2.12)* | `skychart/globe/scene.ts`, `skychart/globe/GlobeRenderer.ts` (D-1037, D-1038) |
| FR-GLOBE-4 *(v2.12)* | `skychart/globe/GlobeRenderer.ts`, `skychart/window/starGlyphs.ts` (read only) (D-1038) |
| FR-GLOBE-5 *(v2.12)* | `skychart/globe/projection.ts` (`localFrame`, `coordsIn`, `openView`), `screens/Stars.tsx` (the `Turn` row) (D-1036) |
| FR-GLOBE-6 *(v2.12)* | `skychart/globe/SkyGlobe.tsx`, `skychart/globe/projection.ts` (`dragTurn`) (D-1036, D-1038) |
| FR-GLOBE-7 *(v2.12)* | `screens/Stars.tsx` (the second `usePlayback`, the `Time` group), `components/live/usePlayback.ts` (read only) (D-1039) |
| FR-GLOBE-8 *(v2.12)* | `screens/Stars.tsx`, `lib/timeFormat.ts` (read only), `lib/shownTime.ts` (read only) (D-1039) |
| FR-GLOBE-9 *(v2.12)* | `screens/Stars.tsx` (the `Place` group), `data/favourites.ts` (read only) (D-1040) |
| FR-GLOBE-10 *(v2.12)* | `skychart/globe/GlobeRenderer.ts`, `data/stars/deepChunk.ts` (read only), `screens/Stars.tsx` (the toggle) (D-1038) |
| FR-GLOBE-11 *(v2.12)* | `skychart/window/starLabels.ts` (the two options), `skychart/globe/GlobeRenderer.ts`, `skychart/globe/scene.ts` (`figureAnchor`) (D-1041) |
| FR-GLOBE-12 *(v2.12)* | `skychart/globe/scene.ts` (`upCount`, `upList`), `screens/stars/FieldList.tsx`, `screens/Stars.tsx` (D-1035, D-1037) |
| FR-GLOBE-13 *(v2.12)* | `skychart/globe/scene.ts` (`surfaceAt`), `skychart/window/skySurface.ts` (read only) (D-1037) |
| FR-GLOBE-14 *(v2.12)* | `skychart/globe/SkyGlobe.module.css`, `ui/styles/tokens.css` (only if a token is missing) (D-1038) |
| FR-GLOBE-15 *(v2.12)* | `scripts/bundle-budget.ts` (the `globe` row), `screens/Stars.tsx` (the lazy import and the prefetch), `tests/e2e/globe-perf.spec.ts` (D-1034, D-1042) |
| FR-GLOBE-16 *(v2.12)* | `src/i18n/{en,es}/globe.ts`, `tests/e2e/axe.spec.ts`, `tests/styles/controlRows.test.ts` (D-1042) |
| FR-GLOBE-17 *(v2.12)* | `skychart/globe/projection.ts`, `skychart/globe/scene.ts` and their tests (D-1036, D-1037) |
| FR-GLOBE-18 *(v2.12)* | `tests/e2e/{captureSet,captureSeeds}.ts`, `docs/screenshots/v1-*`, `docs/RELEASE.md` §25 (D-1042) |
| FR-SDD-1, FR-SDD-2 *(v2.13)* | `scripts/sdd/ledger.ts`, `scripts/sdd/agents.ts`, `sdd.agents.json` (D-1058, D-1064) |
| FR-SDD-3..5 *(v2.13)* | `scripts/sdd/{split,splitMap,rewrap}.ts`, `docs/sdd/phases/`, `docs/sdd/decisions.md` (D-1059, D-1060) |
| FR-SDD-6, FR-SDD-7 *(v2.13)* | `scripts/sdd/ids.ts`, `docs/sdd/ids.md`, `scripts/sdd/{brief,tasks}.ts` (D-1061, D-1062) |
| FR-SDD-8, FR-SDD-9 *(v2.13)* | `AGENTS.md`, `CLAUDE.md`, `docs/sdd/workflows/`, `.claude/skills/*`, `RELEASE.md` (D-1063) |
| FR-SDD-10, FR-SDD-11 *(v2.13)* | `sdd.agents.json`, `scripts/sdd/{agents,session,tasks,cli}.ts` (D-1064) |
| FR-SDD-12 *(v2.13)* | `docs/sdd/gotchas.md` |
| FR-SDD-13, FR-SDD-4 *(v2.13)* | `scripts/check-sdd.ts`, `scripts/sdd/limits.ts` |
| FR-SDD-14 *(v2.13)* | `.ignore`, `scripts/sdd-map.ts`, `docs/sdd/map.md` |
| FR-SDD-15, FR-SDD-16 *(v2.13)* | `scripts/check.ts`, `scripts/ci-digest.ts`, `.github/workflows/ci.yml` (D-1066, D-1067) |
| FR-SDD-17 *(v2.13)* | `scripts/sdd/brief.ts` (D-1062) |
| FR-SDD-18 *(v2.13)* | `scripts/sdd/review.ts`, `docs/sdd/workflows/review.md` (D-1065) |
| FR-SDD-19 *(v2.13)* | `eslint.config.*` `max-lines` (D-1069) |
| FR-SDD-20, FR-SDD-21 *(v2.13)* | `scripts/sdd/report.ts`, the title check in `ci.yml`, `docs/sdd/workflows/breakdown.md` |
| FR-SDD-22, FR-SDD-23 *(v2.13)* | `scripts/captures/*`, `.github/workflows/captures.yml`, the `captures` branch (D-1068) |
| FR-SDD-24 *(v2.13)* | `scripts/sdd/traceability.ts`, `docs/sdd/reference/traceability.md` (D-1069) |
| FR-SDD-25 *(v2.13)* | `.github/workflows/ci.yml` (D-1067) |
| FR-SDD-26, FR-SDD-27 *(v2.13)* | `docs/sdd/archive.json`, the `archive` branch (R181), `scripts/prune-merged-branches.ts`, `scripts/sdd/cli.ts` (R180) (D-1070, D-1071) |
| FR-SDD-28 *(v2.13)* | the phase's diff: no `src/` or `public/` path |

---

## From the test names (FR-SDD-24)

<!-- Generated by `npx tsx scripts/sdd/traceability.ts --write` (D-1069): every requirement or story id a test title names. -->

| Requirement | Tests |
|---|---|
| FR-A11Y-1 | `src/ui/App.structure.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/structure.spec.ts` |
| FR-A11Y-2 | `src/ui/App.structure.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/structure.spec.ts` |
| FR-A11Y-3 | `src/lib/routeTitle.test.ts`, `src/ui/App.structure.test.tsx`, `tests/e2e/stars.spec.ts`, `tests/e2e/structure.spec.ts` |
| FR-A11Y-4 | `src/ui/App.structure.test.tsx`, `tests/e2e/structure.spec.ts` |
| FR-A11Y-5 | `src/ui/App.structure.test.tsx`, `tests/e2e/structure.spec.ts` |
| FR-A11Y-7 | `tests/e2e/axe.spec.ts` |
| FR-ADDR-1 | `tests/docs/accuracy.test.ts` |
| FR-ADDR-2 | `tests/deploy/wrangler.test.ts` |
| FR-ADDR-3 | `tests/deploy/wrangler.test.ts` |
| FR-ADDR-4 | `tests/docs/accuracy.test.ts` |
| FR-CAP-1 | `tests/docs/captures.test.ts` |
| FR-CAP-3 | `tests/docs/captures.test.ts` |
| FR-CAP-5 | `tests/e2e/live-states.spec.ts` |
| FR-CI-1 | `tests/docs/ci.test.ts` |
| FR-CI-2 | `tests/docs/ci.test.ts` |
| FR-CI-3 | `tests/docs/ci.test.ts` |
| FR-CLEAN-1 | `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/clean-sky.spec.ts`, `tests/e2e/sky-layout.spec.ts`, `tests/e2e/stars.spec.ts` |
| FR-CLEAN-2 | `src/ui/App.structure.test.tsx`, `src/ui/screens/Stars.test.tsx` |
| FR-CLEAN-3 | `src/ui/screens/PassDetail.test.tsx` |
| FR-CLEAN-4 | `src/ui/screens/Stars.test.tsx`, `tests/e2e/clean-sky.spec.ts`, `tests/e2e/sky-layout.spec.ts` |
| FR-CLEAN-5 | `src/ui/screens/PassDetail.test.tsx`, `tests/e2e/clean-sky.spec.ts`, `tests/e2e/sky-layout.spec.ts` |
| FR-CLEAN-6 | `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/clean-sky.spec.ts` |
| FR-CLEAN-7 | `src/ui/screens/Stars.test.tsx`, `tests/e2e/clean-sky.spec.ts`, `tests/e2e/sky-layout.spec.ts` |
| FR-CLEAN-8 | `tests/e2e/rhythm.spec.ts`, `tests/e2e/targets.spec.ts` |
| FR-CLEAN-11 | `src/ui/screens/Stars.test.tsx`, `tests/e2e/clean-sky.spec.ts`, `tests/e2e/sky-layout.spec.ts`, `tests/e2e/stars.spec.ts` |
| FR-CLEAN-12 | `tests/e2e/wide.spec.ts`, `tests/styles/breakpoint.test.ts` |
| FR-CLEAN-15 | `tests/e2e/rhythm.spec.ts` |
| FR-CLEAN-16 | `src/ui/components/primitives/Card.test.tsx`, `src/ui/screens/home/HomeDoors.test.tsx`, `tests/e2e/wide.spec.ts`, `tests/styles/doorRows.test.ts` |
| FR-COMP-1 | `src/ui/components/common/Header.test.tsx`, `tests/e2e/settings.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-COMP-2 | `src/ui/App.settings.test.tsx`, `src/ui/screens/Settings.test.tsx`, `tests/e2e/settings.spec.ts` |
| FR-COMP-4 | `src/ui/components/live/StepControls.test.tsx`, `tests/styles/controlRows.test.ts`, `tests/styles/doorRows.test.ts` |
| FR-COMP-5 | `src/ui/components/guide/skychart/SkyChart.contract.test.tsx`, `tests/e2e/narrow.spec.ts`, `tests/styles/liveShape.test.ts` |
| FR-COMP-7 | `src/ui/screens/Live.test.tsx`, `tests/e2e/live-states.spec.ts` |
| FR-DESK-1 | `tests/e2e/desktop.spec.ts`, `tests/styles/breakpoint.test.ts` |
| FR-DESK-2 | `src/ui/App.wide.test.tsx`, `src/ui/components/common/Header.test.tsx`, `tests/e2e/settings.spec.ts` |
| FR-DESK-3 | `src/ui/App.shortcuts.test.tsx`, `src/ui/App.wide.test.tsx`, `src/ui/components/passes/passCursor.test.ts`, `tests/styles/breakpoint.test.ts` |
| FR-DESK-4 | `src/lib/shortcuts.test.ts`, `src/ui/App.shortcuts.test.tsx`, `src/ui/components/common/ShortcutsOverlay.test.tsx`, `src/ui/components/passes/passCursor.test.ts`, `src/ui/screens/StarsGlobe.test.tsx`, `src/ui/screens/viewFor.test.ts`, `tests/e2e/shortcuts.spec.ts`, `tests/e2e/stars.spec.ts` |
| FR-DESK-5 | `tests/e2e/desktop.spec.ts` |
| FR-DOME-1 | `src/ui/components/guide/skychart/dome/camera.test.ts`, `tests/e2e/shapes.spec.ts` |
| FR-DOME-2 | `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/components/guide/skychart/dome/palette.test.tsx`, `src/ui/components/guide/skychart/polar/SkyPolar.test.tsx`, `tests/deploy/headers.test.ts` |
| FR-DOME-3 | `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts` |
| FR-DOME-4 | `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts` |
| FR-DOME-5 | `src/lib/skyGeometry.test.ts`, `src/ui/components/guide/skychart/dome/SkyDome.raster.test.tsx`, `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/components/guide/skychart/polar/SkyPolar.test.tsx` |
| FR-DOME-6 | `src/lib/legend.test.ts`, `src/physics/sun.test.ts`, `src/ui/components/guide/skychart/SkyChart.contract.test.tsx`, `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/components/guide/skychart/polar/SkyPolar.test.tsx` |
| FR-DOME-7 | `tests/e2e/shortcuts.spec.ts` |
| FR-DOME-8a | `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts` |
| FR-DOME-8b | `src/ui/components/guide/skychart/dome/domeLayers.test.ts` |
| FR-DS-1 | `tests/styles/tokens.test.ts` |
| FR-DS-2 | `src/ui/components/guide/skychart/window/starGlyphs.test.ts`, `tests/styles/literals.test.ts` |
| FR-DS-3 | `tests/styles/breakpoint.test.ts` |
| FR-DS-6 | `tests/docs/design.test.ts` |
| FR-DS-8 | `src/ui/components/guide/skychart/dome/palette.test.tsx`, `tests/styles/tokens.test.ts` |
| FR-FACT-1 | `src/lib/orbitHeight.test.ts`, `src/state/slices/elements.test.ts` |
| FR-FACT-3 | `src/lib/riseSet.test.ts` |
| FR-FAIL-1 | `src/state/effects.test.ts`, `src/ui/screens/Live.test.tsx` |
| FR-FAIL-3 | `src/state/effects.test.ts` |
| FR-FAIL-4 | `src/state/effects.test.ts`, `src/state/workerClient.test.ts`, `src/ui/components/passes/PassList.test.tsx`, `tests/e2e/failure-line.spec.ts` |
| FR-FAIL-5 | `src/ui/RootBoundary.test.tsx` |
| FR-FAIL-6 | `src/ui/screens/Live.test.tsx`, `tests/e2e/live-failures.spec.ts` |
| FR-FAINT-1 | `src/lib/faint.test.ts` |
| FR-FAINT-2 | `src/ui/components/passes/PassList.faint.test.tsx` |
| FR-FAINT-3 | `src/data/localPrefs.test.ts`, `tests/e2e/faint.spec.ts` |
| FR-FIRST-1 | `src/ui/components/location/WherePlace.test.tsx`, `src/ui/screens/Home.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/live-failures.spec.ts` |
| FR-FIRST-2 | `src/ui/components/location/WherePlace.test.tsx`, `src/ui/components/primitives/TextButton.test.tsx`, `src/ui/screens/Home.test.tsx`, `tests/e2e/first-run-controls.spec.ts`, `tests/e2e/home.spec.ts` |
| FR-FIRST-3 | `src/lib/nextEvent.test.ts`, `src/ui/components/passes/NextEventBlock.test.tsx`, `src/ui/screens/Home.test.tsx`, `tests/e2e/first-run-controls.spec.ts`, `tests/e2e/home.spec.ts`, `tests/e2e/r76-captures.spec.ts` |
| FR-FIRST-4 | `src/ui/screens/Home.test.tsx`, `tests/e2e/home.spec.ts`, `tests/e2e/r76-captures.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-FIRST-5 | `tests/e2e/desktop.spec.ts`, `tests/e2e/home.spec.ts`, `tests/styles/breakpoint.test.ts` |
| FR-FIRST-8 | `src/lib/tonightStripe.test.ts`, `src/ui/components/now/TonightStripe.test.tsx` |
| FR-FIRST-9 | `src/ui/components/now/ConditionsTable.test.tsx` |
| FR-FIRST-10 | `src/ui/components/passes/PassCard.test.tsx`, `src/ui/components/passes/PassList.test.tsx`, `tests/e2e/first-run-controls.spec.ts` |
| FR-FIRST-11 | `src/ui/components/location/Favourites.test.tsx`, `src/ui/components/location/WherePlace.test.tsx` |
| FR-FIX-2 | `tests/docs/ci.test.ts` |
| FR-FLAG-1 | `tests/build/flags.test.ts` |
| FR-FLOW-1 | `src/lib/tonightStripe.test.ts`, `src/ui/App.live.test.tsx`, `src/ui/screens/home/HomeDoors.test.tsx`, `src/ui/screens/home/doorLines.test.ts`, `tests/e2e/home.spec.ts`, `tests/styles/doorRows.test.ts` |
| FR-FLOW-2 | `src/ui/components/location/WherePlace.test.tsx` |
| FR-FLOW-3 | `src/ui/App.settings.test.tsx`, `src/ui/App.structure.test.tsx`, `src/ui/components/common/Header.test.tsx`, `src/ui/navigation.test.ts`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/settings.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-FLOW-4 | `src/ui/components/sky/SkyViewLayout.test.tsx`, `tests/e2e/sky-layout.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-FLOW-5 | `src/i18n/messages.test.ts` |
| FR-FLOW-6 | `src/data/localPrefs.test.ts`, `src/ui/components/sky/SkyHint.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/sky-layout.spec.ts` |
| FR-FLOW-7 | `src/ui/components/guide/TimesRow.test.tsx`, `tests/e2e/sky-box.spec.ts`, `tests/e2e/sky-layout.spec.ts` |
| FR-FLOW-9 | `tests/e2e/sky-box.spec.ts` |
| FR-FLOW-10 | `tests/e2e/rhythm.spec.ts` |
| FR-FLOW-11 | `src/ui/components/primitives/OptionToggle.test.tsx`, `src/ui/components/primitives/ToggleGroup.test.tsx`, `tests/e2e/targets.spec.ts`, `tests/styles/targets.test.ts` |
| FR-FLOW-13 | `src/ui/components/guide/skychart/Legend.test.tsx` |
| FR-FLOW-14 | `src/ui/components/guide/skychart/window/SkyWindow.test.tsx`, `src/ui/components/guide/skychart/window/camera.test.ts`, `tests/e2e/sky-layout.spec.ts`, `tests/e2e/sky-window.spec.ts` |
| FR-FLOW-15 | `tests/e2e/sky-layout.spec.ts` |
| FR-FLOW-16 | `tests/docs/captureIds.test.ts` |
| FR-FOL-4 | `src/ui/components/guide/skychart/window/SkyWindow.test.tsx` |
| FR-FOL-5 | `src/ui/components/guide/skychart/window/SkyWindow.follow.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.test.tsx`, `src/ui/components/guide/skychart/window/projection.test.ts`, `src/ui/screens/Stars.test.tsx` |
| FR-FSC-6 | `src/ui/components/guide/skychart/SkyChart.test.tsx`, `src/ui/screens/Live.test.tsx` |
| FR-FSC-10 | `src/ui/components/guide/skychart/window/SkyWindow.follow.test.tsx`, `src/ui/components/guide/skychart/window/followSteadiness.test.ts`, `src/ui/components/guide/skychart/window/projection.test.ts`, `src/ui/components/guide/skychart/window/screenTurn.test.ts`, `src/ui/components/guide/skychart/window/useDeviceOrientation.test.tsx` |
| FR-FULL-1 | `tests/e2e/live-compact.spec.ts`, `tests/e2e/live-full.spec.ts`, `tests/e2e/r48-trajectories.spec.ts` |
| FR-FULL-2 | `src/ui/components/sky/SkyHead.test.tsx`, `tests/e2e/live-states.spec.ts`, `tests/styles/sheetRows.test.ts` |
| FR-FULL-3 | `src/lib/layout.test.ts`, `src/ui/components/sky/ControlsSheet.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/live-full.spec.ts`, `tests/styles/sheetRows.test.ts` |
| FR-FULL-4 | `src/ui/components/sky/ControlsSheet.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/liveRows.test.ts`, `tests/e2e/live-full.spec.ts`, `tests/e2e/r48-trajectories.spec.ts`, `tests/styles/sheetRows.test.ts` |
| FR-FULL-5 | `src/ui/components/sky/ControlsSheet.test.tsx` |
| FR-FULL-6 | `tests/e2e/live-compact.spec.ts`, `tests/e2e/live-states.spec.ts` |
| FR-FULL-7 | `tests/e2e/live-tonight.spec.ts` |
| FR-FULL-8 | `src/ui/components/live/OpeningCard.test.tsx` |
| FR-FULL-10 | `src/lib/tonightJump.test.ts`, `src/ui/components/live/OpeningCard.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/live-tonight.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-GLOBE-1 | `src/ui/screens/StarsGlobe.test.tsx`, `tests/e2e/globe.spec.ts` |
| FR-GLOBE-2 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts`, `src/ui/components/guide/skychart/globe/projection.test.ts` |
| FR-GLOBE-3 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts`, `src/ui/components/guide/skychart/globe/projection.test.ts`, `src/ui/components/guide/skychart/globe/scene.test.ts` |
| FR-GLOBE-4 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts` |
| FR-GLOBE-5 | `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/components/guide/skychart/globe/projection.test.ts` |
| FR-GLOBE-6 | `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/components/guide/skychart/globe/projection.test.ts`, `tests/e2e/globe.spec.ts` |
| FR-GLOBE-7 | `src/ui/screens/StarsGlobe.test.tsx`, `tests/e2e/globe.spec.ts` |
| FR-GLOBE-8 | `src/ui/screens/StarsGlobe.test.tsx`, `tests/e2e/globe.spec.ts` |
| FR-GLOBE-9 | `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/screens/StarsGlobe.test.tsx`, `tests/e2e/globe.spec.ts` |
| FR-GLOBE-10 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts`, `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/screens/Stars.test.tsx`, `src/ui/screens/StarsGlobe.test.tsx` |
| FR-GLOBE-11 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts`, `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/components/guide/skychart/window/starLabels.test.ts`, `tests/e2e/globe.spec.ts` |
| FR-GLOBE-12 | `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/components/guide/skychart/globe/scene.test.ts`, `src/ui/screens/StarsGlobe.test.tsx` |
| FR-GLOBE-13 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts`, `src/ui/components/guide/skychart/globe/scene.test.ts` |
| FR-GLOBE-14 | `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx` |
| FR-GLOBE-15 | `tests/e2e/globe-perf.spec.ts`, `tests/e2e/globe.spec.ts` |
| FR-GLOBE-16 | `src/ui/screens/StarsGlobe.test.tsx`, `tests/e2e/globe.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-GUIDE-1 | `src/lib/phrases.test.ts`, `src/ui/components/guide/GuideText.test.tsx` |
| FR-GUIDE-2b | `src/lib/skyGeometry.test.ts` |
| FR-GUIDE-3 | `src/lib/phrases.test.ts`, `src/ui/components/passes/PassCard.test.tsx` |
| FR-GUIDE-4 | `src/data/localPrefs.test.ts`, `src/lib/skyGeometry.test.ts`, `src/state/slices/prefs.test.ts`, `src/ui/components/guide/skychart/dome/camera.test.ts` |
| FR-GUIDE-6 | `tests/e2e/dome-perf.spec.ts` |
| FR-GYRO-1 | `src/ui/components/sky/FollowToggle.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/follow.spec.ts` |
| FR-GYRO-2 | `src/ui/components/guide/skychart/window/SkyWindow.follow.test.tsx`, `src/ui/components/live/FollowControl.test.tsx`, `src/ui/components/sky/FollowToggle.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/follow.spec.ts` |
| FR-GYRO-3 | `src/ui/components/live/FollowControl.test.tsx`, `src/ui/components/sky/FollowToggle.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/follow.spec.ts` |
| FR-GYRO-4 | `src/ui/components/guide/skychart/window/SkyWindow.follow.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/follow.spec.ts` |
| FR-GYRO-5 | `src/ui/components/guide/skychart/window/SkyWindow.follow.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/follow.spec.ts` |
| FR-GYRO-6 | `src/ui/screens/Live.test.tsx`, `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx` |
| FR-GYRO-7 | `src/ui/components/sky/ControlsSheet.test.tsx`, `tests/e2e/live-full.spec.ts` |
| FR-GYRO-8 | `src/lib/layout.test.ts`, `src/ui/components/sky/ControlsSheet.test.tsx`, `tests/e2e/live-full.spec.ts` |
| FR-GYRO-9 | `src/ui/components/sky/FollowToggle.test.tsx` |
| FR-GYRO-10 | `src/ui/screens/Live.test.tsx` |
| FR-HOME-1 | `tests/e2e/home-desk.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-HOME-2 | `tests/e2e/home-desk.spec.ts` |
| FR-HOME-3 | `tests/e2e/home-desk.spec.ts`, `tests/styles/breakpoint.test.ts` |
| FR-HOME-4 | `tests/e2e/home-desk.spec.ts`, `tests/styles/breakpoint.test.ts` |
| FR-I18N-1 | `src/state/slices/prefs.test.ts`, `src/ui/screens/Settings.test.tsx` |
| FR-I18N-2 | `src/data/moon/lore.test.ts`, `src/i18n/messages.test.ts`, `src/lib/phrases.test.ts`, `src/ui/App.share.test.tsx`, `src/ui/components/common/Countdown.test.tsx`, `src/ui/components/common/Footer.test.tsx`, `src/ui/components/common/InstallHint.test.tsx`, `src/ui/components/common/ShareButton.test.tsx`, `src/ui/components/common/ShortcutsOverlay.test.tsx`, `src/ui/components/common/ThemeToggle.test.tsx`, `src/ui/components/common/UpdateBanner.test.tsx`, `src/ui/components/guide/GuideText.test.tsx`, `src/ui/components/guide/PassNumbers.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.test.tsx`, `src/ui/components/live/PlaybackControls.test.tsx`, `src/ui/components/live/StatusStrip.test.tsx`, `src/ui/components/live/StepControls.test.tsx`, `src/ui/components/live/StripeOverview.test.tsx`, `src/ui/components/live/TimeTrack.test.tsx`, `src/ui/components/location/Favourites.test.tsx`, `src/ui/components/location/UseMyLocation.test.tsx`, `src/ui/components/moon/MoonAtPeak.test.tsx`, `src/ui/components/moon/MoonGlare.test.tsx`, `src/ui/components/moon/MoonLore.test.tsx`, `src/ui/components/weather/CloudBadge.test.tsx`, `tests/e2e/live-landscape.spec.ts`, `tests/e2e/live-playback.spec.ts`, `tests/e2e/live.spec.ts`, `tests/e2e/narrow.spec.ts`, `tests/e2e/share.spec.ts`, `tests/e2e/shortcuts.spec.ts` |
| FR-I18N-3 | `src/data/moon/lore.test.ts`, `src/i18n/messages.test.ts`, `src/ui/components/guide/GuideText.test.tsx` |
| FR-I18N-4 | `src/lib/elementsAge.test.ts`, `src/lib/format.test.ts`, `src/ui/components/guide/PassNumbers.test.tsx`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts` |
| FR-I18N-6 | `src/ui/components/common/Footer.test.tsx`, `src/ui/components/passes/PassList.test.tsx`, `src/ui/components/weather/CloudBadge.test.tsx` |
| FR-JUMP-1 | `src/ui/components/passes/NextEventBlock.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/liveRows.test.ts`, `tests/e2e/live-jump.spec.ts`, `tests/e2e/shapes.spec.ts` |
| FR-JUMP-2 | `src/ui/screens/Live.test.tsx`, `tests/e2e/live-jump.spec.ts` |
| FR-JUMP-3 | `src/ui/components/passes/NextEventBlock.test.tsx` |
| FR-KEEP-1 | `src/data/localPrefs.test.ts`, `src/state/slices/prefs.test.ts` |
| FR-KEEP-3 | `src/model/prefs.test.ts`, `src/state/slices/prefs.test.ts` |
| FR-KEEP-4 | `src/model/prefs.test.ts`, `src/ui/hooks/usePrivacyNote.test.ts` |
| FR-LEG-1 | `src/lib/legend.test.ts`, `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts` |
| FR-LEG-2 | `src/lib/legend.test.ts`, `src/ui/components/guide/skychart/SkyChart.contract.test.tsx` |
| FR-LEG-3 | `src/lib/legend.test.ts`, `src/ui/components/guide/skychart/Legend.test.tsx`, `src/ui/components/guide/skychart/SkyChart.contract.test.tsx` |
| FR-LEG-4 | `src/lib/legend.test.ts`, `src/ui/screens/Stars.test.tsx` |
| FR-LEG-7 | `src/ui/screens/Live.test.tsx` |
| FR-LIVE-1 | `src/lib/shareLinks.test.ts`, `src/ui/App.live.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/live.spec.ts`, `tests/e2e/shapes.spec.ts`, `tests/e2e/shortcuts.spec.ts`, `tests/e2e/stars.spec.ts` |
| FR-LIVE-2 | `src/lib/legend.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/screens/Live.test.tsx` |
| FR-LIVE-3 | `src/ui/screens/Live.test.tsx` |
| FR-LIVE-4 | `src/lib/timeStripe.test.ts`, `tests/e2e/live-playback.spec.ts` |
| FR-LIVE-5 | `tests/e2e/live-perf.spec.ts`, `tests/e2e/live-playback.spec.ts` |
| FR-LIVE-5s | `src/lib/playback.test.ts` |
| FR-LIVE-6 | `src/data/localPrefs.test.ts`, `src/lib/legend.test.ts`, `src/physics/now.test.ts`, `src/state/slices/prefs.test.ts`, `src/state/workerClient.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/components/guide/skychart/polar/SkyPolar.test.tsx`, `src/worker/handlers.test.ts`, `tests/e2e/live-playback.spec.ts` |
| FR-LIVE-7 | `src/ui/components/live/useWakeLock.test.tsx`, `tests/e2e/live-landscape.spec.ts`, `tests/e2e/shapes.spec.ts` |
| FR-LIVE-8 | `src/ui/components/guide/skychart/window/useDeviceOrientation.test.tsx` |
| FR-LIVE-9 | `src/lib/shareLinks.test.ts`, `src/ui/screens/Live.test.tsx`, `tests/e2e/live-playback.spec.ts`, `tests/e2e/live-states.spec.ts`, `tests/e2e/live.spec.ts` |
| FR-LIVE-10 | `src/ui/screens/Live.test.tsx` |
| FR-LIVE-11 | `src/state/effects.test.ts` |
| FR-LOC-2 | `src/ui/components/location/PlacePicker.test.tsx` |
| FR-LOC-3 | `src/lib/timeFormat.test.ts`, `src/state/effects.test.ts` |
| FR-LOC-5 | `tests/e2e/visit.spec.ts` |
| FR-LOOK-1 | `src/ui/components/guide/skychart/window/skySurface.test.ts`, `tests/styles/tokens.test.ts` |
| FR-LOOK-2 | `src/ui/components/guide/skychart/window/skySurface.test.ts` |
| FR-LOOK-3 | `src/ui/components/guide/skychart/window/milkyWay.test.ts` |
| FR-LOOK-4 | `src/ui/components/guide/skychart/window/starGlyphs.test.ts` |
| FR-LOOK-5 | `src/ui/components/guide/skychart/window/starGlyphs.test.ts`, `tests/styles/tokens.test.ts` |
| FR-LOOK-6 | `src/ui/components/guide/skychart/window/bloom.test.ts` |
| FR-LOOK-7 | `src/ui/components/guide/skychart/window/MoonDisc.test.tsx` |
| FR-LOOK-8 | `tests/e2e/window-zoom.spec.ts` |
| FR-LOOK-9 | `src/ui/components/guide/skychart/window/deepField.test.ts` |
| FR-LOOK-11 | `tests/e2e/stars-perf.spec.ts` |
| FR-MARK-5 | `src/ui/components/mark/Mark.test.tsx`, `src/ui/screens/Live.test.tsx` |
| FR-MARK-6 | `tests/build/mark-icons.test.ts`, `tests/build/mark-rasters.test.ts` |
| FR-MARK-8 | `src/ui/components/mark/Mark.raster.test.ts`, `tests/build/mark-icons.test.ts` |
| FR-MOON-1 | `src/data/moon/lore.test.ts` |
| FR-MOON-2 | `src/lib/moonPhrases.test.ts`, `src/physics/moon.test.ts`, `src/ui/components/moon/MoonGlare.test.tsx`, `src/ui/components/passes/PassCard.test.tsx`, `src/ui/screens/PassDetail.test.tsx` |
| FR-MOON-3 | `src/lib/moonPhrases.test.ts`, `src/physics/now.test.ts`, `src/ui/components/guide/skychart/SkyChart.test.tsx`, `src/ui/components/now/ConditionsTable.test.tsx` |
| FR-MOON-4 | `src/data/moon/lore.test.ts`, `src/lib/moonPhrases.test.ts`, `src/physics/moon.test.ts`, `src/ui/components/moon/MoonLore.test.tsx` |
| FR-MOON-5 | `src/data/moon/lore.test.ts`, `src/lib/moonPhrases.test.ts`, `src/ui/components/moon/MoonLore.test.tsx` |
| FR-NAME-1 | `tests/data/starCatalog.test.ts` |
| FR-NAME-2 | `tests/data/starCatalog.test.ts` |
| FR-NAME-3 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts`, `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `tests/styles/tokens.test.ts` |
| FR-NIGHT-1 | `src/ui/screens/home/tonight.test.ts` |
| FR-NIGHT-2 | `src/ui/components/passes/PassList.test.tsx`, `src/ui/components/passes/nightGroups.test.ts` |
| FR-NIGHT-3 | `src/state/effects.test.ts` |
| FR-NIGHT-4 | `src/state/effects.test.ts` |
| FR-OFF-1 | `src/ui/components/common/UpdateBanner.test.tsx` |
| FR-OFF-2 | `src/state/effects.test.ts` |
| FR-OFF-3 | `src/data/weatherCache.test.ts`, `src/lib/cloudVerdict.test.ts` |
| FR-OFF-4 | `src/i18n/messages.test.ts`, `src/ui/components/common/ReadinessLine.test.tsx`, `src/ui/components/elements/ElementsLine.test.tsx`, `tests/e2e/offline.spec.ts` |
| FR-OFF-5 | `src/state/effects.test.ts` |
| FR-OFF-6 | `src/data/localPrefs.test.ts`, `src/lib/installSnooze.test.ts`, `src/state/slices/prefs.test.ts`, `src/ui/components/common/InstallHint.test.tsx`, `tests/deploy/manifest.test.ts` |
| FR-OFF-7 | `src/data/localPrefs.test.ts`, `src/state/effects.test.ts`, `src/ui/components/location/Favourites.test.tsx` |
| FR-OFF-8 | `src/ui/screens/Live.test.tsx`, `tests/e2e/live-failures.spec.ts`, `tests/e2e/offline.spec.ts` |
| FR-PHONE-1 | `src/ui/components/sky/FollowToggle.test.tsx`, `src/ui/components/sky/useFollow.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/follow.spec.ts` |
| FR-PHONE-2 | `src/data/localPrefs.test.ts`, `src/ui/components/sky/useFollow.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/follow.spec.ts` |
| FR-PHONE-3 | `src/lib/layout.test.ts`, `src/ui/components/live/FollowControl.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/live-full.spec.ts`, `tests/styles/sheetRows.test.ts` |
| FR-PHONE-4 | `src/ui/screens/Live.test.tsx`, `tests/e2e/live-full.spec.ts` |
| FR-PHONE-5 | `src/lib/layout.test.ts`, `src/ui/components/sky/SkyHint.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/live-full.spec.ts` |
| FR-PHONE-6 | `src/ui/components/live/useWakeLock.test.tsx`, `src/ui/screens/PassDetail.test.tsx`, `src/ui/screens/Stars.test.tsx` |
| FR-PHONE-7 | `src/ui/screens/Stars.test.tsx`, `src/ui/screens/stars/field.test.ts`, `tests/e2e/whole-sky.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-PHONE-8 | `src/ui/screens/Stars.test.tsx` |
| FR-PHONE-9 | `src/ui/components/guide/skychart/polar/SkyPolar.handoff.test.tsx`, `src/ui/components/guide/skychart/polar/fieldOutline.test.ts`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/whole-sky.spec.ts` |
| FR-PHONE-10 | `src/ui/components/guide/skychart/polar/SkyPolar.handoff.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.handoff.test.tsx`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/whole-sky.spec.ts` |
| FR-PHONE-11 | `src/ui/components/guide/skychart/layers.test.ts` |
| FR-PHONE-12 | `src/ui/screens/Home.test.tsx`, `tests/e2e/sky-layout.spec.ts` |
| FR-PHONE-14 | `src/ui/components/guide/TimesRow.test.tsx`, `tests/e2e/sky-layout.spec.ts` |
| FR-PUB-1 | `tests/docs/public.test.ts` |
| FR-PUB-2 | `tests/docs/public.test.ts` |
| FR-PUB-3 | `tests/docs/public.test.ts` |
| FR-PUB-4 | `tests/docs/public.test.ts` |
| FR-PUB-5 | `tests/docs/public.test.ts` |
| FR-PUB-6 | `tests/docs/public.test.ts` |
| FR-PUB-7 | `tests/docs/public.test.ts` |
| FR-PUB-8 | `tests/docs/public.test.ts` |
| FR-PUB-10 | `tests/docs/public.test.ts` |
| FR-PUB-11 | `tests/docs/public.test.ts` |
| FR-PUB-12 | `tests/docs/trailers.test.ts` |
| FR-PUB-13 | `tests/docs/trailers.test.ts` |
| FR-ROUTE-1 | `src/ui/App.structure.test.tsx`, `tests/e2e/structure.spec.ts` |
| FR-ROUTE-3 | `tests/e2e/structure.spec.ts` |
| FR-SAT-1 | `src/data/catalog/catalog.test.ts` |
| FR-SAT-2 | `src/data/celestrak.test.ts` |
| FR-SAT-3 | `src/data/celestrak.test.ts` |
| FR-SAT-4 | `src/data/elementsLoader.test.ts`, `src/lib/elementsAge.test.ts`, `src/ui/components/elements/ElementsBanners.test.tsx`, `src/ui/components/elements/ElementsLine.test.tsx`, `tests/docs/promo.test.ts`, `tests/docs/showcase.test.ts` |
| FR-SAT-5 | `src/data/catalog/catalog.test.ts`, `src/data/moon/lore.test.ts` |
| FR-SAT-6 | `src/data/elementsLoader.test.ts`, `src/state/effects.test.ts`, `src/ui/components/elements/ElementsBanners.test.tsx` |
| FR-SDD-1 | `tests/sdd/ledger.test.ts`, `tests/sdd/session.test.ts` |
| FR-SDD-2 | `tests/sdd/agents.test.ts`, `tests/sdd/ledger.test.ts`, `tests/sdd/session.test.ts` |
| FR-SDD-3 | `tests/sdd/split.test.ts` |
| FR-SDD-4 | `tests/sdd/check-sdd.test.ts`, `tests/sdd/rewrap.test.ts` |
| FR-SDD-5 | `tests/sdd/split.test.ts` |
| FR-SDD-6 | `tests/sdd/check-sdd.test.ts`, `tests/sdd/ids.test.ts` |
| FR-SDD-7 | `tests/sdd/brief.test.ts`, `tests/sdd/rewrap.test.ts`, `tests/sdd/split.test.ts` |
| FR-SDD-8 | `tests/docs/sdd-workflows.test.ts`, `tests/sdd/check-sdd.test.ts` |
| FR-SDD-9 | `tests/docs/accuracy.test.ts`, `tests/docs/sdd-workflows.test.ts`, `tests/sdd/check-sdd.test.ts`, `tests/sdd/review.test.ts` |
| FR-SDD-10 | `tests/sdd/agents.test.ts`, `tests/sdd/check-sdd.test.ts`, `tests/sdd/cli.test.ts`, `tests/sdd/session.test.ts`, `tests/sdd/tasks.test.ts` |
| FR-SDD-11 | `tests/sdd/agents.test.ts`, `tests/sdd/cli.test.ts`, `tests/sdd/tasks.test.ts` |
| FR-SDD-12 | `tests/docs/sdd-ignore.test.ts` |
| FR-SDD-13 | `tests/sdd/check-sdd.test.ts` |
| FR-SDD-14 | `tests/docs/sdd-ignore.test.ts`, `tests/sdd/check-sdd.test.ts` |
| FR-SDD-15 | `tests/sdd/check.test.ts` |
| FR-SDD-16 | `tests/sdd/ci-digest.test.ts`, `tests/sdd/cli.test.ts`, `tests/sdd/git.test.ts`, `tests/sdd/review.test.ts` |
| FR-SDD-17 | `tests/sdd/brief.test.ts` |
| FR-SDD-18 | `tests/sdd/review.test.ts` |
| FR-SDD-19 | `tests/sdd/check-sdd.test.ts` |
| FR-SDD-20 | `tests/sdd/check-sdd.test.ts`, `tests/sdd/git.test.ts` |
| FR-SDD-21 | `tests/docs/sdd-workflows.test.ts` |
| FR-SDD-22 | `tests/docs/captures.test.ts`, `tests/docs/ci.test.ts`, `tests/sdd/check-sdd.test.ts` |
| FR-SDD-23 | `tests/captures/diff.test.ts` |
| FR-SDD-24 | `tests/sdd/check-sdd.test.ts`, `tests/sdd/phase-report.test.ts`, `tests/sdd/traceability.test.ts` |
| FR-SDD-25 | `tests/docs/ci.test.ts` |
| FR-SDD-27 | `tests/sdd/prune-merged-branches.test.ts` |
| FR-SDD-28 | `tests/sdd/phase-report.test.ts` |
| FR-SET-1 | `src/ui/screens/Settings.test.tsx`, `tests/e2e/settings.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-SET-2 | `tests/e2e/settings.spec.ts` |
| FR-SET-3 | `src/ui/components/location/WherePlace.test.tsx` |
| FR-SET-5 | `src/ui/components/guide/skychart/SkyChart.test.tsx`, `src/ui/screens/Settings.test.tsx` |
| FR-SHARE-1 | `src/ui/screens/Live.test.tsx`, `src/ui/screens/passSelection.test.ts` |
| FR-SHARE-3 | `src/lib/shareLinks.test.ts`, `src/ui/App.share.test.tsx`, `src/ui/App.structure.test.tsx` |
| FR-SHOW-1 | `tests/docs/accuracy.test.ts`, `tests/docs/public.test.ts` |
| FR-SHOW-2 | `tests/docs/accuracy.test.ts` |
| FR-SHOW-3 | `tests/docs/accuracy.test.ts`, `tests/docs/hygiene.test.ts`, `tests/docs/public.test.ts` |
| FR-SHOW-6 | `tests/docs/promo.test.ts` |
| FR-SHOW-9 | `tests/docs/showcase.test.ts` |
| FR-SHP-1 | `tests/e2e/shapes.spec.ts`, `tests/styles/liveShape.test.ts` |
| FR-SHP-2 | `tests/e2e/narrow.spec.ts`, `tests/styles/liveShape.test.ts` |
| FR-SHP-3 | `src/lib/foldRows.test.ts`, `tests/e2e/shapes.spec.ts` |
| FR-SHP-4 | `src/ui/components/guide/skychart/dome/camera.test.ts`, `tests/e2e/shapes.spec.ts` |
| FR-SHP-5 | `tests/e2e/shapes.spec.ts` |
| FR-SKY-1 | `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/components/guide/skychart/layers.test.ts`, `src/ui/components/guide/skychart/useSkyScene.test.ts` |
| FR-SKY-2 | `src/ui/components/guide/skychart/SkyChart.fallback.test.tsx`, `src/ui/components/guide/skychart/SkyChart.test.tsx`, `src/ui/screens/Live.test.tsx` |
| FR-SKY-3 | `src/data/localPrefs.test.ts`, `src/lib/landmark.test.ts`, `src/ui/components/live/useStarSource.test.tsx` |
| FR-SKY-4 | `src/ui/components/guide/skychart/window/starGlyphs.test.ts` |
| FR-SKY-5 | `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/components/guide/skychart/dome/palette.test.tsx`, `tests/e2e/dome-perf.spec.ts` |
| FR-SKY-7 | `src/ui/components/guide/skychart/window/camera.test.ts`, `src/ui/screens/PassDetail.test.tsx` |
| FR-SKY-8 | `src/ui/components/guide/skychart/useSkyScene.test.ts`, `src/ui/screens/PassDetail.inert.test.tsx` |
| FR-SKY-10 | `src/ui/components/live/useStarSource.test.tsx`, `tests/docs/accuracy.test.ts` |
| FR-SKY-11 | `src/lib/landmarkLine.test.ts`, `src/ui/components/guide/skychart/layers.test.ts`, `src/ui/components/guide/skychart/useSkyScene.test.ts` |
| FR-SKY-13 | `src/ui/components/guide/skychart/window/camera.test.ts`, `src/ui/components/sky/SkyHint.test.tsx` |
| FR-SKY-14 | `src/ui/components/guide/skychart/window/projection.test.ts` |
| FR-SPAN-1 | `src/lib/timeStripe.test.ts`, `src/ui/components/live/TimeStripe.test.tsx` |
| FR-SPAN-2 | `src/lib/timeStripe.test.ts`, `src/ui/components/live/StripeOverview.test.tsx` |
| FR-SPAN-3s | `src/ui/components/live/StepControls.test.tsx` |
| FR-SPAN-4 | `tests/e2e/live-playback.spec.ts` |
| FR-SPAN-5 | `src/ui/components/live/TimeStripe.test.tsx`, `tests/e2e/live-playback.spec.ts` |
| FR-SPAN-6 | `src/lib/timeStripe.test.ts`, `src/ui/components/live/StripeOverview.test.tsx`, `tests/e2e/live-playback.spec.ts` |
| FR-SPAN-6s | `tests/e2e/live-playback.spec.ts` |
| FR-SPAN-7 | `src/lib/timeStripe.test.ts` |
| FR-STAR-1 | `tests/data/starCatalog.test.ts` |
| FR-STAR-2 | `src/ui/components/guide/skychart/globe/scene.test.ts`, `src/ui/components/guide/skychart/window/skyFrame.test.ts` |
| FR-STAR-3 | `src/lib/routeTitle.test.ts`, `src/ui/components/guide/skychart/window/camera.test.ts`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/stars.spec.ts` |
| FR-STAR-4 | `src/ui/components/common/ShortcutsOverlay.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.test.tsx`, `src/ui/components/guide/skychart/window/camera.test.ts`, `src/ui/screens/Stars.test.tsx`, `tests/e2e/stars.spec.ts` |
| FR-STAR-6 | `src/ui/components/guide/skychart/window/SkyWindow.labels.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.stars.test.tsx`, `src/ui/components/guide/skychart/window/starGlyphs.test.ts`, `src/ui/components/guide/skychart/window/starLabels.test.ts` |
| FR-STAR-7 | `src/ui/components/guide/skychart/globe/GlobeRenderer.test.ts`, `src/ui/components/guide/skychart/window/SkyWindow.labels.test.tsx`, `src/ui/components/guide/skychart/window/starLabels.test.ts`, `src/ui/screens/Stars.test.tsx`, `src/ui/screens/stars/field.test.ts`, `tests/e2e/stars.spec.ts` |
| FR-STAR-8 | `tests/e2e/stars.spec.ts` |
| FR-STAR-9 | `src/ui/components/guide/skychart/window/SkyWindow.stars.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.test.tsx`, `src/ui/components/guide/skychart/window/starGlyphs.test.ts`, `tests/docs/accuracy.test.ts`, `tests/e2e/stars-perf.spec.ts` |
| FR-STAR-10 | `src/ui/screens/Stars.test.tsx`, `src/ui/screens/stars/field.test.ts`, `tests/data/starCatalog.test.ts`, `tests/e2e/stars.spec.ts`, `tests/styles/controlRows.test.ts` |
| FR-STAR-11 | `src/ui/components/guide/skychart/window/SkyWindow.stars.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.test.tsx` |
| FR-STAR-13 | `src/lib/landmark.test.ts`, `src/ui/components/guide/skychart/useSkyScene.test.ts`, `src/ui/components/guide/skychart/window/skySurface.test.ts` |
| FR-STAR-14 | `src/ui/components/guide/skychart/window/starLabels.test.ts` |
| FR-TAB-1 | `tests/e2e/shapes.spec.ts`, `tests/styles/breakpoint.test.ts` |
| FR-TAB-2 | `tests/e2e/shapes.spec.ts`, `tests/styles/breakpoint.test.ts` |
| FR-TAB-3 | `tests/docs/captures.test.ts` |
| FR-THEME-1 | `src/state/slices/prefs.test.ts`, `src/ui/components/guide/skychart/dome/palette.test.tsx`, `tests/e2e/shortcuts.spec.ts`, `tests/styles/tokens.test.ts` |
| FR-THEME-2 | `tests/styles/screenOverlay.test.ts` |
| FR-THEME-3 | `src/ui/components/guide/skychart/polar/SkyPolar.test.tsx`, `tests/styles/tokens.test.ts` |
| FR-TONIGHT-1 | `src/lib/contextLine.test.ts`, `src/lib/tonightJump.test.ts`, `tests/e2e/live-states.spec.ts` |
| FR-TONIGHT-2 | `src/ui/screens/Live.test.tsx`, `tests/e2e/live-tonight.spec.ts` |
| FR-TONIGHT-3 | `src/ui/components/live/TimeTrack.test.tsx` |
| FR-TONIGHT-4 | `src/lib/contextLine.test.ts`, `src/lib/tonightJump.test.ts`, `src/ui/components/live/TimeTaps.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/styles/controlRows.test.ts` |
| FR-TONIGHT-5 | `src/lib/playback.test.ts` |
| FR-TONIGHT-6 | `src/ui/screens/Live.test.tsx`, `tests/e2e/live-compact.spec.ts`, `tests/e2e/live-states.spec.ts`, `tests/e2e/r48-trajectories.spec.ts` |
| FR-TONIGHT-7 | `tests/styles/controlRows.test.ts` |
| FR-TRAJ-1 | `src/lib/arcReveal.test.ts`, `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/components/guide/skychart/globe/arcs.test.ts`, `src/ui/components/live/liveArcs.test.ts`, `src/ui/screens/Live.test.tsx`, `tests/e2e/r48-trajectories.spec.ts` |
| FR-TRAJ-2 | `src/lib/arcReveal.test.ts` |
| FR-TRAJ-3 | `src/lib/arcReveal.test.ts`, `src/lib/legend.test.ts`, `tests/e2e/r48-trajectories.spec.ts` |
| FR-TRAJ-4 | `src/lib/timeStripe.test.ts` |
| FR-TRAJ-5 | `src/lib/timeStripe.test.ts`, `src/ui/components/live/touch.test.ts` |
| FR-VIS-3 | `src/ui/components/guide/PassNumbers.test.tsx` |
| FR-VIS-5 | `src/state/effects.test.ts`, `src/state/slices/prefs.test.ts` |
| FR-VIS-7 | `src/ui/components/passes/PassCard.test.tsx` |
| FR-VISIT-2 | `src/ui/components/common/VisitNotice.test.tsx`, `tests/e2e/visit.spec.ts` |
| FR-VISIT-3 | `src/lib/playback.test.ts`, `src/state/openLink.test.ts`, `src/ui/components/common/VisitNotice.test.tsx`, `tests/e2e/live-failures.spec.ts` |
| FR-VISIT-4 | `src/state/effects.test.ts`, `src/ui/components/common/VisitNotice.test.tsx`, `tests/e2e/visit.spec.ts` |
| FR-WATCH-1 | `src/ui/components/live/PlaybackControls.test.tsx`, `src/ui/screens/Live.test.tsx`, `tests/e2e/live-states.spec.ts` |
| FR-WATCH-2 | `src/lib/playback.test.ts` |
| FR-WATCH-4 | `src/ui/screens/Live.test.tsx`, `src/ui/screens/liveRows.test.ts` |
| FR-WATCH-5 | `src/lib/scrubPlacement.test.ts`, `src/ui/screens/Live.test.tsx`, `tests/e2e/live-states.spec.ts` |
| FR-WATCH-6 | `src/lib/scrubPlacement.test.ts`, `src/ui/components/guide/skychart/ChartFrame.overlay.test.tsx`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/liveRows.test.ts` |
| FR-WATCH-8 | `src/ui/components/live/PlaybackControls.test.tsx` |
| FR-WATCH-9 | `tests/e2e/live-states.spec.ts` |
| FR-WIDE-1 | `src/ui/components/sky/SkyViewLayout.test.tsx`, `tests/e2e/sky-layout.spec.ts`, `tests/e2e/wide.spec.ts` |
| FR-WIDE-2 | `src/data/localPrefs.test.ts`, `src/ui/screens/viewFor.test.ts`, `tests/e2e/sky-layout.spec.ts` |
| FR-WIDE-3 | `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/components/guide/skychart/globe/arcs.test.ts`, `src/ui/components/guide/skychart/layers.test.ts`, `tests/e2e/globe.spec.ts` |
| FR-WIDE-5 | `src/ui/components/sky/SkyViewLayout.test.tsx`, `tests/e2e/sky-layout.spec.ts` |
| FR-WIDE-6 | `tests/e2e/globe.spec.ts` |
| FR-WIDE-7 | `src/ui/components/guide/skychart/globe/SkyGlobe.test.tsx`, `src/ui/components/guide/skychart/globe/arcs.test.ts` |
| FR-WIDE-8 | `src/lib/cloudBand.test.ts` |
| FR-WIDE-11 | `tests/e2e/globe-perf.spec.ts` |
| FR-WIN-3 | `src/ui/components/guide/skychart/window/projection.test.ts` |
| FR-WIN-4 | `src/ui/components/guide/skychart/SkyChart.contract.test.tsx`, `src/ui/components/guide/skychart/SkyChart.test.tsx`, `src/ui/components/guide/skychart/window/SkyWindow.test.tsx`, `src/ui/components/guide/skychart/window/projection.test.ts`, `src/ui/components/live/FollowControl.test.tsx`, `src/ui/components/sky/useFollow.test.tsx`, `tests/e2e/targets.spec.ts`, `tests/e2e/v1-captures.spec.ts` |
| FR-WIN-5 | `src/ui/components/guide/skychart/window/SkyWindow.test.tsx` |
| FR-WIN-7 | `src/ui/components/guide/skychart/window/projection.test.ts` |
| FR-WX-1 | `src/state/effects.test.ts` |
| FR-WX-2 | `src/lib/cloudVerdict.test.ts` |
| FR-WX-3 | `src/ui/components/now/ConditionsTable.test.tsx`, `src/ui/components/passes/PassCard.test.tsx`, `src/ui/components/passes/PassList.test.tsx` |
| FR-WX-4 | `src/lib/cloudVerdict.test.ts` |
| FR-WX-5 | `src/state/effects.test.ts` |
| FR-X-3 | `tests/deploy/headers.test.ts` |
| FR-X-4 | `src/state/effects.test.ts`, `src/ui/components/elements/ElementsBanners.test.tsx`, `tests/e2e/weather.spec.ts` |
| FR-X-5 | `src/ui/components/common/Banner.test.tsx`, `src/ui/components/guide/skychart/dome/domeGeometry.test.ts`, `src/ui/components/guide/skychart/dome/domeLayers.test.ts`, `src/ui/screens/Live.test.tsx`, `src/ui/screens/PassDetail.test.tsx`, `tests/e2e/settings.spec.ts` |
| US-1 | `src/ui/components/location/LocationInput.test.tsx`, `src/ui/components/location/PlacePicker.test.tsx` |
| US-2 | `src/ui/components/location/CoordsInput.test.tsx` |
| US-3 | `src/ui/components/location/LocationInput.test.tsx`, `src/ui/components/location/UseMyLocation.test.tsx`, `src/ui/components/location/WherePlace.test.tsx`, `src/ui/screens/Home.test.tsx`, `tests/e2e/location.spec.ts` |
| US-4 | `src/state/effects.test.ts` |
| US-5 | `src/data/localPrefs.test.ts`, `src/state/slices/prefs.test.ts`, `src/ui/components/passes/PassCard.test.tsx`, `src/ui/components/passes/PassList.test.tsx`, `src/ui/components/passes/SortToggle.test.tsx`, `tests/e2e/identity.spec.ts` |
| US-6 | `src/data/localPrefs.test.ts`, `src/lib/phrases.test.ts`, `src/state/slices/prefs.test.ts`, `src/ui/components/guide/PassNumbers.test.tsx`, `src/ui/components/guide/skychart/SkyChart.contract.test.tsx`, `src/ui/screens/PassDetail.test.tsx` |
| US-7 | `src/lib/cloudVerdict.test.ts`, `src/state/effects.test.ts`, `src/ui/components/now/ConditionsTable.test.tsx`, `src/ui/components/passes/PassCard.test.tsx`, `src/ui/components/weather/CloudBadge.test.tsx`, `tests/e2e/weather.spec.ts` |
| US-8 | `src/state/slices/prefs.test.ts`, `src/ui/components/location/CoordsInput.test.tsx`, `src/ui/components/location/LocationInput.test.tsx` |
| US-14 | `tests/e2e/shortcuts.spec.ts` |
| US-16 | `src/ui/components/passes/passCursor.test.ts`, `src/ui/screens/home/tonight.test.ts` |
| US-17 | `src/state/effects.test.ts`, `src/state/slices/prefs.test.ts`, `src/ui/components/location/Favourites.test.tsx` |
| US-18 | `src/lib/moonPhrases.test.ts`, `src/ui/components/moon/MoonAtPeak.test.tsx` |
| US-20 | `src/ui/App.settings.test.tsx`, `src/ui/components/common/Header.test.tsx`, `src/ui/screens/Settings.test.tsx`, `tests/e2e/settings.spec.ts` |
| US-21 | `src/ui/components/guide/skychart/window/SkyWindow.test.tsx` |
| US-22 | `tests/e2e/r48-trajectories.spec.ts` |
| US-23 | `src/ui/components/guide/skychart/SkyChart.contract.test.tsx` |
| US-24 | `src/ui/components/live/StripeOverview.test.tsx`, `src/ui/components/live/TimeStripe.test.tsx` |
| US-25 | `tests/e2e/shapes.spec.ts` |
| US-27 | `src/ui/screens/liveRows.test.ts` |
| US-29 | `tests/e2e/settings.spec.ts` |
| US-30 | `src/ui/App.structure.test.tsx`, `tests/e2e/structure.spec.ts` |
| US-32 | `src/state/effects.test.ts` |
| US-34 | `src/ui/components/passes/PassList.faint.test.tsx`, `tests/e2e/faint.spec.ts` |
| US-35 | `tests/e2e/shapes.spec.ts` |
| US-36 | `tests/docs/accuracy.test.ts` |
| US-37 | `tests/docs/design.test.ts` |
| US-38 | `tests/e2e/stars.spec.ts` |
| US-39 | `tests/e2e/stars.spec.ts` |
| US-44 | `src/ui/screens/Live.test.tsx`, `src/ui/screens/PassDetail.test.tsx` |
| US-51 | `tests/docs/accuracy.test.ts`, `tests/sdd/check-sdd.test.ts`, `tests/sdd/ids.test.ts` |
