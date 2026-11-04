# v2.1 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.9 Goals (v2.1, "the audit and the flow")

- **G27. Every screen has a structure.**
  A reader who cannot see the page can tell which screen they are on, find its main content and walk its headings; a reader who can sees no difference.
- **G28. The list tells the time.** "Tonight" is tonight, a pass that has ended is gone, and a list computed days ago is never offered as the coming three nights.
- **G29. Nothing of mine changes without my asking.**
  Opening somebody's link shows me their sky and leaves my place where it was.
- **G30. A failure is said, and can be tried again.**
  No screen waits for ever, no error is a code in the middle of a sentence, and no recovery needs a reload.
- **G32. The list is what I can see.**
  *(V21-20)* Passes too faint to find are behind one control, and the count says how many.
- **G33. The page fits what it is on.**
  *(V21-22)* Between a phone and a desk the phone's layout keeps a phone's measure instead of stretching.
- **G31. The first run has no dead end.**
  Every screen of it fits a phone, every field looks empty until it is filled, every step has a visible way forward, and the first pass a new reader sees can be opened.

**US-30 — Walk the page without seeing it** *(v2.1)*
As a reader using a screen reader or the keyboard alone, I can tell which screen I am on, jump to its content and move through it by headings.
- AC1: Home, the pass guide, the live page and the settings page each have exactly one `main` landmark and exactly one `h1`; the home and the settings page also have a `banner`, a `navigation` and a `contentinfo` landmark at every width (FR-A11Y-1).
- AC2: On the home page the pane headings are `h2`, a night's heading is `h3` and a pass card's name is one level under what holds it (`h4` under a night); no level is skipped and no page has more than ten `h2` (FR-A11Y-2).
- AC3: Each route has its own document title, in the active language, and the title changes when the route does (FR-A11Y-3).
- AC4: Entering a route moves the focus to that route's `h1` or to its Back control, and leaving it returns the focus to the control that opened it (FR-A11Y-4).
- AC5: The first focusable element of the home and the settings page is a "Skip to content" link, visible only while focused (FR-A11Y-5).

**US-34 — See the passes worth going out for** *(v2.1, V21-20)*
As a reader with forty passes in the list, I see the ones I could find with my eyes, and I can ask for the rest.
- AC1: By default the list leaves out passes fainter than `FAINT_MAG`, or than `FAINT_MAG_MOON` when the pass is tagged `[moon glare]`; the ISS and the pass of the next-event block are never left out (FR-FAINT-1).
- AC2: The count line says both numbers — "28 visible passes in 72 h · `[ show 12 faint ]`" — and the control shows them in place, dimmed, and hides them again (FR-FAINT-2).
- AC3: My choice is remembered on this browser; a shared pass link opens its pass whether or not it is faint (FR-FAINT-3).

**US-35 — Use it on a tablet** *(v2.1, V21-22)*
As a reader on a tablet or a narrow window, the page is a phone's column in the middle of my screen, not a phone's column stretched across it.
- AC1: From 431 to 963 px the home, the guide's sheet, the settings page and the compact live page are at most `COMPACT_MAX_CELLS` wide and centred (FR-TAB-1).
- AC2: The chart box is never wider than that column, and at 768 × 1024 and 820 × 1180 the live page does not scroll (FR-TAB-2).

**US-31 — Trust what the list calls tonight** *(v2.1)*
As a returning reader, I open the app after a day or a week and the list is about the nights ahead of me, not the ones behind.
- AC1: A pass that ends before dawn is under the same night as one the evening before it (FR-NIGHT-1).
- AC2: A pass that has ended is not a card and is not in the count (FR-NIGHT-2).
- AC3: A stored run whose window has wholly passed is never shown as a list; the page says it is computing (FR-NIGHT-3).
- AC4: Bringing the page back after more than `RECOMPUTE_STALE_H` recomputes without my asking (FR-NIGHT-4).

**US-32 — Open a link without losing my place** *(v2.1)*
As a reader with a saved place, I open a pass or a live sky somebody sent me and my own place, its name and its time zone are still mine afterwards.
- AC1: With a saved place, a link's place is shown and not stored; a notice names it and offers `[ back to my place ]` and `[ keep this place ]` (FR-VISIT-1, FR-VISIT-2).
- AC2: With no saved place, the link's place becomes mine as it does today (FR-VISIT-1).
- AC3: A link whose moment has passed, or whose values cannot be read, says so in one line instead of opening on something else silently (FR-VISIT-3, FR-VISIT-4).

