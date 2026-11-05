## 26. v2.14 (spec §9 Phase 2w)

Everything in `docs/RELEASE.md` still applies, §1 to §5 and §10 included. v2.14 is one sky on a
desk (V214-1..V214-22): at 1280 px and wider the live page, the stars page and a pass open on the
celestial globe in one shell — the box on the left, the rail on the right in the order head, `View`,
`Time`, the page group, the list — with the window and the dome as choices (`[ Globe ] Window Dome`,
FR-WIDE-1, FR-WIDE-2, FR-WIDE-6); the passes' arcs, ticks and arrow on the globe and the window, the
planets drawn on both, one time control with the cloud band on all three pages (FR-WIDE-3..8); the
facts of a satellite, a star, a planet and the Moon (FR-FACT-1..3); the keys and the full sky
(FR-WIDE-9, FR-WIDE-10); and at every width the Spanish star names and a label for every bright
unnamed star (FR-NAME-1..3), the kept choices (FR-KEEP-1..3) and the privacy note's `[ × ]`
(FR-KEEP-4). R182–R190 built it; R191 is this record: the captures, the budget, the README, the
reading order, the images, the repository's description and topics, and `package.json` 2.14.0.
`main` reads `2.14.0` once R191 merges. v2.13 had no release of its own (V213-12), so the tag the
last record asks for is `v2.12.0` and this one's is `v2.14.0`.

### 26.1 The capture set (FR-WIDE-12, FR-CAP-5, V214-22)

The set has **464 files**: 2.13's 436, plus the eight screens R186–R189 added at 1280 × 800 over
Bariloche at the set's instant in both themes and languages (32: `sky-live-globe`, `sky-pass-globe`,
`sky-pass-facts`, `sky-live-facts`, `sky-stars-star-facts`, `sky-hover`, `sky-clouds`,
`sky-fullscreen`), less `polar` at 1280 (4), which a desk no longer offers: since R186 a desk's view
row is `[ Globe ] Window Dome` and a saved `polar` opens there on the globe (FR-WIDE-2, D-1095), so the
file was `sky-pass-globe` under a second name. `captureIds.test.ts` and `captures.test.ts` hold the
eight ids and the count.

**What R191 fixed before the set could be shot whole** (D-1131). The `captures` branch's last
commit is `70901e4a`, the set of `79beb7e2` (R185): no run after R186 wrote one, and on this branch
the whole set failed on 28 files before the fixes. The globe screens waited for an arc that is not
drawn at the set's instant: the one pass in FR-LIVE-2's set (Tiangong, N low → 48° NNE → E) is on
the far side of FR-GLOBE-5's pole-side opening view, as R186's note in `globe.spec.ts` says, so its
path is empty as the page opens. `globeDrawn` now turns the globe by its own `ArrowLeft`, once round
and back to the step that draws most of the arc; the pass detail is pinned to the pass's instant
before the wait, since R190 opens it at now (FR-KEEP-2); and its scroll waits for `svg[data-globe]`,
which is not a `[data-drawing]`. `polar` at 1280 left the set for the reason above.

**How it was measured.** R191 ran headless, with no `gh`, so it could not dispatch `captures.yml`,
which is the set's reading of record (FR-SDD-22; a Mac's raster differs from the Linux one on every
file, `docs/sdd/gotchas.md` *captures*). On one ten-core Mac, off a plain build of the branch, the
whole set shot green: 464 files, three `guide` files at 1024 and 1280 on a second try (the dome's
glyph wait under eight workers; each passed alone). The Mac's files are not committed — the set lives
on the `captures` branch — and were not diffed against 2.13's, since that diff is the workflow's.

**What should move, by its named change** (V214-22: most of the set does). The owner reads the
moved files in the workflow's pixel-diff report against 2.13's set; a file that moved for none of
these reasons is a finding.

- **The desk shell** (FR-WIDE-1, FR-WIDE-4, FR-WIDE-5, FR-WIDE-8): every `v1-live-*`, `v1-guide-*`
  and `v1-legend-*` file at 1024 and wider — the rail in its order, the one time control with the
  cloud band, the box's corners, the dome seeded as the reader's choice (R186, D-1098) — and the wide
  `v1-stars-*` files, the view row `[ Globe ] Window Dome`, the day steps under the time control.
- **The globe on the stars page** (FR-WIDE-3, FR-NAME-3): every `v1-stars-globe*` file — the
  planets' discs, the arcs where a pass is shown, the shell's rail.
- **The names** (FR-NAME-1, FR-NAME-2): every Spanish file with a star name drawn or listed
  (`Sirio`, the reviewed names), and every window and polar file at every width with a bright
  unnamed star, which now carries its designation.
