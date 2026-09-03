# R14 — glyphcss feasibility spike: findings

Date: 2026-09-03. Library: `@glyphcss/react` 0.1.6 (`@glyphcss/core` 0.1.6, `glyphcss` 0.1.6), pinned exactly. Page: `spike/` (dev only: `npm run dev`, then `/spike/`; every knob is a URL parameter). Driver: `npx tsx spike/capture.ts` writes every screenshot, raster text (`raster/*.txt`, the `<pre>` content) and number in this folder; `measurements.json` is the raw output. Viewport 390 × 844 (Pixel 5 profile, device pixel ratio 2), Chromium from Playwright 1.62.

The composition is PLAN §8.3 built through `spike/domeGeometry.ts` from `lib/skyGeometry.toDome`: horizon ring, dashed 30°/60° rings, eight meridians, the pass as a strip with the last fifth gapped for direction, peak and shadow diamonds at radius 1.02, compass / zenith / pass labels as `GlyphHotspot`s. Two passes: the first golden pass (grazing, 13° of sky, peak 10°) and a synthetic high pass (rises WNW, peak 64° SW, ends in shadow SE) for the cases the golden pass cannot show.

## Summary

| # | Question | Answer |
|---|---|---|
| 1 | Frame convention | glyphcss is **Z-up with a turntable about Z**. `toDome` flipped to x south, y east, z up (R13 tests updated). `rotY = 360 − facing azimuth`, `rotX` = tilt from top-down (0) to horizontal (90). |
| 2 | Legibility of a 1.5° strip | In the default `ascii` char mode **no**: wireframe strokes every quad edge, so strips and dashes render as ladders and the grid swamps the arc at 60×30. In `charMode="braille"` **yes** at 60×30 and 100×50: single-stroke grid lines, the 1.5° pass strip as a continuous double dotted line. A grazing pass is 3 cells long and unreadable in any mode. |
| 3 | Performance (FR-GUIDE-6) | Above target in the proxy: ≥ 64 rasterisations/s at 4× CPU throttling and ≥ 43/s at 6×, longest frame 27 ms, at every grid tried. Not measured on a physical phone (see caveat); the on-device check stays in R15's release checklist. D-16 trigger (a) not fired. |
| 4 | Interior camera | **No.** Every perspective configuration either equals the external view, collapses to one cell, or renders nothing (first-person controls). P-OQ-1: external camera; the observer-centred view is the horizon panorama (item 7), not a dome camera. |
| 5 | `useColors` under the CSP | Emits `<span style="color:#…">` inline styles: blocked by `style-src 'self'`, colour silently dropped. Also, **glyphcss injects a `<style>` element at mount**, blocked by the same CSP: the raster still draws but the hotspot layer loses its positioning. Fix: ship its base rules in our stylesheet. P-OQ-3: monochrome. |
| 6 | Bundle | Chart chunk **97.3 KB gzipped** (277.6 KB raw): `@glyphcss/core` 48 KB, `glyphcss` 48 KB, React binding 5 KB, ours 4.5 KB. The OBJ/glTF/VOX/PNG/JPEG loaders and the colour-font atlases are emitted as lazy chunks (pngjs 62 KB, atlases 33 + 29 KB, …) but **not fetched** by the dome. Over the 60 KB budget; PLAN §11 now carries the measured figure. |
| 7 | Horizon panorama | Works from the same geometry in ~250 lines of SVG; reads for both passes without rotation, shows the live marker with a trail and needs no library. Screenshots below for the owner's choice of primary view. |

## 1. Frame convention

`01-frame-rotY0.png`, `01-frame-rotY90.png`, `01-frame-rotY0-topdown.png`; hotspot cells in `measurements.json → frame` (60×30 grid, cell = column, row).

With the R13 frame (Y up) the horizon ring collapsed to the centre column and the zenith sat 23 columns to the right: glyphcss treats **Z** as up and its `rotY` turntable spins about Z. After the flip (`toDome`: x = −cos el · cos az, y = cos el · sin az, z = sin el):

