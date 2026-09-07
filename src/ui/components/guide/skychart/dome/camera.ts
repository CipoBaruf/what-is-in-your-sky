import { compassPoint, normalizeAzimuthDeg, type CompassPoint } from '../../../../../lib/compass';
import { degrees } from '../../../../../lib/format';
import { toDome } from '../../../../../lib/skyGeometry';
import type { Pass } from '../../../../../model';
import { COMPASS_LABEL_RADIUS, GROUND_RADIUS, projectToScreen, type Tuple3 } from './domeGeometry';

/**
 * PLAN §8.3/§8.4 (R15): the dome's camera as two numbers the user controls,
 * the azimuth they face and the tilt, and the mapping to glyphcss's
 * turntable (D-58: `rotY = (360 − facing) mod 360`, `rotX` = tilt from
 * top-down 0° to horizontal 90°). Pure. D-17: the initial view faces the
 * pass's rise azimuth at a tilt that shows both the horizon and the peak;
 * the tilt is clamped so the user can neither go under the horizon nor to a
 * pure top-down view (which is the polar chart's job).
 */
export interface CameraState {
  /** The azimuth the viewer faces, degrees clockwise from north, in [0, 360). */
  facingAzDeg: number;
  /** Tilt from top-down (0°) toward horizontal (90°), inside [PITCH_MIN_DEG, PITCH_MAX_DEG]. */
  tiltDeg: number;
}

/**
 * D-92 (from the R16 spike): 45°. Below 35° the bowl flattens into the polar
 * chart's disc and buries the horizon labels; above 55° the zenith leaves the
 * top of the drawing.
 */
export const DEFAULT_TILT_DEG = 45;
export const PITCH_MIN_DEG = 5;
export const PITCH_MAX_DEG = 80;
/** Keyboard steps (FR-GUIDE-2, PLAN §8.3). */
export const YAW_STEP_DEG = 15;
export const PITCH_STEP_DEG = 5;
/** Drag sensitivity, the same as glyphcss's orbit controls: 4 px per degree. */
export const DRAG_PX_PER_DEG = 4;
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
export const ZOOM_HEIGHT_DIVISOR = 1.7;
export const REFERENCE_WIDTH_PX = 390;
/** FR-DOME-1's number: the drawing's extent, labels included, against the shorter side of its box. */
export const MIN_EXTENT_RATIO = 0.9;
/** FR-DOME-1 as amended (v1.1.1, F-51): …and never more than the whole of it. */
export const MAX_EXTENT_RATIO = 1;
/** `.label` in the stylesheet: the font size and the advance a label is laid out at, so a label's box can be sized in world units. */
export const LABEL_FONT_PX = 11;
export const LABEL_ADVANCE = 0.6;

/** The fit rule: CSS px per world unit for a box, from its shorter side (D-177). */
export function zoomFor(widthPx: number, heightPx: number): number {
  return Math.min(widthPx / ZOOM_WIDTH_DIVISOR, heightPx / ZOOM_HEIGHT_DIVISOR);
}

/**
 * D-290 (R57, F-54): what the *raster* has to hold, in world units, as against
 * the divisors above, which are what the *box* has to hold. The two differ by
 * the labels: a label is a DOM element positioned over the grid, not a cell of
 * it, so it may overhang the raster as long as it stays inside the box. The
 * widest thing painted into a cell is the base layer's ground disc at
 * `GROUND_RADIUS` — 2.2 units across, and 2.2 cos 45° tall at the default tilt,
 * the tilt every other divisor here is derived at.
 */
export const INK_WIDTH_UNITS = 2 * GROUND_RADIUS;
export const INK_HEIGHT_UNITS = 2 * GROUND_RADIUS * Math.cos((DEFAULT_TILT_DEG * Math.PI) / 180);
/**
 * The blank columns the clamp keeps either side of the ink — `dome-fit.spec.ts`'s
 * rule. One: on the base layer's coarse grid (half the line layer's columns, so
 * twice the cell) a second column is 7 % of the box, which FR-DOME-1's 0.9 floor
 * has not got to give.
 */
