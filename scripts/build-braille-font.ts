/**
 * R15 review (PLAN D-65): the dome's raster is braille cells and spaces,
 * and glyphcss measures its cell from the letter M in the page font. A
 * monospace page font without braille (SF Mono, Roboto Mono, Consolas) makes
 * the browser draw the cells from a fallback face with a different advance,
 * so rows come out wider than 60 cells and the labels drift off the ring.
 * This script generates `wiys-braille.otf`, a font of our own with exactly
 * the glyphs the raster uses at one advance: the 256 braille patterns, the
 * space and the letter M. Nothing else ever renders in it. Deterministic;
 * the output is committed next to `SkyDome.module.css`.
 *
 *   npm run build:braille-font
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import opentype from 'opentype.js';

const OUT = resolve('src/ui/components/guide/skychart/dome/wiys-braille.otf');

/** Units per em, advance (0.6 em: the usual monospace cell), and the line box: ascender 1000, descender −200, so a 1.2 em line is two advances tall (cellAspect 2). */
const UPEM = 1000;
const ADVANCE = 600;
const ASCENDER = 1000;
const DESCENDER = -200;
/** Dot centres: two columns and four rows inside the cell, and the dot radius. */
const COLUMNS = [150, 450];
const ROWS = [850, 550, 250, -50];
const RADIUS = 105;
/** Braille bit order (U+2800 + bits): dots 1–3 down the left column, 4–6 down the right, 7 bottom-left, 8 bottom-right. */
const DOT_POSITIONS: readonly [column: number, row: number][] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [0, 3],
  [1, 3],
];
/** Cubic Bézier circle constant. */
const KAPPA = 0.5522847498;

function circle(path: opentype.Path, cx: number, cy: number, r: number): void {
  const k = KAPPA * r;
  path.moveTo(cx + r, cy);
  path.curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
  path.curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
  path.curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
  path.curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
  path.close();
}

function braillePath(bits: number): opentype.Path {
  const path = new opentype.Path();
  DOT_POSITIONS.forEach(([column, row], dot) => {
    if (bits & (1 << dot)) circle(path, COLUMNS[column] ?? 0, ROWS[row] ?? 0, RADIUS);
  });
  return path;
}

function build(): opentype.Font {
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: ADVANCE, path: new opentype.Path() });
  const space = new opentype.Glyph({ name: 'space', unicode: 0x20, advanceWidth: ADVANCE, path: new opentype.Path() });
  // The letter glyphcss measures its cell with: a plain box, never seen (only braille and spaces reach the raster).
  const mPath = new opentype.Path();
  mPath.moveTo(100, 0);
  mPath.lineTo(100, 700);
  mPath.lineTo(500, 700);
  mPath.lineTo(500, 0);
  mPath.close();
  const m = new opentype.Glyph({ name: 'M', unicode: 0x4d, advanceWidth: ADVANCE, path: mPath });
  const braille = Array.from({ length: 256 }, (_, bits) => new opentype.Glyph({ name: `braille${bits.toString(16).padStart(2, '0')}`, unicode: 0x2800 + bits, advanceWidth: ADVANCE, path: braillePath(bits) }));
  return new opentype.Font({
    familyName: 'WIYS Braille',
    styleName: 'Regular',
    unitsPerEm: UPEM,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs: [notdef, space, m, ...braille],
  });
}

const font = build();
const bytes = Buffer.from(font.toArrayBuffer());
writeFileSync(OUT, bytes);
console.log(`${OUT}: ${String(bytes.length)} bytes, ${String(font.glyphs.length)} glyphs`);
