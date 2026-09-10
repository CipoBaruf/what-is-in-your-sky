/**
 * R74 (FR-MARK-6 as amended, D-459): the shipped PNGs are the committed
 * rasters, drawn — not a second drawing, and not a stale file.
 *
 * Until v2.0 the icons were pinned by bytes: `scripts/build-icons.ts` encoded
 * them with `node:zlib` and `tests/deploy/manifest.test.ts` asserted the file
 * on disk equalled what the encoder produced. D-440 replaced that encoder with
 * a Playwright screenshot of braille text, and a screenshot is not
 * reproducible across machines — the committed PNGs are rendered on whichever
 * machine ran `npm run build:icons`, and CI is `ubuntu-latest`, with a
 * different Chromium and a different text rasteriser. Byte identity would fail
 * for the one reason we do not care about.
 *
 * So the pin moved from the bytes to the drawing. Every tier is a grid of
 * braille cells laid over the square — 24 columns into 192 px is 8 px a cell,
 * and into 512 px it is the same drawing at 21.33, so cell edges there are
 * fractional and the walk below rounds them. This test walks that grid on the
 * decoded pixels and asks two questions of each cell:
 *
 *   - is there ink in it, and does that match the raster's body plus its
 *     frame-0 bead?
 *   - is that ink the bead's tone or the body's, and does *that* match?
 *
 * Both survive a change of font rasteriser, because they are questions about
 * which cells were drawn in, not about what the antialiasing did inside them.
 * The margins are wide: measured on the committed files, an inked cell has at
 * least 8 non-background pixels and a blank one has exactly 0, and the body's
 * blue-minus-red reaches 20 where the bead's is 87 or more.
 *
 * A stale icon — the scene's constants changed and `npm run build:icons` never
 * re-run — moves dozens of cells and fails here. `tests/build/mark-rasters.test.ts`
 * pins the rasters to the generator; this pins the pictures to the rasters.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ICON_TONES } from '../../scripts/build-mark';
import { MARK_GRIDS, MARK_IMAGES, type MarkRasters } from '../../src/ui/components/mark/tiers';

/** A cell counts as inked when a channel is this far off `--bg`; measured margin is 94. */
const INK = 24;
/** Blue minus red separates the two tones: the body reaches 20, the bead 87. */
const BEAD = 50;

interface Decoded {
  width: number;
  height: number;
  channels: number;
  pixels: Buffer;
}

/**
 * Enough of a PNG reader for our own files: 8 bits a channel, truecolour with
 * or without alpha, no interlacing. Four chunk types and the five filters —
 * the same corner of the format `scripts/build-icons.ts` used to write, read
 * back. A file this test cannot decode is a file the generator did not write,
 * which is itself worth failing on.
 */
function decode(path: string): Decoded {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8).toString('hex'), `${path} is not a PNG`).toBe('89504e470d0a1a0a');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const tag = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + length);
    if (tag === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8] ?? 0;
      colour = data[9] ?? 0;
    } else if (tag === 'IDAT') idat.push(data);
    else if (tag === 'IEND') break;
    pos += 12 + length;
  }
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
  expect(depth, `${path}: only 8-bit PNGs are read here`).toBe(8);
  expect(channels, `${path}: only truecolour PNGs are read here (colour type ${String(colour)})`).toBeGreaterThan(0);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    const line = raw.subarray(read, read + stride);
    read += stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      let value = line[x] ?? 0;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const guess = left + up - upLeft;
        const dl = Math.abs(guess - left);
        const du = Math.abs(guess - up);
        const dul = Math.abs(guess - upLeft);
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

const rgb = (hex: string): [number, number, number] => [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];

/** The cells of one image, each as `row,col`, split by what is drawn in them. */
function readCells(image: Decoded, cols: number, rows: number): { ink: Set<string>; bead: Set<string> } {
  const [bgR, bgG, bgB] = rgb(ICON_TONES.bg);
  const cellW = image.width / cols;
  const cellH = image.height / rows;
  const ink = new Set<string>();
  const bead = new Set<string>();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let inked = 0;
      let brightest = -1;
      for (let y = Math.floor(row * cellH); y < Math.round((row + 1) * cellH); y++) {
        for (let x = Math.floor(col * cellW); x < Math.round((col + 1) * cellW); x++) {
          const at = (y * image.width + x) * image.channels;
          const r = image.pixels[at] ?? 0;
          const g = image.pixels[at + 1] ?? 0;
          const b = image.pixels[at + 2] ?? 0;
          if (Math.max(Math.abs(r - bgR), Math.abs(g - bgG), Math.abs(b - bgB)) <= INK) continue;
          inked++;
          if (r + g + b > brightest) {
            brightest = r + g + b;
            if (b - r > BEAD) bead.add(`${String(row)},${String(col)}`);
            else bead.delete(`${String(row)},${String(col)}`);
          }
        }
      }
      if (inked > 0) ink.add(`${String(row)},${String(col)}`);
    }
  }
  return { ink, bead };
}

const RASTERS = JSON.parse(readFileSync('src/ui/components/mark/rasters.json', 'utf8')) as MarkRasters;
const sorted = (cells: Iterable<string>): string[] => [...cells].sort((a, b) => a.localeCompare(b));

describe('public/*.png are the committed rasters, drawn (FR-MARK-6, D-459)', () => {
  for (const image of MARK_IMAGES) {
    describe(image.file, () => {
      const raster = RASTERS[image.tier];
      const { cols, rows } = MARK_GRIDS[image.tier];
      const decoded = decode(`public/${image.file}`);
      const drawn = readCells(decoded, cols, rows);

      /** The body's non-blank cells plus the bead's: the blank braille cell and the space draw the same nothing. */
      const wantBead = new Set((raster.frames[0] ?? []).map(([row, col]) => `${String(row)},${String(col)}`));
      const wantInk = new Set(wantBead);
      raster.body.split('\n').forEach((line, row) => {
        [...line].forEach((glyph, col) => {
          if (glyph !== ' ' && glyph !== '⠀') wantInk.add(`${String(row)},${String(col)}`);
        });
      });

      it(`is ${String(image.px)} x ${String(image.px)}`, () => {
        expect([decoded.width, decoded.height]).toEqual([image.px, image.px]);
      });

      it('inks exactly the cells the raster inks', () => {
        expect(sorted(drawn.ink), `${image.file} is stale or hand-edited: run npm run build:icons`).toEqual(sorted(wantInk));
      });

      it("draws the bead in `--accent` and the body in `--fg-dim`", () => {
        expect(sorted(drawn.bead), `${image.file}'s bead is not where frame 0 puts it: run npm run build:icons`).toEqual(sorted(wantBead));
      });
    });
  }
});
