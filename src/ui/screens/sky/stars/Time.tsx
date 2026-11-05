import { useMemo } from 'react';
import { useT } from '../../../../i18n/useT';
import type { EpochMs, Observer } from '../../../../model';
import { useAppStore } from '../../../../state';
import { sameLocation } from '../../../../state/slices/location';
import { useSkyBands } from '../../../components/live/useSkyBands';
import { TextButton } from '../../../components/primitives/TextButton';
import { TimeControl } from '../../../components/sky/time/TimeControl';
import type { Playback } from '../../../components/sky/time/usePlayback';
import styles from '../sky.module.css';

/**
 * R186 (FR-WIDE-1, D-1098) → R187 (FR-WIDE-4, FR-GLOBE-7, D-1100): the wide stars page's `Time` row while the globe is
 * the view — the shared `TimeControl` over the globe's instant, the shown place's passes, sky and clouds where they
 * are the observer's, and under it `[ −1 d ] [ −1 h ] [ +1 h ] [ +1 d ]`, a step past the span moving the span; `[ now ]` while held.
 */
const STEPS = [
  { id: 'dayBack', days: -1 },
  { id: 'hourBack', days: -1 / 24 },
  { id: 'hourAhead', days: 1 / 24 },
  { id: 'dayAhead', days: 1 },
] as const;

export function StarsTime({ playback, place, now }: { playback: Playback; place: Observer; now: EpochMs }) {
  const t = useT();
  const { span } = playback;
  const bands = useSkyBands(place, span);
  // The passes and the forecast are the app's place's; a saved place shown on the globe has neither.
  const passesState = useAppStore((s) => s.passes);
  const weather = useAppStore((s) => s.weather);
  const own = sameLocation(passesState.observer, place);
  const all = passesState.passes;
  const passes = useMemo(() => (own ? all.filter((pass) => pass.start.t <= span.end && pass.end.t >= span.start) : []), [own, all, span]);
  const clouds = weather.status === 'ready' && sameLocation(weather.observer, place) ? weather.snapshot?.hourly : undefined;
  const steps = (
    <div role="group" aria-label={t.globe.stepGroup} className={styles.steps} data-testid="globe-steps">
      {STEPS.map((step) => (
        <TextButton
          key={step.id}
          className="target"
          label={t.globe.steps[step.id]}
          aria-label={t.globe.stepNames[step.id]}
          data-step={step.id}
          onClick={() => {
            playback.shiftDays(step.days);
          }}
        />
      ))}
    </div>
  );
  return (
    <div className={styles.group} data-testid="stars-time">
      <TimeControl playback={playback} passes={passes} bands={bands} now={now} timeZone={place.timeZone} clouds={clouds} under={steps} withNow />
    </div>
  );
}
