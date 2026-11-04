## 17. v2.5 (spec §9 Phase 2m)

Everything above still applies, §1 to §5 included, and §15's and §16's lists are run with
this one: `v2.5.0` is the first tag since `v2.2.0` and covers v2.3, v2.4 and v2.5 (V24-11).
v2.5 is one sky: every drawing of the sky draws the one scene (FR-SKY-1), with the stars,
the figures and the planets under the arcs behind `[ stars ]` (FR-SKY-3), on the polar chart
(FR-SKY-4), the dome (FR-SKY-5) and the window, which is offered on every page and laid out
in the box on wide (FR-SKY-2, FR-SKY-7); the stars page takes the passes with `[ passes ]`
(FR-SKY-6); the highlighted pass names its landmark and the constellations it crosses
(FR-SKY-11, FR-SKY-12); the facing picker follows the pass (FR-SKY-13); the window zooms
(FR-SKY-14); and the names are Spanish in Spanish (FR-STAR-10 as amended). R119 to R127
built it and R128 is this section. `main` reads `2.5.0`; the tag, the push to `release` and
the deploy are the owner's (§17.5).

### 17.1 The capture set and the diff against `ece8bfd` (FR-SKY-9, FR-CAP-1, FR-CAP-5, D-799)

The set gains FR-SKY-9's files, six screens on the set's clock and place (Bariloche, the
morning of 6 September 2026, FR-SHOW-9), and is **330 files**:

- `v1-live-window-{360,390,1280,1920}-{dark,night}-{en,es}` — 16: the live page watching at
  the set's instant with the view control on `Window`; at 1280 and 1920 the window-shaped box
  with the rail and the picker beside it, at 360 and 390 the compact reader without a sensor,
  which is what a headless capture is, so the window is drawn in the square box by hand.
- `v1-guide-window-{360,390,1280,1920}-{dark,night}-{en,es}` — 16: the `guide` screen's pass
  on the window, facing the peak with `peak` pressed, the arc under the stars and the
  landmark line under the pass's name.
- `v1-live-window-follow-1280-{dark,night}-{en,es}` — 4: the live page's window after `f`,
  `Following A`, the key pressed in the picker (FR-SKY-13).
- `v1-stars-passes-{360,390,1280}-{dark,night}-{en,es}` — 12: the stars page with `[ passes ]`
  on, faced north to the night's brightest pass, the pass first in `In this field`.
- `v1-stars-zoom-1280-{dark,night}-{en,es}` — 4: the stars page zoomed to
  `WINDOW_FOV_MIN_DEG`, `· field 20°` in the readout (FR-SKY-14).
- `v1-stars-passes-screen-844-{dark,night}-{en,es}` — 4: the screen `[ hold up to the sky ]`
  opens from the stars page with `[ passes ]` on, the stars and the pass together. The live
  page's own screen with both is `v1-sky-screen-sky-844-*`, re-shot (PLAN D-829).

FR-SKY-9 names each file's widths; 360 is FR-CAP-2's column beside every 390, and the two
1280-only screens are `captures.test.ts`'s desk exception by name.

**The diff**, measured by R128 on one Mac: the branch's set and `ece8bfd`'s, each shot by its
own commit's `tests/e2e/v1-captures.spec.ts` off a plain build of its own commit (the
`ece8bfd` tree extracted and built beside the branch), and compared pixel by pixel. Of the
274 files both sets name, **90 are byte-identical and 184 differ**, and every one of the 184
is on one of four lists:

- **The stars under the arcs and the landmark (FR-SKY-3, FR-SKY-4, FR-SKY-5, FR-SKY-11) —
  154 files**, every chart the set shoots: `v1-guide-*` (20), `v1-polar-*` (12),
  `v1-legend-*` (12), `v1-live-watching-*` and `v1-live-scrubbing-*` (40 each, the landmark
  line under the headline as well), `v1-window-844-*` (4) and the sky screen's
  `sky`, `chip`, `ground`, `portrait` and `turned` files (22); and
  `v1-sky-screen-buried-844-*` (4), whose field is all ground, so what moved is the
  readout's second line — the landmark's name in place of the true-north line (FR-SKY-11:
  "its name in the window and on the screen").
- **The `?` overlay's `f` row (FR-DESK-4 as amended v2.5) — 12 files:** `v1-shortcuts-{360,390,1280}`.
  The capture spec counted eleven keys since R118; it counts twelve.
- **The stars page's `[ passes ]` row (FR-SKY-6) — 16 files:** `v1-stars-*`, the layers' third
  row and nothing else in English; in Spanish the drawing's names as well (FR-STAR-10 as
  amended v2.5: `C E N T A U R O`, `Canopo`).
- **The Spanish names (FR-STAR-10 as amended v2.5) — 2 files:** `v1-stars-screen-844-{dark,night}-es`.

The 90 that did not move are `v1-home-*` (48), `v1-location-*`, `v1-favourites-*` (12 each),
`v1-settings-*` (16) and `v1-stars-screen-844-{dark,night}-en` — every screen with no sky on
it, and the stars inventory in English. A file on none of the four lists would be a finding,
not a re-baseline; there is none.

