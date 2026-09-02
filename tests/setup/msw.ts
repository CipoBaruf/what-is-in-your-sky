/**
 * MSW handlers shared by both Vitest projects (PLAN §9.1, §9.3): CelesTrak is
 * routed to the dated OMM fixture, the Open-Meteo forecast to the recorded
 * Neuquén response (R8); anything else is an error. `CATNR` requests are
 * rejected so FR-SAT-2's "never per object" rule is enforced in tests, and a
 * forecast request that is not the PLAN §7.3 one (four hourly variables,
 * three days, unix times, auto zone) gets a 400.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ElementGroup, OmmRecord } from '../../src/model';

export const OMM_FIXTURE_DATE = '2026-09-02';
export const CELESTRAK_GP = 'https://celestrak.org/NORAD/elements/gp.php';
export const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_FIXTURE = '2026-09-02-neuquen-forecast';

export function ommFixturePath(group: ElementGroup, date: string = OMM_FIXTURE_DATE): string {
  return join(process.cwd(), 'tests', 'fixtures', 'omm', `${date}-${group}.json`);
}

export function loadOmmFixture(group: ElementGroup, date?: string): OmmRecord[] {
  return JSON.parse(readFileSync(ommFixturePath(group, date), 'utf8')) as OmmRecord[];
}

export function forecastFixturePath(name: string = FORECAST_FIXTURE): string {
  return join(process.cwd(), 'tests', 'fixtures', 'open-meteo', `${name}.json`);
}

/** The recorded forecast body, untyped: tests feed it to the schema. */
export function loadForecastFixture(name?: string): unknown {
  return JSON.parse(readFileSync(forecastFixturePath(name), 'utf8'));
}

export interface ForecastFixtureMeta {
  fetchedAt: string;
  source: string;
  cell: { lat: number; lon: number };
}

export function loadForecastFixtureMeta(name: string = FORECAST_FIXTURE): ForecastFixtureMeta {
  return JSON.parse(readFileSync(join(process.cwd(), 'tests', 'fixtures', 'open-meteo', `${name}.meta.json`), 'utf8')) as ForecastFixtureMeta;
}

export const celestrakHandlers = [
  http.get(CELESTRAK_GP, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.has('CATNR')) return HttpResponse.text('per-object requests are forbidden (FR-SAT-2)', { status: 400 });
    const group = url.searchParams.get('GROUP');
    if (group !== 'stations' && group !== 'visual') return HttpResponse.text('unknown group', { status: 404 });
    if (url.searchParams.get('FORMAT') !== 'json') return HttpResponse.text('only FORMAT=json is fixtured', { status: 400 });
    return HttpResponse.json(loadOmmFixture(group));
  }),
];

export const openMeteoHandlers = [
  http.get(OPEN_METEO_FORECAST, ({ request }) => {
    const url = new URL(request.url);
    const expected: Record<string, string> = {
      hourly: 'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high',
      forecast_days: '3',
      timezone: 'auto',
      timeformat: 'unixtime',
    };
    for (const [name, value] of Object.entries(expected)) {
      if (url.searchParams.get(name) !== value) return HttpResponse.json({ error: true, reason: `only ${name}=${value} is fixtured (PLAN §7.3)` }, { status: 400 });
    }
    if (!url.searchParams.has('latitude') || !url.searchParams.has('longitude')) return HttpResponse.json({ error: true, reason: 'latitude and longitude are required' }, { status: 400 });
    return HttpResponse.json(loadForecastFixture() as Record<string, unknown>);
  }),
];

export const server = setupServer(...celestrakHandlers, ...openMeteoHandlers);
