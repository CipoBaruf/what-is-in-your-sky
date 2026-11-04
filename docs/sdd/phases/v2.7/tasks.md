# v2.7 — TASKS.md sections

Cut from `TASKS.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

## v2.7 tasks

Draft, cut 2026-10-29 from `SPEC.md` v2.7 and `PLAN.md` v0.15. Spec Phase 2p, "tonight on the phone": the compact live page opens on tonight's next visible pass and plays it when nothing is up now, a thumb-sized time track with the day, twilight and dark bands and the passes replaces the overview, the stripe, the step row, the speed row and `[ scrub ]`, `tonight`, `next` and `now` are one tap each, playback picks its own speed, and the page keeps only the shown time, one context line, the drawing and the time controls (FR-TONIGHT-1..10, US-42, V27-1..V27-8). Compact only; wide is unchanged (V27-1). The phase ends with `2.7.0` on `main`; the tag and the deploy are the owner's.

Delivery is PLAN §16 with §16.26: five tasks in three waves of three, one and one, `Model: fable` on R144 and `opus` on the rest, every task `Review: opus`, `Turns: 500`, `Fallback: off`, `Gate: auto`.

Decision block (§16.2), reserved in PLAN §16.26: **R141 D-907..D-908, R142 D-909..D-910, R143 D-911..D-912, R144 D-913..D-915, R145 D-916..D-917**. D-896..D-906 are the plan's.

What every session reads, named in each task as "the phase set": SPEC §4.49 whole (FR-TONIGHT-1..10 and its constants table), US-42, §9 Phase 2p, §12 V27-1..V27-8; PLAN §2.43, §9.9 and §16.26; SPEC §4.30 (FR-WATCH-1..9) for what the compact page stops rendering.

### Wave 1

- [x] **R141 — The targets and the speed: the constants, `tonightJump.ts`, `autoSpeed`, `nightEnd`, `usePlayback`'s `'auto'` and its reader-wrote ref**
  - **Lane:** data
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); PLAN D-81, D-170, D-172, D-883; `physics/constants.ts` (`ARC_LOOKAHEAD` and its neighbours' comments); `lib/playback.ts` (`SPEEDS`, `advance`) and its test; `components/live/usePlayback.{ts,test.tsx}`; `lib/timeStripe.ts` (`SkyBand`); `components/live/useSkyBands.ts`; `components/live/hiddenObjects.ts` (what "visible" means for a pass on the live page).
  - **Goal:** the pure answers the page needs: where the jump lands, where `tonight` and `next` go, how fast playback runs at each instant and where it stops; and a playback hook that can run at that speed and tell the reader's writes from the page's.
  - **Satisfies:** FR-TONIGHT-1 (the target), FR-TONIGHT-4 (the targets), FR-TONIGHT-5.
  - **Scope (PLAN D-896, D-897, D-899):**
    - `TONIGHT_LEAD_MIN`, `AUTO_SPEED_NEAR`, `AUTO_SPEED_GAP`, `AUTO_NEAR_MIN` in `physics/constants.ts` with rationale comments (no physics changes).
    - `lib/tonightJump.ts`: `openingJump(passes, now, span)`, `tonightTarget(bands, passes, now, t)`, `nextTarget(passes, t)` per D-897.
    - `lib/playback.ts`: `autoSpeed(t, passes)` and `nightEnd(bands, t)`.
    - `usePlayback`: option `speed: Speed | 'auto'` and an `end` override; with `'auto'` the rate is read per frame and a frame crossing a slow-down boundary is split there (D-899); a `readerWrote` ref set by reader writes (`setT`, `toNow`, `play`, key steps) and not by a call flagged as the page's.
    - Tests per PLAN §9.9's first bullet.
  - **Touches outside the lane:** `components/live/usePlayback.{ts,test.tsx}`.
  - **Out of scope:** `Live.tsx` and any component (R144 wires them); wide's speeds, which keep their path.
  - **Done when:**
    - `tonightJump.test.ts`, `playback.test.ts` and `usePlayback.test.tsx` pass with the cases of §9.9; `passes.golden.test.ts` and every golden fixture untouched.
    - The Done note gives the rate at each edge and names the frame-split test.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.
  - **Done:** `autoSpeed` is 60× with a pass up (at its start, middle and end) and with a rise exactly 5 min ahead, 600× at 5 min + 1 s ahead, after the last pass and with none. The frame-split test is `usePlayback.test.tsx`'s "splits a frame that crosses the slow-down boundary, so the rise is not passed at 600× (the frame-split test)", with `advanceAuto`'s twin in `playback.test.ts`; the night-end stop is "stops, paused, at the `end` override". `usePlayback`'s `end` is a rule `(from) => EpochMs` and the page flags its writes with a last argument `'page'` (D-907, D-908).

- [x] **R142 — The time track: `TimeTrack`, `TRACK_HEIGHT_PX`, its strings, its tests** — a tick tap lands on `clampToSpan(start − leadMs)` with `lead: true`, the page passing `TONIGHT_LEAD_MIN` as `leadMs` (D-909); the track does not import the constant.
  - **Lane:** chart
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); PLAN D-82, D-170, D-383, D-851; `components/live/{TimeStripe,StripeOverview}.{tsx,module.css,test.tsx}` (the SVG idiom, the keys, the bands' colours); `components/live/liveArcs.ts` (pass colours); `lib/layout.ts`; `ui/styles/primitives.css` (`.target`); `src/i18n/{en,es}.ts` and one existing module for the registration idiom.
  - **Goal:** a 48 px track that shows the day, the twilight and the dark of the next 24 h and every visible pass, and moves the shown time under a thumb, ready for the page to mount.
  - **Satisfies:** FR-TONIGHT-3.
  - **Scope (PLAN D-896, D-900):**
    - `TRACK_HEIGHT_PX` in `lib/layout.ts`.
    - `components/live/TimeTrack.{tsx,module.css}`: props `span`, `bands`, `passes` (with colours), `t`, `onSeek(t, { lead: boolean })`, `timeZone`, `valueText`; bands, ticks (`max(3 px, …)`), thumb, the label row; pointer capture, the 44 px tick zones with nearest-wins, `role="slider"` with its ARIA values, keys 15 min and Page Up/Down 1 h.
    - `src/i18n/{en,es}/track.ts` (new: the accessible name, `now`, `+24 h`) and its registration.
    - `TimeTrack.test.tsx` per §9.9.
  - **Touches outside the lane:** `lib/layout.ts`'s one constant, `src/i18n/{en,es}.ts`.
  - **Out of scope:** mounting it on the live page (R144); `TimeStripe`, `StripeOverview` and `StepControls`, which wide keeps.
  - **Done when:**
    - `TimeTrack.test.tsx` passes; the messages snapshot gains only the track's keys.
    - The Done note gives the track's rendered size at 360 and 390 px and its slider values for a fixed `t`.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.

- [x] **R143 — The words: `ShownTime`, `shownTime.ts`, `contextLine.ts`, the taps' and the chip's strings, `controlRows.test.ts`**
  - *Done:* as written, plus `ContextLine` beside `ShownTime` and the chip at `--small` (D-911, D-912); every form with its cells is in `tests/styles/__snapshots__/controlRows.test.ts.snap` and R143's PR body. The Spanish taps row while playing is 34 cells, one past 360 px (D-912).
  - **Lane:** ui
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); SPEC FR-WATCH-2 (the offset and weekday rule), FR-WATCH-3, FR-COMP-4; PLAN D-245, D-903; `components/live/{TimeReadout,StatusStrip}.{tsx,test.tsx}` (today's clock, offset and conditions); `src/i18n/{en,es}/live.ts`; `tests/styles/controlRows.test.ts`; `lib/timeStripe.ts` (`SkyBand`).
  - **Goal:** the headline a phone reader reads at a glance — the shown time with "now" or "tonight · in 6 h 12 min" — and the one context line, with every string of the taps row, in both languages and within 36 cells.
  - **Satisfies:** FR-TONIGHT-7, FR-TONIGHT-8 (the new strings), FR-TONIGHT-4 (its strings and cell count).
  - **Scope (PLAN D-903):**
    - `lib/shownTime.ts` (`chipFor`) and `lib/contextLine.ts` (the line's parts and the no-pass reasons), pure, with tests per case.
    - `components/live/ShownTime.{tsx,module.css,test.tsx}`: the time at the headline size, seconds only on real time, the chip in the accent on `now`.
    - `src/i18n/{en,es}/live.ts`: the chip's words, the context line's forms, the two no-pass sentences, `tonight`/`next`/`now` and the play/pause labels.
    - `controlRows.test.ts`: the taps row (`▶ [ tonight ] [ next ] [ now ]`), every chip form and context form, at 360 and 390 px in both languages.
  - **Touches outside the lane:** `tests/styles/controlRows.test.ts`.
  - **Out of scope:** mounting on the live page (R144); removing the strings the compact page stops reading (R145, once nothing reads them).
  - **Done when:**
    - The new tests pass; every row within 36 cells in both languages.
    - The Done note lists every chip and context form in both languages with its cell count.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.

### Wave 2

- [x] **R144 — The page: the jump effect and `stayOnNow`, `TimeTaps`, one compact inventory, the readout in the corner, the hidden toggle in the list panel, the compact rows removed, the specs at the compact sizes**
  - **Lane:** live
  - **Model:** fable
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R141, R142, R143
  - **Reads:** the phase set (above); SPEC FR-FLOW-3, FR-FLOW-4, FR-FLOW-6, FR-FLOW-9..11, FR-FLOW-15, FR-LIVE-6, FR-LIVE-9; PLAN D-171, D-473, D-474, D-478, D-480, D-842, D-846, D-885, D-892; `screens/{Live.tsx,Live.module.css,Live.test.tsx,liveRows.ts,liveRows.test.ts}`; `components/sky/SkyViewLayout.{tsx,module.css}` and its test; `components/live/{PlaybackControls,StateIndicator,useHiddenObjects}.tsx`; `skychart/Legend.tsx` and the list panel in `Live.tsx`; `state/slices/ui.ts`; `tests/e2e/{live-compact,live-states,targets,rhythm,shapes}.spec.ts`, `tests/e2e/{flowPages.ts,liveHelpers.ts}`; R141–R143's new modules.
  - **Goal:** a phone opened on `#live` at noon lands on tonight's next pass and plays it; the page shows the shown time and its chip, one context line, the view row, the drawing with its readout in the corner, the track, the three taps and `[ list (n) ] Share` — the same rows whether `t` is now or later; wide is untouched.
  - **Satisfies:** FR-TONIGHT-1, FR-TONIGHT-2, FR-TONIGHT-4, FR-TONIGHT-6, FR-TONIGHT-9; FR-WATCH-1..5 as amended; US-42 AC1–AC5.
  - **Scope (PLAN D-898, D-901, D-902, D-904, D-905):**
    - `stayOnNow` in `state/slices/ui.ts` (memory only); the jump effect in `Live.tsx`, compact only, once, with the reduced-motion check and D-898's three exits.
    - `components/live/TimeTaps.{tsx,module.css,test.tsx}`.
    - `liveRows.ts`: one compact list for both states (D-902); `Live.tsx` mounts `ShownTime`, the context line, `TimeTrack` and `TimeTaps` on compact and stops mounting the overview, stripe, step row, playback row, `[ scrub ]`, `[ back to live ]`, the indicator's word and the next-event block there; playback runs with `speed: 'auto'` on compact.
    - `SkyViewLayout`'s `readoutIn: 'corner'` and the picker on tap, passed only by the compact live page.
    - The hidden-objects toggle in the list panel's head on compact.
    - The landscape phone lays the same slots in its rail (FR-FLOW-15).
    - Tests and specs per §9.9's second to sixth bullets, with the new `tests/e2e/live-tonight.spec.ts`.
  - **Touches outside the lane:** `components/sky/SkyViewLayout.*`, the list panel's head, `state/slices/ui.ts`, the e2e specs above.
  - **Out of scope:** wide's rows and code paths; the capture set (R145); removing strings or components wide still reads.
  - **Done when:**
    - `Live.test.tsx` (the jump's cases, the inventory identical in both states, presence and absence), `liveRows.test.ts`, `TimeTaps.test.tsx`, `SkyViewLayout.test.tsx` pass.
    - `live-tonight.spec.ts` passes in both languages; `live-compact.spec.ts` asserts the box at 390 × 667 ≥ 280 px and at 390 × 844 ≥ 2.6.1's watching box; `live-states.spec.ts` the box unchanged across a drag at 390 × 844 and 844 × 390; `targets`, `rhythm` and `shapes` green at the compact sizes.
    - Every wide e2e spec unchanged and green.
    - The Done note gives the box heights at 390 × 667 and 390 × 844 in both languages against the floors, and the jump's landing instant on the noon clock.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.

### Wave 3

- [x] **R145 — The capture set and 2.7.0: the compact live captures, the diff against 2.6.1, the strings no reader uses, the budget row, `package.json` 2.7.0, `docs/RELEASE.md` §20, no tag**
  - **Lane:** docs
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R144
  - **Reads:** the phase set (above); SPEC FR-CAP-5, FR-FLOW-17's rule; PLAN D-178, D-886, D-887; `docs/RELEASE.md` §19; `tests/e2e/{captureSet.ts,v1-captures.spec.ts}`; `scripts/bundle-budget.ts`; `src/i18n/{en,es}/live.ts` and `messages.test.ts`; the memory of the captures wrapper config (a wrapper config in `sdd-run/`, no `VAR=1 cmd`).
  - **Goal:** the capture set shows the new phone live page and nothing else moved, nothing the phone stopped reading is left behind if wide does not read it either, and `main` reads 2.7.0 ready for the owner's tag.
  - **Satisfies:** FR-TONIGHT-8 (removals), FR-TONIGHT-10; US-42 AC6; §9 Phase 2p's release item.
  - **Scope:**
    - Re-shoot the `v1-*` set; the changed files are only compact live captures (portrait and landscape, every view); list them against FR-TONIGHT-10's named moves.
    - Remove the strings and components no page reads any more (`npm run check:dead`, `rg` outside `src/i18n`).
    - `scripts/bundle-budget.ts`: the `main` row within `TONIGHT_MAIN_KB` over 2.6.1 and under 180 KB; re-set by D-178.
    - `package.json` and the lock `2.7.0`; `docs/RELEASE.md` §20: what 2.7.0 brings (R141–R144), the budget table against 2.6.1, the owner's phone check (open live in the afternoon, see tonight's first pass play, drag to the small hours, `next`, `now`) and the tag on this PR's squash SHA with the push to `release`; the README's live screen if it shows the phone.
  - **Touches outside the lane:** `src/i18n/**` removals, `scripts/bundle-budget.ts`, `package.json`, `package-lock.json`.
  - **Out of scope:** any behaviour change; the tag and the deploy.
  - **Done when:**
    - FR-CAP-5's diff against 2.6.1 lists only compact live files; no wide file moves.
    - `npm run bundle:budget` green; `npm run check:dead` green.
    - The Done note lists the changed capture files, the `main` row against 2.6.1, every removed key by name, and the SHA to tag.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.
  - *Done:* 40 compact live files moved (`v1-live-watching` and `v1-live-scrubbing` at 360/390/768/844, `v1-legend` at 360/390), no wide file; 8 added, `v1-live-tonight-{360,390}-{dark,night}-{en,es}` (the jumped opening state, paused under reduced motion), so the set is 394; `main` 179.3 KB, +1,737 bytes over `3363de2`; `live` 13.3 KB, +3,681, as FR-TONIGHT-10 amended by V27-9 has it (D-916); removed `live.timeLabel`, `countSpoken`, `skyShort`, `cloudWord`, `upCount`, `scrub`, `backToLiveShort`, `openFromNow`, `landmarkWord` and `passes.fields`; tag the squash merge of this PR (RELEASE §20.5). The capture spec was brought to the compact page (D-917).

### Requirement coverage (v2.7)

| Requirement | Task |
|---|---|
| FR-TONIGHT-1 | R141 (the target), R144 (the effect) |
| FR-TONIGHT-2 | R144 |
| FR-TONIGHT-3 | R142 |
| FR-TONIGHT-4 | R141 (the targets), R143 (the strings), R144 (the row) |
| FR-TONIGHT-5 | R141 |
| FR-TONIGHT-6 | R144 |
| FR-TONIGHT-7 | R143 |
| FR-TONIGHT-8 | R142, R143 (new strings), R145 (removals) |
| FR-TONIGHT-9 | R144 |
| FR-TONIGHT-10 | R145 |

Waves (for the sanity check): **wave 1** R141 (data) + R142 (chart) + R143 (ui) — **wave 2** R144 (live) — **wave 3** R145 (docs). No two tasks of a wave name the same file: R142 owns `track.ts` and the two registration files, R143 owns `live.ts` and `controlRows.test.ts`, R141 owns `usePlayback`.
