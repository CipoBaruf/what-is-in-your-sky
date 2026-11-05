import { useMemo } from 'react';
import type { EpochMs, Observer, Pass } from '../../../../model';
import { useAppStore } from '../../../../state';
import { sameLocation } from '../../../../state/slices/location';
import { Countdown } from '../../../components/common/Countdown';
import { useSkyBands } from '../../../components/live/useSkyBands';
import { TimeControl } from '../../../components/sky/time/TimeControl';
import type { Playback } from '../../../components/sky/time/usePlayback';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098) → R187 (FR-WIDE-4, D-1100): the wide pass detail's `Time` row — the countdown to the pass
 * on the real clock, then the shared `TimeControl` over the page's `t` with `[ now ]` while held; the pass is the one
 * mark on the overview and the stripe. The rise, peak and set buttons are the times row's (`TimesRow`'s `onSet`).
 */
export function PassTime({ pass, observer, playback, now }: { pass: Pass; observer: Observer; playback: Playback; now: EpochMs }) {
  const { span } = playback;
  const bands = useSkyBands(observer, span);
  const weather = useAppStore((s) => s.weather);
  const passes = useMemo(() => (pass.start.t <= span.end && pass.end.t >= span.start ? [pass] : []), [pass, span]);
  const clouds = weather.status === 'ready' && sameLocation(weather.observer, observer) ? weather.snapshot?.hourly : undefined;
  return (
    <div className={styles.group} data-testid="pass-time">
      <Countdown pass={pass} now={now} timeZone={observer.timeZone} steps={false} />
      <TimeControl playback={playback} passes={passes} bands={bands} now={now} timeZone={observer.timeZone} clouds={clouds} withNow />
    </div>
  );
}
