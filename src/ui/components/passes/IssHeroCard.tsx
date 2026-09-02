import { useId } from 'react';
import { formatClockDuration } from '../../../lib/format';
import { TWILIGHT_LABEL } from '../../../lib/phrases';
import type { EpochMs, Pass, WeatherSnapshot } from '../../../model';
import { countdownState } from '../common/Countdown';
import { useNow } from '../../hooks/useNow';
import { OpenGuide, PassFields } from './PassCard';
import styles from './IssHeroCard.module.css';

/**
 * Spec §8 rank 1 (R12): the next pass of a featured object (the ISS), pinned
 * above the list. Same fields as a card, plus a kicker ("Next ISS pass") and
 * a live countdown to its rise, peak or end (US-5 AC4) ticking every second
 * from the wall clock (UI code may read it; `src/lib` may not, D-15). The
 * pass it shows is chosen by the list (`lib/passSort.nextFeaturedPass`).
 */
export const HERO_TICK_MS = 1000;

/** "Next ISS pass" for the station, "Next <name> pass" for any other featured object. */
export function heroKicker(pass: Pass): string {
  return pass.name.startsWith('ISS') ? 'Next ISS pass' : `Next ${pass.name} pass`;
}

/** "Appears in 12:34" / "Peak in 0:40" / "Sets in 1:02" / "Ended 3:00 ago". */
export function heroCountdown(pass: Pass, now: EpochMs): string {
  const state = countdownState(pass, now);
  const clock = formatClockDuration(state.seconds);
  return state.phase === 'over' ? `Ended ${clock} ago` : `${state.label} ${clock}`;
}

export interface IssHeroCardProps {
  pass: Pass;
  timeZone: string | null;
  onOpen?: (passId: string) => void;
  weather?: WeatherSnapshot | null;
  /** The clock, for tests; the card ticks itself otherwise. */
  now?: EpochMs;
}

export function IssHeroCard({ pass, timeZone, onOpen, weather, now: nowProp }: IssHeroCardProps) {
  const headingId = useId();
  const clock = useNow(HERO_TICK_MS);
  const now = nowProp ?? clock;
  const state = countdownState(pass, now);
  return (
    <article className={styles.hero} aria-labelledby={headingId} data-pass-id={pass.id} data-testid="iss-hero">
      <p className={styles.kicker}>{heroKicker(pass)}</p>
      <h2 id={headingId} className={styles.name}>
        {pass.name}
      </h2>
      <p role="timer" aria-live="off" className={styles.countdown} data-phase={state.phase}>
        {heroCountdown(pass, now)}
      </p>
      {pass.twilight && <p className={styles.twilight}>{TWILIGHT_LABEL}</p>}
      <PassFields pass={pass} timeZone={timeZone} {...(weather !== undefined ? { weather } : {})} />
      {onOpen && <OpenGuide pass={pass} headingId={headingId} onOpen={onOpen} />}
    </article>
  );
}
