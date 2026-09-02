# Live contract tests

`LIVE=1 npx vitest run --project live` — the only tests that touch the network (PLAN §9.1, §9.3). They check that CelesTrak and Open-Meteo still answer in the shape the app parses, that every catalog object is still in `visual` or `stations`, and that the `access-control-allow-origin: *` header the browser-direct design depends on (SPEC §5.2) is still there. Without `LIVE=1` the whole suite is skipped, so `npm test` never reaches the network. `.github/workflows/live-contract.yml` runs it daily and opens an issue on failure; it never blocks a merge.
