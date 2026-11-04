# v2.6.1 — TASKS.md sections

Cut from `TASKS.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

## v2.6.1 tasks

Draft, cut 2026-10-29 from `SPEC.md` v2.6.1 and `PLAN.md` v0.14.1. Spec Phase 2o, "the review fixes": what the review of the merged v2.6 (R129–R136) found — the window that never turns to the pass on a cold load, the Stars door on a night with no dark band, the empty slot's doubled gap and the two specs that never measured the window, the capture specs that wait for a removed element, and the parts v2.6 left unused (FR-FLOW-1, 5, 10, 11, 13, 14 as amended, FR-FLOW-16, FR-FLOW-17, V26-15..V26-19). Fixes stay inside the handoff's boards (V26-15). The phase ends with `2.6.1` on `main`; the tag and the deploy are the owner's.

Delivery is PLAN §16 with §16.25: four tasks in two waves of three and one, every task `Model: opus`, `Review: opus`, `Turns: 500`, `Fallback: off`, `Gate: auto`.

Decision block (§16.2), reserved in PLAN §16.25: **R137 D-888..D-889, R138 D-890..D-891, R139 D-892..D-893, R140 D-894..D-895**. D-883..D-887 are the plan's.

What every session reads, named in each task as "the phase set": SPEC §4.48's FR-FLOW-1, 4, 5, 10, 11, 13, 14, 16 and 17, §9 Phase 2o, §12 V26-15..V26-19; PLAN §2.42 and §16.25.

### Wave 1

- [x] **R137 — The window turns to the pass when the passes arrive: the moved flag, the one turn, its two tests**
  - **Lane:** chart
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); PLAN D-878, D-797; `skychart/window/SkyWindow.tsx` (the slot camera's `useState`, about line 444, and every path that writes the hand camera), `skychart/window/camera.ts` (`openingFacing`, `nextRising`, `followPass`) and their tests; `skychart/useChartHand.ts`; `screens/Live.tsx` (how `passes` and `facingPassId` reach the chart before the worker answers).
  - **Goal:** a phone that cold-loads `#live` sees the window face the highlighted pass once the passes arrive, not the pole for good; a reader who has already moved the camera keeps their facing.
  - **Satisfies:** FR-FLOW-14 as amended (V26-16).
  - **Scope (PLAN D-883):**
    - A ref in `SkyWindow` that records whether the opening facing was taken with passes known and whether the camera has moved since; every hand-camera write (drag, keys, zoom, picker, `Following A`) sets it; a camera restored from `hand.get()` counts as moved.
    - One effect on `[passes, facingPassId]`: while the opening was taken without passes and nothing has moved, recompute `openingFacing` with the initializer's arguments, write it through the picker's setter, mark done. At most one turn.
    - Tests in `SkyWindow`'s component test: mount with `passes: []`, rerender with passes and a highlighted id, expect the readout `Following A` (both languages); move the camera (a key) before the passes arrive and expect the facing unchanged after; a second pass update after the turn does not turn it again.
  - **Touches outside the lane:** none.
  - **Out of scope:** `Live.tsx` (the page still mounts the chart before the passes); the pass detail (it faces the peak, which it has at mount).
  - **Done when:**
    - The three tests pass; `camera.test.ts` unchanged and green.
    - The Done note names the tests and the readout before and after the passes arrive.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.
  - **Note:** done. The moved flag is one subscription to the slot camera (every write reaches its listeners, the turn's own write excepted), so the page's writes count as the reader's too; the turn writes through `followPass` or `facePeak` as the picker does. Tests in `SkyWindow.test.tsx`, "the turn when the passes arrive": `mounted with no passes … once they arrive (en)` and `(es)` (readout `Facing S (180°) · up 35°` / `Hacia el S (180°) · 35° de altura` at −38.93° before, `Following A` / `Siguiendo A` after), `a camera moved before the passes arrive keeps its facing`, `turns at most once`.

- [x] **R138 — The Stars door on a night with no dark band: `tonightsStarsFrom`, `doorLines`'s second line, the two nights**
  - **Lane:** data
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); SPEC FR-STAR-13; PLAN D-858..D-860; `lib/tonightStripe.ts` (`tonightsDark`) and its test; `lib/timeStripe.ts` (`SkyBand`), `model/pass.ts` (`SkyState`); `screens/home/{doorLines.ts,HomeDoors.tsx,useNight.ts}` and their tests; `src/i18n/{en,es}/home.ts` (`stars.from`, `stars.noNight`).
  - **Goal:** above about 54.5° N in June the Stars door says when the stars come out, not "No dark sky tonight".
  - **Satisfies:** FR-FLOW-1 as amended (V26-17).
  - **Scope (PLAN D-884):**
    - `tonightsStarsFrom(bands, now)` in `lib/tonightStripe.ts`: the dark band, else the first `bright-twilight` band with `to > now`, else null.
    - `HomeDoors` passes it to `doorLines` (a new `starsFrom` input); `doorLines`'s second line uses it in place of `dark` when there is no brightest star; the first line still reads `dark`.
    - Tests: `tonightStripe.test.ts` for the three cases; `doorLines.test.ts` for a 58° N night on 21 June (`Stars from` the twilight start) and a 70° N one (`No dark sky tonight`), in both languages.
  - **Touches outside the lane:** `screens/home/{doorLines.ts,HomeDoors.tsx}` and their tests.
  - **Out of scope:** the When reading and the stars page's dark line (they already say "no full dark").
  - **Done when:**
    - The tests pass; `doorRows.test.ts` still fits every line in 34 cells.
    - The Done note gives both nights' lines in both languages.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.
  - **Note:** done. On 21 June 2026 at noon UTC, from the bands `useTonight` samples (`doorLines.test.ts`): at 58° N 4° W (`Europe/London`) the Stars door reads `No full dark · Clear` / `Stars from 23:40` and `Sin oscuridad total · Despejado` / `Estrellas desde las 23:40` (the Sun below −6° from 22:40 UTC to 02:00 UTC, never below −12°); at 70° N 19° E (`Europe/Oslo`) it reads `No full dark · Clear` / `No dark sky tonight` and `Sin oscuridad total · Despejado` / `Sin cielo oscuro esta noche` (day all night). `doorRows.test.ts` gains the twilight line and still fits every line in 34 cells. `tests/support/doorFixtures.ts`'s `doorInput` makes `starsFrom` follow `dark` unless a test sets it.

