/**
 * TASKS R8: the request is exactly PLAN §7.3's (four hourly variables,
 * unix times, auto zone) with R24's `forecast_days=4` (FR-OFF-3, the 72 h
 * window plus the margin a local-midnight day boundary needs); the recorded Neuquén response
 * parses into a snapshot whose zone is `America/Argentina/Salta`; error
 * bodies, non-JSON bodies and HTTP errors are reported, never thrown raw.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { loadForecastFixture, loadForecastFixtureMeta, OPEN_METEO_FORECAST, server } from '../../../tests/setup/msw';
import { fetchCloudForecast, forecastUrl, FORECAST_DAYS, HOURLY_VARIABLES, OpenMeteoError, parseForecastBody } from './forecast';

const meta = loadForecastFixtureMeta();
const FETCHED_AT = Date.parse(meta.fetchedAt);

describe('forecastUrl', () => {
  it('is the PLAN §7.3 request: four hourly variables, four days, unix times, auto zone, one-decimal coordinates', () => {
    const url = new URL(forecastUrl(-38.9, -68));
    expect(url.origin + url.pathname).toBe(OPEN_METEO_FORECAST);
    expect(url.searchParams.get('hourly')?.split(',')).toEqual(['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high']);
    expect(HOURLY_VARIABLES).toHaveLength(4);
    expect(url.searchParams.get('forecast_days')).toBe('4');
    expect(FORECAST_DAYS).toBe(4);
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('latitude')).toBe('-38.9');
    expect(url.searchParams.get('longitude')).toBe('-68.0');
    expect([...url.searchParams.keys()].sort()).toEqual(['forecast_days', 'hourly', 'latitude', 'longitude', 'timeformat', 'timezone']);
  });
});

describe('parseForecastBody', () => {
  it('turns the recorded Neuquén response into a snapshot in the Salta zone with 72 layered hourly samples', () => {
    const snapshot = parseForecastBody(loadForecastFixture(), meta.cell.lat, meta.cell.lon, '-38.9,-68.0', FETCHED_AT);
    expect(snapshot).toMatchObject({ provider: 'open-meteo', lat: meta.cell.lat, lon: meta.cell.lon, cellKey: '-38.9,-68.0', fetchedAt: FETCHED_AT, timeZone: 'America/Argentina/Salta' });
    expect(snapshot.hourly).toHaveLength(72);
    const [first] = snapshot.hourly;
    expect(first?.t).toBe(Date.parse('2026-09-02T03:00:00Z')); // local midnight (UTC−3) on the capture date
    for (const h of snapshot.hourly) {
      expect(h.totalPct).toBeGreaterThanOrEqual(0);
      expect(h.totalPct).toBeLessThanOrEqual(100);
      expect(h.lowPct).toBeTypeOf('number');
      expect(h.midPct).toBeTypeOf('number');
      expect(h.highPct).toBeTypeOf('number');
    }
    // Sorted, hourly, contiguous.
    for (let i = 1; i < snapshot.hourly.length; i++) expect((snapshot.hourly[i]?.t ?? 0) - (snapshot.hourly[i - 1]?.t ?? 0)).toBe(3_600_000);
  });

  it('drops hours with a null total and keeps layers only when all three are present', () => {
    const body = {
      latitude: 1,
      longitude: 2,
      timezone: 'Etc/UTC',
      hourly: { time: [0, 3600, 7200], cloud_cover: [10, null, 30], cloud_cover_low: [1, 2, null], cloud_cover_mid: [1, 2, 3], cloud_cover_high: [1, 2, 3] },
    };
    const snapshot = parseForecastBody(body, 1, 2, '1.0,2.0', 5);
    expect(snapshot.hourly).toEqual([
      { t: 0, totalPct: 10, lowPct: 1, midPct: 1, highPct: 1 },
      { t: 7_200_000, totalPct: 30 },
    ]);
  });

  it('rejects a body without the hourly block', () => {
    expect(() => parseForecastBody({ timezone: 'Etc/UTC' }, 1, 2, '1.0,2.0', 5)).toThrow(OpenMeteoError);
  });
});

describe('fetchCloudForecast', () => {
  it('fetches through MSW and stamps fetchedAt from the injected clock', async () => {
    const snapshot = await fetchCloudForecast(-38.9, -68, '-38.9,-68.0', { now: () => FETCHED_AT });
    expect(snapshot.timeZone).toBe('America/Argentina/Salta');
    expect(snapshot.fetchedAt).toBe(FETCHED_AT);
    expect(snapshot.hourly.length).toBeGreaterThan(0);
  });

  it('reports the provider reason on an HTTP error', async () => {
    server.use(http.get(OPEN_METEO_FORECAST, () => HttpResponse.json({ error: true, reason: 'Latitude must be in range' }, { status: 400 })));
    await expect(fetchCloudForecast(95, 0, '95.0,0.0')).rejects.toThrow('Open-Meteo forecast: HTTP 400: Latitude must be in range');
  });

  it('reports the provider reason even on a 200, and a bare HTTP error without one', async () => {
    server.use(http.get(OPEN_METEO_FORECAST, () => HttpResponse.json({ error: true, reason: 'The service is overloaded' })));
    await expect(fetchCloudForecast(-38.9, -68, '-38.9,-68.0')).rejects.toThrow('Open-Meteo forecast: HTTP 200: The service is overloaded');
    server.use(http.get(OPEN_METEO_FORECAST, () => HttpResponse.text('gateway down', { status: 502 })));
    await expect(fetchCloudForecast(-38.9, -68, '-38.9,-68.0')).rejects.toThrow('Open-Meteo forecast: HTTP 502, response is not JSON');
    server.use(http.get(OPEN_METEO_FORECAST, () => HttpResponse.json({}, { status: 503 })));
    await expect(fetchCloudForecast(-38.9, -68, '-38.9,-68.0')).rejects.toThrow('Open-Meteo forecast: HTTP 503');
  });

  it('reports a 200 with a non-JSON body (seen live during an Open-Meteo outage)', async () => {
    server.use(http.get(OPEN_METEO_FORECAST, () => HttpResponse.text('Unexpected error while streaming data: allEndpointsUnavailable')));
    await expect(fetchCloudForecast(-38.9, -68, '-38.9,-68.0')).rejects.toThrow('Open-Meteo forecast: HTTP 200, response is not JSON');
  });
});
