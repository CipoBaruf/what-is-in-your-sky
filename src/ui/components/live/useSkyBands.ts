import { useEffect, useMemo, useState } from 'react';
import { HOUR_MS, skyBands, type SkyBand, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Observer, SkyState } from '../../../model';

/**
 * R33 (FR-LIVE-4, D-170): the three sky states across the stripe's span, for
 * its night shading. The Sun's altitude is `lib/skyBodies.ts`, the astronomy
 * chunk the chart already loads through a dynamic import (D-148), reached the
 * same way here so the stripe adds nothing to the first paint. The span's
 * start is real time and moves every 10 s; the bands are sampled from the
 * whole hour before it to an hour past its end and recomputed once an hour,
 * and `nightBands` clips them to the span at draw time. Empty until the chunk
 * arrives: the stripe is complete without shading, as the dome is without its
 * Sun.
 */
type SkyStateAt = (t: EpochMs, observer: Observer) => SkyState;

let pending: Promise<SkyStateAt> | null = null;

function loadSkyState(): Promise<SkyStateAt> {
  pending ??= import('../../../lib/skyBodies').then((module) => module.skyStateAt);
  return pending;
}

/** Five minutes between samples: twilight lasts twenty to forty, so a band's edge is within a sixth of its length. */
export const BAND_STEP_MS = 5 * 60_000;

export function useSkyBands(observer: Observer, span: Span): SkyBand[] {
  const [evaluate, setEvaluate] = useState<SkyStateAt | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadSkyState().then(
      (loaded) => {
        if (!cancelled) setEvaluate(() => loaded);
      },
      () => {
        // A chunk that will not load leaves the stripe unshaded, which it can draw.
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const fromHour = Math.floor(span.start / HOUR_MS);
  const hours = Math.ceil((span.end - span.start) / HOUR_MS) + 2;
  return useMemo(() => {
    if (!evaluate) return [];
    const from = fromHour * HOUR_MS;
    return skyBands(from, from + hours * HOUR_MS, BAND_STEP_MS, (t) => evaluate(t, observer));
  }, [evaluate, observer, fromHour, hours]);
}
