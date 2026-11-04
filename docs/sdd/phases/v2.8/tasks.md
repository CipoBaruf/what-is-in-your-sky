# v2.8 — TASKS.md sections

Cut from `TASKS.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

## v2.8 tasks

Draft, cut 2026-10-30 from `SPEC.md` v2.8 and `PLAN.md` v0.16. Spec Phase 2q, "the full sky": on the phone the live page's drawing fills the screen in every view, with only `[ ← ]`, the shown time and its chip, and one `[ controls ]` button over it; every other control moves into a sheet over the sky (bottom in portrait, side in landscape); and with nothing visible up, a card asks whether to see the next pass or the sky now instead of jumping (FR-FULL-1..10, US-43, V28-1..V28-8). The compact live page only; wide, the stars page and the pass detail are unchanged (V28-1). The phase ends with `2.8.0` on `main`; the tag and the deploy are the owner's.

Delivery is PLAN §16 with §16.27: four tasks in three waves of two, one and one, `Model: fable` on R148 and `opus` on the rest, every task `Review: opus`, `Turns: 500`, `Fallback: off`, `Gate: auto`.

Decision block (§16.2), reserved in PLAN §16.27: **R146 D-930..D-931, R147 D-932..D-933, R148 D-934..D-936, R149 D-937..D-938**. D-918..D-929 are the plan's.

What every session reads, named in each task as "the phase set": SPEC §4.50 whole (FR-FULL-1..10 and its constants table), US-43, §9 Phase 2q, §12 V28-1..V28-8; SPEC §4.49 (FR-TONIGHT-1..7, as amended) for the parts that move; PLAN §2.43, §2.44, §9.10 and §16.27.

### Wave 1

- [x] **R146 — The card: `openingChoice`, `OpeningCard`, its strings, its tests**
  - *Done:* as written. `openingChoice` is `up` with a visible pass up at now (at its start, inside, at its end), `ask` with the first visible rise in the span and `openingJump`'s lead instant (at now for a rise under a minute away), `advise` with none in the span, and blind to a pass the caller hid. The card's lines, rendered, at a rise 23 h 59 min away (`controlRows.test.ts`): English "Nothing visible up now." 23, "Tiangong · 17:34 · in 23 h 59 min" 28.88 at `--small`, `[ see next pass ] [ see now ]` 29, "No visible pass in the next 24 h." 28.88 at `--small`, `[ see the sky now ]` 19; Spanish "Nada visible ahora." 19, "Tiangong · 17:34 · en 23 h 59 min" 28.88, `[ ver próximo pase ] [ ver ahora ]` 34, "Ningún pase visible en las próximas 24 h." 35.88 at `--small`, `[ ver el cielo ahora ]` 22. All within 36 and 390 px; the two Spanish rows at 34 and 35.88 are past 360 px's 33 and wrap there (D-930). The catalog key snapshot gains `live.opening.*`.
  - **Lane:** data
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); PLAN D-897, D-898, D-925; `lib/tonightJump.{ts,test.ts}`; `components/live/{ShownTime,TimeTaps}.tsx` (the chip's words and the `.target` idiom); `components/live/hiddenObjects.ts`; `src/i18n/{en,es}/live.ts`; `tests/styles/controlRows.test.ts`; `docs/DESIGN.md` (`TextButton`, `--screen-overlay`, `--hairline`).
  - **Goal:** a card that, given the stored run and now, says "Nothing visible up now" with the next pass's name, time and chip over `[ see next pass ]` `[ see now ]`, or the no-pass advice over `[ see the sky now ]`, in both languages, rendered and tested on its own (the page mounts it in R148).
  - **Satisfies:** FR-FULL-10 (the decision and the card), FR-FULL-8 (the card's strings); US-43 AC5 (unit level).
  - **Scope (PLAN D-925):**
    - `openingChoice(passes, now, span)` in `lib/tonightJump.ts` returning `up`, `ask` with the pass and its lead instant, or `advise`, over `openingJump`'s visible-pass predicate.
    - `components/live/OpeningCard.{tsx,module.css,test.tsx}`: both forms, callbacks `onNext(at)` and `onNow()`, `role="group"`, the polite live sentence, focus to its first button on mount.
    - The card's strings in `src/i18n/{en,es}/live.ts`; its rows in `controlRows.test.ts` (36 cells, 360 and 390 px, both languages).
  - **Touches outside the lane:** `components/live/OpeningCard.*`, `src/i18n/{en,es}/live.ts`, `tests/styles/controlRows.test.ts`.
  - **Out of scope:** mounting the card in `Live.tsx`, the effect, `Esc` (R148).
  - **Done when:**
    - `tonightJump.test.ts` covers `up`, `ask`, `advise` and a hidden pass; `OpeningCard.test.tsx` and `controlRows.test.ts` pass.
    - The Done note gives every card line in both languages with its cell count.
    - `npm test`, lint, typecheck and `npx vitest run tests/docs` green.

- [x] **R147 — The sheet and the head: the constants, `ControlsSheet`, `SkyHead`, `hintFitsBeside`, the sheet's strings, their tests**
  - **Lane:** ui
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); PLAN D-877, D-918, D-920, D-921, D-924; `lib/layout.{ts,test.ts}` (`LANDSCAPE_DRAWING_MIN_SHARE`); `components/live/usePageShape.ts`; `components/live/ShownTime.tsx`; `components/common/Header.tsx` (the back control); `ui/hooks/useOpenerFocus.ts` and the pass detail's sheet; `src/i18n/{en,es}.ts` and `src/i18n/{en,es}/track.ts` (how a catalog file is registered); `docs/DESIGN.md` (`TextButton`, `VisuallyHidden`, `--z-sheet`, `--screen-overlay`).
  - **Goal:** the parts the page will place over and under the sky, each working on its own: a `[ controls ]` button that opens and closes a non-modal sheet (bottom in portrait, at most seven tenths of the height; side in landscape), the head with the back control and the shown time, and the rule for where the hint stands.
  - **Satisfies:** FR-FULL-2, FR-FULL-3 (the button), FR-FULL-4 (the sheet's frame), FR-FULL-5 (open, close, focus), FR-FULL-8 (the sheet's strings); US-43 AC3 (component level).
  - **Scope (PLAN D-918, D-920, D-921, D-924):**
    - `FULL_OVERLAY_MAX_SHARE`, `SHEET_MAX_SHARE`, `SHEET_SIDE_SHARE`, `SHEET_TAP_SLOP_PX` and `hintFitsBeside` in `lib/layout.ts`.
    - `components/live/ControlsSheet.{tsx,module.css,test.tsx}`: the button, the region, the head (place, `[ settings ]`, `[ close ]`), the scrolling body, the two forms, the reduced-motion transition, focus in and back; open state controlled by props.
    - `components/live/SkyHead.{tsx,module.css,test.tsx}`.
    - `src/i18n/{en,es}/sheet.ts` (new) and its registration; the rows in a new `tests/styles/sheetRows.test.ts`.
  - **Touches outside the lane:** `lib/layout.ts`, `src/i18n/{en,es}.ts`.
  - **Out of scope:** mounting any of it in `Live.tsx`, `SkyViewLayout`'s form, the tap on the sky (R148); `controlRows.test.ts` (R146's).
  - **Done when:**
    - `ControlsSheet.test.tsx`, `SkyHead.test.tsx`, `layout.test.ts` and `sheetRows.test.ts` pass.
    - The Done note gives the sheet's two forms on the dev page or a test harness at 390 × 844 and 844 × 390, the focus moves, and the head's longest form in both languages.
    - `npm test`, lint, typecheck and `npx vitest run tests/docs` green.
  - *Done:* as written, plus D-932 and D-933. **The sheet's two forms** (test harness, jsdom with `matchMedia` stubbed): at 390 × 844 `data-form="bottom"`, fixed at the bottom at `--z-sheet`, the full width with a hairline top edge, `max-block-size: calc(--sheet-max-share × 100dvh)` with `--sheet-max-share` 0.7 written by the component, the body scrolling under a fixed head. At 844 × 390 `data-form="side"`, fixed at the right, `inline-size: calc(--sheet-side-share × 100vw)` (0.45, `1 − LANDSCAPE_DRAWING_MIN_SHARE`) and `100dvh` tall, with a hairline left edge. A turn between the two keeps the sheet open. The slide is 200 ms of `transform`, none with `data-motion="reduce"`. **Focus:** opening moves it to the body's first control, or to `[ close ]` where the body has none. `[ close ]`, `[ controls ]` and the page's own close all give it back to `[ controls ]`, including when the click did not focus the button (Safari). There is no trap, no backdrop and no dialog, and nothing is written to the hash or the history. **The head's longest form:** `[ ← ] 21:47 tonight · in 13 h 55 min` is 34.5 cells. `[ ← ] 21:47 esta noche · en 13 h 55 min` is 37.13 cells, over 36, so its chip ends in the ellipsis (D-933, which proposes a spec change to the owner). `[ controls ]` is 12 cells and `[ controles ]` 13. The sheet's head row with a ten-letter place is 33 cells in both languages: the fixed part is 22, so a place has 13 cells at 390 px. `hintFitsBeside`: the dome's drag clause fits beside the button except the Spanish mouse line (36.75 cells); the window's three clauses never fit. The rows are in `tests/styles/sheetRows.test.ts`, not `controlRows.test.ts`. knip reports nothing: the new modules are reached from their tests, so they needed no ignore entry, as R142's `TimeTrack` did not before R144. Tests: the touched files are 15 files and 291 tests. `npm test` is 3024 passed, 7 skipped and 1 failed: `tests/docs/public.test.ts`'s `npm ls`, an environment failure because the worktree has no `node_modules` of its own. The browser project ran only with Playwright's browsers aliased (1234 → 1243). Lint, typecheck and knip pass, and `npx vitest run tests/docs` has 213 passing plus the same one failure.

### Wave 2

- [x] **R148 — The page: `SkyViewLayout`'s `full` form, the compact branch's overlay and sheet, the card's effect, `stayOnNow` removed, the tap that closes the sheet, `Esc`'s four steps, the split inventory, `live-full.spec.ts` and the specs at the compact sizes**
  - *Done:* as written, plus D-934..D-936. **`chart-box` against the viewport** (`live-full.spec.ts`, every view, both languages): `0,0 390×844` at 390 × 844, `0,0 390×667` at 390 × 667 and `0,0 360×640` at 360 × 640, no page scroll; at 844 × 390 `0,0 844×390`. **The overlay's share** with the sheet closed (the head, `[ controls ]` and the hint): 0.046 (polar), 0.053 (dome) and 0.067 (window) of the box at 390 × 844 in English, 0.050, 0.060 and 0.071 in Spanish; 0.058–0.090 at 390 × 667; 0.066–0.099 at 360 × 640 — every one under `FULL_OVERLAY_MAX_SHARE`'s 0.12. **The sheet with the list open** on the twenty-pass run: 591 px at 390 × 844, 467 at 390 × 667 and 448 at 360 × 640 — `SHEET_MAX_SHARE`'s 0.70 of the height, its body scrolling, the page not; the side sheet at 844 × 390 is 380 × 390 (0.45 of the width, the full height). **The card on the noon clock** (`live-tonight.spec.ts`, both languages): the clock 2026-09-11T15:51:00Z (12:51 at Neuquén), the card asking with `t` on real time and nothing playing, the first visible rise 2026-09-12T07:20:24.375Z, and `[ see next pass ]` landing at 07:19:24.375Z, playing at 60×, the sheet closed; `[ see now ]` and `Esc` leave real time; reduced motion lands paused. The head's Spanish chip ends in its ellipsis, as D-933 said; at 360 px in Spanish the sheet head's coordinate pair is cut with the ellipsis FR-FULL-4 allows and `[ ajustes ] [ cerrar ]` stand whole (D-935). The head is the page's banner, fixed over the sky, and not the overlay slot's (D-934); the tablet rows are the full form too (V28-1's "compact live page", `shapes.spec.ts`). Tests: `Live.test.tsx` 62, `liveRows.test.ts` 18, `SkyViewLayout.test.tsx` 13; `npm test` 3069 passed, 7 skipped (the browser project with Playwright's browsers aliased 1234 → 1243). `live-full.spec.ts` 20 passed; `live-compact`, `live-states`, `live-tonight`, `live-jump`, `targets`, `rhythm`, `shapes`, `sky-layout`, `structure` and the other compact specs green with the sheet. The one e2e failure set left is the environment's, not the branch's: Chrome for Testing 151's `DeviceOrientationEvent.requestPermission` answers `prompt`, so the specs that open the sky screen without stubbing it (`sky-screen.spec.ts` ×5, `targets.spec.ts`'s sky screen ×2, `sky-window.spec.ts` ×6, `live.spec.ts`'s sky screen ×2) fail on `origin/main` in this container the same way (checked on a build of `main`). Captures: `docs/screenshots/r148-live-390-{card,closed,sheet}-dark-{en,es}.png`, `r148-live-844-landscape-{closed,sheet}-dark-{en,es}.png`.
  - **Lane:** live
  - **Model:** fable
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R146, R147
  - **Reads:** the phase set (above); SPEC FR-FLOW-3, FR-FLOW-4, FR-FLOW-6, FR-FLOW-10, FR-FLOW-11, FR-FLOW-15, FR-LIVE-1, FR-LIVE-9, FR-WATCH-7 (as amended); PLAN D-877, D-898, D-902, D-904, D-919, D-922, D-923, D-925..D-928; `screens/{Live.tsx,Live.module.css,Live.test.tsx,liveRows.ts,liveRows.test.ts}`; `components/sky/SkyViewLayout.{tsx,module.css}` and its test; `components/live/TimeTaps.tsx`; `state/slices/ui.ts`; `skychart/window/SkyWindow.tsx` (`tapSlop`), `skychart/dome/SkyDome.tsx`, `skychart/polar/SkyPolar.tsx` (how each takes a tap); `tests/e2e/{live-compact,live-states,live-tonight,live-jump,targets,rhythm,shapes}.spec.ts`, `tests/e2e/{flowPages.ts,liveHelpers.ts}`; R146's and R147's new modules.
  - **Goal:** a phone opened on `#live` is all sky in every view, with the back control and the time at the top and `[ controls ]` at the bottom; in the day a card asks next pass or now; the button opens the sheet with the context, the track and taps, the view row, the facing row, the actions and the list; a tap on the sky or `Esc` closes it; nothing ever resizes the sky; wide is untouched.
  - **Satisfies:** FR-FULL-1, FR-FULL-3..7, FR-FULL-10; FR-TONIGHT-1, FR-TONIGHT-2, FR-TONIGHT-4, FR-TONIGHT-6, FR-TONIGHT-9 as amended; US-43 AC1–AC5; US-42 as read by Phase 2q's definition of done.
  - **Scope (PLAN D-919, D-922, D-923, D-925..D-928):**
    - `SkyViewLayout`'s `form: 'full'`: the fixed, safe-area, `100dvh` wrapper, the `overlay` and `sheet` slots, `readoutIn: 'sheet'`, the capture-phase tap listener while the sheet is open.
    - `Live.tsx`'s compact branch: `SkyHead`, `ControlsSheet` with D-923's children in order, the hint in the overlay by `hintFitsBeside`, the hidden `h1`; `TopRow` and the mark leave compact.
    - The card's effect in place of the jump effect; `OpeningCard` in the overlay; the reader-wrote ref answering it; `stayOnNow` and its setter removed (and `TimeTaps`' call).
    - `Esc`'s four steps in the one listener.
    - `liveRows.ts`: `COMPACT_OVERLAY` and `COMPACT_SHEET` (D-928).
    - Tests and specs per §9.10's second to seventh bullets, with the new `tests/e2e/live-full.spec.ts`; `live-compact.spec.ts`'s floors replaced.
  - **Touches outside the lane:** `components/sky/SkyViewLayout.*`, `components/live/TimeTaps.tsx`, `state/slices/ui.ts`, the e2e specs above.
  - **Out of scope:** wide's rows and code paths; the stars page and the pass detail (they keep `column` and `rail`); the capture set (R149); removing strings wide still reads.
  - **Done when:**
    - `Live.test.tsx` (the card's cases, the sheet's order, the tap and drag, `Esc`'s steps, the inventory identical in both states), `liveRows.test.ts`, `SkyViewLayout.test.tsx` pass.
    - `live-full.spec.ts` passes at 390 × 844, 390 × 667, 360 × 640 and 844 × 390 in every view and both languages; `live-states.spec.ts` the box unchanged across closed, open, open with the list and a track drag; `live-tonight.spec.ts` with the card in both languages; `targets`, `rhythm` and `shapes` green with the sheet open.
    - Every wide e2e spec and the stars page's and pass detail's specs unchanged and green.
    - The Done note gives `chart-box`'s rect against the viewport at the three portrait sizes, the overlay's share, the sheet's height with the list open, and the card's landing instant on the noon clock.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.

### Wave 3

- [x] **R149 — The capture set and 2.8.0: the compact live captures and the sheet's, the diff against 2.7.0, the strings no reader uses, the budget row, `package.json` 2.8.0, `docs/RELEASE.md` §21, no tag**
  - *Done (the budget settled by the owner, V28-9, D-940: `live` re-set to 20, `FULL_MAIN_KB` 1.0; the Spanish taps row at 360 px fixed before the release, D-939):* the set is 414 (394 + 20). Against `b664585` shot by its own spec off its own build on one Linux container: 48 compact live files moved — `v1-live-watching-{360,390,768,844}-*`, `v1-live-scrubbing-{360,390,768,844}-*`, `v1-legend-{360,390}-*` and `v1-live-tonight-{360,390}-*` (now the card, FR-FULL-10) — and 20 were added: `v1-live-sheet-{390,844}-*`, `v1-live-sheet-list-{390,844}-*` and `v1-live-tonight-844-*`; no wide file and no other page moved (11 wide files at F-99's ≤ 14 px, step 2, not committed). The 38 sky screen files could not be shot here on either commit (Chrome 151's `requestPermission` answers `prompt`) and are unchanged. Two runs of the 68: 63 byte-identical, 5 sheet files ≤ 29 px at step ≤ 2. **Budget against 2.7.0:** `main` 180.0 KB, 184,363 bytes against 183,560 (+803, over `FULL_MAIN_KB`'s 512 and 43 bytes past 180 KiB); `live` 15.3 KB, 15,658 against 13,596 (+2,062, `OVER` 15) — R148's `SkyViewLayout` `full` form in `main` and the sheet, head and card in `live`; not re-set (D-938), the owner's (RELEASE §21.4). **Removed:** no message key (none lost its last reader); `Header`'s `status` prop, `StateIndicator`'s `word` and its `live-state-mark` form, `TopRow`'s `indicator`, `railToTop`'s export. `package.json` 2.8.0; RELEASE §21; the README hero re-drawn; D-937, D-938. Tag the squash merge of this PR (RELEASE §21.5). Follow-ups: FR-FULL-2's 36-cell check against the Spanish head (37.13 cells, cut by its ellipsis, D-933) and FR-COMP-7/F-82's "whole coordinate pair at 360 px", which no longer applies to the live page, want one-line SPEC amendments; the sheet's Spanish taps row loses its last `]` at 360 px.
  - **Lane:** docs
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R148
  - **Reads:** the phase set (above); SPEC FR-CAP-5, FR-FLOW-17's rule; PLAN D-178, D-916, D-917; `docs/RELEASE.md` §20; `tests/e2e/{captureSet.ts,v1-captures.spec.ts}`; `scripts/bundle-budget.ts`; `src/i18n/{en,es}/{live,sheet}.ts` and `messages.test.ts`; the memory of the captures wrapper config (a wrapper config in `sdd-run/`, no `VAR=1 cmd`).
  - **Goal:** the capture set shows the full-sky phone page, closed and open, and nothing else moved; nothing the phone stopped reading is left behind if wide does not read it either; `main` reads 2.8.0 ready for the owner's tag.
  - **Satisfies:** FR-FULL-8 (removals), FR-FULL-9; US-43 AC6; §9 Phase 2q's release item.
  - **Scope:**
    - Re-shoot the `v1-*` set; the changed files are only compact live captures (portrait and landscape, every view, sheet closed); add the sheet open and the sheet with the list open at 390 × 844 and 844 × 390, both themes and languages, and the card; list them against FR-FULL-9's named moves.
    - Remove the strings and components no page reads any more (`npm run check:dead`, `rg` outside `src/i18n`).
    - `scripts/bundle-budget.ts`: `live` under 15 KB, `main` within `FULL_MAIN_KB` over 2.7.0 and under 180 KB; re-set by D-178.
    - `package.json` and the lock `2.8.0`; `docs/RELEASE.md` §21: what 2.8.0 brings (R146–R148), the budget table against 2.7.0, the owner's phone check (open live in the afternoon, the whole screen sky and the card, `[ see next pass ]`, open the controls, drag the track, close with a tap on the sky) and the tag on this PR's squash SHA with the push to `release`; the README's live screen if it shows the phone.
  - **Touches outside the lane:** `src/i18n/**` removals, `scripts/bundle-budget.ts`, `package.json`, `package-lock.json`.
  - **Out of scope:** any behaviour change; the tag and the deploy.
  - **Done when:**
    - FR-CAP-5's diff against 2.7.0 lists only compact live files and the added sheet and card files; no wide file moves.
    - `npm run bundle:budget` green; `npm run check:dead` green.
    - The Done note lists the changed and added capture files, the `main` and `live` rows against 2.7.0, every removed key by name, and the SHA to tag.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.

### Requirement coverage (v2.8)

| Requirement | Task |
|---|---|
| FR-FULL-1 | R148 |
| FR-FULL-2 | R147 (the head), R148 (mounted) |
| FR-FULL-3 | R147 (the button, the hint rule), R148 (the overlay) |
| FR-FULL-4 | R147 (the sheet's frame), R148 (its contents, the tap) |
| FR-FULL-5 | R147 (open, close, focus), R148 (the tap, `Esc`) |
| FR-FULL-6 | R148 |
| FR-FULL-7 | R148 |
| FR-FULL-8 | R146, R147 (new strings), R149 (removals) |
| FR-FULL-9 | R149 |
| FR-FULL-10 | R146 (the decision, the card), R148 (the effect, `Esc`) |

Waves (for the sanity check): **wave 1** R146 (data) + R147 (ui) — **wave 2** R148 (live) — **wave 3** R149 (docs). No two tasks of a wave name the same file: R146 owns `live.ts`, `controlRows.test.ts` and `tonightJump.ts`; R147 owns `sheet.ts`, the two registration files, `lib/layout.ts` and `sheetRows.test.ts`.
