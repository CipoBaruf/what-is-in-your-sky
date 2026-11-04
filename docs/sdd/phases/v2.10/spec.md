# v2.10 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.17 Goals (v2.10, "the phone first")

- **G51. Already following.**
  On a phone the page's own sky turns with the hand from the moment it opens, with nothing to find in a sheet first, and the one control that matters stands beside the one button the sky already has.
- **G52. Every star, with or without the satellites.**
  Whatever patch the window shows, the whole sky with every drawn star is one tap or one pinch away on every page that draws stars, and the reader sees which patch of it the phone points at.
- **G53. A sky, not a page.**
  The window's sky is a surface with depth — darker at the zenith, lighter at the horizon, the Milky Way as a haze, the brightest stars with a bloom and their own tint, fainter stars appearing as the field narrows — and nothing of it reads as white.
- **G54. The phone's pages answer first.**
  The home opens on its doors, the pass detail's times are one line, the hint fits, the screen stays awake while following, and the theme can follow the dark.

**US-45 — The sky follows the phone from the start** *(v2.10)*
As a phone reader, I open the live sky, the stars page or a pass detail and the sky is already turning with my hand; when I drag it stops, and one control beside `[ controls ]` hands it back to the phone.
- AC1: On a touch phone whose browser needs no motion permission, the window follows the phone from its first reading on the live page, the stars page and the pass detail, with no tap and no prompt (FR-PHONE-1).
- AC2: On iOS, once I have allowed motion, later visits ask inside my first touch on the sky and follow from the next reading; a refusal leaves the finger in charge and says so once (FR-PHONE-2).
- AC3: `[ follow ]` stands in the live page's bottom row beside `[ controls ]` in both languages, on and off are told apart by the brackets, and a drag turns it off as FR-GYRO-4 says (FR-PHONE-3).
- AC4: While I drag, the facing readout stands in the box's corner; while the phone follows, nothing stands over the sky but the head, the bottom row and the ground notes (FR-PHONE-4).
- AC5: The hint is one line at 360 and 390 px in both languages with no ellipsis (FR-PHONE-5); the screen does not dim while following on any of the three pages (FR-PHONE-6).

**US-46 — The whole sky, every star** *(v2.10)*
As a reader on any page that draws stars, I can see the whole sky at once with every star the window would draw, with the satellites or without them, and I can see which part of it my phone points at.
- AC1: The stars page's view row reads `[Window] Whole sky` / `[Ventana] Cielo entero`, one line in both languages; `Whole sky` draws the polar chart with the stars page's layers, `[ passes ]` on or off (FR-PHONE-7).
- AC2: The polar chart draws the figures and, with `names` on, the names of the brightest stars and the figures, from the same ladder the window draws, in every view row that offers it (FR-PHONE-8; OQ-43 resolved).
- AC3: While the window follows or after a drag, the whole sky carries the window's field as a thin outline that moves with it (FR-PHONE-9).
- AC4: Pinching out at the window's widest field opens the whole sky; pinching in on the whole sky returns to the window facing the spot under my fingers (FR-PHONE-10).
- AC5: The dome's drawing is unchanged: its captures do not move (FR-PHONE-11).

**US-47 — A sky with depth** *(v2.10)*
As a reader looking at the window at night, the sky reads as a sky: dark at the zenith and lighter at the horizon, the Milky Way a quiet haze, Antares orange and Spica blue-white with a soft bloom, and fainter stars filling in as I pinch in.
- AC1: The window's sky is `--chart-sky-deep`, with a band along the horizon and a tint that follows the Sun's altitude; the faintest rung keeps 3 : 1 against the lightest sky it stands on in both themes (FR-LOOK-1, FR-LOOK-2).
- AC2: The Milky Way is a haze built from the galactic plane with no external image, at `MILKY_WAY_STRENGTH`, under the figures (FR-LOOK-3).
- AC3: Stars to magnitude 2.5 are `*` characters sized by magnitude; fainter stars are round dots whose radius follows magnitude; every star carries one of four tones from its B−V colour index; in night mode every tone is red (FR-LOOK-4, FR-LOOK-5).
- AC4: The brightest stars and the planets carry a bloom at `BLOOM_STRENGTH`; the Moon is drawn with its phase in the window and on the whole sky (FR-LOOK-6, FR-LOOK-7).
- AC5: Pinching in from 60° to 20° brings in stars to 6.5 and names to 3.2 by `FIELD_DETAIL_STEPS`; the box draws at 30 updates/s or better at every step on the FR-GUIDE-6 device (FR-LOOK-8, FR-LOOK-9, FR-LOOK-11).
- AC6: The three strengths are constants the owner sets from the mockup's sliders, and the release's phone run records the OLED reading and the rate before any of them is final (FR-LOOK-10, FR-LOOK-12).

