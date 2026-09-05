import type { ReactNode } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { moonFacts } from '../../../lib/moonPhrases';
import { formatClock, formatDate } from '../../../lib/timeFormat';
import type { CloudVerdict, EpochMs, MoonState, SkyState } from '../../../model';
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
 * field while playing.
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

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.field} data-testid={`live-${id}`}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

export function StatusStrip({ t, timeZone, sky, cloud, count, moon }: StatusStripProps) {
  const m = useT();
  const locale = useLocale();
  return (
    <dl className={styles.strip} aria-label={m.live.strip} data-testid="status-strip">
      <Field id="time" label={m.live.timeLabel}>
        <time dateTime={new Date(t).toISOString()}>
          {formatDate(t, timeZone, locale)} {formatClock(t, timeZone, locale)}
        </time>
      </Field>
      <Field id="sky" label={m.live.skyLabel}>
        <span data-sky={sky ?? 'pending'}>{sky ? m.live.sky[sky] : m.live.pending}</span>
      </Field>
      <Field id="cloud" label={m.live.cloudLabel}>
        <span data-state={cloud.state}>{badgeText(cloud, m)}</span>
      </Field>
      <Field id="count" label={m.live.countLabel}>
        <span data-count={count}>{m.live.visible(count)}</span>
      </Field>
      <Field id="moon" label={m.live.moonLabel}>
        {moon ? m.live.moon(moonFacts(moon)) : m.live.pending}
      </Field>
    </dl>
  );
}
