/**
 * R33 (FR-LIVE-6, D-81): the hidden-objects request under fake timers — one
 * request per 250 ms of wall time however fast the instant moves, the last
 * instant always asked for, and a reply dropped once a later request is out.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOON_FIXTURE } from '../../../../tests/support/moonFixtures';
import type { NowState, Observer } from '../../../model';
import { setLiveNowClient } from '../../../state';
import { useHiddenObjects } from './useHiddenObjects';

const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquén', source: 'coords', timeZone: null };
const NOW = Date.UTC(2026, 8, 11, 9, 30, 0);
const answer = (t: number): NowState => ({ t, sunAltDeg: -30, sky: 'dark', items: [], hidden: [], moon: MOON_FIXTURE });

interface Deferred {
  t: number;
  resolve: (state: NowState) => void;
}

describe('useHiddenObjects', () => {
  const requests: Deferred[] = [];
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(NOW);
    requests.length = 0;
    setLiveNowClient({
      computeNow: (_observer, t) =>
        new Promise<NowState>((resolve) => {
          requests.push({ t, resolve });
        }),
    });
  });
  afterEach(() => {
    setLiveNowClient(null);
    vi.useRealTimers();
  });

  const settle = async (request: Deferred | undefined): Promise<void> => {
    if (!request) throw new Error('no request');
    await act(async () => {
      request.resolve(answer(request.t));
      await Promise.resolve();
    });
  };

  it('asks nothing while off, and asks for the instant as soon as it is on', async () => {
    let enabled = false;
    const { result, rerender } = renderHook(() => useHiddenObjects(observer, NOW, enabled));
    expect(requests).toHaveLength(0);
    expect(result.current).toBeNull();
    enabled = true;
    rerender();
    expect(requests.map((r) => r.t)).toEqual([NOW]);
    await settle(requests[0]);
    expect(result.current?.t).toBe(NOW);
    enabled = false;
    rerender();
    expect(result.current).toBeNull();
  });

  it('sends one request per 250 ms of wall time while the instant moves, and the last instant is always asked for', async () => {
    let t = NOW;
    const { rerender } = renderHook(() => useHiddenObjects(observer, t, true));
    expect(requests.map((r) => r.t)).toEqual([NOW]);
    // Five scrub steps inside 100 ms: nothing more goes out yet.
    for (let i = 1; i <= 5; i++) {
      act(() => {
        vi.advanceTimersByTime(20);
      });
      t = NOW + i * 60_000;
      rerender();
    }
    expect(requests).toHaveLength(1);
    // …and at the 250 ms mark, exactly one request, for where the instant is now.
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(requests.map((r) => r.t)).toEqual([NOW, NOW + 5 * 60_000]);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(requests).toHaveLength(2);
    await settle(requests[1]);
  });

  it('drops a reply once a later request has gone out, so an older instant never overwrites a newer one', async () => {
    let t = NOW;
    const { result, rerender } = renderHook(() => useHiddenObjects(observer, t, true));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    t = NOW + HOUR;
    rerender();
    expect(requests.map((r) => r.t)).toEqual([NOW, NOW + HOUR]);
    // The first reply lands after the second request went out: stale, dropped.
    await settle(requests[0]);
    expect(result.current).toBeNull();
    await settle(requests[1]);
    expect(result.current?.t).toBe(NOW + HOUR);
  });
});

const HOUR = 3_600_000;
