/**
 * R193 (FR-MEAS-3, D-1151): the module that sends is at most `MEASURE_MAX_KB` gzipped. `src/state/measure.ts` and all it
 * imports are bundled with Vite's own esbuild, minified, and the gzip of that is measured. It cannot see the main chunk's
 * growth as a whole: `npm run bundle:budget`'s main row is that check.
 */
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/** FR-MEAS-3: 1 KB gzipped. */
const MEASURE_MAX_KB = 1;

// esbuild is Vite's dependency, not the project's: it is reached through Vite so no package is added (PLAN §11.9).
interface Esbuild {
  build: (options: Record<string, unknown>) => Promise<{ outputFiles: { contents: Uint8Array }[] }>;
}
const esbuild = createRequire(createRequire(import.meta.url).resolve('vite'))('esbuild') as Esbuild;

describe('the measurement module (FR-MEAS-3, D-1151)', () => {
  it(`is at most ${String(MEASURE_MAX_KB)} KB gzipped, minified with what it imports`, async () => {
    const result = await esbuild.build({ entryPoints: ['src/state/measure.ts'], bundle: true, minify: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', logLevel: 'silent' });
    const code = result.outputFiles[0]?.contents ?? new Uint8Array();
    const gzipped = gzipSync(code, { level: 9 }).byteLength;
    expect(code.byteLength).toBeGreaterThan(0);
    expect(gzipped, `${String(code.byteLength)} B minified, ${String(gzipped)} B gzipped`).toBeLessThanOrEqual(MEASURE_MAX_KB * 1024);
  });
});
