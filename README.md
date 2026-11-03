# What is in your sky right now

A web app for spotting satellites with the naked eye. Give it a place and it lists which of
about thirty bright satellites (the ISS, Tiangong, Hubble and others) cross the sky there in
the next three nights: when each appears, where to look, how high and how bright, and the
cloud forecast. A pass opens with a countdown and its path over the stars it crosses; the
live sky follows the phone as you point it up; the stars page shows tonight's stars and
constellations by name, turned by hand or held up to the sky. It runs in the browser, with
no backend and no account, works offline, and speaks English and Spanish.

**Live:** <https://inyoursky.app> (2.11.0)

![Three screens: a phone following the pass that is up, drawn among the stars; a phone turned sideways showing tonight's stars and constellations; and a laptop showing the home page with its three doors, Satellites, Stars and Live sky, and the next pass with its countdown, its path and its rise, peak and set times](docs/readme/hero.png)

**How it is built.** Spec-driven, by Claude Code sessions rather than by hand. `SPEC.md` says
what it does, `PLAN.md` how, `TASKS.md` cuts it into slices. [`scripts/sdd-run.ts`](scripts/sdd-run.ts)
runs each task as a headless session in its own git worktree, opens a pull request, waits for
CI, has a second session review the diff, and merges. The owner answers the spec's questions,
tries each release on a real phone, and the notes become the next phase's spec decisions.

[How this was built](docs/HOW-THIS-WAS-BUILT.md) - [The design system](docs/DESIGN.md) -
[Contributing](CONTRIBUTING.md) - [Licence](LICENSE) (MIT)

## By the numbers

Read from the repository at `main` on 2026-11-03; each figure's command is in
[docs/HOW-THIS-WAS-BUILT.md](docs/HOW-THIS-WAS-BUILT.md#by-the-numbers).

| | |
|---|---|
| Time span | first commit 2026-09-02, 2.11.0 released 2026-11-03 |
| Tasks done | 178, one session each (3 open, the globe) |
| Pull requests merged | 260 |
| Releases | 7 tags, `v1.1.0` to `v2.11.0` |
| Requirement ids | 410 `FR-` ids in the spec |
| Decisions | 973 `D-` ids in the spec and the plan, 284 rows in the spec's Decision Log |
| Tests | 3309 Vitest tests in 272 files, and 112 Playwright specs |

## How it was built

```
SPEC.md  ->  PLAN.md  ->  TASKS.md  ->  one headless session per task, in its own worktree
         ->  pull request  ->  CI  ->  a second session reviews the diff  ->  merge
         ->  the owner tries it on a phone  ->  the notes become spec decisions  ->  SPEC.md
```

- [`SPEC.md`](SPEC.md) says what the product does: numbered requirements (`FR-…`), user
  stories with acceptance criteria, and a Decision Log that is fixed once written.
- [`PLAN.md`](PLAN.md) says how it is built: the architecture, the worker contract, the
  testing strategy, the bundle budgets, numbered decisions (`D-…`), and in §16 how tasks
  are delivered.
- [`TASKS.md`](TASKS.md) is the ordered list of vertical slices, each with the requirement
  ids it satisfies, its lane, its dependencies and a *done when* list. A session generates it
  from the other two; nobody edits it by hand except to check a task off.
- [`scripts/sdd-run.ts`](scripts/sdd-run.ts) delivers the tasks, up to three at once in
  separate lanes: a headless session per task in its own worktree, a pull request, CI, a
  second session that reviews the diff, and the merge. What the reviewer finds becomes a
  later task rather than holding the merge open. The MVP (R1–R15 and H) was run by hand,
  one interactive session per task, before the driver existed; every task from R16 on but
  one phone spike (R38) went through it.
- CI is the gate: typecheck, lint, dead-code and commit-message checks, the Vitest suite,
  a production build checked against the bundle budgets, and the Playwright suite under the
  strict CSP, in five parallel shards of at most ten minutes. A pull request runs the tests
  its change can reach, and the whole suite when the build inputs change. Physics changes
  have to pass the golden fixtures transcribed from Heavens-Above.
- The owner's part: answering the spec's scope questions, reading each release on a real
  phone and a desk, and turning what was wrong into the next phase's requirements.

The long version, with one task followed end to end, is
[docs/HOW-THIS-WAS-BUILT.md](docs/HOW-THIS-WAS-BUILT.md).

## Stack

- React 19, TypeScript and Vite; state in Zustand, data validated with Zod. No backend: the
  browser talks to CelesTrak and Open-Meteo directly.
- The physics runs in a Web Worker: SGP4 propagation with satellite.js, the Sun, the Moon and
  the planets with astronomy-engine. Time is always a parameter, never the wall clock, so the
  predictions are tested against fixed, dated fixtures. The compass is corrected for magnetic
  declination with geomagnetism.
- The sky is drawn as text in the page's monospace grid, in three views: a window on part of
  the sky that can follow the phone's orientation, a polar chart of the whole sky, and a 3D
  dome drawn with @glyphcss/react. The live sky and a pass offer all three, the stars page
  the window and the whole sky. All DOM, no canvas or WebGL. On a phone each of those pages
  is the drawing full-screen, with its controls in a bottom sheet. In progress on `main`: a
  celestial globe for the stars page on desktops.
- Element sets are cached in IndexedDB; a service worker (vite-plugin-pwa) keeps the app
  working offline after the first visit, and it installs as an app. English and Spanish.
- Tests: Vitest (unit, golden physics, components, and the worker in a real Chromium) and
  Playwright end to end under the production Content-Security-Policy. Hosting: Cloudflare
  Workers static assets.

## Run

[![CI](https://github.com/CipoBaruf/what-is-in-your-sky/actions/workflows/ci.yml/badge.svg)](https://github.com/CipoBaruf/what-is-in-your-sky/actions/workflows/ci.yml)
says whether the commands below pass on `main`.

Prerequisites: **Node 24** (the version in `.node-version`, which is the one CI uses) and
a Chromium for Playwright, which the second command installs. Both are needed before
`npm test`: the suite boots a real browser for the worker project.

```
npm ci
npx playwright install chromium
npm test             # Vitest (unit, golden, component, worker in Chromium); never touches the network
npm run build        # dist/, including public/_headers and public/third-party-notices.txt
npm run bundle:budget  # after a build: gzipped chunk sizes against the PLAN §11 budgets (CI prints this table)
```

Those five are the whole of it: a clean clone runs them and nothing else (FR-PUB-8). The
rest are for working on it:

```
npm run dev          # http://localhost:5173 (no CSP: Fast Refresh needs inline scripts)
npm run preview      # http://localhost:4173, the production build with the Cloudflare headers
npm run e2e          # production build + Playwright, under the strict CSP
npm run check:catalog  # live: every catalog object present in CelesTrak visual|stations
npx tsx scripts/readme-hero.ts          # the picture above and docs/readme/social-preview.png, from committed captures
npx tsx scripts/third-party-notices.ts  # public/third-party-notices.txt, from the installed tree
```

The tasks are delivered by a driver script rather than by hand (PLAN §16, and
[docs/HOW-THIS-WAS-BUILT.md](docs/HOW-THIS-WAS-BUILT.md)):

```
npm run sdd -- --status     # what is merged, in review, ready, blocked or failed
npm run sdd -- --dry-run    # exactly what the next wave would run, and stop
npm run sdd -- --wave       # run it: one session per task in its own worktree, then CI, review, merge
npm run sdd -- --task R17   # one task, dependencies checked
```

## Deploy

Hosting is Cloudflare Workers static assets, wired to this repository through Workers
Builds: a push to `release` — `main` fast-forwarded at each tag — builds and deploys
production, and every other branch, `main` included, gets its own preview URL.
`wrangler.jsonc` at the root holds the whole configuration, and `public/_headers` carries
the strict Content-Security-Policy, `Referrer-Policy` and `Permissions-Policy` from PLAN
§11 — `npm run preview` serves the same file the same way and the Playwright suite runs
the app under it, so a CSP violation fails CI before it reaches the site. The app connects
to its own origin and to CelesTrak and Open-Meteo, and to nothing else; there is no
analytics or tracking (spec FR-X-3).

The dashboard steps, the worker-rename procedure and the header checks are in
[docs/DEPLOY.md](docs/DEPLOY.md); [docs/RELEASE.md](docs/RELEASE.md) is the release
checklist.

## Data sources and attributions

- **Orbital elements:** [CelesTrak](https://celestrak.org/) — GP element sets (OMM JSON) for the
  `visual` and `stations` groups, fetched by the browser and filtered to the curated catalog.
  CelesTrak data is **free for any use with attribution**; the app fetches a group at most once
  every 2 h and keeps the set in IndexedDB between visits (`src/data/elementsCache.ts`).
- **Weather and geocoding:** [Open-Meteo](https://open-meteo.com/) — cloud-cover forecast and
  place-name search, used under the
  [**CC BY 4.0**](https://creativecommons.org/licenses/by/4.0/) terms of its free non-commercial API.
  Open-Meteo's geocoding data derives from [GeoNames](https://www.geonames.org/) (**CC BY 4.0**),
  and the town a device location is named after comes from GeoNames' `cities15000` list,
  bundled with its source and date (`src/data/places/places.txt`), so naming it sends nothing
  anywhere. The credits are in the app footer, with CelesTrak's (spec FR-X-2,
  `src/ui/components/common/Footer.tsx`). A recorded forecast response for the Neuquén cell
  (`tests/fixtures/open-meteo/`, with its capture metadata) feeds the weather tests; the app
  itself never reads it.
- **Stars and figures:** the stars, their positions and magnitudes from the **Yale Bright Star
  Catalogue** (5th revised edition, public domain), their proper names from the **IAU Catalog of
  Star Names** (CC BY 4.0), and the constellation figures from **d3-celestial** (BSD-3-Clause,
  © 2015 Olaf Frohn), built into `src/data/stars/catalog.json` from the copies in
  `data-src/stars/` and listed in the data section of `public/third-party-notices.txt`.
- **Intrinsic magnitudes:** the catalog (`src/data/catalog/catalog.json`) seeds each object's
  standard magnitude from **Mike McCants'** Quicksat intrinsic magnitudes file
  (`qs.mag`, 2020-09-14, [mmccants.org/programs/qsmag.zip](https://www.mmccants.org/programs/qsmag.zip)).
  The file carries no licence text: it is a **published data table, used with attribution** to its
  author and its date. Objects launched after it (Tiangong) carry a documented estimate, and every
  entry records its source and date (`stdMagSource`) so values can be audited and updated.
- **Reference predictions (development only):** [Heavens-Above](https://www.heavens-above.com/)
  pass tables, **transcribed by hand into dated fixtures for development use only**, under
  `tests/fixtures/heavens-above/`, for the physics golden tests. Never fetched by the app or the
  tests, and no Heavens-Above content is redistributed beyond those transcribed numbers.
- **The sky chart:** [glyphcss](https://glyphcss.com) — **MIT**, © 2025 Layoutit. It was
  chosen because it draws 3D into the same monospace character grid the
  rest of the page is set in, so the dome is text and the app needs no canvas: one type of pixel,
  one set of colour tokens, and a chart that inherits the theme instead of reimplementing it.

Every package whose code reaches the production bundle is listed with its licence in
`public/third-party-notices.txt`, which is generated by `npx tsx scripts/third-party-notices.ts`
and served at `/third-party-notices.txt` beside the bundle it covers.

## Catalog maintenance

`catalog.json` is the single source of per-object metadata (name, category, `stdMag` with
provenance, description, `featured`). It is validated by `src/data/catalog/catalog.test.ts` in CI.
Run `npm run check:catalog` periodically: an object reported as `MISSING` has decayed or left the
CelesTrak groups and should be removed. Docked modules and visiting vehicles of the ISS and
Tiangong are deliberately absent: each station is listed once under its core module's NORAD id.
