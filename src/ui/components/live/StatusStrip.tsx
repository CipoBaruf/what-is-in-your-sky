import type { ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { moonFacts } from '../../../lib/moonPhrases';
import { formatClock } from '../../../lib/timeFormat';
import type { CloudVerdict, EpochMs, MoonState, SkyState } from '../../../model';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { badgeText } from '../weather/CloudBadge';
import styles from './StatusStrip.module.css';

/**
 * R32 (FR-LIVE-3, US-15 AC2): the live page's facts about the shown instant,
 * as a labelled list beside the drawing — its text alternative (FR-GUIDE-7),
 * which is why the chart carries a name and no caption. Pure display: the
 * page computes every value and this component words it (FR-I18N-2).
 *
 * R77 (FR-WATCH-3, FR-LIVE-3 as amended v2.0): the five-field strip is one
 * line per shell, the same in both states.
 *
 * - **Compact:** the clock, the sky state, the cloud verdict and the count as
 *   `n up` — `21:14:32 dark clear 3 up` — one short word each so the line
 *   keeps FR-COMP-4's 36 cells in both languages, the labels spoken and not
 *   shown. The zone is spoken too: the artboard draws the line without it,
 *   and the zone abbreviation (`GMT+12:45` at its widest) is the one field
 *   that would take the line past its budget. The Moon's phase and
 *   illumination are the list panel's Moon line, one tap away (FR-MOON-3 as
 *   amended).
 * - **Wide:** in the rail, `Sky dark · Clouds Clear, 12 % cloud · Up 3 · Moon
 *   waxing crescent, 18 % lit`, wrapping inside the rail. The clock is on the
 *   indicator's line (FR-WATCH-2), so it is not here.
 *
 * The speed is the pressed control on the playback row and not a field
 * (FR-WATCH-3); the heading field went with the window's being a view of this
 * page (R64).
 */
export interface StatusStripProps {
  /** The shown instant `t` (FR-LIVE-2), not necessarily now. */
  t: EpochMs;
  timeZone: string | null;
  /** `null` until the astronomy chunk has evaluated the Sun (`useSkyBodies`). */
  sky: SkyState | null;
  cloud: CloudVerdict;
  /** Satellites with a marker at `t`: the passes whose interval contains it (D-160). */
  count: number;
  /** `null` until evaluated, like `sky`. */
  moon: MoonState | null;
}

/** One field: its label, spoken only on compact, and its value. The `dl` stays flat — a group of `div`s. */
function Field({ id, label, spoken, children }: { id: string; label: string; spoken: boolean; children: ReactNode }) {
  return (
    <div className={styles.field} data-testid={`live-${id}`}>
      <dt className={[styles.label, spoken ? 'sr-only' : undefined].filter(Boolean).join(' ')}>{label}</dt>{' '}
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

export function StatusStrip({ t, timeZone, sky, cloud, count, moon }: StatusStripProps) {
  const m = useT();
  const locale = useLocale();
  const compact = useLayoutMode() === 'compact';
  if (compact) {
    const clock = formatClock(t, timeZone, locale);
    const split = clock.indexOf(' ');
    return (
      <dl className={styles.strip} aria-label={m.live.strip} data-testid="status-strip" data-compact>
        <Field id="time" label={m.live.timeLabel} spoken>
          <time dateTime={new Date(t).toISOString()}>
            {clock.slice(0, split)}
            <span className="sr-only">{clock.slice(split)}</span>
          </time>
        </Field>
        <Field id="sky" label={m.live.skyLabel} spoken>
          <span data-sky={sky ?? 'pending'}>{sky ? m.live.skyShort[sky] : m.live.pending}</span>
        </Field>
        <Field id="cloud" label={m.live.cloudLabel} spoken>
          <span data-state={cloud.state}>{m.live.cloudWord[cloud.state]}</span>
        </Field>
        <Field id="count" label={m.live.countSpoken} spoken>
          <span data-count={count}>{m.live.upCount(count)}</span>
        </Field>
      </dl>
    );
  }
  return (
    <dl className={styles.strip} aria-label={m.live.strip} data-testid="status-strip" data-compact={false}>
      <Field id="sky" label={m.live.skyLabel} spoken={false}>
        <span data-sky={sky ?? 'pending'}>{sky ? m.live.sky[sky] : m.live.pending}</span>
      </Field>
      <Field id="cloud" label={m.live.cloudLabel} spoken={false}>
        <span data-state={cloud.state}>{badgeText(cloud, m)}</span>
      </Field>
      <Field id="count" label={m.live.countLabel} spoken={false}>
        <span data-count={count}>{String(count)}</span>
      </Field>
      <Field id="moon" label={m.live.moonLabel} spoken={false}>
        {moon ? m.live.moon(moonFacts(moon)) : m.live.pending}
      </Field>
    </dl>
  );
}