export const INK_MARGIN_CELLS = 1;
/**
 * A hair off the ink so an edge that lands exactly on a cell boundary falls
 * *inside* the last blank column rather than on it. Without it a box where the
 * clamp binds at equality (676.6 px square with whole-pixel advances: 612 px of
 * ink in a 624 px raster of 6 px cells) leaves the margin to float error, and
 * the reader sees the dome touch the edge of the grid.
 */
const INK_EPSILON_PX = 1e-6;

/** The raster a layer is painted on: its size in CSS px, and one cell of it. */
export interface RasterSize {
  widthPx: number;
  heightPx: number;
  cellWidthPx: number;
}

/**
 * D-290 (R57, amending D-279): the fit rule for a box, held to the raster the
 * layer is actually painted on. `zoomFor` sizes the drawing from the box; where
 * the raster covers the box this is the whole rule, and where the raster falls
 * short of it — the retired `MAX_CELL_WIDTH_PX` cap past 1440 CSS px (F-54), or
 * a fit loop that steps the font down for whole-pixel glyph advances — the ink
 * is held inside the grid instead.
 *
 * The width allows `INK_MARGIN_CELLS` either side, which is `dome-fit.spec.ts`'s
 * rule made structural: a drawing wider than its raster is not painted outside
 * it, it is cut at the edge, and the grid it was cut against is the only place
 * the loss shows. The height allows none: `rowsFor` floors the row count, so a
 * cell is a large share of the drawing's height and a dome that tapers smoothly
 * lights its top and bottom row legitimately (the spec asserts the columns
 * only).
 *
 * D-279 clamped both sides with the *box's* divisors, which cost the drawing
 * the 10 % margin the box leaves the labels a second time, on the raster where
 * there are no labels to leave it for: on the pass detail's square box the fit
 * loop settles a raster some 7 % short of the box, and the drawing came out at
 * 0.89 of the shorter side against FR-DOME-1's 0.9 floor (D-291).
 */
export function zoomWithinRaster(widthPx: number, heightPx: number, raster: RasterSize): number {
  const inkWidthPx = Math.min(widthPx, raster.widthPx) - 2 * INK_MARGIN_CELLS * raster.cellWidthPx - INK_EPSILON_PX;
  return Math.min(zoomFor(widthPx, heightPx), inkWidthPx / INK_WIDTH_UNITS, Math.min(heightPx, raster.heightPx) / INK_HEIGHT_UNITS);
}

/** The raster's cell, for `drawingExtent`'s snap allowance; zero where the drawing is measured without a grid. */
export interface CellSize {
  widthPx: number;
  heightPx: number;
}
export const NO_CELL: CellSize = { widthPx: 0, heightPx: 0 };

/**
 * The drawing's extent on screen in CSS px at a zoom and a tilt: the bounding
 * box of the compass ring (the outermost anchors, `COMPASS_LABEL_RADIUS`) and
 * the zenith, grown by half a two-letter compass name on each side. What
 * FR-DOME-1's 90 % rule is measured against. R54 (F-51): grown by one cell
 * too when the raster's cell is given — a label lives in a one-cell hotspot
 * whose corner is the projected point, so on screen its centre is up to half
 * a cell right of and below the anchor, and the ceiling has to count it.
 */
export function drawingExtent(zoom: number, tiltDeg: number, rotYDeg = 0, cell: CellSize = NO_CELL): { width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const take = (at: Tuple3): void => {
    const p = projectToScreen(at, { rotYDeg, tiltDeg });
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  };
  for (let az = 0; az < 360; az += 5) {
    const v = toDome(az, 0);
    take([v.x * COMPASS_LABEL_RADIUS, v.y * COMPASS_LABEL_RADIUS, v.z * COMPASS_LABEL_RADIUS]);
  }
  take([0, 0, COMPASS_LABEL_RADIUS]);
  const label = LABEL_FONT_PX * LABEL_ADVANCE;
  return { width: (maxX - minX) * zoom + 2 * label + cell.widthPx, height: (maxY - minY) * zoom + LABEL_FONT_PX + cell.heightPx };
}

export function clampTilt(tiltDeg: number): number {
  return Math.min(PITCH_MAX_DEG, Math.max(PITCH_MIN_DEG, tiltDeg));
}

