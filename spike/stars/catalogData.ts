/**
 * R111 (FR-STAR-1, FR-STAR-12, D-741 item 1): the spike's catalogue, built from
 * the three raw files in `data-src/stars/`. Pure: the caller reads the files and
 * passes their text in, so `catalog.ts` can measure the result and the page can
 * load what it wrote. This is the shape the build step of the second cut is
 * expected to keep, not the build step itself.
 */

export interface Star {
  /** Harvard Revised number, the Yale catalogue's own id. */
  hr: number;
  /** J2000 right ascension and declination, degrees. */
  ra: number;
  dec: number;
  /** Visual magnitude. */
  v: number;
  /** Bayer or Flamsteed designation as the catalogue prints it (`Alp UMa`, `61 Cyg`), or empty. */
  des: string;
  /** IAU proper name, or empty. */
  name: string;
  /** Constellation abbreviation (`UMa`). */
  con: string;
}

export interface Figure {
  /** Constellation abbreviation, as d3-celestial keys it (`Ser1`/`Ser2` for the two halves of Serpens). */
  id: string;
  /** Line segments as pairs of indexes into `Catalog.stars`. */
  segments: [number, number][];
}

export interface Catalog {
  stars: Star[];
  figures: Figure[];
}

export interface BuildReport {
  records: number;
  brightStars: number;
  endpointStars: number;
  figures: number;
  segments: number;
  endpoints: number;
  /** Widest distance from a figure's endpoint to the star it snapped to, degrees. */
  worstSnapDeg: number;
}

const RAD = Math.PI / 180;

/** Angular separation of two RA/Dec points, degrees. */
export function separationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const c = Math.sin(dec1 * RAD) * Math.sin(dec2 * RAD) + Math.cos(dec1 * RAD) * Math.cos(dec2 * RAD) * Math.cos((ra1 - ra2) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
}

interface BscRecord extends Star {
  hd: number;
}

/** The Yale catalogue's fixed-width records (CDS V/50 `ReadMe`, bytes 1-4 HR, 5-14 name, 26-31 HD, 76-90 J2000 position, 103-107 V). */
export function parseBsc(text: string): BscRecord[] {
  const out: BscRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.length < 107 || line.slice(75, 77).trim() === '') continue; // the 14 records with no position (novae, removed entries)
    const v = Number.parseFloat(line.slice(102, 107));
    if (!Number.isFinite(v)) continue;
    const ra = (Number(line.slice(75, 77)) + Number(line.slice(77, 79)) / 60 + Number(line.slice(79, 83)) / 3600) * 15;
    const sign = line[83] === '-' ? -1 : 1;
    const dec = sign * (Number(line.slice(84, 86)) + Number(line.slice(86, 88)) / 60 + Number(line.slice(88, 90)) / 3600);
    // Bytes 5-14: the Flamsteed number (5-7), the Bayer letter (8-10) and its superscript (11), the constellation (12-14).
    const flamsteed = line.slice(4, 7).trim();
    const bayer = `${line.slice(7, 10).trim()}${line.slice(10, 11).trim()}`;
    const con = line.slice(11, 14).trim();
    out.push({
      hr: Number(line.slice(0, 4)),
      hd: Number(line.slice(25, 31)),
      ra,
      dec,
      v,
      des: bayer !== '' ? `${bayer} ${con}` : flamsteed !== '' ? `${flamsteed} ${con}` : '',
      con,
      name: '',
    });
  }
  return out;
}

