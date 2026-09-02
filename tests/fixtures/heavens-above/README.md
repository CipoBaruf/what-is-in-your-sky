# Heavens-Above fixtures (Task Zero, TASKS R1; extended in TASKS H)

Hand-transcribed ISS visible-pass predictions from heavens-above.com for three
observers, used by `scripts/validate-iss.ts` and
`src/physics/passes.golden.test.ts`. Fixtures are dated and immutable
(PLAN §9.3): a re-capture is a new dated file, never an edit.

Fixture files are named `<YYYY-MM-DD>-<place>-iss.json`. Run one with
`npx tsx scripts/validate-iss.ts --fixture <name>` (a bare date names the R1
Neuquén fixture of that date) or all of them with `--all`.

| Place | Observer | Why |
|---|---|---|
| `neuquen` | 38.93° S, 67.99° W, 0 m | R1 spike observer, southern mid-latitude |
| `paris` | 48.86° N, 2.35° E, 0 m | H: northern mid-latitude (45–52° N); September evening passes end in shadow, morning passes start from shadow, so D-8 is exercised |
| `singapore` | 1.35° N, 103.82° E, 0 m | H: within ±5° of the equator |

## Capture log

| Fixture | `capturedAt` (UTC) | `haEpoch` (Heavens-Above orbit page) | OMM fixture | `fetchedAt` (UTC) | ISS `EPOCH` (UTC) | Epoch gap | Result |
|---|---|---|---|---|---|---|---|
| `2026-09-02-neuquen-iss.json` | 2026-09-02T03:51Z | 2026-09-01T11:57:51Z | `2026-09-02` | 2026-09-02T03:27:20Z | 2026-09-01T19:42:22.677120 | 7.7 h (< 1 day) | **OVERALL: PASS** — 1 pass paired, 0 unpaired, 0 extras |
| `2026-09-02-paris-iss.json` | 2026-09-02T13:27Z | 2026-09-02T03:26:53Z | `2026-09-02T13` | 2026-09-02T13:27:43Z | 2026-09-02T03:26:53.784384 | 0.0 h (same element set) | **OVERALL: PASS** — 12 passes paired, 0 unpaired, 0 extras |
| `2026-09-02-singapore-iss.json` | 2026-09-02T13:28Z | 2026-09-02T03:26:53Z | `2026-09-02T13` | 2026-09-02T13:27:43Z | 2026-09-02T03:26:53.784384 | 0.0 h (same element set) | **OVERALL: PASS** — 7 passes paired, 0 unpaired, 0 extras |

The second OMM capture of the day is named `2026-09-02T13` (capture hour appended) because the
`2026-09-02` name was already taken by the R1 capture and fixtures are never overwritten. Each
Heavens-Above fixture names its OMM capture in its `ommFixture` field.

### 2026-09-02 Neuquén (R1)

Result of `npx tsx scripts/validate-iss.ts --fixture 2026-09-02-neuquen-iss` on 2026-09-02:

```
HA peak (UTC)        | start Δt  Δaz  Δel | peak  Δt  Δaz  Δel | end   Δt  Δaz  Δel | end reason (ours/HA) | mag ours/HA | result
2026-09-11T09:48:39  |     -4s  0.6   0.0 |     -1s  0.3   0.2 |      3s  1.0   0.0 | horizon/horizon      |   1.2/-0.3 | PASS
```

Notes on the 2026-09-02 capture:

- Heavens-Above's summary table and detail page disagree with each other by up to 5 s for the same pass
  (summary 09:48:13 / 09:49:03, detail 09:48:18 / 09:48:59). The detail page is the authority (step 4);
  the summary row is kept in the fixture under `summaryTable` for reference only.
- The detail page prints altitudes as whole degrees, so Δel is only meaningful to ±0.5°.
- Heavens-Above's own search window was 02 Sep 00:00 to 12 Sep 00:00 UTC; ours is `[capturedAt, +10 d]`.
  The single pass lies inside both.