/** The initial camera for a pass: facing its rise azimuth (D-17) at the default tilt. */
export function initialFor(pass: Pass | undefined, facingAzDeg?: number): CameraState {
  const facing = facingAzDeg ?? pass?.start.azDeg ?? 0;
  return { facingAzDeg: normalizeAzimuthDeg(facing), tiltDeg: DEFAULT_TILT_DEG };
}

/** glyphcss `rotY` for a facing azimuth (PLAN §8.2). */
export function toRotY(facingAzDeg: number): number {
  return normalizeAzimuthDeg(360 - facingAzDeg);
}

/** The facing azimuth for a glyphcss `rotY` (the inverse of `toRotY`). */
export function facingFromRotY(rotYDeg: number): number {
  return normalizeAzimuthDeg(360 - rotYDeg);
}

export function turn(state: CameraState, byDeg: number): CameraState {
  return { ...state, facingAzDeg: normalizeAzimuthDeg(state.facingAzDeg + byDeg) };
}

export function tilt(state: CameraState, byDeg: number): CameraState {
  return { ...state, tiltDeg: clampTilt(state.tiltDeg + byDeg) };
}

/**
 * A drag by (dx, dy) CSS pixels: the dome follows the finger, so dragging
 * right turns the view left (the facing azimuth decreases) and dragging
 * down brings the near horizon toward the viewer (the tilt decreases toward
 * top-down).
 */
export function drag(state: CameraState, dxPx: number, dyPx: number): CameraState {
  return tilt(turn(state, -dxPx / DRAG_PX_PER_DEG), -dyPx / DRAG_PX_PER_DEG);
}

/** FR-GUIDE-4: what the readout under the dome says, as parameters; `Messages['chart']['readout']` words it (R17, FR-I18N-2). */
export function readoutParams(state: CameraState): { point: CompassPoint; azimuth: string; tilt: string } {
  return { point: compassPoint(state.facingAzDeg), azimuth: degrees(state.facingAzDeg), tilt: degrees(state.tiltDeg) };
}

/**
 * FR-DOME-1 (R21, D-91, amending D-65): the drawing fills its box and the
 * grid follows its size — the cell keeps the 6.5 px it has at 390 px, so the
 * column count grows with the width and a desktop panel gets a finer drawing
 * rather than a scaled-up phone one. The growth is capped at 120 columns: at
 * 1280 px the literal rule is 197 columns and measures 18.8 rasterisations/s
 * under the D-62 method against 26.2/s at 120, the cap halves the longest
 * frame under load, and 120 is still twice the phone's detail. The rows
 * follow the box's height at cell aspect 2, so no frame and no letterbox is
 * left over. 60 × 30 at 6.5 × 13 px is the small end and the default without
 * a measurement — the phone's grid is exactly R15's.
 */
export const GRID_COLS = 60;
export const GRID_ROWS = 30;
export const MAX_GRID_COLS = 120;
export const CELL_ASPECT = 2;
export const DEFAULT_CELL_WIDTH_PX = 6.5;
export const MIN_CELL_WIDTH_PX = 4;
/** D-92: the base layer is a wash under the lines, at half their columns. */
export const BASE_COLS_RATIO = 0.5;
export const MIN_BASE_COLS = 8;

/**
 * The base layer's shading (D-92, from the R16 spike): the `blocks` ramp
 * reads as a wash where the default ramp scatters dashes and reads as noise,
 * and the two light intensities are the ones the spike's captures were
 * picked from.
 */
export const BASE_GLYPH_PALETTE = 'blocks';
export const AMBIENT_INTENSITY = 0.35;
export const KEY_INTENSITY = 0.85;

/**
 * D-111: FR-DOME-6 puts the real Sun on the chart, and that is R22's task —
 * it owns the prop that carries it. Until then the base layer's key light
 * points along a fixed civil-twilight direction, so the bowl is shaded from
 * one side rather than lit flat, and R22 replaces this with the Sun the
 * worker reports. The altitude is inside the −18°..0° band of FR-DOME-6, so
 * the same number drives a glow once there is a Sun to draw.
 */
export const DEFAULT_SUN = { azDeg: 270, altDeg: -8 } as const;

