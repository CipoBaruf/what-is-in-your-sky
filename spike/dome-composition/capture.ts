/**
 * R16 (FR-DOME-8): the one script that regenerates every capture and figure in
 * `docs/dome-composition/` from scratch. It starts the Vite dev server, opens
 * the spike page in Chromium, and for every candidate composition writes
 *
 *   shots     PNGs at 390 px and 1280 px of both fixture passes, plus a night
 *             capture per candidate, and the raw `<pre>` text of each layer
 *   perf      the D-62 drag measurement (5 s scripted pointer drag, 6× CPU
 *             throttle) per candidate, an ablation ladder that prices each
 *             layer separately, and the pulse's update rate with no drag
 *   probe     what the DOM actually contains: one `<pre>` per layer, the
 *             `<span>` count, whether per-mesh `density` pops its own `<pre>`,
 *             whether `setInteracting` really coarsens the grid, and how far
 *             the two layers' rasters are from each other (the §8.7 alignment)
 *   contrast  WCAG ratios of every candidate colour against its theme's ground
 *
 * and finally `measurements.json` and `measurements.md`, which are the figures
 * `findings.md` quotes.
 *
 *   npx tsx spike/dome-composition/capture.ts             # everything
 *   npx tsx spike/dome-composition/capture.ts probe perf  # only those steps
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { contrastRatio } from '../../scripts/contrast';
import { CANDIDATES, type Candidate } from './candidates';
import { MEANINGS, paletteFor } from './palette';
import { toQuery, type Params } from './params';

const OUT = resolve('docs/dome-composition');
const RASTER = resolve(OUT, 'raster');
const PORT = 5197;
const steps = new Set(process.argv.slice(2));
const want = (name: string): boolean => steps.size === 0 || steps.has(name);

/** FR-DOME-1: the cell keeps its 390 px proportions, so the column count grows with the width. */
export const CELL_WIDTH_PX = 6.5;
export const colsFor = (widthPx: number): number => Math.round(widthPx / CELL_WIDTH_PX);
const PHONE_WIDTH = 390;
const DESKTOP_WIDTH = 1280;

const url = (params: Params): string => `http://localhost:${String(PORT)}/spike/dome-composition/?${toQuery(params)}`;

interface LayerFacts {
  layer: string;
  pres: number;
  cols: number;
  rows: number;
  spans: number;
  styledSpans: number;
  inkCells: number;
  box: { width: number; height: number; left: number; top: number };
  /** Cell sizes of every `<pre>` in the layer: a second, smaller one is a per-mesh `density` layer. */
  cellWidths: number[];
}

declare global {
  interface Window {
    __spike: { start: (target: Element) => void; stop: () => Record<string, number | null>; ready: () => boolean };
  }
}

/** What each layer's raster looks like right now, read from the DOM. */
async function layerFacts(page: Page): Promise<LayerFacts[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-layer]')).map((host) => {
      const pres = Array.from(host.querySelectorAll('pre'));
      const first = pres[0];
      const text = first?.textContent ?? '';
      const lines = text.split('\n');
      const rect = (first ?? host).getBoundingClientRect();
      return {
        layer: host.dataset['layer'] ?? '?',
        pres: pres.length,
        cols: (lines[0] ?? '').length,
        rows: lines.length,
        spans: host.querySelectorAll('pre span').length,
        styledSpans: host.querySelectorAll('pre span[style]').length,
        inkCells: text.replace(/[\s⠀]/g, '').length,
        box: { width: rect.width, height: rect.height, left: rect.left, top: rect.top },
        cellWidths: pres.map((pre) => {
          const line = (pre.textContent ?? '').split('\n')[0] ?? '';
          return line.length > 0 ? pre.getBoundingClientRect().width / line.length : 0;
        }),
      };
    }),
  );
}

async function open(page: Page, params: Params): Promise<void> {
  await page.goto(url(params));
  await page.waitForFunction(() => window.__spike.ready(), null, { timeout: 30_000 }).catch(() => {
    console.log('not ready in 30 s:', toQuery(params));
  });
  await page.waitForTimeout(350);
}

