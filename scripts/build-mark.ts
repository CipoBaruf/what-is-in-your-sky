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
 *   public/icon-192.png, icon-512.png,    the tier's own text, drawn in the
 *   public/favicon.png                    braille font at the pixel size on
 *                                         `--bg` and screenshotted (D-440)
 *   docs/readme/*.png                     FR-PUB-11's hero and social preview,
 *                                         whose lockup is the `lockup80` tier
 *
 * The rasters are committed, and `tests/build/mark-rasters.test.ts` (D-458)
 * re-runs `generateRasters()` in CI and asserts the committed file is
 * byte-identical — so the asset cannot drift from the scene that produced it.
 * That is also why nothing here reads the clock or a random number: the same
 * scene must produce the same bytes on every machine.
 */
import { chromium, type Browser, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { denseFrame, MARK_GRIDS, MARK_IMAGES, MARK_ORBIT_FRAMES, MARK_TIERS, type MarkCell, type MarkRaster, type MarkRasters } from '../src/ui/components/mark/tiers';
import { brailleFontFace, main as buildReadmePictures } from './readme-hero';

/** A port of its own, so a running dev server does not collide with the generator. */
const PORT = 5198;
const PAGE = `http://localhost:${String(PORT)}/spike/mark/`;

export const RASTERS_PATH = resolve('src/ui/components/mark/rasters.json');
const PUBLIC = resolve('public');
/**
 * The dark theme's `--bg`, `--fg-dim` and `--accent` (`src/ui/styles/tokens.css`):
 * what the icons are drawn on, the body's tone and the bead's (FR-MARK-3). They
 * are exported because `tests/build/mark-icons.test.ts` reads the shipped PNGs
 * back and has to know which tone it is looking at (D-459).
 */
export const ICON_TONES = { bg: '#0b0f14', dim: '#7d8794', accent: '#9ad0ff' } as const;
const BG = ICON_TONES.bg;
const DIM = ICON_TONES.dim;
const ACCENT = ICON_TONES.accent;

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

/**
 * The icons and the favicon (D-440): the tier's own text, drawn at the pixel
 * size on `--bg` and screenshotted. The cell is the pixel size divided by the
 * tier's columns, so the raster fills the square exactly and nothing is
 * resampled — 24 columns into 192 px is 8 px a cell, and into 512 px it is the
 * same drawing at a bigger cell.
 */
function iconPage(raster: MarkRaster, frame: MarkCell[], px: number): string {
  const cell = px / raster.cols;
  const body = raster.body;
  const bead = denseFrame(frame, raster.cols, raster.rows);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  ${brailleFontFace()}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: ${BG}; }
  #icon { position: relative; width: ${String(px)}px; height: ${String(px)}px; background: ${BG}; }
  #icon pre {
    position: absolute; inset: 0; margin: 0;
    font-family: 'WIYS Braille', monospace;
    font-size: ${String(cell / 0.6)}px;
    line-height: ${String(2 * cell)}px;
    white-space: pre;
  }
  #icon .body { color: ${DIM}; }
  #icon .bead { color: ${ACCENT}; }
</style></head>
<body><div id="icon"><pre class="body">${body}</pre><pre class="bead">${bead}</pre></div></body></html>`;
}

async function renderImages(browser: Browser, rasters: MarkRasters): Promise<void> {
  for (const image of MARK_IMAGES) {
    const raster = rasters[image.tier];
    const frame = raster.frames[0];
    if (!frame) throw new Error(`${image.tier} has no frame 0`);
    const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
    await page.setContent(iconPage(raster, frame, image.px));
    await page.evaluate(() => document.fonts.ready);
    const path = resolve(PUBLIC, image.file);
    await page.locator('#icon').screenshot({ path });
    console.log(`${path} ${String(image.px)} x ${String(image.px)} (${image.tier})`);
    await page.close();
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
  const rasters = await generateRasters();
  // `--dry-run` prints the ladder and writes nothing: the scene's constants are
  // chosen by looking at what they draw (FR-MARK-1), and a half-tuned mark has
  // no business in the tree.
  if (process.argv.includes('--dry-run')) {
    print(rasters);
    return;
  }
  writeFileSync(RASTERS_PATH, serialise(rasters), 'utf8');
  console.log(`${RASTERS_PATH} ${String(MARK_TIERS.length)} tiers, ${String(MARK_ORBIT_FRAMES)} frames each`);
  const browser = await chromium.launch();
  try {
    await renderImages(browser, rasters);
  } finally {
    await browser.close();
  }
  // FR-PUB-11: the lockup on the social preview is the `lockup80` tier, so the
  // two pictures are re-composed from the mark that was just generated.
  await buildReadmePictures();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
