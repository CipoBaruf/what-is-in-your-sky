/**
 * FR-PUB-2, FR-PUB-11 (D-370): the README's one image and the repository's
 * social preview, composed from captures that are already in
 * `docs/screenshots/`.
 *
 *   npx tsx scripts/readme-hero.ts
 *
 * The app is never run to make these. The script writes one HTML page with an
 * `<img>` per capture, opens it with the Playwright Chromium the mockup script
 * already uses, and screenshots it twice: `docs/readme/hero.png` at 1200 px
 * wide, and `docs/readme/social-preview.png` at exactly 1280 x 640. Both are
 * deterministic given the inputs, and the inputs are named in `SOURCES` below,
 * which `tests/docs/public.test.ts` reads — so a capture renamed by a later
 * phase fails a test instead of leaving a broken image in the README.
 *
 * `docs/screenshots/` is read and never written: `tests/docs/captures.test.ts`
 * owns that directory and fails on a file the capture set does not name, which
 * is why the output lives under `docs/readme/`.
 *
 * The layout is computed from `SOURCES` by `geometry()`, and nothing about it is
 * written down twice. The first version of this script hardcoded "two portrait
 * tiles and one landscape tile", so a change to `SOURCES` would have moved the
 * pictures without moving the boxes they are drawn in — and the picture it did
 * produce stood a sideways phone in a column sized for a standing one, with a
 * third of the sheet empty beneath it. Each source now declares its own pixel
 * size and which slot it fills, and every width and height below is derived
 * from those two facts.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MARK_LOCKUP_PX } from '../src/ui/components/mark/tiers';

/** Where the captures are read from, and where the two pictures are written. */
const SCREENSHOTS = resolve('docs/screenshots');
const OUT = resolve('docs/readme');

/** The README's image, at the width GitHub renders a README image at. */
export const HERO = { path: join(OUT, 'hero.png'), width: 1200 } as const;
/** GitHub's social preview: the size the repository settings page asks for. */
export const PREVIEW = { path: join(OUT, 'social-preview.png'), width: 1280, height: 640 } as const;

/**
 * One capture in the composition. `w` and `h` are the file's own pixels — the
 * test reads the PNG header and fails if a declaration drifts from the file —
 * and the slot says where it goes: `main` is the standing phone on the left,
 * `stack` is the column of sideways phones beside it.
 */
export interface Source {
  file: string;
  caption: string;
  w: number;
  h: number;
  slot: 'main' | 'stack';
}

/**
 * The captures, in this order. Each is a release capture from the v1.3 set,
 * shot in the dark theme in English from the production build — so the picture
 * cannot disagree with the build the capture set was shot from.
 *
 * Three answers to the three things a reader wants in the first ten seconds:
 * what the sky over them looks like (the live page on a standing phone, the
 * tile the eye lands on first), what the app is for outdoors (the sky screen,
 * held up, which is what the whole v1.3 phase was for), and what it actually
 * tells you (the laptop page, where the next pass carries its time, elevation,
 * duration, magnitude and cloud verdict in one card).
 */
export const SOURCES = [
  {
    file: 'v1-live-390-dark-en.png',
    caption: 'The sky over you, drawn as text',
    w: 390,
    h: 844,
    slot: 'main',
  },
  {
    file: 'v1-sky-screen-sky-844-dark-en.png',
    caption: 'Held up at the sky, on a phone turned sideways',
    w: 844,
    h: 390,
    slot: 'stack',
  },
  {
    file: 'v1-home-1280-dark-en.png',
    caption: 'And on a laptop: when the next pass starts, how high, how bright',
    w: 1280,
    h: 800,
    slot: 'stack',
  },
] as const satisfies readonly Source[];

/** The dark theme's `--bg`, `--fg`, `--fg-dim` and `--accent` (`src/ui/styles/tokens.css`). */
const INK = { bg: '#0b0f14', fg: '#d5dbe3', dim: '#7d8794', edge: '#161c24', accent: '#9ad0ff' } as const;

/** The dome's braille font (D-65), and the mark's rasters (FR-MARK-6), read from where they live. */
const BRAILLE_OTF = resolve('src/ui/components/guide/skychart/dome/wiys-braille.otf');
const RASTERS = resolve('src/ui/components/mark/rasters.json');

/**
 * The `@font-face` rule for the braille font, with the file inlined. A page
 * composed in a temporary directory cannot reach a font by relative URL, and
 * `scripts/build-mark.ts` draws its icons from a page with no origin at all,
 * so both take the rule from here rather than each carrying a copy of the path.
 */
export function brailleFontFace(): string {
  const font = readFileSync(BRAILLE_OTF).toString('base64');
  return `@font-face { font-family: 'WIYS Braille'; src: url(data:font/otf;base64,${font}) format('opentype'); font-display: block; }`;
}

interface LockupRaster {
  cols: number;
  rows: number;
  body: string;
  frames: [number, number, string][][];
}

