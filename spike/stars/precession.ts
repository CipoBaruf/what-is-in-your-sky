/**
 * R111 (FR-STAR-2, D-741 item 3): the page's position path held against the
 * three fixtures in `tests/fixtures/stars/`. Prints the worst separation per
 * site for the stars and for the planets, against `STAR_TOLERANCE_DEG`.
 *
 *   npx tsx spike/stars/precession.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planetsAt, starsAt } from './sky';

export const STAR_TOLERANCE_DEG = 0.25;
const DIR = resolve('tests/fixtures/stars');
const RAD = Math.PI / 180;

interface Fixture {
  site: string;
  observer: { lat: number; lon: number };
  instant: string;
  stars: { name: string; raJ2000Deg: number; decJ2000Deg: number; altDeg: number; azDeg: number }[];
  planets: { body: string; altDeg: number; azDeg: number }[];
}

export interface SiteResult {
  site: string;
  instant: string;
  starsWorstDeg: number;
  starsWorstName: string;
  planetsWorstDeg: number;
  planetsWorstName: string;
}

/** Great-circle distance between two alt/az points, degrees. */
const separation = (a1: number, z1: number, a2: number, z2: number): number =>
  Math.acos(Math.min(1, Math.sin(a1 * RAD) * Math.sin(a2 * RAD) + Math.cos(a1 * RAD) * Math.cos(a2 * RAD) * Math.cos((z1 - z2) * RAD))) / RAD;

export function measurePrecession(): SiteResult[] {
  return readdirSync(DIR)
    .filter((f) => /Z\.json$/.test(f))
    .sort()
    .map((file) => {
      const fx = JSON.parse(readFileSync(resolve(DIR, file), 'utf8')) as Fixture;
      const at = new Date(fx.instant);
      const stars = starsAt(fx.stars.map((s) => ({ ra: s.raJ2000Deg, dec: s.decJ2000Deg })), fx.observer.lat, fx.observer.lon, at);
      const planets = planetsAt(fx.observer.lat, fx.observer.lon, at);
      const result: SiteResult = { site: fx.site, instant: fx.instant, starsWorstDeg: 0, starsWorstName: '', planetsWorstDeg: 0, planetsWorstName: '' };
      fx.stars.forEach((s, i) => {
        const p = stars[i];
        const d = p ? separation(p.altDeg, p.azDeg, s.altDeg, s.azDeg) : Infinity;
        if (d > result.starsWorstDeg) Object.assign(result, { starsWorstDeg: d, starsWorstName: s.name });
      });
      for (const want of fx.planets) {
        const p = planets.find((q) => q.body === want.body);
        const d = p ? separation(p.altDeg, p.azDeg, want.altDeg, want.azDeg) : Infinity;
        if (d > result.planetsWorstDeg) Object.assign(result, { planetsWorstDeg: d, planetsWorstName: want.body });
      }
      return result;
    });
}

export function describe(results: SiteResult[]): string {
  return results
    .map((r) => `${r.site} ${r.instant}: stars worst ${r.starsWorstDeg.toFixed(4)}° (${r.starsWorstName}), planets worst ${r.planetsWorstDeg.toFixed(4)}° (${r.planetsWorstName}); tolerance ${String(STAR_TOLERANCE_DEG)}°`)
    .join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) console.log(describe(measurePrecession()));
