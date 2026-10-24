/**
 * R111 (D-741 item 1): builds the spike's catalogue from `data-src/stars/`,
 * writes both encodings into `.sdd-cache/spike-stars/` (the page fetches the
 * objects form from there), and prints the counts and the sizes raw and
 * gzipped, which `STARS_BUDGET_KB` is set from.
 *
 *   npx tsx spike/stars/catalog.ts [mag]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { asColumns, asObjects, buildCatalog, type BuildReport } from './catalogData';

export const CACHE = resolve('.sdd-cache/spike-stars');
const SRC = resolve('data-src/stars');

export interface CatalogMeasure extends BuildReport {
  mag: number;
  objects: { raw: number; gzip: number };
  columns: { raw: number; gzip: number };
}

const sizes = (text: string): { raw: number; gzip: number } => ({ raw: Buffer.byteLength(text), gzip: gzipSync(text, { level: 9 }).length });

export function measureCatalog(mag = 4.5): CatalogMeasure {
  const bsc = gunzipSync(readFileSync(resolve(SRC, 'bsc5-catalog.gz'))).toString('latin1');
  const iau = readFileSync(resolve(SRC, 'iau-csn.txt'), 'utf8');
  const lines = readFileSync(resolve(SRC, 'd3-celestial-constellations.lines.json'), 'utf8');
  const { catalog, report } = buildCatalog(bsc, iau, lines, mag);
  const objects = JSON.stringify(asObjects(catalog));
  const columns = JSON.stringify(asColumns(catalog));
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(resolve(CACHE, 'catalog.objects.json'), objects);
  writeFileSync(resolve(CACHE, 'catalog.columns.json'), columns);
  return { ...report, mag, objects: sizes(objects), columns: sizes(columns) };
}

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

export function describe(m: CatalogMeasure): string {
  return [
    `catalogue at V ≤ ${String(m.mag)}: ${String(m.brightStars + m.endpointStars)} stars (${String(m.brightStars)} bright, ${String(m.endpointStars)} fainter figure endpoints) of ${String(m.records)} records`,
    `figures: ${String(m.figures)}, ${String(m.segments)} segments, ${String(m.endpoints)} endpoints, worst snap ${m.worstSnapDeg.toFixed(4)}°`,
    `objects: ${kb(m.objects.raw)} raw, ${kb(m.objects.gzip)} gzipped`,
    `columns: ${kb(m.columns.raw)} raw, ${kb(m.columns.gzip)} gzipped`,
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const mag = process.argv[2] === undefined ? 4.5 : Number(process.argv[2]);
  console.log(describe(measureCatalog(mag)));
}
