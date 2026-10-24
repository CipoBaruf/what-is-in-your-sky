# Stars spike: findings

R111 (FR-STAR-12, PLAN D-740, D-741). The spike is `spike/stars/`, served by `npm run spike:stars` at `https://<this machine's LAN address>:5173/spike/stars/`; every knob is a URL parameter (`spike/stars/params.ts`). The numbers a desktop can take are in [`measurements.md`](measurements.md), written by `npm run spike:stars:measure`; the phone's are below. **Status: answered 2026-10-23 (PLAN D-744..D-747); the Android row and the declination stay open.**

## 1. The figure source (OQ-39)

**d3-celestial's `constellations.lines.json`.** All 893 endpoints of its 89 features (Serpens is drawn as two) snap to a Yale catalogue star, the worst at **0.0025°**, forty times inside OQ-39's 0.1° bound. No figure needed a hand fix. Stellarium's GPL file is not needed.

## 2. The catalogue and `STARS_BUDGET_KB`

At V ≤ 4.5 the catalogue is **1035 stars**: 904 bright enough on their own, plus 131 fainter stars that a figure ends on. It has 743 segments and 288 proper names.

| encoding | raw | gzipped |
|---|---|---|
| objects (one per star) | 98.0 KB | 25.5 KB |
| columns (one array per field) | 53.5 KB | **21.1 KB** |

