import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadZoneCity, parseZones, zoneCity } from './zoneCity';

// FR-OPEN-1 (D-1174): the committed table, as the app loads it.
const zones = parseZones(readFileSync(new URL('./zones.txt', import.meta.url), 'utf8'));

describe('zoneCity (FR-OPEN-1)', () => {
  it('FR-OPEN-1: a canonical zone names its city at its coordinates', () => {
    expect(zoneCity('Europe/Paris', zones)).toEqual({ name: 'Paris', lat: 48.87, lon: 2.33 });
  });

  it('FR-OPEN-1, V216-15: a merged zone keeps its own city', () => {
    expect(zoneCity('Europe/Stockholm', zones)).toEqual({ name: 'Stockholm', lat: 59.33, lon: 18.05 });
    expect(zoneCity('Atlantic/Reykjavik', zones)?.name).toBe('Reykjavík');
  });

  it('FR-OPEN-1: an alias resolves to its target', () => {
    expect(zoneCity('Asia/Calcutta', zones)).toEqual(zoneCity('Asia/Kolkata', zones));
    expect(zoneCity('Asia/Calcutta', zones)?.name).toBe('Kolkata');
  });

  it('FR-OPEN-1: no zone, UTC, Etc/ and an unknown name are no city', () => {
    for (const zone of ['Etc/UTC', 'Etc/GMT+3', 'UTC', 'Mars/Olympus_Mons', '', undefined, null]) expect(zoneCity(zone, zones)).toBeNull();
  });

  it('FR-OPEN-1, V216-18: the name is a town’s spelling, or the last part with spaces', () => {
    expect(zoneCity('America/Sao_Paulo', zones)?.name).toBe('São Paulo');
    expect(zoneCity('America/Argentina/Buenos_Aires', zones)?.name).toBe('Buenos Aires');
    expect(zoneCity('Antarctica/Casey', zones)?.name).toBe('Casey');
  });

  it('an alias resolves once, never in a chain', () => {
    const chained = parseZones('Europe/Berlin\t5250\t1337\n=B\tEurope/Berlin\n=A\tB\n');
    expect(zoneCity('B', chained)?.name).toBe('Berlin');
    expect(zoneCity('A', chained)).toBeNull();
  });

  it('throws on a malformed line', () => {
    expect(() => parseZones('Europe/Paris\tx\t1\n')).toThrow();
    expect(() => parseZones('=Asia/Calcutta\n')).toThrow();
  });

  it('loadZoneCity reads the given zone from the table', async () => {
    expect((await loadZoneCity('Europe/Stockholm'))?.name).toBe('Stockholm');
    expect(await loadZoneCity('UTC')).toBeNull();
  });
});