**US-48 — The phone's pages answer first** *(v2.10)*
As a phone reader, the home opens on its three doors, the pass detail shows its chart on the first screen, and the app turns red by itself after dark if I ask it to.
- AC1: At 390 × 844 the three doors are the first block under the header and the Where reading follows them; a ready Where is one line and `[ details ]` (FR-PHONE-12).
  *(amended 2026-11-02, the owner's call, PLAN D-1024)* A ready Where is one line, the place with `[ change ]`; there is no `[ details ]`.
- AC2: The third door reads "Live sky" / "Cielo en vivo" with "satellites and stars, now" / "satélites y estrellas, ahora" (FR-PHONE-13).
- AC3: The pass detail's rise, peak and set are one row within 36 cells in both languages, the zone once in the head, and the drawing's top edge is at or above `DETAIL_DRAWING_TOP_PX` at 390 × 667 (FR-PHONE-14).
- AC4: Settings offers `Theme [x] Dark [ ] Night [ ] Auto`; with Auto the root reads `night` while the Sun at my place is below `THEME_AUTO_SUN_DEG` and `dark` otherwise, switching on the tick without a reload (FR-PHONE-15).
  *(withdrawn 2026-11-02 with FR-PHONE-15, D-1020)*

### 4.52 The phone first *(v2.10)*

The owner's reading of 2.9.0 on the phone (2026-11-01), in one sitting with the four releases before it: the phone has the sky, the sheet and the toggle, and the one control that matters is the least reachable one.
Their asks: the phone is the default, so following is on without a trip to the sheet and stays on between visits where the browser allows; whenever the stars are shown the reader must be able to see all of them, out of the window's field too, with or without the satellites; and the hint, the home, the pass detail and the theme carry habits of the desk.
This section is those.
Where a requirement says *on compact* it binds that layout only; the whole-sky rules bind both.

Constants (FR-VIS-6 style, centralised with the others):

| Constant | Default | Rationale |
|---|---|---|
| `FOLLOW_DEFAULT` | on | On a touch phone the window follows from the first reading where no permission is needed (FR-PHONE-1); the saved grant does the same on iOS after one allow (FR-PHONE-2). |
| `FIELD_OUTLINE_STROKE` | `--chart-hairline` | The window's field on the whole sky is a hairline in `--chart-compass`, so it reads as a frame and never as an arc (FR-PHONE-9). |
| `PINCH_HANDOFF_RATIO` | 1.15 | Pinching past the field's end by more than this hands the view over; a pinch that stops at the end stays, so the ends are not a trap (FR-PHONE-10). |
| `DETAIL_TIMES_CELLS` | 36 | The pass detail's one times row fits the compact row in both languages (FR-PHONE-14). |
| `THEME_AUTO_SUN_DEG` | −6° | The Sun's altitude below which Auto turns the theme to night: the end of civil twilight, where FR-STAR-13 draws every rung and the eye starts to adapt (FR-PHONE-15). |
| `HINT_TOUCH_CLAUSES` | 2 | On touch the hint has two clauses, which is what fits 36 cells at `--small` beside the box's margins in both languages (FR-PHONE-5). |

- **FR-PHONE-1** *(V210-2)* **Following is the default where nothing has to be asked.**
  Where FR-WIN-4's presence test passes and `permissionRequest()` is `null` (Android, and every browser without a motion request), the live page, the stars page and the pass detail open with following on: the view becomes the window if it was not (`chartView` is not written, FR-GYRO-2's rule), and from the sensor's first reading the window's facing and tilt are the phone's pose.
  FR-GYRO-4 holds: a drag or a key turns following off and hands the camera to the finger; the saved view is not touched.
  Opening with `t` in the link, with the card of FR-FULL-10 standing, or on a pass detail changes nothing of this: the card stays over a sky that already follows, and the detail's opening facing (FR-SKY-7) is replaced by the pose at the first reading as FR-FLOW-14's "until the sensor's first reading" always said.
  The old rule — off on every visit — held from v2.9.
  *Verification:* a component test per page with the stub answering `'granted'` with no request: following on at mount and off after a drag; `follow.spec.ts` at 390 × 844 with `stubOrientation` and no `requestPermission`.
