# v1.3 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.6 Goals (v1.3, "the sky screen")

- **G17. Following is the whole screen.**
  With the phone held up sideways the picture is all there is — the sky it points at, where it is looking, what the keys mean — and one tap puts the page back.
  *(amended v1.3.1, V13-6, V13-7, V13-9)* The way in is the view control's "window" option — on the live page and on the pass detail, the same screen from both — and the screen draws the moment the page is showing, so a pass an hour from now can be watched through the phone before it happens.

### 4.23 The sky screen *(v1.3; renamed and widened v1.3.1)*

The owner, on the released v1.2 build: following is a full-screen act.
The reader is outside, holding the phone up with both hands, and everything on the live page that is not the picture — the header, the three-way view control, the hint, the status strip, the toggles — is in the way and cannot be used with the phone held like that.
And the picture is wider than it is tall: a phone held sideways gives the 60° field (FR-WIN-1) the most pixels across, where the sky is.
So the window opens a screen of its own rather than a view laid out in the page, the screen is the drawing and one way out, and it is for a phone held sideways.

*(v1.3.1, on the R64 build)* V13-4 kept the wrong half of "two ways into one picture".
The screen is the thing; `[ follow phone ]` was only a door, and a second door beside the view control's own.
So the control goes, the window is a view again — on the live page as well as the pass detail — and the tap that chooses it is the tap that asks for the permission and opens the screen.
With no control called follow left, what was the follow screen is the **sky screen**: the same layer, opened from either page, drawing the moment its page is showing.

*(v1.4.1, on the v1.4 build)* V13-2 read "for a phone held sideways" as a condition to be enforced, and wrote a gate.
The gate is not enforceable: the reader's rotation lock is theirs, it is common on a phone that is carried in a pocket and looked at outdoors, and under it the screen was a sentence the reader could not get past.
What was right in V13-2 was the *preference* — sideways gives the field the most pixels where the sky is — and a preference is said once, over a picture that is already drawn.
So FR-FSC-4 draws in both orientations, FR-FSC-11 gives the advice, and FR-FSC-10 makes the preference true even where the browser will not turn: the screen turns itself, from the pose the sensor is already reporting for the drawing.

