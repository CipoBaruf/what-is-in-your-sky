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
 *
 * R154 (FR-LOOK-3, FR-LOOK-5, FR-LOOK-8, PLAN D-973, D-977): two more files
 * beside it, from the same run. `catalog.json` gains `bv`, the B−V colour
 * index in tenths. `deep.json` is every other Yale star to `DEEP_MAG_LIMIT` —
 * the stars fainter than `STAR_MAG_LIMIT` that `catalog.json` does not already
 * hold as a figure's endpoint, so the two files hold each star once — as
 * integer columns, brightest first. `milkyWay.json` is the outline of the
 * galactic plane: one closed ring per half-width of `MILKY_WAY_BANDS_DEG`,
 * converted to J2000 once from the IAU 1958 pole and node below, from no
 * image. The test asserts all three byte for byte.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { Constellation } from 'astronomy-engine';
import { DEEP_MAG_LIMIT, MILKY_WAY_BANDS_DEG, STAR_MAG_LIMIT } from '../src/data/stars/constants';
import { CONSTELLATION_NAMES } from '../src/data/stars/constellations';
import { angularDistanceDeg } from '../src/lib/skyGeometry';

const SRC = fileURLToPath(new URL('../data-src/stars/', import.meta.url));
const OUT = fileURLToPath(new URL('../src/data/stars/catalog.json', import.meta.url));
const DEEP_OUT = fileURLToPath(new URL('../src/data/stars/deep.json', import.meta.url));
const MILKY_WAY_OUT = fileURLToPath(new URL('../src/data/stars/milkyWay.json', import.meta.url));

/**
 * The farthest a figure's point may sit from the star it snaps to, degrees.
 * The spike measured 0.0025° at worst; a point farther than this means its
 * star is missing from the parsed catalogue, and the build fails.
 */
export const SNAP_MAX_DEG = 0.1;

/** One Yale record, the fields the catalogue keeps. */
interface BscRecord {
  hr: number;
  hd: number;
  ra: number;
  dec: number;
  mag: number;
  /** B−V in tenths, or `null` where the record leaves it blank. */
  bv: number | null;
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
  /** B−V in tenths, `BV_BLANK` where the record has none (D-973, D-977). */
  bv: number[];
  name: string[];
  /** The Spanish name where `names-es.tsv` has a row for the star, else `''` (D-832). */
  nameEs: string[];
  desig: string[];
  con: string[];
  figures: FigureOut[];
  /** The Spanish name of every drawn part, by abbreviation, indexed by `part` (D-832). */
  figuresEs: Record<string, string[]>;
  /** The Spanish name of a constellation drawn in more than one part, whole: `{ Ser: 'Serpiente' }`. */
  wholeEs: Record<string, string>;
}

/** The Spanish names as `names-es.tsv` lists them, checked against the catalogue (D-832). */
export interface NamesEs {
  stars: Map<string, string>;
  figures: Record<string, string[]>;
  whole: Record<string, string>;
}

/**
 * `data-src/stars/names-es.tsv`: tab-separated `kind key part es`, `#` comments.
 * `con` rows by IAU abbreviation and part (`all` for a split constellation
 * whole), `star` rows by the IAU name the catalogue carries. Fails on an
 * unknown kind, an abbreviation outside the 88, a part the figure does not
 * have or one it lacks, a `star` key the catalogue does not carry, a blank
 * name or a duplicate row.
 */
