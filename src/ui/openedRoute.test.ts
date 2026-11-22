/** FR-MEAS-2: `open`'s detail is the route the load opened on, one of the table's four; no hash is the live page (FR-LAND-1). */
import { describe, expect, it } from 'vitest';
import { openedRoute } from './openedRoute';

describe('openedRoute (FR-MEAS-2: open)', () => {
  it.each([
    ['', 'live'],
    ['#', 'live'],
    ['#what', 'live'],
    ['#settings', 'settings'],
    ['#stars', 'stars'],
    ['#live', 'live'],
    ['#live?lat=51.5&lon=-0.12&alt=0', 'live'],
    ['#live?lat=999', 'live'],
    ['#pass', 'pass'],
    ['#pass=25544-1789120094063', 'pass'],
    ['#pass?lat=51.5&lon=-0.12&norad=25544&start=2026-09-01T20:00:00Z', 'pass'],
    ['#pass?lat=999', 'live'],
  ])('%j opens %s', (hash, route) => {
    expect(openedRoute(hash)).toBe(route);
  });
});
