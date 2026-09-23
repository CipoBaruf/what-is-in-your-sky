/**
 * FR-NIGHT-2 (D-535): the one selector the cards, the count line, the nights'
 * counts and tonight's stripe read. A pass whose end is more than
 * `ENDED_LINGER_S` behind the store's clock leaves it; the open pass does not;
 * and the stripe's ticks, fed from it, follow. The clock is the `now` slice's
 * instant, and `nowMs` until the worker has answered once; the wall clock is
 * never read.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MOON_FIXTURE, NO_MOON_AT_PEAK } from '../../../../tests/support/moonFixtures';
import { ENDED_LINGER_MS } from '../../../lib/nights';
import type { SkyBand } from '../../../lib/timeStripe';
import { tonightStripe } from '../../../lib/tonightStripe';
import type { NowState, Observer, Pass } from '../../../model';
import { appStore, type ElementsState } from '../../../state';
import { IDLE_PASSES } from '../../../state/slices/passes';
import { useShownClock, useShownPasses } from './shownPasses';

const T0 = Date.UTC(2026, 8, 11, 0, 0);
const MINUTE = 60_000;
const observer: Observer = { lat: -38.93, lon: -67.99, altM: 0, label: 'Neuquén', source: 'coords', timeZone: 'America/Argentina/Salta' };
const initial = appStore.getInitialState();

function pass(id: string, startMs: number, durationMs = 5 * MINUTE): Pass {
  return {
    id,
    noradId: 25544,
    name: id,
    start: { t: startMs, azDeg: 200, elDeg: 10, rangeKm: 1500 },
    peak: { t: startMs + durationMs / 2, azDeg: 250, elDeg: 60, rangeKm: 800 },
    end: { t: startMs + durationMs, azDeg: 300, elDeg: 10, rangeKm: 1500 },
    startReason: 'horizon',
    endReason: 'horizon',
    durationS: durationMs / 1000,
    peakMagnitude: -1.8,
    sunAltAtPeakDeg: -15,
    twilight: false,
    track: [],
    elementsEpochMs: T0,
    ...NO_MOON_AT_PEAK,
  };
}

const early = pass('early', T0 + 10 * MINUTE);
const mid = pass('mid', T0 + 60 * MINUTE);
const late = pass('late', T0 + 120 * MINUTE);
const ready: ElementsState = { status: 'ready', records: [], unavailable: [], rejected: [], fetchedAt: T0, stale: false, persistent: true };
const answered = (t: number): NowState => ({ t, sunAltDeg: -30, sky: 'dark', items: [], moon: MOON_FIXTURE });
const clockAt = (t: number): void => {
  act(() => {
    appStore.setState({ now: { observer, state: answered(t), error: null } });
  });
};
const ids = (passes: readonly Pass[]): string[] => passes.map((p) => p.id);

describe('useShownPasses', () => {
  afterEach(() => {
    appStore.setState(initial, true);
  });

  it('reads the now slice’s instant, and nowMs until the worker has answered', () => {
    appStore.setState({ observer, nowMs: T0 });
    const { result } = renderHook(() => useShownClock());
    expect(result.current).toBe(T0);
    clockAt(T0 + MINUTE);
    expect(result.current).toBe(T0 + MINUTE);
  });

  it('drops a pass whose end is more than ENDED_LINGER_S behind the clock, and keeps the array while nothing leaves', () => {
    appStore.setState({ observer, nowMs: T0, elements: ready, passes: { ...IDLE_PASSES, status: 'done', observer, passes: [early, mid, late], hasDarkness: true } });
    const { result } = renderHook(() => useShownPasses());
    expect(ids(result.current)).toEqual(['early', 'mid', 'late']);
    const before = result.current;
    clockAt(early.end.t + ENDED_LINGER_MS - 1000);
    expect(result.current).toBe(before);
    clockAt(early.end.t + ENDED_LINGER_MS + 1000);
    expect(ids(result.current)).toEqual(['mid', 'late']);
    // The store still holds the whole run: nothing was recomputed or written.
    expect(appStore.getState().passes.passes).toHaveLength(3);
    clockAt(late.end.t + ENDED_LINGER_MS + 1000);
    expect(result.current).toEqual([]);
  });

  it('the open pass is exempt while it is open', () => {
    appStore.setState({ observer, nowMs: T0, elements: ready, passes: { ...IDLE_PASSES, status: 'done', observer, passes: [early, mid, late], hasDarkness: true } });
    clockAt(mid.end.t + ENDED_LINGER_MS + 1000);
    const { result, rerender } = renderHook(({ open }: { open: string | null }) => useShownPasses(open), { initialProps: { open: 'early' as string | null } });
    expect(ids(result.current)).toEqual(['early', 'late']);
    rerender({ open: null });
    expect(ids(result.current)).toEqual(['late']);
  });

  it('a stored run is shown whatever the elements are doing (D-108), and pruned the same way', () => {
    appStore.setState({ observer, nowMs: early.end.t + ENDED_LINGER_MS + 1000, elements: { status: 'loading' }, passes: { ...IDLE_PASSES, status: 'done', observer, passes: [early, mid], storedAt: T0, hasDarkness: true } });
    const { result } = renderHook(() => useShownPasses());
    expect(ids(result.current)).toEqual(['mid']);
  });

  it('tonight’s stripe ticks only the passes still shown', () => {
    appStore.setState({ observer, nowMs: T0, elements: ready, passes: { ...IDLE_PASSES, status: 'done', observer, passes: [early, mid, late], hasDarkness: true } });
    const span = { start: T0 - 4 * 3_600_000, end: T0 + 8 * 3_600_000 };
    const bands: SkyBand[] = [{ from: span.start, to: span.end, sky: 'dark' }];
    const { result } = renderHook(() => useShownPasses());
    expect(tonightStripe(bands, result.current, span, observer.timeZone).ticks).toHaveLength(3);
    clockAt(early.end.t + ENDED_LINGER_MS + 1000);
    expect(tonightStripe(bands, result.current, span, observer.timeZone).ticks).toHaveLength(2);
  });
});
