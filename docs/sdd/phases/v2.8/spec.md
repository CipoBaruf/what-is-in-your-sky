# v2.8 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.15 Goals (v2.8, "the full sky")

- **G49. The sky is the page.**
  On the phone the live sky fills the screen; the time is the only thing written over it, and every control is one tap away in a sheet that opens over the sky and closes back to it.

**US-43 — The whole screen is sky** *(v2.8)*
As a phone reader, I open the live sky and the screen is the sky; when I want to move the time, change the view or share, one button opens the controls over it and the same button closes them.
- AC1: At 390 × 844 and 390 × 667, in every view (Polar, Dome, Window) and both languages, `chart-box` covers the viewport inside the safe area: its top, left, right and bottom edges are within 1 px of the viewport's (FR-FULL-1).
- AC2: With the sheet closed, the only things drawn over the box are the head (`[ ← ]`, the shown time and its chip), the `[ controls ]` button and, until the first gesture, the hint; together they cover at most `FULL_OVERLAY_MAX_SHARE` of the box's area (FR-FULL-2, FR-FULL-3).
- AC3: A tap on `[ controls ]` opens the sheet with the context line, the time track, the three taps, the view row, the facing row, the actions and `[ settings ]`; the button, `Esc` or a tap on the sky above the sheet closes it, and focus returns to the button (FR-FULL-4, FR-FULL-5).
- AC4: Opening and closing the sheet, opening the list inside it and moving the time never change `chart-box`'s size (FR-FULL-6).
- AC5: Opened with nothing visible up and no time in the link, the page shows the sky now with a card over it; `[ see next pass ]` lands one minute before the next visible rise and plays, `[ see now ]` stays on real time; with no visible pass in 24 h the card says so and offers `[ see the sky now ]`; with a pass up now or a time in the link there is no card (FR-FULL-10).
- AC6: Wide, the stars page and the pass detail are unchanged: their captures do not move (FR-FULL-9).

### 4.50 The full sky *(v2.8)*

The owner's reading of 2.7.0's live page on an iPhone (Chrome, Berlin, 2026-10-30, mid-afternoon, Window view, Spanish, the list open): the drawing was a band about 100 px tall between the view row and the time track, under three lines of text and over a track, a row of taps, the actions and the list.
FR-TONIGHT-9 promised at least 280 px at 390 × 667 with the list closed; a phone browser's own bars and an open list are enough to break it, and every row v2.7 kept still comes out of the sky's height.
The owner's ask: "the opposite — full view of the sky, and a button to open and see and modify the config; the basic screen must be the full view of the sky." This section makes the compact live page's drawing the whole screen and moves every control into a sheet over it.
It applies to the compact live page in both shapes (FR-SHP-1) and to nothing else: wide, the stars page, the pass detail and the sky screen are unchanged (V28-1). v2.7's track, taps, automatic speed, headline and context line are kept and only move; v2.7's jump on open becomes a question the reader answers (FR-FULL-10).

Constants (FR-VIS-6 style, centralised with the others):

| Constant | Default | Rationale |
|---|---|---|
| `FULL_OVERLAY_MAX_SHARE` | 0.12 | The head row and the button row are about 44 px each; at 390 × 844 that is about 0.1 of the box with the hint, so the sky keeps nearly nine tenths of the screen with the sheet closed. |
| `SHEET_MAX_SHARE` | 0.7 | The open sheet never covers more than seven tenths of the viewport's height, so at least 250 px of sky stays in sight above it at 390 × 844 and the reader sees the drawing follow the track. |
| `SHEET_TAP_SLOP_PX` | 8 px | A press that travels less than this on the sky above the open sheet is a tap and closes it; more is a drag and turns the camera. |
| `SHEET_SIDE_SHARE` | 0.45 | On the landscape phone the sheet is a panel at the right, as wide as FR-FLOW-15's rail (`1 − LANDSCAPE_DRAWING_MIN_SHARE`), so the open page looks like 2.6's landscape page and the closed one is all sky. |
| `FULL_MAIN_KB` | 1.0 KB gzipped *(amended v2.8, V28-9; was 0.5)* | Only the new strings are `main`'s; the sheet and the overlay are the `live` chunk's (V27-9), which has about 1.7 KB left under its 15 KB budget. |

