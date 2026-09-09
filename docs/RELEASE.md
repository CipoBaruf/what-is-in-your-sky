# Release checklist

Run this once per deploy that changes the physics, the worker, the sky chart or the
headers, and once on each phase's deploy day (spec §9 definition of done). Every item
is a check with a stated expectation; note the result and the date in the PR that
ships the release. CI already gates the automated parts (typecheck, lint, unit and
golden tests, the worker in Chromium, the production build, Playwright under the
strict CSP): this list is what CI cannot see.

Sections 1–5 are every release. **Section 6 is the v1 list** (spec §9 Phase 2): the
checks the v1 surface added, plus the tag and the deploy, which are the owner's.

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
- [ ] The branch preview (`https://<branch>-in-your-sky.ezequiel-baruf.workers.dev`) opens,
      computes passes for a typed location, and DevTools shows no console error and no
      Content-Security-Policy violation while opening a pass, dragging the dome and
      toggling to the polar view.

## 2. The deployed site

Replace the host with the preview URL to check a branch.

- [ ] Headers, as in `README.md`:

  ```
  SITE=https://in-your-sky.ezequiel-baruf.workers.dev
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
- [ ] Deploy `main` to `https://in-your-sky.ezequiel-baruf.workers.dev` and run §2 and §5
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
- [ ] Deploy `main` to `https://in-your-sky.ezequiel-baruf.workers.dev` and run §2 and §5
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
- [ ] Deploy `main` to `https://in-your-sky.ezequiel-baruf.workers.dev` and run §2 and §5
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
- [ ] Deploy `main` to `https://in-your-sky.ezequiel-baruf.workers.dev` and run §2 and §5
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

      https://in-your-sky.ezequiel-baruf.workers.dev

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
- [ ] Deploy `main` to `https://in-your-sky.ezequiel-baruf.workers.dev` and run §2 and §5
      against production.
- [ ] Record in the release PR: the bundle table, the §3, §6.1 and §11.1 device numbers,
      the §4 Heavens-Above comparison with the observer and both element epochs, and the
      date.
