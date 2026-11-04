# v2.3 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.11 Goals (v2.3, "the design system")

- **G37. One sheet.**
  Every colour, length, type size, border and stacking level a screen uses is a token in `tokens.css`, written from the grid, and a module names the token and never the value.
- **G38. Drawn once.**
  A text control, a link, a toggle, a card, a divider, a status line and a field are each one component; a feature lays them out and does not restyle them.
- **G39. Held by a test and read from a guide.**
  A literal that lands in a module fails CI; a new screen or a redesign starts from `docs/DESIGN.md`, which is generated from the sheet and the primitives and cannot drift from them.

**US-37 — Build a screen from the guide** *(v2.3)*
As a developer adding a screen — or a session the driver starts on a task — I open `docs/DESIGN.md`, pick the tokens and the primitives it shows, and the screen I build is indistinguishable in style from the ones already there, without reading another module.
- AC1: The guide lists every token in `tokens.css` with its value in both themes and every primitive with its props, and a test fails when either drifts from the files (FR-DS-6).
- AC2: A `[ label ]` control I add is a `TextButton`, a `BracketLink` or an `OptionToggle`; writing the brackets in a module's CSS fails the literals test (FR-DS-2, FR-DS-4).
- AC3: A length, a colour or a stacking level I write in a module is a token or a cell count; a `px`, `rem` or hex literal fails the literals test unless the file and the reason are in its allow-list, whose counts only go down (FR-DS-2).
- AC4: A redesign that changes a token's value or a primitive's module changes every screen that uses it and no screen it does not, and the dev page shows the change in both themes before any screen is touched (FR-DS-6, FR-DS-9).
- AC5: The release capture set, re-shot at the end of the phase, is byte-identical to the one on `main` except the files F-98's labels appear in and the twenty the saved place's `[ × ]` moves (FR-DS-5, V23-11).
- AC6: No chunk is larger than at `v2.2.0` by more than the primitives' own weight, which the phase states; the main chunk stays under its 170 KB budget (FR-DS-7).

### 4.45 The design system *(v2.3)*

