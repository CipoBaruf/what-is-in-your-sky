import { useMemo } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { HOUR_MS, type SkyBand } from '../../../lib/timeStripe';
import { formatShortClock } from '../../../lib/timeFormat';
import type { EpochMs, Locale, Observer } from '../../../model';
import { useSkyBands } from '../live/useSkyBands';
import { useNow } from '../../hooks/useNow';
import styles from './DarkWindow.module.css';

/**
 * R76 (FR-FIRST-4): tonight's dark window, "Dark 20:14 → 05:31" — the first
 * `dark` band of the night from the same bands the live page's stripe shades
 * (FR-LIVE-4, `useSkyBands`), so the two can never disagree about when it is
 * dark. The bands are sampled from half a day back, so a window that is already
 * open is named by the dusk it opened at rather than by the first sample.
 * Nothing until the astronomy chunk has landed: the line is complete without
 * it, as the stripe is without its shading.
 */
export const DARK_WINDOW_CHECK_MS = 60_000;
const BACK_MS = 12 * HOUR_MS;
const AHEAD_MS = 24 * HOUR_MS;

/** The first dark band still open at `now`, or the next one to open; null when the day ahead has none. */
export function tonightsDark(bands: readonly SkyBand[], now: EpochMs): SkyBand | null {
  return bands.find((band) => band.sky === 'dark' && band.to > now) ?? null;
}

export function darkWindowText(band: SkyBand | null, timeZone: string | null, locale: Locale, t: Messages): string {
  if (!band) return t.home.noDarkWindow;
  return t.home.darkWindow({ from: formatShortClock(band.from, timeZone, locale, true), to: formatShortClock(band.to, timeZone, locale) });
}

export function DarkWindow({ observer }: { observer: Observer }) {
  const t = useT();
  const locale = useLocale();
  const now = useNow(DARK_WINDOW_CHECK_MS);
  // The span moves by the hour, so the bands are recomputed once an hour and not on every tick.
  const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const span = useMemo(() => ({ start: hour - BACK_MS, end: hour + AHEAD_MS }), [hour]);
  const bands = useSkyBands(observer, span);
  if (bands.length === 0) return null;
  return (
    <p className={styles.line} data-testid="dark-window">
      {darkWindowText(tonightsDark(bands, now), observer.timeZone, locale, t)}
    </p>
  );
}
