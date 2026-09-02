# Heavens-Above fixtures (Task Zero, TASKS R1)

Hand-transcribed ISS visible-pass predictions from heavens-above.com for the
spike observer, used by `scripts/validate-iss.ts` and
`src/physics/passes.golden.test.ts`. Fixtures are dated and immutable
(PLAN §9.3): a re-capture is a new dated file, never an edit.

## Capture log

| Fixture | `capturedAt` (UTC) | `haEpoch` (Heavens-Above orbit page) | OMM fixture | `fetchedAt` (UTC) | ISS `EPOCH` (UTC) | Epoch gap | Result |
|---|---|---|---|---|---|---|---|
| `2026-09-02-neuquen-iss.json` | 2026-09-02T03:51Z | 2026-09-01T11:57:51Z | `2026-09-02` | 2026-09-02T03:27:20Z | 2026-09-01T19:42:22.677120 | 7.7 h (< 1 day) | **OVERALL: PASS** — 1 pass paired, 0 unpaired, 0 extras |

Result of `npx tsx scripts/validate-iss.ts` on 2026-09-02:

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

## Filters text (copied from Heavens-Above, step 2)

`PassSummary.aspx?satid=25544`, 2026-09-02T03:51Z:

> Search period start: 02 September 2026 00:00
> Search period end: 12 September 2026 00:00
> Orbit: 416 x 423 km, 51.6° (Epoch: 1 September)
> Passes to include: visible only | all
> Click on the date to get a star chart and other pass details.

The page states no altitude or brightness cutoff in words. The Start and End columns are the 10° crossings,
and the detail page labels them "Reaches altitude 10°" / "Drops below altitude 10°".

## Extras (step 13)

Passes we list that Heavens-Above omits, one bullet each, with the reason.
Machine-readable copy in `<date>-neuquen-iss.extras.json` as
`[{ "peak": "<ISO UTC>", "reason": "<text>" }]`; the golden test fails on any
extra that is not listed there.

- 2026-09-02 capture: none.

## Fixture shape

`tests/fixtures/heavens-above/<YYYY-MM-DD>-neuquen-iss.json`:

