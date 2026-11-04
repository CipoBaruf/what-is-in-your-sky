## 7. v1.1 (spec §9 Phase 2b)

> *History (marked 2026-09-25, FR-SHOW-1): the v1.1 release's list as it was run. What is current is §1–§5, §10 and the last section.*

Everything above still applies, §3 and §4 included: the dome's drag rate and the
Heavens-Above comparison are re-run on the release build, not inherited from v1. These are
the checks the v1.1 surface added. Two devices this time — v1.1's headline feature is a
sensor one, and the R38 spike ran on an iPhone only (`docs/window/FINDINGS.md`), so Android
Chrome is checked here for the first time.

### 7.1 The sky window on a real phone (FR-WIN-1..6, US-21)

Once on an iPhone (Safari) and once on an Android phone (Chrome), outdoors, with a known
bright object in the sky to aim at — the Moon does the job.

- [ ] The view toggle offers "Window" on both phones and nowhere on a desktop browser
      (FR-WIN-4). Choosing it asks for motion access in that tap, never on load; on iOS the
      permission sheet appears, and refusing leaves the dome with a one-line note.
- [ ] Point the phone at the Moon: the Moon glyph in the window is where the Moon is, within
      a few degrees. Then check the correction is real — the strip reads
      "true north, declination ±x.x°" and the figure matches the WMM value for the place
      (FR-WIN-3, F-41).
- [ ] Sweep past the zenith and roll the phone: the view stays continuous, with no flip and
      no spin at the top (FR-WIN-3's "one rotation").
- [ ] Rotate the screen to landscape and back: the window follows the screen's orientation
      rather than turning ninety degrees (D-175's assumption, measured on iOS in the spike
      and here on Android for the first time).
- [ ] The rate, by the §3 method with the window's own target: connect through
      `chrome://inspect` (Android) or Safari's Web Inspector (iOS), paste the snippet below,
      and turn on the spot for the five seconds it runs.

  ```js
  (() => {
    const svg = document.querySelector('[data-look-az]');
    let updates = 0, frames = 0, last = 0, longest = 0;
    new MutationObserver(() => { updates++; }).observe(svg, { attributes: true, attributeFilter: ['data-look-az', 'data-look-alt'] });
    const t0 = performance.now();
    const tick = (t) => {
      if (last) longest = Math.max(longest, t - last);
      last = t; frames++;
      if (t - t0 < 5000) requestAnimationFrame(tick);
      else console.log(`${(updates / ((t - t0) / 1000)).toFixed(1)} updates/s over ${frames} frames, longest frame ${longest.toFixed(0)} ms`);
    };
    requestAnimationFrame(tick);
  })();
  ```

  Expect ≥ 30 updates/s and a longest frame under 66 ms (FR-WIN-3). The worker is never
  called for the view, so a shortfall is the projection or the smoothing, not the physics.
- [ ] On the live page, entering the window returns the shown instant to real time and hides
      the stripe block and the playback row; leaving it restores them, with the instant still
      on real time (FR-WIN-6). The two-line status strip stays in both.
- [ ] Leave the window as the saved view, kill the app and open it again: the chart area
      shows one `[ point at the sky ]` control until it is tapped (FR-WIN-5).

### 7.2 The rates on the v1.1 pages (FR-GUIDE-6, FR-LIVE-5)

The dome now draws several arcs with FR-TRAJ-1 states and a legend beside them, so §3 and
§6.1 are measured again rather than carried over.

- [ ] §3's snippet on the pass detail's dome, dragging: ≥ 30 rasterisations/s, longest frame
      under 66 ms (FR-GUIDE-6).
- [ ] §6.1's playback measurement on the live page at 3600× with the hidden objects shown —
      the heaviest thing the page draws: ≥ 30 rasterisations/s, longest frame under 66 ms
      (FR-LIVE-5).
- [ ] The stripe's stepping control lands the instant within a minute of a pass's rise in at
      most three taps (FR-TRAJ-5, US-22 AC6).

### 7.3 The compact screens (FR-COMP-1..5, FR-LEG-2..4)

- [ ] On the phone, in both languages: the header is one row, the home screen's location
      summary opens the settings page, and every control row fits without wrapping
      (FR-COMP-4's 36 cells). `controlRows.test.ts` checks this in the suite; this is the
      look of it on a real screen at the phone's own font size.
- [ ] The settings page: each control writes what it wrote on the home screen before, the
      install offer is there whenever the browser has one, and `Esc`, `[ ← Back ]` and the
      browser's back all return to the home screen with the list still settled.
- [ ] The legend under a chart: tapping a row highlights its arc and dims the others, the
      key on the row is the key on the drawing, and a row can be reached by keyboard on a
      desktop without the list jumping (FR-LEG-4, F-53).

### 7.4 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `1.1.0` on `main` and every task of the phase is checked off in
      `TASKS.md`.
- [ ] The `captures.yml` run on the merge commit is green: 92 files, no missing capture.
- [ ] Tag it: `git tag -a v1.1.0 -m "v1.1: the phone pass" && git push origin v1.1.0`.
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production.
- [ ] Record in the release PR: the bundle table, the §3, §6.1, §7.1 and §7.2 device numbers
      with the two phones named, the §4 Heavens-Above comparison with the observer and both
      element epochs, and the date.
