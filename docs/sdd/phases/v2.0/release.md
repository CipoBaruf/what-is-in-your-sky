## 12. v2.0 (spec §9 Phase 2g)

> *History (marked 2026-09-25, FR-SHOW-1): the v2.0 release's list as it was run. What is current is §1–§5, §10 and the last section.*

Everything above still applies, §1 to §5 included. v2.0 is the redesign: the six areas
of the design phase's approved artboards, turned into five requirement families and
shipped over seven tasks. More of it than usual is a judgement a headless run cannot
make — whether a first visit that is three screens feels like three screens or like
being asked three questions, whether a bead a millimetre across reads as "this is now",
whether a compass band twenty-eight pixels tall tells you which way to turn. So this
run is longer than the last four, and it is mostly hand-and-eye.

The phone is the one already used for §7.1, §9.1 and §11.1, so the readings compare.
**Start from a clean browser** — a fresh profile or cleared site data — because §12.1
cannot be run twice on the same profile and the first run is the thing being checked.

### 12.1 The first visit, on a phone, from a clean browser (FR-FIRST-1..7, US-26)

Nothing saved, nothing granted. Do this one first and do not skip ahead to a place.

- [ ] The cold open carries no hero mark and no tagline: the header's 24 px mark, the
      title, and the where step — the question, the place field, the coordinates and the
      device button (FR-FIRST-1, FR-FIRST-2 as amended v2.0.2, US-26 AC1). It should look
      like a question, not like a front page with a form on it.
- [ ] Give it a place — the device button or a typed pair — and the app moves to the
      **when** step with a ✓ on where, not to a full home screen (FR-FIRST-4, US-26 AC2).
      Then `[ See what crosses ]` to **what**, and `[ edit ]` back to where with the group
      already open.
- [ ] Type a coordinate pair without leaving the field: the step does not move under you
      and the field keeps the caret (PLAN D-467, D-513). This is the one that is easy to
      get wrong and impossible to un-feel.
- [ ] Reload. The three steps are gone and the stacked home is there — the where reading
      collapsed to one line with `[ change ]` (FR-FIRST-6, US-26 AC3). A first visit is a
      first visit; the second is not.
- [ ] On the stacked home: tonight's stripe with a tick per pass, the conditions table
      (Dark, Clouds now, Moon, and Up now while something is up), the next-event block
      counting down on a clock, and the one-line cards with the `Next ISS` tag
      (FR-FIRST-8..10, US-26 AC4). The countdown is the first thing the eye lands on —
      if it is not, that is the finding.
- [ ] `[ change ]` opens the location form in place, without leaving the page
      (FR-FIRST-6, US-26 AC5), and closing it puts the line back.
- [ ] Every row of the three steps fits 36 characters in Spanish with nothing wrapped
      (FR-COMP-4, PLAN D-525). Switch the language and walk the steps again — from a
      second clean profile, since the first one is spent.

### 12.2 The live page one-handed, in both states (FR-WATCH-1..9, FR-MARK-5, US-27)

Outdoors, on the live page, phone held in one hand.

- [ ] The page opens **watching**: the bead runs beside `live`, and the stripe, the
      stepping row and the playback row are not on the screen at all (FR-WATCH-1 a,
      FR-WATCH-4, US-27 AC1). Count what the drawing got back.
- [ ] `[ scrub ]` holds the instant: the bead stops and turns warm, the word reads
      `held`, and the time row, the stripe, the step row and the playback row appear
      (FR-WATCH-1 b, US-27 AC2). `[ back to live ]` returns it and takes them away again.
- [ ] Press play at 60×, then 600×, then 3600×. **The bead stays still at every speed**
      and the pressed speed control is what says time is moving (FR-MARK-5, V20-28). If
      a still bead under a moving stripe reads as stuck rather than as held, that is the
      answer to record — it reopens the question rather than reverses this one.
- [ ] Thumb reach: `[ scrub ]`, `[ back to live ]` and the playback row are all reachable
      one-handed, and every control's tap box is a finger wide even where its row is one
      text row tall (US-27 AC3, PLAN D-246).
- [ ] Turn the phone sideways in **both** states: the scrub block goes to the rail and
      the dome column is the same width and height in both (FR-WATCH-5, US-27 AC4).
      Nothing lies over anything and nothing scrolls.
- [ ] Watch a pass rise, a chunk boundary go by and a tick land, in both states: no row's
      height changes and the box does not move (FR-WATCH-7, US-27 AC5).
- [ ] The view control is still where it was, in both states, and still opens the sky
      screen and the polar chart (V20-25, FR-FSC-6, US-27 AC6).

### 12.3 The sky screen, sideways and upright (FR-GUT-1..8, FR-FSC-*, US-28)

Same session, outdoors, with a pass actually up if one can be arranged.

- [ ] Sideways: the drawing fills the screen with the 28 px compass gutter along the
      bottom and nothing else over it — the band of azimuth, the bracket of the field, a
      tick per pass (FR-GUT-1..4, US-28 AC1, AC2). The strip the gutter replaced was 96;
      the drawing should be visibly taller than it was on 1.4.1.
- [ ] Turn until the field has no pass in it: one chip over the gutter names the next
      pass, how far to turn and when it rises, and the gutter shows it as a marker at the
      end to turn to (FR-GUT-6, US-28 AC3). Then turn the way it says and watch the
      marker come into the bracket. **This is the item the gutter exists for.**
