/** D-1025 (FR-LOC-1 (c) as amended 2026-11-02): the town nearest a device fix, from the committed GeoNames list. */
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { greatCircleKm, nearestPlace, NEAR_PLACE_MAX_KM, parsePlaces } from './nearestPlace';

const text = readFileSync(new URL('./places.txt', import.meta.url), 'utf8');
const places = parsePlaces(text);

describe('places.txt', () => {
  it('is GeoNames cities15000 with its source and date on the first line, under 300 KB gzipped', () => {
    expect(text.split('\n')[0]).toMatch(/^# GeoNames cities15000 \(https:\/\/download\.geonames\.org\/export\/dump\/cities15000\.zip\), \d{4}-\d{2}-\d{2}, CC BY 4\.0/);
    expect(places.size).toBeGreaterThan(30_000);
    expect(gzipSync(text, { level: 9 }).length).toBeLessThan(300 * 1024);
  });
});

describe('nearestPlace', () => {
  it('names Cipolletti for a fix between it and Neuquén', () => {
    const near = nearestPlace(places, -38.94, -68.0);
    expect(near).toMatchObject({ name: 'Cipolletti', country: 'AR' });
    expect(near?.km).toBeLessThan(3);
  });

  it('names Neuquén for a fix in its centre', () => {
    expect(nearestPlace(places, -38.951, -68.059)).toMatchObject({ name: 'Neuquén', country: 'AR' });
  });

  it('names Berlin for a fix at the Brandenburg Gate', () => {
    expect(nearestPlace(places, 52.5163, 13.3777)).toMatchObject({ name: 'Berlin', country: 'DE' });
  });

  it('names nothing in mid-ocean', () => {
    expect(nearestPlace(places, 0, -30)).toBeNull();
    expect(nearestPlace(places, -45, -120)).toBeNull();
  });

  it(`names nothing farther than ${String(NEAR_PLACE_MAX_KM)} km`, () => {
    const one = parsePlaces('=XX\nTown\t0\t0\n');
    expect(nearestPlace(one, 0.4, 0)).toMatchObject({ name: 'Town', country: 'XX' }); // 44 km
    expect(nearestPlace(one, 0.5, 0)).toBeNull(); // 56 km
  });

  it('finds a town across the antimeridian and near a pole', () => {
    const list = parsePlaces('=FJ\nEast\t-1700\t17990\n=AQ\nPole\t-8990\t0\n');
    expect(nearestPlace(list, -17, -179.9)).toMatchObject({ name: 'East', country: 'FJ' });
    expect(nearestPlace(list, -89.95, 120)).toMatchObject({ name: 'Pole', country: 'AQ' });
  });

  it('agrees with a scan of every town', () => {
    for (const [lat, lon] of [
      [-34.6, -58.38],
      [40.42, -3.7],
      [35.68, 139.69],
      [64.15, -21.94],
      [-33.87, 151.21],
    ] as const) {
      let best = Infinity;
      for (let i = 0; i < places.size; i++) best = Math.min(best, greatCircleKm(lat, lon, (places.lat[i] ?? 0) / 100, (places.lon[i] ?? 0) / 100));
      expect(nearestPlace(places, lat, lon)?.km).toBeCloseTo(best, 9);
    }
  });
});

describe('parsePlaces', () => {
  it('reads countries and running differences, skipping the comment line', () => {
    const list = parsePlaces('# head\n=AR\nA\t-3893\t-6799\nB\t-2\t-7\n=DE\nC\t5252\t1340\n');
    expect(list.names).toEqual(['A', 'B', 'C']);
    expect([...list.lat]).toEqual([-3893, -3895, 5252]);
    expect([...list.lon]).toEqual([-6799, -6806, 1340]);
    expect([...list.country].map((c) => list.countries[c])).toEqual(['AR', 'AR', 'DE']);
  });

  it('throws on a line outside a country or with no numbers', () => {
    expect(() => parsePlaces('A\t1\t2\n')).toThrow();
    expect(() => parsePlaces('=AR\nA\tx\t2\n')).toThrow();
  });
});
