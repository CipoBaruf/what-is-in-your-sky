import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BV_BLANK, buildCatalog, GALACTIC_POLE, buildMilkyWay, buildStars, galacticToEquatorial, gzippedBytes, MILKY_WAY_CORE, MILKY_WAY_STEP_DEG, parseNamesEs, SNAP_MAX_DEG } from '../../scripts/build-stars';
import { DATA_RULE, dataNotices } from '../../scripts/third-party-notices';
import { parseStarCatalog, starCatalog } from '../../src/data/stars/catalog';
import { CONSTELLATION_NAMES } from '../../src/data/stars/constellations';
import { BV_TONES, DEEP_MAG_LIMIT, MILKY_WAY_BANDS_DEG, STAR_MAG_LIMIT } from '../../src/data/stars/constants';
import { parseDeepCatalog } from '../../src/data/stars/deepChunk';
import { BAYER_LABEL_MAG, constellationName, figureName, starLabelKind, starName } from '../../src/lib/skyStars';

/**
 * R112, FR-STAR-1, FR-STAR-10 (as amended, V24-20), D-748: the committed
 * catalogue — its counts (D-745), its ids, its names, the figure-name table,
 * its size, and that it is exactly what `npm run build:stars` writes from
 * `data-src/stars/`. R120 (FR-STAR-1, FR-STAR-10 as amended v2.5, D-832): the
 * Spanish names, held to `names-es.tsv` row by row.
 */
const FILE = new URL('../../src/data/stars/catalog.json', import.meta.url);
const text = readFileSync(FILE, 'utf8');
const catalog = starCatalog();
const built = buildStars();