- [ ] Point at the ground: the hatch fills it, the ground note is the only line over the
      drawing, and the chip is not there (FR-FOL-5, FR-GUT-6).
- [ ] Upright: five rows, top to bottom — the readout with the `×`, the next-event block
      with the advice to turn as secondary copy under its peak line, the band of sky, two
      legend rows, the gutter (FR-GUT-7, US-28 AC4). **The band is square**: as tall as it
      is wide, no more (V20-26). If square reads as a strip on this phone, say so.
- [ ] Nothing on the screen instructs you to turn the phone before it will draw: upright
      is a layout, not a gate (FR-FSC-4 as rewritten, US-28 AC5).
- [ ] With the phone's rotation locked, held sideways: the layer turns under you and the
      readout, the gutter and the `×` are the right way up to your eye (FR-FSC-10).
- [ ] The `×` gets you out from every one of those states (US-28 AC6).

### 12.4 The settings page in Spanish, without scrolling (FR-SET-1..4, US-29)

Still the phone. Switch the language first.

- [ ] `#settings` in Spanish at the phone's own height: **Location, then Saved places,
      then This browser** — and the whole page is on the screen with nothing scrolled
      (FR-SET-1, FR-SET-2, US-29 AC1, AC2). Spanish is the check because it is the longer
      language; if it fits here it fits.
- [ ] Two saved places: the one in use is marked, `[ use ]` switches and `[ × ]` removes,
      and none of the three actions leaves the page (FR-SET-3, US-29 AC3).
- [ ] The install offer and the clear action are under This browser, at the bottom, where
      a thumb does not find them by accident (FR-OFF-6 as amended).
- [ ] Both themes, once each. The page is `v1-settings-390-*` in the re-shot set if you
      want the picture beside the phone.

### 12.5 At a desk: the three panes, and a window dragged short

- [ ] A window at 1280 or wider, no place set: the three panes are there with Where
      active and When and What dimmed, so the layout is on the screen before a place is
      (FR-FIRST-2 as amended v2.0.2, US-26 AC6).
- [ ] With a place, open a pass: it takes the first two panes and the third keeps its
      reading (FR-FIRST-5).
- [ ] Drag the window short — around 1200 × 450 — and enter scrubbing: the block comes up
      as a **bar over the bottom of the drawing** and the box does not change height
      between the two states (FR-WATCH-6, FR-WATCH-7, US-27 AC5). This is the shape R78
      was for, and the one a headless test can prove but not judge.
- [ ] Drag it back tall: the block goes under the box again, and nothing is left over the
      drawing.

### 12.6 What the owner decides on this release

Three sentences that are the owner's and not a task's. Each is recorded where it belongs
— a Decision Log row, or the register — before the tag.

- [ ] **F-69: the main chunk is over its budget.** 158.0 KB gzipped against the 155 the
      script enforces, so every build prints a `::warning::`. The mark's measured share is
      5.2 KB of it and the redesign's own weight is the other 12.7; PLAN §11 says a mark
      that does not fit is a finding for the owner rather than a budget a task may raise,
      which is why the number was not moved. The choices, each a Decision Log row: raise
      the enforced budget towards the 170 KB ceiling §11 already reserves; split something
      out of the shell behind a `React.lazy` (the settings page is one route reached by
      one link); or shrink the mark — five tiers instead of six, or fewer than 60 bead
      frames. Doing nothing is also a choice, and it costs a permanent warning that the
      next real regression will hide inside.
- [ ] **F-62 at 390 × 667, again.** The watching state bought 131 px — the box is 329 px
      there where v1.4.1 measured 198 — and FR-COMP-5's floor is 374, so it is 45 px short
      rather than 176. Close enough that one more row would do it and no row is obviously
      the one to lose. Same choice as v1.4 left: the floor is not a rule at that height,
      or a row at that height goes (V20-25).
- [ ] **F-66 and F-70, the two captures that do not answer twice the same way.** F-66 did
      not reproduce on the 2.0.0 build — three shots of `polar at 390 px`, all four
      variants byte-identical — and F-70 is the same shape of thing turning up on
      `sky-screen-chip` at 844, about fifty pixels in a box of x 481–562, y 221–289. Both
      are drawing-lane code and neither is a product defect a reader would ever see; the
      cost is a release re-shoot that shows a file changed when nothing did. Whether a
      phase carries them or the register keeps them is the owner's call.

### 12.7 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.0.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R74..R82).
- [ ] The `captures.yml` run on the merge commit is green: **161 files**, no missing
      capture. It is 32 more than v1.4.1's 129, and every one of the 32 is
      `live-scrubbing`.
- [ ] Tag it: `git tag -a v2.0.0 -m "v2.0: the redesign" && git push origin v2.0.0`
      — **on the release commit's SHA, not on whatever `main` has reached by then**. A
      squash merge rewrites the commit, and `main`'s head an hour later is not the build
      any of this was run against.
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production. §2's manifest and icon checks matter more than usual: the
      favicons and the two PNG icons are new in this phase and are generated files.
- [ ] Record in the release PR: the bundle table with F-69's overrun named, the §3,
      §6.1, §11.1 and §12.2 device numbers, the §4 Heavens-Above comparison with the
      observer and both element epochs, and the date.
