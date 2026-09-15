/**
 * R74 (FR-MARK-6, D-438, D-440): the mark's build step.
 *
 *   npm run build:icons        # everything below
 *
 * It drives the generator page under `spike/mark/` with Playwright — the page
 * is the only thing that imports `@glyphcss/react` outside the dome (D-16,
 * D-28) — and writes three kinds of output from that one drawing:
 *
 *   src/ui/components/mark/rasters.json   every tier's body as text, and each
 *                                         of its 60 bead frames as a sparse
 *                                         `[row, col, glyph]` list (D-439)
 *   public/icon-192.png, icon-512.png,    the same scene drawn as dots at a
 *   public/favicon.png, favicon-32.png,   whole number of pixels a dot, with
 *   public/favicon.svg                    no font in the path (D-460)
 *   docs/readme/*.png                     FR-PUB-11's hero and social preview,
 *                                         whose lockup is the `lockup80` tier
 *
 * The rasters are committed, and `tests/build/mark-rasters.test.ts` (D-458)
 * re-runs `generateRasters()` in CI and asserts the committed file is
 * byte-identical — so the asset cannot drift from the scene that produced it.
 * `tests/build/mark-icons.test.ts` does the same for the five files under
 * `public/`, which `renderImages()` draws without a browser: the dot renderer
 * (`spike/mark/dots.ts`) is a function of the scene's constants alone, and the
 * PNG encoder is filter 0 and one `deflateSync`, so the bytes are the same on
 * every machine. That is also why nothing here reads the clock or a random
 * number.
 *
 *   npm run build:icons -- --icons        only the five files, no browser
 */
import { chromium, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { dotsToText, renderDots, type DotRaster } from '../spike/mark/dots';
import { denseFrame, MARK_GRIDS, MARK_IMAGES, MARK_ORBIT_FRAMES, MARK_SVG, MARK_TIERS, type MarkCell, type MarkRasters } from '../src/ui/components/mark/tiers';
import { main as buildReadmePictures } from './readme-hero';

/** A port of its own, so a running dev server does not collide with the generator. */
const PORT = 5198;
const PAGE = `http://localhost:${String(PORT)}/spike/mark/`;

export const RASTERS_PATH = resolve('src/ui/components/mark/rasters.json');
const PUBLIC = resolve('public');
/**
 * The dark theme's `--bg`, `--chart-horizon`, `--fg-dim` and `--accent`
 * (`src/ui/styles/tokens.css`): the manifest icons' tile, the bezel's tone in
 * the files (one ramp step above the body's, so the ring holds on a light tab
 * strip with no ground under it), the body's and the bead's (FR-MARK-3,
 * FR-MARK-4 e). An icon has no stylesheet, so these are literals;
 * `tests/styles/tokens.test.ts` asserts they equal what `tokens.css` declares,
 * and `tests/build/mark-icons.test.ts` asserts every pixel of every PNG is one
 * of them or transparent (D-460).
 */
export const ICON_TONES = { bg: '#0b0f14', bezel: '#a7b1bf', dim: '#7d8794', accent: '#9ad0ff' } as const;

/** A cell with no ink: the font draws the blank braille cell and the space identically. */
const isBlank = (glyph: string): boolean => glyph === ' ' || glyph === '⠀';

/** The sparse form of a bead layer (D-439): a 32 × 16 grid of spaces is not worth 60 copies. */
export function sparse(text: string): MarkCell[] {
  const cells: MarkCell[] = [];
  text.split('\n').forEach((line, row) => {
    [...line].forEach((glyph, col) => {
      if (!isBlank(glyph)) cells.push([row, col, glyph]);
    });
  });
  return cells;
}

/** Every layer on the page, keyed by tier, layer and frame. */
type Layers = Record<string, string>;

const key = (tier: string, layer: string, frame: number): string => `${tier}/${layer}/${String(frame)}`;

async function readLayers(page: Page): Promise<Layers> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const host of Array.from(document.querySelectorAll<HTMLElement>('[data-mark-layer]'))) {
      const pre = host.querySelector('pre.glyph-output');
      out[`${host.dataset['markTier'] ?? '?'}/${host.dataset['markLayer'] ?? '?'}/${host.dataset['markFrame'] ?? '?'}`] = pre?.textContent ?? '';
    }
    return out;
  });
}

/**
 * The rasters, read once they have stopped changing. glyphcss rasterises on an
 * animation frame, and 366 scenes do not all land on the same one, so the page
 * is read twice and believed only when the two reads agree — the alternative
 * is a fixed sleep that is either too short in CI or too long everywhere.
 */
