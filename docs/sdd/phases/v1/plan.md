# v1 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.17 v1 decisions (2026-09-03)

These plan SPEC v1.0 (V1-1..V1-11).
Nothing here is implemented yet; each decision names the requirements it serves so a task can be cut from it.

- **D-69 — Language is two typed catalogs and a hook, no i18n library.**
  `src/i18n/en.ts` is the source of truth; `type Messages = typeof en` and `es.ts` is declared `const es: Messages`, so a missing or misspelled key fails `tsc` (FR-I18N-2) with no runtime fallback path to write or test.
  Parameterised messages are **functions** (`passRise: (p: {name: string; dir: string; time: string}) => string`), not template strings with placeholders: a function lets Spanish put the words in a different order, agree in gender and number, and use its own `Intl` calls, and it makes the parameter list part of the type.
  Plain strings stay plain strings.
  Rejected: `i18next` (a runtime catalog, a bundle cost, and its missing-key behaviour is a fallback, which FR-I18N-2 forbids) and ICU message syntax (a parser at runtime for what the type system can do at build time).
- **D-70 — Locale and theme are applied in `main.tsx` before the first render, not by an inline script.**
  `script-src 'self'` (§11) forbids the usual inline bootstrap, and the app is client-rendered anyway: `main.tsx` reads the prefs, sets `documentElement.lang` and `data-theme`, and only then calls `createRoot().render()`.
  Nothing paints before that, so FR-THEME-1's "before first paint" holds without relaxing the CSP.
  The initial `<html lang>` in `index.html` is `en` and is corrected in the same tick.
- **D-71 — Breakpoints are literal pixels, pinned to the cell token by a test.**
  FR-DESK-1 states breakpoints in cells, but a media query cannot read `var(--cell)`.
  `global.css` uses `@media (min-width: 960px)`; a test in `tests/styles/` recomputes `100 × --cell` from `tokens.css` and asserts it equals the literal in the media query, so the two cannot drift.
  Column and panel widths inside the layout *are* written in cells (`calc(40 * var(--cell))`), as FR-DESK-2 and FR-DESK-3 require.
- **D-72 — One guide component, two shells.**
  The compact sheet and the wide side panel (FR-DESK-3) render the same `PassDetail` content; only the wrapper differs.
  `lib/layout.ts` exposes `useLayoutMode(): 'compact' | 'wide'` over `matchMedia` (a listener, not a resize handler), and `PassDetail.tsx` picks the shell.
  The selection hash (D-13) and the guide's own state are identical in both, so switching width mid-session keeps the open pass.
- **D-73 — Shortcuts live in one hook with one guard.**
  `lib/shortcuts.ts` installs a single `keydown` listener on `document` at the `App` level.
  It ignores the event when any modifier is held, when `event.isComposing`, or when the target is an `input`, `textarea`, `select` or `[contenteditable]` — that is FR-DESK-4's "no input focused" rule, in one place rather than per component.
  The overlay (`?`) is generated from the same table that registers the handlers, so a shortcut cannot exist undocumented.
- **D-74 — The dome is two stacked glyphcss scenes sharing one camera.**
  FR-DOME-8's base layer is solid mode and its line layer is braille wireframe; `GlyphScene` takes `mode` as a scene prop, so one scene cannot be both.
  `SkyDome.tsx` renders two `GlyphScene`s in the same CSS grid cell (`grid-area: 1/1`), same grid dimensions and same cell metrics so the glyphs align, base behind lines, `pointer-events: none` on the base.
  Both receive the camera state that already lives in the component (D-64), so they cannot drift by construction.
  The finer pass layer (FR-DOME-8c) is a per-mesh density option inside the line scene, not a third `<pre>`; a third scene is the fallback if per-mesh density turns out not to exist in 0.1.6, and the spike answers that.
  Cost is the open question OQ-15 and is what the spike measures.
- **D-75 — Colour comes from the tokens through a probe element, and the CSP gains exactly one directive.**
  `_headers` adds `style-src-attr 'unsafe-inline'` (V1-4) and nothing else, **in the layered-dome task, not before** — the deploy test pins `_headers` to PLAN §11's block verbatim, so the header and the plan move together and the site never advertises a relaxation nothing uses yet; `style-src-elem`, `script-src` and the rest stay `'self'`, and the deploy test (D-25) is extended to assert that, so a later "just add unsafe-inline" cannot pass review.
  `dome/palette.ts` reads the FR-DOME-2 colours with `getComputedStyle` on a hidden probe element that carries the token classes, at mount and again when `data-theme` changes (a `MutationObserver` on the root's attributes), so both themes work with one code path and the palette is never duplicated in TypeScript.
- **D-76 — No new worker request: `computeNow` already takes an instant.**
  SPEC §5.7 proposes a `computeAt(t)` request for FR-LIVE-6, but `computeNow` has carried `t: EpochMs` since §6.2 was written — it is already "the Now pipeline at an arbitrary instant".
  Adding a second name for it would give the client two ways to do one thing.
  Instead `computeNow` gains `includeHidden?: boolean` (FR-LIVE-6's dimmed objects with reasons) and `NowState` gains `moon`.
  Recorded in §15 as a spec amendment.
- **D-77 — The 72 h search runs night-outer, object-inner, so tonight arrives at MVP speed.**
  FR-VIS-1 as amended triples the window, and FR-VIS-4's budget is unchanged.
  The handler loops the three 24 h nights on the outside and the objects on the inside, emitting `passes` per (night, object) pair, `featured` objects first within each night.
  The first night is therefore complete in the MVP's time and the list renders while the other two compute; FR-OFF-2's grouping falls out of the same order.
  `progress` counts object×night pairs.
  No protocol change beyond the wider `window`.
- **D-78 — Passes are stored per observer cell, two runs at most.**
  IndexedDB gains a `passRuns` store keyed by the observer rounded to 0.01° (about 1 km — the same pass from anywhere inside it, matching the geocoding non-goal).
  A run holds the observer, the window, `computedAt`, the oldest elements epoch used and the passes.
  Writing happens on every `jobDone { cancelled: false }` (FR-OFF-5, no "prepare" action).
  Only the active run and the previous one are kept and the rest are pruned on write: FR-OFF-7 gives favourites offline data for the active observer only, and three 72 h runs of 30 objects would be the largest thing the app stores.
- **D-79 — The service worker is `vite-plugin-pwa` in `generateSW` mode with runtime caching switched off.**
  Workbox's precache manifest is generated from the build, which is the part that is tedious and error-prone to hand-write, and its weight lands in the worker file, not the main chunk.
  `runtimeCaching: []` and a `navigateFallback` to `index.html` are the whole configuration: FR-OFF-1 forbids caching CelesTrak and Open-Meteo, which already live in IndexedDB.
  `registerType: 'prompt'` implements OQ-14 — the new worker waits, `UpdateBanner.tsx` offers the reload, and `skipWaiting` is called only from that button, so an update cannot swap the shell under the live page.
  Dev builds do not register a worker.
- **D-80 — The Moon is physics, the lore is data.**
  `physics/moon.ts` wraps `astronomy-engine` the way `sun.ts` does (D-2) and exports `moonAt(t, observer): MoonState` and `moonGlare(moon, peak, thresholds): MoonGlare`, both pure and both tested against published values.
  It runs in the worker, so `NowState.moon` and `Pass.moonAtPeak` arrive with everything else and the main thread does no astronomy — except the live page's once-per-second re-evaluation (FR-LIVE-5), which imports the same pure module (`src/lib` may import physics types only, so the live page's Sun and Moon evaluation lives in `lib/skyBodies.ts`, which is the one exception, listed in §3).
  The tradition text is `data/moon/lore.json` with a zod schema and both languages in one file, reviewed by hand like the catalog (FR-MOON-4); phase-name boundaries are constants in `physics/constants.ts` with the usual rationale comment.
- **D-81 — The live page owns its instant; playback is a rAF loop over wall time.**
  `LivePage` holds `t` and `speed`.
  Playing advances `t` by `(wallDelta × speed)` on each `requestAnimationFrame`, so a dropped frame loses no simulated time and the 3600× target (FR-LIVE-5) is a rendering question, not a scheduling one.
  Satellite positions come from `Pass.track` by interpolation (FR-DOME-5) — the worker is never called per frame; hidden objects (FR-LIVE-6) are a `computeNow` request throttled to one per 250 ms of wall time, with the in-flight request's result discarded if `t` has moved past it.
- **D-82 — The time stripe is SVG, not glyphcss.**
  FR-LIVE-4 wants hour ticks, night bands, per-pass segments and a draggable cursor.
  That is the polar chart's problem again (R13 solved it in SVG, FR-GUIDE-5 permits SVG), and it is not a 3D scene.
  Reusing `SkyPolar`'s approach keeps the stripe cheap during playback, which is where the frame budget is.
- **D-83 — Share links are built and parsed in one module.**
  `lib/shareLinks.ts` owns `#pass?…` and `#live?…` in both directions (FR-SHARE-1, FR-LIVE-9), and `screens/passSelection.ts` (D-13/D-33) delegates to it.
  Round-trip tests are the whole test surface for FR-SHARE-1 and FR-SHARE-3's fallback ("nearest pass of that satellite, else a message naming it").
- **D-84 — Night theme is a third token block, not a second stylesheet.**
  `tokens.css` gains `[data-theme="night"]` beside the existing values; no component learns about themes, and `scripts/contrast.ts` and its test iterate both themes over the same pair table (FR-THEME-2).
  FR-THEME-3's dome colours come free from D-75's probe.
- **D-85 — Favourites live in prefs with LRU eviction at 8.**
  `localPrefs` gains `favourites: Favourite[]` with `lastUsedAt`; adding a ninth evicts the least recently used (FR-OFF-7).
  They are observers, not places: a favourite carries the full `Observer` including `timeZone`, so selecting one works offline with no geocode call.
- **D-86 — The task driver is repo tooling, not a task.**
  `scripts/sdd-run.ts` (§16) is what runs the v1 tasks, so it cannot be one of them: it is written and reviewed before the first wave, like `scripts/bundle-budget.ts` and `scripts/contrast.ts`, and it is proved by a dry run against the existing R1–R15 entries before it is given a real task.
  TASKS.md stays a list of product slices.
- **D-87 — The driver's pure half is a library, its IO is injected.**
  `scripts/sdd-run.ts` is the CLI; the parts are `scripts/sdd/{tasks,waves,session,git,report}.ts`.
  Parsing TASKS.md and choosing a wave are pure functions over text and over what git and `gh` said, so `tests/sdd/` proves the §16.2 and §16.3 rules — one per lane, two at once, refuse a task with no `Lane:` or `Gate:` — without a network, a worktree or a session.
  The session and the driver exchange three files in the worktree's `sdd-run/` directory (§16.4); it is per-run scratch and is never committed.
- **D-88 — Every v1 task runs on Opus; `fable` is dropped from the model policy.**
  R16, the dome composition spike, was the first task the driver ran.
  Its session reached the account's Fable limit after 138 turns and 17 minutes, with the spike page written but no findings file and nothing committed; the driver marked the task failed and kept the worktree (§16.5).
  The six tasks §16.6 put on Fable — R16, R21, R22 and the three live-page tasks — are the whole dome and live-page line, so a quota that stops one stops all of them, at the point in the phase where the most work depends on them.
  The owner's call (2026-09-03) is to run the phase on one model rather than schedule around a second account limit: §16.6 becomes Opus for every implementation session, and TASKS.md's six `Model: fable` fields become `opus`.
  The driver still parses and accepts `fable`, so this is a policy change, not a code change.
  What it costs is the argument §16.6 made for Fable on captures-and-drag-rate work; what it buys is that no task in the phase is blocked by a limit that is not the phase's own.
- **D-89 — The turn cap is 250, and a headless session commits as it goes.**
  R17, the language task, ended at turn 121 of 120 with the `src/i18n` catalogs written, some thirty files rewired through them, the co-located tests not yet migrated to the new signatures, and **nothing committed** — so the driver's step-4 check (has the branch any commits?) found an empty branch and scored the whole run lost.
  Two things were wrong.
  The cap was the binding constraint at 40 % of the wall clock: 121 turns took 18.6 minutes, about 9 s a turn, so 120 turns could never use the 45 minutes §16.4 allows; 250 turns is roughly 38 minutes, which puts the two limits at the same place and leaves the clock as the backstop it was meant to be.
  And a session that commits once at the end converts *any* limit into total loss, which is the opposite of what §16.5 intends by keeping the branch and the worktree.
  `sdd-implement` already said to commit in small steps; the driver's prompt now says it too, and the skill says why: on a branch nobody has pushed, a red typecheck between steps costs nothing and an uncommitted working tree costs the whole session.
  What this does not fix is a task that is simply too large for one session; that is a breakdown question, and R17's retry is the measurement.
- **D-90 — Per-mesh `density` exists in glyphcss 0.1.6 and FR-DOME-8c does not use it.**
  The R16 spike confirms the prop: `density={2}` on a `GlyphMesh` pops it into its own `<pre>` at half the cell (four `<pre>`s in the line layer instead of one, cell 6.5 → 3.25 px).
  But that finer `<pre>` does not follow the `GlyphOrthographicCamera`'s `zoom`, so the mesh is drawn at another scale and origin: the highlighted arc breaks up and a strand of it runs off the drawing (`docs/dome-composition/probe-density-2-390.png` beside `probe-density-1-390.png`).
  The highlighted pass therefore stays in the shared line grid in R21 and is separated by weight (0.75° against 0.05°) and colour, which is what FR-X-5 wants anyway.
  D-74's fallback — a third scene with its own camera — is not taken now; if a sharper arc is ever wanted it is its own task with its own measurement.
- **D-91 — `zoom` belongs to the box, not to the cell, and the desktop grid is capped.** glyphcss's `zoom` is CSS pixels per world unit against the cell the scene measures at mount, so two stacked layers of different coarseness take the *same* zoom; scaling it with the cell (R15's `layoutFor`, where the 60-column grid is fixed) makes the coarser layer twice as large.
  The layered dome uses `zoom = 140 × width / 390` for both layers.
  FR-DOME-1's "the column count grows with the width" is kept but capped: at 1280 px the literal 6.5 px cell is 197 columns and measures 18.8 rasterisations/s under the D-62 method against 26.2/s at 120 columns (the three §8.7 fallbacks together reach 25.8/s and even 100 columns only 28.5/s — nothing clears 30/s at that width while the CPU is throttled 6×, which is a phone's budget applied to a desktop panel, so it is a warning and not a gate; unthrottled both grids run at ≈ 54/s, and the gate stays the phone at the phone's width).
  The cap costs nothing on a desktop and halves the longest frame under load, 74 ms → 43 ms.
  R21 grows the columns with the width to a ceiling of 120, which is still twice the phone's detail.
  The two layers are aligned to the top-left of the shared box, not centred: centring leaves a measured 2 px seam because each `<pre>` rounds in its own box.
