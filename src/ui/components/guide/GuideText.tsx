import { useLocale, useT } from '../../../i18n/useT';
import { guideParams } from '../../../lib/phrases';
import type { Pass } from '../../../model';
import styles from './GuideText.module.css';

/** FR-GUIDE-1: the generated sentence, and nothing else (R13 reuses it as the chart's caption). R17: `lib` supplies the parameters, the catalog the sentence. */
export interface GuideTextProps {
  pass: Pass;
  timeZone: string | null;
  /** R132 (FR-FLOW-7): the sentence's id where it is the drawing's text alternative on the page (`aria-describedby`). */
  id?: string;
}

export function GuideText({ pass, timeZone, id }: GuideTextProps) {
  const t = useT();
  const locale = useLocale();
  return (
    <p className={styles.guide} data-testid="guide-sentence" {...(id === undefined ? {} : { id })}>
      {t.guide.sentence(guideParams(pass, timeZone, locale))}
    </p>
  );
}
