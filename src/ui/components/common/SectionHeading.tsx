import type { ReactNode } from 'react';
import styles from './SectionHeading.module.css';

/**
 * R12 (FR-X-6): a section title drawn as a character rule, `── Title ─────`,
 * the way a terminal pane is titled. The rule characters are CSS content, so
 * the heading's accessible name is the title alone; the trailing rule is a
 * long run of `─` clipped to the width, which keeps it on the character grid
 * at any viewport. Sections use it through `aria-labelledby`.
 */
export interface SectionHeadingProps {
  id: string;
  children: ReactNode;
}

export function SectionHeading({ id, children }: SectionHeadingProps) {
  return (
    <h2 id={id} className={styles.heading}>
      <span className={styles.title}>{children}</span>
    </h2>
  );
}
