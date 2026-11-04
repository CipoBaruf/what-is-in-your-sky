## 21. v2.8 (spec §9 Phase 2q)

Everything above still applies, §1 to §5 included, and §20's list is run with this one if
`v2.7.0` has not been tagged yet. v2.8 is the full sky on the phone (V28-1): compact only, both
shapes, and wide unchanged. The phone's live page is all sky in every view — `[ ← ]` and the
shown time with its chip over it at the top, `[ controls ]` at the bottom-right and the hint
beside it while it fits (FR-FULL-1..3, R147, R148); `[ controls ]` opens a sheet over the bottom
of the sky (the right side when the phone is turned) with the place, `[ settings ]` and
`[ close ]` at its head and the context line, the track and the taps, the view row, the facing
row, `[ list (n) ] [ Share ]` and the list in its body; a tap on the sky or `Esc` closes it,
and nothing ever resizes the sky (FR-FULL-4..7, R147, R148). In the day the page no longer
jumps: it stays on real time and asks with a card — "Nothing visible up now.", the next pass,
`[ see next pass ]` and `[ see now ]` (FR-FULL-10, R146, R148). R149 is this section: the
capture set, what the phone stopped reading, the budget and the version. `main` reads `2.8.0`
once R149 merges; the tag, the push to `release` and the deploy are the owner's (§21.5).

### 21.1 The capture set and the diff against `b664585` (FR-FULL-9, FR-CAP-5)

The set has **414 files**: `b664585`'s 394 and 20 new; none is retired. Measured by R149 on
one Linux container: the branch's set and `b664585`'s, each shot by its own commit's
`tests/e2e/v1-captures.spec.ts` off a plain build of its own commit (`b664585` in a scratch
worktree beside the branch), in groups of screens, and compared pixel by pixel. The 38 sky
screen files (`v1-window-*`, `v1-sky-screen-*`, `v1-stars-screen-*`,
`v1-stars-passes-screen-*`) could not be shot in either run: this container's Chrome for
Testing 151 answers `DeviceOrientationEvent.requestPermission` with `prompt`, so the screen
never opens — on `b664585` as on the branch (R148's Done note). They are left as committed.
**Of the 356 both runs shot, 297 are byte-identical and 59 differ:**

- **The compact live page — 48 files, FR-FULL-9's named moves:**
  `v1-live-watching-{360,390,768,844}-*` (16), `v1-live-scrubbing-{360,390,768,844}-*` (16),
  `v1-legend-{360,390}-*` (8) and `v1-live-tonight-{360,390}-*` (8), portrait and landscape,
  every view the set shoots there (the window, which a phone opens on). The watching files are
  the sky with the sheet closed: `[ ← ] 07:23:47 now` at the top, the hint and `[ controls ]`
  at the foot, the tablet's 768 the same full form (V28-1's "compact live page"). The
  scrubbing files are the same page held and moved off real time by `next` in the sheet, then
  the sheet closed: `20:43 in 13 h 19 min` in the head. The legend files are the sheet with the
  list open and a row pressed, `[x] Hidden` in the list's head, which is where the legend is on
  the phone now. `live-tonight` keeps its name and is now the card (below).
- **The sheet and the card — 20 new files:** `v1-live-sheet-{390,844}-*` (8), the sheet open
  over the sky at `SHOWN`, its body at the top; `v1-live-sheet-list-{390,844}-*` (8), the same
  sheet with `[ list (1) ]` pressed and the body scrolled to the list; and
  `v1-live-tonight-844-*` (4), the card on the phone turned. `v1-live-tonight-{360,390}-*`
  (among the 48) are the card upright: `#live` at 13:00 local, real time, nothing played,
  "Nothing visible up now." over `SL-16 R/B (Cosmos 2369) · 20:44 · in 7 h 44 min` (cut with
  its ellipsis where the row is short), `[ see next pass ]` focused and `[ see now ]`.