- **D-92 — The v1 dome's composition (FR-DOME-8, closes P-OQ-4 / OQ-15).**
  From `docs/dome-composition/findings.md`: tilt **45°**; **eight** meridians, cardinals solid and intercardinals dashed; weights horizon/rings/meridians **0.05°**, highlighted pass **0.75°**, other passes **0.05°**; base layer on, `blocks` ramp at **half** the line layer's columns, ground disc to 1.1 radii, sky bowl at 0.985, ambient 0.35 with the key light on the Sun; the Sun glow kept; the live-marker pulse kept, driven by `requestAnimationFrame` and capped at **30 updates/s** (it measures 35/s at 6× CPU throttle on its own); the `cool` colour map, one value per FR-DOME-2 meaning in both themes, every meaning ≥ 3 : 1 against its ground.
  The second scene costs 5 to 8 rasterisations/s of 39 (13–20 %) and every candidate holds ≈ 33/s or better at 390 px, so **no fallback is applied at the phone width**; at desktop widths the column cap (D-91) comes first, then `colorTolerance`.
  `interactiveDownscale` is last: it is inert unless the component calls `sceneHandle.setInteracting()` itself (D-64 removed the controls that would), and it rescales by writing `pre.style.fontSize`, which our `line-height` does not follow, so it pulls stacked layers apart mid-drag.
  `colorEncoding="atlas"` empties the solid layer of `<span>`s but not the braille one, whose glyphs the shipped atlas does not carry.
- **D-93 — Every path the driver hands to `gh` is absolute.**
  R16's first successful session ended with `gh pr create failed: open logs/sdd/R16-pr-….md: no such file or directory`, after the branch had been rebased and pushed: seven commits and 122 files on `origin`, and no PR.
  PR and comment bodies are written to a file because they carry newlines, backticks and markdown (§16.4), and `bodyFile` returned `LOG_DIR` joined as a *relative* path — `logs/sdd/…` — while every `gh` call that reads one runs with `cwd` set to the task's worktree, where that directory does not exist.
  The driver's own logging is relative to its checkout and the sessions run somewhere else, so the two only meet when the path is resolved.
  `bodyFile` now returns an absolute path; `createPullRequest` and `commentOnPullRequest` both go through it, so the review comment had the same bug and is fixed by the same line.
  The failure mode is worth naming: the task was *done* — the session had committed and the driver had pushed — and it was scored `failed` for a publishing step that never touched the work.
- **D-94 — The language switch is on the guide sheet as well as the header.**
  FR-I18N-6 puts one switch in the header, and R17's scope named `LanguageToggle.tsx` there only.
  The sheet is a fixed overlay that locks the page's scroll and makes everything behind it inert (R13 review), so on the one screen a share link opens straight onto (R31) the header's switch cannot be reached: the language could not be changed there at all.
  The sheet therefore carries the same component beside its back control.
  It is the same control and the same preference, not a second setting — `tests/e2e/language.spec.ts` switches from the sheet and asserts the list behind it changed too.
- **D-95 — The nights are cut from the request window in the worker, and each one searches 30 min past its own edges.**
  D-77 says the handler loops three 24 h nights, but the request still carries one `window` (§6.2), so `worker/nights.ts` derives them: `ceil(span / 24 h)` nights, always at least one.
  An MVP caller's 24 h window is therefore one night and one `passes` message per object, unchanged.
  Cutting on the hour would split any pass that straddles a boundary into two truncated halves, one in each night, so a night searches `MAX_PASS_SPAN_MS` (30 min, the same "no LEO pass lasts this long above 10°" bound as `now.ts`'s look-ahead) either side of itself and keeps only the passes whose *start* it claims — `[startMs, endMs)`, the last night keeping everything from its start on.
  Each night is then exactly one pass-search boundary problem fewer, and because 24 h and 30 min are both whole numbers of 30 s coarse steps the widened searches sample the same grid a single whole-window search would: the three nights together emit exactly the passes one search over the 72 h window finds, none split, doubled or lost.
  That equality is a test, not an argument (`handlers.test.ts`), and a second case puts a night boundary on a known pass's peak.
  Measured on the development machine: 31 objects × 72 h in 1922 ms, night 1 in 623 ms against the MVP's own 1.5 s budget.
  An object whose search throws is reported once and skipped for the remaining nights, rather than raising `PROPAGATION_FAILED` three times for one broken satrec.
- **D-96 — `NowState.hidden` is the FR-LIVE-6 set, and the performance budgets run alone.**
  Two findings from R18.
  (1) §6.2's "`computeNow { includeHidden: true }` returns every object above the horizon" cannot mean `items`: `items` has always held *every* loaded object, below the horizon included (the Now panel's "everything is in shadow" states are counted from it), so widening it would change what MVP callers see and narrowing it would break the panel.
  The flag adds `NowState.hidden`, absent without it, which is also the shape `SkyChartProps.hidden` (§8.1) wants.
  Its rule is "above the horizon and *not worth looking for*": not visible, **or** visible but fainter than `magLimit`.
  The magnitude cut belongs here and not in `visibilityAt` because the live page draws its visible objects from `Pass.track` and passes *are* magnitude-filtered (§6.3 step 6), so without it a too-faint object would be drawn by neither layer.
  The reason is read off the item's own fields (`aboveMinElevation`, `lit`, `magnitude`, `NowState.sky`); no new field.
  (2) The §9.1 budgets are wall-clock gates and were measuring each other — the 72 h one pushed the 24 h one from ~1.0 s to 1.73 s against its 1.5 s limit, the contention `passes.perf.test.ts` had already warned about (R13 saw 1547 ms once).
  They now run in a `perf` Vitest project at `sequence.groupOrder: 1`, after every other project and one file at a time (`singleFork`), which took the 24 h figure to 580 ms.
  A budget that shares the machine measures the machine.
- **D-97 — The lore is validated by a test, and its provenance date is a review date.**
  R29's scope asks for `data/moon/schema.ts` "validated in CI the way `check-catalog.ts` validates the catalog".
  `check-catalog.ts` is the *live* half of that pair and has no counterpart here — a tradition has no upstream feed to check membership against — so the CI half is what R29 builds: `data/moon/lore.test.ts` in the `node` project, structure and wording both.
  Three consequences of the file being tradition rather than measurement.
  (1) `source.date` is the day a person last read the named source and agreed with the text, not the source's publication date: MUL.APIN and the Old Farmer's Almanac have no `2020-09-14` to record, and what is auditable is the review.
  (2) The wording gates are the real content of the test — a list of banned words in each language, run over every line, and run again over planted horoscope and advice copy so a gate that has stopped being able to fail is itself a failure (FR-MOON-5, FR-I18N-3).
  The Spanish list is the one `i18n/messages.test.ts` uses, plus the fortune vocabulary and a simple-future check; `\b` is ASCII-only in JavaScript, so both languages match whole words with `[^\p{L}]` boundaries or `Aldebarán` reads as a future tense.
  (3) The types stay in `src/data`, not `src/model`: nothing computes with the lore, it is read, and `model/moon.ts` belongs to the physics of D-80.
  `signAtLongitude` lives beside the file that defines the 30° bands so R19's `moonAt` and R30's phrases share one definition of where a sign starts.
- **D-98 — The driver waits for the checks to exist before it watches them.**
  R29's session finished, committed, rebased and pushed, the PR opened — and the task was scored `failed: CI is red` seconds later, because `gh pr checks --watch --fail-fast`, run immediately after `gh pr create`, exits **1** with `no checks reported on the 'r29-…' branch` while GitHub has not registered the workflow yet.
  That is the same exit code a genuinely red check gets, and `--watch` does not wait it out: there is nothing yet to watch.
  `watchChecks` now polls `gh pr checks` every 10 s until the checks exist, for at most 5 min, and only then watches them.
  What "exist" means is `checksExist`, and it is read off the exit code where the exit code says it — **0** finished, **8** pending — while **1** is read further, because it covers three different things: a failed check, a PR with no checks, and a `gh` that could not answer at all (a 404 from an API still catching up with `gh pr create`, a rate limit, no network).
  The message settles the second, and stdout the third: a red check prints its table there, a failed call prints only to stderr.
  Anything that is not an answer counts as "not yet" and is polled again; a PR that never gets a workflow is still red, which is what a missing or misconfigured CI file should look like.
  The retry loop is `waitForChecks`, a function over a probe, so `tests/sdd/git.test.ts` can exercise it on a fake clock without the network.
  This is D-93's failure mode again — the work was done and the publishing step condemned it — and the general rule it leaves behind is that the driver must not read a race as a verdict.
  Numbered D-98: R18 took D-95 and D-96 and R29 D-97.
- **D-99 — The page ground hangs off `html[data-theme]`, and the theme switch joins the language switch on the sheet.**
  FR-THEME-1 says the theme is applied *before first paint*, and D-70 argues that a client-rendered app paints nothing until `main.tsx` runs.
  That is true of the content and false of the canvas: the built `index.html` loads `tokens.css` and `global.css` as a blocking `<link>` and the module script deferred, so the ground colour is available to the compositor a frame before the saved theme is.
  Moving `background: var(--bg)` from `html`/`body` to `html[data-theme]` closes it without the inline script `script-src 'self'` forbids: until the attribute lands the canvas is the UA's own dark one (`<meta name="color-scheme" content="dark">`), which is nearer to both palettes than either is to the other.
  `body` must then carry no background of its own, or CSS propagation puts it back on the canvas.
  `tests/e2e/theme.spec.ts` samples the first three rendering opportunities after a reload and fails if any of them is the dark ground.
  The switch itself goes on the guide sheet as well as the header, for D-94's reason and a stronger one: the sheet is the screen someone is reading while standing outside in the dark (US-19).
- **D-100 — The night palette is the R16 map read as a whole, and only the page ground is a pinned ratio.**
  Every night UI token takes a colour the R16 spike already measured against `#0a0202` (`--fg` the compass red, `--fg-dim` the shadow red, `--accent` the highlighted-pass red, `--edge` the ring red), so the chart and the page around it are one set of reds and every documented figure in `tokens.css` is a machine-computed one rather than a hand-kept one.
  The header table therefore pins three columns — both grounds in dark, the page ground in night — and not a fourth: `--bg-raised` sits 1.06 : 1 above `--bg`, so its column is the same numbers scaled by 0.95 and carries nothing the test's 4.5 : 1 floor does not already check.
  FR-THEME-3's "no non-red hue" is made testable as `r ≥ g ≥ b` and a hue within 30° of red; the consequence is that `--danger`, `--warn` and `--ok` separate by lightness only, which FR-X-5 already covers because each of their uses carries a word or a bracketed marker as well.
- **D-101 — The implementation session's allowlist covers the commands the tasks are written in.**
  R20 was published without a single check having run: its session was refused `npm test` (the project's own script is `npm test`, which `Bash(npm run:*)` does not match), `npx tsx scripts/contrast.ts` — the script R20's own acceptance names — `node`, `awk`, and every compound command containing an `echo` or a `cat`.
  It wrote a theme, could not execute it, said so in its summary, and CI found the failure that a local `npm run e2e` would have.
  The list now covers the project's commands and the read-only shell tools that inspect their output.
  Breadth there is not the fence: a session that may run `npx vitest` already executes whatever the repository's own tests execute.
  What keeps it inside the task is the denied list — `git push`, `git add -A`, `gh`, `rm`, the network, `prettier` — which is unchanged, and §16.4's rule that publishing is the driver's job.
- **D-102 — `NowState.hidden` is an instant, `Pass` is an arc, and the live page owns the overlap they leave.**
  D-96 says the dimmed set is "above the horizon and not worth looking for"; its docblock went further and called it the *complement* of what the live page draws from `Pass.track`, which it is not.
  `isHidden` reads the magnitude at `t`; `findPasses` keeps or drops a whole pass on its **peak** magnitude (§6.3 step 6).
  An object therefore appears in both sets while it dims past `magLimit` on the way down — measured over the R1 golden day at Neuquén with the shipped catalog: 2 of 49 visible object-minutes, both in the closing seconds of a pass (`SL-16 R/B (Cosmos 2369)` at 10.9° and magnitude 4.64, 593 s into a 605 s pass; `SL-16 R/B (Cosmos 2406)` at 12.8° and 4.73, 206 s of 237 s).
  Both facts are true at that instant — the pass was worth watching, and the object is too dim to see right now — and a peak-based `isHidden` would suppress the second one, which is the one FR-LIVE-6 exists to say, at the cost of a second window scan per candidate on every live tick.
  So the rule stands and the claim is corrected.
  **R32/R33: the live page draws its passes first and dims only what it has not already drawn** — `hidden` minus the drawn set, not `hidden` on its own — or an object gets two marks for a few seconds at the end of its pass.
- **D-103 — The Moon has one set of eight phase names, and it is the lore file's.** §5 wrote `MoonPhaseName` hyphenated (`'waxing-crescent'`) before R29 shipped `data/moon/schema.ts`, whose `MoonPhaseKey` is camelCase (`'waxingCrescent'`) and is already validated in CI against `lore.json`.
  Two spellings of the same eight names would put a translation table between `moonAt`'s answer and the line the file keys by it — a table with nothing to decide and one way to be wrong — so `model/moon.ts` takes the file's spelling and `phaseLore(moon.phase)` type-checks as it stands.
  The union is still declared in `src/model` rather than imported, because §3 says the shared types import nothing; what keeps the two in step is a test, not a type: `moon.test.ts` walks the whole cycle in quarter-degree steps and asserts the set of names `phaseName` produces is exactly `MOON_PHASES`, so adding a ninth band or renaming one fails there.
  The bands themselves are the four cardinal names ±7.5° of phase angle with crescent and gibbous filling the 75° between, which makes "gibbous" always mean more than half lit; 7.5° is about 15 h of the Moon's motion, over which the disc is 99.6 % lit at full and 0.4 % at new.
- **D-104 — The Moon's reference values are two published worked examples and the conversion between them.**
  PLAN §9.2 asks for `moonAt` "against a published value within 0.1°", and the published almanac tables an app would normally be checked against are not in the repository and cannot be fetched offline.
  `moon.test.ts` therefore does what `sun.test.ts` does with the NOAA solar calculator: it reimplements the reference.
  Meeus's worked example 47.a fixes the Moon on 1992 April 12 at 0h TD — apparent λ 133.167265°, β −3.229126°, Δ 368409.7 km, true obliquity 23.440636°, Δψ +16.595″ — and the test pushes those published numbers through Meeus 11 (the observer on the ellipsoid), 12.4 (apparent sidereal time), 13 (ecliptic to equatorial to horizontal) and 40.6 (the Moon's degree of parallax, which cannot be skipped as it can for the sun) to a topocentric altitude and azimuth at three latitudes.
  Agreement with `astronomy-engine` is 0.002°.
  Example 48.a pins the illuminated fraction (0.6786) at the same instant, and the chapter-49 phase series — transcribed without its fourteen planetary corrections and validated against the published example 49.a, the new Moon of 1977 February 18 at 3h37m40s TD, to within 1.5 min — supplies a new and a full Moon to read the fraction and the phase name at.
  Two things the exercise cost, both worth recording: Meeus works in TD and the app in UTC, 58 s apart in 1992 and 0.009° of the Moon's motion, so the test solves for the UTC instant whose TT is the published one rather than assuming they are the same; and Meeus 12.4 takes the Julian day of the **UT** instant, not the TD one — using the TD value puts the sidereal time out by exactly ΔT and the azimuth out by up to 0.6°, which is how the first run of this test failed.
