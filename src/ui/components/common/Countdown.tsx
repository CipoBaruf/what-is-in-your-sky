import { formatClockDuration } from '../../../lib/format';
import { formatClock } from '../../../lib/timeFormat';
import type { EpochMs, Pass } from '../../../model';
import styles from './Countdown.module.css';

/**
 * US-6 (R6): the live countdown rise → peak → set. Pure display: `now`
 * arrives as a prop, the parent ticks it. `countdownState` is the whole
 * logic and is tested on its own.
 */
export type CountdownPhase = 'before' | 'to-peak' | 'to-end' | 'over';

export interface CountdownState {
  phase: CountdownPhase;
  /** "Appears in", "Peak in", "Sets in", "Ended". */
  label: string;
  /** Seconds to the next boundary, or since the end when `over`. */
  seconds: number;
}

const START_LABEL: Record<Pass['startReason'], string> = { horizon: 'Appears in', shadow: 'Leaves shadow in', twilight: 'Visible in' };
const END_LABEL: Record<Pass['endReason'], string> = { horizon: 'Sets in', shadow: 'Enters shadow in', twilight: 'Fades in' };

export function countdownState(pass: Pass, now: EpochMs): CountdownState {
  if (now < pass.start.t) return { phase: 'before', label: START_LABEL[pass.startReason], seconds: (pass.start.t - now) / 1000 };
  if (now < pass.peak.t) return { phase: 'to-peak', label: 'Peak in', seconds: (pass.peak.t - now) / 1000 };
  if (now < pass.end.t) return { phase: 'to-end', label: END_LABEL[pass.endReason], seconds: (pass.end.t - now) / 1000 };
  return { phase: 'over', label: 'Ended', seconds: (now - pass.end.t) / 1000 };
}

export interface CountdownProps {
  pass: Pass;
  now: EpochMs;
  timeZone: string | null;
}

const STEPS: { key: 'start' | 'peak' | 'end'; name: string }[] = [
  { key: 'start', name: 'rise' },
  { key: 'peak', name: 'peak' },
  { key: 'end', name: 'set' },
];

/** Which step is the current target: the one whose time is next. */
function activeStep(phase: CountdownPhase): 'start' | 'peak' | 'end' | null {
  switch (phase) {
    case 'before':
      return 'start';
    case 'to-peak':
      return 'peak';
    case 'to-end':
      return 'end';
    case 'over':
      return null;
  }
}

export function Countdown({ pass, now, timeZone }: CountdownProps) {
  const state = countdownState(pass, now);
  const active = activeStep(state.phase);
  const clock = formatClockDuration(state.seconds);
  return (
    <div className={styles.countdown}>
      <p className={styles.headline} role="timer" aria-live="off" data-phase={state.phase}>
        {state.phase === 'over' ? `Ended ${clock} ago` : `${state.label} ${clock}`}
      </p>
      <ol className={styles.steps} aria-label="Rise, peak and set times">
        {STEPS.map(({ key, name }) => (
          <li key={key} className={styles.step} aria-current={active === key ? 'step' : undefined}>
            <span className={styles.stepName}>{name}</span> {formatClock(pass[key].t, timeZone)}
          </li>
        ))}
      </ol>
    </div>
  );
}
