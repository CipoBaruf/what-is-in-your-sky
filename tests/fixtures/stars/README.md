# Star and planet positions (v2.4, FR-STAR-2)

What `skyStars.test.ts` holds the app to: at each of the three R1 sites, at one instant, twelve stars spread around the sky and the five naked-eye planets. Every value must be within `STAR_TOLERANCE_DEG` (0.25°). The values come from published sources, independent of the code under test. The app's own numbers never go in these files.

| File | Site | Instant (UTC) | Local |
|---|---|---|---|
| `neuquen-2026-11-01T0200Z.json` | Neuquén, −38.93, −67.99 | 2026-11-01 02:00 | 31 Oct, 23:00 |
| `paris-2026-11-01T2100Z.json` | Paris, 48.86, 2.35 | 2026-11-01 21:00 | 1 Nov, 22:00 |
| `singapore-2026-11-01T1400Z.json` | Singapore, 1.35, 103.82 | 2026-11-01 14:00 | 1 Nov, 22:00 |

The stars were chosen from the vendored catalogue (`data-src/stars/`): the brightest named star in each 30° of azimuth at 12° or more above the horizon, topped up with the next brightest. The `hr`, designation and J2000 coordinates are only there to find the star. The planets are listed whether they are up or not: a negative altitude is a value too.

## Filling a file in Stella## Where the values come from

Captured 2026-10-23 at the owner's request. Each `.meta.json` records its sources and settings.

- **Stars:** the IAU's SOFA routines (release 2023-10-11) through astropy 8.0.2 and pyerfa 2.0.1.5. The template's J2000 RA/Dec are read in the FK5 frame, transformed to AltAz with pressure 0 (no refraction), at 0 m. Proper motion is not applied, as the catalogue build does not apply it.
- **Planets:** NASA JPL Horizons API, observer table quantity 4, `APPARENT=AIRLESS`. It agrees with astropy's own planet positions within 0.006°.
- The US Naval Observatory's celestial navigation service, the spec's other named source, was unreachable (connection reset).

Checked against `astronomy-engine`'s `Rotation_EQJ_HOR` and `Horizon` on capture: every value agrees within 0.0065°, which is mostly annual aberration that the one rotation leaves out. That is 40 times inside `STAR_TOLERANCE_DEG`.

To re-read a value by hand, use Stellarium (stellarium.org, or stellarium-web.org) with the atmosphere off (A), the location set exactly at 0 m, the time in UTC, azimuth from north, and decimal degrees.
