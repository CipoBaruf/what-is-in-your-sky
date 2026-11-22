/** R193 (FR-MEAS-1, FR-MEAS-3, D-1146): the load's context, its id, the browser's gates and the paint deferral. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeasureEnv } from '../data/measure';
import { ID_PATTERN } from '../model/measure';
import { browserEnv, count, randomId, startMeasure } from './measure';

const recording = (): MeasureEnv & { bodies: () => Record<string, unknown>[] } => {
  const calls: string[] = [];
  return {
    beacon: (_url, body) => calls.push(body) > 0,
    online: () => true,
    origin: 'http://localhost',
    webdriver: false,
    forced: true,
    bodies: () => calls.map((body) => JSON.parse(body) as Record<string, unknown>),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FR-MEAS-1: the context is fixed at load', () => {
  it('visit, layout and lang come from the load and do not change within it', () => {
    const env = recording();
    startMeasure({ returning: true, wide: true, lang: 'es' }, env);
    count('open', 'live');
    count('where_shown');
    const [first, second] = env.bodies();
    expect(first).toMatchObject({ visit: 'return', layout: 'wide', lang: 'es' });
    expect(second).toMatchObject({ visit: 'return', layout: 'wide', lang: 'es', id: first?.['id'] });
  });

  it('a first visit on a narrow screen is first and compact', () => {
    const env = recording();
    startMeasure({ returning: false, wide: false, lang: 'en' }, env);
    count('open', 'live');
    expect(env.bodies()[0]).toMatchObject({ visit: 'first', layout: 'compact', lang: 'en' });
  });

  it('two loads make two ids, each 16 hex characters', () => {
    const one = recording();
    startMeasure({ returning: false, wide: false, lang: 'en' }, one);
    count('open', 'live');
    const two = recording();
    startMeasure({ returning: false, wide: false, lang: 'en' }, two);
    count('open', 'live');
    const ids = [one.bodies()[0]?.['id'], two.bodies()[0]?.['id']];
    for (const id of ids) expect(id).toMatch(ID_PATTERN);
    expect(ids[0]).not.toBe(ids[1]);
    expect(randomId()).toMatch(ID_PATTERN);
  });
});

describe('FR-MEAS-3: the browser environment', () => {
  it('reads sendBeacon, onLine, the origin and webdriver; __WIYS_MEASURE__ forces', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon, onLine: false, webdriver: true });
    vi.stubGlobal('location', { origin: 'https://inyoursky.app' });
    const env = browserEnv();
    expect(env).toMatchObject({ origin: 'https://inyoursky.app', webdriver: true, forced: false });
    expect(env.online()).toBe(false);
    env.beacon?.('/e', '{}');
    expect(sendBeacon).toHaveBeenCalledWith('/e', '{}');
    vi.stubGlobal('__WIYS_MEASURE__', true);
    expect(browserEnv().forced).toBe(true);
    vi.stubGlobal('__WIYS_MEASURE__', 'yes');
    expect(browserEnv().forced).toBe(false);
  });

  it('with no sendBeacon the beacon is absent', () => {
    vi.stubGlobal('navigator', { onLine: true, webdriver: false });
    expect(browserEnv().beacon).toBeUndefined();
  });

  it('a send waits for the next frame and then a zero timeout', () => {
    vi.useFakeTimers();
    const frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => frames.push(run));
    const run = vi.fn();
    browserEnv().defer?.(run);
    expect(run).not.toHaveBeenCalled();
    frames[0]?.();
    expect(run).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(run).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('with no frame to wait for, nothing runs and nothing throws', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const run = vi.fn();
    expect(() => browserEnv().defer?.(run)).not.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
});