export function parseNamesEs(text: string, starNames: readonly string[]): NamesEs {
  const known = new Set(starNames.filter((n) => n !== ''));
  const stars = new Map<string, string>();
  const figures: Record<string, string[]> = {};
  const whole: Record<string, string> = {};
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((line, n) => {
    if (line.startsWith('#') || line.trim() === '') return;
    const [kind = '', key = '', part = '', es = '', ...rest] = line.split('\t');
    const at = `names-es.tsv line ${String(n + 1)}`;
    if (rest.length > 0 || es.trim() === '' || es.trim() !== es) throw new Error(`${at}: expected four fields and a name`);
    // A part is keyed by its number, so `1` and `01` are the same row.
    const id = `${kind} ${key} ${/^\d+$/.test(part) ? String(Number(part)) : part}`;
    if (seen.has(id)) throw new Error(`${at}: duplicate row ${id}`);
    seen.add(id);
    if (kind === 'star') {
      if (part !== '') throw new Error(`${at}: a star row has no part`);
      if (!known.has(key)) throw new Error(`${at}: ${key} is not a name the catalogue carries`);
      stars.set(key, es);
    } else if (kind === 'con') {
      const latin = Object.hasOwn(CONSTELLATION_NAMES, key) ? CONSTELLATION_NAMES[key] : undefined;
      if (latin === undefined) throw new Error(`${at}: ${key} is not one of the 88 abbreviations`);
      if (part === 'all') {
        if (latin.length < 2) throw new Error(`${at}: ${key} is drawn in one part and has no whole row`);
        whole[key] = es;
      } else {
        const p = Number(part);
        if (!/^\d+$/.test(part) || p >= latin.length) throw new Error(`${at}: ${key} has no part ${part}`);
        (figures[key] ??= [])[p] = es;
      }
    } else {
      throw new Error(`${at}: unknown kind ${kind}`);
    }
  });
  for (const [con, latin] of Object.entries(CONSTELLATION_NAMES)) {
    for (let p = 0; p < latin.length; p += 1) if (figures[con]?.[p] === undefined) throw new Error(`names-es.tsv: ${con} part ${String(p)} has no row`);
    if (latin.length > 1 && whole[con] === undefined) throw new Error(`names-es.tsv: ${con} has no whole row`);
  }
  // In the 88's order, so the file does not move with the list's.
  const ordered = Object.fromEntries(Object.keys(CONSTELLATION_NAMES).map((con) => [con, figures[con] ?? []]));
  return { stars, figures: ordered, whole };
}

/**
 * `deep.json`'s shape (D-973): integers, `ra` and `dec` in 0.01°, `mag` and
 * `bv` in 0.1, sorted by magnitude so a prefix is the brightest n.
 */
export interface DeepOut {
  ra: number[];
  dec: number[];
  mag: number[];
  bv: number[];
}

/** `milkyWay.json`'s shape (D-973): one closed ring of `[ra, dec]` degrees per band, outermost first. */
export interface MilkyWayOut {
  bands: [number, number][][];
}

/**
 * The B−V written for a record that leaves it blank, in tenths: 0.2, the
 * middle of `BV_TONES`' white row, because FR-LOOK-5 draws a star with no
 * index white. The task's 0.6 would draw it yellow-white (D-977).
 */
export const BV_BLANK = 2;

export interface BuildReport {
  records: number;
  stars: number;
  bright: number;
  endpointsFainter: number;
  figures: number;
  segments: number;
  names: number;
  /** Stars with a Spanish name (D-832). */
  namesEs: number;
  /** WGSN lines whose HD already had a name: the first name in the file is kept. */
  nameCollisions: number;
  /** Names whose record is not kept, given to a nameless kept star within `SNAP_MAX_DEG` (a double's other component). */
  namesCarried: number;
  /** Segments dropped because the figure already drew that pair (either way round). */
  duplicateSegments: number;
  /** Widest distance from a figure's endpoint to the star it snapped to, degrees. */
  worstSnapDeg: number;
  /** Stars in `catalog.json` whose record has no B−V, written as `BV_BLANK`. */
  bvBlank: number;
  /** Stars in `deep.json`. */
  deepStars: number;
  /** Stars in `deep.json` whose record has no B−V, written as `BV_BLANK`. */
  deepBvBlank: number;
}

/** Great-circle separation of two RA/Dec points, degrees (the dome's helper: RA as azimuth, Dec as elevation). */
const separationDeg = (ra1: number, dec1: number, ra2: number, dec2: number): number =>
  angularDistanceDeg({ azDeg: ra1, elDeg: dec1 }, { azDeg: ra2, elDeg: dec2 });

/**
 * The Yale catalogue's fixed-width records (CDS V/50 `ReadMe`: bytes 1-4 HR,
 * 5-7 Flamsteed, 8-11 Bayer, 12-14 constellation, 26-31 HD, 76-90 the J2000
 * position, 103-107 V, 110-114 B−V). The 14 records with no position are
 * skipped. B−V is read in hundredths and kept in tenths (D-973).
 */
