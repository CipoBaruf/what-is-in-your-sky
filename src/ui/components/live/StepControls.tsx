import { useT } from '../../../i18n/useT';
import { CHUNK_MS, MINUTE_MS, nextRise, previousRise, type Span } from '../../../lib/timeStripe';
import type { EpochMs, Pass } from '../../../model';
import { TextButton } from '../primitives/TextButton';
import styles from './StepControls.module.css';

/**
 * R48 (FR-TRAJ-5, US-22 AC6, D-190), re-cut by R70 (FR-SPAN-3, FR-SPAN-4,
 * D-384): the stepping row under the stripe, six buttons on one line:
 *
 *   |◀ pass   ◀ 4h   −1m   +1m   4h ▶   pass ▶|
 *
 * `pass ▶|` lands the shown instant on the next pass's rise in one tap, which
 * is what US-22 AC6 asks for in three; `|◀ pass` the previous one. The chunk
 * buttons move it four hours — `STRIPE_CHUNK_H`, the stripe's own window — so
 * the tap that moves the instant is the tap that redraws the stripe around it
 * (FR-SPAN-1: the chunk follows the instant and is never set).
 *
 * R223 (FR-CTRL-16, D-1298): each is FR-CTRL-1's box, a `TextButton`; the row
 * draws no control of its own. The row is the wide page's alone since R144, so
 * it is counted against the rail's 44 cells, not FR-COMP-4's compact 35.
 *
 * A button with nowhere to go is disabled rather than absent, so the row never
 * moves — the rise jumps at the ends of the passes, the chunk buttons at the
 * ends of the span. The accessible names say the glyphs in words. Pure display:
 * the hook's `stepTo` (D-190) is the one contract, and it clamps.
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
      <TextButton label={m.live.step.prevRise} data-step="prev-rise" aria-label={m.live.stepName.prevRise} disabled={previous === null} onClick={() => previous !== null && onStep(previous)} />
      <TextButton label={m.live.step.backChunk} data-step="-chunk" aria-label={m.live.stepName.backChunk} disabled={t <= span.start} onClick={() => step(-CHUNK_MS)} />
      <TextButton label={m.live.step.back1} data-step="-1m" aria-label={m.live.stepName.back1} onClick={() => step(-MINUTE_MS)} />
      <TextButton label={m.live.step.forward1} data-step="+1m" aria-label={m.live.stepName.forward1} onClick={() => step(MINUTE_MS)} />
      <TextButton label={m.live.step.forwardChunk} data-step="+chunk" aria-label={m.live.stepName.forwardChunk} disabled={t >= span.end} onClick={() => step(CHUNK_MS)} />
      <TextButton label={m.live.step.nextRise} data-step="next-rise" aria-label={m.live.stepName.nextRise} disabled={next === null} onClick={() => next !== null && onStep(next)} />
    </div>
  );
}