describe('the star catalogue', () => {
  it('is what the build writes from data-src/stars/, byte for byte', () => {
    expect(built.text).toBe(text);
  });

  it(`snaps every figure point within ${String(SNAP_MAX_DEG)}° of its star, drops no name and draws no pair twice`, () => {
    expect(built.report.worstSnapDeg).toBeLessThan(SNAP_MAX_DEG);
    expect(built.report.worstSnapDeg).toBeLessThan(0.003); // the spike's 0.0025°
    expect(built.report.nameCollisions).toBe(0);
    expect(built.report.namesCarried).toBe(2); // Alrescha and Izar, from a double's fainter record to the brighter
    expect(built.report.duplicateSegments).toBe(0);
    for (const f of catalog.figures) {
      const pairs = new Set<string>();
      for (let k = 0; k < f.segments.length; k += 2) {
        const a = f.segments[k] ?? -1;
        const b = f.segments[k + 1] ?? -1;
        pairs.add(a < b ? `${String(a)} ${String(b)}` : `${String(b)} ${String(a)}`);
      }
      expect(pairs.size, f.con).toBe(f.segments.length / 2);
    }
  });

  it('parses with the reader, and the reader parses once', () => {
    expect(parseStarCatalog(JSON.parse(text))).toEqual(catalog);
    expect(starCatalog()).toBe(catalog);
  });

  it('has 1033 stars: 904 at V ≤ STAR_MAG_LIMIT and 129 fainter figure endpoints', () => {
    expect(catalog.size).toBe(1033);
    const mags = [...catalog.mag];
    expect(mags.filter((m) => m <= STAR_MAG_LIMIT)).toHaveLength(904);
    expect(mags.filter((m) => m > STAR_MAG_LIMIT)).toHaveLength(129);
    for (const column of [catalog.ra, catalog.dec, catalog.mag, catalog.bv, catalog.name, catalog.desig, catalog.con]) expect(column).toHaveLength(catalog.size);
  });

  it('keeps a star fainter than the limit only when a figure ends on it', () => {
    const endpoints = new Set(catalog.figures.flatMap((f) => [...f.segments]));
    catalog.mag.forEach((m, i) => {
      if (m > STAR_MAG_LIMIT) expect(endpoints.has(i), catalog.desig[i]).toBe(true);
    });
  });

  it('is sorted by magnitude, brightest first', () => {
    for (let i = 1; i < catalog.size; i += 1) expect(catalog.mag[i] ?? NaN).toBeGreaterThanOrEqual(catalog.mag[i - 1] ?? NaN);
    expect(catalog.name[0]).toBe('Sirius');
  });

  it('has 89 drawn features and 743 segments, every endpoint a star in range and no segment a point', () => {
    expect(catalog.figures).toHaveLength(89);
    expect(catalog.figures.reduce((n, f) => n + f.segments.length / 2, 0)).toBe(743);
    for (const f of catalog.figures) {
      expect(f.segments.length % 2, f.con).toBe(0);
      expect(f.segments.length, f.con).toBeGreaterThan(0);
      for (let k = 0; k < f.segments.length; k += 2) {
        const a = f.segments[k] ?? -1;
        const b = f.segments[k + 1] ?? -1;
        expect(a).toBeLessThan(catalog.size);
        expect(b).toBeLessThan(catalog.size);
        expect(a, f.con).not.toBe(b);
      }
    }
  });

  it('holds every star once, proper names unique and never blank when present', () => {
    // A star's id is its index. The Yale records of a double's two components share a designation
    // (`Alp Gem` is Castor A and B, six such pairs), so a star is its designation, position and magnitude.
    const records = catalog.desig.map((d, i) => `${d} ${String(catalog.ra[i])} ${String(catalog.dec[i])} ${String(catalog.mag[i])}`);
    expect(new Set(records).size).toBe(catalog.size);
    expect(catalog.size - new Set(catalog.desig).size).toBe(6);
    const named = catalog.name.filter((n) => n !== '');
    expect(named).toHaveLength(289);
    expect(new Set(named).size).toBe(named.length);
    for (const n of named) expect(n.trim()).toBe(n);
    for (const n of named) expect(n.length).toBeGreaterThan(0);
    expect(catalog.name).toContain('Polaris');
    expect(catalog.name).toContain('Acrux');
    expect(catalog.desig[catalog.name.indexOf('Alrescha')]).toBe('α Psc');
    expect(catalog.desig[catalog.name.indexOf('Izar')]).toBe('ε Boo');
  });

  it('has a Latin name for every drawn feature: 88 constellations, 89 names, Serpens in two', () => {
    expect(Object.keys(CONSTELLATION_NAMES)).toHaveLength(88);
    expect(Object.values(CONSTELLATION_NAMES).flat()).toHaveLength(89);
    for (const f of catalog.figures) expect(figureName(catalog, f.con, f.part, 'en'), `${f.con} ${String(f.part)}`).toBeTruthy();
    expect(new Set(catalog.figures.map((f) => `${f.con} ${String(f.part)}`)).size).toBe(89);
    expect(new Set(catalog.figures.map((f) => f.con)).size).toBe(88);
    expect(catalog.figures.filter((f) => f.con === 'Ser').map((f) => figureName(catalog, f.con, f.part, 'en'))).toEqual(['Serpens Caput', 'Serpens Cauda']);
    expect(figureName(catalog, 'Ori', 0, 'en')).toBe('Orion');
    expect(figureName(catalog, 'Xyz', 0, 'en')).toBeUndefined();
    expect(figureName(catalog, 'toString', 0, 'en')).toBeUndefined();
  });

  it("puts every star in one of the table's constellations", () => {
    for (const con of catalog.con) expect(figureName(catalog, con, 0, 'en'), con).toBeTruthy();
  });

  it('is at most 22 KB gzipped', () => {
    expect(gzippedBytes(text)).toBeLessThanOrEqual(22 * 1024);
  });

  // R154 (FR-LOOK-5, D-973, D-977): the B−V column, in tenths, 0.2 (white) where the record has none.
  it('carries B−V for every star in tenths, five blanks written as 0.2', () => {
    const json = JSON.parse(text) as { bv: number[] };
    expect(json.bv).toHaveLength(catalog.size);
    for (const bv of json.bv) expect(Number.isInteger(bv)).toBe(true);
    expect(built.report.bvBlank).toBe(5);
    expect(BV_BLANK).toBe(2);
    const white = BV_TONES.find(({ below }) => BV_BLANK / 10 < below)?.tone;
    expect(white).toBe('white');
    expect(catalog.bv[catalog.name.indexOf('Sirius')]).toBeCloseTo(0.0, 5); // 0.00 in the record
    expect(catalog.bv[catalog.name.indexOf('Betelgeuse')]).toBeCloseTo(1.9, 5); // 1.85, half up
    expect(catalog.bv[catalog.name.indexOf('Rigel')]).toBeCloseTo(-0.0, 5); // −0.03
    expect(catalog.bv[catalog.name.indexOf('Spica')]).toBeCloseTo(-0.2, 5); // −0.23
    expect(Math.min(...catalog.bv)).toBeGreaterThanOrEqual(-0.4);
    expect(Math.max(...catalog.bv)).toBeLessThanOrEqual(4);
    expect(Object.is(catalog.bv[catalog.name.indexOf('Rigel')], -0)).toBe(false);
  });
});