/**
 * FR-MARK-4, FR-PUB-11: the mark at `MARK_LOCKUP_PX` beside the preview's
 * title, drawn from the committed `lockup80` tier rather than from a second
 * picture of it — the lockup and the app's header are then the same drawing.
 * The bead is frame 0: a still picture cannot show the orbit.
 */
function lockup(px = MARK_LOCKUP_PX): string {
  const all = JSON.parse(readFileSync(RASTERS, 'utf8')) as Record<string, LockupRaster>;
  const raster = all['lockup80'];
  if (!raster) throw new Error(`no lockup80 tier in ${RASTERS}: run npm run build:icons`);
  const cell = px / raster.cols;
  const grid = Array.from({ length: raster.rows }, () => Array.from({ length: raster.cols }, () => ' '));
  for (const [row, col, glyph] of raster.frames[0] ?? []) {
    const line = grid[row];
    if (line) line[col] = glyph;
  }
  const bead = grid.map((line) => line.join('')).join('\n');
  const style = `width: ${String(px)}px; height: ${String(px)}px; font-size: ${String(cell / 0.6)}px; line-height: ${String(2 * cell)}px;`;
  return `<div class="mark" style="${style}"><pre class="mark-body">${raster.body}</pre><pre class="mark-bead">${bead}</pre></div>`;
}

/** A caption's own box: the gap over it plus one line at 13/17. */
const CAPTION_H = 10 + 17;
/** The preview's title block: the mark beside the heading, its gap and the URL line — the taller of the two. */
const TITLE_H = Math.max(22 + 6 + 18, MARK_LOCKUP_PX);

/** What the sheet is, before the tiles are measured into it. */
export interface Layout {
  width: number;
  /** The height the file must have, or `null` to let the tiles set it. */
  height: number | null;
  pad: number;
  gap: number;
  /** The standing phone's width; every other box is derived from it. */
  mainWidth: number;
  title: boolean;
}

/** One tile, placed. */
export interface Placed {
  source: Source;
  width: number;
  height: number;
}

/**
 * The composition, computed. It throws rather than drawing something wrong: a
 * sheet with no standing phone, none sideways, or no room left beside the
 * standing one is a layout bug, and the picture it would produce is the kind
 * nobody notices until it is the front page of a public repository.
 */
export function geometry(layout: Layout, sources: readonly Source[] = SOURCES): { main: Placed; stack: readonly Placed[]; height: number } {
  const mains = sources.filter((source) => source.slot === 'main');
  const stacked = sources.filter((source) => source.slot === 'stack');
  const [only] = mains;
  if (only === undefined || mains.length !== 1) throw new Error(`the sheet holds exactly one main tile; SOURCES declares ${String(mains.length)}`);
  if (stacked.length === 0) throw new Error('the sheet needs at least one stacked tile');

  const inner = layout.width - 2 * layout.pad;
  const stackWidth = inner - layout.gap - layout.mainWidth;
  if (stackWidth <= 0) throw new Error(`mainWidth ${String(layout.mainWidth)} leaves no room beside it in ${String(layout.width)} px`);

  const place = (source: Source, width: number): Placed => ({ source, width, height: Math.round((width * source.h) / source.w) });
  const main = place(only, layout.mainWidth);
  const stack = stacked.map((source) => place(source, stackWidth));

  const column = stack.reduce((total, tile) => total + tile.height + CAPTION_H, 0) + (stack.length - 1) * layout.gap;
  const content = Math.max(main.height + CAPTION_H, column);
  const height = content + 2 * layout.pad + (layout.title ? TITLE_H + layout.gap : 0);
  return { main, stack, height };
}

/**
 * The widest standing phone that keeps the sheet inside `ceiling`. The social
 * preview is 1280 x 640 whatever is in it, so the tiles are sized down to that
 * rather than the frame cropping whatever overflowed it.
 */
function fitMainWidth(layout: Layout, ceiling: number, sources: readonly Source[]): number {
  const widest = Math.floor((layout.width - 2 * layout.pad - layout.gap) / 2);
  for (let width = widest; width >= 80; width -= 2) {
    if (geometry({ ...layout, mainWidth: width }, sources).height <= ceiling) return width;
  }
  throw new Error(`no tile width fits ${String(sources.length)} captures into ${String(layout.width)} x ${String(ceiling)}`);
}

/**
 * What the social preview draws. A 1280 x 640 card cannot hold the hero's three
 * tiles at any width — a sideways phone in a column is 0.46 of that column's
 * width tall, so narrowing the standing phone to make room only makes the
 * column beside it taller — and a card whose captions are unreadable is worse
 * than a card with one screen fewer. So the preview takes the standing phone
 * and the first sideways one, and the order of `SOURCES` is the priority order.
 */
export function previewSources(sources: readonly Source[] = SOURCES): readonly Source[] {
  const stacked = sources.filter((source) => source.slot === 'stack').slice(0, 1);
  return [...sources.filter((source) => source.slot === 'main'), ...stacked];
}

