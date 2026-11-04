# v2.8 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.44 v2.8 decisions (2026-10-30)

Compact live page only (V28-1): every change below is behind `mode === 'compact'` in `Live.tsx` and the new `full` form of `SkyViewLayout`; the wide page, the stars page and the pass detail keep their code paths, and their captures do not move. v2.7's parts (`TimeTrack`, `TimeTaps`, `ShownTime`, `ContextLine`, `tonightJump.ts`, the automatic speed) are reused unchanged and only re-parented.

- **D-918 — The constants.**
  (FR-FULL-1..4, FR-VIS-6.) `FULL_OVERLAY_MAX_SHARE` (0.12), `SHEET_MAX_SHARE` (0.7) and `SHEET_SIDE_SHARE` (`1 − LANDSCAPE_DRAWING_MIN_SHARE`, written as that expression so the two cannot drift) and `SHEET_TAP_SLOP_PX` (8) join `lib/layout.ts` with their rationale comments.
  `FULL_MAIN_KB` is a row note in `scripts/bundle-budget.ts`, as `TONIGHT_MAIN_KB` was.
  No physics constant moves; the golden fixtures are untouched.
- **D-919 — The box is the viewport through a third layout form.**
  (FR-FULL-1, FR-FULL-6.) `SkyViewLayout` gains `form: 'full'` beside its `column` and `rail` (chosen today from the mode and `usePageShape`); only the compact live page passes it, in both shapes.
  In `full` the layout renders the `drawing` slot in a wrapper fixed to the viewport (`position: fixed; inset: 0`, padded by `env(safe-area-inset-*)`, height `100dvh`), and two new slots over it: `overlay` (the head, the button, the hint, the card) at `--z-raised` and `sheet` at `--z-sheet`.
  The other slots (`answer`, `viewRow`, `readout`, `picker`, `hint`, `action`, `layers`, `list`, `foot`) are not rendered in `full`; the live page passes their contents to the sheet instead.
  The chart components already size from their box (`fill`, D-904's `ChartFrame`); the window spans its field across the box's shorter side (`camera.ts`), which is the width in portrait, so FR-FULL-1's window rule needs no camera change.
  The dome and the polar chart already fit the smaller side, centred.
  The box's size depends only on the wrapper, which depends only on the viewport, so FR-FULL-6 holds by construction; `live-states.spec.ts` checks it.
- **D-920 — The head is `Header`'s back control and `ShownTime`, in one overlay row.**
  (FR-FULL-2, FR-FLOW-3 as amended.) `components/live/SkyHead.tsx` renders `[ ← ]` (the `Header`'s back control, with its Back rule from §4.37 and its `live-back` test id) and `<ShownTime>` at `--text-heading` with the chip at `--small`, on `--screen-overlay`, `width: max-content` up to the box less `--space-3` each side, the chip `text-overflow: ellipsis`.
  The page's `h1` (`Header`'s, "live" with the place) moves into a `VisuallyHidden` in `Live.tsx`, so the outline test and FR-FLOW-3's `h1` hold.
  `TopRow` and the mark leave the compact branch; wide keeps them.
- **D-921 — One `ControlsSheet`, two forms.**
  (FR-FULL-3, FR-FULL-4, FR-FULL-5.) `components/live/ControlsSheet.tsx` owns the button and the sheet: a `TextButton` `[ controls ]` (`aria-expanded`, `aria-controls` the sheet's id, `.target`) at the overlay's bottom-right, and a `<section role="region" aria-label="Sky controls">` that renders its `children` in a head (the place, `[ settings ]`, `[ close ]`) and a scrolling body (`overflow-y: auto`, `max-block-size: calc(SHEET_MAX_SHARE * 100dvh)` in portrait; `inline-size: calc(SHEET_SIDE_SHARE * 100vw)`, full height, in landscape, from `usePageShape`).
  It is non-modal: no focus trap, no backdrop element; the sky stays hit-testable above it.
  The slide is a `transform` transition of 200 ms, `none` under `prefers-reduced-motion`.
  Open state is component state in `Live.tsx` (`useState(false)`), so every mount starts closed; it is lifted to the page, not the component, so the shape change (which keeps `Live.tsx` mounted, D-877) keeps it, and the list's open state already lives in the page.
  Focus: opening focuses the body's first focusable element; closing focuses the button (`useOpenerFocus`, as the pass detail's sheet does).
  Nothing writes the hash or `history`.
- **D-922 — A tap on the sky closes the sheet; a drag does not.**
  (FR-FULL-4, FR-FULL-5.) The three views tell a tap from a drag each in their own way (the window's `tapSlop`, the dome's hotspots, the polar chart's click), so the sheet does not reach into them.
  While the sheet is open, `SkyViewLayout`'s `full` wrapper listens in the capture phase: `pointerdown` records the point, `pointerup` with a travel under `SHEET_TAP_SLOP_PX` (8 px, beside D-918's constants) closes the sheet and swallows the `click` that follows (one capture-phase `click` listener with `stopPropagation`, armed for that one event), so the first tap is spent on closing — no follow, no star pick.
  A longer travel is a drag and passes through untouched, so the camera turns with the sheet open.
  With the sheet closed the wrapper listens to nothing.
- **D-923 — The sheet's contents are v2.7's rows, in FR-FULL-4's order.**
  (FR-FULL-4, FR-TONIGHT-6 as amended.) `Live.tsx`'s compact branch passes, as the sheet's children: the place and `[ settings ]` in the head (the header's `settings` key and route); `ContextLine`; the track row (`ClockedTrack`) and `TimeTaps`; the view row (the `viewRow` slot's content, built in `Live.tsx` today); the facing row (the readout as a button that toggles the picker under it, D-904's behaviour moved out of the box's corner: `readoutIn` gains `'sheet'`, and the frame renders neither readout nor picker in `full`); the actions row; and the list panel under the actions when open.
  The `data-rhythm` marks move with the rows, so `rhythm.spec.ts` measures the sheet's gaps with no new marking scheme.
- **D-924 — The hint over the box.**
  (FR-FULL-3, FR-FLOW-6 as amended.) The hint's component and its `skyHintSeen` pref are unchanged; in `full` it renders in the overlay at the bottom-left, on the button's row when `hint + button ≤ 36` cells (measured by the same cell count `controlRows.test.ts` uses, a pure `hintFitsBeside(text, buttonLabel)` in `lib/layout.ts`) and in the row above otherwise.
- **D-925 — The card replaces the jump effect; the decision is pure.**
  (FR-FULL-10, FR-TONIGHT-1 and -2 as amended.) `lib/tonightJump.ts` gains `openingChoice(passes, now, span): { kind: 'up' } | { kind: 'ask', pass, at } | { kind: 'advise' }` over the same visible-pass predicate as `openingJump` (D-897), which it calls for `at`.
  `Live.tsx`'s jump effect (D-898) becomes the card's effect: same guards (compact, no `t` in the URL, the reader has not written `t` since mount, runs once on `[passes.length > 0]`), but instead of `setT`/`play` it sets `opening` state to the choice.
  `components/live/OpeningCard.tsx` renders the card from it; `[ see next pass ]` does what the effect did (`setT(at)`, then `play()` unless reduced motion), `[ see now ]` and `[ see the sky now ]` clear `opening`.
  The reader-wrote ref (D-898) clears `opening` too, so a drag on the track or any tap answers the card; a drag on the sky does not touch `t` and so leaves it.
  The card is `role="group"` with an `aria-live="polite"` sentence and takes focus on appearing; on going, focus moves to `[ controls ]`.
- **D-926 — `stayOnNow` is retired.**
  (FR-TONIGHT-4 as amended.) With the card asked on every visit there is nothing for it to suppress: the slice field, its setter and `TimeTaps`' call go, and `npm run check:dead` keeps them gone.
- **D-927 — `Esc` in four steps.**
  (FR-FULL-5, FR-FULL-10, FR-LIVE-1.) `Live.tsx`'s one `keydown` listener (R64) checks, in order: the sky screen up → close it (unchanged); the card up → `[ see now ]`; the sheet open → close it; else → leave the page (unchanged).
  One listener keeps the order in one place, as R64 did for the screen.
- **D-928 — One compact inventory, split.**
  (FR-FULL-3, FR-FULL-4, FR-WATCH-4.) `liveRows.ts`'s `COMPACT_ROWS` becomes two lists: `COMPACT_OVERLAY` (`head`, `controls`, and `hint`/`card` which the test checks by their own conditions) and `COMPACT_SHEET` (`context`, `track`, `taps`, `view-row`, `facing`, `actions`, `list`, `share`), with new ids `head`, `controls`, `card`, `facing` and test ids `live-head`, `live-controls`, `live-card`, `live-facing`; `top-row` and `headline` leave the compact lists.
  `rowsFor` returns the overlay list with the sheet closed and both with it open; the per-state test asserts both states equal, as v2.7's did.
  The wide lists are unchanged.
- **D-929 — Delivery shape.**
  (V28-7.) Four tasks in three waves, gate auto, opus except R148 (the page, which crosses the most files and carries the layout form and the gestures) on fable; §16.27.
- **D-930 — The card's lines: the chip is the offset to the rise, the no-pass sentence is small, and two Spanish rows wrap at 360 px.**
  (R146; FR-FULL-10, FR-FULL-8, D-925.) The pass line is the pass's name, the catalog's `separator` and `passWhen({ time, chip })`: the rise time in the observer's zone (`formatShortClock`) and the chip's own words (`live.chip`) for `heldOffset(rise, now)`, ahead, with neither `tonight` nor a weekday — the line names the rise time already and the span is 24 h, so the next 21:47 in it is the only one (D-912's rule for the context line), and the longest form, `Tiangong · 17:34 · en 23 h 59 min`, stays 28.88 cells with room for a longer name; the name is drawn apart and ellipsises, as the context line's does.
  The offset is to the rise, the time the line prints, not to `at` (a minute earlier), which the head's chip says once `[ see next pass ]` lands. "Ningún pase visible en las próximas 24 h." is 41 characters, so at the body size it could not keep FR-FULL-10's 36 cells; both no-pass sentences are set at `--small` (35.88 and 28.88 cells), the ask form's "Nothing visible up now." stays at the body size.
  At 360 px the widest font gives a shell row 33 cells: the Spanish no-pass sentence (35.88) wraps there and the Spanish button row, `[ ver próximo pase ] [ ver ahora ]` (34), puts its second button under the first (`flex-wrap`); `controlRows.test.ts` pins both, as R132 pinned the Spanish view row.
  The card writes its surface as `var(--screen-overlay, …)` with ChartFrame's spelling as the fallback, so it reads the overlay's token inside R148's overlay and the same surface on its own.
  The card's group is named by its sentence (`aria-labelledby`), and the polite live region holds the sentence and the pass line, not the buttons.
- **D-932 — The sheet stays mounted; reduced motion is asked in script.**
  (FR-FULL-4, FR-FULL-5; R147.) Closed, `ControlsSheet`'s section stays in the tree, `inert`, moved off its edge by `transform`, and `visibility: hidden` once the slide ends (the `visibility` step waits the slide out).
  That lets it slide out as well as in, and `aria-controls` always names an element.
  `useOpenerFocus` runs in a child that is mounted only while the sheet is open, so its mount and unmount are the sheet's open and close.
  `[ controls ]` focuses itself before it opens the sheet, so the opener is the button even on Safari, which does not focus a pressed button.
  Where the body has no control, focus goes to `[ close ]`.
  `prefers-reduced-motion` is read with `useMediaQuery(REDUCED_MOTION)` and written as `data-motion`, because a stylesheet's conditions may only be the layout's sizes (FR-DS-3, `breakpoint.test.ts`).
  The 200 ms is the module's own custom property (`--sheet-slide`), the first duration in the app, and no token was added for it.
  The two shares are written through the CSSOM, as `SkyViewLayout` writes `--sky-drawing-share`.
  The head has a test id per part: `live-head`, `live-back`, `live-controls`, `live-sheet`, `sheet-head`, `sheet-place`, `sheet-settings` (not `settings-link`, so it never clashes with the header's), `sheet-close` and `sheet-body`.
- **D-933 — The Spanish head is cut at its longest form.**
  (FR-FULL-2; R147.) Counted as FR-FULL-2's verification counts it (the time and its space at 1.25 cells a character, the chip at 14/16), `[ ← ] 21:47 tonight · in 13 h 55 min` is 34.5 cells and `[ ← ] 21:47 esta noche · en 13 h 55 min` is 37.13.
  The English form fits 36, and with the head's half-cell padding it fits the 35.5 cells the box holds at 390 px less `--space-3` each side.
  The Spanish form cannot fit 36 with R143's chip words, so its chip ends in the ellipsis FR-FULL-2 allows.
  `sheetRows.test.ts` pins both numbers and checks that the fixed part (13.5 cells) and `esta noche · en 13 h` fit 360 px.
  The owner should either amend FR-FULL-2's verification to "English within 36; Spanish cut by its ellipsis" or shorten the Spanish chip (R146's or a later lane's `live.ts`).
- **D-934 — The head is the page's banner, fixed over the sky; the overlay holds the card and the hint; focus leaves the card only where the card held it.**
  (FR-FULL-2, FR-FULL-3, FR-FULL-10, FR-A11Y-1; R148.) D-919 put the head in the layout's `overlay` slot, which stands inside the page's `main`; a banner inside another landmark is not one (F-71, axe's `landmark-banner-is-top-level`, `structure.spec.ts`'s one banner on the live page).
  So `Live.tsx` renders `SkyHead` with R89's link notes in the `Page`'s `<header>` landmark (`live-top-area`), fixed by `Live.module.css` at the box's top-left inside the safe area at `--z-raised`, inert and `aria-hidden` while the sky screen is up as the top row was; the layout's `overlay` slot holds the card (centred, a target's height and a group gap above the bottom edge) and the hint (bottom-left, on `[ controls ]`'s row or the row above by `hintFitsBeside`), and its `sheet` slot `ControlsSheet` — the button placed at the bottom-right by the page's class, the section fixed by its own stylesheet.
  The `h1` is the page's name with the place (`live · −38.93, −67.99`), visually hidden.
  When the card goes, focus moves to `[ controls ]` only when the card held it (the document's focus fell to the body with the card's unmount): a reader who answered the card from the sheet — the track, a tap, the play control — keeps the control under their finger.
  The page's own closes of the sheet (`Esc`, the tap on the sky) focus `[ controls ]` themselves as well as through `useOpenerFocus`, so the focus returns there even after the sky screen has remounted the layout.
- **D-935 — "Present" is in the DOM and not under `inert`; the sheet's rows stay mounted; the sheet moves the focus in only on an open the reader made.**
  (FR-FULL-4, FR-FULL-5, FR-WATCH-4 as amended v2.8, FR-FSC-2; R148.) D-928 has `rowsFor` answer the overlay alone with the sheet closed, and D-932 keeps the sheet's section in the tree, `inert`, with its rows — so FR-WATCH-4's "absent, not hidden" is read as "not reachable" for the sheet: `Live.test.tsx` and `live-states.spec.ts` count a row present when it is in the DOM and under no `inert` ancestor (visible, in the browser), and `rowsFor(state, mode, shape, sheetOpen)` takes the sheet's state, open by default — the page's own call, which renders every compact row in both states.
  The sheet's `FocusIn` mounts only once the sheet has been closed while mounted: a `ControlsSheet` mounted already open — the live page's layout coming back after the sky screen with the sheet and the facing row as the reader left them — leaves the focus where the screen's close put it (`[ hold up to the sky ]`, FR-FSC-2), and arms itself for the next open.
  The sheet's head keeps `[ settings ]` and `[ close ]` at their cells (`flex: none`): the place is what gives, so at 360 px in Spanish the coordinate pair is cut with the ellipsis FR-FULL-4 allows (R147's 13 cells at 390 px are 11 at 360) and the two controls stand whole — F-82's whole pair at 360 px was the top row's rule, and the top row is gone.
- **D-936 — The tap's swallow outlives the close, the tap stops at the wrapper, and the card is decided once the passes are known, with none in the span too.**
  (FR-FULL-4, FR-FULL-5, FR-FULL-10; R148.) The full wrapper's listeners are registered for the life of the form, not of the open sheet, and read the sheet's state through a ref: the `click` a tap leaves lands after the sheet's state has changed, and a listener torn down with the close would let it through.
  A tap's `pointerup` is stopped at the wrapper too, not only its `click`: the window names a star on its own `pointerup` (FR-STAR-7), and gives the drag up on the pointer capture it then loses (`onLostPointerCapture`), so nothing is left half-pressed; the dome's hotspots and the polar chart's picks are clicks, which the swallow covers.
  `pointerdown` records only a press on the drawing slot that is not inside the overlay or the sheet, so the card's buttons, `[ controls ]` and the sheet's rows are never a tap on the sky.
  The card's effect runs once the stored run's passes are known for the place (`ownPasses` and a pass in the run, or the run done), not once a pass is inside the 24 h span as R144's jump did: the advice form is for a span with none, which the jump had nothing to say about.
  In the sheet's facing row the picker's close on a pick is read off the DOM (a native `click` listener on the row, `PICK_SELECTOR`), since the chart's portal bubbles its events through the chart's tree and not the row's; the dome, which has no picker, draws the readout's words alone, with no button (the view says which: `hintView !== 'dome'`).
- **D-937 — The capture set on the v2.8 phone page, and what it shoots.**
  (R149; FR-FULL-9, FR-FULL-10, FR-CAP-5.) `v1-captures.spec.ts` answers the card the way R145 tapped `[ now ]`: `liveAt` waits for the decision (the track's pass ticks, D-917) and, where the card asks, presses `[ see now ]`, so every capture stays on its own instant and the sky screen's chip is the one 2.7.0 drew; the place is read off the sheet head (`sheet-place`) where there is no header.
  `live-scrubbing` on compact holds the instant on the track and taps `next` inside the sheet, then closes the sheet, so the file is the sky with the head's time and chip off real time, as FR-FULL-9 asks (sheet closed).
  `live-tonight` keeps its name and route and is now the card: `#live` at 13:00 local, the card asking with `[ see next pass ]` focused, nothing played; the turned phone joins it at 844 because FR-FULL-9's sizes are the phone's two.
  Two new screens, `live-sheet` (the sheet open, its body at the top) and `live-sheet-list` (the list open too, the body scrolled to it), are shot at the two sizes FR-FULL-9 names, 390 × 844 and 844 × 390, and no 360 beside them; `captures.test.ts` carries the three by name.
  The set is 414 files.
  `legend` at 360 and 390 is the sheet with the list and a row pressed, which is where the legend lives on the phone now.
- **D-938 — The budget as R149 found it: measured, not moved.**
  (R149; FR-FULL-9, D-178, D-916.) On the merged R148, built plainly beside `b664585` (2.7.0) on one machine, `main` is 184,363 bytes gzipped against 183,560 (+803, past `FULL_MAIN_KB`'s 512, and 43 bytes past 180 KiB, which the script's one-decimal rounding prints as `180` `ok`) and `live` 15,658 against 13,596 (+2,062, 15.3 KB, `OVER` its 15).
  Where it came from, each merge built against the one before: R146 + R147 +173 / +2 (the strings), R148 +632 / +2,101 (`SkyViewLayout`'s `full` form, which the stars page and the pass detail share and so sits in `main`; `ControlsSheet`, `SkyHead`, `OpeningCard` and the card's effect in `live`), R149's removals −2 / −41.
  R149 changes no behaviour and moves no code between chunks, and FR-FULL-9 fixes both numbers, so it does not re-set either budget: the owner settles it, as V27-9 settled 2.7.0's `live` row — amend FR-FULL-9 to the measure (`live` × 1.1 is 16.8, so 20 by D-178; `FULL_MAIN_KB` to 1.0 and the ceiling the owner's), or a `ui`/`live` task takes the `full` form out of `main` and trims the `live` chunk by about 300 bytes.
- **D-939 — The play glyph's floor hangs into the gutter.**
  (R149, on the owner's answer; FR-TONIGHT-4, FR-FLOW-11.) In the sheet at 360 px in Spanish the taps row measured 331 px in a 321.5 px body: the play glyph's `.target` floor counted its whole 44 px in the row, and flexbox squeezed the text buttons until `[ ahora ]` lost its last bracket.
  `TimeTaps.module.css` gives `.play` a negative start margin of half the floor less half a cell, so the floor's left half overhangs the sheet's two-cell gutter (19 px), the glyph is the row's first cell, and the row is its 33 cells; the hit area keeps its 44 px and overlaps nothing.
- **D-940 — The budget is the measure.**
  (R149; FR-FULL-9 as amended, V28-9; D-178, D-938.) On the owner's answer the `live` row is re-set to 20 (15.3 × 1.1 = 16.8, next 5 KB line), `FULL_MAIN_KB` to 1.0 KB, and `main` stays at its 180 ceiling at 180.0 KB.

### 9.10 v2.8 additions *(FR-FULL)*

- **The choice is pure.**
  `tonightJump.test.ts` gains `openingChoice`: a pass up at now (`up`), one later in the span (`ask` with its lead instant), none in the span (`advise`), a hidden pass ignored.
- **The card is a component test.**
  `OpeningCard.test.tsx`: both forms in both languages, each button's callback, focus on appearing, the live region.
  `Live.test.tsx` with a stored run at noon: the card appears with `t` on real time; `[ see next pass ]` lands at the lead instant and plays, paused under reduced motion; `[ see now ]` and `Esc` leave real time; a URL `t`, a pass up now and the reader moving the time first each mean no card; a drag on the sky leaves it; a wide render never shows it.
- **The sheet is a component test.**
  `ControlsSheet.test.tsx`: the button's `aria-expanded`/`aria-controls`, open and close by each way, focus in and back, the side form at the landscape shape, no transition under reduced motion.
  `Live.test.tsx`: the sheet's children in FR-FULL-4's order in every view; a tap on the sky closes it and does not follow or pick a star, in each view, and a drag past `SHEET_TAP_SLOP_PX` turns the camera with it open; `Esc`'s four steps.
- **The inventory is two lists.**
  `liveRows.test.ts` and `Live.test.tsx` assert D-928's overlay and sheet rows by test id, presence and absence, identical in both states.
- **Rows fit.**
  `controlRows.test.ts` gains the head's longest form, the card's sentences, pass line and button rows, `[ controls ]`, and the sheet's head row, at 360 and 390 px in both languages.
- **The page.**
  A new `live-full.spec.ts` at 390 × 844, 390 × 667 and 360 × 640, every view, both languages: `chart-box`'s edges within 1 px of the viewport's, no page scroll, the overlay's share under `FULL_OVERLAY_MAX_SHARE`, the sheet at or under `SHEET_MAX_SHARE` with the list open on a 20-pass run and its body scrolling; at 844 × 390 the side sheet's width and height.
  `live-states.spec.ts`: the box's size equal across sheet closed, open, open with the list, and after a drag on the track.
  `live-tonight.spec.ts` rewritten for the card: noon clock, card, `[ see next pass ]`, the lead instant, open the sheet, drag to 03:00, `next`, `now`, both languages.
  `live-jump.spec.ts` follows the card.
  `live-compact.spec.ts`'s two floors are replaced by `live-full.spec.ts`'s edges.
  `targets.spec.ts` and `rhythm.spec.ts` walk the compact live page with the sheet open; `shapes.spec.ts` keeps its compact sizes.
- **Unchanged is a capture.**
  Every wide capture and every page but the compact live page is re-shot byte-identical to 2.7.0's (FR-CAP-5).

### 16.27 Delivery of the v2.8 tasks *(V28-1..V28-8, D-918..D-929)*

The V1-11 rules are unchanged; the gate is v2.7's (D-906): auto, merged on CI green and a clean review.
Four `R` tasks in three waves of two, one and one, after this plan is on `main`.
No deadline is set.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R146 — The card: `openingChoice`, `OpeningCard`, its strings, its tests | `data` (`lib/tonightJump.{ts,test.ts}`, `components/live/OpeningCard.{tsx,module.css,test.tsx}`, `src/i18n/{en,es}/live.ts`, `tests/styles/controlRows.test.ts`) | opus | auto | — |
| 1 | R147 — The sheet and the head: the constants, `ControlsSheet`, `SkyHead`, `hintFitsBeside`, the sheet's strings, their tests | `ui` (`lib/layout.{ts,test.ts}`, `components/live/{ControlsSheet,SkyHead}.{tsx,module.css,test.tsx}`, `src/i18n/{en,es}/sheet.ts` (new) and its registration in `src/i18n/{en,es}.ts`) | opus | auto | — |
| 2 | R148 — The page: `SkyViewLayout`'s `full` form, the compact branch's overlay and sheet, the card's effect, `stayOnNow` removed, the tap that closes the sheet, `Esc`'s four steps, the split inventory, `live-full.spec.ts` and the specs at the compact sizes | `live`, crossing into `sky` and the state (`screens/{Live.tsx,Live.module.css,Live.test.tsx,liveRows.ts,liveRows.test.ts}`, `components/sky/SkyViewLayout.*`, `components/live/TimeTaps.tsx`, `state/slices/ui.ts`, `tests/e2e/{live-full,live-compact,live-states,live-tonight,live-jump,targets,rhythm,shapes}.spec.ts`) | fable | auto | R146, R147 |
| 3 | R149 — The capture set and 2.8.0: the compact live captures and the sheet's, the diff against 2.7.0, the strings no reader uses, the budget row, `package.json` 2.8.0, `docs/RELEASE.md` §21, no tag | `docs` (`tests/e2e/{captureSet.ts,v1-captures.spec.ts}`, `docs/screenshots/v1-*`, `src/i18n/**` removals, `scripts/bundle-budget.ts`, `package.json`, `package-lock.json`, `docs/RELEASE.md`, `README.md`) | opus | auto | R148 |

No two wave-1 tasks name the same file: R146 owns `live.ts` and `controlRows.test.ts`; R147 owns the new `sheet.ts`, the two registration files and `lib/layout.ts`, and adds its own rows to a new `tests/styles/sheetRows.test.ts` rather than `controlRows.test.ts`.
R148 is the only task that edits `Live.tsx` and `SkyViewLayout`, and it is alone in its wave because it wires the other two.

**Sessions** (D-906): every row carries `Review: opus`, `Turns: 500`, `Fallback: off`; `Model:` is `fable` for R148 and `opus` for the rest.

**The schedule** (from the plan's merge; a stop waits for its reset): wave 1 about 2 h, wave 2 about 3 h, wave 3 about 1 h.
Unstopped, about 6 h; with one five-hour stop and one CI rerun per task about 10–12 h.
The critical path is R147 → R148 → R149.

**Owner gates:** none (D-929).
The owner merges this plan, starts `--wave` after each wave merges, and resumes after a stop.
At R149 the owner opens the live sky on a phone in the afternoon, finds the whole screen sky and the card, taps `[ see next pass ]`, opens the controls, drags the track, closes them with a tap on the sky.
The tag `v2.8.0` on R149's merge SHA and the fast-forward of `release` are the owner's.

**Decision block** (§16.2): **R146 takes D-930..D-931, R147 D-932..D-933, R148 D-934..D-936, R149 D-937..D-938.**
D-918..D-929 are this plan's.

**What `Done` must say.**
R146: every `openingChoice` case and the card's lines in both languages with their cell counts.
R147: the sheet's two forms at 390 × 844 and 844 × 390, focus in and out, and the head's longest form.
R148: `chart-box`'s edges at the three compact sizes in every view and both languages, the overlay share, the sheet's height with the list open, the inventory test, and the card on a noon clock.
R149: the changed capture files against FR-FULL-9's named moves, the `main` and `live` rows against 2.7.0, and every removed key by name.

What every session reads (D-284's rule): SPEC §4.50 whole (FR-FULL-1..10), US-43, §9 Phase 2q, §12 V28-1..V28-8; SPEC §4.49 (FR-TONIGHT-1..7) for the parts that move; PLAN §2.43, §2.44, §9.10 and this section.
Each task's `Reads:` adds its own files.
