import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CELESTRAK_GP, loadOmmFixture, server } from '../../tests/setup/msw';
import { memoryCache } from '../../tests/support/elementsCache';
import type { CatalogEntry, OmmRecord } from '../model';
import { CATALOG } from './catalog';
import { ELEMENTS_TTL_MS } from './elementsCache';
import { filterToCatalog, loadElements, mergeGroups } from './elementsLoader';

const T0 = Date.parse('2026-09-02T12:00:00Z');
/** A fresh, empty, memory-only cache at a fixed clock: every test starts with nothing cached. */
const cache = () => memoryCache(() => T0);

const entry = (noradId: number, name = `object ${String(noradId)}`): CatalogEntry => ({
  noradId,
  name,
  category: 'payload',
  stdMag: 3,
  stdMagSource: { source: 'test', date: '2026-09-02' },
});

describe('mergeGroups', () => {
  it('lets stations win on duplicate ids', () => {
    const [iss] = loadOmmFixture('stations').filter((r) => r.NORAD_CAT_ID === 25544);
    if (!iss) throw new Error('fixture has no ISS');
    const visualIss: OmmRecord = { ...iss, OBJECT_NAME: 'ISS (VISUAL COPY)', ELEMENT_SET_NO: 1 };
    const merged = mergeGroups({ stations: [iss], visual: [visualIss] });
    expect(merged.size).toBe(1);
    expect(merged.get(25544)?.OBJECT_NAME).toBe('ISS (ZARYA)');
  });

  it('keeps records that appear in only one group', () => {
    const merged = mergeGroups({ stations: loadOmmFixture('stations'), visual: loadOmmFixture('visual') });
    const union = new Set([...loadOmmFixture('stations'), ...loadOmmFixture('visual')].map((r) => r.NORAD_CAT_ID));
    expect(merged.size).toBe(union.size);
  });
});

describe('filterToCatalog', () => {
  it('reports ids absent from both groups in `unavailable` and keeps catalog order', () => {
    const merged = mergeGroups({ stations: loadOmmFixture('stations'), visual: loadOmmFixture('visual') });
    const catalog = [entry(20580, 'HST'), entry(999999, 'ghost'), entry(25544, 'ISS')];
    const { records, unavailable } = filterToCatalog(catalog, merged);
    expect(records.map((r) => r.catalog.name)).toEqual(['HST', 'ISS']);
    expect(unavailable).toEqual([999999]);
  });

  it('parses the OMM epoch into epochMs on every record (FR-SAT-4)', () => {
    const merged = mergeGroups({ stations: loadOmmFixture('stations'), visual: [] });
    const { records } = filterToCatalog([entry(25544)], merged);
    expect(records[0]?.epochMs).toBe(Date.parse('2026-09-01T19:42:22.677Z'));
  });
});

describe('loadElements', () => {
  it('fetches both groups once each, never with CATNR, and resolves the whole catalog from the fixtures', async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = (input, init) => {
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
      return fetch(input, init);
    };
    const warn = vi.fn();
    const loaded = await loadElements(CATALOG, { fetchImpl, warn, cache: cache() });
    expect(urls).toHaveLength(2);
    expect(urls.map((u) => new URL(u).searchParams.get('GROUP')).sort()).toEqual(['stations', 'visual']);
    for (const u of urls) expect(new URL(u).searchParams.has('CATNR')).toBe(false);
    expect(loaded.records).toHaveLength(CATALOG.length);
    expect(loaded.unavailable).toEqual([]);
    expect(loaded.counts).toEqual({ stations: loadOmmFixture('stations').length, visual: loadOmmFixture('visual').length });
    expect(loaded).toMatchObject({ fetchedAt: T0, stale: false, persistent: true });
    expect(warn).not.toHaveBeenCalled();
  });

  it('prefers the stations record for the ISS and uses the catalog display name', async () => {
    const loaded = await loadElements(CATALOG, { cache: cache() });
    const iss = loaded.records.find((r) => r.catalog.noradId === 25544);
    expect(iss?.catalog.name).toBe('ISS (Zarya)');
    expect(iss?.omm).toEqual(loadOmmFixture('stations').find((r) => r.NORAD_CAT_ID === 25544));
  });

  it('warns about a catalog id absent from both groups and lists it as unavailable', async () => {
    const warn = vi.fn();
    const loaded = await loadElements([entry(25544, 'ISS'), entry(424242, 'Phantom')], { warn, cache: cache() });
    expect(loaded.records.map((r) => r.catalog.noradId)).toEqual([25544]);
    expect(loaded.unavailable).toEqual([424242]);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/424242 Phantom/));
  });

  it('drops a record that fails the schema, keeps the rest, and reports the dropped object as unavailable', async () => {
    const stations = loadOmmFixture('stations');
    const broken = stations.map((r) => (r.NORAD_CAT_ID === 25544 ? { ...r, MEAN_MOTION: 'fast' } : r));
    server.use(
      http.get(CELESTRAK_GP, ({ request }) => {
        const group = new URL(request.url).searchParams.get('GROUP');
        return HttpResponse.json(group === 'stations' ? broken : []);
      }),
    );
    const warn = vi.fn();
    const loaded = await loadElements([entry(25544, 'ISS'), entry(48274, 'Tiangong')], { warn, cache: cache() });
    expect(loaded.records.map((r) => r.catalog.noradId)).toEqual([48274]);
    expect(loaded.unavailable).toEqual([25544]);
    expect(warn.mock.calls.map((c) => c[0] as string).join('\n')).toMatch(/dropped record 25544/);
  });

  const failVisual = (): void => {
    server.use(
      http.get(CELESTRAK_GP, ({ request }) => {
        const group = new URL(request.url).searchParams.get('GROUP');
        return group === 'visual' ? HttpResponse.text('down', { status: 503 }) : HttpResponse.json(loadOmmFixture('stations'));
      }),
    );
  };

  it('rejects when a group request fails and nothing is cached', async () => {
    failVisual();
    await expect(loadElements(CATALOG, { warn: () => undefined, cache: cache() })).rejects.toThrow(/visual: HTTP 503/);
  });

  it('returns the cached records flagged stale when a refresh fails after the 2 h rule (FR-SAT-6)', async () => {
    let now = T0;
    const shared = memoryCache(() => now);
    const first = await loadElements(CATALOG, { cache: shared });
    now = T0 + ELEMENTS_TTL_MS + 1;
    failVisual();
    const warn = vi.fn();
    const second = await loadElements(CATALOG, { cache: shared, warn });
    expect(second.stale).toBe(true);
    expect(second.fetchedAt).toBe(T0); // the visual copy is the old one, and the older of the two is reported
    expect(second.records.map((r) => r.omm)).toEqual(first.records.map((r) => r.omm));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/could not refresh CelesTrak visual/));
  });

  it('honours an abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadElements(CATALOG, { signal: controller.signal, cache: cache() })).rejects.toThrow();
  });
});
