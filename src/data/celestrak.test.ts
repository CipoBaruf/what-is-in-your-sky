import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CELESTRAK_GP, loadOmmFixture, server } from '../../tests/setup/msw';
import { CelestrakError, fetchGroup, groupUrl, parseGroupBody } from './celestrak';

describe('groupUrl', () => {
  it('requests one group as OMM JSON and never a CATNR (FR-SAT-2, FR-SAT-3)', () => {
    const url = new URL(groupUrl('stations'));
    expect(url.origin + url.pathname).toBe('https://celestrak.org/NORAD/elements/gp.php');
    expect(url.searchParams.get('GROUP')).toBe('stations');
    expect(url.searchParams.get('FORMAT')).toBe('json');
    expect(url.searchParams.has('CATNR')).toBe(false);
  });
});

describe('fetchGroup', () => {
  it('returns every record of the fixture, including the ISS', async () => {
    const records = await fetchGroup('stations');
    expect(records).toHaveLength(loadOmmFixture('stations').length);
    expect(records.find((r) => r.NORAD_CAT_ID === 25544)?.OBJECT_NAME).toBe('ISS (ZARYA)');
  });

  it('drops records that fail the schema and keeps the rest, with a warning', async () => {
    const good = loadOmmFixture('stations').slice(0, 2);
    server.use(
      http.get(CELESTRAK_GP, () => HttpResponse.json([good[0], { ...good[1], MEAN_MOTION: 'fast' }, { OBJECT_NAME: 'junk' }])),
    );
    const warn = vi.fn();
    const records = await fetchGroup('stations', { warn });
    expect(records).toEqual([good[0]]);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.map((c) => c[0] as string).join('\n')).toMatch(/dropped 2/);
  });

  it('strips unknown fields so the record matches OmmRecord exactly', () => {
    const [first] = loadOmmFixture('stations');
    const records = parseGroupBody([{ ...first, EXTRA: 1 }], 'stations', () => undefined);
    expect(records[0]).toEqual(first);
    expect(records[0]).not.toHaveProperty('EXTRA');
  });

  it('throws on a non-2xx response', async () => {
    server.use(http.get(CELESTRAK_GP, () => HttpResponse.text('nope', { status: 503 })));
    await expect(fetchGroup('visual')).rejects.toBeInstanceOf(CelestrakError);
    await expect(fetchGroup('visual')).rejects.toThrow(/HTTP 503/);
  });

  it('throws when the body is not JSON or not an array', async () => {
    server.use(http.get(CELESTRAK_GP, () => HttpResponse.text('<html>')));
    await expect(fetchGroup('visual')).rejects.toThrow(/not JSON/);
    server.use(http.get(CELESTRAK_GP, () => HttpResponse.json({ error: 'x' })));
    await expect(fetchGroup('visual')).rejects.toThrow(/not a JSON array/);
  });

  it('honours an abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchGroup('stations', { signal: controller.signal })).rejects.toThrow();
  });
});
