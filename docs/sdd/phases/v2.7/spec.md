# v2.7 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.14 Goals (v2.7, "tonight on the phone")

- **G46. Something moving on open.**
  Opened in the day, the phone's live sky shows tonight's next pass crossing it, not an empty sky.
- **G47. Time under the thumb.**
  Moving the shown time is one drag or one tap on the phone: the whole day and night are in sight, and tonight, the next pass and now are a tap each.
- **G48. Only what matters.**
  The phone's live page shows the shown time, one line of context, the drawing and the time controls; everything else is one tap away or gone.

**US-42 — See tonight from the afternoon** *(v2.7)*
As a phone reader in the day, I open the live sky and see tonight's next pass crossing it, and I can drag or tap to any time of tonight without reading a row of controls.
- AC1: With nothing visible up now and a visible pass in the next 24 h, `#live` with no `t` opens at that pass's rise minus `TONIGHT_LEAD_MIN` and plays; with reduced motion it lands there paused (FR-TONIGHT-1, FR-TONIGHT-2).
- AC2: The headline says the shown time and how far it is from now ("21:47 · in 6 h 12 min"), and `now` brings it back to real time for the rest of the visit (FR-TONIGHT-4, FR-TONIGHT-7).
- AC3: One drag on the time track moves the shown time across the 24 h span with the drawing following; a tap on a pass tick lands one minute before that rise (FR-TONIGHT-3).
- AC4: Playing runs at 60× while a pass is up or near and at 600× between passes, and stops at the end of the night (FR-TONIGHT-5).
- AC5: At 390 × 844 the page renders exactly FR-TONIGHT-6's rows, the same in both states, and the box keeps its height when the shown time leaves now (FR-TONIGHT-6, FR-TONIGHT-9).
- AC6: Wide is unchanged: its captures do not move (FR-TONIGHT-10).

### 4.49 Tonight on the phone *(v2.7)*

The owner's reading of 2.6.1's live page on a phone (2026-10-29): opened in the afternoon, it shows real time, so the sky is empty, the count says `0 up`, and the way to tonight is `[ scrub ]`, a thin stripe and a row of step buttons.
The page answers "what is up now" and the reader in the day asks "what will I see tonight".
This section turns the compact live page toward that question and strips it to what the reader needs to answer it.
It applies to the compact mode in both shapes (FR-SHP-1) and to the live page only; wide, the stars page, the pass detail and the sky screen are unchanged (V27-1).

Constants (FR-VIS-6 style, centralised with the others):

