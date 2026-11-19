import type { SkyBand, Span } from '../../../lib/timeStripe';
import { tonightSpan, tonightsDark } from '../../../lib/tonightStripe';
import type { EpochMs, Observer } from '../../../model';

/**
 * R82 (D-513), kept by R202 for the doors (`useNight`): the stretch of tonight the cloud word is about — the rest
 * of the dark band (from now if it is already open), or the stripe's twelve hours where there is no dark band
 * (OQ-33). The steps' count of tonight's passes (`splitTonight`) went with the steps (FR-FIRST-4 as amended v2.16).
 */
export function nightWindow(bands: readonly SkyBand[], observer: Pick<Observer, 'lon' | 'timeZone'>, now: EpochMs): Span {
  const dark = tonightsDark(bands, now);
  if (dark) return { start: Math.max(dark.from, now), end: dark.to };
  return tonightSpan(bands, observer, now);
}