/** FR-DOME-1: how many columns a host of this width gets, between the phone's 60 and the D-91 cap. */
export function colsFor(hostWidthPx: number | null): number {
  if (hostWidthPx === null || !Number.isFinite(hostWidthPx) || hostWidthPx <= 0) return GRID_COLS;
  return Math.min(MAX_GRID_COLS, Math.max(GRID_COLS, Math.round(hostWidthPx / DEFAULT_CELL_WIDTH_PX)));
}

/** D-92: the base layer's column count for a line layer of `cols`. */
export function baseColsFor(cols: number): number {
  return Math.max(MIN_BASE_COLS, Math.round(cols * BASE_COLS_RATIO));
}
/**
 * Glyph advances as fractions of the font size, measured at mount by
 * `SkyDome` on the glyphs the raster uses: the braille cells usually come
 * from a fallback font whose advance differs from the monospace font's
 * space, so the font size is set from the braille advance and the space is
 * widened with `word-spacing` to match. This is the fallback where nothing
 * can be measured (jsdom).
 */
export interface GlyphAdvance {
  braille: number;
  space: number;
}
export const DEFAULT_ADVANCE: GlyphAdvance = { braille: 0.6, space: 0.6 };

export interface DomeLayout {
  /** FR-DOME-1: the grid this layer is drawn on, from the box it fills. */
  cols: number;
  rows: number;
  cellWidthPx: number;
  cellHeightPx: number;
  /** The font size that makes one cell exactly `cellWidthPx` wide. */
  fontSizePx: number;
  /** Added to every space so a space is as wide as a braille cell. */
  wordSpacingPx: number;
  zoom: number;
}

const usable = (ratio: number, fallback: number): number => (Number.isFinite(ratio) && ratio > 0 ? ratio : fallback);

/** Rendered widths of one full row of braille and one of spaces at a font size, measured in the raster's font. */
export interface RowMetrics {
  brailleRowPx: number;
  spaceRowPx: number;
}
/** The font-size step of the fit search, and its length. */
export const FIT_STEP_PX = 0.1;
const FIT_STEPS = 80;
/** A row may exceed the box by this much (a rounding error, hidden by overflow) before the font steps down. */
const FIT_SLACK_PX = 0.5;

/**
 * The layout that actually fits the host: some platforms (Linux Chromium
 * without subpixel positioning) round every glyph advance to whole pixels,
 * so the font size computed from the advance ratio can render a row wider
 * than the box. Starting from that size, the font shrinks in 0.1 px steps
 * until a measured 60-cell row fits, and the cell, the word spacing, the
 * column count and the zoom follow the measured row. Falls back to
 * `layoutFor` when nothing can be measured.
 *
 * D-293 (R57): the column count is **not** touched here. A cell rounded down to
 * a whole pixel leaves the raster short of the box — 60 cells of 5 px in a
 * 354 px box — and the drawing on it is short of the box with it, below
 * FR-DOME-1's 0.9 floor. Giving the settled cell the columns it leaves room for
 * would recover that, but it lets the grid pass `MAX_GRID_COLS` and makes the
 * count depend on the platform's glyph rounding, so the same box would be a
 * 60-column picture here and a 69-column one on Linux. The grid is the
 * picture's texture; the exact, platform-independent count is worth more than
 * the last few per cent of fill.
 */
