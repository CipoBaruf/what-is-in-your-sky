/**
 * TASKS R9: the request is exactly PLAN §7.2's (`count=8`, English, JSON);
 * the recorded "rosario" response maps to `Place`s with a zone; identical
 * normalised queries hit the network once (FR-LOC-2 session cache); errors
 * are reported, never cached, and never thrown raw.
 */
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { Place } from '../../model';
import { GEOCODE_FIXTURE_QUERY, loadGeocodeFixture, loadGeocodeFixtureMeta, OPEN_METEO_GEOCODE, server } from '../../../tests/setup/msw';
import { createGeocoder, fetchPlaces, GEOCODE_COUNT, geocodeUrl, MIN_QUERY_LENGTH, normaliseQuery, OpenMeteoGeocodeError, parseGeocodeBody } from './geocode';

const meta = loadGeocodeFixtureMeta();

describe('normaliseQuery', () => {
  it('trims, collapses inner whitespace, lower-cases and composes', () => {
    expect(normaliseQuery('  Rosario ')).toBe('rosario');
    expect(normaliseQuery('Santa\t Fe')).toBe('santa fe');
    expect(normaliseQuery('Rosário')).toBe('rosário'); // decomposed → composed
    expect(normaliseQuery('')).toBe('');
  });
});

describe('geocodeUrl', () => {
  it('is the PLAN §7.2 request: name, count=8, language=en, format=json', () => {
    const url = new URL(geocodeUrl('rosario'));
    expect(url.origin + url.pathname).toBe(OPEN_METEO_GEOCODE);
    expect(url.searchParams.get('name')).toBe('rosario');
    expect(url.searchParams.get('count')).toBe('8');
    expect(GEOCODE_COUNT).toBe(8);
    expect(url.searchParams.get('language')).toBe('en');
    expect(url.searchParams.get('format')).toBe('json');
    expect([...url.searchParams.keys()].sort()).toEqual(['count', 'format', 'language', 'name']);
    expect(url.toString()).toBe(meta.source);
  });

  it('encodes the name', () => {
    expect(new URL(geocodeUrl('santa fe')).searchParams.get('name')).toBe('santa fe');
    expect(geocodeUrl('santa fe')).toContain('name=santa+fe');
  });
});

describe('parseGeocodeBody', () => {
  it('maps the recorded "rosario" response to eight places, each with its IANA zone', () => {
    const places = parseGeocodeBody(loadGeocodeFixture());
    expect(places).toHaveLength(8);
    expect(places[0]).toEqual({ name: 'Rosario', admin1: 'Santa Fe', country: 'Argentina', lat: -32.94682, lon: -60.63932, elevationM: 38, timeZone: 'America/Argentina/Cordoba' });
    for (const p of places) {
      expect(p.timeZone).toMatch(/^[A-Za-z_]+\/[A-Za-z_/]+$/);
      expect(p.country).toBeTypeOf('string');
    }
    expect(new Set(places.map((p) => p.country)).size).toBeGreaterThan(1); // ambiguous on purpose
  });

  it('answers no places for the provider\'s no-match body, which has no results key', () => {
    expect(parseGeocodeBody({ generationtime_ms: 0.52 })).toEqual([]);
  });

  it('keeps admin1 and country absent when the provider omits them and defaults elevation to 0', () => {
    const body = { results: [{ id: 1880251, name: 'Singapore', latitude: 1.36667, longitude: 103.8, feature_code: 'PCLI', country_code: 'SG', timezone: 'Asia/Singapore', country: 'Singapore' }] };
    const [place] = parseGeocodeBody(body);
    expect(place).toEqual({ name: 'Singapore', country: 'Singapore', lat: 1.36667, lon: 103.8, elevationM: 0, timeZone: 'Asia/Singapore' });
    expect(place && 'admin1' in place).toBe(false);
  });

  it('rejects a result without a zone', () => {
    expect(() => parseGeocodeBody({ results: [{ id: 1, name: 'X', latitude: 0, longitude: 0 }] })).toThrow(OpenMeteoGeocodeError);
  });
});

describe('fetchPlaces', () => {
  it('fetches through MSW', async () => {
    const places = await fetchPlaces(GEOCODE_FIXTURE_QUERY);
    expect(places).toHaveLength(8);
    expect(places[0]?.name).toBe('Rosario');
  });

  it('reports the provider reason on an HTTP error, and on a 200; a non-JSON body and a bare HTTP error too', async () => {
    server.use(http.get(OPEN_METEO_GEOCODE, () => HttpResponse.json({ error: true, reason: 'Parameter count must be between 1 and 100' }, { status: 400 })));
    await expect(fetchPlaces('rosario')).rejects.toThrow('Open-Meteo geocoding: HTTP 400: Parameter count must be between 1 and 100');
    server.use(http.get(OPEN_METEO_GEOCODE, () => HttpResponse.json({ error: true, reason: 'The service is overloaded' })));
    await expect(fetchPlaces('rosario')).rejects.toThrow('Open-Meteo geocoding: HTTP 200: The service is overloaded');
    server.use(http.get(OPEN_METEO_GEOCODE, () => HttpResponse.text('gateway down', { status: 502 })));
    await expect(fetchPlaces('rosario')).rejects.toThrow('Open-Meteo geocoding: HTTP 502, response is not JSON');
    server.use(http.get(OPEN_METEO_GEOCODE, () => HttpResponse.json({}, { status: 503 })));
    await expect(fetchPlaces('rosario')).rejects.toThrow('Open-Meteo geocoding: HTTP 503');
  });
});

