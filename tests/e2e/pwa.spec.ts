/**
 * R25 (FR-OFF-6): the install audit against the production build, at the
 * phone width the app is designed for. Chromium offers to install a page when
 * its manifest resolves same-origin and parses, names the app, starts inside
 * its own scope, asks for `standalone`, and has a PNG icon of at least 192 px
 * and one of 512 px — so the test walks the same path a browser does: read the
 * `<link rel="manifest">` off the served page, fetch what it points at, fetch
 * every icon it names, and check the bytes rather than the declaration.
 *
 * `tests/deploy/manifest.test.ts` holds the same criteria against the file in
 * the repository; this is the half that proves the site actually serves it,
 * under the CSP (`manifest-src 'self'`, D-75) and with no console error.
 *
 * The service worker's own half of FR-OFF-1 is the last two tests: what the
 * build actually generated, read back off the served file, and the shell
 * coming out of the precache with the network down.
 */
/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

const PHONE = { width: 390, height: 844 };

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string }[];
}

test('the phone-width page offers everything an install needs', async ({ page, baseURL }) => {
  await page.setViewportSize(PHONE);
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations?.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');

  const response = await page.request.get(new URL(href ?? '', baseURL).toString());
  expect(response.ok()).toBe(true);
  // Cloudflare serves `.webmanifest` as this; a wrong type is the one thing that
  // makes a valid manifest invisible to the install prompt.
  expect(response.headers()['content-type']).toContain('manifest+json');

  const manifest = JSON.parse(await response.text()) as Manifest;
  expect(manifest.display).toBe('standalone');
  expect(manifest.name.length).toBeGreaterThan(0);
  expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);

  const sizes = new Set<string>();
  for (const icon of manifest.icons) {
    const image = await page.request.get(new URL(icon.src, baseURL).toString());
    expect(image.ok(), `${icon.src} is not served`).toBe(true);
    expect(image.headers()['content-type']).toBe('image/png');
    // The PNG's own IHDR, not the manifest's claim about it.
    const bytes = await image.body();
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)].join('x')).toBe(icon.sizes);
    sizes.add(icon.sizes);
  }
  expect([...sizes].sort()).toEqual(['192x192', '512x512']);

  // The manifest is fetched by the page itself, under `manifest-src 'self'` (D-75).
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
});

test('the icon Safari installs from is served too', async ({ page, baseURL }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/');
  const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const image = await page.request.get(new URL(href ?? '', baseURL).toString());
  expect(image.ok()).toBe(true);
});

/**
 * D-79's promise is negative — the worker caches the shell and *nothing else* —
 * and the only honest way to check a negative is to read the file the build
 * wrote. A `runtimeCaching` entry added later, or a Workbox default that starts
 * matching cross-origin GETs, would put a cache in front of CelesTrak or
 * Open-Meteo where the store's own 2 h and 30 min rules are supposed to decide,
 * and nothing else in the suite would notice.
 */
test('the generated worker precaches the shell and routes nothing else', async ({ page, baseURL }) => {
  const response = await page.request.get(new URL('/sw.js', baseURL).toString());
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('javascript');
  const source = await response.text();

  // Neither provider, in any form, anywhere in the worker or its runtime.
  const runtime = await page.request.get(new URL(/["']\.\/(workbox-[a-z0-9]+)["']/.exec(source)?.[1] ?? '', baseURL).toString());
  for (const [name, text] of [['sw.js', source], ['the workbox runtime', await runtime.text()]] as const) {
    expect(text, `${name} names CelesTrak`).not.toMatch(/celestrak/i);
    expect(text, `${name} names Open-Meteo`).not.toMatch(/open-meteo/i);
  }

  // One route, and it is the navigation fallback. `runtimeCaching: []` is what
  // keeps it at one; any provider route would be a second `registerRoute`.
  const routes = source.match(/\.registerRoute\(/g) ?? [];
  expect(routes).toHaveLength(1);
  expect(source).toContain('NavigationRoute');
  expect(source).toContain('createHandlerBoundToURL("index.html")');

  // The precache is the build plus the three things the default glob misses:
  // the braille font (D-65), the manifest and the icons.
  const precached = [...source.matchAll(/url:"([^"]+)"/g)].map((match) => match[1] ?? '');
  expect(precached).toContain('index.html');
  expect(precached).toContain('manifest.webmanifest');
  expect(precached).toContain('icon-192.png');
  expect(precached).toContain('icon-512.png');
  expect(precached.filter((url) => url.endsWith('.otf'))).toHaveLength(1);
  expect(precached.filter((url) => url.endsWith('.js')).length).toBeGreaterThan(1);
});

/**
 * FR-OFF-1, US-16 AC1: one warm visit, then the network is gone and the app
 * still opens. The providers are aborted on the warm visit too, so the test
 * says nothing about data — that is R24's and R27's ground. What it proves is
 * narrower and is the thing a service worker is for: with `setOffline`, which
 * takes down the app's own origin as well, the document, the scripts, the
 * stylesheet and the font all come out of the precache and the shell paints.
 */
test('with the network down the shell still loads', async ({ page }) => {
  for (const pattern of ['https://celestrak.org/**', 'https://api.open-meteo.com/**', 'https://geocoding-api.open-meteo.com/**']) {
    await page.route(pattern, (route) => route.abort('failed'));
  }
  const heading = page.getByRole('banner').getByRole('heading', { level: 1 });

  await page.goto('/');
  await expect(heading).toBeVisible();
  // `clientsClaim` is off (D-79), so this page is never controlled; what the
  // reload needs is only that the worker finished installing its precache and
  // reached `activated`. `ready` resolves a tick earlier than that — while the
  // worker is still `activating` — so poll the state rather than read it once.
  await expect.poll(async () => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');

  await page.context().setOffline(true);
  try {
    await page.reload();
    await expect(heading).toHaveText('What is in your sky right now');
    // Served by the worker, not by a browser cache that happened to hold it.
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  } finally {
    await page.context().setOffline(false);
  }
});