async function raster(page: Page, name: string): Promise<void> {
  const layers = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-layer]')).map((host) => ({
      layer: host.dataset['layer'] ?? '?',
      text: Array.from(host.querySelectorAll('pre'))
        .map((pre) => pre.textContent ?? '')
        .join('\n---\n'),
    })),
  );
  for (const { layer, text } of layers) writeFileSync(resolve(RASTER, `${name}-${layer}.txt`), text);
}

/** A 5 s scripted drag over the drawing (D-62): a real pointer, moving every ~8 ms. */
async function drag(page: Page, seconds: number): Promise<number> {
  const box = await page.locator('.stage-inner').boundingBox();
  if (!box) throw new Error('no stage');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  let moves = 0;
  while (Date.now() - t0 < seconds * 1000) {
    const phase = ((Date.now() - t0) / 1000) * Math.PI;
    await page.mouse.move(cx + Math.sin(phase) * box.width * 0.35, cy + Math.cos(phase * 0.7) * box.height * 0.2);
    moves++;
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  return moves;
}

interface PerfRun {
  name: string;
  query: string;
  width: number;
  cpuThrottle: number;
  action: 'drag' | 'pulse';
  rasterPerSecond: number;
  mutationBatchesPerSecond: number;
  longestFrameGapMs: number;
  loafMaxMs: number | null;
  pointerMoves: number;
  spans: number;
  meetsTarget: boolean;
}

/** The D-62 measurement for one composition: rasterisations per second during a drag (or with the pulse alone). */
async function measure(page: Page, context: BrowserContext, name: string, params: Params, rate: number, action: 'drag' | 'pulse'): Promise<PerfRun> {
  await open(page, params);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__spike.start(document.querySelector('.layers') as Element);
  });
  let moves = 0;
  if (action === 'drag') moves = await drag(page, 5);
  else await page.waitForTimeout(5000);
  const result = await page.evaluate(() => window.__spike.stop());
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();
  const facts = await layerFacts(page);
  const seconds = Number(result['seconds'] ?? 5);
  const rasterPerSecond = Number(result['rasterPerSecond'] ?? 0);
  return {
    name,
    query: toQuery(params),
    width: params.width,
    cpuThrottle: rate,
    action,
    rasterPerSecond: Number(rasterPerSecond.toFixed(1)),
    mutationBatchesPerSecond: Number((Number(result['mutationBatches'] ?? 0) / seconds).toFixed(1)),
    longestFrameGapMs: Number(Number(result['longestFrameGapMs'] ?? 0).toFixed(1)),
    loafMaxMs: result['loafMaxMs'] === null || result['loafMaxMs'] === undefined ? null : Number(Number(result['loafMaxMs']).toFixed(1)),
    pointerMoves: moves,
    spans: facts.reduce((sum, f) => sum + f.spans, 0),
    meetsTarget: rasterPerSecond >= 30,
  };
}

const at = (candidate: Candidate, patch: Partial<Params>): Params => ({ ...candidate.params, ...patch });

