import type { ReactNode } from 'react';
import { useT } from '../../../i18n/useT';
import { moonFacts } from '../../../lib/moonPhrases';
import type { CloudVerdict, MoonState, SkyState } from '../../../model';
import { badgeText } from '../weather/CloudBadge';
import styles from './StatusStrip.module.css';

/**
 * R32 (FR-LIVE-3, US-15 AC2): the live page's facts about the shown instant,
 * as a labelled list beside the drawing — its text alternative (FR-GUIDE-7),
 * which is why the chart carries a name and no caption. Pure display: the
 * page computes every value and this component words it (FR-I18N-2).
 *
 * R77 (FR-WATCH-3, FR-LIVE-3 as amended v2.0): the strip is one line, the
 * same in both states: in the rail, `Sky dark · Clouds Clear, 12 % cloud ·
 * Up 3 · Moon waxing crescent, 18 % lit`, wrapping inside the rail. The clock
 * is on the indicator's line (FR-WATCH-2), so it is not here.
 *
 * R145 (FR-TONIGHT-6, FR-TONIGHT-8): wide's alone. The compact page's line —
 * the clock, the sky word, the cloud word and `n up` — gave way to the context
 * line (`ShownTime.tsx`), and its branch and words went with it.
 *
 * The speed is the pressed control on the playback row and not a field
 * (FR-WATCH-3); the heading field went with the window's being a view of this
 * page (R64). The shown instant and the zone were the compact clock's, and
 * left the props with it.
 */
export interface StatusStripProps {
  /** `null` until the astronomy chunk has evaluated the Sun (`useSkyBodies`). */
  sky: SkyState | null;
  cloud: CloudVerdict;
  /** Satellites with a marker at `t`: the passes whose interval contains it (D-160). */
  count: number;
  /** `null` until evaluated, like `sky`. */
  moon: MoonState | null;
}

/** One field: its label and its value. The `dl` stays flat — a group of `div`s. */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.field} data-testid={`live-${id}`}>
      <dt className={styles.label}>{label}</dt> <dd className={styles.value}>{children}</dd>
    </div>
  );
}

export function StatusStrip({ sky, cloud, count, moon }: StatusStripProps) {
  const m = useT();
  return (
    <dl className={styles.strip} aria-label={m.live.strip} data-testid="status-strip">
      <Field id="sky" label={m.live.skyLabel}>
        <span data-sky={sky ?? 'pending'}>{sky ? m.live.sky[sky] : m.live.pending}</span>
      </Field>
      <Field id="cloud" label={m.live.cloudLabel}>
        <span data-state={cloud.state}>{badgeText(cloud, m)}</span>
      </Field>
      <Field id="count" label={m.live.countLabel}>
        <span data-count={count}>{String(count)}</span>
      </Field>
      <Field id="moon" label={m.live.moonLabel}>
        {moon ? m.live.moon(moonFacts(moon)) : m.live.pending}
      </Field>
    </dl>
  );
}
