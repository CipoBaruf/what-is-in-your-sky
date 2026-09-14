/**
 * R74 (FR-MARK-6, FR-MARK-8 f as amended v2.0.1, D-460): the five files under
 * `public/` are the scene, drawn as dots — not a stale file, not a hand edit,
 * and not a photograph.
 *
 * Until v2.0 the icons were pinned by bytes: `scripts/build-icons.ts` encoded
 * them with `node:zlib` and `tests/deploy/manifest.test.ts` asserted the file
 * on disk equalled the encoder's output. D-440 replaced the encoder with a
 * Playwright screenshot of braille text, which is not reproducible across
 * machines, so D-459 pinned the icons cell by cell instead; and at 16 px the
 * screenshot could not survive the font at all. D-460 draws the files as dots
 * with nothing in the path that varies by machine, so the pin is bytes again:
 * `renderImages()` here is the same call `npm run build:icons -- --icons`
 * makes, and the committed file must equal it exactly.
 *
 * The structural checks are FR-MARK-8 (f): every pixel is one of the three
 * declared tones and no fourth (a fourth colour means something was
 * resampled, which is the bug this test exists to keep out); every dot is one
 * square of pixels at the pitch; every bead pixel has only ground or bead
 * among its eight neighbours (the cleared dot, without which the bead is a
 * brighter stretch of ring); the bead is at least a 2 × 2 block of pixels
 * (four contiguous, so it is a dot and not a speck); and the bezel has body
 * ink in each of the eight octants around the centre (the ring is closed).
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ICON_TONES, renderImages } from '../../scripts/build-mark';
import { dotsToText, renderDots } from '../../spike/mark/dots';
import { MARK_IMAGES, MARK_SVG } from '../../src/ui/components/mark/tiers';

interface Decoded {
  width: number;
  height: number;
  channels: number;
  pixels: Buffer;
}

/**
 * Enough of a PNG reader for our own files: 8 bits a channel, truecolour with
 * or without alpha, no interlacing. A file this cannot decode is a file the
 * generator did not write, which is itself worth failing on.
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

type Tone = 'bg' | 'dim' | 'accent';
const TONES = new Map<string, Tone>((Object.entries(ICON_TONES) as [Tone, string][]).map(([tone, hex]) => [hex.toLowerCase(), tone]));

/** Every pixel named by its tone, or by its hex when it is none of the three. */
function tones(image: Decoded): string[][] {
  const rows: string[][] = [];
  for (let y = 0; y < image.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < image.width; x++) {
      const at = (y * image.width + x) * image.channels;
      const hex = `#${[0, 1, 2].map((c) => (image.pixels[at + c] ?? 0).toString(16).padStart(2, '0')).join('')}`;
      const alpha = image.channels === 4 ? image.pixels[at + 3] : 255;
      row.push((alpha === 255 && TONES.get(hex)) || hex);
    }
    rows.push(row);
  }
  return rows;
}

const NEIGHBOURS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] as const;
const rendered = renderImages();

describe('public/* are the scene drawn as dots, byte for byte (FR-MARK-6, D-460)', () => {
  for (const image of [...MARK_IMAGES, MARK_SVG]) {
    it(`${image.file} is exactly what the renderer produces`, () => {
      const committed = readFileSync(`public/${image.file}`);
      const want = rendered[image.file];
      expect(want, `the renderer knows nothing of ${image.file}`).toBeDefined();
      if (want && !committed.equals(want)) console.log(`${image.file} as the renderer draws it now:\n${dotsToText(renderDots(image.tier, image.dots))}`);
      expect(want !== undefined && committed.equals(want), `${image.file} is stale or hand-edited: run npm run build:icons -- --icons`).toBe(true);
    });
  }
});