export function fitLayout(hostWidthPx: number | null, hostHeightPx: number | null, advance: GlyphAdvance, measureRows: (fontSizePx: number, cols: number) => RowMetrics, cols = colsFor(hostWidthPx)): DomeLayout {
  const base = layoutFor(hostWidthPx, hostHeightPx, advance, cols);
  if (hostWidthPx === null || !Number.isFinite(hostWidthPx) || hostWidthPx <= 0) return base;
  const minFontPx = MIN_CELL_WIDTH_PX / usable(advance.braille, DEFAULT_ADVANCE.braille);
  let fontSizePx = base.fontSizePx;
  for (let step = 0; step < FIT_STEPS; step++) {
    const rows = measureRows(fontSizePx, cols);
    if (!(rows.brailleRowPx > 0)) return base;
    if (rows.brailleRowPx <= hostWidthPx + FIT_SLACK_PX || fontSizePx <= minFontPx) {
      const cellWidthPx = rows.brailleRowPx / cols;
      const cellHeightPx = cellWidthPx * CELL_ASPECT;
      const fitRows = rowsFor(hostHeightPx, cellHeightPx, cols);
      const spaceRowPx = rows.spaceRowPx > 0 ? rows.spaceRowPx : rows.brailleRowPx;
      const height = hostHeightPx !== null && Number.isFinite(hostHeightPx) && hostHeightPx > 0 ? hostHeightPx : hostWidthPx;
      // R57 (D-279, D-290, F-54): re-clamp against the raster the fit loop actually settled on,
      // not the pre-fit cell `base.zoom` was sized for — a font that steps down here paints a
      // narrower raster than `layoutFor`'s own clamp accounted for.
      const zoom = zoomWithinRaster(hostWidthPx, height, { widthPx: cols * cellWidthPx, heightPx: fitRows * cellHeightPx, cellWidthPx });
      return { ...base, rows: fitRows, cellWidthPx, cellHeightPx, fontSizePx, wordSpacingPx: (rows.brailleRowPx - spaceRowPx) / cols, zoom };
    }
    fontSizePx = Math.max(minFontPx, fontSizePx - FIT_STEP_PX);
  }
  return base;
}

/**
 * FR-DOME-1: rows enough to fill the box's height at cell aspect 2; a square
 * box is `cols / 2` rows, the phone's 30. R54 (F-51): the count rounds down,
 * not to nearest — a row that only half fits was a row drawn past the box
 * (24 rows of 14 px in a 325 px box, 11 px over at 1280 × 800), and a box is
 * never more than one row short of full. The tolerance absorbs the float
 * error of a box that is an exact number of rows.
 */
const ROWS_TOLERANCE = 1e-6;
function rowsFor(hostHeightPx: number | null, cellHeightPx: number, cols: number): number {
  const square = Math.max(2, Math.round(cols / CELL_ASPECT));
  if (hostHeightPx === null || !Number.isFinite(hostHeightPx) || hostHeightPx <= 0 || cellHeightPx <= 0) return square;
  return Math.max(2, Math.floor(hostHeightPx / cellHeightPx + ROWS_TOLERANCE));
}

/**
 * The grid and the cell for a box of this size. `zoom` is CSS pixels per
 * world unit against the box, not the cell (D-91), so both layers of the
 * stacked dome take the same value however coarse each one is.
 *
 * R32 (FR-LIVE-1, D-161): against the box's *shorter* side. The guide's box
 * is square, so nothing changes there; the live page's is the viewport's
 * leftover, wider than tall on a desktop, and a zoom taken from its width
 * put the top of the dome — north, and every label up there — outside it.
 * R45 (D-187): the shorter side through `zoomFor`'s two divisors, so the
 * drawing fills ≥ 90 % of it.
 */
export function layoutFor(hostWidthPx: number | null, hostHeightPx: number | null = null, advance: GlyphAdvance = DEFAULT_ADVANCE, cols = colsFor(hostWidthPx)): DomeLayout {
  const measured = hostWidthPx !== null && Number.isFinite(hostWidthPx) && hostWidthPx > 0;
  // R57 (D-279): no upper cap — once the column cap binds the cell keeps growing, so `cols ×
  // cellWidthPx` covers the box at every width instead of stalling at 12 px past 1440 CSS px.
  const cellWidthPx = measured ? Math.max(MIN_CELL_WIDTH_PX, hostWidthPx / cols) : DEFAULT_CELL_WIDTH_PX;
  const braille = usable(advance.braille, DEFAULT_ADVANCE.braille);
  const space = usable(advance.space, braille);
  const fontSizePx = cellWidthPx / braille;
  const width = measured ? hostWidthPx : REFERENCE_WIDTH_PX;
  const height = hostHeightPx !== null && Number.isFinite(hostHeightPx) && hostHeightPx > 0 ? hostHeightPx : width;
  const cellHeightPx = cellWidthPx * CELL_ASPECT;
  const rows = rowsFor(hostHeightPx, cellHeightPx, cols);
  return {
    cols,
    rows,
    cellWidthPx,
    cellHeightPx,
    fontSizePx,
    wordSpacingPx: cellWidthPx - space * fontSizePx,
    // R57 (D-279, D-290): the ceiling holds by construction even if a cell cap is ever
    // reintroduced — the drawing is never sized for more box than the raster it will actually
    // paint covers. Only where a box was actually measured: unmeasured, `cols` may be the base
    // layer's caller-supplied override (D-92, half the line layer's) rather than `colsFor`'s own
    // count, and the two layers must still share one zoom (D-91) against the same
    // `REFERENCE_WIDTH_PX` box.
    zoom: measured ? zoomWithinRaster(width, height, { widthPx: cols * cellWidthPx, heightPx: rows * cellHeightPx, cellWidthPx }) : zoomFor(width, height),
  };
}

