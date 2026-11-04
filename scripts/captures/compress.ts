/**
 * PLAN D-1068 (FR-SDD-22): captures are written losslessly compressed. A PNG is decoded and
 * re-encoded at deflate level 9 with every row filter tried, and without the alpha channel when
 * every pixel is opaque (a screenshot always is), so the pixels are the same and the file is
 * smaller. The capture spec writes through `compressPng`; the CLI rewrites files in place.
 *
 *   npx tsx scripts/captures/compress.ts <file.png>...
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

/** True when every pixel's alpha is 255, so the RGB encoding drops nothing. */
export function opaque(png: PNG): boolean {
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] !== 255) return false;
  return true;
}

/** The same pixels at deflate level 9, adaptive filtering, RGB when opaque. Never larger than the input. */
export function compressPng(input: Buffer): Buffer {
  const png = PNG.sync.read(input);
  const colorType = opaque(png) ? 2 : 6;
  const output = PNG.sync.write(png, { deflateLevel: 9, filterType: -1, colorType, inputColorType: 6, inputHasAlpha: true, bitDepth: 8 });
  return output.length < input.length ? output : input;
}

/** Rewrites each file compressed; returns the bytes saved per file. */
export function compressFiles(paths: readonly string[]): { path: string; before: number; after: number }[] {
  return paths.map((path) => {
    const before = readFileSync(path);
    const after = compressPng(before);
    if (after !== before) writeFileSync(path, after);
    return { path, before: before.length, after: after.length };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const rows = compressFiles(process.argv.slice(2));
  const before = rows.reduce((sum, row) => sum + row.before, 0);
  const after = rows.reduce((sum, row) => sum + row.after, 0);
  console.log(`${String(rows.length)} file(s): ${String(before)} → ${String(after)} bytes`);
}
