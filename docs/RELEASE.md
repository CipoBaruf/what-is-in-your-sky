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
      shows every budgeted chunk within its budget: main ≤ 150 KB, chart ≤ 110 KB,
      worker ≤ 40 KB, astronomy ≤ 25 KB, live ≤ 10 KB and the service worker ≤ 10 KB
      gzipped (D-178 — the measured build plus a tenth, all of them inside the PLAN §11
      ceilings). An overrun is a `::warning::` annotation; if one is accepted, the PR says
      so, and the fix is to re-measure and re-set the budgets rather than widen one.
- [ ] The capture set matches the app: `npx playwright test v1-captures --project=chromium`
      re-shoots `docs/screenshots/v1-*.png` and `npm test` (`tests/docs/captures.test.ts`)
      says the set is complete. Look at the files that changed.
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
