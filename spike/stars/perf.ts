/**
 * R111 (FR-STAR-9, D-741 item 2): the rate by D-62's method — Playwright's
 * Chromium, the Pixel 5 profile, the CPU throttled — for the four
 * combinations of `render` and `mark`, every layer on, over the dense southern
 * field (Crux, Centaurus, Carina). The page turns its own camera every frame
 * for five seconds (`__stars.sweep`) and counts the frames it drew; what a
 * phone draws under the sensor is the owner's reading of the same meter.
 * Also prints each glyph's ink offset, which `inkfix` corrects.
 *
 *   npx tsx spike/stars/perf.ts
 */
import { devices } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { measureCatalog } from './catalog';
import { STARS_DEFAULTS, starsQuery } from './params';
import { load, startServer, withBrowser } from './serve';

const SECONDS = 5;
export const THROTTLES = [1, 4, 6] as const;
const AT = '2027-04-15T03:00:00Z';

export interface RateRow {
  render: 'react' | 'ref';
  mark: 'glyph' | 'disc';
  throttle: number;
  drawsPerSecond: number;
  longestGapMs: number;
}

export interface PerfMeasure {
  nodes: number;
  rows: RateRow[];
  ink: { char: string; px: number; x: number; y: number }[];
}

interface PageHook {
  nodes: number;
  sweep: (s: number) => Promise<{ drawsPerSecond: number; longestGapMs: number }>;
  ink: (c: string, px: number) => { x: number; y: number };
}

export async function measurePerf(): Promise<PerfMeasure> {
  measureCatalog();
  const server = await startServer();
  try {
    return await withBrowser(async (open) => {
      const page = await open({ ...devices['Pixel 5'] });
      const session = await page.context().newCDPSession(page);
      const rows: RateRow[] = [];
      let nodes = 0;
      for (const render of ['react', 'ref'] as const) {
        for (const mark of ['glyph', 'disc'] as const) {
          await load(page, starsQuery({ ...STARS_DEFAULTS, render, mark, at: AT, facing: 180, tilt: 45 }));
          nodes = await page.evaluate(() => (window as unknown as { __stars: PageHook }).__stars.nodes);
          for (const throttle of THROTTLES) {
            await session.send('Emulation.setCPUThrottlingRate', { rate: throttle });
            const r = await page.evaluate(async (s) => (window as unknown as { __stars: PageHook }).__stars.sweep(s), SECONDS);
            await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
            rows.push({ render, mark, throttle, drawsPerSecond: Math.round(r.drawsPerSecond * 10) / 10, longestGapMs: r.longestGapMs });
          }
        }
      }
      const ink = await page.evaluate(() => ['*', '+', '.', '·', '@'].flatMap((char) => [12, 15].map((px) => ({ char, px, ...(window as unknown as { __stars: PageHook }).__stars.ink(char, px) }))));
      return { nodes, rows, ink };
    });
  } finally {
    await server.close();
  }
}

export function describe(m: PerfMeasure): string {
  const rows = m.rows.map((r) => `| ${r.render} | ${r.mark} | ${String(r.throttle)}× | ${r.drawsPerSecond.toFixed(1)} | ${String(r.longestGapMs)} |`);
  const ink = m.ink.map((i) => `| \`${i.char}\` | ${String(i.px)} | ${i.x.toFixed(2)} | ${i.y.toFixed(2)} |`);
  return [
    `${String(m.nodes)} nodes (stars, planets, labels, figure segments); Pixel 5 profile, ${String(SECONDS)} s sweep, every layer on.`,
    '',
    '| render | mark | CPU | draws/s | longest gap ms |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'Ink centre against the em box centre (px; + is right / below), `--font-mono` in Chromium:',
    '',
    '| glyph | px | x | y |',
    '|---|---|---|---|',
    ...ink,
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) console.log(describe(await measurePerf()));
