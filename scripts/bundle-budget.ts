/**
 * PLAN §11 bundle budgets (R15): gzipped sizes of the built chunks against
 * their budgets, printed as a table after `vite build`. Never fails the
 * build (a warning, per PLAN §11): an overrun is a `::warning::` annotation
 * in CI and an exit code of 0, and the PR records an accepted overrun.
 *
 *   npm run build && npm run bundle:budget
 *
 * Chunks are classified by what the app loads; `BUDGETS` below says which
 * file each budget matches and where its number comes from.
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
 * The v1 budgets, re-set by R36 from the real 1.0.0 build (D-178). Until then
 * each chunk carried the ceiling PLAN §11 reserved for it while the phase was
 * still being written — main 170 KB, chart 100, worker 120, astronomy 30,
 * live 40, service worker 15 — which is the right number to plan against and
 * a useless number to regress against: the worker sat at 36 KB under a 120 KB
 * budget, so tripling it would still have passed.
 *
 * Every budget below is `measured × 1.1`, rounded up to the next 5 KB and
 * floored at 10 KB, and none of them exceeds its PLAN §11 v1 ceiling. That
 * leaves about a tenth of each chunk as headroom — enough that a legitimate
 * feature lands without ceremony, tight enough that a stray dependency shows
 * up as a `::warning::` in the build log on the PR that added it. Re-measure
 * and re-set them the same way whenever the ceiling is raised.
 *
 * Measured on the R36 build (gzip level 9, the numbers in the release PR):
 *
 * | chunk          | file                | measured | budget | ceiling |
 * |----------------|---------------------|---------:|-------:|--------:|
 * | main           | `index-*.js`        |    134.7 |    150 |     170 |
 * | chart          | `SkyDome-*.js`      |     97.1 |    110 |     110 |
 * | worker         | `passes.worker-*`   |     36.1 |     40 |     130 |
 * | astronomy      | `skyBodies-*.js`    |     22.1 |     25 |      30 |
 * | live           | `Live-*.js`         |     12.6 |     15 |      40 |
 * | service worker | `workbox-*.js`      |      5.0 |     10 |      15 |
 *
 * Added on the R47 build (the live row there reads 6.3, see below):
 *
 * | window         | `SkyWindow-*.js`     |      5.3 |     10 |       — |
 * | declination    | `useDeclination-*.js`|      6.1 |     10 |       — |
 *
 * R53 re-set them the same way on the 1.1.0 build (SPEC §9 Phase 2b: "the
 * bundle budgets re-set by the D-178 rule"). A phase that added the settings
 * page, the legend, the sky window and the live trajectories cost the main
 * chunk 0.6 KB and the chart chunk nothing; only one budget moves, and it moves
 * *down*:
 *
 * | chunk          | file                 | measured | budget | was | ceiling |
 * |----------------|----------------------|---------:|-------:|----:|--------:|
 * | main           | `index-*.js`         |    135.3 |    150 | 150 |     170 |
 * | chart          | `SkyDome-*.js`       |     97.1 |    110 | 110 |     110 |
 * | worker         | `passes.worker-*`    |     36.1 |     40 |  40 |     130 |
 * | astronomy      | `skyBodies-*.js`     |     22.1 |     25 |  25 |      30 |
 * | live           | `Live-*.js`          |      7.6 |     10 |  15 |      40 |
 * | declination    | `useDeclination-*.js`|      6.1 |     10 |  10 |       — |
 * | window         | `SkyWindow-*.js`     |      5.3 |     10 |  10 |       — |
 * | service worker | `workbox-*.js`       |      5.0 |     10 |  10 |      15 |
 *
 * The live chunk is the one that moves. R44 raised it to 15 for the World
 * Magnetic Model and R47 then split the model out into its own chunk, which
 * left `Live-*.js` at 6.3 KB under a budget more than twice its size — R47 kept
 * the 15 on the ground that the next addition was the number to watch, and v1.1
 * has now made those additions (the trajectories, the stripe's three rows, the
 * stepping control, the wide fold) for 1.3 KB. A release re-set is where that
 * headroom is handed back: at the 10 KB floor the chunk has the same tenth of
 * room every other row has, and the next six kilobytes are a `::warning::`
 * instead of silence.
 *
 * What each one holds, and why it is a budget of its own rather than a row in
 * the main chunk:
 *
 * - **main** — the app shell plus both message catalogs, by design: one
 *   language is a few kilobytes of strings and lazy-loading a language would
 *   make the switch flash. R15 measured 109.2 KB, R17 114.9 after the second
 *   catalog; the offline, share and live-route entry code took it to 134.7.
 * - **chart** — `@glyphcss/react`, `@glyphcss/core` and `dome/`, behind the
 *   `React.lazy` in `SkyChart.tsx`. The 60 KB planned before the R14 spike is
 *   not reachable from outside the library (D-63), which is why its ceiling
 *   and its budget are the same number.
 * - **worker** — satellite.js and the propagation code, loaded once.
 * - **astronomy** — `lib/skyBodies.ts` and the part of `astronomy-engine` it
 *   reaches, split out of main by the dynamic import in `useSkyBodies`
 *   (D-148). Budgeted rather than left unbudgeted because the app really does
 *   fetch it, once a chart is on screen.
 * - **live** — `screens/Live.tsx` and the status strip, split out by the
 *   `React.lazy` in `App.tsx`, so the home page pays nothing for a page it may
 *   never open. R44 doubled it: `geomagnetism` and the four WMM coefficient
 *   files are 6.3 KB gzipped of the 12.6 (D-185 measured 6.2 with esbuild), and
 *   they land here rather than in main because `lib/declination.ts` is reached
 *   only from the live page. R47 then split that model into the declination
 *   chunk below and left the budget at 15; R53 re-measured 7.6 on the 1.1.0
 *   build with v1.1's live page in it and put the budget back on the 10 KB
 *   floor, well under the §11 ceiling of 40.
 * - **window** — `window/SkyWindow.tsx`, its projection and its orientation
 *   hook, behind the second `React.lazy` in `SkyChart.tsx` (R47, D-188): SVG
 *   and arithmetic, no library, so 5.3 KB gzipped on the R47 build and the
 *   10 KB floor as its budget. The chart chunk did not move: the window shares
 *   nothing with glyphcss.
 * - **declination** — `live/useDeclination.ts`, `lib/declination.ts` and the
 *   World Magnetic Model behind them. R44 put them in the live chunk; the
 *   window reaches them too (FR-WIN-3), so Vite splits them into a chunk both
 *   pages share and the live chunk falls back to 6.3 KB. 6.1 KB measured on the
 *   R47 build and again on 1.1.0, the 10 KB floor as its budget: the model is
 *   the whole chunk, so what would move this number is a new coefficient set.
 * - **service worker** — Workbox's runtime and the precache manifest, emitted
 *   at the site root rather than under `assets/` because a worker's scope is
 *   the directory it is served from (D-79). Nothing the page downloads to
 *   paint, so an overrun there would otherwise hide in the unbudgeted rows.
 *
 * Everything else is listed but unbudgeted: satellite.js's WASM entry (D-18)
 * and glyphcss's loaders and font atlases (D-63) are emitted as lazy chunks
 * the app never fetches.
 */
export const BUDGETS: readonly Budget[] = [
  { name: 'main', match: (file, mainFile) => file === mainFile, limitKb: 150 },
  { name: 'chart', match: (file) => /^SkyDome-.*\.js$/.test(file), limitKb: 110 },
  { name: 'worker', match: (file) => /^passes\.worker-.*\.js$/.test(file), limitKb: 40 },
  { name: 'service worker', match: (file) => /^(sw|workbox-.*)\.js$/.test(file), limitKb: 10 },
  { name: 'astronomy', match: (file) => /^skyBodies-.*\.js$/.test(file), limitKb: 25 },
  { name: 'live', match: (file) => /^Live-.*\.js$/.test(file), limitKb: 10 }, // R53: back to the floor — R47 moved the World Magnetic Model to its own chunk and 1.1.0 measures 7.6 (D-178)
  { name: 'window', match: (file) => /^SkyWindow-.*\.js$/.test(file), limitKb: 10 }, // R47: 5.3 measured, floored at 10 (D-178)
  { name: 'declination', match: (file) => /^useDeclination-.*\.js$/.test(file), limitKb: 10 }, // R47: split out of live once the window reached it too
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
