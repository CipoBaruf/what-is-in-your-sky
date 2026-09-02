/**
 * TASKS R3 "Done when" for the catalog: every entry validates, NORAD ids are
 * unique, exactly one entry is featured, provenance is complete, the size is
 * 25–35, and every id exists in the R1 OMM fixtures (`visual` ∪ `stations`).
 */
import { describe, expect, it } from 'vitest';
import { loadOmmFixture } from '../../../tests/setup/msw';
import catalogJson from './catalog.json';
import { CATALOG, catalogEntrySchema, catalogSchema } from './index';
import { toCatalogEntry } from './schema';

describe('catalog.json', () => {
  it('validates every entry against the schema', () => {
    for (const entry of catalogJson) expect(catalogEntrySchema.safeParse(entry).success, JSON.stringify(entry)).toBe(true);
    expect(catalogSchema.safeParse(catalogJson).success).toBe(true);
  });

  it('has 25–35 entries (FR-SAT-1)', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(25);
    expect(CATALOG.length).toBeLessThanOrEqual(35);
  });

  it('has unique NORAD ids', () => {
    const ids = CATALOG.map((e) => e.noradId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('features exactly one entry, the ISS (spec §8 rank 1)', () => {
    const featured = CATALOG.filter((e) => e.featured);
    expect(featured).toHaveLength(1);
    expect(featured[0]?.noradId).toBe(25544);
  });

  it('records a non-empty source and an ISO date for every stdMag (FR-SAT-5)', () => {
    for (const e of CATALOG) {
      expect(e.stdMagSource.source.trim().length, e.name).toBeGreaterThan(0);
      expect(e.stdMagSource.date, e.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(e.stdMagSource.date)), e.name).toBe(false);
    }
  });

  it('only lists objects present in the R1 OMM fixtures', () => {
    const present = new Set([...loadOmmFixture('visual'), ...loadOmmFixture('stations')].map((r) => r.NORAD_CAT_ID));
    const missing = CATALOG.filter((e) => !present.has(e.noradId)).map((e) => `${String(e.noradId)} ${e.name}`);
    expect(missing).toEqual([]);
  });
});

describe('catalogSchema', () => {
  const base = CATALOG.map((e) => ({ ...e }));

  it('rejects duplicate ids', () => {
    const dup = [...base, { ...base[1], featured: undefined }];
    const result = catalogSchema.safeParse(dup);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/duplicate noradId/);
  });

  it('rejects zero or two featured entries', () => {
    const none = base.map((e) => ({ ...e, featured: undefined }));
    expect(catalogSchema.safeParse(none).success).toBe(false);
    const two = base.map((e, i) => (i < 2 ? { ...e, featured: true as const } : e));
    expect(catalogSchema.safeParse(two).success).toBe(false);
  });

  it('rejects a missing provenance date and a bad category', () => {
    expect(catalogEntrySchema.safeParse({ ...base[0], stdMagSource: { source: 'x' } }).success).toBe(false);
    expect(catalogEntrySchema.safeParse({ ...base[0], stdMagSource: { source: 'x', date: 'yesterday' } }).success).toBe(false);
    expect(catalogEntrySchema.safeParse({ ...base[0], category: 'debris' }).success).toBe(false);
  });

  it('strips undefined optionals so entries satisfy exactOptionalPropertyTypes', () => {
    const entry = toCatalogEntry(catalogEntrySchema.parse({ noradId: 1, name: 'x', category: 'payload', stdMag: 3, stdMagSource: { source: 's', date: '2020-01-01' } }));
    expect(entry).toEqual({ noradId: 1, name: 'x', category: 'payload', stdMag: 3, stdMagSource: { source: 's', date: '2020-01-01' } });
    expect(entry).not.toHaveProperty('note');
    expect(entry).not.toHaveProperty('description');
    expect(entry).not.toHaveProperty('featured');
  });
});
