# v2.1 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.35 v2.1 decisions (2026-09-21)

The phase adds no feature and no dependency.
Most of it is state that existed and was never modelled: which route the document is on, how old a run is, whose place this is, and what kind of failure happened.

- **D-529 — One shell, and the live page renders inside it.**
  (FR-A11Y-1; F-71.) `ui/Shell.tsx` renders `banner`, `main`, an optional `contentinfo`, the route announcer and the title effect, and takes `chrome: 'home' | 'settings' | 'live'`.
  `App.tsx` stops returning `<LivePage>` in place of the shell: the lazy live chunk renders as the shell's `main`, its top row as the shell's `banner` slot.
  The live page's CSS grid is unchanged — the landmarks are `display: contents` wrappers where a box of their own would re-cut it (FR-SHP-2's rule about both halves of a grid).
  The wide header wraps its links in `nav` as the compact one does.
- **D-530 — Rank is a prop.**
  (FR-A11Y-2; F-72.) `SectionHeading` takes `level` (default 2); `PassCard` takes `headingLevel` and the list passes 4 under a night and 3 on the phone's third step; `PassList`'s night row becomes an `h3` whose content is the toggle button, which keeps `aria-expanded` and the group's label.
  Nothing is restyled: the classes carry the size, the element the rank.
  `A11Y_MAX_H2` lives in `tests/e2e/structure.ts`, the one helper the structure assertions share (landmark counts, the ordered outline, no skipped level) — DOM queries, no axe (V21-2).
- **D-531 — The title is the shell's effect.**
  (FR-A11Y-3.) `lib/routeTitle.ts`, pure: `(route, t, pass?) → string`.
  The effect in `useT.ts` that sets `document.title` on a locale change moves into the shell and depends on the route too; `lang` stays where it is.
- **D-532 — Focus returns to the opener through `navigation.ts`.**
  (FR-A11Y-4, FR-ROUTE-1.) `open(route, opener?)` records the opener element; `close()` focuses it if it is still connected, else the `h1` (`tabIndex=-1`).
  The announcer is one `role="status"` `aria-live="polite"` node in the shell, written on route change only.
- **D-533 — The app marks the entries it pushes.**
  (FR-ROUTE-1..3; F-91.) `navigation.ts` pushes with `history.state = { wiys: depth }`.
  `close()` calls `history.back()` when `history.state?.wiys > 0` and `replaceState` otherwise — a bookmark's or a link's entry has no marker.
  One `popstate` + `hashchange` listener in the shell renders what the URL names; `passSelection.ts`, `LiveRoute.ts` and the settings route lose their own `pushState`/`replaceState` calls.
  The sky screen closes first on `popstate` when open (OQ-22 unchanged).
- **D-534 — Nights are cut on local noon with `Intl`, no library.**
  (FR-NIGHT-1; F-90.) `lib/nights.ts`, pure: `nightOf(instant, zone)` reads the local hour through one cached `Intl.DateTimeFormat(…, { timeZone, hourCycle: 'h23' })` and returns the night's key (the local date of its noon).
  `nightGroups.ts` groups by that key instead of by 24 h from `computedAt`.
  `zone` is the observer's or, when null, `Intl.DateTimeFormat().resolvedOptions().timeZone` — never `'UTC'` by default; `timeFormat.ts`'s UTC label for times is unchanged (FR-LOC-3), only the grouping changes.
- **D-535 — The shown list is pruned off the tick that already exists.**
  (FR-NIGHT-2, FR-NIGHT-5.) `useShownPasses` (`screens/home/shownPasses.ts`) filters on the `now` slice's instant, which FR-VIS-5 already advances every 10 s; no new timer.
  The count line, the night counts and `tonightStripe`'s ticks read the same selector.
  `ENDED_LINGER_S` is a constant beside `ARC_LINGER`.
- **D-536 — A stored run carries its window, and the slice reads it.**
  (FR-NIGHT-3.) `showStoredPasses` compares the stored `windowEnd` with the clock: behind it, the status stays `idle` and the recompute shows as a first load.
  The count line's span is `windowEnd − max(now, windowStart)`, rounded down to the hour.
- **D-537 — Staleness is checked where the elements are.**
  (FR-NIGHT-4, FR-VIS-5 amended.) The visibility handler and the 15-minute recheck in `state/effects.ts` call `recomputeIfStale()`: `now − windowStart > RECOMPUTE_STALE_H` and no job running.
  The old list stays on screen under the progress line, as it does for a recompute on new elements.
- **D-538 — `visiting` beside `observer`.**
  (FR-VISIT-1; F-89; supersedes D-135's store-on-load, widens D-280.) The observer slice gains `visiting: Observer | null`.
  Every reader uses one selector, `useActiveObserver()` = `visiting ?? observer`; the write-through in `store.ts` persists `observer` only; `passesCache` and the weather cache are not written while `visiting` is set, and FR-OFF-4's readiness reads `observer`.
  `keepVisit()` moves `visiting` into `observer`; `endVisit()` nulls it and clears the hash.
  The equality that makes a link "my own place" is on the link's rounding (D-280's), now for pass links too.
- **D-539 — One `openLink()`, and it returns what happened.**
  (FR-VISIT-1..4, FR-SHARE-3; F-93.) `state/openLink.ts`: `(hash, saved) → { kind: 'own' | 'visit' | 'adopt' | 'unreadable' | 'unknown', note?: 'past' | 'far' }`.
  Boot (`state/index.ts`) and the running tab's `hashchange` path both call it, which ends the split where a pasted pass link was dropped and a pasted live link adopted.
  The result is session state in the ui slice and drives `VisitNotice` and the one-line notes; nothing of it is persisted.
- **D-540 — A failure is a kind.**
  (FR-FAIL-1, FR-FAIL-2; F-96.) `state/failure.ts`: `Failure = { kind: 'offline' | 'rate-limited' | 'server' | 'bad-data' | 'timeout' | 'unknown', detail: string }` and `toFailure(error)`: a `TypeError` from `fetch` with `navigator.onLine === false` → `offline`; 429 → `rate-limited`; 5xx → `server`; a zod error or a 200 with a `text/` error body (the Open-Meteo overload case) → `bad-data`; `AbortError` from a timeout → `timeout`.
  Slices store the `Failure`, never a sentence.
  `ui/components/common/FailureLine.tsx` renders `t.failure[kind](what)` + `[ retry ]` + a `Disclosure` with `detail`.
- **D-541 — A retry action per slice.**
  (FR-FAIL-1.) `retryElements`, `retryWeather`, `retryPasses` re-enter the same effect the first attempt used; the place search retries its last query; the live page's `[ retry ]` is `retryElements`.
  No automatic backoff is added — the 15-minute recheck is the automatic path and stays.
- **D-542 — The forecast refreshes on the same two triggers.**
  (FR-FAIL-3; F-87.) `requestWeather` is also called from the visibility handler when the snapshot is older than `WEATHER_MAX_AGE_MIN`, and from the recheck when the last attempt failed.
  The snapshot's age is shown by the existing cloud row's `title`/accessible description, not a new line.
- **D-543 — The worker client listens, and times a stall.**
  (FR-FAIL-4; F-88.) `workerClient.ts` adds `error` and `messageerror` listeners and a timer reset on every progress message; at `JOB_STALL_S` it terminates the worker and rejects the job with `{ kind: 'timeout' }`.
  `retryPasses` spawns a new worker.
  The worker's message contract (§6) is unchanged.
- **D-544 — The root boundary is a class in the main chunk.**
  (FR-FAIL-5.) `ui/RootBoundary.tsx`: plain elements, the two catalogs' four strings imported directly with English as the fallback, no store, no lazy component; `[ reload ]` is `location.reload()`.
- **D-545 — The settings page is a lazy chunk.**
  (F-69, V21-13.) `lazy(() => import('./screens/Settings'))` under the shell's `Suspense`, whose fallback is the shell with the mark's bead moving; the chunk is prefetched on `requestIdleCallback` after first paint, and on the header link's `pointerenter`/`focus`, so a tap on a phone does not wait on the network twice.
  `scripts/bundle-budget` gains the `settings` chunk with a budget by D-178's rule; `main` returns under 155 KB and the `::warning::` goes.
- **D-546 — The desk literals.**
  (FR-HOME-1..4; F-76, F-79.) `HOME_MAX_CELLS = 160` as a `max-width` on the shell's content in `App.module.css`, pinned in `breakpoint.test.ts` with 964 and 1118.
  The header's fold is not measured at run time: the title row's width in cells is known from the catalog per language, so `controlRows.test.ts` computes it and pins one literal per language at which the tagline is hidden and one at which the title shortens, under `:root[lang="es"]` and `:root[lang="en"]`.
  On the two-column layout `WhenStep` orders the next event before the table through one class.
  Where's dome takes the height the pane has left (`ChartFrame` already measures), and is not rendered under `LIVE_BOX_MIN_PX`.
- **D-547 — `-view` captures, and the frame the dome waits for.**
  (FR-CAP-1..5; F-80, F-66, F-70.) `captureSet.ts` entries gain `view?: true`; the filename is `v1-<screen>-<width>-view-<theme>-<locale>.png` and `tests/docs/captures.test.ts`'s pattern accepts it.
  The home's full-page capture keeps its closed nights and says so in `what`; its `-view` twin opens tonight and is clipped to the viewport.
  Under the paused `page.clock` the spec calls `runFor` long enough for `WhereDome`'s `requestAnimationFrame` and the fonts gate before shooting — the R32 lesson, applied.
  The 360 px column and the home at 1920 take the set from 161 files to about 225; `captures.yml`'s 40 minutes is re-measured by the task and raised in the workflow if needed (it is not PR CI, FR-CI-1 is untouched).
  F-66 and F-70: a settled-frame wait (two `runFor` ticks with identical DOM text) before the shot; a variant that still alternates leaves the set with its reason in `captureSet.ts`.
- **D-548 — The first run's controls.**
  (FR-FIRST-1..4, FR-FIRST-10; F-73, F-74, F-84..F-86.) `CoordsInput` keeps altitude as `''` and parses `''` as 0; `[ continue ]` is rendered by `WhereReading` when `step.held` is true and calls `step.onSettle` — the state D-513 already has.
  `NextEventBlock`'s card form takes `onOpen` and renders the same stretched button a `PassCard` does.
  The card's button is stretched with `::after { position: absolute; inset: 0 }` on a `position: relative` article, so the tags stay text and the whole box is one target.
  `Footer` takes `form: 'full' | 'line'`; the steps pass `line`.
  The count line's separator moves from `::after` to a rendered node that a `ResizeObserver`-free rule hides: both items in one `inline` run with a non-breaking ` · ` attached to `Sort:`'s side, so a wrap takes the dot with it to nowhere visible (`white-space` trick pinned by the e2e).
