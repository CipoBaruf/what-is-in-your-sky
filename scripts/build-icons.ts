/**
 * R25 (FR-OFF-6, D-127): generates `public/icon-192.png` and
 * `public/icon-512.png`, the PWA install icons, from the design tokens.
 *
 *   npm run build:icons
 *
 * The icons are drawn, not painted: a 16 x 16 cell grid — the same grid the
 * page and the sky dome are laid out on — carrying a horizon rule with a pass
 * arcing over it and a marked peak, in `--chart-horizon`, `--chart-pass` and
 * `--chart-peak` on the dark theme's `--bg`. 16 divides both sizes exactly
 * (32 px and 12 px per cell), so every cell is a whole number of pixels and
 * the two files are the same drawing at two resolutions, with no resampling
 * and no antialiasing to soften the terminal look.
 *
 * The drawing stays inside the central 80 % (cells 2..13 of 0..15), the safe
 * zone a maskable icon is cropped to, so a launcher that rounds or circles
 * the icon cannot cut the arc — which is why both icons declare `any` and we
 * ship no separate maskable file (FR-OFF-6 asks for two icons).
 *
 * PNG is written here rather than pulled in as a dependency: an 8-bit RGB
 * image with no palette and no alpha is four chunks and one `deflate` call
 * from `node:zlib`, and the alternative is a rasteriser in the dev tree for
 * two files that change about never.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

/** Design tokens (`src/ui/styles/tokens.css`, dark theme), as RGB triples. */
const BG: RGB = [0x0b, 0x0f, 0x14]; // --bg
const HORIZON: RGB = [0xa7, 0xb1, 0xbf]; // --chart-horizon
const PASS: RGB = [0x9a, 0xd0, 0xff]; // --chart-pass
const PEAK: RGB = [0xf0, 0xc6, 0x74]; // --chart-peak

export type RGB = readonly [r: number, g: number, b: number];

export const GRID = 16;
/** The maskable safe zone: the drawing never leaves these cells. */
export const SAFE = { min: 2, max: 13 } as const;
const HORIZON_ROW = 11;

/**
 * The lit cells, as `[column, row, colour]`. The arc is a parabola from the
 * horizon at the left edge of the safe zone to the horizon at its right,
 * peaking four rows above the rule — one sample per column, so the arc is a
 * run of single cells and reads as a track rather than a band.
 */
export function cells(): [x: number, y: number, colour: RGB][] {
  const lit: [number, number, RGB][] = [];
  for (let x = SAFE.min; x <= SAFE.max; x++) lit.push([x, HORIZON_ROW, HORIZON]);

  const span = SAFE.max - SAFE.min;
  const peakX = SAFE.min + span / 2;
  const height = 6;
  for (let x = SAFE.min + 1; x < SAFE.max; x++) {
    // 1 at the peak, 0 at both ends of the span.
    const t = 1 - ((x - peakX) / (span / 2)) ** 2;
    const y = HORIZON_ROW - 1 - Math.round(t * (height - 1));
    lit.push([x, y, Math.abs(x - peakX) < 0.51 ? PEAK : PASS]);
  }
  return lit;
}

/** The icon as raw RGB rows, `size` px square; `size` must be a multiple of `GRID`. */
export function pixels(size: number): Uint8Array {
  if (size % GRID !== 0) throw new Error(`${String(size)} px is not a whole number of ${String(GRID)} cells`);
  const cell = size / GRID;
  const data = new Uint8Array(size * size * 3);
  for (let i = 0; i < data.length; i += 3) [data[i], data[i + 1], data[i + 2]] = BG;
  for (const [cx, cy, [r, g, b]] of cells()) {
    for (let y = cy * cell; y < (cy + 1) * cell; y++) {
      for (let x = cx * cell; x < (cx + 1) * cell; x++) {
        const i = (y * size + x) * 3;
        [data[i], data[i + 1], data[i + 2]] = [r, g, b];
      }
    }
  }
  return data;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** An 8-bit RGB PNG (colour type 2), one `deflate` over filter-0 scanlines. */
export function png(size: number): Buffer {
  const rgb = pixels(size);
  const stride = size * 3;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // depth 8, truecolour, deflate, no filter, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

function main(): void {
  for (const size of [192, 512]) {
    const out = resolve(`public/icon-${String(size)}.png`);
    const bytes = png(size);
    writeFileSync(out, bytes);
    console.log(`${out}: ${String(bytes.length)} bytes, ${String(size)} x ${String(size)}`);
  }
}

if (process.argv[1]?.endsWith('build-icons.ts')) main();
