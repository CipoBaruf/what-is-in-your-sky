# v2.11 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.18 Goals (v2.11, "one clean sky")

- **G55. Every sky on the phone is the screen.**
  The stars page and the pass detail look like the live page does: the sky fills the screen, only the way back, one line of context, `[ follow ]` and `[ controls ]` stand over it, and everything else is one tap away in the same sheet.
- **G56. One width on a desk, and no control that does nothing.**
  On a desk every page holds the home's width and is centred; the stars page offers no passes toggle, since the passes are seen on the live page.

**US-49 — One clean sky on the phone** *(v2.11)*
As a phone reader, whichever sky I open — the satellites, the stars, or a pass — the screen is the sky, with the same button in the same corner opening the same kind of sheet.
- AC1: At 390 × 844, 390 × 667, 360 × 640 and 844 × 390, in every view each page offers and both languages, `chart-box` on the stars page and the pass detail covers the viewport inside the safe area, and the page does not scroll (FR-CLEAN-1).
- AC2: With the sheet closed, the stars page draws over the sky only `[ ← ]` with the dark window and the cloud word, the readout in the corner while the finger has the sky, `[ follow ]`, `[ controls ]` and, until the first gesture, the hint; the pass detail the same with the countdown and the pass's name in the head (FR-CLEAN-2, FR-CLEAN-3).
- AC3: `[ controls ]` opens a bottom sheet in both shapes; on the stars page it holds the view row, the follow row, the facing row, the layer rows and `In this field`, in that order; on the pass detail the name with its landmark line, the times row, the view row, the follow row, the facing row, `[ Share ]`, the prose and the table of points (FR-CLEAN-4, FR-CLEAN-5).
- AC4: The sheet opens and closes as the live page's does (the `×`, a swipe down, `[ controls ]`, `Esc`), and opening it, opening the picker or turning the phone never changes the box's size (FR-CLEAN-6, FR-CLEAN-7).
- AC5: Every gap in the two sheets is one of FR-FLOW-10's three and every control meets FR-FLOW-11's 44 px (FR-CLEAN-8).
- AC6: The stars page has no `[ passes ]` toggle and draws no pass; the live page with `[x] stars` is the view of both (FR-CLEAN-11).
- AC7: On a desk every page's header, content and footer hold `HOME_MAX_CELLS` and are centred from that width, the sky's box inside it; the rail's `View` row sits at the rail's left like `Facing`; the header's page links read `[ home ] [ live ] [ stars ]` with the current one dimmed; the settings page's sections are `--space-5` apart; the home's three doors are the page's visible controls, with pane-sized titles and body-sized lines in control frames (FR-CLEAN-12..16).
- AC8: Apart from FR-CLEAN-12's, FR-CLEAN-13's and FR-CLEAN-14's named moves, no wide capture moves (FR-CLEAN-10).

### 4.54 One clean sky *(v2.11)*

The owner's reading of the 2.10.0 build on the phone (2026-11-02): the live page is the sky with one button, but the stars page and the pass detail are still columns — a top row, a heading, a readout, a view row, the drawing, a picker, a hint, a toggle, the layer rows and a list — and now that the stars and the satellites are one sky on every page (v2.5, v2.10), the three pages should be one page in form: "all the phone views, stars, satellites and both, must be clean, as we have both together now".
This section gives the stars page and the pass detail the live page's compact form (§4.50, FR-FULL-1..6, as amended) and one sheet pattern for all three.
FR-CLEAN-1..10 bind compact only, in both shapes (FR-SHP-1), and leave wide as it is; FR-CLEAN-11..14 are the owner's other readings of the same build — a toggle on the stars page for passes that cannot be seen there, a desk where the home stops at a width the other pages ignore, and a desk header whose page links do not look like controls — and bind both.

No new constant: the two pages reuse `FULL_OVERLAY_MAX_SHARE`, `SHEET_MAX_SHARE`, `SHEET_SWIPE_CLOSE_PX` and `SHEET_FLICK_PX_PER_MS` as the live page has them.
`DETAIL_DRAWING_TOP_PX` and `DOME_COMPACT_SLACK_PX` stop binding compact (FR-CLEAN-8).

