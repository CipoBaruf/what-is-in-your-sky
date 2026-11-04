# v2.6.1 — PLAN.md sections

Cut from `PLAN.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.42 v2.6.1 decisions (2026-10-29)

- **D-883 — The window keeps a "moved by hand" flag and turns once.**
  (FR-FLOW-14 as amended, V26-16.) `SkyWindow`'s slot camera stays a `useState`, so the facing a reader set survives the dome and back (D-878).
  Beside it a ref records whether the opening facing was taken with passes known (`passes.length > 0`, or `peak !== null` on the pass detail) and whether the camera has been moved since: every path that writes the hand camera — the drag, the keys, the zoom, the picker, `Following A` toggled — sets it.
  One effect on `[passes, facingPassId]` runs while the opening was taken without passes and nothing has moved: it computes `openingFacing` again with the same arguments as the initializer, writes it through the same setter the picker uses, and marks the opening done, so it runs at most once.
  *(R137's review)* The flag is a module `WeakSet` of unturned cameras, so a camera restored from `hand.get()` before the passes arrive (the dome and back, a turn of the phone) still turns; the turn calls `openingFacing` itself through the camera's new `open`, with the pass the window offers (`facingPass`: it has a key), so a highlighted pass with no arc yet is not followed.
  The live page's `useChartHand` is untouched; the turn reaches it by `hand.keep` as any move does.
- **D-884 — The Stars door's "from" is `tonightsStarsFrom`.**
  (FR-FLOW-1 as amended, V26-17.) `lib/tonightStripe.ts` gains `tonightsStarsFrom(bands, now)`: `tonightsDark`'s band if there is one, else the first `bright-twilight` band (`SkyState`, Sun in (−12°, −6°]) with `to > now`, else null.
  `doorLines` takes it in place of `dark` for the second line only; the first line (`Dark … → …` / `No full dark`) still reads `dark`.
  A test night above 54.5° N on 21 June (the observer at 58° N) pins the fallback; one at 70° N pins the null.
- **D-885 — An empty slot is not a block.**
  (FR-FLOW-10, FR-FLOW-11 as amended, V26-19.) `SkyViewLayout` renders a slot's wrapper only when its child is not null, so the dome's absent picker leaves no `--space-1` margin and no `data-rhythm` block; *(R139: the chart's own slot is a portal target, so the empty one is a 0 px row in the column instead, D-892)* `rhythm.spec.ts`'s `KNOWN` list is removed.
  `tests/e2e/flowPages.ts` gains a `view` option (`'window'` seeds `chartView: undefined`, `'dome'` seeds it as today), and both specs loop the live page and the pass detail over the two.
- **D-886 — The capture specs' test ids are checked against `src/`.**
  (FR-FLOW-16, V26-19.) `tests/docs/captureIds.test.ts` reads every `*-captures.spec.ts` and `v1-captures.spec.ts` under `tests/e2e/`, collects the literal ids of `getByTestId('…')` and `[data-testid="…"]`, and fails on any id no `.tsx` under `src/` contains as `data-testid="…"` or a `testId` string.
  `r76-captures.spec.ts` and `r84-captures.spec.ts` wait for the home's doors (`home-doors`) where they waited for `where-dome`; the r76 bounding box that measured the dome measures the Where pane.
- **D-887 — The dead parts go in one task, last.**
  (FR-FLOW-17, V26-15.) R140 removes FR-FLOW-17's list after the three fixes merge, so no wave-1 task works on a file whose comments it is rewriting, and it carries the version bump and `docs/RELEASE.md` §19 (what 2.6.1 fixes, the owner's tag on the merge SHA).
  *(R139)* It also brings `moon-captures.spec.ts` back to green under `CAPTURES=1` (its waits past `moon-row`: the home's language switch moved to the settings page by R129, the glare tooltip), or retires the spec if its captures are covered by `v1-captures`, per D-893.
  `knip` (`npm run check:dead`) stays the gate; message keys are checked by `rg` over `src` outside `src/i18n`, as the review did.

- **D-892 — The empty chart slot is hidden in CSS, not left unrendered.**
  (R139; FR-FLOW-10 as amended, D-885.) The page hands `picker` a `SkyViewChartSlot` in either view, and that element is the portal target the chart fills or not, so `SkyViewLayout` cannot drop the wrapper before the chart has decided.
  `SkyViewLayout` still renders no wrapper for a null slot; in the column, a slot whose only child is a chart slot the chart left empty loses its margin (`.layout[data-shape='column'] > .slot:has(> .chartSlot:empty):not(:has(> :not(.chartSlot)))`), so it is a 0 px row that takes no gap and is no block `rhythm.spec.ts` counts (it skips what has no height).
  Not `display: none`: `sky-layout.spec.ts` reads a box for every slot, and the wide panel lays its empty picker on the control line; the rail and the panel are wide and FR-FLOW-10 is a compact rule, so they are left as they were.
  Measured at 390 × 844 in both languages: the dome's drawing → hint is 6 px (was 12), the window's drawing → picker → hint 6 + 6.

- **D-893 — `captureIds.test.ts` matches built ids loosely, and the stale capture measures follow the spec as amended.**
  (R139; FR-FLOW-16, D-886.) An id a spec names counts as rendered when a `.tsx` under `src/` (tests aside) holds it as a whole string literal, or builds it in a `` data-testid={`…`} `` template whose interpolations each stand for one id-shaped word (`${testId}-line`, `${page}-back`, `${target}-link`); a bare `${x}` matches nothing.
  So the check catches an id no source has (a planted `where-dome` fails it) but not one a template could build, nor an id that `src/` still renders on a page other than the one the spec waits on (`next-event-label` lives on the live page now).
  Running `r76` with `CAPTURES=1` found three measures stale since earlier phases, not only the `where-dome` wait, and they follow the spec as amended: the home's next-event block is gone (FR-FIRST-3 as amended v2.6), so the populated-panes test stops measuring it and the populated home and `r93` stop waiting for `next-event-label`; the first-run footer is three lines at 390 px since R102, so `[ See what crosses ]` and the what step's foot are held to standing on that footer at the screen's (or the page's) end, not to a fixed 30 or 60 px from 844; and the what foot's rule is its `Rule` since R105 (D-720), not a border with padding.
  `moon-captures.spec.ts`'s `moon-line` wait is `moon-row` now; that spec is broken past its waits (the home's language switch, the glare tooltip) and is left for R140's note.

- **D-894 — `boxAspect` becomes the boolean `measureBox`.**
  (R140; FR-FLOW-17, D-868.) Since R133 `ChartFrame` read the number only as "given or not", and the live page passed `DOME_BOX_ASPECT` to say so.
  The prop is now `measureBox?: boolean` on `ChartFrame` and `SkyChartProps`, and the three views forward it unchanged; `measured`, D-868's suggested name, was taken by `SkyDome`'s own "the box has been measured" state.
  `DOME_BOX_ASPECT` stays: `lib/layout.ts`'s doc, `shapes.spec.ts` and `domeInk.ts` read it as the bowl's shape.
  `LegendInventory.clip` loses its second parameter, so the live page's budget is the slot's rows as measured (`useInventoryRows` never returns a negative, so the `Math.max` went with the subtraction).

- **D-895 — `moon-captures.spec.ts` is fixed, not retired, and 2.6.1's two larger rows go to the owner.**
  (R140; D-887, D-893.) The `v1-*` set's night has no glare pass (D-684), so nothing else shoots the glare label or the guide's sentence: the spec stays and follows the app.
  The language switch is picked on the settings page (R129), the guide waits for the window a phone opens on (R136), and since R84 (D-548) the card's label is text inside the card's control with no tab stop, so its tooltip is checked as the label's description and the open tooltip is shot on the guide's sentence, which still takes focus.
  Against `6b0634f` built on the same machine, `main` is 89 bytes and `window` 79 bytes larger, from R137 and R138 (R140 took back 22 and 61); Phase 2o's "no row larger than 2.6.0's" read strictly fails by those bytes, so `docs/RELEASE.md` §19.3 puts it to the owner rather than cutting code outside FR-FLOW-17's list.

### 16.25 Delivery of the v2.6.1 tasks *(V26-15..V26-19, D-883..D-887)*

The V1-11 rules are unchanged; the gate and the models are v2.6's (D-854).
Four `R` tasks in two waves, three then one, after this plan is on `main`.
Due 2026-10-30 21:00, the owner's ETA.

| Wave | Task | Lane | Model | Gate | Depends on |
|---|---|---|---|---|---|
| 1 | R137 — The window turns to the pass when the passes arrive: the moved flag, the one turn, its two tests | `chart` (`skychart/window/SkyWindow.tsx`, `skychart/window/camera.ts`, their tests) | opus | auto | — |
| 1 | R138 — The Stars door on a night with no dark band: `tonightsStarsFrom`, `doorLines`'s second line, the two nights | `data` (`lib/tonightStripe.ts` and its test, `screens/home/{doorLines.ts,HomeDoors.tsx}` and their tests) | opus | auto | — |
| 1 | R139 — The empty slot and the specs: `SkyViewLayout`'s slots, `flowPages.ts`'s `view`, the two specs over the window, the capture specs' waits, `captureIds.test.ts` | `live` (`components/sky/SkyViewLayout.{tsx,module.css}` and its test, `tests/e2e/{flowPages.ts,rhythm.spec.ts,targets.spec.ts,r76-captures.spec.ts,r84-captures.spec.ts}`, `tests/docs/captureIds.test.ts`) | opus | auto | — |
| 2 | R140 — What v2.6 left behind and 2.6.1: FR-FLOW-17's removals and comments, `package.json` 2.6.1, `docs/RELEASE.md` §19, no tag | `docs`, crossing into the files FR-FLOW-17 names (`src/i18n/**`, `LanguageToggle.tsx`, `Legend.tsx`, `Live.tsx`, `ChartFrame.{tsx,module.css}`, `SkyViewLayout.module.css`'s comment, `model/prefs.ts`, `PassDetail.tsx`, `GuidePanel.tsx`, `tests/e2e/{r85-captures,v1-captures}.spec.ts`, `package.json`, `package-lock.json`, `docs/RELEASE.md`) | opus | auto | R137, R138, R139 |

Lanes are §16.1's: R137 `chart`, R138 `data`, R139 `live`, R140 `docs`, one per lane in each wave.
No two wave-1 tasks name the same file.
R139 owns `SkyViewLayout.module.css`; R140 corrects its one comment after R139 merges.

**Sessions** (D-854): every row carries `Review: opus`, `Turns: 500`, `Fallback: off`, `Model: opus`.
None of the four is hard enough for fable.

**The schedule**: wave 1 about 2 h, wave 2 about 1 h; with one CI rerun per task about 4–5 h.

**Owner gates:** none.
The tag `v2.6.1` on R140's merge SHA and the fast-forward of `release` are the owner's.

**Decision block** (§16.2): **R137 takes D-888..D-889, R138 D-890..D-891, R139 D-892..D-893, R140 D-894..D-895.**

**What `Done` must say.**
R137: the three tests and the readout before and after the passes arrive.
R138: the two nights' lines in both languages.
R139: the gaps and targets in both views, and the ids the new test reads.
R140: every removed key, prop and comment by name, and `check:dead` green.

What every session reads (D-284's rule): SPEC §4.48 (FR-FLOW-1, 4, 5, 10, 11, 13, 14, 16, 17), §9 Phase 2o, §12 V26-15..V26-19; PLAN §2.42 and this section.
Each task's `Reads:` adds its own files.
