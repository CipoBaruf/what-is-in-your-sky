## 25. v2.12 (spec §9 Phase 2u)

Everything above still applies, §1 to §5 included, and §24's list is run with this one where
`v2.11.0` was not yet marked history. v2.12 is the globe (V212-1..V212-10): on a desk the stars
page's view row reads `[ Window ] Globe` and the whole sky is the celestial sphere seen from
outside — every star and figure of both hemispheres, the shown place's horizon with the ground
side shaded and dimmed, the zenith, N E S W, the poles, the Sun, the Moon and the planets — with
its own time, its turn, its places, the faint stars and the list in the rail (FR-GLOBE-1..17,
R167, R169, R170). The phone is unchanged: the compact stars page keeps `Whole sky` as the polar
chart and never asks for the globe's chunk. R171 is this section: the captures, the budget, the
version and the owner's desk run. `main` reads `2.12.0` once R171 merges.

### 25.1 The capture set and the diff against `8413d978` (FR-GLOBE-18, FR-CAP-5)

The set has **436 files**: 2.11.0's 416, less `stars-whole` at 1280 (4), which the globe took
the place of on a desk, plus the globe's five screens, all desk screens at the set's instant over
Bariloche in both themes and languages (24): `stars-globe` at 1280 × 800 and 1920 × 1080 as it
opens, turning with you (8); `stars-globe-stars` at 1280, turning with the stars (4);
`stars-globe-faint` at 1920, the faint stars on (4); `stars-globe-place` at 1280, the seeds' saved
London pressed — London's horizon, the south the ground side, the clock in London's zone at the
same instant (4); and `stars-globe-named` at 1280, the first row of `Up from Bariloche` (Sirius)
pressed, which names Sirius on the globe — the label beside its mark with its magnitude and the
readout line under the box (4; FR-GLOBE-12, fixed in R171's review: `SkyGlobe` takes the page's
named row, and the four files were re-shot on the same Mac). `captureSeeds.ts` carries the London favourite (`LONDON_FAVOURITE`, the showcase's
geocoded London).

**How it was measured.** R171 ran headless, with no `gh`, so it could not dispatch
`captures.yml`. In its place, on one ten-core Mac, both plain builds (`VITE_MOON_LORE` unset):
2.11.0's set shot by `8413d978`'s own `v1-captures.spec.ts` off a build of `8413d978` (the tree
extracted into a scratch directory), and the branch's set shot twice by the branch's spec off the
branch's build. Each run took about 3.4 minutes and passed every capture.

