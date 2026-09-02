/**
 * R4 (FR-X-3, PLAN §11, D-25): the production build, served with the headers
 * Cloudflare will send, carries the PLAN §11 values on `/` and the
 * immutable cache header on `/assets/*`, and the R3 flow completes under the
 * strict CSP with zero violations and no request to a host other than the site
 * and CelesTrak. This is the offline twin of the task's `curl -sI` and
 * DevTools checks against the deployed site.
 */
/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface HaFixture {
  capturedAt: string;
  observer: { lat: number; lon: number };
}

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

const FIXTURE_DATE = '2026-09-02';
const ha = JSON.parse(readFileSync(`tests/fixtures/heavens-above/${FIXTURE_DATE}-neuquen-iss.json`, 'utf8')) as HaFixture;
const DAY_MS = 86_400_000;

/** The `Name: value` lines of `public/_headers` under the given path pattern. */
function headersFor(pattern: string): Record<string, string> {
  const lines = readFileSync('public/_headers', 'utf8').split('\n');
  const start = lines.indexOf(pattern);
  if (start < 0) throw new Error(`public/_headers has no "${pattern}" rule`);
  const out: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    const colon = line.indexOf(':');
    out[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return out;
}

test('the site sends the PLAN §11 security headers and the immutable cache header on assets', async ({ page, baseURL }) => {
  const root = await page.goto('/');
  if (!root) throw new Error('no response for /');
  const expected = headersFor('/*');
  expect(Object.keys(expected)).toEqual(['content-security-policy', 'referrer-policy', 'permissions-policy']);
  for (const [name, value] of Object.entries(expected)) expect(root.headers()[name], name).toBe(value);
  expect(root.headers()['cache-control'] ?? '').not.toContain('immutable');

  const script = await page.locator('script[type="module"][src^="/assets/"]').first().getAttribute('src');
  if (!script) throw new Error('index.html has no /assets/ module script');
  const asset = await page.request.get(new URL(script, baseURL).toString());
  expect(asset.ok()).toBe(true);
  expect(asset.headers()['cache-control']).toBe(headersFor('/assets/*')['cache-control']);
  expect(asset.headers()['content-security-policy']).toBe(expected['content-security-policy']);
});

test('the R3 flow completes under the strict CSP with zero violations and only site + CelesTrak requests', async ({ page, baseURL }) => {
  await page.clock.setFixedTime(Date.parse(ha.capturedAt) + 9 * DAY_MS);
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations?.push(`${e.violatedDirective} blocked ${e.blockedURI} at ${e.sourceFile}:${String(e.lineNumber)}`);
    });
  });

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  const hosts = new Set<string>();
  page.on('request', (req) => hosts.add(new URL(req.url()).host));

  await page.route('https://celestrak.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      path: `tests/fixtures/omm/${FIXTURE_DATE}-${url.searchParams.get('GROUP') ?? 'unknown'}.json`,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
    });
  });

  await page.goto('/');
  await page.getByLabel('Coordinates (lat, lon)').fill(`${String(ha.observer.lat)}, ${String(ha.observer.lon)}`);
  await expect(page.getByRole('region', { name: 'Upcoming passes' }).getByRole('status')).toHaveText(/\d+ visible passes in the next 24 h/, { timeout: 15_000 });
  await expect(page.getByRole('article', { name: 'ISS (Zarya)' })).toHaveCount(1);

  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect([...hosts].sort()).toEqual([new URL(baseURL ?? '').host, 'celestrak.org'].sort());
});
