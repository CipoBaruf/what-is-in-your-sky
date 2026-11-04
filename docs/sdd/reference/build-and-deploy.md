## 11. Build, Deploy, Tooling

- **Vite** with `@vitejs/plugin-react`; worker bundled by Vite's native worker support; `build.target = 'es2022'`.
- **TypeScript** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **ESLint** flat config: `typescript-eslint` strict, `react-hooks`, `import` with the boundary rules from §3, `no-restricted-globals` for `Date` in the deterministic directories.
- **Cloudflare Workers static assets** (D-12 as amended in §2.5; `wrangler.jsonc` at the root, no Worker script).
  *(v2.2, D-658)* The public origin is `https://inyoursky.app`, a custom domain bound by a `routes` entry the deploy applies; `in-your-sky.ezequiel-baruf.workers.dev` serves the same build and carries the branch previews.
  `public/_headers`:

  ```
  /*
    Content-Security-Policy: default-src 'self'; connect-src 'self' https://celestrak.org https://api.open-meteo.com https://geocoding-api.open-meteo.com; img-src 'self' data:; manifest-src 'self'; worker-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: geolocation=(self)
  /assets/*
    Cache-Control: public, max-age=31536000, immutable
  ```

  The block above is what production serves today, and the deploy test (D-25) pins `public/_headers` to it verbatim — so the block and the file always change in the same commit, and this plan can never promise a header the site is not sending.

  *(v1, D-75)* Two directives are added, each by the task that needs it, each editing the block and `public/_headers` together:

  | Directive | Added by | Why |
  |---|---|---|
  | `style-src-attr 'unsafe-inline'` | the layered-dome task | glyphcss writes inline `style` attributes to colour glyphs (V1-4, FR-DOME-2). This is the **only** relaxation of the MVP policy. |
  | `manifest-src 'self'` | the PWA task | the web manifest (FR-OFF-6). Not a relaxation — it names our own origin. |

  `style-src-elem` and `script-src` stay `'self'`, and the deploy test gains an assertion on those two directives specifically, so a later "just add unsafe-inline" cannot ride in on an unrelated PR.
  The service worker needs no directive of its own: `worker-src 'self'` already covers it.

- **CI** (`ci.yml`): typecheck → lint → unit + golden + component → build → Playwright.
  **`live-contract.yml`**: daily, `LIVE=1`, never blocks merges; opens an issue on failure.
  *(v1.1, D-195)* `ci.yml` runs under a 10 min `timeout-minutes` with a stage-time table in the step summary (FR-CI-1); **`captures.yml`** runs the D-179 capture set with `CAPTURES=1` on pushes to `main` and on dispatch, uploads the PNGs as an artefact and never commits (FR-CI-2).
  Build-time env: `VITE_MOON_LORE` (`on` | `off`, default `off`, D-183), printed by the build.
- *(v2.0, D-438, D-440)* **The mark's build step.**
  `npm run build:icons` runs `scripts/build-mark.ts`, which drives the page under `spike/mark/` with Playwright, writes `src/ui/components/mark/rasters.json` and renders `public/icon-192.png`, `public/icon-512.png` and `public/favicon.png` from the same text.
  It runs on demand, not in `npm run build`: its output is committed, and `tests/build/mark-rasters.test.ts` (D-458) re-runs the generator in CI and fails when the committed file differs, which is the check that keeps the asset and the scene together.
  `scripts/build-icons.ts` is deleted with D-127's drawing.
- *(v2.3, D-706, D-707)* **The dev page and the guide.**
  `dev/primitives.html` is served by `npm run dev` and is not an input of `vite build`; `npm run design:captures` shoots it through `playwright.design.config.ts` (web server `vite`, not `vite preview`) into `docs/screenshots/design/`; `npm run design:guide` writes `docs/DESIGN.md`, and `tests/docs/design.test.ts` fails CI when the committed file differs from a fresh run.
  `captures.yml` runs the design captures after the set.
  **Browser floor** (V23-10, D-702): the stylesheets use media-query range syntax, so the floor is Safari 16.4, Chrome 104, Firefox 63; nothing in `build.target` or the polyfill set changes.