- Only one visible pass exists in this window (every other culmination above 10° is in daylight), so the
  spike is validated on one pass, and that pass is horizon-bounded at both ends, so the shadow model (D-8)
  was **not** exercised against Heavens-Above. See PLAN §2.1 for what was checked instead.
- Brightness (informational): ours +1.2 with `stdMag = −1.8`, Heavens-Above −0.3 at the same point
  (−0.1 at maximum altitude). A 1.3–1.5 mag offset at a 1 505 km range and a back-lit geometry is
  worth revisiting in R3 when the `stdMag` provenance is settled; the acceptance criterion does not include brightness.

### 2026-09-02 Paris (H)

Result of `npx tsx scripts/validate-iss.ts --fixture 2026-09-02-paris-iss` on 2026-09-02:

```
Window: 2026-09-02T13:27:00.000Z .. 2026-09-12T00:00:00.000Z

HA peak (UTC)        | start Δt  Δaz  Δel | peak  Δt  Δaz  Δel | end   Δt  Δaz  Δel | reasons ours/HA (start, end)   | mag ours/HA | result
---------------------|--------------------|--------------------|--------------------|--------------------------------|-------------|-------
2026-09-03T03:08:10  |     -4s  3.3  -4.2 |      1s  1.0  -0.2 |      0s  0.4   0.1 | shadow/shadow, horizon/horizon |  -4.3/-3.9 | PASS
2026-09-04T02:23:07  |     -4s  0.4   0.7 |     -4s  0.4   0.7 |      1s  0.3   0.0 | shadow/shadow, horizon/horizon |  -1.0/-1.3 | PASS
2026-09-04T03:57:21  |     -5s  2.3  -0.5 |      0s  0.0   0.1 |      0s  0.1   0.1 | shadow/shadow, horizon/horizon |  -3.4/-2.8 | PASS
2026-09-05T03:11:45  |     -5s  1.3   1.2 |     -5s  1.3   1.2 |     -0s  0.0   0.1 | shadow/shadow, horizon/horizon |  -2.4/-2.1 | PASS
2026-09-07T19:54:55  |     -0s  0.5   0.0 |      6s  0.9   0.6 |      6s  0.9   0.6 | horizon/horizon, shadow/shadow |  -1.6/-1.2 | PASS
2026-09-08T19:10:03  |      0s  0.6   0.0 |      0s  0.1   0.3 |      6s  1.8  -0.1 | horizon/horizon, shadow/shadow |  -2.3/-1.7 | PASS
2026-09-08T20:43:31  |      1s  0.4   0.0 |      6s  0.7   0.5 |      6s  0.7   0.5 | horizon/horizon, shadow/shadow |  -1.2/-1.2 | PASS
2026-09-09T19:58:44  |      1s  0.1   0.0 |      5s  3.3  -0.1 |      5s  3.3  -0.1 | horizon/horizon, shadow/shadow |  -3.8/-3.3 | PASS
2026-09-10T19:11:31  |      0s  0.2   0.0 |      1s  0.3   0.3 |      5s  1.2  -0.7 | horizon/horizon, shadow/shadow |  -3.2/-2.7 | PASS
2026-09-10T20:46:39  |      0s  0.4   0.0 |      4s  0.0   1.3 |      4s  0.0   1.3 | horizon/horizon, shadow/shadow |  -1.9/-2.1 | PASS
2026-09-11T20:00:37  |      0s  0.4   0.0 |      0s  0.5  -0.2 |      4s  0.8  -2.6 | horizon/horizon, shadow/shadow |  -4.2/-3.9 | PASS
2026-09-11T21:34:20  |      0s  0.2   0.0 |      4s  0.2   0.7 |      4s  0.2   0.7 | horizon/horizon, shadow/shadow |   0.4/-0.4 | PASS

Heavens-Above passes outside the comparison window (not compared): 2
No unpaired Heavens-Above passes.
No extra passes.

OVERALL: PASS
```

