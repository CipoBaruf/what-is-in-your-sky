/**
 * PLAN §11 bundle budgets (R15): gzipped sizes of the built chunks against
 * the three budgets, printed as a table after `vite build`. Never fails the
 * build (a warning, per PLAN §11): an overrun is a `::warning::` annotation
 * in CI and an exit code of 0, and the PR records an accepted overrun.
 *
 *   npm run build && npm run bundle:budget
 *
 * Chunks are classified by what the app loads: the main chunk is the script
 * `index.html` references, the worker chunk is `passes.worker-*.js`, the
 * chart chunk is the `React.lazy` split of `SkyDome` (`@glyphcss/react`,
 * `@glyphcss/core` and `dome/`). Everything else is listed but unbudgeted:
 * satellite.js's WASM entry (D-18) and glyphcss's loaders and font atlases
 * (D-63) are emitted as lazy chunks the app never fetches.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';

export interface Budget {
  name: string;
  match: (file: string, mainFile: string | null) => boolean;
  limitKb: number;
}

/** PLAN §11: main ≤ 150 KB, chart ≤ 100 KB (D-63), worker ≤ 120 KB, gzipped. */
export const BUDGETS: readonly Budget[] = [
  { name: 'main', match: (file, mainFile) => file === mainFile, limitKb: 150 },
  { name: 'chart', match: (file) => /^SkyDome-.*\.js$/.test(file), limitKb: 100 },
  { name: 'worker', match: (file) => /^passes\.worker-.*\.js$/.test(file), limitKb: 120 },
];

export interface ChunkSize {
  file: string;
  budget: string | null;
  rawKb: number;
  gzipKb: number;
  limitKb: number | null;
  over: boolean;
}

const kb = (bytes: number): number => Math.round((bytes / 1024) * 10) / 10;

/** The script `index.html` loads: the main chunk. */
export function mainChunkFile(html: string): string | null {
  const match = /<script[^>]+src="\/?assets\/([^"]+\.js)"/.exec(html);
  return match?.[1] ?? null;
}

export function measure(distDir = DIST): ChunkSize[] {
  const mainFile = mainChunkFile(readFileSync(join(distDir, 'index.html'), 'utf8'));
  const assetsDir = join(distDir, 'assets');
  return readdirSync(assetsDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const path = join(assetsDir, file);
      const budget = BUDGETS.find((candidate) => candidate.match(file, mainFile)) ?? null;
      const gzipKb = kb(gzipSync(readFileSync(path), { level: 9 }).length);
      return { file, budget: budget?.name ?? null, rawKb: kb(statSync(path).size), gzipKb, limitKb: budget?.limitKb ?? null, over: budget !== null && gzipKb > budget.limitKb };
    })
    .sort((a, b) => (a.budget === null ? 1 : 0) - (b.budget === null ? 1 : 0) || b.gzipKb - a.gzipKb);
}

function main(): void {
  const sizes = measure();
  const missing = BUDGETS.filter((budget) => !sizes.some((size) => size.budget === budget.name));
  console.log('Bundle budgets (PLAN §11), gzipped:');
  console.table(sizes.map(({ file, budget, rawKb, gzipKb, limitKb, over }) => ({ chunk: budget ?? '(lazy, unbudgeted)', file, 'raw KB': rawKb, 'gzip KB': gzipKb, 'budget KB': limitKb ?? '', status: over ? 'OVER' : limitKb === null ? '' : 'ok' })));
  for (const size of sizes.filter((s) => s.over)) console.log(`::warning::${size.budget} chunk ${size.file} is ${String(size.gzipKb)} KB gzipped, over the ${String(size.limitKb)} KB budget (PLAN §11)`);
  for (const budget of missing) console.log(`::warning::no chunk matched the ${budget.name} budget; check scripts/bundle-budget.ts against the build output`);
}

if (process.argv[1]?.endsWith('bundle-budget.ts')) main();
