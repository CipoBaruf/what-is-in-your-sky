## 18. v2.6 (spec §9 Phase 2n)

Everything above still applies, §1 to §5 included, and §17's list is run with this one if
`v2.5.0` has not been tagged yet. v2.6 is the phone and desk flow: the home opens on three
doors and a folded Where (FR-FLOW-1, FR-FLOW-2), every page has one header (FR-FLOW-3),
the three sky views lay their parts out in one order with a one-line view row, one readout
word and a hint under the drawing (FR-FLOW-4..6), the pass detail has a head and the stars
page its action first (FR-FLOW-7, FR-FLOW-8), the boxes are cut to what they draw
(FR-FLOW-9), the gaps and the targets are measured (FR-FLOW-10, FR-FLOW-11), the legend
names its times (FR-FLOW-13), a phone opens on the window (FR-FLOW-14) and a turned phone
has a layout of its own (FR-FLOW-15). R129 to R134 and R136 built it and R135 is this
section. `main` reads `2.6.0` once R135 merges; the tag, the push to `release` and the
deploy are the owner's (§18.5). §18.4's budget item is decided (V26-14).

### 18.1 The capture set and the diff against `89a8e5b` (FR-FLOW-12, FR-CAP-1, FR-CAP-5, D-873)

The set gains FR-FLOW-12's files on the set's clock and place (Bariloche, the morning of 6
September 2026, FR-SHOW-9) and is **386 files**:

- `v1-home-up-now-{360,390,1280,1920}-{dark,night}-{en,es}` — 16: the doors three minutes into
  the night's brightest pass, `Up now · peaks in 0:08`, the Both door's count and landmark.
- `v1-home-no-pass-{360,390,1280,1920}-{dark,night}-{en,es}` — 16: the doors over a catalogue
  with nothing visible in 72 h (PLAN D-874), `No visible pass in 72 h`, the Satellites door
  opening the What reading in place.
- `v1-home-daylight-{360,390,1280,1920}-{dark,night}-{en,es}` — 16: the doors at 13:00 local,
  `Stars from 20:30`, the evening's first pass.
- `v1-where-opened-{360,390}-{dark,night}-{en,es}` — 8: the compact Where opened by its
  `[ details ]`.
- `v1-guide-844-*` and `v1-stars-844-*` — 8: the pass detail and the stars page on a phone
  turned, the drawing left at full height and the rail beside it.

It retires 8: `v1-live-window-{360,390}-*`. A phone with nothing saved opens the live page on
the window (FR-FLOW-14), so `live-watching` at 360 and 390 is the window in the box there —
FR-SKY-9's 390 px file of it — and `live-window` at those widths was the same picture under a
second name, differing only in the header's clock. `live-window` stays at 1280 and 1920.

The doors' fourth state, `a later pass`, is the home's `-view` twin at `CLOCK` (48 minutes
before the first pass), at the same four widths; the folded Where is the top of the home's
360 and 390 files; the live page at 844 × 390 was in the set already. The phone's live files
(`live-watching` and `live-scrubbing` at 360, 390, 768 and 844, `legend` at 360 and 390) show the window,
because a phone with nothing saved opens on it (FR-FLOW-14).

**The diff**, measured by R135 on one Mac: the branch's set and `89a8e5b`'s, each shot by its
own commit's `tests/e2e/v1-captures.spec.ts` off a plain build of its own commit (the
`89a8e5b` tree extracted and built beside the branch), and compared pixel by pixel. Of the
330 files 2.5.0's set names, **8 are retired (above), 20 are byte-identical and 302 differ**:

- **The home (compact and wide) — 48 files:** `v1-home-*` and its `-view` twins, the doors
  and the folded Where at the top (12 of the full-page files change height).
- **Every header — 4 files that moved for nothing else:** `v1-location-1280-*`, the wide row's
  `home live stars` nav (R129). `v1-location-{360,390}-*`, the first visit's steps, are
  byte-identical (8).
- **The sky views' order, view row, hint and box at every width, with the legend's times and
  the phone's window — 184 files:** `v1-live-watching-*` and `v1-live-scrubbing-*` (40 each),
  `v1-live-window-*` (8, at 1280 and 1920), `v1-live-window-follow-*` (4), `v1-legend-*` (12), `v1-polar-*` (12),
  `v1-guide-*` (20), `v1-guide-window-*` (16) — the last two with the pass detail's head and
  panel — and `v1-stars-*`, `v1-stars-passes-*`, `v1-stars-zoom-*` (16, 12, 4) with the stars
  page's order.
