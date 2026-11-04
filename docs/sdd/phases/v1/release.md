## 6. v1 (spec §9 Phase 2)

> *History (marked 2026-09-25, FR-SHOW-1): the v1 release's list as it was run. What is current is §1–§5, §10 and the last section.*

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
