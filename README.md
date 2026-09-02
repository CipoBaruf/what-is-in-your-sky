# What is in your sky right now

Naked-eye satellite spotting: type a location, get the visible passes of ~30 bright
objects for the coming night, with where and when to look. Static web app, no backend;
the browser talks to the data sources directly. See `SPEC.md`, `PLAN.md` and `TASKS.md`.

## Run

```
npm ci
npm run dev          # http://localhost:5173
npm test             # Vitest (unit, golden, component); never touches the network
npm run e2e          # production build + Playwright
npm run check:catalog  # live: every catalog object present in CelesTrak visual|stations
```

## Data sources and attributions

- **Orbital elements:** [CelesTrak](https://celestrak.org/) — GP element sets (OMM JSON) for the
  `visual` and `stations` groups, fetched by the browser and filtered to the curated catalog.
  CelesTrak data is free for any use with attribution; the app fetches at most one set per group
  per session (a 2 h cache follows in R11).
- **Intrinsic magnitudes:** the catalog (`src/data/catalog/catalog.json`) seeds each object's
  standard magnitude from Mike McCants' Quicksat intrinsic magnitudes file
  (`qs.mag`, 2020-09-14, [mmccants.org/programs/qsmag.zip](https://www.mmccants.org/programs/qsmag.zip)).
  Objects launched after that file (Tiangong) carry a documented estimate. Every entry records its
  source and date (`stdMagSource`) so values can be audited and updated.
- **Reference predictions (development only):** [Heavens-Above](https://www.heavens-above.com/)
  pass tables, transcribed by hand into dated fixtures under `tests/fixtures/heavens-above/`
  for the physics golden tests. Never fetched by the app or the tests.
- Weather and geocoding ([Open-Meteo](https://open-meteo.com/), GeoNames-derived) arrive in
  later tasks and will be credited here and in the app footer.

## Catalog maintenance

`catalog.json` is the single source of per-object metadata (name, category, `stdMag` with
provenance, description, `featured`). It is validated by `src/data/catalog/catalog.test.ts` in CI.
Run `npm run check:catalog` periodically: an object reported as `MISSING` has decayed or left the
CelesTrak groups and should be removed. Docked modules and visiting vehicles of the ISS and
Tiangong are deliberately absent: each station is listed once under its core module's NORAD id.
