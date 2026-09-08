/**
 * FR-PUB-2, FR-PUB-11 (D-370): the README's one image and the repository's
 * social preview, composed from captures that are already in
 * `docs/screenshots/`.
 *
 *   npx tsx scripts/readme-hero.ts
 *
 * The app is never run to make these. The script writes one HTML page with
 * three `<img>` tags pointing at committed captures, opens it with the
 * Playwright Chromium the mockup script already uses, and screenshots it
 * twice: `docs/readme/hero.png` at 1200 px wide, and
 * `docs/readme/social-preview.png` at exactly 1280 x 640. Both are
 * deterministic given the inputs, and the inputs are named in `SOURCES`
 * below, which `tests/docs/public.test.ts` reads — so a capture renamed by a
 * later phase fails a test instead of leaving a broken image in the README.
 *
 * `docs/screenshots/` is read and never written: `tests/docs/captures.test.ts`
 * owns that directory and fails on a file the capture set does not name, which
 * is why the output lives under `docs/readme/`.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Where the captures are read from, and where the two pictures are written. */
const SCREENSHOTS = resolve('docs/screenshots');
const OUT = resolve('docs/readme');

/** The README's image, at the width GitHub renders a README image at. */
export const HERO = { path: join(OUT, 'hero.png'), width: 1200 } as const;
/** GitHub's social preview: the size the repository settings page asks for. */
export const PREVIEW = { path: join(OUT, 'social-preview.png'), width: 1280, height: 640 } as const;

/**
 * The three captures, side by side, in this order. Each is a release capture
 * from the v1.3 set, shot in the dark theme in English from the production
 * build — so the picture cannot disagree with the build the capture set was
 * shot from.
 *
 * `crop` is for a capture taller than the tile it is drawn in: the home screen
 * is one full-page shot 1913 px tall, and the tile shows its top.
 */
export const SOURCES = [
  {
    file: 'v1-home-390-dark-en.png',
    caption: 'Tonight, and the next pass',
    orientation: 'portrait',
    crop: true,
  },
  {
    file: 'v1-guide-390-dark-en.png',
    caption: 'Where to look, on the dome',
    orientation: 'portrait',
    crop: false,
  },
  {
    file: 'v1-sky-screen-sky-844-dark-en.png',
    caption: 'The phone held up at the sky',
    orientation: 'landscape',
    crop: false,
  },
] as const satisfies readonly {
  file: string;
  caption: string;
  orientation: 'portrait' | 'landscape';
  crop: boolean;
}[];

/** The dark theme's `--bg`, `--fg` and `--fg-dim` (`src/ui/styles/tokens.css`). */
const INK = { bg: '#0b0f14', fg: '#d5dbe3', dim: '#7d8794', edge: '#161c24' } as const;

/** One composition. `portrait` is the width of a phone tile; the landscape tile takes the rest of the row. */
interface Layout {
  width: number;
  height: number | null;
  pad: number;
  gap: number;
  portrait: number;
  title: boolean;
}

/** 390 x 844 is the phone every capture in the set is shot at. */
const PHONE = { width: 390, height: 844 } as const;

/** The composition, as one self-contained HTML document. */
function compose(layout: Layout, urls: readonly string[]): string {
  const tall = Math.round((layout.portrait * PHONE.height) / PHONE.width);
  const landscape = layout.width - 2 * layout.pad - 2 * layout.gap - 2 * layout.portrait;
  const tiles = SOURCES.map((source, index) => {
    const wide = source.orientation === 'landscape';
    const width = wide ? landscape : layout.portrait;
    // The phone tiles are all the height of a 390 x 844 screen at this width; a
    // capture taller than that (the full-page home screen) is drawn from the top
    // rather than squashed. The landscape tile keeps its own aspect and is
    // centred against them, because a phone held sideways is not as tall.
    const box = wide ? `height: auto` : `height: ${String(tall)}px; object-fit: ${source.crop ? 'cover; object-position: top center' : 'contain'}`;
    return `<figure class="tile" style="width: ${String(width)}px">
      <img src="${urls[index] ?? ''}" alt="" style="width: ${String(width)}px; ${box}">
      <figcaption>${source.caption}</figcaption>
    </figure>`;
  }).join('\n');
  const title = layout.title
    ? `<header><h1>What is in your sky right now</h1><p>in-your-sky.ezequiel-baruf.workers.dev</p></header>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${INK.bg}; }
  /* The picture is this element, not the viewport: an element screenshot is
     exactly its box, so the widths above are the widths of the two files. */
  #sheet {
    background: ${INK.bg};
    width: ${String(layout.width)}px;${layout.height === null ? '' : ` height: ${String(layout.height)}px;`}
    padding: ${String(layout.pad)}px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: ${INK.fg};
    display: flex; flex-direction: column; justify-content: center; gap: ${String(layout.gap)}px;
  }
  header { text-align: center; }
  header h1 { font-size: 22px; font-weight: 600; letter-spacing: 0.01em; }
  header p { font-size: 14px; color: ${INK.dim}; margin-top: 6px; }
  .row { display: flex; gap: ${String(layout.gap)}px; align-items: center; justify-content: center; }
  .tile { display: flex; flex-direction: column; gap: 10px; }
  .tile img { display: block; border: 1px solid ${INK.edge}; border-radius: 6px; background: ${INK.bg}; }
  figcaption { font-size: 13px; color: ${INK.dim}; text-align: center; }
</style></head>
<body><div id="sheet">${title}<div class="row">${tiles}</div></div></body></html>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'readme-hero-'));
  const urls = SOURCES.map((source) => pathToFileURL(join(SCREENSHOTS, source.file)).href);
  const browser = await chromium.launch();
  try {
    // The hero: the three tiles set the height, so only the width is fixed.
    // The padding and the gaps are as small as they can be: GitHub renders a
    // README image at about 880 px, so every pixel not spent on a screen is a
    // pixel of text the reader loses to the downscale.
    const hero = compose({ width: HERO.width, height: null, pad: 20, gap: 20, portrait: 330, title: false }, urls);
    await shoot(browser, scratch, 'hero.html', hero, HERO.path);

    // The preview: 1280 x 640 exactly, which is what GitHub asks for, so the
    // sheet is given both, and the title and URL fit above the tiles.
    const preview = compose(
      { width: PREVIEW.width, height: PREVIEW.height, pad: 28, gap: 20, portrait: 224, title: true },
      urls,
    );
    await shoot(browser, scratch, 'preview.html', preview, PREVIEW.path);
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
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
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