```json
{
  "capturedAt": "2026-09-02T03:51Z",
  "observer": { "lat": -38.93, "lon": -67.99, "altM": 0 },
  "timeZone": "UTC",
  "haEpoch": "2026-09-01T11:57:51Z",
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
  `exitsShadow` only when present. The two placeholder rows above are illustrative.
- `summary` is optional. When absent, the comparison uses the later of
  `reaches10` / `exitsShadow` as the start row and the earlier of `drops10` /
  `entersShadow` as the end row, which is how Heavens-Above fills its summary
  table's Start / End columns. Set it explicitly when the summary shows something else.

## Procedure (reproduced from TASKS.md R1)

1. **Set the observer.** On heavens-above.com open *Change your observing location*. Enter latitude `-38.93`, longitude `-67.99`, elevation `0` m, name `Neuquen (spike)`. Set the time-zone selector to **UTC** (listed as UTC / GMT, no DST). Submit and confirm the page header shows the coordinates and "Time zone: UTC". All later pages read these settings from the site cookie.
2. **Open the ISS visible-pass list.** Go to *Satellites → ISS → 10-day predictions for passes* (`PassSummary.aspx?satid=25544`). Leave **Visible only** selected (the default). Copy into this README the page's own wording on its filters (the altitude cutoff at 10° and any brightness cutoff) so extras can be explained against it later.
3. **Record the capture time** `capturedAt` (UTC, to the minute) *before* transcribing anything. The comparison window is `[capturedAt, capturedAt + 10 days]`.
4. **Transcribe every pass from its detail page, by hand.** Heavens-Above prohibits scraping. For each row of the summary table click through to `PassDetails.aspx` and record: the date, the brightness (mag), and, for every event row present, the time (HH:MM:SS UTC), altitude (°) and azimuth (° with compass letters). Event rows are: *Rises*, *Reaches altitude 10°*, *Maximum altitude*, *Drops below altitude 10°*, *Sets*, and *Enters shadow* or *Exits shadow* when they apply. **Azimuths must come from the detail page in degrees.** The summary table shows 16-point compass letters (±11.25°), which is too coarse for the 5° criterion.
5. **Record the elements Heavens-Above is using.** Open *ISS → Orbit* (`orbit.aspx?satid=25544`) and note the element epoch shown there as `haEpoch`.
6. **Save the fixture** as `tests/fixtures/heavens-above/<YYYY-MM-DD>-neuquen-iss.json` with the shape `{ capturedAt, observer: { lat, lon, altM }, timeZone: "UTC", haEpoch, filtersText, passes: [ { date, magnitude, events: { rises?, reaches10?, max, drops10?, sets?, entersShadow?, exitsShadow? } } ] }`, each event `{ t, altDeg, azDeg, compass }`. A re-capture is a new dated file, never an edit.
7. **Capture elements within the same hour** as step 3:
   ```
   curl -sS 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json' -o tests/fixtures/omm/<YYYY-MM-DD>-stations.json
   curl -sS 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=json'   -o tests/fixtures/omm/<YYYY-MM-DD>-visual.json
   ```
   Write `fetchedAt` and the `EPOCH` of NORAD 25544 into `tests/fixtures/omm/<YYYY-MM-DD>.meta.json` and into this README. If `haEpoch` and that `EPOCH` differ by more than one day, re-capture both sides together (PLAN §10.1 step 2).
8. **Run the pipeline** with `npx tsx scripts/validate-iss.ts`: `findPasses` for NORAD 25544 over the window from step 3, observer from step 1, `minElevationDeg = 10`, `sunAltMaxDeg = -6`, `twilightLabelSunAltDeg = -12`, **no magnitude cut** (brightness is compared separately). The script reads only the committed fixtures; it never fetches.
9. **Map the three comparison points.** Our `start` pairs with the Heavens-Above event that begins the visible pass: *Reaches altitude 10°*, or *Exits shadow* / *Rises* when the summary table's Start column matches that row instead. Our `peak` pairs with *Maximum altitude*. Our `end` pairs with *Drops below altitude 10°* or *Enters shadow*, whichever the summary's End column matches. The row used for `end` is Heavens-Above's implied end reason (`horizon` vs `shadow`) and is compared with our `endReason`.
10. **Pair passes** by peak time, nearest within ±15 min. Print unpaired passes on both sides.
11. **Compare** each pair: |Δt| at start / peak / end, |Δaz| (wrapped to ≤ 180°) and |Δel| at each. A pass **passes** when every |Δt| ≤ 60 s and every |Δaz|, |Δel| ≤ 5°. Print one table row and PASS/FAIL per pass, then `OVERALL: PASS` or `OVERALL: FAIL`.
12. **Brightness (informational).** Print our `peakMagnitude` beside Heavens-Above's listed magnitude per pass, to sanity-check D-1 and the ISS `stdMag` seed value (use −1.8 as the seed pending R3's provenance work; record the value actually used). The script uses **−1.8** (`ISS_STD_MAG_SEED` in `tests/support/heavensAbove.ts`).
13. **Explain every extra.** Any pass we list that Heavens-Above omits is documented per pass in this README (e.g. `twilight = true` and Heavens-Above applies a stricter sun rule; or peak magnitude fainter than their cut). Unexplained extras fail the spike.
14. **If it fails,** follow PLAN §10.3 in order: time base (single propagated ECI position against satellite.js's own test vector; ms↔JD; `EPOCH` parsed as UTC) → frames (GMST, east-positive longitude in radians) → sun-vector frame (declination check for the date) → shadow-entry offsets (revisit D-8 only with evidence) → element-epoch mismatch (re-capture together).

After a green run, pin the intermediate values: `npx tsx scripts/validate-iss.ts --write-reference`
writes `tests/fixtures/reference-values.json`, which `src/physics/reference.test.ts` checks from then on.
