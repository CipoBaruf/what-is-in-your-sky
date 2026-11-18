# v2.15 — SPEC.md sections

Phase file of SPEC.md (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.22 Goals (v2.15, "where they stop")

- **G67. Know where a first visit stops.**
  The owner can read, for any recent span of days, how many first visits reached each step of the first run and which way each place was set, without watching anyone.
- **G68. Count the visit, not the visitor.**
  What is counted names a screen or a step and never a person, a place or a typed word; nothing is stored on the device and nothing goes to a third party.

**US-58 — Where do they stop** *(v2.15)*
As the owner, I run one command and read how far first visits get, so the next phase changes the step that loses them.
- AC1: `npm run funnel` prints the last `FUNNEL_DAYS` days: the visits by first or return, by layout and by language, then the first run as one row per step with its count and its share of the cold opens (FR-MEAS-6).
- AC2: The `place_set` row is split by method and the `door` row by door; refusals, empty searches, empty nights and failures are listed with their counts (FR-MEAS-6).
- AC3: Walking the first run at 390 × 844 from an empty store sends `open`, `where_shown`, `place_set`, `when_shown`, `what_shown` and `door`, each once and in that order, all with one `id` (FR-MEAS-1, FR-MEAS-2).

**US-59 — Counted, not known** *(v2.15)*
As a reader, I use the app and nothing about me, my place or what I typed leaves my browser with the counts.
- AC1: With a place typed, a coordinate pair entered and the device location used, no request to `/e` carries any of the typed text, the place's name, a latitude or a longitude (FR-MEAS-5).
- AC2: After a full visit the measurement has written no cookie and no key in local storage, session storage or IndexedDB (FR-MEAS-5).
- AC3: With no connection nothing is queued: after going back online no event from the offline span is sent (FR-MEAS-3).
- AC4: The home screen, the footer and the settings page carry no privacy sentence and no `[ × ]` for one; the README says what is counted (FR-MEAS-7).

### 4.58 Measurement *(v2.15)*

The feedback of November 2026 is that new readers do not understand what the app is for.
Before the first run is changed, this phase counts where first visits stop, so the change is aimed and its effect can be read against a baseline.
It is the first time the site receives anything: one route that takes counts, on the address that serves the app.

- **FR-MEAS-1** *(V215-2, V215-6)* **The event.**
  An event is exactly these fields and no other: `name`, one of FR-MEAS-2's names; `detail`, one of that name's listed values or absent; `visit`, `first` where the page loaded with no observer (FR-FIRST-4's first visit) and `return` otherwise; `layout`, `compact` or `wide` at load; `lang`, `en` or `es` at load; `id`, a random value made when the page loads.
  `id` lives in the page's memory only: it is never written to a cookie or to any storage, a reload makes a new one, and two visits cannot be joined by it.
  No field holds free text: every value comes from a closed list in the code, except `id`.
  *Verification:* `measure.test.ts` — the event type admits only the listed names and details (a type test and a runtime guard that drops anything else); `visit`, `layout` and `lang` are fixed at load and do not change within it; two loads make two ids.

- **FR-MEAS-2** *(V215-1, V215-7)* **What is counted.**
  The names, each with when it is sent and its `detail` values:

  | `name` | Sent when | `detail` |
  |---|---|---|
  | `open` | the page has loaded | the route: `home`, `pass`, `live`, `stars`, `settings` |
  | `where_shown` | the first run's where step is on screen (compact), or the cold open (wide) | — |
  | `place_set` | an observer is set | `search`, `coords`, `device`, `favourite`, `link` |
  | `device_refused` | the device location fails | `denied`, `unavailable`, `timeout` |
  | `search_empty` | a place search answers with no place | — |
  | `when_shown` | the first run's when step is on screen (compact), or the When pane is first lit (wide) | — |
  | `what_shown` | the first run's what step is on screen (compact), or the What pane is first lit (wide) | — |
  | `door` | one of the home's three doors is chosen | `satellites`, `stars`, `live` |
  | `pass_open` | a pass detail opens | — |
  | `live_open` | the live page opens | — |
  | `stars_open` | the stars page opens | — |
  | `sky_screen_open` | the sky screen opens | — |
  | `settings_open` | the settings page opens | — |
  | `follow_answer` | FR-PHONE-17's question is answered | `allow`, `not_now`, `refused` |
  | `no_passes` | the 72 h list is computed and is empty | — |
  | `failure` | FR-FAIL-1's line is shown | `elements`, `forecast`, `search`, `passes`, `live` |

  Each name-and-detail pair is sent at most once per page load (V215-7), so a reader who opens ten passes counts once and the volume is bounded by the table's size.
  A name or a detail is added only by amending this table.
  *Verification:* `measure.test.ts` — a second send of the same pair in one load is dropped; a component or store test per row asserting the pair is sent at the named moment and not before; `measure.spec.ts` — US-58 AC3's walk at 390 × 844 and the cold open to a pass at 1280 × 800, in both languages, reading the captured requests.

- **FR-MEAS-3** *(V215-2)* **Sending.**
  An event is one `navigator.sendBeacon` `POST` to `/e` on the page's own origin, sent after the frame it belongs to has painted.
  With no connection (`navigator.onLine` false) or with no `sendBeacon` the event is dropped: nothing is queued, retried or stored.
  A send that fails is silent: no line, no console error, no effect on the page.
  Events are sent only where the page's origin is the public address (FR-ADDR-2), so previews, local builds and the test suite's own server count nothing unless a test turns it on; an automated browser (`navigator.webdriver`) is never counted on the public address.
  The module that sends is at most `MEASURE_MAX_KB` (1 KB gzipped) of the main chunk; rationale: the first paint must not pay for the count.
  *Verification:* `measure.test.ts` — offline, no `sendBeacon`, a throwing `sendBeacon`, a foreign origin and `webdriver` each send nothing and throw nothing; `measure.spec.ts` — offline then online sends nothing from the offline span (US-59 AC3); `npm run bundle:budget` with the module's row.

- **FR-MEAS-4** *(V215-2, V215-6)* **The route that receives.**
  `/e` accepts a `POST` whose body is one event of at most `EVENT_MAX_BYTES` (512); a body that is larger, is not an event of FR-MEAS-1 or names a pair outside FR-MEAS-2 is dropped.
  It answers `204` with no body and no `Set-Cookie` whether the event was kept or dropped, and any other method on `/e` is refused with `405`.
  A kept event is stored as its six fields, stamped by the store with the time it arrived; the address it came from, its user agent, its referrer and every other header are not stored and not logged.
  The store is the site's own account (Workers Analytics Engine, V215-2), kept for as long as the store keeps it and no longer; nothing is sent on to anyone.
  Every other path is served as it is on 2.14.3: the same files, the same headers, the same `404`.
  *Verification:* `tests/deploy/endpoint.test.ts` against the route's handler — a valid event is written once as its six fields, the arrival time being the store's own; an oversize body, a malformed body, an unknown name and an unknown detail write nothing; every case answers `204` with no body and no cookie; `GET` answers `405`; no write contains a header's value.
  `tests/deploy/headers.test.ts` unchanged and green: the CSP gains no host.

- **FR-MEAS-5** *(V215-6)* **Never sent, never stored.**
  No event carries a latitude, a longitude, an altitude, a place's name, a typed character, a satellite's name, a time zone or a time from the reader's clock.
  The measurement writes nothing to the device.
  *Verification:* `measure.spec.ts` — a visit that types a place, picks it, enters a coordinate pair and uses a stubbed device location, at both widths.
  Every captured `/e` body parses as FR-MEAS-1's six fields and contains none of the typed strings, the place's name or either coordinate in any decimal form; before and after, the cookie jar is empty and the keys of local storage, session storage and IndexedDB are those of a run with the measurement off.

- **FR-MEAS-6** *(V215-1)* **The funnel.**
  `npm run funnel` reads the store for the last `FUNNEL_DAYS` days (default 14, rationale: two weeks is the baseline the next phase is read against; `--days <n>` overrides) and prints plain text.
  First the count of `open` by `visit`, by `layout` and by `lang`.
  Then, for first visits, one row each for `where_shown`, `place_set`, `when_shown`, `what_shown`, `door` and `pass_open`, with the count of distinct `id`s and its share of `where_shown`'s; `place_set` split by method and `door` by door.
  Then the counts of `device_refused`, `search_empty`, `no_passes`, `failure` and `follow_answer` by detail.
  `--layout` and `--lang` narrow every row.
  The owner's credentials for the store are read from the environment and are in no file of the repository.
  *Verification:* `funnel.test.ts` — a fixture of stored rows prints the expected table, shares included, with and without each flag; an empty store prints the rows with zeros and no division error; a missing credential exits non-zero naming the variable.

- **FR-MEAS-7** *(V215-5; supersedes FR-KEEP-4)* **The privacy note goes.**
  The line under the place search (`Saved in this browser only. No account, no tracking.`), the footer's privacy sentence and its short word (`No analytics, no tracking: …`, `No tracking`), their `[ × ]` and the settings page's privacy sentence are removed in both languages; no sentence replaces them.
  The footer's row and the search's foot close up with no gap, and `privacyNoteClosed` is no longer read or written (a stored value is left alone and ignored).
  The README and `docs/DEPLOY.md` say what FR-X-3 now says in place of "no analytics or tracking", and `wrangler.jsonc`'s comment is corrected.
  *Verification:* `Footer.test.tsx`, `LocationInput.test.tsx` and the settings page's test — no privacy text and no close control in either language; `messages.test.ts`'s snapshot loses the four keys; `controlRows.test.ts`'s footer rows still fit; the captures of every page move, a named move.

#### Amended

- **FR-X-3** *(amended v2.15, V215-3; before: no analytics or tracking beyond anonymous, aggregate error logging)*
  No third-party analytics, no cookie and no stored identifier; the site counts FR-MEAS-2's events as FR-MEAS-1's fields and nothing else.
  The app still connects only to its own origin, CelesTrak and Open-Meteo.
  *Verification:* `tests/deploy/headers.test.ts` as before; FR-MEAS-5's.
- **§2.2 non-goal "Any first-party backend"** *(amended v2.15, V215-2)*
  The site has one route of its own, `/e`, which only receives counts; the app's data still comes from the browser's own requests, and the caching proxy stays in Phase 3.
- **FR-KEEP-4** *(superseded v2.15, V215-5)* by FR-MEAS-7.
- **US-57 AC4** *(superseded v2.15, V215-5)*: there is no note to close.

#### Definition of done

- FR-MEAS-1..7 and FR-X-3 as amended met, each by its verification line; US-58 and US-59 by their criteria.
- `npm test` green; `npm run bundle:budget` no row over 2.14.3's by more than 1 KB without a named reason in the release record.
- A deploy to a preview answers `204` on `POST /e` and serves every other path as before; the first production day shows rows in `npm run funnel`.
- `package.json` reads 2.15.0; the release record lists the captures that move (FR-MEAS-7).
- The tag and the deploy are the owner's.

### Phase 2x — v2.15 ("where they stop", as decided 2026-11-18, V215-1)

After v2.14.3 is on `main`.
One route that receives anonymous counts, the events of the first run and of each page, a command that prints the funnel, and the privacy note's removal.
Goals G67–G68, §4.58, FR-MEAS-1..7, FR-X-3 amended, US-58..US-59; the decisions are V215-1..V215-7.

**Next, not yet specified:** the first run reworked so a new reader sees an answer before a question, written after two weeks of FR-MEAS-6's numbers and judged against them.