/** One raster layer's font, as `SkyDome` measures it on the stage at mount. */
export interface LayerFont {
  advance: GlyphAdvance;
  measureRows: (fontSizePx: number, cols: number) => RowMetrics;
}

/**
 * The stacked dome's two layouts for one box: the line layer at `colsFor`'s
 * count, the base layer under it at half of that (D-92), both fitted to the
 * same box in their own font.
 *
 * D-91, restored by D-292 (R57): the two draw at **one** zoom. glyphcss
 * measures zoom against the cell it probes at mount, so a coarser layer left at
 * its own number is drawn at a different size from the finer one over it.
 * Before R57 both layers took `zoomFor(width, height)` and were equal by
 * construction; D-279's clamp is per layer, computed from that layer's own
 * floored `rows × cellHeightPx` and its own settled cell, so the two diverged —
 * 690.2 against 667.9, 3.2 % apart, on the live page at 2560 × 1440. The pair
 * takes the smaller of the two, which is the one zoom that fits both rasters
 * and so keeps D-279's guarantee for both. The composition lives here rather
 * than in the component so the rule is a unit test rather than a render one.
 */
export function fitLayers(hostWidthPx: number | null, hostHeightPx: number | null, lineFont: LayerFont, baseFont: LayerFont): { lines: DomeLayout; base: DomeLayout } {
  const lines = fitLayout(hostWidthPx, hostHeightPx, lineFont.advance, lineFont.measureRows);
  const base = fitLayout(hostWidthPx, hostHeightPx, baseFont.advance, baseFont.measureRows, baseColsFor(lines.cols));
  const zoom = Math.min(lines.zoom, base.zoom);
  return { lines: { ...lines, zoom }, base: { ...base, zoom } };
}

/**
 * F-35: whether two layouts draw the same thing, so a resize observer can
 * skip a state update that would change nothing on screen. `zoom` follows the
 * box's shorter side (D-161) and can move on a height-only resize even when
 * the column-driven cell, font and row count do not, so it has to be
 * compared alongside them rather than left out.
 */
export function sameLayout(a: DomeLayout, b: DomeLayout): boolean {
  return Math.abs(a.cellWidthPx - b.cellWidthPx) < 0.01 && Math.abs(a.zoom - b.zoom) < 0.01 && a.fontSizePx === b.fontSizePx && a.cols === b.cols && a.rows === b.rows;
}

/** The base layer's layout (D-92): the same box and the same zoom, half the columns, in the page's monospace font. */
export function baseLayoutFor(line: DomeLayout, hostWidthPx: number | null, hostHeightPx: number | null, monoAdvance: number): DomeLayout {
  const cols = baseColsFor(line.cols);
  const width = hostWidthPx !== null && Number.isFinite(hostWidthPx) && hostWidthPx > 0 ? hostWidthPx : line.cellWidthPx * line.cols;
  const cellWidthPx = width / cols;
  const advance = usable(monoAdvance, DEFAULT_ADVANCE.braille);
  return {
    cols,
    rows: rowsFor(hostHeightPx, cellWidthPx * CELL_ASPECT, cols),
    cellWidthPx,
    cellHeightPx: cellWidthPx * CELL_ASPECT,
    fontSizePx: cellWidthPx / advance,
    wordSpacingPx: 0,
    zoom: line.zoom,
  };
}
