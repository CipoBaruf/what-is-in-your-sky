/**
 * LIVE=1 only (PLAN §9.1 "Live contract"): the Open-Meteo forecast (PLAN §7.3)
 * and geocoding (PLAN §7.2) responses still parse, and both still carry
 * `access-control-allow-origin: *` for a cross-origin request. Open-Meteo has
 * been seen answering 200 with an error body during overloads (PLAN D-37), so
 * such a body is a failure here too.
 */
import { describe, expect, it } from 'vitest';
import { forecastUrl, parseForecastBody } from '../../src/data/openMeteo/forecast';
import { geocodeUrl, normaliseQuery, parseGeocodeBody } from '../../src/data/openMeteo/geocode';
import { openMeteoErrorSchema } from '../../src/data/openMeteo/schemas';

const LIVE = process.env['LIVE'] === '1';
const ORIGIN = 'https://what-is-in-your-sky.example';
/** The R8 fixture cell: Neuquén. */
const CELL = { lat: -38.9, lon: -68.0, key: '-38.9,-68.0' };

async function jsonWithCors(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Origin: ORIGIN } });
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Open-Meteo answered 200 with a non-JSON body: ${text.slice(0, 120)}`);
  }
  const error = openMeteoErrorSchema.safeParse(body);
  if (error.success) throw new Error(`Open-Meteo answered 200 with an error body: ${error.data.reason}`);
  return body;
}

describe.skipIf(!LIVE)('Open-Meteo live contract', () => {
  it('forecast: 200, CORS header is *, and the body parses into a snapshot with three days of hourly cloud cover', async () => {
    const body = await jsonWithCors(forecastUrl(CELL.lat, CELL.lon));
    const snapshot = parseForecastBody(body, CELL.lat, CELL.lon, CELL.key, Date.now());
    expect(snapshot.timeZone).toBe('America/Argentina/Salta');
    expect(snapshot.hourly.length).toBeGreaterThanOrEqual(3 * 24);
    expect(snapshot.hourly.every((h) => h.lowPct !== undefined)).toBe(true);
  }, 60_000);

  it('geocoding: 200, CORS header is *, and "cipolletti" still resolves to the R9 place', async () => {
    const body = await jsonWithCors(geocodeUrl(normaliseQuery('Cipolletti')));
    const places = parseGeocodeBody(body);
    expect(places.length).toBeGreaterThan(0);
    expect(places[0]).toMatchObject({ name: 'Cipolletti', country: 'Argentina', timeZone: 'America/Argentina/Salta' });
    expect(places[0]?.lat).toBeCloseTo(-38.93, 1);
    expect(places[0]?.lon).toBeCloseTo(-67.99, 1);
  }, 60_000);
});
