import { useEffect, useId, useRef } from 'react';
import { useLocale, useT } from '../../../i18n/useT';
import { heldOffset, type PassTimes } from '../../../lib/playback';
import { formatShortClock } from '../../../lib/timeFormat';
import type { OpeningChoice } from '../../../lib/tonightJump';
import type { EpochMs } from '../../../model';
import { TextButton } from '../primitives/TextButton';
import styles from './OpeningCard.module.css';

/** A visible pass as the card names it: its times and its satellite's name (a `Pass` is one). */
export type CardPass = PassTimes & { name: string };

/** The two choices that draw a card: `up` draws none (FR-FULL-10's first case). */
export type CardChoice = Exclude<OpeningChoice<CardPass>, { kind: 'up' }>;

/**
 * R146 (FR-FULL-10, FR-FULL-8, D-925): the card over the compact live page's sky when nothing visible is up as the
 * page opens. `ask`: "Nothing visible up now." and, at `--small`, the pass line — the name (the part that gives
 * way, cut with an ellipsis), the rise time in the observer's zone and the chip's offset from now to the rise
 * (`Tiangong · 21:47 · in 4 h 12 min`, the chip's words, without `tonight` or a weekday: D-930) — over
 * `[ see next pass ]` and `[ see now ]`. `advise`: "No visible pass in the next 24 h." over `[ see the sky now ]`.
 *
 * A `role="group"` named by its sentence, the sentence and the pass line a polite live region, focus to the first
 * button on mount. Pure display: `openingChoice` decides, the page (R148) mounts the card, answers `onNext(at)` with
 * `setT(at)` and play, and `onNow()` by clearing it; `Esc` is the page's (D-927). Each button is a `.target`.
 */
export interface OpeningCardProps {
  choice: CardChoice;
  /** The real clock the offset is measured from, `usePlayback`'s `realNow`. */
  now: EpochMs;
  timeZone: string | null;
  /** `[ see next pass ]`: land on `at`, the pass's lead instant, and play. */
  onNext: (at: EpochMs) => void;
  /** `[ see now ]` and `[ see the sky now ]`: stay on real time. */
  onNow: () => void;
}

export function OpeningCard({ choice, now, timeZone, onNext, onNow }: OpeningCardProps) {
  const m = useT();
  const locale = useLocale();
  const words = m.live.opening;
  const sentenceId = useId();
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  if (choice.kind === 'advise') {
    return (
      <div className={styles.card} role="group" aria-labelledby={sentenceId} data-testid="live-card" data-kind="advise">
        <p id={sentenceId} className={`${styles.sentence} ${styles.small}`} aria-live="polite">
          {words.noPass}
        </p>
        <div className={styles.actions}>
          <TextButton label={words.seeSkyNow} className="target" ref={first} data-testid="live-card-now" onClick={onNow} />
        </div>
      </div>
    );
  }

  const { pass, at } = choice;
  const chip = m.live.chip({ kind: 'ahead', ...heldOffset(pass.start.t, now), tonight: false, weekday: null });
  const tail = `${words.separator}${words.passWhen({ time: formatShortClock(pass.start.t, timeZone, locale), chip })}`;
  return (
    <div className={styles.card} role="group" aria-labelledby={sentenceId} data-testid="live-card" data-kind="ask">
      <div aria-live="polite">
        <p id={sentenceId} className={styles.sentence}>
          {words.nothingUp}
        </p>
        <p className={styles.passLine} data-testid="live-card-pass">
          <span className={styles.name}>{pass.name}</span>
          <span className={styles.tail}>{tail}</span>
        </p>
      </div>
      <div className={styles.actions}>
        <TextButton label={words.seeNext} className="target" ref={first} data-testid="live-card-next" onClick={() => onNext(at)} />
        <TextButton label={words.seeNow} className="target" data-testid="live-card-now" onClick={onNow} />
      </div>
    </div>
  );
}