function parseBsc(text: string): BscRecord[] {
  const out: BscRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.length < 107 || line.slice(75, 77).trim() === '') continue;
    const mag = Number.parseFloat(line.slice(102, 107));
    if (!Number.isFinite(mag)) continue;
    const hr = Number(line.slice(0, 4));
    const bvText = line.slice(109, 114).trim();
    const bv = bvText === '' ? null : tenths(Number.parseFloat(bvText));
    const ra = (Number(line.slice(75, 77)) + Number(line.slice(77, 79)) / 60 + Number(line.slice(79, 83)) / 3600) * 15;
    const sign = line[83] === '-' ? -1 : 1;
    const dec = sign * (Number(line.slice(84, 86)) + Number(line.slice(86, 88)) / 60 + Number(line.slice(88, 90)) / 3600);
    const flamsteed = line.slice(4, 7).trim();
    const bayer = `${line.slice(7, 10).trim()}${line.slice(10, 11).trim()}`;
    // The record names a constellation only beside a Bayer or Flamsteed designation; for the rest it is
    // read off the IAU boundaries, which agree with every one the catalogue does name.
    const con = line.slice(11, 14).trim() || Constellation(ra / 15, dec).symbol;
    const desig = bayer !== '' ? `${bayer} ${con}` : flamsteed !== '' ? `${flamsteed} ${con}` : `HR ${String(hr)}`;
    out.push({ hr, hd: Number(line.slice(25, 31)), ra, dec, mag, bv, desig, con });
  }
  return out;
}

/**
 * The WGSN list, name by HD number: the name is the first 18 columns, the HD
 * number three fields before the date. When two lines carry one HD, the first
 * in the file keeps it and the rest are counted as collisions.
 */
function parseIauNames(text: string): { names: Map<number, string>; collisions: number } {
  const names = new Map<number, string>();
  let collisions = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const fields = line.trim().split(/\s+/);
    const at = fields.findIndex((f) => /^\d{4}-\d\d-\d\d$/.test(f));
    const hd = fields[at - 3];
    if (at < 4 || hd === undefined || hd === '_') continue;
    if (names.has(Number(hd))) collisions += 1;
    else names.set(Number(hd), line.slice(0, 18).trim());
  }
  return { names, collisions };
}

interface LinesFile {
  features: { id: string; geometry: { coordinates: [number, number][][] } }[];
}

const round = (n: number, places: number): number => Math.round(n * 10 ** places) / 10 ** places;

/** A value the Yale file gives to 0.01, in integer tenths, half up and never −0 (D-973). */
const tenths = (n: number): number => Math.round(Math.round(n * 100) / 10) + 0;

