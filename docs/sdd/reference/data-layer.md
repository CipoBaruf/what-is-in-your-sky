## 7. Data Layer

### 7.1 Elements (`data/elementsLoader.ts`)

```
loadElements():
  lock = navigator.locks?.request('wiys:elements', async () => {      # D-10
    for group in ['stations', 'visual']:
      cached = idb.get(group)
      if cached && now - cached.fetchedAt < 2h: continue
      try: records = celestrak.fetchGroup(group)   # GET https://celestrak.org/NORAD/elements/gp.php?GROUP=<g>&FORMAT=json
           idb.put({group, fetchedAt: now, records})
      catch: if !cached: rethrow; else mark 'stale' (UI banner)
  })
  merged = dedupe by NORAD_CAT_ID (stations wins) over both groups
  return catalog.map(entry => find(merged, entry.noradId)) — missing entries logged + reported to UI as "unavailable"
```

- Response validated with a zod schema; individual bad records are dropped, not fatal.
- `fetchedAt` is the *client* clock at fetch time; epoch age (FR-SAT-4) uses `omm.EPOCH`.
- Background refresh: `effects.ts` schedules a re-check every 15 min while the tab is visible; the 2 h rule is enforced in the loader, not the timer.
- Offline: if IndexedDB throws (Safari private mode), fall back to an in-memory cache for the session and show the "not cached" banner.

### 7.2 Geocoding (`data/openMeteo/geocode.ts`)

`GET https://geocoding-api.open-meteo.com/v1/search?name=<q>&count=8&language=en&format=json`.
Debounced 500 ms in the input component; results memoised per normalised query.
Each result maps to `Place { name, admin1, country, lat, lon, elevationM, timeZone }`.
Selecting a place produces an `Observer { source: 'geocode', label: "name, admin1, country", timeZone }`.

### 7.3 Weather (`data/openMeteo/forecast.ts`)

`GET https://api.open-meteo.com/v1/forecast?latitude=&longitude=&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&forecast_days=4&timezone=auto&timeformat=unixtime`.
Four variables and, since v1, four days → one API call per fetch (it was three days in the MVP; §7.6).
Cached 30 min per 0.1° cell (FR-WX-5).
The response's `timezone` fills `Observer.timeZone` when the observer came from coordinates or the device (D-3).

`lib/cloudVerdict.ts`: linear interpolation of each layer to the pass peak time between the two bracketing hours; `effective = max(low, mid, 0.7·high)` when layers are present (D-1028), else `total`; states at < 30 / 30–70 / > 70 %.
Missing snapshot → `unknown`.

### 7.4 Catalog (`data/catalog/catalog.json`)

Validated at build time by `schema.ts` (zod) in a Vitest test, so a malformed entry fails CI.
`scripts/check-catalog.ts` (manual / scheduled, live network) confirms every `noradId` is present in `visual` or `stations` and prints the ones that are not, so decayed objects get removed.
Initial membership is OQ-2 and is produced during Task Zero.

### 7.5 Stored passes *(v1, FR-OFF-2/4/5, D-78)*

`data/passesCache.ts` owns the `passRuns` IndexedDB store.

```
onJobDone(job):                                   # every successful compute, no user action (FR-OFF-5)
  put({ cellKey: cell(observer), observer, window, computedAt: now,
        newestElementsEpochMs, hasDarkness, passes })
  prune to the two most recent runs

loadForObserver(observer):
  return get(cell(observer)) or null                 # expired or not: expired runs are shown as stored, with their age (D-105)
```

- `cell(observer)` rounds latitude and longitude to 0.01°.
  A pass looks the same anywhere inside that cell, which is the same argument §2.2 of the spec makes about city-level geocoding.
- Offline start-up order: prefs → stored run for the last observer → render the list from it → try the network.
  `startApp` restores the saved observer *before* wiring the effects, and the effects run the same chain for it as for a typed one, which is what puts the stored run in front of the first request.
  With no network the list is what was stored, and `ReadinessLine.tsx` says how old it is.
- The stored list is a finished list with `storedAt` set (`state/slices/passes.ts`).
  A job for the same location keeps it on screen instead of blanking, until its first `passes` message replaces it; a job that ends having emitted nothing clears it (D-105).
