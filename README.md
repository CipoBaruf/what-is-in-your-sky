# What is in your sky right now

Naked-eye satellite spotting: type a location, get the visible passes of ~30 bright
objects for the coming night, with where and when to look. Static web app, no backend;
the browser talks to the data sources directly. See `SPEC.md`, `PLAN.md` and `TASKS.md`.

**Live:** <https://what-is-in-your-sky.ezequiel-baruf.workers.dev> (Cloudflare Workers
static assets; `main` is production, other branches get preview URLs).

## Run

```
npm ci
npm run dev          # http://localhost:5173 (no CSP: Fast Refresh needs inline scripts)
npm run build        # dist/, including public/_headers
npm run preview      # http://localhost:4173, the production build with the Cloudflare headers
npm test             # Vitest (unit, golden, component); never touches the network
npm run e2e          # production build + Playwright, under the strict CSP
npm run check:catalog  # live: every catalog object present in CelesTrak visual|stations
```

## Deploy

Hosting is Cloudflare Workers static assets wired to this repository through Workers
Builds (PLAN D-12 as amended in §2.5): a push to `main` builds and deploys production;
a push to any other branch, once *non-production branch builds* are enabled, uploads a
preview version with its own URL. `wrangler.jsonc` at the root holds the whole
configuration (assets-only Worker, `dist/` as the assets directory, no Worker script), so
the build never has to guess. The project was created once in the Cloudflare dashboard:

1. *Workers & Pages → Create → Import a repository*, pick `CipoBaruf/what-is-in-your-sky`.
2. Worker name `what-is-in-your-sky`, production branch `main`, build command
   `npm run build`, deploy command `npx wrangler deploy` (the defaults). No environment
   variables; the Node version comes from `.node-version` (24, the same as CI).
3. *Settings → Builds → Branch control*: enable non-production branch builds so every
   branch gets a preview version, aliased by branch name:
   `https://<branch>-what-is-in-your-sky.ezequiel-baruf.workers.dev`.

`public/_headers` is copied into `dist/` by Vite and parsed by Cloudflare at upload (it is
never served): the strict Content-Security-Policy, `Referrer-Policy` and `Permissions-Policy`
from PLAN §11 on every path, and a one-year immutable cache on the hashed files under
`/assets/`. `npm run preview` serves the same file the same way, and the Playwright suite
runs the app under it, so a CSP violation fails CI before it reaches the site. To check a
deployment by hand (replace the host with a preview URL to check a branch):

```
SITE=https://what-is-in-your-sky.ezequiel-baruf.workers.dev
curl -sI $SITE/ | grep -iE 'content-security-policy|referrer-policy|permissions-policy'
curl -sI $SITE/assets/$(curl -s $SITE/ | grep -oE 'assets/[^"]+\.js' | head -1 | cut -d/ -f2) | grep -i cache-control
```

The app makes requests only to its own origin and to the hosts named in `connect-src`
(CelesTrak now; Open-Meteo from R8/R9). There is no analytics or tracking (spec FR-X-3);
Workers observability is off in `wrangler.jsonc`.

## Data sources and attributions

- **Orbital elements:** [CelesTrak](https://celestrak.org/) — GP element sets (OMM JSON) for the
  `visual` and `stations` groups, fetched by the browser and filtered to the curated catalog.
  CelesTrak data is free for any use with attribution; the app fetches at most one set per group
  per session (a 2 h cache follows in R11).
- **Weather and geocoding:** [Open-Meteo](https://open-meteo.com/) — cloud-cover forecast and
  place-name search (from R8 and R9), used under the
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) terms of its free non-commercial API.
  Open-Meteo's geocoding data derives from [GeoNames](https://www.geonames.org/) (CC BY 4.0).
  Both credits also go in the app footer when those features land (spec FR-X-2).
- **Intrinsic magnitudes:** the catalog (`src/data/catalog/catalog.json`) seeds each object's
  standard magnitude from Mike McCants' Quicksat intrinsic magnitudes file
  (`qs.mag`, 2020-09-14, [mmccants.org/programs/qsmag.zip](https://www.mmccants.org/programs/qsmag.zip)).
  Objects launched after that file (Tiangong) carry a documented estimate. Every entry records its
  source and date (`stdMagSource`) so values can be audited and updated.
- **Reference predictions (development only):** [Heavens-Above](https://www.heavens-above.com/)
  pass tables, transcribed by hand into dated fixtures under `tests/fixtures/heavens-above/`
  for the physics golden tests. Never fetched by the app or the tests.

## Catalog maintenance

`catalog.json` is the single source of per-object metadata (name, category, `stdMag` with
provenance, description, `featured`). It is validated by `src/data/catalog/catalog.test.ts` in CI.
Run `npm run check:catalog` periodically: an object reported as `MISSING` has decayed or left the
CelesTrak groups and should be removed. Docked modules and visiting vehicles of the ISS and
Tiangong are deliberately absent: each station is listed once under its core module's NORAD id.
