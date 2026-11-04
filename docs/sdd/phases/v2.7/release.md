## 20. v2.7 (spec §9 Phase 2p)

Everything above still applies, §1 to §5 included, and §19's list is run with this one if
`v2.6.1` has not been tagged yet. v2.7 is tonight on the phone (V27-1): compact only, both
shapes, and wide unchanged. A phone that opens the live page with nothing up and a visible
pass in the next 24 h lands a few minutes before it and plays (FR-TONIGHT-1, FR-TONIGHT-2,
R144); one time track with its pass ticks and three taps, `tonight`, `next` and `now`, move
the shown time (FR-TONIGHT-3, FR-TONIGHT-4, R142, R144); playing runs at 60× near a pass and
600× between them and stops at the night's end (FR-TONIGHT-5, R141); and the page is one
inventory in both states — the shown time and its chip, one context line, the view row, the
drawing with the facing readout in its corner, the track, the taps and `[ list (n) ] Share`
(FR-TONIGHT-6, FR-TONIGHT-7, R143, R144). R145 is this section: the capture set, the strings
the phone stopped reading, the budget and the version. `main` reads `2.7.0` once R145 merges;
the tag, the push to `release` and the deploy are the owner's (§20.5).

### 20.1 The capture set and the diff against `3363de2` (FR-TONIGHT-10, FR-CAP-5)

The set has **394 files**: `3363de2`'s 386 and the 8 of a new compact screen,
`live-tonight`; none is retired. Measured by R145 on one Mac: the branch's set and
`3363de2`'s, each shot by its own commit's `tests/e2e/v1-captures.spec.ts` off a plain build
of its own commit (the `3363de2` tree extracted beside the branch), and compared pixel by
pixel. **Of the 386 both sets carry, 332 are byte-identical and 54 differ:**

- **The compact live page — 40 files, FR-TONIGHT-10's named moves:**
  `v1-live-watching-{360,390,768,844}-*` (16), `v1-live-scrubbing-{360,390,768,844}-*` (16)
  and `v1-legend-{360,390}-*` (8), portrait and landscape, every view the set shoots there
  (the window, which a phone opens on). Each is the page of FR-TONIGHT-6: the headline's
  shown time and chip (`07:23:47 now`; held, `20:43 in 13 h 19 min`), the context line
  (`Tiangong (Tianhe) · peaks NNE 0:08`), the view row, the drawing, the hint, the track and its
  labels, the taps and the actions row; the legend files with the panel open under it and
  `[x] Hidden` in its head. The scrubbing files are the watching page held and moved off real
  time by the reader's `next`: the evening's first pass one minute before its rise, `20:43 in
  13 h 19 min`, with the thumb on its tick and the window facing it.
- **The opening state — 8 new files, `v1-live-tonight-{360,390}-{dark,night}-{en,es}`** (FR-TONIGHT-1,
  FR-TONIGHT-2, US-42 AC1): `#live` opened at 13:00 local with nothing up, so the page has
  jumped to the evening's first pass, `20:43 tonight · in 7 h 43 min`. Shot under
  `prefers-reduced-motion: reduce`, where the jump lands paused, so the file is one instant
  and not a frame of the play. Compact only: wide never jumps.
- **F-99's noise — 13 wide files, nothing that moved:** `v1-live-scrubbing-{1024,1280,2560,3840}-*`
  (7), `v1-live-window-1280-*-es` (2), `v1-live-window-follow-1280-*-es` (2) and
  `v1-polar-1280-*` (2): at most 14 pixels at a channel step of at most 2, the live clocks' and
  the rail's right edges and a pixel of the polar chart — the files and the size §18.1 names.
- **One flake in the parent's run:** `v1-stars-passes-1280-dark-en` differed by 60,764 pixels
  in the first `3363de2` run; shot again it is byte-identical to the branch's file and to the
  committed one. The stars page is not touched by the phase.

