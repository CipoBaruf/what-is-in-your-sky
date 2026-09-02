import type { Place } from '../../model';
import { geocodeResponseSchema, openMeteoErrorSchema } from './schemas';

/**
 * FR-LOC-2 / PLAN §7.2: place-name search against Open-Meteo's geocoding API,
 * the exact URL from the plan (`count=8`, English, JSON). Results are
 * memoised for the session per normalised query so the same text never hits
 * the network twice; the 500 ms debounce lives in the input component.
 * Failures are reported as `OpenMeteoGeocodeError` and never cached.
 */
export const OPEN_METEO_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const GEOCODE_COUNT = 8;
/** Open-Meteo answers nothing for a one-character name; the client does not ask. */
export const MIN_QUERY_LENGTH = 2;

export class OpenMeteoGeocodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenMeteoGeocodeError';
  }
}

/** The cache key and the text sent: trimmed, inner whitespace collapsed, lower-cased, Unicode-composed. "  Rosário " and "rosário" are one query. */
export function normaliseQuery(query: string): string {
  return query.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function geocodeUrl(normalisedQuery: string): string {
  const url = new URL(OPEN_METEO_GEOCODE_URL);
  url.searchParams.set('name', normalisedQuery);
  url.searchParams.set('count', String(GEOCODE_COUNT));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  return url.toString();
}

/** A result maps to a `Place`; `elevation` defaults to sea level when the provider omits it. */
export function parseGeocodeBody(body: unknown): Place[] {
  const result = geocodeResponseSchema.safeParse(body);
  if (!result.success) {
    throw new OpenMeteoGeocodeError(`Open-Meteo geocoding: unexpected response: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  return (result.data.results ?? []).map((r) => ({
    name: r.name,
    ...(r.admin1 !== undefined ? { admin1: r.admin1 } : {}),
    ...(r.country !== undefined ? { country: r.country } : {}),
    lat: r.latitude,
    lon: r.longitude,
    elevationM: r.elevation ?? 0,
    timeZone: r.timezone,
  }));
}

export interface FetchPlacesOptions {
  signal?: AbortSignal;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/** One network request for a normalised query. Same failure handling as the forecast: non-JSON bodies and `{ error: true }` bodies are errors whatever the status. */
export async function fetchPlaces(normalisedQuery: string, options: FetchPlacesOptions = {}): Promise<Place[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const init: RequestInit = options.signal ? { signal: options.signal } : {};
  const response = await doFetch(geocodeUrl(normalisedQuery), init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OpenMeteoGeocodeError(`Open-Meteo geocoding: HTTP ${String(response.status)}, response is not JSON`);
  }
  const error = openMeteoErrorSchema.safeParse(body);
  if (error.success) throw new OpenMeteoGeocodeError(`Open-Meteo geocoding: HTTP ${String(response.status)}: ${error.data.reason}`);
  if (!response.ok) throw new OpenMeteoGeocodeError(`Open-Meteo geocoding: HTTP ${String(response.status)}`);
  return parseGeocodeBody(body);
}

export interface GeocoderDeps {
  fetchPlaces: (normalisedQuery: string, options: { signal?: AbortSignal }) => Promise<Place[]>;
}

export interface Geocoder {
  /** Places for `query`, from the session cache when the normalised text was searched before. Never rejects for an empty or one-character query. */
  search: (query: string, options?: { signal?: AbortSignal }) => Promise<Place[]>;
  /** Drops the session cache. */
  clear: () => void;
}

/**
 * The session cache (PLAN §5: in-memory `Map`, normalised query → `Place[]`).
 * Concurrent searches for one query share the in-flight request; a rejected
 * request is forgotten so the next attempt retries. The caller's signal only
 * detaches that caller: the shared request runs to completion so the answer
 * can still be cached for the next keystroke.
 */
export function createGeocoder({ fetchPlaces: doFetch }: GeocoderDeps): Geocoder {
  const cache = new Map<string, Place[]>();
  const inFlight = new Map<string, Promise<Place[]>>();
  return {
    search: (query, options = {}) => {
      if (options.signal?.aborted) return Promise.reject(abortReason(options.signal));
      const key = normaliseQuery(query);
      if (key.length < MIN_QUERY_LENGTH) return Promise.resolve([]);
      const hit = cache.get(key);
      if (hit) return Promise.resolve(hit);
      let promise = inFlight.get(key);
      if (!promise) {
        promise = doFetch(key, {})
          .then((places) => {
            cache.set(key, places);
            return places;
          })
          .finally(() => {
            inFlight.delete(key);
          });
        inFlight.set(key, promise);
      }
      return options.signal ? abortable(promise, options.signal) : promise;
    },
    clear: () => {
      cache.clear();
    },
  };
}

/** Rejects with the signal's reason as soon as it aborts, without cancelling the shared request. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

function abortReason(signal: AbortSignal): unknown {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new DOMException('The search was aborted', 'AbortError');
}

let appGeocoder: Geocoder | null = null;

/** The app's geocoder, created on first use with the real fetch. */
export function searchPlaces(query: string, options: { signal?: AbortSignal } = {}): Promise<Place[]> {
  appGeocoder ??= createGeocoder({ fetchPlaces });
  return appGeocoder.search(query, options);
}
