## 15. v2.3 (spec §9 Phase 2k)

Everything above still applies, §1 to §5 included, and §13's runs stay the reference for
what every screen does — v2.3 changed how the screens are built, not what they do, and the
capture files that moved are §15.1's list: v2.3 is the design system, the
`v2.2.0` app restyled from one sheet (`src/ui/styles/tokens.css`) and eight primitives
(`src/ui/components/primitives/`), with one product change, F-98's dome degree labels, and
one incidental one, a saved place's `[ × ]` that no longer breaks inside its own brackets
(V23-11). The guide is `docs/DESIGN.md`, generated and held by `tests/docs/design.test.ts`;
the dev page is `dev/primitives.html`, served by `npm run dev` only. Since D-739 the site
moves at the tag and not at the merge: production is the `release` branch, fast-forwarded
to the tagged commit (§15.6), and `main`'s preview is the build this section was checked on.
§13's phone run is v2.1's and stays owed; nothing here needs a phone.

### 15.1 The capture set and the two named moves (FR-DS-5, FR-CAP-5, US-37 AC5)

The phase's rule was that nothing drawn changes, and the proof is the release capture set
re-shot on the phase's last code commit and diffed against `main`'s set at `ed8748a`, the
`v2.2.1` build the phase started from. R109 shot it twice locally off a plain build and
measured every file pixel by pixel (PLAN D-732): **148 of 254 files differ, 106 are
byte-identical**, and every one of the 148 is on one of the two lists below. No polar,
sky-screen, cold-open, location, 360/390/768 home or wide settings file moved; the four
design captures under `docs/screenshots/design/` are byte-identical between runs.

**F-98, the dome's degree labels — 128 files, every file that shows the dome.** The
horizon-tick and 30°/60° ring labels were `--chart-rings` at `opacity: 0.8` (2.7 : 1 dark,
2.53 : 1 night) and are `--chart-compass` at full strength (13.8 : 1 dark, 9.3 : 1 night);
the stylesheet rule and the palette's inline colour both moved (PLAN D-733), and
`tests/e2e/axe.spec.ts` runs `color-contrast` on every node with no exception left. About
900 pixels differ in each file, all inside the drawing, the labels' glyphs:

- `v1-guide-{360,390,768,1024,1280}-{dark,night}-{en,es}` — 20
- `v1-home-{1280,1920}-{dark,night}-{en,es}` and `v1-home-{1280,1920}-view-{dark,night}-{en,es}` — 16
- `v1-legend-{360,390,1280}-{dark,night}-{en,es}` — 12
- `v1-live-scrubbing-{360,390,768,844,1024,1200,1280,1920,2560,3840}-{dark,night}-{en,es}` — 40
- `v1-live-watching-` at the same ten widths, two themes and two languages — 40

