/**
 * FR-OPEN-1 (PLAN D-1173, D-1184): `src/data/zones/zones.txt`, the city each
 * time zone names, from the vendored tzdata in `scripts/data/tz/` and the towns
 * of `places.txt`. Run by hand (`npm run build:zones`) when either changes;
 * the output is committed, so a build never reads the tz files.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { nearestPlace, parsePlaces, type Places } from '../src/data/places/nearestPlace';

/** A town farther than this from a zone's coordinates does not name it (FR-OPEN-1). */
export const ZONE_NAME_MATCH_KM = 50;

const TZ = (file: string): string => fileURLToPath(new URL(`./data/tz/${file}`, import.meta.url));
const PLACES = fileURLToPath(new URL('../src/data/places/places.txt', import.meta.url));
const OUT = fileURLToPath(new URL('../src/data/zones/zones.txt', import.meta.url));

/** ISO 6709 `±DDMM[SS]±DDDMM[SS]` to hundredths of a degree. */
export function hundredths(iso: string): { lat: number; lon: number } {
  const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(iso);
  if (!m) throw new Error(`zones: bad coordinates "${iso}"`);
  const deg = (sign: string, d: string, mm: string, ss = '0'): number => (sign === '-' ? -1 : 1) * Math.round((Number(d) + Number(mm) / 60 + Number(ss) / 3600) * 100);
  return { lat: deg(m[1] ?? '+', m[2] ?? '', m[3] ?? '', m[4]), lon: deg(m[5] ?? '+', m[6] ?? '', m[7] ?? '', m[8]) };
}

/** A `zone.tab` or `zone1970.tab` body: zone → coordinates, the first listing kept. */
function readTab(text: string, into: Map<string, string>): void {
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const [, coords, zone] = line.split('\t');
    if (!coords || !zone) throw new Error(`zones: bad line "${line}"`);
    if (!into.has(zone)) into.set(zone, coords);
  }
}

/** The display name the lookup falls back to: the zone's last part with `_` as a space. */
export const zoneLastPart = (zone: string): string => (zone.split('/').pop() ?? zone).replace(/_/g, ' ');

const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface TzFiles {
  zoneTab: string;
  zone1970Tab: string;
  backward: string;
  /** The first line of `scripts/data/tz/README.md`, which names the release. */
  release: string;
}

export function buildZones(tz: TzFiles, places: Places): string {
  const coords = new Map<string, string>();
  readTab(tz.zoneTab, coords); // zone.tab first: a merged zone keeps its own city (V216-15).
  readTab(tz.zone1970Tab, coords);
  const lines = [`# ${tz.release} Zone, Δlat, Δlon in 0.01° from the row before[, name]; "=Alias<TAB>Zone".`];
  let lat = 0;
  let lon = 0;
  for (const zone of [...coords.keys()].sort(byCode)) {
    const at = hundredths(coords.get(zone) ?? '');
    const town = nearestPlace(places, at.lat / 100, at.lon / 100, ZONE_NAME_MATCH_KM);
    const name = town && town.name !== zoneLastPart(zone) ? `\t${town.name}` : '';
    lines.push(`${zone}\t${String(at.lat - lat)}\t${String(at.lon - lon)}${name}`);
    lat = at.lat;
    lon = at.lon;
  }
  const aliases: string[] = [];
  for (const line of tz.backward.split('\n')) {
    if (!line.startsWith('Link')) continue;
    const [, target, alias] = line.split('#')[0]?.trim().split(/\s+/) ?? [];
    if (target && alias && !coords.has(alias) && coords.has(target)) aliases.push(`=${alias}\t${target}`);
  }
  return [...lines, ...aliases.sort(byCode)].join('\n') + '\n';
}

function main(): void {
  const text = buildZones(
    {
      zoneTab: readFileSync(TZ('zone.tab'), 'utf8'),
      zone1970Tab: readFileSync(TZ('zone1970.tab'), 'utf8'),
      backward: readFileSync(TZ('backward'), 'utf8'),
      release: readFileSync(TZ('README.md'), 'utf8').split('\n')[0] ?? '',
    },
    parsePlaces(readFileSync(PLACES, 'utf8')),
  );
  writeFileSync(OUT, text);
  const gz = gzipSync(text, { level: 9 }).length;
  console.log(`${String(text.split('\n').length - 2)} rows, ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzipped → ${OUT}`);
}

if (process.argv[1]?.endsWith('build-zones.ts')) main();
