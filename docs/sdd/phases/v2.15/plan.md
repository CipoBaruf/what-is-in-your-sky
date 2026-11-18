# v2.15 — PLAN.md sections

Phase file of PLAN.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.53 v2.15 decisions (2026-11-18)

- **D-1145 — The closed list is one file both sides read.**
  (FR-MEAS-1, FR-MEAS-2; V215-6.) `src/model/measure.ts` holds `EVENTS`, a const map from each name to its tuple of details (empty for none), the `MeasureEvent` type derived from it, and `isMeasureEvent(value: unknown)`, the runtime guard: six known keys, each value in its list, `id` matching `ID_PATTERN` (16 hex characters).
  The browser's sender and the route's handler both import it, so a name cannot be sent that the route drops; the file imports nothing.
- **D-1146 — The sender is `src/data`, its context is `src/state`, the screens call `count`.**
  (FR-MEAS-1, FR-MEAS-3; V215-7.) `src/data/measure.ts` exports `createMeasure(env)`: `env` is `{ beacon, online, origin, webdriver, forced }`, all injected; it returns `count(name, detail?)`.
  `count` drops a repeated pair (a `Set` of `name:detail`), drops when offline, off `MEASURE_ORIGIN` (`https://inyoursky.app`) or under `webdriver`, and otherwise calls `beacon('/e', JSON.stringify(event))` inside a `try` that swallows.
  `src/state/measure.ts` builds it once in `startApp` with the context fixed at that moment — `visit` from the loaded observer, `layout` from `lib/layout`'s wide query, `lang` from the resolved locale, `id` from `crypto.getRandomValues` — and exports `count`, the only thing `src/ui` imports.
  A send is deferred to after the next paint (`requestAnimationFrame` then a zero timeout), so no event is on the path to first paint.
  A test turns it on with `globalThis.__WIYS_MEASURE__ = true` set before load (`forced`), which lifts the origin and `webdriver` gates and nothing else.
- **D-1147 — State facts are counted by one subscription, screen facts where the screen learns them.**
  (FR-MEAS-2.) `src/state/measureEffects.ts` subscribes to the store.
  `place_set` is sent when the observer changes to a non-null one, its detail from the observer's `source` (`geocode` → `search`, `coords`, `device`) or from the action that set it (`favourite`, `link` — `applyLink`'s adopt and the favourites' pick pass it).
  `no_passes` is sent when the pass job is `done` with an empty list; `failure` when a slice stores a `Failure`, its detail the slice (`elements`, `forecast`, `passes`, `search`, `live`).
  In `src/ui`: `open` once from `main.tsx` after the first render, its detail from the route hooks.
  `where_shown`, `when_shown`, `what_shown` from an effect on `Home`'s current step (compact) and on the panes' lit state (wide).
  `door` in `HomeDoors`' handlers; `pass_open`, `live_open`, `stars_open`, `settings_open` from one effect in `App.tsx` on the route hooks.
  `sky_screen_open` at the sky screen's mount; `follow_answer` in `useFollow`'s `allow`, `notNow` and refusal; `device_refused` in `UseMyLocation`'s error branch by the error's code; `search_empty` in `PlacePicker` on an empty answer.
- **D-1148 — The route is a Worker script beside the assets, in `edge/`.**
  (FR-MEAS-4; V215-2.) `edge/collect.ts` exports `collect(request, write)`: `405` for a method other than `POST`; otherwise it reads at most `EVENT_MAX_BYTES + 1` bytes, parses, checks `isMeasureEvent`, calls `write` for a kept event and answers `204` with no body either way.
  `edge/index.ts` is the script: `/e` goes to `collect` with `write = (e) => env.EVENTS.writeDataPoint({ indexes: [e.id], blobs: [e.name, e.detail ?? '', e.visit, e.layout, e.lang, e.id] })`; every other request is `env.ASSETS.fetch(request)`.
  `wrangler.jsonc` gains `main`, `assets.binding` (`ASSETS`), `assets.run_worker_first` (`["/e"]`, so no asset request runs the script) and `analytics_engine_datasets` (`EVENTS`, dataset `inyoursky_events`); `observability` stays off.
  The directory is `edge/`, not `src/worker`, which is the physics Web Worker; `edge/` has its own `tsconfig` entry and declares the two bindings' shapes itself, so no dependency is added.
  The arrival time is the store's own timestamp, so the write carries the six fields only.