Notes on the Paris capture:

- Heavens-Above's search period was 02 Sep 00:00 to 12 Sep 00:00 UTC; the capture was made at 13:27 UTC, so
  the two passes of 2 Sep 02:19 and 03:52 UTC precede `capturedAt` and are outside the comparison window.
  They are listed in the fixture under `passesBeforeCapturedAt` and in `summaryTable` but were not
  transcribed from their detail pages. The comparison window is `[capturedAt, capturedAt + 10 d]` clipped to
  the fixture's `searchPeriod`, so nothing after 12 Sep 00:00 can appear as an extra either.
- **Shadow boundaries, first comparison against Heavens-Above (D-8):** every one of the 12 passes has one
  shadow boundary. On the four morning passes we leave the shadow 4–5 s *earlier* than Heavens-Above; on the
  eight evening passes we enter it 4–6 s *later*. The sign is consistent with our umbra being slightly narrower
  than theirs (cylinder of 6371.0 km with no atmosphere versus, most likely, a larger effective radius or a
  penumbra midpoint). At ISS speed the offset is ≈ 30–45 km along track. It is a small fraction of the 60 s
  criterion; recorded in PLAN §2.4 for a future decision, not changed here.
- **Passes with no "Maximum altitude" row.** When the highest point coincides with the start or the end
  (a shadow boundary above 10°), the detail page omits the *Maximum altitude* row and the summary's Highest
  column repeats the higher of the two. The fixture leaves `max` out in that case and the comparison uses
  the higher of start / end (end on a tie) as the peak; `summary.highest` can override it.
- **Two passes visible for 1–2 s** (7 Sep 19:54:54–55, 11 Sep 21:34:18–20: the ISS reaches 10° and enters
  the shadow almost at once). Our 1 s dense grid catches both, with the start on the 10° crossing and the end on
  the last lit sample; they pair within 6 s. Nothing in the comparison special-cases them.
- Brightness (informational, `stdMag = −1.8`): for high passes we are 0.3–0.6 mag *brighter* than
  Heavens-Above (e.g. −4.3 vs −3.9), for low, distant passes we are up to 0.8 mag *fainter* (11 Sep 21:34,
  +0.4 vs −0.4). Heavens-Above's magnitude varies less with range and phase than the D-1 form does. Same
  picture as Singapore below; see PLAN §2.4.

### 2026-09-02 Singapore (H)

Result of `npx tsx scripts/validate-iss.ts --fixture 2026-09-02-singapore-iss` on 2026-09-02:

```
Window: 2026-09-02T13:28:00.000Z .. 2026-09-12T00:00:00.000Z

HA peak (UTC)        | start Δt  Δaz  Δel | peak  Δt  Δaz  Δel | end   Δt  Δaz  Δel | reasons ours/HA (start, end)   | mag ours/HA | result
---------------------|--------------------|--------------------|--------------------|--------------------------------|-------------|-------
2026-09-03T11:57:08  |      1s  0.5   0.0 |      0s  0.5  -0.2 |      5s  1.5  -0.8 | horizon/horizon, shadow/shadow |  -3.3/-2.8 | PASS
2026-09-04T12:46:20  |     -0s  0.1   0.0 |      1s  0.1  -0.4 |      6s  2.2  -0.4 | horizon/horizon, shadow/shadow |  -0.1/-1.2 | PASS
2026-09-05T11:58:57  |      1s  0.3   0.0 |      1s  0.5   0.2 |      1s  0.3   0.1 | horizon/horizon, horizon/horizon |  -2.0/-2.6 | PASS
2026-09-07T21:59:47  |     -0s  0.3   0.0 |      1s  0.2   0.3 |      1s  0.0   0.0 | horizon/horizon, horizon/horizon |  -0.3/-1.4 | PASS
2026-09-08T21:12:21  |     -0s  0.4   0.0 |      1s  0.5   0.4 |      1s  0.2   0.0 | horizon/horizon, horizon/horizon |   0.8/-0.5 | PASS
2026-09-09T22:01:32  |     -4s  1.0  -1.3 |      1s  0.4   0.5 |     -0s  0.3   0.1 | shadow/shadow, horizon/horizon |  -4.2/-3.7 | PASS
2026-09-10T21:16:16  |     -3s  0.0   1.2 |     -3s  0.0   1.2 |      0s  0.2   0.1 | shadow/shadow, horizon/horizon |  -0.8/-1.3 | PASS

Heavens-Above passes outside the comparison window (not compared): 1
No unpaired Heavens-Above passes.
No extra passes.

OVERALL: PASS
```