- **D-105 — A stored run is handed back whatever its age, and stands in for the list until the recompute has something of its own.** §7.5's pseudocode returned `null` for a run whose window had passed, on the same line as a comment saying expired runs are shown as stored with their age; the comment is the intent and the code was the slip.
  Offline, an expired run is all the app has, and how to word its age is FR-OFF-4's line, not the store's decision, so `loadForObserver` returns whatever is there and the caller decides.
  Two consequences follow.
  The stored list enters the slice as a *finished* list with `storedAt` set, not as a new status: the pass list already renders `done`, so nothing in `src/ui` had to learn a fourth state to show three stored nights (R27 reads `storedAt` for the readiness line).
  And `startJob` keeps those passes on screen for the same location instead of resetting to an empty list — the recompute takes seconds, and blanking a list that is about to come back is the one thing an offline-first app must not do — until the job's first `passes` message replaces them, or its `jobDone` clears them because it found nothing.
  The two caches also stop opening the `wiys` database separately: `data/db.ts` owns the name, the version (2, adding `passRuns` without touching `elementGroups`) and one shared connection, so the app cannot block its own upgrade, and `data/schemas.ts` holds the observer schema that the prefs and every `PassRun` both parse.
- **D-106 — A stored forecast is evicted after the span it covers, not after its TTL.**
  FR-OFF-3 asks the snapshot to stay in use offline past the 30 min TTL, which cannot work if the TTL is also what decides when it is thrown away — the MVP evicted on write anything older than 30 min.
  Eviction and freshness are now two rules: fresh is still 30 min and still decides whether the network is asked, and *usable* is `FORECAST_DAYS × 24 h` (four days, the span the response itself covers), past which every hour in the snapshot is behind us and every verdict from it would read `unknown` anyway.
  The stale copy is returned only when the fetch fails, and it is not re-remembered as current, so the next load tries the network again: online behaviour and the TTL are unchanged, exactly as FR-WX-5 requires.
- **D-107 — Every e2e that waits for a finished list waits three times as long, and "the ISS article" is no longer one article.**
  The window tripling is not only a physics change: `playwright.config.ts` gains a 90 s test timeout and the list assertions 30 s (measured: a full 72 h recompute in Chromium runs 2–5 s on the development machine, but CI is a loaded box and the old 30 s default left no room for a test that loads twice).
  And six specs located the golden pass as `getByRole('article', { name: 'ISS (Zarya)' })`, which was unique only because 24 h holds one ISS pass; over 72 h there are several, so they address the hero card (`iss-hero`) — the next ISS pass, which is the golden one — and identity's "not repeated below" assertion becomes the hero's `data-pass-id` being absent from the list.
- **D-108 — What the review found in the offline path, and the five rules that came out of it.**
  The stored run reached the screen correctly and then five things went wrong around it, each worth stating as a rule rather than a patch.
  **An empty batch is not an answer.**
  The worker emits a `passes` message per (night, object) pair, empty ones included, so `addPasses` taking over the slice on the first message blanked the stored list about 100 ms into a 2–5 s recompute — the blanking D-105 exists to forbid, arriving through the door D-105 did not watch.
  The stored list now stands in until a batch actually carries a pass.
  **An empty run is worth storing; an empty run with skipped objects is not.**
  `storeRun` wrote back whatever the slice held on every uncancelled `jobDone`, so one recompute in which every object failed to propagate destroyed the good run that was the only thing the app could show offline.
  A window with no darkness, or with nothing bright enough, is a real answer and is still stored; a window whose objects never computed is not an answer at all.
  **A set of elements is as old as its newest epoch.**
  `lib/elementsAge.ts` settled this in the MVP with the argument that an old oldest epoch is normal for a quiet rocket body while an old newest epoch means the whole fetch is old; `PassRun` then stored the minimum, which would have had R27's banner reporting weeks-old elements on a fresh set and tripping the five-day warning on it.
  The field is `newestElementsEpochMs` and the plan's §5 and §7.5 say so.
  **`hasDarkness` belongs in the stored run.**
  An empty list means two different things — nothing was visible, or the sun never set far enough — and offline there is no recompute to tell them apart, so the flag is stored and comes back with the run.
  **A blocked upgrade must fail, not wait.**
  The v1→v2 bump had no `blocked` handler, so a second tab holding the old version made `openDB` pend for as long as that tab lived; because the stored run is read before anything is fetched, the elements, the weather and the pass job all waited behind it, and one forgotten tab meant the app never started.
  A blocked open now rejects and is not remembered, both caches read that as "nothing stored", and a connection that is itself blocking someone else's upgrade closes and reopens on the next call.
  What is *not* fixed here: an expired stored run still renders under "N visible passes in the next 72 h" with passes that have already happened.
  Saying how old it is is FR-OFF-4's line and R27 owns it; this task's job was to make sure the run is there to describe.
- **D-109 — The Moon at the peak is always there; only the warning is conditional.**
  R19 shipped `Pass.moonAtPeak` as `MoonState | null`, null whenever the Moon was below the horizon at the peak, and its own task note claimed the separation was measured anyway — it was not, because `findPasses` passed the null.
  Both were the same mistake: reading FR-MOON-2's "Moon altitude > 0° at the pass peak" as a rule about *whether the Moon exists on a pass*, when it is a rule about *whether the pass has a glare problem*.
  US-18 AC1 settles it — the card and the guide show the Moon's phase and illumination at the peak unconditionally, and a Moon that has just set has both — so `moonAtPeak` is a `MoonState`, `MoonGlare.separationDeg` a `number`, and `moonGlare` takes a Moon rather than a Moon-or-nothing.
  The altitude is then compared in exactly one place, `moonGlare`'s own `minAltDeg`, instead of twice: `findPasses` had a hardcoded `> 0` beside it, so an OQ-12 answer that moved the threshold off zero — to −0.5° for a Moon whose upper limb still lights the sky, say — would have been silently ignored, and the comparison inside `moonGlare` was unreachable below the horizon.
  The wiring itself had no test, which is how all of this passed CI: inverting the horizon rule, measuring the separation from the start of the pass instead of the peak, or dropping `NowState.moon` altogether each left the suite green.
  `passes.test.ts` and `now.test.ts` now pin the instant, the observer and the point the separation is measured from, and assert that a pass raises glare exactly where `moonGlare` does.
  R30, which renders all of this, therefore gets a Moon it never has to null-check.
- **D-110 — A wave reserves a block of decision numbers per task before it starts.**
  R19 and R24 ran as a wave on 2026-09-04 and both recorded a D-103 and a D-104: one pair about the Moon's phase names and reference values, the other about stored runs and forecast eviction.
  Each session had read the same `origin/main`, found D-102 last, and numbered from there — neither did anything wrong, and nothing in the process could have told them apart.
  R19 merged first, R24's rebase then conflicted in this file, and its whole run was scored `failed` at the last step with everything else about it green.
  The cost was not the renumbering, which took minutes; it was that a task can pass CI, pass review and still be thrown away by a clash it had no way to see.
  So the numbers are handed out in advance: each task in a wave gets a block of five, recorded here as the last entry before the wave starts, and a session numbers only inside its block.
  Unused numbers stay unused — a gap in the log is cheaper than a collision, and this log has never been dense anyway.
  **Reserved for the wave starting now: R21 takes D-111 to D-115, R23 takes D-116 to D-120.**
  A later wave appends its own reservation the same way.
  What this does not solve is two tasks changing the same *prose* in this file, which stays a real conflict and a real rebase; §16.1 says why the decision log is the one shared file where "trivial, resolved by rebasing" was never true.
- **D-116 — The breakpoint lives in `src/lib`; the hook that reads it lives in `src/ui/hooks`.** §5's tree put `useLayoutMode` in `lib/layout.ts`, and §3's dependency table forbids `src/lib` from importing React at all — a rule the lint config enforces, so the file as drawn could not have been written.
  The table wins, for the reason it exists: `src/lib` is the pure layer the worker and the physics tests may share, and one React import would make all of it unimportable there.
  So `lib/layout.ts` keeps what is not React — `WIDE_CELLS`, `WIDE_MIN_PX`, `WIDE_QUERY` and `layoutMode(matches)`, which is also what `tests/styles/breakpoint.test.ts` imports in Node — and `ui/hooks/useLayoutMode.ts` is the subscription, beside `useNow.ts`, which R11 moved there for exactly this reason.
  The hook is `useSyncExternalStore` over the media query rather than an effect writing state: an effect would mount every desktop load in the compact layout and reflow the whole page one frame later, and React's own lint rule rejects the synchronous `setState` that would be needed to avoid it.
- **D-117 — The compact sheet is portaled to the body, so that one component can pick both shells.**
  D-72 asks for one guide component with two wrappers, and FR-DESK-3 puts the wide one *inside* the right column — but the compact sheet needs the page around it to be `inert`, and a sheet rendered inside `main` would be inert with it.
  `PassDetail` is therefore rendered once, in the right column, and `createPortal`s its sheet to `document.body` when the layout is compact; the panel renders in place when it is wide.
  Nothing about the sheet changes — it was already `position: fixed`, so its box never depended on where it sat in the DOM — and `App` goes on marking header, main and footer inert around it.
  One consequence for tests: RTL's `container` no longer holds the sheet, so the three `axe` runs that cover it take `document.body` instead, which is strictly more of the page than they saw before.
- **D-118 — The wide guide is a labelled region, not a dialog.**
  The compact sheet is `role="dialog" aria-modal="true"` because it covers the page: nothing behind it can be reached, and that is what the role promises.
  The wide panel promises the opposite — FR-DESK-3's whole point is that the list stays beside it, scrollable and clickable — so calling it a dialog would tell a screen-reader user the page was blocked when it is not, and a non-modal `dialog` is a distinction almost nothing conveys.
  It is a `<section>` with a label, like the three regions already on the screen; `<aside>` would be the better tag but axe's own best-practice rule rejects a complementary landmark nested in `main`.
  The label is "Guide: <name>" rather than the name alone, because the card for the same pass is still on screen one column to the left and two regions with one name is a worse answer than a longer one.
  Focus still moves to the heading on open and `Esc` still closes: those belong to the guide, not to the shell, and `PassDetail` owns them for both.
- **D-119 — With a pass open the wide page is one viewport high, and each pane scrolls itself.**
  FR-DESK-3 says the list stays scrollable beside the guide, and the first implementation gave the list a `max-height` of 34 rows and the guide none at all.
  That is two scrollbars that do not agree: the list's, fixed at 816 px, and the page's, driven by whichever of the three columns is longest — usually the guide, which carries the countdown, the chart and the numbers.
  The reader scrolls the page to reach the bottom of the guide and the list scrolls out from under them; the left column, packed to the top by `align-items: start`, leaves a screen of dead space behind.
  A cap written in rows is also right at exactly one viewport height and wrong at every other: 816 px overshoots a 768 px laptop, so the page scrolled *underneath* a list that was already scrolling, and wastes the bottom of a tall screen.
  So the height comes from the viewport instead, and not only when a pass is open.
  **The wide page is a shell exactly `100dvh` high at every width above the breakpoint** — header, main and footer, with `main` a single `minmax(0, 1fr)` row — and the page itself never scrolls.
  What scrolls is whichever pane has outgrown its share, which in the ordinary state of the page means the pass list and nothing else: 72 h of passes is the only thing on the screen long enough to need it, and it is the thing being read.
  Scoping the shell to an open pass, as the first version of this did, fixed one case and left two others wrong.
  With a list and no pass the whole page scrolled, taking the header's language and theme switches off the top and the location out from beside the list it describes — the reader loses sight of what the list is *of* in order to read it.
  And with nothing entered at all there is no list and no Now panel, and the footer sat under three short paragraphs with the ground showing below it for the rest of the screen.
  One shell answers all three, and the layout no longer changes how it scrolls depending on what happens to be open.
  `minmax(0, 1fr)` and not `1fr`: the row has to be allowed to shrink below its content, or the panes have no height to be bounded by and the whole thing scrolls as one again.
  `main` stretches both columns to that row, and the three panes that can outgrow it — the left column, the list, and the guide's body under a head that stays — each carry their own `overflow-y`.
  Three consequences worth naming.
  The shell is scoped to `:has([data-guide='open'])`, because with no pass open the page is an ordinary long document and should scroll like one; nothing about compact changes, and the sheet is still `position: fixed` over a page whose scroll it locks (D-117).
  `100dvh` and not `100vh`: on a phone in landscape past the breakpoint the dynamic unit is the one that does not hide the footer behind the browser chrome.
  And the guide's head is pinned rather than scrolled away, because the close control is what someone reaches for after reading to the bottom of a long guide.
