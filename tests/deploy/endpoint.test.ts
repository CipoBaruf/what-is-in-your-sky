/**
 * R195 (FR-MEAS-4, D-1148): the route that receives. `collect` is driven with real `Request`s and a recording `write`;
 * the script in `edge/index.ts` with a fake pair of bindings, to show `/e` reaches the store as the six fields and every
 * other path goes to the assets untouched.
 */
import { describe, expect, it } from 'vitest';
import { collect, EVENT_MAX_BYTES } from '../../edge/collect';
import worker, { type Env } from '../../edge/index';
import type { MeasureEvent } from '../../src/model/measure';

const ORIGIN = 'https://site.test';
const EVENT: MeasureEvent = { name: 'place_set', detail: 'search', visit: 'first', layout: 'compact', lang: 'en', id: '0123456789abcdef' };
/** Values a request carries that the store must never see. */
const HEADERS = {
  'User-Agent': 'Agent/9.9 (secret-ua)',
  Referer: 'https://referrer.test/secret-path',
  Cookie: 'k=secret-cookie',
  'CF-Connecting-IP': '203.0.113.77',
  'X-Forwarded-For': '198.51.100.23',
  'Accept-Language': 'xx-SECRET',
};

/** The beacon's request: a `POST` of `text/plain;charset=UTF-8` (FR-MEAS-3). */
const post = (body: BodyInit, headers: Record<string, string> = {}): Request =>
  new Request(`${ORIGIN}/e`, { method: 'POST', body, headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...headers } });

async function run(request: Request): Promise<{ response: Response; writes: MeasureEvent[] }> {
  const writes: MeasureEvent[] = [];
  const response = await collect(request, (event) => writes.push(event));
  return { response, writes };
}

/** FR-MEAS-4: `204`, no body, no cookie, whatever happened to the event. */
async function expectSilent(response: Response): Promise<void> {
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
  expect(response.headers.get('Set-Cookie')).toBeNull();
}

describe('collect (FR-MEAS-4)', () => {
  it('writes a valid event once, as its six fields and nothing else', async () => {
    const { response, writes } = await run(post(JSON.stringify(EVENT), HEADERS));
    await expectSilent(response);
    expect(writes).toEqual([EVENT]);
    expect(Object.keys(writes[0] ?? {}).sort()).toEqual(['detail', 'id', 'lang', 'layout', 'name', 'visit']);
  });

  it('writes an event of a name that takes no detail without one', async () => {
    const event: MeasureEvent = { name: 'where_shown', visit: 'return', layout: 'wide', lang: 'es', id: 'fedcba9876543210' };
    const { response, writes } = await run(post(JSON.stringify(event)));
    await expectSilent(response);
    expect(writes).toEqual([event]);
  });

  it('keeps a body of exactly EVENT_MAX_BYTES and drops one byte more', async () => {
    const base = JSON.stringify(EVENT);
    const padded = (size: number) => base.slice(0, -1) + ' '.repeat(size - base.length) + '}';
    expect((await run(post(padded(EVENT_MAX_BYTES)))).writes).toEqual([EVENT]);
    const over = await run(post(padded(EVENT_MAX_BYTES + 1)));
    await expectSilent(over.response);
    expect(over.writes).toEqual([]);
  });

  it('drops an oversize body read as a stream, without reading it to the end', async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(256).fill(0x20));
        if (pulls > 100) controller.close();
      },
    });
    const request = new Request(`${ORIGIN}/e`, { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    const { response, writes } = await run(request);
    await expectSilent(response);
    expect(writes).toEqual([]);
    expect(pulls).toBeLessThan(10);
  });

  it.each([
    ['a malformed body', '{"name":"place_set",'],
    ['an empty body', ''],
    ['a JSON value that is not an object', '"place_set"'],
    ['an unknown name', JSON.stringify({ ...EVENT, name: 'page_view' })],
    ['an unknown detail', JSON.stringify({ ...EVENT, detail: 'typed text' })],
    ['a detail on a name that takes none', JSON.stringify({ ...EVENT, name: 'when_shown' })],
    ['a seventh field', JSON.stringify({ ...EVENT, path: '/secret' })],
    ['an id that is not 16 hex characters', JSON.stringify({ ...EVENT, id: 'not-an-id' })],
  ])('writes nothing for %s', async (_case, body) => {
    const { response, writes } = await run(post(body));
    await expectSilent(response);
    expect(writes).toEqual([]);
  });

  it('answers 204 even when the store throws', async () => {
    const response = await collect(post(JSON.stringify(EVENT)), () => {
      throw new Error('store refused');
    });
    await expectSilent(response);
  });

  it.each(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])('refuses %s with 405 and writes nothing', async (method) => {
    const { response, writes } = await run(new Request(`${ORIGIN}/e`, { method }));
    expect(response.status).toBe(405);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(writes).toEqual([]);
  });
});

/** The script with recording bindings. */
function fakeEnv() {
  const points: unknown[] = [];
  const assets: Request[] = [];
  const env: Env = {
    ASSETS: {
      fetch: (request) => {
        assets.push(request);
        return Promise.resolve(new Response('asset', { status: 200 }));
      },
    },
    EVENTS: { writeDataPoint: (point) => void points.push(point) },
  };
  return { env, points, assets };
}

describe('edge/index.ts (D-1148)', () => {
  it('writes a kept event as one index and the six fields as blobs, in a fixed order', async () => {
    const { env, points, assets } = fakeEnv();
    const response = await worker.fetch(post(JSON.stringify(EVENT), HEADERS), env);
    await expectSilent(response);
    expect(points).toEqual([{ indexes: [EVENT.id], blobs: ['place_set', 'search', 'first', 'compact', 'en', EVENT.id] }]);
    expect(assets).toEqual([]);
  });

  it('writes an empty blob for a name with no detail', async () => {
    const { env, points } = fakeEnv();
    await worker.fetch(post(JSON.stringify({ name: 'no_passes', visit: 'return', layout: 'wide', lang: 'es', id: '00000000ffffffff' })), env);
    expect(points).toEqual([{ indexes: ['00000000ffffffff'], blobs: ['no_passes', '', 'return', 'wide', 'es', '00000000ffffffff'] }]);
  });

  it('writes no header value: not the address, the user agent, the referrer or a cookie', async () => {
    const { env, points } = fakeEnv();
    await worker.fetch(post(JSON.stringify(EVENT), HEADERS), env);
    const written = JSON.stringify(points);
    for (const value of Object.values(HEADERS)) expect(written).not.toContain(value);
    expect(written).not.toMatch(/secret|203\.0\.113|198\.51\.100/);
  });

  it('writes nothing for a dropped event and refuses GET /e itself, not through the assets', async () => {
    const { env, points, assets } = fakeEnv();
    await expectSilent(await worker.fetch(post('{}'), env));
    expect((await worker.fetch(new Request(`${ORIGIN}/e`), env)).status).toBe(405);
    expect(points).toEqual([]);
    expect(assets).toEqual([]);
  });

  it.each(['/', '/index.html', '/404.html', '/assets/index.js', '/e/', '/ex', '/missing'])('hands %s to the assets as it came', async (path) => {
    const { env, points, assets } = fakeEnv();
    const request = new Request(`${ORIGIN}${path}`, { method: 'POST', body: JSON.stringify(EVENT) });
    const response = await worker.fetch(request, env);
    expect(await response.text()).toBe('asset');
    expect(assets).toEqual([request]);
    expect(points).toEqual([]);
  });
});