Notes on the Singapore capture:

- The 2 Sep 12:41 UTC pass precedes `capturedAt` (13:28 UTC) and is outside the window (see Paris).
- 8 Sep: the ISS *exits shadow* at 9° (21:10:42) and *reaches 10°* 29 s later; the summary's Start column is
  the 10° row, which is what the default start rule (later of `reaches10` / `exitsShadow`) picks. 5 Sep: it
  *drops below 10°* at 12:02:09 and *enters shadow* at 1° two minutes later; the End column is the 10° row
  (earlier of `drops10` / `entersShadow`). Both implied reasons are `horizon` and match ours.
- Shadow boundaries show the same offsets as Paris: exit 3–4 s early, entry 5–6 s late.
- Brightness (informational): low passes again come out fainter than Heavens-Above by up to 1.3 mag
  (8 Sep +0.8 vs −0.5), high passes 0.5 mag brighter.

## Filters text (copied from Heavens-Above, step 2)

`PassSummary.aspx?satid=25544`, 2026-09-02T03:51Z (Neuquén):

> Search period start: 02 September 2026 00:00
> Search period end: 12 September 2026 00:00
> Orbit: 416 x 423 km, 51.6° (Epoch: 1 September)
> Passes to include: visible only | all
> Click on the date to get a star chart and other pass details.

The page states no altitude or brightness cutoff in words. The Start and End columns are the 10° crossings,
and the detail page labels them "Reaches altitude 10°" / "Drops below altitude 10°".

Paris and Singapore, 2026-09-02T13:27Z / 13:28Z: identical wording with `Orbit: 416 x 423 km, 51.6° (Epoch: 2 September)`
and the same search period (02 Sep 00:00 to 12 Sep 00:00). Where a pass starts or ends at a shadow boundary the
Start / End column shows the *Exits shadow* / *Enters shadow* row instead of the 10° crossing.

## Extras (step 13)

Passes we list that Heavens-Above omits, one bullet each, with the reason.
Machine-readable copy in `<date>-neuquen-iss.extras.json` as
`[{ "peak": "<ISO UTC>", "reason": "<text>" }]`; the golden test fails on any
extra that is not listed there.

- 2026-09-02 Neuquén capture: none.
- 2026-09-02 Paris capture: none.
- 2026-09-02 Singapore capture: none.

## Fixture shape

`tests/fixtures/heavens-above/<YYYY-MM-DD>-<place>-iss.json` (`<place>` is lower-case letters and digits):

