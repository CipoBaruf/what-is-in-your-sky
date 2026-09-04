# Layered dome — composition findings

| Field | Value |
|---|---|
| Task | R16 (FR-DOME-8, PLAN §8.7). Answers P-OQ-4 / OQ-15. |
| Date | 2026-09-03 |
| Library | `@glyphcss/react` 0.1.6, exactly the version the app ships. |
| Spike | `spike/dome-composition/` — every knob is one URL parameter; nothing here is imported by `src/`. |
| Regenerate | `npm run spike:dome-composition` (all steps) or `npm run spike:dome-composition shots perf` (named steps). Every PNG, raster dump and figure in this directory comes from that one command. |
| Figures | `measurements.md` (generated tables) and `measurements.json` (raw). |
| Drag measurement | The D-62 method unchanged: Playwright Chromium, Pixel 5 profile at 390 px, a real 5 s pointer drag, Chrome DevTools CPU throttling at 6×, counting rasterisations (writes to a scene's `<pre>`) per animation frame. Target ≥ 30/s (FR-GUIDE-6). |
| Fixtures | The R1 golden grazing pass (13° of sky) and R14's synthetic high pass (64°, ends in shadow), each drawn with three dim companions so the FR-LIVE-2 load is on screen. |

## 1. The candidates

Every candidate is a diff against the spike's defaults, so its query string *is* its definition. Open any of them with
`/spike/dome-composition/?candidate=<name>` and turn any knob from there.

| # | Candidate | Parameters (the diff from the defaults) | Captures | Drag rate at 390 px, 6× |
|---|---|---|---|---|
| A | mono, one scene (the R15 control) | `?candidate=mono` — `base=0 colors=0 set=mono pulse=0` | `mono-{golden,high}-{390,1280}.png`, `mono-night-390.png` | ≈ 38–40/s |
| B | lean: colour, one scene | `?candidate=lean` — `base=0 mer=cardinal tilt=40 pulse=1` | `lean-*.png` | ≈ 34–35/s |
| C | layered: PLAN §8.7 in full | `?candidate=layered` — `pulse=1` (everything else is the default composition) | `layered-*.png` | ≈ 33/s |
| D | layered with all three fallbacks | `?candidate=layered-coarse` — `tilt=50 baseratio=0.34 tol=128 downscale=2 dropbase=1 pulse=1` | `layered-coarse-*.png` | ≈ 35/s |
| E | ground only, warm set | `?candidate=ground-only` — `bowl=0 set=warm tilt=35 pulse=1` | `ground-only-*.png` | ≈ 33/s |

The exact query string behind every capture is recorded in `measurements.json` (`shots.<name>.query`); the page writes
the same string back to the address bar as you turn knobs, so a composition found by hand is a link.

The exact figures of the last run are in `measurements.md`; a composition measured three times moved by up to
3 rasterisations per second, so anything inside that band is a tie. All five candidates hold the FR-GUIDE-6 target at
the phone width, and the spread between the cheapest and the most expensive is about 6/s of 39 — **the drag rate is not
what decides this composition at 390 px**. It is what decides the desktop grid (§2).

Supporting captures, all at 390 px on the high pass unless stated:

- tilt: `tilt-{35,40,45,50,55}-390.png`
- meridians: `meridians-{none,cardinal,eight,sixteen}-390.png` (on the golden pass)
- base layer: `base-ramp-{blocks,dots,default,ascii}-390.png`, `base-ratio-{0.34,1}-390.png`, `base-ambient-{0.15,0.6}-390.png`, `base-ground-{1.0,1.3}-390.png`, `base-no-{bowl,ground}-390.png`, `base-sun-{at-horizon,deep}-390.png`
- furniture: `elements-{others-0,others-1,others-3,no-ticks,no-ring-labels,no-time-labels,no-moon,no-live-marker,thin-pass,fat-pass,bare}-390.png`
- P-OQ-4 evidence: `probe-{density-1,density-2,density-3,colors-off,tol-128,tol-inf,atlas,base-off}-390.png`

## 2. P-OQ-4 answered

**Per-mesh `density` exists in 0.1.6 and cannot be used for FR-DOME-8c.** `GlyphMeshProps.density` is real: with
`density=2` the line layer goes from one `<pre>` to four, the extra three at a 3.25 px cell against the shared 6.5 px
one (`density=3` → 2.17 px), exactly as documented. But the finer `<pre>` does not land where the shared grid puts the
same geometry: compare `probe-density-1-390.png` (a clean arc) with `probe-density-2-390.png`, where the highlighted
arc is broken up and a stray strand of it runs off the bottom of the drawing. The sub-`<pre>` is rendered at its own
scale and origin and does not follow the `GlyphOrthographicCamera`'s `zoom`. So:

> **The highlighted pass gets no finer density in R21.** It stays in the shared line grid; its emphasis comes from
> weight (0.75° against 0.05°) and colour. If a sharper arc is wanted later, D-74's fallback — a third scene, with the
> camera and cell it is given — is the path, and it should be its own task with its own measurement.

**The second scene costs 5 to 8 rasterisations per second — 13 to 20 %.** The ablation ladder (`measurements.md`, all
at 390 px / 6×, figures from the run that generated this file, ±3/s):

| rung | rate |
|---|---|
| line layer only, monochrome | ≈ 39/s |
| line layer only, colour | ≈ 38/s |
| + the base scene | 30–32/s |
| + per-mesh density 2 | 28–32/s |
| + the pulse | 29–31/s |

Colour is nearly free (127 spans against 0 changes nothing measurable), the base scene is the whole cost, and it is
affordable at the phone width: the finished candidate C sits at ≈ 33/s, above the target, and runs at ≈ 55/s
unthrottled.

**The fallbacks are not needed at the phone width, and they are not what saves the desktop one.** At 390 px,
`colorTolerance=128`, `interactiveDownscale=2` and dropping the base layer while dragging all land inside the
run-to-run band of the composition they were meant to rescue (30–33/s against 29–32/s). What does not hold is the
desktop grid: FR-DOME-1 taken literally (the 6.5 px cell kept, so 1280 px is 197 columns) measures **18.7/s** under 6×
throttling with a 63 ms longest frame; all three fallbacks together reach 26.2/s, 140 columns 24.1/s, 120 columns
23.9/s and even 100 columns only 28.6/s. **No column count clears 30/s at 1280 px under 6× throttling.**

That is the right measurement applied to the wrong machine, and it is worth being explicit about: D-62's 6× CPU
throttle is there to model a mid-range phone, and a 1280 px panel is not one. The same grids measured unthrottled are
in the `layered @1280, no throttle` and `layered @1280, 120 cols, no throttle` rows of `measurements.md`. The
conclusion R21 should carry is therefore in two parts: **cap the column count** (the cap buys about 10/s at 1280 px
and costs nothing a reader can see), and **treat the throttled desktop figure as a warning, not a gate** — the gate
stays the phone, at the phone's width, which is what FR-GUIDE-6 says.

**`interactiveDownscale` is inert unless the component calls `setInteracting`.** The scene lowers its resolution only
between `sceneHandle.setInteracting(true)` and `(false)`; `@glyphcss/react` 0.1.6 never calls it (the vanilla controls
do), and D-64 already replaced those controls with camera props. The spike calls it from a child hook
(`LayeredDome.SceneInteracting`) and it then works — the line grid drops 60 × 30 → 30 × 15 during the drag. **It also
distorts a stacked layout**: the library rescales by writing `pre.style.fontSize`, which our CSS `line-height` does not
follow, so during the drag the base layer's `<pre>` doubles in width (390 → 780 px, cell 13 → 26 px) and the layers
come apart. If R21 wants this fallback it has to scale `line-height` with it, or halve the column count itself.

**Two other knobs worth knowing.** `colorTolerance` does what it says — 131 spans → 112 at 128, → 87 at 765 — with no
visible change at these palettes (`probe-tol-128-390.png`, `probe-tol-inf-390.png`); it is a free saving if the span
count ever matters. `colorEncoding="atlas"` removes every `<span>` from the **solid** base layer but not from the
braille line layer, which falls back to spans for the frame (`probe-atlas-390.png`): the braille glyphs are outside
the shipped atlas. It is not a lever for this dome.

**Alignment (§8.7).** With both layers taking the same `zoom` and cells that divide evenly, the two rasters agree to
0.03 px in width and 0.02 px horizontally, but the base sits **2 px above** the line layer, because each layer's
`<pre>` is centred in its own box and the two boxes round differently. Two pixels is a third of a line cell, visible as
a seam where the ground meets the horizon ring. R21 should align both layers to the top-left of the shared box rather
than centring them, and the raster snapshot test should cover both layers, as §8.7 already says.

**One thing the spike got wrong first, worth keeping:** glyphcss's `zoom` is CSS pixels per world unit measured
against the cell the scene probes at mount, so it belongs to the *box*, not to the grid. Scaling it with the cell (as
R15's `layoutFor` does, where the grid is fixed at 60 columns) makes a coarser layer twice as large. Both layers take
`zoom = 140 × width / 390`.

## 3. Recommendation

The composition to build in R21, as a query string:

```
/spike/dome-composition/?candidate=layered
```

That is candidate **C**, and every value below is already the default in `spike/dome-composition/params.ts` — the
spike was left pointing at what it recommends, so `?candidate=layered` and a bare `/spike/dome-composition/` differ
only by the pulse.

| Decision | Value | Why |
|---|---|---|
| **Tilt default** | **45°** | `tilt-35-390.png` flattens the bowl into the polar chart's disc and buries the horizon labels; `tilt-55-390.png` throws the zenith off the top and wastes a third of the box. 45° is the first tilt at which both the horizon ring and the peak of the high pass sit inside the drawing, and it is the middle of the FR-DOME-8 range. |
| **Meridians** | **Eight**: four cardinal solid, four intercardinal dashed | `meridians-none` loses the sense of a bowl entirely; `meridians-sixteen` turns the interior into a mesh the arc cannot win against; `cardinal` reads well but leaves the NE/SE/SW/NW quadrants shapeless. Eight is what R15 draws and it survives the added furniture. |
| **Line weights** (strip half-widths) | horizon **0.05°**, rings **0.05°** dashed, meridians **0.05°** (dashed off the cardinals), highlighted pass **0.75°**, other passes **0.05°** | `elements-thin-pass-390.png` (0.05°) loses the highlighted pass among the grid; `elements-fat-pass-390.png` (1.5°) is a band, not an arc, and its two edges read as two passes. 0.75° against 0.05° is a 15 : 1 weight ratio and is what carries FR-X-5's "colour is never the only channel". |
| **Base layer** | on: ground disc to **1.1 radii**, sky bowl at 0.985, ramp **`blocks`**, **half** the line layer's columns, ambient **0.35**, key **0.85** pointed at the Sun | `base-ramp-default-390.png` scatters dashes over the whole frame and reads as noise; `blocks` reads as a wash. `base-ratio-1-390.png` (same grid as the lines) competes with the arc; a third (`base-ratio-0.34-390.png`) is too blocky at 390 px. `base-ground-1.3-390.png` fills the corners; 1.0 leaves no visible ground at all. |
| **Sun glow** | keep, width and brightness from the Sun's altitude | `base-sun-at-horizon-390.png` (−2°) against `base-sun-deep-390.png` (−16°): the glow is the only thing in the drawing that says which way the twilight is, and it disappears on its own by −18°. |
| **Live marker pulse** | keep, driven by `requestAnimationFrame`, **capped at 30 updates/s** | Asking for 60 updates/s the pulse alone measures **34/s** at 6× throttle (45/s unthrottled), so it clears the FR-GUIDE-6 bar with the whole dome on screen; asking for 20/s measures 17/s — the rate is what you ask for and the cost is one rasterisation per update. 30/s is the target and there is no reason to pay for more. |
| **Per-mesh density on the highlighted pass (FR-DOME-8c)** | **drop it** | See §2. It is broken in 0.1.6. |
| **Grid at desktop widths (FR-DOME-1)** | grow the columns with the width but **cap them at 120**; below that keep the 6.5 px cell | 197 columns (the uncapped rule at 1280 px) measures 18.7/s throttled against 23.9/s at 120, and the capped drawing is still twice the phone's detail — "a larger and finer drawing, not a scaled-up phone one". `layered-*-1280.png` are the uncapped captures; the arc and the labels read at either grid. |
| **Fallback order** | none needed at the phone width; at desktop widths cap the columns first, then `colorTolerance` | Measured above. `interactiveDownscale` is the last resort because of the layout distortion, and dropping the base while dragging is a visible flicker for about 2/s. |

### Colours (FR-DOME-2, both themes)

The recommended set is **`cool`** (`ground-only-*.png` shows `warm`, which reads as a sepia print and takes the
distinction between the peak marker and the pass with it). Contrast is against each theme's ground; FR-THEME-2 wants
≥ 3 : 1 for non-text, and every value below clears it.

| Meaning | Dark | ratio | Night | ratio |
|---|---|---|---|---|
| Highlighted pass | `#9ad0ff` | 11.75 | `#ff6a55` | 7.28 |
| Flown part of the arc | `#5f9fd0` | 6.73 | `#c04a3a` | 4.19 |
| Other passes (dim) | `#7d8794` | 5.28 | `#a3453a` | 3.39 |
| Peak marker | `#f0c674` | 11.93 | `#ff9c86` | 10.12 |
| Shadow-entry marker | `#ff8a80` | 8.42 | `#d95a48` | 5.39 |
| Current position | `#ffffff` | 19.22 | `#ffd8cd` | 15.61 |
| Horizon ring | `#a7b1bf` | 8.86 | `#c05545` | 4.52 |
| Altitude rings and meridians | `#606c7a` | 3.59 | `#a3453a` | 3.39 |
| Compass labels | `#d5dbe3` | 13.79 | `#ff8f7d` | 9.27 |
| Sun glow | `#f0a94a` | 9.59 | `#ff7a52` | 7.98 |
| Moon | `#e8e2d0` | 14.84 | `#ffb3a0` | 11.94 |
| Ground disc (base) | `#161c24` | 1.12 | `#160505` | 1.03 |
| Sky bowl (base) | `#1d2733` | 1.27 | `#1e0908` | 1.07 |

The ground and the sky are surfaces, not marks: their job is to be *barely* above the page ground, and their ratios are
supposed to be near 1. Everything that carries meaning is above 3 : 1 in both themes. The first night values tried for
the rings (`#8a3a2e`, 2.67 : 1) failed that bar and were lifted to the `dim` value — worth knowing when R20 writes the
tokens: the night palette runs out of headroom at the dim end, not the bright end.

Two notes for R20 and R21: no night value carries a non-red hue (FR-THEME-3), and the whole map survives being read as
monochrome, because the weight and the glyph already separate the highlighted pass from the grid (candidate A is that
reading).

## 4. What this spike does not settle

- **Label collisions.** The compass names and the pass labels still overlap at some cameras — in
  `layered-golden-390.png` three of them (`STARLINK-1130`, the ISS name and time, and `max 10°`) pile up above the
  dome and become one grey smear. FR-DOME-3's fixed resolution order is pure geometry and belongs in
  `domeGeometry.ts` with unit tests, as §8.7 says; the spike draws every label unmoved on purpose, so the collisions
  are visible rather than hidden by a half-measure.
- **The grazing pass at 390 px.** The golden pass covers 13° of sky, which at 60 columns is four or five cells of arc
  (`layered-golden-390.png` against `layered-high-390.png`). No composition fixes that — it is the grid's resolution,
  and the 0.75° weight plus the highlight colour is the most that can be done inside it. It is an argument for the
  numeric table beside the chart, not for a finer dome; the same pass at 1280 px (`layered-golden-1280.png`) reads
  cleanly, which is FR-DOME-1's whole point.
- **The two-pixel seam** between the layers (§2). It is a layout fix, not a composition one.
- **FR-LIVE-5's 3600× playback.** The pulse measurement is the closest proxy here — a marker moving on its own at a
  fixed rate — and it holds 35/s at 6× throttle with the whole dome on screen. The real test is the live page's own
  task, with the tracks moving instead of one marker.
- **The on-device check.** Everything here is the D-62 proxy. `docs/RELEASE.md`'s phone check is still the real gate.