- **FR-CLEAN-1** *(V211-1, V211-2)* **The box is the screen on the two pages.**
  On compact the stars page's and the pass detail's drawing box (`chart-box`) fills the viewport by FR-FULL-1's rule — every edge inside the safe-area insets, `100dvh`, every view each page offers (the window and the whole sky on the stars page; the window, the polar chart and the dome on the pass detail) filling the box by its own rule — and nothing is laid out above or under it: what §4.48 and §4.46 put in the column stands over the box (FR-CLEAN-2, FR-CLEAN-3) or in the sheet (FR-CLEAN-4, FR-CLEAN-5).
  The page does not scroll at any compact size of FR-SHP-4's matrix, the capped column of FR-TAB-1 included.
  The no-observer state of the stars page (FR-LIVE-1's inert line) and the pass detail's not-found state are unchanged.
  *Verification:* `clean-sky.spec.ts` at 390 × 844, 390 × 667, 360 × 640 and 844 × 390, every view, both languages: `chart-box`'s edges within 1 px of the viewport's and no page scroll, on both pages; a component test per page that compact renders no row outside the box, the overlay and the sheet.
- **FR-CLEAN-2** *(V211-3)* **The head over the sky.**
  On the box's top-left, inside the safe area, one row on `--screen-overlay` as FR-FULL-2 draws it: `[ ← ]` (Back by §4.37's rule), then the page's one line.
  On the stars page the line is the dark window and the cloud word at `--small` ("Dark 20:25 → 07:05 · Clear" / "Oscuro 20:25 → 07:05 · Despejado"; *(amended 2026-11-02, the owner's call, PLAN D-1028)* on a night whose cloud changes, the better part with its stretch of the dark, "Dark, clear 02:00 → 07:05" / "Oscuro y despejado 02:00 → 07:05", FR-WX-4, FR-FLOW-3's second line as it stood under the `h1`; "Stars from 20:25" and the no-dark-band forms of FR-FLOW-1 as the door has them).
  On the pass detail the line is the countdown of FR-FLOW-7 at `--text-heading` in the accent ("Peak in 0:08" / "Máximo en 0:08", ticking) and the pass's name as its chip at `--small` in `--fg-dim`, the chip cut with an ellipsis before the row wraps.
  The `h1` of each page ("Stars tonight"; the pass's name) stays in the document visually hidden, for the outline (FR-A11Y-2) and assistive technology.
  The facing readout stands in the box's top-right corner while following is off, as FR-PHONE-4 has it on the live page, with FR-STAR-7's second line (a tapped star's name, or the landmark line on the pass detail, FR-SKY-11) under it; while following it is not drawn (FR-GYRO-5).
  *Verification:* a component test of each head in both languages (the countdown's three forms, the stars line's three forms); `controlRows.test.ts` fits each head's longest form in 36 cells with the countdown counted at its size; the outline test.
  *(amended 2026-11-02, the owner's call on R164, PLAN D-1012)* On the pass detail the head's countdown is the phase in its own words without the reason — "Appears in 0:08", "Peak in 0:08", "Ends in 0:08", "Ended 0:08 ago" / "Aparece en", "Máximo en", "Termina en", "Terminó hace" — since the reason forms ("Entra en la sombra en 3:12", 38.5 cells with `[ ← ]`) do not fit the row at the heading size; the reason stays in the sheet's times row and the prose, and the wide band keeps FR-FLOW-7's full sentence.
  The corner readout stands under the head's row there, the head taking the whole top row (D-1013).
- **FR-CLEAN-3** *(V211-1)* **The bottom row.**
  On the box's bottom-right, inside the safe area, `[ follow ]` and `[ controls ]` exactly as FR-PHONE-3 and FR-FULL-3 have them on the live page — the same `TextButton`s, the same refusal line above the row (FR-PHONE-2's, D-987), the same hint rule (FR-FLOW-6 as amended, two clauses on touch, whole at 360 and 390 px, gone for good after the first gesture).
  The head, the readout, the row and the hint together cover at most `FULL_OVERLAY_MAX_SHARE` of the box.
  `[ follow the phone ]` leaves the two pages' action slot (FR-GYRO-1 as amended: the slot is gone with the column) and stands in each sheet as a row (FR-CLEAN-4, FR-CLEAN-5), the same state as `[ follow ]` (`useFollow`, FR-PHONE-1, FR-PHONE-2 unchanged).
  Nothing else is drawn over the box while the sheet is closed; the live page's card (FR-FULL-10) is the live page's only.
  *Verification:* a component test per page that with the sheet closed compact renders exactly the box, the head, the readout (while not following), the row and (until `skyHintSeen`) the hint; `clean-sky.spec.ts` sums the overlay against `FULL_OVERLAY_MAX_SHARE` at 390 × 844 and 390 × 667 in both languages; `targets.spec.ts` on both pages.
  *(amended 2026-11-02, the owner's call on R164, PLAN D-1014)* On the pass detail the overlay is measured against 0.17 of the box at 390 × 844 and 390 × 667, not `FULL_OVERLAY_MAX_SHARE`: its head is the box's width and its readout carries the landmark line (0.120 and 0.152 in English, 0.132 and 0.167 in Spanish, R164's Done note); 0.12 binds the live page and the stars page.
- **FR-CLEAN-4** *(V211-5)* **The stars page's sheet.**
  `[ controls ]` opens the sheet of FR-FULL-4 as amended (a bottom sheet in both shapes, `--space-3` between groups, `--space-1` inside one, at most `SHEET_MAX_SHARE` of the viewport, its body scrolling, non-modal, the sky following and playing above it), holding top to bottom: the head (the place in `--fg-dim`, `[ settings ]`, the `×`); the view row `[Window] Whole sky` (FR-PHONE-7; the layers are the rows below, so no `[x] stars` on this row); `[ ] follow the phone` (FR-GYRO-1); the facing row (FR-FLOW-5's readout, a tap opening the picker under it, the `up` point included; not drawn while following, D-957; on the whole sky the polar chart's convention line and its looking-up / map toggle take the row, FR-PHONE-7 as R160 built it); the layer rows `[x] stars [x] figures [x] planets` and `[x] names [ ] passes` (FR-STAR-3 as amended, `names` by FR-PHONE-8's compact default); and last, as the satellites are the live sheet's last group (FR-GYRO-10), the heading "In this field" / "En este campo" with FR-STAR-7's list open under it, `FIELD_LIST_MAX` rows, the passes first when `[ passes ]` is on (R160).
  The whole sky's twelve brightest when the view is the whole sky.
  *Verification:* the sheet's order test in both languages; `clean-sky.spec.ts` opens the sheet, picks `Whole sky`, toggles `passes`, taps a row of the list and finds the star named on the readout's second line, the page never scrolling.
- **FR-CLEAN-5** *(V211-5)* **The pass detail's sheet.**
  The same sheet, holding top to bottom: the head (the place, `[ settings ]`, the `×`); the pass's name with the date and the zone ("Tiangong (Tianhe) · 2026-09-06 · GMT−3") and the landmark line under it (FR-SKY-11); the times row of FR-PHONE-14; the view row `[Window] Polar Dome  [x] stars` (FR-FLOW-4, FR-GYRO-11); `[ ] follow the phone`; the facing row with `peak` among its points (FR-SKY-7); `[ Share ]` (FR-SHARE-1's control as the live sheet has it); and last the guide's prose (FR-GUIDE-1's description, the Moon-at-peak sentence, the cloud verdict) and the table of points with its `Among` column (FR-SKY-12), scrolling with the body.
  The countdown is the head's (FR-CLEAN-2) and is not repeated.
  Opening the detail from the list, a share link or the Satellites door opens with the sheet closed, the window facing the peak (FR-SKY-7) or following (FR-PHONE-1); `[ ← ]` goes back as §4.37 says.
  *Verification:* the sheet's order test in both languages; `clean-sky.spec.ts` opens a detail at 390 × 844, reads the head's countdown, opens the sheet, finds the times row and the table's `Among` column inside the scrolling body, picks the dome, and `Esc` closes the sheet before a second `Esc` leaves.
- **FR-CLEAN-6** *(V211-1)* **Open, close, and nothing resizes.**
  FR-FULL-5 and FR-FULL-6 as amended hold on both pages: the sheet opens on `[ controls ]` and closes on the `×`, a swipe down past `SHEET_SWIPE_CLOSE_PX` or a flick, `[ controls ]` and `Esc`; focus moves in and back; a pick in the sheet keeps it open; every visit opens closed; the box's size follows the viewport only — opening the sheet, the picker, the list, the hint going, following starting or ending, the handoff (FR-PHONE-10) and the tick never change it.
  `Esc` on the two pages: the sheet open → close it; else → leave the page (§4.37), two steps where the live page has three (the card).
  The following camera, the field outline and the pinch handoff (FR-PHONE-9, FR-PHONE-10) are untouched: the handoff to the whole sky keeps the sheet as it was.
  *Verification:* the component tests of FR-FULL-5 run against both pages; `clean-sky.spec.ts` asserts `chart-box`'s size identical across closed, open, open with the picker, after a handoff and after a turn.
- **FR-CLEAN-7** *(V211-1)* **Upright and turned.**
  On the landscape phone (FR-SHP-2) the stars page and the pass detail are all sky too: the drawing fills the viewport and the sheet is the bottom sheet of FR-GYRO-7, as the live page has been since v2.9.
  FR-FLOW-15's left-drawing-and-right-rail arrangement is withdrawn for compact (no compact page uses it any more); wide's rail is unchanged.
  Turning the phone keeps the view, the camera, following, the sheet's open state and the picker's (FR-FLOW-15's invariants).
  *Verification:* `clean-sky.spec.ts` at 844 × 390 and 667 × 375 on both pages: the box the viewport, the sheet's bottom edge on the viewport's and its height at most `SHEET_MAX_SHARE`; a turn 390 × 844 → 844 × 390 → 390 × 844 with the sheet open asserting the camera, the view and the sheet unchanged.
- **FR-CLEAN-8** *(V211-1)* **Rhythm, targets, and the rules that go.**
  FR-FLOW-10's three gaps and FR-FLOW-11's targets hold inside both sheets as they do in the live sheet; `rhythm.spec.ts` and `targets.spec.ts` measure the two pages with their sheets open.
  What the column needed is withdrawn for compact and stays for wide: FR-FLOW-4's compact order for the two pages, FR-FLOW-7's compact head and `DETAIL_DRAWING_TOP_PX`, FR-FLOW-8 (the stars page's compact order, with V210-17's fold rule), FR-FLOW-9's compact dome cut and `DOME_COMPACT_SLACK_PX`, FR-STAR-3's compact layout, and FR-PHONE-7's "between the `h1` block and the readout" (the row is the sheet's).
  The constants leave `lib/layout.ts` with their tests (FR-FLOW-17's rule).
  *Verification:* the two specs green at the compact sizes in both languages with the sheets open and closed; `npm run check:dead`.
- **FR-CLEAN-9** *(V211-6)* **Strings, chunks, captures.**
  The two pages' sheet strings reuse the live sheet's keys (`sheet.*`) and the pages' own ("In this field", the layer labels, the countdown, the times); new keys, if any, are in both catalogs (FR-I18N-*); strings only the two columns read go (FR-FLOW-17's rule).
  The sheet and the head are one shared component the three pages mount (the plan decides where it lives and which chunk pays: the stars page's use is the `stars` chunk's, the pass detail's is `main`'s, ≤ 1.5 KB gzipped more each; the `live` row may shrink by what leaves it); the release re-sets every row by D-178.
  The phase's named moves are every compact capture of the stars page (`stars`, `stars-passes`, `stars-whole*`, `stars-zoom`, `stars-following`) and of the pass detail (`guide`, `guide-window`, `guide-short`, `polar` at compact widths, `favourites` if it shows the detail) at 360, 390, 768 and 844 px; the capture set gains the stars page's sheet and the pass detail's sheet at 390 × 844 and 844 × 390, both themes and languages, under `stubOrientation`.
  No wide capture moves, and no live capture.
  *Verification:* the catalog parity test; `npm run check:dead`; `npm run bundle:budget`; FR-CAP-5's diff against 2.10.0 lists these files and no other.
- **FR-CLEAN-10** *(V211-1)* **Wide is unchanged by the sheets.**
  The wide stars page (the box and its rail) and the wide pass detail (the guide panel, FR-FLOW-7's band) keep their form; the only wide moves of the phase are FR-CLEAN-11's (the toggle gone), FR-CLEAN-12's (the width), FR-CLEAN-13's (the row), FR-CLEAN-14's (the header's links), FR-CLEAN-15's (the settings page) and FR-CLEAN-16's (the doors), and every wide capture that none of the six touches is byte-identical to 2.10.0's.
  *Verification:* FR-CAP-5's diff.
- **FR-CLEAN-11** *(V211-7)* **No passes toggle on the stars page.**
  The stars page shows now (FR-STAR-8), when a visible pass is rarely up, so `[ passes ]` was a control whose effect the reader could not see.
  It leaves the stars page's layer rows on compact and wide, with its strings, its unsaved state and the `stars-passes` and `stars-whole-passes` captures (FR-FLOW-17's rule); the stars page's scene carries no pass, and `In this field` lists stars and planets only.
  The view of both is the live page with `[x] stars` (FR-SKY-3), which the home's Live sky door opens; FR-SKY-6's first half is withdrawn and its second (one screen) was already withdrawn with the screen.
  The layer rows read `[x] stars [x] figures [x] planets` and `[x] names`.
  *Verification:* `Stars.test.tsx` renders no passes toggle and passes no `passes` layer; `controlRows.test.ts`; `npm run check:dead`; the two capture screens removed from the set.
- **FR-CLEAN-12** *(V211-8)* **One width on a desk.**
  From `HOME_MAX_CELLS` (160) every page's header, `main` and footer hold that width and are centred, as FR-HOME-4 has the home: the live page, the stars page, the pass detail (the guide panel inside the capped column) and the settings page.
  The sky's box takes the capped column's share as FR-LIVE-7's rail rule cuts it, so at 1920 and 2560 px the drawing is the size it has at 1540 and the page's background fills the rest.
  FR-HOME-4's "the live page is not capped" is withdrawn.
  Below `HOME_MAX_CELLS` nothing moves.
  *Verification:* the e2e of FR-HOME-4 extended to the four pages at 1920 and 2560 px: the content's width and its centring; `breakpoint.test.ts`.
- **FR-CLEAN-14** *(V211-9)* **The wide header's page links are controls.**
  On wide the three page links of FR-FLOW-3 — `home`, `live`, `stars` / `inicio`, `en vivo`, `estrellas` — are drawn as `BracketLink`s, `[ home ] [ live ] [ stars ]`, one cell apart, like `[ settings ]` at the row's end and every other control of the app (§4.45): the current page is `BracketLink`'s `current` form (a dim `aria-current` span with the same brackets, not a link) and the 2 px accent rule under it goes; the other two are links in the accent.
  The row's cell count grows by six per language, so FR-HOME-1's fold rule applies as written (the tagline goes first, then the title takes its short form) and FR-FLOW-3's place is cut with an ellipsis on a sub-page; `[ settings ]` never drops to a line of its own.
  Compact's header (`[ live ] [ settings ]`) is unchanged.
  *Verification:* the header's component test in both languages (the three forms, `aria-current`); `controlRows.test.ts`'s wide header row; FR-HOME-1's e2e at 964, 1024, 1118 and 1280 px in both languages, one title line still; the wide captures of every page move, a named move of FR-CLEAN-9.
- **FR-CLEAN-15** *(V211-10)* **The settings page breathes on a desk.**
  On wide (FR-DESK-1's breakpoint and above) the settings page's three sections — Location, Saved places, This browser — stand `--space-5` apart (FR-FLOW-10's section gap, as the home's sections are), each section's heading rule is `--space-2` above its first row, and the rows inside a section are `--space-3` apart (one text row); the footer's privacy line is `--space-5` under the last section.
  The column's width and every control are unchanged.
  Compact keeps FR-SET-2's one-viewport fit and FR-FLOW-10's `--space-3` between groups, untouched.
  *Verification:* `rhythm.spec.ts`'s settings case at 1280 × 800 measures the three gaps; `settings.spec.ts` at 390 × 844 green unchanged and the compact settings captures byte-identical; the wide settings capture moves, a named move of FR-CLEAN-9.
  *(amended 2026-11-02, the owner's call, PLAN D-1023)* The privacy line is gone (FR-SET-1 as amended); the footer's one row stands where it stood, at least `--space-5` under the last section.
- **FR-CLEAN-16** *(V211-11)* **The doors stand out on a desk.**
  On wide the three doors of FR-FLOW-1 are the home's main navigation and read as such: each door's title at `--text-pane` on its row (the pane heading's size, 20 px), its answer lines at `--text-body` in `--fg-dim` (not `--small`), the box padded `--space-3` by two cells inside, its frame `--border-control` (`--edge`, a control's edge at 3 : 1) rather than the card rule, and on hover and focus the frame in the accent and the title in the accent, so the three read as the three buttons of the page.
  The `Card` primitive gains the prop that gives it this form (the plan names it; FR-DS-4: a prop, never an override); compact's doors are unchanged (FR-FLOW-1's 44 px box, `--small` lines) and FR-FLOW-1's lines, targets and tests stand.
  *Verification:* `HomeDoors.test.tsx` renders the wide form with the prop and the compact without; `wide.spec.ts` at 1280 × 800 asserts the title's computed size and the frame's colour on hover; the wide home captures move, a named move of FR-CLEAN-9; the compact home captures byte-identical.
- **FR-CLEAN-13** *(V211-8)* **The rail's `View` row sits left.**
  On the wide stars page the `View` row (`[ Window ] Whole sky`, R160) is drawn at the rail's right edge while `Facing` and `Layers` sit at its left; it takes the left like the others, as the live page's `View` group does.
  *Verification:* the stars page's wide snapshot; a bounding-box assertion in `sky-layout.spec.ts` at 1280 × 800 that the three rows share one left edge.

### 5.16 v2.11 additions *(proposal; the plan decides)*

- The live page's sheet and head generalised: one `ControlsSheet` and one `SkyHead` the three compact sky pages mount, each page passing its head line and its sheet's groups (FR-CLEAN-2, FR-CLEAN-4, FR-CLEAN-5), living where the `stars` chunk and `main` can reach them without the `live` chunk.
- `SkyViewLayout`'s `full` form for the stars page and the pass detail in both shapes; the compact `column` and `rail` forms retired with their measurements once no page uses them (FR-CLEAN-1, FR-CLEAN-7, FR-CLEAN-8).
- One e2e, `clean-sky.spec.ts`, over both pages at the compact sizes (FR-CLEAN-1..7).
### Phase 2t — v2.11 ("one clean sky", as decided 2026-11-02, V211-1)

After v2.10.0 is on `main`.
The stars page and the pass detail on compact, both shapes; wide untouched.

- The box as the screen, the head, the bottom row (FR-CLEAN-1..3).
- The two sheets (FR-CLEAN-4, FR-CLEAN-5).
- Open, close, the turned phone, the rules withdrawn (FR-CLEAN-6..8).
- Strings, chunks, captures; wide unchanged by the sheets (FR-CLEAN-9, FR-CLEAN-10).
- No passes toggle on the stars page; one width on a desk; the rail's `View` row; the header's links as controls; the settings page's rhythm on a desk; the doors as the desk's navigation (FR-CLEAN-11..16).

Definition of done:
- FR-CLEAN-1..16 met, each by its verification line; US-49's criteria green.
- `clean-sky.spec.ts`, `targets.spec.ts`, `rhythm.spec.ts`, `follow.spec.ts`, `whole-sky.spec.ts` and `shapes.spec.ts` green at the compact sizes in both languages; the live page's specs unchanged and green.
- Every task `Gate: auto`, merged on CI green and a clean review; the model per task is PLAN §16.30's; at most one `fable` task per wave, the driver's wait-and-resume on (V211-6, D-975's rule).
- `npm run bundle:budget`: every row inside its budget; `main` and `stars` within their allowances (FR-CLEAN-9); the release re-sets the rows by D-178.
- The owner's phone run written into `docs/RELEASE.md` §24; `package.json` reads 2.11.0.
  The tag and the deploy are the owner's.
