/**
 * R14 spike driver (PLAN §8.5): starts the Vite dev server, opens the spike
 * page in Chromium with a 390 px phone profile and writes the evidence for
 * each question to docs/spike-glyphcss/: screenshots, the raw `<pre>` text of
 * each raster, hotspot positions (item 1), the drag measurements under CPU
 * throttling (item 3), the DOM emitted with colours on (item 5) and the
 * behaviour of the bundle probe under the strict CSP (item 5/6).
 *
 *   npx tsx spike/capture.ts            # everything
 *   npx tsx spike/capture.ts frame perf # only the named steps
 */
import { chromium, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, preview, type PreviewServer, type ViteDevServer } from 'vite';

declare global {
  interface Window {
    __spike: { start: (target: Element) => void; stop: () => Record<string, number | null>; ready: () => boolean };
  }
}

const OUT = resolve('docs/spike-glyphcss');
const RASTER = resolve(OUT, 'raster');
const PORT = 5199;
const steps = new Set(process.argv.slice(2));
const want = (name: string) => steps.size === 0 || steps.has(name);
const results: Record<string, unknown> = {};

type Q = Record<string, string | number | boolean>;
const url = (q: Q) => `http://localhost:${PORT}/spike/?${new URLSearchParams(Object.entries(q).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v)])).toString()}`;

async function open(page: Page, q: Q) {
  await page.goto(url(q));
  if (q['view'] !== 'panorama') await page.waitForFunction(() => window.__spike?.ready(), null, { timeout: 15_000 }).catch(() => console.log('not ready in 15 s:', JSON.stringify(q)));
  await page.waitForTimeout(300);
}

async function shot(page: Page, name: string, selector = '#stage') {
  await page.locator(selector).screenshot({ path: resolve(OUT, `${name}.png`) });
}

async function raster(page: Page, name: string) {
  const text = await page.evaluate(() => document.querySelector('.dome-scene pre')?.textContent ?? '');
  writeFileSync(resolve(RASTER, `${name}.txt`), text);
  return text;
}

/** Hotspot label positions in grid cells, relative to the `<pre>`. */
async function hotspots(page: Page) {
  return page.evaluate(() => {
    const pre = document.querySelector('.dome-scene pre');
    if (!pre) return [];
    const box = pre.getBoundingClientRect();
    const cols = (pre.textContent?.split('\n')[0] ?? '').length;
    const rows = (pre.textContent?.split('\n') ?? []).length;
    const cw = box.width / Math.max(1, cols);
    const ch = box.height / Math.max(1, rows);
    return Array.from(document.querySelectorAll<HTMLElement>('[data-spike-hotspot]')).map((el) => {
      const r = el.getBoundingClientRect();
      return { label: el.dataset['spikeHotspot'], col: Math.round((r.left + r.width / 2 - box.left) / cw), row: Math.round((r.top + r.height / 2 - box.top) / ch), visible: r.width > 0 && r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom };
    });
  });
}

async function drag(page: Page, seconds: number) {
  const box = await page.locator('.dome-scene pre').boundingBox();
  if (!box) throw new Error('no pre');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < seconds * 1000) {
    const phase = ((Date.now() - t0) / 1000) * Math.PI;
    await page.mouse.move(cx + Math.sin(phase) * box.width * 0.35, cy + Math.cos(phase * 0.7) * box.height * 0.2);
    i++;
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  return i;
}

async function perf(page: Page, context: BrowserContext, q: Q, rate: number) {
  await open(page, q);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__spike.start(document.querySelector('.dome-scene') as Element));
  const moves = await drag(page, 5);
  const r = await page.evaluate(() => window.__spike.stop());
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();
  return { ...r, pointerMoves: moves, grid: `${q['auto'] ? 'auto' : `${String(q['cols'])}x${String(q['rows'])}`}${q['downscale'] ? ' downscale2' : ''}${q['char'] ? ` ${String(q['char'])}` : ''}`, cpuThrottle: rate };
}

