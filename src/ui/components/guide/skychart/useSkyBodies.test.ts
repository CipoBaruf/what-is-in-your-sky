/**
 * F-1 (R22 #48, closed R40): a failed dynamic import of the astronomy chunk
 * used to memoise the rejection, so the Sun and the Moon stayed absent for
 * the rest of the session. `vi.doMock` lets one test fail the chunk once and
 * succeed the next time it is imported.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Observer } from '../../../../model';

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquén', source: 'coords', timeZone: null };

describe('useSkyBodies (F-1)', () => {
  afterEach(() => {
    vi.doUnmock('../../../../lib/skyBodies');
    vi.resetModules();
  });

  it('retries the chunk on a later mount instead of staying without a Sun and a Moon forever', async () => {
    let attempts = 0;
    vi.doMock('../../../../lib/skyBodies', () => {
      attempts += 1;
      if (attempts === 1) throw new Error('the astronomy chunk failed to load');
      return { skyBodiesAt: () => ({ t: 1000, sun: { t: 1000, azDeg: 90, altDeg: 10 }, moon: { azDeg: 200, elDeg: 20 }, sky: 'dark' }) };
    });
    const { useSkyBodies } = await import('./useSkyBodies');

    const first = renderHook((props: { now: number }) => useSkyBodies({ observer, now: props.now }), { initialProps: { now: 1000 } });
    await waitFor(() => {
      expect(attempts).toBe(1);
    });
    expect(first.result.current).toEqual({ sun: null, moon: null, sky: null });
    first.unmount();

    const second = renderHook((props: { now: number }) => useSkyBodies({ observer, now: props.now }), { initialProps: { now: 1000 } });
    await waitFor(() => {
      expect(second.result.current.sun).not.toBeNull();
    });
    expect(attempts).toBe(2);
    second.unmount();
  });
});