| rotY | N | E | S | W | zenith | reading |
|---|---|---|---|---|---|---|
| 0 (rotX 25) | 29, 5 (top) | 51, 15 (right) | 29, 26 (bottom) | 7, 15 (left) | 29, 11 | camera south of the observer looking north, east on the right |
| 90 (rotX 25) | 50, 15 (right) | 29, 26 (bottom) | 7, 15 (left) | 29, 5 (top) | 29, 11 | looking west: positive `rotY` turns the world clockwise on screen |
| 0 (rotX 89) | 28, 15 | 49, 15 | 28, 16 | 7, 15 | 28, 4 | horizontal view: horizon a line through the centre, zenith at the top |

So `rotY = (360 − facingAz) mod 360` faces any azimuth, `rotX` is the tilt from top-down (0) to horizontal (90), and the readout `facing NE · tilt 25°` is `compass16(360 − rotY)`. The over-the-shoulder view of D-17 keeps left / right as in life (facing north, east on the right). The spike page defaults to the pass's rise azimuth (D-17): `02-strip-60x30-high-braille.png` reads `facing WNW` for the synthetic pass, `facing NE` for the golden pass. `zoom` is CSS pixels per world unit; 140 fills a 390 px grid with room for the labels.

## 2. Legibility

`02-variant-*.png` (composition search, high pass, 60×30) and `02-strip-{60x30,100x50}-{golden,high}-{braille,ascii}.png`; raster text in `raster/`.

- **Wireframe strokes every polygon edge.** A strip of 2° quads is a ladder (both long edges and every rung); a 5° dash is a small rectangle. With the `lines` palette the 60×30 dome is a wall of `║═` (`02-variant-strip-lines.png`). Collapsing rings and meridians to 0.05°-wide strips (both edges in one cell, rungs sub-cell) gives single strokes (`02-variant-wire-*.png`); the arc keeps its 1.5° width so it reads heavier.
- **`ascii` char mode does not resolve the dome at 60×30** in any palette (`lines`, `ascii`, `default`, junction-resolved `ascii`): the glyph chosen per cell depends on edge angle, so a curve becomes an alternation of `+*x` or `║═`, and the arc is not distinguishable from the grid. At 100×50 it is recognisable but muddled.
- **`charMode="braille"` resolves it at 60×30.** Braille cells carry 2 × 4 dots, so 60×30 cells are 120 × 120 dots; the rings and meridians are single dotted curves and the 1.5° strip a continuous double line (`02-variant-wire-braille-strip075.png`, `02-strip-60x30-high-braille.png`). At 100×50 (3.9 px cells) the drawing is finer still; text inside the grid would be illegible at that size, but there is none: the labels are hotspots at 11 px.
- **A grazing pass has nothing to show on a dome.** The golden pass is 13° of sky at 10° elevation: three cells of arc at the far rim of the dome, with the rise and peak labels overlapping (`02-strip-60x30-golden-braille.png`). The panorama shows the same pass as a low bump with the marker on it (`07-panorama-golden.png`).
- Adjustments taken: grid strips 0.05°, pass strip 1.5°, resampling 2°, dashes by omitted quads (every other 5° quad), hotspot labels outside the `<pre>` at 11 px. The `<pre>` needs our font rules (`font-size: cell width / 0.6`, `line-height: 2 × cell width`, `cellAspect 2`).

## 3. Performance (FR-GUIDE-6)

Method (`spike/perf.ts`, `capture.ts → perf`): a 5 s pointer drag with real `pointermove` events from Playwright's mouse (about 40–48 moves/s), the page counting animation frames in which the `<pre>` text was rewritten (a `MutationObserver` on the scene) and the widest gap between two animation-frame callbacks; a `long-animation-frame` observer recorded nothing (no frame over 50 ms). CPU throttling through Chrome DevTools Protocol `Emulation.setCPUThrottlingRate`: 1×, 4× (Lighthouse's mobile ratio) and 6×. Headless Chromium runs unthrottled by vsync, so the 1× column reads above 60.

| Grid | 1× | 4× | 6× | longest frame |
|---|---|---|---|---|
| 60×30 braille | 91/s | 69/s | 48/s | 27 ms |
| 60×30 ascii | 93/s | 69/s | 56/s | 27 ms |
| 100×50 braille | 89/s | 64/s | 43/s | 27 ms |
| 100×50 braille, `interactiveDownscale={2}` | 87/s | 69/s | 49/s | 27 ms |
| autosize (60×30 at 390 px) braille | 94/s | 73/s | 57/s | 27 ms |

