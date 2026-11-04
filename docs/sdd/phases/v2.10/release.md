## 23. v2.10 (spec §9 Phase 2s)

Everything above still applies, §1 to §5 included, and §22's list is run with this one if
`v2.9.0` has not been tagged yet. v2.10 is the phone first (V210-1..V210-11): on a phone the
page's own sky follows the phone by default — at the first reading where nothing is asked, and
from a grant saved on the first allow and asked again at the first tap's lift on iOS — with
`[ follow ]` beside `[ controls ]`, the facing readout in the sky's corner while the finger has
it, and the hint in two touch clauses (FR-PHONE-1..6, R157, R159); the whole sky with every star
is one tap (`[Window] Whole sky` on the stars page) or one pinch away, the polar chart drawing
the figures and the names with the window's field outlined on it, moving with the phone while
following (FR-PHONE-7..11, R158, R160); the home's doors come first, a ready Where folds to
`[ details ]`, the third door is "Live sky", the pass detail's times are one row and the theme
can be Auto (FR-PHONE-12..15, R156); and the window's sky has a surface, a horizon band, a
twilight tint, the Milky Way as a haze, `*` to 2.5 and dots below in four tones, a bloom, the
Moon's phase and detail that follows the field from a second catalogue chunk (FR-LOOK-1..11,
R154, R155). R161 is this section: the capture set, what nothing reads any more, the budget, the
version and the owner's phone run. `main` reads `2.10.0` once R161 merges; the tag, the push to
`release` and the deploy are the owner's (§23.6).

### 23.1 The capture set and the diff against `95f3c88` (FR-PHONE-16, FR-LOOK-12, FR-CAP-5)

The set has **420 files**: `95f3c88`'s 384 and 36 new; nothing is removed. Measured by R161 on
one Linux container: the branch's set and `95f3c88`'s, each shot by its own commit's
`tests/e2e/v1-captures.spec.ts` off a plain build of its own commit (`95f3c88` checked out into a
scratch worktree), and compared pixel by pixel. **Of the 384 files both runs shot, 56 are
byte-identical, 22 differ only by F-99's noise, and 306 moved, every one a named move of
FR-PHONE-16 or FR-LOOK-12:**

