import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildStars, gzippedBytes, SNAP_MAX_DEG } from '../../scripts/build-stars';
import { DATA_RULE, dataNotices } from '../../scripts/third-party-notices';
import { parseStarCatalog, starCatalog } from '../../src/data/stars/catalog';
import { CONSTELLATION_NAMES, figureName } from '../../src/data/stars/constellations';
import { STAR_MAG_LIMIT } from '../../src/data/stars/constants';

/**
 * R112, FR-STAR-1, FR-STAR-10 (as amended, V24-20), D-748: the committed
 * catalogue — its counts (D-745), its ids, its names, the figure-name table,
 * its size, and that it is exactly what `npm run build:stars` writes from
 * `data-src/stars/`.
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
    for (const column of [catalog.ra, catalog.dec, catalog.mag, catalog.name, catalog.desig, catalog.con]) expect(column).toHaveLength(catalog.size);
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
    expect(named).toHaveLength(287);
    expect(new Set(named).size).toBe(named.length);
    for (const n of named) expect(n.trim()).toBe(n);
    for (const n of named) expect(n.length).toBeGreaterThan(0);
    expect(catalog.name).toContain('Polaris');
    expect(catalog.name).toContain('Acrux');
  });

  it('has a Latin name for every drawn feature: 88 constellations, 89 names, Serpens in two', () => {
    expect(Object.keys(CONSTELLATION_NAMES)).toHaveLength(88);
    expect(Object.values(CONSTELLATION_NAMES).flat()).toHaveLength(89);
    for (const f of catalog.figures) expect(figureName(f.con, f.part), `${f.con} ${String(f.part)}`).toBeTruthy();
    expect(new Set(catalog.figures.map((f) => `${f.con} ${String(f.part)}`)).size).toBe(89);
    expect(new Set(catalog.figures.map((f) => f.con)).size).toBe(88);
    expect(catalog.figures.filter((f) => f.con === 'Ser').map((f) => figureName(f.con, f.part))).toEqual(['Serpens Caput', 'Serpens Cauda']);
    expect(figureName('Ori')).toBe('Orion');
    expect(figureName('Xyz')).toBeUndefined();
    expect(figureName('toString')).toBeUndefined();
  });

  it("puts every star in one of the table's constellations", () => {
    for (const con of catalog.con) expect(figureName(con), con).toBeTruthy();
  });

  it('is at most 22 KB gzipped', () => {
    expect(gzippedBytes(text)).toBeLessThanOrEqual(22 * 1024);
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
