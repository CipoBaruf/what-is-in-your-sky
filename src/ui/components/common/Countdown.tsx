import type { CountdownPhase } from '../../../i18n/messages';
import { useLocale, useT } from '../../../i18n/useT';
import { formatClockDuration } from '../../../lib/format';
import { formatClock } from '../../../lib/timeFormat';
import type { EpochMs, Pass, PassBoundaryReason } from '../../../model';
import styles from './Countdown.module.css';

/**
 * US-6 (R6): the live countdown rise → peak → set. Pure display: `now`
 * arrives as a prop, the parent ticks it. `countdownState` is the whole
 * logic and is tested on its own. R17: it returns the phase and the boundary
 * reason, never a label — `Messages['countdown']['headline']` words them
 * (FR-I18N-2), so "Appears in 12:34" and "Aparece en 12:34" are each their
 * language's sentence.
 */
export type { CountdownPhase };

export interface CountdownState {
  phase: CountdownPhase;
  /** Which boundary the phase is counting to; `end`'s reason once the peak is past, `start`'s before it, and the end's again when it is over. */
  reason: PassBoundaryReason;
  /** Seconds to the next boundary, or since the end when `over`. */
  seconds: number;
}

export function countdownState(pass: Pass, now: EpochMs): CountdownState {
  if (now < pass.start.t) return { phase: 'before', reason: pass.startReason, seconds: (pass.start.t - now) / 1000 };
  if (now < pass.peak.t) return { phase: 'to-peak', reason: pass.startReason, seconds: (pass.peak.t - now) / 1000 };
  if (now < pass.end.t) return { phase: 'to-end', reason: pass.endReason, seconds: (pass.end.t - now) / 1000 };
  return { phase: 'over', reason: pass.endReason, seconds: (now - pass.end.t) / 1000 };
}

export interface CountdownProps {
  pass: Pass;
  now: EpochMs;
  timeZone: string | null;
}

const STEPS = ['start', 'peak', 'end'] as const;
const STEP_NAME = { start: 'rise', peak: 'peak', end: 'set' } as const;

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
  const t = useT();
  const locale = useLocale();
  const state = countdownState(pass, now);
  const active = activeStep(state.phase);
  const clock = formatClockDuration(state.seconds);
  return (
    <div className={styles.countdown}>
      <p className={styles.headline} role="timer" aria-live="off" data-phase={state.phase}>
        {t.countdown.headline({ phase: state.phase, reason: state.reason, clock })}
      </p>
      <ol className={styles.steps} aria-label={t.countdown.steps}>
        {STEPS.map((key) => (
          <li key={key} className={styles.step} aria-current={active === key ? 'step' : undefined}>
            <span className={styles.stepName}>{t.countdown[STEP_NAME[key]]}</span> {formatClock(pass[key].t, timeZone, locale)}
          </li>
        ))}
      </ol>
    </div>
  );
}
