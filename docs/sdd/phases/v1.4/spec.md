# v1.4 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.7 Goals (v1.4, "the shape, the chunk and the list")

- **G18. The page is right at every window shape.**
  No width and no height a browser can give makes one row lie over another, empties the drawing, or makes a page scroll that says it never scrolls — the short, wide window included, which is what a dragged responsive frame and an inspector docked at the bottom both give.
- **G19. Time can be aimed.**
  Landing the shown instant on a pass takes one tap, and a drag on the stripe moves time by seconds per pixel rather than minutes.
- **G20. The list is where it is needed and never moves the picture.**
  Beside the drawing on a desktop at every width; on a phone one tap away, at a height that does not depend on what is in it, so neither opening it nor a pass coming or going resizes anything else.
- **G21. The screen never waits for the phone.**
  *(v1.4.1)* Choosing the window gives a picture.
  Turning the phone is advice about what a wider field buys, never a condition to be met: a phone whose rotation the reader has locked shows the same sideways screen an unlocked one shows, and the app asks nothing of the reader's settings.

**US-24 — Aim the shown instant at a pass** *(v1.4)*
As a user planning tonight, I move the shown instant onto a pass without aiming at a pixel.
- AC1: The stripe draws four hours at a time — the four that hold the shown instant — so a drag moves time by seconds per pixel, not minutes (40 s/px on a phone, 12 s/px at 1280 px).
- AC2: A one-row overview above the stripe carries the whole 24 h: the night, a mark for every pass, and a bracket around the four hours drawn below.
  A click or a drag on it moves the shown instant there.
- AC3: `[ ◀ 4h ]` and `[ 4h ▶ ]` move the shown instant a chunk at a time, and the chunk drawn follows it.
- AC4: `[ pass ▶| ]` puts the shown instant on the next pass's rise in one tap and `[ |◀ pass ]` on the previous one, on a desktop as well as on a phone.
- AC5: `[ −1m ]` and `[ +1m ]` are the fine step; the arrow keys keep one minute and, with Shift, ten, and Page Up / Page Down move a chunk.
- AC6: The chunk is not a mode I manage: the one drawn is always the one holding the shown instant, and playback carries it across a boundary on its own.

**US-25 — Use a window of any shape** *(v1.4)*
As a user whose browser window is neither a phone nor a full screen — dragged short, tiled to half a monitor, or with the inspector docked at the bottom — I still get a page that works.
- AC1: At every size the app claims to support, no element of a page lies over another and no page scrolls sideways.
- AC2: The live page never scrolls at all, and its drawing is never absent or zero-height.
- AC3: A phone's landscape layout appears on a phone only: a wide window that happens to be short keeps the desktop layout, with a smaller box.
- AC4: The supported sizes are a list in this document that a test walks, and they include 1200 × 450 and 1400 × 480.

### 4.25 Window shapes *(v1.4)*

