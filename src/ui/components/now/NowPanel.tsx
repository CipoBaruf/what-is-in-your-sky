import { useId } from 'react';
import type { Messages } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { cloudVerdict } from '../../../lib/cloudVerdict';
import { compassPoint } from '../../../lib/compass';
import { formatClock, formatCountdown } from '../../../lib/timeFormat';
import type { NowItem, NowState, Observer } from '../../../model';
import { DEFAULT_THRESHOLDS, useAppStore, type NowSliceState } from '../../../state';
import { SectionHeading } from '../common/SectionHeading';
import { CloudBadge } from '../weather/CloudBadge';
import styles from './NowPanel.module.css';

/**
 * US-4: which satellites are visible this instant, or plainly why none are.
 * Reads the `now` slice the effects refresh every 10 s (FR-VIS-5) and the
 * job's `hasDarkness` flag for spec §5.6's "no darkness tonight". Only
 * `visible` items are listed (OQ-7: no greyed-out objects in MVP); the
 * others only feed the empty-state reason. R8: the current cloud cover
 * (FR-WX-3), the forecast interpolated to the instant of the last check, or
 * "weather unknown" when there is no forecast (US-7 AC4).
 */
export const degrees = (n: number): string => `${String(Math.round(n))}°`;

/** "sets in 3:12" / "enters Earth's shadow in 1:05" / "fades into the brightening sky in 0:40". */
export function remainingText(item: NowItem, now: number, t: Messages): string {
  if (item.visibleUntil === undefined) return t.now.remainingUnknown;
  return t.now.remaining({ reason: item.endReason ?? 'horizon', countdown: formatCountdown(item.visibleUntil - now) });
}

export type NowSummary =
  | { kind: 'no-observer' }
  | { kind: 'checking' }
  | { kind: 'error'; message: string }
  | { kind: 'visible'; items: NowItem[] }
  | { kind: 'no-darkness' }
  | { kind: 'daylight'; sunAltDeg: number }
  | { kind: 'nothing-up'; minElevationDeg: number }
  | { kind: 'all-in-shadow'; count: number };

/** The panel's state, keyed on `sky` and the item flags (TASKS R7). */
export function summarise(observer: Observer | null, now: NowSliceState, hasDarkness: boolean | null): NowSummary {
  if (!observer) return { kind: 'no-observer' };
  const state = now.observer === observer ? now.state : null;
  if (!state) return now.observer === observer && now.error ? { kind: 'error', message: now.error } : { kind: 'checking' };
  const visible = state.items.filter((i) => i.visible).sort((a, b) => b.elDeg - a.elDeg);
  if (visible.length > 0) return { kind: 'visible', items: visible };
  if (hasDarkness === false) return { kind: 'no-darkness' };
  if (state.sky === 'day') return { kind: 'daylight', sunAltDeg: state.sunAltDeg };
  const up = state.items.filter((i) => i.aboveMinElevation);
  if (up.length === 0) return { kind: 'nothing-up', minElevationDeg: DEFAULT_THRESHOLDS.minElevationDeg };
  return { kind: 'all-in-shadow', count: up.length };
}

export function summaryText(summary: NowSummary, t: Messages): string {
  switch (summary.kind) {
    case 'no-observer':
      return t.now.noObserver;
    case 'checking':
      return t.now.checking;
    case 'error':
      return t.now.error(summary.message);
    case 'visible':
      return t.now.visible(summary.items.length);
    case 'no-darkness':
      return t.now.noDarkness;
    case 'daylight':
      return t.now.daylight({ sunDegrees: degrees(Math.abs(summary.sunAltDeg)), above: summary.sunAltDeg >= 0 });
    case 'nothing-up':
      return t.now.nothingUp(degrees(summary.minElevationDeg));
    case 'all-in-shadow':
      return t.now.allInShadow(summary.count);
  }
}

function VisibleItem({ item, now }: { item: NowItem; now: number }) {
  const t = useT();
  return (
    <li>
      <span className={styles.name}>{item.name}</span>
      <div className={styles.where}>
        <span>{t.guide.azimuth({ point: compassPoint(item.azDeg), degrees: degrees(item.azDeg) })}</span>
        <span>{t.now.elevation(degrees(item.elDeg))}</span>
        <span className={styles.remaining}>{remainingText(item, now, t)}</span>
      </div>
    </li>
  );
}

export function NowPanel() {
  const t = useT();
  const locale = useLocale();
  const observer = useAppStore((s) => s.observer);
  const now = useAppStore((s) => s.now);
  const passes = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const headingId = useId();
  const snapshot = weather.observer === observer && weather.status === 'ready' ? weather.snapshot : null;
  const hasDarkness = passes.observer === observer ? passes.hasDarkness : null;
  const summary = summarise(observer, now, hasDarkness);
  const state: NowState | null = observer && now.observer === observer ? now.state : null;
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <SectionHeading id={headingId}>{t.now.heading}</SectionHeading>
      <p role="status" aria-live="polite" className={styles.status}>
        {summaryText(summary, t)}
      </p>
      {summary.kind === 'visible' && state && (
        <ul className={styles.list}>
          {summary.items.map((item) => (
            <VisibleItem key={item.noradId} item={item} now={state.t} />
          ))}
        </ul>
      )}
      {state && observer && (
        <p className={styles.cloud}>
          {t.now.clouds}{' '}
          <CloudBadge
            verdict={cloudVerdict(snapshot, state.t)}
            forecast={snapshot ? { provider: snapshot.provider, fetchedAt: snapshot.fetchedAt } : null}
            timeZone={observer.timeZone}
            moment={t.weather.momentNow}
          />
        </p>
      )}
      {state && observer && <p className={styles.asOf}>{t.now.asOf(formatClock(state.t, observer.timeZone, locale))}</p>}
    </section>
  );
}