/** The catalogue from the three sources' text. Pure, so the test can run it into memory. */
export function buildCatalog(
  bscText: string,
  iauText: string,
  linesJson: string,
  namesEsText: string,
  magLimit = STAR_MAG_LIMIT,
  deepLimit = DEEP_MAG_LIMIT,
): { catalog: CatalogOut; deep: DeepOut; report: BuildReport } {
  const records = parseBsc(bscText);
  const { names, collisions: nameCollisions } = parseIauNames(iauText);
  const lines = JSON.parse(linesJson) as LinesFile;

  // The records by declination, so a point searches only the band within SNAP_MAX_DEG of it.
  const byDec = records.map((_, i) => i).sort((a, b) => (records[a]?.dec ?? 0) - (records[b]?.dec ?? 0));
  const decOf = (k: number): number => records[byDec[k] ?? -1]?.dec ?? NaN;

  // The nearest star by great-circle distance within SNAP_MAX_DEG; a tie goes to the brighter, then the lower HR.
  // d3-celestial writes RA as a longitude in [−180, 180].
  const snap = (lon: number, lat: number): { index: number; deg: number } => {
    const ra = (lon + 360) % 360;
    let lo = 0;
    let hi = byDec.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (decOf(mid) < lat - SNAP_MAX_DEG) lo = mid + 1;
      else hi = mid;
    }
    let index = -1;
    let deg = Infinity;
    for (let k = lo; k < byDec.length && decOf(k) <= lat + SNAP_MAX_DEG; k += 1) {
      const i = byDec[k] ?? -1;
      const r = records[i];
      if (r === undefined) continue;
      const d = separationDeg(ra, lat, r.ra, r.dec);
      const best = records[index];
      if (d < deg || (d === deg && best !== undefined && (r.mag < best.mag || (r.mag === best.mag && i < index)))) {
        deg = d;
        index = i;
      }
    }
    if (index < 0 || deg > SNAP_MAX_DEG) {
      throw new Error(`no catalogue star within ${String(SNAP_MAX_DEG)}° of the figure point ${String(lon)}, ${String(lat)}`);
    }
    return { index, deg };
  };

  const endpointRecords = new Set<number>();
  const parts = new Map<string, number>();
  const snapped: { con: string; part: number; segments: [number, number][] }[] = [];
  let worstSnapDeg = 0;
  let duplicateSegments = 0;
  for (const feature of lines.features) {
    const part = parts.get(feature.id) ?? 0;
    parts.set(feature.id, part + 1);
    const segments: [number, number][] = [];
    const drawn = new Set<string>();
    for (const path of feature.geometry.coordinates) {
      const points = path.map(([lon, lat]) => snap(lon, lat));
      for (const p of points) {
        worstSnapDeg = Math.max(worstSnapDeg, p.deg);
        endpointRecords.add(p.index);
      }
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1]?.index ?? -1;
        const b = points[i]?.index ?? -1;
        if (a === b) continue; // two points on one star: no segment
        const key = a < b ? `${String(a)} ${String(b)}` : `${String(b)} ${String(a)}`;
        if (drawn.has(key)) {
          duplicateSegments += 1;
          continue;
        }
        drawn.add(key);
        segments.push([a, b]);
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

  // A WGSN name whose record is not kept (the fainter record of a double, as Alrescha's is) goes to the
  // nearest kept star within SNAP_MAX_DEG that has no name of its own, in HR order.
  const nameColumn = kept.map(({ r }) => names.get(r.hd) ?? '');
  let namesCarried = 0;
  records.forEach((r, i) => {
    const name = names.get(r.hd);
    if (name === undefined || indexOf.has(i)) return;
    let best = -1;
    let bestDeg = SNAP_MAX_DEG;
    kept.forEach(({ r: s }, k) => {
      if (nameColumn[k] !== '' || Math.abs(s.dec - r.dec) > SNAP_MAX_DEG) return;
      const d = separationDeg(r.ra, r.dec, s.ra, s.dec);
      if (d <= bestDeg) {
        if (d === bestDeg && best >= 0) return;
        bestDeg = d;
        best = k;
      }
    });
    if (best >= 0) {
      nameColumn[best] = name;
      namesCarried += 1;
    }
  });

  const es = parseNamesEs(namesEsText, nameColumn);
  const catalog: CatalogOut = {
    ra: kept.map(({ r }) => round(r.ra, 3)),
    dec: kept.map(({ r }) => round(r.dec, 3)),
    mag: kept.map(({ r }) => round(r.mag, 2)),
    bv: kept.map(({ r }) => r.bv ?? BV_BLANK),
    name: nameColumn,
    nameEs: nameColumn.map((n) => es.stars.get(n) ?? ''),
    desig: kept.map(({ r }) => r.desig),
    con: kept.map(({ r }) => r.con),
    figures: snapped.map((f) => ({ con: f.con, part: f.part, segments: f.segments.map(([a, b]) => [at(a), at(b)] as [number, number]) })),
    figuresEs: es.figures,
    wholeEs: es.whole,
  };

  // The deep stars: every record past the limit to `deepLimit` that the catalogue does not already hold
  // (a figure's endpoint), in the catalogue's order — by magnitude, equal ones in HR order (D-977).
  const deepRecords = records
    .filter((r, i) => r.mag > magLimit && r.mag <= deepLimit && !indexOf.has(i))
    .sort((a, b) => a.mag - b.mag);
  const centi = (deg: number, wrap: number): number => {
    const n = Math.round(deg * 100);
    return wrap > 0 ? n % wrap : n;
  };
  const deep: DeepOut = {
    ra: deepRecords.map((r) => centi(r.ra, 36_000)),
    dec: deepRecords.map((r) => centi(r.dec, 0)),
    // 4.51–4.54 would round to 4.5, the bright limit itself; they are written 4.6 so every deep star stays past it (D-977).
    mag: deepRecords.map((r) => Math.max(tenths(r.mag), tenths(magLimit) + 1)),
    bv: deepRecords.map((r) => r.bv ?? BV_BLANK),
  };

  return {
    catalog,
    deep,
    report: {
      records: records.length,
      stars: kept.length,
      bright: kept.filter(({ r }) => r.mag <= magLimit).length,
      endpointsFainter: kept.filter(({ r }) => r.mag > magLimit).length,
      figures: catalog.figures.length,
      segments: catalog.figures.reduce((n, f) => n + f.segments.length, 0),
      names: catalog.name.filter((n) => n !== '').length,
      namesEs: catalog.nameEs.filter((n) => n !== '').length,
      nameCollisions,
      namesCarried,
      duplicateSegments,
      worstSnapDeg,
      bvBlank: kept.filter(({ r }) => r.bv === null).length,
      deepStars: deepRecords.length,
      deepBvBlank: deepRecords.filter((r) => r.bv === null).length,
    },
  };
}