- **F-99's noise — 11 wide files, nothing that moved:** `v1-legend-1280-night-es`,
  `v1-live-scrubbing-{1200,1280,2560,3840}-*` (7) and `v1-live-window-follow-1280-*-es` (2): at
  most 14 pixels at a channel step of 2, the live clocks' and the rail's edges — the files and
  the size §20.1 names.

No wide file and no other page moves. The sky screen's files were not re-shot (above); its
route answers the card with `[ see now ]` (D-937), as 2.7.0's tapped `now`, so its chip stays
the one 2.7.0 drew, and `captures.yml` is where that is read.

**Two runs of the 68 files** (FR-CAP-5), off one plain build: 63 byte-identical, and 5 of the
new sheet files a few pixels apart at a channel step of at most 2 — `v1-live-sheet-390-night-en`
(23), `v1-live-sheet-844-dark-es` (7), `v1-live-sheet-list-390-night-{en,es}` (29 each) and
`v1-live-sheet-list-844-dark-es` (10): F-99's edges, not a state. Every `live-watching`,
`live-scrubbing`, `legend` and `live-tonight` file agreed byte for byte.

**What is committed.** The 48 changed and the 20 new files as this container shot them;
every other file stays as it was on `main` (this container's renderer differs from the Mac
the committed set was shot on in every file, so a whole re-shoot would have moved them all).
The set of record is the Linux renderer's (D-732), and `captures.yml`'s run 1 replaces the 68.
`docs/readme/hero.png` and `social-preview.png` are re-drawn from the new
`v1-live-watching-390-dark-en` (`scripts/readme-hero.ts`); the README's alt text still says
what the tile shows.

The capture-spec changes change no page (D-937): the place is read off the sheet head where
there is no header; every live capture waits for the card's decision and answers it with
`[ see now ]`; `live-scrubbing` taps `next` in the sheet and closes it; `live-tonight` waits
for the card and pins the clock so its chip reads one minute.

**Seen while shooting, not this task's to change:** at 360 px in Spanish the taps row in the
sheet loses its last `]` (`[ noche ][ próximo ][ ahora`), where 2.7.0's page fitted it whole
(`v1-legend-360-*-es`).

- [ ] Dispatch `captures.yml` on the release commit with `base` `b664585`, twice: run 1
      _(id)_, run 2 _(id)_.
