## 9. v1.3 (spec §9 Phase 2d)

> *History (marked 2026-09-25, FR-SHOW-1): the v1.3 release's list as it was run. What is current is §1–§5, §10 and the last section.*

Everything above still applies, §3 and §4 included. v1.3 is one item — the sky screen — and
v1.3.1 changed the way into it after the owner's phone run, so the checks that matter here are
a phone's: the view control is the door, the screen keeps the instant the page was showing, and
what is under it never scrolls. §8.1's follow control no longer exists; its checks are replaced
by §9.1 below.

### 9.1 The sky screen on a real phone (FR-FSC-1..9, US-21 AC11..AC14)

On the phone already used for §7.1, outdoors, with motion access already granted there.

- [ ] Open the live page and choose "window" from the view control: the screen opens over the
      whole viewport — the drawing, the `×`, the facing readout, the legend, and nothing of the
      page under it (FR-FSC-1, FR-FSC-6). The permission, if it is asked, is asked inside that
      tap.
- [ ] Press the `×`: the page comes back on the view it had, dome or polar, with the stripe and
      the playback row where they were. Reopen it and press the phone's back button, if it has
      one, then Escape on a keyboard if one is to hand: each closes the screen (OQ-22).
- [ ] Hold the phone upright: the note asks for the phone to be turned, with the `×` and nothing
      else — no drawing, no readout, no legend. Turn it sideways again: the drawing is back with
      no second permission prompt (FR-FSC-4).
- [ ] Scrub the stripe to a pass an hour away, press play at 60×, then open the screen: it draws
      that instant and keeps running at that speed, and closing it gives the page back at the
      instant playback has reached, not at real time (FR-FSC-8). This is the check the phase is
      about; a pass in the future watched through the phone is US-21 AC14.
- [ ] Drag past the edge of the drawing, upward and downward: nothing scrolls, on the screen or
      behind it (FR-FSC-9).
- [ ] Open a pass from the guide and choose "window" from the same control on the pass detail:
      the same screen, aimed at that pass, over a sheet that does not scroll under it; the `×`
      gives the sheet back where it was (FR-FSC-6, FR-FSC-9).
- [ ] Turn the phone sideways on the live page itself, without opening the screen: the drawing
      stays inside its own pane and never lies over the status strip or the stripe beside it
      (F-63, FR-COMP-5 as amended).

### 9.2 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `1.3.0` on `main` and every task of the phase is checked off in
      `TASKS.md`.
- [ ] The `captures.yml` run on the merge commit is green: 116 files, no missing capture.
- [ ] Tag it: `git tag -a v1.3.0 -m "v1.3: the sky screen" && git push origin v1.3.0` — on the
      release commit's SHA, not on whatever `main` has reached by then.
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production.
- [ ] Record in the release PR: the bundle table, the §3, §6.1 and §9.1 device numbers, the
      §4 Heavens-Above comparison with the observer and both element epochs, and the date.
