/**
 * R111 (FR-STAR-6, D-741 item 4): the ladder and the collision distance, judged
 * on two shapes — Crux over Neuquén and Orion over Paris — at 390 × 844 and
 * 1280 × 800, for FR-STAR-6's ladder (15/12 px, half a cell), two smaller and
 * two larger pairs, two collision distances either side of it, the glyphs
 * shifted onto their ink centres (with `·` for the faint steps), and the same
 * field drawn as discs. Into `docs/stars/captures/`.
 *
 *   npx tsx spike/stars/capture.ts
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Catalog } from './catalogData';
import { CACHE, measureCatalog } from './catalog';
import { STARS_DEFAULTS, starsQuery, type StarsParams } from './params';
import { SITES, starsAt, type SiteName } from './sky';
import { load, startServer, withBrowser } from './serve';

const OUT = resolve('docs/stars/captures');

/** Each shape at an instant it stands high: Crux at local midnight in April, Orion at local midnight in December. */
const SCENES: { name: string; site: SiteName; at: string; aim: number[] }[] = [
  { name: 'crux-neuquen', site: 'neuquen', at: '2027-04-15T03:00:00Z', aim: [4730, 4763, 4853, 4656] },
  { name: 'orion-paris', site: 'paris', at: '2026-12-15T23:00:00Z', aim: [1903] },
];

export const LADDERS: { name: string; big: number; small: number; collide: number; mark?: 'disc'; dot?: 'middle'; inkfix?: boolean }[] = [
  { name: '13-10', big: 13, small: 10, collide: 0.5 },
  { name: '14-11', big: 14, small: 11, collide: 0.5 },
  { name: '15-12', big: 15, small: 12, collide: 0.5 },
  { name: '16-13', big: 16, small: 13, collide: 0.5 },
  { name: '18-15', big: 18, small: 15, collide: 0.5 },
  { name: '15-12-collide-0.25', big: 15, small: 12, collide: 0.25 },
  { name: '15-12-collide-1', big: 15, small: 12, collide: 1 },
  { name: '15-12-inkfix', big: 15, small: 12, collide: 0.5, inkfix: true },
  { name: '15-12-middle-inkfix', big: 15, small: 12, collide: 0.5, dot: 'middle', inkfix: true },
  { name: 'disc', big: 15, small: 12, collide: 0.5, mark: 'disc' },
];

const SIZES = [
  { width: 390, height: 844, deviceScaleFactor: 2 },
  { width: 1280, height: 800, deviceScaleFactor: 1 },
] as const;

/** The camera aimed at the mean direction of the named stars (HR numbers). */
function aim(catalog: Catalog, scene: (typeof SCENES)[number]): { facing: number; tilt: number } {
  const stars = scene.aim.map((hr) => catalog.stars.find((s) => s.hr === hr)).filter((s) => s !== undefined);
  const site = SITES[scene.site];
  const at = starsAt(stars, site.lat, site.lon, new Date(scene.at));
  const x = at.reduce((n, p) => n + Math.sin((p.azDeg * Math.PI) / 180), 0);
  const y = at.reduce((n, p) => n + Math.cos((p.azDeg * Math.PI) / 180), 0);
  const tilt = at.reduce((n, p) => n + p.altDeg, 0) / at.length;
  return { facing: Math.round((((Math.atan2(x, y) * 180) / Math.PI + 360) % 360) * 10) / 10, tilt: Math.round(tilt * 10) / 10 };
}

export async function capture(): Promise<string[]> {
  measureCatalog();
  const catalog = JSON.parse(readFileSync(resolve(CACHE, 'catalog.objects.json'), 'utf8')) as Catalog;
  mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const written: string[] = [];
  try {
    await withBrowser(async (open) => {
      for (const size of SIZES) {
        const page = await open({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.deviceScaleFactor });
        for (const scene of SCENES) {
          const camera = aim(catalog, scene);
          for (const ladder of LADDERS) {
            const params: StarsParams = { ...STARS_DEFAULTS, site: scene.site, ...SITES[scene.site], at: scene.at, ...camera, big: ladder.big, small: ladder.small, collide: ladder.collide, mark: ladder.mark ?? 'glyph', dot: ladder.dot ?? 'period', inkfix: ladder.inkfix ?? false };
            await load(page, starsQuery(params));
            const name = `${scene.name}-${ladder.name}-${String(size.width)}.png`;
            await page.screenshot({ path: resolve(OUT, name) });
            written.push(name);
          }
        }
        await page.context().close();
      }
    });
  } finally {
    await server.close();
  }
  return written;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const names = await capture();
  console.log(`${String(names.length)} captures in docs/stars/captures/`);
}
