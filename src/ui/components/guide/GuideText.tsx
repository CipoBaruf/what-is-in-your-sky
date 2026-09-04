import { useLocale, useT } from '../../../i18n/useT';
import { guideParams } from '../../../lib/phrases';
import type { Pass } from '../../../model';
import styles from './GuideText.module.css';

/** FR-GUIDE-1: the generated sentence, and nothing else (R13 reuses it as the chart's caption). R17: `lib` supplies the parameters, the catalog the sentence. */
export interface GuideTextProps {
  pass: Pass;
  timeZone: string | null;
}

export function GuideText({ pass, timeZone }: GuideTextProps) {
  const t = useT();
  const locale = useLocale();
  return (
    <p className={styles.guide} data-testid="guide-sentence">
      {t.guide.sentence(guideParams(pass, timeZone, locale))}
    </p>
  );
}
