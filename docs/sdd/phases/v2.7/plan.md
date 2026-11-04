# v2.7 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.43 v2.7 decisions (2026-10-29)

Compact only (V27-1): every change below is behind `mode === 'compact'` on the live page; the wide page, the stars page and the pass detail keep their code paths, and their captures do not move.

- **D-896 — The constants.**
  (FR-TONIGHT-1..5, FR-VIS-6.) `TONIGHT_LEAD_MIN`, `AUTO_SPEED_NEAR`, `AUTO_SPEED_GAP` and `AUTO_NEAR_MIN` join `ARC_LOOKAHEAD` in `physics/constants.ts` with their rationale comments (no physics changes; the golden fixtures are untouched).
  `TRACK_HEIGHT_PX` joins the layout constants in `lib/layout.ts`.
  `TONIGHT_MAIN_KB` is a row note in `scripts/bundle-budget.ts`, as `FLOW_MAIN_KB` was.
- **D-897 — The targets are pure.**
  (FR-TONIGHT-1, FR-TONIGHT-4.) A new `lib/tonightJump.ts` holds three functions over the stored run, with no React: `openingJump(passes, now, span)` returns the instant to land on (`start − TONIGHT_LEAD_MIN` of the first visible pass with `start > now` in the span) or `null` when a visible pass is up at now or none is in the span; `tonightTarget(bands, passes, now, t)` returns `{ t, play }` per FR-TONIGHT-4 (the night is the run of non-`day` bands at or after now, read from the same `SkyBand[]` `useSkyBands` gives the stripe, D-170); `nextTarget(passes, t)` returns the next lead instant or `null`. "Visible" is the same predicate the list uses (the pass is in `passes` and not hidden by FR-LIVE-6's saved state), so the jump never lands on a pass the page then hides.
- **D-898 — The jump is one effect and one flag.**
  (FR-TONIGHT-1, FR-TONIGHT-2.) `Live.tsx` runs one effect, compact only, on `[passes.length > 0]`: if the URL carried `t` (FR-LIVE-9), or the visit flag is set, or the reader has written `t` since mount, it does nothing; otherwise it calls `openingJump` and, on an instant, `playback.setT(instant)` then `playback.play()` unless `matchMedia('(prefers-reduced-motion: reduce)')` matches.
  It runs once: a ref records that the decision was taken, as D-883's moved flag does for the window.
  The visit flag `stayOnNow` lives in `state/slices/ui.ts`, in memory only (not in `localPrefs`), so a reload clears it; `now`'s handler sets it. "Written `t` since mount" is a ref `usePlayback` sets on every `setT`, `toNow`, `play` and key step it receives from the reader, not from the effect.
- **D-899 — The automatic speed is a rate per frame.**
  (FR-TONIGHT-5.) `lib/playback.ts` gains `autoSpeed(t, passes): 60 | 600` and `nightEnd(bands, t): EpochMs`, the end of the night band holding `t` or the next one's when `t` is in the day.
  `usePlayback` takes an option `speed: Speed | 'auto'` and an `end` override; with `'auto'` it asks `autoSpeed` each frame before `advance`, and splits a frame that crosses a rise-minus-`AUTO_NEAR_MIN` boundary at the boundary (the remainder at 60×), so no rise is passed at 600× however long the frame.
  `advance`'s contract and the measured rate (D-172) are unchanged.
  Wide passes the saved speed as today.
- **D-900 — `TimeTrack` is SVG.**
  (FR-TONIGHT-3.) `components/live/TimeTrack.tsx` draws as `TimeStripe` does (D-82): one `<svg>` the content width by `TRACK_HEIGHT_PX`, band rects from `useSkyBands`, pass ticks in `liveArcs`' colours (`max(3 px, duration × px/ms)` wide), the thumb a rect in `--accent`.
  Input is pointer events with `setPointerCapture`: `pointerdown` on a tick's 44 px zone (nearest tick centre wins) sets the lead instant; anywhere else, and every `pointermove` while captured, sets `t` from x; each pauses.
  It renders `role="slider"` with `aria-valuemin`/`max`/`now` in epoch ms and `aria-valuetext` from FR-TONIGHT-7's headline string; keys as `StripeOverview` (15 min, Page Up/Down 1 h).
  The label row is HTML under the SVG.
  `StripeOverview`, `TimeStripe` and `StepControls` are kept for wide and not imported on the compact branch.
- **D-901 — The three taps are one component.**
  (FR-TONIGHT-4.) `components/live/TimeTaps.tsx`: the play glyph (`▶`/`‖`, one cell, `.target` padding, `aria-label` "Play"/"Pause"), then `tonight`, `next`, `now` as `.target` buttons calling D-897's functions; `now` calls `playback.toNow()` and sets `stayOnNow`.
  `PlaybackControls` stays for wide.
- **D-902 — One compact inventory.**
  (FR-TONIGHT-6, FR-WATCH-4 as amended.) `liveRows.ts`'s `rowsFor(state, 'compact', shape)` returns the same list for `watching` and `scrubbing`: `top-row`, `headline`, `context`, `view-row`, `box`, `hint`, `track`, `taps`, `actions`, `share` — new ids `headline`, `context`, `track`, `taps` with test ids `live-headline`, `live-context`, `live-track`, `live-taps`; the compact list no longer holds `indicator`, `time-row`, `conditions`, `overview`, `stripe`, `steps`, `playback`, `back-to-live`, `scrub`, `hidden`, `next-event`.
  The wide lists are unchanged.
  `liveRows.test.ts` asserts presence and absence per state and that the compact lists are equal.
- **D-903 — The shown time and the context line.**
  (FR-TONIGHT-7.) `components/live/ShownTime.tsx` renders the time at the headline size and the chip; the chip's words come from a pure `lib/shownTime.ts` (`chipFor(t, now, bands, timeZone)` returns `{ kind: 'now' } | { kind: 'ahead' | 'behind', minutes, tonight, weekday }`).
  `lib/contextLine.ts` builds the line's parts (`upPass`, `sky`, `cloud`, `nextAt`, or a no-pass reason); the catalog formats it.
  `StatusStrip` and the next-event block stay for wide.
- **D-904 — The readout in the corner, the picker on tap.**
  (FR-TONIGHT-6.) `SkyViewLayout` gains a prop `readoutIn: 'row' | 'corner'` (default `'row'`), which only the compact live page passes as `'corner'`: the readout renders inside the chart slot's wrapper, absolutely positioned top-left at `--small` on `--screen-overlay` with `--space-1` padding, as a button (`aria-expanded`) that toggles the picker slot.
  The picker slot is rendered only while open; opening it is the reader's tap, so FR-WATCH-7 holds.
  The stars page and the pass detail pass nothing and do not change.
- **D-905 — The hidden toggle in the list panel.**
  (FR-TONIGHT-6, FR-LIVE-6.) On compact the hidden-objects toggle renders in the list panel's head, beside its close control; it reads and writes the same saved pref through `useHiddenObjects`.
  On wide it stays where FR-WATCH-4 puts it.
- **D-906 — Delivery shape.**
  (V27-8.) Five tasks in three waves, gate auto, opus except R144 (the page, which crosses the most files and carries the box arithmetic) on fable; §16.26.
- **D-907 — The targets never land before now, and "tonight" from inside reads forward then wraps.**
  (R141; FR-TONIGHT-1, FR-TONIGHT-4, D-897.) The constants are in minutes and speeds as their names say (`TONIGHT_LEAD_MIN = 1`, `AUTO_NEAR_MIN = 5`, `AUTO_SPEED_NEAR = 60`, `AUTO_SPEED_GAP = 600`); `lib/playback.ts` and `lib/tonightJump.ts` read them through a scoped `eslint.config.js` entry, as `arcReveal.ts` does: the two files may import `physics/constants` and nothing else of physics but types *(R141's review: an inline disable had switched off the app-wide bans on that line too)*.
  `openingJump` and `tonightTarget` land on `max(now, start − TONIGHT_LEAD_MIN)`, so a rise less than a minute away lands on now, not on an instant the span has passed; `nextTarget` does not clamp, its `t` being at or after now.
  A pass is tonight's when its start is in `[max(night.from, now), night.to)`; from inside tonight the target is the first such start at or after `t` (the pass the reader landed before is not skipped), and when none is left after `t`, tonight's first.
  No night in the bands (loading, a polar summer) is `null` from `tonightTarget` and `Infinity` from `nightEnd`, so the span's end stops playback.
  The night is `nightRuns(bands)`, consecutive non-`day` bands merged, shared by both.
  *(R141's review)* Both read it through one lookup, `nightAt(bands, t, endIncluded)`; `nightEnd` counts a night's last instant as that night's, so from the stop `play` is the no-op D-908 asks for and not a run through the day to the next night.
  `tonightTarget` takes the span as a fifth argument: a pass rising past the span's end is not tonight's, and the night's start is held at the span's end at most (the bands run an hour past it, D-170). "A pass is up" is one predicate, `passUp` (`start ≤ t ≤ end`), for `openingJump` and `autoSpeed` alike.
- **D-908 — `usePlayback`'s `end` is a rule, and the page's writes are flagged by an argument.**
  (R141; FR-TONIGHT-1, FR-TONIGHT-5, D-898, D-899.) `end?: (from) => EpochMs` is asked when `play` starts and on every scrub or step (so a move while playing runs to its own night's end); playback stops at `min(span.end, end(from))`, and `play` at that stop is a no-op as at the span's end.
  With `speed: 'auto'` the frame is `advanceAuto(t, wall, passes, stop)`: the rate is read at the frame's start, and a gap frame that would cross the nearest `rise − AUTO_NEAR_MIN` is split there, the rest at 60×; a frame is split only at slow-down boundaries (D-899), so a frame that also outruns a pass's end finishes at 60× and the next frame speeds up.
  The returned `speed` is the rate the last frame ran at (the strip's sixth field, D-172), and the `passes` and `end` options are read through refs, so they never restart the loop.
  D-898's `setT` is `stepTo`/`scrub`; every writer (`scrub`, `stepTo`, `play`, `pause`, `toNow`, `setSpeed`) sets `readerWrote` unless its last argument is `'page'`, which the jump passes; the frame loop never sets it.
  *(R141's review)* A new `end` rule is asked again for the instant playing started from, so a `play('page')` before the bands load stops at the night's end once they arrive (a stop that lands behind the instant stops it where it is).
  Paused, the returned `speed` in `'auto'` is `autoSpeed(t)`, so a scrub, `now` and the stop read out the rate at the shown instant.
  A new fixed `speed` option, or a switch from `'auto'` to one, becomes the chosen speed; the chosen speed reaches the frame loop through a ref, so `setSpeed` never restarts it.
  The frame reads its rate from `autoRates(passes)`, which keeps the last `rateSpan` (the rate and the next instant it may change: a slow-down boundary or a set) and scans the passes again only once `t` crosses it.
- **D-909 — A tick tap lands on the pass's lead instant inside the span, and a tap's jitter is not a drag.**
  (FR-TONIGHT-3, R142.) `TimeTrack`'s `onSeek(t, { lead })` always carries the instant to show, inside the span: with `lead: false` the instant itself (a press off the ticks, a drag, a key), with `lead: true` a tapped pass's lead instant, `clampToSpan(start − leadMs, span)` (`leadInstant`); the page passes `TONIGHT_LEAD_MIN` in ms as the `leadMs` prop and pauses.
  The track does not import the constant (it lands in `physics/constants.ts` with R141, in the same wave), and it clamps rather than the page because only the track sees the span it draws: a pass already up at `now`, or one starting within the lead of it, lands on `now` instead of before the span (`aria-valuenow` under `aria-valuemin`, the thumb pinned at 0).
  A press inside a tick's zone holds its pass until the pointer has moved `TAP_SLOP_PX` (6 px) from where it landed; past that it is a drag and every move sets `t` from x as D-900 says.
  Without the slop a finger's tap on a phone, which always moves a pixel or two, would replace the lead instant with the instant under the finger on the first `pointermove`.
  One pointer drives the track: the press records its `pointerId` and the bar's left edge (read once, so a move reads no layout), other fingers' presses, moves and releases are ignored, and the drag ends on `pointerup`, `pointercancel` or `lostpointercapture`.
  The keys are `StripeOverview`'s through `lib/timeStripe.spanKeyStep` (15 min, Page Up/Down 1 h; the overview passes its chunk), plus Home and End to the span's two ends, as the ARIA slider pattern has them.
- **D-910 — The track's fills and its label row.**
  (FR-TONIGHT-3, R142.) Day is `--bg-raised`, bright twilight `color-mix(in srgb, var(--bg-raised), var(--bg))` (halfway, no new token), dark `--bg`, the deepest the sheet has, in both themes; the ticks take `--chart-series-1..6` by `passSegments`' series, the thumb `--accent`, 3 px wide and kept inside the bar at the ends.
  The sheet's hairline frame is a `--rule` rect stroked inside the SVG, not a CSS border on it: a border shrinks the content box under the viewBox, and the default `meet` scaling then letterboxes the drawing, so the pointer, the ticks and the label row would each use a different x.
  With no border and `preserveAspectRatio="none"` the bar's box, its viewBox and the label row are one frame.
  The label row is HTML at `--small` in `--fg-dim`: `now` and `+24 h` in the flow at the two ends, the hours placed by `left` in % of the span (a computed inline style, which D-701 admits); an hour whose box would come within a cell of an end word is dropped, so at 390 px with a 06:30 start the row is `now 12 15 18 21 00 +24 h`.
- **D-911 — The chip's rules.**
  (R143; FR-TONIGHT-7.) `chipFor(t, now, realTime, night, timeZone)` takes `usePlayback`'s `realTime` flag rather than reading `t === now`: a held instant that lands on the clock is still held, and the page's clocks need not share a tick.
  `night` is `tonightBand(bands, now)`, which the page works out once per tick and hands to the chip and the context line, so nothing sorts the bands on every frame of playback; this widens D-903's `chipFor(t, now, bands, timeZone)`.
  The offset is `heldOffset`'s hours and minutes, its side the sign of `t − now` itself: under half a minute it reads `in <1 min` / `<1 min ago` (`en <1 min` / `hace <1 min`), never `in 0 min` and never a rounded `−0` read as ahead.
  Both catalogs and the held readout write the size through one locale-neutral `offsetSpan` in `lib/playback.ts` (the readout keeps `+0 min`).
  `ShownTime` takes a `clock` prop, the page's 1 s clock, for `HH:MM:SS` on real time, so the seconds tick each second and not in `realNow`'s 10 s steps; R144 wires it.
  The chip's `weekday` is a boolean (the component spells it with `shortWeekday`, `lib` having no language).
  `tonight` names the night already, so a `t` past midnight inside tonight's band carries `tonight` and not the weekday too — with both, the Spanish headline ran past 36 cells.
  The band is `tonightBand(bands, now)` in `lib/shownTime.ts`: the run of non-`day` bands at or after `now`, the one under way when `now` is in it — the same reading as D-897's `tonightTarget`, which may import it.
  The chip is at `--small` beside the time at `--text-heading`: at the body size `esta noche · en 23 h 59 min` took the headline to 35 cells, past the 33 that 360 px holds; at `--small` it is 31.
  `shownTimeText` gives the headline as one string for the track's value text (D-900).
  A `behind` chip only lives until the next tick, the held instant being clamped to the span, whose start is real time.
  The play control on the taps row is the catalog's `playShort` / `pauseShort` (`▶`, `‖`), one glyph and one cell as D-901 says, and not `❚❚`, which is two: with it the Spanish row while playing was 34 cells, one past the 33 that 360 px holds on the widest font.
  So the row is 30 cells in English and 33 in Spanish, playing or not, with the spec's words (`[ noche ]`, `[ próximo ]`, `[ ahora ]`); FR-TONIGHT-4's `❚❚` reads `‖`, and `controlRows.test.ts` exempts no row.
- **D-912 — The context line's edges.**
  (R143; FR-TONIGHT-7, FR-TONIGHT-4, FR-TONIGHT-1.) `contextLine` takes the visible passes, `t`, the span, tonight's band (`night`, D-911), the sky and the cloud state.
  An up pass is the one at `t` that rose first; past its peak, its end is worded by its `endReason` ("sets", "into shadow", "fades").
  Passes that ended before `t` are left out. "No visible pass tonight" is the line whenever `t` is inside tonight's band and no visible pass is left in it, which is where FR-TONIGHT-4's `tonight` tap lands on such a night, so the line needs no flag from the tap; otherwise "No visible pass in 24 h" when no visible pass touches the span or none is left after `t` (a `t` past the span's last pass), so the sky form always has a next time.
  The next rise carries no weekday: the span is 24 h, so the next 02:30 in it is the only one.
  A pass's name is the part that gives way — the catalog's names run to 23 characters, and the fixed part of the longest form (` · into shadow SSW 12:05`) is 24 — so the name ellipsises and the rest always shows; the separator between them is its own catalog string (`context.separator`), so `up` words only what the pass does and a language may order its own words.
  The Spanish line's unknown cloud is `S/d`, said "sin datos", as the conditions line does (FR-COMP-7).
  `ContextLine` lives beside `ShownTime` in `ShownTime.tsx`.
- **D-913 — The compact box is the room the rows leave, measured in the commit that changes a row.**
  (R144; FR-TONIGHT-9, FR-COMP-5, FR-LIVE-1.) A `fill` column (`SkyViewLayout`, the compact live page) writes `--sky-drawing-room`: the layout's height less every other slot's height and top margin; the stylesheet caps the drawing slot, and the bowl's cut on the frame's box, at it.
  A resize observer re-measures as a row resizes, but it answers a frame late, which was a frame of page scroll when the list opened and, in a test that reads at once, the open list's room kept after it closed.
  So the measuring layout effect also runs on the commits that change a row: a slot coming or going, the picker's tap, `targets` (a slot the chart portals into is filled in the commit after it registers, the opened picker) and a new `roomKey` prop, which the live page sets from `legendOpen`.
  To hold 280 px at 390 × 667 the taps row and the compact actions row are one text row each: their 48 px hit boxes are padding and a matching negative margin (D-246's `inline-control`), and the compact page's padding under its rows is the half row those boxes overhang, so the last row's target is never a scrollbar.
- **D-914 — The corner readout's tap and a pick are the drawing slot's handler.**
  (R144; FR-TONIGHT-6, D-904.) The chart portals its readout into the corner and its facing row into the picker slot, and React bubbles a portal's events through the tree that rendered it (the chart, inside the drawing slot), not the DOM: a tap on the readout's text never reached the button's `onClick`, so the picker did not open in a browser while jsdom, clicking the button itself, passed.
  The drawing slot is the element both paths pass, so in the corner form it carries one `onClick` read off the DOM target: inside the corner (`[data-slot="readout"][data-readout="corner"]`) toggles, a pick closes.
  A pick is one of the row's options (a button in its `group`, a radio, an option), not any control: `[ hold up to the sky ]` beside the points opens the screen and leaves the row open, so its focus can come back to it (FR-FSC-2).
  The picker slot keeps its own handler for a part a page puts there itself.
  A button holds phrasing content only and the readout is a paragraph in a slot's `div`, so the corner is a block holding the words (`aria-hidden`) and an empty button laid over them at the corner's size, named by them (`aria-labelledby`); the test id `sky-readout-toggle` is the button's and its box the corner's.
  The open state is the page's where the layout does not outlive the screen (R144 review): the live page unmounts the layout while the sky screen is up, so `SkyViewLayout` takes `pickerOpen` and `onPickerOpen` and `Live.tsx` holds the state; closing the screen brings the row back open and the focus lands on `[ hold up to the sky ]`, not on the view option.
  Without the props the layout holds its own.
- **D-915 — The compact page as measured, and the old specs that shot its rows.**
  (R144; FR-TONIGHT-1, FR-TONIGHT-9, FR-TONIGHT-6.) With the list closed the box is 293 px at 390 × 667 in English and in Spanish (floor 280, V25-18) and 337 px at 390 × 844 in both (2.6.1's watching box, the bowl's cut at 390 px; `live-compact.spec.ts` holds it to `compactBowlBoxPx(390) − 1` and to the cut at most), the same in both states.
  On the noon clock of `live-tonight.spec.ts` (2026-09-11T15:51:00Z, 12:51 at Neuquén) the first visible rise is 2026-09-12T07:20:24Z and the page lands at 07:19:24Z, playing; the headline reads `07:19` because the seeded observer has no time zone and the page writes UTC.
  The jump also lands on every spec that opens a stored run by day on a phone, playing on real frames, so a spec that compares two loads or a turn holds the instant first: `dome-resize.spec.ts` taps `[ now ]` after the jump, `sky-layout.spec.ts`'s turn pauses where it landed and asserts the instant exact and the play state kept.
  `r77-captures.spec.ts` shot the compact rows R144 removes (the state word, `[ scrub ]`, the step row) and now shoots the wide page alone; the compact record is `r144-captures.spec.ts`.
  On the landscape phone, where the layout is the rail's scroll box, `shapes.spec.ts` clips the rail's rows to it as it clips the wide list to its slot.
  From the review: the page's 1 s clock is one provider (`SecondClock` in `Live.tsx`, whose tick re-renders its readers and not the page), read by the headline, by the track's value text and by `▶` from real time, which starts at the second on screen through `usePlayback`'s `realFrom` (the tick, `realNow`, without it), so the instant never steps back to the last 10 s tick; `[ tonight ]` is disabled while `tonightTarget` has nowhere to land (no night in the bands: not loaded, or a polar summer), as `next` and `now` are; the jump reads reduced motion through `useMediaQuery(REDUCED_MOTION)`, the mark's query, now exported from `useMediaQuery.ts`; and `StateIndicator` takes `word={false}` for the compact top row's mark alone.
  The compact overview's end labels (`overview-labels`, `.overviewLabels`, `live.overviewStart` / `overviewEnd`) had no wide reader and went (FR-TONIGHT-8).
- **D-916 — The tonight parts are the `live` chunk's, and stay there.**
  (R145; FR-TONIGHT-10 as amended v2.7, V27-9; D-178.) FR-TONIGHT-10 put the track, the jump, the taps and the speed rule in `main`, but only the lazy `Live.tsx` imports `TimeTrack`, `TimeTaps`, `ShownTime` and `tonightJump.ts`, so Rollup puts them in `Live-*.js`: on the 2.7.0 build `main` is 179.3 KB (+1,737 bytes over `3363de2`, inside `TONIGHT_MAIN_KB`: the catalog's strings, `usePlayback`'s automatic rate, the corner readout) and `live` 13.3 (+3,681).
  R145 does not move them: an eager import would take `main` to about 183 KB, past the 180 ceiling, for code no other page runs, and the task is no behaviour change.
  The review read the `live` row against "no other row grows"; the owner settled it in the spec (V27-9), which amends FR-TONIGHT-10 to name the `live` chunk and its measured growth.
  No budget moves under D-178 (`main` × 1.1 is past its ceiling, `live` × 1.1 is 14.6 under 15).
- **D-917 — The capture set on the v2.7 phone page, and what it shoots.**
  (R145; FR-TONIGHT-10, FR-CAP-5, FR-TONIGHT-8.) `v1-captures.spec.ts` reads the compact clock off the headline's `shown-time`; holds `live-scrubbing` on compact with R144's key on the track and then the reader's `next`, so the picture is off real time (the evening's first pass, one minute before its rise) and asserts that off the track's `aria-valuenow`; `liveHelpers.enterScrubbing` reads the landscape rail (`live-layout`) from the top after its key, as D-864 reads wide's.
  `liveAt` waits for FR-TONIGHT-1's decision — the track's pass ticks attached, drawn from the passes the page decides on — and only then taps `[ now ]` when the jump has moved a capture off its instant (the sky screen's `CHIP_SHOWN`, six minutes before a pass), which is the reader's own way back and keeps the sky screen's files byte-identical; `stayOnNow` lives in memory, so there is nothing to seed.
  A new compact screen, `live-tonight` (360 and 390, every theme and language), is the opening state itself: `#live` at 13:00 local under `prefers-reduced-motion: reduce`, so the jump lands paused (FR-TONIGHT-2) on the evening's first pass with the chip `tonight · in …`.
  The diff is measured against `3363de2` shot by its own spec off its own plain build, and only FR-TONIGHT-10's 40 compact files and the 8 `live-tonight` files are committed (the Mac's shots; `captures.yml` replaces them), every other file left as `main` has it.
  The strings FR-TONIGHT-6 took off compact that no wide row reads go with the code paths that read them and no longer render: `StatusStrip`'s compact line (and its `t`, `timeZone` and `data-compact`), `PlaybackControls`' compact glyphs, `ScrubButton`'s compact label and `BackToLive`'s `short`.
  `live.openFromNow`, `live.landmarkWord` and `passes.fields` were unread in 2.6.1 already; the review's pass removes them too, by FR-FLOW-17's rule.

### 9.9 v2.7 additions *(FR-TONIGHT)*

- **The targets and the speed are pure.**
  `tonightJump.test.ts` covers `openingJump` (a pass up at now, one later, none in the span, a hidden pass), `tonightTarget` (passes tonight, none tonight, `t` inside tonight, a start in the day) and `nextTarget` (the last pass).
  `playback.test.ts` gains `autoSpeed` at the edges (up, 5 min ahead, 5 min + 1 s ahead, a gap) and `nightEnd`; `usePlayback.test.tsx` a frame that crosses the slow-down boundary.
- **The jump is a component test.**
  `Live.test.tsx` with a stored run at noon: lands at the lead instant and plays; reduced motion lands paused; a URL `t`, the reader's move before the passes, and `stayOnNow` each prevent it; a wide render never jumps.
- **The inventory is one list.**
  `liveRows.test.ts` and `Live.test.tsx` assert FR-TONIGHT-6's rows by test id, presence and absence, identical in both states at 390 px.
- **The track.**
  `TimeTrack.test.tsx`: bands, ticks and thumb against a fixed run; a drag, a tick tap (nearest of two close ticks) and the keys set `t`; the slider's ARIA values.
- **Rows fit.**
  `controlRows.test.ts` gains the taps row, the headline with each chip form and the context line's forms, at 360 and 390 px in both languages.
- **The page.**
  `live-states.spec.ts` at 390 × 844 and 844 × 390: the box's height before and after a drag on the track is identical.
  `live-compact.spec.ts`: the box at 390 × 667 ≥ 280 px and at 390 × 844 ≥ 2.6.1's watching box, both languages.
  A new `live-tonight.spec.ts` at 390 × 844 with a paused clock at local noon on the `v1-*` fixture night: the jump, a drag to 03:00, `next`, `now`, in both languages.
  `targets.spec.ts`, `rhythm.spec.ts` and `shapes.spec.ts` keep their compact walks with the new rows.
- **Unchanged is a capture.**
  Every wide capture and every page but the compact live page is re-shot byte-identical to 2.6.1's (FR-CAP-5).

### 16.26 Delivery of the v2.7 tasks *(V27-1..V27-8, D-896..D-906)*

The V1-11 rules are unchanged; the gate is v2.6's (D-854): auto, merged on CI green and a clean review.
Five `R` tasks in three waves of three, one and one, after this plan is on `main`.
No deadline is set.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R141 — The targets and the speed: the constants, `tonightJump.ts`, `autoSpeed`, `nightEnd`, `usePlayback`'s `'auto'` and its reader-wrote ref | `data` (`physics/constants.ts`, `lib/{tonightJump,playback}.ts` and their tests, `components/live/usePlayback.{ts,test.tsx}`) | opus | auto | — |
| 1 | R142 — The time track: `TimeTrack`, `TRACK_HEIGHT_PX`, its strings, its tests | `chart` (`components/live/TimeTrack.{tsx,module.css,test.tsx}`, `lib/layout.ts`'s one constant, `src/i18n/{en,es}/track.ts` (new) and its registration in `src/i18n/{en,es}.ts`) | opus | auto | — |
| 1 | R143 — The words: `ShownTime`, `shownTime.ts`, `contextLine.ts`, the taps' and the chip's strings, `controlRows.test.ts` | `ui` (`components/live/ShownTime.{tsx,module.css,test.tsx}`, `lib/{shownTime,contextLine}.ts` and their tests, `src/i18n/{en,es}/live.ts`, `tests/styles/controlRows.test.ts`) | opus | auto | — |
| 2 | R144 — The page: the jump effect and `stayOnNow`, `TimeTaps`, one compact inventory, the readout in the corner, the hidden toggle in the list panel, the compact rows removed, the specs at the compact sizes | `live`, crossing into `sky` and the state (`screens/{Live.tsx,Live.module.css,Live.test.tsx,liveRows.ts,liveRows.test.ts}`, `components/live/TimeTaps.*`, `components/sky/SkyViewLayout.*`, the list panel, `state/slices/ui.ts`, `tests/e2e/{live-compact,live-states,live-tonight,targets,rhythm,shapes}.spec.ts`) | fable | auto | R141, R142, R143 |
| 3 | R145 — The capture set and 2.7.0: the compact live captures, the diff against 2.6.1, the strings no reader uses, the budget row, `package.json` 2.7.0, `docs/RELEASE.md` §20, no tag | `docs` (`tests/e2e/{captureSet.ts,v1-captures.spec.ts}`, `docs/screenshots/v1-*`, `src/i18n/**` removals, `scripts/bundle-budget.ts`, `package.json`, `package-lock.json`, `docs/RELEASE.md`, `README.md`) | opus | auto | R144 |

No two wave-1 tasks name the same file: R142 owns the new `track.ts` and the two registration files, R143 owns `live.ts`; R141 holds `usePlayback`.
R144 is the only task that edits `Live.tsx`, and it is alone in its wave because it wires the other three.

**Sessions** (D-854): every row carries `Review: opus`, `Turns: 500`, `Fallback: off`; `Model:` is `fable` for R144 and `opus` for the rest.

**The schedule** (from the plan's merge; a stop waits for its reset): wave 1 about 2 h, wave 2 about 3 h, wave 3 about 1 h.
Unstopped, about 6 h; with one five-hour stop and one CI rerun per task about 10–12 h.
The critical path is R141 → R144 → R145.

**Owner gates:** none (D-906).
The owner merges this plan, starts `--wave` after each wave merges, and resumes after a stop.
At R145 the owner opens the live sky on a phone in the afternoon, sees tonight's first pass play, drags to the small hours, taps `next` and `now`.
The tag `v2.7.0` on R145's merge SHA and the fast-forward of `release` are the owner's.

**Decision block** (§16.2): **R141 takes D-907..D-908, R142 D-909..D-910, R143 D-911..D-912, R144 D-913..D-915, R145 D-916..D-917.**
D-896..D-906 are this plan's.

**What `Done` must say.**
R141: the rate at each edge and the frame-split test.
R142: the track at 360 and 390 px in both themes, and its slider values.
R143: every chip and context form in both languages with its cell count.
R144: the box at 390 × 667 and 390 × 844 in both languages against the floors, the inventory test, and the jump on a noon clock.
R145: the changed capture files against FR-TONIGHT-10's named moves, the `main` row against 2.6.1, and every removed key by name.

What every session reads (D-284's rule): SPEC §4.49 whole (FR-TONIGHT-1..10), US-42, §9 Phase 2p, §12 V27-1..V27-8; PLAN §2.43, §9.9 and this section; and SPEC §4.30 (FR-WATCH-1..9) for what the compact page stops rendering.
Each task's `Reads:` adds its own files.
