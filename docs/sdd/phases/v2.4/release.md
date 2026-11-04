## 16. v2.4 (spec §9 Phase 2l)

Everything above still applies, §1 to §5 included, and §15's lists are still owed with this
one. v2.4 is the stars: the `#stars` page (FR-STAR-3), drawn from a catalogue of about a
thousand stars and their figures in the `stars` chunk (FR-STAR-1, FR-STAR-10), positioned for
the observer and the instant (FR-STAR-2), turned by hand on a desk (FR-STAR-4) and held up to
the sky on a phone through the sky screen's stars inventory (FR-STAR-5); the names placed so
they cover no mark (FR-STAR-6, as amended v2.4.1) and named by a tap (FR-STAR-7). R111 was
the spike (`docs/stars/FINDINGS.md`), R112 to R117 built it, and R118 is this section.
**Nothing here is released** (V24-11): `main` reads `2.4.0`, there is no `v2.4.0` tag and no
push to `release`, and the owner's reading of the stars captures and the phone held up to a
clear sky move to v2.5's release preparation (V24-21, §16.3).

### 16.1 The capture set and the diff against `6cfa699` (FR-CAP-1, FR-CAP-5, D-758)

The set gains two screens, both on the set's clock and place (Bariloche, 05:00 local on
6 September 2026, FR-SHOW-9), and is **274 files**:

- `v1-stars-{360,390,1280,1920}-{dark,night}-{en,es}` — 16: the page as it opens, facing
  south 35° up with every layer on; the phone widths on a touch device, so
  `[ hold up to the sky ]` is on them, and the desk widths with the rail and `In this field`.
  D-758 names 390, 1280 and 1920; 360 is FR-CAP-2's column beside every 390 (PLAN D-786).
- `v1-stars-screen-844-{dark,night}-{en,es}` — 4: the sky screen in the stars inventory,
  opened by `[ hold up to the sky ]` and aimed south 35° up, with the readout's true-north
  line and the gutter and no pass.

**The diff**, measured by R118 on one Mac: the branch's set and `6cfa699`'s, each shot by
this branch's `tests/e2e/v1-captures.spec.ts` off a plain build of its own commit (the
`6cfa699` tree extracted and built beside the branch), and compared pixel by pixel. Of the
254 files both sets name, **155 are byte-identical and 99 differ**, and every one of the 99
is on one of four lists:

- **The header's `[ stars ]` (FR-STAR-3) — 48 files**, the wide header row and nothing
  under it (a box inside y 27–44): `v1-home-{1024,1280,1920}` and their `-view` twins (24),
  `v1-guide-{1024,1280}` (8), `v1-favourites-1280`, `v1-location-1280`, `v1-polar-1280` and
  `v1-settings-1280` (4 each), in both themes and both languages.
- **The When pane's `Stars tonight · [ look up ]` (FR-STAR-3) — 24 files:**
  `v1-home-{360,390,768}` and their `-view` twins. The line is 32 px, so the full-page files
  are 32 px taller and the `-view` files move everything under the When heading down.
- **The `?` overlay's `s` row and the stars page's two key rows (FR-DESK-4 as amended v2.4)
  — 12 files:** `v1-shortcuts-{360,390,1280}`. The capture spec counted the overlay's eight
  keys since v2.0 and failed on R115's eleven; R118 counts eleven.
- **F-99's sub-pixel noise — 15 files**, each at most 6 pixels at a channel step of at most
  2, the size two runs of one commit differ by (§15.1): `v1-legend-360-dark-es`,
  `v1-legend-390-dark-en`, `v1-legend-390-night-es`, `v1-live-scrubbing-1200-dark-es`,
  `v1-live-scrubbing-1200-night-en`, `v1-live-watching-1024-dark-{en,es}`,
  `v1-live-watching-1200-dark-{en,es}`, `v1-live-watching-1200-night-en`,
  `v1-live-watching-360-dark-es`, `v1-live-watching-390-{dark,night}-es`,
  `v1-live-watching-768-dark-en`, `v1-live-watching-768-night-es`.