**Columns**, at 21.1 KB gzipped. The same catalogue at 5.5 (V24-3's road not taken) is 55.6 KB as objects. **`STARS_BUDGET_KB` stays 40**: the catalogue leaves about 19 KB for the page, the drawing and the list. The release re-sets it from the measure by D-178's rule.

## 3. The render path (FR-STAR-9) and V24-9

By D-62's method, in Playwright's Chromium on the Pixel 5 profile, sweeping the dense southern field (Crux, Centaurus, Carina; 1895 nodes, every layer on):

| render | mark | 1× | 4× | 6× |
|---|---|---|---|---|
| React (`SkyWindow`'s path today) | glyph | 85.6 | **18.8** | 11.8 |
| React | disc | 93.6 | 22.0 | 14.0 |
| by ref, outside render | glyph | 100.0 | **100.0** | 97.2 |
| by ref | disc | 100.2 | 100.0 | 100.0 |

These are draws per second; 4× is D-62's stand-in for a mid-range phone.

- **The ref path.** Through React's render the field falls under 30 at 4×, as FR-STAR-9 feared. Written by ref it holds the frame rate at every throttle. The second cut plans the star, planet, label and segment positions written to their nodes outside render, with the nodes still React's (FR-STAR-9's fallback, now its rule).
- **V24-9 holds.** Glyphs cost what discs cost on both paths: within 15 % through React, equal by ref. The drawing is not what is slow; the render is.

**Phone (owner, 2026-10-23, the owner's iPhone, Safari, sensor, `mark=glyph`, 1895 nodes):**

| render | draws/s | events/s | longest gap |
| --- | --- | --- | --- |
| react | 61 | 61 | 39 ms |
| ref | 61 | 61 | 39 ms |

Both paths draw once per sensor event: on this phone the sensor's rate is the ceiling, not the drawing. The phone run does not tell the paths apart; the throttled desktop run does, and it is the one the decision rests on (a mid-range Android at 4× is where React falls under 30). The ref path costs nothing here and keeps the slower phones above the floor.

| phone, browser | react/glyph | ref/glyph | ref/disc |
|---|---|---|---|
| _iPhone, Safari_ | | | |

## 4. The precession path (FR-STAR-2)

`Rotation_EQJ_HOR` once per instant, applied to every star, against the three fixtures (IAU SOFA and JPL Horizons, V24-12):

| site | stars worst | planets worst |
|---|---|---|
| Neuquén | 0.0064° | 0.0051° |
| Paris | 0.0062° | 0.0048° |
| Singapore | 0.0056° | 0.0051° |

Every value is within **0.0064°** of the fixtures. `STAR_TOLERANCE_DEG` (0.25°) is forty times wider. What is left is the annual aberration that the one rotation leaves out.

## 5. The ladder, the collision distance, and where the ink sits

The captures are Crux over Neuquén and Orion over Paris, at 390 × 844 and 1280 × 800, in [`captures/`](captures/):
- FR-STAR-6's 15/12 px;
- two smaller pairs (13/10, 14/11) and two larger (16/13, 18/15);
- collision at 0.25 and 1 cell beside 0.5;
- discs.

**A finding the spec did not foresee.** FR-STAR-6 centres a glyph's em box on the point (`text-anchor: middle`, `dominant-baseline: central`). In a monospace face the ink is not at the box's centre. Measured in `--font-mono` in Chromium:
- `.` sits **1.9 px below** the point at 12 px and 2.4 px at 15 px;
- `*` and `+` sit **0.6–0.9 px above** it;
- `@` is centred.

The faint stars are the ones figures end on, so every figure line stops about 2 px above its star. The `15-12-inkfix` captures shift each glyph by its measured offset, which is computed once per glyph and size at load from the canvas's text metrics. Their lines meet their stars. `15-12-middle-inkfix` also draws the two faint steps as `·` instead of `.`.

**Owner, 2026-10-23** (from the 390 px captures, on the phone):

| question | pick |
|---|---|
| sizes (big/small px) | **15/12**, FR-STAR-6's. At 13/10 the names are hard to read; from 16/13 up the names cover their neighbours (`Rigil Kentaurus` over Circinus). |
| collision distance | **0.5** of the small size. 0.25 and 1 differ from it by a mark or two in both fields. |
| ink shift | **on.** Without it Crux's lines stop short of its faint stars. FR-STAR-6 is amended to centre the ink, not the em box. |
| faint glyph `.` or `·` | **`.`**, FR-STAR-6's. `·` at 12 px is too small to find on a dark screen. |
| Crux keeps its shape at 390 px | yes: Gacrux `+` at the head, Acrux at the foot, Mimosa and δ the arms. |
| Orion's belt is three marks in a line | yes: three `+` in a line between Betelgeuse and Rigel. |

**Seen in the same captures, for the second cut:** the names are placed beside their star with no regard for marks or lines — `Acrux` covers faint stars, `Betelgeuse` sits on Orion's figure, and `Ori` is dropped because the `Betelgeuse` box takes its place. The names layer needs a placement rule that avoids marks and lines and keeps a figure's name, with the owner's spaced-capital figure names below.

## On the phone, under the sky

**Owner, 2026-10-23, Neuquén, 23:10 local:** on the sensor, Crux (Acrux, Mimosa) and Canopus sit where Sky Guide (Fifth Star Labs, iOS) puts them. Sky Guide corrects for magnetic declination and refraction and the spike does neither; neither difference showed at this check.

### What to take from Sky Guide

The owner wants the field to look more like Sky Guide's, kept in the app's monospace characters and colour tokens. Four touches were picked; each is a change to FR-STAR-6 or its neighbours, for PLAN v0.12 to cut:

- **Faint figure lines:** constellation lines thinner and dimmer than the stars, so they hint at the shape and the stars stand out.
- **Spaced-capital names:** constellation names in spaced capitals (`C R U X`), centred in the figure, dimmer than star names.
- **Ground and compass:** the area below the horizon shaded as ground, with N / E / S / W along the horizon line.
- **Stronger brightness steps:** more contrast down the ladder, with the top stars brighter and larger and the faint steps dimmer still.

## Open

- Android Chrome's rate, as R38 left it. The phone's `mark=disc` rows were not read: on the iPhone both glyph rows sit on the sensor's 61 events/s, so the disc rows could only read the same.
- The sensor path ignores magnetic declination (the spike passes 0). At Neuquén that is about 2° of azimuth. The page reads it as the live page does (FR-LIVE-8).
