import { useT } from '../../../i18n/useT';
import { moonFacts } from '../../../lib/moonPhrases';
import type { MoonState } from '../../../model';
import styles from './MoonLine.module.css';

/**
 * FR-MOON-3 (US-18 AC2): the Moon as an observing fact — phase name,
 * illumination, and where it is when it is up. One line at the foot of the
 * Now panel, computed in the worker with everything else (D-80) and read here
 * without a null check: `NowState.moon` is always a Moon (D-109).
 *
 * It is deliberately a fact and only a fact. The tradition line is a separate
 * component, under its own label, and nothing on this line depends on it
 * (FR-MOON-5).
 */
export interface MoonLineProps {
  moon: MoonState;
}

export function MoonLine({ moon }: MoonLineProps) {
  const t = useT();
  return (
    <p className={styles.line} data-testid="moon-line">
      {t.moon.line(moonFacts(moon))}
    </p>
  );
}
