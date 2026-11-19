/**
 * R200 (FR-OPEN-4, V216-15, D-1212): how long a throttled cold first visit takes from the first paint to the example's
 * outcome. A measurement, not a gate: it runs only under `EXAMPLE_WAIT=1`, prints each run and the best of three, and
 * the figure goes in R200's decisions block. The latch is read from the `example_shown` beacon (D-1182).
 */
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_DATE, NINE_DAYS_ON } from './observers';

test.skip(process.env['EXAMPLE_WAIT'] !== '1', 'a measurement: set EXAMPLE_WAIT=1 to run it (D-1212)');
/** Each run is a fresh context (empty storage and cache), so the options are passed to it rather than through `test.use`. */
const CONTEXT = { timezoneId: 'America/Argentina/Buenos_Aires', viewport: { width: 390, height: 844 }, serviceWorkers: 'block' as const };

/** Slow 4G (D-1212): 400 ms latency, 400 kbit/s down; the CPU at 4×. */
const LATENCY_MS = 400;
const DOWN_BYTES_PER_S = 400_000 / 8;
const CPU_RATE = 4;
const RUNS = 3;
const FORECAST = 'tests/fixtures/open-meteo/2026-09-02-neuquen-forecast.json';

/**
 * A fulfilled route skips the browser's network emulation, so the fixtures pay the same toll by hand: the latency and
 * the gzipped body at the throttled rate, as CelesTrak and Open-Meteo serve them compressed.
 */
async function serveThrottled(page: Page, url: string, file: (request: URL) => string): Promise<void> {
  await page.route(url, async (route) => {
    const body = readFileSync(file(new URL(route.request().url())));
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS + (gzipSync(body).length / DOWN_BYTES_PER_S) * 1000));
    await route.fulfill({ body, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
}

/** One cold visit: first paint → the `example_shown` beacon, ms. */
async function measure(page: Page): Promise<{ ms: number; outcome: string }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY_MS, downloadThroughput: DOWN_BYTES_PER_S, uploadThroughput: DOWN_BYTES_PER_S });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
  // Before the clock is installed, which fakes `performance` too: the real one times the paint and the beacon.
  await page.addInitScript(() => {
    const w = globalThis as { __WIYS_MEASURE__?: boolean; __shown__?: { t: number; body: string }; __paint__?: number };
    const real = performance;
    w.__WIYS_MEASURE__ = true;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') w.__paint__ = entry.startTime;
    }).observe({ type: 'paint', buffered: true });
    const send = Navigator.prototype.sendBeacon;
    Navigator.prototype.sendBeacon = function (url, data) {
      if (typeof data === 'string' && data.includes('"example_shown"') && !w.__shown__) w.__shown__ = { t: real.now(), body: data };
      return send.call(this, url, data);
    };
  });
  await page.clock.install({ time: NINE_DAYS_ON });
  await page.route('**/e', (route) => route.fulfill({ status: 204 }));
  await serveThrottled(page, 'https://celestrak.org/**', (url) => `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`);
  await serveThrottled(page, 'https://api.open-meteo.com/**', () => FORECAST);
  await page.goto('/');
  const shown = await page.waitForFunction(() => (globalThis as { __shown__?: unknown }).__shown__, null, { timeout: 60_000, polling: 100 });
  const { t, body } = (await shown.jsonValue()) as { t: number; body: string };
  const paint = await page.evaluate(() => (globalThis as { __paint__?: number }).__paint__ ?? 0);
  expect(paint, 'the first contentful paint').toBeGreaterThan(0);
  return { ms: t - paint, outcome: (JSON.parse(body) as { detail?: string }).detail ?? '' };
}

test('D-1212: a throttled cold first visit, first paint to the latch, best of three', async ({ browser, baseURL }) => {
  test.setTimeout(RUNS * 90_000);
  const runs: { ms: number; outcome: string }[] = [];
  for (let i = 0; i < RUNS; i++) {
    const context = await browser.newContext({ ...CONTEXT, ...(baseURL ? { baseURL } : {}) });
    const page = await context.newPage();
    runs.push(await measure(page));
    await context.close();
  }
  const best = Math.min(...runs.map((run) => run.ms));
  console.log(`exampleWait: ${runs.map((run) => `${(run.ms / 1000).toFixed(2)} s (${run.outcome})`).join(', ')}; best ${(best / 1000).toFixed(2)} s`);
  for (const run of runs) expect(['pass', 'none']).toContain(run.outcome);
});
