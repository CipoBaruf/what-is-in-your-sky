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
  /**
   * R76 (board 1B): the home's pane headings. `active` draws the leading rule
   * and the title in the accent (the reading the reader is on), `muted` both in
   * `--fg-dim` (a pane that is not there yet); either way the trailing rule is
   * `--rule`, a line and not a word. Left out, the heading is as it always was.
   */
  tone?: 'active' | 'muted';
  /**
   * R92 (FR-A11Y-2, D-530): the heading's rank in the page's outline. The class draws it the same at every rank;
   * the element is what a screen reader walks by.
   */
  level?: 2 | 3;
}

export function SectionHeading({ id, children, tone, level = 2 }: SectionHeadingProps) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <Heading id={id} className={tone ? `${styles.heading} ${styles[tone]}` : styles.heading}>
      <span className={styles.title}>{children}</span>
    </Heading>
  );
}
