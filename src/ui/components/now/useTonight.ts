import { useMemo } from 'react';
import type { SkyBand, Span } from '../../../lib/timeStripe';
import { HOUR_MS } from '../../../lib/timeStripe';
import type { EpochMs, Observer } from '../../../model';
import { useSkyBands } from '../live/useSkyBands';
import { useNow } from '../../hooks/useNow';

/**
 * R81 (FR-FIRST-8, FR-FIRST-9, D-470, D-506): the sky's bands around tonight,
 * once for the When reading, so the stripe and the table's `Dark` row read one
 * set and can never disagree — with each other, or with the live page's stripe,
 * which shades from the same hook (`useSkyBands`, imported and not changed).
 *
 * The span runs from a day back, so a dark window already open is named by the
 * dusk it opened at and not by the first sample, to a day and a half ahead, so
 * a dark band that opens late in the day ahead is whole and the stripe centred
 * on its middle is shaded to its end. The span moves by the hour, so the bands
 * are recomputed once an hour and not on every tick. Empty until the astronomy
 * chunk lands (D-148): the reading says nothing about darkness until it has.
 */
export const TONIGHT_CHECK_MS = 60_000;
const BACK_MS = 24 * HOUR_MS;
const AHEAD_MS = 36 * HOUR_MS;

export interface Tonight {
  bands: SkyBand[];
  /** The first instant the bands cover: a band reaching back to it began before anything sampled. */
  sampledFrom: EpochMs;
  now: EpochMs;
}

export function useTonight(observer: Observer): Tonight {
  const now = useNow(TONIGHT_CHECK_MS);
  const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const span = useMemo<Span>(() => ({ start: hour - BACK_MS, end: hour + AHEAD_MS }), [hour]);
  const bands = useSkyBands(observer, span);
  return { bands, sampledFrom: span.start, now };
}