/**
 * R154 (FR-LOOK-8, D-973, D-977): the deep catalogue — every Yale star past
 * `STAR_MAG_LIMIT` to `DEEP_MAG_LIMIT` that `catalog.json` does not already
 * hold as a figure's endpoint, as integer columns, brightest first.
 */
describe('the deep catalogue', () => {
  const deepText = readFileSync(new URL('../../src/data/stars/deep.json', import.meta.url), 'utf8');
  const json = JSON.parse(deepText) as { ra: number[]; dec: number[]; mag: number[]; bv: number[] };
  const deep = parseDeepCatalog(json);

  it('is what the build writes from data-src/stars/, byte for byte', () => {
    expect(built.deepText).toBe(deepText);
  });

  it('has 7373 stars in four integer columns and nothing else, 239 with B−V blank', () => {
    expect(Object.keys(json)).toEqual(['ra', 'dec', 'mag', 'bv']);
    expect(deep.size).toBe(7373);
    expect(built.report.deepStars).toBe(7373);
    expect(built.report.deepBvBlank).toBe(239);
    for (const column of Object.values(json)) {
      expect(column).toHaveLength(7373);
      for (const n of column) expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('holds each Yale star to DEEP_MAG_LIMIT once across the two files', () => {
    const brightToDeepLimit = [...catalog.mag].filter((m) => m <= DEEP_MAG_LIMIT).length;
    // 9096 records with a position; 7500 at 4.5 < V ≤ 6.5, of which 127 are figure endpoints already in catalog.json.
    expect(brightToDeepLimit).toBe(904 + 127);
    expect(deep.size + brightToDeepLimit).toBe(8404);
    const bright = new Set(Array.from({ length: catalog.size }, (_, i) => `${String(Math.round((catalog.ra[i] ?? 0) * 100) % 36_000)} ${String(Math.round((catalog.dec[i] ?? 0) * 100))}`));
    // The fainter components of 14 doubles share their bright component's position to 0.01°: separate records, kept.
    const shared = json.ra.filter((ra, i) => bright.has(`${String(ra)} ${String(json.dec[i])}`));
    expect(shared).toHaveLength(14);
  });

  it(`is sorted by magnitude and spans ${String(STAR_MAG_LIMIT)} < V ≤ ${String(DEEP_MAG_LIMIT)} to 0.1`, () => {
    expect(json.mag[0]).toBe(46); // 4.51–4.54 written 4.6, never the bright limit itself
    expect(json.mag.at(-1)).toBe(65);
    for (let i = 1; i < deep.size; i += 1) expect(json.mag[i] ?? NaN).toBeGreaterThanOrEqual(json.mag[i - 1] ?? NaN);
    for (const m of deep.mag) {
      expect(m).toBeGreaterThan(STAR_MAG_LIMIT);
      expect(m).toBeLessThanOrEqual(DEEP_MAG_LIMIT);
    }
  });

  it('keeps positions in range to 0.01° and B−V to 0.1', () => {
    for (const ra of json.ra) expect(ra >= 0 && ra < 36_000).toBe(true);
    for (const dec of json.dec) expect(dec >= -9000 && dec <= 9000).toBe(true);
    for (const bv of json.bv) expect(bv >= -5 && bv <= 40).toBe(true);
    expect(deep.ra[0]).toBeCloseTo((json.ra[0] ?? NaN) / 100, 9);
    expect(deep.bv[0]).toBeCloseTo((json.bv[0] ?? NaN) / 10, 6);
  });

  it(`is at most ${String(45)} KB gzipped, under the stars-deep row's 60`, () => {
    expect(gzippedBytes(deepText)).toBeLessThanOrEqual(45 * 1024);
  });
});

/** R154 (FR-LOOK-3, D-973, D-977): the galactic plane's outline. */
describe('the Milky Way outline', () => {
  const mwText = readFileSync(new URL('../../src/data/stars/milkyWay.json', import.meta.url), 'utf8');
  const mw = JSON.parse(mwText) as { bands: [number, number][][] };

  it('is what the build writes, byte for byte', () => {
    expect(built.milkyWayText).toBe(mwText);
  });

  it('is three closed rings, outermost first, 366 points in all, at most 2 KB gzipped', () => {
    expect(Object.keys(mw)).toEqual(['bands']);
    expect(mw.bands).toHaveLength(MILKY_WAY_BANDS_DEG.length);
    const perEdge = 360 / MILKY_WAY_STEP_DEG + 1;
    for (const ring of mw.bands) expect(ring).toHaveLength(2 * perEdge);
    expect(mw.bands.flat()).toHaveLength(366);
    expect(gzippedBytes(mwText)).toBeLessThanOrEqual(2 * 1024);
    for (const [ra, dec] of mw.bands.flat()) {
      expect(ra >= 0 && ra < 360).toBe(true);
      expect(Math.abs(dec)).toBeLessThanOrEqual(90);
    }
  });

  it('converts from the IAU 1958 frame: the centre, the poles and the anticentre where they belong', () => {
    const centre = galacticToEquatorial(0, 0);
    expect(centre.raDeg).toBeCloseTo(266.405, 2);
    expect(centre.decDeg).toBeCloseTo(-28.936, 2);
    const pole = galacticToEquatorial(0, 90);
    expect(pole.raDeg).toBeCloseTo(192.859, 2);
    expect(pole.decDeg).toBeCloseTo(27.128, 2);
    const anticentre = galacticToEquatorial(180, 0);
    expect(anticentre.raDeg).toBeCloseTo(86.405, 2);
    expect(anticentre.decDeg).toBeCloseTo(28.936, 2);
    expect(galacticToEquatorial(GALACTIC_POLE.lNcpDeg, GALACTIC_POLE.decDeg).decDeg).toBeCloseTo(90, 3); // the celestial pole
  });

  it('widens each band toward the core and seams the ring at the anticentre', () => {
    const wide = buildMilkyWay([5]).bands[0] ?? [];
    const half = wide.length / 2;
    // The ring's first and last points are the anticentre's two edges; its middle edge points the core's.
    const first = wide[0] ?? [0, 0];
    const last = wide.at(-1) ?? [0, 0];
    const sep = (a: [number, number], b: [number, number]): number =>
      (Math.acos(Math.min(1, Math.sin((a[1] * Math.PI) / 180) * Math.sin((b[1] * Math.PI) / 180) + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.cos(((a[0] - b[0]) * Math.PI) / 180))) * 180) / Math.PI;
    const anticentreWidth = sep(first, last);
    const core = (half - 1) / 2; // l = 360°, half way along each edge
    const coreWidth = sep(wide[core] ?? [0, 0], wide[half + core] ?? [0, 0]);
    expect(anticentreWidth).toBeCloseTo(10, 0);
    expect(coreWidth).toBeCloseTo(10 + 2 * MILKY_WAY_CORE.widenDeg, 0);
  });
});

/** `names-es.tsv`'s rows, read here independently of the build: `kind key part es source`. */
const TSV = readFileSync(new URL('../../data-src/stars/names-es.tsv', import.meta.url), 'utf8');
const rows = TSV.split(/\r?\n/)
  .filter((l) => !l.startsWith('#') && l.trim() !== '')
  .map((l) => {
    const [kind = '', key = '', part = '', es = '', source = ''] = l.split('\t');
    return { kind, key, part, es, source };
  });
const starRows = rows.filter((r) => r.kind === 'star');
const conRows = rows.filter((r) => r.kind === 'con');

describe('the Spanish names (FR-STAR-10 as amended v2.5, D-832)', () => {
  it('names all 88 abbreviations and their 89 parts, Serpens whole too, from names-es.tsv alone', () => {
    const json = JSON.parse(text) as { figuresEs: Record<string, string[]>; wholeEs: Record<string, string> };
    expect(Object.keys(json.figuresEs)).toEqual(Object.keys(CONSTELLATION_NAMES));
    expect(Object.values(json.figuresEs).flat()).toHaveLength(89);
    for (const [con, latin] of Object.entries(CONSTELLATION_NAMES)) {
      expect(json.figuresEs[con], con).toHaveLength(latin.length);
      latin.forEach((_, p) => {
        const row = conRows.find((r) => r.key === con && r.part === String(p));
        expect(row?.es, `${con} ${String(p)}`).toBeTruthy();
        expect(json.figuresEs[con]?.[p]).toBe(row?.es);
      });
    }
    expect(json.wholeEs).toEqual(Object.fromEntries(conRows.filter((r) => r.part === 'all').map((r) => [r.key, r.es])));
    expect(json.wholeEs).toEqual({ Ser: 'Serpiente' });
    expect(conRows).toHaveLength(90);
    for (const f of catalog.figures) expect(figureName(catalog, f.con, f.part, 'es'), `${f.con} ${String(f.part)}`).toBeTruthy();
  });

  it('gives every named star a sourced row, sixteen of them a Spanish form and the rest their IAU name (FR-NAME-1)', () => {
    expect(starRows).toHaveLength(289);
    expect(new Set(starRows.map((r) => r.key))).toEqual(new Set(catalog.name.filter((n) => n !== '')));
    const heads = new Set([...TSV.matchAll(/^# source ([a-z][a-z0-9-]*):/gm)].map((m) => m[1]));
    for (const r of rows) expect(heads, `${r.kind} ${r.key}`).toContain(r.source);
    for (const r of starRows) {
      const i = catalog.name.indexOf(r.key);
      expect(i, r.key).toBeGreaterThanOrEqual(0);
      expect(catalog.nameEs[i], r.key).toBe(r.es === '=' ? '' : r.es);
    }
    const fromFile = new Map(starRows.filter((r) => r.es !== '=').map((r) => [r.key, r.es]));
    catalog.nameEs.forEach((es, i) => {
      expect(es, catalog.name[i]).toBe(fromFile.get(catalog.name[i] ?? '') ?? '');
    });
    expect(catalog.nameEs.filter((n) => n !== '')).toHaveLength(16);
  });

  it('labels the 33 unnamed stars brighter than mag 3 by their designation, Bayer letters in Greek (FR-NAME-2)', () => {
    const labels = Array.from(catalog.mag).flatMap((m, i) => (m < 3 && catalog.name[i] === '' ? [catalog.desig[i]] : []));
    expect(labels).toHaveLength(33);
    expect(labels).toContain('γ² Vel');
    expect(labels).toContain('ε Leo');
    for (const d of catalog.desig) expect(d, d).toMatch(/^([α-ω][¹²³⁴⁵⁶⁷⁸⁹]* |\d+ |HR \d+$)/);
    const nameless = catalog.name.indexOf('');
    expect(starName(catalog, nameless, 'es')).toBe(starName(catalog, nameless, 'en'));
  });

  it('FR-NAME-2: starLabelKind labels exactly these 33 by designation, brightest first, at any field', () => {
    const byRule = (nameMag: number) => Array.from(catalog.mag).flatMap((_, i) => (starLabelKind(catalog, i, nameMag) === 'designation' ? [catalog.desig[i]] : []));
    // HR 5958 is T CrB: the Yale record has no Bayer or Flamsteed letter and carries the 1946 outburst's magnitude.
    const pinned = ['α² Cru', 'γ² Vel', 'HR 5958', 'γ Cen', 'ε Cen', 'α Lup', 'η Cen', 'κ Sco', 'γ Cas', 'ζ Cen', 'ζ Oph', 'δ Cen', 'β Lup', 'μ Vel', 'α Mus', 'π Pup', 'ι Cen', 'θ Car', 'γ Lup', 'β Hyi', 'ζ Her', 'ζ Per', 'β TrA', 'β Ara', 'α Hyi', 'α Tuc', 'α Gem', 'ε Per', 'γ TrA', 'γ Per', 'τ Pup', 'α Ara', 'ε Leo'];
    expect(pinned).toHaveLength(33);
    expect(byRule(1.5)).toEqual(pinned);
    expect(byRule(3.2)).toEqual(pinned);
    expect(BAYER_LABEL_MAG).toBe(3);
    // A proper name stops at the field's row; nothing past the rule is labelled.
    const sirius = catalog.name.indexOf('Sirius');
    expect(starLabelKind(catalog, sirius, 1.5)).toBe('proper');
    const faintNamed = Array.from(catalog.mag).findIndex((m, i) => catalog.name[i] !== '' && m > 2);
    expect(starLabelKind(catalog, faintNamed, 1.5)).toBeNull();
    expect(starLabelKind(catalog, faintNamed, 3.2)).toBe((catalog.mag[faintNamed] ?? 9) <= 3.2 ? 'proper' : null);
    const faintNameless = Array.from(catalog.mag).findIndex((m, i) => catalog.name[i] === '' && m >= 3);
    expect(starLabelKind(catalog, faintNameless, 6.5)).toBeNull();
  });

  it('reads a name only through starName, figureName and constellationName, in the active language', () => {
    const sirius = catalog.name.indexOf('Sirius');
    expect([starName(catalog, sirius, 'en'), starName(catalog, sirius, 'es')]).toEqual(['Sirius', 'Sirio']);
    const betelgeuse = catalog.name.indexOf('Betelgeuse');
    expect([starName(catalog, betelgeuse, 'en'), starName(catalog, betelgeuse, 'es')]).toEqual(['Betelgeuse', 'Betelgeuse']);
    const nameless = catalog.name.indexOf('');
    expect(starName(catalog, nameless, 'es')).toBe(catalog.desig[nameless]);
    expect(starName(catalog, nameless, 'en')).toBe(catalog.desig[nameless]);
    expect([figureName(catalog, 'Ori', 0, 'en'), figureName(catalog, 'Ori', 0, 'es')]).toEqual(['Orion', 'Orión']);
    expect([figureName(catalog, 'Ser', 1, 'en'), figureName(catalog, 'Ser', 1, 'es')]).toEqual(['Serpens Cauda', 'Cola de la Serpiente']);
    expect([constellationName(catalog, 'Ser', 'en'), constellationName(catalog, 'Ser', 'es')]).toEqual(['Serpens', 'Serpiente']);
    expect([constellationName(catalog, 'CMa', 'en'), constellationName(catalog, 'CMa', 'es')]).toEqual(['Canis Major', 'Can Mayor']);
    expect(figureName(catalog, 'Ori', 1, 'es')).toBeUndefined();
    expect(constellationName(catalog, 'Xyz', 'es')).toBeUndefined();
    expect(constellationName(catalog, 'toString', 'en')).toBeUndefined();
  });

  it('fails the build on an unknown key, a missing part, a duplicate or a malformed row', () => {
    const names = ['Sirius', 'Canopus'];
    const fail = (tsv: string) => () => parseNamesEs(tsv, names);
    const base = TSV.split(/\r?\n/).filter((l) => !l.startsWith('star') && !(l.startsWith('# ') && !l.startsWith('# source')));
    const ok = [...base, 'star\tSirius\t\tSirio\teswiki', 'star\tCanopus\t\t=\teswiki'].join('\n');
    expect(() => parseNamesEs(ok, names)).not.toThrow();
    expect(parseNamesEs(ok, names).stars).toEqual(new Map([['Sirius', 'Sirio']]));
    expect(fail(`${ok}\nstar\tVega\t\tVega\teswiki`)).toThrow(/Vega is not a name the catalogue carries/);
    expect(fail(ok.replace('star\tCanopus\t\t=\teswiki', ''))).toThrow(/Canopus has no row/);
    expect(fail(`${ok}\ncon\tXyz\t0\tEquis\tconst`)).toThrow(/Xyz is not one of the 88/);
    expect(fail(`${ok}\ncon\tOri\t1\tOrión\tconst`)).toThrow(/Ori has no part 1/);
    expect(fail(`${ok}\ncon\tOri\tall\tOrión\tconst`)).toThrow(/Ori is drawn in one part/);
    expect(fail(`${ok}\ncon\tOri\t0\tOrión\tconst`)).toThrow(/duplicate row con Ori 0/);
    expect(fail(`${ok}\nstar\tSirius\t\tSirio\teswiki`)).toThrow(/duplicate row star Sirius/);
    expect(fail(`${ok}\ncon\tSer\t01\tCola\tconst`)).toThrow(/duplicate row con Ser 1/);
    expect(fail(ok.replace('con\tOri\t0\tOrión\tconst\n', ''))).toThrow(/Ori part 0 has no row/);
    expect(fail(ok.replace('con\tSer\tall\tSerpiente\tconst\n', ''))).toThrow(/Ser has no whole row/);
    expect(fail(`${ok}\nname\tSirius\t\tSirio\teswiki`)).toThrow(/unknown kind name/);
    expect(fail(`${ok}\nstar\tSirius\t\t\teswiki`)).toThrow(/five fields and a name/);
    expect(fail(`${ok}\nstar\tSirius\t\tSirio\teswiki\textra`)).toThrow(/five fields and a name/);
    expect(fail(ok.replace('Sirio\teswiki', 'Sirio\twiki'))).toThrow(/source wiki is not listed in the head/);
    expect(fail(ok.replace('Sirio\teswiki', 'Sirio'))).toThrow(/source \(none\) is not listed/);
    expect(fail(`${ok}\ncon\tOri\t0\t=\tconst`.replace('con\tOri\t0\tOrión\tconst\n', ''))).toThrow(/a constellation row names its Spanish form/);
  });

  it('reads a CRLF checkout of names-es.tsv as the LF one', () => {
    const names = ['Sirius', 'Canopus'];
    const lf = [...TSV.split(/\r?\n/).filter((l) => !l.startsWith('star') || l.includes('\tSirius\t')), 'star\tCanopus\t\t=\teswiki'].join('\n');
    const crlf = parseNamesEs(lf.replaceAll('\n', '\r\n'), names);
    expect(crlf).toEqual(parseNamesEs(lf, names));
    expect(crlf.stars.get('Sirius')).toBe('Sirio');
    expect(crlf.figures.Ori).toEqual(['Orión']);
  });

  it('refuses a catalog.json whose Spanish tables do not name what the English ones do', () => {
    const json = JSON.parse(text) as { figuresEs: Record<string, unknown>; wholeEs: Record<string, unknown> };
    const broken = (edit: (j: typeof json) => void) => () => {
      const j = structuredClone(json);
      edit(j);
      return parseStarCatalog(j);
    };
    expect(broken(() => undefined)).not.toThrow();
    expect(broken((j) => (j.figuresEs.Ori = [7]))).toThrow(/an array of names/);
    expect(broken((j) => (j.figuresEs.Ori = ['']))).toThrow(/an array of names/);
    expect(broken((j) => delete j.figuresEs.Ori)).toThrow(/figuresEs names every part/);
    expect(broken((j) => (j.figuresEs.Ser = ['Cabeza de la Serpiente']))).toThrow(/figuresEs names every part/);
    expect(broken((j) => (j.figuresEs.Xyz = ['Equis']))).toThrow(/figuresEs names every part/);
    expect(broken((j) => (j.wholeEs = {}))).toThrow(/wholeEs names every whole/);
  });

  it('builds the catalogue through the same check: a star row against a catalogue without the star fails', () => {
    expect(() => buildCatalog('', '', '{"features":[]}', TSV)).toThrow(/Sirius is not a name the catalogue carries/);
  });
});

describe("the catalogue's sources in public/third-party-notices.txt (FR-STAR-1, D-748)", () => {
  const notices = readFileSync(new URL('../../public/third-party-notices.txt', import.meta.url), 'utf8');

  it('credits all three after the packages, each under the data rule', () => {
    const data = notices.slice(notices.indexOf(`${DATA_RULE}\nDATA\n`));
    expect(data.length).toBeLessThan(notices.length);
    for (const entry of dataNotices()) {
      expect(data, entry.name).toContain(`${DATA_RULE}\n${entry.name}\nLicence: ${entry.license}\n`);
      expect(data, entry.name).toContain(entry.text);
    }
  });

  it("quotes d3-celestial's licence verbatim from the file vendored beside the figures", () => {
    expect(notices).toContain(readFileSync(new URL('../../data-src/stars/d3-celestial-LICENSE.txt', import.meta.url), 'utf8').trim());
  });
});