describe('public/*.png, as pixels (FR-MARK-8 f)', () => {
  for (const image of MARK_IMAGES) {
    describe(image.file, () => {
      const decoded = decode(`public/${image.file}`);
      const grid = tones(decoded);
      const pitch = image.px / image.dots;

      it(`is ${String(image.px)} x ${String(image.px)}, ${String(image.dots)} dots at ${String(pitch)} px`, () => {
        expect([decoded.width, decoded.height]).toEqual([image.px, image.px]);
        expect(Number.isInteger(pitch), 'the pitch is a whole number of pixels').toBe(true);
      });

      it('has every pixel in one of the three declared tones and no fourth', () => {
        const others = new Set(grid.flat().filter((tone) => !TONES.has(tone) && tone !== 'bg' && tone !== 'dim' && tone !== 'accent'));
        expect([...others], 'a fourth colour means something was resampled').toEqual([]);
      });

      it('draws each dot as one square of pixels at the pitch', () => {
        const torn: string[] = [];
        for (let y = 0; y < decoded.height; y++) {
          for (let x = 0; x < decoded.width; x++) {
            if (grid[y]?.[x] !== grid[y - (y % pitch)]?.[x - (x % pitch)]) torn.push(`${String(x)},${String(y)}`);
          }
        }
        expect(torn, 'pixels that differ from their dot\'s origin').toEqual([]);
      });

      it('draws the bead as one block of at least 2 x 2 contiguous pixels', () => {
        const beads: [number, number][] = [];
        for (let y = 0; y < decoded.height; y++) for (let x = 0; x < decoded.width; x++) if (grid[y]?.[x] === 'accent') beads.push([y, x]);
        expect(beads.length, 'the bead is drawn').toBeGreaterThanOrEqual(4);
        // One connected block: every bead pixel is reachable from the first through bead pixels.
        const seen = new Set<string>();
        const stack = [beads[0] as [number, number]];
        while (stack.length > 0) {
          const [y, x] = stack.pop() as [number, number];
          const id = `${String(y)},${String(x)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          for (const [dy, dx] of NEIGHBOURS) if (grid[y + dy]?.[x + dx] === 'accent') stack.push([y + dy, x + dx]);
        }
        expect(seen.size, 'the bead is one contiguous block').toBe(beads.length);
        // And a 2 x 2 block somewhere inside it: a bead, not a line.
        const isBead = (y: number, x: number): boolean => grid[y]?.[x] === 'accent';
        expect(beads.some(([y, x]) => isBead(y, x + 1) && isBead(y + 1, x) && isBead(y + 1, x + 1)), 'the bead holds a 2 x 2 block').toBe(true);
      });

      it('keeps ground around the bead: no body pixel touches a bead pixel', () => {
        for (let y = 0; y < decoded.height; y++) {
          for (let x = 0; x < decoded.width; x++) {
            if (grid[y]?.[x] !== 'accent') continue;
            for (const [dy, dx] of NEIGHBOURS) {
              const near = grid[y + dy]?.[x + dx];
              if (near !== undefined) expect(near, `body ink beside the bead at ${String(x + dx)},${String(y + dy)}`).not.toBe('dim');
            }
          }
        }
      });

      it('keeps the bezel closed: body ink in each of the eight octants around the centre', () => {
        // The bezel's band: the outer two dots of the radius, cut into eight by angle.
        const half = image.px / 2;
        const inner = half - 2 * pitch;
        const found = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let y = 0; y < decoded.height; y++) {
          for (let x = 0; x < decoded.width; x++) {
            if (grid[y]?.[x] !== 'dim') continue;
            const dx = x + 0.5 - half;
            const dy = y + 0.5 - half;
            if (Math.hypot(dx, dy) < inner) continue;
            const octant = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8;
            found[octant] = (found[octant] ?? 0) + 1;
          }
        }
        // An eighth of the ring is about `dots × π / 8` dots long; the bead's clearance takes at most a few from one octant.
        const atLeast = Math.max(1, Math.floor(((image.dots * Math.PI) / 8 - 4) * pitch * pitch));
        expect(found.every((count) => count >= atLeast), `bezel ink per octant: ${found.join(', ')} (at least ${String(atLeast)} each)`).toBe(true);
      });
    });
  }
});