```json
{
  "capturedAt": "2026-09-02T03:51Z",
  "location": "Neuquen (spike)",
  "observer": { "lat": -38.93, "lon": -67.99, "altM": 0 },
  "timeZone": "UTC",
  "haEpoch": "2026-09-01T11:57:51Z",
  "ommFixture": "2026-09-02",
  "searchPeriod": { "start": "2026-09-02T00:00Z", "end": "2026-09-12T00:00Z" },
  "filtersText": "…the page's own wording on the 10° altitude cutoff and any brightness cutoff…",
  "passes": [
    {
      "date": "2026-09-11",
      "magnitude": 1.2,
      "events": {
        "rises":        { "t": "2026-09-11T09:45:30Z", "altDeg": 0,    "azDeg": 33,  "compass": "NNE" },
        "reaches10":    { "t": "2026-09-11T09:48:14Z", "altDeg": 10,   "azDeg": 46,  "compass": "NE"  },
        "max":          { "t": "2026-09-11T09:48:38Z", "altDeg": 10.2, "azDeg": 53,  "compass": "NE"  },
        "drops10":      { "t": "2026-09-11T09:49:02Z", "altDeg": 10,   "azDeg": 60,  "compass": "ENE" },
        "sets":         { "t": "2026-09-11T09:51:40Z", "altDeg": 0,    "azDeg": 74,  "compass": "ENE" },
        "entersShadow": { "t": "…", "altDeg": 0, "azDeg": 0, "compass": "…" },
        "exitsShadow":  { "t": "…", "altDeg": 0, "azDeg": 0, "compass": "…" }
      },
      "summary": { "start": "reaches10", "end": "drops10" }
    }
  ]
}
```

- Every event `t` is a full ISO 8601 UTC timestamp (not just HH:MM:SS), so a
  pass that crosses midnight is unambiguous. `date` is the date Heavens-Above prints.
- Include only the event rows the detail page shows; `entersShadow` /
  `exitsShadow` only when present, and `max` only when the page has a
  *Maximum altitude* row. The two placeholder rows above are illustrative.
- `summary` is optional. When absent, the comparison uses the later of
  `reaches10` / `exitsShadow` as the start row and the earlier of `drops10` /
  `entersShadow` as the end row, which is how Heavens-Above fills its summary
  table's Start / End columns; the peak is `max`, or without it the higher of
  start / end (end on a tie). Set `summary.start` / `highest` / `end` explicitly
  when the summary shows something else.
- `location` is the observer name entered on Heavens-Above (step 1); `ommFixture`
  names the OMM capture to pair with (defaults to the fixture date); `searchPeriod`
  is the page header's search period and clips the comparison window. The R1
  fixture predates the three fields and relies on the defaults.
- Only passes inside the comparison window need detail-page transcription; list
  the others in `passesBeforeCapturedAt` so the summary table stays complete.

## Procedure (reproduced from TASKS.md R1)

1. **Set the observer.** On heavens-above.com open *Change your observing location*. Enter latitude `-38.93`, longitude `-67.99`, elevation `0` m, name `Neuquen (spike)` (for another observer: its coordinates, elevation `0` and `<Place> (spike)`). Set the time-zone selector to **UTC** (listed as UTC / GMT, no DST). Submit and confirm the page header shows the coordinates and "Time zone: UTC". All later pages read these settings from the site cookie. (Every page also accepts the same settings as query parameters, `?lat=&lng=&loc=&alt=0&tz=UCT`, which is how the H captures were made.)
2. **Open the ISS visible-pass list.** Go to *Satellites → ISS → 10-day predictions for passes* (`PassSummary.aspx?satid=25544`). Leave **Visible only** selected (the default). Copy into this README the page's own wording on its filters (the altitude cutoff at 10° and any brightness cutoff) so extras can be explained against it later.
3. **Record the capture time** `capturedAt` (UTC, to the minute) *before* transcribing anything. The comparison window is `[capturedAt, capturedAt + 10 days]`.
4. **Transcribe every pass from its detail page, by hand.** Heavens-Above prohibits scraping. For each row of the summary table click through to `PassDetails.aspx` and record: the date, the brightness (mag), and, for every event row present, the time (HH:MM:SS UTC), altitude (°) and azimuth (° with compass letters). Event rows are: *Rises*, *Reaches altitude 10°*, *Maximum altitude*, *Drops below altitude 10°*, *Sets*, and *Enters shadow* or *Exits shadow* when they apply. **Azimuths must come from the detail page in degrees.** The summary table shows 16-point compass letters (±11.25°), which is too coarse for the 5° criterion.
5. **Record the elements Heavens-Above is using.** Open *ISS → Orbit* (`orbit.aspx?satid=25544`) and note the element epoch shown there as `haEpoch`.
6. **Save the fixture** as `tests/fixtures/heavens-above/<YYYY-MM-DD>-<place>-iss.json` with the shape `{ capturedAt, location, observer: { lat, lon, altM }, timeZone: "UTC", haEpoch, ommFixture, searchPeriod, filtersText, passes: [ { date, magnitude, events: { rises?, reaches10?, max?, drops10?, sets?, entersShadow?, exitsShadow? } } ] }`, each event `{ t, altDeg, azDeg, compass }`. A re-capture is a new dated file, never an edit.
7. **Capture elements within the same hour** as step 3:
   ```
   curl -sS 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json' -o tests/fixtures/omm/<YYYY-MM-DD>-stations.json
   curl -sS 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json'   -o tests/fixtures/omm/<YYYY-MM-DD>-visual.json
   ```
   Write `fetchedAt` and the `EPOCH` of NORAD 25544 into `tests/fixtures/omm/<YYYY-MM-DD>.meta.json` and into this README. If `haEpoch` and that `EPOCH` differ by more than one day, re-capture both sides together (PLAN §10.1 step 2). If an OMM capture of that date already exists, append the capture hour to the name (`<YYYY-MM-DD>T<HH>`) and point the fixture's `ommFixture` at it; never overwrite.