**US-33 — Try again** *(v2.1)*
As a reader on a bad connection, I am told what failed in my language and I can retry it where it failed.
- AC1: A failed load of the elements, the forecast, the place search or the passes shows a sentence with no status code in it and a `[ retry ]` beside it; the code is behind `[ details ]` (FR-FAIL-1, FR-FAIL-2).
- AC2: The forecast is refreshed when it is older than `WEATHER_MAX_AGE_MIN` and the page is brought back, and it is retried whenever the elements are (FR-FAIL-3).
- AC3: A computation that stops reporting turns into the failure line within `JOB_STALL_S`; a render error shows a page with `[ reload ]`, never a blank one (FR-FAIL-4, FR-FAIL-5).
- AC4: The live page says whether it is loading or has failed, offers `[ retry ]` when it has, and with no network runs from the stored run (FR-FAIL-6).

---

### 4.33 Document structure *(v2.1)*

FR-X-5 asks for contrast, text alternatives and keyboard operation.
It says nothing about what a page is made of, so the live page shipped with no landmark and no heading and no test could object (F-71, F-72).
These requirements extend FR-X-5.
Each is checked with DOM queries in the existing component and e2e suites: no new dependency, since a task session cannot add one (V21-2).

- **FR-A11Y-1** Landmarks.
  Every route — home, the pass guide (sheet or pane), `#live`, `#settings` — renders exactly one `main` and exactly one `h1`.
  Home and settings also render one `banner`, one `navigation` (the header's links, at every width — the wide header has none today) and one `contentinfo`.
  The live page's top row is its `banner`, its `h1` is the page's name ("Live sky", which MAY be visually the existing `live` word beside the bead), and the drawing, the headline and the inventory are inside `main`.
  The sky screen stays a modal `dialog` (§4.31) with an accessible name and needs no landmark of its own.
  *Verification:* an e2e visits each route at 390 and 1280 px and asserts the counts with `querySelectorAll`.
- **FR-A11Y-2** The outline.
  Home: `h1` the title; `h2` Where, When, What (on the phone's first run, the step's question); `h3` each night's heading, which the night toggles label; a pass card's name one level under what holds it — `h4` under a night, `h3` on the phone's third step, where the cards sit straight under the step's question and there is no night heading.
  The guide: its pass name is `h2` and its blocks `h3`.
  Settings: its three blocks are `h2`.
  No level is skipped, and no page has more than `A11Y_MAX_H2` (10) `h2` elements.
  The drawing is unchanged: rank is the element, not the size.
  *Verification:* a component test per screen asserts the ordered list of `(level, text)`; the e2e asserts no skipped level on the populated home with a 40-pass fixture.
- **FR-A11Y-3** Titles.
  `document.title` is `<route> · <app title>` in the active language — "Live sky · …", "Settings · …", "<satellite> <start time> · …" for an open pass — and the bare app title on home.
  It changes with the route and with the language (US-13 AC5).
  *Verification:* an e2e asserts the title on each route in both languages.
- **FR-A11Y-4** Focus follows the route.
  Entering `#live` or `#settings` focuses that page's Back control (settings does today); opening a pass focuses the guide's heading (it does today); leaving any of them returns the focus to the control that opened it, or to the `h1` when that control no longer exists.
  A first-run step change focuses the new step's heading (it does today, PLAN D-513).
  Every route change is announced once through a polite live region naming the new route.
  *Verification:* an e2e asserts `document.activeElement` after each transition, both ways.
- **FR-A11Y-5** A skip link.
  The first focusable element of home and settings is "Skip to content" (`a11y.skip`), positioned off-screen until focused, drawn in the accent on `--bg` when focused, targeting `main`.
  The live page has three controls before its content and needs none.
- **FR-A11Y-6** What this section does not claim.
  Contrast in the default dark theme, a named screen-reader run, a Tab walk on a device and text scaling to 200 % were not checked by the audit and are not asserted here; they are OQ-35, and the release checklist's phone run gains a VoiceOver or TalkBack pass over the four routes.
  *(amended the same day, V21-19: contrast is now asserted, by FR-A11Y-7.)*
- **FR-A11Y-7** *(V21-19)* An axe run.
  `@axe-core/playwright` — a dev dependency the owner installs on `main` before the task that uses it is cut, since a task session has no network — runs in the e2e suite over home (cold and populated), the open guide, `#live` in both states and `#settings`, at 390 and 1280 px, in the dark and the night theme, with the WCAG 2.0/2.1 A and AA rule tags, and reports **no violation**.
  That includes `color-contrast`, which makes FR-X-5's AA claim a measured one in the default theme as FR-THEME-2's tokens test does for night.
  The character grids are already hidden from assistive technology (FR-GUIDE-7) and are not excluded by selector; any rule disabled is listed in the spec file with its reason and a finding.
  FR-A11Y-1..5's DOM-query assertions stay: they say what the structure is, where axe only says nothing is wrong with it.

### 4.34 The list tells the time *(v2.1)*

The list was specified as a computation's output and never as something a clock runs past (F-90).
Physics is untouched: these rules group, filter and re-trigger; they change no pass.

- **FR-NIGHT-1** A night is the half-open interval from the observer's local noon to the next local noon, in the observer's time zone (FR-LOC-3) or, until one is known, the device's — never UTC by default.
  A pass belongs to the night that holds its start.
  **Tonight** is the night holding the shown clock's instant; before local noon that is the night that began yesterday evening only while a pass of it is still to come or under way, and otherwise the coming one.
  The headings are "Tonight", "Tomorrow night" and the night's starting date, and they are recomputed when the clock crosses local noon, with no recompute of the passes.
  *Verification:* a pure-module test over a fixture run computed at 01:00 local: the 05:00 pass is under last evening's night, the 21:00 pass under the coming one; a run in a zone east of UTC and one west; a null zone falls back to the device's.
- **FR-NIGHT-2** A pass leaves when it ends.
  A pass whose end is more than `ENDED_LINGER_S` (60 s) behind the clock is not rendered as a card, not counted in the count line or a night's count, and not ticked on tonight's stripe; inside those 60 s its card reads `ended` in place of the cloud word.
  The open pass is exempt while it is open.
  A night with no pass left is not drawn.
  *Verification:* a component test under a fake clock.
- **FR-NIGHT-3** A stored run is as old as it is.
  On load, a stored run whose window end is behind the clock is not shown: the list says it is computing, as on a first load.
  A run partly elapsed is shown through FR-NIGHT-2's filter, and its count line says what is left — "12 visible passes in the next 31 h" — not the run's original span.
  *Verification:* a store test with stored runs aged 1 h, 50 h and 14 days.
- **FR-NIGHT-4** Waking recomputes.
  On `visibilitychange` to visible and on the 15-minute recheck, if the stored run's window start is more than `RECOMPUTE_STALE_H` (2 h) behind the clock, a recompute starts from the elements in hand, shown as FR-VIS-5's progress over the still-readable old list (FR-VIS-5 as amended). 2 h is the elements' own refresh interval: a window older than that is already due new data.
- **FR-NIGHT-5** The next event follows the same clock: `lib/nextEvent.ts` already skips ended passes; with none left in the run the When reading shows the no-pass line and FR-NIGHT-4 has already fired.
  F-68's open clause lapses with the hero card.

### 4.35 A link is a visit *(v2.1)*

FR-LIVE-9 said a link "sets the observer" and the build stored it, so opening a friend's link cost a reader their own place, its name and its time zone (F-89).
The spec had not decided that; this does (V21-7).

- **FR-VISIT-1** With a saved observer, a link's place — from `#pass?…` or `#live?…`, on load or pasted into a running tab — is a **visit**: it is the observer of this tab's session and is never written to `wiys:prefs:v1`.
  With no saved observer the link's place is adopted and stored as today.
  A link whose rounded coordinates equal the saved place's is not a visit and changes nothing about the saved place (this extends PLAN D-280's guard from live links to pass links).
