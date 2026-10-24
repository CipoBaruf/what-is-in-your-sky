/**
 * FR-STAR-1 (R112, D-748): `src/data/stars/catalog.json`, the stars as data.
 *
 *   npm run build:stars
 *
 * Reads the three sources vendored under `data-src/stars/` (D-743) and writes
 * every Yale Bright Star Catalogue star at V ≤ `STAR_MAG_LIMIT`, every fainter
 * star a figure ends on so no figure is cut, and d3-celestial's 89 drawn
 * features as segments between those stars, every endpoint snapped to the
 * nearest catalogue star (the spike's rule, `spike/stars/catalogData.ts`).
 *
 * The file is one array per field (D-745: 21 KB gzipped against 25 KB as
 * objects), sorted by magnitude so the brightest come first — the draw order
 * and the order a collision rule walks. It is committed, never written by
 * `vite build`, and `tests/data/starCatalog.test.ts` re-runs `buildStars()`
 * into memory and asserts it equals the committed file.
 *
 * Positions are J2000 with no proper motion, as the fixtures were captured
 * (`tests/fixtures/stars/README.md`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { Constellation } from 'astronomy-engine';
import { STAR_MAG_LIMIT } from '../src/data/stars/constants';

const SRC = resolve('data-src/stars');
const OUT = resolve('src/data/stars/catalog.json');
const RAD = Math.PI / 180;

/** One Yale record, the fields the catalogue keeps. */
interface BscRecord {
  hr: number;
  hd: number;
  ra: number;
  dec: number;
  mag: number;
  desig: string;
  con: string;
}

/** One drawn feature: `part` tells Serpens' two halves apart (0 everywhere else). */
export interface FigureOut {
  con: string;
  part: number;
  segments: [number, number][];
}

/** The file's shape, field by field (D-748). */
export interface CatalogOut {
  ra: number[];
  dec: number[];
  mag: number[];
  name: string[];
  desig: string[];
  con: string[];
  figures: FigureOut[];
}

export interface BuildReport {
  records: number;
  stars: number;
  bright: number;
  endpointsFainter: number;
  figures: number;
  segments: number;
  names: number;
  /** Widest distance from a figure's endpoint to the star it snapped to, degrees. */
  worstSnapDeg: number;
}

/** Angular separation of two RA/Dec points, degrees. */
function separationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const c = Math.sin(dec1 * RAD) * Math.sin(dec2 * RAD) + Math.cos(dec1 * RAD) * Math.cos(dec2 * RAD) * Math.cos((ra1 - ra2) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
}

/**
 * The Yale catalogue's fixed-width records (CDS V/50 `ReadMe`: bytes 1-4 HR,
 * 5-7 Flamsteed, 8-11 Bayer, 12-14 constellation, 26-31 HD, 76-90 the J2000
 * position, 103-107 V). The 14 records with no position are skipped.
 */
function parseBsc(text: string): BscRecord[] {
  const out: BscRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.length < 107 || line.slice(75, 77).trim() === '') continue;
    const mag = Number.parseFloat(line.slice(102, 107));
    if (!Number.isFinite(mag)) continue;
    const hr = Number(line.slice(0, 4));
    const ra = (Number(line.slice(75, 77)) + Number(line.slice(77, 79)) / 60 + Number(line.slice(79, 83)) / 3600) * 15;
    const sign = line[83] === '-' ? -1 : 1;
    const dec = sign * (Number(line.slice(84, 86)) + Number(line.slice(86, 88)) / 60 + Number(line.slice(88, 90)) / 3600);
    const flamsteed = line.slice(4, 7).trim();
    const bayer = `${line.slice(7, 10).trim()}${line.slice(10, 11).trim()}`;
    // The record names a constellation only beside a Bayer or Flamsteed designation; for the rest it is
    // read off the IAU boundaries, which agree with every one the catalogue does name.
    const con = line.slice(11, 14).trim() || Constellation(ra / 15, dec).symbol;
    const desig = bayer !== '' ? `${bayer} ${con}` : flamsteed !== '' ? `${flamsteed} ${con}` : `HR ${String(hr)}`;
    out.push({ hr, hd: Number(line.slice(25, 31)), ra, dec, mag, desig, con });
  }
  return out;
}

/** The WGSN list, name by HD number: the name is the first 18 columns, the HD number three fields before the date. */
function parseIauNames(text: string): Map<number, string> {
  const names = new Map<number, string>();
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const fields = line.trim().split(/\s+/);
    const at = fields.findIndex((f) => /^\d{4}-\d\d-\d\d$/.test(f));
    const hd = fields[at - 3];
    if (at < 4 || hd === undefined || hd === '_') continue;
    names.set(Number(hd), line.slice(0, 18).trim());
  }
  return names;
}

interface LinesFile {
  features: { id: string; geometry: { coordinates: [number, number][][] } }[];
}

const round = (n: number, places: number): number => Math.round(n * 10 ** places) / 10 ** places;

