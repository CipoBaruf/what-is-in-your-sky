## 4. Project Structure

```
what-is-in-your-sky-right-now/          # redrawn from `git ls-files` at 498a0ca (2026-11-03; first drawn at 2b6ff66 for P3, FR-SHOW-1); a number in brackets is that directory's tracked files, tests included
├── SPEC.md  PLAN.md  TASKS.md          # the three documents (§16); beside them README.md, CONTRIBUTING.md, CLAUDE.md, LICENSE
├── package.json  package-lock.json  .node-version   # Node 24, the version CI and the Cloudflare build use
├── vite.config.ts  vitest.config.ts  playwright.config.ts  eslint.config.js  knip.json
├── tsconfig.json  tsconfig.base.json  tsconfig.app.json  tsconfig.node.json
├── index.html  wrangler.jsonc  .gitignore   # wrangler.jsonc: Cloudflare Workers static assets, the `routes` entry that binds inyoursky.app (D-12 amended, D-658)
├── .claude/                            # public on purpose (FR-SHOW-3, D-651)
│   ├── settings.json                   # one allow rule, `gh pr merge`, for the driver's merge step
│   └── skills/                         # sdd-spec, sdd-breakdown, sdd-implement, visual-review — one SKILL.md each
├── .github/workflows/  (4)             # ci.yml (four e2e shards, the trailers job, the dead-code job; the tests a change reaches, D-1031), captures.yml (the v1-* set), live-contract.yml (scheduled, non-blocking), stage.sh
├── public/  (8)                        # _headers (CSP and cache headers, §11), manifest.webmanifest, favicon.svg / favicon.png / favicon-32.png, icon-192.png / icon-512.png, third-party-notices.txt (FR-PUB-5)
├── data-src/stars/                     # the source tables scripts/build-stars.ts reads (the Bright Star Catalogue, the constellation lines, the names), with their licences
├── src/
│   ├── main.tsx  vite-env.d.ts
│   ├── model/  (12)                    # shared types only, zero imports: catalog, elements, observer, pass, place, weather, thresholds, prefs, moon, offline
│   ├── physics/  (27)                  # pure functions, the thing Task Zero validates (§10), a test beside each: constants, time, sgp4, frames, sun, shadow, magnitude, moon, visibility, passes, darkness, now
│   ├── worker/  (8)                    # protocol.ts (§6), handlers.ts (pure, testable in Node), nights.ts (D-77, D-95), passes.worker.ts
│   ├── i18n/  (29)                     # en.ts / es.ts and their en/, es/ parts (chart, failure, home, live, sheet, stars, starsPage, track, ui, window); messages.ts, locale.ts, useT.ts, starsPageT.ts (FR-I18N-1..6, D-69); a missing Spanish key is a tsc error
│   ├── data/  (45)                     # catalog/ (catalog.json, schema.ts), moon/ (lore.json, schema.ts), openMeteo/ (geocode, forecast, schemas), stars/ (the star, constellation, deep-sky and Milky Way tables), places/ (the offline nearest-town table, D-1025); zod.ts (the only importer of zod, D-26), schemas.ts, db.ts (D-105), celestrak.ts, elementsCache.ts, elementsLoader.ts, passesCache.ts, weatherCache.ts, storage.ts, favourites.ts, localPrefs.ts
│   ├── state/  (29)                    # store.ts and slices/; effects.ts, failure.ts, hash.ts, liveNow.ts, moonLore.ts, openLink.ts, passWindow.ts, serviceWorker.ts, workerClient.ts, deviceName.ts
│   ├── lib/  (76)                      # presentation helpers, pure, one module per question with its test beside it: compass, phrases, format, passSort, cloudVerdict, skyGeometry, skyBodies (its own chunk, D-148), shareLinks, layout, shortcuts, moonPhrases, readiness, flags, legend, timeStripe, arcReveal, installSnooze, declination, nextEvent, tonightStripe, passPath, moonNote, faint, nights, playback, routeTitle, …
│   └── ui/
│       ├── App.tsx  Shell.tsx  RootBoundary.tsx  navigation.ts   # and their .module.css
│       ├── screens/  (51)              # Home.tsx and home/ (the doors and the steps of the first run, FR-FIRST-1..11), PassDetail.tsx, Live.tsx + LiveRoute.ts + liveRows.ts, Stars.tsx + StarsRoute.ts + stars/ + starsChunk.ts, Settings.tsx + SettingsRoute.tsx + settingsChunk.ts, passSelection.ts (hash ↔ selected pass, D-13/D-33)
│       ├── components/
│       │   ├── primitives/  (38)       # *(v2.3, D-703)* the primitives, one .tsx + .module.css each (twelve at this commit), manifest.ts and its test; OptionToggle and SectionHeading moved here from common/
│       │   ├── common/  (39)           # Header, Footer (the attributions, FR-X-2), Banner, Countdown, FailureLine (FR-FAIL), InstallAction + InstallHint + installEnv + installOffer, LanguageToggle, ThemeToggle, ReadinessLine, ShareButton, ShortcutsOverlay, UpdateBanner, VisitNotice
│       │   ├── elements/  (5)          # ElementsBanners, ElementsLine
│       │   ├── location/  (19)         # LocationInput, PlacePicker, CoordsInput, UseMyLocation, Favourites, ClearSavedLocation, WherePlace
│       │   ├── now/  (7)               # ConditionsTable, TonightStripe, useTonight (FR-FIRST-8, FR-FIRST-9)
│       │   ├── passes/  (20)           # PassList, PassCard, NextEventBlock, OpenGuide, SortToggle, FaintToggle, ListFailure, nightGroups.ts (D-146), passCursor.ts (D-165)
│       │   ├── guide/  (109)           # GuideText, PassNumbers, TimesRow, GuidePanel (the wide shell, D-72), and skychart/ below
│       │   ├── guide/skychart/  (98)   # §8 — the isolation boundary: SkyChart.tsx (chooses a view from SKY_CHART_VIEWS, D-55), SkyChart.types.ts, bodies.ts, useSkyBodies.ts, useSkyScene.ts + layers.ts (one scene for every view), ChartFrame (the box, D-187), Legend, LegendSwatch
│       │   │   ├── dome/  (18)         # the ONLY directory that imports @glyphcss/react, lazy in SkyChart.tsx (D-66): SkyDome, camera, bowl, domeGeometry, domeLayers, palette, wiys-braille.otf, __snapshots__/SkyDome.golden.txt (§9.1)
│       │   │   ├── polar/  (9)         # SkyPolar.tsx, the SVG all-sky chart (FR-GUIDE-2b/4), PolarStars, fieldOutline
│       │   │   └── window/  (46)       # lane `window`: SkyWindow, projection, camera, scene, StarField, starLabels, milkyWay, skySurface, useDeviceOrientation, orientationAccess, useViewRotation, screenTurn
│       │   ├── sky/  (17)              # what the sky pages share: SkyViewLayout, SkyHead, ControlsSheet, SkyHint, FollowToggle, useFollow
│       │   ├── live/  (57)             # StatusStrip, StateIndicator, TimeStripe, StripeOverview, StepControls, PlaybackControls, TimeReadout, TimeTrack, TimeTaps, ShownTime, OpeningCard, FollowControl, StarsToggle; the hooks usePlayback, usePageShape, useSkyBands, useWakeLock, useDeclination, useHiddenObjects, useStarSource, useWallThrottle; compassHeading, liveArcs, hiddenObjects, touch
│       │   ├── mark/  (19)             # Mark.tsx, tiers.ts, useBead.ts, rasters.json and the tier snapshots (FR-MARK-1..8, D-438..D-441)
│       │   ├── moon/  (9)              # MoonAtPeak, MoonGlare, MoonLore (FR-MOON)
│       │   └── weather/  (3)           # CloudBadge
│       ├── hooks/  (9)                 # useNow, useLayoutMode (D-72/D-116), useMediaQuery, useOnline (D-147), useShortcuts (D-163/D-167), useOpenerFocus
│       └── styles/  (6)                # tokens.css (*(v2.3)* seven sections, D-700), global.css, primitives.css, theme.ts (the one writer of `data-theme`, D-99), useThemeTick.ts
├── scripts/  (24)
│   ├── sdd-run.ts  sdd/  (7)           # the driver's CLI and its parts: cli, tasks, waves, brief, session, git, report (§16.4)
│   ├── validate-iss.ts                 # Task Zero (§10) — the physics module against the Heavens-Above fixtures, in Node
│   ├── bundle-budget.ts                # gzipped chunk sizes against the §11 budgets, after `vite build` (D-67, D-178)
│   ├── ci-affected.ts                  # the tests a change reaches, for ci.yml (D-1031)
│   ├── check-catalog.ts  contrast.ts  build-stored-run.ts
│   ├── build-stars.ts  build-places.ts # the star tables from data-src/stars/; the offline place table from GeoNames (D-1025)
│   ├── build-mark.ts  build-braille-font.ts   # the mark's rasters and icons (D-438); the braille font the dome renders with
│   ├── mockup-capture.ts               # docs/mockups/*.png
│   ├── readme-hero.ts                  # docs/readme/hero.png and social-preview.png, composed from committed captures (FR-PUB-2, FR-PUB-11, FR-ADDR-4)
│   ├── third-party-notices.ts          # public/third-party-notices.txt from the installed tree (FR-PUB-5)
│   ├── check-trailers.ts               # FR-PUB-12, run by ci.yml's trailers job on a full-history checkout
│   ├── design-guide.ts                 # *(v2.3, D-707)* docs/DESIGN.md from tokens.css and primitives/manifest.ts; tests/e2e/design-captures.spec.ts shoots dev/primitives.html
│   └── prune-merged-branches.ts        # FR-PUB-13
├── dev/  (3)                           # *(v2.3, D-706)* primitives.html + primitives.tsx, served by `vite`, never built: every primitive in both themes
├── playwright.design.config.ts         # *(v2.3, D-706)* the dev page's capture config, web server `vite` itself
├── spike/  (57)                        # dev-only Vite pages, kept as the record of what was tried: the R14 glyphcss spike at the root, bundle/, dome-composition/ (FR-DOME-8, the first v1 task), mark/ (D-438), window/ (FR-WIN-7, the first v1.1 task), stars/ (the v2.4 spike, R111)
├── tests/
│   ├── fixtures/  (36)                 # omm/ (recorded CelesTrak JSON, dated), heavens-above/ (hand-transcribed pass tables, dated, with its README), open-meteo/ (recorded geocode and forecast responses), stars/, reference-values.json, stored-run-{neuquen,bariloche,london}.json, guide-sentences.json
│   ├── e2e/  (123)                     # Playwright: 112 specs and 11 helpers; captureSet.ts names the v1-* release set, v1-captures.spec.ts shoots it (D-179)
│   ├── docs/  (11)                     # claims about the repository as tests: accuracy, captureIds, captures, ci, ci-affected, design, hygiene, promo, public, showcase, trailers (D-368, D-650)
│   ├── deploy/  (3)                    # `_headers` pinned to §11 (D-25), the manifest, wrangler.jsonc
│   ├── build/  (3)                     # the built output: the flag, the mark's icons and rasters
│   ├── data/  (1)                      # the generated star catalog
│   ├── styles/  (16)                   # the tokens.css contrast table (D-50), the breakpoint, control rows counted in cells; *(v2.3)* literals.test.ts + literals.allow.json (D-701), breakpoints.json (D-702)
│   ├── live/  (3)                      # the scheduled contract run against CelesTrak and Open-Meteo (live-contract.yml), never part of `npm test`
│   ├── sdd/  (7)                       # the driver's own tests, with a sample TASKS.md under fixtures/
│   ├── setup/  (3)  support/  (12)     # fake-indexeddb, MSW, the two Vitest setups; shared fixtures and helpers
│   └── spike/  (1)
└── docs/  (1337)
    ├── HOW-THIS-WAS-BUILT.md  RELEASE.md  DEPLOY.md   # the reading order (FR-PUB-3), the release checklist, the owner's deploy runbook (V13-16)
    ├── DESIGN.md                       # *(v2.3, D-707)* generated by scripts/design-guide.ts, held by tests/docs/design.test.ts
    ├── readme/  (2)                    # hero.png, social-preview.png
    ├── screenshots/  (1078)            # the v1-* release set (420) and the per-task captures (FR-COMP-6, D-179); *(v2.3)* design/ (4, D-706)
    ├── mockups/  (11)                  # the two owner-approved references (FR-DESK-5, FR-COMP-6)
    └── dome-composition/  (107)  spike-glyphcss/  (80)  window/  (13)  stars/  (42)   # the four spikes' findings, rasters, measurements and captures
```

