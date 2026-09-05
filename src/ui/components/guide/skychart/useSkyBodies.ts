import { useEffect, useMemo, useState } from 'react';
import type { SkyBodies } from '../../../../lib/skyBodies';
import type { EpochMs, MoonState, Observer, SkyState } from '../../../../model';
import type { SkyChartProps } from './SkyChart.types';

/**
 * FR-DOME-6 (R22): the Sun and the Moon at the instant the chart is showing.
 *
 * The evaluation itself is `lib/skyBodies.ts` (D-80), and it is reached
 * through a **dynamic import**: `astronomy-engine` is the largest thing the
 * app can load and nothing the first paint needs depends on it, so it is its
 * own chunk, fetched once the chart is on screen. Until it arrives the chart
 * simply has no Sun and no Moon, which is the same state as an instant nobody
 * has named — the drawing is complete without them.
 *
 * A caller that has already evaluated them passes them in and no import is
 * made at all: that is how the live page holds FR-LIVE-5's one evaluation per
 * second of wall time while `t` runs at 3600× (PLAN §8.8).
 */

type Evaluate = (t: EpochMs, observer: Observer) => SkyBodies;

let pending: Promise<Evaluate> | null = null;

/** The evaluator, loaded once per session and shared by every chart on the page. */
function loadSkyBodies(): Promise<Evaluate> {
  pending ??= import('../../../../lib/skyBodies').then((module) => module.skyBodiesAt);
  return pending;
}

export interface ChartBodies {
  sun: SkyBodies['sun'] | null;
  moon: MoonState | null;
  /** FR-LIVE-3 (R32): the sky in words at `now`; `null` until evaluated, or when the caller supplied the bodies itself. */
  sky: SkyState | null;
}

const EMPTY: ChartBodies = { sun: null, moon: null, sky: null };

export function useSkyBodies({ observer, now, sun, moon }: Pick<SkyChartProps, 'observer' | 'now' | 'sun' | 'moon'>): ChartBodies {
  // Either body given — including as an explicit `null` — means the caller owns both.
  const supplied = sun !== undefined || moon !== undefined;
  const wanted = !supplied && now !== undefined;
  const [evaluate, setEvaluate] = useState<Evaluate | null>(null);

  useEffect(() => {
    if (!wanted || evaluate) return;
    let cancelled = false;
    void loadSkyBodies().then(
      (loaded) => {
        // The state is a function, so it goes in through an updater or React calls it.
        if (!cancelled) setEvaluate(() => loaded);
      },
      () => {
        // A chunk that will not load leaves the chart without a Sun and a Moon, which it can draw.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wanted, evaluate]);

  return useMemo(() => {
    if (supplied) return { sun: sun ?? null, moon: moon ?? null, sky: null };
    if (!evaluate || now === undefined) return EMPTY;
    const bodies = evaluate(now, observer);
    return { sun: bodies.sun, moon: bodies.moon, sky: bodies.sky };
  }, [supplied, sun, moon, evaluate, now, observer]);
}