- **FR-FULL-1** *(V28-2)* **The box is the screen.**
  On compact the live page's drawing box (`chart-box`) fills the viewport in every view: from the top edge to the bottom edge and from the left edge to the right edge, inside the safe-area insets (`env(safe-area-inset-*)`), using the dynamic viewport height (`100dvh`) so a phone browser's own bars showing or hiding resize the box and never scroll the page.
  Nothing is laid out above or under it: the top row, the headline, the context line, the view row, the hint, the track, the taps and the actions of FR-TONIGHT-6 stand over the box (FR-FULL-2, FR-FULL-3) or in the sheet (FR-FULL-4).
  Each view fills the box by its own rule: the window draws its field across the box's width (FR-WIN-1's field, unchanged) and shows more sky above and below in a tall box, its horizon where FR-WIN-1's tilt puts it; the dome and the polar chart draw at the largest size that fits the box, centred.
  The page does not scroll at any compact size of FR-SHP-4's matrix (FR-LIVE-1).
  The three states before the page can draw (FR-LIVE-1's no place, loading and failed) are unchanged.
  *Verification:* `live-full.spec.ts` at 390 × 844, 390 × 667 and 360 × 640, every view, both languages: `chart-box`'s edges within 1 px of the viewport's, and no page scroll; a component test that the compact live page renders no row outside the box, the overlay and the sheet.

- **FR-FULL-2** *(V28-3)* **The head over the sky.**
  On the box's top-left, inside the safe area, one row on `--screen-overlay`: `[ ← ]` (FR-FLOW-3's control, Back by §4.37's rule), then the shown time at `--text-heading` and its chip (FR-TONIGHT-7: `now`, "in 6 h 12 min", "tonight · in 6 h 12 min", "12 min ago", the weekday when not today) at `--small`.
  The row is only as wide as its content, at most the box's width less `--space-3` on each side, and one line in both languages; the chip is cut with an ellipsis before the row wraps.
  The page's name, the mark and the place leave the head: the page's `h1` ("live" / "en vivo" with the place) stays in the document, visually hidden, for the outline (F-72) and assistive technology.
  The facing readout leaves the box's corner for the sheet (FR-FULL-4).
  *Verification:* a component test of the head in both states of `t`, both languages; `controlRows.test.ts` fits the head's longest form ("[ ← ] 21:47 tonight · in 13 h 55 min", "… esta noche · en 13 h 55 min") in 36 cells with the time counted at its size; the outline test.

- **FR-FULL-3** *(V28-3)* **One button.**
  On the box's bottom-right, inside the safe area, `[ controls ]` / `[ controles ]` on `--screen-overlay`, a `TextButton` at least 44 × 44 px (FR-FLOW-11), with `aria-expanded` and `aria-controls` naming the sheet.
  Until the reader's first drag, pinch or tap on the sky, FR-FLOW-6's hint stands as one line at `--small` in `--fg-dim` on `--screen-overlay` at the box's bottom-left, on the button's row when both fit in 36 cells and in the row above it otherwise; then it is gone for good (`skyHintSeen`, unchanged).
  Nothing else is drawn over the box while the sheet is closed but FR-FULL-10's card while it stands: no play control, no context line, no count.
  The head, the button and the hint together cover at most `FULL_OVERLAY_MAX_SHARE` of the box's area (the card, which goes on the reader's first pick, is not counted).
  Opening the page never opens the sheet.
  *Verification:* a component test that with the sheet closed the compact live page renders exactly the box, the head, the button and (until `skyHintSeen`) the hint; `live-full.spec.ts` sums the three's bounding boxes against `FULL_OVERLAY_MAX_SHARE` at 390 × 844 and 390 × 667 in both languages; `targets.spec.ts`.
  *(amended v2.10, V210-3, V210-4)* The bottom row holds `[ follow ]` before `[ controls ]` where the sensor is present (FR-PHONE-3); the facing readout stands in the box's top-right corner while following is off (FR-PHONE-4); on touch the hint is two clauses and is drawn whole at 360 and 390 px (FR-PHONE-5).

