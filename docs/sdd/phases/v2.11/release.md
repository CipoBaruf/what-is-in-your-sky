## 24. v2.11 (spec §9 Phase 2t)

Everything above still applies, §1 to §5 included, and §23's list is run with this one where
`v2.10.0` was never tagged. v2.11 is one clean sky (V211-1..V211-11): on a phone the stars page
and the pass detail are the sky in the full form, as the live page is — the box as the screen, a
head, `[ follow ] [ controls ]` at the foot and a bottom sheet with the rest (FR-CLEAN-1..8, R163,
R164) — the stars page has no passes toggle (FR-CLEAN-11), and on a desk every page holds the
home's width, the header's links are bracketed, settings breathes and the doors stand out
(FR-CLEAN-12..16, R166). The owner's notes of 2026-11-02 (D-1018..D-1033, #255 and #256) shipped
in the same phase: following aims low and lifts a downward tilt, the Sun's glow is a setting off
by default, Auto left the Theme row, the footer is the same on every page, the Where reading has
one control and names a place by its name alone, a device location is named by the nearest city,
high cloud counts, and on a desk only the pick list scrolls. R165 is this section: the column
retired, the capture set, the budget, the version and the owner's phone run. `main` reads
`2.11.0` once R165 merges.

### 24.1 The capture set and the diff against `77b3df3e` (FR-CLEAN-9, FR-CLEAN-10, FR-CAP-5)

The set has **416 files**: 2.10.0's 420, less `stars-passes` (360, 390, 1280; 12 files) and
`stars-whole-passes` (390, 1280; 8), which left with the stars page's passes (FR-CLEAN-11), plus
`stars-sheet` and `guide-sheet` at 390 × 844 and 844 × 390 in both themes and languages (16),
each a touch phone under `stubOrientation` with its sheet open at the top of its body. Every other
compact stars and pass-detail file is the full form's sky with the sheet closed: the capture spec
opens the sheet to press the view row or `[ follow the phone ]` and closes it again (D-1016).

