import { GLYPH_SIZES, SIZE_PX, type SizeToken, type StarGlyph } from './starGlyphs';

/**
 * R114 (FR-STAR-6 as amended, V24-15; PLAN D-746, D-752): where each glyph's
 * ink sits in its em box, measured once, so a star's ink and not its box is
 * centred on the projected point.
 *
 * In `--font-mono` the em box's centre is not the ink's: the spike measured
 * `.` 1.9–2.4 px below the point and `*` and `+` 0.6–0.9 px above it, so
 * every figure line stopped short of its faint star (`docs/stars/FINDINGS.md`
 * §5). The fix is a shift per glyph and size: after `document.fonts.ready`, a
 * canvas 2D context set to the window's computed `--font-mono` measures each
 * glyph × size the ladder uses with `textAlign = 'center'` and
 * `textBaseline = 'middle'` — the same centring the SVG text gets from
 * `text-anchor: middle` and `dominant-baseline: central` — and the offset is
 * the negated centre of `actualBoundingBox{Left,Right,Ascent,Descent}`,
 * rounded to 0.1 px and kept in a module map. The field writes it as `dx`/`dy`
 * when a node is created or its rung changes, never per frame.
 *
 * Where the canvas has no metrics — jsdom has no `document.fonts` and no 2D
 * context — every offset is 0, which is what the unit tests assume; the
 * browser project's `inkOffsets.integration.test.ts` is where the numbers are
 * real. The canvas here is a ruler and draws nothing: FR-GUIDE-5's rule is
 * about what the charts render with, and the module imports no renderer.
 */
export interface InkOffset {
  /** Added to the glyph's `x`: positive moves the ink right. */
  dx: number;
  /** Added to the glyph's `y`: positive moves the ink down. */
  dy: number;
}

const ZERO: InkOffset = { dx: 0, dy: 0 };
const offsets = new Map<string, InkOffset>();
const key = (glyph: StarGlyph, size: SizeToken): string => `${glyph}@${size}`;
const tenth = (value: number): number => Math.round(value * 10) / 10 || 0;

/** The shift for `glyph` at `size`: the measured one, or 0 until (or without) a measurement. */
export function inkOffset(glyph: StarGlyph, size: SizeToken): InkOffset {
  return offsets.get(key(glyph, size)) ?? ZERO;
}

/** Whether the measurement has run and found metrics. */
export function inkMeasured(): boolean {
  return offsets.size > 0;
}

/** The page's own stack, as the window's text is set in it; `monospace` where no sheet is loaded. */
function monoFamily(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
  return family === '' ? 'monospace' : family;
}

/** One measurement of every glyph × size; `false` where the environment has no text metrics. */
function measure(): boolean {
  if (typeof document === 'undefined') return false;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return false;
  const family = monoFamily();
  const found = new Map<string, InkOffset>();
  for (const [glyph, size] of GLYPH_SIZES) {
    context.font = `${String(SIZE_PX[size])}px ${family}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const m = context.measureText(glyph);
    if (typeof m.actualBoundingBoxLeft !== 'number' || typeof m.actualBoundingBoxAscent !== 'number') return false;
    // The ink runs from `-left` to `+right` across and from `-ascent` to `+descent` down; its centre is what the shift cancels.
    const centreX = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
    const centreY = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
    found.set(key(glyph, size), { dx: tenth(-centreX), dy: tenth(-centreY) });
  }
  for (const [k, v] of found) offsets.set(k, v);
  return true;
}

let pending: Promise<boolean> | null = null;

/**
 * Measures once, after the fonts are ready, and resolves `true` when the
 * offsets are in the map; every later call returns the same promise. Without
 * `document.fonts` (jsdom) it resolves `false` at once and touches no canvas.
 */
export function inkOffsetsReady(): Promise<boolean> {
  pending ??= (() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fonts) return Promise.resolve(false);
    return fonts.ready.then(measure, measure);
  })();
  return pending;
}

/** Every measured offset, for the probe that reports them: `*@chart-text-18` → `{ dx, dy }`. */
export function inkOffsetTable(): ReadonlyMap<string, InkOffset> {
  return offsets;
}