- **FR-VISIT-2** While visiting, one notice line heads the page under the header, on home and on the live page, `role="status"`, at `--small`: "Showing the sky from <coordinates>, from a link · `[ back to my place ]` `[ keep this place ]`".
  Back restores the saved observer, clears the hash and recomputes; keep stores the visited place (FR-LOC-5) and removes the notice.
  Favourites, offline readiness (FR-OFF-4) and the stored run are the saved place's throughout a visit, and the visited place's run is not stored.
  On compact the notice is at most two rows of 36 cells in both languages.
  *Verification:* an e2e loads a pass link over a saved, named place: the notice is shown, storage is byte-identical, `[ back to my place ]` restores the label and the time zone.
- **FR-VISIT-3** A moment that has passed is said.
  A live link whose `t` is behind the clock opens at real time — watching, not held — with a one-line note, "This link was for <time>, which has passed.
  Showing now." A `t` beyond the stripe's span opens held at the span's end with "…is more than 24 h ahead.
  Showing the latest the page can." A held instant that real time overtakes releases to watching.
- **FR-VISIT-4** An unreadable link is said.
  A hash that starts as a known route and fails to parse (`#live?lat=999`, a pass link with a bad `start`) opens the reader's own home with "That link could not be read." and the hash cleared; an unknown hash is cleared silently.
  Neither ever changes the observer.

