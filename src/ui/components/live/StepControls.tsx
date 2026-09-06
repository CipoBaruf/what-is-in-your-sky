import { useT } from '../../../i18n/useT';
import { MINUTE_MS, nextRise, previousRise, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Pass } from '../../../model';
import styles from './StepControls.module.css';

/**
 * R48 (FR-TRAJ-5, US-22 AC6, D-190): the stepping row under the stripe — the
 * six buttons the spike chose (`docs/window/FINDINGS.md`, OQ-18):
 *
 *   |◀ rise   −10m   −1m   +1m   +10m   rise ▶|
 *
 * `rise ▶|` lands the shown instant on the next rise in one tap, which is what
 * US-22 AC6 asks for in three; `|◀ rise` the previous one; the four in the
 * middle step a minute or ten either way. A rise button with nowhere to go is
 * disabled rather than absent, so the row never moves. The visible labels are
 * the spike's glyphs — 33 cells with their gaps, inside FR-COMP-4's 36 — and
 * the accessible names say the same in words. Pure display: the hook's
 * `stepTo` (D-190) is the one contract, and it clamps.
 */
export interface StepControlsProps {
  /** The shown instant. */
  t: EpochMs;
  span: Span;
  passes: readonly Pass[];
  onStep: (t: EpochMs) => void;
}

export function StepControls({ t, span, passes, onStep }: StepControlsProps) {
  const m = useT();
  const previous = previousRise(passes, t, span);
  const next = nextRise(passes, t, span);
  const step = (ms: number): void => {
    onStep(t + ms);
  };
  return (
    <div className={styles.steps} role="group" aria-label={m.live.stepping} data-testid="step-controls">
      <button type="button" className={styles.step} data-step="prev-rise" aria-label={m.live.stepName.prevRise} disabled={previous === null} onClick={() => previous !== null && onStep(previous)}>
        {m.live.step.prevRise}
      </button>
      <button type="button" className={styles.step} data-step="-10m" aria-label={m.live.stepName.back10} onClick={() => step(-10 * MINUTE_MS)}>
        {m.live.step.back10}
      </button>
      <button type="button" className={styles.step} data-step="-1m" aria-label={m.live.stepName.back1} onClick={() => step(-MINUTE_MS)}>
        {m.live.step.back1}
      </button>
      <button type="button" className={styles.step} data-step="+1m" aria-label={m.live.stepName.forward1} onClick={() => step(MINUTE_MS)}>
        {m.live.step.forward1}
      </button>
      <button type="button" className={styles.step} data-step="+10m" aria-label={m.live.stepName.forward10} onClick={() => step(10 * MINUTE_MS)}>
        {m.live.step.forward10}
      </button>
      <button type="button" className={styles.step} data-step="next-rise" aria-label={m.live.stepName.nextRise} disabled={next === null} onClick={() => next !== null && onStep(next)}>
        {m.live.step.nextRise}
      </button>
    </div>
  );
}