/** The catalogue from the three sources' text. Pure, so the test can run it into memory. */
export function buildCatalog(bscText: string, iauText: string, linesJson: string, magLimit = STAR_MAG_LIMIT): { catalog: CatalogOut; report: BuildReport } {
  const records = parseBsc(bscText);
  const names = parseIauNames(iauText);
  const lines = JSON.parse(linesJson) as LinesFile;

  // d3-celestial writes RA as a longitude in [−180, 180].
  const snap = (lon: number, lat: number): { index: number; deg: number } => {
    const ra = (lon + 360) % 360;
    let index = -1;
    let deg = Infinity;
    records.forEach((r, i) => {
      if (Math.abs(r.dec - lat) > 1) return;
      const d = separationDeg(ra, lat, r.ra, r.dec);
      if (d < deg) {
        deg = d;
        index = i;
      }
    });
    if (index < 0) throw new Error(`no catalogue star near the figure point ${String(lon)}, ${String(lat)}`);
    return { index, deg };
  };

  const endpointRecords = new Set<number>();
  const parts = new Map<string, number>();
  const snapped: { con: string; part: number; segments: [number, number][] }[] = [];
  let worstSnapDeg = 0;
  for (const feature of lines.features) {
    const part = parts.get(feature.id) ?? 0;
    parts.set(feature.id, part + 1);
    const segments: [number, number][] = [];
    for (const path of feature.geometry.coordinates) {
      const points = path.map(([lon, lat]) => snap(lon, lat));
      for (const p of points) {
        worstSnapDeg = Math.max(worstSnapDeg, p.deg);
        endpointRecords.add(p.index);
      }
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1]?.index ?? -1;
        const b = points[i]?.index ?? -1;
        if (a !== b) segments.push([a, b]);
      }
    }
    snapped.push({ con: feature.id, part, segments });
  }

  // Brightest first; equal magnitudes keep the catalogue's HR order (the sort is stable).
  const kept = records
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => r.mag <= magLimit || endpointRecords.has(i))
    .sort((a, b) => a.r.mag - b.r.mag);
  const indexOf = new Map(kept.map(({ i }, k) => [i, k]));
  const at = (i: number): number => {
    const k = indexOf.get(i);
    if (k === undefined) throw new Error(`figure endpoint ${String(i)} is not in the catalogue`);
    return k;
  };

  const catalog: CatalogOut = {
    ra: kept.map(({ r }) => round(r.ra, 3)),
    dec: kept.map(({ r }) => round(r.dec, 3)),
    mag: kept.map(({ r }) => round(r.mag, 2)),
    name: kept.map(({ r }) => names.get(r.hd) ?? ''),
    desig: kept.map(({ r }) => r.desig),
    con: kept.map(({ r }) => r.con),
    figures: snapped.map((f) => ({ con: f.con, part: f.part, segments: f.segments.map(([a, b]) => [at(a), at(b)] as [number, number]) })),
  };

  return {
    catalog,
    report: {
      records: records.length,
      stars: kept.length,
      bright: kept.filter(({ r }) => r.mag <= magLimit).length,
      endpointsFainter: kept.filter(({ r }) => r.mag > magLimit).length,
      figures: catalog.figures.length,
      segments: catalog.figures.reduce((n, f) => n + f.segments.length, 0),
      names: catalog.name.filter((n) => n !== '').length,
      worstSnapDeg,
    },
  };
}

/** The file's text: one field per line, so a diff says which column moved. */
export function serialize(catalog: CatalogOut): string {
  const fields = Object.entries(catalog).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`);
  return `{\n${fields.join(',\n')}\n}\n`;
}

/** The catalogue built from `data-src/stars/`, as the file's text and the report. */
export function buildStars(srcDir = SRC): { text: string; report: BuildReport } {
  const bsc = gunzipSync(readFileSync(resolve(srcDir, 'bsc5-catalog.gz'))).toString('latin1');
  const iau = readFileSync(resolve(srcDir, 'iau-csn.txt'), 'utf8');
  const lines = readFileSync(resolve(srcDir, 'd3-celestial-constellations.lines.json'), 'utf8');
  const { catalog, report } = buildCatalog(bsc, iau, lines);
  return { text: serialize(catalog), report };
}

/** The gzipped size of the file, bytes, at the level a static host serves. */
export const gzippedBytes = (text: string): number => gzipSync(text, { level: 9 }).length;

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { text, report } = buildStars();
  writeFileSync(OUT, text, 'utf8');
  const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(
    [
      `${OUT}`,
      `stars: ${String(report.stars)} (${String(report.bright)} at V ≤ ${String(STAR_MAG_LIMIT)}, ${String(report.endpointsFainter)} fainter figure endpoints) of ${String(report.records)} records`,
      `figures: ${String(report.figures)} drawn features, ${String(report.segments)} segments, worst snap ${report.worstSnapDeg.toFixed(4)}°`,
      `names: ${String(report.names)}`,
      `size: ${kb(Buffer.byteLength(text))} raw, ${kb(gzippedBytes(text))} gzipped`,
    ].join('\n'),
  );
}