- `lib/readiness.ts` computes `Readiness` from the run and the stored forecast: `offlineUntil = min(last pass end, forecast end)`, `missing` naming whichever of elements, forecast or passes is absent (FR-OFF-4).
- The store holds passes, not satrecs; a recompute for a *new* observer still needs the elements from the `elementGroups` store, which is what FR-X-4 has always required.

### 7.6 Forecast, offline behaviour *(v1, FR-OFF-3)*

`forecast_days` goes from 3 to 4 so the response covers the 72 h window with a margin; the query is otherwise unchanged, still one call per fetch.
The snapshot is persisted (it already was, in `localStorage` under `wiys:wx:v1`) and, when the network fails, is used past its 30 min TTL with `fetchedAt` shown on the badge as "as of <time>".
Hours past the response's end are `unknown`, exactly as a missing snapshot is.
Online behaviour and the 30 min TTL are unchanged (FR-WX-5): a snapshot past the TTL is refetched every time, and the stored one is handed back only on the failure branch.
Eviction moves from the TTL to `FORECAST_DAYS × 24 h`, the span a response covers (D-106).

### 7.7 Service worker and manifest *(v1, FR-OFF-1/6, D-79)*

`vite-plugin-pwa`, `generateSW`, `registerType: 'prompt'`, `runtimeCaching: []`, `navigateFallback: 'index.html'`.
The precache list is the build output plus the braille font, the manifest and the icons.
Registration happens in `main.tsx` after the first render, and only in production builds.

*(R25)* "Registration" is `state/serviceWorker.ts` over the plain `navigator.serviceWorker` API, not the plugin's `virtual:pwa-register` (D-126); `main.tsx` calls it on `load`, so the precache never competes with the first paint.
The generated worker is `dist/sw.js` at the site root, on its own 15 KB budget (§11).

- **Update (OQ-14).**
  A waiting worker sets a store flag; `UpdateBanner.tsx` offers "new version ready — reload"; the button posts `SKIP_WAITING` and reloads.
  Nothing swaps under a running live page.
  *(R25)* The flag is the `appUpdate` slice: `updateReady`, and `applyUpdate`, the function the registration puts there and the banner is the only caller of (D-126).
- **Data requests are never intercepted.**
  With `runtimeCaching: []` Workbox generates no fetch handler for cross-origin requests, so CelesTrak and Open-Meteo responses reach the network or fail, and their caching stays in IndexedDB where FR-SAT-6 and FR-WX-5 put it.
  A test asserts the generated `sw.js` contains no `registerRoute` for those hosts.
- **Manifest.**
  One name in one language (FR-OFF-6 says it is not localised), `display: standalone`, the dark theme colour, icons at 192 and 512 px.
  `InstallHint.tsx` shows on `beforeinstallprompt`, and on iOS — where that event never fires — shows the "Add to Home Screen" note instead, keyed off `navigator.standalone` being defined and false.
  The answer is remembered in prefs: installing ends the offer, "Not now" snoozes it for `INSTALL_SNOOZE_DAYS` and the decline past the last entry ends it (D-272, FR-OFF-6 as amended v1.1.2).
  The settings page carries the same action with no decline, unaffected by either (D-260, V11-16).

### 7.8 Moon lore *(v1, FR-MOON-4/5, D-80, D-97)*

*(v1.1)* Loaded only when `MOON_LORE` is on (D-183); the file and its schema are unchanged.

### 7.9 Prefs additions *(v1.1)*

`chartView` accepts `'window'` (D-188) and is validated by the existing prefs schema so an old value falls back to the default.
Nothing else is stored: the settings page (D-184) writes through the slices the components already use.

`data/moon/lore.json`, one hand-reviewed file in the catalog's style: the twelve tropical signs (key, `startLonDeg`, name, one line), the twelve folk full-moon names by calendar month under a Northern-hemisphere note, and one line per phase of FR-MOON-1 — every one of them in both languages, every one with a `{ source, date, note }` provenance.
`data/moon/schema.ts` (zod) fixes the order and the bands of the signs, the month numbers and the phase keys; `lore.test.ts` validates the file in CI the way `catalog.test.ts` validates the catalog and gates the wording (FR-MOON-5, FR-I18N-3).
`data/moon/index.ts` exposes `MOON_LORE`, `signAtLongitude`, `signByKey`, `fullMoonName` and `phaseLore` — lookups over the file, never a computation.
The lore reaches the UI through `src/state`, as the catalog does (§3 keeps `src/lib` and `src/ui` out of `src/data`).

---
