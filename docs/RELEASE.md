# Release checklist

Run this once per deploy that changes the physics, the worker, the sky chart or the
headers, and once on each phase's deploy day (spec §9 definition of done). Every item
is a check with a stated expectation; note the result and the date in the PR that
ships the release. CI already gates the automated parts (typecheck, lint, unit and
golden tests, the worker in Chromium, the production build, Playwright under the
strict CSP): this list is what CI cannot see.

Sections 1–5 are every release. **Section 6 is the v1 list** (spec §9 Phase 2): the
checks the v1 surface added, plus the tag and the deploy, which are the owner's. Each
phase since has added a section of its own; **§12 is v2.0's** (spec §9 Phase 2g), and
its §12.1 has to be run from a clean browser before anything else in it.

## 1. Before merging

- [ ] CI is green on the branch, and the build log's bundle table (`npm run bundle:budget`)
      shows every budgeted chunk within its budget: main ≤ 155 KB, chart ≤ 105 KB,
      worker ≤ 40 KB, astronomy ≤ 25 KB, window ≤ 15 KB, live ≤ 10 KB and the service
      worker ≤ 10 KB gzipped (D-178 — the measured build plus a tenth, all of them inside
      the PLAN §11 ceilings). An overrun is a `::warning::` annotation; if one is accepted, the PR says
      so, and the fix is to re-measure and re-set the budgets rather than widen one.
- [ ] The capture set matches the app: `npm run build && npx playwright test v1-captures --project=chromium`
      re-shoots `docs/screenshots/v1-*.png` and `npm test` (`tests/docs/captures.test.ts`)
      says the set is complete. Look at the files that changed. The build is part of the
      command: the specs preview whatever `dist/` is there, and a preceding `npm run e2e`
      leaves one built with `VITE_MOON_LORE=on`, while `captures.yml` builds the flag off
      (D-179, FR-FLAG-1). A plain `npm run build` is the state the set is meant to show.
- [ ] The golden suite covers all three observers: `npx tsx scripts/validate-iss.ts --all`
      prints `OVERALL: PASS` for Neuquén, Paris and Singapore.
- [ ] The dome raster snapshot (`src/ui/components/guide/skychart/dome/__snapshots__/SkyDome.golden.txt`)
      was regenerated on purpose if it changed, and the change is explained in the PR.
- [ ] The branch preview (the per-branch URL `docs/DEPLOY.md` gives under *Domain*) opens,
      computes passes for a typed location, and DevTools shows no console error and no
      Content-Security-Policy violation while opening a pass, dragging the dome and
      toggling to the polar view.

## 2. The deployed site

Replace the host with the preview URL to check a branch.

- [ ] Headers, as in `README.md`:

  ```
  SITE=https://inyoursky.app
  curl -sI $SITE/ | grep -iE 'content-security-policy|referrer-policy|permissions-policy'
  curl -sI $SITE/assets/$(curl -s $SITE/ | grep -oE 'assets/[^"]+\.js' | head -1 | cut -d/ -f2) | grep -i cache-control
  ```

  Expect the three PLAN §11 headers on `/` and `public, max-age=31536000, immutable` on the asset.
- [ ] Network panel on a fresh load: requests go only to the site origin, `celestrak.org`,
      `api.open-meteo.com` and `geocoding-api.open-meteo.com` (FR-X-3). The chart chunk
      (`SkyDome-*.js`) is fetched only when a pass detail opens on the dome view; glyphcss's
      loader and font-atlas chunks are never fetched (D-63).