- **D-549 — The compact live rows.**
  (FR-COMP-7; F-82, F-81; amends D-244, D-411.) Back renders `←` with `aria-label` on compact; `controlRows.test.ts` gains the two-cell margin.
  The short wide inventory clips with `max-height` a multiple of the row height and a `+n` row computed by `liveRows.ts`, which already knows the row count.
- **D-550 — The sky screen's wait and the install event.**
  (FR-FAIL-7, FR-FAIL-8; F-94, F-95.) `useSkyScreen` starts a `SENSOR_WAIT_S` timer on arming and falls to the `relative` note when it fires with no event.
  `InstallAction` calls `forgetInstallOffer()` after `prompt()` resolves and latches nothing on `dismissed` from the settings row.

- **D-556 — The stretched control is the button's own box.**
  (R84; FR-FIRST-10 as amended, F-85; amends D-548's mechanism, not its outcome.) `passes/OpenGuide.tsx` is the one "Open guide → <name>" control, shared by `PassCard` and `NextEventBlock`'s card form, and its button is `position: absolute; inset: 0; z-index: 1` over the `position: relative` host, last in the host so it lies over everything before it.
  D-548 wrote a zero-size button with a stretched `::after`; built that way the button's own box is 0 × 0, and Playwright (and some assistive technology) treat it as invisible — every spec that clicks `Open guide` timed out.
  The hit area, the one tab stop and the pointer are the same either way.
  The host wears the focus ring through `:has(> button:focus-visible)`.
- **D-557 — Tags inside a card are text.**
  (R84; FR-FIRST-10 as amended, D-548's "the tags stay text".) `CloudBadge` and `MoonGlareLabel` take `asText`: no `tabIndex`, not positioned above the card's control, the card's pointer.
  The tooltip stays in the DOM as the tag's `aria-describedby`, so the cloud percentage and source (US-7 AC3) and the glare facts are still announced; the hover tooltip is not reachable on a card, and the guide carries the same figures.
  Everywhere else (the conditions table, the guide) the two stay focusable triggers.
- **D-558 — The where step's copy and `[ continue ]`.**
  (R84; FR-FIRST-2 as amended, F-73, F-86.) `location.coordsLabel` is "Coordinates · e.g. -38.93, -67.99" / "Coordenadas · p. ej. -38.93, -67.99" and `location.coordsPlaceholder` is `lat, lon` in both languages — one catalog entry each, so the settings panel's field reads the same, its label wrapping inside the field's 22 cells so the altitude keeps its line (`Settings.module.css`, FR-SET-2's fit); the altitude's placeholder is the literal `0` (`ALTITUDE_PLACEHOLDER`, a number in every language) and a stored altitude of 0 is shown empty.
  `location.continue` is "continue" / "continuar".
  `LocationInput`'s group takes an `afterCoords` slot drawn after the coordinate fields; `WhereReading` fills it exactly while `step.onSettle` is given (D-513's held pair), which is only on a phone's steps, so the wide cold open never shows it.
- **D-559 — The count line's separator is clipped, not measured.**
  (R84; FR-FIRST-10 as amended, F-78; D-548's "white-space trick" made concrete.) `PassList`'s count line is a row that starts `3ch` left of the line, inside a wrapper whose `clip-path: inset(-100vh -100vw -100vh 0)` clips its left edge only; the count carries a `3ch` left margin, and the sort's side starts with an `aria-hidden` ` · ` node `3ch` wide.
  On one line the dot follows the count; when the sort wraps it stands at the head of the second line inside the clipped margin, so no line ends in `·` and none starts with it.
  The controls' tap boxes above and below are not clipped.
  `first-run-controls.spec.ts` reads each drawn line's last character at 375 and 1280 px in both languages.
- **D-622 — axe is a dev dependency on `main`, and one spec file.**
  (FR-A11Y-7, V21-19.) `@axe-core/playwright` (MPL-2.0; test-only; §11.1 lists it under dev tooling, not the runtime table).
  `tests/e2e/axe.spec.ts` builds one `AxeBuilder` per route × width × theme with `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`, under the strict CSP the e2e already runs with — axe injects a script, so the spec uses Playwright's `bypassCSP` for this file only and says so.
  Disabled rules live in one exported array with a reason each.
  **Precondition for the breakdown:** the package is in `package.json` and the lockfile on `origin/main`; on 2026-09-21 the working tree on `main` held an uncommitted `playwright` ^1.63.0 instead, which is not it.
- **D-623 — Faint is a filter after the night filter.**
  (FR-FAINT-1..3.) `lib/faint.ts`, pure; `useShownPasses` composes `notEnded → notFaint(showFaint)`; the count line reads both lengths from the same selector so its two numbers cannot disagree.
  `showFaint` joins `wiys:prefs:v1` with a zod `.catch(false)`.
  `FAINT_MAG` and `FAINT_MAG_MOON` sit in the constants module beside FR-VIS-6's.
- **D-624 — The jump dispatches the hold that exists.**
  (FR-JUMP-1..3.) `NextEventBlock`'s watching form takes `onSee?`; `Live.tsx` passes the live slice's `hold(riseInstant)`.
  Placement at the four shapes is `liveRows.ts`'s, which already owns the row arithmetic; the task measures it against FR-SHP-4's matrix and records the choice.
- **D-625 — The cap is one literal on the compact column.**
  (FR-TAB-1..3.) `max-width: calc(60 * var(--cell)); margin-inline: auto` on the shell's compact column and the sheet, not applied under the landscape-phone shape; `ChartFrame` measures its pane as it does today, so the box follows with no change.
  `breakpoint.test.ts` pins 60 beside 964, 1118 and 160.
- **D-626 — The capture set's arithmetic after V21-22.** 161 files + the 360 column (48) + home at 1920 (4) + the `-view` twins (12) + a 768 column for four screens (16) ≈ 241.
  `captures.yml`'s timeout is re-measured by R94.
- **D-551 — R83: the saved place is restored first, and the link read against it.**
  (FR-VISIT-1, D-538, D-539.) `startApp` always calls `restoreSavedObserver`, then `applyLink(openLink(hash, saved, now))`: `own` changes nothing, `visit` calls the location slice's new `visit(observer)`, `adopt` goes through `setObserver` and is stored, `unreadable` and `unknown` only record the result.
  A link for the place already on screen (`sameHashPlace` against `visiting ?? observer`) is a no-op, which keeps R39's "the same link again does not restart the chain" and the scrub's own hash writes harmless.
  `setObserver` ends a visit (the reader chose a place); an `own` link pasted over a visit brings the saved place back without clearing the hash, since it may select a pass.
  `#live`, `#settings`, `#pass=<id>` and no hash answer `null` from `openLink` — they carry no place — and leave the last result in the ui slice (`slices/ui.ts`, `linkResult`).
- **D-552 — R83: the running tab's path is `followHash`, called from `App`'s one `hashchange` listener.**
  `App.tsx`'s R39 effect (which applied a `#live` link through `setObserver`, and so stored it) is replaced by a `hashchange` listener calling `state`'s `followHash(window.location.hash)`.
  It lives in `App` rather than `startApp` so the component tests, which render `App` without booting, drive the same path.
  F-17's consumption effect stays and now compares against the active observer, which is why a pasted pass link is no longer cleared (F-93's first clause).
- **D-553 — R83: what "nothing written through" covers.**
  The prefs write-through watches `observer` only and now also skips a write when the stored observer is already the new one (JSON-equal): the boot's own `restoreSavedObserver` used to rewrite the key with its fields reordered, which made "byte-identical" false on every load.
  `fillTimeZone` fills the active observer's zone; while visiting it replaces `visiting` in memory and skips `refreshFavouriteTimeZone`.
  The effects pass `{ persist: false }` to `loadWeather` while visiting — `weatherCache.load` then keeps the answer in memory only — and `storeRun` returns early, so neither `wiys:wx:v1` nor the passes store is written for a visited place.
  FR-OFF-4's `ReadinessLine` keeps reading `observer`; during a visit its forecast check (`weather.observer === observer`) fails and the line is not drawn until R87 decides what it says.
- **D-554 — R83: `openLink`'s clock and the span.**
  `openLink(hash, saved, now)` takes the clock as a third argument so it stays pure; `note` is computed for live links only (`t < now` → `past`, `t > now + LINK_SPAN_MS` → `far`, `LINK_SPAN_MS` = 24 h, the live page's `LIVE_WINDOW_MS`, which `src/state` cannot import).
  A `#pass=` hash that does not decode, and a `#pass?`/`#live?` hash that does not parse, are `unreadable`; anything else unparsed is `unknown`.
  Clearing the hash for those two is FR-VISIT-4's and is left to R87/R89 with the line that says so.
- **D-562 — The compact actions rows' labels once Share has its brackets.**
  (R85; FR-COMP-7, FR-COMP-4; amends D-411.) `[ Compartir ]` is 13 cells and the rows must stop at 34, so both rows lost cells elsewhere, and English lost some too: `[ back to live ] [ ] Hidden [ Share ]` is 37.
  Watching in Spanish is `[ fijar ] [ ver 3 ] [ Compartir ]`, 33 (34 at a two-digit count) — `lista (3)` made it 37 and `lista 3` still 35.
  Scrubbing is `[ vivo ] [ ] Ocultos [ Compartir ]`, 34, and `[ live ] [ ] Hidden [ Share ]`, 29: `backToLiveShort` is drawn on the compact portrait actions row only, and the control keeps `backToLive` as its accessible name, which contains the drawn word (the label-in-name rule).
  The landscape rail and wide keep the whole phrase.
  English `[ list (3) ]` is unchanged (32).
  `ShareButton`'s `plain` has no caller left.
- **D-563 — The compact top row is one cell between items.**
  (R85; FR-COMP-7.) `[ ← ]`, the mark, `en vivo` and a 14-cell coordinate pair are 34 cells with the row's old two-cell gaps, and a 360 px phone has 33.5 inside the page padding; with one cell, the gap `cells.ts` already assumes, it is 32 and the pair is drawn whole (`live-states.spec.ts`).
  Back is `aria-label` "Back" / "Volver" on compact only; wide keeps `← Back` as its text and name.
- **D-564 — How the short wide inventory is measured.**
  (R85; F-81, FR-CAP-5; D-549.) On the overlay placement the frame's legend scroll box is `flex: 1 1 0` (`Live.module.css`), so its height is what the rail's head and foot leave whatever the list holds; `Live.tsx` reads it on a `ResizeObserver` in whole rows and hands `inventoryClip` (`liveRows.ts`) to the legend through `LegendInventoryContext`, which `Legend.tsx` exports.
  The times header takes one of those rows where it is drawn, and only the legend knows that — it draws no header when no listed row has times, as a list of hidden objects alone has none — so `clip` takes the header's rows as its second argument and the page subtracts them.
  Every entry is a whole number of rows there — a row button 48 px, the name over the times, neither wrapping; a body line 24 — and the folded page's inline-control margin is undone for those buttons, which it would otherwise shrink to one row.
  The list is block flow, not grid, and still scrolls to what the clip leaves out.
  It applies in both states at that placement.
  `Legend.tsx`, `Legend.module.css` and the chart catalogs are the `chart` lane's files, touched for this alone.
- **D-565 — The legend's times are named everywhere.**
  (R85; F-81.) Each time carries a `sr-only` `rise ` / `peak ` / `end ` (`sale`, `culmina`, `termina`) before it wherever the legend is drawn, so a row's accessible name says what its times are; the drawn header row is the inventory's alone (`aria-hidden`), each word as wide as the first timed row's clock string.
  The `+n` line is `+4 more` / `+4 más`.
- **D-566 — R86: a fetcher error carries its status, and `toFailure` reads it.**
  (FR-FAIL-2, D-540.) `CelestrakError`, `OpenMeteoError` and `OpenMeteoGeocodeError` gain `status` (the HTTP status when there was a response) and `badData` (the body was not JSON, not the schema, or the provider's own `{ error: true }` object), set at every throw site; their messages are unchanged.
  `toFailure` checks in this order: `AbortError`/`TimeoutError` → `timeout`; `TypeError` with `navigator.onLine === false` → `offline`; `ZodError` → `bad-data`; 429 → `rate-limited`; 5xx → `server`; `badData` → `bad-data`; else `unknown`.
  Status before `badData`, so Open-Meteo's overload body is `server` at 503 and `bad-data` at 200 (the D-540 case).
  A `TypeError` while the device says it is online is `unknown`: D-540 names the offline case only.
  A `Failure` passes through (copied), which is how the worker client's `WorkerFailure` keeps its kind through the effects.
- **D-567 — R86: the place search's failure lives in the picker, not the location slice.**
  (D-540, D-541.) The location slice holds no failure today — the search state is `PlacePicker`'s own — so "the location slice stores a `Failure`" is met where the failure is: the picker's error state is `{ query, failure }`, `failure` from `toFailure`, and the query is the one a retry re-runs.
  The slice was not given a copy of state it does not own.
- **D-568 — R86: the worker client takes a factory, and a death moves its generation.**
  (FR-FAIL-4, D-543.) `createWorkerClient(spawn)` spawns once at creation; `error` (kind `unknown`), `messageerror` (kind `bad-data`) or `JOB_STALL_S` without a `progress` or `passes` message for the active job (kind `timeout`) terminate the worker, reject every pending request with a `WorkerFailure` (an `Error` that is a `Failure`), end the job through the new `onFailure` handler, and bump `generation()`.
  The next message posted spawns a new worker.
  The effects keep the generation their elements were sent to and send them again when it has moved, so `retryPasses` is `computeFor(observer, now())` and nothing more.
  A `passes` message also resets the stall clock: it is progress of the same job, and the worker sends one per (night, object) pair.
  The stall clock runs while the page is hidden; a device that sleeps mid-job wakes to a failed job, which the stale recompute or `[ retry ]` restarts.
- **D-569 — R86: the retry actions are a store slice the effects fill.**
  (D-541.) `slices/retry.ts` holds `retryElements`, `retryWeather`, `retryPasses` as no-ops; `startEffects` replaces them with its own closures and puts the no-ops back when it stops.
  `retryElements` is the re-check's first-load retry (the observer chain when there is a place, the prefetch otherwise), so it also re-reads the stored run and asks for the forecast, as the first attempt did.
- **D-570 — R86: a refresh keeps the snapshot, and `weather.error` is "the last attempt failed".**
  (FR-FAIL-3, D-542.) `startWeather` for the place whose snapshot is on screen leaves the slice `ready`; `setWeatherError` for it records the `Failure` beside the snapshot, still `ready`, so every reader that shows a snapshot only when `ready` keeps showing it.
  A place change still resets to `loading`.
  The re-check requests the forecast when `weather.error` is set and nothing is loading.
  Only the latest weather request's answer is written.
- **D-571 — R86: a finished list stands in for any recompute of the same place.**
  (FR-NIGHT-3, FR-NIGHT-4, D-536, D-537.) The passes slice gains `standIn` (the list on screen is an earlier run's) and `spanHours` (D-536's `windowEnd − max(now, windowStart)`, floored; 72 for a job, what is left for a stored run).
  `startJob` keeps a finished list — stored or this session's — for the same place, which is what lets D-537's "old list under the progress line" hold for a session's own run; before, only a stored run was kept, and a recompute on new elements blanked the list.
  `showStoredPasses(run, now)` leaves the slice idle for a run whose window has ended.
  `PassList` reads `spanHours` for the count line and its two empty-state sentences.
  FR-NIGHT-3's "50 h shows computing" is met through FR-NIGHT-4: a 50 h run has 22 h left and is shown (D-536), and its window start is 50 h behind, so the recompute starts at once and the list reads `computing` over it; the store test asserts both steps.
- **D-573 — The visit notice has a phone form.**
  (R87; FR-VISIT-2, FR-COMP-4.) FR-VISIT-2's sentence with its controls is 91 characters in English at the longest place — more than two rows of 41 `--small` characters — so the notice is drawn two ways by the layout.
  Wide: "Showing the sky from <coordinates>, from a link · `[ back to my place ]` `[ keep this place ]`" on one line, word for word.
  Compact: the sentence's short form on one row, "Showing a link’s sky: <coordinates>" / "Cielo de un enlace: <coordinates>", and the two controls on the second; Spanish keep is `[ guardar este ]` so the row is 38 (English 40).
  `<coordinates>` is `coordsLabel` of the visited place, whatever label the observer later carries.
  `controlRows.test.ts` counts both rows at `--small` in both languages, the place at `−38.93, −167.99`.
  The owner reviews the Spanish at the gate.
- **D-574 — "One screen" on a short phone.**
  (R87; FR-FIRST-1 as amended v2.1, F-74; V20-23.) While the phone's steps are up `#root` is a flex column at least `100svh` tall (`:has(> main[data-step])`), the main takes what the header, the notices and the footer's `line` form leave, and the steps' viewport floor is dropped (`--screen-min`); the when and what steps stretch to the main, the where step does not, so its foot note follows its last field with no empty block.
  That fits 390 × 844 in both languages with room.
  At 360 × 640 the board's 1.2 rem spacing leaves the Spanish step 56 px below the fold (the question wraps, the sentence is four lines), so under `max-height: 700px` the where step's blocks are 0.75 rem apart — the populated panes' spacing, the board's other one — and its two boxed fields 0.5 rem inside (`--box-pad`).
  The Spanish step then ends 3 px above the fold, English 43.
  The e2e asserts `scrollHeight <= innerHeight` at 390 × 844 and `scrollHeight <= innerHeight + footer height` at 360 × 640, the spec's "at most the footer is below the fold".
- **D-575 — Unreadable and unknown hashes leave the URL in `App`.**
  (R87; FR-VISIT-4, D-554.) `App` clears the hash in a layout effect when `linkResult` is `unreadable` or `unknown`, with `leaveLive` (in place, then `hashchange`), so the page never paints on it and Back is not spent on it.
  `#live?lat=999` is the live route with no link; `App` tells it from a bare `#live` and does not render the live page for it, so the lazy chunk is not the first thing drawn.
  `LinkNote` takes the `kinds` its page can show: home shows `unreadable`; `past` and `far` are about a live link on the live page and are R89's to mount.
  Dismissing a note takes it off `linkResult` (`null`, or the same result without `note`), so a visit survives it.
- **D-576 — `[ set a place ]`'s intent is a module flag.**
  (R87; FR-FIRST-1 as amended v2.1, F-75.) `screens/home/placeRequest.ts`: `requestPlace()` sets a flag and goes home in place (as `leaveLive` does); `Home` reads it on every render and `WhereReading` spends it — the group that takes the focus clears the flag, after the step's own heading focus — so it is one group's focus and not the page's: held for `Home`'s life it would take the focus again on every later mount of the group, stepping back to `where` or changing layout.
  It is not store state and not in the URL: it is one navigation's intent.
  R89 draws the button and calls `requestPlace()`; what Back does after it is R92's.
- **D-577 — `App` holds the steps.**
  (R87; D-548, D-513.) `useSteps` moves from `Home`'s body to `App`, which passes it down, because the footer is `App`'s and takes `form="line"` exactly while `mode === 'compact' && steps.step !== null`; `main` carries `data-step` then.
  `Footer`'s `line` form is the wide row less its privacy word, at every width.
- **D-578 — A night's key is the local date of its noon, and only nights holding a pass are drawn.**
  (R88; FR-NIGHT-1, FR-NIGHT-2, D-534, F-90.) `lib/nights.ts`: `nightAt(instant, zone)` reads year, month, day and hour through one cached `Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', … })` a zone and answers `{ key, date, beforeNoon }` — the key is the instant's local date from noon on and the previous calendar date before it (no `Date`, D-15); `nightOf` is the key alone; `nextNight` is `nextCalendarDate`, so F-26's DST day keeps one night.
  A null zone resolves to `Intl.DateTimeFormat().resolvedOptions().timeZone`; an unknown IANA name falls back the same way, then to UTC.
  `NightGroup` is `{ index, key, passes }` — no bounds, since the key is the heading's date and the groups' order is the keys' — and `groupByNight(passes, zone)` returns only the nights that hold a pass, in key order, each night's passes as given (the list sorts them). "Every night of the window, empty ones included" (R27) is gone with it: the spec says a night with no pass left is not drawn, and a 72 h run cut on noon is two to four nights with a daytime tail that never holds one, so an empty heading would be noise more often than an answer; `passes.nights.empty` stays in the catalogs, unused, for `messages.test`'s row check.
  One night is still no grouping at all (D-146).
  `tonightKey(groups, now, zone)` is FR-NIGHT-1's rule: the instant's night from noon on; before noon, last evening's night while a shown pass of it is still to come or under way, else the coming one.
  `nightLabel(group, tonight, t)` names the key equal to it "Tonight", `nextNight` of it "Tomorrow night", the rest by their date; `defaultOpenNight` opens tonight where it holds a pass and the first drawn night otherwise, and `splitTonight` carries `tonightKey` so the what step names its later nights against the same night.
  The disclosures' overrides are keyed by night key, not index, since the first night leaves the list when its last pass does.
- **D-579 — The list reads the store's clock.**
  (R88; FR-NIGHT-2, FR-NIGHT-5, D-535; F-67, F-68.) `useShownClock()` is `now.state?.t ?? nowMs`: the `now` slice's instant once the worker has answered, which FR-VIS-5's effect advances every 10 s while the tab is visible, and the instant the observer was set — the load, for a stored run — until then; no new timer, and no `Date.now()` in `PassList`, `WhatStep` or `WhenStep`'s split.
  `useShownPasses(keep)` filters the D-108 selection on it: a pass whose end is more than `ENDED_LINGER_MS` behind the clock is out unless its id is `keep`, the open pass (`selectedPassId`, which `PassList` and `WhatStep` pass; `Home`'s stripe and next-event readers pass nothing, since the next event skips ended passes anyway and a tick for an open pass a minute over is not worth threading a prop for).
  The array is memoised on the ids that left, so a tick that drops nothing regroups nothing and redraws no stripe.
  `hasEnded(pass, clock)` is `end.t <= clock`, and `PassCard` takes `ended`, which draws `passes.ended` (`ended` / `terminado`) in `--fg-dim` where the cloud word goes; the flags line is drawn for it even with no forecast.
  `statusText` takes the shown count, so the count line, `computingProgress`'s found count and the two empty sentences agree with the cards.
  The headings turn over at local noon on the same tick with no recompute of passes (the tests assert the store's passes are the same object across the crossing).
  F-68's open clause — whether the hero's choice should read the store's clock — lapses: the hero card is gone (R81) and its tag's choice now reads this clock; the countdown that reads the wall clock is `NextEventBlock`'s own, by design, and `App.*.test`'s `Date.now()` pins for it stay.
  The "fake clock" of FR-NIGHT-2's verification is the store's `now` slice, set by the test: there is no timer to fake.
- **D-580 — `ENDED_LINGER_S` lives in `lib/nights.ts`.**
  (R88; D-535.) D-535 put it "beside `ARC_LINGER`", which is `physics/constants.ts`, outside the `ui` lane, and the task says it touches nothing outside it; the lane rule is the one that keeps concurrent waves from colliding, so the constant went with the night rule it belongs to, and `ENDED_LINGER_MS` beside it.
  `offline.spec` asserts the nights that hold a pass (two to four, the first "Tonight", the second "Tomorrow night", a third dated) instead of exactly three; it is `tests/e2e/`, outside the lane's file list, but a test that asserts the old rule cannot stay green under the new one.
- **D-583 — The failure line's words and its disclosure.**
  (R89; FR-FAIL-1, FR-FAIL-2, D-540.) `src/i18n/{en,es}/failure.ts` holds one function per kind taking `what`, a verb phrase ("load the orbital elements" / "cargar los elementos orbitales"), so the sentence is "Could not <what>: <why>." / "No se pudo <what>: <por qué>." and the Spanish impersonal agrees with any object; `failure.what.*` holds the phrases (R89 adds `elements`, R91 the rest).
  `FailureLine` takes an optional `instead` sentence for what the page is using meanwhile.
  There is no shared `Disclosure` component, so `[ details ]` is `FailureLine`'s own `aria-expanded` toggle over a `hidden` `<pre>`, as `ElementsLine` does it; `[ retry ]` is a full button, so `--tap` tall.
- **D-584 — The live page's state is a function of three slices.**
  (R89; FR-LIVE-1 and FR-OFF-8 as amended v2.1, F-92.) `liveState(observer, elements, passes)`: no observer → `no-place`; elements ready, or passes on screen for this place (`sameLocation`, not object identity, since a stored run carries the observer it was stored with) → `sky`; elements `error` → `failed`; anything else, `idle` included → `loading`, so a cold `#live` never shows the failed text.
  The stored run therefore opens the page while the elements are still loading as well as when they failed; with no elements the next-event block gets `elementCount: null` rather than 0.
- **D-585 — What "a held instant real time overtakes" is.**
  (R89; FR-VISIT-3, FR-WATCH-1 a.) `usePlayback` releases a paused held instant to real time when the tick reaches it, but only one that was ahead of real time when it was set — a link's moment, a scrub into the coming hours.
  `[ scrub ]` holds the instant real time is showing, and releasing it on the next 10 s tick would undo the button, so it stays held.
  The link's own instant is `lib/playback.ts`'s `linkInstant(t, now, LIVE_WINDOW_MS)`: behind the clock → `null` (watching), beyond the span → the span's end.
  A consequence: a reload of a `#live?…&t=` the page wrote while scrubbing at now opens watching with the past note once the clock has moved.
- **D-586 — The notice strip shares the top row's grid area.**
  (R89; FR-VISIT-2, FR-VISIT-3.) `TopRow` renders a `.topArea` column holding the row and R87's `PageNotices` (kinds `past`, `far`), which takes `grid-area: top`; the strip is `display: none` while empty, so no grid template and no measured box changes when there is nothing to say.
  It is left out while the sky screen is up.
- **D-588 — One relative note for no north and no reading.**
  (R90; FR-FAIL-7, FR-WIN-4; F-94.) The spec quotes "This device is not reporting which way it faces." as FR-FOL-5's relative note, and D-550 falls to the store's existing `relative` reason, so that string replaces the old no-north wording in `window.relative` for both cases rather than adding a third `windowNote` reason in the `state` slice.
  A silent device therefore also loses the option for the session (`windowLost`), as a no-north phone does: nothing on the next tap would answer differently.
- **D-589 — Where the wait lives.**
  (R90; D-550.) `SENSOR_WAIT_S = 3` is exported from `useSkyScreen.ts`, the only reader.
  The timer runs only while armed: it starts with the listener and is cleared with it, so a reading before it cancels it and an iOS denial, which never arms, never starts it.
  The denial's note gains the reload sentence in `window.denied` in both catalogs; the option stays after it, as before.
- **D-591 — Where each failure line stands.**
  (R91; FR-FAIL-1, FR-FAIL-4.) The elements and the pass job share one place, the pass list's status line: `ListFailure` draws the elements' line when the load failed and the job's when it failed, died or stalled, with `failure.instead.storedList` when a list stands below.
  The same component stands under the compact What step's sentence.
  `statusText` still answers a string for those states — the sentence alone, from the kind — and the component draws the line in its place.
  The forecast's line is a second `<dd>` in the `Clouds now` row, full width, at `--small`, saying what the row shows instead (the last forecast, or unknown).
  The place search's line replaces its `role="alert"` paragraph and keeps the coordinates link as its `instead` (`location.searchFailed` is now that `LinkedText` alone).
  `ElementsLine` and `ElementsBanners` still draw nothing on a failed load: the task's "elements banner" is read as the elements' failure sentence R86 left in the status line, and a second line in the Where reading would say the same thing twice on the wide home.
  `FailureLine` takes a `ReactNode` for `instead` and a `site` attribute for tests and captures.
- **D-592 — The cloud row's retry hides its line until the slice moves.**
  (R91; FR-FAIL-1, FR-FAIL-3.) A refresh over a kept snapshot leaves the slice `ready` with its `error` until the forecast answers, so `[ retry ]` would show no loading state.
  `ConditionsTable` keeps the slice object the retry was pressed on and hides the line while the slice is still that object; any write — loading, the answer, a new failure — ends it.
  The slice is not changed (it is the `data` lane's).
- **D-593 — The root boundary sits outside the language provider.**
  (R91; FR-FAIL-5, D-544.) `AppRoot` renders `RootBoundary` around `I18nProvider`, so an error in the provider is caught too.
  The boundary's language is `<html lang>`, which `applyLocale` keeps on the active one, and English for anything else; its words are `app.title` and `boundary.{sentence,reload,details}` in `failure.ts`, imported from both catalogs directly.
  `[ details ]` is a native `<details>` holding the error's name, message and component stack, since the boundary holds no state beyond the error.
  The sentence is the page's `h1`.
- **D-594 — The used install event is let go; the button stands only while one is held.**
  (R91; FR-FAIL-8, D-550, F-95.) `forgetInstallOffer(used)` clears the held event only if it is still the one prompted, so an event Chromium offers again while the dialog is open is kept, and it leaves `installed` alone; with no argument it is the tests' reset, as before.
  The button is drawn only while an event is held — a button with no event is the dead control F-95 is about — so after a cancelled dialog it returns with the browser's next `beforeinstallprompt`.
  The settings row (`bare`) writes no latch; the home page's hint still does (FR-OFF-6's snooze is unchanged).
  The row's label is `settings.installLabel`, "App" in both catalogs (F-83).
- **D-595 — A job whose worker died stays failed until `[ retry ]`.**
  (R91; FR-FAIL-4, D-541, D-543.) `die()` rejects the Now tick's in-flight request after the job's `onFailure` has stopped the tick, and the tick's rejection handler read a changed worker generation as "died between jobs" and recomputed at once — so a worker that fails every job looped for ever and the failure line flickered with "Computing…".
  The handler now recomputes only while `tickReady`, which the job's `onFailure` has cleared.
  One condition in `state/effects.ts`, outside the `ui` lane, taken because FR-FAIL-4 is this task's and its e2e cannot hold without it.
- **D-596 — The live page draws its own landmarks, inside its grid.**
  (R92; FR-A11Y-1, D-529; F-71.) The live page's grid is one element (`Live.tsx`'s `Page`) whose cells are the top row and everything under it, so a `banner` and a `main` of the shell's own around the lazy chunk would have to be the grid's parent or its children, and either re-cuts it.
  `Page` renders `<header>` round the top row and `<main>` round the rest, both `display: contents` (`.landmark-contents` in `global.css`), and the shell on `chrome: 'live'` renders its children as they are.
  The `h1` is "Live sky" (`t.live.open`), `sr-only` and absolutely positioned, so it takes no cell; `h1.sr-only::before` drops the `> ` prompt, which would be part of its name.
  The wide header's `nav` is the same kind of box.
  `App` still renders one `Shell` on every route, so the announcer and the focus that follows the route live across the change; the settings page reaches it through `settingsShell(t, props)`, its slots.
- **D-597 — A night's heading is a hidden `h3` at the head of its group, not the toggle.**
  (R92; FR-A11Y-2, D-530; F-72.) D-530 reads "the night row becomes an `h3` whose content is the toggle".
  Since R81 the toggles are one row *under* the cards, so an `h3` round each toggle comes after the `h4` cards it would head: the outline would run `h2 → h4`, which FR-A11Y-2's own verification fails.
  Each night group now opens with an `sr-only` `h3` naming the night — the toggle's words — and the group is labelled by it (`aria-labelledby`); the toggles stay buttons with `aria-expanded`.
  Nothing is drawn differently.
  A list of one night has no night heading, so its cards are `h3`, one under the list's `h2`; the phone's third step passes `headingLevel={3}`.
- **D-598 — A pass opened over an open pass takes its entry.**
  (R92; FR-ROUTE-1, D-533.) A card in the list beside the wide guide, or `j` and `Enter`, opens a second pass while one is open.
  Pushed, closing the guide went back to the first pass and then the one before; `navigation.open` replaces the current entry when both hashes are passes, keeps its marker, and records the new opener for that depth (F-8's focus still returns to the card that opened the guide on screen).
- **D-599 — Route links are taken from the browser by one delegated listener.**
  (R92; FR-ROUTE-1, D-533.) `<a href="#live">` is in the header, the Where dome and the next-event block, and a plain anchor pushes an unmarked entry that `close` would then replace, leaving it behind.
  `Shell` listens for `click` on the document and hands a plain left click on a same-document link to `#live…`, `#settings` or a pass to `navigation.open`, with the anchor as the opener.
  A click with a modifier, or on any other hash (the coordinates link), is the browser's.
- **D-600 — "The control that opened it" survives its own unmount; the `h1` is focusable only while it holds the focus.**
  (R92; FR-A11Y-4, D-532.) Entering `#live` or `#settings` unmounts the home header with the link the reader pressed, so on the way back `takeFocusTarget` falls back from the element to the one control carrying the same `data-testid` (or `id`) — found only if exactly one does — before it falls back to the `h1`.
  The `h1` has no `tabindex` in the markup: a click on the title would otherwise take the focus (the shortcuts spec starts from one); the shell sets `tabindex="-1"` when it sends the focus there and removes it on blur.
  Leaving a route that was the load's entry has no opener and goes to the `h1`.
- **D-601 — The live page's Back control takes the focus on entry; the sky screen's `×` takes it from anywhere outside the layer.**
  (R92; FR-A11Y-4, FR-FSC-2.) `LivePage` focuses `[data-testid="live-back"]` on mount and again when the inert page gives way to the sky, if that swap dropped the focus to the body.
  The sky screen's callback ref used to take the focus only from the body; with the Back control focused, a click that does not focus its target (WebKit's) left the focus on a control the layer had just made inert.
  It now takes it whenever the focus is outside the layer; a legend row the reader tabbed to inside it keeps it, as before.
- **D-602 — The title's pass time and the announcer's words.**
  (R92; FR-A11Y-3, FR-A11Y-4, D-531.) An open pass's route name is `a11y.pass`: the satellite, then `formatDate` and `formatShortClock` of its start in the observer's zone, `UTC` after the clock while the zone is unknown (F-27).
  The announcer says the new route's title, set in the shell's effect once per route change: not on the load, which a screen reader reads itself, and not on a language switch, which renames the route without changing it (the tab title does follow the language).
  A pass is a route once it resolves to a pass of the run, so its key is `pass:<id>`.
- **D-603 — A reloaded `#pass=<id>` the run no longer has is FR-SHARE-3's "missing" sentence.**
  (R92; FR-ROUTE-3.) Once `passes.status` is `done` and the id finds no pass (D-33's tolerance included), `App` builds `share.missing` from the id itself — `catalogName(norad)` and its start instant — and the home shows it where a stale share link's sentence stands.
  The hash stays: the address still names that pass, and a later run that has it opens it.
  The `#live` route keeps its `t` through the reload as before (D-171); `#settings` needs nothing.
- **D-604 — The cap is on `#root`'s rows, each `width: 100%`.**
  (R93; FR-HOME-4, D-546.) `HOME_MAX_CELLS` (160, `lib/layout.ts`) is a `max-width` in cells with `margin-inline: auto` on the home main, and on the header, the page notices and the footer where they are `#root`'s direct children — which they are on home and settings and not on the live page, whose landmarks are `display: contents` inside its own grid (D-596), so the live page is not capped without a rule naming it.
  `width: 100%` because inside D-119's grid an auto margin turns off a grid item's stretch and a row left to size itself shrinks to its text (`global.css`'s note on the footer).
  The cap has no pixel twin: it is not a media query, so `breakpoint.test.ts` pins the literal and the rule rather than a derivation.
  At 1920 the content measures 1541 px, at 2560 the same, centred; the three panes are 482 px each.
- **D-605 — The header's fold is four range queries under `:root[lang]`, and the short title is generated content.**
  (R93; FR-HOME-1, D-546; F-76.) The title row is `flex-wrap: nowrap` and the title `white-space: nowrap`, so `[ Live sky ]` can never take a line of its own; what gives is decided by width.
  Each line's cells are known from the catalog and the stylesheets' gaps — the title row is the paddings, the mark and its cell, the title, two cells, the live link, the header's gap and the two preference groups (each option `[x] ` and its label, a cell of padding and a cell of gap): 101 cells in English, 113 in Spanish; the tagline is the paddings, its indent and its words: 88 and 109 — and each literal is `thresholdPx` of them, as the breakpoints are (F-10): the title shortens under 973 px in English and 1089 in Spanish, the tagline hides under 848 and 1050.
  `@media (width < N px)` range queries, so the literal is the threshold itself; the English tagline's is under the wide breakpoint and never engages, and is pinned all the same.
  The two lines fold independently — FR-HOME-1's sentence reads as a ladder, but hiding the tagline cannot keep the title row from wrapping, since the tagline is a row of its own — so the header is one of two heights (73 or 103 px) at every wide width.
  The short title is the `data-short` attribute drawn by `.title::after` under the fold, with the full title's span hidden, so the `h1`'s text is the full title at every width and Playwright's text assertions read it; the accessible name follows what is drawn.
  `controlRows.test.ts` recomputes the four literals from the catalogs, the mark's declared cells and the gaps read out of the stylesheets, and `home-desk.spec.ts` reads `::after`'s content at each width.
- **D-606 — The next event's one class is `grid-row: 3`, on the two columns only, and it is `WhenReading`'s.**
  (R93; FR-HOME-2, D-546; F-76.) `NextEventBlock` takes a `className`, and the When reading passes `App.module.css`'s `.nextEvent`; between the wide and three-pane breakpoints the rule places the block at the reading's third row, under the heading and the stripe, and the table and the Moon line auto-place after it (sparse placement skips the occupied row).
  The DOM keeps board 1B's order — the phone stacks it and the screen reader reads it — and the three panes reset the row to `auto`.
  PLAN's FR-HOME table named `screens/home/WhenStep.tsx`, which is the phone's second step and is never on a two-column layout; the reorder is the wide reading's in `screens/Home.tsx`.
  Measured at 1024 × 768 with the flag on: the block ends at 652 px (English) and 622 (Spanish) against the column's 671, where before it began at 699.
- **D-607 — The dome's room is measured on its scroll pane's content extent, and the slot takes no row while it is empty.**
  (R93; FR-HOME-3, D-546; F-79.) `whereDomeSize` (`lib/layout.ts`, a unit test) takes the pane's `clientHeight`, its content's extent — the top of its first block to the bottom of its last, because `scrollHeight` is floored at the pane's own height and says nothing of the room — the dome's own row as it stands, the reading's gap and the reading's width, and answers the side of the square or `null` under `LIVE_BOX_MIN_PX`; one pixel is kept for the rounding of the measured heights.
  The pane is the nearest ancestor that scrolls itself: the Where reading from three panes up, the left column with When under it on the two columns, where the dome is therefore never drawn at 768 px tall (F-79's other half).
  `WhereDome` writes the side inline as `--dome-px`, observes the pane, its rows and the reading's other blocks on one `ResizeObserver`, re-attached on each render since the reading's lines come and go, and renders nothing but its slot until the observer has reported; the slot is `display: none` while empty, so no gap is spent on a dome that is not there. jsdom has no `ResizeObserver` and draws no dome, which is what the Home tests expect on a phone anyway.
  Measured: 243 px at 1118 × 700, 319 at 1280 × 800, 482 (the pane's width) at 1920 × 1080, Where fitting its pane at all three.
- **D-608 — The short wide window halves the main's padding, and the Moon lore's flag-on line is discounted in the desk e2e.**
  (R93; FR-HOME-3, FR-HOME-2, FR-FLAG-1, D-183.) At 1118 × 700 the pane at the three-pane literal is 35 cells (D-443's lean) and one Spanish table row wraps, which put When 15 px over its pane; under 720 px tall the main's row of padding above and below the panes is half a row each — the live page's folds do the same with their air (FR-SHP-3) — and When holds at 491 in 500.
  The tradition line is another matter: CI builds and runs the e2e with `VITE_MOON_LORE=on` (D-183), and that line is 96 to 144 px in the When pane, which no fold of air can hold at 1280 × 800, let alone 1118 × 700 — and it is not on the shipped page, whose build is the flag off.
  `home-desk.spec.ts` measures FR-HOME-2 and FR-HOME-3 without it: the pane's overflow less the line and its gap, and the block's rect less the same.
  On the flag-off build the allowance is zero and the checks are the requirement's own words.
  Where the tradition line stands at three-pane heights if the flag is ever turned on for a release is the owner's question, not this task's.
- **D-609 — The settings chunk is 1.0 KB, main is 166.0 KB, and the budget stays at 155.**
  (R93; D-545, D-178; F-69.) The split is made as D-545 asks — `settingsChunk.ts`'s one import behind `React.lazy` in `SettingsRoute.tsx`, the header's bead running while it arrives through a flag `App` holds, the chunk prefetched on `requestIdleCallback` (a two-second timer where the browser has none) and on the link's `pointerenter` and `focus` — and measured on CI's flag-on build: `Settings-*.js` is 1.0 KB gzipped, and main goes from 166.2 to 166.0.
  The page is a composition of the home page's own controls, every one of which stays in main because the home page renders it; and main is not F-69's 158.0 any more but 166.2 before the split, up 8.2 KB across v2.1's shell tasks.
  So the budget is not returned to by this split, the `::warning::` stays, and the number is not raised (PLAN §11's rule, D-495).
  The settings row is kept at the 10 KB floor so a page that grows shows up.
  What main is carrying, measured once by building it in named chunks (gzipped, each alone so a little over their sum in one file): React 59, zod 24, the store and the data layer 20, `lib` 16, the screens 16, the guide 10, the two catalogs 16, the rest of `ui` 13, the location group 7, the common components 5, the mark 5.
  The two rows worth the owner's look are zod — a fifth of the budget for parsing stored data and fixtures — and the guide, which is opened by a click; either is a Decision Log row, not a task's own call.
- **D-632 — R98: only `true` is a stored `showFaint`.**
  (FR-FAINT-3, D-623.) The schema field is `z.boolean().catch(false)`, as D-623 says, so absent, malformed and `false` all parse to `false`; but `localPrefs.read()` copies the field into `Prefs` only when it is `true`, the way `installHintDismissed` is read.
  The reason is the write-through's emptiness rule: `write({})` removes the key and several tests pin `stored(storage)` as null after the last preference is cleared, which a `showFaint: false` in every read record would break.
  The store reads `showFaint ?? DEFAULT_SHOW_FAINT`; the constant lives in `src/model/prefs.ts` beside `DEFAULT_LIVE_LEGEND_OPEN` and is exported through the model barrel.
  `setShowFaint(false)` still writes `false` through, which the next read drops; nothing migrates.
- **D-643 — R101: "the live slice's hold" is `usePlayback`'s `stepTo`.**
  (FR-JUMP-1, FR-JUMP-2, D-624.) There is no store slice for the instant — `usePlayback` owns it (D-81, D-446) — and its `stepTo` is the write `pass ▶|` already makes (D-190), so the jump is the same call with the rise the headline names, and lands on the same second: `nextEvent`'s rise is `pass.start.t`, which is what `nextRise` returns from real time for any rise more than `RISE_SLACK_MS` ahead.
  Holding is scrubbing, so the chunk, the hash (D-171) and `[ back to live ]` follow with no code of their own.
  `JUMP_MIN_AHEAD_S` (120) and `jumpInstant` live in `NextEventBlock.tsx`, which decides the control's presence on its own one-second tick; "inside the stripe's 24 h" is the block's `hours` prop, which the live page already passes as 24.
- **D-644 — R101: where the jump stands — measured, not tabled.**
  (FR-JUMP-1, FR-SHP-4, D-624.) `liveRows.ts`'s `jumpPlacement(mode, fitsOnPath)`: on compact the path line, always; on wide the path line where the control fits after the path's last line and beside `[ scrub the night ]` otherwise.
  The path is the pass's own words and the rail is what the box leaves, so no table by shape can say where 17 cells fit; `Live.tsx` measures it (`useJumpFitsOnPath`: a range over the path's words, whose lines do not move wherever the control goes, so the answer cannot feed itself).
  Compact never takes the actions row, because it is full (`[ scrub ] [ list (n) ] [ Share ]`, 34 of 36 cells) and a tap row there is 48 px taken from the box, where a text line under the path is 24.
  The control itself is one text row with D-246's 48 px hit box.
  Measured on the seed's pass (a 47-cell path), control shown against control taken out, every row of FR-SHP-4's matrix in both languages: the chart box never changes, and no row changes except the landscape phone at 844 and 932 px (the headline's one text line inside the rail, which has the room) and the short wide window from 1200 px in English (a line of the folded rail's flow).
  `shapes.spec.ts` holds those in `JUMP_ALLOWANCE` and every other row at zero.
- **D-645 — R101: the jump is in the DOM only while watching, and only where the headline is.**
  (FR-JUMP-1, FR-WATCH-4.) It is not a `LiveRow`: it rides on `next-event` or `actions`, so `rowsFor`'s inventory is unchanged and scrubbing — which has no next-event row — has no jump.
  The home page's block and the first card never receive `onSee` (FR-JUMP-3).
- **D-617 — R96: a disabled rule may name the nodes it is disabled on.**
  (FR-A11Y-7, D-622, F-98.) The one violation `ui` cannot fix is the dome's degree labels (`chart`'s `SkyDome.module.css`: `--chart-rings`, a non-text token, at 0.8 opacity).
  Turning `color-contrast` off for the whole run would unmeasure FR-X-5 on `#live` and the guide — the two screens the dome is on — so an `AXE_DISABLED_RULES` entry may carry `nodes`, a selector: axe runs the rule everywhere and the spec drops only the violation nodes that match it.
  An entry without `nodes` goes to `disableRules`.
  The entry still has its reason and its finding; when `chart` fixes F-98 the entry goes and the array is empty.
- **D-618 — R96: the two `ui` fixes.**
  (FR-A11Y-7, FR-X-5.) The wide cold open's ghost stripe was one `pre` in `--rule` (1.48 : 1): its hours now take the ghost pane's `--fg-dim` and only the bar is `--rule`, which axe does not read as text (block elements).
  The guide's numbers table scrolls sideways in a `div` a keyboard could not reach (`scrollable-region-focusable`): the box is now `role="region"`, named by the table's caption, with `tabIndex={0}`, and takes the global focus ring.
  No new message: the name is the caption's.
- **D-619 — R96: the e2e stage is three shards.**
  (FR-CI-1, D-526, §16.17.) The axe run adds about 200 s of test time, and PR #148's shard 1 was cancelled at the 10-minute budget twice, once with no failing test.
  `CI_E2E_SHARDS` goes from 2 to 3 and the matrix from `[1, 2]` to `[1, 2, 3]`, the one-line step §16.17 named for the slower shard passing nine minutes.
  The budget stays 10 minutes per shard.
- **D-627 — R97: `FAINT_MAG` and `FAINT_MAG_MOON` live in `lib/faint.ts`, not `physics/constants.ts`.**
  (FR-FAINT-1, FR-VIS-6, D-623.) D-623 puts them "in the constants module beside FR-VIS-6's", but that module is outside the `ui` lane and nothing in `src/physics` reads them — the worker still searches down to `MAG_LIMIT`.
  They sit at the head of `lib/faint.ts` with their rationale, the precedent R88 set for `ENDED_LINGER_S` in `lib/nights.ts`.
  A later `physics` task may move them beside `MAG_LIMIT` unchanged.
- **D-628 — R97: the ISS is `isFeatured`, and the next-event pass is `nextEvent` over the window before the faint filter.**
  (FR-FAINT-1.) `lib/faint.ts` takes the ISS test as a predicate, as `nextFeaturedPass` does, and the selector passes `isFeatured` (the catalog's one featured object is the ISS).
  The next-event block's pass cannot be computed from the filtered list without a cycle, so `useListedPasses` runs `nextEvent` over the not-ended window on the shown clock and exempts that pass; the block, reading the filtered list, then names the same one.
  So the next pass is named even when it is faint — FR-FAINT-1's exemption, read literally.
- **D-629 — R97: `useListedPasses` returns `{ shown, faint, listed, showFaint }`; `useShownPasses` is its `shown`.**
  (FR-FAINT-2, D-535, D-623.) `faint` counts every faint pass still in the window in both states, so the control reads the same number shown or hidden.
  The nights are cut from `listed`, so a night with only faint passes keeps its toggle (`0 passes · 3 faint`); a night with some faint passes hidden reads its shown count alone.
  With no pass shown but some faint, the count line still reads `0 visible passes in 72 h` so the control has a line to stand on.
  An exempt pass is not faint, so the open pass is an ordinary card with no `[faint]` tag and is not in the control's count.
  `WhereReading` and `WhenReading` now take the open pass too, so the stripe's ticks agree with the list.
- **D-630 — R97: the control is a third piece of the count line, and follows `[<n> more tonight]` on the phone.**
  (FR-FAINT-2, FR-COMP-4.) `FaintToggle` is a bracketed text button, its words `show 12 faint` / `hide 12 faint`, `ver 12 tenues` / `ocultar 12 tenues`.
  On the count line it has its own ` · ` separator and wraps like the sort, so `controlRows.test.ts` pins it as its own `--small` row; on the what step it stands between `[<n> more tonight]` and `[<n> more nights]` and carries the same count as the list's.
- **D-631 — R97: a link's nearest pass skips hidden faint passes; its own pass never does.**
  (FR-FAINT-3, FR-SHARE-3.) `App` resolves the link against the whole run; only when the result is `nearest` and faint passes are hidden is it resolved again among the non-faint passes (exempting the ISS).
  The next-event exemption is not applied there, since `App` holds no shown clock.
  `j`/`k` walk the cards on the page, so they reach a faint pass only while it is drawn, with no change.
- **D-634 — R99: the cap is `global.css`'s one rule on the shell's rows, the notices and the compact live page's grid; the sheet's frame carries the literal too, and the landscape phone lifts it from the live page alone.**
  (FR-TAB-1, FR-TAB-2, D-625.) The 80-cell frame on `header, main, footer` becomes `max-width: calc(60 * var(--cell)); margin-inline: auto` on those three, on `[data-page-notices]` (whose own 80-cell rule in `VisitNotice.module.css` goes) and on `#root > [data-compact='true']` — the live page's grid, the one child of `#root` that carries its mode, since its landmarks are `display: contents` (D-529) and a `max-width` on them is nothing.
  The selector carries an id's specificity, so the rule declares only what `Live.module.css` does not (no padding); the wide live page never matches it and the wide block has nothing to undo.
  `PassDetail.module.css`'s `.frame` takes the same literal with `box-sizing: border-box`, so the sheet's column is 60 cells outside to outside like `main`'s (no change at 390, where the cap does not bind).
  D-625's "not applied under the landscape-phone shape" is read as the live page's: FR-TAB-2 names that page (its two panes divide the width), and FR-SHP-4 says the home and the pass detail carry no shape rule — so the lift is one `max-width: none` under D-173's query on the live page's selector, and the home, the settings page and the sheet keep the column at every compact size.
  `breakpoint.test.ts` pins the literal beside 964, 1118 and 160, the selectors, the sheet's, the lift's query and selector, and that no stylesheet in `src/ui` still carries `80 * var(--cell)`.
  `Live.module.css`'s head comment still says "no 80-cell cap" of the live page; it is `Live*` and is left to a live-lane task.
- **D-635 — R99: the tablet rows are where D-624's "depends on the pass" case lands on a portrait stack, and the box pays; 844 × 501 is re-measured under the column.**
  (FR-TAB-3, FR-JUMP-1, FR-SHP-4, D-624.) At 768 × 1024 and 820 × 1180 the column is 56 cells of content: the fixture's 47-cell path is one line with nine cells to spare, `[ see this pass ]`'s 17 take a text line under it, and on the portrait stack that line is the box's — 663 px against 687 without the control, in both languages, above the box's own width and every floor.
  `shapes.spec.ts`'s `JUMP_ALLOWANCE` carries the entries by name, with a `chart box` allowance the table did not need before, rather than a looser assertion — the two tablets, and the two boundary rows that are the same column now: 963 × 700, the compact side of the mode boundary, and 844 × 501; the walk's other rows are unchanged.
  The question it leaves the owner: on a compact column this wide the actions row (`[ scrub ] [ list (n) ] [ Share ]`, 34 of 56 cells) has the room the phone's lacks, so `jumpPlacement` could measure the fit on compact as it does on wide — R101's rule, not this task's.
  And 844 × 501, the boundary row FR-SHP-3 leaves to the compact page's own rules, is a 60-cell column now: the strip's fields wrap once more in it and the watching box measures 140 px where it measured 164, held at five and a half rows in `FLOOR_ALLOWANCE`, and the drawing overhangs that box in both states rather than scrubbing alone (`OVERHANGS`, held to R70's half row).
- **D-610 — R94: the set is 254 files, the `-view` twin follows its screen everywhere, and the dome is asserted where the rule draws one.**
  (FR-CAP-1..5, FR-TAB-3; F-80; D-547, D-626, D-607.) D-626 counted ≈ 241 with the `-view` twins at the home's three widths and one live screen at 768; the rule read literally gives more, and the rule is kept over the count.
  `view: true` is a property of the screen, so the home's twin is shot at every width the home has — six since this task, 24 files — because what the flag says is "this screen's capture differs from what the reader opens" and that is as true at 360 as at 1280. "The live page" at 768 is `live-watching` and `live-scrubbing` both, since R80 made them two screens and the pair is how the state split is read (D-496); the settings page, the guide and the home make the 768 column 20 files.
  The 360 column is 45, not 48: `sky-screen-turned` is one variant (D-420's rule), and the two upright sky screens are in it because they are compact screens with a 390 px capture (FR-CAP-2). 161 + 45 + 4 + 20 + 24 = 254; `captures.test.ts` pins the number, the pattern with its optional `-view`, the 768 list and the home's 1920 files.
  **The `-view` home route** leaves the nights as `PassList` opens them (tonight open, FR-NIGHT-1's default), runs the paused clock through `WhereDome`'s animation frame, its `ResizeObserver` measurement, the chunk and the fonts gate in 200 ms ticks until the dome's `<pre>` has text, then pins the clock back on `CLOCK` (F-48) — so the countdown and the dome's instant do not depend on how many ticks the wait took.
  The dome is asserted from 1280 up and not at 1024: at 1024 × 768 the left column holds Where and When together and D-607's room rule returns null, so the slot is what the frame proves there and the picture rightly shows no dome.
  That is a fact about the layout the task does not own, recorded in OQ-32's evidence sentence rather than worked around.
  **Two things found on the way:** R93 made the settings page a lazy chunk, and the paused clock held its Suspense reveal, so every `settings` capture would have failed on R100's re-shoot — the route now ticks the clock a second as the guide and the live page already did (R32); and the whole set runs in about 3 min on a ten-core machine at 2.5 s a capture, which is the number `captures.yml` is re-measured against below.
- **D-611 — R94: the settled frame is a fixed two ticks, the sky screens are re-pinned, and what two runs said.**
  (FR-CAP-5; F-66, F-70; D-547.) Every capture, after its route and before its file, ticks the paused clock two frames and fails if `document.documentElement.textContent` differs between them — a frame that has not settled fails the capture rather than write a file that is right half the time.
  Document text and not pixels, because both findings are a glyph or two inside a glyphcss drawing and glyphcss draws in text.
  **Exactly two ticks, not "until it settles"**: the first cut returned as soon as two readings agreed, so the number of frames was a property of the run, the shown instant drifted by a frame between runs, and everything that moves with it — a marker, an arc's end, the stripe's cursor — anti-aliased a level or two differently; ten files differed that way.
  A fixed count is F-48's rule again.
  The same defect was found in the sky-screen routes: the poll that opens the layer ticks 100 ms an iteration for as many iterations as the reading takes, so the sweep started from a run-dependent instant — F-70's shape — and the routes now pin the instant again after the sweep and assert the found state after the pin.
  **The measurement** (two whole runs of 254 off one commit on a ten-core Mac, 140 s each, the `cmp` in `sdd-run/R94.summary.md`): 249 files byte-identical, 5 not — `legend` at 1280 and `live-scrubbing` at 1024, 1200 and 1280, all `night` — by 6 to 524 pixels of at most 116 levels, at the corners of a rounded box, along a curve, on the stripe's hour labels: the same picture to the eye, anti-aliased a fraction of a pixel apart.
  `main`'s own spec shot twice on the same machine differs the same way on 11 of 25 such files, and software compositing (`--disable-gpu --disable-gpu-compositing`) does not change it, so it is not the settle's, not the instant's and not the compositor's; the cause is in the page and is not found.
  F-66 and F-70 are **neither closed nor promoted**: F-66's box moved variant between pairs of runs (`night`/`en` in one pair, `night`/`es` in the next) and F-70's the same, so no variant "still alternates" in the sense D-547 gives leave to drop one — the whole screen does, a tenth of the time, a level or two — and dropping the polar and the live page from the set would be the wrong trade.
  Both rows keep their measurement; FR-CAP-5 is stated over `captures.yml`, and R100's two runs there are the measurement of record.
- **D-615 — R95: the short phone's floor is 304 px, watching only (V21-23).**
  (FR-COMP-5; F-62.) The first cut asserted 320 in both states and was blocked (`sdd-run/R95.blocked.md`): on `seedStoredRun`'s stored run the next pass's path (`SL-16 R/B (Cosmos 2369) · S low → 32° ESE → ENE`, 47 cells) wraps to two lines in the 351 px column, the headline is 92 px rather than 68, and the box is 306 watching and 220 scrubbing, the same in Spanish.
  `live-compact.spec.ts`'s `homeAt` seed has a one-line path and measures 329, which is where the amendment's number came from.
  The owner chose to restate the constant rather than cap the path: `COMPACT_BOX_MIN_SHORT_PX` is 304, two pixels under the two-line figure, and `shapes.spec.ts` asserts it only while watching.
  While scrubbing, the 844 rule (never shorter than wide) is still asserted where the box spans the viewport, and the 667 row is not.
  R99's tablets (768 × 1024, 820 × 1180) came after FR-COMP-5 was written: at 768 × 1024 the capped column's box is 578 × 577 while scrubbing, a pixel short.
  The owner chose to assert the square rule on the tablets while watching only, as R99's own column test already does, rather than change the layout.
  In the spec, `capped` is `box.width < viewport width`.
  R101's control is not the cause: it rides on the path's second line and the headline is 92 px without it.
- **D-638 — R100: the budgets re-set on 2.1.0, `live` to 15, and main left over at 155.**
  (D-178, §11, V21-13; F-69.) Measured on a flag-on build (`VITE_MOON_LORE=on`, as CI's bundle stage builds): main **166.6**, chart 94.2, worker 36.1, astronomy 22.1, window 12.8, live 9.7, service worker 5.0 (+ `sw.js` 1.1), settings 1.0 KB gzipped.
  D-178's rule moves one row: `live` at 9.7 × 1.1 = 10.7 goes to 15.
  The entry asks for "main under 155 KB", and the build is 11.6 KB over it.
  The release may make no product change, and V21-13 fixed the budget, so the task neither shrinks main nor raises the number: F-69 stays open with the measurement.
  The table is in `scripts/bundle-budget.ts` and §11.
  `npm run bundle:budget` exits 0 with its `::warning::`, as it always has (§11: the script never fails the build).
- **D-639 — R100: the set re-shot, 120 of 254 files changed, and two runs that differ in 38.**
  (FR-CAP-1..5, D-179, D-611; F-66, F-70, F-99, F-100.) Shot with `v1-captures.spec.ts` unchanged against `npm run build` (flag off, as `captures.yml` does), on a ten-core Mac, 254 passed in 2.3 min.
  **What changed against the committed set, and why:** several committed files were older than the merges they should show.
  `location-390` was still the pre-R84 first step (value-like placeholders, the long footer; F-73, F-74 — 1204 px tall, now 844).
  `settings-*` lacked R84's coordinate hint and R91's `App` row label (F-83).
  `home-*` had three nights and no faint control (R88, R97) and no dome at 1280, and `home-390` is 162 px taller (by the same merges, not measured row by row).
  `guide-1024-*-es` and `home-1024-*-es` show R93's Spanish header (F-76).
  `favourites-*`, `polar-1280-*` and `guide-1280-*` changed inside the panes the home changed (their boxes; not opened one by one).
  `live-*-1200` show F-81's fix (the `rise`/`peak`/`end` header and `+4 more`).
  Every `live-watching` file carries F-100's focus ring.
  The Spanish compact live rows are R85's (FR-COMP-7).
  `sky-screen-chip-844-*` has a pass six seconds further on (`113°`, `1:55` against `114°`, `1:49`), which is R94's re-pin after the sweep (D-611).
  The rest (`legend-1280-night-en`, `live-scrubbing-1280`/`-1920` at 2 levels) are R94's sub-pixel edges.
  **Two runs:** the second run, on the same build, differed from the first in 38 files: sub-pixel edges; F-70's box on `sky-screen-chip-844-night-es`; F-66's shape on `polar-360-night-es`; and the live page's instant a second apart, which is new and is F-99.
  The first run is the committed set.
  The home and the live page now show R91's failure line under "Clouds now" ("Could not load the cloud forecast…" with `[ retry ]`), because the set stubs Paris's forecast as a failure (D-179's "weather unknown").
  That is the product telling the truth about the stub, so it is recorded here and not changed.
- **D-640 — R100: the release run's order, and what it adds to OQ-35.**
  (`docs/RELEASE.md` §13; SPEC §9 Phase 2h, FR-A11Y-6, OQ-35.) §13.1 comes first for D-499's reason: the first run from a clean browser cannot be repeated on one profile.
  F-97's scroll check goes at its end, on a second clean profile. §13.4, the screen-reader pass, also carries the rest of OQ-35 — the Tab walk and 200 % text — because the row says they "are the release run's" and nothing else would ever run them.
  F-100's check goes in §13.4 too, because it is a question about what the phone draws.
  The tag line has the release SHA as an argument (`git tag -a v2.1.0 <sha>`), not only as a warning in the prose.
- **D-641 — The owner's calls at the v2.1 release gate: main's budget is 170, and CI runs four shards.**
  (V21-24; D-178, §11, D-526, D-619; F-69.) Main is raised from 155 to 170: D-178's rule (166.6 × 1.1, the next 5 KB line, 185) capped at the §11 ceiling, which is not moved.
  It leaves 3.4 KB, so the next phase that adds to main meets the ceiling, and D-609's remedies (zod out of the shell's path, the guide behind `React.lazy`) are how it gets room.
  F-69 is closed by the raise.
  `CI_E2E_SHARDS` goes from 3 to 4 and the matrix to `[1, 2, 3, 4]`. #153 and #154 ran shard 1 at 9m59s and 9m58s with nothing retried (185 tests, 6.6 min of e2e behind about 3 min of install, unit and build that every shard repeats), so the next spec would have cancelled it.
- **D-642 — F-99 and F-100 fixed in the release.**
  (V21-24; FR-CAP-5, FR-A11Y-4, FR-X-5; F-48, D-611.) **F-99:** `pinnedAt` in `v1-captures.spec.ts` set the time a tick short and then ran the tick with `runFor`, which fires each interval on its own phase.
  A 1 s interval (the next-event countdown, the instant `[ scrub ]` holds) had its phase set by how many ticks the dome's wait took, so it last fired anywhere in the second before the pin, and two runs showed the instant a second apart.
  The tick is now a `fastForward`, which fires every due timer once at the pinned instant, and the check after it reads the whole `hh:mm:ss`.
  Two whole runs of the final 254 then differ in 7 files.
  Four are on the live and legend pages, at 3 to 6 pixels of at most 2 levels.
  Three are `sky-screen-chip-844`, at 3 to 19 pixels of at most 7, in F-70's own screen.
  None is a clock: this is D-611's anti-aliasing.
  The committed set is the second of the two runs.
  **F-100:** entering `#live` focuses Back (FR-A11Y-4), and with no pointer or key yet the browser draws that as `:focus-visible`.
  The ring went round the 48 px tap box, which stands 12 px into the line under it.
  `.page[data-compact] .back:focus-visible` drops the `min-height`, the padding and the matching negative margin while the ring shows, and sets the offset to 0, which is R75's rule for inline controls.
  The margin box is the text line either way.
  A first cut dropped only the padding and the margin, so the buttons' `min-height` kept the box at 48 and the header row grew 24 px.
  `[ scrub ]` then moved between a pointer's down and up, and 30 captures failed on a click that never landed.
  The selector outranks the short wide window's `[data-fold] button` rule, which also gives Back the tap box.
  `structure.spec.ts` asserts at 390 × 844, 844 × 390 and 1200 × 450 that the ring's box is one row tall and that blurring Back moves no other button.
  The test failed on the unfixed stylesheet.

### 9.4 v2.1 additions *(FR-A11Y, FR-NIGHT, FR-VISIT, FR-FAIL, FR-ROUTE, FR-HOME, FR-CAP)*

- **Structure** is asserted by DOM queries through `tests/e2e/structure.ts` on every route at 390 and 1280 px, in the existing e2e shards; no axe (D-530, V21-2).
- **Clocks.**
  Every FR-NIGHT test runs under a fake clock in a named zone east and west of UTC and with a null zone; component tests with timers use `fireEvent` inside `act`, not user-event (the fake-timer hang).
- **Storage is evidence.**
  The visit e2e snapshots `localStorage` and the IndexedDB run before and after a link and asserts them byte-identical (FR-VISIT-2).
- **Failures are injected at the boundary the app owns:** `page.route` for the providers (including Open-Meteo's 200 with a `text/` error body), a worker stub that goes silent for FR-FAIL-4, a component that throws for FR-FAIL-5.
- **History.**
  One e2e asserts net-zero history growth and that a single `goBack()` leaves the origin (FR-ROUTE-1).
- **The CI budget** (FR-CI-1) is re-measured by R92 and R94, the two tasks that add the most e2e; a third shard is `CI_E2E_SHARDS: 3`, a visible one-line change, if the slower shard passes nine minutes.

### 16.17 Delivery of the v2.1 tasks *(V21-1, D-529..D-550)*

The V1-11 rules are unchanged.
This is a proposal for the breakdown, which may re-cut it; what it may not do is put two tasks of one lane in a wave or let a `ui` task write `src/state/**`.
The phase is mostly `ui`, so it is long and thin: eighteen tasks over eleven waves *(fourteen over eight before V21-19..V21-22)*, `data` and `live` filling the early waves beside `ui`.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R83 — A link is a visit, in the store: `visiting`, `openLink()`, nothing written through | `data` | opus | auto | — |
| 1 | R84 — The first run's controls: placeholders, `[ continue ]`, the first card, the whole card, the Moon sentence off the card, the count line | `ui` | opus | owner (Spanish copy, captures) | — |
| 1 | R85 — The compact live rows in Spanish, and the short wide inventory's clip | `live` | opus | owner (captures at 360 in Spanish) | — |
| 2 | R86 — Failures in the store: kinds, retry actions, the forecast's refresh, the worker's listeners and stall, the stale recompute, the stored run's age | `data` | opus | auto | R83 |
| 2 | R87 — The visit notice and the link notes; one screen with its footer; `[ set a place ]` | `ui` | opus | owner (Spanish copy, captures) | R83, R84 |
| 3 | R88 — Nights on local noon, and the list pruned by the clock | `ui` | fable | auto | R86, R87 |
| 3 | R89 — The live page's three states, the visit notice on it, offline from a stored run | `live` | opus | owner (aeroplane mode on a phone) | R86, R87 |
| 3 | R98 — `showFaint` in the prefs schema and store | `data` | fable | auto | R86 |
| 3 | R90 — The sky screen's wait and the denial note | `window` (with `ui/components/screen/useSkyScreen.ts` — `ui`'s, a crossing) | opus | owner (a phone) | — |
| 4 | R91 — The failure line everywhere, the root boundary, the install button and its row | `ui` | opus | owner (Spanish copy) | R86, R88 |
| 5 | R92 — The shell: landmarks, the outline, titles, focus, the skip link, and Back goes back | `ui` (with `screens/Live.tsx` — `live`'s, a crossing, so after R89) | opus | owner (a screen-reader pass) | R89, R91 |
| 6 | R93 — The home at desk widths, and the settings page as a lazy chunk | `ui` | fable | owner (1024 in Spanish, 1920, captures) | R92 |
| 7 | R96 — The axe run over every route, width and theme | `ui` | opus | auto (precondition: `@axe-core/playwright` on `origin/main`, D-622) | R93 |
| 8 | R97 — Faint passes behind `[ show faint (n) ]` | `ui` | opus | owner (the two thresholds against a real night, Spanish copy) | R88, R98, R96 |
| 9 | R99 — The compact column capped and centred | `ui` | fable | owner (a tablet or a narrow window, captures) | R97 |
| 10 | R94 — What a capture shows: `-view`, 360, 768, the home at 1920, the deterministic set | `ui` | fable | auto | R99, R85 |
| 4 | R101 — `[ see this pass ]` on the watching headline | `live` (with `passes/NextEventBlock.tsx` — `ui`'s, a crossing, so not beside R91) | opus | owner (one-handed, the four shapes) | R89 |
| 7 | R95 — FR-COMP-5's restated floor asserted, and §4.20's register | `live` | fable | auto | R101 |
| 11 | R100 — v2.1 release preparation | `ui` | opus | owner | R94, R95 |

**Decision blocks**, reserved here: R83 D-551..D-555, R84 D-556..D-561, R85 D-562..D-565, R86 D-566..D-572, R87 D-573..D-577, R88 D-578..D-582, R89 D-583..D-587, R90 D-588..D-590, R91 D-591..D-595, R92 D-596..D-603, R93 D-604..D-609, R94 D-610..D-614, R95 D-615..D-616, R96 (the axe run) D-617..D-621; D-622..D-626 are this plan's; R97 D-627..D-631, R98 D-632..D-633, R99 D-634..D-637, R100 (the release) D-638..D-642, R101 D-643..D-646.
D-527 and D-528 stay R82's, unspent.
*(V21-19..V21-22)* The ids above are in the order the tasks were planned, not delivered; the breakdown may renumber them into wave order, keeping the blocks.
R101 sits in wave 4 beside R91 only if the breakdown confirms they share no file — `NextEventBlock.tsx` is the risk; otherwise it takes wave 5's `live` slot.

**Lane ownership for this phase:** `src/lib/nights.ts`, `src/lib/routeTitle.ts`, `src/ui/navigation.ts`, `src/ui/Shell.tsx`, `src/ui/RootBoundary.tsx`, `tests/e2e/structure.ts` and `tests/e2e/captureSet.ts` are `ui`'s; `src/state/openLink.ts` and `src/state/failure.ts` are `data`'s.
R92 crosses into `screens/Live.tsx` to put it in the shell and R87 does not — the live page's notice is R89's, in its own lane.

**Preconditions a driver run must check:** no task adds a dependency; R96 needs `@axe-core/playwright` already on `origin/main` (D-622) and must not be picked by `--wave` until it is.
R90 and R92 have gates a laptop cannot answer (a phone's sensors, a screen reader); `--wave` should not pick their dependants until the owner has run them.

What each session reads (D-284's rule): all of them SPEC §12 V21-1..V21-18 and PLAN §2.35 and this section.
Then R83: SPEC §4.35, §4.13, FR-LIVE-9; PLAN D-135, D-280.
R84: SPEC §4.28 (FR-FIRST-1..4, FR-FIRST-10 as amended), US-18, US-26; PLAN D-467, D-513, D-548.
R85: SPEC FR-COMP-7, FR-COMP-4, §4.20 F-81, F-82; PLAN D-244, D-246, D-411, D-549.
R86: SPEC §4.36 (FR-FAIL-2..4), §4.34 (FR-NIGHT-3, FR-NIGHT-4), FR-VIS-5; PLAN §6, §7, D-536, D-537, D-540..D-543.
R87: SPEC FR-VISIT-2..4, FR-FIRST-1 as amended; PLAN D-539, D-548.
R88: SPEC §4.34, US-16 AC5, US-31; PLAN D-534, D-535.
R89: SPEC FR-LIVE-1, FR-OFF-8, FR-FAIL-6, FR-VISIT-2.
R90: SPEC FR-FAIL-7, FR-FOL-5; PLAN D-550.
R91: SPEC §4.36 (FR-FAIL-1, FR-FAIL-5, FR-FAIL-8), FR-SET-1; PLAN D-540, D-544.
R92: SPEC §4.33, §4.37, FR-X-5, US-30; PLAN D-529..D-533.
R93: SPEC §4.38, §5.10; PLAN D-465, D-545, D-546.
R94: SPEC §4.39, FR-COMP-6; PLAN D-179, D-420, D-496, D-497, D-547.
R95: SPEC FR-COMP-5 as amended, §4.20's register.
R96: SPEC FR-A11Y-7, FR-X-5; PLAN D-622.
R97: SPEC §4.40, US-34; PLAN D-535, D-623.
R98: SPEC FR-FAINT-3; PLAN D-623.
R99: SPEC §4.42, FR-COMP-5, FR-SHP-4; PLAN D-625.
R101: SPEC §4.41, FR-SPAN-4, FR-WATCH-1..4; PLAN D-624.
R100: SPEC §9 Phase 2h, `docs/RELEASE.md`, PLAN §11.
No session reads the three documents whole.