A page's layout is decided by two independent things, and the app has been treating them as one.
The **mode** is the layout family — compact or wide — and it is a width (FR-DESK-1's 100 cells).
The **shape** is what the viewport looks like inside that mode: portrait, or the landscape phone.
A rule written for a shape that does not say which mode it belongs to fires wherever the shape occurs, and the shapes overlap: a desktop window dragged short is landscape and under 500 px high, exactly like a phone held sideways, and nothing but the width tells them apart.
F-65 (§4.20) is that mistake with a measurement, and its symptom is not a cosmetic one: at 1200 × 450 the live page draws every row 456 px wide in a 1200 px window, gives the drawing a height of zero, and scrolls.

This section is the rule that makes the class of defect impossible to write again, and the list of sizes that "every supported size" means.
It changes no picture that is correct today.

- **FR-SHP-1** Two decisions, named separately.
  The **mode** is FR-DESK-1's: compact below 100 cells of viewport width, wide at and above it, read once by `useLayoutMode` and written on the page as `data-compact` (PLAN D-72).
  The **shape** is portrait, or the landscape phone — a viewport wider than tall and no more than 500 px high (PLAN D-173).
  Every shape rule MUST name the mode it belongs to, in the selector, not in a comment: the landscape-phone layout is `data-compact='true'` and nothing else.
  This is already how FR-COMP-5's portrait floor is written (`.fill[data-compact='true']` inside `(orientation: portrait)`); the landscape block is the one that never got the guard.
- **FR-SHP-2** A rule that re-cuts a grid MUST set both halves of it — the areas and the tracks — in the same block.
  A block that sets `grid-template-columns` and leaves `grid-template-areas` to a rule of different specificity produces a layout neither rule describes, which is what F-65 is: two columns of tracks holding one column of areas.
  Checked by a stylesheet test rather than by eye (`tests/styles/`): every media query in the live page's stylesheet carries a mode selector, and every block that sets one of the two grid properties on the page element sets the other.
- **FR-SHP-3** The wide page holds at every height.
  On a wide viewport the desktop live layout is the layout, whatever the height: the box is what gives (FR-LIVE-7's rule, unchanged), down to `LIVE_BOX_MIN_PX` — 192 px, eight rows, the smallest box in which FR-DOME-1's drawing is still a bowl — and below that the rows under the box fold, in this order, rather than the page scrolling (FR-LIVE-1): first the stripe's overview row (FR-SPAN-2) goes, then the actions row joins the status strip's line.
  Measured at 1200 × 450 with the rows folded: the box is 486 × 405 at 2.4 : 2.0, the drawing 92 % of it across.
  The compact page is unchanged — portrait, or the landscape phone, both as they are today.
  *(amended v2.0, V20-7)* Under the floor the scrub block is not a folded row: it is FR-WATCH-6's overlay over the bottom of the box, and the box's height is the same in both states.
  The fold order while watching is the rail's control rows to one text row, then the actions onto the conditions line; the overview does not fold, being in the rail.
  The "486 × 405" figure above is superseded by what `shapes.spec.ts` measures in each state.
  *(amended v2.5, V25-19)* Before either, the headline's landmark line folds: on the live page with the scrub block over the box the headline carries none (FR-SKY-11 as amended).
- **FR-SHP-4** The shape matrix.
  This is what "every supported size" means, and each row is one measurement on the live page.
  The invariants at every row: no element of the page overlaps another; the document does not scroll sideways; the live page does not scroll at all (FR-LIVE-1); the chart box is at least `LIVE_BOX_MIN_PX` tall and has a drawing in it; and the drawing covers 90–100 % of the box's shorter side (FR-DOME-1).
  *(amended v2.0, V20-7)* Each row is measured in both states of FR-WATCH-1 and the invariants hold in both; at the short-and-wide rows the box's height is the same in the two.
  - **Compact portrait:** 360 × 640, 390 × 667, 390 × 844, 430 × 932.
  - **Landscape phone:** 740 × 360, 844 × 390, 932 × 430.
  - **Short and wide** (a window dragged short, an inspector docked at the bottom, a tiled half screen — the shapes F-65 lives in): 964 × 420, 1024 × 450, 1200 × 450, 1400 × 480, 1920 × 500.
  - **Desktop:** 964 × 700, 1024 × 768, 1280 × 800, 1660 × 900, 1920 × 1080, 2560 × 1440.
  - **The boundaries themselves,** where an off-by-one in a threshold shows: 963 × 700 and 964 × 700 (the mode), 844 × 500 and 844 × 501 (the shape).
  The home page and the pass detail are measured at the compact-portrait and desktop rows only: neither carries a shape rule, and adding them to every row buys nothing but CI time (FR-CI-1).
- **FR-SHP-5** Captures (FR-COMP-6's rule for the phase): the live page at 1200 × 450 in both themes in English — the shape's record, against the picture in F-65 — and the desktop live page at 1024 × 768, the wide width the capture set has never covered.

### 4.26 The stripe's span *(v1.4)*

OQ-18 stated the number in v1.1 and the stripe has carried it since: 24 h across a phone's 360 px is four minutes per pixel, so a five-minute pass is a pixel and a half wide and the stripe is a slider whose smallest step is larger than the thing it selects.
FR-TRAJ-5's stepping row was the answer, and it works, but the picture still cannot be read at the scale the reader is working at: the segment they are aiming for is thinner than the cursor.

So the stripe draws part of the span.
The reader is never asked to manage which part: the chunk drawn is the one holding the shown instant, and everything that moves the instant moves the chunk with it.

- **FR-SPAN-1** The chunk.
  The stripe draws a **chunk** of FR-LIVE-4's 24 h span rather than all of it.
  A chunk is `STRIPE_CHUNK_H` hours long — 4, a constant (OQ-24) — cut at multiples of the chunk from the observer's local midnight, so its boundaries are whole clock hours that do not move as time runs, and clipped to the span at both ends (the first chunk starts at `now`, the last ends at `now + 24 h`).
  The chunk drawn is the one that holds the shown instant `t`.
  It is not a state the reader sets, the URL carries or the app remembers.
  At 360 px of stripe width a chunk is 40 s per pixel; at 1200 px, 12 s.
- **FR-SPAN-2** The overview.
  One row above the stripe carries the whole span: FR-LIVE-4's night shading, one mark per pass in its arc's colour (FR-LEG-5), a cursor at `t`, and a bracket around the chunk drawn below it.
  It stands directly above the stripe, under the clock readout's row, and is one row of body-size cells tall.
  It is a slider of its own — accessible name "Night overview" / "Vista de la noche", value text the clock time under the cursor — whose value is `t`: a click or a drag sets `t` to the instant under the pointer, the arrow keys step 15 min, Page Up and Page Down a chunk.
  Its own resolution is the old one, two minutes per pixel on a phone, which is what an overview is for: it says *where in the night*, and the stripe below it says *when*.
  *(amended v2.0, V20-4)* While watching the overview stands on its own — under the conditions line on compact with one row of end labels, in the rail on wide and on the landscape phone — and is the state's only timeline; "directly above the stripe" holds while the stripe is drawn (FR-WATCH-4).
  *(amended v2.7, V27-3; FR-TONIGHT-3: on the compact live page the time track takes the overview's place and span; wide keeps the overview.)*
- **FR-SPAN-3** The stepping row, re-cut.
  Six controls on one row, in this order, replacing FR-TRAJ-5's six: *(amended v2.0, V20-4)* The row is rendered only while scrubbing, wherever the stripe is (FR-WATCH-4).

  ```
  |◀ pass   ◀ 4h   −1m   +1m   4h ▶   pass ▶|
  ```

  All six set `t`, all six clamp to the span, and the chunk follows (FR-SPAN-1).
  The pass jumps are FR-TRAJ-5's rises under a name that says what they land on.
  The ±10 min steps are withdrawn: their job was the coarse move in a 24 h stripe and the chunk arrow is that move now, while the fine one is a minute.
  A control with nowhere to go is disabled rather than absent, so the row never changes width (FR-TRAJ-5's rule, kept).
  The row is 35 cells with its gaps, inside FR-COMP-4's 36, and the label text is what the unit test counts.
  It is shown wherever the stripe is — on a pointer device as well as a touch one, which is the point of the arrows: a mouse has no gesture for "the next pass", and the arrow keys keep their own steps either way.
- **FR-SPAN-4** One tap to a pass.
  From any instant, `pass ▶|` lands `t` on the rise of the next pass in the span, to the second, in one tap; `|◀ pass` on the rise of the previous one.
  Where there is no pass ahead (or behind) the control is disabled.
  Where the pass is in another chunk the chunk moves with the instant, so the tap that finds the pass is also the tap that draws it.
  US-22 AC6's ceiling — within a minute of a rise in at most three taps — stands as the ceiling; this is one.
- **FR-SPAN-5** Playback crosses boundaries by itself.
  While playback runs, the chunk changes when `t` crosses a boundary: the stripe re-labels and re-draws its band and its segments, with no animation, no scroll and no remount.
  The geometry is memoised on the chunk as FR-TRAJ-4's is on the span today — only the cursor and the `current` flag follow `t` — so FR-LIVE-5's frame rate holds at every speed.
- **FR-SPAN-6** The whole span at speed.
  At 600× a chunk lasts 24 s of wall time and at 3600× four seconds, which is a stripe that re-labels faster than it can be read.
  At any speed where a chunk would last less than `CHUNK_MIN_WALL_S` (10 s) of wall time the stripe draws the whole 24 h span instead — the stripe the app has today — the overview's bracket covers all of it, and the arrows keep stepping a chunk of shown time.
  Pausing, or any speed at or below 60×, gives the chunk back.
  Neither change is animated, and neither moves `t`.
- **FR-SPAN-7** Everything else about the stripe stands.
  FR-TRAJ-4's three rows, its colours, its lane packing and its "no label over another" rule; FR-LIVE-4's clamp, its cursor, its keyboard steps and the stripe's `slider` role, whose value text is still the clock time at `t`; FR-LIVE-11's drawn set, of which the chunk is a view and nothing more.
  FR-TRAJ-4's label cadence is recomputed for what the chunk shows: every 30 min where twelve two-character labels fit (60 cells), every hour under that, with the date at a midnight crossing in place of the hour as before.
  The stripe is still at least 36 cells wide on compact.
  Captures (FR-COMP-6): the compact live page with the overview, the chunk and the new row at 390 × 844 in both themes and both languages; the same at 1280 × 800; and FR-SPAN-6's whole-span state at 1280 × 800, so the two spans are on the record side by side.

### 4.27 The legend's place, second pass *(v1.4)*

Two findings of the owner's on the 1.3.0 build, both about where the list of what is in the sky belongs.

On a desktop narrower than 1660 px the list is under the drawing rather than beside it, which was V12-14's choice and reads wrong at 1280: the space is there, at the right, and the page leaves it blank.
On a phone the list is worse than misplaced — it is a hole that changes size.
It has no rows when nothing is up, four when the sky is busy, and every change resizes the drawing above it, so the picture moves while the reader is looking at it.

- **FR-LEG-6** Wide: beside the box at every width.
  The legend and FR-LIVE-7's rail stand at the right of the box at every wide viewport (FR-DESK-1's 100 cells and up).
  `LIVE_TWO_COLUMN_MIN_PX` (1660 px) and the one-column wide page it gated are **withdrawn**: there is one wide live layout again — the box at the left, cut to the drawing's own shape (2.4 : 2.0) from the width the rail leaves and the height the rows leave; the stripe block under the box at the box's width (V12-12); the legend, then the status strip, then the actions in the rail, in that order.
  Every other clause of FR-LIVE-7's two-column rule is unchanged, including the rail's 44-cell minimum and its 60-cell cap.
  Measured at the narrowest wide width, 964 × 700: the rail takes its 44 cells and the box comes out 632 × 527 with the drawing 92 % of it across.
  The one-column rules of v1.2.1 — the full-width stripe and legend, the status strip reading from the left (V12-15) — go with the layout they belonged to.
- **FR-LEG-7** Compact: behind a control, and a fixed height when open.
  On the compact live page the legend is not laid out under the drawing.
  The actions row carries `[ list (n) ]` — a toggle with `aria-expanded`, `n` the number of drawn passes (OQ-26) — and: *(amended v2.0, V20-7)* "That press is the only thing" becomes "the reader's own action is the only thing": entering and leaving scrubbing on compact and on a tall wide page also changes the box's height (FR-WATCH-7); the sky never does.
  - **closed,** the legend is not rendered at all and the box has the height it leaves;
  - **open,** it stands under the drawing at exactly `LEGEND_OPEN_ROWS` (2) rows of `--tap`, 96 px, whatever it holds: one row, five rows scrolling inside itself, or none, in which case the panel carries one line — "nothing up right now" / "nada visible ahora" — as a `role="status"`.
    The Sun and Moon lines (FR-DOME-6) are in the panel as they are in the legend today, and are not counted by `n`.

  The box gives those 96 px when the control is pressed and takes them back when it is pressed again, and **that press is the only thing that may change the box's height on the live page**: a pass rising, ending, being hidden or being shown MUST NOT change the height of the panel, the box, or any row of the page.
  The open state is a preference on the device, beside the chart view (FR-WIN-5's slice), default closed, so a reload comes back as the reader left it.
  The pass detail's legend (FR-LEG-3's lead table, PLAN D-259) and the sky screen's strip (FR-FSC-3) are untouched: this is the compact live page and nothing else.
- **FR-LEG-8** F-62, closed by measurement.
  With the legend off the compact page's rows, FR-COMP-5's floor — the box never shorter than it is wide — MUST hold **with the list closed** at 390 × 844 and at 390 × 667, the shortest phone the app supports, measured on the box rather than argued from the rows.
  F-62's other half, the 96 px the three-option view control spent on two rows at 390 px, is already gone (PLAN D-358 dropped the row's `View:` prefix).
  With the list **open** at 390 × 667 the box MAY fall under its floor — that is the reader's own tap, and FR-COMP-5 already says the box is what gives last — but the page still does not scroll (FR-LIVE-1) and no row overlaps another (FR-SHP-4).
- **FR-LEG-9** Captures (FR-COMP-6): the compact live page with the list closed and with it open, at 390 × 844 and 390 × 667, both themes and both languages; the empty-list line at 390 × 844; and the wide live page at 964 × 700, 1024 × 768 and 1280 × 800 with the rail beside the box, which replaces the one-column captures the D-179 set carries from R61 at 1280.

### Phase 2f — v1.4 ("the shape, the chunk and the list", as decided 2026-09-08, V14-1)

After Phase 2e, on the `v1.3.0` build.
Still no backend and the same two providers.
Three items from the owner's use of the released build, and the four findings no earlier phase carried.

- The live page's shape rules are scoped to the layout mode, F-65 is closed, and a matrix of sizes is what "every supported size" means (§4.25).
- The stripe draws the four hours that hold the shown instant, with a 24 h overview above it and a stepping row of chunk arrows and pass jumps, on every device (§4.26).
- The legend is beside the box at every wide width, and on a phone it is behind a control that opens a panel of fixed height (§4.27).
- The findings the phase carries under FR-FIX-1: F-57 and F-58 (the window's repeated work), F-62 (the compact box's floor), F-64 (`moon.spec.ts` red on `main`) and F-65.
- *(v1.4.1, V14-9..V14-11)* The sky screen draws in both orientations, turns its own layer where the phone's rotation is locked, and gives advice in place of the gate (§4.23, FR-FSC-4 rewritten, FR-FSC-10, FR-FSC-11).
  One task, before the release task, which is re-run on the build that carries it.

Definition of done:
- US-24 AC1..AC6 and US-25 AC1..AC4 accepted; FR-SHP-1..5, FR-SPAN-1..7 and FR-LEG-6..9 met; the amended FR-LIVE-1, FR-LIVE-4, FR-LIVE-7, FR-COMP-4, FR-COMP-5, FR-COMP-6, FR-LEG-2, FR-TRAJ-4 and FR-TRAJ-5 met.
  *(v1.4.1)* US-21 AC12 as amended and AC15 accepted; FR-FSC-4 as rewritten, FR-FSC-10 and FR-FSC-11 met, with FR-FSC-7's capture changes.
- F-57, F-58, F-62, F-64 and F-65 each closed by a change with a test that fails on the old code (FR-FIX-1) or moved by an explicit Decision Log row.
  F-64 goes first: a red suite on `main` is what the phase starts by fixing, before any layout work lands on top of it.
- The shape matrix (FR-SHP-4) walked by a test in CI, inside FR-CI-1's ten minutes.
- The earlier definitions of done still hold: the golden tests, the FR-GUIDE-6 and FR-LIVE-5 rates on the reference device, the D-179 capture set re-shot where these screens changed (FR-SHP-5, FR-SPAN-7, FR-LEG-9), and the bundle budgets re-set by the D-178 rule.
- The owner has run the live page on a phone — the list opened and closed, the chunk arrows, one tap to a pass — and on a desktop window dragged short: the hand on the glass and the shape of a real window are not headless things (V11-9).
  *(v1.4.1)* And has run the sky screen on a phone with rotation locked and with it unlocked, held sideways, upright and flat: FR-FSC-10 is a hand-and-sensor thing that no headless run can accept (V11-9).
- `package.json` version 1.4.0, a `v1.4.0` tag, and the release checklist run on the deploy.