So the definition of done's "the live page's and the pass detail's captures byte-identical
to `v2.3.0`'s" holds but for noise: every `live-watching`, `live-scrubbing`, `window` and
`sky-screen-*` file, and the guide and the polar view on compact, are the same picture; the
guide and the polar view on wide differ only in the header row above them. The task entry's
"only `v1-stars-*` files new and none changed" is read as "nothing changed but what the
phase's own requirements moved" — the three lists above are FR-STAR-3's and FR-DESK-4's,
merged with R115 — and a file on none of the four lists is a finding, not a re-baseline.
The 20 new files were shot twice off one build and are byte-identical between the runs.

**What is committed: the Linux runs (D-732).** The committed set is the Linux renderer's
since R109 (§15.1), so the set of record is `captures.yml`'s, dispatched on R118's branch at
`c1a7838` (the head before the review fixes, which change no capture):

- run 1: [40106274669](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/40106274669)
  — green, **274 files** and the four design captures. **Its artefact is the committed
  set**: against `6cfa699`'s committed files it differs in the 20 new files and in 99
  others — the 84 of the first three lists above and 15 of F-99's size (`v1-legend-{360,390,1280}`
  and `v1-live-{scrubbing,watching}-{1024,1200,1280,1920}` files, each at most 18 pixels,
  at a channel step of at most 8) — and nowhere else. The four design captures are
  byte-identical to the committed ones.
- run 2: [40106522515](https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/40106522515)
  — green, on the same commit; agrees with run 1 on 253 of 274 files and all four design
  captures. The 21 that differ are sub-pixel, each at most 18 pixels at a channel step of
  at most 16: the eight `v1-home-{360,390}-view` files (1–8 px), four `v1-legend` files and
  nine `v1-live-{scrubbing,watching}` files, F-99's places. No `v1-stars-*` file differs.