- **D-120 — The wide footer is one row, and it says who made the page.**
  D-119's shell holds the footer on screen for as long as a pass is open, and four rows of provenance is not what that space is for — on a 900 px viewport they were most of what the three columns lost.
  So the footer has two forms, chosen by the layout the way `PassDetail` chooses its two shells (D-72): compact keeps the four sentences at the bottom of a page that scrolls, and wide says the same thing in one row.
  What the short form may not drop is the attribution itself.
  Every provider is still named and still linked, and CC BY 4.0 is still called by name: that is the condition the geocoding data is used under, not decoration, and a footer that credits nobody to save a row would be the one change here that is not ours to make.
  The row also carries the author's credit, linked to the profile — new in FR-X-2, which until now named only the data.
  Two smaller things came with it.
  `margin: 0 auto` centres the 80-cell frame in compact and is a no-op at wide in normal flow, but inside D-119's grid an auto margin turns off the stretch a grid item gets by default: the footer shrank to its own text and sat in the middle of the page, which is how this was noticed.
  And the character rule above the credits is a fixed 92-character string — the 80-cell frame's width — which stops short of a viewport that no longer has a frame; at wide it is the 1 px line in the rule colour that every card on the page is already drawn with, which FR-X-6 allows in as many words and which is as wide as whatever contains it.

- **D-111 — The base layer's key light waits for R22's Sun.**
  FR-DOME-8a wants the directional light along the Sun's real direction, but the prop that carries the Sun is FR-DOME-6's and belongs to R22, which puts the Sun and Moon on *both* views.
  Adding it to `SkyChartProps` in R21 would be R22's design decided a task early, so `camera.DEFAULT_SUN` (az 270°, alt −8°, inside FR-DOME-6's −18°..0° band) lights the bowl from one side in the meantime and `domeLayers` already takes a `sun` for R22 to fill in — the glow mesh and `sunDirection` are built and unit-tested here, and R22 supplies the number.
  The dome is therefore lit but its twilight does not yet point anywhere real.
  *(Closed by R22: `SkyChartProps.sun` carries the real Sun, and `DEFAULT_SUN` is now only the fallback for a chart with no instant or with the astronomy chunk still in flight.)*

- **D-112 — FR-DOME-1's finer desktop drawing is capped by the shared chart box, and the 1280 px drag rate misses 30/s for a reason outside the dome.**
  `ChartFrame` sizes every view with `--chart-size: calc(44 * var(--cell))` ≈ 422 px (R13/R15, so the dome and the polar chart are the same size and the view toggle moves nothing), and R23's wide shell puts the guide in a column narrower still.
  At 1280 px the dome therefore draws on the *same 60-column grid as the phone*, not the 120 D-91 allows: the drawing fills its container, but the container is the thing that stays phone-sized.
  Widening it changes the shared frame and so the polar view, which R21 must leave alone, so it is a follow-up for the task that owns the guide's desktop layout.

  The measurement that follows from this is the uncomfortable one.
  Under the D-62 method the dome runs at **43–44.5 rasterisations/s at 390 px** (longest frame 32–42 ms) and **27.2–27.5/s at 1280 px** (longest frame 52–58 ms), three runs each, so the desktop figure misses R21's 30/s line by about 9 % — reproducibly, not as noise.
  The grid is identical at both widths, so the dome's own rasterisation cost is identical too; what differs is the rest of the wide page, which renders the whole pass list beside the guide on every frame.
  None of R16's fallbacks addresses that: the column cap has nothing to cap at 60 columns, and `colorTolerance` would trim spans the dome is not spending its time on.
  D-91 already settled the policy — at desktop widths a 6× throttle is a phone's budget applied to a desktop panel, so the figure is a warning and the gate stays the phone at the phone's width, which clears it comfortably.
  Left for the owner: either accept the warning, or treat the wide shell's per-frame cost as its own task.

- **D-113 — The dome's rise label keeps the polar view's nesting.**
  `domeLabels` knows the pass id of the peak and end labels too, but only the rise label renders `data-pass-id`, with the name in an inner `<span data-anchor="pass">` — exactly the polar chart's shape.
  D-56 wants one selector to read both views, and the contract test and two e2e specs do; putting the attributes on one element made `[data-pass-id] [data-anchor="pass"]` match nothing, and putting `data-pass-id` on all three made "one element per pass" false.

- **D-121 — The lore reaches `lib/moonPhrases.ts` as parameters, because §3 will not let it be imported.**
  The task asks `moonPhrases.ts` to map "the Moon state and the lore file to message keys and parameters", and D-97 already settled that the lore reaches the UI through `src/state`, as the catalog does: `src/lib` may not import `src/data`, types included — `import-x/no-restricted-paths` has no type exemption, so even `import type { LocalizedText }` fails the lint.
  So the file declares the shape it needs (`LocalizedLine = Record<Locale, string>`, and a `MoonLoreEntries` of the three entries a line is built from), and `MoonLore.tsx` looks the entries up through `src/state` and hands them in.
  The structural type is the real one — `data/moon`'s `localizedSchema` is declared `satisfies z.ZodType<Record<Locale, string>>` — and `moonPhrases.test.ts` passes the actual `lore.json` entries through the function, so a change to the file's shape fails there rather than at a type boundary that does not exist.
  What stays in `src/lib` is every decision: which sign, whether the folk name shows, which one-liner, and which language's string.
  What stays in `src/data` is the lookup.
  `signAtLongitude` is still the single definition of where a sign starts (D-97), and R30 calls it rather than recomputing the 30° bands.

- **D-122 — The Moon's facts are the Now panel's last line; its tradition is a section of its own.**
  FR-MOON-3 puts the phase, the illumination and the direction "in the Now panel", and FR-DESK-2 lists "the Now panel and the Moon line" as two items of the left column.
  Both are satisfied by one arrangement: `MoonLine` renders inside `NowPanel`, above the "as of" stamp that dates every fact in the panel, and `MoonLore` is a separate `<section>` below it on the page.
  The split is FR-MOON-5's, not the layout's — an observing fact and a tradition must not share a block, and the requirement that "the observing facts are separate lines that never depend on the tradition text" is only checkable if they are separate elements.
  `NowPanel.test.tsx` asserts the panel carries no tradition text, and the e2e asserts the lore line appears in neither the panel nor the pass list.

- **D-123 — The tradition line carries the phase's one-liner at the four cardinal phases and the sign's on the nights between.**
  FR-MOON-4 puts a curated one-liner in the file for every phase *and* every sign, and US-18 AC3 asks the line to carry one of them, so something has to choose.
  The rule is the phase: at new, first quarter, full and last quarter — the moments the old calendars turn on, which is what those entries are about — the line is the phase's; on the nights in between the phase is unremarkable and the line is the sign's, which is also the thing the sentence has just named.
  Every phase and every sign comes round within a month, so both halves of the hand-reviewed file are actually read, and the choice is a pure function of the Moon, so the line is stable through a night and pinned by a test.
  The alternative considered and dropped was showing both lines: two sentences of tradition beside three of fact reads as the page's subject, which FR-MOON-5 and §2.2's non-goal are both about.

- **D-124 — "Within a day of full" is measured in phase angle, and the folk name's month is the observer's.**
  FR-MOON-4 shows the folk name "within one day of full".
  The Moon has no `t` to compare against without solving for the instant of full, and the phase angle it already carries is the same fact in another unit: full is 180°, and a day is 360°/29.530589 ≈ 12.19° of it.
  `showsFullMoonName` is therefore `|phaseAngle − 180| ≤ 12.19°`, one comparison on a number the worker already computed, with no second astronomical solve and no clock.
  The month is a separate matter: the names are a calendar-month list, so the month is the one the reader is standing in, `calendarMonth(t, timeZone)` in `lib/timeFormat.ts` (Intl, no `Date`, D-15) — a full Moon at 02:00 UTC on the 1st is still December's for an observer three hours west, and the test pins exactly that case.

- **D-125 — The label and the guide's sentence are one component, and the thresholds come from the state.**
  FR-MOON-2 puts a `[moon glare]` label on the card and a sentence in the guide, both "with the thresholds in the tooltip", so `MoonGlare.tsx` exports the two and shares one trigger-and-tooltip between them, drawn the way `CloudBadge` draws its own (R12): a focusable element, the tooltip as its accessible description, opened by hover, focus or a tap.
  Neither re-tests a condition — both render exactly when `Pass.moonGlare.glare` is true, which is the worker's single evaluation at the peak (D-109) — and neither writes a threshold into its copy: `DEFAULT_MOON_GLARE_THRESHOLDS` is re-exported from `src/state` beside `DEFAULT_THRESHOLDS` (D-27) and formatted by `moonGlareFacts`, so the OQ-12 answer that moves 50 % or 30° moves the tooltip with it in both languages.

- **Reserved for the wave starting on 2026-09-04, after R21 and R23 merged: R30 takes D-121 to D-125, R25 takes D-126 to D-130.**
  D-110 hands the numbers out in advance and asks each wave to append its own reservation as the last entry before it runs, so this is that entry and nothing more — it decides nothing and consumes no number of its own.
  The two tasks are the ones the driver selects: `ui` goes to R30 rather than R27 because R30 is ready and stands earlier in TASKS.md, and `data` goes to R25.
  A session numbers only inside its block, and the numbers it does not use stay unused.

- **D-126 — The service worker is registered by `state/serviceWorker.ts`, not by `virtual:pwa-register`.**
  D-79 chose `vite-plugin-pwa` for the precache manifest, which is the part that is tedious to hand-write.
  Its registration helper is a separate offer, and taking it would put "an update is waiting" in two places: the helper's own closure and the store the banner reads.
  Instead the module registers `/sw.js` itself — thirty lines against the plain `navigator.serviceWorker` API — and reports a waiting worker through the `appUpdate` slice, which is what R28's `UpdateBanner.tsx` reads.
  `applyUpdate` is a *function* in the store rather than a flag, so the banner posts nothing and knows nothing about workers: the registration hands it whatever "let the waiting version through" means for the worker actually waiting, and is the only place `SKIP_WAITING` is spelled.
  The lifecycle is then testable without a browser (`serviceWorker.test.ts` scripts `updatefound` → `statechange` → `controllerchange` over a fake container), including the two cases that decide whether a banner is a bug: a worker installing with no controller is the *first* install and offers nothing, and a `controllerchange` nobody asked for does not reload the page.
  Production-only is a default argument (`import.meta.env.PROD`) rather than a caller's `if`, so "a dev build registers nothing" is a test and not a convention.

- **D-127 — The manifest is hand-written and the icons are drawn from the tokens by a script.**
  `vite-plugin-pwa` can generate the manifest from its config, but FR-OFF-6 fixes what it must say and the file is then a fifteen-line constant: keeping it at `public/manifest.webmanifest` means the deployed bytes are in the repository, reviewable and pinned by `tests/deploy/manifest.test.ts` the way `public/_headers` is (D-25), rather than assembled at build time.
  The icons come from `scripts/build-icons.ts`, which writes 8-bit RGB PNGs with `node:zlib` and no image dependency: a 16 × 16 cell grid — the grid the whole app is laid out on — carrying a pass arcing over a horizon rule, in `--chart-pass`, `--chart-peak` and `--chart-horizon` on `--bg`, so the identity is the tokens and a theme change is a one-line edit and a rerun. 16 divides both 192 and 512 exactly, so the two files are one drawing at two resolutions with no resampling, and the drawing stays inside the central 80 % a maskable icon is cropped to, which is why two `any` icons are enough and there is no third file.

- **D-131 — The four open dome and live-page tasks go back on Fable, with a per-run override for the retry.**
  D-88 moved every v1 task to Opus because R16's Fable session hit the account's limit, and the six tasks on Fable were one dependency line — the argument was never that Fable was the wrong model for them, only that the phase could not afford a second limit.
  On 2026-09-04 the owner made Fable the account's default model, and the question came back with the queue at ten tasks.
  The §16.6 criterion is applied as written: R22, R32, R33 and R34 — the live marker in both views, the live page, the time stripe and playback, landscape and compass follow — are captures, snapshots and a ≥ 30 updates/s drag rate the session can produce and check itself, so their `Model:` is `fable` again; R16 and R21 are merged, so nothing is re-run.
  R31, R26, R27, R28, R35 and R36 stay on Opus for D-88's reason: a hash a stranger's device must parse, an LRU over stored observers, one line of offline copy in two languages, `SKIP_WAITING` and "nothing swaps under an open pass", a single `keydown` guard and the release table are where a plausible wrong answer is the expensive kind.
  What D-88 feared is answered by a flag rather than a policy: `--task <id> --model opus` reruns a task stopped by a limit on the other model, for that run only, so a Fable stop costs one deleted branch and not an edit to `main`.
  The wave still runs every task on the model TASKS.md prints — `--model` is refused on `--wave` — and the four are consecutive on the `ui` and `chart` lanes, so at most two of them are ever running at once, which is the exposure the phase accepts.

- **D-132 — A wave runs concurrently, capped at three, and the live page is its own lane.**
  The driver's loop was `for … await runTask`: §16.2's "at most two at once" was only a selection cap, and the two tasks of every wave so far ran one after the other — about seventy minutes for work that overlaps to forty.
  Of the ten tasks open on 2026-09-04, eight are `ui`, and one per lane makes them a chain of eight waves whatever the cap says; `data` and `chart` are done after the first two.
  The live-page tasks R32, R33 and R34 sit in `ui` by the lane's definition, not by the files they touch — `screens/Live*`, their own components, the stripe and playback geometry — so they become the `live` lane (§16.1), and the chain is five waves: R31 · R26 · R22, then R27 · R32, R28 · R33, R35 · R34, and R36.
  Three at once is the ceiling one machine with ten cores and 16 GB carries while each session builds, runs vitest and drives Chromium; four would be the memory, not the cores.
  Running two sessions on one machine needed two fixes before the loop could change: Playwright pinned port 4173 with `reuseExistingServer` on outside CI, so the second session's e2e would have adopted the first session's preview — silently, against the wrong build — and now takes `E2E_PORT` from the driver and never reuses a server under `SDD_HEADLESS`; and `git worktree add` / `remove` write the shared `.git`, so they are queued while everything else overlaps.
  Two things are accepted rather than solved.
  R22 and R33 measure a drag rate under 6× throttle, and a build beside them lowers it — the D-62 method already treats the number as one to re-measure alone if it falls short, and the PR carries it either way.
  And with two models in a wave (D-131), the Opus tasks and the Fable task draw on two limits at once rather than one, which is a reason to mix the wave, not to avoid it. §16.7 stands: the driver is still a script the owner runs in the foreground, and it ends when the wave does.