**Two runs of the branch's set** (FR-CAP-5): the first local runs did not agree, and the
reason was the set's, not the renderer's. `[ stars ]` is on by default and the `stars` chunk
is lazy, so the first run shot `v1-polar-390-dark-es` with no star on it and the second with
them; and on compact the landmark line the chunk brings is a fourth headline line that takes
23 px from the box (D-838), so where the chunk landed after the dome had mounted, the dome
kept drawing the taller box (`v1-live-watching-{360,390,768}`, about 5,000 pixels each). That
one was the app's, and R128 fixed it (F-103): the dome remounted its scene when the grid's
columns or font size changed, and a box that changes height alone moves neither, only the
rows, so glyphcss kept the projection of the box it mounted in. The scene's key carries the
rows now (`SkyDome.tsx`), and `dome-resize.spec.ts` holds a 390 px box shortened by its
height alone to a fresh load's rasters. The same fix redraws the compact live page's dome
when the scrubbing block takes its height, so `v1-legend-{360,390}-*` and
`v1-live-scrubbing-{360,390,768}-*` (20 files, 8,000–20,000 pixels inside the dome) move
against the spec's first run: they had been shot through the watching box's projection.
The spec waits for a placed star in the view before it pins the instant, and still has the
reader's own prefetch fetch the chunk on the home page — focus on the header's `[ stars ]` or
the When pane's `[ look up ]`, counted by a response listener attached before the first
navigation — not for the dome's size any more but for the order its meshes mount in: without
it, a braille cell an arc and a star share took one colour or the other by when the chunk
landed, and two cold runs disagreed on four wide live files (PLAN D-830). After that, two runs
off one build (at the review's head) agree on 306 of 330 files; the 24 that differ are F-99's places and
size — 21 files at most 18 pixels at a channel step of at most 2 (the live clocks' edges, the
legend's rule) — and three polar files, `v1-polar-1280-dark-en` and `v1-polar-360-{dark-en,night-es}`,
at 51 to 123 pixels (step at most 39), the anti-aliasing of a star's glyph and the arc's edge
with nothing moved.

**What is committed.** The set of record is the Linux renderer's (D-732), so this branch
commits the 56 new files as one Mac run shot them, to keep `captures.test.ts` whole, and
leaves the 184 moved files at `ece8bfd`'s bytes until a `captures.yml` run replaces them.
R128 also gives the workflow the `base` input D-742 asked for and a last step that lists every
file of the run against the base's committed set, with its changed pixels and largest channel
step, in the job summary — so the run itself prints the list above.

- [ ] Dispatch `captures.yml` on this branch (or on the release commit) with `base`
      `ece8bfd`, twice: run 1 _(id)_, run 2 _(id)_.
- [ ] Run 1 is green: **330 files** and the four design captures, no capture missing.
- [ ] Run 1's diff step lists the 56 new files and the 184 of the four lists above, and
      elsewhere only F-99's noise.
- [ ] Run 1's artefact is committed as the set, `docs/readme/hero.png` is re-drawn from it
      (`npx tsx scripts/readme-hero.ts`), and run 2 agrees with run 1 but for F-99's noise.

### 17.2 The budget (FR-SKY-10, D-799, D-178)

`npm run bundle:budget` on the branch, gzip level 9, beside `ece8bfd` built on the same
machine. Every row is re-set by D-178's rule — measured × 1.1, up to the next 5 KB, floored at
10, capped at the ceiling — and the owner accepted the measured sizes (V25-20, PLAN D-841), so
two move: `window` by the rule, `main` with its ceiling. The budgets themselves are
`scripts/bundle-budget.ts`'s rows, the one copy; `tests/docs/accuracy.test.ts` checks this
table's budget column against them:

| Chunk | gzip KB | Budget KB | `ece8bfd` | Change |
|---|---|---|---|---|
| main | 173.0 | **175** (was 170; rule 195, the ceiling raised to 175 by V25-20) | 169.8 | +3.21 (3,288 bytes) |
| chart (`SkyDome`) | 94.7 | 105 | 94.2 | +0.48 (493 bytes) |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 25.8 | 30 | 23.6 | +2.23 (2,287 bytes) |
| astronomy (`astronomy` + `skyBodies`) | 22.6 (21.9 + 0.7) | 25 | 22.6 | 0 |
| window (`SkyWindow`) | 25.7 | **30** (was 25) | 22.1 | +3.62 (3,702 bytes) |
| live | 9.7 | 15 | 9.6 | +0.12 (121 bytes) |
| service worker | 5.0 + 1.2 | 10 | 5.0 + 1.1 | +0.1 (the worker's precache list) |
| settings | 1.0 | 10 | 1.0 | 0 |

Four lazy chunks are new and unbudgeted, 2.5 KB together: the polar chart's star group
`PolarStars` (0.8), `starGlyphs` and its module (0.8 + 0.6), which FR-SKY-10 charges to
`main`'s allowance where Vite puts it, and `liveArcs` (0.3). The main stylesheet is 11.1 KB
gzipped against 10.9 at `ece8bfd`, and a 0.2 KB `starGlyphs` sheet is new.

- **`chart`** grew by the dome's points mesh, inside FR-SKY-10's 2 KB; **`live`** by 121
  bytes, inside its 1 KB.
- **`window`** goes up to the rule's 30 (25.7 × 1.1 = 28.3). FR-SKY-10 said no other row
  moves and D-799 let the window's grow for the zoom and the follow inside its 25 KB row;
  it is 0.7 KB past that row, with the hand camera on every page and the landmark's ring and
  name as well (R121, R125, R127). The owner accepted the measured size (V25-20).
- **`stars`** grew by 2,287 bytes against FR-SKY-10's 2 KB (the landmark, `constellationAt`
  and the Spanish names): 239 bytes over, accepted as measured (V25-20); the row's budget
  stays 30 by the rule.
- **`main`** grew by 3,288 bytes against FR-SKY-10's 1 KB, and at 173.0 it was 3.0 KB past its
  170, which was also the §11 ceiling. What v2.5 put in `main`: the `[ stars ]` toggle and the
  prefetch, the landmark line's formatter, the `Among` column, the facing picker's follow row,
  and the phase's strings in both catalogs (R123's and R127's Done notes). The owner accepted
  the measured size and R128 raised the ceiling and the budget to 175, the next 5 KB line, as
  V21-24 put 166.6 on 170 (V25-20, D-841); the rule's 195 would hide a 20 KB regression. The
  `::warning::` R123 and R127 left is gone. R128's one change under `src/`, F-103's key, is in
  the `chart` row and moves no figure.

- [ ] The release PR carries this table.

### 17.3 What the owner reads and checks (Phase 2m, US-40, US-41)

v2.5's definition of done leaves three things to the owner (V25-15), and §15.4's and §16.3's
lists are owed with them:

- [ ] **The captures read** in both themes: the 56 files of §17.1 and the 184 moved ones,
      beside the per-task captures R121 to R127 filed under `docs/screenshots/`
      (`r121-*`, `r123-*`, `r125-*`, `r126/`, `r127-*`).
- [ ] **One pass watched through the phone with the stars on** — on the release build
      (`main`'s preview or the deployed v2.5.0): the live page's view control on `Window`,
      the sky screen opening on the reading, the stars and the arc together, the landmark
      named in the readout, and the pass found against the stars it was said to cross
      (US-40 AC1–AC3, AC6).
- [ ] **One pass scrubbed to at a desk in the window** — the live page at 1280 or wider, the
      window as the saved view, `[ scrub ]` to a pass, its key in the picker, `f` turning to
      it and following it, `+` and `0` on the box (US-41 AC1, AC5, AC6), and a pass detail's
      window opening on the peak (US-41 AC2).
- [ ] **The rate on the device**: the dome dragged on the FR-GUIDE-6 phone with the stars on
      is not below its v2.4.0 measure by more than a tenth and never below 30 (US-40 AC4;
      R124 measured 57.2 per s at 390 px under 6× throttling against `ece8bfd`'s 59.4).

### 17.4 What the owner decides on this release

- [x] **`main`'s 3.2 KB, `stars`' 239 bytes and `window`'s 0.7 KB past its row** (§17.2):
      decided 2026-10-27 — the owner accepted v2.5's measured sizes and had R128 re-set the
      rows to them (V25-20, PLAN D-841): `main` and its §11 ceiling 175, `window` 30 by the
      rule, `stars` 30 unchanged; FR-SKY-10's allowances amended to the measured figures.
- [x] **The cold-load race on compact** (§17.1): fixed in R128 at the owner's preference for
      an app fix over a capture-spec workaround — F-103, the dome's scene key carries the
      grid's rows (PLAN D-830).
- [ ] **The four screens FR-SKY-9 named once and the set shoots twice or not at all**: the
      live page's screen with stars and passes is `sky-screen-sky`, not a new file
      (PLAN D-829); accepted, or a new screen.
- [ ] **F-99** stays open with §17.1's 15 files (the two polar ones are new to it).

### 17.5 The release itself — `v2.5.0`

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.5.0` on `main` and every task of the three phases is checked off
      in `TASKS.md` (R103..R110, R111..R118, R119..R128).
- [ ] §17.1's two `captures.yml` runs are recorded and run 1's artefact is committed.
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §17.2's.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R128's PR (its subject starts `R128:`), or the commit that
      lands §17.1's Linux set after it, whichever is last. Write it here: _(the SHA)_.
- [ ] Tag it: `git tag -a v2.5.0 <sha> -m "v2.5: one sky" && git push origin v2.5.0`. No
      `v2.3.0` or `v2.4.0` tag is made: `6cfa699` and `ece8bfd` are those versions by
      PLAN D-742's rule.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run §2 and §5 against `https://inyoursky.app`.
- [ ] Mark §15, §16 and this section history, as §14 was at its release.
- [ ] Record in the release PR: the bundle table, the knip output, the two capture runs'
      numbers, and the date.