async function stableLayers(page: Page): Promise<Layers> {
  const expected = MARK_TIERS.length * (1 + MARK_ORBIT_FRAMES);
  let previous: Layers | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const layers = await readLayers(page);
    const complete = Object.keys(layers).length === expected && Object.values(layers).every((text) => text.includes('\n'));
    if (complete && previous && Object.entries(layers).every(([name, text]) => previous?.[name] === text)) return layers;
    previous = layers;
    await page.waitForTimeout(120);
  }
  throw new Error('the generator page never settled: the rasters kept changing');
}

/** Every tier, rasterised. Starts a Vite dev server and a Chromium, and closes both. */
export async function generateRasters(): Promise<MarkRasters> {
  const server: ViteDevServer = await createServer({ configFile: resolve('vite.config.ts'), server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
    await page.goto(PAGE);
    await page.waitForSelector('[data-mark-layer]', { timeout: 60_000 });
    const layers = await stableLayers(page);
    const rasters = {} as MarkRasters;
    for (const tier of MARK_TIERS) {
      const { cols, rows } = MARK_GRIDS[tier];
      const body = layers[key(tier, 'body', -1)];
      if (body === undefined) throw new Error(`no body raster for ${tier}`);
      check(tier, 'body', body, cols, rows);
      const frames: MarkCell[][] = [];
      for (let frame = 0; frame < MARK_ORBIT_FRAMES; frame++) {
        const text = layers[key(tier, 'mark', frame)];
        if (text === undefined) throw new Error(`no bead raster for ${tier} frame ${String(frame)}`);
        check(tier, `frame ${String(frame)}`, text, cols, rows);
        const cells = sparse(text);
        if (cells.length === 0) throw new Error(`${tier} frame ${String(frame)}: the bead inked nothing`);
        frames.push(cells);
      }
      rasters[tier] = { cols, rows, body, frames };
    }
    return rasters;
  } finally {
    await browser.close();
    await server.close();
  }
}

/** A raster is the grid it claims to be, or the drawing is not the one the ladder describes. */
function check(tier: string, what: string, text: string, cols: number, rows: number): void {
  const lines = text.split('\n');
  if (lines.length !== rows) throw new Error(`${tier} ${what}: ${String(lines.length)} rows, expected ${String(rows)}`);
  for (const line of lines) {
    if ([...line].length !== cols) throw new Error(`${tier} ${what}: a row of ${String([...line].length)} cells, expected ${String(cols)}`);
  }
}

/**
 * The committed file's bytes. JSON, written by hand rather than by
 * `JSON.stringify(_, null, 2)`: a bead frame is a handful of `[row, col,
 * glyph]` triples and the indented form spells each one over five lines, which
 * turns 17 KB of drawing into 79 KB of punctuation. One line per frame keeps
 * the diff readable — a frame that moved is a line that changed — and the file
 * a quarter of the size. The bundle carries neither: Vite inlines the parsed
 * object, so only the repository sees this shape.
 */
export function serialise(rasters: MarkRasters): string {
  const tiers = MARK_TIERS.map((tier) => {
    const { cols, rows, body, frames } = rasters[tier];
    const lines = frames.map((frame) => `      ${JSON.stringify(frame)}`).join(',\n');
    return `  ${JSON.stringify(tier)}: {\n    "cols": ${String(cols)},\n    "rows": ${String(rows)},\n    "body": ${JSON.stringify(body)},\n    "frames": [\n${lines}\n    ]\n  }`;
  });
  return `{\n${tiers.join(',\n')}\n}\n`;
}

/** The committed file, as it is on disk. */
export function readCommitted(): string {
  return readFileSync(RASTERS_PATH, 'utf8');
}

type RGB = readonly [r: number, g: number, b: number];
const rgb = (hex: string): RGB => [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];

/**
 * A dot raster as raw RGBA, `px` square, each dot a `px / dots` square of
 * pixels. The ground is the `--bg` tile or nothing at all (alpha 0), by the
 * file's job (FR-MARK-4 d/e).
 */
function pixels(raster: DotRaster, px: number, ground: 'tile' | 'none'): Uint8Array {
  const pitch = px / raster.dots;
  if (!Number.isInteger(pitch)) throw new Error(`${String(px)} px is not a whole number of ${String(raster.dots)} dots`);
  const data = new Uint8Array(px * px * 4);
  if (ground === 'tile') {
    const bg = rgb(ICON_TONES.bg);
    for (let i = 0; i < data.length; i += 4) [data[i], data[i + 1], data[i + 2], data[i + 3]] = [...bg, 255];
  }
  const paint = (dots: readonly (readonly [number, number])[], tone: RGB): void => {
    for (const [row, col] of dots) {
      for (let y = row * pitch; y < (row + 1) * pitch; y++) {
        for (let x = col * pitch; x < (col + 1) * pitch; x++) {
          const i = (y * px + x) * 4;
          [data[i], data[i + 1], data[i + 2], data[i + 3]] = [...tone, 255];
        }
      }
    }
  };
  paint(raster.bezel, rgb(ICON_TONES.bezel));
  paint(raster.body, rgb(ICON_TONES.dim));
  paint(raster.bead, rgb(ICON_TONES.accent));
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

/**
 * An 8-bit RGBA PNG (colour type 6), filter 0 on every scanline and one
 * `deflateSync` — the encoder `scripts/build-icons.ts` had (D-127), back
 * inside the one generator (D-460) with an alpha channel for the favicons.
 * Four chunks and no dependency; the same bytes on every machine, which is
 * what the byte pin needs.
 */
export function png(raster: DotRaster, px: number, ground: 'tile' | 'none'): Buffer {
  const data = pixels(raster, px, ground);
  const stride = px * 4;
  const raw = Buffer.alloc(px * (stride + 1));
  for (let y = 0; y < px; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

/**
 * The SVG favicon (FR-MARK-4 e): the same dots as `<path>`s, one per tone, and
 * no ground — the mark sits on the tab strip and the bezel, one ramp step
 * brighter than the body, does the containing on a dark strip and a light one
 * alike (D-460, the owner's option a).
 */
export function svg(raster: DotRaster): string {
  const path = (dots: readonly (readonly [number, number])[], fill: string): string =>
    dots.length === 0 ? '' : `<path fill="${fill}" d="${dots.map(([row, col]) => `M${String(col)} ${String(row)}h1v1h-1z`).join('')}"/>`;
  const n = String(raster.dots);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">`,
    path(raster.bezel, ICON_TONES.bezel),
    path(raster.body, ICON_TONES.dim),
    path(raster.bead, ICON_TONES.accent),
    `</svg>`,
    '',
  ].filter((line) => line !== '').join('\n');
}

/** The five files under `public/`, drawn from the scene: what `--icons` writes and what the byte pin compares. */
export function renderImages(): Record<string, Buffer> {
  const out: Record<string, Buffer> = {};
  for (const image of MARK_IMAGES) out[image.file] = png(renderDots(image.tier, image.dots), image.px, image.ground);
  out[MARK_SVG.file] = Buffer.from(svg(renderDots(MARK_SVG.tier, MARK_SVG.dots)), 'utf8');
  return out;
}

function writeImages(): void {
  for (const [file, bytes] of Object.entries(renderImages())) {
    const path = resolve(PUBLIC, file);
    writeFileSync(path, bytes);
    console.log(`${path} ${String(bytes.length)} bytes`);
  }
}

/** The dot grids printed one character a dot: what a change to the scene did to the files, before anything is written. */
function printImages(): void {
  for (const image of MARK_IMAGES) {
    console.log(`\n${image.file} — ${String(image.dots)} dots at ${String(image.px / image.dots)} px (${image.tier}, ground ${image.ground}):\n${dotsToText(renderDots(image.tier, image.dots))}`);
  }
}

/** Every tier printed as it would be committed: what a change to the scene's constants did, before anything is written. */
function print(rasters: MarkRasters): void {
  for (const tier of MARK_TIERS) {
    const raster = rasters[tier];
    console.log(`\n${tier} — ${String(raster.cols)} × ${String(raster.rows)}, body:\n${raster.body}`);
    console.log(`${tier} — mark (frame 0):\n${denseFrame(raster.frames[0] ?? [], raster.cols, raster.rows)}`);
  }
}

async function main(): Promise<void> {
  // `--dry-run` prints the ladder and the dot grids and writes nothing: the
  // scene's constants are chosen by looking at what they draw (FR-MARK-1), and
  // a half-tuned mark has no business in the tree. `--icons` writes the five
  // files under `public/` and nothing else: they need no browser.
  const dryRun = process.argv.includes('--dry-run');
  if (process.argv.includes('--icons')) {
    if (dryRun) printImages();
    else writeImages();
    return;
  }
  const rasters = await generateRasters();
  if (dryRun) {
    print(rasters);
    printImages();
    return;
  }
  writeFileSync(RASTERS_PATH, serialise(rasters), 'utf8');
  console.log(`${RASTERS_PATH} ${String(MARK_TIERS.length)} tiers, ${String(MARK_ORBIT_FRAMES)} frames each`);
  writeImages();
  // FR-PUB-11: the lockup on the social preview is the `lockup80` tier, so the
  // two pictures are re-composed from the mark that was just generated.
  await buildReadmePictures();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
