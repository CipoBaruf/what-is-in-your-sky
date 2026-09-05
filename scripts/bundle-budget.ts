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

/**
 * PLAN §11: chart ≤ 100 KB (D-63), worker ≤ 120 KB, gzipped. The main chunk
 * is on its v1 budget of 170 KB from R17 on — the second message catalog,
 * the live page's shell, the offline and share code all land there, and both
 * catalogs ship in it by design (lazy-loading a language would make the
 * switch flash). R17 measured 114.9 KB, 5.7 KB more than R15's 109.2.
 *
 * R25 adds the service worker at ≤ 15 KB: Workbox's runtime and the precache
 * manifest, generated at the site root rather than under `assets/` because a
 * worker's scope is the directory it is served from (D-79). It is a budget of
 * its own precisely because it is not in the main chunk — nothing the page
 * downloads to paint — and an overrun there would otherwise hide in the
 * unbudgeted rows.
 *
 * R22 adds the astronomy chunk at ≤ 30 KB: `lib/skyBodies.ts` and the part of
 * `astronomy-engine` it pulls in, split out of the main chunk by the dynamic
 * import in `useSkyBodies` (D-148). It is budgeted for the same reason as the
 * service worker and unlike the other lazy rows: the app really does fetch it,
 * once a chart is on screen. It measured 22.0 KB in R22.
 *
 * R32 adds the live route at ≤ 40 KB (PLAN §11): `screens/Live.tsx` and the
 * status strip, split out by the `React.lazy` in `App.tsx`, so the home page
 * pays nothing for a page it may never open. The chart, the astronomy and the
 * catalogs it uses are already in their own chunks.
 */
export const BUDGETS: readonly Budget[] = [
  { name: 'main', match: (file, mainFile) => file === mainFile, limitKb: 170 },
  { name: 'chart', match: (file) => /^SkyDome-.*\.js$/.test(file), limitKb: 100 },
  { name: 'worker', match: (file) => /^passes\.worker-.*\.js$/.test(file), limitKb: 120 },
  { name: 'service worker', match: (file) => /^(sw|workbox-.*)\.js$/.test(file), limitKb: 15 },
  { name: 'astronomy', match: (file) => /^skyBodies-.*\.js$/.test(file), limitKb: 30 },
  { name: 'live', match: (file) => /^Live-.*\.js$/.test(file), limitKb: 40 },
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

/** The built scripts: everything under `assets/`, and the service worker at the root (D-79). */
function scripts(distDir: string): { file: string; path: string }[] {
  const assetsDir = join(distDir, 'assets');
  return [
    ...readdirSync(assetsDir).map((file) => ({ file, path: join(assetsDir, file) })),
    ...readdirSync(distDir)
      .filter((file) => /^(sw|workbox-.*)\.js$/.test(file))
      .map((file) => ({ file, path: join(distDir, file) })),
  ].filter(({ file }) => file.endsWith('.js'));
}

export function measure(distDir = DIST): ChunkSize[] {
  const mainFile = mainChunkFile(readFileSync(join(distDir, 'index.html'), 'utf8'));
  return scripts(distDir)
    .map(({ file, path }) => {
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