- **D-1149 — The funnel is a pure report over grouped rows.**
  (FR-MEAS-6.) `scripts/funnel.ts` exports `funnelReport(rows, options)` (pure, tested on a fixture) and a `main` that posts one SQL query to the account's Analytics Engine SQL API with `CF_ACCOUNT_ID` and `CF_API_TOKEN` from the environment.
  The query groups by the five blobs and sums `_sample_interval`; since FR-MEAS-2 sends a pair once per load, that sum is the count of distinct ids, with no `DISTINCT` needed and sampling accounted for.
  `package.json` gains `"funnel": "tsx scripts/funnel.ts"`.
- **D-1150 — The note is deleted, not hidden.**
  (FR-MEAS-7; V215-5.) `home.savedFoot`, `footer.privacy`, `footer.closePrivacy` and `footer.short.privacy` leave both catalogs; `usePrivacyNote`, the prefs slice's setter and `privacyNoteClosed` in `localPrefs` and `model/prefs` go; `Footer`, `LocationInput` and the settings page lose the lines and the control.
  A stored `privacyNoteClosed` is an unknown key the prefs reader already ignores.
- **D-1151 — `MEASURE_MAX_KB` is held by a test, the main chunk by the budget.**
  (FR-MEAS-3.) `tests/build/measure-size.test.ts` bundles `src/state/measure.ts` with esbuild (Vite's own, minified) and asserts the gzip is at most 1 KB; `bundle:budget`'s main row is the regression check against 2.14.3.
  This reads FR-MEAS-3's "the module's row" as that test: the budget script counts chunks, and the module is not one.

- **D-1152 — The slices count three failures; the screens count `search` and `live`.** *(R193)*
  Only the elements, weather and passes slices hold a `Failure` in the store, so `measureEffects` sends `failure` with `elements`, `forecast` and `passes`.
  The search failure lives in `PlacePicker`'s own state and the live failure in `Live.tsx`'s, so R196 sends `failure:search` and `failure:live` from those two.
- **D-1153 — The sender checks the name and detail against `EVENTS`, not the whole guard.** *(R193)*
  With `isMeasureEvent` inside it the module is 1102 B gzipped; without it, 896 B. The context is typed and fixed at load, and the full guard is the route's.
  `startApp` reads the layout (`matchMedia(WIDE_QUERY)`) and passes it in, so the module does not pull in `lib/layout`.
- **D-1154 — How a place was set rides on `setObserver(observer, via?)`.** *(R193)*
  The store holds `observerVia: 'favourite' | 'link' | null`, never stored on the device; `selectFavourite` passes `favourite`, the adopted link and `keepVisit` pass `link`.
  `place_set` is sent when the observer changes to a place `sameLocation` calls different; the place restored at load is not counted, nor is a link's visit until it is kept.
- **D-1155 — The public origin is built from its host.** *(R193)*
  `MEASURE_ORIGIN` is `https://` joined to `MEASURE_HOST`, so `headers.test.ts`'s scan of URL literals does not read a compared origin as a host `connect-src` must allow.
- **D-1156 — A pair is used up when it is counted, sent or not.** *(R193)*
  An event dropped offline is not sent later. The send waits for `requestAnimationFrame` then a zero timeout; with no frame nothing is sent and nothing throws.
  `createMeasure(env, context)` takes the context as its second parameter; `env` is D-1146's five fields and an optional `defer`.
  `no_passes` is sent whenever the list is done and empty, a stored run included; `visit` is `first` whenever nothing was restored, a load that adopts a link included.

- **D-1157 — Nothing stands where the note stood.** *(R194)*
  `Footer` loses its `privacy` prop and keeps no empty slot.
  The boxed foot under the place search renders only with a saved place, for its clear action; with none the foot and its rule are absent, so the phone's where step ends at the coordinates card.
- **D-1158 — A stored `privacyNoteClosed` is dropped by omission.** *(R194)*
  The `localPrefs` schema no longer lists the key, so a read ignores it and the next write leaves it out; there is no migration.
  The test that holds this is titled FR-KEEP-4, since FR-SDD-24 asks for a test naming that id.
- **D-1159 — `FOOTER_ONE_LINE_MIN_PX` stays 1176 / 1195.** *(R194)*
  Without the note the one-row footer fits from about 990 px in English and 1010 px in Spanish, but D-681 and `breakpoint.test.ts` hold the fold above the 1024 px capture width.
  The literals are now conservative and break nothing; lowering them is the owner's call, and the comments in `App.module.css` and `lib/layout.ts` that name the note's `[ × ]` move with that call.

- **D-1160 — `EVENT_MAX_BYTES` lives in `edge/collect.ts`.** *(R195)*
  Only the route uses it. The body is read from the stream and dropped once it passes the limit; the rest is not read.
- **D-1161 — The content type is not checked.** *(R195)*
  The beacon sends `text/plain;charset=UTF-8`, so `isMeasureEvent` on the parsed body is the only test.
- **D-1162 — `204` even when the body cannot be read or the store throws.** *(R195)*
  The answer must not say whether an event was kept, and with logs off there is nowhere to report the error.
- **D-1163 — `405` carries `Allow: POST` and no body.** *(R195)*
- **D-1164 — `edge/` has its own tsconfig, lint block and knip entry.** *(R195)*
  `tsconfig.edge.json` uses the `WebWorker` lib and no `types`; the lint block lets `edge/` import only `src/model` from `src`; knip names `edge/index.ts` as an entry, since `wrangler` is not a dependency.
  The path match is exact: `/e/` and `/ex` go to the assets.
  A data point is `indexes: [id]` and `blob1`..`blob6` as name, detail (empty when absent), visit, layout, lang, id; there are no doubles.

- **D-1170 — `funnel.test.ts` lives in `tests/deploy/`.** *(R197)*
  The vitest `node` project includes only `src/**` and `tests/**`, so a test beside the script would never run.
- **D-1171 — The funnel's `main` takes its environment, fetch and streams as arguments.** *(R197)*
  The test covers the credential, flag and API-error paths with no network; `parseRows` is the one place the API's answer shape is known.
- **D-1172 — The report's choices.** *(R197)*
  A share over an empty `where_shown` prints `-`; every detail of `EVENTS` is listed, zeros included; the opens count every `open`, first visit or not; `--layout` and `--lang` filter the rows read, not the SQL.

- **D-1165 — `open`'s detail is read from the hash at load.** *(R196)*
  `ui/openedRoute.ts` maps the hash to the route; at the first render a `#pass` link has no resolved pass yet, so `App`'s route would say `home`. A `#live?…` that does not parse is `home`, as `App` draws it.
- **D-1166 — `follow_answer` sends one outcome per question.** *(R196)*
  `not_now` at the press; after `[ allow ]`, `allow` when the phone grants and `refused` when it refuses or throws. The plain toggle sends nothing.
- **D-1167 — On wide, `when_shown` and `what_shown` are sent once the home's panes hold an observer.** *(R196)*
  On compact only the first-run steps send the three `_shown` names; the stacked later visit sends none. A wide pass page does not mount the home, so a cold open to a pass link sends neither.
- **D-1168 — `pass_open` means a pass is open.** *(R196)*
  The bare `#pass` page with nothing selected is not a pass detail.
- **D-1169 — `place_set` stays the store's; no screen sends it.** *(R196)*
  D-1154 and the observer's `source` already carry `search`, `coords` and `device`; a screen-side call would count twice.
  `sky_screen_open` has no call: FR-GYRO-6 retired the sky screen in v2.9, so FR-MEAS-2's row has nothing to count until the owner amends the table.

### 9.17 v2.15 additions *(FR-MEAS)*

- **Pure.** `src/model/measure.test.ts` (the guard, every name and detail, the rejects), `src/data/measure.test.ts` (once per pair, offline, no beacon, a throwing beacon, a foreign origin, `webdriver`, `forced`), `scripts/funnel.test.ts` (the fixture, the flags, the empty store, the missing credential).
- **The route.** `tests/deploy/endpoint.test.ts` on `collect` with real `Request`s and a recording `write`; `tests/deploy/wrangler.test.ts` gains the script, the two bindings and `run_worker_first` being exactly `["/e"]`.
- **State and components.** `measureEffects.test.ts` per state fact; the touched components' tests assert their `count` call through a mocked `state/measure`.
- **End to end.** `measure.spec.ts`: `/e` fulfilled `204` by a route handler that records bodies, `__WIYS_MEASURE__` set; US-58 AC3's walk at 390 × 844 and the wide cold open to a pass, both languages; FR-MEAS-5's leak and storage checks; offline then online.
- **Captures.** Every page's footer moves and the first run's where step moves (FR-MEAS-7); re-shot by `captures.yml`, read by the owner.

### 11.9 v2.15 build and deploy *(FR-MEAS-4)*

`wrangler deploy` now bundles `edge/index.ts` with the assets; `vite build` and `dist/` are unchanged, and `vite preview` has no `/e`, which the origin gate makes moot.
Two facts could not be read from Cloudflare's documentation in the planning session and are checked on the first preview deploy, before the tag: that `run_worker_first` takes the path list as written, and that `not_found_handling` still answers unknown paths with the 404 page.
Workers Analytics Engine: one index and up to twenty blobs per point, three months kept, and a free allowance of about 100 000 points a day, against a few dozen events per visit at most.
The owner creates one API token with account analytics read for `npm run funnel`; it is never in the repository or in the Worker.
No npm dependency is added.

### 16.36 v2.15 delivery

Five tasks in three waves, each built by a sub-agent in its own worktree and merged into the phase branch when its checks are green; one pull request for the phase when the owner asks for it.
The Lane column is §16.1's; this phase adds `edge/**` and `scripts/funnel.ts` to `docs`, which already owns `wrangler.jsonc` and `tests/deploy/**`.

| Wave | Task | Lane | Tier | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R193 — The event and its sender: `model/measure.ts`, `data/measure.ts`, `state/measure.ts`, `state/measureEffects.ts`, `startApp`'s wiring, the size test (D-1145..D-1147 state half, D-1151) | `data` | standard | auto | — |
| 1 | R194 — The privacy note removed (D-1150) | `ui` | light | owner (captures) | — |
| 2 | R195 — The route: `edge/**`, `wrangler.jsonc`, the deploy tests (D-1148) | `docs` | standard | auto | R193 |
| 2 | R196 — The screens count: every `src/ui` call of D-1147 and `measure.spec.ts` | `ui` | standard | auto | R193, R194 |
| 3 | R197 — The funnel, the documents and 2.15.0: `scripts/funnel.ts`, README, `docs/DEPLOY.md`, `package.json` (D-1149) | `docs` | light | auto | R195 |

Decision blocks: R193 D-1152..D-1156, R194 D-1157..D-1159, R195 D-1160..D-1164, R196 D-1165..D-1169, R197 D-1170..D-1172.
Budget: the main chunk grows by at most 1 KB gzipped (D-1151); no other chunk moves.
