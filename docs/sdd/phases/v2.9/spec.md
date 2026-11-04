# v2.9 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.16 Goals (v2.9, "follow the phone")

- **G50. The sky in the hand.**
  On a phone, the page's own sky turns with the phone at one tap, and nothing but the sky and the way out stands over it.

**US-44 — Hold the phone up to the page's own sky** *(v2.9)*
As a phone reader on the live page, the stars page or a pass's page, I tap `[ follow the phone ]` and the sky I am already looking at turns as I turn the phone; the controls rise from the bottom and close with a `×` or a swipe down.
- AC1: On a touch device with the orientation sensor, `[ follow the phone ]` is in the live page's sheet, and on the stars page and the pass detail where `[ hold up to the sky ]` stood; where there is no sensor it is absent (FR-GYRO-1).
- AC2: The first tap asks iOS for motion access inside the tap; granted, the view becomes the window and its facing and tilt follow the phone from the next reading; refused, the toggle stays off and one line says how to allow it (FR-GYRO-2, FR-GYRO-3).
- AC3: While following, a drag hands the sky back to the finger and turns the toggle off; a pinch zooms and keeps following (FR-GYRO-4).
- AC4: No page opens the sky screen any more: `[ hold up to the sky ]`, the screen and its compass gutter are gone (FR-GYRO-6).
- AC5: The sheet rises from the bottom upright and sideways, and closes on its `×`, on a downward swipe past `SHEET_SWIPE_CLOSE_PX` or a flick, on `[ controls ]` and on `Esc`; a tap on the sky no longer closes it (FR-GYRO-7, FR-GYRO-8).
- AC6: The sheet ends with "Satellites (n)" and the list open under it, with no button to open it; the view row reads `[Window] Polar Dome` on every page (FR-GYRO-10, FR-GYRO-11).

### 4.51 Follow the phone *(v2.9)*

The owner's reading of 2.8 on an iPhone (Chrome, 2026-10-30), three asks in one sitting.
The sky screen held upright was a band of sky under an empty block and over a compass strip, with a readout, a declination line and the turning advice on top: "avoid rendering too much info, just the × at the top to leave the view, more clean".
Then: "for the satellites and stars view I can't use the gyroscope" — the live page and the stars page move only under the finger, and the phone's motion steers only the separate sky screen.
And: "controls must be opened from the bottom and closed with a cross or slide down"; the list button "should be the open list of satellites — keep it in the controls"; and "window must be first before polar and dome".
Since v2.8 made the phone's live page all sky, the sky screen is a second copy of it; the owner's answer (V29-1) is to let the page's own sky follow the phone and retire the screen, so the clean view is the page itself.
It applies wherever the sky screen could be opened (FR-FSC-6, FR-STAR-5): the live page, the stars page and the pass detail, compact and wide alike where the sensor is present.

Constants (FR-VIS-6 style, centralised with the others):

| Constant | Default | Rationale |
|---|---|---|
| `SHEET_SWIPE_CLOSE_PX` | 64 px | A downward drag of the sheet this far closes it on release: more than a thumb's wobble on the head row, well under the sheet's height at 390 × 667. |
| `SHEET_FLICK_PX_PER_MS` | 0.5 px/ms | A faster downward flick closes it however short, as native sheets do. |

- **FR-GYRO-1** *(V29-2)* **The toggle.**
  Where FR-WIN-4's presence test passes (a touch device with `DeviceOrientationEvent`), one `OptionToggle`, `[ ] follow the phone` / `[ ] seguir el teléfono`, stands: in the live page's sheet as its own row after the view row (compact), and in the rail's `View` group (wide); on the stars page and the pass detail in the place of `[ hold up to the sky ]` (FR-FLOW-8's primary action, the pass detail's), at least `--tap` tall.
  Where the test fails it is absent, and nothing else changes.
  It is off on every visit; it is never saved.
  *Verification:* component tests on each page with and without the constructor and touch points; `targets.spec.ts`; `controlRows.test.ts` fits the row in 36 cells in both languages.
  *(amended v2.10, V210-2, V210-3; before: off on every visit, never saved)* Following is on by default where no permission exists (FR-PHONE-1) and the first grant is saved where one does (FR-PHONE-2); the toggle's row stays and shows the same state as `[ follow ]` in the overlay's bottom row (FR-PHONE-3).
  *(amended v2.11, V211-4)* The stars page's and the pass detail's action slot is gone with the column: on compact the toggle is a row in each page's sheet after the view row (FR-CLEAN-4, FR-CLEAN-5), as on the live page, and `[ follow ]` stands in the bottom row (FR-CLEAN-3).

