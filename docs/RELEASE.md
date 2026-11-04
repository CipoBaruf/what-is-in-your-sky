# Release checklist

Run this once per deploy that changes the physics, the worker, the sky chart or the
headers, and once on each phase's deploy day (spec §9 definition of done). Every item
is a check with a stated expectation; note the result and the date in the PR that
ships the release. CI already gates the automated parts (typecheck, lint, unit and
golden tests, the worker in Chromium, the production build, Playwright under the
strict CSP): this list is what CI cannot see.

This file is the procedure only (FR-SDD-9). §1–§5 are every release and §10 is the
repository's metadata; the numbers are the ones the records and the code cite, so they
stay. A phase's own list — its captures, its budget, what the owner decides, its run on a
device and the tag — is written by its release task into the phase folder, as
`docs/sdd/phases/<version>/release.md`, following `docs/sdd/workflows/release.md`.
The lists already run moved there byte for byte; an old section number cites them here:

| Old § | Release | Record |
|---|---|---|
| §6 | v1 | `docs/sdd/phases/v1/release.md` |
| §7 | v1.1 | `docs/sdd/phases/v1.1/release.md` |
| §8 | v1.2 | `docs/sdd/phases/v1.2/release.md` |
| §9 | v1.3 | `docs/sdd/phases/v1.3/release.md` |
| §11 | v1.4 | `docs/sdd/phases/v1.4/release.md` |
| §12 | v2.0 | `docs/sdd/phases/v2.0/release.md` |
| §13 | v2.1 | `docs/sdd/phases/v2.1/release.md` |
| §14 | v2.2 | `docs/sdd/phases/v2.2/release.md` |
| §15 | v2.3 | `docs/sdd/phases/v2.3/release.md` |
| §16 | v2.4 | `docs/sdd/phases/v2.4/release.md` |
| §17 | v2.5 | `docs/sdd/phases/v2.5/release.md` |
| §18 | v2.6 | `docs/sdd/phases/v2.6/release.md` |
| §19 | v2.6.1 | `docs/sdd/phases/v2.6.1/release.md` |
| §20 | v2.7 | `docs/sdd/phases/v2.7/release.md` |
| §21 | v2.8 | `docs/sdd/phases/v2.8/release.md` |
| §22 | v2.9 | `docs/sdd/phases/v2.9/release.md` |
| §23 | v2.10 | `docs/sdd/phases/v2.10/release.md` |
| §24 | v2.11 | `docs/sdd/phases/v2.11/release.md` |
| §25 | v2.12 | `docs/sdd/phases/v2.12/release.md` |

In a record, "§24.1" is section 24.1 of the record this table names for §24; "§1"–"§5"
and "§10" are this file.

## 1. Before merging

- [ ] CI is green on the branch, and the build log's bundle table (`npm run bundle:budget`)
      shows every budgeted chunk within its budget: main ≤ 170 KB, chart ≤ 105 KB,
      worker ≤ 40 KB, stars ≤ 30 KB, astronomy ≤ 25 KB, window ≤ 30 KB, live ≤ 15 KB, the
      service worker ≤ 10 KB and settings ≤ 10 KB gzipped (D-178 — the measured build plus a tenth
      on the next 5 KB line, all of them inside the PLAN §11 ceilings; `main` is the one
      row at its ceiling, raised there at the v2.1 gate, D-641). The table that says where
      each number came from is the comment at the top of `scripts/bundle-budget.ts`. An
      overrun is a `::warning::` annotation; if one is accepted, the PR says so, and the
      fix is to re-measure and re-set the budgets rather than widen one.
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
- [ ] Nothing is deployed by merging: production is the `release` branch, which only a
      release moves (`docs/DEPLOY.md`, *How it is wired*; D-739). The deploy step of each
      phase's list is `git push origin <release-sha>:release` after the tag, with the
      same SHA — never `main`'s head.
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