**The branch against 2.11.0** (FR-GLOBE-18's check). Of the 412 files both runs shot, **379 are
byte- or pixel-identical**, and the 33 others are:

- **The wide stars page's view row — 12 files, FR-GLOBE-18's named move:** `v1-stars-1280-*`,
  `v1-stars-1920-*` and `v1-stars-zoom-1280-*`, each changed inside one box on the view row
  (86 × 16 px in English, 114 × 13 in Spanish: 475 to 616 pixels), where `Whole sky` /
  `Cielo entero` reads `Globe` / `Globo`. Nothing else in those files moved.
- **F-99's noise — 21 files**, every one a file §24.1 already listed or its kind:
  `v1-legend-390-*` (3; 206 to 210 pixels at a step of at most 15),
  `v1-live-scrubbing-{1024,1200,1280,3840}-*` (6), `v1-live-watching-1024-*` (2),
  `v1-live-window-1280-night-es` and `v1-live-window-follow-1280-dark-es` (2; 3 to 14 pixels at a
  step of 2 on the box's right edge), `v1-live-sheet-list-{390,844}-*` (5; at most 15 pixels at a
  step of 1), and `v1-stars-whole-following-390-*` (3; 122 and 141 pixels, §23.1's two
  hairlines). Two of them, `v1-live-scrubbing-1200-dark-en` and `v1-live-watching-1024-dark-en`,
  are 10 pixels at a step of about 225 in the head's clock at y 40: F-99's one-second clock.

**No other capture moves:** every home, Where, settings, favourites, shortcuts, guide, polar,
compact live and compact stars file is byte-identical to 2.11.0's, the compact `stars-whole`
among them.

**Two runs of the branch** (FR-CAP-5): **420 of 440 byte-identical** (the run directory held the
four retired 1280 files too) and 20 apart, every one F-99's kind and none of them a globe file:
`v1-live-*` edges at a step of 1 or 2 (14), three clocks at a step of about 235
(`v1-live-watching-2560-dark-es`, `-night-en`, `v1-live-window-1920-dark-en`),
`v1-legend-390-night-es` and `v1-legend-1280-night-en`, and `v1-stars-whole-following-390-*-es`
(2). Every `stars-globe*` file came out the same in both runs.

**What is committed.** 2.11.0's committed files where nothing moved (400 files, untouched: they
are `captures.yml`'s Linux raster, §24.1), and run 1's Mac files for the 12 moved and the 24 new
ones; the four `v1-stars-whole-1280-*` files are deleted. So the set mixes two rasters until
`captures.yml` re-shoots it — the push of R171's squash merge to `main` runs it, and §25.4 asks
whether that run's artefact replaces the set.

- [ ] Dispatch `captures.yml` on `main` after R171's squash merge with `base` `8413d978`, twice:
      run 1 _(id)_, run 2 _(id)_.
- [ ] Run 1 is green: **436 files** and the design captures, no capture missing.
- [ ] Run 1's list against `8413d978` names only §25.1's 12 moved files, the 24 new ones, the four
      gone and F-99's noise.
- [ ] Run 2 agrees with run 1 but for F-99's noise.

**After the owner's desk notes (V212-11..13, D-1054..D-1056).** The owner tested a local 2.12.0
build before the tag; four notes landed in one PR: a desk opens the stars page on the globe, a
hover never shrinks the globe (the readout row under the box keeps one height), `[ + ]` `[ − ]`
zoom it, and a hovered figure is drawn in the accent. The set is still **436 files**. The 24
`stars-globe*` files were re-shot on the same Mac off a plain build (the box is the readout row's
height shorter, the zoom buttons at that row's right end); nothing else moved: `v1-captures`
presses `Window` after the open on a desk for the window's screens (`starsAt`), so
`v1-stars-{1280,1920}-*` and `v1-stars-zoom-1280-*` came out byte-identical to the committed
files, and the compact stars files differ only by the Mac's raster against the committed Linux
one (F-99's kind) and were left as committed. `stars-globe` is now the desk's page as it opens.

- [ ] `captures.yml` run 1's list against `8413d978` names the 24 `stars-globe*` files among §25.1's
      new ones, and nothing more than §25.1 names.

### 25.2 The budget (FR-GLOBE-15, D-178, D-1042)

`npm run bundle:budget` on the branch, gzip level 9, beside `8413d978` (2.11.0) built on the
same machine, both plain. D-178 re-sets every row and **none moves**: R170's `globe` row leaves
`PHASE_BUDGETS` for the table at the GLOBE_BUDGET_KB it had (13.5 × 1.1 = 14.9, so 15), every
other row's measure × 1.1, rounded up to the next 5 KB, is the budget it already has, and
`main`'s (205) is past its 185 ceiling. The budget column is `scripts/bundle-budget.ts`'s rows;
`tests/docs/accuracy.test.ts` checks it against them:

| Chunk | gzip KB | Budget KB | `8413d978` | Change |
|---|---|---|---|---|
| main | 182.8 | 185 | 182.0 | +762 bytes |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | +6 bytes |
| stars-deep (`deep`) | 41.8 | 50 | 41.8 | 0 |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 31.4 | 35 | 29.9 | +1,536 bytes |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | 30 | 24.1 | −2 bytes |
| live | 13.7 | 20 | 14.7 | −1,074 bytes |
| window (`SkyWindow`) | 13.0 | 15 | 13.2 | −135 bytes |
| globe (`SkyGlobe` + `GlobeRail` + `scene`) | 13.5 | 15 | — | +13,807 bytes |
| service worker | 5.0 | 10 | 5.0 | +157 bytes (the worker script) |
| settings | 1.2 | 10 | 1.2 | −3 bytes |

The service worker row is per file, so its measure is the larger, `workbox-*.js`, unchanged;
the worker script (1.2 → 1.4 KB) grows by the globe's chunks in the precache list (FR-OFF-1). **`main`** is +762 bytes (186,383 → 187,145), the globe's strings in both catalogs
and the lazy import, inside GLOBE_MAIN_KB (1.5 KB). **`stars`** is +1,536 bytes
(30,611 → 32,147), the view row's third value, the rail's wiring and the named row handed to the
globe (FR-GLOBE-12, +7 in the review), at GLOBE_STARS_KB (1,536 bytes) exactly: the next byte
the page adds to `stars` before 2.12.0 is past it. The rows that hold no change move by a few
bytes with the chunk names they import (`chart` +6 here against −2 before the review).

**`main`'s 2.11.0 measure is 186,383 here, 186,394 in §24.2 and D-1050.** Both are builds of
the same `src/` (it does not differ between R165's branch and `8413d978`), made in other
checkouts on other days; the 11 bytes are the build's, not the code's. FR-GLOBE-15's delta is
read beside a base built in the same run on the same machine, so this section's +762 is the one
of record; D-1050's +749 (R170's branch against §24.2's figure) agrees within those 11 bytes. **`live` and `window` move down**, which FR-GLOBE-15's "no other row moves"
did not foresee: what the globe shares with them — `shownTime`, `useWallThrottle`, `skySurface`,
`starGlyphs.module` and `deepChunk` — became chunks of their own, unbudgeted as every shared lazy
chunk is, so the bytes left the two rows without leaving the pages.

### 25.3 What R171 removed (FR-FLOW-17's rule)

**No code and no message key.** The globe replaced no component: the wide `Whole sky` option
became `Globe` in R170, and the polar chart is the compact page's still. The capture set's
`stars-whole` at 1280 is the one removal (§25.1). `npm run check:dead` reports nothing.
`PHASE_BUDGETS` is empty again.

### 25.4 What the owner decides on this release

- [ ] **The capture set's raster** (§25.1): commit `captures.yml`'s run 1 as the whole set, or
      keep the mixed set R171 committed (2.11.0's Linux files and 36 Mac files).
- [ ] **`live` and `window` down by the shared chunks** (§25.2): accept the reading of
      FR-GLOBE-15's "no other row moves" as "no row grows".
- [ ] **F-99** stays open with §25.1's noise files; no new kind.

### 25.5 The desk run (US-50)

On the release build, at a desk at 1280 and at 1920, and on the phone. Write what each step
showed beside it.

- [ ] **`[ Window ] Globe`:** the stars page's view row on a desk reads `Window` and `Globe`;
      `Globe` draws the globe in the box where the window stood, the rail beside it.
- [ ] **Turning with you:** the zenith up, the horizon's near half with the ground shaded below
      it and its stars dimmed; with ×3600 the sky wheels about the pole and the zenith stays.
- [ ] **The switch to the stars:** `with the stars` keeps the view's centre, the north celestial
      pole goes up, and with time running the horizon sweeps across standing stars.
- [ ] **A drag:** the point under the pointer stays under it; the globe never turns over its pole.
- [ ] **The wheel:** zooms about the box's centre, in and out to its two limits.
- [ ] **The keys:** with the box focused, the arrows turn it, `+` and `-` zoom, `Home` returns to
      the opening view without touching the time or the place.
- [ ] **×3600:** the clock runs an hour a second; pressing it again pauses; `[ now ]` returns.
- [ ] **A saved place:** pressing one in `Place` moves the horizon, the zenith, the clock's zone,
      the count and the list; the app's place and the other pages unchanged.
- [ ] **The faint stars:** `[ ] faint` fills the globe with the deep catalogue; the count reads
      the whole drawn set; off on the next visit.
- [ ] **A star named:** a hover, a tap or a click on a star names it beside its mark and in the
      readout; a row of `Up from <place>` pressed names its star or planet on the globe the same way.
- [ ] **The phone's stars page unchanged:** `Window` and `Whole sky` in the sheet, the polar
      chart, no globe.

### 25.6 The release itself — `v2.12.0`

- [x] `package.json` is `2.12.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R167..R171).
- [ ] §25.4's items are decided.
- [ ] §25.1's two `captures.yml` runs are recorded.
- [x] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §25.2's.
- [ ] §25.5's desk run is written down.
- [ ] Find the release commit: the squash merge of R171's PR (its subject starts `R171:`). Write
      it here: _(the SHA)_. Tag the squash merge of this PR, and nothing else.
- [ ] Tag it: `git tag -a v2.12.0 <sha> -m "v2.12: the globe" && git push origin v2.12.0`.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §24 and this section history, as §14 was at its release.