/** The WGSN list: fixed-width ASCII name in the first 18 columns, then whitespace-separated fields with `_` for an empty one; the date column anchors the HD number three fields before it. */
export function parseIauNames(text: string): Map<number, string> {
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

/** Every star at V ≤ `magLimit`, every fainter star a figure ends on, and the figures snapped to them. */
export function buildCatalog(bscText: string, iauText: string, linesJson: string, magLimit: number): { catalog: Catalog; report: BuildReport } {
  const records = parseBsc(bscText);
  const names = parseIauNames(iauText);
  const lines = JSON.parse(linesJson) as LinesFile;

  // d3-celestial writes RA as a longitude in [−180, 180].
  const snap = (lon: number, lat: number): { index: number; deg: number } => {
    const ra = (lon + 360) % 360;
    let best = -1;
    let deg = Infinity;
    for (let i = 0; i < records.length; i += 1) {
      const r = records[i];
      if (!r || Math.abs(r.dec - lat) > 1) continue;
      const d = separationDeg(ra, lat, r.ra, r.dec);
      if (d < deg) {
        deg = d;
        best = i;
      }
    }
    return { index: best, deg };
  };

  const endpointRecords = new Set<number>();
  const snapped: { id: string; segments: [number, number][] }[] = [];
  let worstSnapDeg = 0;
  let endpoints = 0;
  for (const feature of lines.features) {
    const segments: [number, number][] = [];
    for (const path of feature.geometry.coordinates) {
      const points = path.map(([lon, lat]) => snap(lon, lat));
      for (const p of points) {
        endpoints += 1;
        worstSnapDeg = Math.max(worstSnapDeg, p.deg);
        endpointRecords.add(p.index);
      }
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1]?.index ?? -1;
        const b = points[i]?.index ?? -1;
        if (a >= 0 && b >= 0 && a !== b) segments.push([a, b]);
      }
    }
    snapped.push({ id: feature.id, segments });
  }

  // Kept records, brightest first: the draw order, and the order the collision rule walks.
  const kept = records
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => r.v <= magLimit || endpointRecords.has(i))
    .sort((a, b) => a.r.v - b.r.v);
  const indexOf = new Map(kept.map(({ i }, k) => [i, k]));
  const stars: Star[] = kept.map(({ r }) => ({ hr: r.hr, ra: r.ra, dec: r.dec, v: r.v, des: r.des, name: names.get(r.hd) ?? '', con: r.con }));
  const figures: Figure[] = snapped.map((f) => ({
    id: f.id,
    segments: f.segments.map(([a, b]) => [indexOf.get(a) ?? -1, indexOf.get(b) ?? -1] as [number, number]).filter(([a, b]) => a >= 0 && b >= 0),
  }));

  return {
    catalog: { stars, figures },
    report: {
      records: records.length,
      brightStars: kept.filter(({ r }) => r.v <= magLimit).length,
      endpointStars: kept.filter(({ r }) => r.v > magLimit).length,
      figures: figures.length,
      segments: figures.reduce((n, f) => n + f.segments.length, 0),
      endpoints,
      worstSnapDeg,
    },
  };
}

/** The objects form, rounded to what a drawing needs: 0.0001° is a third of an arcsecond. */
export function asObjects(catalog: Catalog): unknown {
  return {
    stars: catalog.stars.map((s) => ({ hr: s.hr, ra: round(s.ra, 4), dec: round(s.dec, 4), v: s.v, des: s.des, name: s.name, con: s.con })),
    figures: catalog.figures,
  };
}

/** The columns form: one array per field, the figures as one flat index array per constellation. */
export function asColumns(catalog: Catalog): unknown {
  const s = catalog.stars;
  return {
    hr: s.map((x) => x.hr),
    ra: s.map((x) => round(x.ra, 4)),
    dec: s.map((x) => round(x.dec, 4)),
    v: s.map((x) => x.v),
    des: s.map((x) => x.des),
    name: s.map((x) => x.name),
    con: s.map((x) => x.con),
    figures: Object.fromEntries(catalog.figures.map((f) => [f.id, f.segments.flat()])),
  };
}

/** The columns form read back into the objects the page draws. */
export function fromColumns(columns: { hr: number[]; ra: number[]; dec: number[]; v: number[]; des: string[]; name: string[]; con: string[]; figures: Record<string, number[]> }): Catalog {
  const stars = columns.hr.map((hr, i) => ({ hr, ra: columns.ra[i] ?? 0, dec: columns.dec[i] ?? 0, v: columns.v[i] ?? 99, des: columns.des[i] ?? '', name: columns.name[i] ?? '', con: columns.con[i] ?? '' }));
  const figures = Object.entries(columns.figures).map(([id, flat]) => {
    const segments: [number, number][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) segments.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
    return { id, segments };
  });
  return { stars, figures };
}

const round = (n: number, places: number): number => Math.round(n * 10 ** places) / 10 ** places;