The app has one look — monospace on a dark ground, a 1ch × 24 px grid, bracketed controls, 1 px rules, two palettes — and it has had it since R12.
What it has not had is the look written down once.
At `ed8748a`, 60 of the 62 stylesheets name their colours from `tokens.css` and nothing else from anywhere: the `[ label ]` control (`::before "[ "`, `::after " ]"`, the accent, the dim brackets, the reset of border, background and padding) is written in about thirty modules; half a row is `0.75rem` in 22 places, `calc(var(--row) / 2)` in 19 and `12px` in two paddings (and the three charts' label size in three more); `OptionToggle` exists and is re-implemented in `PlaybackControls` (twice) and `SortToggle`; six rem sizes and five line heights carry the type above `--small` with no names; `z-index` is 1, 2, 10, 20 and 100 in seven files beside one `--z-screen`; an `outline` rule stands in ten modules beside `global.css`'s ring and the visually-hidden block in three; `max-height: 500px`, `700px` and `720px` match five rules with no constant behind them, and `ChartFrame.module.css` carries the tree's one `@container` query; and nothing fails when a new literal lands.
The redesign's canvas (`handoff/design-canvas.html`) calls itself the system's source of truth and names tokens (`--color-accent-100`, `--space-*`, `--radius`) the app does not have.
This block makes the sheet complete, the primitives the only place a control is styled, the rule enforced, and the guide generated — and changes what is on screen in exactly one place.

- **FR-DS-1** **The sheet.**
  `tokens.css` carries every value a module may use, in named sections, every length written from `--row` (24 px) or `--cell` (1ch) so the grid is the source and not a coincidence:
  - **Space** (vertical, new): `--space-1` = `calc(var(--row) / 4)` (6 px), `--space-2` = `calc(var(--row) / 2)` (12 px — the one name for `0.75rem`, `calc(var(--row) / 2)` and `12px`), `--space-3` = `var(--row)`, `--space-4` = `calc(1.5 * var(--row))`, `--space-5` = `calc(2 * var(--row))` (= `--tap`).
    Horizontal space stays in cells (`calc(2 * var(--cell))`), as it is.
    Board 1B's block gap, 1.2 rem (FR-FIRST-1, FR-FIRST-2, V20-23), is kept at its value as `--space-block`, since it is the home's contract and not a rounding error; whether it should join the grid is OQ-37's.
  - **Type** (new): every size-and-line-height pair in use at `ed8748a` becomes one named pair, `--text-<name>` and `--text-<name>-row`, with `--small`/`--small-row` kept as they are; the chart's pixel sizes (9, 11, 12, 14, 15 px) become `--chart-text-<n>` tokens, in px on purpose because the drawings do not scale with the base.
    No value changes in this phase (FR-DS-5); the guide prints the ladder, and collapsing it is OQ-37.
  - **Edges** (new): `--border` = `1px solid var(--rule)`, `--border-control` = `1px solid var(--edge)`, `--radius-0/1/2` for the three radii in use, `--focus-ring` and `--focus-offset` (2 px and 2 px, the one rule in `global.css`) with `--focus-offset-tight` (1 px) for the two stripes, `--weight-bold` = 700, `--window-fill-opacity` for `SkyWindow`'s 0.88.
  - **Layers** (new): `--z-raised` 1, `--z-raised-2` 2, `--z-sheet` 10, `--z-overlay` 20, `--z-screen` 30 (kept), `--z-banner` 100 — every `z-index` in the tree, named for what stands at it.
  - **Colour**: unchanged, with FR-DS-8's four additions.
    The night selector restates every colour token and nothing else (FR-THEME-1 as amended).
    `tests/styles/tokens.test.ts` keeps its contrast table and gains the new colour rows.
- **FR-DS-2** **No literal in a module.**
  `tests/styles/literals.test.ts` reads every stylesheet under `src/` except `tokens.css` and fails on: a colour literal (hex, `rgb()`, `hsl()`, a named colour); a `px`, `rem` or `em` length other than `0`; a `z-index` number; an `outline` rule other than `outline-offset: var(--focus-offset-tight)` (the ring is `global.css`'s alone; the two stripes tighten its offset from the sheet and nothing else); a `font-family` that is not `var(--font-mono)`; a `::before`/`::after` whose `content` is `"[ "` or `" ]"` outside `ui/components/primitives/`; and, in a `.tsx` file, an inline `style` whose value is a colour or a length literal (custom properties and geometry measured at runtime — a dome cell in px, a gutter tick's `left` in % — are allowed and are what the eleven inline styles at `ed8748a` set).
  `tests/styles/literals.allow.json` lists the exceptions keyed by file path, one entry per file with its reason and its count, so two lanes lowering two files touch two lines and never the same one; a count may only go down, and an entry whose count reaches zero is removed.
  The test runs in `npm test` and is what FR-X-6's amendment refers to.
- **FR-DS-3** **Breakpoints, one source and one syntax.**
  Every length in an `@media` or `@container` condition is one of `lib/layout.ts`'s exported thresholds, which gain three: `SIDEWAYS_MAX_HEIGHT_PX` (500, the landscape phone's shape rule in `global.css` and `Live.module.css`, FR-WATCH-5), `SHORT_MAX_HEIGHT_PX` (700, the compact page's short-window rules in `App.module.css` and `LocationInput.module.css`) and `WIDE_SHORT_MAX_HEIGHT_PX` (720, the wide home's), each with a comment saying which rows it folds and why, and all three carried into `tests/styles/breakpoint.test.ts` the way the widths are; `ChartFrame.module.css`'s one `@container (min-width: 62ch)` is a cell count and is held to a named constant the same way.
  Every condition is written in range syntax (`(width >= 964px)`, `(height <= 700px)`); the rewrite from `min-width`/`max-width` is mechanical and changes no matching size, which the test states by asserting the set of thresholds before and after.
  Range syntax is the browser floor from here on — Safari 16.4, Chrome 104, Firefox 63 — and the spec had none older (V23-10).
  *Verification:* `breakpoint.test.ts` lists every condition in the tree and holds each to a threshold and to the syntax.