### 4.36 Failures *(v2.1)*

Each failure was handled where it arose and no two alike; none could be retried without a reload (F-87, F-88, F-92, F-94..F-96).
One pattern (V21-9).

- **FR-FAIL-1** The failure line.
  Wherever a load or a job fails — the elements, the forecast, the place search, the pass computation, the live page's start — the place its result would have been shows one line: a sentence in the active language saying what could not be done and what the page is using instead, then `[ retry ]`, then `[ details ]`.
  `[ retry ]` re-runs that one thing and shows its loading state; it is a 48 px control on compact.
- **FR-FAIL-2** No internals in a sentence.
  Status codes, exception names and provider messages appear only inside `[ details ]`, as monospace text the reader can copy.
  A failure is stored as a **kind** (`offline`, `rate-limited`, `server`, `bad-data`, `timeout`, `unknown`) and rendered at draw time, so a language switch re-renders it.
  *Verification:* a component test per failure kind in both languages asserts the sentence matches no `/HTTP|\d{3}|Error:/`.
- **FR-FAIL-3** The forecast is kept fresh.
  It is re-requested when the page becomes visible with a snapshot older than `WEATHER_MAX_AGE_MIN` (60), and whenever the elements recheck runs after a failed forecast.
  Until it answers, the last snapshot stays on screen with its age.
  A place whose time zone is still unknown because the forecast failed gets it from the retry (FR-LOC-3).
- **FR-FAIL-4** A job that stops is a failure.
  The worker client listens for `error` and `messageerror`; a pass job that reports no progress for `JOB_STALL_S` (60 s) is ended.
  Either turns "Computing…" into FR-FAIL-1's line, stops the mark's bead, and `[ retry ]` starts a new worker.
- **FR-FAIL-5** A render error is a page.
  A root error boundary renders the header's title, "Something broke on this page.", `[ reload ]` and `[ details ]`; it is in the main chunk and uses no component that could itself have thrown.
- **FR-FAIL-6** The live page.
  Its loading and failed states are FR-LIVE-1's as amended; failed carries FR-FAIL-1's line.
  With no network and a stored run it opens (FR-OFF-8).