- **FR-FULL-4** *(V28-4)* **The sheet.**
  `[ controls ]` opens a sheet that rises from the bottom of the box over the sky, the full width of the box, on `--bg` with a hairline top edge, at `--z-sheet`.
  It holds, top to bottom, `--space-3` between groups and `--space-1` inside one (FR-FLOW-10): *(amended v2.9, V29-5, V29-6; before: a side sheet on the landscape phone, a `[ close ]` control, and a tap on the sky closing it)* The sheet is a bottom sheet in both shapes (FR-GYRO-7), its head ends in a `×` and it closes on a swipe down (FR-GYRO-8); a tap on the sky no longer closes it; the `[ follow the phone ]` row follows the view row (FR-GYRO-1).
  *(amended 2026-11-02, the owner's call, PLAN D-1023)* The body's last group, after the page's rows, is the footer's one row (FR-X-2 as amended), on the live page and on the stars page's and the pass detail's sheets (FR-CLEAN-4, FR-CLEAN-5).
  1. The sheet's head: the place in `--fg-dim`, cut with an ellipsis, then `[ settings ]` / `[ ajustes ]` (a link to `#settings`, FR-COMP-1) and `[ close ]` / `[ cerrar ]` at the row's right end.
  2. The context line (FR-TONIGHT-7).
  3. The time track and its label row (FR-TONIGHT-3), then the three taps with the play control (FR-TONIGHT-4).
  4. The view row (FR-FLOW-4: `Polar Dome [Window]  [x] stars`).
  5. The facing row: the readout of FR-FLOW-5, a tap on which opens the facing picker under it as today (FR-TONIGHT-6, item 5); on the dome and the polar chart, which have no picker, the readout alone.
  6. The actions row: `[ list (n) ] [ Share ]`.
     `[ list (n) ]` opens the list panel (FR-WATCH-3, the hidden-objects toggle in its head, FR-TONIGHT-6) under the actions, inside the sheet.

  The sheet is as tall as its content up to `SHEET_MAX_SHARE` of the viewport's height; past that its body scrolls inside it while the head stays, and the page never scrolls.
  It is not modal: the sky above it keeps playing and following the time, a drag there still turns the camera, and a tap there (a press that travels less than `SHEET_TAP_SLOP_PX`) closes the sheet.
  On the landscape phone (FR-FLOW-15) the sheet is a panel at the box's right, `SHEET_SIDE_SHARE` of the viewport's width and its full height, sliding in from the right with the same contents.
  The sheet opens and closes without animation under `prefers-reduced-motion: reduce` and with a slide of at most 200 ms otherwise.
  It writes nothing to the URL or the history: Back from the open sheet leaves the page as Back from the closed one does (§4.37).
  *Verification:* a component test of the sheet's order and contents in both languages and every view; `rhythm.spec.ts` measures the sheet's gaps at 390 × 844; `targets.spec.ts` with the sheet open; `live-full.spec.ts` asserts the sheet's height at or under `SHEET_MAX_SHARE` with the list open on a run of 20 passes, its body scrolling and the page not; at 844 × 390 the side sheet's width and full height.

- **FR-FULL-5** *(V28-4)* **Open and close.**
  The sheet opens on `[ controls ]` and closes on `[ close ]`, on `[ controls ]` (which stays a toggle for assistive technology even while the sheet covers it), on `Esc`, and on a tap on the sky above it.
  Opening moves focus to the sheet's first control and closing returns it to `[ controls ]`; while the sheet is open `Esc` closes it and does not leave the page (FR-LIVE-1's `Esc` acts only with the sheet closed).
  Tapping `[ tonight ]`, `[ next ]` or `[ now ]`, dragging the track and picking a view keep the sheet open, so the reader can do several in a row; `[ Share ]` and `[ settings ]` act as today.
  The sheet's open state and its list's open state survive turning the phone (FR-FLOW-15) and are not saved across visits: every visit opens with the sheet closed.
  *Verification:* component tests for each way to close, the focus moves, `Esc`'s two meanings, and a tap versus a drag on the sky; an e2e at 390 × 844 that opens the sheet, taps `next`, drags the track, picks the dome, closes with `Esc`, and finds focus on `[ controls ]`; a turn test with the sheet and the list open.
  *(amended v2.9, V29-6)* The ways to close are the `×`, a swipe down, `[ controls ]` and `Esc` (FR-GYRO-8); the tap on the sky is withdrawn.

