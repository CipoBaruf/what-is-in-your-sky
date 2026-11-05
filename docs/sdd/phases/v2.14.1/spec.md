# v2.14.1 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### Phase 2w.1 — v2.14.1 ("the desk, reviewed", as decided 2026-11-05, V214-25)

After v2.14 is on `main` (`936b829b`, 2.14.0, not tagged).
The owner ran 2.14 on a desk and found the pass page hard to use, the opening views empty and the stars page carrying the satellites' time.
The fixes are the owner's answers of 2026-11-05 (V214-25..V214-38); they amend v2.14's requirements and add three.
One branch, one pull request, built and reviewed locally; the owner reads it before anything is pushed.
v2.14.0 is not tagged: the release is 2.14.1 (V214-32).

#### The pass page

- **FR-WIDE-1** *(amended v2.14.1, V214-26; before: the pass page's list was the home's list beside nothing to return by)*
  On wide the pass page's header carries `[ ← ]` before the title, as the live and stars pages' do (FR-FLOW-3); it goes back to where the reader came from (the browser's back): from the home, the home with the list scrolled to the card; from the live or stars page, that page (V214-35).
  Tonight's pass list is the rail's group right under the head, before `View` and `Time`, the selected row marked `aria-current`; a click or `Enter` on another row opens that pass in place (its hash, its arc, its times, opened at its rise), without the home in between (V214-33).
  The list's rows are one line each (the time, the name, the peak and the brightness, the name giving first), three in view and the top of a fourth (7.5 rows, `--row` 24 px each), and it scrolls inside itself with the open pass's row in view, so `View`, `Time` and `[ Play ]` stay in view under it (V214-37, V214-38).
  A bare `#pass` (no pass known yet) moves to the pass `[ satellites ]` names as soon as the passes arrive.
  The rail stays inside the page's width cap (FR-CLEAN-12): no group, row or table is wider than the rail, nothing on the page scrolls sideways, and the rail alone scrolls vertically while the sky box stays in view.
  *Verification:* `pass-page.spec.ts` at 1024 × 640, 1280 × 800 and 1920 × 1080 in both languages — the list is the rail's first group after the head, at most 7.5 rows tall with three whole rows in it, and from 800 px tall `[ Play ]` is in the viewport without scrolling the rail (at 1024 × 640 the rail scrolls to it).
  The back arrow returns home with the card in view when entered from the home, and to the stars page when entered from it; a bare `#pass` becomes a pass's hash once passes load; a second row opens its pass with the hash changed and no navigation to home; `scrollWidth` equals `clientWidth` for the document and for every element inside the rail; the rail's right edge is at or inside the header's.

- **FR-CLEAN-14** *(amended v2.14.1, V214-27; before: three page links)*
  On wide the header's page links are four: `[ home ] [ live ] [ satellites ] [ stars ]` / `[ inicio ] [ en vivo ] [ satélites ] [ estrellas ]`, `satellites` the current form on the pass page.
  `[ satellites ]` opens the pass page on the pass up now, else tonight's next visible pass; with no pass in the span it opens the page with the list's empty line and no arc.
  Compact's header is unchanged.
  *Verification:* the header's component test in both languages (four forms, `aria-current`); `controlRows.test.ts`'s wide header row at 964 px; `pass-page.spec.ts` — the link with a pass up, with one ahead, with none.

- **FR-WIDE-3** *(amended v2.14.1, V214-28; before: the pass detail opened on FR-GLOBE-1's view, at now)*
  The pass page draws the pass's whole path at every `t`, not only its part up at `t`, in its legend colour, with the satellite's marker at its place at `t` when the pass is up.
  The page opens paused at the pass's rise, with the globe's view centred on the path's peak direction (turning with you, FR-GLOBE-5), so the whole arc is on the near side; `Play` moves the marker along the drawn path; `[ now ]` returns to real time.
  *Verification:* `globe/arcs.test.ts` — the pass page's polyline is the same at rise, peak and an hour later; `pass-page.spec.ts` — on open the readout is the rise, the arc's drawn points are all on the near side, and after `Play` the marker's screen position moves along it.

#### The time row

- **FR-WIDE-4** *(amended v2.14.1, V214-29; before: the live page's time control on all three pages)*
  The stars page has no overview row, no stripe and no satellite marks: its `Time` group is the clock readout (FR-GLOBE-8), the `−1 d` `−1 h` `+1 h` `+1 d` steps, then `[ now ]` and the live page's playback row (FR-LIVE-5: `[ Play ]` and its speeds), so time plays the same way on the three desk pages (V214-34).
  The live page and the pass page keep FR-WIDE-4's control; the pass page opens at the pass's rise (FR-WIDE-3 as amended).
  *Verification:* `stars.spec.ts` at 1280 × 800 — no `stripe-overview`, no `time-stripe`, no pass mark in the rail; `+1 d` moves the globe a day; `[ Play ]` at `600×` runs the globe's clock.

#### The sky by day

- **FR-STAR-13** *(amended v2.14.1, V214-30; before: nothing drawn above 0°)*
  On the globe, while the Sun is above −6° and the stars layer is on, the stars to magnitude `DAY_STARS_MAG` (3.5) and the figures between them are drawn at `DAY_STARS_ALPHA` (0.35) of their night strength over the day or twilight surface instead of hidden, so the `[x] stars` choice always shows and the figures do not blink out at dusk (V214-36); below −6° the globe draws as at night.
  The window, the dome and the polar chart keep the rule as written (what the eye sees).
  *Verification:* `globe/scene.test.ts` — at a Sun of +20° and of −3° the stars to magnitude 3.5 are drawn at the alpha, none fainter, with their figures; at −10° all at full strength; the stars layer off draws none.

- **FR-WIDE-13** *(V214-31)* **Nothing up: go to the first pass.**
  On wide, when the live page opens and no pass is up at now, a dialog asks `Nothing is up right now. Go to the first pass and play?` with `[ go and play ]` and `[ stay here ]` (`Ahora no hay nada arriba. ¿Ir al primer pase y reproducir?`, `[ ir y reproducir ]`, `[ quedarme ]`).
  `go and play` holds the page at the first pass's rise (FR-JUMP-1's landing) and starts the playback at the row's speed; `stay here` closes it at now, the globe with the faint day stars (FR-STAR-13 as amended).
  It is a modal dialog (`role="dialog"`, `aria-modal`, focus on the first button, `Esc` is `stay here`), shown once per visit, and not shown when a pass is up, when the span has no pass, or when the URL holds a time.
  It replaces the headline's `[ see this pass ]` on wide when it is shown; compact is unchanged.
  *Verification:* `live-dialog.spec.ts` at 1280 × 800 in both languages — shown with nothing up, both answers, `Esc`, not shown again after a reload of the hash within the visit, not shown with a pass up; axe on the open dialog.

#### Focus

- **FR-WIDE-14** *(V214-31)* **One line on a focused field.**
  A focused text field, select or textarea draws one line: its own border in `--focus-ring`'s colour, with no outline around it; buttons, links and the other controls keep `global.css`'s one ring (D-704).
  The border's colour meets 3:1 against the surface in dark and night (WCAG 2.4.11).
  *Verification:* a style test over `global.css` and every module that styles a field — no field rule sets an outline under `:focus-visible`; `focus.spec.ts` at 1280 × 800 tabs through the home, the place sheet, the settings page and the stars page and finds one line on each field (the outline width 0, the border colour the ring's).

#### Definition of done

- FR-WIDE-1, FR-CLEAN-14, FR-WIDE-3, FR-WIDE-4 and FR-STAR-13 as amended and FR-WIDE-13 and FR-WIDE-14 met, each by its verification line.
- `npm test` green; `npm run bundle:budget` no row over v2.14's by more than 2 KB without a named reason in the release record.
- `package.json` reads 2.14.1; the release record lists the captures that move.
- The tag and the deploy are the owner's.
