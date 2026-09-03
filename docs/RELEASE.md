# Release checklist

Run this once per deploy that changes the physics, the worker, the sky chart or the
headers, and once on the MVP deploy day (spec Phase 1 definition of done). Every item
is a check with a stated expectation; note the result and the date in the PR that
ships the release. CI already gates the automated parts (typecheck, lint, unit and
golden tests, the worker in Chromium, the production build, Playwright under the
strict CSP): this list is what CI cannot see.

## 1. Before merging

- [ ] CI is green on the branch, and the build log's bundle table (`npm run bundle:budget`)
      shows every budgeted chunk within its PLAN §11 budget: main ≤ 150 KB, chart ≤ 100 KB,
      worker ≤ 120 KB gzipped. An overrun is a `::warning::` annotation; if one is accepted,
      the PR says so and PLAN §11 is amended.
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

Once, on the day the MVP goes live, for the place the owner will actually observe from:

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