| Constant | Default | Rationale |
|---|---|---|
| `TONIGHT_LEAD_MIN` | 1 min | Lands just before the rise so the reader sees the dot appear, not one already halfway across. |
| `AUTO_SPEED_NEAR` | 60× | A 5-minute pass crosses in about 5 s: slow enough to follow with the eye (FR-LIVE-5's 60×). |
| `AUTO_SPEED_GAP` | 600× | An hour between passes passes in 6 s, so playback never sits on an empty sky. |
| `AUTO_NEAR_MIN` | 5 min | Playback slows to `AUTO_SPEED_NEAR` this long (shown time) before a visible rise, so no pass starts at 600×. |
| `TRACK_HEIGHT_PX` | 48 px | One thumb: over FR-FLOW-11's 44 px with room for the three bands and the pass ticks. |
| `TONIGHT_MAIN_KB` | 2.0 KB gzipped | The track, the jump and the speed rule are `main`'s; 2.6.1's `main` is about 177.5 KB under the 180 KB ceiling (V26-14), and the removed rows give some back. |

- **FR-TONIGHT-1** *(V27-2)* **The jump.**
  On compact, when `#live` opens with no `t` in its URL (the header's `[ live ]`, the Both door, a bare link), the page waits for the stored run's passes (FR-OFF-8) and then decides once: if a visible pass is up at now (`start ≤ now ≤ end`), it stays on real time; otherwise, if a visible pass rises within FR-LIVE-2's 24 h span, `t` is set to that pass's `start − TONIGHT_LEAD_MIN` and the page plays (FR-TONIGHT-5); with no visible pass in the span it stays on real time and the context line says "No visible pass in 24 h" / "Ningún pase visible en 24 h". "Nothing up" covers the day, the twilight and a quiet dark hour alike (V27-2).
  The decision is taken once per visit: a reader who has moved `t`, tapped any time control or tapped `now` before the passes arrive is never jumped (V26-16's rule for the window), and after `now` the page stays on real time until the app is reloaded (FR-TONIGHT-4).
  A `#live` URL that carries `t` opens exactly that instant as today (FR-LIVE-9, FR-VISIT-3) and never jumps.
  While playing, the hash is not written (D-171); a pause writes it.
  *Verification:* component tests on the jump's decision with a pass up now, one later in the span, none in the span, the reader moving first, `now` tapped, and a `t` in the URL; an e2e at 390 × 844 with a paused clock at noon that opens `#live` and finds `t` one minute before the first visible rise.
  *(amended v2.8, V28-8; before: with nothing up the page set `t` and played on its own)* With nothing visible up now, the page no longer jumps: it asks with FR-FULL-10's card, and `[ see next pass ]` does what this requirement's jump did.
  The decision's cases, the 24 h span, the `t`-in-the-URL rule and the hash while playing are unchanged.

- **FR-TONIGHT-2** *(V27-2)* **Reduced motion.**
  With `prefers-reduced-motion: reduce` the jump of FR-TONIGHT-1 still sets `t`, and the page lands paused; nothing plays until the reader taps the play control.
  FR-MARK-5's still bead is unchanged.
  *Verification:* the jump's component test under an emulated reduced-motion query.
  *(amended v2.8, V28-8)* The jump is now `[ see next pass ]` (FR-FULL-10); under reduced motion it still lands paused.

- **FR-TONIGHT-3** *(V27-3)* **The time track.**
  On compact the live page has one timeline, the **time track**, always rendered, in both states, under the drawing (FR-TONIGHT-6's order).
  It is the full content width and `TRACK_HEIGHT_PX` tall and spans FR-LIVE-4's `now` to `now + 24 h`.
  It draws: the three `SkyState` bands from the sun altitude (D-170's samples) as fills, day in `--bg-raised`, bright twilight in a mid tone, dark in the deepest, so tonight reads as one block at a glance; each visible pass as a tick in its arc's colour (FR-LIVE-2), at least 3 px wide however short the pass; and a thumb at `t`, a full-height bar in the accent.
  Under it one text row of labels at `--small`: `now` at the left, the local hour at every third hour, `+24 h` at the right.
  A drag anywhere on the track moves `t` under the finger, the drawing following each frame (D-81's loop); a tap on a pass tick (hit area at least 44 px wide, centred on the tick, nearest tick wins) sets `t` to that pass's `start − TONIGHT_LEAD_MIN`; a tap elsewhere sets `t` there.
  Any of them pauses playback.
  The track is a `slider` to assistive technology (`aria-valuetext` the shown time and its chip), the arrow keys step 15 minutes and Page Up/Down one hour (FR-SPAN-2's keys).
  It replaces, on compact, the 24 h overview, the three-row stripe and the step row (FR-SPAN-2, FR-LIVE-4, FR-TRAJ-4, FR-TRAJ-5), which stay on wide.
  *Verification:* a component test of the bands, the ticks and the thumb against a fixed run; drag, tick-tap and key tests that assert `t`; the e2e of FR-TONIGHT-9.

- **FR-TONIGHT-4** *(V27-3)* **Three taps.**
  Under the track, one row: the play control, then `[ tonight ]`, `[ next ]` and `[ now ]` (`[ noche ]`, `[ próximo ]`, `[ ahora ]`), within FR-COMP-4's 36 cells in both languages (English `▶ [ tonight ] [ next ] [ now ]`, 30 cells; the play control is one glyph, `▶` or `‖`, padded to 44 × 44 px).
  *(amended v2.8, V28-8; before: `now` also marked the visit so the page did not jump again before a reload)* With FR-FULL-10's card asked on every visit there is no jump to suppress: `now` returns `t` to real time and stops playback, and marks nothing.
  - `tonight` sets `t` to `start − TONIGHT_LEAD_MIN` of the first visible pass in tonight's night (the night band at or after now: from the end of the day band to the start of the next one) and plays; with no visible pass tonight it sets `t` to the night band's start, paused, and the context line says "No visible pass tonight" / "Ningún pase visible esta noche".
    While `t` is already inside tonight it goes to the first visible pass at or after `t`.
  - `next` sets `t` to `start − TONIGHT_LEAD_MIN` of the first visible pass whose start is after `t + TONIGHT_LEAD_MIN`, keeping the play state; at the last pass of the span it is disabled.
  - `now` returns `t` to real time (FR-LIVE-5's `now` action, FR-WATCH-1's `[ back to live ]`), stops playback, and marks the visit so FR-TONIGHT-1 does not jump again before a reload.
    It is disabled while `t` is real time.
  *Verification:* a component test per control on a run with passes tonight, none tonight, `t` inside tonight, the last pass; the cell count in `tests/styles/controlRows.test.ts`.

- **FR-TONIGHT-5** *(V27-4)* **The automatic speed.**
  On compact playback has no speed choice.
  While playing, the rate is `AUTO_SPEED_NEAR` when a visible pass is up at `t` or a visible rise is within `AUTO_NEAR_MIN` after `t`, and `AUTO_SPEED_GAP` otherwise; the switch happens at the frame it becomes true, so no rise is crossed at the gap speed.
  Playing stops, paused, at the end of the night band that holds `t` when it started (a start in the day runs to the end of the next night) or at the span's end, whichever is first.
  FR-LIVE-5's measured rate (D-172) and its 30 updates per second hold at both speeds.
  Wide keeps the four speeds.
  *Verification:* a unit test of the rate function at the edges (a pass up, a rise 5 min ahead and 5 min plus one second ahead, a gap); a component test that playback stops at the night's end.

- **FR-TONIGHT-6** *(V27-6)* **One page, only what matters.**
  On compact the live page renders one inventory in both states, so nothing appears or disappears when `t` leaves real time and the box never changes height because of it (FR-WATCH-7, tightened).
  Top to bottom: *(amended v2.8, V28-2..V28-4; before: the nine slots stood in one column, the drawing fifth)* On compact the live page's slots stand over the box or in the sheet of FR-FULL-4: the top row and the headline become FR-FULL-2's head over the box; the context line, the facing readout and picker, the track, the taps, the view row and the actions move into the sheet; the hint stands over the box (FR-FULL-3).
  The inventory is still one for both states.
  *(amended v2.9, V29-8)* `[ list (n) ]` is gone from compact: the list stands open at the sheet's end under "Satellites (n)" (FR-GYRO-10).
  *(amended v2.10, V210-3)* Item 5's corner readout returns on the compact live page while following is off (FR-PHONE-4).
  1. The top row of FR-FLOW-3: `[ ← ]`, `live`, the place.
     The state word `live` / `held` leaves it (the chip says it, FR-TONIGHT-7); the mark stays.
  2. The headline: the shown time and its chip (FR-TONIGHT-7).
  3. The context line (FR-TONIGHT-7).
  4. The view row (FR-FLOW-4).
  5. The drawing, with the facing readout drawn in the box's top-left corner at `--small` on `--screen-overlay` rather than as its own row; a tap on the readout opens the facing picker as a row under the drawing and a second tap or a pick closes it (FR-FLOW-4's order otherwise).
  6. The hint of FR-FLOW-6, until the first drag, pinch or tap.
  7. The time track and its label row (FR-TONIGHT-3).
  8. The three taps (FR-TONIGHT-4).
  9. The actions row: `[ list (n) ] Share`.
     The hidden-objects toggle (FR-LIVE-6) moves into the list panel's head, its saved state unchanged.

  Gone from the compact live page: `[ scrub ]`, `[ back to live ]`, the 24 h overview, the stripe, the step row, the speed row, the next-event block (the context line carries its pass), the clock in the conditions line, and the Moon line (already in the list panel, FR-WATCH-3).
  The landscape phone lays out the same slots in its rail (FR-FLOW-15), the drawing on the left at its full height.
  *Verification:* the per-state component test of FR-WATCH-9 rewritten to this inventory, presence and absence by test id, identical in both states; `live-states.spec.ts` at 390 × 844 and 844 × 390 asserts `chart-box`'s height identical before and after a drag on the track.

- **FR-TONIGHT-7** *(V27-5)* **The headline and the context line.**
  The headline is the shown time at the headline size, `HH:MM` in the observer's zone (seconds only while `t` is real time), followed by a **chip**: `now` in the accent while `t` is real time; otherwise the offset from real time, "in 6 h 12 min" / "en 6 h 12 min" ahead and "12 min ago" / "hace 12 min" behind, with "tonight" / "esta noche" before it when `t` is inside tonight's night band and the weekday when `t` is not today (FR-WATCH-2's rule).
  The context line is one line at `--small`, at most 36 cells in both languages: while a visible pass is up at `t`, its name and what it does next ("Tiangong · peaks SE 0:40"); otherwise the sky state and the cloud word and the next visible pass's time ("Dark · Clear · next 21:47"); or the no-pass sentences of FR-TONIGHT-1 and FR-TONIGHT-4.
  The count `n up` leaves the line (the `[ list (n) ]` action carries it).
  *Verification:* the strings' snapshot in both languages, cell counts in `controlRows.test.ts`; a component test per case.

- **FR-TONIGHT-8** *(V27-7)* **Strings.**
  Every new string is in the catalog in English and Spanish (FR-I18N-*): the three taps, the chip's words, the context line's forms, the two no-pass sentences, the track's accessible name and value text.
  The strings FR-TONIGHT-6 removes from compact and that no wide row still reads are removed (FR-FLOW-17's rule).
  *Verification:* the catalog parity test; `npm run check:dead`.

- **FR-TONIGHT-9** *(V27-6)* **It fits.**
  At 390 × 667 in both languages with the list closed, the box is at least V25-18's 280 px; at 390 × 844 it is at least as tall as 2.6.1's watching box.
  Every new control meets FR-FLOW-11's 44 px, and every gap is one of FR-FLOW-10's three.
  The page does not scroll at any compact size of FR-SHP-4's matrix (FR-LIVE-1).
  *Verification:* `live-compact.spec.ts` (the two heights), `targets.spec.ts`, `rhythm.spec.ts` and `shapes.spec.ts` at the compact sizes; an e2e at 390 × 844 that opens `#live` at noon on a fixture night, finds the jump, drags the track to 03:00, taps `next`, taps `now`, in both languages.
  *(amended v2.8, V28-2; before: the box at least 280 px at 390 × 667 with the list closed and at least 2.6.1's watching box at 390 × 844)* On compact the box is the viewport inside the safe area (FR-FULL-1), so the floors are met at every size; the e2e opens the sheet before it drags the track (FR-FULL-7).

- **FR-TONIGHT-10** *(V27-7)* **Chunk and captures.**
  The track, the jump, the taps and the speed rule are the lazily-loaded `live` chunk's, which grows by what they measure (3,681 bytes gzipped over 2.6.1, 13.3 KB under its 15 KB budget), and `main` stays within `TONIGHT_MAIN_KB` over 2.6.1's measure and under the 180 KB ceiling (V26-14); no other row grows.
  *(amended v2.7, V27-9; before: the four parts were the `main` chunk's, and no row but `main` grew.)* The phase's named moves are the compact live captures (portrait and landscape, every view); no wide capture and no other page moves (FR-CAP-5).
  *Verification:* `npm run bundle:budget`; FR-CAP-5's diff against 2.6.1.

### Phase 2p — v2.7 ("tonight on the phone", as decided 2026-10-29, V27-1)

After v2.6.1 is on `main` (`3363de2`).
Compact only, both shapes (FR-SHP-1); wide unchanged (V27-1).
The owner's ask: the phone's live page should be more visual and easier to use, start with something moving, and let a reader in the day see what tonight will bring by moving the time; and keep only the important information (V27-5).

- The jump to tonight's next pass on open (FR-TONIGHT-1, FR-TONIGHT-2).
- The time track and its three taps (FR-TONIGHT-3, FR-TONIGHT-4).
- The automatic speed (FR-TONIGHT-5).
- The cleaned page: one inventory, the headline with its chip, the context line (FR-TONIGHT-6, FR-TONIGHT-7).
- Strings, chunk, captures (FR-TONIGHT-8..10).

Definition of done:
- FR-TONIGHT-1..10 met, each by its verification line; US-42's criteria green.
- `live-states.spec.ts`, `rhythm.spec.ts`, `targets.spec.ts` and `shapes.spec.ts` green at the compact sizes in both languages, with the compact inventory of FR-TONIGHT-6.
- FR-CAP-5's diff against 2.6.1 lists only compact live captures; no wide file moves.
- `npm run bundle:budget`: `main` within `TONIGHT_MAIN_KB` over 2.6.1's measure and under the 180 KB ceiling (V26-14); `passes.golden.test.ts` and every golden fixture untouched.
- `package.json` reads 2.7.0.
  The tag and the deploy are the owner's.