Every configuration clears ≥ 30 rasterisations/s and < 33 ms per frame with margin; glyphcss re-rasterises on every animation frame while a drag is active, not only on pointer moves. **Caveat:** this is desktop Chromium with CPU throttling, not a mid-range 2022 Android phone; text layout of a 60×30 braille `<pre>` and touch input cost more on a phone, and the numbers above are a proxy. R15's release checklist keeps the on-device check (≥ 30/s during a 5 s drag) as specified. `interactiveDownscale` is the configuration fix if it fails there (+6/s at 100×50, 6×). D-16 trigger (a) is not fired.

## 4. Interior camera (P-OQ-1)

`04-interior-*.png`, `measurements.json → interior` (ink = non-space cells; hotspot cells).

| Configuration | Result |
|---|---|
| `GlyphPerspectiveCamera` `distance=0`, `perspective=32000` (default) | identical to the orthographic external view: the eye is 32 000 CSS px out along the view axis, `distance` is a pull-back from the target, and nothing places the camera at the origin |
| `perspective=400` | the same with slight foreshortening |
| legacy pinhole `perspective=0`, `distance=0` | one cell of ink (division by zero at the origin) |
| legacy pinhole `distance=0.01` | 101 cells, half the labels collapsed on the centre: unusable |
| `GlyphFirstPersonControls` (`eyeHeight 0`, `groundZ 0`, look only) with any of the above | nothing rendered, no error |
| each of the above with double-sided quads (`ds=1`) | no change |

There is no observer-centred camera in glyphcss 0.1.6. **P-OQ-1: the external over-the-shoulder view (D-17) is the dome's only camera.** The observer-centred picture the spec asks for ("the horizon they'll face") is delivered by the horizon panorama (item 7) rather than by a dome camera.

## 5. `useColors` and the strict CSP (P-OQ-3)

`05-colors-on.png`, `05-colors-off.png`, `05-csp-mono.png`, `05-csp-colors.png`; `measurements.json → colors, csp`.

- With `useColors` on, the live scene emits **121 `<span style="color:#7d8794">…</span>` runs and zero class-based spans**: inline `style` attributes written through `innerHTML`. The static export path in `glyphcss` has a `classes` encoder, but the React scene does not use it.
- Under `public/_headers` (`style-src 'self'`, served by `vite preview` of the bundle probe) the colour spans raise `Applying inline style violates … 'style-src 'self''` and render in the inherited colour (`firstSpanColor` = `--fg`): colour is not available.
- **`GlyphScene` also injects a `<style id="glyph-styles">` element at mount** (`injectGlyphBaseStyles`: `.glyph-host`, `.glyph-scene { position: relative; overflow: hidden }`, `.glyph-output`, hotspot layer rules). The CSP blocks it too (one violation in the monochrome run). The raster still draws, but the hotspot layer loses its containing block and the labels land off the dome (`05-csp-mono.png`: N, NE, NW missing). Hotspot positions themselves are set through the CSSOM and survive.
- Fix for R15: copy glyphcss 0.1.6's base rules into `dome/SkyDome.module.css` (pinned with the version; the raster snapshot is the tripwire) rather than adding a `sha256-…` hash of the injected sheet to the CSP, which would break on every patch release. **P-OQ-3: monochrome; the highlighted pass is the double-line strip, everything else single strokes.**

## 6. Bundle cost

`npx vite build -c spike/vite.bundle.config.ts` (bundle probe: `spike/bundle/`, the dome behind `React.lazy` as R15 will split it) with `rollup-plugin-visualizer` gzip figures (`stats.json` in the build output, summarised in `measurements.json` is not needed: the figures are below).

| Chunk | gzipped | raw | fetched by the dome at runtime |
|---|---|---|---|
| `DomeChunk` (chart chunk) | **97.3 KB** | 277.6 KB | yes |
| of which `@glyphcss/core/dist/index.js` | 47.9 KB | 172.8 KB | (all geometry, parsers, colour maths: the React package re-exports every export of core, so nothing tree-shakes) |
| of which `glyphcss/dist/chunk-CTCZZOFL.js` + `chunk-2SCP5BAD.js` + `index.js` | 47.9 KB | 135.7 KB | (rasteriser, controls, effect layers, surface-atlas / WebGPU export machinery) |
| of which `@glyphcss/react/dist/index.js` | 4.7 KB | 22.0 KB | |
| of which `spike/domeGeometry.ts` + `SpikeDome.tsx` + `lib/skyGeometry.ts` | 4.2 KB | 11.8 KB | |
| `browser-*.js` (pngjs) | 62.0 KB | 202.5 KB | no (dynamic import inside glyphcss) |
| `fontAtlasPayload-*.js`, `fontAtlasAsciiPayload-*.js` (colour-font atlases) | 32.9 + 29.4 KB | 48.9 + 45.3 KB | no |
| `index-*.js` (jpeg-js), `index-*.js` (buffer) | 8.8 + 8.6 KB | 20.7 + 28.0 KB | no |
| React + ReactDOM (probe main chunk) | 61.2 KB | 194.5 KB | already in the app's main chunk |