Ignored and never tracked (D-651): `node_modules/`, `dist/`, `coverage/`, `test-results/`, `playwright-report/`, `logs/`, `.sdd-cache/`, `sdd-run/`, `redesign/`, `promo/`.

Unit tests are co-located (`*.test.ts` beside the source).
`tests/` holds fixtures, e2e, and shared setup.

**v2.6 additions** *(FR-FLOW)*

```
src/ui/components/sky/SkyViewLayout.tsx (+ .module.css, .test.tsx)   # D-842: the one order, compact column / wide box + rail
src/ui/components/sky/SkyHint.tsx (+ test)                           # D-848
src/ui/components/guide/TimesRow.tsx (+ test)                        # D-849
src/ui/screens/home/HomeDoors.tsx (+ .module.css, .test.tsx)         # D-843
src/ui/screens/home/doorLines.ts (+ test)                            # D-843, pure
src/ui/styles/primitives.css                                         # .target, .target-row (D-851)
tests/e2e/rhythm.spec.ts, tests/e2e/targets.spec.ts                  # D-851
removed: src/ui/screens/home/StarsLine.tsx, src/ui/components/location/WhereDome.tsx (+ css)
```

**v2.10 additions** *(FR-PHONE, FR-LOOK)*

```
src/ui/components/sky/useFollow.ts (+ test)                          # D-962: one hook for following on the three pages
src/ui/components/live/FollowControl.tsx (+ .module.css, .test.tsx)  # D-964: `[ follow ]` in the overlay's bottom row
src/ui/components/guide/skychart/polar/fieldOutline.ts (+ test)      # D-969, pure
src/ui/components/guide/skychart/window/skySurface.ts (+ test)       # D-974, pure: the surface, the band, the tint
src/ui/components/guide/skychart/window/milkyWay.ts (+ test)         # D-974: the three rings projected and clipped
src/ui/components/guide/skychart/window/bloom.ts                     # D-974
src/ui/components/guide/skychart/window/MoonDisc.tsx (+ test)        # D-974: the lit limb
src/ui/components/guide/skychart/window/fieldDetail.ts (+ test)      # D-974, pure: the row for a field
src/ui/components/guide/skychart/window/deepField.ts (+ test)        # D-974: the node pool
src/data/stars/deep.json, src/data/stars/milkyWay.json              # D-973: build outputs, committed
src/data/stars/deepChunk.ts                                          # D-973: the lazy `stars-deep` chunk
src/ui/styles/theme.ts (resolveTheme)                                # D-972
tests/e2e/whole-sky.spec.ts                                          # the view row, the outline, the handoff (§9.12)
```

