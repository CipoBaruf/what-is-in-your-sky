/**
 * R86 (FR-FAIL-2, D-540): a failure is stored as a kind, never as a sentence.
 * The slices keep a `Failure`; the sentence is chosen at draw time from `kind`
 * (R89, R91), so a language switch re-renders it, and `detail` is the raw text
 * — status code, exception name, provider message — that only `[ details ]`
 * shows. Until the failure line lands, the components that showed an error
 * string show `detail`, which is that same string.
 */
export type FailureKind = 'offline' | 'rate-limited' | 'server' | 'bad-data' | 'timeout' | 'unknown';

export interface Failure {
  kind: FailureKind;
  detail: string;
}

/**
 * What a fetcher knows about a failed response beyond its message
 * (`CelestrakError`, `OpenMeteoError`, `OpenMeteoGeocodeError`): the HTTP
 * status, and whether the body was not the data asked for — not JSON, not the
 * schema, or the provider's own error object.
 */
export interface ResponseFailureInfo {
  status?: number;
  badData?: boolean;
}

const FAILURE_KINDS: readonly FailureKind[] = ['offline', 'rate-limited', 'server', 'bad-data', 'timeout', 'unknown'];

export function isFailure(value: unknown): value is Failure {
  return typeof value === 'object' && value !== null && 'kind' in value && 'detail' in value && FAILURE_KINDS.includes(value.kind as FailureKind) && typeof value.detail === 'string';
}

const detailOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const nameOf = (error: unknown): string | null => (typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string' ? error.name : null);

const numberField = (error: unknown, key: string): number | null => {
  if (typeof error !== 'object' || error === null || !(key in error)) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
};

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * D-540's table. The order matters where two rows could both match: a timeout
 * is a timeout whatever else is true of it; a status of 429 or 5xx is the
 * server's answer even when the body was not JSON (Open-Meteo's overload came
 * as 503 with a text body as well as 200 with one); a 200 whose body was not
 * the data is `bad-data`.
 */
export function toFailure(error: unknown): Failure {
  if (isFailure(error)) return { kind: error.kind, detail: error.detail };
  const detail = detailOf(error);
  const name = nameOf(error);
  if (name === 'AbortError' || name === 'TimeoutError') return { kind: 'timeout', detail };
  if (error instanceof TypeError && isOffline()) return { kind: 'offline', detail };
  if (name === 'ZodError') return { kind: 'bad-data', detail };
  const status = numberField(error, 'status');
  if (status === 429) return { kind: 'rate-limited', detail };
  if (status !== null && status >= 500 && status <= 599) return { kind: 'server', detail };
  if (typeof error === 'object' && error !== null && 'badData' in error && error.badData === true) return { kind: 'bad-data', detail };
  return { kind: 'unknown', detail };
}