- **The readout's word — 38 files:** the sky screen's `sky`, `chip`, `ground`, `buried`,
  `portrait` and `turned` files (26), `v1-window-844-*`, `v1-stars-screen-844-*` and
  `v1-stars-passes-screen-844-*` (4 each). Each differs inside the readout's box only —
  `Looking` became `Facing`, `Mirando` `Hacia el` (FR-FLOW-5, D-847) — but for
  `v1-window-844-*`, which also has 31,000-odd pixels at a channel step of at most 2 across
  the frame (F-99's kind: the layer's translucent panels over a sheet whose box now holds the
  window).
- **The settings page — 28 files, a finding:** `v1-settings-*` (16) and `v1-favourites-*`
  (12, the saved places on that page). FR-FLOW-12 says the settings page is byte-identical,
  and two of the phase's own changes move it: the header (R129: `[ ← Back ]` became the
  header's `[ ← ] settings <place>`, D-856), which is "every header", and the gaps between
  Location, Saved places and This browser, which R134 marked `group` (D-870) and which is on
  none of FR-FLOW-12's lists. Nothing else on the page moved. See §18.4.

The 20 that did not move are `v1-shortcuts-*` (12, the overlay over an inert page) and the
first visit's 360 and 390 files (8).

**Two runs of the branch's set** (FR-CAP-5), off one plain build, re-run after the review's
fixes to the waits: **372 of 386 files byte-identical**. 13 of the 14 that differ are F-99's
places and size — at most 14 pixels at a channel step of at most 2, the live clocks' and the
rail's right edges at 1024 to 3840 and a pixel or two of `v1-polar-1280-*`. The fourteenth is
not: `v1-polar-360-dark-en` differs by 162 pixels at a channel step of 47 in a 60 × 170 strip
of the chart's stars (§18.4). Run 1 against the committed set: 374 identical, 12 F-99's.

**What is committed.** The set of record is the Linux renderer's (D-732). Nearly every file
moved, so R135 commits the whole set as its first Mac run shot it, rather than leave 302
files picturing 2.5.0's pages beside a README drawn from the new ones; `captures.yml`'s run 1
replaces it. `docs/readme/hero.png` and `social-preview.png` are re-drawn from it, and the
phone tile's caption and the README's alt text now say the window, which is what a phone
opens on.

- [ ] Dispatch `captures.yml` on the release commit with `base` `89a8e5b`, twice: run 1
      _(id)_, run 2 _(id)_.
- [ ] Run 1 is green: **386 files** and the four design captures, no capture missing.
- [ ] Run 1's diff step lists the 64 new files, the 302 of the lists above and the 8 retired
      ones, and nothing else.
- [ ] Run 1's artefact is committed as the set, the hero is re-drawn from it
      (`npx tsx scripts/readme-hero.ts`), and run 2 agrees with run 1 but for F-99's noise.

### 18.2 The budget (FR-FLOW-12, D-853, D-178)

`npm run bundle:budget` on the branch, gzip level 9, beside `89a8e5b` built on the same
machine, both plain (`VITE_MOON_LORE` unset). FR-FLOW-12 as amended (V26-14) allows the
measured figures below; the release re-sets every row by D-178, with `main`'s ceiling and
budget at the owner's 180 (PLAN D-875). The budget column is `scripts/bundle-budget.ts`'s rows;
`tests/docs/accuracy.test.ts` checks it against them:

| Chunk | gzip KB | Budget KB | `89a8e5b` | Change |
|---|---|---|---|---|
| main | **177.5** | **180** (was 175; the owner's, V26-14; the rule's 200 is not taken) | 172.9 | **+4.56 (4,667 bytes)** |
| chart (`SkyDome`) | 97.1 | **110** (was 105; the rule's, its ceiling) | 94.7 | **+2.39 (2,445 bytes)** |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 26.7 | 30 | 25.8 | **+0.81 (834 bytes)** |
| astronomy (`astronomy` + `skyBodies`) | 24.1 | **30** (was 25; the rule's, its ceiling) | 22.6 | **+1.47 (1,510 bytes)** |
| window (`SkyWindow`) | 26.6 | 30 | 25.7 | **+0.89 (913 bytes)** |
| live | 9.7 | 15 | 9.7 | −0.05 (−48 bytes) |
| service worker | 5.0 | 10 | 5.0 | 0 |
| settings | 1.1 | 10 | 1.0 | +0.11 (112 bytes) |

The lazy `camera` chunk is 1.2 KB (3.8 at `89a8e5b`). The main stylesheet is 12.3 KB gzipped
against 11.1.

Where `main`'s growth came from, each merge built plainly against the one before it: R131
(the words) 0, R129 (the header) +0.2, R130 (the doors and the folded Where) +1.7, R132 (the
layout) +2.6, R134 (the rhythm and the targets) +0.1, R136 (the window first, the turn) −0.2,
R133 (the boxes) +3.7. That took the branch to 181.0. R133's 3.7 was one import:
`ChartFrame.tsx`, which is in `main`, took `compactBowlBoxPx` from `skychart/dome/camera.ts`, so
the `camera` module and `domeGeometry` left their lazy chunk. R135 moved the bowl's numbers into
`dome/bowl.ts`, which imports only `lib/layout` (D-882): `main` came back to 177.5 and `camera`
is lazy again. `chart` gains 2.4 KB in the same move: 2.5.0's build put `domeGeometry` in the
`camera` chunk the window, live and stars pages share, because `camera.ts` used its
`GROUND_RADIUS`. `camera.ts` still imports `projectToScreen` and `COMPASS_LABEL_RADIUS` from
it, but only for `drawingExtent`, which the app never calls, so Rollup drops those uses and puts
`domeGeometry` in the `SkyDome` chunk. The placement rests on that tree-shaking, not on the
import graph. The dome page loads the same bytes and the other pages fewer. R130 took the whole of `FLOW_MAIN_KB` on
its own (its Done note: 173.0 → 174.5), so every later task's `main` bytes were over the
allowance when they merged. `stars` grew in R129 (+0.4), R130 and R132; `astronomy` in R130
(`moonNow`'s rise and set); `window` in R130, R134 and R136.

- [ ] The release PR carries this table.

### 18.3 What the owner reads and checks (Phase 2n)

- [ ] **The captures read** at 390 px in both themes (V26-1): §18.1's 64 new files and the
      302 moved ones, beside the per-task captures R130 to R136 filed under
      `docs/screenshots/` (`r130-*`, `r133-*`, `r136-*`).
- [ ] **On a phone, on the release build:** the home's Satellites door to a watched pass
      (the pass detail, then the live page following it), and the Stars door to the sky screen
      (`[ hold up to the sky ]`); and the phone turned on the live page while a pass is
      followed, the camera and the instant unchanged.
- [ ] **At a desk:** the three doors, each to its page, and the wide header's `home live
      stars` between them.

### 18.4 What the owner decides on this release

- [x] **The budget** (§18.2), decided 2026-10-28 (V26-14): R135 first moves the bowl's numbers
      out of `dome/camera.ts` (D-882, `main` 181.0 → 177.5), then `main`'s ceiling and budget go
      to 180 and FR-FLOW-12's allowances become the measured figures; `chart` and `astronomy`
      are re-set by D-178's rule.
- [x] **The settings page is not byte-identical** (§18.1): the header (R129, D-856) and R134's
      group gaps (D-870) move it. FR-FLOW-12 as amended names both (V26-14).
- [ ] **The sky screen is byte-identical but for the readout's word**, which FR-FLOW-12 names
      as a move; the two lines say the same thing once read together. No action unless the
      owner wants the requirement's wording to say so.
- [ ] **An empty 72 h search reads "Not ready offline: no passes stored yet"**
      (`v1-home-no-pass-*`): the app stores no run when the search finds nothing, so a reader
      with no pass is told the place is not ready offline. A finding for a later task.
- [ ] **The turned stars page's layers rows run together** (`v1-stars-844-*`): at 844 × 390
      the rail draws `[x] figures[x] planets` in English and `[x] nombres[ ] pases` in Spanish,
      with no space where FR-FLOW-8's two rows meet (D-865's `firstRowCount` split). A finding
      for a later task.
- [ ] **F-99** stays open with §18.1's 13 files and `v1-window-844-*`'s panels.
- [ ] **`v1-polar-360-dark-en` moved between two runs** (§18.1): 162 pixels at a channel step
      of 47, star dots in the polar chart's stars layer, once in two full runs under six workers
      and in none of four runs of that capture alone. Likely the lazy `PolarStars` chunk landing
      after the drawing settles under load, the race D-830 fixed for the dome. A finding for a
      later task; run 2 of `captures.yml` is where it shows or does not.

### 18.5 The release itself — `v2.6.0`

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.6.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R129..R136).
- [x] §18.4's first item is decided (V26-14), and `scripts/bundle-budget.ts` and §18.2's table
      say so.
- [ ] §18.1's two `captures.yml` runs are recorded and run 1's artefact is committed.
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §18.2's.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R135's PR (its subject starts `R135:`), or the commit that
      lands §18.1's Linux set after it, whichever is last. Write it here: _(the SHA)_.
- [ ] Tag it: `git tag -a v2.6.0 <sha> -m "v2.6: the phone and desk flow" && git push origin v2.6.0`.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §17 and this section history, as §14 was at its release.
- [ ] Record in the release PR: the bundle table, the knip output, the two capture runs'
      numbers, and the date.