- **FR-FSC-1** Choosing "window" from the chart view control (FR-WIN-4, FR-WIN-5, FR-FSC-6) opens the **sky screen**: a layer that covers the whole visual viewport — no page padding, no header, nothing of the page beneath it reachable — and holds exactly four things: the sky window drawing (FR-WIN-1..3, FR-FOL-4, FR-FOL-5) filling the viewport; the close control; the facing readout; and the legend.
  Nothing else of the page it was opened from is on it: on the live page, not the view control, the hint, the status strip, the hidden-objects toggle, the share action, the stripe block, the playback row or the stepping row; on the pass detail, not the sheet's heading, its countdown, its numbers, its moon lines or its share action.
  The screen is the same at every viewport where the window is offered (FR-WIN-4's presence test); it does not change with FR-DESK-1's breakpoint.
  *(amended v1.3.1, V13-6, V13-9)* The way in was `[ follow phone ]`, on the live page alone; it is the view control now, and the same screen opens from both pages.
  *(amended v2.0, V20-9)* The four things are the drawing, the `×`, the readout and the compass gutter sideways (FR-GUT-1); upright the screen is FR-GUT-7's five rows.
  *(amended v2.4, V24-1)* The screen has two **inventories**: the *passes* inventory, which is everything above, and the *stars* inventory, opened from `#stars` by `[ hold up to the sky ]` (FR-STAR-5), which holds the same four things with the drawing's content FR-STAR-6's and no pass on it; the gutter keeps its band and bracket and has no tick and no chip there.
  *(amended v2.5, V25-4)* Both inventories draw one scene: the passes inventory carries the stars layer when `[ stars ]` is on (FR-SKY-3), the stars inventory carries the passes when `[ passes ]` is on (FR-SKY-6), and with both on they are the same screen.
  *(withdrawn v2.9, V29-1)* The sky screen is retired; the page's own window follows the phone instead (FR-GYRO-2, FR-GYRO-6).
  FR-FSC-2..11 go with it, except FR-FSC-10's upright rule, which the following window keeps.
- **FR-FSC-2** The close control is the character `×` alone — the one icon in the app, the owner's ask, so it is not bracketed the way the app's text controls are — in the top-right corner of the screen, with a hit area of at least 44 × 44 CSS px (G6) and the accessible name "Close" ("Cerrar").
  Activating it, or pressing `Esc` where there is a keyboard, closes the screen.
  Closing returns the page exactly as it was, with the view that was showing when the window was chosen — the window is never what is saved (FR-WIN-5 as amended v1.3.1) — and the sensor released.
  Leaving the page by any route closes the screen too.
  The screen is not a route and not a history entry: the browser's back button leaves the live page, or the pass detail sheet, as it does today (OQ-22).
  *(amended v1.3.1, V13-6, V13-7)* The `×` was the second press of a control that no longer exists, so it is now the only way out; and what comes back comes back at the instant it was at, not at real time (FR-FSC-8).
- **FR-FSC-3** The facing readout is the window's own (FR-GUIDE-4's window form, "Looking N (1°) · up 20°", with its true-north line under it, US-21 AC6) and stands in the top-left corner over the drawing.
  The legend (§4.17) is a strip along the bottom edge over the drawing: one FR-LEG-3 row per drawn pass, at most two rows high, scrolling inside past that, FR-LEG-4's highlight on a tap.
  Both overlays are drawn on the theme's surface colour at 85 % opacity (`SCREEN_OVERLAY_ALPHA`, a token; enough for FR-THEME-2's contrast on the text and for the horizon under it to stay readable) and neither is drawn where the whole box is the ground panel (FR-FOL-5's second step), where the note is all there is.
  The strip covers the lowest part of the field — with the phone held up 20° that is ground (OQ-23).
  *(amended v1.3.1, V13-6: the constant was `FOLLOW_OVERLAY_ALPHA`; the rule is unchanged.)* *(amended v2.0, V20-9)* The legend strip along the bottom edge is withdrawn sideways: the gutter stands there (FR-GUT-1..6) on the same surface; upright the legend is two rows under the band (FR-GUT-7).
  The readout and its surface are unchanged.
- **FR-FSC-4** The sky screen is for a phone held sideways, and it draws whatever the viewport is doing.
  *(rewritten v1.4.1, V14-9; the v1.3 rule it replaces is at the end of this requirement.)* The window is drawn in both orientations and nothing on the screen is gated on `(orientation: landscape)`: the drawing, the facing readout (FR-FSC-3), the legend and the `×` are there upright and sideways alike.
  Held sideways the reader gets the wide picture — by the browser's own reflow where the device rotates, and by FR-FSC-10's turn where it does not.
  Held upright the picture is drawn in the portrait box, `WINDOW_FOV` across its shorter side as FR-WIN-1 has always had it, with FR-FSC-11's line of advice over it.
  The app does not lock the orientation and does not ask the reader to unlock theirs: the lock needs full screen on Android, does not exist on iOS Safari, and the rotation lock is the reader's setting, not a fault to be corrected.
  The sensor keeps running across every turn, so no permission is asked twice (FR-FOL-2).
  The two-line strip that FR-WIN-6 keeps on the live page's window is not on the sky screen; its declination is the readout's line.
  *(withdrawn v1.4.1, V14-9)* The v1.3 rule was a gate: the window drawn only while the viewport was landscape (`(orientation: landscape)`: wider than tall), and in portrait a one-line `role="status"` note — "Turn the phone sideways to follow the sky." / "Gira el teléfono de lado para seguir el cielo." — with the close control in the drawing's place and no readout and no legend, the same note on the screen opened from a pass detail *(v1.3.1, V13-9)*.
  A viewport whose rotation is locked never becomes landscape, so on those phones the note was the whole screen and there was nothing behind it: the one thing the reader could do about it was change a system setting the app had no business asking for.
  *(amended v2.5, V25-9)* While a pass is in the scene the readout's second line is the landmark line (FR-SKY-11); the declination is the line when no pass is, and a tap's name takes the line while it holds (FR-STAR-7).
- **FR-FSC-5** Hidden objects (FR-LIVE-6) are never drawn on the sky screen, whatever the toggle's saved state: the screen is for what can be seen now.
  The toggle and the dimmed marks stay on the default live view as they are.
- **FR-FSC-6** *(rewritten v1.3.1, V13-6, V13-9; this replaces the v1.3 rule below)* The chart view control offers the dome, the polar chart and — where FR-WIN-4's presence test passes *(amended v2.5, V25-1: everywhere, FR-SKY-2)* — the window, on the live page and on the pass detail alike, three options on one row within FR-COMP-4 *(amended v2.5, V25-17: on the wide live page that row is the control alone, the status slot in the box's corner, FR-SKY-2; on a compact column too narrow for the three, as the landscape phone's 740 × 360, the control sets its options with no gap between them and may wrap to two lines inside its 48 px tap row, which does not grow)*.
  The tap that chooses the window is where the permission is asked and is what opens the screen; a denial, or a device that gives a relative heading only, leaves the view as it was and shows FR-LIVE-8's one-line note beside the control (FR-FOL-2).
  The live page carries no `[ follow phone ]` control: it is removed with its label, its pressed state and its notes, and the actions row is the hidden-objects toggle and the share action.
  *(withdrawn v1.3.1)* The v1.3 rule was the opposite — the live page's view control offering the dome and the polar chart only, the follow control the one way in there, `[ point at the sky ]` never shown, and a saved `window` drawn as the dome; with the window no longer a saved view at all (FR-WIN-5 as amended) there is nothing left for a page to draw as something else.
- **FR-FSC-7** Captures (FR-COMP-6's rule for the phase): the sky screen at 844 × 390 (a phone held sideways) in both languages and both themes for the sky, ground and buried states, and the portrait note at 390 × 844 in both languages; the same screen opened from a pass detail at 844 × 390, in both themes and both languages, where the drawing is one whole arc (FR-DOME-5) rather than the live page's set; and the compact live page with its three-option view control.
  The D-179 capture set carries them in place of the v1.2 `following` captures and the v1.3 `follow-screen-*` ones, which showed a screen reached by a control the app no longer has.
  The pass detail's `window` captures move with the screen: they are that screen at 844 rather than a window laid out in the sheet at 390 and 1280, and its `ground` and `buried` states leave the set, being the two states the live page's screen already carries.
  *(amended v1.4.1, V14-9, V14-10)* The `portrait` shots are not of a note any more: at 390 × 844 the screen draws, and the shot is the picture with FR-FSC-11's line over it, in both languages and both themes.
  One shot is added for the turn — a 390 × 844 viewport with the pose of a phone held sideways, where the layer is turned and the picture is landscape inside a portrait viewport (FR-FSC-10) — in one language and one theme, the turn being a geometry and not a piece of copy.
  *(amended v2.0, V20-9)* The sky screen's captures are re-shot with the gutter and the portrait band (FR-GUT-8).
- **FR-FSC-8** *(v1.3.1, V13-7)* The screen shows its page's instant.
  Opening the screen does not change the shown instant `t`, and neither does closing it.
  On the live page the screen draws whatever the page was showing — real time, or the instant the stripe, the step controls or playback have taken it to — and while it is up time keeps running at the page's playback speed, so a pass an hour away is watched through the phone by scrubbing to it and pressing play *before* opening the screen.
  The stripe block and the playback row are not on the screen (FR-FSC-1) and come back on close at the instant playback has reached.
  On the pass detail the instant is that page's own, unchanged.
  This withdraws the "now" mode of FR-FOL-3 and FR-WIN-6: nothing about entering or leaving the window moves `t` any more, and the readiness of the picture is the reader's to choose on the page.
- **FR-FSC-9** *(v1.3.1, V13-9)* Nothing scrolls.
  The layer is the visual viewport and no taller (`100dvh`), and it never scrolls: what it holds is the drawing and the two overlays, and the only thing that scrolls inside it is the legend strip, inside itself (FR-FSC-3).
  Nothing behind it scrolls while it is up either — the live page never scrolls anyway (FR-LIVE-1), and the pass detail's sheet, which does, is held still and has its scroll position back when the screen closes.
  A drag past the edge of the drawing does not move the document under the layer.
- **FR-FSC-10** *(v1.4.1, V14-10)* The screen is upright to the reader, not to the viewport.
  Which way is up on the sky screen is read from the pose the orientation sensor reports — where the room's vertical lies in the phone's own frame — and not from `(orientation: …)` or from `screen.orientation.angle`.
  Where the two agree, which is any phone whose rotation is not locked, nothing happens and the screen is laid out as the viewport is.
  Where they disagree — a rotation-locked phone held sideways, or a phone locked to landscape and held upright — the screen turns its own layer by the quarter turn that puts the room's up at the top of the picture: the drawing, the readout, the legend and the `×` turn together as one layer, the layer takes the viewport's two sides swapped so it still covers the screen exactly and still never scrolls (FR-FSC-9), and the window's projection is composed with the same quarter turn, so the horizon is level to the reader's eye and east is on the reader's right in every pose.
  The turn changes the frame the picture is drawn in and nothing about the geometry: the field, the arcs, the markers and the smoothness of US-21 AC3 are what they were.
  - **It does not flutter.**
    The turn is one of four quarters and changes only once the pose is past the diagonal by `SCREEN_TURN_HYSTERESIS_DEG` (default 20°, so 65° from the quarter it is leaving), which is what keeps a phone held at an angle from flipping back and forth.
  - **It does not spin at the zenith.**
    Within `SCREEN_TURN_FLAT_DEG` (default 25°) of flat, face up or face down, the room's vertical has no direction worth reading in the plane of the screen, so the turn is held rather than recomputed.
    Holding the phone up at a pass near the zenith is exactly that pose, and the reader keeps the picture they had.
  - **It starts at none.**
    Before the first reading, and on a device that gives no reading at all, the turn is none and the screen is laid out as the viewport is.
    A denial never reaches the screen: FR-FOL-2 leaves the view where it was.
  - **It is not a control.**
    There is no toggle for it, it is not remembered anywhere (FR-WIN-5), and closing the screen leaves nothing behind.
- **FR-FSC-11** *(v1.4.1, V14-9)* The advice, in the place the screen keeps its notes.
  While the picture the reader is looking at is taller than it is wide — the phone upright, however the viewport and FR-FSC-10 got it there — one `role="status"` line stands over the drawing, in both languages: "Turn the phone sideways to see more sky." / "Gira el teléfono de lado para ver más cielo." It says what a sideways phone buys, which is the 60° field across the wide side of the screen; it is not a condition, and everything the screen does works without it being taken.
  It is not modal, carries no dismiss control, and goes on the turn with no tap.
  FR-FOL-5's ground notes take precedence: pointed below the horizon, the ground note is the line that is shown and the advice waits, so the screen never stacks two pieces of advice on one picture.
  *(amended v2.0, V20-9)* The `role="status"` line is withdrawn: upright, the advice is secondary copy on the countdown's peak line (FR-GUT-7), and the only notes over the drawing are FR-FOL-5's and FR-GUT-6's chip.

### Phase 2d — v1.3 ("the sky screen", as decided 2026-09-08, V13-5; widened 2026-09-08, V13-6..V13-10)

After the `v1.2.0` tag.
Still no backend; the same two providers.
One item and nothing else — what is found on the way is written down as a finding for a later phase.

- The follow control opens a screen of its own: the window drawing over the whole viewport, a `×` to close, the facing readout and the legend as overlays; drawn only with the phone held sideways, with a note in portrait; hidden objects never on it; the window gone from the live page's view control (§4.23).
- *(v1.3.1, after the owner's run of R64 on a phone)* The screen is the **sky screen** and the view control is the way in, on the live page and on the pass detail alike; `[ follow phone ]` is removed; the screen shows the instant its page is showing instead of returning it to real time; the window is a mode and not a saved view, so `[ point at the sky ]` goes; the screen and what is under it never scroll; and F-63 — the drawing over the status strip on a landscape phone — is closed.

Definition of done:
- US-21 AC11..AC14 accepted; FR-FSC-1..9 met; the amended FR-COMP-5, FR-FOL-1..3, FR-LIVE-6, FR-LIVE-7, FR-LIVE-8, FR-WIN-4, FR-WIN-5, FR-WIN-6 and FR-LEG-2 met; F-63 closed by a change with a test that fails on the old code (FR-FIX-1).
- The v1, v1.1 and v1.2 definitions of done still hold: the golden tests, the FR-GUIDE-6 and FR-LIVE-5 rates on the reference device, the D-179 capture set re-shot on `main` with the sky screen's captures in place of the `following` and `follow-screen` ones (FR-FSC-7), and the bundle budgets re-set by the D-178 rule.
- The owner has run the sky screen on a phone, sideways and upright, from the live page and from a pass detail, and has watched a pass in the future through it: the sensor path, the turn and the moving instant cannot be verified headlessly, so V11-9's rule governs this change as it did v1.2's.
- `package.json` version 1.3.0, a `v1.3.0` tag, and the release checklist run on the deploy.
