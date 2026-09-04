import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PLAN §11: Vite + plugin-react, ES2022 output. The pass worker
// (`src/worker/passes.worker.ts`) is bundled from its URL in `state/workerClient.ts`.
// The sky dome is code-split behind `React.lazy` in `SkyChart.tsx` (R15), which is
// what makes the chart chunk a separate file; `scripts/bundle-budget.ts` measures the
// gzipped chunks against the §11 budgets after every build, and `BUNDLE_STATS=1`
// adds `rollup-plugin-visualizer`'s treemap at `bundle-stats/stats.html` (outside
// `dist/`, so it is never deployed). Worker chunks are ES modules (D-18):
// satellite.js 7 ships an optional WASM/pthreads build whose worker entry uses
// top-level await, which the default IIFE worker format rejects (the build is never
// loaded; we do not call `createWasmModule`).
export default defineConfig({
  plugins: [react(), pagesHeaders(), appShellWorker(), ...(process.env['BUNDLE_STATS'] ? [visualizer({ gzipSize: true, filename: 'bundle-stats/stats.html' }) as unknown as Plugin] : [])],
  build: { target: 'es2022' },
  worker: { format: 'es' },
});

interface HeaderRule {
  pattern: RegExp;
  headers: [name: string, value: string][];
}

/**
 * Parses a Cloudflare Pages `_headers` file: an unindented line is a path
 * pattern (`*` matches any run of characters, across `/`), the indented
 * `Name: value` lines below it apply to every path the pattern matches, and
 * every matching rule stacks.
 */
export function parsePagesHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const source = line
        .trim()
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*');
      rules.push({ pattern: new RegExp(`^${source}$`), headers: [] });
      continue;
    }
    const colon = line.indexOf(':');
    const rule = rules.at(-1);
    if (colon < 0 || !rule) throw new Error(`_headers: unexpected line "${line}"`);
    rule.headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
  }
  return rules;
}

/**
 * `vite preview` serves `public/_headers` the way Cloudflare static assets do (D-25),
 * so the Playwright run exercises the production build under the strict CSP and
 * a violation fails in CI instead of on the phone. The dev server is untouched:
 * React Fast Refresh needs inline scripts the CSP forbids.
 */
function pagesHeaders(): Plugin {
  return {
    name: 'wiys:pages-headers',
    configurePreviewServer(server) {
      const rules = parsePagesHeaders(readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'));
      server.middlewares.use((req, res, next) => {
        const { pathname } = new URL(req.url ?? '/', 'http://localhost');
        for (const rule of rules) {
          if (!rule.pattern.test(pathname)) continue;
          for (const [name, value] of rule.headers) res.setHeader(name, value);
        }
        next();
      });
    },
  };
}

/**
 * R25 (FR-OFF-1, FR-X-4 amended, D-79): the app shell's service worker.
 *
 * `generateSW` with an empty `runtimeCaching` is the whole point — Workbox
 * writes a worker that precaches the build and answers navigations from it,
 * and registers no route for anything else. CelesTrak and Open-Meteo are
 * therefore never intercepted: freshness there is the 2 h elements rule and
 * the 30 min forecast TTL in the store (R11, R24), which reason about time
 * and staleness in ways an HTTP cache cannot, and a worker holding a second
 * opinion about the same bytes is how offline data goes quietly wrong.
 * `tests/e2e/pwa.spec.ts` reads the generated file back and fails if either
 * host appears in it.
 *
 * `globPatterns` is the default list plus `otf` and `webmanifest`: the dome's
 * braille font (D-65) is an `.otf` emitted into `assets/`, and without it the
 * first offline load of the chart draws in whatever the page font has, which
 * is not braille. The manifest and the two icons are precached for the same
 * reason the shell is — an installed app that opens to nothing is worse than
 * one that was never offered.
 *
 * `registerType: 'prompt'` with `skipWaiting` and `clientsClaim` both off:
 * a new version installs and waits, and only `applyUpdate` lets it through
 * (R28's banner is its one caller), so nothing swaps under an open pass.
 * `injectRegister: null` because the registration is ours and lives in
 * `state/serviceWorker.ts` (D-126), and `manifest: false` because
 * `public/manifest.webmanifest` is hand-written and already linked from
 * `index.html` — generating a second one would serve two.
 */
function appShellWorker(): Plugin[] {
  return VitePWA({
    strategies: 'generateSW',
    registerType: 'prompt',
    injectRegister: null,
    manifest: false,
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,svg,otf,png,webmanifest}'],
      runtimeCaching: [],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
      skipWaiting: false,
      clientsClaim: false,
    },
    // A dev build generates no worker: a stale precache in front of the dev
    // server hides every edit, and `registerServiceWorker` is a no-op there
    // anyway (it defaults to `import.meta.env.PROD`).
    devOptions: { enabled: false },
  }) as Plugin[];
}
