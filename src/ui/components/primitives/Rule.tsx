import styles from './Rule.module.css';

/**
 * R105 (FR-DS-4 item 5; D-703, D-720): the plain divider — the one-pixel line
 * in `--rule` that a module used to draw as a bare `border-top` or
 * `border-bottom` on whatever block stood under or over it. It is an `<hr>`
 * out of the accessibility tree (`role="presentation"`): the borders it
 * replaces were invisible to assistive technology, and nothing it divides
 * needs a separator announced. The space between the rule and the block it
 * rules off is the host's to place, as a margin from the space scale.
 */
export interface RuleProps {
  /** Placement only — a grid area, a flex basis, a margin from the space scale (D-704). */
  className?: string | undefined;
}

export function Rule({ className }: RuleProps) {
  return <hr role="presentation" className={className ? `${styles.rule} ${className}` : styles.rule} />;
}