async function main() {
  mkdirSync(RASTER, { recursive: true });
  const server: ViteDevServer = await createServer({ configFile: resolve('vite.config.ts'), server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser: Browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const golden = { pass: 'golden', cols: 60, rows: 30, yaw: 0, pitch: 25 };
  const high = { ...golden, pass: 'high' };

  if (want('frame')) {
    // Item 1: where do the compass hotspots land at rotY = 0 (and 90, to read the sign of yaw)?
    const frame: Record<string, unknown> = {};
    for (const [name, yaw] of [
      ['rotY0', 0],
      ['rotY90', 90],
    ] as const) {
      await open(page, { ...high, view: 'external', yaw, pitch: 25 });
      await shot(page, `01-frame-${name}`);
      await raster(page, `01-frame-${name}`);
      frame[name] = await hotspots(page);
    }
    await open(page, { ...high, view: 'external', yaw: 0, pitch: 89 });
    await shot(page, '01-frame-rotY0-topdown');
    frame['rotY0-topdown'] = await hotspots(page);
    results['frame'] = frame;
  }

  if (want('variants')) {
    // Item 2 groundwork: which composition reads at 60×30? Strips versus single strokes, palettes, junctions, braille.
    const variants: Q[] = [
      { name: 'strip-lines', palette: 'lines' },
      { name: 'wire-lines', palette: 'lines', grid: 0.05, strip: 0.05 },
      { name: 'wire-ascii', palette: 'ascii', grid: 0.05, strip: 0.05 },
      { name: 'wire-default', palette: 'default', grid: 0.05, strip: 0.05 },
      { name: 'wire-ascii-junctions', palette: 'ascii', grid: 0.05, strip: 0.05, junctions: true },
      { name: 'wire-ascii-solid', palette: 'ascii', grid: 0.05, strip: 0.05, dashed: false },
      { name: 'wire-ascii-strip075', palette: 'ascii', grid: 0.05, strip: 0.75 },
      { name: 'wire-braille', palette: 'ascii', grid: 0.05, strip: 0.05, char: 'braille' },
      { name: 'wire-braille-strip075', palette: 'ascii', grid: 0.05, strip: 0.75, char: 'braille' },
    ];
    for (const v of variants) {
      const { name, ...rest } = v;
      await open(page, { view: 'external', pass: 'high', cols: 60, rows: 30, pitch: 25, ...rest });
      await shot(page, `02-variant-${String(name)}`);
      await raster(page, `02-variant-${String(name)}`);
    }
  }

  if (want('legibility')) {
    // Item 2: the 1.5° strip at 60×30 and 100×50 on the 390 px viewport.
    for (const pass of ['golden', 'high']) {
      for (const [cols, rows] of [
        [60, 30],
        [100, 50],
      ] as const) {
        for (const char of ['braille', 'ascii']) {
          // Facing the rise azimuth (D-17), the page's default when no yaw is given.
          const q = { view: 'external', pass, cols, rows, pitch: 25, char };
          await open(page, q);
          await shot(page, `02-strip-${cols}x${rows}-${pass}-${char}`);
          await raster(page, `02-strip-${cols}x${rows}-${pass}-${char}`);
        }
      }
    }
  }

  if (want('perf')) {
    // Item 3: 5 s drag, rasterisations per second and the longest frame, at 1× and 4× CPU throttling (Lighthouse's mobile ratio).
    const runs: unknown[] = [];
    for (const rate of [1, 4, 6]) {
      for (const grid of [
        { cols: 60, rows: 30 },
        { cols: 100, rows: 50 },
        { cols: 100, rows: 50, downscale: 2 },
        { cols: 60, rows: 30, char: 'ascii' },
        { cols: 60, rows: 30, auto: true },
      ]) {
        runs.push(await perf(page, context, { view: 'external', pass: 'high', yaw: 0, pitch: 25, ...grid }, rate));
      }
    }
    results['perf'] = runs;
    console.table(runs);
  }

  if (want('interior')) {
    // Item 4: a perspective camera at the origin; does it see the inside of the strips?
    const combos = [
      { name: 'default', distance: 0, perspective: 32000 },
      { name: 'legacy', distance: 0, perspective: 0 },
      { name: 'legacy-d0.01', distance: 0.01, perspective: 0 },
      { name: 'persp400', distance: 0, perspective: 400 },
      { name: 'fps-default', distance: 0, perspective: 32000, fps: true },
      { name: 'fps-legacy', distance: 0, perspective: 0, fps: true },
      { name: 'fps-persp400', distance: 0, perspective: 400, fps: true },
    ];
    const interior: Record<string, unknown> = {};
    for (const ds of [false, true]) {
      for (const c of combos) {
        const name = `04-interior-${c.name}${ds ? '-ds' : ''}`;
        await open(page, { view: 'interior', pass: 'high', cols: 60, rows: 30, yaw: 0, pitch: 25, distance: c.distance, perspective: c.perspective, ds, ...('fps' in c ? { fps: true } : {}) });
        await shot(page, name);
        const text = await raster(page, name);
        interior[name] = { ink: text.replace(/\s/g, '').length, hotspots: await hotspots(page) };
      }
    }
    results['interior'] = interior;
  }

  if (want('colors')) {
    // Item 5: what does useColors emit?
    const colors: Record<string, unknown> = {};
    for (const on of [true, false]) {
      await open(page, { ...high, view: 'external', colors: on });
      colors[on ? 'on' : 'off'] = await page.evaluate(() => {
        const pre = document.querySelector('.dome-scene pre');
        const spans = pre ? Array.from(pre.querySelectorAll('span')) : [];
        const styled = spans.filter((s) => s.hasAttribute('style'));
        const styleTags = Array.from(document.querySelectorAll('style')).map((s) => ({ id: s.id, attrs: Array.from(s.attributes).map((a) => `${a.name}=${a.value}`), head: (s.textContent ?? '').slice(0, 120) }));
        return { spans: spans.length, styledSpans: styled.length, sample: styled[0]?.outerHTML.slice(0, 160) ?? null, classSpans: spans.filter((s) => s.className).length, styleTags };
      });
      await shot(page, `05-colors-${on ? 'on' : 'off'}`);
    }
    results['colors'] = colors;
  }

  if (want('panorama')) {
    // Item 7: the horizon panorama beside the dome, and the live marker.
    for (const pass of ['golden', 'high']) {
      await open(page, { view: 'panorama', pass, now: 0.55 });
      await shot(page, `07-panorama-${pass}`);
      await open(page, { view: 'both', pass, cols: 60, rows: 30, yaw: 0, pitch: 25, now: 0.55 });
      await shot(page, `07-both-${pass}`);
    }
    for (const f of [0.2, 0.5, 0.8]) {
      await open(page, { view: 'both', pass: 'high', cols: 60, rows: 30, yaw: 0, pitch: 25, now: f });
      await shot(page, `07-motion-${String(f).replace('.', '')}`);
    }
  }

  if (want('csp')) {
    // Items 5/6: the code-split production build of the dome under public/_headers.
    const { execSync } = await import('node:child_process');
    execSync('npx vite build -c spike/vite.bundle.config.ts', { stdio: 'inherit' });
    const pv: PreviewServer = await preview({ configFile: resolve('spike/vite.bundle.config.ts'), logLevel: 'error' });
    const base = pv.resolvedUrls?.local[0] ?? 'http://localhost:5198/';
    const csp: Record<string, unknown> = {};
    for (const on of [false, true]) {
      const p2 = await context.newPage();
      const violations: string[] = [];
      const requests: string[] = [];
      p2.on('request', (r) => requests.push(r.url().replace(base, '/')));
      p2.on('console', (m) => {
        if (/Content Security Policy/i.test(m.text())) violations.push(m.text().slice(0, 300));
      });
      await p2.goto(`${base}?colors=${on ? '1' : '0'}`);
      await p2.waitForTimeout(2500);
      const ink = await p2.evaluate(() => (document.querySelector('.dome-scene pre')?.textContent ?? '').replace(/\s/g, '').length);
      const color = await p2.evaluate(() => {
        const s = document.querySelector('.dome-scene pre span');
        return s ? getComputedStyle(s).color : null;
      });
      await p2.locator('#root').screenshot({ path: resolve(OUT, `05-csp-${on ? 'colors' : 'mono'}.png`) });
      csp[on ? 'colors' : 'mono'] = { ink, firstSpanColor: color, violations: [...new Set(violations)], requests };
      await p2.close();
    }
    await pv.close();
    results['csp'] = csp;
  }

  results['consoleErrors'] = [...new Set(errors)].slice(0, 40);
  writeFileSync(resolve(OUT, `measurements${steps.size ? '-' + [...steps].join('-') : ''}.json`), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
