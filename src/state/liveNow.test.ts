/** R33 (FR-LIVE-6, D-169): the live page's request goes to the client `startApp` handed over, with the hidden set asked for. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Observer } from '../model';
import { DEFAULT_THRESHOLDS } from '../physics/constants';
import { MOON_FIXTURE } from '../../tests/support/moonFixtures';
import { computeNowAt, setLiveNowClient } from './liveNow';

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquén', source: 'coords', timeZone: null };

describe('computeNowAt', () => {
  afterEach(() => {
    setLiveNowClient(null);
  });

  it('rejects while no worker is running', async () => {
    await expect(computeNowAt(observer, 5)).rejects.toThrow('the worker is not running');
  });

  it('asks the client for the Now pipeline at t with the hidden set, under the default thresholds', async () => {
    const state = { t: 5, sunAltDeg: -20, sky: 'dark' as const, items: [], hidden: [], moon: MOON_FIXTURE };
    const computeNow = vi.fn().mockResolvedValue(state);
    setLiveNowClient({ computeNow });
    await expect(computeNowAt(observer, 5)).resolves.toBe(state);
    expect(computeNow).toHaveBeenCalledWith(observer, 5, DEFAULT_THRESHOLDS, { includeHidden: true });
  });
});
