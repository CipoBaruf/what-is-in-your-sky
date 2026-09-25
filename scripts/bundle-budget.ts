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
 * R60 re-set them the same way on the 1.2.0 build (SPEC §9 Phase 2c, D-307),
 * built with `VITE_MOON_LORE=on` as CI's bundle stage does (R42), since that
 * is the build the script's budget is actually enforced against — a plain
 * flag-off `npm run build` is a few tenths of a KB smaller in `main` and is
 * what `tests/build/flags.test.ts` and the capture set measure instead (D-183).
 * Two chunks move, one each way: `SkyDome-*.js` moves *down* — R57's fit rule
 * (D-279) trims the raster back to a size the grid can hold rather than
 * running it coarser, and R61's centring (D-317) samples the silhouette
 * instead of the ring, so the chart chunk shed 2.9 KB it had carried since
 * R53 (97.1 → 94.2) — and `index-*.js` moves *up* one rounding step: `main`
 * measures 136.6 against the 1.1.0 build's 135.3, and ×1.1 (150.3) crosses
 * the next 5 KB line the 1.1.0 figure (148.8) had not reached:
 *
 * | chunk          | file                  | measured | budget | was | ceiling |
 * |----------------|-----------------------|---------:|-------:|----:|--------:|
 * | main           | `index-*.js`          |    136.6 |    155 | 150 |     170 |
 * | chart          | `SkyDome-*.js`        |     94.2 |    105 | 110 |     110 |
 * | worker         | `passes.worker-*`     |     36.1 |     40 |  40 |     130 |
 * | astronomy      | `skyBodies-*.js`      |     22.1 |     25 |  25 |      30 |
 * | live           | `Live-*.js`           |      8.0 |     10 |  10 |      40 |
 * | declination    | `useDeclination-*.js` |      6.1 |     10 |  10 |       — |
 * | window         | `SkyWindow-*.js`      |      5.9 |     10 |  10 |       — |
 * | service worker | `workbox-*.js`        |      5.0 |     10 |  10 |      15 |
 *
 * `live` and `window` measure a little higher than the 1.1.0 build (R59's
 * follow control and R56's ground state on one, nothing on the other's own
 * code) but neither crosses a 5 KB line, so both budgets hold at the floor.
 *
 * R65 re-sets them again on the 1.3.0 build (SPEC §9 Phase 2d, D-345, D-346),
 * built the same way. One row moves and one row goes. `SkyWindow-*.js`
 * measures 12.0 KB against a budget of 10, because v1.3.1 took the last
 * caller of `useDeclination` off the live page (D-341) and left the window as
 * its only one, so Vite folds the World Magnetic Model back into the window
 * chunk: 5.9 + 6.1 is the 12.0, and neither number grew. ×1.1 is 13.2, so the
 * budget follows to 15 and the declination row is deleted rather than left
 * matching nothing — an unmatched budget prints a `::warning::` of its own,
 * which would have been a permanent one:
 *
 * | chunk          | file                  | measured | budget | was | ceiling |
 * |----------------|-----------------------|---------:|-------:|----:|--------:|
 * | main           | `index-*.js`          |    137.9 |    155 | 155 |     170 |
 * | chart          | `SkyDome-*.js`        |     94.2 |    105 | 105 |     110 |
 * | worker         | `passes.worker-*`     |     36.1 |     40 |  40 |     130 |
 * | astronomy      | `skyBodies-*.js`      |     22.1 |     25 |  25 |      30 |
 * | window         | `SkyWindow-*.js`      |     12.0 |     15 |  10 |       — |
 * | live           | `Live-*.js`           |      7.4 |     10 |  10 |      40 |
 * | service worker | `workbox-*.js`        |      5.0 |     10 |  10 |      15 |
 *
 * `main` measures 1.3 KB above the 1.2.0 build (137.9 against 136.6) — the
 * sky screen's copy and the view control's third option — and ×1.1 (151.7)
 * stays inside the 155 the phase before it crossed. `live` falls 0.6 KB with
 * the follow control deleted (D-350). Every other chunk measures what it did.
 *
 * R72 re-sets them again on the 1.4.0 build (SPEC §9 Phase 2f), built the same
 * way. This is the first release re-set where **no budget moves**: v1.4 spent
 * its weight on the three chunks the phase touched, and none of the three
 * crosses a 5 KB line.
 *
 * | chunk          | file                  | measured | budget | was | ceiling |
 * |----------------|-----------------------|---------:|-------:|----:|--------:|
 * | main           | `index-*.js`          |    138.4 |    155 | 155 |     170 |
 * | chart          | `SkyDome-*.js`        |     94.2 |    105 | 105 |     110 |
 * | worker         | `passes.worker-*`     |     36.1 |     40 |  40 |     130 |
 * | astronomy      | `skyBodies-*.js`      |     22.1 |     25 |  25 |      30 |
 * | window         | `SkyWindow-*.js`      |     12.1 |     15 |  15 |       — |
 * | live           | `Live-*.js`           |      8.5 |     10 |  10 |      40 |
 * | service worker | `workbox-*.js`        |      5.0 |     10 |  10 |      15 |
 *
 * The three the task names, and what each of them bought:
 *
 * - **live** is the phase's growth, and the only chunk that grew by more than a
 *   rounding step: 8.5 KB against the 1.3.0 build's 7.4. Everything v1.4 added
 *   to the page is in it — the stripe's chunk arithmetic, the 24 h overview row
 *   and the re-cut stepping row (FR-SPAN-1..7), and the `[ list (n) ]` control
 *   with its two-row panel (FR-LEG-7). ×1.1 is 9.35, so it holds the 10 KB
 *   floor with 1.5 KB of room where it had 2.6, and it is the row to watch in
 *   the next phase: another 1.1 growth like this one and the floor is where the
 *   `::warning::` comes from.
 * - **window** measures 12.1 against 12.0. v1.4 added nothing to it: R68's two
 *   fixes (F-57, F-58) take work out of the render rather than code out of the
 *   chunk, and a tenth of a kilobyte is what that costs. The World Magnetic
 *   Model is still 6.1 of the 12.1 and still the thing that would move the row.
 * - **chart** measures 94.2, unchanged for the third phase running. The
 *   legend's move out from under the box (FR-LEG-6) and the shape rules
 *   (FR-SHP-1..4) are CSS and live-page code; nothing crossed the
 *   `React.lazy` in `SkyChart.tsx`. Its budget stays 5 KB under the ceiling
 *   D-63 says the library fixes.
 *
 * `main` is up 0.5 KB (138.4 against 137.9) for the phase's strings — the list
 * control, the empty-list line, the chunk arrows and the overview's labels, in
 * both catalogs — and ×1.1 (152.2) stays inside 155. `worker`, `astronomy` and
 * the service worker measure what they did in v1.2.
 *
 * R80 re-measures them on the 2.0.0 build (SPEC §9 Phase 2g), built the same
 * way. **No budget moves, and one of them is over.**
 *
 * | chunk          | file                  | measured | budget | was | ceiling |
 * |----------------|-----------------------|---------:|-------:|----:|--------:|
 * | main           | `index-*.js`          |  **158.0** |  155 | 155 |     170 |
 * | chart          | `SkyDome-*.js`        |     94.2 |    105 | 105 |     110 |
 * | worker         | `passes.worker-*`     |     36.1 |     40 |  40 |     130 |
 * | astronomy      | `skyBodies-*.js`      |     22.1 |     25 |  25 |      30 |
 * | window         | `SkyWindow-*.js`      |     12.8 |     15 |  15 |       — |
 * | live           | `Live-*.js`           |      8.3 |     10 |  10 |      40 |
 * | service worker | `workbox-*.js`        |      5.0 |     10 |  10 |      15 |
 *
 * Six of the seven rows are the D-178 rule agreeing with the number that is
 * already there: 94.2 × 1.1 is 103.6 under 105, 36.1 × 1.1 is 39.7 under 40,
 * 22.1 × 1.1 is 24.3 under 25, 12.8 × 1.1 is 14.1 under 15, and `live` and the
 * service worker are both under the 10 KB floor. `window` is up 0.7 KB for the
 * compass gutter (FR-GUT-1..8), which replaced the legend strip inside the same
 * chunk; `live` is down 0.2 for the two states being the same components
 * rendered conditionally (FR-WATCH-4); `chart` is 94.2 for the fourth phase
 * running, because nothing of the redesign crossed the `React.lazy` in
 * `SkyChart.tsx`.
 *
 * `main` is the exception and it is a finding, not a budget. 158.0 KB against
 * a budget of 155, so every build of `main` now prints the `::warning::` this
 * script exists to print. The D-178 rule would make it 175 and the §11 ceiling
 * would cap that at 170 — and PLAN §11 forbids exactly that move: *"a mark that
 * does not fit inside main's 155 KB is a finding for the owner, not a budget
 * raised by the task that spent it"* (FR-MARK-6, which asks the release task to
 * measure it). So the number stays at 155, the overrun stays visible, and
 * SPEC §4.20 F-69 carries the measurement.
 *
 * What the mark costs, measured rather than estimated (FR-MARK-6): the same
 * build with `Mark.tsx` replaced by a stub that renders an empty box and
 * imports neither `rasters.json` nor `useBead` nor `denseFrame` measures
 * **152.8 KB** in `main` (488.6 raw) against 158.0 (506.6 raw). So the
 * component, the six body rasters and the 60 sparse bead frames per tier are
 * **5.2 KB gzipped, 18.0 KB raw** — about what D-438 predicted ("a few
 * kilobytes"), and 3.0 KB more than the budget had left for them. Without the
 * mark the chunk would be inside 155 with 2.2 KB to spare; with it, the phase
 * is 3.0 KB over. Neither half of that sentence is the whole cause: `main` is
 * 17.9 KB above the 1.4.0 build's 140.1, and the mark is 5.2 of the 17.9. The
 * rest is the redesign's own weight in the shell — board 1B's home screen (the
 * stripe module, the conditions table, the next-event block, the one-line
 * cards, the Where reading and the phone's three steps), the inverted settings
 * page, and the phase's copy in both catalogs, whose **source** grew 21.9 KB
 * raw and 8.0 KB gzipped between the 1.4.0 release commit and this one. That
 * last figure is source, not bundle — the comments in it do not survive the
 * build — but it is the same order as the mark and larger than anything else
 * the phase added, which is the part worth knowing before anyone decides the
 * mark is the row to cut.
 *
 * R93 (D-545, F-69) splits the settings page out of main behind a `React.lazy`
 * (`screens/SettingsRoute.tsx`, `screens/settingsChunk.ts`), which is the
 * choice F-69 offered the owner, and measures it on the same flag-on build:
 *
 * | chunk          | file                  | before | after  | budget | ceiling |
 * |----------------|-----------------------|-------:|-------:|-------:|--------:|
 * | main           | `index-*.js`          |  166.2 |  166.0 |    155 |     170 |
 * | settings       | `Settings-*.js`       |      — |    1.0 |     10 |       — |
 *
 * Two things the measurement says. The settings chunk is **1.0 KB gzipped**
 * (2.3 raw): the page is a composition of the home page's own controls — the
 * place field, the device button, the saved places, the language and theme
 * switches, the install action — and every one of them stays in main because
 * the home page renders it too. What the chunk holds is the page's order and
 * its privacy line, and `main` gives up 0.2 KB for it. And `main` is not the
 * 158.0 F-69 measured on 2.0.0: it is **166.2** on this branch before the
 * split, up 8.2 KB across v2.1's shell work (R83–R92, R101: the failure lines,
 * the root boundary, the route shell and its announcer, the visit notices, the
 * jump control, and both catalogs' copy for them). So the split is made as
 * D-545 asks and its budget is the 10 KB floor, but main does not return under
 * 155 by it and the `::warning::` stays — an 11 KB overrun that no one route
 * behind a link can pay. What could is the owner's call again (F-69's other
 * two rows, or a boundary around the guide or the cold open), so the number
 * stays where PLAN §11 puts it and the summary of R93 carries the
 * measurement; the settings row is kept so a page that grows shows up here.
 *
 * R100 re-measures them on the 2.1.0 build (SPEC §9 Phase 2h, D-638), built
 * the same way. **One budget moves, and main is still over.**
 *
 * | chunk          | file                  | measured | budget | was | ceiling |
 * |----------------|-----------------------|---------:|-------:|----:|--------:|
 * | main           | `index-*.js`          |    166.6 | **170** | 155 |     170 |
 * | chart          | `SkyDome-*.js`        |     94.2 |    105 | 105 |     110 |
 * | worker         | `passes.worker-*`     |     36.1 |     40 |  40 |     130 |
 * | astronomy      | `skyBodies-*.js`      |     22.1 |     25 |  25 |      30 |
 * | window         | `SkyWindow-*.js`      |     12.8 |     15 |  15 |       — |
 * | live           | `Live-*.js`           |      9.7 | **15** |  10 |      40 |
 * | service worker | `workbox-*.js`        |      5.0 |     10 |  10 |      15 |
 * | settings       | `Settings-*.js`       |      1.0 |     10 |  10 |       — |
 *
 * `live` is the row v1.4 said to watch, and it has crossed: 9.7 × 1.1 is 10.7,
 * so the rule puts it on the next 5 KB line. What v2.1 added inside it is the
 * live page's three states and their notices (FR-LIVE-1, FR-FAIL-6), the page's
 * own landmarks (D-596), the Spanish rows (FR-COMP-7), the watching inventory's
 * clip (F-81) and `[ see this pass ]` (FR-JUMP-1): 1.4 KB over 2.0.0's 8.3.
 * Every other row is the rule agreeing with the number already there, and
 * `chart` is 94.2 for the fifth phase running. `main` is 166.6 against 155 —
 * 8.6 KB above 2.0.0's 158.0, 0.6 above R93's 166.0 (the faint control and
 * its strings, R97) — so F-69 stays open and the number stays where PLAN §11
 * and V21-13 put it: the rule would make it 185 and the ceiling 170, and
 * neither is a release task's to take.
 *
 * **The owner raised it (V21-24, D-641, 2026-09-25).** Asked at the release
 * gate, the owner moved `main` to 170: D-178's rule (166.6 × 1.1, the next
 * 5 KB line, 185) capped at the §11 ceiling. That leaves 3.4 KB, so the next
 * phase that adds to `main` meets the ceiling, not the budget, and F-69's
 * remedy (zod or the guide out of `main`, D-609) is still the way down. The
 * ceiling itself is not moved.
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
 *   only from the live page. R47 then split that model into a declination
 *   chunk the live page and the window shared, and left the budget at 15; R53
 *   re-measured 7.6 on the 1.1.0 build with v1.1's live page in it and put the
 *   budget back on the 10 KB floor, well under the §11 ceiling of 40. R66 took
 *   the live page's last call to it away (D-341), so the shared chunk is gone
 *   and the model is the window's alone; 8.5 KB on the 1.4.0 build, v1.4's
 *   stripe chunk and list control included.
 * - **window** — `window/SkyWindow.tsx`, its projection and its orientation
 *   hook, behind the second `React.lazy` in `SkyChart.tsx` (R47, D-188): SVG
 *   and arithmetic, no library, so 5.3 KB gzipped on the R47 build and the
 *   10 KB floor as its budget. The chart chunk did not move: the window shares
 *   nothing with glyphcss. Since v1.3.1 it also carries `useDeclination`,
 *   `lib/declination.ts` and the World Magnetic Model — R44 put them in the
 *   live chunk, R47 split them out into a chunk the live page and the window
 *   shared (FR-WIN-3), and R66 left the window as the only caller, so Vite
 *   folds them back in here. 12.1 KB on the 1.4.0 build against a budget of
 *   15, and what would move the model's 6.1 of that is a new coefficient set.
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
  { name: 'main', match: (file, mainFile) => file === mainFile, limitKb: 170 }, // R60: 136.6 measured (flag on), crossing the 150 line (D-307); R80: 158.0 on 2.0.0 — over, and deliberately not raised (D-495, F-69); R100: 166.6 on 2.1.0, still not raised (V21-13, D-638); raised to 170 by the owner at the release gate (V21-24, D-641)
  { name: 'chart', match: (file) => /^SkyDome-.*\.js$/.test(file), limitKb: 105 }, // R60: 94.2 measured, down from 97.1 (D-307); 94.2 again on 1.4.0 (R72)
  { name: 'worker', match: (file) => /^passes\.worker-.*\.js$/.test(file), limitKb: 40 },
  { name: 'service worker', match: (file) => /^(sw|workbox-.*)\.js$/.test(file), limitKb: 10 },
  { name: 'astronomy', match: (file) => /^skyBodies-.*\.js$/.test(file), limitKb: 25 },
  { name: 'live', match: (file) => /^Live-.*\.js$/.test(file), limitKb: 15 }, // R53: back to the floor — R47 moved the World Magnetic Model to its own chunk and 1.1.0 measures 7.6 (D-178); R72: 8.5 on 1.4.0, the floor's last 1.5 KB; R100: 9.7 on 2.1.0, × 1.1 crosses 10 (D-638)
  { name: 'window', match: (file) => /^SkyWindow-.*\.js$/.test(file), limitKb: 15 }, // R65: 12.0 measured — the WMM folded back in when the window became its only caller (D-345); R72: 12.1 on 1.4.0; R80: 12.8 with the compass gutter in it
  { name: 'settings', match: (file) => /^Settings-.*\.js$/.test(file), limitKb: 10 }, // R93 (D-545): 1.0 measured — the page's own composition; its controls are the home page's and stay in main
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
