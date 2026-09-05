/**
 * R38 (FR-WIN-7): the captures and the desktop-measurable numbers of the
 * sky-window spike, into `docs/window/`. It starts the Vite dev server,
 * opens the two spike pages in Chromium with a phone profile and writes
 *
 *   shots   the window under both projections for both fixture passes at
 *           390 px, pointed at the pass's peak by the manual angles, and the
 *           stripe page in its three stepping modes
 *   rate    the D-62 method: synthetic orientation events at 60 Hz for 5 s
 *           under a 6× CPU throttle, and what the page drew per second
 *
 * and `measurements.md`, which `FINDINGS.md` quotes. What only a phone can
 * answer (OQ-17, the feel of the stepping) is not here: the owner runs the
 * pages on the device and pastes the `[ copy facts ]` text into the findings.
 *
 *   npm run spike:window:capture
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices, type Browser, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { PASSES } from '../passes';
import { windowQuery, type PassName, type Projection, type WindowParams, WINDOW_DEFAULTS } from './params';

const OUT = resolve('docs/window');
const PORT = 5199;
const WIDTH = 390;
/** The window shots look this far above the horizon towards the pass's peak azimuth, so the horizon and the compass names stay in view under a 60° field. */
const AIM_ALT_DEG = 20;
/** How long the synthetic sweep runs. */
const SECONDS = 5;
const url = (path: string, query: string): string => `http://localhost:${String(PORT)}/spike/window/${path}?${query}`;

/** The manual angles that point the back of the phone at a sky direction: alpha = 360 − azimuth, beta = 90 + altitude. */
const aimedAt = (azDeg: number, altDeg: number): WindowParams['manual'] => ({ alpha: Math.round((360 - azDeg) % 360), beta: Math.round(90 + altDeg), gamma: 0 });

interface RateResult {
  projection: Projection;
  throttle: number;
  eventsPerSecond: number;
  drawsPerSecond: number;
  longestGapMs: number;
}

/** Two aims per pass: at the horizon under the peak (the compass and the ticks in view) and at the peak itself (the arc's whole sweep, the key at the peak). */
async function shoot(page: Page, projection: Projection, pass: PassName, aim: 'horizon' | 'peak'): Promise<string> {
  const fixture = PASSES[pass];
  if (!fixture) throw new Error(`no fixture ${pass}`);
  const params: WindowParams = { ...WINDOW_DEFAULTS, projection, pass, manual: aimedAt(fixture.peak.azDeg, aim === 'horizon' ? AIM_ALT_DEG : fixture.peak.elDeg) };
  await page.goto(url('', windowQuery(params)));
  await page.locator('svg.window path.arc').first().waitFor();
  const name = `window-${projection}-${pass}-${aim}-390.png`;
  await page.locator('svg.window').screenshot({ path: resolve(OUT, name) });
  return name;
}

async function shootStripe(page: Page, step: 'buttons' | 'tap' | 'drag'): Promise<string> {
  await page.goto(url('stripe.html', `step=${step}`));
  await page.locator('svg.stripe').waitFor();
  const name = `stripe-${step}-390.png`;
  await page.locator('main').screenshot({ path: resolve(OUT, name) });
  return name;
}

/** D-62: feed the page 60 orientation events a second for five seconds and read what it drew, under a CPU throttle. */
async function rate(page: Page, projection: Projection, throttle: number): Promise<RateResult> {
  await page.goto(url('', windowQuery({ ...WINDOW_DEFAULTS, projection, others: 3 })));
  await page.locator('svg.window').waitFor();
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // A string, not a function: tsx runs esbuild with `keepNames`, which wraps every inner function in a
  // `__name` helper that does not exist inside the page.
  const result = (await page.evaluate(`(async () => {
    const hooks = window.__window;
    const start = performance.now();
    let i = 0;
    await new Promise((done) => {
      const tick = () => {
        if (performance.now() - start >= ${String(SECONDS)} * 1000) { done(); return; }
        // A slow sweep across the sky with a small tilt, the way a hand moves.
        hooks.feed({ alpha: (i * 0.5) % 360, beta: 100 + 15 * Math.sin(i / 40), gamma: 5 * Math.sin(i / 25), absolute: true });
        i += 1;
        setTimeout(tick, 1000 / 60);
      };
      tick();
    });
    return hooks.stats();
  })()`)) as { eventsPerSecond: number; drawsPerSecond: number; longestGapMs: number; events: number };
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { projection, throttle, eventsPerSecond: result.eventsPerSecond, drawsPerSecond: result.drawsPerSecond, longestGapMs: result.longestGapMs };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server: ViteDevServer = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser: Browser = await chromium.launch();
  try {
    const context = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: WIDTH, height: 844 } });
    const page = await context.newPage();
    const shots: string[] = [];
    for (const projection of ['stereographic', 'gnomonic'] as const) for (const pass of ['high', 'golden'] as const) for (const aim of ['horizon', 'peak'] as const) shots.push(await shoot(page, projection, pass, aim));
    for (const step of ['buttons', 'tap', 'drag'] as const) shots.push(await shootStripe(page, step));
    const rates: RateResult[] = [];
    for (const projection of ['stereographic', 'gnomonic'] as const) for (const throttle of [1, 4, 6]) rates.push(await rate(page, projection, throttle));
    const lines = [
      '# Sky-window spike: measurements (R38)',
      '',
      `Captured by \`npm run spike:window:capture\` on ${new Date().toISOString().slice(0, 10)} in Playwright's Chromium with the Pixel 5 profile at ${String(WIDTH)} px.`,
      '',
      '## Update rate (the D-62 method)',
      '',
      'Synthetic `deviceorientation` readings fed at 60 per second for 5 s, a slow sweep with a small tilt, three companion passes drawn beside the fixture pass. "Draws" are frames in which the window was re-projected and committed; the FR-WIN-3 target is ≥ 30 per second on the phone.',
      '',
      '| Projection | CPU throttle | Events/s | Draws/s | Longest gap |',
      '|---|---|---|---|---|',
      ...rates.map((r) => `| ${r.projection} | ${String(r.throttle)}× | ${String(r.eventsPerSecond)} | ${String(r.drawsPerSecond)} | ${String(r.longestGapMs)} ms |`),
      '',
      '## Captures',
      '',
      ...shots.map((s) => `- \`${s}\``),
      '',
      'The `horizon` window shots point the manual angles at each fixture pass\'s peak azimuth, 20° above the horizon; the `peak` shots point at the peak itself; the stripe shots are the three stepping candidates at rest.',
      '',
    ];
    writeFileSync(resolve(OUT, 'measurements.md'), lines.join('\n'));
    process.stdout.write(`${lines.join('\n')}\n`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
