## 11. v1.4 (spec §9 Phase 2f)

> *History (marked 2026-09-25, FR-SHOW-1): the v1.4 release's list as it was run. What is current is §1–§5, §10 and the last section.*

Everything above still applies, §1 to §5 included. v1.4 is three items — the shape rules,
the stripe's span and the legend's place — and two of the three are things a headless run
cannot judge: whether four hours is the right chunk to page through, and whether a window
dragged short is a page you would use. So the phase's owner run is a phone and a window,
and it ends in decisions rather than only in ticks (§11.3).

*(v1.4.1, V14-9..V14-11)* A fourth item joined the phase after R71 and before this task:
the sky screen no longer waits for the phone to be turned (R73). It is the most
hand-and-sensor change of the four — the turn is read from the pose, and a wrong sign
looks right in every test and is upside down in the hand — so it has its own run at §11.3a,
and it is the reason this release is taken on a build that carries it rather than on the
one R71 left.

### 11.1 The stripe and the list on a real phone (FR-SPAN-1..7, FR-LEG-6..8, US-24, US-25)

On the phone already used for §7.1 and §9.1, outdoors, on the live page.

- [ ] The stripe draws four hours and not the night: the labels are half-hours or hours
      inside the chunk, and a drag moves the shown instant by seconds per pixel rather
      than minutes (FR-SPAN-1, US-24 AC1). This is the item the phase exists for — if a
      drag still feels like aiming at a pixel, say so in the PR.
- [ ] The overview row above it carries the whole 24 h with a bracket around the four
      hours drawn below: a tap on the far end of it moves the shown instant there, and the
      chunk under it follows on its own (FR-SPAN-2, US-24 AC2, AC6).
- [ ] `[ ◀ 4h ]` and `[ 4h ▶ ]` page the chunk; `[ pass ▶| ]` lands the shown instant on
      the next pass's rise in **one** tap and `[ |◀ pass ]` on the previous one; `[ −1m ]`
      and `[ +1m ]` are the fine step (FR-SPAN-3, FR-SPAN-4, US-24 AC3..AC5). Count the
      taps it takes to get from the page as opened to a pass's rise: the ceiling is three
      and one should do it.
- [ ] Press play at 600×, then 3600×: the stripe shows the whole span again rather than
      re-labelling a chunk every four seconds, and pausing or dropping to 60× gives the
      chunk back (FR-SPAN-6, V14-8). **This is OQ-25**: if jumping chunk to chunk at speed
      would read better than the fallback, that is the answer to record.
- [ ] `[ list (n) ]` is in the actions row with a count on it; a tap opens a panel of
      exactly two rows under the drawing and the box gives up 96 px for it; a second tap
      closes it and the box takes them back (FR-LEG-7). With the panel open, watch a pass
      rise or end: the panel's height does not change and the drawing does not move — the
      invariant the whole control is for (F-62, V14-5).
- [ ] The count is the passes: with nothing up it reads `list (0)` and the open panel is
      one line, and the Sun and Moon rows are in the panel without being counted (V14-12).
- [ ] Leave the list open, close the browser, reopen the live page: it opens open, and
      opens closed after it was closed (`prefs.liveLegendOpen`, FR-LEG-7).
- [ ] Turn the phone sideways: the stripe, the stepping row and the list control are all
      still reachable and nothing lies over anything (FR-SHP-1, US-25 AC1).
- [ ] Nothing on the page scrolls, in either orientation, with the list open or closed
      (FR-LIVE-1, US-25 AC2).

### 11.2 A desktop window of any shape (FR-SHP-1..4, F-65, US-25)

On a desktop browser, with the window dragged by hand rather than set by device mode —
F-65 was found in Chrome's responsive frame and lived for four phases because every test
of the landscape rules ran at a phone's width.

- [ ] Drag the window short at a desktop width — about 1200 × 450, and again with the
      inspector docked at the bottom of a full-screen window: the page keeps the desktop
      layout with a smaller box, the drawing has a height, nothing scrolls, and the facing
      readout is not set one character per line (F-65, FR-SHP-3, US-25 AC2, AC3).
- [ ] Tile the window to half a monitor and step it narrower until the compact layout
      takes over: at the narrowest wide width the rail is still beside the box (FR-LEG-6,
      V14-4), and the switch to compact happens once, without a size at which the page is
      neither (FR-SHP-1).
- [ ] Resize slowly across a boundary in each direction: the dome is redrawn at the size
      it is at, not at the size it was (F-60, FR-DOME-1).

### 11.3a The sky screen on a phone that will not turn (FR-FSC-4, FR-FSC-10, FR-FSC-11, US-21 AC12, AC15)

On the same phone as §11.1, outdoors, with the sky screen open from the live page's view
control. Do it twice: once with the phone's rotation **locked**, which is the case the
change exists for, and once unlocked.

- [ ] Rotation locked, phone held sideways: the picture is the wide one, and the readout,
      the legend and the `×` are all the right way up to the eye — not a note, and not a
      picture lying on its side (FR-FSC-10, US-21 AC15). The sign of the turn is the thing
      to look at: a wrong one is upside down, not subtly off.
- [ ] Rotation locked, phone upright: the picture is drawn in the tall box with one line of
      advice over it, readable and clear of the legend strip, and nothing waits for a turn
      (FR-FSC-4, FR-FSC-11, US-21 AC12).
- [ ] Rotation unlocked, turned by hand from upright to sideways and back: the picture
      follows, once per turn, with no second permission prompt and no flip back and forth
      at the angle in between (FR-FSC-10's hysteresis, FR-FOL-2).
- [ ] Raise the phone to a pass near the zenith, flat: the picture holds the turn it had
      and does not spin, in either rotation setting (FR-FSC-10's flat hold).
- [ ] Point it at the ground: the ground note is the line that shows, the advice waits, and
      neither is behind the legend (FR-FOL-5, FR-FSC-11).

### 11.3 What the owner decides on this release

The phase leaves three sentences that are the owner's and not a task's. Each one is
recorded where it belongs — a Decision Log row, or the register — before the tag.

- [ ] **F-62 at 390 × 667.** The compact box is 198 px there against FR-COMP-5's floor of
      374, and R71 measured that no furniture is left to cut: the rows the page must draw
      under the box need more than the 293 px that height leaves over a 374 px box. So
      FR-LEG-8's "MUST hold at 390 × 667" cannot hold as written, and the choice is the
      owner's — the floor is not a rule at that height, or a row on the page at that
      height goes. Either way it is a Decision Log row and an amended FR-LEG-8, and F-62's
      register row closes on it (spec §4.20).
- [ ] **OQ-24, the chunk's length.** Four hours shipped. After §11.1, either it stays and
      the question closes, or `STRIPE_CHUNK_H` moves.
- [ ] **OQ-25, the whole-span fallback at speed.** See §11.1's playback item.

### 11.4 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `1.4.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R67..R72).
- [ ] The `captures.yml` run on the merge commit is green: 124 files, no missing capture.
- [ ] Tag it: `git tag -a v1.4.0 -m "v1.4: the shape, the chunk and the list" && git push origin v1.4.0`
      — on the release commit's SHA, not on whatever `main` has reached by then.
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production.
- [ ] Record in the release PR: the bundle table, the §3, §6.1 and §11.1 device numbers,
      the §4 Heavens-Above comparison with the observer and both element epochs, and the
      date.
