## 19. v2.6.1 (spec §9 Phase 2o)

Everything above still applies, §1 to §5 included, and §18's list is run with this one if
`v2.6.0` has not been tagged yet. v2.6.1 is the review's fixes to v2.6 (V26-15), inside the
handoff's boards: the window turns to the pass when the passes arrive after it opened
(FR-FLOW-14, R137), the Stars door names when the stars come out on a night with no dark
band (FR-FLOW-1, R138), the empty slot gives no gap and the rhythm and target specs measure
the window too (FR-FLOW-10, FR-FLOW-11, R139), the capture specs wait for what the v2.6 home
renders (FR-FLOW-16, R139), and what v2.6 stopped using is gone (FR-FLOW-17, R140, this
section). FR-FLOW-5 and FR-FLOW-13 as amended (V26-18) change words in the spec, not the
screens. `main` reads `2.6.1` once R140 merges; the tag, the push to `release` and the deploy
are the owner's (§19.4).

### 19.1 What R140 removed and corrected (FR-FLOW-17, D-887)

No visible change: every removal below had no reader, and every correction is a comment.

- **Message keys:** `stars.tonight` and `stars.lookUp` (both languages; the stars page's
  heading is `starsHeading`, read once by `Stars.tsx`), and `starsPage.readout` (both
  languages; the page draws the window's readout and its field width, FR-FLOW-5 as amended).
  Their pins in `messages.test.ts`, the two snapshot lines, and `stars.spec.ts`'s unread
  `lookUp` column go with them.
- **Props and parameters:** `LanguageToggle`'s `className` (its one caller, the settings page,
  passes none); `LegendInventory.clip`'s `headerRows`, always `0` since D-863, and
  `Live.tsx`'s subtraction of it; `boxAspect: DOME_BOX_ASPECT`, whose value `ChartFrame` had
  ignored since D-868, is now the boolean `measureBox` on `ChartFrame` and `SkyChartProps`,
  so `Live.tsx` no longer imports `DOME_BOX_ASPECT`.
- **Comments:** `ChartFrame.tsx` (the `measureBox` prop, and `bowlHeightPx` and
  `compactBowlBoxPx` in `dome/bowl.ts`, not `dome/camera.ts`); `ChartFrame.module.css`
  (`windowBox`, gone since R133, and `boxAspect`); `SkyViewLayout.module.css`
  (`--chart-bowl-h`, not `--chart-box-h`); `SkyChart.types.ts`; `Legend.tsx` (no times
  header); `Live.tsx` (the inventory's rows); `LanguageToggle.tsx` (the settings page, not the
  header); `model/prefs.ts` (the `ChartView` doc, orphaned above the next comment and still
  saying the polar chart was the default); `PassDetail.tsx`, `GuidePanel.tsx`, `App.tsx`,
  `passSelection.ts` and `Live.test.tsx` (`[ ← ]`, not `← Back`); `starsPage.ts`;
  `r85-captures.spec.ts` (no times header) and `v1-captures.spec.ts` (no `WhereDome` wait;
  the home capture reads `DOOR_TIME.later`, the fourth door state the table named and nothing
  read).
- **`moon-captures.spec.ts`** green again under `CAPTURES=1` (D-887): the language switch is
  the settings page's, the card's glare label is checked by its description (since R84 it has
  no tab stop, so its tooltip is not drawn on the card), the guide waits for the window, which
  a phone opens on (R136), and the guide sentence's tooltip is opened by focus for its capture.

`npm run check:dead` reports nothing. `rg` over `src` outside `src/i18n` finds no reader of a
removed key.

### 19.2 The budget (Phase 2o, D-178)

`npm run bundle:budget` on the branch, gzip level 9, beside `6b0634f` (2.6.0) built on the same
machine, both plain (`VITE_MOON_LORE` unset). No budget moves:

| Chunk | gzip KB | Budget KB | `6b0634f` | Change |
|---|---|---|---|---|
| main | 177.6 | 180 | 177.5 | **+89 bytes** |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | +5 bytes |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 26.7 | 30 | 26.7 | −1 byte |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | 30 | 24.1 | −4 bytes |
| window (`SkyWindow`) | 26.7 | 30 | 26.6 | **+79 bytes** |
| live | 9.7 | 15 | 9.7 | −7 bytes |
| service worker | 5.0 | 10 | 5.0 | −2 bytes |
| settings | 1.0 | 10 | 1.1 | −22 bytes |

Where it came from, against R140's parent `6af2646` built the same way: R137 to R139 added
111 bytes to `main` (R138's `tonightsStarsFrom` and the door's second line) and 140 to `window`
(R137's moved flag and its one turn); R140's removals took back 22 and 61. Two rows are
therefore a few bytes larger than 2.6.0's, which Phase 2o's definition of done does not allow
on a strict reading (§19.3).

- [ ] The release PR carries this table.

### 19.3 What the owner decides on this release

- [ ] **`main` and `window` are 89 and 79 bytes over 2.6.0** (§19.2), from R137's and R138's
      fixes, not from R140. The phase's "no row larger than 2.6.0's" read strictly fails by
      0.1 KB on each; read as no budget raised and no row over its budget, it holds. Accept,
      or open a task to find the bytes.
- [ ] **FR-CAP-5's diff against 2.6.0** (FR-FLOW-17's verification) is `captures.yml`'s to
      run: only FR-FLOW-1's files (the Stars door's line) and FR-FLOW-10's (the empty slot's
      gap) should move. R140 changes nothing a capture shows.

### 19.4 The release itself — `v2.6.1`

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.6.1` on `main` and every task of the phase is checked off in
      `TASKS.md` (R137..R140).
- [ ] §19.3's two items are decided.
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §19.2's.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R140's PR (its subject starts `R140:`). Write it here:
      _(the SHA)_.
- [ ] Tag it: `git tag -a v2.6.1 <sha> -m "v2.6.1: the review fixes" && git push origin v2.6.1`.
      If `v2.6.0` is not tagged yet, tag `6b0634f` first, as §18.5 says.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §18 and this section history, as §14 was at its release.
- [ ] Record in the release PR: the bundle table, the knip output, the capture run's numbers,
      and the date.