**v2.11 additions** *(FR-CLEAN)*

```
src/ui/components/sky/ControlsSheet.tsx (+ .module.css, .test.tsx)   # D-996: moved from components/live/, the three pages' sheet
src/ui/components/sky/SkyHead.tsx (+ .module.css, .test.tsx)         # D-996: moved from components/live/, `line` as a prop
tests/e2e/clean-sky.spec.ts                                          # D-1001
removed: SkyViewLayout's `column` shape and compact `rail`, DETAIL_DRAWING_TOP_PX, DOME_COMPACT_SLACK_PX (D-1000)
```

*(v0.21, D-1057)* v2.13 adds no file under `src/`:

```
AGENTS.md, CLAUDE.md (@AGENTS.md), .ignore, sdd.agents.json        # FR-SDD-8, FR-SDD-10, FR-SDD-14
docs/sdd/{decisions,ids,gotchas,map,archive.json}                   # FR-SDD-5, -6, -12, -14, -26
docs/sdd/phases/<version>/{spec,plan,tasks}.md                      # FR-SDD-3
docs/sdd/reference/*.md, docs/sdd/workflows/*.md                    # FR-SDD-3, FR-SDD-9, FR-SDD-24
scripts/sdd/{ledger,split,splitMap,rewrap,ids,agents,review,limits,traceability}.ts
scripts/{check,check-sdd,ci-digest,sdd-map,prune-merged-branches}.ts
scripts/captures/{manifest.json,diff.ts,compress.ts}
moved off main: docs/screenshots/v1-* (captures branch), spike/ and the evidence folders (archive branch)
```

---
