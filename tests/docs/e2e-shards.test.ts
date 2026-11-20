/**
 * v2.16 (FR-CI-5, D-1216): the e2e shards are cut by time. `splitSpecs` is pure; the table is the
 * committed `tests/e2e/durations.json`. The test sits here, not beside the script, because Vitest's
 * `node` project reads `tests/**` and not `scripts/**` (D-1187, D-1220).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { durationsFromReports, median, specKey, splitSpecs } from '../../scripts/e2e-shards';

const seconds = (shard: string[], table: Record<string, number>, fallback = median(table)): number => shard.reduce((sum, spec) => sum + (table[spec] ?? fallback), 0);

describe('splitSpecs (FR-CI-5)', () => {
  const table = { 'a.spec.ts': 100, 'b.spec.ts': 60, 'c.spec.ts': 50, 'd.spec.ts': 40, 'e.spec.ts': 30, 'f.spec.ts': 20 };

  it('puts the longest first into the shard with the fewest seconds', () => {
    const shards = splitSpecs(Object.keys(table).reverse(), table, 2);
    expect(shards).toEqual([
      ['a.spec.ts', 'd.spec.ts', 'f.spec.ts'],
      ['b.spec.ts', 'c.spec.ts', 'e.spec.ts'],
    ]);
    // a, b, c on b's 60, d on a's 100, e on 110, and f on the tie at 140 to the shard with fewer specs.
    expect(shards.map((shard) => seconds(shard, table))).toEqual([160, 140]);
  });

  it('runs every spec once, whatever the count, and the same cut for the same input', () => {
    const specs = Object.keys(table);
    for (const n of [1, 2, 3, 4]) {
      const shards = splitSpecs(specs, table, n);
      expect(shards).toHaveLength(n);
      expect(shards.flat().sort()).toEqual([...specs].sort());
      expect(splitSpecs([...specs].reverse(), table, n)).toEqual(shards);
    }
  });

  it('counts a spec missing from the table as the table\'s median', () => {
    expect(median(table)).toBe(45);
    expect(median({ x: 1, y: 3, z: 10 })).toBe(3);
    expect(median({})).toBe(0);
    // `new` weighs 45, so it follows b (60) and comes before d (40): a, b, then the lighter shard each time.
    const shards = splitSpecs(['a.spec.ts', 'b.spec.ts', 'd.spec.ts', 'new.spec.ts'], table, 2);
    expect(shards).toEqual([
      ['a.spec.ts', 'd.spec.ts'],
      ['b.spec.ts', 'new.spec.ts'],
    ]);
    expect(shards.map((shard) => seconds(shard, table))).toEqual([140, 105]);
  });

  it('leaves the shards past the number of specs empty', () => {
    expect(splitSpecs(['a.spec.ts', 'b.spec.ts'], table, 4)).toEqual([['a.spec.ts'], ['b.spec.ts'], [], []]);
    expect(splitSpecs([], table, 3)).toEqual([[], [], []]);
  });

  it('spreads specs the table does not know by count, when every weight is equal', () => {
    expect(splitSpecs(['p', 'q', 'r', 's'], {}, 2)).toEqual([
      ['p', 'r'],
      ['q', 's'],
    ]);
  });

  it('refuses a shard count below one', () => {
    expect(() => splitSpecs(['a.spec.ts'], table, 0)).toThrow();
  });
});

describe('the duration table (D-1216)', () => {
  it('reads seconds per spec from Playwright JSON reports, retries and every shard summed', () => {
    const report = (file: string, ...durations: number[][]) => ({
      suites: [{ file, specs: [], suites: [{ file, specs: durations.map((results) => ({ file, tests: [{ results: results.map((duration) => ({ duration })) }] })) }] }],
    });
    const table = durationsFromReports([report('b.spec.ts', [1200, 800], [500]), report('a.spec.ts', [250]), report('b.spec.ts', [1000]), { suites: [{ file: 'skip.spec.ts', specs: [{ file: 'skip.spec.ts', tests: [{ results: [] }] }] }] }]);
    expect(table).toEqual({ 'a.spec.ts': 0.3, 'b.spec.ts': 3.5, 'skip.spec.ts': 0 });
    expect(Object.keys(table)).toEqual(['a.spec.ts', 'b.spec.ts', 'skip.spec.ts']);
  });

  it('names a spec by its path under tests/e2e, as the selection hands it over', () => {
    expect(specKey('tests/e2e/home.spec.ts')).toBe('home.spec.ts');
    expect(specKey('./tests/e2e/home.spec.ts')).toBe('home.spec.ts');
    expect(specKey('home.spec.ts')).toBe('home.spec.ts');
  });

  it('is committed as a flat map of spec files to seconds', () => {
    const table = JSON.parse(readFileSync('tests/e2e/durations.json', 'utf8')) as Record<string, unknown>;
    expect(Object.keys(table).length).toBeGreaterThan(0);
    for (const [spec, value] of Object.entries(table)) {
      expect(spec).toMatch(/^[\w.-]+\.spec\.ts$/);
      expect(typeof value === 'number' && value >= 0, spec).toBe(true);
    }
  });
});
