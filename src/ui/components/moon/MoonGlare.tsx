import { useId } from 'react';
import { useT } from '../../../i18n/useT';
import { moonGlareFacts } from '../../../lib/moonPhrases';
import type { MoonGlare as MoonGlareVerdict, MoonState } from '../../../model';
import { DEFAULT_MOON_GLARE_THRESHOLDS } from '../../../state';
import styles from './MoonGlare.module.css';

/**
 * FR-MOON-2 (US-18 AC1): the two places the glare warning appears. The card
 * gets the `[moon glare]` label, the guide gets the one sentence, and both
 * carry the same tooltip — the illumination and the separation this pass was
 * judged on, and the three thresholds it was judged against, which is what
 * makes the label something a reader can disagree with (OQ-12 may still move
 * them, so they are read from the state, never written into the copy).
 *
 * Both render nothing when there is no glare. The verdict is the worker's,
 * computed once at the pass peak (D-109); nothing here re-tests a condition.
 */
export interface MoonGlareProps {
  moon: MoonState;
  glare: MoonGlareVerdict;
}

/** The trigger and its tooltip; the caller supplies the visible text and the class it wears. */
function Tip({ moon, glare, children, className }: MoonGlareProps & { children: string; className: string | undefined }) {
  const t = useT();
  const tipId = useId();
  return (
    <span className={styles.wrap}>
      <span className={`inline-control ${className}`} tabIndex={0} aria-describedby={tipId}>
        {children}
      </span>
      <span role="tooltip" id={tipId} className={styles.tip}>
        {t.moon.glare.tooltip(moonGlareFacts(moon, glare, DEFAULT_MOON_GLARE_THRESHOLDS))}
      </span>
    </span>
  );
}

/** The label on a pass card, drawn `[moon glare]` the way the twilight and cloud labels are. */
export function MoonGlareLabel({ moon, glare }: MoonGlareProps) {
  const t = useT();
  if (!glare.glare) return null;
  return (
    <p className={styles.label} data-testid="moon-glare-label">
      <Tip moon={moon} glare={glare} className={styles.badge}>
        {t.moon.glare.label}
      </Tip>
    </p>
  );
}

/** The guide's one sentence (FR-MOON-2), which is also what the tooltip hangs from there. */
export function MoonGlareNote({ moon, glare }: MoonGlareProps) {
  const t = useT();
  if (!glare.glare) return null;
  return (
    <p className={styles.note} data-testid="moon-glare-note">
      <Tip moon={moon} glare={glare} className={styles.sentence}>
        {t.moon.glare.sentence}
      </Tip>
    </p>
  );
}