/** The composition, as one self-contained HTML document. */
function compose(layout: Layout, urls: ReadonlyMap<string, string>, sources: readonly Source[] = SOURCES): string {
  const { main, stack, height } = geometry(layout, sources);
  const tile = (placed: Placed): string =>
    `<figure class="tile" style="width: ${String(placed.width)}px">
      <img src="${urls.get(placed.source.file) ?? ''}" alt="" width="${String(placed.width)}" height="${String(placed.height)}">
      <figcaption>${placed.source.caption}</figcaption>
    </figure>`;
  const title = layout.title
    ? `<header>${lockup()}<div class="wordmark"><h1>What is in your sky right now</h1><p>in-your-sky.ezequiel-baruf.workers.dev</p></div></header>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  ${brailleFontFace()}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${INK.bg}; }
  /* The picture is this element, not the viewport: an element screenshot is
     exactly its box, so the width below is the width of the file and the
     height is the one geometry() computed, not whatever reflowed. */
  #sheet {
    background: ${INK.bg};
    width: ${String(layout.width)}px;
    height: ${String(layout.height ?? height)}px;
    padding: ${String(layout.pad)}px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: ${INK.fg};
    display: flex; flex-direction: column; justify-content: center; gap: ${String(layout.gap)}px;
  }
  header { display: flex; align-items: center; justify-content: center; gap: 16px; }
  .wordmark { text-align: left; }
  header h1 { font-size: 22px; font-weight: 600; letter-spacing: 0.01em; line-height: 22px; }
  header p { font-size: 14px; line-height: 18px; color: ${INK.dim}; margin-top: 6px; }
  /* FR-MARK-4: the 80 px lockup, the same two layers the app renders. */
  .mark { position: relative; flex: none; }
  .mark pre { position: absolute; inset: 0; margin: 0; font-family: 'WIYS Braille', monospace; font-size: inherit; line-height: inherit; white-space: pre; }
  .mark-body { color: ${INK.dim}; }
  .mark-bead { color: ${INK.accent}; }
  .row { display: flex; gap: ${String(layout.gap)}px; align-items: center; justify-content: center; }
  .col { display: flex; flex-direction: column; gap: ${String(layout.gap)}px; }
  .tile { display: flex; flex-direction: column; gap: 10px; }
  .tile img { display: block; border: 1px solid ${INK.edge}; border-radius: 6px; background: ${INK.bg}; }
  figcaption { font-size: 13px; line-height: 17px; color: ${INK.dim}; text-align: center; }
</style></head>
<body><div id="sheet">${title}<div class="row">${tile(main)}<div class="col">${stack.map(tile).join('')}</div></div></div></body></html>`;
}

/** The two pictures. Exported so `scripts/build-mark.ts` can re-compose them in the run that regenerates the mark. */
export async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'readme-hero-'));
  const urls = new Map(SOURCES.map((source) => [source.file, pathToFileURL(join(SCREENSHOTS, source.file)).href]));
  const browser = await chromium.launch();
  try {
    // The hero: the tiles set the height, so only the width is fixed. The
    // padding and the gaps are as small as they can be — GitHub renders a
    // README image at about 880 px, so every pixel not spent on a screen is a
    // pixel of text the reader loses to the downscale.
    const hero: Layout = { width: HERO.width, height: null, pad: 20, gap: 20, mainWidth: 400, title: false };
    await shoot(browser, scratch, 'hero.html', compose(hero, urls), HERO.path);

    // The preview: 1280 x 640 exactly, which is what GitHub asks for, so the
    // sheet is given both and the standing phone is sized down until the title
    // and the captions fit inside it. Two tiles, for the reason on
    // `previewSources`.
    const chosen = previewSources();
    const preview: Layout = { width: PREVIEW.width, height: PREVIEW.height, pad: 24, gap: 16, mainWidth: 0, title: true };
    const fitted: Layout = { ...preview, mainWidth: fitMainWidth(preview, PREVIEW.height, chosen) };
    await shoot(browser, scratch, 'preview.html', compose(fitted, urls, chosen), PREVIEW.path);
  } finally {
    await browser.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * One page, one picture: the `#sheet` element, screenshotted as itself. The
 * viewport is bigger than the sheet on both sides so no scrollbar ever narrows
 * the layout, and `deviceScaleFactor: 1` so the file's pixels are the CSS ones.
 */
async function shoot(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  scratch: string,
  name: string,
  html: string,
  path: string,
): Promise<void> {
  const file = join(scratch, name);
  writeFileSync(file, html, 'utf8');
  const page = await browser.newPage({ viewport: { width: 1500, height: 1400 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  const sheet = page.locator('#sheet');
  await sheet.screenshot({ path });
  const box = await sheet.boundingBox();
  console.log(`${path} ${String(box?.width ?? 0)} x ${String(box?.height ?? 0)}`);
  await page.close();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
