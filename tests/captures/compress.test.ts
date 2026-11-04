/**
 * R178 (FR-SDD-22, PLAN D-1068): captures are written losslessly compressed — the same pixels,
 * deflate level 9, never a larger file.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { compressFiles, compressPng, opaque } from '../../scripts/captures/compress';

/** A screenshot-like picture written the way a fast encoder writes it: level 1, no filter search. */
function loose(alpha = 255): Buffer {
  const png = new PNG({ width: 120, height: 80 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const at = (y * png.width + x) * 4;
      png.data[at] = (x * 2) % 256;
      png.data[at + 1] = y < 40 ? 20 : 200;
      png.data[at + 2] = (x + y) % 7 === 0 ? 255 : 30;
      png.data[at + 3] = alpha;
    }
  }
  return PNG.sync.write(png, { deflateLevel: 1, filterType: 0 });
}

describe('compressPng', () => {
  it('keeps every pixel and makes the file smaller', () => {
    const input = loose();
    const output = compressPng(input);
    expect(output.length).toBeLessThan(input.length);
    expect(PNG.sync.read(output).data.equals(PNG.sync.read(input).data)).toBe(true);
  });

  it('drops the alpha channel only when every pixel is opaque', () => {
    expect(opaque(PNG.sync.read(loose()))).toBe(true);
    expect(compressPng(loose())[25]).toBe(2); // IHDR colour type: RGB
    const translucent = loose(128);
    expect(opaque(PNG.sync.read(translucent))).toBe(false);
    const output = compressPng(translucent);
    expect(PNG.sync.read(output).data.equals(PNG.sync.read(translucent).data)).toBe(true);
    expect(output[25]).toBe(6);
  });

  it('never returns a larger file: a compressed one comes back as it is', () => {
    const once = compressPng(loose());
    expect(compressPng(once).length).toBeLessThanOrEqual(once.length);
  });

  it('rewrites files in place through the CLI helper', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'captures-compress-')), 'v1-x.png');
    writeFileSync(path, loose());
    const [row] = compressFiles([path]);
    expect(row?.after).toBeLessThan(row?.before ?? 0);
    expect(readFileSync(path).length).toBe(row?.after);
  });
});