- **The privacy note's `[ × ]`** (FR-KEEP-4): every file showing the footer's privacy part or the
  place search's line, at every width (the home, Where, favourites, the live and stars pages).
- **The new 32** above, and **the 4 gone** (`v1-polar-1280-*`).
- **Unchanged, compact** (US-52 AC7): every 360, 390 and 844 file moves only by the names and the
  `[ × ]`; any other compact move is a finding.
- **The known noise:** F-99's one-second clock and edge files (§25.1's kinds).

- [ ] After R191's squash merge, run `captures.yml` on `main` by `workflow_dispatch` with the base
      set `503daa60` (the `captures` commit of `1382c0bb`, R178: 2.13's screens, since R179–R181
      changed none), twice: run 1 _(id, report link)_, run 2 _(id)_.
- [ ] Run 1 is green: **464 files** and the design captures, no capture missing.
- [ ] Run 1's pixel-diff report names only the moves above, the 32 new files, the 4 gone and
      F-99's noise; each moved file is tied to one of the named changes here.
- [ ] Run 2 agrees with run 1 but for F-99's noise (FR-CAP-5).

### 26.2 The budget (FR-WIDE-11, D-178, V214-20)

`npm run bundle:budget` on the branch, gzip level 9, beside `0159b04e` (2.13: R181, the phase
report, the last commit before v2.14's spec) built in the same run on the same machine, both plain.
D-178 re-sets every row: the measure × 1.1, up to the next 5 KB line, floored at 10 and inside its
ceiling. The budget column is `scripts/bundle-budget.ts`'s rows; `tests/docs/accuracy.test.ts`
checks it against them:

| Chunk | gzip KB | Budget KB | `0159b04e` | Change |
|---|---|---|---|---|
| main | **192.0** | 185 (**over**, §26.4) | 182.8 | **+9,430 bytes** |
| chart (`SkyDome`) | 97.1 | 110 | 97.1 | −3 bytes |
| stars-deep (`deep`) | 41.8 | 50 | 41.8 | 0 |
| worker | 36.1 | 40 | 36.1 | 0 |
| stars (`Stars` + `catalog`) | 30.8 | 35 | 31.4 | −555 bytes |
| astronomy (`astronomy` + `skyBodies`) | 28.0 | 30 | 24.1 | +4,003 bytes |
| window (`SkyWindow`) | 14.3 | **20** (was 15) | 13.0 | +1,250 bytes |
| globe (`SkyGlobe` + `GlobeRail` + `scene`) | 13.6 | 15 | 13.7 | −30 bytes |
| live | 11.5 | **15** (was 20) | 13.7 | −2,175 bytes |
| service worker | 5.0 | 10 | 5.0 | 0 (the worker script 1.4 → 1.5 KB, the new chunks in the precache) |
| facts | 4.8 | 6 | — | +4,880 bytes |
| settings | 1.2 | 10 | 1.2 | −1 byte |

**`main` is +9,430 bytes** (187,170 → 196,600): past `SKY_MAIN_KB` (2.0 KB) and past the 190 line.
Built at each of the phase's merges in one scratch tree: P10 −2, R182 +638, R183 0, R184 +15,
R185 +7, R186 +770 (the shell), R188 +695 (the hover, `LazyFacts`, `orbitHeight`), **R187 +5,418**
(the one time control — the overview, the stripe and the playback row — which the pass detail
shares, and the pass detail is the home's, so the control left the lazy `Live` chunk for `main`),
R189 +1,376 (the key table and the overlay), R190 +493 (the kept choices and the `[ × ]`). D-178's
rule (192 × 1.1 = 211.2, so 215) is past the 185 ceiling, so the row stays at 185 and warns; the
ceiling is the owner's (V214-20, §26.4). **`live` moves down** for the same reason `main` moved up
(the time control and the head left it for the shell), and is re-set to 15. **`window` moves up**
with the ticks, the arrow, the arc's hover and the planet discs (R185) and is re-set to 20.
**`astronomy`** is +4.0 KB with the rise and set of a star, a planet and the Moon (R183), at 28.0
under its 30 ceiling, the rule's 35 capped there. **`stars`** matches the shared `catalog-*.js`
too since R191 (D-1130): R186's globe on the live page and the pass detail draws the stars, so the
catalogue (23.4 KB) left `Stars-*.js` (7.5 KB) for a chunk the three pages share, and the row keeps
it budgeted rather than letting it fall into the unbudgeted list. **`globe`** is inside
`SKY_GLOBE_KB`: R186's 16.0 came back to 13.6 when the arcs' geometry (`arcs-*`) and the projection
(`projection-*`) became chunks the window and the globe share. **`facts`** is the new row at
`FACTS_BUDGET_KB` (6), the rule's floor of 10 capped there.

### 26.3 What the phase removed

`npm run check:dead` reports nothing. Removed in the phase: `GuidePanel` (R186, D-1118, the pass
detail's old wide panel, gone into `SkyViewLayout`), the wide polar option (R186: the polar chart is
the phone's), the stars page's resetting of the view and the faint stars at each open (R190,
FR-PHONE-7 and FR-GLOBE-10 amended) and, from the set, `polar` at 1280 (§26.1). No message key
left without its screen.

### 26.4 What the owner decides on this release

- [ ] **`main` at 192.0 KB** (§26.2, V214-20): raise the ceiling and the row to 195, the next 5 KB
      line over the measure (two lines past 185, where V214-20 foresaw one), or open a task that
      moves the time control out of `main` behind the pass detail's lazy route (R187's +5.4 KB).
- [ ] **The arc at the opening view** (§26.1, D-1131): at the set's instant the desk's live page and
      pass detail open on the globe with the one pass behind it (FR-GLOBE-5's pole-side view against
      FR-WIDE-3's arcs); the captures turn to it. Keep, or a finding for a pass-facing opening view
      on the two pages that draw passes.
- [ ] **`CLOUD_STEPS` 20 / 50 / 80 against the pass card's 30 / 70** (D-1112): align the band to the
      card, the card to the band, or keep both.
- [ ] **FR-WIDE-6's "no `wiys-braille` font"** (D-1120): the header's mark asks for the font on
      every page, so only the dome's chunk is pinned absent; amend the spec text or keep.
- [ ] **D-1132 and D-1133**, numbered after the task blocks: six CI shards, and the shell
      superseding FR-WATCH-6's overlay bar on wide.
- [ ] **The hero's sources** (§26.6): the two README captures were shot on the Mac; replace them
      with `captures.yml` run 1's Linux files and re-run `npx tsx scripts/readme-hero.ts`, or keep.

### 26.5 The usage report (FR-SDD-1, FR-SDD-21)

From `sdd-run/usage.jsonl` (the driver's ledger, local to the owner's machine): the phase's
implement and review sessions, R182–R190, used **84.1 M tokens** (input, cached input, cache writes
and output together); the most expensive were **R185 (32.5 M)** and **R184 (30.5 M**, a `hard` run
stopped at its model limit and the `standard` rerun). R186 ran three `standard` sessions to their
budget and a `hard` one to its limit, and the ledger holds no tokens and no finished run for it, so
the total is a floor. Changed lines per merge (insertions + deletions): R182 555, R183 426,
R184 997, R185 753, R186 3,481, R187 1,994, R188 1,532, R189 1,044, R190 787. Each review ran on
`light` (sonnet) in about a minute. The phase opened no `F-` finding; no test was quarantined; the
CI reruns per PR are in each PR's checks, which this session could not read (no `gh`). No tier's
ceiling is set here (FR-SDD-2): the phase does not call for it.

### 26.6 The README, the reading order and the images (FR-PUB-14, FR-PUB-15, D-1107)

`README.md` is rewritten for 2.14.0: the prologue names the satellites, the stars, the planets and
the desk's globe; the live line reads `2.14.0`; "How it is built" names `AGENTS.md`, the index files,
the phase folders, the Decision Log, `ids.md` and the tiers of `sdd.agents.json`; "By the numbers"
carries the date it was read; "Stack" describes the views as they are, with nothing in progress.
`docs/HOW-THIS-WAS-BUILT.md`'s reading order starts at `AGENTS.md`, then `SPEC.md` and `PLAN.md` as
indexes, a phase folder, `ids.md` and `npm run sdd:id`, the driver, and R28 end to end, its entry
linked in `docs/sdd/phases/v1/tasks.md`. `tests/docs/readme.test.ts` checks FR-PUB-14's four rules
and FR-PUB-15's order and links.

`npx tsx scripts/readme-hero.ts` composed `docs/readme/hero.png` (1200 × 716) and
`docs/readme/social-preview.png` (1280 × 640) from two captures copied into `docs/readme/sources/`:
`v1-live-watching-390-dark-en.png` (a phone on the window over the pass that is up) and
`v1-sky-pass-facts-1280-dark-en.png` (a desk on the globe with the pass's arc and `This satellite`).
The 2.13 hero's other two sources, the stars page on a phone turned sideways and the pass detail on
the window at 1280, left the folder. The preview now fits each of its two columns to the height on its own, since a desk
tile beside the phone cannot fit 640 px when it takes all the room left.

### 26.7 The repository's description and topics (FR-PUB-16)

Sessions have no network; the owner applies these with `gh repo edit` and reads them back.
`docs/RELEASE.md` §10 carries the same text as the repository's standing metadata.

- **Description:**

      Naked-eye sky in the browser: which satellites cross your sky tonight, when and where to look, and the stars, constellations and planets on a celestial globe.

- **Homepage:** `https://inyoursky.app`
- **Topics** (twenty; the twelve of 2.13 kept):

      `astronomy`, `iss`, `orbital-mechanics`, `pwa`, `react`, `satellite`, `satellite-tracking`,
      `sgp4`, `spec-driven-development`, `stargazing`, `typescript`, `web-worker`, `star-chart`,
      `constellations`, `celestial-globe`, `offline-first`, `i18n`, `cloudflare-workers`,
      `claude-code`, `ai-agents`

- [ ] Apply them:

      ```
      gh repo edit \
        --description "Naked-eye sky in the browser: which satellites cross your sky tonight, when and where to look, and the stars, constellations and planets on a celestial globe." \
        --homepage https://inyoursky.app \
        --add-topic astronomy,iss,orbital-mechanics,pwa,react,satellite,satellite-tracking,sgp4 \
        --add-topic spec-driven-development,stargazing,typescript,web-worker,star-chart,constellations \
        --add-topic celestial-globe,offline-first,i18n,cloudflare-workers,claude-code,ai-agents
      ```

- [ ] Read them back equal to the text above:

      ```
      gh repo view --json description,repositoryTopics,homepageUrl
      ```

- [ ] Upload `docs/readme/social-preview.png` as the social preview (§10).

### 26.8 The desk and the phone (US-52..US-57)

On the release build, at a desk at 1280 × 800 and 1920 × 1080, and on the phone. Write what each step
showed beside it.

- [ ] **One shell:** the live page, the stars page and a pass from the home each show the box on the
      left and the rail on the right — head, `View`, `Time`, the page group, the list — with the
      app's header and footer.
- [ ] **The views:** `View` reads `[ Globe ] Window Dome` on all three; a new reader opens on the
      globe; `Dome` on one page opens the other two on it, after a reload too; the dome's chunk is not
      asked for before it is chosen.
- [ ] **A pass's arc:** on the live page and a pass, the globe draws each pass in its legend colour
      with the shown instant's marker, the ticks and the arrow; turn the globe to an arc behind it.
- [ ] **One time control:** the overview, the stripe while scrubbing and the playback row on all
      three pages, the cloud band along the overview and the stripe; the stars page adds
      `−1 d` `−1 h` `+1 h` `+1 d`; a pass's rise, peak and set are buttons that move the time.
- [ ] **The facts:** `This satellite` under a pass's times; a legend row clicked on the live page
      opens its facts with `[ × ]`; a star, a planet or the Moon clicked on the stars page opens
      theirs, with the night's rise and set.
- [ ] **The hover:** the pointer on a legend row emphasises its arc, the others dimmed; on an arc,
      its row.
- [ ] **The keys:** `?` opens the table; `g` `w` `d` change the view, `,` `.` step the time, `t`
      returns to now, `Space` plays, `a` follows, `f` gives the box the whole screen and `Esc` leaves.
- [ ] **The planets and the names:** the planets drawn as discs with their names on the globe and
      the window; in Spanish `Sirio` and the reviewed names; a bright unnamed star carries its
      designation.
- [ ] **Kept:** choose a view, the layers, the names, the faint stars, the turn, a zoom and a speed;
      reload and open a new tab: each comes back, and the time is now.
- [ ] **The phone:** at 390 the pages are as on 2.13 but the names, the kept choices and the privacy
      note; `[ × ]` on the note hides it on the home and on the stars page for good, and the settings
      page still says it.

### 26.9 The release itself — `v2.14.0`

- [x] `package.json` is `2.14.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R182..R191).
- [ ] §26.4's items are decided.
- [ ] §26.1's two `captures.yml` runs are recorded, with run 1's report linked.
- [x] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §26.2's.
- [ ] §26.7's metadata is applied and read back.
- [ ] §26.8's desk and phone run is written down.
- [ ] Find the release commit: the squash merge of R191's PR (its subject starts `R191:`). Write
      it here: _(the SHA)_. Tag the squash merge of this PR, and nothing else.
- [ ] Tag it: `git tag -a v2.14.0 <sha> -m "v2.14: one sky on a desk" && git push origin v2.14.0`.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA (D-739; `docs/DEPLOY.md`),
      and run `docs/RELEASE.md` §2 and §5 against `https://inyoursky.app`.