Shot by `captures.yml` on the branch, twice, with `base` `1d24089b` (R161's squash merge, whose
set is `77b3df3e`'s: the 2.10.0 release commit changed no capture): run 1
[41574871766](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/41574871766) and run 2
[41574895009](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/41574895009), both
green, 416 files and the design captures, no capture missing.

**The diff against 2.10.0 lists every file, not only FR-CLEAN-9's named moves.** Of the 396 files
both sets have, none is byte-identical: 28 changed size and 368 moved. FR-CLEAN-9's "no wide
capture moves, and no live capture" was written before the phase grew, and three things since
move files it did not name:

- **R166's desk** (FR-CLEAN-12..14, FR-CLEAN-16): the header's page links as `[ home ] [ live ]
  [ stars ]` on every page that has the header, at every width, the shell's cap on every route,
  the stars rail's `View` row and the doors' emphasis.
- **The owner's notes of 2026-11-02** (D-1018..D-1033): the footer the same on every page
  (D-1023) — every file with a footer in it; the bottom row's padding (D-1026) on every compact
  live file; following's aim (D-1018, D-1022); the Where reading's one control and the place's
  name alone (D-1024, D-1029) on every home file; Auto gone from the Theme row and the settings
  page re-laid (D-1020, D-1033: the full-page `settings` files at 360, 390 and 768 are 48 to
  388 px taller, and `location` at 360 up to 24 px); high cloud (D-1028) on the home's cloud words.
- **The renderer:** 2.10.0's committed set is R161's container's (§23.1), and `captures.yml`'s
  run 1 that was to replace it was never committed, so the base is not this workflow's raster.
  Changed pixels run from 5,392 to 2.6 million a file; no file is inside F-99's noise.

So the check of record for FR-CLEAN-10 is the branch against `main` before R165, both off
`captures.yml` (the next paragraph), and this section's list is what moved since 2.10.0 for every
reason above.

**Two runs of the 416 files** (FR-CAP-5): 393 byte-identical and 23 apart, every one F-99's kind —
the wide live files' edges (`v1-live-scrubbing-{1200,1280,3840}-*`, 4;
`v1-live-watching-1024-*-es`, 2; 3 to 12 pixels at a step of 2), the live sheet's
(`v1-live-sheet-list-*`, 5, and `v1-live-sheet-390-night-en`, 6 to 144 pixels at a step of at
most 11), `v1-legend-390-night-en` (164 pixels, step 21), `v1-stars-whole-following-390-*-en`
(2, 122 and 141 pixels: §23.1's two hairlines) and, new to the list, one to three pixels at a
step of at most 16 on seven home and Where files at 390, 768 and 1280
(`v1-home-390-view-*-en`, `v1-home-768-view-night-en`, `v1-home-daylight-{390,1280}-*`,
`v1-home-up-now-390-night-en`, `v1-where-opened-390-dark-en`).

**The branch against `main` before R165** (FR-CLEAN-10's check of record): `captures.yml`'s push
run on `70773d6a`
([41575138649](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/41575138649)), red
because `main`'s capture spec still pressed the column's controls, shot 364 files. Against run 1,
**345 are byte-identical and 19 differ only by F-99's noise** (1 to 169 pixels at a step of at
most 21: `v1-legend-*` 4, `v1-live-scrubbing-*` 3, `v1-live-sheet*-844-*` 3,
`v1-live-watching-1024-*` 2 and seven home files' one to six pixels). Every live capture and
every wide capture is among them, and so are the compact `guide`, `polar` and `stars-zoom` files
R163 and R164 had already moved. The 52 files `main` could not shoot are R165's: the compact
`stars` (360, 390, 844), `stars-whole`, `stars-following`, `stars-whole-following`,
`guide-window` (360, 390) and `guide-short` re-routed through the sheet, and the 16 new sheet
files.

**What is committed.** Run 1's 416 files as the set, replacing every `v1-*` file; the README
hero and the social preview re-drawn from it (`npx tsx scripts/readme-hero.ts`): the hero's
second tile, `v1-stars-844-dark-en`, is the turned phone's full form now, not the rail.

- [x] Dispatch `captures.yml` on the release branch with `base` `1d24089b`, twice: run 1
      _41574871766_, run 2 _41574895009_.
- [x] Run 1 is green: **416 files** and the design captures, no capture missing.
- [x] Run 1's diff is recorded above, with the reasons the list is every file.
- [x] Run 1's artefact is committed as the set, the hero and the social preview are re-drawn
      from it, and run 2 agrees with run 1 but for F-99's noise.

### 24.2 The budget (FR-CLEAN-9, D-178, D-1016)

`npm run bundle:budget` on the branch, gzip level 9, beside `77b3df3e` (2.10.0) built on the
same machine, both plain (`VITE_MOON_LORE` unset). D-178 re-sets every row and **none moves**:
each measure × 1.1, rounded up to the next 5 KB, is the budget the row already has, and `main`'s
(205) is past its 185 ceiling. The budget column is `scripts/bundle-budget.ts`'s rows;
`tests/docs/accuracy.test.ts` checks it against them:

| Chunk | gzip KB | Budget KB | `77b3df3e` | Change |
|---|---|---|---|---|
| main | 182.0 | 185 | 180.3 | +1,716 bytes |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | +15 bytes |
| stars-deep (`deep`) | 41.8 | 50 | 41.8 | 0 |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 29.9 | 35 | 29.2 | +745 bytes |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | 30 | 24.1 | 0 |
| live | 14.7 | 20 | 15.8 | −1,135 bytes |
| window (`SkyWindow`) | 13.2 | 15 | 13.1 | +114 bytes |
| service worker | 5.0 | 10 | 5.0 | 0 |
| settings | 1.2 | 10 | 1.1 | +83 bytes |

Where it came from, measured on one machine at each step: **`main`** 184,678 bytes on 2.10.0,
187,375 with R164 merged (+2,697 across R162, R166, R163 and R164, most of it the shared sheet,
head and bottom row folding into `main` once the pass detail mounts them, D-1013), 187,656 with
#255 and #256 (+281), and 186,394 on this branch (−1,262: R165's removals). Less the owner's
notes, the phase's `main` is +1,435 bytes, inside FR-CLEAN-9's 1.5 KB for the pass detail's use.
**`stars`** +745 bytes, inside its 1.5 KB. **`live`** gives back 1,135 bytes: the sheet and the
head left it for the shared code (D-1006). `settings` +83 is the Sun's glow row (D-1019).

### 24.3 What R165 removed (FR-CLEAN-8, FR-FLOW-17's rule; D-1000, D-1015)

**No message key, and this code:** `SkyViewLayout`'s `column` shape and its compact `rail` (the
landscape phone's), with their styles, the `form` prop (compact is always `full`), `readoutIn:
'corner'` with the corner readout and the picker it opened, `pickerOpen` / `onPickerOpen`, the
drawing-room, landscape-height and landscape-hint measurements and their tests; the bowl's cut
(`ChartFrame`'s `bowl` and `data-bowl`, its stylesheet rule, `SkyDome`'s `bowl`,
`dome/bowl.ts`'s `compactBowlBoxPx` and `bowlHeightPx`); and from `lib/layout.ts`
`DOME_COMPACT_SLACK_PX`, `compactDomeBoxHeightPx`, `COMPACT_BOX_MIN_SHORT_PX` and
`LANDSCAPE_DRAWING_MIN_SHARE`, with `fitBox.test.ts`'s bowl cases. `DETAIL_DRAWING_TOP_PX` had
already gone in R164. The removed code read no message key of its own. `npm run check:dead`
reports nothing. `PHASE_BUDGETS` stays empty.

### 24.4 What the owner decides on this release

- [ ] **The capture base** (§24.1): accept that the diff against 2.10.0 lists every file for the
      reasons given, with the branch against `main` before R165 as FR-CLEAN-10's check of record.
- [ ] **The social preview** (FR-PUB-11): upload the re-drawn `docs/readme/social-preview.png`
      in the repository's settings.
- [ ] **F-99** stays open with §24.1's noise files, seven of them new on the home and Where.
- [ ] **`clean-sky.spec.ts`'s stars half on a Mac:** "the sheet in order with In this field open,
      … a named star" fails locally on both `main` and this branch (the list's first row "not
      stable" for `scrollIntoViewIfNeeded`) and passes on CI; the environment, recorded for a
      later spec fix.

### 24.5 The phone run (US-49)

On the release build, with the iPhone and an Android phone, and the desk. Write what each step
showed beside it.

- [ ] **The stars page upright:** the sky fills the screen; the head with the dark window's line,
      `[ follow ]` and `[ controls ]` in the corner; no passes toggle anywhere.
- [ ] **The stars page's sheet:** `[ controls ]` opens it — the view row `[Window] Whole sky`,
      `[ follow the phone ]`, the facing row, the layer toggles and `In this field`; the `×`, a
      swipe down and `Esc` close it.
- [ ] **The pass detail upright:** the countdown head with the name, the corner readout with the
      landmark, the bottom row; the sheet with the name line, the times on one row, the view row,
      follow, facing, Share, the prose and the table.
- [ ] **Turned:** both pages with the phone sideways — the sky the screen, the sheet a bottom
      sheet across it.
- [ ] **The desk at 1920:** every page at the home's width, the header's links bracketed.

### 24.6 The release itself — `v2.11.0`

- [x] `package.json` is `2.11.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R162..R166).
- [ ] §24.4's items are decided.
- [x] §24.1's two `captures.yml` runs are recorded and run 1's artefact is committed.
- [x] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §24.2's.
- [ ] §24.5's phone run is written down.
- [ ] Find the release commit: the squash merge of R165's PR (its subject starts `R165:`). Write
      it here: _(the SHA)_.
- [ ] Tag it: `git tag -a v2.11.0 <sha> -m "v2.11: one clean sky" && git push origin v2.11.0`.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §23 and this section history, as §14 was at its release.