- **Every compact live capture — 72 files, FR-PHONE-16's and FR-LOOK-12's named move** (the
  bottom row `[ follow ] [ controls ]`, the corner readout, the touch hint in two clauses, and the
  window's new sky the phone opens on): `v1-live-watching-{360,390,768,844}-*` (16),
  `v1-live-scrubbing-{360,390,768,844}-*` (16), `v1-live-tonight-{360,390,844}-*` (12),
  `v1-live-sheet-{390,844}-*` (8), `v1-live-sheet-list-{390,844}-*` (8),
  `v1-live-following-390-*` (4) and `v1-legend-{360,390}-*` (8). The files at 360 and 390 are
  shot as a touch phone now (D-966); 768 and 844 move with the window's look alone.
- **The stars page at every width — 40 files** (the view row `[Window] Whole sky`, and the window's
  look with the deep stars and the field's detail): `v1-stars-{360,390,844,1280,1920}-*` (20),
  `v1-stars-passes-{360,390,1280}-*` (12), `v1-stars-following-390-*` (4) and
  `v1-stars-zoom-1280-*` (4).
- **Every polar capture — 12 files** (the figures, the names, the surface and the band, the Moon's
  disc): `v1-polar-{360,390,1280}-*`.
- **The home at every width — 104 files** (the doors first, the folded line, "Live sky"):
  `v1-home-{360,390,768,1024,1280,1920}-*` and their `-view` twins (48),
  `v1-home-{up-now,no-pass,daylight}-{360,390,1280,1920}-*` (48) and
  `v1-where-opened-{360,390}-*` (8).
- **The pass detail — 40 files:** at compact widths the times row
  (`v1-guide-{360,390,768,844}-*`, 16; `v1-guide-window-{360,390}-*`, 8, with the window's look);
  at 1024 and 1280 (`v1-guide-{1024,1280}-*`, 8) only the home's third door beside the open
  pass, "Live sky" where "Both · live sky" was — the dome itself does not move; and
  `v1-guide-window-{1280,1920}-*` (8) the window's look.
- **The settings page — 26 files** (the third option, `Theme [x] Dark [ ] Night [ ] Auto`):
  `v1-settings-{360,390,768,1280}-*` (16; at 360 the page is 4 px taller in English and 28 in
  Spanish, the row wrapping) and `v1-favourites-{360,390,1280}-*` (10, the same page scrolled to
  its places, the theme row in view; the two Spanish files at 360 keep it out and are unchanged).
- **The window with stars on, wide — 12 files** (FR-LOOK-12): `v1-live-window-{1280,1920}-*` (8)
  and `v1-live-window-follow-1280-*` (4).
- **New — 36 files**, both themes and languages: `v1-stars-whole-{390,1280}-*` and
  `v1-stars-whole-passes-{390,1280}-*` (16, the whole sky with `[ passes ]` off and on),
  `v1-stars-whole-following-390-*` (4, the outline while following), `v1-guide-short-390-*` (4,
  the pass detail at 390 × 667), `v1-live-twilight-{390,1280}-*` (8, the live page's window at
  civil twilight) and `v1-stars-zoom-390-*` (4, the stars page at 20° on the phone) (D-993).

**The dome's captures are unchanged:** `v1-live-watching-{1200,1280,1920,2560,3840}-*` are
byte-identical, and every other wide live file (`v1-live-watching-1024-dark-en`,
`v1-live-scrubbing-{1024,1200,1280,1920,2560,3840}-*`, 18, `v1-legend-1280-*`, 3) differs from
`95f3c88`'s only by F-99's few pixels; on the wide pass detail the dome's pixels are identical and
only the door beside it moved. The location, shortcuts and the rest are byte-identical.

**Two runs of the 420 files** (FR-CAP-5), off one plain build: 399 byte-identical and 21 apart.
19 are F-99's edges, as in §22.1: the wide live files' (`v1-live-scrubbing-*`, 11;
`v1-live-watching-1024-*`, 2; `v1-live-window-1280-dark-es`; `v1-live-window-follow-1280-night-es`;
`v1-legend-1280-dark-es`; 3 to 28 pixels at a step of at most 2) and the sheet's
(`v1-live-sheet-list-*`, 3, 6 to 31 pixels at a step of 1); among the wide ones, the mark's bead at a step of
189 in `v1-live-scrubbing-1920-night-*`, 14 to 28 pixels, which differs between the branch's two
runs as it does from `95f3c88`'s. **Two are new:** `v1-stars-whole-following-390-night-*`, 65 and
67 pixels at a step of at most 19, two faint hairlines in the disc's lower left. Re-shot eight
times, that screen's files fall in one of two states each (up to three of the four differ from
one run to the next); the outline's path is the same string in every run and the capture waits
for it to hold still across half a second of readings, so it is the raster of the same drawing,
F-99's kind, and is recorded with it. Run 2 also lost one capture to `captureSeeds.ts`'s
`seedPage` race (`clock.pauseAt`: "Cannot fast-forward to the past", R153's follow-up), shot
again alone.

**What is committed.** The 306 moved and the 36 new files as this container shot them (run 1);
every other file stays as it was on `main`. The set of record is the Linux renderer's (D-732),
and `captures.yml`'s run 1 replaces it. The README hero keeps its three tiles' files, whose
pictures moved, so it is re-drawn from run 1's set with it (§23.4); `scripts/readme-hero.ts` is
unchanged.

The capture-spec changes change no page (D-993): `captureSet.ts` gains the six screens and
`height`; `v1-captures.spec.ts` gains their routes (`Whole sky` clicked in the stars page's view
row and the polar chart's marks and outline waited for; following tapped under
`stubOrientation` before the whole sky; the pass detail opened at its height; the live page at
07:45 local on the window, its surface `data-tint="twilight"`) and treats the stars page's new
screens as the touch phone `stars` is at 390.

- [ ] Dispatch `captures.yml` on the release commit with `base` `95f3c88`, twice: run 1
      _(id)_, run 2 _(id)_.
- [ ] Run 1 is green: **420 files** and the four design captures, no capture missing.
- [ ] Run 1's diff step lists the 306 files above and the 36 new ones, and nothing else (F-99's
      places excepted).
- [ ] Run 1's artefact is committed as the set, the hero and the social preview are re-drawn
      from it, and run 2 agrees with run 1 but for F-99's noise.

### 23.2 The budget (FR-PHONE-16, FR-LOOK-12, D-178, D-994)

`npm run bundle:budget` on the branch, gzip level 9, beside `95f3c88` (2.9.0) built on the same
machine, both plain (`VITE_MOON_LORE` unset). D-178 re-sets three rows — `stars` up, `window`
down, `stars-deep` in from `PHASE_BUDGETS` — and `main` is over its ceiling, which is the owner's
(§23.4). The budget column is `scripts/bundle-budget.ts`'s rows; `tests/docs/accuracy.test.ts`
checks it against them:

| Chunk | gzip KB | Budget KB | `95f3c88` | Change |
|---|---|---|---|---|
| main | **180.3** | **185** | 176.6 | **+3,824 bytes** |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | −14 bytes |
| stars-deep (`deep`) | 41.8 | **50** | — | new, 42,772 bytes |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 29.2 | **35** | 26.0 | +3,198 bytes |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | 30 | 24.1 | −1 byte |
| live | 15.8 | 20 | 15.6 | +182 bytes |
| window (`SkyWindow`) | 13.1 | **15** | 26.1 | −13,355 bytes |
| service worker | 5.0 | 10 | 5.0 | +21 bytes (the `sw` file) |
| settings | 1.1 | 10 | 1.1 | +44 bytes |

Where it came from. **`main`** grew 3.8 KB across the phase, as the tasks measured it on their
own boxes: 176.6 → 177.8 KB before R158 (R156's theme rule by the Sun, inside FR-PHONE-16's
0.5, the home's order and the times row, R157's and R159's code that the shell imports, and the
phase's strings in both catalogs), +0.7 for `SkyPolar`'s wrappers for the star map (R158), and
+0.4 for `SkyChart`'s held and controlled view and the handoff (R160); R161's removed key gives
back 10 bytes. FR-LOOK-12 says `main` does not grow, and D-178 would make the row 200, past the
180 ceiling only the owner moves. **`stars`** grew 3.1 KB with
the catalogue's `bv` column, the haze outline (1.7 KB, inside FR-LOOK-12's 2) and the view row.
**`window`** halved because what it shares with the polar chart moved into a chunk the two load
(the sensor's hooks, the magnetic model, `MoonDisc` and the projection, D-988, D-992): the
window page now loads `SkyWindow` 13.1, the shared chunk 12.9, the constellation table it shares
with the stars page 4.5, `field` 2.2 and `camera` 1.2 — **33.9 KB against 2.9.0's 28.7** (its
`SkyWindow`, `camera` and two `starGlyphs` chunks), the look's +5.2 KB. Those shared chunks and
the polar chart's own (`PolarStars`, 0.8 → 5.3 KB with the figures, the names, the surface, the
haze, the bloom, the Moon's disc, the outline and the pinch) are lazy and unbudgeted, as every
shared chunk is. The few-byte moves elsewhere are the chunk hashes' names and Rollup's ordering.

- [x] §23.4's first item is decided (2026-11-02, V210-16: 185), and the table above is the script's.

### 23.3 What R161 removed (FR-PHONE-16, FR-FLOW-17's rule)

**One message key, and no code.** `window.skyHint.star.coarse` ("tap a star" / "tocá una
estrella") lost its last reader when R157 made the touch hint two clauses (FR-PHONE-5); it leaves
both catalogs, and the two tests that named it read the words instead (`SkyHint.test.tsx`
asserts the touch line never carries them, and `layout.test.ts`'s window line on touch is the
two clauses the app draws). Every other read the phase removed was checked: the folded Where's
`whereFold` and the third door's `both` left the catalogs with their readers in R156, and the
rest (`chart.viewPrefix`, `window.followToggle`, the `live` door's lines) are read. `npm run
check:dead` reports nothing. `scripts/bundle-budget.ts`'s `PHASE_BUDGETS` is left empty for the
next phase.

### 23.4 What the owner decides on this release

- [x] **The `main` budget** (§23.2, D-994; decided 2026-11-02, V210-16, D-995: the measure accepted, the ceiling and the budget 185): `main` is 180.3 KB against 2.9.0's 176.6
      (+3,824 bytes), 0.3 KB over the 180 ceiling V26-14 set and V28-9 and V29-10 kept.
      Either accept the measure and raise the ceiling and the budget to 185, the next 5 KB
      line (D-178's × 1.1 would be 200), as V25-20 and V26-14 did; or cut a task that takes
      about 0.4 KB out of `main` (the polar chart's wrappers into its own chunk, or the
      handoff's state into the window's). Until then the build warns and nothing moves.
- [ ] **FR-LOOK-10's three strengths** (OQ-52): `BLOOM_STRENGTH` 0.7, `MILKY_WAY_STRENGTH`
      0.6 and `HORIZON_STRENGTH` 0.6 are the mockup's second cut and final only after §23.5's
      phone run, in the dark on the OLED screen in both themes. Keep them, or re-set them by
      one Decision Log row (V210-11's form) and a one-line change to the constants and their
      test.
- [x] **FR-FLOW-8's fold** (R160, D-990; decided 2026-11-02, V210-17: amended as proposed): with the stars page's view row (54 px) and the box at
      FR-COMP-5's floor, `In this field`'s first row ends 28.5 px (English) and 52.5 px
      (Spanish) under the fold at 390 × 844, so "the heading of `In this field` and its first
      row are inside the viewport" cannot hold. Proposed: amend FR-FLOW-8 to "the heading
      inside the viewport and the first row within one row's height under the fold", which is
      what `sky-layout.spec.ts` now pins; or cut the box under its floor.
- [ ] **The hero** (D-993): its three tiles keep their files and their pictures move with the
      set (the live page's touch overlay, the stars page's view row and look, the window's
      look); re-draw the hero and the social preview from run 1's set and upload the preview
      (FR-PUB-11).
- [ ] **F-99** stays open with §23.1's noise files.

Three things R161 checked and records, none of them this release's to change:

- `moon.spec.ts`'s "the conditions table carries the Moon's facts…" fails on a plain local build
  and passes on CI: it asserts the `[lore]` region, which only a build with
  `VITE_MOON_LORE=on` draws, and `ci.yml` builds with it. With the flag on it passes here (3 of
  3); the environment, not the app — the spec has no skip for a plain build (a follow-up for
  the spec, not this release).
- `starGlyphs.ts`'s `GLYPH_SIZES` still measures the old ladder's `+` and `.`, which nothing
  draws since R158 and R160; only the ink map's Chromium test reads them — a cleanup for a
  `window` task, with the test moved onto the marks.
- The window's and the polar chart's two-pointer bookkeeping (`SkyWindow`'s pinch and
  `PolarPinch`, R160) are two copies of one tracker — a cleanup for a later phase, not a change
  this release makes.

### 23.5 The phone run (FR-LOOK-12, US-45..US-48)

On the release build, before the tag, with the iPhone and an Android phone. Write what each
step showed beside it; the last item is written in words, not ticked (FR-LOOK-12).

- [ ] **Android, at once** (FR-PHONE-1): open the live page from a clean visit. The sky follows
      the phone from the first reading, with no tap and nothing asked; a drag hands it to the
      finger, and `[ follow ]` gives it back.
- [ ] **iOS, the first allow** (FR-PHONE-2): on a clean visit nothing follows and nothing is
      asked at load; `[ follow ]` asks for motion once — allow it, and the sky follows.
- [ ] **iOS, a later visit** (FR-PHONE-2, V210-15): open the live page again. Nothing is asked
      at load; the first tap on the sky asks inside its lift and following starts; a drag or a
      pinch first asks nothing. Refuse once on another visit: one line says so, and the finger
      keeps the sky.
- [ ] **`[ follow ]` beside `[ controls ]`** (FR-PHONE-3, FR-PHONE-4): on the bottom row,
      pressed while following and bare while not; the refusal line, when there is one, on the
      row above it; while the finger has the sky the facing readout in the corner.
- [ ] **The hint whole** (FR-PHONE-5): "Drag to look · pinch to zoom" (or the follow clause on
      the live page) on one line in English, the Spanish broken between its two clauses, no
      ellipsis, at the phone's width.
- [ ] **The stars page's `Whole sky`** (FR-PHONE-7..9): `[Window] Whole sky` under the heading;
      tap `Whole sky` — every star, the figures, the window's field outlined; turn the phone
      while following and the outline moves with it; drag on the window, come back, and the
      outline is the hand's.
- [ ] **The pinch across and back** (FR-PHONE-10): on the window, pinch out past the widest
      field — the whole sky; on it, pinch in on a spot — the window facing that spot, at its
      widest field, following off until asked.
- [ ] **The home's doors first** (FR-PHONE-12, FR-PHONE-13): the three doors before the Where
      reading, the Where folded to the place and `[ details ]`, the third door "Live sky".
- [ ] **Auto at dusk** (FR-PHONE-15): Theme Auto in settings; at sunset the page turns to the
      night theme at the Sun's step, and back at dawn, with no flash.
- [ ] **In the dark on the OLED screen** (FR-LOOK-1..7, FR-LOOK-12), eyes adapted, at 60° and
      at 20° in both themes: the surface a shade off the page and not grey, the horizon band,
      the haze (a sky and not full white), the bloom under the brightest, the four tones, the
      Moon's phase on the right side. Written here: _(what it looked like, theme by theme)_.
- [ ] **The rate at 20°** (FR-LOOK-11): on the stars page at 20° with every layer on, drag
      steadily: the stars keep up with the finger. Written here: _(smooth or not, and where)_.
      FR-LOOK-10's constants are final after this run and not before (§23.4).

### 23.6 The release itself — `v2.10.0`

Owner steps, in this order, and none of them belong to a task session:

- [x] `package.json` is `2.10.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R154..R161).
- [ ] §23.4's items are decided.
- [ ] §23.1's two `captures.yml` runs are recorded and run 1's artefact is committed.
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §23.2's.
- [ ] §23.5's phone run is written down.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R161's PR (its subject starts `R161:`), or the commit that
      lands §23.1's Linux set after it, whichever is last. Write it here: _(the SHA)_.
- [ ] Tag it: `git tag -a v2.10.0 <sha> -m "v2.10: the phone first" && git push origin v2.10.0`.
      If `v2.9.0` is not tagged yet, tag it first, as §22.5 says.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §22 and this section history, as §14 was at its release.
- [ ] Record in the release PR: the bundle table, the knip output, the two capture runs'
      numbers, and the date.
