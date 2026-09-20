import { useEffect, useMemo, useState } from 'react';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { moonNote, moonSampleTimes, type MoonNote } from '../../../lib/moonNote';
import type { SkyBodies } from '../../../lib/skyBodies';
import type { SkyBand, Span } from '../../../lib/timeStripe';
import { tonightsDark } from '../../../lib/tonightStripe';
import type { CloudVerdict, EpochMs, Observer, WeatherSnapshot } from '../../../model';
import { useAppStore } from '../../../state';
import { useTonight } from '../../components/now/useTonight';
import { nightWindow } from './tonight';

/**
 * R82 (FR-FIRST-4 as amended v2.0.2): tonight as the phone's when and what
 * steps state it — the bands the stripe draws (`useTonight`, the stacked
 * page's own), tonight's dark band, the stretch of night the cloud word and the
 * Moon's sentence are about, and the cloud word for it: the forecast at the
 * middle of that stretch, so the when step's `Clouds tonight` and the what
 * step's foot line say the same word.
 */
export interface Night {
  bands: readonly SkyBand[];
  sampledFrom: EpochMs;
  now: EpochMs;
  /** Tonight's dark band; null with none, or before the bands are known (`bands` is empty then). */
  dark: SkyBand | null;
  /** The rest of the dark band, or the stripe's span with none; null before the bands are known. */
  window: Span | null;
  snapshot: WeatherSnapshot | null;
  clouds: CloudVerdict;
}

export function useNight(observer: Observer): Night {
  const tonight = useTonight(observer);
  const weather = useAppStore((s) => s.weather);
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const known = tonight.bands.length > 0;
  const window = known ? nightWindow(tonight.bands, observer, tonight.now) : null;
  return {
    bands: tonight.bands,
    sampledFrom: tonight.sampledFrom,
    now: tonight.now,
    dark: known ? tonightsDark(tonight.bands, tonight.now) : null,
    window,
    snapshot,
    clouds: cloudVerdict(snapshot, window ? (window.start + window.end) / 2 : tonight.now),
  };
}

type BodiesAt = (t: EpochMs, observer: Observer) => SkyBodies;

let pending: Promise<BodiesAt> | null = null;

/** The astronomy chunk the stripe's bands already load (D-148), reached the same way. */
function loadBodies(): Promise<BodiesAt> {
  pending ??= import('../../../lib/skyBodies').then((module) => module.skyBodiesAt);
  return pending;
}

/**
 * D-513: which Moon sentence the when step reads — the Moon sampled across
 * `window` a quarter hour apart (`lib/moonNote`). Null until the chunk lands
 * or while there is no window: the sentence is left out rather than guessed.
 */
export function useMoonNote(observer: Observer, window: Span | null): MoonNote | null {
  const [evaluate, setEvaluate] = useState<BodiesAt | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadBodies().then(
      (loaded) => {
        if (!cancelled) setEvaluate(() => loaded);
      },
      () => {
        // A chunk that will not load leaves the sentence out, which the box can do without.
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  const start = window?.start ?? null;
  const end = window?.end ?? null;
  return useMemo(() => {
    if (!evaluate || start === null || end === null) return null;
    return moonNote(moonSampleTimes({ start, end }).map((t) => evaluate(t, observer).moon));
  }, [evaluate, observer, start, end]);
}
