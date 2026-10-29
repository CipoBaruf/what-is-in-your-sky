import { COMPACT_BOX_MIN_SHORT_PX, compactDomeBoxHeightPx } from '../../../../../lib/layout';

/**
 * R135 (D-882): the bowl's size, apart from the camera. `ChartFrame` is in the
 * `main` chunk and cuts the compact dome's box from `compactBowlBoxPx`; taking
 * it from `camera.ts` pulled the camera module and `domeGeometry` out of their
 * lazy chunks. This module holds only the numbers the box is cut from and
 * imports nothing but `lib/layout`; `camera.ts` and `domeGeometry.ts` re-export
 * what they used to define, so their importers are unchanged.
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

/**
 * R133 (FR-FLOW-9, D-850): the bowl's drawn height, in CSS px, in a box of
 * `widthPx` where the width binds — the compact box (FR-COMP-5's full-bleed
 * width). `DRAWING_HEIGHT_UNITS` at the width's zoom: the silhouette a radius
 * over the observer and the ground disc's near edge under it, the extent
 * F-61 derived the height divisor from. `lib/layout.ts` `compactDomeBoxHeightPx`
 * adds the slack above and below it, and `ChartFrame` cuts the box to that.
 * 288.9 at 390 px.
 */
export function bowlHeightPx(widthPx: number): number {
  return (widthPx / ZOOM_WIDTH_DIVISOR) * DRAWING_HEIGHT_UNITS;
}

/**
 * R133 (FR-FLOW-9, D-867): the compact dome's box height for a box `widthPx`
 * wide — the bowl plus `DOME_COMPACT_SLACK_PX` above and below, never under
 * FR-LIVE-7's floor, and never under the height at which the width still binds
 * the zoom, so `bowlHeightPx` is the bowl the scene draws. Past about 525 px
 * of width (a tablet's column) the bowl and its slack are shorter than that,
 * and a box cut to them would be height-bound and draw the bowl smaller than
 * it was cut for; there the blank over and under the bowl is the height
 * divisor's own margin (0.045 of the width) and FR-FLOW-9's 24 px, which is
 * the phone's, is over. 337 at 390 px, 640 at 768.
 */
export function compactBowlBoxPx(widthPx: number): number {
  const widthBoundPx = Math.ceil((widthPx / ZOOM_WIDTH_DIVISOR) * ZOOM_HEIGHT_DIVISOR);
  return compactDomeBoxHeightPx({ bowlHeightPx: bowlHeightPx(widthPx), floorPx: Math.max(COMPACT_BOX_MIN_SHORT_PX, widthBoundPx) });
}
