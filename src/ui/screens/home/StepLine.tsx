import { useT } from '../../../i18n/useT';
import styles from '../../App.module.css';

export type Step = 'where' | 'when' | 'what';
export const STEPS: readonly Step[] = ['where', 'when', 'what'];

/**
 * "[01] where" for the current step, "02 when" for the others (FR-FIRST-1's step line, the cold open's pane
 * headings), and "01 where ✓" for a finished one (FR-FIRST-4 as amended v2.0.2).
 */
export function stepLabel(step: Step, current: boolean, word: string, done = false): string {
  const number = String(STEPS.indexOf(step) + 1).padStart(2, '0');
  if (current) return `[${number}] ${word}`;
  return done ? `${number} ${word} ✓` : `${number} ${word}`;
}

export interface StepLineProps {
  current: Step;
  /** The furthest step this visit has reached; the steps up to it, other than the current one, are finished. */
  reached?: Step;
  /** Moves to a finished step. Without it the line is a picture of where the reader is, as the cold open's was. */
  onGo?: (step: Step) => void;
}

/**
 * FR-FIRST-1: `[01] where ── 02 when ── 03 what`, the current step bracketed
 * and in the accent, the others dim. R82 (FR-FIRST-4 as amended v2.0.2,
 * D-513): on the phone's steps a finished step is written `01 where ✓` and is
 * a control that returns to it.
 */
export function StepLine({ current, reached = current, onGo }: StepLineProps) {
  const t = useT();
  const last = STEPS.indexOf(reached);
  return (
    <ol className={styles.steps} aria-label={t.home.stepsLabel} data-testid="step-line">
      {STEPS.map((step, index) => {
        const isCurrent = step === current;
        const done = !isCurrent && index <= last && onGo !== undefined;
        return (
          <li key={step} className={styles.stepItem} {...(isCurrent ? { 'aria-current': 'step' as const } : {})} {...(done ? { 'data-done': '' } : {})}>
            {done ? (
              <button
                type="button"
                className={`inline-control ${styles.stepBack}`}
                data-testid={`step-back-${step}`}
                onClick={() => {
                  onGo(step);
                }}
              >
                {stepLabel(step, false, t.home.steps[step], true)}
              </button>
            ) : (
              stepLabel(step, isCurrent, t.home.steps[step])
            )}
          </li>
        );
      })}
    </ol>
  );
}