- **Reserved for the rest of the phase, on 2026-09-04, so that no wave needs a reservation of its own: R31 takes D-133 to D-137, R26 D-138 to D-142, R27 D-143 to D-147, R22 D-148 to D-152, R28 D-153 to D-157, R32 D-158 to D-162, R35 D-163 to D-167, R33 D-168 to D-172, R34 D-173 to D-177, R36 D-178 to D-182.**
  D-110 hands out a block per task before it runs and asked each wave to append its own entry; with the queue at ten tasks and the waves now concurrent (D-132), one entry for all of them costs the same numbers and removes an owner PR from the front of every wave.
  A session numbers only inside its block, and the numbers it does not use stay unused.
  A task added to the phase later takes the next block after D-182.

- **D-133 — The ISO-8601 instant of a share link is converted by arithmetic, inside `lib/shareLinks.ts`.**
  FR-SHARE-1 and FR-LIVE-9 write the instant as ISO-8601, and §3 puts `shareLinks.ts` in `src/lib`, where D-15 bans the `Date` global outright — `no-restricted-globals`, with `physics/time.ts` (the epoch-ms ↔ `Date` converter) as the single exemption.
  The two ways out were a runtime exception to §3 for `physics/time.ts`, the way D-80 gave `lib/skyBodies.ts` one, or twenty lines of civil-date arithmetic here.
  The arithmetic wins on both counts that matter: `src/lib` stays the pure layer with no exception to remember, and the task stays inside the `ui` lane, which owns `src/lib/shareLinks.ts` but not `src/physics` (§16.1) — a lane-crossing edit to add a parser to `physics/time.ts` would have been the larger change.
  `daysFromCivil` / `civilFromDays` are Howard Hinnant's, exact in doubles over any date a URL can carry; the parser requires a zone designator (a link without one names no instant) and rejects an impossible date by round-tripping it, so `2026-02-30` is not silently the 2nd of March.
  The test file is exempt from the ban, so `Date` is the independent implementation both directions are checked against, over 500 instants spanning fifteen years either side of the fixture.

- **D-134 — `coordsLabel` and `observerFromCoords` moved from `CoordsInput.tsx` to `lib/place.ts`.**
  A link arrives as bare coordinates and has to become an `Observer` before the first render (D-135), which happens in `src/state` — and §3 forbids `src/state` to import `src/ui`.
  Rather than a second definition of "the observer you get from a pair of coordinates", the pair moved down beside `observerFromPlace`, which is the same function for the other input, and `CoordsInput.tsx` re-exports both so every existing importer keeps its name for them.
  Nothing else changed: the label is still `−38.93, −67.99` with the real minus sign, and the source is still `coords`.

- **D-135 — A link's observer wins over the saved one, is set before the effects, and is saved like any other.**
  `startApp` reads the hash before wiring the effects and calls `setObserver` with the link's observer instead of `restoreSavedObserver`, for the reason R24 moved the restore in front of the effects: the chain then runs once, for the place the link names, instead of computing the saved location's passes and dropping them a tick later.
  Someone who opens a link asked to look from there, so the link wins; and it goes through `setObserver` like every other way of setting a location, which means the store's write-through saves it.
  That the recipient's saved location is replaced is the intended consequence and not a side effect: the app has one observer, the one you are looking from, and the next visit opens where the link left them.
  `#pass=<id>`, the local selection hash, carries no observer and changes nothing here.

- **D-136 — One `ShareButton`, three strings, and the link is never left unreachable.**
  The button takes `url`, `title` and `text` and nothing about passes, so R32's live share hands it the same three props with `#live?…` in them; `PassDetail` builds the link, because the observer and the pass are what identify it (D-83) and the page's own URL is what it is relative to.
  It sits at the end of the guide, below the numbers, in both of D-72's shells.
  A dismissed share sheet (`AbortError`) says nothing and copies nothing — the person changed their mind; any other refusal falls through to the clipboard, and a refused clipboard shows the link in the confirmation line to copy by hand.
  The confirmation is a `role="status"` present from the first render, so the copy is announced when it happens rather than when the region appears, and it clears after four seconds.
  The e2e deletes `navigator.share` before the page loads: the clipboard branch is the one a headless browser can assert, and a share sheet is the operating system's.

