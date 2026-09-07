import { useT } from '../../../i18n/useT';
import { moonFacts } from '../../../lib/moonPhrases';
import type { MoonState } from '../../../model';
import styles from './MoonAtPeak.module.css';

/**
 * US-18 AC1 (R49, F-14): the Moon's phase and illumination at the pass peak,
 * on the card and in the guide.
 *
 * R30 shipped the glare half of that criterion and read the rest of it as part
 * of the same warning, so the only pass that said anything about the Moon was
 * one FR-MOON-2 had already condemned. The criterion asks for two things: the
 * facts on every pass, *and* the warning when the three conditions hold. A
 * reader deciding between tonight's two passes wants to know that the Moon is
 * a 30 % crescent as much as they want the label when it is a bright one near
 * the track — it is the same sentence's other half, and it is why this
 * component does not take the verdict at all.
 *
 * Below the horizon it renders nothing, by the Now panel's own test of "up"
 * (`moonFacts`, the one set of facts for both). The Now panel is where "below
 * the horizon" is worth saying, because it describes the sky; a pass card is a
 * short list of facts about one pass and a Moon that is not there is not one
 * of them.
 */
export interface MoonAtPeakProps {
  moon: MoonState;
  /** The card pulls the line up under the labels above it; the guide's paragraphs set their own rhythm. */
  variant?: 'card' | 'guide';
}

export function MoonAtPeak({ moon, variant = 'card' }: MoonAtPeakProps) {
  const t = useT();
  const facts = moonFacts(moon);
  if (!facts.up) return null;
  return (
    <p className={variant === 'guide' ? styles.guideLine : styles.line} data-testid="moon-at-peak">
      {t.moon.atPeak(facts)}
    </p>
  );
}
