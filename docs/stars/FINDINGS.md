# Stars spike: findings

R111 (FR-STAR-12, PLAN D-740, D-741). The spike is `spike/stars/`, served by `npm run spike:stars` at `https://<this machine's LAN address>:5173/spike/stars/`; every knob is a URL parameter (`spike/stars/params.ts`). The numbers a desktop can take are in [`measurements.md`](measurements.md), written by `npm run spike:stars:measure`; the phone's are below. **Status: draft — the phone run and the owner's picks are open.**

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

**Phone (owner):** open, to be read on the meter under the sensor with `render=react` and `render=ref`, `mark=glyph`.

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

**Owner:** pick the sizes, the collision distance, and whether the ink shift and `·` go in. FR-STAR-6 is amended for whatever is picked.

| question | pick |
|---|---|
| sizes (big/small px) | |
| collision distance | |
| ink shift | |
| faint glyph `.` or `·` | |
| Crux keeps its shape at 390 px | |
| Orion's belt is three marks in a line | |

## On the phone, under the sky

**Owner:** with the spike open on the sensor, Crux or the Plough is where another app puts it. Name the app.

## Open

- Android Chrome's rate, as R38 left it.
- The sensor path ignores magnetic declination (the spike passes 0). At Neuquén that is about 2° of azimuth. The page reads it as the live page does (FR-LIVE-8).
