import { useEffect, useMemo, useState } from 'react';
import type { SkyBodies } from '../../../../lib/skyBodies';
import type { EpochMs, MoonState, Observer, SkyState } from '../../../../model';
import type { SkyChartProps } from './SkyChart.types';
import { skyVector, type SkyPoint } from './window/projection';

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
  pending ??= import('../../../../lib/skyBodies').then(
    (module) => module.skyBodiesAt,
    (error: unknown) => {
      // F-1: a failed chunk is not memoised — the next mount that wants the bodies gets a fresh attempt.
      pending = null;
      throw error;
    },
  );
  return pending;
}

/** How far from the Moon the limb point is taken, degrees: near enough that the projection is the direction at the Moon. */
const LIMB_STEP_DEG = 1;

/**
 * R155 (FR-LOOK-7, D-974): the bright limb's direction as a point on the sky — a degree from the Moon along the
 * great circle toward the Sun, where the lit side faces. The views project it beside the Moon and read the
 * direction between the two on the plane (`MoonDisc.tsx`), so one rule serves the window and the whole sky
 * whatever their projection. `null` when the two are the same or opposite directions, which never happens.
 */
export function brightLimbPoint(moon: Pick<SkyPoint, 'azDeg' | 'elDeg'>, sun: { azDeg: number; altDeg: number }): SkyPoint | null {
  const m = skyVector(moon.azDeg, moon.elDeg);
  const s = skyVector(sun.azDeg, sun.altDeg);
  const along = m[0] * s[0] + m[1] * s[1] + m[2] * s[2];
  const t: [number, number, number] = [s[0] - along * m[0], s[1] - along * m[1], s[2] - along * m[2]];
  const n = Math.hypot(t[0], t[1], t[2]);
  if (n < 1e-9) return null;
  const rad = (LIMB_STEP_DEG * Math.PI) / 180;
  const c = Math.cos(rad);
  const k = Math.sin(rad) / n;
  const p: [number, number, number] = [c * m[0] + k * t[0], c * m[1] + k * t[1], c * m[2] + k * t[2]];
  const az = (Math.atan2(p[0], p[1]) * 180) / Math.PI;
  return { azDeg: ((az % 360) + 360) % 360, elDeg: (Math.asin(Math.max(-1, Math.min(1, p[2]))) * 180) / Math.PI };
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