- **FR-FAIL-7** The sky screen.
  If no orientation event arrives within `SENSOR_WAIT_S` (3 s) of the tap, the screen shows FR-FOL-5's relative note — "This device is not reporting which way it faces." — instead of waiting.
  After an iOS denial the note says how to ask again (reload the page; Safari asks once per load), since the app cannot.
  *(amended v2.9, V29-1; before: both sentences were the sky screen's)* The first sentence is withdrawn with the screen (§4.23, FR-GYRO-6): a following window with no reading yet keeps the hand's picture (D-959).
  The second stands for `[ follow the phone ]`, whose refusal line is FR-GYRO-3's.
- **FR-FAIL-8** The install button.
  The held `beforeinstallprompt` event is cleared once used; a cancelled native prompt leaves the row as it was, and the button hides only when the browser stops offering or the app is installed (FR-OFF-6's snooze rule is for the home page's hint and is unchanged).

### 4.37 Back goes back *(v2.1)*

- **FR-ROUTE-1** What the app pushed, it pops.
  Closing a pass, the live page or the settings page through the UI — `[ ← Back ]`, `Esc`, the sheet's close — calls `history.back()` when the entry was pushed by this session's own navigation, and replaces the state only when the route was the load's entry (a bookmark, a link).
  After opening and closing five passes, one press of the browser's Back leaves the app (F-91).
  *Verification:* an e2e opens and closes three passes, the live page and settings, and asserts `history.length` grew by zero net entries and that one `page.goBack()` leaves the origin.
- **FR-ROUTE-2** The browser's Back and Forward are honoured on every route: the app listens for `popstate`/`hashchange` and renders the route the URL names, closing the sky screen first where one is open (OQ-22's answer stays the owner's).
- **FR-ROUTE-3** A reload keeps the route: `#settings`, `#live` with its `t`, and `#pass=<id>` when the pass is still in the run; when it is not, the home with FR-SHARE-3's message rather than nothing.

### 4.38 The home at desk widths *(v2.1)*

The three-pane rule is right and is unchanged (FR-FIRST-5, PLAN D-465): stacked under 964 px, two columns to 1117, three panes from 1118.
What follows is what the audit found around it (F-76, F-79) and what no requirement had said about a big screen.

- **FR-HOME-1** The header holds.
  At every wide width, in both languages, the wide header is one title line — the mark, the title, `[ Live sky ]`, and the language and theme controls — and at most one tagline line.
  When the title line would wrap, the tagline is what goes, then the title takes its short form (FR-COMP-1's); `[ Live sky ]` never drops to a line of its own.
  *Verification:* an e2e at 964, 1024, 1118 and 1280 px in both languages asserts the header's height is one of two values and the title row's children share one `top`.
- **FR-HOME-2** The next event is on screen.
  With a place set, at every desktop size of FR-SHP-4's matrix and in both languages, the next-event block — its label, its time, its path line and `[ Open the live sky ]` — is wholly inside the viewport on load without scrolling.
  On the two-column layout When's blocks are reordered if they must be so that this holds: the next event directly under the stripe, the table after it.
  *Verification:* an e2e asserts the block's `getBoundingClientRect()` against the viewport at 1024 × 768 and 1280 × 800, both languages.
- **FR-HOME-3** One pane scrolls.
  On the three-pane page only What scrolls.
  Where fits its pane at 1280 × 800 and above with the dome, the readiness line, the elements line and the saved-places line all visible; below that height the dome is what shrinks (down to `LIVE_BOX_MIN_PX`), and under it the dome is not drawn.
  *Verification:* an e2e asserts `scrollHeight <= clientHeight` for Where and When at 1118 × 700, 1280 × 800 and 1920 × 1080.
  *(amended v2.2, V22-14)* **The footer's second row is paid from the shell's air, never from the panes.**
  With the fourth credit (FR-SHOW-8) the wide one-row footer holds one line only from `FOOTER_ONE_LINE_MIN_PX`, a width per language measured by R102 on the built app (1330/1349 px with the author's name in the row; re-measured without it, V22-15), and below that it is two lines.
  Where it is two lines, the main's row of padding above and below the panes halves, as it already does under 720 px tall (D-608), and where it is already half it goes to nothing; the footer's own top padding halves with it.
  So FR-HOME-2's block stays on screen at 1024 × 768 and When holds its pane at 1118 × 700 in both languages, with the same e2e and the same sizes.
  The literals are per language, like the header's fold (D-546), and pinned by `breakpoint.test.ts`.
  The old rule — the padding halves under 720 px only — held from v2.1.
- **FR-HOME-4** The page stops growing.
  From `HOME_MAX_CELLS` (160 cells, about 1540 px) the header, the three panes and the footer hold that width and are centred, the panes staying equal; the dome is the size it has at that width.
  The live page is not capped: its drawing is the point of a big screen (FR-DOME-1).
  *Verification:* `breakpoint.test.ts` pins the literal; an e2e at 1920 and 2560 px asserts the content's width and its centring.
  *(amended v2.11, V211-8; before: "The live page is not capped")* Every page holds `HOME_MAX_CELLS` and is centred from that width — the live page, the stars page, the pass detail and the settings page as the home (FR-CLEAN-12); the drawing is the size it has at that width.

### 4.39 What a capture shows *(v2.1)*

The release set closed every night on the home to keep a phone capture reviewable, and its paused clock held the frame the Where dome waits for, so the two home captures a closed question cites show neither the list nor the dome (F-80).
The set is evidence; it has to show what a reader sees.

- **FR-CAP-1** A capture shows a screen in the state a reader opens it in: tonight open, the dome mounted, the clock's frame run.
  Where a capture must differ to stay reviewable, its `what` line in `captureSet.ts` says how, and the set carries a second capture of the true state cropped to the viewport, named with a `-view` suffix after the width (`v1-home-1280-view-dark-es.png`), which the filename check accepts.
- **FR-CAP-2** A 360 px column for every compact screen that has a 390 px capture.
  `narrow.spec.ts` asserts 360 and 344 hold; nothing pictured either.
- **FR-CAP-3** The home at 1920 × 1080, populated, all four variants (FR-HOME-4's evidence).
- **FR-CAP-4** A question or a finding closed on a capture names a file in which the thing is visible.
  OQ-32's resolution is re-pointed to the `-view` home captures once they exist; V20-30's decision stands and only its evidence sentence is superseded (V21-12).
- **FR-CAP-5** The set is deterministic: two runs of `captures.yml` on one commit produce byte-identical files.
  `v1-polar-390-night-es.png` (F-66) and the two moving variants of `v1-sky-screen-chip-844-*` (F-70) are fixed with the fixed clock and a settled frame, or, if one cannot be, it leaves the set with a row in `captureSet.ts` saying why.
  The short wide watching capture shows F-81's fix: the inventory clipped on a row boundary with its `+n` line and its times labelled.

### 4.40 Faint passes *(v2.1, V21-20)*

A correct list is not a useful one: on 2026-09-21 the 72 h list for −38.95, −68.06 held forty passes, a dozen of them a minute long near magnitude +4 at 11–16° under a 78 % Moon.
Nothing here changes what is computed (FR-VIS); it changes what is shown first.

- **FR-FAINT-1** A pass is **faint** when its peak magnitude (FR-VIS-4's figure) is greater than `FAINT_MAG` (+3.5 — about what a suburban sky shows to an unpractised eye), or greater than `FAINT_MAG_MOON` (+2.5) when the pass carries FR-MOON-2's `[moon glare]` tag.
  Never faint, whatever their figures: a pass of the ISS, the pass the next-event block names, and the open pass.
  A pure function of the stored run; both constants sit beside FR-VIS-6's thresholds.
- **FR-FAINT-2** By default faint passes are not cards, are not in a night's count and are not ticks on tonight's stripe.
  The count line carries them: "28 visible passes in 72 h · `[ show 12 faint ]`", and with them shown "40 visible passes in 72 h · `[ hide 12 faint ]`"; with none faint the control is not drawn.
  Shown, a faint pass is an ordinary card with its name in `--fg-dim` and a `[faint]` tag on its third line, in its place in the order.
  *(amended v2.12, D-1021: the phone's third step no longer lists passes, so the sentence there that counted what is shown and the control after `[<n> more tonight]` go with it.)* A night left with only faint passes keeps its heading with "0 passes · 3 faint".
  The count line still fits 36 cells in both languages (FR-COMP-4), the Spanish control being `[ ver 12 tenues ]`.
- **FR-FAINT-3** The choice is a stored preference (`showFaint`, default false, FR-LOC-5's store).
  A `#pass` link, FR-SHARE-3's nearest pass and FR-DESK-4's `j`/`k` reach a faint pass only while faint passes are shown, except that a link's own pass is always opened.
  The live page and the sky screen draw what is up, faint or not: FR-LIVE-11's hidden-objects list is their control and is unchanged.
- **FR-FAINT-4** *Verification:* a pure-module test over a fixture run pins the classification at the two thresholds and the three exemptions; a component test asserts the count line in both states and both languages and `controlRows.test.ts` its width; an e2e toggles the control, reloads and asserts the preference held.

### 4.41 From watching to the next pass *(v2.1, V21-21)*

By day the live page is an empty dome and a countdown nine hours long; the one thing a reader there wants is to see the pass the headline names.
FR-SPAN-4's `pass ▶|` does it, but only once scrubbing is open — two taps and a search for the control.

- **FR-JUMP-1** While watching (FR-WATCH-1), when the headline's next event is a rise more than `JUMP_MIN_AHEAD_S` (120 s) ahead and inside the stripe's 24 h, the headline carries one control after its path line: `[ see this pass ]` (`[ ver este pase ]`).
  It holds the page at that pass's rise — FR-SPAN-4's landing, to the second — which is the scrubbing state with its whole inventory (FR-WATCH-4), the stripe's chunk moved to hold the instant.
  It is 48 px tall on compact and adds no row at the four shapes of FR-SHP-4: it shares the path line's row where that fits and otherwise takes the place of the `[ scrub the night ]` control's row-mate (the plan decides which).
- **FR-JUMP-2** `[ now ]` returns to watching as from any held instant.
  The URL carries the held `t` as FR-LIVE-9 has it, so the view can be shared.
- **FR-JUMP-3** The home page's `[ Open the live sky ]` is unchanged — it opens real time.
  *Verification:* a component test asserts the control's presence on each side of 120 s and its absence while a pass is up; an e2e taps it by day under a fixed clock and asserts the held instant equals the pass's rise and the drawing shows its arc.
  *(amended v2.7, V27-2; FR-TONIGHT-1: on compact the live sky opened from the home may jump to the next visible pass.)*

### 4.42 Between a phone and a desk *(v2.1, V21-22)*

From 431 to 963 px the layout is compact (FR-DESK-1) and nothing had said how wide compact may get: at 900 px the rows are 36 cells of text in a 93-cell line and FR-COMP-5's box is a 900 px square.

- **FR-TAB-1** `COMPACT_MAX_CELLS` = 60 (about 580 px).
  On a compact viewport wider than that, the header, `main` and the footer of the home, the guide's sheet, the settings page and the compact live page hold 60 cells and are centred; the page's background fills the rest.
  Rows specified as "at most 36 cells" stay so — the cap is on the column, not a new budget for the rows.
- **FR-TAB-2** "Full-bleed" (FR-COMP-5) is the width of the capped column.
  The box is never shorter than it is wide up to the viewport's height less the page's kept rows (FR-COMP-5's and FR-LEG-8's rule, unchanged), so at 768 × 1024 and 820 × 1180 the live page does not scroll.
  The landscape phone (FR-SHP-2) is not capped: its two panes already divide the width.
  The sky screen is a layer over the whole viewport and is not capped.
- **FR-TAB-3** FR-SHP-4's matrix gains 768 × 1024 and 820 × 1180 under compact portrait, and the capture set a 768 px column for home, the guide, the live page and settings (FR-CAP).
  *Verification:* `breakpoint.test.ts` pins the literal; `shapes.spec.ts` asserts the column's width, its centring and no scroll at the two sizes.

### 5.10 v2.1 additions *(proposal; the plan decides)*

- **The shell.**
  One `Shell` that every route renders inside — `banner`, `main`, optional `contentinfo`, the route announcer and the title effect — so the live page stops replacing the landmarks.
  `lib/routeTitle.ts`, pure.
- **Nights.**
  `nightGroups.ts` re-cut on local noon with the zone as an argument; a `useLivePasses(t)` selector that applies FR-NIGHT-2; the staleness check beside the elements recheck in `state/effects.ts`.
- **Visits.**
  The observer slice gains `visiting: Observer | null` beside `observer`; selectors read `visiting ?? observer`; only `observer` is written through to storage.
  Boot (`state/index.ts`) and the pasted-hash paths in `App.tsx` go through one `openLink()`.
- **Failures.**
  A `Failure = { kind, detail }` type in `state/`, a `FailureLine` component, `retry` actions per slice; `workerClient.ts` listeners and the stall timer; `ui/RootBoundary.tsx`.
- **History.**
  One `navigation.ts` that records whether the current entry was pushed by the app and exposes `open(route)` / `close()`; `passSelection.ts`, `LiveRoute.ts` and the settings route use it.
- **The settings page as a lazy chunk** (F-69, V21-13), as the live page is: the main chunk returns under its 155 KB budget without raising it; the settings chunk gets its own budget by PLAN D-178's rule.
- **Faint.**
  `lib/faint.ts`, pure: `(pass, { nextEventId, openId }) → boolean`; `useShownPasses` applies it after FR-NIGHT-2's filter; `showFaint` in the prefs schema.
- **The jump.**
  No new state: the control dispatches the live slice's existing hold with the rise instant `lib/nextEvent.ts` already returns.
- **The cap.**
  One `max-width` literal on the shell's compact column, pinned like the other breakpoints.
- **One new dev dependency,** `@axe-core/playwright` (MPL-2.0, test-only, never bundled), installed by the owner on `main` (V21-19).
  No runtime dependency.

### Phase 2h — v2.1 ("the audit and the flow", as decided 2026-09-21, V21-1)

After the `v2.0.0` tag.
No backend, the same two providers, no new dependency and no new feature: what the audit of the 2.0.0 build measured, what a walk of the running app found, and what a reading of its state flow found, each as a requirement with a test.
Proposed order of work — what loses a reader something first:

- A link is a visit, and links that cannot be honoured say so (§4.35).
  First: it is the one defect that destroys a reader's data.
- The list tells the time (§4.34).
- Failures: the line, retry, the forecast kept fresh, the dead worker, the boundary, the live page's states, the sky screen's wait, the install button (§4.36).
- The first run: placeholders, `[ continue ]`, the first card and the whole card as controls, one screen with its footer, `[ set a place ]` (FR-FIRST-1..4 and FR-FIRST-10 as amended); the Moon sentence off the card (US-18 AC1).
- Document structure and the shell every route renders in (§4.33); Back goes back (§4.37) — together, since both are the shell.
- The home at desk widths (§4.38), and the compact live rows in Spanish (FR-COMP-7).
- The settings page as a lazy chunk (F-69) and the install row's label (F-83).
- *(V21-19..V21-22)* The axe run, once `@axe-core/playwright` is on `main` (FR-A11Y-7) — after the shell, which is what makes it pass.
  Faint passes behind a control (§4.40), after the nights task, which owns the same selector.
  `[ see this pass ]` on the watching headline (§4.41).
  The compact column capped from 431 px (§4.42), before the captures.
- The capture rule, the 360 px column, the home at 1920, the deterministic set (§4.39).
  Last before the release, so it shoots the finished screens.
- The release: `package.json` 2.1.0, the set re-shot, the budgets by PLAN D-178's rule, §4.20's register brought up to date.

Definition of done:
- US-30 AC1..AC5, US-31 AC1..AC4, US-32 AC1..AC3, US-33 AC1..AC4 and US-26 AC7 accepted; FR-A11Y-1..7, FR-NIGHT-1..5, FR-VISIT-1..4, FR-FAIL-1..8, FR-ROUTE-1..3, FR-HOME-1..4, FR-CAP-1..5, FR-FAINT-1..4, FR-JUMP-1..3, FR-TAB-1..3 and FR-COMP-7 met; US-27 AC7, US-34 AC1..AC3 and US-35 AC1..AC2 accepted; the amended US-16 AC5, US-18 AC1, US-26 AC1 and AC6, FR-X-5, FR-VIS-5, FR-LIVE-1, FR-LIVE-9, FR-OFF-8, FR-SHARE-3, FR-COMP-5, FR-COMP-6, FR-FIRST-1..4, FR-FIRST-10 and FR-SET-1 met; F-62, F-66, F-69, F-70 and F-71..F-96 closed in the register with the change that closed each.
- Physics untouched: no task changes the golden fixtures from R1, and `passes.golden.test.ts` passes unchanged.
  FR-NIGHT groups and filters passes; it computes none.
- Every slice provable on a laptop with no network, inside FR-CI-1's ten minutes, with no dependency added by a task: `@axe-core/playwright` is on `main` before the breakdown's first wave (V21-19).
- The main chunk inside its budget: 155 KB as written, 170 since the owner raised it at the release gate (V21-24).
- The earlier definitions of done still hold, and the D-179 set is re-shot on `main` under FR-CAP-1..5.
- The owner has run, on a phone: the first run from a clean browser, typing coordinates and opening the first card; a friend's link over a saved place and back; aeroplane mode on an open tab, then `[ retry ]`; a screen-reader pass over the four routes (FR-A11Y-6); and the first step scrolled, for F-97.
- `package.json` version 2.1.0, a `v2.1.0` tag, and the release checklist run on the deploy.
