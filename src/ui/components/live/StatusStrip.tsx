import type { ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { formatSignedDegrees } from '../../../lib/format';
import { moonFacts } from '../../../lib/moonPhrases';
import type { Speed } from '../../../lib/playback';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { CloudVerdict, EpochMs, MoonState, SkyState } from '../../../model';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { badgeText } from '../weather/CloudBadge';
import styles from './StatusStrip.module.css';

/**
 * R32 (FR-LIVE-3, US-15 AC2): the live page's five facts about the shown
 * instant, as a labelled list under the dome. The instant in the observer's
 * zone with its abbreviation (`formatClock`, which is where every clock on the
 * page gets its zone from); the sky in words; the cloud cover interpolated to
 * that instant, or "unknown" with no forecast (FR-WX-2, `cloudVerdict`); the
 * count of satellites with a marker on the dome; and the Moon's phase and
 * illumination. It is the drawing's text alternative (FR-GUIDE-7), which is
 * why the chart above it carries a name and no caption.
 *
 * Pure display: the page computes every value and this component words it
 * through the catalogs (FR-I18N-2). R33 adds the playback speed as a sixth
 * field while playing (FR-LIVE-3's "while playing, the speed").
 *
 * R48 (FR-LIVE-7 as amended, FR-COMP-4, D-246): on compact the strip is two
 * lines of at most 36 cells. Line 1 is the clock with its zone and the sky
 * in words, their labels spoken and not shown; line 2 is `Clouds 12 %`,
 * `Visible 3` and `Moon 72 %` — the percentages and the number, since the
 * words ("Clear, 12 % cloud", "waning gibbous, 72 % lit") are 50 cells. The
 * date is the stripe's and the readout's on compact (FR-TRAJ-4). The speed
 * and the heading, when present, take a line each under the two.
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
  /** R33 (FR-LIVE-3): the playback speed while playing, as a sixth field; `null` or absent otherwise. */
  speed?: Speed | null;
  /**
   * R44 (FR-WIN-3, US-21 AC6): the observer's magnetic declination while the
   * dome is following the phone, as a seventh field; `null` or absent when it
   * is not, because there is no heading being corrected then.
   */
  declinationDeg?: number | null;
}

/**
 * One field. `last` marks the field that ends a compact line (the stylesheet
 * breaks the line after it): the `dl` stays flat — a group of `div`s, which
 * is all its content model and the definition-list a11y rule allow — and the
 * lines are the inline formatting context's, not wrappers.
 */
function Field({ id, label, spoken = false, last = false, children }: { id: string; label: string; /** The label is for assistive technology only (compact's first line). */ spoken?: boolean; last?: boolean; children: ReactNode }) {
  return (
    <div className={styles.field} data-testid={`live-${id}`} data-line-end={last}>
      <dt className={[styles.label, spoken ? 'sr-only' : undefined].filter(Boolean).join(' ')}>{label}</dt>{' '}
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

export function StatusStrip({ t, timeZone, sky, cloud, count, moon, speed = null, declinationDeg = null }: StatusStripProps) {
  const m = useT();
  const locale = useLocale();
  const compact = useLayoutMode() === 'compact';
  const clock = formatClock(t, timeZone, locale);
  const cloudPercent = cloud.effectivePct === null ? null : String(Math.round(cloud.effectivePct));
  return (
    <dl className={styles.strip} aria-label={m.live.strip} data-testid="status-strip" data-compact={compact}>
      <Field id="time" label={m.live.timeLabel} spoken={compact}>
        <time dateTime={new Date(t).toISOString()}>{compact ? clock : `${formatDate(t, timeZone, locale)} ${clock}`}</time>
      </Field>
      <Field id="sky" label={m.live.skyLabel} spoken={compact} last>
        <span data-sky={sky ?? 'pending'}>{sky ? m.live.sky[sky] : m.live.pending}</span>
      </Field>
      <Field id="cloud" label={m.live.cloudLabel}>
        <span data-state={cloud.state}>{compact ? m.live.cloudPercent(cloudPercent) : badgeText(cloud, m)}</span>
      </Field>
      <Field id="count" label={m.live.countLabel}>
        <span data-count={count}>{compact ? String(count) : m.live.visible(count)}</span>
      </Field>
      <Field id="moon" label={m.live.moonLabel} last>
        {moon ? (compact ? m.live.moonPercent(moonFacts(moon).illumination) : m.live.moon(moonFacts(moon))) : m.live.pending}
      </Field>
      {speed !== null && (
        <Field id="speed" label={m.live.speedLabel} last>
          <span data-speed={speed}>{m.live.speed(speed)}</span>
        </Field>
      )}
      {declinationDeg !== null && (
        <Field id="heading" label={m.live.headingLabel} spoken={compact} last>
          <span data-declination={declinationDeg.toFixed(1)}>{m.live.trueNorth({ declination: formatSignedDegrees(declinationDeg, locale) })}</span>
        </Field>
      )}
    </dl>
  );
}
