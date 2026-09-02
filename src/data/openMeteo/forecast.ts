import type { EpochMs, HourlyCloud, WeatherSnapshot } from '../../model';
import { forecastErrorSchema, forecastResponseSchema } from './schemas';

/**
 * FR-WX-1 / PLAN §7.3: one request per fetch, the exact URL from the plan —
 * four hourly variables and three days, so it counts as a single Open-Meteo
 * call. `timezone=auto` makes the response carry the IANA zone that fills
 * `Observer.timeZone` for coordinate and device input (D-3). No cache here:
 * `weatherCache.ts` owns the 30 min / 0.1° cell rule (FR-WX-5).
 */
export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const HOURLY_VARIABLES = ['cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high'] as const;
export const FORECAST_DAYS = 3;

export class OpenMeteoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}

/** Coordinates are sent with one decimal: the cache cell (0.1°) is the resolution the app asks for. */
export function forecastUrl(lat: number, lon: number): string {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', lat.toFixed(1));
  url.searchParams.set('longitude', lon.toFixed(1));
  url.searchParams.set('hourly', HOURLY_VARIABLES.join(','));
  url.searchParams.set('forecast_days', String(FORECAST_DAYS));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('timeformat', 'unixtime');
  return url.toString();
}

export interface FetchForecastOptions {
  signal?: AbortSignal;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Client clock for `fetchedAt` (FR-WX-5's 30 min counts from here). */
  now?: () => EpochMs;
}

/** Zip the hourly arrays into samples; an hour whose total is null is dropped, layers are kept only when all three are present. */
export function parseForecastBody(body: unknown, lat: number, lon: number, cellKey: string, fetchedAt: EpochMs): WeatherSnapshot {
  const result = forecastResponseSchema.safeParse(body);
  if (!result.success) {
    throw new OpenMeteoError(`Open-Meteo forecast: unexpected response: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  const { hourly, timezone } = result.data;
  const samples: HourlyCloud[] = [];
  hourly.time.forEach((seconds, i) => {
    const total = hourly.cloud_cover[i];
    if (total === null || total === undefined) return;
    const low = hourly.cloud_cover_low?.[i];
    const mid = hourly.cloud_cover_mid?.[i];
    const high = hourly.cloud_cover_high?.[i];
    const sample: HourlyCloud = { t: seconds * 1000, totalPct: total };
    if (typeof low === 'number' && typeof mid === 'number' && typeof high === 'number') {
      sample.lowPct = low;
      sample.midPct = mid;
      sample.highPct = high;
    }
    samples.push(sample);
  });
  samples.sort((a, b) => a.t - b.t);
  return { provider: 'open-meteo', lat, lon, cellKey, fetchedAt, timeZone: timezone, hourly: samples };
}

export async function fetchCloudForecast(lat: number, lon: number, cellKey: string, options: FetchForecastOptions = {}): Promise<WeatherSnapshot> {
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const init: RequestInit = options.signal ? { signal: options.signal } : {};
  const response = await doFetch(forecastUrl(lat, lon), init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Seen live on 2026-09-02: HTTP 200 with a plain-text body ("Unexpected error while streaming data: allEndpointsUnavailable").
    throw new OpenMeteoError(`Open-Meteo forecast: HTTP ${String(response.status)}, response is not JSON`);
  }
  // The provider's own error body, whatever the status ("The service is overloaded" was seen live with the outage above).
  const error = forecastErrorSchema.safeParse(body);
  if (error.success) throw new OpenMeteoError(`Open-Meteo forecast: HTTP ${String(response.status)}: ${error.data.reason}`);
  if (!response.ok) throw new OpenMeteoError(`Open-Meteo forecast: HTTP ${String(response.status)}`);
  return parseForecastBody(body, lat, lon, cellKey, now());
}