/**
 * The IAU 1958 galactic frame in J2000 (Blaauw et al. 1960, precessed): the
 * north galactic pole's right ascension and declination, and the galactic
 * longitude of the north celestial pole, degrees.
 */
export const GALACTIC_POLE = { raDeg: 192.85948, decDeg: 27.12825, lNcpDeg: 122.93192 } as const;

/**
 * The outline's longitude step, degrees. FR-LOOK-3 asks for 3° and for about
 * 360 points in all at ≤ 2 KB gzipped; three bands of two edges at 3° are 726
 * points and 3.4 KB, so the step is 6° — 366 points, 1.7 KB — and the two
 * numbers the file is pinned by hold (D-977).
 */
export const MILKY_WAY_STEP_DEG = 6;

/**
 * The core's widening: each band's half-width grows by `widenDeg` ×
 * exp(−(l / `scaleDeg`)²), l the longitude from the galactic centre, so the
 * bulge at Sagittarius reads widest (FR-LOOK-3).
 */
export const MILKY_WAY_CORE = { widenDeg: 3, scaleDeg: 55 } as const;

const RAD = Math.PI / 180;

/** Galactic longitude and latitude to J2000 right ascension and declination, degrees. */
export function galacticToEquatorial(lDeg: number, bDeg: number): { raDeg: number; decDeg: number } {
  const { raDeg: raGp, decDeg: decGp, lNcpDeg } = GALACTIC_POLE;
  const b = bDeg * RAD;
  const dl = (lNcpDeg - lDeg) * RAD;
  const sinDec = Math.sin(b) * Math.sin(decGp * RAD) + Math.cos(b) * Math.cos(decGp * RAD) * Math.cos(dl);
  const y = Math.cos(b) * Math.sin(dl);
  const x = Math.sin(b) * Math.cos(decGp * RAD) - Math.cos(b) * Math.sin(decGp * RAD) * Math.cos(dl);
  const ra = (((raGp + Math.atan2(y, x) / RAD) % 360) + 360) % 360;
  return { raDeg: ra, decDeg: Math.asin(Math.max(-1, Math.min(1, sinDec))) / RAD };
}

/**
 * The galactic plane's outline (FR-LOOK-3, D-973): for each half-width, the
 * band between latitude +b and −b as one closed ring — along +b every
 * `MILKY_WAY_STEP_DEG` of longitude once round, then back along −b. The ring
 * starts and ends at the anticentre (l = 180°), the plane's faintest part, so
 * its seam is a zero-width cut there and not through the core. Points are
 * written to 0.1°, which the haze does not need finer than.
 */
export function buildMilkyWay(bandsDeg: readonly number[] = MILKY_WAY_BANDS_DEG): MilkyWayOut {
  const steps = 360 / MILKY_WAY_STEP_DEG;
  const longitudes = Array.from({ length: steps + 1 }, (_, k) => 180 + k * MILKY_WAY_STEP_DEG);
  const fromCentre = (l: number): number => ((((l + 180) % 360) + 360) % 360) - 180;
  const point = (l: number, b: number): [number, number] => {
    const { raDeg, decDeg } = galacticToEquatorial(l, b);
    return [round(raDeg, 1) % 360, round(decDeg, 1)];
  };
  return {
    bands: bandsDeg.map((half) => {
      const width = (l: number): number => half + MILKY_WAY_CORE.widenDeg * Math.exp(-((fromCentre(l) / MILKY_WAY_CORE.scaleDeg) ** 2));
      return [...longitudes.map((l) => point(l, width(l))), ...[...longitudes].reverse().map((l) => point(l, -width(l)))];
    }),
  };
}

