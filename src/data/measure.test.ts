/** R193 (FR-MEAS-2, FR-MEAS-3, D-1146): the sender's gates, its once-per-pair rule and its silence. */
import { describe, expect, it, vi } from 'vitest';
import type { MeasureContext } from '../model/measure';
import { createMeasure, MEASURE_ORIGIN, MEASURE_PATH, type MeasureEnv } from './measure';

const context: MeasureContext = { visit: 'return', layout: 'wide', lang: 'es', id: 'a1b2c3d4e5f60718' };

const envWith = (over: Partial<MeasureEnv> = {}): MeasureEnv & { beacon: ReturnType<typeof vi.fn> } => {
  const beacon = vi.fn((_url: string, _body: string) => true);
  return { beacon, online: () => true, origin: MEASURE_ORIGIN, webdriver: false, forced: false, ...over } as MeasureEnv & { beacon: ReturnType<typeof vi.fn> };
};

const bodies = (beacon: ReturnType<typeof vi.fn>): unknown[] => beacon.mock.calls.map((call) => JSON.parse(String(call[1])) as unknown);

describe('FR-MEAS-3: sending', () => {
  it('on the public address, one beacon to /e with FR-MEAS-1 six fields', () => {
    const env = envWith();
    const count = createMeasure(env, context);
    count('place_set', 'device');
    count('where_shown');
    expect(env.beacon.mock.calls.map((call) => call[0])).toEqual([MEASURE_PATH, MEASURE_PATH]);
    expect(bodies(env.beacon)).toEqual([
      { name: 'place_set', detail: 'device', ...context },
      { name: 'where_shown', ...context },
    ]);
  });

  it('FR-MEAS-2: a second send of the same pair in one load is dropped; another detail is another pair', () => {
    const env = envWith();
    const count = createMeasure(env, context);
    count('place_set', 'search');
    count('place_set', 'search');
    count('place_set', 'coords');
    count('no_passes');
    count('no_passes');
    expect(bodies(env.beacon)).toEqual([
      { name: 'place_set', detail: 'search', ...context },
      { name: 'place_set', detail: 'coords', ...context },
      { name: 'no_passes', ...context },
    ]);
  });

  it('offline sends nothing and does not send the pair later either', () => {
    let online = false;
    const env = envWith({ online: () => online });
    const count = createMeasure(env, context);
    count('open', 'home');
    online = true;
    count('open', 'home');
    expect(env.beacon).not.toHaveBeenCalled();
  });

  it('with no sendBeacon nothing is sent and nothing throws', () => {
    const count = createMeasure(envWith({ beacon: undefined }), context);
    expect(() => count('open', 'home')).not.toThrow();
  });

  it('a throwing sendBeacon is silent: no throw, no console line', () => {
    const error = vi.spyOn(console, 'error');
    const env = envWith({
      beacon: () => {
        throw new TypeError('blocked');
      },
    });
    const count = createMeasure(env, context);
    expect(() => count('open', 'home')).not.toThrow();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('a foreign origin sends nothing: a preview, a local build, the test server', () => {
    for (const origin of ['https://r193-in-your-sky.ezequiel-baruf.workers.dev', 'http://localhost:4173', 'http://inyoursky.app', 'https://inyoursky.app.evil.example']) {
      const env = envWith({ origin });
      createMeasure(env, context)('open', 'home');
      expect(env.beacon, origin).not.toHaveBeenCalled();
    }
  });

  it('an automated browser on the public address sends nothing', () => {
    const env = envWith({ webdriver: true });
    createMeasure(env, context)('open', 'home');
    expect(env.beacon).not.toHaveBeenCalled();
  });

  it('forced lifts the origin and webdriver gates, and nothing else', () => {
    const env = envWith({ origin: 'http://localhost:4173', webdriver: true, forced: true });
    const count = createMeasure(env, context);
    count('open', 'home');
    count('open', 'home');
    expect(bodies(env.beacon)).toEqual([{ name: 'open', detail: 'home', ...context }]);
    const offline = envWith({ forced: true, online: () => false });
    createMeasure(offline, context)('open', 'home');
    expect(offline.beacon).not.toHaveBeenCalled();
  });

  it('the send waits for the deferral, and is read online at that moment', () => {
    const queued: (() => void)[] = [];
    let online = true;
    const env = envWith({ defer: (run) => void queued.push(run), online: () => online });
    const count = createMeasure(env, context);
    count('open', 'home');
    count('where_shown');
    expect(env.beacon).not.toHaveBeenCalled();
    queued[0]?.();
    online = false;
    queued[1]?.();
    expect(bodies(env.beacon)).toEqual([{ name: 'open', detail: 'home', ...context }]);
  });

  it('FR-MEAS-1: a detail outside the list never leaves, even past the type', () => {
    const env = envWith();
    const count = createMeasure(env, context) as (name: string, detail?: string) => void;
    count('place_set', 'Neuquén, Argentina');
    count('typed');
    expect(env.beacon).not.toHaveBeenCalled();
  });
});