The monochrome braille dome fetches exactly the main chunk, the CSS and `DomeChunk` (`measurements.json → csp.mono.requests`). The loaders and atlases are dead weight in `dist/` but never on the wire. The chart chunk is **37 KB over the 60 KB budget** and cannot be trimmed from outside (no wireframe-only entry point); PLAN §11 now budgets the chart chunk at 100 KB gzipped, the measured figure with headroom, as TASKS R15 provides for ("≤ 60 KB or the R14 figure").

## 7. Horizon panorama (added item)

`07-panorama-golden.png`, `07-panorama-high.png`, `07-both-golden.png`, `07-both-high.png`, `07-motion-02.png`, `07-motion-05.png`, `07-motion-08.png`.

`spike/SpikePanorama.tsx`: an SVG strip, equirectangular (one pixel scale for azimuth and elevation), centred on the arc's azimuth range (which contains the rise azimuth) with a field of view of the arc's span + 40°, at least 100° and at most 220°; the horizon as a baseline with the 16 compass names along it (N/E/S/W bold), a ground band, dashed 30°/60° lines, the arc resampled at 2° through `lib/skyGeometry`, rise / peak / end markers (open circle for shadow entry), the direction arrow, the name and rise time at the rise point, `max N°` at the peak, and the current position as a hollow diamond with the travelled part of the arc drawn solid and the rest dashed. A readout says `Facing SW · 200° of horizon shown · up to 82° elevation`.

What the screenshots show against the dome:

- **Grazing pass (the golden pass, the common case).** The dome shows three cells at the rim and two overlapping labels; the panorama shows a low bump on the ENE horizon with the marker on it and the times beside it (the two labels overlap there too; a layout rule like the polar view's fixes it).
- **High pass.** Both read. The dome needs the user to understand an over-the-shoulder projection of a sphere and to drag it; the panorama is what the user will see when they turn to face WNW: the ISS comes up on the right, climbs over the SW to 64° and drops into shadow on the left.
- **Live motion** (`07-motion-*.png`): the marker and trail move on both; on the panorama they read at a glance, on the dome the `now` diamond competes with the grid.
- Cost: no dependency, no CSP or bundle question, no rotation gesture or keyboard scheme to design and test, no facing readout needed (the facing is the strip's centre). FR-GUIDE-5 already permits SVG. It does not satisfy the wording of FR-GUIDE-2 / spec UX-1 ("3D sky dome as ASCII text… rotate and tilt"), so making it the primary view is a Decision Log change for the owner, per PLAN §8.5 item 7.

Recommendation for the owner's pick: panorama as the primary view, dome as the second view kept for the visual signature (it works, within the limits above), polar as the fallback either way. R15 is re-scoped once the pick is made (PLAN D-60).

## Other observations

- `autoSize` works with a sized host (`.dome.auto { height: 390px }`); cols / rows follow the measured cell.
- Hotspot children are React portals into an overlay `div` positioned per raster; long labels overlap the grid and each other near the rim, so R15 needs the polar view's "beside, never on" placement rule for the pass labels.
- `GlyphOrbitControls` sets `cursor: grab; touch-action: none; user-select: none` on the host through the CSSOM (allowed under the CSP).
- Nothing in the spike reads the clock: `now` is a fraction of the pass on the URL, animated by `requestAnimationFrame` only on the page.
- `npm run build` output (`dist/`): `_headers`, `index.html`, `assets/index-*.css`, two `assets/index-*.js`, `assets/passes.worker-*.js`; no spike page, no glyphcss (the spike is a separate Vite HTML entry that only the dev server serves).