async function main(): Promise<void> {
  mkdirSync(RASTER, { recursive: true });
  const results: Record<string, unknown> = { generatedBy: 'npx tsx spike/dome-composition/capture.ts', cellWidthPx: CELL_WIDTH_PX };
  const server: ViteDevServer = await createServer({ configFile: resolve('vite.config.ts'), server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser: Browser = await chromium.launch();
  const phone: BrowserContext = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: PHONE_WIDTH, height: 844 }, deviceScaleFactor: 2 });
  const desktop: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const errors: string[] = [];
  const watch = (page: Page): Page => {
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text().slice(0, 200)}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
    return page;
  };
  const phonePage = watch(await phone.newPage());
  const desktopPage = watch(await desktop.newPage());

  if (want('shots')) {
    const shots: Record<string, unknown> = {};
    for (const c of CANDIDATES) {
      for (const pass of ['golden', 'high'] as const) {
        for (const [label, page, width] of [
          ['390', phonePage, PHONE_WIDTH],
          ['1280', desktopPage, DESKTOP_WIDTH],
        ] as const) {
          const params = at(c, { pass, width, cols: colsFor(width) });
          const name = `${c.name}-${pass}-${label}`;
          await open(page, params);
          await page.locator('#stage').screenshot({ path: resolve(OUT, `${name}.png`) });
          await raster(page, name);
          shots[name] = { query: toQuery(params), layers: await layerFacts(page) };
        }
      }
      // Both themes (FR-THEME-3): the night capture is at the phone width, where the colours have to work first.
      const night = at(c, { pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH), theme: 'night' });
      await open(phonePage, night);
      await phonePage.locator('#stage').screenshot({ path: resolve(OUT, `${c.name}-night-390.png`) });
      shots[`${c.name}-night-390`] = { query: toQuery(night) };
    }
    results['shots'] = shots;
  }

  if (want('base')) {
    // The base layer on its own: which ramp, how coarse and how far the ground reaches (FR-DOME-3, FR-DOME-8a).
    const chosen = CANDIDATES.find((c) => c.name === 'layered') ?? CANDIDATES[0];
    if (chosen) {
      const variants: [string, Partial<Params>][] = [
        ['ramp-blocks', { basePalette: 'blocks' }],
        ['ramp-dots', { basePalette: 'dots' }],
        ['ramp-default', { basePalette: 'default' }],
        ['ramp-ascii', { basePalette: 'ascii' }],
        ['ratio-0.34', { baseRatio: 0.34 }],
        ['ratio-1', { baseRatio: 1 }],
        ['ambient-0.15', { ambient: 0.15 }],
        ['ambient-0.6', { ambient: 0.6 }],
        ['ground-1.0', { groundRadius: 1.0 }],
        ['ground-1.3', { groundRadius: 1.3 }],
        ['no-bowl', { bowl: false }],
        ['no-ground', { ground: false }],
        ['sun-at-horizon', { sunAlt: -2 }],
        ['sun-deep', { sunAlt: -16 }],
      ];
      for (const [name, patch] of variants) {
        const params = at(chosen, { ...patch, pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
        await open(phonePage, params);
        await phonePage.locator('#stage').screenshot({ path: resolve(OUT, `base-${name}-390.png`) });
      }
    }
  }

  if (want('elements')) {
    // What each piece of furniture costs the drawing: companions, ticks, labels, the Moon.
    const chosen = CANDIDATES.find((c) => c.name === 'layered') ?? CANDIDATES[0];
    if (chosen) {
      const variants: [string, Partial<Params>][] = [
        ['others-0', { others: 0 }],
        ['others-1', { others: 1 }],
        ['others-3', { others: 3 }],
        ['no-ticks', { ticks: false }],
        ['no-ring-labels', { ringLabels: false }],
        ['no-time-labels', { timeLabels: false }],
        ['no-moon', { moon: false }],
        ['no-live-marker', { now: -1 }],
        ['thin-pass', { passWeight: 0.05 }],
        ['fat-pass', { passWeight: 1.5 }],
        ['bare', { others: 0, ticks: false, ringLabels: false, timeLabels: false, moon: false, base: false }],
      ];
      for (const [name, patch] of variants) {
        const params = at(chosen, { ...patch, pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
        await open(phonePage, params);
        await phonePage.locator('#stage').screenshot({ path: resolve(OUT, `elements-${name}-390.png`) });
      }
    }
  }

  if (want('tilt')) {
    // FR-DOME-8: the tilt default is chosen from 35–55, on the pass that shows the difference (the high one).
    const chosen = CANDIDATES.find((c) => c.name === 'layered') ?? CANDIDATES[0];
    if (chosen) {
      for (const tilt of [35, 40, 45, 50, 55]) {
        const params = at(chosen, { tilt, pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
        await open(phonePage, params);
        await phonePage.locator('#stage').screenshot({ path: resolve(OUT, `tilt-${String(tilt)}-390.png`) });
      }
      for (const mer of ['none', 'cardinal', 'eight', 'sixteen'] as const) {
        const params = at(chosen, { meridians: mer, pass: 'golden', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
        await open(phonePage, params);
        await phonePage.locator('#stage').screenshot({ path: resolve(OUT, `meridians-${mer}-390.png`) });
      }
    }
  }

  if (want('probe')) {
    // P-OQ-4: what the two scenes and the per-mesh density actually produce.
    const chosen = CANDIDATES.find((c) => c.name === 'layered') ?? CANDIDATES[0];
    const probe: Record<string, unknown> = {};
    if (chosen) {
      for (const [name, patch] of [
        ['density-1', { passDensity: 1 }],
        ['density-2', { passDensity: 2 }],
        ['density-3', { passDensity: 3 }],
        ['colors-off', { colors: false }],
        ['tol-128', { tol: 128 }],
        ['tol-inf', { tol: 765 }],
        ['atlas', { encoding: 'atlas' as const }],
        ['base-off', { base: false }],
      ] as const) {
        const params = at(chosen, { ...patch, pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
        await open(phonePage, params);
        await phonePage.locator('#stage').screenshot({ path: resolve(OUT, `probe-${name}-390.png`) });
        probe[name] = { query: toQuery(params), layers: await layerFacts(phonePage) };
      }
      // Does `setInteracting` (the only way to reach `interactiveDownscale` from React) coarsen the grid?
      const params = at(chosen, { downscale: 2, width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
      await open(phonePage, params);
      const before = await layerFacts(phonePage);
      const box = await phonePage.locator('.stage-inner').boundingBox();
      if (box) {
        await phonePage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await phonePage.mouse.down();
        await phonePage.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 5);
        await phonePage.waitForTimeout(250);
        const during = await layerFacts(phonePage);
        await phonePage.mouse.up();
        await phonePage.waitForTimeout(250);
        probe['interactiveDownscale'] = { query: toQuery(params), before, during, after: await layerFacts(phonePage) };
      }
      // §8.7 alignment: the two layers must cover the same box to the pixel.
      const aligned = at(chosen, { width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
      await open(phonePage, aligned);
      const facts = await layerFacts(phonePage);
      const base = facts.find((f) => f.layer === 'base');
      const lines = facts.find((f) => f.layer === 'lines');
      probe['alignment'] =
        base && lines
          ? { baseBox: base.box, linesBox: lines.box, deltaWidthPx: Number((base.box.width - lines.box.width).toFixed(2)), deltaLeftPx: Number((base.box.left - lines.box.left).toFixed(2)), deltaTopPx: Number((base.box.top - lines.box.top).toFixed(2)) }
          : { note: 'a layer is missing' };
    }
    results['probe'] = probe;
  }

  if (want('perf')) {
    const runs: PerfRun[] = [];
    // Every candidate under the D-62 method, at the phone width.
    for (const c of CANDIDATES) {
      const params = at(c, { pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) });
      runs.push(await measure(phonePage, phone, c.name, params, 6, 'drag'));
    }
    // The ablation ladder: what each layer of the composition costs on its own.
    const chosen = CANDIDATES.find((c) => c.name === 'layered') ?? CANDIDATES[0];
    if (chosen) {
      const ladder: [string, Partial<Params>][] = [
        ['lines only, mono', { base: false, colors: false, passDensity: 1, pulse: false }],
        ['lines only, colour', { base: false, colors: true, passDensity: 1, pulse: false }],
        ['+ base scene', { base: true, colors: true, passDensity: 1, pulse: false }],
        ['+ pass density 2', { base: true, colors: true, passDensity: 2, pulse: false }],
        ['+ pulse', { base: true, colors: true, passDensity: 2, pulse: true }],
        ['fallback: colorTolerance 128', { base: true, colors: true, passDensity: 2, pulse: true, tol: 128 }],
        ['fallback: downscale 2', { base: true, colors: true, passDensity: 2, pulse: true, downscale: 2 }],
        ['fallback: drop base while dragging', { base: true, colors: true, passDensity: 2, pulse: true, dropBaseOnDrag: true }],
        ['all three fallbacks', { base: true, colors: true, passDensity: 2, pulse: true, tol: 128, downscale: 2, dropBaseOnDrag: true }],
      ];
      for (const [name, patch] of ladder) {
        runs.push(await measure(phonePage, phone, name, at(chosen, { ...patch, pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) }), 6, 'drag'));
      }
      // The desktop grid (FR-DOME-1): the same composition with the column count the width buys.
      runs.push(await measure(desktopPage, desktop, 'layered @1280', at(chosen, { pass: 'high', width: DESKTOP_WIDTH, cols: colsFor(DESKTOP_WIDTH) }), 6, 'drag'));
      runs.push(await measure(desktopPage, desktop, 'layered @1280, fallbacks', at(chosen, { pass: 'high', width: DESKTOP_WIDTH, cols: colsFor(DESKTOP_WIDTH), tol: 128, downscale: 2, dropBaseOnDrag: true }), 6, 'drag'));
      // The same box with the column count capped: is a coarser desktop grid the cheaper answer than the fallbacks?
      runs.push(await measure(desktopPage, desktop, 'layered @1280, 140 cols', at(chosen, { pass: 'high', width: DESKTOP_WIDTH, cols: 140 }), 6, 'drag'));
      runs.push(await measure(desktopPage, desktop, 'layered @1280, 120 cols', at(chosen, { pass: 'high', width: DESKTOP_WIDTH, cols: 120 }), 6, 'drag'));
      runs.push(await measure(desktopPage, desktop, 'layered @1280, 100 cols', at(chosen, { pass: 'high', width: DESKTOP_WIDTH, cols: 100 }), 6, 'drag'));
      // A 1280 px box is a desktop, which the 6× throttle does not model; these are the same grids on the machine that would draw them.
      runs.push(await measure(desktopPage, desktop, 'layered @1280, no throttle', at(chosen, { pass: 'high', width: DESKTOP_WIDTH, cols: colsFor(DESKTOP_WIDTH) }), 1, 'drag'));
      runs.push(await measure(desktopPage, desktop, 'layered @1280, 120 cols, no throttle', at(chosen, { pass: 'high', width: DESKTOP_WIDTH, cols: 120 }), 1, 'drag'));
      // Unthrottled reference, and the pulse on its own (FR-DOME-8d: does it hold ≥ 30 updates/s?).
      runs.push(await measure(phonePage, phone, 'layered, no throttle', at(chosen, { pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH) }), 1, 'drag'));
      runs.push(await measure(phonePage, phone, 'pulse only, no drag', at(chosen, { pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH), pulse: true }), 6, 'pulse'));
      runs.push(await measure(phonePage, phone, 'pulse only, lines only', at(chosen, { pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH), pulse: true, base: false }), 6, 'pulse'));
      runs.push(await measure(phonePage, phone, 'pulse only, asking for 60/s', at(chosen, { pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH), pulse: true, pulseHz: 60 }), 6, 'pulse'));
      runs.push(await measure(phonePage, phone, 'pulse only, asking for 60/s, no throttle', at(chosen, { pass: 'high', width: PHONE_WIDTH, cols: colsFor(PHONE_WIDTH), pulse: true, pulseHz: 60 }), 1, 'pulse'));
    }
    results['perf'] = runs;
    console.table(runs.map(({ name, cpuThrottle, action, rasterPerSecond, longestFrameGapMs, spans }) => ({ name, cpuThrottle, action, rasterPerSecond, longestFrameGapMs, spans })));
  }

  if (want('contrast')) {
    // FR-THEME-2 / FR-X-5: every candidate colour against the ground it sits on.
    const table: Record<string, Record<string, number>> = {};
    for (const set of ['cool', 'warm', 'mono']) {
      for (const theme of ['dark', 'night']) {
        const palette = paletteFor(set, theme);
        const row: Record<string, number> = {};
        for (const meaning of MEANINGS) row[meaning] = Number(contrastRatio(palette[meaning], palette.bg).toFixed(2));
        table[`${set}/${theme}`] = row;
      }
    }
    results['contrast'] = table;
  }

  results['consoleErrors'] = [...new Set(errors)].slice(0, 40);
  writeFileSync(resolve(OUT, `measurements${steps.size > 0 ? `-${[...steps].join('-')}` : ''}.json`), `${JSON.stringify(results, null, 2)}\n`);
  if (steps.size === 0) writeFileSync(resolve(OUT, 'measurements.md'), markdown(results));
  console.log(JSON.stringify({ probe: results['probe'], contrast: results['contrast'], consoleErrors: results['consoleErrors'] }, null, 2));
  await browser.close();
  await server.close();
}

/** The figures `findings.md` quotes, as tables so a reader never opens the JSON. */
function markdown(results: Record<string, unknown>): string {
  const out: string[] = ['# Dome composition — measurements', '', '_Generated by `npx tsx spike/dome-composition/capture.ts`. Do not edit._', ''];
  const perf = results['perf'] as PerfRun[] | undefined;
  if (perf) {
    out.push('## Drag rate (D-62: 5 s scripted pointer drag, Playwright Chromium, Pixel 5 profile)', '');
    out.push('| composition | width | CPU throttle | action | rasterisations/s | longest frame (ms) | spans | ≥ 30/s |', '|---|---|---|---|---|---|---|---|');
    for (const r of perf) out.push(`| ${r.name} | ${String(r.width)} | ${String(r.cpuThrottle)}× | ${r.action} | ${r.rasterPerSecond.toFixed(1)} | ${r.longestFrameGapMs.toFixed(1)} | ${String(r.spans)} | ${r.meetsTarget ? 'yes' : 'NO'} |`);
    out.push('');
  }
  const probe = results['probe'] as Record<string, { layers?: LayerFacts[] }> | undefined;
  if (probe) {
    out.push('## What the DOM contains (P-OQ-4)', '', '| variant | layer | `<pre>`s | cols × rows | cell widths (px) | spans | styled spans | ink cells |', '|---|---|---|---|---|---|---|---|');
    for (const [name, value] of Object.entries(probe)) {
      for (const layer of value.layers ?? []) {
        out.push(`| ${name} | ${layer.layer} | ${String(layer.pres)} | ${String(layer.cols)} × ${String(layer.rows)} | ${layer.cellWidths.map((c) => c.toFixed(2)).join(', ')} | ${String(layer.spans)} | ${String(layer.styledSpans)} | ${String(layer.inkCells)} |`);
      }
    }
    out.push('');
    const alignment = probe['alignment'] as unknown as Record<string, number> | undefined;
    if (alignment) out.push(`Alignment (§8.7): Δwidth ${String(alignment['deltaWidthPx'])} px, Δleft ${String(alignment['deltaLeftPx'])} px, Δtop ${String(alignment['deltaTopPx'])} px.`, '');
  }
  const contrast = results['contrast'] as Record<string, Record<string, number>> | undefined;
  if (contrast) {
    const meanings = Object.keys(Object.values(contrast)[0] ?? {});
    out.push('## Contrast against the theme ground (FR-THEME-2: non-text ≥ 3 : 1)', '', `| set / theme | ${meanings.join(' | ')} |`, `|---|${meanings.map(() => '---').join('|')}|`);
    for (const [name, row] of Object.entries(contrast)) out.push(`| ${name} | ${meanings.map((m) => (row[m] ?? 0).toFixed(2)).join(' | ')} |`);
    out.push('');
  }
  const errors = results['consoleErrors'] as string[] | undefined;
  out.push('## Console', '', errors && errors.length > 0 ? errors.map((e) => `- \`${e}\``).join('\n') : 'No errors or warnings.', '');
  return out.join('\n');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
