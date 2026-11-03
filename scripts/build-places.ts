/**
 * FR-LOC-1 (c) as amended 2026-11-02 (PLAN D-1025): `src/data/places/places.txt`,
 * the towns a device location is named after, offline.
 *
 *   curl -O https://download.geonames.org/export/dump/cities15000.zip
 *   unzip cities15000.zip                      # outside the repo; the dump is not committed
 *   npx tsx scripts/build-places.ts path/to/cities15000.txt 2026-11-02
 *
 * The source is GeoNames' `cities15000` dump (every populated place of 15,000
 * people or more, or a capital), CC BY 4.0 — the same GeoNames the footer
 * credits. The second argument is the dump's date, written into the file's
 * first line so the committed data says where it came from.
 *
 * Kept per town: GeoNames' `name` (its usual name, mostly Latin — "Neuquén",
 * "Munich" — and the same in English and Spanish), the ISO 3166 country code,
 * which the app turns into a country name in the reader's language
 * (`Intl.DisplayNames`), and the position to 0.01° (about a kilometre, finer
 * than any device fix this is used for). City sections (`PPLX`: districts,
 * neighbourhoods) and historical, abandoned or destroyed places are left out:
 * a fix good to a few kilometres should not name a neighbourhood.
 *
 * The format is text, smallest of the ones measured (D-1025): a line `=AR`
 * opens a country, and each line under it is `name<TAB>Δlat<TAB>Δlon`, the
 * position in hundredths of a degree as the difference from the line before
 * (from 0, 0 at the country's first town), towns sorted by latitude inside the
 * country. 31,782 towns, 507 KB, 248 KB gzipped against 334 KB for plain
 * `name, country, lat, lon` rows. `src/data/places/nearestPlace.ts` reads it back.
 *
 * `.txt`, not `.tsv`: it is served as `text/plain`, which the host compresses.
 * The file is committed and never written by `vite build`; Vite emits it as a
 * hashed asset that the lookup fetches from the app's own origin the first
 * time a device location needs a name.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const OUT = fileURLToPath(new URL('../src/data/places/places.txt', import.meta.url));
const SOURCE_URL = 'https://download.geonames.org/export/dump/cities15000.zip';

/** Feature codes left out: sections of a city, and places that are no longer there. */
const SKIP_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

interface Row {
  name: string;
  cc: string;
  lat: number;
  lon: number;
}

const byName = (a: Row, b: Row): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function buildPlaces(dump: string, date: string): string {
  const countries = new Map<string, Row[]>();
  for (const line of dump.split('\n')) {
    if (line === '') continue;
    const f = line.split('\t');
    const name = (f[1] ?? '').replace(/\s+/g, ' ').trim();
    const code = f[7] ?? '';
    const cc = f[8] ?? '';
    const lat = Math.round(Number(f[4]) * 100);
    const lon = Math.round(Number(f[5]) * 100);
    if (name === '' || !/^[A-Z]{2}$/.test(cc) || SKIP_CODES.has(code) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const list = countries.get(cc) ?? [];
    list.push({ name, cc, lat, lon });
    countries.set(cc, list);
  }
  const lines = [`# GeoNames cities15000 (${SOURCE_URL}), ${date}, CC BY 4.0 (https://www.geonames.org/). "=CC" opens a country; then name, Δlat, Δlon in 0.01°.`];
  for (const cc of [...countries.keys()].sort()) {
    lines.push(`=${cc}`);
    let lat = 0;
    let lon = 0;
    for (const row of (countries.get(cc) ?? []).sort((a, b) => a.lat - b.lat || a.lon - b.lon || byName(a, b))) {
      lines.push(`${row.name}\t${String(row.lat - lat)}\t${String(row.lon - lon)}`);
      lat = row.lat;
      lon = row.lon;
    }
  }
  return lines.join('\n') + '\n';
}

function main(): void {
  const [input, date] = process.argv.slice(2);
  if (!input || !date) throw new Error('usage: npx tsx scripts/build-places.ts <cities15000.txt> <YYYY-MM-DD>');
  const text = buildPlaces(readFileSync(input, 'utf8'), date);
  writeFileSync(OUT, text);
  const towns = text.split('\n').filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('=')).length;
  const gz = gzipSync(text, { level: 9 }).length;
  console.log(`${String(towns)} towns, ${(Buffer.byteLength(text) / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gzipped → ${OUT}`);
}

if (process.argv[1]?.endsWith('build-places.ts')) main();
