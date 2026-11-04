# v1.2 — SPEC.md sections

Cut from `SPEC.md` by `scripts/sdd/split.ts` (FR-SDD-3); ids resolve through `docs/sdd/ids.md`.

### 2.5 Goals (v1.2, "follow and the fixes")

- **G15. Following is a picture that can be read.**
  Holding the phone up shows the sky the phone points at, not a bowl that turns with it; pointing the phone at the ground says so instead of showing nothing.
- **G16. The live page keeps what it drew.**
  A click on the stripe, a scrub or a reload never empties the sky, and no row of the page sits on top of another at any size the app supports.

### 4.22 Follow opens the window *(v1.2)*

On a phone the dome answers "which way do I turn?" badly: moving the phone around your head turns a tilted bowl, and the two motions do not map onto each other.
The window (§4.18) already draws the sky the phone points at, from the same geometry, so the follow control opens it rather than driving the dome.

*(v1.3.1, V13-6, V13-7)* The control is gone; the picture it opened is not.
FR-FOL-1 and FR-FOL-2 are withdrawn as a control and live on as the view control's rules (FR-FSC-6), and FR-FOL-3's "now" mode is withdrawn outright (FR-FSC-8).
FR-FOL-4 and FR-FOL-5 — the whole sky reachable, and pointing at the ground saying so — are the window's own behaviour and are unchanged; they are what the sky screen draws.

- **FR-FOL-1** The `[ follow phone ]` control on the live page opens the sky window.
  Pressing it switches the chart to the window and starts the orientation sensor; pressing it again returns the chart to the view that was showing when it was pressed, as does leaving the live page.
  The control is shown on the dome and on the polar chart wherever the window is offered (FR-WIN-4's presence test), and not on the window itself, where following is what the view is.
  It is absent on desktop.
  The view it opens is not saved (FR-WIN-5 as amended); the dome keeps its drag and stays the default view when nothing is following.
  *(amended v1.3, V13-1)* What the control opens is the follow screen (§4.23, FR-FSC-1) — the window as a layer over the whole viewport — not a view laid out in the page; the return, the presence test and the rest of this requirement are unchanged, and the screen's `×` (FR-FSC-2) is the second press, since the control itself is not on the screen.
  *(withdrawn v1.3.1, V13-6)* The control is removed from the live page.
  The way into the screen is the view control's "window" option (FR-FSC-6) and the way out is the `×`; the presence test, the permission in the tap and the "not saved" rule survive there (FR-WIN-4, FR-WIN-5 as amended v1.3.1).
- **FR-FOL-2** Permission is requested in the tap on the control, never on load (FR-WIN-4).
  A denial leaves the chart on the view it was on and shows FR-LIVE-8's one-line note; a device that gives a relative heading only shows its note and the view does not change.
  Neither state leaves the control pressed.
  *(amended v1.3.1, V13-6)* The tap is the view control's now, and the note stands beside it; neither answer changes the view, and neither opens the screen.
- **FR-FOL-3** Following is a "now" mode.
  Entering the window by the control does what FR-WIN-6 does by any other route: the shown instant returns to real time, the stripe block and the playback row are absent and the drawing takes the height they leave.
  Leaving follow brings them back, at real time.
  *(amended v1.3)* On the follow screen the stripe block and the playback row are not merely absent: nothing of the page is (FR-FSC-1); the instant rule is unchanged.
  *(withdrawn v1.3.1, V13-7)* Following is not a "now" mode.
  The screen shows the instant the page is showing and keeps it running at the page's speed, and closing gives the page back at the instant it has reached (FR-FSC-8) — the whole point being to watch a pass that has not happened yet.
- **FR-FOL-4** The whole sky is reachable.
  The window follows the phone round the horizon, past the zenith and behind the observer with no discontinuity and no reset (FR-WIN-3), and nothing is clipped to a region the reader can leave.
- **FR-FOL-5** Pointing at the ground says so, in two steps read from the altitude at the centre of the field:
  - **some sky still in the field** (centre below the horizon, and the top edge of the field above it): the part of the field below the horizon is hatched in the ground colour and a one-line note stands in the drawing — "pointing at the ground — raise the phone" — while everything above the horizon keeps drawing normally, arcs, markers, Sun and Moon;
  - **no sky left in the field** (the top edge of the field at or below the horizon): the box is the hatched ground panel, the note is its text, and nothing else is drawn.
  Both thresholds are derived from `WINDOW_FOV` and the box's aspect (FR-WIN-1), not new constants.
  Both notes are a `role="status"` line in both languages (FR-I18N-*), neither is modal, and raising the phone returns the picture with no tap.

### Phase 2c — v1.2 ("follow and the fixes", as decided 2026-09-07, V12-6)

After the `v1.1.0` tag.
Still no backend; the same two providers.
Four items and nothing else — what is found on the way is written down as a finding for a later phase.

- Follow opens the sky window, and pointing at the ground says so in two steps (§4.22).
- The dome's fit ceiling holds in every box: above 1920 px and at a device pixel ratio above 1 (FR-DOME-1 as amended, F-54).
- The compact live page's rows under the drawing stop overlapping, by the spacing under the stripe (FR-LIVE-7 as amended, F-55).
- The drawn pass set survives a click, a scrub and a reload (FR-LIVE-11, F-56).
- The dome covers at least 90 % of the width of its box on a wide page — the box cut to the drawing's shape from what the window leaves — with the rows beside it and the stripe under it (FR-LIVE-7 and FR-TRAJ-4 as amended v1.2.1, F-59); it is drawn at the right scale after a window resize (FR-DOME-1 as amended v1.2.1, F-60); and the whole bowl is drawn, its outline included, centred in its box (FR-DOME-1 as amended v1.2.1, F-61).

Definition of done:
- US-21 AC8..AC10 accepted; FR-FOL-1..5 and FR-LIVE-11 met; the amended FR-DOME-1, FR-LIVE-7, FR-LIVE-8, FR-WIN-4 and FR-WIN-5 met.
- F-54..F-56 and F-59..F-61 are each closed by a change with a test that fails on the old code (FR-FIX-1), and no other finding is opened silently.
- The v1 and v1.1 definitions of done still hold: the golden tests, the FR-GUIDE-6 and FR-LIVE-5 rates on the reference device, the D-179 capture set re-shot on `main` with the follow and ground states in it, and the bundle budgets re-set by the D-178 rule.
- The owner has run the follow view on a phone: the sensor path cannot be verified headlessly, so V11-9's rule for the spike governs this change too.
- `package.json` version 1.2.0, a `v1.2.0` tag, and the release checklist run on the deploy.
