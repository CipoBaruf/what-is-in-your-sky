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
 * The service worker's own half of FR-OFF-1 — the shell served from the
 * precache with the network down — waits on `vite-plugin-pwa` (see the R25
 * note in TASKS.md).
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