- **FR-DS-4** **Eight primitives, the only place a control is styled.**
  Under `ui/components/primitives/`, one component with one module each, every one `--tap` tall where it is a control and FR-COMP-4's width rule unchanged:
  1. `TextButton` — the `[ label ]` button: `label`, `onClick`, `disabled`, `tone` (`accent` | `dim` | `danger`), `pressed` for the rare pressed text control; brackets as `::before`/`::after` in `--fg-dim`, the reset once.
  2. `BracketLink` — the same look on an `<a>`: `href`, `label`, `current` (the header's inverted current page).
  3. `OptionToggle` (kept) and `ToggleGroup` — the `[ ] option` / `[x] option` row with a `role`, a group label and arrow-key movement; the chart view control, the sort row, the playback toggle and the speeds are groups, and `SortToggle`'s and `PlaybackControls`' private copies go.
  4. `Card` — `as` (`article` | `button` | `a`), `selected`, children; `--border`, `--space-2` padding, the focus rule inherited and never restated; `PassCard` and `NextEventBlock` are built on it.
  5. `Rule` and `SectionHeading` (kept) — the plain divider and the `── Title ──` heading; `Rule` replaces the bare `border-top`/`border-bottom` lines a module draws today.
  6. `Line` — one line with a leading marker and trailing actions: `tone` (`status` | `ok` | `notice` | `failure`), `children`, `actions`; `FailureLine`, `ReadinessLine`, `VisitNotice`, `Banner` and `ElementsLine` render through it and keep their names and their copy.
     Colour is never the only channel (FR-X-5): the marker is the second.
  7. `Field` — a label, an input, an optional trailing action and a hint row; widths in cells; `CoordsInput`, `LocationInput` and `PlacePicker` compose it.
  8. `Stack`, `Cluster` and `VisuallyHidden` — a column with a `gap` from the space scale, a wrapping row of controls, and the one copy of the clip rule.
  A feature module may place a primitive (a grid area, a margin from the space scale) and may not set its colour, font, border, padding or brackets; a feature component that wants a different control asks for a prop, and a prop is added to the primitive for every module that needs it, never a local override.
  *Verification:* FR-DS-2's test for the brackets; a component test per primitive in both themes; `controlRows.test.ts` unchanged and green, since no row's text changes.
- **FR-DS-5** **Pixel-identical, except one named move** *(amended at R104's gate, V23-11: two)*.
  The phase changes what is drawn in one place: F-98's dome degree labels drop `opacity: 0.8` and are drawn in a text token that clears 4.5 : 1 at their size in both themes (the tokens test picks it: `--chart-compass` is 13.8 : 1 dark and 9.3 : 1 night), and `axe.spec.ts`'s `color-contrast` exception for those nodes is removed.
  Everything else is a rename: the release capture set (FR-CAP-1..5, 254 files) re-shot on the phase's last commit is byte-identical to the set on `main` at `ed8748a` except the files that show the dome's degree labels and, from R104 (V23-11), the twenty that show a saved place's `[ × ]` beside a long name — the 12 `v1-favourites-*` and the 8 `v1-settings-{360,390}-*` — where the control no longer breaks inside its own brackets (`TextButton` is `white-space: nowrap`, D-246's rule for every control) and the 360 px row is one line shorter; both lists by name in the release notes; F-99's sub-pixel differences are read as FR-CAP-5 reads them, two runs on the phase commit.
  *Verification:* `tests/docs/captures.test.ts` and the `captures.yml` run on the branch, with the diff listed in the PR.
- **FR-DS-6** **The guide, generated; the page, dev-only.**
  `scripts/design-guide.ts` writes `docs/DESIGN.md` from `tokens.css` (every token, section by section, with its dark and night value and the contrast the tokens test computes) and from `ui/components/primitives/manifest.ts` (each primitive, its props and one sentence on when it is the right one), followed by the rules of this block in plain words and a link to the dev page's captures; `tests/docs/design.test.ts` regenerates and compares, the way FR-SHOW-1 holds the README.
  The dev page, `dev/primitives.html` with `dev/primitives.tsx`, is a second Vite entry served by `npm run dev` and excluded from `vite build` (no chunk, no budget row, nothing deployed): it renders every primitive in every state and tone, in both themes side by side, at compact and wide.
  The capture set's Playwright config serves the production build (`vite preview`), where the page does not exist, so `npm run design:captures` runs a second config, `playwright.design.config.ts`, whose web server is `vite` itself; it shoots the page at 390 and 1280 px into `docs/screenshots/design/`, `captures.yml` runs it after the set, and those files join the set's diff (FR-CAP-1's rule), so a redesign's change to a token or a primitive is a visible diff in review before any screen is touched.
- **FR-DS-7** **It costs nothing a reader downloads.**
  The main chunk is 166.6 KB gzipped against a 170 KB budget (`scripts/bundle-budget.ts`): the primitives replace CSS and markup that exist, so the chunk and the stylesheet may each grow by at most 1.5 KB gzipped over `ed8748a`'s measure, stated in the PR from `npm run bundle:budget`'s table, and no budget row is raised.
  FR-SHOW-5's method applies: `git diff --stat` of `src/` is the phase, and the deployed app is the same app.
- **FR-DS-8** **Four chart tokens, reserved.**
  `--chart-star`, `--chart-star-dim`, `--chart-figure` (constellation lines) and `--chart-planet` join the `--chart-*` family with a dark and a night value each: the star in `--fg`'s class (≥ 10 : 1 on `--bg`), the dim star in `--fg-dim`'s (≥ 4.5 : 1), the figure in `--chart-rings`' (≥ 3 : 1, a line and never text), the planet distinct from a star in lightness and, in the dark theme, in hue (≥ 7 : 1); night values red with `r ≥ g ≥ b` as FR-THEME-3 asks; every pair measured by the tokens test now.
  Nothing draws with them in this phase, as nothing drew with the R16 tokens before R21: they are here so v2.4 draws from the sheet and does not open it.
  *(amended v2.4.1, V24-13)* v2.4 adds four: `--chart-text-18` (the ladder's top size), `--chart-hairline` (0.75 px, the figures' width), `--chart-star-faint` (the faintest rung, a mark, ≥ 3 : 1 and below `--chart-star-dim`) and `--chart-figure-name` (the figure names, text, ≥ 4.5 : 1 and below `--chart-star-dim`), each colour with a night value red with `r ≥ g ≥ b`, measured by the tokens test.
  The four above are used as reserved.
  *(amended v2.10, V210-7, V210-10)* v2.10 adds eight: `--chart-sky-deep`, `--chart-sky-twilight`, `--chart-sky-day` and `--chart-horizon-glow` (surfaces, FR-LOOK-1, FR-LOOK-2), `--chart-haze` (FR-LOOK-3), and `--chart-star-blue`, `--chart-star-yellow` and `--chart-star-orange` (marks, ≥ 3 : 1 on `--chart-sky-deep` and on the band's lightest value, FR-LOOK-5); each with a night value red with `r ≥ g ≥ b`, measured by the tokens test.
  `--chart-star-dim` and `--chart-star-faint` stay for the names.
- **FR-DS-9** **How a redesign lands.**
  A design handoff names the sheet's tokens and the primitives by the names the guide prints; a handoff that invents names (the 2026 canvas's `--color-accent-*`) is translated into the sheet before a task is cut, and the translation is part of the spec prompt.
  The order of work in a redesign is the sheet, then the primitives, then the dev page's captures, then the screens — a screen's module is never the first file a redesign touches.
  The canvas of 2026-10-19, which drew this phase and the stars, names the sheet's tokens and is the stars' handoff; like `handoff/`, it is not tracked (FR-SHOW-3's rule for local material).
  *Verification:* none in code; the guide's last section says this, and `sdd-spec` reads it.

### 5.11 v2.3 additions *(proposal; the plan decides)*

- **The sheet.**
  `tokens.css` re-cut into sections (grid, space, type, edges, layers, colour dark, colour night) with the derivations as `calc()` and the comments the tokens test reads.
  `--space-block` beside the space scale, named for board 1B.
- **The primitives.**
  `ui/components/primitives/` with one `.tsx` and one `.module.css` per primitive and a `manifest.ts` the guide and the dev page both read, so a primitive cannot exist without a line in the guide.
  `SortToggle`, `PlaybackControls`, `PassCard`, `NextEventBlock`, `FailureLine`, `ReadinessLine`, `VisitNotice`, `Banner`, `ElementsLine`, `CoordsInput`, `LocationInput` and `PlacePicker` become compositions and keep their files.
- **The tests.**
  `tests/styles/literals.test.ts` with `literals.allow.json`; `breakpoint.test.ts` extended with the three height thresholds, the container query's cell count and the syntax rule; `literals.allow.json` keyed by file so lanes do not collide on it; `tests/docs/design.test.ts`.
  No stylelint and no new dependency: a task session cannot install one (D-647's reason), and the tokens test already parses the sheet.
- **The guide and the page.**
  `scripts/design-guide.ts`; `dev/` as a Vite entry listed only under `server` (never in `build.rollupOptions.input`); `scripts/design-captures.ts` on `playwright.design.config.ts`, a wrapper whose web server is the dev server (the set's own serves the build, where the page is not).
- **The dome's labels.**
  `SkyDome.module.css`'s `.degree` loses its opacity and reads `--chart-compass`; `tests/e2e/axe.spec.ts` loses its exception (F-98, D-617's rule in reverse).
- **Delivery.**
  The sheet and the literals test first, in one task, with the allow-list seeded at today's counts; then the primitives by lane with the allow-list's counts falling in each; then the guide, the page and the captures; then the re-shoot and F-98.
  Every task green on the capture diff, not only the unit tests.

### Phase 2k — v2.3 ("the design system", as decided 2026-10-19, V23-1)

After the `v2.2.1` material and before the stars.
One product change (F-98's labels); otherwise the app the reader opens is the `v2.2.0` build restyled from one sheet.
The tasks, in order:

- The sheet and the literals test (FR-DS-1, FR-DS-2, FR-DS-3, FR-DS-8): `tokens.css` re-cut, `literals.allow.json` seeded at today's counts, the three height thresholds named, every condition in range syntax, the four chart tokens measured.
  First and alone, since every later task lowers its counts.
- The primitives (FR-DS-4), by lane so sessions stay out of one file: the controls (`TextButton`, `BracketLink`, `ToggleGroup`) and the three toggles that bypass `OptionToggle`; the surfaces (`Card`, `Rule`, `Line`) and the five lines; `Field` and the three inputs; the layout helpers.
  Each task lowers the allow-list and leaves the capture diff empty.
- The guide and the dev page (FR-DS-6), with `docs/screenshots/design/` joining the set.
- F-98 and the re-shoot (FR-DS-5, FR-DS-7): the labels, the axe exception removed, the set re-shot and diffed against `main`, the budget table in the PR.
- Release preparation: `v2.3.0`, `docs/RELEASE.md` §14, the guide linked from the reading order (FR-PUB-2).

Definition of done:
- US-37 AC1–AC6 accepted; FR-DS-1..9 met; `literals.test.ts`, `breakpoint.test.ts`, `design.test.ts` and the tokens test green in CI.
- The capture set on the release commit is byte-identical to `ed8748a`'s except the files F-98's labels appear in and the twenty of V23-11's `[ × ]`, both lists in the release notes; FR-CAP-5's two runs agree.
- `npm run bundle:budget`: no row raised, main and the stylesheet within 1.5 KB of `ed8748a`.
- The status register in §4.20 moves F-98 to **closed**.
- The owner has opened the dev page in both themes and `docs/DESIGN.md`, and the stars spec (v2.4) names tokens and primitives from it.