- [x] **R139 — The empty slot and the specs: `SkyViewLayout`'s slots, `flowPages.ts`'s `view`, the two specs over the window, the capture specs' waits, `captureIds.test.ts`**
  - **Note:** the empty picker loses its gap in CSS (the wrapper is the chart's portal target, D-892); `r93` and `moon-captures` waited for removed ids too, and `r76` had three measures stale since R102/R105/v2.6, all fixed (D-893); `moon-captures` stays broken past its waits, for R140.
  - **Lane:** live
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** none
  - **Reads:** the phase set (above); PLAN D-851, D-870..D-872; `components/sky/SkyViewLayout.{tsx,module.css}` and its test; `tests/e2e/{flowPages.ts,liveHelpers.ts,rhythm.spec.ts,targets.spec.ts}`; `tests/e2e/{r76-captures,r84-captures}.spec.ts`; `screens/home/HomeDoors.tsx` (`home-doors`); `tests/docs/captures.test.ts` for the docs tests' idiom.
  - **Goal:** the window a phone opens on is held to the three gaps and the 44 px targets, the dome's drawing-to-hint gap is 6 px not 12, and every capture spec waits for something the pages draw.
  - **Satisfies:** FR-FLOW-10, FR-FLOW-11 as amended, FR-FLOW-16 (V26-19).
  - **Scope (PLAN D-885, D-886):**
    - `SkyViewLayout` renders a slot's wrapper only for a non-null child; `rhythm.spec.ts`'s `KNOWN` list removed.
    - `flowPages.ts` gains `view: 'window' | 'dome'` (`'window'` seeds no `chartView`); both specs run the live page and the pass detail in both.
    - `r76-captures.spec.ts` (lines about 91, 129, 205) and `r84-captures.spec.ts` (about 126) wait for `home-doors`; the r76 box that measured the dome measures the Where pane.
    - `tests/docs/captureIds.test.ts`: every literal test id in the capture specs is rendered by some `.tsx` under `src/`.
  - **Touches outside the lane:** `components/sky/SkyViewLayout.*`, `tests/e2e/{flowPages.ts,rhythm.spec.ts,targets.spec.ts,r76-captures.spec.ts,r84-captures.spec.ts}`, `tests/docs/captureIds.test.ts`.
  - **Out of scope:** any gap or target the window cases find outside `components/sky/**` is fixed only if it is in a page's `.module.css` and named in the Done note; anything larger is reported for R140's note.
  - **Done when:**
    - `rhythm.spec.ts` and `targets.spec.ts` pass in both views and both languages with no known exception; `captureIds.test.ts` passes and fails on a planted `where-dome` (checked once, not committed).
    - The r76 and r84 capture specs run green with `CAPTURES=1` through a wrapper config (no `VAR=1 cmd` in a driver session).
    - The Done note lists the gaps and targets measured in the window and any fix.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.

### Wave 2

- [x] **R140 — What v2.6 left behind and 2.6.1: FR-FLOW-17's removals and comments, `package.json` 2.6.1, `docs/RELEASE.md` §19, no tag**
  - **Lane:** docs
  - **Model:** opus
  - **Review:** opus
  - **Turns:** 500
  - **Fallback:** off
  - **Gate:** auto
  - **Depends on:** R137, R138, R139
  - **Reads:** the phase set (above); `docs/RELEASE.md` §18; the files FR-FLOW-17 names: `src/i18n/{en,es}/{stars,starsPage}.ts` and `messages.test.ts` with its snapshot, `components/common/LanguageToggle.tsx`, `skychart/Legend.tsx` (`LegendInventory.clip`'s `headerRows`, the stale header-row comment) and `screens/Live.tsx` (about lines 21, 692, 802), `skychart/ChartFrame.{tsx,module.css}` (the `windowBox` and `dome/camera.ts` comments), `components/sky/SkyViewLayout.module.css` (`--chart-bowl-h`), `model/prefs.ts`'s doc comment, `PassDetail.tsx` and `GuidePanel.tsx` (`← Back`), `tests/e2e/{r85-captures,v1-captures}.spec.ts` (the times header, `WhereDome`, `DOOR_TIME.later`).
  - **Goal:** nothing v2.6 stopped using is left in the code, every comment names what is there, and `main` reads 2.6.1 ready for the owner's tag.
  - **Satisfies:** FR-FLOW-17, FR-FLOW-5 and FR-FLOW-13 as amended; §9 Phase 2o's release item.
  - **Scope (PLAN D-887):**
    - Remove `stars.tonight`, `stars.lookUp`, `starsPage.readout` (both languages, their test pins and snapshot lines); keep the stars page's heading once (`starsHeading` or `stars.tonight`, whichever the page reads).
    - Remove `LanguageToggle`'s `className`; `headerRows` from `LegendInventory.clip` and `Live.tsx`'s subtraction; `boxAspect`'s value where it is only a switch (a boolean, or the condition it stands for).
    - Correct every comment FR-FLOW-17 names.
    - `package.json` and the lock `2.6.1`; `docs/RELEASE.md` §19: what 2.6.1 fixes (R137–R140), the budget table against 2.6.0, the owner's tag on this PR's squash SHA and the push to `release`.
  - **Touches outside the lane:** the `src/` files above, `package.json`, `package-lock.json`.
  - **Out of scope:** any visible change; the tag and the deploy.
  - **Done when:**
    - `npm run check:dead` green; `rg` finds no reader of a removed key outside `src/i18n`; the messages snapshot loses only the removed keys.
    - `npm run bundle:budget` no row larger than 2.6.0's.
    - The Done note lists every removal and comment by name, and the SHA to tag.
    - `npm test`, lint, typecheck, `npx vitest run tests/docs` and `npm run e2e` green.
  - **Note:** `boxAspect` is the boolean `measureBox` (`measured` was `SkyDome`'s state, D-894); `moon-captures.spec.ts` fixed rather than retired, the card's glare tooltip checked as a description since R84 (D-895); `main` and `window` are 89 and 79 bytes over 2.6.0 from R137/R138, put to the owner in `docs/RELEASE.md` §19.3. The SHA to tag is this PR's squash merge (§19.4).

### Requirement coverage (v2.6.1)

| Requirement | Task |
|---|---|
| FR-FLOW-14 (amended) | R137 |
| FR-FLOW-1 (amended) | R138 |
| FR-FLOW-10, FR-FLOW-11 (amended), FR-FLOW-16 | R139 |
| FR-FLOW-5, FR-FLOW-13 (amended), FR-FLOW-17 | R140 |

Waves (for the sanity check): **wave 1** R137 (chart) + R138 (data) + R139 (live) — **wave 2** R140 (docs). No two tasks of a wave name the same file.