- **FR-FULL-6** *(V28-5)* **Nothing resizes the sky.**
  On the compact live page the box's size follows the viewport only: opening or closing the sheet, opening the list, the picker or the hint going, `t` leaving or returning to now, playback, a pass rising or ending and the 10 s tick never change it (FR-WATCH-7, tightened: on compact the list is no longer a reader's action that resizes the box).
  The sheet covers the sky; it never pushes it.
  *Verification:* `live-states.spec.ts` at 390 × 844 and 844 × 390 asserts `chart-box`'s size identical across closed, open, open with the list, and after a drag on the track.

- **FR-FULL-7** *(V28-6)* **v2.7's time stays.**
  The automatic speed and the headline's chip (FR-TONIGHT-5, FR-TONIGHT-7) are unchanged, and the target and reduced-motion form of FR-TONIGHT-1 and FR-TONIGHT-2 are what FR-FULL-10's `[ see next pass ]` does: the page lands `TONIGHT_LEAD_MIN` before the rise with the sheet closed and plays (paused under reduced motion), and the head's chip says how far that is from now.
  The no-pass sentences of FR-TONIGHT-1 and FR-TONIGHT-4 are the context line's, so they are read in the sheet; with the sheet closed the chip still says `now`.
  The track, the taps and the play control behave as FR-TONIGHT-3 and FR-TONIGHT-4 say, inside the sheet.
  *Verification:* FR-TONIGHT-1's and FR-TONIGHT-9's e2e rewritten for the card and the sheet: open `#live` at noon on a fixture night, find the card and `t` on real time, tap `[ see next pass ]`, find `t` one minute before the first visible rise with the sheet closed, open the sheet, drag the track to 03:00, tap `next`, tap `now`, in both languages.