/** The file's text: one field per line, so a diff says which column moved. */
export function serialize(catalog: CatalogOut | DeepOut): string {
  const fields = Object.entries(catalog).map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`);
  return `{\n${fields.join(',\n')}\n}\n`;
}

/** `milkyWay.json`'s text: one ring per line. */
export function serializeMilkyWay(milkyWay: MilkyWayOut): string {
  return `{"bands":[\n${milkyWay.bands.map((ring) => JSON.stringify(ring)).join(',\n')}\n]}\n`;
}

/** The three files built from `data-src/stars/`, as their text, and the report. */
export function buildStars(srcDir = SRC): { text: string; deepText: string; milkyWayText: string; report: BuildReport } {
  const bsc = gunzipSync(readFileSync(resolve(srcDir, 'bsc5-catalog.gz'))).toString('latin1');
  const iau = readFileSync(resolve(srcDir, 'iau-csn.txt'), 'utf8');
  const lines = readFileSync(resolve(srcDir, 'd3-celestial-constellations.lines.json'), 'utf8');
  const namesEs = readFileSync(resolve(srcDir, 'names-es.tsv'), 'utf8');
  const { catalog, deep, report } = buildCatalog(bsc, iau, lines, namesEs);
  return { text: serialize(catalog), deepText: serialize(deep), milkyWayText: serializeMilkyWay(buildMilkyWay()), report };
}

/** The gzipped size of the file, bytes, at the level a static host serves. */
export const gzippedBytes = (text: string): number => gzipSync(text, { level: 9 }).length;

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { text, deepText, milkyWayText, report } = buildStars();
  writeFileSync(OUT, text, 'utf8');
  writeFileSync(DEEP_OUT, deepText, 'utf8');
  writeFileSync(MILKY_WAY_OUT, milkyWayText, 'utf8');
  const points = (JSON.parse(milkyWayText) as MilkyWayOut).bands.reduce((n, ring) => n + ring.length, 0);
  const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(
    [
      `${OUT}`,
      `stars: ${String(report.stars)} (${String(report.bright)} at V ≤ ${String(STAR_MAG_LIMIT)}, ${String(report.endpointsFainter)} fainter figure endpoints) of ${String(report.records)} records`,
      `figures: ${String(report.figures)} drawn features, ${String(report.segments)} segments, worst snap ${report.worstSnapDeg.toFixed(4)}°`,
      `figures: ${String(report.duplicateSegments)} duplicate segments dropped`,
      `names: ${String(report.names)} (${String(report.nameCollisions)} WGSN lines on an HD already named, the first kept; ${String(report.namesCarried)} carried to a double's kept component)`,
      `names-es.tsv: ${String(report.namesEs)} stars with a Spanish name, every figure part and split constellation named`,
      `bv: ${String(report.bvBlank)} blank, written as ${String(BV_BLANK / 10)}`,
      `size: ${kb(Buffer.byteLength(text))} raw, ${kb(gzippedBytes(text))} gzipped`,
      `${DEEP_OUT}`,
      `stars: ${String(report.deepStars)} at ${String(STAR_MAG_LIMIT)} < V ≤ ${String(DEEP_MAG_LIMIT)} not already in the catalogue; bv: ${String(report.deepBvBlank)} blank`,
      `size: ${kb(Buffer.byteLength(deepText))} raw, ${kb(gzippedBytes(deepText))} gzipped`,
      `${MILKY_WAY_OUT}`,
      `rings: ${String(MILKY_WAY_BANDS_DEG.length)}, ${String(points)} points`,
      `size: ${kb(Buffer.byteLength(milkyWayText))} raw, ${kb(gzippedBytes(milkyWayText))} gzipped`,
    ].join('\n'),
  );
}
