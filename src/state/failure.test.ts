/**
 * R86 (FR-FAIL-2, D-540): every failure the app meets maps to one kind, and the
 * raw text is kept only as `detail`. The fetchers are driven through their real
 * error paths with a stub `fetch`, so a status or body rule deleted from them
 * turns a row here red.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchGroup } from '../data/celestrak';
import { fetchCloudForecast } from '../data/openMeteo/forecast';
import { fetchPlaces } from '../data/openMeteo/geocode';
import { z } from '../data/zod';
import { isFailure, toFailure } from './failure';

const respond =
  (status: number, body: string, contentType = 'application/json'): typeof fetch =>
  () =>
    Promise.resolve(new Response(body, { status, headers: { 'content-type': contentType } }));

const caught = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('expected a rejection');
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toFailure', () => {
  it('maps a network TypeError with the device offline to `offline`', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(toFailure(new TypeError('Failed to fetch'))).toEqual({ kind: 'offline', detail: 'Failed to fetch' });
  });

  it('does not call a TypeError offline while the device says it is online', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(toFailure(new TypeError('Failed to fetch')).kind).toBe('unknown');
  });

  it('maps a 429 to `rate-limited`', async () => {
    const error = await caught(fetchGroup('stations', { fetchImpl: respond(429, 'slow down', 'text/plain') }));
    expect(toFailure(error)).toEqual({ kind: 'rate-limited', detail: 'CelesTrak stations: HTTP 429' });
  });

  it('maps a 503 to `server`, the provider error body included', async () => {
    expect(toFailure(await caught(fetchGroup('visual', { fetchImpl: respond(503, '') }))).kind).toBe('server');
    const overloaded = await caught(fetchCloudForecast(0, 0, 'k', { fetchImpl: respond(503, JSON.stringify({ error: true, reason: 'The service is overloaded' })) }));
    expect(toFailure(overloaded)).toEqual({ kind: 'server', detail: 'Open-Meteo forecast: HTTP 503: The service is overloaded' });
  });

  it('maps a zod error to `bad-data`', () => {
    const result = z.object({ a: z.number() }).safeParse({ a: 'x' });
    expect(result.success).toBe(false);
    expect(toFailure(result.error).kind).toBe('bad-data');
  });

  it('maps a body that is not the schema to `bad-data`', async () => {
    expect(toFailure(await caught(fetchCloudForecast(0, 0, 'k', { fetchImpl: respond(200, '{"hourly":1}') }))).kind).toBe('bad-data');
    expect(toFailure(await caught(fetchPlaces('rosario', { fetchImpl: respond(200, '{"results":1}') }))).kind).toBe('bad-data');
  });

  it("maps Open-Meteo's 200 with a text error body to `bad-data`", async () => {
    const error = await caught(fetchCloudForecast(0, 0, 'k', { fetchImpl: respond(200, 'Unexpected error while streaming data: allEndpointsUnavailable', 'text/plain') }));
    expect(toFailure(error)).toEqual({ kind: 'bad-data', detail: 'Open-Meteo forecast: HTTP 200, response is not JSON' });
  });

  it('maps an AbortError from a timeout to `timeout`', () => {
    expect(toFailure(new DOMException('The operation timed out.', 'AbortError')).kind).toBe('timeout');
    expect(toFailure(new DOMException('The operation timed out.', 'TimeoutError')).kind).toBe('timeout');
  });

  it('maps anything else to `unknown`, keeping its text as the detail', () => {
    expect(toFailure(new Error('INTERNAL: boom'))).toEqual({ kind: 'unknown', detail: 'INTERNAL: boom' });
    expect(toFailure('plain string')).toEqual({ kind: 'unknown', detail: 'plain string' });
  });

  it('passes a Failure through unchanged', () => {
    const failure = { kind: 'timeout', detail: 'no progress for 60 s' } as const;
    expect(isFailure(failure)).toBe(true);
    expect(toFailure(failure)).toEqual(failure);
  });
});