- **FR-FULL-10** *(V28-8)* **Ask before the jump.**
  On compact, when `#live` opens with no `t` in its URL (the header's `[ live ]`, the Both door, a bare link), the page shows the sky at real time, not playing, and waits for the stored run's passes (FR-OFF-8); when they are known it decides once:
  - a visible pass is up at now (`start ≤ now ≤ end`): no card, the page stays on real time (FR-TONIGHT-1's first case);
  - otherwise a visible pass rises within FR-LIVE-2's 24 h span: a **card** over the sky, centred across the box above `[ controls ]`, on `--screen-overlay` with a hairline edge, says "Nothing visible up now." / "Nada visible ahora." and, at `--small`, the pass's name, its rise time and the chip ("Tiangong · 21:47 · in 4 h 12 min" / "Tiangong · 21:47 · en 4 h 12 min"), over two buttons: `[ see next pass ]` / `[ ver próximo pase ]` and `[ see now ]` / `[ ver ahora ]`.
    `[ see next pass ]` sets `t` to that pass's `start − TONIGHT_LEAD_MIN` and plays (FR-TONIGHT-5), landing paused under `prefers-reduced-motion: reduce` (FR-TONIGHT-2); `[ see now ]` leaves `t` on real time;
  - no visible pass in the span: the card says "No visible pass in the next 24 h." / "Ningún pase visible en las próximas 24 h." over one button, `[ see the sky now ]` / `[ ver el cielo ahora ]`, which leaves `t` on real time.

  The card stays until it is answered: a drag or pinch on the sky turns the camera with the card in place, and opening the sheet leaves it standing.
  It goes on one of its buttons, on `Esc` (taken as `[ see now ]`), or on the reader moving the time in the sheet (a drag or tap on the track, `[ tonight ]`, `[ next ]`, `[ now ]` or the play control), which is an answer in itself; if the reader moves the time before the passes are known, no card appears.
  When the card appears focus moves to its first button and the card is announced politely (`aria-live`); when it goes focus returns to `[ controls ]`.
  It is asked on every visit to `#live` and never saved.
  A `#live` URL that carries `t` opens exactly that instant as today (FR-LIVE-9, FR-VISIT-3) with no card.
  Every line and the button row fit 36 cells in both languages.
  Wide is unchanged (it has no jump, V27-1).
  *Verification:* component tests of the decision for a pass up now, a pass later in the span, none in the span, a `t` in the URL, the passes arriving after the reader moved the time; each way the card goes and the `t` it leaves; reduced motion; focus and the live region; `controlRows.test.ts` for the card's lines and buttons; the e2e of FR-FULL-7.

- **FR-FULL-8** *(V28-7)* **Strings.**
  The card's two sentences, its pass line and its three buttons, `[ controls ]`, `[ close ]` and the sheet's accessible name ("Sky controls" / "Controles del cielo") are in the catalog in English and Spanish (FR-I18N-*), and `[ settings ]` reuses the header's key.
  The strings that only the compact live top row read and that no other row still reads are removed (FR-FLOW-17's rule).
  *Verification:* the catalog parity test; `npm run check:dead`.

- **FR-FULL-9** *(V28-7)* **Chunk and captures.**
  The overlay, the button and the sheet are the lazily-loaded `live` chunk's, within its 15 KB budget; `main` grows by at most `FULL_MAIN_KB` over 2.7.0's measure and stays under the 180 KB ceiling (V26-14); no other row grows.
  The phase's named moves are the compact live captures, portrait and landscape, every view, with the sheet closed, plus new captures with the sheet open and with the sheet and the list open at 390 × 844 and 844 × 390 in both themes and languages; no wide capture and no other page moves (FR-CAP-5).
  *Verification:* `npm run bundle:budget`; FR-CAP-5's diff against 2.7.0.
  *(amended v2.8, V28-9; before: the new parts within `live`'s 15 KB budget and `main` within 0.5 KB over 2.7.0)* The release measured `live` 15.3 KB (+2,062 bytes over 2.7.0) and `main` 180.0 KB (+803 bytes, `SkyViewLayout`'s `full` form, which the stars page and the pass detail share, and the new strings); the owner accepted the measure: `live`'s budget is re-set to 20 by D-178, `FULL_MAIN_KB` is 1.0 KB, and `main` stays at its 180 KB ceiling.

### Phase 2q — v2.8 ("the full sky", as decided 2026-10-30, V28-1)

After v2.7.0 is on `main` (`b664585`).
The compact live page only, both shapes (FR-SHP-1); wide, the stars page, the pass detail and the sky screen unchanged (V28-1).
The owner's ask: on the phone the basic screen is the full view of the sky, with a button that opens the controls; and the reader is asked whether to see the next pass or the sky now instead of being jumped (V28-8).

- The box is the screen (FR-FULL-1).
- The head and the one button over the sky (FR-FULL-2, FR-FULL-3).
- The sheet, opening and closing it, and nothing resizing the sky (FR-FULL-4..6).
- v2.7's time inside the sheet (FR-FULL-7).
- The card that asks next pass or now (FR-FULL-10).
- Strings, chunk, captures (FR-FULL-8, FR-FULL-9).

Definition of done:
- FR-FULL-1..10 met, each by its verification line; US-43's criteria green; US-42's criteria green with AC1 read through FR-FULL-10 (the landing follows `[ see next pass ]`) and AC5 through FR-TONIGHT-6 and FR-TONIGHT-9 as amended.
- `live-full.spec.ts`, `live-states.spec.ts`, `rhythm.spec.ts`, `targets.spec.ts` and `shapes.spec.ts` green at the compact sizes in both languages, with the sheet closed and open.
- FR-CAP-5's diff against 2.7.0 lists only compact live captures and the new sheet captures; no wide file moves.
- `npm run bundle:budget`: `live` under its budget (20 KB as re-set, V28-9), `main` within `FULL_MAIN_KB` over 2.7.0's measure and under the 180 KB ceiling (V26-14); `passes.golden.test.ts` and every golden fixture untouched.
- `package.json` reads 2.8.0.
  The tag and the deploy are the owner's.
