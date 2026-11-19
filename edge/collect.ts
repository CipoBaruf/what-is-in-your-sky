/**
 * FR-MEAS-4 (D-1148): the route's handler, pure but for the `write` it is given. It answers `405` to any method but
 * `POST`; a `POST` is read to at most `EVENT_MAX_BYTES + 1` bytes, parsed and checked with `isMeasureEvent`, and only
 * an event that passes reaches `write`. Every `POST` answers `204` with no body and no cookie, kept or dropped, so the
 * answer says nothing about what was kept. Nothing of the request but its body is read: no header, no address.
 */
import { isMeasureEvent, type MeasureEvent } from '../src/model/measure';

/** FR-MEAS-4: the largest body an event may be, in bytes; one of FR-MEAS-1's events is well under it. */
export const EVENT_MAX_BYTES = 512;

/** Stores one kept event; the store stamps its own arrival time (D-1148). */
export type Write = (event: MeasureEvent) => void;

/** The body as text, or `undefined` once it passes `max` bytes; the rest of the stream is not read. */
async function readCapped(request: Request, max: number): Promise<string | undefined> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** FR-MEAS-4: `204` for every `POST`, `405` for anything else; `write` is called once for a kept event, never otherwise. */
export async function collect(request: Request, write: Write): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  try {
    // The beacon sends `text/plain;charset=UTF-8` (FR-MEAS-3), so the content type is not read: the body is the test.
    const text = await readCapped(request, EVENT_MAX_BYTES);
    const value = text === undefined ? undefined : parse(text);
    if (isMeasureEvent(value)) write(value);
  } catch {
    // A body that cannot be read, or a store that refuses the point, is a dropped event; the answer is the same.
  }
  return new Response(null, { status: 204 });
}
