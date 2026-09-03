import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';
import { parsePagesHeaders } from '../vite.config';

// R14 spike item 6: build the bundle probe (spike/bundle) into the scratchpad
// with the visualizer's gzip figures, and preview it under public/_headers.
const OUT = process.env['SPIKE_OUT'] ?? '/private/tmp/claude-501/-Volumes-Data-Projects-what-is-in-your-sky-right-now/04132777-8ed2-41aa-891b-6cb263b625ad/scratchpad/dist-spike';
const ROOT = resolve(import.meta.dirname, '..');

export default defineConfig({
  root: resolve(import.meta.dirname, 'bundle'),
  publicDir: resolve(ROOT, 'public'),
  plugins: [react(), visualizer({ gzipSize: true, brotliSize: true, template: 'raw-data', filename: resolve(OUT, 'stats.json') }) as unknown as Plugin, headers()],
  build: { target: 'es2022', outDir: OUT, emptyOutDir: true },
  preview: { port: 5198, strictPort: true },
});

function headers(): Plugin {
  return {
    name: 'wiys:spike-headers',
    configurePreviewServer(server) {
      const rules = parsePagesHeaders(readFileSync(resolve(ROOT, 'public', '_headers'), 'utf8'));
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