- **FR-GYRO-2** *(V29-2)* **Turning it on.**
  The tap that turns it on asks for the permission inside the gesture (FR-WIN-4, `requestOrientationAccess`), and nothing else may ask.
  Granted: the view becomes the window if it was not (the saved `chartView` is not written), and from the sensor's next reading the window's facing and tilt are the phone's pose — the direction the back of the phone points, upright to the reader by FR-FSC-10's rule — at the field the reader had (FR-SKY-14).
  The shown instant, playback and the sheet are untouched.
  While following, FR-FOL-5's ground notes apply to the window as they did on the screen.
  Turning it off leaves the camera where the phone last pointed.
  *Verification:* a component test with a stubbed permission and a stubbed reading: the view switches to the window, the readout follows the reading, `chartView` is unchanged; an e2e with injected `deviceorientation` events at 390 × 844 on the live page and the stars page.
  *(amended v2.10, V210-2)* On a visit with `followGranted` saved, the request runs inside the reader's first touch on the sky, and the page follows from the next reading (FR-PHONE-2).
  *(amended 2026-11-02, the owner's call from the phone, PLAN D-1018)* **The aim drawn low.**
  While following, the window's picture is the phone's pose exactly, drawn with its aim `followAimShiftPx` below the box's centre: (0.5 − `FOLLOW_HORIZON_SHARE`) of the drawing's height, `FOLLOW_HORIZON_SHARE` being 0.15.
  Held level, the phone's horizon is then one straight line 15 % of the height above the bottom edge and the sky fills the rest; tilted, the picture moves with the phone one to one, the horizon rising as the phone points lower and leaving the bottom as it points higher.
  It is a shift of the image and not a turn of the camera, so nothing is held or eased; a pose under the horizon is lifted (D-1022, below).
  FR-FOL-5's ground state reads the box's centre, the aim's altitude plus the shift's angle, so its notes show once the centre is under the horizon.
  Where the hand drives the aim is the centre, as before.
  **The field while following.**
  A drawing taller than wide is drawn at `followFovDeg`: the field that spans `FOLLOW_VERTICAL_FIELD_DEG` (65°) top to bottom at the opening field, about 31° across at 390 × 844, a pinched field scaling from there; at `WINDOW_FOV` across a portrait phone the drawing spans about 115° and, with the aim drawn low, its top reached the zenith, where a small turn swings the sky round fast (the owner's screen recording, 2026-11-02).
  With the cap a level phone's top edge is about 53° up, near the landscape phone's 49°.
  *(2026-11-02, the owner's call after the phone test)* The cap was 80° (top edge 63°); upright the picture still felt faster than turned, so it is 65°.
  A drawing as wide as it is tall or wider is left at the camera's field.
  When following ends the hand takes the field the window drew, so the picture does not change scale under the finger.
  *(amended 2026-11-02, the owner's call from the phone, PLAN D-1022)* **A downward tilt lifted.**
  A phone is held pointing a little down to read it, and drawn exactly, 20° under the horizon put ground over the lower third of the box.
  While following, a pose under the horizon is drawn raised by `followLiftDeg`: half its depth down to `FOLLOW_LIFT_BAND_DEG` (50°) under, so 20° under is drawn 10° under; from there the lift falls back to nothing at the nadir.
  The drawn tilt rises with the phone's everywhere — at half the rate inside the band — so the picture never holds still or runs backwards, and the facing and the roll are the phone's.
  At and above the horizon the picture is the phone's pose exactly.
  The readout, the ground notes and the hand handed back read the drawn pose.
  *(amended 2026-11-02, the owner's call from the phone, PLAN D-1027)* The lift has no corner: it eases in over the first `FOLLOW_LIFT_EASE_DEG` (8°) under the horizon and eases back out toward the nadir, so a phone held level, which wobbles across the horizon all the time, never meets a sudden change of rate; 20° under is drawn 12° under.
  *Verification:* `followLift.test.ts`; `SkyWindow.follow.test.tsx`'s ground note 55° under.
  *Verification:* `followShift.test.ts` (a level phone's horizon at the share on one line; the shifted projection is the centred one moved by the shift, at every tilt; the drawable limit and the ground state with the shift; the portrait field spans 65° and scales with a pinch, a wide drawing's is unchanged); `SkyWindow.follow.test.tsx` (10° under the horizon no ground note, 40° under it the note); `follow.spec.ts` on the upright phone on the three pages in both languages (aimed level, the horizon path is one line at 85 % of the height).

- **FR-GYRO-3** *(V29-3)* **Refused.**
  A refusal (or a throwing request) leaves the toggle off and puts one `role="status"` line under it, in both languages: "Motion access is off.
  Allow it in the browser's settings, then tap again." / "El acceso al movimiento está desactivado.
  Permitilo en los ajustes del navegador y volvé a tocar." The line goes on the next tap.
  *Verification:* a component test with a refusing stub; the strings' snapshot.

- **FR-GYRO-4** *(V29-4)* **The finger wins.**
  While following, a drag on the sky turns following off and hands the camera to the finger from where it is (the toggle reads off, no note); a pinch zooms the field and keeps following; the keys of FR-SKY-14 turn following off as a drag does.
  *Verification:* component tests for the drag, the pinch and a key.

- **FR-GYRO-5** *(V29-2)* **Nothing over the sky.**
  Following adds nothing over the drawing: no readout, no gutter, no legend strip, no advice.
  On the compact live page the overlay stays FR-FULL-2's head and FR-FULL-3's button; on the stars page and the pass detail their own rows stay where they are.
  *Verification:* the per-page inventory tests with following on.
  *(amended v2.10, V210-3)* On the compact live page the overlay while following is the head and the bottom row with its two controls (FR-PHONE-3); the facing readout stands in the box's corner only while following is off (FR-PHONE-4).

- **FR-GYRO-6** *(V29-1)* **The sky screen is retired.**
  `[ hold up to the sky ]`, the sky screen (§4.23, FR-FSC-1..11), its stars inventory (FR-STAR-5) and the compass gutter (§4.31, FR-GUT-1..8) are removed with their strings, captures and specs; choosing the window no longer opens anything (FR-WIN-4's tap now only asks for the permission when the toggle is tapped).
  FR-FOL-5's ground notes and FR-FSC-10's upright rule move to the following window.
  *Verification:* `npm run check:dead`; no test id `sky-screen*` or `window-hold-up` rendered; the capture set without the screen's files.

- **FR-GYRO-7** *(V29-5)* **The sheet rises from the bottom, both ways.**
  The controls sheet (FR-FULL-4) is a bottom sheet in both shapes: on the landscape phone it spans the box's width and at most `SHEET_MAX_SHARE` of the height, its body scrolling, in place of v2.8's side sheet.
  *Verification:* `live-full.spec.ts` at 844 × 390: the sheet's bottom edge on the viewport's and its height at most `SHEET_MAX_SHARE`.

- **FR-GYRO-8** *(V29-6)* **Closing the sheet.**
  The sheet's head ends in a `×` (the app's one icon, FR-FSC-2's form, moved here), a hit area of at least 44 × 44 px with the accessible name "Close controls" / "Cerrar controles", in place of `[ close ]`.
  The sheet also closes on a downward drag that starts on its head row and travels more than `SHEET_SWIPE_CLOSE_PX`, or a downward flick faster than `SHEET_FLICK_PX_PER_MS`; while dragged it follows the finger and snaps back on a shorter release; under reduced motion it closes without the slide.
  `[ controls ]` and `Esc` still close it (FR-FULL-5).
  A tap on the sky above the sheet no longer closes it (D-922 withdrawn): with the sheet open a tap on the sky is the sky's (follow a pass, name a star).
  *Verification:* component tests for the `×`, `Esc` and a tap on the sky; an e2e with touch drags of 40 px (stays), 80 px (closes) and a short fast flick (closes).

- **FR-GYRO-10** *(V29-8)* **The satellites, open in the sheet.**
  On compact the sheet has no `[ list (n) ]` button: its last group is a heading, "Satellites (n)" / "Satélites (n)" (`n` as FR-TONIGHT-7's count), with the hidden-objects toggle at its right end (D-905's place), and the list of FR-WATCH-3 under it, always open; with nothing drawn it reads FR-LEG-'s empty line.
  The sheet's order, top to bottom, `--space-3` between groups (FR-FLOW-10): the head (the place, `[ settings ]`, `×`); the context line; the time track with its label row and the three taps; the view row; `[ follow the phone ]` (FR-GYRO-1); the facing row; `[ Share ]`; the satellites.
  The sheet's body scrolls when they do not fit (FR-FULL-4's cap).
  Wide keeps its legend in the rail.
  *Verification:* the sheet's order test in both languages; `live-full.spec.ts` with a 20-pass run: the heading's count, the list inside the scrolling body, the page not scrolling.

- **FR-GYRO-11** *(V29-9)* **The window first.**
  The view row lists the window first on every page and width: `[Window] Polar Dome  [x] stars` / `[Ventana] Polar Domo  [x] estrellas` on compact, and the same order in wide's `View` group.
  The cell counts are unchanged.
  Which view opens is unchanged (FR-FLOW-14, V25-1).
  *Verification:* the view row's component test and `controlRows.test.ts` in both languages; FR-FLOW-4's order e2e.

- **FR-GYRO-9** *(V29-7)* **Strings, chunk, captures.**
  The toggle, its refusal line and the `×`'s name are in the catalog in both languages; the screen's and the gutter's strings go (FR-FLOW-17's rule).
  Retiring the screen takes the `SkyScreen` code out of the live, stars and detail chunks, so no budget row may grow.
  The phase's named moves: every capture of a page that showed `[ hold up to the sky ]` (the stars page and the pass detail at every compact width), the compact live sheet captures (the toggle row, the `×`, landscape as a bottom sheet), and the sky screen's files removed; new captures of the live page and the stars page following at 390 × 844.
  Captures of the window following are shot with injected orientation events, and every e2e or capture spec that touches the permission stubs `DeviceOrientationEvent.requestPermission` itself, so a browser that implements it (Chrome for Testing 151 answers `prompt`) shoots the same set.
  *Verification:* `npm run bundle:budget`; FR-CAP-5's diff against 2.8.0.
  *(amended v2.9, V29-10; before: no budget row may grow)* The release measured `live` 15.6 KB, +349 bytes over 2.8.0 for the sheet's swipe and `×`, inside its budget of 20, while `main` fell 3,507 bytes and the stars and window chunks about 600 each with the screen gone; the owner accepted the measure.
  Every other row is at or under 2.8.0's.

### Phase 2r — v2.9 ("follow the phone", as decided 2026-10-30, V29-1)

After v2.8.0 is on `main` (`c996ba3`).
Every page that could open the sky screen, compact and wide where the sensor is present.

- The toggle, its permission and its refusal (FR-GYRO-1..3).
- The finger wins, nothing over the sky (FR-GYRO-4, FR-GYRO-5).
- The sky screen and the gutter retired (FR-GYRO-6).
- The sheet from the bottom, closed by `×` or a swipe (FR-GYRO-7, FR-GYRO-8).
- The satellites open in the sheet; the window first (FR-GYRO-10, FR-GYRO-11).
- Strings, chunk, captures (FR-GYRO-9).

Definition of done:
- FR-GYRO-1..11 met, each by its verification line; US-44's criteria green; US-43's AC3 read through FR-FULL-4 and FR-FULL-5 as amended.
- `targets.spec.ts`, `rhythm.spec.ts`, `live-full.spec.ts` and `shapes.spec.ts` green at the compact sizes in both languages; the e2e and capture specs green on a browser that implements `requestPermission`.
- `npm run bundle:budget`: no row larger than 2.8.0's but `live` (+349 bytes, accepted, V29-10), every row inside its budget.
- `package.json` reads 2.9.0.
  The tag and the deploy are the owner's.