- [x] Run 1 is green: **274 files** and the four design captures, no capture missing.
- [x] Against the committed set (`6cfa699`'s), run 1 differs in the 20 new files and in the
      84 files above, and elsewhere only by F-99's noise.
- [x] Run 1's artefact is committed as the set, and run 2 agrees with it but for F-99's
      noise (FR-CAP-5 as §15.1 reads it).

### 16.2 The budget (FR-STAR-9, US-39 AC5, D-759)

`npm run bundle:budget` on the branch, gzip level 9, beside `6cfa699` built on the same
machine. The rows the release re-sets by D-178's rule — measured × 1.1, up to the next 5 KB,
floored at 10, capped at the ceiling — are `stars` and `window` (D-759 as amended, D-780;
PLAN D-785). The budgets themselves are `scripts/bundle-budget.ts`'s rows, the one copy;
`tests/docs/accuracy.test.ts` checks this table's budget column against them:

| Chunk | gzip KB | Budget KB | `6cfa699` | Change |
|---|---|---|---|---|
| main | 169.8 | 170 | 168.5 | +1.24 (1,270 bytes) |
| chart (`SkyDome`) | 94.2 | 105 | 94.2 | 0 |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars | 23.6 | **30** (was 40) | — | new |
| astronomy (`astronomy` + `skyBodies`) | 22.6 (21.9 + 0.7) | 25 | 22.1 | +0.5 |
| window (`SkyWindow`) | 22.1 | **25** (was 15) | 12.8 | +9.3 |
| live | 9.6 | 15 | 9.6 | 0 |
| service worker | 5.0 + 1.1 | 10 | 5.0 + 1.1 | 0 |
| settings | 1.0 | 10 | 1.0 | 0 |

The stylesheets, gzipped: the main one 10.89 KB against 10.74 at `6cfa699` (+0.15), the
window's 1.79 against 1.54, the new stars one 0.95, the live one's 2.07 and the dome's 0.88
unchanged.

- **`stars`** comes down from `STARS_BUDGET_KB` (40), the room the page was given, to the
  rule's 30 (23.6 × 1.1 = 26.0).
- **`window`** goes up to the rule's 25 (22.1 × 1.1 = 24.3) and is not slimmed in v2.4
  (V24-24): the star names, the page's label words, the constellation table and the
  magnitude format are shared by the `stars` and `SkyWindow` chunks, and Rollup puts what
  they share in `SkyWindow-*.js`. The reason is beside the row in `scripts/bundle-budget.ts`.
- **`astronomy`** grew by the functions `skyStars.ts` calls that `skyBodies.ts` does not
  (R115, D-749), inside its 25. `chart` and `live` moved by two bytes and one, the chunk
  names they import; no other row moved.
- **`main` is 0.24 KB past FR-STAR-9's allowance.** The spec allows the main chunk to grow
  by at most 1 KB over `6cfa699`, for the route and the link; it grew by 1,270 bytes. R115
  measured +923 after moving the page's own words into the `stars` chunk (PLAN D-777); R116
  and R117 added the rest. What v2.4 left in main is the route and its lazy import, the
  header's `[ stars ]`, the When pane's `Stars tonight · [ look up ]`, the `?` overlay's
  three rows with their words in both catalogs, and R117's stars inventory in
  `SkyScreen` (retired by R152), which main carried because the pass detail opened the screen. The
  overrun is the When pane's line, the overlay's rows and the inventory, all past "the
  route and the link". None of it is a cheap lazy import: main draws each of them before
  the `stars` chunk loads, and the words that only the page draws already moved at R115.
  The 170 KB budget holds with 0.2 KB to spare. R118 changes nothing under `src/`, so the
  figure is recorded rather than trimmed (PLAN D-787), as v2.3's 0.4 KB was (§15.2).

- [ ] The release PR carries this table.

### 16.3 What v2.5's release preparation owes v2.4 (V24-21)

These were v2.4's definition of done and moved to v2.5 with the owner's look:

- [ ] **The stars captures read** — the 20 `v1-stars-*` files of §16.1 in both themes, and
      the per-task captures R115 to R117 filed under `docs/screenshots/r115/`,
      `docs/screenshots/r116/` (Crux over Neuquén, Orion over Paris, at 390 and 1280) and
      `docs/screenshots/r117/`.
- [ ] **The phone held up** — on `main`'s preview (or the deployed v2.5 build), under a clear
      sky: `[ hold up to the sky ]` asks once, the stars turn with the phone round the horizon
      and past the zenith, and three stars and a planet are named against another app
      (US-38 AC1, AC2, AC4; Phase 2l's last item).
- [ ] **The rate on the device** — the screen at ≥ 30 updates/s with every layer on, on the
      FR-GUIDE-6 phone (US-38 AC6); `tests/e2e/stars-perf.spec.ts` read 52.2 at 4× on R116.
- [ ] **Offline** — the page and the screen in aeroplane mode as online (US-38 AC7).

### 16.4 What the owner decides on this release

- [ ] **FR-STAR-9's 0.24 KB** (§16.2): a Decision Log row amending the allowance to the
      measured 1.24 KB, or a v2.5 task to trim main.
- [ ] **The 84 files the phase moved** (§16.1's first three lists): accepted as FR-STAR-3's
      and FR-DESK-4's, or a finding.
- [ ] **`captures.yml`'s header** still counts 254 files and has no `base` input naming
      `6cfa699` (PLAN D-742); it is `ci`'s file, outside R118's lane, so v2.5's release
      preparation brings it up to date.

### 16.5 The release itself — no tag (V24-11)

- [ ] `package.json` is `2.4.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R111..R118).
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R118's PR (its subject starts `R118:`). By PLAN D-742's rule
      it is what v2.5 calls `v2.4.0`; write it here: _(the R118 merge's SHA)_.
- [ ] **No tag and no push to `release`.** The first tag after `v2.2.0` is `v2.5.0` (V24-11),
      and its release preparation runs §15, this section and v2.5's own together.
