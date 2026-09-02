import { z } from './zod';
import type { ElementGroup, OmmRecord } from '../model';

/**
 * FR-SAT-2 / FR-SAT-3: one request per group, OMM JSON, never `CATNR`.
 * Records failing the schema are dropped with a warning; a body that is not an
 * array, or a non-2xx status, is an error. No cache here (R11).
 */
export const CELESTRAK_GP_URL = 'https://celestrak.org/NORAD/elements/gp.php';

export const ommRecordSchema = z.object({
  OBJECT_NAME: z.string().min(1),
  OBJECT_ID: z.string(),
  NORAD_CAT_ID: z.number().int().nonnegative(),
  EPOCH: z.string().min(1),
  MEAN_MOTION: z.number(),
  ECCENTRICITY: z.number(),
  INCLINATION: z.number(),
  RA_OF_ASC_NODE: z.number(),
  ARG_OF_PERICENTER: z.number(),
  MEAN_ANOMALY: z.number(),
  EPHEMERIS_TYPE: z.number().int(),
  CLASSIFICATION_TYPE: z.string(),
  ELEMENT_SET_NO: z.number().int(),
  REV_AT_EPOCH: z.number().int(),
  BSTAR: z.number(),
  MEAN_MOTION_DOT: z.number(),
  MEAN_MOTION_DDOT: z.number(),
});

export class CelestrakError extends Error {
  constructor(
    message: string,
    readonly group: ElementGroup,
  ) {
    super(message);
    this.name = 'CelestrakError';
  }
}

export function groupUrl(group: ElementGroup): string {
  const url = new URL(CELESTRAK_GP_URL);
  url.searchParams.set('GROUP', group);
  url.searchParams.set('FORMAT', 'json');
  return url.toString();
}

export interface FetchGroupOptions {
  signal?: AbortSignal;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Where dropped-record warnings go; defaults to console.warn. */
  warn?: (message: string) => void;
}

/** Validate a parsed body: keep the records that match the schema, report the rest. */
export function parseGroupBody(body: unknown, group: ElementGroup, warn: (message: string) => void): OmmRecord[] {
  if (!Array.isArray(body)) throw new CelestrakError(`CelesTrak ${group}: response is not a JSON array`, group);
  const records: OmmRecord[] = [];
  let dropped = 0;
  body.forEach((item: unknown, index) => {
    const result = ommRecordSchema.safeParse(item);
    if (result.success) records.push(result.data);
    else {
      dropped++;
      const id = typeof item === 'object' && item !== null && 'NORAD_CAT_ID' in item ? String(item.NORAD_CAT_ID) : `index ${String(index)}`;
      warn(`CelesTrak ${group}: dropped record ${id}: ${result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    }
  });
  if (dropped > 0) warn(`CelesTrak ${group}: kept ${String(records.length)} records, dropped ${String(dropped)}`);
  return records;
}

export async function fetchGroup(group: ElementGroup, options: FetchGroupOptions = {}): Promise<OmmRecord[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const warn = options.warn ?? ((m: string) => console.warn(m));
  const init: RequestInit = options.signal ? { signal: options.signal } : {};
  const response = await doFetch(groupUrl(group), init);
  if (!response.ok) throw new CelestrakError(`CelesTrak ${group}: HTTP ${String(response.status)}`, group);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CelestrakError(`CelesTrak ${group}: response is not JSON`, group);
  }
  return parseGroupBody(body, group, warn);
}