- **FR-PHONE-2** *(V210-2)* **The grant is saved on iOS and asked inside the first touch.**
  Where a request exists, the first grant a reader gives (the toggle's tap, FR-GYRO-2) is saved in the prefs as `followGranted: true`.
  On a later visit with it saved, the page opens following-armed: nothing is asked at load (FR-WIN-4's "never on load" stands), and the reader's first `pointerdown` on the sky, whatever it becomes, runs `requestOrientationAccess()` inside the gesture; granted, following is on from the next reading and the touch goes on as it would (a drag that follows the same press turns following off again by FR-GYRO-4, which is the reader's own choice and costs nothing); refused, `followGranted` is cleared, the finger keeps the camera and FR-GYRO-3's line stands under the toggle for the visit.
  The first visit is unchanged: off until the toggle is tapped.
  A refusal never writes the pref.
  *Verification:* `prefs.test.ts` for the field; a component test with a stub that grants on the first touch, and one that refuses and clears the pref; the request count is exactly one per visit in both.
  *(amended v2.10, V210-15)* The request runs at the lift of the reader's first tap on the sky (WebKit grants `requestPermission()` only inside user activation, which for a touch is the lift, D-986); a drag or a pinch asks nothing and leaves the page armed.
- **FR-PHONE-3** *(V210-3)* **`[ follow ]` beside `[ controls ]`.**
  On the compact live page the bottom row of FR-FULL-3 holds, from the right, `[ controls ]` and then `[ follow ]` / `[ seguir ]`, a `TextButton` with `pressed` (bracketed in the accent while following, bare and dim while not), at least 44 × 44 px, `aria-pressed`, drawn only where FR-WIN-4's presence test passes; the row stays within 36 cells with the two controls in both languages (English 23 cells, Spanish 24).
  It is the same state the sheet's `[ ] follow the phone` row shows (FR-GYRO-1), and the sheet's row stays, so a reader finds it in either place; a tap on either asks as FR-GYRO-2 says.
  The hint of FR-FULL-3 moves to the row above the two controls whenever it would not fit beside both (`hintFitsBeside` reads the row's two labels).
  On the stars page and the pass detail the toggle stays where FR-GYRO-1 put it.
  *Verification:* `controlRows.test.ts` for the row; `Live.test.tsx` for the two states and the sheet's row agreeing; `targets.spec.ts` with the new control; `live-full.spec.ts` asserts the row's two controls and the hint's place at 390 × 844.
  *(amended 2026-11-02, the owner's call from the phone, PLAN D-1026)* The bottom row's overlay holds half a cell inside each end, as the head's box does, so `[ follow ]` and `[ controls ]` do not touch its edges; `hintFitsBeside` counts that cell.
- **FR-PHONE-4** *(V210-3)* **The readout on the sky while the finger has it.**
  On the compact live page, while following is off, the facing readout of FR-FLOW-5 is drawn in the box's top-right corner at `--small` on `--screen-overlay`, as FR-TONIGHT-6 item 5 drew it before v2.8 moved it into the sheet; it is the one line, cut with an ellipsis before it meets the head.
  While following it is not drawn, by FR-GYRO-5.
  The sheet's facing row is unchanged.
  The stars page and the pass detail already draw theirs in FR-FLOW-4's order.
  *Verification:* `Live.test.tsx` for presence by follow state; the overlay share of FR-FULL-3 holds with it (`live-full.spec.ts`).
- **FR-PHONE-5** *(V210-4)* **The hint fits.**
  On a touch pointer FR-FLOW-6's line is two clauses, "Drag to look · pinch to zoom" / "Arrastrá para mirar · pellizcá para acercar", and the tap-a-star clause is dropped; with a highlighted pass the second clause gives way to "tap A to follow" / "tocá A para seguir", so the line is never three.
  At 360 and 390 px in both languages the line is drawn whole, with no ellipsis, on the live page's overlay, the stars page and the pass detail.
  The fine-pointer line is unchanged.
  The compact live captures at 360 and 390 px are shot as touch pages from this release on, so the set shows the words a phone shows; the desk hint stays in the wide captures.
  *Verification:* the hint's component test in both languages and both pointers; an e2e at 360 × 780 and 390 × 844 asserts the hint node's `scrollWidth` equals its `clientWidth`; `captureSet.ts`'s compact live screens marked `touch`.
  *(amended v2.10, V210-13; before: one line)* The Spanish touch line, "Arrastrá para mirar · pellizcá para acercar", is wider than the box at 360 and 390 px (R157 measured 362 px), so on touch the line is drawn whole on at most two lines, breaking only between the clauses, with no ellipsis; the English line stays one.
  The e2e assertion becomes: no ellipsis, and at most two line boxes.
- **FR-PHONE-6** *(V210-4)* **The screen stays awake while following.**
  FR-LIVE-7's wake lock, held today by the live page while it is visible, is requested by the stars page and the pass detail as well whenever following is on, and released when it goes off or the page hides; the live page keeps its own rule.
  Where the API is absent nothing is shown.
  *Verification:* `useWakeLock`'s hook test; a component test per page asserting the request on follow and the release on its end.
- **FR-PHONE-7** *(V210-5)* **The whole sky on the stars page.**
  The stars page gains FR-FLOW-4's view row, `[Window] Whole sky` / `[Ventana] Cielo entero` (a `ToggleGroup` in the bracket mark, 20 cells in English and 23 in Spanish), between the `h1` block and the readout on compact and as the rail's `View` row on wide; the dome is not offered here, since the page is about the stars.
  `Whole sky` draws `SkyPolar` through FR-SKY-1's table with the page's layers (`stars`, `figures`, `planets`, `names`, and `passes` when on, with the keys at the peaks as the live page draws them), at the page's instant, in the box the window had.
  The choice is the page's own and not saved: every open is the window, as FR-STAR-3 says of the camera.
  `In this field` lists the whole sky's twelve brightest while the whole sky is shown.
  *Verification:* the view row's component test in both languages and `controlRows.test.ts`; an e2e asserts the polar chart's stars and figures in the box with the layers on and off, and the passes with `[ passes ]` on.
  *(amended v2.11, V211-5)* On compact the view row is the sheet's first group after its head (FR-CLEAN-4), not a row between the `h1` block and the readout.
  *(amended v2.12, V212-2; before: `[ Window ] Whole sky` at every width)* On wide the row reads `[ Window ] Globe` and the second value draws the celestial globe (FR-GLOBE-1); compact is unchanged.
  *(amended v2.12, V212-11; before: "every open is the window")* Every open on compact is the window; on wide every open is the globe (FR-GLOBE-1 as amended).
  Still not saved.
- **FR-PHONE-8** *(V210-5)* **The polar chart draws the star layer whole.**
  FR-SKY-1's table row for the polar chart becomes: the passes, the Sun, the Moon, the planets, the stars to `POLAR_STAR_MAG` raised to `STAR_MAG_LIMIT` (4.5), the figures as hairlines in `--chart-figure` with FR-STAR-6's gap at each glyph, and, with `names` on, the proper names of stars of V ≤ 1.5 and the figure names in spaced capitals, both by FR-STAR-6's placement scaled to the chart's unit; the landmark's ring and name as FR-SKY-1's amended rows.
  On compact `names` is off by default on the whole sky and on wide it is on, since a 250-unit disc at 390 px has room for the figures and not for their names; the stars page's `[x] names` toggle drives it in either case.
  The looking-up / map toggle turns the figures and the names with the stars.
  The live page's and the pass detail's polar view draw the same table, so the whole sky is one tap away from every sky view (the view row, FR-GYRO-11).
  OQ-43 is resolved the other way: figures yes.
  The old row — stars to 3.5, no figures, no names — held from v2.5.
  *Verification:* the layer table's test; `SkyPolar.live.svg` re-baselined once; a component test of the names' default by width.
- **FR-PHONE-9** *(V210-5)* **The field on the whole sky.**
  When the whole sky is drawn on a page whose window has a camera — the stars page, the live page and the pass detail, under the hand or following — the polar chart carries the window's current field as a closed outline in `--chart-compass` at `FIELD_OUTLINE_STROKE`: the image of the box's four edges under the window's projection, drawn through the polar projection, so a 60° field facing south at 35° is a trapezoid low on the southern edge and the zenith-facing field is a loop round the centre.
  It moves with every reading while following and with every drag or key under the hand, written by ref as the stars are (FR-STAR-9); it is not drawn while the page has no camera (the Where pane's dome is not a polar chart; the capture of a desk window with no camera draws it where the hand camera is).
  The outline is under the arcs and over the stars.
  *Verification:* `SkyPolar`'s test for the outline's shape at three poses; `follow.spec.ts` asserts the outline moving with injected readings on the stars page's whole sky.
- **FR-PHONE-10** *(V210-5)* **Pinch across the limit.**
  On a touch pointer, a pinch on the window that reaches `WINDOW_FOV_MAX_DEG` and goes on widening by more than `PINCH_HANDOFF_RATIO` hands the view to the whole sky on release, on the stars page and on the live page and the pass detail where the view row offers it; the window's camera is kept.
  A pinch on the whole sky that narrows by more than the same ratio hands the view back to the window at `WINDOW_FOV_MAX_DEG`, facing the point under the pinch's midpoint (the polar chart's inverse projection, already its hit test's) at that point's altitude as the tilt, and following stays off until the reader asks.
  Neither handoff writes `chartView`.
  On a desk the view row is the way across, as today; `+`/`-` stop at the ends.
  *Verification:* `window-zoom.spec.ts` with a synthetic pinch past each end, and one that stops at the end and stays; the facing after the return within 1° of the midpoint's.
- **FR-PHONE-11** *(V210-5)* **The dome is unchanged.**
  FR-SKY-5's twenty stars, its rate and its rasters do not move: the dome stays the satellite view, and the whole sky is the polar chart's job.
  *Verification:* the dome's captures byte-identical to 2.9.0's.
- **FR-PHONE-12** *(V210-6)* **The home: doors first, status folded.**
  On compact FR-FLOW-1's order becomes: the header; the three doors; the Where reading of FR-FLOW-2; then When and What.
  FR-FLOW-2's second line, while the state is ready, is `[ details ]` alone at the row's right end under the place (the readiness and the elements lines open inside it, where they already are); a fault keeps its full line in the second line's place, never folded, as FR-FLOW-2 says.
  *(amended 2026-11-02, the owner's call, PLAN D-1024)* While the state is ready there is no second line: the place line's `[ change ]` is the Where's one control, and the readiness and the elements lines are at the top of the group it opens (FR-FLOW-2 as amended); a fault keeps its full line under the place, without a `[ details ]`.
  This replaces the ready line's `[ details ]` alone.
  At 390 × 844 the third door's bottom edge is at or above 420 px in both languages.
  Wide is unchanged.
  *Verification:* the home's component test for the order and the folded line; the e2e home capture asserting the doors' bottom edge.
- **FR-PHONE-13** *(V210-6)* **The third door's name.** "Both · live sky" / "Ambos · cielo en vivo" becomes **Live sky** / **Cielo en vivo**, with a second line "satellites and stars, now" / "satélites y estrellas, ahora" before the state line FR-FLOW-1 gives it ("1 up now, beside Mintaka" or "Nothing up now · next 05:48"), each line within 34 cells.
  On wide the door keeps its third line.
  *Verification:* `doorLines`' test and `controlRows.test.ts` in both languages.
- **FR-PHONE-14** *(V210-6)* **The pass detail's times on one row.**
  On compact FR-FLOW-7's three cells become one row at `--small`: "07:20 → 07:23 at 48° NNE → 07:27" / "07:20 → 07:23 a 48° NNE → 07:27" (rise, peak with its altitude and direction, end; a shadow entry replaces the end's time with its own and the word "shadow" / "sombra" after it), within `DETAIL_TIMES_CELLS`; the zone abbreviation leaves the three cells for the head's date line ("2026-09-06 · GMT−3"), once.
  The table of points under the drawing keeps the full times.
  `DETAIL_DRAWING_TOP_PX` (480) is asserted at 390 × 667 as well as 390 × 844.
  Wide keeps its three cells in the band.
  *Verification:* `TimesRow`'s test for the four cases (plain, shadow, both languages); the bounding-box e2e at the two sizes.
  *(amended v2.11, V211-5)* On compact the row is the sheet's second group (FR-CLEAN-5); the zone is on the name line above it.
- **FR-PHONE-15** *(V210-6)* **The theme can follow the dark.**
  The settings page's Theme row reads `[x] Dark [ ] Night [ ] Auto` / `[x] Oscuro [ ] Noche [ ] Auto` within 36 cells; `theme` in the prefs admits `'auto'`.
  With Auto, the root's `data-theme` is `night` while the Sun's altitude at the observer and the real instant is below `THEME_AUTO_SUN_DEG`, and `dark` otherwise, decided before first paint from the saved observer (FR-THEME-1's "applied before first paint": the Sun's altitude is one `astronomy-engine` call the shell already makes) and again on FR-NIGHT-4's tick, so an evening open turns red at civil dusk without a reload; with no observer Auto reads as Dark.
  The live page's shown time `t` does not drive it: the theme is about the reader's eyes, not the scrubbed sky.
  Dark stays the default for a fresh profile.
  *Verification:* `theme.test.ts` for the three values and the two sides of the threshold; `settings.spec.ts` fits at 390 × 844 with the third option in Spanish.
  *(withdrawn 2026-11-02, the owner's call from the phone, PLAN D-1020)* Auto is gone on both widths: the Theme row is `[x] Dark [ ] Night` / `[x] Oscuro [ ] Noche`, the palette is the saved choice and nothing follows the Sun; a stored `auto` reads as no choice, so dark.
  In Spanish the three options wrapped the row on the phone, and the owner found the option without use.
- **FR-PHONE-16** *(V210-11)* **Strings, chunks, captures.**
  Every new string is in both catalogs (FR-I18N-*): `[ follow ]`, `Whole sky`, the door's two lines, the times row's words, `Auto`, the hint's touch form.
  The follow control and the readout are the `live` chunk's; the whole sky's view row the `stars` chunk's; the polar chart's figures and names are `SkyPolar`'s and land where it lands; the theme's rule is `main`'s (≤ 0.5 KB); the release re-sets every row by D-178 and names the growth.
  The phase's named moves are: every compact live capture (the bottom row, the readout, the touch hint, following on), the stars page at every width (the view row), every polar capture (the figures and names), the home at every width (the order, the folded line, the door), the pass detail at compact widths (the times row), the settings page (the third option); the capture set gains the stars page's whole sky at 390 and 1280 px with `[ passes ]` off and on, the field outline while following at 390 px, and the pass detail at 390 × 667.
  *Verification:* the catalog parity test; `npm run check:dead`; `npm run bundle:budget`; FR-CAP-5's diff against 2.9.0 lists these files and no other.
  *(amended v2.10, V210-16)* The release measured `main` at 180.3 KB, +3,824 bytes over 2.9.0's 176.6; the owner accepted the measure and raised `main`'s ceiling and budget to 185, as V25-20 and V26-14 did; `stars` 35, `window` 15 and `stars-deep` 50 by D-178.

### 4.53 The look of the sky, second pass *(v2.10)*

v2.4.1 fixed the stars' look beside Sky Guide in the app's own characters and tokens (V24-13..V24-16), and the owner's reading of the 2.9.0 captures (2026-11-01) found what that look lacks: the sky is the page background, the zoom is a crop of the same thousand stars, and three rungs from 2.5 to 4.5 are the same dot.
A mockup from the app's own catalogue (https://claude.ai/artifact/TXAALKGuVwJSMSj8awG637: the same sky, Bariloche on 2026-09-06 at 22:00 facing west, drawn as 2.9.0 draws it and as this section draws it, at 60° and at 20°) settled the direction — the richer sky, not the flat one — and its first cut was too bright, "full white", which the haze, the bloom and the faint points answer for; the second cut carries three sliders whose values become constants here.
What follows is drawn in the DOM as every view is (UX-1: no canvas, no WebGL), with the star layer's node count bounded by the field rather than by the catalogue.

Constants (FR-VIS-6 style, centralised with the others):

| Constant | Default | Rationale |
|---|---|---|
| `DEEP_MAG_LIMIT` | 6.5 | The Yale catalogue's own limit: every naked-eye star under a dark sky, 9,110 records, already vendored. |
| `DEEP_BUDGET_KB` | 60 KB gzipped | The deep catalogue as quantised columns (right ascension and declination to 0.01°, magnitude to 0.1, B−V to 0.1), its own lazy chunk; the measure re-sets it by D-178. |
| `FIELD_DETAIL_STEPS` | `[[75, 4.5, 1.5], [45, 5.3, 1.5], [30, 6.0, 2.5], [0, 6.5, 3.2]]` | Per field (the first number the field above which the row applies, degrees): the faintest magnitude drawn and the faintest named. 5.3 at 60° is the mockup's second cut; 6.5 at 20° is what makes the pinch a telescope and not a crop. |
| `DEEP_NODE_POOL` | 600 | The deep stars' `<circle>` nodes, created once and reused by ref; at 45° a box holds about 220 stars to 5.3 and at 20° about 140 to 6.5, so the pool never runs out and the DOM never grows with the catalogue. |
| `STAR_DOT_MAG` | 2.5 | Brighter than this a star is a `*` character; from here down a round dot (V210-8). |
| `DOT_RADIUS_PX` | 2.4 at 2.5, 0.6 at 6.5, linear in magnitude | The dot's size is the magnitude, continuous, so no two rungs are the same dot. |
| `STAR_SIZES_PX` | `*` at 20 (V ≤ 0.5), 16 (≤ 1.5), 13 (≤ 2.5) | The three `*` sizes, one step up from v2.4.1's 18/15/12 so the brightest stand clear of the dots. |
| `BV_TONES` | `< 0.0` blue-white, `< 0.4` white, `< 0.8` yellow-white, else orange | Four tones from the B−V colour index, low in saturation so size still carries magnitude (FR-X-5). |
| `BLOOM_MAG` | 1.8 | Stars and planets brighter than this carry a bloom: about twenty at any instant. |
| `BLOOM_RADIUS_PX` | `8 + (2.2 − V) × 5` | Sirius about 26 px, a first-magnitude star about 14. |
| `BLOOM_STRENGTH` | 0.7 | The mockup's second-cut slider; the gradient's centre alpha is 0.32 × this. The owner may re-set it from the sliders before the release (FR-LOOK-10). |
| `MILKY_WAY_STRENGTH` | 0.6 | The haze's slider; the three bands' alphas are 0.03, 0.04 and 0.05 × this. |
| `HORIZON_STRENGTH` | 0.6 | The horizon band's slider; the band's alpha at the horizon is 0.5 × this. |
| `HORIZON_BAND_DEG` | 15° | The band's height in altitude; the lightest sky a faint star stands on is at 0°, and the contrast floor is measured there. |
| `MILKY_WAY_BANDS_DEG` | `[12, 7, 3]` | Half-widths in galactic latitude of the three stacked bands, with the core widened by `exp(−(l / 55°)²)` × 3° so the bulge reads. |
| `MOON_DISC_PX` | 10 | The Moon's drawn disc in the window and on the whole sky, with its lit limb (FR-LOOK-7). |

- **FR-LOOK-1** *(V210-7)* **A sky surface.**
  The window's box, when its scene carries stars, fills with `--chart-sky-deep` under everything: a tone darker than `--bg` in both themes (dark `#06080d`, night `#060101`; a surface, ≤ 1.1 : 1 on `--bg`), so the drawing has an edge against the page and the stars gain range.
  Along the horizon a band of `HORIZON_BAND_DEG` in altitude is a gradient from `--chart-horizon-glow` (dark `#1c2535`, night `#1e0a08`) at `HORIZON_STRENGTH` × 0.5 at 0° to transparent at the band's top, drawn as the altitude ring's image under the projection clipped to the sky side, with no filter.
  FR-STAR-6's ground stays as it is under the horizon.
  The whole sky (the polar chart) takes the same surface inside its horizon ring and the same band inside its rim.
  The dome does not change.
  Every tone is a token with a night value (FR-DS-8's family).
  *Verification:* the tokens test holds every star tone of FR-LOOK-5 ≥ 3 : 1 against `--chart-sky-deep` and against the band's lightest value in both themes; the window's snapshot with the surface and the band.
- **FR-LOOK-2** *(V210-7)* **The twilight tint.**
  FR-STAR-13's three steps tint the surface too: while the Sun is above 0° the surface is `--chart-sky-day` (dark `#1a2230`, night `#1e0a08`), between 0° and −6° `--chart-sky-twilight` (dark `#111826`, night `#120505`), and below −6° `--chart-sky-deep`; the step is the scene's, so the stars thin into a lighter sky and the surface changes with the shown instant on the live page as the stars do (FR-SKY-8).
  The band of FR-LOOK-1 is drawn on every step.
  *Verification:* a component test at the three altitudes; the twilight capture of the live page (FR-LOOK-12).
- **FR-LOOK-3** *(V210-7)* **The Milky Way as a haze.**
  The build step (FR-STAR-1) writes beside the catalogue an outline of the galactic plane, `milkyWay.json`: for each of `MILKY_WAY_BANDS_DEG` the closed curve of galactic latitude ±b sampled every 3° of longitude and converted to J2000 right ascension and declination once (the IAU 1958 pole and node), about 360 points in all, ≤ 2 KB gzipped, from no external image.
  The window draws the three bands as filled paths under the figures and over the surface, in `--chart-haze` (dark `#7f93b0`, night `#8a2e26`) at their alphas × `MILKY_WAY_STRENGTH`, each clipped to the sky side of the horizon and at the field's edge as an arc is; the three stack, so the plane reads darkest at its middle and the core at Sagittarius widest; no blur filter, which a phone pays for on every frame.
  The whole sky draws the same three bands through its projection.
  Off with `[ ] stars`, as the stars are.
  *Verification:* `starCatalog.test.ts` pins the outline's point count and size; the window's snapshot; the rate of FR-LOOK-11.
- **FR-LOOK-4** *(V210-8)* **The ladder: characters to 2.5, dots below.**
  FR-STAR-6's ladder becomes: V ≤ `STAR_DOT_MAG` a `*` character in `--font-mono` at `STAR_SIZES_PX` by rung, ink-centred as V24-15 has it; fainter, a round dot (`<circle>`) of `DOT_RADIUS_PX` by magnitude, centred on the point; a planet `@` at the `*` sizes by its magnitude, as today, and never a dot.
  The collision rule (half the small size, the brighter alone) and the hit test (12 px) stay, the dot's radius counting as its ink.
  Monochrome keeps the reading (FR-X-5): the `*` and its size, the dot and its size, `@` for a planet.
  The old ladder — three sizes of `*`, `+` and `.` in three greys — held from v2.4.1; the `+` and `.` glyphs leave the star layer, and `--chart-star-dim` and `--chart-star-faint` stay for the names and the figure names.
  *Verification:* `starGlyphs.test.ts`'s table rewritten; the window's and the polar chart's snapshots re-baselined once.
- **FR-LOOK-5** *(V210-10)* **Colour from B−V.**
  Every star carries one of four tones by `BV_TONES` from the index the Yale catalogue carries (the build writes it to 0.1 for the bright catalogue and the deep one; a star with no index is white): `--chart-star-blue` (dark `#c9d6f7`), `--chart-star` (the white, unchanged), `--chart-star-yellow` (dark `#f2eedc`), `--chart-star-orange` (dark `#f1c39d`); each with a night value red with `r ≥ g ≥ b` (FR-THEME-3: in night mode the four are four reds that differ in lightness only), each ≥ 3 : 1 on `--chart-sky-deep` and on the band's lightest value.
  A dot fainter than 4.5 draws its tone at `fill-opacity` falling from 0.7 at 4.5 to 0.3 at `DEEP_MAG_LIMIT`, so the deep stars read as depth and not as noise (the "full white" the first cut had).
  The planets keep `--chart-planet`.
  *Verification:* the tokens test for the six pairs; `starGlyphs.test.ts` for the tone per index and the opacity per magnitude.
- **FR-LOOK-6** *(V210-7)* **The bloom.**
  Under every star and planet brighter than `BLOOM_MAG` the window draws one `<circle>` of `BLOOM_RADIUS_PX` filled with a radial gradient in the star's tone from 0.32 × `BLOOM_STRENGTH` at the centre through 0.08 × it at 35 % to transparent at the edge — six gradients, one per tone and one for the planets, defined once — under the figures and over the haze.
  The whole sky draws it at the chart's unit.
  No filter.
  *Verification:* the count of bloom nodes equals the count of stars and planets above the threshold in the field; the snapshot.
- **FR-LOOK-7** *(V210-7)* **The Moon with its phase.**
  In the window and on the whole sky the Moon is a disc of `MOON_DISC_PX` in `--chart-moon`: the lit part from the illumination fraction and the bright limb's position angle the scene already has from `astronomy-engine` (FR-MOON-1), the dark part in `--chart-sky-deep` with a hairline rim, so a waning crescent at 28 % is a crescent facing the Sun's side.
  The dome keeps FR-DOME-6's glyph.
  The legend's Moon line is unchanged.
  *Verification:* `MoonDisc`'s test at four phases and two limb angles; the window's snapshot.
- **FR-LOOK-8** *(V210-9)* **The deep catalogue.**
  The build step writes a second file, `src/data/stars/deep.json`: every Yale star with `STAR_MAG_LIMIT` < V ≤ `DEEP_MAG_LIMIT` as quantised columns (FR-STAR-1's shape) with its B−V, and nothing else — no names, no designations, no figures (a figure endpoint fainter than 4.5 is already in the bright catalogue).
  It is its own lazy chunk, `stars-deep`, with its own budget row at `DEEP_BUDGET_KB`, loaded by the window when the field first falls below the first step of `FIELD_DETAIL_STEPS` that needs it and prefetched on idle after the `stars` chunk on the stars page only; precached by the service worker with the other chunks (FR-OFF-1), so the pinch works offline.
  Positions go through FR-STAR-2's one rotation per instant with the bright catalogue's.
  `starCatalog.test.ts` pins its count and size.
  *Verification:* the chunk's row in `bundle:budget`; the service worker's precache manifest test; a network test that the chunk is not requested at `WINDOW_FOV`.
  *(amended v2.10, V210-12; before: loaded when the field first fell under the first step that needs it, and never requested at `WINDOW_FOV`)* The second row of `FIELD_DETAIL_STEPS` (5.3 from 45° to 75°) covers the default field, so the chunk is loaded whenever the stars layer draws at a field of 75° or under — on idle after the `stars` chunk, on every page that draws stars — and the 60° sky shows stars to 5.3 as the mockup did.
  The verification's network assertion becomes: the chunk is requested once per visit, after `stars`, and not at all with `[ ] stars`.
- **FR-LOOK-9** *(V210-9)* **Detail follows the field.**
  At every draw the window takes the row of `FIELD_DETAIL_STEPS` for its `fov` and draws every star to the row's magnitude and names every star to its named magnitude, by designation where the star has no proper name (`Alp Sco`); FR-STAR-13's twilight step still cuts above that, and the names' placement is FR-STAR-6's.
  The deep stars are drawn through a pool of `DEEP_NODE_POOL` nodes written by ref (FR-STAR-9's rule): the stars in the field sorted brightest first fill the pool, and the rest are not drawn.
  The whole sky draws the bright catalogue only, with the 4.5 row's names, since it has no field.
  The old rule — the same stars at every field, names to 1.5 — held from v2.5.
  *Verification:* `fieldDetail.test.ts` for the row per field and the pool's fill order; `window-zoom.spec.ts` counts the drawn stars at 60° and at 20° on a fixture night and asserts the names at 20° include a designation.
- **FR-LOOK-10** *(V210-7)* **The strengths are the owner's.**
  `BLOOM_STRENGTH`, `MILKY_WAY_STRENGTH` and `HORIZON_STRENGTH` are constants in one module with the ladder's; their defaults are the mockup's second-cut sliders, and the owner may re-set them once from the sliders before the release task is cut, by a Decision Log row and nothing else.
  No slider ships in the app.
  *Verification:* the constants' test pins the three values.
- **FR-LOOK-11** *(V210-9)* **The rate holds.**
  With every layer on, the haze, the bloom, the surface and the deep stars at 20°, the window draws at ≥ 30 updates/s on the FR-GUIDE-6 device under a drag and under the sensor, by `stars-perf.spec.ts` at `WINDOW_FOV` and at `WINDOW_FOV_MIN_DEG`; the polar chart's drag under `live-perf.spec.ts` is not below 2.9.0's measure by more than a tenth with the figures and names on.
  If the haze's three paths cost the frame, they are drawn once per instant into a `<pattern>` the frame transforms, and the plan says which.
  *Verification:* the two specs.
- **FR-LOOK-12** *(V210-11)* **Strings, chunks, captures, and the phone.**
  The new tokens (FR-LOOK-1, FR-LOOK-2, FR-LOOK-3, FR-LOOK-5) join `tokens.css` with night values and the tokens test; `docs/DESIGN.md` is regenerated.
  The window's new drawing is the `window` chunk's and may grow by what it measures, the deep catalogue is `stars-deep`'s, the haze outline is the `stars` chunk's (≤ 2 KB), and `main` does not grow; the release re-sets every row by D-178.
  The phase's named moves are every capture that draws the window or the polar chart with stars on; the capture set gains the live page's window at civil twilight (FR-LOOK-2) and the stars page at 20° at 390 px in both themes.
  Before the release the owner's phone run (`docs/RELEASE.md`) records two things in writing: the look on an OLED screen in the dark in both themes, and the rate under a drag at 20° with everything on; FR-LOOK-10's constants are final after it and not before.
  *Verification:* the tokens test; `design.test.ts`; `bundle:budget`; FR-CAP-5's diff.

### 5.15 v2.10 additions *(proposal; the plan decides)*

- `followGranted` and `theme: 'auto'` in the prefs schema; the theme's Sun step beside the first-paint theme writer (FR-PHONE-2, FR-PHONE-15).
- One `FollowControl` for the overlay's bottom row over the same state `FollowToggle` reads; the readout as the overlay's third slot (FR-PHONE-3, FR-PHONE-4).
- The polar chart's layer table row widened, the figures and names scaled by its unit; the field outline as one pure function from the window's camera to a polar path (FR-PHONE-8, FR-PHONE-9).
- The build step's two new outputs, `deep.json` and `milkyWay.json`, and a `stars-deep` chunk; `fieldDetail.ts` as one pure module over `FIELD_DETAIL_STEPS`; the deep stars' node pool beside the star field's ref channel (FR-LOOK-3, FR-LOOK-8, FR-LOOK-9).
- `starGlyphs.ts` rewritten for the dot rung and the B−V tones; `MoonDisc` beside the Moon glyph (FR-LOOK-4, FR-LOOK-5, FR-LOOK-7).
- The constants of §4.52 and §4.53 beside the layout and the star constants.

### Phase 2s — v2.10 ("the phone first", as decided 2026-11-01, V210-1)

After v2.9.0 is on `main` (`95f3c88`).
Every page that draws the sky, compact and wide where a rule says so; one version holding the five parts the owner read in one sitting.

- Following by default, the saved grant, the control and the readout on the sky, the hint, the wake lock (FR-PHONE-1..6).
- The whole sky: the stars page's view row, the polar chart's figures and names, the field outline, the pinch across the limit, the dome unchanged (FR-PHONE-7..11).
- The phone's pages: the home's order and the folded line, the door's name, the times row, the theme by the clock (FR-PHONE-12..15).
- The look: the surface, the tint, the haze, the ladder with dots and tones, the bloom, the Moon's phase, the deep catalogue and detail by field, the rate (FR-LOOK-1..11).
- Strings, chunks, captures, the phone run (FR-PHONE-16, FR-LOOK-12).

Definition of done:
- FR-PHONE-1..16 and FR-LOOK-1..12 met, each by its verification line; US-45..US-48's criteria green; OQ-43 resolved.
- `targets.spec.ts`, `rhythm.spec.ts`, `live-full.spec.ts`, `follow.spec.ts`, `window-zoom.spec.ts`, `stars-perf.spec.ts` and `shapes.spec.ts` green at the compact sizes in both languages; the tokens test green with the new tokens in both themes; the e2e and capture specs green under `stubOrientation`.
- `npm run bundle:budget`: every row inside its budget, the `stars-deep` row within `DEEP_BUDGET_KB`, `main` within its ceiling as the owner re-set it (185, V210-16; the draft said not larger than 2.9.0's); the release re-sets the rows by D-178.
- The owner's phone run written into `docs/RELEASE.md` §23 with the OLED reading and the rate; FR-LOOK-10's three constants final.
- Every task `Gate: auto`: merged on CI green and a clean review, no owner gate; the model of each task is PLAN §16.29's (V210-11).
- The waves are shaped by the account's limits: at most one `fable` task per wave, the driver's wait-and-resume on (D-835), nothing started with `--no-wait`, so a stop never needs a relaunch by hand (V210-11).
- `package.json` reads 2.10.0.
  The tag and the deploy are the owner's.