- [ ] Run 1 is green: **414 files** and the four design captures, no capture missing.
- [ ] Run 1's diff step lists the 48 compact live files above, the 20 new files and nothing
      else (F-99's places excepted) — the sky screen's 38 included, unchanged.
- [ ] Run 1's artefact is committed as the set, the hero is re-drawn from it, and run 2
      agrees with run 1 but for F-99's noise.

### 21.2 The budget (FR-FULL-9, D-178, D-938)

`npm run bundle:budget` on the branch, gzip level 9, beside `b664585` (2.7.0) built on the same
machine, both plain (`VITE_MOON_LORE` unset). Two rows were past what FR-FULL-9 first allowed
(D-938): `live` over its 15, and `main` 803 bytes over 2.7.0 against `FULL_MAIN_KB`'s 512, and
43 bytes past 180 KiB, which the script's one decimal prints as `180` `ok`. The owner accepted
the measure (V28-9, D-940): FR-FULL-9 is amended, `live` re-set to 20 by D-178 (× 1.1 is 16.8),
`FULL_MAIN_KB` to 1.0, and `main`'s 180 ceiling kept. The budget column is `scripts/bundle-budget.ts`'s rows;
`tests/docs/accuracy.test.ts` checks it against them:

| Chunk | gzip KB | Budget KB | `b664585` | Change |
|---|---|---|---|---|
| main | **180.0** | 180 | 179.3 | **+803 bytes** (`FULL_MAIN_KB` is 1,024 as amended) |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | +4 bytes |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 26.7 | 30 | 26.7 | −2 bytes |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | 30 | 24.1 | 0 |
| window (`SkyWindow`) | 26.7 | 30 | 26.7 | +8 bytes |
| live | **15.3** | 20 | 13.3 | **+2,062 bytes** |
| service worker | 5.0 | 10 | 5.0 | 0 |
| settings | 1.1 | 10 | 1.1 | +1 byte |

Where it came from, each merge built plainly against the one before it (bytes, `main` /
`live`): R146 and R147 together (`1d8402f`, the card's and the sheet's strings and constants)
+173 / +2; R148 (the page) +632 / +2,101; R149's removals −2 / −41. `main` grows by the
catalog's new strings and by `SkyViewLayout`'s `full` form, which the stars page and the pass
detail share, so Rollup keeps it in `main`; `live` by `ControlsSheet`, `SkyHead`,
`OpeningCard` and the card's effect, which only the lazy `Live.tsx` imports. The few-byte
moves elsewhere are the chunk hashes' names and Rollup's ordering, not code.

- [x] §21.4's first item is decided (V28-9), and the release PR carries the table as it now stands.

### 21.3 What R149 removed (FR-FULL-8, FR-FLOW-17's rule)

**No message key.** R148 took the compact top row and its mark off the page, and every string
that row read is still read elsewhere: `header.pages.live` by the page's hidden `h1` and wide's
header, `header.back` and `header.backName` by `SkyHead`, `live.state.*` by wide's indicator.
Checked against every leaf of the catalog: no key lost its last reader outside `src/i18n` between
`b664585` and the branch (the ones with no literal reader are read by index — `compass.*`,
`failure.*`, `banner.*`, `window.denied`, `window.relative`). What the row left behind is code,
removed by FR-FLOW-17's rule: `Header`'s `status` prop (no caller passes it) and the compact
branch that drew it in the page name's place; `StateIndicator`'s `word` parameter and its
`live-state-mark` form (always `true` now); `TopRow`'s `indicator` parameter (always `null`);
and `railToTop`'s export from `tests/e2e/liveHelpers.ts`, which only `enterScrubbing` reads now.
The comments that named the compact top row, its mark and its status are corrected.
`npm run check:dead` reports nothing.

### 21.4 What the owner decides on this release

- [x] **The budget** (§21.2, D-938): `live` was 15.3 KB against FR-FULL-9's 15, and `main` grew
      803 bytes against `FULL_MAIN_KB`'s 512 and stands 43 bytes past 180 KiB. Decided
      2026-10-30 (V28-9, D-940): FR-FULL-9 amended to the measure, `live` 20 by D-178,
      `FULL_MAIN_KB` 1.0, the 180 ceiling kept.
- [x] **The Spanish taps at 360 px** (§21.1): the sheet's taps row lost its last `]`. Fixed
      before the release on the owner's answer (D-939): the play glyph's 44 px floor hangs into
      the sheet's gutter, so the row is its 33 cells again.
- [ ] **F-99** stays open with §21.1's 11 files.

### 21.5 The release itself — `v2.8.0`

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.8.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R146..R149).
- [ ] §21.4's items are decided.
- [ ] §21.1's two `captures.yml` runs are recorded and run 1's artefact is committed.
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §21.2's.
- [ ] **On a phone, on the release build** (US-43): open the live page in the afternoon and
      see the whole screen sky with the card over it; tap `[ see next pass ]` and see the
      evening's first pass land and play; open `[ controls ]`, drag the track and watch the sky
      follow behind the sheet without moving; close the sheet with a tap on the sky. Turned
      sideways, the sheet at the right. At a desk, the live page as 2.7.0 had it.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R149's PR (its subject starts `R149:`), or the commit that
      lands §21.1's Linux set after it, whichever is last. Write it here: _(the SHA)_.
- [ ] Tag it: `git tag -a v2.8.0 <sha> -m "v2.8: the full sky" && git push origin v2.8.0`.
      If `v2.7.0` is not tagged yet, tag it first, as §20.5 says.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §20 and this section history, as §14 was at its release.
- [ ] Record in the release PR: the bundle table, the knip output, the two capture runs'
      numbers, and the date.
