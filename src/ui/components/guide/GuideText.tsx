import { guideSentence } from '../../../lib/phrases';
import type { Pass } from '../../../model';
import styles from './GuideText.module.css';

/** FR-GUIDE-1: the generated sentence, and nothing else (R13 reuses it as the chart's caption). */
export interface GuideTextProps {
  pass: Pass;
  timeZone: string | null;
}

export function GuideText({ pass, timeZone }: GuideTextProps) {
  return (
    <p className={styles.guide} data-testid="guide-sentence">
      {guideSentence(pass, timeZone)}
    </p>
  );
}