**V23-11, a saved place's `[ × ]` — the 20 files that show a long saved name.** `TextButton`
is `white-space: nowrap` (D-246's rule for every control), so the control no longer wraps
between its brackets; the box is 105 × 40 px at 390 px and the 360 px page is one line
shorter (PLAN D-724):

- `v1-favourites-{360,390,1280}-{dark,night}-{en,es}` — 12
- `v1-settings-{360,390}-{dark,night}-{en,es}` — 8

**The two runs of record** are `captures.yml`'s on R109's branch, dispatched by the owner
(FR-CAP-5; PLAN D-708):

- run 1: `https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/39608218384` —
  254 `v1-*` files and the four `design-*` files, **committed as the set** (R109, #178).
- run 2: `https://github.com/CipoBaruf/what-is-in-your-sky/actions/runs/39608235180` —
  agreed with run 1 on every file but 14 legend and live-scrubbing files, the sub-pixel
  noise F-99 names and FR-CAP-5 reads as agreement (R109's two local runs differed in 17
  such files at 3–18 pixels, a channel step of at most 2).

One consequence, decided by the owner at R109's gate and written here so the next phase
reads it right: the committed set is now the Linux renderer's and not the Mac's, so every
`v1-*` file differs from `ed8748a`'s by anti-aliasing and the 148-file list above is the
semantic diff, measured on the Mac before the switch. From here on a `captures.yml` run
compares like with like against the committed set, which is what FR-CAP-5 wanted.

- [ ] The `captures.yml` run on the release commit is green: **254 files** and the four
      design captures, no missing capture, and byte-identical to the committed set but
      for F-99's sub-pixel files. A clock that differs reopens F-99.
- [ ] The two lists above are the whole diff: a file on neither list that differs from
      `ed8748a`'s set by more than anti-aliasing is a finding, not a re-baseline.

### 15.2 The budget (FR-DS-7, US-37 AC6)

`npm run bundle:budget` on the branch, gzip level 9, the same figures as R109's and R107's
(nothing under `src/` changed after R109):

| Chunk | gzip KB | Budget KB | `ed8748a` | Change |
|---|---|---|---|---|
| main | 168.5 | 170 | 166.6 | +1.9 |
| chart (`SkyDome`) | 94.2 | 105 | 94.2 | 0 |
| worker | 36.1 | 40 | 36.1 | 0 |
| astronomy | 22.1 | 25 | 22.1 | 0 |
| window | 12.8 | 15 | 12.8 | 0 |
| live | 9.6 | 15 | 9.6 | 0 |
| service worker | 5.0 + 1.1 | 10 | 5.0 + 1.1 | 0 |
| settings | 1.0 | 10 | 1.0 | 0 |

The stylesheets, gzipped: the main one 10.74 KB against 10.49 at `ed8748a` (+0.25), the
live one 2.07 against 2.24, the dome's 0.88 and the window's 1.54 unchanged, all four
together 15.22 against 15.15. No budget row is raised, and no chunk but main moved.

**Main is 0.4 KB past FR-DS-7's allowance.** The spec allowed the main chunk and the
stylesheet to grow by at most 1.5 KB gzipped over `ed8748a`'s measure, and the eight
primitives cost 1.9 KB (R104–R107's four steps, PLAN D-724, D-727). The 170 KB hard rule
holds with 1.5 KB to spare, the components are already the smallest form of what FR-DS-4
asks (one class map each, no behaviour), and R110 touches nothing under `src/`, so the
figure is recorded rather than trimmed: the owner's gate amends the allowance to the
measured weight with a Decision Log row (PLAN D-732, D-738), or sends a trim to v2.4.

- [ ] The release PR carries this table, and the Decision Log carries the 1.9 KB.

### 15.3 The allow-list's remainder (FR-DS-2, US-37 AC3)

`tests/styles/literals.allow.json` was seeded by R103 at 244 matches in 51 files and
lowered by every primitive task — 180 in 39 after R104, 149 in 32 after R105, 131 in 29
after R106 — to **111 matches in 29 files** at R107; R108, R109 and R110 touched no module,
so that is the remainder, and every entry now says what its literals are (PLAN D-736).
Three kinds, counted across the 29 files:

- **84 the sheet names.** A value `tokens.css` already has a token for, in a module no
  primitive was built on: the `0.75rem` gaps (`--space-2`), the home's `1.2rem` block gap
  (`--space-block`), the type pairs (`--text-question`, `--text-pane`, `--text-heading`,
  `--text-lead`, `--text-body`, `--text-countdown`, `--text-stripe-row`), the charts' px
  sizes (`--chart-text-9` … `-15`), the `1px` borders (`--border`, `--border-control`),
  the `1px`/`2px` radii (`--radius-1`, `--radius-2`), every `z-index` number (`--z-raised`,
  `--z-raised-2`, `--z-sheet`, `--z-overlay`, `--z-banner`), the gutter's spoken-marks clip
  (`VisuallyHidden`'s rule) and five `font-family: inherit` resets the base rule already
  makes. Each is a one-line swap that changes no pixel; none is in this task's lane
  (`docs`, no `src/`), so they are v2.4's first task or OQ-37's, and an entry's count still
  only falls.
- **9 off the scale (OQ-37).** A value no token has and FR-DS-5 forbids moving: three
  `0.5rem` margins and a gap, a `0.25rem` gap, the step line's `2.75rem` min-height, the
  legend swatch's `0.7em` height, the dome key's `0.2em` padding, the link's `0.15em`
  underline offset. Whether they join the grid is OQ-37's question.
- **18 that stay (PLAN D-737).** `global.css`'s `16px` base, which every rem is a share of;
  its one focus ring (two `outline` lines) and two `outline: none` resets, D-704's; the
  skip link's `-10000px`; the generated braille face `'WIYS Braille'`, twice in the dome and
  twice in the mark; the dome's generic `monospace`, glyphcss's output reset, which
  `--font-mono`'s named stack would change; and the compass gutter's drawing in device pixels (seven lengths:
  the bracket's insets and rule, the centre line, the tick and the key's row), px on
  purpose like `--gutter` itself (D-711, OQ-38).

- [ ] `npx vitest run tests/styles` is green on the release commit and the file lists
      the 29 files above with these counts; the next task that touches a module lowers
      its line.

### 15.4 The guide, the dev page and the reading order (FR-DS-6, FR-DS-9, FR-PUB-2, US-37 AC1, AC4)

- [ ] `docs/DESIGN.md` is what `npm run design:guide` writes: `tests/docs/design.test.ts`
      regenerates and compares. It lists every token of the sheet with its dark and night
      value and the contrast the tokens test computes, and every primitive with its props.
- [ ] `README.md` links the guide once, beside *How this was built*, and
      `docs/HOW-THIS-WAS-BUILT.md` names it as its seventh section, the one a session
      reads before it specifies or builds a screen; `tests/docs` holds both.
- [ ] The owner opens `dev/primitives.html` under `npm run dev` and sees every primitive
      in every state and tone in both themes side by side, at 390 px and wide, and then
      opens `docs/DESIGN.md` once more. The four captures under `docs/screenshots/design/`
      are what `npm run design:captures` wrote on the release commit.
- [ ] The stars spec (v2.4) names tokens and primitives by the names the guide prints,
      and the four reserved chart tokens (`--chart-star`, `--chart-star-dim`,
      `--chart-figure`, `--chart-planet`) are what it draws with (FR-DS-8, FR-DS-9).

### 15.5 What the owner decides on this release

- [ ] **FR-DS-7's 0.4 KB** (§15.2): a Decision Log row amending the allowance to the
      measured 1.9 KB, or a v2.4 task to trim main.
- [ ] **The allow-list's 84** (§15.3): a v2.4 task that writes the sheet's names into the
      remaining modules, or OQ-37 absorbing them with the scale question.
- [ ] **The visual-review captures that show the dome.** The `r*-` files under
      `docs/screenshots/` a `ui` task shot still carry the old degree labels (R109 restored
      them, out of its scope); they are per-task evidence and not the release set, so they
      stay as shot unless the owner re-shoots them.
- [ ] **F-99** stays open with the 14 files of run 2 (§15.1); **F-97** waits on a phone
      (§13.1's last item); **OQ-33** is still open for want of a night (§13.5).

### 15.6 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.3.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R103..R110).
- [ ] `npm run check:dead` on the release commit reports nothing, and the bundle table is
      §15.2's.
- [ ] Find the release commit: `git fetch origin && git log --oneline -3 origin/main`, and
      take the squash merge of R110's PR (its subject starts `R110:`). Its SHA exists only
      once the PR merges, so no task note can carry it; write it in below, not whatever
      `main` has reached by then (V22-12).
- [ ] Tag it: `git tag -a v2.3.0 <sha> -m "v2.3: the design system" && git push origin
      v2.3.0`.
- [ ] Deploy it: `git push origin <sha>:release` with the same SHA
      (D-739; `docs/DEPLOY.md`), and run §2 and §5 against `https://inyoursky.app`.
- [ ] Dispatch `captures.yml` on the release commit and read it against §15.1.
- [ ] Record in the release PR: the bundle table, the knip output, the capture run's
      number, and the date.
