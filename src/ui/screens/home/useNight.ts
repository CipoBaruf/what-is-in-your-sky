
import { nightClouds, type NightClouds } from '../../../lib/nightClouds';
import type { SkyBand, Span } from '../../../lib/timeStripe';
import { tonightSpan, tonightsDark, tonightsStarsFrom } from '../../../lib/tonightStripe';
import type { EpochMs, Observer, WeatherSnapshot } from '../../../model';
import { useAppStore } from '../../../state';
import { useTonight } from '../../components/now/useTonight';

/**
 * R82 (D-513), moved here from `tonight.ts` by R222 (D-1240): the stretch of tonight the cloud word is about — the
 * rest of the dark band (from now if it is already open), or the stripe's twelve hours where there is none (OQ-33).
 */
function nightWindow(bands: readonly SkyBand[], observer: Pick<Observer, 'lon' | 'timeZone'>, now: EpochMs): Span {
  const dark = tonightsDark(bands, now);
  if (dark) return { start: Math.max(dark.from, now), end: dark.to };
  return tonightSpan(bands, observer, now);
}

/**
 * R82 (FR-FIRST-4 as amended v2.0.2), read by the satellites' list since R212: tonight — the bands the stripe draws
 * (`useTonight`, the stacked page's own), tonight's dark band, the stretch of night the cloud word is about, and
 * the cloud for it: the forecast hour by hour across that stretch (`nightClouds`, D-1028).
 */
export interface Night {
  bands: readonly SkyBand[];
  sampledFrom: EpochMs;
  now: EpochMs;
  /** Tonight's dark band; null with none, or before the bands are known (`bands` is empty then). */
  dark: SkyBand | null;
  /** When tonight's stars come out (`tonightsStarsFrom`, D-884): the dark band, else tonight's bright twilight; null with neither or before the bands are known. */
  starsFrom: SkyBand | null;
  /** The rest of the dark band, or the stripe's span with none; null before the bands are known. */
  window: Span | null;
  snapshot: WeatherSnapshot | null;
  clouds: NightClouds;
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
    starsFrom: known ? tonightsStarsFrom(tonight.bands, tonight.now) : null,
    window,
    snapshot,
    clouds: nightClouds(snapshot, window, tonight.now),
  };
}
