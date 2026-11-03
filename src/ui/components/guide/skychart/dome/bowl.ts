/**
 * R135 (D-882): the bowl's size, apart from the camera. `ChartFrame`, in the
 * `main` chunk, cut the compact dome's box from it until R165 (D-1000) retired
 * that cut with the compact column; the module keeps the bowl's numbers and
 * imports nothing, and `camera.ts` and `domeGeometry.ts` re-export what they
 * used to define, so their importers are unchanged.
 */

/**
 * D-92 (from the R16 spike): 45°. Below 35° the bowl flattens into the polar
 * chart's disc and buries the horizon labels; above 55° the zenith leaves the
 * top of the drawing.
 */
export const DEFAULT_TILT_DEG = 45;
/** Base layer (FR-DOME-8a, D-92): the ground reaches 1.1 radii (`domeGeometry`). */
export const GROUND_RADIUS = 1.1;
/**
 * FR-DOME-1 as amended / D-177, D-187 (R45): the fit rule. The orthographic
 * zoom is CSS px per world unit, and it is the box's *shorter* side that sets
 * it: `zoom = min(width / 2.4, height / 1.6)`. The compass ring sits at
 * 1.08 radii, so 2.16 world units across is the drawing's width with its
 * labels and 2.4 leaves the names their margin; at the default 45° tilt the
 * ring is 2 × 1.08 × cos 45° ≈ 1.53 units tall, and 1.6 leaves the same
 * margin. Either way the drawing covers ≥ 90 % of the shorter side, which
 * `drawingExtent` measures and `camera.test.ts` holds. The zoom scales with
 * the *box* and not with the cell (D-91): glyphcss measures zoom against the
 * cell it probes at mount, so two stacked layers of different coarseness
 * must take the same number or the coarser one is drawn twice the size.
 * Before R45 it was 140 at 390 px, the dome at ≈ 72 % of the width.
 *
 * R54 (FR-DOME-1 as amended v1.1.1, D-268, F-51): the rule has a ceiling too —
 * nothing the drawing puts on screen may leave the box. The width divisor
 * always had the room for it: 2.4 against 2.16 is a 10 % margin, and a label
 * is 11 px in a 1-cell hotspot whose corner, not centre, is the projected
 * point, so a label's box sits half a cell off its anchor. The height divisor
 * was 1.6 against 1.53, a 4.6 % margin, which at the live page's 991 × 325 box
 * (1280 × 800) is 15 px — less than the 11 px label plus the 14 px cell, and
 * the `S` label and the raster's last row were drawn past the box's bottom.
 * 1.7 gives the height the same 10 % the width has (1.53 / 1.7 ≈ 0.9), so the
 * extent with its labels and the cell snap (`drawingExtent`) stays between
 * `MIN_EXTENT_RATIO` and `MAX_EXTENT_RATIO` of the shorter side at every box
 * the app draws, from the landscape phone's 324 px up. A width-bound box (the
 * phone, the guide's square) is unchanged.
 *
 * R57 (FR-DOME-1 as amended v1.2, D-279, F-54): `zoomFor` is still taken from
 * the box, and `zoomWithinRaster` then holds it to what the raster can
 * actually paint, so a raster that falls short of the box (the retired
 * `MAX_CELL_WIDTH_PX` cap did, past 1440 CSS px of width) cannot leave the
 * drawing sized for more than the grid holds.
 */
export const ZOOM_WIDTH_DIVISOR = 2.4;
/**
 * R61 (FR-DOME-1 as amended v1.2.1, D-317, F-61): the height divisor is derived
 * from what the scene draws, not from the ring alone. The drawing's tallest
 * thing is not the horizon ring or the zenith: a bowl seen from the default
 * 45° tilt has a *silhouette* — the point at 45° of altitude on the far side,
 * where the meridians and the 30° and 60° rings turn over — and it projects a
 * full `DOME_RADIUS` above the observer, against the far horizon's
 * 1.08 cos 45° = 0.76. Below the observer the lowest thing is the ground disc's
 * near edge at `GROUND_RADIUS` cos 45° = 0.78. So the drawing is 1.00 + 0.78 =
 * 1.78 units tall, and it is not centred on the observer: its middle is 0.11
 * units above. The old divisor, 1.7, was 1.53 / 0.9 — the ring's own height
 * with the label margin — so on every height-bound box (every desktop live
 * page since R45) the raster cut the top 0.24 units of the bowl off: the
 * outline and the far tops of the rings, drawn as flat fragments against the
 * box's top edge. 2.0 is 1.78 / 0.9, the same 10 % margin the width has, and
 * `centerShiftUnits` moves the scene down by the 0.11 so the extent, not the
 * observer, sits in the middle of the box.
 */
/** The wireframe's sphere: the horizon ring, the altitude rings, the meridians and the arcs are drawn at this radius (`domeGeometry`). */
export const DOME_RADIUS = 1;
const EXTENT_TOP_UNITS = DOME_RADIUS;
const EXTENT_BOTTOM_UNITS = GROUND_RADIUS * Math.cos((DEFAULT_TILT_DEG * Math.PI) / 180);
export const DRAWING_HEIGHT_UNITS = EXTENT_TOP_UNITS + EXTENT_BOTTOM_UNITS;
export const ZOOM_HEIGHT_DIVISOR = 2.0;
/** R61 (D-314): the box shape at which both divisors bind at once. No box is cut to it since R133 (D-868); the e2e helpers read it to check the bowl's fit. */
export const DOME_BOX_ASPECT = ZOOM_WIDTH_DIVISOR / ZOOM_HEIGHT_DIVISOR;