- [ ] Reload with the network offline after one successful load: the cached elements are
      used and the passes recompute (FR-X-4, R11's `offline.spec.ts` on a real device).

## 3. Phone performance (FR-GUIDE-6)

The R14 spike measured the dome at ≥ 43 rasterisations/s under 6× CPU throttling in
Chromium (D-62); this is the on-device check that it stands for.

- [ ] Device: a mid-range Android phone from about 2022 (a Pixel 6a, a Galaxy A53 or
      similar), Chrome, on the deployed site. Open a pass with a high peak on the dome view.
- [ ] Connect the phone to a desktop Chrome through `chrome://inspect`, open the page's
      DevTools and paste this in the console, then drag the dome continuously for the five
      seconds it runs:

  ```js
  (() => {
    const pre = document.querySelector('pre.glyph-output');
    let rasters = 0, dirty = false, frames = 0, last = 0, longest = 0;
    new MutationObserver(() => { dirty = true; }).observe(pre, { characterData: true, childList: true, subtree: true });
    const t0 = performance.now();
    const tick = (t) => {
      if (last) longest = Math.max(longest, t - last);
      last = t; frames++;
      if (dirty) { rasters++; dirty = false; }
      if (t - t0 < 5000) requestAnimationFrame(tick);
      else console.log(`${(rasters / ((t - t0) / 1000)).toFixed(1)} rasterisations/s over ${frames} frames, longest frame ${longest.toFixed(0)} ms`);
    };
    requestAnimationFrame(tick);
  })();
  ```

  Expect ≥ 30 rasterisations/s and a longest frame under 66 ms (two frames at 30 Hz).
  If it falls short, `interactiveDownscale={2}` on `GlyphScene` in `SkyDome.tsx` is the
  configuration fix the spike identified; if that is not enough, D-16 trigger (a) fires
  and the replacement path in PLAN D-16 applies.
- [ ] Touch: a one-finger drag turns and tilts the dome without scrolling the sheet; the
      tilt stops at the horizon (80°) and short of top-down (5°); the readout follows.

## 4. Deploy day: a manual pass against Heavens-Above

Once, on the day a phase goes live, for the place the owner will actually observe from:

- [ ] On Heavens-Above, set the same location (to 0.01°) and altitude, and list the ISS
      passes for the coming 24 h (any elevation, then read off those above 10°).
- [ ] In the app, enter the same coordinates and altitude and compare every ISS pass in
      the 24 h window: start, peak and end within 60 s and 5° of Heavens-Above's detail
      page (the summary table differs from the detail page by up to 5 s), the same start
      and end reasons, no pass on one side that is missing on the other. A shadow
      boundary 4–6 s later than Heavens-Above's is the known D-8 offset.
- [ ] Check that the brightest non-ISS pass of the night (a Tiangong or SL-16 pass, say) is
      present on both sides and that its peak time agrees within 60 s.
- [ ] Record the observer, the date, the element epochs on both sides and the comparison in
      the release PR. A miss outside the tolerance blocks the deploy and starts a new dated
      fixture under `tests/fixtures/heavens-above/` (PLAN §10.3 debugging order).

## 5. After the deploy

- [ ] Production URL passes §2 again.
- [ ] `live-contract.yml` has run green since the deploy (the daily CelesTrak and Open-Meteo
      contract check).
- [ ] The README's live link still resolves.

## 6. v1 (spec §9 Phase 2)

Everything above still applies. These are the checks the v1 surface added, and they are
on the same phone as §3 — a mid-range 2022 Android, Chrome, on the deployed site — unless
an item says otherwise. §3 and §4 are part of the v1 list too: the dome's drag rate and the
Heavens-Above comparison are what the phase is judged on, not just the MVP.

### 6.1 The live page on the phone (FR-LIVE-5, FR-LIVE-7, FR-LIVE-8)

- [ ] Open the live page (the header's "Live sky", or `l` on a keyboard) and let it settle:
      the dome fills the screen, the status strip carries five filled fields, and nothing
      scrolls sideways.
- [ ] Playback at 3600×: press play at 3600× and, with the phone on `chrome://inspect`,
      paste the §3 snippet and let it run five seconds without touching the screen.
      Expect ≥ 30 rasterisations/s and a longest frame under 66 ms, which is FR-LIVE-5's
      target for the whole 24 h in 24 s. Playing stops at the end of the span rather than
      wrapping, and `now` puts the page back on real time.
- [ ] Scrub the time stripe with one finger: the shown instant follows the touch, the strip
      follows the instant, and the page never scrolls under the drag.
- [ ] Turn the phone sideways: the dome moves to the left and the stripe, the controls and
      the strip to the right, in one screen with no page scroll (FR-LIVE-7). Turn it back.
- [ ] Wake lock: with the live page open and untouched, the screen does not dim for longer
      than the device's timeout would allow; switching apps and coming back leaves the page
      live. Nothing about the lock is shown either way (D-174).
- [ ] "Follow phone" is offered (a touch screen with an orientation API) and turning on the
      spot turns the dome with you, within a few degrees of where you are actually facing;
      a drag takes the camera back. On a desktop the control is absent (FR-LIVE-8, D-175).

### 6.2 Install and offline for three nights (FR-OFF-1, FR-OFF-6, FR-OFF-2/3/4)

- [ ] The install hint appears once on the phone, and installing it puts the app on the home
      screen with the terminal icon; opening it from there is standalone (no browser chrome)
      and the app works. Dismissing the hint instead is remembered across reloads.
      On an iPhone the hint is the "Add to Home Screen" note instead, and the same Share
      → Add to Home Screen flow installs it.
- [ ] Ship a change, reload the installed app twice: the first load shows the "new version
      ready" banner and the second, after taking it, runs the new build (FR-OFF-1, OQ-14).
- [ ] With the app used once online, turn the phone to flight mode and open it from the home
      screen: the shell loads, the readiness line says how long it is ready for, the stored
      passes are there with their age, and the forecast shows with its "as of" time.
      A new location typed offline still recomputes from the cached elements, with the clouds
      unknown (FR-X-4).
- [ ] Save two places, switch between them offline, and confirm the switch needs no network.

### 6.3 Language, theme and the desktop (FR-I18N-*, FR-THEME-*, FR-DESK-*)

- [ ] Switch to Spanish on the phone and walk the screens of `docs/screenshots/v1-*`: no
      English is left anywhere, nothing is clipped, and the choice survives a reload
      (FR-I18N-2/5).
- [ ] Switch to the night theme outdoors, in the dark, adapted: the screen is readable and
      nothing is bright enough to cost night vision (FR-THEME-1). Both themes survive a
      reload.
- [ ] On a desktop browser at ≥ 100 cells: two columns with the guide beside the list, and
      `j` / `k` / `Enter` / `Esc` / `l` / `v` / `n` / `?` all do what the `?` overlay says.
      Typing in the place field fires none of them (FR-DESK-1..4, D-73).

### 6.4 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `1.0.0` on `main` and `docs/RELEASE.md` is this file.
- [ ] Tag it: `git tag -a v1.0.0 -m "v1: outdoor-ready" && git push origin v1.0.0`.
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production.
- [ ] Record in the release PR: the bundle table, the §3 and §6.1 device numbers, the §4
      Heavens-Above comparison with the observer and both element epochs, and the date.

## 7. v1.1 (spec §9 Phase 2b)

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

## 8. v1.2 (spec §9 Phase 2c)

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

## 9. v1.3 (spec §9 Phase 2d)

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

## 10. Repository metadata (FR-PUB-11)

GitHub keeps the description, the topics, the homepage and the social preview in the
repository settings, not in the tree, so this section is the exact text to paste and the
exact image to upload. It is checked once, after P1 merges, and again whenever the live
URL or the phase changes.

- [ ] **Description** (*About*, the pencil at the top right of the repository page):

      Naked-eye satellite spotting in the browser: which bright satellites cross your sky tonight, when, and where to look.

- [ ] **Topics** (same dialog, twelve of them, in this order):

      `satellite-tracking`, `astronomy`, `satellite`, `iss`, `sgp4`, `orbital-mechanics`,
      `stargazing`, `typescript`, `react`, `web-worker`, `pwa`, `spec-driven-development`

- [ ] **Homepage URL** (same dialog, *Website*):

      https://inyoursky.app

- [ ] **Social preview** (*Settings → General → Social preview → Upload an image*),
      1280 × 640, regenerated with `npx tsx scripts/readme-hero.ts`:

      `docs/readme/social-preview.png`

- [ ] Check all four afterwards, plus the licence GitHub detects from `LICENSE` on push:

      ```
      gh repo view --json description,repositoryTopics,homepageUrl,licenseInfo
      ```

## 11. v1.4 (spec §9 Phase 2f)

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

## 12. v2.0 (spec §9 Phase 2g)

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

## 13. v2.1 (spec §9 Phase 2h)

Everything above still applies, §1 to §5 included, and §12's runs stay the reference for
the screens v2.1 did not change. v2.1 is the audit and the flow: no new screen, three
small features (faint passes, `[ see this pass ]`, the capped column), and a long list
of holes closed — a link that no longer overwrites your place, failures that say what
failed and offer `[ retry ]`, a list that knows what night it is, a shell a screen reader
can walk, and a Back button that goes back. Most of it is proved by a test. What is
left here is what a test cannot do: hold a phone, lose the network on purpose, and
listen to the page.

The phone is the one used for §12, so the readings compare. **Start §13.1 from a clean
browser**, for the same reason as §12.1: it cannot be run twice on one profile.

### 13.1 The first run, from a clean browser (FR-FIRST-1..4, FR-FIRST-10, US-26 AC7, F-97)

- [ ] The where step's placeholders read as hints, not values: the coordinate field
      and the place field are visibly empty, and the altitude box holds no real `0`
      (FR-FIRST-2, F-73).
- [ ] **Type** a coordinate pair — do not use the device button. `[ continue ]` is on
      the screen as soon as the pair is valid, and pressing it moves to the next step
      (FR-FIRST-2, F-86). The step does not move under you while you are still typing.
- [ ] The first step is one screen with its footer under it — no long empty run under
      the coordinates, the privacy promise said once (FR-FIRST-1, F-74).
- [ ] On the third step, **open the first card** — tap anywhere on it, the cloud line
      included — and its pass opens; back on the list, the next pass is there to open
      too (FR-FIRST-3, FR-FIRST-10, F-84, F-85).
- [ ] The header of the cold open offers no `[ live ]` that leads to a page with
      nothing on it (F-75).
- [ ] **F-97.** Back on the first step (a second clean profile, or clear the site
      data), scroll it up and down with a finger. If the top of the page above the form
      blanks while scrolling, F-97 is confirmed: write down the phone, the browser and
      the version, and it becomes a finding with a task. If it does not, write that down
      and F-97 is closed as the emulated pane's artefact.

### 13.2 A friend's link over a saved place, and back (FR-VISIT-1..4, US-30)

With the place from §13.1 saved. Have a pass link and a live link for **another**
place ready — sent from a second device, or made there with `[ share ]`.

- [ ] Open the pass link. The page shows the other place's sky with one notice under
      the header: "Showing the sky from …, from a link" with `[ back to my place ]` and
      `[ keep this place ]` (FR-VISIT-2). Your saved place has not been touched.
- [ ] `[ back to my place ]`: your own place and its list come back, the notice goes,
      and the hash is cleared (FR-VISIT-2). Reload to be sure the saved place survived
      — **this is the item the phase exists for** (F-89).
- [ ] Open the live link, and this time `[ keep this place ]`: the visited place is now
      yours, and the notice goes.
- [ ] A live link whose time has passed opens at real time with a note that says so
      (FR-VISIT-3); a link with a broken value opens your own home with "That link
      could not be read." (FR-VISIT-4). Edit the hash by hand for both.

### 13.3 Aeroplane mode on an open tab, then `[ retry ]` (FR-FAIL-1..8, FR-OFF-8, US-31)

- [ ] With the home open and computed, turn on aeroplane mode and reload. The stored
      run is shown with its age, the live page draws from it (FR-OFF-8), and nothing
      says `HTTP`, a status code or an exception's name outside `[ details ]`
      (FR-FAIL-2, F-96).
- [ ] Change the place while offline, so a load has to fail. The place its result
      would have been shows one line — what failed, what the page is using instead —
      then `[ retry ]` and `[ details ]` (FR-FAIL-1).
- [ ] Turn aeroplane mode off and press `[ retry ]`. It shows its loading state and the
      list comes back **without a reload** (FR-FAIL-1, F-87).
- [ ] Switch the language while a failure line is up: the sentence changes language
      with the rest of the page (FR-FAIL-2).
- [ ] The live page opened cold with no network says it is offline or failed — not
      "loading" for ever (FR-LIVE-1, FR-FAIL-6, F-92).

### 13.4 A screen-reader pass over the four routes (FR-A11Y-1..6, OQ-35)

VoiceOver on an iPhone or TalkBack on Android, whichever the phone has. Name it and its
version in the release PR: that is what FR-A11Y-6 asks for.

- [ ] **Home.** The first swipe reaches a skip link; the rotor or the headings list
      shows one `h1`, the steps or panes as `h2`, and each night and each pass card
      below them (FR-A11Y-1, FR-A11Y-2, F-72). A card is announced as one control.
- [ ] **A pass** (`#pass?…`). Opening it moves the focus into the pass and the
      document's title names it (FR-A11Y-3, FR-A11Y-4). Back goes back to the list,
      once, not twice (FR-ROUTE-1, F-91).
- [ ] **Live** (`#live`). Entering it moves the focus to the page, its landmarks are
      there (F-71), and the watching headline's times are read with `rise`, `peak`
      and `end` (F-81). **F-100** (fixed in the release, D-642): with the screen reader off, tap
      into `#live` and look at the back control. If a ring is drawn, it hugs `[ ← ]`
      and stays off the line below. A ring that covers text reopens F-100.
- [ ] **Settings** (`#settings`). Every row is read once — the install row is not
      "Instalar, Instalar" (F-83) — and the install button, if the browser offers one,
      still works after a cancelled dialog (FR-FAIL-8, F-95).
- [ ] What no test checks, the rest of OQ-35, once each: a Tab walk on a device with a
      keyboard (every control reached, the focus ring visible), and the four routes at
      200 % text in the phone's settings (nothing cut off without a way to reach it).
      Write down what fails; each is a finding, not a fix in this release.

### 13.5 What the owner decides on this release

- [x] **F-69, main over its budget.** Decided at the gate (V21-24, D-641): main's
      budget is 170, the §11 ceiling, against the 166.6 KB it measures. 3.4 KB is left;
      PLAN D-609's remedies (zod out of the shell's path, the guide behind
      `React.lazy`) are for the phase that needs more.
- [ ] **F-66, F-70 and F-99.** Read the two `captures.yml` runs on the release commit
      (§13.6) and diff them. The two local runs differed in 38 of 254 files (PLAN
      D-639): about half are sub-pixel edges (F-66, F-70), and the rest are the live
      page's shown instant a second apart (F-99). F-99 is fixed in the release (D-642):
      two local runs now differ in 7 files, none on a clock. Byte-identical on CI:
      close F-66 and F-70. Different: keep them with the file names. A clock that
      differs reopens F-99.
- [ ] **OQ-33**, the stripe with no dark band, is still open for want of a night to
      look at (SPEC §7). Close it or carry it.

### 13.6 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.1.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (R83..R101).
- [ ] The `captures.yml` run on the merge commit is green: **254 files**, no missing
      capture. Dispatch it a **second time on the same commit** and compare the two
      artefacts file by file; that pair is F-66's and F-70's reading of record
      (FR-CAP-5).
- [ ] Tag it: `git tag -a v2.1.0 <sha> -m "v2.1: the audit and the flow" && git push
      origin v2.1.0` — **with the release commit's SHA written in**, not whatever
      `main` has reached by then (a squash merge rewrites the commit).
- [ ] Deploy `main` to `https://inyoursky.app` and run §2 and §5
      against production.
- [ ] Run §13.1 to §13.4 on the phone, and write the results into the register: F-97
      confirmed or closed, OQ-35's remaining half closed or turned into findings.
- [ ] Record in the release PR: the bundle table with main against its new 170, the
      screen reader and its version, the §4 Heavens-Above comparison with the observer
      and both element epochs, and the date.

## 14. v2.2 (spec §9 Phase 2i)

Everything above still applies, §1 to §5 included, and §12's runs stay the reference for
the screens v2.2 did not change. v2.2 is the showcase: the repository in front of a second
audience, one product change (the footer's glyphcss credit, FR-SHOW-8), and the address.
`https://inyoursky.app` is now the origin every document names; the old address (the one
`docs/DEPLOY.md`'s *Domain* section keeps) serves on unchanged with its own browser state
(FR-ADDR-3), and §2 and §5 run against the new one. Its §13 phone run is v2.1's and stays owed.

### 14.1 The two origins (FR-ADDR-2)

The first deploy from `main` after P6 merges is what binds the domain: `wrangler deploy`
creates the DNS record and the certificate for the `routes` entry in `wrangler.jsonc`.
Nothing is set in the dashboard.

- [ ] Both origins print the three PLAN §11 headers (the two `curl -sI` lines under
      *Domain* in `docs/DEPLOY.md`), and the immutable `Cache-Control` on an asset at the
      new one (§2's third line with `SITE=https://inyoursky.app`).
- [ ] The app opens at `https://inyoursky.app`: a typed place computes passes, the dome
      opens, DevTools shows no console error and no Content-Security-Policy violation.
      The CSP's `connect-src 'self'` needed no host added.
- [ ] The old address opens the same build, and a browser that had a place saved there
      still has it there and starts fresh at the new one (FR-ADDR-3; no migration, no
      banner).
- [ ] The GitHub *Website* field reads `https://inyoursky.app` (§10), checked with
      `gh repo view --json homepageUrl`.

### 14.2 The hero and the captures (FR-ADDR-4, FR-SHOW-5, FR-SHOW-8)

- [ ] `docs/readme/social-preview.png` prints `inyoursky.app` under the title, and `docs/readme/hero.png` was regenerated beside it (the hero carries no title line, D-661)
      under the title, regenerated by `npx tsx scripts/readme-hero.ts` from the unchanged
      captures; the README's image is legible at the width GitHub renders it.
- [ ] `docs/screenshots/` changed only in the footer captures R102 re-shot for the
      glyphcss credit, in both languages; every other file is byte-identical to the
      `v2.1.0` set (FR-SHOW-5).
- [ ] The footer names glyphcss with its link, in both languages, on the phone and on the
      desktop, and neither the footer nor the README names the library's author (US-36
      AC6, V22-15).

### 14.3 The release itself

Owner steps, in this order, and none of them belong to a task session:

- [ ] `package.json` is `2.2.0` on `main` and every task of the phase is checked off in
      `TASKS.md` (P6, R102, P3, P4, P5).
- [ ] `npx knip` on the release commit reports nothing, and the bundle table shows no
      chunk larger than the `v2.1.0` build's (FR-SHOW-4, FR-SHOW-5).
- [ ] Tag it: `git tag -a v2.2.0 <sha> -m "v2.2: the showcase" && git push origin
      v2.2.0` — **with the release commit's SHA written in**, not whatever `main` has
      reached by then (V22-12; a squash merge rewrites the commit).
- [ ] Deploy `main` to `https://inyoursky.app` and run §2, §5 and §14.1 against
      production, on both origins.
- [ ] Record in the release PR: the two header blocks, the bundle table, the knip
      output, and the date.