describe('createGeocoder (session cache)', () => {
  const ROSARIO: Place = { name: 'Rosario', admin1: 'Santa Fe', country: 'Argentina', lat: -32.9, lon: -60.6, elevationM: 38, timeZone: 'America/Argentina/Cordoba' };

  it('hits the network once for identical normalised queries', async () => {
    const doFetch = vi.fn(async () => [ROSARIO]);
    const geocoder = createGeocoder({ fetchPlaces: doFetch });
    expect(await geocoder.search('Rosario')).toEqual([ROSARIO]);
    expect(await geocoder.search('  rosario ')).toEqual([ROSARIO]);
    expect(await geocoder.search('ROSARIO')).toEqual([ROSARIO]);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(doFetch).toHaveBeenCalledWith('rosario', {});
    expect(await geocoder.search('rosario, santa fe')).toEqual([ROSARIO]);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it('hits the real network once through MSW as well', async () => {
    let requests = 0;
    server.use(
      http.get(OPEN_METEO_GEOCODE, () => {
        requests++;
        return HttpResponse.json(loadGeocodeFixture() as Record<string, unknown>);
      }),
    );
    const geocoder = createGeocoder({ fetchPlaces });
    const first = await geocoder.search('Rosario');
    const second = await geocoder.search('rosario');
    expect(first).toHaveLength(8);
    expect(second).toBe(first);
    expect(requests).toBe(1);
  });

  it('shares one in-flight request between concurrent searches for the same query', async () => {
    let resolve: ((places: Place[]) => void) | null = null;
    const doFetch = vi.fn(() => new Promise<Place[]>((r) => (resolve = r)));
    const geocoder = createGeocoder({ fetchPlaces: doFetch });
    const a = geocoder.search('rosario');
    const b = geocoder.search('Rosario');
    expect(doFetch).toHaveBeenCalledTimes(1);
    (resolve as unknown as (places: Place[]) => void)([ROSARIO]);
    expect(await a).toEqual([ROSARIO]);
    expect(await b).toEqual([ROSARIO]);
  });

  it('never asks the network for an empty or one-character query', async () => {
    const doFetch = vi.fn(async () => [ROSARIO]);
    const geocoder = createGeocoder({ fetchPlaces: doFetch });
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(await geocoder.search('')).toEqual([]);
    expect(await geocoder.search('  R ')).toEqual([]);
    expect(doFetch).not.toHaveBeenCalled();
    expect(await geocoder.search('Ro')).toEqual([ROSARIO]);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure: the next search retries', async () => {
    const doFetch = vi.fn<GeocoderDeps['fetchPlaces']>().mockRejectedValueOnce(new OpenMeteoGeocodeError('down')).mockResolvedValueOnce([ROSARIO]);
    const geocoder = createGeocoder({ fetchPlaces: doFetch });
    await expect(geocoder.search('rosario')).rejects.toThrow('down');
    expect(await geocoder.search('rosario')).toEqual([ROSARIO]);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it('an aborted caller is rejected with AbortError, but the shared request completes and is cached', async () => {
    let resolve: ((places: Place[]) => void) | null = null;
    const doFetch = vi.fn(() => new Promise<Place[]>((r) => (resolve = r)));
    const geocoder = createGeocoder({ fetchPlaces: doFetch });
    const controller = new AbortController();
    const aborted = geocoder.search('rosario', { signal: controller.signal });
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    (resolve as unknown as (places: Place[]) => void)([ROSARIO]);
    expect(await geocoder.search('rosario')).toEqual([ROSARIO]);
    expect(doFetch).toHaveBeenCalledTimes(1);
    const already = new AbortController();
    already.abort();
    await expect(geocoder.search('rosario', { signal: already.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('clear() forgets the session', async () => {
    const doFetch = vi.fn(async () => [ROSARIO]);
    const geocoder = createGeocoder({ fetchPlaces: doFetch });
    await geocoder.search('rosario');
    geocoder.clear();
    await geocoder.search('rosario');
    expect(doFetch).toHaveBeenCalledTimes(2);
  });
});

type GeocoderDeps = Parameters<typeof createGeocoder>[0];
