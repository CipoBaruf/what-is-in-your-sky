import { describe, expect, it } from 'vitest';
import reference from '../../tests/fixtures/rise-set-horizons.json';
import { starCatalog as loadStars } from '../data/stars/catalog';
import { bodyRiseSet, nightOf, starRiseSet, type RiseSet, type RiseSetBody } from './riseSet';

const { observer, toleranceMin } = reference;
/** 2026-01-15 21:00 ART: inside the fixture's night. */
const T = Date.parse('2026-01-16T00:00Z');
const MIN = 60_000;
const starCatalog = loadStars();

function starIndex(name: string): number {
  const i = starCatalog.name.indexOf(name);
  if (i < 0) throw new Error(`no star ${name}`);
  return i;
}

function expectNear(got: RiseSet, rise: string, set: string): void {
  if (got.kind !== 'crosses') throw new Error(`expected crossings, got ${got.kind}`);
  expect(Math.abs((got.rise ?? NaN) - Date.parse(rise)) / MIN).toBeLessThanOrEqual(toleranceMin);
  expect(Math.abs((got.set ?? NaN) - Date.parse(set)) / MIN).toBeLessThanOrEqual(toleranceMin);
}

describe('nightOf', () => {
  it('FR-FACT-3: runs local mean noon to noon, so an evening set and a dawn rise share a night', () => {
    const { from, to } = nightOf(observer.lon, T);
    expect(from).toBeLessThanOrEqual(T);
    expect(to - from).toBe(86_400_000);
    // Bariloche at −71.3°: noon is near 16:45Z.
    expect(new Date(from).toISOString().slice(0, 16)).toBe('2026-01-15T16:45');
  });
});

describe('starRiseSet', () => {
  it('FR-FACT-3: Sirius over Bariloche against the US Naval Observatory, within ±2 min', () => {
    const body = reference.bodies.find((b) => b.name === 'Sirius');
    if (!body) throw new Error('fixture has no Sirius');
    const i = starIndex('Sirius');
    expectNear(starRiseSet(starCatalog.ra[i] ?? NaN, starCatalog.dec[i] ?? NaN, observer, T), body.rise, body.set);
  });

  it('FR-FACT-3: a circumpolar star never sets, and a star below the pole never rises', () => {
    const achernar = starIndex('Achernar'); // δ −57°: circumpolar at −41°
    expect(starRiseSet(starCatalog.ra[achernar] ?? NaN, starCatalog.dec[achernar] ?? NaN, observer, T)).toEqual({ kind: 'never-sets' });
    const dubhe = starIndex('Dubhe'); // δ +62°: never above Bariloche
    expect(starRiseSet(starCatalog.ra[dubhe] ?? NaN, starCatalog.dec[dubhe] ?? NaN, observer, T)).toEqual({ kind: 'never-rises' });
  });

  it('FR-FACT-3: the times fall inside the night that holds t', () => {
    const i = starIndex('Sirius');
    const got = starRiseSet(starCatalog.ra[i] ?? NaN, starCatalog.dec[i] ?? NaN, observer, T + 10 * 3_600_000);
    const { from, to } = nightOf(observer.lon, T);
    if (got.kind !== 'crosses') throw new Error(got.kind);
    for (const ms of [got.rise, got.set]) expect(ms !== null && ms >= from && ms < to).toBe(true);
  });
});

describe('bodyRiseSet', () => {
  it.each(['Jupiter', 'Moon'] as const)('FR-FACT-3: %s over Bariloche against JPL Horizons, within ±2 min', (name: RiseSetBody) => {
    const body = reference.bodies.find((b) => b.name === name);
    if (!body) throw new Error(`fixture has no ${name}`);
    expectNear(bodyRiseSet(name, observer, T), body.rise, body.set);
  });

  it('FR-FACT-3: a body that stays on one side of the horizon all night never sets or never rises', () => {
    // At 89° the Moon's altitude barely changes in a day: one side of the horizon all night.
    const pole = { lat: 89.9, lon: 0 };
    const got = bodyRiseSet('Moon', pole, T);
    expect(['never-sets', 'never-rises']).toContain(got.kind);
  });
});