No wide file and no other page moves. The sky screen (`v1-sky-screen-*`), whose route opens
the live page first, is byte-identical: the capture spec taps `now` where FR-TONIGHT-1's jump
would leave the capture's instant (`CHIP_SHOWN`, six minutes before a pass, is one), which is
the reader's own way back to real time.

**Two runs of the 40 compact files** (FR-CAP-5), off one plain build: 39 byte-identical, and
`v1-live-scrubbing-768-dark-es` one pixel at a channel step of 6. After the review's changes
(the scrubbing files on `next`'s instant, the 8 `live-tonight` files), two more runs of the 24
files that changed agree byte for byte, and a whole-set run moves no other file but F-99's
places and the `v1-guide-{390,768}-*` below.

**What is committed.** The 40 compact files and the 8 `live-tonight` files as the Mac shot
them; every other file stays as it was on `main`. The set of record is the Linux renderer's
(D-732), and `captures.yml`'s run 1 replaces the 48. `docs/readme/hero.png` and `social-preview.png` are re-drawn from the new
`v1-live-watching-390-dark-en` (`npx tsx scripts/readme-hero.ts`); the README's alt text
still says what the tile shows.

The capture-spec changes that made this possible change no page: the compact clock is the
headline's `shown-time` (the conditions line and its `live-time` are gone); `live-scrubbing`
on compact holds the instant by a key on the track (R144's `enterScrubbing`, which reads the
landscape rail from the top after it, as D-864 reads wide's) and then taps `next`; and every
other live capture waits for FR-TONIGHT-1's decision (the track's pass ticks drawn) before it
taps `now`, so the tap never races the jump.

`v1-guide-{390,768}-*` (8) differ between `main`'s committed set and both runs here, which
agree with each other: the committed files predate R137's turn of the window to the pass
(FR-FLOW-14). `captures.yml` on this release brings them up to date; they are not this
phase's moves.

- [ ] Dispatch `captures.yml` on the release commit with `base` `3363de2`, twice: run 1
      _(id)_, run 2 _(id)_.
- [ ] Run 1 is green: **394 files** and the four design captures, no capture missing.
- [ ] Run 1's diff step lists the 40 compact live files above, the 8 new `live-tonight` files
      and nothing else (F-99's places excepted).
- [ ] Run 1's artefact is committed as the set, the hero is re-drawn from it, and run 2
      agrees with run 1 but for F-99's noise.

### 20.2 The budget (FR-TONIGHT-10, D-178)

`npm run bundle:budget` on the branch, gzip level 9, beside `3363de2` (2.6.1) built on the same
machine, both plain (`VITE_MOON_LORE` unset). No budget moves: `main` × 1.1 is past its 180
ceiling, and `live` × 1.1 is 14.6, under its 15. The budget column is
`scripts/bundle-budget.ts`'s rows; `tests/docs/accuracy.test.ts` checks it against them:

| Chunk | gzip KB | Budget KB | `3363de2` | Change |
|---|---|---|---|---|
| main | **179.3** | 180 | 177.6 | **+1,737 bytes** (`TONIGHT_MAIN_KB` is 2,048) |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | 0 |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 26.7 | 30 | 26.7 | +3 bytes |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | 30 | 24.1 | 0 |
| window (`SkyWindow`) | 26.7 | 30 | 26.7 | −8 bytes |
| live | **13.3** | 15 | 9.7 | **+3,681 bytes** |
| service worker | 5.0 | 10 | 5.0 | −1 byte |
| settings | 1.1 | 10 | 1.0 | +8 bytes |

Where it came from, each merge built plainly against the one before it (bytes, `main` /
`live`): R141 (the targets and the speed) +30 / +672, R143 (the words) +1,001 / −401, R142 (the
track) +72 / +1, R144 (the page) with R145's removals +634 / +3,409. `main` grows by the
catalog's new strings, `usePlayback`'s automatic rate and `SkyViewLayout`'s corner readout;
`live` by `TimeTrack`, `TimeTaps`, `ShownTime` and `tonightJump.ts`, which only the lazy
`Live.tsx` imports, so Rollup puts them in its chunk — where FR-TONIGHT-10, as amended by
V27-9, says they are. The few-byte moves elsewhere are the
chunk hashes' names and Rollup's ordering, not code.

- [ ] The release PR carries this table.

### 20.3 What R145 removed (FR-TONIGHT-8, FR-FLOW-17's rule)

The strings FR-TONIGHT-6 took off compact that no wide row reads, both languages, with their
lines in `messages.test.ts` and its snapshot: `live.timeLabel`, `live.countSpoken`,
`live.skyShort`, `live.cloudWord` (the compact conditions line's; the context line's is
`live.context.cloudWord`), `live.upCount`, `live.scrub` and `live.backToLiveShort`; and three
that had no reader in 2.6.1 either, `live.openFromNow`, `live.landmarkWord` (the landmark line
keeps its words in the catalog's own constant) and the whole `passes.fields` group. With them
the code that read them and never renders any more: `StatusStrip`'s compact branch, its
`t` and `timeZone` props and its `data-compact` attribute; `PlaybackControls`' compact glyphs
and bracketed speeds; `ScrubButton`'s compact label; `BackToLive`'s `short`; and the two
compact rows `controlRows.test.ts` pinned for them (the conditions line and the playback row).
`live.cloudSpoken`, `live.playShort`, `live.pauseShort` and `live.hiddenShort` stay: the
context line, the taps and the list panel's head read them. `npm run check:dead` reports
nothing; `rg` over `src` outside `src/i18n` finds no reader of a removed key.

### 20.4 What the owner decides on this release

- [x] **`live` grew 3.6 KB** (§20.2) — settled by V27-9: the track, the taps, the shown time
      and the jump are the lazily-loaded `live` chunk's (13.3 KB, under 15), and FR-TONIGHT-10
      is amended to say so. Moving them into `main` would have taken it to about 183 KB, over
      the 180 ceiling.
- [ ] **The landscape phone's rail scrolls** (`v1-live-watching-844-*`): at 844 × 390 the
      headline, the context line, the view row and the facing row fill the rail, and the track's
      labels, the taps and `[ list (n) ] Share` are under its fold. FR-TONIGHT-6 lays the same
      slots in the rail (FR-FLOW-15) and the rail scrolls (D-864), so this is as specified; the
      owner may want the taps in reach without a scroll.
- [ ] **The held chip in the morning says `tonight`** (seen while R145 shot the set; the
      scrubbing files now hold `next`'s instant): at 07:23 in Bariloche the morning's dark band
      still counts as tonight's night band (FR-TONIGHT-7's rule, D-911), so a held chip reads
      `07:23 tonight · in <1 min`. As specified; a finding only
      if the owner reads "tonight" as the coming evening.
- [ ] **F-99** stays open with §20.1's 13 files.

### 20.5 The release itself — `v2.7.0`

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.7.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R141..R145).
- [ ] §20.4's items are decided.
- [ ] §20.1's two `captures.yml` runs are recorded and run 1's artefact is committed.
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §20.2's.
- [ ] **On a phone, on the release build** (US-42): open the live page in the afternoon and
      see tonight's first pass land and play; drag the track to the small hours and watch the
      drawing follow; tap `next`, then `now`, and see the chip say `now` and stay there.
      Turned sideways, the same rows in the rail. At a desk, the live page as 2.6.1 had it.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R145's PR (its subject starts `R145:`), or the commit that
      lands §20.1's Linux set after it, whichever is last. Write it here: _(the SHA)_.
- [ ] Tag it: `git tag -a v2.7.0 <sha> -m "v2.7: tonight on the phone" && git push origin v2.7.0`.
      If `v2.6.0` or `v2.6.1` is not tagged yet, tag them first, as §18.5 and §19.4 say.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §19 and this section history, as §14 was at its release.
- [ ] Record in the release PR: the bundle table, the knip output, the two capture runs'
      numbers, and the date.
