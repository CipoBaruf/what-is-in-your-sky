# Star and planet positions (v2.4, FR-STAR-2)

What `skyStars.test.ts` holds the app to: at each of the three R1 sites, at one instant, twelve stars spread around the sky and the five naked-eye planets. Every value must be within `STAR_TOLERANCE_DEG` (0.25°). The owner reads the values from a published ephemeris, so they are independent of the code under test. The app's own numbers never go in these files.

| File | Site | Instant (UTC) | Local |
|---|---|---|---|
| `neuquen-2026-11-01T0200Z.json` | Neuquén, −38.93, −67.99 | 2026-11-01 02:00 | 31 Oct, 23:00 |
| `paris-2026-11-01T2100Z.json` | Paris, 48.86, 2.35 | 2026-11-01 21:00 | 1 Nov, 22:00 |
| `singapore-2026-11-01T1400Z.json` | Singapore, 1.35, 103.82 | 2026-11-01 14:00 | 1 Nov, 22:00 |

The stars were chosen from the vendored catalogue (`data-src/stars/`): the brightest named star in each 30° of azimuth at 12° or more above the horizon, topped up with the next brightest. The `hr`, designation and J2000 coordinates are only there to find the star. The planets are listed whether they are up or not: a negative altitude is a value too.

## Filling a file in Stellarium (desktop)

1. **Location** (F6): enter the latitude and longitude exactly as in the table, altitude 0 m.
2. **Date and time** (F5): set the instant in UTC. Either choose UTC as the time zone (Configuration → Tools → Time zone) or enter the local time shown in the table.
3. **Atmosphere off** (A): the altitudes must be geometric, with no refraction, as the passes' altitudes are. With the atmosphere off, the info panel shows "Az./Alt." with no "(apparent)".
4. **Azimuth from north** (Configuration → Tools): leave "Azimuth from south" unticked.
5. **Decimal degrees** (Configuration → Tools → "Use decimal degrees"): saves converting from d°m′s″.
6. Search for each star (F3) and each planet. Copy the Az./Alt. into `azDeg` and `altDeg` with at least two decimals.
7. In the matching `.meta.json`, record the Stellarium version, the date you captured, and the settings you used.

The US Naval Observatory's (USNO's) Celestial Navigation Data service, or JPL Horizons for the planets, is also acceptable. Name it in `source` and say whether its altitudes include refraction. If they do, use a mode without it.

Once every `null` and every "TO FILL" is replaced, commit the six files. The test that reads them is written in v2.4's catalogue task.