- **Bundle budget:** main chunk ≤ 150 KB gzipped **excluding the sky-chart chunk**; the sky-chart chunk (`@glyphcss/react` + `@glyphcss/core` + `dome/`) is code-split behind `React.lazy` in `SkyChart.tsx` and budgeted at ≤ 100 KB gzipped (R14 measured 97 KB; the 60 KB planned before the spike is not reachable from outside the library, D-63); worker chunk (satellite.js + astronomy-engine) ≤ 120 KB gzipped, loaded once.
  Checked by `npm run bundle:budget` (`scripts/bundle-budget.ts`, D-67) after the build in CI, as a warning; `BUNDLE_STATS=1 npm run build` adds `rollup-plugin-visualizer`'s treemap under `bundle-stats/`.
  Measured by R15: main 109.2 KB, chart 92.9 KB, worker 34.2 KB.

  *(v1)* The budgets are re-set for the new chunks, as the SPEC §9 definition of done requires: **main ≤ 170 KB** gzipped (the second language catalog, the live page's shell, the offline and share code — the live page itself is a lazy route, so only its entry lands here), **chart ≤ 110 KB** (colour and the second scene are configuration, not new dependencies), **live route ≤ 40 KB** as its own lazy chunk, **worker ≤ 130 KB** (the Moon adds no dependency; `astronomy-engine` is already there), **service worker ≤ 15 KB** (Workbox's runtime, outside the main budget by construction) and, from R22, **astronomy ≤ 30 KB** (`lib/skyBodies.ts` and the part of `astronomy-engine` it reaches, split out of the main chunk by the dynamic import of D-148 and fetched once a chart is on screen).
  Both catalogs ship in the main chunk: one language is a few kilobytes of strings, and lazy-loading a language would make the switch flash.

  *(v1, R36, D-178)* Those numbers are the **ceilings** the phase was planned against.
  What `scripts/bundle-budget.ts` now enforces is the 1.0.0 build re-measured and rounded up — main 150 KB, chart 110, worker 40, astronomy 25, live 10, service worker 10 — every one of them inside its ceiling.
  Measured: main 134.7 KB, chart 97.1, worker 36.1, astronomy 22.1, live 6.3, service worker 5.0 (`workbox-*.js`; `sw.js` is 1.0).
  Raise a ceiling here when a feature needs it, then re-measure and re-set the enforced budget the same way.
  *(v1.1, R53, D-274)* Re-set on the 1.1.0 build: main 150 KB, chart 110, worker 40, astronomy 25, live 10, declination 10, window 10, service worker 10, measured main 135.3, chart 97.1, worker 36.1, astronomy 22.1, live 7.6, declination 6.1, window 5.3, service worker 5.0.
  Only the live row moves, from 15 back to the floor.
  *(v1.2, R60, D-307)* Re-set on the 1.2.0 build (built with `VITE_MOON_LORE=on`, as CI's bundle stage does): main 155 KB, chart 105, worker 40, astronomy 25, live 10, declination 10, window 10, service worker 10, measured main 136.6, chart 94.2, worker 36.1, astronomy 22.1, live 8.0, declination 6.1, window 5.9, service worker 5.0.
  Two rows move: chart down to 105 as R57's raster fix and R61's centring together shed 2.9 KB the fit fixes had cost it, and main up to 155 as its measured figure crossed the next rounding line.
  *(v1.3, R65, D-345)* Re-set on the 1.3.0 build, built the same way: main 155 KB, chart 105, worker 40, astronomy 25, window 15, live 10, service worker 10, measured main 137.9, chart 94.2, worker 36.1, astronomy 22.1, window 12.0, live 7.4, service worker 5.0.
  One row moves and one row goes: the window's budget follows its chunk to 15 because v1.3.1 left it as the only caller of `useDeclination` (D-341), so Vite folds the World Magnetic Model back in — 5.9 + 6.1 = 12.0, neither half grown — and the declination row is deleted with the chunk it matched.
  Main's 137.9 is 1.3 KB above the 1.2.0 build, the sky screen's copy and the third option in the view control, and stays inside 155.
  *(v1.4, R72, D-419)* Re-set on the 1.4.0 build, built the same way: main 155 KB, chart 105, worker 40, astronomy 25, window 15, live 10, service worker 10, measured main 140.1, chart 94.2, worker 36.1, astronomy 22.1, window 11.1, live 8.5, service worker 5.0.
  **No row moves** — the first release re-set where that is true.
  The three chunks the phase touched are the three the task names: `live` grew 1.1 KB (the stripe's chunk and overview, the stepping row, the `[ list (n) ]` control and its panel) and ×1.1 is 9.35, so it holds the 10 KB floor with 1.5 KB left where it had 2.6; `window` measures 11.1 against 12.0 — it was 12.1 before R73, which took the portrait veil and its media query out of the chunk and put the quarter's arithmetic in for less (R68 had taken work out of the render, not code out of the chunk); `chart` is 94.2 for the third phase running, because the legend's move and the shape rules are CSS and live-page code and nothing crossed the `React.lazy` in `SkyChart.tsx`.
  Main's 2.2 KB over 1.3.0 is the phase's strings in both catalogs and the sky screen's layer and turn (R73, v1.4.1).
  `live` is the row to watch in the next phase.
  *(v2.0)* The ceilings are unchanged and no budget is raised: the mark is text and a JSON of text in the **main** chunk — six bodies and 60 sparse bead frames per tier, of the order of a few kilobytes — and glyphcss never reaches it (D-438); the gutter replaces the legend strip in the `window` chunk; the live page's two states are the same components rendered conditionally.
  Main is the row to watch, and the release task re-measures every chunk by the D-178 rule on the 2.0.0 build; a mark that does not fit inside main's 155 KB is a finding for the owner, not a budget raised by the task that spent it.
  *(v2.0, R80, D-495)* Re-measured on the 2.0.0 build, built the same way: main 155 KB, chart 105, worker 40, astronomy 25, window 15, live 10, service worker 10, measured main **158.0**, chart 94.2, worker 36.1, astronomy 22.1, window 12.8, live 8.3, service worker 5.0.
  **No row moves and one row is over.**
  Six rows are the D-178 rule agreeing with the number already there (94.2 × 1.1 = 103.6 under 105; 36.1 × 1.1 = 39.7 under 40; 22.1 × 1.1 = 24.3 under 25; 12.8 × 1.1 = 14.1 under 15; `live` and the service worker under the 10 KB floor); `window` is up 0.7 KB for the gutter that replaced the legend strip inside it, `live` down 0.2 for two states that are the same components rendered conditionally, and `chart` is 94.2 for the fourth phase running.
  `main` is 3.0 KB over its budget, so the sentence above applies as written: the budget stays at 155, the `::warning::` stays in every build log, and the measurement is SPEC §4.20 **F-69**.
  The mark's own cost was measured by building the same tree with `Mark.tsx` stubbed to an empty box: 152.8 KB against 158.0, so the component, the six body rasters and the sparse bead frames are **5.2 KB gzipped (18.0 KB raw)** — 3.0 KB more than main had left for them, and 5.2 of the 17.9 KB the chunk grew over the 1.4.0 build.
  The other 12.7 is board 1B's home screen, the inverted settings page and the phase's copy in both catalogs, whose source alone grew 8.0 KB gzipped over the same span.
  *(v2.1, R100, D-638)* Re-measured on the 2.1.0 build, built the same way: main 155 KB, chart 105, worker 40, astronomy 25, window 15, **live 15**, service worker 10, settings 10, measured main **166.6**, chart 94.2, worker 36.1, astronomy 22.1, window 12.8, live 9.7, service worker 5.0, settings 1.0.
  **One row moves and one row is still over.**
  `live` crosses its floor — 9.7 × 1.1 is 10.7 — for the live page's three states, its landmarks, the Spanish rows, the inventory's clip and `[ see this pass ]`, 1.4 KB over 2.0.0.
  `main` is 8.6 KB over 2.0.0's 158.0: R93's settings chunk took 0.2 KB out of it (D-609) and the phase's shell work put 8.8 in.
  V21-13 decided the 155 KB budget stays, so the number is not raised and F-69 stays open for the owner with R93's breakdown of what main carries (D-609).
  *(v2.1, the owner at the release gate, V21-24, D-641)* Main raised to **170**, the ceiling; F-69 closed.
  *(v2.5, the owner at the release, V25-20, D-841)* Main's ceiling and budget raised to **175**, the next 5 KB line over the 2.5.0 build's 173.0; `window` 30 by the rule.

*(v0.14, D-853)* v2.6 moves no row's ceiling: `main` ≤ 174.5 KB of D-841's 175 with `WhereDome` gone, and `stars` + 0.5 KB at most.
The release re-sets the rows by D-178.
*(R135, V26-14, D-875)* The release measured `main` at 177.5 after D-882, and the owner raised its ceiling and budget to **180**; `chart` 110 and `astronomy` 30 by D-178, the rest unmoved.
*(v0.18, R161, V210-16, D-995)* The release measured `main` at 180.3 and the owner raised its ceiling and budget to **185**; `stars` 35, `window` 15 and `stars-deep` 50 by D-178, the rest unmoved.

### 11.1 Runtime dependencies

| Package | Version | Licence | Purpose | Boundary | Risks |
|---|---|---|---|---|---|
| `react`, `react-dom` | 19.x | MIT | UI | `src/ui`, `src/state` bindings | — |
| `zustand` | 5.x | MIT | Store (D-4) | `src/state` | Low. |
| `satellite.js` | 7.x | MIT | SGP4/SDP4, frames (spec §6.5) | `src/physics` only | OMM field-name compatibility checked in Task Zero. |
| `astronomy-engine` | 2.x | MIT | Sun altitude and vector (D-2) | `src/physics/sun.ts` only | Bundle size in the worker chunk; not tree-shakeable. |
| `geomagnetism` *(v1.1)* | 0.2.0 | Apache-2.0 | Magnetic declination for true-north headings (FR-WIN-3, D-185) | `src/lib/declination.ts` only | CommonJS with `require`d JSON (Vite pre-bundles it); 6.2 KB gzipped in the live chunk; WMM2025 valid to 2029-11, after which the package must be updated. |
| `idb` | 8.x | ISC | IndexedDB wrapper (FR-SAT-6, FR-OFF-2) | `src/data/db.ts`, `elementsCache.ts`, `passesCache.ts` | Low. |
| `zod` | 3.x/4.x | MIT | Response and catalog schemas | `src/data` | Low. |
| **`@glyphcss/react`** (+ `@glyphcss/core`) | **0.1.x** (0.1.6 at time of writing) | MIT | ASCII 3D dome rasteriser (D-16, §8) | **`src/ui/components/guide/skychart/dome/` only** | **Pre-1.0 API** — minor releases may break props; pin exact version, upgrade deliberately with the raster snapshot as the tripwire. **Single-maintainer fork** (of polycss) — bus factor 1; vendor-fork plan: the package is small and MIT, so forking into `vendor/` is the fallback if it goes dormant. **Small user base** — few battle-tested edge cases (mobile touch, RTL text, high-DPI), so the spike (§8.5) and the interaction e2e carry more weight than usual. Handedness fixed by R14 (Z up, D-58); no interior camera (D-60); coloured mode writes inline styles and the base stylesheet is injected, both blocked by the strict CSP (D-61); the chart chunk is 97 KB gzipped (D-63). |
| **`vite-plugin-pwa`** *(v1)* | 0.20.x / 1.x | MIT | Service worker and precache manifest (D-79, FR-OFF-1/6) | build config only; the generated `sw.js` imports nothing of ours | Workbox's weight lands in the service worker, not the main chunk. `runtimeCaching: []` keeps it out of the data path; a test asserts that. Build-time only — no runtime API surface for us to depend on. |
| `vitest`, `@testing-library/react`, `@playwright/test`, `msw`, `fake-indexeddb`, `jest-axe` | current | MIT | Tests (dev only) | — | — |
| `knip` *(v2.2, D-647)* | 5.x | ISC | Unused files, exports, types and dependencies (FR-SHOW-4); dev only, CI's `dead-code` job | `knip.json` at the root; never imported | Installed by the owner on `main` (a task session cannot add it). A false positive is a symbol only a dynamic path reaches — the fix is a `knip.json` entry with the reason beside it, never `ignoreExportsUsedInFile` for the whole tree. `ffmpeg` (D-652) is not a dependency: an optional binary on `PATH`, like `openssl` for the window spike. |

No i18n, routing, date or state dependency is added for v1: language is two typed objects (D-69), routes stay in the hash (D-13), dates stay `Intl` (D-3), and the Moon reuses `astronomy-engine` (D-80).
*(v2.3, V23-7)* No dependency is added for the design system: the literals test is a Vitest file over regexes, the guide generator is a `tsx` script, and stylelint was weighed and refused because a task session cannot install it (D-647's reason).

*(v0.18, D-973, D-975)* v2.10 adds one row, `stars-deep` (`stars-deep-*.js`), at `DEEP_BUDGET_KB` (60) until the release re-sets it by D-178; `window` may grow by what the look measures and `stars` by the haze outline (≤ 2 KB); `main` does not grow past 2.9.0's measure (the theme's rule and the strings are its only additions, ≤ 0.5 KB).
No dependency is added: the galactic conversion is a dozen lines in the build script, and B−V is a column of the vendored Yale file.

*(v0.19, D-996, D-1002)* v2.11 moves the sheet out of the `live` chunk into `components/sky/`: `live` may shrink, `stars` and `main` may each grow by at most 1.5 KB gzipped (FR-CLEAN-9); the release re-sets the rows by D-178.
No dependency is added.

*(v0.21, D-1066..D-1068)* v2.13 changes how CI runs, not what it checks: concurrency, one build, the browser cache, the `docs_only` and `tests_only` paths, the failure digest, `check:sdd` and the title check beside `trailers`, and `captures.yml` on the manifest.
No budget row moves; no dependency is added.

---
