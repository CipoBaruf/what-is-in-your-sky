## 8. v1.2 (spec §9 Phase 2c)

> *History (marked 2026-09-25, FR-SHOW-1): the v1.2 release's list as it was run. What is current is §1–§5, §10 and the last section.*

Everything above still applies, §3 and §4 included. v1.2 closed six findings rather than
adding a screen, so most of what changed is behind existing checks (the bundle table above,
the capture set, the golden fixtures); the one thing that cannot be checked headlessly is the
follow control, which is a sensor feature like the sky window in §7.1.

### 8.1 Follow and the ground state on a real phone (FR-FOL-1..5, US-21 AC8..10)

On the phone already used for §7.1, outdoors, with the sky window already working there.

- [ ] Open the live page, choose the dome or the polar view, and press `[ follow phone ]`:
      the chart switches to the window showing the sky the phone points at, within the same
      tap that asked for motion access if it had not been granted yet (FR-FOL-1).
- [ ] Press it again: the view returns to the one it came from (dome or polar), not to
      whatever the toggle happens to save (FR-FOL-2).
- [ ] Point the phone down at the ground, past the horizon: past about 10° below it the sky
      above the hatch keeps drawing and a line reads "Pointing at the ground — raise the
      phone."; past about 60° below it the box is the hatched panel alone, with "You are
      pointing at the ground — raise the phone." (FR-FOL-5).
- [ ] Turn the phone off the sky and back: the note clears the moment the field has sky in it
      again, with no stale arc left drawn under the hatch.

### 8.2 The wide dome, one more time (FR-DOME-1 as amended v1.2.1, F-59..F-61)

A quick look rather than a measurement — `dome-fit.spec.ts`, `dome-resize.spec.ts` and
`live-rail.spec.ts` are what actually measure this — but a screen is worth confirming by eye
before the tag.

- [ ] On a desktop browser, open the live page at a wide window and resize it through a few
      sizes (about 1280, 1920 and whatever the monitor's full width is): the whole bowl stays
      visible at every size, its outline included at the top, the rows stand in a rail beside
      it once the window is wide enough, and nothing is cut or clipped mid-resize.

### 8.3 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `1.2.0` on `main` and every task of the phase is checked off in
      `TASKS.md`.
- [ ] The `captures.yml` run on the merge commit is green: 128 files, no missing capture.
- [ ] Tag it: `git tag -a v1.2.0 -m "v1.2: follow and the fixes" && git push origin v1.2.0`.
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production.
- [ ] Record in the release PR: the bundle table, the §3, §6.1 and §8.1 device numbers, the
      §4 Heavens-Above comparison with the observer and both element epochs, and the date.
