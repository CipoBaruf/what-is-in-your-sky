## 22. v2.9 (spec §9 Phase 2r)

Everything above still applies, §1 to §5 included, and §21's list is run with this one if
`v2.8.0` has not been tagged yet. v2.9 is follow the phone (V29-1): where the phone has a
motion sensor, `[ follow the phone ]` turns the page's own sky with the phone on the live page
(in the sheet, after the view row, and in wide's `View` group), the stars page and the pass
detail (in the action slot where `[ hold up to the sky ]` stood); the tap asks for motion once,
a refusal is one line under the toggle, and a drag or a key hands the sky back to the finger
(FR-GYRO-1..5, R151, R152). The sky screen and its compass gutter are retired (FR-GYRO-6, R152).
The controls sheet is a bottom sheet upright and sideways, closes with a `×` or a swipe down,
and ends with "Satellites (n)" and the list open; the view row lists the window first on every
page and width (FR-GYRO-7, FR-GYRO-8, FR-GYRO-10, FR-GYRO-11, R150). R153 is this section: the
capture set, what nothing reads any more, the budget and the version. `main` reads `2.9.0` once
R153 merges; the tag, the push to `release` and the deploy are the owner's (§22.5).

### 22.1 The capture set and the diff against `c996ba3` (FR-GYRO-9, FR-CAP-5)

The set has **384 files**: `c996ba3`'s 414, less the sky screen's 38, and 8 new; no screen is
marked retired any more. Measured by R153 on one Linux container: the branch's set and
`c996ba3`'s, each shot by its own commit's `tests/e2e/v1-captures.spec.ts` off a plain build of
its own commit (`c996ba3` extracted into a scratch directory), in groups of screens, and compared
pixel by pixel. **Of the 376 files both runs shot, 228 are byte-identical and 148 differ, every
one a named move of FR-GYRO-9 or FR-GYRO-11:**

- **The window first in the view row — 108 files, FR-GYRO-11's named move** (`[Window] Polar Dome`
  on compact, `Window Polar [Dome]` in wide's `View` group, the chosen view in brackets as before):
  `v1-guide-{360,390,768,1280}-*` (16), `v1-polar-{360,390,1280}-*` (12),
  `v1-guide-window-{360,390,1280,1920}-*` (16), `v1-legend-1280-*` (4),
  `v1-live-watching-{1024,1200,1280,1920,2560,3840}-*` (24),
  `v1-live-scrubbing-{1024,1200,1280,1920,2560,3840}-*` (24), `v1-live-window-{1280,1920}-*` (8)
  and `v1-live-window-follow-1280-*` (4). Each differs in the row's own box, 1,342 to 1,495
  pixels; nothing else on those pages moved. `v1-guide-{844,1024}-*` keep the row out of the
  viewport and are unchanged.
- **The compact live sheet — 24 files, FR-GYRO-9's named move:** `v1-live-sheet-{390,844}-*`
  (8), `v1-live-sheet-list-{390,844}-*` (8) and `v1-legend-{360,390}-*` (8). The sheet has the `×`
  at its head; the view row reads `[Window] Polar Dome`; `[ ] follow the phone` is the row after
  it (these files are now shot on a touch phone, D-960); the sheet ends with `Satellites (1)` and
  the list open, `[ ] Hidden` at the heading's end; at 844 × 390 it is the bottom sheet across the
  phone turned, 0.70 of its height. `live-sheet-list` keeps its name and is the same sheet
  scrolled to its satellites, since there is no `[ list (n) ]` to press (FR-GYRO-10).
- **The toggle where hold-up was — 16 files, FR-GYRO-9's named move:** `v1-stars-{360,390}-*` and
  `v1-stars-passes-{360,390}-*`: `[ ] follow the phone` in the action slot under the hint.
  `v1-stars-844-*` keep the slot below the rail's fold and are unchanged; the pass detail has no
  touch capture in the set (`guide` is a desk's, or a phone's without touch), and its toggle is
  R152's `r152-detail-390-*`.
- **Following — 8 new files:** `v1-live-following-390-*` (4), the live page after
  `[ follow the phone ]` in the sheet and the sheet closed by its `×`, the sky the window turned
  by a stubbed reading with nothing over it; and `v1-stars-following-390-*` (4), the stars page
  with `[x] follow the phone` and the window following, no readout. Both are shot under
  `stubOrientation` (D-946), the readings aimed where the window already looked (D-960).
- **The sky screen — 38 files removed:** `v1-window-844-*` (4), `v1-sky-screen-sky-844-*`,
  `-chip-844-*`, `-ground-844-*` and `-buried-844-*` (16), `v1-sky-screen-portrait-{360,390}-*`
  (8), `v1-sky-screen-turned-{360,390}-dark-en` (2), `v1-stars-screen-844-*` (4) and
  `v1-stars-passes-screen-844-*` (4) (FR-GYRO-6, FR-GYRO-9; D-958).

No other file moved: the home, the settings page, the Where, the compact live page with its sheet
closed (`live-watching`, `live-scrubbing` and `live-tonight` at 360, 390, 768 and 844), the wide
stars page and the zoom are byte-identical to `c996ba3`'s. No file moved by F-99's noise alone:
the wide live files that carried it in §21.1 all move with the view row.

**Two runs of the 156 files** (FR-CAP-5), off one plain build: 132 byte-identical, and 24 a few
pixels apart at a channel step of at most 2 — `v1-live-scrubbing-{1024,1200,1280,1920,2560}-*`
(11 files, 3 to 14 pixels), `v1-live-watching-{1024,1280}-*` (3), `v1-live-window-1280-dark-es`,
`v1-live-window-follow-1280-*-es` (2) and `v1-legend-1280-night-en` (6 each), and the sheet's
`v1-live-sheet-*` and `v1-live-sheet-list-*` (6 files, 2 to 23 pixels at a step of 1): F-99's
edges, the live clocks' and the rail's, not a state. All eight following files agreed byte for
byte. Each run also lost one capture to a pre-existing race in `captureSeeds.ts`'s `seedPage`
(`clock.pauseAt`: "Cannot fast-forward to the past", before the page loads), on `c996ba3` as on the
branch; the one capture was shot again alone.

**What is committed.** The 148 changed and the 8 new files as this container shot them, and the
38 removed; every other file stays as it was on `main` (184 of the unchanged files differ between
this container's renderer and the committed ones, which were shot elsewhere, and are not
committed). The set of record is the Linux renderer's (D-732), and `captures.yml`'s run 1
replaces it. `docs/readme/hero.png` and `social-preview.png` are re-drawn
(`scripts/readme-hero.ts`) with `v1-stars-844-dark-en` as the second tile where the retired
`v1-sky-screen-sky-844-dark-en` was (D-960); the README's alt text says what the tile shows.

The capture-spec changes change no page (D-960): `isTouch` takes the compact live sheet files
and the two following screens; every touch capture installs `stubOrientation`, granting and
reading nothing until a following capture sets its readings, which also keeps the desk browser's
own all-`null` event off the page; the sheet's satellites are scrolled to rather than opened. The
older gated specs that pressed `[ list (n) ]` (`r71`, `r144`, `r148`) open the sheet and scroll
to its satellites instead; `r71`'s empty list is the day's (the card's `[ see now ]`), and `r144`'s
jump is the card's `[ see next pass ]`, with its view and facing rows opened in the sheet. All 26
of their cases pass.

- [ ] Dispatch `captures.yml` on the release commit with `base` `c996ba3`, twice: run 1
      _(id)_, run 2 _(id)_.
- [ ] Run 1 is green: **384 files** and the four design captures, no capture missing.
- [ ] Run 1's diff step lists the 148 files above, the 8 new files and the 38 removed, and
      nothing else (F-99's places excepted).
- [ ] Run 1's artefact is committed as the set, the hero is re-drawn from it, and run 2
      agrees with run 1 but for F-99's noise.

### 22.2 The budget (FR-GYRO-9, D-178, D-961)

`npm run bundle:budget` on the branch, gzip level 9, beside `c996ba3` (2.8.0) built on the same
machine, both plain (`VITE_MOON_LORE` unset). FR-GYRO-9 says no row may grow, since retiring the
screen takes its code out of the live, stars and detail chunks. One row grew: `live`, by 349
bytes. R153 changed no code and no budget for it (D-961); the owner accepted the measure (V29-10): FR-GYRO-9 is amended, and `live` stays inside its budget of 20. The budget
column is `scripts/bundle-budget.ts`'s rows; `tests/docs/accuracy.test.ts` checks it against them:

| Chunk | gzip KB | Budget KB | `c996ba3` | Change |
|---|---|---|---|---|
| main | 176.6 | 180 | 180.0 | −3,507 bytes |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | −1 byte |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 26.0 | 30 | 26.7 | −631 bytes |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | 30 | 24.1 | +1 byte |
| window (`SkyWindow`) | 26.1 | 30 | 26.7 | −592 bytes |
| live | **15.6** | 20 | 15.3 | **+349 bytes** |
| service worker | 5.0 | 10 | 5.0 | +2 bytes (the `sw` file) |
| settings | 1.1 | 10 | 1.1 | −2 bytes |

Where it came from: the screen's code (`components/screen/**`, the gutter, the window's chip,
probe, headline and advice) and its strings left `main`, `stars` and `window`; `live` lost the
screen's hook too, but gained R150's sheet code — the `×`, the swipe with its speed reading, the
open satellites' head — and R152's toggle row, which only the lazy `Live.tsx` imports (R152
measured `live` at 15.6 on its branch, PLAN D-957). The few-byte moves elsewhere are the chunk
hashes' names and Rollup's ordering, not code. `live` is inside its budget of 20 (D-940); the
question is FR-GYRO-9's "no row may grow", not the budget.

- [ ] §22.4's first item is decided, and the release PR carries the table as it then stands.

### 22.3 What R153 removed (FR-GYRO-9, FR-FLOW-17's rule)

**No message key, and no code.** R152 removed the screen's and the gutter's strings in both
catalogs (`chart.screenClose`, `starsPage.holdUp`, `window.turnAdvice`, `window.emptyField`,
`window.emptySky`, `window.gutterLabel`, `window.gutterMark`) and R150 `live.list`; every read
of a message the code removed between `c996ba3` and the branch was checked, and each key that is
left has a reader outside `src/i18n` (`window.hint`, `window.ground`, `window.buried`,
`window.waiting` by `SkyWindow`, `chart.liveLabel` by `SkyChart`, `sheet.close` by the `×`;
`window.denied` and `window.relative` by index). `npm run check:dead` reports nothing. What R153
took out is the capture set's: the nine retired screens and their `retired` mark in
`tests/e2e/captureSet.ts`, the 38 files (§22.1), and the README hero's tile from them.

### 22.4 What the owner decides on this release

- [x] **The budget** (§22.2, D-961): `live` is 15.6 KB against 2.8.0's 15.3 (+349 bytes, inside
      its budget of 20), where FR-GYRO-9 said no row may grow. Decided 2026-10-31 (V29-10):
      FR-GYRO-9 amended to the measure; `live` × 1.1 is 17.2, so D-178 keeps 20 and nothing in
      the script moves.
- [ ] **The hero's second tile** (D-960): `v1-stars-844-dark-en`, the stars page on the phone
      turned, in the retired screen's place; and upload the new social preview (FR-PUB-11).
- [ ] **F-99** stays open with §22.1's noise files.

### 22.5 The release itself — `v2.9.0`

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.9.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R150..R153).
- [ ] §22.4's items are decided.
- [ ] §22.1's two `captures.yml` runs are recorded and run 1's artefact is committed.
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §22.2's.
- [ ] **On the iPhone, on the release build** (US-44): open the live page, open
      `[ controls ]`, tap `[ follow the phone ]` and allow motion; close the sheet and turn:
      the sky follows the phone, with no readout, chip or note over it. Drag the sky: following
      stops and the sky stays where the phone last pointed, under the finger. Open the controls
      again and close the sheet with the `×`, then open them and close them with a swipe down on
      the head. Turned sideways, the sheet rises from the bottom too. The view row reads
      `[Window] Polar Dome`, and the sheet ends with "Satellites (n)" and the list open. Then
      open the stars page and tap its `[ follow the phone ]` in the action slot: the stars
      follow the phone; a drag hands them back. At a desk, no toggle anywhere.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R153's PR (its subject starts `R153:`), or the commit that
      lands §22.1's Linux set after it, whichever is last. Write it here: _(the SHA)_.
- [ ] Tag it: `git tag -a v2.9.0 <sha> -m "v2.9: follow the phone" && git push origin v2.9.0`.
      If `v2.8.0` is not tagged yet, tag it first, as §21.5 says.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §21 and this section history, as §14 was at its release.
- [ ] Record in the release PR: the bundle table, the knip output, the two capture runs'
      numbers, and the date.