- **D-137 — FR-SHARE-3's message is one info banner above the list, and `alt` is the only optional coordinate.**
  The recipient's device recomputes from its own "now", so `resolvePassLink` answers *same* (within D-33's two minutes), *nearest* (that object's closest pass in the window, which then opens) or *none*.
  Both of the last two say so in a banner above the pass list, naming the object and the instant the link was made for; the name comes from the pass when there is one and from the catalog when there is not, which is the only way the *none* branch can name anything.
  The banner waits for `passes.status === 'done'`: before that, "no pass" only means "not yet".
  In the hash itself `lat` and `lon` are required and `alt` is not — a missing altitude is sea level, the same default the coordinate form uses, while a missing latitude is a broken link — and every malformed or partial hash parses to `null`, which is the home screen with no error anywhere (a stranger's URL is arbitrary text).

- **D-138 — A favourite is its 0.01° cell, and the field says so.** §5 declared `Favourite.id: string` without saying what makes two saved places the same place, and something has to: without an answer, "save this place" twice puts two entries in a list of eight, and the second one evicts a real place to say what the first already said.
  The answer is already in the codebase — `PassRun` is keyed by the observer rounded to 0.01° (D-78), about a kilometre, inside which the same pass looks the same — so a favourite is identified by that same cell, and the field is called `cellKey` rather than `id` so it cannot be read as an opaque handle.
  Saving a place in a cell already on the list refreshes that entry, taking the new label and the new `lastUsedAt` while keeping the original `addedAt`.
  What this buys beyond the deduplication is that a favourite maps to at most one stored run, which is the only reading under which FR-OFF-7's "offline data for the active place only" is a countable promise: three saved places and two kept runs (D-78) means the active one and the one before it, and R28's list can say which of its entries will still answer with no signal.
  The eviction is `data/favourites.ts` — four pure functions over an immutable array, the list held newest use first so the eviction is the tail of the sort — and both `localPrefs` (on read, so a hand-edited store is still eight at most) and the prefs slice call them rather than each holding the rule.

- **D-139 — Selecting a favourite is a `setObserver`, and nothing downstream learns that favourites exist.**
  The recompute FR-OFF-7 asks for is FR-VIS-5's, which the store already starts on every observer change, so `selectFavourite` stamps `lastUsedAt`, writes the list back and calls `setObserver` with the observer the favourite carries.
  No effect, no worker message and no cache gains a branch: the stored run, the forecast and the job all run exactly as they do for a typed location, which is also why a selection works offline — the favourite holds the whole `Observer`, `timeZone` included (D-85), so there is nothing to look up.
  The two write-throughs sharing one key stay out of each other's way for the reason R12 already relied on: each re-reads the stored object and replaces one field of it, so the selection's `lastUsedAt` and the observer it sets both survive, whichever runs first.
  The prune then needs no notion of an active place either — it keeps the two most recent runs and the run just written is the active one's, so the active place's offline data is the last thing to go, which `effects.test.ts` proves over three places and the real cache rather than by reading the prune's code.

- **D-143 — Readiness is a statement about the data, not about the clock, and `offlineUntil` is both bounds or neither.**
  `readiness()` takes the passes on screen, their `storedAt`, the forecast in use and whether an element set is loaded, and never reads `now` — how old something is, is the caller's sentence, and a pure function of the data is what a test can pin.
  Two rules follow.
  The forecast's end is its **last hourly sample**, because that is the last instant `interpolateCloud` answers for and past it every badge already reads "unknown" (FR-OFF-3): the end of the app's ability to say anything about the sky, not the end of the response's array.
  And "ready offline until" is a promise about the whole answer, so it is `min(last pass end, forecast end)` when both exist and `null` when either does not — a date covering the passes while the weather has already run out would be the wrong promise, and the gap is named instead.
  `missing` and `offlineUntil` are computed independently and can both be true at once (a stored run standing in while this session's elements load failed): the line reads `missing` first, because what to go and fetch is more use than a date that will not survive the fetch.

- **D-144 — The line waits for a settled answer, and the storage row is its own row and only for a stored run.**
  A first visit spends seconds loading elements and computing, and "not ready offline" during those seconds is a verdict on a job in progress rather than on the device, so `ReadinessLine` renders nothing until one of three things is true: a finished run, a stored run standing in for one (D-105), or an elements load that failed — which is the cold start with no signal the line exists for.
  `storedAt` is null for a list this session computed, and the storage time then has no row at all; FR-OFF-4's "and the storage time" is about the run that came out of the store, which is the only one with an age.
  It is a second row rather than a clause, because one row is what the sentence has (D-145).

- **D-145 — The stamp is a date and a clock to the minute, which is what makes the sentence fit one row at 390 px.**
  A 390 px phone inside the page's two cells of padding is (390 − 4 × 9.6) / 9.6 = 36.6 characters (D-71), and `t.passes.stamp` — the page's usual stamp, with seconds and the zone abbreviation — spends 26 of them.
  Seconds are noise in a statement about the next three days and the zone is named by every other time on the page, so `lib/timeFormat.ts` gains `formatShortClock` and the line reads `Ready offline until 2026-09-14 21:14` (36) / `Sin conexión hasta 2026-09-14 21:14` (35).
  Both catalogs are held to 36 characters by `messages.test.ts`, at the point where a translator would grow the copy, and the e2e measures the rendered box against its own line height at 390 px in both languages.
  The "not ready" wording is *not* held to one row: it names up to three missing things, it is the state the reader is meant to stop and read, and FR-OFF-4 quotes only the ready sentence.

- **D-146 — The list's nights are the worker's nights, named from the reader's own clock, and one night is no grouping.**
  `ui/components/passes/nightGroups.ts` restates D-95's rule — a night owns the passes whose *start* falls in its 24 h slice of the run's window, the last night keeping everything from its start on — because §3 forbids `src/ui` to import `src/worker`; a test asserts the two agree pass by pass, so the groups on screen are the groups that were computed.
  Every night of the window is returned, empty ones included: a heading that says "no visible passes" is a truthful answer about that night, and a group that vanishes leaves the reader counting.
  The heading is a `<details>`/`<summary>`, so the open state, the keyboard and the accessibility tree come from the element and no ARIA is written by hand — which also means a closed night's cards leave the accessibility tree, and two e2e locators that counted cards by role now read the DOM instead.
  The label is "Tonight" only while the night begins on today's date in the observer's zone and "Tomorrow night" only on the next, so a stored run computed yesterday names its first night by date instead of calling a night that has passed tonight; the night open by default is the first still holding a pass that has not ended, which is tonight for a fresh run and the first night still worth reading for an old one.
  A window of one night — every list before R24, and the MVP shape — renders the plain `<ol>` with no disclosure at all: there is nothing to tell it apart from.

- **D-147 — With no connection the place search is not made, and it does not retry when the connection returns.**
  FR-OFF-8 asks place search to fail soft, and the soft failure is not a timeout: `ui/hooks/useOnline.ts` (a `useSyncExternalStore` over the `online`/`offline` events, beside `useLayoutMode` for D-116's reason) tells `PlacePicker` there is nothing to ask, and the line under the field says so and names the two inputs that still work — the device button and the coordinates.
  `navigator.onLine` is used only in that direction: it is a floor, true on a wifi that goes nowhere, so it can say "certainly do not ask" and never "this will succeed", and the existing failure branch still handles everything else.
  Nothing is retried on reconnect; the message is derived from the text and the flag, so it clears itself, and the next keystroke or Enter searches.
  An automatic retry would fire a request for text the reader may have abandoned minutes ago.

- **D-148 — The astronomy is a chunk of its own, reached by a dynamic import, and budgeted.**
  D-80 makes `lib/skyBodies.ts` the one file in `src/lib` that runs `src/physics` rather than only naming its types, and R22 is where it is first called.
  Imported statically it would drag `astronomy-engine` into the *main* chunk — 22 KB gzipped of the app's first paint, for two markers on a drawing the reader has not opened yet — and importing it from `dome/` instead would leave the polar view, which is in the main chunk, without a Sun.
  So `useSkyBodies` loads it with `import()`, once per session, shared by every chart on the page: `skyBodies-*.js` is its own chunk, and the drawing before it lands is the drawing of an instant nobody has named, which is complete without a Sun or a Moon.
  It gets a **30 KB budget** in `scripts/bundle-budget.ts` (22.0 KB measured), for the reason the service worker has one and the other lazy rows do not (§11): the app actually fetches it.
  The lint rule that enforces §3 gains this file, and only this file, as an exception.
  The eslint `ignores` is a *replacement* of the rule for that path, so the "no React in `src/lib`" block above it still covers it, as does the D-15 "no `Date`" block.

- **D-149 — The Sun and the Moon are `SkyChartProps`, and `SkyChart` evaluates them when the caller does not.**
  PLAN §8.8 already has the live page passing `sun` and `moon` in, because FR-LIVE-5 caps it at one evaluation per second of wall time while `t` runs at 3600×.
  The detail sheet has no such caller, and putting the evaluation inside each view would run it twice on a page that shows both, and would have to be written twice.
  So the two are optional props resolved by `useSkyBodies` in `SkyChart.tsx`, the one file that already knows two views exist: given either prop — including as an explicit `null` — the caller owns both and no import is made at all; given neither, the hook evaluates at `now` and hands the result to whichever view is mounted, so the view toggle cannot move the Sun.
  A chart with no `now` draws neither body: FR-DOME-6 is "at the shown instant", and no instant is no answer rather than a wrong one.

- **D-150 — The flown part is a second strip over the arc, cut at the marker.**
  FR-DOME-5 asks for the flown part in the flown colour, which could have been one strip whose quads change colour at `now`.
  It is two: `lib/skyGeometry.splitArcAt` cuts the resampled arc at the instant and both halves keep the cut point, so the flown strip ends exactly under the live marker with no gap and no overlap, and the dome draws it as its own mesh at radius 1.004 — a hair outside the arc, the trick the markers already use, so it wins the raster in the cells the two share.
  Splitting in `lib` rather than in either view is what makes "the same geometry" true of a requirement that is about time: the polar view's flown path and the dome's flown strip are the same list of points, and the cut is unit-tested at a sample, between two samples and at both ends rather than eyeballed.
  The colour is the only channel that separates the two halves, which FR-X-5 would normally object to; what stands in for the second channel is the live marker itself, which sits on the boundary, and the arrowhead at the far end.
  If the owner wants more, a dash on the flown half is one line in each view.

- **D-151 — One module holds the two bodies' reading, and it holds no astronomy.**
  `skychart/bodies.ts` is where both views get the glow's ramp, its width and height, whether each body is drawn at all, and the Moon's phase glyph — so FR-DOME-7's "both views tell the same story" is a shared function rather than two agreeing implementations, and so the module stays in the main chunk while `astronomy-engine` does not (D-148).
  Two readings are decided here.
  **Above the horizon the glow stays at full strength** rather than switching off: FR-DOME-6's −18°…0° band is where the glow *grows*, and a live page at midday drawing no Sun at all would be a worse answer than one drawing it at its brightest.
  And **the phase glyph is geometric, not emoji**: 🌑–🌘 map one-to-one onto our eight phase names, but a colour emoji keeps its own hue in the night theme, which FR-THEME-3 allows no element to do, and reads against FR-X-5's monochrome requirement.
  The geometric set covers seven of the eight — lit on the right waxing, on the left waning — and the two gibbous phases share one glyph, Unicode having no mirrored three-quarter circle; both read as "nearly full", and the phase's name is written out on the Moon line and in the Now panel anyway (R30).

- **D-152 — The polar view takes the chart colours from CSS, with no palette probe.**
  D-75 reads the `--chart-*` tokens through a hidden element because glyphcss needs a concrete colour string per polygon.
  SVG needs nothing of the sort: `SkyPolar.module.css` names the tokens directly, so FR-DOME-2 and FR-THEME-3 cost the polar view a stylesheet edit and no code, and a test over the file holds every mark to a `--chart-*` token and forbids the general `--fg`, `--fg-dim`, `--accent` and `--warn` it used to reach for.
  One thing went with the colours: `.passDim` lost its `opacity: 0.55`.
  `--chart-pass-dim` is already the dim end of the scale and R16 measured its contrast there; multiplying it by an opacity would put it under the 3 : 1 the token was chosen to clear.
  The dim pass keeps its second channel in the thinner stroke it already had (FR-X-5).

- **D-158 — The live page colours through the chart: `colorBy="pass"`, `fill`, and six series tokens.**
  FR-LIVE-2 wants every arc of the coming 24 h in its own hue and FR-LIVE-10 forbids the page from drawing a satellite by any path but `SkyChartProps`, so the colouring has to be the chart's — and `SkyChartProps` had no way to ask for it, while §8.1's `fill` was planned and never built.
  Both are one optional prop each, with the guide's reading as the default so nothing the detail sheet renders changes: `colorBy: 'pass'` draws every arc at full weight in `--chart-series-1..6` by its place in `passes`, cycling after six, with the rise label only (twenty arcs do not want twenty peak and end labels); `fill` drops the caption and the square box, names the figure instead (the strip is its text alternative, FR-GUIDE-7) and lets the drawing take the box it is given.
  The dome maps the tokens through the D-75 probe like every other meaning; the polar view maps a `data-series` number to the token in CSS, so D-152 still holds and no inline colour is written.
  The night set is six *reds* spaced by lightness inside FR-THEME-3's 30° band, because that theme has no other hue to give; the second channel (FR-X-5) is the satellite's name on every arc.
  These files are the `chart` lane's and this is a `live` task: the crossing is recorded rather than hidden, and it is safe because no chart task exists that would add them, none runs in this wave, and the change is additive under the existing contract test.

- **D-159 — The sky state is restated in `lib/skyBodies.ts`, and held to the worker's function by a test.**
  FR-LIVE-3's "sky state in words" is `skyState(sunAltDeg)` in `physics/now.ts`, which the page cannot import (§3) and which the astronomy chunk must not reach either: `now.ts` is the whole Now pipeline, satellite.js included, and the chunk is budgeted at 30 KB (D-148).
  Three lines are restated over the same two thresholds from `physics/constants.ts`, `skyBodiesAt` returns `sky` beside `sun` and `moon`, `useSkyBodies` passes it through, and `skyBodies.test.ts` sweeps −90°…90° and both edges against `physics/now.ts`'s own answer, so the two cannot drift.
  Measured: the chunk stayed at 22.1 KB.

- **D-160 — The strip's count is the number of markers on the dome: the passes whose interval contains `t`.**
  FR-LIVE-3 asks for "the count of satellites visible at `t`".
  The Now pipeline's answer is per object at an instant (`NowState.items`), and the page cannot ask it per tick without the worker call FR-LIVE-5 forbids, nor for a `t` the link named.
  The passes are what the page has and what it draws, so the count is `visibleCount(passes, t)`: exactly the arcs carrying a live marker, which is also what the reader sees.
  The two can differ where D-102 says they can — an object visible but too faint at its peak for a pass, or in the last seconds of a pass while it dims — and the e2e holds them equal at the golden instant, where the Now panel's one satellite is the one pass under way.
  R33's hidden objects are the place a second count would belong, not this field.

- **D-161 — The dome's zoom follows the shorter side of its box.**
  D-91 took the zoom from the box's width, which is its height on the guide's square.
  The live page's box is what the viewport leaves after the controls and the strip: 1240 × 450 px on a desktop, where a width-based zoom put north and every label near it outside the box.
  `layoutFor` now uses `min(width, height)`, with the height falling back to the width where none is measured, so the square is unchanged to the pixel and the wide box draws the whole dome.
  The base layer takes the line layer's zoom as before (D-92).

- **D-162 — The live route replaces the shell; a link with an unreadable `t` still opens the page; the count of things around the dome is what the phone can afford.**
  Three readings of the task text.
  (1) FR-LIVE-1's "fills the viewport" is taken as *instead of* the home page, not over it: `App` returns the lazy `LivePage` alone under `#live`, so there is no header behind it — which is why the page carries the language and theme switches itself (D-94's reason) and the return control, and why `Esc` is its own listener until R35's app-wide one.
  Leaving is `replaceState` to a bare URL plus a synthetic `hashchange`, so the pass selection and the route, which both read the hash, agree at once and the Back button never returns to the page.
  (2) FR-LIVE-9's "a bad `t` falls back to real time": `parseHash` keeps the observer of a `#live?…` whose `t` it cannot read and answers `t: null`, so the place in the link is still looked from; the bare `#live` and a link that does not parse at all still *open* the page (`isLiveRoute`), which then says it has no observer.
  The window of passes is always real time's coming 24 h, whatever instant inside it the link shows, and the share action writes `t` only when the page is showing one.
  (3) At 390 px the top row wraps to three lines and the dome's controls and status rows stay, which leaves the dome about 330 px tall in portrait; R33's stripe will want that space and R34 lays the page sideways, so the portrait tightening is left to them rather than pre-empted here.

- **D-153 — "Shown once" is a latch, and the two browsers get two different hints.**
  FR-OFF-6 asks for an install hint "shown once… dismissible and remembered", which leaves open what counts as having shown it.
  The answer taken is the strictest one: `installHintDismissed` in `wiys:prefs:v1` is written `true` and never written back, and *everything* the reader can do with the hint writes it — Install, Not now, and the `appinstalled` event, which covers an install that happened by some route of the browser's own.
  The reason to prefer this over, say, remembering only an explicit dismissal is that the other branch has no answer for the reader who taps Install and then closes the browser's dialog: `beforeinstallprompt` cannot be replayed, so a hint that survived that would come back on the next visit offering a button that no longer works.
  Only `true` is stored and only `true` is read (a stored `false` reads as absent), so the key exists on exactly the devices that have answered.
  The two browsers then get two shapes, because they have two mechanisms: Chromium fires `beforeinstallprompt`, which the component cancels — the offer moves into the app's own language and away from the mini-infobar — and holds, so its button opens the real dialog; iOS never fires it, and the hint there is a note naming the two taps of the share sheet, with no Install button, since a button that cannot install would be a lie.
  What tells them apart is `navigator.standalone`, which only Safari defines: `false` is an installable iOS tab, `true` is the app already installed and nothing is said at all.
  It is read through an `InstallEnv` prop, the shape `UseMyLocation` already uses, so both branches are unit-tested without a browser.

- **D-272 — "Not now" writes an expiry and a count; only the third decline writes D-153's latch.**
  (SPEC v1.1.2, V11-15.) D-153 read FR-OFF-6's "shown once" as strictly as it could be, and the owner found the consequence: one *Not now* and the offer was gone for the life of the browser's storage.
  What that reading was really protecting is still true and is kept — a reader who taps Install and then closes the browser's own dialog must not be offered a button that cannot work, because `beforeinstallprompt` cannot be replayed within the page — so Install, and `appinstalled` by any route, still write `installHintDismissed` and end the offer. "Not now" instead writes `installHintDeclines` (a count) and `installHintSnoozedUntil` (an epoch), both optional in the `wiys:prefs:v1` zod schema and both absent on a device that has never declined, so no migration is needed and an old device reads as a device with no declines.
  `lib/installSnooze.ts` holds `INSTALL_SNOOZE_DAYS = [7, 30]` (FR-VIS-6, with the rationale beside it) and one pure function from `{ dismissed, declines, snoozedUntil }` and an instant to `shown | snoozed | answered`, so the rule is unit-tested without a component and `InstallHint` only asks.
  The decline after the last entry — the third, by default — writes the latch instead of an expiry, which is how "declined three times" ends up being the same stored fact as "installed".
  The clock is read once per mount (`Date.now()`), not ticked: the hint is a banner on the home screen, and a snooze that expires while the reader is looking at the page can wait for the next load.
  The browser's own offer is still what gates the Chromium shape — an expired snooze shows nothing unless `beforeinstallprompt` has fired again on this load, which is exactly the condition under which the button works.

- **D-260 — The settings page's install action is the same offer without the banner, and it reads the browser rather than the answer.**
  (SPEC v1.1.2, V11-16; R52's block.) `InstallHint` decides three things at once — is there anything to install, has the reader answered, and which browser is this.
  The settings row wants the first and the third and not the second, so the pair is split rather than duplicated: `installOffer.ts` already holds what the browser said, `browserInstallEnv()` already says which shape applies, and a small `InstallAction` in `components/common/` renders whichever of the two the environment calls for — Chromium's button over the held event, or the iOS note's two taps — with no decline beside it.
  `InstallHint` keeps the snooze (D-272) and wraps that same action; the settings row does not ask `installOfferVisibility` at all, which is what makes it survive the third decline.
  Taking it calls the same `dismissInstallHint`, so a reader who installs from settings is not offered the banner afterwards.
  Nothing new is stored, and the row simply does not render when the browser has nothing to offer — which is also what "already installed" looks like from here.

- **D-261 — The compact header gets a short title, and the page you are on keeps its control rather than losing it.**
  (R52; FR-COMP-1, FR-COMP-4.) The header's row has 36 cells and "What is in your sky right now" is 29 of them, before `[ live ]` and `[ settings ]` have said anything — so compact gets `app.shortTitle`, "Your sky" / "Tu cielo", which US-5 AC2 allows (a label may differ between the widths; the meaning may not) and FR-COMP-4 makes necessary.
  The full name is still the document's title (FR-I18N-5), which is where a reader who wants it looks.
  The second half: on the settings page `[ settings ]` becomes a dim `span` with `aria-current="page"` rather than disappearing.
  Removing it would move `[ live ]` sideways between the app's two compact screens, and a header whose contents shift is one the reader has to read again each time; the approved mockup draws it the same way.

- **D-262 — The clear action is lifted out of the location section by a prop, and the language switch's alignment stops being the switch's own.**
  (R52; FR-COMP-2, FR-DESK-2.) FR-COMP-2 orders the settings page saved places, *install*, clear saved location, and the approved 390 px mockup draws the clear as a control on a line of its own at the end.
  `LocationInput` had it inside the "saved in this browser only" sentence, above the saved places — which is where the approved desktop mockup has it, so this is two placements of one operation and not a change of mind.
  So `showClear` (default `true`) keeps the wide panel exactly as it was, and `ClearSavedLocation` — reading the store directly, as `Favourites` does, since every location operation is the store's (D-139) — is rendered by `Settings.tsx` last.
  The reseed that follows a clear now carries the focus in both cases (F-29's effect sets `focus` when the new observer is `null`), because the settings page's control is removed by the very change it makes.
  `LanguageToggle`'s `justify-content: flex-end` moved out to its callers for the same reason: it was written for the header's right-hand group, and on a page read top to bottom it pushed the one row of the Language section away from every other row's left edge.

- **D-263 — The control-row fit test reads the brackets out of the stylesheets, and applies a state's decoration only to the element in that state.**
  (R52; FR-COMP-4, D-193.) A row's width is its text plus two things that are not in its `textContent`: the square brackets `::before` and `::after` paint, and the gaps between controls.
  `tests/styles/cells.ts` parses the `content` of every `::before`/`::after` rule in the row's own CSS modules and matches them back to the rendered elements by the local class name Vite's `_local_hash` carries, so a control that gains or loses its brackets changes the count with nobody remembering to update a table.
  The subtlety is a decoration that belongs to a state: `.option::before` is `[ ] ` and `.option[aria-pressed='true']::before` is `[x] `, which the cascade means as "four cells either way", while `.speed` has no unqualified rule at all and only the pressed one is bracketed — "two cells, on exactly one of the four" (D-245).
  So a rule keeps its qualifier and the most specific match wins, as in a browser; modelled any other way the live page's playback row measures 39 cells instead of its real 33.
  Gaps count one cell each, which is what every control row declares and what the mockups draw.
  The one thing it still cannot see is CSS wrapping, which is what FR-COMP-6's 390 px captures are for.

- **D-154 — "Nothing swaps under an open pass or the live page" is where the two offers are rendered, not a rule they enforce.**
  The task asks that no update take the shell out from under an open pass or a running live page.
  Two mechanisms were available: a guard inside `UpdateBanner` that reads the pass selection and the route and refuses to offer, or a placement that makes the question moot.
  The placement is chosen.
  `UpdateBanner` and `InstallHint` sit at the head of the left column inside `main`, which the compact layout already marks `inert` while the pass sheet is open (R6) and which `App` does not render at all under `#live` (D-162) — so on both screens the button cannot be reached, and it returns by itself when the reader closes the sheet or leaves the live page.
  What this buys over a guard is that the banner keeps knowing nothing: it reads two fields of the `appUpdate` slice and calls the function it finds there, with no notion of routes, sheets or layout modes, and the placement is held by one assertion in `App.test.tsx` plus one e2e that opens the live page with a version waiting.
  The wide layout does not make the page inert when a pass opens (FR-DESK-3 keeps it live), and there the offer stays reachable — which is correct: on a desktop the guide sits beside the list rather than over it, and a reader who chooses to reload has not lost a screen.

- **D-155 — The saved places are a panel that owns no rules: three readings and no dialog.**
  R26 put every operation in the store (D-139), so R28's panel is only a set of readings about when to draw what.
  (1) It is drawn whenever there is something to say — a place to save, or a place already saved — so a first visit with no observer carries no dead control, and clearing the location leaves the list on screen, since a saved place is then the quickest way back.
  (2) The save button stays enabled for a place already on the list rather than going disabled, because saving it again is a real operation: D-138 refreshes the label and `lastUsedAt`, which is what keeps it out of the eviction's way.
  The feedback is on the entry instead, marked `aria-current` and "(in use)", which is also the panel's answer to "which of these will still work with no signal" — the active place is the one whose run is certainly stored (D-78).
  (3) Removing is one click with nothing in front of it, which US-17 AC2 asks for by name; the cost of a mistake is re-saving a place that is one tap away.
  The limit is stated with its consequence — "Up to 8 places.
  Saving another forgets the one you have not used for longest." — because the eviction is silent and "up to 8" alone would not warn anyone that a ninth costs them one.
  Two smaller things: `favouriteCellKey` reaches the panel re-exported from `src/state`, so `src/ui` still never imports `src/data` (PLAN §3) and there is no second answer to "which saved place is this"; and the list does not use the `inline-control` trick — a 48 px box hung off a line of prose with negative margins — because stacked rows of those overlap and swallow each other's clicks, which the e2e caught.
  The rows carry the height instead.

- **D-168 — Hidden objects reach the chart as markers the page has already worded, and the crossing into `skychart/**` is recorded.** §8.1 planned `hidden?: NowItem[]`; drawn that way the chart would have to word the reason — text that belongs to the `live` catalog section, the only one R33 may extend — from a `NowState.sky` it does not hold.
  So `SkyChartProps.hidden` is `HiddenMarker[]` (an id, azimuth, elevation and a worded label), the split `labelsFor` already makes for the pass labels (FR-I18N-2): `components/live/hiddenObjects.ts` reads the reason off the item in D-96's order (too low, in shadow, daylight, too faint), subtracts the passes containing `t` (D-102), and words it as `live.hiddenLabel`.
  Both views draw them dimmed: the polar view as a hollow point in `--chart-pass-dim` with the label beside it (`data-marker="hidden"`, `data-anchor="hidden"`), the dome as a marker-sized diamond in `palette.dim` and a `hidden` label kind appended to `LABEL_ORDER`, so a reason gives way to everything else the drawing says.
  `HiddenReason` lives in `i18n/messages.ts` beside `CountdownPhase`, where message parameter shapes go.
  **Lane crossing** (the R32 precedent, D-158): `skychart/**` is the `chart` lane's, and no chart task was open to carry the prop — `SkyChart.types.ts`, `SkyPolar.tsx` and its stylesheet, `domeGeometry.ts`, `domeLayers.ts`, `SkyDome.tsx` and its stylesheet, `ChartFrame.module.css` (D-172), and `lib/skyBodies.ts` (`skyStateAt`, D-170), every one additive.

- **D-169 — The live page reaches the worker through `computeNowAt`, a handle `startApp` sets, and `computeNow` gains an options argument; the toggle is a preference.**
  The effects own the Now panel's 10 s request and write its answer to `now` in the store; the page's request is for the *shown* instant, with the dimmed set, throttled and dropped when stale (D-81), and its answer must not reach the panel or it would show the sky of an instant nobody is standing in.
  `state/liveNow.ts` holds the client `startApp` hands it and exposes `computeNowAt(observer, t)` = `computeNow(observer, t, DEFAULT_THRESHOLDS, { includeHidden: true })`; `WorkerClient.computeNow` takes `{ includeHidden }` and puts the flag on the wire only when true, so the MVP request is byte-identical (the R18 test's expectation stands). "Off by default and remembered" (FR-LIVE-6) is `liveHidden?: boolean` in `wiys:prefs:v1` and `setLiveHidden` in the prefs slice, absent until the toggle is used, like the theme.
  **Lane crossing:** `src/state/**` and `src/data/localPrefs.ts` are the `data` lane's; additive, and R28 (the `ui` task of the same wave) touches neither.

- **D-170 — The stripe's night bands come from the astronomy chunk, sampled every five minutes and recomputed once an hour; its ticks are whole hours of the observer's clock, with no `Date`.**
  `lib/timeStripe.skyBands` is pure over a sampler; `components/live/useSkyBands` dynamic-imports `lib/skyBodies.skyStateAt` — the Sun alone, not the Moon — from the chunk `useSkyBodies` already loads, so the stripe adds nothing to the first paint and D-148's budget holds (22.1 KB gzipped).
  The span's start is real time and moves every 10 s; the bands run from the whole hour before it to an hour past its end, memoised on that hour, and `nightBands` clips them at draw time; twilight lasts twenty to forty minutes, so a five-minute sample places a band's edge within a sixth of its length.
  The hour ticks need the zone offset, which `zoneOffsetMs` takes from `Intl.DateTimeFormat.formatToParts(t)` and `daysFromCivil` (D-133's arithmetic, restated), because `src/lib` may not touch `Date` (D-15); the offset is read once at the span's start, so a DST change inside the 24 h moves the later labels by an hour on the clock and the ticks not at all.
  Labels are every 1, 2, 3 or 6 hours, the finest that keeps them 40 px apart, counted from midnight.

- **D-171 — The hash follows a held instant with `replaceState`, at most twice a second and never while playing; real time is the bare `#live`.** §8.8 set the two rates; the form is the choice.
  A scrub or a pause writes `#live?lat=…&lon=…&alt=…&t=…` (FR-LIVE-9's link), so a reload or a copied URL lands on the instant; `now` writes `#live`, not the observer link, because `startApp` reads a `#live?lat=…` on arrival and would rename the saved observer to its rounded coordinates (D-135, D-162) — a reload from `#live` restores the saved observer with its own label, and the share action is where the observer goes into a URL.
  `replaceState` dispatches no `hashchange`, so the pass selection and the route see nothing; the App re-reads the hash on its next render and `LivePage`'s `link` prop changes, which is harmless because `usePlayback` takes its initial instant once.
  While playing nothing is written — at 3600× it would be a write per frame of a URL nobody can copy in time — and the pause writes the instant it stopped at.
  The page test spies on `replaceState` and holds both rates; the e2e counts writes over twenty key steps.

- **D-172 — The playback rate, measured, and the portrait budget at 390 px.**
  By the D-62 method (Chromium, Pixel 5 profile, a 6× CPU throttle, rasterisations counted from the `<pre>` mutations once per frame) over five seconds of playback at 3600×: **57.6/s at 390 px** (60 columns, longest frame 42 ms) and **46.9/s at 1280 px** (120 columns, longest frame 38 ms) — both above FR-LIVE-5's 30/s, so none of the FR-DOME-8 fallbacks (`colorTolerance`, `interactiveDownscale`, dropping the base layer) was engaged.
  `tests/e2e/live-perf.spec.ts` under `DOME_PERF=1`, a measurement and not a gate, like `dome-perf.spec.ts`.
  The Sun and the Moon are evaluated from a wall-throttled instant once a second (`useWallThrottle`, FR-LIVE-5) and the hidden request every 250 ms (FR-LIVE-6), both one `due()` rule with a trailing update so the instant a scrub stops at is always evaluated.
  Portrait at 390 px (D-162's loose end): every button is a 48 px tap target, so the controls' lines are what the dome pays for.
  Play, `Now` and the toggle are 35 cells and go first, on one 36-cell line; the four speeds are 34 cells with no gap between the options and take a line of their own; the share action a third.
  The stripe is 48 px (two rows, the tap target), the chart's hint row drops its tap-target minimum in fill mode, and the page's padding and gaps are a quarter row.
  The dome keeps about 300 px, and the R32 e2e's 400 px floor moves to 300; R34's landscape is the phone's real answer.
  Also decided here: the strip's sixth field is the speed while playing (FR-LIVE-3), and `play` from the end of the span is a no-op rather than a restart.

- **D-163 — The shortcut table is data, and the description of each row is a message keyed by its id.**
  D-73 asked that the overlay be generated from the table that registers the handlers.
  The shape that delivers it: `lib/shortcuts.ts` exports `SHORTCUTS`, a list of `{ id, keys, label }` with no functions in it, and `ShortcutActions = Record<ShortcutId, () => boolean>` — the handlers are supplied by `App`, which is the only component with the selection, the guide, the route and the preferences in scope at once.
  `t.shortcuts.does` is `satisfies Record<ShortcutId, string>`, so a row added without a description fails `tsc -b` in *both* catalogs (FR-I18N-2), and `ShortcutsOverlay.tsx` maps `SHORTCUTS` and contains no literal key.
  That closes the loop in both directions and a unit test asserts both anyway.
  The listener itself is `installShortcuts(document, () => actions)` in `lib/shortcuts.ts`, a plain function, with `ui/hooks/useShortcuts.ts` as the four-line React wrapper — the split `lib/layout.ts` and `useLayoutMode` already use, because `src/lib` may not import React (D-116).
  The actions are read through a ref on every press rather than captured, so handlers closing over fresh state do not reinstall the listener each render.

- **D-164 — An action says whether it acted, and only then is the default prevented.**
  FR-DESK-4's prose says the shortcuts are active "when no input or button has focus"; D-73 narrowed the guard to the typing targets, and that narrowing has a consequence the guard alone cannot handle: `Enter` reaches the listener while a button has focus, and `preventDefault()` there would swallow the browser's click — every "Open guide" button in the list would stop working from the keyboard.
  So each action returns a boolean and `installShortcuts` prevents the default only for a `true`.
  The `open` action returns `false` unless the focused element *is* a pass card, which nothing activates on its own, so native activation keeps every case it already had.
  The alternative — keeping FR-DESK-4's "or button" in the guard — was rejected because `j` lands the cursor on a card and the reader would then have to leave the list to press `k`.

- **D-165 — The `j`/`k` cursor is DOM focus on a pass card, not a second selection in state.**
  `PassList` decides which cards exist and in what order: the hero pass is pulled out above the list, the sort orders each night, and a folded night's cards are in the DOM but not on offer.
  A cursor in `App` state would have to reproduce all three, and the night disclosures are `PassList`'s own `useState`.
  Instead the cards carry `data-pass-card` and `tabindex="-1"`, and `components/passes/passCursor.ts` reads the order off the page — `[data-pass-card]` in document order, minus anything inside a `details:not([open])`.
  Focus is also what a private cursor could not buy: the screen reader announces the card, the browser scrolls it into view, and the app's one `:focus-visible` ring draws it (FR-X-5).
  `data-pass-card` and not the existing `data-pass-id`, because the open guide — both shells — carries the pass id too and the cursor must not land on it.
  With focus outside the list the cursor falls back to the open pass's card (`[data-selected]`), so `j` after opening a pass moves to the one after it rather than back to the top.
  Both ends stop rather than wrap: over three nights, jumping from the last pass to the hero card reads as nothing having happened.

- **D-166 — `Esc` left `PassDetail` for the table, and the overlay closes before the guide.**
  The guide had its own `document` keydown listener since R6.
  Two listeners for one key cannot order themselves — with the overlay open over a guide, both would fire and one press would close two things — so the guide's listener is deleted and `Esc` is one row of the table, with the precedence written in the handler: the overlay first, then the guide, then nothing.
  `PassDetail` keeps the focus moves and the close control; the assertion for `Esc` moved from `PassDetail.test.tsx` up to `App.shortcuts.test.tsx`, which is where the precedence is visible at all.

- **D-167 — The shortcuts are not installed on the live page.**
  `useShortcuts` takes an `enabled` flag and `App` passes `!live.active`, because a hook cannot sit behind the early return that chooses the page.
  The live page is a screen with its own keys — its own `Esc`, the time stripe's arrows (R33) — and `n` or `v` firing there would change a preference under a dome the reader is watching.
  `l` closes the overlay on its way out, so returning home does not find it still up.

- **D-173 — The landscape layout is a media query on the live page's own grid, with the top row across both columns.**
  FR-LIVE-7 wants the dome on the left and the strip and the stripe on the right on a landscape phone, and §8.8 wants it by a media query rather than a device sniff.
  The query is `(orientation: landscape) and (max-height: 500px)`: a desktop is landscape too and keeps the stack (its dome has the height to spare, D-161), and `max-height` rather than a width is what separates the two, since `tests/styles/breakpoint.test.ts` holds every `min-width` in `src/ui` to the one 960 px breakpoint.
  Nothing in React changes between the two layouts, so there is no `useLayoutMode`-style hook: `Live.module.css` names three grid areas — `top`, `dome`, `side` — and the stripe, the playback row and the strip now sit in one `side` wrapper (`data-testid="live-side"`) that stacks under the dome in portrait, exactly as before, and beside it in landscape.
  The first cut put the top row inside the side column, and the captures showed the strip below the fold: every button is a 48 px row (G6), so the top row's three lines at 41 cells, the stripe and the three controls lines were 336 of the 378 px.
  So the top row spans both columns — one line at 82 cells — and the side column takes three fifths of the width (49 cells at 844 px), where the controls are three lines and the strip four, and the whole column fits the 324 px under the top row in English.
  The dome takes the other two fifths and every row under the top one, 324 px against portrait's 300; its zoom follows the shorter side of its box (D-161), so width past the height would buy only label margin.
  Where the column wraps past the viewport — Spanish, whose strip is five lines; a smaller phone — the side column scrolls itself and the page never does (D-119).
  Captures: `docs/screenshots/r34-live-844-landscape-{dark,night}-en.png`, `r34-live-844-landscape-dark-es.png`.

- **D-174 — The wake lock is silent.**
  FR-LIVE-7 says nothing is shown where the API is absent; nothing is shown where it is present either.
  `useWakeLock` (`components/live/`) requests a `screen` lock while the document is visible and releases it on `visibilitychange` to hidden — the browser drops the lock on its own when the tab hides, but does not hand it back, so the visible half is the one that matters — and again on unmount.
  A request the browser refuses (a battery saver, an insecure context, a headless browser) is `refused` and asked again on the next visibility change, never in a loop.
  The page asks only with a sky to draw: an inert page (FR-LIVE-1) holds nothing.
  The state (`absent | held | released | refused`) is on the page as `data-wake-lock` for the tests and for nothing else: an indicator that could only be read as "the screen might sleep" is noise on a page held up at the sky.

- **D-175 — A phone to follow is the constructor on a touch screen, and the heading is mapped in one pure module.**
  FR-LIVE-8 hides the control "where the API is absent (desktop)", but `DeviceOrientationEvent` alone is not that test: desktop Chromium and Firefox define the constructor and never fire it, so the constructor alone hides nothing on a desktop, and a control that turns nothing is worse than none.
  `orientationApiPresent()` is the constructor *and* `navigator.maxTouchPoints > 0`, the cheapest sign that the browser is on something held in the hand; Playwright's `hasTouch` is what puts the control in the e2e, and the untouched profiles of `live.spec.ts` assert it absent at both widths.
  `compassHeading.ts` is pure and unit-tested: iOS's `webkitCompassHeading` is the heading as it is; an `absolute` reading's `alpha` is `360 − alpha` (W3C alpha grows as the device turns left); anything else is relative-only and gives `null`, which the hook shows as the note rather than turning the dome to a direction it made up, and recovers from when a heading arrives.
  The heading is the device's top, so it is turned by the screen's angle (`screen.orientation.angle`, the older `window.orientation` as the fallback) and a phone held sideways in the FR-LIVE-7 layout faces where the viewer looks — an assumption about `webkitCompassHeading` being uncorrected for interface orientation that only a device can confirm, listed for the on-device run.
  `useFollowPhone` listens to `deviceorientationabsolute` where the window has it (Chrome) and `deviceorientation` elsewhere (iOS, which puts the heading on it), hands out whole degrees at most once per animation frame — the drag's pace, and a fraction of a degree is FR-LIVE-5's budget spent on nothing visible — and makes the iOS `requestPermission()` call inside the click and nowhere else, treating a rejection (an insecure context) as denied with the note; a denial is asked again on the next click, which iOS answers from memory.

- **D-176 — The dome takes a facing from outside and reports a drag: two additive props, and the crossing into `skychart/**` is recorded.**
  The dome holds its camera as component state, and nothing outside could turn it short of a remount, which re-measures the box and reloads the font.
  `SkyChartProps.facingAzDeg` turns the camera to each new value, derived during render rather than in an effect so the frame that carries the heading is the frame that draws it, and leaves the tilt the viewer's; `undefined` leaves the camera where it is, so a drag after following stops keeps what the drag did.
  `onDrag` fires once per pointer drag, on its first movement, and not for a tap that moved nothing — a tap on the dome is not the viewer taking it by hand.
  The arrow keys do not end following: the spec names the drag, and the phone that follows has no keys.
  The polar view ignores both.
  **Lane crossing** (the D-158, D-168 precedent): `SkyChart.types.ts`, `SkyDome.tsx` and its test, both additive, with no chart task open to carry them.

- **D-177 — The control's portrait cost, and the dome's size in landscape, both left as they are.**
  On a touch phone in portrait the toggle (16 cells) and the boxed share action (20) are 38 cells with their gap, two more than the 36 a 390 px phone has, so the share action takes a fourth controls line and the dome pays a row: 291 px against the 300 the untouched profile keeps (D-172; `r34-live-390-follow-dark-en.png`).
  A shorter label — `Compass` would fit — was not taken: the spec writes the control as `[ follow phone ]`, and landscape is the phone's answer.
  In landscape the dome's *drawing* is about 120 px across in a 314 × 324 px column: the frame's rows (the view toggle, the two-line hint, the readout) leave a stage about 180 px tall, and D-161's zoom — the shorter side of the box — sizes the dome by that.
  A fit rule in the chart lane (the dome's screen extent at 45° is about 2.4 units wide and 1.6 tall with its labels, so `zoom = min(width / 2.4, height / 1.6)`) would nearly double it in every fill box, portrait and desktop included, without changing the grid the rasterisation cost follows, so the D-172 numbers would hold; it changes every dome capture, so it is proposed here and not done.
  Measured after this task: main 133.4 KB, chart 97.1 KB, live 6.3 KB, astronomy 22.1 KB gzipped, all inside §11.

- **D-178 — The bundle budgets are re-set to the measured build plus a tenth, not left at the phase's ceilings.**
  SPEC §9 Phase 2 asks for "the budgets in PLAN §11 re-set for the new chunks", and §11's v1 numbers were written before the chunks existed: they are the room the phase was allowed to take, and as a regression check they are close to useless — the worker sat at 36.1 KB under a 120 KB budget, so a change that tripled it would still have printed `ok`.
  Each budget is now `measured × 1.1`, rounded up to the next 5 KB, floored at 10 KB (below that the rounding is noise), and capped at the §11 ceiling: main 150, chart 110, worker 40, astronomy 25, live 10, service worker 10.
  Chart is the one that lands on its ceiling, at 97.1 KB against 110 — D-63 already says the 60 KB planned before the R14 spike is not reachable from outside glyphcss.
  The two numbers keep different jobs: §11's ceiling is what a feature may claim without an amendment, and the budget in the script is what the build log complains about, so a stray dependency shows up as a `::warning::` on the PR that added it rather than a year later.
  The script still never fails the build (§11), so a legitimate overrun costs an annotation and a line in the PR, and the fix is to re-measure and re-set — not to widen the number and move on.

- **D-179 — The v1 capture set is a named matrix with a test over it, shot in one run, beside the per-task captures rather than instead of them.**
  SPEC §9 Phase 2 wants "captures for every screen in both languages and both themes", and the hundred-odd `r16-…`–`r35-…` files cannot answer it: each task shot the widths and variants it had changed, so the set has `r22-dome-1280-night-en` and no `-es`, `r28-favourites` in dark only, `r35-shortcuts` at 1280 only — and no way to tell a gap from a screen that does not exist.
  So `tests/e2e/captureSet.ts` names the screens (location, home, guide, polar, favourites, shortcuts, live), `tests/e2e/v1-captures.spec.ts` produces `v1-<screen>-<width>-<theme>-<locale>.png` for the whole 2 × 2 at 390 and 1280 px — sixty files, the live page also at 844 × 390 for FR-LIVE-7 — and `tests/docs/captures.test.ts` fails `npm test` when one is missing, empty, or present without being named.
  The old captures stay: they are what each PR was reviewed against, and re-shooting them would throw away the only record of what a change looked like when it landed.
  **The set is seeded, not driven**: the locale and the theme go into `wiys:prefs:v1` in an init script and `main.tsx` writes `lang` and `data-theme` from them before the first paint (D-70), so the run never clicks a toggle whose label is in the language under test, and every wait is on a `data-testid` or an ARIA state.
  **One place and one night**: Paris, 2026-09-02 03:00 UTC, with the chart and live screens three minutes into the 03:52 ISS pass — the elements are seven hours old there, where the rest of the suite's Neuquén clock is nine days on from the fixture and would put FR-SAT-4's staleness warning across every home capture (no earlier Neuquén clock has an ISS pass for the hero card: the visible season starts on the 11th).
  It costs the weather — the only recorded forecast is over Neuquén, so every cloud badge in the set reads "weather unknown" and the readiness line reads "no cloud forecast stored yet", which is the FR-WX-1 fallback doing its job and a smaller lie than an apology banner on the front page; `r27-*.png` is the set with a forecast in it.
  The home capture closes the night groups before shooting the whole document: Paris in September has fifty visible passes a night, and the open default made the phone capture 20 000 px tall.

---

### 8.7 Second pass: the layered dome *(v1, FR-DOME-1..8)*

The MVP dome (§8.3) is one wireframe scene in one colour.
The v1 dome is two scenes stacked in one grid cell, sharing the camera state that `SkyDome.tsx` already holds (D-64, D-74):

| Layer | Scene | Contents | Notes |
|---|---|---|---|
| Base | `GlyphScene mode="solid"`, `pointer-events: none` | Ground disc below the horizon (FR-DOME-3), sky bowl shaded from horizon to zenith, Sun glow (FR-DOME-6) | Directional light set to the Sun's real direction, so twilight brightens the correct side of the sky (FR-DOME-8a). Coarser density than the line layer. |
| Lines | `GlyphScene mode="wireframe" charMode="braille"` | Horizon ring with 10° ticks and 30° numbers, 30°/60° rings labelled, meridians, pass arcs, markers, arrowhead, the Moon marker (FR-DOME-4, FR-DOME-6) | The highlighted pass and the live marker get a finer per-mesh density (FR-DOME-8c) so the arc is the sharpest thing on screen. |
| Effect | inside the line scene | At most one: a soft pulse on the live marker (FR-DOME-8d) | Dropped automatically while a drag is in progress if the measured rate is under the FR-GUIDE-6 target. |

- **Alignment.**
  Both scenes get identical grid dimensions and identical cell metrics from `camera.layoutFor(width)` (D-65).
  A mismatch of one cell is visible immediately, so the raster snapshot test (§9.1) snapshots *both* layers.
- **No frame, fills the box (FR-DOME-1).**
  `layoutFor` takes the container's width and height; the column count grows with the width instead of staying at 60, so the desktop panel gets a finer drawing rather than a scaled-up phone one.
  The 60-column phone layout and its 6.5 × 13 px cell stay the small end of the same function, and the R15 fit search (half-pixel tolerance) is unchanged.
- **Colour (FR-DOME-2).**
  `palette.ts` (D-75) returns one colour per meaning; every mesh takes its colour from that map and its weight from the same options object, so the monochrome reading survives (FR-X-5) and the night theme is a token swap.
- **Labels (FR-DOME-3).**
  Compass names keep their hotspots; a label whose box would overlap another moves along its ring in the fixed order compass, peak, rise, end.
  That resolution is pure and lives in `domeGeometry.ts`, so it is unit-tested rather than eyeballed.
- **Live marker (FR-DOME-5).**
  Interpolated from `Pass.track`; the flown part of the arc is a second strip in the "flown" colour.
  No worker call — on the detail sheet it moves at the 10 s tick, on the live page at the playback rate.
  *(R22)* The cut is `lib/skyGeometry.splitArcAt`, shared by both views (D-150), and the strip sits at radius 1.004 so it wins the raster over the arc it covers.
- **Default view (FR-DOME-7).**
  `DEFAULT_CHART_VIEW` goes back to `dome` (D-68 closed by V1-4).
  The polar view gains the same Sun, Moon, live marker and palette, so both views keep telling one story; its SVG makes that cheap.
  *(R22)* "The same" is literal: the glow's ramp, its width and height, whether each body is drawn and the Moon's phase glyph are `skychart/bodies.ts`, which both views import (D-151), and the polar view's colours are the same `--chart-*` tokens read straight from CSS (D-152).
- **Where the two bodies come from (FR-DOME-6).**
  `lib/skyBodies.ts` (D-80), reached through a dynamic import so `astronomy-engine` is its own budgeted chunk rather than part of the first paint (D-148), and resolved once in `SkyChart.tsx` for whichever view is mounted (D-149).
- **The composition is not decided here.**
  FR-DOME-8 requires the spike in `spike/dome-composition/` — every knob as a URL parameter, captures at 390 px and 1280 px of the golden grazing pass and the synthetic high pass, a D-62 drag rate per candidate, and a findings file the owner picks from.
  Tilt default (35°–55°), which meridians are drawn, weights, exact colours and whether the pulse survives are its outputs.
  **The dome implementation task cannot be cut until that file exists.**

### 8.8 The live page *(v1, FR-LIVE-1..10)*

```
Live.tsx
 ├── owns t (EpochMs) and speed (1 | 60 | 600 | 3600) and playing (D-81)            # usePlayback (R33)
 ├── SkyChart { passes: window(now, +24h), now: t, sun, moon, hidden, fill: true }   # FR-LIVE-10; hidden are pre-worded markers (D-168)
 ├── TimeStripe    { span, passes, bands, t, timeZone, onScrub }                     # SVG, D-82; bands from useSkyBands (D-170)
 ├── PlaybackControls { playing, speed, realTime, hidden, … }                        # FR-LIVE-5, the FR-LIVE-6 toggle
 └── StatusStrip   { t, sky, cloud verdict at t, count visible, moon, speed }
```

- **One geometry.**
  The page draws satellites only through `SkyChartProps` (FR-LIVE-10), the same rule FR-GUIDE-2b set for the polar view.
  It passes `now = t`; nothing in the chart knows the difference between the detail sheet and the live page.
- **Playback (D-81).**
  `requestAnimationFrame`, `t += wallDelta × speed`, clamped to the span, stopping at the end.
  At 3600× the whole 24 h takes 24 s and the chart re-rasterises on every frame — that, not the arithmetic, is the FR-LIVE-5 target, and it is the second thing the FR-DOME-8 spike's numbers have to survive.
- **Hidden objects (FR-LIVE-6).**
  Off by default, remembered in prefs.
  On, they are a `computeNow { includeHidden: true }` throttled to one request per 250 ms of wall time, with a stale response dropped if `t` moved past it.
  Every other marker comes from the tracks.
- **Sun and Moon.**
  `lib/skyBodies.ts` evaluates them at most once per second of wall time regardless of speed (FR-LIVE-5); at 3600× that is one evaluation per simulated hour, which is finer than either body needs.
- **Layout and wake lock (FR-LIVE-7).**
  Portrait stacks; landscape on a phone puts the dome left, strip and stripe right — a `useLayoutMode`-style media query, not a device sniff.
  The wake lock is requested on visible and released on hidden through `document.visibilitychange`, and absent APIs render nothing rather than a disabled control.
- **Compass follow (FR-LIVE-8).**
  `FollowPhone.tsx` owns the permission request (iOS `requestPermission()` must be called from the click, so it is in the handler), maps `absolute` / `webkitCompassHeading` to `facingAzDeg`, and turns itself off on the first drag.
  Hidden entirely when `DeviceOrientationEvent` is absent.
- **URL state (FR-LIVE-9).**
  `lib/shareLinks.ts` both ways (D-83); the hash is written at most twice a second while scrubbing and never while playing.
- **Inert states (FR-LIVE-1).**
  No observer or no elements renders one line and the return control, not an empty dome.

---
