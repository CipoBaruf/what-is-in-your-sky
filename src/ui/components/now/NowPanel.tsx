import { useId } from 'react';
import { compassPoint } from '../../../lib/compass';
import { formatClock, formatCountdown } from '../../../lib/timeFormat';
import type { NowItem, NowState, Observer, PassBoundaryReason } from '../../../model';
import { DEFAULT_THRESHOLDS, useAppStore, type NowSliceState } from '../../../state';
import styles from './NowPanel.module.css';

/**
 * US-4: which satellites are visible this instant, or plainly why none are.
 * Reads the `now` slice the effects refresh every 10 s (FR-VIS-5) and the
 * job's `hasDarkness` flag for spec §5.6's "no darkness tonight". Only
 * `visible` items are listed (OQ-7: no greyed-out objects in MVP); the
 * others only feed the empty-state reason. Cloud cover arrives in R8 (FR-WX-3).
 */
export const degrees = (n: number): string => `${String(Math.round(n))}°`;

/** "sets in 3:12" / "enters Earth's shadow in 1:05" / "fades into the brightening sky in 0:40". */
export function remainingText(item: NowItem, t: number): string {
  if (item.visibleUntil === undefined) return 'visible for a while yet';
  const countdown = formatCountdown(item.visibleUntil - t);
  const verb: Record<PassBoundaryReason, string> = {
    horizon: 'sets in',
    shadow: "enters Earth's shadow in",
    twilight: 'fades into the brightening sky in',
  };
  return `${verb[item.endReason ?? 'horizon']} ${countdown}`;
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

export function summaryText(summary: NowSummary): string {
  switch (summary.kind) {
    case 'no-observer':
      return 'Enter coordinates to see what is overhead right now.';
    case 'checking':
      return 'Checking the sky…';
    case 'error':
      return `Could not check the sky: ${summary.message}`;
    case 'visible':
      return summary.items.length === 1 ? '1 satellite visible right now' : `${String(summary.items.length)} satellites visible right now`;
    case 'no-darkness':
      return 'No darkness tonight at this latitude: the sun never gets low enough for satellites to be seen.';
    case 'daylight':
      return `Daylight: the sun is ${formatSunAlt(summary.sunAltDeg)}. Satellites are not visible until the sky is dark.`;
    case 'nothing-up':
      return `Nothing visible right now: no catalog satellite is above ${degrees(summary.minElevationDeg)}.`;
    case 'all-in-shadow':
      return summary.count === 1
        ? "Nothing visible right now: 1 satellite is up but in Earth's shadow."
        : `Nothing visible right now: ${String(summary.count)} satellites are up but all in Earth's shadow.`;
  }
}

/** "12° above the horizon" / "3° below the horizon". */
function formatSunAlt(sunAltDeg: number): string {
  const n = Math.round(Math.abs(sunAltDeg));
  return `${String(n)}° ${sunAltDeg >= 0 ? 'above' : 'below'} the horizon`;
}

function VisibleItem({ item, t }: { item: NowItem; t: number }) {
  return (
    <li>
      <span className={styles.name}>{item.name}</span>
      <div className={styles.where}>
        <span>
          {compassPoint(item.azDeg)} {degrees(item.azDeg)}
        </span>
        <span>{degrees(item.elDeg)} up</span>
        <span className={styles.remaining}>{remainingText(item, t)}</span>
      </div>
    </li>
  );
}

export function NowPanel() {
  const observer = useAppStore((s) => s.observer);
  const now = useAppStore((s) => s.now);
  const passes = useAppStore((s) => s.passes);
  const headingId = useId();
  const hasDarkness = passes.observer === observer ? passes.hasDarkness : null;
  const summary = summarise(observer, now, hasDarkness);
  const state: NowState | null = observer && now.observer === observer ? now.state : null;
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        Right now
      </h2>
      <p role="status" aria-live="polite" className={styles.status}>
        {summaryText(summary)}
      </p>
      {summary.kind === 'visible' && state && (
        <ul className={styles.list}>
          {summary.items.map((item) => (
            <VisibleItem key={item.noradId} item={item} t={state.t} />
          ))}
        </ul>
      )}
      {state && observer && <p className={styles.asOf}>as of {formatClock(state.t, observer.timeZone)}</p>}
    </section>
  );
}
