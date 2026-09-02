import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// PLAN §11: Vite + plugin-react, ES2022 output. The pass worker
// (`src/worker/passes.worker.ts`) is bundled from its URL in `state/workerClient.ts`;
// code-splitting and bundle budgets arrive with R15. Worker chunks are ES modules
// (D-18): satellite.js 7 ships an optional WASM/pthreads build whose worker entry
// uses top-level await, which the default IIFE worker format rejects (the build is
// never loaded; we do not call `createWasmModule`).
export default defineConfig({
  plugins: [react(), pagesHeaders()],
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