8. **Run the pipeline** with `npx tsx scripts/validate-iss.ts --fixture <name>`: `findPasses` for NORAD 25544 over the window from step 3, observer from step 1, `minElevationDeg = 10`, `sunAltMaxDeg = -6`, `twilightLabelSunAltDeg = -12`, **no magnitude cut** (brightness is compared separately). The script reads only the committed fixtures; it never fetches.
9. **Map the three comparison points.** Our `start` pairs with the Heavens-Above event that begins the visible pass: *Reaches altitude 10°*, or *Exits shadow* / *Rises* when the summary table's Start column matches that row instead. Our `peak` pairs with *Maximum altitude*. Our `end` pairs with *Drops below altitude 10°* or *Enters shadow*, whichever the summary's End column matches. The row used for `end` is Heavens-Above's implied end reason (`horizon` vs `shadow`) and is compared with our `endReason`.
10. **Pair passes** by peak time, nearest within ±15 min. Print unpaired passes on both sides.
11. **Compare** each pair: |Δt| at start / peak / end, |Δaz| (wrapped to ≤ 180°) and |Δel| at each. A pass **passes** when every |Δt| ≤ 60 s and every |Δaz|, |Δel| ≤ 5°. Print one table row and PASS/FAIL per pass, then `OVERALL: PASS` or `OVERALL: FAIL`.
12. **Brightness (informational).** Print our `peakMagnitude` beside Heavens-Above's listed magnitude per pass, to sanity-check D-1 and the ISS `stdMag` seed value (use −1.8 as the seed pending R3's provenance work; record the value actually used). The script uses **−1.8** (`ISS_STD_MAG_SEED` in `tests/support/heavensAbove.ts`).
13. **Explain every extra.** Any pass we list that Heavens-Above omits is documented per pass in this README (e.g. `twilight = true` and Heavens-Above applies a stricter sun rule; or peak magnitude fainter than their cut). Unexplained extras fail the spike.
14. **If it fails,** follow PLAN §10.3 in order: time base (single propagated ECI position against satellite.js's own test vector; ms↔JD; `EPOCH` parsed as UTC) → frames (GMST, east-positive longitude in radians) → sun-vector frame (declination check for the date) → shadow-entry offsets (revisit D-8 only with evidence) → element-epoch mismatch (re-capture together).

After a green run of the R1 fixture, pin the intermediate values: `npx tsx scripts/validate-iss.ts --fixture 2026-09-02 --write-reference`
writes `tests/fixtures/reference-values.json`, which every `src/physics/*.test.ts` checks from then on
(each module its own slice, `reference.test.ts` the whole pipeline). Regenerate only when a physics change
is intended and the golden test still passes.
